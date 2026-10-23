# Đặc tả tư vấn size — Shop SOME A TIME (đồ ngủ)

Tài liệu cho đội code xây tính năng gợi ý size (chatbot / tool CSKH / rule engine). Nguồn: bảng size công khai trên sàn (2 ảnh kèm theo), tài liệu đào tạo CSKH nội bộ và bộ quiz tư vấn size đã được chủ shop chốt.

Phiên bản: 13/10/2026. Người chốt nghiệp vụ: Nguyễn Thế Minh (chủ shop).

---

## 0. Tóm tắt 30 giây

- Đầu vào tối thiểu: **chiều cao**. Đầu vào thêm: cân nặng, giới tính, mốc dài quần khách thích (mắt cá / chạm gót / quét đất), nhóm sản phẩm.
- Đầu ra: **đúng 1 size** + dài quần (cm) + mốc dài + cảnh báo (nếu có) + câu trả lời mẫu.
- Size cơ sở lấy theo **bảng chiều cao** (mốc mặc định = chạm gót). Sau đó điều chỉnh theo mốc dài khách thích (±1 size), rồi xét lệch cân nặng. Cuối cùng kẹp vào dải size nhóm sản phẩm có.
- Không bao giờ bịa size, không từ chối bán: hết size để lên/xuống thì giữ size biên và **nói thẳng** quần sẽ dài/ngắn hơn ý khách.
- Bảng dùng chung nam & nữ. Giới tính chỉ dùng cho ngưỡng "thừa cân".

---

## 1. Nhóm sản phẩm và dải size có hàng

| Nhóm | Mã nhóm | Tên trên sàn (ví dụ) | Dải size có hàng | Bảng đo áp dụng |
|---|---|---|---|---|
| Quần lông (Quần Hoạt Hình) | `CL` | Chất Lông-Shin, Chất Lông-Hello Kitty, … | **S–3XL** (riêng Chất Lông-Shin); hầu hết mã khác **M–XL**; Shin 02 / Shin 03 / Patrick Star **M–2XL** | Bảng A |
| Quần caro (Quần Kẻ Caro) | `CR` | Đỏ 03, Đen 02, Đỏ 04, Xanh Lá 03, Đỏ 03 Cao Cấp (Noel), Xanh Lá 02, Chất Dạ Đen/Đỏ Cao Cấp, Đỏ 02, Đỏ 05, Xanh Lá 05 | **M–2XL** (không có S, không có 3XL) | Bảng B |
| Quần thun | `CT` | Chất Thun-Màu 01…07, Chất Thun-Shin 01/02/04 | **M–XL** | Bảng A (xem mục 8 — cần xác nhận) |
| Bộ dài / Bộ ngắn | `PJD` / `PJC` | Bộ Dài-Shin 01/02/03, Bộ Ngắn-Shin 01/02/03 | **M–XL** | Bảng A (xem mục 8) |
| Quần short | `QS` | Quần Short-Shin 01/02/04 | **M–XL** | Bảng A (xem mục 8) |
| Combo | `CB` | Caro Hồng-M + Caro Xanh-L, Dài + Short : Shin 01 - M … | size cố định theo tên combo | Tư vấn từng SKU con rồi chọn combo có đúng cặp size |

Ghi chú:
- `2XL` và `XXL` là **một size** (sàn/Sapo ghi lẫn hai cách). Chuẩn hoá nội bộ về `XXL`.
- Dải size có hàng theo từng SKU lấy từ sheet **Sku / Sheet8** (cột *Size*) — nên đọc động từ sheet thay vì viết cứng, vì shop thêm mã mới thường xuyên.

---

## 2. Bảng A — Quần Hoạt Hình (quần lông, và các nhóm dùng chung)

### 2.1 Bảng công khai trên sàn (khách nhìn thấy)

| Size | Chiều cao | Cân nặng | Dài quần | Đùi | Mông | Ống quần |
|---|---|---|---|---|---|---|
| S | 1m40–1m55 | dưới 55kg | 92 | 62 | 100 | 44 |
| M | 1m45–1m65 | dưới 65kg | 95 | 65 | 104 | 46 |
| L | 1m55–1m75 | dưới 70kg | 97 | 68 | 108 | 48 |
| XL | 1m60–1m80 | dưới 80kg | 99 | 71 | 112 | 50 |
| XXL (2XL) | 1m70–1m90 | dưới 90kg | 102 | 74 | 116 | 52 |
| 3XL | 1m75–1m95 | dưới 100kg | 105 | 77 | 120 | 54 |

(Đơn vị cm. Các khoảng chiều cao trên ảnh **chồng lên nhau** — chỉ để khách tham khảo, **không dùng để ra quyết định**.)

### 2.2 Bảng quyết định theo chiều cao (dùng trong code — không chồng khoảng)

Mốc mặc định: **chạm gót**.

| Size | Chiều cao (cm) | Dài quần |
|---|---|---|
| S | ≤ 152 | 92 |
| M | 153–161 | 95 |
| L | 162–174 | 97 |
| XL | 175–179 | 99 |
| XXL | 180–185 | 102 |
| 3XL | 186–191 | 105 |

- Trên 191cm: 3XL + cảnh báo quần sẽ ngắn hơn chạm gót.
- Dưới 140cm: S + cảnh báo quần sẽ dài hơn (khuyên xắn/cắt gấu).

### 2.3 Bảng cân nặng (chỉ dùng khi khách THỪA CÂN — xem mục 4)

| Size | Cân nặng |
|---|---|
| M | < 65kg |
| L | < 70kg |
| XL | < 80kg |
| XXL | < 90kg |
| 3XL | < 100kg |

- ≥ 100kg: 3XL + cảnh báo có thể chật.
- S không nằm trong bảng cân nặng (người thừa cân không bao giờ về S).

---

## 3. Bảng B — Quần Kẻ Caro

### 3.1 Bảng công khai trên sàn

| Size | Chiều cao | Cân nặng | Dài quần | Bụng | Đùi | Mông | Ống quần |
|---|---|---|---|---|---|---|---|
| M | 1m45–1m60 | dưới 60kg | 94 | 96 | 62 | 112 | 23 |
| L | 1m60–1m70 | dưới 70kg | 97 | 98 | 65 | 116 | 24 |
| XL | 1m65–1m77 | dưới 77kg | 100 | 103 | 68 | 118 | 24 |
| XXL (2XL) | 1m70–1m85 | dưới 85kg | 104 | 110 | 71 | 122 | 26 |

Lưu ý in trên bảng công khai:
- Độ co giãn tăng dần theo chất: **Cotton thường < Cotton mềm < Chất dạ cao cấp**.
- Shop khuyến khích **tăng 1 size với phân loại Cotton thường (Đỏ 03, Đỏ 04, Đen 02)**.

### 3.2 Bảng quyết định theo chiều cao (dùng trong code)

Dùng **cùng ngưỡng chiều cao với Bảng A (mục 2.2)** rồi kẹp vào dải M–XXL:

| Size theo chiều cao (Bảng A) | Size caro | Dài quần caro |
|---|---|---|
| S (≤152) | **M** (size nhỏ nhất) | 94 |
| M (153–161) | M | 94 |
| L (162–174) | L | 97 |
| XL (175–179) | XL | 100 |
| XXL (180–185) | XXL | 104 |
| 3XL (≥186) | **XXL** + cảnh báo quần ngắn hơn bình thường | 104 |

### 3.3 Bảng cân nặng caro (khi THỪA CÂN)

| Size | Cân nặng |
|---|---|
| M | < 60kg |
| L | < 70kg |
| XL | < 77kg |
| XXL | < 85kg |

- ≥ 85kg: XXL + cảnh báo có thể chật (caro không có 3XL).

---

## 4. Thuật toán chọn size

```
INPUT:
  height_cm        (bắt buộc; nếu thiếu -> xem mục 6)
  weight_kg        (tuỳ chọn)
  gender           ("nam" | "nu" | null)
  length_pref      ("mat_ca" | "cham_got" | "quet_dat" | null)   # mặc định "cham_got"
  product_group    ("CL" | "CR" | "CT" | "PJD" | "PJC" | "QS")
  sku              (tuỳ chọn, để lấy dải size thực tế từ sheet Sku)

SIZE_ORDER = [S, M, L, XL, XXL, 3XL]

B1. size_base = tra bảng chiều cao (mục 2.2) theo height_cm
    flags: height_out_of_range nếu <140 hoặc >191

B2. Xét cân nặng (chỉ khi có weight_kg):
    std = height_cm - 100                         # cân chuẩn
    diff = weight_kg - std
    over_threshold = 10 nếu gender == "nam", 7 nếu "nu", 10 nếu null (coi như nam — an toàn hơn vì ít đổi size)
    if diff >= over_threshold:                    # THỪA CÂN
        size_base = tra bảng cân nặng (mục 2.3, hoặc 3.3 nếu caro)
        flags += "overweight_longer"              # báo quần sẽ DÀI hơn bình thường
        # Với thừa cân, mốc mặc định vẫn là chạm gót nhưng thực tế sẽ dài hơn
    elif diff <= -20:                             # GẦY
        # GIỮ size theo chiều cao để quần đủ dài
        flags += "underweight_loose"              # báo form sẽ rộng; khách muốn gọn mới xuống 1 size
    # Thừa chưa tới ngưỡng, hoặc gầy chưa tới 20kg: không đổi gì

B3. Xét mốc dài khách thích (length_pref):
    "cham_got" / null : giữ nguyên
    "mat_ca"          : size = size - 1 bậc
    "quet_dat"        : size = size + 1 bậc
    (Áp dụng cả khi đã chuyển sang bảng cân nặng ở B2.)

B4. Kẹp vào dải size nhóm sản phẩm / SKU:
    available = dải size của SKU (từ sheet Sku), nếu không có SKU thì dải của nhóm (mục 1)
    if size < min(available): size = min(available); flags += "clamped_min"   # báo quần sẽ DÀI hơn ý khách
    if size > max(available): size = max(available); flags += "clamped_max"   # báo quần sẽ NGẮN hơn ý khách

B5. Dài quần = tra theo nhóm (Bảng A hoặc Bảng B) với size cuối cùng.
    Mốc hiển thị = length_pref (hoặc "chạm gót" nếu không có), kèm điều chỉnh nếu bị kẹp.

OUTPUT: { size, length_cm, landmark, flags[], message }
```

Quy tắc bất biến:
1. **Luôn trả đúng 1 size.** Không trả "M hoặc L".
2. **Không từ chối bán, không bịa size** ngoài dải có hàng.
3. Bị kẹp ở size biên thì **nói thẳng** hướng lệch (dài hơn / ngắn hơn) trong cùng câu trả lời.
4. Nam nữ dùng chung bảng; giới tính chỉ đổi **ngưỡng thừa cân** (nam ≥10kg, nữ ≥7kg).
5. Thừa cân → theo bảng cân nặng **và** báo quần dài hơn bình thường. Gầy → **giữ** size chiều cao, báo form rộng.

---

## 5. Câu trả lời mẫu (template)

Cấu trúc bắt buộc: **1 size + dài quần + mốc**, rồi hỏi/chốt mốc dài khách thích.

| Tình huống | Mẫu |
|---|---|
| Bình thường | "Dạ bạn mặc **size {size}** là ok nhé ạ, dài quần **{length}cm**, quần dài tới tầm **{landmark}** á. Bạn thích quần dài tới mắt cá, chạm gót hay quét đất để mình chốt size chuẩn nhất ạ?" |
| Đã có mốc khách thích | "Dạ bạn thích {landmark} thì lấy **size {size}** nhé ạ, dài quần {length}cm là vừa đẹp." |
| Thừa cân (`overweight_longer`) | "Dạ với cân nặng của bạn mình tư vấn **size {size}** cho thoải mái ạ, dài quần {length}cm, quần sẽ hơi dài hơn chạm gót một chút." |
| Gầy (`underweight_loose`) | "Dạ bạn lấy **size {size}** để quần đủ dài tới chạm gót ạ, dài quần {length}cm, form sẽ hơi rộng một chút." |
| Kẹp size nhỏ nhất (`clamped_min`) | "Dạ size nhỏ nhất của mẫu này là **{size}** ({length}cm) ạ, quần sẽ dài hơn mốc {landmark} một chút, bạn xắn gấu nhẹ là xinh nhé." |
| Kẹp size lớn nhất (`clamped_max`) | "Dạ mẫu này lớn nhất là **size {size}** ({length}cm) ạ, với chiều cao của bạn quần sẽ ngắn hơn {landmark} một chút, mình báo trước để bạn cân nhắc nhé." |
| Caro – Cotton thường | thêm: "Mẫu {tên} là cotton thường ít co giãn, shop khuyên bạn lên 1 size cho thoải mái ạ." (xem mục 8) |
| Không có card sản phẩm, khách không nói rõ mẫu (chốt 23/10/2026) | Tư vấn theo **quần lông** (Bảng A), gửi câu size theo đúng tình huống rồi nối thêm: "Mình đang tư vấn theo quần lông ạ, nếu bạn cần tư vấn mẫu quần khác thì báo mình nha." — KHÔNG hỏi lại "có phải quần lông không" (quy tắc 22/10 đã bỏ). |
| Thiếu chiều cao | "Dạ bạn cho mình xin **chiều cao và cân nặng** để mình tư vấn size chuẩn nhé ạ. Thường các bạn 1m55–1m60 mặc M, 1m62–1m74 mặc L ạ." |
| Thiếu cân nặng | Tư vấn theo chiều cao ngay + xin thêm cân nặng trong cùng tin: "Dạ 1m70 bạn mặc **size L** (97cm, chạm gót) nhé ạ. Bạn cho mình xin thêm cân nặng để mình chắc chắn hơn ạ." |

Giọng: thân thiện, có "dạ/ạ/nhé", **không** liệt kê nhiều size, **không** đẩy việc chọn về khách.

---

## 6. Xử lý thiếu dữ liệu

| Có gì | Làm gì |
|---|---|
| Chỉ chiều cao | Tư vấn theo bảng chiều cao, mốc chạm gót; xin cân nặng và hỏi mốc dài trong cùng tin. |
| Chỉ cân nặng | Tạm theo bảng cân nặng, **bắt buộc** xin chiều cao trước khi chốt (sai chiều cao = sai dài quần = lý do trả hàng số 1). |
| Chỉ mốc dài | Xin chiều cao. |
| Chiều cao dạng "1m6", "160", "1,6m", "mét sáu" | Chuẩn hoá về cm (160). Chấp nhận 140–200; ngoài khoảng hỏi lại. |
| Cân nặng dạng "5 chục", "60 cân" | Chuẩn hoá về kg. |
| Khách hỏi cho người khác ("mua cho mẹ") | Hỏi chiều cao/cân của người mặc, không của người mua. |
| Khách đưa size thường mặc của hãng khác | Không quy đổi; vẫn xin chiều cao (quần ống rộng, size theo dài quần). |

---

## 7. Bộ test case (đã chốt với chủ shop — dùng làm unit test)

Nhóm mặc định là quần lông (Bảng A) trừ khi ghi "caro".

| # | Đầu vào | Kỳ vọng | Lý do |
|---|---|---|---|
| 1 | Nữ 1m56, 50kg, chạm gót | **M**, 95cm | 153–161 → M; cân lệch ít |
| 2 | Nam 1m70, 65kg, chạm gót | **L**, 97cm | 162–174 → L |
| 3 | Nam 1m75, 65kg, chạm gót | **XL**, 99cm | 175–179 → XL; gầy 10kg chưa tới ngưỡng 20 |
| 4 | Nam 1m68, 62kg, mắt cá | **M**, 95cm | L mặc định → xuống 1 |
| 5 | Nam 1m68, 62kg, quét đất | **XL**, 99cm | L mặc định → lên 1 |
| 6 | Nữ 1m60, 50kg, quét đất | **L**, 97cm | M mặc định → lên 1; nam nữ như nhau |
| 7 | Khách đã chốt L quần lông, hỏi "dài bao nhiêu, tới đâu" | 97cm, tới tầm chạm gót | |
| 8 | Nam 1m88, 80kg, quét đất | **3XL**, 105cm + `clamped_max` | 3XL là lớn nhất; nói thẳng quần ngắn hơn ý khách |
| 9 | Khách 1m50, mắt cá | **S**, 92cm + `clamped_min` | S nhỏ nhất; báo dài hơn mắt cá một chút |
| 10 | Nam 1m80, 95kg (chuẩn 80, thừa 15) | **3XL**, 105cm + `overweight_longer` | Bảng cân nặng: 95 < 100 → 3XL; báo dài hơn |
| 11 | Nữ 1m60, 68kg (chuẩn 60, thừa 8) | **L**, 97cm + `overweight_longer` | Nữ ngưỡng 7 → bảng cân: 68 < 70 → L |
| 12 | Nam 1m70, 79kg (chuẩn 70, thừa 9) | **L**, 97cm | Nam ngưỡng 10 → chưa thừa → theo chiều cao |
| 13 | Nữ 1m70, 45kg (gầy 25) | **L**, 97cm + `underweight_loose` | Giữ size chiều cao; gợi ý M nếu muốn gọn |
| 14 | Caro, nữ 1m50, 45kg, chạm gót | **M**, 94cm + `clamped_min` | Caro không có S |
| 15 | Caro, nam 1m78, 68kg, chạm gót | **XL**, 100cm | 175–179 → XL caro 100cm |
| 16 | Caro, nam 1m88, 78kg, chạm gót | **XXL**, 104cm + `clamped_max` | Caro tối đa XXL; báo ngắn hơn bình thường |

Bổ sung nên test:
| 17 | Nam 1m75, 85kg (chuẩn 75, thừa 10 = đúng ngưỡng), mắt cá | Bảng cân: 85 < 90 → XXL; mắt cá −1 → **XL**, 99cm + `overweight_longer` | Kiểm tra thứ tự B2 rồi B3 |
| 18 | Chất Lông-Hello Kitty (dải M–XL), nam 1m83, 75kg | XXL theo chiều cao → kẹp **XL**, 99cm + `clamped_max` | Dải size theo SKU |
| 19 | Chiều cao "1m6", không cân | **M**, 95cm + xin cân nặng | Parse + thiếu dữ liệu |
| 20 | Chỉ có "60kg" | Tạm M (<65) + bắt buộc xin chiều cao | |

---

## 8. Điểm chưa chốt — cần chủ shop xác nhận trước khi code cứng

1. ✅ **ĐÃ CHỐT 22/10/2026: dùng thẳng Bảng A** (Hoạt Hình) cho Quần thun (CT), Bộ dài/ngắn (PJD/PJC), Quần short (QS) — không còn là "tạm". Kẹp M–XL, dài quần lấy theo Bảng A (short bỏ qua dài quần).
2. ✅ **ĐÃ CHỐT 15/10/2026: KHÔNG lên size** cho cotton thường, tư vấn như caro thường. (Nội dung cũ: **Caro – Cotton thường (Đỏ 03, Đỏ 04, Đen 02) "+1 size"**: bảng công khai khuyên vậy, nhưng tài liệu CSKH nội bộ chưa quy định. Đề xuất: cộng 1 bậc ở **B1** (trước khi xét mốc dài), kẹp tối đa XXL, và nói rõ lý do với khách. *Cần anh chốt có áp dụng không và áp dụng trước hay sau mốc dài.*
3. ✅ **ĐÃ CHỐT 22/10/2026: dùng ngưỡng cân nặng caro riêng** (mục 3.3: M<60, L<70, XL<77, XXL<85), KHÔNG dùng chung bảng cân nặng quần lông.
4. ✅ **ĐÃ CHỐT 22/10/2026: giới tính không rõ → dùng ngưỡng nam (10kg)** làm mặc định.
5. ⚠️ **Combo — PHẢI TRA THẬT TRƯỚC (chốt 22/10/2026):** chủ shop đã làm combo **gần đủ 95%**, nên **không được vội kết luận "không có combo đúng cặp size"**. Thứ tự bắt buộc: (a) tra trực tiếp biến thể combo thật trên Sapo/sàn xem có đúng cặp size khách cần không — gần như luôn có; (b) chỉ khi tra thật và xác nhận KHÔNG có mới tư vấn khách mua lẻ 2 quần (giá lẻ). Cách xử lý ở bước (b) vẫn có thể đổi nếu chủ shop muốn khác.

---

## 9. File cấu hình (để load thay vì viết cứng)

Xem `size-rules.json` kèm theo — gồm: thứ tự size, bảng chiều cao, bảng cân nặng (A và B), dài quần theo nhóm, dải size theo nhóm, ngưỡng thừa/gầy, ánh xạ 2XL↔XXL, danh sách SKU cotton thường, và 20 test case ở mục 7. Dải size theo **từng SKU** nên đọc từ Google Sheet "Sku" (tab Sheet8, cột E = SKU, cột I = Size) hoặc từ API Sapo.

## 10. Tệp kèm theo

- `bang-size-hoat-hinh.jpg` — bảng size công khai Quần Hoạt Hình (quần lông).
- `bang-size-caro.jpg` — bảng size công khai Quần Kẻ Caro.
- `size-rules.json` — cấu hình máy đọc được.
