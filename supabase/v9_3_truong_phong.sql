-- ============================================================
-- ARTIUS TIME v9.3 — Trưởng phòng giao dự án cho nhân viên phòng mình
-- Chạy MỘT LẦN trong Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần vẫn an toàn (create or replace). Không đổi dữ liệu có sẵn.
--
-- Thiết lập chung chỉ Admin ghi được. Hàm này cho TRƯỞNG PHÒNG ghi riêng "dự án đang tham gia"
-- (employee.projects, employee.allProjects) của nhân viên CÙNG PHÒNG (không gồm chính mình) — dùng ở tab Dự án / Nhân sự.
-- Admin dùng được cho mọi người. BOD / nhân viên: bị từ chối. Mật khẩu vẫn chỉ Admin xem được (bảng tài khoản không đổi).
-- ============================================================
create or replace function public.artius_emp_projects_set(p_emp text, p_projects jsonb, p_all boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c    jsonb;
  emps jsonb;
  outa jsonb;
  hit  jsonb;
  adm  boolean := public.artius_is_admin();
begin
  if auth.uid() is null or not public.artius_is_member() then
    raise exception 'Chưa đăng nhập hoặc tài khoản đã bị khoá.' using errcode = '42501';
  end if;
  if not adm and not (coalesce(p_emp, '') = any (public.artius_managed_emps())) then
    raise exception 'Trưởng phòng chỉ giao dự án cho nhân viên phòng mình.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_projects, '[]'::jsonb)) <> 'array'
     or exists (select 1 from jsonb_array_elements(coalesce(p_projects, '[]'::jsonb)) x where jsonb_typeof(x) <> 'string') then
    raise exception 'Danh sách dự án không hợp lệ.' using errcode = '22023';
  end if;

  select t.value::jsonb into c from public.artius_config t where t.id = 'main' for update;
  if c is null then raise exception 'Chưa có thiết lập.' using errcode = '22023'; end if;
  emps := case when jsonb_typeof(c -> 'employees') = 'array' then c -> 'employees' else '[]'::jsonb end;
  select x into hit from jsonb_array_elements(emps) as x where x ->> 'id' = p_emp limit 1;
  if hit is null then raise exception 'Không tìm thấy nhân sự.' using errcode = '22023'; end if;

  select coalesce(jsonb_agg(
           case when x ->> 'id' = p_emp
                then (x - 'allProjects') || jsonb_build_object('projects', coalesce(p_projects, '[]'::jsonb))
                     || case when coalesce(p_all, false) then jsonb_build_object('allProjects', true) else '{}'::jsonb end
                else x end
           order by n), '[]'::jsonb)
    into outa
    from jsonb_array_elements(emps) with ordinality as e(x, n);

  update public.artius_config t
     set value = jsonb_set(c, '{employees}', outa)::text, rev = t.rev + 1, updated_at = now()
   where t.id = 'main';
  select x into hit from jsonb_array_elements(outa) as x where x ->> 'id' = p_emp limit 1;
  return hit;
end $$;
revoke all on function public.artius_emp_projects_set(text, jsonb, boolean) from public, anon;
grant execute on function public.artius_emp_projects_set(text, jsonb, boolean) to authenticated, service_role;
