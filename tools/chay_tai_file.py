#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
ORCHESTRATOR — nối cả chuỗi tải file cho Sổ Vận Hành, chạy 0 token trên PC trực.
Task Scheduler chỉ cần gọi script này. Chốt 31/10/2026 — xem
.claude/shared/reference_tai_file_tu_dong.md.

  --lich thang : tải bộ file THÁNG trước → xếp Drive (Tháng M-YYYY) → upload + tính
                 + tự Lưu lịch sử lên Sổ Vận Hành. CHẠY 2 LẦN/KỲ (chốt 18/11/2026):
                   lần 1 = từ ngày 1 (có số tháng trước ngay, chưa chốt),
                   lần 2 = từ ngày 15 (tải lại, cập nhật các đơn đã hoàn thành,
                   GHI ĐÈ cùng nhãn kỳ). Task chạy hằng ngày, marker chống trùng.
  --lich tuan  : tải bộ file TUẦN trước → xếp Drive (Theo tuần/Tuần Www-YYYY).
                 (Tuần KHÔNG đẩy lên Sổ Vận Hành — chỉ lưu trữ Drive.)

Kỳ tự tính từ hôm nay: thang = tháng TRƯỚC; tuan = tuần ISO TRƯỚC.
Ổ Drive đồng bộ: biến môi trường SVH_DRIVE_ROOT (mặc định "G:\My Drive").

Dùng (Task Scheduler gọi):
  py tools\chay_tai_file.py --lich thang
  py tools\chay_tai_file.py --lich tuan
"""
import argparse
import datetime
import os
import subprocess
import sys

# Task Scheduler không có console → Python mặc định cp1252 sẽ chết khi in tiếng Việt.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
os.environ.setdefault('PYTHONUTF8', '1')   # các script con kế thừa

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
DRIVE_ROOT = os.environ.get('SVH_DRIVE_ROOT', r'G:\My Drive')


def ky_thang_truoc():
    today = datetime.date.today()
    dau_thang = today.replace(day=1)
    het_thang_truoc = dau_thang - datetime.timedelta(days=1)
    return '%d-%02d' % (het_thang_truoc.year, het_thang_truoc.month)


def ky_tuan_truoc():
    today = datetime.date.today()
    thu2 = today - datetime.timedelta(days=today.weekday())
    cn_truoc = thu2 - datetime.timedelta(days=1)
    iso = cn_truoc.isocalendar()
    return '%d-W%02d' % (iso[0], iso[1])


# Marker "đã hoàn tất" theo (kỳ, lần) — task chạy HẰNG NGÀY nhưng mỗi lần chỉ làm
# đúng 1 lượt; lỗi thì hôm sau tự thử lại. Để ngoài repo, không commit.
STATE_DIR = os.path.join(os.path.expanduser('~'), '.svh-tai-file-state')


def _marker(lich, ky, lan=None):
    ten = '%s-%s%s.done' % (lich, ky, ('-l%d' % lan) if lan else '')
    return os.path.join(STATE_DIR, ten)


def da_hoan_tat(lich, ky, lan=None):
    return os.path.exists(_marker(lich, ky, lan))


def danh_dau_hoan_tat(lich, ky, lan=None):
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(_marker(lich, ky, lan), 'w') as f:
        f.write(datetime.datetime.now().isoformat())


def chon_lan_thang(ky):
    """Hôm nay thuộc lần nào của kỳ `ky` (tháng trước)? Trả 1, 2 hoặc None (không có
    việc). Từ ngày 15 trở đi chỉ còn lần 2 (nếu lần 1 lỡ thì bỏ, lần 2 đã tải đủ)."""
    today = datetime.date.today()
    if today.day >= 15:
        return None if da_hoan_tat('thang', ky, 2) else 2
    return None if da_hoan_tat('thang', ky, 1) else 1


def chay(cmd):
    print('\n$ ' + ' '.join(cmd))
    return subprocess.run(cmd).returncode


def bao_telegram(msg):
    token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    chat = os.environ.get('TELEGRAM_CHAT_ID', '')
    print('[TELEGRAM] ' + msg)
    if not (token and chat):
        return
    try:
        import urllib.parse
        import urllib.request
        data = urllib.parse.urlencode({'chat_id': chat, 'text': msg}).encode()
        urllib.request.urlopen('https://api.telegram.org/bot%s/sendMessage' % token,
                               data=data, timeout=20)
    except Exception as e:
        print('  (gửi Telegram lỗi: %s)' % e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lich', choices=['thang', 'tuan'], required=True)
    ap.add_argument('--lan', type=int, choices=[1, 2],
                    help='ép chạy lần 1/2 của kỳ (test); bỏ qua marker và ngày')
    args = ap.parse_args()

    lan = None
    if args.lich == 'thang':
        ky = ky_thang_truoc()
        lan = args.lan or chon_lan_thang(ky)
        if lan is None:
            print('Kỳ %s: đã xong phần việc của hôm nay. Bỏ qua.' % ky)
            return 0
        downloads = os.path.join(os.path.expanduser('~'), 'Downloads',
                                 'svh-%s-l%d' % (ky, lan))
        # Chạy sớm có chủ đích → bộ kiểm không coi "đơn chưa hoàn thành" là lỗi,
        # và up_so_van_hanh.py chỉ cảnh báo chứ không chặn Lưu (chốt 18/11/2026).
        os.environ['SVH_CHO_PHEP_CHUA_HOAN_THANH'] = '1'
    else:
        ky = ky_tuan_truoc()
        downloads = os.path.join(os.path.expanduser('~'), 'Downloads', 'svh-tuan-' + ky)
    # thư mục sạch: không để sót file lần trước lẫn vào bộ mới
    if os.path.isdir(downloads):
        import shutil
        shutil.rmtree(downloads, ignore_errors=True)
    os.makedirs(downloads, exist_ok=True)
    print('=== Tải file Sổ Vận Hành | lịch=%s | kỳ=%s | lần=%s ===' % (args.lich, ky, lan))
    print('Thư mục tải: %s' % downloads)
    print('Ổ Drive    : %s' % DRIVE_ROOT)

    t = os.path.join(REPO, 'tools')

    rc = chay([PY, os.path.join(t, 'tai_file_san.py'),
               '--lich', args.lich, '--downloads', downloads])
    if rc != 0:
        print('⚠ Bước tải file có lỗi (xem Telegram). Dừng chuỗi, mai tự thử lại.')
        return rc

    thieu_income = False
    thu_muc_sp = ''
    if args.lich == 'thang':
        # File Income Shopee: chủ shop tự tải (Shopee đòi mật khẩu ở mục Tài Chính) → bỏ vào
        # thư mục Shopee của tháng trên Drive. Có thì lấy về bộ file (để bộ kiểm + upload
        # thấy đủ); chưa có thì vẫn xếp các file khác vào Drive, rồi dừng + báo (mai thử lại).
        import glob
        import shutil
        nam, thang = ky.split('-')
        thu_muc_sp = os.path.join(DRIVE_ROOT, 'Dashboard Vận Hành - Data',
                                  'Tháng %d-%s' % (int(thang), nam), 'Shopee')
        co = sorted(glob.glob(os.path.join(thu_muc_sp, 'Income*.xls*')))
        if co:
            shutil.copy2(co[-1], downloads)
            print('Lấy Income từ Drive: %s' % co[-1])
        else:
            thieu_income = True

    rc = chay([PY, os.path.join(t, 'xep_file_vao_drive.py'),
               '--lich', args.lich, '--ky', ky,
               '--downloads', downloads, '--drive-root', DRIVE_ROOT])
    if rc != 0 and not thieu_income:   # thiếu Income thì xep báo rc=1 là bình thường
        bao_telegram('⚠ Sổ Vận Hành %s: tải xong nhưng xếp file vào Drive lỗi (%s). '
                     'Mai tự thử lại.' % (ky, DRIVE_ROOT))
        return rc
    if thieu_income:
        bao_telegram('📥 Sổ Vận Hành %s (lần %s): máy đã tải + xếp vào Drive file TikTok và '
                     'Shopee (đơn, trả hàng). CÒN THIẾU file Income Shopee (Shopee đòi mật khẩu '
                     'nên anh tự tải). Anh tải rồi bỏ vào: %s — máy sẽ tự upload ở lượt chạy sau.'
                     % (ky, lan, thu_muc_sp))
        return 3

    if args.lich == 'thang':
        rc = chay([PY, os.path.join(t, 'up_so_van_hanh.py'),
                   '--ky', ky, '--lan', str(lan), '--downloads', downloads])
        if rc == 0:
            danh_dau_hoan_tat('thang', ky, lan)
            if lan == 2:
                danh_dau_hoan_tat('thang', ky, 1)  # lần 2 đã bao lần 1
        return rc

    print('✅ Xong lịch tuần — đã lưu trữ Drive.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
