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

-- artius_usage() và artius_phase_detail() — KHÔNG định nghĩa ở đây nữa (v13.71).
-- Bản đang chạy nằm ở supabase/v13_71_tong_hop_bang_phang.sql (đọc bảng giờ phẳng artius_hours).
-- Cách cũ (bung JSON) giữ ở đó dưới tên artius_usage_json / artius_phase_detail_json.
