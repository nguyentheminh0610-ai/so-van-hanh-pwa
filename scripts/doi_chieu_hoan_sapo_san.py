#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Đối chiếu 2 chiều đơn HOÀN: Sapo  <->  file export từ SÀN (lấy SÀN làm chuẩn).

Trả lời đúng 1 câu hỏi: "Có lấy đơn hoàn trên Sapo làm chuẩn được không?"
bằng 4 con số: tổng đơn hoàn trên sàn / khớp / Sapo THIẾU / Sapo THỪA.

Chạy (PC trực):
    python scripts\\doi_chieu_hoan_sapo_san.py --days 39

Cần:
  1. ~/.config/sapo/credentials.json  (store, api_key, api_secret)
  2. Thư mục chứa file export từ sàn (mặc định ~/doi-chieu-hoan).
     - Shopee: Kênh Người Bán -> Hàng hoàn -> xuất Excel
     - TikTok: Đơn hàng -> Trả hàng/Hoàn tiền -> xuất Excel/CSV
     Đặt tên file có chữ "shopee" hoặc "tiktok" để script biết của sàn nào.

⚠️ File export có TÊN + SĐT + ĐỊA CHỈ KHÁCH. Repo này PUBLIC trên GitHub ->
   KHÔNG để file export trong repo. Mặc định script đọc ở ngoài repo.

Vì sao trước đây đối chiếu Sapo <-> sàn hay "sai mã" (xác minh 2026-10-28):
  Sapo KHÔNG sinh mã riêng cho đơn sàn — nó lưu thẳng mã của sàn:
      order.name                            = mã ĐƠN HÀNG của sàn
      name (của phiếu trả)                  = mã phiếu trả/hoàn của sàn
      shipping_info.tracking_number         = mã vận đơn CHIỀU VỀ
      shipping_info.fulfillment_tracking_numbers = mã vận đơn CHIỀU ĐI
  Bẫy thật: với phiếu return_and_refund (khách chủ động trả), mã chiều về
  KHÁC mã chiều đi (vd TikTok đi 862691132843 / về 854167309243). Ai so mã
  chiều về với mã chiều đi sẽ thấy "lệch toàn bộ" dù dữ liệu đúng.
  Với phiếu delivery_failed (bom hàng / giao thất bại) thì 2 mã TRÙNG nhau.
  => Phải so theo TẬP mã, không so 1 mã với 1 mã.
"""
import argparse
import base64
import csv
import datetime
import glob
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import date, timedelta
from xml.etree import ElementTree

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
EDGE_DAYS = 7      # nới biên: phiếu Sapo tạo trễ/sớm hơn sàn vẫn được tính là khớp
SAPO_MAX_PAGES = 40


# --------------------------------------------------------------- tiện ích chung
def norm(raw):
    """Chuẩn hoá mã để so khớp: bỏ mọi ký tự không phải chữ/số, viết hoa."""
    return re.sub(r"[^0-9A-Z]", "", str(raw or "").upper())


def is_code(s):
    """Có giống mã đơn / mã vận đơn không? Lọc bớt SĐT, tiền, ngày tháng, chữ tiêu đề.

    Mọi mã thật đều nhiều số: TikTok đơn 18-19 số, Shopee đơn '261017U5W68FJX'
    (9 số), vận đơn J&T 12 số, SPX 'SPXVN06439951676A'. Đòi >=6 chữ số để loại
    tiêu đề cột đã bỏ dấu kiểu 'MAVANDONHOAN' (12 ký tự, 0 số) khỏi bị coi là mã.
    """
    if not (11 <= len(s) <= 24):
        return False
    if sum(c.isdigit() for c in s) < 6:
        return False
    if s.isdigit() and len(s) < 12:      # SĐT VN 10-11 số -> loại
        return False
    return True


def codes_of(*values):
    """Gom mọi mã hợp lệ từ một đống giá trị bất kỳ."""
    out = set()
    for v in values:
        if v is None:
            continue
        if isinstance(v, (list, tuple, set)):
            out |= codes_of(*v)
            continue
        c = norm(v)
        if is_code(c):
            out.add(c)
    return out


def http(url, headers, data=None, method=None, retries=4):
    import time
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
                return json.loads(body) if body.strip() else None
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503) and attempt < retries:
                time.sleep(2 * (attempt + 1))
                continue
            raise


# ------------------------------------------------------------------ đọc file sàn
def read_xlsx(path):
    """Đọc sheet đầu tiên của .xlsx bằng stdlib (PC không cần cài openpyxl/pandas)."""
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ElementTree.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall(ns + "si"):
                shared.append("".join(t.text or "" for t in si.iter(ns + "t")))

        sheets = sorted(n for n in z.namelist()
                        if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))
        if not sheets:
            return []
        root = ElementTree.fromstring(z.read(sheets[0]))
        rows = []
        for r in root.iter(ns + "row"):
            cells = {}
            for c in r.findall(ns + "c"):
                ref = c.get("r") or ""
                col = re.sub(r"\d", "", ref)
                v = c.find(ns + "v")
                if c.get("t") == "inlineStr":
                    txt = "".join(t.text or "" for t in c.iter(ns + "t"))
                elif c.get("t") == "s" and v is not None:
                    idx = int(v.text or 0)
                    txt = shared[idx] if idx < len(shared) else ""
                else:
                    txt = (v.text or "") if v is not None else ""
                if txt != "":
                    cells[col] = txt
            if cells:
                rows.append(cells)
        if not rows:
            return []
        cols = sorted({c for r in rows for c in r},
                      key=lambda s: (len(s), s))
        return [[r.get(c, "") for c in cols] for r in rows]


def read_csv_any(path):
    for enc in ("utf-8-sig", "utf-16", "cp1258", "latin-1"):
        try:
            with io.open(path, "r", encoding=enc, newline="") as f:
                sample = f.read(8192)
                f.seek(0)
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
                except Exception:
                    dialect = csv.excel
                return [r for r in csv.reader(f, dialect) if any(x.strip() for x in r)]
        except (UnicodeDecodeError, UnicodeError):
            continue
    return []


def platform_of(filename):
    n = os.path.basename(filename).lower()
    if "shopee" in n or "spx" in n:
        return "shopee"
    if "tiktok" in n or "tts" in n:
        return "tiktok"
    return None


def load_san(folder):
    """Đọc mọi file export trong thư mục -> list dòng {platform, codes, raw}."""
    paths = []
    for ext in ("*.xlsx", "*.csv", "*.XLSX", "*.CSV"):
        paths.extend(glob.glob(os.path.join(folder, ext)))
    paths = sorted(set(paths))
    if not paths:
        return [], []

    rows, files = [], []
    for p in paths:
        plat = platform_of(p)
        if plat is None:
            files.append((p, "?", 0, "BỎ QUA — tên file không có 'shopee' hay 'tiktok'"))
            continue
        try:
            table = read_xlsx(p) if p.lower().endswith(".xlsx") else read_csv_any(p)
        except Exception as e:
            files.append((p, plat, 0, "LỖI ĐỌC: %s" % e))
            continue

        n = 0
        for raw in table:
            cs = codes_of(*raw)
            if not cs:
                continue          # dòng tiêu đề / dòng rác
            rows.append({"platform": plat, "codes": cs, "raw": raw, "file": os.path.basename(p)})
            n += 1
        files.append((p, plat, n, "ok" if n else "KHÔNG thấy dòng nào có mã — kiểm tra lại file"))
    return rows, files


# ----------------------------------------------------------------- lấy phiếu Sapo
def sapo_auth():
    path = os.path.expanduser("~/.config/sapo/credentials.json")
    if not os.path.exists(path):
        sys.exit("THIEU FILE: %s (store, api_key, api_secret)" % path)
    cred = json.load(open(path, encoding="utf-8"))
    auth = base64.b64encode(("%s:%s" % (cred["api_key"], cred["api_secret"])).encode()).decode()
    return cred["store"], {"Authorization": "Basic " + auth,
                           "Accept": "application/json", "User-Agent": UA}


def load_sapo(d_from, d_to):
    store, h = sapo_auth()
    out, page = [], 1
    while page <= SAPO_MAX_PAGES:
        d = http("https://%s/admin/order_returns.json?limit=250&page=%d" % (store, page), h)
        batch = (d or {}).get("order_returns") or []
        if not batch:
            break
        out.extend(batch)
        if len(batch) < 250 or batch[-1]["created_on"][:10] < d_from:
            break
        page += 1

    rows = []
    for r in out:
        day = r["created_on"][:10]
        if not (d_from <= day <= d_to):
            continue
        si = r.get("shipping_info") or {}
        order = r.get("order") or {}
        src = r.get("order_source") or ""
        rows.append({
            "platform": "tiktok" if src == "tiktokshop" else ("shopee" if src == "shopee" else src or "?"),
            "sapo_return_id": r["id"],
            "return_code": r.get("name"),
            "order_code": order.get("name"),
            "return_tracking": si.get("tracking_number"),
            "outbound_tracking": "+".join(si.get("fulfillment_tracking_numbers") or []),
            "return_type": r.get("return_type"),
            "shipment_status": r.get("shipment_status"),
            "created_on": day,
            "returned_on": (r.get("returned_on") or "")[:10],
            "qty": r.get("total_quantity"),
            "codes": codes_of(r.get("name"), order.get("name"), si.get("tracking_number"),
                              si.get("reference"), si.get("fulfillment_tracking_numbers")),
        })
    return rows


# ------------------------------------------------------------------- đối chiếu
def reconcile(san_rows, sapo_rows):
    """Khớp 2 chiều theo TẬP mã. Trả về (matched_pairs, san_only, sapo_only)."""
    index = {}
    for s in sapo_rows:
        for c in s["codes"]:
            index.setdefault(c, []).append(s)

    matched, san_only = [], []
    hit_ids = set()
    for row in san_rows:
        found = None
        for c in row["codes"]:
            for cand in index.get(c, []):
                if cand["platform"] == row["platform"]:
                    found = cand
                    break
            if found:
                break
        if found:
            matched.append((row, found))
            hit_ids.add(found["sapo_return_id"])
        else:
            san_only.append(row)

    sapo_only = [s for s in sapo_rows if s["sapo_return_id"] not in hit_ids]
    return matched, san_only, sapo_only


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=39)
    ap.add_argument("--to", default=date.today().isoformat())
    ap.add_argument("--san-dir", default=os.path.expanduser("~/doi-chieu-hoan"))
    ap.add_argument("--out-dir", default=os.path.expanduser("~/doi-chieu-hoan/ket-qua"))
    ap.add_argument("--sapo-only", action="store_true",
                    help="Chỉ kéo phiếu Sapo ra CSV, không cần file sàn")
    a = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")   # console Windows

    d_to = a.to
    d_from = (date.fromisoformat(d_to) - timedelta(days=a.days - 1)).isoformat()
    # nới biên để phiếu Sapo tạo trễ/sớm vẫn khớp được
    w_from = (date.fromisoformat(d_from) - timedelta(days=EDGE_DAYS)).isoformat()
    w_to = (date.fromisoformat(d_to) + timedelta(days=EDGE_DAYS)).isoformat()

    print("KY DOI CHIEU: %s -> %s  (%d ngay, bien +/-%dd cho Sapo)"
          % (d_from, d_to, a.days, EDGE_DAYS))

    sapo_rows = load_sapo(w_from, w_to)
    core = [s for s in sapo_rows if d_from <= s["created_on"] <= d_to]
    print("SAPO: %d phieu tra trong ky (%d ke ca bien)" % (len(core), len(sapo_rows)))

    os.makedirs(a.out_dir, exist_ok=True)
    dump = os.path.join(a.out_dir, "sapo-phieu-tra.csv")
    cols = ["platform", "sapo_return_id", "return_code", "order_code", "return_tracking",
            "outbound_tracking", "return_type", "shipment_status", "created_on",
            "returned_on", "qty"]
    with io.open(dump, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in sorted(core, key=lambda x: x["created_on"]):
            w.writerow(r)
    print("  -> da ghi %s" % dump)

    if a.sapo_only:
        for plat in ("tiktok", "shopee"):
            sub = [s for s in core if s["platform"] == plat]
            same = sum(1 for s in sub
                       if norm(s["return_tracking"]) and norm(s["return_tracking"]) == norm(s["outbound_tracking"]))
            print("  %-7s %3d phieu | %d phieu co ma chieu ve TRUNG chieu di"
                  % (plat, len(sub), same))
        return

    san_rows, files = load_san(a.san_dir)
    print("\nFILE SAN doc tu %s:" % a.san_dir)
    for p, plat, n, note in files:
        print("  [%-7s] %-45s %4d dong  %s" % (plat, os.path.basename(p)[:45], n, note))
    if not san_rows:
        sys.exit("\nCHUA CO DU LIEU SAN. Xuat file tu Shopee/TikTok vao %s roi chay lai." % a.san_dir)

    print("\n" + "=" * 72)
    verdicts = {}
    for plat in ("tiktok", "shopee"):
        sr = [r for r in san_rows if r["platform"] == plat]
        pr = [r for r in sapo_rows if r["platform"] == plat]
        if not sr:
            continue
        matched, san_only, sapo_only_all = reconcile(sr, pr)
        sapo_only = [s for s in sapo_only_all if d_from <= s["created_on"] <= d_to]
        rate = 100.0 * len(matched) / len(sr) if sr else 0.0
        verdicts[plat] = (len(sr), len(matched), len(san_only), len(sapo_only), rate)

        print("\n### %s" % plat.upper())
        print("  Tong don hoan tren SAN (chuan) : %d" % len(sr))
        print("  Khop duoc voi Sapo             : %d  (%.1f%%)" % (len(matched), rate))
        print("  SAPO THIEU (co o san, khong co): %d" % len(san_only))
        print("  SAPO THUA  (co o Sapo, san ko) : %d" % len(sapo_only))

        if sapo_only:
            # phan loai phan THUA: hang that ve kho hay chi hoan tien khong tra hang?
            by_type = {}
            for s in sapo_only:
                k = "%s / %s" % (s["return_type"], s["shipment_status"])
                by_type[k] = by_type.get(k, 0) + 1
            print("     phan loai phan THUA (return_type / shipment_status):")
            for k, n in sorted(by_type.items(), key=lambda x: -x[1]):
                tag = "  <- khong co hang ve kho, binh thuong" if "no_return_required" in k else ""
                print("       %-40s %3d%s" % (k, n, tag))

        if san_only:
            p1 = os.path.join(a.out_dir, "sapo-THIEU-%s.csv" % plat)
            with io.open(p1, "w", encoding="utf-8-sig", newline="") as f:
                w = csv.writer(f)
                w.writerow(["ma_tim_thay", "file_nguon", "du_lieu_dong_goc"])
                for r in san_only:
                    w.writerow([" | ".join(sorted(r["codes"])), r["file"],
                                " | ".join(str(x) for x in r["raw"])[:500]])
            print("  -> %s" % p1)
        if sapo_only:
            p2 = os.path.join(a.out_dir, "sapo-THUA-%s.csv" % plat)
            with io.open(p2, "w", encoding="utf-8-sig", newline="") as f:
                w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
                w.writeheader()
                for r in sorted(sapo_only, key=lambda x: x["created_on"]):
                    w.writerow(r)
            print("  -> %s" % p2)

    print("\n" + "=" * 72)
    print("KET LUAN — co lay don hoan tren Sapo lam chuan duoc khong?")
    for plat, (tot, mt, miss, extra, rate) in verdicts.items():
        if rate >= 98 and miss <= max(2, tot * 0.02):
            v = "DUOC — Sapo du chuan, chi can va phan ho"
        elif rate >= 90:
            v = "CHI THAM KHAO — phai doi chieu san dinh ky"
        else:
            v = "KHONG DUOC — phai lay SAN lam goc"
        print("  %-7s khop %.1f%% (thieu %d / thua %d)  => %s" % (plat, rate, miss, extra, v))


if __name__ == "__main__":
    main()
