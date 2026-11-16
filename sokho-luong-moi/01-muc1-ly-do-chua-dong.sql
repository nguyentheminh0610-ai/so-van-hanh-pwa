-- MUC 1 (17/11/2026): "Don da in nhung chua dong duoc" chi con 2 ly do: het_hang, khac.
-- Chay 1 lan trong Supabase > SQL Editor. Chay lai khong hai gi.

begin;

-- 1. Bo moi check constraint cu dang rang buoc cot reason (neu co) de doi gia tri duoc
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.warehouse_unpacked_log'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%reason%'
  loop
    execute format('alter table public.warehouse_unpacked_log drop constraint %I', c.conname);
  end loop;
end $$;

-- 2. Chuyen du lieu cu: thieu_hang -> het_hang; loi_hang va khac -> khac, ghi "chuyen tu ly do cu"
update public.warehouse_unpacked_log
   set reason = 'het_hang'
 where reason = 'thieu_hang';

update public.warehouse_unpacked_log
   set note = case when coalesce(trim(note),'') = '' then 'chuyển từ lý do cũ'
                   else trim(note) || ' (chuyển từ lý do cũ)' end,
       reason = 'khac'
 where reason in ('loi_hang','khac')
   and (reason = 'loi_hang' or length(trim(coalesce(note,''))) < 10);

-- 3. Rang buoc moi: chi 2 ly do; "khac" phai co ghi chu >= 10 ky tu
alter table public.warehouse_unpacked_log
  add constraint warehouse_unpacked_reason_chk check (reason in ('het_hang','khac'));
alter table public.warehouse_unpacked_log
  add constraint warehouse_unpacked_khac_note_chk
  check (reason <> 'khac' or length(trim(coalesce(note,''))) >= 10);

commit;
