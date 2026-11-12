-- ARTIUS TIME v13.76 — Vòng 5, mục 3 (R8): "giai đoạn đang mở" chỉ còn MỘT luật — công tắc project.phaseOpen.
--
-- Trước: dự án chưa có công tắc thì "giai đoạn có giờ dự kiến > 0 là mở" (luật v2.5). Giờ dự kiến chỉ để theo dõi tiến độ.
-- Trigger artius_ts_guard (v8_6_khoa_qua_han.sql) dùng hàm này để chặn nhân sự chấm vào giai đoạn đang đóng —
-- trigger không đổi, chỉ hàm đổi. Hàm chuyển từ schema.sql sang file này (mỗi hàm một file).
--
-- CỔNG AN TOÀN: còn dự án nào CHƯA có công tắc thì DỪNG, không thay gì (bỏ luật dự phòng sẽ khoá giai đoạn của dự án đó).
--   Khi đó: tab Dự án › bấm mở / đóng một giai đoạn bất kỳ của dự án đó (app ghi đủ công tắc 4 giai đoạn) rồi chạy lại.
-- Chạy MỘT lần trên Supabase → SQL Editor. Chạy lại nhiều lần không sao.

do $$
declare n int; ten text;
begin
  select count(*), string_agg(pr ->> 'name', ', ') into n, ten
  from public.artius_config c,
       jsonb_array_elements(case when jsonb_typeof(c.value::jsonb -> 'projects') = 'array' then c.value::jsonb -> 'projects' else '[]'::jsonb end) as pr
  where c.id = 'main' and jsonb_typeof(pr -> 'phaseOpen') is distinct from 'object';
  if n > 0 then
    raise exception 'Còn % dự án chưa có công tắc mở / đóng giai đoạn: %. Chưa thay gì. Vào tab Dự án bật / tắt một giai đoạn của từng dự án đó rồi chạy lại.', n, ten;
  end if;
  raise notice 'Mọi dự án đều có công tắc giai đoạn — thay hàm.';
end $$;

-- Giờ của các dòng rơi vào giai đoạn ĐANG ĐÓNG của dự án (tên hàm giữ từ v2.5 vì trigger artius_ts_guard gọi theo tên),
--     dạng chuẩn để so sánh trước/sau. Bỏ qua dòng vắng mặt (tác vụ LV_…, không thuộc dự án).
--     Dự án không còn trong thiết lập cũng tính là đóng.
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
                -- v3.1: quản lý mở / đóng từng giai đoạn. v13.76: CHỈ còn luật này — không có công tắc = đóng.
                when jsonb_typeof(pr -> 'phaseOpen') = 'object'
                  then coalesce(pr -> 'phaseOpen' -> coalesce(nullif(rw ->> 'phaseId', ''), 'P2') = 'true'::jsonb, false)
                else false end
      )
  ) as s;
$$;

revoke all on function public.artius_unbudgeted_hours(jsonb, jsonb) from public, anon;
grant execute on function public.artius_unbudgeted_hours(jsonb, jsonb) to authenticated, service_role;

select 'ĐÃ CHUYỂN: giai đoạn mở chỉ theo công tắc phaseOpen' as ket_qua;
