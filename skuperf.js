/* ============================================================================
   Tab "Hiệu suất SKU" — đọc sku-performance.json (sinh bởi tools/sync_sku_performance.py,
   chạy 2 ngày/lần trên PC trực bằng scripts/setup-sku-perf-task.ps1). Trang CHỈ ĐỌC.

   Hai khối (chốt với chủ shop 12–13/11/2026 qua nhiều vòng mô phỏng):
   1. Hiệu suất theo mẫu — gộp theo MÃ GỐC (CL01, CL06…), SP/ngày + thanh tỷ trọng
      size rộng (S→3XL luôn thấy), chip so cùng kỳ ngay cột SP/ngày. Có bộ chọn mẫu
      bật/tắt (nhớ lựa chọn trong localStorage).
   2. Giỏ hàng — SP/đơn trung bình + % đơn ≥2 SP (có so cùng kỳ), phân bổ đơn theo
      số SP (ẩn khúc "1 cái" cho dễ nhìn, % vẫn tính trên TỔNG đơn).
   Quy ước: đếm số cái vật lý — combo 2 cái = 2 SP (Sapo đã tách combo thành 2 dòng lẻ).
   Kỳ xem 7 / 14 / 28 ngày — số cả 3 kỳ đã tính sẵn trong JSON, đổi kỳ là xem ngay.
============================================================================ */

const SKP_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const SKP_LBL = { S: 'S', M: 'M', L: 'L', XL: 'XL', XXL: '2XL', XXXL: '3XL' };
let skpData = null;            // cache JSON sau lần tải đầu

function skpGetPeriod(){
  try { return localStorage.getItem('svh_skuperf_period') || '7'; } catch (e){ return '7'; }
}
function skpSetPeriod(p){ try { localStorage.setItem('svh_skuperf_period', p); } catch (e){} }
function skpHiddenSet(){
  try { return new Set(JSON.parse(localStorage.getItem('svh_skuperf_hidden') || '[]')); }
  catch (e){ return new Set(); }
}
function skpSaveHidden(set){
  try { localStorage.setItem('svh_skuperf_hidden', JSON.stringify([...set])); } catch (e){}
}
function skpVN(n){ return Number(n).toLocaleString('vi-VN'); }

function buildSkuPerfScreenHTML(){
  return `${skpStyle()}
  <div class="skp-top">
    <div>
      <h2 class="skp-h1">Hiệu suất bán theo mẫu</h2>
      <div class="skp-sub">Gộp 2 sàn · chỉ đơn Hoàn thành · nguồn API Sapo</div>
    </div>
    <div class="skp-seg" id="skp-seg" role="tablist" aria-label="Kỳ xem">
      <button role="tab" data-p="7">7 ngày</button>
      <button role="tab" data-p="14">14 ngày</button>
      <button role="tab" data-p="28">28 ngày</button>
    </div>
  </div>
  <div class="skp-status up-status" id="skp-status">Đang tải…</div>
  <div id="skp-body"></div>`;
}

async function refreshSkuPerf(){
  const body = document.getElementById('skp-body');
  const status = document.getElementById('skp-status');
  if (skpData){ skpRender(); return; }           // đã tải — chỉ vẽ lại
  try {
    const r = await fetch('sku-performance.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    skpData = await r.json();
    skpRender();
  } catch (err){
    if (status) status.textContent = '';
    body.innerHTML = `<div class="card"><p class="skp-quiet">Chưa đọc được <code>sku-performance.json</code> (${esc(err.message)}).
      File này do <code>tools/sync_sku_performance.py</code> sinh ra và đẩy lên mỗi 2 ngày trên PC trực —
      kiểm tra task <b>Claude - Hieu suat SKU</b> đã chạy và file đã được deploy cùng web chưa.</p></div>`;
  }
}

function skpRender(){
  const seg = document.getElementById('skp-seg');
  const body = document.getElementById('skp-body');
  const status = document.getElementById('skp-status');
  let period = skpGetPeriod();
  if (!skpData.periods[period]) period = '7';
  seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.p === period));
  if (status) status.textContent = 'Cập nhật ' + (skpData.generatedAt || '') + ' · kỳ ' + period + ' ngày';

  const P = skpData.periods[period];
  body.innerHTML = skpModelCard(P.model_rows, period) + skpBasketCard(P.basket, period);
  skpWireModelChips(P.model_rows, period);
}

/* ---------- Khối 1: Hiệu suất theo mẫu ---------- */
function skpDeltaChip(r){
  if (r.chg === null || r.chg === undefined)
    return `<span class="skp-delta new">mới</span>`;
  const up = r.chg >= 0;
  return `<span class="skp-delta ${up ? 'up' : 'down'}" title="kỳ trước ${r.prev}/ngày">${up ? '▲' : '▼'} ${up ? '+' : ''}${r.chg}%</span>`;
}
function skpSizeBar(sizes){
  const tot = SKP_SIZES.reduce((a, s) => a + (sizes[s] || 0), 0) || 1;
  return SKP_SIZES.filter(s => sizes[s]).map(s => {
    const pct = sizes[s] / tot * 100;
    const txt = pct >= 8 ? `${SKP_LBL[s]} ${Math.round(pct)}%` : (pct >= 3 ? SKP_LBL[s] : '');
    return `<span class="skp-s-${s}" title="${SKP_LBL[s]}: ${sizes[s]} cái · ${pct.toFixed(1)}%" style="width:${pct}%">${txt}</span>`;
  }).join('');
}
function skpModelCard(rows, period){
  const hidden = skpHiddenSet();
  const chips = rows.map(r => {
    const on = !hidden.has(r.base);
    return `<button class="skp-chip" data-b="${esc(r.base)}" aria-pressed="${on}">${esc(r.model)}</button>`;
  }).join('');
  const shown = rows.filter(r => !hidden.has(r.base));
  const maxpd = Math.max(1, ...shown.map(r => r.perday));
  const body = shown.length ? shown.map(r => `
    <tr>
      <td class="skp-model">${esc(r.model)}</td>
      <td><div class="skp-pd"><b class="num">${r.perday}</b><span class="skp-track"><i style="width:${r.perday / maxpd * 100}%"></i></span>${skpDeltaChip(r)}</div></td>
      <td><div class="skp-bar">${skpSizeBar(r.sizes)}</div></td>
    </tr>`).join('')
    : `<tr><td colspan="3" class="skp-quiet" style="text-align:center;padding:22px">Chưa chọn mẫu nào — bấm một mẫu phía trên để hiện.</td></tr>`;
  const legend = SKP_SIZES.map(s => `<span><i class="skp-sw skp-s-${s}"></i>${SKP_LBL[s]}</span>`).join('');
  return `<div class="card skp-card">
    <div class="skp-ch"><div class="c-title">Hiệu suất theo mẫu</div><span class="skp-eyebrow">SP/ngày · tỷ trọng size</span></div>
    <div class="skp-chips"><span class="skp-chips-lead">Chọn mẫu để xem:</span>${chips}</div>
    <div class="skp-chip-actions">
      <button class="skp-mini" id="skp-all">Tất cả</button>
      <button class="skp-mini" id="skp-none">Bỏ hết</button>
      <span class="skp-count" id="skp-count">đang xem ${shown.length}/${rows.length} mẫu</span>
    </div>
    <div class="skp-scroll"><table class="dtable skp-table">
      <colgroup><col style="width:27%"><col style="width:30%"><col style="width:43%"></colgroup>
      <thead><tr><th>Mẫu</th><th>SP/ngày · so cùng kỳ</th><th>Tỷ trọng size</th></tr></thead>
      <tbody id="skp-rows">${body}</tbody>
    </table></div>
    <div class="skp-legend">${legend}</div>
    <div class="skp-foot">Thanh <b>SP/ngày</b> so theo mẫu đang hiện · chip màu = thay đổi so với ${period} ngày liền trước · rê chuột vào khúc size để xem SL + %.</div>
  </div>`;
}
function skpWireModelChips(rows, period){
  const rerender = () => {
    const P = skpData.periods[period];
    document.getElementById('skp-body').innerHTML = skpModelCard(P.model_rows, period) + skpBasketCard(P.basket, period);
    skpWireModelChips(P.model_rows, period);
  };
  document.querySelectorAll('#skp-body .skp-chip').forEach(btn => btn.onclick = () => {
    const hidden = skpHiddenSet();
    const k = btn.dataset.b;
    hidden.has(k) ? hidden.delete(k) : hidden.add(k);
    skpSaveHidden(hidden); rerender();
  });
  const allBtn = document.getElementById('skp-all');
  const noneBtn = document.getElementById('skp-none');
  if (allBtn) allBtn.onclick = () => { skpSaveHidden(new Set()); rerender(); };
  if (noneBtn) noneBtn.onclick = () => { skpSaveHidden(new Set(rows.map(r => r.base))); rerender(); };
}

/* ---------- Khối 2: Giỏ hàng ---------- */
function skpCmp(cur, prev, isPct){
  const d = +(cur - prev).toFixed(2);
  const cls = d > 0 ? 'up' : (d < 0 ? 'down' : 'flat');
  const arrow = d > 0 ? '▲' : (d < 0 ? '▼' : '•');
  const fmt = v => isPct ? v.toFixed(1) + '%' : v.toFixed(2);
  return `<span class="skp-cmp ${cls}">${arrow} ${d > 0 ? '+' : ''}${fmt(d)}</span><span class="skp-cmp-base">so cùng kỳ (${fmt(prev)})</span>`;
}
function skpBasketCard(b, period){
  const p = b.prev || { spdon: b.spdon, pct2: b.pct2 };
  const dk = Object.keys(b.dist).filter(k => k !== '1');     // ẩn đơn 1 cái
  const sumMulti = dk.reduce((a, k) => a + b.dist[k], 0) || 1;
  const dcol = { '2': 'skp-d2', '3': 'skp-d3', '4': 'skp-d4', '5+': 'skp-d5' };
  const bar = dk.map(k => {
    const w = b.dist[k] / sumMulti * 100;
    const pctTot = b.dist[k] / (b.n || 1) * 100;
    const show = w >= 9;
    return `<span class="${dcol[k]}" title="${k} cái: ${skpVN(b.dist[k])} đơn · ${pctTot.toFixed(1)}% tổng đơn" style="width:${w}%">${show ? k + ' cái · ' + pctTot.toFixed(1) + '%' : ''}</span>`;
  }).join('');
  const leg = dk.map(k => `<span><i class="skp-sw ${dcol[k]}"></i>${k} cái · ${(b.dist[k] / (b.n || 1) * 100).toFixed(1)}%</span>`).join('');
  return `<div class="card skp-card">
    <div class="skp-ch"><div class="c-title">Giỏ hàng — SP trên mỗi đơn</div><span class="skp-eyebrow">combo tính là 2 cái</span></div>
    <div class="skp-kpis">
      <div class="skp-kpi"><div class="skp-kpi-lbl">SP / đơn (trung bình)</div><div class="skp-kpi-big num">${b.spdon.toFixed(2)}</div><div class="skp-kpi-cmp">${skpCmp(b.spdon, p.spdon, false)}</div></div>
      <div class="skp-kpi"><div class="skp-kpi-lbl">Đơn có ≥ 2 SP</div><div class="skp-kpi-big num skp-accent">${b.pct2}%</div><div class="skp-kpi-cmp">${skpCmp(b.pct2, p.pct2, true)}</div></div>
    </div>
    <div class="skp-disthd"><span class="t">Phân bổ đơn theo số sản phẩm</span><span class="r">% trên tổng đơn · đã ẩn đơn 1 cái</span></div>
    <div class="skp-bar skp-distbar">${bar}</div>
    <div class="skp-legend">${leg}</div>
    <div class="skp-foot"><b>So cùng kỳ (${period} ngày liền trước):</b> SP/đơn ${skpCmp(b.spdon, p.spdon, false)}; tỷ lệ đơn ≥2 SP ${skpCmp(b.pct2, p.pct2, true)}.</div>
    <div class="skp-foot skp-foot-last"><b>Quy ước:</b> đếm theo số cái vật lý — combo 2 cái = 2 SP (trên Sapo combo đã tách thành 2 dòng lẻ).<br>
      <b>Nguồn:</b> API Sapo <code>orders.json</code> · lọc completed · tự cập nhật 2 ngày/lần trên PC trực.</div>
  </div>`;
}

/* ---------- wire nút chọn kỳ (gắn 1 lần khi dựng app) ---------- */
function wireSkuPerf(){
  const seg = document.getElementById('skp-seg');
  if (!seg) return;
  seg.addEventListener('click', e => {
    const btn = e.target.closest('button[data-p]');
    if (!btn || !skpData) return;
    skpSetPeriod(btn.dataset.p);
    skpRender();
  });
}

/* ---------- CSS phạm vi trong tab (dùng token chung của app) ---------- */
function skpStyle(){ return `<style id="skp-style">
#screen-skuperf .skp-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px}
#screen-skuperf .skp-h1{font-size:18px;font-weight:700;margin:0;color:var(--ink)}
#screen-skuperf .skp-sub{font-size:12px;color:var(--ink-soft);margin-top:2px}
#screen-skuperf .skp-seg{display:inline-flex;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:3px;gap:2px}
#screen-skuperf .skp-seg button{font:inherit;font-size:12.5px;font-weight:600;border:0;background:transparent;color:var(--ink-soft);padding:5px 13px;border-radius:7px;cursor:pointer}
#screen-skuperf .skp-seg button[aria-selected="true"]{background:var(--accent);color:#fff}
#screen-skuperf .skp-status{display:block;margin:8px 0 14px;font-size:11.5px;color:var(--ink-faint)}
#screen-skuperf .skp-card{margin-bottom:18px}
#screen-skuperf .skp-ch{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
#screen-skuperf .skp-eyebrow{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint)}
#screen-skuperf .skp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 6px}
#screen-skuperf .skp-chips-lead{font-size:11.5px;color:var(--ink-soft);font-weight:600;align-self:center;margin-right:2px}
#screen-skuperf .skp-chip{font:inherit;cursor:pointer;font-size:11.5px;padding:3px 10px;border-radius:999px;border:1px solid var(--line-strong);background:transparent;color:var(--ink-soft)}
#screen-skuperf .skp-chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
#screen-skuperf .skp-chip[aria-pressed="true"]::before{content:"✓ "}
#screen-skuperf .skp-chip-actions{display:flex;gap:8px;align-items:center;margin:2px 0 12px}
#screen-skuperf .skp-mini{font:inherit;font-size:10.5px;padding:2px 9px;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer}
#screen-skuperf .skp-count{font-size:11px;color:var(--ink-faint)}
#screen-skuperf .skp-scroll{overflow-x:auto}
#screen-skuperf .skp-table{table-layout:fixed;min-width:560px}
#screen-skuperf .skp-table th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-faint);font-weight:600}
#screen-skuperf .skp-table td{vertical-align:middle}
#screen-skuperf .skp-model{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
#screen-skuperf .skp-pd{display:flex;align-items:center;gap:8px}
#screen-skuperf .skp-pd b{font-size:14px;min-width:40px;text-align:right;color:var(--ink)}
#screen-skuperf .skp-track{flex:1;height:5px;background:var(--line);border-radius:3px;overflow:hidden;min-width:28px}
#screen-skuperf .skp-track i{display:block;height:100%;background:var(--accent)}
#screen-skuperf .skp-delta{font-size:10.5px;font-weight:600;padding:1px 6px;border-radius:5px;white-space:nowrap}
#screen-skuperf .skp-delta.up{color:var(--good);background:var(--good-soft)}
#screen-skuperf .skp-delta.down{color:var(--warn);background:var(--warn-soft)}
#screen-skuperf .skp-delta.new{color:var(--accent);background:var(--accent-soft)}
#screen-skuperf .skp-bar{display:flex;height:26px;border-radius:7px;overflow:hidden;border:1px solid var(--line)}
#screen-skuperf .skp-bar>span{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;min-width:7px;color:#fff}
#screen-skuperf .skp-distbar{margin-top:7px}
#screen-skuperf .skp-distbar>span{min-width:12px}
#screen-skuperf .skp-legend{display:flex;gap:13px;flex-wrap:wrap;margin-top:13px;font-size:10.5px;color:var(--ink-soft)}
#screen-skuperf .skp-legend span{display:inline-flex;align-items:center;gap:5px}
#screen-skuperf .skp-sw{width:11px;height:11px;border-radius:3px;display:inline-block}
#screen-skuperf .skp-kpis{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0 16px}
#screen-skuperf .skp-kpi{flex:1;min-width:170px;background:var(--surface-soft);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
#screen-skuperf .skp-kpi-lbl{font-size:11px;color:var(--ink-soft)}
#screen-skuperf .skp-kpi-big{font-size:30px;font-weight:700;line-height:1.05;margin-top:2px;color:var(--ink)}
#screen-skuperf .skp-kpi-big.skp-accent{color:var(--accent)}
#screen-skuperf .skp-kpi-cmp{font-size:11px;margin-top:4px;display:flex;align-items:center;gap:6px;color:var(--ink-faint);flex-wrap:wrap}
#screen-skuperf .skp-cmp{font-weight:600}
#screen-skuperf .skp-cmp.up{color:var(--good)} #screen-skuperf .skp-cmp.down{color:var(--warn)} #screen-skuperf .skp-cmp.flat{color:var(--ink-faint)}
#screen-skuperf .skp-cmp-base{color:var(--ink-faint)}
#screen-skuperf .skp-disthd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
#screen-skuperf .skp-disthd .t{font-size:12.5px;font-weight:600;color:var(--ink)} #screen-skuperf .skp-disthd .r{font-size:10.5px;color:var(--ink-faint)}
#screen-skuperf .skp-foot{font-size:11px;color:var(--ink-soft);line-height:1.55;margin-top:14px;padding-top:11px;border-top:1px solid var(--line)}
#screen-skuperf .skp-foot-last{border-top:0;padding-top:4px}
#screen-skuperf .skp-foot code,#screen-skuperf .skp-quiet code{font-size:10px;background:var(--surface-soft);padding:1px 5px;border-radius:4px;border:1px solid var(--line)}
#screen-skuperf .skp-quiet{font-size:12.5px;color:var(--ink-soft);margin:0}
#screen-skuperf .skp-s-S{background:#dbeafe;color:#17263f!important} #screen-skuperf .skp-s-M{background:#9ec4fb;color:#17263f!important}
#screen-skuperf .skp-s-L{background:#60a5fa} #screen-skuperf .skp-s-XL{background:#3b82f6}
#screen-skuperf .skp-s-XXL{background:#2563eb} #screen-skuperf .skp-s-XXXL{background:#1b3faa}
#screen-skuperf .skp-d2{background:#3b82f6} #screen-skuperf .skp-d3{background:#2563eb} #screen-skuperf .skp-d4{background:#1b3faa} #screen-skuperf .skp-d5{background:#0f254e}
:root[data-theme="dark"] #screen-skuperf .skp-s-S,html:not([data-theme="light"]) #screen-skuperf .skp-s-S{background:#1f3a63;color:#dbe7ff!important}
:root[data-theme="dark"] #screen-skuperf .skp-s-M,html:not([data-theme="light"]) #screen-skuperf .skp-s-M{background:#2a579c;color:#eaf1ff!important}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) #screen-skuperf .skp-s-S{background:#1f3a63;color:#dbe7ff!important}html:not([data-theme="light"]) #screen-skuperf .skp-s-M{background:#2a579c;color:#eaf1ff!important}}
</style>`; }
