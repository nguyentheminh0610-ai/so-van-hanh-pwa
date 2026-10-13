# Sheet structure — "Bảng Chấm Điểm KOC"

Spreadsheet id: `1-ccH9D7SklgEIqJbLlNEbKlpDlYkzHsikDNUy_Ss9Sc`

## Tab "2.Nhập KOC" (sheetId `723578113`)

| Col | Name | Type |
|---|---|---|
| A | STT | manual, sequential int |
| B | Ngày nhập KOC | manual, `DD/MM/YYYY` |
| C | Tên KOC | manual, TikTok username |
| D | Cộng tác ≥80% | manual, `Có`/`Không` |
| E | Có SP liên quan | manual, `Có`/`Không` |
| F | Số đơn bán | manual, raw int |
| G | GPM (nghìn VNĐ/đơn) | manual, number (thousands) |
| H | KH 18-34 (%) | manual, fraction 0-1, cell formatted as `0.0%` |
| I | Style kênh | manual, `Phù hợp ít`/`Phù hợp vừa`/`Phù hợp nhiều` |
| J | Ghi đè thủ công | manual, optional (`DUYỆT`/`KHÔNG DUYỆT` override) — leave blank normally |
| K | Tổng điểm | **formula**, see below |
| L | Kết quả | **formula**, see below |
| M | Ghi chú | manual free text — also the trigger field for "hết hàng"/"sai giới tính"/"không phù hợp" keywords read by column O |
| N | Trạng thái duyệt mẫu | unused, leave blank |
| O | Cảnh báo xử lý | **formula**, see below |
| P | RANK (ẩn) | **formula**, see below — hidden column, feeds Book tab |
| Q | Tìm KOC | label for the search box |
| R | (live search input) | manual, whatever the shop owner last searched |

Row 1 is the header. **STT `N` lives at spreadsheet row `N+1`.**

### Column K formula (per row `r`)

```
=IF(Cr="";"";IF(Er="Có";(IF(Fr>=301;50;IF(Fr>=101;30;IF(Fr>=30;10;0))))+(IF(Gr>=100;20;IF(Gr>=50;10;5)))+(IF(Hr>0,6;15;IF(Hr>=0,5;10;5)))+(IF(Ir="Phù hợp nhiều";15;IF(Ir="Phù hợp vừa";10;IF(Ir="Phù hợp ít";5;0))));0))
```

### Column L formula (per row `r`)

```
=IF(Cr="";"";IF(Jr<>"";Jr;IF(Er<>"Có";"KHÔNG DUYỆT";IF(Dr="Có";IF(Kr>60;"DUYỆT";"KHÔNG DUYỆT");IF(Kr>80;"DUYỆT";"KHÔNG DUYỆT")))))
```

(If cộng tác ≥80% the DUYỆT threshold is `K>60`; if cộng tác <80% the bar
is higher, `K>80` — a lower-cộng-tác KOC needs to be stronger everywhere
else to pass.)

### Column O formula (per row `r`)

```
=IF(Cr="";"";TEXTJOIN(" | ";TRUE;IF(Lr="KHÔNG DUYỆT";"Nhắn KOC chọn hoàn tiền mẫu";IF(AND(Dr="Không";Lr="DUYỆT");"Đã tự duyệt (cộng tác <80%) - nhắc KOC lên bài";""));IF(Fr>=3000;"Rcm KOC thêm 1 sản phẩm";"");IF(ISNUMBER(SEARCH("hết hàng";Mr));"Nhắn KOC chờ hàng";"");IF(OR(ISNUMBER(SEARCH("sai giới tính";Mr));ISNUMBER(SEARCH("không phù hợp";Mr)));"Nhắn KOC đổi mẫu khác";"")))
```

### Column P formula (per row `r`) — RANK, feeds Book tab

```
=IF(AND(Cr<>"";Lr="DUYỆT");SUMPRODUCT(($L$2:Lr="DUYỆT")*($C$2:Cr<>""));"")
```

This assigns a running count (1, 2, 3, ...) to DUYỆT rows only, in sheet
order. Book tab row `RANK + 1` pulls from whichever Nhập-KOC row has that
RANK value.

## Tab "3.Quản lý Book" (sheetId `1952146322`)

Only rows for DUYỆT KOC exist here, auto-populated via the RANK key.

| Col | Name | Type |
|---|---|---|
| A | STT (=RANK) | **formula**: `=IF(ISNUMBER(MATCH(ROW()-1;'2.Nhập KOC'!$P:$P;0));ROW()-1;"")` |
| B | Tên KOC | **formula**: `=IF($A2="";"";INDEX('2.Nhập KOC'!$C:$C;MATCH($A2;'2.Nhập KOC'!$P:$P;0)))` (adjust `2` per row) |
| C | Điểm | **formula**, same INDEX/MATCH pattern pulling column K |
| D | Kết quả | **formula**, same pattern pulling column L |
| E | Sản phẩm KOC yêu cầu | manual — chip dropdown, source `'0.Danh mục SKU'!$F$2:$F$45` |
| F | Sản phẩm gửi cho KOC | manual — same dropdown source as E |
| G | Hành động | manual — dropdown, 4 values: `Chưa bấm duyệt mẫu` / `Chờ KOC phản hồi thêm mẫu` / `Đã duyệt` / `Đã từ chối`. **Always write an explicit value, never leave blank.** |
| H | Cảnh báo | **formula**: `=IF(Fr<>"";"Điền vào sổ kho";"")` |
| I | Giá book | manual |
| J | Deadline đăng | manual |
| K | Link bài đăng | manual |
| L | View | manual |
| M | Đơn hàng | manual |
| N | Ghi chú | manual (Book-specific notes, separate from Nhập KOC's column M) |
| O | Tìm KOC | label |
| P | (live search input) | manual |

Row `RANK n` lives at spreadsheet row `n + 1` (row 1 = header, same as
Nhập KOC).

### Conditional formatting (don't need to touch, just context)

- Yellow "cần xử lý": `=AND($E2<>"";OR($G2="";$G2="Chưa bấm duyệt mẫu"))`
- Green "Đã duyệt": `=$G2="Đã duyệt"`
- Gray "Đã từ chối": `=$G2="Đã từ chối"`
- Search highlight: `=AND(TRIM($P$1)<>"";TRIM($B2)=TRIM($P$1))` — uses
  `TRIM()` specifically because `$P$1` has held a stray space character
  before, which broke a naive `<>""` check (matched every blank row).

## SKU dropdown source — tab "0.Danh mục SKU", column F (rows 2-45)

Format is `{CODE} - {Tên phân loại}`, e.g. `CL01 - Chất Lông-Shin`,
`CT01 - Chất Thun-Màu 01`. Pull the live list before mapping a creator's
requested pattern name to the dropdown value — don't guess the code.
