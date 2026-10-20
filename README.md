# ARTIUS — Quản lý giờ công · v6.7 (bản webapp cho Vercel)

## CÁCH CẬP NHẬT — từ v3.0 trở đi chỉ 2 bước

Folder này **giống hệt cấu trúc repo trên GitHub**. Không cần nhặt từng file nữa.

1. **Supabase → SQL Editor → New query:** dán toàn bộ `supabase/schema.sql` → **Run**
   (chạy lại nhiều lần không mất dữ liệu; bản nào có đổi database thì bước này bắt buộc).
2. **GitHub → repo → Add file → Upload files:** kéo **toàn bộ nội dung** folder này (mọi file và thư mục con,
   kể cả file bắt đầu bằng dấu chấm) vào ô upload → **Commit changes**. File trùng tên tự được ghi đè.
   Vercel tự build lại; vào Vercel → Deployments chờ **Ready**, rồi mở app bấm Ctrl+F5. Góc trái dưới ghi `ARTIUS v6.7`.

Ghi chú:
- Từ v3.0 file ứng dụng chính có **tên cố định `src/App.jsx`** — các bản sau ghi đè đúng file này, không phải xoá file cũ.
  Các file `src/artius-timesheet_v2_x.jsx` cũ còn trong repo không ảnh hưởng gì (không được dùng); muốn gọn thì xoá tay.
- Không có file khoá bí mật nào trong folder này. Khoá thông báo (VAPID, CRON_SECRET) nằm riêng ở
  `D:\Time-Tracking\KHOA_BI_MAT_v2_6\` — chỉ cần làm một lần (xem mục v2.6 bên dưới).

| File | Vai trò |
|---|---|
| `src/App.jsx` | Ứng dụng (tên cố định từ v3.0) |
| `src/main.jsx`, `index.html`, `src/index.css` | Điểm khởi động, Tailwind |
| `src/data.js`, `src/merge.js`, `src/storage.js`, `src/auth.js`, `src/push.js` | Đọc/ghi Supabase, đăng nhập, thông báo |
| `api/accounts.js`, `api/push.js`, `api/_reminders.js` | Hàm server trên Vercel: tài khoản, thông báo nhắc |
| `public/` | Service worker, `manifest.webmanifest` (cài app), biểu tượng app và thông báo |
| `supabase/schema.sql`, `supabase/cron.sql` | Database và lịch nhắc |
| `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `.env.example` | Cấu hình build |

## Mới ở v6.7 — Bảng công bớt màu, tập trung vào giờ đã gửi

**Không cần chạy lại `schema.sql`** (nếu đã chạy bản v6.6) — chỉ upload code.

- Ô **nháp chưa gửi** chỉ hiện số mờ, không nền sọc cam.
- **Thanh Tổng / chuẩn** chỉ vẽ giờ đã gửi; không ghi "thiếu x" khi phần còn thiếu đã có giờ nháp. Sọc vàng "thiếu" chỉ còn khi kể cả nháp vẫn chưa đủ chuẩn.
  KPI "Thiếu giờ chuẩn" cùng quy tắc.
- Cột **Nộp tuần**: ẩn "Còn nháp" của tuần đang chạy (tuần đã qua chưa nộp vẫn báo). Bảng Tháng: chấm tuần đang chạy còn nháp màu xám.
- KPI "Chưa nộp / còn nháp" màu trung tính. Bỏ dòng ghi chú "Rê chuột vào ô…". **Chuông nhắc giữ màu.**

## Mới ở v6.6 — Tác vụ đã xoá không còn xuất hiện

**BẮT BUỘC chạy lại `supabase/schema.sql`** (thêm hàm `artius_purge_tasks`, `artius_orphan_tasks`), rồi upload code.

- **Xoá tác vụ = xoá luôn giờ công đã chấm vào tác vụ đó**, kể cả dòng tăng ca "cho tác vụ" đó. Không còn "(tác vụ đã xoá)" ở bất kỳ đâu.
  Hộp xác nhận ghi rõ số giờ sẽ mất. **Không khôi phục được** — nên xuất Excel / sao lưu trước khi xoá tác vụ đã có giờ.
- Ngày nào không còn giờ sau khi xoá thì bỏ luôn dấu "đã gửi" của ngày đó.
- **Xoá vai trò** cũng xoá giờ của các tác vụ bị xoá theo vai trò.
- **Giờ của tác vụ đã xoá từ trước:** tab Tác vụ hiện khung vàng "Còn x h chấm vào n tác vụ đã xoá" → **Xoá hẳn** (có xác nhận).
- **Dashboard → Nhân sự:** thêm lọc nhanh **Tuần trước** (thứ Hai → Chủ nhật tuần trước).
- **Tìm không dấu:** ô tìm nhân sự (Dashboard, Bảng công) và tìm dự án (Tiến độ dự án) gõ "nguyen linh sang" vẫn ra "Nguyễn Linh Sang".
- Vắng mặt (loại nghỉ) không thuộc phạm vi này — xoá loại nghỉ vẫn giữ giờ đã chấm.

## Mới ở v6.5 — Sửa lỗi sau đợt kiểm tra số liệu

**BẮT BUỘC chạy lại `supabase/schema.sql`** (Supabase → SQL Editor → dán toàn bộ → Run), rồi upload code.

- **Dashboard → Tiến độ dự án → chi tiết giai đoạn:** bảng "Tăng ca theo tác vụ" trống từ v6.3 vì database chỉ nhận
  hạng mục [OT] cũ. Nay nhận cả khung tăng ca chung (Thiết lập → Tăng ca) và mã [OT] cũ đã chuyển đổi.
- **Dashboard → Nhân sự:** giờ chuẩn của hôm nay chỉ tính cho người đã gửi giờ hôm nay — khớp Bảng công
  (trước đây ai cũng "thiếu 8 h" nên gần như cả công ty bị xếp Thiếu giờ). Excel "Theo nhân sự" cùng quy tắc.
- **Bảng công → Tháng:** ô "Đã nộp đủ" chỉ xét các tuần đã qua (tuần đang chạy chưa tới hạn), khớp chuông Nhắc.

## Mới ở v6.4 — Bảng công dễ đọc hơn, nhắc cả tháng

**Không cần chạy lại `schema.sql`** — chỉ upload code (có sửa `api/push.js`).

- **Nghỉ phép màu cam đất** ở Bảng công (Tuần + Tháng), không còn lẫn với ô xanh "đủ giờ chuẩn".
- **Thanh Tổng / chuẩn chia khúc:** xanh dương = giờ chuẩn (làm việc + vắng mặt) · tím = giờ cố gắng · xanh ngọc = OT ·
  sọc vàng = phần còn thiếu, kèm chữ "thiếu x h" (vàng khi dưới ngưỡng Thiếu giờ ở Thiết lập).
- **Sửa lỗi "ai cũng vàng":** giờ chuẩn của hôm nay chỉ tính khi người đó đã gửi giờ hôm nay; hôm nay chưa chấm không bị coi là bỏ trống.
- **Bảng Tháng có cột Nhắc:** chuông kèm số tuần chưa nộp (chỉ các tuần đã qua). Bấm một lần → gửi **một** thông báo liệt kê mọi tuần thiếu.
  Đã nhắc → dấu ✓ (rê chuột xem giờ nhắc). Nút "Nhắc tất cả" ở tiêu đề cột. Nhật ký ghi theo từng tuần.

## Mới ở v6.3 — Tăng ca thành cài đặt chung

**Không cần chạy lại `schema.sql`** (database không đổi) — chỉ upload code.

- **Thiết lập → Tăng ca:** các khung giờ (bắt đầu – kết thúc) + hệ số, cộng hệ số Chủ nhật / ngày lễ. Áp cho **mọi nhân sự, mọi vai trò**.
  Mặc định 17:30 – 21:00 ×1.5 · 21:00 – 0:00 ×2 · 0:00 – 8:00 ×2. Thêm / sửa khung thoải mái; đổi giờ của khung không mất giờ đã chấm.
  Khung đang có giờ chấm thì không xoá được.
- **Tab Tác vụ không còn dòng [OT].** Tạo / đổi tên tác vụ bắt đầu bằng "[OT]" bị chặn kèm hướng dẫn — xoá tác vụ không còn làm mất tăng ca.
- **Tự chuyển đổi:** lần đầu tài khoản quản lý mở v6.3, các hạng mục [OT] theo vai trò được gộp thành khung chung theo giờ
  (giữ hệ số đã đặt), rồi gỡ khỏi tab Tác vụ. Giờ OT đã chấm giữ nguyên (app đọc mã cũ như khung tương ứng).
- **Giờ OT của hạng mục [OT] đã xoá trước đây:** Thiết lập → Tăng ca hiện khung vàng "chọn khung giờ để gán lại" → chọn khung → Gán.
- **Màn chấm công nhân viên giữ nguyên:** dòng tăng ca vẫn là "Tăng ca cho tác vụ" + "Khung giờ", không hiện hệ số.

## Mới ở v6.2 — Bảng chấm công dễ nhìn hơn

Không đổi database — **bỏ qua bước 1**, chỉ upload folder lên GitHub.

- Khối dự án: bỏ dòng tiêu đề "Công việc dự án" — tác vụ nằm ngay dưới ô chọn dự án / giai đoạn.
- Khối "Khác": hai nhóm **Công việc chung** (nhãn xanh ngọc) và **Vắng mặt** (nhãn xanh nhạt) hiện thành nhãn màu bo tròn,
  kèm chú thích ngắn và đường kẻ mảnh, cách tác vụ bên dưới một khoảng — dễ phân biệt khi chấm công.
- Áp dụng cho cả màn nhân viên chấm công và ngăn kéo sửa giờ của quản lý (cùng một bảng); màn điện thoại cũng đổi theo.

## Mới ở v6.1 — Sửa lỗi vị trí hộp sửa nhanh, bỏ tab Chi tiết nhân viên

Không đổi database — **bỏ qua bước 1**, chỉ upload folder lên GitHub.

- Hộp sửa nhanh khi bấm ô ngày luôn nằm trọn trong màn hình: đặt dưới ô, sát đáy thì tự lật lên trên ô; hộp quá dài thì cuộn bên trong.
- Bảng công (quản lý) chỉ còn **Tổng quan bảng công** — bỏ tab "Chi tiết nhân viên". Sửa cả tuần của một người: bấm ✎ hoặc bấm tên → ngăn kéo bên phải.

## Mới ở v6.0 — Sửa giờ công ngay tại Tổng quan bảng công

Không đổi database — **bỏ qua bước 1**, chỉ upload folder lên GitHub. (Nếu chưa chạy `schema.sql` của bản v5.6 thì vẫn cần chạy một lần.)

- **Sửa nhanh một ô**: bấm vào ô ngày bất kỳ → hộp nhỏ liệt kê các dòng giờ (dự án · tác vụ, tăng ca) của tuần đó với giờ của ngày,
  sửa số rồi Lưu (Enter cũng lưu). Ô đổi có viền vàng. Dấu đã gửi của ngày giữ nguyên; ngày không còn giờ thì bỏ dấu.
  Cần thêm dự án / tác vụ mới thì bấm "Sửa cả tuần · thêm dòng ›".
- **Sửa cả tuần**: bấm ✎ (cột Mở khoá / sửa) hoặc bấm tên người → ngăn kéo trượt ra bên phải với đúng bảng sửa của Chi tiết nhân viên
  (thêm dòng, tăng ca, chép tuần trước, Lưu thay đổi, Đánh dấu đã gửi, Mở khoá). Bảng tổng quan vẫn nằm phía sau;
  nút ‹ › chuyển sang người kế tiếp; Esc hoặc ✕ để đóng — còn thay đổi chưa lưu thì app hỏi lại.
- Đóng ngăn kéo / lưu ô xong, dòng trên bảng tổng quan tự cập nhật. (v6.1: tab "Chi tiết nhân viên" đã bỏ.)

## Mới ở v5.9 — Tổng quan bảng công (Tuần / Tháng) + nút nhắc nộp

Không đổi database — **bỏ qua bước 1** (`schema.sql` chỉ sửa chú thích), chỉ upload folder lên GitHub. (Nếu chưa chạy `schema.sql` của bản v5.6 thì vẫn cần chạy một lần.)
Nút nhắc dùng hệ thống thông báo đã có từ v2.6 (cần biến môi trường VAPID trên Vercel như trước).

Bảng công → **Tổng quan bảng công** (thay khung "Tình trạng nộp bảng công" và "Ma trận giờ công"):
- **Tuần**: mỗi người một dòng, mỗi ngày một ô ghi giờ đã gửi; tăng ca ghi "+h" xanh ngọc. Màu ô: đủ giờ (xanh dương nhạt) ·
  thiếu giờ (viền vàng) · nháp chưa gửi (sọc vàng) · bỏ trống (viền đỏ) · nghỉ phép ("P") · ngày lễ (sọc xám, "Lễ") · CN / chưa tới (trống).
  Cuối dòng: tổng / giờ chuẩn, trạng thái nộp tuần (Đã nộp / Còn nháp / Bỏ trống ngày / Chưa nộp) và cột **Nhắc**:
  chuông 🔔 cho người cần xử lý (rê chuột xem lý do), bấm để gửi thông báo nhắc nộp; đầu cột có nút nhắc tất cả.
  Đã nhắc thì chuông đổi thành ✓ (rê chuột xem giờ nhắc). Người chưa bật thông báo trên máy nào sẽ được báo tên.
- **Tháng**: lịch nhiệt — mỗi ngày một ô nhỏ cùng bộ màu, chấm xanh ngọc = có tăng ca; bên phải tổng / chuẩn và
  chấm trạng thái nộp từng tuần — bấm chấm để mở tuần đó ở chế độ Tuần.
- Cột **Mở khoá / sửa** (cạnh Nộp tuần): 🔓 mở khoá cả tuần cho nhân sự sửa và gửi lại (có hỏi xác nhận; chỉ hiện khi tuần đã có ngày gửi) ·
  ✎ mở Chi tiết nhân viên đúng tuần đó để quản lý tự sửa giờ công.
- Tiêu đề cột ngày: thứ ở trên, ngày ở dưới.
- Rê chuột vào ô ngày: giờ theo dự án · tác vụ (phần nháp ghi rõ). Bấm tên người để mở Chi tiết nhân viên đúng tuần đang xem.
- 5 KPI: đã nộp đủ, chưa nộp / còn nháp, tổng giờ đã gửi / chuẩn, tăng ca, thiếu giờ chuẩn. Xuất Excel theo kỳ đang xem
  (sheet Bảng công · Chi tiết · Tình trạng nộp).
- Ma trận nhân sự × dự án vẫn xem được ở Dashboard → tab Nhân sự → Ma trận.

## Mới ở v5.8 — Tác vụ trong chi tiết nhân sự

Không đổi database — **bỏ qua bước 1**, chỉ upload folder lên GitHub. (Nếu chưa chạy `schema.sql` của bản v5.6 thì vẫn cần chạy một lần.)

- Tab Nhân sự → bấm một người: bên phải bảng **Dự án** có thêm bảng **Tác vụ · Giờ · %** — các tác vụ người đó làm trong kỳ (gộp mọi dự án),
  % tính trên tổng giờ của người đó (cộng đủ 100%). Tăng ca ghi "Tăng ca · tác vụ", màu xanh ngọc, xếp cuối. Màn hẹp thì bảng Tác vụ xuống dưới bảng Dự án.

## Mới ở v5.7 — Thanh giờ công từng người ở tab Nhân sự

Không đổi database — **bỏ qua bước 1**, chỉ upload folder lên GitHub. (Nếu chưa chạy `schema.sql` của bản v5.6 thì vẫn cần chạy một lần.)

- Số giờ nằm ngay trong từng khúc thanh: Giờ chuẩn (xanh dương) / OT (xanh ngọc) / Giờ cố gắng (tím). Khúc quá hẹp thì ẩn số, rê chuột để xem.
- Bên phải mỗi người chỉ còn **giờ tổng**.
- **Ngoặc vàng** phía trên thanh nối từ cuối phần Giờ chuẩn tới vạch giờ chuẩn của kỳ, ghi "thiếu x h" — hiện mỗi khi Giờ chuẩn chưa đủ (kể cả thiếu ít); OT và giờ cố gắng không bù vào khoảng này.
- Vạch giờ chuẩn của kỳ đổi sang **trắng mờ, mảnh 1px** (màu vàng chỉ còn dùng cho ngoặc thiếu giờ).
- Khung chi tiết khi bấm một người bỏ dòng "Giờ chuẩn · OT · cố gắng", chỉ còn bảng theo dự án.

## Mới ở v5.6 — Dashboard tách tab Dự án | Nhân sự

**Có đổi database — làm đủ 2 bước:** chạy lại `supabase/schema.sql` trên Supabase (mục 14 trả thêm giờ theo nhân sự × tác vụ), rồi upload folder lên GitHub.

- Đầu Dashboard có nút chuyển **Dự án | Nhân sự** (app nhớ tab đang mở).
- **Tab Dự án** — tiến độ giờ đã dùng **từ trước tới nay** so với dự kiến, không phụ thuộc kỳ. Bộ lọc riêng:
  Tất cả / Vượt / Sắp vượt / Bình thường (kèm số đếm) và ô tìm dự án. KPI: dự án đang mở, vượt dự kiến, sắp vượt (≥ 80%), Urgent.
  Thêm cột **Người tuần này** (số người có giờ đã gửi vào dự án trong tuần hiện tại).
- **Tab Nhân sự** — mọi số liệu theo kỳ. Chọn nhanh **Tuần này / 7 ngày qua / Tháng này** hoặc chọn ngày trên lịch (đổi kỳ là tính lại ngay),
  lọc bộ phận, tìm nhân sự, Tải lại, Excel. 6 KPI: tổng giờ công / công suất, OT, giờ cố gắng, quá tải, thiếu giờ, chưa chấm.
  Người chưa chấm giờ nào trong kỳ gom thành một dòng ở cuối, không tính vào Quá tải / Thiếu giờ.
- Bỏ ô lọc Dự án / Giai đoạn chung ở đầu trang (trước đây chỉ tác động một phần, dễ gây hiểu nhầm).
- Khung chi tiết giai đoạn (bấm vào ô giai đoạn ở tab Dự án): **rê chuột vào tên nhân sự** → thẻ tác vụ của người đó trong giai đoạn
  (Tác vụ · Giờ · %; tăng ca màu xanh ngọc, ghi "Tăng ca · tác vụ"; chân thẻ: người đó chiếm bao nhiêu % tổng giờ giai đoạn).
  Chưa chạy lại `schema.sql` thì thẻ tạm tính từ dữ liệu đã tải (khoảng 6 tháng gần nhất).
- Khi bấm xem chi tiết một giai đoạn: dòng dự án và khung chi tiết được bao bằng viền teal mảnh bo góc, tách khỏi phần còn lại.
- Bảng **Tăng ca theo tác vụ** trong khung chi tiết luôn ẩn khi mở giai đoạn — bấm nút ▸ ở đầu khung **TĂNG CA** để xổ bảng ra bên dưới, bấm lần nữa để thu lại. Bảng không còn hệ số và cột giờ quy đổi (file Excel vẫn giữ); cột **Trong đó CN / lễ** chỉ hiện khi có người chấm tăng ca vào Chủ nhật / ngày lễ.

## Mới ở v5.5 — Chi tiết nhân sự theo dự án và tác vụ

Chỉ đổi giao diện, **không cần chạy lại `schema.sql`**.

- Bấm một người ở "Phân bổ giờ công theo nhân sự": danh sách dự án có thêm cột **%** (phần thời gian của người đó cho từng dự án, cộng đủ 100%).
- **Rê chuột vào một dự án** → thẻ hiện các **tác vụ** người đó làm trong dự án: giờ và % (trên tổng giờ của người đó ở dự án này);
  dòng tăng ca ghi "Tăng ca · tác vụ" màu xanh ngọc. Cuối thẻ: người đó chiếm bao nhiêu % tổng giờ dự án trong kỳ, và giai đoạn.

## Mới ở v5.4 — Phân bổ nhân sự gọn hơn

Chỉ đổi giao diện, **không cần chạy lại `schema.sql`**.

- Bấm một người ở chế độ "Theo người": chi tiết chỉ còn chữ và số — dòng "Giờ chuẩn · OT · cố gắng", rồi mỗi dự án một dòng tên — giờ. Bỏ các thanh màu nhỏ.
- Thanh tải của từng người có khe tách nhẹ (2px) giữa khúc Giờ chuẩn, OT và giờ cố gắng.

## Mới ở v5.3 — Phân bổ giờ công theo nhân sự (Dashboard quản lý)

**Không cần chạy lại `schema.sql`.**

- Hàng chỉ số: công suất kỳ (số người × giờ chuẩn kỳ), đã dùng, số người Quá tải, số người Thiếu giờ chuẩn, giờ còn trống có thể giao.
- Lọc nhanh Tất cả / Quá tải / Thiếu giờ / Bình thường; sắp xếp theo tải, theo giờ phát sinh, theo tên. Bộ lọc kỳ / bộ phận / dự án / tìm tên của Dashboard vẫn áp vào.
- **Theo người** (mặc định): mỗi người một thanh tách Giờ chuẩn (xanh dương) / OT (xanh ngọc) / Giờ cố gắng (tím) so với vạch giờ chuẩn kỳ,
  nhãn trạng thái kèm %, gom theo bộ phận; bấm một người để mở chi tiết giờ theo dự án.
- **Ma trận**: hàng = người, cột = dự án, ô đậm nhạt theo số giờ; cuối hàng tổng, % tải, số dự án (≥ 3 dự án tô vàng); cuối cột tổng giờ từng dự án.
- Nhân sự chưa chấm giờ nào trong kỳ vẫn hiện (0 h, Thiếu giờ) khi không lọc theo dự án / giai đoạn.
- **Thiết lập → Ngưỡng tải nhân sự:** Quá tải khi tổng giờ > 110% giờ chuẩn kỳ, Thiếu giờ khi giờ chuẩn < 90% (chỉnh được).
- Excel sheet "Theo nhân sự" thêm cột % tải và Trạng thái.

## Mới ở v5.2 — Đổi màu giờ chuẩn / OT cho dễ phân biệt

Chỉ đổi màu, **không cần chạy lại `schema.sql`**.

- **Giờ chuẩn:** xanh dương nhạt (#60a5fa) — ô Chuẩn đầu màn chấm công, thanh Tiến độ tuần, hàng Giờ chuẩn ở chân bảng,
  thanh Từng tuần / chú thích / Cả kỳ / bảng Chi tiết tuần ở Dashboard cá nhân.
- **OT / Tăng ca:** xanh ngọc (trước là xanh lá) — mọi chỗ hiển thị tăng ca: chú thích, nhóm Tăng ca, dòng tăng ca, ô OT,
  lịch chọn tuần, bảng "Tăng ca theo tác vụ", Thiết lập hệ số.
- Giờ cố gắng giữ tím; các màu trạng thái (cam thiếu giờ, đỏ vượt / chưa chấm, xanh dương nghỉ phép) giữ nguyên.

## Mới ở v5.1 — Sửa lỗi hệ số tăng ca bị lặp nhiều dòng

**Không cần chạy lại `schema.sql`** (nếu chưa chạy cho v4.9 thì vẫn phải chạy một lần).

- Nguyên nhân: mỗi vai trò có bộ hạng mục `[OT]` riêng (cùng tên 17:30 - 21:00…), app liệt kê từng hạng mục nên ra 3 × số vai trò dòng.
- Nay mọi chỗ **gộp theo khung giờ**: Thiết lập → Hệ số chi phí tăng ca chỉ còn 3 dòng (một hệ số áp cho mọi vai trò);
  bảng "Tăng ca theo tác vụ" ở Dashboard mỗi khung một cột; sheet Tăng ca trong Excel gộp đúng theo khung.
- Hệ số đã lưu ở v4.9 / v5.0 vẫn được đọc. Bấm **Lưu hệ số** một lần để lưu lại theo khung giờ.
- Màn chấm công: người xem được mọi vai trò (Ban giám đốc) cũng chỉ thấy 3 khung giờ; chọn dự án ở khối mới không còn tự hiện các dòng tăng ca —
  nhóm Tăng ca chỉ mở khi bấm nút **⚡ Tăng ca**.

## Mới ở v5.0 — Nhóm Tăng ca ẩn / hiện, thêm dòng lần lượt, xoá dòng

Chỉ đổi màn chấm công. **Không cần chạy lại `schema.sql`** — nhưng nếu chưa chạy cho v4.9 thì vẫn phải chạy một lần.

- Khối dự án đang mở: nhóm **Tăng ca** mặc định ẩn, chỉ có nút **⚡ Tăng ca**. Bấm vào thì hiện nhóm Tăng ca kèm sẵn
  **một dòng** khung giờ đầu tiên (17:30 – 21:00). Khối đã có giờ tăng ca thì nhóm tự hiện.
- **+ Thêm dòng tăng ca** thêm lần lượt khung kế tiếp: dòng 2 = 22:00 – 0:00, dòng 3 = 0:00 – 8:00 (vẫn đổi khung được ở ô Khung giờ).
- Mỗi dòng tăng ca có nút **thùng rác** xoá cả dòng, kể cả khi chưa nhập giờ (dòng có giờ của ngày đã gửi thì không xoá được).
  Xoá hết các dòng thì nhóm Tăng ca ẩn lại.

## Mới ở v4.9 — Tăng ca gắn với tác vụ (phương án B+)

**Bắt buộc chạy lại `supabase/schema.sql`** (khoá ngày đã gửi tính cả tác vụ của dòng tăng ca; Dashboard có số tăng ca theo tác vụ).

- **Màn chấm công:** nhóm **Tăng ca** của mỗi khối dự án có nút **+ Thêm dòng tăng ca**. Mỗi dòng tăng ca có 2 ô:
  **Tăng ca cho tác vụ** (chọn trong các tác vụ của dự án) và **Khung giờ** (các hạng mục `[OT]`, ví dụ 17:30 – 21:00).
  - Chưa chọn tác vụ thì chưa nhập giờ được; dòng tăng ca có giờ mà chưa chọn tác vụ thì không Gửi được.
  - Một khung giờ có thể có nhiều dòng cho nhiều tác vụ khác nhau; trùng cả khung giờ lẫn tác vụ thì bị chặn.
  - Mỗi ô giờ không được vượt độ dài khung (đọc từ tên hạng mục: 17:30 – 21:00 tối đa 3,5 giờ; 22:00 – 0:00 tối đa 2 giờ;
    0:00 – 8:00 tối đa 8 giờ). Ô vượt hiện đỏ và không Gửi được.
  - Khi thu gọn, dòng hiện dạng "Tăng ca 17:30 – 21:00 · Render phối cảnh".
  - Giờ tăng ca cũ (trước v4.9, chưa có tác vụ) giữ nguyên, hiện "chưa rõ tác vụ". Nếu còn ở ngày chưa gửi thì nhân sự phải chọn tác vụ trước khi gửi.
- **Thiết lập → Hệ số chi phí tăng ca:** hệ số từng khung giờ (mặc định 17:30 – 21:00 = 1.5, 22:00 – 0:00 = 2, 0:00 – 8:00 = 2)
  và hệ số **Chủ nhật**, **Ngày lễ** (một hệ số cho cả ngày, để trống = tính theo hệ số khung giờ; ngày lễ lấy từ danh sách ngày lễ).
  Đổi giờ của một khung = đổi tên hạng mục `[OT]` ở tab Tác vụ.
- **Dashboard → Tiến độ dự án → bấm ô giai đoạn:** thêm bảng **Tăng ca theo tác vụ** — giờ theo từng khung, phần rơi vào CN / lễ,
  tổng tăng ca và **giờ quy đổi** (giờ × hệ số). Giờ tăng ca cũ gom vào dòng "Chưa rõ tác vụ".
- **Excel (Dashboard):** sheet **Chi tiết** thêm cột *Tăng ca cho tác vụ*, *Hệ số TC*, *Giờ quy đổi*; thêm sheet **Tăng ca**
  (dự án × giai đoạn × tác vụ × khung giờ × loại ngày, kèm hệ số và giờ quy đổi).
- Dữ liệu: dòng tăng ca trong bảng công có thêm trường `otFor` (mã tác vụ). Thiết lập có thêm `otRates`, `otSunRate`, `otHolRate`.

## Mới ở v4.8 — Giai đoạn đang mở nổi bật + đánh dấu Urgent

Chỉ đổi bảng **Tiến độ dự án** ở tab Dashboard của quản lý. **Không cần chạy lại `schema.sql`** (nếu chưa chạy cho v4.7 thì vẫn phải chạy mục 14).

- **Giai đoạn đang mở** nổi lên: ô tô nền nhạt theo màu của giai đoạn (P1 cam, P2 xanh ngọc, P3 xanh dương, P4 tím)
  + vạch màu bên trái, số giờ in đậm. Giai đoạn **đã đóng** chìm xuống (độ sáng 97%, chữ và thanh màu xám).
- **Urgent:** rê chuột vào dòng dự án → hiện cờ ⚑ bên trái mã dự án → bấm để bật/tắt.
  - Dự án Urgent có vạch đỏ bên trái, nhãn **URGENT**, nền hơi đỏ và **luôn nằm đầu bảng**
    (trong nhóm Urgent vẫn xếp theo mức nguy cơ vượt; dự án Urgent chưa có giờ cũng hiện ở đầu, không bị gom vào dòng "chưa có giờ").
  - Lưu chung trong thiết lập (`project.urgent`) → mọi máy quản lý đều thấy. Chỉ tài khoản quản lý bật/tắt được.

## Mới ở v4.7 — Chi tiết từng giai đoạn trong "Tiến độ dự án"

**Bắt buộc chạy lại `supabase/schema.sql`** (thêm mục 14: hàm `artius_phase_detail`). Chưa chạy thì app vẫn hoạt động,
nhưng phần chi tiết chỉ tính trên dữ liệu đã tải (vài tháng gần nhất) và có dòng chữ cam nhắc chạy lại.

Chỉ đổi bảng **Tiến độ dự án** ở tab Dashboard của quản lý; các tab khác giữ nguyên.

- **Rê chuột vào ô giai đoạn** → thẻ tóm tắt:
  - **Giờ còn lại** (cam khi còn ≤ 20% giờ dự kiến, đỏ có dấu − khi đã vượt).
  - Giai đoạn đang mở: **dự báo** theo tốc độ trung bình 4 tuần đã qua (không tính tuần đang chạy) → hết giờ trong bao lâu, khoảng ngày nào;
    đã vượt thì báo 2 tuần tới vượt thêm bao nhiêu; không ai gửi giờ ≥ 10 ngày thì báo "đứng im".
    Giai đoạn đã đóng: đóng ở bao nhiêu %, chạy mấy tuần.
  - 3 người và 3 tác vụ tiêu giờ nhiều nhất (kèm vai trò), ô Tăng ca, lần gửi giờ gần nhất, số người.
- **Bấm vào ô giai đoạn** → khung chi tiết mở ngay dưới dòng dự án, **các dự án khác mờ đi** (rê chuột vào thì rõ lại một phần):
  - Biểu đồ giờ theo tuần (tối đa 16 tuần gần nhất), màu cột = giờ lũy kế so với dự kiến; vạch vàng đứt = trung bình 4 tuần gần nhất;
    dưới biểu đồ là kết luận dự báo.
  - Toàn bộ nhân sự (tối đa 10, kèm vai trò) và tác vụ (tối đa 10) với giờ và %. Tác vụ lớn nhất là chỉnh sửa / góp ý / làm việc với khách thì có cảnh báo vàng.
  - Dòng **TĂNG CA**: số giờ và % tổng giờ giai đoạn, thanh 3 mức — bình thường 0–15% (xanh), trung bình 15–25% (cam), cao > 25% (đỏ).
  - Bấm lại vào ô hoặc nút **Đóng ✕** để đóng.
- Tăng ca = giờ chấm vào hạng mục có tên bắt đầu bằng `[OT]`; danh sách tác vụ không tính các hạng mục này. Chỉ tính giờ của ngày đã gửi, trên toàn bộ dữ liệu.

## Mới ở v4.6 — Dashboard quản lý: Tiến độ dự án + Phân bổ theo nhân sự

Chỉ đổi tab **Dashboard** của quản lý; các tab khác giữ nguyên. Không cần chạy lại `schema.sql`.

- **Tiến độ dự án — giờ đã dùng so với dự kiến** (thay biểu đồ "giờ công theo giai đoạn và mốc giờ dự kiến"):
  - Mỗi dự án một dòng, mỗi giai đoạn một ô: **giờ hiện tại** (tổng giờ đã gửi từ trước tới nay, không phụ thuộc kỳ đang lọc) / giờ dự kiến · %.
  - Giai đoạn **đang mở**: thanh màu (xanh < 80%, cam 80–100%, đỏ > 100%) + nhãn "mở". Giai đoạn **đã đóng**: thanh xám, chữ chìm.
  - Cột **Giờ hiện tại / dự kiến** của cả dự án: số chuyển cam khi ≥ 80%, đỏ khi > 100%.
  - Cột **Tình trạng** chỉ cảnh báo giai đoạn đang mở (VD "Sắp vượt · P2"). Dự án nguy cơ vượt xếp đầu.
  - Dự án đang mở nhưng chưa có giờ gom vào dòng "Hiện n dự án…". Rê chuột vào ô giai đoạn xem còn lại / vượt bao nhiêu giờ.
  - Bộ lọc **Dự án** của Dashboard áp vào bảng này; kỳ, bộ phận, tên nhân sự thì không.
- **Phân bổ giờ công theo nhân sự** (thay bảng "nhân sự × dự án"): mỗi người một thanh chia khúc theo dự án trong kỳ đang lọc,
  vạch vàng đứt là **giờ chuẩn của kỳ** (theo Thiết lập, trừ ngày lễ); vượt 110% giờ chuẩn ghi "quá tải". Số chi tiết vẫn có trong file Excel (sheet "Ma trận NS x DA").

## Mới ở v4.5 — Dashboard quản lý gọn cho nhiều dự án

- Bỏ biểu đồ **Giờ công theo tác vụ** khỏi Dashboard (file Excel vẫn giữ sheet "Theo hạng mục").
- Bảng **Giờ công: nhân sự × dự án** (máy tính):
  - Tiêu đề cột là **mã dự án**, rê chuột vào xem tên đầy đủ; mỗi cột rộng cố định 64px → 20 dự án vừa màn hình 1920px (cả thanh bên).
  - Cột sắp theo **tổng giờ giảm dần**, cột "Khác" luôn ở cuối.
  - **Ghim** cột Nhân sự (trái) và cột Tổng (phải) khi cuộn ngang; thêm **dòng Tổng** theo dự án ở cuối bảng.
  - Ô tô nền teal theo mức giờ — càng đậm càng nhiều giờ.
  - Dự án chưa đặt mã thì cột hiện tên (bị cắt ngắn) — nên đặt mã cho mọi dự án ở tab Dự án.
- Không đổi database: **không cần chạy lại `schema.sql`**.

## Mới ở v4.4 — mô tả ngắn cho tác vụ

- Tab **Tác vụ**: bấm **bút chì** ở một tác vụ → có thêm ô **Mô tả** (tối đa 200 ký tự) → ✓ hoặc Enter để lưu.
  Mô tả hiện thành dòng chữ nhỏ dưới tên tác vụ. Xoá trắng ô Mô tả rồi lưu là bỏ mô tả.
- Màn **Chấm công**: khi khối dự án đang mở để nhập giờ, mỗi hạng mục có mô tả hiện thêm dòng chữ nhỏ bên dưới tên
  (máy tính và điện thoại). Khối đã thu gọn thì ẩn mô tả cho gọn.
- **Kéo thả đổi thứ tự tác vụ** (máy tính): ở tab Tác vụ, nắm tay nắm ⋮⋮ bên trái tác vụ kéo lên/xuống, vạch xanh cho biết
  chỗ thả, thả là lưu. Chỉ đổi thứ tự trong vai trò đang xem. Màn **Chấm công** hiện hạng mục đúng thứ tự này
  (nhóm Tăng ca vẫn tách riêng ở cuối). Trên điện thoại không kéo được.
- Không đổi database: **không cần chạy lại `schema.sql`** (mô tả và thứ tự lưu cùng thiết lập).

## Mới ở v4.3 — vá bảo mật: khoá bảng dữ liệu cũ

- Bảng cũ `artius_kv` (dữ liệu trước v1.8) trước đây **mọi tài khoản đăng nhập đều đọc được**. Trong đó còn khối dữ liệu cũ
  gồm bảng công của tất cả nhân sự và mã PIN quản lý cũ → nhân viên có thể xem giờ công của người khác.
- v4.3 khoá hẳn bảng này với tài khoản đăng nhập (`supabase/schema.sql` mục 8b). **Dữ liệu cũ không bị xoá**, chỉ còn
  hàm server và Supabase dashboard đọc được. App từ v1.8 không dùng bảng này nên không có gì thay đổi trên giao diện.
- **Bắt buộc chạy lại `supabase/schema.sql`** (đã được chạy sẵn ngày 15/10/2026 — chạy lại vẫn an toàn).

## Mới ở v4.2 — nhắc lại mỗi 1 giờ tới khi gửi đủ

- Lần nhắc đầu tiên vẫn theo giờ đặt ở **Thiết lập → Nhắc nộp bảng công** (nhắc tuần: đúng thứ đã chọn; nhắc chốt tháng: mỗi ngày từ cuối tháng tới ngày đã chọn).
- Sau đó, ai **còn ngày chưa gửi** được nhắc lại **mỗi 1 giờ** (ví dụ đặt 9:30 → 10:30, 11:30 … 17:30), **chỉ trong chính ngày nhắc**, quá **17:30** thì dừng.
  Gửi đủ là lượt sau không nhận nữa. Áp dụng cho cả nhắc tuần và nhắc chốt tháng.
- Thông báo mới thay thông báo cũ trên màn hình (không xếp chồng).
- Chỉ sửa `api/_reminders.js` (và chữ hướng dẫn trong Thiết lập). **Không cần chạy lại `schema.sql` hay `cron.sql`** — lịch Supabase 15 phút/lần giữ nguyên.
- Nhật ký "Lần nhắc gần nhất" giờ có một dòng cho mỗi lượt nhắc.

## Mới ở v4.1 — nhân viên vào app dễ hơn

- **Cài app từ trình duyệt (PWA).** Thêm `public/manifest.webmanifest` + icon 512 / maskable / iPhone. Service worker giờ được
  đăng ký ngay khi mở app (trước chỉ khi cho phép thông báo) — vẫn không cache gì.
  - Chrome / Edge (máy tính, Android): nút **Cài app** ở góc phải trên → hộp cài của trình duyệt → có icon ARTIUS TIME
    trên Desktop/Taskbar hoặc màn hình chính, mở cửa sổ riêng.
  - iPhone / iPad: nút **Cài app** mở hướng dẫn *Chia sẻ → Thêm vào MH chính*. **Trên iPhone, thông báo nhắc chỉ chạy khi
    đã cài app** (iOS 16.4 trở lên) — app cài xong có bộ nhớ riêng nên phải đăng nhập lại một lần trong app.
  - Đang mở dạng app đã cài thì nút tự ẩn.
- **Bấm thông báo nhắc khi app đang mở** → chuyển thẳng tới tuần cần gửi (trước chỉ đưa cửa sổ lên). Còn giờ chưa gửi thì vẫn hỏi lại như cũ.
- **Màn đăng nhập nhớ tên đăng nhập** lần trước trên máy đó. Phiên đăng nhập vốn đã được giữ lâu dài (tự gia hạn) từ v1.7 —
  nhân viên chỉ phải đăng nhập lại khi bấm Thoát hoặc xoá dữ liệu trình duyệt.
- **Thiết lập → Truy cập app** (quản lý): link + mã QR của đúng địa chỉ đang mở, nút **Sao chép link** và **In poster QR** (A4).
  Đổi sang tên miền riêng rồi mở app bằng tên miền mới → QR tự đổi theo, in lại poster.
- Thêm thư viện `qrcode` (chỉ tải khi mở mục Truy cập app). Không cần chạy lại `supabase/schema.sql`.

### Gắn tên miền riêng (ví dụ `time.artius.vn`) — làm một lần, không đụng code
1. **Vercel → project artius-timetracking → Settings → Domains → Add** → gõ `time.<tên miền công ty>` → Add.
   Vercel hiện bản ghi cần thêm (thường là **CNAME** — chép đúng giá trị Vercel đưa).
2. **Trang quản lý DNS của tên miền** (nơi mua domain) → thêm bản ghi: Loại `CNAME`, Tên/Host `time`, Giá trị = giá trị Vercel đưa ở bước 1, TTL mặc định.
   Không sửa các bản ghi MX / mail đang có.
3. Chờ Vercel báo **Valid Configuration** (vài phút tới vài giờ); Vercel tự cấp HTTPS.
4. Địa chỉ `...vercel.app` cũ vẫn chạy. Nhưng app cài, thông báo và đăng nhập **gắn theo từng địa chỉ** → chốt dùng tên miền mới
   trước khi phát động cài app, để mọi người cài một lần trên đúng địa chỉ.
   Ai đã bật thông báo trên địa chỉ cũ thì mở địa chỉ mới, đăng nhập và cho phép thông báo lại.

### Triển khai cho nhân viên
1. Gắn tên miền (mục trên) → mở app bằng tên miền mới → Thiết lập → Truy cập app → **In poster QR**, dán ở văn phòng Q3, Q7, xưởng, công trường.
2. Ghim link trong nhóm chat / mail nội bộ.
3. Mỗi bộ phận dành 10 phút họp: mọi người mở link → **Cài app** → đăng nhập → **Cho phép** thông báo.

## Mới ở v4.0 — thiếu giờ công tính theo giờ chuẩn

- Một ngày bị tính **Thiếu giờ công** khi **giờ chuẩn** (tổng − OT − giờ cố gắng) nhỏ hơn giờ chuẩn của ngày (mặc định 8h T2–T6, 4h T7). Ví dụ 6h làm việc + 2h OT = 8h vẫn thiếu 2h.
- Ngày thiếu: chữ màu cam ở hàng Tổng theo ngày và hàng Giờ chuẩn, chấm cam trên tiêu đề ngày, ô nhập viền cam, lịch chọn tuần tô cam (ưu tiên hơn dấu tăng ca).
- Dashboard cá nhân dùng cùng quy tắc: ngày/tuần "thiếu" tính theo giờ chuẩn; trong khung Chi tiết tuần, ngày thiếu và số giờ chuẩn của ngày đó (cùng dòng Cả tuần nếu tuần còn thiếu) tô cam.
- Không cần chạy lại `supabase/schema.sql`.

## Mới ở v3.9 — Dashboard cá nhân: nét 44h và chi tiết tuần

- Danh sách từng tuần có **nét dọc định vị giờ chuẩn tuần** (44h, lấy theo Cài đặt → Giờ chuẩn), nhãn "44h chuẩn" ở trên.
- Khung bên phải đổi thành **Chi tiết tuần**: bấm vào thanh của một tuần (mặc định tuần này) để xem bảng theo ngày (Tổng · Chuẩn · OT · Cố gắng, ngày thiếu tô đỏ) và giờ theo dự án → hạng mục của tuần đó.
- Dòng "Cả kỳ" chuyển xuống dưới danh sách tuần.
- Không cần chạy lại `supabase/schema.sql`.

## Mới ở v3.8 — Dashboard cá nhân của nhân sự (phương án A)

- Một câu tóm tắt ở đầu trang nói thẳng trạng thái, ví dụ "Tuần này bạn chưa chấm giờ nào. Còn thiếu 3 ngày và tuần 21/09 – 27/09 chưa đủ giờ.", kèm các ô ngày của tuần này (đỏ = thiếu, xanh = đủ, mờ = chưa tới) và nút **Chấm công ngay**.
- Danh sách **từng tuần** (mới nhất ở trên): thanh 3 màu giờ chuẩn · OT · cố gắng, số "giờ chuẩn / target" và nhãn Đủ / Thiếu / Đang chấm / Chưa chấm.
- Khung **Bạn làm cho dự án nào**: giờ và % theo dự án, giờ nghỉ phép tách riêng; dòng **Cả kỳ**: chuẩn + OT + cố gắng = tổng.
- Bỏ 6 ô số, thanh tiến độ và biểu đồ cột theo ngày. Kỳ báo cáo và Xuất Excel gọn một hàng; đổi kỳ là tải lại ngay (bỏ nút Cập nhật). File Excel giữ nguyên.
- Dashboard của quản lý không đổi. Không cần chạy lại `supabase/schema.sql`.

## Mới ở v3.7 — tổng giờ tuần (phương án A)

- Ô tổng giờ ở đầu trang chấm công thành 3 ô: **Chuẩn** (kèm target tuần) · **Phát sinh** (OT + Cố gắng) · **Tổng**.
- Tiến độ tuần tính theo giờ chuẩn ("44.0 / 44.0 giờ chuẩn").
- Chân bảng đọc như phép cộng: **Giờ chuẩn**, **+ OT**, **+ Giờ cố gắng**, rồi **= Tổng theo ngày** in đậm ở dưới cùng. Ba hàng chi tiết thu gọn mặc định, bấm nút mũi tên cạnh "Tổng theo ngày" để mở/thu (nút chỉ hiện khi tuần có giờ phát sinh). Cột Tổng trở lại một số.
- Bỏ nhãn "Đã gửi đủ tuần" / "Đã gửi N ngày" ở đầu trang (nút dưới bảng đã báo "Đã gửi giờ công").
- Không cần chạy lại `supabase/schema.sql`.

## Mới ở v3.6 — hiển thị bảng chấm công

- Bỏ nhãn "Đã chấm" ở dòng dự án trên bảng chấm công của nhân sự.
- Ô Tổng của hàng Tổng theo ngày tách thành **giờ công chuẩn + giờ phát sinh**, ví dụ `44.0 + 9.5` (phát sinh = OT + Giờ cố gắng). Ô tổng giờ ở góc phải trên (cạnh "Đã gửi đủ tuần") cũng hiện cùng kiểu. Rê chuột vào để xem chi tiết. Tuần không có phát sinh thì vẫn hiện một số.
- Không cần chạy lại `supabase/schema.sql`.

## Mới ở v3.5 — chỉnh màn chấm công

- **Tổng theo ngày** chỉ hiện đỏ khi vượt **13.5 giờ** (mặc định mới của "Cảnh báo vượt / ngày" trong Cài đặt → Giờ chuẩn; nếu Cài đặt đang lưu 12 thì sửa thành 13.5 rồi bấm Lưu giờ chuẩn).
- Đã gửi xong và không còn giờ mới chờ gửi: nút **Gửi giờ công** đổi thành **Đã gửi giờ công** (không bấm được). Nhập thêm giờ vào ngày chưa gửi thì nút quay lại như cũ.
- Bỏ số tổng ở dòng dự án và từng hạng mục; tổng chỉ còn ở hàng Tổng theo ngày, Trong đó OT, Giờ cố gắng.
- Không cần chạy lại `supabase/schema.sql` (nếu đã chạy bản của v3.4).

## Mới ở v3.4 — OT và Giờ cố gắng

- **OT chỉ tính khi chấm vào hạng mục Tăng ca** (tên bắt đầu bằng `[OT]`). Chấm 9h vào hạng mục làm việc thường sẽ không còn tự tách thành 8h + 1h OT.
- **Giờ cố gắng**: giờ làm việc thường vượt giờ chuẩn của ngày (và toàn bộ giờ làm việc thường vào Chủ nhật / ngày lễ / ngày nghỉ). Hiện thành một dòng riêng bên dưới "Trong đó OT". Không tính vào chi phí dự án.
- Áp dụng cho: màn chấm công nhân sự, dấu cảnh báo trên lịch, Dashboard, Báo cáo và toàn bộ file Excel (thêm cột "Giờ cố gắng").
- **Phải chạy lại `supabase/schema.sql`** trong Supabase SQL Editor: sửa lỗi "Chưa tới ngày, chưa chấm giờ làm việc được" báo sai khi bảng công trong tháng đã có giờ ở ngày sau hôm nay (do quản lý nhập). Lỗi có từ v2.3, do kiểu ghi upsert làm trigger coi bản cũ là rỗng.

## Mới ở v3.3 — chỉnh màn chấm công

Không đổi database: **không cần chạy lại `schema.sql`**.

- Nút thùng rác xoá cả khối dự án dời lên ngay **bên phải ô Giai đoạn**.
- Nút **xoá hết giờ của hạng mục trong tuần** (biểu tượng cục tẩy) nằm cạnh nút "…". Chỉ hiện khi hạng mục đó có giờ còn
  sửa được (ngày chưa gửi); bấm nhầm thì bấm **Hoàn tác**.
- Bỏ dòng ghi chú "Nhập giờ rồi bấm ✓ để tạm lưu".
- Ô chưa nhập để trống (không hiện số 0). Dải "Đã xoá … · Hoàn tác" tự ẩn sau 10 giây hoặc khi khối đã quay lại bảng.

## Mới ở v3.2 — chấm công không cần chọn hạng mục

Không đổi database: **không cần chạy lại `schema.sql`** nếu đã chạy bản v3.1.

- **Thêm dòng → chọn dự án** là hiện ngay **toàn bộ hạng mục** của dự án (theo vai trò), nhân sự gõ giờ thẳng vào,
  không còn ô sổ xuống để chọn hạng mục. Giai đoạn vẫn tự chọn theo cài đặt Mở/Đóng của quản lý.
- Hạng mục có tên bắt đầu bằng `[OT]` được tách riêng nhóm **Tăng ca** ở cuối khối, hiển thị bỏ chữ `[OT]`
  (VD "17:30 – 21:00"). Khối "Khác" chia nhóm **Công việc chung / Vắng mặt**.
- Nhập xong bấm **✓** ở đầu khối: khối thu gọn, chỉ còn hạng mục có giờ, giờ được **tạm lưu trên máy** (tải lại
  trang vẫn còn). Bấm **bút chì (Sửa)** để mở lại đủ hạng mục. Bấm Thêm dòng khi còn khối đang mở thì app tự ✓ khối đó.
- Xong hết các dự án thì bấm **Gửi giờ công** như cũ — gửi toàn bộ giờ đã chấm, ngày đã gửi bị khoá. Gửi xong bản tạm lưu tự xoá.
- Nút thùng rác ở đầu khối xoá cả khối (có Hoàn tác). Khối đã có giờ thì không đổi dự án nữa.

## Mới ở v3.1 — quản lý mở / đóng giai đoạn của dự án

- Tab **Dự án**: mỗi ô giai đoạn có nút **Đang mở / Đóng**. Nhân sự chỉ chấm được giai đoạn đang mở.
- Màn chấm công: chọn dự án là **giai đoạn tự được chọn sẵn** theo cài đặt của quản lý. Dự án chỉ mở **một** giai đoạn thì
  ô giai đoạn bị khoá (nhân sự không phải chọn); mở nhiều giai đoạn thì tự chọn giai đoạn đầu, nhân sự đổi được trong các
  giai đoạn đang mở. Dự án không mở giai đoạn nào thì không hiện cho nhân sự.
- **Giờ dự kiến chỉ còn để theo dõi**, không còn quyết định chấm công được hay không. Dự án chưa từng bấm mở/đóng thì
  giai đoạn nào có giờ dự kiến > 0 coi như đang mở (giữ nguyên như hiện tại). Dự án mới: giai đoạn có giờ dự kiến được mở sẵn.
- Database chặn theo cùng luật (`schema.sql` mục 7c). Sửa lỗi nhỏ: dòng trống không còn mục thừa "(dự án đã xoá)".
- **Vai trò** của nhân sự: trang Cài đặt của nhân sự hiện thêm dòng "Vai trò" (tên vai trò quản lý đã gán). Ô tìm kiếm ở
  danh sách Nhân sự tìm được theo vai trò. Các file Excel xuất ra có thêm cột "Vai trò" (tên đầy đủ).

## Mới ở v3.0

- **Nút "Thêm dòng" tạo một khối trống** ở cuối bảng: Dự án, Giai đoạn, Hạng mục đều "— Chọn … —", người dùng tự chọn
  lần lượt (chọn "Khác" thì không có Giai đoạn). Ô giờ chỉ mở khi đã chọn đủ. Mỗi lúc chỉ có một khối trống; thêm hạng mục
  vào khối đã có thì dùng nút **+** ở đầu khối. Dòng chưa chọn đủ không được ghi khi Gửi.
- Đóng gói: folder đầy đủ như repo, file ứng dụng đổi tên thành `src/App.jsx`. Các chức năng khác giữ như v2.9. **Nếu production chưa chạy SQL của v2.9 thì bước 1 là bắt buộc.**

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
