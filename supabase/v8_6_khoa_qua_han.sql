-- ============================================================
-- ARTIUS TIME v8.6 — Khoá chấm công quá hạn (chặn ở database)
-- Chạy MỘT LẦN trong Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần vẫn an toàn (create or replace). Không đổi dữ liệu nào.
--
-- Quy tắc: nhân viên chỉ thêm / sửa / xoá giờ được trong N tuần gần nhất (mặc định 2 = tuần này + tuần trước,
-- tính từ thứ Hai). Giờ của ngày cũ hơn phải giữ nguyên. Ngoại lệ:
--   · Admin, trưởng phòng (nhân viên cùng phòng) sửa được như cũ
--   · tuần quản lý mở tạm cho riêng một người: config.pastOpen = { "<empId>": { "<thứ Hai>": "<hạn YYYY-MM-DD>" } }
--   · config.pastLock.weeks = 0 → tắt khoá
-- ============================================================

-- Giờ (> 0) của các ngày TRƯỚC mốc cut, theo từng dòng (dự án · tác vụ · tăng ca cho · ngày — không xét giai đoạn,
-- vì app tự điền giai đoạn cho dòng cũ khi mở lại tuần),
-- bỏ qua tuần đang được mở tạm (hạn >= hôm nay). So bản cũ / bản mới: khác nhau = đang sửa giờ quá hạn.
create or replace function public.artius_past_work(bucket jsonb, cut date, opened jsonb, today date)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(s.x order by s.x), '[]'::jsonb)
  from (
    select jsonb_build_array(
             coalesce(rw ->> 'projectId', ''),
             coalesce(rw ->> 'taskId', ''),
             coalesce(rw ->> 'otFor', ''),
             d.key,
             (d.value #>> '{}')::numeric) as x
    from jsonb_array_elements(case when jsonb_typeof(bucket -> 'rows') = 'array' then bucket -> 'rows' else '[]'::jsonb end) as rw,
         jsonb_each(case when jsonb_typeof(rw -> 'days') = 'object' then rw -> 'days' else '{}'::jsonb end) as d
    where d.key ~ '^\d{4}-\d{2}-\d{2}$'
      and d.key::date < cut
      and case when jsonb_typeof(d.value) = 'number' then (d.value #>> '{}')::numeric > 0
               when jsonb_typeof(d.value) = 'string' then (d.value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' and (d.value #>> '{}')::numeric > 0
               else false end
      and not coalesce((opened ->> to_char(d.key::date - (extract(isodow from d.key::date)::int - 1), 'YYYY-MM-DD')) >= to_char(today, 'YYYY-MM-DD'), false)
  ) as s;
$$;
revoke all on function public.artius_past_work(jsonb, date, jsonb, date) from public, anon;
grant execute on function public.artius_past_work(jsonb, date, jsonb, date) to authenticated, service_role;

-- Hàm kiểm tra khi ghi bảng công (bản v7.3 + khối v8.6 "khoá chấm công quá hạn")
create or replace function public.artius_ts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o  jsonb;
  n  jsonb;
  os jsonb;
  cf jsonb;
  dk text;
  pid text;
  td  date;
  cut date;
  op  jsonb;
begin
  -- v7.3: trưởng phòng sửa bảng công nhân viên cùng phòng như quản lý (mở khoá, sửa ngày đã gửi…)
  if auth.uid() is not null and not public.artius_is_admin()
     and not (case when tg_op = 'DELETE' then old.emp_id else new.emp_id end) = any (public.artius_managed_emps()) then
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
    -- v8.6: khoá chấm công quá hạn — chỉ sửa được N tuần gần nhất (tuần này + tuần trước khi N = 2).
    --       Giờ của các ngày trước mốc phải giữ nguyên, trừ tuần quản lý đang mở tạm cho người này (pastOpen).
    if cf is not null and coalesce((cf -> 'pastLock' ->> 'weeks')::int, 2) > 0 then
      td := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
      cut := td - (extract(isodow from td)::int - 1) - 7 * (coalesce((cf -> 'pastLock' ->> 'weeks')::int, 2) - 1);
      op := coalesce(cf -> 'pastOpen' -> (case when tg_op = 'DELETE' then old.emp_id else new.emp_id end), '{}'::jsonb);
      if public.artius_past_work(o, cut, op, td) is distinct from public.artius_past_work(n, cut, op, td) then
        raise exception 'Đã quá hạn chấm công (chỉ sửa được % tuần gần nhất). Nhờ quản lý mở chấm bù.', coalesce((cf -> 'pastLock' ->> 'weeks')::int, 2) using errcode = '42501';
      end if;
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

drop trigger if exists artius_ts_guard on public.artius_ts;
create trigger artius_ts_guard
  before insert or update or delete on public.artius_ts
  for each row execute function public.artius_ts_guard();
