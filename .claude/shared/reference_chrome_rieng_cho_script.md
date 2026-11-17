# Chrome RIÊNG cho script tự động trên PC trực (chốt 17/11/2026)

PC trực có 1 Chrome riêng dành cho **script chạy ngầm** (Playwright, 0 token),
tách hẳn khỏi Chrome "Minh" (TikTok/Sapo) và Chrome vàng (Shopee) mà Claude in
Chrome điều khiển. Chủ shop đã đăng nhập TikTok Affiliate vào đây 1 lần.

- **Profile:** `C:\Users\Admin\koc-chrome-profile` (biến `KOC_PROFILE_DIR` đổi được).
- **Chạy bằng Google Chrome cài sẵn** (`channel="chrome"` trong `tools/koc_auto_sync.py`).
  Chromium do Playwright tải về KHÔNG khởi động được trên PC này (`spawn UNKNOWN`,
  nghi diệt virus chặn) — đừng quay lại dùng nó.
- **Đăng nhập / đăng nhập lại:** bấm đúp `scripts\dang-nhap-koc.bat` (hoặc
  `py tools\koc_auto_sync.py --login`), đăng nhập TikTok trong cửa sổ Chrome hiện
  ra, rồi bấm Enter ở cửa sổ đen để lưu phiên. Chủ shop dùng PC bằng chuột, không
  có terminal — luôn đưa file `.bat` bấm đúp thay vì bắt gõ lệnh.
- **Đừng đăng nhập tài khoản Google vào Chrome này** (tránh đồng bộ kéo thêm tiện
  ích/mật khẩu vào profile chạy ngầm). Hộp "Bật đồng bộ" → chọn Không.
- **Việc sau này cần script lấy data sàn** (xem [reference_auto_data_pull_pattern.md](reference_auto_data_pull_pattern.md))
  cứ dùng chung profile này; cần sàn khác thì đăng nhập sàn đó vào đây 1 lần.
  Hai script không chạy CÙNG LÚC (Chrome khoá profile), nên xếp lịch lệch giờ.
- Mất phiên (vài tuần/lần): script dừng và báo Telegram. Đã đặt 2 biến môi trường
  `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` ở cấp User trên PC (17/11/2026, giá trị
  thật chỉ ở PC/memory, KHÔNG commit). Script mới nào cần báo Telegram cứ đọc 2 biến này.
- Task đang dùng: `Claude - Dong bo KOC`, 2 ngày/lần lúc 9:00.
