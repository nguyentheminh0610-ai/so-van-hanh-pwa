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

### Đầu mỗi phiên làm việc (do người mở) → lấy bản mới nhất:

**Ngoại lệ — task theo lịch trên PC (chốt 23/10/2026, thay cho quy tắc cũ
"chạy sync trước mỗi task theo lịch"):** task CSKH chạy 15 phút/lần, mỗi lần tự
kiểm hostname + chạy sync tốn token vô ích, trong khi Windows Task Scheduler
`Claude - Dong bo kien thuc` đã tự đồng bộ 15 phút/lần (không tốn token nào).
Vì vậy task theo lịch **KHÔNG chạy sync-knowledge, KHÔNG kiểm hostname** (task
theo lịch chỉ được cài trên PC), cứ dùng file skill đang có trên đĩa.

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

**Trên PC đã có task tự đồng bộ mỗi 15 phút** (cài 2026-10-22 bằng
`scripts/setup-sync-task.ps1`, tên task: `Claude - Dong bo kien thuc`). Nhờ đó
kiến thức train ở máy nào cũng tự sang máy kia trong vòng 15 phút, không cần ai
nhớ chạy tay. Không tạo thêm task gọi thẳng skill trả lời khách — dễ chạy trùng
với task đã có, khách sẽ bị nhắn 2 lần.

### Kiến thức mới thì ghi vào ĐÂU

| Chủ shop train về... | Ghi vào file |
|---|---|
| **Trả lời tin nhắn khách** (tư vấn size, chào chung, hỏi tồn kho, đóng hội thoại, mẫu câu, văn phong) | `.claude/skills/size-consultation/SKILL.md`; nếu là số liệu/bảng/mẫu câu thì sửa thêm `references/size-spec.md` + `references/size-rules.json` cho khớp nhau |
| Báo cáo kho, đối chiếu sàn | `.claude/skills/daily-warehouse-report/` |
| Gửi bù hàng thiếu | `.claude/skills/resend-missing-item/` |
| KOC, flash sale | `.claude/skills/check-koc/`, `tiktok-koc-flashsale/`, `tiktok-live-flashsale/` |
| Quy tắc chung nhiều skill dùng | `.claude/shared/` |

Luôn ghi kèm **ngày chốt** + **lý do**, và nếu quy tắc mới ghi đè quy tắc cũ thì
nói rõ "chốt ngày X, thay cho quy tắc cũ Y" thay vì xoá lịch sử — để phiên sau
hiểu vì sao đổi.

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
- `daily-chat-digest` — tổng hợp cuối ngày các chat TikTok ĐÃ trả lời (tên khách,
  câu hỏi, câu shop rep) + đề xuất case/quy trình học được, gửi Telegram. Chạy
  chung lượt tối với task "tổng hợp tin chưa trả lời" trên PC (chốt 31/10/2026).
- `check-koc`, `tiktok-koc-flashsale`, `tiktok-live-flashsale`,
  `shopee-promotion-product-management`, `resend-missing-item`,
  `return-item-not-shop-product`, `review-return-check`, `thang-moi`.
