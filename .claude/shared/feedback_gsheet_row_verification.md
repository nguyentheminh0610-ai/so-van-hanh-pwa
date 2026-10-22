# feedback_gsheet_row_verification

> Luôn xác minh vị trí dòng bằng get_spreadsheet (includeGridData) trước khi ghi vào Google Sheet có dòng trống xen kẽ

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Khi sheet có dòng trống xen kẽ (hoặc merge cell/group), tool `get_values` có thể **bỏ qua/compact dòng trống** khi trả kết quả — khiến vị trí phần tử trong mảng trả về KHÔNG khớp với số dòng thật trên sheet. Dựa vào thứ tự mảng từ `get_values` để suy ra số dòng (vd công thức "dòng = STT+5") có thể SAI nếu có dòng trống phía trên bị compact.

**Why:** Sự cố thực tế 2026-10-09 trên sheet "Giá FS" ([pricing-sheets-structure](reference_pricing_sheets_structure.md)) — suy sai vị trí dòng QS-CT-03/04 và 3 dòng combo (COMBO2C-1/COMBOMIX-1/COMBOMIX-2), ghi đè mất dữ liệu gốc. Phải dò lại bằng `get_spreadsheet(includeGridData:true)` (tool này trả đủ từng dòng kể cả dòng trống, không compact) mới khôi phục đúng.

**How to apply:** Trước khi GHI (update_values/batchUpdate) vào vùng có khả năng có dòng trống hoặc đã từng bị sửa tay nhiều lần, luôn xác minh lại vị trí dòng bằng `get_spreadsheet` với `includeGridData:true` + `fields` giới hạn (vd chỉ lấy `formattedValue`) để tránh vượt token — KHÔNG tin tưởng số thứ tự ngầm định từ `get_values`. Sau khi ghi xong cũng nên đọc lại bằng `get_spreadsheet` để xác nhận đúng dòng, vì đây cũng là sheet live nhiều người chỉnh sửa cùng lúc — dữ liệu có thể đổi giữa các lần đọc.
