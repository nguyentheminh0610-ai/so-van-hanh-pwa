# -*- coding: utf-8 -*-
r"""Cho canh he thong - 0 token AI (chot 21/11/2026, sau su co mat dien 20/11).

Chay bang Windows Task Scheduler (`Claude - Watchdog`): 30 phut/lan + khi PC khoi dong.
KHONG can Claude, KHONG can Chrome -> mat dien / Claude loi / Chrome ket approval van
tu bao duoc cho chu shop, khong can ai vao kiem tra tung truong hop.

Kiem:
  1. review-return-check: lan chay `ok` gan nhat > 14h (task 08:00/20:00 bi ket Chrome
     approval -> status blocked mai) -> bao Telegram.
  2. Phieu gui bu (`resend_cases`) dang mo (collecting/verifying) im > 3h -> bao Telegram
     (moi phieu toi da 1 lan / 6h) de chu shop khong phai tu di tim phieu bi ket.
  3. Phieu `wait_approve_1/2` cho anh duyet > 1h -> nhac (1 lan / 3h).
  4. --boot: PC vua khoi dong lai -> bao 1 dong "PC vua bat lai ...".
Telegram: ~/.config/telegram/credentials.json (ngoai repo). Chua co -> chi ghi log.
Trang thai chong bao trung: C:/sokho/resend-data\watchdog_state.json (ngoai git).
"""
import json, os, re, sys, urllib.request, urllib.parse, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SB = 'https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1'
STATE = r'C:/sokho/resend-data\watchdog_state.json'
KEY = re.search(r'eyJ[A-Za-z0-9_.-]+', open(os.path.join(ROOT, 'init.js'), encoding='utf8').read()).group(0)
NOW = dt.datetime.now(dt.timezone.utc)


def get(path):
    req = urllib.request.Request(SB + '/' + path, headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
    return json.load(urllib.request.urlopen(req, timeout=30))


def ts(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))


def hours(s):
    return (NOW - ts(s)).total_seconds() / 3600


def tg(text):
    try:
        c = json.load(open(os.path.expanduser('~/.config/telegram/credentials.json')))
        data = urllib.parse.urlencode({'chat_id': c['chat_id'], 'text': text}).encode('utf8')
        urllib.request.urlopen('https://api.telegram.org/bot%s/sendMessage' % c['bot_token'], data, timeout=30)
    except Exception as e:
        print('[Telegram loi/chua cau hinh]', e)
    print(text)


def load_state():
    try:
        return json.load(open(STATE, encoding='utf8'))
    except Exception:
        return {}


def due(state, key, every_h):
    t = state.get(key)
    return not t or hours(t) >= every_h


def main():
    st = load_state()
    now_iso = NOW.isoformat()

    if '--boot' in sys.argv:
        tg('PC vừa khởi động lại lúc %s. Các task sẽ tự chạy bù; em sẽ báo nếu có việc bị lỡ.'
           % dt.datetime.now().strftime('%H:%M %d/%m'))

    # 1. review-return-check
    runs = get('cskh_run_log?select=ran_at,status,note&order=ran_at.desc&limit=30')
    last_ok = next((r for r in runs if r['status'] == 'ok'), None)
    age = hours(last_ok['ran_at']) if last_ok else 999
    if age > 14 and due(st, 'review', 6):
        why = runs[0]['note'][:120] if runs else 'chưa có log'
        tg('⚠️ Quét đánh giá/trả hàng đã %d giờ chưa chạy được lượt nào thành công. Lượt gần nhất: %s. '
           'Anh/em cần chạy bù tay.' % (age, why))
        st['review'] = now_iso

    # 2 + 3. Phieu gui bu
    rows = get('resend_cases?select=id,handle,platform,status,updated_at&status=in.(collecting,verifying,wait_approve_1,wait_approve_2,stalled)')
    # Chốt 21/11/2026: chủ shop KHÔNG muốn báo Telegram cho phiếu đứng im / chờ duyệt (rối) — các phiếu này
    # hiện thẳng trên Sổ Vận Hành (tab Hậu mãi) kèm "thiếu gì / khách chưa phản hồi". Bật lại bằng --resend-telegram.
    for r in (rows if '--resend-telegram' in sys.argv else []):
        h = hours(r['updated_at'])
        k = 'resend%s' % r['id']
        if r['status'] in ('collecting', 'verifying', 'stalled') and h > 3 and due(st, k, 6):
            tg('⚠️ Phiếu gửi bù #%s %s (%s) đang "%s" và đứng im %d giờ. Cần xem khách đã trả lời chưa / còn thiếu SĐT-địa chỉ không.'
               % (r['id'], r['handle'], r['platform'], r['status'], h))
            st[k] = now_iso
        elif r['status'].startswith('wait_approve') and h > 1 and due(st, k, 3):
            tg('Phiếu gửi bù #%s %s đang chờ anh duyệt (%s) từ %d giờ trước, xem tab Hậu mãi trên Sổ Vận Hành.'
               % (r['id'], r['handle'], r['status'], h))
            st[k] = now_iso

    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(st, open(STATE, 'w', encoding='utf8'))


if __name__ == '__main__':
    main()
