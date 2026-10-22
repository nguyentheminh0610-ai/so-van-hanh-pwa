# Hướng dẫn chung cho mọi phiên Claude Code trong dự án này

Shop SOME.TIME (đồ ngủ, bán TikTok Shop + Shopee). Chủ shop: Nguyễn Thế Minh.
Dự án này chạy trên **2 máy**: máy Mac của chủ shop, và **PC Windows trực 24/7**
(`C:\sokho\so-van-hanh-pwa`, hostname `DESKTOP-N7T8LNP`) chạy các task tự động
theo lịch.

**Máy nào làm gì (chốt 21/10/2026):** mọi việc chạy thật (mở trình duyệt, nhắn
khách, gửi Telegram) **chỉ chạy trên PC Windows** — nhiều skill có sẵn bước
kiểm `hostname` và tự dừng nếu không phải PC, để tránh 2 máy làm trùng (khách
bị nhắn 2 lần, Telegram nhận 2 báo cáo). Máy Mac dùng để trao đổi, sửa kiến
thức, sửa code.

---

## ⚠️ QUY TRÌNH CẬP NHẬT KIẾN THỨC (BẮT BUỘC — đọc kỹ trước khi làm bất cứ việc gì)

Chủ shop thường xuyên "train" kiến thức nghiệp vụ mới qua chat (quy tắc tư vấn
size, cách trả lời khách, quy trình kho, chính sách...). **Vấn đề đã từng xảy
ra nhiều lần: train xong rồi phiên sau quên sạch.**

**Sự cố thật 22/10/2026 (lý do có mục này):** máy Mac làm việc suốt nhiều ngày
trên bản kiến thức cũ vì **không bao giờ `git pull`**, trong khi PC vẫn đang
đẩy kiến thức mới lên GitHub. Kết quả: chủ shop phải train lại những thứ PC đã
chốt từ 15/10 (cotton thường không lên size, câu trả lời eo cạp chun...), và
2 nhánh git lệch nhau phải gộp tay. **Vì vậy: BẮT BUỘC pull trước khi làm.**

### Khi chủ shop train/chốt bất kỳ kiến thức nghiệp vụ mới nào → làm ĐỦ 3 bước:

1. **Ghi thẳng vào file skill** trong `.claude/skills/<tên-skill>/` (SKILL.md
   hoặc file trong `references/`). KHÔNG được chỉ lưu vào memory hội thoại —
   memory chỉ sống trên 1 máy, từng bị phiên khác ghi đè mất, và PC Windows
   không bao giờ thấy.
2. **Commit** ngay với mô tả rõ đã chốt gì, ngày nào.
3. **Push lên GitHub ngay** (`git push`). Chưa push = máy còn lại vẫn dùng bản cũ.

Ghi kèm **ngày chốt** và **lý do/ngữ cảnh** vào file, để phiên sau hiểu được vì
sao có quy tắc đó, không chỉ biết quy tắc.

### Đầu mỗi phiên làm việc / trước mỗi lần chạy task theo lịch → lấy bản mới nhất:

```bash
# Mac
bash scripts/sync-knowledge.sh
```
```powershell
# Windows (PC trực)
powershell -ExecutionPolicy Bypass -File scripts\sync-knowledge.ps1
```

Script này tự: commit mọi thay đổi trong `.claude/` còn sót lại → `git pull
--rebase` → `git push`. Chạy được ở cả 2 chiều, nên train ở máy nào cũng đồng bộ
sang máy kia.

**Trên PC:** các Task Scheduler đang chạy sẵn nên gọi `sync-knowledge.ps1`
TRƯỚC khi gọi `claude -p` (thêm vào đầu script hiện có, hoặc tạo 1 task riêng
chạy script này mỗi 10-15 phút). Không tạo thêm task gọi thẳng skill — dễ chạy
trùng với task đã có, khách sẽ bị nhắn 2 lần.

### Nguồn chuẩn khi có mâu thuẫn

File skill trong git **luôn thắng** memory cục bộ. Nếu memory nói khác file
skill, tin file skill và sửa/đánh dấu lại memory cho khớp.

### ⚠️ CẤM dùng wiki-link `[[tên]]` trong `.claude/`

Skill **chỉ được tham chiếu file NẰM TRONG REPO**, bằng đường dẫn tương đối
thật: `[tên](../../shared/ten-file.md)`.

**Tuyệt đối không viết `[[tên-memory]]`** — memory chỉ nằm trên máy Mac, không
đi theo git, nên skill chạy trên PC gặp link đó thì **không có gì để đọc**.

**Sự cố thật 2026-10-22:** 7 skill ghi "xem `[[reference_chrome_browsers]]`"
nhưng file đó chưa bao giờ tồn tại → không phiên nào biết Chrome nào vào TikTok,
Chrome nào vào Shopee; đoán trượt thì tưởng "bị chặn không vào được TikTok".
Rà thêm thì còn 27 link treo nữa cùng kiểu. Đã dọn sạch và chép kiến thức cần
thiết vào `.claude/shared/`.

Kiến thức dùng chung nhiều skill → để ở **`.claude/shared/`**. Kiến thức riêng
1 skill → để ở `references/` của skill đó.

**Kiểm trước khi commit** (script tự chạy trong `sync-knowledge`, chạy tay được):
```bash
python3 scripts/check-skill-links.py
```
Nó báo mọi wiki-link và mọi link trỏ tới file không tồn tại. Phải sạch mới commit.

---

## Bảo mật

- Repo này **PUBLIC** trên GitHub. Tuyệt đối không commit token, API key, mật
  khẩu, cookie phiên đăng nhập. Dùng placeholder (`<TELEGRAM_BOT_TOKEN>`) trong
  file git, giữ giá trị thật ở memory cục bộ hoặc hỏi lại chủ shop.
- Trước khi commit, kiểm tra: `git diff --cached | grep -iE "token|key|secret|password"`.

## Skill đang có

- `size-consultation` — trả lời tin nhắn khách: tư vấn size, chào chung, hỏi tồn
  kho, đóng hội thoại đã xong (đọc kỹ ngữ cảnh chat trước khi đóng).
- `daily-warehouse-report` — báo cáo kho/đối chiếu sàn hàng ngày, gửi Telegram.
- `check-koc`, `tiktok-koc-flashsale`, `tiktok-live-flashsale`,
  `shopee-promotion-product-management`, `resend-missing-item`,
  `return-item-not-shop-product`, `review-return-check`, `thang-moi`.
