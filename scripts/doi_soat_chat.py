# -*- coding: utf-8 -*-
"""Đối soát nguồn CHAT cho tab Hậu mãi (chốt 22/11/2026).

Vì sao có script này: lượt CSKH inbox ghi MỌI cuộc chat vào nhật ký C:\\sokho\\cskh-log\\*.jsonl,
nhưng việc đẩy case lên Sổ Vận Hành (bảng cskh_chat_errors) là 1 bước riêng và hay bị bỏ qua khi
task chưa chắc đó là lỗi shop. Rà 22/11: từ 17/11 lọt ít nhất 4 khách báo rách / giao nhầm.

Script KHÔNG mở trình duyệt, KHÔNG tốn token, KHÔNG nhắn khách, KHÔNG gửi Telegram, KHÔNG quy lỗi.
Nó chỉ: đọc nhật ký -> khách nào báo hàng lỗi / giao nhầm mà chưa có trên sổ thì thêm 1 thẻ vào khu
Chat, để chủ shop tự xem rồi bấm "Ghi Sổ Kho: lỗi kho / lỗi sản phẩm" hoặc "Xong".

Giao THIẾU không thuộc script này (đi luồng gửi bù - resend_cases).

Chạy tay:
    python scripts/doi_soat_chat.py --dry-run          # chỉ in ra, không ghi
    python scripts/doi_soat_chat.py                    # ghi thật
    python scripts/doi_soat_chat.py --days 14          # nhìn lại bao nhiêu ngày nhật ký (mặc định 7)
Chi tiết: .claude/shared/hau-mai-so-van-hanh.md
"""
import argparse, datetime as dt, glob, io, json, os, re, sys, urllib.error, urllib.parse, urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.environ.get('CSKH_LOG_DIR', r'C:\sokho\cskh-log')

# Chỉ xét các loại hội thoại sau mua. tu_van_size / ton_kho / koc... không thể là báo lỗi hàng.
CATEGORIES = {'khieu_nai', 'doi_tra', 'hau_mai', 'sau_mua'}

W = r'(?<![0-9A-Za-zÀ-ỹ])'   # ranh giới từ tiếng Việt (\b không hiểu dấu)
E = r'(?![0-9A-Za-zÀ-ỹ])'
# Lỗi SẢN PHẨM: khách tả hàng hỏng
RE_SP = re.compile(W + r'(rách|thủng|lủng|bung chỉ|tuột chỉ|sứt chỉ|đứt chỉ|bục chỉ|hàng lỗi|bị lỗi|lỗi vải|lỗi đường may|'
                       r'bẩn|vết bẩn|vết ố|bị ố|phai màu|ra màu|loang màu|hỏng khoá|hỏng khóa|đứt dây|mốc)' + E, re.I)
# Lỗi KHO: giao nhầm mẫu / màu / size
RE_KHO = re.compile(W + r'((giao|gửi|ship|đóng|nhận)( cho)?( em| e| mình| m| tôi| t)? (nhầm|sai|lộn)|nhầm mẫu|nhầm màu|nhầm hàng|'
                        r'sai mẫu|sai màu|sai hàng|không đúng mẫu|không đúng màu|ko đúng mẫu|k đúng mẫu|khác mẫu|mà lại giao|mà giao)' + E, re.I)
# Khách TỰ đặt nhầm thì không phải lỗi shop -> không lên sổ theo đường này
RE_SELF = re.compile(W + r'(đặt|mua|chọn|bấm|ấn|order) (nhầm|sai|lộn)' + E, re.I)
RE_ORDER = [re.compile(r'(?<!\d)(5\d{17})(?!\d)'),                     # TikTok
            re.compile(r'(?<![0-9A-Z])(2\d{5}[0-9A-Z]{8})(?![0-9A-Z])')]  # Shopee
RE_PHONE = re.compile(r'(?<!\d)(0|\+84)\d{8,10}(?!\d)')

CHAT_URL = {'tiktok': 'https://seller-vn.tiktok.com/chat/inbox/current?shop_region=VN',
            'shopee': 'https://banhang.shopee.vn/webchat/conversations'}
NEW_COLS = ('case_type', 'progress_note', 'needs_action', 'action_type')


def sb_conf():
    # anon key đã nằm công khai trong init.js (web tĩnh) - đọc lại từ đó, không chép thêm chỗ nào khác
    src = io.open(os.path.join(REPO, 'init.js'), encoding='utf-8').read()
    url = re.search(r"SUPABASE_URL\s*=\s*'([^']+)'", src).group(1)
    key = re.search(r"SUPABASE_ANON_KEY\s*=\s*'([^']+)'", src).group(1)
    return url.rstrip('/') + '/rest/v1/', key


def sb(method, path, body=None):
    url, key = sb_conf()
    h = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}
    if method == 'POST':
        h['Prefer'] = 'return=representation'
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            t = r.read().decode('utf-8')
            return json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        raise RuntimeError('%s %s' % (e.code, e.read().decode('utf-8', 'replace')[:400]))


def norm(u):
    return re.sub(r'\s+', '', str(u or '')).lstrip('@').lower()


def read_log(days):
    """-> {(platform, user): [dòng nhật ký có báo lỗi, cũ -> mới]}"""
    since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    out = {}
    for f in sorted(glob.glob(os.path.join(LOG_DIR, '20??-??-??.jsonl'))):
        day = os.path.basename(f)[:10]
        if day < since:
            continue
        with io.open(f, encoding='utf-8', errors='replace') as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                except ValueError:
                    continue            # dòng hỏng thì bỏ qua, không làm chết cả lượt
                if not isinstance(d, dict) or d.get('category') not in CATEGORIES:
                    continue
                plat, user = str(d.get('platform') or '').lower(), norm(d.get('user'))
                if plat not in CHAT_URL or not user:
                    continue
                msg, ctx = str(d.get('last_msg') or ''), str(d.get('context') or '')
                both = msg + ' ' + ctx
                kho, sp = RE_KHO.search(both), RE_SP.search(both)
                if kho and not sp and RE_SELF.search(both):
                    kho = None
                if not (kho or sp):
                    continue
                order = ''
                for rx in RE_ORDER:
                    m = rx.search(both)
                    if m:
                        order = m.group(1)
                        break
                out.setdefault((plat, user), []).append({
                    'day': day, 'time': str(d.get('time') or ''), 'user_raw': str(d.get('user') or ''),
                    'msg': msg, 'ctx': ctx, 'order': order,
                    'claim': 'giao_nham' if kho else 'san_pham_loi',
                    'photo': bool(re.search(r'ảnh|video|hình', both, re.I)) and not re.search(r'chưa có ảnh|xin ảnh|chưa gửi ảnh', both, re.I)})
    return out


def known():
    """Khách / đơn đã có mặt trên sổ (cả 3 nguồn + gửi bù) -> không thêm lần nữa, tránh 1 việc hiện 2 nơi."""
    since = (dt.date.today() - dt.timedelta(days=60)).isoformat()
    users, orders, quiet = set(), set(), {}
    for tbl, col, datecol in (('cskh_chat_errors', 'customer', 'chat_date'),
                              ('cskh_returns', 'customer', 'request_date'),
                              ('cskh_reviews', 'customer', 'review_date')):
        try:
            rows = sb('GET', '%s?select=*&%s=gte.%s&limit=2000' % (tbl, datecol, since))
        except RuntimeError as e:
            raise RuntimeError('không đọc được %s: %s' % (tbl, e))
        for r in rows:
            # Dòng trả hàng / đánh giá KHÔNG thành thẻ trên web (không cờ, không đề xuất, chưa ai đóng) thì
            # chủ shop chưa hề thấy -> không tính là "đã có". Vd khách chọn lý do "Đổi ý" trên sàn nhưng
            # trong chat nói quần rách. Giữ lại mã đơn để thẻ chat gộp đúng vào đơn đó.
            card = (tbl == 'cskh_chat_errors' or r.get('needs_action') or r.get('acked_at')
                    or (r.get('errlog_status') or 'none') != 'none')
            if not card:
                if r.get(col) and r.get('order_code'):
                    quiet.setdefault((r.get('platform'), norm(r[col])), r['order_code'])
                continue
            if r.get(col):
                users.add((r.get('platform'), norm(r[col])))
            if r.get('order_code'):
                orders.add((r.get('platform'), r['order_code']))
    # giao thiếu / đơn đang có phiếu gửi bù: luồng gửi bù lo, thẻ đã nằm sẵn trong khu Chat
    for r in sb('GET', 'resend_cases?select=platform,handle,orig_order_code,created_at&created_at=gte.%sT00:00:00&limit=2000' % since):
        if r.get('handle'):
            users.add((r.get('platform'), norm(r['handle'])))
        if r.get('orig_order_code'):
            orders.add((r.get('platform'), r['orig_order_code']))
    return users, orders, quiet


def build_row(plat, user, hits, order_hint=''):
    first, last = hits[0], hits[-1]
    order = order_hint or next((h['order'] for h in reversed(hits) if h['order']), '')
    claim = 'giao_nham' if any(h['claim'] == 'giao_nham' for h in hits) else 'san_pham_loi'
    ddmm = lambda h: h['day'][8:10] + '/' + h['day'][5:7]
    msg = RE_PHONE.sub('[SĐT]', last['msg']).strip()
    ctx = RE_PHONE.sub('[SĐT]', last['ctx']).strip()
    ev = ('%s %s khách: "%s" — %s' % (ddmm(last), last['time'], msg[:110], ctx))[:300]
    now = dt.datetime.now()
    step = ('▸ %s · [chờ anh] Đối soát nhật ký chat: khách báo %s từ %s, chưa có trên sổ. '
            'Anh mở chat xem rồi bấm Ghi Sổ Kho (lỗi kho / lỗi sản phẩm) hoặc Xong.'
            % (now.strftime('%d/%m %H:%M'), 'giao nhầm' if claim == 'giao_nham' else 'hàng lỗi', ddmm(first)))
    return {
        'dedup_key': '%s|%s|%s|doi_soat' % (plat, order or '@' + user, first['day']),
        'platform': plat, 'chat_date': last['day'], 'customer': first['user_raw'].lstrip('@') or user,
        'order_code': order or None, 'evidence': ev, 'has_photo': any(h['photo'] for h in hits),
        'chat_url': CHAT_URL[plat],
        'shop_error_kind': None, 'errlog_reason': None,   # KHÔNG quy lỗi - chủ shop tự chọn trên web
        'errlog_status': 'none',
        'case_type': claim, 'progress_note': step, 'needs_action': True, 'action_type': 'lien_he_khach',
    }


def insert(row):
    try:
        sb('POST', 'cskh_chat_errors', row)
        return 'ok'
    except RuntimeError as e:
        s = str(e)
        if '23505' in s or 'duplicate key' in s:
            return 'dup'
        if 'PGRST204' in s or '42703' in s:
            # Supabase chưa có 5 cột mới (chưa chạy phần 22/11/2026 của scripts/cskh-tables.sql).
            # Bảng cũ chỉ hiện dòng errlog_status='suggest' -> ghi kiểu cũ để thẻ vẫn lên sổ.
            old = {k: v for k, v in row.items() if k not in NEW_COLS}
            old['errlog_status'] = 'suggest'
            old['errlog_reason'] = 'Đối soát nhật ký chat — anh xem chat rồi tự chọn loại lỗi'
            try:
                sb('POST', 'cskh_chat_errors', old)
                return 'ok_old'
            except RuntimeError as e2:
                if '23505' in str(e2) or 'duplicate key' in str(e2):
                    return 'dup'
                raise
        raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--days', type=int, default=7)
    a = ap.parse_args()
    if not os.path.isdir(LOG_DIR):
        print('LOI: khong thay thu muc nhat ky %s' % LOG_DIR)
        return 1
    hits = read_log(a.days)
    users, orders, quiet = known()
    added = skipped = 0
    for (plat, user), hs in sorted(hits.items(), key=lambda kv: kv[1][0]['day']):
        hit_orders = {h['order'] for h in hs if h['order']}
        if (plat, user) in users or any((plat, o) in orders for o in hit_orders):
            skipped += 1
            if a.dry_run:
                print('DA CO    %s | %s' % (plat, user))
            continue
        row = build_row(plat, user, hs, quiet.get((plat, user), ''))
        if a.dry_run:
            print('SE THEM  %s | %s | don=%s | %s | %s' % (plat, row['customer'], row['order_code'] or '-', row['case_type'], row['evidence']))
            added += 1
            continue
        res = insert(row)
        if res in ('ok', 'ok_old'):
            added += 1
            print('DA THEM  %s | %s | %s%s' % (plat, row['customer'], row['case_type'], ' (bang cu, chua co cot moi)' if res == 'ok_old' else ''))
        else:
            skipped += 1
    print('OK khach_bao_loi=%d them=%d da_co=%d%s' % (len(hits), added, skipped, ' (dry-run)' if a.dry_run else ''))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:      # in 1 dòng LOI để runner ghi log
        print('LOI: %s' % e)
        sys.exit(1)
