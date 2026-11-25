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

## Đã BỎ (chốt 18/11/2026, anh Minh: "bỏ hết 6 cái này, tập trung việc anh giao")
Nút Chốt lương, job tự chạy 19:00, kiểm tra Sapo, khiếu nại 24 giờ, nút "Hàng về kho", màn Đối chiếu hoàn.
Không làm nữa, trừ khi anh Minh nhắc lại. (Màn nhập/job tự chạy cho warehouse_cutoff_daily đã làm xong 17-18/11: job 20:00.)

## Chốt 18/11/2026: lương cách mới hiện từ tháng 11/2026 (PN_SHOW_MONTH), song song cách cũ; từ 12/2026 (PN_START_MONTH) cách cũ tự ẩn.

## Thêm 17/11/2026 (lần 2)
- Thẻ "Đơn trước 16h" ở tab Tổng quan đọc bảng warehouse_cutoff_daily + warehouse_cutoff_orders (chi tiết tự xoá sau 40 ngày).
- Job 20:00 trên PC (tools/sync_cutoff_daily.py, gọi từ scripts/run-don-chua-lay.ps1) ghi số liệu từ Sapo vào 2 bảng đó.
- Mọi con số của lương cách mới nằm ở đầu khối PAYNEW-CORE trong index.html (PN_FUND_HARD, PN_FUND_16H, PN_QUALITY_BONUS, PN_LOYALTY_BONUS).

## Thêm 25/11/2026: cảnh báo đơn trễ (KHÔNG thuộc "cách mới", giữ lại)
- Chạy thêm `04-canh-bao-don-tre.sql` trong Supabase, rồi kéo thả `index.html` lên GitHub. Chưa chạy SQL thì khối cảnh báo tự ẩn, không lỗi gì.
- Job 20:00 trên PC (tools/sync_late_orders.py) ghi bảng warehouse_late_orders. Chi tiết: .claude/shared/reference_sapo_api_don_chua_lay.md.

## Chốt 25/11/2026: thưởng đơn trước 16h tính CHUNG CẢ KHO, cả tháng (thay cho cách 17/11 "chia tử/mẫu cho các bạn có quét hôm đó")
- Tỷ lệ = tổng đơn trễ ÷ tổng đơn đến hạn của mọi ngày thường có số liệu. Dưới 10% thì mọi bạn nhận phần quỹ 500.000đ của mình (quỹ vẫn chia theo ngày trong kỳ như lương cứng), từ 10% thì không ai nhận. Áp dụng luôn từ tháng 11/2026.
- Lý do: anh Minh muốn một con số chung cho cả kho, các bạn dễ hiểu; tách theo người không quy được đơn chưa đóng về ai.
- Thẻ "Đơn trước 16h" ở tab Tổng quan: bỏ thẻ từng bạn và 2 nút danh sách dài; thay bằng 1 dòng tổng tháng + lưới ô theo ngày (chỉ ghi ngày và % trễ, từ 10% tô đỏ), bấm vào ngày mới hiện đơn trễ ngày đó.
- Đơn "Chưa xử lý" vẫn tính là trễ ở thưởng 16h (khác khối cảnh báo đơn trễ, chỉ tính đơn đã có mã vận đơn).
- Chốt thêm 25/11/2026 (sửa 2 ý ở trên): quỹ 500.000đ chia đều THEO THÁNG cho các bạn có lương tháng đó (không chia theo ngày trong kỳ nữa); thưởng 16h bắt đầu TÍNH TIỀN từ tháng 12/2026 (PN_16H_START), tháng 11/2026 chỉ hiện số xem thử, không cộng tiền.

## Chốt 25/11/2026: bỏ 3 khối đối chiếu ở tab Tổng quan
- Anh Minh bảo bỏ: nút "Đối chiếu với sàn", "Mã đơn shipper chưa trả", "Đơn kho đã nhận nhưng sàn chưa báo". Chỉ ẨN (khung `dash-recon-wrap` có `hidden` trong index.html), code còn nguyên; muốn hiện lại thì bỏ chữ `hidden`.
