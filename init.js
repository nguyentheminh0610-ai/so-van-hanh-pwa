/* ============================================================
   Page wiring: upload slots, compute, lưu/xem lịch sử qua Supabase
   (thay cho cơ chế claude.use('artifact') của bản Artifact cũ).
   ============================================================ */
const FILE_SLOTS = [
  { key: 'shopeeOrders', label: 'Shopee — tất cả đơn hàng', required: true },
  { key: 'shopeeReturnRefund', label: 'Shopee — return/refund (Order.return_refund)', required: true },
  { key: 'tiktokOrders', label: 'TikTok — tất cả đơn hàng', required: true },
  { key: 'tiktokReturns', label: 'TikTok — trả hàng', required: true },
  { key: 'income', label: 'Shopee — Income (tài chính)', required: true },
  { key: 'tiktokFinance', label: 'TikTok — tài chính', required: true },
  { key: 'shopStats', label: 'Shopee — Shop Stats', required: false },
];

const selectedFiles = {};
let currentResult = null;
let HISTORY = []; // [{id, label, period_start, period_end, created_at}] — chưa có "data" đầy đủ, tải khi chọn xem
let pendingUnmatched = [];

// ---------- Supabase config (lưu trong localStorage của trình duyệt) ----------
function getConfig(){
  try {
    return { url: localStorage.getItem('sb_url') || '', key: localStorage.getItem('sb_key') || '' };
  } catch (e){ return { url: '', key: '' }; }
}
function saveConfig(url, key){
  try {
    localStorage.setItem('sb_url', url.trim().replace(/\/+$/, ''));
    localStorage.setItem('sb_key', key.trim());
  } catch (e){}
}
function isConfigured(){
  const c = getConfig();
  return !!(c.url && c.key);
}

async function sbFetch(path, opts){
  const c = getConfig();
  if (!c.url || !c.key) throw new Error('Chưa cấu hình Supabase — bấm "Cài đặt kết nối" ở trên để nhập URL/Key.');
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

async function uploadOriginalFiles(labelSlug){
  const uploaded = [];
  for (const slot of FILE_SLOTS){
    const file = selectedFiles[slot.key];
    if (!file) continue;
    const path = labelSlug + '/' + slot.key + '__' + file.name;
    try {
      await sbStorageUpload(path, file);
      uploaded.push({ key: slot.key, name: file.name, path });
    } catch (err){
      console.error('Tải file gốc lên thất bại (' + slot.key + '):', err);
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

// ---------- Settings panel ----------
function buildSettingsHTML(){
  const c = getConfig();
  const configured = isConfigured();
  return `
  <div class="settings-card" id="settings-card" ${configured ? 'style="display:none;"' : ''}>
    <h2>Cài đặt kết nối lưu trữ (Supabase)</h2>
    <p class="st-sub">Nhập 1 lần — trình duyệt sẽ tự nhớ. Lấy 2 giá trị này ở Supabase: Project Settings &gt; API.</p>
    <div class="st-row"><label>Project URL</label><input type="text" id="sb-url-input" placeholder="https://xxxxxxxx.supabase.co" value="${esc(c.url)}"></div>
    <div class="st-row"><label>anon public key</label><input type="text" id="sb-key-input" placeholder="eyJhbGciOi..." value="${esc(c.key)}"></div>
    <div class="st-actions">
      <button class="btn-primary" id="btn-save-config">Lưu &amp; kết nối</button>
      <span class="st-status" id="st-status"></span>
    </div>
  </div>
  <button class="st-toggle" id="btn-toggle-settings" ${configured ? '' : 'style="display:none;"'}>⚙ Cài đặt kết nối</button>
  `;
}

function wireSettings(){
  document.getElementById('btn-save-config').addEventListener('click', async () => {
    const url = document.getElementById('sb-url-input').value;
    const key = document.getElementById('sb-key-input').value;
    const statusEl = document.getElementById('st-status');
    if (!url || !key){
      statusEl.className = 'st-status err';
      statusEl.textContent = 'Nhập đủ cả URL và key.';
      return;
    }
    saveConfig(url, key);
    statusEl.className = 'st-status';
    statusEl.textContent = 'Đang kiểm tra kết nối…';
    try {
      await sbFetch('monthly_reports?select=id&limit=1');
      statusEl.className = 'st-status ok';
      statusEl.textContent = 'Kết nối thành công.';
      document.getElementById('settings-card').style.display = 'none';
      document.getElementById('btn-toggle-settings').style.display = '';
      await refreshHistoryFromServer();
    } catch (err){
      statusEl.className = 'st-status err';
      statusEl.textContent = 'Không kết nối được: ' + err.message + ' — kiểm tra lại URL/key và đã chạy SQL tạo bảng chưa.';
    }
  });
  document.getElementById('btn-toggle-settings').addEventListener('click', () => {
    const card = document.getElementById('settings-card');
    card.style.display = card.style.display === 'none' ? '' : 'none';
  });
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

// ---------- Upload UI ----------
function buildUploadHTML(){
  return `
  <div class="upload-card">
    <h2>Tải số liệu tháng này</h2>
    <p class="up-sub">Chọn đúng file export tháng gần nhất từ Shopee Seller Center &amp; TikTok Shop Partner Center. Bấm ô bên dưới để chọn tất cả file cùng lúc (hoặc kéo-thả) — hệ thống tự nhận diện từng loại file, chỗ nào chưa đúng thì sửa tay ở dòng tương ứng. Mọi tính toán chạy ngay trên trình duyệt của anh, không gửi file lên đâu cả — chỉ khi anh bấm "Lưu vào lịch sử" thì kết quả và các file gốc mới được lưu lên server để xem/tải lại sau này. File Order.cancelled không cần nữa (đã nằm sẵn trong file "tất cả đơn hàng").</p>
    <div class="up-dropzone" id="up-dropzone">
      <input type="file" id="up-multi-input" accept=".xlsx,.xls,.csv" multiple style="display:none;">
      <div class="up-dz-icon">📂</div>
      <div class="up-dz-text"><b>Bấm để chọn tất cả file cùng lúc</b><br>(hoặc kéo-thả cả 7 file vào đây)</div>
    </div>
    <div class="up-grid" id="up-grid"></div>
    <div class="up-unmatched" id="up-unmatched" style="display:none;"></div>
    <div class="up-actions">
      <button class="btn-primary" id="btn-compute" disabled>Tính toán</button>
      <span class="up-status" id="up-status"></span>
    </div>
  </div>
  <div class="history-bar" id="history-bar" style="display:none;">
    <select id="history-select"></select>
    <button class="btn-secondary" id="btn-save-history" disabled>Lưu vào lịch sử</button>
    <span class="hb-note" id="history-note"></span>
  </div>
  <div id="files-section"></div>
  <div id="results"></div>`;
}

function buildUpGridHTML(){
  return FILE_SLOTS.map((slot, i) => `
    <div class="up-slot" id="up-slot-${slot.key}">
      <div class="up-num">${i+1}</div>
      <div class="up-body">
        <div class="up-label">${slot.label}${slot.required ? '' : ' <span class="up-optional">(tuỳ chọn — cần cho Voucher extra/kênh/SP)</span>'}</div>
        <div class="up-filename">Chưa chọn file</div>
        <label class="up-manual-link">chọn tay<input type="file" accept=".xlsx,.xls,.csv" data-key="${slot.key}" style="display:none;"></label>
      </div>
    </div>`).join('');
}

function checkReady(){
  const ready = FILE_SLOTS.filter(s => s.required).every(s => selectedFiles[s.key]);
  document.getElementById('btn-compute').disabled = !ready;
}

// ---------- nhận diện file tự động theo tên ----------
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
  if (n.includes('return refund')) return 'shopeeReturnRefund';
  if (hasTiktok && n.includes('tra hang')) return 'tiktokReturns';
  if (hasTiktok && (n.includes('tai chinh') || n.includes('finance'))) return 'tiktokFinance';
  if (n.includes('income')) return 'income';
  if (n.includes('shop stats') || n.includes('shopstats')) return 'shopStats';
  if (hasTiktok && (n.includes('don hang') || n.includes('order'))) return 'tiktokOrders';
  if (hasShopee && (n.includes('don hang') || n.includes('order'))) return 'shopeeOrders';
  return null;
}

function assignFile(key, file){
  if (!FILE_SLOTS.some(s => s.key === key)) return;
  selectedFiles[key] = file;
  const slotEl = document.getElementById('up-slot-' + key);
  if (slotEl){
    slotEl.classList.add('filled');
    slotEl.querySelector('.up-filename').textContent = file.name;
  }
}

function clearFile(key){
  delete selectedFiles[key];
  const slotEl = document.getElementById('up-slot-' + key);
  if (slotEl){
    slotEl.classList.remove('filled');
    slotEl.querySelector('.up-filename').textContent = 'Chưa chọn file';
  }
}

function renderUnmatched(unmatchedFiles){
  pendingUnmatched = unmatchedFiles;
  const box = document.getElementById('up-unmatched');
  if (!box) return;
  if (!unmatchedFiles.length){ box.innerHTML = ''; box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = '<div class="up-unmatched-title">Không tự nhận diện được ' + unmatchedFiles.length + ' file (vd. Order.cancelled cũ không cần dùng nữa) — chọn tay loại file nếu cần:</div>' +
    unmatchedFiles.map((f, i) => `
      <div class="up-unmatched-item">
        <span class="uu-name">${esc(f.name)}</span>
        <select data-idx="${i}">
          <option value="">— Chọn loại file —</option>
          ${FILE_SLOTS.map(s => `<option value="${s.key}">${esc(s.label)}</option>`).join('')}
          <option value="__skip">Bỏ qua file này</option>
        </select>
      </div>`).join('');
  box.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const file = pendingUnmatched[idx];
      const val = e.target.value;
      if (val && val !== '__skip'){
        assignFile(val, file);
        checkReady();
      }
      e.target.closest('.up-unmatched-item').style.opacity = '0.4';
      e.target.disabled = true;
    });
  });
}

function handleIncomingFiles(fileList){
  const files = Array.from(fileList || []);
  const unmatched = [];
  files.forEach(file => {
    const key = classifyFileName(file.name);
    if (key) assignFile(key, file); else unmatched.push(file);
  });
  renderUnmatched(unmatched);
  checkReady();
}

function wireUpload(){
  document.getElementById('up-grid').innerHTML = buildUpGridHTML();

  document.querySelectorAll('#up-grid input[type=file]').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const key = e.target.dataset.key;
      const file = e.target.files[0];
      if (file) assignFile(key, file); else clearFile(key);
      checkReady();
    });
  });

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
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err){
    console.error(err);
    statusEl.classList.add('err');
    statusEl.textContent = 'Lỗi khi đọc file: ' + err.message + ' — kiểm tra lại đúng file/đúng sheet rồi thử lại.';
  } finally {
    checkReady();
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
  if (!isConfigured()) return;
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
}

async function onHistorySelectChange(){
  const sel = document.getElementById('history-select');
  const v = sel.value;
  const resultsEl = document.getElementById('results');
  if (v === 'current'){
    if (currentResult){ renderResults(resultsEl, currentResult); }
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
    }
    refreshHistorySelect();
  } catch (err){
    noteEl.textContent = 'Không tải được: ' + err.message;
  }
}

async function onSaveHistory(){
  if (!currentResult) return;
  if (!isConfigured()){
    document.getElementById('settings-card').style.display = '';
    document.getElementById('history-note').textContent = 'Cần cài đặt kết nối trước khi lưu (xem ô "Cài đặt kết nối" phía trên).';
    return;
  }
  const defaultLabel = fmtDateVN(currentResult.minDate) + ' – ' + fmtDateVN(currentResult.maxDate);
  const label = prompt('Đặt tên cho kỳ báo cáo này (ví dụ: Tháng 7/2026):', defaultLabel);
  if (!label) return;

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
    await refreshHistoryFromServer();
    renderFilesSection(files);
    const filesNote = files.length < Object.keys(selectedFiles).length
      ? ` (lưu ý: ${Object.keys(selectedFiles).length - files.length} file gốc tải lên chưa thành công — thử lưu lại nếu cần)`
      : '';
    statusEl.textContent = `Đã lưu "${label}" lên server${filesNote} — mở lại link này bất kỳ lúc nào (điện thoại/máy tính) đều thấy đủ lịch sử.`;
  } catch (err){
    console.error(err);
    statusEl.textContent = 'Lưu lịch sử thất bại: ' + err.message;
  }
}

function init(){
  document.getElementById('app-root').innerHTML = buildInstallHintHTML() + buildSettingsHTML() + buildUploadHTML();
  wireSettings();
  wireInstallHint();
  wireUpload();
  document.getElementById('history-select').addEventListener('change', onHistorySelectChange);
  document.getElementById('btn-save-history').addEventListener('click', onSaveHistory);
  if (isConfigured()){
    document.getElementById('history-bar').style.display = 'flex';
    refreshHistoryFromServer();
  }
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
