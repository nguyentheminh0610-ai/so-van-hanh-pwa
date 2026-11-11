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

---

# Lần 2 — 10–11/11/2026: KHÁC triệu chứng, cùng một gốc

**Chốt 11/11/2026.** Sổ Kho lại chết từ tối 10/11 đến sáng 11/11.

## Triệu chứng lần 2 (khác lần 1, đừng nhầm)

| | Lần 1 (04/11) | Lần 2 (10–11/11) |
|---|---|---|
| Phản hồi | 503 ngay 1–2 giây | **Treo 60 giây không trả lời** |
| Mã lỗi | PGRST002 liên tục | Lúc có lúc không |
| Hỏi bảng KHÔNG tồn tại | Cũng hỏng | **09:04 trả PGRST205 trong 0,2s (còn nhớ danh mục) → 09:10 mất sạch, 503** |

Mẹo chẩn đoán quan trọng: **hỏi một bảng không tồn tại**. PostgREST trả
PGRST205 từ bộ nhớ, không chạm database. Nếu câu này NHANH mà bảng thật lại
treo → PostgREST còn sống, vấn đề ở tầng kết nối/tài nguyên. Nếu câu này cũng
hỏng → đã mất schema cache.

```bash
curl -s -m 25 "https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1/bang_ao_khong_co?select=id" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```

## Đã loại trừ thêm ở lần 2

- **KHÔNG phải cạn kết nối.** `select state, count(*) from pg_stat_activity
  where datname='postgres' group by state` → active 1, idle 6 (giới hạn 60).
- **KHÔNG phải database chết.** SQL Editor chạy mượt suốt lúc API sập.
- **KHÔNG phải PC.** Không tiến trình python/node nào chạy; Chrome chỉ đang
  retry. (2 task tự động 17h30 ngày 10/11 và 8h ngày 11/11 đều LastTaskResult=1
  vì sự cố này.)
- **KHÔNG phải schema quá nặng** — xem dưới, đây là phát hiện quan trọng nhất.

## ⚠️ Phát hiện quyết định: schema RẤT NHỎ

Đo ngày 11/11/2026 (script `scripts/do-schema.sql`):

| so_bang | so_index | so_cot | so_ham | so_policy | tong_object_toan_db |
|---|---|---|---|---|---|
| 14 | 46 | 283 | 2 | 24 | 782 |

Đây là schema **tí hon**. Đọc danh mục cỡ này đáng lẽ mất **dưới 1 giây** trên
bất kỳ máy chủ bình thường nào.

**Vì vậy giả thuyết cũ "thêm nhiều bảng KOC/CSKH làm danh mục nặng dần" là SAI.
Đừng đi dọn bảng/index — không có gì để dọn, và dọn cũng không giải quyết.**

## Kết luận nguyên nhân gốc (11/11/2026)

Schema nhỏ xíu mà việc đọc danh mục vẫn quá 8 giây → không phải do khối lượng
công việc, mà do **máy chủ bị bóp tài nguyên tại thời điểm đó**.

Gói **Free tier của Supabase chạy trên máy nhỏ dùng chung, có hạn mức CPU tích
luỹ (burst credit)**. Khi hết hạn mức, máy bị bóp xuống rất thấp: mọi truy vấn
chậm gấp hàng chục lần, trong khi biểu đồ vẫn hiện "CPU 2%" (vì nó KHÔNG ĐƯỢC
PHÉP dùng nhiều hơn, chứ không phải nó rảnh). Điều này khớp với toàn bộ dữ liệu
đã quan sát:

- schema nhỏ nhưng vẫn quá 8 giây
- CPU hiển thị thấp, kết nối ít, database rảnh — mà vẫn chậm
- tự khỏi sau một lúc (hạn mức hồi lại)
- lặp lại sau vài ngày (hạn mức lại cạn)

**Mức độ chắc chắn:** cao nhưng chưa có log xác nhận. Nếu muốn chắc 100%, xem
**Logs → Postgres Logs** quanh giờ sự cố, tìm `out of memory`, `terminating`,
`shutting down`.

## Hướng xử lý chốt lại

1. **Nâng lên gói Pro (~25 USD/tháng).** Đây là cách sửa gốc duy nhất ở phía
   mình: máy chủ riêng, không bị bóp hạn mức, đủ RAM, có hỗ trợ khi sự cố.
   Gói Free còn tự tạm dừng nếu 7 ngày không ai dùng.
2. **Giữ `statement_timeout = 30s`** cho authenticator (đã set 04/11).
3. **KHÔNG dọn bảng/index** — schema đã nhỏ, không phải nguyên nhân.
4. **Làm quét offline cho Sổ Kho** — chủ shop muốn xử lý gốc trước, nhưng chừng
   nào chưa có thì mỗi lần server trục trặc là kho dừng hẳn. 2 lần trong 7 ngày.
