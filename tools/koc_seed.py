#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nạp dữ liệu KOC lần đầu vào Supabase cho tab "Chấm điểm KOC" của Sổ Vận Hành.

VÌ SAO CÓ FILE NÀY (chốt 29/10/2026): Google Sheet "Bảng Chấm Điểm KOC" KHÔNG
mở công khai (gviz CSV trả HTTP 401) và máy không có credentials Google, nên
script không tự đọc sheet được. Dữ liệu dưới đây được chép từ sheet một lần.

Về lâu dài KHÔNG dùng file này: skill check-koc chạy trên PC sẽ tự đọc TikTok
rồi upsert thẳng vào Supabase 2 ngày/lần. File này chỉ để có số thật mà dựng
và kiểm giao diện ngay.

Chạy:  python3 tools/koc_seed.py          (chỉ kiểm tra, không ghi)
       python3 tools/koc_seed.py --push   (ghi lên Supabase)
"""
import json
import sys
import urllib.request

SB_URL = 'https://dyvublxyrldmmnsrfvpz.supabase.co'
# anon/publishable key — đúng loại Supabase thiết kế để công khai, giống init.js
SB_KEY = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6'
          'ImR5dnVibHh5cmxkbW1uc3JmdnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzU4'
          'MzMsImV4cCI6MjEwNDExMTgzM30.jM3hD0hNMZ5osaZHDDe5PSm9rQ1Jr6IdWFF0VjT1edI')

# ---------------------------------------------------------------------------
# Tab "2.Nhập KOC" — 107 lần chấm điểm, theo đúng thứ tự STT 1..107.
# (tên, điểm, kết quả) với kết quả: D = DUYỆT, K = KHÔNG DUYỆT
# ---------------------------------------------------------------------------
SCORES = [
    ("bon.review4", 90, "D"), ("vluyenafl.13", 45, "K"), ("nghung88k", 95, "D"),
    ("boanj37", 35, "K"), ("khongbocuoc1456", 50, "K"), ("dripplitt", 95, "D"),
    ("haquocchinh2003", 70, "K"), ("zithung07", 95, "D"), ("tr.lam0905", 95, "D"),
    ("phuoc.dat", 90, "D"), ("d_cuong8", 40, "K"), ("kimiriview", 40, "K"),
    ("trvietanh.2004", 100, "D"), ("stuaupinkin", 95, "D"), ("dungphamdzvcl_007", 35, "K"),
    ("chungg2t", 90, "D"), ("trvietanh.2004", 100, "D"), ("ima.pongh_", 100, "D"),
    ("trongkimoutfit", 100, "D"), ("khongiuthemmotaiz1", 90, "D"), ("thangtoiday228", 90, "D"),
    ("thaoanknguyn", 100, "D"), ("awhtun_", 50, "D"), ("_depzaimaso01_", 60, "K"),
    ("quangtruongggggg", 60, "D"), ("thangm75", 95, "D"), ("zch.nek", 85, "D"),
    ("t.zunggm7", 95, "D"), ("_l.cthuy03", 0, "K"), ("vanduc627", 0, "K"),
    ("trueclo11", 95, "D"), ("vinhtot2004", 95, "D"), ("chieuanh_m6", 80, "D"),
    ("duycogang2316", 95, "D"), ("dtphuong2307", 55, "K"), ("ngovancongshop01", 55, "D"),
    ("ouishop20", 100, "D"), ("chuong.vibes", 75, "D"), ("trvietanh.2004", 100, "D"),
    ("nguocmatnhindoiii7777", 35, "K"), ("i.am_dsd", 90, "D"), ("buitaidaily", 100, "D"),
    ("tinhmacdo", 100, "D"), ("tran_hoi_m62", 95, "D"), ("chien_2025", 50, "K"),
    ("xuantuyenreview", 95, "D"), ("hoanghip160506", 85, "D"), ("huy_tapphoido", 100, "D"),
    ("chuong.vibes", 0, "K"), ("manhxuanm7", 95, "D"), ("duin303", 90, "D"),
    ("minh.duc600", 90, "D"), ("phumynguyendzaff", 95, "D"), ("emphuonganhh", 90, "D"),
    ("vanduc627", 0, "K"), ("_l.cthuy03", 0, "K"), ("nqoc.mahn", 50, "K"),
    ("thanhlendo22", 85, "D"), ("huaquangduong", 100, "D"), ("kienchung24", 35, "K"),
    ("kimhaostore08", 95, "D"), ("tmuiudau18", 80, "D"), ("tuanfunyboyy06", 75, "K"),
    ("bincoconut254", 75, "K"), ("thaonamthugian", 75, "D"), ("toanka98_", 95, "D"),
    ("giakhuong2205", 80, "D"), ("taphoahilo", 85, "D"), ("quyen.rabbit", 45, "K"),
    ("cua.hangtaphoa.online", 60, "K"), ("tanhmeao", 60, "K"), ("tungdepzaiivkl", 100, "D"),
    ("sanganhreview", 65, "K"), ("luansansalek2", 95, "D"), ("dkhanhrv", 95, "D"),
    ("lincuti", 95, "D"), ("onibao.1797", 30, "K"), ("daitayto.no1", 95, "D"),
    ("ngwuanpr", 85, "D"), ("huyenday.02", 95, "D"), ("ligthong", 0, "K"),
    ("chungquanao", 55, "K"), ("panpan.103", 45, "K"), ("huyhoangaffiliate", 90, "D"),
    ("dt10904", 95, "D"), ("maymansetoivoit", 45, "K"), ("haidangfit999", 55, "K"),
    ("v.cy.th", 0, "K"), ("hoangthehaim8", 95, "D"), ("c.thng9462", 85, "D"),
    ("t.quiiz", 85, "D"), ("shop.thoi.trang38", 75, "K"), ("taothao2410", 90, "D"),
    ("qnud_", 100, "D"), ("huyhoanggg999", 80, "D"), ("taphoa.anvuong", 0, "K"),
    ("qhuy_2901", 85, "D"), ("thegoldenera88", 0, "K"), ("vo_thanh_longg", 95, "D"),
    ("nguyen.2066", 95, "D"), ("dtthanh14", 0, "K"), ("quyetm72", 95, "D"),
    ("tranthaitho05", 95, "D"), ("_hoangphi_2803", 0, "K"), ("phvannghia_n", 70, "K"),
    ("lanlaplanhhh", 90, "D"), ("uocduoc1000fl14", 75, "K"),
]

# ---------------------------------------------------------------------------
# Tab "3.Quản lý Book" — theo book_stt (= thứ tự dòng DUYỆT).
# book_stt: (mã SKU đã gửi hoặc None, trạng thái đăng bài)
# trạng thái: 'da_dang' | 'da_nhan_chua_dang' | 'dang_giao' | None (chưa rõ)
# ---------------------------------------------------------------------------
BOOK = {
    1: ("CL01", "da_dang"), 2: (None, "da_dang"), 3: (None, None),
    4: ("CL07", "da_dang"), 5: ("CL06", "da_dang"), 6: (None, None),
    7: (None, "da_dang"), 8: ("CL01", "da_dang"), 9: ("CL07", "da_dang"),
    10: (None, "da_dang"), 11: ("CL01", "da_dang"), 12: (None, "da_dang"),
    13: ("CL01", "da_dang"), 14: ("CL03", "da_dang"), 15: ("CL11", "da_dang"),
    16: ("CL01", "da_dang"), 17: ("CL01", "da_dang"), 18: (None, None),
    19: ("CL11", "da_dang"), 20: (None, "da_dang"), 21: ("CL03", "da_dang"),
    22: ("CL01", "da_dang"), 23: ("CL01", "da_dang"), 24: (None, None),
    25: ("CL05", "da_dang"), 26: ("CL08", "da_dang"), 27: (None, None),
    28: (None, "da_dang"), 29: ("CL03", "da_dang"), 30: ("CL07", "da_dang"),
    31: ("CL06", "da_dang"), 32: ("CL06", "da_dang"), 33: ("CL01,CL07", "da_dang"),
    34: ("CL07", "da_dang"), 35: (None, "da_dang"), 36: ("CL01", "da_dang"),
    37: ("CL01,CL08", "da_dang"), 38: ("CL06", "da_dang"),
    39: ("CL01,CL06,CL07", "da_dang"), 40: ("CL08", None),
    41: ("CL01,CL08", "da_dang"), 42: ("CL01", "da_dang"), 43: ("CL01", "da_dang"),
    44: ("CL01", "da_dang"), 45: ("CL07", "da_dang"), 46: ("CL01", "da_dang"),
    47: ("CL01", "da_dang"), 48: ("CL01", "da_dang"), 49: (None, None),
    50: ("CL01", "da_dang"), 51: ("CL01,CL07", "da_dang"), 52: ("CL01,CL08", "da_dang"),
    53: ("CT10,CT09,CT08", "da_dang"), 54: ("CL05", "da_dang"), 55: ("CL09", "da_dang"),
    56: ("CL05", "da_dang"), 57: ("CL01", "da_dang"), 58: ("CL01", "da_nhan_chua_dang"),
    59: ("CL04", "da_dang"), 60: ("CL01", "da_dang"),
    61: ("CL06,CL01", "da_dang"), 62: ("CL06", "da_nhan_chua_dang"),
    63: ("CL01", "da_nhan_chua_dang"), 64: ("CL01", "da_nhan_chua_dang"),
    65: ("CL06,CL01", "dang_giao"), 66: ("CL03", "dang_giao"),
    67: ("CL01", "dang_giao"), 68: ("CL08,CL07", "da_nhan_chua_dang"),
    69: ("CL01", "dang_giao"),
}

# ---------------------------------------------------------------------------
# Video đã lấy được từ /insights/video-analysis (kỳ 27/9–26/10/2026).
# (koc, content_id, ngay_dang, luot_xem, so_don, gmv)
# ---------------------------------------------------------------------------
CONTENTS = [
    ("zithung07",      "7686745560749231381", "2026-09-18", 100900,  64, 11700000),
    ("trvietanh.2004", "7592922787950513426", "2026-01-08",  14300,  26,  5100000),
    ("stuaupinkin",    "7689289319982320948", "2026-09-25",  15100,   7,  1600000),
    ("chungg2t",       "7601925790137109778", "2026-02-02",   6000,  14,  2800000),
    ("ima.pongh_",     "7579581231554252053", "2025-12-03",  95400, 133, 23800000),
    ("awhtun_",        "7690166818752711943", "2026-09-27",  31600,  10,  1600000),
    ("ouishop20",      "7694333918618733844", "2026-10-08",  15700,  10,  2100000),
    ("huy_tapphoido",  "7689830475115810055", "2026-09-26",  66500,  32,  6500000),
    ("huy_tapphoido",  "7689826921135279367", "2026-09-26",  19200,  21,  3700000),
    ("huy_tapphoido",  "7690178666340404487", "2026-09-27",  14200,  10,  1800000),
]


def load_costs():
    with open('cost-catalog.json', encoding='utf-8') as f:
        return json.load(f)['cost']


def build():
    costs = load_costs()
    scores, rank, problems = [], 0, []

    # PostgREST doi MOI dong trong 1 lo phai co CUNG bo khoa (loi PGRST102
    # "All object keys must match"), nen luon khai bao du cac truong, thieu
    # thi de None.
    for i, (name, diem, kq) in enumerate(SCORES, start=1):
        row = {
            'dedup_key': 'nhapkoc|%d' % i,
            'stt': i,
            'koc_username': name.strip(),
            'diem': diem,
            'ket_qua': 'DUYỆT' if kq == 'D' else 'KHÔNG DUYỆT',
            'book_stt': None,
            'sku_gui': None,
            'gia_von_mau': None,
            'trang_thai_mau': None,
            'da_len_bai': None,
        }
        if kq == 'D':
            rank += 1
            row['book_stt'] = rank
            sku, trang_thai = BOOK.get(rank, (None, None))
            if sku:
                row['sku_gui'] = sku
                total = 0
                for m in sku.split(','):
                    if m not in costs:
                        problems.append('thieu gia von: %s (book_stt %d)' % (m, rank))
                        total = None
                        break
                    total += costs[m]
                if total is not None:
                    row['gia_von_mau'] = total
            if trang_thai:
                row['trang_thai_mau'] = trang_thai
                row['da_len_bai'] = (trang_thai == 'da_dang')
        scores.append(row)

    contents = []
    for koc, cid, ngay, view, don, gmv in CONTENTS:
        contents.append({
            'dedup_key': cid, 'content_id': cid, 'loai': 'video',
            'koc_username': koc, 'ngay_dang': ngay, 'luot_xem': view,
            'so_don': don, 'gmv': gmv,
            'link': 'https://www.tiktok.com/@%s/video/%s' % (koc, cid),
        })
    return scores, contents, rank, problems


def check(scores, contents, rank, problems):
    ok = True
    def want(cond, msg):
        nonlocal ok
        print(('  OK  ' if cond else '  SAI ') + msg)
        if not cond:
            ok = False
    print('KIEM TRA TRUOC KHI DAY:')
    want(len(SCORES) == 107, 'tab 2 co 107 lan cham diem (thuc te %d)' % len(SCORES))
    want(rank == 69, 'so dong DUYET = 69, khop so dong Book (thuc te %d)' % rank)
    want(len(BOOK) == 69, 'bang BOOK co 69 muc (thuc te %d)' % len(BOOK))
    want(set(BOOK) == set(range(1, 70)), 'book_stt lien tuc 1..69 khong thieu')
    want(len(contents) == 10, 'co 10 video (thuc te %d)' % len(contents))
    want(not problems, 'khong co ma SKU thieu gia von')
    for p in problems:
        print('      -> ' + p)
    # doi chieu vai moc da kiem tay tren sheet
    by_stt = {r['book_stt']: r for r in scores if 'book_stt' in r}
    want(by_stt[58]['koc_username'] == 'hoangthehaim8'
         and by_stt[58]['trang_thai_mau'] == 'da_nhan_chua_dang',
         'book_stt 58 = hoangthehaim8 / da nhan chua dang')
    want(by_stt[69]['koc_username'] == 'lanlaplanhhh'
         and by_stt[69]['trang_thai_mau'] == 'dang_giao',
         'book_stt 69 = lanlaplanhhh / dang giao')
    want(by_stt[8]['gia_von_mau'] == 56360, 'book_stt 8 (stuaupinkin) gia von 56.360')
    chua_dang = [r['koc_username'] for r in scores
                 if r.get('trang_thai_mau') == 'da_nhan_chua_dang']
    want(len(chua_dang) == 5, 'dung 5 KOC da nhan mau chua dang: ' + ', '.join(chua_dang))
    dang_giao = [r['koc_username'] for r in scores
                 if r.get('trang_thai_mau') == 'dang_giao']
    want(len(dang_giao) == 4, 'dung 4 KOC dang giao: ' + ', '.join(dang_giao))
    duyet = sum(1 for r in scores if r['ket_qua'] == 'DUYỆT')
    print('  ---  %% duyet = %d/%d = %.1f%%' % (duyet, len(scores), duyet * 100.0 / len(scores)))
    return ok


def push(table, rows):
    body = json.dumps(rows, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        SB_URL + '/rest/v1/' + table + '?on_conflict=dedup_key',
        data=body, method='POST',
        headers={'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY,
                 'Content-Type': 'application/json',
                 'Prefer': 'resolution=merge-duplicates,return=minimal'})
    with urllib.request.urlopen(req, timeout=60) as r:
        print('  %s: HTTP %d, day %d dong' % (table, r.status, len(rows)))


if __name__ == '__main__':
    scores, contents, rank, problems = build()
    ok = check(scores, contents, rank, problems)
    if '--push' not in sys.argv:
        print('\n(chi kiem tra — them --push de ghi len Supabase)')
    elif not ok:
        print('\nCO LOI -> KHONG day len Supabase.')
        sys.exit(1)
    else:
        print('\nDang day len Supabase...')
        push('koc_scores', scores)
        push('koc_contents', contents)
        print('Xong.')
