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

Nguồn thứ hai (chốt 19/11/2026): lượt review-return-check có thể đã mở sẵn phiếu `collecting`
cho đơn khách báo thiếu qua trả hàng/đánh giá và đã nhắn tin liên hệ + xin ảnh (Tin 3a/3b trong
`.claude/shared/mau-tin-nhan-tra-hang.md`). Gặp phiếu như vậy → tiếp tục từ mục 2, **đừng mở
phiếu mới, đừng gửi lại câu mở đầu**.

Tín hiệu: khách báo thiếu/giao thiếu ("thiếu 1 quần", "không có cái..."), nhân
viên đã hứa "gửi bù", hoặc chủ shop nhắn tên khách.

**Câu mơ hồ kiểu "đặt 2 đơn/2 cái mà chỉ thấy 1" — PHẢI mở đơn xem số lượng
trước khi phân loại** (chốt 18/11/2026). Khách hay gọi "2 đơn" khi thật ra là
1 đơn số lượng 2. Mở tab Đơn hàng của khách (khung bên phải webchat Shopee /
chi tiết đơn TikTok):
- Có 1 đơn SL ≥ 2 (hoặc nhiều món) mà khách nói chỉ nhận 1 → **giao thiếu**,
  làm theo file này (mở case, xin thông tin; chỉ xin ảnh vỏ đơn nếu khách chưa gửi ảnh nào).
- Thật sự có 2 đơn riêng, 1 đơn chưa giao tới → mới là vận chuyển (để chủ shop).
- Không chắc → xem ảnh khách gửi; vẫn không chắc thì báo Telegram, đừng tự xếp
  vào "vận chuyển" rồi bỏ qua.

**Ảnh/tin mới của khách đã có trong nhật ký `cskh-log` vẫn phải xem lại**
(chốt 18/11/2026). Quy tắc chống trùng chỉ để không GHI log 2 lần, KHÔNG có
nghĩa là giữ nguyên cách phân loại cũ. Khách gửi thêm ảnh/tin sau mốc log →
mở ra xem, phân loại lại nếu ảnh cho thấy khác (vd ảnh chỉ có 1 món).

*Lý do:* case `obe9hvmo5o` (Shopee, đơn 261114AGT3DCNC, Caro Xanh Lá 03 L x2)
ngày 18/11/2026: khách nhắn 22:23 "mình đặt 2 đơn quần mà chỉ thấy ship 1 cái
thôi nhỉ?" rồi 22:26 gửi ảnh túi hàng chỉ có 1 quần. Lượt 22:25 hiểu là 2 đơn
riêng → xếp "logistics", không mở đơn; lượt 23:10 thấy tên đã có trong log nên
bỏ qua luôn ảnh mới. Khách bị treo tới khi chủ shop hỏi lại; case #8 mở lúc 23:29.

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

## 1b. KHÔNG để phiếu đứng im — tin mới của khách có phiếu mở (chốt 19/11/2026)

*Lý do:* phiếu #7 `_ciara07_` (TikTok, đơn 587168972405048607) mở 18/11 22:42 ở `collecting`.
Hôm 19/11 16:23 khách gửi SĐT, lượt quét ghi "không rõ ngữ cảnh, chưa trả lời" (category `khac`)
vì không đối chiếu với phiếu đang mở → khách chờ cả ngày, phiếu không bao giờ lên tab duyệt.
Chủ shop: "khách phải chờ đợi là không được".

Quy tắc, áp dụng MỌI lượt quét (cả 4 task CSKH), TRƯỚC khi phân loại bất kỳ tin nào:

1. **Tra `resend_cases` theo `platform` + `handle` của khách** (status `collecting` /
   `verifying` / `wait_approve_*`). Có phiếu mở → tin mới của khách (SĐT, địa chỉ, họ tên,
   ảnh, "đúng rồi", "ok", tên món...) là CÂU TRẢ LỜI cho phiếu đó. **Cấm** xếp vào `khac` /
   "không rõ ngữ cảnh" / bỏ qua. Làm tiếp từ mục 2 (đang `collecting`) hoặc mục 4 (đang `verifying`).
2. **Tin chỉ có SĐT / địa chỉ rời** vẫn đọc và ghi nhận. Chưa đủ thì chỉ hỏi phần còn thiếu
   bằng 1 tin ngắn, không hỏi lại phần khách đã gửi.
3. **Món thiếu chưa rõ** (vd đơn có 2 cái cùng phân loại): đừng treo. Hỏi khách 1 câu ngắn
   kèm danh sách món của đơn để khách chọn, rồi chạy tiếp song song với việc xin thông tin.
4. **Chống đứng im:** phiếu `collecting` quá **2 giờ** (trong giờ 9h–2h sáng) mà `updated_at`
   không đổi → lượt quét kế tiếp PHẢI mở chat khách xem có tin mới chưa, xử lý ngay; nếu vẫn
   thiếu thông tin do khách chưa trả lời thì làm theo mục 5 (nhắc). Nếu không làm gì được
   (lỗi đọc, hộp quyền...) → Telegram cho chủ shop 1 lần/phiếu, nêu tên khách + vướng ở đâu.
   Không để phiếu nằm im qua nhiều lượt mà không ai biết.
5. Mỗi lượt quét đầu tiên trong ngày liệt kê các phiếu mở, ghi vào `cskh-log` dòng
   "phiếu #<id> <handle> <status> — việc tiếp theo: ..." để lượt sau không phải đoán.

## 1c. Thiếu / chưa rõ thông tin → HỎI LẠI KHÁCH ĐÚNG 1 CÂU, không để phiếu đứng im (chốt 21/11/2026)

*Lý do:* phiếu #9 `ntt1072006` (20/11) khách gửi tên + địa chỉ + ảnh nhưng chưa có SĐT, phiếu đứng
im 14 giờ không ai hỏi; phiếu #8 `obe9hvmo5o` khách gửi đủ từ 19/11 11:02 nhưng không ai chạy bước
xác minh, đứng 57 giờ. Chủ shop: "thiếu SĐT hoặc địa chỉ khách chưa gửi hoặc em chưa rõ thì hỏi lại khách 1 câu",
không để chủ shop phải vào kiểm tay từng case.

Mỗi lần đọc phiếu `collecting` (mọi lượt quét), đối chiếu 5 mục: ảnh bằng chứng, món thiếu,
họ tên, SĐT, địa chỉ (số nhà + phường/xã + tỉnh/thành).
- **Thiếu hoặc chưa rõ mục nào → gửi NGAY 1 tin ngắn chỉ hỏi đúng mục đó** (gộp nhiều mục trong
  1 tin, không hỏi lại phần khách đã gửi, không chờ lượt sau). Vd: "Dạ bạn cho shop xin thêm số điện thoại
  nhận hàng để shop tạo đơn gửi bù cho bạn nhé ạ."; địa chỉ thiếu phường/xã: "Dạ bạn cho shop xin địa chỉ
  đầy đủ gồm số nhà, phường/xã, tỉnh/thành để shop gửi đúng chỗ ạ."
- Món thiếu chưa rõ → hỏi 1 câu kèm danh sách món của đơn để khách chọn (như mục 1b.3).
- **TikTok chặn gửi SĐT trong chat** (khách báo gửi không được): hỏi 1 lần "Dạ bạn gõ số điện thoại cách
  bằng dấu chấm hoặc dấu cách giúp shop (vd 09.12.345.678) được không ạ". Khách vẫn không gửi được →
  KHÔNG im lặng: ghi `owner_note` "khách không gửi được SĐT trong chat TikTok", bật Telegram cho chủ shop
  1 lần để quyết định (đọc SĐT từ đơn nếu xem được, hoặc duyệt khi có SĐT che một phần).
- Mỗi mục thiếu chỉ hỏi **1 lần**; hỏi rồi mà khách im thì theo mục 1e (nhắc 1 lần ở mốc 4h, hiện trên Sổ Vận Hành,
  KHÔNG Telegram — thay cho "nhắc 24h / treo 72h" cũ và cho câu "bật Telegram" ở trên), không spam.
- Cờ chống trùng: đặt `msg_remind_at` (hoặc cột tương ứng) lên TRƯỚC khi gửi.
- Đủ 5 mục → chuyển ngay mục 3 (gửi tin xác minh), không chờ lượt sau.

## 1d. Chạy bù sau khi PC tắt / mất điện (chốt 21/11/2026)

Hệ thống phải tự bắt kịp, chủ shop không phải báo từng case:
- Mọi lượt CSKH inbox (ngày/tối/đêm) ở Bước 0a **luôn** tra `resend_cases` phiếu `collecting`/`verifying`
  mà `updated_at` cũ hơn 30 phút và xử lý theo 1b + 1c, kể cả khi 2 inbox đều "0 chưa trả lời" (khách
  có thể đã trả lời xong từ trước và tin đã bị đánh dấu đã đọc).
- Windows Task Scheduler `Claude - Watchdog` (`scripts/watchdog.py`, 30 phút/lần, 0 token, không cần
  Claude/Chrome) tự báo Telegram khi: quét đánh giá/trả hàng quá 14 giờ chưa thành công (CHỈ việc này; báo
  phiếu đứng im / chờ duyệt đã TẮT 21/11/2026 — hiện thẳng trên Sổ Vận Hành, xem 1e). Nhờ `StartWhenAvailable`, sau khi PC bật lại nó chạy bù ngay.

## 1e. QUY TẮC CHỐT 21/11/2026 — thiếu thông tin: PHẢI hỏi bằng được khách, hiện trên Sổ Vận Hành (KHÔNG Telegram)

*Thay cho* mọi chỗ khác trong file này nói "nhắc sau 24h / treo 72h", "chưa có ảnh → KHÔNG ping chủ shop" và "báo Telegram
cho chủ shop" về phiếu thiếu thông tin. Chủ shop: "không cần báo tele, rối lắm, hiển thị trên sổ vận hành là được".
**Chủ shop KHÔNG tự điền SĐT/địa chỉ thay khách** (SĐT/địa chỉ đầy đủ không được vào Supabase): phải hỏi khách bằng được.

**Cần đủ 3 thứ: ảnh bằng chứng + SĐT + địa chỉ.** Họ tên KHÔNG cần khách gửi — lấy tên hiển thị của khách trên sàn.
Ảnh chụp màn hình có SĐT/địa chỉ = đã gửi (xem mục cuối file). Sàn che tên/SĐT trong đơn nên KHÔNG tra từ đơn.

**Quy trình luôn đủ các bước (không bỏ bước nào):** hỏi khách phần thiếu → có đủ SĐT + địa chỉ → GỬI TIN XÁC MINH cho khách
(mục 3, `verifying`) → khách xác nhận "đúng" (mục 4, `wait_approve_1`) → chủ shop duyệt lần 1 → tạo đơn → duyệt lần 2.

1. **Thiếu SĐT hoặc địa chỉ:** KHÔNG có đường tắt, chủ shop KHÔNG duyệt dù thiếu được (không có gì để tạo đơn).
   Gửi NGAY 1 tin hỏi đúng thứ thiếu, ghi `stall_reason` = `Thiếu: SĐT` / `Thiếu: địa chỉ` (kèm ảnh nếu thiếu cả ảnh), giữ `collecting`.
   Web hiện phiếu ở nhóm "Duyệt gửi bù" với dòng "Thiếu…" + "đã hỏi khách / chưa phản hồi sau N giờ"; chỉ có nút "Dừng".
2. **Chỉ thiếu ẢNH** (đã có SĐT + địa chỉ): vẫn phải gửi tin hỏi ảnh (mục 2) VÀ gửi tin xác minh thông tin (mục 3) như thường;
   ghi `stall_reason` = `Thiếu: ảnh`. Web hiện thêm nút "Duyệt dù thiếu ảnh" → chủ shop duyệt luôn không cần chờ ảnh, nhưng
   quy trình xác minh với khách vẫn chạy; khách sửa thông tin thì ghi lại file dữ liệu + `data_hash` + `owner_note`.
3. **Khách im ≥ 4 giờ** (tính từ tin hỏi của shop hoặc tin cuối của khách; lượt quét nào tới trước trong khoảng 4–6 giờ):
   nhắc khách **1 lần duy nhất** (cờ `msg_remind_at` lên trước khi gửi): "Dạ shop nhắc nhẹ, bạn gửi giúp shop <thứ còn thiếu> để
   shop kịp gửi bù cho bạn nhé ạ". Web tự hiện cảnh báo "khách chưa phản hồi" — KHÔNG Telegram, KHÔNG đổi sang `stalled`.
4. Đủ ảnh + SĐT + địa chỉ → set `stall_reason` null → mục 3 (tin xác minh) → mục 4.
5. Mọi lượt quét (kể cả ban đêm) đều áp dụng — không bỏ qua phiếu `collecting` vì "đang ngoài giờ".

**Đánh giá xấu (1–3★) đã nhắn khách:** web hiện "đã nhắn khách lúc X, khách chưa phản hồi sau N giờ" khi ≥ 4 giờ, dựa vào
`messaged_at`. Khi lượt CSKH inbox thấy khách TRẢ LỜI tin đó trong chat → thêm chữ "khách đã phản hồi HH:MM" vào
`message_note` của dòng `cskh_reviews` (web đổi dòng cảnh báo thành "khách đã phản hồi — anh mở chat xem"). Không nhắc khách lần 2.
**Trả hàng thường:** chỉ nhắn khách 1 lần, không theo dõi, không nhắc.

## 2. Hỏi thông tin (`collecting`)

### ⚠️ Ảnh bằng chứng — BẮT BUỘC (chủ shop chốt lại 18/11/2026)

Lý do: chủ shop **duyệt lần 1 bằng cách mở chat khách, xem ảnh bằng mắt** xem có đúng
là thiếu / giao sai không, rồi mới duyệt. Không có ảnh = chủ shop không có gì để
đối chiếu. Hôm 17/11 case `vlbd_aivri` (Shopee) bị bỏ qua bước này vì file flow mới
làm rơi mất mẫu xin ảnh (lệch giữa các file) — không được lặp lại, kể cả khi đơn Shopee
tự tra được món/mã vận đơn.

- **Đọc lại cả hội thoại TRƯỚC khi xin ảnh** (chốt 18/11/2026 tối): khách ĐÃ gửi ảnh
  sản phẩm/gói hàng nhận được (thấy được là thiếu/sai), hoặc ảnh vỏ đơn → **KHÔNG gửi
  Tin xin ảnh vỏ đơn nữa**, ảnh đó đã đủ làm bằng chứng cho chủ shop duyệt; chỉ gửi tin
  xin họ tên/SĐT/địa chỉ, và đặt `msg_photo_at` = giờ khách gửi ảnh (để lượt sau không xin).
  Ảnh tem KHÔNG bắt buộc riêng — mã đơn/mã vận đơn tự tra được (khung đơn hàng webchat
  Shopee, `order_to_tracking.sh`). *Lý do:* case `obe9hvmo5o` 18/11 — khách đã gửi ảnh túi
  hàng chỉ có 1 quần lúc 22:26, vẫn bị xin "ảnh vỏ đơn" lúc 23:29; chủ shop: "khách đã gửi
  ảnh sp rồi mà sao còn hỏi lại" → bỏ.
- Chưa có ảnh nào → gửi **Tin xin ảnh vỏ đơn** (mẫu ở [resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md))
  TRƯỚC, rồi tin xin họ tên/SĐT/địa chỉ. Cờ `msg_photo_at` lên trước khi gửi (quy tắc chung).
- **Chưa có ảnh khách gửi trong chat → KHÔNG gửi tin xác minh, KHÔNG chuyển `verifying`,
  KHÔNG ping chủ shop duyệt.** Giữ `collecting`; quá 24h nhắc như mục 5.
  Cột `msg_photo_at` chưa có trên DB (chủ shop chưa chạy SQL) thì kiểm lịch sử chat
  xem đã xin ảnh chưa, đừng xin lại.
- Khi khách gửi ảnh: ghi vào `item_evidence` "khách gửi ảnh vỏ đơn/ảnh sản phẩm nhận được lúc HH:MM", và ở
  Telegram duyệt lần 1 phải ghi rõ **tên khách + sàn + "mở chat xem ảnh khách gửi rồi duyệt"**.

Cần đủ: ảnh bằng chứng (ảnh vỏ đơn HOẶC ảnh sản phẩm/gói hàng nhận được), món thiếu (mẫu, size, SL), họ tên + SĐT, địa chỉ. Thiếu mục nào hỏi mục đó
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

## Khách gửi SĐT bằng ẢNH chụp màn hình = ĐÃ gửi SĐT (chốt 21/11/2026, case #9 ntt1072006)

TikTok chặn khách gõ SĐT trong chat; khách làm theo hướng dẫn thì chụp màn hình rồi gửi ảnh ("số điện thoại em ko gửi
dc, shop xem ảnh giúp em"). Lượt quét 20/11 22:15 hiểu nhầm thành "khách từ chối gửi SĐT". Quy tắc: tin ảnh của khách luôn
PHẢI mở ra đọc (phóng to) — thấy SĐT/địa chỉ trong ảnh thì tính là đã có. Đọc không ra số thì KHÔNG ghi "khách từ chối";
ghi "SĐT nằm trong ảnh, task đọc không ra — chủ shop mở chat xem" và đẩy lên Sổ Vận Hành.

## GHI TIẾN ĐỘ MỖI BƯỚC (chốt 21/11/2026) — bắt buộc

Mọi bước ở trên (phát hiện, hỏi khách, nhắc, gửi xác minh, khách xác nhận, báo chủ shop...) phải kèm 1 dòng `▸` thêm vào
`owner_note` của phiếu theo [tien-do-xu-ly.md](../../../shared/tien-do-xu-ly.md) (có bảng các bước + nhãn `[đang làm]/[chờ khách]/[chờ anh]/[xong]`).
Web đo thời gian ở bước cuối và hiện ⚠ khi kẹt; chủ shop theo dõi tiến độ trên Sổ Vận Hành, không dùng Telegram.
Phiếu nào phát hiện giao thiếu từ BẤT KỲ nguồn nào cũng phải mở ngay + ghi dòng đầu tiên, để hiện lên sổ.
