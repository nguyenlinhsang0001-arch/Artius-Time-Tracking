-- ============================================================
-- ARTIUS TIME v12.0 — Kế hoạch nguồn lực
-- Chạy MỘT LẦN trong Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần vẫn an toàn. Không đổi dữ liệu có sẵn.
--
-- Hai bảng MỚI, tách hẳn khỏi artius_config và artius_ts: xoá sạch kế hoạch cũng không mất
-- một giờ công nào, và một lỗi của mục Kế hoạch không chạm được vào thiết lập hay bảng công.
--
-- Quyền, theo đúng cách v8.7 / v9.3 đang làm:
--   ĐỌC  — mọi tài khoản còn hiệu lực (artius_is_member). Quản lý xem được, nhân viên không thấy tab này.
--   GHI  — chỉ Admin (artius_is_admin), và chỉ qua hàm; không mở policy insert/update/delete trực tiếp.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Lưới kế hoạch: một dòng = một dự án × một vai trò × một năm.
--    weeks là mảng 52–53 số, mỗi số là SỐ NGƯỜI của tuần đó (1 / 0,5 / 0,25).
-- ------------------------------------------------------------
create table if not exists public.artius_plan (
  year        int    not null,
  project_id  text   not null,
  role_id     text   not null,
  weeks       jsonb  not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (year, project_id, role_id)
);

-- ------------------------------------------------------------
-- 2. Bản kế hoạch đã chốt: chụp lại nguyên lưới tại một thời điểm, để về sau so kế hoạch
--    với thực tế trên bản ĐÃ CHỐT thay vì bản vừa sửa.
-- ------------------------------------------------------------
create table if not exists public.artius_plan_snapshot (
  id        bigserial primary key,
  year      int   not null,
  label     text,
  data      jsonb not null,
  taken_at  timestamptz not null default now()
);
create index if not exists artius_plan_snapshot_year_idx
  on public.artius_plan_snapshot (year, taken_at desc);

-- ------------------------------------------------------------
-- 3. Ghi cả năm trong một lần.
--    Thay toàn bộ các dòng của năm bằng p_rows — gọn hơn gửi từng ô, và không để lại dòng rác
--    khi một vai trò bị gỡ khỏi dự án.
-- ------------------------------------------------------------
create or replace function public.artius_plan_set(p_year int, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.artius_is_member() then
    raise exception 'Chưa đăng nhập hoặc tài khoản đã bị khoá.' using errcode = '42501';
  end if;
  if not public.artius_is_admin() then
    raise exception 'Chỉ Admin được sửa kế hoạch nguồn lực.' using errcode = '42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Năm không hợp lệ.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'Dữ liệu kế hoạch không hợp lệ.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    where jsonb_typeof(r) <> 'object'
       or coalesce(r ->> 'project_id', '') = ''
       or coalesce(r ->> 'role_id', '') = ''
       or jsonb_typeof(coalesce(r -> 'weeks', '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'Dữ liệu kế hoạch không hợp lệ.' using errcode = '22023';
  end if;

  delete from public.artius_plan where year = p_year;
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) = 0 then return; end if;
  insert into public.artius_plan (year, project_id, role_id, weeks, updated_at)
  select p_year, r ->> 'project_id', r ->> 'role_id', coalesce(r -> 'weeks', '[]'::jsonb), now()
    from jsonb_array_elements(p_rows) as r
  on conflict (year, project_id, role_id)
    do update set weeks = excluded.weeks, updated_at = now();
end $$;

-- ------------------------------------------------------------
-- 4. Chốt một bản kế hoạch.
-- ------------------------------------------------------------
create or replace function public.artius_plan_snapshot_add(p_year int, p_label text, p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if auth.uid() is null or not public.artius_is_member() then
    raise exception 'Chưa đăng nhập hoặc tài khoản đã bị khoá.' using errcode = '42501';
  end if;
  if not public.artius_is_admin() then
    raise exception 'Chỉ Admin được chốt bản kế hoạch.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_data, '{}'::jsonb)) <> 'object' then
    raise exception 'Dữ liệu kế hoạch không hợp lệ.' using errcode = '22023';
  end if;
  insert into public.artius_plan_snapshot (year, label, data)
  values (p_year, nullif(trim(coalesce(p_label, '')), ''), coalesce(p_data, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end $$;

-- ------------------------------------------------------------
-- 5. Quyền
-- ------------------------------------------------------------
alter table public.artius_plan          enable row level security;
alter table public.artius_plan_snapshot enable row level security;

drop policy if exists artius_plan_read on public.artius_plan;
create policy artius_plan_read on public.artius_plan
  for select to authenticated using (public.artius_is_member());

drop policy if exists artius_plan_snap_read on public.artius_plan_snapshot;
create policy artius_plan_snap_read on public.artius_plan_snapshot
  for select to authenticated using (public.artius_is_member());

-- Không có policy insert / update / delete: mọi thay đổi đi qua hai hàm ở trên.
revoke all on public.artius_plan          from public, anon;
revoke all on public.artius_plan_snapshot from public, anon;
grant select on public.artius_plan           to authenticated;
grant select on public.artius_plan_snapshot  to authenticated;

revoke all on function public.artius_plan_set(int, jsonb)                       from public, anon;
revoke all on function public.artius_plan_snapshot_add(int, text, jsonb)        from public, anon;
grant execute on function public.artius_plan_set(int, jsonb)                to authenticated, service_role;
grant execute on function public.artius_plan_snapshot_add(int, text, jsonb) to authenticated, service_role;
