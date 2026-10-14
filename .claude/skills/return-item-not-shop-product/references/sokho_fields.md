# Sổ Kho Pyjama — `warehouse_return_checks` field cheat sheet

Same Supabase project as Sổ Vận Hành. URL + anon key: see
`so-van-hanh-pwa/init.js` (`SUPABASE_URL` / `SUPABASE_ANON_KEY`).

Verified against the live app source (nguyentheminh0610-ai.github.io/so-kho-pyjama)
and live table data, 2026-10-07.

## Columns that matter for a "sai hàng" (not-shop's-product) case

| Column | Values | Notes |
|---|---|---|
| `code` | mã vận đơn | match key for PATCH |
| `return_type` | `doi_tra` \| `boom` | only `doi_tra` rows ever get `has_problem`/`problem_type` set in the app's own logic (`boom` = refused/undelivered, goes straight to shelf) |
| `has_problem` | boolean | set `true` |
| `problem_type` | `hu_hong` \| `sai_hang` | `sai_hang` = "Lỗi khách - Hàng không phải của shop" — this exact case. `hu_hong` = "Lỗi khách - Hàng hỏng" (damaged, a different case, don't confuse) |
| `complaint_status` | `none` → `pending` → `submitted` → `resolved` \| `lost` | the app auto-sets `pending` the moment `has_problem` is checked; `submitted` only gets set once someone has actually filed with the platform — that transition is this skill's Step 5 |
| `complaint_result` | empty \| `thanh_cong` \| `that_bai` | filled in once the platform resolves the dispute |
| `note` | free text | column exists in the DB and is written as `""` on every insert, but **no UI control in the app ever edits or displays it** (confirmed by reading the app's source — no `.e-note`/`edit-note` element anywhere). Safe for this skill to repurpose as "Drive evidence link" without colliding with anything staff do in the app. |

## Why not `warehouse_error_log`

That table (app's "5. Thống kê lỗi" tab) is explicitly for errors that are
the **shop's own fault** (`kho_van` = warehouse/logistics mistake, `san_pham`
= product defect from supplier, `khach_quan` = neutral/objective like wrong
size). A customer sending back a non-shop item is the opposite situation —
it's evidence *against* a customer claim, not a shop mistake — so it only
ever belongs in `warehouse_return_checks.problem_type`, never in the
shop-error log.

## Read-only check before patching (always do this first)

```bash
curl -s "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_return_checks?code=eq.<ORDER_CODE>&select=*" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```

If this returns `[]` (no row), the order hasn't been scanned into the app's
tab "1. Tích đơn hoàn" yet — don't invent a row (you'd have to guess
`platform`/`staff`/`scan_date`); ask the reporter to scan it in first, or
get the platform from them.

## Patch once a row exists

```bash
curl -s -X PATCH "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_return_checks?code=eq.<ORDER_CODE>" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"has_problem": true, "problem_type": "sai_hang", "complaint_status": "pending", "note": "<drive evidence viewUrl>"}'
```

Later, once the complaint is actually filed on the platform (Step 5 of
SKILL.md):

```bash
curl -s -X PATCH "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_return_checks?code=eq.<ORDER_CODE>" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"complaint_status": "submitted"}'
```

And once the platform responds:

```bash
curl -s -X PATCH "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_return_checks?code=eq.<ORDER_CODE>" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"complaint_result": "thanh_cong"}'
```
(or `"that_bai"`).
