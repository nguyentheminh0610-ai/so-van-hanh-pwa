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
function buildDashboardHTML(){
  return `
  <div class="hb-view" id="hb-view">
    <label for="history-select">Xem kỳ:</label>
    <select id="history-select"></select>
    <button class="btn-secondary" id="btn-refresh-all-history" style="display:none;">🔄 Cập nhật lại lịch sử</button>
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
    switchToTab('dashboard');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          <span class="lib-rename" data-id="${esc(r.id)}" data-label="${esc(r.label)}" title="Đổi tên hiển thị">✎ đổi tên</span>
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
function isoDate(d){
  if (!d) return null;
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return null;
  return dt.toISOString().slice(0, 10);
}

async function refreshHistoryFromServer(){
  const noteEl = document.getElementById('history-note');
  try {
    HISTORY = await sbFetch('monthly_reports?select=id,label,period_start,period_end,created_at&order=created_at.desc') || [];
    refreshHistorySelect();
  } catch (err){
    console.error(err);
    if (noteEl) noteEl.textContent = 'Không tải được lịch sử: ' + err.message;
  }
}

function refreshHistorySelect(){
  const sel = document.getElementById('history-select');
  const opts = ['<option value="current">Số liệu vừa tính (chưa lưu)</option>']
    .concat(HISTORY.map((h) => `<option value="${esc(h.id)}">${esc(h.label)}</option>`));
  sel.innerHTML = opts.join('');
  sel.value = 'current';
  document.getElementById('history-note').textContent = HISTORY.length
    ? `Đã lưu ${HISTORY.length} tháng trên server.`
    : 'Chưa lưu tháng nào.';
  const refreshBtn = document.getElementById('btn-refresh-all-history');
  if (refreshBtn) refreshBtn.style.display = HISTORY.length > 0 ? '' : 'none';
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
    switchToTab('dashboard');
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
