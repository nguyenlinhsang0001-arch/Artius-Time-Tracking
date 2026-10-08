# ARTIUS — Quản lý giờ công · v1.7 (bản webapp cho Vercel)

| File | Vai trò |
|---|---|
| `src/artius-timesheet_v1_7.jsx` | Ứng dụng v1.7 |
| `src/auth.js` | Đăng nhập / đăng xuất, gọi hàm server quản lý tài khoản (mới ở v1.7) |
| `src/storage.js` | Lưu trữ: Supabase (dữ liệu chung) + localStorage (tuỳ chọn riêng từng máy) |
| `api/accounts.js` | Hàm server trên Vercel: tạo / sửa / khoá / xoá tài khoản (mới ở v1.7) |
| `src/main.jsx`, `index.html`, `src/index.css` | Điểm khởi động, Tailwind |
| `supabase/schema.sql` | Bảng `artius_kv`, bảng `artius_accounts` và phân quyền |
| `.env.example` | Mẫu biến môi trường |

## Mới ở v1.7

- Đăng nhập bằng **tên đăng nhập + mật khẩu**. Bỏ màn chọn tên và mã PIN quản lý.
- Tab **Nhân sự**: mỗi dòng có tên đăng nhập và mật khẩu. Ban quản lý đặt, xem lại (bấm con mắt),
  đặt lại mật khẩu (bấm bút chì, gõ mật khẩu mới), khoá / mở khoá tài khoản (bấm ổ khoá).
- **Quyền quản lý** là một ô tích của tài khoản. Tài khoản thường vào thẳng bảng công của mình.
- Nhân sự nghỉ việc: **khoá** tài khoản. Giờ công đã chấm giữ nguyên.
- Database chỉ trả dữ liệu cho tài khoản hợp lệ và chưa bị khoá. Người chỉ có đường link không còn đọc/ghi được.
- Tải dữ liệu hỏng lúc mở app thì dừng ở màn báo lỗi, không vào app với dữ liệu rỗng.
- Không đổi cấu trúc dữ liệu giờ công: dữ liệu v1.6 dùng tiếp, không cần chuyển đổi.

## Nâng cấp từ v1.6 — làm đúng thứ tự

1. **Sao lưu.** Mở bản v1.6 đang chạy → Thiết lập → Sao lưu & khôi phục → xuất file sao lưu.
2. **Vercel → Settings → Environment Variables**, thêm:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: Supabase → Project Settings → API Keys → khoá **service_role** (hoặc **Secret key**, dạng `sb_secret_...`)
   - Tên biến **không có** tiền tố `VITE_`. Khoá này có toàn quyền với database, chỉ hàm server được dùng.
3. **Supabase → SQL Editor**, dán toàn bộ `supabase/schema.sql`, bấm **Run**.
   Từ lúc này bản v1.6 ngừng đọc được dữ liệu cho tới khi bản v1.7 deploy xong.
4. **GitHub**: chép các file v1.7 vào repository, **xoá** `src/artius-timesheet_v1_6.jsx`, rồi push. Vercel tự deploy.
5. Mở webapp. Lần đầu hiện màn **Tạo tài khoản quản lý**: đặt tên đăng nhập, mật khẩu và nhập **mã PIN quản lý đang dùng** ở v1.6.
6. Vào tab **Nhân sự**, bấm bút chì ở từng dòng để đặt tên đăng nhập và mật khẩu cho từng người.

Quy tắc: tên đăng nhập 3–30 ký tự (chữ thường không dấu, số, dấu chấm, gạch); mật khẩu tối thiểu 6 ký tự.

## Cài mới từ đầu

1. Supabase: tạo project, chạy `supabase/schema.sql`, chép **Project URL**, **anon / publishable key** và **service_role / secret key**.
2. GitHub: tạo repository (nên để **Private**), đưa toàn bộ thư mục lên. Không đưa `node_modules`, `dist`, `.env`.
3. Vercel: import repository (tự nhận là **Vite**), khai 3 biến `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, rồi **Deploy**. Thêm biến sau khi đã deploy thì phải **Redeploy**.
4. Mở webapp và tạo tài khoản quản lý đầu tiên.

## Chạy thử trên máy

`npm run dev` chỉ chạy phần giao diện, không có `/api/accounts`. Muốn chạy đủ cả hàm server thì dùng `vercel dev`
(cần Vercel CLI) với file `.env.local` có đủ 3 biến.

## Lưu ý bảo mật

- Mật khẩu lưu ở dạng **đọc được** trong bảng `artius_accounts` để ban quản lý xem lại. Bảng này không mở cho
  trình duyệt; chỉ hàm server đọc, và hàm server chỉ trả lời tài khoản có quyền quản lý. Ai vào được Supabase
  dashboard của project cũng xem được bảng này.
- Tên đăng nhập được ghép thành email nội bộ `<tên>@artius-time.local` để dùng với Supabase Auth. Không có thư nào
  được gửi đi. Muốn đổi phần đuôi thì đặt biến `VITE_LOGIN_DOMAIN` trên Vercel trước khi tạo tài khoản đầu tiên.
- Trong v1.7, việc "nhân viên chỉ sửa giờ công của mình" vẫn do **giao diện** quyết định: toàn bộ dữ liệu giờ công
  nằm chung một khoá, nên một tài khoản hợp lệ về mặt kỹ thuật vẫn đọc/ghi được cả khoá đó. Chặn ở database cần
  tách bảng theo nhân sự, là việc của bản nâng cấp sau.
