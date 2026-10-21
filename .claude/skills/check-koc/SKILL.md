---
name: check-koc
description: Check TikTok Shop's "Yêu cầu hàng mẫu" (sample request) queue for shop SOME.TIME, score any genuinely new KOC/creator against the standing rubric in Google Sheet "Bảng Chấm Điểm KOC", and message each one the right canned reply based on the result -- use whenever the shop owner says "vào duyệt koc đi", "check koc", "vào làm việc" (in a KOC/duyệt-KOC chat context), or similar. Also covers the separate "thêm/đổi mẫu" follow-up: once the shop owner says they've approved a sample request for a KOC who was offered an extra/different pattern, find that order on seller-vn.tiktok.com, note what to actually pack, and log it to Sổ Kho. Also covers creating an ad-hoc KOC free-sample order directly on Sapo (sometime-official.mysapo.net) when the shop owner pastes a KOC's name/size/phone/address and says to "tạo đơn gửi koc trên sapo" (real stock deduction, unlike the TikTok-affiliate flow) -- including downloading the shipping label PDF, logging it to Sổ Kho, and sending the PDF to the shop owner so staff don't have to hunt for it. Does NOT cover flash sale roster management (see tiktok-koc-flashsale) or general customer-service chat (see size-consultation / review-return-check).
---

# Check KOC (duyệt mẫu free cho nhà sáng tạo)

## ⛔ BƯỚC 0 — CHỈ CHẠY TRÊN MÁY WINDOWS (bắt buộc, làm trước mọi thứ)

Chạy `hostname`. Nếu kết quả **không phải `DESKTOP-N7T8LNP`** (vd máy Mac)
→ **DỪNG NGAY**: không mở trình duyệt, không nhắn khách, **không gửi
Telegram**, chỉ trả lời 1 câu "Bỏ qua: việc này chỉ chạy trên máy Windows."
Chủ shop chốt 2026-10-21: mọi công việc chạy trên Windows, tránh 2 máy làm
trùng (khách bị nhắn 2 lần, Telegram nhận 2 báo cáo).


## What this is for

Shop SOME.TIME runs a standing free-sample program for TikTok creators.
The shop owner wants Claude to run the whole loop end to end: spot new
sample requests, score them against a fixed rubric, write the result into
the sheet, and send the matching reply — without being told the formula
or the wording each time. This skill is the distilled, ready-to-execute
version of a long back-and-forth (first session: 2026-10-05) that pinned
down every rule below; if anything here ever looks wrong, trust the
shop owner's live correction over this file and update the file after.

**Runs automatically once a night** (chốt 2026-10-13), scheduled ~4:00 AM
Asia/Saigon via a cloud routine bound to the shop's always-on PC
environment, so results are waiting when the shop owner checks in the
morning. It can also be run on demand mid-day if the shop owner asks
("vào duyệt koc đi", "check koc") — either trigger runs the exact same
steps below, there's no different "manual mode" vs "scheduled mode".

## Division of labor — what Claude does vs. what the shop owner does

| | Claude | Shop owner |
|---|---|---|
| Checking for new requests, scoring, writing the sheet | ✅ always | — |
| Sending the **text** reply to a KOC (any of the 5 templates below) | ✅ always | — |
| Clicking **"Chấp thuận" / "Từ chối"** on a sample request | ❌ never | ✅ always theirs |
| Sending the **reference photo** for a "thêm mẫu" offer | ❌ never | ✅ always theirs — Claude's message only *announces* a photo is coming, Claude never attaches/sends one itself |
| Solving a **CAPTCHA** | ❌ never | ✅ theirs — Claude stops and asks |
| Filling Book E/F/G (SKU + Hành động) for a DUYỆT row | ✅ always | — |
| Confirming a "thêm mẫu" approval landed, writing the order note + sổ kho | ✅ always, but only once the shop owner says the approval happened | tells Claude when they've clicked Chấp thuận |

So concretely, after Claude sends the "Báo KOC review thêm mẫu mới" text
(the "Rcm KOC thêm 1 sản phẩm" case), **the shop owner still has two
manual steps left**: (1) pick and send the actual reference photo in that
same chat, and (2) later click Chấp thuận for the KOC's original request
whenever they're ready — Claude does not chase either of these, it only
picks the follow-up back up in Part 2 once told the approval happened.

**Claude must never, under any circumstance in this skill:**
- Click Chấp thuận/Từ chối on a sample request, or any other button that
  finalizes an approval/rejection decision.
- Attach, upload, or send an image to a KOC chat.
- Attempt to solve a CAPTCHA — report it and wait.
- Invent or paraphrase message wording instead of reading the live
  `inbox` tab.
- Hand-calculate K/L/O/P instead of using the sheet's formulas.

## The two systems

1. **Google Sheet "Bảng Chấm Điểm KOC"**
   (id `1-ccH9D7SklgEIqJbLlNEbKlpDlYkzHsikDNUy_Ss9Sc`) — scoring + tracking.
   Tabs: **"2.Nhập KOC"** (score every KOC here), **"3.Quản lý Book"**
   (auto-filtered view of only the DUYỆT ones, for managing the actual
   sample shipment), **"inbox"** (canned message text — read live, the
   shop owner edits wording often), **"0.Danh mục SKU"** (SKU dropdown
   source). Full column-by-column structure, every formula, and the
   RANK↔row math: **[references/sheet-structure.md](references/sheet-structure.md)**
   — read this before writing anything to the sheet.
2. **TikTok Shop Affiliate Center** (`affiliate.tiktok.com/affiliate/...`)
   — where requests come in and where you message creators. A separate
   domain, **`seller-vn.tiktok.com`**, is where the actual sample *order*
   (and its "Lưu ý" note) lives once approved — see Part 2 below.

## Part 1 — Score new KOC requests

### Step 1: find genuinely new requests

Go to `https://affiliate.tiktok.com/affiliate/sample/sample-request?shop_region=VN&shop_id=7494594978743617682`,
tab **"Chờ xem xét"** (may render as "To Review" if the UI locale flips to
English — same tab). `get_page_text` dumps the whole list in one call.

The shop owner almost never clicks "Từ chối" — pending requests just sit
here for days until they auto-expire (~30 days). **A name appearing here
is NOT the same as a name needing to be scored.** Pull the full existing
name list from the sheet (`2.Nhập KOC!C2:C...`, read past the last known
row) and only treat a name as new if it's **not already in that column**.
The "Mới" badge TikTok shows is unreliable for this — it comes and goes
inconsistently across page loads, don't use it as the new/old signal.

### Step 2: collect each new KOC's stats

Open the creator's profile: `affiliate.tiktok.com/affiliate/creator` →
search box → click the exact-match result (see Quirks below for the
search box's flaky first keystroke and near-duplicate usernames) →
creator detail page.

One `get_page_text` call right after the page loads usually captures
**everything needed in one shot**: GPM (under "Doanh số", the default
tab) *and* the age/gender breakdown (under "Người theo dõi", which is
apparently pre-rendered on the same page even though it's a separate
tab). If the age breakdown is missing from that dump, click the "Người
theo dõi" tab and re-run `get_page_text`.
[[feedback_tiktok_creator_search_unreliable]] — roughly 30-35% of
searches don't find the creator at all; retry the search once, and if it
still fails just leave GPM/age blank rather than blocking on it.

Fields to pull:
- **GPM** (₫) — top of "Doanh số"
- **Tần suất đăng bài ước tính** (%) — under "Số liệu cộng tác" — this is
  the "Cộng tác" figure
- **Số món bán ra** — raw unit count, NOT GMV
- **Danh mục** (category) — shown at the top of the profile
- **Tuổi 18-24% + 25-34%** — under "Người theo dõi" → "Tuổi"

### Step 3: score (exact rubric)

| Sheet col | Field | Rule |
|---|---|---|
| D | Cộng tác ≥80% | `Có` if Tần suất đăng bài ≥ 80%, else `Không`. If TikTok shows `--` (no data), treat as `Không` — can't confirm it. |
| E | Có SP liên quan | `Có` if the category is menswear/womenswear & underwear or clearly adjacent (general fashion/outfit review). `Không` only when the category is clearly unrelated to the shop's loungewear line (beauty, electronics, automotive, generic home goods, sports/outdoor, etc) — when in doubt, lean `Có` (lenient default, established precedent). |
| F | Số đơn bán | raw number from "Số món bán ra" |
| G | GPM (nghìn VNĐ/đơn) | the ₫ figure **divided by 1000** (column is in thousands) |
| H | KH 18-34 (%) | (18-24% + 25-34%) as a **fraction**, e.g. `82.4%` → `0.824` |
| I | Style kênh | judgment call: `Phù hợp nhiều` / `Phù hợp vừa` / `Phù hợp ít`. No strict rule — default to `Phù hợp vừa` unless the content is obviously off-topic for loungewear (e.g. a sports/pickleball-only channel → `Phù hợp ít`). |

Columns J (Ghi đè thủ công), M (Ghi chú), N (unused) stay **blank** —
don't fill them in.

### Step 4: write to the sheet

**Always verify the next empty row with a fresh `get_values` read first**
(e.g. the last 5 rows of column A/C) — don't compute it from memory or a
stale row count. [[feedback_gsheet_row_verification]] A header row means
`STT N` sits at spreadsheet row `N+1`.

Write A–I as plain values (dates as `DD/MM/YYYY`, today's date), then
write K, L, O, P as **formulas** copied from the row above with the row
number swapped — see
[references/sheet-structure.md](references/sheet-structure.md) for the
exact formula text (semicolon-separated, Vietnamese locale — don't use
commas). Never hand-calculate K/L/O/P yourself; always use the formulas,
and never touch J/K/L/O/P's formula convention — those must stay
formula-driven for every row so the sheet keeps working.

### Step 5: message each one

Read `L` (Kết quả) and `O` (Cảnh báo xử lý) after writing — don't
re-derive them, read what the formula produced. Match against the
**live** `inbox` tab content (don't paraphrase from memory, the shop
owner edits wording — current snapshot for reference only:
[references/inbox-templates.md](references/inbox-templates.md)):

| O column contains | inbox row to use |
|---|---|
| `Nhắn KOC chọn hoàn tiền mẫu` (i.e. `L` = KHÔNG DUYỆT) | "Nhắn KOC chọn hoàn tiền mẫu" |
| `Đã tự duyệt (cộng tác <80%)...` | "cf sẽ lên bài" |
| `Rcm KOC thêm 1 sản phẩm` | "Báo KOC review thêm mẫu mới" — **after sending, set the Book row's Hành động to "Chờ KOC phản hồi thêm mẫu"**, not "Chưa bấm duyệt mẫu" (see Part 2) |
| `Nhắn KOC đổi mẫu khác` / `Nhắn KOC chờ hàng` | matching inbox row (triggered by keywords typed into column M, not part of the normal new-KOC flow) |
| O is empty and L = DUYỆT | no message needed |

A row can carry **two flags joined by `" | "`** (e.g. a low-cộng-tác
DUYỆT that also qualifies for the thêm-sản-phẩm nudge) — send **both**
messages as separate chat bubbles in that case.

### Step 6: for every DUYỆT, fill the Book row too

This is not optional, do it immediately after scoring, not just when
asked:
1. Read the new row's `P` (RANK) value → the matching Book row is
   `RANK + 1`.
2. Go to **"Yêu cầu hàng mẫu"**, find the creator, expand their row to
   see the exact SKU they requested (e.g. "Chất Lông-Shin, L").
3. Map it to the dropdown value in `'0.Danh mục SKU'!F2:F45` (e.g.
   `CL01 - Chất Lông-Shin`) and write that into Book columns **E and F**
   (same value in both — KOC asked for it, shop is sending exactly that).
4. Set Book column **G (Hành động)** to `Chưa bấm duyệt mẫu` — unless
   you also sent the "Báo KOC review thêm mẫu mới" message this round, in
   which case use `Chờ KOC phản hồi thêm mẫu` instead (see Step 5 table).
   **Never leave G blank** — the shop owner wants an explicit value they
   can scan for, not an implied "blank = pending".
5. **Copy the whole row's formatting from the row directly above it** —
   a plain value-write into a fresh row does NOT inherit the sheet's
   borders, background, font, or dropdowns, and leaves the row looking
   visibly broken (no grid lines, "Đã duyệt" rendered as plain black text
   instead of bold navy, no dropdown arrow on E/F/G). This happened for
   real (2026-10-19, rows for taothao2410/qnud_/huyhoanggg999) and had to
   be fixed after the fact — do it as part of writing the row, not as a
   follow-up cleanup. Use the Sheets API directly (`update_spreadsheet`
   batchUpdate), **two separate `copyPaste` requests**, source = the row
   immediately above (same sheet, `sheetId` 1952146322), destination =
   the new row(s), columns A–P (index 0–16):
   - `pasteType: "PASTE_FORMAT"` first — carries borders, background,
     font, alignment, and (usually) the plain-list dropdown on column G.
   - `pasteType: "PASTE_DATA_VALIDATION"` on **columns E–F specifically**
     (index 4–6) as a *second*, separate request — `PASTE_FORMAT` alone
     does **not** reliably carry over the multi-select "chip" dropdown
     on E/F (`ONE_OF_RANGE` sourced from `'0.Danh mục SKU'!$F$2:$F$45`,
     `customUiMode: "CHIP"`, `allowMultipleSelections: true`); without
     this second pass E/F end up as plain text cells with no dropdown at
     all, which is the exact defect the shop owner flagged. Don't try to
     hand-build this validation rule with `setDataValidation` instead of
     copying it — the API rejects `allowMultipleSelections: true` on a
     `ONE_OF_RANGE` condition set that way (`BooleanCondition is not
     expected to allow multiple selections for ConditionTypes that are
     not ONE_OF_LIST`), even though the exact same shape is valid when
     it arrives via `copyPaste`. Copying is the only way that works.
   After both requests, spot-check with `get_spreadsheet`
   (`includeGridData: true`, `fields: ["sheets.data.rowData.values.dataValidation"]`)
   on the new row's E:F range and confirm `customUiMode` reads `"CHIP"`
   with `allowMultipleSelections: true` — not `"ARROW"`.

## Part 2 — "Thêm/đổi mẫu" follow-up (separate trigger)

Triggered later, when the shop owner says something like "a duyệt rồi
e" / "đã bấm xong" about a specific KOC. This is **not** part of the
Part 1 loop — do this only when explicitly told a specific approval just
happened, and confirm which KOC if it's ambiguous (don't guess from
whoever's topical).

1. **Confirm the approval actually landed** — check
   "Yêu cầu hàng mẫu" → "Sẵn sàng vận chuyển". There's a real delay
   (observed: several minutes) between the shop owner clicking "Chấp
   thuận" and the request leaving "Chờ xem xét" — if it's not there yet,
   say so and offer to recheck shortly instead of concluding nothing
   happened.
2. **Find the real order** on `seller-vn.tiktok.com/order?tab=to_ship` —
   open "Bộ lọc", put the KOC's exact TikTok username into **"Tên người
   dùng của khách hàng"** (this matches the real username even though the
   UI displays it masked like `d******v`). Much faster and more reliable
   than trying to match masked characters + SKU by hand.
3. **Compare Book columns E vs F for that row.** If they're identical,
   nothing to note — just flip Book G to `Đã duyệt` and stop. If they
   differ (KOC confirmed an addition or swap), continue:
4. Open the order → **"Thao tác khác" → "Thêm lưu ý"**. Note format
   (chốt 2026-10-08, **100-character limit**):
   `"{item name} + {item name} (giữ nguyên size)"` — **list the items in
   column F** (what's actually being sent), **plain pattern names only,
   no SKU code** (not `CL01 - Chất Lông-Shin`, just `Chất Lông-Shin`),
   joined by `" + "` when there's more than one. Screenshot before
   clicking OK — the first character of the note has dropped silently
   more than once.
5. **Log the same note to Sổ Kho** — insert into Supabase
   `warehouse_notices` (see [[sokho-pyjama-supabase-tables]] for the
   URL/key): `category: "thong_bao_chung"`, `order_code` = the TikTok
   order ID, `content`: prefix with the KOC's name for easy search, e.g.
   `"KOC {username} thêm mẫu: {same note text}"` (xem `.claude/shared/notice_naming.md`).
6. Flip Book column G to `Đã duyệt`.

## Part 3 — Ad-hoc KOC order straight on Sapo (real stock deduction)

Separate trigger again: the shop owner pastes a KOC's info directly
(name, "mẫu: {chiều cao}-{cân nặng}" or a size already picked, phone,
address) and says something like "tạo đơn gửi koc cho a... trên sapo...
vì trên sapo trừ kho thật" — this skips the whole TikTok
affiliate-request flow above entirely (no sheet row, no Book row, no
TikTok chat message) and goes straight to creating a real sales order so
the warehouse's real stock count drops. Chốt 2026-10-20.

**Login**: `https://sometime-official.mysapo.net/admin/dashboard` — on
this machine, already signed in on the Windows Chrome profile named
**"Minh"** (not the two Chrome profiles used for TikTok/Shopee — see
[[reference_chrome_browsers]], which needs updating to add this as a
third mapped profile next time it's touched). If that profile isn't
connected to Claude in Chrome, ask the shop owner to log in there rather
than entering credentials yourself.

**Steps**:
1. `Bán hàng → Đơn hàng → Danh sách đơn hàng → Tạo đơn hàng`.
2. Add each product by SKU search (`CL01-L`, `CL06-L`, etc. — faster and
   less ambiguous than typing the Vietnamese name, which returns combos
   too). Qty stays 1 per SKU unless told otherwise.
3. **Thêm giảm giá → Thêm giảm giá thủ công cho đơn hàng → loại "%" →
   100** (reason: `"Mẫu KOC - <tên KOC>"`) — this is a free sample, not a
   real sale; it must zero the Thành tiền, not just lower it.
4. Add the customer: search by name first — almost always not found
   (first-time recipient), so **Thêm mới khách hàng**. Split the pasted
   full name into Họ / Tên (Vietnamese convention: everything but the
   last word → Họ). Phone goes in with the `+84` prefix auto-applied.
5. Address: toggle **"Địa chỉ mới" ON** (2-tier Tỉnh/Thành phố +
   Phường/Xã, matches the current administrative reform — same thing
   SPX's own address picker needs, see `resend-missing-item`'s SPX
   address notes) rather than leaving the legacy 3-tier toggle off. Put
   the building/apartment detail (e.g.
   `"(3208A) S302 Vinsmart"`) in "Địa chỉ cụ thể" — don't put the ward
   name there too, it's already captured by the Phường/Xã field.
6. Ghi chú (top-level order note, not the address one): đúng mẫu
   `"Gửi KOC - <tên KOC>"` — chỉ vậy, không thêm chiều cao/cân nặng
   (chủ shop chốt 2026-10-20).
7. **Nguồn đơn**: there's no built-in "KOC" source in the dropdown, and
   creating a custom one navigates away from the draft and loses
   everything filled in so far — skip it, leave Nguồn đơn blank, rely on
   the Ghi chú instead. (Chưa thử "Tùy chỉnh nguồn" ở **đơn đã lưu** — có
   thể làm được sau khi tạo xong, chưa xác nhận.)
8. Scroll to **Giao hàng**: Tiền thu hộ COD stays `0` (already free).
   Khối lượng defaults to a tiny placeholder (10g) — bump it to something
   realistic for the item count (e.g. `600` for 2 quần nỉ) so SPX doesn't
   mis-rate it. Pick the **SPX** carrier card (usually pre-ranked as a
   "gợi ý") and its "Chuẩn" service tier; leave "Shop trả" phí vận
   chuyển.
9. Click **"Tạo đơn và giao hàng"** (not "Lưu nháp") — this is the real,
   stock-deducting submit, so treat it with the same confirm-before-send
   care as `resend-missing-item`'s SPX hard rule: show the filled summary
   and wait for an explicit "ok" first.
10. After creation, the order detail page shows **"Phiếu giao hàng" →
    "In phiếu giao hàng"** — click it. This silently downloads a PDF to
    `~/Downloads` (random hex filename, same pattern as the SPX-direct
    flow in `resend-missing-item` Step 4) rather than opening a new
    preview tab; match by newest-mtime, not by a tab that never appears.
11. Log it to Sổ Kho so the packing staff doesn't have to hunt for it the
    next day — **this step is not optional even though the shop owner
    didn't explicitly ask the first time**; they asked for it after the
    fact and want it done by default from now on:
    - Copy the PDF into the scratchpad with a clear name
      (`<mã_vận_đơn>_koc_<tên_KOC_không_dấu>.pdf`).
    - Upload it to the Supabase Storage bucket `notices-pdf` (same
      curl pattern as `resend-missing-item` Step 4; anon key in
      `so-van-hanh-pwa/init.js`).
    - Insert into `warehouse_notices`: `category: "thong_bao_chung"`,
      `order_code` = the SPX mã vận đơn (not the Sapo #order number),
      `content` = `"Gửi KOC - <tên KOC> - <SL> Quần <tên phân loại> <size> +
      <SL> Quần <tên phân loại> <size> - đơn Sapo #<mã đơn Sapo>"`, vd
      `"Gửi KOC - Hoàng Trung Thảo - 1 Quần Chất Lông-Shin L + 1 Quần Chất
      Lông-Shin 02 L - đơn Sapo #28463"` (chuẩn:
      `.claude/shared/notice_naming.md`), `pdf_path` = the exact
      filename just uploaded, `done: false`.
    - **PDF lấy ngay trong Sapo** (phiếu giao hàng ở bước 10 — có logo SPX
      Express, mã vận đơn, người nhận KOC, mã đơn #<Sapo>), không lấy từ SPX.
      **Trước khi upload, đọc PDF**: mã vận đơn + người nhận trên phiếu
      phải đúng đơn KOC này. Đừng lấy "PDF mới nhất" trong Downloads mù
      quáng — 2026-10-20 đã upload nhầm nhãn gửi bù vào đơn KOC.
    - `SendUserFile` the PDF to the shop owner too, same as the SPX
      direct-resend flow — they asked for this specifically so staff
      "đỡ phải tìm" the next morning.

## Operating quirks (read before you hit something weird)

- **Search box drops the first keystroke** fairly often (on both
  `affiliate.tiktok.com/affiliate/creator` and the sample-request page's
  per-row search). Click the box, type, and if the first attempt's
  results don't include your query text, just click-and-retype once more
  — don't troubleshoot further than that.
- **Near-duplicate usernames.** `find` on the query often returns the
  exact match plus several lookalikes (`lincutiqa`, `lincutique`, ...).
  Always check the match label says "Exact match" and prefer the one in
  the **table row**, not the dropdown-menu suggestion, before clicking.
- **Chat panel sometimes won't open to the right thread** on the first
  click of the chat icon — especially for a creator you've never
  messaged before. If the right-hand panel still shows a *different*
  person's message history after clicking, **reload the creator detail
  page URL and click the chat icon again** (sometimes needs two clicks).
  Before typing, confirm you're in the right thread by checking the
  preview text in the left "Gần đây nhất" list matches what's shown on
  the right — the contact you just opened does **not** always jump to
  the top of that list, so don't use list position as your only check.
- **Screenshot before every send.** The `type` action has dropped the
  leading character of a message more than once (e.g. `CL01` → `L01`).
  Check the character counter and the visible text before clicking Gửi
  or OK on any note/message dialog.
- **CAPTCHA** ("Xác minh để tiếp tục", jigsaw piece) can appear on
  Seller Center pages. Never attempt to solve it — tell the shop owner
  it showed up and wait for them to clear it.
- **Duplicate-scoring guard**: before writing a new STT row, you've
  already deduped against column C in Step 1 — but if a KOC shows
  multiple "yêu cầu" (requests) in the list, that's normal (they can
  re-request after rejection/expiry) and doesn't by itself mean a new
  score is needed; only score once per creator unless the shop owner
  says otherwise.

## Report back

End with a short summary: how many new KOC were scored, their
DUYỆT/KHÔNG DUYỆT split, which messages went out, and which DUYỆT rows
got Book entries. If any step above was skipped (e.g. couldn't find a
creator's profile, GPM/age left blank), say so explicitly rather than
reporting a clean sweep.
