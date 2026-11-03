#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
XẾP file sàn vừa tải vào đúng thư mục Google Drive (đồng bộ qua Drive for Desktop).
Chạy trên PC trực, 0 token. Chốt 31/10/2026 — xem
.claude/shared/reference_tai_file_tu_dong.md.

Việc của script:
  1. Quét thư mục Downloads (hoặc thư mục chỉ định) tìm file .xlsx/.xls.
  2. Nhận diện loại file THEO NỘI DUNG — tái dùng y hệt bộ nhận diện của
     thang-moi (.claude/skills/thang-moi/scripts/check_month_files.py) để KHÔNG
     lệch với web.
  3. Copy (giữ nguyên tên gốc) vào đúng thư mục trong ổ Drive đồng bộ:
       <DriveRoot>\Dashboard Vận Hành - Data\
            Tháng {M}-{YYYY}\{TikTok Shop|Shopee}\         (lịch = thang)
            Theo tuần\Tuần {Www}-{YYYY}\{TikTok Shop|Shopee}\  (lịch = tuan)
     Drive for Desktop tự đẩy lên cloud — KHÔNG cần API/token.

Dùng:
  py tools\xep_file_vao_drive.py --lich thang --ky 2026-10 \
       --downloads "%USERPROFILE%\Downloads\svh-2026-10" \
       --drive-root "G:\My Drive"
  py tools\xep_file_vao_drive.py --lich tuan --ky 2026-W44 ...

--ky:
  thang: "YYYY-MM"   -> "Tháng {M}-{YYYY}"  (M không zero-pad, khớp Drive đang có)
  tuan:  "YYYY-Www"  -> "Theo tuần\Tuần {ww}-{YYYY}"  (ww = số tuần ISO)
  Bỏ --ky thì tự suy từ ngày trong file đơn hàng (chỉ nên dựa vào khi chắc chắn).

Thoát mã 0 = đã xếp đủ file bắt buộc. 1 = thiếu/không nhận diện được.
"""
import argparse
import importlib.util
import json
import os
import shutil
import sys
import datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK_PY = os.path.join(REPO, '.claude', 'skills', 'thang-moi', 'scripts',
                        'check_month_files.py')
REGISTRY = os.path.join(REPO, 'tools', 'registry_tai_file.json')


def nap_bo_nhan_dien():
    """Nạp check_month_files.py như module để dùng classify()/header_and_rows()."""
    spec = importlib.util.spec_from_file_location('check_month_files', CHECK_PY)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if mod.openpyxl is None:
        print('Thiếu openpyxl — chạy: py -m pip install openpyxl')
        sys.exit(2)
    return mod


def doc_registry():
    with open(REGISTRY, encoding='utf-8') as f:
        return json.load(f)


def ten_thu_muc_ky(lich, ky, cfg):
    """Trả tên thư mục đích theo quy ước Drive đang có."""
    if lich == 'thang':
        nam, thang = ky.split('-')
        return cfg['thu_muc_thang'].format(thang=int(thang), nam=int(nam))
    else:
        nam, tuan = ky.split('-W')
        # giữ 2 chữ số cho đẹp (Tuần 05-2026) — đổi nếu muốn
        return os.path.join(cfg['thu_muc_tuan_cha'],
                            cfg['thu_muc_tuan'].format(tuan=int(tuan), nam=int(nam)))


def suy_ky_tu_file(check, path, lich):
    """Khi không truyền --ky: đoán kỳ từ ngày trong file đơn hàng."""
    try:
        role, sheet, _ = check.classify(path)
    except Exception:
        return None
    if role not in check.DATE_COLS:
        return None
    hdr, rows = check.header_and_rows(path, sheet, 1, 100000)
    if role == 'tiktokOrders':
        rows = rows[1:]
    dcol = check.DATE_COLS[role]
    if dcol not in hdr:
        return None
    di = hdr.index(dcol)
    ds = [check.parse_date(r[di]) for r in rows if len(r) > di]
    ds = [d for d in ds if d]
    if not ds:
        return None
    d = max(ds)
    if lich == 'thang':
        return f'{d.year}-{d.month:02d}'
    iso = d.isocalendar()
    return f'{iso[0]}-W{iso[1]:02d}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lich', choices=['thang', 'tuan'], required=True)
    ap.add_argument('--ky', help='thang: YYYY-MM | tuan: YYYY-Www. Bỏ trống = tự suy từ file.')
    ap.add_argument('--downloads', required=True, help='thư mục chứa file vừa tải')
    ap.add_argument('--drive-root', required=True,
                    help=r'gốc ổ Drive đồng bộ, vd "G:\My Drive"')
    ap.add_argument('--dry-run', action='store_true', help='chỉ in, không copy')
    args = ap.parse_args()

    downloads = os.path.expandvars(os.path.expanduser(args.downloads))
    drive_root = os.path.expandvars(os.path.expanduser(args.drive_root))
    if not os.path.isdir(downloads):
        print(f'Không thấy thư mục tải: {downloads}')
        return 2

    check = nap_bo_nhan_dien()
    reg = doc_registry()
    dcfg = reg['drive']
    san_folder = dcfg['thu_muc_san']

    # map role -> (san) theo registry cho đúng lịch
    role_san = {}
    bat_buoc = set()
    for e in reg['files']:
        if e['lich'] != args.lich or not e.get('role'):
            continue
        role_san[e['role']] = e['san']
        if e.get('bat_buoc'):
            bat_buoc.add(e['role'])

    files = [f for f in sorted(os.listdir(downloads))
             if f.lower().endswith(('.xlsx', '.xls')) and not f.startswith('~$')]
    if not files:
        print(f'{downloads} không có file .xlsx/.xls nào.')
        return 1

    ky = args.ky
    if not ky:
        for f in files:
            ky = suy_ky_tu_file(check, os.path.join(downloads, f), args.lich)
            if ky:
                print(f'(tự suy kỳ từ {f} → {ky})')
                break
        if not ky:
            print('Không truyền --ky và không suy được kỳ từ file. Hãy truyền --ky.')
            return 2

    thu_muc_ky = ten_thu_muc_ky(args.lich, ky, dcfg)
    print(f'Kỳ: {ky}  →  {os.path.join(dcfg["goc"], thu_muc_ky)}\n')

    da_xep = {}      # role -> file đã copy
    khong_biet = []
    for fn in files:
        path = os.path.join(downloads, fn)
        try:
            role, _, _ = check.classify(path)
        except Exception as e:
            khong_biet.append(f'{fn}: không đọc được ({e})')
            continue
        if role is None or role not in role_san:
            khong_biet.append(fn)
            continue
        san = role_san[role]
        dest_dir = os.path.join(drive_root, dcfg['goc'], thu_muc_ky, san_folder[san])
        dest = os.path.join(dest_dir, fn)
        if args.dry_run:
            print(f'  [dry] {fn}  →  {san_folder[san]}/')
        else:
            os.makedirs(dest_dir, exist_ok=True)
            shutil.copy2(path, dest)
            print(f'  ✓ {fn}  →  {san_folder[san]}/')
        da_xep[role] = fn

    thieu = [r for r in bat_buoc if r not in da_xep]
    if khong_biet:
        print('\nKhông nhận diện (bỏ qua):')
        for k in khong_biet:
            print('  · ' + k)
    if thieu:
        print('\n⚠ THIẾU file bắt buộc cho lịch "%s":' % args.lich)
        for r in thieu:
            print('  ✗ ' + r)
        return 1
    print('\nĐã xếp đủ file bắt buộc. Drive for Desktop sẽ tự đẩy lên cloud.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
