---
name: daily-chat-digest
description: Tổng hợp cuối ngày các hội thoại chat TikTok Shop đã được trả lời trong ngày cho shop SOME.TIME, rồi gửi chủ shop qua Telegram -- chạy CHUNG LƯỢT với task "tổng hợp tin nhắn chưa tự trả lời" buổi tối trên PC (một lần quét inbox lo cả 2 chiều: tin chưa trả lời + tin đã trả lời). Cũng dùng khi chủ shop nói "tổng hợp chat hôm nay", "digest chat cuối ngày", "tổng hợp tin đã trả lời", "hôm nay rep những gì". Mỗi cuộc gom: tên khách, câu hỏi của khách, câu trả lời của shop; kèm một mục "Case/quy trình rút ra" dạng ĐỀ XUẤT để chủ shop duyệt (KHÔNG tự sửa skill). Chỉ TikTok, chỉ các cuộc ĐANG MỞ (tab "Đã đóng" của TikTok trống nên cuộc đã đóng trong ngày sẽ bị sót -- chủ shop đã chấp nhận giới hạn này). KHÔNG nhắn khách, KHÔNG tự train kiến thức, KHÔNG xử lý Shopee. Khác size-consultation (đi TRẢ LỜI từng tin khách, chạy 15 phút/lần) -- skill này chỉ ĐỌC LẠI và TỔNG HỢP cuối ngày.
---

# Tổng hợp chat đã trả lời trong ngày (TikTok)

## ⛔ BƯỚC 0 — CHỈ CHẠY TRÊN MÁY WINDOWS (bắt buộc, làm trước mọi thứ)

Chạy `hostname`. Nếu kết quả **không phải `DESKTOP-N7T8LNP`** (vd máy Mac)
→ **DỪNG NGAY**: không mở trình duyệt, **không gửi Telegram**, chỉ trả lời 1
câu "Bỏ qua: việc này chỉ chạy trên máy Windows."
Lý do (chốt 2026-10-21): mọi việc chạy thật chạy trên PC trực, tránh 2 máy gửi
Telegram trùng. Inbox TikTok cũng chỉ vào được từ Chrome trên PC (Browser 2),
máy Mac không có quyền TikTok.

## Việc này là gì — và KHÔNG phải gì

Chủ shop chốt **2026-10-31**: ngoài task tối "tổng hợp tin nhắn **chưa** tự trả
lời" (task riêng trong Task Scheduler trên PC, không nằm repo), thêm chiều ngược
lại — tổng hợp các tin **đã** trả lời trong ngày để chủ shop xem lại và để
Claude rút ra case/quy trình đã học được.

- **Trong phạm vi:** inbox **TikTok Shop**, các cuộc **đang mở** có tin shop đã
  trả lời **trong ngày hôm nay**. Gom: tên khách + câu hỏi khách + câu trả lời
  của shop. Rút "case/quy trình học được" dạng **đề xuất**. Gửi Telegram.
- **Ngoài phạm vi / KHÔNG làm:**
  - **KHÔNG nhắn khách gì cả** — chỉ đọc lại. (Đi trả lời là việc của
    [size-consultation](../size-consultation/SKILL.md), chạy 15 phút/lần.)
  - **KHÔNG tự sửa skill / KHÔNG commit kiến thức** từ case rút ra. Chỉ nêu đề
    xuất trong báo cáo; chủ shop duyệt rồi một phiên khác mới train (đúng quy
    trình [feedback_knowledge_sync_protocol](../../shared/feedback_knowledge_sync_protocol.md)
    và [feedback_confirm_before_pricing](../../shared/feedback_confirm_before_pricing.md): việc
    nhạy — ở đây là sửa kiến thức nghiệp vụ — phải hỏi trước).
  - **KHÔNG xử lý Shopee** (chốt 2026-10-31 chỉ làm TikTok). Thêm Shopee sau khi
    luồng TikTok chạy ổn.

## ⚠️ 2 giới hạn phải nói trước trong báo cáo (đừng giấu)

1. **Cuộc đã đóng trong ngày bị sót.** TikTok Shop inbox chỉ cho xem hội thoại
   đang mở; mục "Đã đóng" báo **Danh sách trống**, cuộn không nạp thêm (xác nhận
   28/10/2026 khi rà FAQ chat TikTok cả tháng — không lấy lại được cuộc cũ qua
   UI). Nên digest chỉ phản ánh các
   cuộc **còn đang mở** cuối ngày — cuộc nào đã khép lại (vd đã gửi sticker đóng)
   sẽ không có trong danh sách. **Chủ shop đã chấp nhận giới hạn này** khi giao
   việc.
2. **Không phân biệt chắc chắn ai gõ tin shop.** Mọi tin shop gửi (dù do Claude
   task 15 phút gõ, hay chủ shop/NV tự gõ tay) đều hiện cùng một danh nghĩa
   "shop" trong thread — TikTok không gắn tên người gửi nội bộ. Vậy:
   - Gom **tất cả** cặp hỏi–đáp của cuộc có trả lời hôm nay.
   - Dùng **heuristic** để đoán đâu là đoạn xử lý tay (đáng học nhất): câu trả
     lời **không khớp** mẫu có sẵn trong [size-consultation](../size-consultation/SKILL.md)
     / [cskh-ship-faq](../size-consultation/references/cskh-ship-faq.md) / Google
     Sheet "Mau tin nhan" (`1X08EPdWfJeiP4aQGzcA35UGtmTjzbUYcC0jidU-05WE`, tab
     gid 2081894614) → nhiều khả năng do người tự xử lý một tình huống chưa có
     mẫu → đánh dấu **★**. Heuristic, không chắc chắn — ghi rõ "(suy đoán)"
     trong báo cáo khi gắn ★.

## Vào inbox TikTok

Dùng **Claude in Chrome**, **Browser 2** (deviceId `40800ac7-074b-4077-be62-257ed7e08ef7`
= TikTok Shop, xem [reference_chrome_browsers](../../shared/reference_chrome_browsers.md)).
`select_browser` deviceId đó **trước**, rồi mở:

```
https://seller-vn.tiktok.com/chat/inbox/current?shop_region=VN
```

Nếu báo `Navigation ... not allowed` / nhảy màn đăng nhập / "Không có quyền" →
phân biệt 3 lỗi theo bảng trong [reference_chrome_browsers](../../shared/reference_chrome_browsers.md),
đừng vội kết luận "mất quyền" ([feedback_verify_before_claiming_no_permission](../../shared/feedback_verify_before_claiming_no_permission.md)).

## Các bước

1. Mở inbox `current`. Danh sách cuộc đang mở sắp theo thời gian, mỗi cuộc hiện
   tên khách + tin cuối + mốc thời gian.
2. **Lọc cuộc "có trả lời hôm nay":** chỉ xét cuộc có **ít nhất 1 tin do shop
   gửi trong ngày hôm nay**. Cách nhận biết nhanh: tin cuối của cuộc là của shop
   (không phải khách đang chờ) và mốc thời gian thuộc hôm nay; hoặc mở cuộc ra
   thấy có lượt shop trả lời hôm nay.
   - Cuộc mà **tin cuối là của khách, chưa ai trả lời** → KHÔNG thuộc digest này
     (đó là việc của task "tổng hợp tin chưa trả lời" / của size-consultation).
     Bỏ qua ở đây.
3. **Với mỗi cuộc đủ điều kiện,** mở ra đọc hội thoại, rồi rút gọn thành 1 mục:
   - **Tên khách** (username hiển thị).
   - **Hỏi:** tóm tắt (hoặc trích ngắn) câu hỏi / vấn đề của khách. Nhiều lượt
     thì nêu ý chính.
   - **Shop trả lời:** tóm tắt câu trả lời shop đã gửi hôm nay.
   - **Loại:** gắn 1 nhãn ngắn — size / còn hàng / vận chuyển / sau bán (đổi-trả,
     giao thiếu) / KOC xin mẫu / thông tin SP / chào-đóng / khác (dựa 8 nhóm FAQ
     đã biết, xem size-consultation mục FAQ).
   - **★ (nếu có):** gắn khi câu trả lời không khớp mẫu có sẵn (heuristic mục ⚠️2)
     → đây là ứng viên để rút case. Ghi "(suy đoán xử lý tay)".
4. **Rút "Case/quy trình học được" (ĐỀ XUẤT):** nhìn qua các mục ★ và cả các câu
   trả lời hay, tổng hợp 1–4 gạch đầu dòng kiểu:
   - Tình huống mới chưa có mẫu + cách shop đã trả lời → đề xuất bổ sung vào
     skill nào (vd "thêm vào cskh-ship-faq mẫu trả lời khi khách hỏi ...").
   - Quy trình xử lý một ca (vd đổi size sau mua: shop hỏi "đã nhận hàng chưa"
     trước) → đề xuất chuẩn hoá.
   - Nếu hôm nay không có gì mới đáng học → ghi đúng "Hôm nay không có case mới
     cần train." Đừng bịa ra bài học.
   **Chỉ đề xuất** — tuyệt đối không tự sửa file skill ở lượt chạy này.

## Gửi báo cáo Telegram

Bot "Báo cáo" (chat ID chủ shop `1874515158`) — token thật lấy từ memory local
`reference_telegram_bot.md` trên PC, KHÔNG commit vào repo. Xem
[reference_telegram_bot](../daily-warehouse-report/references/reference_telegram_bot.md).

Trên PC (Git Bash) tiếng Việt phải ghi ra file UTF-8 rồi gửi
`--data-urlencode "text@<file>"` (nếu truyền thẳng sẽ lỗi encode).

**Chạy chung lượt với task "tổng hợp tin chưa trả lời":** gửi digest này thành
**một tin Telegram riêng, ngay sau** phần báo cáo tin chưa trả lời của task kia
(hai tin liền nhau, cùng buổi tối) — không cần gộp vào cùng một message. Nếu
skill này được gọi tay độc lập thì cứ gửi một mình.

**Khung báo cáo** (gọn, dễ đọc trên điện thoại — đây là bản để xem lại, không
rút về 1 dòng như báo cáo đánh giá/trả hàng):

```
📋 Tổng hợp chat đã trả lời hôm nay (TikTok) — <ngày dd/mm>
<N> cuộc đã trả lời.

1. <tên khách> [<loại>]
   Hỏi: <tóm tắt>
   Shop rep: <tóm tắt>
   ★ (suy đoán xử lý tay)      ← chỉ in dòng này nếu có đánh dấu ★
2. ...

🎓 Case/quy trình rút ra (đề xuất — anh duyệt rồi em mới ghi vào skill):
- <bài học 1>
- <bài học 2>

Lưu ý: không lấy được cuộc đã đóng trong ngày (TikTok ẩn mục "Đã đóng").
```

- **N = 0** (hôm nay không cuộc nào đang mở có trả lời): vẫn gửi 1 tin ngắn
  "📋 Hôm nay không có cuộc chat đang mở nào đã trả lời để tổng hợp (TikTok)."
  để chủ shop biết việc đã chạy — trừ khi chủ shop nói im lặng khi rỗng.
- Danh sách nhiều hơn ~15 cuộc thì ưu tiên liệt kê đủ các cuộc có ★ + các loại
  đáng chú ý (sau bán, KOC, khiếu nại), các cuộc size/chào-đóng lặp lại có thể
  gộp đếm ("8 cuộc tư vấn size thường").
- Dòng "Lưu ý" về cuộc đã đóng: luôn giữ để chủ shop nhớ digest không đầy đủ.

## Nối vào task buổi tối trên PC

Task "tổng hợp tin nhắn chưa tự trả lời" nằm trong Windows Task Scheduler trên
PC (do chủ shop tạo, không ở repo). Để chạy chung, thêm vào prompt của task đó
một câu gọi skill này **sau khi** đã quét xong phần tin chưa trả lời, ví dụ:
"...xong rồi chạy tiếp skill daily-chat-digest để tổng hợp các chat đã trả lời
trong ngày và gửi Telegram." Cả hai dùng chung một lần mở inbox TikTok.

Nếu sau này muốn tách thành task riêng: tạo bằng mẫu `scripts/setup-sync-task.ps1`
(đổi TaskName + lệnh gọi skill + giờ chạy, vd 21:30).
