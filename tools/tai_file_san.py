#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
TẢI file báo cáo từ Shopee Seller + TikTok Shop Seller bằng Playwright — CHẠY
TRÊN PC TRỰC, 0 token. Chốt 31/10/2026. Xem
.claude/shared/reference_tai_file_tu_dong.md và
.claude/shared/reference_auto_data_pull_pattern.md.

Vì sao PHẢI trình duyệt thật: nút "Xuất/Export" của sàn chạy JS ký chữ ký
(X-Bogus...) trong phiên đăng nhập rồi mới sinh link tải — Python thuần có
cookie cũng KHÔNG tái tạo được. Playwright mở Chrome thật nên trang tự ký.

================================  CÀI 1 LẦN TRÊN PC  ===========================
  py -m pip install playwright openpyxl
  py -m playwright install chromium
  # Đăng nhập 1 lần vào profile của script cho TỪNG sàn (mở cửa sổ, tự login):
  py tools\tai_file_san.py --login tiktok
  py tools\tai_file_san.py --login shopee
===============================================================================

Chạy thật (Task Scheduler gọi):
  py tools\tai_file_san.py --lich thang --downloads "%USERPROFILE%\Downloads\svh-2026-10"
  py tools\tai_file_san.py --lich tuan  --downloads "%USERPROFILE%\Downloads\svh-tuan-2026-W44"

Mỗi file tải xong rơi vào --downloads (giữ tên gốc do sàn đặt). Sau đó gọi
xep_file_vao_drive.py để xếp lên Drive.

Mất đăng nhập / sàn đổi giao diện / 1 file lỗi → gửi Telegram báo + thoát mã 1,
KHÔNG fail âm thầm.

⚠ PHẦN CẦN CHỐT TRÊN PC (site-specific, không test được từ Mac):
  - chon_ky_*(): chọn khoảng ngày trên bộ lịch của từng sàn. Giao diện lịch hay
    đổi; phải mở trang thật trên PC, xem DOM rồi chốt thao tác. Mặc định hiện
    tại là best-effort + chụp màn hình để người dựng kiểm.
  - Nút Xuất: script thử bấm theo CHỮ trong registry.nut_text (bền hơn CSS).
"""
import argparse
import datetime
import json
import os
import sys
import time
import urllib.parse
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY = os.path.join(REPO, 'tools', 'registry_tai_file.json')

# Profile Chrome riêng của script, 1 cái cho mỗi sàn (giữ phiên đăng nhập).
# CHỐT 18/11/2026: dùng CHUNG Chrome riêng của PC (profile koc-chrome-profile, chạy bằng
# Google Chrome cài sẵn -- Chromium của Playwright không khởi động được trên PC này).
# Cả TikTok lẫn Shopee đăng nhập vào cùng 1 profile; KHÔNG chạy cùng lúc với
# task "Claude - Dong bo KOC" (Chrome khoá profile).
PROFILE_DIR = os.environ.get(
    'KOC_PROFILE_DIR', os.path.join(os.path.expanduser('~'), 'koc-chrome-profile'))

TG_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TG_CHAT = os.environ.get('TELEGRAM_CHAT_ID', '')

# Dấu hiệu "chưa đăng nhập" trong URL khi mở trang seller.
LOGIN_HINTS = {
    'tiktok': ('/account/login', 'login', 'passport'),
    'shopee': ('/login', '/signin', 'subaccount/login'),
}


def bao_telegram(msg):
    print('[TELEGRAM] ' + msg)
    if not (TG_TOKEN and TG_CHAT):
        print('  (bỏ qua gửi — chưa đặt TELEGRAM_BOT_TOKEN/CHAT_ID)')
        return
    try:
        data = urllib.parse.urlencode({'chat_id': TG_CHAT, 'text': msg}).encode()
        urllib.request.urlopen(
            'https://api.telegram.org/bot%s/sendMessage' % TG_TOKEN, data=data, timeout=20)
    except Exception as e:
        print('  (gửi Telegram lỗi: %s)' % e)


def doc_registry():
    with open(REGISTRY, encoding='utf-8') as f:
        return json.load(f)


def profile_dir(san=None):
    os.makedirs(PROFILE_DIR, exist_ok=True)
    return PROFILE_DIR


def la_trang_dang_nhap(url, san):
    u = (url or '').lower()
    return any(h in u for h in LOGIN_HINTS.get(san, ()))


# --------------------------------------------------------------------------
#  TIKTOK — thao tác ĐÃ KIỂM TRÊN GIAO DIỆN THẬT 18/11/2026
#  Bộ lịch của TikTok Seller (class "p-picker-*"): mở ô "Từ", bấm mũi tên lùi tháng
#  tới đúng tháng, bấm ngày đầu rồi ngày cuối (cùng 1 khung bên trái) → Áp dụng.
# --------------------------------------------------------------------------
import re


def dong_popup(page):
    """Tắt các bong bóng/hộp giới thiệu tính năng của TikTok (chặn click)."""
    for _ in range(5):
        got = False
        for t in ('Đã hiểu', 'Bỏ qua', 'Để sau'):
            # hộp thoại hiện ra trễ vài giây; nút không phải lúc nào cũng có role=button
            for loc in (page.locator('.core-modal-wrapper').get_by_text(t, exact=True),
                        page.get_by_text(t, exact=True)):
                try:
                    loc.first.click(timeout=1500)
                    got = True
                    break
                except Exception:
                    pass
        if not got:
            break
        page.wait_for_timeout(600)


def tt_chon_khoang_ngay(page, tu, den, o_nhap='input[placeholder="Từ"]'):
    """Chọn khoảng ngày [tu, den] (datetime.date, CÙNG 1 THÁNG, quá khứ) trên bộ lịch
    TikTok đang mở sẵn ô "Từ". Ném lỗi nếu không chọn được."""
    hdr_loc = page.locator('[class*="-picker-header-value"]')
    for lan in range(3):  # lịch có thể đã tự mở sẵn → không bấm nếu đã thấy
        try:
            hdr_loc.first.wait_for(state='visible', timeout=2500)
            break
        except Exception:
            (o_nhap(page) if callable(o_nhap) else page.locator(o_nhap)).first.click(timeout=8000)
            page.wait_for_timeout(800)
    hdr_loc.first.wait_for(state='visible', timeout=8000)
    muc_tieu = tu.year * 12 + tu.month
    for _ in range(30):
        hdr = page.locator('[class*="-picker-header-value"]').first.inner_text().strip()  # "10/2026"
        m, y = [int(x) for x in re.findall(r'\d+', hdr)[:2]]
        hien_tai = y * 12 + m
        if hien_tai == muc_tieu:
            break
        icons = page.locator('div[class$="-picker-header"]').first.locator(
            '[class*="-picker-header-icon"]:not([class*="-icon-hidden"])')
        if hien_tai > muc_tieu:
            icons.nth(1).click()          # ‹ lùi 1 tháng (icon 0 là « lùi 1 năm)
        else:
            raise RuntimeError('Bộ lịch đang ở tháng %s, trước tháng cần chọn' % hdr)
        page.wait_for_timeout(300)
    else:
        raise RuntimeError('Không lùi được bộ lịch tới tháng %02d/%d' % (tu.month, tu.year))
    # TikTok dùng 2 tiền tố class tuỳ trang: "p-picker-*" (đơn hàng) / "core-picker-*" (trả hàng)
    body = page.locator('[class$="-picker-body"]').first
    for ngay in (tu.day, den.day):
        body.locator('[class*="-picker-cell-in-view"] [class*="-picker-date-value"]',
                     has_text=re.compile(r'^%02d$' % ngay)).first.click(timeout=8000)
        page.wait_for_timeout(400)
    # xác nhận ô hiển thị đúng ngày đầu vừa chọn
    if callable(o_nhap):   # ô tuỳ biến (không phải <input>) — bỏ bước đọc lại giá trị
        return
    gia_tri = page.locator(o_nhap).first.input_value()
    if tu.strftime('%d/%m/%Y') not in gia_tri:
        raise RuntimeError('Ô ngày hiện "%s", mong đợi bắt đầu %s' % (gia_tri, tu.strftime('%d/%m/%Y')))


def tt_ten_file_lich_su(page):
    """Tên các file đang có trong "Lịch sử xuất dữ liệu" (để biết file nào là MỚI)."""
    return set(page.evaluate(r"""() => [...document.querySelectorAll('*')]
        .filter(e => e.children.length === 0 && /\.(xlsx|csv)$/i.test((e.textContent||'').trim()))
        .map(e => e.textContent.trim())"""))


def tt_moi_tao(ten, bat_dau):
    """File lịch sử có giờ tạo nhúng trong tên ("...-2026-11-18-11:35.xlsx"). Chỉ nhận file
    tạo SAU lúc bấm Xuất (trừ 2 phút) — chống tải nhầm file cũ khi danh sách lịch sử
    chưa kịp hiện lúc chụp `truoc`. Tên không có giờ thì coi là mới (đã lọc bằng set-diff)."""
    m = (re.search(r'(\d{4})-(\d{2})-(\d{2})-(\d{2})[:_](\d{2})', ten)
         or re.search(r'income_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\d{2}', ten))
    if not m:
        return True
    t = datetime.datetime(*[int(x) for x in m.groups()])
    return t >= bat_dau - datetime.timedelta(minutes=2)


def tt_cho_va_tai(page, truoc, downloads, cho_giay=240):
    """Chờ TikTok sinh xong file MỚI trong lịch sử xuất rồi bấm "Tải xuống".
    `truoc` = tt_ten_file_lich_su() chụp TRƯỚC khi bấm Xuất. Trả đường dẫn file đã lưu."""
    bat_dau = datetime.datetime.now()
    han = time.time() + cho_giay
    while time.time() < han:
        page.wait_for_timeout(4000)
        moi = [t for t in tt_ten_file_lich_su(page) - truoc if tt_moi_tao(t, bat_dau)]
        for ten in moi:
            hang = page.locator('tr, div').filter(has_text=ten).filter(
                has=page.get_by_role('button', name=re.compile('Tải xuống'))).last
            if hang.count() == 0:
                continue
            with page.expect_download(timeout=90000) as dl:
                hang.get_by_role('button', name=re.compile('Tải xuống')).first.click()
            d = dl.value
            dest = os.path.join(downloads, d.suggested_filename)
            d.save_as(dest)
            return dest
    raise RuntimeError('TikTok chưa sinh xong file sau %d giây' % cho_giay)


def tt_don_hang(page, tu, den, downloads):
    """TikTok — Tất cả đơn hàng: tab Tất cả → Bộ lọc Thời gian đã tạo → Xuất (Excel)."""
    page.goto('https://seller-vn.tiktok.com/order?tab=all', wait_until='domcontentloaded',
              timeout=60000)
    page.wait_for_timeout(5000)
    dong_popup(page)
    page.wait_for_timeout(2500)
    dong_popup(page)  # có hộp giới thiệu hiện TRỄ sau khi tải xong
    page.get_by_role('button', name='Bộ lọc').first.click(timeout=8000)
    page.wait_for_timeout(1500)
    tt_chon_khoang_ngay(page, tu, den)
    page.get_by_role('button', name='Áp dụng').first.click()
    page.wait_for_timeout(4000)
    page.get_by_role('button', name='Xuất', exact=True).first.click(timeout=8000)
    page.wait_for_timeout(2000)
    # phạm vi = "Đơn hàng đã lọc" (mặc định); định dạng Excel
    page.get_by_text('Excel', exact=True).first.click()
    truoc = tt_ten_file_lich_su(page)
    page.get_by_role('button', name='Xuất', exact=True).last.click()
    return tt_cho_va_tai(page, truoc, downloads)


def tt_nut_icon(page, vi_tri):
    """Trang Trả hàng của TikTok có hàng 3 nút CHỈ CÓ ICON ở thanh công cụ (lọc, sắp xếp,
    tải xuống) — không có chữ nên bấm theo thứ tự trái→phải. vi_tri: 0=lọc, 2=tải xuống."""
    h = page.evaluate_handle(r"""(vt) => {
        const bs = [...document.querySelectorAll('button')].filter(b => {
            const r = b.getBoundingClientRect();
            return b.offsetParent && (b.innerText||'').trim().length <= 5 && b.querySelector('svg')
                   && r.y > 250 && r.y < 460 && r.width < 80;
        }).sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
        return bs.length >= 3 ? bs[vt] : null;
    }""", vi_tri)
    el = h.as_element()
    if el is None:
        raise RuntimeError('không thấy 3 nút icon ở thanh công cụ trang trả hàng')
    return el


def tt_tra_hang(page, tu, den, downloads):
    """TikTok — Đơn trả hàng/hoàn tiền: tab Tất cả → lọc Thời gian tạo → icon tải xuống
    → Excel → Xuất."""
    page.goto('https://seller-vn.tiktok.com/order/return', wait_until='domcontentloaded',
              timeout=60000)
    page.wait_for_timeout(6000)
    dong_popup(page)
    page.wait_for_timeout(2500)
    dong_popup(page)
    page.get_by_text('Tất cả', exact=True).first.click(timeout=8000)
    page.wait_for_timeout(4000)
    tt_nut_icon(page, 0).click()
    page.wait_for_timeout(2000)
    tt_chon_khoang_ngay(page, tu, den)
    page.get_by_role('button', name='Áp dụng').first.click()
    page.wait_for_timeout(4000)
    tt_nut_icon(page, 2).click()
    page.wait_for_timeout(3500)  # ngăn kéo "Xuất đơn hàng" trượt ra chậm
    page.get_by_text('Excel', exact=True).first.click(timeout=15000)
    truoc = tt_ten_file_lich_su(page)
    page.get_by_role('button', name='Xuất', exact=True).last.click()
    return tt_cho_va_tai(page, truoc, downloads)


# Các luồng đã viết riêng theo từng file (khoá = trường "kieu" trong registry).
def tt_tai_chinh(page, tu, den, downloads):
    """TikTok — Tài chính (income_...): Tài chính → Giao dịch → tab Đã quyết toán → Xuất →
    hộp "Chọn phạm vi ngày để xuất" (tối đa 90 ngày) → OK → Xuất → nút "Lịch sử xuất dữ
    liệu" → Tải xuống. (Khoảng ngày của hộp xuất là NGÀY QUYẾT TOÁN — đã kiểm 18/11.)"""
    page.goto('https://seller-vn.tiktok.com/finance/transactions', wait_until='domcontentloaded',
              timeout=60000)
    page.wait_for_timeout(9000)
    dong_popup(page)
    page.wait_for_timeout(1500)
    dong_popup(page)
    page.get_by_text('Đã quyết toán', exact=True).first.click(timeout=8000)
    page.wait_for_timeout(3000)
    page.get_by_role('button', name='Xuất', exact=True).first.click(timeout=8000)
    page.wait_for_timeout(3000)
    tt_chon_khoang_ngay(page, tu, den,
                        o_nhap=lambda pg: pg.get_by_text('Thời gian bắt đầu', exact=True))
    page.get_by_role('button', name='OK', exact=True).first.click(timeout=8000)
    page.wait_for_timeout(1000)
    bat_dau = datetime.datetime.now()
    page.get_by_role('button', name='Xuất', exact=True).last.click(timeout=8000)
    # file mới nằm trong popover "Lịch sử xuất dữ liệu" — mở nó rồi chờ hàng mới
    han = time.time() + 240
    while time.time() < han:
        page.wait_for_timeout(5000)
        try:
            page.get_by_role('button', name=re.compile('Lịch sử xuất dữ liệu')).first.click(timeout=5000)
        except Exception:
            continue
        page.wait_for_timeout(2500)
        for ten in tt_ten_file_lich_su(page):
            if not tt_moi_tao(ten, bat_dau):
                continue
            hang = page.locator('tr, div').filter(has_text=ten).filter(
                has=page.get_by_role('button', name=re.compile('Tải xuống'))).last
            if hang.count() == 0:
                continue
            with page.expect_download(timeout=90000) as dl:
                hang.get_by_role('button', name=re.compile('Tải xuống')).first.click()
            d = dl.value
            dest = os.path.join(downloads, d.suggested_filename)
            d.save_as(dest)
            return dest
    raise RuntimeError('TikTok chưa sinh xong file Tài chính sau 240 giây')


# ---------------------------------------------------------------- SHOPEE (chốt 18/11/2026)
SP_THANG_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
               'september', 'october', 'november', 'december']


def sp_kiem_mat_khau(page):
    """Mục Tài Chính của Shopee đòi nhập mật khẩu. KHÔNG BAO GIỜ nhập hộ — dừng và báo."""
    try:
        if page.get_by_text('nhập mật khẩu Shopee', exact=False).first.is_visible(timeout=1500):
            raise RuntimeError('SHOPEE_HOI_MAT_KHAU')
    except RuntimeError:
        raise
    except Exception:
        pass


def sp_chon_khoang_ngay(page, tu, den, o_nhap):
    """Bộ chọn ngày Shopee (eds-daterange-picker, 2 lịch cạnh nhau). `o_nhap` = locator để
    bấm mở. Nhãn tháng lúc tiếng Việt ("Tháng 10"), lúc tiếng Anh ("October") tuỳ trang."""
    o_nhap.click(timeout=8000)
    page.wait_for_timeout(1000)
    L = '.eds-daterange-picker-panel__body-left'

    def thang_hien_tai():
        txt = ' '.join(page.locator(L + ' .eds-picker-header__label').all_inner_texts()).lower()
        y = int(re.search(r'(20\d\d)', txt).group(1))
        m = re.search(r'th\S*ng\s*(\d+)', txt)
        if m:
            return (y, int(m.group(1)))
        for k, n in enumerate(SP_THANG_EN):
            if n in txt:
                return (y, k + 1)
        raise RuntimeError('không đọc được tháng của bộ chọn ngày: ' + txt)

    muc_tieu = (tu.year, tu.month)
    for _ in range(48):
        cur = thang_hien_tai()
        if cur == muc_tieu:
            break
        nut = '.eds-picker-header__prev' if cur > muc_tieu else '.eds-picker-header__next'
        page.locator(L + ' ' + nut).nth(1).click()   # nút thứ 2 = lùi/tiến 1 THÁNG (nút 1 = 1 năm)
        page.wait_for_timeout(250)
    else:
        raise RuntimeError('không lật được bộ chọn ngày tới %s' % (muc_tieu,))

    def bam_ngay(d, panel):
        page.locator('.eds-daterange-picker-panel__body-%s .eds-date-table__cell-inner' % panel) \
            .get_by_text(str(d.day), exact=True).first.click(timeout=5000)
        page.wait_for_timeout(300)

    bam_ngay(tu, 'left')
    bam_ngay(den, 'left' if (den.year, den.month) == (tu.year, tu.month) else 'right')
    page.wait_for_timeout(800)


def sp_cho_va_tai(page, tien_to, downloads, cho_giay=300, loai_tru=None):
    """Mở "Lịch sử Xuất Báo cáo" của Shopee, chờ hàng báo cáo MỚI có tên bắt đầu bằng
    `tien_to` hết "Đang được xử lý" rồi bấm Tải về. Tên báo cáo có khoảng ngày nhúng trong tên
    (vd Order.all.20261001_20261031.xlsx) nên khớp theo tiền tố đã gồm ngày."""
    han = time.time() + cho_giay
    nut_ds = re.compile('Lịch sử Xuất Báo cáo|Export History|Report History|Lịch sử xuất', re.I)
    while time.time() < han:
        page.wait_for_timeout(4000)
        # Danh sách báo cáo là CHUNG cho mọi loại → luôn mở từ trang Đơn hàng (có nút chữ
        # "Lịch sử Xuất Báo cáo"), tải lại mỗi vòng để thấy trạng thái mới.
        page.goto('https://banhang.shopee.vn/portal/sale/order',
                  wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(5000)
        try:
            page.get_by_text(nut_ds).first.click(timeout=8000)
        except Exception:
            continue
        page.wait_for_timeout(1500)
        h = page.evaluate_handle(r"""(tt) => {
            const re = /^Order\.[A-Za-z_]+\.\d{8}/;
            const leaf = [...document.querySelectorAll('*')].find(e => e.children.length === 0
                && (e.textContent||'').trim().startsWith(tt));
            if (!leaf) return null;
            let r = leaf;
            while (r.parentElement) {
                const n = (r.parentElement.textContent.match(/Order\.[a-z_]+\.\d{8}/g) || []).length;
                if (n > 1) break;
                r = r.parentElement;
            }
            return r;
        }""", tien_to)
        row = h.as_element()
        if row is None:
            continue
        for btn in row.query_selector_all('text=/Tải về|Download/'):
            if btn.is_visible():
                with page.expect_download(timeout=120000) as dl:
                    btn.click()
                d = dl.value
                dest = os.path.join(downloads, d.suggested_filename)
                d.save_as(dest)
                return dest
        # còn "Đang được xử lý" → đóng popover, chờ vòng sau
        page.keyboard.press('Escape')
        page.mouse.click(700, 700)
    raise RuntimeError('Shopee chưa sinh xong báo cáo "%s" sau %d giây' % (tien_to, cho_giay))


def sp_don_hang(page, tu, den, downloads):
    """Shopee — Tất cả đơn hàng: Quản Lý Đơn Hàng → Xuất → chọn khoảng ngày → Xuất →
    Lịch sử Xuất Báo cáo → Tải về (Order.all.YYYYMMDD_YYYYMMDD.xlsx). Khoảng tối đa 31 ngày."""
    page.goto('https://banhang.shopee.vn/portal/sale/order', wait_until='domcontentloaded',
              timeout=60000)
    page.wait_for_timeout(6000)
    page.get_by_role('button', name='Xuất', exact=True).first.click(timeout=10000)
    page.wait_for_timeout(2000)
    o = page.locator('.eds-modal .eds-date-picker__input, .eds-date-picker__input').first
    sp_chon_khoang_ngay(page, tu, den, o)
    page.locator('.eds-modal').get_by_role('button', name='Xuất', exact=True).click(timeout=8000)
    page.wait_for_timeout(2500)
    return sp_cho_va_tai(page, 'Order.all.%s_%s' % (tu.strftime('%Y%m%d'), den.strftime('%Y%m%d')),
                         downloads)


def sp_tra_hang(page, tu, den, downloads):
    """Shopee — Trả hàng/Hoàn tiền: Đơn Trả hàng/Hoàn tiền → tab "Đơn Trả hàng Hoàn tiền" →
    Mở rộng → "Ngày yêu cầu" → Export → Tải về (Order.return_refund.<tu>_<den+1>.xls — Shopee
    cộng thêm 1 ngày ở cuối nên chỉ khớp theo ngày bắt đầu)."""
    page.set_viewport_size({'width': 1400, 'height': 1200})   # bộ chọn ngày xoè xuống dưới
    page.goto('https://banhang.shopee.vn/portal/sale/returnrefundcancel',
              wait_until='domcontentloaded', timeout=60000)
    page.wait_for_timeout(6000)
    b = page.get_by_text('Đã hiểu', exact=True)
    if b.count() and b.first.is_visible():
        b.first.click()
        page.wait_for_timeout(800)
    page.get_by_text('Đơn Trả hàng Hoàn tiền (').first.click(timeout=8000)
    page.wait_for_timeout(2500)
    page.get_by_text('Mở rộng').first.click(timeout=8000)
    page.wait_for_timeout(1500)
    o = page.get_by_text('Vui lòng chọn thời gian yêu cầu').first
    sp_chon_khoang_ngay(page, tu, den, o)
    page.get_by_role('button', name='Export').first.click(timeout=8000)
    page.wait_for_timeout(3000)
    return sp_cho_va_tai(page, 'Order.return_refund.%s_' % tu.strftime('%Y%m%d'), downloads)


LUONG = {'tt_don_hang': tt_don_hang, 'tt_tra_hang': tt_tra_hang, 'tt_tai_chinh': tt_tai_chinh,
         'sp_don_hang': sp_don_hang, 'sp_tra_hang': sp_tra_hang}


def chon_ky(page, san, entry, tu, den):
    """(Giữ cho tương thích) — các file đã có luồng riêng trong LUONG không dùng hàm này."""
    print('    (chưa có luồng riêng — chọn kỳ: %s → %s | HD: %s)'
          % (tu, den, entry['export'].get('chon_ky', '')))
    return False


def bam_nut_xuat(page, nut_text):
    """Bấm nút Xuất/Export theo CHỮ (bền hơn CSS selector). Trả True nếu bấm được."""
    for text in nut_text:
        try:
            loc = page.get_by_role('button', name=text, exact=False)
            if loc.count() > 0:
                loc.first.click(timeout=8000)
                return True
        except Exception:
            pass
        try:
            loc = page.get_by_text(text, exact=False)
            if loc.count() > 0:
                loc.first.click(timeout=8000)
                return True
        except Exception:
            pass
    return False


def tai_mot_file(ctx, san, entry, downloads, tu, den, anh_loi_dir):
    """Chạy luồng riêng của file (khoá "kieu" trong registry, hàm nằm trong LUONG).
    Trả (ok, thong_bao). File chưa có luồng: tuỳ chọn thì bỏ qua êm, bắt buộc thì báo lỗi."""
    kieu = entry.get('kieu')
    if kieu not in LUONG:
        if entry.get('bat_buoc'):
            return False, 'chưa có luồng tải tự động cho "%s"' % entry['mo_ta']
        return True, '(bỏ qua — chưa có luồng tự động, file tuỳ chọn)'
    page = ctx.new_page()
    page.set_viewport_size({'width': 1400, 'height': 900})
    try:
        last = None
        for lan in (1, 2):   # thử tối đa 2 lần: sàn đôi khi chậm/hiện hộp thoại bất chợt
            try:
                dest = LUONG[kieu](page, tu, den, downloads)
                if la_trang_dang_nhap(page.url, san):
                    return False, 'MẤT ĐĂNG NHẬP %s (bị đẩy về %s)' % (san, page.url)
                return True, os.path.basename(dest)
            except Exception as e:
                last = e
                if la_trang_dang_nhap(page.url, san):
                    return False, 'MẤT ĐĂNG NHẬP %s (bị đẩy về %s)' % (san, page.url)
                try:
                    os.makedirs(anh_loi_dir, exist_ok=True)
                    page.screenshot(path=os.path.join(anh_loi_dir, '%s-lan%d.png' % (entry['id'], lan)))
                except Exception:
                    pass
        return False, 'lỗi khi tải "%s": %s' % (entry['mo_ta'], str(last)[:300])
    finally:
        try:
            page.close()
        except Exception:
            pass


def ky_tu_lich(lich):
    """Tính khoảng ngày mặc định cho lượt chạy.
    thang: 01 → hết tháng TRƯỚC (chạy đầu tháng/ sau ngày 20 của tháng kế).
    tuan:  Thứ 2 → Chủ nhật của TUẦN TRƯỚC."""
    import datetime
    today = datetime.date.today()
    if lich == 'thang':
        dau_thang_nay = today.replace(day=1)
        het_thang_truoc = dau_thang_nay - datetime.timedelta(days=1)
        tu = het_thang_truoc.replace(day=1)
        return tu, het_thang_truoc
    # tuần trước
    thu2_tuan_nay = today - datetime.timedelta(days=today.weekday())
    cn_tuan_truoc = thu2_tuan_nay - datetime.timedelta(days=1)
    thu2_tuan_truoc = cn_tuan_truoc - datetime.timedelta(days=6)
    return thu2_tuan_truoc, cn_tuan_truoc


def mo_dang_nhap(san):
    """Mở Chrome riêng, vào sẵn trang sàn để chủ shop đăng nhập 1 lần. san='ca-hai'
    mở cả TikTok lẫn Shopee ở 2 tab. Chủ shop đóng cửa sổ Chrome khi xong."""
    from playwright.sync_api import sync_playwright
    reg = doc_registry()
    urls = []
    for s_ in (['tiktok', 'shopee'] if san == 'ca-hai' else [san]):
        urls.append(next((e['export']['url'] for e in reg['files'] if e['san'] == s_),
                         'https://seller-vn.tiktok.com' if s_ == 'tiktok'
                         else 'https://banhang.shopee.vn'))
    print('Mở Chrome để đăng nhập. Đăng nhập xong thì ĐÓNG cửa sổ Chrome.')
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            profile_dir(san), channel='chrome', headless=False, accept_downloads=True)
        for i, u in enumerate(urls):
            page = ctx.pages[0] if (i == 0 and ctx.pages) else ctx.new_page()
            page.goto(u)
        try:
            while ctx.pages:
                ctx.pages[0].wait_for_event('close', timeout=0)
        except Exception:
            pass
        try:
            ctx.close()
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lich', choices=['thang', 'tuan'])
    ap.add_argument('--downloads', help='thư mục nhận file tải')
    ap.add_argument('--login', choices=['tiktok', 'shopee', 'ca-hai'],
                    help='mở cửa sổ đăng nhập 1 lần cho sàn này rồi thoát')
    ap.add_argument('--chi', help='chỉ tải đúng 1 id trong registry (để test)')
    args = ap.parse_args()

    if args.login:
        mo_dang_nhap(args.login)
        return 0

    if not (args.lich and args.downloads):
        ap.error('cần --lich và --downloads (hoặc --login)')

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Thiếu Playwright — chạy: py -m pip install playwright && py -m playwright install chromium')
        return 2

    downloads = os.path.expandvars(os.path.expanduser(args.downloads))
    os.makedirs(downloads, exist_ok=True)
    anh_loi_dir = os.path.join(downloads, '_loi')

    reg = doc_registry()
    jobs = [e for e in reg['files'] if e['lich'] == args.lich
            and (not args.chi or e['id'] == args.chi)]
    if not jobs:
        print('Không có mục nào khớp lịch=%s.' % args.lich)
        return 1

    tu, den = ky_tu_lich(args.lich)
    print('Tải lịch "%s", kỳ %s → %s, %d file.\n' % (args.lich, tu, den, len(jobs)))

    # gom theo sàn để mở mỗi profile 1 lần
    loi, xong = [], []
    with sync_playwright() as p:
        for san in sorted({e['san'] for e in jobs}):
            ctx = p.chromium.launch_persistent_context(
                profile_dir(san), channel='chrome',
                headless=(os.environ.get('SVH_HIEN') != '1'), accept_downloads=True)
            try:
                for entry in [e for e in jobs if e['san'] == san]:
                    print('• %s' % entry['mo_ta'])
                    ok, msg = tai_mot_file(ctx, san, entry, downloads, tu, den, anh_loi_dir)
                    if ok:
                        print('    ✓ %s' % msg)
                        xong.append(entry['mo_ta'])
                    else:
                        print('    ✗ %s' % msg)
                        if 'MẤT ĐĂNG NHẬP' in msg:
                            bao_telegram('⚠ Tải file Sổ Vận Hành: %s. Chủ shop chạy lại '
                                         '`py tools\\tai_file_san.py --login %s` để đăng nhập.'
                                         % (msg, san))
                            # mất đăng nhập 1 sàn thì bỏ nốt file của sàn đó
                            break
                        if entry.get('bat_buoc'):
                            loi.append('%s: %s' % (entry['mo_ta'], msg))
            finally:
                ctx.close()

    print('\nXong %d file. Lỗi %d.' % (len(xong), len(loi)))
    if loi:
        bao_telegram('⚠ Tải file Sổ Vận Hành (%s) lỗi:\n- %s'
                     % (args.lich, '\n- '.join(loi)))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
