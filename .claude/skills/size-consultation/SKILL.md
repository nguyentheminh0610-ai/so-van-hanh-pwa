---
name: size-consultation
description: Reply to TikTok Shop / Shopee chat messages for shop SOME.TIME's sleepwear -- use whenever the shop owner says "check ib khách", "vào rep khách đi", "trả lời tin nhắn khách/size" or similar, or you need to compute a size for a customer. PRIMARY scope is genuine product SIZE questions (height/weight -> size nào, or a request for the size chart) -- covers quần Hoạt Hình (Quần Lông), Quần Caro, Quần Thun / Bộ Dài / Bộ Ngắn / Quần Short / Combo. Also handles (chốt 2026-10-22) generic greetings with no specific ask ("Hi", "Shop ơi"), stock-availability questions ("còn size nào không"), and closing out finished conversations. Do NOT use this for khiếu nại, giao thiếu hàng, logistics, KOC/affiliate, or a customer's post-purchase worry/complaint even if it mentions "size"/"dài"/"rộng" -- those stay unanswered for the shop owner or another skill.
---

# Tư vấn size cho khách (chat TikTok Shop & Shopee)

## ⛔ BƯỚC 0 — CHỈ CHẠY TRÊN MÁY WINDOWS (bắt buộc, làm trước mọi thứ)

Chạy `hostname`. Nếu kết quả **không phải `DESKTOP-N7T8LNP`** (vd máy Mac)
→ **DỪNG NGAY**: không mở trình duyệt, không nhắn khách, **không gửi
Telegram**, chỉ trả lời 1 câu "Bỏ qua: việc này chỉ chạy trên máy Windows."
Chủ shop chốt 2026-10-21: mọi công việc chạy trên Windows, tránh 2 máy làm
trùng (khách bị nhắn 2 lần, Telegram nhận 2 báo cáo).


## Phạm vi — CHỈ trả lời câu hỏi size thật

Một tin nhắn được coi là "câu hỏi size" khi khách hỏi thẳng "size nào/số đo
bao nhiêu" (thường kèm chiều cao/cân nặng), hoặc xin bảng size chung.

**KHÔNG trả lời** (để trống cho chủ shop hoặc skill khác xử lý), kể cả khi
có chữ "size"/"dài"/"rộng" trong câu:
- Khiếu nại, giao thiếu hàng, logistics, KOC/affiliate
- Lo lắng/hỏi lại **sau khi đã đặt hàng** (vd "sợ về sẽ dài quá", "hàng có
  đúng size không") — đây là CSKH/khiếu nại, không phải tư vấn size mới
- Đổi size cho đơn **đã lỡ đặt nhầm** (vd "mình lỡ đặt 2XL, mặc XL được
  không") — đây là đổi đơn, không phải tư vấn size mới

(Chốt 22/10/2026: **hỏi tồn kho**, **chào chung không hỏi gì**, và **đóng
hội thoại đã xong** nay DO skill này xử lý — xem 2 mục cuối file. Trước đây
3 loại này nằm trong danh sách không trả lời.)

(Case thực tế từng trả lời nhầm: `nhwhung23` lo "sợ về sẽ dài và rộng" sau
khi đã mua — chủ shop sửa lại 2026-10-10, từ đó áp dụng đúng ranh giới
trên.)

## Nguồn quy tắc — đọc theo thứ tự ưu tiên

1. **[references/size-spec.md](references/size-spec.md)** — đặc tả chính
   thức, chốt với chủ shop 13/10/2026. Đây là nguồn CHUẨN MỚI NHẤT, có bảng
   quyết định rõ ràng (không chồng khoảng), bảng cân nặng Caro riêng, quy
   tắc kẹp theo dải size SKU, và 20 test case. Nếu có mâu thuẫn với bất kỳ
   nguồn nào khác, file này thắng.
2. **[references/size-rules.json](references/size-rules.json)** — cùng nội
   dung ở dạng dữ liệu máy đọc được (bảng tra cứu, mẫu câu, test case) —
   dùng để tra nhanh khi trả lời, không cần đọc lại toàn bộ spec mỗi lần.
3. Tài liệu CSKH tổng `du-lieu-cskh-some-a-time.md` (văn phong, chính sách
   sàn, vận chuyển, đổi trả...) — trên Windows ở
   `C:\sokho\so-van-hanh-pwa\tai-lieu\`, trên Mac ở `~/Desktop/Tài liệu/`.
   Đọc khi cần quy tắc ngoài size thuần. **Chốt 15/10/2026 ghi đè file này ở
   các điểm:** bỏ công thức 1+1; Caro cotton thường KHÔNG lên size; câu trả
   lời eo cạp chun (xem mục "Câu hỏi phụ" dưới).
4. Artifact "Sometime Product Guide" / Claude Doc "Workflow Tư vấn Size" —
   tham chiếu phụ, chỉ đọc khi 2 nguồn trên không đủ.

**Lưu ý quan trọng:** mục 8 size-spec.md — 4/5 điểm đã chốt xong 22/10/2026
(CT/PJD/PJC/QS dùng thẳng bảng A; cotton thường KHÔNG lên size; bảng cân
nặng Caro riêng; giới tính không rõ → ngưỡng nam). Chỉ còn mục 8.5 (combo
thiếu cặp size) là cách xử lý tạm — và với combo thì **phải tra thật trên
Sapo/sàn trước**, xem bước 2 dưới.

## Quy trình

1. **Dùng Claude in Chrome** ([[reference_chrome_browsers]]) — KHÔNG dùng
   built-in browser (không có session đã đăng nhập):
   - **TikTok Shop**: `select_browser` deviceId TikTok, mở
     `https://seller-vn.tiktok.com/chat/inbox/current?shop_region=VN`.
   - **Shopee**: `select_browser` deviceId Shopee, mở
     `https://banhang.shopee.vn/webchat/conversations`.
   Rà các hội thoại "Chưa trả lời"/mới — xem đúng phạm vi ở trên trước
   khi trả lời.
2. Xác định nhóm sản phẩm (Quần Hoạt Hình / Caro / Thun / Bộ / Short /
   Combo) từ card sản phẩm đính kèm trong hội thoại. Nếu SKU cụ thể có dải
   size riêng (vd chỉ bán M–XL) thì **kẹp theo đúng SKU đó**, không theo
   bảng mặc định của cả nhóm (B4 trong size-spec.md mục 4) — tra
   `size_rules.json.product_groups.<nhóm>.sku_overrides` hoặc hỏi lại/kiểm
   tra variant trên trang sản phẩm nếu không chắc.
   **Không có card sản phẩm / không rõ mẫu (chốt 22/10/2026):** hỏi lại
   khách xác nhận trước, đúng câu: *"Dạ bạn đang hỏi về size quần lông đúng
   không ạ?"* — không tự đoán mẫu rồi báo size.
   **Combo (chốt 22/10/2026):** combo đã làm gần đủ 95%, nên **không được
   vội kết luận "không có combo đúng cặp size"**. Phải tra biến thể combo
   thật trên Sapo/sàn trước; chỉ khi tra thật và xác nhận không có mới tư
   vấn khách mua lẻ 2 quần.
3. Chạy thuật toán B1→B5 trong size-spec.md mục 4 (tra bảng chiều cao →
   xét cân nặng nếu có → áp mốc dài khách thích nếu có → kẹp dải size →
   lấy dài quần) để ra đúng 1 size + dài quần + cờ cảnh báo nếu có.
4. Áp đúng mẫu câu trong size-rules.json.reply_templates theo tình huống
   (bình thường / thừa cân / gầy / kẹp min / kẹp max / thiếu dữ liệu...).
   Văn phong: xưng "mình", gọi khách "bạn", xen kẽ "ạ"/"á", trả lời **đơn
   giản**. **KHÔNG dùng công thức 1+1** (chủ shop bỏ 15/10/2026) — không tự
   thêm câu hỏi/gợi ý ngoài mẫu. (Câu hỏi mốc dài nằm sẵn trong mẫu "bình
   thường" thì giữ nguyên.)
   **NGẮN GỌN, ĐÚNG MẪU** (chủ shop chốt 2026-10-13): chỉ gửi đúng câu mẫu,
   **không thêm câu nào ngoài mẫu** — không thêm gợi ý "xuống size nếu thích
   mặc gọn", không "xắn gấu", không giải thích mẫu nào có/không có size.
   Đã biết mốc dài khách thích hoặc khách đã trả lời câu hỏi trước thì
   KHÔNG hỏi thêm câu cuối. Ví dụ đúng: "Dạ bạn thích quét đất thì lấy size
   XXL nhé ạ, dài quần 102cm là vừa đẹp."
5. Gửi thẳng cho khách (không cần hỏi chủ shop duyệt trước — đã xác nhận
   mức rủi ro thấp, tương tự các skill reply khác), trừ khi gặp case nằm
   trong mục "chưa chốt" (mục 8 size-spec.md) mà bạn không chắc số liệu
   tạm có đúng với SKU đang hỏi hay không — lúc đó hỏi lại chủ shop thay vì
   tự suy đoán.

## Câu hỏi phụ đã có câu trả lời chuẩn

- **Sợ rộng/chật eo** (chốt 15/10/2026, áp dụng mọi dòng quần): gửi đúng
  câu "Dạ hiện các quần bên mình đều là cạp chun cả, nên không sợ bị
  rộng/chật eo đâu ạ, bạn cứ yên tâm nha."
- **Gửi ảnh bảng size** (chốt 15/10/2026): KHÔNG gửi mặc định. Chỉ gửi khi
  khách xin bảng size/số đo chi tiết, hoặc khách đang phân vân / sợ rộng
  chật — gửi ảnh bảng size của đúng dòng quần (ảnh "Bảng kích cỡ" trên tin
  đăng) kèm câu "Dạ bạn xem thêm số đo chi tiết trong bảng size giúp mình
  nha." Lưu ý: ảnh bảng size trên tin đăng hiện CHƯA khớp đặc tả (chủ shop
  đang sửa) — khi tư vấn vẫn theo số liệu đặc tả.
- **Caro cotton thường (Đỏ 03, Đỏ 04, Đen 02)**: KHÔNG khuyên lên size (chốt
  15/10/2026) — tư vấn như caro thường.
- **Mốc dài quần**: chạm gót = gấu quần chạm gót chân (che qua mắt cá);
  mắt cá = ngắn hơn, ngang mắt cá chân; quét đất = dài chạm sàn.

## Đóng hội thoại đã xong — PHẢI đọc kỹ ngữ cảnh trước (chốt 22/10/2026)

Thấy tin cuối của khách chỉ là xác nhận ngắn ("Dạ", "ok shop", emoji 😁...)
→ **không được kết luận ngay là xong** chỉ dựa vào preview hoặc thẻ (vd
"Trước khi mua") hiện ngoài danh sách. **Mở đúng hội thoại đó, đọc lại toàn
bộ nội dung trước đó** để hiểu khách đã hỏi gì / được tư vấn gì, xác nhận
thật sự không còn câu hỏi nào treo lại, rồi mới chọn cách đóng:

- Hội thoại **tư vấn trước khi mua** (size, sản phẩm...) đã xong → trả lời
  bằng chữ **"Dạ vâng ạ"**, giữ không khí tư vấn bán hàng.
- Hội thoại **CSKH / sau khi mua** đã xử lý xong → gửi **sticker** mèo/chó
  ôm tim, không gõ chữ (xem [[feedback_close_resolved_chats_with_emoji]]).

Đọc lại mà thấy còn câu hỏi/vấn đề chưa xử lý (dù tin cuối trông như xác
nhận) → xử lý đúng câu hỏi đó trước, không đóng vội.

Chủ shop nhấn mạnh 22/10/2026: **hiểu đúng ngữ cảnh đoạn chat là quan trọng
nhất**, quan trọng hơn việc khớp mẫu tin nhắn cuối.

## Chào chung & hỏi tồn kho (chốt 22/10/2026)

- **Khách chào chung, không hỏi gì cụ thể** (chỉ "Hi", "Shop ơi", "Alo"):
  trả lời đúng câu **"Dạ, bạn cần shop tư vấn gì ạ?"** — không đoán khách
  định hỏi gì.
- **Khách hỏi còn hàng / còn size nào**: vào kiểm tra tồn kho thật
  (Sapo/trang sản phẩm) rồi báo đúng các size hiện còn.
- **Khách hỏi ngày dự kiến hàng về** (hàng đang hết): KHÔNG tự đoán ngày.
  Trả lời khách **"bạn chờ xíu mình kiểm tra rồi báo ngay ạ"**, đồng thời
  gửi Telegram báo chủ shop (token + chat ID + lệnh curl:
  `../daily-warehouse-report/references/reference_telegram_bot.md`) để chủ
  shop tự vào xử lý tiếp.

## Test nhanh trước khi tin tưởng thay đổi logic

Nếu sửa lại thuật toán hoặc bảng số liệu, chạy thử qua 20 test case trong
`size-rules.json.test_cases` (khớp mục 7 size-spec.md) để đảm bảo không vỡ
case cũ — đặc biệt case 17 (thứ tự B2 rồi B3) và case 18 (kẹp theo SKU).
