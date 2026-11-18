#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
TỰ UPLOAD bộ file THÁNG lên web Sổ Vận Hành + Tính + (nếu file sạch) Lưu lịch sử
— bằng Playwright lái chính trang so-van-hanh-pwa.vercel.app (tái dùng calc.js,
KHÔNG tính lại bằng Python để tránh lệch số). Chạy trên PC trực, 0 token.
Chốt 31/10/2026 — xem .claude/shared/reference_tai_file_tu_dong.md.

LỊCH 2 LẦN/KỲ (chủ shop chốt 18/11/2026, thay cho quy tắc cũ "chỉ chạy sau ngày 20"):
  Lần 1 (từ ngày 1)  : có số tháng trước ngay, CHƯA chốt (vẫn còn đơn chưa hoàn thành).
  Lần 2 (từ ngày 15) : tải lại, ghi đè CÙNG nhãn kỳ -> cập nhật các đơn đã hoàn thành.
  Nhãn kỳ ép cố định "01/MM/YYYY – dd/MM/YYYY" (đúng quy ước các tháng cũ) để lần 2 GHI ĐÈ
  lần 1 chứ không đẻ thêm bản ghi. Chi phí vận hành đã nhập tay được sổ tự giữ lại.

CHỐT CHẶN (vẫn còn, nhưng đổi cho hợp việc chạy sớm có chủ đích):
  1. Bộ kiểm check_month_files.py: thiếu file / sai tháng / đổi cột -> DỪNG, không upload.
     ("Đơn chưa hoàn thành" KHÔNG còn là lỗi chặn khi chạy lịch này.)
  2. Cảnh báo CHẶN (số hỏng, KHÔNG Lưu để khỏi đè mất số tốt đang có):
     THIẾU CỘT, CHƯA KHỚP.
  3. Cảnh báo MỀM (LỆCH KỲ / THẤP GIẢ TẠO / CAO hơn thật): vẫn Lưu, nhưng báo Telegram
     rõ "số chưa chốt". Sổ tự bỏ cảnh báo LỆCH KỲ khi lần sau đơn đã hoàn thành.
  4. Lưu xong đọc lại Supabase xác nhận bản ghi vừa cập nhật mới tính là thành công.

Dùng:
  py tools\up_so_van_hanh.py --ky 2026-10 --downloads "%USERPROFILE%\Downloads\svh-2026-10"
Tuỳ chọn: --lan 1|2 (chỉ để ghi vào Telegram), --url (mặc định bản vercel).
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
CANH_BAO_CHAN = ['THIẾU CỘT', 'CHƯA KHỚP']                      # số hỏng -> không Lưu
CANH_BAO_MEM = ['LỆCH KỲ', 'THẤP GIẢ TẠO', 'TẢI QUÁ SỚM',          # chưa chốt -> vẫn Lưu + báo
                'CAO hơn thật', 'cao hơn thật']


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


def nhan_ky(ky):
    """'2026-10' -> '01/10/2026 – 31/10/2026' (đúng quy ước nhãn các tháng cũ)."""
    import calendar
    nam, thang = map(int, ky.split('-'))
    cuoi = calendar.monthrange(nam, thang)[1]
    return '01/%02d/%d – %02d/%02d/%d' % (thang, nam, cuoi, thang, nam)


def doc_supabase():
    """Lấy URL + anon key công khai từ init.js (cùng nguồn với web)."""
    import re
    src = open(os.path.join(REPO, 'init.js'), encoding='utf-8').read()
    url = re.search(r"SUPABASE_URL = '([^']+)'", src).group(1)
    key = re.search(r"SUPABASE_ANON_KEY = '([^']+)'", src).group(1)
    return url, key


def xac_nhan_da_luu(label, truoc_gio):
    """Đọc lại bản ghi từ Supabase: True nếu updated_at >= truoc_gio (UTC)."""
    import json
    try:
        url, key = doc_supabase()
        q = '%s/rest/v1/monthly_reports?select=label,updated_at&label=eq.%s' % (
            url, urllib.parse.quote(label))
        req = urllib.request.Request(q, headers={'apikey': key, 'Authorization': 'Bearer ' + key})
        rows = json.load(urllib.request.urlopen(req, timeout=30))
        if not rows:
            return False
        ts = datetime.datetime.fromisoformat(rows[0]['updated_at'].replace('Z', '+00:00'))
        return ts >= truoc_gio
    except Exception as e:
        print('  (không xác nhận được qua Supabase: %s)' % e)
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ky', required=True, help='kỳ dữ liệu YYYY-MM (vd 2026-10)')
    ap.add_argument('--downloads', required=True, help='thư mục chứa bộ file tháng')
    ap.add_argument('--url', default=DEFAULT_URL)
    ap.add_argument('--lan', type=int, default=0, help='lần 1/2 của kỳ (chỉ để ghi báo cáo)')
    args = ap.parse_args()

    downloads = os.path.expandvars(os.path.expanduser(args.downloads))
    if not os.path.isdir(downloads):
        print('Không thấy thư mục: %s' % downloads)
        return 2

    # (1) bộ kiểm file
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

    label = nhan_ky(args.ky)
    truoc_gio = datetime.datetime.now(datetime.timezone.utc)
    canh_bao_dinh, canh_bao_mem = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel='chrome')
        page = browser.new_page(accept_downloads=False)

        # prompt() đặt nhãn kỳ → tự nhận nhãn gợi ý mặc định (dạng dd/mm – dd/mm,
        # đúng quy ước thang-moi). alert/confirm thì chấp nhận.
        def on_dialog(d):
            try:
                if d.type == 'prompt':
                    d.accept(label)
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
        low = results_text.lower()
        canh_bao_dinh = [c for c in CANH_BAO_CHAN if c.lower() in low]
        canh_bao_mem = sorted({c.upper() for c in CANH_BAO_MEM if c.lower() in low})

        if canh_bao_dinh:
            browser.close()
            bao_telegram('⚠ Sổ Vận Hành %s: ĐÃ TÍNH nhưng số có vấn đề (%s) — KHÔNG Lưu, '
                         'giữ nguyên số cũ trên sổ. Chủ shop mở %s xem.'
                         % (args.ky, ', '.join(canh_bao_dinh), args.url))
            return 1

        # (d) không có cảnh báo chặn → tự Lưu (ghi đè cùng nhãn kỳ)
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

    if not xac_nhan_da_luu(label, truoc_gio - datetime.timedelta(minutes=2)):
        bao_telegram('⚠ Sổ Vận Hành %s: đã bấm Lưu nhưng KHÔNG xác nhận được bản ghi "%s" '
                     'đã cập nhật trên server. Chủ shop mở %s kiểm tra.' % (args.ky, label, args.url))
        return 1

    lan_txt = {1: 'LẦN 1 (số tạm, chưa chốt)', 2: 'LẦN 2 (đã cập nhật đơn hoàn thành)'}.get(args.lan, '')
    msg = '✅ Sổ Vận Hành kỳ %s %s: đã tải file → Drive → upload → Tính → Lưu. Mở %s để xem.' % (
        label, lan_txt, args.url)
    if canh_bao_mem:
        msg += ('\nLưu ý số chưa chốt hẳn (%s): vẫn còn đơn chưa hoàn thành hoặc mã thiếu giá vốn.'
                % ', '.join(canh_bao_mem))
        if args.lan == 1:
            msg += ' Ngày 15 máy sẽ tự tải lại và cập nhật.'
    bao_telegram(msg)
    print('Xong.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
