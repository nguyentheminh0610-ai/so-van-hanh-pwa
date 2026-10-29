/* ============================================================================
   Tab "Chấm điểm KOC" — chỉ ĐỌC Supabase, không tự vào TikTok.
     koc_scores        1 dòng = 1 lần chấm điểm (nguồn: Google Sheet)
     koc_contents      1 dòng = 1 video/LIVE cụ thể (dùng cho "mới lên bài")
     koc_channel_stats 1 dòng = 1 KOC × 1 kênh × 1 kỳ (nguồn: API TikTok Affiliate)

   Bố cục chốt với chủ shop 29/10/2026 (thay bản đầu):
   - Đầu trang: hàng card SỐ LIỆU TỪ SÀN (koc_channel_stats), dưới là hàng nhỏ
     các số từ sheet chấm điểm (% duyệt, đã lên bài) — tách nguồn cho rõ.
   - Mục "Cần xử lý": ép thành BẢNG 1 dòng/KOC, chỉ KOC · SKU nhận · tình trạng
     · nút xử lý. Bỏ cột sàn và nhãn TikTok (shop chỉ làm KOC TikTok).
   - Bỏ bảng tổng quan 69 dòng, thay bằng 2 bảng KOC Video và KOC LIVE, xếp
     theo GMV giảm dần.

   ⚠️ KHÔNG cộng/trung bình các tỉ lệ. Đơn/1.000 view và ROI luôn tính lại từ
   số tổng (xem kocAgg / kocTongHop).
============================================================================ */

let kocRows = null;

const KOC_MIN_DON = 10;       // tiêu chí 1
const KOC_MIN_DON_1K = 1.0;   // tiêu chí 2
const KOC_MIN_ROI = 50;       // tiêu chí 3 — cũng là mốc "Hiệu quả"
const KOC_ROI_TAM = 20;       // dưới mốc này là "Kém"
const KOC_MOI_DANG_NGAY = 2;

function kocToday(){
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function kocDateKey(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

async function kocLoadRows(){
  if (kocRows) return kocRows;
  const [scores, contents, channels] = await Promise.all([
    sbFetch('koc_scores?select=*&order=stt.asc&limit=2000'),
    sbFetch('koc_contents?select=*&order=ngay_dang.desc&limit=5000'),
    sbFetch('koc_channel_stats?select=*&order=gmv.desc&limit=2000').catch(() => []),
  ]);
  kocRows = { scores: scores || [], contents: contents || [], channels: channels || [] };
  return kocRows;
}

/* --------- gộp số liệu kênh; tỉ lệ TÍNH LẠI TỪ TỔNG, không trung bình ------*/
function kocTongHop(list){
  const s = { noiDung: 0, gmv: 0, don: 0, view: 0, hoaHong: 0 };
  list.forEach(c => {
    s.noiDung += c.so_noi_dung || 0;
    s.gmv += c.gmv || 0;
    s.don += c.so_don || 0;
    s.view += c.luot_xem || 0;
    s.hoaHong += c.hoa_hong || 0;
  });
  s.don1k = s.view > 0 ? s.don / s.view * 1000 : null;
  return s;
}

// Giá vốn mẫu từ sheet — chỉ KOC từng được tặng mẫu mới có, nên ROI của KOC
// ngoài chương trình sẽ để trống (đúng: họ không tốn mẫu nào của shop).
function kocVonMap(scores){
  const m = new Map();
  scores.forEach(r => {
    if (r.ket_qua !== 'DUYỆT' || !r.gia_von_mau) return;
    m.set(r.koc_username, (m.get(r.koc_username) || 0) + r.gia_von_mau);
  });
  return m;
}

function kocXepLoai(roi){
  if (roi === null || roi === undefined) return null;
  if (roi >= KOC_MIN_ROI) return 'Hiệu quả';
  if (roi >= KOC_ROI_TAM) return 'Tạm';
  return 'Kém';
}

function kocMauXepLoai(xl){
  if (xl === 'Hiệu quả') return 'var(--ok, #2e7d32)';
  if (xl === 'Tạm') return 'var(--proc, #b26a00)';
  if (xl === 'Kém') return 'var(--warn)';
  return 'var(--ink-faint)';
}

/* ----------------------------- hàng card: SỐ LIỆU TỪ SÀN ------------------
   Chốt 29/10: bỏ 6 card chữ dày đặc, còn 4 card — mỗi card 1 con số tổng + 1
   thanh ngang cho thấy ngay phần Video / phần LIVE. Bỏ card "Tỷ trọng kênh"
   (thanh đã nói điều đó) và card "Đơn/1.000 view" (chỉ số này nằm trong 2 bảng
   KOC bên dưới, ở mức tổng không giúp quyết định gì).

   Màu: --p1 (xanh) = Video, --p2 (cam) = LIVE, theo đúng thứ tự cố định của
   bảng màu phân loại sẵn có. Đã chạy bộ kiểm 5 phép (dải sáng, độ bão hoà,
   tách màu cho người mù màu protan/deutan, mắt thường, tương phản nền) — đạt
   ở cả nền sáng lẫn nền tối.                                               */

// Rút gọn số cho khỏi vỡ dòng: tiền và số lớn về "tr", số vừa về "K".
function kocGon(n, laTien){
  n = n || 0;
  if (n >= 1e6) return fmtCompact(n) + (laTien ? '' : '');
  if (!laTien && n >= 10000) return Math.round(n / 1000) + 'K';
  return laTien ? fmtVND(n) : fmtInt(n);
}

function kocThanhHtml(v, l, laTien){
  const t = (v || 0) + (l || 0);
  if (!t) return '<div class="koc-bar koc-bar-empty"></div><div class="koc-split"><span>—</span></div>';
  const pv = Math.round(v / t * 100);
  return `<div class="koc-bar">
      <span class="s1" style="width:${pv}%" title="Video: ${esc(kocGon(v, laTien))} (${pv}%)"></span>
      <span class="s2" style="width:${100 - pv}%" title="LIVE: ${esc(kocGon(l, laTien))} (${100 - pv}%)"></span>
    </div>
    <div class="koc-split">
      <span><i class="d1"></i>${esc(kocGon(v, laTien))}</span>
      <span><i class="d2"></i>${esc(kocGon(l, laTien))}</span>
    </div>`;
}

function kocCardSanHtml(channels){
  const V = kocTongHop(channels.filter(c => c.kenh === 'video'));
  const L = kocTongHop(channels.filter(c => c.kenh === 'live'));
  const T = kocTongHop(channels);
  const cards = [
    ['GMV từ KOC', kocGon(T.gmv, true), V.gmv, L.gmv, true],
    ['Số đơn', fmtInt(T.don), V.don, L.don, false],
    ['Lượt xem', kocGon(T.view, false), V.view, L.view, false],
    ['Hoa hồng đã trả', kocGon(T.hoaHong, true), V.hoaHong, L.hoaHong, true],
  ];
  return `<div class="koc-legend"><span><i class="d1"></i>Video</span><span><i class="d2"></i>LIVE</span></div>
    <div class="kpi-row koc-kpi4">${cards.map(([ten, tong, v, l, tien]) =>
      `<div class="kpi-tile koc-stat"><div class="k-label">${esc(ten)}</div>
        <div class="koc-big">${esc(tong)}</div>
        ${kocThanhHtml(v, l, tien)}</div>`).join('')}</div>`;
}

/* --------------------- hàng nhỏ: số từ SHEET chấm điểm --------------------*/
function kocHangSheetHtml(scores){
  const duyet = scores.filter(r => r.ket_qua === 'DUYỆT');
  const pct = scores.length ? duyet.length / scores.length * 100 : 0;
  const daLen = duyet.filter(r => r.trang_thai_mau === 'da_dang').length;
  const canGiuc = duyet.filter(r => r.trang_thai_mau === 'da_nhan_chua_dang').length;
  return `<div class="koc-sheetrow">
    <span><b>${fmtRatio(pct)}%</b> duyệt <i>(${duyet.length}/${scores.length} KOC đã chấm)</i></span>
    <span><b>${daLen}/${duyet.length}</b> đã lên bài</span>
    <span class="${canGiuc ? 'canh' : ''}"><b>${canGiuc}</b> cần giục đăng bài</span>
    <span class="ngn">— nhóm số này lấy từ sheet chấm điểm, không phải từ sàn</span>
  </div>`;
}

/* ------------------- 1. Cần xử lý — bảng dày, 1 dòng/KOC ------------------*/
const KOC_LINK_HANGMAU = 'https://affiliate.tiktok.com/affiliate/sample/sample-request?shop_region=VN&shop_id=7494594978743617682';

function kocActionHtml(scores){
  const chuaDang = scores.filter(r => r.trang_thai_mau === 'da_nhan_chua_dang');
  const dangGiao = scores.filter(r => r.trang_thai_mau === 'dang_giao');
  const chuaRo = scores.filter(r => r.ket_qua === 'DUYỆT' && !r.trang_thai_mau);
  let html = '';
  if (!chuaDang.length){
    html += '<p class="cskh-quiet">Không có KOC nào đã nhận mẫu mà chưa đăng bài.</p>';
  } else {
    html += `<div class="card"><table class="dtable">
      <thead><tr><th>KOC</th><th>SKU nhận</th><th>Tình trạng</th><th></th></tr></thead>
      <tbody>${chuaDang.map(r => `<tr>
        <td><b>${esc(r.koc_username)}</b></td>
        <td>${esc(r.sku_gui || '—')}</td>
        <td style="color:var(--warn);font-weight:700">Đã nhận mẫu · chưa đăng</td>
        <td style="text-align:right"><a class="lnk" href="${KOC_LINK_HANGMAU}" target="_blank" rel="noopener">↗ Xử lý</a></td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  if (dangGiao.length){
    html += `<p class="cskh-quiet"><b>${fmtInt(dangGiao.length)} KOC hàng đang trên đường</b>
      (${dangGiao.map(r => esc(r.koc_username)).join(', ')}) — <b>chưa giục</b>, họ chưa nhận được mẫu.</p>`;
  }
  if (chuaRo.length){
    html += `<p class="cskh-quiet">${fmtInt(chuaRo.length)} KOC đã duyệt nhưng không thấy ở tab trạng thái nào
      (có thể còn "Chờ xem xét" hoặc đã huỷ): ${chuaRo.map(r => esc(r.koc_username)).join(', ')}.</p>`;
  }
  return html;
}

/* --------------------------- 2. KOC làm việc hiệu quả --------------------*/
function kocTieuChi(k){
  const t = [
    { ten: 'Số đơn ≥ ' + KOC_MIN_DON, dat: k.don >= KOC_MIN_DON },
    { ten: 'Đơn/1.000 view ≥ ' + fmtRatio(KOC_MIN_DON_1K), dat: k.don1k !== null && k.don1k >= KOC_MIN_DON_1K },
    { ten: '≥ 2 nội dung', dat: k.noiDung >= 2 },
  ];
  if (k.roi !== null) t.push({ ten: 'ROI ≥ ' + KOC_MIN_ROI, dat: k.roi >= KOC_MIN_ROI });
  return { list: t, dat: t.filter(x => x.dat).length, tong: t.length };
}

function kocEffectiveHtml(byKoc){
  const scored = byKoc.filter(k => k.don > 0).map(k => ({ k, tc: kocTieuChi(k) }));
  const nen = scored.filter(x => x.tc.dat === x.tc.tong).slice(0, 12);
  const ngung = byKoc.filter(k => k.noiDung > 0 && k.don === 0);
  let html = '';
  if (nen.length){
    html += '<div class="feed">' + nen.map(({ k, tc }) => `<div class="fi">
      <div class="fi-head"><b>${esc(k.koc)}</b>
        <span class="tag why" style="background:var(--accent-soft);color:var(--accent)">đạt ${tc.dat}/${tc.tong} tiêu chí</span>
        ${k.roi !== null ? '<span>ROI ' + fmtRatio(k.roi) + '</span>' : '<span>chưa từng nhận mẫu</span>'}</div>
      <div class="fi-body">${fmtVND(k.gmv)} · ${fmtInt(k.don)} đơn · ${fmtInt(k.view)} view ·
        ${k.don1k !== null ? fmtRatio(k.don1k) + ' đơn/1.000 view' : '—'} ·
        ${fmtInt(k.video)} video${k.live ? ' + ' + fmtInt(k.live) + ' LIVE' : ''}</div>
      <div class="fi-foot">${tc.list.map(x => (x.dat ? '✅ ' : '⬜ ') + esc(x.ten)).join(' · ')}</div>
    </div>`).join('') + '</div>';
  } else {
    html += '<p class="cskh-quiet">Chưa có KOC nào đạt đủ tiêu chí.</p>';
  }
  if (ngung.length){
    html += `<p class="cskh-quiet"><b>Có đăng nhưng không ra đơn nào:</b>
      ${ngung.slice(0, 15).map(k => esc(k.koc)).join(', ')}${ngung.length > 15 ? ' và ' + (ngung.length - 15) + ' người nữa' : ''}
      — cân nhắc ngưng gửi mẫu.</p>`;
  }
  return html;
}

/* ---------------------- 3. Mới lên bài (2 ngày gần nhất) -----------------*/
function kocRecentHtml(contents){
  const from = new Date(kocToday()); from.setDate(from.getDate() - (KOC_MOI_DANG_NGAY - 1));
  const moi = contents.filter(c => c.ngay_dang >= kocDateKey(from));
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

/* ------------------- 4 & 5. Bảng KOC Video / KOC LIVE --------------------*/
function kocBangKenhHtml(channels, kenh, von, tieuDe, ghiChu){
  const rows = channels.filter(c => c.kenh === kenh)
    .sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
  if (!rows.length){
    return `<div class="card"><div class="c-title">${esc(tieuDe)}</div>
      <p class="cskh-quiet">Chưa có dữ liệu.</p></div>`;
  }
  const tong = kocTongHop(rows);
  const body = rows.map(c => {
    const v = von.get(c.koc_username) || null;
    const roi = v ? (c.gmv || 0) / v : null;
    const xl = kocXepLoai(roi);
    const d1k = c.luot_xem ? (c.so_don || 0) / c.luot_xem * 1000 : null;
    return `<tr>
      <td><b>${esc(c.koc_username)}</b></td>
      <td class="num">${fmtInt(c.so_noi_dung || 0)}</td>
      <td class="num">${fmtVND(c.gmv || 0)}</td>
      <td class="num">${fmtInt(c.so_don || 0)}</td>
      <td class="num">${fmtInt(c.luot_xem || 0)}</td>
      <td class="num">${d1k !== null ? fmtRatio(d1k) : '—'}</td>
      <td class="num">${fmtVND(c.hoa_hong || 0)}</td>
      <td class="num">${v ? fmtVND(v) : '—'}</td>
      <td class="num">${roi !== null ? fmtRatio(roi) : '—'}</td>
      <td style="color:${kocMauXepLoai(xl)};font-weight:700">${xl ? esc(xl) : '—'}</td></tr>`;
  }).join('');
  return `<div class="card"><div class="c-title">${esc(tieuDe)} (${fmtInt(rows.length)} KOC)
    <span style="font-weight:400;color:var(--ink-faint)">— ${esc(ghiChu)}</span></div>
    <div style="overflow-x:auto"><table class="dtable">
    <thead><tr><th>KOC</th><th style="text-align:right">${kenh === 'live' ? 'Buổi' : 'Video'}</th>
      <th style="text-align:right">GMV</th><th style="text-align:right">Đơn</th>
      <th style="text-align:right">${kenh === 'live' ? 'Người xem' : 'View'}</th>
      <th style="text-align:right">Đơn/1.000</th><th style="text-align:right">Hoa hồng</th>
      <th style="text-align:right">Giá vốn mẫu</th><th style="text-align:right">ROI</th><th>Xếp loại</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr style="border-top:2px solid var(--line-strong);font-weight:700">
      <td>Tổng</td><td class="num">${fmtInt(tong.noiDung)}</td><td class="num">${fmtVND(tong.gmv)}</td>
      <td class="num">${fmtInt(tong.don)}</td><td class="num">${fmtInt(tong.view)}</td>
      <td class="num">${tong.don1k !== null ? fmtRatio(tong.don1k) : '—'}</td>
      <td class="num">${fmtVND(tong.hoaHong)}</td><td colspan="3"></td></tr></tfoot>
    </table></div></div>`;
}

/* ---------------------------------------------------------------- render --*/
function kocRender(){
  const bodyEl = document.getElementById('koc-body');
  if (!bodyEl || !kocRows) return;
  const { scores, contents, channels } = kocRows;
  const von = kocVonMap(scores);

  // gộp cả 2 kênh theo từng KOC cho mục "hiệu quả"
  const map = new Map();
  channels.forEach(c => {
    const k = map.get(c.koc_username) || { koc: c.koc_username, noiDung: 0, gmv: 0, don: 0, view: 0, video: 0, live: 0 };
    k.noiDung += c.so_noi_dung || 0; k.gmv += c.gmv || 0; k.don += c.so_don || 0; k.view += c.luot_xem || 0;
    if (c.kenh === 'live') k.live += c.so_noi_dung || 0; else k.video += c.so_noi_dung || 0;
    map.set(c.koc_username, k);
  });
  const byKoc = [...map.values()].map(k => {
    k.don1k = k.view > 0 ? k.don / k.view * 1000 : null;
    const v = von.get(k.koc) || null;
    k.roi = v ? k.gmv / v : null;
    return k;
  }).sort((a, b) => b.gmv - a.gmv);

  const ky = channels.length ? (channels[0].ky_ngay + ' ngày, đến ' + (fmtDMY(channels[0].ky_den) || channels[0].ky_den)) : '';

  bodyEl.innerHTML = `
    ${kocCardSanHtml(channels)}
    ${kocHangSheetHtml(scores)}
    <div class="zone"><span class="z-num">1</span><span class="z-title">Cần anh xử lý</span><span class="z-note">đã nhận mẫu mà chưa đăng bài</span></div>
    ${kocActionHtml(scores)}
    <div class="zone"><span class="z-num">2</span><span class="z-title">KOC làm việc hiệu quả</span><span class="z-note">nên liên hệ gửi thêm mẫu</span></div>
    ${kocEffectiveHtml(byKoc)}
    <div class="zone"><span class="z-num">3</span><span class="z-title">Mới lên bài (${KOC_MOI_DANG_NGAY} ngày gần nhất)</span><span class="z-note">video hoặc LIVE</span></div>
    ${kocRecentHtml(contents)}
    <div class="zone"><span class="z-num">4</span><span class="z-title">KOC gắn link trên VIDEO</span><span class="z-note">xếp theo GMV</span></div>
    ${kocBangKenhHtml(channels, 'video', von, 'KOC gắn link trên video', 'kỳ ' + ky)}
    <div class="zone"><span class="z-num">5</span><span class="z-title">KOC gắn link trên LIVE</span><span class="z-note">xếp theo GMV</span></div>
    ${kocBangKenhHtml(channels, 'live', von, 'KOC gắn link trên LIVE', 'kỳ ' + ky)}`;
}

function buildKocScreenHTML(){
  return `
  <div class="topbar">
    <div class="period"><span id="koc-ky" class="koc-ky">Kỳ 30 ngày</span></div>
    <span class="up-status" id="koc-updated">Đang tải…</span>
  </div>
  <div id="koc-body"></div>
  <footer>
    <p><b>Nguồn:</b> số liệu kênh lấy từ TikTok Affiliate Center (API của chính trang Phân tích). Phần % duyệt / đã lên bài / giá vốn mẫu lấy từ Google Sheet "Bảng Chấm Điểm KOC". Trang này chỉ đọc.</p>
    <p><b>Cách tính:</b> Đơn/1.000 view và ROI luôn tính lại từ số tổng, không lấy trung bình các tỉ lệ. ROI = GMV ÷ giá vốn mẫu, nên KOC chưa từng nhận mẫu sẽ không có ROI. Xếp loại: ROI ≥ 50 Hiệu quả · 20–50 Tạm · &lt; 20 Kém.</p>
  </footer>`;
}

async function refreshKoc(){
  const statusEl = document.getElementById('koc-updated');
  const bodyEl = document.getElementById('koc-body');
  if (!bodyEl) return;
  if (kocRows){ kocRender(); return; }
  try {
    await kocLoadRows();
    const all = [...kocRows.channels, ...kocRows.scores].map(r => r.synced_at).filter(Boolean).sort();
    const last = all.length ? new Date(all[all.length - 1]) : null;
    statusEl.textContent = last
      ? 'Cập nhật ' + last.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
      : 'Chưa có dữ liệu';
    const c = kocRows.channels[0];
    const kyEl = document.getElementById('koc-ky');
    if (kyEl && c) kyEl.textContent = 'Kỳ ' + c.ky_ngay + ' ngày · đến ' + (fmtDMY(c.ky_den) || c.ky_den);
    kocRender();
  } catch (err){
    statusEl.textContent = '';
    bodyEl.innerHTML = '<p class="cskh-quiet">Chưa đọc được dữ liệu: ' + esc(err.message) +
      '. Nếu là lỗi bảng chưa tồn tại thì chạy <code>scripts/koc-tables.sql</code> và <code>scripts/koc-channel-stats.sql</code> trên Supabase trước.</p>';
  }
}

function wireKoc(){ /* không còn bộ chọn kỳ — dữ liệu hiện lưu theo 1 kỳ cố định */ }
