---
name: warehouse-error-log
description: Ghi một lỗi do chính shop/kho vận gây ra (giao nhầm hàng, giao thiếu hàng...) vào Sổ Kho Pyjama mục "Thống kê lỗi" (bảng warehouse_error_log) -- dùng khi chủ shop nói "lỗi do kho vận", "ghi vào sổ kho mục lỗi kho vận/lỗi do shop", hoặc chỉ tên khách/đơn và nói đó là lỗi của shop (vd "khách X giao nhầm, ghi vào sổ kho đi"). Khác resend-missing-item (đơn giao thiếu -- cần tạo đơn gửi bù SPX) và return-item-not-shop-product (hàng trả về không phải của shop -- lỗi của KHÁCH, ghi ở bảng khác). Dùng skill này khi chỉ cần ghi nhận lỗi, không cần gửi bù hàng.
---

# Ghi lỗi do kho vận vào Sổ Kho

## What this is for

Sổ Kho Pyjama có tab "5. Thống kê lỗi" để theo dõi lỗi do chính shop gây ra
(kho vận đóng gói sai, sản phẩm lỗi từ xưởng...), tách biệt với lỗi của
khách hàng. Khi chủ shop báo một đơn bị lỗi do kho vận (giao nhầm mẫu, giao
thiếu hàng mà không cần xử lý gửi bù...), ghi ngay vào bảng
`warehouse_error_log` qua Supabase REST API.

**Không dùng skill này nếu** đơn cần gửi bù hàng thiếu -- dùng
`resend-missing-item` (skill đó tự ghi `warehouse_error_log` luôn trong quy
trình của nó, cộng thêm phần tạo đơn SPX + Sổ Kho `warehouse_notices`).
Skill này dùng cho các lỗi kho vận **không** cần tạo đơn gửi bù, ví dụ:
giao nhầm mẫu/sai sản phẩm nhưng khách tự đổi trả qua sàn (không cần shop
gửi lại), hoặc chủ shop chỉ muốn ghi nhận lỗi để theo dõi KPI kho.

## Bước 1: xác định mã vận đơn + chi tiết lỗi

Chủ shop thường chỉ nhắn tên khách (không phải mã đơn), ví dụ "tonehonggirl
giao nhầm hàng". Cần tự tra ra:

1. Dùng **Claude in Chrome** ([[reference_chrome_browsers]]) deviceId TikTok
   — KHÔNG dùng built-in browser. Vào TikTok Shop Seller Center → icon
   "Tin nhắn từ khách hàng" (mở tab `seller-vn.tiktok.com/chat/inbox/current`)
   → tìm đúng tên khách trong danh sách hội thoại bên trái, click vào.
2. Đọc lại tin nhắn khách để biết lỗi cụ thể là gì (vd khách gửi ảnh +
   "mình đặt mẫu Hello Kitty mà shop giao mẫu Cu Shin" = giao nhầm mẫu).
   Nhân viên CSKH thường đã tự nhận lỗi trong hội thoại ("đây là lỗi do bên
   shop giao bị nhầm") -- đọc kỹ để lấy đúng mô tả, đừng đoán.
3. **Lấy mã vận đơn, không phải mã đơn hàng:** ở panel bên phải hội thoại
   có mục "Kho vận" → bấm "Chi tiết" → popup "Thông tin kho vận" hiện
   "ID theo dõi" kèm tên hãng vận chuyển (vd J&T Express) -- đó chính là
   mã vận đơn cần dùng cho cột `code`. **Đừng dùng** "ID đơn hàng" hiển thị
   trong card đơn hàng giữa khung chat (đó là mã đơn nội bộ của sàn, dạng
   số rất dài 18 chữ số, không phải mã vận đơn).
   - Mẹo nhanh: khung chat card đơn hàng đôi khi cũng hiện sẵn "ID theo
     dõi" ngay cạnh "ID đơn hàng" -- nếu có thì dùng luôn, không cần mở
     popup Kho vận.
4. Nếu chủ shop đã tự cho mã vận đơn/ảnh đơn ngay từ đầu, dùng luôn, chỉ
   cần xác minh lại nó khớp với "ID theo dõi" bên Kho vận (không phải mã
   đơn hàng) trước khi ghi.

## Bước 2: xác định error_type/detail_reason

Hỏi chủ shop nếu không rõ:
- "Giao nhầm hàng" (sai mẫu/sai sản phẩm/sai size/màu so với đơn) →
  `error_type=kho_van`, `detail_reason=giao_nham`
- "Giao thiếu hàng" → thường nên dùng skill `resend-missing-item` thay vì
  skill này (trừ khi chủ shop nói rõ không cần gửi bù, chỉ cần ghi sổ)

## Bước 3: ghi vào Sổ Kho

```bash
curl -s -X POST "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_error_log" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"code":"<MA_VAN_DON>","error_type":"kho_van","detail_reason":"giao_nham","reason":"<mo ta ngan>"}'
```

Xem `references/sokho_fields.md` để biết đầy đủ cột/giá trị và lý do khác
với bảng `warehouse_return_checks`.

Đây là việc ghi sổ nội bộ, rủi ro thấp -- làm ngay rồi báo lại kết quả
(id vừa tạo), không cần hỏi trước khi insert. Chỉ hỏi khi thiếu thông tin
bắt buộc (mã vận đơn hoặc loại lỗi cụ thể).

## Việc chưa rõ / cần xác minh thêm ở lần chạy sau

- Chưa rõ UI thật của app Sổ Kho Pyjama hiển thị tab "5. Thống kê lỗi" có
  filter/validate gì thêm cho `reason` hay không (lần đầu chỉ insert qua
  API, chưa mở app kiểm tra lại giao diện).
- Chưa có case thực tế nào cần `error_type=san_pham` hay `khach_quan` để
  xác minh cột `detail_reason` tương ứng (`san_pham_loi`, `loi_bang_size`)
  -- xem `reference_sokho_pyjama_tables.md` của skill `daily-warehouse-report`
  nếu cần tham khảo thêm.
