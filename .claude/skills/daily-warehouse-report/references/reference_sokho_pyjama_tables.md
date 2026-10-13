Sổ Kho Pyjama dùng chung đúng 1 Supabase project với Sổ Vận Hành (`https://dyvublxyrldmmnsrfvpz.supabase.co`, anon key giống hệt key trong `so-van-hanh-pwa/init.js`) — đã test thực tế 2026-10-05, đọc/ghi được ngay, không cần xin thêm credential nào khác.

Các bảng liên quan tới mục kiểm soát kho:

**warehouse_error_log** — "sổ lỗi kho" (ghi lỗi khi sản phẩm/dịch vụ có vấn đề):
- `code` (mã đơn/vận đơn), `staff`
- `error_type`: `kho_van` (Lỗi shop - Kho vận) | `san_pham` (Lỗi shop - Sản phẩm) | `khach_quan` (Lỗi khách quan)
- `detail_reason` (tuỳ error_type): kho_van→`giao_thieu`/`giao_nham`; san_pham→`san_pham_loi`; khach_quan→`loi_bang_size`
- `reason` (text tự do, không bắt buộc)

**warehouse_notices** — "📌 Việc cần làm" (note việc cho nhân viên, đơn gửi bù/đơn cần chú ý):
- `category`: `gui_don_bu` (Gửi đơn bù) | `thong_bao_chung` (Thông báo chung)
- `order_code`, `content`, `link_url`, `pdf_path` (đều optional trừ content), `staff`
- Đánh dấu xong: PATCH `done=true, done_at=now()`

**warehouse_return_checks** — "Tích đơn hoàn" (đơn trả về kho, điền số liệu đơn trả hàng): các cột bổ sung sau bóc kiểm — `sku`, `quantity`, `return_category`, `order_status`, `return_reason`, `matched_in_platform_file`. Đối chiếu với dữ liệu sàn xuất ra cần đọc `monthly_reports.data.hoanVeKhoDetail` (cùng Supabase, bảng của chính Sổ Vận Hành).

Cột đánh dấu "đơn có vấn đề" trên chính bảng này (xác minh qua source app + data thực 2026-10-07): `return_type` (`doi_tra`=hoàn trả cần bóc kiểm | `boom`=huỷ/bom hàng lên kệ luôn, chỉ `doi_tra` mới có `has_problem`/`problem_type`), `has_problem` (bool), `problem_type` (`hu_hong`="Lỗi khách - Hàng hỏng" | `sai_hang`="Lỗi khách - Hàng không phải của shop" — dùng đúng `sai_hang` cho case hàng trả về không phải của shop), `complaint_status` (`none`→`pending`→`submitted`→`resolved`|`lost`, app tự set `pending` ngay khi tick "có vấn đề"), `complaint_result` (rỗng | `thanh_cong` | `that_bai`). Cột `note` tồn tại trong DB, app luôn ghi `""` lúc insert nhưng KHÔNG có ô nào trong UI đọc/sửa nó — an toàn để Claude tự dùng làm nơi lưu link bằng chứng (Drive) không lo đụng UI. Đây khác hẳn `warehouse_error_log` (lỗi của SHOP); case "sai_hang" luôn là lỗi phía khách, chỉ ghi ở bảng này.

**warehouse_outbound_checks** — "Tích đơn đi" (đơn đã gửi).

**warehouse_unpacked_log** — "Đơn đã in nhưng chưa đóng được" (tab 2 trong app, sổ ghi tay trong ngày, không có trạng thái "đã xong", ghi nhầm thì xoá tay) — schema lấy trực tiếp từ source app (`grep T_UNPACKED` trên `so-kho-pyjama`, bảng rỗng lúc kiểm tra 2026-10-07 nên không đọc được qua data mẫu):
- `code` (mã vận đơn), `platform` (`tiktok`|`shopee`), `staff`, `scan_date`, `created_at`
- `reason`: `thieu_hang` ("Thiếu hàng") | `loi_hang` ("Lỗi hàng") | `khac` ("Khác")
- `note` (optional, text tự do)
- Dùng trong Báo cáo 2 (xem reference_3_reports_doi_chieu_san.md) — đối chiếu chéo với Nhóm A (đơn chưa đóng tính từ đối chiếu sàn+Sổ Kho) để phát hiện lệch.

**Why:** tránh phải hỏi lại chủ shop API key/table name mỗi lần cần ghi sổ kho hoặc việc cần làm — đã xác minh dùng được ngay.
**How to apply:** ghi lỗi kho → insert vào warehouse_error_log; ghi việc cho nhân viên → insert vào warehouse_notices; không tự ý sửa/xoá dòng warehouse_return_checks do nhân viên đã quét tay, chỉ bổ sung cột còn trống (mức độ rủi ro thấp = tự làm được, không cần hỏi trước).
