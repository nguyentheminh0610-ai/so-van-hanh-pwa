#!/usr/bin/env python3
"""
Turn a raw dump of the "Gia FS" Google Sheet into a {sku_prefix: deal_price}
map for one tier, ready for build_deal_file.py.

Why this exists as its own step: the sheet is the source of truth and can
change (prices get updated, new SKUs get added) -- always re-fetch it fresh
with the Google Sheets tool rather than trusting an old copy, then feed the
raw values through this script. Don't hand-compute percentages; let the
script do it so a typo in a formula never slips into a live price.

Usage:
    python3 make_tier_prices.py <sheet_values.json> <tier> <out.json>

<sheet_values.json> is the raw 2D array as returned by get_values for
range "Gia FS!A1:F100" (or similar) -- i.e. exactly what the Google Sheets
MCP tool hands back under "values". Row 5 (0-indexed 4) is the header
("STT", "Phan loai (SKU - Ten)", "Nor day", "Nor FS + Live",
"Mini FS + Live + KOC 80", "Spike FS + Live+KOC 90", ...); data starts the
row after. Column B holds "CODE - Ten mau" (e.g. "CL01 - Chat Long-Shin");
only the part before " - " is the SKU prefix used for matching.

<tier> is one of: normal | mini | spike
  normal -> column "Nor FS + Live"          (index 4)
  mini   -> column "Mini FS + Live + KOC 80" (index 5)
  spike  -> column "Spike FS + Live+KOC 90"  (index 6)

NOTE: as of 2026-10-09 the sheet gained an extra column C ("Giá trước
giảm trên sàn", the inflated listing price -- see the "giá niêm yết phải
cao hơn giá bán thực" house rule), which shifted every price column one
slot right (Nor day is now D/index 3, not C/index 2). If the sheet's
layout changes again, re-check these indices against a fresh header row
before trusting this script's output -- a silent off-by-one here would
quietly write the wrong column's price into a live flash sale.

Rows with no value in the Nor day/FS columns (blank cells -- e.g. the
PJD-CT-*/PJC-CT-*/QS-CT-* rows that have never had a price filled in) are
skipped automatically; you don't need to hardcode that list. Row
detection no longer depends on a numeric STT in column A (that cell is
sometimes left blank by hand-editing, e.g. CT02) -- instead a row counts
as real data when column B splits on " - " into a bare SKU-code-looking
prefix (letters/digits/hyphens only, no spaces or parentheses), which
also naturally excludes the header row's "Phân loại (SKU - Tên)" even
though it too contains " - ".
"""
import json
import re
import sys

TIER_COL = {"normal": 4, "mini": 5, "spike": 6}
CODE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-]*$")


def to_int(s):
    if s is None:
        return None
    s = str(s).strip()
    if not s:
        return None
    return int(s.replace(".", "").replace(",", ""))


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    values_path, tier, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    if tier not in TIER_COL:
        print(f"tier must be one of {list(TIER_COL)}", file=sys.stderr)
        sys.exit(1)
    col = TIER_COL[tier]

    data = json.load(open(values_path, encoding="utf-8"))
    values = data["values"] if isinstance(data, dict) and "values" in data else data

    out = {}
    skipped_blank = []
    for row in values:
        if not row or len(row) < 2:
            continue
        name = row[1] if len(row) > 1 else None
        if not name or " - " not in name:
            continue
        code = name.split(" - ", 1)[0].strip()
        if not code or not CODE_RE.match(code):
            continue  # header row or anything else that isn't a real SKU code
        price = to_int(row[col]) if len(row) > col else None
        if price is None:
            skipped_blank.append(code)
            continue
        out[code] = price

    json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"Wrote {len(out)} SKU prices for tier='{tier}' to {out_path}")
    if skipped_blank:
        print(f"Skipped (no price in that column): {skipped_blank}")


if __name__ == "__main__":
    main()
