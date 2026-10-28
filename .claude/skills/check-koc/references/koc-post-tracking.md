# Theo dõi KOC đã lên bài chưa + hiệu quả (tab "4.Hiệu quả KOC")

Chốt 2026-10-28 (chủ shop Minh). Mục tiêu: sau khi tặng mẫu free cho KOC,
chủ shop mở Google Sheet là biết ngay **đứa nào đã lên bài, đứa nào ôm mẫu
mất tích, và video đó hiệu quả tới đâu** (view / đơn / doanh thu / ROI).

## "Xong" nghĩa là gì

Trong file **"Bảng Chấm Điểm KOC"** (`1-ccH9D7SklgEIqJbLlNEbKlpDlYkzHsikDNUy_Ss9Sc`)
có tab **"4.Hiệu quả KOC"** (sheetId `4040404`), mỗi KOC đã DUYỆT có đủ số và
tự cập nhật. Chủ shop chỉ cần mở tab đó.

## Tab "4.Hiệu quả KOC" — cấu trúc (đã dựng sẵn 2026-10-28)

| Col | Tên | Cách điền |
|---|---|---|
| A | STT | **công thức** — mirror `'3.Quản lý Book'!A` (tự đồng bộ theo đúng dòng) |
| B | Tên KOC | **công thức** — `=IF('3.Quản lý Book'!B2="";"";TRIM('3.Quản lý Book'!B2))` |
| C | Mẫu đã gửi | **công thức** — mirror `'3.Quản lý Book'!F` (cột "Sản phẩm gửi cho KOC") |
| D | Đã lên bài? | **script ghi**: `Đã lên` / `Chưa lên` |
| E | Ngày lên bài | **script ghi** (`DD/MM/YYYY`) |
| F | Link bài đăng | **script ghi** |
| G | View | **script ghi** (số) |
| H | Số đơn | **script ghi** (số) |
| I | GMV (doanh thu) | **script ghi** (số, đ) |
| J | Số video | **script ghi** (số) |
| K | Hoa hồng đã trả | **script ghi** (số, đ) |
| L | Đơn/1.000 view | **công thức**: `=IF(OR($G2="";$G2=0);"";ROUND($H2/$G2*1000;2))` |
| M | Giá vốn mẫu | **script ghi** (tra từ `cost-catalog.json` theo cột C — xem dưới) |
| N | ROI (GMV/vốn) | **công thức**: `=IF(OR($M2="";$M2=0;$I2="");"";ROUND($I2/$M2;1))` |
| O | Xếp loại | **công thức**: `=IF($N2="";"";IF($N2>=10;"Hiệu quả";IF($N2>=3;"Tạm";"Kém")))` |

A/B/C và L/N/O đã có công thức sẵn, **không ghi đè**. Script chỉ ghi
**D, E, F, G, H, I, J, K, M** (các cột dữ liệu + giá vốn).

Tô màu có sẵn (conditional format): O `Hiệu quả`=xanh, `Tạm`=vàng, `Kém`=đỏ;
D `Đã lên`=xanh, `Chưa lên`=đỏ.

## Ngưỡng Xếp loại (chủ shop chốt 2026-10-28, chỉnh sau khi chạy thật nếu cần)

Theo ROI = GMV ÷ giá vốn mẫu: **≥10 = Hiệu quả · 3–<10 = Tạm · <3 = Kém.**

## Nguồn dữ liệu

**TikTok Shop Affiliate Center → mục Nội dung / Video liên kết** (báo cáo
video các nhà sáng tạo gắn link sản phẩm shop). Lấy theo từng KOC: có video
hay không, link, ngày đăng, view, số đơn, GMV, số video, hoa hồng.

- **Ưu tiên XUẤT FILE báo cáo** nếu affiliate center có nút xuất (giống cách
  tải file tháng) → đọc file = **0 token**. Chưa xác minh được có nút xuất
  hay không (phải mở trên PC coi) — **việc đầu tiên cần làm trên PC là kiểm
  tra điều này và lấy 1 file mẫu** để biết đúng tên cột.
- Nếu không xuất được, đành đọc bằng trình duyệt tự động (tốn chút quota).

**Quy tắc "không gắn link = Chưa lên" (chủ shop chốt):** KOC lên bài nhưng
không gắn link affiliate thì sẽ KHÔNG hiện trong báo cáo Nội dung → cứ ghi
`Chưa lên` để chủ shop tự vào check tay. KHÔNG đi mò profile từng đứa.

## Ghép dữ liệu vào đúng dòng

Tab 4 mirror tab Book **theo đúng số dòng**. Với mỗi dòng (KOC) trong Book
đã DUYỆT, tìm KOC đó trong báo cáo affiliate (khớp theo username ở cột B,
nhớ `TRIM` vì vài tên trong Book có lẫn ký tự xuống dòng), rồi ghi D–K, M
vào **cùng số dòng** ở tab 4.

**Bẫy KOC trùng tên nhiều dòng:** vài KOC (vd `trvietanh.2004`) có nhiều
dòng Book (tặng mẫu nhiều lần). Báo cáo affiliate gộp theo nhà sáng tạo nên
không tách được theo từng lần tặng → tạm thời ghi cùng số cho các dòng đó và
ghi chú; đừng coi là chính xác tuyệt đối cho KOC trùng.

## Giá vốn mẫu (cột M)

Đọc `cost-catalog.json` trong repo (`cost.{MÃ}` = giá vốn 1 cái). Lấy mã từ
cột C "Mẫu đã gửi" (format `CL01 - Chất Lông-Shin` → mã `CL01`, cắt phần
trước `" - "`). Nếu C có nhiều mã ngăn bằng dấu phẩy → **cộng** giá vốn các
mã. Mã thiếu trong `missing` (vd CL13) → để trống M, ghi chú.

## Tần suất + vòng đời (chủ shop chốt 2026-10-28)

- Chạy **2 ngày/lần**.
- Mỗi KOC chỉ **theo dõi & cập nhật trong 15 ngày kể từ Ngày lên bài (cột E)**;
  quá 15 ngày thì **đóng băng** số (không ghi đè nữa) để khỏi quét lại mãi.
- KOC chưa lên bài thì vẫn kiểm mỗi lần cho tới khi lên (hoặc chủ shop bỏ).

## Chạy ở đâu + token

Chạy **trên PC trực (DESKTOP-N7T8LNP)**, KHÔNG chạy trên Mac (Mac không vào
TikTok — xem Bước 0 của SKILL.md). Vì **ghi vào Google Sheet cần quyền API**
(Mac ghi qua connector; PC chạy headless thì chưa có credentials Google), nên
cách gọn nhất hiện tại: **gộp vào routine Claude đã có trên PC, chạy bằng
Haiku** cho nhẹ quota. Nếu sau này set service-account Google trên PC thì có
thể tách thành script Python thuần `tools/sync_koc.py` chạy 0 token — khi đó
script tự ghi D–K, M; phần A/B/C/L/N/O vẫn để công thức.

## TODO còn lại (phải làm trên PC)

1. Mở Affiliate Center → xác minh có **xuất file báo cáo Nội dung/Video**
   không, lấy 1 file mẫu → chốt đúng tên cột.
2. Viết phần đọc affiliate + ghi tab 4 (script thuần nếu có creds, hoặc bước
   trong routine Claude/Haiku nếu chưa).
3. Cài chạy 2 ngày/lần. Chạy thử lần đầu, báo chủ shop xem số thật rồi chỉnh
   ngưỡng Xếp loại nếu cần.
