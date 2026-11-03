# Hệ thống TẢI FILE tự động cho Sổ Vận Hành — lưu Drive theo tháng/tuần

Chốt 31/10/2026 (chủ shop Minh yêu cầu: tải file phục vụ Sổ Vận Hành phải
**miễn phí + ổn định + theo lịch**, lưu Drive theo đúng cấu trúc đang có, có mục
theo tháng và mục theo tuần). Dựng theo mẫu chuẩn
[reference_auto_data_pull_pattern.md](reference_auto_data_pull_pattern.md):
**đẩy việc tải ra khỏi Claude** → script thuần + Playwright chạy trên PC trực,
Task Scheduler gọi theo lịch = **0 token**.

## Chạy ở đâu

**CHỈ trên PC trực** (`C:\sokho\so-van-hanh-pwa`). Lý do: cần profile Chrome đã
đăng nhập sẵn + ổ Google Drive for Desktop đã đồng bộ (đều nằm trên PC). Máy Mac
chỉ sửa code/kiến thức.

## Luồng (0 token)

```
tools/chay_tai_file.py  (orchestrator — Task Scheduler gọi)
  ├─ 1. tools/tai_file_san.py      Playwright mở Chrome đã login → bấm Xuất → tải file
  ├─ 2. tools/xep_file_vao_drive.py  nhận diện file theo NỘI DUNG → copy vào ổ Drive đồng bộ
  └─ 3. tools/up_so_van_hanh.py    (CHỈ bộ THÁNG) upload web + Tính + tự Lưu nếu file sạch
```

- **Lên Drive = miễn phí, ổn định nhất:** script chỉ **ghi file vào ổ Drive for
  Desktop** (mặc định `G:\My Drive`, đổi bằng biến môi trường `SVH_DRIVE_ROOT`).
  Drive tự đẩy lên cloud — **không API key, không token OAuth hết hạn, không gì
  phải bảo trì**.
- Mất đăng nhập / sàn đổi giao diện / file lỗi → **tự gửi Telegram báo**, không
  fail âm thầm (đặt `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` cấp Máy).

## Cấu trúc Drive (ĐÚNG theo cái shop đang có — đã kiểm 31/10)

Gốc **`Dashboard Vận Hành - Data`** (trong My Drive). Giữ **NGUYÊN tên file gốc**
do sàn đặt.

```
Dashboard Vận Hành - Data/
  Tháng 9-2026/            ← lịch THÁNG (tên: "Tháng {M}-{YYYY}", M không zero-pad)
    TikTok Shop/
    Shopee/
  Tháng 10-2026/ ...
  Theo tuần/               ← lịch TUẦN (mới thêm 31/10, theo đề xuất)
    Tuần 44-2026/          ← "Tuần {số tuần ISO}-{YYYY}"
      TikTok Shop/
      Shopee/
```

## Lịch & mức tự động (chốt với chủ shop 31/10)

| Lịch | File | Đích | Đẩy lên Sổ Vận Hành? |
|---|---|---|---|
| **Tháng** | 6 file bắt buộc + Shop Stats + Creator List | `Tháng M-YYYY/` | ✅ upload + Tính + **tự Lưu nếu file sạch** |
| **Tuần** | Đơn hoàn/trả 2 sàn + Tất cả đơn 2 sàn + Shop Stats | `Theo tuần/Tuần Www-YYYY/` | ❌ chỉ lưu trữ Drive |

**Chốt chặn an toàn cho bộ THÁNG** (chủ shop chọn phương án "tự Lưu nếu file
sạch", nhưng có 3 lớp chặn — xem `up_so_van_hanh.py`):
1. Chỉ chạy **sau ngày 20 tháng kế tiếp** (lệch kỳ làm lãi tụt giả tạo — đã đo
   thật tháng 8/2026: báo 10,5% thay vì ~22%). Chưa tới hạn → thoát, không tải.
2. Chạy `check_month_files.py` trước: thiếu file / tải quá sớm / đổi cột → dừng.
3. Sau khi Tính, **quét khối cảnh báo của sổ**; dính bất kỳ cảnh báo chặn nào
   (LỆCH KỲ, THIẾU CỘT, CHƯA KHỚP, CAO hơn thật) → **KHÔNG Lưu**, Telegram báo
   chủ shop tự xem. Sạch hết mới tự bấm "Lưu vào lịch sử".

Task tháng chạy **hằng ngày 05:00** nhưng orchestrator chỉ làm **đúng 1 lần/kỳ**
(qua ngày 20 + marker `~/.svh-tai-file-state/thang-YYYY-MM.done`). Task tuần:
**Thứ Hai 05:30**.

## ➕ Khi cần THÊM 1 FILE MỚI — chỉ sửa 1 chỗ

Toàn hệ chạy quanh **registry khai báo** `tools/registry_tai_file.json`. Thêm 1
file = thêm 1 mục vào mảng `files`:

```json
{
  "id": "ten_duy_nhat", "mo_ta": "...", "san": "tiktok|shopee",
  "role": "KHỚP role trong check_month_files.py (để nhận diện + xếp đúng thư mục)",
  "lich": "thang|tuan", "bat_buoc": true,
  "export": { "url": "...", "nut_text": ["Xuất","Export"], "chon_ky": "...", "ghi_chu": "..." }
}
```

- Nếu file thuộc loại **đã có trong bộ nhận diện** (`role` đã có trong
  `check_month_files.py`) → xong, không đụng code.
- Nếu là **loại file hoàn toàn mới** → thêm 1 nhánh nhận diện trong
  `classify()` của `.claude/skills/thang-moi/scripts/check_month_files.py` (nhận
  theo tên sheet/tiêu đề cột), đặt `role` mới vào `ROLES`, rồi khai trong registry.

## CÀI 1 LẦN TRÊN PC

```powershell
py -m pip install playwright openpyxl
py -m playwright install chromium
cd C:\sokho\so-van-hanh-pwa
py tools\tai_file_san.py --login tiktok    # đăng nhập TikTok vào profile script
py tools\tai_file_san.py --login shopee    # đăng nhập Shopee
# (tuỳ chọn) đặt biến môi trường cấp Máy: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
#            và SVH_DRIVE_ROOT nếu ổ Drive không phải "G:\My Drive"
powershell -ExecutionPolicy Bypass -File scripts\setup-tai-file-task.ps1
```

Chạy thử tay: `py tools\chay_tai_file.py --lich tuan`

## ⚠ PHẦN CÒN PHẢI CHỐT TRÊN PC (chưa test được từ Mac)

Hai chỗ phụ thuộc giao diện thật của sàn, phải mở trang trên PC (đã login) rồi
hoàn thiện — đây là phần "kém ổn định" cố hữu khi sàn là bên thứ 3:

1. **`chon_ky()` trong `tai_file_san.py`** — thao tác chọn khoảng ngày trên bộ
   lịch của từng sàn. Hiện để best-effort + tự chụp màn hình vào `<downloads>/_loi/`
   khi lỗi. Mở trang Xuất thật, xem DOM, điền thao tác chọn lịch cho khớp.
2. **Nút Xuất** — script bấm theo **chữ** trong `registry.nut_text` (bền hơn CSS).
   Nếu sàn dùng chữ khác / cần bấm thêm "Tải xuống" ở danh sách báo cáo đã xuất
   → bổ sung chữ vào `nut_text` hoặc thêm bước trong `tai_mot_file()`.

Sau khi chốt xong trên PC, chạy `--chi <id>` để test từng file:
`py tools\tai_file_san.py --lich thang --downloads C:\tmp\test --chi tiktok_don_hang_thang`

## Phần ĐÃ kiểm chạy đúng (từ Mac, 31/10)

- `xep_file_vao_drive.py`: nhận diện file Income tháng 9 thật → xếp đúng
  `Dashboard Vận Hành - Data/Tháng 9-2026/Shopee/`; tên thư mục khớp Drive.
- Tính kỳ (tháng trước / tuần ISO trước), chốt chặn ngày-20, marker idempotent.
- `up_so_van_hanh.py` lái web theo đúng id phần tử thật: `#up-multi-input`
  (nạp file), `#btn-compute` (Tính), `#btn-save-history` (Lưu); nhãn kỳ nhận qua
  dialog `prompt()`.
