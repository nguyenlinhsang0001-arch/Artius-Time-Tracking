-- ARTIUS — Quản lý giờ công v3.1
-- Chạy trong Supabase → SQL Editor. Chạy lại nhiều lần được, không xoá dữ liệu.
-- Nâng cấp từ bất kỳ bản v1.7 → v3.0: chạy nguyên file này MỘT LẦN, ngay trước khi deploy bản v3.1.
-- (Lịch gửi nhắc nhở nằm riêng ở supabase/cron.sql — chạy sau file này, xem README.)
-- (v5.6 sửa mục 14: artius_phase_detail trả thêm "et" — giờ theo nhân sự × tác vụ, cho thẻ tác vụ khi rê chuột vào tên nhân sự.)
-- (v4.7 thêm mục 14: hàm artius_phase_detail — chi tiết theo tuần / nhân sự / tác vụ của từng giai đoạn cho Dashboard.)
-- (v2.1 thêm mục 9: hàm artius_usage tính tổng giờ toàn bộ dữ liệu cho tab Dự án và tab Thiết lập.)
-- (v3.1 sửa mục 7c: nhân sự chấm được giai đoạn quản lý đang MỞ (project.phaseOpen); dự án chưa đặt mở/đóng thì theo giờ dự kiến như cũ.)
-- (v2.9 sửa mục 7c: dòng "Khác" (projectId '__none__': tác vụ chung + vắng mặt) không cần giờ dự kiến.)
-- (v2.6 thêm mục 13: thông báo nhắc nộp bảng công trên máy tính — bảng thiết bị nhận và nhật ký đã gửi.)
-- (v2.5 thêm mục 7c: nhân sự chỉ chấm vào giai đoạn đã có giờ dự kiến của dự án.)
-- (v2.4 thêm mục 12: khoá các hàm tính toán với người chưa đăng nhập.)
-- (v2.3 thêm mục 7b: nhân sự không chấm giờ làm việc cho ngày chưa tới; mục 10: gỡ mã PIN cũ khỏi thiết lập dùng chung.)
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

-- 7b. v2.3 — Giờ LÀM VIỆC (không tính vắng mặt, mã tác vụ bắt đầu bằng LV_) của các ngày SAU hôm nay
--     trong một dòng bảng công, dạng chuẩn để so sánh trước/sau. "Hôm nay" tính theo giờ Việt Nam.
create or replace function public.artius_future_work(bucket jsonb, today date)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(s.x order by s.x), '[]'::jsonb)
  from (
    select jsonb_build_array(
             coalesce(rw ->> 'projectId', ''),
             coalesce(nullif(rw ->> 'phaseId', ''), 'P2'),
             coalesce(rw ->> 'taskId', ''),
             coalesce(rw ->> 'otFor', ''),   -- v4.9: dòng tăng ca gắn tác vụ
             d.key,
             (d.value #>> '{}')::numeric) as x
    from jsonb_array_elements(case when jsonb_typeof(bucket -> 'rows') = 'array' then bucket -> 'rows' else '[]'::jsonb end) as rw,
         jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
    where coalesce(rw ->> 'taskId', '') not like 'LV\_%'
      and d.key ~ '^\d{4}-\d{2}-\d{2}$'
      and d.key::date > today
      and case when jsonb_typeof(d.value) = 'number' then (d.value #>> '{}')::numeric > 0 else false end
  ) as s;
$$;

-- 7c. v2.5 — Giờ của các dòng rơi vào giai đoạn CHƯA CÓ giờ dự kiến (budgets[phase] trống hoặc 0) của dự án,
--     dạng chuẩn để so sánh trước/sau. Bỏ qua dòng vắng mặt (tác vụ LV_…, không thuộc dự án).
--     Dự án không còn trong thiết lập cũng tính là chưa có giờ dự kiến.
create or replace function public.artius_unbudgeted_hours(bucket jsonb, cfg jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(s.x order by s.x), '[]'::jsonb)
  from (
    select jsonb_build_array(
             coalesce(rw ->> 'projectId', ''),
             coalesce(nullif(rw ->> 'phaseId', ''), 'P2'),
             coalesce(rw ->> 'taskId', ''),
             coalesce(rw ->> 'otFor', ''),   -- v4.9: dòng tăng ca gắn tác vụ
             d.key,
             (d.value #>> '{}')::numeric) as x
    from jsonb_array_elements(case when jsonb_typeof(bucket -> 'rows') = 'array' then bucket -> 'rows' else '[]'::jsonb end) as rw,
         jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
    where coalesce(rw ->> 'taskId', '') not like 'LV\_%'
      and coalesce(rw ->> 'projectId', '') <> '__none__'      -- v2.9: "Khác" không thuộc dự án nào
      and case when jsonb_typeof(d.value) = 'number' then (d.value #>> '{}')::numeric > 0 else false end
      and not exists (
        select 1
        from jsonb_array_elements(case when jsonb_typeof(cfg -> 'projects') = 'array' then cfg -> 'projects' else '[]'::jsonb end) as pr
        where pr ->> 'id' = rw ->> 'projectId'
          and case
                -- v3.1: quản lý đã đặt mở/đóng từng giai đoạn
                when jsonb_typeof(pr -> 'phaseOpen') = 'object'
                  then coalesce(pr -> 'phaseOpen' -> coalesce(nullif(rw ->> 'phaseId', ''), 'P2') = 'true'::jsonb, false)
                -- chưa đặt: giai đoạn có giờ dự kiến > 0 coi như đang mở (luật v2.5)
                when jsonb_typeof(pr -> 'budgets' -> coalesce(nullif(rw ->> 'phaseId', ''), 'P2')) = 'number'
                  then (pr -> 'budgets' ->> coalesce(nullif(rw ->> 'phaseId', ''), 'P2'))::numeric > 0
                else false end
      )
  ) as s;
$$;

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
             coalesce(rw ->> 'otFor', ''),   -- v4.9: dòng tăng ca gắn tác vụ
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
             coalesce(rw ->> 'otFor', ''),   -- v4.9: dòng tăng ca gắn tác vụ
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
--      · (v2.3) không thêm / sửa giờ làm việc cho ngày SAU hôm nay; vắng mặt thì đăng ký trước được
--      · (v2.5) không thêm / sửa / xoá giờ ở giai đoạn chưa có giờ dự kiến của dự án
--    Ngày chưa gửi thì nhân sự nhập và gửi bình thường.
--    Hàm này cũng ghi updated_at theo giờ của server, để màn hình quản lý hỏi "có gì mới từ lúc X" cho chính xác.
create or replace function public.artius_ts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o  jsonb;
  n  jsonb;
  os jsonb;
  cf jsonb;
  dk text;
  pid text;
begin
  if auth.uid() is not null and not public.artius_is_admin() then
    /* v3.4 — App ghi bằng upsert (INSERT … ON CONFLICT DO UPDATE). Postgres chạy trigger BEFORE INSERT trước khi biết
       dòng đã tồn tại, nên ở bước INSERT phải lấy bản đang có trên server làm "bản cũ"; nếu coi là rỗng thì giờ sẵn có
       ở ngày chưa tới / dự án đã đóng / giai đoạn chưa mở bị hiểu nhầm là vừa thêm và bị chặn sai. */
    o  := case when tg_op = 'INSERT'
               then coalesce((select t.value::jsonb from public.artius_ts t where t.emp_id = new.emp_id and t.ym = new.ym), '{}'::jsonb)
               else old.value::jsonb end;
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
    -- v2.3: ngày chưa tới chỉ được đăng ký vắng mặt, không chấm giờ làm việc
    if tg_op <> 'DELETE' and public.artius_future_work(o, (now() at time zone 'Asia/Ho_Chi_Minh')::date)
         is distinct from public.artius_future_work(n, (now() at time zone 'Asia/Ho_Chi_Minh')::date) then
      raise exception 'Chưa tới ngày, chưa chấm giờ làm việc được. Vắng mặt thì vẫn đăng ký trước được.' using errcode = '42501';
    end if;
    -- v2.5: giai đoạn chưa có giờ dự kiến của dự án thì nhân sự không chấm vào được
    select c.value::jsonb into cf from public.artius_config c where c.id = 'main';
    if cf is not null and public.artius_unbudgeted_hours(o, cf) is distinct from public.artius_unbudgeted_hours(n, cf) then
      raise exception 'Giai đoạn này của dự án đang đóng, chưa chấm công được. Nhờ quản lý mở giai đoạn.' using errcode = '42501';
    end if;
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

-- 8b. Bảng cũ artius_kv (dữ liệu trước v1.8).
--     v4.3: KHOÁ HẲN với mọi tài khoản đăng nhập. Trước đây ai đăng nhập cũng đọc được bảng này, mà trong đó còn
--     khối dữ liệu cũ gồm bảng công của MỌI người và mã PIN quản lý cũ -> nhân viên xem được giờ công người khác.
--     Từ v1.8 app không còn đọc bảng này. Dữ liệu cũ KHÔNG bị xoá: chỉ service_role (hàm server /api/accounts,
--     Supabase dashboard) đọc được.
revoke all on public.artius_kv from anon, authenticated;
grant all on public.artius_kv to service_role;
drop policy if exists "artius_kv_anon_all" on public.artius_kv;
drop policy if exists "artius_kv_member_all" on public.artius_kv;
drop policy if exists "artius_kv_member_read" on public.artius_kv;

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

-- 10. v2.3 — Gỡ mã PIN quản lý của bản v1.6 khỏi thiết lập dùng chung.
--     Thiết lập (artius_config) và bảng cũ (artius_kv) đều đọc được bởi MỌI tài khoản, nên PIN nằm đó là lộ cho nhân sự.
--     PIN chỉ dùng để tạo tài khoản quản lý đầu tiên khi chưa có tài khoản nào — việc này đã làm xong.
--     Tăng rev để các máy đang mở tự nạp lại thiết lập mới.
update public.artius_config
set value = (value::jsonb - 'adminPin')::text, rev = rev + 1, updated_at = now()
where id = 'main' and value::jsonb ? 'adminPin';

update public.artius_kv
set value = jsonb_set(value::jsonb, '{config}', (value::jsonb -> 'config') - 'adminPin')::text, updated_at = now()
where key = 'artius:db:v1' and jsonb_typeof(value::jsonb -> 'config') = 'object' and (value::jsonb -> 'config') ? 'adminPin';

-- 12. v2.4 — Các hàm tính toán chỉ dùng nội bộ trong trigger / hàm khác: không cho người chưa đăng nhập gọi qua API.
--     (Hàm không đọc bảng nào nên trước đây cũng không lộ dữ liệu; khoá lại cho gọn.)
revoke all on function public.artius_day_hours(jsonb, text)     from public, anon;
revoke all on function public.artius_proj_hours(jsonb, text)    from public, anon;
revoke all on function public.artius_future_work(jsonb, date)   from public, anon;
revoke all on function public.artius_unbudgeted_hours(jsonb, jsonb) from public, anon;
grant execute on function public.artius_unbudgeted_hours(jsonb, jsonb) to authenticated, service_role;
grant execute on function public.artius_day_hours(jsonb, text)   to authenticated, service_role;
grant execute on function public.artius_proj_hours(jsonb, text)  to authenticated, service_role;
grant execute on function public.artius_future_work(jsonb, date) to authenticated, service_role;

-- 13. v2.6 — Thông báo nhắc nộp bảng công (Web Push).
--     artius_push:     mỗi dòng là một trình duyệt đã cho phép nhận thông báo (endpoint do trình duyệt cấp).
--                      Một người có thể có nhiều dòng (Chrome + Edge, máy công ty + điện thoại).
--     artius_push_log: mỗi lần nhắc đã gửi cho một người, để không gửi trùng (kind + period + emp_id là duy nhất).
--     Chỉ hàm server /api/push (service_role) ghi; tài khoản quản lý được đọc để xem ai đã bật.
create table if not exists public.artius_push (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  emp_id     text,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now()
);
create index if not exists artius_push_emp on public.artius_push (emp_id);

create table if not exists public.artius_push_log (
  kind     text not null,                 -- 'week' | 'month' | 'test' | 'manual' (v5.9: quản lý bấm chuông ở Bảng công)
  period   text not null,                 -- tuần: thứ Hai của tuần nhắc; tháng: 'YYYY-MM@YYYY-MM-DD' (ngày gửi). v4.2: thêm '@<ngày>#<lượt>' cho cả hai
  emp_id   text not null,
  missing  int  not null default 0,       -- số ngày còn thiếu lúc gửi
  devices  int  not null default 0,       -- số thiết bị nhận thành công
  sent_at  timestamptz not null default now(),
  primary key (kind, period, emp_id)
);
create index if not exists artius_push_log_sent on public.artius_push_log (sent_at desc);

alter table public.artius_push     enable row level security;
alter table public.artius_push_log enable row level security;
revoke all on public.artius_push     from anon, authenticated;
revoke all on public.artius_push_log from anon, authenticated;
grant select on public.artius_push     to authenticated;
grant select on public.artius_push_log to authenticated;
grant all on public.artius_push     to service_role;
grant all on public.artius_push_log to service_role;
drop policy if exists "artius_push_admin_read" on public.artius_push;
drop policy if exists "artius_push_log_admin_read" on public.artius_push_log;
create policy "artius_push_admin_read" on public.artius_push
  for select to authenticated using ((select public.artius_is_admin()));
create policy "artius_push_log_admin_read" on public.artius_push_log
  for select to authenticated using ((select public.artius_is_admin()));

-- 14. v4.7 — Chi tiết từng giai đoạn cho Dashboard quản lý (rê chuột / bấm vào ô giai đoạn ở "Tiến độ dự án").
--     Trả về MỘT khối JSON cho mọi cặp dự án × giai đoạn (chỉ giờ của ngày đã gửi, trên toàn bộ bảng công):
--     { "<projectId>|<phaseId>": { "w": {"<thứ Hai>": giờ}, "e": {"<empId>": giờ}, "t": {"<taskId>": giờ},
--                                   "first": "YYYY-MM-DD", "last": "YYYY-MM-DD" } }
--     Trả một khối JSON (không trả từng dòng) để không vướng giới hạn 1000 dòng của API. Chỉ tài khoản quản lý nhận được số liệu.
--     v4.9: thêm "o": {"<mã hạng mục tăng ca>|<tăng ca cho tác vụ>|<n|s|h>": giờ} — giờ tăng ca theo khung giờ × tác vụ,
--     n = ngày thường, s = Chủ nhật, h = ngày lễ (theo danh sách ngày lễ trong thiết lập). Dòng tăng ca cũ chưa có tác vụ: phần giữa rỗng.
--     v5.6: thêm "et": {"<empId>": {"<taskId>|<otFor>": giờ}} — giờ của từng người theo từng tác vụ (otFor chỉ có ở dòng tăng ca).
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
    where public.artius_is_admin()
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
           where coalesce(tt ->> 'name', '') ~* '^\s*\[\s*ot\s*\]'),
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
revoke all on function public.artius_phase_detail() from public, anon;
grant execute on function public.artius_phase_detail() to authenticated, service_role;

-- 11. Bắt PostgREST nạp lại danh sách bảng / hàm ngay (để hàm artius_usage dùng được liền, không báo 404)
notify pgrst, 'reload schema';
