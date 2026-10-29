# Đối chiếu đơn hoàn: Sapo ↔ Sàn (mã nào khớp mã nào)

Chốt **2026-10-28**. Lý do có file này: chủ shop từng dùng Sapo để theo dõi đơn
hoàn nhưng bỏ vì "sai mã giữa Sapo và sàn", cần xác định lại có lấy Sapo làm
chuẩn được không.

Công cụ: `scripts/doi_chieu_hoan_sapo_san.py` (đối chiếu 2 chiều, lấy sàn làm chuẩn).

---

## 1. Sapo KHÔNG sinh mã riêng — nó lưu thẳng mã của sàn

Đây là điểm bị hiểu nhầm lâu nay. Xác minh thật ngày 28/10 qua
`/admin/order_returns.json`:

| Trường Sapo | Thực chất là gì | Ví dụ TikTok | Ví dụ Shopee |
|---|---|---|---|
| `order.name` | **mã ĐƠN HÀNG của sàn** | `586766401787430613` | `261017U5W68FJX` |
| `name` (của phiếu trả) | mã phiếu trả/hoàn của sàn | `4042845430139422421` | `2610270QFYKX63H` |
| `shipping_info.tracking_number` | **mã vận đơn CHIỀU VỀ** | `854167309243` | `SPXVN06439951676A` |
| `shipping_info.fulfillment_tracking_numbers` | **mã vận đơn CHIỀU ĐI** | `862691132843` | `SPXVN06769537275A` |

`order.name` có đủ **100%** trên cả 184 phiếu trong 39 ngày kiểm → đây là khóa
khớp đáng tin nhất.

## 2. ⚠️ Bẫy thật gây ra chuyện "sai mã"

**Mã vận đơn chiều về KHÁC mã chiều đi** với phiếu `return_and_refund`
(khách chủ động trả hàng) — TikTok đi `862691132843`, về `854167309243`.
Ai so mã chiều về với mã chiều đi sẽ thấy "lệch gần hết" dù dữ liệu hoàn toàn đúng.

Với phiếu `delivery_failed` (bom hàng / giao thất bại) thì 2 mã **trùng nhau**
(hàng quay đầu, vẫn bì cũ).

Số liệu 39 ngày (20/09→28/10/2026): TikTok 62/148 phiếu có 2 mã trùng,
Shopee 17/36. Tức **hơn nửa số phiếu có mã chiều về khác chiều đi** → đối chiếu
1-mã-với-1-mã chắc chắn sai.

**Quy tắc: so theo TẬP mã**, một phiếu Sapo khớp một dòng sàn nếu 2 tập mã giao
nhau ở bất kỳ mã nào (mã đơn sàn / mã phiếu trả / mã chiều về / mã chiều đi).

## 3. Phân loại phiếu trả Sapo — đừng gộp chung

| `return_type` / `shipment_status` | Nghĩa | Có hàng về kho? |
|---|---|---|
| `delivery_failed` / `returned` | bom hàng, giao thất bại, hàng quay đầu | **Có** |
| `return_and_refund` / `returned` | khách trả, hàng đã về | **Có** |
| `return_and_refund` / `returning` | khách trả, hàng đang trên đường | Chưa, sẽ về |
| `refund` / `no_return_required` | hoàn tiền không cần trả hàng | **KHÔNG** |

Nhóm `refund / no_return_required` (TikTok 9/148 phiếu) **không bao giờ có hàng
về kho** — đưa vào đối chiếu kho là tự tạo ra "thiếu ảo".

26/148 phiếu TikTok không có mã vận đơn chiều về (phần lớn là nhóm refund này) →
những phiếu đó phải khớp bằng `order.name`, không khớp bằng mã vận đơn.

## 4. Cách chạy đối chiếu

File export của sàn có **tên + SĐT + địa chỉ khách**. Repo này **PUBLIC** →
tuyệt đối không để file export trong repo. Mặc định script đọc ở `~/doi-chieu-hoan`
(ngoài repo).

```
# bước 1 — xem trước phía Sapo, không cần file sàn
python scripts\doi_chieu_hoan_sapo_san.py --days 39 --sapo-only

# bước 2 — xuất file từ sàn, đặt tên có chữ "shopee" / "tiktok",
#          bỏ vào C:\Users\<user>\doi-chieu-hoan  rồi:
python scripts\doi_chieu_hoan_sapo_san.py --days 39
```

Shopee: Kênh Người Bán → **Hàng hoàn** (không phải "Đối soát").

**TikTok thì KHÔNG cần xuất file nữa** (chốt 29/10/2026) — gọi thẳng API của
chính trang đó qua Claude in Chrome, xem mục 7. Nhanh hơn, không phải chờ sàn
dựng file, và không tạo ra file chứa SĐT/địa chỉ khách nằm lăn lóc trên đĩa.
Đường đi: Đơn hàng → **Quản lý trả hàng** (menu thật, đừng gõ URL đoán).

Script tự nới biên ±7 ngày cho Sapo (phiếu tạo trễ hơn ngày sàn ghi nhận vẫn
khớp), tự đọc `.xlsx` bằng stdlib (PC không cần cài `openpyxl`/`pandas`), tự dò
mã trong mọi cột nên không vỡ khi sàn đổi tên cột.

Kết quả ghi ra `~/doi-chieu-hoan/ket-qua/`: `sapo-phieu-tra.csv`,
`sapo-THIEU-<sàn>.csv`, `sapo-THUA-<sàn>.csv`.

## 4b. ⚠️ KẾT QUẢ THẬT TIKTOK (chạy 29/10/2026, kỳ 20/09→28/10)

**Phát hiện quan trọng nhất: trang "Quản lý trả hàng và hoàn tiền" của TikTok
KHÔNG liệt kê đơn bom hàng / giao thất bại.** Nó chỉ chứa yêu cầu do khách chủ
động tạo. Vì vậy không thể lấy riêng trang đó làm "chuẩn" cho hàng về kho.

Số liệu (lấy qua API `POST /api/v1/reverse/component/orders/list` mà chính
trang đó gọi — xem mục 7):

| | Số phiếu |
|---|---|
| Sapo có trong kỳ | **148** |
| — khớp với trang trả hàng TikTok | **86** = 77 `return_and_refund` + 9 `refund` |
| — KHÔNG có trên trang trả hàng | **62** — và **100% là `delivery_failed`** |
| Sàn có trong kỳ (khách chủ động trả/hoàn) | **91** |
| → **Sapo THIẾU** | **6** |
| → Tỷ lệ khớp | **85/91 = 93,4%** |

Phân tách tuyệt đối sạch: 62 phiếu "thừa" **không lẫn một phiếu
return_and_refund nào** → đây không phải lỗi dữ liệu, mà là Sapo ghi nhận thêm
nhóm bom hàng mà trang trả hàng TikTok không có. **Sapo rộng hơn sàn ở nhóm
này, và đó là phần có giá trị.**

6 mã Sapo thiếu (đã kéo lại Sapo ngày 29/10, vẫn thiếu → **lỗi thật, không phải
trễ đồng bộ**):

| Ngày | Mã đơn hàng | Mã phiếu hoàn |
|---|---|---|
| 15/10 | 586503282607621657 | 4042693672764278297 |
| 19/10 | 586610131822281747 | 4042742562801288211 |
| 21/10 | 586649719548052588 | 4042759189264893036 |
| 28/10 | 586752779638113660 | 4042844047037990268 |
| 28/10 | 586754423000565329 | 4042850476321441361 |
| 28/10 | 586807163917076096 | 4042849491612108416 |

## 7. Lấy dữ liệu đơn hoàn TikTok KHÔNG cần tải file

Trang `seller-vn.tiktok.com/order/return` gọi
`POST /api/v1/reverse/component/orders/list`. Gọi lại chính URL đó trong tab đã
đăng nhập là lấy được đủ dữ liệu, nhanh và chắc hơn xuất Excel.

Thân request:
```json
{"search_condition":{"tab":{"str_value_list":["100"]},
 "order_sort_comp":{"str_value_list":["OrderSort_UPADTE_TIME_DESC"]}},
 "pagination_type":0,"offset":0,"count":50,"component_version":"hit_ui_opt"}
```
`tab` = `100` (Tất cả) / `800` (Đang chờ bạn xử lý).

**Bẫy phân trang:** chỉ tăng `offset` thì chết ở 100 bản ghi. Phải lấy
`search_next_cursor` ở trang đầu rồi **gửi kèm `search_cursor` đó cho mọi trang
sau**, đồng thời vẫn tăng `offset`. Làm đúng thì ra đủ 502/502 bản ghi.

Mỗi bản ghi: `biz_data.main_order_id` = mã đơn sàn, `biz_data.reverse_main_order_id`
= mã phiếu hoàn (khớp thẳng với `order.name` và `name` bên Sapo).

**Bẫy ngày tháng:** không có trường ngày dạng chuỗi; UI tự format từ
`target_timestamp`. Mỗi thẻ có **nhiều** `target_timestamp` (có cả hạn xử lý ở
tương lai), lấy bừa sẽ ra ngày sai tận 2022. Lấy **giá trị nhỏ nhất** thì đúng —
đã kiểm chứng: 85/86 phiếu đã khớp rơi đúng trong kỳ.

## 5. Ngưỡng kết luận

- Khớp **≥98%** và phần thiếu giải thích được → Sapo dùng làm chuẩn được.
- **90–98%** → Sapo chỉ tham khảo, phải đối chiếu sàn định kỳ.
- **<90%** → không lấy Sapo làm chuẩn, phải lấy sàn làm gốc.

## 6. ⚠️ Hệ thống "Hoàn về chưa nhận" hiện tại đang lấy Sapo làm chuẩn

`scripts/sync_returns_feed.py` ghi vào bảng `platform_returns_feed` — tên bảng
dễ gây hiểu nhầm là "lấy từ sàn", nhưng **nguồn thật 100% là Sapo**
(`/admin/order_returns.json`). Khối "Hoàn về chưa nhận" của Sổ Kho, banner Sổ
Vận Hành và Báo cáo 5 đều dựa trên đó.

Nghĩa là: **nếu Sapo thiếu đơn thì cả 3 chỗ đó cũng thiếu theo**, không có gì
bắt lỗi. Đây chính là lý do phải chạy đối chiếu này trước khi tin con số.

Xem thêm: [Sapo & trình duyệt](reference_sapo_and_browser_access.md).
