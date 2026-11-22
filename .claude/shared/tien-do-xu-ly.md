# Tiến độ xử lý hậu mãi — mọi việc task tự làm phải để lại dấu vết trên Sổ Vận Hành (chốt 21/11/2026)

**Mục tiêu của chủ shop:** vào tab "Hậu mãi" là thấy mỗi case đang ở BƯỚC nào, ai đang cầm (task / khách / chủ shop),
kẹt ở đâu thì vào xử lý. Không phải tự đi kiểm tay, không bị đứt quãng (gửi bù từng đứng im 14–57 giờ mà không ai biết).
Chủ shop KHÔNG muốn Telegram cho việc này — chỉ hiển thị trên sổ.

## Cách ghi (KHÔNG đổi schema DB)

Mỗi lần task LÀM hoặc ĐỔI TRẠNG THÁI một việc → **thêm 1 dòng cuối** vào cột text sẵn có của dòng case:
- phiếu gửi bù: `resend_cases.owner_note`
- đánh giá: `cskh_reviews.message_note`
- (loại case mới sau này: dùng cột ghi chú tương đương, cùng định dạng)

Định dạng 1 dòng (giữ nguyên dấu `▸` và `·`, giờ Việt Nam):

```
▸ 21/11 10:34 · [chờ khách] Đã gửi tin xác minh — chờ khách xác nhận
```

Nhãn trạng thái (đúng 1 trong 4): `[đang làm]` task đang xử lý · `[chờ khách]` đã nhắn, chờ khách trả lời ·
`[chờ anh]` cần chủ shop duyệt/quyết · `[xong]`.
**Dòng cuối = bước hiện tại.** Nội dung nói cụ thể: đang xin nốt cái gì, đã nhắn tin số mấy, vì sao kẹt.
Thêm dòng bằng cách đọc giá trị hiện có, nối `\n▸ ...`, PATCH lại (giữ các dòng cũ và mọi ghi chú khác của chủ shop).
Mỗi lần ghi nhớ PATCH kèm điều kiện trạng thái như thường lệ (tránh 2 lượt chạy chồng ghi đè nhau).

Web (cskh.js `cskhProgressHtml`) tự: hiện bước cuối + lịch sử, và hiện **⚠ đứng ở bước này N giờ** khi
`[chờ khách]` ≥ 4 giờ hoặc `[đang làm]` ≥ 1 giờ. Case có dòng cuối `[xong]` không bị cảnh báo.

## Thế nào là "case hậu mãi" (chủ shop nhắc lại 22/11/2026: 100% phải lên sổ)

Case hậu mãi = khách **đã có đơn** và nhắn về **vấn đề với đơn/sản phẩm sau khi đặt**, gồm:
giao thiếu · giao nhầm (sai mẫu/màu/size) · hàng lỗi (rách, bẩn, ố, in hỏng, tuột chỉ...) · đổi size/đổi mẫu vì rộng/chật ·
trả hàng hoàn tiền · đòi hoàn tiền giữ hàng · đánh giá xấu 1–3★ · yêu cầu trả hàng trên sàn.
KHÔNG tính: tư vấn size/chất liệu trước khi mua, hỏi tồn kho, hỏi thời gian giao/giục giao, chào hỏi chung.
Không chắc có phải hậu mãi không → coi là hậu mãi, ghi lên sổ (thừa còn hơn sót).
Mọi case hậu mãi, kể cả case task tự xử lý xong hoặc đã từ chối, đều phải có dòng trên sổ + dòng `▸` cuối cùng.

## Các bước theo loại case

**Giao nhầm / hàng lỗi / đổi size từ CHAT** (chốt 22/11/2026; luồng nhắn khách ở
`size-consultation/references/cskh-doi-hang-loi-21-11.md` và `cskh-ship-faq.md`):
1. `[đang làm]` Phát hiện khách báo <giao nhầm/hàng lỗi/đổi size> — đang kiểm ảnh + đơn
2. `[chờ khách]` Đã xin lỗi + xin ảnh lúc HH:MM (chỉ khi khách chưa gửi ảnh)
3. `[chờ anh]` Không xác nhận được lỗi — <vì sao: ảnh mờ, không thấy mác, đơn nhiều phân loại giống nhau...>
4. `[chờ khách]` Đã xác nhận lỗi + hướng dẫn đổi (hoặc trả hàng nếu khách tự yêu cầu) + gửi mã 10k lúc HH:MM
5. `[chờ anh]` Chưa gửi được mã 10k (Shopee / thẻ hết hạn) — anh gửi giúp
6. `[xong]` Đã hướng dẫn xong, đủ tin + mã / `[xong]` Đã từ chối — <đã giặt / quá 15 ngày>

**Giới hạn web (ghi nhận 22/11/2026):** bảng `cskh_chat_errors` CHƯA có cột ghi chú tiến độ, cột "cần anh xử lý"
(`needs_action`) hay `acked_at`, nên web hiện dòng chat CHỈ ở nhóm "Ghi lỗi Sổ Kho" (khi `suggest` + mã vận đơn).
Muốn bảng bước trên hiện được cần: thêm 3 cột (`progress_note`, `needs_action`, `acked_at`) bằng SQL trên Supabase +
sửa `cskh.js` đọc chúng. Chưa làm xong thì các bước `[chờ anh]` của case chat TẠM báo Telegram 1 dòng (ngoại lệ tạm).

**Giao thiếu (mọi nguồn: chat, đánh giá, trả hàng)** — phát hiện là mở phiếu `resend_cases` NGAY + dòng đầu tiên:
1. `[đang làm]` Phát hiện khách báo thiếu (nguồn: chat/đánh giá/trả hàng) — đang xin ảnh + SĐT + địa chỉ
2. `[chờ khách]` Đã hỏi <thứ thiếu> lúc HH:MM — đang chờ khách (cập nhật mỗi lần khách gửi thêm 1 phần: "đã có SĐT, đang xin nốt địa chỉ")
3. `[chờ khách]` Đã nhắc khách lần 2 (sau 4 giờ) — vẫn thiếu <...>
4. `[chờ anh]` Đã gửi khách xác minh — chờ anh duyệt lần 1 (khách trả lời "đúng" trước thì tự chạy; chốt 21/11/2026, xem 1g resend-collect-verify.md)
5. `[đang làm]` Khách đã xác nhận (hoặc anh đã duyệt) — đang tạo đơn SPX
6. `[đang làm]` Đã duyệt lần 1 — chờ phiên 15h tạo đơn SPX
7. `[chờ anh]` Đã tạo đơn <mã vận đơn> — chờ anh duyệt lần 2
8. `[đang làm]` Đã duyệt lần 2 — đang ghi Sổ Kho + nhắn khách mã vận đơn
9. `[xong]` Đã nhắn khách mã vận đơn <mã>

**Đánh giá xấu (1–3★)** (ghi vào `cskh_reviews.message_note`):
1. `[chờ khách]` Đã nhắn tin 1 hỏi lý do lúc HH:MM
2. `[chờ khách]` 4 giờ khách chưa trả lời — đã nhắn tin 2 lúc HH:MM (tin 2 gửi bởi lượt CSKH inbox, đúng 1 lần)
3. `[chờ anh]` Khách vẫn chưa phản hồi sau tin 2 — anh vào xử lý  /  `[chờ anh]` Khách đã phản hồi — anh mở chat xem
Tin 2 (chủ shop chưa duyệt câu chữ, dùng tạm): "Dạ shop nhắn lại để hỗ trợ bạn về đơn hàng ạ, bạn phản hồi giúp shop để shop xử lý cho bạn nhé ạ".

**Trả hàng thường:** nhắn 1 lần, KHÔNG theo dõi tiến độ.

## Case loại mới (sắp mở thêm)

Trước khi cho task tự xử lý loại mới: (1) liệt kê các bước như bảng trên, (2) chọn cột text để ghi `▸`, (3) mỗi bước phải có
trạng thái `[chờ ...]` để web đo thời gian kẹt, (4) thêm bảng bước vào file này. Không thêm Telegram.

## Điểm có thể gây đứt quãng (đã gặp) → đã/đang chặn

| Rủi ro | Đã gặp | Cách chặn |
|---|---|---|
| Chrome mất đăng nhập sàn (TikTok 18/11, 21/11; Shopee 29/10) | quét chat dừng, không ai biết | dòng `▸` cuối cùng cũ dần → web hiện ⚠; cần thêm "nhịp tim" quét (xem dưới) |
| Quét không chạy (PC tắt điện 20/11, Claude lỗi) | phiếu #8 đứng 57 giờ | watchdog 30 phút vẫn báo Telegram riêng việc "quét đánh giá/trả hàng > 14 giờ" |
| Hiểu sai tin khách (ảnh chụp màn hình SĐT) | #9 ghi nhầm "từ chối gửi SĐT" | luôn mở ảnh phóng to đọc; không đọc ra thì ghi rõ "không đọc được" |
| Quy tắc trong tài liệu mâu thuẫn | 2 mục "1c" khác nhau | mục 1e của resend-collect-verify.md là bản chốt |
| Thiếu file dữ liệu chốt khi tạo đơn 15h | phiên 15h đặt phiếu `stalled` | chỉ chuyển `wait_approve_1` khi đã ghi file + `data_hash` |
| Chat Shopee hiện dữ liệu cũ | gửi trùng 3 lần 17/11 | đọc chat xong phải chụp đáy khung chat trước khi gõ |

## Có vấn đề / dừng giữa chừng → ĐẨY LÊN SỔ NGAY (chốt 21/11/2026, phiếu #9)

Chủ shop: "đơn gửi bù chưa hoàn thành thì luôn hiện, có vấn đề gì đẩy lên để anh xem". Mọi lần task DỪNG, lỗi, hoặc cần chủ shop quyết
(thiếu giá trị bưu gửi, phường không có trên SPX, SPX báo lỗi, PDF lỗi, đọc ảnh không ra...) phải làm ĐỦ 2 việc trong cùng lượt:
1. Ghi `last_error` = 1 câu nói rõ vướng gì (web hiện đỏ trên thẻ).
2. Thêm 1 dòng `▸ DD/MM HH:MM · [chờ anh] <vướng gì + cần anh quyết gì>` vào CUỐI `owner_note` (dòng mới luôn nối ở cuối, không chèn lên đầu).
Web tự đưa phiếu vào nhóm "Duyệt gửi bù" (cần anh) khi: có `last_error`, bước cuối `[chờ anh]`, `[đang làm]` quá 1 giờ, hoặc `[chờ khách]` quá 4 giờ.
Phiếu chưa `done` thì luôn nằm trên sổ; không có chỗ nào để phiếu "biến mất".
