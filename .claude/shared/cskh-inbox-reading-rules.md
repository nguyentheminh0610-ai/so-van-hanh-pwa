# Quy tắc đọc inbox CSKH — không để sót tin (chốt 21/11/2026)

**Lý do:** lượt 21/11/2026 sáng, tôi mở TikTok inbox rồi đọc chữ ngay bằng `get_page_text`. Trang còn đang tải, bộ đếm bên trái hiện "Chưa trả lời 0 / Quá hạn 0", và tôi kết luận inbox trống. Thực tế đang có 9 hội thoại "Chưa trả lời" và 3 "Quá hạn" (khách hỏi size, khách hỏi hàng về, khách báo thiếu hàng). Chủ shop phát hiện từ ảnh chụp màn hình. Chưa đếm đúng thì không được kết luận "0".

## 1. Quy tắc chung (mọi sàn)

- **Số đếm 0 đọc lúc trang vừa mở KHÔNG tin được.** Phải chờ danh sách tải xong (wait ~8 giây), rồi chụp màn hình (`screenshot`, scale 0.6) xác nhận bộ đếm và danh sách có dữ liệu, rồi mới đếm.
- Đếm không chắc (trang trắng, chữ không ra, danh sách trống mà bộ đếm chưa đổi) → coi như CÓ tin, làm tiếp đầy đủ. Không bao giờ báo "0 việc" khi chưa chụp màn hình xác nhận.
- Đừng chỉ dựa vào tab mặc định. TikTok mở ở "Chưa chỉ định"; phải xem thêm "Tất cả" để không sót.

## 2. TikTok Seller Center (inbox)

Cột trái có các bộ đếm: **Chưa trả lời**, **Quá hạn**, **Sắp hết hạn**, **Cấp bách**, **Chưa đọc**. Quy trình:
1. Mở `https://seller-vn.tiktok.com/chat/inbox/current?shop_region=VN`, chờ 8 giây, chụp màn hình.
2. Đọc các bộ đếm "Chưa trả lời" + "Quá hạn" + "Sắp hết hạn". Tổng > 0 → có việc.
3. Mở từng hội thoại đó (`find` theo tên khách rồi click), chờ 3 giây, `get_page_text`. Đọc hết hội thoại trước khi quyết.
4. Hội thoại có nhân viên ("Cuộc trò chuyện đã được chỉ định cho Customer Service…", có tin nhân viên sau tin khách) → bỏ qua, không trả lời chồng.

## 3. Shopee webchat

- Danh sách có bộ lọc **"Chưa phản hồi (N)"**. Chờ tải xong rồi đọc số N trong chữ trang. N > 0 → mở từng hội thoại có tin cuối là của khách.
- Hội thoại có dòng "Cuộc trò chuyện đã kết thúc tự động" và tin cuối của shop/hệ thống → không cần xử lý.
- Click vào danh sách có thể không đổi khung chat ngay; kiểm tra tên trong header bằng `screenshot`/`zoom` trước khi trả lời. Nếu không mở được → ghi rõ "chưa mở được" vào báo cáo, không báo "đã xử lý".

## 4. Khi không đọc được

Không đọc được số đếm, không mở được hội thoại, hoặc tên trong header không khớp → KHÔNG trả lời khách, KHÔNG báo "trống". Ghi vào báo cáo: "chưa kiểm được: <nền tảng> <tên khách>", và báo Telegram 1 dòng nếu lượt là lượt tự động.

Liên quan: [.claude/skills/size-consultation/SKILL.md](../skills/size-consultation/SKILL.md), [.claude/skills/resend-missing-item/references/resend-collect-verify.md](../skills/resend-missing-item/references/resend-collect-verify.md).
