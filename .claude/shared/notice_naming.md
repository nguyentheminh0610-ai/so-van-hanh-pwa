# Quy ước đặt tên — Sổ Kho (Việc cần làm) + phiếu giao

Nguồn chuẩn duy nhất (chủ shop chốt 2026-10-20). Skill nào ghi
`warehouse_notices` hoặc tạo phiếu giao SPX/Sapo đều theo file này.

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

**Sổ Kho:** `category = "gui_don_bu"`, `order_code` = mã vận đơn SPX **mới**
```
<mã đơn gốc> - <SL> Quần <tên phân loại> <size>
```
Vd: `586635843530425651 - 1 Quần Chất Lông-Shin XL`
→ app hiện: `Gửi đơn bù - SPXVN06220982510A - 586635843530425651 - 1 Quần Chất Lông-Shin XL`

PDF: nút "In vận đơn" → "Tải" trên SPX, tên file `<mã_SPX>_guibu_<tên_khách_không_dấu>.pdf`.

## 2. Gửi KOC — tạo trực tiếp trên SPX

**Phiếu giao (SPX):**
```
Gửi KOC - <tên KOC> - Quần <tên phân loại> <size> + Quần <tên phân loại> <size>
```

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

PDF: **lấy ngay trong Sapo** — trang chi tiết đơn → "Phiếu giao hàng" → "In
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
