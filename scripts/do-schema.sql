-- Do kich thuoc "danh muc" ma PostgREST phai doc moi lan nap schema cache.
-- Cang lon thi moi lan nap cang lau = thoi gian So Kho chet cang dai.
select
  (select count(*) from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r')      as so_bang,
  (select count(*) from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'i')      as so_index,
  (select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid
     where c.relnamespace = 'public'::regnamespace and a.attnum > 0
       and not a.attisdropped)                                              as so_cot,
  (select count(*) from pg_proc
     where pronamespace = 'public'::regnamespace)                           as so_ham,
  (select count(*) from pg_policy)                                          as so_policy,
  (select count(*) from pg_class)                                           as tong_object_toan_db;
