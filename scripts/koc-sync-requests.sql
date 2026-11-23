-- ============================================================================
-- Bảng "lệnh cập nhật ngay" cho tab Chấm điểm KOC (chốt 23/11/2026).
--
-- Vì sao có bảng này: số liệu KOC do PC trực kéo từ TikTok (tools/koc_auto_sync.py,
-- cần Chrome đã đăng nhập) — trang web không tự kéo được. Chủ shop muốn có nút
-- "Cập nhật ngay" để xem số mới khi cần, không phải chờ lịch 2 ngày/lần.
-- Cách làm: nút trên web ghi 1 dòng status='pending' vào đây; task Windows
-- `Claude - KOC cap nhat ngay` (scripts/setup-koc-sync-task.ps1) dò bảng mỗi phút,
-- thấy lệnh thì chạy đồng bộ rồi ghi 'done' / 'error' để web biết mà tải lại số.
--
--   status: pending (web vừa bấm) -> running (PC đã nhận) -> done | error
--
-- Cách chạy: Supabase → SQL Editor → dán toàn bộ → Run. Chạy lại vô hại.
-- ============================================================================

create table if not exists public.koc_sync_requests (
  id            bigserial primary key,
  requested_at  timestamptz not null default now(),
  status        text not null default 'pending',
  finished_at   timestamptz,
  note          text                      -- lý do khi status = 'error'
);
create index if not exists koc_sync_requests_status_idx on public.koc_sync_requests (status);

alter table public.koc_sync_requests enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'koc_sync_requests' and policyname = 'anon all') then
    create policy "anon all" on public.koc_sync_requests for all using (true) with check (true);
  end if;
end $$;
