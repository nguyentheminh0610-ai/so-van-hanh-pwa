# Tab "Hậu mãi" trên Sổ Vận Hành — hợp đồng dữ liệu cho các task CSKH

Chốt 19/11/2026 (chủ shop yêu cầu gộp tab "Đánh giá & Trả hàng" + "Gửi bù" cho gọn).
Code web: `cskh.js` (tab Hậu mãi + tab Thống kê), `resend.js` (thẻ + nút gửi bù).
Mục này chỉ nói **web đọc gì** để các skill CSKH ghi đúng. Cách CSKH nhắn khách, đánh
giá mức lỗi Nhẹ/Vừa/Nặng, đề xuất % hoàn... là việc riêng của CSKH, web không đụng.

## Nguyên tắc hiển thị

- **1 đơn = 1 thẻ** (gộp theo `platform + order_code`): đơn nhiều sản phẩm có 4 đánh
  giá + 1 trả hàng vẫn chỉ ra 1 thẻ, ghi "4 đánh giá + 1 trả hàng".
- **1 thẻ = 1 việc cho chủ shop**, quyết bằng 1 nút, bấm xong thẻ rời danh sách:

| Nhóm | Điều kiện web dùng | Nút |
|---|---|---|
| Ghi lỗi Sổ Kho | `errlog_status='suggest'` + `shop_error_kind` ∈ {giao_nham, san_pham_loi} + `errlog_code` (mã vận đơn) | Ghi Sổ Kho / Không phải lỗi shop |
| Duyệt gửi bù | `resend_cases.status` ∈ wait_approve_1/2, verifying, stalled | Duyệt / Sửa / Dừng... (như cũ) |
| Anh xử lý với khách | `needs_action=true` và `acked_at` rỗng, `action_type` khác 2 loại "chỉ xem" | Đã xử lý |
| Chỉ cần xem | `needs_action=true`, `action_type` ∈ {danh_gia_van_de, tra_hang_noi_dung_sp_kho} | Đã xem |

- Hết việc khi 4 nhóm về 0 ("Không còn việc tồn"). Làm nhầm → mục "Đã xong 7 ngày" → Mở lại.
- **Giao thiếu từ mọi nguồn chỉ hiện 1 lần**, ở nhóm Duyệt gửi bù: dòng cskh có
  `shop_error_kind='giao_thieu'` hoặc `errlog_status='owned_resend'` mà đã có phiếu
  `resend_cases` cùng `platform + orig_order_code` thì web ẩn dòng đó.

## Đã giải quyết 19/11 (chủ shop chốt luồng)

Cả hai mục 1 và 2 bên dưới đã được ghi vào skill: review-return-check mục B2 + 4.2 (giao thiếu
qua trả hàng/đánh giá → mở phiếu gửi bù `collecting`; nhầm/lỗi → bắt buộc `errlog_code`,
`needs_action` bật khi khách gửi bằng chứng hoặc sau 24h). Dòng cũ vẫn thiếu mã sẽ được bổ sung
ở lượt chạy kế tiếp.

## Điều CSKH cần làm để web đúng (việc còn thiếu thấy khi rà dữ liệu 19/11)

1. **Khách báo giao thiếu trong thẻ trả hàng / đánh giá** (vd TikTok `l04032006llcd`,
   đơn `586840445960685090`): hiện chưa có phiếu `resend_cases`, web đang hiện thẻ cảnh
   báo "giao thiếu nhưng chưa có phiếu gửi bù". Task gửi bù nên mở phiếu cho các đơn này
   (hoặc chủ shop tự xử lý rồi bấm Đã xem).
2. **Đề xuất lỗi shop phải kèm `errlog_code` (mã vận đơn) và `shop_error_kind`**, nếu
   thiếu web không dựng được nút Ghi Sổ Kho mà chỉ báo "anh kiểm tay". Hiện nhiều dòng
   trả hàng `suggest` đang thiếu mã vận đơn (lấy từ `platform_returns_feed.outbound_tracking`).
3. Chat: tiếp tục ghi `cskh_chat_errors` như cũ. Giao thiếu từ chat đã có phiếu gửi bù
   thì web tự ẩn dòng chat (không cần xoá).
4. Đừng đổi/ghi đè `acked_at` và `errlog_status` ('written','dismissed','dup') — đó là
   quyết định của chủ shop trên web.

---

## VÒNG ĐỜI CASE: xong → 3 ngày sau tự ẩn, có nút Xong (chốt 22/11/2026)

Chủ shop yêu cầu 22/11/2026: (1) **toàn bộ** case hậu mãi phải hiện trên tab này — kể cả giao nhầm/hàng lỗi/đổi size task
đã tự hướng dẫn khách — để theo dõi và ghi Sổ Kho nếu là lỗi kho/sản phẩm; (2) case xong thì **3 ngày sau biến mất**, có
**nút Xong** bấm là biến mất luôn; (3) phải chạy ổn định. Phần này thay cho dòng "Hết việc khi 4 nhóm về 0 / Đã xong 7 ngày"
ở trên; bảng 4 nhóm phía trên vẫn đúng, thêm nhóm thứ 5 "Đang theo dõi".

**Nguyên tắc ổn định:** việc ẩn thẻ do **web tự tính lúc mở trang** từ dữ liệu sẵn có (ngày, `messaged_at`, dòng `▸` cuối,
`acked_at`). KHÔNG có task "dọn thẻ" nào → không có gì để kẹt; PC tắt, Chrome mất đăng nhập thì thẻ vẫn ẩn đúng hạn.

### Các nhóm trên trang

| Nhóm | Thẻ nào vào | Nút |
|---|---|---|
| Ghi lỗi Sổ Kho | đề xuất lỗi shop có đủ loại lỗi + mã vận đơn | Ghi Sổ Kho / Không phải lỗi shop |
| Duyệt gửi bù | phiếu `resend_cases` chờ anh / có vấn đề | như cũ |
| Anh xử lý với khách | `needs_action`; bước cuối `[chờ anh]`; case task **kẹt** (`[đang làm]` ≥ 1 giờ, `[chờ khách]` ≥ 24 giờ) | Xong |
| Đang theo dõi | có dòng `▸`, bước cuối `[đang làm]` / `[chờ khách]` chưa quá mốc; phiếu gửi bù đang chạy tự động | Xong |
| Chỉ cần xem | `needs_action` + `action_type` loại chỉ xem | Xong |
| Vừa xong (gập) | case xong chưa quá 3 ngày, ghi "ẩn sau N ngày" | Mở lại |
| Đã ẩn (gập) | case xong quá 3 ngày, giữ 30 ngày để tra | Mở lại (nếu do anh bấm) |

### BẢNG XÁC MINH "THẾ NÀO LÀ XONG" (bản đề xuất 22/11/2026 — chủ shop chưa sửa gì thì chạy theo bảng này)

| Loại case | Web coi là XONG khi | Sau đó |
|---|---|---|
| Giao thiếu (gửi bù) | phiếu `status='done'` = đã nhắn khách mã vận đơn; hoặc anh Dừng / Chưa ổn | 3 ngày ở "Vừa xong" rồi ẩn |
| Giao nhầm / hàng lỗi (chat) | task ghi `[xong]` (đã hướng dẫn đổi/trả + gửi mã 10k, hoặc đã từ chối) **VÀ** anh đã quyết Ghi Sổ Kho / Không phải lỗi shop | 3 ngày rồi ẩn |
| Đổi size, trả hàng hoàn tiền, đòi hoàn tiền giữ hàng (chat) | task ghi `[xong]` (đã hướng dẫn đủ / đã từ chối) | 3 ngày rồi ẩn |
| Bất kỳ case nào đang `[chờ khách]` | khách im lặng đủ 3 ngày kể từ bước cuối | ẩn luôn, ghi "tự ẩn: 3 ngày không có gì mới" |
| Đánh giá xấu 1–3★ | đã nhắn khách mà 3 ngày không có gì mới; hoặc anh bấm Xong | ẩn luôn / 3 ngày |
| Trả hàng trên sàn (ảnh hưởng shop, không tranh chấp) | 3 ngày kể từ lần cuối có gì mới (sàn tự xử lý hoàn tiền) | ẩn luôn |
| Thẻ "Chỉ cần xem" | 3 ngày kể từ ngày phát sinh | ẩn luôn |
| Mọi loại | anh bấm **Xong** | rời danh sách NGAY, nằm ở "Vừa xong" 3 ngày |

**KHÔNG BAO GIỜ tự ẩn — chỉ anh đóng được** (thẻ ghi "chờ anh · không tự ẩn"), vì ẩn nhầm là mất tiền/mất số liệu:
- Đề xuất ghi lỗi Sổ Kho chưa quyết (ẩn = mất thống kê lỗi nhân viên / nhà cung cấp).
- Phiếu gửi bù chưa `done` (quy tắc chủ shop 21/11: "đơn gửi bù chưa hoàn thành thì luôn hiện").
- Giao thiếu chưa có phiếu gửi bù.
- `action_type` = `tranh_chap` hoặc `lien_he_khach`.
- Bước cuối `[chờ anh]`.

**Tự mở lại:** thẻ đã đóng/đã ẩn mà task ghi thêm 1 dòng `▸` mới (khách nhắn lại) → thẻ quay lại danh sách, không cần ai bấm.

### Hợp đồng dữ liệu cho dòng chat (`cskh_chat_errors`, cột mới 22/11/2026)

Cần chạy 1 lần phần "22/11/2026" cuối `scripts/cskh-tables.sql` trên Supabase (web chạy được cả trước và sau).

| Cột | Ai ghi | Giá trị |
|---|---|---|
| `case_type` | task | `giao_nham` · `san_pham_loi` · `giao_thieu` · `doi_size` · `tra_hang_hoan_tien` · `hoan_tien_giu_hang` · `khac` |
| `progress_note` | task | nhật ký `▸ DD/MM HH:MM · [trạng thái] ...`, nối dòng mới ở CUỐI (định dạng ở [tien-do-xu-ly.md](tien-do-xu-ly.md)) |
| `needs_action` | task | `true` khi cần anh; về `false` khi hết cần |
| `action_type` | task | tuỳ chọn, như 2 bảng kia (`tranh_chap`, `lien_he_khach`) |
| `acked_at` | **chỉ web** | anh bấm Xong. Task không gửi cột này trong payload upsert |

`dedup_key` của case không phải lỗi shop: `platform|order_code|chat_date|<case_type>`. 1 đơn 1 dòng cho 1 loại; khách nhắn
tiếp về cùng việc thì nối `▸` vào dòng cũ, không tạo dòng mới.

### SẼ KẸT KHI NÀO → phương án (rà 22/11/2026)

| # | Kẹt khi | Hậu quả | Phương án |
|---|---|---|---|
| 1 | Máy quét không chạy: Chrome treo duyệt quyền (19–22/11, 5 lượt liên tiếp), mất đăng nhập sàn, PC tắt | case mới KHÔNG lên sổ, danh sách nhìn "sạch" giả | Web hiện băng đỏ "⚠ Máy quét đang kẹt" đầu tab khi lượt gần nhất `blocked` hoặc > 14 giờ; watchdog vẫn báo Telegram. Gốc rễ: task phải chạy chế độ Auto (review-return-check, chốt 22/11) |
| 2 | Lượt CSKH inbox 15 phút dừng (chưa có "nhịp tim" riêng trên sổ) | case chat đứng im | Thẻ `[đang làm]` ≥ 1 giờ tự nhảy lên "Anh xử lý" kèm ⚠. **Chưa làm:** ghi nhịp tim inbox vào `cskh_run_log` để băng đỏ bắt được cả khi không có case nào đang mở |
| 3 | Task quên ghi `[xong]` | thẻ nằm mãi | `[chờ khách]` 3 ngày im lặng tự ẩn; `[đang làm]` ≥ 1 giờ lên nhóm cần anh; anh bấm Xong |
| 4 | Task ghi `[xong]` sớm (khách còn đang chờ) | thẻ ẩn oan | `[xong]` chỉ ghi khi hết phần của shop; thẻ còn ở "Vừa xong" 3 ngày; khách nhắn lại → dòng `▸` mới → tự mở lại |
| 5 | Anh bấm Xong rồi task lại nhắn khách | làm trùng, thẻ nhảy lại | Dòng có `acked_at` = đã đóng: task không nhắn/ghi thêm trừ khi khách gửi tin mới |
| 6 | Chưa chạy SQL thêm cột mà task đã ghi cột mới | Supabase báo `PGRST204`, mất luôn dòng đề xuất lỗi | Task gặp `PGRST204` thì ghi lại không kèm cột mới + tạm báo Telegram việc `[chờ anh]` |
| 7 | Cùng 1 đơn có nhiều dòng (chat + đánh giá + trả hàng) | đóng 1 dòng mà thẻ vẫn còn | Thẻ gộp theo sàn + mã đơn; Xong đóng mọi dòng đang mở của đơn; thẻ chỉ xong khi mọi dòng xong |
| 8 | Bấm Ghi Sổ Kho khi task còn đang hướng dẫn khách | thẻ biến mất giữa chừng | Ghi Sổ Kho chỉ chốt phần lỗi; dòng còn `▸` chưa `[xong]` chuyển sang "Đang theo dõi" |
| 9 | Case chat không có mã đơn | không gộp được, có thể ra 2 thẻ | Chấp nhận: mỗi dòng 1 thẻ; task cố lấy mã đơn trước khi ghi |
| 10 | Thẻ đề xuất lỗi thiếu mã vận đơn / loại lỗi | không có nút Ghi Sổ Kho, thẻ không tự ẩn | Nằm ở "Anh xử lý" kèm chữ "anh kiểm tay"; lượt quét sau bổ sung mã, hoặc anh bấm Xong |
| 11 | Dòng `▸` sai định dạng (thiếu ngày giờ / nhãn) | web không đọc được bước | Dòng đó bị bỏ qua, thẻ hiện "chưa có cập nhật"; giữ đúng mẫu `▸ DD/MM HH:MM · [nhãn] nội dung` |
| 12 | Supabase sập `PGRST002` | cả tab không tải | Xem [reference_supabase_pgrst002_su_co.md](reference_supabase_pgrst002_su_co.md) |
| 13 | Điện thoại giữ bản web cũ | không thấy nút/nhóm mới | Đã tăng phiên bản cache `sw.js` (v64); mở lại app 1–2 lần |
