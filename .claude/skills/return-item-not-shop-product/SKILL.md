---
name: return-item-not-shop-product
description: Handle a warehouse return parcel that, once unboxed, turns out to contain an item that isn't actually the shop's product (customer sent back the wrong/fake item) -- use this whenever the user reports a return as "sai hàng", "hàng không phải của shop", "khách tráo hàng", "bóc ra không phải hàng shop", or says they've just filmed/uploaded evidence for a return like this. Covers: pulling the video/photo evidence and the standard complaint text from Drive, updating the order's record in Sổ Kho Pyjama (has_problem / problem_type=sai_hang / complaint_status), and staging -- never auto-submitting -- the platform complaint in TikTok Shop / Shopee Seller Center.
---

# Hàng trả về không phải của shop

## What this is for

During batch unboxing-checks of "không nguyên vẹn" return parcels, some
turn out to contain an item that isn't the shop's product at all (customer
sent back the wrong item, maybe by mistake, maybe on purpose). The physical
side (resealing the parcel, filming, photographing, uploading to Drive)
stays with warehouse staff -- see
`.claude/skills/return-item-not-shop-product/references/` for the staff
training doc covering that half. This skill covers everything **after**
the evidence lands in Drive: updating Sổ Kho, pulling the complaint
template, and staging the platform complaint for a go-ahead.

Trigger: someone reports in chat something like "<mã đơn> sai hàng, video
mới up" after they've already filmed/photographed and uploaded to Drive.

## Hard rule: never submit the platform complaint without an explicit go-ahead

Same principle as `.claude/skills/tiktok-live-flashsale/SKILL.md`'s
publish gate -- stage the whole complaint (evidence attached, message
pasted), screenshot it, send it in chat, and **wait for "ok"/"gửi đi"**
before clicking the final submit button on the platform. Never skip this
even when processing several "sai hàng" cases back to back.

## Quick reference

**Sổ Kho Pyjama = Supabase, table `warehouse_return_checks`** (same
project as Sổ Vận Hành):
- URL: `https://dyvublxyrldmmnsrfvpz.supabase.co`
- anon key: same one in `so-van-hanh-pwa/init.js`
  (`SUPABASE_ANON_KEY`) -- use it for both the `apikey` and
  `Authorization: Bearer` headers.
- Match rows by the `code` column (mã vận đơn).
- Fields to set for this exact case: `has_problem=true`,
  `problem_type="sai_hang"` (the app's own label: "Lỗi khách - Hàng
  không phải của shop"), `complaint_status` (`pending` → `submitted`
  once actually filed → `resolved`/`lost` once there's a final result),
  `note` (exists in the DB but has **no UI control in the app** --- safe
  to use as the Drive evidence link without colliding with anything
  staff do through the app).
- Full column/value cheat sheet: `references/sokho_fields.md`.

**Drive -- evidence + complaint template:**
- Root folder "Khiếu nại hàng hoàn": id `1w-Be_qE3kJhnY6Hu5RtcuLRsc98hNaQt`,
  split into month subfolders named `MM/YYYY` (e.g. `09/2025`).
- Complaint-message doc "Text khiếu nại":
  id `1xAMgJhjvqSQMMaHvw48Nqk5u0HR3cq2CVuRtSDMaEoY` -- always re-read the
  live doc with `read_file_content` (the copy in
  `references/complaint_template.md` is just a fallback snapshot --
  the shop owner can edit the real one any time).

## Step 1: find the evidence

1. Confirm the order code + platform (TikTok/Shopee) if whoever reported
   it didn't already say.
2. Find the current month's subfolder under the root folder
   (`search_files` with `parentId = '1w-Be_qE3kJhnY6Hu5RtcuLRsc98hNaQt'`,
   match the `MM/YYYY` title for the current month), then list its
   contents (`parentId = '<that subfolder's id>'`).
3. Evidence files keep their original phone-camera names
   (`IMG_xxxx.MOV`/`.HEIC`) -- there is **no order code in the filename**.
   Match by `createdTime` close to when the report came in. If several
   "sai hàng" cases were processed in the same batch and it's ambiguous
   which file is which, don't guess -- ask the reporter, or open the clip
   and check whether the order code is read out / shown on camera (this
   is exactly the habit the staff training doc asks for).
4. Grab the `viewUrl` of the matched file(s) for `note` in Step 2 -- no
   need to download anything yet unless Step 4 needs a real attachment.

## Step 2: update Sổ Kho right away

Check first whether the order was already scanned into the app's tab
"1. Tích đơn hoàn":

```bash
curl -s "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_return_checks?code=eq.<ORDER_CODE>&select=*" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```

- Row exists → PATCH it:
```bash
curl -s -X PATCH "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_return_checks?code=eq.<ORDER_CODE>" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"has_problem": true, "problem_type": "sai_hang", "complaint_status": "pending", "note": "<drive viewUrl>"}'
```
- No row at all → don't invent one (you'd be guessing `platform`/
  `staff`/`scan_date`). Tell the reporter the order hasn't been scanned
  into the app yet and ask them to do that first, or get the platform
  from them directly.

This is internal warehouse bookkeeping, not product/pricing -- do it
immediately and report the result afterward, no need to ask first.

## Step 3: get the complaint message

`read_file_content` on doc `1xAMgJhjvqSQMMaHvw48Nqk5u0HR3cq2CVuRtSDMaEoY`
for the current wording -- see `references/complaint_template.md` for a
cached copy if Drive is briefly unreachable. Use the text as written,
don't paraphrase it, unless the shop owner asks for a change.

## Step 4: stage the complaint in Seller Center -- then stop

1. Open the right Seller Center (TikTok Shop / Shopee) in Chrome (Claude
   in Chrome), find the order by its mã vận đơn.
2. ⚠️ **The exact click-path for the return/complaint section hasn't
   been verified on either platform yet.** First real run: go slowly,
   screenshot after every navigation and before every click (same
   discipline as `tiktok-live-flashsale/SKILL.md` Step 3), then come
   back and fill in the verified path/button names here so the next run
   is faster. Look for something like "Khiếu nại" / "Phản hồi người
   bán" / "Yêu cầu hỗ trợ" tied to that return.
3. Download the evidence file(s) from Drive to the scratchpad
   (`download_file_content`), then attach with the `file_upload` tool --
   never use `computer` to click a file-input (it opens a native OS file
   picker Claude can't see into; same lesson as
   `tiktok-live-flashsale/SKILL.md`).
4. Paste the exact complaint text from Step 3 into the platform's
   complaint-message field.
5. Screenshot the filled-in form (order, attached evidence, message
   text), send it in chat, then **stop and wait** -- see the hard rule
   above.

## Step 5: after the go-ahead

1. Click the actual submit button on the platform.
2. PATCH that order's `complaint_status` to `"submitted"`.
3. Report back: which platform, when, and a link to the order.
4. Once the shop owner later reports the platform's decision, PATCH
   `complaint_result` to `"thanh_cong"` or `"that_bai"`.

## Reference

- `references/sokho_fields.md` -- full column/value reference for
  `warehouse_return_checks`, and why this case never belongs in
  `warehouse_error_log` (that table is for the shop's own mistakes; this
  case is the opposite -- evidence against a customer claim).
- `references/complaint_template.md` -- cached copy of the complaint
  message and the Drive folder layout, for quick reference only (the
  live Drive doc is always the source of truth, see Step 3).
