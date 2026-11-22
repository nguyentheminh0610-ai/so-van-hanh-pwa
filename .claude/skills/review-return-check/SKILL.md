---
name: review-return-check
description: Check of new public reviews (đánh giá) and return/refund requests (trả hàng/hoàn tiền) on TikTok Shop + Shopee -- runs on schedule twice a day (08:00 and 20:00), and also whenever the shop owner says "check đánh giá", "check trả hàng", "làm luôn đi", "a báo e làm" (in the context of reviews/returns), or otherwise asks to run this check. Covers: finding genuinely new reviews/return requests, messaging the customer with the correct canned template (skipping any case that already has a reply thread), writing every review/return as one row into the Supabase tables behind the "Đánh giá &amp; Trả hàng" tab of Sổ Vận Hành (including the needs_action flag and the insight tag that groups repeat product/service problems), and pinging the shop owner on Telegram with a one-line alert only when something actually needs them. Does NOT cover inbox/chat monitoring (paused for now, see Scope) or any refund/policy decision (always the shop owner's call).
---

# Check đánh giá & trả hàng

## ⛔ BƯỚC 0 — CHỈ CHẠY TRÊN MÁY WINDOWS (bắt buộc, làm trước mọi thứ)

Chạy `hostname`. Nếu kết quả **không phải `DESKTOP-N7T8LNP`** (vd máy Mac)
→ **DỪNG NGAY**: không mở trình duyệt, không nhắn khách, **không gửi
Telegram**, chỉ trả lời 1 câu "Bỏ qua: việc này chỉ chạy trên máy Windows."
Chủ shop chốt 2026-10-21: mọi công việc chạy trên Windows, tránh 2 máy làm
trùng (khách bị nhắn 2 lần, Telegram nhận 2 báo cáo).


## What this is for

The shop owner's current (2026-10-07) working scope for customer-service
automation: Claude handles the **first-contact** step for two channels —
public reviews and return/refund requests — then hands everything else
back to the shop owner. Full rationale and the back-and-forth that pinned
these rules down lives in the Claude Doc
**"Workflow CSKH: Phàn nàn · Đánh giá · Trả hàng hoàn tiền"**
(`https://claude.ai/code/artifact/178382aa-6df8-4fdd-af48-886b6c18a3fa`) and
[project_cskh_task_not_started](../../shared/project_cskh_task_not_started.md) — if this skill ever seems to contradict
either, trust this file for the mechanics (it's the ready-to-execute
version) but go reconcile the doc, the shop owner corrects this often.

## Scope — read before doing anything

- **In scope right now:** public reviews (TikTok Shop + Shopee) and return/refund
  requests (TikTok Shop + Shopee Seller Center).
- **Out of scope / paused:** inbox/chat messages. Don't check inbox
  proactively. Only touch a specific inbox conversation when the shop owner
  explicitly names that case.
- **Lịch chạy: 2 lần/ngày, cách nhau 12 tiếng — 08:00 và 20:00** (chốt
  2026-10-13, thay cho quy tắc "chỉ chạy khi được gọi" trước đây). Shop
  owner vẫn có thể gọi tay thêm bất kỳ lúc nào. Khi chạy theo lịch (không
  có ai đang chat), chỉ gửi 1 dòng Telegram khi có case mới (chốt 17/11/2026, mục 6 ở CƠ CHẾ CHUẨN; khung cũ dài: Telegram qua [reference_telegram_bot](../daily-warehouse-report/references/reference_telegram_bot.md),
  cùng bot với [daily-warehouse-report](../daily-warehouse-report/SKILL.md)).
- Inbox: ngoài phạm vi skill này. Riêng case khách báo **giao thiếu hàng**
  trong inbox do [resend-missing-item](../resend-missing-item/SKILL.md) quét 15 phút/lần, không phải skill
  này.
- **Date window:** unless the shop owner says otherwise, only act on
  cases from the last 2 days (chốt 2026-10-07) — older backlog exists (can be
  weeks deep) but isn't this skill's job unless asked.

## Hard rules

1. **Claude's job stops at first contact.** Send the opening message, then
   report. Never apply policy, never propose a resolution (%, đổi hàng,
   etc), never wait for or chase a reply — that's the shop owner's job from
   there.
   - **Ngoại lệ DUY NHẤT (chốt 29/10/2026):** với đánh giá xấu đã nhắn, được
     phép **mở lại thread để ĐỌC** xem khách đã trả lời chưa, nhưng chỉ sau
     mốc 12h và chỉ để **báo chủ shop** (bật cờ `lien_he_khach` trên Sổ Vận
     Hành). Vẫn tuyệt đối **không nhắn lại khách lần 2**. Chi tiết ở mục
     "Theo dõi 12h cho đánh giá xấu".
2. **Anything refund-related → always the shop owner's call**, no matter
   how small. Never click "Chấp nhận bưu kiện trả hàng" or "Kháng nghị" on
   the return-management page — those buttons are refund/dispute actions,
   off-limits regardless of how routine they look (most returns here are
   platform-auto-approved already, which doesn't change this rule).
3. **Before messaging, check whether the thread already has a reply.** If
   the shop owner (or anyone) already exchanged messages with this
   customer about this case, **skip it — don't message again**, it's
   already being handled. Only message genuinely untouched threads (the
   system's auto shipping-tracking card with no human reply yet counts as
   untouched).
4. A case where the **customer is disputing something** (e.g. "mình chưa
   nhận được tiền" after an auto-refund) is not a first-contact case — it's
   a live dispute. Don't reply to it yourself; flag it to the shop owner in
   the report instead.

## ⭐ CƠ CHẾ CHUẨN (chốt 17/11/2026 — ĐỌC TRƯỚC, thắng mọi đoạn cũ bên dưới nếu mâu thuẫn)

Chủ shop làm lại cơ chế vì Sổ Vận Hành báo "Hôm nay 0" trong khi job đã chết từ
10/11 (xem "Chỉ chạy ở MỘT nơi" cuối mục này). Mục tiêu 2 việc:

### A. Trả hàng — quét TẤT CẢ yêu cầu trả hàng, chia 2 nhóm

Với mỗi yêu cầu **trả hàng/hoàn tiền** (cả TikTok lẫn Shopee) trong cửa sổ:

| Nhóm | Là gì | Nhắn khách |
|---|---|---|
| **1 — lý do ẢNH HƯỞNG shop** | TikTok: thẻ KHÔNG có badge "Không phải lỗi người bán". Shopee: lý do ⚠️ trong [bảng phân loại](../../shared/reference_return_reason_fault_classification.md) | **2 tin liên tiếp:** (1) dòng 35/36 nhờ đổi lý do sang lý do có lợi shop; (2) dòng 25 hỏi lý do thật để shop cải thiện |
| **2 — lý do KHÔNG ảnh hưởng shop** | TikTok: có badge xanh. Shopee: lý do ✅ | **1 tin:** dòng 25 (hỏi lý do để cải thiện) |

- **Ngoại lệ (chốt 19/11/2026):** nếu nội dung thật là giao thiếu/giao nhầm/hàng lỗi thì
  gửi Tin 3 thay Tin 2 — xem mục B2 ngay dưới.
- Đơn **huỷ trước khi lấy hàng / giao không thành công / hoàn do không giao được**
  không phải khách yêu cầu trả hàng → chỉ ghi sổ, không nhắn, không báo.
- Hard rule 3 giữ nguyên (thread đã có người nhắn → không nhắn thêm), nhưng
  **việc BÁO SỔ bên dưới vẫn làm đủ**, không phụ thuộc có nhắn hay không.

**Báo lên Sổ Vận Hành** (`needs_action = true`, luôn kèm `order_code` + `action_note`
1 câu nêu lý do + chi tiết khách nói) cho 2 loại:
1. Nhóm 1 → `action_type = 'tra_hang_anh_huong_shop'`.
2. Nhóm 2 nhưng **lý do chi tiết** (ô "Nhận xét của khách hàng", lý do phụ, hoặc
   nội dung chat nếu đã có sẵn) nói tới **sản phẩm** (lỗi, tuột chỉ, vải, màu/mẫu
   không giống hình, form lệch...) hoặc **dịch vụ kho vận** (giao chậm, đóng gói
   móp/ướt, giao nhầm/thiếu, shipper) → `action_type = 'tra_hang_noi_dung_sp_kho'`.
Một case thuộc cả hai → dùng loại 1, ghi phần chi tiết sản phẩm/kho vận vào
`action_note`. Nhóm 2 thuần "đổi ý / đặt sai size / không thích" → KHÔNG báo.
Mục 4 (đề xuất ghi Sổ Kho `shop_error_kind`) vẫn làm cho mọi case như cũ.

### B. Đánh giá — mọi sao đều đọc, báo theo 2 trường hợp

Quét **tất cả** đánh giá mới trong cửa sổ (không chỉ hàng chờ 1–3★), mọi dòng ghi
`cskh_reviews`, **bắt buộc có `order_code`** (mở chi tiết đánh giá để lấy mã đơn):
1. **1–3★** → nhắn mẫu dòng 24 trong chat riêng (nếu thread untouched, KHÔNG phản
   hồi công khai) và **báo sổ ngay**: `needs_action = true`,
   `action_type = 'danh_gia_xau'`, `action_note` = ý chính khách phàn nàn.
   **Không còn đợi mốc 12h** (chốt 17/11, thay cho quy tắc 29/10 "qua 12h khách
   im mới báo") — chủ shop muốn thấy mọi đánh giá 1–3★ kèm mã đơn để tự xử lý.
2. **4–5★ nhưng nội dung nói về vấn đề sản phẩm hoặc kho vận** (kể cả khen kèm
   chê: "đẹp nhưng chỉ thừa", "giao hơi lâu", "đóng gói sơ sài") → `needs_action = true`,
   `action_type = 'danh_gia_van_de'`, không nhắn khách. Chỉ bấm sao / khen thuần
   → không báo.

**Theo dõi "khách chưa phản hồi" (chốt 21/11/2026, mốc 4 giờ — chỉ cho đánh giá 1–3★ và giao thiếu):**
đánh giá 1–3★ đã nhắn khách thì ghi `messaged_at` đúng giờ gửi; web tự hiện "đã nhắn lúc X, khách chưa phản hồi sau N giờ"
khi ≥ 4 giờ. Khi lượt CSKH inbox thấy khách trả lời tin đó, nó thêm "khách đã phản hồi HH:MM" vào `message_note`. KHÔNG nhắn
khách lần 2, KHÔNG Telegram. **Trả hàng thường chỉ nhắn 1 lần, không theo dõi.** Giao thiếu thiếu thông tin: xem
[resend-collect-verify](../resend-missing-item/references/resend-collect-verify.md) mục 1e.

### B2. Khiếu nại thực chất: giao thiếu / giao nhầm / hàng lỗi (chốt 19/11/2026)

Chủ shop chốt luồng cho khách phàn nàn 3 loại này qua **trả hàng hoặc đánh giá 1–3★**
(mind-map 19/11; web tab "Hậu mãi" đọc theo [hau-mai-so-van-hanh](../../shared/hau-mai-so-van-hanh.md)).

**Nhận định KHÁCH QUAN, không theo từ khoá hay tên lý do khách chọn.** Đọc toàn bộ: lý do
chính + lý do phụ + ô "Nhận xét của khách hàng" + tin nhắn khách đã có + nội dung đánh giá
+ ảnh đính kèm, rồi tự kết luận khách thực sự đang nói gì: `giao_thieu` / `giao_nham` /
`san_pham_loi` (định nghĩa ở mục 4.1) hay không phải ba loại này. Khách chọn lý do "Đổi ý"
nhưng ghi "shop gửi nhầm màu" → vẫn là `giao_nham`. Khách chọn "Hàng lỗi" nhưng nội dung chỉ
chê size → KHÔNG phải. Không chắc → coi là không phải, ghi `action_note` để chủ shop xem.

**Các bước (mỗi đơn đúng 1 lần, thread chưa có người nhắn — Hard rule 3):**

1. Trả hàng **nhóm 1** (lý do ảnh hưởng shop) → gửi **Tin 1** nhờ đổi lý do trước
   ([mau-tin-nhan-tra-hang](../../shared/mau-tin-nhan-tra-hang.md), theo sàn).
2. Gửi **Tin 3a** (liên hệ hỗ trợ) rồi **Tin 3b** (xin bằng chứng) — cũng ở file mẫu đó.
   **Tin 3 THAY Tin 2 (dòng 25) và THAY dòng 24 của đánh giá xấu** — không gửi cả hai.
   Không phải 3 loại trên → giữ cách cũ (Tin 2 / dòng 24).
3. Đánh giá **4–5★** nói về giao thiếu/nhầm/lỗi: KHÔNG nhắn (như mục B.2), chỉ báo sổ.
4. Ghi sổ — **một dòng cho mỗi đơn**, ghi `shop_error_kind`:
   - `giao_thieu` → mở dòng `resend_cases` `status=collecting` theo
     [resend-collect-verify](../resend-missing-item/references/resend-collect-verify.md) mục 1
     (kiểm trùng trước), đặt `msg_photo_at` nếu đã gửi 3b. Từ đây **luồng gửi bù cũ lo hết**
     (thu thập → xác minh → anh duyệt 2 lần trên web → tạo đơn 15h). Dòng cskh để
     `errlog_status='owned_resend'`, web tự ẩn khi đã có phiếu.
   - `giao_nham` / `san_pham_loi` → dòng cskh có `shop_error_kind`, **`errlog_code` (mã vận
     đơn)** theo mục 4.2, `errlog_status='suggest'`, `action_type='khieu_nai_cho_bang_chung'`,
     `action_note` = đã nhắn xin bằng chứng lúc HH:MM, chờ khách. Để `needs_action=false`
     cho tới khi một trong hai xảy ra:
     (a) khách gửi bằng chứng — **lượt CSKH inbox** bật `needs_action=true`
     ([size-consultation cskh-faq mục 13](../size-consultation/references/cskh-faq-17-11.md));
     (b) **quá 24h khách im** — lượt review-return-check kế tiếp (đã đọc dòng 3 ngày gần
     nhất ở mục C) bật `needs_action=true`, `action_note` thêm "khách chưa gửi bằng chứng sau 24h".
   **Ngoại lệ — không nhắn được** (không mở được thread chat, vd tên khách bị che nên không
   tìm ra hội thoại; Chrome bị chặn): sẽ không có bằng chứng nào gửi về, nên bật
   `needs_action=true` NGAY, `action_note` = "chưa nhắn được khách: <lý do>, anh nhắn tay".
   Giao thiếu không nhắn được thì cũng đừng mở phiếu `collecting` rỗng — flag `needs_action=true`
   như trên để anh thấy thẻ cảnh báo.
   Thẻ lên Sổ Vận Hành đúng lúc anh có thể xử lý, không sớm hơn.
5. **Không** tự đề xuất % hoàn, không hứa đổi/hoàn, không tự ghi Sổ Kho (việc của anh).
   Mức Nhẹ/Vừa/Nặng là của CSKH inbox (mục 13), không làm ở đây.

**Bàn giao với CSKH inbox:** khách trả lời tin 3b trong chat → lượt CSKH inbox nhặt tiếp
(giao thiếu → resend-collect-verify; nhầm/lỗi → mục 13: xác nhận lỗi, báo Telegram, bật
`needs_action`). Vì vậy review-return-check KHÔNG nhắn tin thứ hai sau 3b, KHÔNG báo
Telegram riêng cho loại này (chỉ tin 1 dòng "Có K case mới" ở mục C.6 khi dòng bật `needs_action`).

### C. Chạy 2 lần/ngày sao cho rẻ + bền

1. **Bước đầu duy nhất trước khi mở sàn:** 1 lệnh curl lấy `cskh_returns` +
   `cskh_reviews` 3 ngày gần nhất (`dedup_key,messaged_at,needs_action,acked_at`).
   Case đã có dòng và đã xử lý thì **không mở lại thread, không đọc lại** —
   khoản tiết kiệm token lớn nhất.
2. Đọc danh sách bằng `get_page_text` 1 lần/trang, dừng ngay khi gặp case quá cửa sổ.
3. **Bỏ hẳn bước "mở lại thread sau 12h để đọc"** (mục cũ bên dưới đã gạch).
4. Telegram chỉ 1 dòng khi có case mới (xem mục 6 ngay dưới).
5. Bị chặn (Chrome mất đăng nhập, captcha, hết quyền) → vẫn ghi những gì đọc
   được, rồi ghi `status=blocked` + lý do vào nhật ký lượt chạy (mục 7).

6. **Telegram ĐƠN GIẢN (chốt 17/11/2026, thay cho "bỏ hẳn Telegram" cùng ngày):** chủ shop chỉ cần
   biết **có case mới**, chi tiết xem trên Sổ Vận Hành. Cuối lượt, nếu có dòng **MỚI bật
   `needs_action = true` trong lượt này** (không tính dòng đã flag từ trước) → gửi **đúng 1 tin 1 dòng**:
   `Có <K> case mới cần anh xem trên Sổ Vận Hành.`
   K = số dòng mới flag (trả hàng + đánh giá). Không liệt kê đơn, không tiêu đề, không emoji,
   không báo số liệu. **K = 0 → KHÔNG gửi gì.** Bị chặn (mất đăng nhập/captcha) → chỉ ghi
   `status=blocked` vào nhật ký (mục 7), không Telegram. Bot/chat_id:
   [reference_telegram_bot](../daily-warehouse-report/references/reference_telegram_bot.md).
7. **Dòng nhật ký lượt chạy — BẮT BUỘC, làm ở bước cuối mọi lượt (kể cả không có
   gì mới, kể cả bị chặn):** POST 1 dòng vào `cskh_run_log` (cùng URL/key Supabase
   như mục 3) để web hiện "Cập nhật lúc …":
   `{"status":"ok"|"blocked","note":"<ngắn, vd Shopee bị chặn: Chrome mất đăng nhập>","n_reviews":N,"n_returns":M,"n_flagged":K}`
   (`ran_at` tự điền). `blocked` khi có sàn không đọc được. POST lỗi (bảng chưa
   tạo) thì bỏ qua, không dừng lượt chạy.

### ⚠️ Chỉ chạy ở MỘT nơi (chốt 17/11/2026)

Nguồn chạy duy nhất: **task của app Claude Desktop `review-return-check-twice-daily`**
(08:00 & 20:00). **Windows Task Scheduler `Claude - Check danh gia tra hang`
(gọi `claude -p` qua `run-job.ps1`) phải TẮT** — nó chết liên tục: 5–6/11 "org đã
tắt quyền subscription cho Claude Code", 7/11 Chrome Shopee mất đăng nhập, 9/11
hết quota tuần, **10–16/11 "OAuth session expired" 14/14 lượt thất bại**, Sổ Vận
Hành không có dữ liệu mới từ 9/11. Bật cả hai cùng lúc = khách bị nhắn 2 lần.
`scripts/setup-review-return-task.ps1` đã vô hiệu (không tạo lại task đó).

**Task phải ở chế độ quyền Auto (nguyên nhân thật của lỗi kẹt Chrome 17–22/11/2026):**
log app ghi `Not auto-approving "browser:navigate" in scheduled task "review-return-check-twice-daily":
browser/computer sentinel permissions require a live card` — task này chạy ở chế độ **Default**
nên mọi thao tác Chrome chờ người bấm duyệt, quá 5 phút thì huỷ ("run looks unattended").
Các task `cskh-inbox-*` chạy chế độ **Auto** nên chưa lần nào bị. Cách sửa: trong app Claude
Desktop → Scheduled → task này → đổi Permission mode sang **Auto** (chỉ chủ shop đổi được trên
PC; tạo task từ phiên điều khiển từ xa thì app không lưu mode). Gặp lại lỗi này → kiểm mode trước,
đừng thử lại nhiều lần.

## Quick reference

**Message templates** — Google Sheet "Chính sách xử lý lỗi SP, DV"
(id `1X08EPdWfJeiP4aQGzcA35UGtmTjzbUYcC0jidU-05WE`), tab **"Mau tin nhan"**.
Read the live rows before sending — don't paraphrase from memory, the shop
owner edits these. As of 2026-10-07:
- Row 24 ("Nhắn khách đánh giá xấu") — gửi qua **tin nhắn chat riêng** cho
  khách đánh giá xấu, KHÔNG đăng làm phản hồi công khai dưới đánh giá.
- Row 25 (same loại, Tình huống "Nhắn khách trả hàng") — dùng cho case **KHÔNG
  phải lỗi shop** (xem phân loại ngay dưới) — opener trung lập, chỉ hỏi lý do,
  không mời đổi gì cả.
- Row 35/36 (Tình huống "Nhắn khách đổi lý do trả hàng (case lỗi shop)", cột
  Sàn tách riêng TikTok Shop / Shopee — **2 tên lý do khác nhau, đừng lấy
  nhầm**) — dùng cho case **lỗi shop** (xem ngay dưới). Đọc đúng dòng theo
  platform của case đang xử lý.

### Khuyến khích đổi lý do trả hàng — CHỈ với case lỗi shop (chốt 29–30/10/2026)

Chủ shop chốt: **ưu tiên chỉ số shop + không mất phí ship hoàn hơn thu thập
insight chính xác**, nhưng **chỉ áp dụng cho case thật sự là lỗi shop**
(chốt lại 30/10/2026, thu hẹp từ quyết định ban đầu 29/10 là mời mọi case) —
case khách tự đổi ý/tự chọn sai size thì sàn vốn đã không tính lỗi shop,
không có gì để "nhờ đổi".

**Phân loại lỗi shop dùng bảng có sẵn**
[reference_return_reason_fault_classification](../../shared/reference_return_reason_fault_classification.md)
— tái dùng đúng logic `shop_error_kind` ở mục 4.1 bên dưới (đọc nội dung
lý do/mô tả trên thẻ trả hàng, đừng đoán): case ra `giao_nham` / `giao_thieu`
/ `san_pham_loi` → lỗi shop, mời đổi lý do. Case `null` (đổi ý, tự chọn sai
size...) → không mời, dùng row 25 bình thường.

Vì lý do hiển thị trên thẻ trả hàng đọc được **ngay khi mở case**, việc phân
loại + chọn đúng template làm được **ngay trong 1 lượt mở thread**.

**Ngoại lệ Hard rule 1 (chốt 12/11/2026):** case lỗi shop gửi **2 tin nhắn
liên tiếp trong cùng 1 lượt mở thread** — không phải 2 lượt khác nhau, không
cần chờ khách trả lời giữa 2 tin.

1. Đọc lý do trên thẻ trả hàng → tra bảng phân loại → xác định lỗi shop hay
   không.
2. **Lỗi shop** → mở thread, nếu untouched (Hard rule 3):
   - Gửi tin 1: dòng 35 (TikTok) hoặc 36 (Shopee) — nhờ đổi lý do. Tên lý do
     **khác nhau theo sàn**, đọc nguyên văn từ Sheet:
     - TikTok Shop: mời đổi sang **"Đổi ý"**.
     - Shopee: mời đổi sang **"Đổi ý (Sản phẩm còn nguyên tem, nhãn mác, bao bì)"** (chốt 19/11/2026, thay tên cũ "Hàng nguyên vẹn nhưng không còn nhu cầu").
   - Gửi tin 2 (ngay sau): dòng 25 — hỏi lý do thật để shop cải thiện.
3. **Không phải lỗi shop** → gửi **1 tin duy nhất**: dòng 25 (hỏi lý do, trung
   lập, không mời đổi gì).
4. **Insight/errlog vẫn phân loại theo nội dung thật**, không theo lý do khách
   chọn trên sàn — mục 4 (`shop_error_kind`) không đổi dù khách đổi lý do hiển
   thị sang "đổi ý".

**TikTok Shop Seller Center** — dùng **Claude in Chrome** ([reference_chrome_browsers](../../shared/reference_chrome_browsers.md))
deviceId TikTok, KHÔNG dùng built-in browser:
- Reviews: `https://seller-vn.tiktok.com/product/rating?shop_region=VN`
  → "Trả lời bài đánh giá" panel → "Đánh giá tiêu cực" (1-2★) / "Đánh giá
  trung lập" (3★), each with a "Trả lời ngay" link → opens the pending-reply
  list for that star range, newest first. No single "all reviews, newest
  across every star" view found — positive (4-5★) reviews aren't in a
  pending-reply queue, so there's nothing actionable to check there anyway.
  Dates shown per review — the pending queues can be weeks/months deep, so
  always check the date, don't assume the top entries are from today.
- Returns: `https://seller-vn.tiktok.com/order/return?order_sort_comp=OrderSort_UPADTE_TIME_DESC&sub_tab_pending=sub_tab_pending_all&tab=800`
  (tab "Đang chờ bạn") — each card shows lý do, ngày, số tiền, and whether
  it's platform auto-approved. `get_page_text` dumps the whole list cleanly
  in one call, faster than reading cards one by one.
- **To message a specific return case's customer:** click the small
  chat-bubble icon right next to the buyer's username on their return
  card (not the row's expand chevron) — opens/creates the chat thread tied
  to that exact order in a new tab. If the thread shows only the system's
  auto "đang trên đường giao / đã giao" tracking card with no human
  message yet, it's untouched — safe to send the template (Hard rule 3).

**Shopee** — equivalent flows exist in Kênh Người Bán (`banhang.shopee.vn`)
but haven't been walked through yet in this skill; same hard rules apply
when you do.

### Shopee — luồng ĐÁNH GIÁ ĐÃ DỰNG (chốt 19/11/2026, kiểm trên Chrome thật)

**Shopee BẮT BUỘC phải quét mỗi lượt, không được bỏ** (chủ shop nhắc 19/11). Dùng Chrome
Shopee (deviceId ở [reference_chrome_browsers](../../shared/reference_chrome_browsers.md)),
nhớ `select_browser` ngay trước mỗi thao tác Shopee.

1. **Trang đánh giá:** `https://banhang.shopee.vn/portal/settings/shop/rating`
   (menu: Chăm sóc khách hàng → Quản lý đánh giá). Mới nhất lên đầu, có cột ngày giờ.
2. **Lọc theo sao bằng URL** (đừng click ô chọn, từng click trượt tọa độ):
   `.../rating?pageNumber=1&fromPageNumber=1&cursor=0&pageSize=20&replied=ALL&ratingStar=3&ratingStar=2&ratingStar=1`
   → chỉ 1–3★. Đổi `ratingStar=5&ratingStar=4` để xem 4–5★. `replied=ALL` (xem cả đã
   trả lời) hoặc bỏ để lọc theo trạng thái.
3. **Đọc bằng `javascript_tool`**, bỏ dòng "Phân loại:" và "[Hàng..." vì rất dài:
   `document.body.innerText` rồi cắt từ chữ "Đặt lại". Mỗi đánh giá có: handle khách,
   **ID đơn hàng**, nội dung, "Sản phẩm: <nhãn khách chọn, vd Sản phẩm chất lượng kém>",
   giờ đánh giá, và "Seller Response" nếu shop đã trả lời. **Văn bản KHÔNG chứa số sao** —
   số sao chỉ biết nhờ bộ lọc ở bước 2.
4. **Cửa sổ ngày:** đánh giá 1–3★ trên Shopee ít (1 cái/tuần), danh sách sắp theo ngày
   nên chỉ cần nhìn vài dòng đầu; nếu cái mới nhất đã ngoài cửa sổ thì ghi "không có mới".
5. Đánh giá 1–3★ mới trong cửa sổ → nhắn mẫu dòng 24 qua chat Shopee (cùng cách mở chat
   như đơn trả hàng bên dưới), ghi `cskh_reviews` + `needs_action`; "Seller Response" có
   sẵn mẫu dòng 24 nghĩa là shop đã nhắn rồi, đừng nhắn lại.
6. Luôn ghi 1 dòng `cskh_run_log` kể cả khi không có gì mới, ghi rõ đã quét cả TikTok
   lẫn Shopee, để lượt sau biết đã kiểm đến đâu.

### Shopee — luồng trả hàng ĐÃ DỰNG (chốt 17/11/2026, kiểm trên Chrome thật)

Thay cho TODO 30/10. Dùng Chrome Shopee (deviceId trong
[reference_chrome_browsers](../../shared/reference_chrome_browsers.md)), KHÔNG built-in browser.

1. **Danh sách:** `https://banhang.shopee.vn/portal/sale/returnrefundcancel` → bấm
   tab **"Đơn Trả hàng Hoàn tiền (N)"** (3 tab kia là Tất cả / Đơn Hủy / Giao không
   thành công — hủy & giao không thành công KHÔNG phải yêu cầu trả hàng, chỉ ghi
   sổ). Đọc bằng `javascript_tool` (get_page_text chỉ trả 1 phần): mỗi dòng có
   buyer, **Mã đơn hàng**, **Mã yêu cầu trả hàng**, số tiền, **Lý do**, Trạng thái.
   Đếm "1749 yêu cầu" ở đầu là tổng cả bộ lọc — chỉ lấy các dòng đầu trong cửa sổ ngày.
2. **Id số của case:** mỗi dòng là 1 link `…/portal/sale/return/<id số>` →
   lưu `id số` vào cột **`detail_ref`** của `cskh_returns` (web dùng để mở đúng case).
   ⚠ `/portal/sale/order/<mã chữ>` KHÔNG hoạt động (404) — đừng dùng.
3. **Mở chi tiết** (`…/portal/sale/return/<id>`): đọc lý do, **ảnh/ghi chú khách gửi kèm**,
   trạng thái vận chuyển hàng hoàn. Chi tiết này là bằng chứng để xếp nhóm
   (đừng chỉ tin tên lý do).
4. **Mở chat:** bấm nút **"Chat với người mua"** trên trang chi tiết → cửa sổ chat nổi
   gắn đúng đơn trả hàng. **Thread "untouched" (Hard rule 3)** = chỉ có dòng hệ thống
   "sometimeofficial:main đã tham gia cuộc trò chuyện" + thẻ đơn hàng, chưa có tin
   của người (shop hay khách). Có tin người thật → bỏ qua nhắn (vẫn báo sổ).
5. **Gửi:** gõ vào ô "Nhập nội dung tin nhắn" rồi gửi, **đúng 2 tin (nhóm 1: dòng 36
   rồi 25) hoặc 1 tin (nhóm 2: dòng 25)**. Xong đóng cửa sổ chat.
6. **Phân nhóm lý do:** theo bảng chốt 17/11 trong
   [reference_return_reason_fault_classification](../../shared/reference_return_reason_fault_classification.md)
   (mục "BẢNG CHỐT"). **Hai sàn khác nhau:** TikTok dùng badge "Không phải lỗi người bán"
   (không ảnh hưởng: "Đổi ý", "Đặt sai kích cỡ"); Shopee không có badge, chỉ "Đổi ý (Sản phẩm còn nguyên tem, nhãn mác, bao bì)"
   (chốt 19/11/2026; tên cũ "Hàng nguyên vẹn nhưng không còn nhu cầu") là không ảnh hưởng, còn "Khác với mô tả" / "Người bán gửi sai hàng" /
   "Hàng lỗi" / "Thiếu hàng" là nhóm 1 — kể cả khi khách thực ra chỉ chê size. Lý do Shopee
   chưa có trong bảng → coi nhóm 1 và ghi sổ để chủ shop bổ sung. **Nội dung tin nhắn:
   dùng 2 bản tách riêng TikTok / Shopee trong [mau-tin-nhan-tra-hang](../../shared/mau-tin-nhan-tra-hang.md)**
   (nguyên văn, không viết lại).
7. Cột trạng thái: "Chờ bạn xác nhận hàng trả về" là case còn mở, có hạn phản hồi —
   **không bấm Khiếu nại / Hoàn tiền** (Hard rule 2).

## Steps

### 1. Reviews

1. Open the reviews pending-reply queues (negative + neutral, both links
   above).
2. For each, check the date — skip anything outside the window (default:
   last 2 days). **Từ 17/11/2026 đọc cả đánh giá 4–5★** (xem mục B ở đầu file):
   dùng danh sách đánh giá chung của sàn (TikTok: trang rating, tab tất cả/đã
   trả lời; Shopee: Đánh giá shop) chứ không chỉ hàng chờ trả lời. Nếu sàn không
   cho xem được mục nào thì ghi `status=blocked` + lý do vào cskh_run_log, đừng bỏ qua im lặng.
3. Với mỗi đánh giá xấu mới: **vào phần TIN NHẮN (chat) với khách đó và
   nhắn mẫu dòng 24** (chủ shop chốt 2026-10-13). **TUYỆT ĐỐI KHÔNG bấm
   "Phản hồi"/"Trả lời" công khai dưới đánh giá** — phản hồi công khai là
   việc của chủ shop. Thread chat đã có người trả lời rồi thì bỏ qua (Hard
   rule 3).
   **Cách mở chat khi tên khách bị che (chốt 19/11/2026, case Hoàng Đức Mạnh):**
   tên trong đánh giá là tên thật, còn hộp thư chỉ hiện handle (vd `mnh14926`) nên
   tìm theo tên/quét danh sách sẽ KHÔNG ra, đừng kết luận "khách chưa từng nhắn".
   Thay vào đó mở `https://seller-vn.tiktok.com/order/detail?order_no=<order_code>&shop_region=VN`,
   bấm biểu tượng chat nhỏ ở góc phải khung **"Chi tiết khách hàng"** (tooltip "Liên hệ với
   khách hàng này từ đây") → mở đúng thread của khách ở tab Trò chuyện (đây cũng là cách
   của đơn trả hàng). Thread chỉ có tin tự động (lời chào, xác nhận đơn, kho vận) thì coi
   là untouched, được nhắn.
4. Tally for the report: count of new reviews, and if any, the star
   breakdown + full verbatim text of negative ones and any positive ones
   with real insight (not just a star rating).

#### ~~Theo dõi 12h cho đánh giá xấu~~ — ĐÃ BỎ (17/11/2026)

Quy tắc cũ (29/10): nhắn mẫu 24 rồi chờ 12h, khách im mới báo. **Thay bằng:**
1–3★ báo sổ ngay (`danh_gia_xau`), không mở lại thread để đọc. Hard rule 1 không
còn cần ngoại lệ "mở lại thread để ĐỌC". Dòng cũ `lien_he_khach` còn trong DB vẫn
hiển thị bình thường trên web.

### 2. Trả hàng / hoàn tiền

1. Open the return-management "Đang chờ bạn" list, `get_page_text` it.
2. For each case within the date window: note mã đơn, buyer handle, lý do, ngày.
   Xác định lỗi shop hay không theo từng sàn — quyết định template gửi ở bước 3:
   - **TikTok:** kiểm tra thẻ có chứa text **"Không phải lỗi người bán"** không
     (badge xanh lá). Có → không phải lỗi shop. Không có → lỗi shop.
   - **Shopee:** đọc tên lý do, tra bảng
     [reference_return_reason_fault_classification](../../shared/reference_return_reason_fault_classification.md)
     mục "Bảng lý do chính xác từng sàn — Shopee".
3. Open its chat thread (bubble icon). If untouched (Hard rule 3), send:
   - **Lỗi shop** → gửi **2 tin liên tiếp trong cùng lượt mở thread**:
     - Tin 1: row 35 (TikTok) hoặc row 36 (Shopee) — nhờ đổi lý do.
     - Tin 2: row 25 — hỏi lý do thật để shop cải thiện.
   - **Không phải lỗi shop** → gửi **1 tin**: row 25 (hỏi lý do, trung lập).
   Đọc nguyên văn template từ Sheet, đừng paraphrase. If it already has a
   reply, or the customer is disputing something (Hard rule 4), skip — note
   it for the report instead of messaging.
4. Tally for the report: total new cases, lý do breakdown with counts, and
   any "Nhận xét của khách hàng" field value shown on the return card
   itself (a free-text comment the customer attaches to the return
   request on the platform — this is NOT the same thing as a chat
   message; don't confuse the two in the report).

## 3. Ghi vào Sổ Vận Hành (BẮT BUỘC, chốt 2026-10-28)

Từ 28/10/2026 báo cáo chính nằm trên **tab "Đánh giá & Trả hàng"** của Sổ Vận
Hành (`https://so-van-hanh-pwa.vercel.app`), Telegram rút còn 1 dòng cảnh báo.
Lý do chủ shop chốt: Telegram chỉ đọc 1 lần rồi trôi, không xem lại được theo
tuần/tháng, và không thấy được vấn đề nào đang lặp lại.

Sau khi check xong, **upsert từng đánh giá / từng case thành 1 dòng** vào 2
bảng Supabase `cskh_reviews` và `cskh_returns` (schema + ý nghĩa từng cột:
[scripts/cskh-tables.sql](../../../scripts/cskh-tables.sql) trong repo này; URL + anon key lấy y như
[scripts/sync_returns_feed.py](../../../scripts/sync_returns_feed.py) đang dùng).

```
POST {SUPABASE_URL}/rest/v1/cskh_reviews?on_conflict=dedup_key
Headers: apikey, Authorization: Bearer <anon key>, Content-Type: application/json,
         Prefer: resolution=merge-duplicates,return=minimal
```

**Hai lỗi đã gặp khi chạy thử 17/11/2026:** (1) khi POST nhiều dòng một lúc, mọi
dòng phải có CÙNG bộ khóa JSON (thiếu khóa → `PGRST102 All object keys must match`,
ghi 0 dòng) — điền `null` cho khóa không dùng; (2) trên PC Windows đừng đưa tiếng
Việt trực tiếp vào `curl -d '...'`, ghi JSON ra file UTF-8 rồi `--data-binary @file`
(không thì có thể bị 400).

Ghi **mọi** đánh giá/case gặp trong kỳ, không chỉ cái cần xử lý — phần tổng
hợp tuần/tháng cần đủ số. Lưu ý từng cột:

- `dedup_key`: `platform|order_code|ngày|40 ký tự đầu nội dung` (trả hàng:
  `platform|order_code|ngày`). Chạy lại 20:00 gặp đúng case của 08:00 thì ghi
  đè chính dòng đó, không nhân đôi.
- `needs_action` + `action_type` + `action_note` (chốt lại 17/11/2026, thay cho
  quy tắc 29/10). Bật `true` cho các loại sau — **luôn kèm `order_code`**:
  - `danh_gia_xau` — đánh giá 1–3★ (báo ngay, xem mục B).
  - `danh_gia_van_de` — đánh giá 4–5★ có nói về sản phẩm/kho vận (mục B).
  - `tra_hang_anh_huong_shop` — trả hàng nhóm 1 (mục A).
  - `tra_hang_noi_dung_sp_kho` — trả hàng nhóm 2 nhưng chi tiết nói sản phẩm/kho vận (mục A).
  - `tranh_chap` — khách đang tranh chấp/khiếu nại (Hard rule 4); `action_note` nêu khách đòi gì.
  - (`lien_he_khach` là loại cũ, không tạo mới nữa.)
  - Mọi trường hợp khác để `needs_action = false`, `action_type` null.
  - **Chạy lại gặp dòng cũ:** đã `acked_at` hoặc đã flag thì giữ nguyên, không hạ cờ, không bật lại.
- `insight_tag` + `insight_note`: **phần giá trị nhất, đừng bỏ.** Đọc nội dung
  rồi tự gắn 1 chủ đề dạng slug (`tuot-chi-cap`, `size-m-chat`,
  `giao-cham-cuoi-tuan`) cho những gì nói về chất lượng sản phẩm hoặc dịch vụ
  có thể sửa được; `insight_note` là tên hiển thị cho chủ đề đó, vd
  "Tuột chỉ cạp — Bộ dài Shin 02 size L". **Dùng lại đúng slug cũ** cho cùng
  một vấn đề, nếu không web sẽ đếm tách thành 2 nhóm. Đánh giá kiểu "ok shop",
  "giao nhanh" không có gì sửa được thì để trống.
- `messaged_at` + `message_note`: ghi lúc nhắn và nhắn mẫu nào ("đã nhắn mẫu
  dòng 24 lúc 14:40"), hoặc lý do bỏ qua ("thread đã có người trả lời"). Với
  bảng trả hàng, case lỗi shop đã mời đổi lý do → ghi rõ "đã mời đổi lý do
  (dòng 35/36)" + nếu đọc được phản hồi của khách thì thêm luôn ("khách đồng
  ý đổi" / "khách từ chối, khẳng định lỗi thật" / "khách báo không có lựa
  chọn đó").
- `customer_note` (bảng trả hàng) chỉ dành cho ô "Nhận xét của khách hàng"
  trên thẻ trả hàng — KHÔNG phải tin nhắn chat, đừng trộn 2 thứ.

Nếu POST lỗi (bảng chưa tạo, mất mạng): vẫn gửi Telegram như dưới, thêm vào
dòng `Lưu ý:` là chưa ghi được lên Sổ Vận Hành.

### Chạy bù ngược (backfill) — khi chủ shop bảo "chạy bù N ngày"

Bảng chỉ có dữ liệu từ lượt chạy đầu tiên trở đi, nên lúc mới bật tab (hoặc sau
một đợt nghỉ dài) chủ shop có thể yêu cầu lấp lại quá khứ. Khác lượt chạy
thường ở đúng mấy điểm sau — **sai mấy điểm này là khách cũ bị nhắn lại**:

1. **TUYỆT ĐỐI KHÔNG nhắn khách**, không mở thread chat, không gửi Telegram.
   Chỉ đọc danh sách và ghi vào Supabase.
2. Bỏ cửa sổ 2 ngày, lấy theo số ngày chủ shop yêu cầu (mặc định 7).
3. `messaged_at` để trống, `message_note` ghi `chạy bù ngược <ngày>, không nhắn khách`.
4. `needs_action`: chỉ bật `true` nếu **đến giờ vẫn còn treo thật** — đánh giá
   1–2★ còn nằm trong hàng chờ trả lời, hoặc case trả hàng còn ở tab "Đang chờ
   bạn". Việc cũ đã xong rồi thì để `false`, đừng dựng lại việc chủ shop đã làm.
   Khi bật `true`: đánh giá xấu còn treo → `action_type = 'lien_he_khach'`;
   case tranh chấp → `'tranh_chap'`. (Backfill không nhắn khách nên không tính
   mốc 12h — cứ coi đánh giá xấu còn treo là cần chủ shop liên hệ.)
5. `insight_tag` vẫn gắn bình thường — đây chính là thứ làm cho phần Insight có
   số liệu ngay thay vì đợi cả tháng.
6. Báo lại trong chat: lấp được bao nhiêu dòng, từ ngày nào tới ngày nào, và
   phần nào sàn không cho lấy lại.

**Hạn chế phải nói trước với chủ shop:** đánh giá 4–5★ cũ gần như không lấy lại
được (sàn chỉ giữ hàng chờ trả lời của 1–3★), nên tỷ lệ sao của kỳ chạy bù sẽ
xấu hơn thực tế. Nói rõ điều này khi báo cáo, đừng để chủ shop tưởng shop vừa
tụt đánh giá.

## 4. Đề xuất ghi lỗi sang Sổ Kho (chốt 29/10/2026)

Chủ shop muốn: từ trả hàng + đánh giá, phát hiện case **lỗi do shop** (giao
nhầm, giao thiếu, lỗi sản phẩm) rồi ghi vào Sổ Kho mục "Thống kê lỗi"
(`warehouse_error_log`) để tính % lỗi NV/NCC. **Nhưng ghi sai là tăng nhầm %
của người ta**, nên cơ chế là: **skill CHỈ ĐỀ XUẤT, chủ shop bấm nút "Xác nhận
ghi Sổ Kho" trên tab Sổ Vận Hành mới thật sự insert.** Skill **TUYỆT ĐỐI
không tự insert** `warehouse_error_log`.

**Làm với TOÀN BỘ case, kể cả case tranh chấp/chạy bù (chốt 30/10/2026 sau khi
phát hiện lỗ hổng thật):** đơn 586807062686958970 (action_type='tranh_chap',
từ 1 lượt chạy bù 28/10) có lý do "Gửi sai sản phẩm" + action_note ghi rõ
"nhân viên đã nhận lỗi đóng nhầm trong chat" — rõ ràng là `giao_nham` — nhưng
lượt chạy đó để trống `shop_error_kind`/`errlog_status` luôn, khiến Sổ Kho đã
có sẵn dòng lỗi (#24, do Giáp) mà bên này không biết để đối chiếu, khối "Ghi
lỗi vào Sổ Kho" trên web cũng không hiện case này. Đã vá tay dòng đó
(`errlog_status='dup'`, trỏ `errlog_id=24`). **Từ nay: mục 4 là bước BẮT BUỘC
cho MỌI case**, không được bỏ qua chỉ vì case đó rơi vào nhóm tranh chấp (Hard
rule 4) hoặc đang chạy bù ngược — việc "chờ chủ shop quyết" chỉ áp dụng cho
quyết định xử lý khách (bồi thường, đổi trả), không áp dụng cho việc phân loại
lỗi để đối chiếu Sổ Kho, đây là 2 việc khác nhau.

Với mỗi case trả hàng / đánh giá, sau khi đã upsert dòng cskh (mục 3), xét thêm
và điền các cột `shop_error_kind` / `errlog_code` / `errlog_reason` /
`errlog_status`:

**Chốt 22/11/2026 (tối) — chủ shop tự quyết loại lỗi trên Sổ Vận Hành.** Mọi thẻ trả hàng / đánh giá trên tab Hậu mãi
giờ có sẵn 2 nút `Ghi Sổ Kho: lỗi kho` / `lỗi sản phẩm` để chủ shop tự chọn sau khi tự xác minh. Vì vậy: chỉ đặt
`errlog_status='suggest'` khi CÓ BẰNG CHỨNG (ảnh/video hoặc khách mô tả cụ thể); lý do sàn kiểu "Chất lượng kém", "Khác với
mô tả" mà không ảnh, không chi tiết thì để `shop_error_kind=null`, `errlog_status='none'` — KHÔNG tự quy lỗi. Và **luôn ghi
`messaged_at` khi đã nhắn khách** (thẻ trả hàng ảnh hưởng shop chỉ tự ẩn sau khi đã nhắn khách 3 ngày). Chi tiết:
[hau-mai-so-van-hanh.md](../../shared/hau-mai-so-van-hanh.md).

### 4.1 Phân loại `shop_error_kind` (đọc lý do/nội dung, đừng đoán)

- **Lỗi shop** → gắn kind tương ứng:
  - `giao_thieu` — khách báo thiếu hàng trong đơn.
  - `giao_nham` — shop gửi sai mẫu/sai sản phẩm/sai size so với đơn đặt.
  - `san_pham_loi` — hàng lỗi/rách/bẩn/tuột chỉ/hỏng/kém chất lượng từ xưởng.
- **KHÔNG phải lỗi shop** → `shop_error_kind = null`, `errlog_status = 'none'`:
  khách đổi ý, không thích, tự đặt sai size/màu, "mặc không hợp", hoàn tiền vì
  đổi quyết định... và **khách tráo hàng/trả hàng không phải của shop** (cái đó
  là lỗi KHÁCH, do skill [return-item-not-shop-product](../return-item-not-shop-product/SKILL.md) ghi ở bảng
  `warehouse_return_checks`, KHÔNG phải bảng này).

### 4.2 Chống trùng — làm đúng, nếu không % lỗi NV/NCC bị thổi phồng

1. **`giao_thieu` → KHÔNG đề xuất nút.** Đặt `errlog_status = 'owned_resend'`.
   Giao thiếu do skill [resend-missing-item](../resend-missing-item/SKILL.md) độc quyền (nó tự tạo đơn gửi
   bù + tự ghi `warehouse_error_log`). Mình chỉ hiện cho chủ shop biết, không
   mở nút ghi để khỏi ghi 2 lần.
2. **`giao_nham` / `san_pham_loi`:** phải lấy **mã vận đơn gốc** rồi dò trùng. **BẮT BUỘC
   điền `errlog_code` + `shop_error_kind` ngay lúc ghi dòng** (19/11/2026 rà dữ liệu thấy
   nhiều dòng `suggest` thiếu mã, vd Shopee 2611112GTMGHSY, 26110176GE13NH → web không dựng
   được nút Ghi Sổ Kho). Dòng cũ còn thiếu mã: lượt chạy này bổ sung luôn (PATCH).
   - **Lấy `errlog_code` (mã vận đơn):** trả hàng → cột `outbound_tracking`
     của đúng dòng trong `platform_returns_feed` (match theo `order_name` =
     mã đơn + `platform`). Đánh giá (không có phiếu trả) → tra bằng
     [order_to_tracking.sh](../resend-missing-item/scripts/order_to_tracking.sh) từ `order_code`. Không ra mã vận đơn
     → vẫn `errlog_status = 'suggest'` nhưng để `errlog_code` trống (web sẽ
     hiện "thiếu mã vận đơn — anh kiểm tay", không cho bấm ghi).
   - **Dò trùng:** `GET warehouse_error_log?code=eq.<errlog_code>&select=id&limit=1`.
     Có rồi → `errlog_status = 'dup'`, `errlog_id` = id dòng cũ (đừng đề xuất
     ghi nữa). Dò theo mã vận đơn là bắt được cả dòng do resend và dòng ghi
     tay trước đó, vì tất cả đều khoá theo mã vận đơn gốc.
   - Chưa có → `errlog_status = 'suggest'`, `errlog_reason` = 1 câu mô tả
     ngắn (khách đặt gì / lỗi gì), đúng kiểu dòng `reason` mẫu đang có trong
     bảng (không dấu cũng được, ngắn gọn).
3. **Chủ shop có thể bấm "Không phải lỗi shop — bỏ qua" (17/11/2026)** → `errlog_status = 'dismissed'`.
   Giữ nguyên `dismissed` y như `written`/`dup` — KHÔNG dựng lại nút. Đây là bước công bằng cho nhân viên/NCC:
   chỉ ghi Sổ Kho khi anh đã xem bằng chứng và xác nhận.
4. **Chỉ ghi 1 lần:** lượt chạy sau gặp lại dòng (dedup_key) mà `errlog_status`
   đã là `written`/`dup`/`owned_resend` thì **giữ nguyên**, đừng hạ về
   `suggest` (không dựng lại nút chủ shop đã xử lý).

### 4.2b Nguồn thứ 3: CHAT (chốt 17/11/2026)

Ngoài trả hàng + đánh giá (do skill này ghi), lỗi còn được nhận diện **qua chat khách** bởi lượt CSKH
inbox → bảng `cskh_chat_errors` (xem mục 9 trong `size-consultation/references/cskh-faq-17-11.md`). Cùng
mô hình: chỉ đề xuất, hiện chung khối "Ghi lỗi vào Sổ Kho" (thẻ có nhãn "Nguồn: Chat" + khách nói gì + ảnh +
link chat), chủ shop bấm xác nhận hoặc "Không phải lỗi shop". Dò trùng theo mã vận đơn nên 3 nguồn không ghi 2 lần.

### 4.3 Nút nằm ở đâu

Tab "Đánh giá & Trả hàng" → Khối "Cần anh xử lý" → mục **"Ghi lỗi vào Sổ Kho"**
hiện mọi dòng có `errlog_status != 'none'`. Dòng `suggest` + đủ mã vận đơn →
có nút "Xác nhận ghi Sổ Kho: giao nhầm (lỗi kho) / lỗi sản phẩm (NCC)". Bấm
xong web tự insert `warehouse_error_log` + set dòng cskh sang `written` +
`errlog_id`. Mình (skill) không làm bước insert này.

## Sending the report

> **17/11/2026: Telegram khi chạy theo lịch chỉ còn 1 dòng "Có K case mới…" (mục 6 ở CƠ CHẾ CHUẨN)** —
> khung dài dưới đây chỉ dùng khi chủ shop gọi tay trong chat (trả lời ngay trong chat).

Chạy theo lịch (08:00 / 20:00) → gửi Telegram **1–2 dòng** (chốt 2026-10-28,
thay cho khung 3+3 dòng cũ — khung cũ giờ là nội dung của tab trên web):

```
<N> đánh giá mới (<x> cái 1–2★), <M> case trả hàng — <K> việc cần anh.
Lưu ý: <gộp mọi thứ cần chủ shop biết, bỏ hẳn dòng này nếu không có gì>
```

- **Không có dòng `needs_action` mới (đánh giá 1–3★, 4–5★ có vấn đề, trả hàng
  ảnh hưởng shop/nội dung sản phẩm-kho vận, tranh chấp) → KHÔNG gửi gì cả.** Im lặng = mọi thứ đã xử lý xong, xem web khi nào rảnh.
- Không khung, không tiêu đề, không emoji, không liệt kê từng đơn — chi tiết
  đã nằm trên web rồi.
- Lỗi không check được gì: chỉ 1 dòng
  `Lưu ý: chưa check được đánh giá & trả hàng (<lý do ngắn>) — <anh cần làm gì>.`

Gọi tay trong chat → trả lời ngay trong chat, theo khung cũ bên dưới (chủ shop
đang ngồi đọc, không cần mở web).

Khung cũ (CHỈ dùng khi trả lời trong chat), chốt 2026-10-07:

```
1. Đánh giá:
- Số lượng đánh giá mới: <N>          (nếu N=0, dừng ở đây — không thêm 2 ý dưới)
- Tổng hợp theo sao: 5★:<n> 4★:<n> 3★:<n> 2★:<n> 1★:<n>
- Đánh giá cần lưu ý: <trích nguyên văn mỗi đánh giá xấu/tốt-có-insight>

2. Trả hàng:
- Tổng số case trả hàng mới trong ngày: <N>
- Tổng hợp lý do trả hàng: <lý do> (<n> case), <lý do> (<n> case)...
- Bình luận trả hàng thêm của khách: <nội dung ô "Nhận xét của khách hàng", nếu có — nếu không có case nào thì nói rõ "không có">
```

**Trả lời ĐÚNG khung trên, không thêm gì** (chủ shop nhắc lại 2026-10-21 vì
báo cáo bị dài):
- Không dòng tiêu đề, không lời chào, không emoji.
- Không thêm gạch đầu dòng nào ngoài 3+3 dòng trong khung. Không ghi chi
  tiết từng đơn (mã đơn, số tiền, trạng thái hoàn tiền), không ghi số
  lượng hàng đợi, không ghi "không phản hồi công khai/không nhắn ai".
- Đánh giá mới = 0 → mục 1 chỉ 1 dòng "Số lượng đánh giá mới: 0".
- Trả hàng mới = 0 → 3 dòng: `0`, `không có`, `không có`.

Ngoài khung chỉ được thêm **tối đa 1 dòng cuối**, bắt đầu bằng `Lưu ý:`,
gộp mọi việc cần chủ shop biết, ngắn gọn, vd:
`Lưu ý: chưa nhắn đơn 586616931475490643 (Chrome bị chặn quyền) — anh nhắn "check trả hàng" khi ở máy.`
Các case tranh chấp (Hard rule 4) hoặc đã có người xử lý (Hard rule 3)
cũng gộp vào dòng này. Không có gì thì bỏ hẳn dòng `Lưu ý:`.

## Reference

- [project_cskh_task_not_started](../../shared/project_cskh_task_not_started.md) — narrative history of how this scope
  got negotiated down (started as "Claude does everything", ended here);
  read it if the shop owner seems to be renegotiating scope again.
- Claude Doc "Workflow CSKH: Phàn nàn · Đánh giá · Trả hàng hoàn tiền"
  (`https://claude.ai/code/artifact/178382aa-6df8-4fdd-af48-886b6c18a3fa`) —
  the full policy tables (Nhẹ/Vừa/Nặng per lỗi sản phẩm/dịch vụ), channel
  comparison table, and permission breakdown this skill is the execution
  layer for.
- [shop-knowledge-base-artifacts](../../shared/reference_shop_knowledge_base_artifacts.md) — other live Artifacts/Sheets for this
  shop (product guide, size-consultation rules, quick policy lookup).

### Đánh giá 1–3★: tin 1 → 4 giờ → tin 2 (chốt 21/11/2026, thay cho "KHÔNG nhắn lần 2")

Ghi tiến độ vào `message_note` theo [tien-do-xu-ly.md](../../shared/tien-do-xu-ly.md): sau khi nhắn tin 1 ghi
`▸ <ngày giờ> · [chờ khách] Đã nhắn tin 1 hỏi lý do`. Lượt **CSKH inbox** (chạy 15 phút/lần, không phải lượt 08:00/20:00) tra
`cskh_reviews` có `action_type=danh_gia_xau`, `messaged_at` ≥ 4 giờ, khách chưa trả lời, chưa có dòng "tin 2" → nhắn **tin 2 đúng 1 lần**
(câu ở tien-do-xu-ly.md) và ghi `▸ ... [chờ khách] 4 giờ chưa trả lời — đã nhắn tin 2`. Khách vẫn im thêm 4 giờ hoặc đã trả lời →
ghi `[chờ anh]`. Không Telegram. Trả hàng thường chỉ nhắn 1 lần, không theo dõi.
