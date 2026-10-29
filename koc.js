/* ============================================================================
   Tab "Chấm điểm KOC" — đọc 2 bảng koc_scores / koc_contents (schema ở
   scripts/koc-tables.sql), do skill check-koc ghi vào mỗi 2 ngày trên PC trực.
   Trang này CHỈ ĐỌC, không tự vào TikTok.

   Chốt 28–29/10/2026 với chủ shop:
   - "% duyệt" tính trên KOC ĐÃ CHẤM: DUYỆT / (DUYỆT + KHÔNG DUYỆT).
   - Không có mốc "hôm nay" (đồng bộ 2 ngày/lần nên sẽ sai) → đổi thành
     "Mới lên bài (2 ngày gần nhất)".
   - Gộp kỳ tuần/tháng theo NGÀY ĐĂNG video, nên không cần lưu lịch sử số liệu.
   - Xếp loại theo ROI: >=50 Hiệu quả / 20–50 Tạm / <20 Kém.

   ⚠️ KHÔNG được cộng/trung bình các tỉ lệ khi gộp nhiều KOC. Đơn/1.000 view và
   ROI phải tính lại từ số tổng (xem kocAgg). Cộng tỷ lệ ra số vô nghĩa.
============================================================================ */

let kocRows = null; // {scores: [], contents: []} — cache sau lần tải đầu

// Ngưỡng tiêu chí "KOC làm việc hiệu quả" (chủ shop có thể chỉnh)
const KOC_MIN_DON = 10;        // tiêu chí 1
const KOC_MIN_DON_1K = 1.0;    // tiêu chí 2 — đơn trên 1.000 view
const KOC_MIN_ROI = 50;        // tiêu chí 3
const KOC_ROI_TAM = 20;        // dưới mức này là Kém
const KOC_MOI_DANG_NGAY = 2;   // "mới lên bài" = trong 2 ngày gần nhất

function kocToday(){
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function kocDateKey(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

// [from, to] dạng 'YYYY-MM-DD', bao gồm cả 2 đầu. 'all' = không giới hạn.
function kocRange(period){
  const today = kocToday();
  if (period === 'all') return ['0000-01-01', kocDateKey(today)];
  if (period === 'week'){
    const from = new Date(today); from.setDate(from.getDate() - 6);
    return [kocDateKey(from), kocDateKey(today)];
  }
  if (period === 'month'){
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return [kocDateKey(from), kocDateKey(today)];
  }
  const from = new Date(today); from.setDate(from.getDate() - 89);
  return [kocDateKey(from), kocDateKey(today)];
}

function kocInRange(d, range){ return d && d >= range[0] && d <= range[1]; }

async function kocLoadRows(){
  if (kocRows) return kocRows;
  const [scores, contents] = await Promise.all([
    sbFetch('koc_scores?select=*&order=stt.asc&limit=2000'),
    sbFetch('koc_contents?select=*&order=ngay_dang.desc&limit=5000'),
  ]);
  kocRows = { scores: scores || [], contents: contents || [] };
  return kocRows;
}

/* --------------------------------------------------------------- gộp số ---
   Trả về tổng tuyệt đối + CÁC TỈ LỆ TÍNH LẠI TỪ TỔNG (không phải trung bình).
*/
function kocAgg(contents){
  const s = { view: 0, don: 0, gmv: 0, hoaHong: 0, monBan: 0, monHoan: 0,
              video: 0, live: 0 };
  contents.forEach(c => {
    s.view += c.luot_xem || 0;
    s.don += c.so_don || 0;
    s.gmv += c.gmv || 0;
    s.hoaHong += c.hoa_hong || 0;
    s.monBan += c.so_mon_ban || 0;
    s.monHoan += c.so_mon_hoan || 0;
    if (c.loai === 'live') s.live++; else s.video++;
  });
  s.don1k = s.view > 0 ? s.don / s.view * 1000 : null;
  s.tyLeHoan = s.monBan > 0 ? s.monHoan / s.monBan : null;
  return s;
}

// Gộp nội dung theo từng KOC, kèm giá vốn mẫu lấy từ koc_scores
function kocByCreator(scores, contents){
  const vonByKoc = new Map();
  scores.forEach(r => {
    if (r.ket_qua !== 'DUYỆT' || !r.gia_von_mau) return;
    vonByKoc.set(r.koc_username, (vonByKoc.get(r.koc_username) || 0) + r.gia_von_mau);
  });
  const byKoc = new Map();
  contents.forEach(c => {
    if (!byKoc.has(c.koc_username)) byKoc.set(c.koc_username, []);
    byKoc.get(c.koc_username).push(c);
  });
  const out = [];
  byKoc.forEach((list, koc) => {
    const a = kocAgg(list);
    const von = vonByKoc.get(koc) || null;
    out.push({
      koc, agg: a, von,
      roi: von ? a.gmv / von : null,
      ngayDau: list.map(c => c.ngay_dang).sort()[0],
      link: (list.slice().sort((x, y) => (y.gmv || 0) - (x.gmv || 0))[0] || {}).link,
    });
  });
  return out.sort((x, y) => y.agg.gmv - x.agg.gmv);
}

function kocXepLoai(roi){
  if (roi === null || roi === undefined) return null;
  if (roi >= KOC_MIN_ROI) return 'Hiệu quả';
  if (roi >= KOC_ROI_TAM) return 'Tạm';
  return 'Kém';
}

/* 7 tiêu chí "nên gửi thêm mẫu". 3 tiêu chí cuối CHƯA CÓ DỮ LIỆU (tỷ lệ hoàn,
   tỷ lệ xem hết, ngày nhận mẫu) nên chỉ chấm trên các tiêu chí có số thật và
   nói rõ còn thiếu bao nhiêu — không im lặng coi như trượt. */
function kocTieuChi(k){
  const list = [];
  list.push({ ten: 'Số đơn ≥ ' + KOC_MIN_DON, dat: k.agg.don >= KOC_MIN_DON, co: true });
  list.push({ ten: 'Đơn/1.000 view ≥ ' + fmtRatio(KOC_MIN_DON_1K),
              dat: k.agg.don1k !== null && k.agg.don1k >= KOC_MIN_DON_1K,
              co: k.agg.don1k !== null });
  list.push({ ten: 'ROI ≥ ' + KOC_MIN_ROI, dat: k.roi !== null && k.roi >= KOC_MIN_ROI,
              co: k.roi !== null });
  list.push({ ten: '≥ 2 video hoặc có LIVE',
              dat: k.agg.video >= 2 || k.agg.live > 0, co: true });
  list.push({ ten: 'Tỷ lệ hoàn ≤ 10%', dat: false, co: false });
  list.push({ ten: 'Tỷ lệ xem hết ≥ 3%', dat: false, co: false });
  list.push({ ten: 'Đăng trong 7 ngày từ khi nhận mẫu', dat: false, co: false });
  const coSo = list.filter(t => t.co);
  return { list, dat: coSo.filter(t => t.dat).length, tong: coSo.length,
           thieu: list.length - coSo.length };
}

/* ------------------------------------------------------------ khối số -----*/
function kocKpiHtml(scores, agg){
  const duyet = scores.filter(r => r.ket_qua === 'DUYỆT');
  const pct = scores.length ? duyet.length / scores.length * 100 : 0;
  const daLen = duyet.filter(r => r.trang_thai_mau === 'da_dang').length;
  const canGiuc = duyet.filter(r => r.trang_thai_mau === 'da_nhan_chua_dang').length;
  const tiles = [
    ['% duyệt', fmtRatio(pct) + '%',
     duyet.length + ' duyệt / ' + scores.length + ' KOC đã chấm', false],
    ['Đã lên bài', daLen + '/' + duyet.length,
     'trong số KOC đã duyệt', false],
    ['Cần giục đăng bài', canGiuc,
     canGiuc ? 'đã nhận mẫu mà chưa đăng' : 'không ai tồn', true],
    ['Đơn từ KOC', fmtInt(agg.don),
     fmtVND(agg.gmv) + ' · ' + fmtInt(agg.view) + ' view', false],
  ];
  return '<div class="kpi-row">' + tiles.map(([label, val, sub, warn]) =>
    `<div class="kpi-tile"><div class="k-label">${esc(label)}</div>
      <div class="k-value"${warn && val ? ' style="color:var(--warn)"' : ''}>${esc(String(val))}</div>
      <div class="k-sub">${esc(sub)}</div></div>`
  ).join('') + '</div>';
}

/* ------------------------------------------- 1. KOC cần check bài đăng ----*/
function kocActionHtml(scores){
  const chuaDang = scores.filter(r => r.trang_thai_mau === 'da_nhan_chua_dang');
  const dangGiao = scores.filter(r => r.trang_thai_mau === 'dang_giao');
  const chuaRo = scores.filter(r => r.ket_qua === 'DUYỆT' && !r.trang_thai_mau);

  let html = '';
  if (!chuaDang.length){
    html += '<p class="cskh-quiet">Không có KOC nào đã nhận mẫu mà chưa đăng bài.</p>';
  } else {
    html += '<div class="feed">' + chuaDang.map(r => `<div class="fi bad">
      <div class="fi-head"><span class="tag tiktok">TikTok</span>
        <span class="tag why">đã nhận mẫu · chưa đăng</span>
        <b>${esc(r.koc_username)}</b></div>
      <div class="fi-body">Đã gửi <b>${esc(r.sp_gui || r.sku_gui || 'mẫu')}</b>${
        r.gia_von_mau ? ' — giá vốn ' + fmtVND(r.gia_von_mau) : ''}. Chưa thấy bài đăng nào.</div>
      <div class="fi-foot">
        <a class="lnk" href="https://affiliate.tiktok.com/affiliate/sample/sample-request?shop_region=VN&shop_id=7494594978743617682" target="_blank" rel="noopener">↗ Mở trang hàng mẫu để nhắc</a>
        <span>điểm ${fmtInt(r.diem || 0)}</span></div>
    </div>`).join('') + '</div>';
  }
  if (dangGiao.length){
    html += `<p class="cskh-quiet"><b>${fmtInt(dangGiao.length)} KOC đang trên đường nhận hàng</b>
      (${dangGiao.map(r => esc(r.koc_username)).join(', ')}) — <b>chưa được giục</b>, họ chưa nhận được mẫu.</p>`;
  }
  if (chuaRo.length){
    html += `<p class="cskh-quiet">${fmtInt(chuaRo.length)} KOC đã duyệt trong sổ nhưng không thấy ở
      tab trạng thái nào của TikTok (có thể còn ở "Chờ xem xét" hoặc đã huỷ):
      ${chuaRo.map(r => esc(r.koc_username)).join(', ')}.</p>`;
  }
  return html;
}

/* ------------------------------------------ 2. KOC làm việc hiệu quả -----*/
function kocEffectiveHtml(list){
  if (!list.length) return '<p class="cskh-quiet">Chưa có KOC nào có số liệu trong kỳ này.</p>';
  const scored = list.map(k => ({ k, tc: kocTieuChi(k) }));
  const nen = scored.filter(x => x.tc.dat >= Math.ceil(x.tc.tong * 0.75) && x.k.agg.don > 0);
  const ngung = scored.filter(x => x.k.agg.don === 0);
  let html = '';
  if (nen.length){
    html += '<div class="feed">' + nen.map(({ k, tc }) => `<div class="fi">
      <div class="fi-head"><b>${esc(k.koc)}</b>
        <span class="tag why" style="background:var(--accent-soft);color:var(--accent)">đạt ${tc.dat}/${tc.tong} tiêu chí</span>
        ${k.roi !== null ? '<span>ROI ' + fmtRatio(k.roi) + '</span>' : ''}</div>
      <div class="fi-body">${fmtInt(k.agg.don)} đơn · ${fmtVND(k.agg.gmv)} ·
        ${fmtInt(k.agg.view)} view · ${k.agg.don1k !== null ? fmtRatio(k.agg.don1k) + ' đơn/1.000 view' : '—'} ·
        ${k.agg.video} video${k.agg.live ? ' + ' + k.agg.live + ' LIVE' : ''}</div>
      <div class="fi-foot">${tc.list.filter(t => t.co).map(t =>
        (t.dat ? '✅ ' : '⬜ ') + esc(t.ten)).join(' · ')}
        ${k.link ? '<a class="lnk" href="' + esc(k.link) + '" target="_blank" rel="noopener">↗ Xem video</a>' : ''}</div>
    </div>`).join('') + '</div>';
  } else {
    html += '<p class="cskh-quiet">Chưa có KOC nào đạt đủ tiêu chí để gửi thêm mẫu trong kỳ này.</p>';
  }
  if (ngung.length){
    html += `<p class="cskh-quiet"><b>Đã đăng nhưng không ra đơn nào:</b>
      ${ngung.map(x => esc(x.k.koc) + ' (' + fmtInt(x.k.agg.view) + ' view)').join(', ')}
      — cân nhắc ngưng gửi mẫu.</p>`;
  }
  html += `<p class="cskh-quiet">Hiện mới chấm được <b>4/7 tiêu chí</b>. Ba tiêu chí còn lại
    (tỷ lệ hoàn hàng, tỷ lệ xem hết, đăng đúng hạn) cần bổ sung dữ liệu từ TikTok rồi mới bật.</p>`;
  return html;
}

/* ------------------------------------ 3. Mới lên bài (2 ngày gần nhất) ---*/
function kocRecentHtml(contents){
  const today = kocToday();
  const from = new Date(today); from.setDate(from.getDate() - (KOC_MOI_DANG_NGAY - 1));
  const key = kocDateKey(from);
  const moi = contents.filter(c => c.ngay_dang >= key);
  if (!moi.length){
    return `<p class="cskh-quiet">Không có video hay buổi LIVE nào trong ${KOC_MOI_DANG_NGAY} ngày gần nhất.</p>`;
  }
  return '<div class="feed">' + moi.map(c => `<div class="fi">
    <div class="fi-head"><span class="tag ${c.loai === 'live' ? 'why' : 'tiktok'}">${c.loai === 'live' ? 'LIVE' : 'Video'}</span>
      <b>${esc(c.koc_username)}</b><span>${esc(fmtDMY(c.ngay_dang) || c.ngay_dang)}</span></div>
    <div class="fi-body">${fmtInt(c.luot_xem || 0)} view · ${fmtInt(c.so_don || 0)} đơn · ${fmtVND(c.gmv || 0)}</div>
    ${c.link ? '<div class="fi-foot"><a class="lnk" href="' + esc(c.link) + '" target="_blank" rel="noopener">↗ Xem</a></div>' : ''}
  </div>`).join('') + '</div>';
}

/* ----------------------------------------- 4. Card gộp số liệu theo kỳ ---*/
function kocPeriodCardHtml(agg, periodLabel){
  const rows = [
    ['Lượt xem', fmtInt(agg.view)],
    ['Số đơn', fmtInt(agg.don)],
    ['GMV (doanh thu)', fmtVND(agg.gmv)],
    ['Số video', fmtInt(agg.video) + (agg.live ? ' + ' + fmtInt(agg.live) + ' LIVE' : '')],
    ['Hoa hồng đã trả', agg.hoaHong ? fmtVND(agg.hoaHong) : '— chưa có dữ liệu'],
    ['Đơn/1.000 view', agg.don1k !== null ? fmtRatio(agg.don1k) : '—'],
    ['Tỷ lệ hoàn', agg.tyLeHoan !== null ? fmtRatio(agg.tyLeHoan * 100) + '%' : '— chưa có dữ liệu'],
  ];
  return `<div class="card"><div class="c-title">Tổng hợp ${esc(periodLabel)}
    <span style="font-weight:400;color:var(--ink-faint)">— gộp theo ngày đăng video; Đơn/1.000 view tính lại từ tổng, không phải trung bình</span></div>
    <table class="dtable"><tbody>${rows.map(([a, b]) =>
      `<tr><td>${esc(a)}</td><td class="num">${esc(b)}</td></tr>`).join('')}</tbody></table></div>`;
}

/* --------------------------------------------------- 5. Bảng tổng quan ---*/
const KOC_TRANG_THAI_LABEL = {
  da_dang: 'Đã lên', da_nhan_chua_dang: 'Chưa lên', dang_giao: 'Đang giao', huy: 'Huỷ',
};

function kocTableHtml(scores, byKoc){
  const duyet = scores.filter(r => r.ket_qua === 'DUYỆT');
  const m = new Map(byKoc.map(k => [k.koc, k]));
  // Một KOC xin mẫu nhiều lần => nhiều dòng Book, nhưng số liệu affiliate gộp
  // theo nhà sáng tạo nên KHÔNG tách được theo từng lần tặng. Nếu in số lên cả
  // mấy dòng thì nhìn như nhân đôi/nhân ba. Chỉ gắn số vào dòng ĐẦU, dòng sau
  // ghi rõ đã tính ở dòng nào.
  const daGan = new Map();
  const body = duyet.map(r => {
    const first = daGan.get(r.koc_username);
    if (first !== undefined){
      return `<tr>
        <td class="num">${fmtInt(r.book_stt || 0)}</td>
        <td><b>${esc(r.koc_username)}</b></td>
        <td class="num">${fmtInt(r.diem || 0)}</td>
        <td>${esc(r.sku_gui || '—')}</td>
        <td style="color:var(--ink-faint);font-weight:700">${esc(KOC_TRANG_THAI_LABEL[r.trang_thai_mau] || '—')}</td>
        <td colspan="6" style="color:var(--ink-faint)">số liệu đã tính ở STT ${fmtInt(first)} (cùng KOC, TikTok không tách theo từng lần tặng mẫu)</td>
        <td>—</td></tr>`;
    }
    daGan.set(r.koc_username, r.book_stt || 0);
    const k = m.get(r.koc_username);
    const roi = (k && k.roi !== null && k.roi !== undefined) ? k.roi : null;
    const xl = kocXepLoai(roi);
    const tt = KOC_TRANG_THAI_LABEL[r.trang_thai_mau] || '—';
    const ttColor = r.trang_thai_mau === 'da_dang' ? 'var(--ok, var(--accent))'
      : r.trang_thai_mau === 'da_nhan_chua_dang' ? 'var(--warn)' : 'var(--ink-faint)';
    return `<tr>
      <td class="num">${fmtInt(r.book_stt || 0)}</td>
      <td><b>${esc(r.koc_username)}</b></td>
      <td class="num">${fmtInt(r.diem || 0)}</td>
      <td>${esc(r.sku_gui || '—')}</td>
      <td style="color:${ttColor};font-weight:700">${esc(tt)}</td>
      <td class="num">${k ? fmtInt(k.agg.view) : '—'}</td>
      <td class="num">${k ? fmtInt(k.agg.don) : '—'}</td>
      <td class="num">${k ? fmtVND(k.agg.gmv) : '—'}</td>
      <td class="num">${k && k.agg.don1k !== null ? fmtRatio(k.agg.don1k) : '—'}</td>
      <td class="num">${r.gia_von_mau ? fmtVND(r.gia_von_mau) : '—'}</td>
      <td class="num">${roi !== null ? fmtRatio(roi) : '—'}</td>
      <td>${xl ? esc(xl) : '—'}</td></tr>`;
  }).join('');
  return `<div class="card"><div class="c-title">Toàn bộ KOC đã duyệt (${fmtInt(duyet.length)})
    <span style="font-weight:400;color:var(--ink-faint)">— lấy từ tab "3.Quản lý Book"</span></div>
    <div style="overflow-x:auto"><table class="dtable">
      <thead><tr><th>STT</th><th>KOC</th><th>Điểm</th><th>Mẫu gửi</th><th>Bài đăng</th>
      <th style="text-align:right">View</th><th style="text-align:right">Đơn</th>
      <th style="text-align:right">GMV</th><th style="text-align:right">Đơn/1.000 view</th>
      <th style="text-align:right">Giá vốn</th><th style="text-align:right">ROI</th><th>Xếp loại</th></tr></thead>
      <tbody>${body}</tbody></table></div></div>`;
}

/* ---------------------------------------------------------------- render --*/
const KOC_PERIOD_LABEL = { week: '7 ngày qua', month: 'tháng này', quarter: '90 ngày qua', all: 'tất cả' };

function kocRender(period){
  const bodyEl = document.getElementById('koc-body');
  if (!bodyEl || !kocRows) return;
  const range = kocRange(period);
  const scores = kocRows.scores;
  const contents = kocRows.contents.filter(c => kocInRange(c.ngay_dang, range));
  const byKoc = kocByCreator(scores, contents);
  const agg = kocAgg(contents);
  bodyEl.innerHTML = `
    ${kocKpiHtml(scores, agg)}
    <div class="zone"><span class="z-num">1</span><span class="z-title">Cần anh xử lý</span><span class="z-note">đã nhận mẫu mà chưa đăng bài — không phụ thuộc kỳ đang chọn</span></div>
    ${kocActionHtml(scores)}
    <div class="zone"><span class="z-num">2</span><span class="z-title">KOC làm việc hiệu quả</span><span class="z-note">nên liên hệ gửi thêm mẫu</span></div>
    ${kocEffectiveHtml(byKoc)}
    <div class="zone"><span class="z-num">3</span><span class="z-title">Mới lên bài (${KOC_MOI_DANG_NGAY} ngày gần nhất)</span><span class="z-note">video hoặc LIVE</span></div>
    ${kocRecentHtml(kocRows.contents)}
    <div class="zone"><span class="z-num">4</span><span class="z-title">Số liệu kỳ</span><span class="z-note">gộp theo ngày đăng</span></div>
    ${kocPeriodCardHtml(agg, KOC_PERIOD_LABEL[period] || '')}
    <div class="zone"><span class="z-num">5</span><span class="z-title">Bảng tổng quan</span><span class="z-note">toàn bộ KOC đã duyệt</span></div>
    ${kocTableHtml(scores, byKoc)}`;
}

function buildKocScreenHTML(){
  return `
  <div class="topbar">
    <div class="period">
      <select id="koc-period">
        <option value="all" selected>Tất cả</option>
        <option value="week">7 ngày qua</option>
        <option value="month">Tháng này</option>
        <option value="quarter">90 ngày qua</option>
      </select>
    </div>
    <span class="up-status" id="koc-updated">Đang tải…</span>
  </div>
  <div id="koc-body"></div>
  <footer>
    <p><b>Nguồn:</b> skill <code>check-koc</code> đọc TikTok Affiliate Center rồi ghi từng lần chấm điểm / từng video thành 1 dòng vào Supabase, 2 ngày/lần. Trang này chỉ đọc lên.</p>
    <p><b>Lưu ý cách tính:</b> "% duyệt" tính trên KOC đã chấm điểm (không gồm yêu cầu bị huỷ/hết hạn chưa chấm). Số liệu kỳ gộp theo <b>ngày đăng video</b>. Đơn/1.000 view và ROI luôn tính lại từ số tổng, không lấy trung bình các tỉ lệ.</p>
  </footer>`;
}

async function refreshKoc(){
  const statusEl = document.getElementById('koc-updated');
  const bodyEl = document.getElementById('koc-body');
  if (!bodyEl) return;
  if (kocRows){ kocRender(document.getElementById('koc-period').value); return; }
  try {
    await kocLoadRows();
    const all = [...kocRows.scores.map(r => r.synced_at), ...kocRows.contents.map(r => r.synced_at)]
      .filter(Boolean).sort();
    const last = all.length ? new Date(all[all.length - 1]) : null;
    statusEl.textContent = last
      ? 'Cập nhật ' + last.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) + ' · tự chạy 2 ngày/lần'
      : 'Chưa có dữ liệu · skill tự chạy 2 ngày/lần trên PC trực';
    kocRender(document.getElementById('koc-period').value);
  } catch (err){
    statusEl.textContent = '';
    bodyEl.innerHTML = '<p class="cskh-quiet">Chưa đọc được dữ liệu: ' + esc(err.message) +
      '. Nếu là lỗi bảng chưa tồn tại thì chạy <code>scripts/koc-tables.sql</code> trên Supabase trước.</p>';
  }
}

function wireKoc(){
  const sel = document.getElementById('koc-period');
  if (sel) sel.addEventListener('change', (e) => kocRender(e.target.value));
}
