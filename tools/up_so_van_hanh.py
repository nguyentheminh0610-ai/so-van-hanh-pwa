#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
TỰ UPLOAD bộ file THÁNG lên web Sổ Vận Hành + Tính + (nếu file sạch) Lưu lịch sử
— bằng Playwright lái chính trang so-van-hanh-pwa.vercel.app (tái dùng calc.js,
KHÔNG tính lại bằng Python để tránh lệch số). Chạy trên PC trực, 0 token.
Chốt 31/10/2026 — xem .claude/shared/reference_tai_file_tu_dong.md.

CHỐT CHẶN AN TOÀN (chủ shop chọn phương án B — tự Lưu nếu file sạch, 31/10):
  1. Chỉ chạy sau NGÀY 20 của tháng kế tiếp (lệch kỳ làm lãi tụt giả tạo — đã
     đo thật tháng 8/2026). Chưa tới thì DỪNG + Telegram, KHÔNG upload.
  2. Chạy check_month_files.py trước: thiếu file / tải quá sớm / đổi cột → DỪNG.
  3. Sau khi Tính, QUÉT khối cảnh báo của sổ. Dính bất kỳ cảnh báo chặn nào
     (LỆCH KỲ, THIẾU CỘT, CHƯA KHỚP, CAO hơn thật...) → KHÔNG Lưu, Telegram báo
     để chủ shop tự xem. Sạch hết mới tự bấm "Lưu vào lịch sử".

Dùng:
  py tools\up_so_van_hanh.py --ky 2026-10 --downloads "%USERPROFILE%\Downloads\svh-2026-10"
Tuỳ chọn: --url (mặc định bản vercel), --bo-qua-ngay20 (chỉ khi test).
"""
import argparse
import datetime
import glob
import os
import subprocess
import sys
import urllib.parse
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK_PY = os.path.join(REPO, '.claude', 'skills', 'thang-moi', 'scripts',
                        'check_month_files.py')
DEFAULT_URL = 'https://so-van-hanh-pwa.vercel.app'

TG_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TG_CHAT = os.environ.get('TELEGRAM_CHAT_ID', '')

# Chữ trong khối kết quả cho thấy số CHƯA đáng tin → KHÔNG được tự Lưu.
CANH_BAO_CHAN = [
    'LỆCH KỲ', 'THẤP GIẢ TẠO', 'TẢI QUÁ SỚM',
    'THIẾU CỘT', 'CHƯA KHỚP', 'CAO hơn thật', 'cao hơn thật',
]


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


def qua_ngay_20_chua(ky):
    """ky='YYYY-MM' (kỳ dữ liệu). True nếu hôm nay đã qua ngày 20 THÁNG KẾ TIẾP."""
    nam, thang = map(int, ky.split('-'))
    thang_ke = thang % 12 + 1
    nam_ke = nam + (1 if thang == 12 else 0)
    moc = datetime.date(nam_ke, thang_ke, 20)
    return datetime.date.today() > moc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ky', required=True, help='kỳ dữ liệu YYYY-MM (vd 2026-10)')
    ap.add_argument('--downloads', required=True, help='thư mục chứa bộ file tháng')
    ap.add_argument('--url', default=DEFAULT_URL)
    ap.add_argument('--bo-qua-ngay20', action='store_true', help='CHỈ để test')
    args = ap.parse_args()

    downloads = os.path.expandvars(os.path.expanduser(args.downloads))
    if not os.path.isdir(downloads):
        print('Không thấy thư mục: %s' % downloads)
        return 2

    # (1) chốt chặn ngày 20
    if not args.bo_qua_ngay20 and not qua_ngay_20_chua(args.ky):
        msg = ('⏳ Bộ file tháng %s CHƯA tới hạn chốt (phải qua ngày 20 tháng kế). '
               'KHÔNG upload — tránh lãi tụt giả tạo. Sẽ tự chạy lại sau.' % args.ky)
        print(msg)
        return 0  # không coi là lỗi

    # (2) bộ kiểm file
    print('Kiểm bộ file trước khi upload…')
    r = subprocess.run([sys.executable, CHECK_PY, downloads])
    if r.returncode != 0:
        bao_telegram('⚠ Bộ file tháng %s KHÔNG hợp lệ (thiếu file / tải quá sớm / '
                     'đổi cột). KHÔNG upload lên Sổ Vận Hành — chủ shop xem log.' % args.ky)
        return 1

    files = [f for f in sorted(glob.glob(os.path.join(downloads, '*')))
             if f.lower().endswith(('.xlsx', '.xls')) and not os.path.basename(f).startswith('~$')]
    if not files:
        print('Không có file .xlsx/.xls.')
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Thiếu Playwright — py -m pip install playwright && py -m playwright install chromium')
        return 2

    canh_bao_dinh = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(accept_downloads=False)

        # prompt() đặt nhãn kỳ → tự nhận nhãn gợi ý mặc định (dạng dd/mm – dd/mm,
        # đúng quy ước thang-moi). alert/confirm thì chấp nhận.
        def on_dialog(d):
            try:
                if d.type == 'prompt':
                    d.accept(d.default_value or '')
                else:
                    d.accept()
            except Exception:
                pass
        page.on('dialog', on_dialog)

        page.goto(args.url, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_selector('#up-multi-input', state='attached', timeout=60000)

        # (a) nạp file vào input → trang tự nhận diện
        page.set_input_files('#up-multi-input', files)
        # chờ nhận diện xong: nút Tính toán bật
        page.wait_for_function(
            "() => { const b=document.getElementById('btn-compute'); return b && !b.disabled; }",
            timeout=60000)

        # (b) Tính toán
        page.click('#btn-compute')
        # chờ tính xong: nút Lưu bật
        page.wait_for_function(
            "() => { const b=document.getElementById('btn-save-history'); return b && !b.disabled; }",
            timeout=120000)
        page.wait_for_timeout(1500)

        # (c) quét cảnh báo trong khối kết quả
        results_text = ''
        try:
            results_text = page.inner_text('#results')
        except Exception:
            results_text = page.inner_text('body')
        canh_bao_dinh = [c for c in CANH_BAO_CHAN if c.lower() in results_text.lower()]

        if canh_bao_dinh:
            browser.close()
            bao_telegram('⚠ Sổ Vận Hành tháng %s: ĐÃ TÍNH nhưng có cảnh báo (%s) — '
                         'KHÔNG tự Lưu. Chủ shop mở %s xem rồi tự bấm "Lưu vào lịch sử" '
                         'nếu ổn.' % (args.ky, ', '.join(canh_bao_dinh), args.url))
            return 1

        # (d) sạch → tự Lưu
        page.click('#btn-save-history')
        # chờ lưu xong (history-note báo "Đã lưu")
        try:
            page.wait_for_function(
                "() => { const n=document.getElementById('history-note'); "
                "return n && /đã lưu|Đã lưu/.test(n.textContent); }",
                timeout=60000)
        except Exception:
            page.wait_for_timeout(5000)
        browser.close()

    bao_telegram('✅ Sổ Vận Hành tháng %s: đã tải + lưu Drive + upload + TÍNH + '
                 'LƯU lịch sử tự động (file sạch, không cảnh báo).' % args.ky)
    print('Xong.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
