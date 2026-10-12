-- ARTIUS — Quản lý giờ công v2.1
-- Chạy trong Supabase → SQL Editor. Chạy lại nhiều lần được, không xoá dữ liệu.
-- Nâng cấp từ v1.7, v1.8, v1.9 hoặc v2.0: chạy nguyên file này MỘT LẦN, ngay trước khi deploy bản v2.1.
-- (v2.1 thêm mục 9: hàm artius_usage tính tổng giờ toàn bộ dữ liệu cho tab Dự án và tab Thiết lập.)
-- File này tự làm hai việc chuyển dữ liệu, mỗi việc chỉ chạy đúng một lần:
--   mục 5: chép dữ liệu từ bảng cũ (artius_kv) sang hai bảng mới (nếu chưa chép ở v1.8)
--   mục 6: đánh dấu "đã gửi" cho mọi ngày cũ đang có giờ công

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
  value      text not null,               -- JSON: { rows, sent, weeks }  (sent: ngày đã gửi; weeks: dấu tuần kiểu cũ)
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

-- 6. v1.9 — Coi như ĐÃ GỬI mọi ngày cũ đang có giờ công.
--    Từ v1.9 quản lý chỉ tổng hợp giờ của NGÀY đã gửi (value.sent['YYYY-MM-DD']); không làm bước này thì
--    số liệu cũ sẽ biến mất khỏi Dashboard. Chỉ chạy MỘT LẦN (ghi dấu vào artius_meta), để chạy lại file này
--    về sau không đánh dấu nhầm những ngày quản lý đã mở khoá.
--    Nếu trước đó đã dùng bản v1.9 khoá theo tuần (có dấu 'sent_migration_v1_9'): chỉ đánh dấu các ngày thuộc
--    tuần đang có dấu đã gửi, tuần quản lý đang mở khoá thì giữ nguyên là chưa gửi.
create table if not exists public.artius_meta (
  key   text primary key,
  value text not null,
  at    timestamptz not null default now()
);

do $$
declare
  stamp     jsonb;
  week_mode boolean;
begin
  if exists (select 1 from public.artius_meta where key = 'sent_day_migration_v1_9') then
    return;
  end if;
  week_mode := exists (select 1 from public.artius_meta where key = 'sent_migration_v1_9');
  stamp := jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', 'migrate');

  update public.artius_ts t
  set value = jsonb_set(t.value::jsonb, '{sent}',
        coalesce(case when jsonb_typeof(t.value::jsonb -> 'sent') = 'object' then t.value::jsonb -> 'sent' end, '{}'::jsonb) || x.add,
        true)::text
  from (
    select t2.emp_id, t2.ym, jsonb_object_agg(d.key, stamp) as add
    from public.artius_ts t2,
         jsonb_array_elements(case when jsonb_typeof(t2.value::jsonb -> 'rows') = 'array' then t2.value::jsonb -> 'rows' else '[]'::jsonb end) as rw,
         jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
    where d.key ~ '^\d{4}-\d{2}-\d{2}$'
      and jsonb_typeof(d.value) = 'number'
      and (d.value #>> '{}')::numeric > 0
      and not (coalesce(case when jsonb_typeof(t2.value::jsonb -> 'sent') = 'object' then t2.value::jsonb -> 'sent' end, '{}'::jsonb) ? d.key)
      and (not week_mode
           or coalesce(case when jsonb_typeof(t2.value::jsonb -> 'weeks') = 'object' then t2.value::jsonb -> 'weeks' end, '{}'::jsonb)
              ? to_char(date_trunc('week', d.key::date), 'YYYY-MM-DD'))
    group by t2.emp_id, t2.ym
  ) as x
  where t.emp_id = x.emp_id and t.ym = x.ym;

  insert into public.artius_meta (key, value) values ('sent_day_migration_v1_9', 'done');
end $$;

-- 7. v1.9 — Khoá cứng NGÀY đã gửi, do database thực thi.
--    Giờ của một ngày trong một dòng bảng công, đưa về dạng chuẩn để so sánh trước/sau.
drop function if exists public.artius_week_hours(jsonb, date);
create or replace function public.artius_day_hours(bucket jsonb, d text)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(s.x order by s.x), '[]'::jsonb)
  from (
    select jsonb_build_array(
             coalesce(rw ->> 'projectId', ''),
             coalesce(nullif(rw ->> 'phaseId', ''), 'P2'),     -- app coi dòng chưa có giai đoạn là P2
             coalesce(rw ->> 'taskId', ''),
             (rw -> 'days' -> d #>> '{}')::numeric) as x
    from jsonb_array_elements(case when jsonb_typeof(bucket -> 'rows') = 'array' then bucket -> 'rows' else '[]'::jsonb end) as rw
    where case when jsonb_typeof(rw -> 'days') = 'object' and jsonb_typeof(rw -> 'days' -> d) = 'number'
               then (rw -> 'days' -> d #>> '{}')::numeric > 0
               else false end
  ) as s;
$$;

--    Giờ của MỘT DỰ ÁN trong một dòng bảng công (mọi ngày), dạng chuẩn để so sánh trước/sau.
create or replace function public.artius_proj_hours(bucket jsonb, pid text)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(s.x order by s.x), '[]'::jsonb)
  from (
    select jsonb_build_array(
             coalesce(nullif(rw ->> 'phaseId', ''), 'P2'),
             coalesce(rw ->> 'taskId', ''),
             d.key,
             (d.value #>> '{}')::numeric) as x
    from jsonb_array_elements(case when jsonb_typeof(bucket -> 'rows') = 'array' then bucket -> 'rows' else '[]'::jsonb end) as rw,
         jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
    where rw ->> 'projectId' = pid
      and case when jsonb_typeof(d.value) = 'number' then (d.value #>> '{}')::numeric > 0 else false end
  ) as s;
$$;

--    Chạy trước mỗi lần thêm / sửa / xoá một dòng bảng công.
--    Tài khoản quản lý (và SQL Editor, hàm server) được làm mọi thứ. Nhân sự thì:
--      · không gỡ được dấu "đã gửi" của ngày nào
--      · không đổi được giờ của ngày đã gửi (kể cả thêm giờ dự án khác vào ngày đó)
--      · không xoá được dòng bảng công đang có ngày đã gửi
--      · không thêm / sửa / xoá được giờ của dự án ĐÃ ĐÓNG (active = false trong artius_config);
--        cần chấm thêm thì quản lý mở lại dự án
--    Ngày chưa gửi thì nhân sự nhập và gửi bình thường.
--    Hàm này cũng ghi updated_at theo giờ của server, để màn hình quản lý hỏi "có gì mới từ lúc X" cho chính xác.
create or replace function public.artius_ts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o  jsonb;
  n  jsonb;
  os jsonb;
  dk text;
  pid text;
begin
  if auth.uid() is not null and not public.artius_is_admin() then
    o  := case when tg_op = 'INSERT' then '{}'::jsonb else old.value::jsonb end;
    os := case when jsonb_typeof(o -> 'sent') = 'object' then o -> 'sent' else '{}'::jsonb end;
    if tg_op = 'DELETE' then
      if os <> '{}'::jsonb then
        raise exception 'Bảng công có ngày đã gửi, chỉ quản lý mới xoá được.' using errcode = '42501';
      end if;
      n := '{}'::jsonb;
    else
      n := new.value::jsonb;
    end if;
    for dk in select jsonb_object_keys(os) loop
      if not (coalesce(case when jsonb_typeof(n -> 'sent') = 'object' then n -> 'sent' end, '{}'::jsonb) ? dk) then
        raise exception 'Ngày % đã gửi và đang khoá. Chỉ quản lý mới mở khoá được.', dk using errcode = '42501';
      end if;
      if public.artius_day_hours(o, dk) is distinct from public.artius_day_hours(n, dk) then
        raise exception 'Ngày % đã gửi và đang khoá, không sửa giờ được. Nhờ quản lý mở khoá.', dk using errcode = '42501';
      end if;
    end loop;
    -- dự án đã đóng: giờ của dự án đó trong dòng này phải giữ nguyên
    for pid in
      select pr ->> 'id'
      from public.artius_config c,
           jsonb_array_elements(case when jsonb_typeof(c.value::jsonb -> 'projects') = 'array' then c.value::jsonb -> 'projects' else '[]'::jsonb end) as pr
      where c.id = 'main' and pr -> 'active' = 'false'::jsonb
    loop
      if public.artius_proj_hours(o, pid) is distinct from public.artius_proj_hours(n, pid) then
        raise exception 'Dự án này đã đóng, không chấm công được nữa. Nhờ quản lý mở lại dự án.' using errcode = '42501';
      end if;
    end loop;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists artius_ts_guard on public.artius_ts;
create trigger artius_ts_guard
  before insert or update or delete on public.artius_ts
  for each row execute function public.artius_ts_guard();

create index if not exists artius_ts_updated_at on public.artius_ts (updated_at);

-- 8. Phân quyền
alter table public.artius_meta     enable row level security;
revoke all on public.artius_meta from anon, authenticated;
grant all on public.artius_meta to service_role;

alter table public.artius_accounts enable row level security;
alter table public.artius_kv       enable row level security;
alter table public.artius_config   enable row level security;
alter table public.artius_ts       enable row level security;

-- 8a. Bảng tài khoản: không policy nào, chỉ service_role dùng được
revoke all on public.artius_accounts from anon, authenticated;
grant all on public.artius_accounts to service_role;

-- 8b. Bảng cũ: chỉ còn đọc. Bản v1.7 nào còn mở trên máy nhân viên sẽ báo lỗi khi lưu
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

-- 8c. Thiết lập: mọi tài khoản hợp lệ đọc được, chỉ tài khoản quản lý sửa được
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

-- 8d. Bảng công: nhân sự chỉ đọc/ghi dòng của chính mình; tài khoản quản lý đọc/ghi tất cả
revoke all on public.artius_ts from anon, authenticated;
grant select, insert, update, delete on public.artius_ts to authenticated;
grant all on public.artius_ts to service_role;
drop policy if exists "artius_ts_own_or_admin" on public.artius_ts;
create policy "artius_ts_own_or_admin" on public.artius_ts
  for all to authenticated
  using ((select public.artius_is_admin()) or emp_id = (select public.artius_my_emp()))
  with check ((select public.artius_is_admin()) or emp_id = (select public.artius_my_emp()));

-- 9. v2.1 — Tổng giờ theo dự án × giai đoạn trên TOÀN BỘ bảng công.
--    App chỉ tải sẵn 6 tháng gần nhất, nên con số "từ trước tới nay" (tab Dự án, tab Thiết lập → Giai đoạn) hỏi hàm này.
--    sent_hours = giờ của ngày đã gửi; all_hours = mọi giờ đang lưu. Chỉ tài khoản quản lý nhận được số liệu.
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
  where public.artius_is_admin()
    and jsonb_typeof(d.value) = 'number'
    and (d.value #>> '{}')::numeric > 0
  group by 1, 2;
$$;
revoke all on function public.artius_usage() from public, anon;
grant execute on function public.artius_usage() to authenticated, service_role;
