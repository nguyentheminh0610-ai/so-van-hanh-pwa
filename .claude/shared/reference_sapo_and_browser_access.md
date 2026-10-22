# reference_sapo_and_browser_access

> Sapo is the shop's central product/inventory/order hub syncing Shopee + TikTok Shop; which Chrome browsers Claude in Chrome can use for live checks on these platforms.

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Chủ shop dùng **Sapo** (sapo.vn) làm hệ thống trung tâm quản lý sản phẩm/kho/đơn hàng, đồng bộ đơn từ cả Shopee và TikTok Shop. Khi cần kiểm tra đơn hàng/tồn kho thực tế (vd. việc kiểm tra đơn tồn 17h trong [ops-assistant-mandate](project_ops_assistant_mandate.md)), nên ưu tiên xem qua Sapo trước vì gộp được cả 2 sàn; chỉ vào riêng Shopee Seller Center / TikTok Shop Seller Center khi Sapo không đủ thông tin (vd. lý do ship chưa lấy hàng thường rõ hơn ở đúng seller center của sàn đó).

Claude không tự nhập mật khẩu đăng nhập hộ chủ shop (ngoài phạm vi cho phép) — chỉ có thể xem các hệ thống này qua **Claude in Chrome** nếu trình duyệt đã có sẵn phiên đăng nhập. Tính đến 2026-10-04, tài khoản có 2 trình duyệt Chrome đã kết nối qua Claude in Chrome:
- "Browser 1" — macOS, local (máy đang dùng để chat với Claude Code).
- "Browser 2" — Windows, không phải máy local hiện tại (có thể là máy ở cửa hàng/kho).

Chưa xác nhận trình duyệt nào trong 2 trình duyệt trên đang đăng nhập sẵn Sapo/Shopee Seller Center/TikTok Shop Seller Center.

**Why:** cần biết dùng hệ thống nào và trình duyệt nào để thực sự thực hiện được việc kiểm tra đơn/kho hàng ngày mà chủ shop giao.

**How to apply:** Trước khi làm việc kiểm tra đơn/kho qua trình duyệt, hỏi xác nhận trình duyệt nào (Browser 1 hay Browser 2) đang đăng nhập sẵn các hệ thống cần xem, ưu tiên dùng đúng trình duyệt đó. Nếu về sau chủ shop cung cấp API key của Sapo, ưu tiên dùng API thay vì duyệt web thủ công (ổn định hơn cho việc tự động hàng ngày lúc 17h).
