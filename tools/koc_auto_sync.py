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
      2 ngày/lần lúc 09:00; thêm task dò lệnh nút "Cập nhật ngay" mỗi phút
      (`--theo-yeu-cau`, xem theo_yeu_cau() cuối file). Cài: scripts\setup-koc-sync-task.ps1

Mất đăng nhập (TikTok đăng xuất profile, vài tuần/lần) → script tự gửi Telegram
báo + thoát, KHÔNG fail âm thầm. Chủ shop chạy lại `--login` để đăng nhập lại.
===============================================================================
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

# In tiếng Việt không được làm sập script: khi stdout không phải console UTF-8
# (chạy qua pipe / Task Scheduler, mặc định cp1252) print() ném UnicodeEncodeError
# ngay dòng đầu -> cả lượt đồng bộ chết (gặp thật 23/11/2026).
for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass   # pythonw: stdout là None

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

# Các kỳ dữ liệu kéo MỖI lượt: (số ngày, mã time_option_type của TikTok).
# Chốt 23/11/2026: chủ shop cần xem cả kỳ 7 ngày lẫn 30 ngày trên tab Chấm điểm KOC
# (nút chọn kỳ ở góc trên) -> mỗi lượt kéo cả 2, ghi riêng theo ky_ngay.
# dedup_key = koc|kenh|ky_ngay nên 2 kỳ không đè nhau (khớp tools/koc_channel_seed.py).
# Mã: 6 = "7 ngày qua" (TikTok từ chối nếu khoảng không khớp), 8 = nhận khoảng 30 ngày.
CAC_KY = ((7, 6), (30, 8))
# KỲ LIỀN TRƯỚC (chốt 23/11/2026): chủ shop muốn so "7 ngày này với 7 ngày trước đó",
# 30 ngày tương tự. Mỗi kỳ kéo thêm 1 lần với khoảng thời gian lùi đúng ky_ngay ngày,
# ghi vào cùng bảng với dedup_key đuôi "|truoc" và ky_den = hôm nay − ky_ngay.
# Kỳ trước kéo lỗi thì CHỈ bỏ phần so sánh (web tự ẩn), số kỳ hiện tại vẫn ghi.
OPT_KY_TRUOC = 8   # mã time_option_type nhận khoảng ngày tuỳ ý

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
#
# Sửa 23/11/2026 — 2 lỗi làm số trên Sổ Vận Hành SAI từ lượt 17/11:
#  1. KỲ: script cũ bấm "30 ngày qua" trên giao diện rồi dùng lại request ĐẦU TIÊN
#     (lúc trang vừa mở = kỳ 7 ngày) -> số là 7 ngày nhưng dán nhãn "30 ngày".
#     Giờ tự đặt time_descriptor = `kyNgay` ngày ngay trong body, không phụ thuộc
#     giao diện. time_option_type: 6 = 7 ngày (TikTok từ chối nếu khoảng không
#     khớp); 8 nhận khoảng 30 ngày (đo thật 23/11: 293 buổi LIVE/7 ngày, 875/30 ngày).
#  2. GMV = 0: body mẫu cũ lấy từ tab "Nhà sáng tạo", danh sách metric_types của
#     tab đó không có GMV khi áp cho tab Video/LIVE. Giờ mỗi loại dùng body mẫu
#     của CHÍNH tab đó (Python bấm từng tab để bắt). Vẫn phòng hờ: thiếu trường
#     GMV thì tính GMV = giá trị đơn trung bình × số đơn.
JS_PULL = r"""
async ({type, key, signedUrl, bodyTemplate, kyNgay, optType, lui}) => {
  const out = [];
  const num = (o, f) => +((o && o[f]) || 0);
  let page = 1, total = null;
  while (true) {
    const body = JSON.parse(JSON.stringify(bodyTemplate));
    body.params.detail_list_type = type;
    // bỏ mọi khoá *_params* cũ, đặt đúng khoá cho loại này
    Object.keys(body.params).forEach(k => { if (k.endsWith('_params') || k.endsWith('_params_v2')) delete body.params[k]; });
    const seg = (bodyTemplate.params[Object.keys(bodyTemplate.params).find(k => k.endsWith('_params') || k.endsWith('_params_v2'))] || [{}]);
    const segCopy = JSON.parse(JSON.stringify(seg));
    segCopy[0].page_param = { page_no: page, page_size: 100 };
    const td = segCopy[0].time_descriptor;
    if (td && td.end_time) {
      td.end_time = td.end_time - (lui || 0) * 86400;   // lui > 0: kéo kỳ liền trước
      td.start_time = td.end_time - kyNgay * 86400;
      td.time_option_type = optType;
      const pp = segCopy[0].previous_period_time_descriptor;
      if (pp) { pp.end_time = td.start_time; pp.start_time = td.start_time - kyNgay * 86400; pp.time_option_type = optType; }
    }
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
        const don = num(m.video_orders_cnt, 'value');
        out.push({ koc: c.handle_name, kenh: 'video',
          gmv: m.video_gmv ? num(m.video_gmv, 'amount') : Math.round(num(m.video_average_order_value, 'amount') * don),
          don, view: num(m.video_views_cnt, 'value'),
          hh: num(m.video_estimated_commission, 'amount') }); }
      else { const m = p.live_metrics || {};
        const don = num(m.live_orders_cnt, 'value');
        // người xem: trường cũ nếu còn; không thì ước bằng lượt hiển thị × tỉ lệ vào phòng
        const view = m.live_distinct_unique_live_viewers_cnt ? num(m.live_distinct_unique_live_viewers_cnt, 'value')
          : m.live_views_cnt ? num(m.live_views_cnt, 'value')
          : Math.round(num(m.live_impressions_cnt, 'value') * num(m.live_enter_room_rate, 'value'));
        out.push({ koc: c.handle_name, kenh: 'live',
          gmv: m.live_gmv ? num(m.live_gmv, 'amount') : Math.round(num(m.live_average_order_value, 'amount') * don),
          don, view, hh: num(m.live_estimated_commission, 'amount') }); }
    });
    if (out.length >= total || !arr.length || page > 200) break;
    page++;
  }
  const td0 = (bodyTemplate.params[Object.keys(bodyTemplate.params).find(k => k.endsWith('_params') || k.endsWith('_params_v2'))] || [{}])[0].time_descriptor || {};
  return { rows: out, total, endTime: td0.end_time || null };
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


def upsert_supabase(agg, ky_ngay, truoc=False):
    rows = []
    import datetime
    ky_den = day_den()
    if truoc:
        ky_den = (datetime.date.today() - datetime.timedelta(days=ky_ngay)).isoformat()
    bay_gio = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for (koc, kenh), a in agg.items():
        if a["gmv"] <= 0 and a["don"] <= 0:
            continue  # bỏ kênh rỗng
        rows.append({
            "dedup_key": "%s|%s|%d%s" % (koc, kenh, ky_ngay, "|truoc" if truoc else ""),  # overwrite mỗi lần → web luôn thấy số mới
            "koc_username": koc, "kenh": kenh,
            "ky_ngay": ky_ngay, "ky_den": ky_den,
            "so_noi_dung": a["n"], "gmv": a["gmv"], "so_don": a["don"],
            "luot_xem": a["view"], "hoa_hong": a["hh"],
            "synced_at": bay_gio,  # ghi rõ, vì default now() chỉ áp cho dòng MỚI -> web hiện sai giờ "Cập nhật"
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
        print("  koc_channel_stats kỳ %d ngày%s: HTTP %d, ghi %d dòng" % (ky_ngay, " (kỳ trước)" if truoc else "", r.status, len(rows)))
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

        # Bắt request đã ký của detail_list/get — giữ body mẫu RIÊNG cho từng loại
        # danh sách (detail_list_type: 1 nhà sáng tạo · 3 video · 4 LIVE), vì mỗi
        # tab có danh sách metric_types khác nhau (xem chú thích ở JS_PULL).
        captured = {"by_type": {}}
        def on_request(req):
            if "transaction/detail_list/get" in req.url and req.method == "POST":
                try:
                    body = json.loads(req.post_data or "{}")
                except Exception:
                    return
                captured["url"] = req.url
                captured["by_type"][(body.get("params") or {}).get("detail_list_type")] = body
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

        # --- Giai đoạn 2: số liệu kênh Video/LIVE (mỗi kỳ trong CAC_KY)
        page.goto(ANALYSIS_URL, timeout=60000)
        page.wait_for_timeout(6000)

        if mat_dang_nhap():
            bao_telegram("⚠️ KOC auto-sync: Chrome đã BỊ ĐĂNG XUẤT TikTok. "
                         "Chạy lại `py tools\\koc_auto_sync.py --login` để đăng nhập.")
            print("CHƯA ĐĂNG NHẬP. Đã báo Telegram. Thoát.")
            ctx.close(); sys.exit(2)

        # Bấm lần lượt tab Video và tab Buổi LIVE của phần "Chi tiết" để trang tự gửi
        # request của từng tab -> bắt được body mẫu đúng metric cho từng loại.
        for ten_tab in ("Video", "Buổi LIVE"):
            try:
                page.get_by_role("tab", name=ten_tab, exact=True).click(timeout=8000)
                page.wait_for_timeout(4000)
            except Exception as e:
                print("  (không bấm được tab %s): %s" % (ten_tab, str(e)[:80]))

        by_type = captured["by_type"]
        if "url" not in captured or not by_type:
            bao_telegram("⚠️ KOC auto-sync: không bắt được request đã ký của TikTok "
                         "(có thể TikTok đổi giao diện/API). Cần kiểm tra lại script.")
            print("KHÔNG bắt được request detail_list/get. Đã báo Telegram. Thoát.")
            ctx.close(); sys.exit(3)

        signed_url = captured["url"]
        # Kéo HẾT các kỳ trước, kỳ nào lỗi thì thoát mà KHÔNG ghi gì -> không bao giờ
        # có cảnh kỳ 7 ngày mới mà kỳ 30 ngày cũ (hay ngược lại) trên web.
        theo_ky, ky_truoc = {}, {}
        for ky_ngay, opt_type in CAC_KY:
            print("  --- kỳ %d ngày" % ky_ngay)
            all_rows = []
            for type_, key in ((3, "video_list_params_v2"), (4, "live_list_params_v2")):
                body_tpl = by_type.get(type_)
                if body_tpl is None:
                    print("  (không có body mẫu riêng cho type %d, mượn body tab khác — GMV sẽ tự tính từ AOV × đơn)" % type_)
                    body_tpl = next(iter(by_type.values()))
                res = page.evaluate(JS_PULL, {"type": type_, "key": key, "signedUrl": signed_url,
                                              "bodyTemplate": body_tpl, "kyNgay": ky_ngay,
                                              "optType": opt_type})
                if res.get("error"):
                    print("  Lỗi kéo type %d: %s" % (type_, res["error"]))
                    bao_telegram("⚠️ KOC auto-sync: TikTok từ chối khi kéo %s kỳ %d ngày (%s). KHÔNG ghi gì, "
                                 "số trên Sổ Vận Hành giữ nguyên bản cũ." % (key, ky_ngay, res["error"][:120]))
                    ctx.close(); sys.exit(3)
                rows = res["rows"]
                print("  type %d (%s): %d dòng / tổng %s · GMV %s · đơn %s" % (
                    type_, key, len(rows), res.get("total"),
                    "{:,}".format(sum(int(r["gmv"] or 0) for r in rows)),
                    "{:,}".format(sum(int(r["don"] or 0) for r in rows))))
                # Chốt chặn: có đơn mà GMV = 0 nghĩa là TikTok lại đổi tên trường -> KHÔNG ghi
                # số 0 đè lên số cũ (lỗi này từng nằm im từ 17/11 đến 23/11 không ai biết).
                if sum(r["don"] for r in rows) > 0 and sum(r["gmv"] for r in rows) <= 0:
                    bao_telegram("⚠️ KOC auto-sync: %s kỳ %d ngày có đơn nhưng GMV = 0 (TikTok đổi tên "
                                 "trường?). KHÔNG ghi, cần kiểm tra script." % (key, ky_ngay))
                    print("GMV = 0 dù có đơn. Đã báo Telegram. Thoát."); ctx.close(); sys.exit(5)
                all_rows += rows
            theo_ky[ky_ngay] = all_rows

            # Kỳ liền trước — chỉ để so sánh, lỗi thì bỏ qua (không chặn số kỳ hiện tại)
            rows_truoc = []
            for type_, key in ((3, "video_list_params_v2"), (4, "live_list_params_v2")):
                body_tpl = by_type.get(type_) or next(iter(by_type.values()))
                res = page.evaluate(JS_PULL, {"type": type_, "key": key, "signedUrl": signed_url,
                                              "bodyTemplate": body_tpl, "kyNgay": ky_ngay,
                                              "optType": OPT_KY_TRUOC, "lui": ky_ngay})
                if res.get("error"):
                    print("  (kỳ trước %d ngày, type %d lỗi: %s — bỏ phần so sánh)" % (ky_ngay, type_, res["error"]))
                    rows_truoc = None
                    break
                print("  kỳ TRƯỚC type %d: %d dòng · GMV %s" % (
                    type_, len(res["rows"]), "{:,}".format(sum(int(r["gmv"] or 0) for r in res["rows"]))))
                rows_truoc += res["rows"]
            ky_truoc[ky_ngay] = rows_truoc

        ctx.close()

        if not any(theo_ky.values()):
            bao_telegram("⚠️ KOC auto-sync: kéo được 0 dòng. Cần kiểm tra.")
            print("0 dòng. Thoát."); sys.exit(4)

        for ky_ngay, all_rows in theo_ky.items():
            agg = gop(all_rows)
            print("  Kỳ %d ngày — gộp: %d (KOC×kênh)" % (ky_ngay, len(agg)))
            upsert_supabase(agg, ky_ngay)
            if ky_truoc.get(ky_ngay):
                upsert_supabase(gop(ky_truoc[ky_ngay]), ky_ngay, truoc=True)
        print("Xong.")


def theo_yeu_cau():
    """Nút "Cập nhật ngay" trên Sổ Vận Hành (chốt 23/11/2026).

    Web không tự vào TikTok được nên nút chỉ ghi 1 dòng status='pending' vào bảng
    koc_sync_requests (scripts/koc-sync-requests.sql). Task `Claude - KOC cap nhat
    ngay` gọi hàm này MỖI PHÚT: không có lệnh thì thoát ngay (1 request nhẹ, chưa
    mở Chrome); có lệnh thì chạy đồng bộ như thường rồi ghi done/error để web biết.
    """
    import datetime

    def goi(path, method="GET", body=None):
        headers = {"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY,
                   "Content-Type": "application/json", "Prefer": "return=minimal"}
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        req = urllib.request.Request(SB_URL + "/rest/v1/" + path, data=data, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode("utf-8")
            return json.loads(txt) if txt else None

    try:
        cho = goi("koc_sync_requests?select=id,requested_at&status=eq.pending&order=id.asc")
    except urllib.error.HTTPError as e:
        if e.code == 404:   # bảng chưa tạo trên Supabase -> coi như không có lệnh
            return
        raise
    if not cho:
        return
    ids = ",".join(str(r["id"]) for r in cho)
    loc = "koc_sync_requests?id=in.(%s)" % ids

    def bay_gio():
        return datetime.datetime.now(datetime.timezone.utc).isoformat()

    goi(loc, "PATCH", {"status": "running"})
    try:
        chay()
        goi(loc, "PATCH", {"status": "done", "finished_at": bay_gio()})
    except SystemExit as e:   # chay() thoát bằng sys.exit khi mất đăng nhập / TikTok đổi API
        ly_do = {2: "Chrome trên PC đã bị đăng xuất TikTok — cần đăng nhập lại (scripts\\dang-nhap-koc.bat)",
                 3: "Không bắt được / bị TikTok từ chối request (có thể TikTok đổi giao diện)",
                 4: "TikTok trả về 0 dòng",
                 5: "TikTok trả GMV = 0 dù có đơn — không ghi, cần kiểm tra script"}.get(e.code, "Lỗi mã %s" % e.code)
        goi(loc, "PATCH", {"status": "error", "finished_at": bay_gio(), "note": ly_do})
        raise
    except Exception as e:
        goi(loc, "PATCH", {"status": "error", "finished_at": bay_gio(), "note": str(e)[:300]})
        raise


if __name__ == "__main__":
    if "--theo-yeu-cau" in sys.argv:
        theo_yeu_cau()
    else:
        chay(login_only=("--login" in sys.argv))
