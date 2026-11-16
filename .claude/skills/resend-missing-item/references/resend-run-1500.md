# Giai đoạn 3-6: phiên 15h tạo đơn + phiên 15h45/18h45 hoàn tất (chốt 17/11/2026)

Hai task riêng trên PC, **không chạy trong lượt CSKH**:
- `resend-create-1500` — cron 15:00 và 15:20 (15:20 là lượt thử lại): **tạo đơn**
  (pha A).
- `resend-finalize-1545` — cron 15:45 và 18:45: **hoàn tất** sau khi chủ shop duyệt
  lần 2 (pha B). 15:45 là mốc kịp trước giờ kho in đơn lần cuối (16:00).

Luồng + quy tắc chung: [resend-flow-batch-2026-11-17.md](resend-flow-batch-2026-11-17.md).
Thao tác chi tiết SPX / Sổ Kho / ảnh chụp đơn: Step 3, 4, 5 trong SKILL.md.

## Bước 0 — CỔNG RẺ, bắt buộc làm đầu tiên (không mở trình duyệt, không nạp skill nào)

Chỉ chạy 1 lệnh curl hỏi Supabase (anon key trong `init.js`):

- Pha A: `resend_cases?select=id,handle,status,run_date,spx_tracking,creating_since&or=(status.eq.approved,status.eq.creating)`
  Việc cần làm = dòng `approved` có `run_date` null hoặc `<= hôm nay`; hoặc dòng
  `creating` kẹt quá 30 phút (xem "Case kẹt" bên dưới).
- Pha B: `resend_cases?select=*&status=eq.finalizing`.

Không có việc → kết thúc im lặng, 1 dòng, KHÔNG báo Telegram.
(Chạy lại dòng đã xong nhiều lần cũng vô hại — mọi bước đều có cờ chống trùng.)

## Pha A — tạo đơn (mỗi case lần lượt, trong 1 phiên Chrome)

**A1. Khoá case.** PATCH `status=creating`, `creating_since=now`, `attempts=attempts+1`
với điều kiện `&status=eq.approved`. Không có dòng trả về → bỏ qua case này.

**A2. Kiểm dữ liệu chốt.** Đọc `C:\sokho\resend-data\<platform>_<handle>_<mã đơn gốc>.json`,
tính SHA-256, so với `data_hash`. Không khớp / thiếu file → `status=stalled`,
`stall_reason='dữ liệu chốt không khớp'`, Telegram, sang case khác. **Tạo đơn chỉ
chép từ file này**, không đọc lại ảnh hay suy luận lại.

**A3. Tạo đơn SPX** (Chrome VÀNG — chọn bằng deviceId, xem
`.claude/shared/reference_chrome_browsers.md`) theo Step 3 của SKILL.md với dữ liệu
trong file. Khung giờ lấy hàng: chọn theo giờ hiện tại — phiên 15h thì chọn khung
hôm nay nếu SPX còn cho, không thì sáng hôm sau; **không bao giờ chọn khung đã qua**.
Không cần xin "ok" lần nữa: chủ shop đã duyệt lần 1 trên web (thay Hard rule cũ).

**A4. Ghi NGAY mã vận đơn mới** vào `spx_tracking` (và `spx_order_sn` từ URL) —
trước mọi bước khác. Đây là điểm chống tạo trùng.

**A5. Tải PDF** (cách chắc chắn: chạy JS trong tab preview — fetch blob → `<a download>` click;
nút "Tải" của SPX có lúc không lưu file). Đặt tên `<mã vận đơn>_guibu_<ten_khach>.pdf`,
kiểm file mở được và kích thước hợp lý; **upload ngay lên bucket `notices-pdf`**
(để nút "Xem PDF" trên tab "Gửi bù" xem được) rồi PATCH `label_pdf`. Máy chưa có
`pdftoppm` nên không đọc PDF thành chữ được — chủ shop xem PDF bằng mắt ở lần duyệt 2.

**A6. Tự đối chiếu** trang chi tiết đơn SPX (`spx.vn/spx-admin/order/trackings/<order-sn>`,
đọc bằng `get_page_text`, không chụp màn hình) với file dữ liệu chốt. Mỗi dòng 1 mục:
`✓ ...` hoặc `✗ ...` (mục lỗi bắt đầu bằng ✗ để tab hiện đỏ):
- mã vận đơn có trên trang;
- tên người nhận; SĐT (so 9 số cuối); các thành phần địa chỉ (số nhà, phường/xã, tỉnh);
- tên sản phẩm = `item_name` trong file; số lượng;
- COD = 0; người gửi thanh toán phí;
- khung giờ lấy hàng không nằm trong quá khứ.
PATCH `check_result` (các dòng nối bằng `\n`), `check_ok` (true nếu không có ✗).

**A7. Báo chủ shop.** PATCH `status=wait_approve_2` (điều kiện `status=eq.creating`).
Gửi Telegram: mã vận đơn mới, kết quả đối chiếu, hạn "duyệt lần 2 trước 15h40", và
gửi kèm file PDF (Bot API `sendDocument`). Chủ shop duyệt trên tab "Gửi bù".

**Lỗi trong pha A:**
- Trước A4 (chưa có mã vận đơn): đặt lại `status=approved`, ghi `last_error`. Đủ
  3 lần (`attempts>=3`) → `status=stalled` + Telegram. Lượt 15:20 thử lại các case này.
- Sau A4 (đã có mã vận đơn): KHÔNG tạo lại; giữ `creating` và tiếp tục từ A5.
- Chrome chuyển lỗi: tối đa 3 lần/lượt, không loop thêm (tốn limit).

**Case kẹt `creating`** (>30 phút từ `creating_since`):
- Có `spx_tracking` → làm tiếp từ A5 (an toàn).
- Chưa có `spx_tracking` → KHÔNG tự tạo lại. Tra danh sách đơn SPX theo SĐT người
  nhận (7 ngày). Thấy đơn → ghi `spx_tracking` rồi A5. Không thấy → `status=stalled`
  + Telegram để chủ shop quyết.

## Pha B — hoàn tất (`finalizing`, chủ shop đã duyệt lần 2)

Thứ tự: **Sổ Kho trước** (kho cần ghi chú để đóng hàng), nhắn khách sau.

**B1. Sổ Kho** (Step 4 của SKILL.md; `.claude/shared/notice_naming.md`):
- `orig_tracking` còn trống → `scripts/order_to_tracking.sh <mã đơn gốc>`.
- Dò trước: `warehouse_notices?order_code=eq.<spx_tracking>` và
  `warehouse_error_log?code=eq.<orig_tracking>` — đã có thì KHÔNG insert lại,
  chỉ ghi lại id vào `sokho_notice_id` / `sokho_errlog_id`.
- Chưa có thì insert (`category=gui_don_bu`, `pdf_path` = `label_pdf`, `done=false`;
  error_log `kho_van` / `giao_thieu`) và PATCH 2 cột id.

**B2. Nhắn khách** (Step 5 của SKILL.md: ảnh chụp "Chi tiết đơn hàng" cắt 4 thẻ +
tin mẫu hàng 33 sheet "Mau tin nhan" + link `https://spx.vn/track?<mã>` + tin
"Đơn gửi bù này shop đã thanh toán phí ship rồi ạ..."). Cờ `msg_final_at` lên
trước; mở đúng hội thoại của khách (tìm lại handle ngay trước khi gửi ảnh).
Khách Shopee: nhắn trên Shopee (Chrome vàng).

**B3.** PATCH `status=done`. Telegram 1 dòng "Gửi bù xong: <handle> · <mã vận đơn>"
(không kèm SĐT/địa chỉ).

Lỗi ở B2 (không vào được chat...) → giữ `finalizing`, `last_error`, lượt 18:45 thử
lại; 2 lượt vẫn lỗi → Telegram nhờ chủ shop nhắn tay. Sổ Kho đã ghi rồi nên kho vẫn
đóng được hàng.

## Việc nhân viên kho

Đọc ghi chú "Gửi đơn bù" trong Sổ Kho, tick `done` khi đã đóng — không liên quan task.
