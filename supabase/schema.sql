-- ARTIUS — Quản lý giờ công v1.7
-- Chạy trong Supabase → SQL Editor. Chạy lại nhiều lần được, không xoá dữ liệu.
-- Nâng cấp từ v1.6: chạy nguyên file này MỘT LẦN, ngay trước khi deploy bản v1.7.

-- 1. Bảng dữ liệu dùng chung (có từ v1.4)
create table if not exists public.artius_kv (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- 2. Bảng tài khoản (mới ở v1.7). Mật khẩu lưu dạng đọc được để ban quản lý xem lại,
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

alter table public.artius_accounts enable row level security;
revoke all on public.artius_accounts from anon, authenticated;
grant all on public.artius_accounts to service_role;
-- Không tạo policy nào cho bảng này: anon và authenticated không đọc được dòng nào.

-- 3. Ai được đọc/ghi dữ liệu giờ công: tài khoản có trong bảng trên và chưa bị khoá.
--    Hàm chạy với quyền của người tạo (security definer) vì người dùng không được đọc bảng tài khoản.
create or replace function public.artius_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.artius_accounts a
    where a.id = auth.uid() and not a.disabled
  );
$$;

revoke all on function public.artius_is_member() from public, anon;
grant execute on function public.artius_is_member() to authenticated, service_role;

-- 4. Khoá bảng dữ liệu: bỏ quyền của người chưa đăng nhập (anon), chỉ còn tài khoản hợp lệ.
alter table public.artius_kv enable row level security;

revoke all on public.artius_kv from anon;
grant select, insert, update, delete on public.artius_kv to authenticated;
grant all on public.artius_kv to service_role;

drop policy if exists "artius_kv_anon_all" on public.artius_kv;
drop policy if exists "artius_kv_member_all" on public.artius_kv;
create policy "artius_kv_member_all" on public.artius_kv
  for all to authenticated
  using (public.artius_is_member())
  with check (public.artius_is_member());
