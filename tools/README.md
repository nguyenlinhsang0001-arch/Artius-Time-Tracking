# Sao lưu & khôi phục ARTIUS TIME

Từ v13.62: **sao lưu bấm trong app, khôi phục chạy bằng script trên máy.**
Không cân xứng là cố ý — sao lưu phải dễ để thực sự có người làm, khôi phục phải khó để không ai bấm nhầm.

## 1. Sao lưu (trong app)

Đăng nhập Admin → tab **Thiết lập** → khối **Sao lưu** → **Xuất file sao lưu**.

File `ARTIUS_saoluu_<ngày>.json` chứa nguyên dạng bốn thứ không tạo lại được:

| Trong file | Lấy từ |
| --- | --- |
| `config` | `artius_config` — nhân sự, dự án, tác vụ, vai trò, ngày lễ, khung OT, thiết lập |
| `timesheets` | `artius_ts` — bảng công **mọi người, mọi tháng** |
| `plan` | `artius_plan` — lưới kế hoạch |
| `snapshots` | `artius_plan_snapshot` — các bản chốt |

Dòng tổng kết ngay dưới nút cho biết số dòng đã xuất. Đối chiếu với số dòng trên Supabase nếu nghi ngờ.

**Không có trong file:** `artius_accounts` (tài khoản và mật khẩu — trình duyệt không đọc được bảng này),
`artius_push` và `artius_push_log` (đăng ký thiết bị nhận thông báo, dựng lại được khi người dùng đăng nhập lại).
Khôi phục xong, tài khoản đăng nhập phải tạo lại nếu project Supabase là project mới.

**Chạy khi nào:** trước mỗi lần nâng cấp chạm vào dữ liệu, và cuối mỗi tháng trước khi chốt công.

## 2. Chuẩn bị máy (làm một lần)

Chỉ cần **Node 18 trở lên**. Không cần `npm install`, không cần clone repo: script không dùng thư viện nào,
nó gọi thẳng REST API của Supabase bằng `fetch` có sẵn trong Node. Chạy được ngay trong folder phiên bản
trên `D:\Time-Tracking`.

Kiểm tra Node: mở PowerShell, gõ `node -v`. Chưa có thì tải ở nodejs.org (bản LTS).

Tạo file `tools/.env` **cạnh file script**:

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE=eyJhbGciOi...
```

Lấy hai giá trị ở Supabase → **Project Settings → API**. Dùng key **`service_role`**, không phải `anon`.

`service_role` bỏ qua mọi phân quyền. **Không commit file này lên GitHub, không gửi qua chat, không để trên máy chung.**
`tools/.env` đã nằm trong `.gitignore`.

## 3. Xem trước (không ghi gì)

```
node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json
```

In ra file có gì, server đang có gì, rồi dừng. Luôn chạy bước này trước.

## 4. Khôi phục

Hai chế độ, khác nhau ở chỗ xử lý dòng server có mà file không có.

**Ghi đè, không xoá** — mặc định. Dùng khi mất hoặc hỏng một phần.

```
node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json --yes
```

**Giống hệt file** — xoá sạch bảng công và bảng kế hoạch rồi nạp lại. Dùng khi muốn quay về đúng thời điểm sao lưu.
Không lùi lại được.

```
node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json --yes --wipe
```

Script tự in lại số dòng sau khi ghi để đối chiếu với file. Sau đó mở app, tải lại trang, kiểm tra vài bảng công và lưới kế hoạch.

Bản chốt được nạp lại **không kèm id cũ**: database tự cấp id mới, nên bấm "Chốt bản" ngay sau khi khôi phục vẫn chạy bình thường. App tìm bản chốt theo nhãn, nên id đổi cũng không ảnh hưởng gì. Bản chốt đã có sẵn trên server (trùng năm · nhãn · thời điểm chốt) thì bỏ qua, không nhân đôi.

## 5. Thử khôi phục — bắt buộc một lần

**Một bản sao lưu chưa thử khôi phục thì chưa coi là có sao lưu.** Thử một lần, không đụng tới dữ liệu thật:

1. Tạo một project Supabase mới (Free, đặt tên `artius-test-restore`)
2. Chạy lần lượt các file trong `supabase/` để dựng bảng và hàm
3. Trỏ `tools/.env` sang project mới, chạy `--yes --wipe` với file sao lưu
4. Tạo một tài khoản Admin trong project đó rồi mở app trỏ vào nó, kiểm tra dữ liệu
5. Xoá project test

Làm xong bước này mới coi là qua cổng Vòng 0.

## Vì sao khôi phục không nằm trong app

Trước v13.62 tab Thiết lập có ô dán nội dung file rồi bấm khôi phục. Hai vấn đề: nó ghi đè toàn bộ thiết lập
và bảng công chỉ bằng một nút trong giao diện, và nó không hề đụng tới hai bảng kế hoạch — khôi phục xong là
mất sạch lưới kế hoạch mà không báo gì. Phần đó đã bỏ.
