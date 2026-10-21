---
name: daily-warehouse-report
description: Run the "3 báo cáo đối chiếu sàn" (+ bonus Báo cáo 4) daily warehouse check and send it to the shop owner via Telegram -- use whenever the shop owner asks to "check kho hôm nay", "check 3 báo cáo", "báo cáo đối chiếu sàn", or at 17:30 every day without being asked, since this is a daily recurring task that must never be skipped. Covers: cross-checking TikTok/Shopee "packed, waiting on shipper" orders against Sổ Kho's "Tích đơn đi" record (shipper pickup confirmation + packed-but-undispatched detection), cross-checking against "Đơn đã in nhưng chưa đóng được" for discrepancies, finding orders forgotten within the last 48h that were never even printed, and checking resend/"gửi bù" shipments from the last 48h against Sổ Kho to catch replacement orders that were created but never actually dispatched -- then sending the result as a Telegram message.
---

# Báo cáo kho hàng ngày — 3 báo cáo đối chiếu sàn

## ⛔ BƯỚC 0 — CHỈ CHẠY TRÊN MÁY WINDOWS (bắt buộc, làm trước mọi thứ)

Chạy `hostname`. Nếu kết quả **không phải `DESKTOP-N7T8LNP`** (vd máy Mac
"MacBook Air của nguyễn") → **DỪNG NGAY**: không mở trình duyệt, không đọc
Sổ Kho, **không gửi Telegram**, chỉ trả lời 1 câu "Bỏ qua: báo cáo kho chỉ
chạy trên máy Windows." Chủ shop chốt 2026-10-21 — Mac cũng chạy lịch này
nên Telegram nhận 2 báo cáo (17:32/17:33 từ Mac + 17:39 từ Windows).

## What this is for

**Giờ chạy cố định: 17:30 hằng ngày** (chốt 2026-10-13, thay cho "cuối
ngày" chung chung trước đây). Shop owner vẫn có thể gọi tay bất kỳ lúc nào.

Daily recurring task (shop owner can trigger it any time, e.g. "check 3 báo
cáo hôm nay") that answers 3 questions about today's TikTok Shop + Shopee
orders and reports them over Telegram — never just answered in chat, see
[reference_telegram_bot](references/reference_telegram_bot.md). Priority #1 in the daily ops mandate
([[project_ops_assistant_mandate]] nhóm 6) — **run it every day without
being asked**, the shop owner explicitly does not want to have to remember
to request it.

**The authoritative procedure definition is [reference_3_reports_doi_chieu_san](references/reference_3_reports_doi_chieu_san.md)**
— a verbatim copy of a doc the shop owner already finalized in a separate
Claude Project ("Kho" on claude.ai, `claude/quy-trinh-3-bao-cao-doi-chieu-san.md`).
Read that file for the exact report logic (Số liệu lõi, Báo cáo 1/2/3, message
template). **Do not re-derive the report logic from scratch or from this
skill's own prose** — this skill only covers *how to execute* that
procedure with this codebase's actual tools/credentials. If the two ever
seem to disagree, [reference_3_reports_doi_chieu_san](references/reference_3_reports_doi_chieu_san.md) wins — it mirrors
the shop owner's own canonical doc; fix this skill to match, not the other
way around.

(History note: an earlier local draft of this skill invented its own
2-mục/3-mục definitions from scratch across several rounds of
back-and-forth on 2026-10-07 evening — wrong, and corrected once the shop
owner pointed at the real source. Full story in
[[project_5pm_check_procedure]], kept for context only, not for execution.)

## Hard rule: internal reporting, no confirmation needed

Read-only reporting + internal Sổ Kho bookkeeping (no pricing, no product
changes, no messages to customers) — per
[[feedback_confirm_before_pricing]] this is the "việc khác" category: run
it and send the report, no need to ask first.

## Quick reference

**Supabase (Sổ Kho Pyjama, same project as Sổ Vận Hành):**
- URL: `https://dyvublxyrldmmnsrfvpz.supabase.co`
- anon key: `SUPABASE_ANON_KEY` in `so-van-hanh-pwa/init.js` — same key
  for both `apikey` and `Authorization: Bearer` headers.
- `warehouse_outbound_checks` ("Tích đơn đi"): `code` (mã vận đơn),
  `platform` (`tiktok`|`shopee`), `staff`, `scan_date`, `scanned_at`.
- `warehouse_unpacked_log` ("Đơn đã in nhưng chưa đóng được"): `code`,
  `platform`, `reason` (`thieu_hang`|`loi_hang`|`khac`), `note`, `staff`,
  `scan_date`, `created_at`. Full details: [reference_sokho_pyjama_tables](references/reference_sokho_pyjama_tables.md).
- `warehouse_notices` ("📌 Việc cần làm"), case `category=eq.gui_don_bu`
  ("Gửi đơn bù" — xem [[resend-missing-item]]): `order_code` (mã vận đơn
  SPX của lô hàng BÙ, không phải mã đơn gốc), `content` (dạng
  "<mã gốc> - 1 Quần ..."; dòng cũ trước 2026-10-20 có thể là
  "Gui bu ... - don goc #<mã gốc>"), `created_at`, `done`/`done_at`. Dùng cho
  Báo cáo 4 (bổ sung 2026-10-09).
- **"Tích đơn đi" ý nghĩa thật** (verified từ chính UI app, 2026-10-07):
  *"Lưu lại phòng khi đơn thất lạc trên đường tới kho vận chuyển — chỉ cần
  nhập mã."* I.e. nhân viên tích khi đơn đã thực sự rời kho — không tự
  sinh ra khi chỉ mới tạo phiếu/đóng gói xong.

**Telegram bot** — xem [reference_telegram_bot](references/reference_telegram_bot.md), gửi bằng:
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  --data-urlencode "chat_id=1874515158" \
  --data-urlencode "text=<nội dung>"
```

**TikTok Shop Seller Center** (qua Claude in Chrome — đã đăng nhập sẵn
trên máy chủ shop, không cần đăng nhập lại):
`https://seller-vn.tiktok.com/order?tab=to_ship`
- `order_status[]=1` = "Đang chờ vận chuyển" (chưa tạo phiếu)
- `order_status[]=2` = "Đang chờ lấy hàng" (đã tạo phiếu, chờ shipper) —
  nguồn cho Số liệu lõi + Báo cáo 3's "chưa chuyển trạng thái" check.
- Mã vận đơn hiện inline cạnh tên hãng vận chuyển trong list (vd "J&T
  Express, 862504816221" → mã = `862504816221`) — đây là mã cần tra trong
  `warehouse_outbound_checks`/`warehouse_unpacked_log`, KHÔNG phải "ID đơn
  hàng" hiển thị to ở đầu mỗi dòng.
- ⚠️ **Bug UI đã biết**: filter "Giao nhanh 24h" (Cách giao hàng) có thể
  bị kẹt chọn sẵn và âm thầm thu hẹp mọi số đếm, "Xoá tất cả" trong Bộ lọc
  lẫn navigate lại URL đều không chắc clear được. Cách lấy số đúng: mở Bộ
  lọc → 2 lựa chọn "Trạng thái đơn hàng" hiện số đếm trong ngoặc (vd
  "Đang chờ vận chuyển (4)" / "Đang chờ lấy hàng (2)") — **các số này
  đáng tin và cộng lại đúng bằng badge tổng của tab** dù pill filter kia
  vẫn đang hiện kẹt; verify bằng cách cộng lại khớp badge "Cần gửi N".
- ⚠️ "Trạng thái nhãn" (label status) filter KHÔNG đáng tin (dính chung
  bug trên, từng trả về "0 đơn hàng" sai) — đừng dùng.
- Mỗi đơn hiện ngày giờ đặt hàng (vd "07/10/2026 15:12:09") ngay trong
  list — dùng trực tiếp cho Báo cáo 3's khung giờ (hiện tại−48h → 15:00
  hôm nay), không cần filter "Thời gian đã tạo" riêng trừ khi muốn lọc
  nhanh trước khi đọc tay từng dòng.

**Shopee Kênh Người Bán** (qua Claude in Chrome):
`https://banhang.shopee.vn/portal/sale/order?type=toship`
- Tab "Chờ lấy hàng" → sub-filter "Trạng thái đơn hàng": "Chưa xử lý"
  (chưa tạo phiếu) vs "Đã xử lý" (đã tạo phiếu, chờ shipper) — nguồn cho
  Số liệu lõi + Báo cáo 3. Không dùng tổng tab chưa lọc (gộp cả 2).
- Mã đơn format bắt đầu bằng ngày tạo `YYMMDD` (vd `261006V5108K5F` =
  06/10/26) — tiện để mắt đọc nhanh tuổi đơn mà không cần mở từng đơn,
  nhưng giờ đặt hàng chính xác (cho Báo cáo 3) vẫn cần mở chi tiết đơn vì
  mã chỉ có ngày, không có giờ.
- "Đang được kiểm tra bởi Shopee" là 1 sub-filter riêng (Shopee tự giữ
  review) — không thuộc phạm vi 3 báo cáo này, không đếm vào đâu cả trừ
  khi shop owner hỏi riêng.
- ⚠️ Đôi khi 1 sub-filter hiện "0 Results / Vui lòng tải lại" dù pill vẫn
  hiện số khác 0 — glitch loading, navigate lại URL (không chỉ click lại
  filter) nếu không tự hết sau vài giây.

Taxonomy đầy đủ 2 sàn: [reference_platform_order_status_definitions](references/reference_platform_order_status_definitions.md).

## Cách thực thi theo đúng [reference_3_reports_doi_chieu_san](references/reference_3_reports_doi_chieu_san.md)

1. **Số liệu lõi**: lấy toàn bộ đơn "Đang chờ lấy hàng" (TikTok) + "Đã xử
   lý" (Shopee) hiện tại (mã vận đơn + SKU/số lượng từng đơn, vì cần cho
   Báo cáo 2 bước 1). Lấy `warehouse_outbound_checks` với `scan_date` =
   hôm nay. Đối chiếu theo mã vận đơn → Nhóm A (không có trong sổ) /
   Nhóm B (có trong sổ).
2. **Báo cáo 1**: Nhóm B rỗng → "Đã lấy hết". Có đơn → "Chưa lấy hết".
3. **Báo cáo 2**:
   - Đếm Nhóm A, mở từng đơn lấy SKU+số lượng (sàn không có file xuất
     gộp sẵn — phải mở từng đơn), cộng theo SKU.
   - **Khi viết vào báo cáo, ghi TÊN PHÂN LOẠI + size, không ghi mã SKU**
     (chốt 2026-10-13): tách đuôi size (`CL01-L` → `CL01` + `L`), tra
     `.claude/shared/sku_names.json` → "Chất Lông-Shin size L: 2". Mã chưa
     có trong bảng thì ghi nguyên mã kèm "(chưa có tên)" và nhắc chủ shop
     bổ sung vào bảng. Gộp các size của cùng 1 phân loại trên 1 dòng, vd
     "Chất Lông-Shin: M×1, L×2".
   - Đếm Nhóm B (chỉ số lượng).
   - Lấy `warehouse_unpacked_log` với `scan_date` = hôm nay, so mã vận
     đơn với Nhóm A — liệt kê phần lệch hai chiều nếu có (có ở nhóm này
     mà không có ở nhóm kia).
4. **Báo cáo 3**: lấy đơn "Đang chờ vận chuyển" (TikTok) + "Chưa xử lý"
   (Shopee) có giờ đặt hàng trong khoảng [giờ hiện tại − 48h, 15:00 hôm
   nay) — đếm số lượng, không liệt kê mã.
5. **Báo cáo 4** (bổ sung, xem [reference_3_reports_doi_chieu_san](references/reference_3_reports_doi_chieu_san.md) mục
   "BỔ SUNG"): lấy `warehouse_notices` (`category=eq.gui_don_bu`,
   `created_at` trong 48h gần nhất) → tra từng `order_code` trong
   `warehouse_outbound_checks` (toàn bộ lịch sử, không giới hạn ngày) →
   mã nào không có = đơn gửi bù chưa tích đi thật, liệt kê mã + `content`
   (khác Báo cáo 2/3: đây LUÔN kèm mã đơn vì cần xử lý gấp, khách đã đợi
   1 lần thiếu hàng rồi). **Sạch (tất cả đã tích) → KHÔNG viết gì vào báo
   cáo cho mục này, kể cả không xác nhận "đã ổn" — im lặng bỏ qua hoàn
   toàn** (chốt 2026-10-09, chỉ báo khi có vấn đề thật).
6. Gửi qua Telegram đúng form trong [reference_3_reports_doi_chieu_san](references/reference_3_reports_doi_chieu_san.md)
   (tiêu đề "📋 Báo cáo đối chiếu sàn — [ngày]"), rút gọn thành 1 câu nếu
   cả 3 báo cáo đầu đều sạch VÀ Báo cáo 4 cũng không có đơn lệch.

## Reference

- [reference_3_reports_doi_chieu_san](references/reference_3_reports_doi_chieu_san.md) — bản chuẩn nguyên văn, luôn đọc
  file này trước khi chạy nếu không chắc chi tiết nào.
- [reference_platform_order_status_definitions](references/reference_platform_order_status_definitions.md) — taxonomy trạng thái
  đơn 2 sàn.
- [reference_telegram_bot](references/reference_telegram_bot.md) — bot token/chat_id.
- [reference_sokho_pyjama_tables](references/reference_sokho_pyjama_tables.md) — schema đầy đủ các bảng Sổ Kho.
