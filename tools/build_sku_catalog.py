#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sinh sku-catalog.json cho Sổ Vận Hành từ API Sapo (private app key).

Nguồn: ~/.config/sapo/credentials.json  {store, api_key, api_secret}
LƯU Ý: Cloudflare của Sapo chặn User-Agent lạ (403 mã 1010) — phải giả UA Chrome.

Kết quả (đặt ở gốc repo, deploy cùng web):
{
  "generatedAt": "...",
  "variants": { "<SKU đầy đủ>": { "name": "<tên hiển thị>", "size": "M", "type": "normal|combo" } },
  "combos":   { "<SKU combo đầy đủ>": [ { "sku": "<SKU con>", "qty": 1 }, ... ] }
}

"name" lấy từ option1 của variant trên Sapo (vd. "Chất Lông-Caro Hồng") — đây
chính là tên mẫu/phân loại mà dashboard hiển thị; SP không có phân loại
(option1 = "Default Title") thì dùng tên sản phẩm. "size" = option2.

Chạy lại bất kỳ lúc nào shop thêm SP/combo mới:  python3 tools/build_sku_catalog.py
"""
import json, subprocess, sys, os, datetime

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

    # 1) toàn bộ variants (sku -> tên SP, loại) — products.json kèm variants
    variants = {}           # sku đầy đủ -> {name, type}
    vid2sku = {}            # variant_id -> sku (để tra combo_items)
    page = 1
    while True:
        data = api(store, key, sec, f'/admin/products.json?limit=250&page={page}')
        prods = data.get('products', [])
        if not prods:
            break
        for p in prods:
            for v in (p.get('variants') or []):
                sku = (v.get('sku') or '').strip()
                if not sku:
                    continue
                opt1 = (v.get('option1') or '').strip()
                name = opt1 if opt1 and opt1 != 'Default Title' else (p.get('name') or sku)
                entry = {'name': name, 'type': v.get('type') or 'normal'}
                size = (v.get('option2') or '').strip()
                if size and size != 'Default Title':
                    entry['size'] = size
                variants[sku] = entry
                vid2sku[v['id']] = sku
        page += 1

    # 2) toàn bộ combos -> thành phần
    combos = {}
    page = 1
    while True:
        data = api(store, key, sec, f'/admin/combos.json?limit=250&page={page}')
        rows = data.get('combos', [])
        if not rows:
            break
        for c in rows:
            combo_vid = c.get('variant_id')
            combo_sku = vid2sku.get(combo_vid)
            items = []
            for it in (c.get('combo_items') or []):
                child_sku = (it.get('sku') or vid2sku.get(it.get('variant_id')) or '').strip()
                if child_sku:
                    items.append({'sku': child_sku, 'qty': it.get('quantity') or 1})
            if combo_sku and items:
                combos[combo_sku] = items
                if combo_sku in variants:
                    variants[combo_sku]['type'] = 'combo'
        page += 1

    out = {
        'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
        'variants': variants,
        'combos': combos,
    }
    out_path = os.path.join(os.path.dirname(__file__), '..', 'sku-catalog.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'OK -> sku-catalog.json: {len(variants)} variants, {len(combos)} combos')

if __name__ == '__main__':
    main()
