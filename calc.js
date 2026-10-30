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
// Định dạng tiếng Anh (lỗi #8 doc Chuẩn hoá 10/2026): "1,234.56" / "1,234,567"
// — phẩy ngăn nghìn, chấm thập phân. Trước đây rơi vào nhánh "có , không ." →
// thay , bằng . → "1,234" đọc ra 1.234 (sai cả nghìn lần) mà không cảnh báo.
const RE_EN_THOUSANDS_DEC = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;

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
  else if (RE_EN_THOUSANDS_DEC.test(s)) s2 = s.replace(/,/g, '');
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

/** Tính lại phạm vi thật của sheet từ các ô có thật.
 *
 *  BẪY NẶNG (phát hiện 22/10/2026, file tài chính TikTok tháng 9): file xuất từ
 *  sàn khai sai thẻ <dimension> — ghi "A1:U2" trong khi dữ liệu thật tới
 *  "A1:BN880". SheetJS TIN con số đó nên chỉ đọc 21 cột × 2 dòng → phí sàn,
 *  thực nhận, quảng cáo GMV Max của TikTok đều ra 0 mà nhìn qua vẫn thấy
 *  "có đọc được file". (Thư viện openpyxl bên Python dính y hệt, phải gọi
 *  reset_dimensions.) Vì vậy LUÔN quét khoá ô thật để dựng lại !ref. */
function fixSheetRange(ws){
  if (!ws) return ws;
  let maxR = 0, maxC = 0, any = false;
  for (const k in ws){
    if (!Object.prototype.hasOwnProperty.call(ws, k) || k.charAt(0) === '!') continue;
    const cell = XLSX.utils.decode_cell(k);
    if (!cell || isNaN(cell.r) || isNaN(cell.c)) continue;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c > maxC) maxC = cell.c;
    any = true;
  }
  if (any) ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return ws;
}

/** sheet -> array of arrays (raw), via SheetJS */
function sheetToAOA(ws){
  return XLSX.utils.sheet_to_json(fixSheetRange(ws), { header: 1, raw: true, defval: null, blankrows: true });
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
      // (rà soát 22/10/2026) TRƯỚC ĐÂY còn điều kiện `i < row.length`: dòng dữ
      // liệu nào bị cắt ngắn (SheetJS bỏ các ô rỗng ở đuôi) thì những cột phía
      // sau KHÔNG có mặt trong object → chỗ nào dò cột bằng Object.keys(dòng
      // đầu) sẽ tưởng sàn đã bỏ cột. Đã dính thật với file tài chính TikTok
      // tháng 9/2026: dòng đầu chỉ 21 ô nên 45 cột cuối "biến mất", phí sàn và
      // thực nhận TikTok ra 0. Giờ luôn tạo đủ khoá theo DÒNG TIÊU ĐỀ.
      if (hdr[i] !== null && hdr[i] !== undefined){
        d[hdr[i]] = (i < row.length) ? nfc(row[i]) : null;
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
// Map trạng thái đơn → 4 trạng thái chuẩn (lỗi #7 doc Chuẩn hoá 10/2026):
// trước đây so CỨNG đúng chuỗi ('Hoàn thành', 'Đã hủy'...) — sàn đổi chữ là
// huỷ = 0, hoàn thành = 0 mà không ai biết. Giờ map theo bảng + chữ lạ thì
// CẢNH BÁO ĐỎ trên dashboard (computeAllFromAOA gom unknown qua statusWarn).
// 4 trạng thái chuẩn: 'hoan_thanh' | 'huy' | 'dang_xu_ly' | 'cho_thanh_toan'
// ============================================================
function spStatusNorm(raw){
  const s = nfc(String(raw || '')).trim();
  if (s === 'Hoàn thành') return 'hoan_thanh';
  if (s === 'Đã hủy' || s === 'Đã huỷ') return 'huy';
  if (s === 'Chưa thanh toán' || s === 'Chờ thanh toán') return 'cho_thanh_toan';
  // các trạng thái giữa đường Shopee hay gặp — đều là "đang xử lý"
  if (s.startsWith('Người mua xác nhận')) return 'dang_xu_ly';
  if (['Đang giao', 'Đã giao', 'Chờ lấy hàng', 'Đang vận chuyển', 'Vận chuyển', 'Đã xử lý', 'Chờ xác nhận', 'Đang xử lý'].includes(s)) return 'dang_xu_ly';
  return null; // chữ lạ — người gọi tự cảnh báo
}
function ttStatusNorm(raw){
  const s = nfc(String(raw || '')).trim();
  if (s === 'Đã hoàn tất') return 'hoan_thanh';
  if (s === 'Đã hủy' || s === 'Đã huỷ') return 'huy';
  if (s === 'Chưa thanh toán' || s === 'Chờ thanh toán') return 'cho_thanh_toan';
  if (['Đã vận chuyển', 'Đang vận chuyển', 'Chờ vận chuyển', 'Chờ lấy hàng', 'Đã giao hàng', 'Đang xử lý'].includes(s)) return 'dang_xu_ly';
  return null;
}

// ============================================================
// Danh mục SKU từ Sapo (lỗi #1): sku-catalog.json sinh bởi
// tools/build_sku_catalog.py — init.js tải vào window.SKU_CATALOG trước khi
// tính; Node test gán globalThis.SKU_CATALOG. Không có catalog → calc vẫn
// chạy bằng bảng dự phòng SKU_FALLBACK_NAME trong computeAllFromAOA.
// ============================================================
function getSkuCatalog(){
  const g = (typeof window !== 'undefined') ? window : globalThis;
  const c = g.SKU_CATALOG;
  if (!c || !c.variants) return null;
  if (!c.__norm){
    // build 1 lần: map theo khoá chuẩn hoá (bỏ ký tự lạ, hoa thường) để chấp
    // mã Shopee bị rút ngắn/lệch ký tự so với Sapo/TikTok
    const variants = {}, combos = {};
    for (const [sku, v] of Object.entries(c.variants)) variants[normSkuKey(sku)] = Object.assign({ sku }, v);
    for (const [sku, items] of Object.entries(c.combos || {})) combos[normSkuKey(sku)] = items;
    c.__norm = { variants, combos };
  }
  return c.__norm;
}
function normSkuKey(s){ return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// Giá vốn 1 cái theo MÃ SKU GỐC — cost-catalog.json (sinh từ sheet GiaCong cột
// H của chủ shop, xem ghi chú trong file đó). init.js tải vào
// window.COST_CATALOG trước khi tính; thiếu file → P&L phần giá vốn hiện "—".
function getCostCatalog(){
  const g = (typeof window !== 'undefined') ? window : globalThis;
  const c = g.COST_CATALOG;
  if (!c || !c.cost) return null;
  if (!c.__norm){
    const m = {};
    for (const [k, v] of Object.entries(c.cost)) m[normSkuKey(k)] = num(v);
    c.__norm = m;
  }
  return c.__norm;
}

// Dò cột theo TỪ KHOÁ (regex) trên header thật — dùng chung mọi nơi đọc cột
// theo tên, không so cứng tuyệt đối (sàn hay đổi nhẹ tên cột).
function findColKey(headerKeys, patterns){
  for (const p of patterns){
    const hit = headerKeys.find(k => p.test(String(k || '').trim()));
    if (hit) return hit;
  }
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
  shopeeAds: { platform: 'Shopee', label: 'Quảng cáo (Dịch vụ Hiển thị)', required: false },
  tiktokAffiliateOrders: { platform: 'TikTok', label: 'Affiliate Orders', required: false },
  tiktokVideoAnalysis: { platform: 'TikTok', label: 'Video Analysis', required: false },
  tiktokCreatorList: { platform: 'TikTok', label: 'Creator List (Transaction Analysis)', required: false },
  tiktokLiveList: { platform: 'TikTok', label: 'Live List (Transaction Analysis)', required: false },
};

// TikTok: tên file KHÔNG có ngày thật (khác Shopee) — không được suy tháng
// từ tên file cho các vai trò này, thà hiển thị "chưa rõ tháng" còn hơn sai.
// tiktokAffiliateOrders/tiktokVideoAnalysis: phần đuôi số trong tên file chỉ
// là ID/thời điểm XUẤT file, không phải mốc tháng dữ liệu — không dùng để
// xác định tháng của kỳ báo cáo (tháng do file đơn hàng/tài chính quyết
// định như hiện tại).
// LƯU Ý (xác nhận từ chủ shop 2026-09-22): tiktokCreatorList/tiktokLiveList
// (Creator/Live List — Transaction Analysis) KHÁC 2 role trên — tên file
// loại này CÓ mang đúng khoảng ngày dữ liệu thật (`..._YYYYMMDD-YYYYMMDD`)
// nên KHÔNG nằm trong danh sách loại trừ này — xem detectMonthFromDateRangeInFilename().
const NO_FILENAME_MONTH_ROLES = new Set(['tiktokOrders', 'tiktokReturns', 'tiktokFinance', 'tiktokAffiliateOrders', 'tiktokVideoAnalysis']);
const DATE_RANGE_FILENAME_ROLES = new Set(['tiktokCreatorList', 'tiktokLiveList']);

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

  // Báo cáo quảng cáo Shopee (CSV) — dòng 1 là tiêu đề báo cáo, không phải header.
  // CÓ 2 LOẠI, phải phân biệt kẻo thiếu tiền (đã dính thật 10/2026):
  //  - "Báo cáo Dịch vụ Hiển thị trả theo CPC"  → ĐỦ mọi chiến dịch (dùng cái này)
  //  - "Chiến dịch nhóm - Shopee"               → CHỈ chiến dịch nhóm, THIẾU chiến dịch lẻ
  const dong1 = String((firstAOA[0] || [])[0] || '');
  if (/Dịch vụ Hiển thị trả theo CPC/i.test(dong1)) return 'shopeeAds';
  if (/^Chiến dịch nhóm\s*-\s*Shopee/i.test(dong1)) return 'shopeeAds';

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

// Riêng Creator/Live List (Transaction Analysis): tên file mang đúng khoảng
// ngày dữ liệu thật dạng "..._YYYYMMDD-YYYYMMDD.xlsx" (xác nhận từ chủ shop
// 2026-09-22), nhưng đây là KỲ BÁO CÁO TỰ CHỌN lúc export (không phải lịch
// tháng cố định) nên có thể vắt qua 2 tháng — ví dụ
// "..._20260821-20260919.xlsx" là 21/08 → 19/09. Quy tắc: đếm số ngày rơi
// vào mỗi tháng trong khoảng đó, chọn tháng có NHIỀU NGÀY HƠN (ví dụ trên:
// tháng 8 có 11 ngày, tháng 9 có 19 ngày → chọn Tháng 9/2026).
function detectMonthFromDateRangeInFilename(filename){
  const m = String(filename).match(/(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/);
  if (!m) return detectMonthFromFilename(filename); // dự phòng: chỉ có 1 mốc ngày trong tên
  const start = new Date(+m[1], +m[2] - 1, +m[3]);
  const end = new Date(+m[4], +m[5] - 1, +m[6]);
  if (isNaN(start) || isNaN(end) || start > end) return null;
  const dayCounts = {};
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end){
    const y = cursor.getFullYear(), mo = cursor.getMonth() + 1;
    const monthStart = new Date(y, mo - 1, 1);
    const monthEnd = new Date(y, mo, 0);
    const overlapStart = start > monthStart ? start : monthStart;
    const overlapEnd = end < monthEnd ? end : monthEnd;
    const days = Math.round((overlapEnd - overlapStart) / 86400000) + 1;
    if (days > 0) dayCounts[y + '-' + String(mo).padStart(2, '0')] = days;
    cursor = new Date(y, mo, 1); // tháng kế tiếp
  }
  let best = null, bestCount = -1;
  for (const [k, c] of Object.entries(dayCounts)) if (c > bestCount){ best = k; bestCount = c; }
  if (!best) return null;
  const [y, mo] = best.split('-');
  return { monthKey: best, label: 'Tháng ' + parseInt(mo, 10) + '/' + y };
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
  if (!monthInfo && role && DATE_RANGE_FILENAME_ROLES.has(role)) monthInfo = detectMonthFromDateRangeInFilename(file.name);
  else if (!monthInfo && !(role && NO_FILENAME_MONTH_ROLES.has(role))) monthInfo = detectMonthFromFilename(file.name);
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
  const wbAds = files.shopeeAds ? await readWorkbook(files.shopeeAds) : null;
  const wbAff = files.tiktokAffiliateOrders ? await readWorkbook(files.tiktokAffiliateOrders) : null;
  const wbVid = files.tiktokVideoAnalysis ? await readWorkbook(files.tiktokVideoAnalysis) : null;
  const wbCreatorList = files.tiktokCreatorList ? await readWorkbook(files.tiktokCreatorList) : null;
  const wbLiveList = files.tiktokLiveList ? await readWorkbook(files.tiktokLiveList) : null;
  // "Chốt lại tháng" (lỗi #5): file trả/hoàn của THÁNG SAU — tuỳ chọn, chỉ có
  // khi bấm nút Chốt lại tháng (init.js tự tải từ bản ghi tháng N+1 đã lưu).
  const wbRrNext = files.nextShopeeReturnRefund ? await readWorkbook(files.nextShopeeReturnRefund) : null;
  const wbTrNext = files.nextTiktokReturns ? await readWorkbook(files.nextTiktokReturns) : null;

  const aoa = {
    shopeeOrders: sheetToAOA(getSheet(wbSp, 'orders')),
    shopeeReturnRefund: sheetToAOA(getSheet(wbRr)),
    shopeeReturnRefundNext: wbRrNext ? sheetToAOA(getSheet(wbRrNext)) : null,
    tiktokOrders: sheetToAOA(getSheet(wbTt, 'OrderSKUList')),
    tiktokReturns: sheetToAOA(getSheet(wbTr)),
    tiktokReturnsNext: wbTrNext ? sheetToAOA(getSheet(wbTrNext)) : null,
    income_DoanhThu: sheetToAOA(getSheet(wbInc, 'Doanh thu')),
    income_ServiceFee: sheetToAOA(getSheet(wbInc, 'Service Fee Details')),
    // chỉ lấy khi sheet Adjustment thật sự tồn tại — getSheet() fallback về
    // sheet đầu (Summary) sẽ làm findLabeledValue vớ nhầm số ở sheet khác
    income_Adjustment: wbInc.SheetNames.some(n => nfc(n) === 'Adjustment') ? sheetToAOA(getSheet(wbInc, 'Adjustment')) : null,
    tiktokFinance: sheetToAOA(getSheet(wbFin, 'Chi tiết đơn hàng')),
    ss_DonDaThanhToan: wbSs ? sheetToAOA(getSheet(wbSs, 'Đơn Đã Thanh Toán')) : null,
    ss_NguonTruyCap: wbSs ? sheetToAOA(getSheet(wbSs, 'Nguồn truy cập cho Đơn hàng...')) : null,
    ss_TheoSanPham: wbSs ? sheetToAOA(getSheet(wbSs, 'Theo sản phẩm (đơn đã đặt)')) : null,
    shopeeFailedDelivery: wbFd ? sheetToAOA(getSheet(wbFd)) : null,
    shopeeAds: wbAds ? sheetToAOA(getSheet(wbAds)) : null,
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
  let rrRows = rowsAsDicts(rrAOA, 0);
  // "Chốt lại tháng" (lỗi #5): khi được đưa thêm file trả/hoàn của THÁNG SAU
  // (aoa.shopeeReturnRefundNext), gộp các yêu cầu trả thuộc đơn ĐẶT trong kỳ
  // này vào; dòng tháng sau GHI ĐÈ dòng cùng mã đơn (trạng thái mới hơn).
  if (aoa.shopeeReturnRefundNext){
    const byOid = {};
    for (const r of rrRows){ const o = r['Mã đơn hàng']; if (o !== undefined && !(o in byOid)) byOid[o] = r; }
    let nextCount = 0;
    for (const r of rowsAsDicts(aoa.shopeeReturnRefundNext, 0)){
      const o = r['Mã đơn hàng'];
      if (o === undefined || !(o in spOrders)) continue; // chỉ nhận yêu cầu trả của đơn đặt trong kỳ này
      byOid[o] = r; nextCount++;
    }
    rrRows = Object.values(byOid);
    warnings.push(`Chốt lại tháng: đã gộp thêm file Trả/hoàn Shopee của tháng sau — ${nextCount} yêu cầu trả thuộc đơn đặt kỳ này được cập nhật theo trạng thái mới nhất.`);
  }
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
  // Trạng thái chuẩn hoá (lỗi #7) — chữ lạ gom lại cảnh báo 1 lần
  const spUnknownStatus = {};
  function spNorm(r){
    const n = spStatusNorm(r['Trạng Thái Đơn Hàng']);
    if (n === null){
      const raw = String(r['Trạng Thái Đơn Hàng'] || '(trống)');
      spUnknownStatus[raw] = (spUnknownStatus[raw] || 0) + 1;
      return 'dang_xu_ly'; // không được bỏ đơn — coi là đang xử lý + cảnh báo
    }
    return n;
  }
  const spCancelledNative = {};
  for (const [oid, r] of Object.entries(spOrders)) if (spNorm(r) === 'huy') spCancelledNative[oid] = r;
  const spCancelAllIds = new Set([...Object.keys(spCancelledNative), ...Object.keys(spReclassToCancel)]);

  // (23/10/2026, chủ shop chốt) ĐƠN ĐÃ GỬI = đơn thực sự rời kho, tính cả đơn
  // sau đó khách không nhận hoặc trả lại — vì hàng đã đi là đã tốn công đóng,
  // tốn ship. Dấu hiệu: Shopee có "Thời gian giao hàng", TikTok có "Shipped Time".
  // KHÔNG dùng "có mã vận đơn" vì đơn huỷ trước khi gửi vẫn có thể đã tạo vận đơn
  // (T9/2026: 9 đơn Shopee như vậy).
  const spHdrKeys0 = spRows.length ? Object.keys(spRows[0]) : [];
  const C_SP_TG_GIAO = findColKey(spHdrKeys0, [/^thời\s*gian\s*giao\s*hàng$/i]);
  const spDaGuiIds = new Set();
  if (C_SP_TG_GIAO){
    for (const [oid, r] of Object.entries(spOrders)){
      if (String(r[C_SP_TG_GIAO] || '').trim()) spDaGuiIds.add(oid);
    }
  } else {
    warnings.push('Shopee: không thấy cột "Thời gian giao hàng" — chưa đếm được "đơn đã gửi".');
  }

  const spRefundedIds = new Set([...Object.keys(spDonTra), ...Object.keys(spDonHoan), ...Object.keys(spReclassToCancel)]);
  const spCompleted = {};
  for (const [oid, r] of Object.entries(spOrders)){
    if (spNorm(r) === 'hoan_thanh' && !spRefundedIds.has(oid)) spCompleted[oid] = r;
  }
  if (Object.keys(spUnknownStatus).length){
    warnings.push('Shopee: gặp trạng thái đơn LẠ chưa có trong bảng map (đang tạm tính là "đang xử lý"): '
      + Object.entries(spUnknownStatus).map(([k, c]) => `"${k}" (${c} đơn)`).join(', ')
      + ' — cần bổ sung vào spStatusNorm() kẻo đếm huỷ/hoàn thành bị sai.');
  }

  // ---------- Doanh thu hàng theo ĐỊNH NGHĨA ĐÃ CHỐT 20/10/2026 (lỗi #2):
  // tiền hàng sau giảm giá CỦA SHOP, trước trợ giá sàn, không gồm ship.
  // Shopee: Σ dòng (Giá gốc × SL − "Tổng số tiền được người bán trợ giá")
  //         − "Mã giảm giá của Shop" − "Giảm giá từ Combo của Shop" (1 lần/đơn).
  // BẪY (đã kiểm chứng trên file + seller center 20/10): Giá gốc/Giá ưu đãi là
  // ĐƠN GIÁ 1 cái; "Người bán trợ giá"/"Tổng số tiền được người bán trợ giá"
  // là TỔNG CẢ DÒNG; 2 cột mã giảm giá là số mức ĐƠN lặp trên mọi dòng SKU.
  const spHdrKeys = spRows.length ? Object.keys(spRows[0]) : [];
  const C_SP_GIA_GOC = findColKey(spHdrKeys, [/^giá\s*gốc$/i]);
  const C_SP_SL_REV = findColKey(spHdrKeys, [/^số\s*lượng$/i]);
  const C_SP_NB_TRO_GIA = findColKey(spHdrKeys, [/^tổng\s*số\s*tiền\s*được\s*người\s*bán\s*trợ\s*giá$/i, /^người\s*bán\s*trợ\s*giá$/i]);
  const C_SP_MA_GG_SHOP = findColKey(spHdrKeys, [/^mã\s*giảm\s*giá\s*của\s*shop$/i]);
  const C_SP_GG_COMBO_SHOP = findColKey(spHdrKeys, [/^giảm\s*giá\s*từ\s*combo\s*của\s*shop$/i]);
  const spRevCanCompute = !!(C_SP_GIA_GOC && C_SP_SL_REV && C_SP_NB_TRO_GIA);
  const spOrderRevenue = {}; // mã đơn -> doanh thu hàng theo định nghĩa
  if (spRevCanCompute){
    const seenVoucher = new Set();
    for (const r of spRows){
      const oid = r['Mã đơn hàng'];
      if (oid === undefined || oid === null) continue;
      if (!(oid in spOrderRevenue)) spOrderRevenue[oid] = 0;
      spOrderRevenue[oid] += num(r[C_SP_GIA_GOC]) * num(r[C_SP_SL_REV]) - num(r[C_SP_NB_TRO_GIA]);
      if (!seenVoucher.has(oid)){
        seenVoucher.add(oid); // mức đơn — trừ đúng 1 lần
        spOrderRevenue[oid] -= num(C_SP_MA_GG_SHOP ? r[C_SP_MA_GG_SHOP] : 0) + num(C_SP_GG_COMBO_SHOP ? r[C_SP_GG_COMBO_SHOP] : 0);
      }
    }
  } else {
    warnings.push('Shopee: thiếu cột để tính "Doanh thu hàng" theo định nghĩa mới (cần "Giá gốc", "Số lượng", "Tổng số tiền được người bán trợ giá") — đang dùng tạm công thức cũ "Tổng giá trị đơn hàng (VND)". Cột đọc được: ' + spHdrKeys.join(' | '));
  }
  const spRevenueCu = Object.values(spCompleted).reduce((s, r) => s + num(r['Tổng giá trị đơn hàng (VND)']), 0);
  const spRevenue = spRevCanCompute
    ? Object.keys(spCompleted).reduce((s, oid) => s + (spOrderRevenue[oid] || 0), 0)
    : spRevenueCu;
  // GMV đặt = doanh thu hàng của MỌI đơn đặt trong kỳ chưa huỷ (kể cả đang
  // giao/đang xử lý) — phục vụ biểu đồ 2 đường và P&L sau này.
  const spGmvDat = spRevCanCompute
    ? Object.keys(spOrders).reduce((s, oid) => s + (spCancelAllIds.has(oid) ? 0 : (spOrderRevenue[oid] || 0)), 0)
    : null;

  // Phí sàn ƯỚC TÍNH từ file đơn hàng (công thức cũ) — chỉ còn dùng cho
  // Slove/Tlove (giữ nguyên định nghĩa 2 chỉ số đã quen); "Tổng chi phí sàn"
  // trên dashboard đã chuyển sang phí THẬT từ file tài chính (mục 6b dưới).
  let spPhiSan = 0, spTroGia = 0;
  for (const r of Object.values(spOrders)){
    if (spNorm(r) === 'huy') continue;
    spPhiSan += num(r['Phí cố định']) + num(r['Phí Dịch Vụ']) + num(r['Phí xử lý giao dịch']);
    spTroGia += num(r['Được Shopee trợ giá']) + num(r['Mã giảm giá của Shopee']) + num(r['Phí vận chuyển tài trợ bởi Shopee (dự kiến)']);
  }
  spPhiSan = Math.abs(spPhiSan);

  // (rà soát 22/10/2026) KIỂM TRA CỘT SỐNG CÒN — trước đây phía Shopee đọc cột
  // bằng tên CỨNG: Shopee đổi một chữ trong tiêu đề là giá trị thành undefined
  // → num() trả 0 → Slove/PiShip/trợ giá âm thầm sai mà không có cảnh báo nào
  // (phía TikTok đã có cơ chế này từ trước). Giờ thiếu cột nào là báo ngay.
  const spColCheck = [
    ['Mã đơn hàng', spHdrKeys, 'không gom được đơn — mọi số Shopee sẽ sai'],
    ['Trạng Thái Đơn Hàng', spHdrKeys, 'không phân biệt được hoàn thành/huỷ'],
    ['Ngày đặt hàng', spHdrKeys, 'mất biểu đồ theo ngày và khoảng ngày của kỳ'],
    ['Phí cố định', spHdrKeys, 'Slove sai (mẫu số thiếu)'],
    ['Phí Dịch Vụ', spHdrKeys, 'Slove sai (mẫu số thiếu)'],
    ['Phí xử lý giao dịch', spHdrKeys, 'Slove sai (mẫu số thiếu)'],
    ['Được Shopee trợ giá', spHdrKeys, 'Slove sai (tử số thiếu)'],
    ['Mã giảm giá của Shopee', spHdrKeys, 'Slove sai (tử số thiếu)'],
  ];
  const spColMissing = spColCheck.filter(([name, keys]) => !keys.includes(name));
  if (spHdrKeys.length && spColMissing.length){
    warnings.push('Shopee "tất cả đơn hàng": THIẾU CỘT ' + spColMissing.map(([n, , hq]) => `"${n}" (${hq})`).join('; ')
      + '. Sàn có thể đã đổi tên cột — số liệu liên quan đang bị tính bằng 0. Cột thực đọc được: ' + spHdrKeys.join(' | '));
  }

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
      trangThai: r['Trạng thái Trả hàng/Hoàn tiền'] || null,
    });
  }
  // (lỗi #5) Đơn trả CHƯA chốt hoàn tiền nhưng ĐÃ có mã vận đơn trả (hàng đang
  // trên đường về kho) — trước đây bị bỏ qua hoàn toàn tới khi "Đã hoàn tiền
  // cho Người mua", giờ vào danh sách hoàn về kho kèm cột trạng thái.
  const spDonTraIds = new Set(Object.keys(spDonTra));
  const spTraDangXuLySeen = new Set();
  for (const r of rrRows){
    const oid = r['Mã đơn hàng'];
    if (oid === undefined || spDonTraIds.has(oid) || spTraDangXuLySeen.has(oid)) continue;
    const mvd = r['Mã vận đơn trả hàng'];
    if (!mvd || String(mvd).trim() === '') continue;
    spTraDangXuLySeen.add(oid);
    spHoanVeKhoDetail.push({
      oid, sanPham: 'Shopee', loai: 'Đơn trả ĐANG XỬ LÝ (có mã vận đơn trả)',
      ngay: r['Thời gian hoàn trả hàng thành công'] || null,
      maVanDon: mvd,
      ngayDatHang: r['Ngày đặt hàng'] || null,
      trangThai: r['Trạng thái Trả hàng/Hoàn tiền'] || null,
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
  let trRows = rowsAsDicts(trAOA, 0);
  // "Chốt lại tháng" (lỗi #5): gộp file trả hàng TikTok của tháng sau — chỉ
  // nhận yêu cầu trả thuộc đơn đặt kỳ này; dòng tháng sau ghi đè theo
  // "Return Order ID" (trạng thái mới hơn).
  if (aoa.tiktokReturnsNext){
    const byRid = {};
    const ridOf = (r, i) => (r['Return Order ID'] !== undefined && r['Return Order ID'] !== null) ? String(r['Return Order ID']) : ('row' + i);
    trRows.forEach((r, i) => { byRid[ridOf(r, i)] = r; });
    let nextCount = 0;
    rowsAsDicts(aoa.tiktokReturnsNext, 0).forEach((r, i) => {
      const oid = r['Order ID'];
      if (oid === undefined || !(oid in ttOrders)) return;
      byRid[ridOf(r, 'next' + i)] = r; nextCount++;
    });
    trRows = Object.values(byRid);
    warnings.push(`Chốt lại tháng: đã gộp thêm file Trả hàng TikTok của tháng sau — ${nextCount} yêu cầu trả thuộc đơn đặt kỳ này được cập nhật theo trạng thái mới nhất.`);
  }
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
  // Trạng thái chuẩn hoá TikTok (lỗi #7)
  const ttUnknownStatus = {};
  function ttNorm(r){
    const n = ttStatusNorm(r['Order Status']);
    if (n === null){
      const raw = String(r['Order Status'] || '(trống)');
      ttUnknownStatus[raw] = (ttUnknownStatus[raw] || 0) + 1;
      return 'dang_xu_ly';
    }
    return n;
  }
  const ttCancelledNative = {};
  for (const [oid, r] of Object.entries(ttOrders)) if (ttNorm(r) === 'huy') ttCancelledNative[oid] = r;
  const ttHdrKeys0 = ttRows.length ? Object.keys(ttRows[0]) : [];

  const C_TT_SHIPPED = findColKey(ttHdrKeys0, [/^shipped\s*time$/i]);
  const ttDaGuiIds = new Set();
  if (C_TT_SHIPPED){
    for (const [oid, r] of Object.entries(ttOrders)){
      if (String(r[C_TT_SHIPPED] || '').trim()) ttDaGuiIds.add(oid);
    }
  } else {
    warnings.push('TikTok: không thấy cột "Shipped Time" — chưa đếm được "đơn đã gửi".');
  }

  const ttRefundedIds = new Set([...Object.keys(ttDonTra), ...Object.keys(ttDonHoan)]);
  const ttCompleted = {};
  for (const [oid, r] of Object.entries(ttOrders)){
    if (ttNorm(r) === 'hoan_thanh' && !ttRefundedIds.has(oid)) ttCompleted[oid] = r;
  }
  if (Object.keys(ttUnknownStatus).length){
    warnings.push('TikTok: gặp trạng thái đơn LẠ chưa có trong bảng map (đang tạm tính là "đang xử lý"): '
      + Object.entries(ttUnknownStatus).map(([k, c]) => `"${k}" (${c} đơn)`).join(', ')
      + ' — cần bổ sung vào ttStatusNorm() kẻo đếm huỷ/hoàn thành bị sai.');
  }

  // ---------- Doanh thu hàng TikTok theo ĐỊNH NGHĨA ĐÃ CHỐT (lỗi #2):
  // Σ dòng SKU (SKU Subtotal Before Discount − SKU Seller Discount) theo đơn
  // — trước trợ giá sàn (Platform Discount), không gồm ship. 2 cột này là
  // TỔNG CẢ DÒNG (TikTok tự ghi chú trong file). Công thức cũ "Order Amount"
  // = tiền khách trả (lẫn ship khách trả, đã trừ trợ giá sàn) — giữ lại để so.
  const ttHdrKeys = ttRows.length ? Object.keys(ttRows[0]) : [];
  const C_TT_BEFORE = findColKey(ttHdrKeys, [/^sku\s*subtotal\s*before\s*discount$/i]);
  const C_TT_SELLER_DISC = findColKey(ttHdrKeys, [/^sku\s*seller\s*discount$/i]);
  const ttRevCanCompute = !!(C_TT_BEFORE && C_TT_SELLER_DISC);
  const ttOrderRevenue = {};
  if (ttRevCanCompute){
    for (const r of ttRows){
      const oid = r['Order ID'];
      // bỏ dòng mô tả cột (dòng 2 của file TikTok) và dòng không có ID thật
      if (oid === undefined || oid === null || !/^\d{6,}$/.test(String(oid).trim())) continue;
      if (!(oid in ttOrderRevenue)) ttOrderRevenue[oid] = 0;
      ttOrderRevenue[oid] += num(r[C_TT_BEFORE]) - num(r[C_TT_SELLER_DISC]);
    }
  } else {
    warnings.push('TikTok: thiếu cột "SKU Subtotal Before Discount"/"SKU Seller Discount" để tính "Doanh thu hàng" theo định nghĩa mới — đang dùng tạm công thức cũ "Order Amount". Cột đọc được: ' + ttHdrKeys.join(' | '));
  }
  const ttRevenueCu = Object.values(ttCompleted).reduce((s, r) => s + num(r['Order Amount']), 0);
  const ttRevenue = ttRevCanCompute
    ? Object.keys(ttCompleted).reduce((s, oid) => s + (ttOrderRevenue[oid] || 0), 0)
    : ttRevenueCu;
  const ttGmvDat = ttRevCanCompute
    ? Object.keys(ttOrders).reduce((s, oid) => s + ((oid in ttCancelledNative) ? 0 : (ttOrderRevenue[oid] || 0)), 0)
    : null;

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
  // Danh sách cột LUÔN lấy từ dòng tiêu đề của file, không lấy từ dòng dữ liệu
  // đầu tiên (xem ghi chú trong rowsAsDicts) — gộp thêm khoá của dòng đầu cho chắc.
  const finHeaderFromAOA = (finAOA && finAOA[0] ? finAOA[0] : []).map(nfc).filter(v => v !== null && v !== undefined && v !== '');
  const finHeaderKeys = finHeaderFromAOA.length
    ? Array.from(new Set(finHeaderFromAOA.concat(finRows.length ? Object.keys(finRows[0]) : [])))
    : (finRows.length ? Object.keys(finRows[0]) : []);

  const COL_LOAI_GD = findColKey(finHeaderKeys, [/^loại\s*giao\s*dịch$/i, /loại.*giao.*dịch/i]);
  const COL_PHI_XU_LY = findColKey(finHeaderKeys, [/phí.*xử\s*lý.*đơn/i]);
  const COL_PHI_GIAO_DICH = findColKey(finHeaderKeys, [/^phí\s*giao\s*dịch$/i, /^phí\s*giao\s*dịch\b/i]);
  const COL_HOA_HONG = findColKey(finHeaderKeys, [/phí.*hoa\s*hồng/i, /hoa\s*hồng.*tiktok/i]);
  const COL_GIAM_GIA_NEN_TANG = findColKey(finHeaderKeys, [/^giảm\s*giá\s*của\s*nền\s*tảng$/i, /giảm\s*giá.*nền\s*tảng/i]);
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

  // ---------- 5b) TikTok: THỰC NHẬN + PHÍ SÀN THẬT từ file tài chính (lỗi #3, #4)
  // Thực nhận = Σ "Tổng số tiền quyết toán" trên MỌI dòng (gồm cả dòng trừ
  // tiền quảng cáo GMV Max) — đúng số tiền sàn thật sự chuyển về.
  // Phí sàn thật = Σ |"Tổng phí"| các dòng "Đơn hàng" TRỪ thuế khấu trừ (thuế
  // là nghĩa vụ thuế của shop, hiện thành dòng riêng, không phải phí sàn).
  const C_FIN_QT = findColKey(finHeaderKeys, [/^tổng\s*số\s*tiền\s*quyết\s*toán$/i]);
  const C_FIN_TONG_PHI = findColKey(finHeaderKeys, [/^tổng\s*phí$/i]);
  const C_FIN_AFF = findColKey(finHeaderKeys, [/^hoa\s*hồng\s*liên\s*kết$/i]);
  const C_FIN_AFF_QC = findColKey(finHeaderKeys, [/^hoa\s*hồng\s*liên\s*kết\s*quảng\s*cáo\s*cửa\s*hàng$/i]);
  const C_FIN_AFF_DT = findColKey(finHeaderKeys, [/^hoa\s*hồng\s*của\s*đối\s*tác\s*liên\s*kết$/i]);
  const C_FIN_AFF_DT_QC = findColKey(finHeaderKeys, [/^hoa\s*hồng\s*quảng\s*cáo\s*cửa\s*hàng\s*của\s*đối\s*tác/i]);
  const C_FIN_SHIP_NB = findColKey(finHeaderKeys, [/^phí\s*vận\s*chuyển\s*của\s*người\s*bán$/i]);
  const C_FIN_SHIP_TT = findColKey(finHeaderKeys, [/^phí\s*vận\s*chuyển\s*thực\s*tế$/i]);
  const C_FIN_SHIP_CK = findColKey(finHeaderKeys, [/^chiết\s*khấu\s*phí\s*vận\s*chuyển\s*của\s*nền\s*tảng$/i]);
  const C_FIN_SHIP_TRA = findColKey(finHeaderKeys, [/^phí\s*vận\s*chuyển\s*trả\s*hàng\s*thực\s*tế$/i]);
  const C_FIN_THUE_GTGT = findColKey(finHeaderKeys, [/^thuế\s*gtgt\s*do\s*tiktok/i]);
  const C_FIN_THUE_TNCN = findColKey(finHeaderKeys, [/^thuế\s*tncn\s*do\s*tiktok/i]);
  const C_FIN_TIEN_HOAN = findColKey(finHeaderKeys, [/^tiền\s*hoàn\s*của\s*khách$/i]);
  const C_FIN_HOAN_SAU_GG = findColKey(finHeaderKeys, [/^tổng\s*phụ\s*của\s*khoản\s*hoàn\s*tiền\s*sau\s*giảm\s*giá/i]);
  // THÊM 28/10/2026 — MẪU SỐ ĐÚNG để tính TỶ LỆ PHÍ. Tuyệt đối không chia phí
  // sàn cho doanh thu của sổ: tử lấy từ file quyết toán (đơn settle trong kỳ),
  // mẫu lấy từ file đơn hàng (đơn ĐẶT trong kỳ) → 2 tập đơn khác nhau, tỷ lệ
  // nhảy ±4 điểm vô nghĩa (đã 2 lần kết luận sai vì nó). Mẫu số phải nằm TRONG
  // CÙNG FILE với tử. Đo thử 12 tháng: "Tổng phụ sau giảm giá của người bán"
  // cho tỷ lệ ổn định 19-23% (T7/T8/T9: 20,07/22,57/20,99%), còn "Tổng phụ
  // trước giảm giá" nhảy 12-21% → chọn cột "sau giảm giá".
  const C_FIN_TIEN_HANG = findColKey(finHeaderKeys, [/^tổng\s*phụ\s*sau\s*giảm\s*giá\s*của\s*người\s*bán$/i]);
  let ttThucNhan = null, ttPhiSanFull = null, ttPhiSanChiTiet = null, ttQuangCaoGmvMax = 0;
  let ttPhiSanMauSo = null;
  // Ship hoàn/huỷ TikTok: chỉ cộng phần ship của ĐÚNG các đơn có hoàn tiền —
  // khoản "Phí vận chuyển shop chịu" tổng gồm cả đơn bán bình thường (freeship),
  // không phải chi phí do hoàn/bom nên không được đem so với gói hoàn phí VC.
  let ttShipHoan = null;
  if (C_FIN_QT && finRows.length){
    ttShipHoan = { traHang: 0, shipShopChiu: 0, soDon: 0 };
    ttPhiSanMauSo = 0;
    ttThucNhan = 0;
    const bd = { 'Phí giao dịch': 0, 'Hoa hồng TikTok Shop': 0, 'Phí xử lý đơn hàng': 0,
      'Hoa hồng affiliate (liên kết)': 0, 'Phí vận chuyển shop chịu': 0, 'Phí vận chuyển trả hàng': 0, 'Phí khác': 0 };
    let tongPhiAbs = 0, thueAbs = 0;
    for (const r of finRows){
      const loai = String(r[COL_LOAI_GD] || '').trim();
      if (!loai) continue;
      ttThucNhan += num(r[C_FIN_QT]);
      if (loai !== 'Đơn hàng'){
        if (/quảng\s*cáo/i.test(loai)) ttQuangCaoGmvMax += Math.abs(num(r[C_FIN_QT]));
        continue;
      }
      // SỬA 28/10/2026 — cộng CÓ DẤU, KHÔNG lấy trị tuyệt đối từng dòng. File
      // tài chính TikTok có dòng HOÀN PHÍ (giá trị DƯƠNG khi sàn trả lại phí của
      // đơn bị hoàn/huỷ): Math.abs() biến khoản trả lại thành khoản phải trả →
      // CỘNG THÊM thay vì TRỪ ĐI. Đếm thật: T1/2026 có 15 dòng hoàn phí, T2 9
      // dòng, T3 6 dòng, T9/2026 4 dòng; phí sàn TikTok bị phồng tổng 1,22tr
      // trong 12 tháng. Lấy abs() MỘT LẦN ở cuối (từng khoản đã net xong).
      const phiGD = num(COL_PHI_GIAO_DICH ? r[COL_PHI_GIAO_DICH] : 0);
      const hhTT = num(COL_HOA_HONG ? r[COL_HOA_HONG] : 0);
      const phiXL = num(COL_PHI_XU_LY ? r[COL_PHI_XU_LY] : 0);
      const aff = num(C_FIN_AFF ? r[C_FIN_AFF] : 0) + num(C_FIN_AFF_QC ? r[C_FIN_AFF_QC] : 0)
        + num(C_FIN_AFF_DT ? r[C_FIN_AFF_DT] : 0) + num(C_FIN_AFF_DT_QC ? r[C_FIN_AFF_DT_QC] : 0);
      // SỬA 23/10/2026 — ship shop chịu = ĐÚNG cột "Phí vận chuyển của người bán".
      // Sheet "Giải thích về phí" của chính TikTok ghi: "Phí vận chuyển của người
      // bán = phí vận chuyển thực tế − giảm phí vận chuyển của nền tảng − phí vận
      // chuyển của khách hàng" (đã kiểm 390/400 dòng khớp), tức cột này ĐÃ LÀ số
      // ròng shop phải chịu. Công thức cũ cộng thêm "thực tế" và "chiết khấu nền
      // tảng" vào nữa nên ĐẾM TRÙNG: T9/2026 ra 3.354.276đ thay vì 1.328.883đ
      // (gấp 2,5 lần), kéo theo bảng phí sàn chi tiết lệch 2,08tr so với tổng.
      const ship = num(C_FIN_SHIP_NB ? r[C_FIN_SHIP_NB] : 0);
      const shipTra = num(C_FIN_SHIP_TRA ? r[C_FIN_SHIP_TRA] : 0);
      const thue = num(C_FIN_THUE_GTGT ? r[C_FIN_THUE_GTGT] : 0) + num(C_FIN_THUE_TNCN ? r[C_FIN_THUE_TNCN] : 0);
      const tongPhi = num(C_FIN_TONG_PHI ? r[C_FIN_TONG_PHI] : 0);
      bd['Phí giao dịch'] += phiGD; bd['Hoa hồng TikTok Shop'] += hhTT; bd['Phí xử lý đơn hàng'] += phiXL;
      bd['Hoa hồng affiliate (liên kết)'] += aff; bd['Phí vận chuyển shop chịu'] += ship; bd['Phí vận chuyển trả hàng'] += shipTra;
      tongPhiAbs += tongPhi; thueAbs += thue;
      ttPhiSanMauSo += num(C_FIN_TIEN_HANG ? r[C_FIN_TIEN_HANG] : 0);
      const tienHoan = Math.abs(num(C_FIN_TIEN_HOAN ? r[C_FIN_TIEN_HOAN] : 0))
        + Math.abs(num(C_FIN_HOAN_SAU_GG ? r[C_FIN_HOAN_SAU_GG] : 0));
      if (tienHoan > 0){
        ttShipHoan.soDon += 1;
        ttShipHoan.traHang += Math.abs(shipTra);
        ttShipHoan.shipShopChiu += Math.abs(ship);
      }
    }
    // Từng khoản giờ là số CÓ DẤU (âm = shop trả) → đổi sang số dương để hiện.
    for (const k of Object.keys(bd)) bd[k] = Math.abs(bd[k]);
    const shipTraAbs = bd['Phí vận chuyển trả hàng'];
    // SỬA 28/10/2026 — cột "Tổng phí" của TikTok KHÔNG gồm phí vận chuyển trả
    // hàng: đã kiểm 5 tháng (03,06,07,08,09/2026) phần vượt bằng ĐÚNG khoản đó
    // tới từng đồng → phải cộng thêm, không thì phí sàn hụt.
    ttPhiSanFull = C_FIN_TONG_PHI
      ? Math.max(0, Math.abs(tongPhiAbs) - Math.abs(thueAbs)) + shipTraAbs
      : Object.values(bd).reduce((s, v) => s + v, 0);
    // Phần dư: KHÔNG kẹp về 0 nữa. Kẹp 0 che mất trường hợp các khoản đã biết
    // VƯỢT tổng (dính thật ở 8/12 tháng) nên bảng chi tiết cộng ra khác tổng mà
    // không ai thấy. Dư dương = khoản phí chưa bóc tên; dư âm = còn sai, phải soi.
    const dkb = bd['Phí giao dịch'] + bd['Hoa hồng TikTok Shop'] + bd['Phí xử lý đơn hàng']
      + bd['Hoa hồng affiliate (liên kết)'] + bd['Phí vận chuyển shop chịu'] + shipTraAbs;
    const du = ttPhiSanFull - dkb;
    if (Math.abs(du) >= 1) bd[du > 0 ? 'Phí khác (chưa bóc tên)' : 'CHƯA KHỚP — các khoản đã biết vượt tổng'] = Math.abs(du);
    delete bd['Phí khác'];
    bd['Thuế khấu trừ (không tính vào phí sàn)'] = Math.abs(thueAbs);
    if (ttQuangCaoGmvMax > 0) bd['Quảng cáo GMV Max (trừ vào quyết toán, không tính vào phí sàn)'] = ttQuangCaoGmvMax;
    ttPhiSanChiTiet = bd;
  } else {
    warnings.push('TikTok: không tìm thấy cột "Tổng số tiền quyết toán" trong file tài chính — chưa tính được THỰC NHẬN và phí sàn thật. Cột đọc được: ' + finHeaderKeys.join(' | '));
  }

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
      trangThai: r['Return Status'] || null,
    });
  }
  // (lỗi #5) Đơn trả TikTok CHƯA Completed nhưng đã có mã vận đơn trả — hàng
  // đang về kho, vào danh sách kèm trạng thái (trước đây bị bỏ tới khi Completed).
  const ttTraSeen = new Set(Object.keys(ttDonTra));
  for (const r of trRows){
    const oid = r['Order ID'];
    if (oid === undefined || ttTraSeen.has(oid)) continue;
    if (r['Return Status'] === 'Completed') continue; // đã xử lý ở trOrders (Refund only không có hàng về)
    const mvd = r['Return Logistics Tracking ID'];
    if (!mvd || String(mvd).trim() === '') continue;
    ttTraSeen.add(oid);
    ttHoanVeKhoDetail.push({
      oid, sanPham: 'TikTok', loai: 'Đơn trả ĐANG XỬ LÝ (có mã vận đơn trả)',
      ngay: r['Time Requested'] || null, maVanDon: mvd,
      ngayDatHang: (ttOrders[oid] && ttOrders[oid]['Created Time']) || null,
      trangThai: r['Return Status'] || null,
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
  // (rà soát 22/10) 2 cột PiShip cũng đọc bằng tên cứng — thiếu thì thẻ "nên
  // đăng ký gói ship" sẽ kết luận sai mà không ai biết, nên cảnh báo rõ.
  {
    const incKeysSom = incRows.length ? Object.keys(incRows[0]) : [];
    const thieu = ['Phí dịch vụ PiShip', 'Phí vận chuyển được hoàn bởi PiShip'].filter(c => !incKeysSom.includes(c));
    if (incKeysSom.length && thieu.length){
      warnings.push('File Income Shopee: thiếu cột ' + thieu.map(c => `"${c}"`).join(', ')
        + ' — thẻ "Gói PiShip nên giữ hay huỷ" đang tính các khoản đó = 0 nên ĐỀ XUẤT có thể sai.');
    }
  }
  const piShipRatio = piShipPhi ? piShipHoan / piShipPhi : 0;

  // ---------- 6b) Quảng cáo Shopee (Dịch vụ Hiển thị) — file CSV tuỳ chọn ----------
  // Shopee KHÔNG đưa tiền quảng cáo vào file Income (đã kiểm: 0 đồng), nên đây
  // là nguồn DUY NHẤT để sổ biết chi phí quảng cáo Shopee thay vì nhập tay.
  // Mỗi dòng là 1 chiến dịch (chiến dịch nhóm hoặc chiến dịch cho 1 listing);
  // cộng hết các dòng ra đúng con số trên dashboard Shopee (đã đối chiếu T8+T9).
  let spAds = null;
  if (aoa.shopeeAds && aoa.shopeeAds.length){
    const adsAOA = aoa.shopeeAds;
    const tieuDe = String((adsAOA[0] || [])[0] || '');
    // dòng tiêu đề cột là dòng bắt đầu bằng "Thứ tự"
    let hIdx = -1;
    for (let i = 0; i < Math.min(adsAOA.length, 20); i++){
      if (String((adsAOA[i] || [])[0] || '').trim() === 'Thứ tự'){ hIdx = i; break; }
    }
    if (hIdx === -1){
      warnings.push('File quảng cáo Shopee: không tìm thấy dòng tiêu đề (ô đầu tiên = "Thứ tự") — bỏ qua file này.');
    } else {
      const adsRows = rowsAsDicts(adsAOA, hIdx);
      const adsKeys = adsRows.length ? Object.keys(adsRows[0]) : [];
      const C_ADS_CHIPHI = findColKey(adsKeys, [/^chi\s*phí$/i]);
      const C_ADS_DOANHSO = findColKey(adsKeys, [/^doanh\s*số$/i]);
      const C_ADS_TEN = findColKey(adsKeys, [/^tên\s*dịch\s*vụ\s*hiển\s*thị$/i, /^chiến\s*dịch\s*\/\s*tên\s*sản\s*phẩm$/i]);
      const C_ADS_TT = findColKey(adsKeys, [/^trạng\s*thái$/i]);
      if (!C_ADS_CHIPHI){
        warnings.push('File quảng cáo Shopee: không thấy cột "Chi phí" — cột đọc được: ' + adsKeys.join(' | '));
      } else {
        // File "Chiến dịch nhóm" có dòng CON (từng sản phẩm trong nhóm, cột
        // "Trạng thái" = "-") — cộng cả dòng con là NHÂN ĐÔI. Chỉ lấy dòng cấp
        // chiến dịch. File CPC đầy đủ thì mọi dòng đều là cấp chiến dịch.
        const laFileNhom = /^Chiến dịch nhóm\s*-\s*Shopee/i.test(tieuDe);
        const dong = adsRows.filter(r => {
          const stt = String(r['Thứ tự'] !== undefined ? r['Thứ tự'] : '').trim();
          if (!/^\d+$/.test(stt)) return false;
          if (laFileNhom && C_ADS_TT) return !['-', ''].includes(String(r[C_ADS_TT] || '').trim());
          return true;
        });
        const chiPhi = dong.reduce((t, r) => t + Math.abs(num(r[C_ADS_CHIPHI])), 0);
        const doanhSo = C_ADS_DOANHSO ? dong.reduce((t, r) => t + num(r[C_ADS_DOANHSO]), 0) : null;
        spAds = {
          chiPhi, doanhSo,
          roas: (doanhSo && chiPhi) ? doanhSo / chiPhi : null,
          soChienDich: dong.length,
          thieuChienDichLe: laFileNhom,
          chiTiet: dong.map(r => ({
            ten: C_ADS_TEN ? String(r[C_ADS_TEN] || '') : '',
            chiPhi: Math.abs(num(r[C_ADS_CHIPHI])),
            doanhSo: C_ADS_DOANHSO ? num(r[C_ADS_DOANHSO]) : null,
          })).sort((a, b) => b.chiPhi - a.chiPhi),
        };
        if (laFileNhom){
          warnings.push('Quảng cáo Shopee: file đang dùng là loại "Chiến dịch nhóm" — loại này CHỈ gồm chiến dịch nhóm, THIẾU các chiến dịch chạy riêng cho từng sản phẩm (tháng 8/2026 thiếu 2.137.858đ). Tải lại bằng "Tải dữ liệu → Số liệu thống kê chung" (file có tiêu đề "Báo cáo Dịch vụ Hiển thị trả theo CPC").');
        }
      }
    }
  }

  // ---------- 7) Income — Service Fee Details (Voucher Xtra + Phí Hạ Tầng) ----------
  const sfdAOA = aoa.income_ServiceFee;
  const sfdRows = rowsAsDicts(sfdAOA, 1);
  // 28/10/2026 — Shopee ĐÃ ĐỔI TÊN CỘT ở sheet này 3 lần, nên phải khớp theo
  // CHUỖI CHỨA chứ không khớp tên chính xác:
  //   09–10/2025: "Gói Content Xtra" | "Gói Voucher Xtra" | "Phí Hạ Tầng"
  //   11/2025–01/2026: "Phí Hạ Tầng" | "Voucher Xtra 2.5%" | "Voucher Xtra 3%"
  //   02/2026→nay: "Phí Hạ Tầng" | "Voucher Xtra"
  // Khớp đúng tên 'Voucher Xtra' nên 4 tháng cũ đọc ra 0 (11/2025 hụt
  // 7.024.859đ, 09/2025 hụt 556.723đ). CHÚ Ý: 2 số này CHỈ để hiện "trong đó",
  // KHÔNG cộng vào phí sàn — tổng đã nằm ở cột "Phí dịch vụ" (sheet Doanh thu).
  const sfdSumWhere = (test) => sfdRows.reduce((s, r) => {
    let t = 0;
    for (const k of Object.keys(r)) if (test(String(k))) t += Math.abs(num(r[k]));
    return s + t;
  }, 0);
  const voucherXtraTotal = sfdSumWhere((k) => /voucher\s*xtra|content\s*xtra/i.test(k));
  const phiHaTangTotal = sfdSumWhere((k) => /^phí\s*hạ\s*tầng$/i.test(k.trim()));

  // ---------- 7b) Shopee: THỰC NHẬN + PHÍ SÀN THẬT từ file Income (lỗi #3, #4)
  // Thực nhận = Σ "Tổng tiền đã thanh toán" (dòng Order, sheet "Doanh thu")
  //            + "Tổng số tiền điều chỉnh" (sheet Adjustment, nếu có).
  // Phí sàn thật = cộng đủ các loại phí trên từng đơn đã phát hành + Voucher
  // Xtra + Phí Hạ Tầng (sheet Service Fee Details). Thuế khấu trừ hiện riêng,
  // không tính vào phí sàn.
  const incHdrKeys = incRows.length ? Object.keys(incRows[0]) : [];
  const C_INC_PAID = findColKey(incHdrKeys, [/^tổng\s*tiền\s*đã\s*thanh\s*toán$/i]);
  const C_INC_PHI_CD = findColKey(incHdrKeys, [/^phí\s*cố\s*định$/i]);
  const C_INC_PHI_DV = findColKey(incHdrKeys, [/^phí\s*dịch\s*vụ$/i]);
  const C_INC_PHI_XLGD = findColKey(incHdrKeys, [/^phí\s*xử\s*lý\s*giao\s*dịch$/i]);
  const C_INC_HH_TTLK = findColKey(incHdrKeys, [/^phí\s*hoa\s*hồng\s*tiếp\s*thị\s*liên\s*kết$/i]);
  const C_INC_PISHIP = findColKey(incHdrKeys, [/^phí\s*dịch\s*vụ\s*piship$/i]);
  const C_INC_HIEN_THI = findColKey(incHdrKeys, [/^phí\s*dịch\s*vụ\s*hiển\s*thị/i]);
  const C_INC_VC_TRA_1 = findColKey(incHdrKeys, [/^phí\s*vận\s*chuyển\s*trả\s*hàng\s*\(đơn\s*trả/i]);
  const C_INC_VC_TRA_2 = findColKey(incHdrKeys, [/^phí\s*vận\s*chuyển\s*trả\s*hàng\s*\(đơn\s*giao/i]);
  const C_INC_THUE_GTGT = findColKey(incHdrKeys, [/^thuế\s*gtgt$/i]);
  const C_INC_THUE_TNCN = findColKey(incHdrKeys, [/^thuế\s*tncn$/i]);
  // Mẫu số đúng cho tỷ lệ phí Shopee = "Giá sản phẩm" của chính các đơn trong
  // file này. Đã xác minh đây ĐÚNG là cơ sở Shopee thu phí cố định: 115/156 đơn
  // T8 và 86/171 đơn T9 có phí cố định = ĐÚNG 16,5% cột này (số còn lại 15,5%).
  const C_INC_TIEN_HANG = findColKey(incHdrKeys, [/^giá\s*sản\s*phẩm$/i]);
  let spThucNhan = null, spPhiSanFull = null, spPhiSanChiTiet = null, spDieuChinh = 0;
  // Ship hoàn/huỷ Shopee tách 2 loại + số gói PiShip (phục vụ câu "nên đăng ký
  // gói hoàn phí vận chuyển không?"). Tách riêng vì PiShip chỉ hoàn phần đơn
  // Trả hàng/hoàn tiền, KHÔNG hoàn đơn giao không thành công.
  let spShipHoan = null, spPhiSanMauSo = null;
  if (C_INC_PAID && incOrderRows.length){
    spPhiSanMauSo = incOrderRows.reduce((t, r) => t + Math.abs(num(C_INC_TIEN_HANG ? r[C_INC_TIEN_HANG] : 0)), 0);
    if (aoa.income_Adjustment){
      const adjRaw = findLabeledValue(aoa.income_Adjustment, 'Tổng số tiền điều chỉnh');
      if (adjRaw !== null && adjRaw !== undefined) spDieuChinh = num(adjRaw);
    }
    spThucNhan = incOrderRows.reduce((s, r) => s + num(r[C_INC_PAID]), 0) + spDieuChinh;
    const bd = { 'Phí cố định': 0, 'Phí dịch vụ': 0, 'Phí xử lý giao dịch': 0,
      'Hoa hồng affiliate (tiếp thị liên kết)': 0, 'Phí dịch vụ PiShip': 0, 'Phí hiển thị NTTD': 0,
      'Phí vận chuyển trả hàng': 0 };
    let thueAbs = 0;
    for (const r of incOrderRows){
      bd['Phí cố định'] += Math.abs(num(C_INC_PHI_CD ? r[C_INC_PHI_CD] : 0));
      bd['Phí dịch vụ'] += Math.abs(num(C_INC_PHI_DV ? r[C_INC_PHI_DV] : 0));
      bd['Phí xử lý giao dịch'] += Math.abs(num(C_INC_PHI_XLGD ? r[C_INC_PHI_XLGD] : 0));
      bd['Hoa hồng affiliate (tiếp thị liên kết)'] += Math.abs(num(C_INC_HH_TTLK ? r[C_INC_HH_TTLK] : 0));
      bd['Phí dịch vụ PiShip'] += Math.abs(num(C_INC_PISHIP ? r[C_INC_PISHIP] : 0));
      bd['Phí hiển thị NTTD'] += Math.abs(num(C_INC_HIEN_THI ? r[C_INC_HIEN_THI] : 0));
      bd['Phí vận chuyển trả hàng'] += Math.abs(num(C_INC_VC_TRA_1 ? r[C_INC_VC_TRA_1] : 0)) + Math.abs(num(C_INC_VC_TRA_2 ? r[C_INC_VC_TRA_2] : 0));
      thueAbs += Math.abs(num(C_INC_THUE_GTGT ? r[C_INC_THUE_GTGT] : 0)) + Math.abs(num(C_INC_THUE_TNCN ? r[C_INC_THUE_TNCN] : 0));
    }
    spShipHoan = {
      traHang: incOrderRows.reduce((s, r) => s + Math.abs(num(C_INC_VC_TRA_1 ? r[C_INC_VC_TRA_1] : 0)), 0),
      giaoKhongTC: incOrderRows.reduce((s, r) => s + Math.abs(num(C_INC_VC_TRA_2 ? r[C_INC_VC_TRA_2] : 0)), 0),
      goiPhi: piShipPhi, goiHoan: piShipHoan,
    };
    // SỬA 28/10/2026 — "Phí dịch vụ" (sheet "Doanh thu") ĐÃ LÀ TỔNG của
    // "Phí Hạ Tầng" + "Voucher Xtra". Sheet "Service Fee Details" dùng tiêu đề
    // 2 TẦNG: dòng 1 ô C ghi "Phí Dịch Vụ" trải ngang 2 cột, dòng 2 mới là tên
    // 2 cột con. Công thức cũ cộng CẢ cột tổng LẪN 2 cột con → ĐẾM 2 LẦN; đã
    // kiểm 8/12 tháng có Hạ tầng + Voucher Xtra = Phí dịch vụ khớp từng đồng,
    // phí sàn Shopee bị thừa 39.294.669đ trong 12 tháng (nặng nhất T1/2026
    // thừa 14.006.400đ). 4 tháng cũ (09–11/2025, 01/2026) lệch thêm vì hồi đó
    // phí dịch vụ còn thành phần thứ ba không có cột riêng → GIỮ cột tổng và
    // chỉ hiện 2 cột con dạng "trong đó" (không cộng), đúng cho cả 12 tháng.
    spPhiSanFull = Object.values(bd).reduce((s, v) => s + v, 0);
    bd['Trong đó: Phí hạ tầng (không tính vào phí sàn — đã nằm trong Phí dịch vụ)'] = phiHaTangTotal;
    bd['Trong đó: Voucher Xtra / Freeship Xtra (không tính vào phí sàn — đã nằm trong Phí dịch vụ)'] = voucherXtraTotal;
    bd['Thuế khấu trừ (không tính vào phí sàn)'] = thueAbs;
    if (spDieuChinh !== 0) bd['Điều chỉnh (đã cộng vào thực nhận, không phải phí)'] = spDieuChinh;
    spPhiSanChiTiet = bd;
  } else {
    warnings.push('Shopee: không tìm thấy cột "Tổng tiền đã thanh toán" trong file Income (sheet "Doanh thu") — chưa tính được THỰC NHẬN và phí sàn thật. Cột đọc được: ' + incHdrKeys.join(' | '));
  }

  // ---------- 8) Slove / Tlove ----------
  // Mẫu số = phí THẬT từ file tài chính (spPhiSanFull/ttPhiSanFull); thiếu file
  // thì rơi về phí ước tính từ file đơn hàng.
  const sloveHotro = spTroGia;
  const slovePhi = (spPhiSanFull !== null ? spPhiSanFull : spPhiSan) + piShipPhi;
  const slove = slovePhi ? sloveHotro / slovePhi : 0;
  const tloveHotro = ttTroGia;
  const tlovePhi = ttPhiSanFull !== null ? ttPhiSanFull : ttPhiSan;
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
  // (rà soát 22/10/2026) TRƯỚC ĐÂY chỉ lấy từ đơn Shopee → tháng nào Shopee
  // không bán ngày đầu/cuối là periodDays ngắn lại, SL bán/ngày và đơn/ngày hoà
  // vốn bị thổi lên; Shopee trống hẳn thì periodDays = null, mất luôn cột
  // sp/ngày. Giờ lấy khoảng ngày của CẢ 2 SÀN.
  let minDate = null, maxDate = null;
  function trackDate(v){
    const d = toDate(v);
    if (!d) return;
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }
  for (const r of Object.values(spOrders)) trackDate(r['Ngày đặt hàng']);
  for (const r of Object.values(ttOrders)) trackDate(r['Created Time']);

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
  // số theo ngày cũng dùng "Doanh thu hàng" định nghĩa mới (khớp với KPI tổng)
  for (const [oid, r] of Object.entries(spCompleted)) addDaily(r['Ngày đặt hàng'], 'shopee', spRevCanCompute ? (spOrderRevenue[oid] || 0) : num(r['Tổng giá trị đơn hàng (VND)']));
  for (const [oid, r] of Object.entries(ttCompleted)) addDaily(r['Created Time'], 'tiktok', ttRevCanCompute ? (ttOrderRevenue[oid] || 0) : num(r['Order Amount']));
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
  const tongDaGui = spDaGuiIds.size + ttDaGuiIds.size;
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
  // XXXL đứng trước XXL/XL vì so khớp tuần tự theo ĐUÔI chuỗi — thiếu nó thì
  // "CL01-XXXL" không tách được size, tra giá vốn theo cả chuỗi và báo thiếu.
  const SIZE_TOKENS = ['XXXL', '3XL', '2XL', 'XXL', 'XL', 'S', 'M', 'L'];
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
  // Bảng tra cứu SKU DỰ PHÒNG — chỉ dùng khi chưa tải được sku-catalog.json
  // (danh mục thật từ API Sapo, sinh bởi tools/build_sku_catalog.py — lỗi #1
  // doc Chuẩn hoá 10/2026). Đã sửa 2 lỗi bảng cứng cũ theo Sapo/sheet Sku:
  // CL11 = Caro Hồng (trước ghi nhầm Thỏ Nơ), thêm QS-CT-04.
  const SKU_DISPLAY_NAME = {
    CL01: 'Chất Lông-Shin', CL02: 'Chất Lông-Hello Kitty', CL03: 'Chất Lông-Vịt Xanh',
    CL04: 'Chất Lông-Lợn Hồng', CL05: 'Chất Lông-Kuromi', CL06: 'Chất Lông-Shin 02',
    CL07: 'Chất Lông-Shin 03', CL08: 'Chất Lông-Patrick Star', CL09: 'Chất Lông-Hello Kitty Hồng',
    CL10: 'Chất Lông-Thỏ Nơ', CL11: 'Chất Lông-Caro Hồng', CL12: 'Chất Lông-Caro Xanh',
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
    'QS-CT-04': 'Quần Short-Shin 04',
  };
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

  // (lỗi #1, sửa 10/2026) Tra theo DANH MỤC SAPO trước (sku-catalog.json):
  // - mã combo (CB-…/CBHH…) → TÁCH thành các SKU con × số lượng (lấy thành
  //   phần thật từ Sapo combos.json, không suy từ chuỗi mã);
  // - mã thường → tên mẫu + size từ Sapo (option1/option2);
  // - không có trong catalog → thử bảng dự phòng; vẫn không có → HIỆN NGUYÊN
  //   MÃ + cảnh báo (trước đây bỏ qua im lặng làm thiếu hẳn combo).
  const skuCatalog = getSkuCatalog();
  const costCatalog = getCostCatalog();
  const skuAgg = {}; // tên hiển thị -> { name, tongSL, sizes, doanhThu, giaVon }
  const skuUnknown = {}; // mã lạ -> SL (gom cảnh báo 1 lần)
  const costMissing = {}; // mã chưa có giá vốn -> SL (cảnh báo, KHÔNG coi giá vốn = 0 trong im lặng)
  // THÊM 28/10/2026 — cộng giá vốn TÁCH THEO SÀN. Trước đây chỉ có giá vốn
  // TỔNG nên sổ không trả lời được "sàn nào lãi thật hơn": phí sàn đã tách sẵn
  // mỗi sàn nhưng giá vốn thì gộp, muốn so biên lãi phải giả định 2 sàn cùng
  // tỷ lệ giá vốn — mà AOV lệch nhau (Shopee 195.515đ vs TikTok 169.775đ ở
  // T9/2026) nên giả định đó không an toàn.
  const giaVonTheoSan = { Shopee: 0, TikTok: 0 };
  const thieuGiaVonTheoSan = { Shopee: 0, TikTok: 0 };
  function pushSkuAgg(name, size, qty, revenue, cost, plat){
    if (!skuAgg[name]) skuAgg[name] = { name, tongSL: 0, sizes: {}, doanhThu: 0, giaVon: 0, thieuGiaVon: 0 };
    const it = skuAgg[name];
    it.tongSL += qty;
    const sizeKey = size || '(không rõ size)';
    it.sizes[sizeKey] = (it.sizes[sizeKey] || 0) + qty;
    it.doanhThu += revenue || 0;
    if (cost === null || cost === undefined){
      it.thieuGiaVon += qty;
      if (plat) thieuGiaVonTheoSan[plat] += qty;
    } else {
      it.giaVon += cost;
      if (plat) giaVonTheoSan[plat] += cost;
    }
  }
  // Tách 1 dòng bán thành các SKU ĐƠN thật sự xuất kho (combo → các SKU con),
  // kèm giá vốn từng phần. Trả [] khi không tra được mã.
  function expandSkuParts(rawCode, qty, depth){
    depth = depth || 0;
    const key = normSkuKey(rawCode);
    if (skuCatalog && depth < 3){ // depth chặn combo lồng combo vòng lặp
      const comboItems = skuCatalog.combos[key];
      if (comboItems && comboItems.length){
        let out = [];
        for (const it of comboItems) out = out.concat(expandSkuParts(it.sku, qty * (num(it.qty) || 1), depth + 1));
        return out;
      }
      const v = skuCatalog.variants[key];
      if (v) return [{ rawCode, qty, name: v.name, size: v.size || splitSkuSize(rawCode).size }];
    }
    const { baseSku, size } = splitSkuSize(rawCode);
    const { name, matched } = resolveSkuName(baseSku);
    if (!matched) skuUnknown[String(rawCode)] = (skuUnknown[String(rawCode)] || 0) + qty;
    return [{ rawCode, qty, name, size }];
  }
  // Giá vốn 1 cái theo MÃ GỐC (bỏ đuôi size) — nguồn cost-catalog.json, sinh
  // từ sheet "GiaCong" cột H của chủ shop.
  function unitCostOf(rawCode){
    if (!costCatalog) return null;
    const { baseSku } = splitSkuSize(rawCode);
    const v = costCatalog[normSkuKey(baseSku)];
    return (v === undefined || v === null) ? null : v;
  }
  /** 1 dòng bán: tách combo, cộng SL + giá vốn, và CHIA doanh thu dòng cho các
   *  SKU con theo tỷ trọng giá vốn (combo bán 1 giá nhưng gồm nhiều SP). */
  function addSkuLine(rawCode, qty, revenue, plat){
    if (!rawCode || !qty) return;
    const parts = expandSkuParts(rawCode, qty, 0);
    if (!parts.length) return;
    const costs = parts.map(p => {
      const u = unitCostOf(p.rawCode);
      if (u === null) costMissing[String(p.rawCode)] = (costMissing[String(p.rawCode)] || 0) + p.qty;
      return (u === null) ? null : u * p.qty;
    });
    const knownTotal = costs.reduce((s, c) => s + (c || 0), 0);
    parts.forEach((p, i) => {
      // phân bổ doanh thu: theo giá vốn nếu biết, không thì chia đều
      const share = knownTotal ? ((costs[i] || 0) / knownTotal) : (1 / parts.length);
      pushSkuAgg(p.name, p.size, p.qty, (revenue || 0) * share, costs[i], plat);
    });
  }
  const skuColMissing = [];
  if (!COL_SP_SKU_SIZE) skuColMissing.push('Shopee: "SKU phân loại hàng"');
  if (!COL_SP_SL) skuColMissing.push('Shopee: "Số lượng"');
  if (!COL_TT_SKU_SIZE) skuColMissing.push('TikTok: "Seller SKU"');
  if (!COL_TT_SL) skuColMissing.push('TikTok: "Quantity"');
  // Doanh thu DÒNG (để tính lãi gộp theo SP): cùng định nghĩa "doanh thu hàng"
  // nhưng ở mức dòng — Shopee chưa trừ voucher mức đơn (voucher không chia được
  // về từng SKU một cách chính xác) nên tổng theo SP cao hơn doanh thu tổng một
  // chút; bảng SP có ghi chú. P&L TỔNG vẫn dùng doanhThu chuẩn (đã trừ voucher).
  if (COL_SP_SKU_SIZE && COL_SP_SL){
    for (const r of spRows){
      const oid = r['Mã đơn hàng'];
      if (oid === undefined || !(oid in spCompleted)) continue;
      const lineRev = spRevCanCompute ? (num(r[C_SP_GIA_GOC]) * num(r[C_SP_SL_REV]) - num(r[C_SP_NB_TRO_GIA])) : 0;
      addSkuLine(r[COL_SP_SKU_SIZE], num(r[COL_SP_SL]), lineRev, 'Shopee');
    }
  }
  if (COL_TT_SKU_SIZE && COL_TT_SL){
    for (const r of ttRows){
      const oid = r['Order ID'];
      if (oid === undefined || !(oid in ttCompleted)) continue;
      const lineRev = ttRevCanCompute ? (num(r[C_TT_BEFORE]) - num(r[C_TT_SELLER_DISC])) : 0;
      addSkuLine(r[COL_TT_SKU_SIZE], num(r[COL_TT_SL]), lineRev, 'TikTok');
    }
  }
  if (!skuCatalog){
    warnings.push('Chưa tải được danh mục SKU từ Sapo (sku-catalog.json) — bảng Hiệu suất SKU/size đang dùng bảng dự phòng trong code: combo KHÔNG được tách thành SKU con. Kiểm tra file sku-catalog.json có được deploy cùng web không.');
  }
  if (Object.keys(skuUnknown).length){
    warnings.push('Hiệu suất SKU/size: ' + Object.keys(skuUnknown).length + ' mã SKU không có trong danh mục Sapo (đang hiện nguyên mã, KHÔNG bỏ): '
      + Object.entries(skuUnknown).map(([k, q]) => `${k} (${q} sp)`).join(', ')
      + ' — nếu là mã mới, chạy lại tools/build_sku_catalog.py để cập nhật danh mục.');
  }
  if (!costCatalog){
    warnings.push('Chưa tải được bảng giá vốn (cost-catalog.json) — tab Lãi lỗ sẽ không có Giá vốn hàng bán/Lãi gộp. Kiểm tra file cost-catalog.json có được deploy cùng web không.');
  } else if (Object.keys(costMissing).length){
    warnings.push('Lãi lỗ: ' + Object.keys(costMissing).length + ' mã SKU CHƯA CÓ GIÁ VỐN (phần đó đang tính giá vốn = thiếu, lãi gộp sẽ CAO hơn thật): '
      + Object.entries(costMissing).map(([k, q]) => `${k} (${q} sp)`).join(', ')
      + ' — bổ sung vào sheet GiaCong rồi nhờ cập nhật lại cost-catalog.json.');
  }
  const periodDays = (minDate && maxDate) ? Math.round((maxDate - minDate) / 86400000) + 1 : null;
  const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '(không rõ size)'];
  const skuPerformance = {
    periodDays,
    items: Object.values(skuAgg).map(item => ({
      ten: item.name, tongSL: item.tongSL,
      doanhThu: item.doanhThu, giaVon: item.giaVon, thieuGiaVon: item.thieuGiaVon,
      laiGop: (costCatalog && !item.thieuGiaVon) ? item.doanhThu - item.giaVon : null,
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

  // Bảng 4 "CTOR/CTR & hiệu quả lượt xem" (2026-09-22, theo yêu cầu chủ shop:
  // "ctor và ctr và tính thêm 1 chỉ số lượt view trên doanh thu") — tự đứng
  // riêng, chỉ cần đúng 1 file "Creator List (Transaction Analysis)", KHÔNG
  // phụ thuộc affiliateOrders/videoAnalysis (khác Bảng 1/2). Lưu ý: GMV trong
  // file này tính cả đơn CHƯA trừ huỷ/hoàn (theo đúng chú thích cột trong file
  // gốc) — khác với "Doanh thu" ở Bảng 1 (chỉ tính đơn "Đã quyết toán") — nên
  // để tên riêng "GMV" ở bảng này, tránh chủ shop nhầm là cùng 1 số với Bảng 1.
  //
  // (2026-09-22, sửa lại theo yêu cầu chủ shop) Ban đầu tính "lượt view trên
  // triệu GMV" (view chia doanh thu — CÀNG THẤP càng tốt) nhưng đổi lại thành
  // "GMV/1.000 view" (doanh thu chia lượt xem — CÀNG CAO càng tốt) để:
  // (1) cùng chiều "cao = tốt" với các chỉ số khác trong dashboard (doanh
  // thu, CTR, CTOR); (2) khớp đúng tinh thần chỉ số GPM đã có sẵn ở Bảng 2
  // ("GPM = doanh thu video liên kết / 1.000 lượt xem") — tránh 2 bảng cùng
  // nói về "hiệu quả view ra tiền" mà lại ngược chiều nhau.
  const kocCtorCtrTable = creatorListRaw ? creatorListRaw
    .map(r => {
      const koc = r['Tên nhà sáng tạo'];
      if (!koc) return null;
      const gmv = parseVndCurrency(r['GMV nhờ nhà sáng tạo']); // dạng "19.645.855₫" — cần bỏ ký hiệu ₫ trước khi parse
      const luotXem = num(r['Lượt xem video']);
      const gmvTren1000View = luotXem ? (gmv / luotXem) * 1000 : null;
      return { koc, gmv, ctor: num(r['CTOR']), ctr: num(r['CTR']), luotXem, gmvTren1000View };
    })
    .filter(Boolean)
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 10) : null;

  const kocTable1 = affRowsRaw ? Object.entries(kocOrders)
    .map(([koc, v]) => ({
      koc, soDon: v.count, doanhThu: v.revenue,
      ctor: creatorCtorMap[koc] !== undefined ? creatorCtorMap[koc] : null,
    }))
    .sort((a, b) => b.doanhThu - a.doanhThu)
    .slice(0, 10) : null;

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
  }).slice(0, 10) : null;

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
  const affiliateKoc = (affRowsRaw || vidRowsRaw || creatorListRaw)
    ? { table1: kocTable1, table2: kocTable2, liveTable: kocLiveTable, ctorCtrTable: kocCtorCtrTable }
    : null;

  // Tự kiểm (lỗi #8): tiền trung bình/đơn < 1.000đ nghĩa là gần như chắc chắn
  // parse số sai định dạng (vd. file xuất kiểu Anh) — cảnh báo ngay.
  const tongHoanThanhCheck = Object.keys(spCompleted).length + Object.keys(ttCompleted).length;
  if (tongHoanThanhCheck > 0 && (spRevenue + ttRevenue) / tongHoanThanhCheck < 1000){
    warnings.push('TỰ KIỂM: doanh thu trung bình/đơn < 1.000đ — gần như chắc chắn file đang dùng định dạng số khác (phẩy/chấm) và bị đọc sai. KHÔNG tin các số tiền của kỳ này cho tới khi kiểm tra lại file.');
  }

  // Phí sàn hiển thị: ưu tiên phí THẬT từ file tài chính; thiếu file thì rơi
  // về số ước tính cũ từ file đơn hàng. Slove/Tlove cũng dùng phí thật.
  const spPhiSanHienThi = (spPhiSanFull !== null) ? spPhiSanFull : spPhiSan;
  const ttPhiSanHienThi = (ttPhiSanFull !== null) ? ttPhiSanFull : ttPhiSan;

  // ---------- P&L (mục 4 doc Chuẩn hoá, 21/10/2026) ----------
  // Giá vốn hàng bán = Σ giá vốn các SKU đã xuất trong ĐƠN HOÀN THÀNH (đúng tập
  // đơn của "Doanh thu hàng", combo đã tách thành SKU con). Phần chi phí vận
  // hành (lương, vật tư, ads) nhập tay 1 lần/tháng ở tab Lãi lỗ, lưu vào chính
  // bản ghi tháng (data.chiPhiVanHanh) — không nằm trong hàm tính này.
  const pnlDoanhThu = spRevenue + ttRevenue;
  const pnlCogs = Object.values(skuAgg).reduce((s, x) => s + x.giaVon, 0);
  const pnlThieuGiaVonSL = Object.values(skuAgg).reduce((s, x) => s + x.thieuGiaVon, 0);
  const pnlPhiSan = spPhiSanHienThi + ttPhiSanHienThi;

  // ===== (rà soát 22/10/2026) 2 lỗi làm LÃI SAI mà trước đây không ai biết =====
  //
  // LỖI A — LỆCH KỲ giữa doanh thu và phí sàn. Doanh thu chỉ tính đơn ĐÃ HOÀN
  // THÀNH (đặt trong kỳ), còn phí sàn lấy từ file tài chính = mọi đơn QUYẾT
  // TOÁN trong kỳ. Xuất file quá sớm sau khi hết tháng → một đống đơn còn "đang
  // giao" chưa kịp thành "hoàn thành" → doanh thu hụt nhưng phí sàn vẫn đủ →
  // lãi tụt giả tạo. Đo thật: T8/2026 xuất file ngày 13-14/09 có 25,5% GMV chưa
  // hoàn thành (các tháng khác chỉ 2-4,6%) → biên lãi báo 10,5% thay vì ~22%.
  const gmvDatTong = (spGmvDat !== null && ttGmvDat !== null) ? spGmvDat + ttGmvDat : null;
  const tyLeChuaHoanThanh = (gmvDatTong && gmvDatTong > 0) ? (gmvDatTong - pnlDoanhThu) / gmvDatTong : null;
  if (tyLeChuaHoanThanh !== null && tyLeChuaHoanThanh > 0.10){
    warnings.push('LỆCH KỲ — số lãi tháng này đang THẤP GIẢ TẠO: '
      + (tyLeChuaHoanThanh * 100).toFixed(1) + '% giá trị đơn (≈ '
      + Math.round(gmvDatTong - pnlDoanhThu).toLocaleString('vi-VN') + 'đ) nằm ở đơn CHƯA hoàn thành nên chưa được tính vào doanh thu, trong khi phí sàn thì đã tính đủ. '
      + 'Nguyên nhân thường gặp: tải file quá sớm sau khi hết tháng. Nên tải lại file 2 sàn sau ngày 15 của tháng kế tiếp rồi bấm "Cập nhật lại lịch sử" (các tháng bình thường chỉ số này là 2-5%).');
  }
  //
  // LỖI B — COGS HỤT khi thiếu giá vốn. Trước đây chỉ cộng giá vốn của mã ĐÃ
  // CÓ trong bảng giá, mã thiếu thì bỏ qua → giá vốn nhỏ hơn thật → lãi gộp và
  // lãi ròng CAO hơn thật, chỉ có 1 dòng cảnh báo đếm số sp chứ không nói mất
  // bao nhiêu tiền. Đo thật: T9/2025 lãi báo 14,3tr nhưng ước tính thật ~9,5tr.
  const pnlSlCoGiaVon = Object.values(skuAgg).reduce((s, x) => s + (x.tongSL - (x.thieuGiaVon || 0)), 0);
  const pnlGiaVonTbCai = pnlSlCoGiaVon ? pnlCogs / pnlSlCoGiaVon : 0;
  const pnlGiaVonThieuUocTinh = Math.round(pnlThieuGiaVonSL * pnlGiaVonTbCai);
  if (pnlGiaVonThieuUocTinh > 0){
    warnings.push('Lãi đang CAO hơn thật khoảng ' + pnlGiaVonThieuUocTinh.toLocaleString('vi-VN') + 'đ: '
      + pnlThieuGiaVonSL + ' sp chưa có giá vốn nên không được trừ vào giá vốn hàng bán '
      + '(ước tính theo giá vốn trung bình ' + Math.round(pnlGiaVonTbCai).toLocaleString('vi-VN') + 'đ/cái). Bổ sung các mã thiếu vào sheet GiaCong để hết sai lệch này.');
  }
  const pnl = {
    coGiaVon: !!costCatalog,
    doanhThu: pnlDoanhThu,
    giaVonHangBan: costCatalog ? pnlCogs : null,
    thieuGiaVonSL: pnlThieuGiaVonSL,
    laiGop: costCatalog ? pnlDoanhThu - pnlCogs : null,
    phiSan: pnlPhiSan,
    quangCaoGmvMax: ttQuangCaoGmvMax || 0,
    quangCaoShopee: spAds ? spAds.chiPhi : null,
    // 2 trường chẩn đoán (rà soát 22/10) để app hiện cảnh báo ngay cạnh số lãi
    giaVonThieuUocTinh: pnlGiaVonThieuUocTinh,
    tyLeChuaHoanThanh,
    doanhThuChuaHoanThanh: (gmvDatTong !== null) ? gmvDatTong - pnlDoanhThu : null,
    // lãi sau phí sàn & quảng cáo — TRƯỚC chi phí vận hành nhập tay
    laiSauPhiSan: costCatalog ? pnlDoanhThu - pnlCogs - pnlPhiSan - (ttQuangCaoGmvMax || 0) : null,
  };

  return {
    warnings, ssWarning, minDate, maxDate,
    shopee: {
      tongDon: Object.keys(spOrders).length, hoanThanh: Object.keys(spCompleted).length,
      daGui: C_SP_TG_GIAO ? spDaGuiIds.size : null,
      doanhThu: spRevenue, doanhThuCu: spRevenueCu, gmvDat: spGmvDat,
      thucNhan: spThucNhan, dieuChinh: spDieuChinh,
      phiSan: spPhiSanHienThi, phiSanUocTinh: spPhiSan, phiSanChiTiet: spPhiSanChiTiet,
      giaVon: costCatalog ? giaVonTheoSan.Shopee : null, thieuGiaVonSL: thieuGiaVonTheoSan.Shopee,
      phiSanMauSo: spPhiSanMauSo,
      phiSanTyLeThat: (spPhiSanMauSo && spPhiSanFull !== null) ? spPhiSanFull / spPhiSanMauSo : null,
      shipHoan: spShipHoan, ads: spAds,
      troGia: spTroGia, doanhThuRong: spRevenue - spPhiSanHienThi,
      huy: spCancelAllIds.size, tra: Object.keys(spDonTra).length, hoan: Object.keys(spDonHoan).length,
      huyHoanTra: spHuyHoanTra, loiShop: spErrTotal, hoanVeKho: spHoanVeKho,
      aov: Object.keys(spCompleted).length ? spRevenue / Object.keys(spCompleted).length : 0,
    },
    tiktok: {
      tongDon: Object.keys(ttOrders).length, hoanThanh: Object.keys(ttCompleted).length,
      daGui: C_TT_SHIPPED ? ttDaGuiIds.size : null,
      doanhThu: ttRevenue, doanhThuCu: ttRevenueCu, gmvDat: ttGmvDat,
      thucNhan: ttThucNhan, quangCaoGmvMax: ttQuangCaoGmvMax,
      phiSan: ttPhiSanHienThi, phiSanUocTinh: ttPhiSan, phiSanChiTiet: ttPhiSanChiTiet,
      giaVon: costCatalog ? giaVonTheoSan.TikTok : null, thieuGiaVonSL: thieuGiaVonTheoSan.TikTok,
      phiSanMauSo: ttPhiSanMauSo ? Math.abs(ttPhiSanMauSo) : null,
      phiSanTyLeThat: (ttPhiSanMauSo && ttPhiSanFull !== null) ? ttPhiSanFull / Math.abs(ttPhiSanMauSo) : null,
      shipHoan: ttShipHoan, ads: { chiPhi: ttQuangCaoGmvMax || 0, doanhSo: null, roas: null },
      troGia: ttTroGia, doanhThuRong: ttRevenue - ttPhiSanHienThi,
      huy: Object.keys(ttCancelledNative).length, tra: Object.keys(ttDonTra).length, hoan: Object.keys(ttDonHoan).length,
      huyHoanTra: ttHuyHoanTra, loiShop: ttErrTotal, hoanVeKho: ttHoanVeKho,
      aov: Object.keys(ttCompleted).length ? ttRevenue / Object.keys(ttCompleted).length : 0,
    },
    tong: {
      doanhThu: spRevenue + ttRevenue, tongDon, hoanThanh: Object.keys(spCompleted).length + Object.keys(ttCompleted).length,
      daGui: (C_SP_TG_GIAO || C_TT_SHIPPED) ? (spDaGuiIds.size + ttDaGuiIds.size) : null,
      doanhThuCu: spRevenueCu + ttRevenueCu,
      gmvDat: (spGmvDat !== null && ttGmvDat !== null) ? spGmvDat + ttGmvDat : null,
      thucNhan: (spThucNhan !== null && ttThucNhan !== null) ? spThucNhan + ttThucNhan : null,
      phiSan: spPhiSanHienThi + ttPhiSanHienThi,
      doanhThuRong: (spRevenue - spPhiSanHienThi) + (ttRevenue - ttPhiSanHienThi),
      aov: (Object.keys(spCompleted).length + Object.keys(ttCompleted).length) ? (spRevenue + ttRevenue) / (Object.keys(spCompleted).length + Object.keys(ttCompleted).length) : 0,
      huyHoanTra: spHuyHoanTra + ttHuyHoanTra, tyLeHuyHoanTra: tongDon ? (spHuyHoanTra + ttHuyHoanTra) / tongDon : 0,
      loiShop: spErrTotal + ttErrTotal, tyLeLoiShop: tongDon ? (spErrTotal + ttErrTotal) / tongDon : 0,
      hoanVeKho: spHoanVeKho + ttHoanVeKho,
    },
    daChotLai: !!(aoa.shopeeReturnRefundNext || aoa.tiktokReturnsNext),
    pnl,
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
  // Trường MỚI (10/2026) có thể thiếu ở tháng lưu bằng công thức cũ: chỉ cộng
  // khi có, và trả null khi KHÔNG tháng nào có (UI sẽ hiện "—").
  function sumOptional(getter){
    let s = 0, any = false;
    for (const d of list){
      const v = getter(d);
      if (v !== null && v !== undefined){ s += num(v) || 0; any = true; }
    }
    return any ? s : null;
  }
  function mergeChiTiet(getter){
    const out = {};
    let any = false;
    for (const d of list){
      const m = getter(d);
      if (!m) continue;
      any = true;
      for (const [k, v] of Object.entries(m)) out[k] = (out[k] || 0) + (num(v) || 0);
    }
    return any ? out : null;
  }

  const shopee = {
    tongDon: sumField(d => d.shopee.tongDon), hoanThanh: sumField(d => d.shopee.hoanThanh),
    daGui: sumOptional(d => d.shopee.daGui),
    doanhThu: sumField(d => d.shopee.doanhThu), phiSan: sumField(d => d.shopee.phiSan),
    doanhThuCu: sumOptional(d => d.shopee.doanhThuCu), gmvDat: sumOptional(d => d.shopee.gmvDat),
    thucNhan: sumOptional(d => d.shopee.thucNhan),
    phiSanUocTinh: sumField(d => (d.shopee.phiSanUocTinh !== undefined && d.shopee.phiSanUocTinh !== null) ? d.shopee.phiSanUocTinh : d.shopee.phiSan),
    phiSanChiTiet: mergeChiTiet(d => d.shopee.phiSanChiTiet),
    shipHoan: mergeChiTiet(d => d.shopee.shipHoan),
    troGia: sumField(d => d.shopee.troGia),
    huy: sumField(d => d.shopee.huy), tra: sumField(d => d.shopee.tra), hoan: sumField(d => d.shopee.hoan),
    huyHoanTra: sumField(d => d.shopee.huyHoanTra), loiShop: sumField(d => d.shopee.loiShop),
    hoanVeKho: sumField(d => d.shopee.hoanVeKho),
  };
  shopee.doanhThuRong = shopee.doanhThu - shopee.phiSan;
  shopee.aov = safeDiv(shopee.doanhThu, shopee.hoanThanh);

  const tiktok = {
    tongDon: sumField(d => d.tiktok.tongDon), hoanThanh: sumField(d => d.tiktok.hoanThanh),
    daGui: sumOptional(d => d.tiktok.daGui),
    doanhThu: sumField(d => d.tiktok.doanhThu), phiSan: sumField(d => d.tiktok.phiSan),
    doanhThuCu: sumOptional(d => d.tiktok.doanhThuCu), gmvDat: sumOptional(d => d.tiktok.gmvDat),
    thucNhan: sumOptional(d => d.tiktok.thucNhan), quangCaoGmvMax: sumOptional(d => d.tiktok.quangCaoGmvMax),
    phiSanUocTinh: sumField(d => (d.tiktok.phiSanUocTinh !== undefined && d.tiktok.phiSanUocTinh !== null) ? d.tiktok.phiSanUocTinh : d.tiktok.phiSan),
    phiSanChiTiet: mergeChiTiet(d => d.tiktok.phiSanChiTiet),
    shipHoan: mergeChiTiet(d => d.tiktok.shipHoan),
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
    doanhThuCu: (shopee.doanhThuCu !== null && tiktok.doanhThuCu !== null) ? shopee.doanhThuCu + tiktok.doanhThuCu : null,
    gmvDat: (shopee.gmvDat !== null && tiktok.gmvDat !== null) ? shopee.gmvDat + tiktok.gmvDat : null,
    thucNhan: (shopee.thucNhan !== null && tiktok.thucNhan !== null) ? shopee.thucNhan + tiktok.thucNhan : null,
    phiSan: shopee.phiSan + tiktok.phiSan, doanhThuRong: shopee.doanhThuRong + tiktok.doanhThuRong,
    aov: safeDiv(tongDoanhThu, tongHoanThanh),
    daGui: (shopee.daGui !== null || tiktok.daGui !== null) ? (shopee.daGui || 0) + (tiktok.daGui || 0) : null,
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
  // Slove/Tlove: mẫu số = phí THẬT (phiSan) khi có file tài chính.
  const slovePhi = shopee.phiSan + piShipPhiSum;
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
  // (21/10/2026) Zone "Khách hàng theo khu vực" đã bỏ khỏi dashboard theo yêu
  // cầu chủ shop — vẫn tính và lưu số để sau cần thì bật lại, nhưng không còn
  // cảnh báo "gộp kỳ là số gần đúng" vì chẳng còn chỗ nào hiển thị nó.

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
      if (!skuMap[item.ten]) skuMap[item.ten] = { ten: item.ten, tongSL: 0, sizes: {}, doanhThu: 0, giaVon: 0, thieuGiaVon: 0, coTien: false };
      const m = skuMap[item.ten];
      m.tongSL += item.tongSL;
      if (item.doanhThu !== undefined){ m.doanhThu += num(item.doanhThu); m.giaVon += num(item.giaVon); m.thieuGiaVon += num(item.thieuGiaVon); m.coTien = true; }
      for (const s of (item.sizes || [])) m.sizes[s.size] = (m.sizes[s.size] || 0) + s.sl;
    }
  }
  const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '(không rõ size)'];
  const skuItems = Object.values(skuMap).map(m => ({
    ten: m.ten, tongSL: m.tongSL,
    slNgay: totalPeriodDays ? m.tongSL / totalPeriodDays : null,
    doanhThu: m.coTien ? m.doanhThu : undefined,
    giaVon: m.coTien ? m.giaVon : undefined,
    thieuGiaVon: m.coTien ? m.thieuGiaVon : undefined,
    laiGop: (m.coTien && !m.thieuGiaVon) ? m.doanhThu - m.giaVon : null,
    sizes: Object.entries(m.sizes).map(([size, sl]) => ({ size, sl, pct: m.tongSL ? sl / m.tongSL : 0 }))
      .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)),
  })).sort((a, b) => b.tongSL - a.tongSL);
  const skuPerformance = Object.keys(skuMap).length ? { periodDays: totalPeriodDays || null, items: skuItems } : null;

  // pnl — cộng các tháng CÓ pnl (tháng lưu công thức cũ chưa có thì bỏ qua);
  // chi phí vận hành nhập tay (data.chiPhiVanHanh) cộng theo từng khoản.
  const pnlList = list.map(d => d.pnl).filter(Boolean);
  const pnl = pnlList.length ? {
    coGiaVon: pnlList.every(p => p.coGiaVon),
    doanhThu: pnlList.reduce((s, p) => s + (num(p.doanhThu) || 0), 0),
    giaVonHangBan: pnlList.some(p => p.giaVonHangBan === null) ? null : pnlList.reduce((s, p) => s + (num(p.giaVonHangBan) || 0), 0),
    thieuGiaVonSL: pnlList.reduce((s, p) => s + (num(p.thieuGiaVonSL) || 0), 0),
    laiGop: pnlList.some(p => p.laiGop === null) ? null : pnlList.reduce((s, p) => s + (num(p.laiGop) || 0), 0),
    phiSan: pnlList.reduce((s, p) => s + (num(p.phiSan) || 0), 0),
    quangCaoGmvMax: pnlList.reduce((s, p) => s + (num(p.quangCaoGmvMax) || 0), 0),
    laiSauPhiSan: pnlList.some(p => p.laiSauPhiSan === null) ? null : pnlList.reduce((s, p) => s + (num(p.laiSauPhiSan) || 0), 0),
  } : null;
  const chiPhiVanHanh = mergeChiTiet(d => d.chiPhiVanHanh);

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
    pnl, chiPhiVanHanh,
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
