#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nạp số liệu KOC theo kênh (video / LIVE) vào bảng koc_channel_stats.

NGUỒN (lấy 29/10/2026, kỳ 30 ngày 28/9–28/10/2026): API nội bộ mà chính trang
Affiliate Center dùng —
  POST /api/v1/oec/affiliate/compass/transaction/detail_list/get
  detail_list_type: 1=nhà sáng tạo, 2=sản phẩm, 3=video, 4=buổi LIVE
  khoá tham số: creator_list_params / video_list_params_v2 / live_list_params_v2
  page_size TỐI ĐA 100 (200 trở lên là "internal error")
  trả về: data.<x>_list_segments[0].<x>_performances[] + .total

Cách lấy: chạy JS trong trang (Claude in Chrome) để gọi lại API bằng URL đã ký
sẵn của trang, gộp theo từng KOC, rồi đọc kết quả ra. KHÔNG đẩy thẳng từ trình
duyệt sang Supabase được — CSP của TikTok chặn cả fetch lẫn XHR ra ngoài.

Kỳ 30 ngày: 1.365 video + 479 buổi LIVE, 87 KOC có GMV > 0, tổng 319.253.353đ.
Dưới đây là 54 KOC đứng đầu (chiếm ~98% GMV); 33 KOC còn lại tổng chỉ 6,2tr.

Chạy:  python3 tools/koc_channel_seed.py          (chỉ kiểm tra)
       python3 tools/koc_channel_seed.py --push   (ghi lên Supabase)
"""
import json
import sys
import urllib.request

SB_URL = 'https://dyvublxyrldmmnsrfvpz.supabase.co'
SB_KEY = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6'
          'ImR5dnVibHh5cmxkbW1uc3JmdnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzU4'
          'MzMsImV4cCI6MjEwNDExMTgzM30.jM3hD0hNMZ5osaZHDDe5PSm9rQ1Jr6IdWFF0VjT1edI')

KY_NGAY = 30
KY_DEN = '2026-10-28'

# koc | video: so_luong, gmv, don, view, hoa_hong | live: so_luong, gmv, don, view, hoa_hong
RAW = """
ngunghoatdong009|5|1292040|6|9877|86331|10|97077233|577|2021208|8691612
nguyenanhtuan264209|5|37405461|214|561020|3270863|0|0|0|0|0
ima.pongh_|17|28398904|159|251662|1680548|0|0|0|0|0
zithung07|71|18451690|103|207487|1142095|0|0|0|0|0
huy_tapphoido|35|14896752|79|141055|1115020|7|430534|3|1730522|38787
maihungreview|34|11223260|64|1253952|889221|2|813100|4|23292|73180
thaonamthugian|10|652000|4|16160|58680|46|6987075|41|1047516|627261
vinhtot2004|0|0|0|0|0|12|6437920|39|162214|578455
giasua777|5|6390300|35|17136|501859|0|0|0|0|0
stuaupinkin|26|6194788|35|125714|413496|0|0|0|0|0
dn_6123|38|5788686|35|163662|333843|0|0|0|0|0
tranthaitho05|7|5418137|28|22978|434034|0|0|0|0|0
trvietanh.2004|7|5083837|26|17909|325233|1|0|0|25858|0
kinkongmegai|2|5020859|28|61970|401127|0|0|0|0|0
nguyenngoctuan.02|2|4869652|28|37512|389409|0|0|0|0|0
chungg2t|35|4787397|26|35617|407663|0|0|0|0|0
xuantuyenreview|1|0|0|293|0|34|4058555|23|3111730|365273
vr.sad1|1|3429497|21|25501|149495|0|0|0|0|0
met7mot.review|40|2740795|13|7226|233805|0|0|0|0|0
giakhuong2205|52|2314200|11|81966|98034|0|0|0|0|0
tr.lam0905|7|2291920|12|15442|199973|8|0|0|499652|0
dkhanhrv|7|2201946|10|17254|196915|0|0|0|0|0
ouishop20|1|2059580|10|15976|133247|24|0|0|637973|0
chungquanao|24|1890400|10|21275|111300|0|0|0|0|0
awhtun_|2|1625160|10|40682|146247|0|0|0|0|0
caolephuocdat|6|1331240|8|15999|109672|0|0|0|0|0
hdriuvi|11|1330008|7|9228|109404|0|0|0|0|0
hanhkhongsau06|5|1313907|8|17488|98230|0|0|0|0|0
huaquangduong|5|471240|2|3604|42411|15|1233240|6|235248|110994
huyhoanggg999|6|1139900|7|17440|63471|0|0|0|0|0
dtphuong2307|51|1089480|7|20628|105253|3|0|0|34641|0
trongkimoutfit|9|0|0|5154|0|46|1016997|7|1699936|91512
nguyenthanhtung_2006|3|999200|5|3763|89910|0|0|0|0|0
linhegg_|2|935080|5|3473|84157|0|0|0|0|0
sometime.official|4|628500|3|11312|56565|2|925136|5|15349|84384
bachm7nenmacgi|16|845000|5|7076|76050|16|0|0|165258|0
tmuiudau18|17|801964|4|19389|44039|0|0|0|0|0
chienlew86|11|801170|5|10034|51326|0|0|0|0|0
giangmuagi|23|676300|4|3191|60840|0|0|0|0|0
theminhhacao|13|650700|4|1431|58545|0|0|0|0|0
thangpv.tb|3|633000|3|1191|39270|0|0|0|0|0
tran_hoi_m62|1|0|0|90|0|15|612700|4|390203|52386
tram_m55|21|612200|4|17937|28080|0|0|0|0|0
_npbinhf_07|45|523983|3|10489|44431|0|0|0|0|0
namdayc|2|493480|3|2441|44413|0|0|0|0|0
gaanmac|6|492000|2|4883|44280|0|0|0|0|0
thegoldenera88|11|486930|2|4014|44280|0|0|0|0|0
thangtoiday228|7|479000|3|9773|14370|0|0|0|0|0
ratiomin|19|455000|3|5309|31650|0|0|0|0|0
thanhlendo22|0|0|0|0|0|28|418122|2|868998|37631
quansizel|2|366300|2|55|32967|0|0|0|0|0
d.hoang0909|2|338000|2|614|20280|0|0|0|0|0
khongiuthemmotaiz1|1|338000|2|6275|30420|0|0|0|0|0
vh.ver2|2|338000|2|809|30420|0|0|0|0|0
"""


def build():
    rows, kocs = [], []
    for line in RAW.strip().splitlines():
        p = line.split('|')
        koc = p[0]
        kocs.append(koc)
        nums = [int(x) for x in p[1:]]
        for kenh, off in (('video', 0), ('live', 5)):
            n, gmv, don, view, hh = nums[off:off + 5]
            # bỏ dòng kênh hoàn toàn rỗng cho gọn, nhưng GIỮ dòng có nội dung mà
            # chưa ra đơn — đó chính là KOC làm mà không hiệu quả, cần thấy
            if n == 0 and gmv == 0:
                continue
            rows.append({
                'dedup_key': '%s|%s|%d' % (koc, kenh, KY_NGAY),
                'koc_username': koc, 'kenh': kenh,
                'ky_ngay': KY_NGAY, 'ky_den': KY_DEN,
                'so_noi_dung': n, 'gmv': gmv, 'so_don': don,
                'luot_xem': view, 'hoa_hong': hh,
            })
    return rows, kocs


def check(rows, kocs):
    ok = True
    def want(c, m):
        nonlocal ok
        print(('  OK  ' if c else '  SAI ') + m)
        if not c:
            ok = False
    print('KIEM TRA:')
    want(len(kocs) == 54, 'co 54 KOC (thuc te %d)' % len(kocs))
    want(len(set(kocs)) == len(kocs), 'khong co KOC nao lap lai')
    want(len(set(r['dedup_key'] for r in rows)) == len(rows), 'dedup_key khong trung')
    v = [r for r in rows if r['kenh'] == 'video']
    l = [r for r in rows if r['kenh'] == 'live']
    tong = sum(r['gmv'] for r in rows)
    want(abs(tong - 313007455) < 20_000_000,
         'tong GMV %s d, hop ly so voi 319,2tr cua ca 87 KOC' % format(tong, ','))
    top = max(rows, key=lambda r: r['gmv'])
    want(top['koc_username'] == 'ngunghoatdong009' and top['kenh'] == 'live',
         'KOC manh nhat la ngunghoatdong009 qua kenh LIVE')
    print('  ---  %d dong (%d video, %d live) | GMV video %s | GMV live %s'
          % (len(rows), len(v), len(l),
             format(sum(r['gmv'] for r in v), ','), format(sum(r['gmv'] for r in l), ',')))
    return ok


def push(rows):
    body = json.dumps(rows, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        SB_URL + '/rest/v1/koc_channel_stats?on_conflict=dedup_key',
        data=body, method='POST',
        headers={'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY,
                 'Content-Type': 'application/json',
                 'Prefer': 'resolution=merge-duplicates,return=minimal'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            print('  koc_channel_stats: HTTP %d, day %d dong' % (r.status, len(rows)))
            return True
    except urllib.error.HTTPError as e:
        msg = e.read().decode('utf-8')[:300]
        print('  LOI HTTP %d: %s' % (e.code, msg))
        if 'koc_channel_stats' in msg or e.code == 404:
            print('  => Bang chua ton tai. Chay scripts/koc-channel-stats.sql tren Supabase truoc.')
        return False


if __name__ == '__main__':
    rows, kocs = build()
    ok = check(rows, kocs)
    if '--push' not in sys.argv:
        print('\n(chi kiem tra — them --push de ghi len Supabase)')
    elif not ok:
        print('\nCO LOI -> khong day.')
        sys.exit(1)
    else:
        print('\nDang day...')
        sys.exit(0 if push(rows) else 1)
