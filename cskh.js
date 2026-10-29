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
function cskhKpiHtml(reviews, returns){
  const bad = reviews.filter(r => (r.stars || 5) <= 2).length;
  const action = reviews.filter(r => r.needs_action).length + returns.filter(r => r.needs_action).length;
  const byPlat = (rows) => {
    const tt = rows.filter(r => r.platform === 'tiktok').length;
    const sp = rows.filter(r => r.platform === 'shopee').length;
    return 'TikTok ' + tt + ' · Shopee ' + sp;
  };
  const tiles = [
    ['Đánh giá mới', reviews.length, byPlat(reviews) + (bad ? ' · ' + bad + ' cái 1–2★' : ''), false],
    ['Case trả hàng mới', returns.length, byPlat(returns), false],
    ['Cần anh xử lý', action, action ? 'xem danh sách ngay dưới' : 'không có gì tồn', true],
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
  return `<div class="fi bad compact">
    <div class="fi-line1"><span class="tag ${row.platform === 'shopee' ? 'shopee' : 'tiktok'}">${plat}</span>
      ${stars}${tag}<span class="when">${esc(cskhWhen(when))}</span>
      ${row.customer ? '<span class="cust">Khách <b>' + esc(row.customer) + '</b></span>' : ''}
      ${row.order_code ? '<span class="code">' + esc(row.order_code) + '</span>' : ''}</div>
    <div class="fi-line2">${snippet ? '<span class="snippet" title="' + esc(snippet.replace(/<[^>]*>/g, '')) + '">' + snippet + '</span>' : '<span class="snippet"></span>'}${link}</div>
  </div>`;
}

// Nhóm con trong "Cần anh xử lý" theo action_type (chốt 29/10/2026). Thứ tự ưu
// tiên: anh tự nhắn khách trước, rồi tranh chấp, rồi phần còn lại không gắn loại.
const CSKH_ACTION_GROUPS = [
  { type: 'lien_he_khach', title: 'Anh tự nhắn khách', note: 'đánh giá xấu đã nhắn 12h khách chưa trả lời — tìm tên khách trên TikTok, nhắn hỗ trợ' },
  { type: 'tranh_chap',    title: 'Tranh chấp / khiếu nại', note: 'khách đang đòi xử lý — chờ anh quyết' },
  { type: null,            title: 'Khác cần anh xem', note: '' },
];

function cskhActionHtml(reviews, returns){
  const items = [
    ...reviews.filter(r => r.needs_action).map(r => ({ row: r, kind: 'review', d: r.review_date })),
    ...returns.filter(r => r.needs_action).map(r => ({ row: r, kind: 'return', d: r.request_date })),
  ].sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  const restReviews = reviews.length - reviews.filter(r => r.needs_action).length;
  const restReturns = returns.length - returns.filter(r => r.needs_action).length;
  const quiet = (restReviews || restReturns)
    ? `<p class="cskh-quiet">${fmtInt(restReviews)} đánh giá và ${fmtInt(restReturns)} case trả hàng còn lại đã xử lý xong (đã nhắn khách theo mẫu, khách đã trả lời ổn, hoặc đã có người trả lời trước) — không cần anh làm gì.</p>`
    : '';
  if (!items.length){
    return `<p class="cskh-quiet">Không có gì cần anh xử lý trong kỳ này.</p>${quiet}`;
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
const CSKH_PERIOD_LABEL = { day: 'hôm nay', week: '7 ngày', month: 'tháng này' };

function cskhRender(period){
  const bodyEl = document.getElementById('cskh-body');
  if (!bodyEl || !cskhRows) return;
  const range = cskhRange(period);
  const reviews = cskhRows.reviews.filter(r => cskhInRange(r.review_date, range));
  const returns = cskhRows.returns.filter(r => cskhInRange(r.request_date, range));
  bodyEl.innerHTML = `
    ${cskhKpiHtml(reviews, returns)}
    <div class="zone"><span class="z-num">1</span><span class="z-title">Cần anh xử lý</span><span class="z-note">anh tự nhắn khách (đánh giá xấu đã nhắn 12h khách im) · tranh chấp</span></div>
    ${cskhActionHtml(reviews, returns)}
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
        <option value="week">7 ngày qua</option>
        <option value="month">Tháng này</option>
      </select>
    </div>
    <span class="up-status" id="cskh-updated">Đang tải…</span>
  </div>
  <div id="cskh-body"></div>
  <footer>
    <p><b>Nguồn:</b> skill <code>review-return-check</code> chạy 08:00 &amp; 20:00 trên PC trực, mỗi lần ghi từng đánh giá / từng case trả hàng thành 1 dòng vào Supabase. Trang này chỉ đọc lên, không tự vào sàn.</p>
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

function wireCskh(){
  const sel = document.getElementById('cskh-period');
  if (sel) sel.addEventListener('change', (e) => cskhRender(e.target.value));
}
