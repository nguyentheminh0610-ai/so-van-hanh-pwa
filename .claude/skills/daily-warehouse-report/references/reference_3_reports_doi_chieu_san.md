**NGUỒN GỐC:** nội dung dưới đây là bản sao NGUYÊN VĂN do chủ shop (Thế Minh) dán trực tiếp vào chat 2026-10-07, lấy từ Claude Project "Kho" trên claude.ai, file `claude/quy-trinh-3-bao-cao-doi-chieu-san.md` — đây là bản đã hoàn thiện, KHÔNG được tự diễn giải lại hay sửa đổi logic. Nếu cần sửa, phải hỏi lại chủ shop trước (bản gốc bên claude.ai mới là nơi chỉnh sửa chính thức, file này chỉ là bản sao để Claude Code không quên).

**Why:** Claude Code (phiên local) đã tự suy luận định nghĩa báo cáo kho qua nhiều vòng chỉnh sửa trong cùng ngày 2026-10-07 nhưng sai lệch khá nhiều so với bản chủ shop đã chốt sẵn ở nơi khác. Bài học: trước khi tự suy luận lại 1 quy trình nghiệp vụ phức tạp, nên hỏi chủ shop xem đã có tài liệu sẵn ở Claude Project/nơi khác chưa.
**How to apply:** Đây là nguồn DUY NHẤT dùng để chạy "3 báo cáo đối chiếu sàn" — xem SKILL.md để biết cách thực thi cụ thể (query Supabase, duyệt web lấy dữ liệu sàn).

---

# claude/quy-trinh-3-bao-cao-doi-chieu-san.md

## 3 báo cáo đối chiếu với sàn (Claude tự check qua trình duyệt)

Đây là quy trình anh Minh đưa cho Claude để tự vào trình duyệt (Claude in Chrome, đã đăng nhập sẵn trên máy anh Minh) kiểm tra và báo cáo trong chat — không phải tính năng mới trong web Sổ Kho Pyjama (xem `so-kho-pyjama-web-app.md` cho các tab thật của app). Khi anh Minh yêu cầu kiểm tra (ví dụ "check 3 báo cáo hôm nay"), Claude làm theo đúng quy trình dưới đây và trả lời theo đúng form tin nhắn ở cuối file.

Luồng xử lý 1 đơn thực tế: xác nhận đơn trên sàn → in phiếu gửi hàng → đóng gói (tích vào "Tích đơn đi" trong Sổ Kho) → giao cho shiper → shiper lấy hàng. 3 báo cáo dưới đây kiểm tra 3 điểm nghẽn khác nhau trong luồng này, và đều dùng chung 1 phần dữ liệu lõi (xem mục "Số liệu lõi").

### Số liệu lõi (tính 1 lần, dùng cho cả báo cáo 1 và 2)

1. Lấy toàn bộ đơn trên sàn ở mục "Đang chờ lấy hàng" (TikTok) / "Đã xử lý" (Shopee).
2. Lấy danh sách mã đơn trong sổ kho "Tích đơn đi" (bảng `warehouse_outbound_checks`) của riêng hôm nay (scan_date = hôm nay).
3. Đối chiếu 2 danh sách trên theo mã đơn, chia thành 2 nhóm:
   - Nhóm A — không có trong sổ kho đơn đi hôm nay → đơn này chưa được đóng gói.
   - Nhóm B — có trong sổ kho đơn đi hôm nay rồi → đơn này đã đóng gói/tích đi nhưng sàn vẫn hiện đang chờ lấy/đang xử lý (đã đóng nhưng chưa đi).

### Báo cáo 1 — Shiper đã lấy hàng hay chưa

Chỉ là câu kết luận rút ra từ Nhóm B ở trên, không tính riêng:

- Nhóm B rỗng (0 đơn) → báo "Đã lấy hết".
- Nhóm B có đơn → báo "Chưa lấy hết" (không cần nêu số lượng/mã ở báo cáo này — số lượng đã có ở báo cáo 2 phần "đơn đã đóng nhưng chưa đi").

### Báo cáo 2 — Số đơn chưa đóng (kèm SKU) + đơn đã đóng nhưng chưa đi

1. Số đơn chưa đóng = số đơn ở Nhóm A. Mở từng đơn trong Nhóm A xem chi tiết SKU + số lượng, cộng tổng số lượng theo từng SKU trên tất cả các đơn này. Số này tính chung tất cả đơn chưa đóng, kể cả đơn đã có sẵn trong "Đơn đã in nhưng chưa đóng được" (tab 2, bảng `warehouse_unpacked_log`) rồi — không trừ ra, không tách riêng.
2. Số đơn đã đóng nhưng chưa đi = số đơn ở Nhóm B (chỉ ghi số lượng, không cần liệt kê mã).
3. Đối chiếu chéo (kiểm tra sai sót): so số đơn ở Nhóm A (tính từ bước 1) với số đơn đang có trong "Đơn đã in nhưng chưa đóng được" (`warehouse_unpacked_log`) của hôm nay — 2 số này đo cùng 1 việc (đơn chưa đóng) nhưng từ 2 nguồn khác nhau (1 bên nhân viên tự tích tay trong app, 1 bên Claude tính ra từ đối chiếu sàn + sổ kho), nên về lý thuyết sẽ khớp nhau ~99%. Nếu có lệch (đơn ở nhóm này mà không có ở nhóm kia, hoặc ngược lại) → báo thêm phần lệch đó, liệt kê rõ mã đơn lệch, để anh Minh kiểm tra (đây là phần ~1% có thể có vấn đề thực sự).
4. Lấy SKU/số lượng từng đơn: mở chi tiết từng đơn trên seller center để đọc (sàn không có file xuất gộp sẵn SKU theo đơn ở mục "Đang chờ lấy hàng"/"Đã xử lý").

### Báo cáo 3 — Số đơn quên chưa in

1. Lấy đơn trong mục "Đang chờ vận chuyển" và "Chưa xử lý" trên sàn, có thời gian đặt hàng trong khoảng từ (giờ hiện tại − 48 giờ) đến trước 15:00 hôm nay — loại đơn quá mới (sau 15h hôm nay, chưa đến hạn in) và đơn quá cũ (ngoài 48h, không thuộc phạm vi báo cáo này).
2. Trong khoảng đó, đơn nào chưa chuyển sang trạng thái tiếp theo (chưa in/chưa tạo vận đơn) → tính là "quên chưa in".
3. Báo cáo: chỉ ghi tổng số lượng, không cần liệt kê mã đơn.

### Form tin nhắn báo cáo (mẫu Claude trả lời trong chat)

```
📋 Báo cáo đối chiếu sàn — [ngày hôm nay]

1. Shiper lấy hàng: [Đã lấy hết / Chưa lấy hết]

2. Đơn chưa đóng: [X] đơn
   - [Tên phân loại A]: [size]×[số lượng], [size]×[số lượng]
   - [Tên phân loại B]: [size]×[số lượng]
   (chủ shop sửa 2026-10-13: ghi tên phân loại, vd "Chất Lông-Shin: M×1, L×2", không ghi mã SKU — tra .claude/shared/sku_names.json)
   ...
   Đơn đã đóng nhưng chưa đi: [Y] đơn

   (chỉ hiện dòng dưới nếu có lệch)
   ⚠️ Lệch với sổ "chưa đóng được" tay: [Z] đơn — mã: [...]

3. Đơn quên chưa in (48h gần nhất, trước 15h hôm nay): [N] đơn
```

Nếu cả 3 mục đều "sạch" (shiper lấy hết, không đơn chưa đóng, không lệch, không đơn quên in) thì rút ngắn thành 1 câu: "Cả 3 báo cáo đều ổn — shiper đã lấy hết, không có đơn chưa đóng/quên in."

### Lưu ý chung

- Dữ liệu sổ kho (tích đơn đi, đơn chưa đóng được) lấy qua Supabase REST API (bảng `warehouse_outbound_checks`, `warehouse_unpacked_log`), anon key — xem chi tiết cấu trúc bảng trong `so-kho-pyjama-web-app.md`.
- Dữ liệu sàn lấy bằng cách Claude tự duyệt web vào seller center TikTok Shop / Shopee (anh Minh đã đăng nhập sẵn trên trình duyệt máy mình, Claude không cần đăng nhập lại).
- Cả 3 báo cáo chỉ cần trả lời trong chat theo form trên, không cần thêm mục/bảng mới vào web Sổ Kho.

---

## BỔ SUNG — Báo cáo 4: Đơn gửi bù chưa tích đi (chốt 2026-10-09)

> Phần này do chủ shop yêu cầu thêm trực tiếp trong phiên chat 2026-10-09 (KHÔNG có trong file gốc `claude/quy-trinh-3-bao-cao-doi-chieu-san.md` trên claude.ai) — nếu sau này bản gốc bên claude.ai được cập nhật, đối chiếu lại xem có trùng/mâu thuẫn không.

**Mục đích:** đơn "gửi bù" (gửi lại hàng thiếu cho khách) là 1 lô hàng tạo riêng (mã vận đơn SPX mới, không phải mã đơn gốc) — cần đảm bảo lô gửi bù đó thực sự đã được bàn giao cho shipper (tích vào Sổ Kho), không phải chỉ mới tạo đơn SPX xong rồi quên gửi.

**Cách check:**
1. Lấy danh sách "đơn gửi bù" từ bảng `warehouse_notices` (`category=eq.gui_don_bu`), lọc `created_at` trong 48 giờ gần nhất.
2. Với mỗi dòng, lấy `order_code` (đây là mã vận đơn SPX của lô hàng bù, KHÔNG phải mã đơn gốc — xem field `content` nếu cần đối chiếu ngược lại đơn gốc, dạng "<mã gốc> - <SL> Quần <phân loại> <size>"; dòng cũ có thể là "Gui bu ... - don goc #<mã gốc>").
3. Tra từng `order_code` đó trong `warehouse_outbound_checks` (`?code=eq.<order_code>&select=*`, KHÔNG giới hạn `scan_date` — tra toàn bộ lịch sử).
4. Mã nào **không có** trong `warehouse_outbound_checks` → đơn gửi bù này CHƯA được tích là đã gửi đi thật → cần báo cáo, vì khách đang chờ mà có thể kiện hàng còn nằm ở kho.
5. Báo cáo: **CHỈ thêm mục này vào báo cáo khi có ít nhất 1 đơn gửi bù chưa tích đi** (lệch) — liệt kê số lượng + mã đơn (SPX code) + nội dung ngắn gọn (`content`) của từng đơn lệch đó, để biết hàng gì / đơn gốc nào — khác với Báo cáo 2/3 (chỉ số lượng), vì đây là case cần xử lý gấp (khách đã đợi 1 lần thiếu hàng rồi).
6. Nếu sạch (tất cả đơn gửi bù trong 48h đều đã tích đi rồi) → **KHÔNG viết gì về mục 4 cả**, kể cả không liệt kê danh sách "đã ổn" — im lặng bỏ qua, không thêm dòng/không nhắc tới trong báo cáo. Chủ shop chốt 2026-10-09: chỉ cần biết khi có vấn đề, không cần xác nhận khi mọi thứ bình thường (tránh báo cáo dài dòng không cần thiết).

**Thêm vào form tin nhắn** (sau mục 3, nếu có phát sinh):
```
4. Đơn gửi bù chưa tích đi (48h gần nhất): [N] đơn
   - [mã vận đơn SPX] — [content, vd "586635843530425651 - 1 Quần Chất Lông-Shin L"]
   ...
```
