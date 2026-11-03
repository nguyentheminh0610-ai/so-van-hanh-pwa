#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
ORCHESTRATOR — nối cả chuỗi tải file cho Sổ Vận Hành, chạy 0 token trên PC trực.
Task Scheduler chỉ cần gọi script này. Chốt 31/10/2026 — xem
.claude/shared/reference_tai_file_tu_dong.md.

  --lich thang : tải bộ file THÁNG trước → xếp Drive (Tháng M-YYYY) → upload + tính
                 + (nếu file sạch) tự Lưu lịch sử lên Sổ Vận Hành.
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


def qua_ngay_20(ky):
    """ky='YYYY-MM'. True nếu hôm nay đã qua ngày 20 THÁNG KẾ TIẾP."""
    nam, thang = map(int, ky.split('-'))
    thang_ke = thang % 12 + 1
    nam_ke = nam + (1 if thang == 12 else 0)
    return datetime.date.today() > datetime.date(nam_ke, thang_ke, 20)


# Marker "đã hoàn tất kỳ này" — để task tháng chạy HẰNG NGÀY nhưng chỉ làm đúng
# 1 lần/kỳ (sau ngày 20). Để ngoài repo, không commit.
STATE_DIR = os.path.join(os.path.expanduser('~'), '.svh-tai-file-state')


def da_hoan_tat(lich, ky):
    return os.path.exists(os.path.join(STATE_DIR, '%s-%s.done' % (lich, ky)))


def danh_dau_hoan_tat(lich, ky):
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(os.path.join(STATE_DIR, '%s-%s.done' % (lich, ky)), 'w') as f:
        f.write(datetime.datetime.now().isoformat())


def chay(cmd):
    print('\n$ ' + ' '.join(cmd))
    return subprocess.run(cmd).returncode


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lich', choices=['thang', 'tuan'], required=True)
    args = ap.parse_args()

    if args.lich == 'thang':
        ky = ky_thang_truoc()
        downloads = os.path.join(os.path.expanduser('~'), 'Downloads', 'svh-' + ky)
        # Task tháng chạy hằng ngày nhưng chỉ làm 1 lần/kỳ, sau ngày 20.
        if not qua_ngay_20(ky):
            print('Kỳ %s chưa tới hạn (phải qua ngày 20 tháng kế). Bỏ qua hôm nay.' % ky)
            return 0
        if da_hoan_tat('thang', ky):
            print('Kỳ %s đã hoàn tất trước đó. Bỏ qua.' % ky)
            return 0
    else:
        ky = ky_tuan_truoc()
        downloads = os.path.join(os.path.expanduser('~'), 'Downloads', 'svh-tuan-' + ky)
    os.makedirs(downloads, exist_ok=True)
    print('=== Tải file Sổ Vận Hành | lịch=%s | kỳ=%s ===' % (args.lich, ky))
    print('Thư mục tải: %s' % downloads)
    print('Ổ Drive    : %s' % DRIVE_ROOT)

    t = os.path.join(REPO, 'tools')

    # 1) tải file từ sàn
    rc = chay([PY, os.path.join(t, 'tai_file_san.py'),
               '--lich', args.lich, '--downloads', downloads])
    if rc != 0:
        print('\n⚠ Bước tải file có lỗi (xem Telegram). Dừng chuỗi.')
        return rc

    # 2) xếp lên Drive
    rc = chay([PY, os.path.join(t, 'xep_file_vao_drive.py'),
               '--lich', args.lich, '--ky', ky,
               '--downloads', downloads, '--drive-root', DRIVE_ROOT])
    if rc != 0:
        print('\n⚠ Bước xếp Drive có lỗi. Dừng chuỗi.')
        return rc

    # 3) chỉ THÁNG mới đẩy lên Sổ Vận Hành
    if args.lich == 'thang':
        rc = chay([PY, os.path.join(t, 'up_so_van_hanh.py'),
                   '--ky', ky, '--downloads', downloads])
        if rc == 0:
            danh_dau_hoan_tat('thang', ky)  # thành công → không chạy lại kỳ này
        return rc

    print('\n✅ Xong lịch tuần — đã lưu trữ Drive.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
