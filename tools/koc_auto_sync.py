#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
TỰ ĐỘNG đồng bộ số liệu KOC (TikTok Affiliate) vào Supabase — CHẠY TRÊN PC TRỰC.

Theo mẫu chuẩn ".claude/shared/reference_auto_data_pull_pattern.md":
  - Dùng Playwright mở Chrome THẬT với profile ĐÃ ĐĂNG NHẬP sẵn (persistent).
  - Gọi đúng API nội bộ mà trang Phân tích dùng, bằng fetch TRONG trang (page
    tự ký X-Bogus/X-Gnarly nên không cần tái tạo chữ ký — Python thuần không
    làm được việc này).
  - Gộp theo từng KOC × từng kênh → upsert bảng koc_channel_stats.
  - CHẠY 0 TOKEN (không có Claude/LLM trong vòng lặp). Task Scheduler gọi.

================================  CÀI 1 LẦN TRÊN PC  ===========================
  py -m pip install playwright
  py -m playwright install chromium
  # Đăng nhập 1 lần vào profile của script (mở cửa sổ, tự đăng nhập TikTok):
  py tools\koc_auto_sync.py --login
  # Sau đó chạy thật (ẩn cửa sổ):
  py tools\koc_auto_sync.py
Lịch: Task Scheduler gọi `py C:\sokho\so-van-hanh-pwa\tools\koc_auto_sync.py`
      1 lần/tuần (dữ liệu kỳ 30 ngày không đổi nhiều hơn thế).

Mất đăng nhập (TikTok đăng xuất profile, vài tuần/lần) → script tự gửi Telegram
báo + thoát, KHÔNG fail âm thầm. Chủ shop chạy lại `--login` để đăng nhập lại.
===============================================================================
"""
import json
import os
import sys
import urllib.parse
import urllib.request

SHOP_ID = "7494594978743617682"
ANALYSIS_URL = ("https://affiliate.tiktok.com/insights/transaction-analysis"
                "?shop_region=VN&shop_id=" + SHOP_ID)
LOGIN_HINT = "affiliate.tiktok.com/connection"  # trang xuất hiện khi CHƯA đăng nhập

# Profile Chrome riêng của script (giữ phiên đăng nhập). Đổi nếu muốn.
PROFILE_DIR = os.environ.get("KOC_PROFILE_DIR",
                             os.path.join(os.path.expanduser("~"), "koc-chrome-profile"))

SB_URL = "https://dyvublxyrldmmnsrfvpz.supabase.co"
# anon/publishable key — đúng loại Supabase thiết kế để công khai (giống init.js)
SB_KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
          "ImR5dnVibHh5cmxkbW1uc3JmdnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzU4"
          "MzMsImV4cCI6MjEwNDExMTgzM30.jM3hD0hNMZ5osaZHDDe5PSm9rQ1Jr6IdWFF0VjT1edI")

KY_NGAY = 30  # kỳ dữ liệu — khớp dedup_key với tools/koc_channel_seed.py

# Telegram (tuỳ chọn) — để báo khi mất đăng nhập. Đặt qua biến môi trường để
# KHÔNG commit token lên repo public.
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = os.environ.get("TELEGRAM_CHAT_ID", "")


def bao_telegram(msg):
    if not (TG_TOKEN and TG_CHAT):
        print("  (bỏ qua Telegram — chưa đặt TELEGRAM_BOT_TOKEN/CHAT_ID)")
        return
    try:
        data = urllib.parse.urlencode({"chat_id": TG_CHAT, "text": msg}).encode()
        urllib.request.urlopen(
            "https://api.telegram.org/bot%s/sendMessage" % TG_TOKEN, data=data, timeout=20)
    except Exception as e:
        print("  Lỗi gửi Telegram:", e)


# JS chạy TRONG trang: lấy URL đã ký gần nhất của detail_list/get rồi phân trang.
# type: 3=video (key video_list_params_v2), 4=live (key live_list_params_v2).
JS_PULL = r"""
async ({type, key, signedUrl, bodyTemplate}) => {
  const out = [];
  let page = 1, total = null;
  while (true) {
    const body = JSON.parse(JSON.stringify(bodyTemplate));
    body.params.detail_list_type = type;
    // bỏ mọi khoá *_params* cũ, đặt đúng khoá cho loại này
    Object.keys(body.params).forEach(k => { if (k.endsWith('_params') || k.endsWith('_params_v2')) delete body.params[k]; });
    const seg = (bodyTemplate.params[Object.keys(bodyTemplate.params).find(k => k.endsWith('_params') || k.endsWith('_params_v2'))] || [{}]);
    const segCopy = JSON.parse(JSON.stringify(seg));
    segCopy[0].page_param = { page_no: page, page_size: 100 };
    body.params[key] = segCopy;
    const r = await fetch(signedUrl, { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.code !== 0) return { error: 'code ' + j.code + ' ' + (j.message||''), got: out.length };
    const segKey = Object.keys(j.data)[0];
    const s = j.data[segKey][0];
    total = s.total;
    const arrKey = Object.keys(s).find(x => Array.isArray(s[x]));
    const arr = s[arrKey] || [];
    arr.forEach(p => {
      const c = p.creator_base || {};
      if (type === 3) { const m = p.video_metrics || {};
        out.push({ koc: c.handle_name, kenh: 'video',
          gmv: +(m.video_gmv && m.video_gmv.amount || 0),
          don: +((m.video_orders_cnt && m.video_orders_cnt.value) || 0),
          view: +((m.video_views_cnt && m.video_views_cnt.value) || 0),
          hh: +(m.video_estimated_commission && m.video_estimated_commission.amount || 0) }); }
      else { const m = p.live_metrics || {};
        out.push({ koc: c.handle_name, kenh: 'live',
          gmv: +(m.live_gmv && m.live_gmv.amount || 0),
          don: +((m.live_orders_cnt && m.live_orders_cnt.value) || 0),
          view: +((m.live_distinct_unique_live_viewers_cnt && m.live_distinct_unique_live_viewers_cnt.value) || 0),
          hh: +(m.live_estimated_commission && m.live_estimated_commission.amount || 0) }); }
    });
    if (out.length >= total || !arr.length || page > 25) break;
    page++;
  }
  return { rows: out, total };
}
"""


def gop(rows):
    """Gộp theo (koc, kenh): số nội dung, gmv, đơn, view, hoa hồng."""
    agg = {}
    for r in rows:
        if not r.get("koc"):
            continue
        key = (r["koc"], r["kenh"])
        a = agg.setdefault(key, {"n": 0, "gmv": 0, "don": 0, "view": 0, "hh": 0})
        a["n"] += 1
        a["gmv"] += int(r["gmv"] or 0)
        a["don"] += int(r["don"] or 0)
        a["view"] += int(r["view"] or 0)
        a["hh"] += int(r["hh"] or 0)
    return agg


def day_den():
    import datetime
    return datetime.date.today().isoformat()


def upsert_supabase(agg):
    rows = []
    ky_den = day_den()
    for (koc, kenh), a in agg.items():
        if a["gmv"] <= 0 and a["don"] <= 0:
            continue  # bỏ kênh rỗng
        rows.append({
            "dedup_key": "%s|%s|%d" % (koc, kenh, KY_NGAY),  # overwrite mỗi lần → web luôn thấy số mới
            "koc_username": koc, "kenh": kenh,
            "ky_ngay": KY_NGAY, "ky_den": ky_den,
            "so_noi_dung": a["n"], "gmv": a["gmv"], "so_don": a["don"],
            "luot_xem": a["view"], "hoa_hong": a["hh"],
        })
    if not rows:
        print("  Không có dòng nào để ghi.")
        return 0
    body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        SB_URL + "/rest/v1/koc_channel_stats?on_conflict=dedup_key",
        data=body, method="POST",
        headers={"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY,
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"})
    with urllib.request.urlopen(req, timeout=60) as r:
        print("  koc_channel_stats: HTTP %d, ghi %d dòng" % (r.status, len(rows)))
    return len(rows)


SAMPLE_URL = ("https://affiliate.tiktok.com/affiliate/sample/sample-request"
              "?shop_region=VN&shop_id=" + SHOP_ID)
# Mã tab của API sample/group/list (đo thật 17/11/2026):
#   10 Chờ xem xét · 20 Sẵn sàng vận chuyển · 30 Đã vận chuyển
#   40 Đang tiến hành (đã nhận mẫu, chờ đăng) · 50 Đã hoàn thành · 60 Đã huỷ
SAMPLE_TABS = {20: "dang_giao", 30: "dang_giao", 40: "chua_dang"}

# Chạy TRONG trang: dùng lại URL đã ký của chính trang (đổi body theo tab).
JS_SAMPLES = r"""
async ({url, tab}) => {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(url, { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab, cur_page: page, page_size: 50,
        search_params: [{ search_key: 3, search_type: 2, value: '' }], order_params: [] }) });
    const j = await r.json();
    if (j.code !== 0) return { error: 'code ' + j.code + ' ' + (j.message || '') };
    (j.agg_info || []).forEach(a => {
      const d = a.apply_deatil || {}, i = d.apply_info || {}, c = d.creator_info || {};
      out.push({ apply_id: String(i.apply_id), koc: c.name, sku: i.sku_desc || '',
                 ts: i.create_time ? +i.create_time : null });
    });
    if (!j.has_more) break;
  }
  return { rows: out };
}
"""


def sb_request(path, method="GET", body=None, prefer=None):
    headers = {"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY,
               "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(SB_URL + "/rest/v1/" + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def keo_hang_mau(page):
    """Kéo yêu cầu hàng mẫu ĐANG MỞ -> koc_sample_requests; xoá dòng không còn."""
    import datetime
    signed = {}
    def on_req(req):
        if "sample/group/list" in req.url and req.method == "POST" and "url" not in signed:
            signed["url"] = req.url
    page.on("request", on_req)
    page.goto(SAMPLE_URL, timeout=60000)
    page.wait_for_timeout(6000)
    page.remove_listener("request", on_req)
    if "url" not in signed:
        raise RuntimeError("không bắt được request sample/group/list (có thể chưa đăng nhập hoặc TikTok đổi API)")

    bay_gio = datetime.datetime.now(datetime.timezone.utc)
    rows, seen = [], set()
    for tab, tt in SAMPLE_TABS.items():
        res = page.evaluate(JS_SAMPLES, {"url": signed["url"], "tab": tab})
        if res.get("error"):
            raise RuntimeError("tab %d: %s" % (tab, res["error"]))
        for r in res["rows"]:
            if not r["koc"] or r["apply_id"] in seen:
                continue
            seen.add(r["apply_id"])
            rows.append({
                "apply_id": r["apply_id"], "koc_username": r["koc"],
                "sku_desc": r["sku"], "trang_thai": tt,
                "ngay_tao": (datetime.datetime.fromtimestamp(r["ts"] / 1000, datetime.timezone.utc).isoformat()
                             if r["ts"] else None),
                "synced_at": bay_gio.isoformat(),
            })
    print("  hàng mẫu đang mở: %d (đang giao %d · chờ đăng %d)" % (
        len(rows), sum(1 for r in rows if r["trang_thai"] == "dang_giao"),
        sum(1 for r in rows if r["trang_thai"] == "chua_dang")))
    if rows:
        st = sb_request("koc_sample_requests?on_conflict=apply_id", "POST", rows,
                        "resolution=merge-duplicates,return=minimal")
        print("  koc_sample_requests: HTTP %d" % st)
    # Dọn dòng cũ (đã đăng / huỷ) — chỉ khi ghi xong, tránh xoá nhầm lúc kéo lỗi.
    sb_request("koc_sample_requests?synced_at=lt." + urllib.parse.quote(bay_gio.isoformat()),
               "DELETE", None, "return=minimal")


def chay(login_only=False):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE_DIR, headless=(not login_only), channel="chrome",  # Chrome cài sẵn (Chromium của Playwright bị chặn spawn trên PC này, 17/11)
            args=["--disable-blink-features=AutomationControlled"])
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        if login_only:
            page.goto("https://affiliate.tiktok.com/", timeout=60000)
            print("Cửa sổ Chrome đang mở. Hãy ĐĂNG NHẬP TikTok Affiliate bằng tay,")
            print("vào được Trung tâm liên kết thì đóng cửa sổ này. Phiên sẽ được lưu.")
            input("Đăng nhập xong, bấm Enter ở đây để thoát...")
            ctx.close()
            return

        # Bắt request đã ký của detail_list/get
        captured = {}
        def on_request(req):
            if "transaction/detail_list/get" in req.url and req.method == "POST" and not captured:
                captured["url"] = req.url
                try: captured["body"] = json.loads(req.post_data or "{}")
                except Exception: pass
        page.on("request", on_request)

        def mat_dang_nhap():
            return LOGIN_HINT in page.url or "/login" in page.url or "accounts.tiktok" in page.url

        # --- Giai đoạn 1: hàng mẫu đang mở -> mục "Cần anh xử lý" (chạy TRƯỚC vì gấp nhất)
        try:
            keo_hang_mau(page)
        except Exception as e:
            if mat_dang_nhap():
                bao_telegram("⚠️ KOC auto-sync: Chrome đã BỊ ĐĂNG XUẤT TikTok. "
                             "Chạy lại `py tools\\koc_auto_sync.py --login` để đăng nhập.")
                print("CHƯA ĐĂNG NHẬP. Đã báo Telegram. Thoát.")
                ctx.close(); sys.exit(2)
            print("  Lỗi kéo hàng mẫu:", e)
            bao_telegram("⚠️ KOC auto-sync: lỗi kéo hàng mẫu (%s). "
                         "Mục 'Cần anh xử lý' trên Sổ Vận Hành có thể đang cũ." % str(e)[:150])

        # --- Giai đoạn 2: số liệu kênh Video/LIVE (kỳ 30 ngày)
        page.goto(ANALYSIS_URL, timeout=60000)
        page.wait_for_timeout(6000)

        if mat_dang_nhap():
            bao_telegram("⚠️ KOC auto-sync: Chrome đã BỊ ĐĂNG XUẤT TikTok. "
                         "Chạy lại `py tools\\koc_auto_sync.py --login` để đăng nhập.")
            print("CHƯA ĐĂNG NHẬP. Đã báo Telegram. Thoát.")
            ctx.close(); sys.exit(2)

        # Chọn kỳ 30 ngày trong phần "Chi tiết" (nếu có), rồi kích 1 request để bắt URL ký
        try:
            page.get_by_text("7 ngày qua", exact=False).first.click(timeout=8000)
            page.get_by_text("30 ngày qua", exact=False).first.click(timeout=8000)
            page.wait_for_timeout(5000)
        except Exception as e:
            print("  (không đổi được sang 30 ngày qua UI, dùng kỳ mặc định):", e)
        # bấm tab 'Buổi LIVE' để chắc chắn có request detail_list/get
        try:
            page.get_by_role("tab", name="Buổi LIVE").click(timeout=8000)
            page.wait_for_timeout(4000)
        except Exception:
            pass

        if "url" not in captured or "body" not in captured:
            bao_telegram("⚠️ KOC auto-sync: không bắt được request đã ký của TikTok "
                         "(có thể TikTok đổi giao diện/API). Cần kiểm tra lại script.")
            print("KHÔNG bắt được request detail_list/get. Đã báo Telegram. Thoát.")
            ctx.close(); sys.exit(3)

        signed_url, body_tpl = captured["url"], captured["body"]
        all_rows = []
        for type_, key in ((3, "video_list_params_v2"), (4, "live_list_params_v2")):
            res = page.evaluate(JS_PULL, {"type": type_, "key": key,
                                          "signedUrl": signed_url, "bodyTemplate": body_tpl})
            if res.get("error"):
                print("  Lỗi kéo type %d: %s" % (type_, res["error"]))
            else:
                print("  type %d (%s): %d dòng / tổng %s" % (type_, key, len(res["rows"]), res.get("total")))
                all_rows += res["rows"]

        ctx.close()

        if not all_rows:
            bao_telegram("⚠️ KOC auto-sync: kéo được 0 dòng. Cần kiểm tra.")
            print("0 dòng. Thoát."); sys.exit(4)

        agg = gop(all_rows)
        print("  Gộp: %d (KOC×kênh)" % len(agg))
        upsert_supabase(agg)
        print("Xong.")


if __name__ == "__main__":
    chay(login_only=("--login" in sys.argv))
