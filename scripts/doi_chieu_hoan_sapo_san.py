#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Đối chiếu 3 CHIỀU đơn hoàn: SÀN  ×  SAPO  ×  SỔ KHO (lượt quét thật).

Trả lời: "Sapo có thiếu/thừa đơn hoàn nào so với sàn không, và hàng có thật sự
về kho không?"

Chạy:
    python scripts/doi_chieu_hoan_sapo_san.py --thang 10
    python scripts/doi_chieu_hoan_sapo_san.py --tu 2026-10-01 --den 2026-10-31

Cần:
  1. ~/.config/sapo/credentials.json  (store, api_key, api_secret)
  2. File export từ sàn, để trong ~/doi-chieu-hoan (NGOÀI repo vì có SĐT/địa chỉ
     khách — repo này PUBLIC). Tên file phải chứa "shopee" hoặc "tiktok".

Xem quy trình đầy đủ: .claude/skills/doi-chieu-hoan-cuoi-thang/SKILL.md

═══════════════════════════════════════════════════════════════════════════
⚠️ QUY TẮC CỐT LÕI (chốt 30/10/2026 — sai cái này là sai toàn bộ kết luận)
═══════════════════════════════════════════════════════════════════════════
KHÔNG được suy ra "hàng đã về kho" từ việc đơn CÓ MÃ VẬN ĐƠN hay CÓ NGÀY GỬI
HÀNG. Shopee cấp mã vận đơn ngay khi shop bấm "Chuẩn bị hàng", còn "Ngày gửi
hàng" chỉ là HẠN phải giao cho shipper. Đơn chuẩn bị xong mà khách hủy trước
khi shipper tới lấy vẫn có đủ 2 trường đó, nhưng kiện hàng NẰM LẠI TRÊN KỆ.

Dùng đúng 2 cột này (kiểm trên 81 đơn thật, phân tách 100% sạch):
    đã rời kho   ⟺  "Thời gian giao hàng"  CÓ giá trị
    đã về lại kho ⟺  "Trạng thái trả hàng" = "Đã trả hàng"

Và luôn đối chiếu thêm chiều thứ 3 — lượt quét thật trong Sổ Kho — vì đó là
bằng chứng vật lý duy nhất. Sàn với Sapo lệch nhau mà chưa tra lượt quét thì
CHƯA đủ căn cứ nói ai sai.
"""
import argparse
import base64
import csv
import glob
import io
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import date, timedelta

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
EDGE_DAYS = 7          # nới biên: phiếu Sapo tạo trễ/sớm hơn mốc sàn vẫn tính là khớp
SAPO_MAX_PAGES = 40

# tên cột quyết định — xem khối QUY TẮC CỐT LÕI ở trên
COT_DA_ROI_KHO = "Thời gian giao hàng"
COT_DA_VE_KHO = "Trạng thái trả hàng"
GIATRI_DA_VE_KHO = "Đã trả hàng"


def nfc(s):
    """Chuẩn hoá Unicode. BẮT BUỘC cho tên cột tiếng Việt — file Shopee dùng
    dạng tổ hợp khác, tra thẳng 'Ngày gửi hàng' sẽ ra None (gặp thật 30/10)."""
    return unicodedata.normalize("NFC", str(s if s is not None else "")).strip()


def norm(raw):
    """Chuẩn hoá mã để so khớp: bỏ ký tự không phải chữ/số, viết hoa."""
    return re.sub(r"[^0-9A-Z]", "", nfc(raw).upper())


def http(url, headers, data=None, method=None, retries=4):
    import time
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
                return json.loads(body) if body.strip() else None
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503) and attempt < retries:
                time.sleep(2 * (attempt + 1))
                continue
            raise


# ───────────────────────────────────────────────────────── đọc file export sàn
def read_xlsx(path):
    """Đọc sheet đầu của .xlsx bằng stdlib — PC không cần cài openpyxl/pandas."""
    import zipfile
    from xml.etree import ElementTree
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ElementTree.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall(ns + "si"):
                shared.append("".join(t.text or "" for t in si.iter(ns + "t")))
        sheets = sorted(n for n in z.namelist()
                        if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))
        if not sheets:
            return []
        root = ElementTree.fromstring(z.read(sheets[0]))
        rows = []
        for r in root.iter(ns + "row"):
            cells = {}
            for c in r.findall(ns + "c"):
                col = re.sub(r"\d", "", c.get("r") or "")
                v = c.find(ns + "v")
                if c.get("t") == "inlineStr":
                    txt = "".join(t.text or "" for t in c.iter(ns + "t"))
                elif c.get("t") == "s" and v is not None:
                    i = int(v.text or 0)
                    txt = shared[i] if i < len(shared) else ""
                else:
                    txt = (v.text or "") if v is not None else ""
                if txt != "":
                    cells[col] = txt
            if cells:
                rows.append(cells)
        if not rows:
            return []
        cols = sorted({c for r in rows for c in r}, key=lambda s: (len(s), s))
        return [[r.get(c, "") for c in cols] for r in rows]


def read_csv_any(path):
    for enc in ("utf-8-sig", "utf-16", "cp1258", "latin-1"):
        try:
            with io.open(path, "r", encoding=enc, newline="") as f:
                sample = f.read(8192)
                f.seek(0)
                try:
                    d = csv.Sniffer().sniff(sample, delimiters=",;\t")
                except Exception:
                    d = csv.excel
                return [r for r in csv.reader(f, d) if any(x.strip() for x in r)]
        except (UnicodeDecodeError, UnicodeError):
            continue
    return []


def load_san(folder):
    """Đọc mọi file export -> dict {mã đơn: bản ghi}.

    ⚠️ Tra cột theo TÊN, không theo số thứ tự: file Order.cancelled có thêm cột
    'Lý do hủy' làm lệch toàn bộ cột phía sau so với Order.failed_delivery.
    """
    paths = []
    for ext in ("*.xlsx", "*.csv", "*.XLSX", "*.CSV"):
        paths.extend(glob.glob(os.path.join(folder, ext)))

    orders, files = {}, []
    for p in sorted(set(paths)):
        n = os.path.basename(p).lower()
        plat = "shopee" if ("shopee" in n or "spx" in n) else ("tiktok" if "tiktok" in n else None)
        if plat is None:
            files.append((p, "?", 0, "BỎ QUA — tên file không có 'shopee'/'tiktok'"))
            continue
        try:
            table = read_xlsx(p) if p.lower().endswith(".xlsx") else read_csv_any(p)
        except Exception as e:
            files.append((p, plat, 0, "LỖI ĐỌC: %s" % e))
            continue
        if not table:
            files.append((p, plat, 0, "File rỗng"))
            continue

        hdr = [nfc(x) for x in table[0]]
        new = 0
        for r in table[1:]:
            d = {hdr[i]: nfc(r[i]) for i in range(min(len(hdr), len(r)))}
            code = d.get("Mã đơn hàng") or d.get("Mã đơn") or ""
            if not code:
                continue
            if code in orders:
                # Cùng một đơn có thể nằm ở nhiều file và MỖI FILE ĐIỀN KHÁC NHAU:
                # file Order.cancelled chứa cả đơn giao thất bại nhưng để trống
                # cột "Trạng thái trả hàng", chỉ Order.failed_delivery mới điền.
                # Vì vậy phải GỘP, không được lấy file đầu tiên rồi bỏ qua file sau.
                cu = orders[code]
                if not cu["tt_tra_hang"] and d.get(COT_DA_VE_KHO, ""):
                    cu["tt_tra_hang"] = d[COT_DA_VE_KHO]
                if not cu["da_roi_kho"] and d.get(COT_DA_ROI_KHO, ""):
                    cu["da_roi_kho"] = True
                continue
            orders[code] = {
                "platform": plat,
                "ma_don": code,
                "tracking": d.get("Mã vận đơn", ""),
                "trang_thai": d.get("Trạng Thái Đơn Hàng", ""),
                "ly_do_huy": d.get("Lý do hủy", ""),
                "ngay_dat": d.get("Ngày đặt hàng", "")[:10],
                # 2 trường quyết định — xem QUY TẮC CỐT LÕI
                "da_roi_kho": bool(d.get(COT_DA_ROI_KHO, "")),
                "tt_tra_hang": d.get(COT_DA_VE_KHO, ""),
                "file": os.path.basename(p),
            }
            new += 1
        files.append((p, plat, new, "ok" if new else "không có dòng mới"))
    return orders, files


def da_ve_kho(o):
    """Kiện hàng có THẬT SỰ rời kho (và vì đơn hỏng nên sẽ quay về) không?

    Dấu hiệu chính là `Thời gian giao hàng` — nó giống nhau ở MỌI file export,
    còn `Trạng thái trả hàng` chỉ được điền trong file Order.failed_delivery
    nên không dùng làm điều kiện chính được.

    Kiểm trên 81 đơn thật: đúng 9 đơn có `Thời gian giao hàng`, và đúng 9 đơn
    đó có `Trạng thái trả hàng` = "Đã trả hàng" ở file kia. 72 đơn còn lại
    trống cả hai -> hàng chưa bao giờ rời kệ.
    """
    return o["da_roi_kho"] or o["tt_tra_hang"] == GIATRI_DA_VE_KHO


# ───────────────────────────────────────────────────────────────── Sapo & Sổ Kho
def load_sapo(d_from, d_to):
    path = os.path.expanduser("~/.config/sapo/credentials.json")
    if not os.path.exists(path):
        sys.exit("THIEU FILE: %s" % path)
    cred = json.load(open(path, encoding="utf-8"))
    auth = base64.b64encode(("%s:%s" % (cred["api_key"], cred["api_secret"])).encode()).decode()
    h = {"Authorization": "Basic " + auth, "Accept": "application/json", "User-Agent": UA}
    store = cred["store"]

    raw, page = [], 1
    while page <= SAPO_MAX_PAGES:
        d = http("https://%s/admin/order_returns.json?limit=250&page=%d" % (store, page), h)
        batch = (d or {}).get("order_returns") or []
        if not batch:
            break
        raw.extend(batch)
        if len(batch) < 250 or batch[-1]["created_on"][:10] < d_from:
            break
        page += 1

    out = []
    for r in raw:
        day = r["created_on"][:10]
        if not (d_from <= day <= d_to):
            continue
        si = r.get("shipping_info") or {}
        src = r.get("order_source") or ""
        out.append({
            "platform": "tiktok" if src == "tiktokshop" else ("shopee" if src == "shopee" else src or "?"),
            "sapo_return_id": r["id"],
            "return_code": r.get("name"),
            "order_code": (r.get("order") or {}).get("name"),
            "return_tracking": si.get("tracking_number"),
            "outbound_tracking": "+".join(si.get("fulfillment_tracking_numbers") or []),
            "return_type": r.get("return_type"),
            "shipment_status": r.get("shipment_status"),
            # status = open | canceled | closed.
            # "canceled" = YÊU CẦU TRẢ ĐÃ BỊ HUỶ (khách tạo yêu cầu rồi không
            # đưa hàng cho shipper, quá hạn tự huỷ) -> HÀNG VẪN Ở CHỖ KHÁCH,
            # không bao giờ về kho. Đừng coi là "hoàn về chưa nhận".
            # Đo 30/10: 25/193 phiếu từ 20/09 ở trạng thái này.
            "status": r.get("status"),
            "created_on": day,
            "returned_on": (r.get("returned_on") or "")[:10],
            "qty": r.get("total_quantity"),
        })
    return out


def load_scans():
    """Lượt quét hàng về thật trong Sổ Kho — bằng chứng vật lý, chiều thứ 3."""
    try:
        import importlib.util
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_returns_feed.py")
        spec = importlib.util.spec_from_file_location("sf", p)
        sf = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(sf)
        rows = sf.sb_get_all(sf.SCAN_TABLE + "?select=code,scan_date,platform")
        idx = {}
        for s in rows:
            idx.setdefault(sf.norm_code(s["code"]), []).append(s)
        return idx, len(rows)
    except Exception as e:
        print("CANH BAO: khong doc duoc luot quet So Kho (%s) -> chi doi chieu 2 chieu" % e,
              file=sys.stderr)
        return {}, 0


# ─────────────────────────────────────────────────────────────────── đối chiếu
def main():
    a = argparse.ArgumentParser()
    a.add_argument("--thang", type=int, help="Tháng trong năm nay, vd 10")
    a.add_argument("--tu")
    a.add_argument("--den")
    a.add_argument("--san-dir", default=os.path.expanduser("~/doi-chieu-hoan"))
    a.add_argument("--out-dir", default=os.path.expanduser("~/doi-chieu-hoan/ket-qua"))
    a.add_argument("--sapo-only", action="store_true")
    g = a.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    today = date.today()
    if g.thang:
        d_from = date(today.year, g.thang, 1).isoformat()
        nxt = date(today.year + (g.thang == 12), (g.thang % 12) + 1, 1)
        d_to = min(nxt - timedelta(days=1), today).isoformat()
    else:
        d_to = g.den or today.isoformat()
        d_from = g.tu or (date.fromisoformat(d_to) - timedelta(days=29)).isoformat()

    w_from = (date.fromisoformat(d_from) - timedelta(days=EDGE_DAYS)).isoformat()
    w_to = (date.fromisoformat(d_to) + timedelta(days=EDGE_DAYS)).isoformat()
    print("KY DOI CHIEU: %s -> %s  (bien +/-%dd cho Sapo)" % (d_from, d_to, EDGE_DAYS))

    sapo = load_sapo(w_from, w_to)
    core = [s for s in sapo if d_from <= s["created_on"] <= d_to]
    print("SAPO : %d phieu tra trong ky" % len(core))
    os.makedirs(g.out_dir, exist_ok=True)

    if g.sapo_only:
        p = os.path.join(g.out_dir, "sapo-phieu-tra.csv")
        cols = ["platform", "sapo_return_id", "return_code", "order_code", "return_tracking",
                "outbound_tracking", "return_type", "shipment_status", "created_on",
                "returned_on", "qty"]
        with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            for r in sorted(core, key=lambda x: x["created_on"]):
                w.writerow(r)
        print("  -> %s" % p)
        return

    orders, files = load_san(g.san_dir)
    print("\nFILE SAN doc tu %s:" % g.san_dir)
    for p, plat, n, note in files:
        print("  [%-7s] %-46s %4d don  %s" % (plat, os.path.basename(p)[:46], n, note))
    if not orders:
        sys.exit("\nCHUA CO DU LIEU SAN. Xem SKILL.md de biet xuat file nao.")

    scans, nscan = load_scans()
    print("SO KHO: %d luot quet hang ve" % nscan)

    # chỉ số Sapo theo mọi mã
    idx = {}
    for s in sapo:
        for c in [s["order_code"], s["return_code"], s["return_tracking"]] + \
                 (s["outbound_tracking"] or "").split("+"):
            c = norm(c)
            if c:
                idx.setdefault(c, []).append(s)

    def sapo_cua(o):
        for c in (norm(o["ma_don"]), norm(o["tracking"])):
            if c and c in idx:
                return idx[c][0]
        return None

    def quet_cua(*codes):
        for c in codes:
            if norm(c) in scans:
                return scans[norm(c)][0]
        return None

    rows, hit = [], set()
    for o in orders.values():
        ve = da_ve_kho(o)
        s = sapo_cua(o)
        q = quet_cua(o["ma_don"], o["tracking"])
        if s:
            hit.add(s["sapo_return_id"])
        if not ve:
            nhom = "HANG CON O KHO (huy truoc khi shipper lay)"
            gc = "Sapo khong sinh phieu la DUNG. " + (o["ly_do_huy"] or "")
        elif s and q:
            nhom = "OK — san + Sapo + kho deu khop"; gc = ""
        elif s and not q:
            nhom = "HOAN VE CHUA NHAN — kho chua quet"; gc = "Kiem xem kien da ve chua"
        elif not s and q:
            nhom = "SAPO THIEU — kho da quet ma Sapo khong co phieu"; gc = "Phai tao phieu tren Sapo"
        else:
            nhom = "SAPO THIEU — san bao da ve, Sapo va kho deu khong co"; gc = "Kiem tra gap"
        rows.append({"nhom": nhom, "san": o["platform"], "ngay": o["ngay_dat"],
                     "ma_don": o["ma_don"], "ma_van_don": o["tracking"],
                     "trang_thai_san": o["trang_thai"], "tt_tra_hang": o["tt_tra_hang"],
                     "da_roi_kho": "co" if o["da_roi_kho"] else "khong",
                     "sapo": s["return_type"] if s else "", "kho_quet": q["scan_date"] if q else "",
                     "ghi_chu": gc})

    # Chỉ xét "thừa" cho sàn NÀO ĐÃ CÓ FILE. Không có file TikTok mà vẫn đem
    # phiếu TikTok ra so với file Shopee thì cả trăm phiếu sẽ bị gắn nhãn
    # "Sapo thừa" một cách vô nghĩa (gặp thật 30/10: ra 153 đơn thừa giả).
    co_file = {o["platform"] for o in orders.values()}
    for s in core:
        if s["sapo_return_id"] in hit or s["platform"] not in co_file:
            continue
        q = quet_cua(s["order_code"], s["return_tracking"], *(s["outbound_tracking"] or "").split("+"))
        if s.get("status") == "canceled" and not q:
            # yêu cầu trả đã huỷ + kho chưa quét -> hàng còn ở chỗ khách, đúng
            rows.append({"nhom": "YEU CAU TRA DA HUY — hang con o cho khach",
                         "san": s["platform"], "ngay": s["created_on"],
                         "ma_don": s["order_code"], "ma_van_don": s["return_tracking"],
                         "trang_thai_san": "", "tt_tra_hang": "", "da_roi_kho": "",
                         "sapo": s["return_type"], "kho_quet": "",
                         "ghi_chu": "Khach tao yeu cau roi khong dua hang cho shipper. Khong phai loi."})
            continue
        rows.append({"nhom": "SAPO THUA — co phieu nhung file san khong co don nay",
                     "san": s["platform"], "ngay": s["created_on"], "ma_don": s["order_code"],
                     "ma_van_don": s["return_tracking"], "trang_thai_san": "",
                     "tt_tra_hang": "", "da_roi_kho": "",
                     "sapo": s["return_type"], "kho_quet": q["scan_date"] if q else "",
                     "ghi_chu": "Kho DA quet -> hang that, san xep trang thai khac"
                     if q else "Kho chua quet -> can xuat them file san o trang thai khac"})

    import collections
    dem = collections.Counter(r["nhom"] for r in rows)
    print("\n" + "=" * 72)
    for k, v in sorted(dem.items(), key=lambda x: -x[1]):
        print("  %-58s %4d" % (k[:58], v))

    p = os.path.join(g.out_dir, "doi-chieu-hoan-%s_%s.csv" % (d_from, d_to))
    cols = ["nhom", "san", "ngay", "ma_don", "ma_van_don", "trang_thai_san",
            "tt_tra_hang", "da_roi_kho", "sapo", "kho_quet", "ghi_chu"]
    with io.open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(sorted(rows, key=lambda x: (x["nhom"], x["ngay"])))
    print("\n  -> %s" % p)

    thieu = sum(v for k, v in dem.items() if k.startswith("SAPO THIEU"))
    thua = sum(v for k, v in dem.items() if k.startswith("SAPO THUA"))
    print("\nKET LUAN: Sapo THIEU %d don, THUA %d don." % (thieu, thua))
    if thua:
        print("  Luu y: 'thua' chi dang tin khi da xuat DU moi trang thai cua san.")


if __name__ == "__main__":
    main()
