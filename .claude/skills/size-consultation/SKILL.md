---
name: size-consultation
description: Reply to TikTok Shop / Shopee chat messages for shop SOME.TIME's sleepwear -- use whenever the shop owner says "check ib khách", "vào rep khách đi", "trả lời tin nhắn khách/size" or similar, or you need to compute a size for a customer. PRIMARY scope is genuine product SIZE questions (height/weight -> size nào, or a request for the size chart) -- covers quần Hoạt Hình (Quần Lông), Quần Caro, Quần Thun / Bộ Dài / Bộ Ngắn / Quần Short / Combo. Also handles (chốt 2026-10-22/23) generic greetings with no specific ask ("Hi", "Shop ơi"), stock-availability questions ("còn size nào không" -- must confirm which phân loại first), closing out finished conversations, and short product-FAQ questions (unisex? có dây rút không?). Also handles (chốt 2026-10-28, xem references/cskh-ship-faq.md) shipping-time questions / giục giao gấp / "khi nào đơn đến / khi nào vận chuyển" (TikTok=J&T, Shopee=SPX, kho Hà Nội, mốc 3h chiều gửi trong ngày), "được kiểm tra hàng trước khi nhận không", a customer's post-purchase worry "sợ dài/rộng quá" (now reassure đổi trả), and a KOC/creator messaging in the inbox to xin mẫu, and đổi size / đổi trả hàng sau khi mua (quy trình Mục 8 + mẫu câu chuẩn ở Google Sheet "Mau tin nhan"). Still do NOT use this for khiếu nại nặng without a template or sửa thông tin đơn (sai SĐT, shipper không liên hệ được) -- those stay for the shop owner.
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

1. **Dùng Claude in Chrome** ([reference_chrome_browsers](../../shared/reference_chrome_browsers.md)) — KHÔNG dùng
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
   **Không có card sản phẩm / không rõ mẫu (chốt 23/10/2026, thay cho quy
   tắc 22/10 "hỏi lại *Dạ bạn đang hỏi về size quần lông đúng không ạ?*"):**
   KHÔNG hỏi lại. Mặc định tư vấn theo **quần lông** (bảng A): gửi câu size
   như bình thường (đúng mẫu theo tình huống), rồi nối thêm đúng câu mẫu
   `reply_templates.default_quan_long_note`: *"Mình đang tư vấn theo quần
   lông ạ, nếu bạn cần tư vấn mẫu quần khác thì báo mình nha."*
   Lý do: shop chủ yếu bán quần lông, khách đưa chiều cao/cân nặng thì gần
   như chắc chắn hỏi quần lông; hỏi lại bị khách mắng ("hỏi quần lông chứ
   không lẽ quần sịp lọt khe" — user23042014_, 23/10/2026).
   - Khách nhắc rõ dòng khác (caro, thun, bộ, short...) → tư vấn theo dòng
     đó, không thêm câu note quần lông.
   - Khách đã xác nhận là quần lông trong hội thoại → chỉ gửi câu size,
     không thêm câu note.
   **Mẫu khách chọn không có size nhỏ cần thiết (chốt 23/10/2026):** nếu
   size tính ra nhỏ hơn size nhỏ nhất của mẫu khách chọn (vd muốn mắt cá →
   cần S, nhưng Chất Lông-Hello Kitty chỉ từ M) mà có mẫu khác cùng dòng có
   size đó (vd Chất Lông-Shin có S) → dùng mẫu câu
   `reply_templates.clamped_min_suggest_other` (báo size nhỏ nhất + dài
   quần thực tế, mời khách tự đo, gợi ý đổi mẫu). Không có mẫu thay thế →
   dùng `clamped_min` như cũ.
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
- **Nam nữ mặc chung được không** (chốt 23/10/2026): được, **tất cả các dòng
  quần đều unisex**. Trả lời đúng câu: *"Dạ quần bên mình nam nữ đều mặc
  được bạn nha."*
- **Quần có dây rút không** (chốt 23/10/2026): **CHỈ Quần Caro có dây
  rút.** Mọi dòng khác (Hoạt Hình, Thun, Bộ Dài/Ngắn, Short) **KHÔNG có dây
  rút** — tất cả đều là cạp chun co giãn nhiều (khớp câu trả lời "sợ
  rộng/chật eo" ở trên). Trả lời theo đúng dòng khách hỏi, đừng mặc định.

## Đọc tin nhắn viết tắt — đừng đoán nhầm "mét" thành "cân" (chốt 23/10/2026)

Khách hay gõ tắt chiều cao kiểu "m" + số thay vì "1m" + số, dễ đọc nhầm
thành cân nặng. Case thật: `yabaooo.10` gõ `"m50sz j ạ"` — nghĩa thật là
**"1m50, size gì ạ"** (chiều cao 1m50, hỏi size), nhưng bị đọc nhầm thành
"50kg" nên hỏi lại cả chiều cao lẫn cân nặng — dư vì khách đã cho chiều cao
rồi, trông như không đọc tin khách. Chủ shop sửa lại 23/10/2026, câu đúng ra
phải là "Dạ 1m50 bạn mặc size S (92cm, chạm gót) nhé ạ. Bạn cho mình xin
thêm cân nặng để mình chắc chắn hơn ạ." (áp mẫu `missing_weight`).

**Cách đọc:** "m" + số 2 chữ số đứng đầu câu, không kèm "kg"/"ký" ngay sau
→ hiểu là viết tắt "Xm Y0" (chiều cao mét), KHÔNG phải cân nặng — vd "m50"
= 1m50 = 150cm, "m55" = 1m55 = 155cm, "m6"/"m60" = 1m60. Chỉ hiểu là cân
nặng khi có "kg"/"ký" đi kèm (vd "50kg", "50 ký"). Viết tắt thường gặp
khác: "sz" = "size", "j" = "gì" (giọng miền Nam gõ tắt, không phải lỗi gõ).

Gặp tin dạng số+chữ viết tắt mà không chắc đọc đúng nghĩa → vẫn hỏi lại cho
chắc (an toàn hơn đoán sai), nhưng ưu tiên cách đọc "m" = mét theo quy tắc
trên trước khi kết luận "không rõ nghĩa".

## Đóng hội thoại đã xong — PHẢI đọc kỹ ngữ cảnh trước (chốt 22/10/2026)

Thấy tin cuối của khách chỉ là xác nhận ngắn ("Dạ", "ok shop", emoji 😁...)
→ **không được kết luận ngay là xong** chỉ dựa vào preview hoặc thẻ (vd
"Trước khi mua") hiện ngoài danh sách. **Mở đúng hội thoại đó, đọc lại toàn
bộ nội dung trước đó** để hiểu khách đã hỏi gì / được tư vấn gì, xác nhận
thật sự không còn câu hỏi nào treo lại, rồi mới chọn cách đóng:

- Hội thoại **tư vấn trước khi mua** (size, sản phẩm...) đã xong → trả lời
  bằng chữ **"Dạ vâng ạ"**, giữ không khí tư vấn bán hàng.
- Hội thoại **CSKH / sau khi mua** đã xử lý xong → gửi **sticker** mèo/chó
  ôm tim, không gõ chữ (xem [feedback_close_resolved_chats_with_emoji](../../shared/feedback_close_resolved_chats_with_emoji.md)).

Đọc lại mà thấy còn câu hỏi/vấn đề chưa xử lý (dù tin cuối trông như xác
nhận) → xử lý đúng câu hỏi đó trước, không đóng vội.

⚠️ **Trước khi gửi "Dạ vâng ạ"/sticker — kiểm tra xem đã đóng rồi chưa, tránh
gửi lặp** (chốt 2026-10-23, sau case `missed.luv251` bị gửi "Dạ vâng ạ" lặp
3 lần liền 00:07/07:07/07:14): tin nhắn CUỐI CÙNG trong hội thoại đã là tin
của SHOP (không phải của khách) VÀ nội dung đã đúng là "Dạ vâng ạ"/sticker
rồi → **không gửi lại**, coi như đã đóng, bỏ qua case này. Chỉ gửi khi tin
cuối cùng là của khách (chưa có ai đóng). Trên TikTok, đọc nội dung tin cuối
bằng `get_page_text` (không dùng preview sidebar hay chỉ nhìn screenshot) vì
trang bị Chrome dịch tự động làm méo chữ, dễ đọc nhầm tin đã đóng thành tin
lạ rồi tưởng chưa xử lý — xem
[reference_tiktok_tab_auto_translate](../../shared/reference_tiktok_tab_auto_translate.md).

Chủ shop nhấn mạnh 22/10/2026: **hiểu đúng ngữ cảnh đoạn chat là quan trọng
nhất**, quan trọng hơn việc khớp mẫu tin nhắn cuối.

## Chào chung & hỏi tồn kho (chốt 22/10/2026)

- **Khách chào chung, không hỏi gì cụ thể** (chỉ "Hi", "Shop ơi", "Alo"):
  trả lời đúng câu **"Dạ, bạn cần shop tư vấn gì ạ?"** — không đoán khách
  định hỏi gì.
- **Khách hỏi còn hàng / còn size nào** (chốt 23/10/2026, bổ sung bước hỏi
  phân loại): **PHẢI xác định đúng phân loại/mẫu khách hỏi TRƯỚC** (màu,
  hoạ tiết, chất liệu — hỏi lại khách nếu chưa rõ, giống bước xác nhận mẫu
  ở trên), rồi mới vào kiểm tra tồn kho thật (Sapo/trang sản phẩm) đúng
  phân loại đó, rồi mới báo đúng các size hiện còn. Không kiểm tra/trả lời
  khi chưa biết chắc đúng phân loại nào.
- **Khách hỏi ngày dự kiến hàng về** (hàng đang hết): KHÔNG tự đoán ngày.
  Trả lời khách **"bạn chờ xíu mình kiểm tra rồi báo ngay ạ"**, đồng thời
  gửi Telegram báo chủ shop (token + chat ID + lệnh curl:
  `../daily-warehouse-report/references/reference_telegram_bot.md`) để chủ
  shop tự vào xử lý tiếp.

## Vận chuyển & CSKH khác (chốt 28/10/2026)

Rà FAQ chat TikTok 1 tháng (28/10/2026), chủ shop train thêm 6 tình huống mà
TRƯỚC ĐÂY skill để trống. Nay đã có mẫu chuẩn — xem đầy đủ bảng + mẫu câu ở
[references/cskh-ship-faq.md](references/cskh-ship-faq.md). Tóm tắt:

- **Hãng theo sàn:** TikTok dùng **J&T** (chậm hơn), Shopee dùng **SPX** (nhanh
  hơn ~1–3 ngày). Kho gửi **Hà Nội**. Báo thời gian giao theo đúng hãng của sàn;
  không chắc → báo theo J&T (dải chậm, an toàn).
- **Mốc 3h chiều:** đơn đặt trước 3h chiều gửi đi trong ngày; đơn đi tới 19:59
  vẫn tính là gửi hôm nay (nên 4h chiều vẫn tính hôm nay).
- **Giục giao / khi nào đến / khi nào vận chuyển:** báo mốc 3h chiều + thời gian
  theo khu vực khách (tra bảng J&T/SPX trong file trên); nói rõ là "dự kiến".
- **Kiểm tra hàng trước nhận:** sàn có cho kiểm tra trước, không ưng vẫn trả được.
- **Lo sau mua (sợ dài/rộng):** nay TRẢ LỜI "sẵn sàng hỗ trợ đổi trả nếu không
  vừa" — **thay quy tắc cũ** (trước để trống cho chủ shop).
- **KOC inbox xin mẫu:** hướng khách bấm yêu cầu mẫu, bộ phận duyệt sẽ duyệt.
- **Khách chỉ cho cân nặng:** tư vấn size theo cân nặng trước rồi xin chiều cao
  (mẫu `missing_height` trong size-rules.json đã sửa 28/10).
- **Văn phong:** bỏ tym/emoji cuối câu, viết tự nhiên như người thật.
- **Đổi size / đổi trả sau mua (chốt 28/10):** nay XỬ LÝ được — quy trình Mục 8 +
  mẫu câu chuẩn ở Google Sheet "Mau tin nhan" (TikTok/Shopee riêng). Xem
  references/cskh-ship-faq.md.
- **Nguồn mẫu CSKH ngoài size (master):** Google Sheet "Mau tin nhan"
  (`1X08EPdWfJeiP4aQGzcA35UGtmTjzbUYcC0jidU-05WE`) — đổi/trả/hoàn/deal lỗi 2 sàn.
- **CHƯA train:** sửa thông tin đơn (sai SĐT, shipper không liên hệ được) +
  khiếu nại nặng chưa có mẫu → chủ shop/PC xử lý.
- **Không in tên SP/giá trên hộp (chốt 30/10):** từ chối khéo, nêu lý do vận
  hành (shipper cần giá, kho cần tên SP) — xem mục 11 file trên.
- **Đổi size TRƯỚC khi đóng gói (chốt 30/10):** phải tra trạng thái đơn
  trước (TikTok "Chờ vận chuyển" / Shopee "Đã xử lý"?); đã xử lý thì không
  kịp đổi, chưa xử lý thì ưu tiên khuyên đặt lại đơn mới hơn là ghi chú (ghi
  chú rủi ro cao) — xem mục 12.
- **"Chưa nhận được hàng" (chốt 30/10):** hướng khách tự kiểm tra cuộc gọi
  nhỡ/người nhà trước, rồi tự gọi shipper; LUÔN kèm câu hẹn khách quay lại
  nếu vẫn không thấy để shop tìm/khiếu nại sàn — xem mục 13.
- **Khách tự huỷ/đặt lại sàn khác, không phải lỗi SP (chốt 30/10):** không
  dùng sticker như CSKH thường — trả lời ngắn "Dạ vâng ạ" rồi đóng — mục 14.

## Bản cho Sapo Chatbot AI (bắt đầu 27/10/2026)

Đang làm bộ cấu hình để Chatbot AI của Sapo (chỉ Shopee) trả lời giống skill
này: [sapo-chatbot-ai/huong-dan-cai-dat.md](sapo-chatbot-ai/huong-dan-cai-dat.md).
Sửa quy tắc ở file này / size-spec / size-rules.json thì chạy lại
`python sapo-chatbot-ai/build_sapo_files.py` và nạp lại file mới lên Sapo.

## Test nhanh trước khi tin tưởng thay đổi logic

Nếu sửa lại thuật toán hoặc bảng số liệu, chạy thử qua 20 test case trong
`size-rules.json.test_cases` (khớp mục 7 size-spec.md) để đảm bảo không vỡ
case cũ — đặc biệt case 17 (thứ tự B2 rồi B3) và case 18 (kẹp theo SKU).
