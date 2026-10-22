---
name: size-consultation
description: Reply to TikTok Shop / Shopee chat messages for shop SOME.TIME's sleepwear -- use whenever the shop owner says "check ib khách", "vào rep khách đi", "trả lời tin nhắn khách/size" or similar, or this is the scheduled chat-reply task. PRIMARY scope is genuine product SIZE questions (height/weight -> size nào, or a request for the size chart) -- covers quần Hoạt Hình (Quần Lông), Quần Caro, Quần Thun / Bộ Dài / Bộ Ngắn / Quần Short / Combo. Also handles (CHỐT 2026-10-22, since no other scheduled skill covers them) generic greetings with no specific ask ("Hi", "Shop ơi") and stock-availability questions ("còn size nào không"). Do NOT use this for khiếu nại, giao thiếu hàng, logistics, KOC/affiliate, generic "ok"/"dạ" acknowledgments, or a customer's post-purchase worry/complaint even if it mentions "size"/"dài"/"rộng" -- those stay unanswered for the shop owner or another skill.
---

# Tư vấn size cho khách (chat TikTok Shop & Shopee)

## Phạm vi — CHỈ trả lời câu hỏi size thật

Một tin nhắn được coi là "câu hỏi size" khi khách hỏi thẳng "size nào/số đo
bao nhiêu" (thường kèm chiều cao/cân nặng), hoặc xin bảng size chung.

**KHÔNG trả lời** (để trống cho chủ shop hoặc skill khác xử lý), kể cả khi
có chữ "size"/"dài"/"rộng" trong câu:
- Khiếu nại, giao thiếu hàng, logistics, KOC/affiliate
- "ok"/"dạ" xác nhận chung chung
- (Riêng "hỏi tồn kho" và "chào chung không hỏi gì" — nay skill này CÓ xử
  lý, xem mục "Mở rộng phạm vi" cuối file, không còn nằm trong danh sách
  loại trừ này nữa.)
- Lo lắng/hỏi lại **sau khi đã đặt hàng** (vd "sợ về sẽ dài quá", "hàng có
  đúng size không") — đây là CSKH/khiếu nại, không phải tư vấn size mới
- Đổi size cho đơn **đã lỡ đặt nhầm** (vd "mình lỡ đặt 2XL, mặc XL được
  không") — đây là đổi đơn, không phải tư vấn size mới

(Case thực tế từng trả lời nhầm: `nhwhung23` lo "sợ về sẽ dài và rộng" sau
khi đã mua — chủ shop sửa lại 2026-10-10, từ đó áp dụng đúng ranh giới
trên.)

## Nguồn quy tắc — đọc theo thứ tự ưu tiên

1. **[references/size-spec.md](references/size-spec.md)** — đặc tả chính
   thức, chốt với chủ shop 13/10/2026. Đây là nguồn CHUẨN MỚI NHẤT, có bảng
   quyết định rõ ràng (không chồng khoảng), bảng cân nặng Caro riêng, quy
   tắc kẹp theo dải size SKU, +1 size cho Caro cotton thường, và 20 test
   case. Nếu có mâu thuẫn với bất kỳ nguồn nào khác, file này thắng.
2. **[references/size-rules.json](references/size-rules.json)** — cùng nội
   dung ở dạng dữ liệu máy đọc được (bảng tra cứu, mẫu câu, test case) —
   dùng để tra nhanh khi trả lời, không cần đọc lại toàn bộ spec mỗi lần.
3. File local `~/Desktop/Tài liệu/du-lieu-cskh-some-a-time.md` — tài liệu
   CSKH tổng (văn phong, chính sách sàn, vận chuyển, đổi trả...) — đọc khi
   cần quy tắc ngoài phạm vi size thuần (vd văn phong chung, quy định chat
   theo sàn).
4. Artifact "Sometime Product Guide" / Claude Doc "Workflow Tư vấn Size" —
   tham chiếu phụ, chỉ đọc khi 2 nguồn trên không đủ.

**Lưu ý quan trọng:** mục 8 của size-spec.md liệt kê 5 điểm "chưa chốt"
(CT/PJD/PJC/QS chưa có bảng đo riêng, +1 size cotton thường Caro, bảng cân
nặng Caro riêng, ngưỡng giới tính không rõ, combo thiếu cặp size) — đặc tả
đã có số liệu tạm dùng được ngay, nhưng nếu chủ shop phản hồi khác thì sửa
lại cả size-spec.md lẫn size-rules.json.

## Quy trình

1. Mở `https://seller-vn.tiktok.com/chat/inbox/current?shop_region=VN` và
   `https://banhang.shopee.vn/webchat/conversations`, rà các hội thoại
   "Chưa trả lời"/mới — xem đúng phạm vi ở trên trước khi trả lời.
2. Xác định nhóm sản phẩm (Quần Hoạt Hình / Caro / Thun / Bộ / Short /
   Combo) từ card sản phẩm đính kèm trong hội thoại. Nếu SKU cụ thể có dải
   size riêng (vd chỉ bán M–XL) thì **kẹp theo đúng SKU đó**, không theo
   bảng mặc định của cả nhóm (B4 trong size-spec.md mục 4) — tra
   `size_rules.json.product_groups.<nhóm>.sku_overrides` hoặc hỏi lại/kiểm
   tra variant trên trang sản phẩm nếu không chắc.
   **Không có card sản phẩm / không rõ mẫu (CHỐT 2026-10-22):** hỏi lại
   khách xác nhận đúng mẫu phổ biến nhất trước, ví dụ: *"Dạ bạn đang hỏi về
   size quần lông đúng không ạ?"* — không tự bịa size khi chưa rõ mẫu.
   **Combo thiếu cặp size (mục 8.5 size-spec.md):** đừng vội kết luận
   "không có" — combo đã làm gần đủ 95%, phải tra thật trên Sapo/sàn
   (biến thể combo thật) trước; chỉ khi xác nhận thật không có cặp đó mới
   tư vấn mua lẻ 2 quần.
3. Chạy thuật toán B1→B5 trong size-spec.md mục 4 (tra bảng chiều cao →
   xét cân nặng nếu có → áp mốc dài khách thích nếu có → kẹp dải size →
   lấy dài quần) để ra đúng 1 size + dài quần + cờ cảnh báo nếu có.
4. **Gửi bảng size chi tiết của đúng mẫu khách hỏi TRƯỚC, thành 1 tin riêng**
   (ảnh/bảng công khai mục 2.1 hoặc 3.1 size-spec.md), rồi mới gửi tin tư
   vấn size (CHỐT 2026-10-22, theo đúng mục 3.0 file CSKH gốc).
   Áp đúng mẫu câu trong size-rules.json.reply_templates theo tình huống
   (bình thường / thừa cân / gầy / kẹp min / kẹp max / thiếu dữ liệu...).
   Văn phong: xưng "mình", gọi khách "bạn", xen kẽ "ạ"/"á" (không lặp 2
   lần liền), áp dụng công thức 1+1 (trả lời đủ ý + 1 câu hỏi/gợi ý chủ
   động, ví dụ hỏi mốc dài quần nếu chưa biết).
   **Khách hỏi/lo "sợ rộng/chật eo" (CHỐT 2026-10-22 — đã có câu trả lời
   chuẩn, không còn phải báo chủ shop nữa):** ghép thêm câu
   `fear_tight_or_loose_waist_suffix` vào SAU câu tư vấn size: *"Dạ bên
   mình cạp quần là cạp chun co giãn nên bạn không cần lo rộng/chật eo quá
   đâu ạ."*
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

- **Sợ rộng/chật eo**: đã có câu chuẩn (xem bước 4 ở trên) — cạp chun co
  giãn, tự trả lời được, không cần báo chủ shop nữa.
- **Mốc dài quần**: chạm gót = gấu quần chạm gót chân (che qua mắt cá);
  mắt cá = ngắn hơn, ngang mắt cá chân; quét đất = dài chạm sàn.

## Mở rộng phạm vi (ngoài size thuần, nhưng cùng chạy trong task lịch trả lời khách — CHỐT 2026-10-22)

Task tự động "trả lời khách" theo lịch cũng xử lý luôn 2 case dưới đây
(không phải size, nhưng không có skill riêng nào khác đang chạy theo lịch
này, nên gộp vào đây để không bị quên lần nữa):

- **Chào chung, không hỏi gì cụ thể** (vd chỉ "Hi", "Shop ơi", "Alo"):
  trả lời "Dạ, bạn cần shop tư vấn gì ạ?" — không suy đoán khách muốn hỏi
  size hay gì khác.
- **Hỏi còn hàng size nào** (vd "còn size M không ạ"): vào kiểm tra tồn
  kho thật (Sapo/trang sản phẩm) rồi báo đúng các size hiện đang còn.
  Nếu khách hỏi **ngày dự kiến hàng về** (hàng đang hết, chưa có lịch về)
  thì KHÔNG tự đoán ngày — trả lời khách "bạn chờ xíu mình kiểm tra rồi
  báo ngay ạ", đồng thời gửi thông báo qua Telegram cho chủ shop (token +
  chat ID + cách gửi curl: xem
  `../daily-warehouse-report/references/reference_telegram_bot.md`) để
  chủ shop tự vào xử lý tiếp, không tự trả lời ngày cụ thể cho khách.

## Test nhanh trước khi tin tưởng thay đổi logic

Nếu sửa lại thuật toán hoặc bảng số liệu, chạy thử qua 20 test case trong
`size-rules.json.test_cases` (khớp mục 7 size-spec.md) để đảm bảo không vỡ
case cũ — đặc biệt case 17 (thứ tự B2 rồi B3) và case 18 (kẹp theo SKU).
