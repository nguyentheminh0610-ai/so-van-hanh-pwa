/* ============================================================================
   Tab "Gửi bù" — duyệt các case khách báo thiếu hàng (chốt 17/11/2026).
   Dữ liệu: bảng resend_cases (schema ở scripts/resend-tables.sql), do task CSKH
   và task gửi bù trên PC trực ghi. Luồng + mẫu tin:
   .claude/skills/resend-missing-item/references/resend-flow-batch-2026-11-17.md

   Trang này ghi vào DB ĐÚNG MỘT VIỆC: đổi status khi anh bấm nút. Mọi lần đổi
   đều CÓ ĐIỀU KIỆN (PATCH ...&status=eq.<cũ>) nên bấm 2 lần / 2 máy cùng bấm
   không làm hỏng trạng thái. Không có SĐT/địa chỉ đầy đủ trong bảng (khoá anon
   nằm trong repo public) — bản đầy đủ anh xem ở tin Telegram.
============================================================================ */

const RESEND_RUN_HOUR = 15;      // phiên tạo đơn lúc 15h
const RESEND_CHECK2_MIN = 40;    // duyệt lần 2 trước 15h40 (kho in đơn lần cuối 16h)
const RESEND_LOOKBACK_DAYS = 14; // case đã xong chỉ hiện trong 14 ngày
let resendRows = null;

const RESEND_STATUS = {
  collecting:     'Đang hỏi thông tin khách',
  verifying:      'Chờ khách xác nhận thông tin',
  wait_approve_1: 'Chờ anh duyệt lần 1',
  approved:       'Đã duyệt, chờ phiên tạo đơn',
  creating:       'Đang tạo đơn SPX',
  wait_approve_2: 'Chờ anh duyệt lần 2',
  finalizing:     'Đang ghi Sổ Kho + nhắn khách',
  done:           'Xong',
  stalled:        'Treo',
  blocked:        'Anh đã chặn',
  cancelled:      'Đã dừng',
};

const RESEND_CONF = {
  high:   { label: 'chắc',     cls: 'ok'   },
  medium: { label: 'khá chắc', cls: 'mid'  },
  low:    { label: 'chưa chắc — anh kiểm lại món', cls: 'low' },
};

function resendMinText(m){
  if (m < 60) return m + ' phút';
  const h = Math.floor(m / 60), r = m % 60;
  return h + 'h' + (r ? String(r).padStart(2, '0') : '');
}

// Hạn hành động của anh cho 1 case — dựa vào run_date (ngày phiên tạo đơn xử lý
// case này; task ghi lúc khách xác nhận: trước 14h = hôm nay, sau 14h = ngày mai).
function resendDeadline(row){
  const now = new Date();
  const todayKey = cskhDateKey(cskhToday());
  if (row.status === 'wait_approve_1' || row.status === 'approved'){
    if (!row.run_date) return { text: 'Chưa có ngày chạy — task sẽ ghi sau', late: false };
    const run = new Date(row.run_date + 'T' + String(RESEND_RUN_HOUR).padStart(2, '0') + ':00:00');
    const mins = Math.round((run - now) / 60000);
    if (row.status === 'approved') return { text: 'Phiên tạo đơn ' + RESEND_RUN_HOUR + 'h ' + (row.run_date === todayKey ? 'hôm nay' : fmtDMY(row.run_date)), late: false };
    if (mins > 0) return { text: 'Duyệt trước ' + RESEND_RUN_HOUR + 'h ' + (row.run_date === todayKey ? 'hôm nay' : fmtDMY(row.run_date)) + ' (còn ' + resendMinText(mins) + ')', late: mins <= 30 };
    return { text: 'Đã quá ' + RESEND_RUN_HOUR + 'h — case này sẽ trượt sang phiên ngày mai, cần tin xin lỗi khách', late: true };
  }
  if (row.status === 'wait_approve_2'){
    const lim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), RESEND_RUN_HOUR, RESEND_CHECK2_MIN);
    const mins = Math.round((lim - now) / 60000);
    if (mins > 0) return { text: 'Duyệt trước ' + RESEND_RUN_HOUR + 'h' + RESEND_CHECK2_MIN + ' để kho kịp in 16h (còn ' + resendMinText(mins) + ')', late: mins <= 15 };
    return { text: 'Đã quá ' + RESEND_RUN_HOUR + 'h' + RESEND_CHECK2_MIN + ' — kho có thể không kịp in 16h', late: true };
  }
  return { text: '', late: false };
}

async function resendLoadRows(){
  const from = new Date(cskhToday()); from.setDate(from.getDate() - RESEND_LOOKBACK_DAYS);
  const since = cskhDateKey(from);
  const [live, recent] = await Promise.all([
    sbFetch('resend_cases?select=*&status=not.in.(done,cancelled)&order=created_at.desc&limit=500'),
    sbFetch('resend_cases?select=*&created_at=gte.' + since + 'T00:00:00&order=created_at.desc&limit=500'),
  ]);
  const byId = new Map();
  [...(live || []), ...(recent || [])].forEach(r => byId.set(r.id, r));
  resendRows = [...byId.values()].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return resendRows;
}

// ------------------------------------------------------------------ thẻ -----
function resendPdfUrl(row){
  if (!row.label_pdf) return '';
  const c = getConfig();
  return c.url + '/storage/v1/object/public/notices-pdf/' + encodeURIComponent(row.label_pdf);
}

function resendCheckHtml(text){
  if (!text) return '';
  return '<div class="rs-check">' + String(text).split('\n').filter(Boolean).map(l => {
    const bad = /^\s*(✗|x\b|sai|lỗi)/i.test(l);
    return '<div class="' + (bad ? 'rs-bad' : 'rs-good') + '">' + esc(l) + '</div>';
  }).join('') + '</div>';
}

function resendBtn(label, cls, action, row, extra){
  return '<button class="btn-rs ' + cls + '" data-act="' + action + '" data-id="' + esc(String(row.id)) + '"' + (extra || '') + '>' + esc(label) + '</button>';
}

function resendCardHtml(row){
  const plat = cskhPlatName(row.platform);
  const dl = resendDeadline(row);
  const conf = RESEND_CONF[row.item_confidence];
  const orderLink = CSKH_ORDER_URL[row.platform]
    ? '<a class="lnk" href="' + CSKH_ORDER_URL[row.platform](row.orig_order_code) + '" target="_blank" rel="noopener">↗ Mở đơn gốc</a>' : '';
  const line1 = '<span class="tag ' + (row.platform === 'shopee' ? 'shopee' : 'tiktok') + '">' + plat + '</span>'
    + '<span class="cust">Khách <b>' + esc(row.handle) + '</b></span>'
    + '<span class="code">' + esc(row.orig_order_code) + '</span>'
    + (row.confirm_slot === 'tomorrow' ? '<span class="tag why">đi ngày mai</span>' : '')
    + (row.approved_override ? '<span class="tag why">duyệt dù khách chưa xác nhận</span>' : '');
  const body = [
    '<div class="rs-item">Thiếu: <b>' + esc(row.item_summary) + '</b>'
      + (conf ? ' <span class="rs-conf ' + conf.cls + '">' + esc(conf.label) + '</span>' : '') + '</div>',
    row.item_evidence ? '<div class="rs-sub">' + esc(row.item_evidence) + '</div>' : '',
    row.order_items ? '<div class="rs-sub">Đơn gốc có: ' + esc(row.order_items) + '</div>' : '',
    row.recipient_masked ? '<div class="rs-sub">Người nhận: ' + esc(row.recipient_masked) + ' <span class="rs-faint">(đầy đủ ở tin Telegram)</span></div>' : '',
  ].join('');

  let extra = '', btns = '';
  if (row.status === 'wait_approve_1'){
    btns = resendBtn('Duyệt', 'ok', 'approve1', row)
      + resendBtn('Sửa món', 'edit', 'edit', row)
      + resendBtn('Dừng', 'stop', 'stop', row);
  } else if (row.status === 'wait_approve_2'){
    const url = resendPdfUrl(row);
    extra = '<div class="rs-sub">Mã vận đơn mới: <b class="code">' + esc(row.spx_tracking || '—') + '</b>'
      + (url ? ' <a class="lnk" href="' + esc(url) + '" target="_blank" rel="noopener">Xem PDF</a>' : ' <span class="rs-bad">(chưa có PDF)</span>') + '</div>'
      + resendCheckHtml(row.check_result)
      + (row.check_ok === false ? '<div class="rs-bad">Tự đối chiếu phát hiện chỗ KHÔNG khớp — xem kỹ trước khi duyệt</div>' : '');
    btns = resendBtn('Duyệt lần 2', 'ok', 'approve2', row)
      + resendBtn('Chưa ổn', 'stop', 'block', row);
  } else if (row.status === 'verifying' || row.status === 'stalled'){
    btns = resendBtn('Duyệt dù khách chưa xác nhận', 'edit', 'override', row)
      + resendBtn('Dừng', 'stop', 'stop', row);
  } else if (row.status === 'collecting' || row.status === 'approved'){
    btns = resendBtn('Dừng', 'stop', 'stop', row);
  }
  const stateLine = '<span class="rs-state">' + esc(RESEND_STATUS[row.status] || row.status) + '</span>'
    + (row.stall_reason && (row.status === 'stalled') ? ' · ' + esc(row.stall_reason) : '')
    + (row.owner_note ? ' · ghi chú: ' + esc(row.owner_note) : '')
    + (row.last_error && row.status !== 'done' ? ' · <span class="rs-bad">lỗi gần nhất: ' + esc(row.last_error) + '</span>' : '');
  return '<div class="fi compact rs-card' + (dl.late ? ' rs-late' : '') + '" data-id="' + esc(String(row.id)) + '">'
    + '<div class="fi-line1">' + line1 + '<span class="when">' + esc(fmtDMY(cskhDateKey(new Date(row.created_at))) || '') + '</span></div>'
    + '<div class="rs-body">' + body + extra + '</div>'
    + '<div class="rs-state-line">' + stateLine + (dl.text ? ' · <span class="rs-dl' + (dl.late ? ' late' : '') + '">' + esc(dl.text) + '</span>' : '') + '</div>'
    + '<div class="err-foot">' + btns + orderLink + '</div></div>';
}

function resendDoneRowHtml(row){
  const url = resendPdfUrl(row);
  return '<tr><td>' + esc(row.handle) + '</td><td>' + esc(row.item_summary) + '</td>'
    + '<td class="code">' + esc(row.spx_tracking || '—') + '</td>'
    + '<td>' + esc(RESEND_STATUS[row.status] || row.status) + '</td>'
    + '<td>' + (url ? '<a class="lnk" href="' + esc(url) + '" target="_blank" rel="noopener">PDF</a>' : '') + '</td></tr>';
}

// --------------------------------------------------------------- render -----
function resendRender(){
  const bodyEl = document.getElementById('resend-body');
  if (!bodyEl || !resendRows) return;
  const rows = resendRows;
  const need = rows.filter(r => r.status === 'wait_approve_1' || r.status === 'wait_approve_2');
  const stuck = rows.filter(r => r.status === 'stalled' || r.status === 'verifying');
  const running = rows.filter(r => ['collecting', 'approved', 'creating', 'finalizing'].includes(r.status));
  const closed = rows.filter(r => ['done', 'blocked', 'cancelled'].includes(r.status)).slice(0, 30);

  const group = (title, note, list, empty) => '<div class="act-group"><div class="act-head"><b>' + esc(title) + '</b>'
    + (list.length ? '<span class="act-n">' + fmtInt(list.length) + '</span>' : '')
    + (note ? '<span class="act-note">' + esc(note) + '</span>' : '') + '</div>'
    + (list.length ? '<div class="feed">' + list.map(resendCardHtml).join('') + '</div>' : '<p class="cskh-quiet">' + esc(empty) + '</p>') + '</div>';

  const tiles = [
    ['Chờ anh duyệt', need.length, need.filter(r => r.status === 'wait_approve_1').length + ' lần 1 · ' + need.filter(r => r.status === 'wait_approve_2').length + ' lần 2', true],
    ['Đang chạy', running.length, 'đang hỏi khách / chờ phiên ' + RESEND_RUN_HOUR + 'h', false],
    ['Treo / chờ khách', stuck.length, stuck.length ? 'anh có thể duyệt dù khách chưa xác nhận' : 'không có', false],
  ];
  const kpi = '<div class="kpi-row cskh-kpi">' + tiles.map(([label, val, sub, warn]) =>
    '<div class="kpi-tile"><div class="k-label">' + esc(label) + '</div><div class="k-value"' + (warn && val ? ' style="color:var(--warn)"' : '') + '>'
    + fmtInt(val) + '</div><div class="k-sub">' + esc(sub) + '</div></div>').join('') + '</div>';

  bodyEl.innerHTML = kpi
    + group('Chờ anh duyệt', 'lần 1: trước ' + RESEND_RUN_HOUR + 'h để đơn vào phiên · lần 2: trước ' + RESEND_RUN_HOUR + 'h' + RESEND_CHECK2_MIN + ' để kho kịp in', need, 'Không có case nào chờ anh.')
    + (stuck.length ? group('Treo / chờ khách xác nhận', 'khách im lặng hoặc task gặp lỗi lặp', stuck, '') : '')
    + (running.length ? group('Đang chạy', 'em đang xử lý, anh không cần làm gì', running, '') : '')
    + '<div class="act-group"><div class="act-head"><b>Xong / đã dừng gần đây</b></div>'
    + (closed.length
      ? '<div class="card"><table class="dtable"><thead><tr><th>Khách</th><th>Món</th><th>Mã vận đơn</th><th>Trạng thái</th><th></th></tr></thead><tbody>'
        + closed.map(resendDoneRowHtml).join('') + '</tbody></table></div>'
      : '<p class="cskh-quiet">Chưa có case nào xong trong ' + RESEND_LOOKBACK_DAYS + ' ngày qua.</p>')
    + '</div>';
}

function buildResendScreenHTML(){
  return `
  <div class="topbar">
    <button class="btn-rs edit" id="resend-reload">Tải lại</button>
    <span class="up-status" id="resend-updated">Đang tải…</span>
  </div>
  <div id="resend-body"></div>
  <footer>
    <p><b>Luồng:</b> khách báo thiếu → em hỏi thông tin + gửi tin xác minh → khách xác nhận → <b>anh duyệt lần 1</b> → phiên tạo đơn ${RESEND_RUN_HOUR}h hằng ngày → <b>anh duyệt lần 2</b> (xem PDF) → em ghi Sổ Kho + nhắn khách. Khách xác nhận sau 14h thì đơn đi ngày mai.</p>
    <p><b>Riêng tư:</b> bảng không lưu SĐT/địa chỉ đầy đủ (khoá truy cập nằm trong repo public); bản đầy đủ chỉ có ở tin Telegram gửi anh và file cục bộ trên PC.</p>
  </footer>`;
}

async function refreshResend(){
  const statusEl = document.getElementById('resend-updated');
  const bodyEl = document.getElementById('resend-body');
  if (!bodyEl) return;
  try {
    await resendLoadRows(); // luôn tải lại: tab này nhạy thời gian, không cache như tab CSKH
    statusEl.textContent = 'Cập nhật ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    resendRender();
  } catch (err){
    statusEl.textContent = '';
    bodyEl.innerHTML = '<p class="cskh-quiet">Chưa đọc được dữ liệu: ' + esc(err.message)
      + '. Nếu là lỗi bảng chưa tồn tại thì chạy <code>scripts/resend-tables.sql</code> trên Supabase trước.</p>';
  }
}

// ----------------------------------------------------------- hành động ------
// Mỗi hành động: [các trạng thái cũ hợp lệ, hàm tạo payload]. PATCH kèm điều kiện
// status=in.(...) và Prefer: return=representation — nếu không có dòng nào trả về
// nghĩa là trạng thái đã đổi (task vừa chạy, hoặc máy khác đã bấm) → báo và tải lại.
const RESEND_ACTIONS = {
  approve1: { from: ['wait_approve_1'], body: () => ({ status: 'approved', approved_at: new Date().toISOString() }) },
  override: { from: ['verifying', 'stalled'], confirm: 'Duyệt dù khách CHƯA xác nhận thông tin? Em sẽ tạo đơn theo dữ liệu đang có, nếu thông tin sai đơn sẽ giao sai.',
              body: () => ({ status: 'approved', approved_override: true, approved_at: new Date().toISOString() }) },
  stop:     { from: ['collecting', 'verifying', 'wait_approve_1', 'approved', 'stalled'], ask: 'Lý do dừng case này (ghi chú, có thể bỏ trống):',
              body: (note) => ({ status: 'cancelled', owner_note: note || null }) },
  edit:     { from: ['wait_approve_1'], ask: 'Món thiếu đúng là gì? (vd: Chất Lông-Shin 02 - size M - SL 1). Em sẽ gửi lại tin xác minh cho khách với món mới.', required: true,
              body: (note) => ({ status: 'collecting', item_summary: note, item_confidence: 'high', owner_note: 'Anh sửa món → gửi lại tin xác minh', data_hash: null,
                                 customer_confirmed_at: null, confirm_slot: null, run_date: null, msg_verify_at: null, msg_ack_at: null }) },
  approve2: { from: ['wait_approve_2'], body: () => ({ status: 'finalizing', approved2_at: new Date().toISOString() }) },
  block:    { from: ['wait_approve_2'], ask: 'Chỗ nào chưa ổn? (em sẽ không ghi Sổ Kho / không nhắn khách)', required: true,
              body: (note) => ({ status: 'blocked', owner_note: note }) },
};

async function resendAct(btn){
  const def = RESEND_ACTIONS[btn.dataset.act];
  if (!def) return;
  if (def.confirm && !window.confirm(def.confirm)) return;
  let note = null;
  if (def.ask){
    note = window.prompt(def.ask, '');
    if (note === null) return;          // anh bấm Hủy
    note = note.trim();
    if (def.required && !note) return;
  }
  const id = btn.dataset.id;
  btn.disabled = true; const old = btn.textContent; btn.textContent = 'Đang lưu…';
  try {
    const res = await sbFetch('resend_cases?id=eq.' + encodeURIComponent(id) + '&status=in.(' + def.from.join(',') + ')',
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(def.body(note)) });
    if (!res || !res.length){
      alert('Case này vừa đổi trạng thái (task hoặc máy khác đã xử lý). Em tải lại danh sách.');
    }
    await refreshResend();
  } catch (err){
    btn.disabled = false; btn.textContent = old;
    alert('Chưa lưu được: ' + err.message);
  }
}

function wireResend(){
  const body = document.getElementById('resend-body');
  if (body) body.addEventListener('click', (e) => {
    const b = e.target.closest('.btn-rs');
    if (b) resendAct(b);
  });
  const reload = document.getElementById('resend-reload');
  if (reload) reload.addEventListener('click', refreshResend);
}
