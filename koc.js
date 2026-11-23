/* ============================================================================
   Tab "Chấm điểm KOC" — chỉ ĐỌC Supabase, không tự vào TikTok.
     koc_scores        1 dòng = 1 lần chấm điểm (nguồn: Google Sheet)
     koc_contents      1 dòng = 1 video/LIVE cụ thể (dùng cho "mới lên bài")
     koc_channel_stats 1 dòng = 1 KOC × 1 kênh × 1 kỳ (nguồn: API TikTok Affiliate)

   Bố cục chốt với chủ shop 23/11/2026 (thay bản 29-30/10):
   - Đầu trang: hàng card SỐ LIỆU TỪ SÀN (koc_channel_stats), dưới là hàng nhỏ
     các số từ sheet chấm điểm (% duyệt, đã lên bài) — tách nguồn cho rõ.
   - Khu 1: 2 vùng KOC Video / KOC LIVE, chỉ KOC · số video (số live) · GMV kỳ,
     top 5 theo GMV, còn lại ẩn sau nút "Xem thêm".
   - Khu 2: "Cần anh xử lý" (trước là khu 1) — bảng 1 dòng/KOC, có thanh cuộn.
   - Khu 3: Mới lên bài.
   - ĐÃ BỎ: mục "KOC cần đưa vào VIP" và 2 bảng chi tiết 10 cột (ROI, xếp loại).
   - Nút "Cập nhật ngay" ở góc trên: xem kocCapNhatNgay.
   - Nút chọn kỳ 7 ngày / 30 ngày ở góc trên trái (chốt 23/11/2026): PC kéo cả 2
     kỳ mỗi lượt (tools/koc_auto_sync.py, CAC_KY), web chỉ lọc theo ky_ngay. Kỳ
     đang chọn nhớ trong localStorage. Card tổng + khu 1 đổi theo kỳ; khu 2 và 3
     không phụ thuộc kỳ.
   - So với KỲ LIỀN TRƯỚC (chốt 23/11/2026, chủ shop: "chọn 7 ngày thì so 7 ngày
     này với 7 ngày trước đó, 30 ngày tương tự"): PC kéo thêm số kỳ liền trước,
     ghi dòng có dedup_key đuôi "|truoc". Web hiện ▲/▼ % ở 4 card tổng và cột
     "So kỳ trước" (theo GMV) ở 2 bảng top. KOC kỳ trước không có GMV -> "mới".

   ⚠️ KHÔNG cộng/trung bình các tỉ lệ — luôn tính lại từ số tổng (kocTongHop).
============================================================================ */

let kocRows = null;

const KOC_CAC_KY = [7, 30];
let kocKy = 30;
try { const k = +localStorage.getItem('koc-ky'); if (KOC_CAC_KY.includes(k)) kocKy = k; } catch (e) {}
// Dòng koc_channel_stats của kỳ đang chọn
function kocKenhKy(){ return kocRows ? kocRows.channels.filter(c => (c.ky_ngay || 30) === kocKy) : []; }
// Dòng kỳ LIỀN TRƯỚC của kỳ đang chọn ([] nếu PC chưa kéo được -> web ẩn phần so sánh)
function kocKenhKyTruoc(){ return kocRows ? kocRows.truoc.filter(c => (c.ky_ngay || 30) === kocKy) : []; }

// ▲ 12% / ▼ 8% so với kỳ trước. truoc = 0 mà nay > 0 -> "mới".
function kocDoiHtml(nay, truoc){
  nay = nay || 0; truoc = truoc || 0;
  if (!truoc) return nay ? '<span class="koc-doi moi">mới</span>' : '<span class="koc-doi">—</span>';
  const p = (nay - truoc) / truoc * 100;
  const a = Math.abs(p);
  const so = a >= 1000 ? 'x' + fmtInt(Math.round(nay / truoc)) : (a >= 10 ? Math.round(a) : Math.round(a * 10) / 10) + '%';
  if (a < 0.05) return '<span class="koc-doi">= 0%</span>';
  return `<span class="koc-doi ${p > 0 ? 'len' : 'xuong'}">${p > 0 ? '▲' : '▼'} ${so}</span>`;
}

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
  const [scores, contents, channels, samples] = await Promise.all([
    sbFetch('koc_scores?select=*&order=stt.asc&limit=2000'),
    sbFetch('koc_contents?select=*&order=ngay_dang.desc&limit=5000'),
    sbFetch('koc_channel_stats?select=*&order=gmv.desc&limit=5000').catch(() => []),
    // yêu cầu hàng mẫu đang mở (tools/koc_auto_sync.py) — null nếu bảng chưa tạo
    sbFetch('koc_sample_requests?select=*&order=ngay_tao.asc&limit=1000').catch(() => null),
  ]);
  // Chỉ giữ dòng của KỲ MỚI NHẤT (sửa 23/11/2026). Job đồng bộ chỉ ghi đè KOC còn
  // xuất hiện trong kỳ mới, nên KOC đã rớt khỏi kỳ vẫn nằm lại với số của kỳ cũ
  // (vd ky_den 03/11) và chen vào top GMV cạnh số kỳ 17/11 — sai. Lọc ở đây.
  // Từ khi có 2 kỳ (7 và 30 ngày): lấy ky_den mới nhất RIÊNG cho từng ky_ngay.
  const kyMoi = {};
  const laTruoc = c => /\|truoc$/.test(c.dedup_key || '');
  (channels || []).forEach(c => { if (laTruoc(c)) return; const k = c.ky_ngay || 30; if (!kyMoi[k] || c.ky_den > kyMoi[k]) kyMoi[k] = c.ky_den; });
  const kenhMoi = (channels || []).filter(c => !laTruoc(c) && c.ky_den === kyMoi[c.ky_ngay || 30]);
  // Kỳ trước chỉ dùng khi đúng là kỳ LIỀN trước của kỳ đang hiện (ky_den = ky_den hiện tại − ky_ngay),
  // tránh so với số kỳ trước đã cũ khi lượt kéo kỳ trước bị lỗi.
  const ngayTruoc = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - n); return kocDateKey(x); };
  const truoc = (channels || []).filter(c => { const k = c.ky_ngay || 30;
    return laTruoc(c) && kyMoi[k] && c.ky_den === ngayTruoc(kyMoi[k], k); });
  kocRows = { scores: scores || [], contents: contents || [], channels: kenhMoi, truoc, samples };
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

function kocCardSanHtml(channels, truoc){
  const P = truoc && truoc.length ? kocTongHop(truoc) : null;
  const V = kocTongHop(channels.filter(c => c.kenh === 'video'));
  const L = kocTongHop(channels.filter(c => c.kenh === 'live'));
  const T = kocTongHop(channels);
  const cards = [
    ['GMV từ KOC', kocGon(T.gmv, true), V.gmv, L.gmv, true, 'gmv'],
    ['Số đơn', fmtInt(T.don), V.don, L.don, false, 'don'],
    ['Lượt xem', kocGon(T.view, false), V.view, L.view, false, 'view'],
    ['Hoa hồng đã trả', kocGon(T.hoaHong, true), V.hoaHong, L.hoaHong, true, 'hoaHong'],
  ];
  return `<div class="koc-legend"><span><i class="d1"></i>Video</span><span><i class="d2"></i>LIVE</span></div>
    <div class="kpi-row koc-kpi4">${cards.map(([ten, tong, v, l, tien, f]) =>
      `<div class="kpi-tile koc-stat"><div class="k-label">${esc(ten)}</div>
        <div class="koc-big">${esc(tong)}</div>
        ${P ? `<div class="koc-sosanh">${kocDoiHtml(T[f], P[f])} <i>so với ${kocKy} ngày trước đó (${esc(kocGon(P[f], tien))})</i></div>` : ''}
        ${kocThanhHtml(v, l, tien)}</div>`).join('')}</div>`;
}

/* --------------------- hàng nhỏ: số từ SHEET chấm điểm --------------------*/
function kocHangSheetHtml(scores, samples){
  const duyet = scores.filter(r => r.ket_qua === 'DUYỆT');
  const pct = scores.length ? duyet.length / scores.length * 100 : 0;
  const daLen = duyet.filter(r => r.trang_thai_mau === 'da_dang').length;
  const canGiuc = samples
    ? samples.filter(r => r.trang_thai === 'chua_dang').length
    : duyet.filter(r => r.trang_thai_mau === 'da_nhan_chua_dang').length;
  return `<div class="koc-sheetrow">
    <span><b>${fmtRatio(pct)}%</b> duyệt <i>(${duyet.length}/${scores.length} KOC đã chấm)</i></span>
    <span><b>${daLen}/${duyet.length}</b> đã lên bài</span>
    <span class="${canGiuc ? 'canh' : ''}"><b>${canGiuc}</b> cần giục đăng bài</span>
    <span class="ngn">— nhóm số này lấy từ sheet chấm điểm, không phải từ sàn</span>
  </div>`;
}

/* ------------------- 2. Cần xử lý — bảng dày, 1 dòng/KOC, có thanh cuộn ----*/
const KOC_LINK_HANGMAU = 'https://affiliate.tiktok.com/affiliate/sample/sample-request?shop_region=VN&shop_id=7494594978743617682';

// Nguồn chính (17/11): koc_sample_requests do job tự động kéo từ TikTok. Bảng chưa
// có (samples === null) mới lùi về koc_scores (số liệu chép tay 29/10, có thể cũ).
function kocActionSamplesHtml(samples){
  const chuaDang = samples.filter(r => r.trang_thai === 'chua_dang');
  const dangGiao = samples.filter(r => r.trang_thai === 'dang_giao');
  const ngayCho = r => r.ngay_tao ? Math.max(0, Math.floor((Date.now() - new Date(r.ngay_tao)) / 864e5)) : null;
  let html = '';
  if (!chuaDang.length){
    html += '<p class="cskh-quiet">Không có KOC nào đã nhận mẫu mà chưa đăng bài.</p>';
  } else {
    html += `<div class="koc-scroll koc-scroll-ngan"><table class="dtable">
      <thead><tr><th>KOC</th><th>Mẫu nhận</th><th>Tình trạng</th><th></th></tr></thead>
      <tbody>${chuaDang.map(r => `<tr>
        <td><b>${esc(r.koc_username)}</b></td>
        <td>${esc(r.sku_desc || '—')}</td>
        <td style="color:var(--warn);font-weight:700">Đã nhận mẫu · chưa đăng${ngayCho(r) !== null ? ' · xin mẫu ' + ngayCho(r) + ' ngày trước' : ''}</td>
        <td style="text-align:right"><a class="lnk" href="${KOC_LINK_HANGMAU}" target="_blank" rel="noopener">↗ Xử lý</a></td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  if (dangGiao.length){
    html += `<p class="cskh-quiet"><b>${fmtInt(dangGiao.length)} KOC hàng đang trên đường</b>
      (${dangGiao.map(r => esc(r.koc_username)).join(', ')}) — <b>chưa giục</b>, họ chưa nhận được mẫu.</p>`;
  }
  return html;
}

function kocActionHtml(scores, samples){
  if (samples) return kocActionSamplesHtml(samples);
  const chuaDang = scores.filter(r => r.trang_thai_mau === 'da_nhan_chua_dang');
  const dangGiao = scores.filter(r => r.trang_thai_mau === 'dang_giao');
  const chuaRo = scores.filter(r => r.ket_qua === 'DUYỆT' && !r.trang_thai_mau);
  let html = '';
  if (!chuaDang.length){
    html += '<p class="cskh-quiet">Không có KOC nào đã nhận mẫu mà chưa đăng bài.</p>';
  } else {
    html += `<div class="koc-scroll koc-scroll-ngan"><table class="dtable">
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

/* ------------------- 1. Top KOC Video / KOC LIVE --------------------------
   Chốt 23/11/2026 (chủ shop quy hoạch lại, thay 2 bảng 10 cột + mục "KOC cần
   đưa vào VIP"): khu 1 chỉ còn 2 vùng cạnh nhau, mỗi vùng 3 cột — KOC · số
   video (hoặc số buổi LIVE) · GMV kỳ. Mặc định chỉ hiện TOP 5 theo GMV, KOC thứ
   6 trở đi ẩn sau nút "Xem thêm". Bỏ ROI/xếp loại/đơn/view cho gọn. */
const KOC_TOP_KENH = 5;
const kocMoRong = { video: false, live: false };   // vùng nào đang bấm "Xem thêm"

function kocTopKenhHtml(channels, kenh, truoc){
  const coTruoc = truoc && truoc.length > 0;
  const gmvTruoc = {};
  (truoc || []).forEach(c => { if (c.kenh === kenh) gmvTruoc[c.koc_username] = c.gmv || 0; });
  const laLive = kenh === 'live';
  const rows = channels.filter(c => c.kenh === kenh)
    .sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
  const tieuDe = `<div class="sub-label"><i class="${laLive ? 'd2' : 'd1'}"></i> ${laLive ? 'KOC LIVE' : 'KOC Video'} (${fmtInt(rows.length)})</div>`;
  if (!rows.length) return `<div>${tieuDe}<p class="cskh-quiet">Chưa có dữ liệu.</p></div>`;
  const mo = kocMoRong[kenh];
  const hien = mo ? rows : rows.slice(0, KOC_TOP_KENH);
  const an = rows.length - KOC_TOP_KENH;
  const body = hien.map((c, i) => `<tr>
      <td><span class="koc-hang">${i + 1}</span><b>${esc(c.koc_username)}</b></td>
      <td class="num">${fmtInt(c.so_noi_dung || 0)}</td>
      <td class="num">${fmtVND(c.gmv || 0)}</td>
      ${coTruoc ? `<td class="num" title="Kỳ trước: ${esc(fmtVND(gmvTruoc[c.koc_username] || 0))}">${kocDoiHtml(c.gmv, gmvTruoc[c.koc_username])}</td>` : ''}</tr>`).join('');
  const nut = an > 0
    ? `<button type="button" class="btn-xemthem" data-kenh="${kenh}">${mo ? 'Thu gọn ▴' : 'Xem thêm ' + fmtInt(an) + ' KOC ▾'}</button>`
    : '';
  return `<div>${tieuDe}
    <div class="koc-scroll${mo ? ' koc-scroll-mo' : ''}"><table class="dtable">
      <thead><tr><th>KOC</th><th style="text-align:right">${laLive ? 'Số live' : 'Số video'}</th>
        <th style="text-align:right">GMV kỳ</th>${coTruoc ? '<th style="text-align:right">So kỳ trước</th>' : ''}</tr></thead>
      <tbody>${body}</tbody></table></div>
    ${nut}</div>`;
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

/* ---------------------------------------------------------------- render --*/
function kocRender(){
  const bodyEl = document.getElementById('koc-body');
  if (!bodyEl || !kocRows) return;
  const { scores, contents, samples } = kocRows;
  const channels = kocKenhKy();
  const truoc = kocKenhKyTruoc();
  const ky = channels.length
    ? 'GMV kỳ ' + kocKy + ' ngày, đến ' + (fmtDMY(channels[0].ky_den) || channels[0].ky_den)
    : '';
  document.querySelectorAll('.koc-kychon button').forEach(b => b.classList.toggle('on', +b.dataset.ky === kocKy));
  const kyEl = document.getElementById('koc-ky');
  if (kyEl) kyEl.textContent = channels.length ? 'đến ' + (fmtDMY(channels[0].ky_den) || channels[0].ky_den) : 'chưa có số kỳ này';

  bodyEl.innerHTML = `
    ${channels.length ? '' : '<p class="cskh-quiet">Chưa có số liệu kỳ ' + kocKy + ' ngày — bấm "Cập nhật ngay" hoặc chờ lượt tự động kế tiếp.</p>'}
    ${kocCardSanHtml(channels, truoc)}
    ${kocHangSheetHtml(scores, samples)}
    <div class="zone"><span class="z-num">1</span><span class="z-title">Top KOC theo GMV</span><span class="z-note">top ${KOC_TOP_KENH} mỗi kênh${ky ? ' · ' + esc(ky) : ''}</span></div>
    <div class="koc-2col">${kocTopKenhHtml(channels, 'video', truoc)}${kocTopKenhHtml(channels, 'live', truoc)}</div>
    <div class="zone"><span class="z-num">2</span><span class="z-title">Cần anh xử lý</span><span class="z-note">đã nhận mẫu mà chưa đăng bài</span></div>
    ${kocActionHtml(scores, samples)}
    <div class="zone"><span class="z-num">3</span><span class="z-title">Mới lên bài (${KOC_MOI_DANG_NGAY} ngày gần nhất)</span><span class="z-note">video hoặc LIVE</span></div>
    ${kocRecentHtml(contents)}`;
}

function buildKocScreenHTML(){
  return `
  <div class="topbar">
    <div class="period"><span class="koc-kychon">${KOC_CAC_KY.map(k =>
      `<button type="button" data-ky="${k}">${k} ngày</button>`).join('')}</span><span id="koc-ky" class="koc-kyden"></span></div>
    <div class="koc-capnhat">
      <span class="up-status" id="koc-updated">Đang tải…</span>
      <button type="button" class="btn-rs" id="koc-sync-btn">↻ Cập nhật ngay</button>
    </div>
  </div>
  <div id="koc-body"></div>
  <footer>
    <p><b>Nguồn:</b> số liệu kênh lấy từ TikTok Affiliate Center (API của chính trang Phân tích). Phần % duyệt / đã lên bài lấy từ Google Sheet "Bảng Chấm Điểm KOC". Trang này chỉ đọc.</p>
    <p><b>Cập nhật:</b> PC trực tự kéo số từ TikTok 2 ngày/lần lúc 09:00, mỗi lượt kéo cả kỳ 7 ngày và 30 ngày (tính lùi từ lúc kéo), kèm số kỳ liền trước để so sánh (▲/▼ = thay đổi so với 7 hoặc 30 ngày ngay trước đó). Bấm "Cập nhật ngay" để PC kéo luôn (mất khoảng 1–3 phút, PC phải đang bật).</p>
  </footer>`;
}

function kocHienGioCapNhat(){
  const statusEl = document.getElementById('koc-updated');
  if (!statusEl || !kocRows) return;
  const all = [...kocRows.channels, ...(kocRows.samples || []), ...kocRows.scores].map(r => r.synced_at).filter(Boolean).sort();
  const last = all.length ? new Date(all[all.length - 1]) : null;
  statusEl.classList.remove('err');
  statusEl.textContent = last
    ? 'Cập nhật ' + last.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : 'Chưa có dữ liệu';
}

async function refreshKoc(){
  const statusEl = document.getElementById('koc-updated');
  const bodyEl = document.getElementById('koc-body');
  if (!bodyEl) return;
  if (kocRows){ kocRender(); return; }
  try {
    await kocLoadRows();
    if (!kocDangDongBo) kocHienGioCapNhat();
    kocRender();
  } catch (err){
    statusEl.textContent = '';
    bodyEl.innerHTML = '<p class="cskh-quiet">Chưa đọc được dữ liệu: ' + esc(err.message) +
      '. Nếu là lỗi bảng chưa tồn tại thì chạy <code>scripts/koc-tables.sql</code> và <code>scripts/koc-channel-stats.sql</code> trên Supabase trước.</p>';
  }
}

/* ------------------------- nút "Cập nhật ngay" (23/11/2026) ----------------
   Web KHÔNG tự vào TikTok được (cần Chrome đã đăng nhập trên PC trực). Nút chỉ
   ghi 1 dòng 'pending' vào koc_sync_requests; task `Claude - KOC cap nhat ngay`
   trên PC dò bảng này mỗi phút, thấy lệnh thì chạy tools/koc_auto_sync.py rồi
   đánh dấu done/error. Web hỏi lại trạng thái 5 giây/lần, xong thì tải lại số. */
let kocDangDongBo = false;
const KOC_SYNC_CHO_TOI_DA = 8 * 60 * 1000;   // quá 8 phút coi như PC không nhận lệnh

async function kocCapNhatNgay(){
  if (kocDangDongBo) return;
  const btn = document.getElementById('koc-sync-btn');
  const statusEl = document.getElementById('koc-updated');
  const bao = (t, loi) => { statusEl.textContent = t; statusEl.classList.toggle('err', !!loi); };
  kocDangDongBo = true; btn.disabled = true;
  let loi = null;
  try {
    // đã có lệnh đang chờ/đang chạy (bấm từ máy khác) thì theo dõi lệnh đó, không tạo thêm
    const tu = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    let req = (await sbFetch('koc_sync_requests?select=*&status=in.(pending,running)&requested_at=gte.' +
      encodeURIComponent(tu) + '&order=id.desc&limit=1') || [])[0];
    if (!req){
      req = (await sbFetch('koc_sync_requests', { method: 'POST',
        headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ status: 'pending' }) }))[0];
    }
    const batDau = Date.now();
    while (req.status !== 'done'){
      if (req.status === 'error') throw new Error(req.note || 'PC báo lỗi khi kéo số liệu');
      if (Date.now() - batDau > KOC_SYNC_CHO_TOI_DA){
        throw new Error('PC chưa phản hồi sau 8 phút — kiểm tra PC trực có đang bật không');
      }
      bao(req.status === 'running' ? 'PC đang kéo số liệu từ TikTok…' : 'Đã gửi lệnh, chờ PC nhận (tối đa ~1 phút)…');
      await new Promise(r => setTimeout(r, 5000));
      req = (await sbFetch('koc_sync_requests?select=*&id=eq.' + req.id) || [])[0] || req;
    }
  } catch (err){
    loi = err;
  }
  kocDangDongBo = false; btn.disabled = false;
  if (loi){
    const chuaCai = /koc_sync_requests|PGRST205|^404/.test(loi.message);
    bao(chuaCai ? 'Chưa cài nút cập nhật: chạy scripts/koc-sync-requests.sql trên Supabase'
                : 'Lỗi cập nhật: ' + loi.message, true);
    return;
  }
  kocRows = null;
  await refreshKoc();
}

function wireKoc(){
  // Event delegation trên #koc-body (phần tử giữ nguyên qua mỗi lần re-render)
  const body = document.getElementById('koc-body');
  if (body) body.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-xemthem');
    if (btn && btn.dataset.kenh){ kocMoRong[btn.dataset.kenh] = !kocMoRong[btn.dataset.kenh]; kocRender(); }
  });
  document.querySelectorAll('.koc-kychon button').forEach(b => b.addEventListener('click', () => {
    kocKy = +b.dataset.ky;
    try { localStorage.setItem('koc-ky', kocKy); } catch (e) {}
    kocMoRong.video = kocMoRong.live = false;
    kocRender();
  }));
  const sync = document.getElementById('koc-sync-btn');
  if (sync) sync.addEventListener('click', kocCapNhatNgay);
}
