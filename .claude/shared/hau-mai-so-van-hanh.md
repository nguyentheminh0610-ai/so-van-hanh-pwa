# Tab "Hậu mãi" trên Sổ Vận Hành — hợp đồng dữ liệu cho các task CSKH

Chốt 19/11/2026 (chủ shop yêu cầu gộp tab "Đánh giá & Trả hàng" + "Gửi bù" cho gọn).
Code web: `cskh.js` (tab Hậu mãi + tab Thống kê), `resend.js` (thẻ + nút gửi bù).
Mục này chỉ nói **web đọc gì** để các skill CSKH ghi đúng. Cách CSKH nhắn khách, đánh
giá mức lỗi Nhẹ/Vừa/Nặng, đề xuất % hoàn... là việc riêng của CSKH, web không đụng.

## Nguyên tắc hiển thị

- **1 đơn = 1 thẻ** (gộp theo `platform + order_code`): đơn nhiều sản phẩm có 4 đánh
  giá + 1 trả hàng vẫn chỉ ra 1 thẻ, ghi "4 đánh giá + 1 trả hàng".
- **1 thẻ = 1 việc cho chủ shop**, quyết bằng 1 nút, bấm xong thẻ rời danh sách:

| Nhóm | Điều kiện web dùng | Nút |
|---|---|---|
| Ghi lỗi Sổ Kho | `errlog_status='suggest'` + `shop_error_kind` ∈ {giao_nham, san_pham_loi} + `errlog_code` (mã vận đơn) | Ghi Sổ Kho / Không phải lỗi shop |
| Duyệt gửi bù | `resend_cases.status` ∈ wait_approve_1/2, verifying, stalled | Duyệt / Sửa / Dừng... (như cũ) |
| Anh xử lý với khách | `needs_action=true` và `acked_at` rỗng, `action_type` khác 2 loại "chỉ xem" | Đã xử lý |
| Chỉ cần xem | `needs_action=true`, `action_type` ∈ {danh_gia_van_de, tra_hang_noi_dung_sp_kho} | Đã xem |

- Hết việc khi 4 nhóm về 0 ("Không còn việc tồn"). Làm nhầm → mục "Đã xong 7 ngày" → Mở lại.
- **Giao thiếu từ mọi nguồn chỉ hiện 1 lần**, ở nhóm Duyệt gửi bù: dòng cskh có
  `shop_error_kind='giao_thieu'` hoặc `errlog_status='owned_resend'` mà đã có phiếu
  `resend_cases` cùng `platform + orig_order_code` thì web ẩn dòng đó.

## Đã giải quyết 19/11 (chủ shop chốt luồng)

Cả hai mục 1 và 2 bên dưới đã được ghi vào skill: review-return-check mục B2 + 4.2 (giao thiếu
qua trả hàng/đánh giá → mở phiếu gửi bù `collecting`; nhầm/lỗi → bắt buộc `errlog_code`,
`needs_action` bật khi khách gửi bằng chứng hoặc sau 24h). Dòng cũ vẫn thiếu mã sẽ được bổ sung
ở lượt chạy kế tiếp.

## Điều CSKH cần làm để web đúng (việc còn thiếu thấy khi rà dữ liệu 19/11)

1. **Khách báo giao thiếu trong thẻ trả hàng / đánh giá** (vd TikTok `l04032006llcd`,
   đơn `586840445960685090`): hiện chưa có phiếu `resend_cases`, web đang hiện thẻ cảnh
   báo "giao thiếu nhưng chưa có phiếu gửi bù". Task gửi bù nên mở phiếu cho các đơn này
   (hoặc chủ shop tự xử lý rồi bấm Đã xem).
2. **Đề xuất lỗi shop phải kèm `errlog_code` (mã vận đơn) và `shop_error_kind`**, nếu
   thiếu web không dựng được nút Ghi Sổ Kho mà chỉ báo "anh kiểm tay". Hiện nhiều dòng
   trả hàng `suggest` đang thiếu mã vận đơn (lấy từ `platform_returns_feed.outbound_tracking`).
3. Chat: tiếp tục ghi `cskh_chat_errors` như cũ. Giao thiếu từ chat đã có phiếu gửi bù
   thì web tự ẩn dòng chat (không cần xoá).
4. Đừng đổi/ghi đè `acked_at` và `errlog_status` ('written','dismissed','dup') — đó là
   quyết định của chủ shop trên web.
