-- ARTIUS — Quản lý giờ công v1.8
-- Chạy trong Supabase → SQL Editor. Chạy lại nhiều lần được, không xoá dữ liệu.
-- Nâng cấp từ v1.7: chạy nguyên file này MỘT LẦN, ngay trước khi deploy bản v1.8.
-- File này tự chuyển dữ liệu từ bảng cũ (artius_kv) sang hai bảng mới ở mục 5.

-- 1. Bảng cũ (v1.4–v1.7): toàn bộ dữ liệu trong một dòng. Từ v1.8 chỉ còn là bản lưu, không ghi nữa.
create table if not exists public.artius_kv (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- 2. Bảng tài khoản (có từ v1.7). Mật khẩu lưu dạng đọc được để ban quản lý xem lại,
--    nên bảng này KHÔNG mở cho trình duyệt: chỉ hàm server /api/accounts (service_role) đọc/ghi.
create table if not exists public.artius_accounts (
  id         uuid primary key references auth.users (id) on delete cascade,
  emp_id     text unique,                 -- mã nội bộ của nhân sự trong app; null = tài khoản không gắn nhân sự
  username   text not null unique,
  password   text not null,
  is_admin   boolean not null default false,
  disabled   boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 3. Hai bảng mới ở v1.8
--    artius_config: một dòng duy nhất (id = 'main') chứa thiết lập: nhân sự, dự án, tác vụ, vai trò, ngày lễ…
--    artius_ts:     mỗi dòng là bảng công của MỘT nhân sự trong MỘT tháng. Mỗi người chỉ ghi dòng của mình,
--                   nên hai người lưu cùng lúc không thể đè dữ liệu của nhau.
create table if not exists public.artius_config (
  id         text primary key,
  value      text not null,
  rev        bigint not null default 1,   -- số phiên bản, tăng 1 mỗi lần ghi: để hai quản lý cùng sửa không đè nhau
  updated_at timestamptz not null default now()
);
alter table public.artius_config add column if not exists rev bigint not null default 1;
create table if not exists public.artius_ts (
  emp_id     text not null,
  ym         text not null,               -- 'YYYY-MM'
  value      text not null,               -- JSON: { rows, weeks }
  updated_at timestamptz not null default now(),
  primary key (emp_id, ym)
);

-- 4. Các hàm xác định người đang gọi. Chạy với quyền của người tạo (security definer)
--    vì người dùng không được đọc bảng tài khoản.
create or replace function public.artius_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.artius_accounts a where a.id = auth.uid() and not a.disabled);
$$;
create or replace function public.artius_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.artius_accounts a where a.id = auth.uid() and not a.disabled and a.is_admin);
$$;
create or replace function public.artius_my_emp()
returns text language sql stable security definer set search_path = public as $$
  select a.emp_id from public.artius_accounts a where a.id = auth.uid() and not a.disabled;
$$;

revoke all on function public.artius_is_member() from public, anon;
revoke all on function public.artius_is_admin()  from public, anon;
revoke all on function public.artius_my_emp()    from public, anon;
grant execute on function public.artius_is_member() to authenticated, service_role;
grant execute on function public.artius_is_admin()  to authenticated, service_role;
grant execute on function public.artius_my_emp()    to authenticated, service_role;

-- 5. Chuyển dữ liệu từ bảng cũ sang bảng mới. Chỉ chạy khi bảng mới chưa có thiết lập,
--    nên chạy lại file này sau khi đã dùng v1.8 sẽ KHÔNG ghi đè dữ liệu mới.
do $$
declare
  raw text;
begin
  if not exists (select 1 from public.artius_config where id = 'main') then
    select value into raw from public.artius_kv where key = 'artius:db:v1';
    if raw is not null then
      insert into public.artius_config (id, value)
      values ('main', coalesce((raw::jsonb -> 'config')::text, '{}'));

      insert into public.artius_ts (emp_id, ym, value)
      select split_part(t.k, ':', 1), split_part(t.k, ':', 2), t.v::text
      from jsonb_each(coalesce(raw::jsonb -> 'ts', '{}'::jsonb)) as t(k, v)
      where t.k like '%:%'
      on conflict (emp_id, ym) do nothing;
    end if;
  end if;
end $$;

-- 6. Phân quyền
alter table public.artius_accounts enable row level security;
alter table public.artius_kv       enable row level security;
alter table public.artius_config   enable row level security;
alter table public.artius_ts       enable row level security;

-- 6a. Bảng tài khoản: không policy nào, chỉ service_role dùng được
revoke all on public.artius_accounts from anon, authenticated;
grant all on public.artius_accounts to service_role;

-- 6b. Bảng cũ: chỉ còn đọc. Bản v1.7 nào còn mở trên máy nhân viên sẽ báo lỗi khi lưu
--     (thay vì lặng lẽ ghi vào bảng không còn dùng), tải lại trang là lên v1.8.
revoke all on public.artius_kv from anon, authenticated;
grant select on public.artius_kv to authenticated;
grant all on public.artius_kv to service_role;
drop policy if exists "artius_kv_anon_all" on public.artius_kv;
drop policy if exists "artius_kv_member_all" on public.artius_kv;
drop policy if exists "artius_kv_member_read" on public.artius_kv;
create policy "artius_kv_member_read" on public.artius_kv
  for select to authenticated
  using ((select public.artius_is_member()));

-- 6c. Thiết lập: mọi tài khoản hợp lệ đọc được, chỉ tài khoản quản lý sửa được
revoke all on public.artius_config from anon, authenticated;
grant select, insert, update on public.artius_config to authenticated;
grant all on public.artius_config to service_role;
drop policy if exists "artius_config_member_read" on public.artius_config;
drop policy if exists "artius_config_admin_insert" on public.artius_config;
drop policy if exists "artius_config_admin_update" on public.artius_config;
create policy "artius_config_member_read" on public.artius_config
  for select to authenticated
  using ((select public.artius_is_member()));
create policy "artius_config_admin_insert" on public.artius_config
  for insert to authenticated
  with check ((select public.artius_is_admin()));
create policy "artius_config_admin_update" on public.artius_config
  for update to authenticated
  using ((select public.artius_is_admin()))
  with check ((select public.artius_is_admin()));

-- 6d. Bảng công: nhân sự chỉ đọc/ghi dòng của chính mình; tài khoản quản lý đọc/ghi tất cả
revoke all on public.artius_ts from anon, authenticated;
grant select, insert, update, delete on public.artius_ts to authenticated;
grant all on public.artius_ts to service_role;
drop policy if exists "artius_ts_own_or_admin" on public.artius_ts;
create policy "artius_ts_own_or_admin" on public.artius_ts
  for all to authenticated
  using ((select public.artius_is_admin()) or emp_id = (select public.artius_my_emp()))
  with check ((select public.artius_is_admin()) or emp_id = (select public.artius_my_emp()));
