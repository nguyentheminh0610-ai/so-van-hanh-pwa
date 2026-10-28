-- ============================================================================
-- Bảng cho tab "Chấm điểm KOC" trên Sổ Vận Hành (chốt 28/10/2026).
-- Spec đầy đủ: .claude/skills/check-koc/references/koc-dashboard-spec.md
--
-- Vì sao tách 2 bảng và mỗi video = 1 DÒNG (không lưu "bản báo cáo"):
-- chủ shop chốt gộp kỳ tuần/tháng **theo NGÀY ĐĂNG video**, nên chỉ cần mỗi
-- nội dung một dòng kèm ngày đăng là gộp kỳ = phép cộng, KHÔNG phải lưu ảnh
-- chụp số liệu theo thời gian. (Cùng triết lý với cskh-tables.sql.)
--
-- Nguồn ghi: skill check-koc, chạy 2 ngày/lần, đọc TikTok Affiliate Center
-- rồi upsert vào đây. Web chỉ ĐỌC.
--
-- Cách chạy: Supabase → SQL Editor → dán toàn bộ file này → Run. Chạy lại lần
-- nữa cũng không sao (đều có IF NOT EXISTS).
-- ============================================================================

-- --------------------------------------------------- chấm điểm + hàng mẫu --
-- 1 dòng = 1 lần chấm điểm, khớp 1-1 với 1 dòng tab "2.Nhập KOC" của Google
-- Sheet "Bảng Chấm Điểm KOC". Các cột theo dõi hàng mẫu/bài đăng chỉ có giá
-- trị với dòng DUYỆT (tức dòng có mặt bên tab "3.Quản lý Book").
--
-- LƯU Ý: cùng 1 KOC có thể xin mẫu nhiều lần => nhiều dòng. Đừng gom theo
-- koc_username khi đếm "số lần duyệt".
create table if not exists public.koc_scores (
  id              bigserial primary key,
  dedup_key       text not null unique,  -- 'nhapkoc|<stt>'
  stt             int  not null,         -- STT tab "2.Nhập KOC" (dòng = stt + 1)
  book_stt        int,                   -- STT tab "3.Quản lý Book"; null nếu KHÔNG DUYỆT
  ngay_nhap       date,                  -- ngày chấm điểm
  koc_username    text not null,         -- đã TRIM (vài tên trong sheet lẫn ký tự xuống dòng)
  diem            int,
  ket_qua         text,                  -- 'DUYỆT' | 'KHÔNG DUYỆT'  -> dùng tính % duyệt

  -- --- phần theo dõi hàng mẫu (chỉ dòng DUYỆT) ---
  sp_yeu_cau      text,                  -- Book cột E
  sp_gui          text,                  -- Book cột F, vd 'CL01 - Chất Lông-Shin'
  sku_gui         text,                  -- mã rút gọn 'CL01'; nhiều mã thì cách nhau dấu phẩy
  gia_von_mau     bigint,                -- đ, tra cost-catalog.json theo sku_gui (cộng nếu nhiều mã)
  hanh_dong       text,                  -- Book cột G

  -- trang_thai_mau PHẢI phân biệt được "hàng còn đang đi" với "đã nhận mà chưa
  -- đăng" — nếu gộp 2 cái này lại thì danh sách giục KOC sẽ gọi nhầm người
  -- chưa nhận được hàng.
  trang_thai_mau  text,                  -- 'dang_giao' | 'da_nhan_chua_dang' | 'da_dang' | 'huy'
  ngay_gui_mau    date,
  ngay_nhan_mau   date,                  -- để tính "đã chờ bao nhiêu ngày" + tiêu chí đăng đúng hạn
  da_len_bai      boolean,
  ngay_len_bai    date,                  -- ngày đăng SỚM NHẤT của KOC cho lần mẫu này
  ghi_chu         text,
  synced_at       timestamptz not null default now()
);
create index if not exists koc_scores_ketqua_idx on public.koc_scores (ket_qua);
create index if not exists koc_scores_koc_idx    on public.koc_scores (koc_username);
-- phục vụ thẻ "KOC cần check bài đăng"
create index if not exists koc_scores_chuadang_idx on public.koc_scores (trang_thai_mau)
  where trang_thai_mau = 'da_nhan_chua_dang';

-- ------------------------------------------------------ nội dung đã đăng ---
-- 1 dòng = 1 VIDEO hoặc 1 BUỔI LIVE. Gộp kỳ tuần/tháng cộng theo ngay_dang.
--
-- CẢNH BÁO khi gộp nhiều dòng: KHÔNG được cộng hay lấy trung bình các tỉ lệ
-- (đơn/1.000 view, ROI, tỷ lệ xem hết, tỷ lệ hoàn). Phải tính lại từ số tổng:
--   đơn/1.000 view = sum(so_don) / sum(luot_xem) * 1000
--   ROI            = sum(gmv)    / sum(gia_von_mau)
--   tỷ lệ hoàn     = sum(so_mon_hoan) / sum(so_mon_ban)
create table if not exists public.koc_contents (
  id              bigserial primary key,
  dedup_key       text not null unique,  -- chính là content_id của TikTok
  content_id      text not null,
  loai            text not null,         -- 'video' | 'live'
  koc_username    text not null,
  ngay_dang       date not null,         -- khoá để gộp kỳ tuần/tháng
  tieu_de         text,
  link            text,                  -- video: https://www.tiktok.com/@{user}/video/{id}

  luot_xem        bigint,
  so_don          int,                   -- "Đơn hàng nhờ video"
  gmv             bigint,                -- "GMV đến từ video liên kết", đ
  hoa_hong        bigint,                -- đ, nguồn /insights/transaction-analysis
  so_mon_ban      int,                   -- "Số món bán ra ghi nhận vào video"
  so_mon_hoan     int,                   -- để tính tỷ lệ hoàn
  hoan_tien       bigint,                -- đ
  ty_le_xem_het   numeric,               -- %, vd 5.02
  gpm             bigint,                -- đ, TikTok tính sẵn
  synced_at       timestamptz not null default now()
);
create index if not exists koc_contents_ngay_idx  on public.koc_contents (ngay_dang desc);
create index if not exists koc_contents_koc_idx   on public.koc_contents (koc_username);
create index if not exists koc_contents_loai_idx  on public.koc_contents (loai);

-- ---------------------------------------------------------------- quyền -----
-- Cùng mô hình với cskh_reviews / platform_returns_feed đang chạy: app và
-- script đều dùng anon key, ranh giới bảo mật nằm ở chỗ 2 bảng này không chứa
-- gì nhạy cảm (toàn số liệu công khai của nhà sáng tạo) chứ không ở chỗ giấu key.
alter table public.koc_scores   enable row level security;
alter table public.koc_contents enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'koc_scores' and policyname = 'anon all') then
    create policy "anon all" on public.koc_scores for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'koc_contents' and policyname = 'anon all') then
    create policy "anon all" on public.koc_contents for all using (true) with check (true);
  end if;
end $$;
