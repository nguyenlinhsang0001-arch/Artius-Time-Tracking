# ARTIUS — Quản lý giờ công · v1.6 (bản webapp cho Vercel)

Bản đóng gói của `artius-timesheet_v1_6.jsx` để chạy như một webapp độc lập.
Code ứng dụng giống hệt file `.jsx` cùng phiên bản. Phần thêm vào chỉ là lớp vỏ:

| File | Vai trò |
|---|---|
| `src/artius-timesheet_v1_6.jsx` | Ứng dụng v1.6 |
| `src/storage.js` | Thay `window.storage` của Claude bằng Supabase (dữ liệu chung) + localStorage (tuỳ chọn riêng từng máy) |
| `src/main.jsx`, `index.html`, `src/index.css` | Điểm khởi động, Tailwind |
| `supabase/schema.sql` | Tạo bảng `artius_kv` trên Supabase |
| `.env.example` | Mẫu 2 biến môi trường |

## Mới ở v1.6

- Tab Bảng công (ban quản lý) có 2 chế độ: **Ma trận giờ công** (hàng = nhân sự, cột = dự án, theo tháng, có tổng theo người và theo dự án, bấm tên để mở chi tiết) và **Chi tiết nhân viên** (bảng công cũ, xem và sửa từng người).
- Xuất Excel từ ma trận: sheet Ma trận, Chi tiết, Tình trạng nộp (theo bộ lọc đang chọn).
- Loại nghỉ (Vắng mặt) thêm / đổi tên / xoá ở tab Tác vụ.
- Không đổi cấu trúc Supabase, dữ liệu v1.5 mở được trong v1.6.

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

v1.5 chưa có đăng nhập tài khoản; mã PIN quản lý chỉ chặn ở giao diện. Trình duyệt
truy cập Supabase bằng anon key, nên **ai có đường link webapp đều có thể đọc/ghi dữ liệu
giờ công**. Chỉ chia sẻ link trong nội bộ. Tài khoản và phân quyền thật là việc của
một bản nâng cấp sau.
