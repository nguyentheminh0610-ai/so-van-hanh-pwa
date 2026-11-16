# reference_sapo_api_don_chua_lay

> Dùng Sapo API để biết đơn đã được đơn vị vận chuyển (ĐVVC) lấy hay chưa.
> Kiểm bằng gọi thật ngày 16/11/2026 (4.042 đơn 9–16/11), chủ shop xác nhận
> 3 đơn mẫu khớp sàn cùng ngày. CHƯA chạy đối chiếu đủ 3 ngày lúc 19:00.

## Kết luận (chốt 16/11/2026)

Mốc **"xuất hàng"** của Sapo (`fulfillments[].issued_on`) do **hệ thống Sapo tự
ghi sau khi ĐVVC quét nhận hàng**, KHÔNG phải nhân viên bấm lúc đóng gói.

Bằng chứng:
- 153/153 phiếu giao 15–16/11 có `issued_by = "Sapo"`, không gắn nhân viên;
  sự kiện `fulfillment_issued` có `author_type = internal_system`.
- Ghi theo lô đúng lượt shipper tới (16/11: Shopee 07:42 và 14:50, TikTok
  16:34–16:42), luôn SAU lượt nhân viên tích "Tích đơn đi" Sổ Kho 2–31 phút.
- Đơn TikTok `587212378041648453`: J&T tiếp nhận 16:30:40, Sapo ghi 16:42:09
  (trễ ~11 phút). Mới đo độ trễ trên đúng 1 đơn này.
- 3 đơn Sapo báo "đã tạo phiếu, chưa xuất hàng" tối 16/11 — chủ shop kiểm trên
  sàn: đúng cả 3 còn "Chờ lấy hàng".

**Bẫy đã mắc (đừng lặp lại):**
- Mốc "ĐVVC lấy hàng" trên thanh tiến trình giao diện Sapo = giờ TẠO PHIẾU
  (`fulfillments[].created_on`), không phải giờ lấy thật.
- `picked_on`, `handed_over_at` luôn rỗng — không dùng được.
- `shipment_status = delivering` được gán cùng lúc `issued_on`, nên nó cũng có
  nghĩa "ĐVVC đã lấy"; đừng tưởng là gán lúc đóng gói.

## Cách lọc "đơn chưa được ĐVVC lấy"

```
GET https://<store>/admin/orders.json?created_on_max=<16:00 hôm nay đổi sang UTC>
    &created_on_min=<lùi ~7 ngày>&limit=250&page=N
```
- Giờ API trả về là **UTC** (đuôi `Z`): 16:00 (+07:00) = `T09:00:00Z`.
- Phân trang `page`, tối đa 250 đơn/trang. Giới hạn 40 request (header
  `x-sapo-api-call-limit`). Đếm nhanh: `/admin/orders/count.json`.
- Khóa API: `~/.config/sapo/credentials.json` (ngoài repo, không commit).

Lọc phía mình:
1. Bỏ đơn hủy: `cancelled_on` khác rỗng. (`cancelled_status` luôn rỗng, `status`
   chỉ có open/closed — không dùng.)
2. Giữ đơn **chưa có phiếu giao** (`fulfillments` rỗng, bỏ phiếu
   `status = cancelled`) → sàn: Shopee "Chưa xử lý" / TikTok "Chờ vận chuyển".
3. Giữ đơn **có phiếu nhưng `issued_on` rỗng** (`shipment_status = pending`)
   → sàn: Shopee "Đã xử lý" / TikTok "Chờ lấy hàng".

Trường dùng: sàn = `source_name` (`tiktokshop` | `shopee`); mã đơn sàn =
`source_identifier`; mã vận đơn = `fulfillments[].tracking_number` (khớp `code`
trong `warehouse_outbound_checks` của Sổ Kho); giờ ĐVVC lấy ≈ `issued_on`.

## Độ trễ Sapo so với hãng (đo 16/11/2026)

**Shopee / SPX — 79 đơn ngẫu nhiên 9–16/11**, so `issued_on` với mốc SPX
`F100 Pickup From Domestic Seller` (tra công khai:
`https://spx.vn/shipment/order/open/order/get_order_info?spx_tn=<mã>&language_code=vi`):
- 60/79 đơn trễ dưới 15 phút (trung vị 0 phút), 7 đơn 15–60 phút, 12 đơn
  1–1,7 giờ. Tối đa 101 phút. Không đơn nào Sapo ghi TRƯỚC khi SPX lấy.
- Các đơn trễ hơn 1 giờ dồn vào ngày sale 11/11.

**TikTok / J&T — 32 đơn (4 đơn/ngày, 9–16/11)**, so `issued_on` với dòng "Đơn
vị vận chuyển đã tiếp nhận kiện hàng" trong "Thông tin kho vận" của từng đơn
trên Seller Center (`seller-vn.tiktok.com/order/detail?order_no=<mã>`):
- Trễ 7–13 phút ở 27/32 đơn; trung vị 11 phút, trung bình 17 phút.
- 5 đơn trễ hơn: 19, 28, 52, 90, 93 phút — 4/5 đơn là ngày sale 11/11.
- Không đơn nào Sapo ghi TRƯỚC khi J&T nhận.
- Trang tra cứu công khai của J&T đòi SĐT người nhận (Sapo chỉ có số đã che)
  nên phải đọc qua Seller Center. Lưu ý khi đọc bằng script: sau dấu phẩy
  trong "16:30:40, 16/11/2026" là ký tự NBSP (mã 160), không phải dấu cách.

## Job chạy thật (chốt 16/11/2026)

- Script: `tools/check_don_chua_lay.py` (chỉ đọc Sapo; `--telegram` để gửi).
- Lịch: Windows Task Scheduler **"Claude - Don chua lay"**, **20:00 hằng ngày**
  trên PC trực (cài bằng `scripts/setup-don-chua-lay-task.ps1`, runner
  `scripts/run-don-chua-lay.ps1`, log `logs/don-chua-lay.log`).
- Chủ shop chốt 20:00 thay cho 19:00 ban đầu "cho chắc chắn": bù độ trễ Sapo
  (tối đa đo được ~1,5 giờ) so với lượt shipper cuối ~16:30–18:00.
- Phạm vi: đơn Shopee + TikTok tạo trước 16:00 hôm đó, lùi 10 ngày, ~17 request.
- Telegram: script đọc `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` hoặc file cục bộ
  `~/.config/telegram/credentials.json` (ngoài repo). Ngày 16/11 PC CHƯA có cả
  hai nên task mới chỉ ghi log, chưa gửi được.

## Còn thiếu

- Chưa đối chiếu danh sách đủ 3 ngày với Seller Center (mới kiểm 3 đơn "chờ
  lấy" ngày 16/11 + đo độ trễ 111 đơn).
- Chưa nối vào Sổ Kho.
