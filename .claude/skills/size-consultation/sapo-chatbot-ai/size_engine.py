# -*- coding: utf-8 -*-
"""Bộ máy tư vấn size viết lại bằng code, bám đúng size-spec.md (mục 4) + size-rules.json.

Dùng cho dự án Sapo Chatbot AI (27/10/2026): sinh ra bảng tra size "đã tính sẵn"
để nạp vào Sapo (AI của Sapo không tự chạy thuật toán chuẩn được), và sinh bộ test
câu trả lời mẫu để so Sapo AI với skill size-consultation.

Chạy:  python size_engine.py            -> kiểm 20 test case của spec
       python build_sapo_files.py       -> sinh file nạp vào Sapo
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
RULES = json.load(open(os.path.join(HERE, "..", "references", "size-rules.json"), encoding="utf-8"))
T = RULES["reply_templates"]
ORDER = RULES["size_order"]
LANDMARK_TEXT = {"mat_ca": "mắt cá", "cham_got": "chạm gót", "quet_dat": "quét đất"}

# Dải size theo dòng (tên dòng dùng trong file Sapo)
LINES = {
    "long_shin": {"name": "Quần lông Chất Lông-Shin (S–3XL)", "table": "A", "sizes": ["S", "M", "L", "XL", "XXL", "3XL"]},
    "long_m_2xl": {"name": "Quần lông Shin 02 / Shin 03 / Patrick Star (M–2XL)", "table": "A", "sizes": ["M", "L", "XL", "XXL"]},
    "long_m_xl": {"name": "Quần lông các mẫu khác, vd Hello Kitty (M–XL)", "table": "A", "sizes": ["M", "L", "XL"]},
    "caro": {"name": "Quần caro (M–2XL)", "table": "B", "sizes": ["M", "L", "XL", "XXL"]},
    "thun_bo": {"name": "Quần thun / Bộ dài / Bộ ngắn (M–XL)", "table": "A", "sizes": ["M", "L", "XL"]},
}

LEN_A = {r["size"]: r["length_cm"] for r in RULES["table_A_height_decision"]}
LEN_B = {"M": 94, "L": 97, "XL": 100, "XXL": 104}


def show(size):
    return "2XL" if size == "XXL" else size


def size_by_height(h):
    for r in RULES["table_A_height_decision"]:
        if h <= r["max_height_cm"]:
            return r["size"]
    return "3XL"


def size_by_weight(w, table):
    rows = RULES["table_A_weight_decision"] if table == "A" else RULES["table_B_weight_decision"]
    for r in rows:
        if w < r["max_weight_kg"]:
            return r["size"]
    return rows[-1]["size"]


def shift(idx, n):
    return idx + n  # có thể ra ngoài S..3XL (-1 / 6) -> B4 sẽ kẹp và gắn cờ


def compute(height=None, weight=None, gender=None, pref=None, line="long_shin"):
    """Trả về dict {size, length, flags} theo B1→B5."""
    ln = LINES[line]
    flags = []
    if height is None:
        return None
    size = size_by_height(height)                                   # B1
    if weight is not None:                                          # B2
        thr = 7 if gender == "nu" else 10
        diff = weight - (height - 100)
        if diff >= thr:
            size = size_by_weight(weight, ln["table"])
            flags.append("overweight_longer")
        elif diff <= -RULES["weight_threshold"]["underweight_kg"]:
            flags.append("underweight_loose")
    idx = ORDER.index(size)
    if pref == "mat_ca":                                            # B3
        idx = shift(idx, -1)
    elif pref == "quet_dat":
        idx = shift(idx, +1)
    av = ln["sizes"]                                                # B4
    if idx < ORDER.index(av[0]):
        size = av[0]; flags.append("clamped_min")
    elif idx > ORDER.index(av[-1]):
        size = av[-1]; flags.append("clamped_max")
    else:
        size = ORDER[idx]
    length = (LEN_A if ln["table"] == "A" else LEN_B)[size]         # B5
    return {"size": size, "length": length, "flags": flags}


def fmt_height(h):
    m, cm = divmod(h, 100)
    return f"{m}m{cm:02d}"


def reply(height=None, weight=None, gender=None, pref=None, line="long_shin", no_card=False):
    """Câu trả lời đúng mẫu skill (chọn mẫu theo thứ tự ưu tiên ghi trong huong-dan-cai-dat.md)."""
    if height is None:
        return T["missing_height"]
    r = compute(height, weight, gender, pref, line)
    s, L, f = show(r["size"]), r["length"], r["flags"]
    lm = LANDMARK_TEXT[pref or "cham_got"]
    if "clamped_min" in f:
        msg = T["clamped_min"].format(size=s, length=L, landmark=lm)
    elif "clamped_max" in f:
        msg = T["clamped_max"].format(size=s, length=L, landmark=lm)
    elif "overweight_longer" in f and not pref:
        msg = T["overweight_longer"].format(size=s, length=L)
    elif pref:
        msg = T["has_length_pref"].format(size=s, length=L, landmark=lm)
    elif weight is None:
        msg = T["missing_weight"].format(height=fmt_height(height), size=s, length=L)
    elif "underweight_loose" in f:
        msg = T["underweight_loose"].format(size=s, length=L)
    else:
        msg = T["normal"].format(size=s, length=L, landmark=lm)
    if no_card:
        msg += " " + T["default_quan_long_note"]
    return msg


SPEC_CASES = [  # (id, kwargs, size, length)
    (1, dict(height=156, weight=50, gender="nu"), "M", 95),
    (2, dict(height=170, weight=65, gender="nam"), "L", 97),
    (3, dict(height=175, weight=65, gender="nam"), "XL", 99),
    (4, dict(height=168, weight=62, gender="nam", pref="mat_ca"), "M", 95),
    (5, dict(height=168, weight=62, gender="nam", pref="quet_dat"), "XL", 99),
    (6, dict(height=160, weight=50, gender="nu", pref="quet_dat"), "L", 97),
    (8, dict(height=188, weight=80, gender="nam", pref="quet_dat"), "3XL", 105),
    (9, dict(height=150, pref="mat_ca"), "S", 92),
    (10, dict(height=180, weight=95, gender="nam"), "3XL", 105),
    (11, dict(height=160, weight=68, gender="nu"), "L", 97),
    (12, dict(height=170, weight=79, gender="nam"), "L", 97),
    (13, dict(height=170, weight=45, gender="nu"), "L", 97),
    (14, dict(height=150, weight=45, gender="nu", line="caro"), "M", 94),
    (15, dict(height=178, weight=68, gender="nam", line="caro"), "XL", 100),
    (16, dict(height=188, weight=78, gender="nam", line="caro"), "XXL", 104),
    (17, dict(height=175, weight=85, gender="nam", pref="mat_ca"), "XL", 99),
    (18, dict(height=183, weight=75, gender="nam", line="long_m_xl"), "XL", 99),
    (19, dict(height=160), "M", 95),
]

if __name__ == "__main__":
    bad = 0
    for cid, kw, sz, ln in SPEC_CASES:
        r = compute(**kw)
        want = {8: ["clamped_max"], 9: ["clamped_min"], 10: ["overweight_longer"], 11: ["overweight_longer"],
                13: ["underweight_loose"], 14: ["clamped_min"], 16: ["clamped_max"], 17: ["overweight_longer"],
                18: ["clamped_max"]}.get(cid, [])
        ok = r["size"] == sz and r["length"] == ln and all(x in r["flags"] for x in want)
        bad += not ok
        print(f"{'OK ' if ok else 'SAI'} #{cid}: {r}  -> {reply(**kw)}")
    print("Tất cả khớp spec" if not bad else f"{bad} case sai")
