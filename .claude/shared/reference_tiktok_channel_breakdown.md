# Cách tính phân tích nguồn đơn TikTok Shop theo kênh

**Chốt:** 2026-11-03 — từ phân tích file tháng 10/2026

## File cần tải (chỉ 1 file)

**Shop Analytics → Key Metrics**
- Vào TikTok Shop Seller Center → Phân tích → Tổng quan shop → Export
- Tên file mẫu: `Shop Analytics_Key metrics_YYYYMMDD.xlsx`

## Cách đọc file

File có 2 phần:
1. **Tổng quan** (dòng "Tổng giá trị") — dùng để lấy số tháng
2. **Dữ liệu theo ngày** — dùng để vẽ trend chart

### Dòng "Tổng giá trị" — mapping cột sang kênh:

| Tên cột trong file | Kênh hiển thị | Index cột (0-based) |
|---|---|---|
| GMV | Tổng GMV | 1 |
| GMV nhờ buổi LIVE của nhà sáng tạo | **KOC LIVE** | 16 |
| GMV nhờ buổi LIVE của tài khoản kết nối | **Shop LIVE** | 19 |
| GMV thẻ sản phẩm | **Thẻ sản phẩm** | 22 |
| GMV đến từ video liên kết | **KOC Video** | 23 |
| GMV nhờ video của tài khoản kết nối | **Shop Video** | 26 |

> **Lưu ý:** "nhà sáng tạo" = KOC/affiliate bên ngoài. "tài khoản kết nối" = kênh của shop.

## Công thức tính nhóm

```
Tổng KOC (Liên kết) = KOC Video + KOC LIVE
Tổng Shop own       = Shop LIVE + Thẻ sản phẩm + Shop Video

% mỗi kênh = GMV kênh / GMV tổng × 100
```

## Kết quả tháng 10/2026 (làm mốc so sánh)

| Kênh | GMV | % |
|---|---|---|
| KOC Video | 219,9M ₫ | 62,5% |
| KOC LIVE | 60,4M ₫ | 17,2% |
| Shop LIVE | 31,6M ₫ | 9,0% |
| Thẻ sản phẩm | 29,0M ₫ | 8,2% |
| Shop Video | 10,8M ₫ | 3,1% |
| **Tổng** | **351,7M ₫** | 100% |

→ Liên kết: **79,7%** | Shop own: **20,3%**

## Chỉ số bổ sung từ file khác

Nếu muốn đi sâu hơn, cần thêm:

| File | Thêm được gì |
|---|---|
| `Video performance Key metrics` | GPM, VV, CTOR video theo ngày |
| `Live Performance Core Stats` | Số buổi LIVE, thời lượng xem TB, GPM LIVE |
| `Product Card Traffic Stats` | CTR thẻ SP, tỷ lệ xem→mua |
| `AI_Report_Data` | Breakdown theo từng KOC (creator_id, loại Video/LIVE) |

## Ứng dụng vào Sổ Vận Hành

Khu vực nên thêm: **Zone Kênh bán** (đặt cạnh Zone Chi phí)
- Input: dán số từ dòng "Tổng giá trị" vào 5 ô
- Output: donut chart + bar chart tự động tính %
- Tần suất cập nhật: cuối tháng (khi có file tháng mới)
