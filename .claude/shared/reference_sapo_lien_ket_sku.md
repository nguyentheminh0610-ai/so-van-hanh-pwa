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

## Đã sửa 16/11/2026
- TikTok: `Chất Dạ Đen Cao Cấp` L/XL/XXL (từng nối DADEN-M), `Xanh Lá 03` XXL, `Đỏ 04` L/XL — đã nối đúng mã.
- Shopee sản phẩm 26965417538 ("Chất Dạ Đỏ/Đen Cao Cấp", chủ shop xác nhận "Đỏ" là quần đỏ): SKU trên Shopee
  đã đổi lại (Đỏ→DADO-*, Đen→DADEN-*) và 8 biến thể đã nối lại đúng trong Sapo. Trước đó đảo màu, nên các đơn
  "Đỏ" đã trừ nhầm kho "Đen" (Shopee đang giữ 12/11/10 đơn Đỏ XXL/XL/L trong khi kho DADO chỉ còn 4/10/8).
- TikTok Thỏ Nơ L/XL/XXL/3XL, Đỏ 04 L/XL, Xanh Lá 03 XXL: đã sửa SKU người bán bằng Excel chỉnh sửa hàng loạt
  (mẫu "Tất cả thông tin" + cột tồn kho, chọn đúng 3 sản phẩm) rồi trong Sapo: "Cập nhật ngay" (kéo SKU mới) →
  bỏ liên kết sai → "Liên kết tự động" chế độ An toàn → xuất lại file kiểm chứng: 0 liên kết sai (16/11/2026).
- Dạ Đen TikTok (sản phẩm 1732396165109613714): Excel bị TikTok từ chối vì thiếu thuộc tính bắt buộc. Chủ shop
  duyệt điền "Quốc gia xuất xứ" = Việt Nam; "Tên tổ chức chịu trách nhiệm hàng hóa" + "Địa chỉ…" = "Sometime"
  (đúng giá trị các sản phẩm khác của shop đang dùng). Sau đó upload thành công, SKU L/XL/XXL = DADEN-L/XL/XXL,
  khớp liên kết Sapo (4/4).
- Combo mới tạo trên Sapo 16/11/2026 (đã kiểm đủ thành phần): 61 combo Caro 2XL / Shin 02 (2XL–3XL) / Shin 03 (S–3XL)
  / Shin 01+02+03+Patrick ghép size mới, và 9 combo Dài+Short `CB-CT08QS01`, `CB-CT09QS02`, `CB-CT10QS04` (M/L/XL).
  Ghép thành phần: CT08↔`QS-CT-01`, CT09↔`QS-CT-02`, CT10↔`QS-CT-04` (mã short `QS-CT-0x-<size>` CÓ sẵn trên Sapo).
  Dài+Short chỉ có M/L/XL; S/XXL/3XL trên Shopee để trống vì không có hàng.
- Cách tạo combo hàng loạt: trong tab Sapo đã đăng nhập, `fetch` cùng miền: POST `/admin/products.json` (1 biến thể, SKU = mã combo,
  `type:'normal'`, `inventory_management:'bizweb'`) rồi POST `/admin/combos.json` với
  `{combo:{variant_id, combo_items:[{inventory_item_id, variant_id, sku, quantity}]}}`. Cùng size → 1 thành phần quantity 2.
  Giá = 338.000 nếu có CL01/06/07/08, 310.000 các mã khác (giá so sánh 420.000); Dài+Short = 168.000. Tạo 1 cái thử, kiểm
  `/admin/combos/<variantId>.json` rồi mới chạy cả loạt.
- Shopee: "Liên kết tự động" không có lựa chọn an toàn/rủi ro như TikTok, và chế độ "sản phẩm trên trang này" có thể trả 0
  thành công dù SKU khớp. Phải chọn "Sản phẩm trên gian hàng" (hệ thống hiện cảnh báo SKU trùng, giữ mặc định "Chỉ liên kết
  SKU duy nhất (An toàn)"). Combo mới tạo cần "Cập nhật ngay" (kênh Shopee) trước khi nối.
- Shopee còn biến thể trống SKU (16/11/2026): Combo Caro Hồng+Xanh M/L/XL/2XL, Kuromi S, 3XL của Kuromi/Kitty/Vịt Xanh/Lợn Hồng,
  Kitty S. Sản phẩm đặt trước 42574064538 và các mặt hàng ngừng bán: chủ shop bảo bỏ qua.
- "Liên kết tự động" an toàn bỏ qua SKU trùng giữa nhiều sản phẩm sàn (Sapo báo ~32 biến thể trùng SKU) →
  với mã dùng chung nhiều sản phẩm (DADO/DADEN…) phải nối thủ công. Danh sách kết quả trong ô tìm của icon
  "liên kết thủ công" thay đổi vị trí theo dòng; luôn chụp ảnh trước khi bấm Xác nhận.
