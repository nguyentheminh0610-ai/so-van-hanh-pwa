/* ============================================================
   Page wiring: upload dropzone, compute, lưu/xem lịch sử + thư viện file
   qua Supabase (thay cho cơ chế claude.use('artifact') của bản Artifact cũ).
   ROLE_META (sàn/loại/bắt buộc theo từng vai trò file) định nghĩa ở calc.js,
   dùng chung với detectFile() — xem calc.js để biết chi tiết nhận diện.
   ============================================================ */
let selectedFiles = {}; // role -> File, suy ra từ detectedFiles mỗi lần thay đổi
let currentResult = null;
let HISTORY = []; // [{id, label, period_start, period_end, created_at}] — chưa có "data" đầy đủ, tải khi chọn xem
let detectedFiles = []; // [{file, role, platform, typeLabel, monthKey, monthLabel, readError, error}]
let libraryRows = []; // bản ghi monthly_reports kèm cột files, tải khi mở tab thư viện
let restoreContext = null; // {label, recordId} — khi đang khôi phục file sau khi xoá 1 file sai

// ---------- Supabase config — cố định trong code ----------
// App chỉ phục vụ đúng 1 chủ shop, dùng chung 1 project Supabase duy nhất nên
// không cần bắt nhập tay URL/key mỗi lần mở trên trình duyệt/thiết bị mới.
// Đây là anon/publishable key — đúng loại key Supabase thiết kế để nhúng công
// khai vào code phía client (không phải secret key); ranh giới bảo mật thật sự
// nằm ở chính sách Row Level Security (RLS) cấu hình trên bảng/bucket, không
// phải ở việc giấu key này.
const SUPABASE_URL = 'https://dyvublxyrldmmnsrfvpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dnVibHh5cmxkbW1uc3JmdnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzU4MzMsImV4cCI6MjEwNDExMTgzM30.jM3hD0hNMZ5osaZHDDe5PSm9rQ1Jr6IdWFF0VjT1edI';

function getConfig(){
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}

async function sbFetch(path, opts){
  const c = getConfig();
  if (!c.url || !c.key) throw new Error('Chưa cấu hình Supabase.');
  opts = opts || {};
  const headers = Object.assign({
    'apikey': c.key,
    'Authorization': 'Bearer ' + c.key,
    'Content-Type': 'application/json',
  }, opts.headers || {});
  const res = await fetch(c.url + '/rest/v1/' + path, Object.assign({}, opts, { headers }));
  if (!res.ok){
    let msg = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.message) msg += ' — ' + j.message; } catch (e){}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- Storage: lưu file Excel gốc kèm mỗi lần lưu lịch sử ----------
const STORAGE_BUCKET = 'monthly-files';

function slugifyForPath(label){
  const s = String(label)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return s || ('bao-cao-' + Date.now());
}

async function sbStorageUpload(path, file){
  const c = getConfig();
  if (!c.url || !c.key) throw new Error('Chưa cấu hình Supabase.');
  const res = await fetch(c.url + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path.split('/').map(encodeURIComponent).join('/'), {
    method: 'POST',
    headers: {
      'apikey': c.key,
      'Authorization': 'Bearer ' + c.key,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!res.ok){
    let msg = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.message) msg += ' — ' + j.message; } catch (e){}
    throw new Error(msg);
  }
}

function sbStoragePublicUrl(path){
  const c = getConfig();
  return c.url + '/storage/v1/object/public/' + STORAGE_BUCKET + '/' + path.split('/').map(encodeURIComponent).join('/');
}

async function sbStorageDelete(path){
  const c = getConfig();
  if (!c.url || !c.key) throw new Error('Chưa cấu hình Supabase.');
  const res = await fetch(c.url + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path.split('/').map(encodeURIComponent).join('/'), {
    method: 'DELETE',
    headers: { 'apikey': c.key, 'Authorization': 'Bearer ' + c.key },
  });
  if (!res.ok){
    let msg = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.message) msg += ' — ' + j.message; } catch (e){}
    throw new Error(msg);
  }
}

function safeStorageFilename(name){
  const idx = name.lastIndexOf('.');
  const base = idx > 0 ? name.slice(0, idx) : name;
  const ext = idx > 0 ? name.slice(idx) : '';
  const safeBase = base
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/(^-+|-+$)/g, '') || 'file';
  return safeBase + ext;
}

async function uploadOriginalFiles(labelSlug){
  const uploaded = [];
  for (const key of Object.keys(selectedFiles)){
    const file = selectedFiles[key];
    const path = labelSlug + '/' + key + '__' + safeStorageFilename(file.name);
    try {
      await sbStorageUpload(path, file);
      uploaded.push({ key, name: file.name, path }); // name giữ nguyên gốc để hiển thị
    } catch (err){
      console.error('Tải file gốc lên thất bại (' + key + '):', err);
    }
  }
  return uploaded;
}

function buildFilesSectionHtml(files){
  if (!files || !files.length) return '';
  return `<div class="files-card" id="files-card">
    <div class="files-title">📎 File gốc đã lưu tháng này (${files.length} file)</div>
    <div class="files-list">
      ${files.map(f => `<a class="files-item" href="${sbStoragePublicUrl(f.path)}" target="_blank" rel="noopener">⬇ ${esc(f.name)}</a>`).join('')}
    </div>
  </div>`;
}

function renderFilesSection(files){
  const el = document.getElementById('files-section');
  if (el) el.innerHTML = buildFilesSectionHtml(files);
}

// ---------- Install-to-homescreen hint ----------
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const el = document.getElementById('install-hint');
  if (el) el.style.display = 'flex';
});
function buildInstallHintHTML(){
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return '';
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS){
    return `<div class="install-hint" id="install-hint">📱 Trên iPhone: bấm nút <b>Chia sẻ</b> (hình vuông mũi tên) → <b>Thêm vào Màn hình chính</b> để mở như app. <button class="ih-close" onclick="this.parentElement.style.display='none'">Ẩn</button></div>`;
  }
  return `<div class="install-hint" id="install-hint" style="display:none;">📱 Cài trang này vào điện thoại để mở nhanh như app. <button id="btn-install">Cài đặt</button><button class="ih-close" onclick="this.parentElement.style.display='none'">Ẩn</button></div>`;
}
function wireInstallHint(){
  const btn = document.getElementById('btn-install');
  if (btn) btn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('install-hint').style.display = 'none';
  });
}

// ---------- Tabs ----------
function buildTabsHTML(){
  return `<div class="tabs" id="tabs">
    <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
    <button class="tab-btn" data-tab="library">Tải file &amp; lịch sử</button>
  </div>`;
}

function switchToTab(tab){
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('screen-dashboard').classList.toggle('active', tab === 'dashboard');
  document.getElementById('screen-library').classList.toggle('active', tab === 'library');
  if (tab === 'library') refreshLibrary();
}

function refreshDashboardEmptyState(){
  const emptyEl = document.getElementById('dashboard-empty');
  if (!emptyEl) return;
  const hasResults = document.getElementById('results').classList.contains('show');
  emptyEl.style.display = hasResults ? 'none' : '';
}

function wireTabs(){
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchToTab(btn.dataset.tab);
  });
}

// ---------- Dashboard (tab 1) — chỉ hiển thị kết quả ----------
// "Xem kỳ" đã gộp thẳng vào widget "Kỳ báo cáo" (to hơn, làm nút chính để
// chọn/xem lại kỳ) theo yêu cầu chủ shop 2026-09-15 — không còn tách riêng
// dòng "Xem kỳ:" + hộp chọn nhỏ như trước.
function buildDashboardHTML(){
  return `
  <div class="topbar">
    <div class="range-card range-card-lg" id="range-card">
      <div class="rc-head">
        <span class="rc-title">Kỳ báo cáo</span>
        <button type="button" class="rc-multi-toggle" id="rc-multi-toggle" style="display:none;">Gộp nhiều tháng</button>
      </div>
      <div class="rc-dropdown" id="rc-dropdown">
        <button type="button" class="rc-select-btn" id="rc-select-btn" aria-haspopup="listbox" aria-expanded="false">
          <span id="rc-select-label">Số liệu vừa tính (chưa lưu)</span>
          <span class="rc-chev">⌄</span>
        </button>
        <div class="rc-panel" id="rc-panel" role="listbox" hidden></div>
      </div>
      <select id="history-select" class="rc-select-native" aria-hidden="true" tabindex="-1"></select>
      <div class="rc-dates-live" id="rc-dates-live"></div>
      <div class="rc-multi-actions" id="rc-multi-actions" hidden>
        <span id="rc-multi-count">Đã chọn 0 tháng</span>
        <button type="button" class="btn-secondary" id="rc-multi-apply" disabled>Xem gộp</button>
        <span class="up-manual-link" id="rc-multi-cancel">Huỷ</span>
      </div>
    </div>
    <button class="btn-secondary" id="btn-refresh-all-history" style="display:none;">🔄 Cập nhật lại lịch sử</button>
    <div class="legend"><span><i class="i-shopee"></i>Shopee</span><span><i class="i-tiktok"></i>TikTok Shop</span></div>
  </div>
  <div id="files-section"></div>
  <p class="up-status" id="dashboard-empty">Chưa có số liệu — sang tab "Tải file &amp; lịch sử" để tải file lên.</p>
  <div id="results"></div>`;
}

// ---------- Upload UI (tab 2) — dropzone + nhận diện file + tính toán + lịch sử ----------
function buildUploadFlowHTML(){
  return `
  <div class="upload-card">
    <h2>Tải số liệu tháng này</h2>
    <p class="up-sub">Kéo-thả hoặc bấm chọn nhiều file cùng lúc từ Shopee Seller Center &amp; TikTok Shop Partner Center — hệ thống tự đọc tên file và nội dung bên trong để nhận diện đúng sàn, loại báo cáo và tháng, không cần chọn tay từng ô như trước. Chỗ nào chưa đúng thì sửa lại ngay tại dòng tương ứng bên dưới. Mọi tính toán chạy ngay trên trình duyệt của anh, không gửi file lên đâu cả — chỉ khi anh bấm "Lưu vào lịch sử" thì kết quả và các file gốc mới được lưu lên server để xem/tải lại sau này.</p>
    <div class="up-dropzone" id="up-dropzone">
      <input type="file" id="up-multi-input" accept=".xlsx,.xls,.csv" multiple style="display:none;">
      <div class="up-dz-icon">📂</div>
      <div class="up-dz-text"><b>Bấm để chọn file, hoặc kéo-thả cả loạt file vào đây</b><br>Không giới hạn số file, không cần đúng thứ tự</div>
    </div>
    <div class="dl-list" id="dl-list"></div>
    <div class="dl-summary" id="dl-summary" style="display:none;"></div>
    <div class="dl-suggest" id="dl-suggest" style="display:none;"></div>
    <div class="up-actions">
      <button class="btn-primary" id="btn-compute" disabled>Tính toán</button>
      <span class="up-status" id="up-status"></span>
    </div>
  </div>
  <div class="history-bar" id="history-bar" style="display:none;">
    <button class="btn-secondary" id="btn-save-history" disabled>Lưu vào lịch sử</button>
    <span class="hb-note" id="history-note"></span>
  </div>`;
}

// ---------- nhận diện theo tên file — nguồn nhận diện CHÍNH cho mọi loại file
// (tên file các sàn xuất ra khá rõ ràng/đáng tin cậy); detectFile() (calc.js)
// chỉ còn đọc nội dung để xác nhận thêm cho đúng 1 trường hợp: phân biệt
// Income (Shopee) với Tài chính (TikTok) khi 2 file trùng tên gần giống hệt
// nhau (dạng income_...(UTC+7).xlsx không có chữ nào cho biết là sàn nào). ----------
function stripDiacritics(str){
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ');
}

function classifyFileName(filename){
  const n = stripDiacritics(filename);
  const hasTiktok = n.includes('tiktok');
  const hasShopee = n.includes('shopee');
  if (n.includes('cancelled')) return null; // Order.cancelled — dư thừa, đã có trong Order.all
  if (n.includes('return refund')) return 'shopeeReturnRefund';
  if (n.includes('failed delivery')) return 'shopeeFailedDelivery';
  if (n.includes('affiliate') && n.includes('order')) return 'tiktokAffiliateOrders';
  if (n.includes('video analysis') || (n.includes('video') && n.includes('list') && n.includes('analysis'))) return 'tiktokVideoAnalysis';
  if (n.includes('creator list')) return 'tiktokCreatorList';
  if (n.includes('live list')) return 'tiktokLiveList';
  if (hasTiktok && n.includes('tra hang')) return 'tiktokReturns';
  if (hasTiktok && (n.includes('tai chinh') || n.includes('finance'))) return 'tiktokFinance';
  if (n.includes('income')) return 'income';
  if (n.includes('shop stats') || n.includes('shopstats')) return 'shopStats';
  if (hasTiktok && (n.includes('don hang') || n.includes('order'))) return 'tiktokOrders';
  if (n.includes('order all')) return 'shopeeOrders'; // tên file gốc Shopee "Order.all...", không có chữ "shopee"
  if (hasShopee && (n.includes('don hang') || n.includes('order'))) return 'shopeeOrders';
  return null;
}

// ---------- danh sách file đã nhận diện (validation UI) ----------
function roleOptionsHtml(selectedRole){
  const opts = ['<option value="">— Chưa xác định —</option>'];
  Object.entries(ROLE_META).forEach(([key, meta]) => {
    opts.push(`<option value="${key}" ${selectedRole === key ? 'selected' : ''}>${esc(meta.platform + ' — ' + meta.label)}</option>`);
  });
  return opts.join('');
}

function renderDetectedList(){
  const listEl = document.getElementById('dl-list');
  const roleCounts = {};
  detectedFiles.forEach(e => { if (e.role) roleCounts[e.role] = (roleCounts[e.role] || 0) + 1; });
  detectedFiles.forEach(e => {
    if (e.readError) e.error = e.readError;
    else if (!e.role) e.error = 'Chưa nhận diện được — chọn tay loại file ở dòng này, hoặc bấm ✕ nếu không cần dùng.';
    else if (roleCounts[e.role] > 1) e.error = 'Trùng vai trò với 1 file khác (' + ROLE_META[e.role].platform + ' — ' + ROLE_META[e.role].label + ') — chỉ giữ lại đúng 1 file, xoá hoặc đổi loại ở dòng kia.';
    else e.error = null;
  });
  listEl.innerHTML = detectedFiles.map((e, i) => `
    <div class="dl-row ${e.error ? 'is-warn' : 'is-ok'}">
      <span class="dl-badge ${e.platform === 'Shopee' ? 'shopee' : e.platform === 'TikTok' ? 'tiktok' : ''}">${esc(e.platform || '?')}</span>
      <select class="dl-role-select" data-idx="${i}">${roleOptionsHtml(e.role)}</select>
      <span class="dl-fname" title="${esc(e.file.name)}">${esc(e.file.name)}</span>
      <span class="dl-month">${esc(e.monthLabel || 'Chưa rõ tháng')}</span>
      <span class="dl-status">${e.error ? '⚠' : '✓'}</span>
      <button class="dl-remove" data-idx="${i}" title="Bỏ file này">✕</button>
    </div>
    ${e.error ? `<div class="dl-row-error">⚠ ${esc(e.error)}</div>` : ''}
  `).join('');
  listEl.querySelectorAll('.dl-role-select').forEach(sel => {
    sel.addEventListener('change', (ev) => {
      const idx = parseInt(ev.target.dataset.idx, 10);
      const entry = detectedFiles[idx];
      const newRole = ev.target.value || null;
      entry.role = newRole;
      const meta = newRole ? ROLE_META[newRole] : null;
      entry.platform = meta ? meta.platform : null;
      entry.typeLabel = meta ? meta.label : null;
      entry.monthKey = null;
      entry.monthLabel = null; // cột ngày dùng để suy tháng khác nhau theo vai trò — tháng cũ (nếu có) không còn đúng nữa
      renderDetectedList();
    });
  });
  listEl.querySelectorAll('.dl-remove').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const idx = parseInt(ev.target.dataset.idx, 10);
      detectedFiles.splice(idx, 1);
      renderDetectedList();
    });
  });
  updateValidityAndButton();
}

function updateValidityAndButton(){
  const roleCounts = {};
  detectedFiles.forEach(e => { if (e.role) roleCounts[e.role] = (roleCounts[e.role] || 0) + 1; });
  const missing = Object.entries(ROLE_META)
    .filter(([k, m]) => m.required && (roleCounts[k] || 0) !== 1)
    .map(([, m]) => m.platform + ' — ' + m.label);
  const hasRowErrors = detectedFiles.some(e => e.error);
  const ready = !hasRowErrors && missing.length === 0;
  const btn = document.getElementById('btn-compute');
  if (btn) btn.disabled = !ready;

  const summaryEl = document.getElementById('dl-summary');
  if (summaryEl){
    if (missing.length){
      summaryEl.style.display = 'block';
      summaryEl.className = 'dl-summary is-warn';
      summaryEl.textContent = '⚠ Còn thiếu file bắt buộc: ' + missing.join(', ') + '.';
    } else if (hasRowErrors){
      summaryEl.style.display = 'block';
      summaryEl.className = 'dl-summary is-warn';
      summaryEl.textContent = '⚠ Còn ' + detectedFiles.filter(e => e.error).length + ' dòng cần sửa ở trên trước khi tính toán.';
    } else {
      summaryEl.style.display = 'none';
    }
  }

  selectedFiles = {};
  detectedFiles.forEach(e => { if (e.role && roleCounts[e.role] === 1) selectedFiles[e.role] = e.file; });

  maybeSuggestMonthMatch(missing.length > 0);
}

// ---------- Gợi ý tự động gắn vào tháng đã lưu (2026-09-22, theo yêu cầu chủ
// shop: "khi a thêm file mới thì chỉ cần tải thêm file đó thôi chứ") ----------
// Khi chủ shop chỉ kéo-thả 1 file TUỲ CHỌN (Creator/Live/Affiliate/Video) mà
// hệ thống đọc được đúng tháng của file đó (xem calc.js), tự tìm xem tháng
// đó đã lưu trên server chưa — nếu khớp đúng 1 tháng, hiện ngay tại khu thả
// file 1 nút để tự điền các file còn lại, khỏi phải qua tab Thư viện.
let suggestRunId = 0;

async function ensureLibraryRowsLoaded(forceRefresh){
  if (!forceRefresh && libraryRows && libraryRows.length) return libraryRows;
  try {
    libraryRows = await sbFetch('monthly_reports?select=id,label,period_start,period_end,files') || [];
  } catch (err){
    console.error('ensureLibraryRowsLoaded', err);
    libraryRows = [];
  }
  return libraryRows;
}

function renderDlSuggest(html){
  const el = document.getElementById('dl-suggest');
  if (!el) return;
  if (!html){ el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = html;
  const btn = el.querySelector('.dl-suggest-apply');
  if (btn) btn.addEventListener('click', () => mergeMissingFilesFromRecord(btn.dataset.id));
}

async function maybeSuggestMonthMatch(hasMissingRequired){
  const runId = ++suggestRunId;
  if (!hasMissingRequired || restoreContext){ renderDlSuggest(null); return; }
  // Chỉ gợi ý khi CHỈ có đúng 1 file tuỳ chọn nhận diện được tháng trong khu
  // thả file (đúng kịch bản "vừa kéo thêm 1 file mới") — tránh lấy nhầm 1
  // dòng còn sót lại từ thao tác trước đó nếu chưa refresh trang.
  const optionalWithMonth = detectedFiles.filter(e => e.role && e.monthKey && !e.error && ROLE_META[e.role] && !ROLE_META[e.role].required);
  if (optionalWithMonth.length !== 1){ renderDlSuggest(null); return; }
  const candidate = optionalWithMonth[0];
  // Luôn tải lại mới nhất từ server (không dùng cache) — tránh khớp nhầm nếu
  // danh sách tháng đã lưu vừa thay đổi (thêm/sửa) sau lần tải trước đó.
  const rows = await ensureLibraryRowsLoaded(true);
  if (runId !== suggestRunId) return; // đã có thay đổi khác trong lúc chờ tải
  const matches = (rows || []).filter(r => r.period_start && String(r.period_start).slice(0, 7) === candidate.monthKey);
  if (matches.length !== 1){ renderDlSuggest(null); return; }
  const record = matches[0];
  const rangeText = (record.period_start && record.period_end)
    ? fmtDateVN(record.period_start) + ' – ' + fmtDateVN(record.period_end)
    : '';
  renderDlSuggest(`⚡ File "${esc(candidate.file.name)}" thuộc <b>${esc(candidate.monthLabel)}</b> — trùng với tháng đã lưu <b>"${esc(record.label)}"</b>${rangeText ? ' (' + esc(rangeText) + ')' : ''}. Kiểm tra đúng khoảng ngày rồi hẵng bấm:
    <button type="button" class="dl-suggest-apply" data-id="${esc(record.id)}">Tự động điền các file còn lại của tháng này</button>`);
}

async function mergeMissingFilesFromRecord(recordId){
  const rows = await ensureLibraryRowsLoaded();
  const record = rows.find(r => r.id === recordId);
  if (!record) return;
  renderDlSuggest(null);
  const statusEl = document.getElementById('up-status');
  statusEl.classList.remove('err');
  const toFetch = (record.files || []).filter(f => !detectedFiles.some(e => e.role === f.key));
  statusEl.textContent = 'Đang tự điền ' + toFetch.length + ' file còn lại của "' + record.label + '"…';
  let failCount = 0;
  for (const f of toFetch){
    try {
      const resp = await fetch(sbStoragePublicUrl(f.path));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const file = new File([blob], f.name, { type: blob.type || 'application/octet-stream' });
      const meta = ROLE_META[f.key] || null;
      detectedFiles.push({
        file, role: f.key, platform: meta ? meta.platform : null, typeLabel: meta ? meta.label : null,
        monthKey: null, monthLabel: record.label, readError: null,
      });
    } catch (err){
      console.error('Không tải lại được file ' + f.name, err);
      failCount++;
    }
  }
  restoreContext = { label: record.label, recordId: record.id };
  renderDetectedList();
  statusEl.textContent = 'Đã tự điền xong file của "' + record.label + '"'
    + (failCount ? ' (' + failCount + ' file tải lại thất bại, anh chọn tay lại giúp)' : '')
    + ' — bấm "Tính toán" rồi "Lưu vào lịch sử" để ghi đè đúng tháng này.';
}

async function handleIncomingFiles(fileList){
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const statusEl = document.getElementById('up-status');
  statusEl.classList.remove('err');
  statusEl.textContent = 'Đang nhận diện ' + files.length + ' file…';
  const xlsxOk = window.__xlsxReady ? await window.__xlsxReady : (typeof XLSX !== 'undefined');
  if (!xlsxOk || typeof XLSX === 'undefined'){
    statusEl.classList.add('err');
    statusEl.textContent = 'Không tải được thư viện đọc file Excel (mạng chặn CDN, VPN, hoặc trình chặn quảng cáo) — không thể tự nhận diện file. Thử tắt VPN/ad-blocker, đổi mạng rồi thả file lại.';
    return;
  }
  for (const file of files){
    try {
      detectedFiles.push(await detectFile(file));
    } catch (err){
      detectedFiles.push({ file, role: null, platform: null, typeLabel: null, monthKey: null, monthLabel: null, readError: 'Lỗi nhận diện: ' + err.message });
    }
  }
  statusEl.textContent = '';
  renderDetectedList();
}

function wireUpload(){
  const dz = document.getElementById('up-dropzone');
  const multiInput = document.getElementById('up-multi-input');
  dz.addEventListener('click', () => multiInput.click());
  multiInput.addEventListener('change', (e) => {
    handleIncomingFiles(e.target.files);
    multiInput.value = '';
  });
  ['dragover', 'dragenter'].forEach(evt => dz.addEventListener(evt, (e) => {
    e.preventDefault(); dz.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(evt => dz.addEventListener(evt, (e) => {
    e.preventDefault(); dz.classList.remove('dragover');
  }));
  dz.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files) handleIncomingFiles(e.dataTransfer.files);
  });

  document.getElementById('btn-compute').addEventListener('click', onCompute);
}

function renderResults(el, res, opts){
  el.innerHTML = render(res, opts);
  el.classList.add('show');
  wireDailyRevenueChart(el, res);
  refreshDashboardEmptyState();
  // Widget "Kỳ báo cáo" (gộp chung với "Xem kỳ") nằm ngoài #results, cập
  // nhật riêng khoảng ngày của kỳ đang xem tại đây.
  const datesLive = document.getElementById('rc-dates-live');
  if (datesLive) datesLive.textContent = fmtDateVN(res.minDate) + ' – ' + fmtDateVN(res.maxDate);
}

async function onCompute(){
  const statusEl = document.getElementById('up-status');
  const btn = document.getElementById('btn-compute');
  btn.disabled = true;
  statusEl.classList.remove('err');
  statusEl.textContent = 'Đang tải thư viện đọc Excel…';
  try {
    const xlsxOk = window.__xlsxReady ? await window.__xlsxReady : (typeof XLSX !== 'undefined');
    if (!xlsxOk || typeof XLSX === 'undefined'){
      throw new Error('Không tải được thư viện đọc file Excel (mạng chặn CDN, VPN, hoặc trình chặn quảng cáo). Thử tắt VPN/ad-blocker, đổi sang wifi/4G khác rồi bấm lại "Tính toán".');
    }
    statusEl.textContent = 'Đang đọc và tính toán…';
    const result = await computeAll(selectedFiles);
    currentResult = result;
    const resultsEl = document.getElementById('results');
    renderResults(resultsEl, result);
    renderFilesSection(null);
    statusEl.textContent = 'Xong — số liệu ' + fmtDateVN(result.minDate) + ' – ' + fmtDateVN(result.maxDate) + '.';
    document.getElementById('btn-save-history').disabled = false;
    document.getElementById('history-bar').style.display = 'flex';
    // Không tự chuyển sang tab Dashboard / cuộn trang nữa (theo yêu cầu chủ
    // shop 2026-09-15) — ở lại tab "Tải file & lịch sử" để bấm luôn "Lưu vào
    // lịch sử" ngay tại đây, không phải chuyển qua chuyển lại giữa 2 tab.
    // Widget "Kỳ báo cáo" quay lại hiện "Số liệu vừa tính (chưa lưu)" vì
    // dashboard vừa đổi sang số MỚI tính (chưa lưu), tránh hiện nhầm tên 1
    // kỳ cũ đã xem trước đó trong khi số liệu trên trang đã là số mới.
    const histSel = document.getElementById('history-select');
    if (histSel){ histSel.value = 'current'; renderRcDropdown(); }
  } catch (err){
    console.error(err);
    statusEl.classList.add('err');
    statusEl.textContent = 'Lỗi khi đọc file: ' + err.message + ' — kiểm tra lại đúng file/đúng sheet rồi thử lại.';
  } finally {
    updateValidityAndButton();
  }
}

// ---------- Thư viện file đã lưu (nằm dưới phần tải file/lịch sử, cùng tab) ----------
function buildLibraryScreenHTML(){
  return `<div class="library-card">
    <h2>Các file đã tải lên</h2>
    <p class="up-sub">Toàn bộ file gốc đã lưu qua các tháng, chia theo sàn. Đổi tên hiển thị của từng tháng, tải lại, hoặc xoá để thay đúng file rồi tính lại.</p>
    <div id="library-body"></div>
  </div>`;
}

function buildLibraryHTML(rows){
  const withFiles = rows.filter(r => r.files && r.files.length);
  if (!withFiles.length) return '<p class="up-status">Chưa có file nào được lưu — tải file lên và tính toán ở phía trên để bắt đầu.</p>';
  const col = (platform) => {
    const groups = withFiles.map(r => {
      const files = (r.files || []).filter(f => ROLE_META[f.key] && ROLE_META[f.key].platform === platform);
      if (!files.length) return '';
      return `<div class="month-group">
        <div class="month-head">
          <span>📁 ${esc(r.label)}</span>
          <span class="month-head-actions">
            <span class="lib-addfile" data-id="${esc(r.id)}" title="Thêm/thay 1 file cho đúng tháng này, không cần tải lại các file khác">➕ thêm file</span>
            <span class="lib-rename" data-id="${esc(r.id)}" data-label="${esc(r.label)}" title="Đổi tên hiển thị">✎ đổi tên</span>
          </span>
        </div>
        <div class="month-files">
          ${files.map(f => `<div class="file-row">
            <span class="ftype">${esc((ROLE_META[f.key] || {}).label || f.key)}</span>
            <span class="fn" title="${esc(f.name)}">${esc(f.name)}</span>
            <a class="icon-btn" href="${sbStoragePublicUrl(f.path)}" target="_blank" rel="noopener" title="Tải về">⬇</a>
            <button class="icon-btn del" data-record="${esc(r.id)}" data-path="${esc(f.path)}" title="Xoá file này">🗑</button>
          </div>`).join('')}
        </div>
      </div>`;
    }).filter(Boolean).join('');
    return groups || '<p class="up-status">Chưa có file nào.</p>';
  };
  return `<div class="lib-cols">
    <div><div class="lib-col-head"><span class="dl-dot shopee"></span>Shopee</div>${col('Shopee')}</div>
    <div><div class="lib-col-head"><span class="dl-dot tiktok"></span>TikTok Shop</div>${col('TikTok')}</div>
  </div>`;
}

function wireLibraryEvents(el){
  el.querySelectorAll('.lib-rename').forEach(btn => {
    btn.addEventListener('click', () => renameLibraryRecord(btn.dataset.id, btn.dataset.label));
  });
  el.querySelectorAll('.icon-btn.del').forEach(btn => {
    btn.addEventListener('click', () => deleteLibraryFile(btn.dataset.record, btn.dataset.path));
  });
  el.querySelectorAll('.lib-addfile').forEach(btn => {
    btn.addEventListener('click', () => addFileToLibraryRecord(btn.dataset.id));
  });
}

// "➕ thêm file" — theo yêu cầu chủ shop (2026-09-22: "khi a thêm file mới
// thì chỉ cần tải thêm file đó thôi chứ") — trước đây chỉ có cách này khi
// XOÁ 1 file bị sai (deleteLibraryFile → restoreRemainingFilesToUploadTab);
// giờ cho phép làm y hệt luồng đó NHƯNG không cần xoá gì trước: tự tải lại
// tất cả file gốc đã lưu của đúng tháng đó vào khu upload, chủ shop chỉ cần
// kéo-thả thêm 1 file mới (ví dụ Creator List) vào, bấm "Tính toán" rồi
// "Lưu vào lịch sử" để ghi đè đúng tháng này (giữ nguyên các file cũ).
async function addFileToLibraryRecord(recordId){
  const record = libraryRows.find(r => r.id === recordId);
  if (!record) return;
  switchToTab('dashboard');
  await restoreRemainingFilesToUploadTab(record);
}

async function refreshLibrary(){
  const el = document.getElementById('library-body');
  if (!el) return;
  el.innerHTML = '<p class="up-status">Đang tải…</p>';
  try {
    libraryRows = await sbFetch('monthly_reports?select=id,label,period_start,files&order=period_start.desc.nullslast,created_at.desc') || [];
    el.innerHTML = buildLibraryHTML(libraryRows);
    wireLibraryEvents(el);
  } catch (err){
    el.innerHTML = '<p class="up-status err">Không tải được: ' + esc(err.message) + '</p>';
  }
}

async function renameLibraryRecord(recordId, currentLabel){
  const newLabel = prompt('Đổi tên hiển thị cho tháng này (không ảnh hưởng tới kỳ dữ liệu dùng để tính toán):', currentLabel);
  if (!newLabel || newLabel === currentLabel) return;
  try {
    await sbFetch('monthly_reports?id=eq.' + encodeURIComponent(recordId), {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ label: newLabel }),
    });
    await refreshHistoryFromServer();
    await refreshLibrary();
  } catch (err){
    alert('Đổi tên thất bại: ' + err.message + ' (có thể tên này đã dùng cho tháng khác — chọn tên khác).');
  }
}

async function restoreRemainingFilesToUploadTab(record){
  detectedFiles = [];
  restoreContext = { label: record.label, recordId: record.id };
  const statusEl = document.getElementById('up-status');
  statusEl.classList.remove('err');
  const total = (record.files || []).length;
  statusEl.textContent = 'Đang tải lại ' + total + ' file còn lại của "' + record.label + '"…';
  let failCount = 0;
  for (const f of (record.files || [])){
    try {
      const resp = await fetch(sbStoragePublicUrl(f.path));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const file = new File([blob], f.name, { type: blob.type || 'application/octet-stream' });
      const meta = ROLE_META[f.key] || null;
      detectedFiles.push({
        file, role: f.key, platform: meta ? meta.platform : null, typeLabel: meta ? meta.label : null,
        monthKey: null, monthLabel: record.label, readError: null,
      });
    } catch (err){
      console.error('Không tải lại được file ' + f.name, err);
      failCount++;
    }
  }
  renderDetectedList();
  statusEl.textContent = 'Đã tự điền lại ' + detectedFiles.length + '/' + total + ' file của "' + record.label + '"'
    + (failCount ? ' (' + failCount + ' file tải lại thất bại, anh chọn tay lại giúp)' : '')
    + ' — chọn file thay thế cho vai trò còn thiếu rồi bấm "Tính toán", sau đó "Lưu vào lịch sử" để ghi đè đúng tháng này.';
}

async function deleteLibraryFile(recordId, filePath){
  if (!confirm('Xoá file này khỏi server? Không thể hoàn tác.')) return;
  try {
    await sbStorageDelete(filePath);
    const record = libraryRows.find(r => r.id === recordId);
    const newFiles = (record.files || []).filter(f => f.path !== filePath);
    await sbFetch('monthly_reports?id=eq.' + encodeURIComponent(recordId), {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ files: newFiles }),
    });
    record.files = newFiles;
    await refreshHistoryFromServer();
    switchToTab('library');
    currentResult = null;
    const resultsEl = document.getElementById('results');
    resultsEl.innerHTML = '';
    resultsEl.classList.remove('show');
    refreshDashboardEmptyState();
    document.getElementById('btn-save-history').disabled = true;
    renderFilesSection(null);
    await restoreRemainingFilesToUploadTab(record);
  } catch (err){
    console.error(err);
    alert('Xoá thất bại: ' + err.message);
  }
}

// ---------- history (Supabase) ----------
// BUG đã tìm ra (2026-09-22, phát hiện khi gợi ý tự động gắn tháng bị lệch
// tháng): trước đây dùng dt.toISOString() để lấy ngày — hàm này LUÔN quy đổi
// sang giờ UTC trước khi cắt chuỗi. Việt Nam là UTC+7, nên 1 ngày lúc 00:00
// giờ Việt Nam (mốc đầu tháng) bị lùi về 17:00 NGÀY HÔM TRƯỚC theo UTC — kết
// quả period_start của các tháng đã lưu trước đây có thể bị lệch sớm 1 ngày
// (ví dụ ngày 01/08 bị lưu thành 2026-07-31), khiến các phép so khớp CHÍNH
// XÁC theo tháng (như gợi ý tự động gắn file mới vào đúng tháng) bị lệch
// sang tháng trước dù nhãn hiển thị vẫn đúng. Sửa lại: lấy NGÀY THEO GIỜ ĐỊA
// PHƯƠNG của trình duyệt (getFullYear/getMonth/getDate), không quy đổi UTC.
// Các tháng ĐÃ lưu trước bản sửa này vẫn giữ period_start cũ (lệch) trong
// database — chỉ tự sửa đúng khi tháng đó được tính lại và "Lưu vào lịch sử"
// lần nữa (ghi đè theo đúng label).
function isoDate(d){
  if (!d) return null;
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return null;
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return y + '-' + mo + '-' + day;
}

async function refreshHistoryFromServer(){
  const noteEl = document.getElementById('history-note');
  try {
    const rows = await sbFetch('monthly_reports?select=id,label,period_start,period_end,created_at') || [];
    // Sắp xếp theo THÁNG THẬT của kỳ báo cáo (period_start), mới nhất lên
    // đầu — không sắp theo created_at/thứ tự lưu nữa (chủ shop phản ánh
    // 2026-09-15: lưu lại 1 tháng cũ sau sẽ đẩy nó lên đầu danh sách, làm
    // danh sách "Xem kỳ" bị lộn xộn không theo trình tự tháng).
    HISTORY = rows.slice().sort((a, b) => {
      const da = a.period_start ? new Date(a.period_start) : null;
      const db = b.period_start ? new Date(b.period_start) : null;
      if (da && db) return db - da;
      if (da) return -1;
      if (db) return 1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
    refreshHistorySelect();
  } catch (err){
    console.error(err);
    if (noteEl) noteEl.textContent = 'Không tải được lịch sử: ' + err.message;
  }
}

function refreshHistorySelect(){
  const sel = document.getElementById('history-select');
  const prevValue = sel.value || 'current';
  const opts = ['<option value="current">Số liệu vừa tính (chưa lưu)</option>']
    .concat(HISTORY.map((h) => `<option value="${esc(h.id)}">${esc(h.label)}</option>`));
  sel.innerHTML = opts.join('');
  // Giữ nguyên lựa chọn đang xem nếu vẫn còn trong danh sách mới (trước đây
  // luôn reset về "current" mỗi lần refresh, kể cả sau khi vừa chọn xem 1
  // kỳ đã lưu — khiến nút hiện sai tên kỳ đang xem) — chỉ về "current" khi
  // giá trị cũ không còn tồn tại nữa.
  sel.value = [...sel.options].some(o => o.value === prevValue) ? prevValue : 'current';
  document.getElementById('history-note').textContent = HISTORY.length
    ? `Đã lưu ${HISTORY.length} tháng trên server.`
    : 'Chưa lưu tháng nào.';
  const refreshBtn = document.getElementById('btn-refresh-all-history');
  if (refreshBtn) refreshBtn.style.display = HISTORY.length > 0 ? '' : 'none';
  const multiToggle = document.getElementById('rc-multi-toggle');
  if (multiToggle) multiToggle.style.display = HISTORY.length >= 2 ? '' : 'none';
  if (HISTORY.length < 2) setMultiMode(false);
  renderRcDropdown();
}

// ---------- "Kỳ báo cáo" — dropdown tự vẽ (2026-09-15) ----------
// Trình duyệt vẽ popup của <select> gốc theo giao diện hệ điều hành, không
// theo được CSS của trang (chủ shop phản ánh nhìn xấu/khó đọc) — nên giữ
// <select id="history-select"> ẩn đi làm "nguồn sự thật" (vẫn phát event
// change để mọi chỗ khác dùng nguyên, không phải sửa lại), còn phần hiển thị
// cho chủ shop bấm là nút + danh sách tự vẽ (rc-select-btn/rc-panel) dưới đây.
//
// Chế độ "Gộp nhiều tháng" (2026-09-15) — dùng chung panel này: bật lên thì
// mỗi kỳ ĐÃ LƯU (trừ "Số liệu vừa tính (chưa lưu)") hiện thành 1 dòng có ô
// tick thay vì bấm-là-chọn-luôn — chủ shop tick nhiều tháng rồi bấm "Xem gộp".
// Chỉ gộp được các tháng LIỀN KỀ (đã chốt với chủ shop) — kiểm tra tính liền kề
// ở thời điểm bấm "Xem gộp" (applyMultiSelect), không chặn lúc tick để đơn giản.
let multiMode = false;
let multiSelectedIds = [];

function setMultiMode(on){
  multiMode = on;
  multiSelectedIds = [];
  const toggle = document.getElementById('rc-multi-toggle');
  const actions = document.getElementById('rc-multi-actions');
  if (toggle) toggle.textContent = on ? 'Thôi gộp' : 'Gộp nhiều tháng';
  if (actions) actions.hidden = !on;
  updateMultiCount();
  renderRcDropdown();
}

function updateMultiCount(){
  const countEl = document.getElementById('rc-multi-count');
  const applyBtn = document.getElementById('rc-multi-apply');
  if (countEl) countEl.textContent = `Đã chọn ${multiSelectedIds.length} tháng`;
  if (applyBtn) applyBtn.disabled = multiSelectedIds.length < 2;
}

function renderRcDropdown(){
  const sel = document.getElementById('history-select');
  const panel = document.getElementById('rc-panel');
  const labelEl = document.getElementById('rc-select-label');
  if (!sel || !panel || !labelEl) return;
  const options = [...sel.options];
  const current = sel.value;
  if (multiMode){
    labelEl.textContent = 'Chọn các tháng cần gộp bên dưới';
    panel.innerHTML = options.filter(o => o.value !== 'current').map(o => {
      const checked = multiSelectedIds.includes(o.value);
      return `
      <label class="rc-item rc-item-check-mode${checked ? ' is-selected' : ''}">
        <input type="checkbox" class="rc-item-checkbox" data-value="${esc(o.value)}" ${checked ? 'checked' : ''}>
        <span class="rc-item-label">${esc(o.textContent)}</span>
      </label>`;
    }).join('') || '<div style="padding:10px;font-size:13px;color:var(--ink-faint);">Chưa có tháng nào đã lưu để gộp.</div>';
    return;
  }
  const selectedOpt = options.find(o => o.value === current);
  labelEl.textContent = selectedOpt ? selectedOpt.textContent : 'Chọn kỳ';
  panel.innerHTML = options.map(o => `
    <div class="rc-item${o.value === current ? ' is-selected' : ''}" data-value="${esc(o.value)}" role="option" aria-selected="${o.value === current}">
      <span class="rc-item-check">${o.value === current ? '✓' : ''}</span>
      <span class="rc-item-label">${esc(o.textContent)}</span>
    </div>`).join('');
}

// Bấm "Xem gộp": kiểm tra các tháng đã tick có LIỀN KỀ nhau trong danh sách
// (đã sắp theo đúng thứ tự thời gian bởi refreshHistoryFromServer) hay không —
// nếu bỏ cách quãng (vd chọn tháng 6 và tháng 8, bỏ qua tháng 7) thì báo lỗi và
// không cho gộp, đúng quyết định đã chốt với chủ shop.
async function applyMultiSelect(){
  if (multiSelectedIds.length < 2) return;
  const orderedIds = HISTORY.map(h => h.id); // đã sắp theo period_start, mới nhất trước
  const indices = multiSelectedIds.map(id => orderedIds.indexOf(id)).sort((a, b) => a - b);
  const isContiguous = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
  if (!isContiguous){
    alert('Chỉ gộp được các tháng LIỀN KỀ nhau (không bỏ cách quãng). Chọn lại cho đúng các tháng liên tiếp nhé.');
    return;
  }
  const noteEl = document.getElementById('history-note');
  if (noteEl) noteEl.textContent = 'Đang tải dữ liệu các tháng đã chọn…';
  try {
    const idsParam = multiSelectedIds.map(id => encodeURIComponent(id)).join(',');
    const rows = await sbFetch(`monthly_reports?id=in.(${idsParam})&select=id,label,period_start,data`) || [];
    const byId = {}; rows.forEach(r => { byId[r.id] = r; });
    // sắp theo đúng thứ tự thời gian tăng dần (period_start) trước khi gộp
    const entries = [...multiSelectedIds]
      .map(id => byId[id])
      .filter(Boolean)
      .sort((a, b) => new Date(a.period_start || 0) - new Date(b.period_start || 0))
      .map(r => ({ label: r.label, data: r.data }));
    if (entries.length < 2) throw new Error('Không tải đủ dữ liệu các tháng đã chọn.');
    const combined = combineMonthlyResults(entries);
    const resultsEl = document.getElementById('results');
    renderResults(resultsEl, combined, { label: 'Gộp: ' + entries.map(e => e.label).join(' + ') });
    renderFilesSection(null);
    switchToTab('dashboard');
    if (noteEl) noteEl.textContent = HISTORY.length ? `Đã lưu ${HISTORY.length} tháng trên server.` : 'Chưa lưu tháng nào.';
    setMultiMode(false);
  } catch (err){
    console.error(err);
    if (noteEl) noteEl.textContent = 'Gộp thất bại: ' + err.message;
  }
}

function wireRcDropdown(){
  const btn = document.getElementById('rc-select-btn');
  const panel = document.getElementById('rc-panel');
  const sel = document.getElementById('history-select');
  const multiToggle = document.getElementById('rc-multi-toggle');
  const multiCancel = document.getElementById('rc-multi-cancel');
  const multiApply = document.getElementById('rc-multi-apply');
  if (!btn || !panel || !sel) return;
  const closePanel = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const openPanel = () => { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.hidden) openPanel(); else closePanel();
  });
  panel.addEventListener('change', (e) => {
    const cb = e.target.closest('.rc-item-checkbox');
    if (!cb) return;
    const value = cb.dataset.value;
    if (cb.checked){ if (!multiSelectedIds.includes(value)) multiSelectedIds.push(value); }
    else multiSelectedIds = multiSelectedIds.filter(v => v !== value);
    updateMultiCount();
    renderRcDropdown();
  });
  panel.addEventListener('click', (e) => {
    if (multiMode) return; // chế độ gộp: chọn qua ô tick (event 'change' ở trên), không đóng panel khi bấm dòng
    const item = e.target.closest('.rc-item');
    if (!item) return;
    const value = item.dataset.value;
    if (value !== sel.value){
      sel.value = value;
      sel.dispatchEvent(new Event('change'));
    }
    closePanel();
  });
  if (multiToggle) multiToggle.addEventListener('click', () => { setMultiMode(!multiMode); openPanel(); });
  if (multiCancel) multiCancel.addEventListener('click', () => setMultiMode(false));
  if (multiApply) multiApply.addEventListener('click', () => applyMultiSelect());
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn && !(multiToggle && multiToggle.contains(e.target))) closePanel();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
}

async function onHistorySelectChange(){
  const sel = document.getElementById('history-select');
  const v = sel.value;
  const resultsEl = document.getElementById('results');
  if (v === 'current'){
    if (currentResult){ renderResults(resultsEl, currentResult); switchToTab('dashboard'); }
    renderFilesSection(null);
    return;
  }
  const entry = HISTORY.find(h => h.id === v);
  if (!entry) return;
  const noteEl = document.getElementById('history-note');
  noteEl.textContent = 'Đang tải…';
  try {
    const rows = await sbFetch('monthly_reports?id=eq.' + encodeURIComponent(v) + '&select=data,label,files');
    if (rows && rows[0]){
      renderResults(resultsEl, rows[0].data, { label: rows[0].label });
      renderFilesSection(rows[0].files);
      switchToTab('dashboard');
    }
    refreshHistorySelect();
  } catch (err){
    noteEl.textContent = 'Không tải được: ' + err.message;
  }
}

async function onSaveHistory(){
  if (!currentResult) return;
  let label;
  if (restoreContext){
    label = restoreContext.label;
  } else {
    const defaultLabel = fmtDateVN(currentResult.minDate) + ' – ' + fmtDateVN(currentResult.maxDate);
    label = prompt('Đặt tên cho kỳ báo cáo này (ví dụ: Tháng 7/2026):', defaultLabel);
    if (!label) return;
  }

  const statusEl = document.getElementById('history-note');
  statusEl.textContent = 'Đang tải file gốc lên…';
  const files = await uploadOriginalFiles(slugifyForPath(label));

  statusEl.textContent = 'Đang lưu…';
  try {
    await sbFetch('monthly_reports?on_conflict=label', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{
        label,
        period_start: isoDate(currentResult.minDate),
        period_end: isoDate(currentResult.maxDate),
        data: currentResult,
        files,
        updated_at: new Date().toISOString(),
      }]),
    });
    restoreContext = null;
    await refreshHistoryFromServer();
    renderFilesSection(files);
    // Không tự chuyển sang tab Dashboard nữa sau khi lưu (theo yêu cầu chủ
    // shop 2026-09-15) — ở lại tab hiện tại, chủ shop tự bấm "Dashboard" khi
    // muốn xem, tránh bị nhảy tab liên tục sau mỗi thao tác Tính toán/Lưu.
    const filesNote = files.length < Object.keys(selectedFiles).length
      ? ` (lưu ý: ${Object.keys(selectedFiles).length - files.length} file gốc tải lên chưa thành công — thử lưu lại nếu cần)`
      : '';
    statusEl.textContent = `Đã lưu "${label}" lên server${filesNote} — mở lại link này bất kỳ lúc nào (điện thoại/máy tính) đều thấy đủ lịch sử.`;
  } catch (err){
    console.error(err);
    statusEl.textContent = 'Lưu lịch sử thất bại: ' + err.message;
  }
}

// Tính lại toàn bộ các tháng đã lưu bằng công thức mới nhất của computeAll():
// tải lại file gốc từng tháng từ Storage (như restoreRemainingFilesToUploadTab
// nhưng đưa thẳng vào computeAll, KHÔNG đụng biến global selectedFiles), rồi
// ghi đè riêng cột `data` — giữ nguyên label/period_start/period_end/files.
async function onRefreshAllHistory(){
  if (!HISTORY.length) return;
  if (!confirm('Tính lại toàn bộ ' + HISTORY.length + ' tháng đã lưu bằng công thức mới nhất? Việc này sẽ tải lại file gốc của từng tháng và ghi đè số liệu cũ (không đổi file gốc, không đổi tên tháng). Có thể mất vài phút. Tiếp tục?')) return;

  const btn = document.getElementById('btn-refresh-all-history');
  const noteEl = document.getElementById('history-note');
  btn.disabled = true;

  let records;
  try {
    records = await sbFetch('monthly_reports?select=id,label,files') || [];
  } catch (err){
    noteEl.textContent = 'Không lấy được danh sách: ' + err.message;
    btn.disabled = false;
    return;
  }

  let okCount = 0;
  const failed = [];

  for (let i = 0; i < records.length; i++){
    const record = records[i];
    noteEl.textContent = `Đang cập nhật ${i + 1}/${records.length}: "${record.label}"…`;
    try {
      const localFiles = {};
      for (const f of (record.files || [])){
        const resp = await fetch(sbStoragePublicUrl(f.path));
        if (!resp.ok) throw new Error(`Tải file "${f.name}" thất bại (HTTP ${resp.status})`);
        const blob = await resp.blob();
        localFiles[f.key] = new File([blob], f.name, { type: blob.type || 'application/octet-stream' });
      }

      const freshResult = await computeAll(localFiles);

      await sbFetch('monthly_reports?id=eq.' + encodeURIComponent(record.id), {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ data: freshResult, updated_at: new Date().toISOString() }),
      });
      okCount++;
    } catch (err){
      console.error('Cập nhật lại thất bại cho "' + record.label + '":', err);
      failed.push(record.label + ' (' + err.message + ')');
    }
  }

  btn.disabled = false;
  await refreshHistoryFromServer();
  noteEl.textContent = failed.length
    ? `Đã cập nhật ${okCount}/${records.length} tháng. Lỗi: ${failed.join('; ')}`
    : `Đã cập nhật lại toàn bộ ${okCount} tháng theo công thức mới nhất.`;
}

function init(){
  document.getElementById('app-root').innerHTML = buildInstallHintHTML() + buildTabsHTML() +
    `<div class="screen active" id="screen-dashboard">${buildDashboardHTML()}</div>` +
    `<div class="screen" id="screen-library">${buildUploadFlowHTML()}${buildLibraryScreenHTML()}</div>`;
  wireInstallHint();
  wireUpload();
  wireTabs();
  document.getElementById('history-select').addEventListener('change', onHistorySelectChange);
  wireRcDropdown();
  document.getElementById('btn-save-history').addEventListener('click', onSaveHistory);
  document.getElementById('btn-refresh-all-history').addEventListener('click', onRefreshAllHistory);
  document.getElementById('history-bar').style.display = 'flex';
  refreshDashboardEmptyState();
  refreshHistoryFromServer();
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
