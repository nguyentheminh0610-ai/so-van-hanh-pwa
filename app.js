/* ============================================================
   UI wiring: file uploads → computeAll() → render() into #results,
   plus history save/view via the Artifact "remember what people do
   with it" capability (claude.use('artifact')).
   ============================================================ */

// ---------- formatting helpers (Vietnamese locale, matches design language) ----------
function fmtInt(n){ return Math.round(n).toLocaleString('vi-VN'); }
function fmtVND(n){ return fmtInt(n) + ' đ'; }
function fmtCompact(n){
  const tr = n / 1e6;
  return tr.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'tr';
}
function fmtPct(x, decimals){
  decimals = decimals === undefined ? 1 : decimals;
  return (x * 100).toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '%';
}
function fmtRatio(x){ return x.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s){ return (s === null || s === undefined) ? '' : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDateVN(d){
  if (!d) return '?';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return '?';
  return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0') + '/' + dt.getFullYear();
}
function fmtDMY(dateKey){
  // dateKey: "YYYY-MM-DD" -> "DD/MM/YYYY"
  return dateKey.slice(8,10) + '/' + dateKey.slice(5,7) + '/' + dateKey.slice(0,4);
}

// ---------- doanh thu theo ngày — line chart (Shopee/TikTok), khác với các
// chỉ số khác (vd. hoàn về kho) vốn chỉ cần xem theo tháng/kỳ đã lưu ----------
const DRC = { w: 700, h: 200, padTop: 10, padRight: 10, padBottom: 24, padLeft: 54 };

function drcScale(days){
  const plotW = DRC.w - DRC.padLeft - DRC.padRight;
  const plotH = DRC.h - DRC.padTop - DRC.padBottom;
  const maxVal = Math.max(1, ...days.flatMap(d => [d.shopee, d.tiktok]));
  const x = (i) => days.length > 1 ? DRC.padLeft + (i / (days.length - 1)) * plotW : DRC.padLeft + plotW / 2;
  const y = (v) => DRC.padTop + plotH - (v / maxVal) * plotH;
  return { plotW, plotH, maxVal, x, y };
}

function buildDailyRevenueChartHtml(res){
  const days = res.dailyRevenue || [];
  if (days.length < 2){
    return `<div class="chart-card" style="margin-bottom:14px;"><div class="ct-title">Doanh thu theo ngày</div><p style="font-size:12px;color:var(--ink-faint);">Cần ít nhất 2 ngày có dữ liệu trong kỳ để vẽ biểu đồ xu hướng.</p></div>`;
  }
  const { plotW, plotH, maxVal, x, y } = drcScale(days);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: maxVal * f, yy: DRC.padTop + plotH - f * plotH }));
  const gridlines = ticks.map(t => `<line x1="${DRC.padLeft}" y1="${t.yy.toFixed(1)}" x2="${DRC.w - DRC.padRight}" y2="${t.yy.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`).join('');
  const yTickLabels = ticks.map(t => `<text x="${DRC.padLeft - 8}" y="${(t.yy + 3).toFixed(1)}" text-anchor="end" font-size="9.5" fill="var(--ink-faint)">${fmtCompact(t.v)}</text>`).join('');
  const shopeePts = days.map((d, i) => `${x(i).toFixed(1)},${y(d.shopee).toFixed(1)}`).join(' ');
  const tiktokPts = days.map((d, i) => `${x(i).toFixed(1)},${y(d.tiktok).toFixed(1)}`).join(' ');
  const lastI = days.length - 1;
  const labelStep = Math.max(1, Math.round(days.length / 6));
  const xLabels = days.map((d, i) => (i === 0 || i === lastI || i % labelStep === 0)
    ? `<text x="${x(i).toFixed(1)}" y="${DRC.h - 6}" text-anchor="middle" font-size="9.5" fill="var(--ink-faint)">${esc(d.date.slice(8,10) + '/' + d.date.slice(5,7))}</text>`
    : '').join('');
  return `
  <div class="chart-card" style="margin-bottom:14px;">
    <div class="ct-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
      <span>Doanh thu theo ngày <span class="ct-note">(theo ngày đặt hàng)</span></span>
      <span class="legend" style="margin:0;"><span><i class="i-shopee"></i>Shopee</span><span><i class="i-tiktok"></i>TikTok</span></span>
    </div>
    <div class="drc-wrap" id="drc-wrap">
      <svg viewBox="0 0 ${DRC.w} ${DRC.h}" style="width:100%; height:auto; display:block; overflow:visible;">
        ${gridlines}
        ${yTickLabels}
        <polyline points="${shopeePts}" fill="none" stroke="var(--shopee)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <polyline points="${tiktokPts}" fill="none" stroke="var(--tiktok)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${x(lastI).toFixed(1)}" cy="${y(days[lastI].shopee).toFixed(1)}" r="4" fill="var(--shopee)" stroke="var(--surface)" stroke-width="2"/>
        <circle cx="${x(lastI).toFixed(1)}" cy="${y(days[lastI].tiktok).toFixed(1)}" r="4" fill="var(--tiktok)" stroke="var(--surface)" stroke-width="2"/>
        ${xLabels}
        <line id="drc-crosshair" x1="0" y1="${DRC.padTop}" x2="0" y2="${DRC.padTop + plotH}" stroke="var(--ink-faint)" stroke-width="1" style="display:none;"/>
      </svg>
      <div class="drc-tooltip" id="drc-tooltip" style="display:none;"></div>
    </div>
    <div style="margin-top:8px;"><span class="up-manual-link" id="drc-toggle-btn">Xem dạng bảng</span></div>
    <div class="drc-table" id="drc-table" style="display:none; margin-top:8px; max-height:260px; overflow:auto;">
      <table class="dtable"><thead><tr><th>Ngày</th><th style="text-align:right">Shopee</th><th style="text-align:right">TikTok</th><th style="text-align:right">Tổng</th></tr></thead><tbody>
        ${days.slice().reverse().map(d => `<tr><td>${esc(fmtDMY(d.date))}</td><td class="num">${fmtVND(d.shopee)}</td><td class="num">${fmtVND(d.tiktok)}</td><td class="num">${fmtVND(d.shopee + d.tiktok)}</td></tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}

function wireDailyRevenueChart(container, res){
  const days = res && res.dailyRevenue;
  const toggleBtn = container.querySelector('#drc-toggle-btn');
  const tableEl = container.querySelector('#drc-table');
  if (toggleBtn && tableEl){
    toggleBtn.addEventListener('click', () => {
      const show = tableEl.style.display === 'none';
      tableEl.style.display = show ? 'block' : 'none';
      toggleBtn.textContent = show ? 'Ẩn bảng' : 'Xem dạng bảng';
    });
  }
  const wrap = container.querySelector('#drc-wrap');
  if (!wrap || !days || days.length < 2) return;
  const svg = wrap.querySelector('svg');
  const tooltip = wrap.querySelector('#drc-tooltip');
  const crosshair = wrap.querySelector('#drc-crosshair');
  const { x } = drcScale(days);

  function showAt(idx){
    const d = days[idx];
    crosshair.setAttribute('x1', x(idx).toFixed(1));
    crosshair.setAttribute('x2', x(idx).toFixed(1));
    crosshair.style.display = '';
    tooltip.style.display = 'block';
    tooltip.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'drc-tt-date';
    title.textContent = fmtDMY(d.date);
    tooltip.appendChild(title);
    [['Shopee', d.shopee, 'var(--shopee)'], ['TikTok', d.tiktok, 'var(--tiktok)']].forEach(([name, val, color]) => {
      const row = document.createElement('div');
      row.className = 'drc-tt-row';
      const key = document.createElement('span');
      key.className = 'drc-tt-key';
      key.style.background = color;
      const label = document.createElement('span');
      label.className = 'drc-tt-label';
      label.textContent = name;
      const value = document.createElement('span');
      value.className = 'drc-tt-value';
      value.textContent = fmtVND(val);
      row.appendChild(key); row.appendChild(label); row.appendChild(value);
      tooltip.appendChild(row);
    });
    const leftPct = (x(idx) / DRC.w) * 100;
    tooltip.style.left = leftPct + '%';
    tooltip.style.transform = leftPct > 65 ? 'translate(-100%, -8px)' : 'translate(8px, -8px)';
  }

  function nearestIdx(clientX){
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return 0;
    const svgX = ((clientX - rect.left) / rect.width) * DRC.w;
    let idx = 0, best = Infinity;
    for (let i = 0; i < days.length; i++){
      const dx = Math.abs(x(i) - svgX);
      if (dx < best){ best = dx; idx = i; }
    }
    return idx;
  }

  wrap.addEventListener('pointermove', (e) => showAt(nearestIdx(e.clientX)));
  wrap.addEventListener('pointerleave', () => {
    tooltip.style.display = 'none';
    crosshair.style.display = 'none';
  });
}

// ---------- Affiliate/KOL (TikTok) — 2 bảng tuỳ chọn, chỉ hiện khi có ít
// nhất 1 trong 2 file affiliateOrders/videoAnalysis (res.affiliateKoc khác
// null) — tái dùng đúng token màu (--p1/--p2/--p3/--accent/--good/--proc) và
// các class bảng/thanh ngang (.dtable, .bar-track) đang có sẵn trong app,
// không tạo màu/font riêng cho phần này. ----------
const AFF_SEGMENT_COLORS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--accent)', 'var(--good)', 'var(--proc)'];

function buildAffiliateTable1Html(rows){
  if (!rows) return '<p style="font-size:12px;color:var(--ink-faint);">Chưa tải file Affiliate Orders tháng này.</p>';
  if (!rows.length) return '<p style="font-size:12px;color:var(--ink-faint);">Không có đơn "Đã quyết toán" nào trong file Affiliate Orders.</p>';
  // Cột CTOR (từ file Creator List) là tuỳ chọn riêng — chỉ thêm cột khi có ít
  // nhất 1 dòng có giá trị, để bảng vẫn y hệt cũ lúc chưa tải file này.
  const hasCtor = rows.some(r => r.ctor !== null && r.ctor !== undefined);
  return `<table class="dtable"><thead><tr><th>KOC</th><th style="text-align:right">Số đơn</th><th style="text-align:right">Doanh thu</th>${hasCtor ? '<th style="text-align:right">CTOR</th>' : ''}</tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.koc)}</td><td class="num">${fmtInt(r.soDon)}</td><td class="num">${fmtVND(r.doanhThu)}</td>${hasCtor ? `<td class="num">${r.ctor !== null && r.ctor !== undefined ? fmtPct(r.ctor, 2) : '—'}</td>` : ''}</tr>`).join('')}
  </tbody></table>`;
}

function buildAffContentCellHtml(row){
  if (!row.hasOrderThisMonth || !row.contentBreakdown || !row.contentBreakdown.length){
    return `<div class="bar-track aff-empty" title="Chưa có đơn Affiliate Orders tháng này — video có thể đã ra đơn ở tháng khác (Video Analysis là dữ liệu luỹ kế theo video, không theo tháng)."><span class="aff-empty-text">chưa có đơn tháng này</span></div>`;
  }
  const segs = row.contentBreakdown.map((seg, i) =>
    `<span class="aff-seg" style="width:${(seg.pct * 100).toFixed(2)}%;background:${AFF_SEGMENT_COLORS[i % AFF_SEGMENT_COLORS.length]}" title="${esc(seg.loai)}: ${fmtPct(seg.pct, 0)}"></span>`
  ).join('');
  const legend = row.contentBreakdown.map((seg, i) =>
    `<span class="aff-legend-item"><i style="background:${AFF_SEGMENT_COLORS[i % AFF_SEGMENT_COLORS.length]}"></i>${esc(seg.loai)} ${fmtPct(seg.pct, 0)}</span>`
  ).join('');
  return `<div class="bar-track stacked-h">${segs}</div><div class="aff-legend">${legend}</div>`;
}

function buildAffiliateTable2Html(rows){
  if (!rows) return '<p style="font-size:12px;color:var(--ink-faint);">Chưa tải file Video Analysis tháng này.</p>';
  if (!rows.length) return '<p style="font-size:12px;color:var(--ink-faint);">Không có dữ liệu video nào trong file Video Analysis.</p>';
  return `<table class="dtable"><thead><tr><th>KOC</th><th>Doanh thu đến từ đâu</th><th style="text-align:right">Tỷ lệ xem hết TB</th><th style="text-align:right">CTR TB</th><th style="text-align:right">GPM</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.koc)}</td><td style="min-width:180px;">${buildAffContentCellHtml(r)}</td><td class="num">${fmtPct(r.completionAvg, 1)}</td><td class="num">${fmtPct(r.ctrAvg, 2)}</td><td class="num">${fmtVND(Math.round(r.gpm))}</td></tr>`).join('')}
  </tbody></table>`;
}

// Bảng 3 "Hiệu quả LIVE theo KOC" (Live List — Transaction Analysis) — tuỳ
// chọn, độc lập với Bảng 1/2; chỉ được gọi khi aff.liveTable khác null.
function buildAffiliateLiveTableHtml(rows){
  if (!rows.length) return '<p style="font-size:12px;color:var(--ink-faint);">Không có dữ liệu buổi LIVE nào trong file Live List.</p>';
  return `<table class="dtable"><thead><tr><th>KOC</th><th style="text-align:right">Số buổi LIVE</th><th style="text-align:right">GMV từ LIVE</th><th style="text-align:right">CTR TB</th><th style="text-align:right">GPM hiển thị TB</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.koc)}</td><td class="num">${fmtInt(r.soBuoiLive)}</td><td class="num">${fmtVND(r.gmvLive)}</td><td class="num">${fmtPct(r.ctrAvg, 2)}</td><td class="num">${fmtVND(Math.round(r.gpmHienThiAvg))}</td></tr>`).join('')}
  </tbody></table>`;
}

// Bảng 4 "CTOR/CTR & hiệu quả lượt xem" (2026-09-22, theo yêu cầu chủ shop:
// "ctor và ctr và tính thêm 1 chỉ số lượt view trên doanh thu") — tuỳ chọn,
// độc lập với Bảng 1/2/3, chỉ cần đúng 1 file Creator List (Transaction
// Analysis); chỉ được gọi khi aff.ctorCtrTable khác null.
function buildAffiliateCtorCtrTableHtml(rows){
  if (!rows.length) return '<p style="font-size:12px;color:var(--ink-faint);">Không có dữ liệu nào trong file Creator List.</p>';
  return `<table class="dtable"><thead><tr><th>KOC</th><th style="text-align:right">GMV</th><th style="text-align:right">CTOR</th><th style="text-align:right">CTR</th><th style="text-align:right">GMV/1.000 view</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.koc)}</td><td class="num">${fmtVND(r.gmv)}</td><td class="num">${fmtPct(r.ctor, 2)}</td><td class="num">${fmtPct(r.ctr, 2)}</td><td class="num">${r.gmvTren1000View === null ? '—' : fmtVND(r.gmvTren1000View)}</td></tr>`).join('')}
  </tbody></table>`;
}

// Hiệu suất theo SKU/size (2026-09-15, theo yêu cầu chủ shop) — gộp 2 sàn
// theo TÊN sản phẩm, chỉ tính đơn Hoàn thành, chỉ gồm mã đã có trong bảng tra
// cứu (calc.js đã lọc bỏ mã cũ/ngừng bán). Độc lập với Shop Stats.
// Thiết kế lại (2026-09-15, theo yêu cầu chủ shop "chỉ quan tâm 2 chỉ số SL
// bán TB/ngày và tỷ trọng size"): bỏ cột Tổng SL bán, hiện SL/ngày làm số to
// dễ nhìn + vẽ tỷ trọng size thành 1 thanh ngang xếp chồng theo màu đậm dần
// theo size (thay cho các "chip" rời rạc khó so sánh trước đây).
const SKU_SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '(không rõ size)'];
const SKU_SIZE_COLORS = ['#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a', '#cbd5e1'];
function skuSizeColor(size){
  const i = SKU_SIZE_ORDER.indexOf(size);
  return SKU_SIZE_COLORS[i === -1 ? SKU_SIZE_COLORS.length - 1 : i];
}
function buildSkuPerformanceHtml(res){
  const sp = res.skuPerformance;
  if (!sp || !sp.items || !sp.items.length){
    return '<p style="font-size:12px;color:var(--ink-faint);">Chưa tính được — kiểm tra mục cảnh báo ở trên (cột SKU/số lượng chưa đọc được).</p>';
  }
  const dayNote = sp.periodDays ? `SL bán trung bình/ngày (chia cho ${sp.periodDays} ngày của kỳ đang xem) và tỷ trọng theo size:` : 'SL bán trung bình/ngày và tỷ trọng theo size:';
  const rowsHtml = sp.items.map(item => {
    const barHtml = item.sizes.map(s => {
      const showLabel = s.pct >= 0.08; // lát quá hẹp thì bỏ chữ, tránh đè lên nhau
      return `<div class="sku-size-seg" style="width:${(s.pct * 100).toFixed(2)}%; background:${skuSizeColor(s.size)};" title="${esc(s.size)}: ${fmtInt(s.sl)} sp (${fmtPct(s.pct, 0)})">${showLabel ? `<span>${esc(s.size)} ${fmtPct(s.pct, 0)}</span>` : ''}</div>`;
    }).join('');
    const legendHtml = item.sizes.map(s => `<span class="sku-size-legend-item"><i style="background:${skuSizeColor(s.size)}"></i>${esc(s.size)} ${fmtPct(s.pct, 0)}</span>`).join('');
    return `
    <div class="sku-perf-row">
      <div class="sku-perf-head">
        <span class="sku-perf-name">${esc(item.ten)}</span>
        <span class="sku-perf-day"><b>${item.slNgay === null ? '—' : item.slNgay.toFixed(1)}</b> sp/ngày</span>
      </div>
      <div class="sku-size-bar">${barHtml}</div>
      <div class="sku-size-legend">${legendHtml}</div>
    </div>`;
  }).join('');
  return `<div class="sku-perf-note">${esc(dayNote)}</div><div class="sku-perf-list">${rowsHtml}</div>`;
}

function buildAffiliateKocSectionHtml(res){
  const aff = res.affiliateKoc;
  if (!aff) return '';
  const liveSectionHtml = aff.liveTable ? `
  <div class="sub-label">Hiệu quả LIVE theo KOC</div>
  ${buildAffiliateLiveTableHtml(aff.liveTable)}` : '';
  const ctorCtrSectionHtml = aff.ctorCtrTable ? `
  <div class="sub-label">CTOR/CTR &amp; hiệu quả lượt xem theo KOC <span style="text-transform:none;font-weight:400;">— GMV tính cả đơn chưa trừ huỷ/hoàn (khác "Doanh thu" ở bảng trên); GMV/1.000 view = doanh thu chia lượt xem, nhân 1.000 — càng cao nghĩa là view chuyển đổi ra tiền càng tốt (cùng chiều với GPM ở bảng trên)</span></div>
  ${buildAffiliateCtorCtrTableHtml(aff.ctorCtrTable)}` : '';
  return `
  <!-- ZONE 7 -->
  <div class="zone"><span class="z-num">8</span><span class="z-title">📣 Affiliate / KOL</span><span class="z-note">TikTok Shop Affiliate — theo KOC</span></div>
  <div class="sub-label">Tổng hợp KOC theo đơn &amp; doanh thu</div>
  ${buildAffiliateTable1Html(aff.table1)}
  <div class="sub-label">Chất lượng nội dung theo KOC <span style="text-transform:none;font-weight:400;">— GPM = doanh thu video liên kết / 1.000 lượt xem</span></div>
  ${buildAffiliateTable2Html(aff.table2)}${liveSectionHtml}${ctorCtrSectionHtml}`;
}

// ---------- Khách hàng theo khu vực — donut % số đơn theo tỉnh/thành (gộp 2
// sàn). Tái dùng đúng component donut sẵn có (.donut-body/.donut-ring/
// conic-gradient/.donut-legend/.dl-row); 6 lát tỉnh = 6 sắc độ nhạt dần của
// đúng màu chủ đạo --accent (color-mix với --surface, không thêm màu mới),
// lát "Khác" = --ink-faint (xám muted có sẵn). ----------
const REGION_SHADES = [
  'var(--accent)',
  'color-mix(in srgb, var(--accent) 80%, var(--surface))',
  'color-mix(in srgb, var(--accent) 64%, var(--surface))',
  'color-mix(in srgb, var(--accent) 50%, var(--surface))',
  'color-mix(in srgb, var(--accent) 38%, var(--surface))',
  'color-mix(in srgb, var(--accent) 28%, var(--surface))',
];

function buildKhuVucHtml(res){
  const kv = res.khuVuc;
  if (!kv || !kv.total || !kv.rows || !kv.rows.length){
    return '<div class="ct-title">Khách hàng theo khu vực</div><p style="font-size:12px;color:var(--ink-faint);">Chưa đọc được cột tỉnh/thành từ file "tất cả đơn hàng".</p>';
  }
  const rows = kv.rows.map((r, i) => ({
    ten: r.ten,
    soDon: r.soDon,
    pct: kv.total ? r.soDon / kv.total : 0,
    color: r.isKhac ? 'var(--ink-faint)' : REGION_SHADES[i % REGION_SHADES.length],
  }));
  let acc = 0;
  const stops = [];
  const sliceLabels = [];
  for (const r of rows){
    const pct = r.pct * 100;
    stops.push(`${r.color} ${acc.toFixed(2)}% ${(acc + pct).toFixed(2)}%`);
    if (r.pct >= 0.04){
      const mid = (acc + pct / 2) / 100; // tỉ lệ tính từ đỉnh, theo chiều kim đồng hồ
      const x = 95 + 82 * Math.sin(2 * Math.PI * mid);
      const y = 95 - 82 * Math.cos(2 * Math.PI * mid);
      sliceLabels.push(`<span class="region-slice-lbl" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;">${fmtPct(r.pct, 0)}</span>`);
    }
    acc += pct;
  }
  const legendRows = rows.map(r =>
    `<div class="dl-row"><i style="background:${r.color}"></i><span class="dl-name">${esc(r.ten)}</span><span class="dl-count">${fmtInt(r.soDon)} đơn</span><span class="dl-pct">${fmtPct(r.pct, 1)}</span></div>`
  ).join('');
  return `<div class="ct-title">Khách hàng theo khu vực <span class="ct-note">(% số đơn, gộp Shopee + TikTok)</span></div>
  <div class="donut-body">
    <div class="region-donut-wrap">
      <div class="donut-ring" style="background:conic-gradient(${stops.join(', ')})">
        <div class="donut-center"><span class="d-val">${fmtInt(kv.total)}</span><span class="d-lbl">tổng SL đơn</span></div>
      </div>
      ${sliceLabels.join('')}
    </div>
    <div class="donut-legend">${legendRows}</div>
  </div>`;
}

// ---------- Bảng phí sàn tách từng loại (lỗi #4 doc Chuẩn hoá 10/2026) ----------
// Nguồn: file tài chính 2 sàn (res.shopee/tiktok.phiSanChiTiet). Tháng lưu
// bằng công thức cũ chưa có trường này → ẩn bảng, KPI phí sàn vẫn hiện số cũ.
function buildPhiSanChiTietHtml(res){
  const sp = res.shopee && res.shopee.phiSanChiTiet;
  const tt = res.tiktok && res.tiktok.phiSanChiTiet;
  if (!sp && !tt) return '';
  const col = (title, bd, cls) => {
    if (!bd) return `<div class="card"><div class="c-title">${title}</div><p style="font-size:12px;color:var(--ink-faint);">Chưa có — cần file tài chính của sàn này.</p></div>`;
    const rows = Object.entries(bd)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => {
        const ghiChu = k.includes('không tính vào phí sàn') || k.includes('không phải phí');
        return `<tr${ghiChu ? ' style="color:var(--ink-faint);"' : ''}><td>${esc(k)}</td><td class="num">${fmtVND(v)}</td></tr>`;
      }).join('');
    return `<div class="card"><div class="c-title"><span class="plat ${cls}"><i></i>${title}</span></div>
      <table class="dtable"><tbody>${rows}</tbody></table></div>`;
  };
  return `
  <div class="sub-label">Phí sàn tách từng loại <span style="text-transform:none;font-weight:400;">— từ file tài chính; dòng mờ là khoản hiện để biết, không cộng vào "Tổng chi phí sàn"</span></div>
  <div class="grid cols-2">
    ${col('Shopee', sp, 'shopee')}
    ${col('TikTok', tt, 'tiktok')}
  </div>`;
}

// ---------- ZONE Lãi lỗ (mục 4 doc Chuẩn hoá, 21/10/2026) ----------
// P&L tháng: Doanh thu hàng → Giá vốn hàng bán (từ cost-catalog.json, combo đã
// tách) → Lãi gộp → phí sàn thật + QC GMV Max → Lãi sau phí → chi phí vận hành
// NHẬP TAY (lương kho/lương live/vật tư/khác — lưu vào chính bản ghi tháng)
// → LÃI RÒNG; kèm biên, điểm hoà vốn và bảng lãi gộp từng SP.
const PNL_COST_FIELDS = [
  { key: 'luongKho', label: 'Lương nhân viên kho', hint: 'bấm ⟳ để web tự tính từ Sổ Kho', auto: true },
  { key: 'luongLive', label: 'Lương nhân viên live', hint: 'bấm ⟳ để web tự đọc sheet lương live', auto: true },
  { key: 'vatTu', label: 'Vật tư đóng gói', hint: 'túi + tem + hộp… cả tháng (chi phí biến đổi)' },
  { key: 'adsKhac', label: 'Quảng cáo Shopee + QC khác', hint: 'tiền nạp ví QC Shopee tháng này; QC GMV Max của TikTok đã tự trừ ở trên' },
  { key: 'khac', label: 'Chi phí khác', hint: 'Sapo, điện nước, thuê kho… nếu có' },
];
function buildPnlHtml(res, opts){
  const p = res.pnl;
  if (!p) return `
  <div class="zone"><span class="z-num">2</span><span class="z-title">💰 Lãi lỗ</span><span class="z-note">P&amp;L tháng · lãi gộp theo SP · hoà vốn</span></div>
  <div class="card"><p style="font-size:12.5px;color:var(--ink-faint);margin:0;">Tháng này được lưu bằng công thức cũ nên chưa có số Lãi lỗ — bấm "🔄 Cập nhật lại lịch sử" để tính lại.</p></div>`;
  const cp = res.chiPhiVanHanh || {};
  const cpTong = PNL_COST_FIELDS.reduce((s, f) => s + (Number(cp[f.key]) || 0), 0);
  const coChiPhi = PNL_COST_FIELDS.some(f => cp[f.key] !== undefined && cp[f.key] !== null);
  // Theo bảng 4.1: vật tư đóng gói là chi phí BIẾN ĐỔI (trừ ra Lãi đóng góp);
  // lương + QC + khác là chi phí CỐ ĐỊNH tháng (mẫu số điểm hoà vốn).
  const cpVatTu = Number(cp.vatTu) || 0;
  const cpCoDinh = cpTong - cpVatTu;
  const laiDongGop = (p.laiSauPhiSan !== null) ? p.laiSauPhiSan - cpVatTu : null;
  const bienDongGop = (laiDongGop !== null && p.doanhThu) ? laiDongGop / p.doanhThu : null;
  const laiRong = (p.laiSauPhiSan !== null && coChiPhi) ? p.laiSauPhiSan - cpTong : null;
  const vnd = (v) => (v === null || v === undefined) ? '—' : fmtVND(v);
  const pct = (v, base) => (v === null || v === undefined || !base) ? '' : ` <span class="pnl-pct">${fmtPct(v / base, 1)}</span>`;

  const rows = [];
  const line = (label, value, cls, note) => rows.push(
    `<div class="pnl-row ${cls || ''}"><span class="pnl-label">${label}${note ? ` <span class="pnl-note">${note}</span>` : ''}</span><span class="pnl-value">${value}</span></div>`);
  line('Doanh thu hàng', fmtVND(p.doanhThu), 'head');
  line('− Giá vốn hàng bán', vnd(p.giaVonHangBan), '', p.thieuGiaVonSL ? `(${fmtInt(p.thieuGiaVonSL)} sp chưa có giá vốn — xem cảnh báo)` : '');
  line('= LÃI GỘP', vnd(p.laiGop) + pct(p.laiGop, p.doanhThu), 'total');
  line('− Phí sàn (đủ khoản, từ file tài chính)', fmtVND(p.phiSan));
  if (p.quangCaoGmvMax) line('− Quảng cáo GMV Max (TikTok cấn vào ví)', fmtVND(p.quangCaoGmvMax));
  line('= Lãi sau phí sàn &amp; quảng cáo', vnd(p.laiSauPhiSan) + pct(p.laiSauPhiSan, p.doanhThu), 'total');
  if (cpVatTu) line('− Vật tư đóng gói <span class="pnl-note">(chi phí biến đổi)</span>', fmtVND(cpVatTu));
  line('= LÃI ĐÓNG GÓP', vnd(laiDongGop) + (bienDongGop !== null ? ' <span class="pnl-pct">biên ' + fmtPct(bienDongGop, 1) + '</span>' : ''), 'total');
  for (const f of PNL_COST_FIELDS){
    if (f.key === 'vatTu') continue; // đã trừ ở trên
    const v = cp[f.key];
    if (v !== undefined && v !== null && Number(v) !== 0) line('− ' + f.label + ' <span class="pnl-note">(cố định)</span>', fmtVND(Number(v)));
  }
  line('= <b>LÃI RÒNG</b>', (laiRong === null ? '— <span class="pnl-note">nhập chi phí bên dưới</span>' : '<b>' + fmtVND(laiRong) + '</b>' + pct(laiRong, p.doanhThu)), 'total grand');

  // Điểm hoà vốn theo đúng bảng 4.1: doanh thu hoà vốn = chi phí CỐ ĐỊNH tháng
  // ÷ biên đóng góp; chia AOV ra số đơn; chia số ngày kỳ ra đơn/ngày.
  const donHT = res.tong ? res.tong.hoanThanh : 0;
  const aov = res.tong ? res.tong.aov : 0;
  const soNgay = res.skuPerformance && res.skuPerformance.periodDays ? res.skuPerformance.periodDays : 30;
  let hoaVonHtml = '<p style="font-size:12px;color:var(--ink-faint);margin:0;">Cần giá vốn + chi phí vận hành (nhập bên dưới) để tính điểm hoà vốn.</p>';
  if (bienDongGop !== null && bienDongGop > 0 && coChiPhi){
    const dtHoaVon = cpCoDinh / bienDongGop;
    const donHoaVon = aov > 0 ? dtHoaVon / aov : null;
    hoaVonHtml = `<div class="c-row"><span>Biên đóng góp <span class="pnl-note">(lãi đóng góp ÷ doanh thu)</span></span><span class="val">${fmtPct(bienDongGop, 1)}</span></div>
      <div class="divider"></div>
      <div class="c-row"><span>Chi phí cố định tháng <span class="pnl-note">(lương + QC + khác, không gồm vật tư)</span></span><span class="val">${fmtVND(cpCoDinh)}</span></div>
      <div class="divider"></div>
      <div class="c-row"><span><b>Doanh thu hoà vốn</b></span><span class="val"><b>${fmtVND(dtHoaVon)}</b>/tháng</span></div>
      <div class="divider"></div>
      <div class="c-row"><span><b>Số đơn hoà vốn</b> <span class="pnl-note">(÷ AOV ${fmtVND(aov)})</span></span><span class="val">${donHoaVon === null ? '—' : '<b>' + fmtInt(Math.ceil(donHoaVon)) + ' đơn/tháng</b> ≈ ' + (donHoaVon / soNgay).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' đơn/ngày'}</span></div>
      <p class="pnl-note" style="margin:8px 0 0;">Tháng này: ${fmtVND(p.doanhThu)} doanh thu · ${fmtInt(donHT)} đơn hoàn thành${donHoaVon !== null ? (donHT >= donHoaVon ? ' — ĐÃ VƯỢT hoà vốn ✓' : ' — còn thiếu ' + fmtInt(Math.ceil(donHoaVon - donHT)) + ' đơn') : ''}.</p>`;
  }

  // form chi phí — lưu vào bản ghi tháng đang xem (hoặc gắn vào số vừa tính)
  const inputs = PNL_COST_FIELDS.map(f => `
    <label class="pnl-cost-field"><span>${f.label} <span class="pnl-note">${f.hint}</span></span>
      <span class="pnl-cost-input">
        <input type="text" id="pnl-cost-${f.key}" inputmode="numeric" placeholder="0" value="${cp[f.key] !== undefined && cp[f.key] !== null ? fmtInt(Number(cp[f.key])) : ''}">
        ${f.auto ? `<button type="button" class="pnl-auto" data-auto="${f.key}" title="Web tự lấy số cho tháng đang xem">⟳</button>` : ''}
      </span></label>`).join('');
  const canSaveNow = !!(opts && opts.recordId);
  const formHtml = `
  <div class="card" id="pnl-cost-card">
    <div class="c-title">Chi phí vận hành tháng <span style="font-weight:400;color:var(--ink-faint)">(nhập 1 lần/tháng — lưu ngay vào tháng này)</span></div>
    <div class="pnl-cost-grid">${inputs}</div>
    <div style="display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap;">
      <button class="btn-primary" id="pnl-cost-save">${canSaveNow ? 'Lưu chi phí vào tháng này' : 'Áp vào số liệu đang xem'}</button>
      <span style="font-size:12px;color:var(--ink-faint);" id="pnl-cost-status">${canSaveNow ? '' : 'Đang xem số CHƯA lưu — bấm nút này để áp tạm, chi phí sẽ được lưu cùng khi bấm "Lưu vào lịch sử".'}</span>
    </div>
  </div>`;

  // bảng lãi gộp theo SP
  const items = (res.skuPerformance && res.skuPerformance.items ? res.skuPerformance.items : [])
    .filter(x => x.doanhThu !== undefined)
    .slice().sort((a, b) => (b.laiGop === null ? -1 : b.laiGop) - (a.laiGop === null ? -1 : a.laiGop));
  const tongDtSp = items.reduce((s2, x) => s2 + (x.doanhThu || 0), 0);
  const spTableHtml = items.length ? `
  <div class="sub-label">Lãi theo sản phẩm <span style="text-transform:none;font-weight:400;">— phí sàn PHÂN BỔ theo % doanh thu từng SP (xấp xỉ); doanh thu SP phân bổ theo dòng nên tổng hơi cao hơn Doanh thu hàng; combo đã tách về SKU con; chưa trừ chi phí hoàn và ads theo SP (chờ dữ liệu)</span></div>
  <table class="dtable"><thead><tr><th>Sản phẩm</th><th style="text-align:right">SL</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">Giá vốn</th><th style="text-align:right">Lãi gộp</th><th style="text-align:right">Biên gộp</th><th style="text-align:right">Phí sàn phân bổ</th><th style="text-align:right">Lãi sau phí sàn</th></tr></thead><tbody>
    ${items.map(x => {
      const phiPB = tongDtSp ? p.phiSan * ((x.doanhThu || 0) / tongDtSp) : 0;
      const laiSauPhi = x.laiGop === null ? null : x.laiGop - phiPB;
      return `<tr><td>${esc(x.ten)}</td><td class="num">${fmtInt(x.tongSL)}</td><td class="num">${fmtVND(x.doanhThu)}</td><td class="num">${x.thieuGiaVon ? '<span title="thiếu giá vốn ' + fmtInt(x.thieuGiaVon) + ' sp">thiếu</span>' : fmtVND(x.giaVon)}</td><td class="num">${x.laiGop === null ? '—' : fmtVND(x.laiGop)}</td><td class="num">${x.laiGop === null || !x.doanhThu ? '—' : fmtPct(x.laiGop / x.doanhThu, 0)}</td><td class="num">${fmtVND(phiPB)}</td><td class="num">${laiSauPhi === null ? '—' : '<b>' + fmtVND(laiSauPhi) + '</b>'}</td></tr>`;
    }).join('')}
  </tbody></table>` : '';

  return `
  <!-- ZONE 2: LÃI LỖ -->
  <div class="zone"><span class="z-num">2</span><span class="z-title">💰 Lãi lỗ</span><span class="z-note">P&amp;L tháng · hoà vốn · lãi gộp theo SP</span></div>
  <div class="grid cols-2">
    <div class="card"><div class="c-title">P&amp;L tháng</div><div class="pnl-table">${rows.join('')}</div></div>
    <div class="card"><div class="c-title">Điểm hoà vốn</div>${hoaVonHtml}</div>
  </div>
  ${formHtml}
  ${spTableHtml}`;
}

// ---------- ZONE Tồn kho & cần nhập (mục tuần 4 doc Chuẩn hoá, 21/10/2026) ----------
// Tồn = snapshot API Sapo (inventory-snapshot.json, chạy tools/sync_inventory.py
// để cập nhật); tốc độ bán = SL/ngày của KỲ ĐANG XEM (combo đã tách về SKU con).
// Ngày còn bán = tồn ÷ tốc độ → nhóm màu: HẾT HÀNG / <7 ngày (đỏ) / <14 (vàng)
// / đủ (xanh) / tồn đọng (có tồn nhưng kỳ này không bán được cái nào).
function buildInventoryHtml(res){
  const invData = (typeof window !== 'undefined' ? window.INVENTORY : globalThis.INVENTORY);
  const catalog = (typeof window !== 'undefined' ? window.SKU_CATALOG : globalThis.SKU_CATALOG);
  const costData = (typeof window !== 'undefined' ? window.COST_CATALOG : globalThis.COST_CATALOG);
  const zoneHead = `
  <!-- ZONE 3: TỒN KHO -->
  <div class="zone"><span class="z-num">3</span><span class="z-title">📦 Tồn kho &amp; đặt hàng</span><span class="z-note">tồn Sapo · điểm đặt hàng theo thời gian nhập</span></div>`;
  if (!invData || !invData.inventory || !catalog || !catalog.variants){
    return zoneHead + '<div class="card"><p style="font-size:12.5px;color:var(--ink-faint);margin:0;">Chưa tải được tồn kho (inventory-snapshot.json) hoặc danh mục SKU — kiểm tra 2 file này có được deploy cùng web không.</p></div>';
  }
  // Thời gian nhập hàng (đặt xưởng -> hàng về kho), chủ shop chỉnh được ngay
  // trên zone này (lưu theo máy). Buffer an toàn + số ngày muốn phủ sau khi
  // hàng về cũng vậy. Sheet DonHangSX hiện chỉ có ngày ĐẶT, chưa có ngày VỀ
  // nên chưa tự đo lead time từ dữ liệu được — khi sheet có đủ 2 cột thì nâng cấp.
  // Mặc định theo doc 4.1 + chốt với chủ shop 21/10: hàng về sau ~20 ngày,
  // đệm an toàn 7 ngày, mỗi lần đặt phủ thêm 30 ngày bán.
  let LEAD = 20, BUFFER = 7, COVER = 30;
  try {
    LEAD = Number(localStorage.getItem('svh_lead_time')) || 20;
    BUFFER = Number(localStorage.getItem('svh_lead_buffer')) || 7;
    COVER = Number(localStorage.getItem('svh_cover_days')) || 30;
  } catch (e){}

  const sp = res.skuPerformance;
  const periodDays = (sp && sp.periodDays) ? sp.periodDays : null;
  const normKey = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const costOf = (baseSku) => {
    if (!costData || !costData.cost) return null;
    const k = normKey(baseSku);
    for (const [kk, v] of Object.entries(costData.cost)) if (normKey(kk) === k) return Number(v);
    return null;
  };
  const variantsByNorm = {};
  for (const [sku, v] of Object.entries(catalog.variants)) variantsByNorm[normKey(sku)] = Object.assign({ sku }, v);
  // Tốc độ bán: ƯU TIÊN sales-velocity.json — SL bán 28 ngày gần nhất lấy thẳng
  // từ đơn trên Sapo (tools/sync_daily.py chạy mỗi sáng, combo đã tách, đã trừ
  // huỷ) — đúng công thức 4.1 và luôn mới; thiếu file thì rơi về tốc độ của kỳ
  // đang xem. Giá bán TB mỗi mẫu vẫn lấy từ kỳ đang xem (velocity không có tiền).
  const vel = (typeof window !== 'undefined' ? window.SALES_VELOCITY : globalThis.SALES_VELOCITY);
  const rate = {};          // 'tên|size' -> sl/ngày
  const giaTBMau = {};      // tên -> doanh thu TB / 1 cái
  if (sp && sp.items && periodDays){
    for (const it of sp.items){
      if (it.doanhThu !== undefined && it.tongSL) giaTBMau[it.ten] = it.doanhThu / it.tongSL;
    }
  }
  let rateSrc;
  if (vel && vel.sold && vel.days){
    for (const [sku, q] of Object.entries(vel.sold)){
      const v = variantsByNorm[normKey(sku)];
      const name = v ? v.name : sku;
      const size = (v && v.size) ? v.size : '(1 size)';
      const k = name + '|' + size;
      rate[k] = (rate[k] || 0) + q / vel.days;
    }
    rateSrc = 'bán ' + fmtInt(vel.days) + ' ngày gần nhất từ Sapo (cập nhật ' + esc(vel.generatedAt || '?') + ', ' + fmtInt(vel.orders || 0) + ' đơn, đã trừ huỷ)';
  } else if (sp && sp.items && periodDays){
    for (const it of sp.items){
      for (const s2 of (it.sizes || [])) rate[it.ten + '|' + s2.size] = s2.sl / periodDays;
    }
    rateSrc = 'kỳ đang xem (' + fmtInt(periodDays) + ' ngày) — chưa có sales-velocity.json';
  } else {
    rateSrc = 'chưa có dữ liệu tốc độ bán';
  }

  // Gom theo MẪU (đặt xưởng cắt may theo mẫu, không theo từng size lẻ)
  const mau = {};
  let tongTon = 0, tongGiaTri = 0, giaTriThieu = 0;
  for (const [sku, tonRaw] of Object.entries(invData.inventory)){
    const v = variantsByNorm[normKey(sku)];
    const name = v ? v.name : sku;
    const size = (v && v.size) ? v.size : '(1 size)';
    const baseSku = sku.replace(/-(XXXL|3XL|2XL|XXL|XL|S|M|L)$/i, '');
    if (!mau[name]) mau[name] = { name, baseSku, sizes: {} };
    if (!mau[name].sizes[size]) mau[name].sizes[size] = { ton: 0 };
    mau[name].sizes[size].ton += tonRaw;
  }
  const rows = [];
  for (const m of Object.values(mau)){
    let ton = 0, banNgay = 0, matNgay = 0;
    const goiY = [], thieuSize = [];
    const giaTB = giaTBMau[m.name] || null;
    for (const [size, d] of Object.entries(m.sizes)){
      const tonD = Math.max(0, d.ton);
      let r = rate[m.name + '|' + size] || 0;
      if (!r && size === '(1 size)') r = rate[m.name + '|(không rõ size)'] || 0;
      ton += tonD; banNgay += r;
      if (tonD <= 0 && r > 0){
        thieuSize.push(size);
        if (giaTB) matNgay += r * giaTB;
      }
      // gợi ý SL đặt: đủ bán tới lúc hàng về + phủ thêm COVER ngày
      const can = Math.ceil(r * (LEAD + BUFFER + COVER) - tonD);
      if (can > 0 && r > 0) goiY.push({ size, can });
    }
    const unitCost = costOf(m.baseSku);
    const giaTri = unitCost !== null ? ton * unitCost : null;
    tongTon += ton;
    if (giaTri !== null) tongGiaTri += giaTri; else if (ton > 0) giaTriThieu += ton;
    const ngayCon = banNgay > 0 ? ton / banNgay : null;
    let nhom, nhomOrder;
    if (banNgay <= 0 && ton > 0){ nhom = 'TỒN ĐỌNG'; nhomOrder = 4; }
    else if (banNgay <= 0){ continue; } // không tồn, không bán — bỏ
    else if (ngayCon <= LEAD){ nhom = 'ĐẶT NGAY'; nhomOrder = 1; }          // đặt hôm nay hàng về vẫn kịp sát nút/đã trễ
    else if (ngayCon <= LEAD + BUFFER + 7){ nhom = 'ĐẶT TUẦN NÀY'; nhomOrder = 2; }
    else { nhom = 'ỔN'; nhomOrder = 3; }
    rows.push({ ...m, ton, banNgay, ngayCon, giaTri, matNgay, thieuSize, goiY, nhom, nhomOrder,
      treNgay: ngayCon !== null ? Math.ceil(LEAD - ngayCon) : null });
  }
  rows.sort((a, b) => (a.nhomOrder - b.nhomOrder) || (b.matNgay - a.matNgay) || ((a.ngayCon ?? 1e9) - (b.ngayCon ?? 1e9)));

  const datNgay = rows.filter(r => r.nhomOrder === 1);
  const datTuan = rows.filter(r => r.nhomOrder === 2);
  const onDinh = rows.filter(r => r.nhomOrder === 3);
  const tonDong = rows.filter(r => r.nhomOrder === 4);
  const matNgayTong = rows.reduce((s, r) => s + r.matNgay, 0);
  // Vòng quay kho (công thức ghi ngay trên UI): giá vốn hàng bán 1 ngày của kỳ
  // đang xem = COGS kỳ / số ngày kỳ; số ngày quay hết kho = giá trị tồn / COGS-ngày.
  // Giá vốn bán ra mỗi ngày: ưu tiên tính từ chính tốc độ bán 28 ngày (cùng kỳ
  // với tồn hiện tại) — nếu so tồn HÔM NAY với COGS của tháng cũ thì lệch kỳ,
  // vòng quay ra sai hẳn. Thiếu velocity mới rơi về COGS của kỳ đang xem.
  let cogsNgay = null;
  if (vel && vel.sold && vel.days){
    let cogs28 = 0;
    for (const [sku, q] of Object.entries(vel.sold)){
      const u = costOf(String(sku).replace(/-(XXXL|3XL|2XL|XXL|XL|S|M|L)$/i, ''));
      if (u !== null) cogs28 += u * q;
    }
    if (cogs28) cogsNgay = cogs28 / vel.days;
  }
  if (cogsNgay === null){
    const cogsKy = res.pnl && res.pnl.giaVonHangBan;
    cogsNgay = (cogsKy && periodDays) ? cogsKy / periodDays : null;
  }
  const ngayQuayHet = (cogsNgay && tongGiaTri) ? tongGiaTri / cogsNgay : null;
  const vongNam = ngayQuayHet ? 365 / ngayQuayHet : null;

  const nhomMau = { 'ĐẶT NGAY': 'inv-do', 'ĐẶT TUẦN NÀY': 'inv-vang', 'ỔN': 'inv-xanh', 'TỒN ĐỌNG': 'inv-xam' };
  const rowHtml = (r) => `<tr>
    <td><b>${esc(r.name)}</b>${r.thieuSize.length ? '<br><span class="inv-thieu">hết size: ' + r.thieuSize.map(esc).join(', ') + '</span>' : ''}</td>
    <td class="num">${fmtInt(r.ton)}</td>
    <td class="num">${r.banNgay.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</td>
    <td class="num"><b>${r.ngayCon === null ? '—' : (r.ngayCon >= 365 ? '365+' : fmtInt(Math.floor(r.ngayCon)))}</b></td>
    <td class="num">${r.matNgay ? '<b class="inv-mat">' + fmtVND(Math.round(r.matNgay)) + '</b>' : '—'}</td>
    <td>${r.goiY.length ? r.goiY.map(g => '<span class="inv-goiy">' + esc(g.size) + ' ×' + fmtInt(g.can) + '</span>').join(' ') : '—'}</td>
    <td class="num">${r.giaTri === null ? '—' : fmtVND(r.giaTri)}</td>
    <td><span class="inv-badge ${nhomMau[r.nhom]}">${r.nhom}${r.nhom === 'ĐẶT NGAY' && r.treNgay > 0 ? ' (trễ ' + fmtInt(r.treNgay) + ' ng)' : ''}</span></td></tr>`;
  const thead = '<thead><tr><th>Mẫu</th><th style="text-align:right">Tồn</th><th style="text-align:right">Bán/ngày</th><th style="text-align:right">Còn bán được (ngày)</th><th style="text-align:right">Mất ~đ/ngày vì hết size</th><th>Gợi ý đặt (đủ tới khi hàng về + ' + fmtInt(COVER) + ' ngày nữa)</th><th style="text-align:right">Giá trị tồn</th><th>Tình trạng</th></tr></thead>';
  const tbl = (list) => `<table class="dtable">${thead}<tbody>${list.map(rowHtml).join('')}</tbody></table>`;

  return `${zoneHead}
  <div class="kpi-row">
    <div class="kpi-tile"><div class="k-label">Tồn kho hiện tại</div><div class="k-value">${fmtInt(tongTon)}</div><div class="k-sub">cái · ${fmtCompact(tongGiaTri)} giá vốn${giaTriThieu ? ' (+' + fmtInt(giaTriThieu) + ' cái chưa có giá vốn)' : ''} — Sapo lúc ${esc(invData.generatedAt || '?')}</div></div>
    <div class="kpi-tile"><div class="k-label">Vòng quay tồn kho</div><div class="k-value">${ngayQuayHet === null ? '—' : (30 / ngayQuayHet).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' vòng/tháng'}</div><div class="k-sub">${ngayQuayHet === null ? 'cần giá vốn + kỳ có bán hàng' : 'quay hết 1 vòng ≈ ' + fmtInt(ngayQuayHet) + ' ngày (giá vốn bán ra mỗi ngày ÷ giá trị tồn; dùng tồn HIỆN TẠI thay tồn bình quân — nâng cấp khi có snapshot theo ngày)'}</div></div>
    <div class="kpi-tile"><div class="k-label">Đang mất vì hết size</div><div class="k-value">${matNgayTong ? '~' + fmtCompact(matNgayTong * 30) : '0'}</div><div class="k-sub">${matNgayTong ? fmtVND(Math.round(matNgayTong)) + '/ngày nếu cứ để hết (×30 ngày)' : 'không mẫu nào đang hết size bán chạy'}</div></div>
    <div class="kpi-tile"><div class="k-label">Phải đặt hàng NGAY</div><div class="k-value">${fmtInt(datNgay.length)}</div><div class="k-sub">mẫu (tồn không đủ bán tới lúc hàng mới về) · +${fmtInt(datTuan.length)} mẫu đặt trong tuần</div></div>
  </div>
  <div class="card" style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
    <span style="font-size:12.5px; font-weight:600;">Thông số đặt hàng:</span>
    <label class="inv-cfg">Hàng về sau khi đặt <input type="number" id="inv-lead" min="1" max="120" value="${LEAD}"> ngày</label>
    <label class="inv-cfg">+ dự phòng <input type="number" id="inv-buffer" min="0" max="30" value="${BUFFER}"> ngày</label>
    <label class="inv-cfg">đặt đủ bán thêm <input type="number" id="inv-cover" min="7" max="120" value="${COVER}"> ngày</label>
    <button class="btn-primary" id="inv-apply" style="padding:7px 14px;">Áp dụng</button>
    <span style="font-size:11.5px;color:var(--ink-faint);">"ĐẶT NGAY" = tồn không đủ bán trong ${fmtInt(LEAD)} ngày chờ hàng về. Tốc độ bán: ${rateSrc}. Gợi ý đặt CHƯA nhân hệ số mùa (chưa đủ 12 tháng dữ liệu) và CHƯA trừ hàng đang về (sheet SX chưa có cột ngày về). Cập nhật số tồn: nhắn Claude "cập nhật tồn kho".</span>
  </div>
  ${datNgay.length || datTuan.length
    ? `<div class="sub-label">Cần đặt hàng <span style="text-transform:none;font-weight:400;">— xếp theo tiền đang mất mỗi ngày</span></div>${tbl([...datNgay, ...datTuan])}`
    : '<div class="card"><p style="margin:0;font-size:12.5px;color:var(--good);">✓ Không mẫu nào tới điểm đặt hàng theo thông số hiện tại.</p></div>'}
  ${onDinh.length ? `<details class="inv-details"><summary>Đủ hàng (${onDinh.length} mẫu)</summary>${tbl(onDinh)}</details>` : ''}
  ${tonDong.length ? `<details class="inv-details"><summary>Tồn đọng — kỳ này không bán được cái nào (${tonDong.length} mẫu, ${fmtVND(tonDong.reduce((s2, r) => s2 + (r.giaTri || 0), 0))} vốn nằm im)</summary>${tbl(tonDong)}</details>` : ''}`;
}

// ---------- Card "Gói hoàn phí vận chuyển — nên đăng ký không?" (21/10/2026) ----------
// Chủ shop hiện KHÔNG đăng ký PiShip (Shopee) / gói hoàn phí VC (TikTok).
// Đúng 3 dòng theo yêu cầu: (1) ship hoàn/huỷ đã tự trả tháng này, (2) chi phí
// ước tính nếu đăng ký gói = số đơn hoàn thành × đơn giá gói, (3) ĐỀ XUẤT.
// Đơn giá gói chỉnh được (Shopee mặc định 2.700đ/đơn — đo từ chính tháng 7 còn
// dùng gói: 534.600đ ÷ ~198 đơn; TikTok tạm 3.000đ/đơn — sửa khi có giá thật).
function buildShipRefundPackHtml(res){
  const s2 = res.shopee || {}, t2 = res.tiktok || {};
  const shipSp = (s2.phiSanChiTiet && Number(s2.phiSanChiTiet['Phí vận chuyển trả hàng'])) || 0;
  const shipTt = (t2.phiSanChiTiet && Number(t2.phiSanChiTiet['Phí vận chuyển trả hàng'])) || 0;
  const daTra = shipSp + shipTt;
  let giaSp = 2700, giaTt = 3000;
  try {
    giaSp = Number(localStorage.getItem('svh_pack_sp')) || 2700;
    giaTt = Number(localStorage.getItem('svh_pack_tt')) || 3000;
  } catch (e){}
  const donSp = s2.hoanThanh || 0, donTt = t2.hoanThanh || 0;
  const uocTinh = donSp * giaSp + donTt * giaTt;
  const coDuLieu = !!(s2.phiSanChiTiet || t2.phiSanChiTiet);
  const chenh = daTra - uocTinh;
  const nenDangKy = chenh > 0;
  return `
  <div class="card single"><div class="c-title">Gói hoàn phí vận chuyển (PiShip…) — nên đăng ký không?</div>
    ${coDuLieu ? `
    <div class="pnl-row"><span class="pnl-label">1. Ship hoàn/huỷ shop ĐÃ TỰ TRẢ tháng này <span class="pnl-note">(Shopee ${fmtVND(shipSp)} · TikTok ${fmtVND(shipTt)})</span></span><span class="pnl-value">${fmtVND(daTra)}</span></div>
    <div class="pnl-row"><span class="pnl-label">2. Nếu đăng ký gói, phí ước tính <span class="pnl-note">(${fmtInt(donSp)} đơn Shopee × ${fmtInt(giaSp)}đ + ${fmtInt(donTt)} đơn TikTok × ${fmtInt(giaTt)}đ)</span></span><span class="pnl-value">${fmtVND(uocTinh)}</span></div>
    <div class="pnl-row total"><span class="pnl-label">3. ĐỀ XUẤT</span><span class="pnl-value" style="color:${nenDangKy ? 'var(--good)' : 'var(--warn)'};">${nenDangKy ? 'NÊN ĐĂNG KÝ — tiết kiệm ~' + fmtVND(chenh) + '/tháng' : 'KHÔNG NÊN — tốn thêm ~' + fmtVND(-chenh) + '/tháng'}</span></div>
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:8px;">
      <label class="inv-cfg">Giá gói Shopee <input type="number" id="pack-gia-sp" min="0" value="${giaSp}"> đ/đơn</label>
      <label class="inv-cfg">TikTok <input type="number" id="pack-gia-tt" min="0" value="${giaTt}"> đ/đơn</label>
      <button class="btn-secondary" id="pack-apply" style="padding:5px 12px;">Áp dụng</button>
    </div>`
    : '<p style="font-size:12px;color:var(--ink-faint);margin:0;">Tháng này lưu bằng công thức cũ — bấm "Cập nhật lại lịch sử" để có số phí vận chuyển trả hàng.</p>'}
  </div>`;
}

// ---------- render ----------
function render(res, opts){
  opts = opts || {};
  const label = opts.label || (fmtDateVN(res.minDate) + ' – ' + fmtDateVN(res.maxDate));
  const s = res.shopee, t = res.tiktok, g = res.tong, n4 = res.nhanh4;

  const pill = (ok, okText, warnText) => ok
    ? `<span class="pill good"><span class="dot"></span>${okText}</span>`
    : `<span class="pill warn"><span class="dot"></span>${warnText}</span>`;

  // reasons stacked column chart — one column per (reason, platform) actually
  // present this period; sorted by count desc, capped to keep the chart readable
  const reasonRows = (res.reasonRows || []).slice().sort((a,b) => b.count - a.count).slice(0, 10);
  const maxReasonCount = Math.max(1, ...reasonRows.map(r => r.count));
  const REASON_MAX_PX = 150;
  const reasonCols = reasonRows.map(r => {
    const h = Math.max(2, Math.round(r.count / maxReasonCount * REASON_MAX_PX));
    const seg = r.platform === 'Shopee' ? 'seg-shopee' : 'seg-tiktok';
    return `<div class="col-item">
        <span class="bar-total">${r.count}</span>
        <div class="bar-stack"><div class="${seg}" style="height:${h}px"></div></div>
      </div>`;
  }).join('');
  const reasonLabels = reasonRows.map(r => {
    const short = r.reason.length > 34 ? r.reason.slice(0, 33) + '…' : r.reason;
    return `<span title="${esc(r.reason)}">${esc(short)}<br><span style="color:${r.platform==='Shopee'?'var(--shopee)':'var(--tiktok)'}">${r.platform}</span></span>`;
  }).join('');

  // channel donut
  let channelHtml = '<p style="font-size:12px;color:var(--ink-faint);">Chưa tải file Shop Stats (file thứ 8) nên chưa có số liệu kênh.</p>';
  if (res.kenh){
    const k = res.kenh;
    const parts = [
      { name: 'Thẻ sản phẩm', v: k.theSanPham, c: 'var(--p1)' },
      { name: 'Video', v: k.video, c: 'var(--p2)' },
      { name: 'Tiếp thị liên kết', v: k.tiepThiLienKet, c: 'var(--p3)' },
      { name: 'Livestream', v: k.livestream, c: null },
    ];
    let acc = 0;
    const stops = [];
    for (const p of parts){
      if (!p.c || p.v <= 0) continue;
      const pct = k.total ? p.v / k.total * 100 : 0;
      stops.push(`${p.c} ${acc.toFixed(1)}% ${(acc+pct).toFixed(1)}%`);
      acc += pct;
    }
    const legendRows = parts.map(p => {
      const pct = k.total ? p.v / k.total : 0;
      const muted = (!p.c || p.v <= 0) ? ' muted' : '';
      const dotColor = p.c || 'var(--line-strong)';
      return `<div class="dl-row${muted}"><i style="background:${dotColor}"></i><span class="dl-name">${p.name}</span><span class="dl-pct">${fmtPct(pct, 1)}</span></div>`;
    }).join('');
    channelHtml = `<div class="donut-body">
      <div class="donut-ring" style="background:conic-gradient(${stops.join(', ')})">
        <div class="donut-center"><span class="d-val">${fmtCompact(k.total)}</span><span class="d-lbl">tổng doanh số</span></div>
      </div>
      <div class="donut-legend">${legendRows}</div>
    </div>`;
  }

  // product CTR / conversion columns
  let ctrHtml = '', convHtml = '', prodTableHtml = '';
  if (res.sanPham && res.sanPham.length){
    const prods = res.sanPham;
    const maxCtr = Math.max(...prods.map(p => p.ctr), 0.0001);
    const maxConv = Math.max(...prods.map(p => p.chuyenDoi), 0.0001);
    const worstConvIdx = prods.reduce((wi, p, i, arr) => p.chuyenDoi < arr[wi].chuyenDoi ? i : wi, 0);
    const shortName = (nm) => {
      if (!nm) return '(?)';
      const words = nm.split(/[,\s]+/).filter(Boolean);
      return words.slice(0, 3).join(' ');
    };
    ctrHtml = `<div class="colchart-wrap">${prods.map(p =>
      `<div class="col-item"><span class="bar-val">${fmtPct(p.ctr,2)}</span><div class="bar" style="height:${Math.round(p.ctr/maxCtr*150)}px; background:var(--accent)"></div></div>`
    ).join('')}</div><div class="col-labels">${prods.map(p => `<span>${esc(shortName(p.ten))}</span>`).join('')}</div>`;
    convHtml = `<div class="colchart-wrap">${prods.map((p,i) =>
      `<div class="col-item"><span class="bar-val" style="${i===worstConvIdx?'color:var(--warn)':''}">${fmtPct(p.chuyenDoi,2)}</span><div class="bar" style="height:${Math.round(p.chuyenDoi/maxConv*150)}px; background:${i===worstConvIdx?'var(--warn)':'var(--ink-faint)'}"></div>${i===worstConvIdx?'<span class="col-flag">thấp nhất</span>':''}</div>`
    ).join('')}</div><div class="col-labels">${prods.map(p => `<span>${esc(shortName(p.ten))}</span>`).join('')}</div>`;
    prodTableHtml = `<table class="dtable"><thead><tr><th>Sản phẩm</th><th style="text-align:right">Doanh số</th><th style="text-align:right">CTR</th><th style="text-align:right">Tỷ lệ chuyển đổi</th></tr></thead><tbody>
      ${prods.map(p => `<tr><td>${esc(p.ten)}</td><td class="num">${fmtVND(p.doanhSo)}</td><td class="num">${fmtPct(p.ctr,2)}</td><td class="num">${fmtPct(p.chuyenDoi,2)}</td></tr>`).join('')}
    </tbody></table>`;
  } else {
    ctrHtml = convHtml = '<p style="font-size:12px;color:var(--ink-faint);">Chưa có dữ liệu (cần file Shop Stats).</p>';
  }


  const warningsHtml = (res.warnings && res.warnings.length) || res.ssWarning
    ? `<div class="card" style="border-color:var(--warn); margin-bottom:16px;">
        <div class="c-title" style="color:var(--warn)">⚠ Cần chủ shop xác nhận thêm</div>
        ${(res.warnings||[]).map(w => `<div style="font-size:12.5px;">${esc(w)}</div>`).join('')}
        ${res.ssWarning ? `<div style="font-size:12.5px;">${esc(res.ssWarning)}</div>` : ''}
      </div>`
    : '';

  return `
  ${warningsHtml}

  <!-- ZONE 1 -->
  <div class="zone"><span class="z-num">1</span><span class="z-title">Tổng quan</span><span class="z-note">doanh thu hàng · thực nhận · phí sàn · tổng đơn</span></div>
  ${res.daChotLai ? '<p style="font-size:12px;color:var(--good);margin:0 0 8px;">🔒 Kỳ này đã CHỐT LẠI — trả/hoàn đã gộp thêm dữ liệu của tháng sau.</p>' : ''}
  <div class="kpi-row">
    <div class="kpi-tile"><div class="k-label">${g.doanhThuCu === undefined ? 'Tổng doanh thu 2 sàn (công thức cũ)' : 'Doanh thu hàng 2 sàn'}</div><div class="k-value">${fmtCompact(g.doanhThu)}</div><div class="k-sub">Shopee ${fmtCompact(s.doanhThu)} · TikTok ${fmtCompact(t.doanhThu)}</div></div>
    <div class="kpi-tile"><div class="k-label">Thực nhận 2 sàn</div><div class="k-value">${g.thucNhan === null || g.thucNhan === undefined ? '—' : fmtCompact(g.thucNhan)}</div><div class="k-sub">${g.thucNhan === null || g.thucNhan === undefined ? 'cần tính lại bằng công thức mới' : 'Shopee ' + fmtCompact(s.thucNhan) + ' · TikTok ' + fmtCompact(t.thucNhan)}</div></div>
    <div class="kpi-tile"><div class="k-label">Tổng chi phí sàn</div><div class="k-value">${fmtCompact(g.phiSan)}</div><div class="k-sub">Shopee ${fmtCompact(s.phiSan)} · TikTok ${fmtCompact(t.phiSan)}</div></div>
    <div class="kpi-tile"><div class="k-label">Tổng đơn đặt trong kỳ</div><div class="k-value">${fmtInt(g.tongDon)}</div><div class="k-sub">Shopee ${fmtInt(s.tongDon)} · TikTok ${fmtInt(t.tongDon)}</div></div>
  </div>
  <p style="font-size:11.5px;color:var(--ink-faint);margin:4px 0 10px;">
    <b>Doanh thu hàng</b> = tiền hàng sau giảm giá của shop, TRƯỚC trợ giá sàn, không gồm ship (đơn hoàn thành, theo ngày đặt).
    <b>Thực nhận</b> = tiền sàn thật sự chuyển về trong kỳ theo file tài chính (đã trừ phí, thuế, điều chỉnh) — 2 số đo 2 việc khác nhau, không trừ chéo.
    ${t.quangCaoGmvMax ? ' TikTok: quyết toán đơn ' + fmtCompact((t.thucNhan || 0) + t.quangCaoGmvMax) + ' − quảng cáo GMV Max ' + fmtCompact(t.quangCaoGmvMax) + ' bị cấn thẳng vào ví = thực nhận ' + fmtCompact(t.thucNhan || 0) + '.' : ''}
    ${s.dieuChinh ? ' Shopee: doanh thu đơn hàng ' + fmtCompact((s.thucNhan || 0) - s.dieuChinh) + ' ' + (s.dieuChinh < 0 ? '−' : '+') + ' điều chỉnh ' + fmtCompact(Math.abs(s.dieuChinh)) + ' = thực nhận ' + fmtCompact(s.thucNhan || 0) + '.' : ''}
    ${g.doanhThuCu !== null && g.doanhThuCu !== undefined ? '<br>Số cũ để đối chiếu (sẽ bỏ sau 1 tháng): doanh thu công thức cũ ' + fmtCompact(g.doanhThuCu) + ' (Shopee ' + fmtCompact(s.doanhThuCu || 0) + ' · TikTok ' + fmtCompact(t.doanhThuCu || 0) + ').' : ''}
  </p>
  ${buildDailyRevenueChartHtml(res)}
  <div class="sub-label">Chi tiết theo sàn</div>
  <div class="grid cols-2">
    <div class="card"><div class="c-title">AOV (doanh thu hàng / đơn hoàn thành)</div>
      <div class="c-row shopee"><span class="plat shopee"><i></i>Shopee</span><span class="val">${fmtVND(s.aov)}</span></div><div class="divider"></div>
      <div class="c-row tiktok"><span class="plat tiktok"><i></i>TikTok</span><span class="val">${fmtVND(t.aov)}</span></div></div>
    <div class="card"><div class="c-title">SL đơn hoàn thành</div>
      <div class="c-row shopee"><span class="plat shopee"><i></i>Shopee</span><span class="val">${fmtInt(s.hoanThanh)}</span></div><div class="divider"></div>
      <div class="c-row tiktok"><span class="plat tiktok"><i></i>TikTok</span><span class="val">${fmtInt(t.hoanThanh)}</span></div></div>
  </div>
  ${buildPhiSanChiTietHtml(res)}

  ${buildPnlHtml(res, opts)}

  ${buildInventoryHtml(res)}

  <!-- ZONE 4 -->
  <div class="zone"><span class="z-num">4</span><span class="z-title">Khách hàng theo khu vực</span><span class="z-note">% số đơn theo tỉnh/thành — gộp Shopee + TikTok</span></div>
  <div class="chart-card" style="margin-bottom:14px;">${buildKhuVucHtml(res)}</div>

  <!-- ZONE 4 -->
  <div class="zone"><span class="z-num">5</span><span class="z-title">Đơn huỷ hoàn trả</span><span class="z-note">huỷ · trả · hoàn · lỗi do shop · hoàn về kho</span></div>
  <div class="grid cols-2">
    <div class="card"><div class="c-title">Tỷ lệ huỷ hoàn trả <span style="font-weight:400;color:var(--ink-faint)">(/ tổng đơn đặt)</span></div>
      <div class="c-row shopee"><span class="plat shopee"><i></i>Shopee</span><span class="val">${fmtPct(s.huyHoanTra/(s.tongDon||1))}</span></div><div class="divider"></div>
      <div class="c-row tiktok"><span class="plat tiktok"><i></i>TikTok</span><span class="val">${fmtPct(t.huyHoanTra/(t.tongDon||1))}</span></div></div>
    <div class="card"><div class="c-title">Tổng đơn hoàn về kho <span style="font-weight:400;color:var(--ink-faint)">(số tuyệt đối)</span></div>
      <div class="c-row shopee"><span class="plat shopee"><i></i>Shopee</span><span class="val">${fmtInt(s.hoanVeKho)}</span></div><div class="divider"></div>
      <div class="c-row tiktok"><span class="plat tiktok"><i></i>TikTok</span><span class="val">${fmtInt(t.hoanVeKho)}</span></div></div>
  </div>
  <div class="sub-label" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
    <span>Bảng lý do lỗi shop <span style="text-transform:none;font-weight:400;">— từng lý do, 2 sàn</span></span>
    <span class="legend" style="margin:0;"><span><i class="i-shopee"></i>Shopee</span><span><i class="i-tiktok"></i>TikTok</span></span>
  </div>
  <div class="reasons">
    <div class="r-total"><span class="t-label">Tổng số đơn lỗi shop, 2 sàn</span><span class="t-value">${fmtInt(g.loiShop)} đơn<span class="t-rate">— tỷ lệ lỗi do shop: Shopee ${fmtPct(s.loiShop/(s.tongDon||1))} · TikTok ${fmtPct(t.loiShop/(t.tongDon||1))} (/ tổng đơn đặt)</span></span></div>
    <div class="colchart-wrap stacked">${reasonCols}</div>
    <div class="col-labels">${reasonLabels}</div>
  </div>

  <!-- ZONE 5 -->
  <div class="zone"><span class="z-num">6</span><span class="z-title">Hiệu quả sàn</span><span class="z-note">số cố định cả kỳ — nguồn chỉ xuất theo tháng</span></div>
  <div class="grid">
    <div class="card single"><div class="c-title">Slove — Shopee</div>
      <div class="c-row"><span class="val">${fmtRatio(n4.slove)}</span>${pill(n4.slove>=1,'hỗ trợ > phí thu','hỗ trợ < phí thu')}</div>
      <div class="c-sub">Chi phí sàn đã hỗ trợ / Tổng chi phí sàn</div></div>
    <div class="card single"><div class="c-title">Tlove — TikTok</div>
      <div class="c-row"><span class="val">${fmtRatio(n4.tlove)}</span>${pill(n4.tlove>=1,'hỗ trợ > phí thu','hỗ trợ < phí thu')}</div>
      <div class="c-sub">Chi phí sàn đã hỗ trợ / Tổng chi phí sàn</div></div>
    ${buildShipRefundPackHtml(res)}
    <div class="card single"><div class="c-title">Voucher extra — Shopee</div>
      ${n4.voucherExtra===null ? '<div class="c-row"><span class="val">—</span></div><div class="c-sub">Cần file Shop Stats</div>' : `<div class="c-row"><span class="val">${fmtRatio(n4.voucherExtra)}</span>${pill(n4.voucherExtra>=1,'sàn đối ứng > chi thêm','shop đang chi nhiều hơn sàn đối ứng')}</div><div class="c-sub">Trợ giá Shopee (Shop Stats) / Phí Voucher Xtra</div>`}
    </div>
  </div>

  <!-- ZONE 6 -->
  <div class="zone"><span class="z-num">7</span><span class="z-title">Hiệu suất sản phẩm &amp; kênh</span><span class="z-note">Shopee, nguồn Shop Stats</span></div>
  <div class="chart-card" style="margin-bottom:14px;"><div class="ct-title">Doanh thu theo kênh</div>${channelHtml}</div>
  <div class="chart-grid">
    <div class="chart-card"><div class="ct-title">CTR theo sản phẩm <span class="ct-note">(kênh Thẻ sản phẩm)</span></div>${ctrHtml}</div>
    <div class="chart-card"><div class="ct-title">Tỷ lệ chuyển đổi theo sản phẩm <span class="ct-note">(kênh Thẻ sản phẩm)</span></div>${convHtml}</div>
  </div>
  <div class="sub-label">Chi tiết sản phẩm</div>
  ${prodTableHtml}

  <div class="sub-label">Hiệu suất theo SKU/size <span style="text-transform:none;font-weight:400;">— gộp 2 sàn, chỉ tính đơn Hoàn thành</span></div>
  ${buildSkuPerformanceHtml(res)}

  ${buildAffiliateKocSectionHtml(res)}

  <footer>
    <p><b>Nguồn dữ liệu:</b> tự tính từ các file Excel/CSV chủ shop tải lên ngay trên trình duyệt — không gửi lên máy chủ nào.</p>
    <p><b>Ghi chú:</b> Slove/Tlove/Tỷ lệ PiShip/Voucher extra là số cố định cả kỳ báo cáo (nguồn chỉ xuất theo tháng, không tách được theo ngày lẻ).</p>
  </footer>`;
}
