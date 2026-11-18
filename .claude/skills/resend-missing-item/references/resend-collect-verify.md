# Giai đoạn 1-2: phát hiện, thu thập, xác minh với khách (chốt 17/11/2026)

Việc của **task CSKH inbox** (ban ngày / tối / đêm) khi gặp khách báo thiếu hàng.
Task CSKH **KHÔNG BAO GIỜ tạo đơn SPX** — việc đó thuộc phiên 15h
([resend-run-1500.md](resend-run-1500.md)). Tổng quan luồng, mẫu tin, lý do:
[resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md).

Supabase: URL + anon key như phần Quick reference của SKILL.md. Bảng
`resend_cases` (chú thích cột/trạng thái ở `scripts/resend-tables.sql`). Gửi
JSON tiếng Việt từ file UTF-8 (`--data-binary @file`), không gõ thẳng trong `-d`.

## Quy tắc chung

- **Mỗi tin gắn 1 cờ, cờ lên TRƯỚC khi gửi:** PATCH cột `msg_*_at` kèm điều kiện
  `&msg_*_at=is.null` (Prefer: return=representation). Không có dòng trả về =
  lượt khác đã làm → bỏ qua. Gửi lỗi thì đặt lại cờ về null. Nhờ vậy 2 lượt chạy
  chồng nhau không nhắn khách 2 lần.
- **PII:** SĐT/địa chỉ đầy đủ KHÔNG ghi vào Supabase hay git. Chỉ ghi
  `recipient_masked` (vd `N*** V*** A · 09******00 · Hà Nội / P. Cầu Giấy`).
- Chỉ xử lý giờ theo **giờ khách nhắn trên sàn**, không phải giờ task đọc.
- Hộp "Giữ thông tin bí mật" của TikTok khi gửi tin có SĐT: với **tin xác minh**
  bấm "Vẫn gửi" (chủ shop cho phép 16/11/2026). Không bấm được thì KHÔNG gửi,
  đặt case `stalled` + `last_error`, báo Telegram.

## 1. Phát hiện + chống trùng

Tín hiệu: khách báo thiếu/giao thiếu ("thiếu 1 quần", "không có cái..."), nhân
viên đã hứa "gửi bù", hoặc chủ shop nhắn tên khách.

Trước khi mở case, tra `resend_cases` theo `platform`, `handle`, `orig_order_code`
(bỏ qua dòng `cancelled`):
- **Đã có dòng** → KHÔNG insert. Làm theo trạng thái hiện tại:
  - `collecting`/`verifying`/`wait_approve_*`/`approved`/`creating`: đừng nhắn
    thêm câu xin thông tin; nếu khách hỏi lại thì trả lời ngắn "shop đã ghi nhận
    và đang xử lý đơn gửi bù cho bạn, có mã vận đơn shop gửi bạn liền ạ".
  - `done`: gửi lại mã vận đơn + link `https://spx.vn/track?<mã>`.
  - Món khác cùng đơn: cùng trạng thái trước `approved` → sửa `item_summary` gộp
    cả món; sau đó → mở dòng phụ (`handle` giữ nguyên, `orig_order_code` thêm
    hậu tố `-2`) và ghi `owner_note` "liên quan case <id>".
- **Chưa có** → còn kiểm Sổ Kho (`warehouse_notices?category=eq.gui_don_bu` có nội
  dung chứa mã đơn gốc chưa) và lịch sử chat. Có rồi → không mở case, báo chủ shop.
- Insert dòng mới `status=collecting`. Bị lỗi 409 (trùng khoá) = lượt khác vừa mở,
  đọc lại dòng và tiếp tục theo trạng thái.
- Có tranh chấp / đòi hoàn tiền trong hội thoại → KHÔNG mở case, báo Telegram.

## 2. Hỏi thông tin (`collecting`)

### ⚠️ Ảnh bằng chứng — BẮT BUỘC (chủ shop chốt lại 18/11/2026)

Lý do: chủ shop **duyệt lần 1 bằng cách mở chat khách, xem ảnh bằng mắt** xem có đúng
là thiếu / giao sai không, rồi mới duyệt. Không có ảnh = chủ shop không có gì để
đối chiếu. Hôm 17/11 case `vlbd_aivri` (Shopee) bị bỏ qua bước này vì file flow mới
làm rơi mất mẫu xin ảnh (lệch giữa các file) — không được lặp lại, kể cả khi đơn Shopee
tự tra được món/mã vận đơn.

- Case mới → gửi **Tin xin ảnh vỏ đơn** (mẫu ở [resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md))
  TRƯỚC, rồi tin xin họ tên/SĐT/địa chỉ. Cờ `msg_photo_at` lên trước khi gửi (quy tắc chung).
- **Chưa có ảnh khách gửi trong chat → KHÔNG gửi tin xác minh, KHÔNG chuyển `verifying`,
  KHÔNG ping chủ shop duyệt.** Giữ `collecting`; quá 24h nhắc như mục 5.
  Cột `msg_photo_at` chưa có trên DB (chủ shop chưa chạy SQL) thì kiểm lịch sử chat
  xem đã xin ảnh chưa, đừng xin lại.
- Khi khách gửi ảnh: ghi vào `item_evidence` "khách gửi ảnh vỏ đơn lúc HH:MM", và ở
  Telegram duyệt lần 1 phải ghi rõ **tên khách + sàn + "mở chat xem ảnh khách gửi rồi duyệt"**.

Cần đủ: ảnh vỏ đơn, món thiếu (mẫu, size, SL), họ tên + SĐT, địa chỉ. Thiếu mục nào hỏi mục đó
(mẫu: Tin xin ảnh vỏ đơn, Tin xin họ tên/SĐT/địa chỉ ở file flow-batch). Món thiếu
chưa rõ → không tự hỏi, báo chủ shop (chưa có mẫu).

Khi khách gửi ảnh: đọc ra tên, SĐT, địa chỉ; ghép SĐT với SĐT bị che trong đơn
(prefix/suffix phải khớp, xem Step 2 của SKILL.md). Tra mã vận đơn gốc:
`scripts/order_to_tracking.sh <mã đơn gốc>` → ghi `orig_tracking`.

Xác định món thiếu: từ lời khách + danh sách món của đơn gốc → `item_summary`,
`item_confidence` (high = khách nói rõ đúng 1 món; medium = suy từ lời nhân viên
hoặc đơn có nhiều món cùng loại; low = đoán), `item_evidence` (1-2 câu),
`order_items`.

## 3. Gửi tin xác minh → `verifying`

1. Ghi **file dữ liệu chốt** cục bộ (NGOÀI git): `C:\sokho\resend-data\<platform>_<handle>_<mã đơn gốc>.json`
   với `name`, `phone` (dạng liền, vd `0900000000`), `address`, `item_name`
   (tên sản phẩm SPX theo `.claude/shared/notice_naming.md`), `item_summary`,
   `qty`, `orig_order_code`, `orig_tracking`.
2. Gửi tin xác minh (mẫu "Tin xác minh") — các trường lấy từ **chính file này**.
3. PATCH: `status=verifying`, `msg_verify_at`, `item_*`, `recipient_masked`,
   `orig_tracking`, `data_hash` = SHA-256 của file
   (`python -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" <file>`).

Khách sửa thông tin → ghi lại file, gửi tin xác minh mới, cập nhật `data_hash`
(đặt `msg_verify_at` mới). Cờ lên trước khi gửi như quy tắc chung.

## 4. Khách xác nhận → `wait_approve_1`

Khách trả lời đúng ("đúng rồi", "ok"...). Gửi **Tin ghi nhận** (không hứa giờ, mẫu ở
[resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md); chốt 18/11/2026,
thay cho Tin 2a/2b theo giờ). Không còn chọn tin theo giờ khách xác nhận.

PATCH `status=wait_approve_1` (điều kiện `status=eq.verifying`),
`customer_confirmed_at`, `run_date` = hôm nay, `msg_ack_at` (cờ lên trước khi gửi).
Rồi gửi **Telegram** cho chủ shop (bot như `daily-warehouse-report`, chat_id của chủ
shop): nguyên văn tin xác minh (có đủ SĐT/địa chỉ — chỉ chủ shop thấy), món thiếu +
độ chắc + bằng chứng, và "Duyệt lần 1 ở tab 'Gửi bù' trên Sổ Vận Hành (trước ~14h40
để đơn kịp đi hôm nay)".

Khách trả lời mà không rõ có xác nhận không → không đoán, đọc lại cả hội thoại;
vẫn không rõ thì hỏi lại 1 câu ngắn "Thông tin trên đã đúng chưa bạn nhỉ ạ?".

## 5. Nhắc / treo

- `verifying` hoặc `collecting` quá 24h không có tin khách mới → nhắc 1 lần
  (`msg_remind_at` lên trước, nội dung ngắn nhẹ nhàng nhắc khách gửi/xác nhận
  thông tin để shop tạo đơn gửi bù; chủ shop chưa duyệt câu chữ → dùng
  "Dạ bạn xác nhận giúp shop thông tin gửi bù để shop tạo đơn sớm cho bạn nhé ạ").
- Quá 72h vẫn im → `status=stalled`, `stall_reason='Khách im > 72h'`.
  Chủ shop có thể bấm "Duyệt dù khách chưa xác nhận" trên tab.
- Sau 14h30 mà case vẫn `wait_approve_1` → Telegram nhắc 1 lần (14h50 nhắc lần 2,
  "duyệt sau 14h40 thì đơn đi ngày mai"). Duyệt muộn vẫn được, chỉ đi ngày mai; không
  còn "trượt phiên" hay tin xin lỗi riêng (chốt 18/11/2026).

## Telegram ngoài ý muốn

Lỗi lặp, kẹt hộp quyền, đọc ảnh không ra, SĐT không khớp phần che → báo Telegram
1 tin ngắn nêu rõ case nào, lỗi gì; đặt `stalled` nếu không tự gỡ được.
