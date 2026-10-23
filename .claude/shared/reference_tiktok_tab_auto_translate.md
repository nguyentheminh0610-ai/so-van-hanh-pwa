# Chrome TikTok bị dịch trang tự động — chữ hiển thị méo, đừng tưởng tin gửi sai

**Chốt 2026-10-22, cập nhật 2026-10-23.**

Trên Chrome TikTok (deviceId `40800ac7-074b-4077-be62-257ed7e08ef7`, xem
[reference_chrome_browsers](reference_chrome_browsers.md)), trang
`seller-vn.tiktok.com/chat/inbox` đang bật **dịch trang tự động của Chrome**.
Mọi thứ đọc qua `get_page_text` / `find` / screenshot đều là bản ĐÃ DỊCH,
không phải nội dung thật.

## Dấu hiệu nhận ra

- Tên shop "SOMETIME" hiện thành "ĐÔI KHI NÀO ĐÓ"
- "chạm gót" trong tin đã gửi hiện thành "chạm Gothic" hoặc "Gô Gô"
- "quần" bị viết hoa thành "Quần"; "Dạ" thành "Da"
- "đúng rồi" → "đrui" (tin "dạ đúng rồi ạ" hiện méo thành "dạ đrui ạ")
- **"Dạ vâng ạ" (câu đóng hội thoại tư vấn trước mua) → hiện thành "khách
  hàng ạ"** trên preview sidebar lẫn trong khung chat (phát hiện
  2026-10-23, case `missed.luv251`) — dễ khiến chủ shop tưởng nhân viên gửi
  nhầm tin vô nghĩa, trong khi tin gửi thật và khách nhận được đúng là "Dạ
  vâng ạ".
- Sidebar: "cả" (= all), "với thư đến", "hạn chót", "Cài đặt Văn phòng"

**Lưu ý:** `get_page_text` đọc được DOM đôi khi vẫn trả về đúng tiếng Việt
gốc dù màn hình/screenshot hiện chữ đã dịch méo (quan sát case
`missed.luv251` 2026-10-23: `get_page_text` ra đúng "Dạ vâng ạ" trong khi
screenshot cùng lúc hiện "khách hàng"). Khi nghi ngờ, ưu tiên tin vào
`get_page_text`/ô soạn tin hơn là screenshot.

## Cách áp dụng

Nội dung trong ô soạn tin (trước khi bấm Gửi) là text THẬT — kiểm tra ở đó
bằng `zoom` là đủ. **Tin đã gửi hiển thị méo chữ thì KHÔNG gửi lại đính
chính**, khách vẫn nhận đúng nguyên văn. Đối chiếu nhanh: mở cùng mẫu câu
bên Shopee (`banhang.shopee.vn`, Chrome Shopee không bị dịch) sẽ thấy chữ
đúng. Khi đọc tin của khách trên TikTok cũng nhớ trừ hao méo chữ kiểu này.

## ⚠️ Rủi ro gửi lặp do đọc nhầm preview đã dịch méo

Case `missed.luv251` (2026-10-23): câu đóng hội thoại "Dạ vâng ạ" bị gửi
**lặp lại 3 lần** ở các mốc 00:07, 07:07 (x2), 07:14 — nghi do các lượt quét
tự động 15 phút/lần đọc preview sidebar bị dịch méo ("khách hàng ạ") nên
không nhận ra hội thoại đã được đóng bằng đúng mẫu câu, tưởng còn "chưa trả
lời" và gửi lại. Không hại gì tới khách (nội dung gửi vẫn đúng mỗi lần),
nhưng tốn lượt gửi và dễ gây hiểu lầm khi chủ shop xem lại lịch sử chat.

**How to apply:** trước khi đóng hội thoại bằng "Dạ vâng ạ"/sticker, kiểm
tra xem tin cuối CỦA SHOP đã là đúng câu đóng đó chưa (so bằng
`get_page_text`, không chỉ nhìn preview sidebar) — nếu đã có rồi thì không
gửi lại, dù preview hiển thị chữ lạ do dịch méo.
