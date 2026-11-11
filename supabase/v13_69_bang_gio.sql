-- ARTIUS TIME v13.69 — R3: BẢNG GIỜ PHẲNG artius_hours
--
-- Mỗi dòng = MỘT ô giờ: một người · một ngày · một dòng tác vụ trong bảng công.
--   emp_id, ngay, ym, row_no (thứ tự dòng trong bảng công tháng đó), project_id, phase_id, task_id, ot_for,
--   vai_tro (vai trò của người đó ĐÚNG NGÀY ĐÓ, theo employee.roleHistory — v13.68), gio, da_gui (ngày đã gửi chưa).
--
-- NGUỒN SỰ THẬT VẪN LÀ artius_ts. Bảng này chỉ là bản "bung ra" để đọc / tổng hợp:
--   · App và người dùng KHÔNG ghi được vào bảng này (không có policy ghi).
--   · Mỗi lần bảng công được lưu / xoá, trigger tự bung lại đúng (người, tháng) đó.
--   · Sửa vai trò / lịch sử vai trò của ai trong Nhân sự → trigger trên artius_config cập nhật vai_tro của riêng người đó.
--   · Lỡ lệch: Thiết lập › Sao lưu › "Dựng lại bảng giờ" (Admin) xoá và bung lại toàn bộ. Không đụng artius_ts.
--   · Xoá cả bảng này (drop table) cũng KHÔNG mất giờ công nào.
--
-- Không màn hình nào đọc bảng này ở v13.69 — mọi con số trong app giữ nguyên.
--
-- Chạy MỘT lần trên Supabase → SQL Editor (sau 8 file cũ). Chạy lại nhiều lần không sao.
-- Chạy xong: vào app, Thiết lập › Sao lưu › bấm "Dựng lại bảng giờ" một lần để bung dữ liệu cũ.
-- (Hoặc chạy dòng cuối file: select * from public.artius_hours_rebuild();  — trong SQL Editor cũng được.)

-- ---------- 1. Bảng ----------
create table if not exists public.artius_hours (
  emp_id     text    not null,
  ym         text    not null,                 -- 'YYYY-MM' — tháng của dòng artius_ts chứa ô này
  row_no     int     not null,                 -- vị trí dòng trong rows[] (0, 1, 2…)
  ngay       date    not null,
  project_id text    not null default '',
  phase_id   text    not null default 'P2',    -- trống = P2, giống artius_usage
  task_id    text    not null default '',
  ot_for     text    not null default '',
  vai_tro    text    not null default '',
  gio        numeric not null,
  da_gui     boolean not null default false,
  primary key (emp_id, ym, row_no, ngay)
);
create index if not exists artius_hours_ngay    on public.artius_hours (ngay);
create index if not exists artius_hours_project on public.artius_hours (project_id, phase_id);
create index if not exists artius_hours_vai_tro on public.artius_hours (vai_tro, ngay);

-- ---------- 2. Vai trò của một nhân sự tại một ngày (giống domain.roleOn ở app) ----------
-- emp: phần tử của config.employees. roleHistory thiếu/rỗng = vai trò hiện tại, từ trước.
create or replace function public.artius_role_on(emp jsonb, d date)
returns text language sql immutable set search_path = public as $$
  select coalesce(
    (select h ->> 'role'
       from jsonb_array_elements(case when jsonb_typeof(emp -> 'roleHistory') = 'array'
                                       and jsonb_array_length(emp -> 'roleHistory') > 0
                                      then emp -> 'roleHistory' else '[]'::jsonb end) with ordinality as x(h, i)
      where coalesce(h ->> 'from', '') = '' or (h ->> 'from') <= to_char(d, 'YYYY-MM-DD')
      order by i desc limit 1),
    case when jsonb_typeof(emp -> 'roleHistory') = 'array' and jsonb_array_length(emp -> 'roleHistory') > 0
         then '' else coalesce(emp ->> 'role', '') end,
    '');
$$;

-- ---------- 3. Bung MỘT bảng công (người, tháng) ----------
create or replace function public.artius_flatten_ts(p_emp text, p_ym text, p_value text, p_emp_cfg jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  j jsonb;
  n int;
begin
  delete from public.artius_hours where emp_id = p_emp and ym = p_ym;
  if p_value is null then return 0; end if;
  begin
    j := p_value::jsonb;
  exception when others then
    return 0;                                   -- JSON hỏng: bỏ qua, không làm hỏng việc lưu bảng công
  end;
  insert into public.artius_hours (emp_id, ym, row_no, ngay, project_id, phase_id, task_id, ot_for, vai_tro, gio, da_gui)
  select p_emp, p_ym, (rw.i - 1)::int, d.key::date,
         coalesce(rw.r ->> 'projectId', ''),
         coalesce(nullif(rw.r ->> 'phaseId', ''), 'P2'),
         coalesce(rw.r ->> 'taskId', ''),
         coalesce(rw.r ->> 'otFor', ''),
         public.artius_role_on(coalesce(p_emp_cfg, '{}'::jsonb), d.key::date),
         (d.value #>> '{}')::numeric,
         coalesce(case when jsonb_typeof(j -> 'sent') = 'object' then j -> 'sent' end, '{}'::jsonb) ? d.key
  from jsonb_array_elements(case when jsonb_typeof(j -> 'rows') = 'array' then j -> 'rows' else '[]'::jsonb end)
         with ordinality as rw(r, i)
       cross join lateral jsonb_each(case when jsonb_typeof(rw.r -> 'days') = 'object' then rw.r -> 'days' else '{}'::jsonb end) as d
  where d.key ~ '^\d{4}-\d{2}-\d{2}$'
    and jsonb_typeof(d.value) = 'number'
    and (d.value #>> '{}')::numeric > 0
  on conflict (emp_id, ym, row_no, ngay) do update set gio = excluded.gio;   -- trùng khoá ngày (không nên có): giữ số sau
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.artius_flatten_ts(text, text, text, jsonb) from public, anon, authenticated;

-- nhân sự trong config (một phần tử employees) theo id
create or replace function public.artius_emp_cfg(p_emp text)
returns jsonb language sql stable security definer set search_path = public as $$
  select e
  from public.artius_config c,
       jsonb_array_elements(case when jsonb_typeof(c.value::jsonb -> 'employees') = 'array'
                                 then c.value::jsonb -> 'employees' else '[]'::jsonb end) as e
  where c.id = 'main' and e ->> 'id' = p_emp
  limit 1;
$$;
revoke all on function public.artius_emp_cfg(text) from public, anon, authenticated;

-- ---------- 4. Trigger trên artius_ts: lưu / xoá bảng công → bung lại đúng (người, tháng) ----------
create or replace function public.artius_ts_flatten_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'DELETE' then
      delete from public.artius_hours where emp_id = old.emp_id and ym = old.ym;
      return old;
    end if;
    if tg_op = 'UPDATE' and (old.emp_id <> new.emp_id or old.ym <> new.ym) then
      delete from public.artius_hours where emp_id = old.emp_id and ym = old.ym;
    end if;
    perform public.artius_flatten_ts(new.emp_id, new.ym, new.value, public.artius_emp_cfg(new.emp_id));
  exception when others then
    -- Bảng phẳng chỉ là bản sao để đọc: lỗi ở đây KHÔNG được chặn việc lưu giờ công.
    -- Lệch thì "Dựng lại bảng giờ".
    raise warning 'artius_hours: bỏ qua lỗi khi bung % %: %', coalesce(new.emp_id, old.emp_id), coalesce(new.ym, old.ym), sqlerrm;
  end;
  return coalesce(new, old);
end $$;
revoke all on function public.artius_ts_flatten_trg() from public, anon, authenticated;

drop trigger if exists artius_ts_flatten on public.artius_ts;
create trigger artius_ts_flatten
  after insert or update or delete on public.artius_ts
  for each row execute function public.artius_ts_flatten_trg();

-- ---------- 5. Trigger trên artius_config: đổi vai trò / lịch sử vai trò → cập nhật vai_tro của người đó ----------
-- Chỉ người có role hoặc roleHistory khác đi mới bị tính lại, nên lưu thiết lập bình thường gần như không tốn gì.
create or replace function public.artius_config_roles_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.id <> 'main' then return new; end if;
  begin
    for r in
      with nw as (
        select e ->> 'id' as id, e
        from jsonb_array_elements(case when jsonb_typeof(new.value::jsonb -> 'employees') = 'array'
                                       then new.value::jsonb -> 'employees' else '[]'::jsonb end) as e
      ), od as (
        select e ->> 'id' as id, e
        from jsonb_array_elements(case when tg_op = 'UPDATE' and jsonb_typeof(old.value::jsonb -> 'employees') = 'array'
                                       then old.value::jsonb -> 'employees' else '[]'::jsonb end) as e
      )
      select nw.id, nw.e from nw left join od on od.id = nw.id
      where od.id is null
         or coalesce(nw.e -> 'role', 'null') is distinct from coalesce(od.e -> 'role', 'null')
         or coalesce(nw.e -> 'roleHistory', 'null') is distinct from coalesce(od.e -> 'roleHistory', 'null')
    loop
      update public.artius_hours h
         set vai_tro = public.artius_role_on(r.e, h.ngay)
       where h.emp_id = r.id
         and h.vai_tro is distinct from public.artius_role_on(r.e, h.ngay);
    end loop;
  exception when others then
    raise warning 'artius_hours: bỏ qua lỗi khi cập nhật vai trò: %', sqlerrm;
  end;
  return new;
end $$;
revoke all on function public.artius_config_roles_trg() from public, anon, authenticated;

drop trigger if exists artius_config_roles on public.artius_config;
create trigger artius_config_roles
  after insert or update on public.artius_config
  for each row execute function public.artius_config_roles_trg();

-- ---------- 6. Dựng lại toàn bộ (Admin trong app, hoặc SQL Editor) ----------
-- Trả về: số dòng giờ, tổng giờ trong bảng phẳng, tổng giờ đếm thẳng từ artius_ts — hai tổng phải bằng nhau.
create or replace function public.artius_hours_rebuild()
returns table (so_dong bigint, tong_gio_bang_phang numeric, tong_gio_bang_cong numeric)
language plpgsql security definer set search_path = public as $$
declare
  cf jsonb;
begin
  if auth.uid() is not null and not public.artius_is_admin() then
    raise exception 'Chỉ Admin được dựng lại bảng giờ.' using errcode = '42501';
  end if;
  select coalesce((select c.value::jsonb from public.artius_config c where c.id = 'main'), '{}'::jsonb) into cf;
  delete from public.artius_hours where true;   -- "where true": Supabase có thể bật chặn delete không điều kiện
  perform public.artius_flatten_ts(t.emp_id, t.ym, t.value,
            (select e from jsonb_array_elements(case when jsonb_typeof(cf -> 'employees') = 'array' then cf -> 'employees' else '[]'::jsonb end) as e
              where e ->> 'id' = t.emp_id limit 1))
  from public.artius_ts t;
  return query
    select (select count(*) from public.artius_hours),
           (select coalesce(sum(gio), 0) from public.artius_hours),
           (select coalesce(sum((d.value #>> '{}')::numeric), 0)
              from public.artius_ts t
                   cross join lateral (select case when t.value ~ '^\s*\{' then t.value::jsonb else '{}'::jsonb end as j) as v
                   cross join lateral jsonb_array_elements(case when jsonb_typeof(v.j -> 'rows') = 'array' then v.j -> 'rows' else '[]'::jsonb end) as rw
                   cross join lateral jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
             where d.key ~ '^\d{4}-\d{2}-\d{2}$' and jsonb_typeof(d.value) = 'number' and (d.value #>> '{}')::numeric > 0);
end $$;
revoke all on function public.artius_hours_rebuild() from public, anon;
grant execute on function public.artius_hours_rebuild() to authenticated, service_role;

-- ---------- 7. Phân quyền: ĐỌC giống hệt bảng công, KHÔNG ai ghi được (trừ trigger / service_role) ----------
alter table public.artius_hours enable row level security;
revoke all on public.artius_hours from anon, authenticated;
grant select on public.artius_hours to authenticated;
grant all on public.artius_hours to service_role;
drop policy if exists "artius_hours_read" on public.artius_hours;
create policy "artius_hours_read" on public.artius_hours
  for select to authenticated
  using ((select public.artius_view_all()) or emp_id = (select public.artius_my_emp())
         or emp_id in (select unnest(public.artius_managed_emps())));

-- ---------- 8. Dựng lần đầu ----------
select * from public.artius_hours_rebuild();

-- ---------- KIỂM TRA (tuỳ chọn — chạy riêng từng câu trong SQL Editor) ----------
-- (a) Tổng giờ theo dự án × giai đoạn: bảng phẳng phải khớp artius_usage() (cột all_hours / sent_hours).
--   select project_id, phase_id, sum(gio) as all_hours, sum(gio) filter (where da_gui) as sent_hours
--     from public.artius_hours group by 1, 2 order by 1, 2;
-- (b) Mỗi (người, tháng) trong artius_ts có giờ thì phải có dòng ở bảng phẳng — câu này phải ra 0 dòng:
--   select t.emp_id, t.ym from public.artius_ts t
--    where t.value like '%"days"%' and not exists (select 1 from public.artius_hours h where h.emp_id = t.emp_id and h.ym = t.ym)
--      and exists (select 1 from jsonb_array_elements(coalesce(t.value::jsonb -> 'rows', '[]')) rw,
--                         jsonb_each(coalesce(rw -> 'days', '{}')) d where jsonb_typeof(d.value) = 'number' and (d.value #>> '{}')::numeric > 0);
-- (c) Giờ theo vai trò theo tháng (ví dụ cách đọc mới):
--   select ym, vai_tro, sum(gio) from public.artius_hours where da_gui group by 1, 2 order by 1, 2;
