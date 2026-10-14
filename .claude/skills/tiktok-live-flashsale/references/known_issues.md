# Known data-quality issues (as of the 2026-10-04 catalog export)

These aren't bugs in the scripts -- they're real mismatches between the
"Gia FS" price sheet and the live TikTok catalog. `build_deal_file.py`
already detects and excludes all three categories automatically, printing a
warning each time. This file just explains *why*, so when you report the
warning to the user you can say something useful instead of just the SKU
codes.

## 1. Five SKU codes priced wrong in the sheet: CL02, CL03, CL04, CL05, DO02

The sheet's "Nor day" (full price) for these is higher than what the shop
is actually charging on TikTok right now:

| Code | Sheet "Nor day" | Real current price |
|------|-----------------|---------------------|
| CL02 | 155.000         | 145.000             |
| CL03 | 155.000         | 145.000             |
| CL04 | 155.000         | 145.000             |
| CL05 | 155.000         | 145.000             |
| DO02 | 195.000         | 185.000 (some sizes; other sizes are 235.000) |

Because every tier's discount is computed as a % off the sheet's "Nor day",
a stale (too-high) "Nor day" makes the computed "discount" price land above
what customers are already paying -- i.e. it would look like a price
*increase*, and TikTok's flash-sale validation would likely reject it
anyway ("deal price must be below the lowest price in the last
14-30 days"). `build_deal_file.py` drops these size-rows and reports them
rather than uploading a bad price.

**Fix**: the shop owner needs to update "Nor day" in the Gia FS sheet to
match the real current selling price for these 5 codes. Once that's done,
re-run `make_tier_prices.py` -- no code change needed, the exclusion clears
itself automatically.

## 2. Three combo codes don't exist in the real catalog: COMBO2C-1, COMBOMIX-1, COMBOMIX-2

The Gia FS sheet has rows for these, but no product in the actual TikTok
shop uses these seller-SKU codes. The real combo listings use a different,
unrelated naming scheme: `CBHH1`-`CBHH7`, `CBKRM`, `CBKT`, `CBLH`, `CBVX`
(found in the 04/10/2026 catalog export).

**Fix**: ask the shop owner which real combo product(s) COMBO2C-1 /
COMBOMIX-1 / COMBOMIX-2 are supposed to map to, then either rename the
seller SKU on TikTok to match the sheet, or add a mapping row. Don't guess
this mapping -- a wrong guess puts a flash-sale price on the wrong product.

## 3. Nine SKU codes have no price at all: PJD-CT-01/02/03, PJC-CT-01/02/03, QS-CT-01/02/03

These rows exist in the sheet (pajama long/short sets, shorts) but the
price columns are blank. `make_tier_prices.py` skips any row whose chosen
tier column is empty, so these are excluded automatically with no warning
noise -- they just won't appear in the output at all. If the shop owner
fills in prices for them later, they'll start showing up on their own.

## Refreshing the cached SKU mapping (`data/sku_mapping.json`)

This file maps `seller_sku` (e.g. `CL01-M`) to TikTok's internal
`product_id` + `sku_id`, plus the `current_price` used for the safety
check above. It was built once from a full catalog export and does **not**
update itself -- if products, variants, or prices on the shop change
meaningfully, re-export it:

1. Seller Center -> San pham -> Quan ly san pham -> Chinh sua hang loat
   san pham ("Chỉnh sửa hàng loạt sản phẩm")
2. "Chon cac san pham" -> "Chon bo loc" (selects every currently
   active/on-shelf product, not just what's visible on screen -- the modal
   only renders a few rows at a time but the filter selects everything
   matching "Dang hoat dong")
3. "Tat ca thong tin" ("All information") stays checked -> "Tao mau"
4. Wait for it to finish, click "Tai xuong" -- downloads a `.zip` with one
   `.xlsx` per ~product-ID-range (TikTok splits large exports into several
   files; read all of them)
5. Each file's `Template` sheet has a header row with columns
   `product_id, category, product_name, product_status, sku_id,
   variation_value, ..., price, seller_sku, ...` -- real data starts at
   row 6 (rows 1-5 are format/instruction rows). Parse every sheet's rows
   from row 6 onward.
6. Rebuild `data/sku_mapping.json` as
   `{"exported_at": "...", "source": "...", "note": "...",
   "rows": [{"product_id", "product_name", "sku_id", "current_price",
   "seller_sku"}, ...]}` -- one row per SKU variant, across every parent
   product.

Expect duplicates: the same `seller_sku` code can legitimately appear on
more than one product listing (e.g. a single-color product and a
"mix several colors" combo listing both sell "CL01-M"). That's fine --
keep every row; `build_deal_file.py` will put the flash-sale price on all
of them so the price is consistent wherever a customer finds it.
