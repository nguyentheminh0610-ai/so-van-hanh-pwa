#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Đồng bộ HẰNG NGÀY từ API Sapo cho Sổ Vận Hành — chạy bằng script thuần nên
KHÔNG tốn token AI nào; launchd/cron gọi mỗi sáng là web luôn có số mới.

Làm 2 việc:
1. inventory-snapshot.json — tồn kho hiện tại mọi variant thường (tích luỹ thêm
   1 dòng lịch sử tổng vào inventory-history.json để sau này tính tồn bình quân).
2. sales-velocity.json — SL bán theo SKU trong 28 ngày gần nhất (đơn tạo trên
   Sapo, ĐÃ TRỪ đơn huỷ; combo tách về SKU con qua sku-catalog.json) → tốc độ
   bán/ngày đúng công thức 4.1 doc Chuẩn hoá, không phải chờ file tháng.

Chạy tay:   python3 tools/sync_daily.py
Tự đẩy web: python3 tools/sync_daily.py --push   (commit+push nếu số thay đổi)
"""
import json, subprocess, os, sys, datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRED = os.path.expanduser('~/.config/sapo/credentials.json')
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
DAYS = 28

def api(store, key, sec, path):
    r = subprocess.run(['curl', '-sf', '-u', f'{key}:{sec}',
                        '-H', f'User-Agent: {UA}', '-H', 'Accept: application/json',
                        f'https://{store}{path}'], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f'curl lỗi {r.returncode} cho {path}')
    return json.loads(r.stdout)

def norm(s):
    return ''.join(c for c in str(s or '').upper() if c.isalnum())

def main():
    push = '--push' in sys.argv
    cred = json.load(open(CRED))
    store, key, sec = cred['store'], cred['api_key'], cred['api_secret']
    now = datetime.datetime.now()
    stamp = now.strftime('%Y-%m-%d %H:%M')

    # --- 1) tồn kho ---
    inv = {}
    page = 1
    while True:
        rows = api(store, key, sec, f'/admin/variants.json?limit=250&page={page}').get('variants', [])
        if not rows: break
        for v in rows:
            sku = (v.get('sku') or '').strip()
            if not sku or v.get('type') == 'combo': continue
            q = v.get('inventory_quantity')
            inv[sku] = int(q) if q is not None else 0
        page += 1
    json.dump({'generatedAt': stamp, 'inventory': inv},
              open(os.path.join(REPO, 'inventory-snapshot.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=0)

    # lịch sử tổng tồn (để sau tính tồn bình quân cho vòng quay)
    hist_path = os.path.join(REPO, 'inventory-history.json')
    try: hist = json.load(open(hist_path))
    except Exception: hist = {'rows': []}
    today = now.strftime('%Y-%m-%d')
    hist['rows'] = [r for r in hist['rows'] if r['date'] != today]
    hist['rows'].append({'date': today, 'totalUnits': sum(max(0, q) for q in inv.values())})
    hist['rows'] = hist['rows'][-400:]
    json.dump(hist, open(hist_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

    # --- 2) tốc độ bán 28 ngày (combo tách con) ---
    combos = {}
    try:
        cat = json.load(open(os.path.join(REPO, 'sku-catalog.json')))
        combos = {norm(k): v for k, v in (cat.get('combos') or {}).items()}
    except Exception:
        pass
    since = (now - datetime.timedelta(days=DAYS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    sold = {}
    n_orders = 0
    page = 1
    while True:
        rows = api(store, key, sec,
                   f'/admin/orders.json?created_on_min={since}&limit=250&page={page}'
                   '&fields=id,created_on,status,cancelled_status,line_items').get('orders', [])
        if not rows: break
        for o in rows:
            if o.get('status') == 'cancelled' or o.get('cancelled_status') == 'cancelled':
                continue
            n_orders += 1
            for li in (o.get('line_items') or []):
                sku = (li.get('sku') or '').strip()
                qty = li.get('quantity') or 0
                if not sku or not qty: continue
                items = combos.get(norm(sku))
                if items:  # combo -> SKU con
                    for it in items:
                        sold[it['sku']] = sold.get(it['sku'], 0) + qty * (it.get('qty') or 1)
                else:
                    sold[sku] = sold.get(sku, 0) + qty
        page += 1
    json.dump({'generatedAt': stamp, 'days': DAYS, 'orders': n_orders, 'sold': sold},
              open(os.path.join(REPO, 'sales-velocity.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=0)
    print(f'OK: tồn {sum(inv.values())} cái / {len(inv)} SKU · bán {DAYS} ngày: {sum(sold.values())} cái / {n_orders} đơn (đã trừ huỷ)')

    if push:
        os.chdir(REPO)
        diff = subprocess.run(['git', 'diff', '--quiet', '--', 'inventory-snapshot.json',
                               'sales-velocity.json', 'inventory-history.json'])
        if diff.returncode == 0:
            print('Không có thay đổi — bỏ qua push.')
            return
        subprocess.run(['git', 'add', 'inventory-snapshot.json', 'sales-velocity.json', 'inventory-history.json'], check=True)
        subprocess.run(['git', '-c', 'user.name=sync-bot', '-c', 'user.email=nguyentheminh0610@gmail.com',
                        'commit', '-m', f'Dong bo ton kho + toc do ban {stamp} (tu dong)',
                        '--quiet'], check=True)
        subprocess.run(['git', 'push', 'origin', 'main', '--quiet'], check=True)
        print('Đã push — Vercel sẽ tự deploy.')

if __name__ == '__main__':
    main()
