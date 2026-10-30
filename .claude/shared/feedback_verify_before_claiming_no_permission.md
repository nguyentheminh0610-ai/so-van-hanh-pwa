# Đừng vội kết luận "mất quyền" trên sàn

Chốt **22/10/2026**, bổ sung **30/10/2026**.

## Sự cố gốc

Gõ thẳng một URL đoán của TikTok Shop → trang hiện **"Không có quyền"** → phiên
đó kết luận nhầm là tài khoản bị mất quyền. Thực tế chỉ là **sai URL**; đi lại
bằng menu thật thì vào bình thường.

## Quy tắc

1. **Đi bằng menu thật, đừng gõ URL đoán.** Cần URL thì đọc `href` của chính
   mục menu đó (`find` / `read_page`) rồi mới điều hướng.
2. **Kiểm tra danh tính tài khoản trước khi báo lỗi** — chụp màn hình hoặc đọc
   nội dung trang xem có đúng shop SOME.TIME / sometime_official không.
3. **Chỉ báo "mất quyền" khi đã loại trừ 3 nguyên nhân dưới.**

## Phân biệt 3 lỗi — khác nhau hoàn toàn

| Hiện tượng | Nguyên nhân thật | Cách xử lý |
|---|---|---|
| `Navigation to this domain is not allowed` | Claude chưa được cấp quyền cho domain đó **trong phiên này** | giao việc cho phiên đang có quyền, hoặc nhờ chủ shop xuất file |
| Trang mở được nhưng nhảy về màn đăng nhập | Chrome đó chưa đăng nhập sàn | đổi sang Chrome đúng |
| Trang mở được, hiện "Không có quyền" | **gõ sai URL** | đi lại bằng menu thật |

Bảng tra Chrome nào vào sàn nào + cách kiểm 10 giây:
[reference_chrome_browsers](reference_chrome_browsers.md).

## Bổ sung 30/10/2026 — quyền domain cấp theo TỪNG PHIÊN

Đo thật: phiên PC vào được `banhang.shopee.vn`; ngay sau đó một phiên khác chọn
**đúng deviceId đó, mở đúng URL đó** vẫn bị `Navigation to this domain is not
allowed`. Nghĩa là quyền site gắn với **phiên hội thoại**, không phải với Chrome.

Hệ quả: **đừng thử đi thử lại nhiều lần và đừng đi sửa Chrome.** Sau 2–3 lần
thất bại thì dừng, báo rõ, rồi chuyển việc cho phiên đang có quyền hoặc nhờ chủ
shop xuất file gửi thẳng vào chat.
