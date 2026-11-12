# File SQL của ARTIUS TIME

Từ v13.65 **mỗi hàm chỉ định nghĩa ở đúng một file**. Trước đây 5 hàm có ở hai file; database giữ bản của file
chạy sau cùng, nên chạy lại một file cũ là luật quay về đời cũ mà không ai biết — ví dụ chạy lại `schema.sql`
là mất khoá chấm công quá hạn.

## Database đang chạy: chỉ cần chạy file mới

- v13.69: `v13_69_bang_gio.sql` (bảng giờ phẳng `artius_hours`) — đã chạy.
- v13.71: `v13_71_tong_hop_bang_phang.sql` — hai hàm tổng hợp giờ chuyển sang đọc `artius_hours`. File **tự so** cách cũ
  với cách mới trên dữ liệu thật: khớp thì thay và in "ĐÃ CHUYỂN"; lệch thì báo lỗi và **không thay gì**
  (khi đó bấm "Dựng lại bảng giờ" trong app rồi chạy lại).
- v13.74: **chạy lại** `v13_71_tong_hop_bang_phang.sql` (đã sửa: tăng ca chỉ nhận theo khung `otBands`). Cổng y như trên;
  trong lúc chạy hai hàm app gọi tạm dùng cách cũ, lệch thì ở lại cách cũ.
- v13.76: `v13_76_giai_doan_mo.sql` — giai đoạn mở chỉ theo công tắc. Cổng: còn dự án chưa có công tắc thì dừng, không thay gì.

## Dựng database mới: chạy đúng thứ tự này

Supabase → SQL Editor → New query → dán toàn bộ một file → Run. Xong file này mới sang file sau.

| # | File | Có gì |
| --- | --- | --- |
| 1 | `schema.sql` | Bảng, phân quyền (RLS), hàm xác định người gọi |
| 2 | `v8_6_khoa_qua_han.sql` | **Trigger chặn ghi bảng công** `artius_ts_guard` + khoá quá hạn |
| 3 | `v8_7_ho_tro_du_an.sql` | Hỗ trợ dự án (`artius_support_set`) |
| 4 | `v9_3_truong_phong.sql` | Trưởng phòng giao dự án (`artius_emp_projects_set`) |
| 5 | `v12_ke_hoach.sql` | Bảng kế hoạch, bản chốt |
| 6 | `v12_19_bod_ke_hoach.sql` | **Hàm ghi kế hoạch và chốt bản** (`artius_plan_set`, `artius_plan_snapshot_add`) |
| 7 | `v12_25_truongphong_dashboard.sql` | Quyền xem số tổng hợp (`artius_view_agg`) — Admin, BOD, Trưởng phòng |
| 8 | `cron.sql` | Lịch nhắc nộp — cần bật `pg_cron` và `pg_net` trước, sửa 2 chỗ in hoa trong file |
| 9 | `v13_69_bang_gio.sql` | **Bảng giờ phẳng** `artius_hours` + trigger tự bung từ `artius_ts` + `artius_hours_rebuild` |
| 10 | `v13_71_tong_hop_bang_phang.sql` | **Hàm tổng hợp giờ** (`artius_usage`, `artius_phase_detail`) đọc `artius_hours` |
| 11 | `v13_76_giai_doan_mo.sql` | Giờ rơi vào giai đoạn đang đóng (`artius_unbudgeted_hours`) — trigger chặn ghi dùng |

`schema.sql` **không tự đủ**: chỉ chạy mình nó thì chưa có trigger chặn ghi và chưa có hàm tổng hợp.
Phải chạy đủ tới file 11 (bỏ qua file 8 nếu chưa cần nhắc nộp).

## Hàm nào ở file nào

| Hàm | File duy nhất |
| --- | --- |
| `artius_ts_guard()` + trigger | `v8_6_khoa_qua_han.sql` |
| `artius_view_agg()` | `v12_25_truongphong_dashboard.sql` |
| `artius_usage()`, `artius_phase_detail()` (+ bản `_flat`, bản cũ `_json`) | `v13_71_tong_hop_bang_phang.sql` |
| `artius_plan_set()`, `artius_plan_snapshot_add()` | `v12_19_bod_ke_hoach.sql` |
| `artius_role_on()`, `artius_flatten_ts()`, `artius_emp_cfg()`, `artius_ts_flatten_trg()`, `artius_config_roles_trg()`, `artius_hours_rebuild()` | `v13_69_bang_gio.sql` |

Sửa một hàm thì sửa **ở file đó**, không chép sang file khác. `npm run datamap` báo lỗi K9 nếu một hàm lại xuất hiện ở hai file.
