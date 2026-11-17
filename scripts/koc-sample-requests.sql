-- ============================================================================
-- Bảng "yêu cầu hàng mẫu ĐANG MỞ" cho mục "Cần anh xử lý" của tab Chấm điểm KOC
-- (chốt 17/11/2026).
--
-- Vì sao có bảng này: mục "Cần anh xử lý" trước đây đọc cột trang_thai_mau của
-- koc_scores, mà cột đó chỉ được ghi MỘT LẦN lúc nạp lần đầu 29/10 (tools/koc_seed.py,
-- dữ liệu chép tay). Không có job nào cập nhật nên danh sách đứng yên và lệch hẳn
-- so với TikTok. Giờ tools/koc_auto_sync.py kéo thẳng danh sách hàng mẫu đang mở
-- từ TikTok Affiliate (0 token) và ghi vào đây; web chỉ đọc.
--
-- 1 dòng = 1 yêu cầu hàng mẫu (apply_id). Chỉ lưu các yêu cầu CHƯA xong:
--   dang_giao      = tab "Sẵn sàng vận chuyển" + "Đã vận chuyển" (KOC chưa nhận hàng)
--   chua_dang      = tab "Đang tiến hành" (đã nhận mẫu, chờ đăng bài)
-- Dòng nào biến mất khỏi TikTok (KOC đã đăng / bị huỷ) thì script xoá khỏi bảng.
--
-- Cách chạy: Supabase → SQL Editor → dán toàn bộ → Run. Chạy lại vô hại.
-- ============================================================================

create table if not exists public.koc_sample_requests (
  id            bigserial primary key,
  apply_id      text not null unique,     -- mã yêu cầu hàng mẫu của TikTok
  koc_username  text not null,
  sku_desc      text,                     -- phân loại đã gửi, vd 'Chất Lông-Shin 03,L'
  trang_thai    text not null,            -- 'dang_giao' | 'chua_dang'
  ngay_tao      timestamptz,              -- ngày KOC xin mẫu
  synced_at     timestamptz not null default now()
);
create index if not exists koc_sample_requests_tt_idx  on public.koc_sample_requests (trang_thai);
create index if not exists koc_sample_requests_koc_idx on public.koc_sample_requests (koc_username);

alter table public.koc_sample_requests enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'koc_sample_requests' and policyname = 'anon all') then
    create policy "anon all" on public.koc_sample_requests for all using (true) with check (true);
  end if;
end $$;
