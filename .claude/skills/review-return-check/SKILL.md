---
name: review-return-check
description: Check of new public reviews (đánh giá) and return/refund requests (trả hàng/hoàn tiền) on TikTok Shop + Shopee -- runs on schedule twice a day (08:00 and 20:00), and also whenever the shop owner says "check đánh giá", "check trả hàng", "làm luôn đi", "a báo e làm" (in the context of reviews/returns), or otherwise asks to run this check. Covers: finding genuinely new reviews/return requests, messaging the customer with the correct canned template (skipping any case that already has a reply thread), and sending the shop owner a report in the exact bullet format below. Does NOT cover inbox/chat monitoring (paused for now, see Scope) or any refund/policy decision (always the shop owner's call).
---

# Check đánh giá & trả hàng

## What this is for

The shop owner's current (2026-10-07) working scope for customer-service
automation: Claude handles the **first-contact** step for two channels —
public reviews and return/refund requests — then hands everything else
back to the shop owner. Full rationale and the back-and-forth that pinned
these rules down lives in the Claude Doc
**"Workflow CSKH: Phàn nàn · Đánh giá · Trả hàng hoàn tiền"**
(`https://claude.ai/code/artifact/178382aa-6df8-4fdd-af48-886b6c18a3fa`) and
[[project_cskh_task_not_started]] — if this skill ever seems to contradict
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
  có ai đang chat), gửi báo cáo qua Telegram (xem [[reference_telegram_bot]],
  cùng bot với [[daily-warehouse-report]]).
- Inbox: ngoài phạm vi skill này. Riêng case khách báo **giao thiếu hàng**
  trong inbox do [[resend-missing-item]] quét 15 phút/lần, không phải skill
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

**TikTok Shop Seller Center:**
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

## Sending the report

Chạy theo lịch (08:00 / 20:00) → gửi qua Telegram. Gọi tay trong chat → trả
lời ngay trong chat.
Exact structure, chốt 2026-10-07:

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

Anything outside those two sections (a dispute found per Hard rule 4, a
case skipped per Hard rule 3 because it's already being handled) — mention
it separately, after the two numbered sections, don't force it into one of
the bullets above.

## Reference

- [[project_cskh_task_not_started]] — narrative history of how this scope
  got negotiated down (started as "Claude does everything", ended here);
  read it if the shop owner seems to be renegotiating scope again.
- Claude Doc "Workflow CSKH: Phàn nàn · Đánh giá · Trả hàng hoàn tiền"
  (`https://claude.ai/code/artifact/178382aa-6df8-4fdd-af48-886b6c18a3fa`) —
  the full policy tables (Nhẹ/Vừa/Nặng per lỗi sản phẩm/dịch vụ), channel
  comparison table, and permission breakdown this skill is the execution
  layer for.
- [[shop-knowledge-base-artifacts]] — other live Artifacts/Sheets for this
  shop (product guide, size-consultation rules, quick policy lookup).
