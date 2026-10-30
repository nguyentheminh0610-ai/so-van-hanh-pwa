---
Chốt 30/10/2026 — tra từ chính sách công khai của TikTok Shop University (seller-vn.tiktok.com)
và Shopee Trung tâm Trợ giúp Người bán. Dùng chung cho mọi skill cần phân loại
"case trả hàng này có tính lỗi shop không" (hiện tại: review-return-check).
---

# Lý do trả hàng nào tính là lỗi shop (từng sàn)

## Vì sao cần file này

`shop_error_kind` (xem [review-return-check/SKILL.md](../skills/review-return-check/SKILL.md)
mục 4.1) đã phân loại lỗi shop theo **nội dung thật** (đọc chat/mô tả, không đoán).
File này bổ sung thêm: lý do nào **sàn tự tính vào chỉ số lỗi/hiệu suất shop**
(SFRR của TikTok, NFR của Shopee) — dùng để quyết định có cần nhắn khách mời đổi
lý do hiển thị trên sàn hay không (xem mục "Nhắn khách đổi lý do trả hàng" trong
SKILL.md của review-return-check).

**Hai việc tách biệt, đừng nhầm:**
- `shop_error_kind` = lỗi gì **thật**, dùng để ghi Sổ Kho + insight nội bộ. KHÔNG đổi.
- Lý do hiển thị **trên sàn** = cái ảnh hưởng chỉ số, có thể mời khách đổi nếu
  khách đồng ý — không ảnh hưởng tới việc ghi nhận nội bộ phía trên.

## Bảng phân loại

| Nhóm lý do (ý nghĩa) | TikTok Shop — tính lỗi shop (SFRR)? | Shopee — tính lỗi shop (NFR)? |
|---|---|---|
| Giao sai sản phẩm/sai mẫu/sai size/sai màu so với đơn đặt | ⚠️ Có | ⚠️ Có |
| Thiếu hàng/thiếu phụ kiện trong đơn | ⚠️ Có | ⚠️ Có |
| Hàng lỗi/hỏng/bẩn/tuột chỉ/không hoạt động/hết hạn sử dụng | ⚠️ Có | ⚠️ Có |
| Nghi hàng giả/không chính hãng | ⚠️ Có | ⚠️ Có |
| Không đúng mô tả (sai chất liệu/màu/kích cỡ so với listing) | ⚠️ Có | ⚠️ Có |
| Hư hỏng nặng/mất hàng khi vận chuyển | ⚠️ Có — **trừ khi** xác định lỗi đơn vị vận chuyển (J&T/SPX), lúc đó không tính | ⚠️ Tương tự |
| Đổi ý / không còn nhu cầu (hàng còn nguyên, chưa dùng) | ✅ Không tính | ✅ Không tính |
| Rộng/chật, không vừa (size/fit tự chọn sai) | ✅ Không tính | Thường rơi vào nhóm "đổi ý" ở trên |

→ **Quy tắc dùng:** case nào `shop_error_kind` ở mục 4.1 ra `giao_nham` /
`giao_thieu` / `san_pham_loi` (= dòng có ⚠️ trong bảng) → **đây là case cần mời
khách đổi lý do hiển thị trên sàn**. Case `shop_error_kind = null` (đổi ý, tự
chọn sai size...) → sàn vốn đã không tính lỗi shop, mời cũng không có lợi gì,
bỏ qua.

## Tên lý do CHÍNH XÁC để mời khách đổi qua (khác tên theo từng sàn — đừng nhầm)

- **TikTok Shop:** lý do "**Đổi ý**" (tiếng Anh: "Change of Mind"). Chỉ áp dụng
  được với sản phẩm có gắn nhãn "Change of Mind" trên trang chi tiết sản phẩm —
  không phải mọi đơn đều có lựa chọn này, khách có thể báo không thấy tuỳ chọn.
- **Shopee:** lý do "**Hàng nguyên vẹn nhưng không còn nhu cầu**". Từ
  19/6/2025 Shopee giới hạn lý do này — theo cập nhật 24/11/2025, chỉ áp dụng
  cho khách có hạng thành viên **Kim Cương/Vàng (Diamond/Gold)** hoặc đang dùng
  **ShopeeVIP**; khách thường có thể không thấy lựa chọn này. **Shop
  sometime_official KHÔNG phải Shopee Mall** (xác nhận với chủ shop 30/10/2026)
  — không ảnh hưởng tới điều kiện trên (điều kiện nằm ở hạng thành viên khách,
  không phải loại shop), nhưng cũng không đổi fact là không phải khách nào cũng
  đổi được.

## Hạn chế cần biết (nói rõ với chủ shop, đừng để kỳ vọng sai)

1. **Đổi lý do không chắc giúp khỏi mất phí ship hoàn.** Theo TikTok University:
   shop không phải Mall/Star Shop vẫn **chịu 100% phí ship hoàn** cho case
   "Change of Mind" — lợi ích chính là **không bị tính vào SFRR/NFR** (chỉ số
   hiệu suất/xếp hạng shop), không phải tiết kiệm tiền ship. Shopee tương tự
   (shop vẫn trả phí ship hoàn tối đa 40k/đơn trong hầu hết trường hợp).
2. **Không phải khách nào cũng đổi được** — tuỳ sản phẩm (TikTok, cần nhãn COM)
   hoặc tuỳ hạng thành viên (Shopee, cần Diamond/Gold/VIP). Nhắn mời là làm hết
   sức, khách báo không có lựa chọn thì ghi nhận và bỏ qua, không ép.
3. Thông tin trong file này tra từ chính sách công khai (bài đăng chính thức +
   seller university), **không phải mở thật Seller Center để xác minh từng
   dòng** — chính sách 2 sàn hay đổi, nếu thấy case thực tế không khớp bảng
   trên (ví dụ lý do mới, hoặc chỉ số tính khác) thì báo chủ shop để cập nhật
   lại file này, đừng tự sửa theo đoán.

## Nguồn

- TikTok Shop University — chính sách hủy đơn/trả hàng/hoàn tiền
  (`seller-vn.tiktok.com/university/essay?knowledge_id=6837773789234946`),
  và các bài tổng hợp lý do trả hàng/SFRR (BigSeller blog).
- Shopee Trung tâm Trợ giúp Người bán — "CHÍNH SÁCH TRẢ HÀNG VÀ HOÀN TIỀN"
  (`help.shopee.vn/portal/4/article/77251`), và tin chính thức Shopee về thay
  đổi chính sách "Hàng nguyên vẹn nhưng không còn nhu cầu" (6/2025, cập nhật
  11/2025) đăng lại trên Kenh14/CafeF/ZNews.
