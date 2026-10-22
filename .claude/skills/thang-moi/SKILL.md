---
name: thang-moi
description: Tải bộ file báo cáo tháng từ Shopee Seller + TikTok Shop Seller, kiểm file, upload lên Sổ Vận Hành (so-van-hanh-pwa.vercel.app), tính toán và lưu vào lịch sử, rồi báo cáo chủ shop qua Telegram -- dùng khi chủ shop nói "chốt tháng", "tải file tháng", "làm số liệu tháng X", "cập nhật sổ vận hành", hoặc khi tới kỳ chạy hằng tháng (sau ngày 20). Bao gồm cả việc kiểm tra bộ file có bị tải quá sớm không (lỗi làm lãi tụt giả tạo), điền chi phí vận hành, và đối chiếu chéo số của sổ với số hiển thị trên seller center. KHÔNG dùng cho báo cáo kho hằng ngày (xem daily-warehouse-report).
---

# Chốt số liệu tháng cho Sổ Vận Hành

## Việc này để làm gì

Mỗi tháng Sổ Vận Hành cần 6 file bắt buộc + 5 file tuỳ chọn tải từ 2 seller center. Skill này làm trọn: tải → kiểm → upload → tính → lưu → báo cáo. Mục tiêu của chủ shop là **mỗi tháng chỉ việc vào xem dashboard**, không phải đụng tay.

## CHẠY KHI NÀO — quan trọng, đừng bỏ qua

**Chỉ chạy sau ngày 20 của tháng kế tiếp.** Đây không phải quy ước cho đẹp mà là lỗi đã đo được thật:

Doanh thu trong sổ chỉ tính đơn **đã hoàn thành**, nhưng phí sàn lấy từ file tài chính là **mọi đơn quyết toán trong kỳ**. TikTok cần khoảng 3 tuần sau đơn cuối cùng mới chốt "Đã hoàn tất". Tải sớm → đơn tuần cuối tháng chưa hoàn thành → doanh thu hụt mà phí sàn vẫn đủ → **lãi tụt giả tạo**.

Số thật tháng 8/2026: tải ngày 13-14/09 (tưởng là đủ 2 tuần) thì vẫn còn **64 đơn TikTok (26,3%) + 17 đơn Shopee (11,4%)** chưa hoàn thành → biên lãi báo 10,5% thay vì ~22%. Tra Sapo thì 15/15 đơn mẫu sau đó đều đóng thành công — tiền là thật, chỉ là chưa kịp ghi nhận.

Nếu buộc phải chạy sớm: vẫn làm được, nhưng **phải nói rõ với chủ shop là số lãi chưa chốt** và hẹn chạy lại sau ngày 20.

## Trình duyệt nào dùng được — ĐÃ KIỂM THẬT 22/10/2026

**Dùng Browser 1 (Chrome trên máy Mac, deviceId `af1ae8fc-...`).** Lý do quyết định: file tải về nằm **ngay trên máy Mac** nên mới chạy được script kiểm và `file_upload` lên Sổ Vận Hành. Chrome trên máy Windows tải về máy Windows → phiên chạy ở Mac KHÔNG đọc được file, coi như tải xong cũng vô dụng.

Mac Chrome đã đăng nhập sẵn **cả TikTok Seller lẫn Shopee** (sometime_official) — đã xác minh.

Luôn `select_browser` trước khi mở trang. Nếu nhóm tab cũ bị treo (navigate xong vẫn ra màn đăng nhập), gọi `tabs_context_mcp` với `createIfEmpty: true` để mở nhóm tab mới rồi thử lại — đừng vội kết luận "chưa đăng nhập".

**Chế độ quyền của cuộc chat:** nếu `navigate` báo `Navigation to this domain is not allowed` cho MỌI tên miền lạ (kể cả google.com) thì cuộc chat đang kẹt ở chế độ quyền hạn chế (`chromePermissionMode: follow_a_plan`, thường do trước đó vào chế độ Plan). Nhờ chủ shop mở menu Mode → chọn lại **Auto**. Không phải lỗi quyền trong Chrome, chỉnh `chrome://extensions` vô ích.

**Shopee chặn bằng mật khẩu:** vào mục Tài Chính → Doanh Thu, Shopee bật hộp "nhập mật khẩu Shopee của bạn". **Claude KHÔNG được nhập mật khẩu** — dừng lại, nhờ chủ shop tự nhập rồi báo xong, sau đó mới tải tiếp file Income.

## Bước 1 — Tải file

Tải vào một thư mục riêng cho tháng đó, ví dụ `~/Downloads/so-van-hanh-2026-09/`.

**Shopee** (`banhang.shopee.vn`) — chọn đúng khoảng 01 → hết tháng:

| Vai trò | Tên file mẫu các kỳ trước | Bắt buộc |
|---|---|---|
| Tài chính | `Income.đã phát hành.vn.20260901_20260930.xlsx` | ✅ |
| Đơn hàng | `Order.all.20260901_20260930.xlsx` | ✅ |
| Trả/hoàn | `Order.return_refund.20260901_20261001_part_1_of_1.xls` | ✅ |
| Giao thất bại | `Order.failed_delivery.20260901_20261001_part_1_of_1.xlsx` | — |
| Shop Stats | `sometime_official.shopee-shop-stats.20260901-20260930.xlsx` | — |

**TikTok** (`seller-vn.tiktok.com`):

| Vai trò | Tên file mẫu | Bắt buộc |
|---|---|---|
| Đơn hàng | `Tất cả đơn hàng-....xlsx` (có sheet `OrderSKUList`) | ✅ |
| Trả hàng | `Đơn trả hàng_hoàn tiền-....xlsx` | ✅ |
| Tài chính | `income_20260914001237(UTC+7).xlsx` (sheet `Chi tiết đơn hàng`, có cột `Tổng số tiền quyết toán`) | ✅ |
| Creator List | `Transaction_Analysis_Creator_List_20260901-20260930.xlsx` | — |

**BẪY:** file tài chính TikTok lọc theo **ngày quyết toán**, không phải ngày đặt đơn — phải chọn đúng kỳ, đừng để mặc định.

Nếu vào được trang quảng cáo Shopee thì tải thêm báo cáo chi phí quảng cáo tháng đó (ví quảng cáo Shopee KHÔNG nằm trong file Income — đã kiểm, không có đồng nào). Quảng cáo TikTok thì không cần tải: dòng "GMV thanh toán cho Quảng cáo TikTok" đã có sẵn trong file tài chính và sổ đã trừ đúng.

## Bước 2 — Kiểm file TRƯỚC khi upload

```bash
python3 .claude/skills/thang-moi/scripts/check_month_files.py ~/Downloads/so-van-hanh-2026-09
```

Script nhận diện file theo **nội dung** (tên sheet + tiêu đề cột) nên đổi tên file thoải mái. Nó báo: đủ/thiếu từng vai trò, khoảng ngày thật trong file (bắt lỗi tải nhầm tháng), 2 sàn có cùng tháng không, và **tỷ lệ đơn chưa hoàn thành** của từng sàn.

**TUYỆT ĐỐI không nhận diện file bằng "file mới nhất trong Downloads"** — đúng tinh thần mục 5 của `.claude/shared/notice_naming.md`. Đã dính thật 22/10: bấm nhầm dòng trong danh sách báo cáo Shopee nên tải về file tháng 10 trong khi tưởng là tháng 9. Mỗi file tải xong phải mở ra kiểm **role + khoảng ngày thật bên trong**, rồi mới xếp vào thư mục tháng.

Thoát mã 0 = dùng được. Mã 1 = còn vấn đề, đọc phần "CẦN XỬ LÝ" rồi sửa trước khi đi tiếp. **Nếu nó báo "TẢI QUÁ SỚM" thì đừng upload** — đợi qua ngày 20 rồi tải lại, nếu không sẽ phải làm lại từ đầu.

2 bẫy kỹ thuật script đã xử sẵn (đừng viết lại cho mệt): file `.xls` của Shopee thực ra là xlsx đặt sai đuôi; file sàn khai sai `<dimension>` nên không được mở bằng `read_only=True` kẻo chỉ đọc ra 1 cột.

## Quy ước lưu file (chốt 22/10/2026)

- Mỗi kỳ một thư mục riêng: `~/Downloads/svh-YYYY-MM/` (vd `svh-2026-09`).
- **Giữ nguyên tên file gốc do sàn đặt** — không đổi tên. Web nhận diện bằng nội dung, còn tên gốc giữ được dấu vết kỳ/giờ xuất để đối chiếu về sau. Trùng tên thì bỏ hậu tố ` (1)` do trình duyệt thêm.
- Không để lẫn 2 tháng trong cùng thư mục; file tải nhầm thì xoá ngay, đừng để lại.

## Bước 3 — Upload và tính

Mở `https://so-van-hanh-pwa.vercel.app`, kéo cả thư mục file vào khu upload. Web tự nhận diện; dòng nào hiện ⚠ thì chọn tay loại file ở ô select của dòng đó.

Bấm **Tính toán** → **Lưu vào lịch sử**, nhãn kỳ đặt đúng dạng `01/09/2026 – 30/09/2026`.

File đã upload được đẩy lên Supabase Storage (bucket `monthly-files`, công khai đọc) nên phiên khác lấy lại được mà không cần chuyển file giữa 2 máy.

## Bước 4 — Đọc cảnh báo của sổ

Sau khi tính, đọc hết khối "⚠ Cần chủ shop xác nhận thêm". Ba cảnh báo phải xử lý chứ không được lướt qua:

- **"LỆCH KỲ — số lãi tháng này đang THẤP GIẢ TẠO"** → file tải sớm, xem lại Bước 1.
- **"Lãi đang CAO hơn thật khoảng X đồng"** → có mã chưa có giá vốn. Ghi lại danh sách mã để báo chủ shop bổ sung vào sheet GiaCong.
- **"THIẾU CỘT ..."** → sàn đã đổi tên cột, số liên quan đang bị tính bằng 0. Phải báo ngay và sửa `calc.js`, đừng lưu đè số sai.

## Bước 5 — Điền chi phí vận hành

Ở zone "💰 Lãi lỗ", form "Chi phí vận hành tháng":

- **Lương nhân viên kho** và **lương nhân viên live**: bấm nút ⟳, web tự lấy.
- **Quảng cáo Shopee**: điền từ báo cáo quảng cáo hoặc ví quảng cáo Shopee (không tự lấy được).
- **Vật tư đóng gói** và **chi phí khác**: hỏi chủ shop.

Bấm "Lưu chi phí vào tháng này".

## Bước 6 — Đối chiếu chéo

Trước khi báo cáo, so 2 con số của sổ với số hiển thị trên chính seller center:

- TikTok: Tài chính → Thu nhập → lọc kỳ → ô **"Đã quyết toán"** phải khớp "Thực nhận TikTok" trong sổ.
- Shopee: Tài chính → Số dư tài khoản → **Doanh thu đơn hàng** phải khớp "Thực nhận Shopee" (trước điều chỉnh).

Lệch quá 1% thì **dừng lại, báo chủ shop**, đừng tự kết luận.

## Bước 7 — Báo cáo Telegram

Gửi qua bot (xem [reference_telegram_bot](../daily-warehouse-report/references/reference_telegram_bot.md)), gồm: kỳ vừa chốt; doanh thu hàng và thực nhận 2 sàn; lãi ròng và biên; số đơn và tỷ lệ huỷ/hoàn; các cảnh báo còn treo; và việc cần chủ shop làm (mã thiếu giá vốn, chi phí chưa điền).

## Không được làm

Không nhập mật khẩu hay tạo tài khoản ở bất kỳ đâu. Không sửa/xoá số liệu tháng đã lưu mà chưa hỏi chủ shop — thêm tháng mới thì cứ làm. Không tự kết luận "sàn tăng phí" khi thấy tỷ lệ phí sàn tăng: kiểm tỷ lệ đơn chưa hoàn thành trước, vì lệch kỳ gây ra đúng hiện tượng đó (tháng 8/2026 đã dính).
