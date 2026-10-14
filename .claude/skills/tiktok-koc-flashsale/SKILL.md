---
name: tiktok-koc-flashsale
description: Add one or more new KOC/creator TikTok usernames into shop SOME.TIME's standing "Flash Sale của nhà sáng tạo" (channel "Chỉ trên LIVE của nhà sáng tạo") on seller-vn.tiktok.com, so those creators can feature the shop's flash-sale pricing in their own LIVE streams. Use this whenever the user says things like "add KOC vào FS", "thêm bạn KOC vào flash sale cho nhà sáng tạo", "thêm KOC vào FS live của KOC", or gives you one or more TikTok usernames to add to the creator flash sale -- even if they don't name the campaign explicitly, since there is normally only one such campaign running at a time. Do NOT confuse this with tiktok-live-flashsale (the shop's own LIVE flash sale, channel "Chỉ trên LIVE") -- they are different campaigns with different purposes and this skill's campaign has NO per-SKU discount prices to set.
---

# TikTok Shop KOC Flash Sale (add creators)

## What this is for

The shop keeps one standing Flash Sale on channel **"Chỉ trên LIVE của nhà
sáng tạo"** (creator-only LIVE), product mode **"Chia sẻ hàng có sẵn với
nhiều nhà sáng tạo"**. Any creator listed on it can pull up the shop's
flash-sale product and feature it (with its existing selling price -- see
"No per-SKU pricing needed" below) when they go live. The shop owner
recruits new KOCs over time and wants them added to this roster.

## The core obstacle: TikTok won't let you edit an active campaign

Seller Center has no "add creator" action on a running Flash Sale -- the
"..." menu on an active campaign only offers Xem / Xem dữ liệu / Xem lịch
sử / Vô hiệu hoá (view / view data / view history / deactivate), and the
"Xem chi tiết" page is read-only. The only way to change the creator list
is:

1. **Duplicate** the active campaign ("Sao chép").
2. Add the new creator(s) to the duplicate's creator list.
3. Try to publish the duplicate -- TikTok will refuse with **"Khuyến mãi
   trùng lặp"** (duplicate promotion) because the OLD campaign is still
   live on the same product.
4. **Deactivate the OLD campaign** ("Vô hiệu hoá" -- irreversible, confirm
   with the user before doing this unless they've already told you to
   proceed without asking).
5. Publish the duplicate now that the conflict is gone.

Steps 3 and 4 are not optional detours -- step 4 must happen before the
duplicate can go live, full stop. Don't try to publish the duplicate
before deactivating the old one; it will just fail and waste a round
trip.

## Step 1: find the current campaign

Go to `https://seller-vn.tiktok.com/promotion/marketing-tools/management?tab=1&shop_region=VN`
("Tất cả trạng thái" tab), open the "Tất cả công cụ khuyến mãi" filter
dropdown, and select **"Flash Sale của nhà sáng tạo"**. There is normally
exactly one row with "Đang diễn ra" (ongoing) status -- open it (click the
name) to see its current creator list, product, and time window before
duplicating. If there's more than one ongoing row here, or none, stop and
ask the user which one they mean rather than guessing.

A TikTok anti-bot captcha ("kéo mảnh ghép vào vị trí") frequently blocks
this management list from loading. You are not allowed to solve
CAPTCHAs -- tell the user it appeared and ask them to solve it on screen,
then retry loading the page.

## Step 2: duplicate and add creators

1. On the campaign's row, click **"Sao chép"**. This opens the create
   form pre-filled with the same channel ("Chỉ trên LIVE của nhà sáng
   tạo"), product mode, and product/SKU list.
2. In the **"Nhà sáng tạo"** section, there's a multi-select field
   ("Chọn và thêm tối đa 50 nhà sáng tạo") already containing the current
   roster as chips. Click into it, type each new username into the
   search box that drops down, and click the matching result (it shows
   avatar + username + numeric creator ID -- confirm the username text
   matches exactly, TikTok search is literal here). Repeat per username.
   The creator count above the table (e.g. "14 nhà sáng tạo") updates
   live -- check it matches old roster + however many you just added.
3. Fix the **time fields** ("Thời gian bắt đầu" / "Thời gian kết thúc"):
   the page's default-prefilled time is unreliable (seen consistently
   ~3 hours ahead of real time -- a display bug, not a real clock issue).
   Get the real time with
   `javascript_tool` (`new Date().toString()` in the page) rather than
   trusting the prefill or the sandbox's own clock. Set start to roughly
   now (a few minutes' buffer so it doesn't land in the past by the time
   you finish editing), and end to start + however long you want the
   campaign to run, **capped at 336 hours (14 days)** -- matching the
   original's duration is a safe default. A duration over 336h shows a
   red "Thời gian khuyến mãi phải dưới 336 giờ (14 ngày)" error right on
   the end-time field.
4. **Don't touch the per-SKU price grid.** See below.

### No per-SKU pricing needed -- this is normal, not a bug

Unlike `tiktok-live-flashsale` (the shop's own LIVE flash sale), this
creator-shared campaign leaves every SKU's "Giá ưu đãi" field blank and
its toggle off, for every SKU, in both the original campaign and the
duplicate. That's the expected state for "Chia sẻ hàng có sẵn với nhiều
nhà sáng tạo" mode -- creators feature the product at its existing
selling price, there's no separate flash-sale discount layer to fill in
here. If you ever see this blank and are unsure whether it's a copy
failure, open the *original* campaign's "Xem chi tiết" page and compare
the same SKU rows -- if they're blank there too, it's normal, publish as
is.

## Step 3: deactivate the old campaign, then publish the new one

1. Try **"Đồng ý và đăng"** on the duplicate first, to confirm it's
   actually blocked -- if TikTok's product list shows a
   "⚠ Khuyến mãi trùng lặp" warning you already know the product's
   SKUs will be rejected.
2. If rejected ("Không thể đăng khuyến mãi" / "Khuyến mãi trùng lặp"),
   close that dialog *without* clicking "Xóa tất cả" (that would strip
   every SKU from the new campaign). The duplicate form's state is
   preserved in the background.
3. Go back to the management list, find the OLD campaign's row, "..." ->
   **"Vô hiệu hoá"** -> confirm ("Không thể hoàn tác thao tác này" --
   this is irreversible, make sure the user has signed off on it, e.g. by
   asking them to confirm this specific step in advance like they did
   when setting this skill up, or asking in the moment if they haven't).
4. Return to the duplicate tab (it's still there, untouched) and click
   **"Đồng ý và đăng"** again. It should now say "Đã tạo chương trình
   khuyến mãi" and offer a suggested message to send each creator telling
   them the new window ("Flash Sale có hiệu lực từ ... đến ...") -- pass
   that along to the user if they want to notify the creators themselves.

## Report back

Tell the user: how many creators are now on the roster and which
usernames you added, the new campaign's active window, and that the old
one was deactivated. If you skipped confirming the deactivation step
because the user pre-authorized it, say so explicitly so there's no
ambiguity about what happened without a check-in.
