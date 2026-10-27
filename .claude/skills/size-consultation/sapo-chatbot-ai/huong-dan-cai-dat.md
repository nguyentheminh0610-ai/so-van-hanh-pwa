# Cài Sapo Chatbot AI trả lời khách giống skill size-consultation

Bắt đầu 27/10/2026 theo yêu cầu chủ shop: dùng Chatbot AI của Sapo (Chat OmniAI >
Công cụ > Chatbot AI, kịch bản "trả lời", gian hàng Shopee SOMETIME) để trả lời
khách giống task CSKH 15 phút. **Chỉ coi là xong khi Sapo AI khớp ≥99% bộ test**
(`out/bo-test.xlsx`).

Nguồn kiến thức vẫn là [SKILL.md](../SKILL.md) +
[size-spec.md](../references/size-spec.md) + [size-rules.json](../references/size-rules.json).
**Sửa quy tắc thì sửa ở đó trước, rồi chạy lại `python build_sapo_files.py`** để
sinh lại file cho Sapo — không sửa tay file trong `out/`.

## Những gì đọc được từ hướng dẫn Sapo (help.sapo.vn, đọc 27/10/2026)

- Kênh hỗ trợ: Facebook, Instagram, Zalo, Zalo OA, **Shopee**. **Không có TikTok
  Shop** → TikTok vẫn phải do task CSKH 15 phút trả lời.
- Mỗi gian hàng chỉ chạy 1 kịch bản cùng lúc.
- "Câu hỏi thường gặp" là nguồn quan trọng nhất; mỗi mục: câu hỏi, người xử lý
  (Chatbot AI / Nhân viên), hướng dẫn trả lời **tối đa 600 ký tự**, tối đa 3 ảnh.
- "Tài liệu": tối đa **10 file** .docx/.xlsx/.xls/.pdf. Sapo khuyên mỗi đoạn 1 ý,
  tránh bảng phức tạp, tách nhiều file nhỏ → vì vậy bảng tra size được viết thành
  từng dòng văn bản tự đủ nghĩa, mỗi dòng quần 1 file.
- "Tình huống mặc định" (không xoá được, chỉnh/bật tắt được): Yêu cầu huỷ đơn,
  Tồn kho sản phẩm, Kiểm tra trạng thái vận chuyển, Thay đổi địa chỉ nhận hàng,
  Thông tin sản phẩm.
- Sản phẩm: AI chỉ dùng giá gốc, chỉ trả lời sản phẩm tồn kho > 0.
- Shopee: Sapo tự lọc từ khoá cấm; nên ghi thêm trong prompt (đã ghi).
- Xem trước: phải bấm **Lưu** sau mỗi thay đổi rồi mới test. Có chế độ "AI gợi
  ý câu trả lời" (nhân viên duyệt) và "AI phản hồi tự động".
- ⚠️ 27/10/2026 trang Chatbot AI báo **"Điểm AI của bạn không đủ để sử dụng
  tính năng Chatbot AI"** → phải mua điểm AI mới test/chạy được.

## Vì sao không chỉ dán prompt

AI của Sapo là mô hình chung, không chạy được thuật toán B1→B5 (thừa cân, mốc
dài, kẹp size) một cách ổn định. Cách làm: tính sẵn mọi trường hợp bằng code
(`size_engine.py`, đã khớp 19/19 test case của spec) rồi đưa cho Sapo dạng "tra
cứu" — AI chỉ cần tìm đúng dòng chiều cao và chép câu mẫu.

## Các bước cài (theo thứ tự)

1. **Cá nhân hoá Prompt**: dán toàn bộ [prompt-sapo.txt](prompt-sapo.txt).
2. **Thiết lập chung**: Thời gian = Cả ngày; Hình thức = **AI gợi ý câu trả
   lời** trong giai đoạn thử (đổi sang tự động khi đạt 99%); Giới thiệu là AI =
   tắt; Tư vấn khi hết hàng = tắt; Chuyển nhân viên khi AI không hiểu = **bật**;
   Bám đuổi = tắt (skill không bám đuổi khách).
3. **Câu hỏi thường gặp**: nhập từng dòng của `out/faq-sapo.xlsx` (cột Người xử
   lý ghi sẵn Chatbot AI / Nhân viên). Dòng "Xin bảng size" đính kèm ảnh bảng
   size quần lông + caro.
4. **Tình huống mặc định**: Yêu cầu huỷ đơn, Kiểm tra vận chuyển, Thay đổi địa
   chỉ → người xử lý **Nhân viên** (skill không trả lời các việc này). Tồn kho
   sản phẩm → thêm hướng dẫn "phải hỏi rõ phân loại trước". Thông tin sản phẩm
   → giữ Chatbot AI.
5. **Tài liệu**: tải 5 file `out/bang-tra-size-*.docx`.
6. **Lưu** → test bằng khung Xem trước với `out/bo-test.xlsx` (gõ cột B, chép
   câu Sapo trả lời vào cột G, chấm cột H). Đạt = đúng size + đúng dài quần +
   đúng câu mẫu (cho phép khác dấu câu/từ đệm).
7. Đạt ≥99% → bật Kích hoạt (hỏi chủ shop trước). Khi Sapo chạy Shopee, phải
   **tắt phần Shopee của task CSKH 15 phút** để khách không bị trả lời 2 lần.

## Nhật ký nạp cấu hình (27/10/2026, sau khi chủ shop mua điểm AI)

- Đã nạp: prompt (giữ nguyên chế độ "AI gợi ý"), bật "Chuyển nhân viên khi AI
  không hiểu", 17 câu FAQ, 3 tình huống mặc định (huỷ đơn / vận chuyển / đổi
  địa chỉ) → Nhân viên, Tồn kho → thêm hướng dẫn hỏi phân loại trước.
- **Không tải được tài liệu bằng Claude in Chrome**: trang cấu hình nằm trong
  iframe khác domain (`sapo-socials.sapoapps.vn`), công cụ không thấy ô chọn
  file; mở thẳng iframe thì bị chuyển về trang admin. → Người phải tự kéo thả 5
  file `out/bang-tra-size-*.docx`. Giới hạn ghi trên hộp tải: tối đa 10 file,
  35.000 từ/văn bản, 200 dòng/excel.
- Ô FAQ: câu hỏi ≤300 ký tự, hướng dẫn ≤600; khung tự giãn tới ~3 dòng nên vị
  trí nút Lưu đổi theo độ dài — nhập tay bằng tool thì chụp màn hình trước khi
  bấm Lưu.
- FAQ còn **15 câu mẫu cũ của Sapo (28/04/2025)**, vài câu đang để Chatbot AI
  tự trả lời việc skill không làm (phí ship, thời gian giao, đổi trả, khuyến
  mãi, thanh toán…), câu "Chương trình khuyến mãi" ngược với câu mới "Hỏi giá,
  khuyến mãi → Nhân viên". Chưa sửa — chờ chủ shop quyết.
- Thử 1 câu khi chưa có bảng tra ("nữ 1m56 50kg"): đúng size M + đúng mẫu,
  nhưng ghi dài 94cm (số caro) thay vì 95cm → xác nhận bảng tra là bắt buộc.

## Phần Sapo AI KHÔNG làm được như skill (giữ cho task CSKH hoặc nhân viên)

- TikTok Shop (Sapo không hỗ trợ kênh này).
- Gửi sticker đóng hội thoại CSKH sau mua.
- Gửi Telegram báo chủ shop (vd khách hỏi ngày hàng về).
- Tra biến thể combo thật trên Sapo trước khi tư vấn combo.
- Gợi ý đổi sang mẫu khác có size nhỏ hơn (`clamped_min_suggest_other`) — cần
  biết mẫu nào cùng dòng có size đó; chưa đưa vào bản này.
