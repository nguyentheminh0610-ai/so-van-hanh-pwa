# -*- coding: utf-8 -*-
"""Sinh bộ file nạp vào Sapo Chat OmniAI > Chatbot AI (27/10/2026).

  out/bang-tra-size-<dòng>.docx  -> mục "Tài liệu" (mỗi dòng quần 1 file, Sapo khuyên tách file nhỏ)
  out/faq-sapo.xlsx               -> 2 cột câu hỏi / hướng dẫn trả lời, nhập vào "Câu hỏi thường gặp"
  out/bo-test.xlsx                -> tin nhắn thử + câu trả lời đúng của skill, để chấm Sapo AI
Chạy:  python build_sapo_files.py
"""
import os
import random

import docx
import openpyxl
from openpyxl.styles import Alignment, Font

from size_engine import LEN_A, LEN_B, LINES, ORDER, T, compute, fmt_height, reply, show, size_by_weight

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

LM = {"cham_got": "chạm gót", "mat_ca": "mắt cá", "quet_dat": "quét đất"}
FLAG_NOTE = {"clamped_min": " – KẸP size nhỏ nhất, quần dài hơn mốc này", "clamped_max": " – KẸP size lớn nhất, quần ngắn hơn mốc này"}


def cell(r):
    note = "".join(FLAG_NOTE[f] for f in r["flags"] if f in FLAG_NOTE)
    return f"size {show(r['size'])} ({r['length']}cm){note}"


def overweight(w, pref, key):
    """Khách thừa cân: size theo bảng cân nặng rồi mới xét mốc dài + kẹp (B2 -> B3 -> B4)."""
    ln = LINES[key]
    idx = ORDER.index(size_by_weight(w, ln["table"])) + {"mat_ca": -1, "quet_dat": 1}.get(pref, 0)
    av = ln["sizes"]
    flags = []
    if idx < ORDER.index(av[0]):
        size = av[0]; flags.append("clamped_min")
    elif idx > ORDER.index(av[-1]):
        size = av[-1]; flags.append("clamped_max")
    else:
        size = ORDER[idx]
    return {"size": size, "length": (LEN_A if ln["table"] == "A" else LEN_B)[size], "flags": flags}


def build_lookup_docs():
    for key, ln in LINES.items():
        d = docx.Document()
        d.add_heading(f"Bảng tra size SOME.TIME – {ln['name']}", 1)
        d.add_paragraph(
            f"Dùng cho: {ln['name']}. Size có hàng: {', '.join(show(s) for s in ln['sizes'])}. "
            "Tra đúng dòng chiều cao của khách, lấy size theo mốc dài khách muốn (mặc định chạm gót). "
            "Mỗi dòng đã tính sẵn ngưỡng thừa cân/gầy. Không tự tính lại.")
        d.add_heading("Tra theo chiều cao (cân nặng bình thường hoặc chưa có cân nặng)", 2)
        for h in range(140, 201):
            parts = [f"{LM[p]}: {cell(compute(h, None, None, None if p == 'cham_got' else p, key))}"
                     for p in ("cham_got", "mat_ca", "quet_dat")]
            d.add_paragraph(
                f"Cao {fmt_height(h)} ({h}cm) – {ln['name']}: " + "; ".join(parts) +
                f". Thừa cân nếu nặng từ {h - 90}kg trở lên (nam hoặc không rõ) / từ {h - 93}kg (nữ) → xem mục thừa cân. "
                f"Gầy nếu nặng {h - 120}kg trở xuống → giữ size chạm gót ở trên, dùng câu mẫu gầy.")
        d.add_heading("Khách THỪA CÂN – tra theo cân nặng (thay cho chiều cao)", 2)
        bands = ([0, 60, 70, 77, 85] if ln["table"] == "B" else [0, 65, 70, 80, 90, 100])
        for lo, hi in zip(bands, bands[1:] + [None]):
            res = "; ".join(f"{LM[p]}: {cell(overweight(lo or 50, p, key))}" for p in ("cham_got", "mat_ca", "quet_dat"))
            rng_txt = f"dưới {hi}kg" if lo == 0 else (f"từ {lo}kg đến dưới {hi}kg" if hi else f"từ {lo}kg trở lên (có thể chật)")
            d.add_paragraph(f"Thừa cân, nặng {rng_txt} – {ln['name']}: {res}. Chưa nói mốc thì dùng câu mẫu thừa cân với size chạm gót.")
        d.save(os.path.join(OUT, f"bang-tra-size-{key}.docx"))


FAQ = [
    ("Khách chỉ chào: Hi, Shop ơi, Alo, Có ai không", "Trả lời đúng 1 câu: \"Dạ, bạn cần shop tư vấn gì ạ?\" Không đoán khách định hỏi gì."),
    ("Quần nam nữ mặc chung được không / có unisex không", "Trả lời đúng: \"Dạ quần bên mình nam nữ đều mặc được bạn nha.\""),
    ("Quần có dây rút không", "CHỈ quần Caro có dây rút. Quần lông, quần thun, bộ dài, bộ ngắn, quần short KHÔNG có dây rút, đều là cạp chun co giãn nhiều. Trả lời 1 câu theo đúng dòng khách hỏi, vd quần lông: \"Dạ quần này không có dây rút ạ, cạp chun co giãn nhiều nên bạn yên tâm nha.\" Quần caro: \"Dạ quần caro bên mình có dây rút ạ.\""),
    ("Sợ rộng eo / chật eo / eo to có mặc được không / vòng bụng", "Trả lời đúng: \"Dạ hiện các quần bên mình đều là cạp chun cả, nên không sợ bị rộng/chật eo đâu ạ, bạn cứ yên tâm nha.\""),
    ("Xin bảng size / số đo chi tiết / vòng mông vòng đùi", "Gửi ảnh bảng size của đúng dòng quần kèm câu: \"Dạ bạn xem thêm số đo chi tiết trong bảng size giúp mình nha.\" Không gửi bảng size khi khách không xin."),
    ("Khách hỏi size nhưng không cho chiều cao (chỉ hỏi size nào, mặc size gì)", "Trả lời đúng: \"Dạ bạn cho mình xin chiều cao và cân nặng để mình tư vấn size chuẩn nhé ạ. Thường các bạn 1m55–1m60 mặc M, 1m62–1m74 mặc L ạ.\""),
    ("Khách chỉ cho cân nặng, không có chiều cao (vd 55kg mặc size gì)", "Bắt buộc xin chiều cao, vì sai chiều cao là sai dài quần. Trả lời: \"Dạ bạn cho mình xin chiều cao và cân nặng để mình tư vấn size chuẩn nhé ạ. Thường các bạn 1m55–1m60 mặc M, 1m62–1m74 mặc L ạ.\""),
    ("Mua cho người khác (mua cho mẹ, cho chồng, cho con)", "Hỏi chiều cao và cân nặng của NGƯỜI MẶC, không phải người mua: \"Dạ bạn cho mình xin chiều cao và cân nặng của người mặc để mình tư vấn size chuẩn nhé ạ.\""),
    ("Khách nói size thường mặc của hãng khác (vd mình hay mặc L)", "Không quy đổi size hãng khác. Xin chiều cao: \"Dạ bạn cho mình xin chiều cao và cân nặng để mình tư vấn size chuẩn nhé ạ. Thường các bạn 1m55–1m60 mặc M, 1m62–1m74 mặc L ạ.\""),
    ("Mắt cá, chạm gót, quét đất là dài tới đâu", "Mắt cá: gấu quần ngang mắt cá chân (ngắn nhất). Chạm gót: gấu chạm gót chân, che qua mắt cá (mặc định). Quét đất: dài chạm sàn. Trả lời ngắn 1 câu theo đúng mốc khách hỏi."),
    ("Size L / size M dài bao nhiêu, tới đâu", "Tra dài quần trong Bảng tra size đúng dòng: quần lông/thun/bộ S 92, M 95, L 97, XL 99, 2XL 102, 3XL 105cm; caro M 94, L 97, XL 100, 2XL 104cm. Trả lời: \"Dạ size {size} dài quần {dài}cm, tới tầm chạm gót á.\""),
    ("Còn hàng không / còn size nào / còn size M không", "PHẢI biết khách hỏi đúng phân loại nào (màu, hoạ tiết, mẫu) trước. Chưa rõ thì hỏi: \"Dạ bạn đang hỏi mẫu nào ạ?\" Đã rõ thì tra tồn kho đúng phân loại đó rồi báo các size còn. Không đoán."),
    ("Khi nào có hàng lại / bao giờ về hàng", "Không tự đoán ngày. Trả lời: \"Dạ bạn chờ xíu mình kiểm tra rồi báo ngay ạ.\" rồi chuyển nhân viên."),
    ("Khách chỉ xác nhận sau khi được tư vấn: ok, dạ, vâng, oke shop, cảm ơn", "Nếu khách không hỏi thêm gì thì trả lời đúng: \"Dạ vâng ạ\". Nếu tin cuối của shop đã là \"Dạ vâng ạ\" thì không gửi lại."),
    ("Khiếu nại, giao thiếu, giao nhầm, hàng lỗi, đổi trả, hoàn tiền", "Không tự trả lời. Chuyển nhân viên."),
    ("Đã đặt hàng rồi lo size: sợ về dài quá, hàng có đúng size không, lỡ đặt nhầm size, đổi size đơn", "Đây là CSKH sau mua, không phải tư vấn size mới. Không tự trả lời. Chuyển nhân viên."),
    ("Hỏi giá, khuyến mãi, mã giảm giá, combo, freeship", "Không tự trả lời. Chuyển nhân viên."),
]


def build_faq():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "FAQ"
    ws.append(["Câu hỏi của khách", "Hướng dẫn AI trả lời (≤600 ký tự)", "Người xử lý"])
    for q, a in FAQ:
        assert len(a) <= 600, (q, len(a))
        staff = "Nhân viên" if a.startswith("Không tự trả lời") else "Chatbot AI"
        ws.append([q, a, staff])
    fmt(ws, [45, 90, 14])
    wb.save(os.path.join(OUT, "faq-sapo.xlsx"))


def msg_text(rng, h, w, g, pref, line):
    hs = rng.choice([fmt_height(h), str(h), fmt_height(h).rstrip("0") if h % 10 == 0 else fmt_height(h)])
    ws = "" if w is None else rng.choice([f" {w}kg", f" nặng {w}kg", f" {w} ký", f" {w}kg"])
    gs = {"nam": rng.choice([" nam", " con trai", ""]), "nu": rng.choice([" nữ", " con gái", ""]), None: ""}[g]
    ps = {None: "", "mat_ca": rng.choice([" thích mắt cá", " muốn mặc tới mắt cá"]),
          "cham_got": " thích chạm gót", "quet_dat": rng.choice([" thích quét đất", " muốn dài quét đất"])}[pref]
    ls = " quần caro" if line == "caro" else ""
    tail = rng.choice([" mặc size gì shop", " size nào ạ", " thì lấy size gì vậy", " tư vấn size giúp mình"])
    return f"Mình{gs} cao {hs}{ws}{ps}{ls}{tail}".replace("  ", " ")


def build_tests():
    rng = random.Random(27102026)
    rows = []
    for i in range(70):
        line = "caro" if i % 6 == 5 else "long_shin"
        h = rng.randint(145, 192)
        g = rng.choice(["nam", "nu", None])
        w = None if i % 7 == 3 else max(38, (h - 100) + rng.choice([-25, -12, -5, 0, 3, 6, 9, 12, 18]))
        pref = rng.choice([None, None, "mat_ca", "quet_dat", "cham_got"])
        r = compute(h, w, g, pref, line)
        exp = reply(h, w, g, pref, line, no_card=(line != "caro"))
        rows.append([f"S{i + 1:02d}", msg_text(rng, h, w, g, pref, line), show(r["size"]), r["length"], ", ".join(r["flags"]), exp])
    for q, a in FAQ:
        rows.append([f"F{len(rows) - 69:02d}", q.split("/")[0].split(":")[-1].strip(), "", "", "faq", a])
    rows += [["X01", "m50sz j ạ", "S", 92, "", reply(150, no_card=True)],
             ["X02", "1m6 5 chục ký mặc size gì", "M", 95, "", reply(160, 50, None, None, "long_shin", True)]]
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Test"
    ws.append(["Mã", "Tin khách gửi (gõ vào Xem trước)", "Size đúng", "Dài (cm)", "Cờ", "Câu trả lời đúng của skill",
               "Sapo AI trả lời", "Đạt? (size+dài+đúng mẫu)"])
    for r in rows:
        ws.append(r)
    fmt(ws, [7, 50, 9, 8, 22, 80, 80, 12])
    wb.save(os.path.join(OUT, "bo-test.xlsx"))
    return len(rows)


def fmt(ws, widths):
    for i, wd in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = wd
    for c in ws[1]:
        c.font = Font(bold=True)
    for row in ws.iter_rows():
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")


if __name__ == "__main__":
    build_lookup_docs()
    build_faq()
    n = build_tests()
    print("Xong:", sorted(os.listdir(OUT)), "| số test:", n)
