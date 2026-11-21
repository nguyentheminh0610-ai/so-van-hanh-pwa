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

## Các bước theo loại case

**Giao thiếu (mọi nguồn: chat, đánh giá, trả hàng)** — phát hiện là mở phiếu `resend_cases` NGAY + dòng đầu tiên:
1. `[đang làm]` Phát hiện khách báo thiếu (nguồn: chat/đánh giá/trả hàng) — đang xin ảnh + SĐT + địa chỉ
2. `[chờ khách]` Đã hỏi <thứ thiếu> lúc HH:MM — đang chờ khách (cập nhật mỗi lần khách gửi thêm 1 phần: "đã có SĐT, đang xin nốt địa chỉ")
3. `[chờ khách]` Đã nhắc khách lần 2 (sau 4 giờ) — vẫn thiếu <...>
4. `[chờ khách]` Đã gửi tin xác minh — chờ khách xác nhận
5. `[chờ anh]` Khách đã xác nhận — chờ anh duyệt lần 1
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
