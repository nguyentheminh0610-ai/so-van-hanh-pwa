# Tab "Chấm điểm KOC" trên Sổ Vận Hành — spec (chốt 28/10/2026)

Chủ shop yêu cầu đẩy phần chấm điểm + hiệu quả KOC lên web Sổ Vận Hành thành
**một mục riêng**, để quyết định nhanh: **gửi thêm mẫu cho ai**, và **giục ai
chưa lên bài**. Cập nhật **2 ngày/lần**.

Phần theo dõi số liệu trong Google Sheet: xem
[koc-post-tracking.md](koc-post-tracking.md). File này chỉ nói phần web.

## Kiến trúc — theo đúng khuôn tab "Đánh giá & Trả hàng" (phiên khác dựng 28/10)

**Skill chạy trên PC ghi vào Supabase → web CHỈ ĐỌC.** Không để web đọc thẳng
Google Sheet (dính CORS — `init.js` đã ghi chú). Cách này cũng **gỡ được cái
kẹt "file Export chỉ nằm trên PC"**: PC tải Export, parse, ghi Supabase; web ở
đâu cũng đọc được.

Triết lý schema mượn từ `scripts/cskh-tables.sql`: **mỗi video / mỗi yêu cầu
mẫu = 1 DÒNG**, không lưu "bản báo cáo". Có dữ liệu dạng dòng thì gộp
tuần/tháng chỉ là phép cộng.

App đã có thanh tab (`buildTabsHTML()` trong `init.js`): Dashboard / Tải file &
lịch sử / Đánh giá & Trả hàng → thêm nút **"Chấm điểm KOC"** vào đó.

## 4 quyết định của chủ shop (28/10) — ĐÃ CHỐT

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | "% duyệt" mẫu số là gì | **Chỉ KOC đã chấm điểm**: DUYỆT ÷ (DUYỆT + KHÔNG DUYỆT) trong tab "2.Nhập KOC". KHÔNG cần đi thu số yêu cầu bị hủy/hết hạn. |
| 2 | "Hôm nay lên bài" vs nhịp 2 ngày | **Đổi tên thẻ thành "Mới lên bài (2 ngày gần nhất)"**. Giữ 1 nhịp 2 ngày/lần, không chạy thêm nhịp hằng ngày. |
| 3 | Gộp kỳ tuần/tháng theo gì | **Theo NGÀY ĐĂNG video.** Tức "lứa video đăng trong kỳ đó + toàn bộ thành tích tới nay". ⇒ **KHÔNG cần lưu ảnh chụp số liệu theo thời gian.** |
| 4 | Có làm LIVE không | **CÓ, làm luôn cả LIVE** (số buổi, GMV từ LIVE, ngày LIVE) — nguồn: Phân tích → tab "Buổi LIVE". |

## Màn hình gồm 2 phần

### Phần 1 — Bảng tổng quan
Bảng full lấy từ tab "3.Quản lý Book" (cột A–U): KOC, điểm, kết quả, mẫu yêu
cầu, mẫu gửi, hành động, đã lên bài, ngày đăng, link, view, đơn, GMV, số video,
hoa hồng, đơn/1.000 view, giá vốn, ROI, xếp loại, ghi chú.

### Phần 2 — Tổng quan chỉ số
1. **% duyệt** — theo định nghĩa chốt ở trên.
2. **KOC cần check bài đăng** — danh sách đứa **đã NHẬN mẫu mà chưa đăng**,
   kèm **số ngày đã chờ**, sắp xếp chờ lâu nhất lên trước.
   ⚠️ Phải loại đứa **hàng còn đang đi** (TikTok tab "Đã vận chuyển") ra khỏi
   danh sách này, nếu không sẽ đi giục nhầm người chưa nhận được hàng.
3. **KOC làm việc hiệu quả** — để liên hệ gửi thêm mẫu (tiêu chí bên dưới).
4. **Mới lên bài (2 ngày gần nhất)** — ai vừa đăng **video hoặc LIVE**.
5. **Card gộp cột L→S theo kỳ tuần / tháng** (gộp theo ngày đăng).

## ⚠️ Bẫy tính toán — BẮT BUỘC làm đúng

**KHÔNG được cộng hay lấy trung bình cột Q (Đơn/1.000 view) và S (ROI)** khi
gộp nhiều KOC. Đó là tỷ lệ → phải **tính lại từ số tổng**:
- Đơn/1.000 view của kỳ = (tổng đơn ÷ tổng view) × 1000
- ROI của kỳ = tổng GMV ÷ tổng giá vốn mẫu

Cộng tỷ lệ lại với nhau ra số vô nghĩa.

## Tiêu chí "KOC làm việc hiệu quả" (em đề xuất, chủ shop chưa chốt ngưỡng)

Lý do phải nhiều tiêu chí: **giá vốn mẫu gần như cố định ~55K** nên ROI thực ra
chỉ là xếp hạng GMV, không phân biệt được chất lượng.

| # | Tiêu chí | Ngưỡng đề xuất | Data |
|---|---|---|---|
| 1 | Số đơn | ≥ 10 | ✅ có |
| 2 | Đơn/1.000 view | ≥ 1,0 | ✅ có |
| 3 | ROI | ≥ 50 | ✅ có (cần cột F) |
| 4 | Số video ≥2 hoặc có LIVE | — | ⬜ LIVE cần thêm |
| 5 | Tỷ lệ hoàn ≤ 10% | — | ⬜ **cần thêm** |
| 6 | Tỷ lệ xem hết ≥ 3% | — | ⬜ **cần thêm** |
| 7 | Đăng trong 7 ngày từ khi nhận mẫu | — | ⬜ **cần ngày nhận mẫu** |

Kết quả hiển thị 3 nhóm hành động: 🟢 Nên gửi thêm mẫu (đạt ≥4/7) ·
🟡 Theo dõi tiếp · 🔴 Ngưng gửi (đã đăng mà 0 đơn, hoặc ôm mẫu không đăng).

## Dữ liệu còn THIẾU, phải bổ sung

| Thiếu | Lấy ở đâu |
|---|---|
| Số liệu cho **51/59 KOC** còn lại (mới có 8) | Export `/insights/video-analysis` (chạy ở PC) |
| **Cột F "Sản phẩm gửi cho KOC"** trống ~90% → không có giá vốn → ROI trống | Trang "Đã hoàn thành" có ghi đúng phân loại đã gửi |
| **Cột P hoa hồng** trống 100% | `/insights/transaction-analysis` |
| **Ngày gửi / nhận mẫu** (cho "chờ bao nhiêu ngày" + tiêu chí 7) | "Xem thông tin vận chuyển" ở mỗi dòng yêu cầu mẫu |
| **Trạng thái mẫu** (đang giao / đã nhận chưa đăng / đã đăng) | Tab trạng thái của TikTok |
| **Tỷ lệ hoàn + số món hoàn** (tiêu chí 5) | Có sẵn cột trong `/insights/video-analysis` |
| **Tỷ lệ xem hết** (tiêu chí 6) | Có sẵn cột trong `/insights/video-analysis` |
| **LIVE**: số buổi, GMV, ngày | Phân tích → tab "Buổi LIVE" |

## Thứ tự làm (tránh đụng phiên khác)

Phiên khác **đang sửa dở** `index.html`, `init.js`, `styles.css`, `sw.js` để
thêm tab CSKH → **chưa đụng vào 4 file đó**.

- **Giai đoạn 1 — không đụng file chung, làm được ngay:**
  1. Soạn `scripts/koc-tables.sql` (2 bảng: 1 dòng/yêu cầu mẫu + 1 dòng/nội dung).
  2. Thêm cột mới vào tab Book (hoàn, xem hết, ngày nhận mẫu, trạng thái mẫu, LIVE).
  3. Backfill cột F + đổ số cho toàn bộ KOC (phần đổ hàng loạt chạy ở PC).
  4. Viết `koc.js` (file mới, độc lập).
- **Giai đoạn 2 — sau khi phiên CSKH push xong:** gắn tab vào
  `index.html` + `init.js` (`buildTabsHTML`, `switchToTab`, `init`) + `sw.js`.
  Sửa rất nhỏ, mỗi file vài dòng, theo đúng mẫu CSKH đã làm.
