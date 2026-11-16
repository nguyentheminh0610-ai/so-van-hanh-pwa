#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Đếm "đơn trước 16h" mỗi ngày từ Sapo rồi ghi vào Sổ Kho (Supabase) — chốt 17/11/2026.

Định nghĩa (dùng cho thưởng đơn trước 16h + thẻ "Đơn trước 16h" ở tab Tổng quan Sổ Kho):
- Đơn đến hạn của ngày D = đơn Shopee/TikTok KHÔNG huỷ, tạo từ 16:00 hôm trước đến 16:00 ngày D (+07:00).
  Số đơn này là MẪU.
- Đơn TRỄ = trong số đó, đơn vị vận chuyển CHƯA lấy lúc script chạy (Sapo: chưa có phiếu giao còn hiệu lực,
  hoặc có phiếu nhưng `issued_on` rỗng — xem .claude/shared/reference_sapo_api_don_chua_lay.md). Số đó là TỬ.
- Chạy 20:00 (sau lượt shipper cuối + độ trễ Sapo), chỉ chốt NGÀY HÔM NAY. Không chốt lại ngày cũ vì
  hôm sau hãng lấy bù sẽ làm số tử giảm giả tạo.

Ghi vào:
  warehouse_cutoff_daily   (ngay, san, mau_so, tu_so, trang_thai='ok')  — giữ mãi, thưởng đọc từ đây
  warehouse_cutoff_orders  (từng đơn trễ)                               — TỰ XOÁ sau 40 ngày
Ngày nào anh Minh đã đánh dấu "đặc biệt" (trang_thai='dac_biet') thì script KHÔNG ghi đè.

Cách chạy:
  python tools/sync_cutoff_daily.py            chỉ in số liệu ra màn hình (không ghi gì)
  python tools/sync_cutoff_daily.py --ghi-so   ghi vào Supabase + xoá chi tiết quá 40 ngày
Chỉ ĐỌC Sapo. Lỗi thì thoát mã 1 (task 20:00 sẽ báo Telegram nếu đã cấu hình).
"""
import datetime
import json
import os
import sys
import urllib.request
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_don_chua_lay import api, gio_vn, CRED, SAN, VN, GIO_CHOT  # noqa: E402

SUPABASE_URL = "https://dyvublxyrldmmnsrfvpz.supabase.co"
# khoá anon công khai (cùng khoá app Sổ Kho và sync_returns_feed.py đang dùng)
SUPABASE_KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dnVibHh5cmxkbW1uc3JmdnB6Iiwicm9s"
                "ZSI6ImFub24iLCJpYXQiOjE3ODg1MzU4MzMsImV4cCI6MjEwNDExMTgzM30.jM3hD0hNMZ5osaZHDDe5PSm9rQ1Jr6IdWFF0VjT1edI")
GIU_CHI_TIET_NGAY = 40
SAN_KEY = {'tiktokshop': 'tiktok', 'shopee': 'shopee'}


def sb(method, path, body=None, prefer=None):
    h = {'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json'}
    if prefer:
        h['Prefer'] = prefer
    req = urllib.request.Request(SUPABASE_URL + '/rest/v1/' + path, method=method, headers=h,
                                 data=json.dumps(body).encode('utf-8') if body is not None else None)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode('utf-8')
        return json.loads(raw) if raw else None


def dem(cred, now):
    chot = now.replace(hour=GIO_CHOT, minute=0, second=0, microsecond=0)
    tu = chot - datetime.timedelta(days=1)
    fmt = lambda t: t.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    don, page = [], 1
    while True:
        rows = api(cred, '/admin/orders.json?created_on_min=%s&created_on_max=%s&limit=250&page=%d'
                   '&fields=id,created_on,cancelled_on,source_name,source_identifier,fulfillments'
                   % (fmt(tu), fmt(chot), page)).get('orders', [])
        if not rows:
            break
        don += rows
        page += 1
    mau = {'tiktok': 0, 'shopee': 0}
    tre = []
    for o in don:
        if o.get('cancelled_on') or o.get('source_name') not in SAN:
            continue
        t = gio_vn(o['created_on'])
        if not (tu <= t < chot):
            continue
        san = SAN_KEY[o['source_name']]
        mau[san] += 1
        phieu = [f for f in (o.get('fulfillments') or []) if f.get('status') != 'cancelled']
        if not phieu:
            tt = 'Chưa xử lý'
        elif any(not f.get('issued_on') for f in phieu):
            tt = 'Đã xử lý, chờ lấy'
        else:
            continue
        tre.append({'san': san, 'ma_don': o.get('source_identifier') or str(o['id']), 'tao_luc': t.isoformat(),
                    'tinh_trang': tt,
                    'ma_van_don': next((f.get('tracking_number') for f in phieu if f.get('tracking_number')), None)})
    return mau, tre, len(don)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    ghi = '--ghi-so' in sys.argv
    now = datetime.datetime.now(VN)
    ngay = now.strftime('%Y-%m-%d')
    if now.hour < GIO_CHOT:
        print('! Chưa tới %d:00 — số liệu hôm nay chưa đủ, chỉ để xem thử.' % GIO_CHOT)
        if ghi:
            print('Không ghi sổ trước 16:00.')
            sys.exit(0)
    cred = json.load(open(CRED))
    mau, tre, tong = dem(cred, now)
    tu = {'tiktok': 0, 'shopee': 0}
    for d in tre:
        tu[d['san']] += 1
    for s in ('tiktok', 'shopee'):
        print('%s %s: mẫu %d, tử %d (%.1f%% trễ)' % (ngay, s, mau[s], tu[s], 100.0 * tu[s] / mau[s] if mau[s] else 0))
    print('[đã quét %d đơn Sapo]' % tong)
    if not ghi:
        print('(chạy thử — thêm --ghi-so để ghi vào Sổ Kho)')
        return
    # không ghi đè ngày đã đánh dấu đặc biệt
    cu = sb('GET', 'warehouse_cutoff_daily?ngay=eq.%s&select=san,trang_thai' % ngay) or []
    khoa = {r['san'] for r in cu if r.get('trang_thai') == 'dac_biet'}
    for s in ('tiktok', 'shopee'):
        if s in khoa:
            print('  %s: ngày đặc biệt, bỏ qua.' % s)
            continue
        sb('POST', 'warehouse_cutoff_daily?on_conflict=ngay,san',
           [{'ngay': ngay, 'san': s, 'mau_so': mau[s], 'tu_so': tu[s], 'ma_don_tre': [], 'trang_thai': 'ok',
             'ghi_chu': 'job 20:00 từ Sapo'}], prefer='resolution=merge-duplicates,return=minimal')
        sb('DELETE', 'warehouse_cutoff_orders?ngay=eq.%s&san=eq.%s' % (ngay, s))
    moi = [dict(d, ngay=ngay) for d in tre if d['san'] not in khoa]
    for i in range(0, len(moi), 200):
        sb('POST', 'warehouse_cutoff_orders?on_conflict=ngay,san,ma_don', moi[i:i + 200],
           prefer='resolution=merge-duplicates,return=minimal')
    han = (now - datetime.timedelta(days=GIU_CHI_TIET_NGAY)).strftime('%Y-%m-%d')
    sb('DELETE', 'warehouse_cutoff_orders?ngay=lt.%s' % han)
    print('Đã ghi %d dòng tổng hợp + %d đơn trễ; xoá chi tiết trước %s.' % (2 - len(khoa), len(moi), han))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('⚠ sync_cutoff_daily LỖI: %s' % e)
        sys.exit(1)
