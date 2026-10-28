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

## Ngưỡng Xếp loại (chủ shop chốt lại 2026-10-28 SAU khi chạy thật, thay ngưỡng đầu ≥10/3/<3)

Theo ROI = GMV ÷ giá vốn mẫu: **≥50 = Hiệu quả · 20–<50 = Tạm · <20 = Kém.**

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

## Lần chạy thật đầu tiên — 28/10/2026 (từ máy Mac qua Chrome PC)

Bảng `/insights/video-analysis` (30 ngày 27/9–26/10) có đủ cột:
**GMV đến từ video liên kết · GPM video · Số món bán ra ghi nhận vào video ·
Hoàn tiền · Tỷ lệ xem hết · Lượt xem video · Đơn hàng nhờ video · AOV**,
kèm Ngày đăng + Nhà sáng tạo + ID video.

**Link video dựng từ ID:** `https://www.tiktok.com/@{username}/video/{ID}`

Đã đổ số thật vào Book cho **8 KOC** lấy từ trang 1 (bảng sắp xếp GMV giảm dần
nên trang 1 = nhóm mạnh nhất): zithung07, trvietanh.2004, stuaupinkin, chungg2t,
ima.pongh_, awhtun_, ouishop20, huy_tapphoido (gộp 3 video).

### 3 chướng ngại đã gặp — ĐỌC TRƯỚC KHI LÀM TIẾP

1. **Bảng quá lớn để đọc bằng trình duyệt:** tổng **1.345 video / 68 trang /
   20 dòng mỗi trang** => đọc hết là không khả thi, **bắt buộc đi đường Export**.
2. **File Export tải về MÁY PC.** Phiên chạy trên Mac KHÔNG đọc được file đó
   (Bash chạy ở Mac). => **Phần đổ số hàng loạt PHẢI chạy ở phía PC.** Từ Mac
   chỉ đọc được nội dung trang web, không lấy được file tải về.
3. ~~**Ngưỡng Xếp loại >=10 quá thấp:**~~ **ĐÃ SỬA, nay là >=50/20/<20.** giá vốn mẫu chỉ ~55K đ mà GMV tính bằng
   triệu, nên ROI thực tế rơi vào khoảng **28–93** => gần như ai cũng thành
   "Hiệu quả", mất tác dụng phân loại. **Cần chủ shop chốt lại ngưỡng**
   (gợi ý: >=50 Hiệu quả / 20–50 Tạm / <20 Kém). KOC không ra đơn vẫn đúng là
   Kém (vd `taothao2410`: 83 view, 0 đơn).

### Cột F (Sản phẩm gửi cho KOC) đang trống ở phần lớn dòng

Không có F thì không tra được giá vốn => R trống => **ROI và Xếp loại trống**.
Trang "Đã hoàn thành" của TikTok CÓ ghi đúng phân loại đã gửi (vd
`Chất Lông-Shin,L`) => dùng nguồn đó backfill cột F, rồi R tính theo F.
(28/10 mới điền tay R cho 5 dòng để kiểm công thức, chưa đụng cột F.)

## ⏸ ĐANG DỞ Ở ĐÂU — đọc mục này đầu tiên khi quay lại (28/10/2026)

### Đã xong, KHÔNG cần làm lại
- Tab "3.Quản lý Book" đã có đủ khối cột I–T + công thức Q/S/T + tô màu.
- Ngưỡng Xếp loại đã chốt **>=50 / 20-50 / <20** (đã kiểm chạy đúng).
- **Đã đổ số thật cho 8 KOC** (lấy từ trang 1 của `/insights/video-analysis`,
  khoảng ngày 27/9–26/10/2026). Dòng trong Book (dòng = STT + 1):

  | Dòng | KOC | View | Đơn | GMV | Video | Đã điền R (giá vốn)? |
  |---|---|---|---|---|---|---|
  | 5 | zithung07 | 100.900 | 64 | 11,7tr | 1 | chưa |
  | 8 | trvietanh.2004 | 14.300 | 26 | 5,1tr | 1 | 54.560 |
  | 9 | stuaupinkin | 15.100 | 7 | 1,6tr | 1 | 56.360 |
  | 10 | chungg2t | 6.000 | 14 | 2,8tr | 1 | 54.560 |
  | 12 | ima.pongh_ | 95.400 | 133 | 23,8tr | 1 | chưa |
  | 17 | awhtun_ | 31.600 | 10 | 1,6tr | 1 | 56.360 |
  | 27 | ouishop20 | 15.700 | 10 | 2,1tr | 1 | 54.560 |
  | 36 | huy_tapphoido | 99.900 | 63 | 12,0tr | 3 | chưa |

  Cột P (hoa hồng) CHƯA điền cho dòng nào (bảng video-analysis không có cột
  hoa hồng; phải lấy ở `/insights/transaction-analysis`).

### Việc tiếp theo, theo thứ tự nên làm

**1. Backfill cột F "Sản phẩm gửi cho KOC"** — làm được từ BẤT KỲ máy nào
(chỉ đọc web, không cần tải file). Đây là việc đáng làm trước vì không có F
thì R/ROI/Xếp loại trống ở hầu hết dòng.
- `select_browser` deviceId `40800ac7-074b-4077-be62-257ed7e08ef7` (Chrome PC).
- Mở trang Yêu cầu hàng mẫu, tab **"Đã hoàn thành"** (3 trang, 50 dòng/trang).
- Mỗi dòng ghi sẵn đúng phân loại đã gửi (vd `Chất Lông-Shin,L`) → map sang
  giá trị dropdown trong `'0.Danh mục SKU'!F2:F45` rồi ghi vào cột F của Book.
- Sau đó tính R từ `cost-catalog.json` (xem mục "Giá vốn mẫu").
- Chủ shop đã duyệt cách này 28/10; nếu điền sai mẫu thì chủ shop sửa lại.

**2. Đổ số cho TOÀN BỘ KOC — BẮT BUỘC chạy ở phía PC.**
Bảng có 1.345 video / 68 trang nên phải dùng nút **Export**, mà file Export tải
về máy PC → phiên chạy trên Mac không đọc được (Bash chạy ở Mac). Từ Mac chỉ
lấy được trang 1 như lần này.

**3. Cài chạy 2 ngày/lần** (mỗi KOC theo dõi 15 ngày từ ngày lên bài).
