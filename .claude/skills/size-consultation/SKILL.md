---
name: size-consultation
description: Reply to TikTok Shop / Shopee chat messages that are genuine product SIZE questions (height/weight -> size nào, or a request for the size chart) for shop SOME.TIME's sleepwear -- use whenever the shop owner says "check ib khách", "vào rep khách đi", "trả lời tin nhắn size" or similar, or you need to compute a size for a customer. Covers quần Hoạt Hình (Quần Lông), Quần Caro, and (unconfirmed numbers) Quần Thun / Bộ Dài / Bộ Ngắn / Quần Short / Combo. Do NOT use this for anything else in the chat inbox (khiếu nại, giao thiếu hàng, logistics, hỏi tồn kho, KOC/affiliate, generic "ok"/"dạ" acknowledgments, or a customer's post-purchase worry/complaint even if it mentions "size"/"dài"/"rộng") -- those stay unanswered for the shop owner or another skill.
---

# Tư vấn size cho khách (chat TikTok Shop & Shopee)

## Phạm vi — CHỈ trả lời câu hỏi size thật

Một tin nhắn được coi là "câu hỏi size" khi khách hỏi thẳng "size nào/số đo
bao nhiêu" (thường kèm chiều cao/cân nặng), hoặc xin bảng size chung.

**KHÔNG trả lời** (để trống cho chủ shop hoặc skill khác xử lý), kể cả khi
có chữ "size"/"dài"/"rộng" trong câu:
- Khiếu nại, giao thiếu hàng, logistics, hỏi tồn kho, KOC/affiliate
- "ok"/"dạ" xác nhận chung chung
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
3. Chạy thuật toán B1→B5 trong size-spec.md mục 4 (tra bảng chiều cao →
   xét cân nặng nếu có → áp mốc dài khách thích nếu có → kẹp dải size →
   lấy dài quần) để ra đúng 1 size + dài quần + cờ cảnh báo nếu có.
4. Áp đúng mẫu câu trong size-rules.json.reply_templates theo tình huống
   (bình thường / thừa cân / gầy / kẹp min / kẹp max / thiếu dữ liệu...).
   Văn phong: xưng "mình", gọi khách "bạn", xen kẽ "ạ"/"á" (không lặp 2
   lần liền), áp dụng công thức 1+1 (trả lời đủ ý + 1 câu hỏi/gợi ý chủ
   động, ví dụ hỏi mốc dài quần nếu chưa biết).
5. Gửi thẳng cho khách (không cần hỏi chủ shop duyệt trước — đã xác nhận
   mức rủi ro thấp, tương tự các skill reply khác), trừ khi gặp case nằm
   trong mục "chưa chốt" (mục 8 size-spec.md) mà bạn không chắc số liệu
   tạm có đúng với SKU đang hỏi hay không — lúc đó hỏi lại chủ shop thay vì
   tự suy đoán.

## Test nhanh trước khi tin tưởng thay đổi logic

Nếu sửa lại thuật toán hoặc bảng số liệu, chạy thử qua 20 test case trong
`size-rules.json.test_cases` (khớp mục 7 size-spec.md) để đảm bảo không vỡ
case cũ — đặc biệt case 17 (thứ tự B2 rồi B3) và case 18 (kẹp theo SKU).
