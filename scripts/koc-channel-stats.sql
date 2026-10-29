-- ============================================================================
-- Bảng cho 2 bảng mới "KOC gắn link trên VIDEO" / "KOC gắn link trên LIVE"
-- của tab "Chấm điểm KOC" (chủ shop chốt 29/10/2026, thay cho bảng tổng quan cũ).
--
-- Vì sao thêm bảng riêng thay vì dùng koc_contents:
-- koc_contents là 1 dòng / 1 video (hoặc 1 buổi LIVE). Nhưng 2 bảng chủ shop
-- muốn là GỘP THEO TỪNG KOC và tách rõ kênh video / kênh LIVE. Kéo hết
-- 1.365 video + 479 LIVE về rồi mới gộp thì quá nặng; TikTok cho gộp sẵn nên
-- lưu thẳng mức đã gộp. koc_contents vẫn giữ để biết "ai mới lên bài".
--
-- Mỗi dòng = 1 KOC × 1 kênh × 1 kỳ. Có cột ky_ngay để sau này lưu nhiều kỳ
-- (7 ngày / 30 ngày) mà không đè nhau.
--
-- Cách chạy: Supabase → SQL Editor → dán toàn bộ → Run. Chạy lại vô hại.
-- ============================================================================

create table if not exists public.koc_channel_stats (
  id            bigserial primary key,
  dedup_key     text not null unique,   -- '<koc>|<kenh>|<ky_ngay>'
  koc_username  text not null,
  kenh          text not null,          -- 'video' | 'live'
  ky_ngay       int  not null,          -- độ dài kỳ: 7 hoặc 30 (ngày)
  ky_den        date,                   -- ngày cuối của kỳ
  so_noi_dung   int,                    -- số video, hoặc số buổi LIVE
  gmv           bigint,
  so_don        int,
  luot_xem      bigint,                 -- video: lượt xem; LIVE: số người xem riêng biệt
  hoa_hong      bigint,
  synced_at     timestamptz not null default now()
);
create index if not exists koc_channel_stats_ky_idx   on public.koc_channel_stats (ky_ngay, kenh);
create index if not exists koc_channel_stats_gmv_idx  on public.koc_channel_stats (gmv desc);
create index if not exists koc_channel_stats_koc_idx  on public.koc_channel_stats (koc_username);

alter table public.koc_channel_stats enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'koc_channel_stats' and policyname = 'anon all') then
    create policy "anon all" on public.koc_channel_stats for all using (true) with check (true);
  end if;
end $$;
