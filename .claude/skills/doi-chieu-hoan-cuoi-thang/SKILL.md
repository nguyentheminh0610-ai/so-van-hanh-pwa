---
name: doi-chieu-hoan-cuoi-thang
description: Đối chiếu 3 chiều đơn hoàn/hàng về kho giữa SÀN (file export TikTok + Shopee), SAPO (phiếu trả hàng) và SỔ KHO (lượt quét thật) để biết Sapo có thiếu hoặc thừa phiếu nào không -- dùng khi chủ shop nói "đối chiếu đơn hoàn", "check chéo Sapo với sàn", "Sapo thiếu thừa đơn nào", "đối chiếu hàng hoàn cuối tháng", hoặc vào kỳ chạy hằng tháng sau ngày 29. Bao gồm: xuất đúng bộ file từ 2 sàn, nhận biết đơn nào hàng THẬT SỰ về kho (không được suy từ mã vận đơn), chạy script đối chiếu, và đọc kết quả theo 6 nhóm. KHÔNG dùng cho báo cáo kho hằng ngày (xem daily-warehouse-report) hay hệ thống "Hoàn về chưa nhận" chạy tự động (xem sync_returns_feed.py).
---

# Đối chiếu đơn hoàn: SÀN × SAPO × SỔ KHO

Chốt **30/10/2026**, sau khi chạy thật trên dữ liệu tháng 10 và **phát hiện kết
luận ban đầu sai hoàn toàn** (xem mục Bẫy).

Kiến thức nền đầy đủ: [reference_doi_chieu_hoan_sapo_san.md](../../shared/reference_doi_chieu_hoan_sapo_san.md)

---

## ⚠️ QUY TẮC SỐ 1 — sai cái này là sai toàn bộ

> **KHÔNG được kết luận "hàng đã về kho" từ việc đơn CÓ MÃ VẬN ĐƠN hay CÓ
> NGÀY GỬI HÀNG.**

Shopee cấp mã vận đơn **ngay khi shop bấm "Chuẩn bị hàng"**, còn *"Ngày gửi
hàng"* chỉ là **hạn phải giao cho shipper**. Đơn đã chuẩn bị xong mà khách hủy
trước khi shipper tới lấy vẫn có **đủ cả hai trường đó** — nhưng kiện hàng
**nằm lại trên kệ**, không hề đi đâu.

Dấu hiệu đúng (kiểm trên 81 đơn thật, phân tách 100% sạch):

| Muốn biết | Nhìn cột | Ghi chú |
|---|---|---|
| Kiện **đã rời kho** | `Thời gian giao hàng` **có giá trị** | ✅ dấu hiệu chính — giống nhau ở MỌI file export |
| Kiện **đã quay về kho** | `Trạng thái trả hàng` = `"Đã trả hàng"` | chỉ được điền trong file `Order.failed_delivery` |
| ~~Mã vận đơn~~ | — | ❌ vô dụng, đơn chưa gửi cũng có |
| ~~Ngày gửi hàng~~ | — | ❌ vô dụng, là hạn gửi chứ không phải lúc gửi |

**Bằng chứng mạnh nhất vẫn là lượt quét kho** (`warehouse_return_checks`) — đó
là hành động vật lý có thật. Sàn với Sapo lệch nhau mà chưa tra lượt quét thì
**chưa đủ căn cứ nói ai sai**.

---

## Bước 1 — Xuất file từ sàn

File export có **tên + SĐT + địa chỉ khách**. Repo PUBLIC → để ở
`~/doi-chieu-hoan` (Windows: `C:\Users\<user>\doi-chieu-hoan`), **tuyệt đối
không bỏ vào repo**. Tên file phải chứa chữ `shopee` hoặc `tiktok` để script
nhận ra sàn.

### Shopee — Quản Lý Đơn Hàng → Đơn Trả hàng/Hoàn tiền hoặc Đơn hủy → **Xuất**

Xuất **cả 3** nhánh, thiếu nhánh nào là sinh ra "Sapo thừa" giả ở nhánh đó:

| Nhánh | File ra | Vai trò |
|---|---|---|
| Đã hủy | `Order.cancelled...` | **bao trùm** — chứa luôn cả đơn giao thất bại |
| Giao không thành công | `Order.failed_delivery...` | bổ sung cột `Trạng thái trả hàng` |
| Trả hàng/Hoàn tiền | `Order.return...` | khách chủ động trả — **hay bị quên nhất** |

Giới hạn **30 ngày/lần**. Cần dài hơn thì xuất nhiều file, script tự gộp.

### TikTok — Đơn hàng → Quản lý trả hàng → Xuất

Hoặc lấy thẳng qua API nếu có quyền trình duyệt (nhanh hơn, không sinh file
chứa dữ liệu khách) — cách gọi ghi trong
[reference_doi_chieu_hoan_sapo_san.md](../../shared/reference_doi_chieu_hoan_sapo_san.md) mục 7.

⚠️ TikTok có **2 nguồn tách rời**, phải lấy đủ cả hai:
1. *Quản lý trả hàng* — khách chủ động trả/hoàn
2. *Quản lý đơn hàng* → tab **Giao không thành công** — bom hàng.
   Trang trả hàng **không hề liệt kê** nhóm này (đo được: 62/148 phiếu Sapo,
   tức 42% lượng hàng về kho, nằm ở nhóm này).

---

## Bước 2 — Chạy đối chiếu

```bash
python3 scripts/doi_chieu_hoan_sapo_san.py --thang 10
```

Hoặc chỉ định kỳ: `--tu 2026-10-01 --den 2026-10-31`.
Xem riêng phía Sapo, chưa cần file sàn: thêm `--sapo-only`.

Script tự: kéo phiếu trả Sapo qua API → đọc mọi file trong `~/doi-chieu-hoan`
(gộp các file trùng đơn) → đọc lượt quét Sổ Kho → đối chiếu 3 chiều → ghi CSV
vào `~/doi-chieu-hoan/ket-qua/`.

---

## Bước 3 — Đọc kết quả theo 6 nhóm

| Nhóm | Nghĩa | Phải làm gì |
|---|---|---|
| `OK — san + Sapo + kho deu khop` | trọn vẹn | không cần làm gì |
| `HANG CON O KHO (huy truoc khi shipper lay)` | khách/shop hủy trước khi shipper lấy, hàng chưa rời kệ | **Sapo không sinh phiếu là ĐÚNG**, đừng báo lỗi |
| `HOAN VE CHUA NHAN — kho chua quet` | Sapo có phiếu, kho chưa quét | kiểm xem kiện đã về chưa — trùng với khối đỏ Sổ Kho |
| `SAPO THIEU — kho da quet ma Sapo khong co phieu` | **lỗi thật, nặng nhất** | hàng đã về kho mà sổ không ghi → tạo phiếu trên Sapo |
| `SAPO THIEU — san bao da ve, Sapo va kho deu khong co` | nghi vấn | kiểm gấp, có thể thất lạc |
| `SAPO THUA — co phieu nhung file san khong co don nay` | xem cột `kho_quet` trước khi kết luận | kho **đã quét** → hàng thật, chỉ là chưa xuất đủ file sàn. Kho **chưa quét** → mới đáng nghi |

**Đừng vội báo "Sapo thừa" — phần lớn là FILE SÀN THIẾU, không phải Sapo sai.**

Bằng chứng tháng 10: 19 phiếu Sapo không có trong 2 file Shopee, trong đó 7
phiếu loại `delivery_failed` (bom hàng) — **cả 7/7 đều đã được kho quét**, ngày
quét sát ngày tạo phiếu (chênh 0–2 ngày), và cả 7 đơn đều đặt trong kỳ export.

Tức là: hàng về kho thật, Sapo ghi đúng, **nhưng Shopee không xếp chúng vào
"Đã hủy" lẫn "Giao không thành công"** — nhiều khả năng kiện bật về thì Shopee
tự hoàn tiền và đẩy đơn sang *Trả hàng/Hoàn tiền*.

→ Khi thấy "Sapo thừa", việc đầu tiên là nhìn cột `kho_quet`. Có lượt quét =
hàng thật = đi xuất thêm file sàn, đừng đi sửa Sapo.

---

## Kết quả tháng 10/2026 (mốc so sánh cho lần sau)

| | TikTok | Shopee |
|---|---|---|
| Sapo THIẾU | 0 (6 đơn nghi ngờ đã loại — yêu cầu trả bị tự hủy, khách vẫn giữ hàng) | **0** |
| Sapo THỪA | 0 (đã tra toàn bộ danh sách đơn, 62/62 có thật) | 0 thật — 17/20 đã có lượt quét, 3 còn treo |

**Kết luận: Sapo đủ chuẩn để làm nguồn gốc cho đơn hoàn**, miễn là chạy đối
chiếu này định kỳ. Và **không được thay Sapo bằng file sàn** — trang trả hàng
của sàn thiếu hẳn nhóm bom hàng.

---

## Bẫy đã dính thật, đừng lặp lại

1. **Suy "hàng về kho" từ mã vận đơn** → kết luận sai "Shopee thiếu 6 đơn",
   trong khi số đúng là 0. Xem QUY TẮC SỐ 1.
2. **Đọc cột theo số thứ tự** → file `Order.cancelled` có thêm cột "Lý do hủy"
   làm lệch mọi cột phía sau. Luôn tra theo **tên cột**.
3. **Quên chuẩn hoá Unicode NFC** → tra `'Ngày gửi hàng'` ra `None`.
4. **Lấy file đầu tiên rồi bỏ qua file sau** → cùng một đơn nằm ở 2 file và
   mỗi file điền khác nhau. Phải **gộp**.
5. **So phiếu Sapo của sàn A với file của sàn B** → sinh ra 153 đơn "thừa" giả.
   Chỉ xét "thừa" cho sàn đã có file.
6. **So mã vận đơn chiều về với chiều đi** → lệch gần hết dù dữ liệu đúng.
   Với phiếu `return_and_refund` hai mã **khác nhau**; chỉ `delivery_failed`
   mới trùng. Script so theo **tập mã** nên đã tránh được.
7. **Chạy 2 vòng kéo dữ liệu nền cùng lúc trong trình duyệt** → một vòng đứng
   im. Chạy lần lượt.

---

## Khi nào chạy

Cuối tháng, **sau ngày 29**, trước khi chốt số tháng (`thang-moi`). Chạy được
trên cả Mac lẫn PC — chỉ đọc dữ liệu, không ghi gì lên sàn hay Sapo, nên
**không cần kiểm `hostname`** và không sợ chạy trùng.

Nếu phiên đang chạy bị chặn domain sàn (`Navigation to this domain is not
allowed`) thì quyền được cấp **theo từng phiên**, không theo Chrome — giao việc
cho phiên đang có quyền, hoặc nhờ chủ shop xuất file rồi gửi thẳng vào chat.
Xem [reference_chrome_browsers.md](../../shared/reference_chrome_browsers.md).
