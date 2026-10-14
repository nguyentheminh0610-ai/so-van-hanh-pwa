# Sổ Kho Pyjama — fields used by resend-missing-item

Same Supabase project as Sổ Vận Hành:
`https://dyvublxyrldmmnsrfvpz.supabase.co`, anon key = `SUPABASE_ANON_KEY`
in `so-van-hanh-pwa/init.js`.

## `warehouse_error_log` ("sổ lỗi kho")

| column | notes |
|---|---|
| `code` | the **original** order/mã vận đơn (the one that shipped short) |
| `error_type` | `kho_van` for a missing-item mistake (vs. `san_pham` product defect, `khach_quan` customer's own fault) |
| `detail_reason` | `giao_thieu` |
| `reason` | free text, short — e.g. `"giao thieu 1 Chat Long-Shin, M"` |
| `staff` | leave null unless the shop owner says who's responsible |

## `warehouse_notices` ("📌 Việc cần làm")

| column | notes |
|---|---|
| `category` | `gui_don_bu` |
| `order_code` | the **new** SPX mã vận đơn (not the original order code) |
| `content` | keep short: `"Gui bu <SKU> - don goc #<ma don goc>"` — no shipping-fee detail, shop owner finds that clutter |
| `pdf_path` | exact filename of the label PDF — **must match an object actually uploaded to the `notices-pdf` storage bucket**, see below |
| `done` | `false` until staff physically packs/ships it |

## Storage bucket `notices-pdf` (public)

The app's "Xem PDF" button on a `warehouse_notices` row builds this URL
directly from `pdf_path`:

```
https://dyvublxyrldmmnsrfvpz.supabase.co/storage/v1/object/public/notices-pdf/<pdf_path>
```

Setting `pdf_path` without uploading the matching object there returns a
`404 {"error":"not_found","code":"NoSuchKey"}` when the shop owner clicks
"Xem PDF" — the DB write succeeding doesn't mean the file is actually
servable. Always upload first (or in the same step), then write
`pdf_path` as the exact filename used in the upload:

```bash
curl -s -X POST "https://dyvublxyrldmmnsrfvpz.supabase.co/storage/v1/object/notices-pdf/<FILENAME>.pdf" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/pdf" \
  --data-binary "@<local path>"
```

The anon key has write access to this bucket (verified 2026-10-07) — no
extra credential needed. Listing buckets via `GET /storage/v1/bucket`
returns `[]` for the anon key (no list permission), but direct
object GET/POST to a known bucket+key works fine — don't take an empty
bucket list as "no storage access".
