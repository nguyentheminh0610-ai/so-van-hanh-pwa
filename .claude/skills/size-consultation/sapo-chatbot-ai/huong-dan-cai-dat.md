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

## Kết quả chạy test trong Xem trước (27/10/2026)

Chủ shop đã tự tải 5 file bảng tra lên. Thử ở chế độ "AI phản hồi tự động"
(bot chưa kích hoạt), xong đã trả về "AI gợi ý câu trả lời".

- **Lượt 1 — prompt v1 + 5 file bảng tra:** 0/4 đúng. AI không tra tài liệu,
  tự bịa dài quần (107, 110cm). → Tài liệu .docx KHÔNG được AI dùng để tính
  size.
- **Lượt 2 — đưa bảng quyết định + 5 bước tính + ví dụ vào prompt** (bản
  hiện tại của `prompt-sapo.txt`, ~7.300 ký tự, Sapo nhận đủ): câu nằm sẵn
  trong ví dụ thì đúng; câu mới **3/9 đúng (~33%)**.
  Lỗi gặp: đọc sai "cao 146 38 ký" thành thiếu chiều cao; 1m83 ra XL (đúng
  2XL); caro thừa cân + quét đất ra M 94 (đúng XL 100); kẹp 3XL nhưng dùng câu
  "đã có mốc"; tự hỏi thêm "bạn quan tâm mẫu nào"; có lần viết lộ phép tính
  ngưỡng cân cho khách.
- **FAQ:** chào ✓; unisex đúng câu nhưng tự gợi ý sản phẩm kèm giá sai
  ("15,000 VND" — lấy giá gốc từ dữ liệu sản phẩm); sợ chật eo đúng câu nhưng
  tự thêm câu hỏi; "giao thiếu" AI tự trả lời khách thay vì chuyển nhân viên.
- Thời gian trả lời 10–20 giây/câu.

**Kết luận:** AI của Sapo không đạt được mức 99% giống skill — tối đa ~33% ở
phần tư vấn size, dù đã đưa đủ bảng + ví dụ. Không nên bật tự động cho tư vấn
size; giữ task CSKH 15 phút. Chờ chủ shop quyết hướng tiếp.

## Prompt v4 — cấm gợi ý sản phẩm (28/10/2026)

Chủ shop test thấy AI tự nối "Bạn tham khảo các mẫu quần lông bên mình nhé: 1.
Quần dài chất lông hoạt hình - 150.000 VND" và hỏi "Bạn quan tâm sản phẩm nào
ạ?" → không muốn. Nguyên nhân: Sapo cho AI dùng nguồn dữ liệu **Sản phẩm** và
tự chèn gợi ý. Prompt v4 thêm mục "CẤM GỢI Ý SẢN PHẨM" lên đầu, thêm cách đọc
"m7"/"m8"/"m95" và 3 ví dụ đúng từ ảnh test (m7, m8 50kg quần lông, 1m95).
Nếu AI vẫn chèn sản phẩm → vào Nguồn dữ liệu > **Sản phẩm** bỏ chọn hết sản
phẩm (prompt không chặn được phần Sapo tự gắn).

### Kết quả test prompt v4 (28/10/2026, chế độ "AI gợi ý", 15 câu)

Đúng 11/15 ≈ **73%** (tăng từ ~33% ở v3). **Không câu nào chèn gợi ý sản phẩm
hay giá nữa** — prompt v4 chặn được, chưa phải tắt nguồn Sản phẩm.

Câu đúng: 1m65 55kg (L); nữ 1m58 60kg (M); 1m75 90kg (3XL thừa cân); cao 1m63
(L chỉ chiều cao); 1m52 45kg (S); 1m70 65kg mắt cá (M); cao 148 (S); 1m60 48
nữ (M); 1m80 70kg (2XL); caro nữ 1m55 68kg (caro L thừa cân); + câu hỏi phí
ship → từ chối an toàn, không bịa giá. Đọc "m7/m8/1m95" và phân biệt caro/quần
lông (không nối câu quần lông cho caro) đều đúng.

Câu SAI — đều là bước **tính ngưỡng thừa cân** và **chọn câu kẹp/mốc**:
- "cao 172 80kg nam": ra XL thừa cân, đúng L (172−90=82, 80<82 chưa thừa cân).
- "caro 1m68 72kg": ra XL thừa cân, đúng L (168−90=78, 72<78). Cùng lỗi ngưỡng.
- "1m85 quét đất": size 3XL đúng nhưng dùng câu "kẹp lớn nhất" (nói ngắn hơn
  quét đất), đúng phải câu "đã nói mốc" (3XL vừa đẹp) — 1m85+quét đất đạt 3XL
  tự nhiên, không bị kẹp.
- "nam 1m78 95kg quét đất": size 3XL đúng nhưng dùng câu "thừa cân" (nói dài
  hơn chạm gót), đúng phải "kẹp lớn nhất" (ngắn hơn quét đất) — đây mới là ca
  kẹp thật, AI lại bỏ mốc quét đất.

**Kết luận v4:** ~73%, chưa đạt 99%. Lỗi còn lại đúng chỗ AI phải tính nhẩm
(ngưỡng cân sát mốc) và chọn đúng câu khi vừa thừa cân vừa có mốc dài / bị kẹp
— những bước này chỉ code làm chuẩn được. Dùng Sapo thì nên để "AI gợi ý" cho
nhân viên duyệt, không bật tự động cho tư vấn size.

## Phần Sapo AI KHÔNG làm được như skill (giữ cho task CSKH hoặc nhân viên)

- TikTok Shop (Sapo không hỗ trợ kênh này).
- Gửi sticker đóng hội thoại CSKH sau mua.
- Gửi Telegram báo chủ shop (vd khách hỏi ngày hàng về).
- Tra biến thể combo thật trên Sapo trước khi tư vấn combo.
- Gợi ý đổi sang mẫu khác có size nhỏ hơn (`clamped_min_suggest_other`) — cần
  biết mẫu nào cùng dòng có size đó; chưa đưa vào bản này.
