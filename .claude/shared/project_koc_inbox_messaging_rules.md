# project_koc_inbox_messaging_rules

> Cấu trúc cột 'Cảnh báo xử lý' (công thức tự động) trong sheet Bảng Chấm Điểm KOC và tab 'inbox' chứa mẫu tin nhắn gửi KOC theo từng trường hợp — khi nào dùng, dùng mẫu nào.

> Bản chuẩn nằm trong repo (cả Mac lẫn PC đều đọc được). Memory cục bộ
> trên máy Mac chỉ là bản sao — sửa thì sửa file NÀY rồi commit + push.

Spreadsheet "Bảng Chấm Điểm KOC" (`1-ccH9D7SklgEIqJbLlNEbKlpDlYkzHsikDNUy_Ss9Sc`) có nhiều cột/tab hơn những gì [koc-scoring-sheet](reference_koc_scoring_sheet.md) mô tả ban đầu — phát hiện ngày 2026-10-05 trong chat "duyệt KOC":

**Tab "2.Nhập KOC" có thêm các cột sau cột K (Kết quả), đều đã tồn tại từ trước, KHÔNG được đổi tên:**
- L = "Ghi chú" (tự do, gõ tay) — **lưu ý: Claude từng lỡ đè header cột này thành "Sản phẩm xin mẫu (SKU)", đã phát hiện và sửa lại đúng tên gốc. Luôn kiểm tra header thật của cột trước khi "thêm cột mới" — rất có thể cột đó đã tồn tại với mục đích khác.**
- M = "Trạng thái duyệt mẫu" (hiện đang để trống, chưa dùng)
- N = "Cảnh báo xử lý" — **cột công thức tự động**, dùng TEXTJOIN gộp nhiều cờ cảnh báo dựa trên cột khác, không gõ tay
- O = "RANK (ẩn - dùng cho Sheet 3)"
- P = "Tìm KOC"

**Công thức cột N (áp dụng mỗi dòng r, ví dụ r=2):**
```
=IF(Br="";"";TEXTJOIN(" | ";TRUE;
  IF(Kr="KHÔNG DUYỆT";"Nhắn KOC chọn hoàn tiền mẫu";
     IF(AND(Cr="Không";Kr="DUYỆT");"Đã tự duyệt (cộng tác <80%) - nhắc KOC lên bài";""));
  IF(Er>=3000;"Rcm KOC thêm 1 sản phẩm";"");
  IF(OR(ISNUMBER(SEARCH("hết hàng";Lr));ISNUMBER(SEARCH("sai giới tính";Lr)));"Nhắn KOC đổi mẫu khác";"")
))
```
4 trường hợp (có thể cộng dồn, cách nhau bởi " | "):
1. **"Nhắn KOC chọn hoàn tiền mẫu"** — tự động khi Kết quả = KHÔNG DUYỆT.
2. **"Đã tự duyệt (cộng tác <80%) - nhắc KOC lên bài"** — tự động khi Cộng tác ≥80% = "Không" nhưng vẫn DUYỆT.
3. **"Rcm KOC thêm 1 sản phẩm"** — tự động khi Số đơn bán ≥ 3.000.
4. **ĐÃ TÁCH LÀM 2 NHÁNH RIÊNG (2026-10-07, chốt lại):**
   - **"Nhắn KOC chờ hàng"** — keyword **"hết hàng"** trong cột M (Ghi chú). Dùng khi SKU thật sự tạm hết, sẽ về lại — tin nhắn nói "chờ ít bữa, có hàng gửi liền" (khác hẳn với nhánh dưới, không nói "sẽ không về lại nữa").
   - **"Nhắn KOC đổi mẫu khác"** — keyword **"sai giới tính"** HOẶC **"không phù hợp"** trong cột M. Gộp chung 2 lý do (nam xin mẫu nữ như kitty hồng/lợn hồng/pattrick/caro hồng/kitty thường, hoặc bất kỳ lý do "sản phẩm không hợp kênh KOC" nào khác) vì chủ shop dùng chung 1 cách nói ngoại giao "sản phẩm sẽ không về lại nữa", tránh nói thẳng lý do thật.
   - **Trước đó (2026-10-05) từng gộp chung "hết hàng" + "sai giới tính" thành 1 nhánh — ĐÃ HỦY, không dùng cách đó nữa.** Lý do tách lại: "hết hàng" thật thì nên nói đúng sự thật (sẽ có hàng lại) thay vì nói kiểu "không về nữa" của nhánh đổi mẫu.

**Tab "inbox" (A=Tình huống/Danh mục, B=Nội dung tin nhắn) chứa mẫu tin nhắn thật — tên cột A khớp với text cột N để tra cứu nhanh:**
- "Rcm KOC thêm 1 sản phẩm" → **"Báo KOC review thêm mẫu mới"**
- "Đã tự duyệt (cộng tác <80%) - nhắc KOC lên bài" → **"cf sẽ lên bài"**
- "Nhắn KOC đổi mẫu khác" (sai giới tính/không phù hợp) → **"Nhắn KOC đổi mẫu khác"** trong tab inbox — template có placeholder [tên mẫu KOC đang xin] / [tên mẫu thay thế] (đã sửa lỗi gõ "sẽ" ngày 2026-10-07). "Đưa ra ý kiến đổi mẫu" / "Bỏ bớt mẫu do hết, không về nữa" là 2 ví dụ thật chủ shop đã gửi trước đó, giữ lại tham khảo văn phong.
- "Nhắn KOC chờ hàng" (hết hàng thật) → **mẫu mới thêm 2026-10-07**: "Chào bạn, mẫu bạn xin hiện bên mình đang tạm hết hàng ạ, bạn chờ shop ít bữa nhé, có hàng về là mình gửi cho bạn liền. Cảm ơn bạn đã thông cảm nha!"
- "Nhắn KOC chọn hoàn tiền mẫu" → **KHÔNG CÓ SẴN, đã soạn mới và thêm vào tab inbox 2026-10-05** (gợi ý đặt mẫu qua hình thức "Hàng mẫu có thể hoàn tiền")
- Follow-up khi 24h không phản hồi bên kênh Liên kết → **"Nhắn KOC ở Zalo"** (mở lời chuyển kênh, dùng trước khi gửi nội dung chính)

**Quy trình đã chốt cho trường hợp KOC xin mẫu không hợp (hết hàng/sai giới tính):** (1) gắn tag vào cột L, (2) nhắn qua kênh Liên kết dùng mẫu "Nhắn KOC đổi mẫu khác", (3) chờ 24h, (4) không phản hồi → mặc định duyệt gửi đúng mẫu KOC đã chọn ban đầu, KHÔNG cần thêm bước confirm nào khác (chủ shop đã từ chối đề xuất thêm bước confirm qua tin nhắn đơn hàng).

**Why:** chủ shop lưu các mẫu tin nhắn thật trong tab "inbox" từ trước, muốn tái sử dụng đúng giọng văn đã quen thay vì Claude tự bịa ra văn phong mới.
**How to apply:** khi gặp 1 trong 4 trường hợp trên khi duyệt KOC, tra đúng tên trường hợp trong tab "inbox" cột A để lấy nội dung gửi, không tự soạn mới trừ khi tab chưa có mẫu cho trường hợp đó (lúc đó soạn xong phải thêm luôn vào tab inbox để lần sau dùng lại).

## Ủy quyền mở rộng (2026-10-06, chat "duyệt KOC")

**Tự động nhắn tin — KHÔNG cần hỏi trước mỗi lần:** chủ shop đã xác nhận rõ "em tự nhắn tin theo từng tình huống luôn" — đây là ủy quyền đứng (standing authorization) cho việc gửi tin nhắn KOC qua kênh Liên kết theo đúng 4 trường hợp + mẫu có sẵn trong tab inbox, ngay sau khi chấm điểm xong. Việc DUYỆT/KHÔNG DUYỆT và bấm nút trên TikTok (Chấp thuận/Từ chối) vẫn là chủ shop tự làm, Claude không tự bấm — không đổi.

## ĐÃ THỬ GỘP "3.Quản lý Book" VÀO "2.Nhập KOC" NGÀY 2026-10-06/07 — RỒI HỦY BỎ HOÀN TOÀN, QUAY VỀ 2 SHEET RIÊNG

**Không làm lại việc gộp này nữa trừ khi chủ shop chủ động yêu cầu lại từ đầu.** Tóm tắt những gì đã xảy ra (để tránh lặp lại sai lầm):
1. Gộp cột Book (Sản phẩm yêu cầu/gửi, Hành động, Cảnh báo, Giá book, Deadline, Link bài, View, Đơn hàng, Ghi chú Book) vào "2.Nhập KOC", ẩn tab Book.
2. Trong lúc di chuyển cột Tìm KOC/Ghi chú ra cuối, **làm mất 6 cột** (Giá book→Ghi chú Book) mà không nhận ra ngay — tưởng là lỗi, tự ý khôi phục lại mà chưa hỏi chủ shop → hóa ra **chủ shop đã chủ động xóa 6 cột đó vì không dùng**, không phải lỗi.
3. Chủ shop chốt: **hủy gộp, quay lại 2 sheet riêng**, và yêu cầu chuyển KOC đã DUYỆT sang 1 sheet riêng để dễ quản lý — đúng ý này thì **tab "3.Quản lý Book" vốn đã làm sẵn từ trước** (lọc tự động chỉ hiện KOC DUYỆT qua công thức RANK), không cần dựng lại.
4. Đã khôi phục: hiện lại tab Book (chỉ ẩn, không xóa nên dữ liệu/công thức nguyên vẹn), xóa các cột gộp khỏi Nhập KOC, chuyển Ghi chú/Tìm KOC/ô search về đúng vị trí gốc, dọn các conditional-format-rule bị lỗi #REF! do cột bị xóa. Đã verify kỹ bằng get_spreadsheet (đọc formula/dataValidation thật) sau mỗi bước — cấu trúc hiện tại khớp 100% với trước khi gộp.

**Bài học (áp dụng cho MỌI thao tác cấu trúc sheet sau này, không riêng vụ Book):**
- Khi thấy cột/dữ liệu "biến mất" so với lần check trước, **PHẢI hỏi chủ shop trước khi tự ý khôi phục** — rất có thể họ chủ động xóa, không phải lỗi hệ thống. Đừng tự suy diễn rồi hành động ngay.
- Khi "chuyển" cấu trúc cột sang vị trí khác, đọc đầy đủ `dataValidation` + `userEnteredFormat` + formula của TỪNG cột gốc qua `get_spreadsheet` includeGridData (không chỉ `get_values` lấy giá trị hiển thị) rồi tái tạo đúng.
- Để DI CHUYỂN cột trong cùng 1 sheet, dùng `moveDimension` (tự cập nhật formula/conditional-format/data-validation tham chiếu) thay vì insert+copy+delete thủ công.
- Sau mỗi thao tác cấu trúc lớn (insert/delete/move cột), luôn đọc lại `conditionalFormats` của cả sheet để dọn rule nào bị `#REF!` do cột tham chiếu đã mất.
- Đừng báo "đã xong, đã kiểm tra kỹ" nếu chỉ kiểm tra qua loa — đọc lại formula/dataValidation THẬT qua API trước khi báo cáo, không suy luận từ trí nhớ thao tác trước đó.

## Trạng thái HIỆN TẠI (2026-10-07) — 2 sheet riêng như gốc

**Tab "2.Nhập KOC"** — cấu trúc: A=STT, B=Ngày nhập KOC, C=Tên KOC, D=Cộng tác≥80%, E=Có SP liên quan, F=Số đơn bán, G=GPM, H=KH18-34%, I=Style kênh, J=Ghi đè thủ công, K=Tổng điểm, L=Kết quả, **M=Ghi chú**, N=Trạng thái duyệt mẫu, O=Cảnh báo xử lý, P=RANK(ẩn - dùng cho Sheet 3), **Q=Tìm KOC(label), R=ô search sống**. Không còn cột Book nào ở đây nữa.

**Tab "3.Quản lý Book" (sheetId 1952146322)** — dùng để quản lý riêng các KOC đã DUYỆT, cột A-D tự kéo công thức từ Nhập KOC (qua khóa RANK), E-N là dữ liệu book thật:
A=STT(=RANK), B=Tên KOC(formula), C=Điểm(formula), D=Kết quả(formula), E=Sản phẩm KOC yêu cầu, F=Sản phẩm gửi cho KOC, **G=Hành động** (dropdown Đã duyệt/Đã từ chối — cột này VẪN CÒN, thêm từ 2026-10-06 trước khi vụ gộp bắt đầu, chủ shop không phản đối phần này), H=Cảnh báo (`=IF(F<>"";"Điền vào sổ kho";"")`), I=Giá book, J=Deadline đăng, K=Link bài đăng, L=View, M=Đơn hàng, N=Ghi chú, O=Tìm KOC(label), P=ô search sống (`$P$1`, giá trị "taphoahilo").
- Tô màu cả dòng: **vàng** = E có SKU nhưng G trống (cần xử lý), **xanh nhạt** = G="Đã duyệt", **xám** = G="Đã từ chối".
- Cột E,F là dropdown chip chọn-1 từ `'0.Danh mục SKU'!$F$2:$F$45` (Book gốc có chọn-nhiều nhưng không phải Claude set — nếu cần chọn nhiều, chủ shop tự bật qua Dữ liệu → Trình xác thực dữ liệu → Cho phép nhiều lựa chọn).
- Chủ shop đã tự xóa cột Giá book/Deadline/Link bài/View/Đơn hàng/Ghi chú Book 1 lần ở "2.Nhập KOC" lúc đang gộp (vì không dùng) — **CHƯA RÕ liệu chủ shop có muốn xóa luôn các cột tương ứng I-N bên Book hay không**, vì lúc đó đang nói về Nhập KOC. Hỏi lại nếu liên quan.

**Quy trình cột N "Ghi chú xác nhận" bị hủy theo cùng:** ý tưởng "Claude cập nhật cột F + ghi chú khi KOC xác nhận nhận thêm mẫu" vẫn còn giá trị về mặt quy trình, chỉ là giờ áp dụng trực tiếp lên tab Book (cột F, N) thay vì cột đã gộp.

**2026-10-07 — Xác nhận lại quy trình Book cho KOC vừa DUYỆT (chủ shop nhắc lại rõ):**
- Khi 1 KOC vừa được chấm DUYỆT, Claude phải **tự sang tab "3.Quản lý Book" điền SKU vào cột E ("Sản phẩm KOC yêu cầu") và F ("Sản phẩm gửi cho KOC")** — không để chủ shop tự gõ tay.
- Cột G "Hành động" mặc định hiểu là **"chưa bấm duyệt mẫu"** khi còn trống (không cần gõ chữ gì, trống = chưa làm, khớp đúng với rule tô vàng sẵn có khi E có SKU mà G trống). Chủ shop vào TikTok bấm duyệt xong thì tự quay lại sheet chọn **"Đã duyệt"** trong dropdown G.

**Cách báo chủ shop biết cần bấm duyệt ai:** đã chốt trước đó — gửi qua Telegram (bot "Báo cáo", xem [telegram-bot](../skills/daily-warehouse-report/references/reference_telegram_bot.md)) MỖI LẦN Claude vừa điền xong SKU cho 1 KOC mới bên tab Book, nội dung gồm tên KOC + SKU cần gửi. Không gộp báo cáo 1 lần/ngày.

**Lịch check/chấm điểm KOC:** đã hỏi, chủ shop chọn **KHÔNG đặt lịch cố định** — vẫn chỉ làm khi chủ shop chủ động nhắc trong chat, không cần Claude tự lên lịch chạy hàng ngày. Việc xem tin nhắn KOC trả lời cũng chỉ làm trong các lần check này, không có cách nào được TikTok tự báo khi có phản hồi mới.

## Cách thực hiện thao tác nhắn tin thật (2026-10-06, đã làm thành công 3 người)

**Đường vào:** affiliate.tiktok.com/affiliate/creator → tìm đúng handle (nhớ [tiktok-creator-search-unreliable](feedback_tiktok_creator_search_unreliable.md), search box hay mất chữ lần gõ đầu) → mở hồ sơ chi tiết → bấm icon chat (hình bong bóng, cạnh nút "Mời", tooltip "Trò chuyện với người sáng tạo qua công cụ tin nhắn tức thì") → panel chat hiện bên phải, gõ vào ô "Gửi tin nhắn" → bấm nút "Gửi".

**2 trục trặc đã gặp, cách xử lý:**
1. **CAPTCHA ghép hình** ("Xác minh để tiếp tục") hay hiện ra khi mở trang Yêu cầu hàng mẫu hoặc mở panel chat lần đầu trong phiên — đây là bot-detection, Claude TUYỆT ĐỐI không tự giải, phải nhờ chủ shop kéo mảnh ghép giúp rồi báo lại.
2. **"Lỗi nhắn tin - Lỗi máy chủ"** khi bấm icon chat với KOC chưa từng chat trước đó (panel hiện "Nhấp vào để bắt đầu trò chuyện" nhưng bấm không ăn) — cách khắc phục: **reload lại trang chi tiết nhà sáng tạo đó** (navigate lại đúng URL), rồi bấm icon chat lại — thường sẽ hết lỗi và hiện đúng ô nhập tin nhắn kèm tên KOC ở đầu danh sách "Gần đây nhất".

## "Rcm KOC thêm 1 sản phẩm" — TẠM DỪNG gửi, đang chờ chốt lại câu chữ (2026-10-07)

Phát hiện 2026-10-07: khi chấm xong 11 KOC mới, Claude chỉ nhắn tin cho nhóm KHÔNG DUYỆT (4 trường hợp cũ) mà **quên mất nhóm DUYỆT vẫn có thể kèm cờ "Rcm KOC thêm 1 sản phẩm"** (hoặc cờ "Đã tự duyệt...") trong cột O — đây là lỗi sót, phải rà cả cột O của DUYỆT lẫn KHÔNG DUYỆT mỗi lần chấm, không chỉ lọc theo Kết quả.

Đã gửi nhầm/sớm mẫu "Báo KOC review thêm mẫu mới" cho dkhanhrv trước khi kịp bàn lại câu chữ — chủ shop yêu cầu **dừng ngay, không gửi tiếp cho lincuti/daitayto.no1 (cùng đang chờ)**, hai bên sẽ bàn lại nội dung câu tin nhắn này trước khi dùng tiếp. **Trước khi gửi lại mẫu "Rcm KOC thêm 1 sản phẩm" cho bất kỳ ai, phải hỏi chủ shop xác nhận câu chữ mới đã chốt chưa — đừng tự ý dùng lại câu cũ trong tab inbox.**

**Quy trình MỚI đã chốt cho trường hợp "thêm mẫu"/"đổi mẫu" (2026-10-07, chốt lần cuối):**
1. Khi nhắn gợi ý KOC nhận thêm/đổi mẫu, **KHÔNG để nguyên "Chưa bấm duyệt mẫu"** ở cột G Book — đổi ngay sang giá trị mới **"Chờ KOC phản hồi thêm mẫu"** (đã thêm vào dropdown G, giờ có 4 lựa chọn: Chưa bấm duyệt mẫu / Chờ KOC phản hồi thêm mẫu / Đã duyệt / Đã từ chối). Lý do: chủ shop cố tình CHƯA bấm duyệt yêu cầu mẫu gốc khi đang chờ KOC trả lời có nhận thêm mẫu không (để gộp duyệt 1 lần), nên nếu để "Chưa bấm duyệt mẫu" y như các dòng khác thì khi quét cột để duyệt hàng loạt sẽ bấm nhầm, sai quy trình.
2. **Nếu KOC không phản hồi sau ~1 ngày và chủ shop vẫn bấm duyệt gửi mẫu gốc:** đổi cột G từ "Chờ KOC phản hồi thêm mẫu" → "Đã duyệt" bình thường, ghi thêm vào cột N (Ghi chú) dòng kiểu "Đã gợi ý thêm mẫu [ngày], KOC không phản hồi sau 1 ngày → chỉ gửi mẫu gốc". KHÔNG ghi vào sổ kho/lưu ý đơn hàng trong trường hợp này (không có gì thêm để kho chuẩn bị).
3. **Nếu KOC xác nhận đồng ý nhận thêm/đổi mẫu** — trigger: chủ shop tự vào file check + bấm duyệt trên TikTok, rồi quay lại chat báo tên KOC cho Claude (Claude KHÔNG tự động theo dõi được việc này, không có cách TikTok tự báo). Khi đó với từng KOC được báo:
   - Chỉ áp dụng cho dòng Book có cột **E ≠ F** (Sản phẩm KOC yêu cầu khác Sản phẩm gửi cho KOC) — dòng nào E=F y hệt thì không có gì lệch, không cần note.
   - Ghép note theo công thức ĐÃ SỬA (2026-10-07, chốt lần cuối): **bỏ mã SKU (vd "CL01 -"), chỉ giữ tên phân loại**; nếu gửi từ 2 sản phẩm trở lên thì nối bằng dấu **"+"** (không dùng mũi tên "->" so sánh E/F nữa). Ví dụ đúng: `"Chất Lông-Shin + Chất Lông-Shin 03 (giữ nguyên size)"` — liệt kê các SẢN PHẨM SẼ GỬI (tương ứng cột F), không cần nêu lại sản phẩm KOC xin ban đầu (cột E) trong note.
   - Dán note này vào **2 chỗ**: (a) ô "Lưu ý" của đúng đơn hàng đó trên **TikTok Shop Seller Center** (không phải Sapo — nhân viên đóng gói thấy khi in đơn trực tiếp từ đó), và (b) insert 1 dòng mới vào bảng Supabase **`warehouse_notices`** (xem [sokho-pyjama-supabase-tables](../skills/daily-warehouse-report/references/reference_sokho_pyjama_tables.md)) với `content` = note trên, `order_code` = mã đơn, `category` = **"thong_bao_chung"** mặc định (có thể đổi "gui_don_bu" nếu phù hợp hơn với tình huống cụ thể).
4. Việc bấm "Chấp thuận" yêu cầu mẫu gốc trên TikTok vẫn là chủ shop tự làm (không đổi) — cột G chỉ là nơi theo dõi trạng thái, Claude không tự bấm.

**2026-10-07 — Lần đầu thực hiện thật (dkhanhrv), đã xác minh toàn bộ đường đi:**
- Đơn hàng mẫu (sau khi chủ shop bấm Chấp thuận trên trang "Yêu cầu hàng mẫu") xuất hiện ở **Trung tâm nhà bán hàng** (`seller-vn.tiktok.com`, KHÁC domain với `affiliate.tiktok.com`) → Quản lý đơn hàng → lọc "Bao gồm: Mẫu sản phẩm miễn phí từ nhà bán hàng" → tab "Cần gửi"/"Đang chờ vận chuyển". Tên người mua bị che 1 phần (vd "d******v") — khớp bằng ký tự đầu/cuối username KOC + đúng SKU đã xin để xác định đúng đơn, không đoán bừa.
- Ô "Lưu ý" nằm trong đơn hàng, nút **"Thao tác khác" → "Thêm lưu ý"** — giới hạn **100 ký tự**. Công thức note ĐÃ CHỐT (sau 1 lần sửa): bỏ mã SKU, chỉ tên phân loại, nối nhiều sản phẩm bằng dấu "+", vd `"Chất Lông-Shin + Chất Lông-Shin 03 (giữ nguyên size)"` (~52 ký tự, dư nhiều chỗ hơn bản có SKU).
- **Lỗi đã gặp:** gõ lần đầu bị mất ký tự đầu tiên ("CL01" → "L01") do click-to-focus chưa kịp trước khi gõ — luôn chụp màn hình kiểm tra lại nội dung trước khi bấm OK, đừng tin tưởng mù quáng vào thao tác type.
- Insert vào Supabase `warehouse_notices` qua REST API (xem [sokho-pyjama-supabase-tables](../skills/daily-warehouse-report/references/reference_sokho_pyjama_tables.md) lấy URL/anon key) — `category: "thong_bao_chung"`, `order_code` = ID đơn hàng TikTok, `content` = câu note có kèm tên KOC ở đầu cho dễ tra (vd "KOC dkhanhrv thêm mẫu: ..."), `staff` để trống cũng insert được (không bắt buộc).
- **2026-10-09 — Lần 2 làm việc note "thêm/đổi mẫu" thật, quy trình chạy trơn tru:**
- **huyhoangaffiliate** (STT84, mới chấm 2026-10-08, 90đ DUYỆT) — chủ shop đã bấm duyệt mẫu gốc, không thêm/đổi gì (F=E) nên không cần note. KOC đã trả lời "ok bạn" xác nhận sẽ lên bài.
- **lincuti**: chủ shop xác nhận KOC đồng ý nhận thêm CL08-Patrick Star (ngoài CL01-Shin gốc) → ghi lưu ý đơn "Chất Lông-Shin + Chất Lông-Patrick Star (giữ nguyên size)" + insert sổ kho (id 21).
- **daitayto.no1**: F đổi hẳn 3 SKU hoàn toàn khác E gốc (CT01→CT10+CT09+CT08) — vẫn áp dụng đúng công thức, chỉ liệt kê nguyên văn cột F, không cố giải thích lý do đổi. Note "Chất Thun-Shin 04 + Chất Thun-Shin 02 + Chất Thun-Shin 01 (giữ nguyên size)" + sổ kho (id 22).
- **Cách tìm đơn hàng mẫu nhanh (đã cải tiến so với lần đầu):** vào seller-vn.tiktok.com/order?tab=to_ship, mở "Bộ lọc", điền thẳng username KOC vào ô "Tên người dùng của khách hàng" (field này match được username thật dù hiển thị bị che dạng "l*****i") — khỏi phải so khớp ký tự đầu/cuối + SKU như lần đầu.

**Lưu ý về timing:** sau khi chủ shop bấm Chấp thuận, đơn hàng mẫu KHÔNG xuất hiện ngay trên "Yêu cầu hàng mẫu" → "Sẵn sàng vận chuyển" — có độ trễ hệ thống (quan sát thực tế ước chừng vài phút), chủ shop đã xác nhận "đơn KOC này thường mất thời gian hệ thống lên đơn". Nếu check ngay sau khi chủ shop báo "đã bấm" mà chưa thấy đổi trạng thái, đợi vài phút rồi check lại, đừng vội kết luận chưa bấm.

**Cách xác nhận đang nhắn đúng người** (quan trọng vì panel chat mặc định hiện cuộc trò chuyện gần nhất, không phải luôn đúng KOC vừa mở): sau khi mở panel, kiểm tra người đầu danh sách "Gần đây nhất" đã được bôi đậm/chọn đúng tên KOC chưa, hoặc dùng `find` tool tìm tên KOC trong danh sách rồi click trực tiếp vào đó trước khi gõ tin.

**Trang hộp thư đầy đủ** (thay thế panel nhỏ nếu cần): bấm icon "Mở chat trong tab mới" (góc phải panel) → mở `affiliate.tiktok.com/seller/im` dạng trang riêng, có ô tìm kiếm liên hệ — nhưng ô này CHỈ tìm trong các cuộc trò chuyện đã tồn tại, không tìm ra KOC chưa từng chat; với KOC mới phải quay lại từ trang "Tìm nhà sáng tạo" → hồ sơ chi tiết → icon chat.
