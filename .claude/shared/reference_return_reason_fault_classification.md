---
Chốt 30/10/2026, cập nhật 12/11/2026 — tra từ chính sách công khai của TikTok
Shop University và Shopee Trung tâm Trợ giúp Người bán. Dùng chung cho mọi skill
cần phân loại "case trả hàng này có tính lỗi shop không" (hiện tại: review-return-check).
---

# Lý do trả hàng nào tính là lỗi shop (từng sàn)

## Vì sao cần file này

`shop_error_kind` (xem [review-return-check/SKILL.md](../skills/review-return-check/SKILL.md)
mục 4.1) đã phân loại lỗi shop theo **nội dung thật** (đọc chat/mô tả, không đoán).
File này bổ sung thêm: lý do nào **sàn tự tính vào chỉ số lỗi/hiệu suất shop**
(SFRR của TikTok, NFR của Shopee) — dùng để quyết định có cần nhắn khách mời đổi
lý do hiển thị trên sàn hay không.

**Hai việc tách biệt, đừng nhầm:**
- `shop_error_kind` = lỗi gì **thật**, dùng để ghi Sổ Kho + insight nội bộ. KHÔNG đổi.
- Lý do hiển thị **trên sàn** = cái ảnh hưởng chỉ số, có thể mời khách đổi nếu
  khách đồng ý — không ảnh hưởng tới việc ghi nhận nội bộ phía trên.

## Cách nhận diện nhanh theo từng sàn (chốt 12/11/2026)

**TikTok Shop — dùng badge (nhanh hơn, không cần tra bảng):**
Mỗi thẻ trả hàng trên tab "Đang chờ bạn" hiển thị badge trực tiếp:
- Có badge **"Không phải lỗi người bán"** (checkmark xanh lá) → không phải lỗi shop → gửi 1 tin (row 25).
- Không có badge đó → lỗi shop → gửi 2 tin (row 35 + row 25).

Khi `get_page_text` trang trả hàng TikTok: kiểm tra mỗi thẻ có chứa chuỗi
`"Không phải lỗi người bán"` không — đơn giản, không cần tra bảng.

**Shopee — đọc tên lý do, tra bảng bên dưới:**
Shopee không có badge tương đương → phải đọc text lý do rồi đối chiếu bảng.

## Bảng lý do chính xác từng sàn (dùng cho Shopee, tham khảo cho TikTok)

### TikTok Shop

| Tên lý do hiển thị trên sàn | Lỗi shop (SFRR)? |
|---|---|
| Sản phẩm bị lỗi/không hoạt động | ⚠️ Có |
| Hàng không đúng mô tả | ⚠️ Có |
| Nhận sai hàng | ⚠️ Có |
| Nhận thiếu hàng/phụ kiện | ⚠️ Có |
| Hàng bị hỏng/vỡ trong vận chuyển | ⚠️ Có |
| Nghi hàng giả/không chính hãng | ⚠️ Có |
| Đổi ý | ✅ Không |
| Size quá rộng/chật | ✅ Không |
| Đặt nhầm size | ✅ Không |

### Shopee

| Tên lý do hiển thị trên sàn | Lỗi shop (NFR)? |
|---|---|
| Hàng bị lỗi, vỡ, hư hại trong quá trình vận chuyển | ⚠️ Có |
| Hàng giao sai, khác mô tả | ⚠️ Có |
| Nhận thiếu hàng | ⚠️ Có |
| Hàng nguyên vẹn nhưng không còn nhu cầu | ✅ Không |

→ **Quy tắc:** dòng ⚠️ → lỗi shop → gửi 2 tin (row 36 + row 25).
Dòng ✅ → không phải lỗi shop → gửi 1 tin (row 25).

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
