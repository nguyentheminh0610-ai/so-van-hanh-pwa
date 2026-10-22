# Chrome nào dùng cho sàn nào (Claude in Chrome)

Xác minh thật ngày **2026-10-22** bằng cách mở trang seller của từng sàn trên
từng browser và đọc nội dung trang.

**Trước đó file này KHÔNG tồn tại**, dù 7 skill đều viết "dùng `select_browser`
deviceId TikTok / deviceId Shopee" và link tới một tài liệu tên
`reference_chrome_browsers` bằng kiểu wiki-link.
Hậu quả: mỗi phiên phải tự đoán, đoán trượt thì tưởng là "bị chặn không vào được
TikTok" (gặp thật 22/10).

## Bảng tra

| Browser | deviceId | Máy | Dùng cho | Shortcut trên desktop PC |
|---|---|---|---|---|
| Browser 2 | `40800ac7-074b-4077-be62-257ed7e08ef7` | Windows (PC trực) | **TikTok Shop Seller + Sapo** | "Minh - Chrome" (icon xanh, chữ M) |
| Browser 3 | `81a996d1-12b5-4382-98bf-5f4cad64cb1d` | Windows (PC trực) | **Shopee Seller (banhang.shopee.vn)** | "SOMETIME Chrome" (icon vàng) |
| Browser 1 | `af1ae8fc-e64d-4535-8f38-2c363921db7d` | macOS (máy Mac) | Chỉ có quyền `banhang.shopee.vn` — **không vào được TikTok** | — |

Chủ shop còn 1 Chrome thứ 3 trên PC ("SOMETIME Chrome (2)", cũng icon vàng, cũng
là Shopee) nhưng lúc xác minh **không thấy kết nối** — nếu sau này
`list_connected_browsers` trả về 4 browser thì cái mới là nó.

## Cách dùng

```
select_browser  deviceId = 40800ac7-...   → rồi mở seller-vn.tiktok.com / Sapo
select_browser  deviceId = 81a996d1-...   → rồi mở banhang.shopee.vn
```

Luôn `select_browser` TRƯỚC khi mở trang. Không chọn thì rơi về browser mặc định
(thường là Chrome trên Mac) → vào TikTok sẽ thất bại và dễ kết luận nhầm là "mất
quyền / bị chặn".

## Khi deviceId không còn khớp

deviceId đổi nếu extension cài lại hoặc Chrome đổi profile. Lúc đó:
1. Chạy `list_connected_browsers` xem danh sách thật.
2. Xác minh bằng cách mở trang seller của sàn rồi đọc nội dung
   (`get_page_text`): TikTok hiện "Đơn hàng cần vận chuyển...", Shopee hiện menu
   "Kênh Người bán".
3. **Cập nhật lại bảng trên rồi commit + push ngay** (xem `CLAUDE.md`).

Tốt hơn nữa: dùng `switch_browser` rồi **đặt tên có ý nghĩa** cho từng Chrome
(vd "PC - TikTok + Sapo", "PC - Shopee") — khi đó `list_connected_browsers` trả
về tên thay vì "Browser 2/3" và không cần tra deviceId nữa.

## Lưu ý an toàn

Trang nhạy cảm (vd Hồ Sơ Shop của Shopee) sẽ bật hộp "nhập mật khẩu Shopee để
xác nhận" — **không bao giờ nhập mật khẩu**, thoát ra và đi đường khác, hoặc
báo chủ shop tự thao tác.
