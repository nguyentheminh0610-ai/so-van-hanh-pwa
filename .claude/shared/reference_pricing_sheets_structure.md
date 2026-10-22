# reference_pricing_sheets_structure

> Cấu trúc 2 Google Sheet dùng để định giá SKU/combo (sheet \"Sku\" gốc + sheet \"Giá FS, Voucher\")

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Hai sheet liên quan tới đặt tên SKU và tính giá (dùng khi thêm SKU/combo mới, xác nhận 2026-10-09):

**1. Sheet "Sku" (gốc)** — `1HKB0j6wR_7GD8QJdEYS7-pNbCBfhfSkv5Opbx-fL-eM`, tab "Sheet8":
- Quy tắc đặt tên SKU: `Nhóm Sp-Chất liệu-Hoạ tiết/Màu sắc` (trừ SP ở STT 1-3 không theo quy tắc này).
- Quy tắc đặt tên **combo**: `CB-{mã SP1}{mã SP2}-{size1}{size2}` (vd `CB-CL07CL08-LXL`). Mỗi combo liệt kê đủ từng biến thể size cụ thể ở sheet này (không gộp).
- Nhóm "QD" (Quần Dài) gồm cả CL (Chất Lông, hoạ tiết hoạt hình: Shin, Hello Kitty...) và CT (Chất Thun, gồm cả màu trơn CT01-07 và hoạ tiết Shin CT08-10) — merge cùng 1 nhóm sản phẩm trên sàn dù khác chất liệu.

**2. Sheet "Giá FS, Voucher (SKU mới)"** — `1EsaPLMfkAUpAcx-BMkR3ZP2fe34_NJYMxsOQF1MzpQw`:
- Tab "DM_SKU": danh mục SKU + tên, cột 3 là chuỗi "SKU - Tên" dùng cho dropdown.
- Tab "Giá FS" (tiêu đề "BẢNG GIÁ FLASH SALE & VOUCHER"): header chiếm 5 dòng, dữ liệu bắt đầu dòng 6 = STT1. Công thức: dòng = STT + 5. Cột: STT, Phân loại (SKU-Tên), Nor day (giá gốc — nhập tay), Nor FS+Live, Mini FS+Live+KOC80, Spike FS+Live+KOC90 (3 cột sau auto-tính bằng `=IF(C=\"\";\"\";ROUND(C*(1-D$4);-1))` theo % giảm ở dòng 4), Voucher Live (ghi chú tay, không phải công thức).
- **Combo trong Giá FS**: gộp theo NHÓM (không tách theo size, vì giá giống nhau mọi size) — 1 dòng duy nhất đại diện cả nhóm combo, SKU bỏ hậu tố size (vd `CB-CL12CL11` thay vì `CB-CL12CL11-LXL`). Giá Nor day = công thức cộng giá 2 thành phần, vd `=C16+C17` (tham chiếu đúng dòng Nor day của 2 SKU thành phần trong chính sheet này).
- Có dòng trống xen kẽ do sheet gốc skip 1 STT (STT47 "COMBO2C-2") — không phải lỗi, là đặc thù sẵn có của sheet.

**Why:** Hai sheet này độc lập nhau (không auto-sync), SKU/combo mới phải thêm tay vào cả 2 nơi cho khớp.

**How to apply:** Khi cần thêm SKU/combo mới vào "Giá FS": (1) tra mã + thành phần ở sheet "Sku" gốc, (2) thêm dòng gộp-theo-nhóm vào Giá FS với công thức cộng giá 2 thành phần ở cột Nor day, (3) thêm dòng tương ứng vào DM_SKU. Xem thêm [feedback_gsheet_row_verification](feedback_gsheet_row_verification.md) về cách đọc đúng vị trí dòng trước khi ghi.
