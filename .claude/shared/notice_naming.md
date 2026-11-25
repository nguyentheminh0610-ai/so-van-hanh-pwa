# Quy ước đặt tên — Sổ Kho (Việc cần làm) + phiếu giao

Nguồn chuẩn duy nhất (chủ shop chốt 2026-10-20). Skill nào ghi
`warehouse_notices` hoặc tạo phiếu giao SPX/Sapo đều theo file này.

## ⚠️ TẠO ĐƠN Ở ĐÂU: KOC → SAPO, GỬI BÙ → SPX (chủ shop chốt 25/11/2026 — "quan trọng")

| Loại đơn | Tạo ở đâu | Vì sao |
|---|---|---|
| **Gửi mẫu cho KOC** (chủ shop dán tên/SĐT/địa chỉ, không qua yêu cầu mẫu TikTok) | **Sapo** (`sometime-official.mysapo.net`, hãng giao SPX) — mục 3 | Hàng mẫu chưa từng bị trừ kho ở đâu cả → phải tạo trên Sapo để **trừ tồn kho thật**. |
| **Gửi bù hàng giao thiếu** | **SPX trực tiếp** (`spx.vn`) — mục 1 | Đơn gốc của khách trên sàn **đã trừ kho thật rồi**; tạo thêm đơn Sapo là trừ kho 2 lần. |

Chủ shop nói "gửi cho KOC này mẫu X" mà không nói sàn nào → mặc định **Sapo**, không hỏi lại. Mục 2 ("Gửi KOC — tạo trực tiếp
trên SPX") từ 25/11/2026 **không dùng nữa** cho KOC (giữ lại để đọc các đơn cũ); chỉ làm theo mục 2 khi chủ shop nói rõ "tạo
trên SPX".

### MỌI đơn gửi NGOÀI SÀN phải đẩy vào Sổ Kho để kho đóng (chủ shop chốt 25/11/2026)

Đơn tạo trên Sapo (mẫu KOC, đơn khách chốt ngoài sàn có thu COD...) hoặc SPX trực tiếp (gửi bù) **không hiện trên màn hình đơn
của TikTok/Shopee**, nên kho không biết mà đóng. Vì vậy tạo xong đơn nào ngoài sàn là **cùng lượt** phải:
1. lấy phiếu giao hàng PDF, đọc lại xác nhận mã vận đơn + người nhận đúng đơn (mục 5),
2. upload PDF lên bucket `notices-pdf`,
3. insert `warehouse_notices` (`done=false`, `pdf_path` = file vừa upload, `order_code` = mã vận đơn SPX) theo mẫu ở mục tương ứng,
4. gửi PDF cho chủ shop.
Chưa có dòng Sổ Kho = đơn chưa xong, kể cả khi đơn đã tạo thành công trên Sapo/SPX.

**Lấy PDF phiếu Sapo (25/11/2026):** nút "In phiếu giao hàng" (menu "..." của kiện hàng) KHÔNG tải file mà mở hộp thoại in của
Chrome — hộp thoại này **treo cả tab**, mọi thao tác Claude in Chrome báo "Script injection timed out" (gặp thật đơn #35874).
Thoát: `navigate` lại URL đơn. Cách lấy PDF chạy được: trước khi bấm, dùng `javascript_tool` chặn `print` của iframe in
(phiếu là HTML nằm trong `iframe[srcdoc]`), bấm "In phiếu giao hàng", rồi tải `outerHTML` của iframe đó thành file `.html`,
chuyển sang PDF bằng Chrome chạy ẩn trên PC:
`chrome.exe --headless=new --no-pdf-header-footer --user-data-dir=<thư mục tạm> --print-to-pdf=<file>.pdf file:///<file>.html`.

## Nguyên tắc chung

- **Có dấu tiếng Việt**. Gửi JSON từ file UTF-8 (`--data-binary @file.json`),
  không gõ thẳng `-d`.
- **Tên phân loại** lấy đúng từ `.claude/shared/sku_names.json` (vd `CL01` →
  `Chất Lông-Shin`, `CL06` → `Chất Lông-Shin 02`). Không ghi mã SKU, không
  ghi tên listing dài kiểu `Quần Lông Sometime - ...`.
- Size viết ngay sau tên phân loại, không chữ "size": `Quần Chất Lông-Shin XL`.
- **Sổ Kho luôn ghi số lượng** trước mỗi món: `1 Quần Chất Lông-Shin XL`.
  Nhiều món nối bằng ` + `.
- Sổ Kho đã tự hiện nhãn loại ("Gửi đơn bù" / "Thông báo chung") trước nội
  dung → **không lặp lại chữ "Gửi bù" trong `content`**.
- Ghi chú thêm (nếu có) để trong ngoặc ở cuối: `(đổi size L->M theo khách yêu cầu)`.
- Không ghi phí ship.

## 1. Gửi bù — tạo trực tiếp trên SPX

**Phiếu giao (SPX, "Thêm sản phẩm mới" → gõ tên → bấm "tạo mới"; không chọn
sản phẩm cũ gợi ý sẵn):**
```
Gửi bù - <mã đơn gốc> - Quần <tên phân loại> <size>
```
Vd: `Gửi bù - 586635843530425651 - Quần Chất Lông-Shin XL`

**⚠️ Gửi bù NHIỀU MÓN KHÁC NHAU (khác phân loại hoặc khác size) — MỖI MÓN 1 DÒNG
SẢN PHẨM RIÊNG trên SPX (sửa lỗi 25/11/2026):** bấm "Thêm sản phẩm mới" một lần
cho từng món, mỗi dòng tự mang tên đầy đủ `Gửi bù - <mã đơn gốc> - Quần <tên
phân loại> <size>` và **số lượng của riêng món đó**. **CẤM** nối nhiều món bằng
` + ` vào 1 tên sản phẩm rồi cộng dồn số lượng. Vd thiếu 1 Shin L + 1 Shin 02 L:
```
1. Gửi bù - 587275116939019871 - Quần Chất Lông-Shin L       SL 1
2. Gửi bù - 587275116939019871 - Quần Chất Lông-Shin 02 L    SL 1
```
Chỉ khi cùng phân loại + cùng size mới là 1 dòng với SL > 1.
*Lý do:* đơn SPXVN06351246242B (23/11, khách xlg.no2) và SPXVN06312903536B bị in
nhãn `Quần Chất Lông-Shin L + Quần Chất Lông-Shin 02 L, SL: 2` — đọc thành "2 bộ
gồm 2 quần" (4 chiếc) cũng được, kho không biết mỗi mẫu mấy chiếc. Nguyên nhân:
file dữ liệu chốt chỉ có 1 ô `item_name` + 1 ô `qty`, và quy ước ở đây chỉ có
mẫu cho 1 món. Form SPX không cho thêm dòng thứ 2 → DỪNG, ghi `[chờ anh]`,
không gộp.

**Sổ Kho:** `category = "gui_don_bu"`, `order_code` = mã vận đơn SPX **mới**
(Sổ Kho vẫn 1 dòng, nhiều món nối ` + `, mỗi món có SL riêng — phần này không đổi)
```
<mã đơn gốc> - <SL> Quần <tên phân loại> <size>
```
Vd: `586635843530425651 - 1 Quần Chất Lông-Shin XL`
→ app hiện: `Gửi đơn bù - SPXVN06220982510A - 586635843530425651 - 1 Quần Chất Lông-Shin XL`

PDF: nút "In vận đơn" → "Tải" trên SPX, tên file `<mã_SPX>_guibu_<tên_khách_không_dấu>.pdf`.

## 2. Gửi KOC — tạo trực tiếp trên SPX (KHÔNG dùng nữa từ 25/11/2026 — KOC tạo qua Sapo, xem bảng đầu file + mục 3)

**Phiếu giao (SPX):**
```
Gửi KOC - <tên KOC> - Quần <tên phân loại> <size>
```
**Nhiều món khác nhau (khác phân loại hoặc khác size) → MỖI MÓN 1 DÒNG SẢN PHẨM
RIÊNG, mỗi dòng số lượng riêng** (chủ shop chốt 25/11/2026, thay cho quy tắc cũ
20/10 "nối các món bằng ` + ` trong 1 tên"; cùng lý do với gửi bù ở mục 1 — nhãn
gộp `Quần A + Quần B, SL: 2` không cho biết mỗi mẫu mấy chiếc). Vd:
```
1. Gửi KOC - Hoàng Trung Thảo - Quần Chất Lông-Shin L       SL 1
2. Gửi KOC - Hoàng Trung Thảo - Quần Chất Lông-Shin 02 L    SL 1
```
Form SPX không cho thêm dòng thứ 2 → dừng, báo chủ shop, không gộp.

**Sổ Kho:** `category = "thong_bao_chung"`, `order_code` = mã vận đơn SPX
```
Gửi KOC - <tên KOC> - <SL> Quần <tên phân loại> <size> + <SL> Quần ...
```

PDF: như mục 1, tên file `<mã_SPX>_koc_<tên_KOC_không_dấu>.pdf`.

## 3. Gửi KOC — tạo trên Sapo (hãng giao SPX)

**Phiếu giao:** do Sapo in, tên sản phẩm lấy từ kho Sapo (không sửa được).
Chỉ điền **Ghi chú đơn** trên Sapo:
```
Gửi KOC - <tên KOC>
```

**Sổ Kho:** `category = "thong_bao_chung"`, `order_code` = mã vận đơn **SPX**
(không phải số đơn Sapo)
```
Gửi KOC - <tên KOC> - <SL> Quần <tên phân loại> <size> + <SL> Quần ... - đơn Sapo #<mã Sapo>
```
Vd: `Gửi KOC - Hoàng Trung Thảo - 1 Quần Chất Lông-Shin L + 1 Quần Chất Lông-Shin 02 L - đơn Sapo #28463`

PDF: **lấy ngay trong Sapo** (cách lấy file khi nút in chỉ mở hộp thoại in: xem mục "MỌI đơn gửi NGOÀI SÀN" đầu file) — trang chi tiết đơn → "Phiếu giao hàng" → "In
phiếu giao hàng" (phiếu có logo SPX Express + mã vận đơn, người nhận là KOC,
mã đơn hàng #<mã Sapo>). Tên file `<mã_SPX>_koc_<tên_KOC_không_dấu>.pdf`.

## 4. KOC thêm/đổi mẫu (TikTok affiliate)

**Phiếu giao:** TikTok tự in. Chỉ "Thêm lưu ý" (≤100 ký tự):
```
<tên phân loại> + <tên phân loại> (giữ nguyên size)
```

**Sổ Kho:** `category = "thong_bao_chung"`, `order_code` = mã đơn TikTok
```
KOC <username> thêm mẫu: <tên phân loại> + <tên phân loại> (giữ nguyên size)
```
Không có PDF.

## 5. Kiểm tra PDF trước khi upload — bắt buộc

Mở/đọc PDF: mã vận đơn in trên phiếu phải trùng `order_code`, người nhận và
hàng phải đúng đơn đó. Không chọn file chỉ theo "PDF mới nhất trong
Downloads" — lỗi 2026-10-20: đơn KOC SPXVN06076853218A bị gắn nhầm nhãn gửi
bù SPXVN06220982510A vì 2 đơn tạo cách nhau 1 phút.
