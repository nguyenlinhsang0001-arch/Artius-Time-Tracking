-- ARTIUS TIME v12.25 — Trưởng phòng xem được Dashboard › Dự án và Ma trận.
--
-- Ma trận đọc thẳng bảng artius_ts nên policy cũ đã cho trưởng phòng đọc được (chính mình + phòng mình),
-- KHÔNG cần file này. File này chỉ để tab "Dự án" (Tiến độ dự án) có số.
--
-- Hai hàm dưới đây đang chặn bằng artius_view_all() = access in ('admin','bod').
-- Vì đó là điều kiện WHERE chứ không phải RAISE, trưởng phòng gọi vào KHÔNG báo lỗi mà nhận về RỖNG,
-- nên màn Tiến độ dự án hiện đủ dự án với giờ đã dùng = 0 — trông như app hỏng.
-- Sửa: thêm 'head' vào phạm vi xem của riêng hai hàm tổng hợp này.
--
-- LƯU Ý PHẠM VI: hai hàm trả số của TOÀN CÔNG TY. Sau khi chạy file này, trưởng phòng thấy được
-- giờ và ngân sách của MỌI dự án, kể cả dự án phòng họ không tham gia. Không muốn vậy thì đừng chạy file này;
-- tab Ma trận vẫn chạy đúng, chỉ tab Dự án là trống.
--
-- Chạy một lần trên Supabase → SQL Editor. Chạy lại nhiều lần không sao (create or replace).
-- Không đụng tới artius_view_all(), nên quyền đọc bảng công và mọi hàm khác giữ nguyên y như cũ.

create or replace function public.artius_view_agg()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.artius_accounts a
    where a.id = auth.uid() and not a.disabled and a.access in ('admin', 'bod', 'head')
  );
$$;
revoke all on function public.artius_view_agg() from public, anon;
grant execute on function public.artius_view_agg() to authenticated, service_role;

-- ---------- artius_usage ----------
create or replace function public.artius_usage()
returns table (project_id text, phase_id text, sent_hours numeric, all_hours numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(rw ->> 'projectId', '') as project_id,
         coalesce(nullif(rw ->> 'phaseId', ''), 'P2') as phase_id,
         sum(case when coalesce(case when jsonb_typeof(v.j -> 'sent') = 'object' then v.j -> 'sent' end, '{}'::jsonb) ? d.key
                  then (d.value #>> '{}')::numeric else 0 end) as sent_hours,
         sum((d.value #>> '{}')::numeric) as all_hours
  from public.artius_ts t
       cross join lateral (select t.value::jsonb as j) as v
       cross join lateral jsonb_array_elements(case when jsonb_typeof(v.j -> 'rows') = 'array' then v.j -> 'rows' else '[]'::jsonb end) as rw
       cross join lateral jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
  where public.artius_view_agg()   -- v12.25: Admin, BOD và Trưởng phòng
    and jsonb_typeof(d.value) = 'number'
    and (d.value #>> '{}')::numeric > 0
  group by 1, 2;
$$;

-- ---------- artius_phase_detail ----------
create or replace function public.artius_phase_detail()
returns jsonb
language sql stable security definer set search_path = public as $$
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
    where public.artius_view_agg()   -- v12.25: Admin, BOD và Trưởng phòng
      and coalesce(rw ->> 'projectId', '') not in ('', '__none__')
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

-- Giữ nguyên quyền gọi như cũ (create or replace vốn không làm mất grant; ghi lại cho chắc).
revoke all on function public.artius_usage() from public, anon;
grant execute on function public.artius_usage() to authenticated, service_role;
revoke all on function public.artius_phase_detail() from public, anon;
grant execute on function public.artius_phase_detail() to authenticated, service_role;
