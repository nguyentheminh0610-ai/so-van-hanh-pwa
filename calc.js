/* ============================================================
   Dashboard vận hành Shopee & TikTok Shop — calc engine (JS port)
   Ported 1:1 from the Python reference (/tmp/webdash/build/ref_calc.py),
   which was validated line-by-line against the July 2026 known-good figures
   (doanh thu 75,7tr, 590 đơn, 39 lỗi shop, Slove 1.06, Tlove 1.16,
   PiShip 0.33, Voucher extra 3.28, kênh %, CTR/chuyển đổi SP...).
   ============================================================ */

function nfc(s){ return (typeof s === 'string') ? s.normalize('NFC') : s; }

const RE_VN_THOUSANDS = /^-?\d{1,3}(\.\d{3})+$/;
const RE_VN_DECIMAL = /^-?\d{1,3}(\.\d{3})*,\d+$/;

function num(v){
  if (v === null || v === undefined || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (s === '' || s === '-') return 0;
  let isPct = s.endsWith('%');
  if (isPct) s = s.slice(0, -1).trim();
  let s2;
  if (RE_VN_THOUSANDS.test(s)) s2 = s.replace(/\./g, '');
  else if (RE_VN_DECIMAL.test(s)) s2 = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',') && !s.includes('.')) s2 = s.replace(',', '.');
  else s2 = s;
  const f = parseFloat(s2);
  if (isNaN(f)) return 0;
  return isPct ? f / 100 : f;
}

/** sheet -> array of arrays (raw), via SheetJS */
function sheetToAOA(ws){
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
}

/** Build array of row-objects keyed by header row (0-based header index). */
function rowsAsDicts(aoa, headerRowIdx, startRowIdx){
  startRowIdx = (startRowIdx === undefined) ? headerRowIdx + 1 : startRowIdx;
  const hdr = (aoa[headerRowIdx] || []).map(nfc);
  const out = [];
  for (let r = startRowIdx; r < aoa.length; r++){
    const row = aoa[r];
    if (!row || row.every(v => v === null || v === undefined)) continue;
    const d = {};
    for (let i = 0; i < hdr.length; i++){
      if (hdr[i] !== null && hdr[i] !== undefined && i < row.length){
        d[hdr[i]] = nfc(row[i]);
      }
    }
    out.push(d);
  }
  return out;
}

async function readWorkbook(file){
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array', cellDates: false });
}

function getSheet(wb, name){
  if (name && wb.Sheets[name]) return wb.Sheets[name];
  if (name){
    // fallback: try normalized match against sheet names
    const target = nfc(name);
    for (const sn of wb.SheetNames){ if (nfc(sn) === target) return wb.Sheets[sn]; }
  }
  return wb.Sheets[wb.SheetNames[0]];
}

// Chấp cả 2 định dạng ngày gặp trong các file nguồn: "YYYY-MM-DD..." (Shopee)
// và "DD/MM/YYYY..." (TikTok, vd. "Created Time"). Dùng chung bởi cả phần tính
// toán (computeAllFromAOA) lẫn phần tự nhận diện file/tháng (detectFile) bên dưới.
function toDate(v){
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1]);
  return null;
}

// ============================================================
// Tự nhận diện file (sàn + loại báo cáo + tháng) — dùng bởi UI upload
// (init.js) để gộp 7 ô chọn file riêng lẻ thành 1 dropzone duy nhất. Nhận
// diện theo NỘI DUNG file (tên sheet / cột header) là chính vì bắt buộc với
// TikTok (tên file không có ngày thật) và để phân biệt 2 file "income"/tài
// chính của 2 sàn khi tên file trùng nhau; classifyFileName (theo tên file,
// định nghĩa ở init.js) chỉ dùng làm phương án dự phòng khi không đọc được
// nội dung (file lỗi định dạng nhưng tên vẫn gợi ý được loại file).
// ============================================================
const ROLE_META = {
  shopeeOrders: { platform: 'Shopee', label: 'Đơn hàng', required: true },
  shopeeReturnRefund: { platform: 'Shopee', label: 'Trả/hoàn', required: true },
  tiktokOrders: { platform: 'TikTok', label: 'Đơn hàng', required: true },
  tiktokReturns: { platform: 'TikTok', label: 'Trả hàng', required: true },
  income: { platform: 'Shopee', label: 'Tài chính', required: true },
  tiktokFinance: { platform: 'TikTok', label: 'Tài chính', required: true },
  shopStats: { platform: 'Shopee', label: 'Shop Stats', required: false },
  shopeeFailedDelivery: { platform: 'Shopee', label: 'Giao hàng thất bại (khách không nhận)', required: false },
};

// TikTok: tên file KHÔNG có ngày thật (khác Shopee) — không được suy tháng
// từ tên file cho các vai trò này, thà hiển thị "chưa rõ tháng" còn hơn sai.
const NO_FILENAME_MONTH_ROLES = new Set(['tiktokOrders', 'tiktokReturns', 'tiktokFinance']);

function detectRoleFromContent(wb){
  const sheetNames = wb.SheetNames.map(nfc);
  if (sheetNames.includes('OrderSKUList')) return 'tiktokOrders';
  if (sheetNames.includes('Chi tiết đơn hàng')) return 'tiktokFinance';
  if (sheetNames.includes('Đơn Đã Thanh Toán') && sheetNames.some(n => n.startsWith('Theo sản phẩm'))) return 'shopStats';
  if (sheetNames.includes('Doanh thu') && sheetNames.includes('Service Fee Details')) return 'income';

  // Order.all / Order.cancelled / Order.failed_delivery / return_refund của
  // Shopee đều có thể dùng chung tên sheet "orders" — PHẢI phân biệt bằng
  // HEADER trước, tên sheet "orders" chỉ dùng làm phương án CUỐI CÙNG (chỉ còn
  // khớp đúng Order.all, vì file này không có header đặc trưng nào ở trên).
  const firstAOA = sheetToAOA(wb.Sheets[wb.SheetNames[0]]).slice(0, 2);
  const header = new Set((firstAOA[0] || []).map(nfc));

  if (header.has('Phương án') && header.has('Trạng thái Trả hàng/Hoàn tiền')) return 'shopeeReturnRefund';
  // Order.failed_delivery (khách không nhận hàng thật): có "Trạng thái trả hàng"
  // nhưng KHÔNG có "Lý do hủy".
  if (header.has('Trạng thái trả hàng') && !header.has('Lý do hủy')) return 'shopeeFailedDelivery';
  // Order.cancelled (có "Lý do hủy") dư thừa — dữ liệu đã có sẵn trong Order.all —
  // không nhận diện thành vai trò nào, tránh gán nhầm.
  if (header.has('Lý do hủy')) return null;
  if (header.has('Return Type') && header.has('Return Status')) return 'tiktokReturns';
  if (header.has('Order Status') && header.has('Order ID')) return 'tiktokOrders';

  if (sheetNames.includes('orders')) return 'shopeeOrders';
  if (header.has('Trạng Thái Đơn Hàng') && header.has('Mã đơn hàng')) return 'shopeeOrders';

  return null;
}

// Sheet "Báo cáo" trong file tài chính TikTok không phải bảng theo dòng mà là
// các cặp nhãn/giá trị (nhãn ở 1 ô, giá trị ở ô cùng dòng phía bên phải) — dò
// theo nhãn thay vì theo cột cố định vì không biết trước đúng cột.
function findLabeledValue(aoa, labelText){
  const target = nfc(labelText).trim().toLowerCase();
  for (const row of (aoa || [])){
    if (!row) continue;
    const idx = row.findIndex(c => typeof c === 'string' && nfc(c).trim().toLowerCase() === target);
    if (idx === -1) continue;
    for (let i = idx + 1; i < row.length; i++){
      if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== '') return row[i];
    }
  }
  return null;
}

function modeMonthFromDates(values){
  const counts = {};
  for (const v of values){
    const d = toDate(v);
    if (!d) continue;
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    counts[key] = (counts[key] || 0) + 1;
  }
  let best = null, bestCount = 0;
  for (const [k, c] of Object.entries(counts)) if (c > bestCount){ best = k; bestCount = c; }
  if (!best) return null;
  const [y, m] = best.split('-');
  return { monthKey: best, label: 'Tháng ' + parseInt(m, 10) + '/' + y };
}

function detectMonthForRole(role, wb){
  try {
    if (role === 'shopeeOrders'){
      const rows = rowsAsDicts(sheetToAOA(getSheet(wb, 'orders')), 0);
      return modeMonthFromDates(rows.map(r => r['Ngày đặt hàng']));
    }
    if (role === 'shopeeFailedDelivery'){
      const rows = rowsAsDicts(sheetToAOA(getSheet(wb)), 0);
      return modeMonthFromDates(rows.map(r => r['Ngày đặt hàng']));
    }
    if (role === 'shopeeReturnRefund'){
      // Phải lấy đúng cột NGÀY YÊU CẦU TRẢ (không phải "Ngày đặt hàng") — nếu
      // không tìm thấy cột nào phù hợp thì bỏ trống, không đoán bừa.
      const rows = rowsAsDicts(sheetToAOA(getSheet(wb)), 0);
      const candidates = ['Thời gian yêu cầu Trả hàng/Hoàn tiền', 'Ngày yêu cầu Trả hàng/Hoàn tiền', 'Thời gian yêu cầu trả hàng/hoàn tiền'];
      for (const col of candidates){
        if (rows.some(r => r[col] !== undefined)){
          const m = modeMonthFromDates(rows.map(r => r[col]));
          if (m) return m;
        }
      }
      return null;
    }
    if (role === 'tiktokOrders'){
      const rows = rowsAsDicts(sheetToAOA(getSheet(wb, 'OrderSKUList')), 0);
      return modeMonthFromDates(rows.map(r => r['Created Time']));
    }
    if (role === 'tiktokReturns'){
      // Tương tự — lấy ngày yêu cầu/xử lý trả hàng, không có cột ngày đặt
      // hàng trong file này (ngày đặt hàng nằm ở file "tất cả đơn hàng").
      const rows = rowsAsDicts(sheetToAOA(getSheet(wb)), 0);
      const candidates = ['Return Time', 'Return Request Time', 'Request Time', 'Refund Time'];
      for (const col of candidates){
        if (rows.some(r => r[col] !== undefined)){
          const m = modeMonthFromDates(rows.map(r => r[col]));
          if (m) return m;
        }
      }
      return null;
    }
    if (role === 'tiktokFinance'){
      // Sheet "Báo cáo" có dòng "Khoảng thời gian" dạng "2026/06/01-2026/06/30"
      // — lấy tháng từ ngày bắt đầu của khoảng đó.
      const aoa = sheetToAOA(getSheet(wb, 'Báo cáo'));
      const raw = findLabeledValue(aoa, 'Khoảng thời gian');
      if (raw){
        const m = String(raw).match(/^(\d{4})\/(\d{2})\/\d{2}/);
        if (m) return { monthKey: m[1] + '-' + m[2], label: 'Tháng ' + parseInt(m[2], 10) + '/' + m[1] };
      }
      return null;
    }
  } catch (err){
    console.error('detectMonthForRole(' + role + ')', err);
  }
  return null;
}

function detectMonthFromFilename(filename){
  const m = String(filename).match(/(20\d{2})[-_.]?(\d{2})[-_.]?\d{2}/);
  if (m){
    const y = m[1], mo = m[2];
    if (+mo >= 1 && +mo <= 12) return { monthKey: y + '-' + mo, label: 'Tháng ' + parseInt(mo, 10) + '/' + y };
  }
  return null;
}

/** Nhận diện 1 file: đọc workbook, xác định vai trò (role) theo nội dung,
 *  suy ra tháng dữ liệu. Trả về entry hiển thị được ngay trong danh sách
 *  detect-list của UI (init.js), không phụ thuộc DOM. */
async function detectFile(file){
  let wb;
  try {
    wb = await readWorkbook(file);
  } catch (err){
    return {
      file, role: null, platform: null, typeLabel: null, monthKey: null, monthLabel: null,
      readError: 'Không đọc được file (' + err.message + ') — kiểm tra đúng định dạng Excel/CSV.',
    };
  }
  let role = detectRoleFromContent(wb);
  if (!role && typeof classifyFileName === 'function') role = classifyFileName(file.name);
  const meta = role ? ROLE_META[role] : null;
  let monthInfo = role ? detectMonthForRole(role, wb) : null;
  if (!monthInfo && !(role && NO_FILENAME_MONTH_ROLES.has(role))) monthInfo = detectMonthFromFilename(file.name);
  return {
    file, role, platform: meta ? meta.platform : null, typeLabel: meta ? meta.label : null,
    monthKey: monthInfo ? monthInfo.monthKey : null, monthLabel: monthInfo ? monthInfo.label : null,
    readError: null,
  };
}

// ============================================================
// Main computation — takes { shopeeOrders, shopeeReturnRefund, tiktokOrders,
// tiktokReturns, income, tiktokFinance, shopStats } workbook objects (from
// SheetJS XLSX.read), each optional except where noted, returns the full
// metrics object used to render the dashboard.
// ============================================================
async function computeAll(files){
  const wbSp = await readWorkbook(files.shopeeOrders);
  const wbRr = await readWorkbook(files.shopeeReturnRefund);
  const wbTt = await readWorkbook(files.tiktokOrders);
  const wbTr = await readWorkbook(files.tiktokReturns);
  const wbInc = await readWorkbook(files.income);
  const wbFin = await readWorkbook(files.tiktokFinance);
  const wbSs = files.shopStats ? await readWorkbook(files.shopStats) : null;
  const wbFd = files.shopeeFailedDelivery ? await readWorkbook(files.shopeeFailedDelivery) : null;

  const aoa = {
    shopeeOrders: sheetToAOA(getSheet(wbSp, 'orders')),
    shopeeReturnRefund: sheetToAOA(getSheet(wbRr)),
    tiktokOrders: sheetToAOA(getSheet(wbTt, 'OrderSKUList')),
    tiktokReturns: sheetToAOA(getSheet(wbTr)),
    income_DoanhThu: sheetToAOA(getSheet(wbInc, 'Doanh thu')),
    income_ServiceFee: sheetToAOA(getSheet(wbInc, 'Service Fee Details')),
    tiktokFinance: sheetToAOA(getSheet(wbFin, 'Chi tiết đơn hàng')),
    ss_DonDaThanhToan: wbSs ? sheetToAOA(getSheet(wbSs, 'Đơn Đã Thanh Toán')) : null,
    ss_NguonTruyCap: wbSs ? sheetToAOA(getSheet(wbSs, 'Nguồn truy cập cho Đơn hàng...')) : null,
    ss_TheoSanPham: wbSs ? sheetToAOA(getSheet(wbSs, 'Theo sản phẩm (đơn đã đặt)')) : null,
    shopeeFailedDelivery: wbFd ? sheetToAOA(getSheet(wbFd)) : null,
  };
  return computeAllFromAOA(aoa);
}

/** Pure computation over already-parsed AOA (array-of-arrays) sheet data —
 *  no SheetJS/File dependency, so this half is unit-testable in plain Node. */
function computeAllFromAOA(aoa){
  const warnings = [];

  // ---------- 1) Shopee "tất cả đơn hàng" ----------
  const spAOA = aoa.shopeeOrders;
  const spRows = rowsAsDicts(spAOA, 0);
  const spOrders = {};
  for (const r of spRows){
    const oid = r['Mã đơn hàng'];
    if (oid !== undefined && !(oid in spOrders)) spOrders[oid] = r;
  }

  // ---------- 2) Shopee return_refund ----------
  const rrAOA = aoa.shopeeReturnRefund;
  const rrRows = rowsAsDicts(rrAOA, 0);
  const rrOrders = {};
  for (const r of rrRows){
    if (r['Trạng thái Trả hàng/Hoàn tiền'] !== 'Đã hoàn tiền cho Người mua') continue;
    const oid = r['Mã đơn hàng'];
    if (oid !== undefined && !(oid in rrOrders)) rrOrders[oid] = r;
  }
  const spReclassToCancel = {}, spDonTra = {}, spDonHoan = {};
  for (const [oid, r] of Object.entries(rrOrders)){
    const phuongAn = r['Phương án'];
    if (phuongAn === 'Trả hàng & Hoàn tiền') spDonTra[oid] = r;
    else if (phuongAn === 'Hoàn tiền ngay'){
      const lyDo = r['Lí do Trả hàng/Hoàn tiền'] || '';
      if (lyDo.includes('Thiếu hàng')) spDonHoan[oid] = r;
      else spReclassToCancel[oid] = lyDo;
    } else {
      warnings.push('Shopee return_refund: "Phương án" lạ chưa từng thấy: ' + phuongAn);
    }
  }
  const spCancelledNative = {};
  for (const [oid, r] of Object.entries(spOrders)) if (r['Trạng Thái Đơn Hàng'] === 'Đã hủy') spCancelledNative[oid] = r;
  const spCancelAllIds = new Set([...Object.keys(spCancelledNative), ...Object.keys(spReclassToCancel)]);

  const spRefundedIds = new Set([...Object.keys(spDonTra), ...Object.keys(spDonHoan), ...Object.keys(spReclassToCancel)]);
  const spCompleted = {};
  for (const [oid, r] of Object.entries(spOrders)){
    if (r['Trạng Thái Đơn Hàng'] === 'Hoàn thành' && !spRefundedIds.has(oid)) spCompleted[oid] = r;
  }
  const spRevenue = Object.values(spCompleted).reduce((s, r) => s + num(r['Tổng giá trị đơn hàng (VND)']), 0);

  let spPhiSan = 0, spTroGia = 0;
  for (const r of Object.values(spOrders)){
    if (r['Trạng Thái Đơn Hàng'] === 'Đã hủy') continue;
    spPhiSan += num(r['Phí cố định']) + num(r['Phí Dịch Vụ']) + num(r['Phí xử lý giao dịch']);
    spTroGia += num(r['Được Shopee trợ giá']) + num(r['Mã giảm giá của Shopee']) + num(r['Phí vận chuyển tài trợ bởi Shopee (dự kiến)']);
  }
  spPhiSan = Math.abs(spPhiSan);

  const KNOWN_SHOP_ERR_REASONS_SP = [];
  function spIsShopErrorCancel(reason){
    if (!reason) return false;
    if (reason.startsWith('Hủy bởi người bán') && reason.includes('Hết hàng')) return true;
    if (reason.includes('không gửi hàng đúng hạn')) return true;
    if (reason.includes('không xử lý đơn hàng đúng hạn')) return true;
    if (reason.includes('không trả lời thắc mắc')) return true;
    return false;
  }
  const KNOWN_CANCEL_REASONS_SP_ALL = new Set([
    'Hết hàng', 'không gửi hàng đúng hạn', 'không xử lý đơn hàng đúng hạn', 'không trả lời thắc mắc',
    'Thay đổi đơn hàng', 'Muốn nhập/thay đổi mã Voucher', 'Need to change delivery address',
    'Muốn thay đổi sản phẩm trong đơn hàng', 'Đổi ý, không muốn mua nữa', 'Thủ tục thanh toán quá rắc rối',
    'Lý do khác', 'Muốn thay đổi địa chỉ giao hàng', 'Chưa được Thanh Toán', 'Lí do khác', 'Tìm thấy giá rẻ hơn ở chỗ khác'
  ]);
  const spErrCancel = {};
  for (const [oid, r] of Object.entries(spCancelledNative)) if (spIsShopErrorCancel(r['Lý do hủy'])) spErrCancel[oid] = r;
  const spErrHoan = spDonHoan; // "Thiếu hàng" luôn là lỗi shop
  const spErrTra = {};
  for (const [oid, r] of Object.entries(spDonTra)) if ((r['Lí do Trả hàng/Hoàn tiền'] || '').includes('Khác với mô tả')) spErrTra[oid] = r;
  const spErrTotal = Object.keys(spErrCancel).length + Object.keys(spErrHoan).length + Object.keys(spErrTra).length;

  // ---------- 2.5) Shopee Order.failed_delivery (khách không nhận hàng thật) —
  // file tuỳ chọn (các tháng cũ không có), gộp trùng theo Mã đơn hàng vì 1 đơn
  // có thể có nhiều dòng do nhiều SKU.
  const spKhachKhongNhanHangThat = {};
  if (aoa.shopeeFailedDelivery){
    const fdRows = rowsAsDicts(aoa.shopeeFailedDelivery, 0);
    for (const r of fdRows){
      const oid = r['Mã đơn hàng'];
      if (oid !== undefined && !(oid in spKhachKhongNhanHangThat)) spKhachKhongNhanHangThat[oid] = r;
    }
  }

  // đơn hoàn về kho (Shopee) = đổi ý giữa đường (reclass) + khách không nhận hàng thật + đơn trả thật
  const spHoanVeKho = Object.keys(spReclassToCancel).length + Object.keys(spKhachKhongNhanHangThat).length + Object.keys(spDonTra).length;

  // Chi tiết để đối chiếu với file nhập kho thực tế: nên đối theo MÃ ĐƠN / MÃ VẬN
  // ĐƠN, không theo ngày — vì ngày sàn ghi nhận (vd. "hoàn tiền thành công") có
  // thể lệch vài ngày so với ngày hàng thực sự về đến kho (thời gian vận chuyển).
  const spHoanVeKhoDetail = [];
  for (const [oid, r] of Object.entries(spDonTra)){
    spHoanVeKhoDetail.push({
      oid, sanPham: 'Shopee', loai: 'Đơn trả (khách gửi trả hàng)',
      ngay: r['Thời gian hoàn trả hàng thành công'] || null,
      maVanDon: r['Mã vận đơn trả hàng'] || null,
      ngayDatHang: r['Ngày đặt hàng'] || null,
    });
  }
  for (const oid of Object.keys(spReclassToCancel)){
    spHoanVeKhoDetail.push({
      oid, sanPham: 'Shopee', loai: 'Đổi ý giữa đường (huỷ) — có thể đã gửi hàng',
      ngay: null, maVanDon: null,
      ngayDatHang: (rrOrders[oid] && rrOrders[oid]['Ngày đặt hàng']) || null,
    });
  }
  for (const [oid, r] of Object.entries(spKhachKhongNhanHangThat)){
    spHoanVeKhoDetail.push({
      oid, sanPham: 'Shopee', loai: 'Khách không nhận hàng thật',
      ngay: r['Ngày đặt hàng'] || null,
      maVanDon: r['Mã vận đơn'] || null,
      ngayDatHang: r['Ngày đặt hàng'] || null,
    });
  }

  // ---------- 3) TikTok "tất cả đơn hàng" ----------
  const ttAOA = aoa.tiktokOrders;
  const ttRows = rowsAsDicts(ttAOA, 0);
  const ttOrders = {};
  for (const r of ttRows){
    const oid = r['Order ID'];
    if (oid === undefined || oid === null || r['Order Status'] === 'Current order status.') continue;
    if (!(oid in ttOrders)) ttOrders[oid] = r;
  }

  // ---------- 4) TikTok trả hàng ----------
  // NOTE: mỗi dòng ở đây là 1 "Return Order ID" (yêu cầu trả hàng), có thể khác
  // với "Order ID" gốc (đơn hàng ban đầu, dùng chung với file "tất cả đơn hàng").
  // Một đơn nhiều SKU có thể phát sinh NHIỀU dòng "Return Order ID" khác nhau
  // nhưng CÙNG "Order ID" — dedup theo Order ID (không phải Return Order ID) để
  // đếm ở cấp ĐƠN HÀNG, đúng như cách Shopee đếm theo "Mã đơn hàng". Nếu 1 Order
  // ID có nhiều dòng Completed (vd. mỗi SKU trả riêng, hoặc 1 SKU bị từ chối rồi
  // gửi lại), ưu tiên dòng "Return and refund" (hàng thực sự gửi trả) hơn
  // "Refund only" (không có hàng vật lý quay lại) vì mục đích đối chiếu kho.
  const trAOA = aoa.tiktokReturns;
  const trRows = rowsAsDicts(trAOA, 0);
  const trOrders = {};
  const trMultiOids = new Set();
  for (const r of trRows){
    if (r['Return Status'] !== 'Completed') continue;
    const oid = r['Order ID'];
    if (oid === undefined) continue;
    if (!(oid in trOrders)){
      trOrders[oid] = r;
    } else {
      trMultiOids.add(oid);
      if (r['Return Type'] === 'Return and refund' && trOrders[oid]['Return Type'] !== 'Return and refund'){
        trOrders[oid] = r;
      }
    }
  }
  if (trMultiOids.size){
    warnings.push(`TikTok trả hàng: ${trMultiOids.size} đơn có nhiều dòng "Completed" (có thể do trả nhiều SKU trong cùng 1 đơn, hoặc gửi lại yêu cầu) — đã gộp về 1 đơn theo Order ID, ưu tiên "Return and refund". Mã đơn: ${[...trMultiOids].join(', ')}`);
  }
  const ttDonTra = {}, ttDonHoan = {};
  for (const [oid, r] of Object.entries(trOrders)){
    if (r['Return Type'] === 'Return and refund') ttDonTra[oid] = r;
    else if (r['Return Type'] === 'Refund only') ttDonHoan[oid] = r;
    else warnings.push('TikTok trả hàng: "Return Type" lạ: ' + r['Return Type']);
  }
  const ttCancelledNative = {};
  for (const [oid, r] of Object.entries(ttOrders)) if (r['Order Status'] === 'Đã hủy') ttCancelledNative[oid] = r;

  const ttRefundedIds = new Set([...Object.keys(ttDonTra), ...Object.keys(ttDonHoan)]);
  const ttCompleted = {};
  for (const [oid, r] of Object.entries(ttOrders)){
    if (r['Order Status'] === 'Đã hoàn tất' && !ttRefundedIds.has(oid)) ttCompleted[oid] = r;
  }
  const ttRevenue = Object.values(ttCompleted).reduce((s, r) => s + num(r['Order Amount']), 0);

  // ---------- 5) TikTok tài chính — Chi tiết đơn hàng ----------
  const finAOA = aoa.tiktokFinance;
  const finRows = rowsAsDicts(finAOA, 0);
  const finOrderRows = finRows.filter(r => r['Loại giao dịch'] === 'Đơn hàng');
  let ttPhiSan = 0, ttTroGia = 0;
  for (const r of finOrderRows){
    const hoaHong = r['Phí hoa hồng của TikTok Shop'] !== undefined ? r['Phí hoa hồng của TikTok Shop'] : r['Phí hoa hồng TikTok Shop'];
    ttPhiSan += num(r['Phí xử lý đơn hàng']) + num(r['Phí giao dịch']) + num(hoaHong);
    ttTroGia += num(r['Giảm giá của nền tảng']) + Math.abs(num(r['TikTok Shop giảm phí vận chuyển cho khách hàng']));
  }
  ttPhiSan = Math.abs(ttPhiSan);

  function ttIsShopErrorCancel(reason){
    if (!reason) return false;
    if (reason.includes('Giao gói hàng thất bại')) return true;
    if (reason.includes('Người bán không trả lời thắc mắc')) return true;
    if (reason.includes('Người bán yêu cầu hủy đơn hàng') || reason.includes('Người bán yêu cầu huỷ')) return true;
    return false;
  }
  const ttErrCancel = {};
  for (const [oid, r] of Object.entries(ttCancelledNative)) if (ttIsShopErrorCancel(r['Cancel Reason'])) ttErrCancel[oid] = r;
  const ttErrTraHoan = {};
  for (const [oid, r] of Object.entries({ ...ttDonTra, ...ttDonHoan })){
    if ((r['Return Reason'] || '').toLowerCase().includes('match description')) ttErrTraHoan[oid] = r;
  }
  const ttErrTotal = Object.keys(ttErrCancel).length + Object.keys(ttErrTraHoan).length;

  // đơn hoàn về kho (TikTok) = huỷ có Shipped Time có giá trị + đơn trả thật
  let ttHuyDaGui = 0;
  for (const r of Object.values(ttCancelledNative)){
    const st = r['Shipped Time'];
    if (st !== null && st !== undefined && String(st).trim() !== '') ttHuyDaGui++;
  }
  const ttHoanVeKho = ttHuyDaGui + Object.keys(ttDonTra).length;

  const ttHoanVeKhoDetail = [];
  for (const [oid, r] of Object.entries(ttCancelledNative)){
    const st = r['Shipped Time'];
    if (st !== null && st !== undefined && String(st).trim() !== ''){
      ttHoanVeKhoDetail.push({ oid, sanPham: 'TikTok', loai: 'Huỷ sau khi đã gửi hàng', ngay: st, maVanDon: null, ngayDatHang: r['Created Time'] || null });
    }
  }
  for (const [oid, r] of Object.entries(ttDonTra)){
    // file "TikTok trả hàng" không có cột ngày tạo đơn — lấy chéo từ file "tất cả đơn hàng" theo Order ID
    const ngayDatHang = (ttOrders[oid] && ttOrders[oid]['Created Time']) || null;
    ttHoanVeKhoDetail.push({
      oid, sanPham: 'TikTok', loai: 'Đơn trả (khách gửi trả hàng)',
      ngay: r['Refund Time'] || null, maVanDon: r['Return Logistics Tracking ID'] || null,
      ngayDatHang,
    });
  }

  // ---------- 6) Income (Shopee) — Doanh thu (header ở dòng index 2) ----------
  const incAOA = aoa.income_DoanhThu;
  const incRows = rowsAsDicts(incAOA, 2);
  const incOrderRows = incRows.filter(r => r['Đơn hàng / Sản phẩm'] === 'Order');
  let piShipPhi = 0, piShipHoan = 0;
  for (const r of incOrderRows){
    piShipPhi += Math.abs(num(r['Phí dịch vụ PiShip']));
    piShipHoan += Math.abs(num(r['Phí vận chuyển được hoàn bởi PiShip']));
  }
  const piShipRatio = piShipPhi ? piShipHoan / piShipPhi : 0;

  // ---------- 7) Income — Service Fee Details (Voucher Xtra) ----------
  const sfdAOA = aoa.income_ServiceFee;
  const sfdRows = rowsAsDicts(sfdAOA, 1);
  const voucherXtraTotal = sfdRows.reduce((s, r) => s + Math.abs(num(r['Voucher Xtra'])), 0);

  // ---------- 8) Slove / Tlove ----------
  const sloveHotro = spTroGia, slovePhi = spPhiSan + piShipPhi;
  const slove = slovePhi ? sloveHotro / slovePhi : 0;
  const tloveHotro = ttTroGia, tlovePhi = ttPhiSan;
  const tlove = tlovePhi ? tloveHotro / tlovePhi : 0;

  // ---------- 9) ShopStats — Voucher extra / kênh / sản phẩm ----------
  let voucherExtra = null, kenh = null, sanPham = null, ssWarning = null;
  if (aoa.ss_DonDaThanhToan){
    const paidAOA = aoa.ss_DonDaThanhToan;
    const hdrPaid = (paidAOA[0] || []).map(nfc);
    const rowPaid = (paidAOA[1] || []).map(nfc);
    const paid = {}; hdrPaid.forEach((h, i) => { if (h) paid[h] = rowPaid[i]; });
    const tongDoanhSo = num(paid['Tổng doanh số (VND)']);
    const doanhSoKhongTroGia = num(paid['Doanh số không bao gồm trợ giá bởi Shopee']);
    const shopeeTroGia = tongDoanhSo - doanhSoKhongTroGia;
    voucherExtra = voucherXtraTotal ? shopeeTroGia / voucherXtraTotal : 0;

    const chanAOA = aoa.ss_NguonTruyCap;
    const hdrChan = (chanAOA[0] || []).map(nfc);
    const rowChan = (chanAOA[1] || []).map(nfc);
    const chan = {}; hdrChan.forEach((h, i) => { if (h) chan[h] = rowChan[i]; });
    const doanhSoTotal = num(chan['Doanh số (VND)']);
    kenh = {
      total: doanhSoTotal,
      theSanPham: num(chan['Doanh thu từ thẻ sản phẩm']),
      livestream: num(chan['Doanh thu từ Livestream của người bán']),
      video: num(chan['Doanh thu từ Video của người bán']),
      tiepThiLienKet: num(chan['Doanh thu từ đối tác liên kết']),
    };

    const prodAOA = aoa.ss_TheoSanPham;
    const hdrProd = (prodAOA[4] || []).map(nfc); // header row index 4 (0-based) = spec row 5 (1-based)
    // NOTE: this block's header row has "Sản phẩm" TWICE — col1 (product name)
    // and col8 (a different sub-metric) — a name->value dict would let the
    // second occurrence silently clobber the first, so pull columns 1/9/10/4
    // positionally by their fixed index instead of by (colliding) header name.
    sanPham = [];
    for (let r = 5; r < prodAOA.length; r++){
      const row = prodAOA[r];
      if (!row || row.every(v => v === null || v === undefined)) break;
      sanPham.push({
        ten: nfc(row[1]),
        ctr: num(row[9]),
        chuyenDoi: num(row[10]),
        doanhSo: num(row[4]),
      });
    }
  } else {
    ssWarning = 'Chưa tải file Shop Stats (file thứ 8) — bỏ qua Voucher extra, Doanh thu theo kênh, Hiệu suất sản phẩm.';
  }

  // ---------- reasons table (lý do lỗi shop, chi tiết theo lý do gốc) ----------
  function countReasons(map, reasonKey, platform){
    const out = {};
    for (const r of Object.values(map)){
      let reason = r[reasonKey] || '(không rõ)';
      out[reason] = (out[reason] || 0) + 1;
    }
    return Object.entries(out).map(([reason, count]) => ({ reason, platform, count }));
  }
  const reasonRows = [
    ...countReasons(spErrCancel, 'Lý do hủy', 'Shopee'),
    ...(Object.keys(spErrHoan).length ? [{ reason: 'Thiếu hàng', platform: 'Shopee', count: Object.keys(spErrHoan).length }] : []),
    ...(Object.keys(spErrTra).length ? [{ reason: 'Khác với mô tả', platform: 'Shopee', count: Object.keys(spErrTra).length }] : []),
    ...countReasons(ttErrCancel, 'Cancel Reason', 'TikTok'),
    ...(Object.keys(ttErrTraHoan).length ? [{ reason: 'Không đúng mô tả', platform: 'TikTok', count: Object.keys(ttErrTraHoan).length }] : []),
  ];

  // ---------- date range detected (for display only) ----------
  // (toDate() đã tách lên top-level phía trên, dùng chung với detectFile())
  let minDate = null, maxDate = null;
  for (const r of Object.values(spOrders)){
    const d = toDate(r['Ngày đặt hàng']);
    if (d && (!minDate || d < minDate)) minDate = d;
    if (d && (!maxDate || d > maxDate)) maxDate = d;
  }

  // ---------- doanh thu theo ngày (Shopee/TikTok) — để xem xu hướng trong kỳ,
  // khác với các chỉ số khác (vd. hoàn về kho) vốn chỉ cần xem theo tháng/kỳ.
  // Gộp theo ngày đặt hàng (Shopee: "Ngày đặt hàng", TikTok: "Created Time") —
  // cùng field đã dùng để xác định minDate/maxDate ở trên, cho nhất quán.
  function dayKey(d){
    if (!d) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const dailyMap = {};
  function addDaily(dateVal, field, amount){
    const d = toDate(dateVal);
    const k = dayKey(d);
    if (!k) return;
    if (!dailyMap[k]) dailyMap[k] = { date: k, shopee: 0, tiktok: 0 };
    dailyMap[k][field] += amount;
  }
  for (const r of Object.values(spCompleted)) addDaily(r['Ngày đặt hàng'], 'shopee', num(r['Tổng giá trị đơn hàng (VND)']));
  for (const r of Object.values(ttCompleted)) addDaily(r['Created Time'], 'tiktok', num(r['Order Amount']));
  const dailyRevenue = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // Đánh dấu các đơn "hoàn về kho" mà NGÀY ĐẶT HÀNG rơi ra ngoài khoảng kỳ báo
  // cáo hiện tại (thường là do khách đặt cuối kỳ trước, yêu cầu trả trong kỳ
  // này) — để chủ shop biết số "hoàn về kho" của kỳ này có bao nhiêu đơn thực
  // ra thuộc về 1 kỳ đặt hàng khác, phục vụ đối chiếu theo đúng kỳ đặt hàng.
  const hoanVeKhoDetailAll = [...spHoanVeKhoDetail, ...ttHoanVeKhoDetail];
  for (const item of hoanVeKhoDetailAll){
    const d = toDate(item.ngayDatHang);
    item.ngoaiKy = !!(d && minDate && maxDate && (d < minDate || d > maxDate));
  }
  const hoanVeKhoNgoaiKyCount = hoanVeKhoDetailAll.filter(x => x.ngoaiKy).length;

  const tongDon = Object.keys(spOrders).length + Object.keys(ttOrders).length;
  const spHuyHoanTra = spCancelAllIds.size + Object.keys(spDonTra).length + Object.keys(spDonHoan).length;
  const ttHuyHoanTra = Object.keys(ttCancelledNative).length + Object.keys(ttDonTra).length + Object.keys(ttDonHoan).length;

  return {
    warnings, ssWarning, minDate, maxDate,
    shopee: {
      tongDon: Object.keys(spOrders).length, hoanThanh: Object.keys(spCompleted).length,
      doanhThu: spRevenue, phiSan: spPhiSan, troGia: spTroGia, doanhThuRong: spRevenue - spPhiSan,
      huy: spCancelAllIds.size, tra: Object.keys(spDonTra).length, hoan: Object.keys(spDonHoan).length,
      huyHoanTra: spHuyHoanTra, loiShop: spErrTotal, hoanVeKho: spHoanVeKho,
      aov: Object.keys(spCompleted).length ? spRevenue / Object.keys(spCompleted).length : 0,
    },
    tiktok: {
      tongDon: Object.keys(ttOrders).length, hoanThanh: Object.keys(ttCompleted).length,
      doanhThu: ttRevenue, phiSan: ttPhiSan, troGia: ttTroGia, doanhThuRong: ttRevenue - ttPhiSan,
      huy: Object.keys(ttCancelledNative).length, tra: Object.keys(ttDonTra).length, hoan: Object.keys(ttDonHoan).length,
      huyHoanTra: ttHuyHoanTra, loiShop: ttErrTotal, hoanVeKho: ttHoanVeKho,
      aov: Object.keys(ttCompleted).length ? ttRevenue / Object.keys(ttCompleted).length : 0,
    },
    tong: {
      doanhThu: spRevenue + ttRevenue, tongDon, hoanThanh: Object.keys(spCompleted).length + Object.keys(ttCompleted).length,
      phiSan: spPhiSan + ttPhiSan, doanhThuRong: (spRevenue - spPhiSan) + (ttRevenue - ttPhiSan),
      aov: (Object.keys(spCompleted).length + Object.keys(ttCompleted).length) ? (spRevenue + ttRevenue) / (Object.keys(spCompleted).length + Object.keys(ttCompleted).length) : 0,
      huyHoanTra: spHuyHoanTra + ttHuyHoanTra, tyLeHuyHoanTra: tongDon ? (spHuyHoanTra + ttHuyHoanTra) / tongDon : 0,
      loiShop: spErrTotal + ttErrTotal, tyLeLoiShop: tongDon ? (spErrTotal + ttErrTotal) / tongDon : 0,
      hoanVeKho: spHoanVeKho + ttHoanVeKho,
    },
    nhanh4: { slove, tlove, piShipRatio, voucherExtra },
    reasonRows,
    hoanVeKhoDetail: hoanVeKhoDetailAll, hoanVeKhoNgoaiKyCount,
    dailyRevenue,
    kenh, sanPham,
  };
}
