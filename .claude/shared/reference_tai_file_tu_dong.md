# Hệ thống TẢI FILE tự động cho Sổ Vận Hành — lưu Drive theo tháng

> ## ⚠ CẬP NHẬT 18/11/2026 — LỊCH MỚI "NGÀY 1 + NGÀY 15" (thay cho "chỉ sau ngày 20")
> Chủ shop Minh chốt (phương án A): **hoàn toàn tự động, không đụng tay**.
> - **Ngày 1 hằng tháng** → máy tự tải bộ file THÁNG TRƯỚC, xếp Drive, upload sổ, Tính, **Lưu**.
>   Chủ shop vào xem là có số tháng trước ngay. Số này **chưa chốt** (còn đơn chưa hoàn thành;
>   sổ tự hiện cảnh báo "LỆCH KỲ" trong thẻ lãi lỗ — đó là dấu hiệu "số tạm").
> - **Từ ngày 15** → máy tải LẠI cùng tháng đó, **ghi đè cùng nhãn kỳ** (`01/MM/YYYY – dd/MM/YYYY`),
>   nên mọi đơn đã hoàn thành sau 2 tuần được cập nhật. Chi phí vận hành đã nhập tay được giữ lại.
> - Lý do bỏ quy tắc "sau ngày 20": chủ shop muốn có số ngay đầu tháng; đổi lại chấp nhận số tạm
>   rồi tự cập nhật. Số thật chốt hẳn vẫn đẹp nhất sau ngày 20 (TikTok cần ~3 tuần để "Đã hoàn tất").
> - Task: `Claude - Tai file thang`, chạy **hằng ngày 05:30**; `tools/chay_tai_file.py` tự chọn lần 1/2
>   và dùng marker `~/.svh-tai-file-state/thang-YYYY-MM-l1|l2.done` để mỗi lần chỉ làm 1 lượt; lỗi thì
>   hôm sau tự thử lại; PC tắt đúng ngày thì bật lên chạy bù (`StartWhenAvailable`).
> - **Chặn ghi đè số tốt bằng số hỏng:** cảnh báo `THIẾU CỘT` / `CHƯA KHỚP` → KHÔNG Lưu + Telegram.
>   Cảnh báo mềm (`LỆCH KỲ`, thiếu giá vốn) → vẫn Lưu + Telegram ghi rõ. Lưu xong đọc lại Supabase
>   xác nhận bản ghi cập nhật mới tính thành công.
> - **Dùng chung Chrome riêng** `C:/Users/Admin/koc-chrome-profile` (xem
>   [reference_chrome_rieng_cho_script.md](reference_chrome_rieng_cho_script.md)), chạy bằng Google Chrome
>   cài sẵn (`channel="chrome"`), KHÔNG dùng Chromium của Playwright. Đăng nhập lại: bấm đúp
>   `scripts/dang-nhap-tai-file.bat`. Task này **không được chạy cùng lúc** với `Dong bo KOC` (09:00).
> - Giao diện TikTok đã kiểm thật 18/11 (luồng nằm trong `tools/tai_file_san.py`):
>   Đơn hàng = tab Tất cả → Bộ lọc "Thời gian đã tạo" → Xuất (Excel) → chờ ~30s → "Tải xuống" ở Lịch sử;
>   Trả hàng = lọc "Thời gian tạo" → icon tải xuống (nút icon thứ 3) → Excel → Xuất;
>   Tài chính = Giao dịch → Đã quyết toán → Xuất → chọn khoảng ngày → OK → Xuất → "Lịch sử xuất dữ liệu".
>   Có hộp giới thiệu tính năng hiện trễ chặn click → `dong_popup()` tắt. Bộ lịch lúc `p-picker-*`,
>   lúc `core-picker-*` tuỳ trang → dùng selector `[class*="-picker-…"]`.
> - Giữ NGUYÊN tên file gốc nên Drive có cả file lần 1 và lần 2 (khác giờ xuất) — cố ý, để đối chiếu.
> - Phần "lịch tuần" bên dưới là bản 31/10, **chưa cài task** (chưa có luồng chọn kỳ vắt tháng).

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

---

## Cập nhật 22/11/2026 — Shopee + Income tay (chốt với chủ shop)

- **Shopee đã tự tải được** (chạy thật tháng 10/2026): đơn hàng (`sp_don_hang`, `Order.all.<từ>_<đến>.xlsx`)
  và trả hàng (`sp_tra_hang`, `Order.return_refund.<từ>_<đến+1>.xls` — Shopee cộng thêm 1 ngày cuối tên).
  Cả hai dùng chung 1 danh sách "Lịch sử Xuất Báo cáo" (mở từ trang Đơn hàng), khoảng tối đa 31 ngày,
  bộ chọn ngày `eds-daterange-picker` (nhãn tháng lúc tiếng Việt, lúc tiếng Anh).
- **Income Shopee = chủ shop TỰ TẢI** (registry `thu_cong: true`). Lý do: mục Tài Chính đòi nhập MẬT KHẨU,
  mở khoá chỉ giữ được một lúc (hết trong < 1 ngày), mà script không bao giờ được nhập mật khẩu. Đã thử mục
  "Báo Cáo Của Tôi" (chỉ liệt kê Order.*, không có Income) → không có đường nào không cần mật khẩu, trừ API
  Shopee Open Platform (chưa làm; cần chủ shop đăng ký app + cấp quyền). Code `sp_income` còn trong
  `tai_file_san.py` nhưng KHÔNG được gọi.
  Chủ shop bỏ file `Income*.xlsx` vào `Drive/Dashboard Vận Hành - Data/Tháng M-YYYY/Shopee/`;
  `chay_tai_file.py` lấy file đó vào bộ file. Chưa có → vẫn xếp 5 file kia vào Drive, báo Telegram, hôm sau thử lại.
  **Ngày 15 phải tải lại Income và ghi đè** file đã bỏ hồi ngày 1, nếu không lần 2 dùng số cũ.
- **Sửa lỗi nặng 22/11:** TikTok trả danh sách lịch sử nhiều file; bản cũ lọc `tr, div` + `.last` có thể
  bấm "Tải xuống" của file CŨ (đã tải nhầm file 18/11). Nay `tt_bam_tai_hang` chọn đúng HÀNG theo tên file.
- Chống tải nhầm Shopee: lấy hàng khớp tên ở TRÊN CÙNG (mới nhất); hàng đang "Đang được xử lý" chưa có
  nút Tải về thì chờ. Danh sách Shopee giữ cả file đã tải nên đừng tin "chưa tải".
