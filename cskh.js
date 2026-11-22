/* ============================================================================
   Tab "Hậu mãi" + tab "Thống kê hậu mãi" (viết lại 19/11/2026, thay cho 2 tab cũ
   "Đánh giá & Trả hàng" và "Gửi bù").

   VÌ SAO VIẾT LẠI: 3 nguồn (đánh giá, trả hàng, chat) + gửi bù từng nằm ở 2 tab,
   4 khối riêng; cùng 1 đơn nhiều sản phẩm sinh 4–5 thẻ; giao thiếu từ chat nằm ở
   cả bảng chat lẫn bảng gửi bù. Giờ:
   - MỖI ĐƠN = 1 THẺ (gộp theo sàn + mã đơn), ghi rõ gồm những nguồn nào.
   - MỖI THẺ CHỈ CÓ 1 VIỆC CHO ANH, quyết bằng 1 nút → thẻ rời danh sách:
       1. Ghi lỗi Sổ Kho   (lỗi kho: giao nhầm · lỗi sản phẩm)   [Ghi Sổ Kho] [Không phải lỗi shop]
       2. Duyệt gửi bù     (giao thiếu — luồng riêng 2 lần duyệt)  [Duyệt / Sửa / Dừng ...]
       3. Xử lý với khách  (đánh giá xấu, tranh chấp, trả hàng ảnh hưởng shop) [Đã xử lý]
       4. Chỉ cần xem      (đánh giá tốt có nhắc vấn đề, trả hàng nói về SP/kho) [Đã xem]
   - Hết việc = cả 4 nhóm về 0. Làm nhầm thì "Mở lại" ở mục Đã xong.
   - Giao thiếu từ MỌI nguồn chỉ hiện 1 lần, ở nhóm "Duyệt gửi bù" (thẻ gửi bù).
   - Trang chỉ ghi đúng: acked_at / errlog_status (+ 1 dòng warehouse_error_log khi
     anh bấm Ghi Sổ Kho) / status của resend_cases. Không đổi schema.
   - Cách CSKH đánh giá mức lỗi, nhắn khách... KHÔNG thuộc trang này.
============================================================================ */

const CSKH_LOOKBACK_DAYS = 45; // đủ cho kỳ "tháng này", tải 1 lần rồi lọc tại chỗ
let cskhRows = null;           // {reviews: [], returns: [], chats: []} — cache sau lần tải đầu

const CSKH_ORDER_URL = {
  tiktok: (o) => 'https://seller-vn.tiktok.com/order/detail?order_no=' + encodeURIComponent(o),
  // Shopee không mở được đơn theo mã chữ (/portal/sale/order/<mã> trả 404 — kiểm 17/11/2026):
  // chi tiết trả hàng cần id số do skill lưu ở cột detail_ref; không có thì mở trang
  // Trả hàng/Hoàn tiền/Hủy (mã đơn vẫn hiện trên thẻ để anh tìm).
  shopee: (o, row) => row && row.detail_ref
    ? 'https://banhang.shopee.vn/portal/sale/return/' + encodeURIComponent(row.detail_ref)
    : 'https://banhang.shopee.vn/portal/sale/returnrefundcancel',
};
const CSKH_REVIEW_URL = {
  tiktok: 'https://seller-vn.tiktok.com/product/rating?shop_region=VN',
  shopee: 'https://banhang.shopee.vn/portal/shop/rating',
};

function cskhPlatName(p){ return p === 'shopee' ? 'Shopee' : 'TikTok'; }

// "Hôm nay" / "Hôm qua" đọc nhanh hơn ngày tháng, phần còn lại giữ dd/mm/yyyy
function cskhWhen(dateStr){
  if (!dateStr) return '';
  const today = cskhToday();
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (dateStr === cskhDateKey(today)) return 'Hôm nay';
  if (dateStr === cskhDateKey(yest)) return 'Hôm qua';
  return fmtDMY(dateStr) || dateStr;
}

function cskhToday(){
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function cskhDateKey(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Khoảng ngày của từng kỳ, trả về [from, to] dạng 'YYYY-MM-DD' (bao gồm cả 2 đầu)
function cskhRange(period){
  const today = cskhToday();
  if (period === 'day') return [cskhDateKey(today), cskhDateKey(today)];
  if (period === 'yesterday'){
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return [cskhDateKey(y), cskhDateKey(y)];
  }
  if (period === 'week'){
    const from = new Date(today); from.setDate(from.getDate() - 6);
    return [cskhDateKey(from), cskhDateKey(today)];
  }
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return [cskhDateKey(from), cskhDateKey(today)];
}

function cskhInRange(dateStr, range){
  return dateStr && dateStr >= range[0] && dateStr <= range[1];
}


// ------------------------------------------------------------------ tải ------
// Tab Hậu mãi nhạy thời gian (có nút duyệt gửi bù) → LUÔN tải lại khi mở tab.
async function cskhLoadRows(){
  const from = new Date(cskhToday()); from.setDate(from.getDate() - CSKH_LOOKBACK_DAYS);
  const since = cskhDateKey(from);
  // Nguồn chat: bảng chưa tạo thì coi như rỗng.
  const chatsP = sbFetch('cskh_chat_errors?select=*&chat_date=gte.' + since + '&order=chat_date.desc&limit=2000').catch(() => []);
  const resendP = resendLoadRows().catch(() => []);
  const [reviews, returns] = await Promise.all([
    sbFetch('cskh_reviews?select=*&review_date=gte.' + since + '&order=review_date.desc&limit=2000'),
    sbFetch('cskh_returns?select=*&request_date=gte.' + since + '&order=request_date.desc&limit=2000'),
  ]);
  cskhRows = { reviews: reviews || [], returns: returns || [], chats: (await chatsP) || [], resend: (await resendP) || [] };
  return cskhRows;
}

// --------------------------------------------------------- gom theo ĐƠN ------
const CSKH_ERRKIND = {
  giao_nham:    { etype: 'kho_van',  dreason: 'giao_nham',    label: 'giao nhầm (lỗi kho)' },
  san_pham_loi: { etype: 'san_pham', dreason: 'san_pham_loi', label: 'lỗi sản phẩm (NCC)' },
};
const CSKH_TBL_LIST = { cskh_returns: 'returns', cskh_reviews: 'reviews', cskh_chat_errors: 'chats' };
const CSKH_SRC_LABEL = { cskh_returns: 'trả hàng', cskh_reviews: 'đánh giá', cskh_chat_errors: 'chat' };

// Tên loại việc hiện trên thẻ (ưu tiên loại lỗi, rồi action_type do CSKH gắn)
const CSKH_TYPE_LABEL = {
  giao_nham: 'Lỗi kho · giao nhầm', giao_thieu: 'Lỗi kho · giao thiếu', san_pham_loi: 'Lỗi sản phẩm',
  danh_gia_xau: 'Đánh giá 1–3★', danh_gia_van_de: 'Đánh giá 4–5★ có nhắc vấn đề',
  tra_hang_anh_huong_shop: 'Trả hàng ảnh hưởng shop', tra_hang_noi_dung_sp_kho: 'Trả hàng nói về SP / kho',
  lien_he_khach: 'Anh tự nhắn khách', tranh_chap: 'Tranh chấp / khiếu nại',
  // case_type của dòng chat (cột mới 22/11/2026) — loại hậu mãi không phải lỗi shop
  doi_size: 'Đổi size / đổi mẫu', tra_hang_hoan_tien: 'Trả hàng hoàn tiền', hoan_tien_giu_hang: 'Đòi hoàn tiền giữ hàng',
  khac: 'Hậu mãi khác',
};
// action_type chỉ cần "xem" (không có việc gì phải làm với khách)
const CSKH_VIEW_ONLY = new Set(['danh_gia_van_de', 'tra_hang_noi_dung_sp_kho']);
const CSKH_ERR_FINAL = new Set(['written', 'dismissed', 'dup']);

function cskhCaseKey(plat, order, tbl, id){
  return order ? (plat + '|' + order) : (plat + '|~' + tbl + id);
}

// ---- VÒNG ĐỜI 1 CASE (chốt 22/11/2026 — chủ shop: "case xong thì 3 ngày sau biến mất, có nút Xong
//      bấm là biến mất luôn; phải chạy ổn định") ------------------------------------------------------
// Web TỰ TÍNH lúc mở trang, không cần task nào chạy để "dọn" → không có job dọn thì không có gì để kẹt.
//   ĐANG MỞ   → hiện ở 1 trong các nhóm việc.
//   XONG      → vào "Vừa xong" CSKH_HIDE_DAYS ngày rồi tự ẩn. Xong khi 1 trong 3:
//               (a) anh bấm Xong / Ghi Sổ Kho / Không phải lỗi shop   (acked_at, errlog_status)
//               (b) task ghi bước cuối [xong]                          (dòng ▸ cuối)
//               (c) im lặng CSKH_HIDE_DAYS ngày mà KHÔNG phải đang chờ anh (khách không phản hồi, thẻ chỉ xem)
//   KHÔNG BAO GIỜ TỰ ẨN (chỉ anh đóng được): đề xuất ghi lỗi Sổ Kho, giao thiếu chưa có phiếu gửi bù,
//               tranh chấp, "anh tự nhắn khách", bước cuối [chờ anh]; phiếu gửi bù chưa done (quy tắc 21/11).
//   TỰ MỞ LẠI: sau khi đã đóng mà task ghi thêm bước mới (khách nhắn lại) → thẻ quay lại danh sách.
// Bảng tiêu chí đầy đủ: .claude/shared/hau-mai-so-van-hanh.md
const CSKH_HIDE_DAYS = 3;
const CSKH_DAY_MS = 86400000;
const CSKH_STUCK_H = { 'đang làm': 1, 'chờ khách': 24 };       // quá mốc này thì thẻ nhảy lên nhóm "cần anh"
const CSKH_OWNER_ONLY = new Set(['tranh_chap', 'lien_he_khach']); // action_type chỉ anh đóng được

// Biến 1 dòng (đánh giá/trả hàng/chat) thành bản ghi trạng thái chung
function cskhRowInfo(tbl, row, resendOrders){
  const kind = tbl === 'cskh_reviews' ? 'review' : tbl === 'cskh_returns' ? 'return' : 'chat';
  const date = kind === 'review' ? row.review_date : kind === 'return' ? row.request_date : row.chat_date;
  const now = Date.now();
  // Bảng chat chỉ có acked_at / progress_note / needs_action sau khi chạy phần "22/11/2026" của
  // scripts/cskh-tables.sql. Chưa chạy thì các cột này undefined → chat chạy đúng như cũ.
  const hasAckCol = 'acked_at' in row;
  const note = kind === 'chat' ? row.progress_note : row.message_note;
  const ev = cskhProgressParse(note);
  const last = ev.length ? ev[ev.length - 1] : null;
  const ackedRaw = hasAckCol && !!row.acked_at;
  const ackedAt = ackedRaw ? new Date(row.acked_at).getTime() : 0;
  // đã đóng mà task ghi bước mới sau đó (khách nhắn lại) → tự mở lại
  const reopened = ackedRaw && !!last && last.state !== 'xong' && last.at.getTime() > ackedAt + 60000;
  const acked = ackedRaw && !reopened;
  const st = row.errlog_status || 'none';
  const isMissing = row.shop_error_kind === 'giao_thieu' || st === 'owned_resend';
  const resendOwns = isMissing && !!row.order_code && resendOrders.has(row.platform + '|' + row.order_code);
  const xongLine = !!last && last.state === 'xong' && kind !== 'review';   // đánh giá: [xong] của task không đóng thẻ
  // chờ anh quyết ghi lỗi Sổ Kho (chat không có acked_at → chỉ dựa errlog_status)
  const pendErr = st === 'suggest' && !acked && !resendOwns;
  const pendErrOk = pendErr && !!CSKH_ERRKIND[row.shop_error_kind] && !!row.errlog_code;
  // chờ anh bấm Xong ([xong] do task ghi thì coi như xong, kể cả khi task quên tắt needs_action)
  const pendAck = !!row.needs_action && !acked && !resendOwns && !xongLine;
  // giao thiếu nhưng CHƯA có phiếu gửi bù (không để bị bỏ lửng)
  const pendOrphan = st === 'owned_resend' && !resendOwns && !acked;
  // task đang xử lý / chờ khách / chờ anh — có dòng tiến độ, chưa tới [xong]
  const track = !!last && !xongLine && last.state !== 'xong' && !acked && !resendOwns;
  // đánh giá task đã báo [xong] nhưng anh chưa bấm → vẫn là thẻ mở (chỉ xem)
  const reviewKeep = kind === 'review' && !!last && last.state === 'xong' && !acked && !resendOwns;
  const hrs = last ? (now - last.at.getTime()) / 3600000 : 0;
  const stuck = track && !!CSKH_STUCK_H[last.state] && hrs >= CSKH_STUCK_H[last.state];
  // Chủ shop chốt 22/11/2026 (tối): (1) ĐÁNH GIÁ chỉ ẩn khi anh bấm Xong — không tự ẩn, kể cả task ghi [xong];
  // (2) TRẢ HÀNG cần xử lý với khách thì phải NHẮN KHÁCH XONG mới bắt đầu tính 3 ngày.
  const messaged = !!row.messaged_at || /^\s*đã nhắn/i.test(row.message_note || '');
  const ownerOnly = kind === 'review';
  const needMsg = kind === 'return' && pendAck && !CSKH_VIEW_ONLY.has(row.action_type) && !messaged;
  const waitsOwner = pendErr || pendOrphan || (pendAck && CSKH_OWNER_ONLY.has(row.action_type))
    || (track && last.state === 'chờ anh') || ownerOnly || needMsg;
  // lần cuối có gì đó xảy ra với dòng này
  const dayEnd = date ? Math.min(now, new Date(date + 'T23:59:59').getTime()) : 0;
  const lastAct = Math.max(dayEnd, row.messaged_at ? new Date(row.messaged_at).getTime() : 0,
    row.created_at ? new Date(row.created_at).getTime() : 0, last ? last.at.getTime() : 0, reopened ? 0 : ackedAt);
  const live = pendErr || pendAck || pendOrphan || track || reviewKeep;
  const autoHide = live && !waitsOwner && (now - lastAct) >= CSKH_HIDE_DAYS * CSKH_DAY_MS; // (c)
  const open = live && !autoHide;
  const final = CSKH_ERR_FINAL.has(st) || acked || xongLine || autoHide;
  let doneAt = 0, doneWhy = '';
  if (!open && final){
    if (acked){ doneAt = ackedAt; doneWhy = 'anh bấm Xong'; }
    else if (autoHide){ doneAt = lastAct; doneWhy = 'tự ẩn: ' + CSKH_HIDE_DAYS + ' ngày không có gì mới'; }
    else if (xongLine){ doneAt = last.at.getTime(); doneWhy = 'task báo xong'; }
    else { doneAt = lastAct; doneWhy = ''; }
  }
  return { tbl, row, kind, date, st, acked, ackedRaw, resendOwns, ev, last, hasAckCol,
    pendErr, pendErrOk, pendAck, pendOrphan, track, stuck, waitsOwner, needMsg, ownerOnly, lastAct, open, final, doneAt, doneWhy };
}

function cskhBuildCases(){
  const rs = cskhRows.resend || [];
  const resendOrders = new Set(rs.filter(r => r.status !== 'cancelled').map(r => r.platform + '|' + r.orig_order_code));
  const infos = [];
  cskhRows.reviews.forEach(r => infos.push(cskhRowInfo('cskh_reviews', r, resendOrders)));
  cskhRows.returns.forEach(r => infos.push(cskhRowInfo('cskh_returns', r, resendOrders)));
  cskhRows.chats.forEach(r => infos.push(cskhRowInfo('cskh_chat_errors', r, resendOrders)));
  const map = new Map();
  infos.forEach(i => {
    if (i.resendOwns) return; // giao thiếu đã có phiếu gửi bù → chỉ hiện ở nhóm "Duyệt gửi bù"
    // dòng không cần ai làm gì (đã nhắn xong, không cờ) thì không thành thẻ
    if (!i.open && !i.final) return;
    const key = cskhCaseKey(i.row.platform, i.row.order_code, i.tbl, i.row.id);
    if (!map.has(key)) map.set(key, { key, platform: i.row.platform, order: i.row.order_code || '', customer: '', infos: [] });
    map.get(key).infos.push(i);
  });
  const cases = [...map.values()];
  cases.forEach(c => {
    c.customer = (c.infos.find(i => i.row.customer) || { row: {} }).row.customer || '';
    c.dates = c.infos.map(i => i.date).filter(Boolean).sort();
    c.firstDate = c.dates[0] || '';
    c.lastDate = c.dates[c.dates.length - 1] || '';
    const open = c.infos.filter(i => i.open);
    c.open = open.length > 0;
    const ghi = open.some(i => i.pendErrOk);
    const needClient = open.some(i => (i.pendAck && !CSKH_VIEW_ONLY.has(i.row.action_type)) || i.pendOrphan
      || (i.pendErr && !i.pendErrOk) || (i.track && (i.last.state === 'chờ anh' || i.stuck)));
    const tracking = open.some(i => i.track);
    c.section = !c.open ? 'done' : ghi ? 'ghi' : needClient ? 'xu_ly' : tracking ? 'theo_doi' : 'xem';
    // KHU VỰC theo nguồn (chốt 22/11/2026): 1 đơn chỉ nằm ở 1 khu. Có chat đang mở → Chat (việc diễn ra trong
    // hội thoại); không thì Trả hàng; không thì Đánh giá. Thẻ vẫn ghi đủ "1 trả hàng + 1 chat".
    const src = open.length ? open : c.infos;
    c.area = src.some(i => i.kind === 'chat') ? 'chat' : src.some(i => i.kind === 'return') ? 'return' : 'review';
    c.needMsg = open.some(i => i.needMsg);
    c.ownerOnly = open.length > 0 && open.every(i => i.ownerOnly && !i.pendErr && !(i.track && i.last.state === 'chờ anh'));
    c.suggest = open.find(i => i.pendErr && CSKH_ERRKIND[i.row.shop_error_kind]) || null;
    c.stuck = open.some(i => i.stuck);
    c.waitsOwner = open.some(i => i.waitsOwner);
    // còn mấy ngày nữa thì tự ẩn (chỉ tính khi không có dòng nào đang chờ anh)
    c.lastAct = Math.max(0, ...c.infos.map(i => i.lastAct));
    if (!c.open){
      c.doneAt = Math.max(0, ...c.infos.map(i => i.doneAt));
      c.doneWhy = (c.infos.slice().sort((a, b) => b.doneAt - a.doneAt)[0] || {}).doneWhy || '';
      c.hidden = (Date.now() - c.doneAt) >= CSKH_HIDE_DAYS * CSKH_DAY_MS;
    }
  });
  return cases;
}

// ------------------------------------------------------------- thẻ 1 đơn -----
function cskhCaseTypes(c){
  const out = [];
  c.infos.forEach(i => {
    const k = i.row.shop_error_kind, a = i.row.action_type, ct = i.row.case_type;
    const t = (k && CSKH_TYPE_LABEL[k]) || (ct && CSKH_TYPE_LABEL[ct]) || (a && CSKH_TYPE_LABEL[a])
      || (i.kind === 'review' && i.track ? 'Đánh giá 1–3★' : i.pendAck ? 'Cần xem' : '');
    if (t && !out.includes(t)) out.push(t);
  });
  return out;
}

function cskhCaseSources(c){
  const n = { review: 0, return: 0, chat: 0 };
  c.infos.forEach(i => { n[i.kind]++; });
  return [n.review ? n.review + ' đánh giá' : '', n.return ? n.return + ' trả hàng' : '', n.chat ? n.chat + ' chat' : '']
    .filter(Boolean).join(' + ');
}

function cskhCaseSnippet(c){
  for (const i of c.infos){ if (i.kind === 'chat' && i.row.evidence) return 'Khách nói: ' + i.row.evidence + (i.row.has_photo ? ' · 📷 đã có ảnh' : ' · chưa có ảnh'); }
  for (const i of c.infos){ if (i.kind === 'return'){ const t = i.row.customer_note || i.row.action_note || i.row.reason; if (t) return (i.row.customer_note ? 'Khách ghi: “' + t + '”' : t); } }
  for (const i of c.infos){ if (i.kind === 'review'){ const t = i.row.content || i.row.action_note; if (t) return t; } }
  for (const i of c.infos){ if (i.row.errlog_reason) return i.row.errlog_reason; }
  return '';
}

function cskhCaseLinks(c){
  let h = '';
  const withDetail = c.infos.find(i => i.row.detail_ref) || c.infos[0];
  if (c.order && CSKH_ORDER_URL[c.platform])
    h += `<a class="lnk" href="${CSKH_ORDER_URL[c.platform](c.order, withDetail && withDetail.row)}" target="_blank" rel="noopener">↗ Mở đơn</a>`;
  if (c.infos.some(i => i.kind === 'review'))
    h += `<a class="lnk" href="${CSKH_REVIEW_URL[c.platform] || CSKH_REVIEW_URL.tiktok}" target="_blank" rel="noopener">↗ Đánh giá</a>`;
  const chat = c.infos.find(i => i.kind === 'chat' && i.row.chat_url);
  if (chat) h += `<a class="lnk" href="${esc(chat.row.chat_url)}" target="_blank" rel="noopener">↗ Mở chat</a>`;
  return h;
}

function cskhAgeHtml(c){
  if (!c.firstDate) return '';
  const days = Math.round((cskhToday() - new Date(c.firstDate + 'T00:00:00')) / 86400000);
  const age = days <= 0 ? '<span class="when">Hôm nay</span>'
    : '<span class="when' + (days >= 2 ? ' hm-old' : '') + '">' + (days === 1 ? 'Hôm qua' : 'tồn ' + days + ' ngày') + '</span>';
  return age + cskhHideHintHtml(c);
}

// Nói rõ thẻ này sẽ tự ẩn khi nào, hay phải chờ anh — để không ai phải đoán vì sao thẻ còn/mất
function cskhHideHintHtml(c){
  if (!c.open) return '';
  if (c.needMsg) return '<span class="hm-hint stay" title="Trả hàng ảnh hưởng shop: nhắn khách xong mới tính 3 ngày">chưa nhắn khách · không tự ẩn</span>';
  if (c.ownerOnly) return '<span class="hm-hint stay" title="Đánh giá chỉ ẩn khi anh bấm Xong">chỉ ẩn khi anh bấm Xong</span>';
  if (c.waitsOwner) return '<span class="hm-hint stay" title="Việc này chỉ anh quyết được nên không tự ẩn">chờ anh · không tự ẩn</span>';
  const left = Math.max(1, Math.ceil(CSKH_HIDE_DAYS - (Date.now() - c.lastAct) / CSKH_DAY_MS));
  return '<span class="hm-hint" title="Không có gì mới thì thẻ tự ẩn; khách nhắn lại thì thẻ tự quay lại">tự ẩn sau ' + left + ' ngày</span>';
}

// ---- TIẾN ĐỘ XỬ LÝ (chốt 21/11/2026) -------------------------------------------------------------
// Task ghi mỗi bước thành 1 dòng bắt đầu bằng "▸ " vào cột text SẴN CÓ (resend_cases.owner_note,
// cskh_reviews.message_note) — không cần đổi schema DB. Định dạng 1 dòng:
//   ▸ 21/11 10:34 · [chờ khách] Đã gửi tin xác minh — chờ khách xác nhận
// Nhãn trạng thái: [đang làm] (task đang xử lý) · [chờ khách] · [chờ anh] · [xong].
// Dòng CUỐI = bước hiện tại. Quá mốc (chờ khách ≥ 4h, đang làm ≥ 1h) thì web hiện ⚠ "đứng ở bước này N giờ".
// Chi tiết cách ghi: .claude/shared/tien-do-xu-ly.md
const CSKH_PROG_RE = /^▸\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*·\s*\[([^\]]+)\]\s*(.*)$/;
function cskhProgressParse(text){
  const out = [];
  String(text || '').split('\n').forEach(l => {
    const m = CSKH_PROG_RE.exec(l.trim());
    if (!m) return;
    const now = new Date(); let y = now.getFullYear();
    let d = new Date(y, +m[2] - 1, +m[1], +m[3], +m[4]);
    if (d.getTime() - now.getTime() > 86400000) d = new Date(y - 1, +m[2] - 1, +m[1], +m[3], +m[4]);
    out.push({ at: d, label: m[1] + '/' + m[2] + ' ' + m[3].padStart(2, '0') + ':' + m[4], state: m[5].trim().toLowerCase(), text: m[6] });
  });
  out.sort((a, b) => a.at - b.at);   // task có lúc chèn dòng mới lên đầu → luôn xếp theo giờ, dòng cuối = bước hiện tại
  return out;
}
function cskhProgressStripped(text){
  return String(text || '').split('\n').filter(l => !/^\s*[▸☑⚑]/.test(l)).join(' ').trim();
}
function cskhProgressHtml(text, closed){
  const ev = cskhProgressParse(text);
  if (!ev.length) return '<div class="rs-sub rs-faint">Tiến độ: chưa có cập nhật (task chưa ghi bước nào).</div>';
  const last = ev[ev.length - 1];
  const hrs = (Date.now() - last.at.getTime()) / 3600000;
  const limit = last.state === 'chờ khách' ? 4 : last.state === 'đang làm' ? 1 : 0;
  const stuck = !closed && limit && hrs >= limit;
  const icon = { 'đang làm': '⚙', 'chờ khách': '⏳', 'chờ anh': '👉', 'xong': '✓' }[last.state] || '•';
  const head = '<div class="rs-sub' + (stuck ? ' rs-bad' : '') + '"><b>Tiến độ:</b> ' + icon + ' ' + esc(last.text)
    + ' <span class="rs-faint">(' + esc(last.label) + ', ' + esc(last.state) + ')</span>'
    + (stuck ? ' · <b>⚠ đứng ở bước này ' + Math.floor(hrs) + ' giờ — anh vào xử lý</b>' : '') + '</div>';
  const hist = ev.length > 1
    ? '<details class="hm-fold"><summary>Lịch sử ' + ev.length + ' bước</summary><div class="rs-sub">'
      + ev.slice().reverse().map(e => esc(e.label) + ' · [' + esc(e.state) + '] ' + esc(e.text)).join('<br>') + '</div></details>' : '';
  return head + hist;
}

// Đánh giá xấu (1–3★) đã nhắn khách: hiện tình trạng "khách chưa phản hồi sau Nh" (chốt 21/11/2026,
// mốc 4h). Task CSKH inbox thêm chữ "khách đã phản hồi" vào message_note khi khách trả lời.
const CSKH_REPLY_WAIT_H = 4;
function cskhReplyHtml(c){
  // dòng nào có nhật ký ▸ thì hiện bước hiện tại + lịch sử (ưu tiên dòng đang mở, mới nhất)
  const pg = c.infos.filter(i => i.ev.length).sort((a, b) => (b.open - a.open) || (b.last.at - a.last.at))[0];
  if (pg) return cskhProgressHtml(pg.kind === 'chat' ? pg.row.progress_note : pg.row.message_note, !pg.open);
  const rv =c.infos.find(i => i.kind === 'review' && i.row.action_type === 'danh_gia_xau' && i.row.messaged_at);
  if (!rv) return '';
  const at = new Date(rv.row.messaged_at);
  const hh = at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + at.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  if (cskhProgressParse(rv.row.message_note).length) return cskhProgressHtml(rv.row.message_note, false);
  if (/khách đã phản hồi/i.test(rv.row.message_note || ''))
    return '<div class="rs-sub">Đã nhắn khách ' + hh + ' · <b>khách đã phản hồi</b> — anh mở chat xem.</div>';
  const hrs = (Date.now() - at.getTime()) / 3600000;
  return hrs >= CSKH_REPLY_WAIT_H
    ? '<div class="rs-sub rs-bad">⚠ Đã nhắn khách ' + hh + ', <b>khách chưa phản hồi</b> sau ' + Math.floor(hrs) + ' giờ — anh vào xử lý.</div>'
    : '<div class="rs-sub">Đã nhắn khách ' + hh + ' · đang chờ khách phản hồi (mốc ' + CSKH_REPLY_WAIT_H + ' giờ).</div>';
}

function cskhCaseCardHtml(c){
  const plat = cskhPlatName(c.platform);
  const types = cskhCaseTypes(c).map(t => '<span class="tag why">' + esc(t) + '</span>').join('');
  const snip = cskhCaseSnippet(c);
  const orphan = c.infos.some(i => i.pendOrphan)
    ? '<div class="rs-sub rs-bad">Giao thiếu nhưng chưa có phiếu gửi bù — để task gửi bù thu thập thông tin, hoặc anh tự xử lý rồi bấm Xong.</div>' : '';
  // NÚT (chốt 22/11/2026 tối): mọi thẻ đều có 2 nút Ghi Sổ Kho để ANH tự chọn loại lỗi sau khi tự xác minh —
  // lý do sàn kiểu "Chất lượng kém" không ảnh, không chi tiết thì không ai tự quy lỗi được. Task có đề xuất thì
  // chỉ tô đậm nút đó, quyết vẫn là anh. Xong = đóng thẻ, KHÔNG ghi lỗi.
  const k = esc(c.key);
  const sugKind = c.suggest ? c.suggest.row.shop_error_kind : '';
  const sugLine = c.suggest
    ? '<div class="rs-sub"><b>Task đề xuất:</b> ' + esc(CSKH_ERRKIND[sugKind].label) + (c.suggest.row.errlog_reason ? ' — ' + esc(c.suggest.row.errlog_reason) : '') + '</div>' : '';
  const decided = c.infos.some(i => CSKH_ERR_FINAL.has(i.st) && i.st !== 'dismissed');
  const wbtn = (kind, label) => `<button class="${sugKind === kind ? 'btn-errlog' : 'btn-errskip'}" data-hm="write" data-kind="${kind}" data-case="${k}">${label}</button>`;
  const btns = (decided ? '<span class="rs-faint">✓ đã ghi Sổ Kho</span>' : wbtn('giao_nham', 'Ghi Sổ Kho: lỗi kho') + wbtn('san_pham_loi', 'Ghi Sổ Kho: lỗi sản phẩm'))
    + `<button class="btn-ack" data-hm="ack" data-case="${k}">Xong</button>`;
  const noCode = '';
  const code = (c.infos.find(i => i.row.errlog_code) || { row: {} }).row.errlog_code;
  return `<div class="fi compact${c.suggest ? ' err' : ''}">
    <div class="fi-line1"><span class="tag ${c.platform === 'shopee' ? 'shopee' : 'tiktok'}">${plat}</span>${types}
      ${c.customer ? '<span class="cust">Khách <b>' + esc(c.customer) + '</b></span>' : ''}
      ${c.order ? '<span class="code">' + esc(c.order) + '</span>' : ''}
      ${code ? '<span class="code" title="mã vận đơn">VĐ ' + esc(code) + '</span>' : ''}${cskhAgeHtml(c)}</div>
    <div class="fi-line2"><span class="hm-src">${esc(cskhCaseSources(c))}</span>${snip ? '<span class="snippet" title="' + esc(snip) + '">' + esc(snip) + '</span>' : '<span class="snippet"></span>'}</div>
    ${orphan}${noCode}${sugLine}${cskhReplyHtml(c)}
    <div class="err-foot">${btns}${cskhCaseLinks(c)}</div>
  </div>`;
}

function cskhDoneRowHtml(c){
  const written = c.infos.find(i => i.st === 'written');
  const dismissed = c.infos.find(i => i.st === 'dismissed');
  const dup = c.infos.find(i => i.st === 'dup');
  const ackedAt = c.infos.map(i => i.row.acked_at).filter(Boolean).sort().pop();
  const result = written ? '✓ đã ghi Sổ Kho' + (written.row.errlog_id ? ' #' + written.row.errlog_id : '')
    : dup ? 'Sổ Kho đã có dòng cho mã này'
    : dismissed ? 'không phải lỗi shop'
    : (c.doneWhy || 'đã xử lý') + (ackedAt ? ' ' + new Date(ackedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '');
  const canReopen = c.infos.some(i => i.acked);
  const left = Math.ceil(CSKH_HIDE_DAYS - (Date.now() - c.doneAt) / CSKH_DAY_MS);
  const when = c.hidden ? 'xong ' + new Date(c.doneAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    : 'ẩn sau ' + Math.max(1, left) + ' ngày';
  return `<tr><td class="rs-faint">${esc(when)}</td><td><span class="tag ${c.platform === 'shopee' ? 'shopee' : 'tiktok'}">${cskhPlatName(c.platform)}</span></td>
    <td>${esc(c.customer || '')}<div class="code">${esc(c.order)}</div></td>
    <td>${esc(cskhCaseTypes(c).join(' · '))}<div class="rs-faint">${esc(cskhCaseSources(c))}</div></td>
    <td>${esc(result)}</td>
    <td>${canReopen ? `<button class="btn-ack" data-hm="reopen" data-case="${esc(c.key)}">Mở lại</button>` : ''}</td></tr>`;
}

// ------------------------------------------------------------- nhóm việc -----
// 3 KHU VỰC theo nguồn (chốt 22/11/2026 tối, thay cho 4 nhóm "ghi / gửi bù / xử lý / xem"): chủ shop không muốn
// 2 khu trùng mục đích, nên KHÔNG còn khu "Ghi lỗi Sổ Kho" riêng — nút ghi lỗi nằm ngay trên từng thẻ.
const CSKH_AREAS = [
  { id: 'chat',   title: 'Chat', note: 'giao thiếu (gửi bù) · giao nhầm · hàng lỗi · đổi size · trả hàng hoàn tiền — task CSKH inbox' },
  { id: 'review', title: 'Đánh giá', note: 'đánh giá xấu và đánh giá có nhắc vấn đề — chỉ ẩn khi anh bấm Xong' },
  { id: 'return', title: 'Trả hàng', note: 'yêu cầu trả hàng / hoàn tiền trên sàn — nhắn khách xong, 3 ngày không có gì mới thì tự ẩn' },
];
// thứ tự trong 1 khu: việc của anh → task đang theo dõi → chỉ xem; cùng loại thì cũ nhất lên trên
const CSKH_ORDER = { ghi: 0, xu_ly: 1, theo_doi: 2, xem: 3 };

function cskhGroupHtml(title, note, n, inner, empty){
  return '<div class="act-group"><div class="act-head"><b>' + esc(title) + '</b>'
    + (n ? '<span class="act-n">' + fmtInt(n) + '</span>' : '')
    + (note ? '<span class="act-note">' + esc(note) + '</span>' : '') + '</div>'
    + (n ? inner : '<p class="cskh-quiet">' + esc(empty) + '</p>') + '</div>';
}

function cskhRenderMain(){
  const bodyEl = document.getElementById('cskh-body');
  if (!bodyEl || !cskhRows) return;
  const cases = cskhBuildCases();
  const byArea = (id) => cases.filter(c => c.open && c.area === id)
    .sort((a, b) => (CSKH_ORDER[a.section] - CSKH_ORDER[b.section]) || (a.firstDate || '').localeCompare(b.firstDate || ''));
  const rg = resendGroups(cskhRows.resend || []);
  rg.need.sort((a, b) => ({ wait_approve_2: 0, wait_approve_1: 1 }[a.status] ?? 2) - ({ wait_approve_2: 0, wait_approve_1: 1 }[b.status] ?? 2));
  const open = cases.filter(c => c.open);
  const mine = open.filter(c => c.section !== 'theo_doi');           // việc CỦA ANH (task đang theo dõi không tính)
  const nArea = (id) => mine.filter(c => c.area === id).length + (id === 'chat' ? rg.need.length : 0);
  const total = mine.length + rg.need.length;
  const nWatch = open.length - mine.length + rg.running.length;
  const nSuggest = open.filter(c => c.suggest).length;
  const lateResend = rg.need.some(r => resendDeadline(r).late);
  const nStuck = open.filter(c => c.stuck).length;

  const parts = CSKH_AREAS.map(a => nArea(a.id) ? a.title + ' ' + nArea(a.id) : '').filter(Boolean);
  const tail = (nSuggest ? ' · <b>' + nSuggest + ' đơn task đề xuất ghi lỗi Sổ Kho</b>' : '')
    + (nWatch ? ' · <span class="rs-faint">' + nWatch + ' case task đang theo dõi</span>' : '')
    + (nStuck ? ' · <b>⚠ ' + nStuck + ' case kẹt quá mốc</b>' : '')
    + (lateResend ? ' · <b>⚠ có phiếu gửi bù sắp quá giờ</b>' : '');
  // Máy quét kẹt = case mới KHÔNG lên sổ → phải to và đỏ, không để chìm ở dòng chữ nhỏ (xem cskhRunStatus)
  const health = cskhHealth.bad
    ? `<div class="hm-banner bad"><b>⚠ Máy quét đang kẹt</b> — case mới có thể CHƯA lên sổ, danh sách dưới đây có thể thiếu. ${esc(cskhHealth.bad)}</div>` : '';
  const banner = health + (total
    ? `<div class="hm-banner warn"><b>Còn ${fmtInt(total)} việc của anh</b> · ${esc(parts.join(' · '))}${tail}</div>`
    : `<div class="hm-banner ok"><b>Không còn việc nào của anh.</b>${tail}</div>`);

  const areaHtml = (a) => {
    const l = byArea(a.id);
    // phiếu gửi bù (giao thiếu từ mọi nguồn) nằm trong khu Chat: cần anh duyệt lên đầu, đang chạy tự động xuống cuối
    const pre = a.id === 'chat' ? rg.need.map(resendCardHtml).join('') : '';
    const post = a.id === 'chat' ? rg.running.map(resendCardHtml).join('') : '';
    const n = l.length + (a.id === 'chat' ? rg.need.length + rg.running.length : 0);
    return cskhGroupHtml(a.title, a.note, n, '<div class="feed">' + pre + l.map(cskhCaseCardHtml).join('') + post + '</div>', 'Không có case nào đang mở.');
  };

  // XONG: 3 ngày đầu nằm ở "Vừa xong" (còn thấy, còn Mở lại được), sau đó xuống "Đã ẩn" (30 ngày, để tra lại)
  const doneAll = cases.filter(c => c.section === 'done').sort((a, b) => b.doneAt - a.doneAt);
  const fresh = doneAll.filter(c => !c.hidden);
  const hidden = doneAll.filter(c => c.hidden && (Date.now() - c.doneAt) < 30 * CSKH_DAY_MS).slice(0, 60);
  const rsFresh = rg.closed.filter(r => (Date.now() - new Date(r.updated_at || r.created_at).getTime()) < CSKH_HIDE_DAYS * CSKH_DAY_MS);
  const rsOld = rg.closed.filter(r => !rsFresh.includes(r));
  const doneTable = (list) => '<div class="card"><table class="dtable"><thead><tr><th></th><th></th><th>Khách / mã đơn</th><th>Loại</th><th>Kết quả</th><th></th></tr></thead><tbody>' + list.map(cskhDoneRowHtml).join('') + '</tbody></table></div>';
  const rsTable = (list) => '<div class="sub-label">Gửi bù đã xong / dừng</div><div class="card"><table class="dtable"><thead><tr><th>Khách</th><th>Món</th><th>Mã vận đơn</th><th>Trạng thái</th><th></th></tr></thead><tbody>' + list.map(resendDoneRowHtml).join('') + '</tbody></table></div>';
  const fold = (title, list, rs, empty) => `<details class="hm-fold"><summary>${esc(title)} · ${fmtInt(list.length)} đơn · ${fmtInt(rs.length)} phiếu gửi bù</summary>`
    + (list.length ? doneTable(list) : '<p class="cskh-quiet">' + esc(empty) + '</p>') + (rs.length ? rsTable(rs) : '') + '</details>';
  const doneHtml = fold('Vừa xong — tự ẩn sau ' + CSKH_HIDE_DAYS + ' ngày', fresh, rsFresh, 'Chưa có case nào vừa xong.')
    + fold('Đã ẩn (30 ngày gần đây, để tra lại)', hidden, rsOld, 'Chưa có.');
  bodyEl.innerHTML = banner + CSKH_AREAS.map(areaHtml).join('') + doneHtml;
}

// ---------------------------------------------------- hành động trên thẻ -----
function cskhFindCase(key){ return cskhBuildCases().find(c => c.key === key); }

async function cskhPatchRow(i, body){
  await sbFetch(i.tbl + '?id=eq.' + encodeURIComponent(i.row.id),
    { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  Object.assign(i.row, body); // cập nhật cache để render lại ngay
}

// Xong: đóng mọi dòng đang mở của đơn này, KHÔNG ghi lỗi (đề xuất của task → 'dismissed').
// keepTrack=true (sau khi Ghi Sổ Kho): dòng task CÒN đang xử lý với khách thì để nguyên — quyết xong lỗi kho
// chưa phải là xong với khách.
async function cskhActAck(c, keepTrack){
  const now = new Date().toISOString();
  for (const i of c.infos){
    if (!i.open) continue;
    if (keepTrack && i.track) continue;
    const body = {};
    if (i.hasAckCol) body.acked_at = now;
    if (i.pendErr || !i.hasAckCol) body.errlog_status = 'dismissed'; // bảng chat chưa có cột acked_at thì chỉ có cách này
    await cskhPatchRow(i, body);
  }
}

// Mã vận đơn của đơn: lấy từ dòng đã có → bảng hàng hoàn (platform_returns_feed) → hỏi anh.
async function cskhResolveCode(c){
  const have = c.infos.find(i => i.row.errlog_code);
  if (have) return have.row.errlog_code;
  if (c.order){
    try {
      const f = await sbFetch('platform_returns_feed?select=outbound_tracking&order_name=eq.' + encodeURIComponent(c.order) + '&outbound_tracking=not.is.null&limit=1');
      if (f && f[0] && f[0].outbound_tracking) return f[0].outbound_tracking;
    } catch (e){ /* không có bảng / không có dòng → hỏi tay */ }
  }
  const typed = window.prompt('Sổ Kho ghi lỗi theo MÃ VẬN ĐƠN mà em chưa tìm được mã của đơn ' + (c.order || '') + '.\nAnh dán mã vận đơn (đơn gốc gửi đi) vào đây:', '');
  return typed ? typed.trim() : '';
}

// Ghi Sổ Kho (chốt 22/11/2026 tối): ANH chọn loại lỗi — kindKey = 'giao_nham' (lỗi kho) | 'san_pham_loi' (lỗi sản phẩm).
// 1 dòng warehouse_error_log cho mã vận đơn, dò trùng ngay lúc bấm. Trả về false nếu anh huỷ giữa chừng.
async function cskhActWrite(c, kindKey){
  const kind = CSKH_ERRKIND[kindKey];
  if (!kind) throw new Error('không rõ loại lỗi');
  const open = c.infos.filter(i => i.open);
  // dòng nhận kết quả: ưu tiên dòng task đã đề xuất, rồi trả hàng, đánh giá, chat
  const src = open.find(i => i.pendErr) || open.find(i => i.kind === 'return') || open.find(i => i.kind === 'review') || open[0] || c.infos[0];
  const code = await cskhResolveCode(c);
  if (!code) return false;
  const guess = src.row.errlog_reason || src.row.customer_note || src.row.content || src.row.evidence || src.row.reason || '';
  const reason = window.prompt('Ghi vào Sổ Kho: ' + kind.label + ' · mã vận đơn ' + code + '\n(tính vào thống kê lỗi nhân viên / nhà cung cấp)\n\nMô tả lỗi ngắn gọn:', String(guess).slice(0, 200));
  if (reason === null) return false;
  const dup = await sbFetch('warehouse_error_log?select=id&code=eq.' + encodeURIComponent(code) + '&limit=1');
  let errId, status = 'written';
  if (dup && dup.length){ errId = dup[0].id; status = 'dup'; }
  else {
    const ins = await sbFetch('warehouse_error_log', { method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ code, error_type: kind.etype, detail_reason: kind.dreason, reason: reason.trim() || kind.label }) });
    errId = ins && ins[0] && ins[0].id;
  }
  const now = new Date().toISOString();
  for (const i of c.infos){
    if (i !== src && !(i.open && i.pendErr)) continue;
    const body = { errlog_status: status, errlog_id: errId || null, errlog_code: code, shop_error_kind: kindKey };
    if (reason.trim()) body.errlog_reason = reason.trim();
    if (i.hasAckCol && !i.track) body.acked_at = now; // quyết xong = xử lý xong (trừ khi task còn đang làm với khách)
    await cskhPatchRow(i, body);
  }
  // các dòng còn lại của đơn (vd đánh giá 3★ cùng đơn) cũng coi là xong
  await cskhActAck(cskhFindCase(c.key) || { infos: [] }, true);
  if (status === 'dup') alert('Sổ Kho đã có sẵn 1 dòng lỗi cho mã vận đơn ' + code + ' (#' + errId + ') nên em không ghi thêm dòng mới.');
  return true;
}

async function cskhActReopen(c){
  for (const i of c.infos){
    if (i.acked) await cskhPatchRow(i, { acked_at: null });
  }
}

async function cskhHandleHm(btn){
  const c = cskhFindCase(btn.dataset.case);
  if (!c){ alert('Đơn này vừa đổi. Em tải lại danh sách.'); return refreshCskh(); }
  const act = btn.dataset.hm;
  if (act === 'ack' && c.suggest && !confirm('Đóng thẻ này mà KHÔNG ghi lỗi vào Sổ Kho? (task đang đề xuất: ' + CSKH_ERRKIND[c.suggest.row.shop_error_kind].label + ')')) return;
  btn.disabled = true; const old = btn.textContent; btn.textContent = 'Đang lưu…';
  try {
    if (act === 'ack') await cskhActAck(c);
    else if (act === 'write'){ if (!(await cskhActWrite(c, btn.dataset.kind))){ btn.disabled = false; btn.textContent = old; return; } }
    else if (act === 'reopen') await cskhActReopen(c);
    cskhRenderMain();
  } catch (err){
    btn.disabled = false; btn.textContent = old;
    alert('Chưa lưu được: ' + err.message);
  }
}

// ------------------------------------------------------------- màn hình ------
function buildCskhScreenHTML(){
  return `
  <div class="topbar">
    <button class="btn-rs edit" id="cskh-reload">Tải lại</button>
    <span class="up-status" id="cskh-updated">Đang tải…</span>
  </div>
  <div id="cskh-body"></div>
  <footer>
    <p><b>Cách dùng:</b> mỗi đơn là 1 thẻ, nằm ở 1 trong 3 khu Chat / Đánh giá / Trả hàng. Bấm <b>Xong</b> là thẻ rời danh sách ngay (không ghi lỗi). Xác minh thấy lỗi của shop thì bấm <b>Ghi Sổ Kho: lỗi kho</b> hoặc <b>lỗi sản phẩm</b>. Thẻ Chat và Trả hàng tự ẩn sau 3 ngày không có gì mới (trả hàng: tính từ lúc đã nhắn khách); thẻ Đánh giá chỉ ẩn khi anh bấm. Khách nhắn lại thì thẻ tự quay lại. Bấm nhầm thì mở "Vừa xong" → <b>Mở lại</b>.</p>
    <p><b>Nguồn:</b> skill <code>review-return-check</code> (08:00 &amp; 20:00: đánh giá + trả hàng), task CSKH inbox (chat: lỗi kho / lỗi SP / giao thiếu → gửi bù) chạy trên PC trực. Trang không tự vào sàn; nút "Ghi Sổ Kho" ghi 1 dòng vào <code>warehouse_error_log</code>, chống trùng theo mã vận đơn.</p>
    <p><b>Giao thiếu</b> từ chat / đánh giá / trả hàng đều quy về 1 phiếu gửi bù (2 lần duyệt). Bảng gửi bù không lưu SĐT/địa chỉ đầy đủ — bản đầy đủ ở tin Telegram.</p>
  </footer>`;
}

// Giờ quét gần nhất + cảnh báo nếu quá lâu (lịch 08:00/20:00 → tối đa 12h giữa 2 lượt)
const cskhHealth = { bad: '' };   // khác rỗng = lượt quét gần nhất bị chặn / quá 14 giờ chưa quét
async function cskhRunStatus(){
  let last = null, blocked = '';
  try {
    const run = await sbFetch('cskh_run_log?select=ran_at,status,note&order=ran_at.desc&limit=1');
    if (run && run[0]){ last = new Date(run[0].ran_at); if (run[0].status !== 'ok') blocked = run[0].note || 'lượt gần nhất bị chặn'; }
  } catch (e){ /* chưa có bảng */ }
  if (!last) return 'Chưa có dữ liệu lượt quét · skill tự chạy 08:00 & 20:00 trên PC trực';
  const hours = (Date.now() - last.getTime()) / 3600000;
  cskhHealth.bad = hours > 14 ? 'Đã ' + Math.floor(hours) + ' giờ chưa quét đánh giá/trả hàng — kiểm tra PC trực.'
    : blocked ? 'Lượt quét gần nhất bị chặn: ' + (blocked.length > 160 ? blocked.slice(0, 160) + '…' : blocked) : '';
  return 'Quét đánh giá/trả hàng lúc ' + last.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    + (hours > 14 ? ' · ⚠ đã ' + Math.floor(hours) + ' giờ chưa quét — kiểm tra PC trực' : '')
    + (blocked ? ' · ⚠ ' + (blocked.length > 110 ? blocked.slice(0, 110) + '…' : blocked) : '');
}

async function refreshCskh(){
  const statusEl = document.getElementById('cskh-updated');
  const bodyEl = document.getElementById('cskh-body');
  if (!bodyEl) return;
  try {
    await cskhLoadRows();
    statusEl.textContent = 'Tải lúc ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + await cskhRunStatus();
    cskhRenderMain();
  } catch (err){
    statusEl.textContent = '';
    bodyEl.innerHTML = '<p class="cskh-quiet">Chưa đọc được dữ liệu: ' + esc(err.message) +
      '. Nếu là lỗi bảng chưa tồn tại thì chạy <code>scripts/cskh-tables.sql</code> / <code>scripts/resend-tables.sql</code> trên Supabase trước.</p>';
  }
}

function wireCskh(){
  const reload = document.getElementById('cskh-reload');
  if (reload) reload.addEventListener('click', refreshCskh);
  const body = document.getElementById('cskh-body');
  if (body) body.addEventListener('click', (e) => {
    const hm = e.target.closest('[data-hm]');
    if (hm){ cskhHandleHm(hm); return; }
    const rs = e.target.closest('.btn-rs');
    if (rs) resendAct(rs);
  });
  const sel = document.getElementById('cskh-period');
  if (sel) sel.addEventListener('change', (e) => cskhRenderStats(e.target.value));
}

// ======================================================= TAB THỐNG KÊ =========
// Chỉ ĐỌC, không có nút. Dùng để hiểu khách / cải thiện, không phải việc phải làm.
const CSKH_PERIOD_LABEL = { day: 'hôm nay', yesterday: 'hôm qua', week: '7 ngày', month: 'tháng này' };

// Đếm SỐ ĐƠN (không phải số dòng) theo loại — cùng 1 đơn nhiều dòng chỉ tính 1
function cskhTypeCountHtml(reviews, returns, chats, resend, range){
  const sets = { 'Lỗi kho · giao nhầm': new Set(), 'Lỗi kho · giao thiếu': new Set(), 'Lỗi sản phẩm': new Set(),
    'Đánh giá 1–3★': new Set(), 'Trả hàng': new Set() };
  const key = (r, t, id) => cskhCaseKey(r.platform, r.order_code, t, id);
  const add = (r, t) => {
    const k = r.shop_error_kind, kk = key(r, t, r.id);
    if (k === 'giao_nham') sets['Lỗi kho · giao nhầm'].add(kk);
    if (k === 'giao_thieu') sets['Lỗi kho · giao thiếu'].add(kk);
    if (k === 'san_pham_loi') sets['Lỗi sản phẩm'].add(kk);
  };
  reviews.forEach(r => { add(r, 'cskh_reviews'); if ((r.stars || 5) <= 3) sets['Đánh giá 1–3★'].add(key(r, 'cskh_reviews', r.id)); });
  returns.forEach(r => { add(r, 'cskh_returns'); sets['Trả hàng'].add(key(r, 'cskh_returns', r.id)); });
  chats.forEach(r => add(r, 'cskh_chat_errors'));
  resend.filter(r => cskhInRange(cskhDateKey(new Date(r.created_at)), range))
    .forEach(r => sets['Lỗi kho · giao thiếu'].add(r.platform + '|' + r.orig_order_code));
  const rows = Object.entries(sets).map(([lb, s]) => [lb, s.size]);
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<div class="card"><div class="c-title">Số đơn theo loại <span style="font-weight:400;color:var(--ink-faint)">— 1 đơn tính 1 lần</span></div><table class="dtable"><tbody>${
    rows.map(([lb, n]) => `<tr><td>${esc(lb)}</td><td style="width:45%"><div class="bar-track"><div style="height:100%;width:${Math.round(n / max * 100)}%;background:var(--p2)"></div></div></td><td class="num">${fmtInt(n)}</td></tr>`).join('')
  }</tbody></table></div>`;
}

function cskhRenderStats(period){
  const bodyEl = document.getElementById('cskhstats-body');
  if (!bodyEl || !cskhRows) return;
  const range = cskhRange(period);
  const reviews = cskhRows.reviews.filter(r => cskhInRange(r.review_date, range));
  const returns = cskhRows.returns.filter(r => cskhInRange(r.request_date, range));
  const chats = cskhRows.chats.filter(r => cskhInRange(r.chat_date, range));
  const bad = reviews.filter(r => (r.stars || 5) <= 2).length;
  const byPlat = (rows) => 'TikTok ' + rows.filter(r => r.platform === 'tiktok').length + ' · Shopee ' + rows.filter(r => r.platform === 'shopee').length;
  const tiles = [['Đánh giá mới', reviews.length, byPlat(reviews) + (bad ? ' · ' + bad + ' cái 1–2★' : '')], ['Case trả hàng mới', returns.length, byPlat(returns)], ['Lỗi báo qua chat', chats.length, byPlat(chats)]];
  bodyEl.innerHTML = '<div class="kpi-row cskh-kpi">' + tiles.map(([l, v, s]) =>
      `<div class="kpi-tile"><div class="k-label">${esc(l)}</div><div class="k-value">${fmtInt(v)}</div><div class="k-sub">${esc(s)}</div></div>`).join('') + '</div>'
    + '<div class="zone"><span class="z-num">1</span><span class="z-title">Insight để cải thiện</span><span class="z-note">vấn đề lặp lại về sản phẩm / dịch vụ</span></div>'
    + cskhInsightHtml(reviews, returns, CSKH_PERIOD_LABEL[period])
    + '<div class="zone"><span class="z-num">2</span><span class="z-title">Số liệu kỳ</span><span class="z-note">loại việc · xu hướng · lý do trả hàng</span></div>'
    + `<div class="grid cols-2">${cskhTypeCountHtml(reviews, returns, chats, cskhRows.resend || [], range)}${cskhReasonsHtml(returns)}</div>`
    + `<div class="grid cols-2" style="margin-top:14px">${cskhSparkHtml(reviews, range, period)}</div>`;
}

function buildCskhStatsScreenHTML(){
  return `
  <div class="topbar">
    <div class="period">
      <select id="cskh-period">
        <option value="day">Hôm nay</option>
        <option value="yesterday">Hôm qua</option>
        <option value="week">7 ngày qua</option>
        <option value="month">Tháng này</option>
      </select>
    </div>
    <span class="up-status" id="cskhstats-updated"></span>
  </div>
  <div id="cskhstats-body"></div>
  <footer><p>Trang chỉ đọc. Việc cần làm nằm ở tab <b>Hậu mãi</b>.</p></footer>`;
}

async function refreshCskhStats(){
  const bodyEl = document.getElementById('cskhstats-body');
  if (!bodyEl) return;
  try {
    if (!cskhRows) await cskhLoadRows();
    cskhRenderStats(document.getElementById('cskh-period').value);
  } catch (err){
    bodyEl.innerHTML = '<p class="cskh-quiet">Chưa đọc được dữ liệu: ' + esc(err.message) + '</p>';
  }
}
// ---------------------------------------------------------- khối insight ---
function cskhInsightHtml(reviews, returns, periodLabel){
  const groups = new Map();
  const add = (row, kind) => {
    if (!row.insight_tag) return;
    if (!groups.has(row.insight_tag)) groups.set(row.insight_tag, { note: '', items: [] });
    const g = groups.get(row.insight_tag);
    if (row.insight_note && !g.note) g.note = row.insight_note;
    g.items.push({ row, kind, d: kind === 'return' ? row.request_date : row.review_date });
  };
  reviews.forEach(r => add(r, 'review'));
  returns.forEach(r => add(r, 'return'));
  if (!groups.size){
    return '<p class="cskh-quiet">Chưa có vấn đề nào lặp lại trong kỳ này — hoặc lần chạy gần nhất chưa gắn nhãn chủ đề nào.</p>';
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].items.length - a[1].items.length);
  return '<div class="feed">' + sorted.map(([tag, g]) => {
    const items = g.items.sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    // Gọn (29/10/2026): chỉ trích 1 câu mới nhất, cắt 1 dòng — hover xem đủ
    const quotes = items.slice(0, 1).map(i => {
      const text = i.kind === 'return'
        ? (i.row.customer_note || i.row.reason || '')
        : (i.row.content || '');
      return text ? `<p class="quote" title="${esc(text)}">“${esc(text)}”</p>` : '';
    }).join('');
    const latest = items.find(i => i.row.order_code);
    const link = latest
      ? `<div class="fi-foot"><a class="lnk" href="${CSKH_ORDER_URL[latest.row.platform] ? CSKH_ORDER_URL[latest.row.platform](latest.row.order_code, latest.row) : '#'}" target="_blank" rel="noopener">↗ Mở đơn gần nhất</a><span class="code">${esc(latest.row.order_code)}</span></div>`
      : '';
    const title = g.note || tag;
    // dòng phụ: nguồn của con số (mấy đánh giá, mấy case) + sản phẩm hay bị nhắc
    const nRev = items.filter(i => i.kind === 'review').length;
    const nRet = items.length - nRev;
    const prods = [...new Set(items.map(i => i.row.product).filter(Boolean))].slice(0, 2);
    const sub = [
      nRev ? nRev + ' đánh giá' : '',
      nRet ? nRet + ' case trả hàng' : '',
      prods.length ? prods.join(' · ') : '',
    ].filter(Boolean).join(' · ');
    return `<div class="ins">
      <div class="ins-head"><span class="ins-title">${esc(title)}</span>
        <span class="ins-count">${items.length} lần / ${esc(periodLabel)}</span></div>
      <div class="ins-sub">${esc(sub)}</div>
      ${quotes}${link}
    </div>`;
  }).join('') + '</div>';
}

// ------------------------------------------------------- khối số liệu kỳ ---
function cskhSparkHtml(reviews, range, period){
  // một cột mỗi ngày (kỳ ngày/tuần) hoặc mỗi tuần (kỳ tháng); phần đỏ = 1–2★
  const buckets = [];
  const from = new Date(range[0] + 'T00:00:00'), to = new Date(range[1] + 'T00:00:00');
  if (period === 'month'){
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 7)){
      const end = new Date(d); end.setDate(end.getDate() + 6);
      buckets.push({ label: fmtDMY(cskhDateKey(d)) || '', from: cskhDateKey(d), to: cskhDateKey(end > to ? to : end) });
    }
  } else {
    const DOW = ['CN','T2','T3','T4','T5','T6','T7'];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)){
      const k = cskhDateKey(d);
      buckets.push({ label: DOW[d.getDay()], from: k, to: k });
    }
  }
  const data = buckets.map(b => {
    const rows = reviews.filter(r => r.review_date >= b.from && r.review_date <= b.to);
    return { label: b.label, bad: rows.filter(r => (r.stars || 5) <= 2).length, ok: rows.filter(r => (r.stars || 5) > 2).length };
  });
  const max = Math.max(1, ...data.map(x => x.ok + x.bad));
  const cols = data.map(x => {
    const h = (n) => Math.round(n / max * 72);
    return `<div class="sc"><div class="sb"><div class="s-bad" style="height:${h(x.bad)}px"></div><div class="s-ok" style="height:${h(x.ok)}px"></div></div><span class="sl">${esc(x.label)}</span></div>`;
  }).join('');
  return `<div class="card"><div class="c-title">Đánh giá theo ${period === 'month' ? 'tuần' : 'ngày'} <span style="font-weight:400;color:var(--ink-faint)">— phần đỏ là 1–2★</span></div>
    <div class="spark">${cols}</div></div>`;
}

function cskhReasonsHtml(returns){
  const counts = new Map();
  returns.forEach(r => {
    const key = r.reason || 'Không ghi lý do';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<div class="card"><div class="c-title">Lý do trả hàng</div><p class="cskh-quiet">Chưa có case nào trong kỳ.</p></div>';
  const max = Math.max(...rows.map(r => r[1]));
  return `<div class="card"><div class="c-title">Lý do trả hàng</div><table class="dtable"><tbody>${
    rows.map(([lb, n]) => `<tr><td>${esc(lb)}</td>
      <td style="width:45%"><div class="bar-track"><div style="height:100%;width:${Math.round(n/max*100)}%;background:var(--p2)"></div></div></td>
      <td class="num">${fmtInt(n)}</td></tr>`).join('')
  }</tbody></table></div>`;
}
