# Mẫu chuẩn để tự động LẤY DATA từ sàn — rẻ (0 token) + ổn định

Chốt 30/10/2026 (chủ shop Minh yêu cầu lưu để recommend cho mọi việc cần cập
nhật data thường xuyên). Rút ra từ việc dựng đồng bộ số liệu KOC (xem
`.claude/skills/check-koc/references/koc-post-tracking.md`).

## Nguyên tắc cốt lõi

**Đẩy việc LẤY DATA định kỳ RA KHỎI Claude.** Mỗi lần chạy qua 1 phiên Claude
(điều khiển trình duyệt) là **tốn quota**. Thay vào đó cho **script thuần chạy
trên PC trực = 0 token**, Claude chỉ lo: (1) dựng script lần đầu, (2) sửa khi
sàn đổi giao diện/API.

## Khi nào dùng được

| Loại việc | Dùng được? |
|---|---|
| **Lấy data có nút tải file** (báo cáo, export đơn, affiliate, số liệu) | ✅ **Tốt nhất** — 0 token, ổn định nhất |
| Lấy data không có nút tải, chỉ xem trên trang | 🟡 Được qua Playwright gọi API nội bộ (mượn chữ ký phiên đăng nhập), nhưng kém ổn định hơn file |
| **Việc HÀNH ĐỘNG** (nhắn khách, gửi khiếu nại, tạo đơn, duyệt mẫu, gửi Telegram có nội dung) | ❌ KHÔNG — cần đọc ngữ cảnh + quyết định, vẫn phải chạy qua Claude |

## Cách dựng (cho việc tải file)

**Thành phần — tất cả chạy trên PC trực, 0 token:**
1. **Script Playwright/Selenium** dùng **profile Chrome đã đăng nhập sẵn** (persistent
   context): mở trang → bấm Export → bấm Download → file rơi vào thư mục Downloads.
2. **Script Python** đọc file (Excel/CSV) → tính → ghi Supabase / Google Sheet / JSON.
3. **Windows Task Scheduler** chạy theo lịch (tuần/lần thường là đủ).

**Vì sao PHẢI có trình duyệt thật, Python thuần không tải thẳng được:** nút
Download của TikTok/Shopee là nút chạy JavaScript, nó gọi 1 API **ký chữ ký**
(vd TikTok: X-Bogus, X-Gnarly) rồi mới sinh link tải. Chữ ký này do JS của trang
tính trong phiên đăng nhập — script Python chỉ có cookie KHÔNG tái tạo được.
Playwright chạy Chrome thật nên JS của trang tự ký khi mình bấm nút → tải được.
(Kiểm chứng thật 30/10: nút "Download" của TikTok affiliate là `<button>`
không phải `<a href>`; link cũ `export_task/list` hết chữ ký thì trả "Not Found".)

## Độ ổn định — nói thật

- 🟢 Phần **đọc file + ghi** (Python): rất ổn, gần như không gãy (chỉ phụ thuộc
  tên cột trong file giữ nguyên).
- 🟡 Phần **trình duyệt bấm nút**: ổn định khá, 2 rủi ro: (1) sàn **đăng xuất
  profile** (vài tuần/lần, hiếm) — script phải **tự phát hiện + gửi Telegram
  báo**, không fail âm thầm; (2) sàn **đổi giao diện/API** — phải sửa (Claude lo).
- Không có cách nào "không bao giờ đụng tay" vì sàn là bên thứ 3 mình không
  kiểm soát. Nhưng đây là mức rẻ + ổn định cao nhất cho data sàn tự động.

## Cần gì khi triển khai

1. Claude viết: script Playwright tải file + Python đọc file + config Task Scheduler
   (viết từ máy nào cũng được).
2. **Trên PC làm 1 lần:** cài Playwright + **đăng nhập sàn vào profile riêng** của
   script (sau đó script tự dùng lại phiên đó).
3. Lấy **1 file mẫu** để biết đúng tên cột rồi viết phần đọc cho khớp.

## Đã áp dụng / nên áp dụng

- **KOC (TikTok affiliate):** ĐÃ dựng xong script mẫu (30/10):
  [`tools/koc_auto_sync.py`](../../tools/koc_auto_sync.py) (Playwright + ghi
  Supabase, 0 token) + [`scripts/setup-koc-sync-task.ps1`](../../scripts/setup-koc-sync-task.ps1)
  (đăng ký Task Scheduler tuần/lần). Còn CHỜ setup 1 lần trên PC: cài
  Playwright + `py tools\koc_auto_sync.py --login` (đăng nhập TikTok vào
  profile script). Bản này gọi API nội bộ qua trang (mượn chữ ký phiên) thay
  vì tải file — cùng nguyên tắc 0-token-trên-PC; nếu API đổi thì chuyển sang
  bấm Export tải file.
- **Gợi ý mở rộng:** báo cáo tháng Shopee/TikTok (skill `thang-moi` vốn đã tải
  file tay), đối chiếu đơn hoàn, bất cứ số liệu sàn nào có nút Export.
