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
# Sheet lương nhân viên live (chủ shop đã mở chia sẻ công khai 21/10/2026).
LUONG_LIVE_CSV = ('https://docs.google.com/spreadsheets/d/'
                  '1WWdKB3_LNFBR4V_emevCKAOYXunH25d11o9jkRmJSTI/export?format=csv')
LUONG_LIVE_TABS = {'2026-10': 500001, '2026-11': 500002, '2026-12': 500003,
                   '2027-01': 500004, '2027-02': 500005, '2027-03': 500006}
# Sheet giá vốn "Chi phí & Lợi nhuận theo SKU", tab GiaCong cột H. Chỉ đọc được
# khi chủ shop mở chia sẻ "bất kỳ ai có link" (hiện 21/10 còn riêng tư -> bỏ qua,
# cost-catalog.json giữ nguyên bản chép tay).
GIAVON_CSV = ('https://docs.google.com/spreadsheets/d/'
              '1UNp0gw-zOlhtuV2e48UXFV5dWkjlItW3CqmhjvJWX9k/export?format=csv&gid=1590952086')

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

    # --- 3) lương nhân viên live từ Google Sheet (sheet đã chia sẻ công khai) ---
    # Web tĩnh fetch thẳng Google Sheets sẽ dính CORS, nên script (chạy ngoài
    # trình duyệt) tải hộ rồi ghi ra payroll-live.json cho web đọc.
    luong = {}
    for key, gid in LUONG_LIVE_TABS.items():
        try:
            r = subprocess.run(['curl', '-sfL', f'{LUONG_LIVE_CSV}&gid={gid}'],
                               capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                continue
            for dong in r.stdout.splitlines():
                if 'TỔNG LƯƠNG THÁNG' in dong:
                    nums = [x for x in dong.replace('"', '').replace('đ', '').split(',') if x.strip()]
                    # số tiền bị tách bởi dấu phẩy hàng nghìn -> ghép lại các mảnh số
                    digits = ''.join(c for c in dong if c.isdigit())
                    # bỏ phần "(đ)" của nhãn: lấy cụm số dài nhất sau dấu phẩy cuối nhãn
                    import re as _re
                    m = _re.findall(r'"?([\d][\d,\.]{3,})\s*đ"?', dong)
                    if m:
                        luong[key] = int(''.join(c for c in m[-1] if c.isdigit()))
                    break
        except Exception:
            continue
    if luong:
        json.dump({'generatedAt': stamp, 'byMonth': luong},
                  open(os.path.join(REPO, 'payroll-live.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=0)

    # --- 4) giá vốn từ sheet GiaCong (chỉ khi sheet đã mở chia sẻ công khai) ---
    gv_msg = ''
    try:
        r = subprocess.run(['curl', '-sfL', GIAVON_CSV], capture_output=True, text=True, timeout=60)
        if r.returncode == 0 and 'SKU' in r.stdout[:200]:
            import csv, io
            rows = list(csv.reader(io.StringIO(r.stdout)))
            cost = {}
            for row in rows[1:]:
                if len(row) < 8:
                    continue
                ma = (row[0] or '').split(' - ')[0].strip()
                raw = (row[7] or '').replace('.', '').replace(',', '').strip()
                if ma and raw.isdigit() and int(raw) > 0:
                    cost[ma] = int(raw)
            if len(cost) >= 20:  # chốt chặn: sheet hỏng thì không ghi đè
                cc_path = os.path.join(REPO, 'cost-catalog.json')
                cc = json.load(open(cc_path, encoding='utf-8'))
                old_cost = cc.get('cost') or {}
                alias = {k: v for k, v in old_cost.items() if k not in cost and k == 'DO03BANCAOCAP'}
                cost.update(alias)  # giữ alias mã cũ
                if cost != old_cost:
                    cc['cost'] = cost
                    cc['generatedAt'] = stamp
                    json.dump(cc, open(cc_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                    gv_msg = f' · giá vốn: cập nhật {len(cost)} mã từ sheet'
                else:
                    gv_msg = ' · giá vốn: không đổi'
    except Exception:
        pass

    print(f'OK: tồn {sum(inv.values())} cái / {len(inv)} SKU · bán {DAYS} ngày: {sum(sold.values())} cái / {n_orders} đơn (đã trừ huỷ)'
          + (f' · lương live: ' + ', '.join(f'{k}={v:,}đ' for k, v in sorted(luong.items())) if luong else '') + gv_msg)

    if push:
        os.chdir(REPO)
        diff = subprocess.run(['git', 'diff', '--quiet', '--', 'inventory-snapshot.json',
                               'sales-velocity.json', 'inventory-history.json', 'payroll-live.json', 'cost-catalog.json'])
        if diff.returncode == 0:
            print('Không có thay đổi — bỏ qua push.')
            return
        subprocess.run(['git', 'add', 'inventory-snapshot.json', 'sales-velocity.json', 'inventory-history.json', 'payroll-live.json', 'cost-catalog.json'], check=True)
        subprocess.run(['git', '-c', 'user.name=sync-bot', '-c', 'user.email=nguyentheminh0610@gmail.com',
                        'commit', '-m', f'Dong bo ton kho + toc do ban {stamp} (tu dong)',
                        '--quiet'], check=True)
        subprocess.run(['git', 'push', 'origin', 'main', '--quiet'], check=True)
        print('Đã push — Vercel sẽ tự deploy.')

if __name__ == '__main__':
    main()
