# ARTIUS — Quản lý giờ công · v2.9 (bản webapp cho Vercel)

| File | Vai trò |
|---|---|
| `src/artius-timesheet_v2_9.jsx` | Ứng dụng v2.9 |
| `src/push.js` | (v2.6) Xin quyền và đăng ký thông báo trên trình duyệt |
| `api/push.js`, `api/_reminders.js` | (v2.6) Hàm server gửi thông báo nhắc nộp bảng công + luật tính lịch / ngày thiếu |
| `public/sw.js`, `public/*.png` | (v2.6) Service worker hiện thông báo, biểu tượng thông báo |
| `supabase/cron.sql` | (v2.6) Lịch Supabase gọi `/api/push` 15 phút/lần |
| `src/data.js` | Đọc/ghi thiết lập và bảng công theo từng dòng trên Supabase (mới ở v1.8) |
| `src/merge.js` | Gộp thiết lập khi nhiều quản lý cùng sửa (mới ở v1.8) |
| `src/auth.js` | Đăng nhập / đăng xuất, gọi hàm server quản lý tài khoản |
| `src/storage.js` | Client Supabase dùng chung + tuỳ chọn riêng từng máy (localStorage) |
| `api/accounts.js` | Hàm server trên Vercel: tạo / sửa / khoá / xoá tài khoản |
| `src/main.jsx`, `index.html`, `src/index.css` | Điểm khởi động, Tailwind |
| `supabase/schema.sql` | Các bảng, phân quyền, khoá cứng ngày đã gửi, và phần tự chuyển dữ liệu từ v1.7 / v1.8 |

## Mới ở v2.9 — mục "Khác" cho tác vụ chung và vắng mặt

- Ô **Dự án** có thêm mục **"Khác"**, luôn nằm trên cùng. "Khác" gồm **tác vụ chung của công ty** (tác vụ không gắn vai trò)
  và **vắng mặt**. Chọn "Khác" thì **ô Giai đoạn ẩn đi**.
- Chọn một **dự án** thì ô Hạng mục chỉ còn **tác vụ gắn vai trò** của người đó (không còn tác vụ chung, không còn vắng mặt).
- Đổi dự án của một khối giữa "Khác" và dự án: hạng mục không hợp lệ tự đổi sang hạng mục hợp lệ đầu tiên.
- **Bỏ ô tìm thêm nhanh và chip gợi ý.** Nút **Thêm dòng** thêm ngay một dòng (dự án đang làm + tác vụ dự án chưa dùng;
  hết tác vụ dự án thì thêm vào "Khác"), sau đó chọn lại Dự án / Giai đoạn / Hạng mục bằng các ô chọn. Nút **+** ở đầu khối
  vẫn thêm hạng mục vào đúng khối đó. "Chép tuần trước" đưa tác vụ chung / vắng mặt vào "Khác".
- **Giờ cũ** đã chấm tác vụ chung dưới một dự án **giữ nguyên** (vẫn tính cho dự án đó), dòng cũ hiện nhãn "(tác vụ chung — dữ liệu cũ)".
- **Báo cáo:** cột "Vắng mặt" đổi thành **"Khác"** (tác vụ chung + vắng mặt) ở Dashboard, Ma trận giờ công, Excel; KPI
  "Giờ vắng mặt" vẫn tách riêng. "Khác" không tính là dự án và không có giai đoạn (không vào biểu đồ / sheet theo giai đoạn).
- **Database:** trigger không còn đòi giờ dự kiến cho dòng "Khác" (`schema.sql` mục 7c).

**Lưu ý trước khi deploy:** người có vai trò chưa có tác vụ nào (tab Tác vụ hiện 0) sẽ **không chấm được vào dự án**,
chỉ chấm được "Khác". Bổ sung tác vụ cho các vai trò đó trước.

**Nâng cấp từ v2.8:**
1. Supabase → SQL Editor: chạy nguyên `supabase/schema.sql` (BẮT BUỘC — thiếu bước này nhân sự sẽ bị chặn khi gửi giờ "Khác").
2. Trên GitHub thêm `src/artius-timesheet_v2_9.jsx`, **xoá** `src/artius-timesheet_v2_8.jsx`, thay `src/main.jsx`,
   `supabase/schema.sql`, `index.html`, `package.json`, `README.md`.

## Mới ở v2.8 — đưa cột "hôm nay" về kiểu nền xám

- Bản v2.7 đã deploy có cột hôm nay viền xanh (bản thử giữa chừng). v2.8 đưa về kiểu đã chốt: cột hôm nay **nền xám
  sáng hơn một chút**, không viền; ô chú thích "Hôm nay" màu xám; ngày tương lai vẫn mờ. Mobile tương tự.

**Nâng cấp từ v2.7:** database không đổi, không cần chạy SQL. Trên GitHub thêm `src/artius-timesheet_v2_8.jsx`,
**xoá** `src/artius-timesheet_v2_7.jsx`, thay `src/main.jsx`, `index.html`, `package.json`, `README.md`.

## Mới ở v2.7 — chỉnh giao diện màn Chấm công

- Chú thích **"Hôm nay"** chuyển lên hàng chú thích đầu màn Chấm công (sau "Nghỉ phép").
- **Bảng lịch chọn tuần** bỏ hết các dòng chú thích màu; vẫn giữ nút "Hôm nay" ở đáy lịch.
- **Cột ngày hôm nay** có nền sáng hơn một chút; **các ngày tương lai** mờ đi. Áp dụng cả bảng giờ (máy tính)
  lẫn hàng thẻ ngày (mobile).

**Nâng cấp từ v2.6:** database không đổi, không cần chạy SQL. Trên GitHub thêm `src/artius-timesheet_v2_7.jsx`,
**xoá** `src/artius-timesheet_v2_6.jsx`, thay `src/main.jsx`, `index.html`, `package.json`, `README.md`.
Nếu chưa deploy v2.6: làm đủ 5 bước của v2.6 bên dưới, chỉ thay file `.jsx` v2.6 bằng file v2.7.

## Mới ở v2.6 — Thông báo nhắc nộp bảng công trên máy tính

- **Thông báo hiện ở góc màn hình (Notifications của Windows)**, kể cả khi không mở ARTIUS. Trình duyệt đang tắt thì
  thông báo được giữ tối đa 3 ngày và hiện ngay khi bật Chrome / Edge lên. Nhiều lần nhắc chưa xem thì chỉ giữ lần mới nhất.
- **Chỉ gửi cho nhân sự còn ngày chưa gửi** (cùng luật với "Tình trạng nộp": ngày có giờ chuẩn > 0, không phải ngày lễ, đã tới).
- **Lịch mặc định:** thứ Hai 09:30 nhắc tuần trước; ngày cuối tháng → mùng 2, 09:30 mỗi sáng nhắc chốt bảng công tháng.
  Quản lý sửa ở **Thiết lập → Nhắc nộp bảng công** (thứ, giờ, tới ngày mấy, bật/tắt từng loại). Gửi trong vòng 15 phút sau giờ đã chọn.
- **Bấm vào thông báo** mở thẳng đúng tuần cần gửi.
- **Quyền thông báo:** app không hiện hộp hỏi riêng. Ngay khi bấm **Đăng nhập** (người đang đăng nhập sẵn: cú bấm đầu tiên
  trong app), trình duyệt tự hiện hộp "Cho phép thông báo" của nó — bấm Cho phép một lần duy nhất. Đây là quy định của
  Chrome / Edge, không bỏ qua được bằng code.
- **Quản lý theo dõi** ở Thiết lập: số nhân sự đã bật thông báo, tên người chưa bật, các lần nhắc gần nhất, nút gửi thử.
  Nhân sự xem trạng thái và gửi thử ở **Cài đặt → Thông báo**.

**Nâng cấp từ v2.5 (theo đúng thứ tự):**
1. **Vercel → Settings → Environment Variables:** thêm 4 biến `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `CRON_SECRET` (giá trị nằm trong file khoá riêng, KHÔNG đưa lên GitHub).
2. **Supabase → SQL Editor:** chạy nguyên `supabase/schema.sql` (thêm 2 bảng `artius_push`, `artius_push_log`).
3. **GitHub:** thêm `src/artius-timesheet_v2_6.jsx`, **xoá** `src/artius-timesheet_v2_5.jsx`; thêm mới `src/push.js`,
   `api/push.js`, `api/_reminders.js`, thư mục `public/` (sw.js, icon-192.png, icon-96.png, badge-96.png), `supabase/cron.sql`;
   thay `src/main.jsx`, `supabase/schema.sql`, `index.html`, `package.json` (thêm thư viện `web-push`), `README.md`.
   Vercel tự build lại. Nếu repo có `package-lock.json` mà build báo thiếu `web-push`, xoá `package-lock.json` rồi đẩy lại.
4. **Supabase → Database → Extensions:** bật `pg_cron` và `pg_net`. Sau đó SQL Editor chạy `supabase/cron.sql`
   (bản đã điền sẵn mã nằm cạnh file khoá riêng).
5. Đăng nhập lại ARTIUS → cho phép thông báo → Thiết lập → **Gửi thử tới máy này** để kiểm tra.

## Mới ở v2.5 — chỉ chấm công vào giai đoạn đã có giờ dự kiến

- **Nhân sự chỉ thấy giai đoạn có giờ dự kiến.** Ở màn chấm công, ô chọn giai đoạn của mỗi dự án chỉ liệt kê các phase
  đã nhập giờ dự kiến > 0 ở tab Dự án. Dự án chưa nhập giờ dự kiến ở phase nào thì **không hiện** để chấm.
  Áp dụng cho ô thêm nhanh, chip gợi ý, "Chép tuần trước" và khi đổi dự án của một khối (giai đoạn tự chuyển sang phase hợp lệ).
- **Dòng cũ** đã chấm vào phase chưa có giờ dự kiến vẫn giữ nguyên, chỉ để xem (giống dự án đã đóng). Quản lý nhập
  giờ dự kiến cho phase đó là nhân sự chấm tiếp được.
- **Quản lý không bị giới hạn** (Chi tiết nhân viên vẫn chọn được mọi giai đoạn đang dùng).
- **Database cũng chặn:** trigger `artius_ts_guard` từ chối nhân sự thêm / sửa / xoá giờ ở phase chưa có giờ dự kiến
  (`schema.sql` mục 7c). Vắng mặt không bị ảnh hưởng.

**Lưu ý trước khi deploy:** dự án nào đang cần chấm công thì nhập giờ dự kiến cho đúng phase đang làm ở tab Dự án trước,
nếu không nhân sự sẽ không thấy dự án đó.

**Nâng cấp từ v2.4:**
1. Supabase → SQL Editor: chạy nguyên `supabase/schema.sql` (chạy lại không ảnh hưởng dữ liệu).
2. Trên GitHub thêm `src/artius-timesheet_v2_5.jsx`, **xoá** `src/artius-timesheet_v2_4.jsx`, thay `src/main.jsx`,
   `supabase/schema.sql`, `index.html`, `package.json`, `README.md`. Thanh bên (máy tính) ghi `ARTIUS v2.5`.

## Mới ở v2.4 — sửa sau đợt test tài khoản quản lý 13/10/2026

- **Mobile:** thẻ tuần ở màn chấm công không còn tràn ở màn hình hẹp (375px). Nhóm "Đã gửi + tổng giờ" tự xuống dòng
  và căn phải khi không đủ chỗ; ngày của tuần không bị ngắt dòng.
- **Không hỏi oan khi chuyển tuần.** Nhân sự chỉ thêm dòng trống (chưa nhập giờ) rồi chuyển tuần / đổi tab / đóng trang
  thì không còn bị hỏi "giờ sẽ mất". Chỉ hỏi khi thật sự có giờ ở ngày chưa gửi. Quản lý giữ nguyên như cũ.
- **Nhãn phiên bản** trên máy tính nằm trong thanh bên, dưới nút Thoát, không còn đè lên nút.
- **Database:** khoá 3 hàm tính toán nội bộ (`artius_day_hours`, `artius_proj_hours`, `artius_future_work`) với người
  chưa đăng nhập (`schema.sql` mục 12).

**Nâng cấp từ v2.3:**
1. Supabase → SQL Editor: chạy nguyên `supabase/schema.sql` (chạy lại không ảnh hưởng dữ liệu).
2. Trên GitHub thêm `src/artius-timesheet_v2_4.jsx`, **xoá** `src/artius-timesheet_v2_3.jsx`, thay `src/main.jsx`,
   `supabase/schema.sql`, `index.html`, `package.json`, `README.md`. Thanh bên (máy tính) ghi `ARTIUS v2.4`.
3. Khuyến nghị (không cần sửa code): Vercel → Settings → Functions → Function Region chọn **Singapore (sin1)** rồi
   Redeploy, để đăng nhập / quản lý tài khoản không phải đi vòng qua Mỹ.

## Mới ở v2.3 — sửa sau đợt chạy thử 13/10/2026

- **Không chấm giờ làm việc cho ngày chưa tới.** Nhân sự chỉ nhập và gửi giờ làm việc từ hôm nay trở về trước; ô của
  ngày sau hôm nay bị khoá. **Vắng mặt** (nghỉ phép…) vẫn đăng ký trước được. Quản lý không bị giới hạn.
  Trigger `artius_ts_guard` cũng chặn (mục 7b của `schema.sql`). Giờ tương lai đã gửi từ trước vẫn giữ nguyên,
  cần sửa thì quản lý mở khoá.
- **Gỡ mã PIN cũ (v1.6) khỏi thiết lập dùng chung.** Trước đây mọi tài khoản đọc được PIN này. App không còn ghi PIN,
  `schema.sql` mục 10 xoá PIN khỏi `artius_config` và `artius_kv`.
- **Hàm `artius_usage` báo 404 trên bản đang chạy** = database chưa chạy SQL của v2.1. Chạy `schema.sql` của v2.3 là có
  (mục 11 bắt Supabase nạp lại danh sách hàm ngay).
- **Chip gợi ý** ở thanh thêm nhanh bỏ tác vụ đã xoá / không còn thuộc bộ phận và giai đoạn đã ngừng dùng.
- **Mobile:** nhãn "Đã gửi" gọn một dòng, bỏ nhãn phiên bản đè lên nội dung, rút ngắn chữ gợi ý ô tìm kiếm.

**Nâng cấp từ v2.2:**
1. Supabase → SQL Editor: chạy nguyên `supabase/schema.sql` (chạy lại không ảnh hưởng dữ liệu).
2. Trên GitHub thêm `src/artius-timesheet_v2_3.jsx`, **xoá** `src/artius-timesheet_v2_2.jsx`, thay `src/main.jsx`,
   `supabase/schema.sql`, `index.html`, `package.json`, `README.md`. Góc trái dưới của app (máy tính) ghi `ARTIUS v2.3`.

## Mới ở v2.2 — chuẩn bị chạy thật cho 50+ người

- **Tự cập nhật nhẹ hơn.** Lần hỏi định kỳ chỉ lấy danh sách "dòng nào đổi lúc mấy giờ" (vài trăm byte), rồi chỉ tải nội dung
  đúng dòng đổi. Quản lý hỏi 30 giây/lần (trước 10 giây), nhân sự 60 giây/lần; máy để yên quá 10 phút thì ngừng hỏi,
  chạm chuột / gõ phím là hỏi ngay. Giảm mạnh dung lượng tải ra (egress) của Supabase.
- **Mở app nhanh hơn.** Thư viện Excel (khoảng 430 KB) chỉ tải khi bấm xuất file.
- **Mất mạng.** Hiện dải "Mất kết nối tới máy chủ — đang thử lại"; có mạng lại thì tự gửi lại phần đang chờ (giờ vẫn giữ trên màn hình).
- **Màn hình hỏng** hiện thông báo + nút tải lại thay vì trang trắng.

**Nâng cấp từ v2.1:** database không đổi, không cần chạy lại SQL. Trên GitHub thêm `src/artius-timesheet_v2_2.jsx`,
**xoá** `src/artius-timesheet_v2_1.jsx`, thay `src/main.jsx`, `src/data.js`, `index.html`, `package.json`, `README.md`.
Góc trái dưới của app ghi `ARTIUS v2.2`.

## Có từ v2.1

- **Mở app nhanh hơn khi dữ liệu nhiều.** Lúc đăng nhập chỉ tải bảng công **6 tháng gần nhất** (tính cả tháng này).
  Tháng cũ hơn tự tải khi có màn hình cần tới: chọn kỳ cũ ở Dashboard, lùi tháng ở Bảng công, lùi tuần hoặc mở lịch
  ở màn chấm công. Mỗi tháng cũ chỉ tải một lần cho tới khi đăng xuất. Xuất file sao lưu vẫn tải đủ mọi tháng.
- **Tổng giờ từ trước tới nay do database tính.** Ô "đã gửi / dự kiến" ở tab Dự án và số giờ trên thẻ giai đoạn
  (Thiết lập) lấy từ hàm `artius_usage` (mục 9 của `schema.sql`), nên vẫn đủ dù app chỉ giữ 6 tháng trong bộ nhớ.
  Nếu chưa chạy SQL mới, app tạm cộng từ 6 tháng đang có và **không cho xoá giai đoạn** cho tới khi hỏi được database.
- **Sửa lỗi nút Xuất Excel ở Dashboard cá nhân của nhân sự** (lỗi `byPhase` có từ v1.6). Sheet "Theo giai đoạn" giờ
  chỉ tính giờ làm việc, không tính vắng mặt.

**Nâng cấp từ v2.0:** chạy lại toàn bộ `supabase/schema.sql` (thêm hàm `artius_usage`, chạy lại không ảnh hưởng dữ liệu).
Trên GitHub thêm `src/artius-timesheet_v2_1.jsx`, **xoá** `src/artius-timesheet_v2_0.jsx`, thay `src/main.jsx`, `src/data.js`,
`index.html`, `package.json`, `README.md`. Góc trái dưới của app ghi `ARTIUS v2.1`.

## Có từ v2.0

- **Cảnh báo thiếu bảng công chỉ tính ngày đã tới** (tính cả hôm nay). Tuần chưa bắt đầu không bị báo thiếu và không tính
  vào "Số tuần cần nộp"; tuần đang chạy chỉ cần gửi đủ các ngày từ thứ Hai tới hôm nay. Áp dụng cho dải cảnh báo của nhân sự,
  Dashboard, tab Bảng công và sheet "Tình trạng nộp".
- **Bỏ dòng thông báo "Đã gửi và khoá: T2, T3…"** trên màn chấm công. Ô ngày đã gửi vẫn khoá và vẫn có biểu tượng ổ khoá ở đầu cột.

**Nâng cấp từ v1.9:** `supabase/schema.sql` không đổi so với bản v1.9 cuối cùng, không cần chạy lại SQL. Trên GitHub thêm
`src/artius-timesheet_v2_0.jsx`, **xoá** `src/artius-timesheet_v1_9.jsx`, thay `src/main.jsx`, `index.html`, `package.json`, `README.md`.
Góc trái dưới của app ghi `ARTIUS v2.0`.

## Có từ v1.9 — quy trình gửi và khoá bảng công

- **Bỏ Lưu nháp.** Giờ nhân sự nhập chỉ nằm trên màn hình cho tới khi bấm **Gửi giờ công**.
  Đóng trang, đổi tuần hoặc đổi tab khi chưa gửi đều được hỏi lại, vì giờ đang nhập sẽ mất.
- **Gửi là khoá cứng, theo từng ngày.** Bấm Gửi thì những ngày đang có giờ và chưa gửi được ghi lên hệ thống và khoá lại.
  Ngày chưa nhập vẫn để mở, nhập và gửi sau được. Ngày đã gửi thì khoá cả ngày: không sửa giờ, không thêm giờ
  dự án khác vào ngày đó. Nhân sự không tự mở được.
  Quản lý mở ở **Bảng công → Chi tiết nhân viên → Mở khoá tuần này** (mở mọi ngày đã gửi của tuần đang xem).
- **Database cũng chặn.** Trigger `artius_ts_guard` từ chối mọi thay đổi của nhân sự lên ngày đã gửi
  (sửa giờ, thêm giờ, tự gỡ dấu đã gửi, xoá dòng), kể cả khi gọi thẳng database.
- **Quản lý chỉ tổng hợp giờ đã gửi.** Dashboard, Ma trận giờ công, các file Excel và cột "Dự án đang tham gia"
  chỉ cộng giờ của ngày có dấu đã gửi. Ngày đang được mở khoá tạm không tính cho tới khi nhân sự gửi lại.
- **Tình trạng nộp theo tuần.** Một tuần tính là đã nộp khi mọi ngày phải chấm công của tuần (ngày có giờ chuẩn
  lớn hơn 0 và không phải ngày lễ) đều đã gửi. Ngày nghỉ thì chấm bằng dòng Vắng mặt rồi gửi.
- **Dự án đã đóng thì không chấm công được nữa.** Nhân sự không chọn được dự án đã đóng, dòng đang có của dự án đó
  chỉ để xem, và "Chép tuần trước" bỏ qua dự án đã đóng. Cần chấm thêm thì quản lý mở lại dự án ở tab Dự án.
  Quản lý vẫn sửa được giờ ở Chi tiết nhân viên. Trigger `artius_ts_guard` cũng từ chối nhân sự thêm / sửa / xoá
  giờ của dự án đã đóng. Số liệu của dự án chỉ là một khối giờ công, không phân biệt trước hay sau khi đóng.
- **Giờ dự kiến chia theo phase.** Tab Dự án nhập giờ dự kiến cho từng phase P1–P4 (lưu ở `project.budgets`), Tổng tự cộng.
  Mỗi ô phase hiện giờ đã gửi / giờ dự kiến, tính trên toàn bộ thời gian của dự án. Dashboard hiện mỗi dự án 4 thanh
  theo phase kèm mốc dự kiến (theo kỳ và bộ lọc đang chọn), file Excel của Dashboard có thêm sheet "Dự kiến theo phase".
  Số giờ dự kiến tổng kiểu cũ (một con số cho cả dự án) không còn được dùng: nhập lại theo từng phase.
- **Giai đoạn dự án sửa được** (Thiết lập → Giai đoạn dự án, lưu ở `config.phases`). Bấm tên / mô tả để sửa, thêm giai đoạn mới
  (mã kế tiếp P5, P6…). Giai đoạn chưa có giờ công và giờ dự kiến thì xoá được; đã có thì chỉ ngừng dùng: nhân sự không chọn
  được nữa, giờ cũ vẫn giữ trong báo cáo. Phải còn ít nhất một giai đoạn đang dùng.
- **Tự cập nhật.** Máy quản lý hỏi server 10 giây một lần (chỉ lấy dòng vừa thay đổi), máy nhân sự 60 giây
  một lần và khi quay lại tab. Chỉ chạy khi tab đang hiện.
- **Dữ liệu cũ.** `schema.sql` đánh dấu "đã gửi" một lần cho mọi ngày cũ đang có giờ, để số liệu không bị hụt.

Quản lý vẫn sửa trực tiếp được bảng công của nhân viên (nút **Lưu thay đổi**). Giờ quản lý nhập thêm vào ngày chưa gửi
chỉ được tính sau khi bấm **Đánh dấu đã gửi**.

## Có từ v1.8 — tách bảng dữ liệu

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

## Nâng cấp từ v1.7 hoặc v1.8 — làm đúng thứ tự

Không cần thêm hay sửa biến môi trường nào trên Vercel.

1. **Sao lưu.** Mở bản đang chạy → Thiết lập → Sao lưu & khôi phục → Xuất file sao lưu.
   Nhắc mọi người **gửi hoặc ghi lại giờ đang nhập dở** trước giờ nâng cấp.
2. **Supabase → SQL Editor**: dán toàn bộ `supabase/schema.sql`, bấm **Run**.
   File này tự tạo các bảng mới, chép dữ liệu từ `artius_kv` sang (nếu chưa chép), chuyển `artius_kv` thành chỉ đọc,
   đánh dấu đã gửi cho các ngày cũ đang có giờ, và bật khoá cứng.
   Từ lúc này bản v1.7 vẫn xem được dữ liệu nhưng **không lưu được** (báo "Chưa ghi được").
3. **Kiểm tra** trong Table Editor: `artius_config` có 1 dòng `main`; `artius_ts` có các dòng dạng mã nhân sự + tháng;
   `artius_meta` có dòng `sent_day_migration_v1_9`.
4. **GitHub**: chép các file v1.9 vào repository (nhớ có `src/data.js` và `src/merge.js`), **xoá** file `src/artius-timesheet_v1_7.jsx` hoặc `_v1_8.jsx` cũ, commit. Vercel tự deploy.
5. Mở webapp, bấm Ctrl + F5. Góc trái dưới ghi `ARTIUS v2.2`, dữ liệu cũ có đủ.
6. Nhắn mọi người **tải lại trang**. Ai còn mở bản cũ sẽ thấy lỗi khi bấm lưu, tải lại là lên v1.9.

Chạy lại `schema.sql` về sau là an toàn: phần chép dữ liệu chỉ chạy khi `artius_config` còn trống,
phần đánh dấu đã gửi chỉ chạy một lần (ghi dấu trong `artius_meta`).

### Quay lại v1.7 nếu cần

Vercel → Deployments → bản v1.7 → Promote to Production, rồi chạy trong SQL Editor:

```sql
grant select, insert, update, delete on public.artius_kv to authenticated;
drop policy if exists "artius_kv_member_read" on public.artius_kv;
create policy "artius_kv_member_all" on public.artius_kv
  for all to authenticated
  using ((select public.artius_is_member())) with check ((select public.artius_is_member()));
```

Lưu ý: giờ công nhập trong thời gian chạy v1.8 / v1.9 nằm ở bảng mới, bản v1.7 sẽ không thấy.

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
- Gửi chỉ khoá **những ngày đã có giờ**. Gửi thứ Hai xong, thứ Ba vẫn nhập và gửi bình thường. Muốn sửa ngày đã gửi thì nhờ quản lý mở khoá.
- Quản lý mở khoá theo **cả tuần**: mọi ngày đã gửi của tuần đó mở lại, giờ vẫn nằm trên hệ thống nhưng tạm không được tính cho tới khi nhân sự gửi lại.
