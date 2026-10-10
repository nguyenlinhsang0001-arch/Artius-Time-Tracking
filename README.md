# ARTIUS — Quản lý giờ công · v1.8 (bản webapp cho Vercel)

| File | Vai trò |
|---|---|
| `src/artius-timesheet_v1_8.jsx` | Ứng dụng v1.8 |
| `src/data.js` | Đọc/ghi thiết lập và bảng công theo từng dòng trên Supabase (mới ở v1.8) |
| `src/merge.js` | Gộp thiết lập khi nhiều quản lý cùng sửa (mới ở v1.8) |
| `src/auth.js` | Đăng nhập / đăng xuất, gọi hàm server quản lý tài khoản |
| `src/storage.js` | Client Supabase dùng chung + tuỳ chọn riêng từng máy (localStorage) |
| `api/accounts.js` | Hàm server trên Vercel: tạo / sửa / khoá / xoá tài khoản |
| `src/main.jsx`, `index.html`, `src/index.css` | Điểm khởi động, Tailwind |
| `supabase/schema.sql` | Các bảng, phân quyền, và phần tự chuyển dữ liệu từ v1.7 |

## Mới ở v1.8 — tách bảng dữ liệu

Tới v1.7 toàn bộ dữ liệu nằm trong **một dòng** của bảng `artius_kv`. Nút Lưu nháp ghi lại cả khối
theo bản mà máy người đó tải lúc mở app, nên đè mất giờ công và thay đổi thiết lập của người khác.

Từ v1.8:

| Bảng | Nội dung | Ai đọc | Ai ghi |
|---|---|---|---|
| `artius_config` | Một dòng: nhân sự, dự án, tác vụ, vai trò, ngày lễ… | Mọi tài khoản hợp lệ | Chỉ tài khoản quản lý |
| `artius_ts` | Mỗi dòng = bảng công của một nhân sự trong một tháng | Chính người đó, và quản lý | Chính người đó, và quản lý |
| `artius_accounts` | Tài khoản đăng nhập | Chỉ hàm server | Chỉ hàm server |
| `artius_kv` | Dữ liệu cũ của v1.7, giữ làm bản lưu | Tài khoản hợp lệ | Không ai (chỉ đọc) |

- Mỗi lần lưu chỉ ghi đúng dòng (nhân sự, tháng) vừa sửa, và đọc lại dòng đó ngay trước khi ghi.
  Hai người lưu cùng lúc không đè nhau; một người dùng hai máy trong cùng tháng cũng không mất giờ.
- Hai quản lý cùng sửa thiết lập: trước khi ghi, app đọc bản mới nhất rồi gộp theo từng mục (từng nhân sự, dự án,
  tác vụ, vai trò), kèm số phiên bản để không ghi đè lần ghi chen giữa. Chỉ khi hai người sửa **đúng cùng một mục**
  thì người lưu sau mới thắng.
- Phân quyền do **database** thực hiện, không còn phụ thuộc giao diện.
- Nhân sự chỉ tải bảng công của mình, nên mở app và lưu đều nhẹ.
- Bỏ hai cảnh báo "hạn mức lệnh của phiên" và "dữ liệu gần giới hạn một khoá": chỉ đúng với bản artifact.

## Nâng cấp từ v1.7 — làm đúng thứ tự

Không cần thêm hay sửa biến môi trường nào trên Vercel.

1. **Sao lưu.** Mở bản v1.7 đang chạy → Thiết lập → Sao lưu & khôi phục → Xuất file sao lưu.
2. **Supabase → SQL Editor**: dán toàn bộ `supabase/schema.sql`, bấm **Run**.
   File này tự tạo hai bảng mới, chép dữ liệu từ `artius_kv` sang, rồi chuyển `artius_kv` thành chỉ đọc.
   Từ lúc này bản v1.7 vẫn xem được dữ liệu nhưng **không lưu được** (báo "Chưa ghi được").
3. **Kiểm tra** trong Table Editor: `artius_config` có 1 dòng `main`; `artius_ts` có các dòng dạng mã nhân sự + tháng.
4. **GitHub**: chép các file v1.8 vào repository (nhớ có `src/data.js` và `src/merge.js`), **xoá** `src/artius-timesheet_v1_7.jsx`, commit. Vercel tự deploy.
5. Mở webapp, bấm Ctrl + F5. Góc trái dưới ghi `ARTIUS v1.8`, dữ liệu cũ có đủ.
6. Nhắn mọi người **tải lại trang**. Ai còn mở bản v1.7 sẽ thấy lỗi khi bấm lưu, tải lại là lên v1.8.

Chạy lại `schema.sql` sau khi đã dùng v1.8 là an toàn: phần chuyển dữ liệu chỉ chạy khi `artius_config` còn trống.

### Quay lại v1.7 nếu cần

Vercel → Deployments → bản v1.7 → Promote to Production, rồi chạy trong SQL Editor:

```sql
grant select, insert, update, delete on public.artius_kv to authenticated;
drop policy if exists "artius_kv_member_read" on public.artius_kv;
create policy "artius_kv_member_all" on public.artius_kv
  for all to authenticated
  using ((select public.artius_is_member())) with check ((select public.artius_is_member()));
```

Lưu ý: giờ công nhập trong thời gian chạy v1.8 nằm ở bảng mới, bản v1.7 sẽ không thấy.

## Cài mới từ đầu

1. Supabase: tạo project, chạy `supabase/schema.sql`, chép **Project URL**, **anon / publishable key** và **service_role / secret key**.
2. GitHub: tạo repository (nên để **Private**), đưa toàn bộ thư mục lên. Không đưa `node_modules`, `dist`, `.env`.
3. Vercel: import repository (tự nhận là **Vite**), khai 3 biến `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (không có tiền tố `VITE_`), rồi **Deploy**.
4. Mở webapp và tạo tài khoản quản lý đầu tiên.

## Chạy thử trên máy

`npm run dev` chỉ chạy phần giao diện, không có `/api/accounts`. Muốn chạy đủ cả hàm server thì dùng `vercel dev`
(cần Vercel CLI) với file `.env.local` có đủ 3 biến.

## Lưu ý

- Mật khẩu lưu ở dạng **đọc được** trong bảng `artius_accounts` để ban quản lý xem lại. Bảng này không mở cho
  trình duyệt. Ai vào được Supabase dashboard của project cũng xem được bảng này.
- Tên đăng nhập được ghép thành email nội bộ `<tên>@artius-time.local` để dùng với Supabase Auth. Không có thư nào được gửi đi.
- Màn hình của quản lý hiển thị dữ liệu tại lúc mở app. Muốn thấy giờ mọi người vừa nhập thì bấm **Tải lại** ở Dashboard
  hoặc tải lại trang.
