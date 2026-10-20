#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Đồng bộ phiếu trả hàng Sapo -> bảng Supabase platform_returns_feed,
rồi in danh sách "hoàn về chưa nhận" (đối chiếu với lượt quét Sổ Kho).

Chạy: python3 scripts/sync_returns_feed.py
Cần: ~/.config/sapo/credentials.json (store, api_key, api_secret).

Dùng cho: khối "Hoàn về chưa nhận" trên web Sổ Kho (đọc bảng feed này)
và Báo cáo 5 trong skill daily-warehouse-report (đọc phần JSON in ra cuối).
"""
import json, os, sys, base64, urllib.request, urllib.parse, urllib.error, unicodedata
import datetime
from datetime import date, timedelta

SUPABASE_URL = "https://dyvublxyrldmmnsrfvpz.supabase.co"
# anon/publishable key — cùng key nhúng công khai trong init.js của chính app này
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dnVibHh5cmxkbW1uc3JmdnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzU4MzMsImV4cCI6MjEwNDExMTgzM30.jM3hD0hNMZ5osaZHDDe5PSm9rQ1Jr6IdWFF0VjT1edI"
FEED_TABLE = "platform_returns_feed"
SCAN_TABLE = "warehouse_return_checks"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
SYNC_WINDOW_DAYS = 60   # chỉ đồng bộ phiếu trả tạo trong N ngày gần nhất
PURGE_AFTER_DAYS = 90   # xoá dòng feed cũ hơn N ngày cho bảng gọn
GRACE_DAYS = 3          # sàn báo "đã trả về" quá N ngày chưa quét -> cảnh báo


def http(url, headers, data=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
        return r.status, json.loads(body) if body.strip() else None


def sapo_headers():
    cred = json.load(open(os.path.expanduser("~/.config/sapo/credentials.json")))
    auth = base64.b64encode(("%s:%s" % (cred["api_key"], cred["api_secret"])).encode()).decode()
    return cred["store"], {"Authorization": "Basic " + auth, "Accept": "application/json", "User-Agent": UA}


def sb_headers(extra=None):
    h = {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY,
         "Content-Type": "application/json", "User-Agent": UA}
    if extra:
        h.update(extra)
    return h


def sb_get_all(path_query):
    """GET toàn bộ dòng, phân trang 1000 (PostgREST cắt cứng 1000/lần)."""
    rows, offset = [], 0
    while True:
        sep = "&" if "?" in path_query else "?"
        url = "%s/rest/v1/%s%slimit=1000&offset=%d" % (SUPABASE_URL, path_query, sep, offset)
        try:
            _, chunk = http(url, sb_headers())
        except urllib.error.HTTPError as e:
            if e.code == 416:
                break
            raise
        rows.extend(chunk or [])
        if not chunk or len(chunk) < 1000:
            break
        offset += 1000
    return rows


def norm_code(raw):
    """Chuẩn hoá mã vận đơn để so khớp: uppercase + đảo ngược lỗi bộ gõ Telex
    (GỶDVGCM -> GYRDVGCM) + bỏ khoảng trắng. Trùng logic normalizeScanCode trong web Sổ Kho."""
    s = (raw or "").strip().upper()
    out = []
    for ch in s:
        if ch in ("Đ",):
            out.append("DD")
            continue
        nfd = unicodedata.normalize("NFD", ch)
        base, marks = nfd[0], nfd[1:]
        seq = base
        if "\u0302" in marks: seq += base   # dấu mũ: Â->AA Ê->EE Ô->OO
        if "\u0306" in marks: seq += "W"    # dấu trăng: Ă->AW
        if "\u031b" in marks: seq += "W"    # dấu móc: Ơ->OW Ư->UW
        if "\u0301" in marks: seq += "S"
        if "\u0300" in marks: seq += "F"
        if "\u0309" in marks: seq += "R"
        if "\u0303" in marks: seq += "X"
        if "\u0323" in marks: seq += "J"
        out.append(seq)
    return "".join(out).replace(" ", "")


def main():
    today = date.today()
    cutoff = (today - timedelta(days=SYNC_WINDOW_DAYS)).isoformat()
    store, sh = sapo_headers()

    # 1. Kéo phiếu trả từ Sapo (mới -> cũ, dừng khi qua cutoff)
    returns, page = [], 1
    while page <= 20:
        _, d = http("https://%s/admin/order_returns.json?limit=250&page=%d" % (store, page), sh)
        batch = d.get("order_returns") or []
        returns.extend(batch)
        if len(batch) < 250 or batch[-1]["created_on"][:10] < cutoff:
            break
        page += 1
    returns = [r for r in returns if r["created_on"][:10] >= cutoff]

    # 2. Feed hiện có -> chỉ fetch chi tiết đơn cho phiếu mới / đổi trạng thái / thiếu mã chiều đi
    existing = {r["sapo_return_id"]: r for r in sb_get_all(
        FEED_TABLE + "?select=sapo_return_id,shipment_status,outbound_tracking,return_tracking")}

    upserts, fetched_orders = [], {}
    for r in returns:
        rid = r["id"]
        ship = r.get("shipment_status")
        rtrk = (r.get("shipping_info") or {}).get("tracking_number")
        old = existing.get(rid)
        need = (old is None or old.get("shipment_status") != ship
                or (old.get("return_tracking") or "") != (rtrk or "")
                or not old.get("outbound_tracking"))
        if not need:
            continue
        oid = r["order_id"]
        if old is None or not old.get("outbound_tracking"):
            if oid not in fetched_orders:
                try:
                    _, od = http("https://%s/admin/orders/%d.json" % (store, oid), sh)
                    trks = [f.get("tracking_number") or f.get("tracking_code")
                            for f in (od["order"].get("fulfillments") or [])]
                    fetched_orders[oid] = "+".join([t for t in trks if t])
                except Exception as e:
                    print("WARN: không lấy được đơn %s: %s" % (oid, e), file=sys.stderr)
                    fetched_orders[oid] = ""
            out_trk = fetched_orders[oid]
        else:
            out_trk = old.get("outbound_tracking")
        src = r.get("order_source") or ""
        upserts.append({
            "sapo_return_id": rid,
            "order_name": r.get("name"),
            "sapo_order_id": oid,
            "platform": "tiktok" if src == "tiktokshop" else ("shopee" if src == "shopee" else src),
            "return_type": r.get("return_type"),
            "shipment_status": ship,
            "returned_on": (r.get("returned_on") or "")[:10] or None,
            "created_on": r["created_on"][:10],
            "return_tracking": rtrk,
            "outbound_tracking": out_trk or None,
            "qty": r.get("total_quantity"),
            "synced_at": datetime.datetime.utcnow().isoformat() + "Z",
        })

    # 3. Upsert theo lô
    for i in range(0, len(upserts), 100):
        chunk = upserts[i:i + 100]
        http(SUPABASE_URL + "/rest/v1/" + FEED_TABLE + "?on_conflict=sapo_return_id",
             sb_headers({"Prefer": "resolution=merge-duplicates,return=minimal"}),
             data=json.dumps(chunk).encode(), method="POST")

    # 4. Dọn dòng quá cũ
    purge_before = (today - timedelta(days=PURGE_AFTER_DAYS)).isoformat()
    http(SUPABASE_URL + "/rest/v1/" + FEED_TABLE + "?created_on=lt." + purge_before,
         sb_headers({"Prefer": "return=minimal"}), method="DELETE")

    # 5. Đối chiếu: hoàn về chưa nhận + phân loại lượt quét không có phiếu
    feed = sb_get_all(FEED_TABLE + "?select=*")
    scans = sb_get_all(SCAN_TABLE + "?select=code,scan_date,platform,return_type")
    scanned = {norm_code(s["code"]) for s in scans}

    def scan_hit(row):
        cands = [row.get("return_tracking") or ""] + (row.get("outbound_tracking") or "").split("+")
        return any(norm_code(c) in scanned for c in cands if c)

    overdue = []
    for row in feed:
        if row.get("shipment_status") != "returned" or scan_hit(row):
            continue
        ref = row.get("returned_on") or row.get("created_on")
        days = (today - date.fromisoformat(ref)).days if ref else 0
        if days >= GRACE_DAYS:
            overdue.append({"code": row.get("return_tracking") or (row.get("outbound_tracking") or "?").split("+")[0],
                            "order": row.get("order_name"), "platform": row.get("platform"),
                            "returned_on": row.get("returned_on"), "days": days,
                            "type": row.get("return_type")})
    overdue.sort(key=lambda x: -x["days"])

    # lượt quét 7 ngày gần nhất không khớp phiếu nào -> tra Sapo xem đơn có tồn tại không
    week_ago = (today - timedelta(days=7)).isoformat()
    feed_codes = set()
    for row in feed:
        for c in [row.get("return_tracking") or ""] + (row.get("outbound_tracking") or "").split("+"):
            if c:
                feed_codes.add(norm_code(c))
    strange = []
    for s in scans:
        if s["scan_date"] < week_ago or norm_code(s["code"]) in feed_codes:
            continue
        try:
            _, d = http("https://%s/admin/orders.json?query=%s&limit=1" % (store, urllib.parse.quote(s["code"])), sh)
            hit = (d.get("orders") or [None])[0]
        except Exception:
            hit = None
        if hit:
            s["classify"] = "huy_truoc_gui"   # đơn tồn tại trên Sapo nhưng không có phiếu trả -> bom/huỷ trước khi gửi, lên kệ là xong
        else:
            s["classify"] = "ma_la"           # không tra ra đơn nào -> mã lỗi/mã lạ, cần người xem
            strange.append(s)

    print(json.dumps({
        "synced": len(upserts), "feed_total": len(feed),
        "overdue": overdue,
        "strange_scans_7d": [{"code": s["code"], "scan_date": s["scan_date"], "platform": s["platform"]} for s in strange],
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
