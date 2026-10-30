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
  có ai đang chat), gửi báo cáo qua Telegram (xem [reference_telegram_bot](../daily-warehouse-report/references/reference_telegram_bot.md),
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

Vì lý do hiển thị trên thẻ trả hàng đã đọc được **ngay khi mở case** (bước 2
của mục "2. Trả hàng/hoàn tiền" dưới), việc phân loại + chọn đúng template
làm được **ngay trong 1 lượt mở thread, không cần tin nhắn thứ 2 / không cần
chờ khách trả lời trước** — vẫn đúng Hard rule 1 (1 tin nhắn first-contact
duy nhất mỗi case):

1. Đọc lý do trên thẻ trả hàng → tra bảng phân loại → xác định lỗi shop hay
   không.
2. **Lỗi shop** → mở thread, nếu untouched (Hard rule 3) thì gửi đúng dòng
   35 (TikTok) hoặc 36 (Shopee) — tên lý do mời đổi **khác nhau theo sàn**,
   đọc nguyên văn từ Sheet, đừng paraphrase:
   - TikTok Shop: mời đổi sang lý do **"Đổi ý"**.
   - Shopee: mời đổi sang lý do **"Hàng nguyên vẹn nhưng không còn nhu cầu"**.
3. **Không phải lỗi shop** → gửi row 25 (opener trung lập, không mời gì).
4. Khách đồng ý/đổi lý do thật, hay từ chối/không thấy lựa chọn đó (xem hạn
   chế trong file tham chiếu — không phải sản phẩm/khách nào cũng đổi được)
   → ghi vào `message_note` (mục 3 dưới) nếu biết được, không cần nhắn lại
   lần 2 để hỏi thêm (Hard rule 1).
5. **Insight/errlog vẫn phân loại theo nội dung thật (lỗi gì thật sự xảy
   ra), KHÔNG phải theo lý do khách chọn trên sàn** — mục 4 (`shop_error_kind`)
   không đổi, dù khách đổi lý do hiển thị trên sàn thành "đổi ý" thì nội bộ
   vẫn ghi đúng là lỗi shop nếu đúng là lỗi shop. Tin nhắn này chỉ nhằm đổi
   con số **trên sàn**, không nhằm che giấu lỗi **trong nội bộ** — hai việc
   tách biệt.

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

> ⚠️ **TODO (chốt 30/10/2026) — DỰNG LUỒNG NHẮN KHÁCH TRẢ HÀNG SHOPEE.**
> Hiện skill mới chỉ **nhắn được first-contact cho đơn trả hàng bên
> TikTok**. Đơn trả hàng Shopee vẫn được phát hiện và lên thẻ gợi ý "ghi
> Sổ Kho" trên tab "Đánh giá & Trả hàng" (cơ chế commit `940b41b`
> 29/10), **nhưng bước gửi tin nhắn tự động cho khách thì chưa có** cho
> Shopee. Cần một phiên **trên PC Windows** đi qua luồng thật trên
> `banhang.shopee.vn` để bổ sung vào mục "2. Trả hàng/hoàn tiền" bên dưới:
> - Tìm hàng chờ: URL/tab queue "trả hàng/hoàn tiền" bên Kênh Người Bán
>   (tương đương tab "Đang chờ bạn" của TikTok), đọc được lý do + ngày +
>   số tiền + auto-approved hay chưa.
> - Cách mở đúng thread chat gắn với từng đơn trả hàng (tương đương nút
>   chat-bubble cạnh username bên TikTok), và cách nhận biết thread
>   "untouched" (Hard rule 3) trên Shopee.
> - Dòng mẫu đã có sẵn theo sàn: row 25 (không phải lỗi shop), row 36
>   (lỗi shop — Shopee, mời đổi lý do sang "Hàng nguyên vẹn nhưng không
>   còn nhu cầu"). Chỉ thiếu phần thao tác UI.
>
> **Lý do ghi TODO này:** 30/10/2026 đơn Shopee `261024FPGSQXVJ` (khách
> antm057) lên thẻ gợi ý "giao nhầm" nhưng khách **chưa được bộ phận trả
> hàng nhắn** — truy ra đúng vì luồng Shopee chưa dựng. Lưu ý kèm theo:
> lý do trả hàng khách chọn trên sàn ("người bán gửi sai hàng") có thể
> **không khớp thực tế** (khách chỉ muốn đổi size) → khi dựng xong, vẫn
> phải đọc chat thật trước khi phân loại lỗi shop / ghi Sổ Kho, đừng tin
> lý do hiển thị trên thẻ trả hàng (đúng tinh thần mục 4 + mục 5 ở trên).

## Steps

### 1. Reviews

1. Open the reviews pending-reply queues (negative + neutral, both links
   above).
2. For each, check the date — skip anything outside the window (default:
   last 2 days). Positive reviews aren't checked (no pending-reply queue
   for them).
3. Với mỗi đánh giá xấu mới: **vào phần TIN NHẮN (chat) với khách đó và
   nhắn mẫu dòng 24** (chủ shop chốt 2026-10-13). **TUYỆT ĐỐI KHÔNG bấm
   "Phản hồi"/"Trả lời" công khai dưới đánh giá** — phản hồi công khai là
   việc của chủ shop. Thread chat đã có người trả lời rồi thì bỏ qua (Hard
   rule 3).
4. Tally for the report: count of new reviews, and if any, the star
   breakdown + full verbatim text of negative ones and any positive ones
   with real insight (not just a star rating).

#### Theo dõi 12h cho đánh giá xấu (chốt 29/10/2026)

Chủ shop muốn: đánh giá xấu em nhắn mẫu dòng 24 xong, **nếu qua 12 tiếng khách
vẫn chưa trả lời thì mới báo anh** lên Sổ Vận Hành để anh tự tìm tên khách trên
TikTok nhắn hỗ trợ; **khách trả lời rồi thì thôi, không hiện gì.** Vì skill chạy
08:00 & 20:00 (đúng 12h/lần) nên lượt sau chính là mốc kiểm.

Mỗi lần chạy, với mỗi đánh giá 1–2★ đã có dòng trong `cskh_reviews`:

- **`messaged_at` còn trống** (lần đầu gặp): nhắn mẫu dòng 24 như bước 3, ghi
  `messaged_at` = giờ nhắn. **Chưa flag** — `needs_action = false`,
  `action_type` null. Đang trong 12h chờ.
- **`messaged_at` đã có, chưa flag, và `now >= messaged_at + 12h`**: **mở lại
  đúng thread chat đó, CHỈ ĐỌC** (xem ngoại lệ Hard rule 1 bên dưới) — đừng
  nhắn lại gì:
  - Khách **chưa trả lời** → `needs_action = true`,
    `action_type = 'lien_he_khach'`, `action_note` kiểu nêu trên. Cập nhật
    `message_note` = "đã nhắn mẫu dòng 24 <giờ>, qua 12h khách chưa trả lời".
  - Khách **đã trả lời nhưng còn bức xúc/đòi xử lý** → `needs_action = true`,
    `action_type = 'tranh_chap'` (Hard rule 4).
  - Khách **trả lời xã giao** ("ok", "cảm ơn", "dạ") → để nguyên
    `needs_action = false`, `action_type` null. Ghi `message_note` = "khách
    đã trả lời, ổn". Không flag.
- **Đã flag rồi** (`needs_action = true` từ lượt trước): giữ nguyên, việc này
  chờ chủ shop, đừng tự hạ cờ.
- **Thread đã có người (chủ shop/NV) nhắn trước, khách chưa trả lời** — tức
  mình gặp đánh giá xấu mà chat đã có tin của shop rồi (Hard rule 3: không
  nhắn lại): coi như first-contact đã xong từ trước, **flag luôn không cần
  đợi 12h** — `needs_action = true`, `action_type = 'lien_he_khach'`,
  `message_note = "chủ shop/NV đã nhắn trước, khách chưa trả lời"`. Đây đúng
  là tình huống đơn 586593929059403539 (chủ shop tự nhắn, khách im).

### 2. Trả hàng / hoàn tiền

1. Open the return-management "Đang chờ bạn" list, `get_page_text` it.
2. For each case within the date window: note mã đơn, buyer handle, lý do,
   ngày. **Tra lý do này vào bảng**
   [reference_return_reason_fault_classification](../../shared/reference_return_reason_fault_classification.md)
   ngay ở bước này → xác định case lỗi shop hay không (xem mục "Khuyến khích
   đổi lý do trả hàng" ở trên) — quyết định template nào sẽ gửi ở bước 3.
3. Open its chat thread (bubble icon). If untouched (Hard rule 3), send:
   - **Lỗi shop** → row 35 (TikTok) hoặc row 36 (Shopee), đúng theo platform
     của case.
   - **Không phải lỗi shop** → row 25 (opener trung lập).
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

Ghi **mọi** đánh giá/case gặp trong kỳ, không chỉ cái cần xử lý — phần tổng
hợp tuần/tháng cần đủ số. Lưu ý từng cột:

- `dedup_key`: `platform|order_code|ngày|40 ký tự đầu nội dung` (trả hàng:
  `platform|order_code|ngày`). Chạy lại 20:00 gặp đúng case của 08:00 thì ghi
  đè chính dòng đó, không nhân đôi.
- `needs_action` + `action_type` + `action_note` (quy tắc mới chốt 29/10/2026,
  thay cho quy tắc cũ "1–2★ luôn bật `needs_action` để anh phản hồi công khai"):
  bật `true` cho đúng 2 nhóm, mỗi nhóm có `action_type` riêng để web tách:
  - **`action_type = 'lien_he_khach'`** — đánh giá xấu (1–2★) mà **đã nhắn
    mẫu dòng 24 nhưng qua 12 tiếng khách vẫn chưa trả lời** (xem mục "Theo
    dõi 12h" trong bước Reviews). `action_note` kiểu "Đánh giá 1★, đã nhắn 12h khách chưa trả lời —
    anh tìm tên khách trên TikTok nhắn hỗ trợ + phản hồi công khai".
  - **`action_type = 'tranh_chap'`** — khách đang tranh chấp/khiếu nại (Hard
    rule 4), kể cả khi đó là khách trả lời lại tin nhắn đánh giá xấu mà vẫn
    còn bức xúc. `action_note` nêu ngắn khách đang đòi gì.
  - Mọi trường hợp khác để `needs_action = false`, `action_type` null. Cụ
    thể: đánh giá xấu **vừa nhắn xong, chưa tới mốc 12h** (chờ, chưa flag);
    và đánh giá xấu mà **khách đã trả lời xã giao** ("ok", "cảm ơn", "dạ") —
    chủ shop chốt 29/10: khách đã trả lời rồi thì KHÔNG hiện thông báo gì,
    coi như hội thoại đang sống, để chủ shop/nhân viên tự theo trong chat.
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
2. **`giao_nham` / `san_pham_loi`:** phải lấy **mã vận đơn gốc** rồi dò trùng:
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
3. **Chỉ ghi 1 lần:** lượt chạy sau gặp lại dòng (dedup_key) mà `errlog_status`
   đã là `written`/`dup`/`owned_resend` thì **giữ nguyên**, đừng hạ về
   `suggest` (không dựng lại nút chủ shop đã xử lý).

### 4.3 Nút nằm ở đâu

Tab "Đánh giá & Trả hàng" → Khối "Cần anh xử lý" → mục **"Ghi lỗi vào Sổ Kho"**
hiện mọi dòng có `errlog_status != 'none'`. Dòng `suggest` + đủ mã vận đơn →
có nút "Xác nhận ghi Sổ Kho: giao nhầm (lỗi kho) / lỗi sản phẩm (NCC)". Bấm
xong web tự insert `warehouse_error_log` + set dòng cskh sang `written` +
`errlog_id`. Mình (skill) không làm bước insert này.

## Sending the report

Chạy theo lịch (08:00 / 20:00) → gửi Telegram **1–2 dòng** (chốt 2026-10-28,
thay cho khung 3+3 dòng cũ — khung cũ giờ là nội dung của tab trên web):

```
<N> đánh giá mới (<x> cái 1–2★), <M> case trả hàng — <K> việc cần anh.
Lưu ý: <gộp mọi thứ cần chủ shop biết, bỏ hẳn dòng này nếu không có gì>
```

- **Không có đánh giá ≤3★, không có case tranh chấp, không có lỗi → KHÔNG gửi
  gì cả.** Im lặng = mọi thứ đã xử lý xong, xem web khi nào rảnh.
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
