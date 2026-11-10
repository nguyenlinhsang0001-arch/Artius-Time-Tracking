# ARTIUS TIME — ghi chú cho mỗi lần nâng cấp

- Trước khi nâng cấp: hỏi anh Sang có tạo folder mới và tăng version không.
- Version: `APP_VERSION` trong `src/core/ui.jsx`, ghi "Mới ở vX.YY" ở đầu `src/App.jsx`.
- Sau khi sửa code, chạy `npm run datamap` (sơ đồ cấu trúc + tự kiểm tra):
  - Đọc dòng `[CAO]` in ra màn hình; rủi ro cao mới phải báo anh Sang.
  - Có "Khối mới chưa có trong bản thiết kế" / "bản thiết kế trỏ tới thứ không còn" thì sửa `docs/cau-truc.json`
    (gắn khoá / bảng / hàm / file vào `bind` của ô phù hợp, hoặc thêm ô mới) rồi chạy lại.
  - Commit cả `docs/cau-truc.json` và `docs/cau-truc.lock.json`. File HTML ở `docs/so-do/` không commit
    (gitignore), chỉ sao lưu vào folder backup của version.
- Build thử ở máy cần `.env.local` có VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (giá trị giả cũng được),
  nếu không app bị tree-shake thành rỗng.
