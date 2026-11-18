# Luồng gửi bù mới: duyệt 2 lần + tạo đơn gom 1 phiên/ngày (chốt 17/11/2026)

**Trạng thái (17/11/2026): ĐÃ TRIỂN KHAI, CHƯA CHẠY THẬT CASE NÀO.** Có: SQL
`scripts/resend-tables.sql` (chủ shop đã chạy trên Supabase), tab "Gửi bù"
(`resend.js`), quy trình [resend-collect-verify.md](resend-collect-verify.md) (4 task
CSKH đã trỏ vào), [resend-run-1500.md](resend-run-1500.md) (task `resend-create-1500`
cron 15:00 & 15:20, `resend-finalize-1545` cron 15:45 & 18:45). Task nằm ở
`C:\Users\Admin\.claude\scheduled-tasks\` (ngoài git). Chưa thử đủ vòng với khách thật:
chưa rõ task chạy nền xử lý được hộp "Giữ thông tin bí mật" của TikTok khi gửi tin có SĐT.

Lý do làm: hôm 16/11/2026 chủ shop và Claude làm tay 2 case (`q.a.n.h_`,
`_phuonganh1811`), chủ shop muốn có cơ chế phát hiện + duyệt tập trung, ổn
định, tiết kiệm limit.

## Luồng

| Bước | Ai | Việc |
|---|---|---|
| 1 | Task CSKH (sẵn có) | Phát hiện khách báo thiếu, mở dòng `resend_cases`, hỏi thông tin |
| 2 | Task CSKH | Gửi **tin xác minh**. Khách xác nhận "đúng" thì **chốt dữ liệu**, gửi **Tin ghi nhận** (không hứa giờ), ping Telegram |
| 3 | Chủ shop | **Duyệt lần 1**: xác nhận đơn này thiếu thật + đồng ý tạo đơn (tab "Gửi bù" hoặc Telegram) |
| 4 | Lượt CSKH kế tiếp (kiểm `resend_cases` đầu lượt) | Gửi **Tin "đang tạo đơn"** (không nói ngày đi), tạo đơn SPX, tải PDF, tự đối chiếu với dữ liệu đã chốt, ping chủ shop |
| 5 | Chủ shop | **Duyệt lần 2**: xem PDF + kết quả đối chiếu |
| 6 | Lượt CSKH kế tiếp | Ghi Sổ Kho (notice + error_log + upload PDF) TRƯỚC, rồi nhắn khách ảnh chụp + mã vận đơn + **ngày đi** (hôm nay/ngày mai) |

Kho đóng hàng muộn nhất **16h**, nên đơn muốn đi trong ngày phải có **PDF trong Sổ Kho
trước 15h30** để kho kịp in (chốt 18/11/2026, thay cho mốc cũ "xong trước 16h").

**Chốt 18/11/2026 — thay cho "phiên tạo đơn cố định 15h":** tạo đơn NGAY sau duyệt lần 1,
do lượt CSKH phát hiện. Hai task `resend-create-1500` / `resend-finalize-1545` giữ làm
dự phòng (cổng rẻ nên không tốn).

## Quy tắc đã chốt

- **Tạo đơn chỉ chép từ dữ liệu đã chốt** ở bước 2 (đúng nội dung tin xác minh
  khách đã đồng ý), không đọc lại ảnh, không suy luận lại. Khách sửa thì gửi tin
  xác minh mới và chốt bản mới. Đối chiếu PDF cũng so với bản chốt này.
- Dữ liệu đầy đủ (SĐT, địa chỉ) **không đưa vào Supabase hay git** (khóa nằm
  trong repo public). Bảng chỉ giữ SĐT che + tỉnh/phường. Bản đầy đủ nằm ở file
  cục bộ trên PC (ngoài git) và trong Telegram gửi chủ shop.
- Khách chưa xác nhận thì không tạo đơn, trừ khi chủ shop bấm riêng "Duyệt dù
  khách chưa xác nhận".
- **Chống trùng:** khóa duy nhất (sàn, handle khách, mã đơn gốc) ngay ở database;
  trước khi mở case mới kiểm `resend_cases`, Sổ Kho (`gui_don_bu`), SPX theo SĐT
  trong 7 ngày, lịch sử chat. Khách hỏi lại thì trả lời theo trạng thái hiện tại
  (đã tạo: gửi mã vận đơn; chưa tạo: nhắc giờ), không mở case mới. Món khác cùng
  đơn: gộp nếu chưa tạo đơn, mở case phụ nếu đã tạo.
- **Đang tạo đơn thì khóa:** đổi `approved` -> `creating` có điều kiện; lưu mã
  vận đơn ngay sau khi tạo; case kẹt `creating` quá 30 phút thì KHÔNG tự tạo lại,
  tra SPX theo người nhận rồi báo chủ shop.
- Mỗi tin nhắn khách có cờ riêng (`msg_sent`), gửi tin nào tick tin đó, chạy lại
  chỉ gửi tin chưa tick.
- Lỗi Chrome/SPX: thử tối đa 3 lần/lượt, vẫn lỗi thì giữ `approved`, ping
  Telegram 1 lần, không loop trong 1 lượt. Có thêm 1 lượt chạy lại.
- Khách im lặng: nhắc 1 lần sau 24h, 72h chuyển `stalled` và báo chủ shop.
- Khung giờ lấy hàng SPX chọn theo giờ hiện tại (tránh khung đã qua).
- Giờ xác nhận của khách tính theo **giờ khách nhắn trên sàn**, không phải giờ
  task đọc tin.

## Mốc giờ (chốt 18/11/2026)

- Khách KHÔNG được báo ngày đi cho tới khi biết chắc: **Tin "đang tạo đơn"** (sau duyệt
  lần 1) không nói ngày; **ngày đi chỉ báo ở tin sau duyệt lần 2**.
- Quy tắc chọn ngày đi: ghi Sổ Kho xong (PDF đã có trong Sổ Kho) **trước 15h30** ->
  "đơn đi hôm nay"; sau 15h30 -> "đơn đi ngày mai". Nên chủ shop duyệt lần 2 muộn vẫn
  không sao, tin vẫn đúng sự thật; chỉ ngày đi lùi sang mai.
- Để kịp "hôm nay", gợi ý hạn: duyệt lần 1 trước ~14h40, duyệt lần 2 trước ~15h10.
  Telegram nhắc chủ shop lúc 14h30 / 14h50 nếu còn case chờ duyệt lần 1.
- Khung giờ lấy hàng SPX chọn theo giờ hiện tại (không chọn khung đã qua).
- Bỏ phân biệt Tin 2a / 2b theo giờ khách xác nhận (cũ, 17/11/2026: trước/sau 14h).
  Cột `confirm_slot` không còn dùng để chọn tin; ngày đi do giờ ghi Sổ Kho quyết định.

## Mẫu tin nhắn khách (chủ shop chốt 17/11/2026)

**Xin ảnh vỏ đơn / ảnh bằng chứng** (BẮT BUỘC có ảnh bằng chứng mọi case, chốt lại 18/11/2026; khách ĐÃ gửi ảnh sản phẩm/gói hàng nhận được thì KHÔNG gửi tin này — chốt 18/11/2026 tối — xem mục "Ảnh bằng chứng" trong
[resend-collect-verify.md](resend-collect-verify.md)). Nguyên văn chủ shop soạn 13/10/2026:

```
Để shop kiểm tra và hỗ trợ gửi bù sản phẩm còn thiếu cho bạn nhanh nhất, bạn chụp giúp shop 1 tấm ảnh phần vỏ đơn hàng (tem/mã vận đơn dán bên ngoài túi/hộp) gửi qua đây giúp shop nhé ạ.
```
Giao sai hàng: nhờ khách chụp thêm sản phẩm nhận được (không có mẫu chốt riêng → dùng câu trên, thêm "và sản phẩm bạn nhận được" ngay sau "vỏ đơn hàng").

**Hỏi thông tin nhận hàng** (thay Tin 1 cũ; vì sàn chặn SĐT/địa chỉ dạng chữ):

```
Dạ bạn cho shop xin họ tên, SĐT và địa chỉ nhận hàng để shop gửi bù nhé ạ. Để gửi thông tin bạn giúp shop 1 trong 2 cách: ghi thông tin vào ghi chú điện thoại rồi chụp màn hình gửi shop, hoặc chụp phần thông tin giao hàng của đơn (có đủ SĐT và địa chỉ) gửi shop ạ.
```

Lưu ý: SĐT trong đơn trên TikTok bị che; cách chụp thông tin giao hàng chỉ có
ích khi khách tự mở đơn của họ. Cả 2 cách đều là ảnh nên **bắt buộc gửi tin xác
minh lại** (đọc ảnh dễ nhầm số).

**Tin xác minh** (Step 2b, giọng nhẹ hơn):

```
Dạ shop xin lỗi bạn rất nhiều vì đơn hàng của bạn bị thiếu sản phẩm, mong bạn thông cảm cho shop ạ. Shop xác nhận lại thông tin gửi bù cho bạn nhé ạ:
- Người nhận: <tên>
- SĐT: <sđt>
- Địa chỉ: <địa chỉ>
- Sản phẩm gửi bù: <tên phân loại> - size <size> - số lượng <n>
Bạn kiểm tra giúp shop thông tin trên đã chính xác chưa ạ. Bạn xác nhận giúp shop để shop tạo đơn gửi bù cho bạn sớm nhất nhé ạ.
```

**Tin ghi nhận** (ngay khi khách xác nhận thông tin, cờ `msg_ack_at`; không hứa giờ):

```
Dạ shop đã ghi nhận ạ, shop xử lý ngay cho bạn nhé ạ.
```

**Tin "đang tạo đơn"** (sau chủ shop duyệt lần 1, cờ `msg_creating_at`; KHÔNG nói ngày đi, KHÔNG nhắc chuyện duyệt):

```
Dạ ok ạ. Bạn yên tâm các đơn gửi bù bên mình sẽ ưu tiên trước hết ạ, shop đang tạo đơn cho bạn, có mã vận đơn shop gửi bạn liền nhé ạ.
```

**Dòng ngày đi** (thêm vào tin mã vận đơn sau duyệt lần 2, chọn theo giờ ghi Sổ Kho):

- Trước 15h30: `Đơn của bạn sẽ được gửi đi trong hôm nay ạ.`
- Sau 15h30: `Hôm nay đơn vị vận chuyển đã qua giờ lấy hàng nên đơn sẽ được gửi đi vào ngày mai ạ, mong bạn thông cảm giúp shop nhé ạ.`
  (Lúc quá 0h đổi "ngày mai" thành "hôm nay (ngày ...)". Lý do chọn câu "đã qua giờ lấy hàng":
  có thật, không đổ lỗi ai, không nhắc tới kho.)

## Chưa làm / cần theo dõi

- Chạy thử toàn vòng với 1 case thật rồi chỉnh quy trình theo thực tế.
- Tin xin lỗi khi case trượt qua 15h (chưa có câu chữ chốt nên task không tự gửi).
- Bucket `notices-pdf` đang public mà tem có tên/SĐT/địa chỉ khách (chủ shop chưa quyết).
- Sapo không tự trừ tồn khi gửi bù trực tiếp qua SPX (chưa kiểm).
