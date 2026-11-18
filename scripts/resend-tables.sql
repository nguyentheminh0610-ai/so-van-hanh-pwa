-- ============================================================================
-- Bảng cho tab "Gửi bù" trên Sổ Vận Hành (chốt 17/11/2026).
-- Mỗi case khách báo thiếu hàng = 1 DÒNG. Luồng + mẫu tin: xem
-- .claude/skills/resend-missing-item/references/resend-flow-batch-2026-11-17.md
--
-- Ai ghi gì:
--   * Task CSKH / task gửi bù (PC trực) ghi mọi cột trạng thái, mã vận đơn, PDF...
--   * Web (tab "Gửi bù") CHỈ đổi status khi chủ shop bấm nút duyệt/sửa/dừng, và
--     luôn đổi CÓ ĐIỀU KIỆN (PATCH ...&status=eq.<trạng thái cũ>) để bấm 2 lần
--     hoặc 2 máy cùng bấm cũng không tạo trạng thái sai.
--
-- ⚠️ PII: khoá anon nằm trong repo public → bảng này KHÔNG chứa SĐT / địa chỉ
-- đầy đủ. Chỉ có bản che (recipient_masked). Dữ liệu đầy đủ đã chốt nằm ở file
-- cục bộ trên PC; data_hash là mã băm của file đó để task kiểm trước khi tạo đơn.
--
-- Cách chạy: Supabase → SQL Editor → dán toàn bộ file này → Run. Chạy lại cũng
-- không sao (if not exists).
-- ============================================================================

create table if not exists public.resend_cases (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- --- Khoá chống trùng: (sàn, handle khách, mã đơn gốc) ---
  platform         text not null,        -- 'tiktok' | 'shopee'
  handle           text not null,        -- handle / tên khách như sàn hiển thị
  orig_order_code  text not null,        -- mã đơn hàng gốc (586... / 404...)
  orig_tracking    text,                 -- MÃ VẬN ĐƠN gốc (tra bằng order_to_tracking.sh)

  -- --- Nội dung gửi bù ---
  item_summary     text not null,        -- vd 'Chất Lông-Shin 02 - size M - SL 1'
  item_confidence  text,                 -- 'high' | 'medium' | 'low' (độ chắc món thiếu)
  item_evidence    text,                 -- 1-2 câu: vì sao kết luận món này thiếu
  order_items      text,                 -- danh sách món của đơn gốc, để anh chọn lại nếu cần
  recipient_masked text,                 -- vd 'T*** P*** · 03******50 · Hà Nội / P. Cầu Giấy' (KHÔNG đầy đủ)
  data_hash        text,                 -- băm file dữ liệu đã chốt (null = chưa chốt)

  -- --- Trạng thái ---
  --  collecting     task đang hỏi khách thông tin
  --  verifying      đã gửi tin xác minh, chờ khách trả lời "đúng"
  --  wait_approve_1 khách đã xác nhận, CHỜ ANH duyệt lần 1
  --  approved       anh duyệt lần 1, chờ phiên tạo đơn (run_date, 15h)
  --  creating       phiên tạo đơn đang chạy (khoá chống chạy trùng)
  --  wait_approve_2 đã tạo đơn + PDF, CHỜ ANH duyệt lần 2
  --  finalizing     anh duyệt lần 2, task đang ghi Sổ Kho + nhắn khách
  --  done           xong hết
  --  stalled        treo (khách im > 72h, lỗi lặp...) — xem stall_reason
  --  blocked        anh chặn ở lần duyệt 2 (PDF/đơn có vấn đề)
  --  cancelled      dừng
  status           text not null default 'collecting',
  stall_reason     text,
  owner_note       text,                 -- anh ghi khi sửa/dừng/chặn
  attempts         int not null default 0,  -- số lần phiên tạo đơn đã thử
  last_error       text,
  creating_since   timestamptz,          -- để phát hiện case kẹt 'creating' > 30 phút

  -- --- Mốc giờ ---
  customer_confirmed_at timestamptz,     -- giờ KHÁCH nhắn "đúng" trên sàn (không phải giờ task đọc)
  confirm_slot     text,                 -- 'today' (xác nhận trước 14h) | 'tomorrow' (sau 14h)
  run_date         date,                 -- ngày phiên tạo đơn sẽ xử lý case này
  approved_at      timestamptz,          -- anh duyệt lần 1
  approved_override boolean not null default false, -- anh bấm "duyệt dù khách chưa xác nhận"
  approved2_at     timestamptz,          -- anh duyệt lần 2

  -- --- Kết quả tạo đơn ---
  spx_tracking     text,                 -- mã vận đơn mới (ghi NGAY sau khi tạo)
  spx_order_sn     text,                 -- order-sn trong URL spx-admin (để mở lại trang chi tiết)
  label_pdf        text,                 -- tên file trong bucket notices-pdf
  check_result     text,                 -- kết quả tự đối chiếu, mỗi dòng 1 mục "✓/✗ ..."
  check_ok         boolean,

  -- --- Cờ đã gửi (mỗi tin 1 cờ: gửi tin nào tick tin đó, chạy lại chỉ gửi tin chưa tick) ---
  msg_verify_at    timestamptz,          -- tin xác minh
  msg_ack_at       timestamptz,          -- tin ghi nhận sau khi khách xác nhận
  msg_creating_at  timestamptz,          -- tin 'đang tạo đơn' sau duyệt lần 1 (18/11/2026)
  msg_final_at     timestamptz,          -- ảnh chụp đơn + link theo dõi (3 tin cuối)
  msg_remind_at    timestamptz,          -- nhắc khách im lặng (tối đa 1 lần)

  -- --- Sổ Kho ---
  sokho_notice_id  bigint,               -- warehouse_notices.id đã ghi
  sokho_errlog_id  bigint                -- warehouse_error_log.id đã ghi
);

-- Chống trùng ngay ở database: 1 (sàn, khách, đơn gốc) chỉ có 1 case "còn sống".
-- Case đã dừng (cancelled) không chặn việc mở lại.
create unique index if not exists resend_cases_dedupe_idx
  on public.resend_cases (platform, handle, orig_order_code)
  where status <> 'cancelled';

create index if not exists resend_cases_status_idx on public.resend_cases (status);
create index if not exists resend_cases_run_idx on public.resend_cases (run_date) where status in ('approved','creating');

-- tự cập nhật updated_at
create or replace function public.resend_cases_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists resend_cases_touch_trg on public.resend_cases;
create trigger resend_cases_touch_trg before update on public.resend_cases
  for each row execute function public.resend_cases_touch();

-- ---------------------------------------------------------------- quyền -----
-- Cùng mô hình với cskh_reviews / warehouse_error_log: app và script dùng anon
-- key. Vì khoá lộ công khai nên bảng không chứa PII đầy đủ (xem đầu file).
alter table public.resend_cases enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'resend_cases' and policyname = 'anon all') then
    create policy "anon all" on public.resend_cases for all using (true) with check (true);
  end if;
end $$;

-- Bảng đã tạo từ trước: chạy dòng này 1 lần trên Supabase (18/11/2026)
alter table public.resend_cases add column if not exists msg_creating_at timestamptz;
