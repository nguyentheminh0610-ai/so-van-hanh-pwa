# Luồng gửi bù mới: duyệt 2 lần + tạo đơn gom 1 phiên/ngày (chốt 17/11/2026)

**Trạng thái: ĐÃ CHỐT THIẾT KẾ + MẪU TIN, CHƯA TRIỂN KHAI** (chưa có bảng
`resend_cases`, chưa có tab "Gửi bù" trong Sổ Vận Hành). Cho tới khi triển khai
xong, luồng cũ trong SKILL.md (hỏi chủ shop "ok" rồi mới bấm Tạo đơn) vẫn là
luồng đang chạy. Chỉ dùng **mẫu tin dưới đây** ngay được.

Lý do làm: hôm 16/11/2026 chủ shop và Claude làm tay 2 case (`q.a.n.h_`,
`_phuonganh1811`), chủ shop muốn có cơ chế phát hiện + duyệt tập trung, ổn
định, tiết kiệm limit.

## Luồng

| Bước | Ai | Việc |
|---|---|---|
| 1 | Task CSKH (sẵn có) | Phát hiện khách báo thiếu, mở dòng `resend_cases`, hỏi thông tin |
| 2 | Task CSKH | Gửi **tin xác minh** (Step 2b). Khách xác nhận "đúng" thì **chốt dữ liệu** (tên, SĐT, địa chỉ, món, size, SL) |
| 3 | Chủ shop | **Duyệt lần 1** (tab "Gửi bù" hoặc ping Telegram), xong trước giờ tạo đơn |
| 4 | Claude, 1 phiên/ngày | Tạo đơn SPX cho mọi case đã duyệt, tải PDF, tự đối chiếu với dữ liệu đã chốt |
| 5 | Chủ shop | **Duyệt lần 2**: xem PDF + kết quả đối chiếu, trước 15h40 |
| 6 | Claude | Ghi Sổ Kho (notice + error_log + upload PDF), nhắn khách ảnh chụp + link theo dõi |

Kho in đơn lần cuối **16h**, nên bước 4-6 phải xong trước 16h.

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

## Mốc giờ

- Khách xác nhận **trước 14h** -> dùng Tin 2a (đi trong ngày).
- Khách xác nhận **sau 14h** -> dùng Tin 2b (đi ngày mai).
- Phiên tạo đơn: **mục tiêu chiều ~14-15h**. **CÒN MỞ:** chủ shop viết "khoảng
  2h chiều" trong Tin 2a, trong khi phiên thiết kế là 15h. Cần chốt 1 giờ rồi
  sửa cho khớp tin nhắn (nếu 14h thì giờ chốt khách và hạn duyệt lần 1 phải sớm
  hơn).

## Mẫu tin nhắn khách (chủ shop chốt 17/11/2026)

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

**Tin 2a** (khách xác nhận trước 14h):

```
Dạ ok ạ. Bạn yên tâm các đơn gửi bù bên mình sẽ ưu tiên trước hết ạ, khoảng 2h chiều nay shop sẽ tạo đơn và cho hàng đi trong ngày, có mã vận đơn shop gửi bạn liền nhé ạ.
```

**Tin 2b** (khách xác nhận sau 14h):

```
Dạ ok ạ. Bạn yên tâm các đơn gửi bù bên mình sẽ ưu tiên trước hết ạ, nhưng hôm nay đơn vị vận chuyển đã qua giờ lấy hàng nên shop xin phép cho đơn đi vào ngày mai ạ, có mã vận đơn shop gửi bạn liền, mong bạn thông cảm giúp shop nhé ạ.
```

Lý do chọn câu "đơn vị vận chuyển đã qua giờ lấy hàng" cho 2b: có thật, không
đổ lỗi cho ai, không nhắc tới kho. Tin 2b lúc quá 0h thì đổi "ngày mai" thành
"hôm nay (ngày ...)".

## Đã bàn nhưng chưa làm

- Bảng `resend_cases` + tab "Gửi bù" (nút Duyệt / Sửa / Dừng, theo mẫu nút
  "Xác nhận ghi Sổ Kho" của `cskh.js`).
- Sửa `scripts/order_to_tracking.sh` (`python3` trên Windows trả về stub
  WindowsApps nên báo sai "không tìm thấy trong Sapo").
- Bucket `notices-pdf` đang public mà tem có tên/SĐT/địa chỉ khách (rủi ro có
  sẵn, chủ shop chưa quyết).
