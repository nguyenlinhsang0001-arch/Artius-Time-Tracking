-- ARTIUS TIME v12 — Kế hoạch nguồn lực
-- Chạy một lần trên Supabase (SQL Editor). Chỉ tạo bảng mới, KHÔNG đụng tới
-- artius_config, artius_ts hay bất kỳ dữ liệu giờ công nào.

-- ============ 1. Lưới kế hoạch ============
-- Một dòng = một dự án × một vai trò × một năm; weeks là mảng 52–53 số (số người từng tuần).
create table if not exists public.artius_plan (
  year        int    not null,
  project_id  text   not null,
  role_id     text   not null,
  weeks       jsonb  not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (year, project_id, role_id)
);

-- ============ 2. Bản kế hoạch đã chốt ============
-- Chụp lại nguyên lưới tại một thời điểm, để so kế hoạch với thực tế trên bản đã chốt.
create table if not exists public.artius_plan_snapshot (
  id        bigserial primary key,
  year      int   not null,
  label     text,
  data      jsonb not null,
  taken_at  timestamptz not null default now()
);
create index if not exists artius_plan_snapshot_year_idx on public.artius_plan_snapshot (year, taken_at desc);

-- ============ 3. Ghi cả năm trong một lần ============
-- Thay toàn bộ các dòng của năm đó bằng p_rows. Gọn hơn gửi từng ô, và không để lại dòng rác
-- khi một vai trò bị gỡ khỏi dự án.
create or replace function public.artius_plan_set(p_year int, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.artius_plan where year = p_year;
  if p_rows is null or jsonb_array_length(p_rows) = 0 then return; end if;
  insert into public.artius_plan (year, project_id, role_id, weeks, updated_at)
  select p_year,
         r->>'project_id',
         r->>'role_id',
         coalesce(r->'weeks', '[]'::jsonb),
         now()
  from jsonb_array_elements(p_rows) as r;
end;
$$;

-- ============ 4. Phân quyền ============
-- ĐỌC: mọi tài khoản đã đăng nhập (quản lý cần xem, nhân viên không thấy tab này ở giao diện).
-- GHI: qua hàm artius_plan_set, và app chỉ cho Admin bấm nút Lưu.
-- Nếu muốn chặn cứng ở tầng database theo vai trò tài khoản, sửa lại phần policy bên dưới
-- cho khớp cách các file v8_7 / v9_3 đang làm.
alter table public.artius_plan          enable row level security;
alter table public.artius_plan_snapshot enable row level security;

drop policy if exists artius_plan_read on public.artius_plan;
create policy artius_plan_read on public.artius_plan
  for select to authenticated using (true);

drop policy if exists artius_plan_snap_read on public.artius_plan_snapshot;
create policy artius_plan_snap_read on public.artius_plan_snapshot
  for select to authenticated using (true);

drop policy if exists artius_plan_snap_write on public.artius_plan_snapshot;
create policy artius_plan_snap_write on public.artius_plan_snapshot
  for insert to authenticated with check (true);

grant select on public.artius_plan           to authenticated;
grant select, insert on public.artius_plan_snapshot to authenticated;
grant usage, select on sequence public.artius_plan_snapshot_id_seq to authenticated;
grant execute on function public.artius_plan_set(int, jsonb) to authenticated;
