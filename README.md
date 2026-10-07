# ARTIUS — Quản lý giờ công · v1.4 (bản webapp cho Vercel)

Bản đóng gói của `artius-timesheet_v1_4.jsx` để chạy như một webapp độc lập.
Code ứng dụng giữ nguyên 100% so với bản artifact. Phần thêm vào chỉ là lớp vỏ:

| File | Vai trò |
|---|---|
| `src/artius-timesheet_v1_4.jsx` | Ứng dụng v1.4, không sửa |
| `src/storage.js` | Thay `window.storage` của Claude bằng Supabase (dữ liệu chung) + localStorage (tuỳ chọn riêng từng máy) |
| `src/main.jsx`, `index.html`, `src/index.css` | Điểm khởi động, Tailwind |
| `supabase/schema.sql` | Tạo bảng `artius_kv` trên Supabase |
| `.env.example` | Mẫu 2 biến môi trường |

## 1. Supabase

1. Tạo project tại supabase.com.
2. Mở **SQL Editor**, dán toàn bộ `supabase/schema.sql`, bấm **Run**.
3. Vào **Project Settings → API**, chép **Project URL** và **anon / publishable key**.

## 2. GitHub

Tạo repository mới (nên để **Private**) rồi đưa toàn bộ nội dung thư mục này lên.
Không đưa `node_modules`, `dist`, `.env` (đã có trong `.gitignore`).

## 3. Vercel

1. **Add New → Project**, chọn repository vừa tạo. Vercel tự nhận là **Vite**
   (Build Command `npm run build`, Output Directory `dist`), không cần chỉnh.
2. Trong **Environment Variables**, thêm:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key
3. **Deploy**. Nếu thêm biến sau khi đã deploy thì phải **Redeploy** mới có hiệu lực.

## 4. Chuyển dữ liệu từ bản artifact

Trong bản artifact: mục **Sao lưu & khôi phục** → sao lưu ra file JSON.
Trong webapp: cũng mục đó → dán nội dung file sao lưu vào ô **Khôi phục**.

## Chạy thử trên máy

```
npm install
copy .env.example .env.local    (rồi điền 2 giá trị thật)
npm run dev
```

## Lưu ý bảo mật

v1.4 chưa có đăng nhập tài khoản; mã PIN quản lý chỉ chặn ở giao diện. Trình duyệt
truy cập Supabase bằng anon key, nên **ai có đường link webapp đều có thể đọc/ghi dữ liệu
giờ công**. Chỉ chia sẻ link trong nội bộ. Tài khoản và phân quyền thật là việc của
một bản nâng cấp sau.
