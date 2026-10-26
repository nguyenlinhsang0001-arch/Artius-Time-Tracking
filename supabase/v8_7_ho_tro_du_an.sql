-- ============================================================
-- ARTIUS TIME v8.7 — Hỗ trợ dự án có thời hạn
-- Chạy MỘT LẦN trong Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần vẫn an toàn (create or replace). Không đổi dữ liệu có sẵn.
-- (Nếu chưa chạy file v8_6_khoa_qua_han.sql thì chạy file đó trước.)
--
-- Đợt hỗ trợ lưu trong thiết lập chung: config.support = [ { id, empId, pid, phase, from, until, note, by, at } ]
--   phase = "" → mọi giai đoạn đang mở của dự án; from / until = "YYYY-MM-DD" (until tính hết ngày đó).
-- Thiết lập chung chỉ Admin ghi được, nên hàm dưới đây cho TRƯỞNG PHÒNG ghi riêng phần "support"
-- của nhân viên phòng mình (Admin dùng được cho mọi người). BOD / nhân viên: bị từ chối.
-- ============================================================
create or replace function public.artius_support_set(p_item jsonb, p_remove boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c    jsonb;
  arr  jsonb;
  old  jsonb;
  iid  text;
  eid  text;
  who  text;
  adm  boolean := public.artius_is_admin();
  mine text[]  := public.artius_managed_emps();
  outa jsonb;
begin
  if auth.uid() is null or not public.artius_is_member() then
    raise exception 'Chưa đăng nhập hoặc tài khoản đã bị khoá.' using errcode = '42501';
  end if;
  if not adm and coalesce(array_length(mine, 1), 0) = 0 then
    raise exception 'Chỉ Admin hoặc trưởng phòng được mở hỗ trợ dự án.' using errcode = '42501';
  end if;
  iid := coalesce(p_item ->> 'id', '');
  if iid = '' then raise exception 'Thiếu mã đợt hỗ trợ.' using errcode = '22023'; end if;

  select t.value::jsonb into c from public.artius_config t where t.id = 'main' for update;
  if c is null then raise exception 'Chưa có thiết lập.' using errcode = '22023'; end if;
  arr := case when jsonb_typeof(c -> 'support') = 'array' then c -> 'support' else '[]'::jsonb end;
  select x into old from jsonb_array_elements(arr) as x where x ->> 'id' = iid limit 1;

  if not adm then
    if old is not null and not ((old ->> 'empId') = any (mine)) then
      raise exception 'Đợt hỗ trợ này không thuộc nhân viên phòng bạn.' using errcode = '42501';
    end if;
    if not p_remove and not ((p_item ->> 'empId') = any (mine)) then
      raise exception 'Trưởng phòng chỉ mở hỗ trợ cho nhân viên phòng mình.' using errcode = '42501';
    end if;
  end if;

  if not p_remove then
    eid := coalesce(p_item ->> 'empId', '');
    if eid = '' or coalesce(p_item ->> 'pid', '') = '' then
      raise exception 'Chọn nhân sự và dự án.' using errcode = '22023';
    end if;
    if coalesce(p_item ->> 'from', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_item ->> 'until', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or (p_item ->> 'until') < (p_item ->> 'from') then
      raise exception 'Thời gian hỗ trợ không hợp lệ.' using errcode = '22023';
    end if;
  end if;

  select a.username into who from public.artius_accounts a where a.id = auth.uid();
  select coalesce(jsonb_agg(x), '[]'::jsonb) into outa from jsonb_array_elements(arr) as x where x ->> 'id' <> iid;
  if not p_remove then
    outa := outa || jsonb_build_array(p_item || jsonb_build_object('by', coalesce(who, ''), 'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  end if;

  update public.artius_config t
     set value = jsonb_set(c, '{support}', outa)::text, rev = t.rev + 1, updated_at = now()
   where t.id = 'main';
  return outa;
end $$;
revoke all on function public.artius_support_set(jsonb, boolean) from public, anon;
grant execute on function public.artius_support_set(jsonb, boolean) to authenticated, service_role;
