#!/usr/bin/env python3
"""
Decide which "Gia FS" sheet price column applies for a given date.

Usage:
    python3 pick_tier.py [YYYY-MM-DD]      # defaults to today

Rule (as set by the shop owner):
  - day-of-month == 15           -> Mini  (column "Mini FS + Live + KOC 80", ~4% off)
  - day-of-month == month number -> Spike (column "Spike FS + Live+KOC 90", ~5% off)
    (the classic recurring "double date" sale day: 1/1, 2/2, ... 10/10, 11/11, 12/12 --
    this happens exactly once per month, every month, since day-of-month and
    month-number both range 1-12)
  - anything else                -> Normal (column "Nor FS + Live", ~2% off)

If a date is BOTH the 15th and a double-day that's impossible (15 != any
month 1-12), so there's no conflict to resolve.

Prints a JSON object: {"date": ..., "tier": "mini"|"spike"|"normal", "column": "..."}
"""
import sys
import json
import datetime

TIER_COLUMN = {
    "normal": "Nor FS + Live",
    "mini": "Mini FS + Live + KOC 80",
    "spike": "Spike FS + Live+KOC 90",
}


def pick_tier(d: datetime.date) -> str:
    if d.day == d.month:
        return "spike"
    if d.day == 15:
        return "mini"
    return "normal"


def main():
    if len(sys.argv) > 1:
        d = datetime.date.fromisoformat(sys.argv[1])
    else:
        d = datetime.date.today()
    tier = pick_tier(d)
    print(json.dumps({
        "date": d.isoformat(),
        "tier": tier,
        "column": TIER_COLUMN[tier],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
