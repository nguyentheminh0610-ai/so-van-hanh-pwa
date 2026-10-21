# Mã đơn hàng của sàn → mã vận đơn (qua Sapo)

## Vì sao phải tra

Hai loại mã khác hẳn nhau, không suy ra được từ nhau:

| | Dạng | Ai dùng |
|---|---|---|
| **Mã đơn hàng** | TikTok `586…`/`585…` (18 số) hoặc `404…` (19 số); Shopee `26…` (14–15 ký tự) | màn hình đơn hàng của sàn, Sapo `order_name` |
| **Mã vận đơn** | `862…`/`854…` (12 số, TikTok); `SPXVN…` (Shopee Express); `VTPVN…` (Viettel) | nhãn dán trên gói, **máy quét của kho** |

Sổ Kho Pyjama chỉ lưu **mã vận đơn** (`warehouse_outbound_checks.code`,
`warehouse_return_checks.code`). Sổ lỗi (`warehouse_error_log.code`) phải
dùng cùng loại mã đó, nếu không thì mục 5 không tra được ai đóng đơn và
chỉ số lỗi theo nhân viên ở mục 3 bỏ sót người.

**Đã xảy ra thật:** T10/2026 có 9/13 ca lỗi kho vận ghi bằng mã đơn TikTok
`586…` → cả 9 ca hiện `—`, dồn vào thẻ "Lỗi chưa tra được người".

Không có cách nào bù lại từ trong Supabase: `platform_returns_feed` có cặp
`order_name` ↔ `outbound_tracking` nhưng **chỉ chứa đơn đã hoàn về kho**,
mà giao thiếu thì khách giữ hàng nên không có dòng nào;
`monthly_reports.data` cũng chỉ có đơn hoàn. Chỉ Sapo giữ đủ cả hai mã.

## Cách tra

```bash
.claude/skills/resend-missing-item/scripts/order_to_tracking.sh 586437463013230236
# 586437463013230236  ->  862588227962  ->  minh (2026-10-07)
```

Nhận nhiều mã một lần. Cột 3 là người đã quét mã vận đơn đó trong Sổ Kho
(`kho chưa quét mã này` = đơn đi thật nhưng không có trong sổ → báo chủ
shop, kho quên quét hoặc quét sai mã).

Gọi tay thì là `GET https://<store>/admin/orders.json?query=<mã đơn>&limit=5`,
lấy `orders[].fulfillments[].tracking_number`.

## 3 bẫy đã dính

1. **`credentials.json["store"]` ĐÃ gồm đuôi `.mysapo.net`**
   (`sometime-official.mysapo.net`) — nối thêm `.mysapo.net` nữa là
   `curl` trả `http=000` (exit 35), nhìn như lỗi mạng chứ không báo gì.
2. **Phải giả `User-Agent` Chrome**, không thì Cloudflare trả 403.
3. **`urllib` bị `SSLV3_ALERT_HANDSHAKE_FAILURE`** trên máy Mac này —
   dùng `curl`, đừng dùng `urllib.request` để gọi Sapo.

Key nằm ở `~/.config/sapo/credentials.json` (Basic auth: `api_key:api_secret`).
