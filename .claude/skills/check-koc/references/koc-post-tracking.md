# Theo dõi KOC đã lên bài chưa + hiệu quả (tab "3.Quản lý Book", cột I–T)

Chốt 2026-10-28 (chủ shop Minh). Mục tiêu: sau khi tặng mẫu free cho KOC,
chủ shop mở Google Sheet là biết ngay **đứa nào đã lên bài, đứa nào ôm mẫu
mất tích, và video đó hiệu quả tới đâu** (view / đơn / doanh thu / ROI).

## "Xong" nghĩa là gì

Trong file **"Bảng Chấm Điểm KOC"** (`1-ccH9D7SklgEIqJbLlNEbKlpDlYkzHsikDNUy_Ss9Sc`),
tab **"3.Quản lý Book"** (sheetId `1952146322`), mỗi KOC đã DUYỆT có đủ số ở
**cột I–T** và tự cập nhật. Chủ shop chỉ cần mở tab đó — 1 KOC = 1 dòng, thấy
cả mẫu đã gửi lẫn hiệu quả.

**Lịch sử:** ban đầu (28/10) dựng ở tab riêng "4.Hiệu quả KOC"; chủ shop yêu
cầu gộp chung vào Book cho đỡ nhảy tab → đã gộp từ **cột I** và **xoá tab 4**.
Hai cột cũ `Giá book` + `Deadline đăng` bị thay (cả hai trống ở mọi dòng, không
mất dữ liệu). Chủ shop chốt **bỏ hẳn cột Deadline**.

## Cột I–T (xem bảng đầy đủ ở [sheet-structure.md](sheet-structure.md))

| Col | Tên | Ai điền |
|---|---|---|
| I | Đã lên bài? | script — `Đã lên` / `Chưa lên` |
| J | Ngày lên bài | script — `DD/MM/YYYY` |
| K | Link bài đăng | script |
| L | View | script |
| M | Số đơn | script |
| N | GMV (doanh thu) | script |
| O | Số video | script |
| P | Hoa hồng đã trả | script |
| Q | Đơn/1.000 view | **công thức — không ghi đè** |
| R | Giá vốn mẫu | script (tra `cost-catalog.json`) |
| S | ROI (GMV/vốn) | **công thức — không ghi đè** |
| T | Xếp loại | **công thức — không ghi đè** |

Script chỉ ghi **I, J, K, L, M, N, O, P, R**. Tô màu đã có sẵn: I `Đã lên`=xanh
/ `Chưa lên`=đỏ; T `Hiệu quả`=xanh / `Tạm`=vàng / `Kém`=đỏ.

⚠️ `Ghi chú` giờ ở **cột U**, nhãn `Tìm KOC` ở **V**, ô gõ tìm ở **W1**.

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

Với mỗi dòng DUYỆT trong Book, khớp username ở **cột B** (nhớ `TRIM` vì vài
tên có lẫn ký tự xuống dòng) với tên nhà sáng tạo trong báo cáo affiliate, rồi
ghi I–P, R vào **chính dòng đó**.

**Bẫy KOC trùng tên nhiều dòng:** vài KOC (vd `trvietanh.2004`) có nhiều dòng
Book (tặng mẫu nhiều lần). Báo cáo affiliate gộp theo nhà sáng tạo nên không
tách được theo từng lần tặng → tạm thời ghi cùng số cho các dòng đó và ghi chú
ở cột U; đừng coi là chính xác tuyệt đối cho KOC trùng.

## Giá vốn mẫu (cột R)

Đọc `cost-catalog.json` trong repo (`cost.{MÃ}` = giá vốn 1 cái). Lấy mã từ
**cột F "Sản phẩm gửi cho KOC"** (format `CL01 - Chất Lông-Shin` → mã `CL01`,
cắt phần trước `" - "`). Nếu F có nhiều mã ngăn bằng dấu phẩy → **cộng** giá
vốn các mã. Mã nằm trong danh sách `missing` (vd CL13) → để trống R, ghi chú.
F trống (chưa điền mẫu đã gửi) → để trống R, ROI sẽ tự trống theo.

## Tần suất + vòng đời (chủ shop chốt 2026-10-28)

- Chạy **2 ngày/lần**.
- Mỗi KOC chỉ **theo dõi & cập nhật trong 15 ngày kể từ Ngày lên bài (cột J)**;
  quá 15 ngày thì **đóng băng** số (không ghi đè nữa) để khỏi quét lại mãi.
- KOC chưa lên bài thì vẫn kiểm mỗi lần cho tới khi lên (hoặc chủ shop bỏ).

## Chạy ở đâu + token

Chạy **trên PC trực (DESKTOP-N7T8LNP)**, KHÔNG chạy trên Mac (Mac không vào
TikTok — xem Bước 0 của SKILL.md). Vì **ghi vào Google Sheet cần quyền API**
(Mac ghi qua connector; PC chạy headless thì chưa có credentials Google), nên
cách gọn nhất hiện tại: **gộp vào routine Claude đã có trên PC, chạy bằng
Haiku** cho nhẹ quota. Nếu sau này set service-account Google trên PC thì có
thể tách thành script Python thuần `tools/sync_koc.py` chạy 0 token — khi đó
script tự ghi I–P, R; Q/S/T vẫn để công thức.

## TODO còn lại (phải làm trên PC)

1. Mở Affiliate Center → xác minh có **xuất file báo cáo Nội dung/Video**
   không, lấy 1 file mẫu → chốt đúng tên cột.
2. Viết phần đọc affiliate + ghi cột I–P, R (script thuần nếu có creds, hoặc
   bước trong routine Claude/Haiku nếu chưa).
3. Cài chạy 2 ngày/lần. Chạy thử lần đầu, báo chủ shop xem số thật rồi chỉnh
   ngưỡng Xếp loại nếu cần.
