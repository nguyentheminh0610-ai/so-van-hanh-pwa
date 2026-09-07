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
  <div class="topbar">
    <div class="range-card">
      <div class="rc-head"><span class="rc-title">Kỳ báo cáo</span><span class="rc-chev">⌄</span></div>
      <div class="rc-dates"><span class="rc-date">${fmtDateVN(res.minDate)}</span><span class="rc-date">${fmtDateVN(res.maxDate)}</span></div>
      <div class="rc-track"><div class="rc-base"></div><div class="rc-fill"></div><span class="rc-handle" style="left:0%"></span><span class="rc-handle" style="left:100%"></span></div>
    </div>
    <div class="legend"><span><i class="i-shopee"></i>Shopee</span><span><i class="i-tiktok"></i>TikTok Shop</span></div>
  </div>

  <div class="masthead">
    <h1>Sổ vận hành Shopee &amp; TikTok Shop v2</h1>
    <span class="badge"><span class="dot"></span>${esc(label)}</span>
  </div>

  ${warningsHtml}

  <!-- ZONE 1 -->
  <div class="zone"><span class="z-num">1</span><span class="z-title">Tổng quan</span><span class="z-note">doanh thu · phí sàn · AOV · tổng đơn</span></div>
  <div class="kpi-row">
    <div class="kpi-tile"><div class="k-label">Tổng doanh thu 2 sàn</div><div class="k-value">${fmtCompact(g.doanhThu)}</div><div class="k-sub">Shopee ${fmtCompact(s.doanhThu)} · TikTok ${fmtCompact(t.doanhThu)}</div></div>
    <div class="kpi-tile"><div class="k-label">Tổng chi phí sàn</div><div class="k-value">${fmtCompact(g.phiSan)}</div><div class="k-sub">Shopee ${fmtCompact(s.phiSan)} · TikTok ${fmtCompact(t.phiSan)}</div></div>
    <div class="kpi-tile"><div class="k-label">AOV trung bình</div><div class="k-value">${fmtVND(g.aov)}</div><div class="k-sub">Shopee ${fmtVND(s.aov)} · TikTok ${fmtVND(t.aov)}</div></div>
    <div class="kpi-tile"><div class="k-label">Tổng đơn đặt trong kỳ</div><div class="k-value">${fmtInt(g.tongDon)}</div><div class="k-sub">Shopee ${fmtInt(s.tongDon)} · TikTok ${fmtInt(t.tongDon)}</div></div>
  </div>
  ${buildDailyRevenueChartHtml(res)}
  <div class="sub-label">Chi tiết theo sàn</div>
  <div class="grid cols-3">
    <div class="card"><div class="c-title">Giá trị đơn trung bình (AOV)</div>
      <div class="c-row shopee"><span class="plat shopee"><i></i>Shopee</span><span class="val">${fmtVND(s.aov)}</span></div><div class="divider"></div>
      <div class="c-row tiktok"><span class="plat tiktok"><i></i>TikTok</span><span class="val">${fmtVND(t.aov)}</span></div></div>
    <div class="card"><div class="c-title">Doanh thu ròng</div>
      <div class="c-row shopee"><span class="plat shopee"><i></i>Shopee</span><span class="val">${fmtVND(s.doanhThuRong)}</span></div><div class="divider"></div>
      <div class="c-row tiktok"><span class="plat tiktok"><i></i>TikTok</span><span class="val">${fmtVND(t.doanhThuRong)}</span></div></div>
    <div class="card"><div class="c-title">SL đơn hoàn thành</div>
      <div class="c-row shopee"><span class="plat shopee"><i></i>Shopee</span><span class="val">${fmtInt(s.hoanThanh)}</span></div><div class="divider"></div>
      <div class="c-row tiktok"><span class="plat tiktok"><i></i>TikTok</span><span class="val">${fmtInt(t.hoanThanh)}</span></div></div>
  </div>

  <!-- ZONE 2 -->
  <div class="zone"><span class="z-num">2</span><span class="z-title">Đơn huỷ hoàn trả</span><span class="z-note">huỷ · trả · hoàn · lỗi do shop · hoàn về kho</span></div>
  <div class="grid cols-3">
    <div class="card"><div class="c-title">Tổng huỷ hoàn trả <span style="font-weight:400;color:var(--ink-faint)">(huỷ+trả+hoàn)</span></div>
      <div class="c-row shopee"><span class="plat shopee"><i></i>Shopee</span><span class="val">${fmtInt(s.huyHoanTra)}</span></div><div class="divider"></div>
      <div class="c-row tiktok"><span class="plat tiktok"><i></i>TikTok</span><span class="val">${fmtInt(t.huyHoanTra)}</span></div></div>
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

  <!-- ZONE 3 -->
  <div class="zone"><span class="z-num">3</span><span class="z-title">Hiệu quả sàn</span><span class="z-note">số cố định cả kỳ — nguồn chỉ xuất theo tháng</span></div>
  <div class="grid">
    <div class="card single"><div class="c-title">Slove — Shopee</div>
      <div class="c-row"><span class="val">${fmtRatio(n4.slove)}</span>${pill(n4.slove>=1,'hỗ trợ > phí thu','hỗ trợ < phí thu')}</div>
      <div class="c-sub">Chi phí sàn đã hỗ trợ / Tổng chi phí sàn</div></div>
    <div class="card single"><div class="c-title">Tlove — TikTok</div>
      <div class="c-row"><span class="val">${fmtRatio(n4.tlove)}</span>${pill(n4.tlove>=1,'hỗ trợ > phí thu','hỗ trợ < phí thu')}</div>
      <div class="c-sub">Chi phí sàn đã hỗ trợ / Tổng chi phí sàn</div></div>
    <div class="card single"><div class="c-title">Tỷ lệ PiShip — Shopee</div>
      <div class="c-row"><span class="val">${fmtRatio(n4.piShipRatio)}</span>${pill(n4.piShipRatio>=1,'ổn','nên huỷ PiShip')}</div>
      <div class="c-sub">Phí VC được hoàn bởi PiShip / Phí dịch vụ PiShip${n4.piShipRatio<1?` — cứ 1đ phí trả chỉ được hoàn lại ${fmtRatio(n4.piShipRatio)}đ`:''}</div></div>
    <div class="card single"><div class="c-title">Voucher extra — Shopee</div>
      ${n4.voucherExtra===null ? '<div class="c-row"><span class="val">—</span></div><div class="c-sub">Cần file Shop Stats</div>' : `<div class="c-row"><span class="val">${fmtRatio(n4.voucherExtra)}</span>${pill(n4.voucherExtra>=1,'sàn đối ứng > chi thêm','shop đang chi nhiều hơn sàn đối ứng')}</div><div class="c-sub">Trợ giá Shopee (Shop Stats) / Phí Voucher Xtra</div>`}
    </div>
  </div>

  <!-- ZONE 4 -->
  <div class="zone"><span class="z-num">4</span><span class="z-title">Hiệu suất sản phẩm &amp; kênh</span><span class="z-note">Shopee, nguồn Shop Stats</span></div>
  <div class="chart-card" style="margin-bottom:14px;"><div class="ct-title">Doanh thu theo kênh</div>${channelHtml}</div>
  <div class="chart-grid">
    <div class="chart-card"><div class="ct-title">CTR theo sản phẩm <span class="ct-note">(kênh Thẻ sản phẩm)</span></div>${ctrHtml}</div>
    <div class="chart-card"><div class="ct-title">Tỷ lệ chuyển đổi theo sản phẩm <span class="ct-note">(kênh Thẻ sản phẩm)</span></div>${convHtml}</div>
  </div>
  <div class="sub-label">Chi tiết sản phẩm</div>
  ${prodTableHtml}

  <footer>
    <p><b>Nguồn dữ liệu:</b> tự tính từ các file Excel/CSV chủ shop tải lên ngay trên trình duyệt — không gửi lên máy chủ nào.</p>
    <p><b>Ghi chú:</b> Slove/Tlove/Tỷ lệ PiShip/Voucher extra là số cố định cả kỳ báo cáo (nguồn chỉ xuất theo tháng, không tách được theo ngày lẻ).</p>
  </footer>`;
}
