# reference_koc_scoring_sheet

> Which Google Sheet is the live \"Bảng Chấm Điểm KOC\" used to score new KOC sample requests, its tab/column layout, and that Tổng điểm/Kết quả auto-compute.

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

File chấm điểm KOC đang dùng thật: Google Sheet **"Bảng Chấm Điểm KOC"**, spreadsheetId `1-ccH9D7SklgEIqJbLlNEbKlpDlYkzHsikDNUy_Ss9Sc` (chủ shop xác nhận 2026-10-05). Có 1 file trùng tên gây nhầm là "Bang Cham Diem KOC (moi)" (id `1GiKSOd0gvsJ3vHJUWV2YPTBNeHrtxaZx3XwS-2khlNs`) — **KHÔNG dùng file "(moi)" này**, đó là bản cũ/nháp không còn cập nhật.

Tab cần điền khi có KOC mới xin mẫu free: **"2.Nhập KOC"**. Cột A-H là input tay: STT, Tên KOC, Cộng tác ≥80% (Có/Không), Có SP liên quan (Có/Không), Số đơn bán, GPM (nghìn VNĐ/đơn — lấy đúng số "GPM" hiển thị sẵn trên trang chi tiết nhà sáng tạo TikTok, không tự tính doanh số/đơn), KH 18-34 (%) (cộng % nhóm 18-24 + 25-34 trên tab "Người theo dõi" của hồ sơ KOC), Style kênh (Phù hợp ít/vừa/nhiều — xem [ops-assistant-mandate](project_ops_assistant_mandate.md) về quy tắc).

**Cột I (Ghi đè thủ công), J (Tổng điểm), K (Kết quả) đã có sẵn công thức trong sheet, tự tính ra khi điền xong cột A-H — không cần tự tính tay, không được ghi đè cột J/K.** Mỗi lần chỉ cần append dòng mới vào cuối (dò STT lớn nhất hiện có rồi +1), không cần kéo công thức.

**Why:** tránh nhầm sang file "(moi)" hoặc tự tính sai điểm đè lên công thức có sẵn.
**How to apply:** trước khi điền KOC mới, luôn get_values để tìm STT lớn nhất hiện tại trong "2.Nhập KOC", rồi update_values đúng range A{row}:H{row+n} của các dòng mới, đọc lại kèm cột I:K để xác nhận công thức đã chạy ra Kết quả DUYỆT/KHÔNG DUYỆT trước khi báo cáo chủ shop.
