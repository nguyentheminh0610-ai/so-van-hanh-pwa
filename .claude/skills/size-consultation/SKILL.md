---
name: size-consultation
description: Reply to TikTok Shop / Shopee chat messages for shop SOME.TIME's sleepwear -- use whenever the shop owner says "check ib khách", "vào rep khách đi", "trả lời tin nhắn khách/size" or similar, or you need to compute a size for a customer. PRIMARY scope is genuine product SIZE questions (height/weight -> size nào, or a request for the size chart) -- covers quần Hoạt Hình (Quần Lông), Quần Caro, Quần Thun / Bộ Dài / Bộ Ngắn / Quần Short / Combo. Also handles (chốt 2026-10-22/23) generic greetings with no specific ask ("Hi", "Shop ơi"), stock-availability questions ("còn size nào không" -- must confirm which phân loại first), closing out finished conversations, and short product-FAQ questions (unisex? có dây rút không?). Also handles (chốt 2026-10-28, xem references/cskh-ship-faq.md) shipping-time questions / giục giao gấp / "khi nào đơn đến / khi nào vận chuyển" (TikTok=J&T, Shopee=SPX, kho Hà Nội, mốc 3h chiều gửi trong ngày), "được kiểm tra hàng trước khi nhận không", a customer's post-purchase worry "sợ dài/rộng quá" (now reassure đổi trả), and a KOC/creator messaging in the inbox to xin mẫu, and đổi size / đổi trả hàng sau khi mua (quy trình Mục 8 + mẫu câu chuẩn ở Google Sheet "Mau tin nhan"). Also (chốt 2026-11-21, xem references/cskh-doi-hang-loi-21-11.md) handles giao sai mẫu / hàng lỗi-bẩn-rách complaints end-to-end when the customer already sent photos: apologise + confirm fault, offer free exchange + voucher, send the exchange guide, send the 10k voucher (NOT for giao thiếu -- that stays with resend-missing-item); 22/11/2026 updates: hàng lỗi chỉ đổi (trả hàng hoàn tiền chỉ khi khách yêu cầu), 10k voucher ONLY for shop fault (not for đổi size rộng/chật), unclear evidence → first reply + push to Sổ Vận Hành (no Telegram); 23/11/2026: photo OR video is enough, also handles giao thiếu entry messages + đổi size end-to-end — LATEST message wording for all 4 after-sales cases lives in .claude/shared/hau-mai-mau-tin-moi-nhat.md. Still do NOT use this for khiếu nại nặng without a template or sửa thông tin đơn (sai SĐT, shipper không liên hệ được) -- those stay for the shop owner.
---

# Tư vấn size cho khách (chat TikTok Shop & Shopee)

## ⛔ BƯỚC 0 — CHỈ CHẠY TRÊN MÁY WINDOWS (bắt buộc, làm trước mọi thứ)

Chạy `hostname`. Nếu kết quả **không phải `DESKTOP-N7T8LNP`** (vd máy Mac)
→ **DỪNG NGAY**: không mở trình duyệt, không nhắn khách, **không gửi
Telegram**, chỉ trả lời 1 câu "Bỏ qua: việc này chỉ chạy trên máy Windows."
Chủ shop chốt 2026-10-21: mọi công việc chạy trên Windows, tránh 2 máy làm
trùng (khách bị nhắn 2 lần, Telegram nhận 2 báo cáo).


## ⭐ HẬU MÃI — ĐỌC TRƯỚC (chốt 23/11/2026, chủ shop: "toàn bộ lượt chat tiếp theo phải dùng bản mới nhất")

Khách đã có đơn và báo **giao thiếu / giao nhầm / hàng lỗi / muốn đổi size vì rộng-chật-dài** → task **TỰ XỬ LÝ ĐỦ LUỒNG**
(không còn "chỉ nhắn tin đầu rồi báo Telegram", không còn "để trống cho chủ shop"). Câu chữ + thứ tự tin + quy tắc chung:
**[../../shared/hau-mai-mau-tin-moi-nhat.md](../../shared/hau-mai-mau-tin-moi-nhat.md)** — bản chuẩn duy nhất, thắng mọi câu cũ
trong file này, trong Sheet và trong tài liệu cục bộ. Ghi tiến độ lên Sổ Vận Hành theo [../../shared/tien-do-xu-ly.md](../../shared/tien-do-xu-ly.md),
không Telegram. Các dòng "KHÔNG trả lời" bên dưới **không áp dụng** cho 4 case này.

## Phạm vi — CHỈ trả lời câu hỏi size thật

Một tin nhắn được coi là "câu hỏi size" khi khách hỏi thẳng "size nào/số đo
bao nhiêu" (thường kèm chiều cao/cân nặng), hoặc xin bảng size chung.

**KHÔNG trả lời** (để trống cho chủ shop hoặc skill khác xử lý), kể cả khi
có chữ "size"/"dài"/"rộng" trong câu:
- Khiếu nại khác, logistics, KOC/affiliate (RIÊNG giao sai/hàng lỗi-bẩn-rách: **chốt 21/11/2026** khách đã gửi ảnh + lỗi rõ → CS tự chạy đủ 5 bước đổi hàng + tặng mã giảm 10k, xem [references/cskh-doi-hang-loi-21-11.md](references/cskh-doi-hang-loi-21-11.md); từ 23/11/2026 khách gửi ảnh HOẶC video là đủ, không tự thẩm định lỗi; chỉ đòi bồi thường thêm mới đẩy Sổ Vận Hành `[chờ anh]`; khách đòi trả hàng hoàn tiền → hướng dẫn trả hàng (22/11/2026); giao thiếu: theo resend-missing-item)
- Lo lắng/hỏi lại **sau khi đã đặt hàng** (vd "sợ về sẽ dài quá", "hàng có
  đúng size không") — đây là CSKH/khiếu nại, không phải tư vấn size mới.
  **NGOẠI LỆ (chốt 23/11/2026):** khách đã đặt rồi nhưng hỏi thẳng "cao X nặng
  Y thì size gì" → **vẫn tư vấn size bình thường** như khách chưa mua, xem mục
  "Chốt 23/11/2026" bên dưới.
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
  nha." **Chốt 23/11/2026:** khách xin bảng size mà không nói rõ sản phẩm /
  không có card → gửi luôn bảng Quần Lông, không hỏi lại. Từ 17/11/2026 ảnh nằm sẵn trong `assets/` (bang-size-hoat-hinh.jpg,
  bang-size-caro.jpg). Không kèm câu "ngắn hơn 1-2cm" trừ khi khách hỏi vì
  sao bảng ngắn hơn số đo tư vấn — xem references/cskh-faq-17-11.md mục 3.
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

## Chốt 25/11/2026 — khách hỏi NHIỀU Ý trong 1 tin thì trả lời ĐỦ TỪNG Ý; màu mẫu Hello Kitty

**Sự cố thật 24/11/2026:** khách hỏi "shop ơi mình có hello kity đen hoặc trắng sz s ko ạ" (2 ý: **màu** + **size**). Shop chỉ
trả lời size ("chỉ có size M đến XL, không có size S, mẫu Shin có S"), bỏ hẳn câu hỏi màu. Chủ shop: "khách hỏi có màu đen
hoặc trắng mà em trả lời size?".

- Trước khi gửi, đếm số ý khách hỏi trong tin (màu, size, còn hàng, giá, chất liệu...) và kiểm câu trả lời có đủ từng ý.
  Trả lời ý chính khách hỏi TRƯỚC (ở đây là màu), rồi mới tới ý phụ.
- Ý nào **không có dữ liệu trong skill** → KHÔNG trả lời lệch sang ý mình biết rồi coi như xong. Trả lời các ý đã có dữ liệu,
  còn ý thiếu thì ghi `cskh-log` để chủ shop trả lời (và bổ sung dữ liệu vào skill).
- **Màu mẫu Hello Kitty (chủ shop chốt 25/11/2026):** `Chất Lông-Hello Kitty` ("kitty thường", CL02) là **màu trắng**;
  `Chất Lông-Hello Kitty Hồng` (CL09) là màu hồng. **Không có Hello Kitty màu đen.** Màu của mọi mẫu + cách trả lời chung nằm ở mục
  "Khách hỏi MÀU" ngay bên dưới (bảng `.claude/shared/mau-sac-san-pham.json`).
- Câu đúng cho case trên (Claude soạn 25/11/2026 theo dữ liệu chủ shop chốt, anh sửa chữ nếu cần):
  "Dạ mẫu Hello Kitty bên mình có màu trắng ạ, không có màu đen. Mẫu này chỉ có size M đến XL thôi, không có size S ạ. Nếu bạn
  cần size S thì bên mình có mẫu Shin có đủ size S ạ."

## Khách hỏi MÀU — cách làm chung cho MỌI mẫu (chủ shop yêu cầu 25/11/2026)

Chủ shop: "tìm ra cách để hễ khách hỏi những màu shop không có thì có thể dùng chung". Vì vậy không viết quy tắc riêng từng
mẫu nữa; mọi câu hỏi màu ("có màu đen không", "mẫu này có trắng không", "kitty đen hoặc trắng"...) đi theo 3 bước:

**B1. Xác định MẪU khách hỏi + MÀU khách hỏi.** Mẫu lấy từ tên khách gõ hoặc card sản phẩm. Khách không nói mẫu nào (chỉ gửi
card tin đăng chung rồi hỏi "có màu đen không") → hiểu là hỏi cả tin đăng đó (mọi phân loại trong card).

**B2. Tra bảng màu** [../../shared/mau-sac-san-pham.json](../../shared/mau-sac-san-pham.json) (khoá = mã SKU, `mau` = màu của mẫu).
- `mau` có giá trị → dùng luôn.
- `mau: null` (chưa biết) → **mở tin đăng, chụp màn hình ảnh phân loại của mẫu đó** để xem màu thật, trả lời theo ảnh, rồi
  **ghi màu vừa xem vào bảng** (`"nguon": "anh_tin_dang"`, kèm `ngay`) để lượt sau khỏi xem lại — bảng tự đầy dần.
  Không xem được ảnh / không chắc màu → KHÔNG đoán: ghi `cskh-log` (category `khac`, context "hỏi màu <mẫu> chưa có trong bảng màu")
  để chủ shop trả lời.

**B3. Trả lời bằng đúng 1 trong 3 mẫu câu** (Claude soạn 25/11/2026 theo câu Hello Kitty chủ shop đã xem; anh sửa chữ nếu cần):

| Tình huống | Câu |
|---|---|
| Mẫu CÓ màu khách hỏi | Dạ mẫu {mẫu} bên mình có màu {màu} ạ. |
| Mẫu KHÔNG có màu khách hỏi, và **có mẫu khác cùng dòng quần** có màu đó | Dạ mẫu {mẫu} bên mình chỉ có màu {màu có} thôi ạ, không có màu {màu hỏi}. Nếu bạn thích màu {màu hỏi} thì bên mình có mẫu {mẫu khác} ạ. |
| Mẫu KHÔNG có màu khách hỏi, **không mẫu nào cùng dòng** có màu đó | Dạ mẫu {mẫu} bên mình chỉ có màu {màu có} thôi ạ, không có màu {màu hỏi} ạ. |

- Khách hỏi 2 màu ("đen hoặc trắng"), có 1 màu → nói rõ cả hai: "Dạ mẫu Hello Kitty bên mình có màu trắng ạ, không có màu đen."
- "Mẫu khác cùng dòng" = cùng nhóm sản phẩm (quần lông gợi ý quần lông, caro gợi ý caro), tối đa 2 mẫu, chỉ lấy mẫu mà bảng
  màu ghi rõ có màu đó (không gợi ý mẫu `mau: null`). Mẫu thiên nữ không gợi ý cho khách nam (cskh-ship-faq.md mục 9).
- Câu hỏi màu **không kèm kiểm tồn kho**; khách hỏi thêm "còn hàng không / còn size nào" thì mới tra tồn theo mục hỏi tồn kho.
- Khách hỏi màu kèm size (như case 24/11) → câu màu TRƯỚC, câu size SAU, trong cùng 1 tin.
- Chủ shop thêm mẫu mới / đổi màu → sửa thẳng bảng màu (kèm `"nguon": "chu_shop"`), không sửa ở đây.

## Chốt 25/11/2026 — nhớ bối cảnh giữa các lượt (đọc TRƯỚC khi trả lời khách đã có đơn)

Mỗi lượt 15 phút là phiên mới, không nhớ lượt trước. Trước khi gõ tin cho khách đã có đơn: tra phiếu cũ trên Sổ Vận Hành theo
tên khách, đọc lại cả đoạn chat **có chụp màn hình** (đọc chữ không thấy ảnh khách gửi), chốt loại case theo cả đoạn chat, chỉ
gửi tin còn thiếu. Đủ 4 việc + lý do (case `_dt.54` 24/11: giao nhầm bị xử lý thành đổi size, xin ảnh 3 lần) ở
[../../shared/cskh-nho-boi-canh.md](../../shared/cskh-nho-boi-canh.md).

## Chốt 23/11/2026 — rà log tin bỏ qua 22–23/11 (chủ shop trả lời từng câu)

Nguồn: 57 khách task bỏ qua trong 2 ngày (file `C:\sokho\cskh-log\`). Phần lớn là
câu ĐÃ CÓ đáp án trong skill nhưng task vẫn bỏ — chủ shop nhắc: **đã có mẫu thì
phải trả lời, không để trống.** Các điểm mới/nhắc lại:

- **Chỉ có chiều cao (kể cả rất cao 1m83 hay thấp 1m49):** KHÔNG chờ cân nặng,
  KHÔNG để chủ shop — tư vấn ngay theo bảng chiều cao bằng mẫu `missing_weight`
  (1m83 → XXL 102cm; 1m49 → S 92cm, kẹp theo dải size của mẫu). Case bị bỏ:
  `deckcanaihet`, `2za8uosiwe`.
- **Khách đã đặt hàng rồi mới hỏi lại size** ("m74 55kg size j ạ" sau khi đặt):
  **vẫn tư vấn bình thường** theo thuật toán, không coi là hậu mãi, không bỏ qua.
  Thay cho cách hiểu cũ "hỏi sau khi đặt = để chủ shop". Case bị bỏ:
  `hongson_0112`, `_dungchu482011`.
- **Khách chọn "quét đất"** sau khi đã được tư vấn size chạm gót → **lên 1 size
  so với size vừa tư vấn** (đúng B3 trong size-spec; vd đã tư vấn M chạm gót →
  báo L), gửi mẫu `has_length_pref`. Không phải chờ chủ shop chốt số đo. Case
  bị bỏ: `anhtuyet.260`.
- **Khách nói "muốn mặc vừa"** → vừa = đúng size mình đã tư vấn. Gửi mẫu
  `fit_true_to_size`: *"Dạ bạn muốn mặc vừa thì lấy size {size} như mình tư vấn
  là chuẩn ạ."* Case bị bỏ: `nganhtu.o07`.
- **Khách muốn ống rộng hơn** → lên 1 size, và **phải báo kèm là lên size thì
  quần cũng dài hơn**. Gửi mẫu `wider_leg_size_up`: *"Dạ bạn muốn ống rộng hơn
  thì lên 1 size, lấy size {size_up} ạ. Lên 1 size thì quần cũng dài hơn, dài
  {length_up}cm ạ."* Case bị bỏ: `quanh2_10`. (Ý chủ shop, câu chữ 2 mẫu này
  Claude soạn — chủ shop sửa nếu cần.)
- **Khách xin bảng size → gửi ảnh luôn** (ảnh ở Drive thư mục "Bảng size", bản
  sao trong `assets/`): khách có gửi card sản phẩm hoặc nhắc tên sản phẩm → gửi
  bảng của đúng sản phẩm đó; **không nói rõ / không có card → gửi bảng Quần
  Lông** (`assets/bang-size-hoat-hinh.jpg`). Không hỏi lại "bạn hỏi mẫu nào".
  Case bị bỏ: `_mc_ddangwj`.
- **Tin không rõ nội dung** (chỉ GIF/sticker, tin cụt, hội thoại "Quá hạn"): mở
  đọc cả đoạn chat rồi xét ngữ cảnh — là **tin mới** (trước đó chưa có gì đang
  dở) → *"Dạ, bạn cần shop hỗ trợ gì ạ?"*; là **tin kết thúc đoạn chat** → đóng
  theo mục "Đóng hội thoại đã xong" ("Dạ vâng ạ"). Không bỏ qua. Case bị bỏ:
  `bonglac36`, `p.khai05`, `quanghuy.135`.
- **Vận chuyển / huỷ đơn / KOC xin mã / đổi ngang mẫu:** xem
  [references/cskh-ship-faq.md](references/cskh-ship-faq.md) mục **1** (giục giao — từ 23/11/2026
  chỉ 1 câu "Dạ để mình note cho kho ưu tiên gửi đơn hàng này trước ạ."),
  2 (hỏi khi nào đến),
  13 (chưa nhận hàng, shipper không liên lạc), **2f** (trách "shop không gửi
  hàng"), **15** (xin huỷ đơn), **16** (KOC xin mã cho khách), **17** (đổi
  ngang sang mẫu khác khi đơn chưa đi → 1 câu khuyên đặt lại đơn khác).
- **Hỏi còn hàng / bao giờ về:** đã có ở mục "Chào chung & hỏi tồn kho" +
  cskh-faq-17-11.md mục 1 — tra tồn rồi trả lời, không để trống.

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
- **Khách gửi ảnh/video mẫu (từ affiliate, KOC, shop khác) rồi hỏi còn không**
  (chốt 2026-11-02, sau case `saocungdcxyzzz` ngày 01/11): **nhìn kỹ hoạ tiết
  trong ảnh và đối chiếu với danh mục phân loại thật**
  ([sku_names.json](../../shared/sku_names.json), hoặc trang sản phẩm/Sapo)
  trước khi trả lời. **KHÔNG tin chữ khách gõ** ("mẫu Shin"...) thay cho ảnh,
  và không đoán hoạ tiết từ caption video. Chỉ báo "còn" khi ảnh khớp rõ ràng
  1 phân loại và đã tra tồn kho đúng phân loại đó. Không khớp / không chắc →
  KHÔNG báo còn, trả "Dạ bạn chờ mình kiểm tra rồi báo ngay ạ" + gửi Telegram
  báo chủ shop. Không khớp hẳn danh mục thì nói thẳng mẫu đó shop không có.
  *Lý do:* khách gửi ảnh quần hoa rằn ri ("Mặc sao cũng xinh"), bị đọc nhầm
  thành mẫu Shin/hoạ tiết hoạt hình → shop trả "còn đủ size S–XXXL", 30 phút
  sau lại phải đính chính "màu này shop không có".
- **Trước khi báo "hết hàng":** tra dải size cột I Google Sheet "Sku" — size
  ngoài dải là KHÔNG SẢN XUẤT, trong dải mà kho=0 mới là tạm hết (chốt
  17/11/2026, xem [references/cskh-faq-17-11.md](references/cskh-faq-17-11.md) mục 1).
- **Khách hỏi ngày dự kiến hàng về** (hàng đang hết): KHÔNG tự đoán ngày.
  **Chốt 17/11/2026, thay câu cũ "chờ xíu kiểm tra rồi báo ngay":** báo khách
  theo dõi (follow) shop và theo dõi các buổi live để biết khi hàng về (câu mẫu
  ở references/cskh-faq-17-11.md mục 1), đồng thời
  gửi Telegram báo chủ shop (token + chat ID + lệnh curl:
  `../daily-warehouse-report/references/reference_telegram_bot.md`) để chủ
  shop tự vào xử lý tiếp.

## Câu hỏi lặp lại đã có đáp án (chốt 17/11/2026)

Giặt máy / xù / rụng lông / giặt chung (mỗi câu hỏi trả 1 câu riêng), gửi bảng
size (ảnh trong `assets/`), lo dài-rộng, lo đùi to, hộp quà, shop ở đâu, hết
hàng vs không sản xuất, giá lệch, cắt ống quần, thêm giỏ hàng, COD, shop giấy đóng hàng (bỏ qua) — mẫu câu chuẩn ở
[references/cskh-faq-17-11.md](references/cskh-faq-17-11.md). Mục "CHƯA train"
cuối file đó liệt kê những nhóm vẫn để chủ shop.

## Vận chuyển & CSKH khác (chốt 28/10/2026)

Rà FAQ chat TikTok 1 tháng (28/10/2026), chủ shop train thêm 6 tình huống mà
TRƯỚC ĐÂY skill để trống. Nay đã có mẫu chuẩn — xem đầy đủ bảng + mẫu câu ở
[references/cskh-ship-faq.md](references/cskh-ship-faq.md). Tóm tắt:

- **Hãng theo sàn:** TikTok dùng **J&T** (chậm hơn), Shopee dùng **SPX** (nhanh
  hơn ~1–3 ngày). Kho gửi **Hà Nội**. Báo thời gian giao theo đúng hãng của sàn;
  không chắc → báo theo J&T (dải chậm, an toàn).
- **Mốc 3h chiều:** đơn đặt trước 3h chiều gửi đi trong ngày; đơn đi tới 19:59
  vẫn tính là gửi hôm nay (nên 4h chiều vẫn tính hôm nay).
- **Giục giao / xin ship nhanh / xin đóng gấp (chốt 23/11/2026, thay câu mốc 3h
  chiều + số ngày):** đơn chưa đi → "Dạ để mình note cho kho ưu tiên gửi đơn hàng này
  trước ạ."; đơn đã đi → "Dạ đơn đang trên đường giao, để mình gửi yêu cầu giục
  giao sớm cho ạ, bạn chờ shop xíu." Tính cả tin "Tôi cần nó sớm hơn" / cần hàng
  gấp. Không báo chủ shop, không Telegram — xem mục 1 file trên.
- **Khách HỎI khi nào đến / khi nào vận chuyển (không giục):** báo mốc 3h chiều + thời gian
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
- **Hàng lỗi / giao nhầm mẫu, khách đã gửi ảnh (chốt 21/11/2026):** không xin ảnh
  lại → xin lỗi + xác nhận lỗi → "hỗ trợ đổi hàng + gửi 1 mã giảm" → tin hướng dẫn
  đổi theo sàn → gửi voucher 10k (TikTok: tab Voucher cột phải). Khách chỉ kêu hơi
  dài/rộng thì KHÔNG phải hàng lỗi — câu "sẵn sàng đổi miễn phí / cố mặc / mang đi sửa" (bỏ deal hoàn tiền cắt ngắn 23/11/2026). Xem
  [references/cskh-doi-hang-loi-21-11.md](references/cskh-doi-hang-loi-21-11.md).
- **Cập nhật 22/11/2026 (chủ shop train cả ngày, đọc 2 file references trên trước khi xử lý hậu mãi):**
  câu xin lỗi có thêm "note và báo lại anh quản lý"; câu hướng xử lý "đổi hàng **miễn phí**"; tin báo mã 10k;
  hàng lỗi chỉ đổi (trả hàng hoàn tiền chỉ khi khách tự yêu cầu, không hoàn tiền giữ hàng); điều kiện cắt mác /
  đã giặt / 15 ngày; **mã 10k CHỈ cho lỗi shop**, đổi size vì rộng/chật KHÔNG có mã, câu mới "sẵn sàng đổi miễn phí",
  không hỏi size/kiểm tồn; câu "tiền hoàn về ví"; 100% case hậu mãi lên Sổ Vận Hành (không Telegram).
- **Cập nhật 23/11/2026:** không tự thẩm định lỗi — khách gửi ảnh HOẶC video là chạy luôn; bực/doạ xử lý như thường, chỉ
  đẩy `[chờ anh]` khi đòi bồi thường ngoài đổi + mã; thiếu dây rút/tag = hàng lỗi; hết hàng cứ đổi như thường; khách giữ món
  giao nhầm → đồng ý; câu "khách ngại trả tiền đơn mới trước"; đơn đang giao → nhận trước rồi đổi. **Với hậu mãi, file skill
  thắng Sheet** (Sheet đã cập nhật khớp 23/11, nếu sau này lệch thì theo skill). Chi tiết: cskh-doi-hang-loi-21-11.md.
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
