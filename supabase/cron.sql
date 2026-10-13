-- ARTIUS v2.6 — Lịch chạy nhắc nộp bảng công
-- Chạy trong Supabase → SQL Editor, SAU khi đã chạy schema.sql và đã deploy bản v2.6 lên Vercel.
--
-- Bước 0 (một lần): Supabase → Database → Extensions → bật "pg_cron" và "pg_net".
-- Bước 1: thay 2 chỗ in hoa bên dưới:
--   https://artius-timetracking.vercel.app  -> địa chỉ webapp (đổi nếu khác)
--   DOI_THANH_CRON_SECRET                   -> đúng giá trị biến CRON_SECRET đã khai trên Vercel
-- Bước 2: chạy file. Chạy lại nhiều lần được (cùng tên lịch thì chỉ cập nhật, không nhân đôi).
--
-- Cách hoạt động: cứ 15 phút Supabase gọi /api/push một lần. Hàm server tự xem giờ hiện tại (giờ Việt Nam)
-- đã tới lịch nhắc trong tab Thiết lập chưa; chưa tới thì thoát ngay, tới rồi thì gửi cho người còn thiếu giờ.
-- Đổi giờ nhắc chỉ cần sửa trong app, KHÔNG cần sửa file này.

select cron.schedule(
  'artius-nhac-bang-cong',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://artius-timetracking.vercel.app/api/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'DOI_THANH_CRON_SECRET'),
    body    := jsonb_build_object('action', 'cron'),
    timeout_milliseconds := 20000
  );
  $$
);

-- Xem lịch đang có:            select jobid, jobname, schedule, active from cron.job;
-- Xem 10 lần chạy gần nhất:     select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
-- Xem phản hồi của /api/push:   select status_code, content, created from net._http_response order by created desc limit 10;
-- Tắt hẳn lịch:                 select cron.unschedule('artius-nhac-bang-cong');
