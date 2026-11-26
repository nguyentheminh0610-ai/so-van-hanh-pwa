# Cột I "Style kênh" — đề xuất lượng hoá (CHƯA CHỐT, chủ shop làm cuối)

Ngày ghi: 26/11/2026. Trạng thái: **đề xuất chờ chủ shop chốt**, chưa áp dụng.
Hiện tại cột I vẫn chấm theo quy tắc cũ trong SKILL.md Step 3 (mặc định
`Phù hợp vừa`, hạ `ít` khi kênh rõ ràng lệch chủ đề).

## Vì sao có đề xuất này

Chủ shop (26/11/2026) đang tự xem kênh và cảm nhận theo gu "hình ảnh đẹp,
hợp hay không" để đoán tiềm năng KOC, muốn Claude lượng hoá giúp. Yêu cầu
chủ shop đặt ra:

- **Đơn giản**, vì cột I chỉ 15/100 điểm, là trọng số ít và cuối cùng.
- **Ưu tiên ổn định + chính xác** hơn là mô tả được gu: chấm lại nhiều lần
  phải ra cùng kết quả, không phụ thuộc cảm nhận.

Claude đã nói rõ giới hạn: "đẹp theo gu" không đo được; chỉ thay bằng dấu
hiệu quan sát được. Chủ shop đồng ý hướng đó nhưng muốn bản đơn giản hơn
bản checklist 5 tiêu chí ban đầu.

## Đề xuất chính (bản đơn giản — chỉ dùng số đo được)

Hai số, đều lấy từ trang hồ sơ KOC trên TikTok Shop (đã đọc sẵn khi chấm
cột E và H):

1. **% khán giả nữ** — tab "Người theo dõi" → Giới tính.
2. **Có hạng mục "Trang phục nữ & đồ lót"** trong biểu đồ "GMV theo hạng mục
   sản phẩm" (bất kỳ %, cùng biểu đồ đang dùng cho cột E).

| Kết quả cột I | Điều kiện |
|---|---|
| `Phù hợp nhiều` | nữ ≥65% **và** có Trang phục nữ & đồ lót |
| `Phù hợp vừa` | đạt đúng 1 trong 2 |
| `Phù hợp ít` | không đạt cả 2 |

Không đọc được 1 trong 2 số → coi điều kiện đó là không đạt, ghi cột M
`Style: thiếu <giới tính | hạng mục>` để chủ shop biết vì sao.

Ghi vào cột M dạng `Style: nữ 71%, có TP nữ → nhiều` để kiểm được trên sheet.
Không đổi công thức cột K/L: 3 giá trị cũ giữ nguyên nên sheet không cần sửa.

## Bản đầy đủ hơn (đã đề xuất, chủ shop thấy phức tạp — giữ lại để tham khảo)

Checklist 5 tiêu chí × 0–3 điểm, tổng 15: (1) nội dung có mặc/thử đồ,
(2) bối cảnh ở nhà/đời sống, (3) % khán giả nữ, (4) tiêu chuẩn hình ảnh
(sáng/rõ/gọn), (5) trang phục nữ là hạng mục GMV top. Quy đổi 11–15 nhiều,
6–10 vừa, 0–5 ít. Tiêu chí 1, 2, 4 cần nhìn ảnh bìa video nên kém ổn định;
đó là lý do bản chính ở trên chỉ giữ tiêu chí 3 và 5.

## Cách hiệu chỉnh cho khớp gu chủ shop (chủ shop OK cách này, làm sau)

1. Chủ shop chọn ~10 KOC trong sheet đã thấy "đẹp, có tiềm năng" và ~10 KOC
   thấy "không hợp" (ghi tên hoặc STT).
2. Claude chấm thử 20 KOC đó theo quy tắc đề xuất, lập bảng so với nhận xét
   của chủ shop.
3. Chỗ lệch → chỉnh mốc (ví dụ 65% nữ xuống 60%) hoặc thêm/bớt điều kiện.
   Chỉ khi 20 KOC khớp đa số mới chốt và chuyển quy tắc vào SKILL.md Step 3,
   ghi ngày chốt + lý do, thay cho quy tắc cũ.

Khi chủ shop nói "làm cái style kênh đi" / "hiệu chỉnh style kênh" → bắt đầu
từ bước 1 ở trên.
