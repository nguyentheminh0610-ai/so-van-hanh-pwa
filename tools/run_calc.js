#!/usr/bin/env node
/* Bộ kiểm 1 tháng mẫu: chạy computeAllFromAOA (calc.js) bằng Node trên dữ liệu
   aoa.json đã chuyển từ file gốc (tools/xlsx_to_aoa.py), in các số chính để so
   với mốc chuẩn (tháng 7/2026: doanh thu 75,7tr / 590 đơn...).

   Cách dùng:
     ELECTRON_RUN_AS_NODE=1 "/Applications/Visual Studio Code.app/Contents/MacOS/Code" \
       tools/run_calc.js <aoa.json> [--json]
*/
const fs = require('fs');
const path = require('path');

// calc.js viết cho trình duyệt (không export) — nạp bằng eval trong scope này.
// XLSX chỉ dùng trong computeAll/detectFile (không gọi ở đây) nên không cần.
const calcSrc = fs.readFileSync(path.join(__dirname, '..', 'calc.js'), 'utf8');
(0, eval)(calcSrc + '\n;globalThis.__computeAllFromAOA = computeAllFromAOA;');

const aoaPath = process.argv[2];
const asJson = process.argv.includes('--json');
const aoa = JSON.parse(fs.readFileSync(aoaPath, 'utf8'));

// Nạp sku-catalog.json nếu có (bảng SKU + combo sinh từ API Sapo) — giống
// init.js nạp trước khi tính trên trình duyệt.
try {
  globalThis.SKU_CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'sku-catalog.json'), 'utf8'));
} catch (e) { /* chưa có catalog — calc.js tự dùng bảng dự phòng */ }
try {
  globalThis.COST_CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cost-catalog.json'), 'utf8'));
} catch (e) { /* chưa có giá vốn — pnl phần giá vốn sẽ là null */ }

const origLog = console.log; console.log = () => {}; // tắt debug log của calc
const res = globalThis.__computeAllFromAOA(aoa);
console.log = origLog;

if (asJson){
  console.log(JSON.stringify(res));
} else {
  const f = (n) => n === null || n === undefined ? '—' : Math.round(n).toLocaleString('vi-VN');
  const line = (name, v) => console.log(name.padEnd(34), v);
  console.log('=== KẾT QUẢ', path.basename(aoaPath), '===');
  for (const p of ['shopee', 'tiktok']){
    const d = res[p];
    console.log('--- ' + p + ' ---');
    line('  tổng đơn / hoàn thành', f(d.tongDon) + ' / ' + f(d.hoanThanh));
    line('  doanh thu', f(d.doanhThu));
    if (d.doanhThuCu !== undefined) line('  doanh thu (công thức cũ)', f(d.doanhThuCu));
    if (d.gmvDat !== undefined) line('  GMV đặt', f(d.gmvDat));
    if (d.thucNhan !== undefined) line('  thực nhận', f(d.thucNhan));
    line('  phí sàn', f(d.phiSan));
    if (d.phiSanChiTiet) for (const [k, v] of Object.entries(d.phiSanChiTiet)) line('    phí: ' + k, f(v));
    line('  huỷ / trả / hoàn', f(d.huy) + ' / ' + f(d.tra) + ' / ' + f(d.hoan));
    line('  lỗi shop / hoàn về kho', f(d.loiShop) + ' / ' + f(d.hoanVeKho));
  }
  console.log('--- tổng ---');
  line('  doanh thu 2 sàn', f(res.tong.doanhThu));
  if (res.tong.thucNhan !== undefined) line('  thực nhận 2 sàn', f(res.tong.thucNhan));
  line('  tổng đơn', f(res.tong.tongDon));
  line('  Slove/Tlove/PiShip/VoucherX',
    [res.nhanh4.slove, res.nhanh4.tlove, res.nhanh4.piShipRatio, res.nhanh4.voucherExtra]
      .map(x => x === null || x === undefined ? '—' : (Math.round(x * 100) / 100)).join(' / '));
  const sku = res.skuPerformance && res.skuPerformance.items ? res.skuPerformance.items : [];
  line('  SKU có trong bảng hiệu suất', sku.length + ' mã, tổng SL ' + f(sku.reduce((s, x) => s + x.tongSL, 0)));
  if (res.pnl){
    console.log('--- P&L ---');
    line('  doanh thu hàng', f(res.pnl.doanhThu));
    line('  giá vốn hàng bán', f(res.pnl.giaVonHangBan) + (res.pnl.thieuGiaVonSL ? ' (thiếu giá vốn ' + res.pnl.thieuGiaVonSL + ' sp)' : ''));
    line('  LÃI GỘP', f(res.pnl.laiGop));
    line('  phí sàn', f(res.pnl.phiSan));
    line('  quảng cáo GMV Max', f(res.pnl.quangCaoGmvMax));
    line('  LÃI SAU PHÍ SÀN & QC', f(res.pnl.laiSauPhiSan));
    console.log('--- lãi gộp theo SP (top 8 doanh thu) ---');
    sku.slice().sort((a, b) => (b.doanhThu || 0) - (a.doanhThu || 0)).slice(0, 8).forEach(x => {
      line('  ' + x.ten.slice(0, 26), 'DT ' + f(x.doanhThu) + ' | vốn ' + f(x.giaVon) + ' | lãi gộp ' + (x.laiGop === null ? '— (thiếu giá vốn)' : f(x.laiGop)));
    });
  }
  console.log('--- cảnh báo (' + res.warnings.length + ') ---');
  for (const w of res.warnings) console.log('  ⚠', w.length > 160 ? w.slice(0, 157) + '…' : w);
}
