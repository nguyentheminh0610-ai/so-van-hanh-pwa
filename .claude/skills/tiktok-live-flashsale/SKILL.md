---
name: tiktok-live-flashsale
description: Set up a TikTok Shop "Flash Sale" scoped to the LIVE channel for shop SOME.TIME (seller-vn.tiktok.com), timed off a just-sent chat message rather than a fixed clock -- use this whenever the user says they're about to go live, are going live tonight/soon, want a flash sale "cho live" / "cho buổi live", or ask to set up a live flash sale, EVEN IF they don't give an exact time, don't name products, or just say something short like "live" or "chuẩn bị live đi". Live schedule is irregular by design, so this always triggers reactively off the message itself: start = message time + 20 minutes (or whatever lead time the user states), duration = 15 minutes (or whatever the user states) on the LIVE-only channel. Also covers picking the right discount tier for the day (normal / mini on the 15th / spike on monthly double-days like 10/10, 11/11) from the shop's "Gia FS" price sheet.
---

# TikTok Shop LIVE Flash Sale

## What this is for

Shop owner runs LIVE streams on an unpredictable schedule. When they ping
in chat ("live tối nay", "chuẩn bị live", "live sau 20p"...), build and
stage a TikTok-Shop Flash Sale that's visible **only during the LIVE**,
starting a fixed lead time after the message and lasting a fixed duration
-- then show it to them for a one-line go-ahead before publishing.

Defaults (confirmed with the shop owner on 2026-10-04): **lead time 20
minutes, duration 15 minutes**. Treat these as defaults, not constants --
if the trigger message says something different ("live sau 30 phút", "để
FS chạy 10 phút thôi"), use what they actually said.

## Hard rule: never publish without an explicit go-ahead

This touches live pricing on a real shop. Build the whole flash sale,
screenshot the filled-in form, and send it in chat -- then **wait for the
user's "ok"/"duyệt"/equivalent before clicking "Đồng ý và đăng"**. This
isn't optional even under time pressure; it fits inside the 20-minute
window because everything *except* that final click is automated by the
steps below. If the user hasn't answered by the time the live is about to
start, say so plainly rather than guessing and publishing anyway.

**Trên máy Windows của shop** (không có `python3`): thay `python3` trong các
lệnh dưới bằng đường dẫn đầy đủ
`C:\Users\Admin\AppData\Local\Programs\Python\Python312\python.exe`, chạy
bằng PowerShell từ thư mục repo, đường dẫn script dạng
`.claude\skills\tiktok-live-flashsale\scripts\<tên>.py` — dạng này đã được
cho phép sẵn, không bật hộp thoại hỏi (chạy đúng 1 lệnh, không ghép thêm lệnh
khác phía trước).

## Step 0: figure out the tier for today

Run:
```bash
python3 .claude/skills/tiktok-live-flashsale/scripts/pick_tier.py
```
This applies the shop's day-of-month rule and prints which "Gia FS" sheet
column to use:
- day == 15 -> **mini** tier, column "Mini FS + Live + KOC 80" (~4% off)
- day == month number (1/1, 2/2, ... 10/10, 11/11, 12/12 -- happens once a
  month, every month) -> **spike** tier, column "Spike FS + Live+KOC 90"
  (~5% off)
- anything else -> **normal** tier, column "Nor FS + Live" (~2% off)

Mention the tier and why (e.g. "hôm nay 15/10 nên dùng mức Mini 4%") when
you report back to the user -- it's a business-relevant fact, not just
plumbing.

## Step 1: fetch live prices and build the tier price map

Always re-fetch the sheet -- don't reuse an old dump, prices get edited:

- Spreadsheet ID: `1EsaPLMfkAUpAcx-BMkR3ZP2fe34_NJYMxsOQF1MzpQw`, tab
  `Gia FS` (display name "Giá FS"), e.g. range `Giá FS!A1:G60`.
- Save the tool's raw JSON result (the object with a `"values"` array) to
  a temp file, then run:
```bash
python3 .claude/skills/tiktok-live-flashsale/scripts/make_tier_prices.py <sheet_values.json> <normal|mini|spike> <tier_prices.json>
```
This turns the sheet into `{sku_code: deal_price_vnd}` for the chosen
column, skipping blank rows automatically (no need to hardcode the
missing-price SKU list).

## Step 2: build the upload file

```bash
python3 .claude/skills/tiktok-live-flashsale/scripts/build_deal_file.py <tier_prices.json> <out.xlsx>
```
This joins `tier_prices.json` against the cached catalog mapping in
`data/sku_mapping.json` (every real TikTok `seller_sku` -> `product_id` +
`sku_id` + last-known `current_price`), computes each row's deal price,
and **drops any row where the deal price wouldn't actually be a
discount**, printing exactly which SKU codes got dropped and why.

Read that printed summary. As of the 2026-10-04 mapping it will always
flag the same three known issues (5 mispriced SKU codes, 3 unmatched combo
codes, 9 SKUs with no price at all) -- see `references/known_issues.md`
for the full explanation and what the shop owner needs to fix. Mention
these briefly when you report the final flash sale to the user so they
know what's intentionally excluded and why, rather than silently shipping
a smaller flash sale than they expect.

If a SKU code the user explicitly asked about tonight isn't in
`data/sku_mapping.json` at all (not even the "dropped" warning -- truly
absent), the cached mapping is stale. Refresh it per the "Refreshing the
cached SKU mapping" section in `references/known_issues.md` before
continuing -- don't guess the product_id/sku_id.

## Step 3: drive the browser

Shop: **SOME.TIME**, `seller-vn.tiktok.com` -- Chrome is normally already
logged in (Claude in Chrome tools). Screenshot after every navigation
before clicking anything: this page's layout shifts after content loads
(banners, popups), so a click planned from an earlier screenshot can land
on the wrong element. Prefer the `find` tool to locate buttons/tabs by
text over reusing fixed pixel coordinates.

1. Navigate to
   `https://seller-vn.tiktok.com/promotion/marketing-tools/flash-sale/create?back=1&shop_region=VN`.
2. Dismiss any popup ("Tăng trưởng kinh doanh...", AI-suggested
   auto-apply-promotion dialogs, etc.) by closing it -- never click
   "Áp dụng" on an AI-suggested promotion, that's a different, unrelated
   promo tool.
3. Set "Tên khuyến mãi" to something identifying, e.g. `Live FS <DD/MM>
   <HH:MM>`.
4. Under "Kênh hiển thị", select **"Chỉ trên LIVE"**. This swaps the
   start/end date fields for a different block:
   - "Thời gian khuyến mãi" -> select **"Đặt ngày bắt đầu"** (not "Có hiệu
     lực tức thì" -- that would start it immediately instead of at the
     planned lead time).
   - "Ngày bắt đầu": date field (DD/MM/YYYY) + time field (HH:MM, 24h,
     GMT+7) -- set to trigger-message time + lead minutes. Get the current
     real time from the page itself (e.g. the default-filled value when
     the form loads, or a fresh screenshot) rather than assuming the
     session clock, since there can be drift.
   - "Thời hạn (phút)": numeric stepper, type the duration directly
     (default shown is 5) -- set to 15 (or the stated duration). The page
     echoes back the computed window ("Thời gian Flash Sale LIVE: ... -
     ...") and the max-discount rule (50% off) -- sanity-check the window
     matches what you intended.
5. Leave "Cấp độ biến thể" selected (per-variant pricing -- matches the
   SKU-level granularity of the mapping file).
6. "Chọn sản phẩm" -> tab **"Tải lên hàng loạt"** -> **"Thêm file"**.
   Do **not** click this with the `computer` tool -- it opens a native OS
   file picker Claude can't see into. Instead `find` the file input
   element and upload with the `file_upload` tool, pointing at the
   `out.xlsx` from Step 2 (copy it into the session's scratchpad dir
   first if needed -- `file_upload` only reads from allowed folders).
7. Confirm the upload result banner (it reports how many rows succeeded)
   and click **"Nhập"** to pull them into the form.
8. Scroll through at least a couple of product groups to spot-check that
   "Giá ưu đãi" matches the expected tier price, then screenshot the top
   of the form (name + time window) for the user.

## Step 4: confirm, then publish

Send the user: the tier used and why, the product/SKU count included, the
exact LIVE start/end window, and a short note on anything excluded (from
Step 2's warnings). **Bắt buộc kèm danh sách giá cụ thể** (chốt
2026-10-13): copy nguyên khối "=== DANH SÁCH DUYỆT ===" mà
`build_deal_file.py` in ra ở Step 2 — mỗi dòng là tên phân loại + size,
giá gốc → giá FS (-%). Các size/phân loại có cùng giá sau giảm đã được gộp
chung 1 dòng. Ví dụ:
`• Chất Lông-Kuromi, Chất Lông-Shin — size M/L/XL: 235.000đ → 191.100đ (-19%)`
Wait for their go-ahead, then click **"Đồng ý và đăng"**.

## Reference

- `references/known_issues.md` -- the three standing data-quality
  exclusions (mispriced SKUs, unmapped combos, missing-price SKUs) and how
  to refresh `data/sku_mapping.json` when the shop's catalog changes.
- `scripts/pick_tier.py`, `scripts/make_tier_prices.py`,
  `scripts/build_deal_file.py` -- run with no arguments (or `--help`-style
  wrong args) to see their usage docstring.
- `assets/flash_deal_template.xlsx` -- TikTok's blank bulk-upload
  template (`Product_id`, `SKU_id`, `Deal Price` columns); used by
  `build_deal_file.py`, no need to touch directly.
