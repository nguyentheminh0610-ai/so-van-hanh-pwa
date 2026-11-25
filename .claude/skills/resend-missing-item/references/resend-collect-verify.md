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
- **CẤM HỎI LẠI THỨ KHÁCH ĐÃ CÓ TRONG CHAT (chủ shop nhấn mạnh 21/11/2026).** Trước MỌI tin gửi khách trong luồng gửi bù (xin ảnh, SĐT,
  địa chỉ, món, nhắc, xác minh) làm đủ 4 việc, thiếu 1 việc là KHÔNG được gửi: (1) đọc dòng `☑` của phiếu (mục 1g); (2) đọc LẠI TOÀN BỘ
  hội thoại từ tin đầu — kể cả tin ảnh (mở phóng to), tin của nhân viên CS/chủ shop gõ tay (họ có thể đã hỏi hoặc khách đã trả lời họ),
  và đơn/ảnh khách gửi từ trước khi phiếu mở; (3) chỉ hỏi mục thật sự `=0` và chưa có trong `hoi=` (shop đã hỏi mà khách chưa trả lời thì không hỏi lại);
  (4) soạn tin xong đối chiếu từng mục trong tin với dòng `☑` — mục nào `=1` mà vẫn có trong tin thì xoá khỏi tin. Đọc không ra ảnh thì
  KHÔNG hỏi lại khách, đẩy lên sổ `[chờ anh]` để chủ shop mở chat xem.
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
- **Chủ shop nhấn mạnh 22/11/2026: chỉ xếp "2 đơn riêng, vận chuyển" khi ĐÃ XÁC MINH trong tab Đơn hàng
  thật sự có 2 mã đơn lẻ.** Case "đặt 2 cái trong 1 đơn mà thiếu 1 thật" rất dễ bị nhận nhầm sang nhóm này
  (khách nói "2 đơn", "2 cái" lẫn lộn) → nhận nhầm là khách bị bỏ rơi. Mặc định khi chưa xác minh được là
  nghi giao thiếu, mở phiếu, đừng bỏ qua.
- Đơn 1 mã nhưng đóng thành nhiều gói/kiện (tách kiện): chủ shop xác nhận 22/11/2026 là **không có** trường hợp này, không cần quy tắc.
  Nếu gặp thật thì để chủ shop tự vào xử lý, CS không tạo đơn bù.

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
  - `collecting`/`wait_approve_*`/`approved`/`creating`: đừng nhắn
    thêm câu xin thông tin; nếu khách hỏi lại thì trả lời ngắn "shop đã ghi nhận
    và đang xử lý đơn gửi bù cho bạn, có mã vận đơn shop gửi bạn liền ạ".
  - `done`: gửi lại mã vận đơn + link `https://spx.vn/track?<mã>`.
  - Món khác cùng đơn: cùng trạng thái trước `approved` → sửa `item_summary` gộp
    cả món; sau đó → mở dòng phụ (`handle` giữ nguyên, `orig_order_code` thêm
    hậu tố `-2`) và ghi `owner_note` "liên quan case <id>". **Chép luôn dòng `☑` của
    case gốc sang dòng phụ** (chốt 21/11/2026) — cùng khách cùng đơn thì SĐT/địa chỉ
    đã có ở phiếu gốc vẫn dùng được, KHÔNG hỏi lại chỉ vì mở phiếu mới.
- **Chưa có** → còn kiểm Sổ Kho (`warehouse_notices?category=eq.gui_don_bu` có nội
  dung chứa mã đơn gốc chưa) và lịch sử chat. Có rồi → không mở case, báo chủ shop.
- Insert dòng mới `status=collecting`. Bị lỗi 409 (trùng khoá) = lượt khác vừa mở,
  đọc lại dòng và tiếp tục theo trạng thái.
- **Khách muốn HOÀN TIỀN thay vì nhận gửi bù (chốt 22/11/2026, thay cho "KHÔNG mở case, báo Telegram"):**
  CS hướng dẫn khách tự bấm hoàn tiền trên sàn ngay, chủ shop duyệt yêu cầu đó trên sàn. Mẫu hướng dẫn: mục hoàn tiền
  (khách thiếu hàng) ở [mau-tin-nhan-tra-hang.md](../../../shared/mau-tin-nhan-tra-hang.md) — Shopee lý do "Chưa nhận được hàng
  hoặc thiếu hàng", TikTok "Tôi không nhận được hàng", bỏ đoạn shipper lấy hàng; đọc nguyên văn Sheet "Mau tin nhan" dòng 17–22.
  Vẫn mở phiếu `resend_cases` để hiện trên Sổ Vận Hành, thêm `⚑ hoantien=1` + dòng
  `▸ [chờ anh] Khách muốn hoàn tiền trên sàn — đã hướng dẫn khách bấm hoàn tiền, anh duyệt trên sàn`. KHÔNG Telegram, KHÔNG tạo
  đơn gửi bù, CS không tự duyệt và không hứa số tiền. Khách đổi ý muốn nhận gửi bù thì bỏ cờ (`⚑ hoantien=0`) và đi tiếp luồng thường.
- **Khách bực / doạ đánh giá xấu nhưng không đòi hoàn tiền (chốt 22/11/2026):** xử lý như case thường, không khác gì (có tin xin lỗi mở đầu).
- **Món thiếu đang hết hàng (chốt 22/11/2026):** vẫn tạo đơn gửi bù bình thường, không chặn hay hỏi lại; kho tự thu xếp hàng.
- **Mốc 15 ngày (chủ shop chốt 23/11/2026, giống đổi trả):** khách báo thiếu khi đã **quá 15 ngày** kể từ ngày "Đã giao" của đơn
  → không gửi bù. Câu (chủ shop duyệt 23/11/2026, dùng chung với đổi trả): "Dạ đơn của bạn đã quá 15 ngày kể từ khi nhận hàng nên
  shop không hỗ trợ đổi trả được nữa ạ, mong bạn thông cảm giúp shop nhé ạ." Không thấy ngày giao → coi như còn hạn, làm bình
  thường (đừng chặn oan). Vẫn mở phiếu để hiện trên sổ, dòng cuối `▸ [xong] Đã từ chối — quá 15 ngày (giao DD/MM)`, không tạo đơn.
- **Thiếu cái gì mới là "giao thiếu" (chủ shop chốt 23/11/2026):** chỉ khi thiếu nguyên **1 sản phẩm** trong đơn. Khách kêu 1 chiếc
  quần **thiếu dây rút / thiếu tag mác** → đó là **hàng lỗi**, KHÔNG mở phiếu gửi bù; xử lý theo luồng đổi hàng lỗi ở
  `size-consultation/references/cskh-doi-hang-loi-21-11.md`.

## 1b. KHÔNG để phiếu đứng im — tin mới của khách có phiếu mở (chốt 19/11/2026)

*Lý do:* phiếu #7 `_ciara07_` (TikTok, đơn 587168972405048607) mở 18/11 22:42 ở `collecting`.
Hôm 19/11 16:23 khách gửi SĐT, lượt quét ghi "không rõ ngữ cảnh, chưa trả lời" (category `khac`)
vì không đối chiếu với phiếu đang mở → khách chờ cả ngày, phiếu không bao giờ lên tab duyệt.
Chủ shop: "khách phải chờ đợi là không được".

Quy tắc, áp dụng MỌI lượt quét (cả 4 task CSKH), TRƯỚC khi phân loại bất kỳ tin nào:

1. **Tra `resend_cases` theo `platform` + `handle` của khách** (status `collecting` /
   `verifying` / `wait_approve_*`). Có phiếu mở → tin mới của khách (SĐT, địa chỉ, họ tên,
   ảnh, "đúng rồi", "ok", tên món...) là CÂU TRẢ LỜI cho phiếu đó. **Cấm** xếp vào `khac` /
   "không rõ ngữ cảnh" / bỏ qua. Làm tiếp từ mục 2 (đang `collecting`) hoặc mục 4 (đang `wait_approve_1`, khách trả lời xác minh).
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

Mỗi lần đọc phiếu `collecting` (mọi lượt quét), đối chiếu 4 mục: ảnh bằng chứng, món thiếu,
SĐT, địa chỉ (số nhà + phường/xã + tỉnh/thành). Họ tên không hỏi (lấy trên sàn, mục 1e).
**"Đã có / còn thiếu" đọc từ dòng `☑` của phiếu (mục 1f.3 + 1g), không suy từ ghi chú tự do.**
- **Thiếu hoặc chưa rõ mục nào → gửi NGAY 1 tin ngắn chỉ hỏi đúng mục đó** (gộp nhiều mục trong
  1 tin, không hỏi lại phần khách đã gửi, không chờ lượt sau). Vd: "Dạ bạn cho shop xin thêm số điện thoại
  nhận hàng để shop tạo đơn gửi bù cho bạn nhé ạ."; địa chỉ thiếu phường/xã: "Dạ bạn cho shop xin địa chỉ
  đầy đủ gồm số nhà, phường/xã, tỉnh/thành để shop gửi đúng chỗ ạ."
- Món thiếu chưa rõ → hỏi 1 câu kèm danh sách món của đơn để khách chọn (như mục 1b.3).
- **TikTok chặn gửi SĐT trong chat** (khách báo gửi không được): hỏi 1 lần "Dạ bạn gõ số điện thoại cách
  bằng dấu chấm hoặc dấu cách giúp shop (vd 09.12.345.678) được không ạ"; cách thứ ba (chốt 22/11/2026, rất hiếm gặp nhưng lưu để chắc): khách **ghi thông tin ra tờ giấy rồi chụp ảnh gửi shop**
  (ảnh tờ giấy tính là đã gửi, đọc như ảnh chụp màn hình). Khách vẫn không gửi được →
  KHÔNG im lặng: ghi `owner_note` "khách không gửi được SĐT trong chat TikTok", bật Telegram cho chủ shop
  1 lần để quyết định (đọc SĐT từ đơn nếu xem được, hoặc duyệt khi có SĐT che một phần).
- Mỗi mục thiếu chỉ hỏi **1 lần**; hỏi rồi mà khách im thì theo mục 1e (nhắc 1 lần ở mốc 4h, hiện trên Sổ Vận Hành,
  KHÔNG Telegram — thay cho "nhắc 24h / treo 72h" cũ và cho câu "bật Telegram" ở trên), không spam.
- Cờ chống trùng: đặt `msg_remind_at` (hoặc cột tương ứng) lên TRƯỚC khi gửi.
- Đủ 5 mục → chuyển ngay mục 3 (gửi tin xác minh), không chờ lượt sau.

## 1d. Chạy bù sau khi PC tắt / mất điện (chốt 21/11/2026)

Hệ thống phải tự bắt kịp, chủ shop không phải báo từng case:
- Mọi lượt CSKH inbox (ngày/tối/đêm) ở Bước 0a **luôn** tra `resend_cases` phiếu `collecting`/`wait_approve_1`
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

**Quy trình (theo mục 1h, chốt 21/11/2026 — chạy SONG SONG, không tuần tự như bản cũ):** hỏi khách phần thiếu → có đủ SĐT + địa chỉ →
GỬI TIN XÁC MINH cho khách + ĐỒNG THỜI `wait_approve_1` để chủ shop duyệt → bên nào đến trước (chủ shop duyệt / khách nói "đúng") thì tạo đơn luôn → duyệt lần 2.

1. **Thiếu SĐT hoặc địa chỉ:** KHÔNG có đường tắt, chủ shop KHÔNG duyệt dù thiếu được (không có gì để tạo đơn).
   Gửi NGAY 1 tin hỏi đúng thứ thiếu, ghi `stall_reason` = `Thiếu: SĐT` / `Thiếu: địa chỉ` (kèm ảnh nếu thiếu cả ảnh), giữ `collecting`.
   Web hiện phiếu ở nhóm "Duyệt gửi bù" với dòng "Thiếu…" + "đã hỏi khách / chưa phản hồi sau N giờ"; chỉ có nút "Dừng".
2. **Chỉ thiếu ẢNH** (đã có SĐT + địa chỉ): vẫn phải gửi tin hỏi ảnh (mục 2) VÀ gửi tin xác minh thông tin (mục 3) như thường;
   ghi `stall_reason` = `Thiếu: ảnh`. Web hiện thêm nút "Duyệt dù thiếu ảnh" → chủ shop duyệt luôn không cần chờ ảnh, nhưng
   quy trình xác minh với khách vẫn chạy; khách sửa thông tin thì ghi lại file dữ liệu + `data_hash` + `owner_note`.
3. **Khách im ≥ 4 giờ** (tính từ tin hỏi của shop hoặc tin cuối của khách; lượt quét nào tới trước trong khoảng 4–6 giờ):
   nhắc khách **1 lần duy nhất** (cờ `msg_remind_at` lên trước khi gửi): "Dạ shop nhắc nhẹ, bạn gửi giúp shop <thứ còn thiếu> để
   shop kịp gửi bù cho bạn nhé ạ". Web tự hiện cảnh báo "khách chưa phản hồi" — KHÔNG Telegram, KHÔNG đổi sang `stalled`.
4. Đủ ảnh + SĐT + địa chỉ → set `stall_reason` null → mục 3 (gửi tin xác minh + `wait_approve_1` cùng lúc, mục 1h).
5. Mọi lượt quét (kể cả ban đêm) đều áp dụng — không bỏ qua phiếu `collecting` vì "đang ngoài giờ".

**Đánh giá xấu (1–3★) đã nhắn khách:** web hiện "đã nhắn khách lúc X, khách chưa phản hồi sau N giờ" khi ≥ 4 giờ, dựa vào
`messaged_at`. Khi lượt CSKH inbox thấy khách TRẢ LỜI tin đó trong chat → thêm chữ "khách đã phản hồi HH:MM" vào
`message_note` của dòng `cskh_reviews` (web đổi dòng cảnh báo thành "khách đã phản hồi — anh mở chat xem"). Không nhắc khách lần 2.
**Trả hàng thường:** chỉ nhắn khách 1 lần, không theo dõi, không nhắc.

## 1f. KHÔNG TỰ DỪNG ĐỂ CHỜ CHỦ SHOP; DẤU ✓/✗ CHO WEB (chốt 21/11/2026)

*Lý do:* phiếu #9 `ntt1072006` dừng ở `[chờ anh]` vì khách nói thiếu "đốm hồng size L" mà task thấy đơn "không có mẫu đốm hồng" —
nhưng task mới xem 2/3 món (web ghi "+1 mặt hàng (chưa xem)"), món thứ 3 chưa mở. Phiếu #8 cũng đứng ở `[chờ anh]` vì khách bấm hoàn tiền.
Chủ shop: "hệ thống phải chạy tới cùng, không dừng giữa chừng".

1. **Món thiếu không khớp đơn → TRƯỚC HẾT mở đủ MỌI món của đơn gốc** (kể cả mặt hàng bị gập/ẩn) rồi so lại. Vẫn không khớp thì
   HỎI KHÁCH 1 câu kèm danh sách món để khách chọn (mục 1c). KHÔNG chuyển sang `[chờ anh]` chỉ vì "chưa rõ món".
2. `[chờ anh]` chỉ dùng cho việc đúng là quyền chủ shop: 2 lần duyệt, hoàn tiền/tranh chấp, đọc ảnh không ra. Phiếu `collecting` mà
   dòng cuối là `[chờ anh]` thì web đưa vào nhóm "Duyệt gửi bù" (đừng ghi `stall_reason` không dấu: phải là `Thiếu: ...` có dấu).
3. **Dòng dấu tích cho web:** mỗi lần cập nhật phiếu, thêm/ghi lại dòng riêng trong `owner_note` (dòng CUỐI thắng):
   `☑ sdt=1 diachi=1 anh=0` (1 = đã có, 0 = chưa). SĐT/địa chỉ chỉ tính 1 khi ĐỦ dùng để tạo đơn (địa chỉ có phường/xã + tỉnh).
   Web hiện thành "✓ SĐT ✓ Địa chỉ ✗ Ảnh"; không có dòng này thì web tự đoán (kém chính xác).
4. **"Xong" = đã nhắn khách tin kèm link theo dõi đơn** (chủ shop chốt lại 21/11/2026, thay cho câu "chỉ xong khi khách nhận được đơn" — KHÔNG
   cần theo dõi SPX tới khi giao). Giữ nguyên cách đóng phiếu hiện tại.

5. **MỌI đơn liên quan giao thiếu phải hiện trên sổ (chủ shop bắt buộc, 21/11/2026)** — từ chat, đánh giá, trả hàng, hay khách tự bấm
   hoàn tiền/khiếu nại trên sàn: phải có phiếu `resend_cases` + dòng `▸` đầu tiên, không bỏ sót. Khách ĐÃ bấm "Hoàn tiền / Trả hàng và hoàn tiền"
   vì thiếu hàng (vd #8 obe9hvmo5o, Shopee 165.000đ) → thêm dòng riêng `⚑ hoantien=1` vào `owner_note` + dòng `▸ [chờ anh]` nói rõ
   số tiền, giờ khách bấm, khách hỏi gì; web hiện nhãn đỏ "Khách đang yêu cầu hoàn tiền vì thiếu". Chủ shop vào kiểm rồi quyết hoàn tiền hay gửi bù.
   Hết yêu cầu hoàn tiền (khách rút) thì ghi `⚑ hoantien=0`.
6. **Mẫu thiếu mà đơn có 3 món (phiếu #9, 21/11/2026):** chủ shop xác nhận món thiếu `Chất Lông-Đốm Hồng L` CÓ trong đơn (món thứ 3, bị ẩn sau
   nút "Ẩn bớt/Xem thêm" ở khung đơn hàng chat TikTok). Phải bấm mở rộng danh sách mặt hàng trước khi kết luận "đơn không có món X".

## 1i. Phiếu có `⚑ hoantien=1` → MỖI LƯỢT mở trang Trả hàng/Hoàn tiền của sàn kiểm trạng thái (chủ shop chốt 25/11/2026, cả Shopee + TikTok)

*Lý do (sự cố thật):* phiếu #8 `obe9hvmo5o` (Shopee, đơn 261114AGT3DCNC). Khách bấm hoàn tiền 165.000đ vì thiếu 1 quần; Shopee
**đã hoàn xong** (yêu cầu `2611200RAT0MJE6` = "Đã hoàn tiền cho Người mua") nhưng từ 21/11 tới 25/11 hơn 30 lượt quét chỉ đọc
chat rồi ghi "khách vẫn đang yêu cầu hoàn tiền, chờ anh quyết" — không lượt nào mở trang trả hàng. Chủ shop tưởng còn phải
quyết, suýt gửi bù thêm cho khách đã nhận lại tiền. Chat KHÔNG cho biết yêu cầu hoàn tiền đã kết thúc thế nào.

Mọi lượt quét gặp phiếu mở (`collecting` / `wait_approve_*` / `approved`, chưa `creating`) có `⚑ hoantien=1`, TRƯỚC khi ghi
dòng `▸ [chờ anh]`:

1. **Mở trang trả hàng của ĐÚNG sàn, tìm theo mã đơn gốc** (`orig_order_code`):
   - **Shopee** (Chrome Shopee): `https://banhang.shopee.vn/portal/sale/returnrefundcancel` → ô "Tìm yêu cầu" gõ mã đơn →
     "Tìm kiếm". Một đơn có thể có NHIỀU yêu cầu (khách bấm lại) — đọc hết, cột "Trạng thái" + "Phương án cho Người mua".
     `get_page_text` trang này không ra bảng; dùng `find`/chụp màn hình.
   - **TikTok** (Chrome TikTok): `https://seller-vn.tiktok.com/order/return` → ô tìm "ID đơn hàng trả lại, ID đơn hàng…" gõ
     mã đơn; xem cả tab "Đã giải quyết" (`&tab=1100`). `get_page_text` đọc được cả danh sách.
2. **Đã hoàn tiền xong** — Shopee: "Đã hoàn tiền cho Người mua"; TikTok: "Yêu cầu hoàn tiền đã hoàn tất" → **KHÔNG gửi bù**.
   PATCH `status=cancelled` (điều kiện theo trạng thái cũ), `stall_reason` = `Đã hoàn tiền <số tiền> trên <sàn> — không gửi bù`,
   thêm `▸ [xong] …` ghi mã yêu cầu + số tiền + chữ trạng thái đọc được, và `⚑ hoantien=0`. Không nhắn khách, không Telegram.
3. **Yêu cầu bị huỷ / đóng mà KHÔNG hoàn tiền** — Shopee: "Yêu cầu bị huỷ"; TikTok: "Đã đóng yêu cầu" (kiểm thêm chi tiết
   yêu cầu xem tiền có thật sự được hoàn không — chữ này chưa đối chiếu trên case gửi bù thật nào, 25/11/2026) và không còn
   yêu cầu nào khác đang mở → ghi `⚑ hoantien=0` + `▸` nói rõ, rồi **chạy tiếp luồng gửi bù bình thường** (mục 1c/1h).
4. **Còn đang chờ xử lý** (chờ shop / chờ sàn quyết) → giữ `[chờ anh]`, nhưng dòng `▸` phải ghi **chữ trạng thái đọc được trên
   trang trả hàng + hạn phản hồi nếu có**, không ghi chung chung "khách vẫn đang yêu cầu hoàn tiền".
5. Không mở được trang (lỗi tải, đăng xuất) → ghi rõ "chưa kiểm được trang trả hàng lượt này", KHÔNG suy trạng thái từ chat.
6. Gửi bù qua SPX khi khách đã được sàn hoàn tiền = mất cả tiền lẫn hàng → trước khi tạo đơn SPX (pha A 15h) cho phiếu từng
   có `hoantien=1` cũng kiểm lại bước 1 một lần nữa.

## 1h. LUỒNG NHANH — gửi xác minh cho khách ĐỒNG THỜI đưa chủ shop duyệt (chốt 21/11/2026, THAY mục 3 + 4 + 5 cũ)

> **Lịch sử 21/11/2026:** từng bỏ hẳn bước xác minh (cdaa392) rồi chủ shop yêu cầu THÊM LẠI cùng ngày. Bản hiện hành = mục này: tin xác minh gửi NGAY khi đủ thông tin, chạy song song với duyệt lần 1.

*Lý do:* chủ shop: "chờ khách xác nhận rồi mới sang a duyệt là bị chậm". Hai việc chạy SONG SONG, bên nào xong trước thì đi tiếp.

1. **Ngay khi đủ 3 thứ (ảnh + SĐT + địa chỉ) + biết món thiếu**, trong CÙNG lượt: ghi file dữ liệu chốt + `data_hash` (như mục 3), gửi tin xác minh cho
   khách, và PATCH **thẳng `status=wait_approve_1`** (KHÔNG qua `verifying` nữa) kèm `msg_verify_at`, `run_date` = hôm nay, `customer_confirmed_at` = null.
   Ghi `▸ [chờ anh] Đã gửi khách xác minh — chờ anh duyệt lần 1 (khách trả lời đúng thì tự chạy)`. Không Telegram.
2. **Duyệt lần 1 = BÊN NÀO ĐẾN TRƯỚC:**
   - Chủ shop bấm "Duyệt" trên web (`approved`) → đi tạo đơn luôn (lượt CSKH làm ngay, như mục 18/11), KHÔNG chờ khách trả lời.
   - Chủ shop chưa kịp duyệt mà khách trả lời "đúng/ok" → task tự PATCH `status=approved` (điều kiện `status=eq.wait_approve_1`),
     `customer_confirmed_at`, gửi tin ghi nhận (cờ `msg_ack_at` lên trước), rồi tạo đơn luôn. Không chờ anh.
   - Anh đã duyệt rồi khách mới trả lời "đúng" → chỉ ghi `customer_confirmed_at` + gửi tin ghi nhận, không đổi trạng thái.
3. **Khách SỬA thông tin sau khi đã gửi xác minh:** ghi lại file dữ liệu + `data_hash`, gửi tin xác minh mới, đặt lại `wait_approve_1`
   (đang `approved` mà chưa `creating` cũng đặt lại được). Đã `creating` trở đi thì KHÔNG đụng: ghi `▸ [chờ anh] Khách sửa thông tin sau khi đã tạo đơn — anh kiểm`.
4. Duyệt lần 2 (sau khi tạo đơn SPX + PDF) vẫn là quyền chủ shop, không đổi.
5. Mục 3, 4, 5 bên dưới đã viết lại theo luồng này (không còn `verifying`, không còn Telegram duyệt lần 1).
   Nhắc khách im ≥ 4 giờ (mục 1e) vẫn áp dụng cho tin xác minh chưa được trả lời.
6. **Bắt kịp phiếu đã vào `wait_approve_1` mà CHƯA có tin xác minh** (`msg_verify_at` null — vd #9 ntt1072006 sang chờ duyệt lúc 14:06 khi bước xác minh đang bị bỏ): mỗi lượt quét tra các phiếu này, gửi tin xác minh NGAY (đọc dòng `☑` + file dữ liệu, cờ `msg_verify_at` lên trước), không đổi trạng thái, ghi `▸ [chờ anh] Đã gửi khách xác minh (bù)`.

## 1g. SỔ KIỂM "KHÁCH ĐÃ GỬI GÌ" = dòng `☑` — CẤM hỏi lại thứ khách đã gửi (chốt 21/11/2026, case #9)

*Lý do (sự cố thật):* phiếu #9 `ntt1072006` (TikTok). 20/11 khách đã gửi **địa chỉ bằng chữ** và **SĐT bằng ảnh
chụp màn hình** (TikTok chặn gõ số). Lượt 22:15 không mở ảnh, ghi vào ghi chú "khách từ chối gửi SĐT". Lượt sáng
21/11 (09:36, `msg_remind_at`) tin vào ghi chú đó, soạn tin theo mẫu gộp "xin họ tên, SĐT và địa chỉ" → khách bị hỏi
lại cả thứ đã gửi. Chủ shop: "khách có gửi SĐT và địa chỉ rồi mà vẫn hỏi lại".

Gốc rễ: trước 21/11 phiếu **không có chỗ ghi "khách đã gửi gì"**. Mỗi lượt 15 phút tự đọc lại chat (hay bỏ qua tin
ảnh) rồi suy "còn thiếu gì" từ câu chữ tự do của lượt trước (`stall_reason`, `owner_note`) — một lượt đọc sai là các
lượt sau sai theo. **Nguồn sự thật duy nhất từ nay là dòng `☑` trong `owner_note`** (định dạng ở mục 1f.3, dòng cuối
thắng), mở rộng thêm phần "đã hỏi":

```
☑ sdt=1 diachi=1 anh=0 hoi=anh@22:15
```
`hoi=` liệt kê mục shop ĐÃ gửi tin hỏi (`sdt`, `diachi`, `anh`) kèm giờ gửi, cách nhau dấu phẩy; không có thì bỏ.
Web chỉ đọc 3 cặp `sdt/diachi/anh`, phần `hoi=` dành cho các lượt quét.

Quy tắc, áp dụng MỌI lượt quét có phiếu `collecting`:

1. **Đọc chat → ghi dòng `☑` ngay**, không chờ đủ. Khách gửi mục nào (bằng chữ HOẶC ảnh) thì ghi `=1` mục đó ngay
   lượt đó + cập nhật `recipient_masked` từng phần (có SĐT thì thêm `09******00`, có địa chỉ thì thêm `Tỉnh / Phường`).
   Tin ảnh của khách **bắt buộc mở ra đọc (phóng to)** trước khi kết luận thiếu gì — chưa mở ảnh thì chưa được hỏi.
2. **Trước khi soạn BẤT KỲ tin hỏi/nhắc → đọc dòng `☑` của phiếu.** Chỉ được nhắc tới mục `=0`. Mục `=1` →
   **cấm xuất hiện trong tin**, dù lượt trước ghi gì trong `stall_reason`/`owner_note`. Mẫu tin theo tổ hợp thiếu ở
   [resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md) mục "Hỏi thông tin nhận hàng — theo phần còn
   thiếu". Mẫu gộp "SĐT và địa chỉ" chỉ dùng khi **cả `sdt=0` và `diachi=0`** (bỏ chữ "họ tên" — tên lấy trên sàn, mục 1e).
3. **Mục đã hỏi (có trong `hoi=`) mà khách chưa trả lời → không hỏi lại**; chỉ nhắc 1 lần ở mốc 4h theo 1e.3, và tin
   nhắc cũng chỉ nêu mục còn `=0`. Gửi tin hỏi xong thì thêm mục đó vào `hoi=` cùng lượt.
4. **Ghi chú tự do không phải nguồn sự thật.** Thấy ghi chú lượt trước kiểu "khách từ chối gửi SĐT" / "chưa có SĐT"
   nhưng `sdt=0` và trong chat có tin ảnh chưa đọc → mở ảnh đọc lại trước, sửa dòng `☑`, rồi mới quyết hỏi hay không.
   Ghi dòng `▸` nói rõ "đã đọc ảnh HH:MM: có SĐT/địa chỉ" để lượt sau không đọc lại.
5. `stall_reason` khi còn thiếu ghi **đúng định dạng có dấu** `Thiếu: <SĐT|địa chỉ|ảnh, nối bằng " + ">` — chỉ liệt kê
   mục `=0`, không chèn thêm câu chữ về mục đã có. Đủ 3 mục `=1` → `stall_reason` null → mục 3 (tin xác minh).
6. Phiếu mở TRƯỚC 21/11 chưa có dòng `☑`: lượt đầu gặp phải đọc lại cả hội thoại (mở mọi ảnh) rồi ghi dòng `☑` trước
   khi làm gì khác.

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
- **Thứ tự tin của case (chủ shop chốt lại 23/11/2026, thay bản 22/11 "xin lỗi → xin ảnh"): Tin xin ảnh (không xin lỗi, chờ khách
  gửi) → Tin XIN LỖI → tin hướng xử lý "gửi bù miễn phí" → tin xin SĐT/địa chỉ + sản phẩm thiếu.** Khách có ảnh sẵn → bắt đầu từ tin xin lỗi.
  Tin xin lỗi ("Dạ, shop xin lỗi vì bên mình vừa có bạn ở kho mới vào làm nên đóng hàng bị thiếu ạ. Về vấn đề này mình chắc chắn sẽ note và báo lại anh quản lý để cải thiện ngay, mình xin phép đề xuất hướng xử lý như sau ạ.", mẫu + điều kiện bỏ qua ở
  [resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md)) gửi 1 lần/case, ghi `xl@HH:MM` vào `hoi=` trước khi gửi.
- Chưa có ảnh nào → gửi **Tin xin ảnh vỏ đơn** (mẫu ở [resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md))
  ĐẦU TIÊN (trước tin xin lỗi — 23/11/2026); khách gửi ảnh rồi mới tới tin xin lỗi, hướng xử lý, xin họ tên/SĐT/địa chỉ. Cờ `msg_photo_at` lên trước khi gửi (quy tắc chung).
- **Chưa có ảnh khách gửi trong chat → KHÔNG gửi tin xác minh, KHÔNG chuyển `wait_approve_1`,
  KHÔNG đưa chủ shop duyệt** (trừ khi anh bấm "Duyệt dù thiếu ảnh"). Giữ `collecting`; nhắc khách theo mục 1e (4h, 1 lần).
  Cột `msg_photo_at` chưa có trên DB (chủ shop chưa chạy SQL) thì kiểm lịch sử chat
  xem đã xin ảnh chưa, đừng xin lại.
- Khi khách gửi ảnh: ghi vào `item_evidence` "khách gửi ảnh vỏ đơn/ảnh sản phẩm nhận được lúc HH:MM" (web hiện để anh
  mở chat xem ảnh rồi duyệt; KHÔNG Telegram — chốt 21/11/2026).

Cần đủ: ảnh bằng chứng (ảnh vỏ đơn HOẶC ảnh sản phẩm/gói hàng nhận được), món thiếu (mẫu, size, SL), SĐT, địa chỉ (tên lấy trên sàn). Thiếu mục nào hỏi
ĐÚNG mục đó (mẫu theo phần còn thiếu ở file flow-batch). Món thiếu chưa rõ → mở đủ mọi món của đơn (1f.1), vẫn chưa rõ thì hỏi khách 1 câu kèm
danh sách món (1c) — không báo chủ shop trừ khi khách không trả lời được.

Khi khách gửi ảnh: đọc ra tên, SĐT, địa chỉ; ghép SĐT với SĐT bị che trong đơn
(prefix/suffix phải khớp, xem Step 2 của SKILL.md). Tra mã vận đơn gốc:
`scripts/order_to_tracking.sh <mã đơn gốc>` → ghi `orig_tracking`.

Xác định món thiếu: từ lời khách + danh sách món của đơn gốc → `item_summary`,
`item_confidence` (high = khách nói rõ đúng 1 món; medium = suy từ lời nhân viên
hoặc đơn có nhiều món cùng loại; low = đoán), `item_evidence` (1-2 câu),
`order_items`.

## 3. Gửi tin xác minh + ĐỒNG THỜI → `wait_approve_1` (mục 1h; KHÔNG còn `verifying`)

1. Ghi **file dữ liệu chốt** cục bộ (NGOÀI git): `C:\sokho\resend-data\<platform>_<handle>_<mã đơn gốc>.json`
   với `name`, `phone` (dạng liền, vd `0900000000`), `address`, `item_name`
   (tên sản phẩm SPX theo `.claude/shared/notice_naming.md`), `item_summary`,
   `qty`, **`price`** (giá bán 1 món thiếu trên đơn gốc, số nguyên đồng, vd 150284 — SPX bắt khai "giá sản phẩm"), `orig_order_code`, `orig_tracking`.
   **BẮT BUỘC có thêm mảng `items` — mỗi món khác phân loại hoặc khác size là 1 phần tử (sửa lỗi 25/11/2026, lý do ở `notice_naming.md` mục 1):**
   ```json
   "items": [
     {"name": "Gửi bù - 587275116939019871 - Quần Chất Lông-Shin L",    "qty": 1, "price": 156800},
     {"name": "Gửi bù - 587275116939019871 - Quần Chất Lông-Shin 02 L", "qty": 1, "price": 156800}
   ]
   ```
   Đơn thiếu 1 món vẫn ghi `items` với 1 phần tử. `name` của 1 phần tử **không bao giờ chứa ` + `**; `qty` là số lượng của riêng món đó,
   `price` là giá 1 chiếc của món đó. `item_name` / `qty` cũ chỉ còn để đọc file cũ: `item_name` = tên phần tử đầu, `qty` = tổng số chiếc.
   Trong tin xác minh, mỗi món ghi 1 dòng `- Sản phẩm gửi bù: ...` riêng.
2. Gửi tin xác minh (mẫu duy nhất ở `SKILL.md` Step 2b; gửi thành 1 tin, xuống dòng bằng Shift+Enter, không Enter từng dòng) — các trường lấy từ **chính file này**.
3. PATCH: `status=wait_approve_1`, `run_date` = hôm nay, `customer_confirmed_at` = null, `msg_verify_at`, `item_*`, `recipient_masked`,
   `orig_tracking`, `data_hash` = SHA-256 của file
   (`python -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" <file>`).

Khách sửa thông tin → ghi lại file, gửi tin xác minh mới, cập nhật `data_hash`
(đặt `msg_verify_at` mới). Cờ lên trước khi gửi như quy tắc chung.

## 4. Khách trả lời "đúng" khi phiếu đang `wait_approve_1`

Khách trả lời đúng ("đúng rồi", "ok"...). Gửi **Tin ghi nhận** (không hứa giờ, mẫu ở
[resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md); chốt 18/11/2026).
PATCH `customer_confirmed_at`, `msg_ack_at` (cờ lên trước khi gửi) và, nếu chủ shop CHƯA duyệt, `status=approved`
(điều kiện `status=eq.wait_approve_1`) để tạo đơn luôn (mục 1h.2). KHÔNG Telegram duyệt lần 1 — chủ shop thấy phiếu "chờ duyệt" ngay trên Sổ Vận Hành
(hạn duyệt trước ~14h40 để đơn kịp đi hôm nay, web tự hiện).

Khách trả lời mà không rõ có xác nhận không → không đoán, đọc lại cả hội thoại;
vẫn không rõ thì hỏi lại 1 câu ngắn "Thông tin trên đã đúng chưa bạn nhỉ ạ?".

## 5. Nhắc / treo

- `collecting` im ≥ 4 giờ → nhắc 1 lần theo mục 1e (chỉ nêu mục còn `=0`). Phiếu `wait_approve_1` mà khách chưa trả lời xác minh thì KHÔNG
  nhắc khách (đã gửi đủ rồi; chủ shop duyệt là đi được, không cần khách).
- Quá 72h vẫn im ở `collecting` → `status=stalled`, `stall_reason='Khách im > 72h'`. Chủ shop xử lý trên web.
- Chờ duyệt lần 1 gần 14h40: web tự hiện hạn + cảnh báo (KHÔNG Telegram, chốt 21/11/2026 thay cho Telegram nhắc 14h30/14h50). Duyệt muộn vẫn được,
  chỉ đi ngày mai; không còn "trượt phiên" hay tin xin lỗi riêng (chốt 18/11/2026).

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

## Khách gửi SĐT bằng ẢNH chụp màn hình = ĐÃ gửi SĐT (chốt 21/11/2026, case #9 ntt1072006)

TikTok chặn khách gõ SĐT trong chat; khách làm theo hướng dẫn thì chụp màn hình rồi gửi ảnh ("số điện thoại em ko gửi
dc, shop xem ảnh giúp em"). Lượt quét 20/11 22:15 hiểu nhầm thành "khách từ chối gửi SĐT" → ghi sai "Thiếu: SĐT".
Quy tắc: tin ảnh của khách luôn PHẢI mở ra đọc (phóng to ảnh) — thấy SĐT/địa chỉ trong ảnh thì tính là đã có. Đọc không ra
số thì KHÔNG ghi "khách từ chối"; ghi "SĐT nằm trong ảnh, task đọc không ra — chủ shop mở chat xem" và đẩy lên Sổ Vận Hành.
