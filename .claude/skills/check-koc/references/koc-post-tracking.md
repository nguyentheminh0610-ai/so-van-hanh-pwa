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

## Nguồn dữ liệu — ĐÃ XÁC MINH THẬT trên Chrome PC ngày 2026-10-28

Mở bằng Claude in Chrome, `select_browser` deviceId `40800ac7-…` (Chrome PC,
có sẵn đăng nhập TikTok). Lưu ý tên hiển thị "Browser N" đổi theo thứ tự kết
nối — hôm xác minh nó hiện là "Browser 3"; **chỉ tin deviceId**.

### 1. "Đã lên bài?" — lấy THẲNG từ trạng thái hàng mẫu của TikTok ⭐

`affiliate.tiktok.com/affiliate/sample/sample-request?shop_region=VN&shop_id=7494594978743617682`

Các tab trạng thái chính là câu trả lời, **không cần suy đoán qua link
affiliate nữa**:

| Tab | Nghĩa | Ghi cột I |
|---|---|---|
| `Đã hoàn thành` (~100+, 3 trang) | KOC **đã đăng bài** | `Đã lên` |
| `Đang tiến hành` | đã nhận mẫu, **chưa đăng** | `Chưa lên` |
| `Đã vận chuyển` / `Sẵn sàng vận chuyển` | hàng còn đang đi | `Chưa lên` |

Mỗi dòng có sẵn **tên KOC + đúng phân loại mẫu đã gửi** (vd `Chất Lông-Shin,L`)
→ khớp được với cột F của Book, và vì **mỗi yêu cầu hàng mẫu là 1 dòng riêng**
nên **giải quyết luôn bẫy KOC xin mẫu nhiều lần** (trvietanh.2004 có 2 dòng
riêng biệt, không bị gộp).

TikTok còn có sẵn tính năng **"Nhắc nhà sáng tạo đăng bài"** (gửi nhắc hàng
loạt cho ai nhận mẫu 5 ngày mà chưa đăng) — dùng được thay cho cột Deadline
đã bỏ.

### 2. Số liệu từng video — nút "Xem nội dung" ở mỗi dòng

Mở modal **"Chi tiết nội dung"**, có: tab `Video n` / `LIVE n` (→ **số video**,
cột O), **Thời gian phát hành** (→ cột J), **lượt xem** (→ L), lượt tim, bình
luận, **số đơn hàng** (→ M), và nút **"Xem video trên TikTok"** (→ link, cột K).

Ví dụ thật đã đọc: `taothao2410` — đăng 21/10/2026, 83 view, 1 tim, 0 bình
luận, **0 đơn hàng**.

### 3. GMV + hoa hồng — mục "Phân tích"

- **Phân tích → Hiệu suất**: `affiliate.tiktok.com/insights/transaction-analysis`
  — bảng theo nhà sáng tạo có **GMV nhà sáng tạo**, **Hoa hồng ước tính**,
  Hoàn tiền. Có chọn khoảng ngày + so sánh kỳ.
- **Phân tích → Tất cả video**: `affiliate.tiktok.com/insights/video-analysis`
  — **từng video 1 dòng**: ngày đăng, nhà sáng tạo, thông tin sản phẩm, và các
  cột số liệu. Đây là nguồn gọn nhất cho cột N (GMV) và P (hoa hồng).

### 4. ⭐ CÓ NÚT "Export" → chạy 0 token được

Cả 2 trang Phân tích đều có nút **Export** ở góc phải bảng. Nghĩa là **tải file
báo cáo được** → script Python thuần đọc file, không cần trình duyệt, **không
tốn token**. (Vẫn còn vướng việc ghi vào Google Sheet cần credentials — xem mục
"Chạy ở đâu + token".)

**Quy tắc cũ "không gắn link = Chưa lên" ĐÃ BỎ** (chốt 28/10 sau khi xác minh):
trạng thái hàng mẫu của TikTok chính xác hơn nhiều, dùng nó thay thế.

## Ghép dữ liệu vào đúng dòng

Với mỗi dòng DUYỆT trong Book, khớp username ở **cột B** (nhớ `TRIM` vì vài
tên có lẫn ký tự xuống dòng) với tên nhà sáng tạo trong báo cáo affiliate, rồi
ghi I–P, R vào **chính dòng đó**.

**Bẫy KOC trùng tên nhiều dòng — đã có cách xử lý (28/10):** vài KOC (vd
`trvietanh.2004`) có nhiều dòng Book vì xin mẫu nhiều lần. **Trang "Yêu cầu
hàng mẫu" cũng tách thành nhiều dòng riêng**, mỗi dòng kèm đúng phân loại mẫu
(vd `Chất Lông-Shin 02,XXL` vs `Chất Lông-Shin 02,M`) → ghép theo **cặp
(tên KOC + phân loại mẫu)** thay vì chỉ theo tên, là khớp đúng từng lần tặng.
Chỉ khi cột F của Book trống mới phải đoán theo thứ tự thời gian.

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

## TODO còn lại

- [x] ~~Xác minh có xuất được file báo cáo không~~ → **CÓ nút Export** (28/10).
- [ ] Bấm Export ở `/insights/video-analysis` + `/insights/transaction-analysis`,
      lấy 1 file mẫu → chốt đúng tên cột để viết parser.
- [ ] Lần chạy đầu: quét 3 trang tab "Đã hoàn thành" + tab "Đang tiến hành",
      ghi cột I–P, R cho toàn bộ KOC trong Book.
- [ ] Cài chạy **2 ngày/lần**; báo chủ shop xem số thật rồi chỉnh ngưỡng
      Xếp loại nếu thấy chưa hợp.

**Lưu ý khối lượng:** ~100+ dòng "Đã hoàn thành" × mở modal từng dòng để lấy
view/đơn là **rất tốn** nếu làm bằng trình duyệt. Ưu tiên đi đường **Export**
(1 file ra hết) và chỉ mở modal cho dòng nào file không có.
