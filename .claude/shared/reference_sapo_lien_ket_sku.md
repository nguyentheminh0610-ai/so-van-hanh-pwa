# Liên kết SKU sàn ↔ Sapo (cách Sapo trừ kho) — chốt 16/11/2026

**Phạm vi shop còn bán (chốt 16/11/2026):** chỉ quần kẻ caro và quần lông (CL…). Quần jean, quần tây,
vớ, quần 3 sọc thể thao, Polo: đã ngừng bán, KHÔNG cần sửa liên kết/SKU.

## Cơ chế
- Đơn từ TikTok/Shopee về Sapo được gắn vào mã kho bằng **bảng liên kết** (Sapo → Kênh bán hàng →
  TikTok Shop / Shopee → tab Sản phẩm), không phải chỉ dựa vào chữ SKU trên sàn. SKU trên sàn chỉ giúp
  "Liên kết tự động" lúc đầu. Liên kết sai = trừ nhầm mã; chưa liên kết = KHÔNG trừ kho.
- Đơn combo được Sapo tách thành các dòng thành phần (CL06-M + CL07-L…), trừ kho ở mức mã gốc `CLxx-size`.
  Tồn combo = số dẫn xuất: cùng size → tồn ÷ 2 (làm tròn xuống), khác size → min của hai thành phần.
- Quy ước mã combo: `CB-<mã1><mã2>-<size1>-<size2>`, thành phần = `<mã1>-<size1>` + `<mã2>-<size2>`;
  cùng mẫu thì cặp size sắp theo thứ tự (M-L dùng cho cả "M,L" lẫn "L,M").
- Gấu Mài/Thường của jean B01/B02 gộp chung 1 mã kho T (cố ý) — không phải lỗi.

## Cách lấy bảng liên kết (đối chiếu hàng loạt)
1. Sapo → Kênh bán hàng → TikTok Shop (hoặc Shopee) → Sản phẩm → "Thao tác khác" → **Xuất file**
   → chọn gian hàng → "Xuất file" (xlsx). Cột: biến thể sàn, SKU người bán, ID/ mã SKU Sapo đã liên kết.
2. Đối chiếu tên biến thể sàn với thành phần của SKU Sapo đã liên kết; tìm: chưa liên kết, lệch size, đảo màu.
- API khóa private của Sapo KHÔNG đọc được thành phần combo/lịch sử kho (403). Trong trình duyệt đã đăng nhập
  Sapo dùng được: `/admin/combos/<variantId>.json` (thành phần), `/admin/inventory_adjustments/inventory_items/<inventoryItemId>.json?page=&limit=250`
  (lịch sử kho). Trang liên kết chạy trong iframe khác miền → không đọc DOM được, phải thao tác bằng chuột.

## Cách sửa 1 liên kết sai trong giao diện Sapo
Dòng biến thể → icon "bỏ liên kết" (xích đứt, không hỏi xác nhận) → icon "Liên kết sản phẩm thủ công"
→ gõ SKU Sapo vào ô tìm (kết quả khớp lỏng: gõ `DADEN-L` ra cả XXL, XL, L — chọn đúng dòng, rê chuột xem
tooltip tên đầy đủ) → "Xác nhận". Tìm sản phẩm bằng `?query=<SKU hoặc tên>` trên URL trang sản phẩm kênh.
- Lỗi hay gặp: SKU người bán trên sàn bị chép/lệch size (vd. mọi size đều `DADEN-M`). Sửa liên kết ở Sapo
  vẫn cần sửa luôn SKU người bán trên sàn (Excel chỉnh sửa hàng loạt) để tự động liên kết sau này không quay lại sai.

## Đã sửa 16/11/2026 (TikTok)
`Chất Dạ Đen Cao Cấp` L/XL/XXL (từng nối DADEN-M), `Xanh Lá 03` XXL, `Đỏ 04` L/XL — đã nối đúng mã.
Còn: TikTok Thỏ Nơ L/XL/XXL (đang lệch lên 1 size), Shopee "Chất Dạ Đỏ/Đen Cao Cấp" (sản phẩm 26965417538,
nghi đảo màu — chờ chủ shop xác nhận hướng), Caro 2XL chưa có combo trên Sapo.
