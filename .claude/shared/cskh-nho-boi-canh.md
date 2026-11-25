# NHỚ BỐI CẢNH giữa các lượt CSKH — bắt buộc TRƯỚC KHI GÕ TIN cho khách đã có đơn (chốt 25/11/2026)

**Vì sao có file này.** Lượt CSKH chạy 15 phút/lần, mỗi lượt là một phiên mới: **không nhớ gì của lượt trước**. Trí nhớ duy
nhất là (1) Sổ Vận Hành (`cskh_chat_errors.progress_note`, `resend_cases.owner_note`) và (2) chính khung chat. Trước 25/11
lượt CSKH chỉ GHI sổ chứ không ĐỌC lại sổ, và đọc chat bằng chữ nên không thấy ảnh.

**Sự cố thật — khách `_dt.54` (TikTok, 24/11/2026), chủ shop phát hiện 25/11:**
- 09:53 khách báo "đặt size XL mà giao size L" → lượt 10:10 mở đúng phiếu `giao_nham`.
- Khách **đã gửi ảnh**, nhưng các lượt sau đọc chat bằng `get_page_text` (không hiện ảnh) nên ghi "chưa có ảnh" và **xin ảnh 3 lần**.
- 17:23 một lượt mới chỉ đọc mấy tin cuối ("vẫn mẫu đấy e chỉ cần đổi sang size XL thôi"), **không tra phiếu cũ**, mở phiếu thứ 2
  `doi_size` và gửi bộ tin của khách tự đổi size: khuyên "cố mặc giúp shop", hỏi "chọn theo bảng size hay đặt nhầm size".
- Kết quả: lỗi của shop mà không xin lỗi, không gửi câu "đổi hàng miễn phí + mã giảm", không gửi mã 10k; khách bực, đòi hoàn hàng.

Chủ shop: "các lượt sau không nhớ bối cảnh của lượt trước và không đọc lại nội dung tin nhắn — tìm cách khắc phục ngay".

---

## 4 việc phải làm, đúng thứ tự, trước khi gõ bất kỳ tin nào cho khách đã có đơn / đang nói về đơn

Áp dụng cho mọi hội thoại hậu mãi (giao thiếu, giao nhầm, hàng lỗi, đổi size, trả hàng, hoàn tiền) và mọi hội thoại mà khách
đã từng có phiếu trên sổ. Tư vấn size trước khi mua thì chỉ cần việc 2 (đọc hết chat).

### Việc 1 — TRA SỔ theo tên khách (1 lệnh curl, không tốn trình duyệt)

```
cskh_chat_errors?select=id,dedup_key,order_code,case_type,has_photo,progress_note,needs_action,acked_at,created_at&platform=eq.<sàn>&customer=eq.<handle>&order=created_at.desc&limit=5
resend_cases?select=id,status,orig_order_code,item_summary,owner_note&platform=eq.<sàn>&handle=eq.<handle>&status=neq.cancelled
```

Có phiếu trong 15 ngày gần đây → **đọc hết `progress_note`** (đó là lời kể của các lượt trước) rồi mới đọc chat. Từ phiếu phải
trả lời được: case loại gì, đã gửi những tin nào, đang chờ ai, khách đã gửi ảnh chưa.

### Việc 2 — ĐỌC LẠI CẢ ĐOẠN CHAT, có CHỤP MÀN HÌNH để thấy ảnh

- Cuộn lên tới **tin đầu tiên khách nói về đơn/vấn đề này** (không chỉ màn hình cuối; mốc dừng ở mục "Đọc lại TỚI ĐÂU" bên dưới), đọc chữ bằng `get_page_text`.
- `get_page_text` **KHÔNG hiện ảnh / video / thẻ đơn hàng**. Vì vậy bắt buộc **chụp màn hình** đoạn chat đó (cuộn + chụp tới
  khi phủ hết từ tin báo lỗi đầu tiên đến tin cuối). Thấy bong bóng ảnh/video của khách → `has_photo=true`, coi như đã có bằng chứng.
- Đếm luôn: shop đã gửi những tin mẫu nào rồi (xin ảnh mấy lần, đã xin lỗi chưa, đã hướng dẫn đổi chưa, đã có thẻ voucher chưa).

#### Đọc lại TỚI ĐÂU — theo VỤ VIỆC, không phải cả lịch sử (chủ shop hỏi lại 25/11/2026)

"Đọc lại cả đoạn chat" = đọc hết **vụ việc đang mở**, KHÔNG phải mọi tin từ trước tới giờ. Khách nhắn shop từ năm ngoái thì
không đọc lại năm ngoái. Dừng cuộn ở mốc nào tới TRƯỚC:
1. **Ngày đặt của đơn đang được nói tới** (xem tab Đơn hàng bên phải khung chat) — tin trước ngày đó không liên quan đơn này.
2. **Chỗ vụ trước đã đóng**: sticker / "Dạ vâng ạ" đóng hội thoại, hoặc phiếu cũ trên sổ có dòng cuối `[xong]`.
3. **Trần cứng 30 ngày.** Hậu mãi chỉ hỗ trợ 15 ngày từ ngày "Đã giao", nên tin cũ hơn 30 ngày không bao giờ cần đọc.

Tư vấn size trước khi mua: chỉ đọc từ lúc khách bắt đầu hỏi lần này (thường trong ngày), không cần lùi xa hơn.

#### Khách có NHIỀU ĐƠN — mỗi đơn là một vụ riêng (chủ shop hỏi lại 25/11/2026)

Vd: đơn tháng trước lỗi sản phẩm (đã xử lý xong), tháng này đơn mới bị kho giao nhầm → **2 vụ độc lập, 2 phiếu, 2 loại case**.
- Tra sổ ra nhiều phiếu thì **ghép phiếu theo mã đơn** (`order_code` / `orig_order_code`), không ghép theo tên khách đơn thuần.
- Xác định khách đang nói về ĐƠN NÀO trước: thẻ đơn hàng khách gửi trong chat → mẫu/size khách nhắc → đơn vừa "Đã giao" gần
  nhất trong tab Đơn hàng. Vẫn không rõ giữa 2 đơn → hỏi 1 câu, không đoán: "Dạ bạn đang nói về đơn nào ạ, bạn gửi giúp shop
  ảnh đơn hàng đó nhé ạ." *(Claude soạn 25/11/2026, chủ shop sửa nếu cần)*
- Phiếu của **đơn khác** chỉ để biết lịch sử, **không quyết định loại case của đơn này**: đơn cũ là hàng lỗi không làm đơn mới
  thành hàng lỗi, và ngược lại. Quy tắc "không hạ lỗi shop xuống đổi size" ở Việc 3 chỉ áp dụng **trong cùng 1 đơn**.
- Đơn mới chưa có phiếu → mở phiếu MỚI cho mã đơn đó, chạy luồng của nó từ tin đầu (lời xin lỗi theo đúng loại lỗi của đơn này:
  hàng lỗi = "chưa kiểm tra kĩ", giao nhầm/thiếu = "bạn ở kho mới vào làm"). Lỗi shop lần 2 vẫn gửi mã 10k (chốt 22/11/2026).
- **Phiếu nào cũng phải có `order_code`.** Phiếu cũ để trống mã đơn (như phiếu giao nhầm của `_dt.54`) → bổ sung mã ngay khi gặp
  lại; phiếu trống mã trong 15 ngày gần đây thì coi là cùng vụ, trừ khi rõ ràng khách đang nói về đơn khác.

### Việc 3 — CHỐT LOẠI CASE theo cả đoạn chat + phiếu, không theo tin cuối

- Khách nói **nhận khác với đơn đặt** ("đặt XL mà giao L", "giao sai mẫu/màu", "không đúng cái em đặt") = **GIAO NHẦM (lỗi shop)**,
  kể cả khi tin sau đó khách chỉ nói "em chỉ cần đổi sang size XL thôi". Muốn đổi về đúng size đã đặt **không phải** "đổi size".
- **ĐỔI SIZE (lỗi khách)** chỉ khi khách nhận ĐÚNG món đã đặt mà mặc rộng/chật/dài/ngắn.
- Phiếu cũ đã ghi `giao_nham` / `san_pham_loi` / `giao_thieu` → **không được hạ xuống `doi_size`**. Chỉ đổi loại theo chiều ngược
  lại (đổi size → lỗi shop) khi khách nói rõ, và ghi 1 dòng `▸` giải thích.
- Không chắc → mở tab Đơn hàng so phân loại đã đặt với món khách nói đã nhận. Vẫn không chắc → xử lý như **lỗi shop**
  (xin lỗi nhầm còn hơn đổ lỗi nhầm cho khách).
- **1 khách + 1 đơn = 1 phiếu hậu mãi đang mở.** Đã có phiếu mở thì nối `▸` vào phiếu đó, KHÔNG mở phiếu thứ 2 với `case_type`
  khác (dù `dedup_key` cho phép). Cần đổi loại thì PATCH `case_type` của chính phiếu đó.

### Việc 4 — CHỈ GỬI TIN CÒN THIẾU, và ghi lại đã gửi gì

- So các tin mẫu của case (file [hau-mai-mau-tin-moi-nhat.md](hau-mai-mau-tin-moi-nhat.md)) với những gì ĐÃ có trong chat → gửi
  tiếp từ tin còn thiếu, đúng thứ tự. Không gửi lại tin đã gửi, không nhảy sang bộ tin của case khác.
- **Tin xin ảnh/bằng chứng: tối đa 1 lần cho 1 case.** Chat đã có 1 tin xin ảnh của shop → KHÔNG xin lần 2. Trước khi gửi tin xin
  ảnh lần đầu cũng phải chụp màn hình (việc 2) để chắc khách chưa gửi. Khách nói không gửi được / đã bỏ vỏ đơn → không xin nữa,
  chạy tiếp luồng (khách đã mô tả rõ nhận sai) và ghi `▸ ... khách không còn ảnh` để chủ shop biết.
- **Cấm** gửi câu "chọn size theo bảng size của shop hay đặt nhầm size" và câu "cố mặc giúp shop" cho khách đã nói nhận sai
  so với đơn đặt.
- Sau khi gửi, dòng `▸` phải kèm **dòng kiểm đã gửi** để lượt sau đọc là biết còn thiếu gì, vd giao nhầm / hàng lỗi:
  `☑ anh=1 xinanh=0 xinloi=1 huongxuly=1 hddoi=1 voucher=0 baoma=0`
  (đổi size: `☑ sansang=1 hddoi=1 hoilydo=1`). Lượt sau thấy `voucher=0` thì gửi nốt thẻ 10k + tin báo mã, không làm lại từ đầu.
- Phiếu đang `[chờ anh]`: khách nhắn tin mới thì vẫn trả lời trong đúng luồng của phiếu đó; không đổi luồng, không hỏi lại
  điều khách đã trả lời.

## Tự kiểm 5 giây trước khi bấm Gửi

1. Mình đã tra sổ theo tên khách chưa? Phiếu ghi case gì?
2. Mình đã CHỤP MÀN HÌNH đoạn chat chưa (có ảnh khách gửi không)?
3. Tin sắp gửi có thuộc đúng luồng của phiếu không? Đã gửi tin này trước đó chưa?
4. Tin này có đổ lỗi cho khách trong khi lỗi là của shop không?

Sai 1 trong 4 → chưa gửi.
