# Sổ Kho Pyjama — `warehouse_error_log` field cheat sheet

Same Supabase project as Sổ Vận Hành. URL + anon key: see
`so-van-hanh-pwa/init.js` (`SUPABASE_URL` / `SUPABASE_ANON_KEY`).

Verified against live data, 2026-10-20 (first real run: order 862574339148,
khách tonehonggirl, "giao nhầm").

## Columns

| Column | Values | Notes |
|---|---|---|
| `code` | mã vận đơn (tracking id của đơn vị vận chuyển, vd J&T/SPX) | **không phải** mã đơn hàng nội bộ của sàn (ID đơn hàng trong app chat, dạng số rất dài như `586652586553148644`). Lấy đúng mã vận đơn ở mục "Thông tin kho vận" của đơn (xem Step 2) — trên TikTok Shop nó hiện là "ID theo dõi" cạnh tên hãng vận chuyển. |
| `error_type` | `kho_van` \| `san_pham` \| `khach_quan` | `kho_van` = "Lỗi shop - Kho vận" — lỗi của chính kho/nhân viên đóng gói, dùng cho case này |
| `detail_reason` | khi `error_type=kho_van`: `giao_thieu` \| `giao_nham` | `giao_thieu` = thiếu hàng trong đơn (xem skill `resend-missing-item`); `giao_nham` = gửi sai mẫu/sai sản phẩm so với đơn đặt (case này) |
| `reason` | text tự do, không bắt buộc | mô tả ngắn gọn: khách đặt gì, shop gửi nhầm gì — vd `"Khach dat mau Hello Kitty nhung shop giao nham mau Cu Shin"` |
| `staff` | text, optional | để trống (`null`) trừ khi chủ shop nói rõ ai chịu trách nhiệm |

## Vì sao khác `warehouse_return_checks`

`warehouse_return_checks` (xem skill `return-item-not-shop-product`) là nơi
ghi lỗi **của khách** khi có hàng trả về kho (`problem_type=sai_hang`/`hu_hong`).
`warehouse_error_log` là ngược lại — ghi lỗi **của chính shop/kho vận**, áp
dụng ngay cả khi không có hàng trả về (ví dụ khách chỉ nhắn complain giao
nhầm/giao thiếu qua chat, không gửi trả hàng vật lý). Đừng lẫn hai bảng.

## Không có bước "check trước khi ghi"

Khác `warehouse_return_checks` (phải chờ đơn được quét tay vào app trước),
`warehouse_error_log` là bảng tự do — chỉ cần biết `code` (mã vận đơn) là
insert được ngay, không cần hàng đã về kho hay đã có sẵn dòng nào.

## Insert

```bash
curl -s -X POST "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_error_log" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"code":"<MA_VAN_DON>","error_type":"kho_van","detail_reason":"giao_nham","reason":"<mo ta ngan>"}'
```

`detail_reason` đổi thành `"giao_thieu"` nếu là case thiếu hàng (nhưng case
đó đã có skill riêng `resend-missing-item` lo từ A-Z, bao gồm cả gửi bù —
skill này chỉ nên dùng cho `giao_nham` hoặc lỗi kho vận không cần gửi bù).
