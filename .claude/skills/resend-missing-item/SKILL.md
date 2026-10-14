---
name: resend-missing-item
description: Handle a customer report of a missing item from their order ("giao thiếu", "thiếu hàng", "gửi thiếu 1 cái...") -- runs on schedule every 15 minutes to scan the inbox for customers reporting missing items and handle them proactively (ask for order photo + phone/address/missing item via the canned message, then notify the shop owner on Telegram before creating the SPX order); also use whenever the shop owner says they shipped an order short and need to send the missing piece, or pastes a screenshot of an order showing a missing-item complaint. Covers tracking down the customer's full phone number (often masked in the platform's order view), creating a replacement shipment on SPX Express, logging it in Sổ Kho Pyjama (including the easy-to-miss step of actually uploading the label PDF to storage, not just the filename), and sending the customer a final delivery-info confirmation with the standard message template.
---

# Gửi bù hàng giao thiếu

## What this is for

Shop owner ships an order short (quên bỏ 1 món vào gói) and finds out when
the customer complains. This skill covers the whole resend flow end to end:
find the order → get the customer's real phone number → create a
replacement shipment on SPX Express → log it in Sổ Kho Pyjama → send the
customer a screenshot + message to double-check the delivery info.

Trigger:
- **Chạy theo lịch 15 phút/lần, cả ngày** (chốt 2026-10-13): tự quét inbox
  tìm khách báo thiếu hàng, thấy là chủ động xử lý luôn — xem Step 0.
- Hoặc shop owner says something like "a gửi thiếu cho khách 1 cái X",
  pastes an order screenshot with a missing-item context, or says "gửi bù"
  for an order.

## Hard rule: confirm before clicking "Tạo đơn" on SPX

Creating the SPX shipment submits the customer's personal data (phone,
address) and is a real shipment the shop pays for. Fill in the whole form,
then **stop and show a summary** (recipient, phone, address, item, COD
y/n, who pays shipping) and wait for an explicit "ok" before clicking
"Tạo đơn". Khi chạy theo lịch **trong phiên Claude Code mở liên tục**
(cách chính, chốt 2026-10-13): gửi `PushNotification` ngắn về điện thoại
("Duyệt gửi bù đơn <mã gốc>: <SKU>, <tên khách>"), viết bản tóm tắt đầy đủ
ngay trong phiên, rồi chờ chủ shop gõ "ok" trong phiên đó. Dự phòng (phiên
chạy headless, không ai trả lời được): gửi bản tóm tắt đó + ảnh form qua Telegram ([[reference_telegram_bot]]), kèm mã đơn gốc
và dòng "Trả lời: ok <mã đơn gốc> để tạo đơn". Các lượt quét 15 phút sau
đọc tin trả lời Telegram (`getUpdates`); thấy "ok <mã đơn gốc>" thì điền lại
form và bấm "Tạo đơn". Chưa có "ok" thì không làm gì với case đó.
- Chỉ tính "ok" gửi từ đúng chat của chủ shop (`chat_id` 1874515158). Tin
  từ chat khác bỏ qua.
- Mã đơn trong "ok" phải khớp đúng case đang chờ. "ok" trống không kèm mã
  thì không tạo đơn, nhắn lại hỏi mã nào.
- Telegram chỉ giữ tin chưa đọc khoảng 24 tiếng, và `getUpdates` không
  dùng được nếu bot đang gắn webhook — lần đầu cài phải chạy thử. This matches the general policy in
[[feedback_confirm_before_pricing]] — order-creation counts as the kind of
thing to confirm first; the Sổ Kho logging afterward does not (internal
bookkeeping, just do it and report).

## Quick reference

**Supabase (Sổ Vận Hành + Sổ Kho Pyjama share one project):**
- URL: `https://dyvublxyrldmmnsrfvpz.supabase.co`
- anon key: `SUPABASE_ANON_KEY` in `so-van-hanh-pwa/init.js` — same key
  works for both `apikey` and `Authorization: Bearer` headers, and for
  both REST (`/rest/v1/...`) and Storage (`/storage/v1/...`) endpoints.
- Tables: `warehouse_error_log` (shop's own mistake log) and
  `warehouse_notices` ("📌 Việc cần làm" — staff tasks). Full column
  reference: `references/sokho_fields.md`.
- Storage bucket: **`notices-pdf`** (public) — see Step 4, this is the
  part that's easy to forget.

**SPX Express (create a replacement shipment manually, outside the
marketplace's own fulfillment):** `https://spx.vn/spx-admin/single-order/create`
→ "Single Create". Needs an already-logged-in SPX session in the browser
(check for the account name top-right, e.g. "ng\*\*\*\*"); sender is
already saved as "Sometime".

**TikTok Shop Seller Center chat** (to find the order/customer and send
the confirmation message):
`https://seller-vn.tiktok.com/chat/inbox/current?oec_seller_id=7494594978743617682&shop_region=VN`

**Message templates (Google Sheet "Chính sách xử lý lỗi SP, DV",
id `1X08EPdWfJeiP4aQGzcA35UGtmTjzbUYcC0jidU-05WE`, tab "Mau tin nhan"):**
row 33 = post-resend confirmation message ("Đưa ra hướng xử lý" / "Sau
khi gửi bù hàng") — asks the customer to double-check delivery info, with
the `spx.vn/track` tracking link. Use this tab the same way
[[project_koc_inbox_messaging_rules]] uses the KOC "inbox" tab — read the
live row, don't paraphrase from memory, the shop owner edits these over
time.

**Sổ Kho Pyjama app (where the "Xem PDF" button lives):**
`https://nguyentheminh0610-ai.github.io/so-kho-pyjama`

## Step 0 (chạy theo lịch): quét inbox tìm khách báo thiếu hàng

1. Mở inbox TikTok Shop (link ở Quick reference), xem các hội thoại có tin
   mới từ khách kể từ lượt quét trước (~15 phút). Shopee: chưa có đường đi
   đã kiểm chứng — lần đầu đi chậm, chụp màn hình từng bước, rồi bổ sung
   đường đi vào skill này.
2. Chỉ xử lý tin nhắn khách **báo thiếu hàng** ("thiếu", "giao thiếu",
   "không có cái quần/áo", "thiếu 1 bộ"...). Mọi tin nhắn khác: bỏ qua,
   không trả lời, không đánh dấu đã đọc nếu tránh được.
3. Trước khi nhắn, đọc lại cả hội thoại:
   - Shop/người khác đã trả lời case này rồi → bỏ qua (đang có người xử lý).
   - Đã gửi tin hỏi thông tin (Step 1b) rồi → không gửi lại, chỉ kiểm tra
     khách đã trả lời đủ chưa.
   - Khách đang tranh chấp/đòi hoàn tiền → không trả lời, báo qua Telegram.
4. Case mới → Step 1b. Case khách đã gửi đủ thông tin → Step 2 trở đi.
5. Lượt quét không có gì mới → kết thúc im lặng, không gửi Telegram.

## Step 1b: hỏi khách ảnh đơn hàng + thông tin gửi bù

Cần đủ 4 thứ: (a) ảnh vỏ đơn hàng (tem/mã vận đơn), (b) sản phẩm thiếu
(mẫu, size, số lượng), (c) họ tên + SĐT, (d) địa chỉ nhận hàng gửi bù.

Dùng **đúng nguyên văn 2 tin nhắn chủ shop đã soạn** (chốt 2026-10-13),
không tự diễn đạt lại. Thiếu mục nào thì chỉ gửi tin của mục đó:

**Tin 1 (hỏi thông tin nhận hàng)** — khi chưa có họ tên/SĐT/địa chỉ:
```
Bạn cho shop xin họ tên, số điện thoại và địa chỉ nhận hàng để shop gửi bù sản phẩm thiếu nhé ạ. Bạn có thể viết vào ghi chú điện thoại rồi chụp màn hình gửi shop, để shop tạo đơn gửi bù cho chuẩn ạ.
```

**Tin 2 (xin ảnh vỏ đơn)** — khi chưa có ảnh tem/mã vận đơn:
```
Để shop kiểm tra và hỗ trợ gửi bù sản phẩm còn thiếu cho bạn nhanh nhất, bạn chụp giúp shop 1 tấm ảnh phần vỏ đơn hàng (tem/mã vận đơn dán bên ngoài túi/hộp) gửi qua đây giúp shop nhé ạ.
```

Case mới chưa có gì → gửi Tin 2 trước, rồi Tin 1. Sản phẩm thiếu (b)
thường khách đã nói ngay trong tin báo thiếu. Nếu chưa rõ mẫu/size/số
lượng, **không tự hỏi** — báo chủ shop qua Telegram, vì chưa có mẫu tin
cho phần này.

Sàn chặn gửi SĐT/địa chỉ bằng chữ, nên khách sẽ gửi ảnh chụp ghi chú. Đọc
ảnh đó, ghép với SĐT bị che trong đơn (Step 2) để xác nhận. Sau đó các lượt quét 15 phút tự kiểm tra khách đã trả lời
chưa — không cần `loop` riêng.

## Step 1: find the order and the missing item

From whatever the shop owner pasted/said, get: order code, the SKU/item
that's missing (name + size), and which platform/chat the customer is in
(TikTok Shop Seller Center chat is the usual place — search the inbox by
the customer's handle, or by the order code in "Đơn hàng" panel on the
right once a conversation is open).

## Step 2: get the customer's full phone number

The order detail view shows the phone **masked** (e.g. `(+84)03******50`
— first 2 and last 2 digits visible). Don't ask the shop owner for it
first — check the chat history instead:

1. Open the customer's conversation, scroll to see if CSKH already asked
   for the phone number ("dạ sdt nữa ạ") and whether the customer replied.
2. TikTok's chat blocks raw phone numbers in messages for "security"
   reasons, so customers find workarounds — e.g. dropping the leading
   `0` (`366006450` instead of `0366006450`), adding spaces/dashes, etc.
   **Reconstruct the real number** by matching what the customer sent
   against the masked pattern from the order view: prefix/suffix must
   line up (`03______50` + customer's `366006450` → `0366006450`).
3. If the customer hasn't replied yet: chạy theo lịch thì cứ kết thúc,
   lượt quét 15 phút sau tự kiểm tra lại. Khi được gọi tay trong chat thì
   đây là a genuine wait, not something to poll aggressively. Use the `loop` skill in dynamic
   self-pacing mode (no fixed interval), checking the chat every
   ~20-30 minutes, `noop: true` each time nothing changed. Stop the loop
   as soon as the number shows up and move to Step 3 in the same turn —
   don't make the shop owner re-trigger anything.
4. **Browser tabs can drop out of Claude's tab group** across a long
   `/loop` wait (observed: the chat tab silently closed between wakeups).
   Call `tabs_context_mcp` first on each wakeup and reopen/re-navigate if
   the tab is gone, rather than assuming it's still there.

**Don't wait on the recipient's real name the same way** (shop owner's
explicit call, 2026-10-07): phone number and address are the two fields
that actually matter for delivery — SPX still requires *something* in
the "Tên" field, so when it's not available (order view and order-detail
page both mask it, same as phone — no reveal option, confirmed), just use
the customer's **TikTok handle** (e.g. `tmth000`) as the name and move
straight to Step 3. Don't open a second ask-and-wait loop for the name
alone once phone + address are already in hand.

## Step 2b: nhắn khách xác minh lại thông tin — trước khi tạo đơn

Đủ tên, SĐT, địa chỉ, sản phẩm thiếu rồi thì **chưa tạo đơn ngay**. Gửi
khách tin xác minh dưới đây, điền đúng dữ liệu đã ghép được (chốt
2026-10-13). Phân loại ghi bằng tên trong `.claude/shared/sku_names.json`,
không ghi mã SKU.

```
Dạ shop xác nhận lại thông tin gửi bù cho bạn nhé ạ:
- Người nhận: <tên>
- SĐT: <sđt>
- Địa chỉ: <địa chỉ>
- Sản phẩm gửi bù: <tên phân loại> - size <size> - số lượng <n>
Bạn kiểm tra giúp shop thông tin trên đã chính xác chưa ạ. Bạn xác nhận giúp shop để shop tạo đơn gửi bù ngay cho bạn nhé ạ.
```

- Sàn có thể chặn tin có SĐT dạng số liền. Lần đầu chạy, thử ghi SĐT có
  dấu cách (vd `0366 006 450`). Vẫn bị chặn thì gửi tin xác minh dạng ảnh
  (gõ nội dung vào khung ghi chú, chụp màn hình), rồi ghi lại cách nào
  dùng được vào đây.
- Khách xác nhận đúng → sang Step 3.
- Khách sửa thông tin → cập nhật, gửi lại tin xác minh với thông tin mới.
- Khách chưa trả lời → chờ, các lượt quét 15 phút sau kiểm tra lại.
- Chỉ khi khách đã xác nhận mới báo chủ shop qua Telegram để duyệt tạo
  đơn (Hard rule).

## Step 3: create the replacement shipment on SPX Express

1. Go to `spx.vn/spx-admin/single-order/create` → "Single Create" (or
   reuse an already-open tab from earlier in the session).
2. In "2. Địa chỉ người nhận", paste `Tên, SĐT, Địa chỉ` as one line into
   the "Nhập tự động" box and click "Dán và nhập tự động" (label flips to
   "Tự động điền" after first use) — it parses phone/name/address and
   even auto-selects the right Tỉnh/Phường for the "Địa chỉ MỚI (2 cấp)"
   format. Double check the parsed fields rather than assuming it's
   perfect.
3. **"6. Thông tin gửi hàng" → "Thời gian lấy hàng" dropdown defaults to
   *today as of whenever the page first loaded in this session*.** If
   you fill the form, wait (e.g. across a loop checking for the phone
   number), and submit on a later day, this will still show the stale
   date — reopen the dropdown and pick today's actual date option before
   submitting, or SPX will reject/mis-schedule the pickup.
4. "4. Thông tin bưu gửi" → "Thêm sản phẩm mới", type the item name (free
   text, becomes a reusable saved product), fill giá sản phẩm.
   **Tên sản phẩm bắt buộc theo mẫu** (chốt 2026-10-14):
   `Gửi bù - <mã đơn gốc> - Quần <tên phân loại> <size>`, vd
   `Gửi bù - 586437463013230236 - Quần Chất Lông Shin XL`. Ô tên là dạng
   chọn/tạo: gõ xong phải bấm dòng "tạo mới" trong dropdown, đừng Escape
   (Escape xoá chữ). Đơn KOC (không phải gửi bù) thì ghi
   `Quần <tên phân loại> size <size>`, vd `Quần Chất Lông Kuromi size XL`. Số lượng
   defaults to 1 (correct — you're sending the one missing piece).
   **Khối lượng (weight) field only accepts whole numbers** — typing
   `0.3` gets mangled (the `.` and leading digit get silently dropped).
   Just leave/set it to `1` kg, SPX doesn't need gram-precision for a
   single light garment.
5. "5. Dịch vụ" → leave "Tiền thu hộ (COD)" **unchecked** — the customer
   already paid on the original order, this is a free replacement.
6. "Thanh toán cước phí vận chuyển" → leave "Người gửi thanh toán phí"
   (shop pays, not the customer).
7. Stop here and confirm with the shop owner (see hard rule above). Only
   after an explicit "ok", click "Tạo đơn".

## Step 4: get the label PDF and log it in Sổ Kho — don't skip the upload

After "Tạo đơn" succeeds, the page shows the mã vận đơn + phí vận chuyển
(shop pays this in cash to the SPX driver at pickup, separate from the
Supabase note below).

1. Click "In vận đơn" → "Tải" in the panel that opens. This both opens a
   new tab with a preview URL *and* silently downloads the PDF to
   `~/Downloads` with a random hex filename — check `ls -lt ~/Downloads`
   for the newest `.pdf`, matched by file size if needed; no need to
   fight with the preview tab's fetch/base64 (truncates for files this
   size through the tool output).
2. Copy it into the scratchpad with a clear name, e.g.
   `<mã_vận_đơn>_guibu_<ten_khach>.pdf`.
3. Insert into `warehouse_error_log`: `code` = **original** order code,
   `error_type="kho_van"`, `detail_reason="giao_thieu"`, `reason` = short
   free text like `"giao thieu 1 <ten SKU>"`.
4. Insert into `warehouse_notices`: `category="gui_don_bu"`,
   `order_code` = the **new SPX** mã vận đơn, `content` = **giống hệt tên
   sản phẩm trên SPX** (chốt 2026-10-14, cho đồng nhất):
   `"Gửi bù - <mã đơn gốc> - Quần <tên phân loại> <size>"` — ngắn, không
   ghi phí ship (learned 2026-10-07). Có dấu tiếng Việt: gửi JSON từ file
   UTF-8 (`--data-binary @file.json`), không gõ thẳng trong `-d`. Đơn KOC:
   `category="thong_bao_chung"`, content dạng
   `"Gui KOC <tên KOC> 1 quan <tên phân loại> size <size>"`. `pdf_path` = the exact filename you're
   about to upload in the next step, `done=false`.
5. **⚠️ Upload the actual PDF to Supabase Storage — the `pdf_path` column
   alone does nothing.** The Sổ Kho Pyjama app's "Xem PDF" button builds
   the URL `https://dyvublxyrldmmnsrfvpz.supabase.co/storage/v1/object/public/notices-pdf/<pdf_path>`
   directly from that column; if no object exists there it 404s with
   `NoSuchKey` (hit this bug 2026-10-07 — sent the file fine over chat,
   but Sổ Kho's own link was broken until the upload below ran):
   ```bash
   curl -s -X POST "https://dyvublxyrldmmnsrfvpz.supabase.co/storage/v1/object/notices-pdf/<FILENAME>.pdf" \
     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
     -H "Content-Type: application/pdf" \
     --data-binary "@<local path to the PDF>"
   ```
   Verify by opening `.../storage/v1/object/public/notices-pdf/<FILENAME>.pdf`
   in the browser and confirming the label actually renders (wait ~2s,
   first paint can look like a blank dark page in Chrome's PDF viewer).
6. Send the PDF to the shop owner too (`SendUserFile`). If they report
   "pdf bị lỗi" / a 404 on the chat-delivered copy specifically, that's a
   one-off transfer glitch — just resend (a different filename avoids
   any key collision); it's unrelated to the Sổ Kho storage upload above,
   which is a separate failure mode with a separate fix.

## Step 5: send the customer a final confirmation

Shop owner wants the customer to double-check the delivery info before
the parcel ships: a screenshot of the order's **"Chi tiết đơn hàng" page**
(not the smaller "Thông tin người nhận" card on the create-success page —
tried that first 2026-10-07, shop owner asked for the fuller view
instead) showing all of: Địa chỉ người gửi, Địa chỉ người nhận, Thông tin
dịch vụ, and Thông tin bưu gửi (item/giá trị/trọng lượng) — cropped to
just those 4 cards, nothing from "Dịch vụ" downward (COD/fee detail isn't
for the customer). Plus the standard message + the tracking link
`https://spx.vn/track?<mã_vận_đơn>` (shown right on that same page under
"Tiến trình xử lý yêu cầu" → "Theo dõi hành trình đơn hàng tại").

Get to that page from the create-success screen via "Chi tiết đơn hàng",
or navigate straight to `spx.vn/spx-admin/order/trackings/<order-sn>`
(the `order-sn` from the success page's URL, a long alphanumeric code
distinct from the human-readable mã vận đơn).

**Cropping multiple cards cleanly:** the `zoom` action doesn't return an
`imageId` usable by `upload_image`, so isolate via DOM instead of pixel
coordinates:
1. `javascript_tool`: `document.querySelectorAll('.order-detail-v2-legend-card')`
   lists each card section in order (titles: Địa chỉ người gửi, Địa chỉ
   người nhận, Thông tin dịch vụ, Thông tin bưu gửi, Dịch vụ, Thông tin
   gửi hàng, Thông tin tạo, Chi tiết phí vận chuyển) — keep indices
   `[0,1,2,3]`, hide the rest. (On the create-success page instead, the
   equivalent single-card class is `.order-result-page-card` — find it by
   climbing from a header matched by exact text via
   `.order-result-block-info-title`, not by "ancestor text still contains
   X", which over-matches and grabs the whole page.)
2. Hide everything else too: walk from the shared parent container (e.g.
   `.order-detail-v2-page-body__left`) up to `<html>`, at each level set
   every *other* sibling's `style.display = 'none'`.
3. **Crop as tight as possible, not just isolate.** The `computer`
   screenshot action always captures the browser pane's full fixed
   canvas (observed 1440×778) — `resize_window` does NOT shrink that
   canvas, so isolating the card alone still leaves a lot of dead space
   if the card's natural box is much narrower than 1440px (this is what
   "ảnh vẫn hơi rộng" meant 2026-10-07, after Step 1's isolation alone).
   `zoom` *can* crop to an exact pixel region and looks perfect, but its
   output has **no `imageId`** — `upload_image` always errors
   `imageId: expected string, received undefined` for it, confirmed not
   a fixable oversight. So: make the isolated card itself bigger instead
   of cropping the canvas down to it — set `document.body.style.zoom`
   (not `transform: scale`, which doesn't trigger re-layout/re-wrap) to
   the largest factor where the card's `getBoundingClientRect()` still
   fits inside the canvas (`right ≤ ~1438`, `bottom ≤ ~776`), then also
   narrow the card's own `width`/`maxWidth` as far as it'll go without
   the *height* growing past the canvas either (narrower width → more
   text wrapping → taller card — there's a real tradeoff, iterate
   test-and-measure a couple of values rather than guessing one). This
   won't ever reach a true edge-to-edge crop like a manual OS
   screenshot — there's an unavoidable margin on the canvas's unused
   side — but it gets close with zero dead space in the other dimension.
4. Take the `computer` screenshot (not `zoom`) now — this one returns an
   `ID: ss_...` you can pass to `upload_image`.
5. In the TikTok chat, `find` the hidden file-input ("image upload button
   in message input toolbar") **fresh each time** — its `ref` id from an
   earlier `find` call can go stale after navigating away and back, don't
   reuse one blindly. `upload_image` with that `ref` + the screenshot's
   `imageId`. A click-to-preview lightbox may pop up over the real "Gửi
   hình ảnh" dialog right after upload — close it (X) first, the actual
   send dialog with "Hủy"/"Gửi" is underneath. Confirm "Gửi", then type +
   send the Step-33 message (with the tracking link appended) from "Mau
   tin nhan" right after.
   Then send one more short message (chốt 2026-10-13) so the customer
   knows they pay nothing on delivery:
   ```
   Đơn gửi bù này shop đã thanh toán phí ship rồi ạ. Khi nhận hàng bạn không cần trả thêm tiền hàng hay tiền ship nhé, vì đây là lỗi của shop nên shop xin chịu toàn bộ chi phí ạ. Shop xin lỗi bạn vì sự bất tiện này ạ ❤️
   ```
6. **Double-check you're in the right conversation before sending** — the
   inbox can land on a different chat than expected after navigating
   away and back (observed 2026-10-07: landed on an unrelated customer's
   thread). Re-`find` the customer's handle and click it immediately
   before opening the image-send dialog, every time, not just once per
   session.

## Reference

- `references/sokho_fields.md` — column reference for
  `warehouse_error_log` / `warehouse_notices` + the `notices-pdf` bucket.
