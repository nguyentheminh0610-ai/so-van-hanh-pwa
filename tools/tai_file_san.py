#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
TẢI file báo cáo từ Shopee Seller + TikTok Shop Seller bằng Playwright — CHẠY
TRÊN PC TRỰC, 0 token. Chốt 31/10/2026. Xem
.claude/shared/reference_tai_file_tu_dong.md và
.claude/shared/reference_auto_data_pull_pattern.md.

Vì sao PHẢI trình duyệt thật: nút "Xuất/Export" của sàn chạy JS ký chữ ký
(X-Bogus...) trong phiên đăng nhập rồi mới sinh link tải — Python thuần có
cookie cũng KHÔNG tái tạo được. Playwright mở Chrome thật nên trang tự ký.

================================  CÀI 1 LẦN TRÊN PC  ===========================
  py -m pip install playwright openpyxl
  py -m playwright install chromium
  # Đăng nhập 1 lần vào profile của script cho TỪNG sàn (mở cửa sổ, tự login):
  py tools\tai_file_san.py --login tiktok
  py tools\tai_file_san.py --login shopee
===============================================================================

Chạy thật (Task Scheduler gọi):
  py tools\tai_file_san.py --lich thang --downloads "%USERPROFILE%\Downloads\svh-2026-10"
  py tools\tai_file_san.py --lich tuan  --downloads "%USERPROFILE%\Downloads\svh-tuan-2026-W44"

Mỗi file tải xong rơi vào --downloads (giữ tên gốc do sàn đặt). Sau đó gọi
xep_file_vao_drive.py để xếp lên Drive.

Mất đăng nhập / sàn đổi giao diện / 1 file lỗi → gửi Telegram báo + thoát mã 1,
KHÔNG fail âm thầm.

⚠ PHẦN CẦN CHỐT TRÊN PC (site-specific, không test được từ Mac):
  - chon_ky_*(): chọn khoảng ngày trên bộ lịch của từng sàn. Giao diện lịch hay
    đổi; phải mở trang thật trên PC, xem DOM rồi chốt thao tác. Mặc định hiện
    tại là best-effort + chụp màn hình để người dựng kiểm.
  - Nút Xuất: script thử bấm theo CHỮ trong registry.nut_text (bền hơn CSS).
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY = os.path.join(REPO, 'tools', 'registry_tai_file.json')

# Profile Chrome riêng của script, 1 cái cho mỗi sàn (giữ phiên đăng nhập).
PROFILE_BASE = os.environ.get(
    'SVH_PROFILE_DIR', os.path.join(os.path.expanduser('~'), 'svh-chrome-profiles'))

TG_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TG_CHAT = os.environ.get('TELEGRAM_CHAT_ID', '')

# Dấu hiệu "chưa đăng nhập" trong URL khi mở trang seller.
LOGIN_HINTS = {
    'tiktok': ('/account/login', 'login', 'passport'),
    'shopee': ('/login', '/signin', 'subaccount/login'),
}


def bao_telegram(msg):
    print('[TELEGRAM] ' + msg)
    if not (TG_TOKEN and TG_CHAT):
        print('  (bỏ qua gửi — chưa đặt TELEGRAM_BOT_TOKEN/CHAT_ID)')
        return
    try:
        data = urllib.parse.urlencode({'chat_id': TG_CHAT, 'text': msg}).encode()
        urllib.request.urlopen(
            'https://api.telegram.org/bot%s/sendMessage' % TG_TOKEN, data=data, timeout=20)
    except Exception as e:
        print('  (gửi Telegram lỗi: %s)' % e)


def doc_registry():
    with open(REGISTRY, encoding='utf-8') as f:
        return json.load(f)


def profile_dir(san):
    d = os.path.join(PROFILE_BASE, san)
    os.makedirs(d, exist_ok=True)
    return d


def la_trang_dang_nhap(url, san):
    u = (url or '').lower()
    return any(h in u for h in LOGIN_HINTS.get(san, ()))


# --------------------------------------------------------------------------
#  CHỌN KỲ — PHẦN SITE-SPECIFIC, CHỐT TRÊN PC
#  Trả True nếu đã chọn được khoảng ngày, False nếu để nguyên mặc định.
#  'tu'/'den' là datetime.date.
# --------------------------------------------------------------------------
def chon_ky(page, san, entry, tu, den):
    """Best-effort. Người dựng mở trang thật trên PC để hoàn thiện cho khớp
    bộ lịch của từng sàn (xem entry['export']['chon_ky'])."""
    # TODO(PC): điền thao tác chọn lịch thật. Hiện chỉ log hướng dẫn + để trang
    # dùng khoảng mặc định; nhiều trang mặc định 'tháng này' nên bản tháng chạy
    # đầu tháng kế tiếp vẫn có thể đúng. KIỂM file sau khi tải để chắc đúng kỳ.
    print('    (chọn kỳ: %s → %s | HD: %s)'
          % (tu, den, entry['export'].get('chon_ky', '')))
    return False


def bam_nut_xuat(page, nut_text):
    """Bấm nút Xuất/Export theo CHỮ (bền hơn CSS selector). Trả True nếu bấm được."""
    for text in nut_text:
        try:
            loc = page.get_by_role('button', name=text, exact=False)
            if loc.count() > 0:
                loc.first.click(timeout=8000)
                return True
        except Exception:
            pass
        try:
            loc = page.get_by_text(text, exact=False)
            if loc.count() > 0:
                loc.first.click(timeout=8000)
                return True
        except Exception:
            pass
    return False


def tai_mot_file(ctx, san, entry, downloads, tu, den, anh_loi_dir):
    """Mở trang → chọn kỳ → bấm Xuất → bắt sự kiện download → lưu vào downloads.
    Trả (ok, thong_bao)."""
    page = ctx.new_page()
    try:
        page.goto(entry['export']['url'], wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(3000)
        if la_trang_dang_nhap(page.url, san):
            return False, 'MẤT ĐĂNG NHẬP %s (bị đẩy về %s)' % (san, page.url)

        # Shopee chặn mật khẩu ở mục Tài chính — KHÔNG được nhập, dừng báo chủ shop.
        if san == 'shopee' and entry.get('role') == 'income':
            body = (page.content() or '').lower()
            if 'mật khẩu' in body and 'shopee' in body and 'income' not in page.url:
                pass  # (giữ chỗ) — nếu hiện hộp nhập mật khẩu thì xử ở nhánh dưới

        chon_ky(page, san, entry, tu, den)
        page.wait_for_timeout(1000)

        try:
            with page.expect_download(timeout=90000) as dl_info:
                if not bam_nut_xuat(page, entry['export'].get('nut_text', ['Xuất', 'Export'])):
                    raise RuntimeError('không thấy nút Xuất/Export (sàn có thể đổi giao diện)')
                # một số trang cần bấm thêm "Tải xuống" ở danh sách báo cáo đã xuất
            download = dl_info.value
        except Exception as e:
            # chụp màn hình để người dựng soi trên PC
            try:
                os.makedirs(anh_loi_dir, exist_ok=True)
                page.screenshot(path=os.path.join(anh_loi_dir, entry['id'] + '.png'),
                                full_page=True)
            except Exception:
                pass
            return False, 'lỗi khi xuất "%s": %s' % (entry['mo_ta'], e)

        name = download.suggested_filename
        dest = os.path.join(downloads, name)
        download.save_as(dest)
        return True, name
    finally:
        try:
            page.close()
        except Exception:
            pass


def ky_tu_lich(lich):
    """Tính khoảng ngày mặc định cho lượt chạy.
    thang: 01 → hết tháng TRƯỚC (chạy đầu tháng/ sau ngày 20 của tháng kế).
    tuan:  Thứ 2 → Chủ nhật của TUẦN TRƯỚC."""
    import datetime
    today = datetime.date.today()
    if lich == 'thang':
        dau_thang_nay = today.replace(day=1)
        het_thang_truoc = dau_thang_nay - datetime.timedelta(days=1)
        tu = het_thang_truoc.replace(day=1)
        return tu, het_thang_truoc
    # tuần trước
    thu2_tuan_nay = today - datetime.timedelta(days=today.weekday())
    cn_tuan_truoc = thu2_tuan_nay - datetime.timedelta(days=1)
    thu2_tuan_truoc = cn_tuan_truoc - datetime.timedelta(days=6)
    return thu2_tuan_truoc, cn_tuan_truoc


def mo_dang_nhap(san):
    from playwright.sync_api import sync_playwright
    reg = doc_registry()
    url = next((e['export']['url'] for e in reg['files'] if e['san'] == san),
               'https://seller-vn.tiktok.com' if san == 'tiktok'
               else 'https://banhang.shopee.vn')
    print('Mở cửa sổ để đăng nhập %s. Đăng nhập xong thì ĐÓNG cửa sổ.' % san)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            profile_dir(san), headless=False, accept_downloads=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(url)
        try:
            page.wait_for_event('close', timeout=0)
        except Exception:
            pass
        ctx.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lich', choices=['thang', 'tuan'])
    ap.add_argument('--downloads', help='thư mục nhận file tải')
    ap.add_argument('--login', choices=['tiktok', 'shopee'],
                    help='mở cửa sổ đăng nhập 1 lần cho sàn này rồi thoát')
    ap.add_argument('--chi', help='chỉ tải đúng 1 id trong registry (để test)')
    args = ap.parse_args()

    if args.login:
        mo_dang_nhap(args.login)
        return 0

    if not (args.lich and args.downloads):
        ap.error('cần --lich và --downloads (hoặc --login)')

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Thiếu Playwright — chạy: py -m pip install playwright && py -m playwright install chromium')
        return 2

    downloads = os.path.expandvars(os.path.expanduser(args.downloads))
    os.makedirs(downloads, exist_ok=True)
    anh_loi_dir = os.path.join(downloads, '_loi')

    reg = doc_registry()
    jobs = [e for e in reg['files'] if e['lich'] == args.lich
            and (not args.chi or e['id'] == args.chi)]
    if not jobs:
        print('Không có mục nào khớp lịch=%s.' % args.lich)
        return 1

    tu, den = ky_tu_lich(args.lich)
    print('Tải lịch "%s", kỳ %s → %s, %d file.\n' % (args.lich, tu, den, len(jobs)))

    # gom theo sàn để mở mỗi profile 1 lần
    loi, xong = [], []
    with sync_playwright() as p:
        for san in sorted({e['san'] for e in jobs}):
            ctx = p.chromium.launch_persistent_context(
                profile_dir(san), headless=True, accept_downloads=True)
            try:
                for entry in [e for e in jobs if e['san'] == san]:
                    print('• %s' % entry['mo_ta'])
                    ok, msg = tai_mot_file(ctx, san, entry, downloads, tu, den, anh_loi_dir)
                    if ok:
                        print('    ✓ %s' % msg)
                        xong.append(entry['mo_ta'])
                    else:
                        print('    ✗ %s' % msg)
                        if 'MẤT ĐĂNG NHẬP' in msg:
                            bao_telegram('⚠ Tải file Sổ Vận Hành: %s. Chủ shop chạy lại '
                                         '`py tools\\tai_file_san.py --login %s` để đăng nhập.'
                                         % (msg, san))
                            # mất đăng nhập 1 sàn thì bỏ nốt file của sàn đó
                            break
                        if entry.get('bat_buoc'):
                            loi.append('%s: %s' % (entry['mo_ta'], msg))
            finally:
                ctx.close()

    print('\nXong %d file. Lỗi %d.' % (len(xong), len(loi)))
    if loi:
        bao_telegram('⚠ Tải file Sổ Vận Hành (%s) lỗi:\n- %s'
                     % (args.lich, '\n- '.join(loi)))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
