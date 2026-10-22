# project_cskh_task_not_started

> Mục 5 (đánh giá/phàn nàn/trả hàng hoàn tiền): tài liệu SOP 'Workflow CSKH' đã publish, cập nhật liên tục tới 2026-10-07 — phạm vi hiện tại: Claude chỉ xử lý đánh giá công khai + trả hàng/hoàn tiền, inbox tạm dừng. Quiz đào tạo riêng vẫn còn, dùng chung nhiều session.

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Mục (5) trong [ops-assistant-mandate](project_ops_assistant_mandate.md) — "Check đánh giá, xử lý trả hàng/hoàn tiền/phàn nàn của khách" — **đã có tài liệu SOP đầy đủ**, publish và cập nhật liên tục tại:
https://claude.ai/code/artifact/178382aa-6df8-4fdd-af48-886b6c18a3fa

**Để THỰC THI (không phải chỉ đọc): dùng skill `review-return-check`** (`.claude/skills/review-return-check/SKILL.md`, tạo 2026-10-07) — bản ready-to-execute của toàn bộ phần dưới đây, gồm cả URL cụ thể, cách nhắn khách qua icon chat trên trang trả hàng, và đúng format báo cáo. Nếu skill và memory này mâu thuẫn, tin skill trước (được sửa nhanh hơn), rồi quay lại update memory này cho khớp.

**Phạm vi hiện tại (chốt 2026-10-07 — ĐỌC LẠI DOC TRƯỚC KHI HÀNH ĐỘNG, phạm vi đã đổi nhiều lần trong 1 phiên):**
- Kênh đang hoạt động: Đánh giá công khai (TikTok Shop + Shopee) và Yêu cầu Trả hàng/Hoàn tiền chính thức (Seller Center, cả 2 sàn).
- **KHÔNG có lịch/tần suất cố định** — Claude chỉ kiểm tra 2 kênh trên khi chủ shop báo yêu cầu làm ("khi a nhắn"), không tự chạy theo giờ hay định kỳ. Khi ĐƯỢC báo làm thì mới chủ động xem hết (không đợi khách nhắn trong lúc đó). Case trả hàng sắp hết hạn trả lời của sàn: KHÔNG cần báo khẩn riêng, gộp chung vào báo cáo.
- Khách không trả lời tin nhắn hỏi thêm: Claude chỉ cần nhắn 1 lần rồi báo cáo, không chờ/nhắc lại — phần còn lại chủ shop tự xử lý.
- Inbox/chat riêng: TẠM DỪNG — Claude không chủ động kiểm tra, chỉ xử lý khi chủ shop báo cụ thể có case. Lý do: chủ shop đang hoàn thiện tài liệu tư vấn chat + xử lý lỗi sp dịch vụ riêng để tự động hóa phần đó trước, xong mới mở lại inbox cho Claude.
- **Claude chỉ làm tới bước liên hệ khách đầu tiên** — nhắn khách đúng mẫu theo KÊNH phàn nàn thôi (đánh giá xấu → mẫu "Nhắn khách đánh giá xấu"; trả hàng → mẫu "Nhắn khách trả hàng"), không cần phân biệt thêm theo loại vấn đề (vd. không cần mẫu riêng cho case size) — việc xác định nguyên nhân cụ thể (size hay gì khác) là chủ shop tự làm sau khi nhận báo cáo.
- Mọi case liên quan hoàn tiền (không phân biệt ít/nhiều) và mọi bước xử lý sau đó (áp chính sách, soạn phương án, hoàn tiền, xin đánh giá, trả lời công khai dưới đánh giá xấu) đều do chủ shop tự làm — Claude KHÔNG tự quyết hay tự thực hiện ở giai đoạn này.
- **Báo cáo (chốt 2026-10-07, tách riêng theo loại, KHÔNG còn dùng format "3 thông tin mỗi case" nữa):**
  - *Đánh giá:* liệt kê đánh giá mới vừa kiểm tra xong (không nhắc lại đánh giá cũ) + thống kê số lượng theo từng mức sao (5/4/3/2/1 sao) + với đánh giá xấu và đánh giá tốt có insight (có nội dung đáng chú ý, không chỉ chấm sao suông) thì trích đủ nguyên văn để chủ shop đọc trực tiếp.
  - *Trả hàng:* tổng hợp theo lý do trả hàng là gì kèm số lượng case mỗi lý do + nêu riêng tin nhắn bổ sung nào của khách đáng chú ý (không liệt kê hết, chỉ cái nổi bật).
  - Gửi **1 lần gộp chung** sau khi làm xong đợt kiểm tra a vừa báo — không phải báo cáo hàng ngày tự động, không báo riêng từng case.
- Sổ Kho: Claude chỉ ghi (xem [sokho-pyjama-supabase-tables](../skills/daily-warehouse-report/references/reference_sokho_pyjama_tables.md)) sau khi chủ shop báo đã xử lý xong case + xác nhận đúng loại lỗi (chỉ ghi lỗi Kho vận hoặc Sản phẩm/Shop, không ghi lỗi khách quan).
- Link Google Sheet "Mẫu tin nhắn & kịch bản xác nhận lỗi" đã tìm thấy (không cần đợi a gửi nữa — xem [shop-knowledge-base-artifacts](reference_shop_knowledge_base_artifacts.md)): https://docs.google.com/spreadsheets/d/1X08EPdWfJeiP4aQGzcA35UGtmTjzbUYcC0jidU-05WE/edit?gid=2081894614 — có mẫu "Nhắn khách đánh giá xấu", "Nhắn khách trả hàng".

Bảng chính sách gốc (giữ nguyên, đã đưa đầy đủ vào tài liệu trên):
- **Sản phẩm:** Nhẹ (chỉ thừa... → khách tự cắt/vá tại nhà, giữ hàng, hoàn 10–15%), Vừa (lem màu nhẹ, rách nhỏ tự vá được → hoàn 15–20%, giữ hàng), Nặng (sai hẳn màu/mẫu, lỗi vải diện rộng, rách to → KHÔNG giữ hàng, đổi hoặc trả hàng/hoàn tiền qua sàn).
- **Dịch vụ:** Khách quan (sai size do khách chọn — hỏi lý do SAU khi đã đổi hàng xong, không hỏi trước), Nhẹ (giao thiếu hàng → gửi bù ngay hoặc hoàn 100%/80% nếu hết hàng), Vừa (giao sai size/phân loại → đổi hàng, hoàn thêm 30% nếu khách giữ hàng nhận nhầm), Nặng (giao sai hẳn sản phẩm khác → chỉ đổi hàng, không hoàn % giữ hàng, có thể kèm mã giảm giá).

**Quiz đào tạo riêng** (khác với doc SOP trên) vẫn còn, dùng chung nhiều session, tại `https://claude.ai/artifact/Byrr8ZLbLRn6V79cb5NM4m` — 3 phần: "Quiz tư vấn size" (17 câu), "Quiz xử lý khiếu nại" (13 câu), "Quiz dùng Sổ Kho Pyjama" (9 câu). Artifact dùng chung, nhiều session có thể cùng sửa — luôn `action: "read"` lại trước khi publish để không đè mất phần người khác vừa thêm.

**Why:** đây là nguồn chính thức duy nhất cho chủ đề này. Phạm vi vận hành (ai làm gì, kênh nào đang bật) đã đổi NHIỀU LẦN trong phiên 2026-10-07 (thu hẹp dần từ "Claude làm hết" xuống "Claude chỉ liên hệ khách" rồi xuống "chỉ 2 kênh đánh giá+trả hàng, inbox tạm dừng") — đọc doc link trên để lấy state mới nhất, đừng suy luận từ bản tóm tắt cũ hơn.
**How to apply:** trước khi bàn tiếp hoặc tự hành động về CSKH/phàn nàn/đánh giá/trả hàng, đọc lại doc ở link trên để lấy đúng phạm vi hiện tại — đặc biệt 2 điểm dễ hiểu nhầm: (1) Claude chỉ liên hệ khách rồi báo cáo, KHÔNG tự áp chính sách/hoàn tiền; (2) inbox đang tạm dừng, chỉ đụng vào khi chủ shop báo cụ thể. Khi cần mẫu câu trả lời khách hoặc đối chiếu mức độ lỗi để ghi đúng error_type vào Sổ Kho, dùng bảng chính sách này làm chuẩn.
