-- v13.65 — THỨ TỰ CHẠY BẮT BUỘC khi dựng database mới: xem supabase/README.md.
--   File này KHÔNG tự đủ: trigger chặn ghi bảng công và hai hàm tổng hợp nằm ở các file chạy sau.
-- ARTIUS — Quản lý giờ công v7.3
-- Chạy trong Supabase → SQL Editor. Chạy lại nhiều lần được, không xoá dữ liệu.
-- Nâng cấp từ bất kỳ bản v1.7 → v3.0: chạy nguyên file này MỘT LẦN, ngay trước khi deploy bản v3.1.
-- (Lịch gửi nhắc nhở nằm riêng ở supabase/cron.sql — chạy sau file này, xem README.)
-- (v7.3 thêm mục 16: cấp quyền 4 mức — Nhân viên / Trưởng phòng / BOD / Admin. Trưởng phòng xem và sửa bảng công
--  của nhân viên CÙNG PHÒNG BAN; BOD xem toàn công ty, không sửa gì; Admin toàn quyền. Sửa mục 7, 8d, 9, 13, 14.)
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
-- v7.3: cấp quyền của tài khoản. emp = nhân viên, head = trưởng phòng, bod = ban giám đốc (chỉ xem), admin = toàn quyền.
--       is_admin vẫn giữ và luôn bằng (access = 'admin') — hàm server ghi cả hai.
alter table public.artius_accounts add column if not exists access text not null default 'emp';
alter table public.artius_accounts drop constraint if exists artius_accounts_access_chk;
alter table public.artius_accounts add constraint artius_accounts_access_chk check (access in ('emp', 'head', 'bod', 'admin'));
-- tài khoản quản lý có từ trước v7.3 thành Admin; chạy lại nhiều lần vẫn đúng
update public.artius_accounts set access = 'admin' where is_admin and access <> 'admin';
update public.artius_accounts set is_admin = (access = 'admin') where is_admin is distinct from (access = 'admin');

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

-- 4b. v7.3 — Phạm vi theo cấp quyền.
--     artius_view_all():    Admin hoặc BOD — xem bảng công toàn công ty.
--     artius_managed_emps(): danh sách mã nhân sự mà trưởng phòng đang đăng nhập được xem và sửa bảng công:
--                            mọi nhân sự cùng phòng ban (theo nhân sự gắn với tài khoản, ở artius_config), TRỪ chính mình
--                            — bảng công của chính trưởng phòng vẫn theo luật nhân viên (gửi là khoá, không tự mở khoá).
--                            Người không phải trưởng phòng: mảng rỗng. Đổi phòng ban của nhân sự ở tab Nhân sự là phạm vi đổi theo ngay.
create or replace function public.artius_view_all()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.artius_accounts a where a.id = auth.uid() and not a.disabled and a.access in ('admin', 'bod'));
$$;
create or replace function public.artius_managed_emps()
returns text[] language sql stable security definer set search_path = public as $$
  with me as (
    select a.emp_id from public.artius_accounts a
    where a.id = auth.uid() and not a.disabled and a.access = 'head' and a.emp_id is not null
  ),
  emps as (
    select e from public.artius_config c,
         jsonb_array_elements(case when jsonb_typeof(c.value::jsonb -> 'employees') = 'array' then c.value::jsonb -> 'employees' else '[]'::jsonb end) as e
    where c.id = 'main'
  ),
  dept as (select e ->> 'dept' as d from emps, me where e ->> 'id' = me.emp_id)
  select coalesce(array_agg(e ->> 'id'), '{}'::text[])
  from emps, dept, me
  where coalesce(dept.d, '') <> '' and e ->> 'dept' = dept.d and e ->> 'id' <> me.emp_id;
$$;
revoke all on function public.artius_view_all()     from public, anon;
revoke all on function public.artius_managed_emps() from public, anon;
grant execute on function public.artius_view_all()     to authenticated, service_role;
grant execute on function public.artius_managed_emps() to authenticated, service_role;

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
-- artius_ts_guard() — KHÔNG định nghĩa ở đây nữa (v13.65, K09). Bản đang chạy nằm ở supabase/v8_6_khoa_qua_han.sql.
-- Bản ở đó có thêm khoá quá hạn (artius_past_work), và file đó tự tạo lại trigger.
-- Trước đây hàm có ở cả hai file; chạy lại file này là database quay về luật đời cũ mà không ai biết.


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

-- 8d. Bảng công.
--     v7.3: Xem — Admin, BOD: tất cả · trưởng phòng: của mình + nhân viên cùng phòng · nhân viên: của mình.
--           Sửa — Admin: tất cả · trưởng phòng: của mình + nhân viên cùng phòng · nhân viên: của mình · BOD: chỉ của mình (nếu có gắn nhân sự).
revoke all on public.artius_ts from anon, authenticated;
grant select, insert, update, delete on public.artius_ts to authenticated;
grant all on public.artius_ts to service_role;
drop policy if exists "artius_ts_own_or_admin" on public.artius_ts;
drop policy if exists "artius_ts_read" on public.artius_ts;
drop policy if exists "artius_ts_insert" on public.artius_ts;
drop policy if exists "artius_ts_update" on public.artius_ts;
drop policy if exists "artius_ts_delete" on public.artius_ts;
create policy "artius_ts_read" on public.artius_ts
  for select to authenticated
  using ((select public.artius_view_all()) or emp_id = (select public.artius_my_emp())
         or emp_id in (select unnest(public.artius_managed_emps())));
create policy "artius_ts_insert" on public.artius_ts
  for insert to authenticated
  with check ((select public.artius_is_admin()) or emp_id = (select public.artius_my_emp())
              or emp_id in (select unnest(public.artius_managed_emps())));
create policy "artius_ts_update" on public.artius_ts
  for update to authenticated
  using ((select public.artius_is_admin()) or emp_id = (select public.artius_my_emp())
         or emp_id in (select unnest(public.artius_managed_emps())))
  with check ((select public.artius_is_admin()) or emp_id = (select public.artius_my_emp())
              or emp_id in (select unnest(public.artius_managed_emps())));
create policy "artius_ts_delete" on public.artius_ts
  for delete to authenticated
  using ((select public.artius_is_admin()) or emp_id = (select public.artius_my_emp())
         or emp_id in (select unnest(public.artius_managed_emps())));

-- 9. v2.1 — Tổng giờ theo dự án × giai đoạn trên TOÀN BỘ bảng công.
--    App chỉ tải sẵn 6 tháng gần nhất, nên con số "từ trước tới nay" (tab Dự án, tab Thiết lập → Giai đoạn) hỏi hàm này.
--    sent_hours = giờ của ngày đã gửi; all_hours = mọi giờ đang lưu. Chỉ tài khoản quản lý nhận được số liệu.
-- artius_usage() — KHÔNG định nghĩa ở đây nữa (v13.65, K09). Bản đang chạy nằm ở supabase/v12_25_truongphong_dashboard.sql.
-- Bản ở đó cho cả Trưởng phòng xem (artius_view_agg) và tự cấp quyền gọi hàm.
-- Trước đây hàm có ở cả hai file; chạy lại file này là database quay về luật đời cũ mà không ai biết.

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
-- v7.3: BOD xem được như Admin; trưởng phòng xem được của nhân viên cùng phòng (cột Nhắc ở Bảng công)
create policy "artius_push_admin_read" on public.artius_push
  for select to authenticated using ((select public.artius_view_all()) or emp_id in (select unnest(public.artius_managed_emps())));
create policy "artius_push_log_admin_read" on public.artius_push_log
  for select to authenticated using ((select public.artius_view_all()) or emp_id in (select unnest(public.artius_managed_emps())));

-- 14. v4.7 — Chi tiết từng giai đoạn cho Dashboard quản lý (rê chuột / bấm vào ô giai đoạn ở "Tiến độ dự án").
--     Trả về MỘT khối JSON cho mọi cặp dự án × giai đoạn (chỉ giờ của ngày đã gửi, trên toàn bộ bảng công):
--     { "<projectId>|<phaseId>": { "w": {"<thứ Hai>": giờ}, "e": {"<empId>": giờ}, "t": {"<taskId>": giờ},
--                                   "first": "YYYY-MM-DD", "last": "YYYY-MM-DD" } }
--     Trả một khối JSON (không trả từng dòng) để không vướng giới hạn 1000 dòng của API. Chỉ tài khoản quản lý nhận được số liệu.
--     v4.9: thêm "o": {"<mã hạng mục tăng ca>|<tăng ca cho tác vụ>|<n|s|h>": giờ} — giờ tăng ca theo khung giờ × tác vụ,
--     n = ngày thường, s = Chủ nhật, h = ngày lễ (theo danh sách ngày lễ trong thiết lập). Dòng tăng ca cũ chưa có tác vụ: phần giữa rỗng.
--     v6.5: tăng ca nhận cả mã khung giờ chung (otBands) và mã [OT] cũ (otLegacy) — trước đó "o" rỗng sau khi chuyển sang v6.3.
--     v5.6: thêm "et": {"<empId>": {"<taskId>|<otFor>": giờ}} — giờ của từng người theo từng tác vụ (otFor chỉ có ở dòng tăng ca).
-- artius_phase_detail() — KHÔNG định nghĩa ở đây nữa (v13.65, K09). Bản đang chạy nằm ở supabase/v12_25_truongphong_dashboard.sql.
-- Bản ở đó cho cả Trưởng phòng xem (artius_view_agg) và tự cấp quyền gọi hàm.
-- Trước đây hàm có ở cả hai file; chạy lại file này là database quay về luật đời cũ mà không ai biết.

-- 15. v6.6 — Tác vụ đã xoá thì xoá luôn giờ công đã chấm vào nó (kể cả dòng tăng ca "cho tác vụ" đó). Chỉ quản lý gọi được.
--     artius_purge_tasks(ids): gỡ mọi dòng có taskId hoặc otFor nằm trong ids, bỏ dấu "đã gửi" của ngày không còn giờ.
--     Trả về {"hours": tổng giờ đã xoá, "buckets": số bảng công tháng bị sửa}. KHÔNG khôi phục được.
--     artius_orphan_tasks(): giờ còn chấm vào tác vụ không còn trong thiết lập (đã xoá trước v6.6) — {"<taskId>": giờ}.
create or replace function public.artius_purge_tasks(ids text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b record; v jsonb; rws jsonb; kept jsonb; snt jsonb; d text; tot numeric; removed numeric := 0; nb int := 0;
begin
  if not public.artius_is_admin() then
    raise exception 'Chỉ tài khoản quản lý được xoá giờ công.' using errcode = '42501';
  end if;
  ids := array(select x from unnest(coalesce(ids, '{}')) x where coalesce(x, '') <> '');
  if cardinality(ids) = 0 then return jsonb_build_object('hours', 0, 'buckets', 0); end if;
  for b in select t.emp_id, t.ym, t.value from public.artius_ts t
            where exists (select 1 from unnest(ids) i where strpos(t.value, i) > 0) for update loop
    v := b.value::jsonb;
    rws := case when jsonb_typeof(v -> 'rows') = 'array' then v -> 'rows' else '[]'::jsonb end;
    select coalesce(jsonb_agg(r), '[]'::jsonb) into kept from jsonb_array_elements(rws) r
     where not (coalesce(r ->> 'taskId', '') = any(ids) or coalesce(r ->> 'otFor', '') = any(ids));
    if jsonb_array_length(kept) = jsonb_array_length(rws) then continue; end if;
    select removed + coalesce(sum((dd.value #>> '{}')::numeric), 0) into removed
      from jsonb_array_elements(rws) r,
           jsonb_each(case when jsonb_typeof(r -> 'days') = 'object' then r -> 'days' else '{}'::jsonb end) dd
     where (coalesce(r ->> 'taskId', '') = any(ids) or coalesce(r ->> 'otFor', '') = any(ids)) and jsonb_typeof(dd.value) = 'number';
    snt := case when jsonb_typeof(v -> 'sent') = 'object' then v -> 'sent' else '{}'::jsonb end;
    for d in select jsonb_object_keys(snt) loop
      select coalesce(sum((r -> 'days' ->> d)::numeric), 0) into tot from jsonb_array_elements(kept) r where jsonb_typeof(r -> 'days' -> d) = 'number';
      if tot <= 0 then snt := snt - d; end if;
    end loop;
    v := jsonb_set(v, '{rows}', kept);
    v := jsonb_set(v, '{sent}', snt);
    update public.artius_ts t set value = v::text where t.emp_id = b.emp_id and t.ym = b.ym;
    nb := nb + 1;
  end loop;
  return jsonb_build_object('hours', removed, 'buckets', nb);
end $$;
revoke all on function public.artius_purge_tasks(text[]) from public, anon;
grant execute on function public.artius_purge_tasks(text[]) to authenticated, service_role;

create or replace function public.artius_orphan_tasks()
returns jsonb language sql stable security definer set search_path = public as $$
  with cf as (select coalesce((select c.value::jsonb from public.artius_config c where c.id = 'main'), '{}'::jsonb) as j),
  known as (
    select tt ->> 'id' as id from cf, jsonb_array_elements(case when jsonb_typeof(cf.j -> 'tasks') = 'array' then cf.j -> 'tasks' else '[]'::jsonb end) tt
    union select ob ->> 'id' from cf, jsonb_array_elements(case when jsonb_typeof(cf.j -> 'otBands') = 'array' then cf.j -> 'otBands' else '[]'::jsonb end) ob
    union select lk from cf, jsonb_object_keys(case when jsonb_typeof(cf.j -> 'otLegacy') = 'object' then cf.j -> 'otLegacy' else '{}'::jsonb end) lk),
  x as (
    select coalesce(rw ->> 'taskId', '') as tid, coalesce(rw ->> 'otFor', '') as otf, (d.value #>> '{}')::numeric as h
    from public.artius_ts t
         cross join lateral jsonb_array_elements(case when jsonb_typeof(t.value::jsonb -> 'rows') = 'array' then t.value::jsonb -> 'rows' else '[]'::jsonb end) rw
         cross join lateral jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) d
    where public.artius_is_admin() and jsonb_typeof(d.value) = 'number' and (d.value #>> '{}')::numeric > 0),
  o as (
    select case when tid <> '' and tid not like 'LV\_%' and tid not in (select id from known where id is not null) then tid else otf end as id, h
    from x
    where (tid <> '' and tid not like 'LV\_%' and tid not in (select id from known where id is not null))
       or (otf <> '' and otf not in (select id from known where id is not null)))
  select coalesce(jsonb_object_agg(id, h), '{}'::jsonb) from (select id, sum(h) as h from o group by id) s;
$$;
revoke all on function public.artius_orphan_tasks() from public, anon;
grant execute on function public.artius_orphan_tasks() to authenticated, service_role;

-- 11. Bắt PostgREST nạp lại danh sách bảng / hàm ngay (để hàm artius_usage dùng được liền, không báo 404)
notify pgrst, 'reload schema';
