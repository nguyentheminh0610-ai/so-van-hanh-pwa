# project_ops_assistant_mandate

> User wants Claude to actively perform daily TikTok Shop/Shopee/Sapo operations tasks and report back, not just build app features — full task list and priority order.

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Chủ shop vận hành TikTok Shop + Shopee, dùng Sapo làm hệ thống quản lý sản phẩm/kho/đơn hàng trung tâm (đồng bộ cả 2 sàn). Ngày 2026-10-04, chủ shop yêu cầu Claude trực tiếp đảm nhiệm và ghi nhớ các việc vận hành sau — Claude tự làm rồi báo cáo lại, KHÔNG phải chỉ xây tính năng trong app PWA hiện có (app hiện tại chỉ làm báo cáo KPI tháng từ file Excel, chưa có phần vận hành hàng ngày):

1. Check và duyệt yêu cầu mẫu free của KOC trên TikTok.
2. Tạo flash sale hàng tuần + mỗi buổi livestream.
3. Edit ảnh mỗi khi có sản phẩm mới.
4. Đăng sản phẩm mới lên sàn (Shopee/TikTok) và lên Sapo.
5. Check đánh giá, xử lý trả hàng/hoàn tiền/phàn nàn của khách — liên quan sản phẩm, dịch vụ, vận hành.
6. Kiểm soát kho hàng:
   - Kiểm tra đơn còn tồn chưa xử lý trong ngày vào lúc 17h (sau khi kho đã đóng đơn) — báo lý do: ship chưa lấy hàng, hay hết hàng chưa đóng được.
   - Ghi lỗi vào sổ kho khi sản phẩm/dịch vụ có vấn đề.
   - Ghi note việc cần làm cho nhân viên (đơn cần gửi bù, đơn cần chú ý...).
   - Điền số liệu của đơn trả hàng hôm nay.
7. Còn một số việc chủ shop chưa nhớ hết — cần chủ động hỏi/bổ sung dần, và liên kết việc chính với việc phụ liên quan (vd. 1 đơn trả hàng do lỗi sản phẩm → vừa ghi vào "điền số liệu đơn trả hàng" vừa ghi vào "sổ lỗi kho" vừa có thể phát sinh "note nhân viên gửi bù").

**Ưu tiên triển khai trước** (chốt 2026-10-04): nhóm (6)+(7) — kiểm soát kho & vận hành hàng ngày — vì lặp lại mỗi ngày và ảnh hưởng trực tiếp đơn hàng. Nhóm "nội dung & bán hàng" (1-4) và "chăm sóc khách hàng" (5) làm sau.

**Why:** chủ shop chốt rõ qua AskUserQuestion — muốn 1 trợ lý vận hành thật sự làm việc, không phải chỉ công cụ tự thao tác.
**How to apply:** khi chủ shop nhắc tới bất kỳ việc nào ở trên (hoặc đến gần 17h hàng ngày), Claude chủ động thực hiện (dùng Claude in Chrome xem Shopee/TikTok Seller Center/Sapo — xem [sapo-central-system-and-browser-access](reference_sapo_and_browser_access.md)) rồi báo cáo kết quả, trừ các bước chạm vào sản phẩm/giá thành phải xin xác nhận trước — xem [confirm-before-product-pricing-actions](feedback_confirm_before_pricing.md).
