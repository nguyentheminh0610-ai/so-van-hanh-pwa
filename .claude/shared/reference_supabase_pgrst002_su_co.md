# Sự cố Supabase PGRST002 — "Chưa kết nối được dữ liệu" trên Sổ Kho / Sổ Vận Hành

**Chốt 04/11/2026** sau sự cố thật sáng 04/11: app Sổ Kho Pyjama báo
"Chưa kết nối được dữ liệu, thử lại sau" suốt nhiều giờ, mọi bảng đều hỏng.

## Triệu chứng

- App Sổ Kho / Sổ Vận Hành báo lỗi đỏ không tải được dữ liệu.
- Gọi REST API trả **HTTP 503** với body:
  `{"code":"PGRST002","message":"Could not query the database for the schema cache. Retrying."}`
- **Mọi bảng đều hỏng cùng lúc** (warehouse_return_checks, monthly_reports,
  cskh_reviews, koc_scores...) — không phải riêng 1 bảng.
- Lúc treo thì request không trả lời tới 15–40 giây rồi mới 503.

## Nguyên nhân gốc (đã xác nhận bằng cách sửa thử)

Role `authenticator` (role PostgREST dùng để kết nối) có
`statement_timeout = 8s` — mặc định của Supabase.

PostgREST trước khi phục vụ BẤT KỲ request nào phải nạp **schema cache**:
một câu truy vấn lớn vào `pg_catalog` để lấy danh sách bảng, cột, hàm, policy.
Khi câu đó chạy quá 8 giây thì bị cắt → PostgREST không có schema cache →
trả PGRST002 cho mọi request → nó thử lại, lại bị cắt, lặp vô hạn.

**Bằng chứng:** nới timeout lên 30s thì hết lỗi hoàn toàn trong ~4 phút,
KHÔNG cần restart project.

Vì sao câu nạp schema chậm dần: mỗi lần thêm bảng/index/RLS policy thì câu
catalog nặng thêm. Từ 20/10 đến 30/10 đã thêm nhiều bảng (hoàn về chưa nhận,
CSKH, KOC 3 bảng + 7 index). Gói **Free tier compute yếu** nên đến lúc nào đó
vượt ngưỡng 8 giây. Đây là lỗi tích luỹ, không phải "tự nhiên bị".

## Cách xử lý (lần sau gặp lại)

**Bước 1 — chẩn đoán nhanh, chạy trên PC:**
```bash
curl -s -m 30 "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/warehouse_return_checks?select=id&limit=1" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```
Thấy `PGRST002` → đúng sự cố này.

**Bước 2 — sửa, chạy trong Supabase SQL Editor:**
```sql
alter role authenticator set statement_timeout = '30s';
```
Đợi 3–5 phút cho PostgREST xoay vòng kết nối (nó giữ pool cũ nên không khỏi
ngay — test lại sau 1 phút vẫn lỗi là BÌNH THƯỜNG, đừng vội restart).

**Bước 3 — nếu sau 5 phút vẫn lỗi:** Settings → General → Restart project.
Không mất dữ liệu, mất 2–3 phút.

## Những thứ KHÔNG phải nguyên nhân (đã loại trừ 04/11/2026)

Đừng mất thời gian kiểm lại mấy thứ này:

- **Không phải mạng nhà / mạng PC.** Lỗi xảy ra ở cả PC trực lẫn máy khác.
- **Không phải do tắt/khởi động lại PC.** PC chỉ là máy khách gọi HTTP, không
  giữ kết nối hay khoá nào trong database. (Sáng 04/11 có restart PC lúc 10:42
  nhưng lỗi đã bắt đầu trước đó.)
- **Không phải quá tải.** Observability lúc sự cố: CPU 2%, connections 7/60,
  disk usage 14%, disk IO balance 99%, memory 58% — tất cả đều rảnh.
  **Nâng gói compute không giải quyết được lỗi này.**
- **Không phải kẹt khoá (lock).** `pg_stat_activity` trả 0 dòng, không có phiên
  nào `idle in transaction` hay chờ khoá.
- **Không phải database chết.** SQL Editor vẫn chạy bình thường, `/auth/v1/health`
  và `/storage/v1` vẫn trả 200. Chỉ lớp PostgREST hỏng.
- **Không phải script nào của shop gây ra.** Không script nào chạy DDL lúc
  vận hành (đã rà `tools/*.py`, `scripts/*.py`, `*.js`).

## Phòng ngừa lâu dài (chưa làm — cần chủ shop duyệt)

1. **Giữ `statement_timeout = 30s`** cho authenticator. Đã set 04/11/2026.
   Lưu ý: giới hạn của người dùng cuối vẫn do role `anon` (3s) và
   `authenticated` (8s) quyết định, nên nới cái này không làm app chậm đi.
2. **App Sổ Kho cần tự thử lại + lưu tạm lượt quét offline** để nhân viên vẫn
   quét được khi server trục trặc, gửi bù khi có lại mạng. Hiện tại server lỗi
   là kho dừng hẳn.
3. **Cảnh báo sớm qua Telegram** khi API trả 503, gộp vào task đồng bộ 15 phút
   (0 token), để biết trước khi nhân viên kêu.
4. **Cân nhắc lên gói Pro.** Free tier compute yếu (chính là lý do câu nạp
   schema chậm), không SLA, và tự pause khi nhàn rỗi 7 ngày.
