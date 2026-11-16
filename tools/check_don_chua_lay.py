#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tìm đơn tạo trước 16:00 hôm nay mà đơn vị vận chuyển CHƯA lấy — chỉ ĐỌC Sapo.

Chạy 20:00 hằng ngày trên PC trực (Task Scheduler "Claude - Don chua lay"),
script thuần nên không tốn token AI. Không ghi/sửa/xoá gì trên Sapo hay Supabase.

Cách xác định (kiểm thật 16/11/2026, xem
.claude/shared/reference_sapo_api_don_chua_lay.md):
- Bỏ đơn huỷ: `cancelled_on` khác rỗng.
- "Chưa xử lý / Chờ vận chuyển": đơn chưa có phiếu giao (fulfillment) nào còn hiệu lực.
- "Đã xử lý / Chờ lấy hàng": có phiếu giao nhưng `issued_on` rỗng. Sapo tự ghi
  `issued_on` sau khi hãng quét nhận hàng (trễ thường ~10 phút, tối đa đo được
  ~1,5 giờ) — vì vậy chạy 20:00 chứ không phải ngay sau giờ shipper lấy.

Chạy tay (chỉ in ra màn hình):   python tools/check_don_chua_lay.py
Gửi Telegram:                    python tools/check_don_chua_lay.py --telegram
  (cần biến môi trường TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID; khoá Sapo đọc từ
   ~/.config/sapo/credentials.json — không để trong repo.)
"""
import datetime
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

CRED = os.path.expanduser('~/.config/sapo/credentials.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) so-van-hanh/check-don-chua-lay'
VN = datetime.timezone(datetime.timedelta(hours=7))
GIO_CHOT = 16          # chỉ xét đơn tạo trước 16:00 hôm nay (+07:00)
LUI_NGAY = 10          # kể cả đơn tồn từ tối đa 10 ngày trước
SAN = {'tiktokshop': 'TikTok', 'shopee': 'Shopee'}
TG_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TG_CHAT = os.environ.get('TELEGRAM_CHAT_ID', '')
# Không có biến môi trường thì đọc file cục bộ NGOÀI repo (chủ shop tự tạo):
#   ~/.config/telegram/credentials.json = {"bot_token": "...", "chat_id": "..."}
if not (TG_TOKEN and TG_CHAT):
    try:
        _tg = json.load(open(os.path.expanduser('~/.config/telegram/credentials.json')))
        TG_TOKEN, TG_CHAT = _tg.get('bot_token', ''), str(_tg.get('chat_id', ''))
    except Exception:
        pass


def api(cred, path):
    r = subprocess.run(
        ['curl', '-sf', '-u', '%s:%s' % (cred['api_key'], cred['api_secret']),
         '-H', 'User-Agent: ' + UA, '-H', 'Accept: application/json',
         'https://%s%s' % (cred['store'], path)],
        capture_output=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError('curl lỗi %s cho %s' % (r.returncode, path.split('?')[0]))
    return json.loads(r.stdout.decode('utf-8'))


def gio_vn(s):
    t = datetime.datetime.strptime(s, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)
    return t.astimezone(VN)


def tim_don(cred, now):
    chot = now.replace(hour=GIO_CHOT, minute=0, second=0, microsecond=0)
    tu = chot - datetime.timedelta(days=LUI_NGAY)
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
    kq = []
    for o in don:
        if o.get('cancelled_on') or o.get('source_name') not in SAN:
            continue
        if gio_vn(o['created_on']) >= chot:
            continue
        phieu = [f for f in (o.get('fulfillments') or []) if f.get('status') != 'cancelled']
        if not phieu:
            tt = 'Chưa xử lý'
        elif any(not f.get('issued_on') for f in phieu):
            tt = 'Đã xử lý, chờ lấy'
        else:
            continue  # hãng đã lấy
        kq.append({'san': SAN[o['source_name']], 'ma': o.get('source_identifier') or str(o['id']),
                   'tao': gio_vn(o['created_on']), 'tt': tt,
                   'mvd': next((f.get('tracking_number') for f in phieu if f.get('tracking_number')), '')})
    kq.sort(key=lambda d: (d['san'], d['tao']))
    return kq, len(don), page - 1


def soan_tin(kq, now):
    dau = '📦 Đơn tạo trước %d:00 mà hãng CHƯA lấy — %s' % (GIO_CHOT, now.strftime('%d/%m %H:%M'))
    if not kq:
        return dau + '\n✅ Không còn đơn nào.'
    dong = [dau]
    for san in ('Shopee', 'TikTok'):
        ds = [d for d in kq if d['san'] == san]
        cxl = sum(1 for d in ds if d['tt'] == 'Chưa xử lý')
        dong.append('\n%s: %d đơn (%d chưa xử lý, %d chờ lấy)' % (san, len(ds), cxl, len(ds) - cxl))
        for d in ds:
            dong.append('• %s | %s | %s%s' % (d['ma'], d['tao'].strftime('%d/%m %H:%M'), d['tt'],
                                             (' | ' + d['mvd']) if d['mvd'] else ''))
    dong.append('\nTổng: %d đơn. (Nguồn: Sapo, có thể trễ hơn sàn ~10 phút.)' % len(kq))
    return '\n'.join(dong)


def gui_telegram(msg):
    if not (TG_TOKEN and TG_CHAT):
        print('  (bỏ qua gửi — chưa đặt TELEGRAM_BOT_TOKEN/CHAT_ID)')
        return False
    for i in range(0, len(msg), 3900):  # Telegram giới hạn 4096 ký tự/tin
        data = urllib.parse.urlencode({'chat_id': TG_CHAT, 'text': msg[i:i + 3900]}).encode()
        urllib.request.urlopen('https://api.telegram.org/bot%s/sendMessage' % TG_TOKEN,
                               data=data, timeout=20)
    return True


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    now = datetime.datetime.now(VN)
    try:
        cred = json.load(open(CRED))
        kq, tong, so_req = tim_don(cred, now)
        msg = soan_tin(kq, now)
    except Exception as e:  # lỗi thì vẫn phải báo, không im lặng coi như "không có đơn"
        msg = '⚠ Check đơn chưa lấy (Sapo) LỖI lúc %s: %s' % (now.strftime('%d/%m %H:%M'), e)
        print(msg)
        if '--telegram' in sys.argv:
            gui_telegram(msg)
        sys.exit(1)
    print(msg)
    print('\n[đã quét %d đơn, %d request Sapo]' % (tong, so_req))
    if '--telegram' in sys.argv:
        gui_telegram(msg)


if __name__ == '__main__':
    main()
