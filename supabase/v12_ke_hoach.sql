-- ============================================================
-- ARTIUS TIME v12.0 → v12.12 — Kế hoạch nguồn lực (bản đầy đủ: lưu lưới + chốt bản, chỉ Admin ghi)
-- Chạy MỘT LẦN trong Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần vẫn an toàn. Không đổi dữ liệu có sẵn.
--
-- Hai bảng MỚI, tách hẳn khỏi artius_config và artius_ts: xoá sạch kế hoạch cũng không mất
-- một giờ công nào, và một lỗi của mục Kế hoạch không chạm được vào thiết lập hay bảng công.
--
-- Quyền, theo đúng cách v8.7 / v9.3 đang làm:
--   ĐỌC  — mọi tài khoản còn hiệu lực (artius_is_member). Quản lý xem được, nhân viên không thấy tab này.
--   GHI  — chỉ Admin (artius_is_admin), và chỉ qua hàm; không mở policy insert/update/delete trực tiếp.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Lưới kế hoạch: một dòng = một dự án × một vai trò × một năm.
--    weeks là mảng 52–53 số, mỗi số là SỐ NGƯỜI của tuần đó (1 / 0,5 / 0,25).
-- ------------------------------------------------------------
create table if not exists public.artius_plan (
  year        int    not null,
  project_id  text   not null,
  role_id     text   not null,
  weeks       jsonb  not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (year, project_id, role_id)
);

-- ------------------------------------------------------------
-- 2. Bản kế hoạch đã chốt: chụp lại nguyên lưới tại một thời điểm, để về sau so kế hoạch
--    với thực tế trên bản ĐÃ CHỐT thay vì bản vừa sửa.
-- ------------------------------------------------------------
create table if not exists public.artius_plan_snapshot (
  id        bigserial primary key,
  year      int   not null,
  label     text,
  data      jsonb not null,
  taken_at  timestamptz not null default now()
);
create index if not exists artius_plan_snapshot_year_idx
  on public.artius_plan_snapshot (year, taken_at desc);

-- ------------------------------------------------------------
-- 3. Ghi cả năm trong một lần.
--    Thay toàn bộ các dòng của năm bằng p_rows — gọn hơn gửi từng ô, và không để lại dòng rác
--    khi một vai trò bị gỡ khỏi dự án.
-- ------------------------------------------------------------
-- artius_plan_set() — KHÔNG định nghĩa ở đây nữa (v13.65, K09). Bản đang chạy nằm ở supabase/v12_19_bod_ke_hoach.sql
-- (cho cả BOD ghi), file đó tự cấp quyền gọi hàm. Chạy file đó NGAY SAU file này.

-- ------------------------------------------------------------
-- 4. Chốt một bản kế hoạch.
-- ------------------------------------------------------------
-- artius_plan_snapshot_add() — KHÔNG định nghĩa ở đây nữa (v13.65, K09). Bản đang chạy nằm ở supabase/v12_19_bod_ke_hoach.sql
-- (cho cả BOD ghi), file đó tự cấp quyền gọi hàm. Chạy file đó NGAY SAU file này.

-- ------------------------------------------------------------
-- 5. Quyền
-- ------------------------------------------------------------
alter table public.artius_plan          enable row level security;
alter table public.artius_plan_snapshot enable row level security;

drop policy if exists artius_plan_read on public.artius_plan;
create policy artius_plan_read on public.artius_plan
  for select to authenticated using (public.artius_is_member());

-- bản v12 đầu tiên mở quyền ghi thẳng bảng bản chốt cho mọi tài khoản: gỡ đi, mọi thay đổi chỉ qua hàm.
drop policy if exists artius_plan_snap_write on public.artius_plan_snapshot;
revoke insert on public.artius_plan_snapshot from authenticated;

drop policy if exists artius_plan_snap_read on public.artius_plan_snapshot;
create policy artius_plan_snap_read on public.artius_plan_snapshot
  for select to authenticated using (public.artius_is_member());

-- Không có policy insert / update / delete: mọi thay đổi đi qua hai hàm ở trên.
revoke all on public.artius_plan          from public, anon;
revoke all on public.artius_plan_snapshot from public, anon;
grant select on public.artius_plan           to authenticated;
grant select on public.artius_plan_snapshot  to authenticated;

