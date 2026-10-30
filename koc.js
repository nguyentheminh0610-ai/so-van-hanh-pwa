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

const KOC_MIN_ROI = 50;       // mốc "Hiệu quả" ở bảng 2 kênh (ROI)
// Ngưỡng VIP (chốt 30/10): vào VIP nếu GMV >= 1,2tr/kỳ-7-ngày HOẶC top 40% số
// nội dung trong kênh. Ngưỡng tự co giãn theo độ dài kỳ dữ liệu thực tế.
const NGUONG_VIP_7NGAY = 1200000;   // đ / kỳ 7 ngày
const NGUONG_HH_THANG = 30000000;   // đ / tháng — mốc riêng để được hoa hồng mục tiêu 10%
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

/* --------------------------- 2. KOC cần đưa vào VIP ----------------------
   Xét VIP theo TỔNG cả 2 kênh (chốt 30/10), nhưng HIỂN THỊ chia 2 bảng theo
   kênh KOC bán mạnh hơn (Video / LIVE) cho dễ nhìn. Bỏ list "việc cần làm"
   dài dòng (chủ shop: rối) — việc giờ ngầm theo bảng: nhóm LIVE = cấp mã giảm
   giá + FS LIVE; chữ xanh >30tr = mời tăng hoa hồng 10%; tất cả = ưu tiên mẫu.
   Mỗi KOC chỉ hiện 1 lần; ai làm cả 2 kênh thì có chip "+ kênh kia". */
function kocVipGop(channels, nguongVip, gmvThangMap){
  const m = new Map();
  channels.forEach(c => {
    const k = m.get(c.koc_username) ||
      { koc: c.koc_username, tGmv: 0, tDon: 0, tnd: 0,
        v: { n: 0, gmv: 0, don: 0 }, l: { n: 0, gmv: 0, don: 0 } };
    k.tGmv += c.gmv || 0; k.tDon += c.so_don || 0; k.tnd += c.so_noi_dung || 0;
    const ch = c.kenh === 'live' ? k.l : k.v;
    ch.n += c.so_noi_dung || 0; ch.gmv += c.gmv || 0; ch.don += c.so_don || 0;
    m.set(c.koc_username, k);
  });
  const all = [...m.values()];
  const coDon = all.filter(k => k.tnd > 0 && k.tDon > 0).sort((a, b) => b.tnd - a.tnd);
  const top40 = new Set(coDon.slice(0, Math.ceil(coDon.length * 0.4)).map(k => k.koc));
  all.forEach(k => {
    k.vip = k.tDon > 0 && (k.tGmv >= nguongVip || top40.has(k.koc));
    k.hhCao = (gmvThangMap.get(k.koc) || 0) >= NGUONG_HH_THANG;
  });
  return all.filter(k => k.vip);
}

// Trạng thái "đã thêm VIP" — lưu cục bộ trên máy đang xem (localStorage).
function kocVipAdded(){
  try { return new Set(JSON.parse(localStorage.getItem('koc_vip_added') || '[]')); }
  catch (e){ return new Set(); }
}
function kocToggleAdded(koc){
  const s = kocVipAdded();
  if (s.has(koc)) s.delete(koc); else s.add(koc);
  try { localStorage.setItem('koc_vip_added', JSON.stringify([...s])); } catch (e){}
  kocRender();
}

// 1 bảng ứng viên (Video hoặc LIVE), có thanh cuộn + nút "Đã thêm"
function kocCandBangHtml(ds, kenh, added){
  const donVi = kenh === 'live' ? 'buổi' : 'video';
  const body = ds.map(k => {
    const ch = kenh === 'live' ? k.l : k.v;
    const other = kenh === 'live' ? k.v : k.l;
    const isAdded = added.has(k.koc);
    const badge = k.hhCao ? ' <span class="tag" style="background:var(--good-soft);color:var(--good)">&gt;30tr</span>' : '';
    const chip = other.n > 0 ? ` <span class="tag" style="background:var(--surface-2);color:var(--ink-soft)">+ ${kenh === 'live' ? 'Video' : 'LIVE'}</span>` : '';
    return `<tr class="${isAdded ? 'koc-done' : ''}">
      <td><b>${esc(k.koc)}</b>${badge}${chip}</td>
      <td class="num">${fmtVND(ch.gmv)}</td>
      <td style="text-align:right"><button type="button" class="btn-them ${isAdded ? 'on' : ''}" data-koc="${esc(k.koc)}">${isAdded ? '✓ Đã thêm' : '＋ Thêm'}</button></td></tr>`;
  }).join('');
  return `<div class="koc-scroll"><table class="dtable">
    <thead><tr><th>KOC</th><th style="text-align:right">GMV ${donVi}</th><th></th></tr></thead>
    <tbody>${body || '<tr><td colspan="3" class="cskh-quiet">—</td></tr>'}</tbody></table></div>`;
}

// Bảng tóm tắt KOC VIP đã thêm — chỉ Tên · Kênh · note >30tr (KHÔNG có GMV)
function kocVipSummaryHtml(vips, added){
  const ds = vips.filter(k => added.has(k.koc));
  if (!ds.length){
    return '<p class="cskh-quiet">Chưa đánh dấu KOC nào. Sau khi thiết lập VIP cho 1 KOC trên TikTok, bấm <b>＋ Thêm</b> ở bảng trên để ghi vào đây.</p>';
  }
  const body = ds.map(k => {
    const kenh = (k.v.n > 0 && k.l.n > 0) ? 'Cả Video + LIVE' : k.v.n > 0 ? 'Video' : 'LIVE';
    const note = k.hhCao ? '<span class="tag" style="background:var(--good-soft);color:var(--good)">&gt;30tr — hoa hồng 10%</span>' : '—';
    return `<tr><td><b>${esc(k.koc)}</b></td><td>${kenh}</td><td>${note}</td></tr>`;
  }).join('');
  return `<div class="card"><div style="overflow-x:auto"><table class="dtable">
    <thead><tr><th>KOC</th><th>Kênh</th><th>Ghi chú</th></tr></thead>
    <tbody>${body}</tbody></table></div></div>`;
}

function kocVipSplitHtml(channels, nguongVip, gmvThangMap){
  const vips = kocVipGop(channels, nguongVip, gmvThangMap);
  if (!vips.length) return '<p class="cskh-quiet">Chưa có KOC nào đạt ngưỡng VIP trong kỳ.</p>';
  const added = kocVipAdded();
  // xếp mỗi người vào kênh bán MẠNH hơn (GMV cao hơn)
  const videoList = vips.filter(k => k.v.gmv >= k.l.gmv).sort((a, b) => b.v.gmv - a.v.gmv);
  const liveList = vips.filter(k => k.v.gmv < k.l.gmv).sort((a, b) => b.l.gmv - a.l.gmv);
  const note = `<p class="cskh-quiet" style="margin:0 0 12px">Việc cần làm: <b>tất cả</b> → ưu tiên gửi mẫu mới · <b style="color:var(--good)">&gt;30tr</b> → mời tăng hoa hồng 10% · nhóm <b>LIVE</b> → cấp mã giảm giá + thêm Flash Sale LIVE.</p>`;
  return note +
    `<div class="koc-vip-grid">
      <div><div class="sub-label">🎬 Bán mạnh qua Video (${videoList.length})</div>${kocCandBangHtml(videoList, 'video', added)}</div>
      <div><div class="sub-label">🔴 Bán mạnh qua LIVE (${liveList.length})</div>${kocCandBangHtml(liveList, 'live', added)}</div>
    </div>
    <div class="sub-label">⭐ KOC VIP đã thêm (${vips.filter(k => added.has(k.koc)).length})</div>
    ${kocVipSummaryHtml(vips, added)}`;
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

  const kyNgay = channels.length ? (channels[0].ky_ngay || 30) : 30;
  const ky = channels.length ? (kyNgay + ' ngày, đến ' + (fmtDMY(channels[0].ky_den) || channels[0].ky_den)) : '';

  // ngưỡng VIP co giãn theo độ dài kỳ; GMV tháng = gộp 2 kênh rồi quy về 30 ngày
  const nguongVip = NGUONG_VIP_7NGAY * kyNgay / 7;
  const gmvThangMap = new Map();
  channels.forEach(c => gmvThangMap.set(c.koc_username, (gmvThangMap.get(c.koc_username) || 0) + (c.gmv || 0)));
  gmvThangMap.forEach((v, k) => gmvThangMap.set(k, v * 30 / kyNgay));

  bodyEl.innerHTML = `
    ${kocCardSanHtml(channels)}
    ${kocHangSheetHtml(scores)}
    <div class="zone"><span class="z-num">1</span><span class="z-title">Cần anh xử lý</span><span class="z-note">đã nhận mẫu mà chưa đăng bài</span></div>
    ${kocActionHtml(scores)}
    <div class="zone"><span class="z-num">2</span><span class="z-title">KOC cần đưa vào VIP</span><span class="z-note">xét theo tổng cả 2 kênh · chia theo kênh bán mạnh hơn</span></div>
    ${kocVipSplitHtml(channels, nguongVip, gmvThangMap)}
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

function wireKoc(){
  // Event delegation trên #koc-body (phần tử này giữ nguyên qua mỗi lần re-render,
  // chỉ innerHTML đổi) nên nút "Đã thêm" luôn bắt được click.
  const body = document.getElementById('koc-body');
  if (body) body.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-them');
    if (btn && btn.dataset.koc) kocToggleAdded(btn.dataset.koc);
  });
}
