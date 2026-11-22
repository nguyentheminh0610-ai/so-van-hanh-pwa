# Hàng lỗi / giao nhầm mẫu → hỗ trợ ĐỔI + tặng mã giảm (chốt 21/11/2026)

Chủ shop train 21/11/2026, lấy hội thoại thật **wdat1504 (TikTok, 21/11/2026 12:33)**
làm mẫu chuẩn. Áp dụng cho **sản phẩm bị lỗi** (rách, bẩn, ố, in hỏng, tuột chỉ...)
và **giao nhầm mẫu/màu/size**. **KHÔNG áp dụng cho giao THIẾU** — giao thiếu vẫn đi
theo skill `resend-missing-item` (gửi bù).

**Thay cho quy tắc 17/11/2026** ở [cskh-faq-17-11.md](cskh-faq-17-11.md) mục 13
("CS chỉ nhắn tin đầu rồi báo Telegram, không tự đề xuất hướng xử lý"): từ 21/11 với
case lỗi/nhầm **rõ ràng** (khách đã gửi ảnh, nhìn ảnh thấy lỗi) thì CS **tự chạy đủ
5 bước dưới đây**, vì hướng xử lý đã cố định: **đổi miễn phí + tặng 1 mã giảm**. Lý do:
đây là lỗi của shop, cách xử lý không cần cân nhắc từng ca, để khách chờ anh duyệt
chỉ làm chậm.

Vẫn **để chủ shop quyết** (nhắn tin đầu + đẩy lên Sổ Vận Hành `[chờ anh]`, xem mục "ĐẨY LÊN SỔ VẬN HÀNH" bên dưới —
sửa 22/11/2026, thay cho "Telegram như quy tắc 17/11") khi:
- khách **đòi hoàn tiền kèm trả hàng** (không muốn đổi) — từ 22/11/2026 CS tự hướng dẫn trả hàng hoàn tiền, xem mục "HÀNG LỖI CHỈ HỖ TRỢ ĐỔI" bên dưới;
- ảnh không rõ lỗi, hoặc khách chưa gửi ảnh và mô tả mơ hồ;
- lỗi "nặng" kèm bức xúc, doạ đánh giá xấu, đòi bồi thường thêm.

## HÀNG LỖI CHỈ HỖ TRỢ ĐỔI — KHÔNG hoàn tiền giữ hàng (chủ shop chốt 22/11/2026)

Với **sản phẩm bị lỗi** (rách, bẩn, ố, in hỏng, tuột chỉ...): shop **chỉ hỗ trợ đổi lại sản phẩm**, **không hỗ trợ
hoàn tiền mà khách vẫn giữ hàng** (kể cả hoàn một phần 10/15/30%). Thay cho bảng % trong
[cskh-faq-17-11.md](cskh-faq-17-11.md) mục 13 — bảng đó không còn dùng cho CS.
- Hướng dẫn **ĐỔI** **giống hệt giao nhầm** (5 bước + tin báo mã 10k ở dưới). Chỉ khác **lý do xin lỗi ở bước 2**:
  giao nhầm = "lỗi kho bên mình giao bị nhầm"; hàng lỗi = "**lỗi chưa kiểm tra kĩ trước khi giao hàng**".
- Khách đòi hoàn tiền giữ hàng → từ chối lịch sự, đưa lại hướng đổi. Câu gợi ý (Claude soạn 22/11/2026, chủ shop
  chưa duyệt từng chữ): "Dạ với sản phẩm bị lỗi thì shop hỗ trợ đổi lại sản phẩm mới cho bạn ạ, bên mình chưa hỗ trợ hoàn tiền mà giữ lại hàng được, mong bạn thông cảm giúp shop nhé ạ."
- **CHỈ KHI khách tự yêu cầu trả hàng hoàn tiền** (chủ shop nhấn mạnh 22/11/2026) mới hướng dẫn trả hàng hoàn tiền; còn lại
  LUÔN hướng dẫn **đổi hàng mới** (đừng chủ động mời trả hàng hoàn tiền). Khách không muốn đổi mà muốn **trả hàng hoàn tiền** (chủ shop chốt 22/11/2026): **HỖ TRỢ**. Làm giống luồng đổi
  (bước 1–3: không xin ảnh nếu đã có, xin lỗi + xác nhận lỗi + câu "note và báo lại anh quản lý") nhưng
  **khách KHÔNG đặt đơn mới, chỉ bấm trả hàng**: hướng dẫn trả hàng hoàn tiền theo mẫu Sheet "Mau tin nhan"
  (đọc nguyên văn, xem [mau-tin-nhan-tra-hang.md](../../../shared/mau-tin-nhan-tra-hang.md)), lý do chọn "Đổi ý"
  (Shopee: "Đổi ý (Sản phẩm còn nguyên tem, nhãn mác, bao bì)"), shipper qua lấy, tiền về ví sàn. Không đặt lại đơn nên
  **không gửi mã giảm 10k / không có tin báo mã** (suy từ việc mã chỉ để khuyến khích đặt lại — chủ shop chưa nói riêng, sửa nếu khác).
  Vẫn ghi `cskh-log`, `cskh_chat_errors` và đẩy lên Sổ Vận Hành như các case lỗi shop (mục "ĐẨY LÊN SỔ VẬN HÀNH").
- **Phân biệt:** "không hoàn tiền không hoàn hàng" = khách muốn GIỮ hàng lỗi mà đòi shop hoàn tiền → từ chối, đưa lại 2 lựa chọn
  (đổi hàng mới, hoặc trả hàng hoàn tiền). Khách chịu trả hàng thì hoàn tiền bình thường.
- Bước deal "giữ hàng hoàn 1 phần" cho lỗi rất nhẹ/nhẹ: chủ shop cân nhắc rồi **bỏ** (22/11/2026) — mọi hàng lỗi hỗ trợ đổi luôn.

## ĐIỀU KIỆN ĐỔI / TRẢ — cắt mác, đã giặt, 15 ngày (chủ shop chốt 22/11/2026)

Áp dụng cho cả hàng lỗi, giao nhầm (luồng 5 bước) **và đổi size vì rộng/chật**, khớp Mục 8.3 tài liệu CSKH.
- **KHÔNG tự soi ảnh để đoán hàng đã dùng hay chưa.** Chỉ xét khi **khách tự nhắn** là đã cắt mác / đã giặt / đã mặc.
- **Khách nói đã cắt mác** → không sao, vẫn hỗ trợ bình thường. Câu (Claude soạn theo ý chủ shop, chưa duyệt từng chữ):
  "Dạ không sao đâu ạ, bạn cắt mác rồi shop vẫn hỗ trợ cho bạn nhé ạ." rồi chạy tiếp các bước.
- **Khách nói đã giặt hoặc đã sử dụng** → từ chối khéo (câu chủ shop, đã sửa chính tả):
  "Dạ bên mình không hỗ trợ đổi lại với sản phẩm đã qua giặt hoặc sử dụng ạ, mong bạn thông cảm giúp shop nhé ạ."
- **Quá 15 ngày kể từ khi khách nhận hàng** → không hỗ trợ nữa. Ngày nhận = ngày "Đã giao" trong tab Đơn hàng của khách;
  không thấy ngày thì coi như còn hạn (đừng chặn oan). Câu (Claude soạn, chưa duyệt từng chữ):
  "Dạ đơn của bạn đã quá 15 ngày kể từ khi nhận hàng nên shop không hỗ trợ đổi trả được nữa ạ, mong bạn thông cảm giúp shop nhé ạ."
- Từ chối (đã giặt / quá 15 ngày) vẫn ghi lên Sổ Vận Hành với dòng `[xong] Đã từ chối — <lý do>` để chủ shop thấy.

## 5 bước (đúng thứ tự, mỗi bước 1 tin riêng)

| # | Việc | Câu / thao tác |
|---|---|---|
| 1 | **Không xin ảnh nữa** nếu khách đã gửi ảnh/video lỗi | Bỏ hẳn tin "Bạn gửi giúp shop ảnh...". Chỉ xin ảnh khi khách CHƯA gửi (dùng tin ở faq-17-11 mục 13.2). Khách gửi ảnh **trước** rồi mới gõ chữ là chuyện thường — nhớ cuộn lên xem. |
| 2 | **Xin lỗi + xác nhận lỗi** | Hàng lỗi: "Dạ, sau khi kiểm tra thì shop xác nhận đây là lỗi chưa kiểm tra kĩ trước khi giao hàng. **Về vấn đề này mình chắc chắn sẽ note và báo lại anh quản lý để cải thiện ngay**, mình xin phép đề xuất hướng xử lý như sau ạ." Giao nhầm: "...shop xác nhận đây là lỗi kho bên mình giao bị nhầm. **Về vấn đề này mình chắc chắn sẽ note và báo lại anh quản lý để cải thiện ngay**, mình xin phép đề xuất hướng xử lý như sau ạ." (Sheet "Mau tin nhan" dòng 8–10, 13–14; câu in đậm chủ shop thêm 22/11/2026, đặt TRƯỚC đề xuất xử lý, áp dụng toàn bộ case lỗi shop.) Có thể mở đầu ngắn kiểu người thật ("Uii dạ") như anh làm. |
| 3 | **Hướng xử lý tổng quan** | "Mình sẽ hỗ trợ đổi hàng **miễn phí** và gửi 1 mã giảm giá khi đặt lại ạ." (câu chủ shop dùng 21/11, thêm chữ "miễn phí" ngày 22/11/2026; chưa sửa trong Sheet "Mau tin nhan" — nhờ chủ shop cập nhật nếu muốn Sheet khớp). |
| 4 | **Hướng dẫn đổi hàng** theo sàn | Nguyên văn Sheet "Mau tin nhan" mục "Đổi hàng": TikTok lý do **"Đổi ý"**; Shopee lý do **"Đổi ý (Sản phẩm còn nguyên tem, nhãn mác, bao bì)"** — xem [mau-tin-nhan-tra-hang.md](../../../shared/mau-tin-nhan-tra-hang.md). Khách đặt đơn mới → bấm trả đơn cũ → shipper qua lấy → tiền về ví sàn. |
| 5 | **Gửi mã giảm 10.000đ** | Theo tab "Chinh sach xu ly loi" cột "Mã giảm đặt lại đơn" = **10k** cho mọi mức lỗi. Cách gửi xem dưới. **Phải xác minh đúng thẻ là Giảm 10.000₫ (đọc chữ trên thẻ, không đoán theo vị trí) trước khi bấm Gửi, và đọc lại thẻ hiện trong chat sau khi gửi.** Sai mức (không phải 10k) → không gửi, đẩy lên Sổ Vận Hành `[chờ anh]`. |
| 6 | **Tin báo mã giảm** (chủ shop thêm 22/11/2026), gửi ngay sau thẻ voucher | "Dạ mình gửi bạn mã giảm giá 10k khi đặt lại đơn hàng, 1 lần nữa mình xin lỗi bạn vì trải nghiệm chưa được tốt ạ." |

Sau 5 bước: khách hỏi thêm thì trả lời bình thường (vd wdat1504 hỏi "tiền về ví
TikTok Pay à, em không có tài khoản" → "Dạ b yên tâm, lúc thanh toán k có tiktokpay
vẫn thanh toán các đơn hàng khác trên tiktok đc ạ"). Khách cảm ơn → đóng bằng sticker
như thường lệ.

### Cách gửi voucher trong chat TikTok (xác minh thật 21/11/2026)

Trong khung chat của khách, **cột phải** có 3 tab: "Đơn hàng", "Sản phẩm", **"Voucher"**.
Bấm tab Voucher → danh sách voucher còn hiệu lực, mỗi thẻ có nút **"Gửi"**. Chọn thẻ
**"Voucher tặng riêng" — Giảm 10.000₫ — Không có mức chi tiêu tối thiểu — 5 ngày kể từ
khi nhận — Tất cả sản phẩm** (tạo 30/09/2026) rồi bấm Gửi. Thẻ voucher sẽ hiện trong
chat như tin nhắn (ở wdat1504 nó nằm ngay sau tin hướng dẫn đổi hàng).

Đừng gửi nhầm các thẻ khác đang có cùng danh sách: "Giảm 50%", "Giảm 5% (tối đa
400.000₫)", "Giảm 15.000₫ cho đơn trên 230.000₫" (voucher thường). Nếu thẻ 10k hết
hiệu lực/không còn → KHÔNG tự tạo voucher mới, đẩy lên Sổ Vận Hành `[chờ anh]` để chủ shop tạo lại.

**Shopee (chủ shop cho phép CS tự gửi voucher từ 22/11/2026, với điều kiện xác minh đúng mã 10k):**
nút gửi voucher trong webchat Shopee chưa được xác minh thật. CS được tự gửi, nhưng chỉ khi thấy
đúng 1 mã **giảm 10.000đ** trong danh sách và đọc rõ chữ trên mã; không thấy nút / không thấy mã 10k /
không chắc → KHÔNG thử bừa, gửi bước 1–4 + 6 bằng chữ rồi đẩy lên Sổ Vận Hành `[chờ anh] Cần gửi mã giảm 10k
cho khách (Shopee)`. Lần đầu gửi thành công trên Shopee thì ghi lại cách bấm vào đây.

## Vẫn làm sau khi nhắn xong (giữ nguyên từ 17/11)

- Ghi `cskh-log` (category khieu_nai, context ghi rõ đã chạy đủ 5 bước, đã gửi voucher chưa).
- Ghi đề xuất lỗi vào `cskh_chat_errors` (`shop_error_kind` = `san_pham_loi` / `giao_nham`,
  `has_photo=true`) để chủ shop bấm ghi Sổ Kho — xem faq-17-11 mục 13.9. Không tự ghi
  `warehouse_error_log`.
- ~~Telegram báo 1 dòng~~ — **bỏ 22/11/2026**: thay bằng mục "ĐẨY LÊN SỔ VẬN HÀNH" dưới đây.

## ĐẨY LÊN SỔ VẬN HÀNH — 100% case hậu mãi (chủ shop nhắc lại 22/11/2026)

Quy tắc gốc 21/11/2026 ở [tien-do-xu-ly.md](../../../shared/tien-do-xu-ly.md): mọi case hậu mãi phải hiện trên tab
"Hậu mãi" của Sổ Vận Hành để chủ shop theo dõi, **không dùng Telegram**. Định nghĩa "case hậu mãi" + bảng bước của
case giao nhầm / hàng lỗi / đổi size ở file đó. Mọi chỗ trong file này trước đây ghi "báo Telegram" đều đổi thành đẩy lên sổ.

**Cách ghi (chốt 22/11/2026 tối, thay cho "giới hạn hiện tại" ghi sáng 22/11 — web đã nâng cấp):** mỗi case hậu mãi từ
chat (giao nhầm, hàng lỗi, đổi size, trả hàng hoàn tiền, đòi hoàn tiền giữ hàng) = **1 dòng `cskh_chat_errors`**, upsert theo
`dedup_key`, kèm 3 cột mới: `case_type`, `progress_note` (nhật ký `▸`), `needs_action`. Chi tiết từng cột, giá trị hợp lệ, và
thế nào là "xong" ở [hau-mai-so-van-hanh.md](../../../shared/hau-mai-so-van-hanh.md) mục "Hợp đồng dữ liệu cho dòng chat".
Đổi size / trả hàng không phải lỗi shop thì `errlog_status='none'`, `shop_error_kind=null`.

**Nếu Supabase trả lỗi `PGRST204` (cột chưa tồn tại)** = chủ shop chưa chạy phần SQL 22/11 trong `scripts/cskh-tables.sql`:
ghi lại dòng đó KHÔNG kèm 3 cột mới (như cũ, để không mất đề xuất lỗi), và việc `[chờ anh]` TẠM báo Telegram 1 dòng.
Không thử lại nhiều lần, không tự ý bỏ ghi.

**KHÔNG bao giờ ghi cột `acked_at`** (chủ shop bấm Xong trên web). Dòng đã có `acked_at` = chủ shop đã đóng: không nhắn thêm,
không ghi thêm bước — TRỪ KHI khách gửi tin mới, lúc đó xử lý bình thường và nối 1 dòng `▸` mới (web tự mở lại thẻ).

## Khách chỉ kêu "hơi dài / hơi rộng" (không phải lỗi sản phẩm)

Đây là **lỗi khách quan**, không phải hàng lỗi — KHÔNG chạy luồng 5 bước ở trên. Phần
"deal" này **đã có sẵn** trong tài liệu, dùng lại:
- Rộng/chật → **câu mới chốt 22/11/2026** (sẵn sàng đổi miễn phí, gợi ý cố mặc hoặc mang đi sửa nếu rộng) rồi gửi
  NGAY hướng dẫn đổi, không hỏi size muốn đổi / không kiểm tồn — nguyên văn + thứ tự ở
  [cskh-ship-faq.md](cskh-ship-faq.md) mục "Đổi size / đổi trả hàng sau khi mua" (câu cũ Sheet dòng 11 không dùng nữa).
- Dài quá → gợi ý mang ra hàng cắt ngắn, yên tâm không mất form (Sheet "Deal khách —
  Dài quá" dòng 31; câu ngắn hơn ở [cskh-faq-17-11.md](cskh-faq-17-11.md) mục 10).
  Câu trong Sheet có đoạn "hoàn lại [x]đ qua ngân hàng" — **số tiền là của chủ shop**,
  CS không tự điền; nếu khách không chịu cắt thì hướng sang đổi hàng (bước 4) **không
  kèm** voucher lỗi shop.
- Khách vẫn muốn đổi size → theo luồng đổi size ở cskh-ship-faq.md (câu sẵn sàng đổi → hướng dẫn đổi → hỏi lý do;
  KHÔNG hỏi size mới, KHÔNG kiểm tồn — chốt 22/11/2026). **KHÔNG gửi mã 10k** — mã chỉ cho lỗi shop (chốt lại 22/11/2026 tối,
  thay cho dòng "gửi mã 10k" ghi trưa cùng ngày).

## Ví dụ chuẩn: wdat1504 (TikTok, 21/11/2026)

Đơn #587276163361899769 (Chất Lông-Shin XL, 169k, giao 12:53). 12:22 khách gửi **2 ảnh**
rồi nhắn "Shop ơi em vừa mua hàng thì vừa xem thử thì nó bị rách 2 lỗ này / Shop cho em
đổi hàng với ạ". Shop (12:33) trả lời đúng 5 bước:
1. không xin ảnh (đã có 2 ảnh);
2. "Uii dạ" + "Dạ, sau khi kiểm tra thì shop xác nhận đây là lỗi chưa kiểm tra kĩ trước
   khi giao hàng, mình xin phép đề xuất hướng xử lý như sau ạ.";
3. "Mình sẽ hỗ trợ đổi hàng và gửi 1 mã giảm giá khi đặt lại ạ";
4. tin hướng dẫn đổi hàng TikTok (lý do "Đổi ý");
5. thẻ **Voucher tặng riêng — Giảm 10.000₫**.

Kết quả: 12:56 khách đặt đơn mới #587303286707815673 (159k sau mã), đơn cũ chuyển
"Đang chờ khách hàng trả hàng". Khách: "Dạ em cảm ơn shop đã hỗ trợ em ạ".

## Số liệu cần chủ shop chốt lại (ghi nhận 21/11/2026, chưa sửa)

[cskh-ship-faq.md](cskh-ship-faq.md) mục "Điều kiện (Mục 8)" đang ghi "mã giảm 10k nếu
lỗi khách, **15k** nếu lỗi shop", trong khi Sheet "Chinh sach xu ly loi" và ví dụ
wdat1504 đều dùng **10k** cho lỗi shop. Luồng này theo **10k** (Sheet + thực tế); dòng
15k ở Mục 8 chờ chủ shop xác nhận rồi mới sửa.
→ **ĐÃ CHỐT 22/11/2026:** mã giảm **10k, CHỈ cho lỗi shop** (giao nhầm, hàng lỗi; lỗi shop lần 2 vẫn gửi). Lỗi khách
(đổi size vì rộng/chật) **không** có mã. Dòng "10k lỗi khách / 15k lỗi shop" đã bỏ.

**Khách hỏi tiền hoàn về đâu** (mọi case trả hàng trên sàn, chốt 22/11/2026): "Dạ tiền đó sẽ được hoàn về ví, nếu có liên kết
với ngân hàng thì bạn có thể rút về hoặc dùng để thanh toán các đơn hàng tiếp theo trên sàn ạ." — xem cskh-ship-faq.md.
