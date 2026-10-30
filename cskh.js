/* ============================================================================
   Tab "Đánh giá & Trả hàng" — đọc 2 bảng cskh_reviews / cskh_returns (schema ở
   scripts/cskh-tables.sql), do skill review-return-check ghi vào mỗi lần chạy
   08:00 & 20:00 trên PC trực. Trang này CHỈ ĐỌC, không tự vào sàn.

   Chốt 28/10/2026 sau 2 vòng mô phỏng với chủ shop:
   - Chọn kỳ bằng 1 ô drop (Hôm nay / 7 ngày / tháng này), không phải nút bấm.
   - KHÔNG hiển thị điểm trung bình và bảng "trạng thái nhắn khách" — chủ shop
     thấy thừa, chỉ cần biết cái gì cần động tay.
   - Chỉ liệt kê đánh giá/case CẦN XỬ LÝ, phần còn lại gộp thành 1 dòng xám.
   - Mỗi thẻ gắn link mở thẳng đơn trên sàn + vẫn in rõ mã đơn, tên khách để
     tra tay khi link hỏng (đánh giá không có link riêng, chỉ mở được trang
     hàng chờ trả lời).
============================================================================ */

const CSKH_LOOKBACK_DAYS = 45; // đủ cho kỳ "tháng này", tải 1 lần rồi lọc tại chỗ
let cskhRows = null;           // {reviews: [], returns: []} — cache sau lần tải đầu

const CSKH_ORDER_URL = {
  tiktok: (o) => 'https://seller-vn.tiktok.com/order/detail?order_no=' + encodeURIComponent(o),
  shopee: (o) => 'https://banhang.shopee.vn/portal/sale/order/' + encodeURIComponent(o),
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

async function cskhLoadRows(){
  if (cskhRows) return cskhRows;
  const from = new Date(cskhToday()); from.setDate(from.getDate() - CSKH_LOOKBACK_DAYS);
  const since = cskhDateKey(from);
  const [reviews, returns] = await Promise.all([
    sbFetch('cskh_reviews?select=*&review_date=gte.' + since + '&order=review_date.desc&limit=2000'),
    sbFetch('cskh_returns?select=*&request_date=gte.' + since + '&order=request_date.desc&limit=2000'),
  ]);
  cskhRows = { reviews: reviews || [], returns: returns || [] };
  return cskhRows;
}

// ---------------------------------------------------------------- khối số --
function cskhKpiHtml(reviews, returns, pendingAction){
  const bad = reviews.filter(r => (r.stars || 5) <= 2).length;
  const action = pendingAction;
  const byPlat = (rows) => {
    const tt = rows.filter(r => r.platform === 'tiktok').length;
    const sp = rows.filter(r => r.platform === 'shopee').length;
    return 'TikTok ' + tt + ' · Shopee ' + sp;
  };
  const tiles = [
    ['Đánh giá mới', reviews.length, byPlat(reviews) + (bad ? ' · ' + bad + ' cái 1–2★' : ''), false],
    ['Case trả hàng mới', returns.length, byPlat(returns), false],
    ['Cần anh xử lý', action, action ? 'xem danh sách ngay dưới — không phụ thuộc kỳ' : 'không có gì tồn', true],
  ];
  return '<div class="kpi-row cskh-kpi">' + tiles.map(([label, val, sub, warn]) =>
    `<div class="kpi-tile"><div class="k-label">${esc(label)}</div>
      <div class="k-value"${warn && val ? ' style="color:var(--warn)"' : ''}>${fmtInt(val)}</div>
      <div class="k-sub">${esc(sub)}</div></div>`
  ).join('') + '</div>';
}

// ------------------------------------------------------- khối cần xử lý ----
// Thẻ gọn (chốt 29/10/2026): bỏ action_note (nhóm cha đã nói), bỏ message_note
// và product khỏi mặt thẻ. Còn đúng 2 dòng — dòng meta để nhận diện + tra khách,
// dòng nội dung cắt gọn 1 dòng (hover xem đủ) kèm link mở.
function cskhActionCardHtml(row, kind){
  const plat = cskhPlatName(row.platform);
  const link = kind === 'return' && row.order_code
    ? `<a class="lnk" href="${CSKH_ORDER_URL[row.platform] ? CSKH_ORDER_URL[row.platform](row.order_code) : '#'}" target="_blank" rel="noopener">↗ Mở đơn</a>`
    : `<a class="lnk" href="${CSKH_REVIEW_URL[row.platform] || CSKH_REVIEW_URL.tiktok}" target="_blank" rel="noopener">↗ Đánh giá</a>`;
  const stars = row.stars ? '<span class="stars">' + '★'.repeat(row.stars) + '☆'.repeat(5 - row.stars) + '</span>' : '';
  const tag = kind === 'return' && row.reason ? '<span class="tag why">' + esc(row.reason) + '</span>' : '';
  const snippet = kind === 'return'
    ? (row.customer_note ? 'Khách ghi: “' + esc(row.customer_note) + '”' : (row.amount ? fmtVND(row.amount) : ''))
    : esc(row.content || '(chỉ bấm sao, không viết)');
  const when = kind === 'return' ? row.request_date : row.review_date;
  const ackLabel = kind === 'return' ? 'Đã xem' : 'Đã xử lý';
  const ackBtn = `<button class="btn-ack" data-tbl="${kind === 'return' ? 'cskh_returns' : 'cskh_reviews'}" data-id="${esc(String(row.id))}">${esc(ackLabel)}</button>`;
  return `<div class="fi bad compact" data-row-tbl="${kind === 'return' ? 'cskh_returns' : 'cskh_reviews'}" data-row-id="${esc(String(row.id))}">
    <div class="fi-line1"><span class="tag ${row.platform === 'shopee' ? 'shopee' : 'tiktok'}">${plat}</span>
      ${stars}${tag}<span class="when">${esc(cskhWhen(when))}</span>
      ${row.customer ? '<span class="cust">Khách <b>' + esc(row.customer) + '</b></span>' : ''}
      ${row.order_code ? '<span class="code">' + esc(row.order_code) + '</span>' : ''}</div>
    <div class="fi-line2">${snippet ? '<span class="snippet" title="' + esc(snippet.replace(/<[^>]*>/g, '')) + '">' + snippet + '</span>' : '<span class="snippet"></span>'}${link}${ackBtn}</div>
  </div>`;
}

// Nhóm con trong "Cần anh xử lý" theo action_type (chốt 29/10/2026). Thứ tự ưu
// tiên: anh tự nhắn khách trước, rồi tranh chấp, rồi phần còn lại không gắn loại.
const CSKH_ACTION_GROUPS = [
  { type: 'lien_he_khach', title: 'Anh tự nhắn khách', note: 'đánh giá xấu đã nhắn 12h khách chưa trả lời — tìm tên khách trên TikTok, nhắn hỗ trợ' },
  { type: 'tranh_chap',    title: 'Tranh chấp / khiếu nại', note: 'khách đang đòi xử lý — chờ anh quyết' },
  { type: null,            title: 'Khác cần anh xem', note: '' },
];

// Zone 1 CỐ TÌNH không lọc theo kỳ (period) — case nửa đêm vẫn phải hiện sáng
// hôm sau, không bị khung Hôm nay/Hôm qua che mất (chốt 30/10/2026). Chỉ ẩn
// khi đã bấm "Đã xử lý/Đã xem" (acked_at) — đây là cách duy nhất item biến mất.
function cskhActionHtml(allReviews, allReturns){
  const pendingReviews = allReviews.filter(r => r.needs_action && !r.acked_at);
  const pendingReturns = allReturns.filter(r => r.needs_action && !r.acked_at);
  const items = [
    ...pendingReviews.map(r => ({ row: r, kind: 'review', d: r.review_date })),
    ...pendingReturns.map(r => ({ row: r, kind: 'return', d: r.request_date })),
  ].sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  const restReviews = allReviews.filter(r => r.needs_action && r.acked_at).length
    + allReviews.filter(r => !r.needs_action).length;
  const restReturns = allReturns.filter(r => r.needs_action && r.acked_at).length
    + allReturns.filter(r => !r.needs_action).length;
  const quiet = (restReviews || restReturns)
    ? `<p class="cskh-quiet">${fmtInt(restReviews)} đánh giá và ${fmtInt(restReturns)} case trả hàng còn lại đã xử lý xong (đã nhắn khách theo mẫu, khách đã trả lời ổn, đã có người trả lời trước, hoặc anh đã bấm đã xử lý/đã xem) — không cần anh làm gì.</p>`
    : '';
  if (!items.length){
    return `<p class="cskh-quiet">Không có gì cần anh xử lý — kể cả những việc phát sinh ngoài giờ, không phụ thuộc kỳ đang chọn ở trên.</p>${quiet}`;
  }
  const known = new Set(['lien_he_khach', 'tranh_chap']);
  const html = CSKH_ACTION_GROUPS.map(g => {
    const rows = g.type
      ? items.filter(i => i.row.action_type === g.type)
      : items.filter(i => !known.has(i.row.action_type));
    if (!rows.length) return '';
    return `<div class="act-group"><div class="act-head"><b>${esc(g.title)}</b>`
      + `<span class="act-n">${fmtInt(rows.length)}</span>`
      + (g.note ? `<span class="act-note">${esc(g.note)}</span>` : '') + '</div>'
      + '<div class="feed">' + rows.map(i => cskhActionCardHtml(i.row, i.kind)).join('') + '</div></div>';
  }).join('');
  return html + quiet;
}

// ------------------------------------------- khối ghi lỗi sang Sổ Kho ------
// Chốt 29/10/2026: skill CHỈ ĐỀ XUẤT (errlog_status='suggest'); chủ shop bấm
// nút ở đây mới thật sự insert vào warehouse_error_log — tránh tự ghi làm tăng
// nhầm % lỗi NV/NCC. giao_thieu không hiện nút (để resend-missing-item lo).
const CSKH_ERRKIND = {
  giao_nham:    { etype: 'kho_van',  dreason: 'giao_nham',    label: 'giao nhầm (lỗi kho)' },
  san_pham_loi: { etype: 'san_pham', dreason: 'san_pham_loi', label: 'lỗi sản phẩm (NCC)' },
};

function cskhErrlogRows(reviews, returns){
  return [
    ...reviews.map(r => ({ row: r, kind: 'review', tbl: 'cskh_reviews', d: r.review_date })),
    ...returns.map(r => ({ row: r, kind: 'return', tbl: 'cskh_returns', d: r.request_date })),
  ].filter(i => i.row.errlog_status && i.row.errlog_status !== 'none')
   .sort((a, b) => (b.d || '').localeCompare(a.d || ''));
}

function cskhErrlogCardHtml(i){
  const r = i.row;
  const plat = cskhPlatName(r.platform);
  const kind = CSKH_ERRKIND[r.shop_error_kind];
  const meta = `<span class="tag ${r.platform === 'shopee' ? 'shopee' : 'tiktok'}">${plat}</span>`
    + (r.order_code ? '<span class="code">' + esc(r.order_code) + '</span>' : '')
    + (r.errlog_code ? '<span class="code" title="mã vận đơn">VĐ ' + esc(r.errlog_code) + '</span>' : '')
    + (r.customer ? '<span class="cust">Khách <b>' + esc(r.customer) + '</b></span>' : '');
  const why = esc(r.errlog_reason || r.reason || r.content || '');
  let ctrl;
  if (r.errlog_status === 'written'){
    ctrl = `<span class="err-done">✓ đã ghi Sổ Kho${r.errlog_id ? ' (#' + esc(String(r.errlog_id)) + ')' : ''}</span>`;
  } else if (r.errlog_status === 'dup'){
    ctrl = `<span class="err-skip">Sổ Kho đã có dòng cho mã vận đơn này — không ghi lại</span>`;
  } else if (r.errlog_status === 'owned_resend'){
    ctrl = `<span class="err-skip">Giao thiếu — đơn gửi bù (resend) đã/đang lo, không ghi ở đây</span>`;
  } else if (r.errlog_status === 'suggest' && kind && r.errlog_code){
    ctrl = `<button class="btn-errlog" data-tbl="${esc(i.tbl)}" data-id="${esc(String(r.id))}"`
      + ` data-code="${esc(r.errlog_code)}" data-etype="${kind.etype}" data-dreason="${kind.dreason}"`
      + ` data-reason="${esc(r.errlog_reason || '')}">Xác nhận ghi Sổ Kho: ${esc(kind.label)}</button>`;
  } else if (r.errlog_status === 'suggest'){
    ctrl = `<span class="err-skip">Nghi lỗi shop nhưng chưa đủ dữ liệu (thiếu mã vận đơn/loại lỗi) — anh kiểm tay</span>`;
  } else { ctrl = ''; }
  return `<div class="fi compact err"><div class="fi-line1">${meta}</div>`
    + `<div class="fi-line2"><span class="snippet" title="${why}">${why}</span></div>`
    + `<div class="err-foot">${ctrl}</div></div>`;
}

function cskhErrlogHtml(reviews, returns){
  const rows = cskhErrlogRows(reviews, returns);
  if (!rows.length) return '';
  const pending = rows.filter(i => i.row.errlog_status === 'suggest' && CSKH_ERRKIND[i.row.shop_error_kind] && i.row.errlog_code).length;
  const head = `<div class="sub-label">Ghi lỗi vào Sổ Kho${pending ? ' · ' + fmtInt(pending) + ' chờ anh xác nhận' : ''}</div>`;
  return head + '<div class="feed">' + rows.map(cskhErrlogCardHtml).join('') + '</div>';
}

// Bấm nút "Xác nhận ghi Sổ Kho" → insert warehouse_error_log + đánh dấu dòng cskh.
async function cskhWriteErrlog(btn){
  const code = btn.dataset.code;
  btn.disabled = true; const old = btn.textContent; btn.textContent = 'Đang ghi…';
  try {
    // dò trùng ngay lúc bấm (phòng khi vừa có dòng khác ghi cùng mã vận đơn)
    const dup = await sbFetch('warehouse_error_log?select=id&code=eq.' + encodeURIComponent(code) + '&limit=1');
    let errId;
    if (dup && dup.length){
      errId = dup[0].id;
      await sbFetch(btn.dataset.tbl + '?id=eq.' + encodeURIComponent(btn.dataset.id),
        { method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ errlog_status: 'dup', errlog_id: errId }) });
      btn.outerHTML = '<span class="err-skip">Sổ Kho đã có dòng cho mã vận đơn này — không ghi lại</span>';
      return;
    }
    const ins = await sbFetch('warehouse_error_log', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ code, error_type: btn.dataset.etype, detail_reason: btn.dataset.dreason, reason: btn.dataset.reason || null }) });
    errId = ins && ins[0] && ins[0].id;
    await sbFetch(btn.dataset.tbl + '?id=eq.' + encodeURIComponent(btn.dataset.id),
      { method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ errlog_status: 'written', errlog_id: errId || null }) });
    // cập nhật cache cục bộ để lọc kỳ không dựng lại nút
    const list = (btn.dataset.tbl === 'cskh_returns' ? cskhRows.returns : cskhRows.reviews);
    const rec = list.find(x => String(x.id) === btn.dataset.id);
    if (rec){ rec.errlog_status = 'written'; rec.errlog_id = errId; }
    btn.outerHTML = '<span class="err-done">✓ đã ghi Sổ Kho' + (errId ? ' (#' + errId + ')' : '') + '</span>';
  } catch (err){
    btn.disabled = false; btn.textContent = old;
    alert('Chưa ghi được Sổ Kho: ' + err.message);
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
      ? `<div class="fi-foot"><a class="lnk" href="${CSKH_ORDER_URL[latest.row.platform] ? CSKH_ORDER_URL[latest.row.platform](latest.row.order_code) : '#'}" target="_blank" rel="noopener">↗ Mở đơn gần nhất</a><span class="code">${esc(latest.row.order_code)}</span></div>`
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

// ---------------------------------------------------------------- render ---
const CSKH_PERIOD_LABEL = { day: 'hôm nay', yesterday: 'hôm qua', week: '7 ngày', month: 'tháng này' };

function cskhRender(period){
  const bodyEl = document.getElementById('cskh-body');
  if (!bodyEl || !cskhRows) return;
  const range = cskhRange(period);
  const reviews = cskhRows.reviews.filter(r => cskhInRange(r.review_date, range));
  const returns = cskhRows.returns.filter(r => cskhInRange(r.request_date, range));
  // Zone 1 + ghi lỗi Sổ Kho dùng TOÀN BỘ dữ liệu đã tải (không lọc theo kỳ
  // đang chọn) — chốt 30/10/2026: case phát sinh nửa đêm không được biến mất
  // chỉ vì đang xem "Hôm nay" mà nó rơi vào "Hôm qua". Chỉ hết khi bấm ack.
  const pendingAction = cskhRows.reviews.filter(r => r.needs_action && !r.acked_at).length
    + cskhRows.returns.filter(r => r.needs_action && !r.acked_at).length;
  bodyEl.innerHTML = `
    ${cskhKpiHtml(reviews, returns, pendingAction)}
    <div class="zone"><span class="z-num">1</span><span class="z-title">Cần anh xử lý</span><span class="z-note">anh tự nhắn khách (đánh giá xấu đã nhắn 12h khách im) · tranh chấp · ghi lỗi Sổ Kho — luôn hiện đủ, không phụ thuộc kỳ đang chọn</span></div>
    ${cskhActionHtml(cskhRows.reviews, cskhRows.returns)}
    ${cskhErrlogHtml(cskhRows.reviews, cskhRows.returns)}
    <div class="zone"><span class="z-num">2</span><span class="z-title">Insight để cải thiện</span><span class="z-note">vấn đề lặp lại về sản phẩm / dịch vụ</span></div>
    ${cskhInsightHtml(reviews, returns, CSKH_PERIOD_LABEL[period])}
    <div class="zone"><span class="z-num">3</span><span class="z-title">Số liệu kỳ</span><span class="z-note">xu hướng · lý do trả hàng</span></div>
    <div class="grid cols-2">${cskhSparkHtml(reviews, range, period)}${cskhReasonsHtml(returns)}</div>`;
}

function buildCskhScreenHTML(){
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
    <span class="up-status" id="cskh-updated">Đang tải…</span>
  </div>
  <div id="cskh-body"></div>
  <footer>
    <p><b>Nguồn:</b> skill <code>review-return-check</code> chạy 08:00 &amp; 20:00 trên PC trực, mỗi lần ghi từng đánh giá / từng case trả hàng thành 1 dòng vào Supabase. Trang chỉ đọc lên, không tự vào sàn; riêng nút "Xác nhận ghi Sổ Kho" khi anh bấm sẽ ghi 1 dòng lỗi vào Sổ Kho (<code>warehouse_error_log</code>).</p>
    <p><b>Link:</b> nút "Mở đơn" ghép thẳng từ mã đơn. Sàn không có link riêng cho từng đánh giá nên nút đánh giá chỉ mở trang hàng chờ trả lời — tìm theo tên khách ghi kèm.</p>
  </footer>`;
}

async function refreshCskh(){
  const statusEl = document.getElementById('cskh-updated');
  const bodyEl = document.getElementById('cskh-body');
  if (!bodyEl) return;
  if (cskhRows){ cskhRender(document.getElementById('cskh-period').value); return; }
  try {
    await cskhLoadRows();
    const all = [...cskhRows.reviews.map(r => r.created_at), ...cskhRows.returns.map(r => r.created_at)].filter(Boolean).sort();
    const last = all.length ? new Date(all[all.length - 1]) : null;
    statusEl.textContent = last
      ? 'Cập nhật ' + last.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) + ' · tự chạy 08:00 & 20:00'
      : 'Chưa có dữ liệu · skill tự chạy 08:00 & 20:00 trên PC trực';
    cskhRender(document.getElementById('cskh-period').value);
  } catch (err){
    statusEl.textContent = '';
    bodyEl.innerHTML = '<p class="cskh-quiet">Chưa đọc được dữ liệu: ' + esc(err.message) +
      '. Nếu là lỗi bảng chưa tồn tại thì chạy <code>scripts/cskh-tables.sql</code> trên Supabase trước.</p>';
  }
}

// Bấm "Đã xử lý"/"Đã xem" → set acked_at, cập nhật cache cục bộ rồi render lại
// (chốt 30/10/2026 — cách duy nhất 1 case rời khỏi Zone 1, không liên quan kỳ).
async function cskhAck(btn){
  const tbl = btn.dataset.tbl, id = btn.dataset.id;
  btn.disabled = true; const old = btn.textContent; btn.textContent = 'Đang lưu…';
  try {
    const now = new Date().toISOString();
    await sbFetch(tbl + '?id=eq.' + encodeURIComponent(id),
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ acked_at: now }) });
    const list = (tbl === 'cskh_returns' ? cskhRows.returns : cskhRows.reviews);
    const rec = list.find(x => String(x.id) === id);
    if (rec) rec.acked_at = now;
    cskhRender(document.getElementById('cskh-period').value);
  } catch (err){
    btn.disabled = false; btn.textContent = old;
    alert('Chưa lưu được: ' + err.message);
  }
}

function wireCskh(){
  const sel = document.getElementById('cskh-period');
  if (sel) sel.addEventListener('change', (e) => cskhRender(e.target.value));
  // nút "Xác nhận ghi Sổ Kho" / "Đã xử lý" / "Đã xem" (delegation — thẻ được
  // render lại mỗi lần đổi kỳ hoặc sau khi ack).
  const body = document.getElementById('cskh-body');
  if (body) body.addEventListener('click', (e) => {
    const errBtn = e.target.closest('.btn-errlog');
    if (errBtn){ cskhWriteErrlog(errBtn); return; }
    const ackBtn = e.target.closest('.btn-ack');
    if (ackBtn) cskhAck(ackBtn);
  });
}
