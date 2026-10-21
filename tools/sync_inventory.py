#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chụp tồn kho hiện tại từ API Sapo -> inventory-snapshot.json (gốc repo).

Sổ Vận Hành đọc file này để tính "ngày còn bán" = tồn ÷ tốc độ bán của kỳ đang
xem. Chạy lại khi muốn cập nhật số tồn (rồi commit + push để web nhận):
    python3 tools/sync_inventory.py && git add inventory-snapshot.json && git commit -m "Cap nhat ton kho" && git push

Nguồn key: ~/.config/sapo/credentials.json; Cloudflare chặn UA lạ -> giả UA Chrome.
Chỉ lấy variant THƯỜNG (type != combo) — tồn combo là số dẫn xuất từ SKU con.
"""
import json, subprocess, os, datetime

CRED = os.path.expanduser('~/.config/sapo/credentials.json')
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')

def api(store, key, sec, path):
    r = subprocess.run(['curl', '-sf', '-u', f'{key}:{sec}',
                        '-H', f'User-Agent: {UA}', '-H', 'Accept: application/json',
                        f'https://{store}{path}'], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f'curl lỗi {r.returncode} cho {path}')
    return json.loads(r.stdout)

def main():
    cred = json.load(open(CRED))
    store, key, sec = cred['store'], cred['api_key'], cred['api_secret']
    inv = {}
    page = 1
    while True:
        data = api(store, key, sec, f'/admin/variants.json?limit=250&page={page}')
        rows = data.get('variants', [])
        if not rows:
            break
        for v in rows:
            sku = (v.get('sku') or '').strip()
            if not sku or (v.get('type') == 'combo'):
                continue
            q = v.get('inventory_quantity')
            inv[sku] = int(q) if q is not None else 0
        page += 1
    out = {
        'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
        'inventory': inv,
    }
    out_path = os.path.join(os.path.dirname(__file__), '..', 'inventory-snapshot.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print(f'OK -> inventory-snapshot.json: {len(inv)} SKU, tổng {sum(inv.values())} cái')

if __name__ == '__main__':
    main()
