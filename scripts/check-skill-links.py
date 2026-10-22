#!/usr/bin/env python3
"""Kiem tra moi tham chieu trong .claude/ deu tro toi file CO THAT trong repo.

Ly do ton tai (su co 2026-10-22): 7 skill viet "xem [[reference_chrome_browsers]]"
nhung file do chua bao gio ton tai -> may PC khong co gi de doc, phien nao doan
truot thi tuong la "bi chan khong vao duoc TikTok". Con 12 link khac tro toi file
memory chi nam tren may Mac, PC khong doc duoc.

Quy tac: skill chi duoc tham chieu file NAM TRONG REPO. Khong dung [[wiki-link]]
kieu memory, vi memory khong di theo git sang PC.

Chay: python3 scripts/check-skill-links.py
Tra ve 0 neu sach, 1 neu co link hong.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLAUDE = ROOT / ".claude"

# Link markdown tro ra ngoai (http, mailto...) hoac neo trong trang thi bo qua.
SKIP_PREFIX = ("http://", "https://", "mailto:", "#")

problems = []

for md in sorted(CLAUDE.rglob("*.md")):
    rel_md = md.relative_to(ROOT)
    text = md.read_text(encoding="utf-8")

    # 1) Wiki-link [[...]] - cam hoan toan, vi khong tro toi file that.
    for m in re.finditer(r"\[\[([^\]\n]+)\]\]", text):
        line = text[: m.start()].count("\n") + 1
        problems.append(
            (rel_md, line, f"[[{m.group(1)}]]", "wiki-link khong tro toi file that")
        )

    # 2) Link markdown [ten](duong/dan) - phai ton tai tren dia.
    for m in re.finditer(r"\[[^\]\n]*\]\(([^)\s]+)\)", text):
        target = m.group(1)
        if target.startswith(SKIP_PREFIX):
            continue
        target = target.split("#", 1)[0]
        if not target:
            continue
        if not (md.parent / target).exists():
            line = text[: m.start()].count("\n") + 1
            problems.append((rel_md, line, target, "khong tim thay file"))

if problems:
    print(f"CO {len(problems)} THAM CHIEU HONG:\n")
    for rel_md, line, target, why in problems:
        print(f"  {rel_md}:{line}")
        print(f"      {target}  <-- {why}")
    print(
        "\nCach sua: chep noi dung can thiet vao .claude/shared/ roi tro link toi"
        "\nduong dan tuong doi that (vd ../../shared/ten-file.md). Xem CLAUDE.md."
    )
    sys.exit(1)

print("OK - moi tham chieu trong .claude/ deu tro toi file co that trong repo.")
sys.exit(0)
