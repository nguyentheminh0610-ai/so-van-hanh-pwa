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
- Row 25 (same loại, Tình huống "Nhắn khách trả hàng") — use for **any**
  return/refund request, regardless of the reason the platform shows —
  always use this generic opener, don't pick a reason-specific template.

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

### 2. Trả hàng / hoàn tiền

1. Open the return-management "Đang chờ bạn" list, `get_page_text` it.
2. For each case within the date window: note mã đơn, buyer handle, lý do,
   ngày.
3. Open its chat thread (bubble icon). If untouched (Hard rule 3), send
   the row-25 template. If it already has a reply, or the customer is
   disputing something (Hard rule 4), skip — note it for the report
   instead of messaging.
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
- `needs_action` + `action_note`: bật `true` cho đúng 2 nhóm — đánh giá 1–2★
  (chủ shop còn phải phản hồi công khai, Claude không được làm) và case
  tranh chấp (Hard rule 4). `action_note` viết 1 câu ngắn đúng kiểu
  "Đánh giá 1★ — chờ anh phản hồi công khai". Việc đã nhắn xong theo mẫu thì
  `needs_action = false`.
- `insight_tag` + `insight_note`: **phần giá trị nhất, đừng bỏ.** Đọc nội dung
  rồi tự gắn 1 chủ đề dạng slug (`tuot-chi-cap`, `size-m-chat`,
  `giao-cham-cuoi-tuan`) cho những gì nói về chất lượng sản phẩm hoặc dịch vụ
  có thể sửa được; `insight_note` là tên hiển thị cho chủ đề đó, vd
  "Tuột chỉ cạp — Bộ dài Shin 02 size L". **Dùng lại đúng slug cũ** cho cùng
  một vấn đề, nếu không web sẽ đếm tách thành 2 nhóm. Đánh giá kiểu "ok shop",
  "giao nhanh" không có gì sửa được thì để trống.
- `messaged_at` + `message_note`: ghi lúc nhắn và nhắn mẫu nào ("đã nhắn mẫu
  dòng 24 lúc 14:40"), hoặc lý do bỏ qua ("thread đã có người trả lời").
- `customer_note` (bảng trả hàng) chỉ dành cho ô "Nhận xét của khách hàng"
  trên thẻ trả hàng — KHÔNG phải tin nhắn chat, đừng trộn 2 thứ.

Nếu POST lỗi (bảng chưa tạo, mất mạng): vẫn gửi Telegram như dưới, thêm vào
dòng `Lưu ý:` là chưa ghi được lên Sổ Vận Hành.

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
