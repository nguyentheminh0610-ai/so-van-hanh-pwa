/* ============================================================================
   Dữ liệu + thẻ + hành động của luồng "Gửi bù" (bảng resend_cases, schema ở
   scripts/resend-tables.sql). Từ 19/11/2026 KHÔNG còn tab riêng: hiển thị nằm ở
   cskh.js (tab "Hậu mãi", nhóm "Duyệt gửi bù"). Luồng + mẫu tin:
   .claude/skills/resend-missing-item/references/resend-flow-batch-2026-11-17.md

   Trang này ghi vào DB ĐÚNG MỘT VIỆC: đổi status khi anh bấm nút. Mọi lần đổi
   đều CÓ ĐIỀU KIỆN (PATCH ...&status=eq.<cũ>) nên bấm 2 lần / 2 máy cùng bấm
   không làm hỏng trạng thái. Không có SĐT/địa chỉ đầy đủ trong bảng.
============================================================================ */
const RESEND_RUN_HOUR = 15;      // mốc kho: PDF vào Sổ Kho trước 15h30 (chốt 18/11/2026)
const RESEND_CHECK2_MIN = 10;    // duyệt lần 2 trước 15h10 để kịp 15h30 (kho đóng hàng muộn nhất 16h)
const RESEND_LOOKBACK_DAYS = 14; // case đã xong chỉ hiện trong 14 ngày
let resendRows = null;

const RESEND_STATUS = {
  collecting:     'Đang hỏi thông tin khách',
  verifying:      'Chờ khách xác nhận thông tin',
  wait_approve_1: 'Đã gửi khách xác minh · chờ anh duyệt lần 1 (khách trả lời "đúng" trước thì tự chạy)',
  approved:       'Đã duyệt lần 1 — đang tạo đơn',
  creating:       'Đang tạo đơn SPX',
  wait_approve_2: 'Chờ anh duyệt lần 2',
  finalizing:     'Đang ghi Sổ Kho + nhắn khách',
  done:           'Xong',
  stalled:        'Treo / thiếu thông tin',
  blocked:        'Anh đã chặn',
  cancelled:      'Đã dừng',
};

const RESEND_CONF = {
  high:   { label: 'chắc',     cls: 'ok'   },
  medium: { label: 'khá chắc', cls: 'mid'  },
  low:    { label: 'chưa chắc — anh kiểm lại món', cls: 'low' },
};

// Phiếu đang hỏi khách mà còn thiếu thông tin (task ghi "Thiếu: ảnh + SĐT" vào stall_reason)
// Bỏ dấu để nhận cả khi task ghi không dấu ("Thieu: ..." — phiếu #9 21/11/2026 bị lọt khỏi nhóm cần anh vì lỗi này)
function resendNorm(t){ return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase(); }
function resendMissing(r){
  return r.status === 'collecting' && /^\s*thieu/.test(resendNorm(r.stall_reason));
}
// Khách đã bấm hoàn tiền / trả hàng vì thiếu (chốt 21/11/2026, phiếu #8): dòng `⚑ hoantien=1` do task ghi, hoặc suy từ chữ trong lý do / bước cuối.
function resendRefundFlag(r){
  if (['done', 'cancelled'].includes(r.status)) return false;
  const lines = String(r.owner_note || '').split('\n');
  const f = lines.filter(l => /^\s*⚑/.test(l)).pop();
  if (f) return /hoantien\s*=\s*1/.test(f);
  const ev = cskhProgressParse(r.owner_note);
  const last = ev.length ? ev[ev.length - 1].text : '';
  return /hoan tien|tra hang va hoan|yeu cau hoan/.test(resendNorm(r.stall_reason + ' ' + last));
}
// Phiếu `collecting` mà bước cuối task ghi là [chờ anh], hoặc stall_reason báo tranh chấp → cần anh, không được chìm vào nhóm "tự động"
function resendOwnerWait(r){
  // Phiếu chưa xong mà CÓ VẤN ĐỀ phải luôn nằm ở nhóm "cần anh" (chốt 21/11/2026, phiếu #9 dừng ở approved vì thiếu giá/phường
  // nhưng bị chìm vào khung "tự động"): bước cuối [chờ anh], có lỗi gần nhất, hoặc đứng quá mốc (đang làm ≥ 1h, chờ khách ≥ 4h).
  if (!['collecting', 'approved', 'creating', 'finalizing'].includes(r.status)) return false;
  if (r.last_error) return true;
  const ev = cskhProgressParse(r.owner_note);
  if (ev.length){
    const last = ev[ev.length - 1], hrs = (Date.now() - last.at.getTime()) / 3600000;
    if (last.state === 'chờ anh') return true;
    if (last.state === 'đang làm' && hrs >= 1) return true;
    if (last.state === 'chờ khách' && hrs >= 4) return true;
  }
  return r.status === 'collecting' && /^\s*tranh chap/.test(resendNorm(r.stall_reason));
}
// Chủ shop chỉ được "duyệt dù thiếu" khi thiếu MỖI ẢNH (chốt 21/11/2026). Thiếu SĐT/địa chỉ thì không có gì để tạo đơn.
function resendOverrideOk(r){
  const why = resendNorm(r.stall_reason);
  return !(/^\s*thieu/.test(why) && /sdt|so dien thoai|dia chi/.test(why));
}
function resendOverrideBtn(r){
  if (!resendOverrideOk(r)) return '';
  const photo = /^\s*thieu:\s*anh/.test(resendNorm(r.stall_reason));
  return resendBtn(photo ? 'Duyệt dù thiếu ảnh' : 'Duyệt dù khách chưa xác nhận', 'edit', 'override', r);
}
// Khách chưa phản hồi sau 4h kể từ lần task hỏi/cập nhật gần nhất (hoặc đã nhắc mà vẫn chưa đủ)
function resendSilentHtml(r){
  if (!resendMissing(r)) return '';
  if (cskhProgressParse(r.owner_note).length) return '';   // đã có dòng tiến độ → không hiện dòng suy đoán cũ
  const hrs = (Date.now() - new Date(r.updated_at).getTime()) / 3600000;
  if (r.msg_remind_at) return '<div class="rs-sub rs-bad">⚠ Đã hỏi và nhắc khách 1 lần, khách vẫn chưa gửi đủ — anh vào xử lý (' + (resendOverrideOk(r) ? 'duyệt dù thiếu ảnh hoặc dừng' : 'chưa duyệt được vì thiếu SĐT/địa chỉ — hỏi lại khách hoặc dừng') + ').</div>';
  return hrs >= 4
    ? '<div class="rs-sub rs-bad">⚠ Đã hỏi khách, <b>chưa phản hồi</b> sau ' + Math.floor(hrs) + ' giờ.</div>'
    : '<div class="rs-sub">Đã hỏi khách, đang chờ khách gửi (mốc 4 giờ).</div>';
}

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

// 3 dấu ✓/✗ thay cho các dòng chú thích nhỏ (chốt 21/11/2026): SĐT / địa chỉ / ảnh bằng chứng.
// Không có cột riêng → suy từ recipient_masked + stall_reason ("Thiếu: ảnh + SĐT..." do task ghi).
function resendChecklist(r){
  // Ưu tiên dòng task ghi vào owner_note: "☑ sdt=1 diachi=0 anh=1" (dòng cuối thắng)
  const m = String(r.owner_note || '').split('\n').filter(l => /^\s*☑/.test(l)).pop();
  if (m){
    const v = k => { const x = new RegExp(k + '\\s*=\\s*([01])').exec(m); return !!x && x[1] === '1'; };
    return [{ label: 'SĐT', ok: v('sdt') }, { label: 'Địa chỉ', ok: v('diachi') }, { label: 'Ảnh', ok: v('anh') }];
  }
  // Lỗi cũ 21/11/2026 (phiếu #9): chỉ nhìn recipient_masked (task không ghi) nên khách ĐÃ gửi đủ vẫn hiện ✗ ✗ ✗.
  // Giờ đọc "bằng chứng" trong lý do + các dòng tiến độ (mới → cũ): câu nào nhắc tới mục đó, có chữ "đã gửi/đã có/đủ" → ✓,
  // có "thiếu/chưa/hỏi" → ✗. Không có bằng chứng nào mới dùng recipient_masked; phiếu đã qua bước hỏi (verifying…) coi là đủ.
  const KEYS = {
    sdt:  /sđt|sdt|số điện thoại|so dien thoai/,
    addr: /địa chỉ|dia chi/,
    photo:/ảnh|anh vo don|anh tui|anh bang chung/,
  };
  const NEG = /thiếu|thieu|chưa|chua|hỏi|hoi\b|xin\b/;
  const POS = /đã gửi|da gui|đã có|da co|đã đủ|da du|\bđủ\b|\bdu\b/;
  const lines = [];
  if (r.stall_reason) lines.push(r.stall_reason);
  cskhProgressParse(r.owner_note).slice().reverse().forEach(e => lines.push(e.text));
  const segs = [];
  lines.forEach(t => String(t).toLowerCase().split(/[.;\n,—]| - | nhưng | nhung | còn | con | mà | ma /).forEach(s => segs.push(s)));
  const judge = (re) => {
    for (const s of segs){
      if (!re.test(s)) continue;
      if (NEG.test(s)) return false;
      if (POS.test(s)) return true;
    }
    return null;
  };
  const masked = r.recipient_masked || '';
  const parts = masked.split('·').map(x => x.trim()).filter(Boolean);
  const fallback = {
    sdt: /\d[\d*\s]{6,}\d/.test(masked),
    addr: !!parts.find(x => /\/|,/.test(x) && !/\d[\d*]{6,}/.test(x)),
    photo: false,
  };
  const past = r.status !== 'collecting' ? true : null;   // đã qua bước hỏi khách (verifying, chờ duyệt…)
  const pick = (k) => { const j = judge(KEYS[k]); return j !== null ? j : (fallback[k] || past === true); };
  return [
    { label: 'SĐT',     ok: pick('sdt') },
    { label: 'Địa chỉ', ok: pick('addr') },
    { label: 'Ảnh',     ok: pick('photo') },
  ];
}
function resendChecklistHtml(r){
  return '<div class="rs-checks">' + resendChecklist(r).map(c =>
    '<span class="rs-chk ' + (c.ok ? 'y' : 'n') + '">' + (c.ok ? '✓' : '✗') + ' ' + c.label + '</span>').join('') + '</div>';
}

// ---- THANH TIẾN ĐỘ 6 BƯỚC (chốt 21/11/2026, thay cho đoạn "Tiến độ:" dài) -----------------------------
// Bước hiện tại suy từ status + cột có sẵn, KHÔNG phụ thuộc câu chữ task ghi → không sai khi task đổi cách viết.
const RESEND_STEPS = ['Hỏi thông tin', 'Xác minh + duyệt 1', 'Tạo đơn SPX', 'Duyệt lần 2', 'Ghi sổ + nhắn khách', 'Xong'];
function resendStepIndex(r){
  switch (r.status){
    case 'collecting': return 0;
    case 'verifying': case 'wait_approve_1': return 1;
    case 'approved': case 'creating': return 2;
    case 'wait_approve_2': case 'blocked': return 3;
    case 'finalizing': return 4;
    case 'done': return 5;
    default: return r.spx_tracking ? 3 : (r.msg_verify_at ? 1 : 0);   // stalled / cancelled: dừng ở bước đã tới
  }
}
function resendHolder(r){
  if (['done', 'cancelled'].includes(r.status)) return '';
  if (r.status === 'wait_approve_1' || r.status === 'verifying') return 'anh duyệt hoặc khách xác nhận';
  if (r.status === 'wait_approve_2') return 'anh duyệt';
  if (r.status === 'stalled' || r.status === 'blocked') return 'anh xử lý';
  const ev = cskhProgressParse(r.owner_note), st = ev.length ? ev[ev.length - 1].state : '';
  return st === 'chờ khách' ? 'chờ khách' : st === 'chờ anh' ? 'anh xử lý' : 'hệ thống đang làm';
}
function resendStepperHtml(r){
  const cur = resendStepIndex(r);
  const stopped = ['stalled', 'blocked', 'cancelled'].includes(r.status);
  return '<div class="rs-steps">' + RESEND_STEPS.map((name, i) => {
    const cls = i < cur || (i === cur && r.status === 'done') ? 'done' : i === cur ? (stopped ? 'stop' : 'cur') : 'todo';
    const mark = cls === 'done' ? '✓' : cls === 'stop' ? '✗' : cls === 'cur' ? '●' : '○';
    return '<span class="rs-step ' + cls + '">' + mark + ' ' + esc(name) + '</span>';
  }).join('<span class="rs-sep">›</span>') + '</div>';
}
// Dòng ngắn "đang ở đâu / ai cầm / kẹt bao lâu" + lịch sử gập (câu chữ dài của task nằm trong lịch sử)
function resendProgressHtml(r){
  const closed = ['done', 'cancelled', 'blocked'].includes(r.status);
  const ev = cskhProgressParse(r.owner_note);
  const who = resendHolder(r);
  let head = '';
  if (!closed){
    const last = ev.length ? ev[ev.length - 1] : null;
    const hrs = last ? (Date.now() - last.at.getTime()) / 3600000 : 0;
    const limit = last ? (last.state === 'chờ khách' ? 4 : last.state === 'đang làm' ? 1 : 0) : 0;
    const stuck = !!limit && hrs >= limit;
    head = '<div class="rs-sub' + (stuck ? ' rs-bad' : '') + '">' + (who ? '<b>' + esc(who.charAt(0).toUpperCase() + who.slice(1)) + '</b>' : '')
      + (last ? ' <span class="rs-faint">· cập nhật ' + esc(last.label) + '</span>' : '')
      + (stuck ? ' · <b>⚠ đứng ở bước này ' + Math.floor(hrs) + ' giờ — anh vào xử lý</b>' : '') + '</div>';
  }
  const hist = ev.length
    ? '<details class="hm-fold"><summary>Chi tiết ' + ev.length + ' bước</summary><div class="rs-sub">'
      + ev.slice().reverse().map(e => esc(e.label) + ' · [' + esc(e.state) + '] ' + esc(e.text)).join('<br>') + '</div></details>' : '';
  return resendStepperHtml(r) + head + hist;
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
    + (resendRefundFlag(row) ? '<span class="tag why rs-refund">⚠ Khách đang yêu cầu hoàn tiền vì thiếu — anh vào kiểm</span>' : '')
    + (row.confirm_slot === 'tomorrow' ? '<span class="tag why">đi ngày mai</span>' : '')
    + (row.approved_override ? '<span class="tag why">duyệt dù khách chưa xác nhận</span>' : '')
    // Trước chỉ hiện khi status==='stalled' nên lúc đang 'collecting' (khách đã gửi 1 phần,
    // ví dụ địa chỉ thiếu phường/xã) thẻ chỉ có ✗ trơn, dễ hiểu nhầm là khách chưa gửi gì
    // (chốt 21/11/2026, case _ciara07_ #7 — chủ shop tưởng khách đã gửi đủ địa chỉ).
    + (row.stall_reason && !['done', 'cancelled'].includes(row.status) && /^\s*thiếu/i.test(row.stall_reason)
      ? '<span class="tag why">⚠ ' + esc(row.stall_reason.split(/[·—\n]/)[0].trim()) + '</span>' : '');
  const body = [
    '<div class="rs-item">Thiếu: <b>' + esc(row.item_summary) + '</b>'
      + (conf ? ' <span class="rs-conf ' + conf.cls + '">' + esc(conf.label) + '</span>' : '') + '</div>',
    resendChecklistHtml(row),
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
    btns = resendOverrideBtn(row)
      + resendBtn('Dừng', 'stop', 'stop', row);
  } else if (row.status === 'collecting' || row.status === 'approved'){
    btns = (resendMissing(row) ? resendOverrideBtn(row) : '')
      + resendBtn('Dừng', 'stop', 'stop', row);
  }
  const stateLine = '<span class="rs-state">' + esc(RESEND_STATUS[row.status] || row.status) + '</span>'
    + (row.stall_reason && row.status === 'stalled' ? ' · <b>' + esc(row.stall_reason) + '</b>' : '')
    + (cskhProgressStripped(row.owner_note) ? ' · ghi chú: ' + esc(cskhProgressStripped(row.owner_note)) : '')
    + (row.last_error && row.status !== 'done' ? ' · <span class="rs-bad">lỗi gần nhất: ' + esc(row.last_error) + '</span>' : '');
  return '<div class="fi compact rs-card' + (dl.late ? ' rs-late' : '') + '" data-id="' + esc(String(row.id)) + '">'
    + '<div class="fi-line1">' + line1 + '<span class="when">' + esc(fmtDMY(cskhDateKey(new Date(row.created_at))) || '') + '</span></div>'
    + '<div class="rs-body">' + body + extra + resendProgressHtml(row) + resendSilentHtml(row) + '</div>'
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

// -------------------------------------------------------------- phân nhóm ---
// Hiển thị nằm ở cskh.js (tab "Hậu mãi", 19/11/2026) — file này giữ dữ liệu, thẻ và hành động.
function resendGroups(rows){
  return {
    // cần anh làm: 2 lần duyệt + case treo (duyệt dù khách chưa xác nhận / dừng)
    // collecting mà đang THIẾU thông tin (stall_reason bắt đầu bằng "Thiếu") cũng hiện ở đây để anh thấy ngay thiếu gì
    need: rows.filter(r => ['wait_approve_1', 'wait_approve_2', 'verifying', 'stalled'].includes(r.status) || resendMissing(r) || resendOwnerWait(r)),
    running: rows.filter(r => ['collecting', 'approved', 'creating', 'finalizing'].includes(r.status) && !resendMissing(r) && !resendOwnerWait(r)),
    closed: rows.filter(r => ['done', 'blocked', 'cancelled'].includes(r.status)).slice(0, 30),
  };
}

// ----------------------------------------------------------- hành động ------
// Mỗi hành động: [các trạng thái cũ hợp lệ, hàm tạo payload]. PATCH kèm điều kiện
// status=in.(...) và Prefer: return=representation — nếu không có dòng nào trả về
// nghĩa là trạng thái đã đổi (task vừa chạy, hoặc máy khác đã bấm) → báo và tải lại.
const RESEND_ACTIONS = {
  approve1: { from: ['wait_approve_1'], body: () => ({ status: 'approved', approved_at: new Date().toISOString() }) },
  override: { from: ['collecting', 'verifying', 'stalled'], confirm: 'Duyệt dù khách CHƯA xác nhận thông tin? Em sẽ tạo đơn theo dữ liệu đang có, nếu thông tin sai đơn sẽ giao sai.',
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
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(def.body(note, (resendRows || []).find(x => String(x.id) === String(id)))) });
    if (!res || !res.length){
      alert('Case này vừa đổi trạng thái (task hoặc máy khác đã xử lý). Em tải lại danh sách.');
    }
    await refreshCskh();
  } catch (err){
    btn.disabled = false; btn.textContent = old;
    alert('Chưa lưu được: ' + err.message);
  }
}
