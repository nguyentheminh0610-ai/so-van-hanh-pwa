# Lương cách mới — chốt 17/11/2026, chạy từ tháng 12/2026 (các tháng trước vẫn hiện cách cũ)

Thứ tự chạy SQL trong Supabase (chọn "Run without RLS"): 01 → 02 → 03. Sau đó kéo thả `index.html` lên GitHub.

## Muốn bỏ "cách mới" sau này, xóa đúng các phần có chữ "CÁCH MỚI" trong index.html
- Khối script `CÁCH MỚI (tạm thời): ĐÓNG CHUNG` và `CÁCH MỚI (tạm thời): LƯƠNG + TỈ LỆ`
- Khối HTML `copack-mgr`, `paynew`; hàm `staffChipTap` và đoạn "CÁCH MỚI" trong `renderStaffChips` (chọn 2 người đang trực)
- 2 dòng trong `loadPayroll` (`loadPayrollNew()` và `payNewSetOld(...)`), 1 dòng trong `submitReturn` (`returnsDupNote`),
  2 dòng nhỏ ở `submitOutbound` (`coStaff`) và chip "+ tên" ở `renderOutboundToday`, 1 dòng `copackRefreshUI` ở `setStaffName`
- SQL: drop bảng warehouse_copack_log, warehouse_outbound_bulk_log, warehouse_special_days, warehouse_special_days_log,
  warehouse_cutoff_daily, warehouse_return_dup_log; drop cột co_staff của warehouse_outbound_checks.
Mục 1 (lý do đơn chưa đóng) KHÔNG nằm trong "cách mới", giữ lại.

## Chưa làm ở lần này
Nút Chốt lương, job tự chạy 19:00, kiểm tra Sapo, khiếu nại 24 giờ, nút "Hàng về kho", màn Đối chiếu hoàn,
màn nhập/job tự chạy cho warehouse_cutoff_daily.

## Thêm 17/11/2026 (lần 2)
- Thẻ "Đơn trước 16h" ở tab Tổng quan đọc bảng warehouse_cutoff_daily + warehouse_cutoff_orders (chi tiết tự xoá sau 40 ngày).
- Job 20:00 trên PC (tools/sync_cutoff_daily.py, gọi từ scripts/run-don-chua-lay.ps1) ghi số liệu từ Sapo vào 2 bảng đó.
- Mọi con số của lương cách mới nằm ở đầu khối PAYNEW-CORE trong index.html (PN_FUND_HARD, PN_FUND_16H, PN_QUALITY_BONUS, PN_LOYALTY_BONUS).
