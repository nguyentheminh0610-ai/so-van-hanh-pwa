# Bẫy khi tính phí sàn 2 sàn — đọc trước khi sửa calc.js

Chốt **28/10/2026**, sau khi rà soát lại toàn bộ 12 tháng và vá 4 lỗi làm sai số
tiền thật. Mọi con số dưới đây là đo thật trên file gốc, không phải suy luận.

---

## 1. Quy tắc số 1: LUÔN lấy mẫu số nằm TRONG CÙNG FILE với tử số

Đây là bẫy đã làm Claude **kết luận sai 2 lần** trong cùng một ngày.

Phí sàn lấy từ **file tài chính** = các đơn **quyết toán trong kỳ**.
Doanh thu lấy từ **file đơn hàng** = các đơn **đặt trong kỳ** và đã hoàn thành.
Hai tập đơn **khác nhau**. Chia tử của tập này cho mẫu của tập kia ra con số
**nhảy ±4 điểm % mà không có nghĩa gì**.

Đo thật — phí cố định Shopee:

| Kỳ | tỷ lệ THẬT (phí ÷ "Giá sản phẩm" cùng file) | tỷ lệ nếu chia cho doanh thu của sổ |
|---|---|---|
| 02/2026 | 12,86% | 17,30% |
| 03/2026 | 13,25% | 17,86% |
| 04/2026 | 13,06% | 13,78% |
| 08/2026 | 15,56% | 17,83% |
| 09/2026 | 14,91% | 13,80% |

Cột trái đi lên mượt theo thời gian. Cột phải nhảy loạn. Nhìn cột phải thì tưởng
tháng 8 bị tăng phí rồi tháng 9 lại giảm — **sai hoàn toàn**.

→ `calc.js` đã có `shopee.phiSanTyLeThat` / `tiktok.phiSanTyLeThat` và
`phiSanMauSo`. **Dùng 2 trường này khi muốn so phí giữa các tháng.** Chỉ số
"% doanh thu" chỉ dùng cho câu hỏi lãi lỗ của riêng tháng đó.

Mẫu số đúng của từng sàn (đã thử cả 2 phương án, chọn cái cho tỷ lệ ổn định):
- **Shopee**: cột `Giá sản phẩm` trong sheet "Doanh thu" của file Income. Xác
  minh đây đúng là cơ sở Shopee thu phí: **115/156 đơn T8 và 86/171 đơn T9 có
  phí cố định bằng ĐÚNG 16,5%** cột này (số còn lại 15,5%).
- **TikTok**: cột `Tổng phụ sau giảm giá của người bán`. Cho tỷ lệ ổn định
  19–23% (T7/T8/T9 = 20,07% / 22,57% / 20,99%). Cột `Tổng phụ trước giảm giá`
  nhảy 12–21% → **không dùng**.

## 2. Shopee: "Phí dịch vụ" là TIÊU ĐỀ GỘP, không phải một khoản phí

Sheet **"Service Fee Details"** dùng **tiêu đề 2 tầng**: dòng 1 ô C ghi
"Phí Dịch Vụ" trải ngang nhiều cột, dòng 2 mới là tên các cột con.

→ **Phí dịch vụ = Phí Hạ Tầng + Voucher Xtra** (+ thành phần khác ở tháng cũ).

Cộng cả cột tổng (sheet "Doanh thu") LẪN các cột con (sheet này) là **đếm 2 lần**.
Đã dính: phí sàn Shopee thừa **39.294.669đ** trong 12 tháng, nặng nhất T1/2026
thừa 14.006.400đ. Kiểm chứng: 8/12 tháng có `Hạ tầng + Voucher Xtra = Phí dịch
vụ` **khớp từng đồng**.

**Cách đúng: lấy CỘT TỔNG, các cột con chỉ hiện dạng "Trong đó" và KHÔNG cộng.**

## 3. Shopee đổi tên cột sheet này ít nhất 3 lần

| Thời kỳ | Tên cột |
|---|---|
| 09–10/2025 | `Gói Content Xtra` · `Gói Voucher Xtra` · `Phí Hạ Tầng` |
| 11/2025–01/2026 | `Phí Hạ Tầng` · `Voucher Xtra 2.5%` · `Voucher Xtra 3%` |
| 02/2026 → nay | `Phí Hạ Tầng` · `Voucher Xtra` |

Khớp đúng tên `Voucher Xtra` thì 4 tháng cũ đọc ra **0** (11/2025 hụt 7.024.859đ,
09/2025 hụt 556.723đ). → Khớp theo **chuỗi chứa** (`voucher xtra|content xtra`).

Đây là lý do thứ 2 để lấy cột tổng làm nguồn: cột con đổi tên là tiền bốc hơi
âm thầm, cột tổng thì không.

## 4. TikTok: file có dòng HOÀN PHÍ mang giá trị DƯƠNG

Khi sàn trả lại phí của đơn bị hoàn/huỷ, ô đó là **số dương**. Lấy
`Math.abs()` từng dòng là biến khoản **trả lại** thành khoản **phải trả** →
cộng thêm thay vì trừ đi.

Đếm thật: T1/2026 có **15 dòng**, T2/2026 có 9, T3/2026 có 6, T9/2026 có 4.

→ **Cộng CÓ DẤU, chỉ `Math.abs()` một lần ở cuối** khi từng khoản đã net xong.

## 5. TikTok: cột "Tổng phí" KHÔNG gồm phí vận chuyển trả hàng

Kiểm 5 tháng (03, 06, 07, 08, 09/2026): phần các khoản đã biết vượt quá
"Tổng phí" bằng **ĐÚNG** cột `Phí vận chuyển trả hàng thực tế` tới từng đồng.

→ Phí sàn TikTok = `|Tổng phí| − |thuế| + |phí VC trả hàng|`.

Lỗi 4 + 5 cộng lại làm phí sàn TikTok lệch **1.223.096đ** trong 12 tháng.

## 6. Đừng kẹp phần dư về 0

Dòng "Phí khác" trước đây dùng `Math.max(0, tổng − các khoản đã biết)`. Khi các
khoản đã biết **vượt** tổng (dính thật ở **8/12 tháng**) thì nó về 0 và **che
mất** việc bảng chi tiết cộng ra khác tổng.

→ Hiện cả 2 chiều: dư dương = "Phí khác (chưa bóc tên)", dư âm = "CHƯA KHỚP —
các khoản đã biết vượt tổng". Thấy dòng "CHƯA KHỚP" là phải soi, đừng bỏ qua.

Còn 2 tháng có dư chưa bóc được tên: 11/2025 là 45.331đ, 01/2026 là 121.251đ.
File tài chính TikTok có **67 cột** mà sổ chỉ đọc 6 — các cột chưa đọc gồm Phí
dịch vụ SFP, SFR, Flash Sale, Voucher Xtra, EAMS, PayLater, Gói dịch vụ được
quản lý.

## 7. Thứ tự cột file tài chính TikTok KHÁC NHAU giữa các tháng

Phải đọc theo **TÊN cột**, tuyệt đối không theo chỉ số cột. Đã dính khi tự kiểm
bằng index: tháng 9/2026 ra số sai hẳn vì file tháng đó xếp cột khác.

## 8. Luôn đọc sheet "Giải thích về phí" trước khi tự chế công thức

Sheet này nằm ngay trong file tài chính TikTok. Nó từng giải quyết một lỗi đếm
trùng 2,5 lần: *"Phí vận chuyển của người bán = phí vận chuyển thực tế − giảm
phí vận chuyển của nền tảng − phí vận chuyển của khách hàng"* — tức cột đó **đã
là số ròng** shop chịu, không cần cộng thêm 2 cột kia.

---

## Số nền để đối chiếu (sau khi vá hết, tính tới 28/10/2026)

- Tổng phí sàn 12 tháng: **634.904.118đ** (Shopee + TikTok)
- Phí cố định Shopee theo thời gian: **~10,2%** (T9–11/2025) → **~12,9%**
  (T1–5/2026) → **~15,5%** (T6–9/2026). **Shopee ĐÃ TĂNG PHÍ THẬT**, tăng ~5,3
  điểm % trong 9 tháng. (Đừng lặp lại kết luận cũ "sàn không tăng phí" — câu đó
  chỉ đúng khi so 2 tháng liền nhau.)
- Gói Voucher Xtra: chủ shop **đã huỷ 29/08/2026 22:45**, PiShip cũng đã huỷ.
  Chủ shop xác nhận 28/10/2026: **hiện không đăng ký gói nào ở cả 2 sàn.**
  Bỏ 2 gói này tiết kiệm ~**1,97tr/tháng** (Voucher Xtra 1,57tr + PiShip 397k).
- Đường đi xem gói trên Shopee: `banhang.shopee.vn` → **Kênh Marketing** → thẻ
  **"Gói Voucher Xtra"** → nút **"Lịch sử đăng ký"**. URL
  `/portal/marketing/freeshipping` **không tồn tại** (ra 404) — đi bằng menu.
