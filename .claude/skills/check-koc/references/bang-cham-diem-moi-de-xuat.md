# Bộ chỉ số chấm điểm KOC mới — ĐỀ XUẤT (chưa áp dụng)

Ngày ghi: 26/11/2026. Trạng thái: **đề xuất + đã chạy thử 5 KOC**, chưa thay
công thức cột K. Cách chấm đang chạy thật vẫn là bảng trong SKILL.md Step 3.

Liên quan: [style-kenh-de-xuat.md](style-kenh-de-xuat.md) (cột I).

## Chỉ số chủ shop quan tâm (nêu 26/11/2026)

Số món bán ra · GMV từ mỗi khách hàng · GMV theo hạng mục SP · GPM video ·
lượt xem TB video · hiệu quả live · có live hay không.

## Nơi lấy số — TẤT CẢ nằm trên 1 trang (xác minh thật 26/11/2026)

Trang chi tiết nhà sáng tạo: `seller-vn.tiktok.com/affiliate/creator/detail?cid=…`
(vào bằng `seller-vn.tiktok.com/affiliate/creator` → ô tìm kiếm → click gợi ý →
click tên ở bảng kết quả; hồ sơ mở ở **tab mới**).

Khối "Doanh số" cho: GMV, Số món bán ra, GPM (tổng), **GMV từ mỗi khách hàng**,
**GMV từ mỗi kênh bán hàng** (Video / Thẻ SP / LIVE theo %), GMV theo hạng mục.
Khối "Video" cho: **GPM video**, số video, **Lượt xem video trung bình**.
Khối "LIVE" cho: **GPM LIVE**, số buổi LIVE, lượt xem LIVE TB.

Lấy nhanh bằng `javascript_tool` trên tab hồ sơ:

```js
(()=>{const t=document.body.innerText;const m=t.match(/GMV\s*\n[\s\S]*?(?:Xu hướng|Video ví dụ)/);return m?m[0].slice(0,2200):t.slice(0,1500)})()
```

⚠️ **GPM ở khối "Doanh số" KHÁC GPM video.** Cột G hiện nay đang ghi GPM tổng.
Với KOC bán chủ yếu qua live, GPM tổng cao vống lên so với GPM video: `ducph282`
có GPM tổng 1,2Tr nhưng **GPM video chỉ 77,3K** (98,59% GMV đến từ LIVE).
Nếu đổi sang bộ chỉ số mới phải nói rõ lấy GPM nào.

## Bảng đề xuất (tổng 100, giữ ngưỡng DUYỆT > 60)

| # | Nhóm | Chỉ số | Mục đích | Điểm |
|---|---|---|---|---|
| 1 | Sức bán đã chứng minh | Số món bán ra | Có thật sự bán được hàng chưa | 30 |
| 2 | Hiệu quả mỗi video | DT kỳ vọng/video = view TB ÷ 1.000 × GPM video | 1 video đáng bao nhiêu tiền | 25 |
| 3 | Khớp ngành hàng | % GMV hạng mục thời trang | Khán giả có quen mua đồ mặc không | 20 |
| 4 | Khớp tầm giá | GMV từ mỗi khách hàng | Khách có chi ở mức giá shop không | 15 |
| 5 | Live | Có live + GPM LIVE | Có đưa vào FS cho nhà sáng tạo được không | 10 |

Mốc:

1. ≥1.000: 30 · 300–999: 22 · 100–299: 14 · 30–99: 6 · <30: 0
2. ≥80K: 25 · 40–80K: 18 · 20–40K: 10 · <20K: 3 — **mốc đã sửa, xem dưới**
3. ≥50%: 20 · 20–49%: 14 · 1–19%: 8 · 0%: điều kiện loại (như cột E nay)
4. **≥150K: 15 · 100–150K: 10 · 60–100K: 5 · <60K: 0** (chủ shop cho biết
   26/11/2026: **GMV mỗi khách của shop là 150–170K**)
5. GPM LIVE ≥50K: 10 · có live nhưng GPM thấp: 5 · không live: 0

## ⚠️ Bài học từ lượt chạy thử: mốc nhóm 2 ban đầu SAI 50–100 lần

Mốc Claude đoán lúc đầu (≥5tr / 2–5tr / 500k–2tr / <500k) làm **cả 5 KOC đều
rơi xuống 3 điểm**, mục này mất hết tác dụng phân loại. Lý do: "Lượt xem video
trung bình" trên TikTok Shop là của **video có link bán hàng**, thực tế chỉ
**108–466 view**, không phải chục nghìn. DT kỳ vọng/video thật chỉ 14K–82K.
Mốc ở bảng trên đã sửa theo dải thật đo được. **Mọi mốc tiền phải đo rồi mới
chốt, không đoán.**

## Dữ liệu thật 5 KOC DUYỆT gần nhất (đo 26/11/2026, kỳ 25/10–24/11/2026)

| KOC | Số món | GPM video | View TB | DT/video | % thời trang | GMV/khách | LIVE |
|---|---|---|---|---|---|---|---|
| thanhquyenreview1 | 7.780 | 175,1K | 466 | 81,6K | 99,25% | 129,3K | GPM 45,3K · 10 buổi |
| gucuaquatdca06 | 312 | 205,1K | 252 | 51,7K | 92,28% | 216,6K | không live |
| ducph282 | 976 | 77,3K | 251 | 19,4K | 99,80% | 129–258K | GPM 1,4Tr · 75 buổi |
| minhrosivip | 146 | 132K | 108 | 14,3K | 96,92% | 215,5K | không live |
| luckyboy2xxx | 5.320 | 139,6K | 330 | 46,1K | 7,11% | 311,6K | GPM 2,3Tr · 70 buổi |

Điểm THÀNH PHẦN theo bảng mới (mốc đã sửa) — ghi `giá trị → điểm`:

| KOC | Số món (30) | DT/video (25) | % thời trang (20) | GMV/khách (15) | Live (10) | Tổng |
|---|---|---|---|---|---|---|
| thanhquyenreview1 | 7.780 → 30 | 81,6K → 25 | 99,25% → 20 | 129,3K → 10 | 45,3K/10 buổi → 5 | **90** |
| luckyboy2xxx | 5.320 → 30 | 46,1K → 18 | 7,11% → 8 | 311,6K → 15 | 2,3Tr/70 buổi → 10 | **81** |
| gucuaquatdca06 | 312 → 22 | 51,7K → 18 | 92,28% → 20 | 216,6K → 15 | không live → 0 | **75** |
| ducph282 | 976 → 22 | 19,4K → 3 | 99,80% → 20 | ~194K → 15 | 1,4Tr/75 buổi → 10 | **70** |
| minhrosivip | 146 → 14 | 14,3K → 3 | 96,92% → 20 | 215,5K → 15 | không live → 0 | **52** |

Nhận xét rút ra từ bảng thành phần:

- Hai cột **Số món** + **DT/video** tạo ra gần hết khoảng cách 90→52. Đây là
  phần phân loại thật.
- **GMV/khách: 4/5 KOC cùng 15 điểm** → mục này phân loại yếu, vì KOC bán đồ
  mặc thì GMV/khách tự nhiên rơi vào 130–310K, gần như luôn ≥150K. Nó chỉ phát
  huy khi gặp KOC bán đồ rẻ (phụ kiện vài chục nghìn). Đề xuất: **giữ 15 điểm
  nhưng coi là lưới chặn, không phải mục ăn điểm**; nếu muốn gọn hơn thì hạ
  xuống 5 và dồn 10 sang DT/video. Chấm **một chiều** (chỉ trừ khi THẤP hơn
  tầm shop) vì khách quen chi cao hơn giá shop là lợi thế, không phải điểm trừ.
- **Live quyết định 2 trường hợp**: bỏ mục live thì `ducph282` còn 60 → trượt,
  dù đó là KOC bán khoẻ nhất qua live (98,59% GMV từ LIVE).
- `minhrosivip` trượt vì **yếu đều cả 2 cột đầu**, không phải do một chỉ số lẻ.

So sánh với điểm cũ:

| KOC | Cũ | Mới | Chênh |
|---|---|---|---|
| thanhquyenreview1 | 95 DUYỆT | 90 DUYỆT | −5 |
| luckyboy2xxx | 95 DUYỆT | 81 DUYỆT | −14 (thời trang chỉ 7%) |
| gucuaquatdca06 | 95 DUYỆT | 75 DUYỆT | −20 |
| ducph282 | 95 DUYỆT | 70 DUYỆT | −25 |
| minhrosivip | 75 DUYỆT | **52 KHÔNG DUYỆT** | −23, **lật kết quả** |

## Câu hỏi còn chờ chủ shop quyết

1. ✅ **ĐÃ CÓ: tầm giá shop = GMV mỗi khách 150–170K** (chủ shop cho biết
   26/11/2026) → mốc nhóm 4 đã đặt lại một chiều ở trên. Còn lại: giữ 15 điểm
   hay hạ xuống 5 và dồn 10 sang DT/video (xem nhận xét ở mục trên).
2. **Thể thao có tính là hạng mục liên quan không?** `luckyboy2xxx` có 92,21%
   GMV là Thể thao, thời trang chỉ 7,11%, nên tụt 12 điểm ở nhóm 3 — dù live
   rất mạnh (GPM LIVE 2,3Tr, 32,49K view/buổi). Đồ mặc nhà khá gần đồ thể thao.
3. **minhrosivip bị lật sang KHÔNG DUYỆT** (146 món, view TB 108, không live).
   Chủ shop xem có đúng ý mình không — đây là phép thử chính của bảng mới.
