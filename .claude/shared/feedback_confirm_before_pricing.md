# feedback_confirm_before_pricing

> Any operational step touching product listings or pricing (flash sale discounts, new product posting, KOC sample terms) needs the shop owner's confirmation before Claude executes it.

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Khi thực hiện các việc vận hành thay chủ shop (xem [ops-assistant-mandate](project_ops_assistant_mandate.md)), bất kỳ bước nào liên quan đến SẢN PHẨM hoặc GIÁ THÀNH phải báo và xin xác nhận của chủ shop TRƯỚC khi làm — không tự ý thực hiện. Ví dụ rõ nhất: mức giảm giá/khung giờ flash sale, nội dung hoặc giá bán khi đăng sản phẩm mới, điều khoản duyệt mẫu free cho KOC (số lượng, loại sản phẩm tặng).

**Why:** chủ shop yêu cầu rõ ràng ngày 2026-10-04 ngay khi chốt hình thức hỗ trợ ("1 số bước liên quan đến sản phẩm hoặc giá thành thì cần e báo a trước khi làm") — đây là ranh giới chủ shop tự đặt ra cho phạm vi Claude được tự quyết.

**How to apply:** Các việc KHÔNG chạm sản phẩm/giá (check đơn tồn 17h, ghi sổ lỗi kho, ghi note nhân viên, điền số liệu trả hàng, check đánh giá/phàn nàn để báo cáo) — Claude có thể làm ngay rồi báo cáo kết quả sau, không cần hỏi trước. Nhưng tạo/sửa flash sale, đăng sản phẩm mới, duyệt mẫu KOC — luôn dừng lại hỏi xác nhận cụ thể (mức giá, số lượng, nội dung) trước khi bấm bất kỳ nút nào có hiệu lực trên Shopee/TikTok/Sapo.
