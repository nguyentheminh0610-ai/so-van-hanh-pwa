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

/** Chuỗi tiền TikTok kiểu "1.234.567₫" (Video Analysis) — bỏ ký hiệu ₫ rồi
 *  tái dùng num() để parse (đã tự xử lý dấu chấm ngăn cách nghìn kiểu VN). */
function parseVndCurrency(v){
  if (v === null || v === undefined) return 0;
  return num(String(v).replace(/₫/g, '').trim());
}

/** Chuẩn hoá tên tỉnh/thành để gộp 2 sàn: Shopee ghi "Thành phố Hồ Chí Minh" /
 *  "Tỉnh Đồng Nai", TikTok ghi "Hồ Chí Minh" / "Đồng Nai" (không tiền tố). */
function normalizeTinhThanh(raw){
  if (!raw || typeof raw !== 'string') return 'Không rõ';
  return raw.replace(/^Thành phố\s+/, '').replace(/^Tỉnh\s+/, '').trim() || 'Không rõ';
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
  tiktokAffiliateOrders: { platform: 'TikTok', label: 'Affiliate Orders', required: false },
  tiktokVideoAnalysis: { platform: 'TikTok', label: 'Video Analysis', required: false },
  tiktokCreatorList: { platform: 'TikTok', label: 'Creator List (Transaction Analysis)', required: false },
  tiktokLiveList: { platform: 'TikTok', label: 'Live List (Transaction Analysis)', required: false },
};

// TikTok: tên file KHÔNG có ngày thật (khác Shopee) — không được suy tháng
// từ tên file cho các vai trò này, thà hiển thị "chưa rõ tháng" còn hơn sai.
// tiktokAffiliateOrders/tiktokVideoAnalysis/tiktokCreatorList/tiktokLiveList:
// phần đuôi số trong tên file chỉ là ID/khoảng ngày XUẤT file, không phải
// mốc tháng dữ liệu — các role này không dùng để xác định tháng của kỳ báo
// cáo (tháng do file đơn hàng/tài chính chính quyết định như hiện tại).
const NO_FILENAME_MONTH_ROLES = new Set(['tiktokOrders', 'tiktokReturns', 'tiktokFinance', 'tiktokAffiliateOrders', 'tiktokVideoAnalysis', 'tiktokCreatorList', 'tiktokLiveList']);

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
  // LƯU Ý: không loại Order.cancelled bằng header('Lý do hủy') ở đây — Order.all
  // (liệt kê TẤT CẢ đơn hàng, kể cả đơn đã huỷ) cũng có sẵn cột này nên bị loại
  // nhầm theo. Order.cancelled được loại theo TÊN FILE trong detectFile() bên dưới.
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
      // Ưu tiên "Time Requested" — tên cột thật trong file "Trả hàng" TikTok
      // hiện tại (xác nhận từ file mẫu thực tế): ngày người mua YÊU CẦU trả
      // hàng, đúng bản chất tháng của giao dịch trả hàng. "Refund Time"
      // (ngày hoàn tiền xong) có thể rơi sang tháng sau với đơn xử lý gần
      // cuối tháng, gây tính nhầm tháng cho vài đơn ở biên giới tháng — nên
      // chỉ dùng làm dự phòng cuối cùng. Các tên còn lại giữ lại làm dự
      // phòng cho các phiên bản export khác có thể đặt tên khác.
      const rows = rowsAsDicts(sheetToAOA(getSheet(wb)), 0);
      const candidates = ['Time Requested', 'Return Time', 'Return Request Time', 'Request Time', 'Refund Time'];
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

/** Nhận diện 1 file: xác định vai trò (role) chủ yếu theo TÊN FILE
 *  (classifyFileName, định nghĩa ở init.js) — tên file các sàn xuất ra khá rõ
 *  ràng/đáng tin cậy. Chỉ đọc thêm NỘI DUNG file để xác nhận đúng 1 trường
 *  hợp: phân biệt Income (Shopee) với Tài chính (TikTok) khi 2 file trùng
 *  tên gần giống hệt nhau (dạng income_...(UTC+7).xlsx, không có chữ nào cho
 *  biết là sàn nào). Trả về entry hiển thị được ngay trong danh sách
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
  let role = classifyFileName(file.name);
  if (role === 'income'){
    const contentRole = detectRoleFromContent(wb);
    if (contentRole === 'tiktokFinance') role = 'tiktokFinance';
  } else if (!role && !stripDiacritics(file.name).includes('cancelled')){
    // Order.cancelled: classifyFileName đã CỐ TÌNH trả về null (dư thừa, không
    // thể phân biệt Order.all bằng nội dung vì cả 2 đều có cột "Lý do hủy") —
    // không được rơi về content-detect ở đây, kẻo bị chốt nhầm lại shopeeOrders.
    role = detectRoleFromContent(wb);
  }
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
  const wbAff = files.tiktokAffiliateOrders ? await readWorkbook(files.tiktokAffiliateOrders) : null;
  const wbVid = files.tiktokVideoAnalysis ? await readWorkbook(files.tiktokVideoAnalysis) : null;
  const wbCreatorList = files.tiktokCreatorList ? await readWorkbook(files.tiktokCreatorList) : null;
  const wbLiveList = files.tiktokLiveList ? await readWorkbook(files.tiktokLiveList) : null;

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
    tiktokAffiliateOrders: wbAff ? sheetToAOA(getSheet(wbAff)) : null,
    tiktokVideoAnalysis: wbVid ? sheetToAOA(getSheet(wbVid)) : null,
    tiktokCreatorList: wbCreatorList ? sheetToAOA(getSheet(wbCreatorList)) : null,
    tiktokLiveList: wbLiveList ? sheetToAOA(getSheet(wbLiveList)) : null,
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
  // Trước đây so khớp CỨNG đúng tên cột (vd. "Loại giao dịch" === 'Đơn hàng',
  // r['Phí xử lý đơn hàng']...) nên chỉ cần TikTok đổi nhẹ tên cột (thêm
  // khoảng trắng, đổi cách dịch, viết hoa/thường khác) là toàn bộ Tổng chi phí
  // sàn/Tlove TikTok ra sai hoặc = 0 mà không có cảnh báo rõ ràng (chỉ có
  // console.log ẩn, chủ shop không thấy). Sửa: dò cột theo TỪ KHOÁ (regex,
  // không cần khớp tuyệt đối) trên header thật đọc được, và nếu vẫn không dò
  // được cột nào thì cảnh báo NGAY trên dashboard (mục cảnh báo) kèm danh sách
  // header thật, thay vì âm thầm trả về 0.
  const finAOA = aoa.tiktokFinance;
  const finRows = rowsAsDicts(finAOA, 0);
  const finHeaderKeys = finRows.length ? Object.keys(finRows[0]) : ((finAOA[0] || []).map(nfc).filter(v => v !== null && v !== undefined && v !== ''));

  function findColKey(headerKeys, patterns){
    for (const p of patterns){
      const hit = headerKeys.find(k => p.test(String(k || '').trim()));
      if (hit) return hit;
    }
    return null;
  }

  const COL_LOAI_GD = findColKey(finHeaderKeys, [/^loại\s*giao\s*dịch$/i, /loại.*giao.*dịch/i]);
  const COL_PHI_XU_LY = findColKey(finHeaderKeys, [/phí.*xử\s*lý.*đơn/i]);
  const COL_PHI_GIAO_DICH = findColKey(finHeaderKeys, [/^phí\s*giao\s*dịch$/i, /^phí\s*giao\s*dịch\b/i]);
  const COL_HOA_HONG = findColKey(finHeaderKeys, [/phí.*hoa\s*hồng/i, /hoa\s*hồng.*tiktok/i]);
  const COL_GIAM_GIA_NEN_TANG = findColKey(finHeaderKeys, [/giảm\s*giá.*nền\s*tảng/i]);
  const COL_GIAM_PHI_VC = findColKey(finHeaderKeys, [/tiktok.*giảm.*phí.*vận\s*chuyển/i, /giảm.*phí.*vận\s*chuyển.*khách/i]);

  const missingFinCols = [];
  if (!COL_LOAI_GD) missingFinCols.push('"Loại giao dịch"');
  if (!COL_PHI_XU_LY) missingFinCols.push('"Phí xử lý đơn hàng"');
  if (!COL_PHI_GIAO_DICH) missingFinCols.push('"Phí giao dịch"');
  if (!COL_HOA_HONG) missingFinCols.push('"Phí hoa hồng của TikTok Shop"');
  if (!COL_GIAM_GIA_NEN_TANG) missingFinCols.push('"Giảm giá của nền tảng"');
  if (!COL_GIAM_PHI_VC) missingFinCols.push('"TikTok Shop giảm phí vận chuyển cho khách hàng"');

  const finOrderRows = COL_LOAI_GD ? finRows.filter(r => String(r[COL_LOAI_GD] || '').trim() === 'Đơn hàng') : [];
  let ttPhiSan = 0, ttTroGia = 0;
  for (const r of finOrderRows){
    ttPhiSan += num(COL_PHI_XU_LY ? r[COL_PHI_XU_LY] : 0) + num(COL_PHI_GIAO_DICH ? r[COL_PHI_GIAO_DICH] : 0) + num(COL_HOA_HONG ? r[COL_HOA_HONG] : 0);
    ttTroGia += num(COL_GIAM_GIA_NEN_TANG ? r[COL_GIAM_GIA_NEN_TANG] : 0) + Math.abs(num(COL_GIAM_PHI_VC ? r[COL_GIAM_PHI_VC] : 0));
  }
  ttPhiSan = Math.abs(ttPhiSan);

  if (missingFinCols.length){
    warnings.push(`Phí sàn TikTok (Tổng chi phí sàn / Tlove): không tìm thấy cột ${missingFinCols.join(', ')} trong sheet "Chi tiết đơn hàng" (file TikTok - Tài chính) — số liệu này có thể SAI hoặc =0. Các cột thực đọc được từ file: ${finHeaderKeys.length ? finHeaderKeys.join(' | ') : '(không đọc được dòng/cột nào)'}.`);
  } else if (finOrderRows.length === 0){
    warnings.push('Phí sàn TikTok (Tổng chi phí sàn / Tlove): tìm thấy cột "Loại giao dịch" nhưng không có dòng nào = "Đơn hàng" — kiểm tra lại có đúng file/tháng TikTok - Tài chính không.');
  }
  // Debug Tlove — vẫn giữ ở console để đối chiếu nhanh khi cần (F12 > Console).
  console.log('[debug Tlove] cột dò được:', { COL_LOAI_GD, COL_PHI_XU_LY, COL_PHI_GIAO_DICH, COL_HOA_HONG, COL_GIAM_GIA_NEN_TANG, COL_GIAM_PHI_VC });
  console.log('[debug Tlove] finRows.length=', finRows.length, 'finOrderRows.length=', finOrderRows.length,
    'header thực tế đọc được:', finHeaderKeys);
  console.log('[debug Tlove] ttTroGia (tử số — Chi phí sàn đã hỗ trợ) =', ttTroGia,
    '| ttPhiSan (mẫu số — Tổng chi phí sàn) =', ttPhiSan, '| tlove =', ttPhiSan ? ttTroGia / ttPhiSan : 0);

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
  let shopeeTroGiaForVoucher = null; // lộ ra ngoài (raw) để gộp nhiều tháng chính xác — xem combineMonthlyResults()
  if (aoa.ss_DonDaThanhToan){
    const paidAOA = aoa.ss_DonDaThanhToan;
    const hdrPaid = (paidAOA[0] || []).map(nfc);
    const rowPaid = (paidAOA[1] || []).map(nfc);
    const paid = {}; hdrPaid.forEach((h, i) => { if (h) paid[h] = rowPaid[i]; });
    const tongDoanhSo = num(paid['Tổng doanh số (VND)']);
    const doanhSoKhongTroGia = num(paid['Doanh số không bao gồm trợ giá bởi Shopee']);
    const shopeeTroGia = tongDoanhSo - doanhSoKhongTroGia;
    shopeeTroGiaForVoucher = shopeeTroGia;
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

  // ---------- Khách hàng theo khu vực (tỉnh/thành) — chỉ đếm SL đơn, gộp 2 sàn ----------
  // Đếm trên CÙNG tập đơn đã dedup dùng cho "SL đơn" tổng (spOrders + ttOrders),
  // không phân biệt trạng thái đơn — nên tổng các lát LUÔN = tong.tongDon.
  console.log('[debug KhuVuc] Shopee "Tỉnh/Thành phố" (5 dòng đầu):', Object.values(spOrders).slice(0, 5).map(r => r['Tỉnh/Thành phố']));
  console.log('[debug KhuVuc] TikTok "Province" (5 dòng đầu):', Object.values(ttOrders).slice(0, 5).map(r => r['Province']));
  const khuVucCount = {};
  for (const r of Object.values(spOrders)){
    const tt = normalizeTinhThanh(r['Tỉnh/Thành phố']);
    khuVucCount[tt] = (khuVucCount[tt] || 0) + 1;
  }
  for (const r of Object.values(ttOrders)){
    const tt = normalizeTinhThanh(r['Province']);
    khuVucCount[tt] = (khuVucCount[tt] || 0) + 1;
  }
  const khuVucTotal = Object.values(khuVucCount).reduce((s, n) => s + n, 0);
  const khuVucNamed = Object.entries(khuVucCount)
    .filter(([ten]) => ten !== 'Không rõ')
    .map(([ten, soDon]) => ({ ten, soDon }))
    .sort((a, b) => b.soDon - a.soDon);
  const khuVucKhongRo = khuVucCount['Không rõ'] || 0;
  const khuVucTop6 = khuVucNamed.slice(0, 6);
  const khuVucKhac = khuVucNamed.slice(6).reduce((s, x) => s + x.soDon, 0) + khuVucKhongRo;
  const khuVucRows = khuVucTop6.slice();
  if (khuVucKhac > 0) khuVucRows.push({ ten: 'Khác', soDon: khuVucKhac, isKhac: true });
  const khuVuc = { total: khuVucTotal, rows: khuVucRows };

  // ---------- Hiệu suất theo SKU/size (2026-09-15, theo yêu cầu chủ shop) ----------
  // Chủ shop xác nhận: cột "SKU phân loại hàng" (Shopee) và "Seller SKU"
  // (TikTok) gộp SẴN cả mã SKU sản phẩm + size trong 1 chuỗi, dạng "CL01-L"
  // (size luôn là token cuối, nối bằng dấu "-"). CHỈ tính trên đơn Hoàn thành
  // (đã chốt với chủ shop), gộp chung 2 sàn theo TÊN SẢN PHẨM hiển thị (không
  // theo mã SKU thô) vì chủ shop xác nhận Shopee đôi khi phải rút ngắn mã SKU
  // so với Sapo/TikTok (giới hạn độ dài Shopee cho phép) nên mã có thể lệch
  // giữa 2 sàn, còn TÊN sản phẩm thì luôn giống hệt nhau ở cả 3 nơi.
  const SIZE_TOKENS = ['3XL', '2XL', 'XXL', 'XL', 'S', 'M', 'L'];
  function splitSkuSize(code){
    if (!code) return { baseSku: null, size: null };
    const s = String(code).trim();
    const upper = s.toUpperCase();
    for (const tok of SIZE_TOKENS){
      const suffix = '-' + tok;
      if (upper.endsWith(suffix)) return { baseSku: s.slice(0, s.length - suffix.length), size: tok };
    }
    return { baseSku: s, size: null }; // không tách được size — coi cả chuỗi là mã SKU gốc
  }
  // Bảng tra cứu SKU -> Tên hiển thị, lấy từ tài liệu "quy-tac-dat-ten-sku-va-danh-sach-san-pham"
  // (chủ shop cung cấp 2026-09-11). Mã nào chưa có trong bảng này thì hiện
  // nguyên mã gốc + báo cảnh báo để chủ shop bổ sung, không làm mất dữ liệu.
  const SKU_DISPLAY_NAME = {
    CL01: 'Chất Lông-Shin', CL02: 'Chất Lông-Hello Kitty', CL03: 'Chất Lông-Vịt Xanh',
    CL04: 'Chất Lông-Lợn Hồng', CL05: 'Chất Lông-Kuromi', CL06: 'Chất Lông-Shin 02',
    CL07: 'Chất Lông-Shin 03', CL08: 'Chất Lông-Patrick Star', CL09: 'Chất Lông-Hello Kitty Hồng',
    CL10: 'Chất Lông-Thỏ Nơ', CL11: 'Chất Lông-Thỏ Nơ', CL12: 'Chất Lông-Caro Xanh',
    CL13: 'Chất Lông-Kẻ Xanh', CL14: 'Chất Lông-Đốm Hồng',
    CT01: 'Chất Thun-Màu 01', CT02: 'Chất Thun-Màu 02', CT03: 'Chất Thun-Màu 03',
    CT04: 'Chất Thun-Màu 04', CT05: 'Chất Thun-Màu 05', CT06: 'Chất Thun-Màu 06',
    CT07: 'Chất Thun-Màu 07', CT08: 'Chất Thun-Shin 01', CT09: 'Chất Thun-Shin 02', CT10: 'Chất Thun-Shin 04',
    DO03: 'Đỏ 03', DEN02: 'Đen 02', DO04: 'Đỏ 04', XANHLA03: 'Xanh Lá 03',
    DO03BANNANGCAP: 'Đỏ 03 Cao Cấp (Noel)', XANHLA02: 'Xanh Lá 02', DADEN: 'Chất Dạ Đen Cao Cấp',
    DADO: 'Chất Dạ Đỏ Cao Cấp', DO02: 'Đỏ 02', DO05: 'Đỏ 05', XANHLA05: 'Xanh Lá 05',
    'PJD-CT-01': 'Bộ Dài-Shin 01', 'PJD-CT-02': 'Bộ Dài-Shin 02', 'PJD-CT-03': 'Bộ Dài-Shin 03',
    'PJC-CT-01': 'Bộ Ngắn-Shin 01', 'PJC-CT-02': 'Bộ Ngắn-Shin 02', 'PJC-CT-03': 'Bộ Ngắn-Shin 03',
    'QS-CT-01': 'Quần Short-Shin 01', 'QS-CT-02': 'Quần Short-Shin 02', 'QS-CT-03': 'Quần Short-Shin 03',
  };
  function normSkuKey(s){ return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  const SKU_DISPLAY_NAME_NORM = {};
  for (const [k, v] of Object.entries(SKU_DISPLAY_NAME)) SKU_DISPLAY_NAME_NORM[normSkuKey(k)] = v;
  function resolveSkuName(baseSku){
    if (!baseSku) return { name: null, matched: false };
    if (SKU_DISPLAY_NAME[baseSku]) return { name: SKU_DISPLAY_NAME[baseSku], matched: true };
    const norm = normSkuKey(baseSku);
    if (SKU_DISPLAY_NAME_NORM[norm]) return { name: SKU_DISPLAY_NAME_NORM[norm], matched: true };
    return { name: baseSku, matched: false }; // chưa có trong bảng — hiện tạm mã gốc
  }

  const skuFinHdrSp = spRows.length ? Object.keys(spRows[0]) : [];
  const skuFinHdrTt = ttRows.length ? Object.keys(ttRows[0]) : [];
  const COL_SP_SKU_SIZE = findColKey(skuFinHdrSp, [/^sku\s*phân\s*loại\s*hàng$/i, /sku.*phân\s*loại/i]);
  const COL_SP_SL = findColKey(skuFinHdrSp, [/^số\s*lượng$/i]);
  const COL_TT_SKU_SIZE = findColKey(skuFinHdrTt, [/^seller\s*sku$/i, /seller.*sku/i]);
  const COL_TT_SL = findColKey(skuFinHdrTt, [/^quantity$/i]);

  // Chủ shop xác nhận (2026-09-15): CHỈ tính các mã SKU có trong bảng tra cứu
  // (`SKU_DISPLAY_NAME` ở trên, lấy từ quy-tac-dat-ten-sku-va-danh-sach-san-pham.md)
  // — mã nào không có trong bảng là SKU cũ đã ngừng bán, KHÔNG cần quan tâm nữa
  // nên bỏ qua hẳn (không hiện, không cảnh báo), tránh danh sách lẫn lộn giữa
  // tên sản phẩm thật và mã thô nhìn rối mắt.
  const skuAgg = {}; // key: tên hiển thị -> { name, tongSL, sizes: {size: sl} }
  function addSkuLine(rawCode, qty){
    if (!rawCode || !qty) return;
    const { baseSku, size } = splitSkuSize(rawCode);
    const { name, matched } = resolveSkuName(baseSku);
    if (!matched) return; // SKU không có trong bảng tra cứu — bỏ qua
    if (!skuAgg[name]) skuAgg[name] = { name, tongSL: 0, sizes: {} };
    skuAgg[name].tongSL += qty;
    const sizeKey = size || '(không rõ size)';
    skuAgg[name].sizes[sizeKey] = (skuAgg[name].sizes[sizeKey] || 0) + qty;
  }
  const skuColMissing = [];
  if (!COL_SP_SKU_SIZE) skuColMissing.push('Shopee: "SKU phân loại hàng"');
  if (!COL_SP_SL) skuColMissing.push('Shopee: "Số lượng"');
  if (!COL_TT_SKU_SIZE) skuColMissing.push('TikTok: "Seller SKU"');
  if (!COL_TT_SL) skuColMissing.push('TikTok: "Quantity"');
  if (COL_SP_SKU_SIZE && COL_SP_SL){
    for (const r of spRows){
      const oid = r['Mã đơn hàng'];
      if (oid === undefined || !(oid in spCompleted)) continue;
      addSkuLine(r[COL_SP_SKU_SIZE], num(r[COL_SP_SL]));
    }
  }
  if (COL_TT_SKU_SIZE && COL_TT_SL){
    for (const r of ttRows){
      const oid = r['Order ID'];
      if (oid === undefined || !(oid in ttCompleted)) continue;
      addSkuLine(r[COL_TT_SKU_SIZE], num(r[COL_TT_SL]));
    }
  }
  const periodDays = (minDate && maxDate) ? Math.round((maxDate - minDate) / 86400000) + 1 : null;
  const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '(không rõ size)'];
  const skuPerformance = {
    periodDays,
    items: Object.values(skuAgg).map(item => ({
      ten: item.name, tongSL: item.tongSL,
      slNgay: periodDays ? item.tongSL / periodDays : null,
      sizes: Object.entries(item.sizes)
        .map(([size, sl]) => ({ size, sl, pct: item.tongSL ? sl / item.tongSL : 0 }))
        .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)),
    })).sort((a, b) => b.tongSL - a.tongSL),
  };
  if (skuColMissing.length){
    warnings.push(`Hiệu suất theo SKU/size: không tìm thấy cột ${skuColMissing.join(', ')} — chưa tính được SL bán/ngày theo SKU và tỷ trọng size. Kiểm tra lại đúng tên cột trong file "tất cả đơn hàng" 2 sàn.`);
  }

  // ---------- 10) Affiliate/KOL (TikTok) — 2 file tuỳ chọn, không ảnh hưởng
  // tới việc xác định tháng của kỳ báo cáo (xem NO_FILENAME_MONTH_ROLES). ----------
  // Bảng 1 (Tổng hợp KOC theo đơn & doanh thu) — chỉ cần affiliateOrders.
  const affRowsRaw = aoa.tiktokAffiliateOrders ? rowsAsDicts(aoa.tiktokAffiliateOrders, 0) : null;
  const kocOrders = {}; // koc -> {count, revenue} — chỉ có dữ liệu khi đã tải affiliateOrders
  const kocContentRevenue = {}; // koc -> { [loạiNộiDung]: revenue }
  if (affRowsRaw){
    const affSettled = affRowsRaw.filter(r => r['Trạng thái đơn hàng'] === 'Đã quyết toán');
    for (const r of affSettled){
      const koc = r['Tên người dùng nhà sáng tạo'];
      if (koc === undefined || koc === null || koc === '') continue;
      const amt = num(r['Payment Amount']);
      if (!kocOrders[koc]) kocOrders[koc] = { count: 0, revenue: 0 };
      kocOrders[koc].count += 1;
      kocOrders[koc].revenue += amt;
      const loai = r['Loại nội dung'] || '(không rõ)';
      if (!kocContentRevenue[koc]) kocContentRevenue[koc] = {};
      kocContentRevenue[koc][loai] = (kocContentRevenue[koc][loai] || 0) + amt;
    }
  }
  // CTOR (Creator List — Transaction Analysis) nối chéo vào Bảng 1 theo KOC —
  // file tuỳ chọn riêng, không bắt buộc phải có mới tính được Bảng 1.
  const creatorListRaw = aoa.tiktokCreatorList ? rowsAsDicts(aoa.tiktokCreatorList, 0, 2) : null;
  const creatorCtorMap = {};
  if (creatorListRaw){
    for (const r of creatorListRaw){
      const koc = r['Tên nhà sáng tạo'];
      if (!koc) continue;
      creatorCtorMap[koc] = num(r['CTOR']);
    }
  }
  const kocTable1 = affRowsRaw ? Object.entries(kocOrders)
    .map(([koc, v]) => ({
      koc, soDon: v.count, doanhThu: v.revenue,
      ctor: creatorCtorMap[koc] !== undefined ? creatorCtorMap[koc] : null,
    }))
    .sort((a, b) => b.doanhThu - a.doanhThu)
    .slice(0, 20) : null;

  // Bảng 2 (Chất lượng nội dung theo KOC) — nền tảng là videoAnalysis (đo hiệu
  // quả nội dung); cột "doanh thu đến từ đâu" nối chéo sang kocContentRevenue ở
  // trên, KOC nào chưa có đơn affiliateOrders tháng này thì đánh dấu riêng
  // (không phải lỗi/0% — video có thể ra đơn ở tháng khác vì đây là dữ liệu
  // luỹ kế theo video, không theo tháng).
  const vidRowsRaw = aoa.tiktokVideoAnalysis ? rowsAsDicts(aoa.tiktokVideoAnalysis, 0, 2) : null;
  const kocVideoAgg = {};
  if (vidRowsRaw){
    for (const r of vidRowsRaw){
      const koc = r['Tên nhà sáng tạo'];
      if (koc === undefined || koc === null || koc === '') continue;
      if (!kocVideoAgg[koc]) kocVideoAgg[koc] = { gmvSum: 0, viewSum: 0, completionSum: 0, completionCount: 0, ctrSum: 0, ctrCount: 0 };
      const agg = kocVideoAgg[koc];
      agg.gmvSum += parseVndCurrency(r['GMV đến từ video liên kết']);
      agg.viewSum += num(r['Lượt xem video']);
      const completion = r['Tỷ lệ xem hết'];
      if (completion !== undefined && completion !== null && completion !== ''){
        agg.completionSum += num(completion);
        agg.completionCount += 1;
      }
      const ctr = r['CTR'];
      if (ctr !== undefined && ctr !== null && ctr !== ''){
        agg.ctrSum += num(ctr);
        agg.ctrCount += 1;
      }
    }
  }
  const kocTable2 = vidRowsRaw ? Object.entries(kocVideoAgg).map(([koc, v]) => {
    const orderInfo = kocOrders[koc];
    const hasOrderThisMonth = !!orderInfo;
    let contentBreakdown = null;
    if (hasOrderThisMonth && orderInfo.revenue > 0){
      contentBreakdown = Object.entries(kocContentRevenue[koc] || {})
        .map(([loai, amt]) => ({ loai, amt, pct: amt / orderInfo.revenue }))
        .sort((a, b) => b.amt - a.amt);
    }
    return {
      koc, hasOrderThisMonth, contentBreakdown,
      completionAvg: v.completionCount ? v.completionSum / v.completionCount : 0,
      ctrAvg: v.ctrCount ? v.ctrSum / v.ctrCount : 0,
      gpm: v.viewSum ? (v.gmvSum / v.viewSum) * 1000 : 0,
    };
  }).sort((a, b) => {
    if (b.gpm !== a.gpm) return b.gpm - a.gpm;
    if (b.completionAvg !== a.completionAvg) return b.completionAvg - a.completionAvg;
    return b.ctrAvg - a.ctrAvg;
  }).slice(0, 20) : null;

  // Bảng 3 "Hiệu quả LIVE theo KOC" (Live List — Transaction Analysis) — file
  // tuỳ chọn riêng, độc lập với table1/table2; liveTable = null khi chưa tải
  // file này, app.js sẽ ẩn hẳn bảng (không hiện bảng rỗng).
  const liveRowsRaw = aoa.tiktokLiveList ? rowsAsDicts(aoa.tiktokLiveList, 0, 2) : null;
  const kocLiveAgg = {};
  if (liveRowsRaw){
    for (const r of liveRowsRaw){
      const koc = r['Tên nhà sáng tạo'];
      if (!koc) continue;
      if (!kocLiveAgg[koc]) kocLiveAgg[koc] = { liveIds: new Set(), gmvSum: 0, ctrSum: 0, ctrCount: 0, gpmSum: 0, gpmCount: 0 };
      const agg = kocLiveAgg[koc];
      agg.liveIds.add(r['ID buổi LIVE']);
      agg.gmvSum += parseVndCurrency(r['GMV nhờ buổi LIVE của nhà sáng tạo']);
      const ctr = r['CTR'];
      if (ctr !== undefined && ctr !== null && ctr !== ''){ agg.ctrSum += num(ctr); agg.ctrCount += 1; }
      const gpm = r['GPM hiển thị'];
      if (gpm !== undefined && gpm !== null && gpm !== ''){ agg.gpmSum += parseVndCurrency(gpm); agg.gpmCount += 1; }
    }
  }
  const kocLiveTable = liveRowsRaw ? Object.entries(kocLiveAgg).map(([koc, v]) => ({
    koc,
    soBuoiLive: v.liveIds.size,
    gmvLive: v.gmvSum,
    ctrAvg: v.ctrCount ? v.ctrSum / v.ctrCount : 0,
    gpmHienThiAvg: v.gpmCount ? v.gpmSum / v.gpmCount : 0,
  })).sort((a, b) => b.gmvLive - a.gmvLive).slice(0, 10) : null;

  // Chỉ hiện cả khu vực khi có ÍT NHẤT 1 trong 2 file — không có file nào thì
  // affiliateKoc = null, app.js sẽ ẩn hoàn toàn khu vực (không hiện bảng rỗng).
  const affiliateKoc = (affRowsRaw || vidRowsRaw) ? { table1: kocTable1, table2: kocTable2, liveTable: kocLiveTable } : null;

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
    affiliateKoc,
    khuVuc,
    skuPerformance,
    // Số liệu gốc (tử số/mẫu số) của các chỉ số tỷ lệ — KHÔNG hiện trực tiếp lên
    // dashboard, chỉ dùng để gộp nhiều tháng chính xác (combineMonthlyResults()
    // bên dưới): cộng thẳng tử số + mẫu số gốc của từng tháng trước rồi mới chia
    // 1 lần ra tỷ lệ gộp, thay vì lấy trung bình cộng % (sai) hoặc thiếu dữ liệu
    // để tính lại (piShipPhi/piShipHoan, shopeeTroGia không có sẵn ở chỗ nào khác
    // trong object trả về). Các tháng đã lưu TRƯỚC 2026-09-15 (trước khi thêm
    // trường này) sẽ không có "raw" — bấm "Cập nhật lại lịch sử" để tính lại và
    // có đủ dữ liệu gộp chính xác.
    raw: { piShipPhi, piShipHoan, voucherXtraTotal, shopeeTroGia: shopeeTroGiaForVoucher },
  };
}

// ============================================================
// Gộp nhiều kỳ (tháng) LIỀN KỀ đã lưu thành 1 kỳ xem tổng hợp — thiết kế đã chốt
// với chủ shop (2026-09-15, xem project doc "dac-ta-chi-so-dashboard-web.md",
// mục "Quyết định về việc xem theo tuần/nhiều tháng"):
//   (1) số tuyệt đối — cộng thẳng.
//   (2) tỷ lệ (Slove/Tlove/PiShip/Voucher extra, tỷ lệ huỷ hoàn trả/lỗi shop) —
//       cộng riêng tử số + mẫu số gốc của từng tháng rồi mới chia 1 lần.
//   (3) % theo tỷ trọng (kênh, CTR/chuyển đổi SP) — cộng tuyệt đối từng phần
//       trước, tính % lại trên tổng gộp sau (CTR/chuyển đổi SP: không có sẵn số
//       lượt xem/lượt click gốc trong dữ liệu ShopStats đã lưu, nên tạm dùng
//       trung bình có trọng số theo doanh số — có thể lệch nhẹ so với gộp đúng
//       từ số liệu gốc, đã ghi chú trong cảnh báo).
//   (4) bảng chi tiết — nối danh sách các tháng lại.
// entries: [{ label, data }] — PHẢI đã được lọc/sắp xếp LIỀN KỀ theo thời gian
// bởi phía gọi (init.js); hàm này không tự kiểm tra tính liền kề.
function combineMonthlyResults(entries){
  const warnings = [];
  const list = entries.map(e => e.data).filter(Boolean);
  if (!list.length) return null;

  function sumField(getter){ return list.reduce((s, d) => s + (num(getter(d)) || 0), 0); }
  function safeDiv(a, b){ return b ? a / b : 0; }

  const shopee = {
    tongDon: sumField(d => d.shopee.tongDon), hoanThanh: sumField(d => d.shopee.hoanThanh),
    doanhThu: sumField(d => d.shopee.doanhThu), phiSan: sumField(d => d.shopee.phiSan),
    troGia: sumField(d => d.shopee.troGia),
    huy: sumField(d => d.shopee.huy), tra: sumField(d => d.shopee.tra), hoan: sumField(d => d.shopee.hoan),
    huyHoanTra: sumField(d => d.shopee.huyHoanTra), loiShop: sumField(d => d.shopee.loiShop),
    hoanVeKho: sumField(d => d.shopee.hoanVeKho),
  };
  shopee.doanhThuRong = shopee.doanhThu - shopee.phiSan;
  shopee.aov = safeDiv(shopee.doanhThu, shopee.hoanThanh);

  const tiktok = {
    tongDon: sumField(d => d.tiktok.tongDon), hoanThanh: sumField(d => d.tiktok.hoanThanh),
    doanhThu: sumField(d => d.tiktok.doanhThu), phiSan: sumField(d => d.tiktok.phiSan),
    troGia: sumField(d => d.tiktok.troGia),
    huy: sumField(d => d.tiktok.huy), tra: sumField(d => d.tiktok.tra), hoan: sumField(d => d.tiktok.hoan),
    huyHoanTra: sumField(d => d.tiktok.huyHoanTra), loiShop: sumField(d => d.tiktok.loiShop),
    hoanVeKho: sumField(d => d.tiktok.hoanVeKho),
  };
  tiktok.doanhThuRong = tiktok.doanhThu - tiktok.phiSan;
  tiktok.aov = safeDiv(tiktok.doanhThu, tiktok.hoanThanh);

  const tongDoanhThu = shopee.doanhThu + tiktok.doanhThu;
  const tongHoanThanh = shopee.hoanThanh + tiktok.hoanThanh;
  const tongDon = shopee.tongDon + tiktok.tongDon;
  const tongHuyHoanTra = shopee.huyHoanTra + tiktok.huyHoanTra;
  const tongLoiShop = shopee.loiShop + tiktok.loiShop;
  const tong = {
    doanhThu: tongDoanhThu, tongDon, hoanThanh: tongHoanThanh,
    phiSan: shopee.phiSan + tiktok.phiSan, doanhThuRong: shopee.doanhThuRong + tiktok.doanhThuRong,
    aov: safeDiv(tongDoanhThu, tongHoanThanh),
    huyHoanTra: tongHuyHoanTra, tyLeHuyHoanTra: safeDiv(tongHuyHoanTra, tongDon),
    loiShop: tongLoiShop, tyLeLoiShop: safeDiv(tongLoiShop, tongDon),
    hoanVeKho: shopee.hoanVeKho + tiktok.hoanVeKho,
  };

  // Slove/Tlove/PiShip/Voucher extra — gộp đúng bằng tử/mẫu gốc CHỈ với các
  // tháng đã có "raw" (tính lại từ 2026-09-15 trở đi); tháng cũ thiếu "raw"
  // vẫn được cộng phần Tlove (đủ dữ liệu sẵn có), riêng Slove/PiShip/Voucher
  // extra sẽ bị BỎ QUA phần đóng góp của tháng đó và có cảnh báo rõ.
  const monthsMissingRaw = entries.filter(e => e.data && !e.data.raw).map(e => e.label);
  let piShipPhiSum = 0, piShipHoanSum = 0, shopeeTroGiaSum = 0, voucherXtraSum = 0, hasVoucherData = false;
  for (const d of list){
    if (d.raw){
      piShipPhiSum += num(d.raw.piShipPhi) || 0;
      piShipHoanSum += num(d.raw.piShipHoan) || 0;
      voucherXtraSum += num(d.raw.voucherXtraTotal) || 0;
      if (d.raw.shopeeTroGia !== null && d.raw.shopeeTroGia !== undefined){ shopeeTroGiaSum += num(d.raw.shopeeTroGia) || 0; hasVoucherData = true; }
    }
  }
  const slovePhi = shopee.phiSan + piShipPhiSum; // xấp xỉ nếu có tháng thiếu raw (thiếu phần piShipPhi của tháng đó)
  const slove = safeDiv(shopee.troGia, slovePhi);
  const tlove = safeDiv(tiktok.troGia, tiktok.phiSan);
  const piShipRatio = safeDiv(piShipHoanSum, piShipPhiSum);
  const voucherExtra = hasVoucherData ? safeDiv(shopeeTroGiaSum, voucherXtraSum) : null;
  if (monthsMissingRaw.length){
    warnings.push(`Gộp kỳ: ${monthsMissingRaw.join(', ')} chưa được tính lại theo công thức mới (thiếu số liệu gốc) — Slove/PiShip/Voucher extra gộp có thể hơi lệch cho các tháng này. Bấm "Cập nhật lại lịch sử" rồi gộp lại để có số chính xác.`);
  }

  // reasonRows — gộp theo (reason, platform)
  const reasonMap = {};
  for (const d of list){
    for (const r of (d.reasonRows || [])){
      const key = r.platform + '|' + r.reason;
      if (!reasonMap[key]) reasonMap[key] = { reason: r.reason, platform: r.platform, count: 0 };
      reasonMap[key].count += r.count;
    }
  }
  const reasonRows = Object.values(reasonMap);

  // ngày kỳ gộp — nhỏ nhất/lớn nhất trong toàn bộ các tháng đã chọn
  let minDate = null, maxDate = null;
  for (const d of list){
    if (d.minDate){ const dd = new Date(d.minDate); if (!minDate || dd < minDate) minDate = dd; }
    if (d.maxDate){ const dd = new Date(d.maxDate); if (!maxDate || dd > maxDate) maxDate = dd; }
  }

  // hoanVeKhoDetail — nối các tháng lại, tính lại "ngoài kỳ" theo đúng khoảng đã gộp
  const hoanVeKhoDetail = [];
  for (const d of list){
    for (const item of (d.hoanVeKhoDetail || [])){
      const dd = item.ngayDatHang ? new Date(item.ngayDatHang) : null;
      hoanVeKhoDetail.push(Object.assign({}, item, {
        ngoaiKy: !!(dd && minDate && maxDate && (dd < minDate || dd > maxDate)),
      }));
    }
  }
  const hoanVeKhoNgoaiKyCount = hoanVeKhoDetail.filter(x => x.ngoaiKy).length;

  // dailyRevenue — nối các tháng (liền kề, không trùng ngày) rồi sắp lại cho chắc
  const dailyRevenue = list.flatMap(d => d.dailyRevenue || []).sort((a, b) => a.date.localeCompare(b.date));

  // kenh (doanh thu theo kênh) — cộng tuyệt đối từng phần, chỉ trên các tháng có ShopStats
  const kenhList = list.map(d => d.kenh).filter(Boolean);
  const kenh = kenhList.length ? {
    total: kenhList.reduce((s, k) => s + k.total, 0),
    theSanPham: kenhList.reduce((s, k) => s + k.theSanPham, 0),
    livestream: kenhList.reduce((s, k) => s + k.livestream, 0),
    video: kenhList.reduce((s, k) => s + k.video, 0),
    tiepThiLienKet: kenhList.reduce((s, k) => s + k.tiepThiLienKet, 0),
  } : null;

  // sanPham (hiệu suất sản phẩm) — gộp theo tên, doanh số cộng thẳng; CTR/tỷ lệ
  // chuyển đổi dùng trung bình có trọng số theo doanh số (xấp xỉ — không có sẵn
  // số lượt xem/click gốc để cộng đúng tử/mẫu).
  const sanPhamMap = {};
  for (const d of list){
    for (const sp of (d.sanPham || [])){
      if (!sanPhamMap[sp.ten]) sanPhamMap[sp.ten] = { ten: sp.ten, doanhSo: 0, ctrWeighted: 0, chuyenDoiWeighted: 0 };
      const m = sanPhamMap[sp.ten];
      m.doanhSo += sp.doanhSo;
      m.ctrWeighted += sp.ctr * sp.doanhSo;
      m.chuyenDoiWeighted += sp.chuyenDoi * sp.doanhSo;
    }
  }
  const sanPhamMerged = Object.values(sanPhamMap).map(m => ({
    ten: m.ten, doanhSo: m.doanhSo,
    ctr: safeDiv(m.ctrWeighted, m.doanhSo), chuyenDoi: safeDiv(m.chuyenDoiWeighted, m.doanhSo),
  })).sort((a, b) => b.doanhSo - a.doanhSo);
  const sanPham = Object.keys(sanPhamMap).length ? sanPhamMerged : null;
  if (sanPham){
    warnings.push('Gộp kỳ: cột CTR/Tỷ lệ chuyển đổi của "Hiệu suất sản phẩm" là số xấp xỉ (trung bình có trọng số theo doanh số), không cộng đúng tử/mẫu gốc như Slove/Tlove.');
  }

  // khuVuc — gộp theo tên tỉnh/thành đã có sẵn trong top6+Khác của từng tháng
  // (xấp xỉ: 1 tỉnh nằm trong "Khác" ở tháng này nhưng lên top6 ở tháng khác sẽ
  // không được tách lại đúng — chấp nhận theo quyết định đã chốt, vì dữ liệu chi
  // tiết hơn top6 không được lưu lại mỗi tháng).
  const khuVucMap = {};
  let khuVucKhacSum = 0, khuVucTotalSum = 0;
  for (const d of list){
    if (!d.khuVuc) continue;
    khuVucTotalSum += d.khuVuc.total || 0;
    for (const row of (d.khuVuc.rows || [])){
      if (row.isKhac){ khuVucKhacSum += row.soDon; continue; }
      khuVucMap[row.ten] = (khuVucMap[row.ten] || 0) + row.soDon;
    }
  }
  const khuVucNamed = Object.entries(khuVucMap).map(([ten, soDon]) => ({ ten, soDon })).sort((a, b) => b.soDon - a.soDon);
  const khuVucRows = khuVucNamed.slice();
  if (khuVucKhacSum > 0) khuVucRows.push({ ten: 'Khác', soDon: khuVucKhacSum, isKhac: true });
  const khuVuc = list.some(d => d.khuVuc) ? { total: khuVucTotalSum, rows: khuVucRows } : null;
  if (khuVuc){
    warnings.push('Gộp kỳ: "Khách hàng theo khu vực" là số gần đúng — các tỉnh nhỏ lẻ nằm trong nhóm "Khác" ở 1 tháng nào đó sẽ không tách lại được dù lên top ở tháng khác.');
  }

  // skuPerformance — gộp theo tên SKU, cộng SL + cộng SL theo size, tính lại % và SL/ngày
  // (chỉ gồm các mã đã có tên trong bảng tra cứu — computeAllFromAOA đã lọc bỏ
  // mã cũ/ngừng bán từ trước khi lưu, xem addSkuLine()).
  const skuMap = {};
  let totalPeriodDays = 0;
  for (const d of list){
    const sp = d.skuPerformance;
    if (!sp) continue;
    totalPeriodDays += sp.periodDays || 0;
    for (const item of (sp.items || [])){
      if (!skuMap[item.ten]) skuMap[item.ten] = { ten: item.ten, tongSL: 0, sizes: {} };
      const m = skuMap[item.ten];
      m.tongSL += item.tongSL;
      for (const s of (item.sizes || [])) m.sizes[s.size] = (m.sizes[s.size] || 0) + s.sl;
    }
  }
  const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '(không rõ size)'];
  const skuItems = Object.values(skuMap).map(m => ({
    ten: m.ten, tongSL: m.tongSL,
    slNgay: totalPeriodDays ? m.tongSL / totalPeriodDays : null,
    sizes: Object.entries(m.sizes).map(([size, sl]) => ({ size, sl, pct: m.tongSL ? sl / m.tongSL : 0 }))
      .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)),
  })).sort((a, b) => b.tongSL - a.tongSL);
  const skuPerformance = Object.keys(skuMap).length ? { periodDays: totalPeriodDays || null, items: skuItems } : null;

  // ssWarning — chỉ hiện nếu KHÔNG tháng nào có ShopStats (giống logic 1 tháng)
  const anyShopStats = list.some(d => d.kenh || d.sanPham);
  const ssWarning = anyShopStats
    ? (list.some(d => d.ssWarning) ? 'Một số tháng trong kỳ gộp chưa tải Shop Stats — Voucher extra/Doanh thu theo kênh/Hiệu suất sản phẩm chỉ tính trên các tháng đã có đủ dữ liệu.' : null)
    : 'Chưa tháng nào trong kỳ gộp có Shop Stats — bỏ qua Voucher extra, Doanh thu theo kênh, Hiệu suất sản phẩm.';

  warnings.push('Gộp kỳ: bảng "Affiliate/KOC theo nhà sáng tạo" chưa hỗ trợ xem gộp nhiều tháng — mở lại từng tháng riêng lẻ nếu cần xem mục này.');

  return {
    warnings: [...warnings, ...list.flatMap((d, i) => (d.warnings || []).map(w => `[${entries[i].label}] ${w}`))],
    ssWarning, minDate, maxDate,
    shopee, tiktok, tong,
    nhanh4: { slove, tlove, piShipRatio, voucherExtra },
    reasonRows,
    hoanVeKhoDetail, hoanVeKhoNgoaiKyCount,
    dailyRevenue,
    kenh, sanPham,
    affiliateKoc: null,
    khuVuc,
    skuPerformance,
    raw: null,
    isCombined: true,
    combinedLabels: entries.map(e => e.label),
  };
}
