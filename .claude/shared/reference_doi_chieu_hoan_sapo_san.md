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
TikTok: Đơn hàng → **Trả hàng/Hoàn tiền**.

Script tự nới biên ±7 ngày cho Sapo (phiếu tạo trễ hơn ngày sàn ghi nhận vẫn
khớp), tự đọc `.xlsx` bằng stdlib (PC không cần cài `openpyxl`/`pandas`), tự dò
mã trong mọi cột nên không vỡ khi sàn đổi tên cột.

Kết quả ghi ra `~/doi-chieu-hoan/ket-qua/`: `sapo-phieu-tra.csv`,
`sapo-THIEU-<sàn>.csv`, `sapo-THUA-<sàn>.csv`.

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
