#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cảnh báo ĐƠN TRỄ cho Sổ Kho — chốt 25/11/2026 (chủ shop: kho không kiểm đơn chưa giao đi,
đơn Shopee 261121SXM569D4 đặt 20/11 mà 24/11 vẫn chưa đi).

Chạy 20:00 hằng ngày trên PC (scripts/run-don-chua-lay.ps1), script thuần, không tốn token.

Phạm vi (chủ shop chốt): chỉ đơn ĐÃ CÓ MÃ VẬN ĐƠN mà hãng CHƯA lấy lúc 20:00 — tức TikTok "Chờ lấy
hàng" / Shopee "Đã xử lý" (Sapo: có phiếu giao, `issued_on` rỗng). Đơn "Chưa xử lý" KHÔNG tính.
Chỉ xét đơn tạo trước 16:00 hôm nay (đơn sau 16:00 hạn là hôm sau), lùi 10 ngày.

Đối chiếu mã vận đơn với "Tích đơn đi" (warehouse_outbound_checks), chia 2 nhóm:
- CHƯA tích -> "Đã in phiếu, chưa đóng": phiếu còn trong kho. Sổ Kho tự bỏ khỏi cảnh báo NGAY khi
  bạn kho tích đơn đi (app tự so, không chờ job).
- ĐÃ tích mà hãng chưa lấy -> "Đã đóng, hãng chưa lấy": kiện bị bỏ sót trong kho. Giữ tới lần quét
  20:00 sau, hãng lấy rồi thì tự mất.

Ghi vào warehouse_late_orders (ghi lại toàn bộ mỗi lần chạy). Sapo lỗi thì KHÔNG ghi gì, Sổ Kho
vẫn hiện danh sách lần trước kèm giờ cập nhật cũ.

Cách chạy:
  python tools/sync_late_orders.py                       chỉ in ra màn hình
  python tools/sync_late_orders.py --ghi-so              ghi vào Supabase
  python tools/sync_late_orders.py --ghi-so --telegram   + báo chủ shop đơn trễ từ 2 ngày (1 tin/lần chạy)
  python tools/sync_late_orders.py --ghi-so --chot-hom-qua   chạy tay TRƯỚC 16:00: chỉ xét đơn tới hạn từ
                                                         hôm qua trở về trước (đơn hôm nay chưa tới hạn)
"""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_don_chua_lay import tim_don, gui_telegram, CRED, VN, GIO_CHOT  # noqa: E402
from sync_cutoff_daily import sb  # noqa: E402

SAN_KEY = {'TikTok': 'tiktok', 'Shopee': 'shopee'}
BAO_TU_NGAY = 2   # Telegram chỉ báo đơn trễ từ 2 ngày trở lên (chủ shop: có lỗi mới báo)


def han_cua(tao):
    """Hạn phải đi: đặt trước 16:00 -> trong ngày; từ 16:00 -> hôm sau."""
    d = tao.date()
    return d if tao.hour < GIO_CHOT else d + datetime.timedelta(days=1)


def da_tich(codes):
    """Tra mã vận đơn trong Tích đơn đi -> {code: (staff, scanned_at)}."""
    kq = {}
    for i in range(0, len(codes), 80):
        lo = ','.join('"%s"' % c for c in codes[i:i + 80])
        for r in sb('GET', 'warehouse_outbound_checks?code=in.(%s)&select=code,staff,scanned_at' % lo) or []:
            kq[r['code'].strip().upper()] = (r.get('staff'), r.get('scanned_at'))
    return kq


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    ghi = '--ghi-so' in sys.argv
    now = datetime.datetime.now(VN)
    cred = json.load(open(CRED))
    hom_qua = '--chot-hom-qua' in sys.argv
    kq, tong, _ = tim_don(cred, now - datetime.timedelta(days=1) if hom_qua else now)
    rows = {}
    for d in kq:
        mvd = (d['mvd'] or '').strip().upper()
        if d['tt'] != 'Đã xử lý, chờ lấy' or not mvd:
            continue
        rows[mvd] = {'ma_van_don': mvd, 'san': SAN_KEY[d['san']], 'ma_don': d['ma'],
                     'tao_luc': d['tao'].isoformat(), 'han': han_cua(d['tao']).isoformat(),
                     'da_tich': False, 'tich_boi': None, 'tich_luc': None, 'quet_luc': now.isoformat()}
    tich = da_tich(list(rows)) if rows else {}
    for mvd, (staff, luc) in tich.items():
        if mvd in rows:
            rows[mvd].update(da_tich=True, tich_boi=staff, tich_luc=luc)
    ds = sorted(rows.values(), key=lambda r: (r['da_tich'], r['han']))
    hom_nay = now.date()
    tre = lambda r: (hom_nay - datetime.date.fromisoformat(r['han'])).days
    ten = {False: 'Đã in phiếu, chưa đóng', True: 'Đã đóng, hãng chưa lấy'}
    print('Đơn có mã vận đơn mà hãng chưa lấy — %s: %d đơn' % (now.strftime('%d/%m %H:%M'), len(ds)))
    for nhom in (False, True):
        g = [r for r in ds if r['da_tich'] == nhom]
        print('\n%s: %d đơn' % (ten[nhom], len(g)))
        for r in g:
            print('• %s | %s | %s | hạn %s | trễ %d ngày%s' % (
                r['ma_van_don'], r['san'], r['ma_don'], r['han'], tre(r),
                (' | tích bởi %s' % r['tich_boi']) if r['tich_boi'] else ''))
    print('\n[đã quét %d đơn Sapo]' % tong)
    if not ghi:
        print('(chạy thử — thêm --ghi-so để ghi vào Sổ Kho)')
        return
    if now.hour < GIO_CHOT and not hom_qua:
        print('Không ghi sổ trước %d:00 (đơn hôm nay chưa tới hạn).' % GIO_CHOT)
        return
    # ghi mới trước, xoá dòng của lần quét cũ sau -> Sổ Kho không bao giờ thấy bảng trống giữa chừng
    for i in range(0, len(ds), 200):
        sb('POST', 'warehouse_late_orders?on_conflict=ma_van_don', ds[i:i + 200],
           prefer='resolution=merge-duplicates,return=minimal')
    sb('DELETE', 'warehouse_late_orders?quet_luc=lt.%s' % now.isoformat().replace('+', '%2B'))
    print('Đã ghi %d đơn vào warehouse_late_orders.' % len(ds))
    if '--telegram' in sys.argv:
        nang = [r for r in ds if tre(r) >= BAO_TU_NGAY]
        if nang:
            dong = ['⚠ %d đơn trễ từ %d ngày, kho chưa xử lý (%s)' % (len(nang), BAO_TU_NGAY, now.strftime('%d/%m %H:%M'))]
            for r in sorted(nang, key=lambda r: r['han']):
                dong.append('• %s | %s | %s | trễ %d ngày | %s' % (
                    r['ma_van_don'], r['san'], r['ma_don'], tre(r), ten[r['da_tich']]))
            gui_telegram('\n'.join(dong))
            print('Đã báo Telegram %d đơn trễ từ %d ngày.' % (len(nang), BAO_TU_NGAY))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('⚠ sync_late_orders LỖI: %s' % e)
        sys.exit(1)
