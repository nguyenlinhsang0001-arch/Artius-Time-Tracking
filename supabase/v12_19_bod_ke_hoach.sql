-- ============================================================
-- ARTIUS TIME v12.19 — BOD được sửa mục Kế hoạch như Admin
-- Chạy MỘT LẦN trong Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần vẫn an toàn. Không đổi dữ liệu có sẵn.
-- (Cần đã chạy supabase/v12_ke_hoach.sql bản đầy đủ trước.)
--
--   1. Lưới kế hoạch và Chốt bản: Admin HOẶC BOD ghi được (artius_view_all() = Admin hoặc BOD).
--   2. Hàm mới artius_planning_set: Admin hoặc BOD ghi được RIÊNG khoá "planning" của thiết lập chung
--      (ẩn dự án, gộp vai trò, khối tổng, hệ số sẵn sàng). BOD vẫn không đổi được phần thiết lập nào khác.
--   Trưởng phòng và nhân viên: vẫn bị từ chối.
-- ============================================================

-- 1a. Lưới kế hoạch
create or replace function public.artius_plan_set(p_year int, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.artius_is_member() then
    raise exception 'Chưa đăng nhập hoặc tài khoản đã bị khoá.' using errcode = '42501';
  end if;
  if not public.artius_view_all() then
    raise exception 'Chỉ Admin hoặc BOD được sửa kế hoạch nguồn lực.' using errcode = '42501';
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

-- 1b. Chốt bản
create or replace function public.artius_plan_snapshot_add(p_year int, p_label text, p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if auth.uid() is null or not public.artius_is_member() then
    raise exception 'Chưa đăng nhập hoặc tài khoản đã bị khoá.' using errcode = '42501';
  end if;
  if not public.artius_view_all() then
    raise exception 'Chỉ Admin hoặc BOD được chốt bản kế hoạch.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_data, '{}'::jsonb)) <> 'object' then
    raise exception 'Dữ liệu kế hoạch không hợp lệ.' using errcode = '22023';
  end if;
  insert into public.artius_plan_snapshot (year, label, data)
  values (p_year, nullif(trim(coalesce(p_label, '')), ''), coalesce(p_data, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end $$;

-- 2. Thiết lập riêng của mục Kế hoạch (khoá "planning" trong artius_config 'main')
create or replace function public.artius_planning_set(p_planning jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb;
begin
  if auth.uid() is null or not public.artius_is_member() then
    raise exception 'Chưa đăng nhập hoặc tài khoản đã bị khoá.' using errcode = '42501';
  end if;
  if not public.artius_view_all() then
    raise exception 'Chỉ Admin hoặc BOD được đổi thiết lập Kế hoạch.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_planning, '{}'::jsonb)) <> 'object' then
    raise exception 'Thiết lập Kế hoạch không hợp lệ.' using errcode = '22023';
  end if;
  select t.value::jsonb into c from public.artius_config t where t.id = 'main' for update;
  if c is null then raise exception 'Chưa có thiết lập.' using errcode = '22023'; end if;
  update public.artius_config t
     set value = jsonb_set(c, '{planning}', coalesce(p_planning, '{}'::jsonb))::text, rev = t.rev + 1, updated_at = now()
   where t.id = 'main';
  return coalesce(p_planning, '{}'::jsonb);
end $$;

revoke all on function public.artius_plan_set(int, jsonb)                from public, anon;
revoke all on function public.artius_plan_snapshot_add(int, text, jsonb) from public, anon;
revoke all on function public.artius_planning_set(jsonb)                 from public, anon;
grant execute on function public.artius_plan_set(int, jsonb)                to authenticated, service_role;
grant execute on function public.artius_plan_snapshot_add(int, text, jsonb) to authenticated, service_role;
grant execute on function public.artius_planning_set(jsonb)                 to authenticated, service_role;
