-- ============================================================================
-- Bảng cho tab "Đánh giá & Trả hàng" trên Sổ Vận Hành (chốt 28/10/2026).
--
-- Vì sao tách 2 bảng, mỗi đánh giá / mỗi case = 1 DÒNG (không lưu "bản báo cáo"):
-- có dữ liệu dạng dòng thì tổng hợp tuần/tháng chỉ là phép cộng, không phải đi
-- đọc lại sàn. Skill review-return-check chạy 08:00 & 20:00 trên PC trực sẽ
-- upsert vào đây, web chỉ đọc lên.
--
-- Cách chạy: Supabase → SQL Editor → dán toàn bộ file này → Run. Chạy lại lần
-- nữa cũng không sao (đều có IF NOT EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------- đánh giá --
create table if not exists public.cskh_reviews (
  id            bigserial primary key,
  dedup_key     text not null unique,   -- platform|order_code|review_date|40 ký tự đầu nội dung
  platform      text not null,          -- 'tiktok' | 'shopee'
  review_date   date not null,          -- ngày khách đánh giá (KHÔNG phải ngày quét)
  stars         int,                    -- 1..5, null nếu sàn không cho biết
  content       text,                   -- nguyên văn, để trống nếu khách chỉ bấm sao
  product       text,                   -- tên mẫu + size, như sàn hiển thị
  sku           text,
  customer      text,                   -- tên/handle khách, sàn thường che bớt
  order_code    text,
  needs_action  boolean not null default false, -- cần chủ shop động tay (xem action_type)
  action_type   text,                   -- loại việc của chủ shop (chốt 29/10/2026):
                                         --   'lien_he_khach' = đánh giá xấu đã nhắn 12h khách
                                         --        không trả lời → anh tìm tên khách trên TikTok nhắn hỗ trợ
                                         --   'tranh_chap'     = khách đang tranh chấp/khiếu nại (Hard rule 4)
                                         -- null khi needs_action = false
  action_note   text,                   -- vì sao cần xử lý, 1 câu
  insight_tag   text,                   -- chủ đề lặp lại, vd 'tuot-chi-cap' — để gom nhóm phần Insight
  insight_note  text,                   -- diễn giải ngắn chủ đề đó
  messaged_at   timestamptz,            -- đã nhắn khách mẫu chuẩn lúc nào (null = chưa nhắn)
  message_note  text,                   -- nhắn mẫu nào / vì sao bỏ qua
  -- --- Ghi lỗi sang Sổ Kho (warehouse_error_log). Chốt 29/10/2026. Skill CHỈ
  --     ĐỀ XUẤT; chủ shop bấm nút "Xác nhận ghi Sổ Kho" trên web mới insert thật,
  --     tránh tự ghi làm tăng nhầm % lỗi NV/NCC. ---
  shop_error_kind text,                 -- 'giao_nham' | 'giao_thieu' | 'san_pham_loi' | null
                                         --   giao_nham/giao_thieu → lỗi kho_van (NV đóng gói)
                                         --   san_pham_loi → lỗi san_pham (nhà cung cấp)
  errlog_code   text,                   -- MÃ VẬN ĐƠN gốc đã resolve (khoá Sổ Kho quét theo)
  errlog_reason text,                   -- mô tả ngắn đề xuất ghi vào warehouse_error_log.reason
  errlog_status text default 'none',    -- 'none'   = không phải lỗi shop / chưa xét
                                         -- 'suggest'= nghi lỗi shop, CHỜ anh bấm ghi (hiện nút)
                                         -- 'owned_resend' = giao_thieu → để resend-missing-item lo, KHÔNG ghi ở đây
                                         -- 'dup'    = Sổ Kho đã có dòng cho mã vận đơn này → không ghi
                                         -- 'written'= anh đã bấm, đã ghi (xem errlog_id)
  errlog_id     bigint,                 -- id dòng warehouse_error_log đã tạo (để tra ngược / gỡ nếu sai)
  created_at    timestamptz not null default now()
);
create index if not exists cskh_reviews_date_idx on public.cskh_reviews (review_date desc);
create index if not exists cskh_reviews_action_idx on public.cskh_reviews (needs_action) where needs_action;

-- -------------------------------------------------------------- trả hàng ----
create table if not exists public.cskh_returns (
  id            bigserial primary key,
  dedup_key     text not null unique,   -- platform|order_code|request_date
  platform      text not null,
  request_date  date not null,          -- ngày khách gửi yêu cầu trả/hoàn
  order_code    text,
  customer      text,
  reason        text,                   -- lý do sàn hiển thị, giữ NGUYÊN VĂN để gom nhóm
  amount        numeric,                -- số tiền hoàn, đồng
  product       text,
  customer_note text,                   -- ô "Nhận xét của khách hàng" trên thẻ trả hàng
                                        -- (KHÁC tin nhắn chat — đừng trộn 2 thứ)
  auto_approved boolean,                -- sàn tự duyệt hoàn hay chưa
  needs_action  boolean not null default false, -- tranh chấp / khách hỏi lại — chờ chủ shop
  action_type   text,                   -- 'tranh_chap' | 'lien_he_khach' (xem bảng cskh_reviews)
  action_note   text,
  insight_tag   text,
  insight_note  text,
  messaged_at   timestamptz,
  message_note  text,
  shop_error_kind text,                 -- xem bảng cskh_reviews (giao_nham|giao_thieu|san_pham_loi)
  errlog_code   text,                   -- mã vận đơn gốc (lấy từ platform_returns_feed.outbound_tracking)
  errlog_reason text,
  errlog_status text default 'none',    -- none|suggest|owned_resend|dup|written (xem bảng cskh_reviews)
  errlog_id     bigint,
  created_at    timestamptz not null default now()
);
create index if not exists cskh_returns_date_idx on public.cskh_returns (request_date desc);
create index if not exists cskh_returns_action_idx on public.cskh_returns (needs_action) where needs_action;

-- ------------------------------------------------- bổ sung cột về sau -------
-- Cột thêm sau khi 2 bảng đã tạo (chốt 29/10/2026 — cơ chế flag "anh tự liên hệ
-- khách" cho đánh giá xấu). Chạy lại cả file an toàn: add column if not exists.
alter table public.cskh_reviews add column if not exists action_type text;
alter table public.cskh_returns add column if not exists action_type text;

-- Cột liên kết ghi lỗi sang Sổ Kho (chốt 29/10/2026 — flag + nút xác nhận):
alter table public.cskh_reviews add column if not exists shop_error_kind text;
alter table public.cskh_reviews add column if not exists errlog_code   text;
alter table public.cskh_reviews add column if not exists errlog_reason text;
alter table public.cskh_reviews add column if not exists errlog_status text default 'none';
alter table public.cskh_reviews add column if not exists errlog_id     bigint;
alter table public.cskh_returns add column if not exists shop_error_kind text;
alter table public.cskh_returns add column if not exists errlog_code   text;
alter table public.cskh_returns add column if not exists errlog_reason text;
alter table public.cskh_returns add column if not exists errlog_status text default 'none';
alter table public.cskh_returns add column if not exists errlog_id     bigint;

-- ---------------------------------------------------------------- quyền -----
-- Cùng mô hình với platform_returns_feed / warehouse_error_log đang chạy: app
-- và script đều dùng anon key, ranh giới bảo mật nằm ở chỗ 2 bảng này không
-- chứa gì nhạy cảm (sàn đã che tên khách sẵn) chứ không ở chỗ giấu key.
alter table public.cskh_reviews enable row level security;
alter table public.cskh_returns enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'cskh_reviews' and policyname = 'anon all') then
    create policy "anon all" on public.cskh_reviews for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'cskh_returns' and policyname = 'anon all') then
    create policy "anon all" on public.cskh_returns for all using (true) with check (true);
  end if;
end $$;
