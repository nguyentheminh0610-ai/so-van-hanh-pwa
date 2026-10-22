# reference_shop_knowledge_base_artifacts

> Các Artifact sống (tự cập nhật, không cần gửi lại file) chứa toàn bộ kiến thức sản phẩm/size và chính sách xử lý lỗi của shop Sometime — nguồn tham chiếu chính khi tư vấn size hoặc xử lý khiếu nại khách.

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Khi cần tư vấn size cho khách hoặc xử lý khiếu nại/lỗi đơn hàng, LUÔN đọc lại (action: "read") các Artifact dưới đây trước khi trả lời — đừng dựa vào bản tóm tắt cũ trong trí nhớ, vì nội dung các link này được chủ shop cập nhật trực tiếp tại đúng URL (không tạo link mới).

**1. [Sometime Product Guide](https://claude.ai/code/artifact/ed18e166-8df6-46e7-8a9c-fff38157436a)** — danh sách đầy đủ SKU (Chất Lông CL01-14, Chất Thun CT01-10, Quần Caro 11 màu), giá, khoảng size bán, và 2 ảnh bảng size chính (`images/size_hoat_hinh.jpg`, `images/size_caro.jpg` — size theo chiều cao/cân nặng). Một số SKU chưa có size cụ thể trong hệ thống (đánh dấu "?": CL06-14, CT08-10, Đỏ 05, Xanh Lá 05) — các mã này cần hỏi thêm hoặc tra trực tiếp trên sàn. Nguồn gốc dữ liệu: Sheet "Bảng giá sỉ các sản phẩm Sometime". Đã bật watch (action: "watch") trong phiên 2026-10-07.

**2. [Tra Cứu Nhanh — Chính Sách Xử Lý Lỗi](https://claude.ai/code/artifact/6dd8bdf0-98b9-4d28-9cac-4c40a7a69c90)** — bảng tra cứu trực tiếp (không phải dạng quiz) mức độ lỗi Nhẹ/Vừa/Nặng cho cả "Sản phẩm có vấn đề" và "Dịch vụ có vấn đề", kèm % hoàn tiền nếu giữ hàng và mã giảm giá đặt lại đơn (10k). Có mục riêng "Xử lý nhanh — lỗi khách tự khắc phục được" (chỉ thừa → cắt, lem màu → tẩy, rách nhỏ → may lại, dài quá → cắt ngắn). Đã bật watch trong phiên 2026-10-07.
   - Link tới quy trình chi tiết từng bước: Quy trình xử lý khiếu nại — https://claude.ai/artifact/Pzr8LET6sEWAuJ3sB1BBJN (và bản trong danh sách artifact của tài khoản: https://claude.ai/code/artifact/ba3cb87b-707b-42b0-947b-24e66a6547a7 — cần đối chiếu xem có phải cùng 1 tài liệu không).
   - Link Google Sheet gốc chứa mẫu câu nguyên văn: https://docs.google.com/spreadsheets/d/1X08EPdWfJeiP4aQGzcA35UGtmTjzbUYcC0jidU-05WE/edit?gid=2081894614

**3. [Workflow Tư vấn Size](https://claude.ai/code/artifact/64af93ea-1432-40a8-a103-d92bb79776ec)** — Claude Doc (do bên project "tư vấn khách" tạo 2026-10-07): Mục tiêu & Phạm vi, Chính sách/Quy tắc (bảng chiều cao-size, ca lệch, tuỳ chỉnh độ dài, thiếu thông tin), Quy trình xử lý + mẫu câu, Phân quyền, Quy tắc ghi chép, Vai trò & báo cáo. **Đã điền đầy đủ 2026-10-07** — toàn bộ số liệu + mẫu câu đã chép lại vào [size-consultation-rules](../skills/size-consultation/SKILL.md), không cần đọc lại link này mỗi lần trừ khi nghi ngờ có cập nhật mới (đã bật watch).

**4. [Workflow CSKH: Phàn nàn · Đánh giá · Trả hàng hoàn tiền](https://claude.ai/code/artifact/178382aa-6df8-4fdd-af48-886b6c18a3fa)** — Claude Doc đầy đủ (không phải pending): Mục tiêu & Phạm vi, Chính sách (bảng Lỗi sản phẩm + Lỗi dịch vụ), Quy trình xử lý (kèm sơ đồ luồng), Phân quyền (Claude tự xử lý gì/luôn hỏi gì), Quy tắc ghi chép, Vai trò & báo cáo. Đây là bản đầy đủ hơn, chi tiết hơn "Tra Cứu Nhanh — Chính Sách Xử Lý Lỗi" ở trên — nên đọc doc này trước khi xử lý khiếu nại phức tạp, dùng "Tra Cứu Nhanh" khi chỉ cần tra nhanh 1 mức lỗi.

**Lưu ý cách đọc Claude Doc (khác Artifact HTML):** dùng tool `mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__read` với `ref:{"object":"project","id":"<id trong link>"}` trước để lấy `tabs[].content.id`, rồi đọc tiếp `ref:{"object":"node","id":"<content id>"}` kèm `engine:"prose"`, `container:{"kind":"project","id":"<doc id>"}`, `payload:{"projection":"outline"}`. Artifact tool's `action:"read"` KHÔNG đọc được Claude Doc đầy đủ (chỉ trả về raw HTML wrapper rỗng).

**Các artifact liên quan khác tìm thấy qua `action: "list"` (chưa đọc kỹ, có thể hữu ích tuỳ ngữ cảnh):** "Onboarding CSKH — Xử lý khiếu nại", "Quiz tư vấn size" (bản đứng riêng, vẫn là artifact HTML dạng quiz, không phải Claude Doc), "SOP: Xử lý hàng trả về không phải của shop" (liên quan [return-not-shop-item-workflow](../skills/return-item-not-shop-product/SKILL.md)), "Quy Trình Xử Lý Khiếu Nại" (ba3cb87b...).

**Why:** Trước đây mình chỉ biết tới 1 Artifact "Quiz đào tạo nhân viên" (dạng trắc nghiệm, không đủ số liệu/case đầy đủ) nên phải tự tra bảng size trên từng trang sản phẩm Shopee/TikTok mỗi lần — vừa chậm vừa dễ thiếu nhất quán. Khi hỏi chủ shop cách lấy dữ liệu đầy đủ (2026-10-07), hoá ra chỉ cần tự gọi `Artifact action:"list"` là thấy toàn bộ 17 artifact trong tài khoản, không cần chủ shop gửi link thủ công.

**How to apply:** Trước khi tư vấn size → đọc lại Sometime Product Guide (ưu tiên ảnh bảng size đúng dòng sản phẩm khách hỏi: Chất Lông hay Chất Thun hay Caro — 3 bảng khác nhau); nếu SKU đó đánh dấu size "?" thì vẫn cần tra trực tiếp trên trang sản phẩm sàn như cách cũ. Trước khi xử lý khiếu nại/hoàn tiền → đọc Tra Cứu Nhanh Chính Sách Xử Lý Lỗi để xác định đúng mức độ + %. Nếu nghi ngờ đã có artifact mới hơn/đầy đủ hơn, chạy lại `action:"list"` để rà soát.
