-- ARTIUS — Quản lý giờ công v1.4 · bảng lưu trữ dùng chung
-- Chạy MỘT LẦN trong Supabase → SQL Editor.

create table if not exists public.artius_kv (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.artius_kv enable row level security;

grant select, insert, update, delete on public.artius_kv to anon;

-- App v1.4 chưa có đăng nhập tài khoản (chỉ có mã PIN quản lý ở phía giao diện),
-- nên trình duyệt truy cập bảng bằng anon key. Policy dưới đây cho phép anon đọc/ghi
-- RIÊNG bảng này. Ai có đường link webapp đều đọc/ghi được dữ liệu giờ công.
drop policy if exists "artius_kv_anon_all" on public.artius_kv;
create policy "artius_kv_anon_all" on public.artius_kv
  for all to anon using (true) with check (true);
