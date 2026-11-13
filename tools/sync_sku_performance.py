#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Hiệu suất bán theo mẫu (mã gốc) + chỉ số giỏ hàng -> sku-performance.json (gốc repo).

Tab "Hiệu suất SKU" của Sổ Vận Hành đọc file này. Mỗi lần chạy lấy đơn HOÀN THÀNH
từ API Sapo cho 3 kỳ 7 / 14 / 28 ngày (kèm kỳ liền trước để so cùng kỳ), gộp theo
MÃ GỐC (bỏ đuôi size), và tính:
  - SP/ngày mỗi mẫu + tỷ trọng từng size + % thay đổi so kỳ liền trước.
  - Giỏ hàng: SP/đơn trung bình, % đơn >=2 SP, phân bổ số SP/đơn.
Quy ước (chốt với chủ shop 12/11/2026): đếm theo SỐ CÁI VẬT LÝ — combo 2 cái = 2 SP
(trên Sapo combo đã tách thành 2 dòng lẻ, không phải 1 dòng combo).

Chạy tay (Mac/PC) để cập nhật web:
    python3 tools/sync_sku_performance.py --push

Nguồn key: ~/.config/sapo/credentials.json (expanduser chạy cả Windows). Cloudflare
chặn UA lạ -> giả UA Chrome. Lịch tự chạy 2 ngày/lần: scripts/setup-sku-perf-task.ps1.
"""
import json, subprocess, os, sys, datetime, re, collections

# Windows in stdout/stderr mac dinh bang cp1252 -> print tieng Viet (ten SP) bi
# UnicodeEncodeError, lam script chet TRUOC buoc push. Ep UTF-8 cho an toan.
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

CRED = os.path.expanduser('~/.config/sapo/credentials.json')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT  = os.path.join(REPO, 'sku-performance.json')
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
PERIODS = [7, 14, 28]
MAX_DAYS = max(PERIODS) * 2            # 56 ngày: đủ kỳ 28 + kỳ liền trước 28
SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']
SIZE_RE = re.compile(r'^(.*?)-?(XXXL|XXL|XL|S|M|L)$', re.I)


def log(msg):
    """In log khong bao gio lam chet script (phong console Windows ky quac)."""
    try:
        print(msg)
    except Exception:
        try:
            print(str(msg).encode('ascii', 'replace').decode('ascii'))
        except Exception:
            pass


def api(store, key, sec, path):
    # encoding='utf-8' bat buoc: Windows mac dinh doc stdout bang cp1252 -> loi
    # UnicodeDecodeError voi ten SP tieng Viet (UTF-8). errors='replace' cho an toan.
    r = subprocess.run(['curl', '-sf', '-u', f'{key}:{sec}',
                        '-H', f'User-Agent: {UA}', '-H', 'Accept: application/json',
                        f'https://{store}{path}'], capture_output=True, text=True,
                       encoding='utf-8', errors='replace', timeout=180)
    if r.returncode != 0:
        raise RuntimeError(f'curl lỗi {r.returncode} cho {path}')
    return json.loads(r.stdout)


def split_size(sku):
    """CL05-XL -> ('CL05','XL'); không khớp -> (sku, None)."""
    m = SIZE_RE.match((sku or '').strip())
    if m:
        return m.group(1).rstrip('-/ ').upper(), m.group(2).upper()
    return (sku or '').upper(), None


def fetch_orders(store, key, sec, dmin):
    """Mọi đơn Hoàn thành tạo từ dmin tới nay. Trả list (created_dt, [(base,size,qty)...], tong_qty)."""
    orders = []
    page = 1
    while True:
        path = (f'/admin/orders.json?created_on_min={dmin}&status=completed'
                f'&limit=250&page={page}')
        rows = api(store, key, sec, path).get('orders', [])
        if not rows:
            break
        for o in rows:
            created = o.get('created_on')
            items, tot = [], 0
            for li in o.get('line_items', []):
                if li.get('deleted') or li.get('gift_card'):
                    continue
                q = li.get('quantity') or 0
                if q <= 0:
                    continue
                base, size = split_size(li.get('sku') or '')
                if size is None:            # dòng không phải SP có size -> bỏ khỏi bảng mẫu
                    continue
                vt = li.get('variant_title') or ''
                model = vt.split('/')[0].strip() if '/' in vt else base
                items.append((base, size, q, model))
                tot += q
            if tot > 0:
                orders.append((created, items, tot))
        if len(rows) < 250:
            break
        page += 1
        if page > 120:
            break
    return orders


def aggregate(orders, start_iso, end_iso):
    """Lọc đơn trong [start,end) rồi gộp. Trả (per_base, model_map, basket)."""
    per = collections.defaultdict(lambda: collections.Counter())  # base -> size -> qty
    model_map = {}
    norder = totqty = o2 = 0
    dist = collections.Counter()
    for created, items, tot in orders:
        if not created or not (start_iso <= created < end_iso):
            continue
        norder += 1
        totqty += tot
        dist[min(tot, 5)] += 1
        if tot >= 2:
            o2 += 1
        for base, size, q, model in items:
            per[base][size] += q
            if model and base not in model_map:
                model_map[base] = model
    basket = {'n': norder, 'q': totqty, 'o2': o2, 'dist': dict(dist)}
    return per, model_map, basket


def build_period(orders, days, now):
    f = lambda d: d.strftime('%Y-%m-%dT%H:%M:%SZ')
    cur_start = f(now - datetime.timedelta(days=days))
    prev_start = f(now - datetime.timedelta(days=days * 2))
    end = f(now)
    cur, model_map, b_cur = aggregate(orders, cur_start, end)
    prev, _, b_prev = aggregate(orders, prev_start, cur_start)

    rows = []
    for base, sizes in cur.items():
        tot = sum(sizes.values())
        cur_pd = tot / days
        prev_pd = sum(prev.get(base, {}).values()) / days
        chg = round((cur_pd - prev_pd) / prev_pd * 100) if prev_pd > 0 else None
        rows.append({
            'base': base,
            'model': model_map.get(base, base),
            'perday': round(cur_pd, 1),
            'prev': round(prev_pd, 1),
            'chg': chg,
            'sizes': {s: sizes[s] for s in SIZES if sizes.get(s)},
        })
    rows.sort(key=lambda r: -r['perday'])

    def basket_out(b, d):
        n = b['n'] or 1
        return {
            'n': b['n'], 'totqty': b['q'],
            'spdon': round(b['q'] / n, 2),
            'pct2': round(b['o2'] / n * 100, 1),
            'dist': {('5+' if k == 5 else str(k)): b['dist'].get(k, 0) for k in sorted(b['dist'])},
        }
    basket = basket_out(b_cur, days)
    pb = basket_out(b_prev, days)
    basket['prev'] = {'spdon': pb['spdon'], 'pct2': pb['pct2'], 'n': pb['n']}
    return {'model_rows': rows, 'basket': basket}


def main():
    push = '--push' in sys.argv
    cred = json.load(open(CRED))
    store, key, sec = cred['store'], cred['api_key'], cred['api_secret']
    now = datetime.datetime.now(datetime.timezone.utc)
    dmin = (now - datetime.timedelta(days=MAX_DAYS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    orders = fetch_orders(store, key, sec, dmin)

    out = {
        'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
        'tz': 'local',
        'periods': {str(p): build_period(orders, p, now) for p in PERIODS},
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=0)
    p7 = out['periods']['7']['basket']
    log(f"OK -> sku-performance.json | {len(orders)} don/56 ngay | "
        f"ky 7 ngay: {p7['n']} don, {len(out['periods']['7']['model_rows'])} mau, "
        f"SP/don {p7['spdon']}, don>=2 {p7['pct2']}%")

    if push:
        if subprocess.run(['git', '-C', REPO, 'diff', '--quiet', '--', 'sku-performance.json']).returncode == 0:
            log('Khong co thay doi - bo qua push.')
            return
        subprocess.run(['git', '-C', REPO, 'add', 'sku-performance.json'], check=True)
        subprocess.run(['git', '-C', REPO, '-c', 'user.name=sync-bot',
                        '-c', 'user.email=nguyentheminh0610@gmail.com',
                        'commit', '-m', f"Dong bo hieu suat SKU {out['generatedAt']} (tu dong)",
                        '--quiet'], check=True)
        subprocess.run(['git', '-C', REPO, 'push', 'origin', 'main', '--quiet'], check=True)
        log('Da push - Vercel se tu deploy.')


if __name__ == '__main__':
    main()
