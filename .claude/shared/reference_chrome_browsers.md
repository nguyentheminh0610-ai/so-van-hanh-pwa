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
| — | `14db4f42-cf48-4668-9bbb-633ede2a6d7f` | Windows (PC trực) | **Shopee Seller (banhang.shopee.vn)** — dùng cái này từ 29/10/2026 | "SOMETIME Chrome (2)"? (icon vàng) |
| Browser 3 | `81a996d1-12b5-4382-98bf-5f4cad64cb1d` | Windows (PC trực) | Shopee — **29/10/2026 không còn kết nối**, trước đó bị chặn domain | "SOMETIME Chrome" (icon vàng) |
| Browser 1 | `af1ae8fc-e64d-4535-8f38-2c363921db7d` | macOS (máy Mac) | Chỉ có quyền `banhang.shopee.vn` — **không vào được TikTok** | — |

Chủ shop còn 1 Chrome thứ 3 trên PC ("SOMETIME Chrome (2)", cũng icon vàng, cũng
là Shopee) nhưng lúc xác minh **không thấy kết nối** — nếu sau này
`list_connected_browsers` trả về 4 browser thì cái mới là nó.

## Cách dùng

```
select_browser  deviceId = 40800ac7-...   → rồi mở seller-vn.tiktok.com / Sapo
select_browser  deviceId = 14db4f42-...   → rồi mở banhang.shopee.vn
```

Luôn `select_browser` TRƯỚC khi mở trang. Không chọn thì rơi về browser mặc định
(thường là Chrome trên Mac) → vào TikTok sẽ thất bại và dễ kết luận nhầm là "mất
quyền / bị chặn".

## ⚠️ Tên "Browser N" KHÔNG ổn định — chỉ tin deviceId

Gặp thật **2026-10-22 15:08**: chỉ còn 2 Chrome kết nối (Chrome trên Mac đã
ngắt), nên danh sách đánh số lại — `select_browser` với deviceId Shopee
(`81a996d1-…`) lại báo **"Selected browser 'Browser 2'"**, đúng cái tên mà
bảng trên gán cho Chrome TikTok. Dễ tưởng chọn nhầm rồi đi chọn lại cho
"đúng tên" → mới thật sự vào nhầm Chrome.

**Quy tắc: deviceId là thật, tên hiển thị chỉ là số thứ tự theo danh sách
đang kết nối.** Chọn đúng deviceId là xong, kệ tên trả về. Muốn chắc thì
`list_connected_browsers` xem deviceId nào đang `inUse`, hoặc mở trang seller
rồi đọc nội dung (xem mục dưới).

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

## ⚠️ Quyền domain của extension có thể MẤT — kiểm lại trước khi kết luận

**Gặp thật 2026-10-29:** cả **3** browser đều trả về `Navigation to this domain
is not allowed` khi mở `banhang.shopee.vn` — kể cả Browser 1 (Mac) mà bảng trên
ghi là "chỉ có quyền banhang.shopee.vn". TikTok (`seller-vn.tiktok.com`) lúc đó
vẫn vào bình thường trên Chrome PC.

Nghĩa là: **quyền domain nằm ở extension của từng Chrome và có thể bị reset**,
độc lập với chuyện Chrome đó có đăng nhập sàn hay không.

**Phân biệt 3 lỗi, đừng gộp làm một:**

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Navigation to this domain is not allowed` | extension chưa/không còn quyền domain | chủ shop cấp quyền trong extension |
| Trang mở được nhưng nhảy về màn đăng nhập | Chrome đó chưa đăng nhập sàn | đổi sang Chrome đúng (bảng trên) |
| Trang mở được, hiện "Không có quyền" | gõ sai URL | đi lại bằng menu thật, đừng gõ URL đoán |

**Cách kiểm 10 giây xem có phải lỗi quyền domain không:** trên **chính Chrome
đang lỗi**, mở một domain khác chắc chắn đang chạy được. Làm thật 29/10 trên
Chrome `81a996d1`: `seller-vn.tiktok.com` mở OK, `banhang.shopee.vn` báo
`Navigation to this domain is not allowed` → kết luận chắc chắn là allowlist
domain của extension thiếu `banhang.shopee.vn`, không phải lỗi profile/đăng nhập.

Hôm đó chủ shop đã bật quyền nhưng vẫn chặn — nên nếu gặp lại, **đừng thử đi
thử lại nhiều lần**, báo ngay để chủ shop mở `banhang.shopee.vn` rồi bấm icon
extension **ngay trên trang đó** mà cấp quyền cho site.

### Hiện trạng đo được 29/10/2026 (cả 3 Chrome đều KHÔNG vào được Shopee)

| deviceId | Máy | TikTok | Shopee |
|---|---|---|---|
| `40800ac7…` | Windows | mở được, **đã đăng nhập SOME.TIME** | chặn domain |
| `81a996d1…` | Windows | mở được nhưng **chưa đăng nhập** | chặn domain |
| `af1ae8fc…` | macOS | — | chặn domain |

Chủ shop khẳng định TikTok và Shopee nằm ở 2 Chrome riêng. Vì không Chrome nào
trong 3 cái này vào được Shopee, khả năng cao **Chrome đang đăng nhập Shopee là
profile thứ 4 chưa nối extension vào Claude** (đúng cái "SOMETIME Chrome (2)"
ghi ở trên, lần 22/10 cũng không thấy kết nối).

**Việc cần làm khi gặp lại:** mở đúng Chrome đang đăng nhập Shopee → bật/kết nối
extension Claude trong chính profile đó → chạy `list_connected_browsers`, phải
thấy **4** browser thì mới đi tiếp được.

Cách gỡ: chủ shop mở extension Claude trong đúng Chrome đó và cấp quyền cho
domain, Claude không tự cấp được.

### ✅ ĐÃ GỠ ĐƯỢC — Chrome Shopee thứ 4 đã nối extension (09:35 ngày 29/10/2026)

Lượt CSKH 09:35 ngày 29/10/2026 chạy `list_connected_browsers` thấy đúng dự đoán
ở mục trên: `81a996d1…` biến mất, thay vào đó là một Chrome Windows **mới**
`14db4f42-cf48-4668-9bbb-633ede2a6d7f` (hiện tên "Browser 1", `onThisComputer`).
`select_browser` sang nó rồi mở `banhang.shopee.vn/webchat/conversations` thì
**vào thẳng webchat, đã đăng nhập (VN) SOMETIME, đọc được danh sách hội thoại** —
không còn `Navigation to this domain is not allowed`.

Vậy "Chrome thứ 4" chính là Chrome đang đăng nhập Shopee, và nay đã có extension.
**Từ nay dùng `14db4f42…` cho Shopee**, đừng dựa vào `81a996d1…` nữa.

Nhắc lại cái bẫy tên: lần này `14db4f42…` hiển thị là **"Browser 1"**, đúng cái
tên mà bảng cũ gán cho Chrome Mac. Chỉ tin deviceId, đừng tin tên.

### ⚠️ ĐÍNH CHÍNH 29/10/2026: quyền domain theo TỪNG PHIÊN, không theo Chrome

Mục trên kết luận "quyền nằm ở extension của từng Chrome" — **chưa đúng hẳn**.

Đo thật cùng ngày, sau khi phiên PC đã vào Shopee thành công bằng `14db4f42…`:
một **phiên Claude khác (trên Mac)** chọn **đúng deviceId `14db4f42…` đó**, mở
**đúng URL `banhang.shopee.vn/webchat/conversations` đó** → vẫn
`Navigation to this domain is not allowed`.

→ Quyền site của Claude in Chrome được cấp **cho từng phiên hội thoại**, không
phải cấp một lần cho Chrome rồi mọi phiên dùng chung. Chủ shop bật quyền trong
Chrome (menu "Tiện ích" của Chrome) là điều kiện cần, **chưa đủ**.

**Hệ quả thực dụng:** nếu một phiên bị chặn domain mà phiên khác vào được, đừng
đi sửa Chrome nữa — **giao việc đó cho phiên đang có quyền** (thường là phiên
chạy trên PC trực), hoặc nhờ chủ shop xuất file rồi gửi thẳng vào chat.

Ghi thêm: Chrome `81a996d1…` từng vào được `seller-vn.tiktok.com` ở phiên Mac
nhưng không vào được Shopee — nên "allowlist domain" là có thật, chỉ là nó được
xét **theo cặp (phiên × domain)**, không theo Chrome.

## Lưu ý an toàn

Trang nhạy cảm (vd Hồ Sơ Shop của Shopee) sẽ bật hộp "nhập mật khẩu Shopee để
xác nhận" — **không bao giờ nhập mật khẩu**, thoát ra và đi đường khác, hoặc
báo chủ shop tự thao tác.
