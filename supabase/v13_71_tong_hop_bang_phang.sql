-- ARTIUS TIME v13.71 — Vòng 4, bước 1: hai hàm tổng hợp giờ đọc bảng giờ phẳng artius_hours.
-- Sửa ở v13.74 (R10): artius_phase_detail_flat chỉ nhận tăng ca theo khung otBands (bỏ dò tên "[OT]" và otLegacy).
--   Database đang chạy: chạy lại TOÀN BỘ file này một lần. Cổng ở mục 3 tự so với cách cũ — lệch thì không thay gì.
--
-- artius_usage()        → tab Dự án, Thiết lập › Giai đoạn (tổng giờ từ trước tới nay)
-- artius_phase_detail() → Dashboard › Tiến độ dự án (theo tuần / người / tác vụ / tăng ca)
-- Trước: mỗi lần gọi bung JSON của MỌI bảng công. Nay: cộng thẳng trên artius_hours (đã bung sẵn, có index).
-- Kết quả trả về cho app GIỐNG HỆT — app không sửa gì ở phần gọi hàm.
--
-- CỔNG AN TOÀN: file tự so kết quả cách cũ (bung JSON) với cách mới (bảng phẳng) trên dữ liệu thật.
--   · Khớp  → thay hai hàm, in ra "ĐÃ CHUYỂN".
--   · Lệch  → DỪNG với lỗi "artius_hours lệch …" — hai hàm app gọi ở lại cách cũ (mục 1b), số y như trước.
--             Khi đó: Thiết lập › Sao lưu › "Dựng lại bảng giờ" rồi chạy lại file này.
--
-- Cách cũ được giữ dưới tên artius_usage_json / artius_phase_detail_json (không ai gọi được từ app) để so và để quay lại.
-- QUAY LẠI cách cũ nếu cần (chạy trong SQL Editor):
--   create or replace function public.artius_usage() returns table (project_id text, phase_id text, sent_hours numeric, all_hours numeric)
--     language sql stable security definer set search_path = public as $q$ select * from public.artius_usage_json() where public.artius_view_agg() $q$;
--   create or replace function public.artius_phase_detail() returns jsonb
--     language sql stable security definer set search_path = public as $q$ select case when public.artius_view_agg() then public.artius_phase_detail_json() else '{}'::jsonb end $q$;
--
-- Cần đã chạy: v12_25_truongphong_dashboard.sql (artius_view_agg) và v13_69_bang_gio.sql (artius_hours).
-- Chạy MỘT lần trên Supabase → SQL Editor. Chạy lại nhiều lần không sao.

-- ---------- 1. Cách cũ (bung JSON từ artius_ts) — chỉ để so và để quay lại ----------
-- Thân hàm chép nguyên từ bản v12.25, chỉ bỏ điều kiện quyền (quyền kiểm ở hàm công khai bên dưới).
create or replace function public.artius_usage_json()
returns table (project_id text, phase_id text, sent_hours numeric, all_hours numeric)
language sql stable set search_path = public as $$
  select coalesce(rw ->> 'projectId', '') as project_id,
         coalesce(nullif(rw ->> 'phaseId', ''), 'P2') as phase_id,
         sum(case when coalesce(case when jsonb_typeof(v.j -> 'sent') = 'object' then v.j -> 'sent' end, '{}'::jsonb) ? d.key
                  then (d.value #>> '{}')::numeric else 0 end) as sent_hours,
         sum((d.value #>> '{}')::numeric) as all_hours
  from public.artius_ts t
       cross join lateral (select t.value::jsonb as j) as v
       cross join lateral jsonb_array_elements(case when jsonb_typeof(v.j -> 'rows') = 'array' then v.j -> 'rows' else '[]'::jsonb end) as rw
       cross join lateral jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
  where jsonb_typeof(d.value) = 'number'
    and (d.value #>> '{}')::numeric > 0
  group by 1, 2;
$$;

create or replace function public.artius_phase_detail_json()
returns jsonb
language sql stable set search_path = public as $$
  with x as (
    select coalesce(rw ->> 'projectId', '') || '|' || coalesce(nullif(rw ->> 'phaseId', ''), 'P2') as k,
           t.emp_id,
           coalesce(rw ->> 'taskId', '') as task_id,
           coalesce(rw ->> 'otFor', '') as ot_for,
           d.key::date as day,
           (d.value #>> '{}')::numeric as h
    from public.artius_ts t
         cross join lateral (select t.value::jsonb as j) as v
         cross join lateral jsonb_array_elements(case when jsonb_typeof(v.j -> 'rows') = 'array' then v.j -> 'rows' else '[]'::jsonb end) as rw
         cross join lateral jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
    where coalesce(rw ->> 'projectId', '') not in ('', '__none__')
      and d.key ~ '^\d{4}-\d{2}-\d{2}$'
      and jsonb_typeof(d.value) = 'number'
      and (d.value #>> '{}')::numeric > 0
      and coalesce(case when jsonb_typeof(v.j -> 'sent') = 'object' then v.j -> 'sent' end, '{}'::jsonb) ? d.key
  ),
  w as (select k, jsonb_object_agg(wk, h) as o from (select k, to_char(date_trunc('week', day), 'YYYY-MM-DD') as wk, sum(h) as h from x group by 1, 2) a group by k),
  e as (select k, jsonb_object_agg(emp_id, h) as o from (select k, emp_id, sum(h) as h from x group by 1, 2) a group by k),
  tk as (select k, jsonb_object_agg(task_id, h) as o from (select k, task_id, sum(h) as h from x group by 1, 2) a group by k),
  et as (select k, jsonb_object_agg(emp_id, o) as o
         from (select k, emp_id, jsonb_object_agg(tko, h) as o
               from (select k, emp_id, task_id || '|' || ot_for as tko, sum(h) as h from x group by 1, 2, 3) a group by 1, 2) b
         group by k),
  r as (select k, min(day) as first, max(day) as last from x group by k),
  cf as (select coalesce((select c.value::jsonb from public.artius_config c where c.id = 'main'), '{}'::jsonb) as j),
  otid as (select tt ->> 'id' as id
           from cf, jsonb_array_elements(case when jsonb_typeof(cf.j -> 'tasks') = 'array' then cf.j -> 'tasks' else '[]'::jsonb end) as tt
           where coalesce(tt ->> 'name', '') ~* '^\s*\[\s*ot\s*\]'
           -- v6.5: khung tăng ca chung (v6.3+) và mã hạng mục [OT] cũ đã chuyển sang khung
           union
           select ob ->> 'id' from cf, jsonb_array_elements(case when jsonb_typeof(cf.j -> 'otBands') = 'array' then cf.j -> 'otBands' else '[]'::jsonb end) as ob
           union
           select lk from cf, jsonb_object_keys(case when jsonb_typeof(cf.j -> 'otLegacy') = 'object' then cf.j -> 'otLegacy' else '{}'::jsonb end) as lk),
  hol as (select coalesce(hd ->> 'date', '') as dt, coalesce((hd ->> 'yearly')::boolean, false) as yearly
          from cf, jsonb_array_elements(case when jsonb_typeof(cf.j -> 'holidays') = 'array' then cf.j -> 'holidays' else '[]'::jsonb end) as hd),
  ot as (select k, jsonb_object_agg(ok, h) as o
         from (select k,
                      task_id || '|' || ot_for || '|' ||
                        case when exists (select 1 from hol where hol.dt = to_char(day, 'YYYY-MM-DD')
                                                             or (hol.yearly and substr(hol.dt, 6) = to_char(day, 'MM-DD'))) then 'h'
                             when extract(isodow from day) = 7 then 's' else 'n' end as ok,
                      sum(h) as h
               from x where task_id in (select id from otid) group by 1, 2) a
         group by k)
  select coalesce(jsonb_object_agg(r.k, jsonb_build_object('w', w.o, 'e', e.o, 't', tk.o, 'o', coalesce(ot.o, '{}'::jsonb), 'et', coalesce(et.o, '{}'::jsonb),
                                                           'first', to_char(r.first, 'YYYY-MM-DD'), 'last', to_char(r.last, 'YYYY-MM-DD'))), '{}'::jsonb)
  from r join w using (k) join e using (k) join tk using (k) left join ot using (k) left join et using (k);
$$;

-- ---------- 1b. Trong lúc thay: hai hàm app gọi tạm chạy cách cũ ----------
-- Chạy lại file này trên database đã chuyển (vd v13.74) thì mục 2 sửa bản _flat TRƯỚC khi cổng ở mục 3 kịp so.
-- Nên trước hết trỏ hai hàm app gọi về cách cũ: cổng lệch thì app vẫn chạy cách cũ (số y như trước), không dính bản mới chưa kiểm.
create or replace function public.artius_usage()
returns table (project_id text, phase_id text, sent_hours numeric, all_hours numeric)
language sql stable security definer set search_path = public as $$
  select * from public.artius_usage_json() where public.artius_view_agg();
$$;
create or replace function public.artius_phase_detail()
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.artius_view_agg() then public.artius_phase_detail_json() else '{}'::jsonb end;
$$;

-- ---------- 2. Cách mới (đọc artius_hours) ----------
-- artius_hours chỉ chứa ô giờ > 0, ngày dạng YYYY-MM-DD, phase trống đã thành 'P2' — đúng các điều kiện của cách cũ.
create or replace function public.artius_usage_flat()
returns table (project_id text, phase_id text, sent_hours numeric, all_hours numeric)
language sql stable set search_path = public as $$
  select h.project_id, h.phase_id,
         coalesce(sum(h.gio) filter (where h.da_gui), 0) as sent_hours,
         sum(h.gio) as all_hours
  from public.artius_hours h
  group by 1, 2;
$$;

create or replace function public.artius_phase_detail_flat()
returns jsonb
language sql stable set search_path = public as $$
  with x as (
    select h.project_id || '|' || h.phase_id as k,
           h.emp_id, h.task_id, h.ot_for,
           h.ngay as day,
           h.gio as h
    from public.artius_hours h
    where h.project_id not in ('', '__none__')
      and h.da_gui
  ),
  w as (select k, jsonb_object_agg(wk, h) as o from (select k, to_char(date_trunc('week', day), 'YYYY-MM-DD') as wk, sum(h) as h from x group by 1, 2) a group by k),
  e as (select k, jsonb_object_agg(emp_id, h) as o from (select k, emp_id, sum(h) as h from x group by 1, 2) a group by k),
  tk as (select k, jsonb_object_agg(task_id, h) as o from (select k, task_id, sum(h) as h from x group by 1, 2) a group by k),
  et as (select k, jsonb_object_agg(emp_id, o) as o
         from (select k, emp_id, jsonb_object_agg(tko, h) as o
               from (select k, emp_id, task_id || '|' || ot_for as tko, sum(h) as h from x group by 1, 2, 3) a group by 1, 2) b
         group by k),
  r as (select k, min(day) as first, max(day) as last from x group by k),
  cf as (select coalesce((select c.value::jsonb from public.artius_config c where c.id = 'main'), '{}'::jsonb) as j),
  -- v13.74 (R10): dòng tăng ca = mã một khung trong otBands, không còn dò tên "[OT]" hay bảng đổi mã cũ otLegacy.
  -- Cổng ở mục 3 so với cách cũ (artius_phase_detail_json, vẫn dò đủ ba đường): còn dòng giờ nào dùng đường cũ thì sẽ lệch → dừng.
  otid as (select ob ->> 'id' as id from cf, jsonb_array_elements(case when jsonb_typeof(cf.j -> 'otBands') = 'array' then cf.j -> 'otBands' else '[]'::jsonb end) as ob),
  hol as (select coalesce(hd ->> 'date', '') as dt, coalesce((hd ->> 'yearly')::boolean, false) as yearly
          from cf, jsonb_array_elements(case when jsonb_typeof(cf.j -> 'holidays') = 'array' then cf.j -> 'holidays' else '[]'::jsonb end) as hd),
  ot as (select k, jsonb_object_agg(ok, h) as o
         from (select k,
                      task_id || '|' || ot_for || '|' ||
                        case when exists (select 1 from hol where hol.dt = to_char(day, 'YYYY-MM-DD')
                                                             or (hol.yearly and substr(hol.dt, 6) = to_char(day, 'MM-DD'))) then 'h'
                             when extract(isodow from day) = 7 then 's' else 'n' end as ok,
                      sum(h) as h
               from x where task_id in (select id from otid) group by 1, 2) a
         group by k)
  select coalesce(jsonb_object_agg(r.k, jsonb_build_object('w', w.o, 'e', e.o, 't', tk.o, 'o', coalesce(ot.o, '{}'::jsonb), 'et', coalesce(et.o, '{}'::jsonb),
                                                           'first', to_char(r.first, 'YYYY-MM-DD'), 'last', to_char(r.last, 'YYYY-MM-DD'))), '{}'::jsonb)
  from r join w using (k) join e using (k) join tk using (k) left join ot using (k) left join et using (k);
$$;

revoke all on function public.artius_usage_json()         from public, anon, authenticated;
revoke all on function public.artius_phase_detail_json()  from public, anon, authenticated;
revoke all on function public.artius_usage_flat()         from public, anon, authenticated;
revoke all on function public.artius_phase_detail_flat()  from public, anon, authenticated;

-- ---------- 3. Cổng: so hai cách trên dữ liệu thật ----------
do $$
declare
  n_usage int;
  same_detail boolean;
begin
  select count(*) into n_usage from (
    (select project_id, phase_id, sent_hours, all_hours from public.artius_usage_json()
     except select project_id, phase_id, sent_hours, all_hours from public.artius_usage_flat())
    union all
    (select project_id, phase_id, sent_hours, all_hours from public.artius_usage_flat()
     except select project_id, phase_id, sent_hours, all_hours from public.artius_usage_json())
  ) d;
  same_detail := public.artius_phase_detail_json() = public.artius_phase_detail_flat();
  if n_usage > 0 or not same_detail then
    raise exception 'artius_hours lệch cách cũ (artius_usage: % dòng khác, artius_phase_detail: %). Chưa thay hàm nào. Bấm "Dựng lại bảng giờ" rồi chạy lại file.',
      n_usage, case when same_detail then 'khớp' else 'KHÁC' end;
  end if;
  raise notice 'Hai cách khớp nhau — chuyển hai hàm sang bảng giờ phẳng.';
end $$;

-- ---------- 4. Hai hàm app đang gọi: kiểm quyền rồi đọc cách mới ----------
-- Quyền giữ y như v12.25: Admin, BOD và Trưởng phòng (artius_view_agg); người khác nhận rỗng.
create or replace function public.artius_usage()
returns table (project_id text, phase_id text, sent_hours numeric, all_hours numeric)
language sql stable security definer set search_path = public as $$
  select * from public.artius_usage_flat() where public.artius_view_agg();
$$;

create or replace function public.artius_phase_detail()
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.artius_view_agg() then public.artius_phase_detail_flat() else '{}'::jsonb end;
$$;

revoke all on function public.artius_usage() from public, anon;
grant execute on function public.artius_usage() to authenticated, service_role;
revoke all on function public.artius_phase_detail() from public, anon;
grant execute on function public.artius_phase_detail() to authenticated, service_role;

notify pgrst, 'reload schema';
select 'ĐÃ CHUYỂN: artius_usage và artius_phase_detail đọc artius_hours' as ket_qua;
