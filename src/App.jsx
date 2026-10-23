import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend, ReferenceArea,
  ComposedChart, Line, LabelList,
} from "recharts";
import {
  Clock, Users, FolderKanban, LayoutDashboard, Download, Plus, Trash2, Save,
  AlertTriangle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, LogOut, Settings,
  CheckCircle2, Loader2, ListChecks, Lock, RotateCcw, Pencil, Check, X, CalendarDays,
  Copy, Unlock, Search, Flag, Zap, Eraser, ClipboardList, MoreHorizontal, Grid3x3, User, Eye, EyeOff, Bell, Send, Printer, QrCode, Share, GripVertical, Sun, Moon, Monitor,
} from "lucide-react";
import { fetchConfig, saveConfig, fetchTs, fetchTsChanges, fetchTsStamps, saveTs, deleteAllTs, fetchUsage, fetchPhaseDetail, purgeTasks, fetchOrphanTasks } from "./data.js";
import { mergeConfig } from "./merge.js";
import { LIGHT_CSS } from "./lightTheme.js";
import { askPermission, syncPush, pushPermission, sendTestPush, fetchPushStatus, sendNudge, fetchNudgeLog, fetchNudgeLogRange } from "./push.js";
import { currentUser, signIn as authSignIn, signOut as authSignOut, accountsApi, normUsername, USERNAME_RE, PASSWORD_MIN } from "./auth.js";

/* ============================================================
   ARTIUS — Quản lý giờ công theo dự án · v5.6
   Mới ở v8.3 — Chấm công: khối đã chốt (đã bấm ✓) ô Dự án chữ đậm, rõ màu (không còn mờ 60%), nền xám nhẹ, ẩn mũi tên — ô Giai đoạn giữ nguyên;
               dòng tăng ca khi khối đóng: khung giờ thành nhãn teal "Tăng ca …", tên tác vụ màu chữ thường (cả Sáng và Tối).
   Mới ở v8.2 — Chấm công (máy tính): ô Giai đoạn thu nhỏ (180px), ô Dự án rộng ra; nút ✓ / Sửa của khối dời từ bên trái dự án sang cạnh thùng rác.
   Mới ở v8.2 — Giao diện Sáng: ô nhập giờ tăng ca viền teal + nền teal rất nhạt, số giờ teal đậm (trước đó viền gần như trắng, khó nhìn).
   Mới ở v8.1 — Chấm công: "Thêm tác vụ" thêm được khối mới kể cả khi khối đang mở chưa nhập giờ (khối đó vẫn mở nguyên);
   nút "Lưu nháp" cạnh "Gửi giờ công": ghi giờ đang nhập lên server nhưng chưa gửi (quản lý thấy ô Nháp, chưa tính báo cáo).
   Cài đặt của nhân viên bỏ mục "Kiểm tra lưu trữ" (vẫn còn ở Thiết lập của Admin).
   Mới ở v8.0 — Chấm công: tuần còn trống thì tự mở sẵn một khối trống (Dự án · Giai đoạn · Hạng mục) như vừa bấm "Thêm tác vụ",
   nhân viên chọn và nhập giờ ngay. Rê chuột vào dòng tác vụ: tên tác vụ in đậm (cả Sáng và Tối), dòng chú thích giữ nguyên. Giao diện Sáng: banner "Còn x tuần chưa gửi" nền hồng viền đỏ. Khối trống không làm hiện cảnh báo "chưa lưu"; quản lý sửa hộ (ngăn kéo Bảng công) thì không tự thêm.
   Mới ở v7.9 — Hoàn thiện giao diện Sáng: rê chuột dòng chấm công chữ xanh dương; Giờ chuẩn xanh đậm, Giờ cố gắng giữ tím có nền chip + thanh sọc;
   phần thiếu ở thanh tổng Bảng công là dải cam nhạt đặc (bỏ sọc), ô "Bỏ trống" nhạt hơn; bảng Tháng: Thiếu giờ vàng đậm, Nghỉ phép xám xanh, Giờ cố gắng tím đặc,
   hôm nay = dải xám liền một khối dọc cả cột + số ngày trong chip đen. Rê chuột vào ô ngày: viền xanh lá nhạt (cả Sáng và Tối).
   Mới ở v7.8 — Giao diện Sáng (Light) bên cạnh giao diện Tối (Dark): nút "Sáng / Tối" ở góc phải thanh trên cùng (mọi màn, kể cả đăng nhập);
   lựa chọn nhớ riêng từng máy, mặc định Tối. CSS Sáng nằm ở src/lightTheme.js (sinh tự động từ class Tailwind), logo Sáng ở public/logo-artius-time-light.svg.
   Nhãn / thanh trạng thái ở giao diện Sáng dùng màu riêng, đặc và đậm hơn (xanh lá Bình thường, cam Sắp vượt, đỏ Vượt…) cho dễ nhìn trên nền sáng.
   Nút giao diện 3 lựa chọn: Tối · Sáng · Theo máy (tự đổi theo cài đặt sáng/tối của máy). Ở Sáng: ô "Bỏ trống" bảng Tháng là nền hồng nhạt
   không viền; chấm "Nộp từng tuần" và màu dự án / giai đoạn bản đậm; dải tên phòng ban thống nhất. BOD chỉ xem: ẩn hẳn nút / ô thêm-sửa-xoá-lưu.
   Giao diện Tối giữ nguyên như v7.7.
   Mới ở v7.7 — Chuông nhắc ở Bảng công bấm lại được nhiều lần (tuần và tháng), cách nhau tối thiểu 30 phút cho mỗi người: trong 30 phút chuông mờ đi,
   rê chuột hiện "nhắc lại được lúc …"; chuông có dấu ✓ nhỏ nếu người đó đã được nhắc; "Nhắc tất cả" bỏ qua người đang trong 30 phút.
   BOD xem được mọi mục quản lý (Dự án, Nhân sự, Tác vụ, Thiết lập) ở chế độ chỉ xem; nhãn "Chế độ chỉ xem" ở header cạnh tên tài khoản (mọi mục quản lý) — không lưu được thay đổi, không xem tài khoản/mật khẩu.
   Kéo thả dự án đổi vị trí: giữ biểu tượng ⋮⋮ đầu dòng dự án ở Dashboard (Tiến độ dự án) và tab Dự án; thứ tự lưu riêng từng máy (trình duyệt),
   dùng chung giữa hai màn; nút "Xếp tự động" ở Dashboard để bỏ thứ tự đã kéo. Dự án Urgent vẫn ghim đầu bảng Dashboard. Chỉ dùng được bằng chuột (máy tính).
   Chỉ đổi giao diện (src/App.jsx); không đổi database hay api/push.js.
   Mới ở v7.6 — Bỏ giới hạn 1520px của v7.5: mọi tài khoản hiển thị full màn hình. Quản lý (Admin, BOD, Trưởng phòng) trên máy tính:
   menu dọc dạng thẻ bám mép trái khung nội dung (dính khi cuộn), có Thoát + phiên bản; header chỉ còn tiêu đề trang · logo · tên.
   Nhân viên giữ tab ngang trên header (v7.5).
   Nút Thoát nổi bật hơn (viền + nền đỏ nhạt, có chữ "Thoát"): header của nhân viên, cuối menu dọc của quản lý, thanh menu dưới đáy điện thoại.
   Mới ở v7.5 — Máy tính: bỏ thanh menu dọc bên trái; các tab đưa lên thanh trên cùng thành tab ngang (bên trái), logo giữ ở giữa,
   tên · phiên bản · nút Thoát bên phải. Header và nội dung giới hạn rộng tối đa 1520px, căn giữa trình duyệt.
   Tab ngang chỉ hiện icon ở màn hẹp, hiện chữ từ 1280px (≤ 4 tab) hoặc 1536px (Admin 6 tab). Điện thoại giữ nguyên thanh menu dưới đáy.
   Mới ở v7.2 — Tác vụ "Chờ việc" (gắn cứng, mục Khác · dùng chung): tính là giờ công (không bị báo thiếu), không thành giờ cố gắng,
   KHÔNG tính vào tải. Khúc xám riêng trên thanh Từng tuần / Lịch tháng / Bảng công / Phân bổ; khung Phân bổ có nhãn "Chờ việc",
   ô KPI Chờ việc, % tải = (tổng − chờ việc) / giờ chuẩn kỳ; Excel thêm cột Giờ chờ việc.
   Mới ở v7.1 — Dashboard cá nhân: ô Lịch tháng hiện tổng giờ (số to) và dòng chuẩn · +OT · +cố gắng theo màu; nút "Chấm công ngay"
   mở thẳng tuần cũ nhất còn thiếu của tháng đang xem; thanh Từng tuần kiểu khung Phân bổ của quản lý (số trong khúc, vạch giờ chuẩn
   của tuần tính đến hôm nay, ngoặc vàng "thiếu X h", cột tổng giờ).
   Mới ở v7.0 — Dashboard cá nhân: bỏ Xuất Excel, ô chọn kỳ + nút nhanh và khung Chi tiết tuần; xem theo tháng của Lịch tháng ("Tháng này" để quay về); khung Từng tuần cao vừa nội dung; thêm Lịch tháng (màu ô như bảng Tuần của quản lý), bấm một ngày → mở Chấm công đúng tuần đó.
   Mới ở v6.9 — Nhân sự: "Dự án đang tham gia" sửa ngay trên danh sách (✕ gỡ · + Dự án) hoặc trong khung sửa nhân sự. Tab Dự án: ⌄ dưới tên dự án mở danh sách Tên · Vai trò, + Nhân sự / ✕ để giao, gỡ. Màn chấm công của nhân sự chỉ hiện các dự án được giao;
     chưa giao dự án nào = chỉ chấm Việc chung / vắng mặt. Cột "Dự án đang tham gia" ở danh sách = dự án được giao.
   Mới ở v6.8 — Dashboard cá nhân → Chi tiết tuần: ngày lễ khoanh vòng đỏ kèm tên ngày lễ.
     Màn chấm công nhân viên gọn hơn: bỏ ghi chú "Chọn dự án (hoặc Khác)…", bỏ chú thích cạnh nhãn Công việc chung /
     Vắng mặt, bỏ nút "…" (mô tả dòng), bỏ "Chép tuần trước"; nút "Thêm dòng" đổi thành "Thêm tác vụ".
   Mới ở v6.7 — Bảng công giảm màu (phương án C): giờ nháp chỉ hiện số mờ, không tô cam; thanh tổng không vẽ nháp và không ghi
     "thiếu" khi phần thiếu đã có giờ nháp; cột Nộp tuần ẩn "Còn nháp" của tuần đang chạy (chấm tuần trong bảng Tháng: xám);
     KPI "Chưa nộp / còn nháp" màu trung tính; bỏ dòng ghi chú "Rê chuột vào ô…". Chuông nhắc giữ màu.
   Mới ở v6.6 — Dashboard → Nhân sự: thêm lọc nhanh "Tuần trước" (T2 → CN). Ô tìm nhân sự / dự án gõ không dấu vẫn ra
     (Dashboard, Bảng công, Tiến độ dự án).
     Xoá tác vụ = xoá luôn giờ đã chấm vào tác vụ đó (kể cả dòng tăng ca "cho tác vụ" đó), không còn "(tác vụ đã xoá)".
     Hộp xác nhận báo số giờ sẽ mất. Xoá vai trò cũng xoá giờ của các tác vụ bị xoá theo. Tab Tác vụ hiện khung vàng khi còn giờ
     của tác vụ đã xoá trước đây → "Xoá hẳn". Database: artius_purge_tasks, artius_orphan_tasks (chạy lại schema.sql).
   Mới ở v6.5 — Sửa lỗi sau kiểm tra số liệu: Dashboard "Tăng ca theo tác vụ" trống từ v6.3 (database chỉ nhận hạng mục [OT],
     nay nhận cả khung tăng ca chung — chạy lại schema.sql); Dashboard Nhân sự tính giờ chuẩn hôm nay chỉ cho người đã gửi
     (khớp Bảng công); Bảng công tháng: "Đã nộp đủ" chỉ xét các tuần đã qua.
   Mới ở v6.4 — Bảng công (quản lý): ô Nghỉ phép đổi màu cam đất (tách khỏi xanh "đủ giờ").
     Thanh Tổng / chuẩn chia khúc: chuẩn (xanh dương) · cố gắng (tím) · OT (xanh ngọc) · phần thiếu (sọc vàng + "thiếu x h").
     Hôm nay chỉ tính vào giờ chuẩn khi đã gửi (trước đây ai cũng bị "thiếu 8 h" cả ngày); hôm nay chưa tính là bỏ trống.
     Bảng Tháng có cột Nhắc: chuông kèm số tuần chưa nộp (các tuần đã qua) — bấm một lần gửi một thông báo gộp mọi tuần thiếu;
     "Nhắc tất cả" ở tiêu đề cột. /api/push nudge nhận thêm weeks[] và ghi nhật ký từng tuần.
   Mới ở v6.3 — Tăng ca là CÀI ĐẶT CHUNG (Thiết lập → Tăng ca): khung giờ (bắt đầu – kết thúc) + hệ số, áp cho mọi vai trò.
     Không còn hạng mục [OT] ở tab Tác vụ (tạo tên "[OT]…" bị chặn) — xoá / sửa tác vụ không làm mất tăng ca.
     Quản lý mở bản mới lần đầu: tự chuyển các hạng mục [OT] cũ sang khung chung khớp theo giờ (giữ hệ số), dữ liệu không đổi.
     Khung có giờ chấm thì không xoá được; giờ OT của hạng mục [OT] đã xoá trước đây gán lại được vào khung.
     Màn chấm công nhân viên giữ nguyên thao tác (Tăng ca cho tác vụ + Khung giờ, không hiện hệ số).
   Mới ở v6.2 — Bảng chấm công: bỏ tiêu đề "Công việc dự án"; nhóm "Công việc chung" / "Vắng mặt" của dòng Khác
     hiện thành nhãn màu bo tròn (xanh ngọc / xanh nhạt) + chú thích + đường kẻ mảnh, tách rõ khỏi tác vụ bên dưới.
   Mới ở v6.1 — Hộp sửa nhanh ô ngày luôn nằm trọn trong màn hình (lật lên trên ô khi sát đáy, cuộn bên trong nếu quá dài).
     Bỏ tab "Chi tiết nhân viên" ở Bảng công — sửa cả tuần bằng ngăn kéo (✎ hoặc bấm tên).
   Mới ở v6.0 — Tổng quan bảng công: sửa giờ ngay tại chỗ, không chuyển tab.
     · Bấm một ô ngày → hộp sửa nhanh các dòng giờ của ngày đó (giữ dấu đã gửi; ngày hết giờ thì bỏ dấu).
     · Bấm ✎ hoặc tên người → ngăn kéo bên phải với bảng sửa cả tuần (dùng lại bảng của Chi tiết nhân viên): thêm dòng,
       tăng ca, chép tuần trước, lưu, mở khoá; nút ‹ › sang người kế tiếp; Esc / ✕ để đóng (hỏi nếu còn thay đổi chưa lưu).
   Mới ở v5.9 — Bảng công (quản lý): "Tổng quan bảng công" thay khung Tình trạng nộp + Ma trận giờ công.
     Tuần = lưới ngày (giờ từng ngày, tăng ca "+h", tổng / chuẩn, trạng thái nộp, cột Nhắc gửi thông báo);
     Tháng = lịch nhiệt (ô nhỏ mỗi ngày, cùng bộ màu; chấm trạng thái nộp từng tuần, bấm để mở tuần). Hiện ngày lễ.
     Tiêu đề cột: thứ ở trên, ngày ở dưới. Cột "Mở khoá / sửa": mở khoá cả tuần cho nhân sự (có xác nhận) · mở Chi tiết đúng tuần để sửa.
   Mới ở v5.8 — Tab Nhân sự, chi tiết một người: thêm bảng Tác vụ · Giờ · % (gộp mọi dự án trong kỳ) bên phải bảng Dự án.
   Mới ở v5.7 — Tab Nhân sự, thanh từng người: số giờ nằm trong từng khúc (Giờ chuẩn / OT / cố gắng), bên phải chỉ còn giờ tổng;
     ngoặc vàng phía trên thanh chỉ khoảng thiếu giờ chuẩn ("thiếu x h"); vạch giờ chuẩn của kỳ đổi trắng mờ, mảnh 1px;
     khung chi tiết bỏ dòng "Giờ chuẩn · OT · cố gắng".
   Mới ở v5.6 — Dashboard tách hai tab "Dự án | Nhân sự", mỗi tab có bộ lọc riêng:
     · Dự án: tiến độ từ trước tới nay (không theo kỳ); lọc Vượt / Sắp vượt / Bình thường, tìm dự án; KPI đang mở / vượt /
       sắp vượt / Urgent; thêm cột "Người tuần này".
     · Nhân sự: kỳ chọn nhanh Tuần này / 7 ngày qua / Tháng này hoặc lịch, bộ phận, tìm người, Excel; 6 KPI; người chưa chấm
       gom một dòng cuối. Bỏ ô lọc Dự án / Giai đoạn chung ở đầu trang.
     · Khung chi tiết giai đoạn: rê chuột vào tên nhân sự → thẻ tác vụ của người đó trong giai đoạn (Tác vụ · Giờ · %).
       Cần chạy lại supabase/schema.sql (mục 14 trả thêm "et"); chưa chạy thì tạm tính từ dữ liệu đã tải.
     · Giai đoạn đang xem chi tiết: viền teal mảnh bo góc bao trọn dòng dự án + khung chi tiết.
     · Bảng "Tăng ca theo tác vụ" trong khung chi tiết mặc định ẩn — bấm nút ▸ ở đầu khung TĂNG CA để xổ bảng ra bên dưới.
       Bảng không hiện hệ số / giờ quy đổi (vẫn có trong file Excel); cột "Trong đó CN / lễ" chỉ hiện khi có giờ tăng ca CN / lễ.
   Mới ở v5.5 — Phân bổ nhân sự, chi tiết một người: thêm cột % thời gian theo dự án; rê chuột vào dự án hiện thẻ
   các tác vụ người đó làm trong dự án (giờ, % trên tổng giờ của người đó ở dự án; dòng tăng ca ghi "Tăng ca · tác vụ"),
   phần người đó chiếm trong tổng giờ dự án của kỳ, và giai đoạn.
   Mới ở v5.4 — "Phân bổ giờ công theo nhân sự" (Theo người): chi tiết khi bấm một người chỉ còn chữ + số
   (dòng Giờ chuẩn · OT · cố gắng, rồi mỗi dự án một dòng tên — giờ), bỏ các thanh màu nhỏ; thanh tải có khe tách
   nhẹ giữa các khúc Giờ chuẩn / OT / cố gắng.
   Mới ở v5.3 — Dashboard quản lý, "Phân bổ giờ công theo nhân sự": hai cách xem Theo người (thanh chuẩn / OT / cố gắng,
   nhãn Quá tải / Thiếu giờ, gom theo bộ phận, bấm mở chi tiết dự án) và Ma trận người × dự án; hàng chỉ số công suất;
   lọc theo trạng thái, sắp xếp. Ngưỡng Quá tải / Thiếu giờ chỉnh ở Thiết lập (cfg.allocOver, cfg.allocUnder).
   Mới ở v5.2 — Đổi màu để giờ chuẩn và OT không lẫn nhau: Giờ chuẩn = xanh dương nhạt (blue-400 #60a5fa),
   OT / Tăng ca = xanh ngọc (teal, trước là xanh lá emerald), Giờ cố gắng giữ tím. Áp toàn app.
   Mới ở v5.1 — Tăng ca gộp theo KHUNG GIỜ: mỗi vai trò có bộ hạng mục [OT] riêng nhưng cùng khung giờ, nên hệ số (Thiết lập),
   cột của bảng "Tăng ca theo tác vụ" (Dashboard), sheet Tăng ca (Excel) và ô Khung giờ ở màn chấm công đều gộp theo khung giờ
   (otBandKey), không tách theo từng hạng mục. cfg.otRates nay lưu theo khung giờ; hệ số cũ lưu theo mã hạng mục vẫn đọc được.
   Mới ở v5.0 — Nhóm Tăng ca trong khối dự án mặc định ẩn: chỉ có nút "+ Tăng ca"; bấm vào mới hiện, kèm sẵn
   một dòng khung giờ đầu tiên (17:30 – 21:00). "+ Thêm dòng tăng ca" thêm lần lượt các khung kế tiếp.
   Mỗi dòng tăng ca có nút xoá (kể cả khi chưa nhập giờ); xoá hết dòng thì nhóm Tăng ca ẩn lại.
   Mới ở v4.9 — Tăng ca gắn tác vụ (phương án B+): mỗi dòng tăng ca (hạng mục [OT] = một khung giờ) phải chọn
   "Tăng ca cho tác vụ" nào (row.otFor); một khung giờ có thể có nhiều dòng cho nhiều tác vụ. Thiết lập có hệ số
   chi phí từng khung giờ + hệ số Chủ nhật / ngày lễ. Dashboard (chi tiết giai đoạn) và Excel có giờ tăng ca theo
   tác vụ × khung giờ và giờ quy đổi. Database: các hàm khoá ngày đã gửi tính cả otFor (chạy lại schema.sql).
   Mới ở v4.8 — Dashboard quản lý, "Tiến độ dự án": làm nổi giai đoạn đang mở (nền màu giai đoạn + vạch trái, ô đóng chìm hẳn);
     cờ Urgent cho dự án (rê chuột vào tên → bấm cờ), dự án Urgent luôn xếp đầu bảng.
   Mới ở v4.7 — Dashboard quản lý, bảng "Tiến độ dự án": rê chuột vào ô giai đoạn hiện thẻ tóm tắt (giờ còn lại, dự báo,
     ai / tác vụ nào tiêu giờ nhiều nhất, tăng ca, lần gửi gần nhất); bấm vào ô mở khung chi tiết ngay dưới dự án (giờ theo tuần,
     toàn bộ nhân sự và tác vụ, dòng Tăng ca 3 mức), các dự án khác mờ đi. Số liệu do database tính (schema.sql mục 14).
   Mới ở v4.6 — Dashboard quản lý: "Tiến độ dự án" (giờ hiện tại từ trước tới nay so với dự kiến từng giai đoạn, cảnh báo
     chỉ giai đoạn đang mở) thay biểu đồ giai đoạn cũ; "Phân bổ giờ công theo nhân sự" (thanh chia khúc + vạch giờ chuẩn kỳ)
     thay bảng nhân sự × dự án. Các tab khác giữ nguyên.
   Mới ở v4.5 — Dashboard quản lý: bỏ biểu đồ "Giờ công theo tác vụ"; bảng nhân sự × dự án gọn cho nhiều dự án
   Mới ở v4.4 — mô tả ngắn cho tác vụ: quản lý ghi ở tab Tác vụ (bút chì), nhân sự thấy dưới tên hạng mục khi nhập giờ
     + kéo thả để đổi thứ tự tác vụ (máy tính); màn Chấm công hiện đúng thứ tự đó
   Mới ở v4.3 — chỉ sửa database: khoá bảng cũ artius_kv (xem supabase/schema.sql mục 8b)
   Mới ở v4.2 — nhắc lại mỗi 1 giờ
   · Sau lần nhắc đầu tiên (giờ trong Thiết lập), người chưa gửi đủ được nhắc lại mỗi 1 giờ trong chính ngày nhắc,
     tới 17:30 thì dừng; gửi đủ là hết nhận. Áp dụng cho cả nhắc tuần và nhắc chốt tháng (xem api/_reminders.js).
   Mới ở v4.1 — nhân viên vào app dễ hơn
   · Cài app từ trình duyệt (PWA): nút "Cài app" trên thanh đầu trang (Chrome/Edge, Android);
     iPhone hiện hướng dẫn "Thêm vào MH chính". Cài xong có icon ARTIUS TIME, mở cửa sổ riêng.
   · Bấm thông báo nhắc khi app đang mở: chuyển thẳng tới tuần cần gửi (trước chỉ đưa cửa sổ lên).
   · Màn đăng nhập nhớ tên đăng nhập lần trước trên máy đó.
   · Thiết lập → "Truy cập app": link, mã QR và in poster QR dán ở văn phòng / xưởng / công trường.
   ------------------------------------------------------------
   v2.2
   Mới ở v2.2 — chuẩn bị chạy thật cho 50+ người
   · Tự cập nhật nhẹ hơn: lần hỏi định kỳ chỉ lấy danh sách dòng vừa đổi, tải nội dung đúng dòng đổi;
     quản lý hỏi 30 giây/lần, máy để yên quá 10 phút thì ngừng hỏi.
   · Thư viện Excel chỉ tải khi bấm xuất file, mở app nhanh hơn.
   · Báo "Mất kết nối" và tự gửi lại khi có mạng.
   · Màn hình hỏng hiện thông báo + nút tải lại thay vì trang trắng.
   Mới ở v2.1
   · Mở app chỉ tải bảng công 6 tháng gần nhất; tháng cũ hơn tự tải khi xem tới (báo cáo, lịch chọn tuần, tuần cũ).
     Tổng giờ "từ trước tới nay" (tab Dự án, Giai đoạn) do database tính (hàm artius_usage).
   · Sửa lỗi nút Xuất Excel ở Dashboard cá nhân của nhân sự (có từ v1.6).
   Mới ở v2.0
   · Cảnh báo thiếu bảng công chỉ tính những ngày đã tới (tính cả hôm nay); tuần chưa tới không bị báo thiếu.
   · Bỏ dòng thông báo "Đã gửi và khoá: T2, T3…" trên màn chấm công (ô ngày đã gửi vẫn có biểu tượng khoá).
   Dark theme thống nhất · responsive desktop + mobile
   Storage: window.storage (shared = true)
     artius:config:v1            -> { employees, projects, tasks, adminPin, deadlineDay, hours, holidays }
     artius:db:v1 -> { config, ts: { '<empId>:<YYYY-MM>': { rows, weeks } } }   (một khoá duy nhất)

   Mới ở v1.7 (chỉ chạy ở bản webapp Vercel + Supabase, không còn chạy trong artifact)
   · Đăng nhập bằng tên đăng nhập + mật khẩu (Supabase Auth). Bỏ màn chọn tên và mã PIN quản lý
   · Ban quản lý tạo tài khoản, đặt / xem / đặt lại mật khẩu, khoá tài khoản ngay ở tab Nhân sự
   · Quyền quản lý là một thuộc tính của tài khoản
   · Dữ liệu chỉ được tải SAU khi đăng nhập. Tải hỏng thì dừng ở màn báo lỗi, không vào app
     với dữ liệu rỗng (tránh ghi đè dữ liệu thật)

   Mới ở v1.9 — quy trình gửi và khoá bảng công
   · Bỏ Lưu nháp: giờ nhân sự nhập chỉ nằm trên màn hình cho tới khi bấm "Gửi giờ công". Gửi và khoá theo từng ngày.
     Rời trang, đổi tuần hay đổi tab khi chưa gửi đều được hỏi lại vì giờ đang nhập sẽ mất
   · Gửi là khoá cứng: nhân sự không tự mở khoá được, chỉ quản lý mở ở Bảng công → Chi tiết nhân viên.
     Database cũng chặn (trigger artius_ts_guard), không chỉ giao diện
   · Quản lý chỉ tổng hợp giờ của tuần ĐÃ GỬI: Dashboard, Ma trận giờ công, file Excel, cột Dự án đang tham gia
   · Màn hình tự cập nhật: máy quản lý hỏi server 10 giây một lần (chỉ lấy dòng vừa thay đổi),
     máy nhân sự 60 giây một lần và khi quay lại tab

   Mới ở v1.8 — tách bảng dữ liệu (xem src/data.js và supabase/schema.sql)
   · Thiết lập nằm ở bảng artius_config; bảng công mỗi nhân sự mỗi tháng là một dòng ở artius_ts.
     Trước đây toàn bộ dữ liệu nằm trong MỘT dòng, ai bấm Lưu nháp là ghi lại cả khối theo bản
     máy mình tải lúc mở app, nên đè mất giờ công và thay đổi thiết lập của người khác
   · Mỗi lần lưu chỉ ghi đúng dòng (nhân sự, tháng) liên quan, và đọc lại dòng đó ngay trước khi ghi
   · Database chặn nhân sự đọc/ghi bảng công của người khác và chặn sửa thiết lập (chỉ quản lý)
   · Nhân sự chỉ tải bảng công của chính mình; quản lý tải tất cả
   · Hai quản lý cùng sửa thiết lập: app đọc bản mới nhất rồi gộp theo từng mục trước khi ghi (src/merge.js)
   · Bỏ cảnh báo "hạn mức lệnh" và "giới hạn một khoá": hai giới hạn đó chỉ có ở bản artifact

   Cập nhật 09/10/2026 (v1.7) — tab Nhân sự
   · Chia 2 tab con: Nhân sự | Tài khoản quản lý
   · Một bảng duy nhất gom theo phòng ban, có ô tìm, lọc theo phòng ban và trạng thái tài khoản;
     "Dự án đang tham gia" là một cột (bỏ bảng theo dõi riêng)
   · Thêm / sửa qua khung nhập: tên đăng nhập tự gợi ý theo họ tên, mật khẩu sinh sẵn,
     vai trò lọc theo phòng ban, có "Lưu và thêm tiếp"
   · Mỗi dòng có nút chép tài khoản; nút Xuất tài khoản ra Excel theo bộ lọc đang chọn

   Cập nhật 09/10/2026 (vẫn là v1.7) — tab Tác vụ
   · Chia 3 tab con: Tác vụ | Phòng ban & vai trò | Vắng mặt
   · Tab Tác vụ: cột trái là vai trò gom theo phòng ban (có ô tìm và số tác vụ), cột phải là tác vụ của vai trò đang chọn
   · Phòng ban và vai trò: bấm vào để sửa tên tại chỗ, chỉ còn nút thùng rác
   · Vai trò: bấm đúp vào mã để sửa mã (nhân sự và tác vụ đang dùng mã cũ đổi theo); kéo thả sang dòng phòng ban khác để chuyển phòng ban

   Mới ở v1.5
   · Ghi chú phiên bản ở góc trái, dưới cùng màn hình
   · Tab Tác vụ (ban quản lý): thêm mới / xoá vai trò. Danh sách vai trò nằm trong cấu hình dùng chung
   · Bỏ nút "Nạp bộ tác vụ theo vai trò" (bộ 25 tác vụ chuẩn)
   · Tab Tác vụ chỉ còn ô vai trò, ô dùng chung và danh sách tác vụ; bỏ các dòng ghi chú nhỏ
   · Bỏ tác vụ theo bộ phận: tác vụ chỉ gắn vai trò hoặc dùng chung. Tác vụ cấp bộ phận có sẵn
     trong dữ liệu bị xoá khi nạp. Xoá một vai trò thì xoá luôn tác vụ của vai trò đó

   Mới ở v1.4
   · Toàn bộ dữ liệu nằm trong MỘT khoá lưu trữ. Đọc 1 lần lúc mở app, sau đó mọi thao tác
     chạy trong bộ nhớ. Quản lý xem dashboard 20 nhân sự: 64 lệnh -> 3 lệnh.
   · Mọi lệnh lưu trữ có hạn chờ 8 giây, hết hạn thì đi tiếp thay vì treo app
   · Khởi động luôn kết thúc kể cả khi lưu trữ hỏng
   · Sao lưu / khôi phục toàn bộ dữ liệu ra file JSON
   · Tự nhận biết mất kết nối lưu trữ và dừng gọi, kèm nút tải lại trang

   Mới ở v1.3
   · Khoá tổng hợp theo tháng: Dashboard đọc 1 lệnh/tháng thay vì 1 lệnh/nhân sự/tháng
   · Vắng mặt chọn thẳng trong ô Tác vụ (Phép năm, nghỉ ốm, không lương, nghỉ lễ, công tác ngoài)
   · Ghi chú mở bằng nút "…" thay vì chiếm một cột trong bảng
   · Mũi tên/Enter di chuyển giữa các ô giờ · Điền giờ chuẩn cả tuần · Hoàn tác xoá dòng
   · Cảnh báo khi rời bảng công lúc chưa lưu
   · Hạn mức giờ cho dự án + panel cảnh báo vượt giờ
   · Tra cứu bằng Map thay cho .find() trong vòng lặp

   Mới ở v1.2
   · Tab "Bảng công" cho quản lý: chọn nhân sự, xem và sửa trực tiếp, đánh dấu / gỡ đánh dấu đã gửi
   · Giờ chuẩn cấu hình được theo T2–T6 / T7 / CN + ngưỡng cảnh báo vượt giờ mỗi ngày
   · Thanh tiến độ so với target tuần (chấm công) và target kỳ (dashboard cá nhân)
   · Ngày lễ khai báo ở Thiết lập — miễn cảnh báo thiếu giờ, giờ chấm vào đó tính hết là OT
   · Nghỉ phép theo ngày: phép năm, phép nửa ngày, nghỉ ốm, không lương, công tác ngoài
   · OT tự tính (vượt giờ chuẩn + ngày lễ/ngày nghỉ), hiện trên cả 2 dashboard và file Excel

   Mới ở v1.1
   · Ghi chú theo từng dòng chấm công · Chép cơ cấu dòng của tuần trước
   · Khoá tuần đã gửi · Tự lưu khi chuyển tuần · Xác nhận trước khi xoá
   · Dashboard quản lý: lọc bộ phận / dự án / tên + biểu đồ theo hạng mục
   ============================================================ */

/* v7.8 — Giao diện: Tối / Sáng / Theo máy — lưu riêng từng máy (localStorage "artius:theme"), mặc định Tối.
   "Theo máy" đi theo cài đặt sáng/tối của Windows, macOS hoặc điện thoại (tự đổi khi máy đổi).
   Sáng = CSS đảo màu đặt dưới html[data-theme="light"] (LIGHT_CSS, sinh từ class Tailwind); Tối = giao diện cũ, không đổi. */
const THEME_KEY = "artius:theme";
const readPref = () => { try { const v = localStorage.getItem(THEME_KEY); return v === "light" || v === "system" ? v : "dark"; } catch { return "dark"; } };
const sysLight = () => { try { return window.matchMedia("(prefers-color-scheme: light)").matches; } catch { return false; } };
const effTheme = (pref) => (pref === "system" ? (sysLight() ? "light" : "dark") : pref);
const applyTheme = (t) => {
  try {
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#f1f5f9" : "#020617");
  } catch { /* bỏ qua */ }
};
applyTheme(effTheme(readPref()));
try {   // máy đổi sáng/tối khi đang chọn "Theo máy" → đổi theo ngay
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (readPref() === "system") { applyTheme(effTheme("system")); window.dispatchEvent(new Event("artius:theme")); }
  });
} catch { /* trình duyệt cũ: bỏ qua */ }
const isLight = () => { try { return document.documentElement.dataset.theme === "light"; } catch { return false; } };   // đọc lúc vẽ: App vẽ lại khi đổi giao diện
function useTheme() {
  const [pref, setPrefState] = useState(readPref);
  const [, bump] = useState(0);
  useEffect(() => { const f = () => { setPrefState(readPref()); bump((n) => n + 1); }; window.addEventListener("artius:theme", f); return () => window.removeEventListener("artius:theme", f); }, []);
  const setPref = (p) => { try { localStorage.setItem(THEME_KEY, p); } catch { /* không lưu được: chỉ đổi cho phiên này */ } applyTheme(effTheme(p)); setPrefState(p); window.dispatchEvent(new Event("artius:theme")); };
  return [effTheme(pref), setPref, pref];
}
function BrandLogo({ className }) {
  const [theme] = useTheme();
  return <img src={theme === "light" ? "/logo-artius-time-light.svg" : "/logo-artius-time.svg"} alt="ARTIUS Time Tracking" className={className} />;
}
/* nút chọn giao diện: 3 ô Tối · Sáng · Theo máy */
function ThemeToggle() {
  const [, setPref, pref] = useTheme();
  const opts = [["dark", Moon, "Tối"], ["light", Sun, "Sáng"], ["system", Monitor, "Theo máy"]];
  return (
    <div role="radiogroup" aria-label="Giao diện" className="ml-3 inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-slate-700 p-0.5">
      {opts.map(([k, Icon, l]) => (
        <button key={k} role="radio" aria-checked={pref === k} onClick={() => setPref(k)}
          title={k === "system" ? "Theo máy — tự sáng / tối theo cài đặt của máy tính hoặc điện thoại" : `Giao diện ${l}`}
          className={`inline-flex h-7 w-8 items-center justify-center rounded-md transition-colors ${pref === k ? "bg-teal-500/15 text-teal-300" : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"}`}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

const APP_VERSION = "v8.3";
/* v4.1 — Cài app (PWA). Bắt sự kiện "beforeinstallprompt" ngay lúc nạp module (trước khi React vẽ) để không lỡ.
   Chrome/Edge (máy tính, Android): bấm "Cài app" hiện hộp cài của trình duyệt.
   iPhone/iPad: Safari không có hộp cài — hiện hướng dẫn "Chia sẻ → Thêm vào MH chính".
   Đang chạy dạng app đã cài thì ẩn nút. */
let INSTALL_EVT = null;
const installSubs = new Set();
const notifyInstall = () => installSubs.forEach((f) => f());
const isStandalone = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
};
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); INSTALL_EVT = e; notifyInstall(); });
  window.addEventListener("appinstalled", () => { INSTALL_EVT = null; notifyInstall(); });
}
function useInstall() {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((x) => x + 1); installSubs.add(f); return () => installSubs.delete(f); }, []);
  const mode = isStandalone() ? null : INSTALL_EVT ? "prompt" : isIOS() ? "ios" : null;
  const install = async () => {
    const e = INSTALL_EVT;
    if (!e) return null;
    INSTALL_EVT = null;            // mỗi sự kiện chỉ gọi prompt() được một lần
    e.prompt();
    const r = await e.userChoice.catch(() => null);
    notifyInstall();
    return r?.outcome || null;
  };
  return { mode, install };
}

function InstallButton() {
  const { mode, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  if (!mode) return null;
  return (
    <>
      <button onClick={() => (mode === "ios" ? setIosHelp(true) : install())}
        className="ml-3 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-teal-800 px-2.5 text-xs text-teal-300 hover:border-teal-600 hover:text-teal-200">
        <Download size={13} /> Cài app
      </button>
      {iosHelp && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 md:items-center" onClick={() => setIosHelp(false)}>
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm text-slate-50">Cài ARTIUS TIME lên iPhone</h4>
            <ol className="mt-3 space-y-2.5 text-sm text-slate-300">
              <li className="flex gap-2"><span className="w-4 shrink-0 font-mono text-teal-400">1</span><span>Mở trang này bằng Safari, bấm nút Chia sẻ <Share size={14} className="inline align-[-2px] text-teal-300" /> ở thanh dưới</span></li>
              <li className="flex gap-2"><span className="w-4 shrink-0 font-mono text-teal-400">2</span><span>Chọn "Thêm vào MH chính" → Thêm</span></li>
              <li className="flex gap-2"><span className="w-4 shrink-0 font-mono text-teal-400">3</span><span>Mở app từ icon ARTIUS TIME, đăng nhập một lần và cho phép thông báo</span></li>
            </ol>
            <button onClick={() => setIosHelp(false)} className={`mt-4 w-full ${btnGhost}`}>Đã hiểu</button>
          </div>
        </div>
      )}
    </>
  );
}

/* v2.2 — Thư viện Excel nặng nhất app; chỉ tải khi có người bấm xuất / đọc file Excel. */
let XLSX_MOD = null;
const loadXlsx = async () => XLSX_MOD || (XLSX_MOD = await import("xlsx"));
const TS_PREFIX = "artius:ts:";   // tiền tố khoá của file sao lưu đời cũ, chỉ còn dùng khi khôi phục
/* ------------------------------------------------------------------
   DỮ LIỆU TRONG BỘ NHỚ + ĐỌC/GHI THEO TỪNG DÒNG (v1.8)
   App đọc dữ liệu một lần lúc đăng nhập rồi giữ trong DB để mọi màn hình tra cứu tức thì.
   Khi ghi thì KHÔNG ghi lại cả khối như trước: thiết lập ghi vào dòng thiết lập, bảng công
   ghi đúng dòng (nhân sự, tháng) vừa sửa. Nhờ đó người này lưu không đè dữ liệu người kia.
   ------------------------------------------------------------------ */
let OT_PENDING = -1;      // v6.3: >= 0 = cấu hình vừa chuyển sang khung tăng ca chung, chưa lưu (số hạng mục [OT] đã gỡ)
let OT_MIG_NOTE = "";     // thông báo một lần ở Thiết lập → Tăng ca sau khi chuyển đổi
let DB = null;            // { v, config, base, ts: { "<empId>:<ym>": bucket } } — base = bản thiết lập khớp với server lần gần nhất
let DB_LOADED = false;
const cloneJson = (o) => JSON.parse(JSON.stringify(o));
const LOAD_TIMEOUT = 30000; // tải toàn bộ bảng công (tài khoản quản lý) có thể lâu hơn một lệnh thường

const slot = (empId, ym) => `${empId}:${ym}`;
const emptyDB = () => ({ v: 2, config: emptyConfig(), ts: {} });

/* v2.1 — Chỉ tải sẵn bảng công RECENT_MONTHS tháng gần nhất (tính cả tháng này) và các tháng sau đó.
   Tháng cũ hơn: ensureMonths() tải khi có màn hình cần tới. full = true: tải hết (dùng khi xuất sao lưu). */
const RECENT_MONTHS = 6;
const recentFromYm = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (RECENT_MONTHS - 1)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const LOADED_OLD = new Set();   // các tháng cũ (trước mốc) đã tải đủ
const loadDB = async (force = false, full = false) => {
  if (DB_LOADED && !force) return DB;
  const c = await call(() => fetchConfig(), "get", LOAD_TIMEOUT);
  if (!c.ok) throw new Error("Không đọc được thiết lập");
  let config = c.value?.config || null;
  if (!config) {
    /* Server xác nhận chưa có dòng thiết lập nào = cài mới. Chỉ tài khoản quản lý tạo được;
       nhân sự gặp trường hợp này thì dừng ở màn báo lỗi chứ không dựng dữ liệu rỗng. */
    config = emptyConfig();
    const w = await call(() => saveConfig(config, null), "set");
    if (!w.ok) throw new Error("Không khởi tạo được dữ liệu");
    if (w.value.conflict) return loadDB(force);   // người khác vừa tạo trước: đọc lại bản của họ
  }
  const fromYm = full ? "" : recentFromYm();
  const t = await call(() => fetchTsChanges("", { fromYm }), "get", LOAD_TIMEOUT);
  if (!t.ok) throw new Error("Không đọc được bảng công");
  DB = { v: 2, config, base: cloneJson(config), ts: t.value.rows || {}, loadedFrom: fromYm };
  TS_STAMP = new Map(Object.entries(t.value.stamps || {}));
  LOADED_OLD.clear();
  TS_SYNC = t.value.max || "";
  DB_LOADED = true;
  bumpData();
  return DB;
};

/* v2.1 — Bảo đảm các tháng yms đã có trong bộ nhớ: tháng nào cũ hơn mốc tải sẵn mà chưa tải thì đọc từ server
   (quản lý: bảng công của mọi người trong tháng đó; nhân sự: của chính mình). Có tải thêm thì báo các màn hình vẽ lại. */
const ensureMonths = async (yms) => {
  if (!DB_LOADED || !DB?.loadedFrom) return true;
  const need = [...new Set(yms)].filter((ym) => ym && ym < DB.loadedFrom && !LOADED_OLD.has(ym));
  if (!need.length) return true;
  const stamps = {};
  const r = await call(() => fetchTs({ yms: need, stamps }), "get", LOAD_TIMEOUT);
  if (!r.ok) return false;
  for (const ym of need) LOADED_OLD.add(ym);
  for (const [k, v] of Object.entries(r.value)) DB.ts[k] = v;
  for (const [k, at] of Object.entries(stamps)) TS_STAMP.set(k, at);
  bumpData();
  return true;
};
/* v2.1 — Tổng giờ dự án × giai đoạn trên toàn bộ dữ liệu, hỏi database (xem fetchUsage). null = chưa có / không hỏi được. */
const useUsage = () => {
  const tick = useDataTick();
  const [u, setU] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchUsage().then((r) => { if (alive) setU(r); }).catch(() => { if (alive) setU(null); });
    return () => { alive = false; };
  }, [tick]);
  return u;
};
/* v4.7 — Chi tiết giai đoạn cho Dashboard (xem fetchPhaseDetail). undefined = đang hỏi; null = không hỏi được
   (chưa chạy schema.sql mục 14) → Dashboard tạm tính từ phần bảng công đang có trong bộ nhớ. */
const usePhaseDetail = () => {
  const tick = useDataTick();
  const [d, setD] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetchPhaseDetail().then((r) => { if (alive) setD(r); }).catch(() => { if (alive) setD(null); });
    return () => { alive = false; };
  }, [tick]);
  return d;
};
const allLoaded = () => DB_LOADED && !DB?.loadedFrom;

/* v1.9 — Tự cập nhật. TS_SYNC là mốc thời gian (giờ server) của dòng mới nhất đã nhận.
   pullTs hỏi server "có dòng bảng công nào đổi sau mốc này không" rồi chép vào bộ nhớ;
   có thay đổi thật thì báo cho các màn hình đang mở vẽ lại (useDataTick). */
let TS_SYNC = "";
let DATA_TICK = 0;
const dataListeners = new Set();
const bumpData = () => { DATA_TICK++; dataListeners.forEach((f) => f()); };
const useDataTick = () => {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    dataListeners.add(f);
    return () => { dataListeners.delete(f); };
  }, []);
  return DATA_TICK;
};
let PULLING = false;
/* v2.2 — TS_STAMP: mốc updated_at của từng dòng (nhân sự, tháng) đang giữ trong bộ nhớ.
   pullTs hỏi danh sách mốc (rất nhẹ), so với TS_STAMP, rồi chỉ tải nội dung các dòng có mốc khác.
   Tháng cũ chưa mở (ngoài 6 tháng tải sẵn) thì bỏ qua, khi nào cần ensureMonths sẽ tải đủ cả tháng. */
let TS_STAMP = new Map();
const pullTs = async () => {
  if (!DB_LOADED || !DB || PULLING) return false;
  PULLING = true;
  let changed = false;
  try {
    const list = await fetchTsStamps(TS_SYNC);   // gọi thẳng, không qua call(): lỗi ở lần hỏi ngầm thì bỏ qua, lần sau hỏi lại
    let max = TS_SYNC;
    const need = [];
    for (const x of list) {
      if (x.at && (!max || new Date(x.at) > new Date(max))) max = x.at;
      if (TS_STAMP.get(x.key) === x.at) continue;
      if (DB.loadedFrom && x.ym < DB.loadedFrom && !LOADED_OLD.has(x.ym)) continue;
      need.push(x);
    }
    if (need.length) {
      const stamps = {};
      const rows = await fetchTs({ empIds: [...new Set(need.map((x) => x.empId))], yms: [...new Set(need.map((x) => x.ym))], stamps });
      for (const x of need) {
        const v = rows[x.key];
        if (v === undefined) continue;
        if (JSON.stringify(DB.ts[x.key]) !== JSON.stringify(v)) { DB.ts[x.key] = v; changed = true; }
        TS_STAMP.set(x.key, stamps[x.key] || x.at);
      }
    }
    TS_SYNC = max;
    setNet(true);
  } catch (e) {
    if (isNetErr(errText(e))) setNet(false);
  }
  PULLING = false;
  if (changed) bumpData();
  return changed;
};
/* Đăng xuất: bỏ hết dữ liệu đang giữ trong bộ nhớ để người đăng nhập sau tải lại từ đầu */
const resetDB = () => { DB = null; DB_LOADED = false; TS_SYNC = ""; TS_STAMP = new Map(); memCache.clear(); LAST_STORAGE_ERROR = ""; };

/* Ghi thiết lập (chỉ tài khoản quản lý ghi được, database tự chặn người khác).
   Đọc bản mới nhất trên server, gộp phần mình vừa sửa vào (xem merge.js), rồi ghi kèm số phiên bản.
   Nếu đúng lúc đó có người ghi chen vào thì đọc lại và gộp lần nữa.
   Trả về bản thiết lập đã gộp (để giao diện hiện cả phần người khác vừa sửa), hoặc null nếu không ghi được. */
const commitConfig = async (next) => {
  if (!DB) DB = emptyDB();
  const base = DB.base || DB.config;
  DB.config = next;
  for (let attempt = 0; attempt < 4; attempt++) {
    const f = await call(() => fetchConfig(), "get");
    if (!f.ok) return null;
    const merged = f.value ? mergeConfig(base, next, f.value.config) : next;
    const w = await call(() => saveConfig(merged, f.value ? f.value.rev : null), "set");
    if (!w.ok) return null;
    if (!w.value.conflict) { DB.config = merged; DB.base = cloneJson(merged); return merged; }
  }
  LAST_STORAGE_ERROR = "thiết lập đang được sửa liên tục ở máy khác, hoặc tài khoản không có quyền quản lý";
  return null;
};
/* Ghi các bảng công trong changes = { "<empId>:<ym>": bucket }. Chỉ đụng tới đúng các dòng đó. */
const commitTs = async (changes) => {
  if (!DB) DB = emptyDB();
  Object.assign(DB.ts, changes);
  if (Object.keys(changes).length === 0) return true;
  return (await call(() => saveTs(changes), "set")).ok;
};
/* Đọc lại từ server các tháng của một nhân sự rồi cập nhật bộ nhớ. Gọi ngay trước khi lưu, để phần
   người đó vừa nhập ở máy khác (hoặc quản lý vừa sửa) trong cùng tháng không bị bản cũ trên máy này đè. */
const refreshTs = async (empId, yms) => {
  const r = await call(() => fetchTs({ empId, yms }), "get");
  if (!r.ok) return false;
  if (!DB) DB = emptyDB();
  for (const ym of yms) {
    const k = slot(empId, ym);
    if (r.value[k]) DB.ts[k] = r.value[k]; else delete DB.ts[k];
  }
  return true;
};
const wipeTs = async () => {
  if (!DB) DB = emptyDB();
  const ok = (await call(() => deleteAllTs(), "set")).ok;
  if (ok) DB.ts = {};
  return ok;
};

const dbTs = (empId, ym) => DB?.ts?.[slot(empId, ym)] || null;
/* v1.9 — Gửi và khoá theo TỪNG NGÀY. Ngày đã gửi được ghi ở bucket.sent['YYYY-MM-DD'] trong dòng tháng của ngày đó.
   Quản lý chỉ tổng hợp giờ của những ngày đã gửi. Dòng nào không còn ngày nào thì bỏ. */
const sentRows = (bucket) => {
  const sent = bucket?.sent || {};
  const out = [];
  for (const r of bucket?.rows || []) {
    const days = {};
    for (const [d, h] of Object.entries(r.days || {})) if (sent[d]) days[d] = h;
    if (Object.keys(days).length) out.push({ ...r, days });
  }
  return out;
};
const dbTsSent = (empId, ym) => { const b = dbTs(empId, ym); return b ? { ...b, rows: sentRows(b) } : null; };
const daySent = (empId, d) => !!dbTs(empId, ymOf(d))?.sent?.[d];
/* Một tuần tính là "đã nộp" khi mọi ngày phải chấm công của tuần (ngày có giờ chuẩn > 0 và không phải ngày lễ)
   đều đã gửi. Tuần gửi theo kiểu cũ (dấu weeks) vẫn được tính là đã nộp. */
const weekDone = (empId, monday) => {
  const hs = makeHolidayIndex(DB?.config?.holidays);
  const hc = DB?.config?.hours || DEFAULT_HOURS;
  const wd = weekDays(monday);
  const today = fmt(new Date());   // v2.0: chỉ tính ngày đã tới (kể cả hôm nay), ngày tương lai chưa phải nộp
  if (wd.filter((d) => d <= today && minHoursFor(d, hc, hs) !== null).every((d) => daySent(empId, d))) return true;
  return [...new Set(wd.map(ymOf))].every((ym) => dbTs(empId, ym)?.weeks?.[monday]);
};

/* ---------- date helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x;
};
const ymOf = (s) => s.slice(0, 7);
const prevYm = (ym) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
const ymLabel = (ym) => { const [y, m] = ym.split("-"); return `Tháng ${Number(m)}/${y}`; };
const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DOW_MINI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const dLabel = (s) => { const d = parseD(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
/* Bộ tra cứu ngày lễ. Ngày lễ dương lịch cố định (01/01, 30/04, 02/09…) đánh dấu lặp hàng năm
   thì chỉ khai báo một lần, năm nào cũng nhận. Ngày lễ âm lịch (Tết, Giỗ Tổ) đổi ngày mỗi năm
   nên vẫn khai từng năm một.
   Trả về đối tượng có has()/get() giống Map để mọi nơi đang dùng không phải sửa. */
const makeHolidayIndex = (list = []) => {
  const exact = new Map();   // 'YYYY-MM-DD' -> tên
  const yearly = new Map();  // 'MM-DD'      -> tên
  for (const h of list) {
    if (!h?.date) continue;
    const name = h.name || "Ngày lễ";
    if (h.yearly) yearly.set(h.date.slice(5), name); else exact.set(h.date, name);
  }
  return {
    get: (s) => (s ? exact.get(s) || yearly.get(s.slice(5)) || null : null),
    has: (s) => (s ? exact.has(s) || yearly.has(s.slice(5)) : false),
    size: exact.size + yearly.size,
  };
};

// Lễ dương lịch cố định của Việt Nam — thêm nhanh, khỏi gõ tay từng cái
const VN_FIXED_HOLIDAYS = [
  { md: "01-01", name: "Tết Dương lịch" },
  { md: "04-30", name: "Ngày Giải phóng miền Nam" },
  { md: "05-01", name: "Quốc tế Lao động" },
  { md: "09-02", name: "Quốc khánh" },
];
const DEFAULT_HOURS = { weekday: 8, sat: 4, sun: 0, satOt: 8, maxDaily: 13.5 };   // v3.5: tổng ngày chỉ đỏ khi vượt 13.5h
const OT_ALERT = 3.5; // OT một ngày vượt mốc này thì chuyển đỏ cảnh báo thay vì xanh

/* Ngày lễ được khoanh bằng một vòng cọ đỏ vẽ tay — nét không khép kín, hai đầu vuốt lệch,
   độ dày thay đổi để ra cảm giác nét bút thật thay vì hình tròn máy. Nhúng data-URI, không tải ngoài. */
const HOLIDAY_RING_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
  '<g fill="none" stroke="#ef4444" stroke-linecap="round">' +
  // vòng tròn chính, hở góc trên phải như nét cọ quẹt nhanh
  '<path d="M31 5.5C16 1.5 4.5 11 4 24c-.5 13 9.5 22.5 22 22.5 12 0 21.5-10 20.5-23C45.7 12.5 39 8 31 5.5" stroke-width="2.6" opacity=".92"/>' +
  // lớp mực mảnh chồng lệch
  '<path d="M33 8.5C19 4.5 7.5 13.5 7 25.5c-.5 12.5 9 21 21 21 11.5 0 20-9.5 19-21.5" stroke-width="1.2" opacity=".5"/>' +
  // đuôi vuốt quá đà chỗ khép vòng
  '<path d="M31 5.5c4.2.6 8 2.6 11.5 6.5" stroke-width="2.1" opacity=".8"/></g></svg>'
);

// v6.8: bản kéo giãn theo khung (vòng elip quanh cả nhãn ngày, VD "T4 02/09")
const HOLIDAY_RING_WIDE = HOLIDAY_RING_SVG.replace(encodeURIComponent('viewBox="0 0 48 48"'), encodeURIComponent('viewBox="0 0 48 48" preserveAspectRatio="none"'));
const holidayRingBg = (size = 34) => ({
  backgroundImage: `url("data:image/svg+xml,${HOLIDAY_RING_SVG}")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  backgroundSize: `${size}px ${size}px`,
});
const stdHoursFor = (s, h = DEFAULT_HOURS) => {
  const wd = (parseD(s).getDay() + 6) % 7; // 0=T2 ... 5=T7, 6=CN
  if (wd === 6) return Number(h.sun) || 0;
  if (wd === 5) return Number(h.sat) || 0;
  return Number(h.weekday) || 0;
};
const minHoursFor = (s, h = DEFAULT_HOURS, holidaySet = null) => {
  if (holidaySet?.has(s)) return null;
  const std = stdHoursFor(s, h);
  return std > 0 ? std : null;
};
/* Ngưỡng bắt đầu tính OT của một ngày — cố ý tách khỏi giờ chuẩn.
   T7 giờ chuẩn 4h nhưng chỉ vượt 8h mới tính OT, tức 4 giờ thứ 5 đến thứ 8 của T7
   vẫn là giờ thường. Ngày mà cấu hình cho nghỉ hẳn (giờ chuẩn 0) thì làm bao nhiêu OT bấy nhiêu. */
const otThresholdFor = (s, h = DEFAULT_HOURS) => {
  const std = stdHoursFor(s, h);
  if (std <= 0) return 0;
  const wd = (parseD(s).getDay() + 6) % 7; // 0=T2 ... 5=T7, 6=CN
  if (wd === 5) return Math.max(std, Number(h.satOt) || 8);
  return std;
};
/* v3.4 — OT chỉ là giờ chấm vào hạng mục Tăng ca ([OT]). Giờ làm việc thường vượt ngưỡng của ngày
   (hoặc làm ngày lễ / ngày nghỉ) KHÔNG phải OT mà là "Giờ cố gắng": ghi nhận nỗ lực của nhân sự,
   không tính vào chi phí dự án. `regular` = giờ làm việc thường trong ngày (không gồm OT, không gồm vắng mặt). */
const effortHoursFor = (s, regular, h = DEFAULT_HOURS, holidaySet = null) => {
  if (!regular) return 0;
  if (holidaySet?.has(s)) return regular;
  const th = otThresholdFor(s, h);
  return th <= 0 ? regular : Math.max(0, regular - th);
};
const weeklyTarget = (h = DEFAULT_HOURS) => (Number(h.weekday) || 0) * 5 + (Number(h.sat) || 0) + (Number(h.sun) || 0);
const dFull = (s) => { const d = parseD(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const lastOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const mondaysOfMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1), last = new Date(y, m, 0);
  const out = []; let cur = mondayOf(first);
  while (cur <= last) { out.push(fmt(cur)); cur = addDays(cur, 7); }
  return out;
};
// v2.0 — các tuần của tháng đã bắt đầu tính tới hôm nay; tuần chưa tới thì chưa phải nộp
const mondaysDue = (ym) => { const today = fmt(new Date()); return mondaysOfMonth(ym).filter((m) => m <= today); };
const weekDays = (mondayStr) => {
  const m = parseD(mondayStr);
  return Array.from({ length: 7 }, (_, i) => fmt(addDays(m, i)));
};
// các tháng (YYYY-MM) mà khoảng [from, to] chạm tới
const ymsBetween = (from, to) => {
  const a = parseD(from), b = parseD(to);
  const out = []; let y = a.getFullYear(), m = a.getMonth();
  while (y * 12 + m <= b.getFullYear() * 12 + b.getMonth()) {
    out.push(`${y}-${pad(m + 1)}`); m++; if (m > 11) { m = 0; y++; }
  }
  return out;
};

/* ---------- storage helpers ---------- */
const STORAGE_OK = typeof window !== "undefined" && !!window.storage;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let LAST_STORAGE_ERROR = "";
const errText = (e) => {
  if (!e) return "không rõ";
  if (typeof e === "string") return e;
  return e.message || e.name || JSON.stringify(e).slice(0, 200) || String(e);
};

/* ------------------------------------------------------------------
   TẦNG LƯU TRỮ
   Mỗi lệnh get/set là một message tới trình duyệt và có hạn mức cho cả phiên.
   Chạm hạn thì MỌI lệnh sau đều hỏng cho tới khi tải lại trang — thử lại chỉ tốn thêm quota.
   Nên ở đây: đệm mọi thứ đã đọc/ghi trong bộ nhớ, không lệnh nào gọi hai lần,
   và khi chạm hạn thì dừng gọi luôn để báo cho người dùng biết đường tải lại.
   ------------------------------------------------------------------ */
const memCache = new Map();     // 'chung|riêng' + khoá -> giá trị đã parse
let CALL_COUNT = 0;
let RATE_LIMITED = false;
const storageListeners = new Set();
const notifyStorage = () => storageListeners.forEach((f) => f());
const isRateLimit = (msg) => /rate limit/i.test(msg || "");
/* "Unexpected response type" là cách API này báo KHOÁ CHƯA TỒN TẠI — chuyện hoàn toàn
   bình thường ở lần chạy đầu. Đừng coi là hỏng kết nối: làm vậy app sẽ tự khoá chính nó
   ngay lần đọc đầu tiên khi chưa có dữ liệu. */
const isMissingKey = (msg) => /unexpected response type|not found|no such key/i.test(msg || "");
/* Chỉ hạn mức phiên mới là lỗi không cứu được, buộc phải tải lại trang. */
const markError = (e) => {
  LAST_STORAGE_ERROR = errText(e);
  if (isRateLimit(LAST_STORAGE_ERROR) && !RATE_LIMITED) { RATE_LIMITED = true; notifyStorage(); }
};
/* v2.2 — Trạng thái mạng. Lệnh tới server hỏng vì mạng thì báo "Mất kết nối"; lệnh nào thành công thì báo có mạng lại.
   Màn chấm công nghe sự kiện này để tự gửi lại phần đang chờ. */
let NET_OK = true;
const netListeners = new Set();
const setNet = (ok) => { if (ok === NET_OK) return; NET_OK = ok; netListeners.forEach((f) => f(ok)); };
const isNetErr = (msg) => /failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout|quá hạn chờ|err_internet|err_network|\b50[234]\b/i.test(msg || "");
const useNet = () => {
  const [ok, setOk] = useState(NET_OK);
  useEffect(() => { const f = (v) => setOk(v); netListeners.add(f); return () => { netListeners.delete(f); }; }, []);
  return ok;
};
if (typeof window !== "undefined") window.addEventListener("offline", () => setNet(false));
const ck = (k, shared) => `${shared ? "s" : "p"}|${k}`;
// cờ bật/tắt: dữ liệu cũ lưu chuỗi "1", dữ liệu mới lưu số 1 — chấp nhận cả hai
const isOn = (v) => v === 1 || v === true || v === "1";

/* Hàng đợi: mọi lệnh storage xếp hàng chạy lần lượt, cách nhau một nhịp ngắn.
   Gọi song song (Promise.all, chunked) làm cầu nối giữa app và trình duyệt ghép nhầm
   phản hồi của lệnh này cho lệnh kia — đó là lỗi "Unexpected response type".
   Nối đuôi thì chậm hơn chút nhưng phản hồi luôn khớp với lệnh đã gửi. */
let queue = Promise.resolve();
const enqueue = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.then(() => delay(60), () => delay(60));
  return run;
};

const isTimeout = (msg) => /timeout|quá hạn chờ/i.test(msg || "");
/* Cùng một thông điệp lỗi mang ý nghĩa khác nhau tuỳ lệnh:
   - với GET, "unexpected response type" nghĩa là khoá chưa tồn tại -> thử lại vô nghĩa
   - với SET/DELETE/LIST thì không thể là "khoá chưa có", nên đó là lỗi tạm thời -> phải thử lại
   Bản trước gộp chung một quy tắc nên mọi lệnh ghi hỏng đều không được thử lại lần nào. */
const isRetryable = (msg, kind) => {
  if (isRateLimit(msg)) return false;
  if (kind === "get" && isMissingKey(msg)) return false;
  return true;
};

const CALL_TIMEOUT = 8000;
/* Lệnh storage có thể treo vô hạn khi cầu nối hỏng. Không đặt hạn chờ thì app đứng
   mãi ở màn hình "Đang tải dữ liệu…" và trình xem báo tải quá lâu. */
const withTimeout = (promise, ms = CALL_TIMEOUT) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("Storage timeout: quá hạn chờ")), ms);
  promise.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
});

/* Một lần gọi storage: xếp hàng, có hạn chờ, thử lại khi lỗi có vẻ tạm thời.
   Lệnh ghi được thử nhiều lần hơn vì mất một lần ghi là mất dữ liệu người dùng vừa nhập. */
const call = async (fn, kind = "get", ms = CALL_TIMEOUT) => {
  const tries = kind === "get" ? 2 : 4;
  const waits = [300, 800, 1600];
  for (let i = 0; i < tries; i++) {
    try {
      const value = await enqueue(() => withTimeout(Promise.resolve().then(fn), ms));
      setNet(true);
      return { ok: true, value };
    } catch (e) {
      markError(e);
      if (i < tries - 1 && isRetryable(errText(e), kind)) { await delay(waits[i]); continue; }
      if (isNetErr(errText(e))) setNet(false);
      return { ok: false, error: e };
    }
  }
};

const useStorageHealth = () => {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    storageListeners.add(f);
    return () => { storageListeners.delete(f); };
  }, []);
  return { limited: RATE_LIMITED, calls: CALL_COUNT, lastError: LAST_STORAGE_ERROR };
};

const sget = async (k, shared = true, fresh = false) => {
  const key = ck(k, shared);
  if (!fresh && memCache.has(key)) return memCache.get(key);
  if (!STORAGE_OK || RATE_LIMITED) return null;
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.get(k, shared), "get");
  if (!r.ok) {
    // khoá chưa tồn tại là bình thường: nhớ vào đệm để khỏi hỏi lại, và KHÔNG coi là hỏng
    if (isMissingKey(errText(r.error))) { memCache.set(key, null); LAST_STORAGE_ERROR = ""; }
    return null;
  }
  const v = r.value ? JSON.parse(r.value.value) : null;
  memCache.set(key, v);
  return v;
};

const sset = async (k, v, shared = true) => {
  if (!STORAGE_OK) { LAST_STORAGE_ERROR = "window.storage không tồn tại"; return false; }
  if (RATE_LIMITED) { LAST_STORAGE_ERROR = "Đã chạm hạn mức lệnh của phiên"; return false; }
  const payload = JSON.stringify(v);
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.set(k, payload, shared), "set");
  if (!r.ok) return false;
  if (!r.value) { LAST_STORAGE_ERROR = "storage.set trả về giá trị rỗng"; return false; }
  memCache.set(ck(k, shared), v);  // ghi xong cập nhật đệm, các lần đọc sau không tốn lệnh
  return true;
};

const sdel = async (k, shared = true) => {
  if (!STORAGE_OK || RATE_LIMITED) return false;
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.delete(k, shared), "delete");
  if (!r.ok) return false;
  memCache.set(ck(k, shared), null);
  return true;
};

const slist = async (prefix, shared = true) => {
  if (!STORAGE_OK || RATE_LIMITED) return [];
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.list(prefix, shared), "list");
  return r.ok && r.value ? r.value.keys : [];
};
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const f = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
};

/* ---------- catalog mặc định ---------- */
const DEFAULT_TASKS = [
  { id: "t17", name: "Họp & trình bày khách hàng", group: "Chung", depts: [] },
  { id: "t18", name: "Nghiệm thu / bàn giao", group: "Chung", depts: [] },
  { id: "t19", name: "Chỉnh sửa theo yêu cầu (revision)", group: "Chung", depts: [] },
];
const DEFAULT_DEPTS = ["Thiết kế", "Thi công", "Xưởng", "BOQ", "HR / Back office", "Ban giám đốc"];
/* DEPTS là bản sống: App chép cfg.depts vào đây ở mỗi lần render (syncDepts).
   "Ban giám đốc" (DEPTS_SEE_ALL) luôn có mặt và cố định vì quyết định quyền xem toàn bộ tác vụ. */
const DEPTS = [...DEFAULT_DEPTS];
const syncDepts = (list) => {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_DEPTS;
  DEPTS.splice(0, DEPTS.length, ...src);
};
// Bộ phận thấy được toàn bộ hạng mục, không giới hạn theo chuyên môn
const DEPTS_SEE_ALL = ["Ban giám đốc"];

/* Vai trò — cấp nhỏ hơn bộ phận. Trong bộ phận Thiết kế, mỗi người làm một mảng chuyên môn
   nên danh sách tác vụ phải theo vai trò, không thể dùng chung một danh sách cho cả phòng. */
const DEFAULT_ROLES = [
  { id: "ARC", name: "Kiến trúc", dept: "Thiết kế" },
  { id: "ID", name: "Nội thất", dept: "Thiết kế" },
  { id: "3D", name: "Diễn hoạ 3D", dept: "Thiết kế" },
  { id: "2D", name: "Triển khai bản vẽ", dept: "Thiết kế" },
  { id: "TL", name: "Team Leader", dept: "Thiết kế" },
];
/* ROLES là bản sống: App chép cfg.roles vào đây ở mỗi lần render (syncRoles) để các hàm tra cứu
   toàn cục như roleInfo / roleLabel và mọi ô chọn vai trò luôn thấy đúng danh sách quản lý đã sửa. */
const ROLES = DEFAULT_ROLES.map((r) => ({ ...r }));
const syncRoles = (list) => {
  const src = Array.isArray(list) ? list : DEFAULT_ROLES;
  ROLES.splice(0, ROLES.length, ...src);
};
const roleInfo = (id) => ROLES.find((r) => r.id === id) || null;
const roleLabel = (id) => { const r = roleInfo(id); return r ? `${r.id} · ${r.name}` : ""; };
// Tên vai trò hiển thị cho nhân sự (VD "Team Leader"), không kèm mã
const roleTitle = (id) => roleInfo(id)?.name || "";

/* Hạng mục cũ chưa khai bộ phận thì suy từ nhóm, để dữ liệu có sẵn vẫn dùng được ngay.
   depts rỗng nghĩa là hạng mục dùng chung — mọi bộ phận đều chọn được. */
const GROUP_DEPTS = { "Thiết kế": ["Thiết kế"], "Xưởng": ["Xưởng"], "Thi công": ["Thi công"], "BOQ": ["BOQ"] };
const taskDepts = (t) => {
  if (Array.isArray(t.depts)) return t.depts;
  return GROUP_DEPTS[t.group] || [];
};
const taskRoles = (t) => (Array.isArray(t.roles) ? t.roles : []);
/* Từ v1.5 không còn tác vụ cấp bộ phận: tác vụ hoặc gắn vai trò, hoặc dùng chung. */
const isDeptTask = (t) => taskRoles(t).length === 0 && taskDepts(t).length > 0;
/* Thứ tự xét: tác vụ gắn vai trò thì chỉ đúng vai trò đó thấy; không gắn vai trò là tác vụ dùng chung, ai cũng thấy. */
const taskVisibleTo = (t, dept, role) => {
  if (!dept || DEPTS_SEE_ALL.includes(dept)) return true;
  const rs = taskRoles(t);
  if (rs.length) return !!role && rs.includes(role);
  return true;
};
const tasksForDept = (tasks = [], dept, role) => tasks.filter((t) => taskVisibleTo(t, dept, role));
// nhãn hiển thị: có mã thì đưa mã lên trước cho dễ đối chiếu với bảng vai trò
const taskText = (t) => (t?.code ? `${t.code} · ${t.name}` : t?.name || "");
/* v3.2 — hạng mục tăng ca: tên bắt đầu bằng "[OT]" thì tách riêng nhóm "Tăng ca" ở màn chấm công,
   hiển thị bỏ chữ [OT] (VD "[OT] 17:30 - 21:00" → "17:30 – 21:00"). Không cần sửa dữ liệu. */
const isOtTask = (t) => /^\s*\[\s*ot\s*\]/i.test(t?.name || "");
// v3.4: bản sống các id hạng mục Tăng ca — App chép từ cfg.tasks mỗi lần render (như ROLES), để mọi hàm tính giờ tra được
const OT_IDS = new Set();
/* v6.3 — Tăng ca là CÀI ĐẶT CHUNG (Thiết lập → Tăng ca): cfg.otBands = [{ id, from: "17:30", to: "21:00", rate }].
   Mỗi khung giờ thành một "hạng mục ảo" (như LEAVE_TASKS) tên "[OT] 17:30 - 21:00", nên mọi hàm cũ (isOtTask, otSpan,
   otBandKey…) chạy như trước. Dòng tăng ca lưu taskId = mã khung (OTB_…), mã cố định kể cả khi đổi giờ của khung.
   cfg.otLegacy = { <mã hạng mục [OT] cũ>: <mã khung> }: dòng chấm trước v6.3 giữ nguyên mã cũ trong dữ liệu
   (database khoá ngày đã gửi theo mã), app đọc mã cũ như khung tương ứng. */
const OT_TASKS = [];
const otBandName = (b) => `[OT] ${b.from} - ${b.to}`;
const syncOtBands = (c) => {
  const bands = Array.isArray(c?.otBands) ? c.otBands : [];
  const byId = new Map(bands.map((b) => [b.id, b]));
  const list = bands.map((b) => ({ id: b.id, name: otBandName(b), roles: [], depts: [], group: "Tăng ca", band: true }));
  const legacy = Object.entries(c?.otLegacy || {}).filter(([, bid]) => byId.has(bid))
    .map(([old, bid]) => ({ id: old, name: otBandName(byId.get(bid)), roles: [], depts: [], group: "Tăng ca", legacy: true, bandId: bid }));
  OT_TASKS.splice(0, OT_TASKS.length, ...list, ...legacy);
  OT_IDS.clear();
  for (const t of OT_TASKS) OT_IDS.add(t.id);
  for (const t of Array.isArray(c?.tasks) ? c.tasks : []) if (isOtTask(t)) OT_IDS.add(t.id);   // cấu hình chưa chuyển đổi
};
// các khung giờ chọn được (không gồm mã cũ)
const otBandTasks = () => OT_TASKS.filter((t) => t.band);
const isOtId = (id) => OT_IDS.has(id);
const otText = (t) => (t?.name || "").replace(/^\s*\[\s*ot\s*\]\s*/i, "").replace(/\s+-\s+/g, " – ");
/* v4.9 — Khung giờ của hạng mục tăng ca, đọc từ tên ("[OT] 17:30 - 21:00" → 17:30 tới 21:00).
   Khung qua nửa đêm (22:00 - 0:00, 0:00 - 8:00) tự cộng 24h. Tên không đúng mẫu thì không giới hạn số giờ. */
const otSpan = (t) => {
  const m = /(\d{1,2})[:h.](\d{2})\s*[-–]\s*(\d{1,2})[:h.](\d{2})/.exec(otText(t));
  if (!m) return null;
  const a = +m[1] * 60 + +m[2]; let b = +m[3] * 60 + +m[4];
  if (b <= a) b += 1440;
  return { start: a, hours: (b - a) / 60 };
};
const otMaxHours = (t) => otSpan(t)?.hours ?? 24;
/* v5.1 — Khoá khung giờ: các hạng mục [OT] của nhiều vai trò cùng giờ (17:30 - 21:00…) là CÙNG một khung. */
const otBandKey = (t) => { const sp = otSpan(t); return sp ? `${sp.start}+${sp.hours}` : otText(t).replace(/\s+/g, "").toLowerCase(); };
// Danh sách khung giờ không trùng, theo thứ tự xuất hiện: [{ key, label, task, ids }]
const otBandList = (tasks = []) => {
  const m = new Map();
  for (const t of tasks) {
    if (!isOtTask(t)) continue;
    const k = otBandKey(t);
    if (!m.has(k)) m.set(k, { key: k, label: otText(t), task: t, ids: [] });
    m.get(k).ids.push(t.id);
  }
  return [...m.values()];
};
/* Hệ số chi phí của khung giờ: cfg.otRates[taskId]; chưa đặt thì khung bắt đầu từ 17:00 tới trước 21:00 = 1.5, còn lại = 2 */
const otDefaultRate = (t) => { const sp = otSpan(t); return sp && sp.start >= 17 * 60 && sp.start < 21 * 60 ? 1.5 : 2; };
const otRateOf = (cfg, t) => {
  const ok = (v) => v != null && v !== "" && Number(v) > 0;
  if (!t) return 2;
  const bd = (cfg?.otBands || []).find((b) => b.id === (t.bandId || t.id));   // v6.3: hệ số lưu ngay trong khung giờ
  if (bd) return ok(bd.rate) ? Number(bd.rate) : otDefaultRate(t);
  const k = otBandKey(t), byKey = cfg?.otRates?.[k];   // v5.1: lưu theo khung giờ
  if (ok(byKey)) return Number(byKey);
  // v4.9 lưu theo mã hạng mục: lấy hệ số của chính hạng mục, không có thì của hạng mục cùng khung giờ (vai trò khác)
  if (ok(cfg?.otRates?.[t.id])) return Number(cfg.otRates[t.id]);
  const twin = (cfg?.tasks || []).find((x) => isOtTask(x) && ok(cfg?.otRates?.[x.id]) && otBandKey(x) === k);
  return twin ? Number(cfg.otRates[twin.id]) : otDefaultRate(t);
};
/* Hệ số của một giờ tăng ca: ngày lễ / Chủ nhật có hệ số riêng (một hệ số cho cả ngày) thì dùng hệ số đó,
   để trống thì tính theo hệ số khung giờ. Ngày lễ rơi vào Chủ nhật: lấy hệ số ngày lễ. kind: "n" | "s" (CN) | "h" (lễ) */
const otDayKind = (d, holidaySet) => (holidaySet?.has(d) ? "h" : parseD(d).getDay() === 0 ? "s" : "n");
const otSpecialRate = (cfg, kind) => {
  const v = kind === "h" ? cfg?.otHolRate : kind === "s" ? cfg?.otSunRate : null;
  return v != null && v !== "" && Number(v) > 0 ? Number(v) : null;
};
const otRateFor = (cfg, t, kind) => otSpecialRate(cfg, kind) ?? otRateOf(cfg, t);
/* v6.3 — mã khung giờ suy từ giờ bắt đầu + số giờ (VD 17:30 – 21:00 → OTB_1050_3.5), để mọi máy chuyển đổi ra cùng một mã */
const otBandIdFor = (from, to) => { const sp = otSpan({ name: `[OT] ${from} - ${to}` }); return sp ? `OTB_${sp.start}_${sp.hours}` : `OTB_${uid("x")}`; };
const DEFAULT_OT_BANDS = () => [["17:30", "21:00", 1.5], ["21:00", "0:00", 2], ["0:00", "8:00", 2]]
  .map(([from, to, rate]) => ({ id: otBandIdFor(from, to), from, to, rate }));
const otHM = (min) => `${Math.floor((min % 1440) / 60)}:${pad(min % 60)}`;
/* Chuyển cấu hình cũ (hạng mục [OT] theo vai trò) sang khung giờ chung. Trả về { cfg, moved } — moved = số hạng mục [OT] đã gỡ.
   Không đụng tới dữ liệu bảng công: mã hạng mục cũ ghi vào otLegacy. */
const migrateOtCfg = (c) => {
  if (Array.isArray(c.otBands)) return { cfg: c, moved: 0 };
  const olds = (c.tasks || []).filter(isOtTask);
  const bands = [], legacy = {};
  for (const t of [...olds].sort((a, b) => ((otSpan(a)?.start ?? 9999) + 1440 - 1020) % 1440 - ((otSpan(b)?.start ?? 9999) + 1440 - 1020) % 1440)) {
    const sp = otSpan(t);
    const from = sp ? otHM(sp.start) : "17:30", to = sp ? otHM(sp.start + sp.hours * 60) : "21:00";
    const id = otBandIdFor(from, to);
    if (!bands.some((b) => b.id === id)) bands.push({ id, from, to, rate: otRateOf(c, t) });
    legacy[t.id] = id;
  }
  const out = { ...c, otBands: bands.length ? bands : DEFAULT_OT_BANDS(), otLegacy: legacy, tasks: (c.tasks || []).filter((t) => !isOtTask(t)) };
  return { cfg: out, moved: olds.length };
};
// Bỏ dấu để gõ "khao sat" vẫn ra "Khảo sát". NFD không tách được đ nên phải thay tay.
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
// bảng màu lặp lại theo thứ tự dự án, dùng cho biểu đồ cột chồng theo dự án
const PROJECT_COLORS = ["#2dd4bf", "#f59e0b", "#a78bfa", "#f472b6", "#60a5fa", "#facc15", "#34d399", "#fb7185", "#38bdf8", "#c084fc"];
/* Giai đoạn dự án — cho biết giờ công đổ vào chặng nào, tách bạch với "hạng mục công việc"
   (hạng mục nói làm việc gì, giai đoạn nói việc đó thuộc chặng nào của dự án) */
/* v1.9 — Giai đoạn do quản lý sửa được ở tab Thiết lập (cfg.phases = [{ id, name, desc, active }]).
   Mã P1, P2… cố định theo thứ tự tạo; màu suy từ số trong mã. Giai đoạn "ngừng dùng" (active = false) không chọn được
   khi chấm công nhưng vẫn hiện trong báo cáo. PHASES là bản sống: App chép cfg.phases vào đây ở mỗi lần render. */
const PHASE_COLORS = ["#f59e0b", "#2dd4bf", "#38bdf8", "#a78bfa", "#f472b6", "#a3e635", "#fb923c", "#22d3ee"];
/* v7.8 — màu dự án / giai đoạn bản đậm cho giao diện Sáng (màu sáng của bản Tối bị nhạt trên nền trắng) */
const TONE_L = { "#2dd4bf": "#0d9488", "#f59e0b": "#d97706", "#a78bfa": "#7c3aed", "#f472b6": "#db2777", "#60a5fa": "#2563eb", "#facc15": "#ca8a04",
  "#34d399": "#059669", "#fb7185": "#e11d48", "#38bdf8": "#0284c7", "#c084fc": "#9333ea", "#a3e635": "#65a30d", "#fb923c": "#ea580c",
  "#22d3ee": "#0891b2", "#4ade80": "#16a34a", "#f87171": "#dc2626" };
const tone = (hex) => (hex && isLight() ? TONE_L[String(hex).toLowerCase()] || hex : hex);
const phaseColor = (id) => PHASE_COLORS[((parseInt(String(id).replace(/\D/g, ""), 10) || 1) - 1) % PHASE_COLORS.length];
const DEFAULT_PHASES = [
  { id: "P1", name: "Đấu thầu", desc: "Khảo sát sơ bộ, nghiên cứu, concept đấu thầu, báo giá, hồ sơ proposal", active: true },
  { id: "P2", name: "Thiết kế", desc: "Concept, phát triển thiết kế, 3D, hồ sơ kỹ thuật, phối hợp thiết kế", active: true },
  { id: "P3", name: "Thi công", desc: "Shopdrawing, RFI, material, xử lý hiện trường, điều chỉnh thiết kế", active: true },
  { id: "P4", name: "Bàn giao", desc: "As-built, snagging, hoàn thiện hồ sơ, nghiệm thu, lưu trữ", active: true },
];
const PHASES = DEFAULT_PHASES.map((x) => ({ ...x, color: phaseColor(x.id) }));
const syncPhases = (list) => {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_PHASES;
  PHASES.splice(0, PHASES.length, ...src.map((x) => ({ ...x, active: x.active !== false, color: phaseColor(x.id) })));
};
const activePhases = () => PHASES.filter((x) => x.active);
const firstActivePhase = () => activePhases()[0]?.id || PHASES[0]?.id || "P2";
const DEFAULT_PHASE = "P2";
/* v1.9 — Giờ dự kiến của dự án chia theo phase: project.budgets = { P1, P2, P3, P4 }. Tổng dự kiến = cộng 4 phase.
   Số tổng kiểu cũ (project.budget, một con số cho cả dự án) không còn được dùng. Phase để trống / 0 = không theo dõi hạn mức. */
const projBudgets = (p) => Object.fromEntries(PHASES.map((ph) => [ph.id, Math.max(0, Number(p?.budgets?.[ph.id]) || 0)]));
const budgetTotal = (p) => PHASES.reduce((a, ph) => a + (Math.max(0, Number(p?.budgets?.[ph.id])) || 0), 0);
/* v3.1 — Quản lý MỞ / ĐÓNG từng giai đoạn của dự án (project.phaseOpen = { P1: true, … }).
   Nhân sự chỉ chấm được giai đoạn đang mở. Dự án chưa từng đặt mở/đóng thì coi giai đoạn có giờ dự kiến > 0 là đang mở
   (đúng như luật v2.5), để dữ liệu cũ không bị đổi. Giờ dự kiến từ v3.1 chỉ dùng để theo dõi. */
const hasPhaseOpenMap = (p) => !!p && !!p.phaseOpen && typeof p.phaseOpen === "object";
const projPhaseIsOpen = (p, phId) => (hasPhaseOpenMap(p) ? !!p.phaseOpen[phId] : Math.max(0, Number(p?.budgets?.[phId]) || 0) > 0);
const cleanBudgets = (d) => Object.fromEntries(PHASES.map((ph) => [ph.id, Math.max(0, Number(d?.[ph.id]) || 0)]));
const fmtH = (n) => String(+Number(n || 0).toFixed(1));
const phaseInfo = (id) => PHASES.find((p) => p.id === id) || null;
const phaseLabel = (id) => { const p = phaseInfo(id); return p ? `${p.id} · ${p.name}` : `${id || ""} (đã xoá)`.trim(); };
// Đoán giai đoạn từ nhóm của hạng mục — dùng khi thêm dòng mới và khi nâng cấp dữ liệu cũ chưa có giai đoạn
const guessPhase = (taskId, tasks = []) => {
  const g = tasks.find((t) => t.id === taskId)?.group || "";
  const ok = (id) => (phaseInfo(id)?.active ? id : null);
  if (/xưởng|thi công/i.test(g)) return ok("P3") || firstActivePhase();
  if (/thiết kế/i.test(g)) return ok("P2") || firstActivePhase();
  return ok(DEFAULT_PHASE) || firstActivePhase();
};
// Khoá định danh một dòng chấm công: cùng dự án nhưng khác giai đoạn thì vẫn là hai dòng riêng
// v4.9: dòng tăng ca còn tách theo "tăng ca cho tác vụ" (otFor) — cùng khung giờ, khác tác vụ là hai dòng riêng
const rowKey = (r) => `${r.projectId}|${r.phaseId || DEFAULT_PHASE}|${r.taskId}${r.otFor ? `|${r.otFor}` : ""}`;
// Khoá nhóm: cùng dự án + giai đoạn thì gộp chung một khối, chỉ hạng mục mới tách dòng bên trong
const groupKey = (r) => `${r.projectId}|${r.phaseId || DEFAULT_PHASE}`;
/* Xếp lại mảng rows cho thứ tự phần tử khớp thứ tự hiển thị. Bắt buộc phải làm, vì ref ô nhập giờ
   và phím mũi tên đều đánh theo chỉ số phẳng — lệch thứ tự là con trỏ nhảy lung tung. */
const sortByGroup = (list = []) => {
  const order = [];
  for (const r of list) { const k = groupKey(r); if (!order.includes(k)) order.push(k); }
  return [...list].sort((a, b) => order.indexOf(groupKey(a)) - order.indexOf(groupKey(b)));
};

const emptyConfig = () => ({
  employees: [], projects: [], tasks: DEFAULT_TASKS, deadlineDay: 5,
  hours: { ...DEFAULT_HOURS }, holidays: [], roles: DEFAULT_ROLES.map((r) => ({ ...r })),
  leaveTypes: DEFAULT_LEAVE_TYPES.map((t) => ({ ...t })),
  depts: [...DEFAULT_DEPTS],
  otBands: DEFAULT_OT_BANDS(), otLegacy: {},
});

/* Vắng mặt giờ là tác vụ chọn được ngay trong ô Tác vụ, không còn panel riêng.
   Chọn "Phép năm" rồi nhập 8 giờ vào ngày đó là xong — giờ vắng tính vào giờ chuẩn của ngày
   nên không bị báo thiếu, nhưng KHÔNG tính vào giờ dự án và không tính OT. */
const DEFAULT_LEAVE_TYPES = [
  { id: "annual", label: "Phép năm", short: "P", cls: "border-sky-800 bg-sky-950 text-sky-300" },
  { id: "sick", label: "Nghỉ ốm", short: "Ố", cls: "border-violet-800 bg-violet-950 text-violet-300" },
  { id: "unpaid", label: "Nghỉ không lương", short: "KL", cls: "border-slate-700 bg-slate-800 text-slate-300" },
  { id: "public", label: "Nghỉ lễ", short: "L", cls: "border-rose-800 bg-rose-950 text-rose-300" },
  { id: "biz", label: "Công tác ngoài", short: "CT", cls: "border-teal-800 bg-teal-950 text-teal-300" },
];
const LEAVE_TASK_PREFIX = "LV_";
/* v7.2 — tác vụ "Chờ việc": gắn cứng trong cfg.tasks (dùng chung, luôn đứng đầu), app tự thêm nếu chưa có.
   Quản lý đổi được tên và mô tả; không xoá, không kéo đổi chỗ, không chuyển sang vai trò khác (mã IDLE_WAIT giữ nguyên).
   Giờ chờ việc tính là giờ công của ngày (không bị báo thiếu) nhưng không thành giờ cố gắng và KHÔNG tính vào tải (khung Phân bổ). */
const IDLE_TASK_ID = "IDLE_WAIT";
const IDLE_TASK = { id: IDLE_TASK_ID, name: "Chờ việc", group: "Chung", depts: [], roles: [], desc: "Không có việc được giao — tính giờ công, không tính tải" };
const isIdleTask = (id) => id === IDLE_TASK_ID;
const withIdleTask = (c) => {
  if (!c) return c;
  const cur = (c.tasks || []).find((t) => t.id === IDLE_TASK_ID);
  // giữ tên / mô tả quản lý đã sửa; luôn là tác vụ dùng chung và đứng đầu
  const idle = cur ? { ...IDLE_TASK, name: cur.name || IDLE_TASK.name, desc: cur.desc } : { ...IDLE_TASK };
  if (!idle.desc) delete idle.desc;
  return { ...c, tasks: [idle, ...(c.tasks || []).filter((t) => t.id !== IDLE_TASK_ID)] };
};
let IDLE_PENDING = false;   // v7.2: cấu hình trên server chưa có tác vụ Chờ việc — quản lý mở app sẽ tự lưu
const NO_PROJECT = "__none__";
const NO_PHASE = "?";   // v3.0: dòng mới, giai đoạn chưa chọn (dự án "" = chưa chọn, hạng mục "" = chưa chọn)
/* LEAVE_TYPES / LEAVE_TASKS là bản sống: App chép cfg.leaveTypes vào đây ở mỗi lần render (syncLeave),
   quản lý thêm / sửa / xoá loại nghỉ ở tab Tác vụ. */
const LEAVE_PALETTE = [
  "border-sky-800 bg-sky-950 text-sky-300", "border-violet-800 bg-violet-950 text-violet-300",
  "border-slate-700 bg-slate-800 text-slate-300", "border-rose-800 bg-rose-950 text-rose-300",
  "border-teal-800 bg-teal-950 text-teal-300", "border-amber-800 bg-amber-950 text-amber-300",
  "border-emerald-800 bg-emerald-950 text-emerald-300", "border-fuchsia-800 bg-fuchsia-950 text-fuchsia-300",
];
const leaveShort = (label) => {
  const w = String(label || "").trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w.slice(0, 2).map((x) => x[0]).join("") : (w[0] || "?").slice(0, 2)).toUpperCase();
};
const LEAVE_TYPES = DEFAULT_LEAVE_TYPES.map((t) => ({ ...t }));
const LEAVE_TASKS = [];
const syncLeave = (list) => {
  const src = Array.isArray(list) ? list : DEFAULT_LEAVE_TYPES;
  LEAVE_TYPES.splice(0, LEAVE_TYPES.length, ...src);
  LEAVE_TASKS.splice(0, LEAVE_TASKS.length, ...src.map((t) => ({ id: `${LEAVE_TASK_PREFIX}${t.id}`, name: t.label, group: "Vắng mặt", depts: [], roles: [] })));
};
syncLeave(null);
const isLeaveTask = (id) => typeof id === "string" && id.startsWith(LEAVE_TASK_PREFIX);
const leaveTypeOfTask = (id) => (isLeaveTask(id) ? id.slice(LEAVE_TASK_PREFIX.length) : null);
const leaveInfo = (id) => LEAVE_TYPES.find((x) => x.id === id) || null;
const leaveInfoOfTask = (taskId) => leaveInfo(leaveTypeOfTask(taskId));

/* ============================================================
   DESIGN TOKENS — mọi control dùng chung, chiều cao 44px (h-11)
   ============================================================ */
const CTRL = "h-11";
const inputCls = `${CTRL} w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none`;
const selectCls = inputCls;
const btnBase = `${CTRL} inline-flex items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium`;
const btnPrimary = `${btnBase} bg-teal-600 text-white hover:bg-teal-500`;
const btnGhost = `${btnBase} border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-50`;
const btnDanger = `${btnBase} border border-rose-900 bg-rose-950 text-rose-300 hover:bg-rose-900`;
const iconBtn = "flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100";
const GUT = 36; // bằng đúng bề rộng iconBtn — giữ ô Dự án và ô Hạng mục thẳng hàng nhau

const Panel = ({ title, sub, right, flush = false, children }) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900">
    {title && (
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-slate-200">{title}</h3>
          {sub && <div className="mt-0.5 text-[11.5px] text-slate-500">{sub}</div>}
        </div>
        {right}
      </div>
    )}
    {/* v5.6: flush = phần thân không đệm, để thanh công cụ / KPI chạy sát mép khung */}
    <div className={flush ? "" : "p-3 md:p-4"}>{children}</div>
  </section>
);
const Kpi = ({ label, value, unit }) => (
  <div className="h-full rounded-xl border border-slate-800 bg-slate-900 p-3 md:p-4">
    {/* tracking hẹp lại ở màn rộng: 6 ô cùng hàng nên nhãn dài dễ tràn */}
    <div className="text-[10px] uppercase tracking-wider text-slate-500 md:text-[11px]">{label}</div>
    <div className="mt-1.5 truncate font-mono text-2xl font-semibold text-slate-50 md:text-[26px]">
      {value}{unit && <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>}
    </div>
  </div>
);

/* Hộp thoại xác nhận — dùng cho mọi thao tác xoá không hoàn tác được.
   Không dùng window.confirm vì trình duyệt có thể chặn trong iframe và giao diện không đồng bộ theme. */
function ConfirmDialog({ open, title, desc, confirmLabel = "Xoá", cancelLabel = "Giữ lại", tone = "danger", onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-50">{title}</h4>
            {desc && <p className="mt-1 text-sm text-slate-400">{desc}</p>}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className={btnGhost}>{cancelLabel}</button>
          {tone === "danger"
            ? <button onClick={onConfirm} className={btnDanger}><Trash2 size={14} /> {confirmLabel}</button>
            : <button onClick={onConfirm} className={btnPrimary}><CheckCircle2 size={14} /> {confirmLabel}</button>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DATE PICKER (dark, tự vẽ — không dùng picker mặc định của trình duyệt)
   ============================================================ */
function CalendarPanel({ value, onSelect, dayStatus, view: viewProp, onViewChange, markSelected = true, markWeek = false, rangeStart = null, rangeEnd = null, hint = null }) {
  const base = value ? parseD(value) : new Date();
  const [internalView, setInternalView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const view = viewProp || internalView;               // cho phép cha (WeekPicker) điều khiển tháng đang xem
  const setView = onViewChange || setInternalView;      // để tải đúng dữ liệu giờ công của tháng đang hiển thị
  const gridStart = mondayOf(new Date(view.y, view.m, 1));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayStr = fmt(new Date());
  const step = (n) => setView((v) => {
    const d = new Date(v.y, v.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div className="w-72 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-100">Tháng {view.m + 1}, {view.y}</span>
        <div className="flex gap-1">
          <button onClick={() => step(-1)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><ChevronUp size={16} /></button>
          <button onClick={() => step(1)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><ChevronDown size={16} /></button>
        </div>
      </div>

      {hint && <div className="mb-2 rounded-md bg-slate-950 px-2 py-1.5 text-[11px] text-slate-400">{hint}</div>}

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW_MINI.map((d) => <div key={d} className="py-1 text-[11px] font-medium text-slate-500">{d}</div>)}
      </div>

      {/* mỗi tuần một hàng riêng — tuần đang chấm công (Thứ 2 = value) được khoanh khung bo góc, viền mờ */}
      <div className="space-y-1">
        {Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7)).map((week, w) => {
          const isActiveWeek = markWeek && fmt(week[0]) === value; // chỉ khoanh cả tuần khi đang chọn theo tuần
          return (
            <div key={w}
              className={`grid grid-cols-7 gap-1 rounded-lg p-0.5 ${isActiveWeek ? "border border-teal-700/50 bg-teal-500/5" : "border border-transparent"}`}>
              {week.map((d) => {
                const s = fmt(d);
                const inMonth = d.getMonth() === view.m;
                const selected = s === value;
                const isToday = s === todayStr;
                const status = dayStatus ? dayStatus(s) : null; // "under" | "over" | "effort" | "otHigh" | "holiday" | "leave" | null
                const isSelected = markSelected && selected;
                const isEdge = (rangeStart && s === rangeStart) || (rangeEnd && s === rangeEnd);
                const inRange = rangeStart && rangeEnd && s > rangeStart && s < rangeEnd;
                // màu chữ nói lên loại ngày, viền nói lên "hôm nay" / "ngày đang chọn" — hai tầng thông tin tách bạch
                const tone =
                  status === "holiday" ? "text-slate-100"
                    : status === "leave" ? "bg-sky-950/40 text-sky-300"
                    : status === "under" ? "text-amber-400"
                    : status === "otHigh" ? "bg-red-950/50 font-semibold text-red-300"
                    : status === "over" ? "text-teal-400"
                    : status === "effort" ? "text-violet-400"
                    : inMonth ? "text-slate-200" : "text-slate-700";
                const ring =
                  isEdge ? "border-2 border-teal-400 bg-teal-500/15 font-semibold text-teal-100"
                    : inRange ? "border border-transparent bg-teal-500/10 text-teal-100"
                    : isSelected ? "border-2 border-teal-400 font-semibold"
                    // hôm nay: khối phát sáng mờ, cùng tông với khung tuần bên Chấm công
                    : isToday ? (status ? "border border-teal-500 font-semibold" : "border border-teal-700/60 bg-teal-500/10 font-semibold text-teal-200")
                    : "border border-transparent";
                return (
                  <button key={s} onClick={() => onSelect(s)}
                    style={status === "holiday" ? holidayRingBg(30) : undefined}
                    title={isToday ? "Hôm nay" : status === "under" ? "Chưa đủ giờ" : status === "otHigh" ? `OT trên ${OT_ALERT} giờ` : status === "over" ? "Có giờ tăng ca" : status === "effort" ? "Có giờ cố gắng (vượt giờ chuẩn)" : status === "holiday" ? "Ngày lễ" : status === "leave" ? "Nghỉ phép" : undefined}
                    className={`flex h-8 items-center justify-center rounded text-xs hover:bg-slate-800 ${tone} ${ring}`}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between border-t border-slate-800 pt-2">
        <button onClick={() => { const t = new Date(); setView({ y: t.getFullYear(), m: t.getMonth() }); onSelect(fmt(t)); }}
          className="text-xs text-teal-400 hover:text-teal-300">Hôm nay</button>
        <span className="font-mono text-xs text-slate-600">{value ? dFull(value) : "—"}</span>
      </div>
    </div>
  );
}

/* Bộ chọn KHOẢNG ngày — một lịch duy nhất: bấm lần đầu đặt ngày bắt đầu, lần thứ hai đặt ngày kết thúc.
   Bấm ngược thứ tự (ngày sau trước, ngày trước sau) vẫn ra khoảng đúng, không bắt người dùng nhớ thứ tự. */
function DateRangeField({ label, from, to, onChange, align = "left", className = "" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // ngày đầu vừa bấm, đang chờ ngày thứ hai
  const ref = useRef(null);
  const [view, setView] = useState(() => { const d = parseD(from); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPending(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const pick = (s) => {
    if (!pending) { setPending(s); return; }
    const a = s < pending ? s : pending;
    const b = s < pending ? pending : s;
    onChange(a, b);
    setPending(null); setOpen(false);
  };

  const nDays = Math.round((parseD(to) - parseD(from)) / 86400000) + 1;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-500">{label}</label>}
      <button onClick={() => {
          setPending(null);
          setOpen((o) => { if (!o) { const d = parseD(from); setView({ y: d.getFullYear(), m: d.getMonth() }); } return !o; });
        }}
        className={`${CTRL} flex w-full items-center justify-between gap-2 rounded-md border bg-slate-900 px-3 text-sm hover:border-slate-500 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="truncate font-mono text-slate-100">{dFull(from)} – {dFull(to)}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-slate-500">{nDays} ngày</span>
          <CalendarDays size={15} className="text-slate-500" />
        </span>
      </button>

      {open && (
        <div className={`absolute top-full z-50 mt-1 ${align === "right" ? "right-0" : "left-0"}`}>
          <CalendarPanel
            value={pending || from}
            onSelect={pick}
            view={view}
            onViewChange={setView}
            markSelected={false}
            rangeStart={pending || from}
            rangeEnd={pending ? null : to}
            hint={pending
              ? <>Bắt đầu <span className="font-mono text-teal-300">{dFull(pending)}</span> — giờ bấm ngày kết thúc</>
              : "Bấm ngày bắt đầu, rồi bấm ngày kết thúc"}
          />
        </div>
      )}
    </div>
  );
}

function DateField({ label, value, onChange, align = "left", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-500">{label}</label>}
      <button onClick={() => setOpen((o) => !o)}
        className={`${CTRL} flex w-full items-center justify-between gap-2 rounded-md border bg-slate-900 px-3 text-sm hover:border-slate-500 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="font-mono text-slate-100">{dFull(value)}</span>
        <CalendarDays size={15} className="shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className={`absolute top-full z-50 mt-1 ${align === "right" ? "right-0" : "left-0"}`}>
          <CalendarPanel value={value} onSelect={(s) => { onChange(s); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/* Bộ chọn TUẦN dùng cho nhân sự — cùng một CalendarPanel dark như DateField bên Quản lý,
   nhưng chọn 1 ngày bất kỳ sẽ nhảy tới tuần (thứ 2) chứa ngày đó.
   Ngoài ra tô viền cảnh báo ngay trên ô ngày: cam = thiếu giờ (<8h, ngày đã qua), xanh lá = thừa giờ (>8h). */
function WeekPicker({ monday, onChange, empId, hoursCfg = DEFAULT_HOURS, holidaySet = null, refreshKey = 0 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const baseMonth = parseD(monday);
  const [calView, setCalView] = useState({ y: baseMonth.getFullYear(), m: baseMonth.getMonth() });
  const [monthData, setMonthData] = useState({}); // ym -> { dateStr: tổng giờ }
  const [monthLeave, setMonthLeave] = useState({}); // ym -> { dateStr: loại nghỉ }
  const [monthParts, setMonthParts] = useState({}); // v3.4: ym -> { dateStr: { ot, reg } } — giờ Tăng ca và giờ làm việc thường
  const todayStr = fmt(new Date());

  // Sau mỗi lần lưu bảng công, bỏ bộ nhớ đệm để lịch hiển thị số giờ mới nhất
  useEffect(() => { setMonthData({}); setMonthLeave({}); }, [refreshKey, empId]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Chỉ tải tháng nào chưa có trong bộ nhớ đệm — mở lại lịch hay lật qua lật lại không gọi storage nữa,
  // giữ cho quota request dành cho việc lưu bảng công.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const yms = [-1, 0, 1].map((off) => {
        const d = new Date(calView.y, calView.m + off, 1);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      }).filter((ym) => !(ym in monthData));
      if (yms.length === 0) return;
      await ensureMonths(yms);
      const entries = [];
      for (const ym of yms) entries.push([ym, dbTs(empId, ym)]);   // đọc từ bộ nhớ, không tốn lệnh
      if (!alive) return;
      setMonthData((prev) => {
        const next = { ...prev };
        for (const [ym, bucket] of entries) {
          const perDay = {};
          if (bucket?.rows) for (const r of bucket.rows) for (const [d, hh] of Object.entries(r.days || {})) {
            if (!hh) continue;
            perDay[d] = (perDay[d] || 0) + hh;
          }
          next[ym] = perDay; // ghi đè theo tháng, tránh cộng dồn trùng khi mở lại
        }
        return next;
      });
      setMonthParts((prev) => {
        const next = { ...prev };
        for (const [ym, bucket] of entries) {
          const parts = {};
          for (const r of bucket?.rows || []) for (const [d, hh] of Object.entries(r.days || {})) {
            if (!hh || leaveTypeOfTask(r.taskId)) continue;
            const c = parts[d] || (parts[d] = { ot: 0, reg: 0, idle: 0 });
            if (isOtId(r.taskId)) c.ot += hh; else { c.reg += hh; if (isIdleTask(r.taskId)) c.idle += hh; }
          }
          next[ym] = parts;
        }
        return next;
      });
      setMonthLeave((prev) => {
        const next = { ...prev };
        for (const [ym, bucket] of entries) {
          const lv = {};
          for (const r of bucket?.rows || []) {
            const lt = leaveTypeOfTask(r.taskId);
            if (!lt) continue;
            for (const [d, hh] of Object.entries(r.days || {})) if (hh > 0) lv[d] = lt;
          }
          next[ym] = lv;
        }
        return next;
      });
    })();
    return () => { alive = false; };
  }, [open, calView.y, calView.m, empId]);

  const dayStatus = (dateStr) => {
    const h = monthData[ymOf(dateStr)]?.[dateStr] || 0;
    if (holidaySet?.has(dateStr)) return "holiday";
    const lv = monthLeave[ymOf(dateStr)]?.[dateStr];
    if (lv && h === 0) return "leave";
    const pt = monthParts[ymOf(dateStr)]?.[dateStr];
    const ot = pt?.ot || 0;
    const ef = effortHoursFor(dateStr, (pt?.reg || 0) - (pt?.idle || 0), hoursCfg, holidaySet);   // v7.2: chờ việc không thành giờ cố gắng
    if (ot > OT_ALERT) return "otHigh";   // OT quá dày trong một ngày — cảnh báo đỏ
    // v4.0: thiếu giờ tính theo giờ chuẩn (tổng − OT − cố gắng), ưu tiên hơn dấu tăng ca
    const min = minHoursFor(dateStr, hoursCfg, holidaySet);
    if (min !== null && dateStr <= todayStr && h - ot - ef < min) return "under";
    if (ot > 0) return "over";
    if (ef > 0) return "effort";   // v3.4: giờ cố gắng, không phải OT
    return null;
  };

  const days = weekDays(monday);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className={`${CTRL} flex items-center justify-center gap-1.5 rounded-md border bg-slate-900 px-2 text-sm hover:border-slate-500 md:gap-2 md:px-3 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="whitespace-nowrap font-mono text-slate-50">{dLabel(days[0])} – {dLabel(days[6])}</span>
        <CalendarDays size={15} className="shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2">
          <CalendarPanel value={monday} onSelect={(s) => { onChange(fmt(mondayOf(parseD(s)))); setOpen(false); }}
            dayStatus={dayStatus} view={calView} onViewChange={setCalView} markSelected={false} markWeek />
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/* v2.2 — Màn hình hỏng (lỗi khi vẽ giao diện) thì hiện thông báo + nút tải lại thay vì trang trắng. */
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md space-y-3 rounded-xl border border-rose-900 bg-rose-950 p-5 text-sm">
          <div className="flex items-center gap-2 text-base font-semibold"><AlertTriangle size={18} className="text-rose-400" /> App gặp lỗi khi hiển thị</div>
          <p className="text-rose-100">Bấm tải lại để tiếp tục; giờ đã gửi trước đó không bị mất. Nếu lặp lại, chụp màn hình này gửi quản lý.</p>
          <p className="break-words font-mono text-xs text-rose-300">{errText(this.state.err)}</p>
          <button onClick={() => window.location.reload()} className={btnDanger}><RotateCcw size={14} /> Tải lại trang</button>
        </div>
      </div>
    );
  }
}
export default function App() {
  useTheme();   // v7.8: vẽ lại toàn app khi đổi Sáng / Tối (các màu ghi thẳng trong code đọc isLight())
  return <AppErrorBoundary><AppMain /></AppErrorBoundary>;
}
function AppMain() {
  const [cfg, setCfg] = useState(null);
  const [booting, setBooting] = useState(true);
  const [who, setWho] = useState(null);                  // tài khoản đang đăng nhập: { userId, username, empId, admin }
  const [loadFailed, setLoadFailed] = useState(false);   // đăng nhập được nhưng không tải được dữ liệu
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("dash");
  const [sheetDirty, setSheetDirty] = useState(false);   // bảng công còn thay đổi chưa lưu
  const [pendingTab, setPendingTab] = useState(null);    // tab muốn sang, đang chờ xác nhận
  const [tsMonday, setTsMonday] = useState(null);        // v7.0: bấm ngày trên Lịch tháng → mở Chấm công đúng tuần đó
  // Rời khỏi màn chấm công khi còn thay đổi chưa lưu thì hỏi lại — trước đây mất dữ liệu lặng lẽ
  const go = (k) => {
    if (k === tab) return;
    if (sheetDirty && (tab === "ts" || tab === "sheet")) { setPendingTab(k); return; }
    setTsMonday(null); setTab(k);
  };

  const flash = useCallback((msg, kind = "ok") => {
    setToast({ msg, kind }); setTimeout(() => setToast(null), 2600);
  }, []);

  /* Tải toàn bộ dữ liệu. Chỉ gọi SAU khi đã đăng nhập: database từ chối người chưa có tài khoản. */
  const openData = useCallback(async () => {
    try {
      const db = await loadDB(true);          // 1 lệnh duy nhất cho toàn bộ dữ liệu
      let c = db.config || emptyConfig();
      c.tasks = c.tasks?.length ? c.tasks : DEFAULT_TASKS;
      c.tasks = c.tasks.filter((t) => !isDeptTask(t));   // v1.5: bỏ tác vụ cấp bộ phận có sẵn
      c.deadlineDay = c.deadlineDay || 5;
      delete c.adminPin;                                    // v2.3: PIN v1.6 không còn dùng, không giữ trong thiết lập dùng chung
      c.hours = { ...DEFAULT_HOURS, ...(c.hours || {}) };  // dữ liệu cũ chưa có mục này thì lấy mặc định
      c.holidays = Array.isArray(c.holidays) ? c.holidays : [];
      // dữ liệu v1.4 trở về trước chưa có danh sách vai trò thì lấy 5 vai trò mặc định
      c.roles = Array.isArray(c.roles) ? c.roles : DEFAULT_ROLES.map((r) => ({ ...r }));
      c.leaveTypes = Array.isArray(c.leaveTypes) && c.leaveTypes.length ? c.leaveTypes : DEFAULT_LEAVE_TYPES.map((t) => ({ ...t }));
      c.depts = Array.isArray(c.depts) && c.depts.length ? c.depts : [...DEFAULT_DEPTS];
      if (!c.depts.includes("Ban giám đốc")) c.depts = [...c.depts, "Ban giám đốc"];
      syncDepts(c.depts);
      const needOtMig = !Array.isArray(c.otBands);   // v6.3: cấu hình cũ → khung tăng ca chung (quản lý mở app sẽ tự lưu)
      const mig = migrateOtCfg(c); c = mig.cfg; OT_PENDING = needOtMig ? mig.moved : -1;
      syncRoles(c.roles); syncOtBands(c);
      syncLeave(c.leaveTypes);
      c.phases = Array.isArray(c.phases) && c.phases.length ? c.phases : DEFAULT_PHASES.map((x) => ({ ...x }));
      syncPhases(c.phases);
      IDLE_PENDING = !c.tasks.some((t) => t.id === IDLE_TASK_ID);
      c = withIdleTask(c);
      setCfg(c); setLoadFailed(false);
      return true;
    } catch {
      // Không vào app với cấu hình rỗng: bấm Lưu lúc đó sẽ đè lên dữ liệu thật
      setCfg(null); setLoadFailed(true);
      return false;
    }
  }, []);

  /* Vào app sau khi có danh tính: tải dữ liệu rồi mở đúng màn hình theo quyền */
  const enter = useCallback(async (w) => {
    setBooting(true);
    setWho(w); setTab(w.access === "admin" || w.access === "bod" ? "dash" : "ts");
    await openData();
    setBooting(false);
  }, [openData]);

  /* v2.6 — Thông báo nhắc nộp bảng công. Đã cho phép thì lưu trình duyệt này lên server (mỗi lần mở app).
     Người đang đăng nhập sẵn từ trước (không bấm Đăng nhập lại) thì trình duyệt hỏi ở cú bấm đầu tiên trong app. */
  useEffect(() => {
    if (!who) return;
    syncPush();
    if (pushPermission() !== "default") return;
    const once = () => { askPermission(); window.removeEventListener("pointerdown", once, true); window.removeEventListener("keydown", once, true); };
    window.addEventListener("pointerdown", once, true);
    window.addEventListener("keydown", once, true);
    return () => { window.removeEventListener("pointerdown", once, true); window.removeEventListener("keydown", once, true); };
  }, [who?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      // Khởi động phải luôn kết thúc, kể cả khi lưu trữ hỏng — nếu không app đứng mãi ở màn hình chờ
      let w = null;
      try { w = await currentUser(); } catch { /* coi như chưa đăng nhập */ }
      if (w) await enter(w); else setBooting(false);
    })();
  }, [enter]);

  /* v1.9 — Tự cập nhật bảng công khi tab đang hiện: quản lý 10 giây một lần để thấy ngay giờ mọi người vừa gửi;
     nhân sự 60 giây một lần và khi quay lại tab, để thấy tuần vừa được quản lý mở khoá. */
  /* v2.2 — quản lý 30 giây/lần (trước 10 giây), nhân sự 60 giây/lần. Máy để yên quá 10 phút thì ngừng hỏi,
     chạm chuột / gõ phím lại là hỏi ngay. Mất mạng thì 10 giây thử lại một lần để biết khi nào có mạng lại. */
  useEffect(() => {
    if (!who || !cfg) return;
    let last = Date.now();
    const IDLE = 10 * 60 * 1000;
    const visible = () => document.visibilityState === "visible";
    const tick = () => { if (visible() && Date.now() - last < IDLE) pullTs(); };
    const wake = () => { const idle = Date.now() - last >= IDLE; last = Date.now(); if (idle && visible()) pullTs(); };
    const now = () => { last = Date.now(); if (visible()) pullTs(); };
    const id = setInterval(tick, who.access !== "emp" ? 30000 : 60000);   // v7.3: Admin / BOD / Trưởng phòng 30 giây
    const probe = setInterval(() => { if (!NET_OK && visible()) pullTs(); }, 10000);
    document.addEventListener("visibilitychange", now);
    window.addEventListener("focus", now);
    window.addEventListener("online", now);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearInterval(id); clearInterval(probe);
      document.removeEventListener("visibilitychange", now); window.removeEventListener("focus", now); window.removeEventListener("online", now);
      window.removeEventListener("pointerdown", wake); window.removeEventListener("keydown", wake);
    };
  }, [who?.userId, who?.access, !!cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCfg = useCallback(async (next) => {
    next = withIdleTask(next);   // v7.2: Chờ việc luôn có mặt và đứng đầu
    setCfg(next);
    const merged = await commitConfig(next);
    if (!merged) {
      // báo lỗi SAU các thông báo "Đã lưu…" mà nơi gọi có thể hiện ngay sau lệnh này, để lỗi không bị che
      setTimeout(() => flash(`Không lưu được thiết lập — ${LAST_STORAGE_ERROR || "thử lại"}`, "err"), 50);
      return false;
    }
    setCfg(withIdleTask(merged));   // bản đã gộp: có thể kèm phần quản lý khác vừa sửa
    return true;
  }, [flash]);

  /* v6.3 — quản lý mở bản mới lần đầu: lưu cấu hình đã chuyển sang khung tăng ca chung */
  useEffect(() => {
    if (!cfg || !who?.admin || (OT_PENDING < 0 && !IDLE_PENDING)) return;
    const n = OT_PENDING; OT_PENDING = -1; IDLE_PENDING = false;
    saveCfg(cfg).then((ok) => {
      if (!ok) { OT_PENDING = n; IDLE_PENDING = true; return; }
      if (n < 0) return;   // v7.2: chỉ lưu thêm tác vụ Chờ việc
      OT_MIG_NOTE = n ? `Đã chuyển ${n} hạng mục [OT] theo vai trò sang ${cfg.otBands.length} khung tăng ca chung (khớp theo giờ). Giờ OT đã chấm giữ nguyên; các hạng mục [OT] cũ đã gỡ khỏi tab Tác vụ.` : "";
      if (n) flash("Tăng ca đã chuyển thành cài đặt chung — xem Thiết lập → Tăng ca.");
    });
  }, [cfg, who?.admin]); // eslint-disable-line react-hooks/exhaustive-deps

  syncDepts(cfg?.depts);
  syncLeave(cfg?.leaveTypes);
  syncOtBands(cfg);
  syncRoles(cfg?.roles);   // đồng bộ trước khi các màn con render (cfg còn null lúc app vừa mở)
  syncPhases(cfg?.phases);

  const signOut = async () => {
    await authSignOut();
    resetDB();
    setWho(null); setCfg(null); setLoadFailed(false); setSheetDirty(false); setPendingTab(null);
  };

  /* Danh tính dùng trong app, suy ra từ tài khoản (v7.3: 4 cấp quyền):
     · Admin -> khu vực quản lý, toàn quyền
     · BOD -> Dashboard + Bảng công toàn công ty, chỉ xem (gắn nhân sự thì chấm công của mình như nhân viên)
     · Trưởng phòng -> chấm công của mình + Bảng công nhân viên cùng phòng ban (xem và sửa)
     · Nhân viên -> bảng công của đúng nhân sự gắn với tài khoản đó */
  const myEmp = who?.empId && cfg ? cfg.employees.find((e) => e.id === who.empId) || null : null;
  const me = !who || !cfg ? null
    : who.access === "admin" ? { type: "admin", empId: myEmp?.id || null }
    : who.access === "bod" ? { type: "bod", empId: myEmp?.id || null }
    : myEmp ? { type: who.access === "head" ? "head" : "emp", empId: myEmp.id, dept: myEmp.dept || "" } : null;
  // trưởng phòng: Bảng công chỉ gồm nhân viên cùng phòng (trừ chính mình) — database cũng chỉ cho đọc/ghi đúng phạm vi này
  const headCfg = useMemo(() => (me?.type === "head" && cfg
    ? { ...cfg, employees: cfg.employees.filter((e) => me.dept && e.dept === me.dept && e.id !== me.empId) } : null),
  [cfg, me?.type, me?.dept, me?.empId]); // eslint-disable-line react-hooks/exhaustive-deps
  const bodSave = useCallback(async () => { flash("Tài khoản BOD chỉ xem, không sửa được.", "err"); return false; }, [flash]);
  const orphan = !!who && !!cfg && !me;   // tài khoản thường nhưng nhân sự gắn kèm đã bị xoá

  /* v4.1 — Bấm thông báo nhắc khi app ĐANG MỞ: service worker gửi tin sang đây thay vì tải lại trang.
     Đang ở màn Chấm công thì chuyển tuần (vẫn hỏi lại nếu còn giờ chưa gửi); ở màn khác thì mở màn Chấm công đúng tuần đó. */
  const navRef = useRef(null);
  navRef.current = { me, tab, go };
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (ev) => {
      if (ev.data?.type !== "artius-open") return;
      let t = "";
      try { t = new URL(ev.data.url).searchParams.get("tuan") || ""; } catch { /* bỏ qua */ }
      const { me: m, tab: cur, go: goTab } = navRef.current || {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || m?.type !== "emp") return;
      if (cur === "ts") window.dispatchEvent(new CustomEvent("artius:tuan", { detail: t }));
      else {
        try { window.history.replaceState(null, "", `${window.location.pathname}?tuan=${t}`); } catch { /* bỏ qua */ }
        goTab("ts");
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  if (booting) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
      <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /><span className="text-sm">Đang tải dữ liệu…</span></div>
    </div>
  );

  const railItems = me?.type === "admin"
    ? [["dash", "Dashboard", LayoutDashboard], ["sheet", "Bảng công", ClipboardList], ["proj", "Dự án", FolderKanban],
       ["emp", "Nhân sự", Users], ["task", "Tác vụ", ListChecks], ["set", "Thiết lập", Settings]]
    : me?.type === "bod"
      ? [["dash", "Dashboard", LayoutDashboard], ["sheet", "Bảng công", ClipboardList], ["proj", "Dự án", FolderKanban],
         ["emp", "Nhân sự", Users], ["task", "Tác vụ", ListChecks], ["set", "Thiết lập", Settings],
         ...(me.empId ? [["ts", "Chấm công", Clock], ["eset", "Cài đặt", Settings]] : [])]
    : me?.type === "head"
      ? [["ts", "Chấm công", Clock], ["edash", "Dashboard", LayoutDashboard], ["sheet", "Bảng công", ClipboardList], ["eset", "Cài đặt", Settings]]
    : me ? [["ts", "Chấm công", Clock], ["edash", "Dashboard", LayoutDashboard], ["eset", "Cài đặt", Settings]] : [];

  // v7.6: Admin · BOD · Trưởng phòng — full màn hình + menu dọc bám khung; nhân viên giữ tab ngang trên header; mọi tài khoản full màn hình
  const isMgr = !!me && ["admin", "bod", "head"].includes(me.type);

  const pageTitle = { dash: "Dashboard giờ công", sheet: "Bảng công nhân sự", proj: "Dự án", emp: "Nhân sự", task: "Tác vụ công việc theo vai trò", set: "Thiết lập", ts: "", edash: "Dashboard cá nhân", eset: "Cài đặt cá nhân" }[tab];

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100">
      <style>{`
        /* Một font duy nhất cho cả chữ lẫn số: Inter, cắt gọn còn ASCII + trọn bộ tiếng Việt.
           Số 0 của Inter là hình bầu dục rỗng, không chấm không gạch — đã kiểm bằng cách đếm
           đường viền glyph. Nhúng thẳng vào file nên hiển thị giống hệt nhau trên mọi máy. */
        @font-face {
          font-family: "ARTIUS";
          src: url(data:font/woff2;base64,d09GMgABAAAAAEeYAA8AAAAA0ZgAAEc7AAQAQgAAAAAAAAAAAAAAAAAAAAAAAAAAGoISG4GFUhy+NgZgAIYcEQgKgbg4gZ1qATYCJAOOVAuHLAAEIAWEGgcgDAcblr8HonPHPiq3A7Dv+97DnY2wYeMA/Da5O4q6nEkdOvv//56cjFEwe9icWvUXy04SKmeiyqgyeu3T3Vt3T8yKbGMKS2g8fldm8J5Cm148K5GUIy6WQ6ngb09MxR5+zuP85o3uQj5Fhcb8UPU0dRX6cKLY0ibjn1aG+4SKK/aFvyZR0UKTB3pY1/nwIfHUgiD9NCTWIrMDXZGoS+45vHX52n92ogUpFhSmwq0UCxoSZIgsPkJjn+Qe8br1M/veS0IIMUAIRYgRldJFjIgNS7AhImBpHELXCJGmRAQO7XAc58eGHHp8j48NWz4qUqIdDgJERFTkgOMiNozYOY/AZ+1lL8nuHa0K5Rj/rUExOJQoXSj6hX/g7wd17v8T3TgD0rUYkSALltypCxyJC978hoe59Y8UWgUUpASJlhghIA6WrFnANsYYsQEj3NgYbCwZo0aLlAg9qj0xAO0z/828VC9LvajvP7pVL/Cx2ITAmGm5/RZdt37HP/8c/+3se9+PZg3Q4FTAeYA12Jc8gQwCDbQ8n/9+/dQkO/QlQ5FhwNDGYTdxCWa+2m7co3NdRDAs8mnfgpMWpgDtKWlm9wGAKlwupgeB9XSa/whHPKjIPKjTqNNdyN8xjx+tZPH7gepO5OAc7NruWlGCukae5+nv05tlp013ehz8/sYzHg9gOSIVS/yLtVov2LIfNTY7ZFKhHUJiDCj432qo32lZI+ojAKY6526cO6Ts/0w12/0YBgCK+/jukXbGexdjT1LSxfh6p1DPzuxwMRgsEXnCEgqkJFsEcYEgdYoXuNhFIEhKvJQyKDqQFxUuxdIhxz5XIXUuXVFFdyF3nUPq3Llt3V5XunPtsjIPbze+Re3o2dcAE460+Wl3EB9Y4K0t8AQizjief1n2s3/ycnPUL7R4gjJrJX+nUIbJUIvuRREUwuEQGocwyFbUKozSCI2QjuD3TpXa/r6XOVRqFEKrosBj0ENShqRugMs2YBmbdRNcROrb8NW8JxvinWnt06jiEkqIwry/5ZDSzKLabfuW7J5O1LIopYTwG0pcihAh1sklJ6s69U+2vXibPyLRsXzAKsx/EQAi+AAAAPSICdAsaLZAKMgyKEwUFCMOSpAMpUmHMmRA22VCO+2EdtsDHXYEKvErdEMNdMttaIQBIgppwLjIBYyHPMAmiQmbhRy2HCssHCcsUkWYQk2YkiIsmz7sJ+1hhfrCjhkKKzUXds5GWJWtsFpXorrjTthdd6Nq0BAFEQA8AGYQdjPEqta2HbvuaggBcK1ThT77ITAMbB7KSJaDy2PJMZtA+vSG1ESYgwYABoMCgIjApTpVTt9QYbCwcZ76kZwI3v88TRD4zKY9AmFalzl3k+V2AWBBAAiAIACoTQYgQAtkvtd83qvkV+PXcDMNGOGg8AjZQgSY3wQ5UvTdDKvngdirKp6IIUxHA7CWrMI+hYLilR4kr8OAwWIDFakc5KNEJXDDy/ipJw9Zi1dzzJAlW45cKlXqNXmkw2Odnniq1wtf8pXv/OYv/x2F8SjyJKLL+Yx9wdA/CkNW73J7p8q6n6Er8uWf0ReksjSFHkXn43in8icFnzI8qgtMNAxOH4l1HZkKGzw1kOpUgiU+K/2B+5VeE97WqV84qCknaDlpYvU8SnhimMpwE8oCmebZkZHFswk/Qi6vP4OHQYHD9HwFvvHvRfo3dEICq/HHHSJwEBAhIAAggJBkYoMzBfysEhuXS1/4vrInMqZM9dI3avJMl+e+dAAjSpCX9nQpPPd8DfmCP97rAgNj/JbDVoJ0NdWgA+nLKpfbr2vQ2RxIRyMZ9CWku+RVGkyOTRcl7M0HB3X0tM54AUjyR49h5zN2W+CZz/lwaFjbIxchbCWVo+ueqbXDLU51IH8vH2V5GOfJhSFJhKkJKB1twKIx8impjPmykuvBj6WAs7LXt+hMemwieZTQS24VORpcN+rScDjJ0h+1snt7tvLCXqE1kDIvjsF2JFtJzHBc5px+9zrrWr1Z+x6nL3spV9tMOcXhhz2RVzObC7bci94f1r3+Lntxk4S0trBYe7YozIeMbKB0jw2w2LqlgZl7g/yP3CHzRMVavv3IroN1/Yu1loOKoG+ltMP07NMWwiNXyh8lKQfgswAp9cAsyAPn1HhwDonvQD16ZugcR3fGivGUMHHii++sS0a5Sk3k1oXEnT+O1aCRvSbNxmvVxkG7bk569Jqk398mG/DWFHqfzPDVv+YGECzMFGlYlBuPlhQguGWImVGl0QVspDORwZwSZTuxTKZ2EMph60emcqt5/Bln4HSOs4DOIy5AlxBXmbnG0nWjVBO4YZQaArVGqSNQz5i6chKQcRKngJ1GlCZsrYh2xCM8Hc3ogX7jxkI8T+dGnnmOpRutB62fhb+JDECvEG8gPTSE+NjwXND5hoH4h7XvjP3b+GlO1EHAKjMEjMk8gMk2wpzHcJ141ezANJoxOI9iQcKKYHtJzNa8jC5AIBrKG4LP3G7y0wMLXM+tjUEBsIEAAGixVi4OI0aCvSBGtR2lKbOg6VVAmYfHLYF4IDyPRcay3jddgAxsRIDCJyIG+mTwfF2ir24veF0EGgDiQDxmUDTF6TtOmJz8ESAhskVjkBuaLKae+VEACkIh6AcRf9r//iGHAFjQRwCbdS219aGB8Rus/WPJ8NYLaltUyhs/s9pdS71S/cLpVpAd2e7M3bNgxPQPuorcHWvdvo2YYkS4K1oFP2vZCU1Ho4xT1XFE8PNCuzIoAC1AwSgMbRAbRbFESUb00CXY19KbBI00Dvkq3Qmao5Hr8SAmD/DguyYiQCQC0eNQSAgcMDg5JvgK8QlsFYaABAm5HoOx46g6TdoVfZTAANvJBWvOr6nXJX/jdEyriI8U75o+EgPAaD84HwVkF5wzjEEVg0V4bDSTVVYil35HMY75I95jR4er2vj9S9TEGTscENmuItsJZaNsX7bFiebkTrQwJbArdHRgh8IRQ13hHwJHDNXgqgK2QYw8qcNxj5PCERVZERyRroTLAbVqXNv3oHax1oLW+ta6huEbcHYvRU0ixgnFiBg+EeMtYiDWa2i98N+Ev0n408B7qoUFAhC4gI0CbI/OhfguXR6j0jYKNiABB3Cb3xsAXxC+cEew9O54OYIwYr0GxoJpSK1WiBnv6l4RFgJ3H7qZ9zewBBCyoAHAr6KXBfg8iqHRTNEQGrc41W8UWGP6HJ2yubjhxmmfp9Ov4XXN4HydkbDMCoeiuEQbVaJK3VGHPo40G6hwLBjNNuSHyzjSzy0bo9mSGMveOONN4MCRE1du3Hnw5GUib5P4mExqoSBhVlljrWgxYsWpugk22kRusyQKW6RQqdKk1wuvfM5nVrq8DtUzErJHNzSlN0sX+IywNGfcvBy9zU3/L0rfHa+9LYqq25QQTPj1+Az1yCJrYG0ivpDCJU68QQg//9NP6lK+9Ov4FwqOn1jbs8Pg9WOi157QPsOAKYhRabTISg3uCQwtem1G6FUgRk4aYIH8/eeIpWSWkSEdLn0A8agrZwBsj2ob1asUqkTIz9OEEooZdDlRoIAGBljABg7YLOiaMTEi7RkCgcHwPCvUBc91noOMvBM+aZPB5cI3A5JAAVv4iMcN4PQwAOdBAEzONNyNGySJoIAtnPYTzqTsCJBM2Fx1DM1bcBcMRBhCmhrhmgVwlS1xuTHBHCQwFuxhHIyHCeCgO+2Ro+Jm3B3cA+AJXhucOJRQd8l5koICtpBk8ntCX648CA3A3uGlZucaS5Q753JFJw1XY8FO3QYMB8fHfqMlhOxhv1ztxN+akAVLVuyIjeFaJbdnrkBLBVsm1HKRtsqqBv42YBG6QcSVuxEOM9y4sbejGsVvNMwYU4LLZPVBZLYC4qytflS1IkrSAsnKTg8uPeyimD0njgbvpE9VOF3/CgrIDPj9GYANgAMATRqJcYzI8MiYkOGTGUVGQMaUjBkZIRkLMpZkrMiMJmNLxo6MmMwYMo5knMnMIuNPZjFZjDxMYTmsgOp2JayCCIiEaEj5lsjuf4HdB7m5ZphHbmwLU9vig57W8zSsRDopRycb6gyIrEPa4oF7S99zEzxajxlC4z4munlLV5LmTtAhYd0rXV+Z4M2KiXKwzkXH4iAkOERtGM1K+Ur2e62UWRcnK34TJJrLkYBxajQPNQPY75uJh/a88XjdZDFaozLe0dRbmlDpYHc3nVJ9BbGRWmlpuTQZus37h7mft/tHjxo3Hd/jjYHt8Kr9ricScPjVaWpECmoKBa/qDeZ67ZZyI6r1uHI9pUmfljMORxDXNCp7wBV+z6fPgyqROE1B9sIluslosTSlQVDdIqC4z1a1nWCg9aKN5oZQPqrIxCKnbr9iGdBQpo1kYZXQHLPsBDRGdR3B6ticeXuCGLqN+syKf/SwfvVqOpWysPRCP++zLGjLENp+qV+GtUGakWXjZMdUJSSEK1ezmSXpAEGa0Zy5Ry57lnnoNNvdBJ2HZ4NZpPWZ7uEva4mMJ+uO5uT27ARlT4c0Z2Hfz1xM+VyxuttiAUnNMsys5pTqN93MY12wmsC/yNweeuBznPVK2Twv7GibxHa90kCmyImOz2n7tYoBu1Y8mpk869YU/fdgEO8yp7MokBsw/B4Kto7i8K6IJlv3G4Dg6wLmCtMslmmdFBc5H+T/W23PojVbn1+mLVtYlW0r0EWUZwMyHwSvHII2crwd8YeGT3PmKWVNxD4ys/k3HWaWlMYlhKVjM1bYiKfqPzPAYh6ttOzFzXg1Pigmn176iM0TfcveftF9r6C4rLMh9J5NPFkLKlOJz6wmZ6IcMljy4ih0YdeMppC2j/cVuFOhXsDq2/x+a9h0RS42BlbWVIxTbJX30k08GkDFwtZXg9iDokV7z066UK15gTZwtQectPpK7N65ax2dUyaPiaW38W6fjZT5UYCvDFZaoZ3Thj1Zd2ecwCQsYNFQhtu83Tasu3P+zXNo1PFZOEt5pxXVFdTMi0c7FjpeZjZg153gYAttVJTL8mkkhxW0Hfzfc9h5XJSp2twVpdlr28MQp2m8C+8m0dvBc6666rk/8y6il+J65BPXXR/nNObMSy2X4lGKqPebpxuP+e9g3X1ZIc6R6Tu6U6Mh4Eysy8se4IfjfCjAdeXnahWg/ZGpRVONTDFz/703v76LcEqs+H1eOgzzsqZHHtB5FwC297Mo22OK4dHkuOX+Jw6IsIUCAQRZJlCoZMFSpVPIoJQi0w5pcuTa6qijlIoV265EiUwnnLDDWZdkuUptt1tu+dkddxRq0OgXTZr9R6s2h7TrdkSPXmX6/e2UAW+V0/vknK8BXM4UCdw4bIsqffQM+7G27n9Y67zFE7DFShLEJ1XohfueoWwJXUnwLudMYyXEGjutvNxhzVmpzyoBVqxecUSAHig4ADnhoDbWX4XTrM+9VDyotQrNhhAJ90839xUAHNrA7ggAT+kByB+PMpCxBDddXiaVnSm+v1y2qROF5lwA8YpNH/EGylIsr7eJGcRw2XMADGxHeToHtVbl9ZrfgI0v9jevNnAFyiw8YyxIZcZIZqgGYypKj5S2hIkoCVZmgYiSxarFUeUCAKvN4e0oWFL0WuRxoOAk3KWmI9wxKTB+UYvTtPoQVylRIfIBxCEvAwHTNbCdbafh+TjnN28902VmaFlQ2ZnmnCxHYypU5wLIl0Tf8wayUvQvVoouRGNBZdV2lPNF0PQqFhkYYvCNYOM92S1WQBrMhOHu7hiJAIxlqBr7KbpjLWswWWeiNNQBckCz8gCuMVC6XQ7XLHn4EL8fcLQZMOiMIQuWLFuxat1G2J1kuC0HZPIsATowgAnZwIJcibMBVMUt64w0RCMCGQCABESjjN8pADJxgAbkrnmaWeZ1LpVvmwKGG+dQHGz2Jmyf0a16TXnVzBadrLoBh0PF+MJNLs5LKNfHdZ9pSKsZB2NhVzSUoA4U/nuGTJ4EdLctzHHpFLW/kicWFmuu6RlB8P6jyHSEBQ9igCWzM743+Y0qSkV0CoIECYlil6omE2bERQTw5gfiVWwoTqWGM23kVRQtC1Gd31PiV2kV3suIxK8SQQUHIyRAdCkGfnj1BaIQGxlJDJaqSAWRTKg6EdwdIoJYOudlFmO+b6ZSZOS/wIIkmqlx9vXYr+QweuiLPBV8H4rarIB5zyembYaQl++vrDK95emkKDkEWk4CzpZlBwAZuepoch+N9dXZePjEayNMq00/MHOcfo022AbZdtp17HzFi8QR4nT/qxy49pb/YhUpUFCNpzq26ZiZr1c+GomDZjwEiJQ4ruM7YRM30MEMddhTPJUjn4bpnMGZnKU5P1enaTqmZ17NxxlZDmW2HhuwkZu48CUsffO3bCXgcKir3qbt3P4d3ZmSu8Az4gVfyTLtUajYKZWuudVJczZsu02ri47e8NCEH8vKNWnXNXMowbru4Q3ayPpnX97RmjV7sdKkZdZYaGi0aKmWm+IozTKaalnu8nlXVdQatV+l3jvke6w/3yF+IiRIg5OJg09MqUm3IQYrLrhOo1OfNz4PkGVEOF4TMBETNymDbFUhEe+4WiWSXLocBxQpVeGyGve0eqrfoK8R5KHIYSEgUqCRsfAIyNRr12/cgnN2PdCqU48Bem6Jmt6txgeacjN+AACSJM3MzCRJcs45VzeOy6aTIWapbpnxN/GCxrsLy8Ty+L7WnqHJOfc8z39FnLEAZJxhBQAAIEmSLC+UqKGToTWtE0KM5ZjOibJG/goHEEJ4RCSJXOSjmVqgEK1TrBRSapcKdFRlOqcqqdWodnVrQEP6bhYlsI3H28O+nuNAr3CENzrVWd7ngy5xuS+62nescaf7/MafAzSXFkYcp3hnegISnDWJTmK2JTf5OZyTORNV6vIg2nRFF32GSzN8xqr2dau0/l3UsIY3vsnN7J4WtrinWtlrvdWmdrSnr/qxI8thma3tOqzX+u28DdpVG7nyTd+cPbBFW7oVe3lr9t627tPt38H9eoTNY4tOci7nczNvwYXcuos9xSlv1xXc0Su7c1d16mu89uu+gRu674/FETybN/55PN835wW+FS/ibXypL+vtewdfySt/F1/1u/M0r/P1vTfv86IBAgoGBWOCacGCYFWwJdgXZIKO4HjggitoRS9GMYcNbOM2vsT3+BP/YZg0JWgYTaBZtITW0Q5S1ExH6DSFdIUt7OYgxznHNV7gVX7IL/ktf+W//J/DRph4AI/gCTyDF/AK3sA7+ABnuI17+DSHfMVarNv6bdgmk6D6Ms20YTVUptyMHwCAJEkzMzNJkpxzztX1zeYAgaaBAAAgSdLMzEySJOecc3V96z1AoGkgAABIkjQzM5MkyTnnXG7H/gDQNAAAAJIkzczMJElyzjmX29EfAJoGAABAkqSZmZkkSc4553LbYYlegKYBAACQJGlmZiZJknPOueam/gNsJ0PMUuu6TgghhBhjjDHLsizLUkoppVwul8vVXSC8ldW1a3IQJ1Vd69+uV9cZxAJA4xPz4I8CQKybvg+XeQQfdsj5EN87fboXAG79tGcRs/1s8Eqztr5Md2v4O5DuAp219aXDs4MIFl4OWN5f4DhWFn6vSKDYgiCRMJXFJmDDnkuW4JUdTog2YMCLxkfJsn16IPtIdo7gQ+IYPP3eEPrYWJdR0s14txkHXvzMO4H+SpY9ChxWqlylKjVFBxjWvJv1evSz3oWevvTTxPCt7NXoG/3kHH9HpZ/01Oif94zkIjJyjn6QQ8CqCJ5WNPqz7pHQpr6xH1+sNa5Ld+M5vhDTO628yut/IuLQGTBIn7VDAgTGAiBT6Iw7un3NBhQZj1yPDTc9pY+tOMRJfgpStDJVonOqk1b9+mgWZWMvL3CmC1zma271K49EGLfMyZqkJj/l+dxVTeyenmxNdf0uwEl4ijhhTuJTy2n8dOn0/OxyTjlTz/xz3XnmvHt+GgUACRGlciEAFoS6UVABJITijdWc1MWg0mTNok+1xH/R5kdbIaLaTRRCSAwX3AusDbne7CFw2NHtz7NiUUzVfozE1Jy8F4ACmjmFY6xrU3CRYQpxjAUpysssRoljeKdEv8ZmInEMm1SBhxDj9XAH56CF6sNeaKHiiC1aKHLpGijKsvrQg6Aoj3XUBmkNKMq+h+kaUJS9itIVoCjr2J0+CIpydZ4SFOUVcMNA4pCkoulQB6gg2ucuCBNI5Qh0SzIU47dHKZlcqA+EZ0wRF6Q3BYK4AiQImU4sYDrSxCjisocIS+CCahppIkII/wQiVDGJIYAQuCQAdPDOuRWQGWwg0gBlAARjypUIEPUXx0aCZJ5S6Z9a5rOkCgsYmBYri+iBQaZYQRSU0PWwIbYtmpS62phiETFUqW9DCdA7w+R36nCn1TsyD6/aBJUttlFz/z6xymlxZG7qMIwGlJoYW1XORINTnZBLi491oKCOzIhrz66tL8hfU6+aySPfsqSTTiGrNnlClpxt4MCkTu8PggNJAaRIIZUm3xQq1yzVqFFYAMHybNAEVhQjpjWZ6suvqj0savc8bdqxcVweY4M+4Rk2TFiA6Cxc5Ovq5WatcrduWeet/M032Y3/LBSqUu0rf18RNtLtWy4wOZRsmsSkQKiwVH3NFFYrEMovVfc/Ajs/hBKn8vEcIauhqI5kJwT2hg3DAlF9sMBED5AefZyDFdAdqMOAXH4GNS8KOXgRahbrYeCZqJkb8AOPRM34fDF4ALoEZjrddSXoXd7+aPgzLpoBuFkMa0Do1l2uQfHEAA/yOsobe3T0q5w0g3zKPCitfk4u4CH2rYHDk4FEBMVK6bKSBKHcp2eXfEYJSrBVexItglL1xJR9+SeRN7J1CiU7cACrlcQcACFxGsmS0YMy5MsIbi8HEWicIWo33XLbHXfde9A02v0ZE+/ovXfbf/DRJ8OPEPdakGAhQoUJF+GoSFGiI9gSJYJ6QYg4iIdMkEW+KPifungT7bTLbnvstc9+B+TJd9B/HHZEkUOOOqbEr4odV+qEnxT4WaFfnPSbMv91yu/K/c9pZ5x1znmVLriowiWXXUFwZcgFcF0dLrW7BJo1E2nTxtIzXax062FD5xM73wxzT9pUT6xY738IASFbBIA3AgA7HkIEVa3d/58AISDQOi5TAYz2rWN2iG+A1t+13zEEwmSpoMVhxoaEAzfefM0MGdVd9dIi1YFFqpUaSc0/0uXzglwPJd+0oEvDi9Ai8V1FqR+UVTTY7EuE2QmJURWSoK21b0MGNI1m0Onaz6AVtIrW0BWk+tIR0yz5BIYtJgg4ZyJVu2gYMb5W3nJ7kwQf3SzQAF32N00v+K4wBjAnDvcDKJZrID+UP41EMaeiJP1OsHRi8x+ckDtLQkENJJ+zd1/MADh/TlGAbwcA9L1HYwASPACIggB46FkQgBcJmgCAp6mynGNAF00FKzFmZU0omjKixt18kwgl1hI7ib3EQXLWAAAg4cXPSZWZokCQYqOWF1AzxRle90mJk8RKYuvqdkgWwjwjb0HP92ntfO8r06vpX4AAPAAsovWqfO06devRq/+6gQ8mE91r3Nz/dbovLXtQeey6at+89EyzLg314tOdhW6nq+ohI1w8JsyYE7J4qd2t2xGTcOTEmQtXbi+y+0sqdUOTGl99aRRMMctsc82z0CKLBQoVZrkVVlotwgaRosSIJbdZoiTJajWq8zarqqTb5oGt/ghR0Hcj+n32T6b9600U0siH+AD0ZsYUDPCSMXKRB9fQGCwUgo3DGN8oAqYsWbEmKqYxr+Rbr72xXhl3/yZLEW0aX1PN4Ge6meYIMN8CsheP3Z4gqVZZL9wP1lrjFnrNelXfy+Ns4X8PQqiut7EHhAv5w4LF7Ybi2vkv6buoFrQ+XYdpxDbhmvENBDWxjqTNqCdraJ2ZXVnd9FOMHubp7F5WX+4g50zBSOEod4w3XjRRPFkyxTeUTpfNlM9WzFUuiZbFK1WrkrXq9ZoN2bnad+TnFVvcQjgMjgEA/hEAUJ8FeHcgfAVA8hMA70DAuRoAABcZM+1WCJQB1EUsJrWeGtN5QhQkjtpQOAAkbSCmmyYs1pMGCuZhES81C8pJMJK5qjdmPORkzK8JhRqA7VOLlIYsSA0zCSsui4SbFTN0lCwA5S1HRp3ffHTY9NH4ESqcbAJFHABkJaIQdcxp9P67ZLopjp4LJmtPy51oZntZ0cis15HtwCrsBLQ/uonY7OFIAOS2CgDmoihEFgkflgcvTiR9Tr7UZCjlvJcjyQeSLA/In1WMKYSxLa3DnO41bi0D+5439PbmpgHFvWMuUgERjfI++aOmdDKh6w32dKdSlpSjsqE19Wj2VuoixoSNLff77dhwwSuWBIVpSm+xJ8kJWt74Mft9+M14iPReNxCxivR9zsNSvqvXpxHawlAs10hTzHQyHEzR3YbVGYXlKfetDsSxuVCpREG9K1djs/FBBq/cYpGR58h7mVIRztFf2Jss7XIiZwb2y8UQ8a/JQl7ky4z0E0NaDpFFLkR0r1RUMIpo969PSNJBHMliDDgTiUcVoZyfgJGB0FjCYBTy5yGIXonOjGwamoU9hdUwXJZyWUw2yYGQiCRvk/sJTSnJPq/A5keh8ltbaov31Vg8ZVAMD/IDxry+tH2Lxf43HoxVND1R4lwlfQ1bW2HiTbZcFkln6Tt/94nvfP0Gtubn0JOw9A+rbb2pY2zFzTFMei8zC9f1r2dP9f3qxJMcKwUiQ6+YGwNu6lUea9sNHszz2SFOOJLSdcnz1q9p+kRWU9zf4jTG020+H1sZ1Fg8xES47UY5Cm8NHfE7/DCM4fojQMLYqD/fm5j2a1DZpHQzT228DRLXZCe9EXz9OMN6fZrMBsW6j2QPdx8rQdC5L2iMYsMF13SkhINUxjJjs37Hu6TgQIgZyrdNI9rQS0k/2+nnZMj+Fn9JWmEX/0EwweavPBdAMRYYgbQ8n57yZvst6KnrzSW2gB+fm9Z1JOuhd3KU8s11jHLMPb8sSuBAcBZUC+okJ6G1NG6lP0ut/gyxeBOaZRrqB21AhPQwfAZqDK/WFp1UnpnGNIMHqtp5AzCp0EL9go9MFMhxiWJ1QiddMColrA+d+8pmXXAGAQnX8UO9xDaqYkquXqskE1pHHOyvebRb3cr+p3HiHqtNA8LTOaxPBdL94nRxAYP9VXHKaxVIoA+KzZPVtaXbBDunSq/FN9gHSATy1kl3qkIfJs1BlZtvRWF2ghBxQqS++H+Qg0GvLFKlkQi5zZdHzvNZOhJhjT32XEoqPnE7YVLfzMymG28h4rFCaQlmg1ib9URpYTC7n+xRqEAS91Q/U1WQ1hVynYsDgpK3wXDtvUcoxYRFymRGLvUkQVGtz3XWNvkWVfCXaIbSqe8EUzdsQCCBWW7qnfaYqu9ehfHYzeR6rvPN1dVzE0U5nJbfdbhjQ++ZbYGKnd7r3fupIjfEQz4cZ1JOqUrT+dmPuKNMWVPO7EeluKB6WPe3t3wEu8ksFbSqtJ38To+Zo6posYyCCewPDpLQTg5WWjPUGeWkOeMCa9Jsrmrx5L75BraQPo2FvclnIkmTcWoNLV6FXtjZBmo8Bv3Qa9DiOtk0V7mXqEZ9uDI0qbB/37WixERh6Q6C0Fymia9fIXVgO2OhNq28vWDA80l2QBJKNgsJbXCloppWf7/pLAoDOegPHVEbsOegMc27yuT6QyLFr51kt4SEAE5nvOj+W7/SuYDpi1lWP+a2qMU3ExxL6xXK/VThMdSHXs8zXj1R46mX5mVG5t2TsT+EJg7nsHzRot8KVUHGAfIkuQROf8HsdT6PDBf6yqOAz7GWRKWyg5miUM/ZsA/9/zINnVl7Ol/VwxHLu1oCjEZicNoqTcmG7FKllwgKw5a4fX34U+QF27G272MYJkZxwWs0FeouFdOjz8qMYHaIoOHNuWL/netrDDXfN5qqXbrWGy/+reGU+zdko9ISB/IMaWQhjHsdTvKlzY1ky4bcMMhHmkCPV5z4bMZcp14T7F/s7Pvl99FM1c/Xov0mhV1oByr3RqxFsRbyFp65pxir3RM0TxNHEq2DZrmOpI7qj4XsBRIIGHASIZ4pOXm65PhQJzXntzrmnrd35bmj0+a7uLMjhwInh8KQUyAOzwzCwafR55JIYeJEIzecti9eQuudES3QD7tF5Dd/+ayHKzrLyXquy1bbZviTZ/uIcMV8hvn0tca0RKdk/0h/6FcWhuwocDdlOFXItpj2Ntv62U+7bmlVbekT2e1fOcx828x3zBznY7szfcZkV2gN61h9vK+OSW/pddCRQk6moamhrt2up4ns+1kwxVqhwXNXMbKF8vpCLL6oVr+Udpsw73EkJq16U+A3VWINwXehcSfsT9X3t1RXtH2qTgx9w49YW6CMDctbNTVJDXrlPZJ7QLT3yzPiwauxXyyXt1dPCq1g/rX/U82+fs+6pLZOhzhIdoRbtB0DhrqOyv8q8samesdTYpaXAp9LhqB1xybwDehXflfJphu1WGCgFMRB4cR6bnCDhhkGVADQG7/J58bXMcspyXA6kfBo8NMP+/FiGO/afvIB9+VjTdr0P39Bq8+tcdfM53bZYzCgNDctmXHdt4NYrfu3LxCCb+24Ci53vjefPddl3n9gVmCgsa/VtdrKaSqVaQAO7PPK4umaqB4w9pwsdxCitL1k8pfxqi42eXPhfL4Sh6JCHKh/FJKxmFm7nBVrGmPWhzOFdZMCZf03X4pEfuyrhlwtwiyngUxkMUfhKZjGzgBH1BzIxjLAph7T0GnaiH4i+WyYHo/IwtECLnVGh91C2hN22PYbyXS9ceQ2DoknCnLo3q1Nu4eboz3ZYXT4Rw/OMtl7Sq+jR1TqiG0VADt7OmZdW2+0u19CGmHGxSfLCeTn00qckRSyN2V59RT5G+VZfE4yDwlk4pm/K/3fHaUM9yQLWYPjs1y0b8p/qnV57cD6VNatt8MtPRAT47QcJv+HDkj0orM0oyvA6uWKdxOAbk3PnipTc//Pn6kAFJzY2VXv/n/nwEF5jEts94SKTS+ho/+fIrujv+fhHIZyoKoTLz+N0R1VY3RyOvM/QgIOgPg8MX7kizDedrom9sjAvZFe9ovdIfxhjXWKESNGDP+WAyTshjF/5t73wzPDPz6baQMWWTmBX2TpRoaXhsEGsDDuHbrDz18r58DkFenQfQ4Is5aVrLEqAW/9w+KV/Gn2UrcuD4tVtGA5xaNokiYFW4nPa9B1EUDkz847IefnMr//YS4zZGtHeDt1RMnfcKrcdsThRBVEXWB6w7NGheVOndLyWYMuXRdUQcCJHbHb+4X89RHV7TSgK55hnfuxpcps84oYfNm8KJnRfgBZncR99c0U4fi6N9cIGON2oCMcoHXmwZdnZ86+eTzzvUU3c+s/7WjRehBFcr4VujWd+d0P8h4I3NqR3EOMafhrTqXXD6CwwuIMbQhR+6RBYbm7rbR4v7FZucPnX29ouWhIntg667i/R0zrdr1Dfd3bHAYHAxz0lzmIxOnG7189JW2TmvTtokq5J01B20FPf/sKTJ69G40oVJVIay+9/LN2ttPrWjD5TfxH/E1ZcY8Pva06FVTQIhQzGrIG9iPI4cDrBfXhfD+RT+VuyMc+Aj+xD/fKgYkFR2BhvEiJAGmmGqLj73WGR7SH1QeWP3J+RJlyOUIx+vPD6o52uqL3HzTVYD3KoijLZXrp/9mWGCYidPmT3a1oe4ZQ69ENeFk/9blGwmDkuXNIxRHzij0Xab0TGUQBJ8G8Y77tTvDWXOYP32ux4PPby7qnDUrLbfUFW6uu4Vmj0lVeC1AJv2z5b6lHWfZEpyt79kK1VDLNkXSQoK10OrSlk1gdB5hQ0Pbezan3B35feHPs/b7LA0iWlD1cjrsvKpdOz7ZK2uGpyixGal0HevGnZLBo+Gn5MOh0G/u+SHfBSn5tDyWvrB+SxR1NzakmokkM3TGiy3r0evStyz3KxktfFXWeelVUt2YmuGBXtinRcTpTiGVIAoddD2H3BO10xmtZ1PZimfLaL0Jg6R8yw5t5BJiQbWARAoYPrlg2//zTwLPt26Vsw3KuTLaUm2Movb39bKDjJ/NmoCfY21wXH8KS/p285R+7TVws8R2fL4yg0Y1rvOpwrXs/2qfXe9A+46BDxkfwSO99cUen7ucOr7vN0b69PoMP/IcuPrX2oR3WD1530xk/3mu2YpUd/tylLchFF2z0KHF8vQLH/ESpbb4FXh89TTqKSM6Nzv7/2BWdncI5ivgg6Zkv5UCrnxP6Q3Pp2WP0KPoPwR9E0xOZ25ZSQM/3hQk+CngZRcJ1B53EBQnxPRE4/5cfhrudD+oagidehKVxG6JT8dkWW4RlO8NrcjZ7eBTJb4PAr9K5zwSHGXjqxl8gcgcqONhqJXzAB29dYKewvxJsiYzhFMUQSMIoJObAQkIIt6ty+WhmQvuhemLmkPbVar9dAIWsiz8xXNiMR8nhZxbSndmOdJtu/z2CABgGmpiELwoEj934i2J/p6ep9Jjpw2QqJcW+LHWxjcvlduXjh7O5ctr8AIMLK/Un4NBLYW7UWvU7aLFsN6O2yznXC+KXIa4ehhYy5hP1deQnZ7AXiQ1BZAo0q45eWNiER8rhuYjoPB7AT6zUPt86vjffd9rZIYMsSmk+Ak4d5GvQCFaE8+ISsDBuBDqEw5gqVHnrY32N6erlarPHbYbRklYBcrtKjLjQWs4v0hchz8vlqMutfLY3QwfiBtgjLlZ4sP/zDpXZwgWVuf1p6s/oCJYQaJUH0AuRF6JQSEi2R7ygQ4y4LKhAXOoQCRJyPNFxUdhL85EumExxNbkrBPgf1D9pqzZbu1Rj+kSvL1eh4ExPh8ANYGFcWnT2QrLUaOIoT89HXZbLkef1RUX81nLEBXEVcrtNAEQHx7/tUJosnKu1+PRUP2MhsbWO8uQMtrDfjBJfAZ9r5HC5HflY8798YZDOS5Pwf/QXj7pRalXnUCCkkD3YPWh/nf16A1PTlZoBpTgnRA08vhtAwVIz7oLILflGSnVRWFeOComvictvWFC1vNx3FJ6lTitreKKsfX3hvPS/Dr2+TI1EZIfvW1+u7dSc+4jWWsrTs1BLsmrkhp5XxG8rQ24KRKjltnyQcXZ4A1gYN7Te0YOXNCrhHIt9of3m5juahq4qkgqRrgPD7A02sH7M3lwCJel9XcRyP4MPAUWnAGTXC5+Pv39hvt+5HEOv6NtznLdXKfePARd/4x/lR99zy+BPBxEzX1KfhJb1nnaRujpRSqS9qYy8EQp7tu5X1VtpYxETW5aSWI76YOP/OSLMTa1MRlQzdoHtwV4EDm4IzVbbSOfi2MAXHVa1fE5l9k32jwq7RIhLFScR211ioaOvOjg7BizB0rpzINW3+tohig/xqQ5wzfgG0cH13ZR6xyXkvL7kde2JT/xxH2YvLdh5UYd5hc55P/9/y+/jSco0lBh3CbgdFK2libROuXNBB7PraYVVLQWIRBKOvH8rtO/IqV4Jp7T7ArlaNAovrHEljAeX8vPKCuuzkSkMTN6BmcC+I129ovyK/ptZYIOiqNi4zlErb7JE8zVy5RLfz6HTZPXOoKR063pJ/dT0lLiluVQ40KXVzGWji9EJ4rSixnaJoLueTwL+hezBtMFp640AbDIctQ9F8evbQlof6Rrrbwau9ovwxTa9Q6OkfJsNucOb7CVH15ihbZU+P1Q2DMVorSwZi5Mch9cVGzby4v9K9jzjp29W1XJDTh5v55D4h8PD+YdzScfbTwaZgleHNtg3fuj150HueeSmeeRC7vnxfui90VlyMOACYe80fuVecOIfrxFvz/7j/3qU6L7a1TZFecn/eA4d9h5M+cej+CnfGfkwXu/80wIXPBI47ZwZ5EQLmgkec8F0/gmp5+tA82ihseV5LIXQFQxjh8CQXXGUtucPxst0G1XvTfzlk4FrDYLmBkERrbEZU3+Bvif8jF85ww6FPUT0Zh3aKARWWRRz9/8m+6n3utemhQ+dXamII0Yi7IGyITAmwDZ3GtUR4ORpWzUNbHTaXcAYdy02flOB0Q/FlVck1ZVXPxSNqg1qXutxlIhMRlW3QnlqkFzVyDwSUc444hxg3/u8ueaXktLqnxsb5VT5MRpVtvdwtva9Tx7M0tByefLrK7fMJfDdDdn/uxq7R4r1eagpHhu62VIjKGnhw5eL8k/Mt/AB9X3AbtgG9jRM22ncCW/AGCV6OB6dKqgPA/+t8aAooSPVXSvzOpJwUJtgdD8lA5sOl/nAvwnVBBEeTh/soLz6KAPHNeU4z5vVyR/er2mvPJctMewVLLjv59crSnNrccc0JiTnWZO0GCY1PteDau1WPW0VkRmeMntUJ69viPQd7g3tBTonwzfrtdTXQxdp32xOTX27WUv7dSiktcUMU+V9bUSby3VEO/OWl5Z2ou12bY3RCIKeFCzp4j+/fG2KbO7BfgTFzT+6khnljfEyBCFdqEgm0eRwmJx6rl56670Kne5ehfhiVcax/q4rWj2Cabf8PyBz6n5VUL9qXrVrgaTyWuJo7E4opQqfQZINIE5Kp6RZ9SnpQjwGWl6dnIGrj6NyTdHvmIm1q88LtPrbJ0s3+cr6ZaGPHduhYQPyNFum3fmiAlRHnAm6biX6Ee8lMrWrnFZF5AB02CawMIJQJ+1DXu2aufC8RSq+SJ6IZbZSiKfYHEpfZyYb0Ra6uuqS9WrvtCB6zeqJPhLPW0hXNSA3yzrUL16ogc4pZwvWP5K978ENTGS78d0yleJGgWJ1n/iCK0evEVdO6rL+ucJTnKQ3R+DVjxTKTzr1tZ++augzMDsYlN6cbFJPWxYTLoZksSIlqfSM3g4WuB3M9bb7Z/r2ajDNB2xz6vuSr74oZWNHtaVkB6syd9WWpLJq7T5Pp73Pk6xVStRbJe5WJAftJvwoW1p38Uv+6cmCDihBTKRQlF1oFrsLTVFSiHhxF7RgmyhNQQqxWFi5LDmDLEs2zA9nuLA2BaxxUt0oUKzvk1w6kK/XSiondPR/VTz5SXpTJEH9RKn8pEOv+PzThn7TbPAOvO9stuODm5ioNuO7ZeXb8KrYLFaUJC2T3NPOYjHb6ZReVjapR58F+vxmjVLar0NC+1r+ZlPm9aBdSyvB9nK9kg4DW2intlylfPBqdGDU+a3vfHgu0+XKcgslX/KCTjHZPeGlfUrAFqu8jnmyMmC9fl6Us6U9YUx20Kmiz6tzubJcaa9/BtwzJ8FDxa5S5ayeWz8H7uukvX4ZME/WMS9ljljdV3oqnPie8r6UcApl/p/9czonp0rlkeCZkwHv9ZfmykAuV/J5kaw/AKfCvGPQ6+DcOgAwp1NPyirPi/KJba1SeupH4xO/u+EhKHZ2RgItPIIUlxDNzSqPh4V8Bn0fMkXkKPvRpxkFjL5JWoVgLDOrkwGPFtHzBoM/yoZhxIh0RIXiOJkxgdY0YndqFntglzPL7yajCR/gwd1PwO3X98DD11nfJRAI8To2IQEvxRtgt/gRX382zTLVGN8XIuA9CY/Lb06g3LVt9ukpyIQHpQYyZFlIaGF5PDypLBJVZEHeNldIlq+wJHXbhSWrldKSeU7ibwS0bxHDNuu++AH6hmybfE4X0ODBItaAgHIr4mEyushclktWVtbscEtWOkID8SjfYjp24xMYqI8t8D57Iq1QhMHIlnFDAkoSplsHcayIoK0uK5/XXQE/HKCfK4+MtlcfTMKcpOCHljEyMSaVO/6i/or8Meg9ANjw9oFPAWv/pwNAduCDt3cOV9DhC9s5eP4HLjVV/yJL+u231ZkfPZFmfP09Xv74QVz9e5+WePaXujyFrzWViSFSb1Z6m9XIbo5Qt6Zlvmxr4D+6IKvmqBFTNtThU8lpDGg6vsDz4YSc/PX01v/LHlmwL754K8/r3Pk8ryvX3bkXSP2e1X7vhuiNnf6TrmfReRJ83JCkJqlBEpdFFlGPt1JZUWMn88EtR66xzxFhjHl1xvU0y/V08r4zFfmzRPYTJ1z7mAf6wCsn+bPc8bnsz3Q67W989hlbXvucPTHLWptYn0/MlbllYzVXlZWPVBoWuSqvqb4uFz/SqC6DXFf6vHZMq711X1q7Z1K5pFZJ795FquVN8K504x9/66/27n3ginT1svzDoBsAh+LXgHX3r7cEO92z87M2va+mZ6eB/Yu1c0d9+tDQbgBQ03cJgDqkBrHYiX30Lhqti86gdRoOwU4aggx6jTE/sDE7czyuJSsO4+x9UNoCvva4S9zVtzhwsAvaTk8t4E1H4bMw9kHzs0awtOPO9+BXcXB+jzLJ5KPr96nZHow1cRUsNFrVba4+oJZ4lIJfL/OC3nuGJkOCZi0vESAV3Jy9GXdq5MYIgI4KYrQJoiqmJMaoxSKR4bslA6i1obnZOSMlHo+Pj8Pj4uNxuDiN4ePefnHiEgCP2W8CDgfuw2dWZpJM8fmuh/q/nf0E0+dMasmnG9IwGOlxEhL/1iEFyciaNJFRTuvapcbVQnFp7M8DErEZgA3iV5Mcz5yALwHDVhR46EgQLKTqaZj4Vhx89cs3jv1vwHm9XbLt3HyFW9cURKkOXDV12ibbLEjlVRBziYDsP+61aMkvS5ra7ya2PSQ2it5E01u6eFNv+A6LN/ERfoyfeVNBKQqzjBojc2SEaaypUWy4hGukKjBKGHO1ym5JJLdkMsEyWSa9LTA+6N+cz/03d9e/za57ffF+cZjEpAQyKdj/GmPErSIysvJAxRVg+KpGdO26qLp4iV7ZZ89ZcUivz6Wiq5Go6nQ0SlKNRFPFbAfMih2ndMBAL66+LhZdm24ccZE8eiRxGRkRDCwYadRiw4u1T7MnJrKf1tYqJi6FasWSAU/Y8Zx+RnY/Kyd7oJ+Zw+pjMgdyjNnf1851OoYSFUWJgWiQEs0gNdqCkBh+klCjwJYGWlMiSUjO5XHPhlGsiFb5Nt96msOzsJlZPHjSaIA3tpLVGYyLrXblp8CEzHCDyFrzIxmtwxRB4qiR/AuUfTk21wjWJQkpiZxk8LZRcbGMd0Wj5V29WKpQXCgtuqrVXDCGkrdT+ARIHZEYoy0lUsglpiURa8zlA6m0MJ45deRDqfBxY4PQ+KFs5IJtsRcIF/+3B/AOrxxLz29x4YwGuzKL+RU5QhIxPiodFbPfbeJtBBdSlXw8XsDFIsz80hJgQmL73UnDxOpYSG9fkA8nm8fjlNDSY6Mw6Bg/t6nUADYvWph4IrGCh0q1CHidjPfMimbnNS9i7PW9DFd4RlqwF+LSbc+JX0Pdj5NTgzyRL/4G3nFLYYsDVh+o+x/Ugj0FdbUUu7d//u4Vl5OCQNFT4gyV55o6+zbqi32c0mKx3OyMpP6KPZt5wGOiJn/kGLvYBLFysCQ6nZB//GgU/zgLV4vDFyRHhtMS4Mj8OI9pgGCW9Cex8zqTiUWpcC6TbGPJtxPm4RGs0vFkUAi1MM5CLYxgdEFY2Nik9W7P6Lgc8MscA9CJ1IijmJij0W+jzpQPy0Wy09ocf28Sozozt0Rsg2wE7VYUbQQhEzNRTPKOTCQmREBQcDxVSY2Hp0DC6qNCs/yjB5MzsjUxOFrliaTCeCQ652MbmjWZRyiY1wKmXAMLL9mF3c6xfdDwT+ZECKEvDEjWT+TWkdOayQQyrKmOzOaoyalNZAI5rVlNZtfhjhfDCGlJJQQstCSNAEspToW9IN25GjJ0yom9vJkW59br8ya8e8UfWIh/Vt8k/cPo+cWj9pB2EKTz8Ue6vkQ7HdJ4KE0ZhCpSYKpbZ7qb22lMrWkOWQgy9dvPJiKR8T3fupOa4ridfrI92SrY1ECCyVZkh776MlZ6AZlF5hrfI2sWjgKDWpA2T9617BKc2t+9s18AgOEZf3b6bzBvT2/v0x6TU3UkYKjLYK/OGhAGOO5FuSxyAZmVXrbTSHaIiRBTAwlZ57Zvqg+oK9acjA74hYul1wMJFBCysVgSn9R+V8C6xPd4bQPgakuRcA56elaDdnTlaMwMwS/B71NIDdtQ/GGAqpeO7O3tXdXV1WGy+lwSmJyqMQnVgGRHJ91nycfRarRSVlY0fdi0AoFb1QrM8ziKkrRuJ8RqRsF3X8WVKJxV3zmoBhy37Oy4axG4xlfd/Zy2MRYuUQhElEpwB/ygEE/VNsCxyiUmfWmJTofHQBiMjipLDvZVma4afWsz/9rGev2nJeDkPIWuhiGFyM0rsBg6XUIQOIWSoCJ2SUAgaHSsKnJP08HgWIkkfsHffz6e7PlFbmRmnhkTl0GvyKgBTgcsvJxCRItAkpaeTswoEsFAPetReD4TDRrDNQzoF481DHApjM9ImmSXMEDUmUGLwSdbOfkOkukZT9a/N/LTauQNvjwJboHb08yo9u/fnjtHo1AzA9Nscx2HjPc8UXJl9p2HvdHctM6Nz3LM/V2YH2v/+wDDtr+/gvanaTc46//u+jxqQMxvkjCKGdWCahbq6/t05iaegstkXLMQO7zPMXeE9H8byqzzuZgksy9rmL6+T0dvlsoxP3zqzcdmu8fIDVuuvo3m/qvfYK7Uv5fVYfBqYj2cnolA6E8aeD0Rp6rDAufCn/cFNE1cddZL9CmEwwlW2FkQY/5nsKu/+neOixq4Ul+8Y5Ghk3qnd684AcsNL6jFNma0VWsxFidPXZmLAyvzVyQ1BqskqBGtXhvILZhDqHDz2BdW7vvb+G36su7Lut9z/TMtMbSvXldfmPfWaOvnTMmpK/v8E8VOZed8sn0+51HQ9b7Yd2MnOR/z3j+w58BX+3/IoRAAO59iEitcVC0X8uPm7nIp92SqrgDcxHfMDZ+cCUOtXjLZbwKX1tnzyT62GH+p4sJX4ObZ9qSv4xD3RBkg4T5d4SK2I79ugd9Clebf5uOGnlSJd3NCDrnBnNxK1DwwSp0Panb9FCHiAyFt7zMrnz/wxoUV8in9WxW9w+yer2w3zzt6oXmo9fNCopDmQYUl1cmDJSl8iVGlfq/PpZ65frMSLsQ74lZGFt3Z1ZvwuQAh+gy1aXSMuE+rUUGrUYdY7wPlgXqKBY9iURUn2X/QLvN0nb7R9v13d+ZW947cWcfd2TvdOXe5f9zFc9dUto7RNDzCZNdfAA4ksdsNvZ1zlA3UqqCjbgQhHC/Bcv0gyO7qNe4bJ+M1/wMTYjvZJFwE0iFqR837ZbM1qwMydRMW3VrQ/eIX98A/7pd/o1foNXoDb9uxfVMEHh1T/614MdoqBsZQxcvxvvRV6Wt4A0fg7VwlWIZnIJCvC0fV6AaqQbVQl7oH6gH0VEazTUAaaFm6PdAK4AgHjwGwPS4sAHpU8SgF6oAONeHQIzlIJMf4FNQoFhQnhqqsBVBHJ9D/dIzQcwZKeyRbMaYYudwJ1Bfv63AoM/hr/pcyJwkKIJy0xECGBMDxqQzCSSFFGYRTBZw5Zgmzj3BvQeqjzaY6Vpl6RtSikhXp3dsaK8gK7/CBReAbkI5162GD0bCFHcQYAwnGwh7jMD6YMIUqb3tl+t+aE/busWAUrq7W1sHA1sKA1/eEPzCDN7ZxdI/mPuB3g6vm3xr2kFvk1lJbnsb5rUNpOS//w5zDJiFrzzdbx8gXmEJqTqW8PGakKnB1Sq7pT7lFbi21FTto1Ik85HTUr3wD0RAnG6o1xuWhPrYK1WE0uIZCbpFbS20qqUgwvMjv1I6bIVGnUoecgKkZTxhwsqPuc4HCXGLnqYXeC0LBnAQ+hxadFvlkgZf6wM1Lc4nbJMU5kuIylM8POg0U8UeV1tGsmMKp2i5qKsOhVpGbhaaCPPun9hJvqeCwlUptK3x6Dcah9fGhxvFE7JhJUlPpOPgOX8RRRxis6JmV+iNGoelGCrlFbi21qb2RCnHo76hfPio8sGr4P6T57uY4jsVMRHx23JZRgzUB13RXbpFbS20qwsM6Xgx3alUYEnXdVyEnmPi4+ZTd3rFpY2lj7oEQv8i9z1NEXfWLThM2edFveqDMbZrrE639MRnlkk3x3uoMJEE5AqT2j4lZ62/fzLr6p8C81vqy4HfuA2zDhzb8f5cRtn3eo74D0+4pgx5Df/U78qK6NXzujD77uLsAAPgAzLJLl6UJ43NgqGGUi+L46lAB9MKeDaw+/WsEyDonxlFMRpBYw/Vp/WFqESb0ElD2G58aUYmSpB21UPgAXilVD9if7YH78aKtaV31rIgKEZSUFOkn4hdbHpFjHT2ggCW1i4pnArh1KcPFgMwZWYPhPYAhvBSSwfldcxG/Ft1iRzqIKUTb/mriq0dz8uh67aH9UFuTh5FerrO0h2S3pHbROqXLaOESzP5rATq5Og73GxWCZ8BTVS2X+VbAEX6sB1WQAUf5Eaq46ZfI14CDtFLYH6J0UDjj4uKieGHjVTKvYX2Qi+uOgtLYPmMPJ45gcTVKylMIY/NDSNJsbuxdMZIaJGd3qQVSUb/2ox43JSWSOoPEpWmP0VnnFFREKyMu3EbhcTESCyTP/FGQDb2BI1GYw+Yhi+RnfLU9qaW5DNQREpemPeqyLiJUwaYz0sztMD8z701u81ryvBKp627lK0fSLYddwT0MKslDnjYq8zaPCIIp9IECtoMRFOqDKjwZXNnLp/9mUZhFFtsPwMgAvCUYwNPOiTPaOq6Bajlpm7e0bc4aUE4r2/WHsWgQVVEZFyfNkdI2XyM5c0a/Xkw0hVodf4IJsg1W0qLwMvAWfn04+qIuGyPiNgY15S7aME9WbqLltbbnFRq6cONfKU+3/O4KFgOs2GoBQoju/2qfUSH9/LsiDpv02jv9e2bh8iXQbplG+pDjix3f8KKR9aOsaRixW72GlRep9dtRamP7gCd1ugYkvWtAnDHBSiowqCu1EeE+lGqCr6yvG9sRAkxcta2rwHzwN+Jc2TpfzdSTx1Jccc3QpfyyV4WT0sJqW6JIkDySVE1P4oqPIs5P7yLSFjmAFRLkWK9NFFWL0s7sU9XREg/JewxxxZW52CV/AqJb1kKVGlRH9q+2tfbos2SuUz9vWeslKZjqV62qygIJwnlReMQk0gnHzEMnU/LPso2MnLXQWFe1MnLJMV0KMLfyaD/R1rko/ywfhdM6ANLCW0MALDgCqlZ2KMOQLcMJd8GyJZETDmtBOTWXbnMJEyPaFa0+2E9Q6iPbJfwI6FETMVeMwIqjgeIgEq4qI5JyZqR9C2vpfiEA0DDn7sU3x+WS039NFAcAAHQ3HTMQt3Hk5Dqczr3HAFBAAAAAAV4vGbS4clx/zAIwfxXho/rPgu7G5+acHzbi6ajcifIV3UOlFn7dh6+tQ6jSAc6vsQHjLVWrX4h2xIi0Jzj9OGqwd5YYZci2IFJy+LLanlS7EOmPqIjGCH2JNKY6kYTeWBxQKos1obkScR2lqDhIPOjGcSYlPyPUQEm9QWnoyYQioe8i9PcCrvl0CCtaxXBOMkrV228ivksoWHgjvihb3FTkGkSVpQjD0BtcrH5jcdlIRz4BCmf2pmHuTWRZRIVOC0kT3cvDF4tYf5FoHihrNhHqpVjv2WFXtqmeHH1Gqb1E6gOU0mwvChR6oRYOQwZchiNQBUc9R9IBefVCj7wkGEDhD5HusbdlmmGvCSIX9VAH7aBCt1XwI/4EstpxLx0A2hDjSHwu4eQLZEmIJzZf8xQioM+zvRIoPMfbZzVK8zLZFHs3sS378MjTwyLOqLdva1VSKADgAACdM6BOJyJOCk8s2qr27gFBVQaRgy08Xm2M/Bv15jInGp5gnSbaE+zFVMJb6IPbpVrQ9LbcNlRPlQPUXUJEINnO/sMfRvQMpqJ+J7d+Y251ESQticpHmUlE1X4U9Qtxsf8vyNEszvdyd0wgusaydtxn8djE4smH6PkMXR6iQu75YVWP0FracwLHAagA4DAA7QD0pT/wYXXsMhr3qqOX8xLXzgHnwO4IGzG99QigUWTdPdW9CAFUFyghFlx8x2mxKoFFNxBSCXi3u5fmIjA8oLVF29BaI+hBLo61OskK0+5tHFa07RUabIPdDdKO4laRD0H2Ufll8RM4x1qjFA2FtE2RLdBNm2JcN/WLQG/ZZkU7qkpa1xpIPaQt0Rf2LiURVuUDUSK6xJWiiFgtjwQtFj5643D5pfXNQ4B/tAZXJAaatdc5+w6v+1lgBACFYFwFcRWuQvAVr0LxUrEKzUbnKgypoZVZbApaByLwmrOKb1YRVpkap1ju75cm3v3ZcVM2VxKFDMkSxImXSsKbl4mk5GENxCQWSpQKnhx5cDaSbEwiytGYLc14fGskS6llJ/FGKkVY0I8nT3ESrAOnieQhSpLNPB2NzVIQSGDOdw7CQ/KNxUkjt0EyHx68YuLTukaoJZo/jQq4u3YWtUnECiRSJEjyu0hYWZRxd9IFd+UpongkbAaZulJM2hJLKaRWPIoJOYnQ0lEpxkQ+xoqFUolVhKQgvEEu6PyKRj7I1/5a/9/9Dd0GAA==) format("woff2");
          font-weight: 400; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: "ARTIUS";
          src: url(data:font/woff2;base64,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) format("woff2");
          font-weight: 500 900; font-style: normal; font-display: swap;
        }
        :root, body, input, select, textarea, button, optgroup {
          font-family: "ARTIUS", system-ui, "Segoe UI", Roboto, Arial, sans-serif;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1;
        }
        /* font-mono nay chỉ còn nhiệm vụ giãn chữ cho cột số dễ đọc, không đổi mặt chữ nữa */
        .font-mono, code, kbd, pre, samp { font-family: inherit; letter-spacing: 0.02em; }

        /* Ẩn mũi tên tăng/giảm của ô nhập số — gõ thẳng con số, không bấm mũi tên */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; appearance: textfield; }

        /* v7.9 — rê chuột vào ô ngày (Bảng công Tuần/Tháng, Lịch tháng cá nhân): viền xanh lá nhạt bám theo góc bo của ô */
        .cell-hov { position: relative; }
        .cell-hov:hover { outline: 2px solid #86efac; outline-offset: 1px; z-index: 2; }
        html[data-theme="light"] .cell-hov:hover { outline-color: #4ade80; }

        /* v7.8 — nền chung cho giao diện Sáng (phần còn lại do LIGHT_CSS đảo màu các class Tailwind) */
        html[data-theme="light"] body { background: #f1f5f9; color: #0f172a; }

        /* v7.8 — BOD chỉ xem: ẩn hẳn nút / ô thêm-sửa-xoá-lưu; nút trạng thái (Đang mở, Đang chấm công, công tắc) chỉ hiển thị, không bấm được */
        .artius-ro button:has(> svg.lucide-pencil), .artius-ro button:has(> svg.lucide-trash2), .artius-ro button:has(> svg.lucide-trash-2),
        .artius-ro button:has(> svg.lucide-plus), .artius-ro button:has(> svg.lucide-x), .artius-ro button:has(> svg.lucide-eye-off),
        .artius-ro button:has(> svg.lucide-eye), .artius-ro button:has(> svg.lucide-save), .artius-ro button:has(> svg.lucide-send),
        .artius-ro button:has(> svg.lucide-rotate-ccw), .artius-ro .ro-hide,
        .artius-ro div:has(> input[placeholder="Mã DA"]), .artius-ro div:has(> input[placeholder$="rồi Enter"]),
        .artius-ro div:has(> input[placeholder^="Mã, ví dụ"]), .artius-ro div:has(> input[placeholder^="Quốc khánh"]),
        .artius-ro div:has(> input[placeholder^="Gõ XOA"]), .artius-ro div:has(> textarea),
        .artius-ro div:has(> label > input[type="checkbox"]) { display: none !important; }
        .artius-ro button:has(> svg.lucide-lock), .artius-ro button:has(> svg.lucide-lock-open), .artius-ro button.appearance-none.rounded-full,
        .artius-ro .ro-static { pointer-events: none; }
        html[data-theme="light"] ::selection { background: #99f6e4; color: #0f172a; }
      `}{LIGHT_CSS}</style>
      {/* v7.5: bỏ thanh menu dọc bên trái trên máy tính — tab chuyển lên header (tab ngang) */}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-800">
          {/* v7.6: header full màn hình (bỏ giới hạn 1520px của v7.5) */}
          <div className="relative flex w-full items-center justify-between px-4 py-3 md:px-6 md:py-3.5">
            <div className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-4">
              {/* v7.5: tab ngang (máy tính). Màn hẹp chỉ hiện icon (rê chuột xem tên); chữ hiện từ xl (≤ 4 tab) / 2xl (Admin 6 tab) để không đè logo giữa */}
              {me && !isMgr && (
                <nav className="hidden items-center gap-0.5 rounded-xl border border-slate-800 bg-slate-900/60 p-1 md:flex">
                  {railItems.map(([k, label, Icon]) => (
                    <button key={k} onClick={() => go(k)} title={label}
                      className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${tab === k ? "bg-teal-500/15 text-teal-200 ring-1 ring-inset ring-teal-500/40" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"}`}>
                      <Icon size={16} className="shrink-0" />
                      <span className={`whitespace-nowrap ${railItems.length > 4 ? "hidden 2xl:inline" : "hidden xl:inline"}`}>{label}</span>
                    </button>
                  ))}
                </nav>
              )}
              <span className={`font-mono text-sm tracking-[0.3em] text-slate-100 ${me ? "md:hidden" : ""}`}>ARTIUS</span>
              {/* máy tính đã đăng nhập: tên trang thể hiện bằng tab đang chọn → ẩn dòng tiêu đề; điện thoại giữ như cũ */}
              <span className={`truncate text-xs text-slate-500 ${me && !isMgr ? "md:hidden" : ""}`}>{me ? pageTitle : "Quản lý giờ công dự án"}</span>
            </div>
            {/* logo chữ ở giữa header = giữa cửa sổ trình duyệt */}
            {me && <BrandLogo className="pointer-events-none absolute left-1/2 top-1/2 hidden h-9 w-auto -translate-x-1/2 -translate-y-1/2 md:block" />}
            <div className="flex min-w-0 items-center">
              <InstallButton />
              <ThemeToggle />
              {me?.type === "bod" && ["dash", "sheet", "proj", "emp", "task", "set"].includes(tab) && (
                <span className="ml-3 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-violet-900 bg-violet-950/60 px-2 py-1 text-[11px] text-violet-200" title="Tài khoản BOD xem được mục này nhưng không chỉnh sửa được">
                  <Eye size={12} /> Chế độ chỉ xem
                </span>
              )}
              {me && <span className="ml-3 shrink-0 truncate text-xs text-slate-400">{myEmp?.name || who.username}</span>}
              {me && !isMgr && <span className="ml-3 hidden select-none font-mono text-[10px] text-slate-600 md:inline">{APP_VERSION}</span>}
              {me && !isMgr && (
                <button onClick={signOut} title="Thoát khỏi app" className="ml-3 hidden h-9 items-center gap-1.5 rounded-lg border border-rose-900/80 bg-rose-950/50 px-3 text-sm text-rose-300 transition-colors hover:border-rose-600 hover:bg-rose-900/60 hover:text-rose-100 md:flex">
                  <LogOut size={15} /> Thoát
                </button>
              )}
            </div>
          </div>
        </header>

        {/* v7.6: quản lý — menu dọc dạng thẻ bám mép trái khung nội dung (full màn hình); nhân viên — "contents" giữ bố cục v7.5 */}
        <div className={isMgr ? "flex min-w-0 flex-1 md:gap-5 md:px-6 md:pt-5" : "contents"}>
        {isMgr && (
          <nav className="sticky top-5 hidden h-fit w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 p-2 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)] md:flex">
            {railItems.map(([k, label, Icon]) => (
              <button key={k} onClick={() => go(k)} title={label}
                className={`flex w-full flex-col items-center gap-1 rounded-xl py-2.5 transition-colors ${tab === k ? "bg-teal-500/15 text-teal-200 ring-1 ring-inset ring-teal-500/40" : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"}`}>
                <Icon size={18} />
                <span className="w-full truncate px-0.5 text-center text-[10px] leading-none">{label}</span>
              </button>
            ))}
            <div className="my-1 h-px w-8 bg-slate-800" />
            <button onClick={signOut} title="Thoát khỏi app" className="flex w-full flex-col items-center gap-1 rounded-xl border border-rose-900/80 bg-rose-950/50 py-2.5 text-rose-300 transition-colors hover:border-rose-600 hover:bg-rose-900/60 hover:text-rose-100">
              <LogOut size={18} />
              <span className="text-[10px] leading-none">Thoát</span>
            </button>
            <div className="mt-1 select-none font-mono text-[9px] text-slate-600">{APP_VERSION}</div>
          </nav>
        )}
        <main className={`min-w-0 flex-1 px-3 pb-28 pt-4 ${isMgr ? "md:px-0 md:pb-24 md:pt-0" : "md:px-6 md:pb-24 md:pt-5"}`}>
          <ConfirmDialog
            open={pendingTab !== null}
            title="Rời khỏi bảng công khi chưa lưu?"
desc={me?.type === "admin" || (me?.type === "head" && tab === "sheet") ? "Giờ vừa sửa sẽ mất. Bấm Giữ lại để quay về bảng công và bấm Lưu trước." : "Giờ bạn vừa nhập chưa gửi nên sẽ mất. Bấm Giữ lại để quay về bảng công và bấm Gửi trước."}
            confirmLabel="Rời đi, bỏ thay đổi"
            onConfirm={() => { setSheetDirty(false); setTab(pendingTab); setPendingTab(null); }}
            onCancel={() => setPendingTab(null)}
          />
          <StorageBanner />

          {!who ? <SignIn onSignedIn={enter} flash={flash} />
            : !me ? (
              <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 md:mt-10 md:p-6">
                <div className="flex items-center gap-2 text-sm text-rose-300"><AlertTriangle size={16} className="shrink-0" />
                  {orphan ? "Tài khoản này chưa gắn với nhân sự nào." : "Không tải được dữ liệu."}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {loadFailed ? <button onClick={() => enter(who)} className={btnPrimary}><RotateCcw size={14} /> Thử lại</button> : <span />}
                  <button onClick={signOut} className={btnGhost}><LogOut size={14} /> Đăng xuất</button>
                </div>
              </div>
            )
            : me.type === "bod" ? (
              <>
                {tab === "dash" && <Dashboard cfg={cfg} saveCfg={bodSave} flash={flash} />}
                {tab === "sheet" && <AdminTimesheet cfg={cfg} flash={flash} onDirtyChange={setSheetDirty} readOnly />}
                {/* v7.7 — BOD xem được mọi mục quản lý nhưng không sửa: mọi lệnh lưu cấu hình bị chặn bởi bodSave */}
                {tab === "proj" && <ReadOnlyView><Projects cfg={cfg} saveCfg={bodSave} flash={flash} /></ReadOnlyView>}
                {tab === "emp" && <ReadOnlyView><Employees cfg={cfg} saveCfg={bodSave} flash={flash} readOnly /></ReadOnlyView>}
                {tab === "task" && <ReadOnlyView><Tasks cfg={cfg} saveCfg={bodSave} flash={flash} /></ReadOnlyView>}
                {tab === "set" && <ReadOnlyView><SettingsTab cfg={cfg} saveCfg={bodSave} flash={flash} /></ReadOnlyView>}
                {tab === "ts" && me.empId && <EmployeeArea key={tsMonday || "now"} cfg={cfg} empId={me.empId} flash={flash} onDirtyChange={setSheetDirty} initialMonday={tsMonday} />}
                {tab === "eset" && me.empId && <EmployeeSettings cfg={cfg} empId={me.empId} />}
              </>
            )
            : me.type === "admin" ? (
              <>
                {tab === "dash" && <Dashboard cfg={cfg} saveCfg={saveCfg} flash={flash} />}
                {tab === "sheet" && <AdminTimesheet cfg={cfg} flash={flash} onDirtyChange={setSheetDirty} />}
                {tab === "proj" && <Projects cfg={cfg} saveCfg={saveCfg} flash={flash} />}
                {tab === "emp" && <Employees cfg={cfg} saveCfg={saveCfg} flash={flash} />}
                {tab === "task" && <Tasks cfg={cfg} saveCfg={saveCfg} flash={flash} />}
                {tab === "set" && <SettingsTab cfg={cfg} saveCfg={saveCfg} flash={flash} />}
              </>
            ) : (
              <>
                {tab === "ts" && <EmployeeArea key={tsMonday || "now"} cfg={cfg} empId={me.empId} flash={flash} onDirtyChange={setSheetDirty} initialMonday={tsMonday} />}
                {tab === "edash" && <EmployeeDashboard cfg={cfg} empId={me.empId} onGoTimesheet={(mon) => { setTsMonday(mon || null); setTab("ts"); }} />}
                {tab === "eset" && <EmployeeSettings cfg={cfg} empId={me.empId} />}
                {tab === "sheet" && me.type === "head" && headCfg && <AdminTimesheet cfg={headCfg} flash={flash} onDirtyChange={setSheetDirty} oneDept />}
              </>
            )}
        </main>
        </div>
      </div>

      {me && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-800 bg-slate-950 md:hidden">
          {railItems.map(([k, label, Icon]) => (
            <button key={k} onClick={() => go(k)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 ${tab === k ? "text-teal-400" : "text-slate-500"}`}>
              <Icon size={19} /><span className="text-[10px] leading-none">{label}</span>
            </button>
          ))}
          <button onClick={signOut} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-rose-400">
            <LogOut size={19} /><span className="text-[10px] leading-none">Thoát</span>
          </button>
        </nav>
      )}

      {/* Ghi chú phiên bản: màn đăng nhập thì ở góc trái dưới; đã đăng nhập thì nằm trên header cạnh tên (máy tính, v7.5), ẩn trên mobile */}
      {!me && (
        <div className="pointer-events-none fixed bottom-1.5 left-2 z-30 select-none font-mono text-[10px] text-slate-600">
          ARTIUS {APP_VERSION}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 w-max max-w-[92vw] -translate-x-1/2 md:bottom-6">
          <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white shadow-xl ${toast.kind === "err" ? "bg-rose-600" : "bg-teal-600"}`}>
            {toast.kind === "err" ? <AlertTriangle size={15} className="shrink-0" /> : <CheckCircle2 size={15} className="shrink-0" />}{toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

/* Cảnh báo về sức khoẻ lưu trữ: sắp chạm hạn mức lệnh, hoặc đã chạm và cần tải lại trang */
function StorageBanner() {
  const { limited } = useStorageHealth();
  const net = useNet();
  if (!net) return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-900 bg-amber-950 p-3 text-sm text-amber-100 md:mb-4" role="status">
      <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-amber-400" />
      <div><b>Mất kết nối tới máy chủ — đang thử lại.</b> Giờ đang nhập vẫn giữ trên màn hình; có mạng lại app tự gửi phần đang chờ.</div>
    </div>
  );

  if (!STORAGE_OK) return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100 md:mb-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
      <div><b>Không truy cập được bộ nhớ lưu trữ.</b> Mọi thứ bạn nhập sẽ mất khi tải lại trang. Thử mở app ở tab trình duyệt thường và bật cookie cho trang này.</div>
    </div>
  );

  if (limited) return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100 md:mb-4">
      <AlertTriangle size={18} className="shrink-0 text-rose-400" />
      <div className="min-w-0 flex-1">
        <b>Đã chạm hạn mức lệnh của phiên làm việc.</b> Không lưu được nữa cho tới khi tải lại trang.
        Nếu đang có giờ chưa lưu, chụp màn hình lại trước khi tải lại.
      </div>
      <button onClick={() => window.location.reload()} className={`shrink-0 ${btnDanger}`}>
        <RotateCcw size={14} /> Tải lại trang
      </button>
    </div>
  );

  return null;
}

/* Ghi chú của một dòng — mở bằng nút "…" thay vì chiếm hẳn một cột trong bảng */
const NUDGE_GAP_MIN = 30;   // v7.7: khoảng cách tối thiểu giữa hai lần bấm chuông nhắc cho cùng một người (phút)

/* v7.7 — Khung "chỉ xem" cho BOD (nhãn "Chế độ chỉ xem" hiện ở header cạnh tên tài khoản): ô nhập/chọn không thao tác được; lưu cấu hình đã bị chặn ở bodSave */
function ReadOnlyView({ children }) {
  return (
    <div>
      <div className="artius-ro [&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none">{children}</div>
    </div>
  );
}

function NoteDialog({ open, title, value, readOnly, onSave, onClose }) {
  const [text, setText] = useState(value || "");
  useEffect(() => { if (open) setText(value || ""); }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-sm font-semibold text-slate-50">Mô tả thêm</h4>
        <p className="mt-0.5 truncate text-xs text-slate-500">{title}</p>
        <textarea autoFocus rows={5} value={text} readOnly={readOnly}
          onChange={(e) => setText(e.target.value)}
          placeholder="Làm gì cụ thể, vướng mắc, đầu việc phát sinh…"
          className="mt-3 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-teal-500 focus:outline-none" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className={btnGhost}>Đóng</button>
          <button onClick={() => onSave(text)} disabled={readOnly} className={`${btnPrimary} disabled:opacity-40`}><Check size={14} /> Lưu mô tả</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ SIGN IN ============================ */
const LAST_USER_KEY = "artius:last-user";
function SignIn({ onSignedIn, flash }) {
  const [mode, setMode] = useState(null);       // null = đang kiểm tra | "login" | "setup" (chưa có tài khoản nào)
  const [needPin, setNeedPin] = useState(false);
  // v4.1: nhớ tên đăng nhập lần trước trên máy này (không nhớ mật khẩu — việc đó để trình duyệt lo)
  const [username, setUsername] = useState(() => { try { return localStorage.getItem(LAST_USER_KEY) || ""; } catch { return ""; } });
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const st = await accountsApi("status");
        if (!alive) return;
        setNeedPin(!!st.needPin); setMode(st.hasAccounts ? "login" : "setup");
      } catch (e) {
        if (!alive) return;
        setMode("login"); flash(e.message, "err");
      }
    })();
    return () => { alive = false; };
  }, [flash]);

  const login = async () => {
    askPermission();   // v2.6: phải gọi ngay trong cú bấm để trình duyệt hiện hộp "Cho phép thông báo"
    if (busy) return;
    if (!username.trim() || !password) return flash("Nhập tên đăng nhập và mật khẩu.", "err");
    setBusy(true);
    try {
      const w = await authSignIn(username, password);
      try { localStorage.setItem(LAST_USER_KEY, normUsername(username)); } catch { /* bỏ qua */ }
      await onSignedIn(w);
    }
    catch (e) { flash(e.message, "err"); setBusy(false); }
  };

  /* Lần đầu sau khi nâng cấp: chưa có tài khoản nào, người nắm mã PIN quản lý cũ tạo tài khoản quản lý */
  const setup = async () => {
    askPermission();
    if (busy) return;
    const u = normUsername(username);
    if (!USERNAME_RE.test(u)) return flash("Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch.", "err");
    if (password.length < PASSWORD_MIN) return flash(`Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.`, "err");
    setBusy(true);
    try {
      await accountsApi("bootstrap", { username: u, password, pin });
      await onSignedIn(await authSignIn(u, password));
    } catch (e) { flash(e.message, "err"); setBusy(false); }
  };

  const submit = mode === "setup" ? setup : login;
  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <div className="mx-auto mt-6 max-w-md md:mt-10">
      {/* v7.4: logo lớn trên màn đăng nhập (máy tính) */}
      <BrandLogo className="mx-auto mb-8 hidden h-24 w-auto md:block" />
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 md:p-6">
        <h1 className="text-lg font-semibold text-slate-50">{mode === "setup" ? "Tạo tài khoản quản lý" : "Đăng nhập"}</h1>
        {mode === null ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} /> Đang kiểm tra…</div>
        ) : (
          <div className="mt-5 space-y-3">
            <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onEnter}
              placeholder="Tên đăng nhập" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className={inputCls} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnter}
              placeholder="Mật khẩu" autoComplete={mode === "setup" ? "new-password" : "current-password"}
              className={inputCls} />
            {mode === "setup" && needPin && (
              <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={onEnter}
                placeholder="Mã PIN quản lý hiện tại" autoComplete="off" className={`font-mono ${inputCls}`} />
            )}
            <button onClick={submit} disabled={busy} className={`w-full ${btnPrimary} disabled:opacity-50`}>
              {busy ? <Loader2 className="animate-spin" size={15} /> : <Lock size={14} />} {mode === "setup" ? "Tạo và đăng nhập" : "Đăng nhập"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ EMPLOYEE ============================ */
function EmployeeArea({ cfg, empId, flash, admin = false, onDirtyChange, initialMonday = null }) {
  const emp = cfg.employees.find((e) => e.id === empId);
  // v2.6: bấm thông báo nhắc thì mở thẳng tuần cần gửi (?tuan=YYYY-MM-DD), đọc xong xoá khỏi thanh địa chỉ
  const [monday, setMonday] = useState(() => {
    if (initialMonday) return initialMonday;   // v5.9: mở từ Tổng quan bảng công → đúng tuần đang xem
    const t = new URLSearchParams(window.location.search).get("tuan") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      try { window.history.replaceState(null, "", window.location.pathname); } catch { /* bỏ qua */ }
      return fmt(mondayOf(parseD(t)));
    }
    return fmt(mondayOf(new Date()));
  });
  const [buckets, setBuckets] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeDay, setActiveDay] = useState(fmt(new Date()));
  const [pendingWeek, setPendingWeek] = useState(null);   // v1.9: tuần muốn chuyển tới khi còn giờ chưa gửi, chờ xác nhận
  const [askSubmit, setAskSubmit] = useState(false);      // v1.9: hỏi lại trước khi gửi, vì gửi xong là khoá
  const [reloadKey, setReloadKey] = useState(0);          // v1.9: tăng khi dữ liệu của người này vừa đổi trên server
  const dataTick = useDataTick();
  const [copying, setCopying] = useState(false);
  const [savedTick, setSavedTick] = useState(0); // tăng sau mỗi lần lưu thành công, dùng làm tín hiệu làm mới lịch
  const [saveFailed, setSaveFailed] = useState(false);
  const mobileInputs = useRef([]);              // ô nhập giờ của từng dòng trên mobile
  const [noteRow, setNoteRow] = useState(null); // chỉ số dòng đang mở hộp mô tả
  const gridInputs = useRef({});                // ô nhập trên lưới desktop, khoá "dòng:cột"
  const taskSel = useRef({});                   // ô chọn hạng mục của từng dòng, để nhảy con trỏ vào sau khi bấm +
  const otSel = useRef({});                     // v4.9: ô "Tăng ca cho tác vụ" của từng dòng tăng ca
  // báo lên App để chặn đổi tab khi còn thay đổi chưa lưu
  const [undoRow, setUndoRow] = useState(null);
  const [showSplit, setShowSplit] = useState(false); // v3.7: chân bảng — mở/thu gọn 3 hàng Giờ chuẩn · OT · Giờ cố gắng // khối/dòng vừa xoá { rows, at, label }, giữ lại để hoàn tác
  /* v3.2 — khối đang MỞ (đang nhập giờ): hiện toàn bộ hạng mục của dự án để gõ giờ thẳng vào, không chọn từ danh sách.
     Bấm ✓ thì khối thu gọn, chỉ giữ hạng mục có giờ, và giờ được tạm lưu trên máy (localStorage) tới khi Gửi. */
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [q, setQ] = useState("");               // ô thêm nhanh: chuỗi đang gõ
  const [qOpen, setQOpen] = useState(false);
  const [qIdx, setQIdx] = useState(0);          // mục đang được chọn trong danh sách gợi ý
  const [qProj, setQProj] = useState("");       // lọc theo dự án, rỗng = tất cả
  const [qPhase, setQPhase] = useState(null);   // lọc theo giai đoạn, null = để guessPhase tự đoán
  const qInput = useRef(null);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidayMap = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const holidaySet = holidayMap; // cùng một bộ tra cứu, có sẵn cả has() lẫn get()

  const days = useMemo(() => weekDays(monday), [monday]);
  const yms = useMemo(() => [...new Set(days.map(ymOf))], [days]);
  const isSent = (d) => !!buckets[ymOf(d)]?.sent?.[d];
  const dayLocked = (d) => !admin && isSent(d);
  /* v2.3 — Nhân sự không chấm giờ làm việc cho ngày chưa tới (sau hôm nay). Vắng mặt (nghỉ phép…) thì vẫn
     đăng ký trước được. Quản lý không bị giới hạn. Database cũng chặn (artius_ts_guard). */
  const todayKey = fmt(new Date());
  const futureBlocked = (r, d) => !admin && d > todayKey && !isLeaveTask(r.taskId);
  // v2.7 — cột hôm nay nền sáng hơn một chút, ngày tương lai mờ đi; ngày đã qua giữ nguyên
  const dayCol = (d) => (d === todayKey ? "bg-slate-800/70" : d > todayKey ? "opacity-50" : "");
  const sendTotal = (d) => rows.reduce((s, r) => s + (futureBlocked(r, d) ? 0 : (r.days[d] || 0)), 0);
  /* v1.9 — Dự án đã đóng (hoặc đã xoá) thì nhân sự không chấm công vào được nữa: dòng của dự án đó chỉ để xem.
     Cần chấm thêm thì quản lý mở lại dự án. Quản lý vẫn sửa được ở Chi tiết nhân viên. Database cũng chặn. */
  /* v2.5 — Nhân sự chỉ chấm vào giai đoạn ĐÃ CÓ giờ dự kiến (> 0) của dự án. Giai đoạn chưa nhập giờ dự kiến thì không hiện;
     dự án chưa nhập giờ dự kiến ở giai đoạn nào thì không hiện. Dòng cũ rơi vào giai đoạn đó chỉ để xem, giống dự án đã đóng.
     Quản lý không bị giới hạn. Database cũng chặn (artius_ts_guard). */
  const phaseOpen = (pid, ph) => !!phaseInfo(ph)?.active && (admin || projPhaseIsOpen(cfg.projects.find((p) => p.id === pid), ph));
  // giai đoạn quản lý đang mở của dự án (không tính quyền quản lý) — dùng để tự chọn sẵn giai đoạn khi chọn dự án
  const setOpenPhases = (pid) => activePhases().filter((ph) => projPhaseIsOpen(cfg.projects.find((p) => p.id === pid), ph.id));
  const openPhasesOf = (pid) => activePhases().filter((ph) => phaseOpen(pid, ph.id));
  const fitPhase = (pid, ph) => (pid === NO_PROJECT || phaseOpen(pid, ph) ? ph : openPhasesOf(pid)[0]?.id || ph);
  const projClosed = (r) => !admin && r.projectId !== NO_PROJECT && r.projectId !== ""
    && (!cfg.projects.some((p) => p.id === r.projectId && p.active) || (r.phaseId !== NO_PHASE && !phaseOpen(r.projectId, r.phaseId || DEFAULT_PHASE)));
  // v3.0 — dòng đã chọn đủ Dự án (+ Giai đoạn nếu là dự án) + Hạng mục thì mới nhập giờ / lưu được
  // v3.1: dự án chỉ mở đúng một giai đoạn và khối đang ở giai đoạn đó → nhân sự không cần (không được) đổi
  const phaseFixed = (g) => { if (admin) return false; const o = openPhasesOf(g.projectId); return o.length === 1 && o[0].id === g.phaseId; };
  /* v4.9: dòng tăng ca phải chọn "Tăng ca cho tác vụ" (otFor) mới nhập giờ / gửi được.
     Quản lý vẫn sửa được dòng tăng ca cũ (trước v4.9, chưa có otFor) đang có giờ. */
  const rowReady = (r) => r.projectId !== "" && !!r.taskId && (r.projectId === NO_PROJECT || r.phaseId !== NO_PHASE)
    && (!isOtId(r.taskId) || !!r.otFor || (admin && days.some((d) => (r.days[d] || 0) > 0)));
  const dayTotal = (d) => rows.reduce((s, r) => s + (r.days[d] || 0), 0);
  const dayName = (d) => `${DOW[(parseD(d).getDay() + 6) % 7]} ${dLabel(d)}`;
  /* v6.9 — nhân sự chỉ thấy các dự án quản lý đã giao (Nhân sự → "Dự án đang tham gia"). Chưa giao dự án nào = chỉ chấm Việc chung / vắng mặt.
     Quản lý sửa bảng công của người khác thì vẫn thấy mọi dự án. Dòng cũ của dự án không còn được giao vẫn hiện để xem / sửa giờ đã có. */
  const assignedP = new Set(Array.isArray(emp?.projects) ? emp.projects : []);
  const activeProjects = cfg.projects.filter((p) => p.active && (admin || (openPhasesOf(p.id).length > 0 && assignedP.has(p.id))));
  // Chỉ hiện hạng mục thuộc bộ phận của nhân sự — bớt danh sách dài và tránh chấm nhầm việc của bộ phận khác
  const myTasks = useMemo(() => tasksForDept(cfg.tasks, emp?.dept, emp?.role), [cfg.tasks, emp?.dept, emp?.role]);
  /* v2.9 — "Khác" (projectId = NO_PROJECT, không có giai đoạn) gồm tác vụ chung của công ty (không gắn vai trò) và vắng mặt.
     Dự án thật chỉ chọn được tác vụ gắn vai trò. Giờ cũ đã chấm tác vụ chung dưới một dự án vẫn giữ nguyên. */
  const commonIds = useMemo(() => new Set(cfg.tasks.filter((t) => taskRoles(t).length === 0).map((t) => t.id)), [cfg.tasks]);
  const isKhacTask = (id) => isLeaveTask(id) || commonIds.has(id);
  const commonTasks = myTasks.filter((t) => commonIds.has(t.id));
  const taskOrder = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t, k) => [t.id, k])), [cfg.tasks]);
  const projTasks = myTasks.filter((t) => !commonIds.has(t.id));
  // v4.9: khung giờ tăng ca (hạng mục [OT]) và các tác vụ dự án chọn được làm "Tăng ca cho tác vụ"
  const otBands = otBandTasks();   // v6.3: khung giờ chung từ Thiết lập → Tăng ca, mọi vai trò như nhau
  const otTargets = projTasks.filter((t) => !isOtTask(t));
  const taskById = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes, cfg.otBands, cfg.otLegacy]);
  const projName = (id) => cfg.projects.find((p) => p.id === id)?.name || "(dự án đã xoá)";
  // Tên kèm mã, dùng ở chỗ cần nhận diện nhanh bằng mã số
  const projFull = (id) => { if (id === NO_PROJECT) return "Khác"; const p = cfg.projects.find((x) => x.id === id); return p ? `${p.code ? `[${p.code}] ` : ""}${p.name}` : "(dự án đã xoá)"; };
  const taskName = (id) => { const t = taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  /* ---------- v3.2: khối mở / thu gọn ---------- */
  const poolFor = (pid) => (pid === NO_PROJECT ? [...commonTasks, ...LEAVE_TASKS] : projTasks);
  const rowHasHours = (r) => days.some((d) => (r.days[d] || 0) > 0);
  const canClear = (r) => !projClosed(r) && days.some((d) => r.days[d] > 0 && !dayLocked(d) && !futureBlocked(r, d));
  // Bảo đảm mọi hạng mục của dự án đều có dòng trong các khối `keys` (dòng trống chưa có giờ), theo đúng thứ tự danh sách tác vụ
  const expandIn = (list, keys) => {
    const out = []; const done = new Set();
    for (const r of list) {
      const k = groupKey(r);
      if (!keys.has(k) || r.projectId === "") { out.push(r); continue; }
      if (done.has(k)) continue;
      done.add(k);
      const mine = list.filter((x) => groupKey(x) === k);
      if (projClosed(r)) { out.push(...mine); continue; }
      const pool = poolFor(r.projectId).filter((t) => !isOtTask(t));   // v4.9: dòng tăng ca chỉ tạo bằng nút "+ Thêm dòng tăng ca"
      const byTask = new Map(mine.filter((x) => !isOtId(x.taskId)).map((x) => [x.taskId, x]));
      for (const t of pool) out.push(byTask.get(t.id) || { projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: t.id, note: "", days: {} });
      for (const x of mine) if (isOtId(x.taskId) || !pool.some((t) => t.id === x.taskId)) out.push(x);   // dòng tăng ca + hạng mục cũ ngoài danh sách vẫn giữ
    }
    return out;
  };
  // Thu gọn: bỏ các dòng chưa có giờ trong những khối `keys`
  const collapseIn = (list, keys) => list.filter((r) => !keys.has(groupKey(r)) || r.projectId === "" || rowHasHours(r));
  // Tạm lưu trên máy này: chỉ giờ của ngày chưa gửi. Gửi thành công thì xoá. Quản lý không dùng.
  const draftKeyOf = (m) => `artius_draft_${empId}_${m}`;
  const writeDraft = (list) => {
    if (admin) return;
    try {
      const keep = list.filter((r) => rowReady(r) && days.some((d) => !isSent(d) && r.days[d] > 0))
        .map((r) => ({ projectId: r.projectId, phaseId: r.phaseId, taskId: r.taskId, ...(r.otFor ? { otFor: r.otFor } : {}), note: r.note || "", days: r.days }));
      if (keep.length) localStorage.setItem(draftKeyOf(monday), JSON.stringify(keep));
      else localStorage.removeItem(draftKeyOf(monday));
    } catch { /* trình duyệt chặn lưu trữ: vẫn giữ trên màn hình như cũ */ }
  };
  const doneGroup = (gk) => {
    const g0 = rows.find((r) => groupKey(r) === gk);
    const next = collapseIn(rows, new Set([gk]));
    setRows(next);
    setOpenKeys((s) => { const n = new Set(s); n.delete(gk); return n; });
    gridInputs.current = {}; mobileInputs.current = [];
    writeDraft(next);
    if (!next.some((r) => groupKey(r) === gk)) flash("Khối này chưa có giờ nào nên đã bỏ khỏi bảng.", "err");
    else flash(`Đã tạm lưu giờ ${g0 ? projFull(g0.projectId) : ""}. Thêm tác vụ cho dự án khác, xong hết thì bấm Gửi giờ công.`);
  };
  const editGroup = (gk) => {
    setRows(expandIn(rows, new Set([gk])));
    setOpenKeys((s) => new Set([...s, gk]));
  };
  const delGroup = (gk) => {
    const at = rows.findIndex((r) => groupKey(r) === gk);
    const mine = rows.filter((r) => groupKey(r) === gk);
    const next = rows.filter((r) => groupKey(r) !== gk);
    if (mine.some(rowHasHours)) setUndoRow({ rows: mine, at, label: projFull(mine[0].projectId), open: openKeys.has(gk) });
    setRows(next);
    setOpenKeys((s) => { const n = new Set(s); n.delete(gk); return n; });
    gridInputs.current = {}; mobileInputs.current = [];
    writeDraft(next);
    setDirty(true);
  };
  // Nhóm hiển thị trong một khối: dự án → Công việc dự án / Tăng ca; Khác → Công việc chung / Vắng mặt
  const sectionsOf = (g, open = false) => {
    const khac = g.projectId === NO_PROJECT;
    const s2 = khac
      ? [{ label: "Công việc chung", chip: "#2dd4bf", items: [] }, { label: "Vắng mặt", chip: "#38bdf8", items: [] }]
      : [{ label: "Công việc dự án", noHead: true, items: [] }, { label: "Tăng ca", ot: true, items: [] }];   // v6.2: bỏ chữ "Công việc dự án"
    for (const it of g.items) {
      const t = taskById.get(it.r.taskId);
      s2[khac ? (isLeaveTask(it.r.taskId) ? 1 : 0) : (isOtTask(t) ? 1 : 0)].items.push(it);
    }
    // v4.4: hạng mục hiện theo thứ tự quản lý sắp ở tab Tác vụ (kéo thả); hạng mục không còn trong danh sách xếp cuối
    for (const x of s2) x.items.sort((a, b) => (taskOrder.get(a.r.taskId) ?? 1e9) - (taskOrder.get(b.r.taskId) ?? 1e9));
    // v4.9: khối dự án đang mở luôn hiện nhóm Tăng ca (kể cả chưa có dòng) để có nút "+ Thêm dòng tăng ca"
    return s2.filter((x) => x.items.length || (open && x.ot && otBands.length > 0));
  };
  // v4.4: mô tả ngắn quản lý ghi cho tác vụ — hiện dưới tên hạng mục khi khối đang mở để nhập giờ
  const rowDesc = (r) => (taskById.get(r.taskId)?.desc || "").trim();
  /* v8.3: dòng tăng ca khi khối đóng — khung giờ thành nhãn teal, tên tác vụ màu chữ thường */
  const rowLabelNode = (r, open) => {
    const t = taskById.get(r.taskId);
    if (!t || !isOtTask(t) || open) return rowLabel(r, open);
    return <><span className="ot-chip mr-1.5 rounded px-2 py-0.5 text-xs font-medium bg-teal-900/60 text-teal-200">Tăng ca {otText(t)}</span><span className="text-slate-100">{r.otFor ? taskName(r.otFor) : "chưa rõ tác vụ"}</span></>;
  };
  const rowLabel = (r, open) => {
    const t = taskById.get(r.taskId);
    if (!t) return "(tác vụ đã xoá)";
    if (isOtTask(t)) return `Tăng ca ${otText(t)} · ${r.otFor ? taskName(r.otFor) : "chưa rõ tác vụ"}`;
    const inPool = poolFor(r.projectId).some((x) => x.id === r.taskId);
    return `${isLeaveTask(r.taskId) ? t.name : taskText(t)}${inPool ? "" : commonIds.has(r.taskId) ? " (tác vụ chung — dữ liệu cũ)" : " (ngoài bộ phận)"}`;
  };

  useEffect(() => { if (!days.includes(activeDay)) setActiveDay(days[0]); }, [monday]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await ensureMonths([...yms, prevYm(yms[0])]);   // tuần cũ hơn 6 tháng: tải tháng đó trước (kể cả tháng trước để Chép tuần trước dùng)
      const loaded = {};
      for (const ym of yms) loaded[ym] = dbTs(empId, ym) || { rows: [], weeks: {} };
      if (!alive) return;
      setBuckets(loaded);
      const map = new Map();
      for (const ym of yms) for (const r of loaded[ym].rows) {
        // dữ liệu cũ chưa có giai đoạn: suy từ nhóm của hạng mục thay vì gán bừa một giá trị
        const phaseId = r.phaseId || guessPhase(r.taskId, cfg.tasks);
        const k = rowKey({ ...r, phaseId });
        const cur = map.get(k) || { projectId: r.projectId, phaseId, taskId: r.taskId, ...(r.otFor ? { otFor: r.otFor } : {}), note: "", days: {} };
        if (r.note && !cur.note) cur.note = r.note; // ghi chú lưu theo dòng, tuần nào cũng dùng chung dòng đó
        for (const d of days) if (r.days?.[d] != null) cur.days[d] = r.days[d];
        map.set(k, cur);
      }
      // v3.2: giờ đã tạm lưu (bấm ✓) trên máy này mà chưa gửi thì khôi phục lại, chỉ cho ngày chưa gửi
      let restored = 0;
      if (!admin) {
        try {
          const dr = JSON.parse(localStorage.getItem(`artius_draft_${empId}_${monday}`) || "null");
          if (Array.isArray(dr)) for (const x of dr) {
            if (!x || typeof x !== "object" || !x.days) continue;
            const k = rowKey(x);
            const cur = map.get(k) || { projectId: x.projectId, phaseId: x.phaseId || DEFAULT_PHASE, taskId: x.taskId, ...(x.otFor ? { otFor: x.otFor } : {}), note: "", days: {} };
            for (const d of days) {
              const v = Number(x.days[d]) || 0;
              if (v > 0 && !loaded[ymOf(d)]?.sent?.[d] && cur.days[d] !== v) { cur.days[d] = v; restored += 1; }
            }
            if (x.note && !cur.note) cur.note = x.note;
            map.set(k, cur);
          }
        } catch { /* bản tạm hỏng: bỏ qua */ }
      }
      const got = sortByGroup([...map.values()].filter((r) => days.some((d) => r.days[d] > 0)));
      /* v8.0 — tuần còn trống: tự mở sẵn một khối "Thêm tác vụ" (Dự án · Giai đoạn · Hạng mục để trống) cho nhân viên chọn ngay,
         không cần bấm nút. Khối trống không tính là "chưa lưu" và không được gửi nếu không nhập giờ. Quản lý sửa hộ thì không tự thêm. */
      setRows(got.length || admin ? got : [{ projectId: "", phaseId: NO_PHASE, taskId: "", note: "", days: {} }]);
      setOpenKeys(new Set()); setUndoRow(null);
      setDirty(restored > 0); setLoading(false);
      if (restored > 0) flash("Đã khôi phục giờ tạm lưu chưa gửi trên máy này. Kiểm tra lại rồi bấm Gửi giờ công.");
    })();
    return () => { alive = false; };
  }, [empId, monday, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* v1.9 — Dữ liệu của đúng người này, đúng các tháng đang xem vừa đổi trên server (ví dụ quản lý vừa mở khoá):
     nạp lại màn hình. Đang nhập dở thì KHÔNG nạp lại, để khỏi mất giờ vừa gõ; lúc bấm Gửi app sẽ đọc lại bản mới nhất. */
  useEffect(() => {
    if (dirty || saving || loading) return;
    const stale = yms.some((ym) => JSON.stringify(dbTs(empId, ym) || { rows: [], weeks: {} }) !== JSON.stringify(buckets[ym] || { rows: [], weeks: {} }));
    if (stale) setReloadKey((k) => k + 1);
  }, [dataTick]); // eslint-disable-line react-hooks/exhaustive-deps


  // Đưa con trỏ về ô giờ đầu tiên của một dòng — dùng chung cho desktop và mobile
  const focusRow = (i, what = "hours") => {
    const el = what === "task" ? taskSel.current[i] : (gridInputs.current[`${i}:0`] || mobileInputs.current[i]);
    if (!el) return;
    el.focus(); el.select?.();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  /* Thêm một dòng từ tổ hợp dự án + giai đoạn + hạng mục.
     Nếu tổ hợp đã có thì KHÔNG tạo dòng thứ hai — vì rowKey trùng nhau sẽ bị gộp lúc tải lại,
     làm giờ công nhảy số. Thay vào đó nhảy tới đúng dòng đang có. */
  const addCombo = (c, focus = "hours") => {
    const key = rowKey({ projectId: c.projectId, phaseId: c.phaseId || DEFAULT_PHASE, taskId: c.taskId });
    const at = rows.findIndex((r) => rowKey(r) === key);
    if (at >= 0) { flash("Dòng này đã có trong tuần, con trỏ đã nhảy tới đó.", "err"); focusRow(at); return; }
    const row = { projectId: c.projectId, phaseId: c.phaseId || DEFAULT_PHASE, taskId: c.taskId, note: "", days: {} };
    // cùng dự án + giai đoạn thì chèn ngay dưới dòng cuối của nhóm đó, không đẩy xuống cuối bảng
    let last = -1;
    rows.forEach((r, k) => { if (groupKey(r) === groupKey(row)) last = k; });
    const at2 = last >= 0 ? last + 1 : rows.length;
    const next = [...rows]; next.splice(at2, 0, row);
    setRows(next);
    setDirty(true); setQ(""); setQOpen(false); setQIdx(0);
    setTimeout(() => focusRow(at2, focus), 30); // đợi React commit xong mới có ô để focus
  };

  /* Nút + ở đầu mỗi khối: thêm một hạng mục nữa vào đúng dự án + giai đoạn đó.
     Chọn sẵn hạng mục đầu tiên chưa dùng trong khối rồi đưa con trỏ vào ô chọn,
     bấm phím là đổi được ngay, không phải quay lại ô tìm kiếm. */
  const addTaskToGroup = (g) => {
    const pool = (g.projectId === NO_PROJECT ? [...commonTasks, ...LEAVE_TASKS] : projTasks).filter((t) => !isOtTask(t));
    const used = new Set(g.items.map(({ r }) => r.taskId));
    const t = pool.find((x) => !used.has(x.id));
    if (!t) return flash("Khối này đã dùng hết hạng mục có thể chọn.", "err");
    addCombo({ projectId: g.projectId, phaseId: g.phaseId, taskId: t.id }, "task");
  };

  /* v4.9 — "+ Thêm dòng tăng ca" trong khối dự án: tạo dòng tăng ca trống (khung giờ đầu tiên chưa có dòng trống),
     nhân sự chọn "Tăng ca cho tác vụ" rồi mới nhập giờ. Mỗi khung giờ chỉ có một dòng trống cùng lúc (tránh trùng rowKey). */
  const addOtRow = (g) => {
    // v5.0: khung giờ lần lượt — dòng thứ nhất là khung đầu (17:30 – 21:00), dòng sau lấy khung kế tiếp, hết thì quay lại từ đầu
    const nOt = rows.filter((r) => groupKey(r) === g.key && isOtId(r.taskId)).length;
    const order = otBands.map((_, k) => otBands[(nOt + k) % otBands.length]);
    const freeBand = order.find((t) => !rows.some((r) => groupKey(r) === g.key && !r.otFor && isOtId(r.taskId) && otBandKey(taskById.get(r.taskId) || t) === otBandKey(t)));
    if (!freeBand) return flash("Chọn tác vụ cho dòng tăng ca đang trống trước đã.", "err");
    const row = { projectId: g.projectId, phaseId: g.phaseId || DEFAULT_PHASE, taskId: freeBand.id, otFor: "", note: "", days: {} };
    let last = -1;
    rows.forEach((r, k) => { if (groupKey(r) === g.key) last = k; });
    const at = last >= 0 ? last + 1 : rows.length;
    const next = [...rows]; next.splice(at, 0, row);
    gridInputs.current = {}; mobileInputs.current = []; taskSel.current = {};
    setRows(next); setDirty(true);
    setTimeout(() => { const el = otSel.current[at]; if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); } }, 30);
  };

  /* v4.9 — hai ô của dòng tăng ca khi khối đang mở: "Tăng ca cho tác vụ" + khung giờ.
     Dòng đang có giờ của ngày đã gửi thì không đổi được (database cũng chặn). */
  const otPickCls = `${CTRL} min-w-0 rounded-md border bg-slate-900 px-2 text-sm focus:border-teal-500 focus:outline-none disabled:opacity-60`;
  const otPickers = (r, i, mobile = false) => {
    const lockedRow = rowLocked(r);
    return (
      <div className={mobile ? "grid grid-cols-[3fr_2fr] gap-2" : "flex min-w-0 flex-1 gap-2"}>
        <select ref={(el) => { otSel.current[i] = el; }} disabled={lockedRow} value={r.otFor || ""} onChange={(e) => upd(i, { otFor: e.target.value })}
          title="Tăng ca cho tác vụ" aria-label="Tăng ca cho tác vụ"
          className={`${otPickCls} ${mobile ? "w-full" : "flex-[3]"} ${r.otFor ? "border-teal-900 text-slate-100" : "border-amber-700/70 text-amber-300"}`}>
          <option value="">Tăng ca cho tác vụ…</option>
          {otTargets.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
          {r.otFor && !otTargets.some((t) => t.id === r.otFor) && <option value={r.otFor}>{taskName(r.otFor)}</option>}
        </select>
        <select disabled={lockedRow} value={r.taskId} onChange={(e) => upd(i, { taskId: e.target.value })}
          title="Khung giờ tăng ca" aria-label="Khung giờ tăng ca"
          className={`${otPickCls} ${mobile ? "w-full" : "flex-[2]"} border-teal-900 text-teal-300`}>
          {(() => {
            // dòng đang giữ hạng mục [OT] của vai trò khác nhưng cùng khung giờ: hiện đúng hạng mục đó ở vị trí khung tương ứng
            const cur = taskById.get(r.taskId), ck = cur ? otBandKey(cur) : "";
            const list = otBands.map((t) => (cur && otBandKey(t) === ck ? cur : t));
            if (cur && !list.some((t) => t.id === cur.id)) list.push(cur);
            return list.map((t) => <option key={t.id} value={t.id}>{otText(t)}</option>);
          })()}
        </select>
      </div>
    );
  };

  // Nút "Thêm dòng" nay chỉ đưa con trỏ về ô thêm nhanh; dòng được tạo từ ô đó hoặc từ chip
  /* v3.0 — "Thêm dòng" tạo một khối TRỐNG ở cuối bảng: Dự án, Giai đoạn, Hạng mục đều để trống, người dùng tự chọn.
     Mỗi lúc chỉ có một khối trống; thêm hạng mục vào khối đã có thì dùng nút + ở đầu khối. */
  const focusQuick = () => {
    if (rows.some((r) => r.projectId === "")) { flash("Chọn dự án cho khối đang trống trước đã.", "err"); return; }
    // v3.2: khối đang mở thì tự bấm ✓ giúp (thu gọn + tạm lưu) trước khi tạo khối mới
    // v8.1: chỉ thu gọn khối đang mở ĐÃ có giờ; khối đang mở chưa nhập giờ nào thì giữ nguyên (vẫn mở) và thêm khối mới bên dưới
    const withHrs = new Set([...openKeys].filter((k) => rows.some((r) => groupKey(r) === k && rowHasHours(r))));
    const base = withHrs.size ? collapseIn(rows, withHrs) : rows;
    if (withHrs.size) writeDraft(base);
    setOpenKeys(new Set([...openKeys].filter((k) => !withHrs.has(k))));
    gridInputs.current = {}; mobileInputs.current = [];
    setRows([...base, { projectId: "", phaseId: NO_PHASE, taskId: "", note: "", days: {} }]); setDirty(true);
  };

  /* Tính dòng mới ngoài setRows rồi mới ghi state — không đặt side effect trong hàm cập nhật,
     vì React có thể gọi hàm đó nhiều lần và flash sẽ bắn sai. */
  const upd = (i, patch) => {
    const cur = rows[i];
    if (!cur) return;
    const next = { ...cur, ...patch };
    // dòng vắng mặt không thuộc dự án nào; chuyển ngược lại thì trả về dự án đầu tiên đang mở
    if (patch.taskId !== undefined) {
      if (isKhacTask(next.taskId) && next.projectId === NO_PROJECT) next.phaseId = DEFAULT_PHASE;
      else if (isLeaveTask(next.taskId)) { next.projectId = NO_PROJECT; next.phaseId = DEFAULT_PHASE; }
      else if (next.projectId === NO_PROJECT && !isKhacTask(next.taskId)) { next.projectId = activeProjects[0]?.id || ""; next.phaseId = fitPhase(next.projectId, next.phaseId || DEFAULT_PHASE); }
    }
    // sửa dropdown thành trùng một dòng khác cũng tạo rowKey trùng — chặn tại đây
    if (rows.some((y, k) => k !== i && rowKey(y) === rowKey(next))) return flash("Đã có dòng cho tổ hợp này rồi.", "err");
    setRows((r) => r.map((x, j) => (j === i ? next : x)));
    setDirty(true);
  };

  /* Chép cơ cấu dòng (dự án + hạng mục + ghi chú) của tuần liền trước sang tuần đang xem.
     Chỉ chép khung, KHÔNG chép số giờ — giờ công vẫn phải tự nhập cho đúng thực tế. */
  const copyPrevWeek = async () => {
    setCopying(true);
    const prevMonday = fmt(addDays(parseD(monday), -7));
    const prevDays = weekDays(prevMonday);
    const prevYms = [...new Set(prevDays.map(ymOf))];
    const found = new Map();
    for (const ym of prevYms) {
      const b = buckets[ym] || dbTs(empId, ym);
      if (!b?.rows) continue;
      for (const r of b.rows) {
        if (!prevDays.some((d) => r.days?.[d] > 0)) continue; // chỉ lấy dòng thực sự có giờ tuần trước
        if (projClosed(r)) continue;                          // dự án đã đóng: nhân sự không chấm tiếp được
        const khac = isKhacTask(r.taskId);   // v2.9: tác vụ chung / vắng mặt chép sang "Khác"
        const projectId = khac ? NO_PROJECT : r.projectId;
        const phaseId = khac ? DEFAULT_PHASE : r.phaseId || guessPhase(r.taskId, cfg.tasks);
        const otFor = !khac && isOtId(r.taskId) && r.otFor ? { otFor: r.otFor } : {};
        found.set(rowKey({ projectId, phaseId, taskId: r.taskId, ...otFor }), { projectId, phaseId, taskId: r.taskId, ...otFor, note: r.note || "", days: {} });
      }
    }
    setCopying(false);
    if (found.size === 0) return flash("Tuần trước chưa chấm công nên không có gì để chép.", "err");
    const have = new Set(rows.map(rowKey));
    const toAdd = [...found.entries()].filter(([k]) => !have.has(k)).map(([, v]) => v);
    if (toAdd.length === 0) return flash("Các dòng của tuần trước đều đã có trong tuần này.");
    // v3.2: các khối vừa chép được mở sẵn, hiện đủ hạng mục để nhập giờ
    const keys = new Set(toAdd.map(groupKey));
    setRows(expandIn(sortByGroup([...rows, ...toAdd]), keys)); setDirty(true);
    setOpenKeys((s) => new Set([...s, ...keys]));
    flash(`Đã chép ${keys.size} khối từ tuần trước. Nhập giờ rồi bấm ✓ ở từng khối.`);
  };
  const setHour = (i, d, v) => {
    const n = v === "" ? undefined : Math.max(0, Math.min(24, Number(v)));
    setRows((r) => r.map((x, j) => (j === i ? { ...x, days: { ...x.days, [d]: n } } : x)));
    setDirty(true);
  };
  const delRow = (i) => {
    setUndoRow({ rows: [rows[i]], at: i, label: `${projName(rows[i].projectId)} · ${taskName(rows[i].taskId)}` });   // giữ lại để hoàn tác
    setRows((r) => r.filter((_, j) => j !== i));
    mobileInputs.current = []; gridInputs.current = {}; taskSel.current = {};
    setDirty(true);
  };
  /* v3.3 — xoá hết giờ của một hạng mục trong tuần (chỉ ngày còn sửa được: chưa gửi, không phải ngày tương lai bị chặn) */
  const clearRow = (i) => {
    const r = rows[i];
    if (!r) return;
    const d2 = { ...r.days };
    let n = 0;
    for (const d of days) if (d2[d] > 0 && !dayLocked(d) && !futureBlocked(r, d)) { delete d2[d]; n += 1; }
    if (!n) return;
    setUndoRow({ kind: "clear", key: rowKey(r), days: r.days, label: `giờ tuần này của ${taskName(r.taskId)}` });
    setRows((rs) => rs.map((x, j) => (j === i ? { ...x, days: d2 } : x)));
    setDirty(true);
  };
  const undoDelete = () => {
    if (!undoRow) return;
    if (undoRow.kind === "clear") {
      setRows((rs) => rs.map((x) => (rowKey(x) === undoRow.key ? { ...x, days: undoRow.days } : x)));
      setUndoRow(null); setDirty(true);
      return;
    }
    const n = [...rows]; n.splice(Math.min(undoRow.at, n.length), 0, ...undoRow.rows);
    const keys = new Set(undoRow.rows.map(groupKey));
    setRows(sortByGroup(undoRow.open ? expandIn(n, keys) : n));
    if (undoRow.open) setOpenKeys((s) => new Set([...s, ...keys]));
    else writeDraft(n);
    setUndoRow(null); setDirty(true);
  };

  // Mũi tên và Enter di chuyển giữa các ô giờ, gõ liền mạch không cần chuột
  const gridKey = (e, i, k) => {
    const move = (di, dk) => {
      const el = gridInputs.current[`${i + di}:${k + dk}`];
      if (!el) return;
      e.preventDefault(); el.focus(); el.select?.();
    };
    if (e.key === "ArrowLeft" && e.target.selectionStart === 0) move(0, -1);
    else if (e.key === "ArrowRight" && e.target.selectionStart === e.target.value.length) move(0, 1);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowDown" || e.key === "Enter") move(1, 0);
  };

  // Điền giờ chuẩn cho cả tuần vào một dòng, chỉ điền ô còn trống
  const fillStandard = (i) => {
    setRows((r) => r.map((x, j) => {
      if (j !== i) return x;
      const d2 = { ...x.days };
      for (const d of days) {
        if (d2[d] > 0 || holidaySet.has(d) || dayLocked(d) || futureBlocked(x, d)) continue;
        const std = stdHoursFor(d, hoursCfg);
        if (std > 0) d2[d] = std;
      }
      return { ...x, days: d2 };
    }));
    setDirty(true);
  };

  /* submitMode: "submit" đánh dấu đã gửi · "unsubmit" gỡ đánh dấu (chỉ quản lý) · null giữ nguyên */
  /* v4.9 — dòng tăng ca: phải chọn tác vụ (với giờ còn ghi được) và mỗi ô không vượt độ dài khung giờ. Trả về câu báo lỗi hoặc null. */
  const otProblem = () => {
    for (const r of rows) {
      if (!isOtId(r.taskId) || projClosed(r)) continue;
      const t = taskById.get(r.taskId);
      const wd = days.filter((d) => (r.days[d] || 0) > 0 && (admin || !isSent(d)));
      if (!wd.length) continue;
      if (!r.otFor && !admin) return `Dòng tăng ca ${otText(t)} chưa chọn "Tăng ca cho tác vụ". Chọn tác vụ trước khi gửi.`;
      const mx = otMaxHours(t), bad = wd.find((d) => r.days[d] > mx);
      if (bad) return `Tăng ca ${otText(t)} ngày ${dayName(bad)}: ${r.days[bad]} giờ vượt độ dài khung giờ (tối đa ${fmtH(mx)} giờ).`;
    }
    return null;
  };
  const save = async (submitMode = null, silent = false) => {
    if (!admin && submitMode !== "submit" && submitMode !== "draft") return false;   // v1.9: nhân sự ghi bằng Gửi; v8.1 thêm Lưu nháp (ghi giờ lên server, chưa gửi)
    if (submitMode === "draft" && !dirty && !rows.some((r) => rowReady(r) && days.some((d) => !isSent(d) && !futureBlocked(r, d) && r.days[d] > 0))) {
      flash("Chưa có giờ nào để lưu nháp.", "err");
      return false;
    }
    const seen = new Set();
    for (const r of rows) {
      const k = rowKey(r);
      if (seen.has(k)) { flash("Có 2 dòng trùng Dự án + Giai đoạn + Hạng mục. Gộp lại giúp em.", "err"); return false; }
      seen.add(k);
    }
    { const msg = otProblem(); if (msg) { flash(msg, "err"); return false; } }
    if (submitMode === "submit" && !days.some((d) => !isSent(d) && sendTotal(d) > 0)) {
      flash("Chưa có giờ mới để gửi. Nhập giờ vào các ngày chưa gửi trước đã.", "err");
      return false;
    }

    setSaving(true);
    /* v1.8: đọc lại đúng các tháng của nhân sự này ngay trước khi ghi, rồi mới chèn giờ của tuần đang sửa
       vào. Không đọc lại được thì dừng, không ghi bản cũ lên server. */
    if (!(await refreshTs(empId, yms))) {
      setSaving(false); setSaveFailed(true);
      flash(`Chưa ghi được — ${LAST_STORAGE_ERROR || "mất kết nối"}`, "err");
      return false;
    }
    const next = { ...buckets };
    for (const ym of yms) next[ym] = dbTs(empId, ym) || { rows: [], weeks: {} };
    const failed = [];
    const newly = [];   // các ngày vừa được đánh dấu đã gửi ở lần ghi này
    const stamp = { at: new Date().toISOString(), by: admin ? "admin" : "emp" };
    for (const ym of yms) {
      const bucket = next[ym] || { rows: [], weeks: {} };
      const sent = { ...(bucket.sent || {}) };
      const daysInYm = days.filter((d) => ymOf(d) === ym);
      /* Nhân sự chỉ ghi được ngày CHƯA gửi (tính theo bản vừa đọc lại từ server); ngày đã gửi giữ nguyên.
         Quản lý ghi được mọi ngày. */
      const writable = admin ? daysInYm : daysInYm.filter((d) => !sent[d]);
      const keep = bucket.rows.map((r) => {
        if (projClosed(r)) return r;                       // giờ của dự án đã đóng giữ nguyên bản trên server
        const dd = { ...r.days }; for (const d of writable) delete dd[d];
        return { ...r, days: dd };
      });
      const map = new Map(keep.map((r) => [rowKey(r), r]));
      for (const r of rows) {
        if (!rowReady(r)) continue;   // v3.0: dòng chưa chọn đủ thì không ghi
        if (projClosed(r)) continue;
        const k = rowKey(r);
        const had = map.get(k);
        const cur = had || { projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, ...(r.otFor ? { otFor: r.otFor } : {}), days: {} };
        // dòng đang giữ giờ của ngày đã gửi thì nhân sự không đổi giai đoạn của nó (database cũng chặn)
        if (admin || !had || !Object.keys(had.days).some((d) => sent[d])) cur.phaseId = r.phaseId || DEFAULT_PHASE;
        cur.note = (r.note || "").trim();
        for (const d of writable) if (r.days[d] > 0 && !futureBlocked(r, d)) cur.days[d] = r.days[d];
        map.set(k, cur);
      }
      const cleaned = [...map.values()].filter((r) => Object.values(r.days).some((v) => v > 0));
      const tot = (d) => cleaned.reduce((a, r) => a + (r.days[d] || 0), 0);
      const weeks = { ...(bucket.weeks || {}) };
      if (submitMode === "submit") for (const d of writable) if (!sent[d] && tot(d) > 0) { sent[d] = stamp; newly.push(d); }
      if (submitMode === "unsubmit") { for (const d of daysInYm) delete sent[d]; delete weeks[monday]; }
      if (admin) for (const d of daysInYm) if (sent[d] && tot(d) === 0) delete sent[d];   // ngày không còn giờ thì không giữ dấu đã gửi
      next[ym] = { rows: cleaned, weeks, sent };
    }
    if (!admin && submitMode === "submit" && newly.length === 0) {
      // các ngày định gửi đã được gửi/khoá từ máy khác trong lúc đang nhập
      setSaving(false); setDirty(false); setReloadKey((k) => k + 1);
      flash("Không có giờ mới nào được ghi: ngày đã gửi trước đó hoặc dự án đã đóng. Màn hình vừa được tải lại.", "err");
      return false;
    }

    // Ghi đúng các dòng (nhân sự, tháng) của tuần này — không đụng tới dữ liệu của ai khác
    const ok = await commitTs(Object.fromEntries(yms.map((ym) => [slot(empId, ym), next[ym]])));
    if (!ok) failed.push(...yms);

    if (failed.length > 0) {
      // giữ nguyên dirty để nút Lưu vẫn sáng và người dùng biết là chưa xong
      setSaving(false);
      setSaveFailed(true);
      flash(
        RATE_LIMITED
          ? "Đã chạm hạn mức lệnh của phiên — tải lại trang rồi nhập lại."
          : `Chưa ghi được — ${LAST_STORAGE_ERROR}`,
        "err"
      );
      return false;
    }

    setBuckets(next); setSaving(false); setDirty(false); setSaveFailed(false); setSavedTick((t) => t + 1);
    if (!admin && (submitMode === "submit" || submitMode === "draft")) { try { localStorage.removeItem(draftKeyOf(monday)); } catch { /* bỏ qua */ } }
    if (submitMode && submitMode !== "draft") setReloadKey((k) => k + 1);   // nạp lại để màn hình khớp đúng bản vừa ghi (lưu nháp: giữ nguyên màn hình đang nhập)
    const sentLabel = newly.sort().map(dayName).join(", ");
    if (!silent) flash(
      submitMode === "draft" ? "Đã lưu nháp lên hệ thống — chưa gửi. Mở trên máy khác vẫn thấy; xong hết thì bấm Gửi giờ công."
        : submitMode === "submit" ? (newly.length === 0 ? "Không có ngày nào mới để đánh dấu." : admin ? `Đã đánh dấu đã gửi: ${sentLabel}.` : `Đã gửi ${sentLabel}. Các ngày này đã khoá.`)
        : submitMode === "unsubmit" ? "Đã mở khoá cả tuần — nhân sự sửa lại được, giờ tuần này tạm chưa tính cho tới khi gửi lại."
        : "Đã lưu thay đổi."
    );
    return true;
  };

  // v3.3: dải Hoàn tác tự ẩn sau 10 giây
  useEffect(() => {
    if (!undoRow) return undefined;
    const t = setTimeout(() => setUndoRow(null), 10000);
    return () => clearTimeout(t);
  }, [undoRow]);
  /* v2.2 — Có mạng lại mà lần ghi trước hỏng và giờ vẫn còn trên màn hình: tự gửi lại đúng thao tác đó. */
  const net = useNet();
  useEffect(() => {
    if (net && saveFailed && dirty && !saving) save(admin ? null : "submit");
  }, [net]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Lối thoát khi không ghi được: chép giờ đã nhập ra dạng chữ để nhập lại ở máy khác,
     thay vì mất công gõ lại từ đầu. */
  const copyEntered = async () => {
    const lines = [`Bảng công ${emp?.name || ""} — tuần ${dLabel(monday)} đến ${dLabel(days[6])}`];
    for (const r of rows) {
      const hrs = days.map((d, i) => (r.days[d] > 0 ? `${DOW[i]} ${r.days[d]}` : null)).filter(Boolean).join(", ");
      if (!hrs) continue;
      lines.push(`- ${projName(r.projectId)} | ${phaseLabel(r.phaseId)} | ${taskName(r.taskId)}: ${hrs}${r.note ? ` (${r.note})` : ""}`);
    }
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flash("Đã chép vào bộ nhớ tạm. Dán vào ghi chú hoặc tin nhắn để giữ lại.");
    } catch {
      flash("Trình duyệt không cho chép tự động. Chụp màn hình lại giúp em.", "err");
    }
  };

  /* Đổi tuần khi còn thay đổi chưa ghi.
     Quản lý: tự lưu trước như cũ. Nhân sự (v1.9, không còn lưu nháp): hỏi lại, vì giờ chưa gửi sẽ mất. */
  const goWeek = async (nextMonday) => {
    if (nextMonday === monday) return;
    if (dirty && admin) { const ok = await save(null, true); if (!ok) return; flash("Đã tự lưu tuần vừa rồi."); }
    else if (atRisk) { setPendingWeek(nextMonday); return; }
    setMonday(nextMonday);
  };
  // v4.1: thông báo nhắc được bấm khi đang ở màn này → chuyển tới tuần cần gửi qua goWeek (giữ nguyên bước hỏi lại)
  const goWeekRef = useRef(goWeek);
  goWeekRef.current = goWeek;
  useEffect(() => {
    const h = (e) => { const t = e.detail; if (/^\d{4}-\d{2}-\d{2}$/.test(t)) goWeekRef.current(fmt(mondayOf(parseD(t)))); };
    window.addEventListener("artius:tuan", h);
    return () => window.removeEventListener("artius:tuan", h);
  }, []);
  const askSubmitWeek = () => {
    if (toSend.length === 0) return flash("Chưa có giờ mới để gửi. Nhập giờ vào các ngày chưa gửi (tới hôm nay) trước đã.", "err");
    const msg = otProblem();   // v4.9: báo lỗi dòng tăng ca trước khi hỏi xác nhận gửi
    if (msg) return flash(msg, "err");
    setAskSubmit(true);
  };

  /* Gom dòng thành nhóm để render. Mỗi mục giữ lại chỉ số gốc `i` trong mảng rows
     để ref ô nhập, điều hướng phím và xoá dòng không phải đổi gì. */
  const groups = useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => {
      const k = groupKey(r);
      if (!m.has(k)) m.set(k, { key: k, projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, items: [] });
      m.get(k).items.push({ r, i });
    });
    return [...m.values()];
  }, [rows]);

  /* v3.2 — Đổi dự án / giai đoạn ở đầu khối.
     Chọn dự án: khối hiện ngay TOÀN BỘ hạng mục của dự án (dòng trống) để nhập giờ thẳng, giai đoạn tự chọn theo quản lý.
     Khối đã có giờ thì không đổi dự án nữa (xoá giờ hoặc xoá khối trước). */
  const updGroup = (gk, patch) => {
    const mine = rows.filter((r) => groupKey(r) === gk);
    if (!mine.length) return;
    const first = rows.findIndex((r) => groupKey(r) === gk);
    if (patch.projectId !== undefined) {
      const pid = patch.projectId;
      if (mine.some(rowHasHours)) return flash("Khối đã có giờ. Xoá giờ trong khối (hoặc xoá khối) trước khi đổi dự án.", "err");
      const phaseId = pid === NO_PROJECT ? DEFAULT_PHASE : ((admin ? openPhasesOf(pid) : setOpenPhases(pid))[0]?.id || NO_PHASE);
      const nk = groupKey({ projectId: pid, phaseId });
      if (nk !== gk && rows.some((r) => groupKey(r) === nk)) {
        return flash(`${projFull(pid)}${pid === NO_PROJECT ? "" : ` · ${phaseLabel(phaseId)}`} đã có ở khối khác — bấm nút Sửa ở khối đó để chấm thêm.`, "err");
      }
      const pool = poolFor(pid).filter((t) => !isOtTask(t));   // v5.1: dòng tăng ca chỉ tạo bằng nút Tăng ca / Thêm dòng tăng ca
      if (!pool.length) return flash(pid === NO_PROJECT ? "Chưa có tác vụ chung nào." : "Bạn chưa có tác vụ dự án nào cho vai trò của mình. Báo quản lý bổ sung trong tab Tác vụ.", "err");
      const next = rows.filter((r) => groupKey(r) !== gk);
      next.splice(first, 0, ...pool.map((t) => ({ projectId: pid, phaseId, taskId: t.id, note: "", days: {} })));
      gridInputs.current = {}; mobileInputs.current = [];
      setRows(next);
      setOpenKeys((s) => { const n = new Set(s); n.delete(gk); n.add(nk); return n; });
      setDirty(true);
      return;
    }
    if (patch.phaseId !== undefined) {
      const nk = groupKey({ projectId: mine[0].projectId, phaseId: patch.phaseId });
      if (nk === gk) return;
      if (rows.some((r) => groupKey(r) === nk)) return flash(`${phaseLabel(patch.phaseId)} của dự án này đã có ở khối khác — bấm nút Sửa ở khối đó.`, "err");
      setRows(rows.map((r) => (groupKey(r) === gk ? { ...r, phaseId: patch.phaseId } : r)));
      setOpenKeys((s) => { if (!s.has(gk)) return s; const n = new Set(s); n.delete(gk); n.add(nk); return n; });
      setDirty(true);
    }
  };

  /* Dự án nhân sự đang làm — suy từ giờ đã chấm tháng này + tháng trước, cùng cách tab
     "Theo dõi nhân sự" đang dùng, cộng thêm dự án của tuần đang mở kể cả chưa lưu.
     Đọc từ DB trong bộ nhớ nên không tốn lệnh storage. */
  const myProjects = useMemo(() => {
    const h = new Map();
    for (const ym of [...new Set([...yms, prevYm(yms[0])])]) {
      for (const r of dbTs(empId, ym)?.rows || []) {
        if (r.projectId === NO_PROJECT) continue;
        const t = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
        if (t > 0) h.set(r.projectId, (h.get(r.projectId) || 0) + t);
      }
    }
    for (const r of rows) if (r.projectId !== NO_PROJECT) h.set(r.projectId, h.get(r.projectId) || 0);
    return activeProjects.filter((p) => h.has(p.id)).sort((a, b) => (h.get(b.id) || 0) - (h.get(a.id) || 0));
  }, [empId, yms, rows, activeProjects, savedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tra mã dự án -> id. Gõ "01" hoặc "#01" là nhảy thẳng vào dự án đó, khỏi gõ tên
  const codeMap = useMemo(() => {
    const m = new Map();
    for (const p of activeProjects) if (p.code) m.set(norm(String(p.code)), p.id);
    return m;
  }, [activeProjects]);

  /* Danh sách tổ hợp để tìm kiếm. Chỉ nhân dự án × hạng mục (không nhân thêm giai đoạn) —
     giai đoạn suy ra bằng guessPhase, hoặc lấy từ token P1–P4 nếu người dùng gõ vào.
     Dự án đang làm được xếp lên trước để gõ ít nhất vẫn ra đúng thứ cần. */
  const quickOptions = useMemo(() => {
    const out = [];
    const rank = new Map(myProjects.map((p, k) => [p.id, k]));
    const ordered = [...activeProjects].sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 999) - (rank.has(b.id) ? rank.get(b.id) : 999));
    for (const p of ordered) for (const t of projTasks) {
      out.push({
        projectId: p.id, taskId: t.id, phaseId: fitPhase(p.id, guessPhase(t.id, cfg.tasks)),
        label: `${p.code ? `[${p.code}] ` : ""}${p.name} · ${taskText(t)}`,
        hay: norm(`${p.code || ""} ${p.id} ${p.name} ${t.code || ""} ${t.name} ${t.group || ""}`),
      });
    }
    for (const t of commonTasks) out.push({ projectId: NO_PROJECT, taskId: t.id, phaseId: DEFAULT_PHASE, label: `Khác · ${taskText(t)}`, hay: norm(`khac chung ${t.code || ""} ${t.name} ${t.group || ""}`) });
    for (const t of LEAVE_TASKS) out.push({ projectId: NO_PROJECT, taskId: t.id, phaseId: DEFAULT_PHASE, label: `Khác · ${taskText(t)}`, hay: norm(`khac vang mat nghi ${t.name}`) });
    return out;
  }, [activeProjects, myProjects, myTasks, commonIds, cfg.tasks, cfg.projects]); // eslint-disable-line react-hooks/exhaustive-deps

  const quickHits = useMemo(() => {
    const have = new Set(rows.map(rowKey));
    let text = norm(q).trim();
    let phase = qPhase;
    const m = text.match(/(^|\s)p(\d{1,2})(\s|$)/);    // gõ thẳng "vin p2 khao" cũng lọc được giai đoạn
    if (m && phaseInfo(`P${m[2]}`)?.active) { phase = `P${m[2]}`; text = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).trim(); }
    /* Token nào trùng khít một mã dự án thì coi là bộ lọc dự án, không đem đi so chuỗi nữa.
       Gõ cụ thể luôn thắng chip đang chọn, giống cách token P1–P4 đang hoạt động. */
    let proj = qProj;
    const toks = [];
    for (const t of text.split(/\s+/).filter(Boolean)) {
      const bare = t.replace(/^#/, "");
      if (codeMap.has(bare)) { proj = codeMap.get(bare); continue; }
      toks.push(t);
    }
    // ô trống và không lọc gì thì toks rỗng, every() trả true nên danh sách mở sẵn để duyệt
    return quickOptions
      .filter((o) => !proj || o.projectId === proj)
      .map((o) => (phase && o.projectId !== NO_PROJECT ? { ...o, phaseId: phase } : o))
      .filter((o) => o.projectId === NO_PROJECT || phaseOpen(o.projectId, o.phaseId))   // v2.5: bỏ tổ hợp rơi vào giai đoạn chưa có giờ dự kiến
      .filter((o) => toks.every((t) => o.hay.includes(t)) && !have.has(rowKey(o)))
      .slice(0, 12);
  }, [q, qProj, qPhase, codeMap, quickOptions, rows]);

  /* Chip gợi ý: tổ hợp chấm nhiều nhất trong tháng này và tháng trước.
     Đọc thẳng từ DB trong bộ nhớ nên không tốn lệnh storage nào. */
  const recentCombos = useMemo(() => {
    const cnt = new Map();
    for (const ym of [...new Set([...yms, prevYm(yms[0])])]) {
      const b = dbTs(empId, ym);
      for (const r of b?.rows || []) {
        if (isLeaveTask(r.taskId)) continue;
        // v2.9: giờ cũ chấm tác vụ chung dưới một dự án thì gợi ý lại dưới "Khác"
        const khac = commonIds.has(r.taskId);
        const projectId = khac ? NO_PROJECT : r.projectId;
        const phaseId = khac ? DEFAULT_PHASE : r.phaseId || guessPhase(r.taskId, cfg.tasks);
        const k = rowKey({ projectId, phaseId, taskId: r.taskId });
        const e = cnt.get(k) || { projectId, phaseId, taskId: r.taskId, n: 0 };
        e.n += 1; cnt.set(k, e);
      }
    }
    const have = new Set(rows.map(rowKey));
    const live = new Set(activeProjects.map((p) => p.id));
    const usable = new Set(myTasks.map((t) => t.id));   // v2.3: bỏ gợi ý tác vụ đã xoá / không còn thuộc bộ phận
    return [...cnt.values()]
      .filter((c) => !have.has(rowKey(c)) && usable.has(c.taskId) && (c.projectId === NO_PROJECT || (live.has(c.projectId) && phaseOpen(c.projectId, c.phaseId))))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [empId, yms, rows, activeProjects, myTasks, cfg.tasks, cfg.phases, savedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const quickKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setQOpen(true); setQIdx((k) => Math.min(k + 1, quickHits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setQIdx((k) => Math.max(k - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (quickHits[qIdx]) addCombo(quickHits[qIdx]); }
    else if (e.key === "Escape") { setQOpen(false); e.currentTarget.blur(); }
  };

  /* v1.9 — khoá cứng theo ngày: ngày đã gửi thì nhân sự không sửa được và không thêm giờ dự án khác vào ngày đó;
     quản lý luôn sửa được. Ngày chưa gửi vẫn nhập và gửi sau bình thường. */
  const sentDays = days.filter(isSent);
  const submitted = days.filter((d) => minHoursFor(d, hoursCfg, holidaySet) !== null).every(isSent) || yms.every((ym) => buckets[ym]?.weeks?.[monday]);
  const locked = !admin && sentDays.length === 7;          // cả 7 ngày đã gửi: không còn gì để nhập
  const rowLocked = (r) => !admin && (projClosed(r) || days.some((d) => isSent(d) && r.days[d] > 0));
  const toSend = days.filter((d) => !isSent(d) && sendTotal(d) > 0);
  /* v2.4 — "có giờ sẽ mất": quản lý thì mọi thay đổi chưa lưu; nhân sự thì chỉ khi đang có giờ ở ngày chưa gửi.
     Chỉ thêm dòng trống (chưa nhập giờ) thì chuyển tuần / đổi tab / đóng trang không bị hỏi. */
  const atRisk = admin ? dirty : dirty && days.some((d) => !isSent(d) && dayTotal(d) > 0);
  // báo lên App để chặn đổi tab khi còn giờ chưa gửi
  useEffect(() => { onDirtyChange?.(atRisk); return () => onDirtyChange?.(false); }, [atRisk, onDirtyChange]);
  // v1.9 — không còn lưu nháp: đóng hoặc tải lại trang khi còn giờ chưa gửi thì trình duyệt hỏi lại
  useEffect(() => {
    if (!atRisk) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [atRisk]);
  const weekTotal = days.reduce((s, d) => s + dayTotal(d), 0);
  const todayStr = fmt(new Date());
  // Ngày nào có dòng vắng mặt với giờ > 0 thì coi là ngày vắng — suy trực tiếp từ dòng, không lưu riêng
  const leaveMap = useMemo(() => {
    const m = {};
    for (const r of rows) {
      const lt = leaveTypeOfTask(r.taskId);
      if (!lt) continue;
      for (const d of days) if (r.days[d] > 0) m[d] = lt;
    }
    return m;
  }, [rows, days]);
  const leaveHours = (d) => rows.reduce((s2, r) => s2 + (isLeaveTask(r.taskId) ? (r.days[d] || 0) : 0), 0);
  const workHours = (d) => dayTotal(d) - leaveHours(d);

  /* v4.0 — thiếu giờ công tính theo GIỜ CHUẨN (tổng − OT − giờ cố gắng), không tính theo tổng:
     chấm 6h làm việc + 2h OT = 8h vẫn là thiếu 2h giờ chuẩn. */
  const isIncomplete = (d) => {
    const min = minHoursFor(d, hoursCfg, holidaySet);
    return min !== null && d <= todayStr && dayTotal(d) - otHrs(d) - effortHrs(d) < min;
  };
  const isOverDaily = (d) => dayTotal(d) > (Number(hoursCfg.maxDaily) || 13.5); // vượt ngưỡng cảnh báo/ngày
  // v3.4: OT = chỉ giờ chấm vào hạng mục Tăng ca; Giờ cố gắng = giờ làm việc thường vượt ngưỡng ngày (không tính chi phí dự án)
  const otHrs = (d) => rows.reduce((s, r) => s + (isOtId(r.taskId) ? (r.days[d] || 0) : 0), 0);
  const idleHrs = (d) => rows.reduce((s, r) => s + (isIdleTask(r.taskId) ? (r.days[d] || 0) : 0), 0);   // v7.2
  const effortHrs = (d) => effortHoursFor(d, Math.max(0, workHours(d) - otHrs(d) - idleHrs(d)), hoursCfg, holidaySet);
  const otTotal = days.reduce((s, d) => s + otHrs(d), 0);
  const effortTotal = days.reduce((s, d) => s + effortHrs(d), 0);
  // có ngày nào OT vượt ngưỡng không — dùng để đổi màu ô tổng và dòng OT trên đầu bảng
  const anyOtHigh = days.some((d) => otHrs(d) > OT_ALERT);
  // Target tuần trừ đi phần được miễn do ngày lễ và ngày nghỉ phép
  const weekTarget = days.reduce((s, d) => {
    const min = minHoursFor(d, hoursCfg, holidaySet);
    return s + (min === null ? 0 : min);
  }, 0);
  /* v3.7 — giờ công chuẩn = tổng − OT − Giờ cố gắng; phát sinh = OT + Giờ cố gắng. Tiến độ tuần tính theo giờ chuẩn. */
  const extraTotal = otTotal + effortTotal;
  const stdTotal = Math.max(0, weekTotal - extraTotal);
  const stdHrs = (d) => Math.max(0, dayTotal(d) - otHrs(d) - effortHrs(d));
  const targetPct = weekTarget > 0 ? Math.min(100, (stdTotal / weekTarget) * 100) : 0;
  const projOptions = (r) => (
    <>
      {r.projectId === "" && <option value="" disabled>— Chọn dự án —</option>}
      <option value={NO_PROJECT}>Khác</option>
      {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ""}{p.name}</option>)}
      {r.projectId !== NO_PROJECT && r.projectId !== "" && !activeProjects.some((p) => p.id === r.projectId) && <option value={r.projectId}>{projName(r.projectId)} ({!cfg.projects.some((p) => p.id === r.projectId && p.active) ? "đã đóng" : openPhasesOf(r.projectId).length === 0 ? "chưa mở giai đoạn" : "không còn được giao"})</option>}
    </>
  );
  // v2.5: chỉ liệt kê giai đoạn có giờ dự kiến của dự án (quản lý thấy mọi giai đoạn đang dùng)
  const phaseOptions = (cur, pid) => {
    const list = pid === "" ? [] : pid && pid !== NO_PROJECT ? openPhasesOf(pid) : activePhases();
    return (
      <>
        {cur === NO_PHASE && <option value={NO_PHASE} disabled>— Chọn giai đoạn —</option>}
        {list.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
        {cur && cur !== NO_PHASE && !list.some((p) => p.id === cur) && (
          <option value={cur}>{phaseLabel(cur)}{!phaseInfo(cur) ? "" : !phaseInfo(cur).active ? " (ngừng dùng)" : " (đang đóng)"}</option>
        )}
      </>
    );
  };
  // Nhân sự chưa chấm công bao giờ thì chưa suy ra được dự án nào — lúc đó hiện tạm danh sách đang mở
  const projChips = myProjects.length ? myProjects : activeProjects.slice(0, 6);
  const qChip = (on) => `rounded border px-1.5 py-0.5 text-[11px] ${on ? "border-teal-600 bg-teal-950 text-teal-300" : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200"}`;
  // v2.9 — "Khác": tác vụ chung + vắng mặt. Dự án: chỉ tác vụ gắn vai trò.
  const taskOptions = (r) => {
    const khac = r.projectId === NO_PROJECT;
    const listed = khac ? [...commonTasks, ...LEAVE_TASKS] : projTasks;
    return (
      <>
        {!r.taskId && <option value="" disabled>— Chọn hạng mục —</option>}
        {khac ? (
          <>
            <optgroup label="Công việc chung">
              {commonTasks.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
            </optgroup>
            <optgroup label="Vắng mặt">
              {LEAVE_TASKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          </>
        ) : (
          <optgroup label="Công việc dự án">
            {projTasks.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
          </optgroup>
        )}
        {/* dòng cũ trỏ tới hạng mục không còn trong danh sách vẫn giữ được, không bị đổi ngầm */}
        {r.taskId && !listed.some((t) => t.id === r.taskId) && (
          <option value={r.taskId}>{taskName(r.taskId)}{!cfg.tasks.some((t) => t.id === r.taskId) ? "" : commonIds.has(r.taskId) ? " (tác vụ chung — dữ liệu cũ)" : " (ngoài bộ phận)"}</option>
        )}
      </>
    );
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {!admin && <DeadlineBanner cfg={cfg} empId={empId} />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Thiếu giờ công</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" /> Tăng ca</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> OT trên {OT_ALERT} giờ/ngày</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Giờ cố gắng</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-red-500" /> Ngày lễ</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Nghỉ phép</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-slate-600 bg-slate-700" /> Hôm nay</span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2.5 md:px-3">
        {/* v2.4: màn hẹp thì nhóm "đã gửi + tổng giờ" tự xuống dòng, căn phải, thay vì tràn khỏi thẻ */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 md:gap-2">
            <button onClick={() => goWeek(fmt(addDays(parseD(monday), -7)))} className={iconBtn}><ChevronLeft size={16} /></button>
            <WeekPicker monday={monday} onChange={goWeek} empId={empId} hoursCfg={hoursCfg} holidaySet={holidaySet} refreshKey={savedTick} />
            <button onClick={() => goWeek(fmt(addDays(parseD(monday), 7)))} className={iconBtn}><ChevronRight size={16} /></button>
            <button onClick={() => goWeek(fmt(mondayOf(new Date())))} className="whitespace-nowrap text-xs text-teal-400 hover:text-teal-300">Tuần này</button>
          </div>
          <div className="ml-auto flex items-center gap-2 md:gap-4">
            {/* v3.7 — bỏ nhãn "Đã gửi đủ tuần" (nút dưới bảng đã báo "Đã gửi giờ công"); tổng giờ tách 3 ô: Chuẩn · Phát sinh · Tổng */}
            <div className="flex overflow-hidden rounded-lg border border-slate-700 text-right">
              <div className="px-2.5 py-1 md:px-3.5" title="Giờ công chuẩn = tổng − OT − giờ cố gắng">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Chuẩn</div>
                <div className="font-mono text-base font-semibold text-blue-400 md:text-lg">{stdTotal.toFixed(1)}</div>
                <div className="font-mono text-[10px] text-slate-500">{weekTarget > 0 ? `/ ${weekTarget.toFixed(1)}` : "giờ"}</div>
              </div>
              <div className="border-l border-slate-700 px-2.5 py-1 md:px-3.5" title="Giờ phát sinh = OT (hạng mục Tăng ca) + giờ cố gắng (không tính chi phí dự án)">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Phát sinh</div>
                <div className="font-mono text-base font-semibold text-slate-100 md:text-lg">{extraTotal.toFixed(1)}</div>
                <div className="whitespace-nowrap font-mono text-[10px]">
                  <span className={anyOtHigh ? "text-red-400" : "text-teal-400"}>OT {otTotal.toFixed(1)}</span>
                  <span className="text-slate-600"> · </span>
                  <span className="cg-num text-violet-400">CG {effortTotal.toFixed(1)}</span>
                </div>
              </div>
              <div className="border-l border-slate-700 px-2.5 py-1 md:px-3.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Tổng</div>
                <div className="font-mono text-base font-semibold text-slate-50 md:text-lg">{weekTotal.toFixed(1)}</div>
                <div className="text-[10px] text-slate-500">giờ</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tiến độ so với target tuần — target đã trừ ngày lễ và ngày nghỉ phép nên luôn phản ánh đúng thực tế */}
        {weekTarget > 0 && (
          <div className="mt-2.5 border-t border-slate-800 pt-2.5">
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span className="text-slate-500">Tiến độ tuần</span>
              <span className="font-mono text-slate-400">
                {stdTotal.toFixed(1)} / {weekTarget.toFixed(1)} giờ chuẩn
                <span className={`ml-2 ${stdTotal >= weekTarget ? "text-blue-400" : "text-amber-400"}`}>
                  {stdTotal >= weekTarget ? "đủ target" : `còn thiếu ${(weekTarget - stdTotal).toFixed(1)}`}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full transition-all ${stdTotal >= weekTarget ? "bg-blue-400" : "bg-amber-500"}`} style={{ width: `${targetPct}%` }} />
            </div>
          </div>
        )}
      </div>


      {!loading && myTasks.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-900 bg-amber-950 p-3 text-sm text-amber-100">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            {emp?.role
              ? <>Vai trò <b>{roleLabel(emp.role)}</b> chưa được gán tác vụ nào.</>
              : <>Bạn chưa được phân vai trò và chưa có tác vụ dùng chung nào.</>}
            {" "}Nhờ quản lý vào tab Tác vụ bổ sung, hoặc kiểm tra lại vai trò của bạn ở tab Nhân sự.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-10 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} /> Đang tải bảng công…</div>
      ) : (
        <>
          {/* v2.9: bỏ ô thêm nhanh và chip gợi ý — thêm dòng bằng nút "Thêm dòng" / nút + ở đầu khối */}
          {/* DESKTOP */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 md:block">
            <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  {/* Ba trường gộp về một cột: hàng trên Dự án + Giai đoạn, hàng dưới Hạng mục nằm ngang hàng với giờ công */}
                  <th className="px-4 py-3 font-medium" style={{ width: "50%" }}>Dự án · Giai đoạn · Hạng mục</th>
                  {days.map((d, i) => {
                    const hol = holidayMap.has(d); const lv = leaveInfo(leaveMap[d]);
                    return (
                      <th key={d} className={`px-1 py-1.5 text-center font-medium ${dayCol(d)} ${hol ? "text-slate-100" : lv ? "text-sky-400" : isIncomplete(d) ? "text-amber-400" : i === 6 ? "text-slate-600" : ""}`}
                        title={hol ? holidayMap.get(d) : lv ? lv.label : undefined}>
                        <div className={`mx-auto flex flex-col items-center justify-center bg-center bg-no-repeat ${hol ? "" : "w-fit"}`}
                          style={hol ? { width: 50, height: 50, backgroundImage: `url("data:image/svg+xml,${HOLIDAY_RING_SVG}")`, backgroundSize: "100% 100%" } : undefined}>
                          <div className="flex items-center justify-center gap-1">
                            {DOW[i]}
                            {isSent(d) && <Lock size={10} className="text-teal-500" />}
                            {hol ? null : lv ? <span className="text-[9px]">{lv.short}</span> : isIncomplete(d) ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Chưa đủ giờ chuẩn" /> : null}
                          </div>
                          <div className={`font-mono text-xs font-normal normal-case ${i === 6 ? "text-slate-600" : "text-slate-100"}`}>{dLabel(d)}</div>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-center font-medium" style={{ width: "7%" }}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Tuần này chưa có tác vụ nào. Bấm <b className="text-slate-300">Thêm tác vụ</b> để bắt đầu.
                  </td></tr>
                )}
              </tbody>

              {/* Mỗi dòng chấm công là một tbody riêng gồm 2 hàng: hover và viền dưới nhờ vậy bao trọn cả cụm.
                  selectCls đã có sẵn w-full nên tỉ lệ rộng phải đặt ở div bọc ngoài bằng flexBasis. */}
              {groups.map((g) => {
                const noProj = g.projectId === NO_PROJECT; // v2.9: khối "Khác" — không có giai đoạn
                const blank = g.projectId === "";
                const open = openKeys.has(g.key);
                const gLocked = g.items.some(({ r }) => rowLocked(r)); // khối có giờ của ngày đã gửi: không đổi dự án/giai đoạn
                const gHas = g.items.some(({ r }) => rowHasHours(r));
                const canEdit = !locked && !blank && !projClosed(g.items[0].r);
                const gt = g.items.reduce((s, { r }) => s + days.reduce((a, d) => a + (r.days[d] || 0), 0), 0);
                const secs = blank ? [] : sectionsOf(g, open);
                return (
                  <tbody key={g.key} className={`border-b border-slate-800 ${open ? "bg-slate-800/40" : ""}`}>
                    {/* Đầu khối: nút ✓ / Sửa + dự án + giai đoạn */}
                    <tr>
                      <td className="px-3 pb-1 pt-2.5">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">{/* v8.2: dự án chiếm phần còn lại; nút ✓ / Sửa dời sang cạnh thùng rác */}
                            <select disabled={gLocked || (!blank && (!open || gHas))} value={g.projectId} onChange={(e) => updGroup(g.key, { projectId: e.target.value })}
                              title={!blank && gHas ? "Khối đã có giờ — xoá giờ hoặc xoá khối để đổi dự án" : undefined}
                              className={!blank && !open ? `${selectCls} proj-done appearance-none border-slate-600 bg-slate-800 font-medium text-slate-50` : `disabled:opacity-60 ${selectCls}`}>{projOptions(g.items[0].r)}</select>
                          </div>
                          <div className="min-w-0 shrink-0" style={{ width: 180 }}>{/* v8.2: ô giai đoạn thu nhỏ, vừa "P3 · Thi công" */}
                            {!noProj && (
                              <select disabled={gLocked || blank || !open || phaseFixed(g)} value={g.phaseId} onChange={(e) => updGroup(g.key, { phaseId: e.target.value })}
                                title={phaseInfo(g.phaseId)?.desc}
                                className={`disabled:opacity-60 ${selectCls}`}>{phaseOptions(g.phaseId, g.projectId)}</select>
                            )}
                          </div>
                          {/* v8.2: nút ✓ (xong) / Sửa nằm ngay bên trái thùng rác */}
                          <div className="shrink-0 flex justify-end" style={{ width: GUT }}>
                            {open ? (
                              <button onClick={() => doneGroup(g.key)} title="Xong — tạm lưu giờ của khối này"
                                className={`${iconBtn} border-teal-600 bg-teal-600 text-white hover:border-teal-500 hover:bg-teal-500 hover:text-white`}><Check size={16} /></button>
                            ) : canEdit ? (
                              <button onClick={() => editGroup(g.key)} title="Sửa giờ của khối này"
                                className={`${iconBtn} hover:border-teal-700 hover:text-teal-300`}><Pencil size={14} /></button>
                            ) : null}
                          </div>
                          {/* v3.3: thùng rác xoá cả khối nằm ngay bên phải ô giai đoạn */}
                          <div className="shrink-0" style={{ width: GUT }}>
                            {!gLocked && !locked && (
                              <button onClick={() => delGroup(g.key)} title="Xoá cả khối dự án này" aria-label="Xoá cả khối dự án này"
                                className={`${iconBtn} hover:border-rose-800 hover:text-rose-300`}><Trash2 size={16} /></button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td colSpan={7} className="px-2 pb-1 pt-2.5">
                        <div className="flex items-center justify-end gap-3 text-xs">
                        </div>
                      </td>
                      <td className="px-2 pb-1 pt-2.5" />{/* v3.5: bỏ số tổng của khối dự án — tổng chỉ còn ở hàng cuối bảng */}
                    </tr>

                    {blank && (
                      <tr><td colSpan={9} className="px-3 pb-3 pt-1">

                      </td></tr>
                    )}

                    {secs.map((sec, si) => (
                      <React.Fragment key={sec.label}>
                        {/* v5.0: nhóm Tăng ca chưa có dòng nào = đang ẩn, chỉ hiện nút "+ Tăng ca" */}
                        {open && sec.ot && sec.items.length === 0 && (
                          <tr><td colSpan={9} className="px-3 pb-2.5 pt-2">
                            <div style={{ paddingLeft: GUT + 8 }}>
                              <button onClick={() => addOtRow(g)} disabled={locked || projClosed(g.items[0].r)}
                                className={`${btnBase} border border-teal-900 text-teal-300 hover:border-teal-700 disabled:opacity-40`}><Zap size={14} /> Tăng ca</button>
                            </div>
                          </td></tr>
                        )}
                        {/* v6.2: nhóm Công việc chung / Vắng mặt = nhãn màu bo tròn + đường kẻ mảnh, tách khỏi tác vụ bên dưới */}
                        {open && sec.chip && (
                          <tr><td colSpan={9} className="px-3 pb-1 pt-3.5">
                            <div className="flex items-center gap-2.5" style={{ paddingLeft: GUT + 8 }}>
                              <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `${sec.chip}2e`, color: sec.chip }}>{sec.label}</span>
                              <i className="h-px flex-1 bg-slate-700" />
                            </div>
                          </td></tr>
                        )}
                        {open && !sec.chip && !sec.noHead && !(sec.ot && sec.items.length === 0) && (
                          <tr><td colSpan={9} className="px-3 pb-0.5 pt-2.5">
                            <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${sec.ot ? "text-teal-400" : "text-slate-500"}`} style={{ paddingLeft: GUT + 8 }}>
                              {sec.ot && <Zap size={11} />}{sec.label}
                              {sec.ot && sec.items.length > 0 && <span className="ml-2 normal-case tracking-normal text-slate-500">Tác vụ · Khung giờ</span>}
                            </div>
                          </td></tr>
                        )}
                        {sec.items.map(({ r, i }, n) => {
                          const rt = days.reduce((s, d) => s + (r.days[d] || 0), 0);
                          const last = si === secs.length - 1 && n === sec.items.length - 1;
                          const pb = last ? "pb-2.5" : "pb-0";
                          const ot = isOtTask(taskById.get(r.taskId));
                          return (
                            <tr key={i} className="group/row">
                              <td className={`px-3 ${open ? "pt-1" : "pt-0.5"} ${pb}`}>
                                <div className="flex items-center gap-2">
                                  <div className="shrink-0" style={{ width: GUT }} />
                                  {open && ot ? otPickers(r, i) : (
                                  <div className="min-w-0 flex-1">
                                    <div className={`truncate text-sm transition-colors text-slate-100 group-hover/row:text-teal-200 group-focus-within/row:text-teal-200 group-hover/row:font-semibold group-focus-within/row:font-semibold`} title={rowLabel(r, open)}>
                                      {rowLabelNode(r, open)}
                                    </div>
                                    {open && rowDesc(r) && <div className="truncate text-[11px] leading-tight text-slate-600 group-hover/row:text-slate-400 group-focus-within/row:text-slate-400" title={rowDesc(r)}>{rowDesc(r)}</div>}
                                  </div>
                                  )}
                                  <div className="flex shrink-0 items-center gap-1">
                                    {open && !ot && !isLeaveTask(r.taskId) && (
                                      <button disabled={locked || projClosed(r) || !rowReady(r)} onClick={() => fillStandard(i)} title="Điền giờ chuẩn cho cả tuần vào các ô còn trống"
                                        className={`${iconBtn} disabled:opacity-40`}><Zap size={14} /></button>
                                    )}
                                    {/* v5.0: dòng tăng ca xoá được cả dòng, kể cả khi chưa nhập giờ (dòng có giờ của ngày đã gửi thì không) */}
                                    {open && ot && (
                                      <button disabled={locked || rowLocked(r)} onClick={() => delRow(i)} title="Xoá dòng tăng ca này" aria-label="Xoá dòng tăng ca này"
                                        className={`${iconBtn} hover:border-rose-800 hover:text-rose-300 disabled:opacity-40`}><Trash2 size={14} /></button>
                                    )}
                                    {/* v3.3: chỉ hiện khi hạng mục có giờ còn xoá được trong tuần */}
                                    {open && !ot && canClear(r) && (
                                      <button onClick={() => clearRow(i)} title="Xoá hết giờ của hạng mục này trong tuần" aria-label="Xoá hết giờ của hạng mục này trong tuần"
                                        className={`${iconBtn} hover:border-rose-800 hover:text-rose-300`}><Eraser size={14} /></button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {days.map((d, k) => (
                                <td key={d} className={`px-1 ${open ? "pt-1" : "pt-0.5"} ${pb} ${dayCol(d)}`}>
                                  {open ? (
                                    <input ref={(el) => { gridInputs.current[`${i}:${k}`] = el; }}
                                      type="number" min="0" max="24" step="0.5" value={r.days[d] ?? ""} placeholder="" disabled={dayLocked(d) || projClosed(r) || futureBlocked(r, d) || !rowReady(r)}
                                      onChange={(e) => setHour(i, d, e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      onKeyDown={(e) => gridKey(e, i, k)}
                                      title={ot ? `Tối đa ${fmtH(otMaxHours(taskById.get(r.taskId)))} giờ` : undefined}
                                      className={`${CTRL} w-full rounded-md border bg-slate-950 px-1 text-center font-mono text-base font-medium focus:border-teal-500 focus:outline-none disabled:opacity-60 ${ot && r.days[d] > otMaxHours(taskById.get(r.taskId)) ? "border-rose-600 text-rose-300" : ot ? "ot-cell border-teal-900 text-slate-100" : isIncomplete(d) ? "border-amber-700/60 text-slate-100" : k === 6 ? "border-slate-800 text-slate-100" : "border-slate-700 text-slate-100"}`} />
                                  ) : (
                                    <div className={`py-1.5 text-center font-mono text-sm ${r.days[d] > 0 ? (ot ? "text-teal-300" : "text-slate-200") : "text-slate-700"}`}>{r.days[d] > 0 ? r.days[d] : "·"}</div>
                                  )}
                                </td>
                              ))}
                              <td className={`px-2 ${open ? "pt-1" : "pt-0.5"} ${pb}`} />{/* v3.5: bỏ số tổng từng hạng mục */}
                            </tr>
                          );
                        })}
                        {open && sec.ot && sec.items.length > 0 && (
                          <tr><td colSpan={9} className="px-3 pb-2.5 pt-1.5">
                            <div style={{ paddingLeft: GUT + 8 }}>
                              <button onClick={() => addOtRow(g)} disabled={locked || projClosed(g.items[0].r)}
                                className={`${btnBase} border border-teal-900 text-teal-300 hover:border-teal-700 disabled:opacity-40`}><Plus size={14} /> Thêm dòng tăng ca</button>
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                );
              })}
              {/* v3.7 (phương án A) — chân bảng đọc như phép cộng: Giờ chuẩn + OT + Giờ cố gắng = Tổng theo ngày.
                  Ba hàng chi tiết thu gọn mặc định; bấm nút mũi tên cạnh "Tổng theo ngày" để mở ra. */}
              <tfoot>
                {showSplit && extraTotal > 0 && (<>
                  <tr className="border-t border-slate-700 font-mono text-xs">
                    <td className="px-4 py-2 font-sans text-xs text-slate-400" title="Tổng theo ngày trừ OT và giờ cố gắng">
                      <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-blue-400" />Giờ chuẩn</td>
                    {days.map((d) => {
                      const st = stdHrs(d);
                      return <td key={d} className={`px-1 py-2 text-center ${dayCol(d)} ${isIncomplete(d) ? "text-amber-400" : st ? "text-blue-400" : "text-slate-700"}`}>{st ? st.toFixed(1) : "·"}</td>;
                    })}
                    <td className="px-2 py-2 text-center font-semibold text-blue-400">{stdTotal.toFixed(1)}</td>
                  </tr>
                  {otTotal > 0 && (
                    <tr className="border-t border-slate-800 font-mono text-xs">
                      <td className="px-4 py-2 font-sans text-xs text-slate-400">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-teal-400" />+ OT<span className="ml-1.5 text-[11px] text-slate-600">hạng mục Tăng ca</span></td>
                      {days.map((d) => {
                        const ot = otHrs(d);
                        const hot = ot > OT_ALERT; // vượt ngưỡng thì đổi đỏ, khỏi phải nhẩm
                        return <td key={d} title={hot ? `OT vượt ${OT_ALERT} giờ` : undefined}
                          className={`px-1 py-2 text-center ${dayCol(d)} ${hot ? "font-semibold text-red-400" : ot ? "text-teal-400" : "text-slate-700"}`}>{ot ? ot.toFixed(1) : "·"}</td>;
                      })}
                      <td className={`px-2 py-2 text-center font-semibold ${anyOtHigh ? "text-red-400" : "text-teal-400"}`}>{otTotal.toFixed(1)}</td>
                    </tr>
                  )}
                  {effortTotal > 0 && (
                    <tr className="border-t border-slate-800 font-mono text-xs">
                      <td className="px-4 py-2 font-sans text-xs text-slate-400" title="Giờ làm việc vượt giờ chuẩn của ngày. Không phải OT, không tính vào chi phí dự án.">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-violet-400" />+ Giờ cố gắng<span className="ml-1.5 text-[11px] text-slate-600">vượt giờ chuẩn</span></td>
                      {days.map((d) => {
                        const ef = effortHrs(d);
                        return <td key={d} className={`px-1 py-2 text-center ${dayCol(d)} ${ef ? "text-violet-400" : "text-slate-700"}`}>{ef ? <span className="cg-num">{ef.toFixed(1)}</span> : "·"}</td>;
                      })}
                      <td className="px-2 py-2 text-center font-semibold text-violet-400"><span className="cg-num">{effortTotal.toFixed(1)}</span></td>
                    </tr>
                  )}
                </>)}
                <tr className={`${showSplit && extraTotal > 0 ? "border-t-2 border-slate-600" : "border-t border-slate-700"} bg-slate-900/60 font-mono text-[15px] font-semibold`}>
                  <td className="px-4 py-3 font-sans text-xs uppercase tracking-wider text-slate-200">
                    <span className="flex items-center gap-2">
                      {extraTotal > 0 && (
                        <button onClick={() => setShowSplit((v) => !v)} aria-expanded={showSplit}
                          aria-label={showSplit ? "Thu gọn giờ chuẩn, OT, giờ cố gắng" : "Mở giờ chuẩn, OT, giờ cố gắng"}
                          title={showSplit ? "Thu gọn" : "Xem giờ chuẩn · OT · giờ cố gắng"}
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 text-slate-400 hover:border-teal-600 hover:text-teal-300">
                          {showSplit ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                      {showSplit && extraTotal > 0 ? "= Tổng theo ngày" : "Tổng theo ngày"}
                    </span>
                  </td>
                  {days.map((d) => {
                    const t = dayTotal(d);
                    return <td key={d} className={`px-1 py-3 text-center ${dayCol(d)} ${isOverDaily(d) ? "text-rose-400" : isIncomplete(d) ? "text-amber-400" : "text-slate-100"}`}>{t ? t.toFixed(1) : "—"}</td>;
                  })}
                  <td className="px-2 py-3 text-center text-slate-50">{weekTotal.toFixed(1)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* MOBILE */}
          <div className="space-y-3 md:hidden">
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => {
                const t = dayTotal(d); const on = d === activeDay; const incomplete = isIncomplete(d);
                const hol = holidayMap.has(d); const lv = leaveInfo(leaveMap[d]);
                return (
                  <button key={d} onClick={() => {
                      setActiveDay(d);
                      // mở luôn bàn phím ở ô nhập của dòng đầu, bôi đen sẵn để gõ đè
                      if (dayLocked(d) || rows.length === 0) return;
                      requestAnimationFrame(() => {
                        const el = mobileInputs.current[0];
                        if (!el) return;
                        el.focus(); el.select?.();
                        el.scrollIntoView({ block: "center", behavior: "smooth" });
                      });
                    }}
                    className={`relative flex flex-col items-center rounded-lg border py-1.5 ${on ? "border-teal-500 bg-slate-800" : hol ? "border-rose-900 bg-rose-950/40" : lv ? "border-sky-900 bg-sky-950/40" : incomplete ? `border-amber-700/60 ${d === todayKey ? "bg-slate-700/70" : "bg-slate-900"}` : d === todayKey ? "border-slate-600 bg-slate-700/70" : "border-slate-800 bg-slate-900"} ${!on && d > todayKey ? "opacity-50" : ""}`}>
                    {isSent(d) && <Lock size={9} className="absolute left-1 top-1 text-teal-500" />}
                    {hol ? null
                      : lv ? <span className="absolute right-0.5 top-0.5 text-[8px] text-sky-400">{lv.short}</span>
                      : incomplete ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
                    <span className={`text-[11px] ${on ? "text-teal-300" : i >= 5 ? "text-slate-600" : "text-slate-400"}`}>{DOW[i]}</span>
                    <span className="font-mono text-[10px] text-slate-500">{pad(parseD(d).getDate())}</span>
                    <span className={`mt-0.5 font-mono text-[11px] ${isOverDaily(d) ? "text-rose-400" : incomplete ? "text-amber-400" : t ? "text-teal-400" : "text-slate-700"}`}>{t ? t.toFixed(1) : "·"}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-sm font-medium text-slate-200">{DOW[days.indexOf(activeDay)]} · {dLabel(activeDay)}</span>
              <span className="font-mono text-sm text-teal-400">{dayTotal(activeDay).toFixed(1)} giờ</span>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
                Tuần này chưa có tác vụ nào.<br />Bấm <b className="text-slate-300">Thêm tác vụ</b> để bắt đầu.
              </div>
            ) : groups.map((g) => {
              const noProj = g.projectId === NO_PROJECT;
              const blank = g.projectId === "";
              const open = openKeys.has(g.key);
              const gLocked = g.items.some(({ r }) => rowLocked(r));
              const gHas = g.items.some(({ r }) => rowHasHours(r));
              const canEdit = !locked && !blank && !projClosed(g.items[0].r);
              const secs = blank ? [] : sectionsOf(g, open);
              return (
                <div key={g.key} className={`rounded-xl border p-3 ${open ? "border-teal-800 bg-slate-800/60" : "border-slate-800 bg-slate-900"}`}>
                  {/* Đầu thẻ: dự án + giai đoạn dùng chung cho mọi hạng mục bên trong */}
                  <select disabled={gLocked || (!blank && (!open || gHas))} value={g.projectId} onChange={(e) => updGroup(g.key, { projectId: e.target.value })} className={`disabled:opacity-60 ${selectCls}`}>{projOptions(g.items[0].r)}</select>
                  {!noProj && !blank && <select disabled={gLocked || !open || phaseFixed(g)} value={g.phaseId} onChange={(e) => updGroup(g.key, { phaseId: e.target.value })} className={`mt-2 disabled:opacity-60 ${selectCls}`}>{phaseOptions(g.phaseId, g.projectId)}</select>}


                  {secs.map((sec) => (
                    <div key={sec.label}>
                      {open && sec.chip && (
                        <div className="mt-3.5 flex items-center gap-2">
                          <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `${sec.chip}2e`, color: sec.chip }}>{sec.label}</span>
                          <i className="h-px flex-1 bg-slate-700" />
                        </div>
                      )}
                      {open && !sec.chip && !sec.noHead && !(sec.ot && sec.items.length === 0) && <div className={`mt-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${sec.ot ? "text-teal-400" : "text-slate-500"}`}>{sec.ot && <Zap size={11} />}{sec.label}</div>}
                      {sec.items.map(({ r, i }) => {
                        const rt = days.reduce((s, d) => s + (r.days[d] || 0), 0);
                        const ot = isOtTask(taskById.get(r.taskId));
                        return (
                          <React.Fragment key={i}>
                          {open && ot && <div className="mt-3">{otPickers(r, i, true)}</div>}
                          <div className={`flex items-center justify-between gap-2 ${open ? "mt-2" : "mt-2 border-t border-slate-800 pt-2"}`}>
                            <div className="min-w-0">
                              {!(open && ot) && <div className={`truncate text-sm ${ot && !open ? "text-slate-100" : rt ? "text-slate-100" : "text-slate-400"}`}>{rowLabelNode(r, open)}</div>}
                              {open && rowDesc(r) && <div className="text-[11px] leading-tight text-slate-500">{rowDesc(r)}</div>}
                              <div className="text-[11px] text-slate-600">Cả tuần: <span className="font-mono text-slate-400">{rt.toFixed(1)}</span> giờ</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {open ? (
                                <input ref={(el) => { mobileInputs.current[i] = el; }}
                                  type="number" inputMode="decimal" min="0" max="24" step="0.5" placeholder="" disabled={dayLocked(activeDay) || projClosed(r) || futureBlocked(r, activeDay) || !rowReady(r)}
                                  value={r.days[activeDay] ?? ""} onChange={(e) => setHour(i, activeDay, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => {
                                    // Enter nhảy xuống ô của dòng kế tiếp, nhập liền mạch cả ngày
                                    if (e.key !== "Enter") return;
                                    e.preventDefault();
                                    const next = mobileInputs.current[i + 1];
                                    if (next) { next.focus(); next.select?.(); } else e.target.blur();
                                  }}
                                  className={`${CTRL} w-20 rounded-md border bg-slate-950 px-2 text-center font-mono text-lg focus:border-teal-500 focus:outline-none disabled:opacity-60 ${ot && r.days[activeDay] > otMaxHours(taskById.get(r.taskId)) ? "border-rose-600 text-rose-300" : ot ? "ot-cell border-teal-900 text-slate-100" : "border-slate-700 text-slate-100"}`} />
                              ) : (
                                <span className={`w-12 text-right font-mono text-base ${r.days[activeDay] > 0 ? "text-slate-100" : "text-slate-700"}`}>{r.days[activeDay] > 0 ? r.days[activeDay] : "·"}</span>
                              )}
                              {open && ot && (
                                <button disabled={locked || rowLocked(r)} onClick={() => delRow(i)} title="Xoá dòng tăng ca này" aria-label="Xoá dòng tăng ca này"
                                  className={`${iconBtn} h-11 w-11 disabled:opacity-40`}><Trash2 size={16} /></button>
                              )}
                              {open && !ot && canClear(r) && (
                                <button onClick={() => clearRow(i)} title="Xoá hết giờ của hạng mục này trong tuần" aria-label="Xoá hết giờ của hạng mục này trong tuần"
                                  className={`${iconBtn} h-11 w-11`}><Eraser size={16} /></button>
                              )}
                            </div>
                          </div>
                          </React.Fragment>
                        );
                      })}
                      {open && sec.ot && (
                        <button onClick={() => addOtRow(g)} disabled={locked || projClosed(g.items[0].r)}
                          className={`${sec.items.length ? "mt-2" : "mt-3"} w-full ${btnBase} border border-teal-900 text-teal-300 hover:border-teal-700 disabled:opacity-40`}>
                          {sec.items.length ? <><Plus size={14} /> Thêm dòng tăng ca</> : <><Zap size={14} /> Tăng ca</>}</button>
                      )}
                    </div>
                  ))}

                  <div className="mt-3 flex gap-2">
                    {open ? (
                      <button onClick={() => doneGroup(g.key)} className={`flex-1 ${btnPrimary}`}><Check size={15} /> Xong, tạm lưu</button>
                    ) : canEdit ? (
                      <button onClick={() => editGroup(g.key)} className={`flex-1 ${btnGhost}`}><Pencil size={14} /> Sửa</button>
                    ) : <div className="flex-1" />}
                    {!gLocked && !locked && (
                      <button onClick={() => delGroup(g.key)} title="Xoá cả khối" className={`${iconBtn} h-11 w-11`}><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
        <button onClick={focusQuick} disabled={locked} className={`${btnGhost} disabled:opacity-40`}><Plus size={15} /> Thêm tác vụ</button>
        {/* v1.9: quản lý lưu được khi sửa bảng công của người khác · v8.1: nhân sự có lại nút Lưu nháp (ghi lên server, chưa gửi) */}
        {!admin && (
          <button onClick={() => save("draft")} disabled={saving || locked} title="Lưu tạm giờ đang nhập lên hệ thống, chưa gửi — quản lý thấy là Nháp, chưa tính vào báo cáo"
            className={`${btnGhost} disabled:opacity-40`}>
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Lưu nháp
          </button>
        )}
        {admin && (
          <button onClick={() => save(null)} disabled={saving} className={`${btnGhost} disabled:opacity-40`}>
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Lưu thay đổi
          </button>
        )}
        {admin && sentDays.length > 0 && (
          <button onClick={() => save("unsubmit")} disabled={saving} className={`${btnGhost} disabled:opacity-40`}>
            <Unlock size={15} /> Mở khoá tuần này
          </button>
        )}
        {/* v3.5 — nhân sự đã gửi và không còn giờ mới nào chờ gửi: nút đổi thành "Đã gửi giờ công" (không bấm được).
            Nhập thêm giờ vào ngày chưa gửi thì nút quay lại "Gửi giờ công". */}
        {!admin && sentDays.length > 0 && toSend.length === 0 && !saving ? (
          <button disabled className={`col-span-2 w-full md:w-auto ${btnBase} cursor-default border border-teal-800 bg-teal-950 text-teal-300`}>
            <CheckCircle2 size={15} /> Đã gửi giờ công
          </button>
        ) : (
          <button onClick={() => (admin ? save("submit") : askSubmitWeek())} disabled={saving || locked} className={`col-span-2 w-full md:w-auto ${btnPrimary} disabled:opacity-40`}>
            {saving && !admin ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />} {admin ? "Đánh dấu đã gửi" : "Gửi giờ công"}
          </button>
        )}
        {atRisk && <span className="col-span-2 text-center text-xs text-amber-400 md:text-left">{admin ? "Có thay đổi chưa lưu" : "Có giờ chưa gửi"}</span>}
      </div>

      {saveFailed && (
        <div className="rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
            <div className="min-w-0">
              <b>Chưa ghi được lên hệ thống.</b> Giờ bạn nhập vẫn còn nguyên trên màn hình — đừng đóng trang.
              Bấm thử lại một lần nữa; nếu vẫn hỏng thì chép giờ ra để giữ.
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => save(admin ? null : "submit")} className={btnGhost}><Save size={14} /> {admin ? "Thử lưu lại" : "Thử gửi lại"}</button>
            <button onClick={copyEntered} className={btnGhost}><Copy size={14} /> Chép giờ đã nhập</button>
          </div>
        </div>
      )}

      {undoRow && !(undoRow.rows && undoRow.rows.some((u) => rows.some((x) => groupKey(x) === groupKey(u)))) && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-300">Đã xoá {undoRow.label}</span>
          <button onClick={undoDelete} className="shrink-0 text-xs text-teal-400 hover:text-teal-300">Hoàn tác</button>
          <button onClick={() => setUndoRow(null)} className="shrink-0 text-slate-500 hover:text-slate-300"><X size={14} /></button>
        </div>
      )}

      <NoteDialog
        open={noteRow !== null}
        readOnly={noteRow !== null && !!rows[noteRow] && rowLocked(rows[noteRow])}
        title={noteRow !== null && rows[noteRow] ? `${projName(rows[noteRow].projectId)} · ${taskName(rows[noteRow].taskId)}` : ""}
        value={noteRow !== null ? rows[noteRow]?.note : ""}
        onSave={(txt) => { upd(noteRow, { note: txt }); setNoteRow(null); }}
        onClose={() => setNoteRow(null)}
      />

      {/* v1.9: gửi xong là khoá, nên hỏi lại một lần */}
      <ConfirmDialog
        open={askSubmit}
        tone="ok"
        title={`Gửi giờ công ${toSend.length} ngày?`}
        desc={`${toSend.map(dayName).join(", ")} · tổng ${toSend.reduce((a, d) => a + dayTotal(d), 0).toFixed(1)} giờ. Gửi xong các ngày này bị khoá, chỉ quản lý mới mở được. Ngày chưa nhập vẫn để mở.`}
        confirmLabel="Gửi và khoá"
        cancelLabel="Xem lại"
        onConfirm={() => { setAskSubmit(false); save("submit"); }}
        onCancel={() => setAskSubmit(false)}
      />
      <ConfirmDialog
        open={pendingWeek !== null}
        title="Chuyển tuần khi chưa gửi?"
        desc="Giờ bạn vừa nhập ở tuần này chưa gửi nên sẽ mất. Bấm Giữ lại để quay về và bấm Gửi trước."
        confirmLabel="Bỏ giờ, chuyển tuần"
        onConfirm={() => { const m = pendingWeek; setPendingWeek(null); setDirty(false); setMonday(m); }}
        onCancel={() => setPendingWeek(null)}
      />
    </div>
  );
}

/* ============================ BẢNG CÔNG NHÂN SỰ (QUẢN LÝ) ============================ */
/* --------- v1.6: ma trận giờ công — hàng = nhân sự, cột = dự án, theo tháng ---------
   Đọc thẳng từ dữ liệu đã nằm trong bộ nhớ (dbTs), không tốn lệnh lưu trữ.
   v2.9: tác vụ chung và vắng mặt gom vào một cột riêng "Khác", không tính vào giờ dự án. */
function HoursMatrix({ cfg, ym, flash, onPickEmp }) {
  const dataTick = useDataTick();   // v1.9: vẽ lại khi có người vừa gửi
  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("all");
  const [hideEmpty, setHideEmpty] = useState(false);

  const from = `${ym}-01`;
  const to = fmt(lastOfMonth(parseD(from)));
  const projById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskById = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes, cfg.otBands, cfg.otLegacy]);
  const projLabel = (id) => { if (id === NO_PROJECT) return "Khác"; const x = projById.get(id); return x ? (x.code ? `[${x.code}] ${x.name}` : x.name) : "(dự án đã xoá)"; };
  const projShort = (id) => { if (id === NO_PROJECT) return "Khác"; const x = projById.get(id); return x ? (x.code ? `${x.code} ${x.name}` : x.name) : "(đã xoá)"; };
  const taskLabel = (id) => { const t = taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  // Toàn bộ dòng giờ của tháng, gom theo (nhân sự, dự án)
  const base = useMemo(() => {
    const detail = [];
    for (const ymk of ymsBetween(from, to)) for (const e of cfg.employees) {
      const d = dbTsSent(e.id, ymk);   // v1.9: chỉ giờ của ngày đã gửi
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;
        const pid = isLeaveTask(r.taskId) ? NO_PROJECT : r.projectId;
        detail.push({ empId: e.id, date, hours: Number(h), projectId: pid, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, note: r.note || "" });
      }
    }
    return detail;
  }, [cfg.employees, from, to, dataTick]);

  const emps = cfg.employees.filter((e) => {
    if (fDept !== "all" && e.dept !== fDept) return false;
    const kw = norm(q.trim());   // v6.6: gõ không dấu vẫn tìm ra
    return !kw || norm(`${e.name} ${e.code || ""} ${e.dept} ${e.role || ""} ${roleTitle(e.role)}`).includes(kw);
  });

  const view = useMemo(() => {
    const ids = new Set(emps.map((e) => e.id));
    const cell = new Map();            // empId -> Map(projectId -> giờ)
    const projTot = new Map();
    const empTot = new Map();
    for (const d of base) {
      if (!ids.has(d.empId)) continue;
      if (!cell.has(d.empId)) cell.set(d.empId, new Map());
      const m = cell.get(d.empId); m.set(d.projectId, (m.get(d.projectId) || 0) + d.hours);
      projTot.set(d.projectId, (projTot.get(d.projectId) || 0) + d.hours);
      empTot.set(d.empId, (empTot.get(d.empId) || 0) + d.hours);
    }
    // cột dự án xếp theo giờ giảm dần, "Khác" luôn ở cuối
    const cols = [...projTot.keys()].filter((k) => k !== NO_PROJECT).sort((a, b) => projTot.get(b) - projTot.get(a));
    const hasLeave = projTot.has(NO_PROJECT);
    let max = 0; for (const m of cell.values()) for (const [k, v] of m) if (k !== NO_PROJECT && v > max) max = v;
    const grand = [...projTot.values()].reduce((a, b) => a + b, 0);
    return { cell, projTot, empTot, cols, hasLeave, max, grand };
  }, [base, emps.map((e) => e.id).join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps

  const shown = hideEmpty ? emps.filter((e) => (view.empTot.get(e.id) || 0) > 0) : emps;
  const allCols = [...view.cols, ...(view.hasLeave ? [NO_PROJECT] : [])];
  const n1 = (v) => (Math.round(v * 10) / 10).toString();
  const empsNoHours = emps.filter((e) => !(view.empTot.get(e.id) || 0)).length;

  const exportXlsx = async () => {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();
    const mtx = shown.map((e) => {
      const row = { "Mã": e.code || "", "Nhân sự": e.name, "Bộ phận": e.dept, "Vai trò": roleTitle(e.role) };
      const m = view.cell.get(e.id);
      for (const c of allCols) row[projLabel(c)] = m?.get(c) || 0;
      row["Tổng giờ"] = view.empTot.get(e.id) || 0;
      return row;
    });
    const tot = { "Mã": "", "Nhân sự": "TỔNG", "Bộ phận": "", "Vai trò": "" };
    for (const c of allCols) tot[projLabel(c)] = view.projTot.get(c) || 0;
    tot["Tổng giờ"] = shown.reduce((a, e) => a + (view.empTot.get(e.id) || 0), 0);
    mtx.push(tot);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mtx), "Ma trận");
    const ids = new Set(shown.map((e) => e.id));
    const empMap = new Map(cfg.employees.map((e) => [e.id, e]));
    const detail = base.filter((d) => ids.has(d.empId))
      .sort((a, b) => (empMap.get(a.empId)?.name || "").localeCompare(empMap.get(b.empId)?.name || "") || a.date.localeCompare(b.date))
      .map((d) => {
        const e = empMap.get(d.empId);
        return { "Mã": e?.code || "", "Nhân sự": e?.name || "(đã xoá)", "Bộ phận": e?.dept || "", "Vai trò": roleTitle(e?.role), "Ngày": d.date, "Thứ": DOW[(parseD(d.date).getDay() + 6) % 7],
          "Dự án": projLabel(d.projectId), "Giai đoạn": d.projectId === NO_PROJECT ? "" : phaseLabel(d.phaseId), "Hạng mục": taskLabel(d.taskId), "Ghi chú": d.note || "", "Giờ": d.hours };
      });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Chi tiết");
    const need = mondaysDue(ym);
    const st = shown.map((e) => { const miss = need.filter((m) => !weekDone(e.id, m)); return { "Nhân sự": e.name, "Vai trò": roleTitle(e.role), "Số tuần cần nộp": need.length, "Đã nộp": need.length - miss.length, "Thiếu": miss.length, "Tuần thiếu": miss.map(dLabel).join(", ") }; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(st), "Tình trạng nộp");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = `ARTIUS_ma-tran-gio-cong_${ym}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    flash("Đã xuất file Excel.");
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-800 p-3 md:flex-row md:items-center md:gap-3 md:p-4">
        <div className="relative min-w-0 md:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự" className={`pl-9 ${inputCls}`} />
        </div>
        <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={`md:w-48 ${selectCls}`}>
          <option value="all">Mọi bộ phận</option>
          {DEPTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="accent-teal-500" />
          Ẩn người chưa có giờ
        </label>
        <button onClick={exportXlsx} disabled={shown.length === 0} className={`md:ml-auto ${btnPrimary} disabled:opacity-40`}><Download size={15} /> Xuất Excel</button>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-3 py-2 text-xs text-slate-500 md:px-4">
        <span>{ymLabel(ym)}</span>
        <span>Tổng <span className="font-mono text-slate-200">{n1(view.grand)}</span> giờ</span>
        <span>{view.cols.length} dự án</span>
        {empsNoHours > 0 && <span className="text-amber-400">{empsNoHours} người chưa có giờ</span>}
      </div>

      {shown.length === 0 || allCols.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-slate-500">{shown.length === 0 ? "Không có nhân sự nào khớp bộ lọc." : "Tháng này chưa có giờ công nào được chấm."}</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[200px] border-b border-slate-800 bg-slate-900 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 md:px-4">Nhân sự</th>
                {allCols.map((c) => (
                  <th key={c} title={projLabel(c)} className={`min-w-[110px] max-w-[160px] border-b border-slate-800 px-2 py-2 text-right text-[11px] font-medium ${c === NO_PROJECT ? "text-sky-400" : "text-slate-400"}`}>
                    <div className="truncate">{projShort(c)}</div>
                  </th>
                ))}
                <th className="min-w-[80px] border-b border-slate-800 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-slate-500 md:px-4">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const m = view.cell.get(e.id); const tot = view.empTot.get(e.id) || 0;
                return (
                  <tr key={e.id} className="group">
                    <td className="sticky left-0 z-10 border-b border-slate-800/70 bg-slate-900 px-3 py-1.5 md:px-4">
                      <button onClick={() => onPickEmp(e.id)} title="Xem và sửa bảng công chi tiết" className="block w-full text-left">
                        <span className="block truncate font-medium text-slate-100 group-hover:text-teal-300">{e.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{e.dept}{e.role ? ` · ${e.role}` : ""}</span>
                      </button>
                    </td>
                    {allCols.map((c) => {
                      const v = m?.get(c) || 0;
                      const bg = v && c !== NO_PROJECT && view.max ? { backgroundColor: `rgba(20,184,166,${0.08 + 0.4 * (v / view.max)})` } : v ? { backgroundColor: "rgba(56,189,248,0.12)" } : undefined;
                      return <td key={c} style={bg} className={`border-b border-slate-800/70 px-2 py-1.5 text-right font-mono text-xs ${v ? "text-slate-100" : "text-slate-700"}`}>{v ? n1(v) : "·"}</td>;
                    })}
                    <td className={`border-b border-slate-800/70 px-3 py-1.5 text-right font-mono text-xs font-medium md:px-4 ${tot ? "text-teal-300" : "text-amber-500"}`}>{tot ? n1(tot) : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-400 md:px-4">Tổng</td>
                {allCols.map((c) => <td key={c} className="px-2 py-2 text-right font-mono text-xs font-medium text-slate-200">{n1(view.projTot.get(c) || 0)}</td>)}
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-teal-300 md:px-4">{n1(shown.reduce((a, e) => a + (view.empTot.get(e.id) || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* v5.9 — Tổng quan bảng công (quản lý). Thay khung "Tình trạng nộp bảng công" + Ma trận giờ công cũ.
   · Tuần: lưới ngày T2 → CN, mỗi ô ghi giờ đã gửi của ngày (tăng ca ghi "+h" xanh ngọc); cuối dòng: tổng / chuẩn,
     trạng thái nộp tuần và cột Nhắc (chuông — rê chuột xem lý do; bấm gửi thông báo nhắc qua /api/push "nudge").
   · Tháng: lịch nhiệt — mỗi ngày một ô nhỏ cùng bộ màu với ô tuần; bên phải tổng / chuẩn và chấm trạng thái nộp từng
     tuần (bấm chấm → mở tuần đó ở chế độ Tuần).
   Màu ô (dùng chung hai chế độ): đủ giờ (xanh dương nhạt) · thiếu giờ (viền vàng) · nháp chưa gửi (sọc vàng) ·
   bỏ trống (viền đỏ) · nghỉ phép (xanh nhạt, "P") · ngày lễ (sọc xám, "Lễ") · CN / chưa tới (trống).
   Chỉ giờ của ngày ĐÃ GỬI được cộng vào tổng; giờ đã lưu nhưng chưa gửi hiện là "nháp". */
const DAY_ST = {
  full: { background: "#60a5fa26", color: "#dbeafe" },
  part: { background: "#fbbf2414", color: "#fbbf24", boxShadow: "inset 0 0 0 1px #fbbf2455" },
  draft: { color: "#64748b", fontWeight: 500, border: "1.5px dashed #94a3b880" },   // v6.9: viền nét đứt như bảng Tháng   // v6.7: nháp chỉ hiện số mờ, không tô màu cảnh báo
  none: { background: "#fb71850f", color: "#fb7185", boxShadow: "inset 0 0 0 1px #fb718540" },
  leave: { background: "#fb923c1f", color: "#fb923c", boxShadow: "inset 0 0 0 1px #fb923c40" },   // v6.4: cam đất, tách khỏi xanh "đủ giờ"
  hol: { background: "repeating-linear-gradient(45deg,#cbd5e112 0 4px,transparent 4px 8px)", color: "#cbd5e1", boxShadow: "inset 0 0 0 1px #cbd5e140" },
  off: { color: "#334155" },
  fut: { color: "#334155", boxShadow: "inset 0 0 0 1px #1e293b80" },
};
/* v7.8 — bộ màu ô cho giao diện Sáng (chữ đậm trên nền nhạt) */
const DAY_ST_L = {
  full: { background: "#3b82f61f", color: "#1d4ed8" },
  part: { background: "#f59e0b1f", color: "#b45309", boxShadow: "inset 0 0 0 1px #d9770666" },
  draft: { color: "#64748b", fontWeight: 500, border: "1.5px dashed #94a3b8" },
  none: { background: "#fff1f2", color: "#e11d48", boxShadow: "inset 0 0 0 1px #fecdd3" },   // v7.9: nhạt hơn
  leave: { background: "#cbd5e1", color: "#334155", boxShadow: "inset 0 0 0 1px #94a3b8" },   // v7.9: nghỉ phép xám xanh (tách khỏi thiếu giờ vàng và giờ cố gắng tím)
  hol: { background: "repeating-linear-gradient(45deg,#64748b22 0 4px,transparent 4px 8px)", color: "#64748b", boxShadow: "inset 0 0 0 1px #64748b40" },
  off: { color: "#cbd5e1" },
  fut: { color: "#cbd5e1", boxShadow: "inset 0 0 0 1px #e2e8f0" },
};
const DAY_ST_SM_L = {
  full: { background: "#3b82f633" },
  part: { background: "#fde68a", boxShadow: "inset 0 0 0 1px #f59e0b" },   // v7.9: thiếu giờ vàng đậm
  draft: { border: "1.5px dashed #94a3b8" },
  none: { background: "#fecdd380" },   // bỏ trống: nền hồng nhạt, không viền — đỡ rối khi cả tháng
  leave: { background: "#cbd5e1", boxShadow: "inset 0 0 0 1px #94a3b8" },
  hol: { background: "repeating-linear-gradient(45deg,#64748b30 0 3px,transparent 3px 6px)" },
  off: { background: "#e2e8f080" },
  fut: { background: "#fff", boxShadow: "inset 0 0 0 1px #e2e8f0" },
};
/* v7.9 — hôm nay ở bảng Tháng (giao diện Sáng): số ngày trong chip đen; dải xám liền một khối chạy dọc cả cột (vẽ ở TimesheetBoard) */
const TODAY_BAND = "#e2e8f0";
const TODAY_CHIP = { background: "#0f172a", color: "#fff", fontWeight: 700, borderRadius: 999 };
const dayStyle = (k) => (isLight() ? DAY_ST_L : DAY_ST)[k];
const dayStyleSm = (k) => (isLight() ? DAY_ST_SM_L : DAY_ST_SM)[k];
/* ô nhỏ của chế độ Tháng: cùng bộ màu, đậm hơn một chút để thấy rõ ở kích thước 22px */
const DAY_ST_SM = {
  full: { background: "#60a5fa38" },
  part: { background: "#fbbf2420", boxShadow: "inset 0 0 0 1px #fbbf2466" },
  draft: { border: "1.5px dashed #94a3b880" },   // v6.9: nháp = viền nét đứt xám nhạt, tách khỏi ô Chủ nhật
  none: { boxShadow: "inset 0 0 0 1px #fb718566" },
  leave: { background: "#fb923c40", boxShadow: "inset 0 0 0 1px #fb923c66" },
  hol: { background: "repeating-linear-gradient(45deg,#cbd5e133 0 3px,transparent 3px 6px)" },
  off: { background: "#1e293b33" },
  fut: { boxShadow: "inset 0 0 0 1px #1e293b80" },
};
/* v7.8 — chấm "Nộp từng tuần" ở giao diện Sáng: cùng bộ màu đặc với nhãn trạng thái */
const WEEK_DOT_L = { ok: "#059669", dr: "#f59e0b", gap: "#f59e0b", no: "#e11d48", fut: "#e2e8f0" };
const weekDot = (ws) => (isLight() ? WEEK_DOT_L[ws] : WEEK_ST[ws][2]);
const WEEK_ST = {
  ok: ["Đã nộp", "border-teal-900 bg-teal-950 text-teal-300", "#2dd4bf"],
  dr: ["Còn nháp", "border-amber-900 bg-amber-950/70 text-amber-300", "#fbbf24"],
  gap: ["Bỏ trống ngày", "border-amber-900 bg-amber-950/70 text-amber-300", "#fbbf24"],
  no: ["Chưa nộp", "border-rose-900 bg-rose-950 text-rose-300", "#fb7185"],
  fut: ["—", "", "#1e293b"],
};
const DOW_OF = (d) => DOW[(parseD(d).getDay() + 6) % 7];
/* v5.9 — quản lý mở khoá cả tuần của một nhân sự từ Tổng quan bảng công (giống nút "Mở khoá tuần này" ở Chi tiết nhân viên):
   gỡ dấu đã gửi của 7 ngày + dấu tuần kiểu cũ; giờ công giữ nguyên, nhân sự sửa và gửi lại được. Đọc lại bản mới nhất trước khi ghi. */
const unlockWeekTs = async (empId, monday) => {
  const wd = weekDays(monday), yms = [...new Set(wd.map(ymOf))];
  if (!(await refreshTs(empId, yms))) return false;
  const changes = {};
  for (const ym of yms) {
    const b = dbTs(empId, ym); if (!b) continue;
    const sent = { ...(b.sent || {}) }, weeks = { ...(b.weeks || {}) };
    for (const d of wd) if (ymOf(d) === ym) delete sent[d];
    delete weeks[monday];
    changes[slot(empId, ym)] = { ...b, sent, weeks };
  }
  const ok = await commitTs(changes);
  bumpData();
  return ok;
};

/* v6.0 — sửa nhanh một ô ngày (quản lý): ghi giờ của ngày `d` cho các dòng `vals` { "<khoá dòng>": giờ }.
   Đọc lại bản mới nhất trước khi ghi; giữ nguyên dấu đã gửi của ngày (giống quản lý sửa ở Chi tiết nhân viên);
   ngày không còn giờ nào thì bỏ dấu đã gửi. Dòng không còn giờ nào trong tháng thì bỏ. */
const tsRowKey = (r) => `${r.projectId}|${r.phaseId || DEFAULT_PHASE}|${r.taskId}|${r.otFor || ""}`;
const saveDayTs = async (empId, d, vals) => {
  const ym = ymOf(d);
  if (!(await refreshTs(empId, [ym]))) return false;
  const b = dbTs(empId, ym) || { rows: [], weeks: {}, sent: {} };
  const rows = (b.rows || []).map((r) => {
    const k = tsRowKey(r);
    if (!(k in vals)) return r;
    const days = { ...r.days }, h = Number(vals[k]) || 0;
    if (h > 0) days[d] = h; else delete days[d];
    return { ...r, days };
  }).filter((r) => Object.values(r.days || {}).some((v) => Number(v) > 0));
  const sent = { ...(b.sent || {}) };
  if (!rows.some((r) => Number(r.days[d]) > 0)) delete sent[d];
  const ok = await commitTs({ [slot(empId, ym)]: { ...b, rows, sent } });
  bumpData();
  return ok;
};

/* v7.3 — readOnly: BOD chỉ xem (không sửa nhanh, không mở ngăn kéo, không mở khoá, không nhắc).
          oneDept: trưởng phòng — cfg.employees đã lọc còn phòng của mình, ẩn ô chọn bộ phận. */
function TimesheetBoard({ cfg, flash, onDirtyChange, readOnly = false, oneDept = false }) {
  const dataTick = useDataTick();
  const today = fmt(new Date());
  const [mode, setMode] = useState("week");                     // week | month
  const [monday, setMonday] = useState(fmt(mondayOf(new Date())));
  const [ym, setYm] = useState(ymOf(today));
  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("all");
  const [tip, setTip] = useState(null);                         // { eid, d, x, y } — thẻ chi tiết một ngày
  const [nudged, setNudged] = useState(() => new Map());        // empId -> giờ đã nhắc (tuần đang xem)
  const [nudging, setNudging] = useState(false);
  /* v7.7 — chuông bấm lại được, cách nhau tối thiểu NUDGE_GAP_MIN phút cho mỗi người; đồng hồ nhịp 20s để chuông tự sáng lại */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 20000); return () => clearInterval(t); }, []);
  const gapMs = NUDGE_GAP_MIN * 60000;
  const nudgeAgain = (at) => (at ? new Date(at).getTime() + gapMs : 0);          // thời điểm được nhắc lại
  const cooling = (at) => !!at && nudgeAgain(at) > nowMs;
  const hhmm = (v) => new Date(v).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const laterIso = (a, b) => (!a || (b && b > a) ? b : a);
  const [mNudged, setMNudged] = useState(() => new Map());      // v6.4: empId -> Map(thứ Hai tuần -> giờ đã nhắc), các tuần của tháng đang xem
  const [unlockFor, setUnlockFor] = useState(null);             // empId đang chờ xác nhận mở khoá tuần
  const [drawer, setDrawer] = useState(null);                   // v6.0 (A): empId đang mở ngăn kéo sửa cả tuần
  const [drawerDirty, setDrawerDirty] = useState(false);
  /* v7.9 — giao diện Sáng, bảng Tháng: một dải xám bo góc chạy liền từ số ngày hôm nay xuống hết bảng (nằm dưới các ô) */
  const mWrapRef = useRef(null);
  const [band, setBand] = useState(null);
  const [bandTick, setBandTick] = useState(0);
  useEffect(() => { const f = () => setBandTick((n) => n + 1); window.addEventListener("resize", f); window.addEventListener("artius:theme", f); return () => { window.removeEventListener("resize", f); window.removeEventListener("artius:theme", f); }; }, []);
  useLayoutEffect(() => {
    const w = mWrapRef.current, h = w?.querySelector("[data-today-head]"), t = w?.querySelector("table");
    let nb = null;
    if (w && h && t && isLight()) {
      const wr = w.getBoundingClientRect(), hr = h.getBoundingClientRect(), tr = t.getBoundingClientRect();
      nb = { left: Math.round(hr.left - wr.left + w.scrollLeft - 3), top: Math.round(hr.top - wr.top - 4), width: Math.round(hr.width + 6), height: Math.round(tr.bottom - hr.top + 2) };
    }
    if (JSON.stringify(nb) !== JSON.stringify(band)) setBand(nb);
  });   // đo lại sau mỗi lần vẽ; chỉ setState khi vị trí đổi
  const [leaveAsk, setLeaveAsk] = useState(false);              // đang hỏi bỏ thay đổi chưa lưu
  const [pop, setPop] = useState(null);                         // v6.0 (C): { eid, d, x, y, items, vals } — sửa nhanh một ô ngày
  const [popSaving, setPopSaving] = useState(false);
  const popRef = useRef(null);
  /* v6.1 — hộp sửa nhanh luôn nằm trọn trong màn hình: đo chiều cao thật rồi đặt dưới ô; không đủ chỗ thì lật lên trên ô;
     vẫn không đủ thì kẹp sát mép và cho cuộn bên trong hộp */
  useLayoutEffect(() => {
    const el = popRef.current; if (!el || !pop) return;
    const h = el.offsetHeight, vh = window.innerHeight, m = 8;
    let top = pop.cellBottom + 6;
    if (top + h > vh - m) top = pop.cellTop - 6 - h;
    if (top < m) top = Math.max(m, vh - m - h);
    el.style.top = `${top}px`; el.style.visibility = "visible";
  }, [pop?.eid, pop?.d, pop?.items?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loadTick, setLoadTick] = useState(0);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const hs = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const lim = allocLimits(cfg);
  const days = mode === "week" ? weekDays(monday) : (() => { const a = parseD(`${ym}-01`), b = lastOfMonth(a); const o = []; for (let d = a; d <= b; d = addDays(d, 1)) o.push(fmt(d)); return o; })();
  const from = days[0], to = days[days.length - 1];
  const weeks = mode === "week" ? [monday] : mondaysOfMonth(ym);
  const rangeYms = ymsBetween(weeks[0], fmt(addDays(parseD(weeks[weeks.length - 1]), 6)));
  useEffect(() => { ensureMonths([prevYm(rangeYms[0]), ...rangeYms]).then(() => setLoadTick((t) => t + 1)); }, [rangeYms.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const projById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskById = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes, cfg.otBands, cfg.otLegacy]);
  const tName = (id) => { const t = taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };
  const pName = (id) => { if (!id || id === NO_PROJECT) return "Việc chung"; const p = projById.get(id); return p ? (p.code ? `${p.code} · ${p.name}` : p.name) : "(dự án đã xoá)"; };

  /* giờ từng người × ngày trong các tuần đang xem: reg (giờ thường đã gửi), ot, leave (vắng mặt đã gửi), draft (đã lưu, chưa gửi) */
  const cellOf = useMemo(() => {
    const m = new Map();
    const lo = weeks[0], hi = fmt(addDays(parseD(weeks[weeks.length - 1]), 6));
    for (const e of cfg.employees) for (const y of ymsBetween(lo, hi)) {
      const b = dbTs(e.id, y); if (!b?.rows) continue;
      const sent = b.sent || {};
      for (const r of b.rows) for (const [d, hv] of Object.entries(r.days || {})) {
        const h = Number(hv) || 0; if (h <= 0 || d < lo || d > hi) continue;
        const k = `${e.id}|${d}`;
        const c = m.get(k) || { reg: 0, ot: 0, leave: 0, draft: 0, idle: 0, items: [] };
        const ok = !!sent[d];
        if (!ok) c.draft += h; else if (isOtId(r.taskId)) c.ot += h; else if (isLeaveTask(r.taskId)) c.leave += h; else { c.reg += h; if (isIdleTask(r.taskId)) c.idle += h; }
        c.items.push({ ot: isOtId(r.taskId), sent: ok, h,
          label: isOtId(r.taskId) ? `Tăng ca · ${r.otFor ? tName(r.otFor) : "chưa rõ tác vụ"}` : isLeaveTask(r.taskId) ? tName(r.taskId) : `${pName(r.projectId)} · ${tName(r.taskId)}` });
        m.set(k, c);
      }
    }
    return m;
  }, [cfg.employees, weeks.join(","), dataTick, loadTick, taskById, projById]); // eslint-disable-line react-hooks/exhaustive-deps

  /* v6.4: hôm nay chỉ tính vào giờ chuẩn khi đã có giờ gửi — trước đây tính luôn nên ai cũng "thiếu 8 h" cả ngày */
  const stdOf = (d, eid) => {
    if (d > today) return 0;
    if (d === today && eid) { const c = cellOf.get(`${eid}|${d}`); if (!c || c.reg + c.leave + c.ot <= 0) return 0; }
    return minHoursFor(d, hoursCfg, hs) || 0;
  };
  const dayInfo = (eid, d) => {
    const c = cellOf.get(`${eid}|${d}`) || { reg: 0, ot: 0, leave: 0, draft: 0, idle: 0, items: [] };
    const std = minHoursFor(d, hoursCfg, hs) || 0, done = c.reg + c.leave;
    let st;
    if (hs.has(d)) st = "hol";
    else if (d > today) st = "fut";
    else if (d === today && done + c.ot + c.draft === 0) st = "fut";   // v6.4: hôm nay chưa chấm — chưa coi là bỏ trống
    else if (!std) st = done + c.ot > 0 ? (c.draft ? "draft" : "full") : c.draft ? "draft" : "off";
    else if (c.leave > 0 && c.reg === 0 && !c.draft) st = "leave";
    else if (done >= std) st = "full";
    else if (c.draft > 0) st = "draft";
    else st = done > 0 ? "part" : "none";
    const eff = effortHoursFor(d, c.reg - (c.idle || 0), hoursCfg, hs);   // v7.2: trừ chờ việc · v6.4: giờ cố gắng (giờ làm việc thường vượt ngưỡng ngày, đã gửi)
    return { ...c, std, done, st, eff };
  };
  const sumOf = (eid, list) => {
    let reg = 0, ot = 0, std = 0, miss = [], draft = 0, eff = 0, idle = 0;
    for (const d of list) {
      const x = dayInfo(eid, d); reg += x.done; ot += x.ot; draft += x.draft; eff += x.eff; idle += x.idle || 0; std += stdOf(d, eid);
      if (d < today && stdOf(d) > 0 && x.done === 0 && x.draft === 0) miss.push(d);   // v6.4: hôm nay chưa tính là bỏ trống
    }
    return { reg, ot, t: reg + ot, std, miss, draft, eff, idle, base: reg - eff };
  };
  const weekState = (eid, mon) => {
    if (mon > today) return "fut";
    if (weekDone(eid, mon)) return "ok";
    const s = sumOf(eid, weekDays(mon));
    if (s.draft > 0) return "dr";
    return s.reg + s.ot > 0 ? "gap" : "no";
  };
  /* lý do cần nhắc trong tuần đang xem (rỗng = không cần nhắc) */
  const reasons = (eid) => {
    const wd = weekDays(monday), s = sumOf(eid, wd), out = [];
    const due = wd.filter((d) => d < today && stdOf(d) > 0);
    if (due.length && s.miss.length === due.length) out.push("Chưa chấm cả tuần");
    else if (s.miss.length) out.push(`Bỏ trống ${s.miss.map((d) => `${DOW_OF(d)} ${dLabel(d)}`).join(", ")}`);
    if (s.draft > 0) out.push(`Còn ${fmtH(s.draft)} h nháp — chưa bấm gửi`);
    if (!out.length && s.std > 0 && s.base < (s.std * lim.under) / 100) out.push(`Thiếu ${fmtH(s.std - s.base)} h giờ chuẩn`);
    return out;
  };

  const emps = cfg.employees.filter((e) => {
    if (fDept !== "all" && (e.dept || "") !== fDept) return false;
    const kw = norm(q.trim());   // v6.6: gõ không dấu vẫn tìm ra
    return !kw || norm(`${e.name} ${e.code || ""} ${e.dept || ""} ${e.role || ""} ${roleTitle(e.role)}`).includes(kw);
  });
  const groups = [...DEPTS, ""].map((d) => ({ dept: d || "Khác", items: emps.filter((e) => (DEPTS.includes(e.dept) ? e.dept : "") === d) })).filter((g) => g.items.length);

  /* KPI của kỳ đang xem */
  const sums = new Map(emps.map((e) => [e.id, sumOf(e.id, days)]));
  // v6.5: "Đã nộp đủ" xét các tuần đã qua (hết Chủ nhật) — tuần đang chạy chưa tới hạn nộp (cùng quy tắc chuông Nhắc tháng)
  const due = mode === "week" ? weeks.filter((m) => m <= today) : weeks.filter((m) => fmt(addDays(parseD(m), 6)) < today);
  const okN = emps.filter((e) => due.every((m) => weekDone(e.id, m))).length;
  const totT = [...sums.values()].reduce((a, s) => a + s.t, 0), totStd = [...sums.values()].reduce((a, s) => a + s.std, 0), totOt = [...sums.values()].reduce((a, s) => a + s.ot, 0);
  const lowN = [...sums.values()].filter((s) => s.std > 0 && s.base + s.draft < (s.std * lim.under) / 100).length;   // v6.7: nháp không tính là thiếu

  /* nhắc đã gửi trong tuần đang xem (đọc nhật ký nhắc — quản lý đọc được) */
  useEffect(() => {
    let alive = true;
    fetchNudgeLog(monday).then((rows) => { if (alive) setNudged(rows.reduce((m, r) => m.set(r.emp_id, laterIso(m.get(r.emp_id), r.sent_at)), new Map())); }).catch(() => {});
    return () => { alive = false; };
  }, [monday]);
  /* v6.4 — chuông ở bảng Tháng: các tuần đã qua (hết Chủ nhật) chưa nộp đủ; bấm một lần nhắc gộp mọi tuần đó */
  const monthKey = mode === "month" ? weeks.join(",") : "";
  useEffect(() => {
    if (!monthKey) return;
    let alive = true;
    const ws = monthKey.split(",");
    fetchNudgeLogRange(ws[0], ws[ws.length - 1]).then((rows) => {
      if (!alive) return;
      const m = new Map();
      for (const r of rows) { const wk = String(r.period || "").slice(0, 10); if (!m.has(r.emp_id)) m.set(r.emp_id, new Map()); const mm = m.get(r.emp_id); mm.set(wk, laterIso(mm.get(wk), r.sent_at)); }
      setMNudged(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, [monthKey]);
  const missWeeks = (eid) => weeks.filter((m) => fmt(addDays(parseD(m), 6)) < today && !weekDone(eid, m));
  const monthBell = (eid) => {
    const mw = missWeeks(eid), log = mNudged.get(eid) || new Map();
    const last = [...log.values()].filter(Boolean).sort().pop();      // lần nhắc gần nhất của người này trong tháng
    return { mw, last, wait: cooling(last), again: nudgeAgain(last) };
  };
  const mToNudge = mode === "month" ? emps.filter((e) => { const b = monthBell(e.id); return b.mw.length > 0 && !b.wait; }).map((e) => e.id) : [];
  const nudgeMonth = async (ids) => {
    ids = ids.filter((id) => !monthBell(id).wait);
    if (!ids.length || nudging) return;
    setNudging(true);
    const groupsBy = new Map();   // cùng danh sách tuần thiếu → một lệnh gửi
    for (const id of ids) { const mw = missWeeks(id); if (!mw.length || monthBell(id).wait) continue; const k = mw.join(","); if (!groupsBy.has(k)) groupsBy.set(k, []); groupsBy.get(k).push(id); }
    const sent = [], noDev = [];
    try {
      for (const [k, gids] of groupsBy) {
        const ws = k.split(",");
        const r = await sendNudge(gids, ws[0], fmt(addDays(parseD(ws[ws.length - 1]), 6)), ws);
        sent.push(...(r.sent || [])); noDev.push(...(r.noDevice || []));
        const at = new Date().toISOString();
        setMNudged((m) => { const n = new Map(m); for (const id of r.sent || []) { const x = new Map(n.get(id) || []); for (const w of ws) x.set(w, at); n.set(id, x); } return n; });
      }
      const nm = (id) => cfg.employees.find((e) => e.id === id)?.name || id;
      if (noDev.length) flash(`${sent.length ? `Đã nhắc ${sent.length} người. ` : ""}Chưa bật thông báo trên máy nào: ${noDev.map(nm).join(", ")}.`, sent.length ? "ok" : "err");
      else flash(ids.length === 1 ? `Đã nhắc ${nm(ids[0])} nộp ${missWeeks(ids[0]).length} tuần.` : `Đã nhắc ${sent.length} người.`);
    } catch (e) { flash(`Chưa gửi được nhắc nhở — ${e.message}`, "err"); }
    setNudging(false);
  };
  const needIds = mode === "week" ? emps.filter((e) => reasons(e.id).length > 0).map((e) => e.id) : [];
  const toNudge = needIds.filter((id) => !cooling(nudged.get(id)));
  const nudge = async (ids) => {
    ids = ids.filter((id) => !cooling(nudged.get(id)));
    if (!ids.length || nudging) return;
    setNudging(true);
    try {
      const r = await sendNudge(ids, monday, fmt(addDays(parseD(monday), 6)));
      const at = new Date().toISOString();
      setNudged((m) => { const n = new Map(m); for (const id of r.sent || []) n.set(id, at); return n; });
      const nm = (id) => cfg.employees.find((e) => e.id === id)?.name || id;
      if (r.noDevice?.length) flash(`${r.sent?.length ? `Đã nhắc ${r.sent.length} người. ` : ""}Chưa bật thông báo trên máy nào: ${r.noDevice.map(nm).join(", ")}.`, r.sent?.length ? "ok" : "err");
      else flash(ids.length === 1 ? `Đã nhắc ${nm(ids[0])}.` : `Đã nhắc ${r.sent?.length || 0} người.`);
    } catch (e) { flash(`Chưa gửi được nhắc nhở — ${e.message}`, "err"); }
    setNudging(false);
  };

  const exportXlsx = async () => {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();
    const LBL = { full: "", part: "thiếu", draft: "nháp", none: "bỏ trống", leave: "nghỉ phép", hol: "lễ", off: "", fut: "" };
    const grid = emps.map((e) => {
      const row = { "Mã": e.code || "", "Nhân sự": e.name, "Bộ phận": e.dept || "", "Vai trò": roleTitle(e.role) };
      for (const d of days) { const x = dayInfo(e.id, d); row[`${DOW_OF(d)} ${dLabel(d)}`] = x.done + x.ot ? +(x.done + x.ot).toFixed(2) : LBL[x.st] || ""; }
      const s = sums.get(e.id);
      row["Giờ đã gửi"] = +s.t.toFixed(2); row["Trong đó tăng ca"] = +s.ot.toFixed(2); row["Giờ chuẩn tới hôm nay"] = s.std;
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grid), "Bảng công");
    const detail = [];
    for (const e of emps) for (const d of days) for (const it of (cellOf.get(`${e.id}|${d}`)?.items || [])) {
      detail.push({ "Nhân sự": e.name, "Bộ phận": e.dept || "", "Ngày": d, "Thứ": DOW_OF(d), "Dự án · tác vụ": it.label, "Giờ": it.h, "Trạng thái": it.sent ? "Đã gửi" : "Nháp" });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail.length ? detail : [{ "Nhân sự": "(chưa có giờ)" }]), "Chi tiết");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map((e) => {
      const row = { "Nhân sự": e.name, "Bộ phận": e.dept || "" };
      for (const m of weeks) row[`Tuần ${dLabel(m)}`] = WEEK_ST[weekState(e.id, m)][0];
      return row;
    })), "Tình trạng nộp");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = `ARTIUS_bang-cong_${from}_den_${to}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    flash("Đã xuất file Excel.");
  };

  const shift = (n) => {
    if (mode === "week") setMonday(fmt(addDays(parseD(monday), 7 * n)));
    else { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
  };
  const isNow = mode === "week" ? monday === fmt(mondayOf(new Date())) : ym === ymOf(today);
  const perLabel = mode === "week" ? `Tuần ${dLabel(monday)} – ${dLabel(fmt(addDays(parseD(monday), 6)))}` : ymLabel(ym);
  const switchMode = (m) => { if (m === "month") setYm(ymOf(monday)); else setMonday(fmt(mondayOf(ym === ymOf(today) ? new Date() : parseD(`${ym}-01`)))); setMode(m); };

  /* v6.4 — thanh Tổng / chuẩn chia khúc: Chuẩn (xanh dương: làm việc + vắng mặt) · phần còn thiếu (sọc vàng)
     · Cố gắng (tím) · OT (xanh ngọc). Không đổi cả thanh sang vàng nữa; chữ "thiếu x h" khi dưới giờ chuẩn. */
  const totCell = (s) => {
    // v6.7: giờ nháp (chưa gửi) không vẽ vào thanh và không tính là "thiếu" — chỉ thiếu thật khi kể cả nháp vẫn chưa đủ chuẩn
    const base = Math.max(0, s.base), miss = Math.max(0, s.std - base - (s.draft || 0));
    const W = Math.max(s.std, base + s.eff + s.ot) || 1, w = (h) => `${(h / W) * 100}%`;
    const low = s.std > 0 && base + (s.draft || 0) < (s.std * lim.under) / 100;
    // v7.2: chờ việc là khúc xám nằm ngay sau khúc giờ chuẩn (vẫn tính là giờ công, không bị coi là thiếu)
    const shown = Math.min(base, s.std) || base, idle = Math.min(s.idle || 0, shown), blue = shown - idle;
    return (
      <div className="min-w-[150px]" title={`Chuẩn ${fmtH(blue)} h${idle ? ` · chờ việc ${fmtH(idle)} h` : ""} · cố gắng ${fmtH(s.eff)} h · OT ${fmtH(s.ot)} h${miss ? ` · thiếu ${fmtH(miss)} h` : ""}`}>
        <div className="whitespace-nowrap font-mono text-sm"><span className="font-semibold text-slate-100">{fmtH(s.t)}</span><span className="text-slate-500"> / {fmtH(s.std)} h</span>
          {idle > 0 && <span className="ml-1.5 text-[11px] text-slate-400">chờ {fmtH(idle)}</span>}
          {miss > 0 && <span className={`miss-txt ml-1.5 text-[11px] ${low ? "text-amber-400" : "text-slate-500"}`}>thiếu {fmtH(miss)}</span>}</div>
        <div className="mt-1 flex h-[6px] gap-px overflow-hidden rounded-full bg-slate-800">
          {blue > 0 && <i className="block h-full bg-blue-400" style={{ width: w(blue) }} />}
          {idle > 0 && <i className="block h-full bg-slate-400" style={{ width: w(idle) }} />}
          {miss > 0 && <i className="block h-full" style={isLight() ? { width: w(miss), background: "#fed7aa" } : { width: w(miss), boxShadow: "inset 0 0 0 1px #fbbf24aa", background: "repeating-linear-gradient(135deg,#fbbf2433 0 3px,transparent 3px 6px)" }} />}
          {s.eff > 0 && <i className="block h-full bg-violet-400" style={{ width: w(s.eff) }} />}
          {s.ot > 0 && <i className="block h-full bg-teal-400" style={{ width: w(s.ot) }} />}
        </div>
      </div>
    );
  };
  const dayHandlers = (eid, d) => ({
    onMouseMove: (e) => { if (!pop) setTip({ eid, d, x: e.clientX, y: e.clientY }); },
    onMouseLeave: () => setTip(null),
    onClick: (e) => openPop(eid, d, e),
  });
  /* v6.0 (C) — bấm một ô ngày: hộp sửa nhanh các dòng giờ của ngày đó (dòng có giờ trong tuần của ngày) */
  const openPop = (eid, d, ev) => {
    if (readOnly || d > today) return;
    const wd = weekDays(fmt(mondayOf(parseD(d)))), b = dbTs(eid, ymOf(d));
    const items = (b?.rows || []).filter((r) => wd.some((x) => Number(r.days?.[x]) > 0)).map((r) => ({
      key: tsRowKey(r), ot: isOtId(r.taskId),
      label: isOtId(r.taskId) ? `Tăng ca · ${r.otFor ? tName(r.otFor) : "chưa rõ tác vụ"}` : isLeaveTask(r.taskId) ? tName(r.taskId) : tName(r.taskId),
      sub: isLeaveTask(r.taskId) ? "Vắng mặt" : `${pName(r.projectId)}${r.projectId && r.projectId !== NO_PROJECT ? ` · ${r.phaseId || DEFAULT_PHASE}` : ""}`,
      h: Number(r.days?.[d]) || 0,
    })).sort((a, b2) => (a.ot - b2.ot) || b2.h - a.h);
    const rect = ev.currentTarget.getBoundingClientRect();
    const W = 360, x = Math.min(window.innerWidth - W - 8, Math.max(8, rect.left));
    setTip(null);
    setPop({ eid, d, x, y: rect.bottom + 6, cellTop: rect.top, cellBottom: rect.bottom, items, vals: Object.fromEntries(items.map((it) => [it.key, it.h ? String(it.h) : ""])) });
  };
  const savePop = async () => {
    if (!pop || popSaving) return;
    for (const v of Object.values(pop.vals)) { const n = Number(v || 0); if (!(n >= 0 && n <= 24)) return flash("Giờ phải từ 0 đến 24.", "err"); }
    const changed = Object.fromEntries(pop.items.filter((it) => (Number(pop.vals[it.key]) || 0) !== it.h).map((it) => [it.key, Number(pop.vals[it.key]) || 0]));
    if (!Object.keys(changed).length) { setPop(null); return; }
    setPopSaving(true);
    const ok = await saveDayTs(pop.eid, pop.d, changed);
    setPopSaving(false);
    if (ok) { setPop(null); setLoadTick((t) => t + 1); flash(`Đã lưu giờ ${DOW_OF(pop.d)} ${dLabel(pop.d)} — ${cfg.employees.find((e) => e.id === pop.eid)?.name || ""}.`); }
    else flash(`Chưa lưu được — ${LAST_STORAGE_ERROR || "mất kết nối"}`, "err");
  };
  /* v6.0 (A) — ngăn kéo sửa cả tuần: dùng lại đúng bảng sửa của Chi tiết nhân viên (quản lý) */
  const drawerDirtyCb = useCallback((v) => { setDrawerDirty(v); onDirtyChange?.(v); }, [onDirtyChange]);
  const openDrawer = (eid) => { if (readOnly) return; setPop(null); setTip(null); setDrawer(eid); };
  const closeDrawer = (force = false) => {
    if (drawerDirty && !force) { setLeaveAsk(true); return; }
    setLeaveAsk(false); setDrawer(null); setDrawerDirty(false); onDirtyChange?.(false); setLoadTick((t) => t + 1);
  };
  const stepDrawer = (n) => {
    if (drawerDirty) { setLeaveAsk(true); return; }
    const i = emps.findIndex((e) => e.id === drawer), nx = emps[(i + n + emps.length) % emps.length];
    if (nx) { setDrawer(nx.id); setLoadTick((t) => t + 1); }
  };
  useEffect(() => {
    if (!drawer && !pop) return;
    const h = (e) => { if (e.key === "Escape") { if (pop) setPop(null); else closeDrawer(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });
  const Legend = () => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-800 px-3 py-2 text-xs text-slate-400 md:px-4">
      {[["full", "Đủ giờ chuẩn"], ["part", "Thiếu giờ"], ["draft", "Nháp chưa gửi"], ["none", "Bỏ trống"], ["leave", "Nghỉ phép"], ["hol", "Ngày lễ"], ["fut", "CN / chưa tới"]].map(([k, l]) => (
        <span key={k} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px]" style={dayStyleSm(k)} />{l}</span>
      ))}
      <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-teal-400" />Tăng ca (ô tuần ghi <span className="font-mono text-teal-400">+h</span>)</span>
      <span className="flex items-center gap-1.5 text-slate-500">Thanh tổng:
        <i className="ml-1 inline-block h-2 w-3 rounded-sm bg-blue-400" />chuẩn
        <i className="ml-1 inline-block h-2 w-3 rounded-sm bg-violet-400" />cố gắng
        <i className="ml-1 inline-block h-2 w-3 rounded-sm bg-teal-400" />OT
        <i className="ml-1 inline-block h-2 w-3 rounded-sm" style={isLight() ? { background: "#fed7aa" } : { boxShadow: "inset 0 0 0 1px #fbbf24aa", background: "repeating-linear-gradient(135deg,#fbbf2455 0 2px,transparent 2px 4px)" }} />thiếu</span>
    </div>
  );
  const NameCell = ({ e }) => (
    <td className="sticky left-0 z-10 border-b border-slate-800/70 bg-slate-900 px-3 py-1.5 md:px-4">
      <button onClick={() => { if (mode === "month") setMonday(fmt(mondayOf(ym === ymOf(today) ? new Date() : parseD(`${ym}-01`)))); openDrawer(e.id); }} title={readOnly ? undefined : "Sửa giờ công tuần này"} className={`block w-full min-w-[150px] text-left ${readOnly ? "cursor-default" : ""}`}>
        <span className={`block truncate text-sm text-slate-100 ${readOnly ? "" : "hover:text-teal-300"}`}>{e.name}</span>
        <span className="block truncate text-[11px] text-slate-500">{roleTitle(e.role) || e.dept}</span>
      </button>
    </td>
  );
  const DeptRow = ({ g, span }) => (
    <tr key={`d-${g.dept}`}><td colSpan={span} className="border-b border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 md:px-4">{g.dept} · {g.items.length} người</td></tr>
  );

  /* ---- chế độ Tuần ---- */
  const WeekView = () => (
    <table className="min-w-full border-separate border-spacing-0">
      <thead>
        <tr className="text-[11px] uppercase tracking-wider text-slate-500">
          <th className="sticky left-0 z-10 border-b border-slate-800 bg-slate-900 px-3 py-2 text-left font-normal md:px-4">Nhân sự</th>
          {days.map((d) => (
            <th key={d} title={hs.get(d) || undefined} className={`border-b border-slate-800 px-1 py-2 font-normal ${d === today ? "text-slate-100" : ""}`}>
              <span className="block">{DOW_OF(d)}</span>
              <span className="block font-mono text-[10.5px] tracking-normal">{dLabel(d)}</span>
              {hs.has(d) && <span className="mx-auto mt-0.5 block w-max rounded bg-slate-300 px-1.5 text-[10px] normal-case leading-[15px] tracking-normal text-slate-900">Lễ</span>}
            </th>
          ))}
          <th className="border-b border-slate-800 px-3 py-2 text-left font-normal">Tổng / chuẩn</th>
          <th className="border-b border-slate-800 px-2 py-2 font-normal">Nộp tuần</th>
          {!readOnly && <>
          <th className="whitespace-nowrap border-b border-slate-800 px-2 py-2 font-normal" title="Mở khoá tuần cho nhân sự sửa · Sửa giờ công">Mở khoá / sửa</th>
          <th className="w-24 whitespace-nowrap border-b border-slate-800 px-2 py-2 font-normal">
            Nhắc{toNudge.length > 0 && (
              <button onClick={() => nudge(toNudge)} disabled={nudging} title={`Nhắc tất cả ${toNudge.length} người cần xử lý`}
                className="ml-1.5 inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 px-2 align-middle font-mono text-xs normal-case text-amber-400 hover:bg-slate-800 disabled:opacity-40">
                <Bell size={12} />{toNudge.length}
              </button>
            )}
          </th>
          </>}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => [DeptRow({ g, span: days.length + (readOnly ? 3 : 5) }), ...g.items.map((e) => {
          const ws = weekState(e.id, monday), rs = reasons(e.id), at = nudged.get(e.id);
          return (
            <tr key={e.id}>
              {NameCell({ e })}
              {days.map((d) => {
                const x = dayInfo(e.id, d);
                const txt = x.st === "hol" ? "Lễ" : x.st === "leave" ? "P" : x.st === "none" ? "—" : x.st === "fut" || x.st === "off" ? (x.done ? fmtH(x.done) : "") : fmtH(x.st === "draft" ? x.done + x.draft : x.done);
                const plus = x.st === "hol" ? x.done + x.ot : x.ot;
                return (
                  <td key={d} className="border-b border-slate-800/70 px-1 py-1.5">
                    <div {...dayHandlers(e.id, d)} style={dayStyle(x.st)}
                      className={`mx-auto flex h-11 min-w-[54px] max-w-[110px] ${d > today || readOnly ? "cursor-default" : "cell-hov cursor-pointer"} flex-col items-center justify-center rounded-md ${x.st === "hol" ? "text-[13px] font-medium" : "font-mono text-[13px] font-semibold"}`}>
                      {txt}
                      {plus > 0 && <small className="font-mono text-[10px] font-medium leading-none text-teal-400">+{fmtH(plus)}</small>}
                    </div>
                  </td>
                );
              })}
              <td className="border-b border-slate-800/70 px-3 py-1.5">{totCell(sums.get(e.id))}</td>
              <td className="border-b border-slate-800/70 px-2 py-1.5 text-center">
                {ws === "fut" || (ws === "dr" && monday >= fmt(mondayOf(new Date()))) ? null : <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${WEEK_ST[ws][1]}`}>{WEEK_ST[ws][0]}</span>}
              </td>
              {!readOnly && <>
              <td className="border-b border-slate-800/70 px-2 py-1.5 text-center">
                <span className="inline-flex gap-1.5">
                  {weekDays(monday).some((d) => daySent(e.id, d)) ? (
                    <button onClick={() => setUnlockFor(e.id)} title="Mở khoá cả tuần — nhân sự sửa lại và gửi lại được"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"><Unlock size={15} /></button>
                  ) : <span className="inline-block w-9" />}
                  <button onClick={() => openDrawer(e.id)} title="Sửa giờ công cả tuần"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"><Pencil size={15} /></button>
                </span>
              </td>
              <td className="border-b border-slate-800/70 px-2 py-1.5 text-center">
                {rs.length > 0 && (
                  <button onClick={() => nudge([e.id])} disabled={nudging || cooling(at)}
                    title={at ? (cooling(at) ? `Đã nhắc lúc ${hhmm(at)} — nhắc lại được lúc ${hhmm(nudgeAgain(at))} · ${rs.join(" · ")}` : `Đã nhắc lúc ${hhmm(at)} — bấm để nhắc lại · ${rs.join(" · ")}`) : `Nhắc nộp — ${rs.join(" · ")}`}
                    className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-amber-400 hover:bg-slate-800 ${cooling(at) ? "cursor-not-allowed opacity-40 hover:bg-transparent" : "disabled:opacity-40"}`}>
                    <Bell size={15} />
                    {at && <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-700 text-white"><Check size={9} strokeWidth={3} /></span>}
                  </button>)}
              </td>
              </>}
            </tr>
          );
        })])}
      </tbody>
    </table>
  );

  /* ---- chế độ Tháng ---- */
  const MonthView = () => (
    <table className="relative z-[1] min-w-full border-separate border-spacing-0">
      <thead>
        <tr className="text-[11px] uppercase tracking-wider text-slate-500">
          <th className="sticky left-0 z-10 border-b border-slate-800 bg-slate-900 px-3 py-2 text-left font-normal md:px-4">Nhân sự</th>
          <th className="border-b border-slate-800 px-2 py-2 text-left font-normal">
            <div className="flex gap-0.5 font-mono text-[10px] normal-case tracking-normal">
              {days.map((d, i) => (
                <span key={d} title={hs.get(d) || undefined} data-today-head={d === today ? "" : undefined} style={d === today && isLight() && !hs.has(d) ? TODAY_CHIP : undefined} className={`w-[22px] shrink-0 text-center ${i > 0 && parseD(d).getDay() === 1 ? "ml-2" : ""}
                  ${hs.has(d) ? "rounded-[3px] bg-slate-300 text-slate-900" : d === today ? "text-slate-100" : parseD(d).getDay() === 0 ? "text-slate-700" : "text-slate-600"}`}>{+d.slice(8)}</span>
              ))}
            </div>
          </th>
          <th className="border-b border-slate-800 px-3 py-2 text-left font-normal">Tổng / chuẩn</th>
          <th className="whitespace-nowrap border-b border-slate-800 px-3 py-2 font-normal">Nộp từng tuần</th>
          {!readOnly && <th className="w-24 whitespace-nowrap border-b border-slate-800 px-2 py-2 font-normal">
            Nhắc{mToNudge.length > 0 && (
              <button onClick={() => nudgeMonth(mToNudge)} disabled={nudging} title={`Nhắc tất cả ${mToNudge.length} người còn tuần chưa nộp`}
                className="ml-1.5 inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 px-2 align-middle font-mono text-xs normal-case text-amber-400 hover:bg-slate-800 disabled:opacity-40">
                <Bell size={12} />{mToNudge.length}
              </button>
            )}
          </th>}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => [DeptRow({ g, span: readOnly ? 4 : 5 }), ...g.items.map((e) => (
          <tr key={e.id}>
            {NameCell({ e })}
            <td className="border-b border-slate-800/70 px-2 py-1.5">
              <div className="flex gap-0.5">
                {days.map((d, i) => {
                  const x = dayInfo(e.id, d);
                  return (
                    <span key={d} {...dayHandlers(e.id, d)} style={dayStyleSm(x.st)}
                      className={`relative h-[22px] w-[22px] shrink-0 rounded ${d > today || readOnly ? "cursor-default" : "cell-hov cursor-pointer"} ${i > 0 && parseD(d).getDay() === 1 ? "ml-2" : ""} ${d === today && !isLight() ? "outline outline-1 outline-offset-2 outline-slate-100/40" : ""}`}>
                      {x.ot + (x.st === "hol" ? x.done : 0) > 0 && <i className="absolute right-0.5 top-0.5 h-[5px] w-[5px] rounded-full bg-teal-400" />}
                    </span>
                  );
                })}
              </div>
            </td>
            <td className="border-b border-slate-800/70 px-3 py-1.5">{totCell(sums.get(e.id))}</td>
            <td className="border-b border-slate-800/70 px-3 py-1.5 text-center">
              <span className="inline-flex gap-1.5">
                {weeks.map((m) => {
                  const ws = weekState(e.id, m);
                  return (
                    <button key={m} onClick={() => { setMonday(m); setMode("week"); }} title={`Tuần ${dLabel(m)} — ${WEEK_ST[ws][0] === "—" ? "chưa tới" : WEEK_ST[ws][0]} · bấm để mở tuần`}
                      className="h-3 w-3 rounded-full transition-transform hover:scale-125" style={{ background: ws === "dr" && m >= fmt(mondayOf(new Date())) ? (isLight() ? "#94a3b8" : "#475569") : (ws === "fut" && isLight() ? "#e2e8f0" : weekDot(ws)) }} />
                  );
                })}
              </span>
            </td>
            {!readOnly && <td className="border-b border-slate-800/70 px-2 py-1.5 text-center">
              {(() => {
                const b = monthBell(e.id), wl = b.mw.map(dLabel).join(", ");
                if (!b.mw.length) return null;
                return (
                  <button onClick={() => nudgeMonth([e.id])} disabled={nudging || b.wait}
                    title={b.last ? (b.wait ? `Đã nhắc lúc ${hhmm(b.last)} — nhắc lại được lúc ${hhmm(b.again)} · tuần ${wl}` : `Đã nhắc lúc ${hhmm(b.last)} — bấm để nhắc lại · tuần ${wl}`) : `Nhắc nộp ${b.mw.length} tuần: ${wl} — gửi một thông báo`}
                    className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-amber-400 hover:bg-slate-800 ${b.wait ? "cursor-not-allowed opacity-40 hover:bg-transparent" : "disabled:opacity-40"}`}>
                    <Bell size={15} />
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-700 px-1 font-mono text-[10px] font-semibold text-white">{b.mw.length}</span>
                    {b.last && <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-700 text-white"><Check size={9} strokeWidth={3} /></span>}
                  </button>);
              })()}
            </td>}
          </tr>
        ))])}
      </tbody>
    </table>
  );

  const tipBox = tip && (() => {
    const x = dayInfo(tip.eid, tip.d), e = cfg.employees.find((y) => y.id === tip.eid);
    const W = 320, left = tip.x + 14 + W > window.innerWidth - 8 ? tip.x - W - 14 : tip.x + 14;
    const top = Math.max(8, Math.min(window.innerHeight - 80 - (x.items.length + 2) * 22, tip.y + 14));
    return (
      <div className="pointer-events-none fixed z-50 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[12.5px] shadow-2xl" style={{ left, top, width: W }}>
        <div className="mb-1.5"><span className="text-slate-100">{e?.name}</span><span className="text-slate-500"> · {DOW_OF(tip.d)} {dLabel(tip.d)}</span></div>
        {hs.has(tip.d) && <div className="mb-1 text-slate-300">Ngày lễ · {hs.get(tip.d)}{x.items.length ? "" : " — không tính giờ chuẩn"}</div>}
        {x.items.length === 0 ? (
          !hs.has(tip.d) && <div className={x.st === "none" ? "text-rose-400" : "text-slate-500"}>{tip.d > today ? "Chưa tới ngày" : x.std ? `Chưa chấm giờ — giờ chuẩn ${fmtH(x.std)} h` : "Ngày nghỉ"}</div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
            {x.items.map((it, i) => (
              <React.Fragment key={i}>
                <span className={`truncate ${it.ot ? "text-teal-400" : "text-slate-200"}`}>{it.label}{!it.sent && <span className="text-amber-400"> · nháp</span>}</span>
                <span className="text-right font-mono text-slate-200">{fmtH(it.h)}</span>
              </React.Fragment>
            ))}
            <span className="mt-1 border-t border-slate-800 pt-1 text-slate-500">Đã gửi{x.draft ? ` · nháp ${fmtH(x.draft)} h` : ""}</span>
            <span className="mt-1 border-t border-slate-800 pt-1 text-right font-mono text-slate-100">{fmtH(x.done + x.ot)}{x.std ? ` / ${fmtH(x.std)}` : ""} h</span>
          </div>
        )}
        {hs.has(tip.d) && x.items.length > 0 && <div className="mt-1 text-[11px] text-slate-500">Giờ chấm vào ngày lễ không tính giờ chuẩn</div>}
      </div>
    );
  })();

  const Kpi = ({ l, v, sub, cls = "text-slate-50" }) => (
    <div className="bg-slate-900 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-slate-500">{l}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${cls}`}>{v}{sub && <span className="ml-1.5 font-sans text-xs font-normal text-slate-500">{sub}</span>}</div>
    </div>
  );
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <div className="flex rounded-md border border-slate-700">
          {[["week", "Tuần"], ["month", "Tháng"]].map(([k, l]) => (
            <button key={k} onClick={() => switchMode(k)} className={`${CTRL} px-4 text-sm ${mode === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronLeft size={16} className="mx-auto" /></button>
          <span className="min-w-[150px] text-center text-sm text-slate-100">{perLabel}</span>
          <button onClick={() => shift(1)} className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronRight size={16} className="mx-auto" /></button>
          {!isNow && <button onClick={() => { setMonday(fmt(mondayOf(new Date()))); setYm(ymOf(today)); }} className="ml-1 text-xs text-teal-400 hover:text-teal-300">{mode === "week" ? "Tuần này" : "Tháng này"}</button>}
        </div>
        {!oneDept && <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={`w-full sm:w-44 ${selectCls}`} aria-label="Bộ phận">
          <option value="all">Mọi bộ phận</option>
          {DEPTS.map((d) => <option key={d}>{d}</option>)}
        </select>}
        <div className="relative w-full sm:w-56">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự" className={`pl-9 ${inputCls}`} />
        </div>
        <button onClick={exportXlsx} disabled={emps.length === 0} className={`w-full sm:ml-auto sm:w-auto ${btnPrimary} disabled:opacity-40`}><Download size={15} /> Xuất Excel</button>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 md:grid-cols-5">
        <Kpi l="Đã nộp đủ" v={okN} sub={`/ ${emps.length} người`} cls={okN < emps.length ? "text-amber-400" : "text-teal-300"} />
        <Kpi l="Chưa nộp / còn nháp" v={emps.length - okN} sub="người" cls="text-slate-50" />
        <Kpi l="Tổng giờ đã gửi" v={fmtH(totT)} sub={`/ ${fmtH(totStd)} h chuẩn`} />
        <Kpi l="Trong đó tăng ca" v={fmtH(totOt)} sub="h" cls="text-teal-400" />
        <Kpi l={`Thiếu giờ chuẩn (<${lim.under}%)`} v={lowN} sub="người" cls={lowN ? "text-amber-400" : "text-slate-50"} />
      </div>

      {Legend()}
      {emps.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Không có nhân sự nào khớp bộ lọc.</p> : (
        <div ref={mWrapRef} className="relative overflow-x-auto pb-1" data-band={bandTick}>
          {mode === "month" && band && isLight() && <div aria-hidden className="pointer-events-none absolute rounded-lg" style={{ ...band, background: TODAY_BAND, zIndex: 0 }} />}
          {mode === "week" ? WeekView() : MonthView()}
        </div>
      )}
      {!pop && !drawer && tipBox}

      {/* v6.0 (C) — hộp sửa nhanh một ô ngày */}
      {pop && (() => {
        const e = cfg.employees.find((y) => y.id === pop.eid), std = minHoursFor(pop.d, hoursCfg, hs) || 0;
        const sum = Object.values(pop.vals).reduce((a, v) => a + (Number(v) || 0), 0);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPop(null)} />
            <div ref={popRef} className="fixed z-50 max-h-[calc(100vh-16px)] w-[360px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl" style={{ left: pop.x, top: pop.y, visibility: "hidden" }}>
              <div className="mb-2 flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate"><span className="text-sm text-slate-100">{e?.name}</span><span className="text-sm text-slate-500"> · {DOW_OF(pop.d)} {dLabel(pop.d)}{hs.has(pop.d) ? " · ngày lễ" : ""}</span></div>
                <button onClick={() => setPop(null)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:text-slate-100"><X size={14} /></button>
              </div>
              {pop.items.length === 0 ? (
                <p className="py-1 text-sm text-slate-500">Tuần này chưa có dòng giờ nào. Bấm "Sửa cả tuần" để thêm dự án · tác vụ.</p>
              ) : pop.items.map((it) => (
                <div key={it.key} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-2 py-1">
                  <div className="min-w-0">
                    <div className={`truncate text-[13px] ${it.ot ? "text-teal-400" : "text-slate-200"}`}>{it.label}</div>
                    <div className="truncate text-[11px] text-slate-500">{it.sub}</div>
                  </div>
                  <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={pop.vals[it.key]}
                    onChange={(ev) => setPop((p) => ({ ...p, vals: { ...p.vals, [it.key]: ev.target.value } }))}
                    onKeyDown={(ev) => { if (ev.key === "Enter") savePop(); }}
                    className={`h-11 w-[72px] rounded-md border bg-slate-900 text-center font-mono text-sm focus:border-teal-500 focus:outline-none
                      ${(Number(pop.vals[it.key]) || 0) !== it.h ? "border-amber-500" : "border-slate-700"} ${it.ot ? "text-teal-300" : "text-slate-100"}`} />
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
                <span className="text-xs text-slate-500">Tổng <span className="font-mono text-slate-200">{fmtH(sum)}</span>{std ? ` / chuẩn ${fmtH(std)} h` : ""}</span>
                <span className="flex gap-2">
                  <button onClick={() => setPop(null)} className={`${btnGhost} h-9 px-3`}>Huỷ</button>
                  {pop.items.length > 0 && <button onClick={savePop} disabled={popSaving} className={`${btnPrimary} h-9 px-3 disabled:opacity-40`}>{popSaving ? <Loader2 className="animate-spin" size={14} /> : null} Lưu</button>}
                </span>
              </div>
              <button onClick={() => { const id = pop.eid, d = pop.d; setMonday(fmt(mondayOf(parseD(d)))); setPop(null); openDrawer(id); }}
                className="mt-2 text-xs text-teal-400 hover:text-teal-300">Sửa cả tuần · thêm dòng ›</button>
            </div>
          </>
        );
      })()}

      {/* v6.0 (A) — ngăn kéo bên phải: sửa cả tuần của một người, bảng tổng quan vẫn nằm phía sau */}
      {drawer && (() => {
        const e = cfg.employees.find((y) => y.id === drawer);
        if (!e) return null;
        return (
          <>
            <div className="fixed inset-0 z-40 bg-slate-950/70" onClick={() => closeDrawer()} />
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[1120px] flex-col border-l border-slate-700 bg-slate-950 shadow-[-20px_0_50px_rgba(0,0,0,.5)]">
              <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
                <button onClick={() => stepDrawer(-1)} title="Người trước" className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronLeft size={16} className="mx-auto" /></button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-100">{e.name}</div>
                  <div className="truncate text-xs text-slate-500">{e.dept}{roleTitle(e.role) ? ` · ${roleTitle(e.role)}` : ""} · sửa giờ công (quản lý sửa được cả ngày đã gửi)</div>
                </div>
                <button onClick={() => stepDrawer(1)} title="Người kế tiếp" className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronRight size={16} className="mx-auto" /></button>
                <button onClick={() => closeDrawer()} title="Đóng (Esc)" className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><X size={16} className="mx-auto" /></button>
              </div>
              {leaveAsk && (
                <div className="flex flex-wrap items-center gap-2 border-b border-amber-900 bg-amber-950/60 px-4 py-2 text-sm text-amber-200">
                  <span className="flex-1">Còn thay đổi chưa lưu. Bấm "Lưu thay đổi" trong bảng, hoặc bỏ thay đổi để đóng.</span>
                  <button onClick={() => setLeaveAsk(false)} className={`${btnGhost} h-9 px-3`}>Ở lại</button>
                  <button onClick={() => closeDrawer(true)} className={`${btnGhost} h-9 border-amber-700 px-3 text-amber-200`}>Bỏ thay đổi</button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-3 md:p-4">
                <EmployeeArea key={`${drawer}|${monday}`} cfg={cfg} empId={drawer} flash={flash} admin initialMonday={monday} onDirtyChange={drawerDirtyCb} />
              </div>
            </div>
          </>
        );
      })()}

      <ConfirmDialog open={!!unlockFor} tone="ok"
        title={`Mở khoá tuần ${dLabel(monday)} – ${dLabel(fmt(addDays(parseD(monday), 6)))}?`}
        desc={`${cfg.employees.find((e) => e.id === unlockFor)?.name || ""} sẽ sửa lại và gửi lại được tuần này. Giờ công giữ nguyên, nhưng tạm chưa tính vào tổng hợp cho tới khi gửi lại.`}
        confirmLabel="Mở khoá" cancelLabel="Thôi"
        onCancel={() => setUnlockFor(null)}
        onConfirm={async () => {
          const id = unlockFor; setUnlockFor(null);
          const ok = await unlockWeekTs(id, monday);
          const nm = cfg.employees.find((e) => e.id === id)?.name || "";
          flash(ok ? `Đã mở khoá tuần ${dLabel(monday)} cho ${nm}.` : `Chưa mở khoá được — ${LAST_STORAGE_ERROR || "mất kết nối"}`, ok ? "ok" : "err");
        }} />
    </div>
  );
}

/* v6.1 — Bảng công (quản lý) chỉ còn Tổng quan bảng công: xem Tuần / Tháng, sửa nhanh từng ô, sửa cả tuần trong ngăn kéo.
   Bỏ tab "Chi tiết nhân viên" (ngăn kéo đã dùng đúng bảng sửa đó). */
function AdminTimesheet({ cfg, flash, onDirtyChange, readOnly = false, oneDept = false }) {
  if (cfg.employees.length === 0) return (
    <Panel title="Bảng công nhân sự">
      <p className="text-sm text-slate-500">{oneDept ? "Phòng ban của bạn chưa có nhân viên nào khác." : "Chưa có nhân sự nào. Thêm nhân sự ở tab Nhân sự trước đã."}</p>
    </Panel>
  );
  return <TimesheetBoard cfg={cfg} flash={flash} onDirtyChange={onDirtyChange} readOnly={readOnly} oneDept={oneDept} />;
}

/* --------- cảnh báo hạn chốt công (ẩn tạm trong phiên, hoặc tắt vĩnh viễn theo thiết bị) --------- */
function DeadlineBanner({ cfg, empId }) {
  const dataTick = useDataTick();
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(false);    // ẩn tạm — chỉ trong phiên làm việc này
  const [hiddenForever, setHiddenForever] = useState(null); // null = chưa đọc xong storage
  const today = new Date();
  const dl = cfg.deadlineDay || 5;
  const prefKey = `artius:hide-deadline:${empId}`;

  useEffect(() => {
    (async () => {
      setHiddenForever(isOn(await sget(prefKey, false)));
    })();
  }, [prefKey]);

  useEffect(() => {
    (async () => {
      const ym = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
      const target = today.getDate() <= dl ? prevYm(ym) : ym;
      const need = mondaysDue(target);
      setState({ target, missing: need.filter((m) => !weekDone(empId, m)), thisYm: ym });
    })();
  }, [empId, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const hideForever = async () => {
    await sset(prefKey, 1, false);
    setHiddenForever(true);
  };

  if (!state || state.missing.length === 0 || dismissed || hiddenForever) return null;
  const late = today.getDate() > dl && state.target === prevYm(state.thisYm);
  return (
    <div className={`wk-banner flex items-start gap-2.5 rounded-xl border p-3 md:gap-3 md:p-3.5 ${late ? "border-rose-900 bg-rose-950" : "border-amber-900 bg-amber-950"}`}>
      <AlertTriangle size={18} className={`mt-0.5 shrink-0 ${late ? "text-rose-400" : "text-amber-400"}`} />
      <div className="min-w-0 flex-1 text-sm text-slate-100">
        Còn <b>{state.missing.length}</b> tuần chưa gửi: {state.missing.map(dLabel).join(", ")}.
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={hideForever} className="text-xs text-slate-300 underline decoration-slate-500 underline-offset-2 hover:text-slate-50">Tắt vĩnh viễn</button>
        <button onClick={() => setDismissed(true)} title="Ẩn tạm" className="rounded p-0.5 text-slate-300 hover:bg-black/20 hover:text-slate-50"><X size={14} /></button>
      </div>
    </div>
  );
}

/* ============================ KIỂM TRA LƯU TRỮ ============================
   Thử đọc/ghi lần lượt từng bảng rồi in ra lỗi thô.
   Mục đích: biết chính xác database từ chối ở đâu, thay vì đoán. */
function StorageDoctor({ cfg, admin = false }) {
  const [rows, setRows] = useState(null);
  const [running, setRunning] = useState(false);

  const probe = async (label, fn) => {
    try { return { label, result: "OK", err: "", note: (await fn()) || "" }; }
    catch (e) { return { label, result: "LỖI", err: errText(e), note: "" }; }
  };

  const run = async () => {
    setRunning(true); setRows(null);
    const out = [];
    out.push(await probe("Phiên đăng nhập", async () => { const w = await currentUser(); if (!w) throw new Error("Chưa đăng nhập hoặc phiên đã hết hạn"); return w.username; }));
    out.push(await probe("Đọc thiết lập", async () => { const c = (await fetchConfig())?.config; if (!c) throw new Error("Chưa có dòng thiết lập"); return `${(c.employees || []).length} nhân sự, ${(c.projects || []).length} dự án`; }));
    out.push(await probe("Đọc bảng công", async () => `${Object.keys(await fetchTs()).length} bảng công tháng`));
    // ghi lại đúng thiết lập đang có: kiểm tra được quyền ghi mà không đổi dữ liệu (chỉ quản lý có quyền này)
    if (admin) out.push(await probe("Ghi thiết lập", async () => { const f = await fetchConfig(); if (!f) throw new Error("Chưa có dòng thiết lập"); const r = await saveConfig(f.config, f.rev); if (r.conflict) throw new Error("Không ghi được: tài khoản không có quyền, hoặc có người vừa sửa"); return "ghi lại nội dung đang có"; }));
    out.push(await probe("Ghi vùng riêng trên máy này", async () => { const k = "artius:diag"; await window.storage.set(k, "1", false); await window.storage.delete(k, false); return ""; }));
    setRows(out); setRunning(false);
  };

  const tone = (v) => (v === "OK" ? "text-teal-400" : "text-rose-400");

  return (
    <Panel title="Kiểm tra lưu trữ">
      <button onClick={run} disabled={running || !STORAGE_OK} className={`${btnPrimary} disabled:opacity-40`}>
        {running ? <Loader2 className="animate-spin" size={15} /> : <ListChecks size={15} />} Chạy kiểm tra
      </button>

      {rows && (
        <div className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-slate-200">{r.label}{r.note && <span className="ml-2 text-xs text-slate-500">{r.note}</span>}</span>
                <span className={`shrink-0 font-mono text-sm ${tone(r.result)}`}>{r.result}</span>
              </div>
              {r.err && <p className="mt-1 text-xs text-rose-300">{r.err}</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ============================ SAO LƯU & KHÔI PHỤC ============================
   Bộ nhớ lưu trữ của môi trường này có lúc đứt giữa chừng. Xuất được toàn bộ dữ liệu
   ra một file JSON nghĩa là dù storage hỏng hay bị xoá thì vẫn dựng lại được. */
function BackupPanel({ cfg, saveCfg, flash, setCfgFromRestore }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(null);

  const exportAll = async () => {
    // tải lại bản mới nhất từ server để file sao lưu có cả phần mọi người vừa nhập sau lúc mình mở app
    setBusy(true);
    let fresh = null;
    try { fresh = await loadDB(true, true); } catch { /* báo lỗi bên dưới */ }   // v2.1: sao lưu phải có đủ mọi tháng
    setBusy(false);
    if (!fresh) return flash(`Chưa xuất được — ${LAST_STORAGE_ERROR || "không tải được dữ liệu"}`, "err");
    const ts = { ...fresh.ts };
    const dump = { app: "artius-timesheet", v: 1, at: new Date().toISOString(), config: fresh.config, timesheets: ts };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ARTIUS_saoluu_${fmt(new Date())}.json`; a.click();
    URL.revokeObjectURL(url);
    flash(`Đã xuất ${Object.keys(ts).length} bảng công và toàn bộ thiết lập.`);
  };

  const parseDump = () => {
    try {
      const d = JSON.parse(text);
      if (d?.app !== "artius-timesheet" || !d.config) throw new Error("sai định dạng");
      return d;
    } catch { flash("Nội dung không phải file sao lưu hợp lệ.", "err"); return null; }
  };

  const doRestore = async () => {
    const d = confirmRestore; setConfirmRestore(null);
    if (!d) return;
    setBusy(true);
    const ts = d.timesheets || {};
    // khoá cũ có dạng "artius:ts:<empId>:<ym>", bản mới lưu gọn là "<empId>:<ym>"
    const clean = {};
    for (const [k, v] of Object.entries(ts)) clean[k.startsWith(TS_PREFIX) ? k.slice(TS_PREFIX.length) : k] = v;
    const ok = !!(await commitConfig(d.config)) && (await commitTs(clean));
    setCfgFromRestore?.(d.config);
    setBusy(false); setText("");
    flash(ok ? `Đã khôi phục thiết lập và ${Object.keys(clean).length} bảng công.` : "Khôi phục chưa xong — lưu trữ đang lỗi.", ok ? "ok" : "err");
  };

  return (
    <Panel title="Sao lưu & khôi phục">
      <p className="text-sm text-slate-400">
        Xuất toàn bộ thiết lập và bảng công ra một file JSON để giữ ngoài hệ thống. Nên làm định kỳ, nhất là cuối mỗi tháng trước khi chốt công.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={exportAll} disabled={busy} className={`${btnPrimary} disabled:opacity-40`}>
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />} Xuất file sao lưu
        </button>
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <label className="mb-1 block text-xs text-slate-500">Khôi phục — dán nội dung file sao lưu vào đây</label>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)}
          placeholder='{"app":"artius-timesheet", ...}'
          className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-700 focus:border-teal-500 focus:outline-none" />
        <button onClick={() => { const d = parseDump(); if (d) setConfirmRestore(d); }} disabled={busy || !text.trim()}
          className={`mt-2 ${btnGhost} disabled:opacity-40`}><RotateCcw size={14} /> Khôi phục từ nội dung trên</button>
        <p className="mt-2 text-xs text-slate-500">Khôi phục ghi đè thiết lập hiện tại và các bảng công có trong file. Bảng công không nằm trong file thì giữ nguyên.</p>
      </div>

      <ConfirmDialog
        open={!!confirmRestore}
        title="Khôi phục dữ liệu từ file sao lưu?"
        desc="Thiết lập hiện tại gồm nhân sự, dự án, tác vụ, ngày lễ sẽ bị ghi đè bằng nội dung trong file. Nên xuất một bản sao lưu của dữ liệu hiện tại trước khi làm."
        confirmLabel="Khôi phục"
        onConfirm={doRestore}
        onCancel={() => setConfirmRestore(null)}
      />
    </Panel>
  );
}

/* ============================ CÀI ĐẶT CÁ NHÂN (nhân sự) ============================ */
/* v2.6 — Trạng thái thông báo trên máy tính của trình duyệt đang dùng */
function PushStatusRow() {
  const [perm, setPerm] = useState(pushPermission());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const enable = async () => { setPerm(await askPermission()); };
  const test = async () => {
    setBusy(true); setMsg("");
    try { await syncPush(); const r = await sendTestPush(); setMsg(r.delivered > 0 ? "Đã gửi thử — xem góc phải dưới màn hình." : "Chưa gửi được tới trình duyệt này."); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const label = { granted: "Đã bật", denied: "Đã chặn", default: "Chưa bật", unsupported: "Trình duyệt không hỗ trợ" }[perm] || perm;
  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-200">Thông báo trên máy tính</div>
          <div className="mt-0.5 text-xs text-slate-500">Nhắc nộp bảng công hiện ở góc màn hình, kể cả khi không mở ARTIUS.</div>
        </div>
        <span className={`shrink-0 text-xs ${perm === "granted" ? "text-teal-400" : perm === "denied" ? "text-rose-400" : "text-amber-400"}`}>{label}</span>
      </div>
      {perm === "default" && <button onClick={enable} className={`mt-3 ${btnGhost}`}><Bell size={14} /> Bật thông báo</button>}
      {perm === "granted" && <button onClick={test} disabled={busy} className={`mt-3 ${btnGhost} disabled:opacity-40`}>{busy ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Gửi thử</button>}
      {perm === "denied" && <p className="mt-2 text-xs text-slate-500">Bấm biểu tượng ổ khoá bên trái thanh địa chỉ → Thông báo → Cho phép, rồi tải lại trang.</p>}
      {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
    </div>
  );
}

function EmployeeSettings({ cfg, empId }) {
  const emp = cfg.employees.find((e) => e.id === empId);
  const prefKey = `artius:hide-deadline:${empId}`;
  const [hidden, setHidden] = useState(null); // null = đang tải
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setHidden(isOn(await sget(prefKey, false)));
    })();
  }, [prefKey]);

  const toggleReminder = async () => {
    setSaving(true);
    const next = !hidden; // next = true nghĩa là chuyển sang trạng thái ẨN nhắc nhở
    if (next) await sset(prefKey, 1, false);
    else await sdel(prefKey, false);
    setHidden(next); setSaving(false);
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <Panel title="Thông tin cá nhân">
        <div className="space-y-1.5 text-sm">
          <div><span className="text-slate-500">Họ và tên: </span><span className="text-slate-100">{emp?.name}</span></div>
          {emp?.code && <div><span className="text-slate-500">Mã nhân viên: </span><span className="font-mono text-slate-100">{emp.code}</span></div>}
          <div><span className="text-slate-500">Bộ phận: </span><span className="text-slate-100">{emp?.dept}</span></div>
          <div><span className="text-slate-500">Vai trò: </span><span className="text-slate-100">{roleTitle(emp?.role) || <span className="text-slate-500">Chưa có</span>}</span></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Muốn đổi tên, mã nhân viên, bộ phận hoặc vai trò, liên hệ Ban quản lý — nhân sự không tự sửa được thông tin này.</p>
      </Panel>

      <Panel title="Thông báo">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-slate-200">Nhắc nhở bảng công chưa gửi</div>
            <div className="mt-0.5 text-xs text-slate-500">Hiện banner cảnh báo ở đầu trang Chấm công khi còn tuần chưa gửi trước hạn chốt công.</div>
          </div>
          {hidden === null ? (
            <Loader2 className="animate-spin shrink-0 self-center text-slate-500" size={16} />
          ) : (
            <button onClick={toggleReminder} disabled={saving}
              className={`relative inline-block h-6 w-11 shrink-0 self-center appearance-none rounded-full border-0 p-0 align-middle leading-none transition-colors disabled:opacity-50 ${!hidden ? "bg-teal-600" : "bg-slate-700"}`}>
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${!hidden ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          )}
        </div>
        {hidden && <p className="mt-3 text-xs text-amber-400">Đang tắt — bạn sẽ không thấy nhắc nhở kể cả khi còn tuần chưa gửi. Bật lại bất cứ lúc nào tại đây.</p>}
        <PushStatusRow />
      </Panel>

      {/* v8.1 — bỏ "Kiểm tra lưu trữ" ở Cài đặt nhân viên (chỉ còn ở Thiết lập của Admin) */}
    </div>
  );
}


/* v7.0 — Lịch tháng ở Dashboard cá nhân: mỗi ô một ngày, cùng quy tắc trạng thái và cùng bộ màu DAY_ST với bảng
   Tuần của quản lý (đủ giờ · thiếu · nháp chưa gửi · bỏ trống · nghỉ phép "P" · ngày lễ "Lễ" · CN / chưa tới, +h tăng ca).
   Bấm một ngày đã qua → mở màn Chấm công đúng tuần chứa ngày đó. */
function MonthCalendar({ cfg, empId, ym, setYm, loading, onOpenWeek }) {
  const dataTick = useDataTick();
  const today = fmt(new Date());
  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const hs = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const curYm = ymOf(today);
  const [tick, setTick] = useState(0);
  useEffect(() => { let on = true; ensureMonths([ym]).then(() => on && setTick((t) => t + 1)); return () => { on = false; }; }, [ym, dataTick]);
  const first = parseD(`${ym}-01`), last = lastOfMonth(first);
  const step = (n) => setYm(ymOf(fmt(new Date(first.getFullYear(), first.getMonth() + n, 1))));
  const cells = useMemo(() => {
    const m = new Map();
    const b = dbTs(empId, ym); const sent = b?.sent || {};
    for (const r of b?.rows || []) for (const [d, hv] of Object.entries(r.days || {})) {
      const h = Number(hv) || 0; if (h <= 0) continue;
      const c = m.get(d) || { reg: 0, ot: 0, leave: 0, draft: 0, idle: 0 };
      if (!sent[d]) c.draft += h; else if (isOtId(r.taskId)) c.ot += h; else if (isLeaveTask(r.taskId)) c.leave += h; else { c.reg += h; if (isIdleTask(r.taskId)) c.idle += h; }
      m.set(d, c);
    }
    return m;
  }, [empId, ym, tick, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps
  // cùng quy tắc với dayInfo() của bảng quản lý
  const info = (d) => {
    const c = cells.get(d) || { reg: 0, ot: 0, leave: 0, draft: 0, idle: 0 };
    const std = minHoursFor(d, hoursCfg, hs) || 0, done = c.reg + c.leave;
    /* v7.1 — tách giờ cố gắng (giống Dashboard / màn chấm công): chuẩn = tổng − OT − cố gắng */
    const ef = effortHoursFor(d, c.reg - c.idle, hoursCfg, hs), tot = done + c.ot, sd = Math.max(0, done - ef - c.idle);   // v7.2: sd không gồm chờ việc
    let st;
    if (hs.has(d)) st = "hol";
    else if (d > today) st = "fut";
    else if (d === today && done + c.ot + c.draft === 0) st = "fut";
    else if (!std) st = done + c.ot > 0 ? (c.draft ? "draft" : "full") : c.draft ? "draft" : "off";
    else if (c.leave > 0 && c.reg === 0 && !c.draft) st = "leave";
    else if (done >= std) st = "full";
    else if (c.draft > 0) st = "draft";
    else st = done > 0 ? "part" : "none";
    return { ...c, done, ef, tot, sd, st };
  };
  const days = [];
  for (let d = mondayOf(first); d <= last || d.getDay() !== 1; d = addDays(d, 1)) days.push(d.getMonth() === first.getMonth() ? fmt(d) : null);
  let miss = 0, drafts = 0;
  for (const d of days) if (d) { const s = info(d).st; if (s === "none" || s === "part") miss++; if (s === "draft") drafts++; }
  const fh = (v) => fmtH(v);
  const DOWS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Lịch tháng</span>
        <button type="button" onClick={() => step(-1)} aria-label="Tháng trước" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"><ChevronLeft size={15} /></button>
        <span className="min-w-[96px] text-center text-sm font-semibold text-slate-100">Tháng {first.getMonth() + 1}/{first.getFullYear()}</span>
        <button type="button" onClick={() => step(1)} aria-label="Tháng sau" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"><ChevronRight size={15} /></button>
        {/* chỉ hiện khi đang xem tháng khác — bấm để quay về tháng hiện tại */}
        {ym !== curYm && <button type="button" onClick={() => setYm(curYm)} className="h-8 rounded-md px-2 text-xs text-teal-400 hover:bg-slate-800 hover:text-teal-300">Tháng này</button>}
        {loading && <Loader2 className="animate-spin text-slate-500" size={15} />}
        <span className="w-full text-xs text-slate-400 sm:ml-auto sm:w-auto">
          {miss ? <><b className="font-semibold text-rose-400">{miss} ngày</b> chưa đủ giờ</> : <span className="text-teal-300">Không sót ngày nào</span>}
          {drafts > 0 && <> · {drafts} ngày nháp chưa gửi</>}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOWS.map((x) => <div key={x} className="pb-0.5 text-center text-[10px] text-slate-500">{x}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const x = info(d);
          /* v7.1 — số to = TỔNG giờ (gồm OT); dòng nhỏ = chuẩn · +OT · +cố gắng, chỉ hiện khi có OT hoặc cố gắng */
          const txt = x.st === "hol" ? "Lễ" : x.st === "leave" ? "P" : x.st === "none" ? "—" : x.st === "fut" || x.st === "off" ? (x.tot ? fh(x.tot) : "") : fh(x.st === "draft" ? x.tot + x.draft : x.tot);
          const split = x.st !== "draft" && (x.ot > 0 || x.ef > 0 || x.idle > 0);
          const can = d <= today && !!onOpenWeek;
          return (
            <button key={d} type="button" disabled={!can} onClick={() => onOpenWeek(fmt(mondayOf(parseD(d))))} style={dayStyle(x.st)}
              title={`${DOWS[(parseD(d).getDay() + 6) % 7]} ${dLabel(d)}${hs.has(d) ? ` · ${hs.get(d)}` : ""}${x.tot || x.draft ? ` · chuẩn ${fh(x.sd)}${x.idle ? ` · chờ việc ${fh(x.idle)}` : ""} · OT ${fh(x.ot)} · cố gắng ${fh(x.ef)} · tổng ${fh(x.tot)} h${x.draft ? ` · nháp ${fh(x.draft)} h` : ""}` : ""}${can ? " — bấm để mở Chấm công tuần này" : ""}`}
              className={`relative flex h-14 flex-col items-center justify-center rounded-md md:h-[60px] ${can ? "cell-hov cursor-pointer" : "cursor-default"} ${x.st === "hol" ? "text-[13px] font-medium" : "font-mono text-[13px] font-semibold"} ${d === today ? "outline outline-2 outline-offset-1 outline-teal-400" : ""}`}>
              <span className="absolute left-1.5 top-0.5 font-sans text-[10px] font-normal text-slate-500">{parseD(d).getDate()}</span>
              <span className="leading-none">{txt}</span>
              {split && (
                <small className="mt-0.5 flex items-baseline justify-center gap-[3px] font-mono text-[10px] font-medium leading-none">
                  {x.sd > 0 && <span className="text-blue-400">{fh(x.sd)}</span>}
                  {x.idle > 0 && <span className="text-slate-400">{x.sd > 0 ? "+" : ""}{fh(x.idle)}</span>}
                  {x.ot > 0 && <span className="text-teal-400">{x.sd + x.idle > 0 ? "+" : ""}{fh(x.ot)}</span>}
                  {x.ef > 0 && <span className="cg-num text-violet-400">+{fh(x.ef)}</span>}
                </small>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 pt-2.5 text-[11px] text-slate-400">
        {[["full", "Đủ giờ chuẩn"], ["part", "Thiếu giờ"], ["draft", "Nháp chưa gửi"], ["none", "Bỏ trống"], ["leave", "Nghỉ phép"], ["hol", "Ngày lễ"], ["fut", "CN / chưa tới"]].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px]" style={dayStyleSm(k)} />{l}</span>
        ))}
        <span className="flex w-full items-center gap-2 pt-0.5"><span className="text-slate-500">Số to = tổng giờ ·</span>
          <span className="font-mono text-blue-400">chuẩn</span><span className="font-mono text-slate-400">+chờ việc</span><span className="font-mono text-teal-400">+OT</span><span className="font-mono text-violet-400">+cố gắng</span></span>
      </div>
    </div>
  );
}

function EmployeeDashboard({ cfg, empId, onGoTimesheet }) {
  const emp = cfg.employees.find((e) => e.id === empId);
  /* v7.0 — kỳ xem = tháng đang mở trên Lịch tháng (bỏ ô chọn khoảng ngày và các nút 4 tuần / Tháng này / Tháng trước) */
  const [ym, setYm] = useState(() => ymOf(fmt(new Date())));
  const from = `${ym}-01`, to = fmt(lastOfMonth(parseD(from)));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const yms = ymsBetween(from, to);
    await ensureMonths([prevYm(yms[0]), ...yms]);
    const raw = [];
    for (const ym of yms) raw.push({ ym, data: dbTs(empId, ym) });
    const detail = [];
    for (const { data: d } of raw) {
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;
        detail.push({ date, hours: Number(h), projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, note: r.note || "" });
      }
    }
    setData({ detail }); setLoading(false);
  }, [from, to, empId]);

  useEffect(() => { load(); }, [load]);   // v3.8: đổi kỳ (hoặc bấm nút nhanh) là tải lại ngay, bỏ nút Cập nhật



  /* v3.8 — Dashboard cá nhân kiểu "tóm tắt tuần" (phương án A): một câu nói thẳng trạng thái, danh sách từng tuần
     có nhãn Đủ / Thiếu / Đang chấm và thanh 3 màu (giờ chuẩn · OT · giờ cố gắng), cùng tỷ trọng theo dự án.
     Giờ chuẩn của ngày = tổng − OT − giờ cố gắng (giống màn chấm công v3.7). Ngày thiếu = ngày làm việc đã qua
     (có giờ chuẩn, không phải ngày lễ) mà tổng giờ chấm < giờ chuẩn. */
  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidaySet = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const todayStr = fmt(new Date());
  const DOW_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const view = useMemo(() => {
    if (!data) return null;
    const day = new Map();      // dateStr -> { tot, ot, reg }
    const byProj = new Map();   // projectId -> giờ (không gồm vắng mặt)
    let leaveHrs = 0;
    for (const d of data.detail) {
      const c = day.get(d.date) || { tot: 0, ot: 0, reg: 0, idle: 0 };
      c.tot += d.hours;
      if (isOtId(d.taskId)) c.ot += d.hours; else if (!isLeaveTask(d.taskId)) { c.reg += d.hours; if (isIdleTask(d.taskId)) c.idle += d.hours; }
      day.set(d.date, c);
      if (isLeaveTask(d.taskId)) leaveHrs += d.hours;
      else byProj.set(d.projectId, (byProj.get(d.projectId) || 0) + d.hours);
    }
    const info = (s) => {
      const c = day.get(s) || { tot: 0, ot: 0, reg: 0, idle: 0 };
      const ef = effortHoursFor(s, c.reg - c.idle, hoursCfg, holidaySet);   // v7.2: chờ việc không thành giờ cố gắng
      // std gồm cả chờ việc (để xét đủ / thiếu); idle tách riêng để vẽ khúc xám
      return { tot: c.tot, ot: c.ot, ef, idle: c.idle, std: Math.max(0, c.tot - c.ot - ef), min: minHoursFor(s, hoursCfg, holidaySet) };
    };
    const weeks = [];
    for (let m = mondayOf(parseD(from)); fmt(m) <= to; m = addDays(m, 7)) {
      const ds = [];
      for (let i = 0; i < 7; i++) { const k = fmt(addDays(m, i)); if (k >= from && k <= to) ds.push(k); }
      if (ds.length === 0 || ds[0] > todayStr) continue;   // tuần chưa tới thì không liệt kê
      const w = { monday: fmt(m), label: `${dLabel(ds[0])} – ${dLabel(ds[ds.length - 1])}`, std: 0, ot: 0, ef: 0, idle: 0, tot: 0, target: 0, miss: [],
        isCur: ds.includes(todayStr), days: [] };
      for (const k of ds) {
        const x = info(k);
        w.std += x.std; w.ot += x.ot; w.ef += x.ef; w.idle += x.idle; w.tot += x.tot;
        const due = k <= todayStr && x.min !== null;
        // v4.0: thiếu = giờ chuẩn (không tính OT, cố gắng) < giờ chuẩn của ngày
        if (due) { w.target += x.min; if (x.std < x.min) w.miss.push(k); }
        w.days.push({ k, ...x, st: k > todayStr ? "fut" : x.min === null ? (x.tot > 0 ? "ok" : "off") : x.std < x.min ? "miss" : "ok" });
      }
      weeks.push(w);
    }
    const sum = (f) => weeks.reduce((a, w) => a + w[f], 0);
    // v3.9: giờ chuẩn danh nghĩa một tuần (mặc định 44h) — vẽ nét dọc định vị trên các thanh tuần
    const weekStd = ["weekday", "weekday", "weekday", "weekday", "weekday", "sat", "sun"].reduce((a, k) => a + (Number(hoursCfg[k]) || 0), 0);
    // v7.1: thang theo tổng giờ / giờ chuẩn của từng tuần (bỏ vạch 44h cố định) — giống khung Phân bổ của quản lý
    const scale = Math.max(1, ...weeks.map((w) => Math.max(w.tot, w.target))) * 1.04;
    const projTotal = [...byProj.values()].reduce((a, v) => a + v, 0);
    const projects = [...byProj.entries()].sort((a, b) => b[1] - a[1]).map(([id, h]) => ({ id, h, pct: projTotal ? (h / projTotal) * 100 : 0 }));
    return { weeks, scale, weekStd, projects, leaveHrs, std: sum("std"), ot: sum("ot"), ef: sum("ef"), idle: sum("idle"), tot: sum("tot"), target: sum("target") };
  }, [data, from, to, todayStr, hoursCfg, holidaySet]);

  const cur = view?.weeks.find((w) => w.isCur) || null;
  const pastMiss = view ? view.weeks.filter((w) => !w.isCur && w.miss.length > 0) : [];
  const anyMiss = !!view && (pastMiss.length > 0 || (cur && cur.miss.length > 0));
  // v7.1 — "Chấm công ngay" mở thẳng tuần CŨ NHẤT còn thiếu của tháng đang xem (hết tuần cũ thiếu mới tới tuần này)
  const goWeek = view ? view.weeks.find((w) => w.miss.length > 0) || null : null;
  const shortDays = (list) => list.map((k) => `${DOW_SHORT[(parseD(k).getDay() + 6) % 7]} ${dLabel(k)}`).join(", ");

  return (
    <div className="space-y-3 md:space-y-4">
      {view && (
        <>
          {/* Câu tóm tắt: nói thẳng còn thiếu gì */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:flex-row md:items-center md:gap-5">
            <div className="min-w-0 flex-1 text-base font-semibold leading-relaxed text-slate-100 md:text-lg" style={{ textWrap: "balance" }}>
              {!anyMiss ? (
                <span className="text-teal-300">Bạn đã chấm đủ giờ {cur ? "đến hôm nay" : `trong tháng ${+ym.slice(5)}/${ym.slice(0, 4)}`}.</span>
              ) : (
                <>
                  {cur && cur.miss.length > 0 && (cur.tot === 0
                    ? <>Tuần này bạn chưa chấm giờ nào. <span className="text-rose-400">Còn thiếu {cur.miss.length} ngày</span>{pastMiss.length ? "" : "."} </>
                    : <>Tuần này <span className="text-rose-400">còn thiếu giờ {cur.miss.length} ngày</span> ({shortDays(cur.miss)}){pastMiss.length ? "" : "."} </>)}
                  {cur && cur.miss.length === 0 && <>Tuần này đã đủ giờ đến hôm nay. </>}
                  {pastMiss.length > 0 && <>{cur && cur.miss.length > 0 ? "và " : ""}<span className="text-rose-400">
                    {pastMiss.length === 1 ? `tuần ${pastMiss[0].label}` : `${pastMiss.length} tuần trước`}</span> chưa đủ giờ.</>}
                </>
              )}
            </div>
            {cur && (
              <div className="flex gap-1.5">
                {cur.days.filter((x) => !(x.st === "off" && (parseD(x.k).getDay() === 0))).map((x) => (
                  <div key={x.k} title={`${shortDays([x.k])}: ${x.tot ? `${x.tot.toFixed(1)} giờ` : "chưa chấm"}`}
                    className={`w-11 rounded-lg border py-1.5 text-center text-[11px] ${x.st === "miss" ? "border-rose-900 text-rose-400" : x.st === "ok" ? "border-teal-800 text-teal-400" : x.st === "fut" ? "border-slate-800 text-slate-600 opacity-60" : "border-slate-800 text-slate-600"}`}>
                    {DOW_SHORT[(parseD(x.k).getDay() + 6) % 7]}
                    <b className="block font-mono text-[13px] font-medium text-slate-200">{parseD(x.k).getDate()}</b>
                  </div>
                ))}
              </div>
            )}
            {anyMiss && onGoTimesheet && (
              <button onClick={() => onGoTimesheet(goWeek?.monday)} title={goWeek ? `Mở Chấm công tuần ${goWeek.label}` : undefined}
                className={`${btnPrimary} shrink-0`}><Clock size={15} /> Chấm công ngay</button>
            )}
          </div>

          <div className="grid items-start gap-3 lg:grid-cols-2 md:gap-4">
            {/* Từng tuần — v7.0: khung cao vừa nội dung (items-start), không kéo giãn theo khung bên cạnh */}
            <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
              {/* v7.1 — thanh tuần kiểu khung Phân bổ của quản lý: số giờ trong từng khúc, vạch giờ chuẩn của tuần (tính đến hôm nay),
                  ngoặc vàng "thiếu X h" từ cuối phần Giờ chuẩn tới vạch (OT / cố gắng không bù vào), cột phải là tổng giờ */}
              <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Từng tuần</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-800 pb-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />Giờ chuẩn</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Chờ việc</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-400" />OT</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400" />Giờ cố gắng</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-slate-100/60" />giờ chuẩn của tuần (tính đến hôm nay)</span>
                <span className="text-amber-400">⌃ thiếu giờ chuẩn</span>
              </div>
              {view.weeks.length === 0 ? <p className="py-3 text-sm text-slate-500">Tháng này chưa tới.</p> : (
                <div className="divide-y divide-slate-800">
                  {[...view.weeks].reverse().map((w) => {
                    const extra = w.ot + w.ef;
                    const pill = w.target === 0 && w.tot === 0 ? ["Nghỉ", "border-slate-700 text-slate-500"]
                      : w.miss.length === 0 ? [`Đủ${extra > 0 ? ` · +${fmtH(extra)}` : ""}`, "border-teal-900 bg-teal-950 text-teal-300"]
                      : w.isCur ? [`Đang chấm · thiếu ${w.miss.length} ngày`, "border-amber-900 bg-amber-950/70 text-amber-300"]
                      : w.tot === 0 ? ["Chưa chấm", "border-rose-900 bg-rose-950 text-rose-300"]
                      : [`Thiếu ${w.miss.length} ngày`, "border-rose-900 bg-rose-950 text-rose-300"];
                    const p = (v) => (v / view.scale) * 100;
                    const gap = w.target - w.std;
                    return (
                      <div key={w.monday}
                        className="-mx-2 grid w-[calc(100%+1rem)] grid-cols-[92px_minmax(0,1fr)_56px] items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm md:grid-cols-[100px_minmax(0,1fr)_60px_150px]"
                        title={`Chuẩn ${fmtH(w.std - w.idle)}${w.idle ? ` · chờ việc ${fmtH(w.idle)}` : ""} · OT ${fmtH(w.ot)} · cố gắng ${fmtH(w.ef)} · tổng ${fmtH(w.tot)} giờ · giờ chuẩn của tuần ${fmtH(w.target)}`}>
                        <span className="font-mono text-xs text-slate-300">{w.label}</span>
                        <div className="relative pt-[18px]">
                          <div className="flex h-[18px] overflow-hidden rounded-full bg-slate-800 font-mono text-[11px] font-semibold text-slate-950">
                            {[[w.std - w.idle, "bg-blue-400", "Giờ chuẩn"], [w.idle, "bg-slate-400", "Chờ việc"], [w.ot, "bg-teal-400", "OT"], [w.ef, "bg-violet-400", "Giờ cố gắng"]].filter(([v]) => v > 0.05).map(([v, cls, l], i) => (
                              <i key={l} title={`${l}: ${fmtH(v)} h`} className={`flex h-full items-center justify-center overflow-hidden whitespace-nowrap not-italic ${cls} ${i ? "border-l-2 border-slate-900" : ""}`}
                                style={{ width: `${p(v)}%` }}>{p(v) >= 5 ? fmtH(v) : ""}</i>
                            ))}
                          </div>
                          {w.target > 0 && gap > 0.05 && (
                            <span className="pointer-events-none absolute top-3 h-[5px] rounded-t-[3px] border-[1.5px] border-b-0 border-amber-400" style={{ left: `${p(w.std)}%`, width: `${p(gap)}%` }}>
                              <span className="absolute -top-[5px] left-1/2 h-1 w-[1.5px] -translate-x-1/2 bg-amber-400" />
                              <span className="absolute bottom-[9px] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[11px] font-medium leading-none text-amber-400">thiếu {fmtH(gap)} h</span>
                            </span>
                          )}
                          {w.target > 0 && <span className="pointer-events-none absolute -bottom-1.5 top-3 w-px -translate-x-1/2 bg-slate-100/55 shadow-[0_0_0_1.5px_#0f172a]" style={{ left: `${p(w.target)}%` }} />}
                        </div>
                        <span className={`text-right font-mono text-sm font-semibold ${w.miss.length === 0 ? "text-slate-100" : w.isCur ? "text-amber-400" : "text-rose-400"}`}>{fmtH(w.tot)} h</span>
                        <span className={`col-span-3 justify-self-start whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] md:col-span-1 md:justify-self-end ${pill[1]}`}>{pill[0]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* cả kỳ chuyển xuống đây; khung bên phải dành cho chi tiết tuần */}
              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-slate-800 pt-2.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Cả tháng</span>
                <span className="font-mono text-[13px]">
                  <span className="text-blue-400">{(view.std - view.idle).toFixed(1)}</span> chuẩn <span className="text-slate-600">+</span>{" "}
                  {view.idle > 0 && <><span className="text-slate-400">{view.idle.toFixed(1)}</span> chờ việc <span className="text-slate-600">+</span>{" "}</>}
                  <span className="text-teal-400">{view.ot.toFixed(1)}</span> OT <span className="text-slate-600">+</span>{" "}
                  <span className="cg-num text-violet-400">{view.ef.toFixed(1)}</span> cố gắng <span className="text-slate-600">=</span>{" "}
                  <b className="text-slate-50">{view.tot.toFixed(1)}</b> giờ
                </span>
                <span className="text-[11px] text-slate-500">· target đến hôm nay {view.target.toFixed(0)} giờ chuẩn</span>
              </div>
            </div>

            {/* v7.0 — Lịch tháng thay cho Chi tiết tuần: nhân viên tự soát ngày chấm sót, màu ô giống hệt bảng Tuần của quản lý */}
            <MonthCalendar cfg={cfg} empId={empId} ym={ym} setYm={setYm} loading={loading} onOpenWeek={onGoTimesheet} />
          </div>
        </>
      )}
    </div>
  );
}

/* ============================ DASHBOARD (QUẢN LÝ) ============================ */
function Dashboard({ cfg, saveCfg, flash }) {
  const dataTick = useDataTick();   // v1.9: số liệu tự cập nhật khi có người vừa gửi
  const now = new Date();
  const [from, setFrom] = useState(fmt(firstOfMonth(now)));
  const [to, setTo] = useState(fmt(now));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fDept, setFDept] = useState("all");   // lọc bộ phận
  /* v5.6 — Dashboard tách hai tab: "Dự án" (tiến độ từ trước tới nay, không theo kỳ) và "Nhân sự" (theo kỳ).
     Bỏ ô lọc Dự án / Giai đoạn chung ở đầu trang — mỗi tab có bộ lọc riêng, chỉ tác động lên chính tab đó. */
  const fProj = "all", fPhase = "all";
  const [dTab, setDTab0] = useState(() => { try { return localStorage.getItem("artius.dashTab") === "proj" ? "proj" : "ppl"; } catch { return "ppl"; } });
  const setDTab = (t) => { setDTab0(t); try { localStorage.setItem("artius.dashTab", t); } catch { /* bỏ qua */ } };
  const [q, setQ] = useState("");              // tìm theo tên nhân sự
  const [rebuilding, setRebuilding] = useState(false);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidaySet = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);

  const setRange = (a, b) => { setFrom(a); setTo(b); };
  // v4.6 — giờ chuẩn của một người trong kỳ đang chọn (T2–T6 / T7 / CN theo Thiết lập, trừ ngày lễ) — vạch so sánh ở "Phân bổ theo nhân sự"
  const stdPeriod = useMemo(() => {
    let t = 0;
    for (let d = from; d <= to; d = fmt(addDays(parseD(d), 1))) t += minHoursFor(d, hoursCfg, holidaySet) || 0;
    return t;
  }, [from, to, hoursCfg, holidaySet]);
  /* v6.5 — giờ chuẩn của HÔM NAY chỉ tính cho người đã gửi giờ hôm nay (cùng quy tắc với Bảng công v6.4) */
  const todayK = fmt(new Date());
  const stdToday = from <= todayK && todayK <= to ? minHoursFor(todayK, hoursCfg, holidaySet) || 0 : 0;
  const sentToday = useMemo(() => {
    const out = new Set();
    for (const e of cfg.employees || []) {
      const b = dbTs(e.id, ymOf(todayK));
      if (b?.sent?.[todayK] && (b.rows || []).some((r) => Number(r.days?.[todayK]) > 0)) out.add(e.id);
    }
    return out;
  }, [cfg.employees, todayK, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const stdBase = stdPeriod - stdToday;
  const stdForEmp = (eid) => (stdToday && !sentToday.has(eid) ? stdBase : stdPeriod);
  const clearFilters = () => { setFDept("all"); setQ(""); };
  const hasFilter = fDept !== "all" || q.trim() !== "";
  // v5.6: chọn nhanh kỳ — Tuần này (T2 → hôm nay), 7 ngày qua, Tháng này (ngày 1 → hôm nay)
  const today = fmt(now);
  const QUICK = [
    ["week", "Tuần này", fmt(mondayOf(now)), today],
    ["lweek", "Tuần trước", fmt(addDays(mondayOf(now), -7)), fmt(addDays(mondayOf(now), -1))],   // v6.6: T2 → CN tuần trước
    ["7d", "7 ngày qua", fmt(addDays(now, -6)), today],
    ["month", "Tháng này", fmt(firstOfMonth(now)), today],
  ];
  const quickOn = QUICK.find(([, , a, b]) => a === from && b === to)?.[0];

  const load = useCallback(async () => {
    setLoading(true);
    const yms = ymsBetween(from, to);
    await ensureMonths([prevYm(yms[0]), ...yms]);   // v2.1: kỳ cũ hơn 6 tháng thì tải thêm trước khi tính
    const detail = [];
    for (const ym of yms) for (const e of cfg.employees) {
      const d = dbTsSent(e.id, ym);   // v1.9: chỉ giờ của ngày đã gửi
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;   // lọc đúng theo NGÀY
        detail.push({ empId: e.id, date, hours: Number(h), projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, otFor: r.otFor || "", note: r.note || "" });
      }
    }
    const status = [];
    for (const ym of yms) {
      const need = mondaysDue(ym);
      for (const e of cfg.employees) {
        const missing = need.filter((m) => !weekDone(e.id, m));
        status.push({ empId: e.id, ym, done: need.length - missing.length, need: need.length, missing });
      }
    }
    setData({ detail, status, yms }); setLoading(false);
  }, [from, to, cfg.employees]);

  // v5.6: đổi kỳ (chọn nhanh hoặc lịch) là tính lại ngay — không cần bấm "Cập nhật"
  useEffect(() => { load(); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  /* v5.6 — số người có giờ (đã gửi) vào từng dự án trong tuần hiện tại (T2 → CN) — cột "Người tuần này" ở tab Dự án */
  const weekPeople = useMemo(() => {
    const m = new Map();
    const mon = fmt(mondayOf(new Date())), sun = fmt(addDays(mondayOf(new Date()), 6));
    for (const e of cfg.employees) for (const ym of new Set([ymOf(mon), ymOf(sun)])) {
      const d = dbTsSent(e.id, ym);
      if (!d?.rows) continue;
      for (const r of d.rows) {
        if (r.projectId === NO_PROJECT || isLeaveTask(r.taskId)) continue;
        if (!Object.entries(r.days || {}).some(([k, h]) => Number(h) && k >= mon && k <= sun)) continue;
        const st = m.get(r.projectId) || new Set(); st.add(e.id); m.set(r.projectId, st);
      }
    }
    return m;
  }, [cfg.employees, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // v1.9: có dòng bảng công vừa đổi trên server thì tính lại ngay, không cần bấm Tải lại
  const firstTick = useRef(dataTick);
  useEffect(() => { if (dataTick !== firstTick.current) load(); }, [dataTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kéo lại toàn bộ từ server — phòng khi nghi ngờ thiếu số liệu
  const rebuild = async () => {
    setRebuilding(true);
    await loadDB(true);
    setRebuilding(false);
    await load();
    flash("Đã tải lại dữ liệu mới nhất.");
  };

  // Dựng Map một lần thay vì .find() trong vòng lặp — trước đây là O(n²) khi xuất Excel
  const empMap = useMemo(() => new Map(cfg.employees.map((e) => [e.id, e])), [cfg.employees]);
  const projMapById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskMap = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes, cfg.otBands, cfg.otLegacy]);
  const empName = (id) => empMap.get(id)?.name || "(đã xoá)";
  const empDept = (id) => empMap.get(id)?.dept || "";
  const empTitle = (id) => roleTitle(empMap.get(id)?.role);
  const projLabel = (id) => { if (id === NO_PROJECT) return "Khác"; const p = projMapById.get(id); return p ? (p.code ? `[${p.code}] ${p.name}` : p.name) : "(dự án đã xoá)"; };
  const taskLabel = (id) => { const t = taskMap.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  // Bộ lọc áp lên toàn bộ số liệu bên dưới: KPI, biểu đồ, ma trận và cả file Excel xuất ra
  const matchEmp = useCallback((eid) => {
    const e = empMap.get(eid);
    if (fDept !== "all" && (e?.dept || "") !== fDept) return false;
    const kw = norm(q.trim());   // v6.6: gõ không dấu vẫn tìm ra ("nguyen linh sang" → Nguyễn Linh Sang)
    if (kw && !norm(`${e?.name || ""} ${e?.code || ""}`).includes(kw)) return false;
    return true;
  }, [empMap, fDept, q]);

  const agg = useMemo(() => {
    if (!data) return null;
    const detail = data.detail.filter((d) => matchEmp(d.empId)
      && (fProj === "all" || d.projectId === fProj)
      && (fPhase === "all" || (d.projectId !== NO_PROJECT && !isLeaveTask(d.taskId) && (d.phaseId || DEFAULT_PHASE) === fPhase)));
    const by = (fn) => { const m = new Map(); for (const d of detail) m.set(fn(d), (m.get(fn(d)) || 0) + d.hours); return m; };
    const matrix = new Map();
    for (const d of detail) {
      if (!matrix.has(d.empId)) matrix.set(d.empId, new Map());
      const mm = matrix.get(d.empId); mm.set(d.projectId, (mm.get(d.projectId) || 0) + d.hours);
    }
    /* v3.4 — OT = giờ chấm vào hạng mục Tăng ca. Giờ cố gắng = giờ làm việc thường vượt ngưỡng ngày của MỘT người
       (tính trên tổng giờ một người trong một ngày, không cộng dồn theo dòng dự án); không tính chi phí dự án. */
    const perEmpDay = new Map();
    for (const d of detail) {
      const k = `${d.empId}|${d.date}`;
      const c = perEmpDay.get(k) || { ot: 0, reg: 0, idle: 0 };
      if (isOtId(d.taskId)) c.ot += d.hours; else if (!isLeaveTask(d.taskId)) { c.reg += d.hours; if (isIdleTask(d.taskId)) c.idle += d.hours; }
      perEmpDay.set(k, c);
    }
    const otByEmp = new Map();
    const effortByEmp = new Map();
    const idleByEmp = new Map();   // v7.2: giờ chờ việc — tính giờ công, không tính tải
    let otTotal = 0, effortTotal = 0, idleTotal = 0;
    for (const [k, c] of perEmpDay) {
      const [eid, date] = k.split("|");
      if (c.ot) { otByEmp.set(eid, (otByEmp.get(eid) || 0) + c.ot); otTotal += c.ot; }
      if (c.idle) { idleByEmp.set(eid, (idleByEmp.get(eid) || 0) + c.idle); idleTotal += c.idle; }
      const ef = effortHoursFor(date, c.reg - c.idle, hoursCfg, holidaySet);
      if (ef) { effortByEmp.set(eid, (effortByEmp.get(eid) || 0) + ef); effortTotal += ef; }
    }
    const leaveTotal = detail.filter((d) => isLeaveTask(d.taskId)).reduce((x, d) => x + d.hours, 0);
    // v2.9: "Khác" (tác vụ chung + vắng mặt) là một cột riêng, đặt cuối; không có giai đoạn
    const byProj0 = by((d) => (isLeaveTask(d.taskId) ? NO_PROJECT : d.projectId));
    const byProj = new Map([...[...byProj0].filter(([k]) => k !== NO_PROJECT), ...[...byProj0].filter(([k]) => k === NO_PROJECT)]);
    const byPhase = by((d) => (d.projectId === NO_PROJECT || isLeaveTask(d.taskId) ? null : d.phaseId || DEFAULT_PHASE));
    return { detail, leaveTotal, byProj, projCount: [...byProj.keys()].filter((k) => k !== NO_PROJECT).length, byEmp: by((d) => d.empId), byTask: by((d) => d.taskId), byPhase, matrix, otByEmp, otTotal, effortByEmp, effortTotal, idleByEmp, idleTotal, total: detail.reduce((s, d) => s + d.hours, 0) };
  }, [data, matchEmp, fProj, fPhase, hoursCfg, holidaySet]);

  const exportExcel = async () => {
    const XLSX = await loadXlsx();
    if (!agg || agg.detail.length === 0) return flash("Không có dữ liệu nào khớp bộ lọc hiện tại.", "err");
    const wb = XLSX.utils.book_new();
    const info = [{
      "Kỳ báo cáo": `${dFull(from)} – ${dFull(to)}`, "Tổng giờ": agg.total, "Giờ OT": +agg.otTotal.toFixed(1), "Giờ cố gắng": +agg.effortTotal.toFixed(1),
      "Số nhân sự": agg.byEmp.size, "Số dự án": agg.projCount,
      "Bộ phận": fDept === "all" ? "Tất cả" : fDept,
      "Dự án lọc": fProj === "all" ? "Tất cả" : projLabel(fProj),
      "Giai đoạn lọc": fPhase === "all" ? "Tất cả" : phaseLabel(fPhase),
      "Từ khoá tìm": q.trim() || "—",
      "Xuất lúc": new Date().toLocaleString("vi-VN"),
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Thông tin kỳ");
    // sort trên bản sao — tránh sửa trực tiếp mảng đang nằm trong state
    const detail = [...agg.detail].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      "Ngày": d.date, "Thứ": DOW[(parseD(d.date).getDay() + 6) % 7],
      "Nhân sự": empName(d.empId), "Bộ phận": empDept(d.empId), "Vai trò": empTitle(d.empId),
      "Dự án": projLabel(d.projectId), "Giai đoạn": d.projectId === NO_PROJECT || isLeaveTask(d.taskId) ? "" : phaseLabel(d.phaseId),
      "Hạng mục": taskLabel(d.taskId), "Tăng ca cho tác vụ": isOtId(d.taskId) ? (d.otFor ? taskLabel(d.otFor) : "Chưa rõ") : "",
      "Ghi chú": d.note || "", "Giờ": d.hours,
      // v4.9: hệ số + giờ quy đổi của dòng tăng ca
      "Hệ số TC": isOtId(d.taskId) ? otRateFor(cfg, taskMap.get(d.taskId), otDayKind(d.date, holidaySet)) : "",
      "Giờ quy đổi": isOtId(d.taskId) ? +(d.hours * otRateFor(cfg, taskMap.get(d.taskId), otDayKind(d.date, holidaySet))).toFixed(2) : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Chi tiết");
    /* v4.9 — Tăng ca: dự án × giai đoạn × tác vụ × khung giờ, tách ngày thường / CN / lễ, kèm hệ số và giờ quy đổi */
    {
      const m = new Map(), bandRep = new Map();
      for (const d of agg.detail) {
        if (!isOtId(d.taskId)) continue;
        const kind = otDayKind(d.date, holidaySet);
        const bt = taskMap.get(d.taskId);   // v5.1: gộp theo khung giờ, giữ một hạng mục đại diện để lấy tên + hệ số
        const k = [d.projectId, d.phaseId || DEFAULT_PHASE, d.otFor || "", bt ? otBandKey(bt) : d.taskId, kind].join("|");
        if (bt && !bandRep.has(k)) bandRep.set(k, bt);
        m.set(k, (m.get(k) || 0) + d.hours);
      }
      const KIND = { n: "Ngày thường", s: "Chủ nhật", h: "Ngày lễ" };
      const otRowsX = [...m.entries()].map(([k, h]) => {
        const [pid, ph, forId, , kind] = k.split("|");
        const bt = bandRep.get(k);
        const rate = otRateFor(cfg, bt, kind);
        return { "Dự án": projLabel(pid), "Giai đoạn": phaseLabel(ph), "Tăng ca cho tác vụ": forId ? taskLabel(forId) : "Chưa rõ",
          "Khung giờ": bt ? otText(bt) : "(đã xoá)", "Loại ngày": KIND[kind], "Giờ": +h.toFixed(2), "Hệ số": rate, "Giờ quy đổi": +(h * rate).toFixed(2) };
      }).sort((a, b) => a["Dự án"].localeCompare(b["Dự án"]) || a["Giai đoạn"].localeCompare(b["Giai đoạn"]) || a["Tăng ca cho tác vụ"].localeCompare(b["Tăng ca cho tác vụ"]) || a["Khung giờ"].localeCompare(b["Khung giờ"]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(otRowsX.length ? otRowsX : [{ "Dự án": "(không có giờ tăng ca trong kỳ)" }]), "Tăng ca");
    }
    const sortDesc = (m, fn) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => fn(k, v));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(new Map([...agg.byProj].filter(([k]) => k !== null)), (k, v) => ({ "Dự án": projLabel(k), "Tổng giờ": v, "Tỷ trọng %": +(v / agg.total * 100).toFixed(1) }))), "Theo dự án");
    // v1.9: dự án × phase — giờ dự kiến, đã dùng (theo kỳ và bộ lọc đang chọn), còn lại, % sử dụng
    const usedByProj = new Map(projectRows.map((r) => [r.id, r]));
    const budgetRows = [];
    for (const pr of [...cfg.projects, ...projectRows.filter((r) => !projMapById.has(r.id)).map((r) => ({ id: r.id, name: r.name }))]) {
      if (fProj !== "all" && pr.id !== fProj) continue;
      const u = usedByProj.get(pr.id), bg = projBudgets(pr);
      if (!u && budgetTotal(pr) === 0) continue;
      const line = (label, b, used) => ({ "Mã DA": pr.code || "", "Dự án": pr.name, "Giai đoạn": label, "Giờ dự kiến": b > 0 ? b : "", "Đã dùng": +Number(used).toFixed(1),
        "Còn lại": b > 0 ? +(b - used).toFixed(1) : "", "% sử dụng": b > 0 ? +((used / b) * 100).toFixed(1) : "" });
      for (const ph of PHASES) budgetRows.push(line(`${ph.id} · ${ph.name}`, bg[ph.id], u?.[ph.id] || 0));
      budgetRows.push(line("Tổng", budgetTotal(pr), u?.total || 0));
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budgetRows.length ? budgetRows : [{ "Dự án": "(chưa có dữ liệu)" }]), "Dự kiến theo phase");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(PHASES.map((p) => ({
      "Giai đoạn": `${p.id} · ${p.name}`,
      "Tổng giờ": +(agg.byPhase.get(p.id) || 0).toFixed(1),
      "Tỷ trọng %": agg.total ? +((agg.byPhase.get(p.id) || 0) / agg.total * 100).toFixed(1) : 0,
      "Nội dung": p.desc,
    }))), "Theo giai đoạn");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(agg.byEmp, (k, v) => ({
      "Nhân sự": empName(k), "Bộ phận": empDept(k), "Vai trò": empTitle(k), "Tổng giờ": v,
      "Giờ OT": +(agg.otByEmp.get(k) || 0).toFixed(1),
      "Giờ cố gắng": +(agg.effortByEmp.get(k) || 0).toFixed(1),
      "Giờ chờ việc": +(agg.idleByEmp.get(k) || 0).toFixed(1),   // v7.2
      "Giờ thường": +(v - (agg.otByEmp.get(k) || 0) - (agg.effortByEmp.get(k) || 0) - (agg.idleByEmp.get(k) || 0)).toFixed(1),
      // v5.3: tải so với giờ chuẩn của kỳ, cùng ngưỡng với khung Phân bổ · v7.2: tải không gồm chờ việc
      "% tải": stdForEmp(k) ? Math.round(((v - (agg.idleByEmp.get(k) || 0)) / stdForEmp(k)) * 100) : "",
      "Trạng thái": (() => { const sp = stdForEmp(k); return sp ? ALLOC_ST[allocState(v, agg.otByEmp.get(k) || 0, agg.effortByEmp.get(k) || 0, agg.idleByEmp.get(k) || 0, sp, allocLimits(cfg))][0] : ""; })(),
    }))), "Theo nhân sự");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(agg.byTask, (k, v) => ({ "Hạng mục": taskLabel(k), "Tổng giờ": v }))), "Theo hạng mục");
    const projIds = [...agg.byProj.keys()];
    const mtx = [...agg.matrix.entries()].map(([eid, mm]) => {
      const row = { "Nhân sự": empName(eid), "Bộ phận": empDept(eid), "Vai trò": empTitle(eid) };
      let t = 0; for (const pid of projIds) { row[projLabel(pid)] = mm.get(pid) || 0; t += mm.get(pid) || 0; }
      row["Tổng"] = t; return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mtx), "Ma trận NS x DA");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.status.filter((s) => matchEmp(s.empId)).map((s) => ({
      "Tháng": s.ym, "Nhân sự": empName(s.empId), "Vai trò": empTitle(s.empId), "Số tuần cần nộp": s.need,
      "Đã nộp": s.done, "Thiếu": s.need - s.done, "Tuần thiếu": s.missing.map(dLabel).join(", "),
    }))), "Tình trạng nộp");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ARTIUS_gio-cong_${from}_den_${to}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    flash("Đã xuất file Excel.");
  };

  /* Hạn mức giờ dự án: dùng toàn bộ dữ liệu đã tải, KHÔNG áp bộ lọc kỳ —
     hỏi "dự án này đã tiêu bao nhiêu giờ" thì phải tính từ đầu, không phải tính trong tháng. */

  /* Gộp ba biểu đồ cũ làm một: giờ theo dự án, phân rã theo giai đoạn, và mốc giờ dự kiến.
     Giờ vắng mặt không thuộc dự án nào nên loại khỏi đây. */
  const projectRows = useMemo(() => {
    if (!agg) return [];
    const m = new Map();
    for (const d of agg.detail) {
      if (isLeaveTask(d.taskId) || d.projectId === NO_PROJECT) continue;
      if (!m.has(d.projectId)) m.set(d.projectId, { total: 0 });
      const row = m.get(d.projectId);
      const ph = d.phaseId || DEFAULT_PHASE;
      row[ph] = (row[ph] || 0) + d.hours;
      row.total += d.hours;
    }
    return [...m.entries()]
      .map(([id, r]) => {
        const p = projMapById.get(id);
        const base = { id, name: projLabel(id), total: r.total, budget: budgetTotal(p), budgets: projBudgets(p) };
        for (const ph of PHASES) base[ph.id] = r[ph.id] || 0;
        return base;
      })
      .sort((a, b) => b.total - a.total);
  }, [agg, projMapById]);

  const nProjActive = cfg.projects.filter((p) => p.active).length;
  const segBtn = (on) => `${CTRL} whitespace-nowrap px-3 text-[13px] ${on ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`;
  return (
    <div className="space-y-3 md:space-y-4">
      {/* v5.6 — chuyển tab Dự án | Nhân sự */}
      <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1 md:inline-flex">
        {[["proj", "Dự án", nProjActive], ["ppl", "Nhân sự", cfg.employees.length]].map(([k, l, n]) => (
          <button key={k} onClick={() => setDTab(k)} aria-pressed={dTab === k}
            className={`${CTRL} flex flex-1 items-center justify-center gap-2 rounded-lg px-6 text-sm font-medium md:flex-none ${dTab === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>
            {l}<span className={`rounded-full px-1.5 font-mono text-[11px] ${dTab === k ? "bg-teal-900/60 text-teal-300" : "bg-slate-800 text-slate-500"}`}>{n}</span>
          </button>
        ))}
      </div>

      {dTab === "proj" && (
        <Panel title="Tiến độ dự án" sub="Giờ đã dùng từ trước tới nay so với giờ dự kiến từng giai đoạn — không phụ thuộc kỳ" flush>
          <ProjectProgress cfg={cfg} weekPeople={weekPeople} dataTick={dataTick} saveCfg={saveCfg} flash={flash} />
        </Panel>
      )}

      {dTab === "ppl" && (
        <Panel title="Nhân sự theo kỳ" flush
          sub={<>{QUICK.find(([k]) => k === quickOn)?.[1] || "Kỳ tuỳ chọn"} · {dLabel(from)} – {dLabel(to)} · giờ chuẩn của kỳ <span className="font-mono text-amber-400">{fmtH(stdBase)} h</span>{stdToday > 0 && <span className="text-slate-500"> (hôm nay tính khi đã gửi)</span>}</>}
          right={loading ? <Loader2 className="shrink-0 animate-spin text-slate-500" size={16} /> : null}>
          {/* thanh công cụ của tab: kỳ, bộ phận, tìm người, tải lại, Excel — chỉ tác động lên tab Nhân sự */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
            <div className="flex max-w-full overflow-x-auto rounded-md border border-slate-700">
              {QUICK.map(([k, l, a, b]) => (
                <button key={k} onClick={() => setRange(a, b)} className={segBtn(quickOn === k)}>{l}</button>
              ))}
            </div>
            <div className="w-full sm:w-72"><DateRangeField from={from} to={to} onChange={setRange} /></div>
            <div className="w-full sm:w-48">
              <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={selectCls} aria-label="Bộ phận">
                <option value="all">Tất cả bộ phận</option>
                {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="relative w-full sm:w-56">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự" className={`pl-9 ${inputCls}`} />
            </div>
            {hasFilter && <button onClick={clearFilters} className={`shrink-0 whitespace-nowrap ${btnGhost}`}><X size={14} /> Bỏ lọc</button>}
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <button onClick={rebuild} disabled={rebuilding} title="Kéo lại bản mới nhất từ lưu trữ, để thấy bảng công người khác vừa gửi"
                className={`flex-1 sm:flex-none ${btnGhost} disabled:opacity-40`}>
                {rebuilding ? <Loader2 className="animate-spin" size={15} /> : <RotateCcw size={15} />} Tải lại
              </button>
              <button onClick={exportExcel} className={`flex-1 sm:flex-none ${btnPrimary}`}><Download size={15} /> Excel</button>
            </div>
          </div>
          {!agg ? <p className="px-4 py-6 text-sm text-slate-500">Đang tải…</p> : (
            <StaffAllocation matrix={agg.matrix} otByEmp={agg.otByEmp} effortByEmp={agg.effortByEmp} idleByEmp={agg.idleByEmp} std={stdBase} stdOf={stdForEmp} cfg={cfg}
              staff={cfg.employees.filter((e) => matchEmp(e.id))}
              empName={empName} projMapById={projMapById} detail={agg.detail}
              projDetail={data.detail} taskLabel={taskLabel} />
          )}
        </Panel>
      )}
    </div>
  );
}


/* Biểu đồ gộp cho khối dự án: mỗi dự án là một cột chồng chia theo 4 giai đoạn,
   kèm mốc giờ dự kiến. Một hình trả lời được cả ba câu: dự án nào ngốn giờ,
   giờ đó rơi vào chặng nào, và đã vượt dự toán chưa. */
/* v1.9 — Mỗi dự án 4 thanh theo phase: phần tô màu là giờ đã dùng (theo kỳ và bộ lọc đang chọn),
   vạch trắng là mốc giờ dự kiến của phase đó. Vượt mốc thì số chuyển đỏ và tên dự án có nhãn "Vượt Px". */
/* ============================================================
   v4.6 — Dashboard quản lý: Tiến độ dự án + Phân bổ giờ công theo nhân sự
   ============================================================ */
const PG_COLOR = { ok: "#14b8a6", warn: "#f59e0b", over: "#f43f5e" };
const PG_COLOR_L = { ok: "#059669", warn: "#d97706", over: "#e11d48" };   // v7.8: bản đậm hơn cho nền sáng
const pgColor = (L) => (isLight() ? PG_COLOR_L : PG_COLOR)[L];
const pgLevel = (pct) => (pct == null ? "none" : pct > 100 ? "over" : pct >= 80 ? "warn" : "ok");
const ProgressLegend = () => (
  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
    <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-teal-400">&lt; 80%</span>
    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">80–100% sắp vượt</span>
    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-400">&gt; 100% vượt</span>
  </div>
);

/* v4.7 — Chi tiết từng giai đoạn: tính từ khối số liệu database (artius_phase_detail) hoặc, khi chưa hỏi được,
   từ phần bảng công đang có trong bộ nhớ. Kết quả: Map "<projectId>|<phaseId>" -> { w, e, t, first, last }. */
const phaseDetailFromMemory = () => {
  const out = new Map();
  const hs = makeHolidayIndex(DB?.config?.holidays);
  for (const [slotKey, bucket] of Object.entries(DB?.ts || {})) {
    const empId = slotKey.split(":")[0];
    for (const r of sentRows(bucket)) {
      if (isLeaveTask(r.taskId) || r.projectId === NO_PROJECT || !r.projectId) continue;
      const k = `${r.projectId}|${r.phaseId || DEFAULT_PHASE}`;
      const o = out.get(k) || { w: {}, e: {}, t: {}, o: {}, et: {}, first: "", last: "" };
      for (const [d, v] of Object.entries(r.days || {})) {
        const h = Number(v) || 0;
        if (h <= 0) continue;
        const wk = fmt(mondayOf(parseD(d)));
        o.w[wk] = (o.w[wk] || 0) + h; o.e[empId] = (o.e[empId] || 0) + h; o.t[r.taskId] = (o.t[r.taskId] || 0) + h;
        { const et = (o.et[empId] ||= {}), tk = `${r.taskId}|${isOtId(r.taskId) ? r.otFor || "" : ""}`; et[tk] = (et[tk] || 0) + h; }   // v5.6
        if (isOtId(r.taskId)) { const ok = `${r.taskId}|${r.otFor || ""}|${otDayKind(d, hs)}`; o.o[ok] = (o.o[ok] || 0) + h; }   // v4.9
        if (!o.first || d < o.first) o.first = d;
        if (!o.last || d > o.last) o.last = d;
      }
      out.set(k, o);
    }
  }
  return out;
};

const DT_MAX_WEEKS = 16;   // biểu đồ theo tuần: tối đa 16 tuần gần nhất của giai đoạn
const OT_MAX = 40;         // thang của thanh Tăng ca (%); vượt 40% thì vạch nằm cuối thanh
const otLevel = (pct) => (pct < 15 ? "ok" : pct < 25 ? "mid" : "hi");
const ddmm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const daysBetween = (a, b) => Math.round((b - a) / 864e5);

/* Gom số liệu của một ô (dự án × giai đoạn) thành những gì thẻ rê chuột và khung chi tiết cần. */
const buildPhaseInfo = (raw, cell, ctx) => {
  if (!raw) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisMon = mondayOf(today);
  /* v5.6 — tác vụ của từng người trong giai đoạn (cho thẻ rê chuột vào tên). Database cũ chưa có "et" thì tạm tính từ bộ nhớ. */
  const etAll = raw.et || ctx.memEt?.(cell.key) || {};
  const tName = (id) => { const t = ctx.taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };
  const empTasks = (id) => {
    const m = new Map();
    for (const [key, hv] of Object.entries(etAll[id] || {})) {
      const h = Number(hv) || 0; if (h <= 0) continue;
      const [tid, forId = ""] = key.split("|");
      const ot = isOtId(tid), lbl = ot ? `Tăng ca · ${forId ? tName(forId) : "chưa rõ tác vụ"}` : tName(tid);
      const x = m.get(lbl) || { name: lbl, h: 0, ot }; x.h += h; m.set(lbl, x);
    }
    return [...m.values()].sort((a, b) => (a.ot - b.ot) || b.h - a.h);
  };
  const people = Object.entries(raw.e || {})
    .map(([id, h]) => { const e = ctx.empById.get(id); return { id, name: e?.name || "(nhân sự đã xoá)", role: e ? roleTitle(e.role) : "", h: Number(h) || 0, tasks: empTasks(id) }; })
    .filter((x) => x.h > 0).sort((a, b) => b.h - a.h);
  let ot = 0;
  const tasks = [];
  for (const [id, hv] of Object.entries(raw.t || {})) {
    const h = Number(hv) || 0;
    if (h <= 0) continue;
    if (isOtId(id)) { ot += h; continue; }
    const t = ctx.taskById.get(id);
    tasks.push({ name: t ? taskText(t) : "(tác vụ đã xoá)", h });
  }
  tasks.sort((a, b) => b.h - a.h);
  /* v4.9 — tăng ca theo "tăng ca cho tác vụ" × khung giờ, kèm giờ quy đổi (giờ × hệ số; CN / lễ dùng hệ số riêng nếu có) */
  const otMap = new Map(), bandIds = new Map();
  let otW = 0;
  for (const [key, hv] of Object.entries(raw.o || {})) {
    const h = Number(hv) || 0;
    if (h <= 0) continue;
    const [bid, forId = "", kind = "n"] = key.split("|");
    const bt = ctx.taskById.get(bid);
    const w = h * otRateFor(ctx.cfg, bt || { id: bid, name: "" }, kind);
    const bk = bt ? otBandKey(bt) : `?${bid}`;   // v5.1: gộp các hạng mục [OT] cùng khung giờ (của nhiều vai trò) vào một cột
    const row = otMap.get(forId) || { forId, b: {}, special: 0, h: 0, w: 0 };
    row.b[bk] = (row.b[bk] || 0) + h; row.h += h; row.w += w;
    if (kind !== "n") row.special += h;
    otMap.set(forId, row); otW += w;
    if (!bandIds.has(bk)) bandIds.set(bk, bt);
  }
  const otBandsUsed = [...bandIds.entries()].sort((a, b) => (a[1] ? ctx.taskOrder.get(a[1].id) ?? 1e9 : 1e9) - (b[1] ? ctx.taskOrder.get(b[1].id) ?? 1e9 : 1e9))
    .map(([id, t]) => ({ id, label: t ? otText(t) : "(khung đã xoá)", rate: t ? otRateOf(ctx.cfg, t) : null }));
  const otByTask = [...otMap.values()].map((x) => {
    const t = x.forId ? ctx.taskById.get(x.forId) : null;
    return { ...x, name: x.forId ? (t ? taskText(t) : "(tác vụ đã xoá)") : "Chưa rõ tác vụ (giờ tăng ca trước v4.9)" };
  }).sort((a, b) => (!a.forId) - (!b.forId) || b.h - a.h);
  const total = people.reduce((a, x) => a + x.h, 0);
  if (!total) return null;
  // tuần: từ thứ Hai của ngày đầu tiên tới tuần này (giai đoạn mở) hoặc tuần cuối có giờ (giai đoạn đóng)
  const first = mondayOf(parseD(raw.first || raw.last));
  const lastDay = parseD(raw.last || raw.first);
  const end = cell.open ? thisMon : mondayOf(lastDay);
  const weeks = [];
  for (let m = new Date(first); m <= end && weeks.length < 520; m = addDays(m, 7)) weeks.push({ mon: new Date(m), h: Number(raw.w?.[fmt(m)]) || 0 });
  // tốc độ = trung bình 4 tuần đã qua gần nhất (không tính tuần đang chạy vì thường chưa gửi xong)
  let rate = null;
  if (cell.open) {
    const done = weeks.filter((w) => w.mon < thisMon).slice(-4);
    if (done.length) rate = done.reduce((a, w) => a + w.h, 0) / 4;
  }
  return { people, tasks, ot, otByTask, otBandsUsed, otW, otNoDetail: ot > 0 && raw.o === undefined, total, weeks, rate, first: parseD(raw.first || raw.last), last: lastDay,
    idleDays: daysBetween(lastDay, today), nWeeks: Math.max(1, Math.round(daysBetween(first, mondayOf(lastDay)) / 7) + 1) };
};

/* Dự báo cho giai đoạn đang mở. full = câu đầy đủ (thẻ rê chuột), short = chỉ kết luận (khung chi tiết). */
const phaseForecast = (cell, info) => {
  const left = cell.b - cell.h;
  if (info.idleDays >= 10) {
    const t = <>Đứng im {info.idleDays} ngày — không ai gửi giờ vào giai đoạn này từ {ddmm(info.last)}. Kiểm tra dự án có đang tạm dừng?</>;
    return { cls: "idle", full: t, short: t };
  }
  if (!info.rate) { const t = "Chưa đủ dữ liệu để dự báo."; return { cls: "idle", full: t, short: t }; }
  if (!cell.b) { const t = <>Giai đoạn chưa có giờ dự kiến — tốc độ {fmtH(info.rate)} h/tuần.</>; return { cls: "idle", full: t, short: t }; }
  if (left < 0) return { cls: "over",
    full: <>Đã vượt <b>{fmtH(-left)} h</b> và vẫn đang tiêu {fmtH(info.rate)} h/tuần. Nếu không chặn, 2 tuần tới sẽ vượt thêm ~{fmtH(info.rate * 2)} h.</>,
    short: <>→ Đã vượt <b>{fmtH(-left)} h</b>; nếu giữ tốc độ này, 2 tuần tới vượt thêm ~{fmtH(info.rate * 2)} h.</> };
  const wk = left / info.rate, hit = addDays(new Date(), Math.round(wk * 7));
  const cls = wk < 2 ? "over" : wk < 4 ? "warn" : "ok";
  const dur = wk < 1 ? `${Math.max(1, Math.round(wk * 7))} ngày` : `${fmtH(wk)} tuần`;
  const tail = <>sẽ hết {fmtH(left)} h còn lại trong <b>~{dur}</b> (khoảng <b>{ddmm(hit)}</b>).</>;
  return { cls, full: <>Tốc độ 4 tuần gần nhất: <b>{fmtH(info.rate)} h/tuần</b> → {tail}</>, short: <>→ {tail}</> };
};
const FC_CLS = { ok: "bg-teal-400/[.07] text-teal-100", warn: "bg-amber-500/10 text-amber-200", over: "bg-rose-500/[.12] text-rose-200", idle: "bg-slate-800 text-slate-400" };

/* Danh sách tên — giờ — % kèm thanh nhỏ (nhân sự / tác vụ) */
const KvList = ({ items, total, n, withRole, onTip }) => {
  const top = items[0]?.h || 1;
  return (
    <div>
      {items.slice(0, n).map((x, i) => (
        <div key={i} className={`grid grid-cols-[minmax(0,1fr)_52px_36px] items-center gap-x-1.5 py-[3px] ${onTip ? "-mx-1.5 cursor-default rounded-md px-1.5 hover:bg-slate-800/70" : ""}`}
          onMouseMove={onTip ? (e) => onTip({ x, cx: e.clientX, cy: e.clientY }) : undefined} onMouseLeave={onTip ? () => onTip(null) : undefined}>
          <span className="truncate text-slate-200">{x.name}{withRole && x.role && <span className="ml-1.5 text-[11px] text-slate-600">{x.role}</span>}</span>
          <span className="text-right font-mono text-slate-100">{fmtH(x.h)}</span>
          <span className="text-right font-mono text-[11px] text-slate-500">{Math.round((x.h / total) * 100)}%</span>
          <div className="col-span-3 h-[3px] overflow-hidden rounded bg-slate-800"><div className="h-full bg-teal-500" style={{ width: `${(x.h / top) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
};

/* Biểu đồ cột giờ theo tuần; màu cột = giờ LŨY KẾ tới tuần đó so với giờ dự kiến (xanh < 80%, cam 80–100%, đỏ > 100%) */
const WeeklyChart = ({ cell, info }) => {
  const wks = info.weeks.slice(-DT_MAX_WEEKS);
  const W = 520, H = 150, padX = 28, n = Math.max(1, wks.length);
  const max = Math.max(1, ...wks.map((w) => w.h), info.rate || 0) * 1.15;
  const bw = (W - padX * 2) / n;
  let cum = cell.h - wks.reduce((a, w) => a + w.h, 0);
  const bars = wks.map((w, i) => {
    cum += w.h;
    const col = !cell.b ? "#14b8a6" : cum > cell.b ? "#f43f5e" : cum >= cell.b * 0.8 ? "#f59e0b" : "#14b8a6";
    const h = (w.h / max) * H, x = padX + i * bw + 3, y = H - h + 4, cx = x + (bw - 6) / 2;
    return (
      <g key={i}>
        <rect x={x} y={y} width={Math.max(2, bw - 6)} height={h} rx="3" fill={col} opacity={cell.open ? 1 : 0.6}>
          <title>{`Tuần ${ddmm(w.mon)}: ${fmtH(w.h)} h · lũy kế ${fmtH(cum)}${cell.b ? ` / ${fmtH(cell.b)}` : ""} h`}</title>
        </rect>
        {w.h > 0 && <text x={cx} y={y - 4} fill={isLight() ? "#475569" : "#94a3b8"} fontSize="10" textAnchor="middle" fontFamily="Consolas,monospace">{fmtH(w.h)}</text>}
        {(n <= 16 || i % 2 === 0) && <text x={cx} y={H + 18} fill={isLight() ? "#64748b" : "#64748b"} fontSize="10" textAnchor="middle">{ddmm(w.mon)}</text>}
      </g>
    );
  });
  const ry = info.rate ? H - (info.rate / max) * H + 4 : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ maxWidth: W }}>
        {bars}
        {ry != null && <line x1={padX} x2={W - padX} y1={ry} y2={ry} stroke="#fbbf24" strokeDasharray="4 4" strokeWidth="1.5" />}
      </svg>
      {info.rate != null && (
        <div className="mt-1.5 text-[11.5px] text-slate-500">
          <span className="mr-1.5 inline-block w-3.5 border-t-2 border-dashed border-amber-400 align-middle" />
          Trung bình 4 tuần gần nhất: <span className="text-amber-400">{fmtH(info.rate)} h/tuần</span>
        </div>
      )}
      {info.weeks.length > DT_MAX_WEEKS && <div className="mt-0.5 text-[11px] text-slate-600">Hiện {DT_MAX_WEEKS} tuần gần nhất trên tổng {info.weeks.length} tuần.</div>}
    </div>
  );
};

const REWORK_RE = /chỉnh sửa|sửa lại|góp ý|khách hàng/i;

/* Khung chi tiết khi bấm vào ô giai đoạn (mở ngay dưới dòng dự án) */
const PhaseDetail = ({ cell, info, onClose, partial }) => {
  const [tip, setTip] = useState(null);   // v5.6: { x: người, cx, cy } — thẻ tác vụ khi rê chuột vào tên nhân sự
  const [otOpen, setOtOpen] = useState(false);   // v5.6: bảng tăng ca theo tác vụ — mặc định thu gọn, bấm nút trong khung TĂNG CA để mở
  const hasOtTable = info.otByTask?.length > 0;
  const otPct = info.total ? Math.round((info.ot / info.total) * 100) : 0;
  const lv = otLevel(otPct);
  const fc = cell.open ? phaseForecast(cell, info) : null;
  const pct = cell.b ? Math.round((cell.h / cell.b) * 100) : null;
  const OT_BOX = { ok: "border-teal-900 bg-teal-400/[.06]", mid: "border-amber-800 bg-amber-500/[.08]", hi: "border-rose-800 bg-rose-500/[.08]" }[lv];
  const OT_TXT = { ok: "text-teal-400", mid: "text-amber-400", hi: "text-rose-400" }[lv];
  return (
    <div className="relative grid grid-cols-1 gap-[18px] p-4 text-[13px] lg:grid-cols-[1.25fr_1fr_1fr] lg:pr-[120px]">
      <button onClick={onClose} className="absolute right-4 top-3 h-[30px] rounded-md border border-slate-700 px-2.5 text-xs text-slate-400 hover:text-slate-100">Đóng ✕</button>
      <div>
        <h4 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Giờ theo tuần (màu = lũy kế so với dự kiến)</h4>
        <WeeklyChart cell={cell} info={info} />
        {fc ? <div className={`mt-1.5 rounded-lg px-2.5 py-2 text-[12.5px] ${FC_CLS[fc.cls]}`}>{fc.short}</div>
          : <div className={`mt-1.5 rounded-lg px-2.5 py-2 text-[12.5px] ${FC_CLS[cell.b && cell.h > cell.b ? "over" : "ok"]}`}>
              {pct != null ? <>Đóng ở {pct}%{cell.h > cell.b ? ` — vượt ${fmtH(cell.h - cell.b)} h` : ""}. </> : null}
              Chạy {info.nWeeks} tuần ({ddmm(info.first)} → {ddmm(info.last)}). Dùng số này khi báo giá giai đoạn {cell.ph.name.toLowerCase()} cho dự án tương tự.
            </div>}
        {partial && <div className="mt-1.5 text-[11px] text-amber-500/80">Đang tính trên dữ liệu đã tải (vài tháng gần nhất). Chạy lại supabase/schema.sql (mục 14) để xem đủ.</div>}
      </div>
      <div>
        <h4 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Nhân sự ({info.people.length})</h4>
        <KvList items={info.people} total={info.total} n={10} withRole onTip={setTip} />
        {info.people.length > 10 && <div className="mt-1 text-[11px] text-slate-600">+ {info.people.length - 10} người khác</div>}
      </div>
      <div>
        <h4 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Tác vụ ({info.tasks.length})</h4>
        {info.tasks.length ? <KvList items={info.tasks} total={info.total} n={10} /> : <div className="text-slate-500">Chỉ có giờ tăng ca.</div>}
        {info.tasks.length > 10 && <div className="mt-1 text-[11px] text-slate-600">+ {info.tasks.length - 10} tác vụ khác</div>}
        {info.tasks[0] && REWORK_RE.test(info.tasks[0].name) && (
          <div className="mt-1.5 text-[11.5px] text-amber-400">⚠ Tác vụ lớn nhất là "{info.tasks[0].name}" — có thể là vòng sửa lại / khách đổi ý. Nên rà lại phạm vi.</div>
        )}
      </div>
      <div className={`flex flex-wrap items-center gap-[18px] rounded-[10px] border px-4 py-3 lg:col-span-3 lg:-mr-[102px] ${OT_BOX}`}>
        {hasOtTable ? (
          <button type="button" onClick={() => setOtOpen((o) => !o)} aria-expanded={otOpen} title={otOpen ? "Thu gọn tăng ca theo tác vụ" : "Xem tăng ca theo tác vụ"}
            className="-my-2 -ml-2 flex min-h-[44px] items-center gap-1.5 rounded-md px-2 hover:bg-slate-50/[.06]">
            {otOpen ? <ChevronDown size={16} className="text-slate-300" /> : <ChevronRight size={16} className="text-slate-300" />}
            <span className="text-[13.6px] font-bold tracking-wide text-slate-100">TĂNG CA</span>
          </button>
        ) : <span className="text-[13.6px] font-bold tracking-wide text-slate-100">TĂNG CA</span>}
        <span className="text-slate-100">{fmtH(info.ot)} h · {otPct}% tổng giờ giai đoạn</span>
        <span className="relative mx-1 mb-3.5 flex h-2 w-[300px] gap-0.5">
          <span className={`h-full rounded-l bg-teal-500 ${lv === "ok" ? "" : "opacity-[.35]"}`} style={{ width: `${(15 / OT_MAX) * 100}%` }} />
          <span className={`h-full bg-amber-500 ${lv === "mid" ? "" : "opacity-[.35]"}`} style={{ width: `${(10 / OT_MAX) * 100}%` }} />
          <span className={`h-full flex-1 rounded-r bg-rose-500 ${lv === "hi" ? "" : "opacity-[.35]"}`} />
          <span className="absolute -top-[5px] -ml-[1.5px] h-[18px] w-[3px] rounded-sm bg-slate-50 shadow-[0_0_0_2px_#0b1220]" style={{ left: `${Math.min(100, (otPct / OT_MAX) * 100)}%` }} />
          {[[7.5, "Bình thường 0–15%"], [20, "TB 15–25%"], [32.5, "Cao >25%"]].map(([at, t]) => (
            <span key={t} className="absolute top-3 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500" style={{ left: `${(at / OT_MAX) * 100}%` }}>{t}</span>
          ))}
        </span>
        <span className={`font-semibold ${OT_TXT}`}>{lv === "ok" ? "Trong mức bình thường" : lv === "mid" ? "Mức trung bình — cần theo dõi" : "Cao — dấu hiệu áp lực tiến độ"}</span>
      </div>
      {hasOtTable && otOpen && <OtByTaskTable info={info} />}
      {info.otNoDetail && <div className="text-[11.5px] text-amber-500/80 lg:col-span-3">Chưa xem được tăng ca theo tác vụ — chạy lại supabase/schema.sql (bản v4.9) trên Supabase.</div>}
      {tip && tip.x.tasks?.length > 0 && (() => {
        /* v5.6 — thẻ tác vụ của một người trong giai đoạn: Tác vụ · Giờ · % (trên tổng giờ của người đó trong giai đoạn) */
        const ts = tip.x.tasks, pc = pct100(ts.map((t) => t.h));
        const W = 340, left = tip.cx + 14 + W > window.innerWidth - 8 ? tip.cx - W - 14 : tip.cx + 14;
        const top = Math.max(8, Math.min(window.innerHeight - 64 - (ts.length + 2) * 24, tip.cy + 14));
        return (
          <div className="pointer-events-none fixed z-[70] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[12.5px] shadow-2xl" style={{ left, top, width: W }}>
            <div className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 pb-1 text-[10.5px] uppercase tracking-wider text-slate-600"><span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span></div>
            {ts.map((t, i) => (
              <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 py-0.5">
                <span className={`truncate ${t.ot ? "text-teal-400" : "text-slate-100"}`}>{t.name}</span>
                <span className="text-right font-mono text-slate-200">{fmtH(t.h)}</span>
                <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
              </div>
            ))}
            <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 border-t border-slate-800 pt-1.5">
              <span className="text-slate-500">Chiếm trong giai đoạn</span>
              <span className="text-right font-mono text-slate-100">{Math.round((tip.x.h / info.total) * 100)}% <span className="text-slate-600">/ {fmtH(info.total)} h</span></span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

/* v4.9 — Bảng tăng ca theo tác vụ × khung giờ trong khung chi tiết giai đoạn (chỉ giờ đã gửi) */
const OtByTaskTable = ({ info }) => {
  const bands = info.otBandsUsed || [];
  const col = (bid) => info.otByTask.reduce((a, x) => a + (x.b[bid] || 0), 0);
  const sp = info.otByTask.reduce((a, x) => a + x.special, 0);
  return (
    <div className="overflow-x-auto lg:col-span-3 lg:-mr-[102px]">
      <table className="-mt-2 w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-800 text-[11.5px] text-slate-500">
            <th className="py-1.5 pr-3 text-left font-medium">Tác vụ</th>
            {bands.map((b) => <th key={b.id} className="px-2 py-1.5 text-right font-medium text-teal-400">{b.label}</th>)}
            {sp > 0 && <th className="px-2 py-1.5 text-right font-medium" title="Phần giờ rơi vào Chủ nhật hoặc ngày lễ (đã gồm trong các cột khung giờ)">Trong đó CN / lễ</th>}
            <th className="py-1.5 pl-2 text-right font-medium">Tổng tăng ca</th>
          </tr>
        </thead>
        <tbody>
          {info.otByTask.map((x) => (
            <tr key={x.forId || "_"} className={`border-b border-slate-800/70 ${x.forId ? "" : "text-slate-500"}`}>
              <td className={`py-1.5 pr-3 ${x.forId ? "text-slate-200" : ""}`}>{x.name}</td>
              {bands.map((b) => <td key={b.id} className="px-2 py-1.5 text-right font-mono">{x.b[b.id] ? fmtH(x.b[b.id]) : ""}</td>)}
              {sp > 0 && <td className="px-2 py-1.5 text-right font-mono">{x.special ? fmtH(x.special) : ""}</td>}
              <td className="py-1.5 pl-2 text-right font-mono text-teal-300">{fmtH(x.h)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-slate-400">
            <td className="py-1.5 pr-3">Tổng</td>
            {bands.map((b) => <td key={b.id} className="px-2 py-1.5 text-right font-mono">{fmtH(col(b.id))}</td>)}
            {sp > 0 && <td className="px-2 py-1.5 text-right font-mono">{fmtH(sp)}</td>}
            <td className="py-1.5 pl-2 text-right font-mono text-teal-300">{fmtH(info.ot)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

/* Thẻ nổi khi rê chuột vào ô giai đoạn */
const PhaseHoverCard = ({ cell, info, canOpen }) => {
  const left = cell.b - cell.h;
  const lc = !cell.b ? "text-slate-100" : left < 0 ? "text-rose-400" : left <= cell.b * 0.2 ? "text-amber-400" : "text-slate-100";
  const Lbl = ({ children }) => <div className="mb-1 text-[10.5px] uppercase tracking-wider text-slate-500">{children}</div>;
  let body;
  if (!info) body = <div className={`mt-2 rounded-lg px-2.5 py-2 ${FC_CLS.idle}`}>Chưa có giờ công nào được gửi vào giai đoạn này.</div>;
  else {
    const fc = cell.open ? phaseForecast(cell, info) : null;
    const pct = cell.b ? Math.round((cell.h / cell.b) * 100) : null;
    const otPct = Math.round((info.ot / info.total) * 100);
    const Chip = ({ l, v, cls = "" }) => (
      <div className={`min-w-0 flex-1 rounded-lg border bg-slate-900 px-2 py-1.5 ${cls || "border-slate-800"}`}>
        <div className="whitespace-nowrap text-[10.5px] text-slate-500">{l}</div><div className="whitespace-nowrap font-mono text-[12.5px]">{v}</div>
      </div>
    );
    body = (
      <>
        {fc ? <div className={`mt-2 rounded-lg px-2.5 py-2 ${FC_CLS[fc.cls]}`}>{fc.full}</div>
          : <div className={`mt-2 rounded-lg px-2.5 py-2 ${FC_CLS[cell.b && cell.h > cell.b ? "over" : pct != null && pct >= 80 ? "warn" : "ok"]}`}>
              {pct != null && <>Đóng ở <b>{pct}%</b> {cell.h > cell.b ? <>— vượt <b>{fmtH(cell.h - cell.b)} h</b></> : <>— còn dư {fmtH(cell.b - cell.h)} h</>}. </>}
              Chạy {info.nWeeks} tuần ({ddmm(info.first)} → {ddmm(info.last)}).
            </div>}
        <div className="mt-2.5 border-t border-slate-800 pt-2"><Lbl>Ai tiêu giờ nhiều nhất</Lbl><KvList items={info.people} total={info.total} n={3} withRole /></div>
        {info.tasks.length > 0 && <div className="mt-2.5 border-t border-slate-800 pt-2"><Lbl>Giờ đổ vào tác vụ nào</Lbl><KvList items={info.tasks} total={info.total} n={3} /></div>}
        <div className="mt-2.5 flex gap-2">
          <Chip l="Tăng ca" v={`${fmtH(info.ot)} h · ${otPct}%`} cls={otPct >= 25 ? "border-rose-800 text-rose-400" : otPct >= 15 ? "border-amber-800 text-amber-400" : "border-slate-800 text-slate-100"} />
          <Chip l={cell.open ? "Gửi giờ gần nhất" : "Giờ cuối cùng"} v={info.idleDays <= 0 ? "hôm nay" : `${info.idleDays} ngày trước`}
            cls={cell.open && info.idleDays >= 10 ? "border-rose-800 text-rose-400" : "border-slate-800 text-slate-100"} />
          <Chip l="Số người" v={info.people.length} cls="border-slate-800 text-slate-100" />
        </div>
        {canOpen && <div className="mt-2.5 text-right text-[11px] text-slate-500">Bấm vào ô để xem chi tiết theo tuần ▾</div>}
      </>
    );
  }
  return (
    <div className="text-[12.5px] text-slate-300">
      <div className="flex items-baseline gap-2 font-mono">
        <span className="font-sans text-[11px] uppercase tracking-wider text-slate-500">{cell.b ? "Giờ còn lại" : "Giờ đã dùng"}</span>
        <b className={`ml-auto text-xl ${lc}`}>{cell.b ? (left < 0 ? `−${fmtH(-left)}` : fmtH(left)) : fmtH(cell.h)} h</b>
      </div>
      {body}
    </div>
  );
};

/* v7.7 — Thứ tự dự án do người dùng kéo thả, lưu riêng từng máy (localStorage), dùng chung cho Dashboard (Tiến độ dự án) và tab Dự án. */
const PROJ_ORDER_KEY = "artius:projOrder";
const readProjOrder = () => { try { const a = JSON.parse(localStorage.getItem(PROJ_ORDER_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
function useProjOrder() {
  const [order, setOrder] = useState(readProjOrder);
  useEffect(() => { const f = () => setOrder(readProjOrder()); window.addEventListener("artius:projorder", f); return () => window.removeEventListener("artius:projorder", f); }, []);
  const save = useCallback((a) => {
    setOrder(a);
    try { if (a.length) localStorage.setItem(PROJ_ORDER_KEY, JSON.stringify(a)); else localStorage.removeItem(PROJ_ORDER_KEY); window.dispatchEvent(new Event("artius:projorder")); } catch { /* trình duyệt chặn lưu: thứ tự chỉ giữ tới khi tải lại trang */ }
  }, []);
  return [order, save];
}
/* sắp theo thứ tự đã kéo; id chưa có trong danh sách (dự án mới) đứng sau, giữ nguyên thứ tự cũ */
const sortByProjOrder = (list, order, idOf) => {
  if (!order.length) return list;
  const ix = new Map(order.map((id, i) => [id, i]));
  return list.map((x, i) => [x, i]).sort((a, b) => (ix.get(idOf(a[0])) ?? 1e9 + a[1]) - (ix.get(idOf(b[0])) ?? 1e9 + b[1])).map((x) => x[0]);
};
/* đặt fromId vào trước / sau toId trong dãy ids (đang hiển thị), phần còn lại giữ nguyên */
const moveInList = (ids, fromId, toId, after) => {
  const a = ids.filter((x) => x !== fromId); let i = a.indexOf(toId); if (i < 0) return ids;
  a.splice(after ? i + 1 : i, 0, fromId); return a;
};
/* kéo thả hàng: tay nắm (handleProps) chỉ ở biểu tượng ⋮⋮ nên không vướng ô nhập / bôi chọn chữ */
function useRowDrag(onMove) {
  const [dragId, setDragId] = useState(null); const [dropAt, setDropAt] = useState(null);
  const end = () => { setDragId(null); setDropAt(null); };
  const handleProps = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id); e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", id); const row = e.currentTarget.closest("tbody") || e.currentTarget.closest("tr"); if (row) e.dataTransfer.setDragImage(row, 20, 20); } catch { /* bỏ qua */ }
    },
    onDragEnd: end,
  });
  const rowProps = (id) => ({
    onDragOver: (e) => {
      if (!dragId) return; e.preventDefault();
      const b = e.currentTarget.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2;
      if (dropAt?.id !== id || dropAt?.after !== after) setDropAt({ id, after });
    },
    onDrop: (e) => { e.preventDefault(); const d = dropAt, f = dragId; end(); if (d && f && f !== d.id) onMove(f, d.id, d.after); },
  });
  // vạch teal báo vị trí sẽ thả (đặt trên các ô <td> của hàng đầu)
  const mark = (id, kind) => (dragId && dragId !== id && dropAt?.id === id
    ? (kind === "tbody"
      ? (dropAt.after ? "[&>tr:first-child>td]:shadow-[inset_0_-2px_0_#2dd4bf]" : "[&>tr:first-child>td]:shadow-[inset_0_2px_0_#2dd4bf]")
      : (dropAt.after ? "[&>td]:shadow-[inset_0_-2px_0_#2dd4bf]" : "[&>td]:shadow-[inset_0_2px_0_#2dd4bf]"))
    : "") + (dragId === id ? " opacity-40" : "");
  const grip = (id, disabled) => disabled ? null : (
    <span key="grip" {...handleProps(id)} title="Giữ và kéo để đổi vị trí dự án" className="mr-1 inline-flex h-6 w-4 shrink-0 cursor-grab items-center justify-center align-[-5px] text-slate-600 hover:text-slate-300 active:cursor-grabbing">
      <GripVertical size={14} />
    </span>
  );
  return { rowProps, mark, grip };
}

/* Tiến độ dự án: giờ HIỆN TẠI = tổng giờ đã gửi từ trước tới nay (không theo kỳ đang lọc) so với giờ dự kiến từng giai đoạn.
   · Giai đoạn đang mở: thanh màu theo mức (xanh < 80%, cam 80–100%, đỏ > 100%) + nhãn "mở".
   · Giai đoạn đã đóng: chìm xuống (thanh xám, chữ xám, % nhạt) — không cảnh báo nữa.
   · Tình trạng chỉ xét giai đoạn đang mở. Dự án nguy cơ vượt xếp đầu; dự án chưa có giờ gom vào một dòng mở rộng.
   · Chỉ dự án đang chấm công (active). v5.6: có bộ lọc riêng (Vượt / Sắp vượt / Bình thường, tìm dự án) — không theo kỳ.
   · v4.7: rê chuột vào ô → thẻ tóm tắt; bấm vào ô → khung chi tiết dưới dòng dự án, các dự án khác mờ đi.
   · v4.8: ô giai đoạn đang mở tô nền màu của giai đoạn + vạch trái, số giờ đậm; ô đã đóng chìm xuống (97%, chữ xám).
           Cờ Urgent (project.urgent, lưu trong thiết lập chung): rê chuột vào tên dự án → bấm cờ để bật/tắt;
           dự án Urgent có vạch đỏ + nhãn URGENT và luôn xếp lên đầu (trong nhóm vẫn xếp theo mức nguy cơ vượt). */
function ProjectProgress({ cfg, weekPeople, dataTick, saveCfg, flash }) {
  const [pf, setPf] = useState("all");   // v5.6: all | x (vượt) | w (sắp vượt) | ok
  const [pq, setPq] = useState("");      // v5.6: tìm dự án theo mã / tên
  const usage = useUsage();
  const detailRaw = usePhaseDetail();
  const [showIdle, setShowIdle] = useState(false);
  const [projOrder, setProjOrder] = useProjOrder();
  const [sel, setSel] = useState(null);       // "<projectId>|<phaseId>" đang mở chi tiết
  const [hover, setHover] = useState(null);   // "<projectId>|<phaseId>" đang rê chuột
  const cardRef = useRef(null);
  const used = useMemo(() => {
    const m = new Map();
    if (usage) {
      for (const u of usage) {
        if (u.projectId === NO_PROJECT || !u.sent) continue;
        const o = m.get(u.projectId) || {}; o[u.phaseId] = (o[u.phaseId] || 0) + u.sent; m.set(u.projectId, o);
      }
      return m;
    }
    // chưa hỏi được database: tạm cộng từ phần bảng công đang có trong bộ nhớ (giống tab Dự án)
    for (const bucket of Object.values(DB?.ts || {})) for (const r of sentRows(bucket)) {
      if (isLeaveTask(r.taskId) || r.projectId === NO_PROJECT) continue;
      const h = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
      if (!h) continue;
      const o = m.get(r.projectId) || {}; const ph = r.phaseId || DEFAULT_PHASE;
      o[ph] = (o[ph] || 0) + h; m.set(r.projectId, o);
    }
    return m;
  }, [usage, dataTick]);
  const detail = useMemo(() => (detailRaw ? new Map(Object.entries(detailRaw)) : phaseDetailFromMemory()), [detailRaw, dataTick]);
  const partial = detailRaw === null;
  const ctx = useMemo(() => ({
    empById: new Map((cfg.employees || []).map((e) => [e.id, e])),
    taskById: new Map([...(cfg.tasks || []), ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])),
    taskOrder: new Map((cfg.tasks || []).map((t, k) => [t.id, k])),
    cfg,   // v4.9: hệ số tăng ca
    // v5.6: database chưa chạy schema.sql bản v5.6 (không có "et") → tạm lấy tác vụ theo người từ bộ nhớ; tính một lần rồi giữ lại
    memEt: (() => { let m = null; return (key) => { if (!m) m = phaseDetailFromMemory(); return m.get(key)?.et; }; })(),
  }), [cfg, dataTick]);

  const phases = PHASES.filter((ph) => ph.active !== false);
  const allRows = cfg.projects
    .filter((p) => p.active)
    .map((p) => {
      const budgets = projBudgets(p);
      const u = used.get(p.id) || {};
      const cells = phases.map((ph) => {
        const b = Math.max(0, Number(budgets[ph.id]) || 0), h = u[ph.id] || 0;
        const open = projPhaseIsOpen(p, ph.id);
        const pct = b ? (h / b) * 100 : null;
        return { ph, b, h, open, pct, key: `${p.id}|${ph.id}` };
      });
      const bt = cells.reduce((a, c) => a + c.b, 0), ut = cells.reduce((a, c) => a + c.h, 0);
      let worst = null, worstPh = "";
      for (const c of cells) if (c.open && c.b) { const v = c.pct || 0; if (worst == null || v > worst) { worst = v; worstPh = c.ph.id; } }
      const nOver = cells.filter((c) => c.open && c.b && c.h > c.b).length;
      const noOpen = !cells.some((c) => c.open);
      const L = noOpen ? "none" : pgLevel(worst);
      const st = L === "over" ? "x" : L === "warn" ? "w" : L === "ok" ? "ok" : "none";
      return { p, cells, bt, ut, worst, worstPh, nOver, noOpen, st };
    });
  const pcnt = (k) => allRows.filter((r) => k === "all" || r.st === k).length;
  const kw = norm(pq.trim());
  const rows = allRows.filter((r) => (pf === "all" || r.st === pf) && (!kw || norm(`${r.p.code || ""} ${r.p.name} ${r.p.client || ""}`).includes(kw)));
  const byUrgent = (a, b) => (b.p.urgent ? 1 : 0) - (a.p.urgent ? 1 : 0);
  const ordIx = new Map(projOrder.map((id, i) => [id, i]));
  const active = rows.filter((r) => r.ut > 0).sort((a, b) => byUrgent(a, b)
    || (projOrder.length ? (ordIx.get(a.p.id) ?? 1e9) - (ordIx.get(b.p.id) ?? 1e9) : 0)   // v7.7: đã kéo thả thì theo thứ tự đó, chưa thì tự xếp theo mức vượt
    || (b.worst ?? -1) - (a.worst ?? -1) || b.ut - a.ut);
  // v4.8: dự án Urgent chưa có giờ vẫn hiện ở đầu bảng (không bị gom vào dòng "chưa có giờ")
  const idle = sortByProjOrder(rows.filter((r) => r.ut === 0 && !r.p.urgent), projOrder, (r) => r.p.id);
  const urgentIdle = sortByProjOrder(rows.filter((r) => r.ut === 0 && r.p.urgent), projOrder, (r) => r.p.id);
  const toggleUrgent = async (p) => {
    if (!saveCfg) return;
    const on = !p.urgent;
    const ok = await saveCfg({ ...cfg, projects: cfg.projects.map((x) => (x.id === p.id ? { ...x, urgent: on } : x)) });
    if (ok && flash) flash(on ? `Đã đánh dấu Urgent: ${p.code ? p.code + " · " : ""}${p.name}` : `Đã bỏ Urgent: ${p.code ? p.code + " · " : ""}${p.name}`);
  };
  // v7.7: kéo thả dự án — thứ tự đang thấy trên bảng (Urgent trước, rồi các dự án có giờ) được chốt làm thứ tự riêng của máy này
  const shownIds = [...active.filter((r) => r.p.urgent), ...urgentIdle, ...active.filter((r) => !r.p.urgent), ...idle].map((r) => r.p.id);
  const dragMove = (from, to, after) => {
    const moved = moveInList(shownIds, from, to, after);
    const rest = sortByProjOrder(cfg.projects.map((x) => x.id), projOrder, (x) => x).filter((id) => !moved.includes(id));
    setProjOrder([...moved, ...rest]);
  };
  const drag = useRowDrag(dragMove);
  const findCell = (key) => { for (const r of rows) for (const c of r.cells) if (c.key === key) return c; return null; };
  const selCell = sel ? findCell(sel) : null;
  const selProj = selCell ? sel.split("|")[0] : null;
  useEffect(() => { if (sel && !selCell) setSel(null); }, [sel, selCell]);
  if (allRows.length === 0) return <p className="p-4 text-sm text-slate-500">Chưa có dự án đang chấm công.</p>;

  // đặt thẻ rê chuột cạnh con trỏ, lật sang trái / lên trên khi sát mép màn hình (đổi trực tiếp vị trí, không vẽ lại bảng)
  const placeCard = (e) => {
    const el = cardRef.current; if (!el) return;
    const w = el.offsetWidth || 360, hh = el.offsetHeight || 200;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 16;
    if (y + hh > window.innerHeight - 8) y = Math.max(8, window.innerHeight - hh - 8);
    el.style.left = `${x}px`; el.style.top = `${y}px`;
  };
  const hoverCell = hover && hover !== sel ? findCell(hover) : null;

  const totColor = (r) => { if (!r.bt) return "text-slate-100"; const pc = (r.ut / r.bt) * 100; return pc > 100 ? "text-rose-400" : pc >= 80 ? "text-amber-400" : "text-slate-100"; };
  const statusBadge = (r) => {
    if (r.noOpen) return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11.5px] text-slate-500">Không có giai đoạn mở</span>;
    const L = pgLevel(r.worst);
    const cls = { ok: "bg-teal-500/10 text-teal-400", warn: "bg-amber-500/10 text-amber-400", over: "bg-rose-500/15 text-rose-400", none: "bg-slate-800 text-slate-500" }[L];
    const label = { ok: "Bình thường", warn: "Sắp vượt", over: "Vượt dự kiến", none: "Chưa có giờ" }[L];
    const which = L === "warn" || L === "over" ? ` · ${r.nOver > 1 ? `${r.nOver} giai đoạn` : r.worstPh}` : "";
    return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${cls}`}>{label}{which}</span>;
  };
  const cell = (r, c) => {
    if (!c.b && !c.h) return <td key={c.ph.id} className="px-2.5 py-2.5"><span className="text-xs text-slate-700">—</span></td>;
    const L = c.h ? pgLevel(c.pct) : "none";
    const bar = !c.h ? "transparent" : c.open ? pgColor(L) : (isLight() ? "#cbd5e1" : "#334155");
    const isSel = sel === c.key;
    const col = tone(c.ph.color || phaseColor(c.ph.id));
    // v4.8: giai đoạn đang mở = nền màu giai đoạn (~11%) + vạch trái; đang chọn thì thêm viền
    const shadows = [c.open ? `inset 3px 0 0 ${col}` : "", isSel ? "inset 0 0 0 1px #0f766e" : ""].filter(Boolean).join(", ");
    return (
      <td key={c.ph.id} style={{ background: c.open ? `${col}1c` : isSel ? (isLight() ? "#e2e8f0" : "#16213a") : undefined, boxShadow: shadows || undefined }}
        onMouseEnter={(e) => { setHover(c.key); placeCard(e); }}
        onMouseMove={placeCard}
        onMouseLeave={() => setHover((h) => (h === c.key ? null : h))}
        onClick={() => { setHover(null); setSel((s) => (s === c.key ? null : c.key)); }}
        className={`cursor-pointer px-2.5 py-2.5 ${c.open ? "rounded-r-md hover:brightness-125" : "rounded-md opacity-[.97] hover:bg-[#16213a]"}`}>
        <div className={`flex items-baseline gap-1 font-mono text-xs ${c.open ? "text-slate-100" : "text-slate-600"}`}>
          <span className={c.open ? "text-[13px] font-bold" : ""}>{fmtH(c.h)}</span><span className={c.open ? "text-slate-400" : "text-slate-700"}>/ {c.b ? fmtH(c.b) : "—"} h</span>
          {c.open && <span className="ml-1 rounded border border-teal-900 px-1 font-sans text-[10px] leading-4 text-teal-400">mở</span>}
          {c.pct != null && c.h > 0 && <span className="ml-auto" style={{ color: pgColor(L), opacity: c.open ? 1 : 0.45 }}>{Math.round(c.pct)}%</span>}
        </div>
        <div className={`mt-1 h-[5px] overflow-hidden rounded-full ${c.open ? "bg-slate-950/60" : "bg-slate-800/50"}`}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.pct || 0)}%`, background: bar, opacity: c.open ? 1 : 0.55 }} />
        </div>
      </td>
    );
  };
  const line = (r) => {
    const dim = selProj && r.p.id !== selProj, focus = selProj && r.p.id === selProj;
    const out = [(
      <tr key={r.p.id} className={`group border-b border-slate-800 ${dim ? "opacity-25 hover:opacity-60" : ""} ${focus ? "bg-[#0f1a30]" : r.p.urgent ? "bg-rose-500/[.035]" : ""}`}>
        <td className="relative whitespace-nowrap py-2.5 pl-2 pr-2.5 text-sm text-slate-100">
          {r.p.urgent && <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-sm bg-rose-500" />}
          {drag.grip(r.p.id, rows.length < 2)}
          <button onClick={() => toggleUrgent(r.p)} title={r.p.urgent ? "Bỏ đánh dấu Urgent" : "Đánh dấu Urgent — đưa dự án lên đầu"}
            className={`mr-1.5 rounded p-1 align-[-3px] transition-opacity hover:bg-slate-800 ${r.p.urgent ? "text-rose-500 opacity-100" : "text-slate-600 opacity-0 hover:text-rose-400 group-hover:opacity-100"}`}>
            <Flag size={14} fill={r.p.urgent ? "currentColor" : "none"} />
          </button>
          {r.p.code && <span className="mr-2 font-mono text-teal-400">{r.p.code}</span>}{r.p.name}
          {r.p.urgent && <span className="ml-2 rounded border border-rose-800 bg-rose-500/15 px-1.5 align-[1px] text-[10px] font-bold leading-4 tracking-wider text-rose-400">URGENT</span>}
        </td>
        {r.cells.map((c) => cell(r, c))}
        <td className="whitespace-nowrap px-2.5 py-2.5 text-center font-mono text-sm">
          <span className={totColor(r)}>{fmtH(r.ut)}</span><span className="text-slate-500"> / {fmtH(r.bt)} h</span>
        </td>
        <td className="whitespace-nowrap px-2.5 py-2.5 text-center font-mono text-sm text-slate-300"
          title={weekPeople?.get(r.p.id)?.size ? "Số người có giờ đã gửi vào dự án trong tuần này" : undefined}>
          {weekPeople?.get(r.p.id)?.size || <span className="text-slate-700">—</span>}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2.5 text-center">{statusBadge(r)}</td>
      </tr>
    )];
    if (focus) {
      const info = buildPhaseInfo(detail.get(sel), selCell, ctx);
      out.push(
        <tr key={`${r.p.id}-detail`}>
          <td colSpan={phases.length + 4} className="bg-[#081022] p-0">
            {info ? <PhaseDetail key={sel} cell={selCell} info={info} partial={partial} onClose={() => setSel(null)} />
              : <div className="relative p-4 text-sm text-slate-500">
                  {detailRaw === undefined ? "Đang tải chi tiết…" : "Chưa có giờ công đã gửi vào giai đoạn này."}
                  <button onClick={() => setSel(null)} className="absolute right-4 top-3 h-[30px] rounded-md border border-slate-700 px-2.5 text-xs text-slate-400 hover:text-slate-100">Đóng ✕</button>
                </div>}
          </td>
        </tr>
      );
    }
    /* v5.6 — mỗi dự án một <tbody>; dự án đang mở chi tiết có viền teal mảnh bo góc bao trọn dòng dự án + khung chi tiết */
    return (
      <tbody key={r.p.id} {...drag.rowProps(r.p.id)} className={`${focus ? "rounded-[10px] outline outline-1 -outline-offset-1 outline-teal-700" : ""} ${drag.mark(r.p.id, "tbody")}`}>
        {out}
      </tbody>
    );
  };
  const PKpi = ({ l, v, cls = "text-slate-50" }) => (
    <div className="bg-slate-900 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-slate-500">{l}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${cls}`}>{v}</div>
    </div>
  );
  return (
    <div>
      {/* v5.6 — KPI + bộ lọc riêng của tab Dự án */}
      <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 md:grid-cols-4">
        <PKpi l="Dự án đang mở" v={allRows.length} />
        <PKpi l="Vượt dự kiến" v={pcnt("x")} cls={pcnt("x") ? "text-rose-400" : "text-slate-50"} />
        <PKpi l="Sắp vượt (≥ 80%)" v={pcnt("w")} cls={pcnt("w") ? "text-amber-400" : "text-slate-50"} />
        <PKpi l="Urgent" v={allRows.filter((r) => r.p.urgent).length} cls={allRows.some((r) => r.p.urgent) ? "text-rose-400" : "text-slate-50"} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <div className="flex max-w-full overflow-x-auto rounded-md border border-slate-700">
          {[["all", "Tất cả"], ["x", "Vượt"], ["w", "Sắp vượt"], ["ok", "Bình thường"]].map(([k, l]) => (
            <button key={k} onClick={() => setPf(k)}
              className={`${CTRL} whitespace-nowrap px-3 text-[13px] ${pf === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>
              {l}<span className="ml-1.5 font-mono text-slate-500">{pcnt(k)}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-60">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Tìm dự án" className={`pl-9 ${inputCls}`} />
        </div>
        {projOrder.length > 0 && (
          <button onClick={() => setProjOrder([])} title="Bỏ thứ tự đã kéo, xếp lại tự động theo mức vượt dự kiến"
            className={`${CTRL} whitespace-nowrap rounded-md border border-slate-700 px-3 text-[13px] text-slate-400 hover:text-slate-200`}>
            <RotateCcw size={13} className="mr-1.5 inline align-[-2px]" />Xếp tự động
          </button>
        )}
        <div className="sm:ml-auto"><ProgressLegend /></div>
      </div>
      <div className="p-3 md:p-4">
      {rows.length === 0 ? <p className="px-2.5 text-sm text-slate-500">Không có dự án khớp bộ lọc.</p> : (<>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-2.5 py-2 font-normal">Dự án</th>
              {phases.map((ph) => (
                <th key={ph.id} className="px-2.5 py-2 font-normal" style={{ width: "15.2%" }}>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: tone(ph.color) }} />{ph.id} · {ph.name}
                </th>
              ))}
              <th className="whitespace-nowrap px-2.5 py-2 text-center font-normal" style={{ width: "12%" }}>Giờ hiện tại / dự kiến</th>
              <th className="whitespace-nowrap px-2.5 py-2 text-center font-normal" style={{ width: "7%" }}>Người tuần này</th>
              <th className="whitespace-nowrap px-2.5 py-2 text-center font-normal" style={{ width: "12%" }}>Tình trạng</th>
            </tr>
          </thead>
          {active.filter((r) => r.p.urgent).map(line)}
          {urgentIdle.map(line)}
          {active.filter((r) => !r.p.urgent).map(line)}
          {showIdle && idle.map(line)}
        </table>
      </div>
      {active.length === 0 && urgentIdle.length === 0 && !showIdle && <p className="px-2.5 pt-2 text-sm text-slate-500">Chưa dự án nào có giờ công đã gửi.</p>}
      {idle.length > 0 && (
        <button onClick={() => setShowIdle((x) => !x)} className="mt-2 px-2.5 text-xs text-slate-400 hover:text-slate-200">
          {showIdle ? "▲ Ẩn" : "▼ Hiện"} {idle.length} dự án đang mở nhưng chưa có giờ
        </button>
      )}
      </>)}
      </div>
      <div ref={cardRef} className="pointer-events-none fixed z-[60] w-[360px] rounded-xl border border-slate-700 bg-[#030a1a] px-3.5 py-3 shadow-[0_18px_40px_rgba(0,0,0,.6)]"
        style={{ display: hoverCell ? "block" : "none" }}>
        {hoverCell && <PhaseHoverCard cell={hoverCell} info={buildPhaseInfo(detail.get(hover), hoverCell, ctx)} canOpen />}
      </div>
    </div>
  );
}

/* v5.3 — Phân bổ giờ công theo nhân sự (theo kỳ và bộ lọc của Dashboard). Hai cách xem trong cùng khung:
   · "Theo người" (mặc định): mỗi người một thanh tách Giờ chuẩn (xanh dương) / OT (xanh ngọc) / Giờ cố gắng (tím)
     so với vạch giờ chuẩn của kỳ; nhãn Quá tải / Thiếu giờ / Bình thường; gom theo bộ phận; bấm một người để mở
     chi tiết theo dự án.
   · "Ma trận": hàng = người, cột = dự án ("Khác" = việc chung / vắng mặt, luôn cuối), ô đậm nhạt theo số giờ;
     cuối hàng là tổng, % tải và số dự án (≥ 3 dự án tô vàng); cuối cột là tổng giờ từng dự án.
   Ngưỡng: Quá tải khi tổng giờ > cfg.allocOver % giờ chuẩn kỳ (mặc định 110); Thiếu giờ khi giờ chuẩn < cfg.allocUnder % (mặc định 90).
   Chỉnh ở Thiết lập. Nhân sự chưa chấm giờ nào trong kỳ vẫn hiện (khi không lọc theo dự án / giai đoạn) để thấy ai thiếu. */
/* v5.5 — làm tròn % sao cho tổng đúng 100 (phương pháp phần dư lớn nhất) */
const pct100 = (vals) => {
  const t = vals.reduce((a, v) => a + v, 0);
  if (!t) return vals.map(() => 0);
  const raw = vals.map((v) => (v / t) * 100), out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, v) => a + v, 0);
  raw.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i] += 1; left -= 1; } });
  return out;
};
const ALLOC_PAL = ["#2dd4bf", "#f59e0b", "#60a5fa", "#a78bfa", "#f472b6", "#34d399", "#fb923c", "#38bdf8", "#c084fc", "#facc15", "#4ade80", "#f87171"];
const allocLimits = (cfg) => ({
  over: Math.max(100, Number(cfg?.allocOver) || 110),
  under: Math.min(100, Math.max(0, Number(cfg?.allocUnder ?? 90))),
});
const ALLOC_ST = {
  hi: ["Quá tải", "border-rose-900 bg-rose-950 text-rose-300"],
  lo: ["Thiếu giờ", "border-amber-900 bg-amber-950/70 text-amber-300"],
  ok: ["Bình thường", "border-teal-900 bg-teal-950 text-teal-300"],
  idle: ["Chờ việc", "border-slate-600 bg-slate-800 text-slate-300"],   // v7.2
};
/* v7.2 — trạng thái tải: t = tổng giờ, o = OT, c = cố gắng, i = chờ việc, sd = giờ chuẩn kỳ.
   Tải = t − i. Quá tải: tải > over%. Bình thường: giờ chuẩn (không gồm chờ việc) ≥ under%.
   Chờ việc: chưa đủ under% nhưng cộng chờ việc vào thì đủ (thiếu việc, không phải chấm thiếu). Còn lại: Thiếu giờ. */
const allocState = (t, o, c, i, sd, lim) => {
  if (!(sd > 0)) return "ok";
  const s = Math.max(0, t - o - c - i);
  if (t - i > (sd * lim.over) / 100) return "hi";
  if (s >= (sd * lim.under) / 100) return "ok";
  return s + i >= (sd * lim.under) / 100 ? "idle" : "lo";
};
function StaffAllocation({ matrix, otByEmp, effortByEmp, idleByEmp = new Map(), staff, std, stdOf, cfg, empName, projMapById, detail = [], projDetail = [], taskLabel }) {
  const [view, setView] = useState("people");   // "people" | "matrix"
  const [tip, setTip] = useState(null);         // v5.5: { eid, k, x, y } — thẻ khi rê chuột vào dự án trong phần chi tiết
  /* v5.5 — tác vụ theo người × dự án (theo kỳ và bộ lọc), và tổng giờ từng dự án trong kỳ (mọi nhân sự, không theo bộ lọc bộ phận / tên) */
  const byEP = useMemo(() => {
    const m = new Map();
    for (const d of detail) {
      const k = `${d.empId}|${isLeaveTask(d.taskId) ? NO_PROJECT : d.projectId}`;
      const o = m.get(k) || { tasks: new Map(), phases: new Set() };
      const ot = isOtId(d.taskId);
      const lbl = ot ? `Tăng ca · ${d.otFor ? taskLabel(d.otFor) : "chưa rõ tác vụ"}` : taskLabel(d.taskId);
      const t = o.tasks.get(lbl) || { h: 0, ot, idle: isIdleTask(d.taskId) }; t.h += d.hours; o.tasks.set(lbl, t);
      if (d.projectId !== NO_PROJECT && !isLeaveTask(d.taskId)) o.phases.add(d.phaseId || DEFAULT_PHASE);
      m.set(k, o);
    }
    return m;
  }, [detail, taskLabel]);
  /* v5.8 — tác vụ của từng người trong kỳ (gộp mọi dự án): Map eid -> [{ name, h, ot }], tăng ca xếp cuối */
  const byE = useMemo(() => {
    const m = new Map();
    for (const [k, o] of byEP) {
      const eid = k.split("|")[0];
      const mm = m.get(eid) || new Map();
      for (const [lbl, t] of o.tasks) { const x = mm.get(lbl) || { name: lbl, h: 0, ot: t.ot, idle: t.idle }; x.h += t.h; mm.set(lbl, x); }
      m.set(eid, mm);
    }
    return new Map([...m].map(([eid, mm]) => [eid, [...mm.values()].sort((a, b) => (a.ot - b.ot) || b.h - a.h)]));
  }, [byEP]);
  const projTot = useMemo(() => {
    const m = new Map();
    for (const d of projDetail) { const k = isLeaveTask(d.taskId) ? NO_PROJECT : d.projectId; m.set(k, (m.get(k) || 0) + d.hours); }
    return m;
  }, [projDetail]);
  const [fSt, setFSt] = useState("all");        // all | hi | lo | ok
  const [sort, setSort] = useState("load");     // load | extra | name
  const [open, setOpen] = useState(() => new Set());
  const lim = allocLimits(cfg);
  const empById = new Map((cfg.employees || []).map((e) => [e.id, e]));
  // mọi người cần hiện: có giờ trong kỳ + (nếu không lọc dự án / giai đoạn) người chưa chấm giờ nào
  const ids = new Set([...matrix.keys(), ...staff.map((e) => e.id)]);
  const everyone = [...ids].map((eid) => {
    const mm = matrix.get(eid) || new Map();
    const t = [...mm.values()].reduce((a, v) => a + v, 0);
    const o = otByEmp.get(eid) || 0, c = effortByEmp.get(eid) || 0, i = idleByEmp.get(eid) || 0;
    const s = Math.max(0, t - o - c - i);   // v7.2: giờ chuẩn không gồm chờ việc
    const sd = stdOf ? stdOf(eid) : std;   // v6.5: giờ chuẩn riêng từng người (hôm nay chỉ tính khi đã gửi)
    const st = allocState(t, o, c, i, sd, lim);
    const e = empById.get(eid);
    return { eid, mm, t, s, o, c, idle: i, load: t - i, st, sd, dept: e?.dept || "Khác", role: e ? roleTitle(e.role) : "" };
  });
  // v5.6: người chưa chấm giờ nào trong kỳ tách riêng (gom một dòng cuối), không tính vào Quá tải / Thiếu giờ / Bình thường
  const people = everyone.filter((x) => x.t > 0);
  const zero = everyone.filter((x) => x.t === 0).sort((a, b) => empName(a.eid).localeCompare(empName(b.eid), "vi"));
  if (everyone.length === 0) return <p className="px-4 py-6 text-sm text-slate-500">Không có nhân sự nào khớp bộ lọc.</p>;
  const colT = new Map();
  for (const x of people) for (const [k, v] of x.mm) colT.set(k, (colT.get(k) || 0) + v);
  const cols = [...colT.keys()].filter((k) => k !== NO_PROJECT).sort((a, b) => colT.get(b) - colT.get(a));
  if (colT.has(NO_PROJECT)) cols.push(NO_PROJECT);
  const color = new Map(cols.map((k, i) => [k, k === NO_PROJECT ? "#64748b" : ALLOC_PAL[i % ALLOC_PAL.length]]));
  const code = (k) => { if (k === NO_PROJECT) return "Khác"; const p = projMapById.get(k); return p ? (p.code || p.name) : "(đã xoá)"; };
  const name = (k) => { if (k === NO_PROJECT) return "Việc chung, vắng mặt"; return projMapById.get(k)?.name || "(dự án đã xoá)"; };
  const nProj = (x) => cols.filter((k) => k !== NO_PROJECT && x.mm.get(k)).length;
  const pct = (x) => (x.sd ? Math.round((x.load / x.sd) * 100) : null);   // v7.2: % tải không gồm chờ việc

  const cnt = (k) => people.filter((x) => k === "all" || x.st === k).length;
  const list = people.filter((x) => fSt === "all" || x.st === fSt)
    .sort(sort === "load" ? (a, b) => b.load - a.load : sort === "extra" ? (a, b) => (b.o + b.c) - (a.o + a.c) || b.load - a.load : (a, b) => empName(a.eid).localeCompare(empName(b.eid), "vi"));
  const used = people.reduce((a, x) => a + x.t, 0), cap = everyone.reduce((a, x) => a + x.sd, 0);
  const otSum = people.reduce((a, x) => a + x.o, 0), cgSum = people.reduce((a, x) => a + x.c, 0), idleSum = people.reduce((a, x) => a + x.idle, 0);
  const toggle = (eid) => setOpen((s) => { const n = new Set(s); n.has(eid) ? n.delete(eid) : n.add(eid); return n; });

  const Kpi = ({ l, v, cls = "text-slate-50", sub }) => (
    <div className="bg-slate-900 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-slate-500">{l}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${cls}`}>{v}{sub && <span className="ml-1.5 text-xs font-normal text-slate-500">{sub}</span>}</div>
    </div>
  );
  const maxT = Math.max(...people.map((x) => x.t), ...people.map((x) => x.sd * 1.25), std * 1.25, 1);

  // nhóm theo bộ phận, giữ thứ tự sắp xếp trong từng nhóm; nhóm xếp theo thứ tự xuất hiện của người đầu tiên
  const groups = [];
  for (const x of list) { let g = groups.find((y) => y.dept === x.dept); if (!g) { g = { dept: x.dept, items: [] }; groups.push(g); } g.items.push(x); }

  return (
    <div>
      {/* v5.6 — 6 KPI của tab Nhân sự */}
      <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 md:grid-cols-4 xl:grid-cols-7">
        <Kpi l="Tổng giờ công" v={fmtH(used)} sub={`/ ${fmtH(cap)} h`} />
        <Kpi l="Trong đó OT" v={`${fmtH(otSum)} h`} cls="text-teal-400" />
        <Kpi l="Giờ cố gắng" v={`${fmtH(cgSum)} h`} cls="text-violet-400" />
        <Kpi l="Chờ việc" v={`${fmtH(idleSum)} h`} cls="text-slate-300" sub={cnt("idle") ? `${cnt("idle")} người` : undefined} />
        <Kpi l={`Quá tải (>${lim.over}%)`} v={`${cnt("hi")} người`} cls={cnt("hi") ? "text-rose-400" : "text-slate-50"} />
        <Kpi l={`Thiếu giờ (<${lim.under}%)`} v={`${cnt("lo")} người`} cls={cnt("lo") ? "text-amber-400" : "text-slate-50"} />
        <Kpi l="Chưa chấm" v={`${zero.length} người`} cls={zero.length ? "text-amber-400" : "text-slate-50"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <div className="flex max-w-full overflow-x-auto rounded-md border border-slate-700">
          {[["all", "Đã chấm"], ["hi", "Quá tải"], ["lo", "Thiếu giờ"], ["idle", "Chờ việc"], ["ok", "Bình thường"]].map(([k, l]) => (
            <button key={k} onClick={() => setFSt(k)}
              className={`${CTRL} whitespace-nowrap px-3 text-[13px] ${fSt === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>
              {l}<span className="ml-1.5 font-mono text-slate-500">{cnt(k)}</span>
            </button>
          ))}
        </div>
        <div className="w-60 max-w-full">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls} aria-label="Sắp xếp">
            <option value="load">Sắp xếp: tải cao → thấp</option>
            <option value="extra">Sắp xếp: phát sinh nhiều nhất</option>
            <option value="name">Sắp xếp: tên A → Z</option>
          </select>
        </div>
        <div className="ml-auto flex rounded-md border border-slate-700">
          {[["people", "Theo người"], ["matrix", "Ma trận"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              className={`${CTRL} whitespace-nowrap px-3.5 text-[13px] ${view === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
          ))}
        </div>
      </div>

      {list.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">{people.length ? "Không có nhân sự nào ở nhóm này." : "Chưa ai có giờ công đã gửi trong kỳ này."}</p>}

      {view === "people" && list.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-800 px-3 py-2 text-xs text-slate-400 md:px-4">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />Giờ chuẩn</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Chờ việc (không tính tải)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-400" />OT</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400" />Giờ cố gắng</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-slate-100/55" />{fmtH(std)} h giờ chuẩn của kỳ</span>
            <span className="text-amber-400">⌃ thiếu giờ chuẩn</span>
            <span className="text-slate-600">Bấm một người để xem theo dự án</span>
          </div>
          {groups.map((g) => (
            <div key={g.dept}>
              <div className="flex justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 md:px-4">
                <span>{g.dept} · {g.items.length} người</span><span className="font-mono">{fmtH(g.items.reduce((a, x) => a + x.t, 0))} h</span>
              </div>
              {g.items.map((x) => {
                const op = open.has(x.eid), p = pct(x);
                return (
                  <div key={x.eid} className="border-b border-slate-800/70">
                    <button type="button" onClick={() => toggle(x.eid)} aria-expanded={op}
                      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 text-left md:grid-cols-[200px_minmax(0,1fr)_90px_150px] md:gap-4 md:px-4 ${op ? "bg-slate-800/50" : "hover:bg-slate-800/30"}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-sm text-slate-100">{op ? <ChevronDown size={14} className="shrink-0 text-slate-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-500" />}{empName(x.eid)}</div>
                        <div className="pl-5 text-[11px] text-slate-500">{x.role ? `${x.role} · ` : ""}{nProj(x)} dự án
                          {x.st !== "ok" && <span className={`ml-1.5 rounded-full border px-1.5 md:hidden ${ALLOC_ST[x.st][1]}`}>{ALLOC_ST[x.st][0]}</span>}</div>
                      </div>
                      <div className="relative col-span-2 row-start-2 pt-[18px] md:col-span-1 md:row-start-auto">
                        {/* v5.7: số giờ nằm trong từng khúc (khúc hẹp thì ẩn số, rê chuột xem); khe tối 2px giữa các khúc */}
                        <div className="flex h-[18px] overflow-hidden rounded-full bg-slate-800 font-mono text-[11px] font-semibold text-slate-950">
                          {[[x.s, "bg-blue-400", "Giờ chuẩn"], [x.idle, "bg-slate-400", "Chờ việc"], [x.o, "bg-teal-400", "OT"], [x.c, "bg-violet-400", "Giờ cố gắng"]].filter(([v]) => v > 0).map(([v, cls, l], i) => (
                            <i key={l} title={`${l}: ${fmtH(v)} h`} className={`flex h-full items-center justify-center overflow-hidden whitespace-nowrap not-italic ${cls} ${i ? "border-l-2 border-slate-900" : ""}`}
                              style={{ width: `${(v / maxT) * 100}%` }}>{(v / maxT) * 100 >= 3.2 ? fmtH(v) : ""}</i>
                          ))}
                        </div>
                        {/* v5.7: ngoặc vàng chỉ khoảng thiếu giờ chuẩn (từ cuối phần Giờ chuẩn tới vạch giờ chuẩn của kỳ) — OT / cố gắng không bù vào */}
                        {/* v7.2: tính từ cuối khúc xám — chờ việc không bị coi là thiếu */}
                        {x.sd > 0 && x.sd - x.s - x.idle > 0.05 && (
                          <span className="pointer-events-none absolute top-3 h-[5px] rounded-t-[3px] border-[1.5px] border-b-0 border-amber-400" style={{ left: `${((x.s + x.idle) / maxT) * 100}%`, width: `${((x.sd - x.s - x.idle) / maxT) * 100}%` }}>
                            <span className="absolute -top-[5px] left-1/2 h-1 w-[1.5px] -translate-x-1/2 bg-amber-400" />
                            <span className="absolute bottom-[9px] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[11px] font-medium leading-none text-amber-400">thiếu {fmtH(x.sd - x.s - x.idle)} h</span>
                          </span>
                        )}
                        {/* v5.7: vạch giờ chuẩn của kỳ — trắng mờ, mảnh 1px */}
                        {x.sd > 0 && <span className="pointer-events-none absolute -bottom-1.5 top-3 w-px -translate-x-1/2 bg-slate-100/55 shadow-[0_0_0_1.5px_#0f172a]" style={{ left: `${(x.sd / maxT) * 100}%` }} />}
                      </div>
                      <div className="text-right font-mono md:order-none">
                        <div className={`text-sm font-semibold ${x.st === "hi" ? "text-rose-400" : "text-slate-100"}`}>{fmtH(x.t)} h</div>
                        {x.idle > 0 && <div className="text-[11px] text-slate-400">tải {fmtH(x.load)} h</div>}
                      </div>
                      <span className={`hidden justify-self-end whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] md:inline-block ${ALLOC_ST[x.st][1]}`}>{ALLOC_ST[x.st][0]}{p != null ? ` · ${p}%` : ""}</span>
                    </button>
                    {op && (
                      <div className="bg-slate-950/40 px-3 pb-3 pt-1.5 md:pl-[232px] md:pr-4">
                        {/* v5.4: chi tiết chỉ bằng chữ + số, không vẽ thanh — đỡ rối mắt */}
                        <div className="grid max-w-5xl grid-cols-1 gap-x-10 gap-y-3 text-[13px] lg:grid-cols-2">
                          {x.mm.size === 0 ? <div className="py-1 text-slate-500">Chưa chấm giờ nào trong kỳ.</div> : (<>
                            <div>
                            <div className="grid grid-cols-[minmax(0,1fr)_72px_52px] gap-3 py-0.5 text-[10.5px] uppercase tracking-wider text-slate-600">
                              <span>Dự án</span><span className="text-right">Giờ</span><span className="text-right">%</span>
                            </div>
                            {(() => { const ks = cols.filter((k) => x.mm.get(k)).sort((a, b) => x.mm.get(b) - x.mm.get(a)), pc = pct100(ks.map((k) => x.mm.get(k))); return ks.map((k, i) => (
                              /* v5.5: rê chuột vào dự án → thẻ tác vụ của người này trong dự án */
                              <div key={k} className="-mx-1.5 grid cursor-default grid-cols-[minmax(0,1fr)_72px_52px] items-baseline gap-3 rounded-md px-1.5 py-0.5 hover:bg-slate-800/70"
                                onMouseMove={(e) => setTip({ eid: x.eid, k, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
                                <span className="truncate text-slate-200">{k === NO_PROJECT ? "" : `${code(k)} · `}{name(k)}</span>
                                <span className="text-right font-mono text-slate-100">{fmtH(x.mm.get(k))} h</span>
                                <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
                              </div>
                            )); })()}
                            </div>
                            {/* v5.8 — tác vụ của người này trong kỳ (mọi dự án); tăng ca ghi "Tăng ca · tác vụ", màu xanh ngọc, xếp cuối */}
                            <div>
                              <div className="grid grid-cols-[minmax(0,1fr)_72px_52px] gap-3 py-0.5 text-[10.5px] uppercase tracking-wider text-slate-600">
                                <span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span>
                              </div>
                              {(() => { const ts = byE.get(x.eid) || [], pc = pct100(ts.map((t) => t.h)); return ts.map((t, i) => (
                                <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_72px_52px] items-baseline gap-3 py-0.5">
                                  <span className={`truncate ${t.ot ? "text-teal-400" : t.idle ? "text-slate-400" : "text-slate-200"}`}>{t.name}</span>
                                  <span className="text-right font-mono text-slate-100">{fmtH(t.h)} h</span>
                                  <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
                                </div>
                              )); })()}
                            </div>
                          </>)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {tip && (() => {
        const o = byEP.get(`${tip.eid}|${tip.k}`), ph = matrix.get(tip.eid)?.get(tip.k) || 0;
        if (!o || !ph) return null;
        const tasks = [...o.tasks.entries()].sort((a, b) => (a[1].ot - b[1].ot) || b[1].h - a[1].h);
        const pt = projTot.get(tip.k) || 0;
        const W = 360, left = Math.min(window.innerWidth - W - 12, tip.x + 14), top = Math.min(window.innerHeight - 40 - (tasks.length + 3) * 24, tip.y + 14);
        return (
          <div className="pointer-events-none fixed z-50 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[12.5px] shadow-2xl" style={{ left, top, width: W }}>
            <div className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 pb-1 text-[10.5px] uppercase tracking-wider text-slate-600"><span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span></div>
            {(() => { const pc = pct100(tasks.map(([, t]) => t.h)); return tasks.map(([lbl, t], i) => (
              <div key={lbl} className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 py-0.5">
                <span className={`truncate ${t.ot ? "text-teal-400" : "text-slate-100"}`}>{lbl}</span>
                <span className="text-right font-mono text-slate-200">{fmtH(t.h)}</span>
                <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
              </div>
            )); })()}
            <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-slate-800 pt-1.5">
              {pt > 0 && <><span className="text-slate-500">Chiếm trong tổng giờ dự án</span><span className="text-right font-mono text-slate-100">{Math.round((ph / pt) * 100)}% <span className="text-slate-600">/ {fmtH(pt)} h</span></span></>}
              {o.phases.size > 0 && <><span className="text-slate-500">Giai đoạn</span><span className="text-right text-slate-100">{[...o.phases].sort().map((p) => phaseLabel(p)).join(", ")}</span></>}
            </div>
          </div>
        );
      })()}

      {view === "matrix" && list.length > 0 && (() => {
        const maxV = Math.max(1, ...list.flatMap((x) => [...x.mm.values()]));
        const hex = (a) => Math.round(a * 255).toString(16).padStart(2, "0");
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="text-[11px] text-slate-500">
                  <th className="sticky left-0 z-10 min-w-[170px] bg-slate-900 px-3 py-2 text-left font-medium md:px-4">Nhân sự</th>
                  {cols.map((k) => (
                    <th key={k} className="min-w-[76px] px-1.5 py-2 text-center font-medium" title={name(k)}>
                      <span style={{ color: tone(color.get(k)) }}>■</span> {code(k)}
                      <div className="mx-auto max-w-[110px] truncate font-normal text-slate-600">{k === NO_PROJECT ? "chung, vắng" : name(k)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Tổng</th><th className="px-3 py-2 text-right font-medium">% tải</th><th className="px-3 py-2 text-right font-medium">Số DA</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => {
                  const p = pct(x), n = nProj(x);
                  return (
                    <tr key={x.eid} className="border-t border-slate-800/70">
                      <td className="sticky left-0 z-10 bg-slate-900 px-3 py-1.5 md:px-4">
                        <div className="truncate text-slate-100">{empName(x.eid)}</div>
                        <div className="text-[11px] text-slate-500">{x.dept}{x.role ? ` · ${x.role}` : ""}</div>
                      </td>
                      {cols.map((k) => {
                        const v = x.mm.get(k);
                        return v ? (
                          <td key={k} className="h-10 text-center font-mono text-slate-50" style={{ background: `${color.get(k)}${hex(0.14 + 0.6 * (v / maxV))}` }}
                            title={`${empName(x.eid)}\n${code(k)} · ${name(k)}\n${fmtH(v)} giờ · ${Math.round((v / x.t) * 100)}% thời gian của người này`}>{fmtH(v)}</td>
                        ) : <td key={k} className="h-10 text-center text-slate-700">·</td>;
                      })}
                      <td className="px-3 text-right font-mono text-slate-100">{fmtH(x.t)}</td>
                      <td className={`px-3 text-right font-mono ${x.st === "hi" ? "text-rose-400" : x.st === "lo" ? "text-amber-400" : x.st === "idle" ? "text-slate-300" : "text-teal-400"}`}>{p != null ? `${p}%` : "—"}</td>
                      <td className={`px-3 text-right font-mono ${n >= 3 ? "text-amber-400" : "text-slate-400"}`} title={n >= 3 ? "Ôm từ 3 dự án trở lên" : undefined}>{n}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 font-mono text-slate-300">
                  <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 font-sans text-xs text-slate-400 md:px-4">Tổng dự án</td>
                  {cols.map((k) => <td key={k} className="py-2 text-center">{fmtH(list.reduce((a, x) => a + (x.mm.get(k) || 0), 0))}</td>)}
                  <td className="px-3 py-2 text-right text-slate-100">{fmtH(list.reduce((a, x) => a + x.t, 0))}</td><td /><td />
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {fSt === "all" && zero.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-slate-800 px-3 py-2.5 text-[13px] md:px-4">
          <span className="whitespace-nowrap text-amber-400">Chưa chấm giờ nào · {zero.length} người:</span>
          <span className="text-slate-400">{zero.map((x) => empName(x.eid)).join(", ")}</span>
        </div>
      )}
    </div>
  );
}

const ProjectPhaseBars = ({ rows }) => {
  const [limit, setLimit] = useState(10);
  if (rows.length === 0) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>;
  const shown = limit === 0 ? rows : rows.slice(0, limit);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
        {PHASES.map((ph) => <span key={ph.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: tone(ph.color) }} />{ph.id} · {ph.name}</span>)}
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-slate-100" />Mốc dự kiến</span>
        {rows.length > 10 && (
          <span className="ml-auto flex items-center gap-1.5">
            {[10, 25, 0].map((n) => (
              <button key={n} onClick={() => setLimit(n)}
                className={`rounded-md border px-2.5 py-1 ${limit === n ? "border-teal-700 bg-teal-950 text-teal-300" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>
                {n === 0 ? `Tất cả (${rows.length})` : `Top ${n}`}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 620 }}>
        {shown.map((r) => {
          const max = Math.max(1, ...PHASES.map((ph) => Math.max(r.budgets?.[ph.id] || 0, r[ph.id] || 0)));
          const overs = PHASES.filter((ph) => (r.budgets?.[ph.id] || 0) > 0 && (r[ph.id] || 0) > r.budgets[ph.id]).map((ph) => ph.id);
          const tOver = r.budget > 0 && r.total > r.budget;
          return (
            <div key={r.id} data-proj={r.id} className="grid gap-x-5 gap-y-2 border-b border-slate-800 py-3 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="text-sm text-slate-100">{r.name}{overs.length > 0 && <span className="ml-1.5 whitespace-nowrap rounded border border-rose-900 bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300">Vượt {overs.join(", ")}</span>}</div>
                <div className={`mt-1 font-mono text-xs ${tOver ? "text-rose-400" : "text-slate-400"}`}>Tổng {fmtH(r.total)} / {r.budget > 0 ? `${fmtH(r.budget)} h · ${Math.round((r.total / r.budget) * 100)}%` : "—"}</div>
              </div>
              <div className="min-w-0 space-y-1.5">
                {PHASES.map((ph) => {
                  const b = r.budgets?.[ph.id] || 0, u = r[ph.id] || 0, over = b > 0 && u > b;
                  return (
                    <div key={ph.id} className="grid grid-cols-[28px_minmax(0,1fr)_104px] items-center gap-2.5 text-xs md:grid-cols-[28px_minmax(0,1fr)_150px]">
                      <span className="font-mono text-slate-400" title={ph.name}>{ph.id}</span>
                      <div className="relative h-2.5 rounded-sm bg-slate-800">
                        <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(u / max) * 100}%`, background: tone(ph.color) }} />
                        {b > 0 && <div className="absolute w-0.5 bg-slate-100" style={{ left: `calc(${(b / max) * 100}% - 1px)`, top: -3, bottom: -3 }} />}
                      </div>
                      <span className={`whitespace-nowrap text-right font-mono ${over ? "text-rose-400" : "text-slate-300"}`}>{fmtH(u)} / {b > 0 ? `${fmtH(b)} h` : "—"}{b > 0 && <span className="hidden md:inline"> · {Math.round((u / b) * 100)}%</span>}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ChartBar = ({ data, color }) => {
  const isMobile = useIsMobile();
  const w = isMobile ? 96 : 150;
  const trim = (s) => (isMobile && s.length > 16 ? s.slice(0, 15) + "…" : s.length > 26 ? s.slice(0, 25) + "…" : s);
  if (data.length === 0) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * (isMobile ? 28 : 32))}>
      <BarChart data={data.map((d) => ({ ...d, name: trim(d.name) }))} layout="vertical" margin={{ left: 4, right: 16 }}>
        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke={isLight() ? "#e2e8f0" : "#1e293b"} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={w} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "#1e293b" }}
          contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "6px 10px" }}
          labelStyle={{ color: "#ffffff", fontSize: 14, fontWeight: 600, marginBottom: 2 }}   // tên: 14px, in đậm
          itemStyle={{ color: "#ffffff", fontSize: 14 }}                                       // số giờ: 14px
        />
        <Bar dataKey="giờ" radius={[0, 4, 4, 0]} barSize={isMobile ? 11 : 14}>{data.map((_, i) => <Cell key={i} fill={color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/* ============================ DỰ ÁN ============================ */
function Projects({ cfg, saveCfg, flash }) {
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [client, setClient] = useState("");
  const [budgets, setBudgets] = useState({});   // giờ công dự kiến theo phase
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});
  const dataTick = useDataTick();
  const isWide = !useIsMobile();
  /* v6.9 — nhân sự tham gia dự án: mũi tên ⌄ dưới tên dự án mở danh sách "Tên · Vai trò"; + Nhân sự / ✕ để giao, gỡ
     (cùng dữ liệu với cột "Dự án đang tham gia" ở tab Nhân sự: employee.projects) */
  const [teamOpen, setTeamOpen] = useState(() => new Set());
  const [tp, setTp] = useState(null);   // { pid, q, x, y, top }
  useEffect(() => {
    if (!tp) return;
    const close = () => setTp(null);
    const esc = (ev) => { if (ev.key === "Escape") setTp(null); };
    document.addEventListener("click", close); document.addEventListener("keydown", esc); window.addEventListener("resize", close);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); window.removeEventListener("resize", close); };
  }, [!!tp]); // eslint-disable-line react-hooks/exhaustive-deps
  const inProj = (e, pid) => Array.isArray(e.projects) && e.projects.includes(pid);
  const toggleMember = (eid, pid) => saveCfg({ ...cfg, employees: cfg.employees.map((e) => (e.id !== eid ? e
    : { ...e, projects: inProj(e, pid) ? e.projects.filter((x) => x !== pid) : [...(Array.isArray(e.projects) ? e.projects : []), pid] })) });
  const teamToggle = (pid) => setTeamOpen((s) => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  const teamBlock = (p) => {
    const on = teamOpen.has(p.id);
    const team = cfg.employees.filter((e) => inProj(e, p.id));
    return (
      <div>
        <button onClick={() => teamToggle(p.id)} title="Nhân sự tham gia" aria-label="Nhân sự tham gia"
          className={`mt-0.5 flex h-6 items-center gap-1 rounded-md px-1.5 hover:bg-slate-700 ${on ? "text-teal-300" : "text-slate-500"}`}>
          <ChevronDown size={15} className={`transition-transform ${on ? "rotate-180" : ""}`} />
          <span className="font-mono text-[11px] text-slate-600">{team.length}</span>
        </button>
        {on && (
          <div className="mt-1 text-[12.5px]">
            {team.map((e) => (
              <div key={e.id} className="group flex min-h-[28px] items-center gap-1.5">
                <span className="whitespace-nowrap text-slate-200">{e.name}</span>
                {roleTitle(e.role) && <span className="whitespace-nowrap text-slate-500">· {roleTitle(e.role)}</span>}
                <button onClick={() => toggleMember(e.id, p.id)} title="Gỡ khỏi dự án" aria-label={`Gỡ ${e.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-500 opacity-0 hover:bg-rose-950 hover:text-rose-300 group-hover:opacity-100 max-md:opacity-100"><X size={12} /></button>
              </div>
            ))}
            <button onClick={(ev) => { ev.stopPropagation(); const r = ev.currentTarget.getBoundingClientRect(); setTp({ pid: p.id, q: "", x: Math.max(8, Math.min(window.innerWidth - 328, r.left)), y: r.bottom + 6, top: r.top }); }}
              className="mt-1 h-8 rounded-md border border-dashed border-slate-700 px-2.5 text-xs text-slate-400 hover:border-teal-600 hover:text-teal-300">+ Nhân sự</button>
          </div>
        )}
      </div>
    );
  };
  const teamPop = tp && (() => {
    const kw = norm(tp.q.trim());
    const list = cfg.employees.filter((e) => !kw || norm(`${e.name} ${e.code || ""} ${roleTitle(e.role)}`).includes(kw));
    const depts = [...new Set(list.map((e) => e.dept || "Khác"))];
    const below = tp.y + 400 < window.innerHeight;
    return (
      <div onClick={(ev) => ev.stopPropagation()} className="fixed z-50 w-[320px] rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-2xl"
        style={below ? { left: tp.x, top: tp.y } : { left: tp.x, bottom: window.innerHeight - tp.top + 6 }}>
        <div className="p-1"><input autoFocus value={tp.q} onChange={(ev) => setTp({ ...tp, q: ev.target.value })} placeholder="Tìm nhân sự (gõ không dấu được)" className={inputCls} /></div>
        <div className="max-h-72 overflow-y-auto">
          {list.length === 0 && <div className="px-3 py-3 text-sm text-slate-500">Không có nhân sự khớp.</div>}
          {depts.map((d) => (
            <div key={d}>
              <div className="px-2.5 pb-0.5 pt-2 text-[10.5px] uppercase tracking-wider text-slate-500">{d}</div>
              {list.filter((e) => (e.dept || "Khác") === d).map((e) => { const on = inProj(e, tp.pid);
                return (
                  <button key={e.id} onClick={() => toggleMember(e.id, tp.pid)} className="flex min-h-[42px] w-full items-center gap-2.5 rounded-md px-2.5 text-left hover:bg-slate-800">
                    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-600"}`}>{on && <Check size={12} />}</span>
                    <span className="min-w-0"><span className="block text-sm text-slate-200">{e.name}</span>{roleTitle(e.role) && <span className="block text-[11px] text-slate-500">{roleTitle(e.role)}</span>}</span>
                  </button>
                ); })}
            </div>
          ))}
        </div>
        <div className="flex justify-end p-1"><button onClick={() => setTp(null)} className={`${btnPrimary} h-9`}>Xong</button></div>
      </div>
    );
  })();

  /* Giờ đã dùng của từng dự án theo phase: tính trên TOÀN BỘ thời gian, chỉ giờ của ngày đã gửi, không tính vắng mặt.
     v2.1: lấy từ database (useUsage); chỉ khi chưa hỏi được mới tạm cộng từ phần đang có trong bộ nhớ. */
  const usage = useUsage();
  const used = useMemo(() => {
    const m = new Map();
    if (usage) {
      for (const u of usage) {
        if (u.projectId === NO_PROJECT || !u.sent) continue;
        const o = m.get(u.projectId) || {}; o[u.phaseId] = (o[u.phaseId] || 0) + u.sent; m.set(u.projectId, o);
      }
      return m;
    }
    for (const bucket of Object.values(DB?.ts || {})) for (const r of sentRows(bucket)) {
      if (isLeaveTask(r.taskId) || r.projectId === NO_PROJECT) continue;
      const h = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
      if (!h) continue;
      const o = m.get(r.projectId) || {};
      const ph = r.phaseId || DEFAULT_PHASE;
      o[ph] = (o[ph] || 0) + h; m.set(r.projectId, o);
    }
    return m;
  }, [dataTick, usage]);
  const usedOf = (p, ph) => used.get(p.id)?.[ph] || 0;
  const usedTotal = (p) => PHASES.reduce((a, ph) => a + usedOf(p, ph.id), 0);

  const add = async () => {
    if (!name.trim()) return flash("Nhập tên dự án.", "err");
    const bg = cleanBudgets(budgets);
    await saveCfg({ ...cfg, projects: [...cfg.projects, { id: uid("p"), name: name.trim(), code: code.trim(), client: client.trim(), budgets: bg, budget: budgetTotal({ budgets: bg }), phaseOpen: Object.fromEntries(PHASES.map((x) => [x.id, (bg[x.id] || 0) > 0])), active: true }] });
    setName(""); setCode(""); setClient(""); setBudgets({}); flash("Đã thêm dự án.");
  };
  const startEdit = (p) => { setEditId(p.id); setDraft({ code: p.code || "", name: p.name, client: p.client || "", budgets: Object.fromEntries(PHASES.map((ph) => [ph.id, projBudgets(p)[ph.id] || ""])) }); };
  const commit = async () => {
    if (!draft.name.trim()) return flash("Tên dự án không được để trống.", "err");
    const bg = cleanBudgets(draft.budgets);
    await saveCfg({ ...cfg, projects: cfg.projects.map((p) => (p.id === editId ? { ...p, code: draft.code.trim(), name: draft.name.trim(), client: draft.client.trim(), budgets: bg, budget: budgetTotal({ budgets: bg }) } : p)) });
    setEditId(null); flash("Đã cập nhật dự án.");
  };
  const phInput = (val, onChange, ph, withPlaceholder) => (
    <input type="number" min="0" step="8" value={val ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && editId && commit()}
      aria-label={`Giờ dự kiến ${ph.id}`} placeholder={withPlaceholder ? ph.id : "0"} className={`px-2 text-right font-mono ${inputCls}`} />
  );
  // v3.1: bật / tắt cho nhân sự chấm vào giai đoạn này của dự án
  const togglePhase = async (p, phId) => {
    const map = Object.fromEntries(PHASES.map((x) => [x.id, projPhaseIsOpen(p, x.id)]));
    map[phId] = !map[phId];
    const ok = await saveCfg({ ...cfg, projects: cfg.projects.map((x) => (x.id === p.id ? { ...x, phaseOpen: map } : x)) });
    if (ok) flash(`${p.code ? `[${p.code}] ` : ""}${p.name} · ${phId}: ${map[phId] ? "đã mở chấm công" : "đã đóng chấm công"}.`);
  };
  const PhaseToggle = ({ p, ph }) => {
    const on = projPhaseIsOpen(p, ph.id);
    return (
      <button onClick={() => togglePhase(p, ph.id)} title={on ? "Đang mở — nhân sự chấm được giai đoạn này. Bấm để đóng." : "Đang đóng — nhân sự không chấm được. Bấm để mở."}
        className={`mt-1.5 inline-flex h-6 items-center gap-1 rounded border px-2 text-[11px] ${on ? "border-teal-700 bg-teal-950 text-teal-300" : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"}`}>
        {on ? <Unlock size={10} /> : <Lock size={10} />}{on ? "Đang mở" : "Đóng"}
      </button>
    );
  };
  const PhaseCell = ({ p, ph }) => {
    const b = projBudgets(p)[ph.id], u = usedOf(p, ph.id), over = b > 0 && u > b;
    if (!b && !u) return <div><span className="font-mono text-slate-600">—</span><div><PhaseToggle p={p} ph={ph} /></div></div>;
    return (
      <div>
        <div className={`whitespace-nowrap font-mono text-[13px] ${over ? "text-rose-400" : "text-slate-300"}`}>{fmtH(u)}<span className={over ? "" : "text-slate-500"}> / {b > 0 ? `${fmtH(b)} h` : "—"}</span></div>
        {b > 0 && <div className="mt-1 h-1 overflow-hidden rounded bg-slate-800"><div className="h-full rounded" style={{ width: `${Math.min(100, (u / b) * 100)}%`, background: tone(over ? "#fb7185" : ph.color) }} /></div>}
        <PhaseToggle p={p} ph={ph} />
      </div>
    );
  };
  const phHead = (ph) => <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: tone(ph.color) }} />{ph.id} · {ph.name}</span>;
  const toggle = (id) => saveCfg({ ...cfg, projects: cfg.projects.map((p) => (p.id === id ? { ...p, active: !p.active } : p)) });
  const [projOrder, setProjOrder] = useProjOrder();
  const projList = sortByProjOrder(cfg.projects, projOrder, (x) => x.id);   // v7.7: thứ tự kéo thả (riêng từng máy)
  const projDrag = useRowDrag((from, to, after) => {
    const moved = moveInList(projList.map((x) => x.id), from, to, after);
    setProjOrder(moved);
  });
  const [pendingDel, setPendingDel] = useState(null); // dự án chờ xác nhận xoá
  const del = (id) => setPendingDel(cfg.projects.find((p) => p.id === id) || null);
  const confirmDel = async () => {
    const p = pendingDel; setPendingDel(null);
    if (!p) return;
    await saveCfg({ ...cfg, projects: cfg.projects.filter((x) => x.id !== p.id) });
    flash("Đã xoá dự án.");
  };

  const StatusBtn = ({ p, full }) => (
    <button onClick={() => toggle(p.id)}
      className={`ro-static h-9 rounded-md border px-3 text-xs font-medium ${full ? "w-full" : ""} ${p.active ? "border-teal-900 bg-teal-950 text-teal-300" : "border-slate-700 bg-slate-950 text-slate-500"}`}>
      {p.active ? "Đang chấm công" : "Đã đóng"}
    </button>
  );

  return (
    <Panel title="Dự án — sửa thông tin & bật/tắt chấm công">
      {teamPop}
      {/* bọc trong div để class width không bị w-full của inputCls ghi đè */}
      <div className="ro-hide mb-5 grid gap-2 md:flex md:flex-wrap md:items-end">
        <div className="md:w-28">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã DA" className={`font-mono ${inputCls}`} />
        </div>
        <div className="md:min-w-48 md:flex-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên dự án" className={inputCls} />
        </div>
        <div className="md:w-44">
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Khách hàng" className={inputCls} />
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(PHASES.length, 4)}, minmax(0, 1fr))`, width: isWide ? `${PHASES.length * 5.75}rem` : undefined }}>
          {PHASES.map((ph) => (
            <label key={ph.id} className="min-w-0">
              <span className="mb-1 flex items-center gap-1 truncate text-[11px] text-slate-500"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: tone(ph.color) }} />{ph.id}<span className="hidden truncate md:inline"> · {ph.name}</span></span>
              {phInput(budgets[ph.id], (v) => setBudgets({ ...budgets, [ph.id]: v }), ph, false)}
            </label>
          ))}
        </div>
        <button onClick={add} className={btnPrimary}><Plus size={14} /> Thêm dự án</button>
      </div>

      {cfg.projects.length === 0 ? <p className="text-sm text-slate-500">Chưa có dự án. Thêm dự án để nhân sự bắt đầu chấm công.</p> : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1240px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="w-20 px-3 py-2 font-medium">Mã DA</th>
                  <th className="px-3 py-2 font-medium">Tên dự án</th>
                  <th className="w-36 px-3 py-2 font-medium">Khách hàng</th>
                  {PHASES.map((ph) => <th key={ph.id} className="w-[130px] px-2 py-2 font-medium normal-case tracking-normal">{phHead(ph)}</th>)}
                  <th className="w-32 px-3 py-2 text-right font-medium">Tổng</th>
                  <th className="w-40 px-3 py-2 font-medium">Trạng thái</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {projList.map((p) => {
                  const editing = editId === p.id;
                  return (
                    <tr key={p.id} {...projDrag.rowProps(p.id)} className={`border-b border-slate-800 align-top hover:bg-slate-800 ${projDrag.mark(p.id, "tr")}`}>
                      <td className="whitespace-nowrap px-3 py-2">{projDrag.grip(p.id, editing || projList.length < 2)}{editing ? <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={`font-mono ${inputCls}`} /> : <span className="font-mono text-base font-bold leading-6 text-white">{p.code || "—"}</span>}</td>
                      <td className="px-3 py-2">{editing ? <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && commit()} className={inputCls} /> : <><div className="text-[15px] leading-6 text-slate-100">{p.name}</div>{teamBlock(p)}</>}</td>
                      <td className="px-3 py-2">{editing ? <input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} onKeyDown={(e) => e.key === "Enter" && commit()} className={inputCls} /> : <span className="leading-6 text-slate-400">{p.client || "—"}</span>}</td>
                      {PHASES.map((ph) => (
                        <td key={ph.id} className="px-2 py-2" data-phase={ph.id}>
                          {editing ? phInput(draft.budgets?.[ph.id], (v) => setDraft({ ...draft, budgets: { ...draft.budgets, [ph.id]: v } }), ph, false) : <PhaseCell p={p} ph={ph} />}
                        </td>
                      ))}
                      <td className={`whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] ${!editing && budgetTotal(p) > 0 && usedTotal(p) > budgetTotal(p) ? "text-rose-400" : "text-slate-300"}`} data-total>
                        {editing ? `${fmtH(budgetTotal({ budgets: cleanBudgets(draft.budgets) }))} h` : `${fmtH(usedTotal(p))} / ${budgetTotal(p) > 0 ? `${fmtH(budgetTotal(p))} h` : "—"}`}
                      </td>
                      <td className="px-3 py-2"><StatusBtn p={p} /></td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1.5">
                          {editing ? (
                            <><button onClick={commit} className={`${iconBtn} border-teal-800 text-teal-400`}><Check size={15} /></button>
                              <button onClick={() => setEditId(null)} className={iconBtn}><X size={15} /></button></>
                          ) : (
                            <><button onClick={() => startEdit(p)} className={iconBtn}><Pencil size={14} /></button>
                              <button onClick={() => del(p.id)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button></>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {projList.map((p) => {
              const editing = editId === p.id;
              return (
                <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  {editing ? (
                    <div className="space-y-2">
                      <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Mã DA" className={`font-mono ${inputCls}`} />
                      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Tên dự án" className={inputCls} />
                      <input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="Khách hàng" className={inputCls} />
                      <div className="grid grid-cols-4 gap-2">
                        {PHASES.map((ph) => <div key={ph.id}>{phInput(draft.budgets?.[ph.id], (v) => setDraft({ ...draft, budgets: { ...draft.budgets, [ph.id]: v } }), ph, true)}</div>)}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={commit} className={btnPrimary}><Check size={15} /> Lưu</button>
                        <button onClick={() => setEditId(null)} className={btnGhost}><X size={15} /> Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {p.code && <div className="font-mono text-sm font-bold text-slate-50">{p.code}</div>}
                          <div className="text-sm font-medium text-slate-100">{p.name}</div>
                          <div className="text-xs text-slate-500">{p.client || "—"}</div>
                          {teamBlock(p)}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button onClick={() => startEdit(p)} className={iconBtn}><Pencil size={14} /></button>
                          <button onClick={() => del(p.id)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
                        {PHASES.map((ph) => (
                          <div key={ph.id} className="min-w-0"><div className="mb-0.5 text-[11px] text-slate-500">{phHead(ph)}</div><PhaseCell p={p} ph={ph} /></div>
                        ))}
                      </div>
                      <div className="mt-2.5"><StatusBtn p={p} full /></div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-slate-500">Mỗi ô phase: giờ đã gửi / giờ dự kiến, nút <b className="text-slate-400">Đang mở / Đóng</b> quyết định nhân sự có chấm được giai đoạn đó không (chỉ mở một giai đoạn thì nhân sự khỏi phải chọn). Phase để trống giờ dự kiến nghĩa là không theo dõi hạn mức. Dự án đã đóng thì nhân sự không chấm công được nữa — giờ công đã ghi vẫn giữ nguyên trong báo cáo.</p>

      <ConfirmDialog
        open={!!pendingDel}
        title={`Xoá dự án ${pendingDel?.name || ""}?`}
        desc="Giờ công đã chấm cho dự án này vẫn nằm trong dữ liệu nhưng báo cáo sẽ hiển thị là (dự án đã xoá). Nếu chỉ muốn ngừng chấm công, hãy chuyển sang trạng thái Đã đóng."
        confirmLabel="Xoá dự án"
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
    </Panel>
  );
}

/* ============================ NHÂN SỰ ============================ */
/* v1.7: kiểm tra phần tài khoản của một dòng. Trả về thông điệp lỗi, hoặc null nếu hợp lệ.
   Bỏ trống cả hai ô = không tạo tài khoản (chỉ được phép khi dòng đó chưa có tài khoản). */
/* v7.3 — 4 cấp quyền của tài khoản */
const ACCESS_LEVELS = [["emp", "Nhân viên"], ["head", "Trưởng phòng"], ["bod", "BOD"], ["admin", "Admin"]];
const accessOfAcc = (a) => a?.access || (a?.isAdmin ? "admin" : "emp");
const accessLabel = (k) => ACCESS_LEVELS.find((x) => x[0] === k)?.[1] || "";
const accountError = (acc, d) => {
  const u = normUsername(d.username), p = d.password || "";
  if (!acc && !u && !p) return null;
  if (!USERNAME_RE.test(u)) return "Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch.";
  if (p.length < PASSWORD_MIN) return `Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.`;
  return null;
};

/* Ô mật khẩu ở chế độ xem: che mặc định, bấm con mắt để hiện */
function PasswordCell({ value, shown, onToggle }) {
  if (!value) return <span className="text-slate-600">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-slate-300">{shown ? value : "••••••"}</span>
      <button onClick={onToggle} className="text-slate-500 hover:text-slate-200">{shown ? <EyeOff size={14} /> : <Eye size={14} />}</button>
    </span>
  );
}

/* Tên đăng nhập gợi ý từ họ tên: "Đỗ Thị Thảo" -> thao.dt ; trùng thì thêm số 2, 3… */
const suggestUsername = (name, taken) => {
  const w = norm(name).replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const base = w.length > 1 ? `${w[w.length - 1]}.${w.slice(0, -1).map((x) => x[0]).join("")}` : w[0];
  let u = base.length < 3 ? `${base}01` : base;
  for (let i = 2; taken.has(u); i++) u = `${base}${i}`;
  return u.slice(0, 30);
};
/* Mật khẩu ngẫu nhiên 8 ký tự, bỏ các ký tự dễ nhầm (0/o, 1/l/i) */
const genPassword = () => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(8);
  (typeof crypto !== "undefined" && crypto.getRandomValues) ? crypto.getRandomValues(buf) : buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 4294967296); });
  return Array.from(buf, (n) => a[n % a.length]).join("");
};
const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* trình duyệt chặn clipboard API: thử cách cũ */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
};

function Employees({ cfg, saveCfg, flash, readOnly = false }) {
  const [sub, setSub] = useState("emp");              // tab con: emp | admin
  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("");
  const [fStatus, setFStatus] = useState("");         // "" | none | active | locked
  const [accounts, setAccounts] = useState(null);     // null = đang tải / tải hỏng
  const [shown, setShown] = useState({});             // id tài khoản đang hiện mật khẩu
  const [busy, setBusy] = useState(false);
  /* Khung thêm / sửa: { kind: "emp" | "admin", empId, accId, hadAcc, autoUser, f: {...} } */
  const [dlg, setDlg] = useState(null);
  const [pendingDel, setPendingDel] = useState(null); // nhân sự chờ xác nhận xoá
  /* v6.9 (mẫu C) — sửa "Dự án đang tham gia" ngay trên danh sách: { kind: "add" | "copy", eid, x, y, q } */
  const [pp, setPp] = useState(null);
  useEffect(() => {
    if (!pp) return;
    const close = () => setPp(null);
    const esc = (ev) => { if (ev.key === "Escape") setPp(null); };
    document.addEventListener("click", close); document.addEventListener("keydown", esc); window.addEventListener("resize", close);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); window.removeEventListener("resize", close); };
  }, [!!pp]); // eslint-disable-line react-hooks/exhaustive-deps
  const projLabel = (p) => (p.code ? `[${p.code}] ${p.name}` : p.name);
  const empProjs = (e) => (Array.isArray(e.projects) ? e.projects : []).filter((pid) => cfg.projects.some((p) => p.id === pid));
  const setEmpProjs = (eid, list) => saveCfg({ ...cfg, employees: cfg.employees.map((x) => (x.id === eid ? { ...x, projects: list } : x)) });
  const openPp = (ev, kind, eid) => {
    ev.stopPropagation();
    const r = ev.currentTarget.getBoundingClientRect(), W = 320;
    setPp({ kind, eid, q: "", x: Math.max(8, Math.min(window.innerWidth - W - 8, r.left)), y: r.bottom + 6, top: r.top });
  };
  const [pendingAcc, setPendingAcc] = useState(null); // tài khoản không gắn nhân sự chờ xác nhận xoá

  useEffect(() => {
    let alive = true;
    if (readOnly) { setAccounts([]); return () => { alive = false; }; }   // v7.7: BOD không xem tài khoản đăng nhập / mật khẩu
    (async () => {
      try { const r = await accountsApi("list"); if (alive) setAccounts(r.accounts); }
      catch (e) { if (alive) flash(e.message, "err"); }
    })();
    return () => { alive = false; };
  }, [flash]);

  const accByEmp = useMemo(() => new Map((accounts || []).filter((a) => a.empId).map((a) => [a.empId, a])), [accounts]);
  // tài khoản không gắn nhân sự: tài khoản quản lý tạo lúc đầu, hoặc nhân sự gắn kèm không còn
  const loose = useMemo(() => {
    const ids = new Set(cfg.employees.map((e) => e.id));
    return (accounts || []).filter((a) => !a.empId || !ids.has(a.empId));
  }, [accounts, cfg.employees]);
  const mergeAcc = (a) => setAccounts((list) => {
    const rest = (list || []).filter((x) => x.id !== a.id);
    return [...rest, a].sort((x, y) => x.username.localeCompare(y.username));
  });
  const toggleShown = (id) => setShown((m) => ({ ...m, [id]: !m[id] }));
  const takenUsernames = (exceptAccId) => new Set((accounts || []).filter((a) => a.id !== exceptAccId).map((a) => a.username));

  /* Dự án đang tham gia: dự án nhân sự đã GỬI ít nhất 1 giờ trong tháng này (tự động theo giờ công) */
  const now = new Date();
  const thisYm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const empIdsKey = cfg.employees.map((e) => e.id).join(",");
  const dataTick = useDataTick();
  const projByEmp = useMemo(() => {
    const label = new Map(cfg.projects.map((p) => [p.id, p.code ? `[${p.code}] ${p.name}` : p.name]));
    const map = new Map();
    for (const e of cfg.employees) {
      const pids = new Set();
      for (const r of dbTsSent(e.id, thisYm)?.rows || []) {   // v1.9: chỉ tính giờ đã gửi
        if (label.has(r.projectId) && Object.values(r.days || {}).some((v) => v > 0)) pids.add(r.projectId);
      }
      map.set(e.id, [...pids].map((id) => label.get(id)));
    }
    return map;
  }, [empIdsKey, cfg.projects, thisYm, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- lọc và gom nhóm ---- */
  const statusOf = (e) => { const a = accByEmp.get(e.id); return !a ? "none" : a.disabled ? "locked" : "active"; };
  const kw = norm(q.trim());
  const visible = cfg.employees.filter((e) => {
    if (fDept && e.dept !== fDept) return false;
    if (fStatus && statusOf(e) !== fStatus) return false;
    return !kw || norm(`${e.code || ""} ${e.name} ${accByEmp.get(e.id)?.username || ""} ${e.role || ""} ${roleInfo(e.role)?.name || ""}`).includes(kw);
  });
  // phòng ban theo thứ tự khai báo; nhân sự mang tên phòng ban lạ (dữ liệu cũ) xếp cuối để không bị mất dấu
  const deptOrder = [...DEPTS, ...cfg.employees.map((e) => e.dept).filter((d, i, a) => !DEPTS.includes(d) && a.indexOf(d) === i)];
  const groups = deptOrder.map((d) => ({ dept: d, list: visible.filter((e) => e.dept === d) })).filter((g) => g.list.length);

  /* Tạo hoặc cập nhật tài khoản. Trả về true nếu xong hoặc không có gì để làm. */
  const pushAccount = async (empId, acc, d) => {
    const u = normUsername(d.username), p = d.password || "", lv = d.access || "emp";
    if (!acc && !u) return true;
    if (acc && acc.username === u && acc.password === p && accessOfAcc(acc) === lv) return true;
    try {
      const r = await accountsApi("save", { id: acc?.id, empId, username: u, password: p, access: lv, isAdmin: lv === "admin" });
      mergeAcc(r.account);
      return true;
    } catch (e) { flash(e.message, "err"); return false; }
  };

  /* ---- khung thêm / sửa ---- */
  const openAdd = () => setDlg({ kind: "emp", empId: null, accId: null, hadAcc: false, autoUser: true,
    f: { code: "", name: "", dept: fDept || DEPTS[0], role: "", projects: [], username: "", password: genPassword(), access: "emp" } });
  const openEdit = (e) => {
    const a = accByEmp.get(e.id);
    // sửa người đã có sẵn: KHÔNG tự gợi ý tên đăng nhập khi đổi họ tên, kẻo đổi tên một người chưa có tài khoản
    // lại vô tình điền tên đăng nhập và bị chặn vì thiếu mật khẩu
    setDlg({ kind: "emp", empId: e.id, accId: a?.id || null, hadAcc: !!a, autoUser: false,
      f: { code: e.code || "", name: e.name, dept: e.dept, role: e.role || "", projects: Array.isArray(e.projects) ? e.projects : [], username: a?.username || "", password: a?.password || "", access: a ? accessOfAcc(a) : "emp" } });
  };
  const openAddAdmin = () => setDlg({ kind: "admin", empId: null, accId: null, hadAcc: false, autoUser: false, f: { username: "", password: genPassword(), access: "admin" } });
  const openEditAdmin = (a) => setDlg({ kind: "admin", empId: a.empId || null, accId: a.id, hadAcc: true, autoUser: false, f: { username: a.username, password: a.password, access: accessOfAcc(a) } });
  const setF = (patch, extra = {}) => setDlg((d) => (d ? { ...d, ...extra, f: { ...d.f, ...patch } } : d));
  // gõ họ tên thì tên đăng nhập tự gợi ý, cho tới khi người dùng tự sửa ô tên đăng nhập
  const onNameChange = (v) => setDlg((d) => (d ? { ...d, f: { ...d.f, name: v, ...(d.autoUser ? { username: suggestUsername(v, takenUsernames(d.accId)) } : {}) } } : d));
  // đổi phòng ban thì bỏ vai trò không thuộc phòng ban mới
  const onDeptChange = (v) => setDlg((d) => (d ? { ...d, f: { ...d.f, dept: v, role: roleInfo(d.f.role)?.dept === v ? d.f.role : "" } } : d));

  const saveDlg = async (more) => {
    if (busy || !dlg) return;
    const { f } = dlg;
    const acc = dlg.accId ? (accounts || []).find((a) => a.id === dlg.accId) || null : null;
    if (dlg.kind === "emp") {
      const name = f.name.trim(), code = f.code.trim();
      if (!name) return flash("Nhập tên nhân sự.", "err");
      if (code && cfg.employees.some((e) => e.id !== dlg.empId && (e.code || "").toLowerCase() === code.toLowerCase())) return flash("Mã NV này đã có.", "err");
      // để trống tên đăng nhập = chưa tạo tài khoản (chỉ được phép khi người này chưa có tài khoản)
      const wantsAcc = !!acc || !!normUsername(f.username);
      const err = wantsAcc ? accountError(acc, f) : null;
      if (err) return flash(err, "err");
      setBusy(true);
      const id = dlg.empId || uid("e");
      const row = { code, name, dept: f.dept, role: f.role || "", projects: (f.projects || []).filter((pid) => cfg.projects.some((p) => p.id === pid)) };   // v6.9
      const ok = await saveCfg({ ...cfg, employees: dlg.empId ? cfg.employees.map((e) => (e.id === id ? { ...e, ...row } : e)) : [...cfg.employees, { id, ...row }] });
      const accOk = ok !== false && (!wantsAcc || (await pushAccount(id, acc, f)));
      setBusy(false);
      if (ok === false) return;
      // nhân sự đã lưu nhưng tài khoản lỗi: chuyển khung sang chế độ sửa người đó để sửa tiếp phần tài khoản
      if (!accOk) return setDlg({ ...dlg, empId: id });
      flash(dlg.empId ? "Đã cập nhật nhân sự." : "Đã thêm nhân sự.");
      if (more) setDlg({ kind: "emp", empId: null, accId: null, hadAcc: false, autoUser: true, f: { code: "", name: "", dept: f.dept, role: "", projects: f.projects || [], username: "", password: genPassword(), access: "emp" } });
      else setDlg(null);
      return;
    }
    const err = accountError(acc, f);
    if (err) return flash(err, "err");
    setBusy(true);
    const done = await pushAccount(dlg.empId, acc, f);
    setBusy(false);
    if (done) { setDlg(null); flash(acc ? "Đã cập nhật tài khoản." : "Đã thêm tài khoản."); }
  };
  useEffect(() => {
    if (!dlg) return;
    const h = (e) => { if (e.key === "Escape") setDlg(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [!!dlg]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Khoá / mở khoá: người bị khoá không đăng nhập được, giờ công đã chấm giữ nguyên */
  const toggleLock = async (a) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await accountsApi("setDisabled", { id: a.id, disabled: !a.disabled });
      mergeAcc(r.account);
      flash(r.account.disabled ? "Đã khoá tài khoản." : "Đã mở khoá tài khoản.");
    } catch (e) { flash(e.message, "err"); }
    setBusy(false);
  };
  const copyAccount = async (a, name) => {
    const ok = await copyText(`${name ? `${name}\n` : ""}Tên đăng nhập: ${a.username}\nMật khẩu: ${a.password}`);
    flash(ok ? `Đã chép tài khoản ${a.username}.` : "Trình duyệt không cho chép. Bấm con mắt để xem mật khẩu.", ok ? "ok" : "err");
  };
  const confirmDel = async () => {
    const e = pendingDel; setPendingDel(null);
    if (!e) return;
    const a = accByEmp.get(e.id);
    if (a) {
      // xoá tài khoản trước: nếu server từ chối (ví dụ tự xoá chính mình) thì giữ nguyên nhân sự
      try { await accountsApi("remove", { id: a.id }); setAccounts((list) => (list || []).filter((x) => x.id !== a.id)); }
      catch (err) { return flash(err.message, "err"); }
    }
    await saveCfg({ ...cfg, employees: cfg.employees.filter((x) => x.id !== e.id) });
    flash("Đã xoá nhân sự.");
  };
  const confirmDelAcc = async () => {
    const a = pendingAcc; setPendingAcc(null);
    if (!a) return;
    try { await accountsApi("remove", { id: a.id }); setAccounts((list) => (list || []).filter((x) => x.id !== a.id)); flash("Đã xoá tài khoản."); }
    catch (err) { flash(err.message, "err"); }
  };

  /* Xuất danh sách tài khoản (theo bộ lọc đang chọn) ra Excel để phát cho nhân viên */
  const exportAccounts = async () => {
    const XLSX = await loadXlsx();
    const rows = visible.filter((e) => accByEmp.has(e.id)).map((e) => {
      const a = accByEmp.get(e.id);
      return { "Mã NV": e.code || "", "Họ và tên": e.name, "Phòng ban": e.dept, "Vai trò": roleTitle(e.role), "Tên đăng nhập": a.username, "Mật khẩu": a.password, "Trạng thái": a.disabled ? "Đã khoá" : "Đang dùng" };
    });
    if (!rows.length) return flash("Không có tài khoản nào trong danh sách đang lọc.", "err");
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tài khoản");
    XLSX.writeFile(wb, `ARTIUS_tai-khoan_${fmt(new Date())}.xlsx`);
    flash(`Đã xuất ${rows.length} tài khoản.`);
  };

  const panelCls = "rounded-xl border border-slate-800 bg-slate-900";
  const COLS = "md:grid md:grid-cols-[72px_minmax(140px,210px)_170px_150px_110px_minmax(260px,1fr)_156px] md:items-center md:gap-3";
  // v7.3: nhãn cấp quyền (Nhân viên thì không hiện)
  const LV_CLS = { head: "border-sky-800 bg-sky-950 text-sky-300", bod: "border-violet-800 bg-violet-950 text-violet-300", admin: "border-teal-800 bg-teal-950 text-teal-300" };
  const lvBadge = (a) => { const k = accessOfAcc(a); return k === "emp" ? null : <span className={`rounded border px-1.5 py-0.5 text-[10px] ${LV_CLS[k]}`}>{accessLabel(k)}</span>; };
  const lockedBadge = <span className="rounded border border-rose-900 bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300">Đã khoá</span>;
  const none = <span className="text-slate-600">—</span>;
  const accBtns = (a, name) => (
    <>
      <button onClick={() => copyAccount(a, name)} title="Chép tài khoản" className={iconBtn}><Copy size={14} /></button>
      <button onClick={() => toggleLock(a)} title={a.disabled ? "Mở khoá" : "Khoá tài khoản"} className={`${iconBtn} ${a.disabled ? "border-rose-900 text-rose-400" : ""}`}>{a.disabled ? <Unlock size={14} /> : <Lock size={14} />}</button>
    </>
  );
  const sqBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100";

  /* ---------------- tab con Nhân sự ---------------- */
  const empRow = (e) => {
    const a = accByEmp.get(e.id);
    const dim = a?.disabled ? "text-slate-500" : "";
    const roleEl = e.role ? <span className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-teal-300">{roleLabel(e.role) || e.role}</span> : null;
    // v6.9 (mẫu C): chip dự án có ✕ để gỡ; "+ Dự án" mở danh sách tích chọn
    const mine = empProjs(e);
    const projEl = (
      <>
        {mine.map((pid) => { const p = cfg.projects.find((x) => x.id === pid);
          return (
            <span key={pid} className={`inline-flex h-8 items-center gap-1 rounded-md border pl-2 text-xs ${p.active ? "border-teal-900 bg-teal-950 text-teal-200" : "border-slate-700 text-slate-500"}`}>
              {projLabel(p)}{!p.active && " (đã đóng)"}
              <button onClick={() => setEmpProjs(e.id, mine.filter((x) => x !== pid))} title="Gỡ dự án" aria-label={`Gỡ ${p.name}`}
                className="flex h-7 w-7 items-center justify-center rounded text-teal-400 hover:bg-rose-950 hover:text-rose-300"><X size={13} /></button>
            </span>
          ); })}
        <button onClick={(ev) => openPp(ev, "add", e.id)} className="ro-hide h-8 rounded-md border border-dashed border-slate-700 px-2.5 text-xs text-slate-400 hover:border-teal-600 hover:text-teal-300">+ Dự án</button>
      </>
    );
    const btns = (
      <div className="flex shrink-0 justify-end gap-1">
        {a && accBtns(a, e.name)}
        <button onClick={() => openEdit(e)} title="Sửa" className={iconBtn}><Pencil size={14} /></button>
        <button onClick={() => setPendingDel(e)} title="Xoá" className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>
      </div>
    );
    return (
      <div key={e.id} className="border-b border-slate-800 px-3 py-2 text-sm hover:bg-slate-800/40 md:px-3.5">
        {/* desktop: một dòng 7 cột */}
        <div className={`hidden min-h-[36px] ${COLS}`}>
          <div className={`font-mono text-xs ${dim || "text-slate-400"}`}>{e.code || "—"}</div>
          <div className={`min-w-0 break-words ${dim || "text-slate-100"}`}>{e.name}</div>
          <div className="min-w-0">{roleEl || none}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {a ? <><span className="break-all font-mono text-xs text-slate-300">{a.username}</span>{lvBadge(a)}{a.disabled && lockedBadge}</> : <span className="text-slate-600">Chưa có</span>}
          </div>
          <div><PasswordCell value={a?.password} shown={!!shown[a?.id]} onToggle={() => toggleShown(a.id)} /></div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">{projEl}</div>
          {btns}
        </div>
        {/* mobile: thẻ */}
        <div className="md:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {e.code && <div className="font-mono text-[11px] text-slate-500">{e.code}</div>}
              <div className={`break-words ${dim || "text-slate-100"}`}>{e.name}</div>
            </div>
            {btns}
          </div>
          {roleEl && <div className="mt-1.5 flex flex-wrap gap-1.5">{roleEl}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{projEl}</div>
          {a && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="break-all font-mono text-xs text-slate-300">{a.username}</span>
              <PasswordCell value={a.password} shown={!!shown[a.id]} onToggle={() => toggleShown(a.id)} />
              {lvBadge(a)}{a.disabled && lockedBadge}
            </div>
          )}
        </div>
      </div>
    );
  };
  const empTab = (
    <div className={panelCls}>
      <div className="grid grid-cols-2 gap-2 p-3 xl:grid-cols-[minmax(200px,1fr)_200px_200px_auto_auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã, vai trò, tên đăng nhập" className={`col-span-2 xl:col-span-1 ${inputCls}`} />
        <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={selectCls}>
          <option value="">Mọi phòng ban</option>
          {deptOrder.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
          <option value="">Mọi tài khoản</option>
          <option value="none">Chưa có tài khoản</option>
          <option value="active">Đang dùng</option>
          <option value="locked">Đã khoá</option>
        </select>
        <button onClick={exportAccounts} className={`whitespace-nowrap ${btnGhost}`}><Download size={14} /> Xuất tài khoản</button>
        <button onClick={openAdd} className={`whitespace-nowrap ${btnPrimary}`}><Plus size={14} /> Thêm nhân sự</button>
      </div>
      <div className="px-3.5 pb-2.5 text-xs text-slate-500">
        {visible.length === cfg.employees.length ? `${visible.length} nhân sự` : `${visible.length} / ${cfg.employees.length} nhân sự`}
      </div>
      <div className={`hidden border-y border-slate-800 px-3.5 py-2 text-[11px] uppercase tracking-wider text-slate-500 ${COLS}`}>
        <div>Mã NV</div><div>Họ và tên</div><div>Vai trò</div><div>Tên đăng nhập</div><div>Mật khẩu</div><div>Dự án đang tham gia</div><div></div>
      </div>
      {cfg.employees.length === 0 ? <div className="px-4 py-7 text-center text-sm text-slate-500">Chưa có nhân sự.</div>
        : groups.length === 0 ? <div className="px-4 py-7 text-center text-sm text-slate-500">Không có nhân sự khớp bộ lọc.</div>
        : groups.map((g) => (
          <React.Fragment key={g.dept}>
            <div className="sticky top-0 z-10 mx-2 mb-0.5 mt-2.5 flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-[#1a2740] px-2.5 py-2 text-xs uppercase tracking-wider text-slate-100">
              <span className="min-w-0 truncate">{g.dept}</span>
              <span className="shrink-0 font-mono tracking-normal text-slate-400">{g.list.length}</span>
            </div>
            {g.list.map(empRow)}
          </React.Fragment>
        ))}
    </div>
  );

  /* ---------------- tab con Tài khoản quản lý: tài khoản không gắn nhân sự ---------------- */
  const adminTab = (
    <div className={panelCls}>
      <div className="flex justify-end p-3">
        <button onClick={openAddAdmin} className={`whitespace-nowrap ${btnPrimary}`}><Plus size={14} /> Thêm tài khoản</button>
      </div>
      {loose.length === 0 ? <div className="border-t border-slate-800 px-4 py-7 text-center text-sm text-slate-500">Chưa có tài khoản nào không gắn nhân sự.</div>
        : loose.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-3.5 py-2.5 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="break-all font-mono text-slate-100">{a.username}</span>
              <PasswordCell value={a.password} shown={!!shown[a.id]} onToggle={() => toggleShown(a.id)} />
              {lvBadge(a)}{a.disabled && lockedBadge}
            </div>
            <div className="flex shrink-0 gap-1">
              {accBtns(a, "")}
              <button onClick={() => openEditAdmin(a)} title="Sửa" className={iconBtn}><Pencil size={14} /></button>
              <button onClick={() => setPendingAcc(a)} title="Xoá" className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
    </div>
  );

  /* ---------------- khung thêm / sửa ---------------- */
  const onEnter = (e) => { if (e.key === "Enter") saveDlg(false); };
  const f = dlg?.f;
  const dlgTitle = !dlg ? "" : dlg.kind === "emp" ? (dlg.empId ? "Sửa nhân sự" : "Thêm nhân sự") : (dlg.accId ? "Sửa tài khoản" : "Thêm tài khoản BOD / Admin");
  const formDlg = dlg && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[8vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) setDlg(null); }}>
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <h4 className="text-sm font-semibold text-slate-50">{dlgTitle}</h4>
          <button onClick={() => setDlg(null)} className={iconBtn}><X size={15} /></button>
        </div>
        <div className="space-y-2.5 p-4">
          {dlg.kind === "emp" && (
            <>
              <div className="grid gap-2.5 md:grid-cols-[130px_minmax(0,1fr)]">
                <input autoFocus={!dlg.empId} value={f.code} onChange={(e) => setF({ code: e.target.value })} onKeyDown={onEnter} placeholder="Mã NV" className={`font-mono ${inputCls}`} />
                <input autoFocus={!!dlg.empId} value={f.name} onChange={(e) => onNameChange(e.target.value)} onKeyDown={onEnter} placeholder="Họ và tên" className={inputCls} />
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                <select value={f.dept} onChange={(e) => onDeptChange(e.target.value)} className={selectCls}>
                  {deptOrder.map((d) => <option key={d}>{d}</option>)}
                </select>
                {/* chỉ hiện vai trò của phòng ban đã chọn (và vai trò đang gán, nếu thuộc phòng ban khác) */}
                <select value={f.role} onChange={(e) => setF({ role: e.target.value })} className={selectCls}>
                  <option value="">— Không phân vai trò —</option>
                  {ROLES.filter((r) => r.dept === f.dept || r.id === f.role).map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                </select>
              </div>
              {/* v6.9 — dự án đang tham gia: nhân sự chỉ thấy và chấm được các dự án này (chưa chọn = chỉ chấm Việc chung / vắng mặt) */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>Dự án đang tham gia <span className="text-slate-600">· {(f.projects || []).length} dự án</span></span>
                  {(f.projects || []).length > 0 && <button onClick={() => setF({ projects: [] })} className="text-slate-500 hover:text-slate-300">Bỏ chọn hết</button>}
                </div>
                <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                  {cfg.projects.filter((p) => p.active || (f.projects || []).includes(p.id)).map((p) => {
                    const on = (f.projects || []).includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => setF({ projects: on ? f.projects.filter((x) => x !== p.id) : [...(f.projects || []), p.id] })}
                        className={`min-h-[36px] rounded-md border px-2.5 text-left text-[13px] ${on ? "border-teal-700 bg-teal-950 text-teal-200" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>
                        {on ? "✓ " : ""}{p.code ? `[${p.code}] ` : ""}{p.name}{!p.active ? " (đã đóng)" : ""}
                      </button>
                    );
                  })}
                </div>
                {(f.projects || []).length === 0 && <div className="mt-1.5 text-xs text-amber-400/80">Chưa giao dự án nào — nhân sự chỉ chấm được Việc chung và vắng mặt.</div>}
              </div>
            </>
          )}
          <div className="grid gap-2.5 md:grid-cols-2">
            <input autoFocus={dlg.kind === "admin"} value={f.username} onChange={(e) => setF({ username: e.target.value }, { autoUser: false })} onKeyDown={onEnter}
              placeholder="Tên đăng nhập" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" className={`font-mono ${inputCls}`} />
            <div className="flex gap-2">
              <input value={f.password} onChange={(e) => setF({ password: e.target.value })} onKeyDown={onEnter}
                placeholder="Mật khẩu" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" className={`min-w-0 flex-1 font-mono ${inputCls}`} />
              <button onClick={() => setF({ password: genPassword() })} title="Sinh mật khẩu" className={sqBtn}><RotateCcw size={15} /></button>
            </div>
          </div>
          {/* v7.3 — cấp quyền. Tài khoản không gắn nhân sự chỉ là BOD hoặc Admin (trưởng phòng cần phòng ban của nhân sự) */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cấp quyền">
            {ACCESS_LEVELS.filter(([k]) => dlg.kind === "emp" || k === "bod" || k === "admin" || (dlg.accId && k === accessOfAcc((accounts || []).find((x) => x.id === dlg.accId)))).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={(f.access || "emp") === k} onClick={() => setF({ access: k })}
                className={`h-11 rounded-md border px-3.5 text-sm ${(f.access || "emp") === k ? "border-teal-700 bg-teal-950 text-teal-200" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>{l}</button>
            ))}
          </div>
          {f.access === "head" && <div className="text-xs text-slate-500">Xem và sửa Bảng công nhân viên phòng {f.dept || "—"}.</div>}
          {f.access === "bod" && <div className="text-xs text-slate-500">Xem mọi mục quản lý (Dashboard, Bảng công, Dự án, Nhân sự, Tác vụ, Thiết lập), không sửa được gì.</div>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button onClick={() => setDlg(null)} className={btnGhost}>Huỷ</button>
          {dlg.kind === "emp" && !dlg.empId && <button onClick={() => saveDlg(true)} disabled={busy} className={`${btnGhost} disabled:opacity-50`}>Lưu và thêm tiếp</button>}
          <button onClick={() => saveDlg(false)} disabled={busy} className={`${btnPrimary} disabled:opacity-50`}>{busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Lưu</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
        {[["emp", "Nhân sự", cfg.employees.length], ["admin", "Tài khoản BOD / Admin", loose.length]].map(([k, l, n]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`h-9 whitespace-nowrap rounded-md px-4 text-sm ${sub === k ? "bg-slate-800 font-medium text-slate-50" : "text-slate-400 hover:text-slate-200"}`}>
            {l}<span className="ml-1.5 font-mono text-xs text-slate-500">{n}</span>
          </button>
        ))}
      </div>

      {sub === "emp" ? empTab : adminTab}
      {formDlg}

      {/* v6.9 (mẫu C) — popover chọn dự án / chép dự án từ người khác */}
      {pp && (() => {
        const e = cfg.employees.find((x) => x.id === pp.eid); if (!e) return null;
        const mine = empProjs(e), kw = norm(pp.q.trim());
        const field = (
          <input autoFocus value={pp.q} onChange={(ev) => setPp({ ...pp, q: ev.target.value })} placeholder={pp.kind === "add" ? "Tìm dự án (gõ không dấu được)" : "Tìm người"}
            className={inputCls} />
        );
        let body;
        if (pp.kind === "add") {
          const list = cfg.projects.filter((p) => (p.active || mine.includes(p.id)) && (!kw || norm(`${p.code || ""} ${p.name} ${p.client || ""}`).includes(kw)));
          body = list.length ? list.map((p) => { const on = mine.includes(p.id);
            return (
              <button key={p.id} onClick={() => setEmpProjs(e.id, on ? mine.filter((x) => x !== p.id) : [...mine, p.id])}
                className="flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-slate-200 hover:bg-slate-800">
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-600"}`}>{on && <Check size={12} />}</span>
                {projLabel(p)}{!p.active && <span className="text-xs text-slate-500">(đã đóng)</span>}
              </button>
            ); }) : <div className="px-3 py-3 text-sm text-slate-500">Không có dự án khớp.</div>;
        } else {
          const list = cfg.employees.filter((x) => x.id !== e.id && empProjs(x).length && (!kw || norm(`${x.name} ${x.code || ""}`).includes(kw)));
          body = list.length ? list.map((x) => (
            <button key={x.id} onClick={() => { setEmpProjs(e.id, [...empProjs(x)]); setPp(null); flash(`Đã chép ${empProjs(x).length} dự án từ ${x.name} cho ${e.name}.`); }}
              className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-slate-800">
              <div className="text-sm text-slate-200">{x.name}</div>
              <div className="text-xs text-slate-500">{empProjs(x).map((pid) => projLabel(cfg.projects.find((p) => p.id === pid))).join(", ")}</div>
            </button>
          )) : <div className="px-3 py-3 text-sm text-slate-500">Chưa có ai được giao dự án.</div>;
        }
        const below = pp.y + 380 < window.innerHeight;
        return (
          <div onClick={(ev) => ev.stopPropagation()} className="fixed z-50 w-[320px] rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-2xl"
            style={below ? { left: pp.x, top: pp.y } : { left: pp.x, bottom: window.innerHeight - pp.top + 6 }}>
            {pp.kind === "copy" && <div className="px-2.5 pb-1 pt-1.5 text-[11px] uppercase tracking-wider text-slate-500">Chép dự án từ người khác → {e.name}</div>}
            <div className="p-1">{field}</div>
            <div className="max-h-72 overflow-y-auto">{body}</div>
            {pp.kind === "add" && <div className="flex justify-end p-1"><button onClick={() => setPp(null)} className={`${btnPrimary} h-9`}>Xong</button></div>}
          </div>
        );
      })()}

      <ConfirmDialog
        open={!!pendingDel}
        title={`Xoá nhân sự ${pendingDel?.name || ""}?`}
        desc="Tài khoản đăng nhập của người này cũng bị xoá. Giờ công đã chấm vẫn còn trong dữ liệu nhưng báo cáo sẽ hiển thị là (đã xoá). Nhân sự nghỉ việc thì nên khoá tài khoản thay vì xoá."
        confirmLabel="Xoá nhân sự"
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
      <ConfirmDialog
        open={!!pendingAcc}
        title={`Xoá tài khoản ${pendingAcc?.username || ""}?`}
        desc="Tài khoản này sẽ không đăng nhập được nữa."
        confirmLabel="Xoá tài khoản"
        onConfirm={confirmDelAcc}
        onCancel={() => setPendingAcc(null)}
      />
    </div>
  );
}


/* ============================ HẠNG MỤC ============================ */
/* v6.6 — giờ đã chấm (trong phần bảng công đang tải) vào các tác vụ ids, tính cả dòng tăng ca cho các tác vụ đó */
const hoursOfTasks = (ids) => {
  const set = new Set(ids); let h = 0;
  for (const b of Object.values(DB?.ts || {})) for (const r of Array.isArray(b?.rows) ? b.rows : [])
    if (set.has(r.taskId) || (r.otFor && set.has(r.otFor))) for (const v of Object.values(r.days || {})) h += Number(v) || 0;
  return h;
};
/* Xoá hẳn giờ của các tác vụ ids trên server rồi kéo bản mới về. Trả về số giờ đã xoá, hoặc null nếu lỗi. */
const purgeTaskHours = async (ids, flash) => {
  if (!ids.length) return 0;
  try {
    const r = await purgeTasks(ids);
    await pullTs();
    return Number(r?.hours) || 0;
  } catch (e) {
    flash(`Đã xoá tác vụ nhưng chưa xoá được giờ đã chấm — ${e.message}. Chạy lại schema.sql (v6.6) rồi dùng nút "Xoá hẳn" ở tab Tác vụ.`, "err");
    return null;
  }
};

function Tasks({ cfg, saveCfg, flash }) {
  const [sub, setSub] = useState("task");               // tab con: task | org | leave
  const [sel, setSel] = useState("");                   // ô tác vụ đang chọn: "r:<mã vai trò>" hoặc "shared"
  const [q, setQ] = useState("");                       // ô tìm vai trò
  const [drafts, setDrafts] = useState({});
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDesc, setEditDesc] = useState("");          // v4.4: mô tả ngắn của tác vụ
  const [dragTask, setDragTask] = useState(null);        // v4.4: id tác vụ đang kéo để đổi thứ tự (chỉ máy tính)
  const [dropAt, setDropAt] = useState(null);            // { id, after } — chỗ sẽ thả: trước/sau tác vụ id
  const [pendingDel, setPendingDel] = useState(null);
  const [orphans, setOrphans] = useState(null);   // v6.6: { taskId: giờ } của tác vụ đã xoá trước đây
  const [purgeAsk, setPurgeAsk] = useState(false);
  useEffect(() => { let alive = true; fetchOrphanTasks().then((o) => { if (alive) setOrphans(o); }).catch(() => {}); return () => { alive = false; }; }, [cfg.tasks]);
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDept, setRoleDept] = useState(DEPTS[0]);
  const [pendingRoleDel, setPendingRoleDel] = useState(null);
  const [leaveName, setLeaveName] = useState("");
  const [leaveEditId, setLeaveEditId] = useState(null);
  const [leaveEditName, setLeaveEditName] = useState("");
  const [pendingLeaveDel, setPendingLeaveDel] = useState(null);
  const [deptName, setDeptName] = useState("");
  /* Sửa tại chỗ ở tab Phòng ban & vai trò: { kind: "dept" | "role" | "code", key, value }.
     Giữ thêm một bản trong ref để Enter và sự kiện rời ô (blur) không lưu hai lần. */
  const [edit, setEditState] = useState(null);
  const editRef = useRef(null);
  const setEdit = (v) => { editRef.current = v; setEditState(v); };
  const [drag, setDrag] = useState(null);               // vai trò đang được kéo: { id, x, y, w }
  const [overDept, setOverDept] = useState(null);       // dòng phòng ban đang được nhắm để thả
  const press = useRef(null);
  const lastCodeTap = useRef({ id: "", at: 0 });
  const depts = cfg.depts || DEFAULT_DEPTS;
  const LOCKED_DEPT = DEPTS_SEE_ALL[0];                 // Ban giám đốc: cố định
  const roles = cfg.roles || [];
  const leaves = cfg.leaveTypes || [];

  /* Một "ô" là một chủ sở hữu tác vụ: một vai trò, hoặc dùng chung.
     Khoá dạng "r:ARC" / "shared" để một select duy nhất chuyển tác vụ đi đâu cũng được. */
  const SHARED = "shared";
  const boxes = [
    ...roles.map((r) => ({ key: `r:${r.id}`, kind: "role", id: r.id, title: `${r.id} · ${r.name}` })),
    { key: SHARED, kind: "shared", id: "", title: "Dùng chung" },
  ];
  const ownerOf = (t) => {
    const rs = taskRoles(t);
    return rs.length ? `r:${rs[0]}` : SHARED;
  };
  const patchFor = (key) => {
    if (key === SHARED) return { roles: [], depts: [], group: "Chung" };
    const id = key.slice(2);
    return { roles: [id], depts: [], group: roleInfo(id)?.dept || "Thiết kế" };
  };
  const listOf = (key) => cfg.tasks.filter((t) => ownerOf(t) === key);
  // phòng ban theo thứ tự khai báo; vai trò mang tên phòng ban lạ (dữ liệu cũ) xếp cuối để không bị mất dấu
  const deptOrder = [...depts, ...roles.map((r) => r.dept).filter((d, i, a) => !depts.includes(d) && a.indexOf(d) === i)];
  const cur = boxes.some((b) => b.key === sel) ? sel : boxes[0].key;   // vai trò đang chọn bị xoá thì về ô đầu
  const curRole = cur === SHARED ? null : roles.find((r) => `r:${r.id}` === cur);

  const setDraft = (k, v) => setDrafts((x) => ({ ...x, [k]: v }));

  const add = async (key) => {
    const nm = (drafts[key] || "").trim();
    if (!nm) return;
    if (isOtTask({ name: nm })) return flash("Tăng ca không còn là tác vụ — cài khung giờ và hệ số ở Thiết lập → Tăng ca.", "err");   // v6.3
    if (listOf(key).some((t) => t.name.toLowerCase() === nm.toLowerCase())) return flash("Ô này đã có tác vụ trùng tên.", "err");
    const ok = await saveCfg({ ...cfg, tasks: [...cfg.tasks, { id: uid("t"), name: nm, ...patchFor(key) }] });
    if (ok !== false) setDraft(key, "");
  };

  const commit = async () => {
    if (!editName.trim()) return flash("Tên tác vụ không được để trống.", "err");
    if (isOtTask({ name: editName })) return flash("Tăng ca không còn là tác vụ — cài khung giờ và hệ số ở Thiết lập → Tăng ca.", "err");   // v6.3
    const desc = editDesc.trim();
    await saveCfg({ ...cfg, tasks: cfg.tasks.map((t) => {
      if (t.id !== editId) return t;
      const { desc: _old, ...rest } = t;                  // mô tả rỗng thì bỏ hẳn trường, không lưu chuỗi trống
      return { ...rest, name: editName.trim(), ...(isIdleTask(t.id) ? {} : patchFor(editOwner)), ...(desc ? { desc } : {}) };   // v7.2: Chờ việc luôn dùng chung
    }) });
    setEditId(null);
  };
  const startEdit = (t) => { setEditId(t.id); setEditName(t.name); setEditOwner(ownerOf(t)); setEditDesc(t.desc || ""); };

  const confirmDel = async () => {
    const t = pendingDel; setPendingDel(null);
    if (!t) return;
    const ok = await saveCfg({ ...cfg, tasks: cfg.tasks.filter((x) => x.id !== t.id) });
    if (ok === false) return;
    const h = await purgeTaskHours([t.id], flash);   // v6.6: tác vụ đã xoá không còn xuất hiện ở đâu nữa
    if (h !== null) flash(h > 0 ? `Đã xoá tác vụ và ${fmtH(h)} h đã chấm vào tác vụ này.` : "Đã xoá tác vụ.");
  };

  /* v4.4 — Đổi thứ tự tác vụ bằng kéo thả. Chỉ sắp lại các tác vụ của ô đang xem; trong mảng cfg.tasks chúng được đặt lại
     đúng vào các vị trí cũ của chính chúng, nên tác vụ của vai trò khác không xê dịch. Màn Chấm công hiện theo thứ tự này. */
  const moveTask = async (fromId, toId, after) => {
    if (!fromId || fromId === toId) return;
    const list = listOf(cur);
    const moving = list.find((t) => t.id === fromId);
    if (!moving) return;
    const rest = list.filter((t) => t.id !== fromId);
    let at = rest.findIndex((t) => t.id === toId);
    if (at < 0) return;
    if (after) at += 1;
    const order = [...rest.slice(0, at), moving, ...rest.slice(at)];
    if (order.every((t, k) => t.id === list[k].id)) return;   // thả về đúng chỗ cũ
    const mine = new Set(list.map((t) => t.id));
    let k = 0;
    await saveCfg({ ...cfg, tasks: cfg.tasks.map((t) => (mine.has(t.id) ? order[k++] : t)) });
  };
  const endDrag = () => { setDragTask(null); setDropAt(null); };

  const ROLE_CODE_RE = /^[A-Z0-9_-]{1,8}$/;
  const ROLE_CODE_MSG = "Mã vai trò chỉ gồm chữ không dấu, số, - hoặc _, tối đa 8 ký tự.";
  const addRole = async () => {
    const id = roleCode.trim().toUpperCase();
    const name = roleName.trim();
    if (!id || !name) return flash("Nhập mã và tên vai trò.", "err");
    if (!ROLE_CODE_RE.test(id)) return flash(ROLE_CODE_MSG, "err");
    if (roles.some((r) => r.id === id)) return flash("Mã vai trò này đã có.", "err");
    const ok = await saveCfg({ ...cfg, roles: [...roles, { id, name, dept: depts.includes(roleDept) ? roleDept : depts[0] }] });
    if (ok !== false) { setRoleCode(""); setRoleName(""); flash("Đã thêm vai trò."); }
  };

  /* Xoá vai trò thì xoá luôn tác vụ của vai trò đó (không còn tác vụ cấp bộ phận để chuyển về).
     Nhân sự đang giữ vai trò đó thành "không phân vai trò", chỉ thấy tác vụ dùng chung.
     Giờ công đã chấm vẫn giữ nguyên, báo cáo hiển thị là (tác vụ đã xoá). */
  const confirmDelRole = async () => {
    const r = pendingRoleDel; setPendingRoleDel(null);
    if (!r) return;
    const goneIds = cfg.tasks.filter((t) => taskRoles(t).length === 1 && taskRoles(t)[0] === r.id).map((t) => t.id);
    const ok = await saveCfg({
      ...cfg,
      roles: roles.filter((x) => x.id !== r.id),
      tasks: cfg.tasks.flatMap((t) => {
        if (!taskRoles(t).includes(r.id)) return [t];
        const left = taskRoles(t).filter((x) => x !== r.id);
        return left.length ? [{ ...t, roles: left }] : [];
      }),
      employees: cfg.employees.map((e) => (e.role === r.id ? { ...e, role: "" } : e)),
    });
    if (ok === false) return;
    const h = await purgeTaskHours(goneIds, flash);   // v6.6
    if (h !== null) flash(h > 0 ? `Đã xoá vai trò, ${goneIds.length} tác vụ và ${fmtH(h)} h đã chấm vào các tác vụ đó.` : "Đã xoá vai trò.");
  };
  const addDept = async () => {
    const name = deptName.trim();
    if (!name) return flash("Nhập tên phòng ban.", "err");
    if (depts.some((d) => d.toLowerCase() === name.toLowerCase())) return flash("Phòng ban này đã có.", "err");
    const ok = await saveCfg({ ...cfg, depts: [...depts, name] });
    if (ok !== false) { setDeptName(""); flash("Đã thêm phòng ban."); }
  };
  const delDept = async (d) => {
    const ne = cfg.employees.filter((e) => e.dept === d).length;
    const nr = roles.filter((r) => r.dept === d).length;
    if (ne || nr) return flash(`Không xoá được: còn ${ne} nhân sự và ${nr} vai trò thuộc "${d}". Chuyển họ sang phòng ban khác trước.`, "err");
    await saveCfg({ ...cfg, depts: depts.filter((x) => x !== d) });
    flash("Đã xoá phòng ban.");
  };

  /* ---- sửa tại chỗ: mỗi hàm trả về thông điệp lỗi, hoặc cấu hình mới cần lưu, hoặc null nếu không đổi gì ---- */
  /* Đổi tên phòng ban: nhân sự, vai trò và nhóm tác vụ đang mang tên cũ đổi theo để dữ liệu không lệch. */
  const renameDept = (old, raw) => {
    const name = raw.trim();
    if (!name) return "Tên phòng ban không được để trống.";
    if (name === old) return null;
    if (depts.some((d) => d !== old && d.toLowerCase() === name.toLowerCase())) return "Phòng ban này đã có.";
    return {
      ...cfg,
      depts: depts.map((d) => (d === old ? name : d)),
      employees: cfg.employees.map((e) => (e.dept === old ? { ...e, dept: name } : e)),
      roles: roles.map((r) => (r.dept === old ? { ...r, dept: name } : r)),
      tasks: cfg.tasks.map((t) => ({ ...t, group: t.group === old ? name : t.group, depts: Array.isArray(t.depts) ? t.depts.map((d) => (d === old ? name : d)) : t.depts })),
    };
  };
  const renameRole = (id, raw) => {
    const name = raw.trim();
    if (!name) return "Tên vai trò không được để trống.";
    if (roles.find((r) => r.id === id)?.name === name) return null;
    return { ...cfg, roles: roles.map((r) => (r.id === id ? { ...r, name } : r)) };
  };
  /* Đổi mã vai trò: nhân sự và tác vụ tham chiếu vai trò bằng mã, nên phải đổi theo ở cả hai nơi. */
  const recodeRole = (old, raw) => {
    const id = raw.trim().toUpperCase();
    if (!id) return "Mã vai trò không được để trống.";
    if (id === old) return null;
    if (!ROLE_CODE_RE.test(id)) return ROLE_CODE_MSG;
    if (roles.some((r) => r.id === id)) return "Mã vai trò này đã có.";
    return {
      ...cfg,
      roles: roles.map((r) => (r.id === old ? { ...r, id } : r)),
      tasks: cfg.tasks.map((t) => (taskRoles(t).includes(old) ? { ...t, roles: taskRoles(t).map((x) => (x === old ? id : x)) } : t)),
      employees: cfg.employees.map((e) => (e.role === old ? { ...e, role: id } : e)),
    };
  };
  /* Enter: sai thì báo lỗi và ở lại ô đang sửa. Rời ô (blur): hợp lệ thì lưu, sai thì giữ giá trị cũ. */
  const commitEdit = async (fromBlur) => {
    const e = editRef.current;
    if (!e) return;
    const next = e.kind === "dept" ? renameDept(e.key, e.value) : e.kind === "role" ? renameRole(e.key, e.value) : recodeRole(e.key, e.value);
    if (typeof next === "string") {
      if (fromBlur) setEdit(null);
      if (!fromBlur || e.value.trim()) flash(next, "err");
      return;
    }
    setEdit(null);
    if (!next) return;
    const ok = await saveCfg(next);
    if (ok !== false && e.kind === "code" && cur === `r:${e.key}`) setSel(`r:${e.value.trim().toUpperCase()}`);
  };
  const editInput = (cls, extra = {}) => (
    <input autoFocus value={edit.value} onFocus={(x) => x.target.select()}
      onChange={(x) => setEdit({ ...edit, value: x.target.value })}
      onKeyDown={(x) => { if (x.key === "Enter") commitEdit(false); if (x.key === "Escape") setEdit(null); }}
      onBlur={() => commitEdit(true)}
      className={`h-7 rounded border border-teal-700 bg-slate-900 px-2 text-xs text-slate-100 focus:outline-none ${cls}`} {...extra} />
  );

  /* Chuyển vai trò sang phòng ban khác: nhóm của các tác vụ thuộc vai trò đó đổi theo. */
  const moveRole = async (id, dept) => {
    const r = roles.find((x) => x.id === id);
    if (!r || r.dept === dept) return;
    const ok = await saveCfg({
      ...cfg,
      roles: roles.map((x) => (x.id === id ? { ...x, dept } : x)),
      tasks: cfg.tasks.map((t) => (taskRoles(t)[0] === id ? { ...t, group: dept } : t)),
    });
    if (ok !== false) flash(`Đã chuyển ${id} sang ${dept}.`);
  };
  /* Một lần nhấn trên chip vai trò: nhích quá 6px là kéo (chỉ bằng chuột), không nhích là bấm.
     Bấm vào tên -> sửa tên. Bấm đúp vào mã -> sửa mã. */
  const deptAt = (x, y) => document.elementFromPoint(x, y)?.closest("[data-dept-row]")?.getAttribute("data-dept-row") || null;
  const onChipDown = (ev, r) => {
    if (ev.button !== 0 || ev.target.closest("button")) return;
    const box = ev.currentTarget.getBoundingClientRect();
    const p = { id: r.id, onCode: !!ev.target.closest("[data-role-code]"), mouse: ev.pointerType !== "touch", x0: ev.clientX, y0: ev.clientY, dx: ev.clientX - box.left, dy: ev.clientY - box.top, w: box.width, moved: false };
    press.current = p;
    const move = (e) => {
      if (!p.moved) {
        if (!p.mouse || Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) return;
        p.moved = true;
      }
      setDrag({ id: p.id, x: e.clientX - p.dx, y: e.clientY - p.dy, w: p.w });
      setOverDept(deptAt(e.clientX, e.clientY));
    };
    const stop = (e, cancelled) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      press.current = null; setDrag(null); setOverDept(null);
      if (cancelled) return;
      if (p.moved) { const d = deptAt(e.clientX, e.clientY); if (d) moveRole(p.id, d); return; }
      if (!p.onCode) { setEdit({ kind: "role", key: r.id, value: r.name }); return; }
      const now = Date.now(), last = lastCodeTap.current;
      if (last.id === r.id && now - last.at < 400) { lastCodeTap.current = { id: "", at: 0 }; setEdit({ kind: "code", key: r.id, value: r.id }); }
      else lastCodeTap.current = { id: r.id, at: now };
    };
    const up = (e) => stop(e, false);
    const cancel = (e) => stop(e, true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };
  const dragRole = drag ? roles.find((r) => r.id === drag.id) : null;

  const addLeave = async () => {
    const name = leaveName.trim();
    if (!name) return flash("Nhập tên loại nghỉ.", "err");
    if (leaves.some((x) => x.label.toLowerCase() === name.toLowerCase())) return flash("Loại nghỉ này đã có.", "err");
    const id = "x" + Date.now().toString(36);
    const ok = await saveCfg({ ...cfg, leaveTypes: [...leaves, { id, label: name, short: leaveShort(name), cls: LEAVE_PALETTE[leaves.length % LEAVE_PALETTE.length] }] });
    if (ok !== false) { setLeaveName(""); flash("Đã thêm loại nghỉ."); }
  };
  const commitLeave = async () => {
    const name = leaveEditName.trim();
    if (!name) return flash("Tên loại nghỉ không được để trống.", "err");
    if (leaves.some((x) => x.id !== leaveEditId && x.label.toLowerCase() === name.toLowerCase())) return flash("Loại nghỉ này đã có.", "err");
    const ok = await saveCfg({ ...cfg, leaveTypes: leaves.map((x) => (x.id === leaveEditId ? { ...x, label: name, short: leaveShort(name) } : x)) });
    if (ok !== false) { setLeaveEditId(null); flash("Đã đổi tên loại nghỉ."); }
  };
  const confirmDelLeave = async () => {
    const t = pendingLeaveDel; setPendingLeaveDel(null);
    if (!t) return;
    await saveCfg({ ...cfg, leaveTypes: leaves.filter((x) => x.id !== t.id) });
    flash("Đã xoá loại nghỉ.");
  };
  const delRoleTaskCount = pendingRoleDel ? cfg.tasks.filter((t) => taskRoles(t).length === 1 && taskRoles(t)[0] === pendingRoleDel.id).length : 0;
  const delRoleEmpCount = pendingRoleDel ? cfg.employees.filter((e) => e.role === pendingRoleDel.id).length : 0;

  const panelCls = "rounded-xl border border-slate-800 bg-slate-900";
  const chipCls = "inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 py-1 pl-3 pr-1 text-sm text-slate-300";
  const miniDel = "rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400";
  // nút vuông 44px đứng cạnh ô nhập (iconBtn cao 36px nên lệch hàng với ô nhập 44px)
  const sqBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100";

  /* ---------------- tab con Tác vụ: trái = vai trò gom theo phòng ban, phải = tác vụ của vai trò đang chọn ---------------- */
  const kw = norm(q.trim());
  const roleHit = (r) => !kw || norm(`${r.id} ${r.name} ${r.dept}`).includes(kw);
  const roleGroups = deptOrder.map((d) => ({ dept: d, list: roles.filter((r) => r.dept === d && roleHit(r)) })).filter((g) => g.list.length);
  const showShared = !kw || norm("dùng chung").includes(kw);
  const roleBtn = (key, code, name) => {
    const n = listOf(key).length;
    const on = cur === key;
    return (
      <button key={key} onClick={() => { setSel(key); setEditId(null); }}
        className={`relative flex min-h-[40px] w-full items-center gap-2 rounded-md pl-3.5 pr-2.5 text-left text-sm ${on ? "bg-slate-800 text-slate-100" : "text-slate-300 hover:bg-slate-800"}`}>
        {on && <span className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-full bg-teal-400" />}
        <span className="w-12 shrink-0 font-mono text-xs text-teal-400">{code}</span>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className={`shrink-0 font-mono text-xs ${n ? "text-slate-400" : "text-slate-600"}`}>{n}</span>
      </button>
    );
  };
  const groupHead = (label, n) => (
    <div className="sticky top-0 z-10 mt-3 flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-[#1a2740] px-2.5 py-2 text-xs uppercase tracking-wider text-slate-100 first:mt-0">
      <span className="min-w-0 truncate">{label}</span>
      {n != null && <span className="shrink-0 font-mono tracking-normal text-slate-400">{n}</span>}
    </div>
  );
  const curList = listOf(cur);
  const taskTab = (
    <div className="grid items-start gap-3 md:grid-cols-[300px_minmax(0,1fr)] md:gap-4">
      <div className={`hidden p-3 md:block ${panelCls}`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm vai trò" className={inputCls} />
        <div className="mt-2 flex max-h-[68vh] flex-col gap-0.5 overflow-y-auto">
          {roleGroups.map((g) => (
            <React.Fragment key={g.dept}>
              {groupHead(g.dept, g.list.length)}
              {g.list.map((r) => roleBtn(`r:${r.id}`, r.id, r.name))}
            </React.Fragment>
          ))}
          {showShared && <>{groupHead("Mọi vai trò", null)}{roleBtn(SHARED, "", "Dùng chung")}</>}
          {!roleGroups.length && !showShared && <div className="px-2 py-4 text-sm text-slate-500">Không có vai trò khớp.</div>}
        </div>
      </div>

      <div className={`min-w-0 ${panelCls}`}>
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-3 py-3 md:px-4">
          <h3 className="min-w-0 truncate text-sm font-medium text-slate-100">
            {curRole ? <><span className="font-mono text-xs text-teal-400">{curRole.id}</span> · {curRole.name}</> : "Dùng chung"}
          </h3>
          <span className="shrink-0 text-xs text-slate-500">{curRole ? curRole.dept : "Mọi vai trò"}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-slate-500">{curList.length}</span>
        </div>
        <div className="p-3 md:p-4">
          {/* mobile: cột vai trò thu thành một ô chọn */}
          <select value={cur} onChange={(e) => { setSel(e.target.value); setEditId(null); }} className={`mb-3 md:hidden ${selectCls}`}>
            {deptOrder.map((d) => {
              const rs = roles.filter((r) => r.dept === d);
              return rs.length ? (
                <optgroup key={d} label={d}>
                  {rs.map((r) => <option key={r.id} value={`r:${r.id}`}>{r.id} · {r.name} ({listOf(`r:${r.id}`).length})</option>)}
                </optgroup>
              ) : null;
            })}
            <option value={SHARED}>Dùng chung ({listOf(SHARED).length})</option>
          </select>
          <div className="flex gap-2">
            <input value={drafts[cur] || ""} onChange={(e) => setDraft(cur, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add(cur)}
              placeholder="Thêm tác vụ rồi Enter" className={`min-w-0 flex-1 ${inputCls}`} />
            <button onClick={() => add(cur)} className={`${sqBtn}`}><Plus size={15} /></button>
          </div>

          {curList.length === 0 ? <div className="px-1 pt-4 text-sm text-slate-500">Chưa có tác vụ.</div> : (
            <div className="mt-2 divide-y divide-slate-800">
              {curList.map((t) => (
                <div key={t.id}
                  draggable={!isIdleTask(t.id) && editId !== t.id && curList.length > 1}
                  onDragStart={(e) => { setDragTask(t.id); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", t.id); } catch { /* bỏ qua */ } }}
                  onDragOver={(e) => {
                    if (!dragTask || isIdleTask(t.id)) return;   // v7.2: Chờ việc luôn đứng đầu
                    e.preventDefault();
                    const b = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > b.top + b.height / 2;
                    if (dropAt?.id !== t.id || dropAt?.after !== after) setDropAt({ id: t.id, after });
                  }}
                  onDrop={(e) => { e.preventDefault(); const d = dropAt; const from = dragTask; endDrag(); if (d) moveTask(from, d.id, d.after); }}
                  onDragEnd={endDrag}
                  className={`relative py-2 text-sm ${dragTask === t.id ? "opacity-40" : ""}`}>
                  {dragTask && dropAt?.id === t.id && dragTask !== t.id && (
                    <div className={`pointer-events-none absolute left-0 right-0 h-0.5 rounded-full bg-teal-400 ${dropAt.after ? "-bottom-px" : "-top-px"}`} />
                  )}
                  {editId === t.id ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2 md:flex-row">
                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditId(null); }} className={`min-w-0 md:flex-1 ${inputCls}`} />
                        <div className="flex gap-2">
                          {!isIdleTask(t.id) && (
                          <select value={editOwner} onChange={(e) => setEditOwner(e.target.value)} className={`min-w-0 flex-1 md:w-56 md:flex-none ${selectCls}`}>
                            {boxes.map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
                          </select>
                          )}
                          <button onClick={commit} className={`${sqBtn} border-teal-800 text-teal-400`}><Check size={15} /></button>
                          <button onClick={() => setEditId(null)} className={`${sqBtn}`}><X size={15} /></button>
                        </div>
                      </div>
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={200}
                        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditId(null); }}
                        placeholder="Mô tả" className={inputCls} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      {curList.length > 1 && !isIdleTask(t.id) && (
                        <span className="-ml-1 hidden shrink-0 cursor-grab text-slate-600 hover:text-slate-300 active:cursor-grabbing md:block" title="Kéo để đổi thứ tự">
                          <GripVertical size={15} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline gap-1.5">
                          {t.code && <span className="shrink-0 font-mono text-[10px] text-teal-500">{t.code}</span>}
                          <span className="min-w-0 text-slate-200">{t.name}</span>
                          {isIdleTask(t.id) && <span className="shrink-0 rounded border border-slate-600 px-1.5 text-[10px] text-slate-400">không tính tải</span>}
                        </div>
                        {t.desc && <div className="mt-0.5 text-xs text-slate-500">{t.desc}</div>}
                      </div>
                      {isIdleTask(t.id) ? (
                        /* v7.2: tác vụ hệ thống — đổi được tên / mô tả, không xoá, không kéo đổi chỗ */
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="flex h-8 w-8 items-center justify-center text-slate-600" title="Tác vụ hệ thống — không xoá, không đổi chỗ"><Lock size={13} /></span>
                          <button onClick={() => startEdit(t)} className={iconBtn} title="Đổi tên / mô tả"><Pencil size={13} /></button>
                        </div>
                      ) : (
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={() => startEdit(t)} className={iconBtn}><Pencil size={13} /></button>
                        <button onClick={() => setPendingDel(t)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={13} /></button>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ---------------- tab con Phòng ban & vai trò ---------------- */
  const orgTab = (
    <div className="space-y-3 md:space-y-4">
      <div className={panelCls}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-3 md:px-4">
          <h3 className="text-sm font-medium text-slate-100">Phòng ban</h3>
          <span className="shrink-0 font-mono text-xs text-slate-500">{depts.length}</span>
        </div>
        <div className="p-3 md:p-4">
          <div className="flex gap-2">
            <input value={deptName} onChange={(e) => setDeptName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDept()}
              placeholder="Thêm phòng ban rồi Enter" className={`min-w-0 flex-1 ${inputCls}`} />
            <button onClick={addDept} className={`${sqBtn}`}><Plus size={15} /></button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {depts.map((d) => edit?.kind === "dept" && edit.key === d ? (
              <span key={d} className={`${chipCls} border-teal-800 pl-1`}>{editInput("w-48 max-w-[60vw]")}</span>
            ) : d === LOCKED_DEPT ? (
              <span key={d} className={chipCls}>{d}<span title="Cố định: quyết định quyền xem toàn bộ tác vụ" className="p-1.5 text-slate-600"><Lock size={13} /></span></span>
            ) : (
              <span key={d} onClick={(e) => { if (!e.target.closest("button")) setEdit({ kind: "dept", key: d, value: d }); }}
                className={`${chipCls} cursor-text hover:border-slate-500`}>
                {d}
                <button onClick={() => delDept(d)} title="Xoá phòng ban" className={miniDel}><Trash2 size={13} /></button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={panelCls}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-3 md:px-4">
          <h3 className="text-sm font-medium text-slate-100">Vai trò</h3>
          <span className="shrink-0 font-mono text-xs text-slate-500">{roles.length}</span>
        </div>
        <div className="p-3 md:p-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <input value={roleCode} onChange={(e) => setRoleCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()}
              placeholder="Mã, ví dụ MEP" maxLength={8} className={`font-mono md:w-40 ${inputCls}`} />
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()}
              placeholder="Tên vai trò" className={`min-w-0 md:flex-1 ${inputCls}`} />
            <select value={roleDept} onChange={(e) => setRoleDept(e.target.value)} className={`md:w-56 ${selectCls}`}>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button onClick={addRole} className={`shrink-0 whitespace-nowrap ${btnPrimary}`}><Plus size={14} /> Thêm vai trò</button>
          </div>

          {/* mỗi phòng ban một dòng, kể cả phòng ban chưa có vai trò — để có chỗ thả vai trò vào */}
          <div className="mt-3 divide-y divide-slate-800">
            {deptOrder.map((d) => (
              <div key={d} data-dept-row={d}
                className={`grid gap-1.5 rounded-md px-2 py-2.5 md:grid-cols-[180px_minmax(0,1fr)] md:gap-3 ${overDept === d ? "bg-teal-950 ring-1 ring-inset ring-teal-800" : ""}`}>
                <div className="text-xs uppercase tracking-wider text-slate-400 md:pt-2.5">{d}</div>
                <div className="flex min-h-[36px] flex-wrap gap-2">
                  {roles.filter((r) => r.dept === d).map((r) => edit?.kind === "role" && edit.key === r.id ? (
                    <span key={r.id} className={`${chipCls} border-teal-800`}>
                      <span className="font-mono text-xs text-teal-400">{r.id}</span>{editInput("w-44 max-w-[50vw]")}
                    </span>
                  ) : edit?.kind === "code" && edit.key === r.id ? (
                    <span key={r.id} className={`${chipCls} border-teal-800 pl-1 pr-3`}>
                      {editInput("w-24 font-mono uppercase text-teal-400", { maxLength: 8 })}{r.name}
                    </span>
                  ) : (
                    <span key={r.id} onPointerDown={(e) => onChipDown(e, r)}
                      className={`${chipCls} cursor-grab select-none hover:border-slate-500 ${drag?.id === r.id ? "opacity-30" : ""}`}>
                      <span data-role-code className="font-mono text-xs text-teal-400">{r.id}</span>
                      <span className="min-w-0">{r.name}</span>
                      <button onClick={() => setPendingRoleDel(r)} title="Xoá vai trò" className={miniDel}><Trash2 size={13} /></button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bóng của vai trò đang kéo, bám theo con trỏ */}
      {drag && dragRole && (
        <span style={{ left: drag.x, top: drag.y, width: drag.w }}
          className={`${chipCls} pointer-events-none fixed z-50 cursor-grabbing border-teal-400 shadow-2xl`}>
          <span className="font-mono text-xs text-teal-400">{dragRole.id}</span>
          <span className="min-w-0 truncate">{dragRole.name}</span>
        </span>
      )}
    </div>
  );

  /* ---------------- tab con Vắng mặt ---------------- */
  const leaveTab = (
    <div className={panelCls}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-3 md:px-4">
        <h3 className="text-sm font-medium text-slate-100">Vắng mặt</h3>
        <span className="shrink-0 font-mono text-xs text-slate-500">{leaves.length}</span>
      </div>
      <div className="p-3 md:p-4">
        <div className="flex gap-2">
          <input value={leaveName} onChange={(e) => setLeaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLeave()}
            placeholder="Thêm loại nghỉ rồi Enter" className={`min-w-0 flex-1 ${inputCls}`} />
          <button onClick={addLeave} className={`${sqBtn}`}><Plus size={15} /></button>
        </div>
        {leaves.length > 0 && (
          <div className="mt-2 divide-y divide-slate-800">
            {leaves.map((x) => (
              <div key={x.id} className="py-2 text-sm">
                {leaveEditId === x.id ? (
                  <div className="flex gap-2">
                    <input autoFocus value={leaveEditName} onChange={(e) => setLeaveEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitLeave(); if (e.key === "Escape") setLeaveEditId(null); }} className={`min-w-0 flex-1 ${inputCls}`} />
                    <button onClick={commitLeave} className={`${sqBtn} border-teal-800 text-teal-400`}><Check size={15} /></button>
                    <button onClick={() => setLeaveEditId(null)} className={`${sqBtn}`}><X size={15} /></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-slate-200">{x.label}</span>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => { setLeaveEditId(x.id); setLeaveEditName(x.label); }} className={iconBtn}><Pencil size={13} /></button>
                      <button onClick={() => setPendingLeaveDel(x)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`space-y-3 md:space-y-4 ${drag ? "cursor-grabbing select-none" : ""}`}>
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
        {[["task", "Tác vụ"], ["org", "Phòng ban & vai trò"], ["leave", "Vắng mặt"]].map(([k, l]) => (
          <button key={k} onClick={() => { setSub(k); setEdit(null); setEditId(null); setLeaveEditId(null); }}
            className={`h-9 whitespace-nowrap rounded-md px-4 text-sm ${sub === k ? "bg-slate-800 font-medium text-slate-50" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
        ))}
      </div>

      {sub === "task" && orphans && Object.keys(orphans).length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-900/70 bg-amber-950/20 px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-amber-400" />
          <span className="min-w-0 flex-1 text-sm text-amber-200">
            Còn {fmtH(Object.values(orphans).reduce((a, h) => a + Number(h || 0), 0))} h chấm vào {Object.keys(orphans).length} tác vụ đã xoá trước đây
            — đang hiện là "(tác vụ đã xoá)" và vẫn cộng vào tổng giờ dự án.
          </span>
          <button onClick={() => setPurgeAsk(true)} className={btnDanger}><Trash2 size={14} /> Xoá hẳn</button>
        </div>
      )}

      {sub === "task" ? taskTab : sub === "org" ? orgTab : leaveTab}

      <ConfirmDialog
        open={purgeAsk}
        title="Xoá hẳn giờ của các tác vụ đã xoá?"
        desc={`Xoá ${fmtH(Object.values(orphans || {}).reduce((a, h) => a + Number(h || 0), 0))} h đã chấm vào ${Object.keys(orphans || {}).length} tác vụ không còn tồn tại, trên toàn bộ bảng công. Tổng giờ dự án và giờ của nhân sự liên quan giảm tương ứng. Không khôi phục được.`}
        confirmLabel="Xoá hẳn"
        onConfirm={async () => {
          setPurgeAsk(false);
          const h = await purgeTaskHours(Object.keys(orphans || {}), flash);
          if (h !== null) { flash(`Đã xoá ${fmtH(h)} h của các tác vụ đã xoá.`); setOrphans({}); }
        }}
        onCancel={() => setPurgeAsk(false)}
      />

      <ConfirmDialog
        open={!!pendingRoleDel}
        title={`Xoá vai trò ${pendingRoleDel ? roleLabel(pendingRoleDel.id) : ""}?`}
        desc={`${delRoleTaskCount} tác vụ của vai trò này sẽ bị xoá cùng giờ công đã chấm vào chúng (không khôi phục được); ${delRoleEmpCount} nhân sự đang giữ vai trò này sẽ thành không phân vai trò (chỉ thấy tác vụ dùng chung).`}
        confirmLabel="Xoá vai trò và tác vụ"
        onConfirm={confirmDelRole}
        onCancel={() => setPendingRoleDel(null)}
      />

      <ConfirmDialog
        open={!!pendingLeaveDel}
        title={`Xoá loại nghỉ ${pendingLeaveDel?.label || ""}?`}
        desc="Nhân sự sẽ không chọn được loại nghỉ này nữa. Giờ đã chấm vẫn giữ nguyên, báo cáo sẽ hiển thị là (tác vụ đã xoá)."
        confirmLabel="Xoá loại nghỉ"
        onConfirm={confirmDelLeave}
        onCancel={() => setPendingLeaveDel(null)}
      />

      <ConfirmDialog
        open={!!pendingDel}
        title={`Xoá tác vụ ${pendingDel?.name || ""}?`}
        desc={(() => { const h = pendingDel ? hoursOfTasks([pendingDel.id]) : 0;
          return `Tác vụ biến mất khỏi mọi màn hình và báo cáo.${h > 0 ? ` Xoá luôn ${fmtH(h)} h đã chấm vào tác vụ này (kể cả tăng ca cho tác vụ này) — tổng giờ dự án giảm tương ứng.` : " Chưa có giờ nào chấm vào tác vụ này."} Không khôi phục được.`; })()}
        confirmLabel="Xoá tác vụ và giờ đã chấm"
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
    </div>
  );
}

/* ============================ THIẾT LẬP ============================ */
/* v1.9 — Giai đoạn dự án sửa được: bấm tên / mô tả để sửa tại chỗ, thêm giai đoạn mới (mã kế tiếp P5, P6…).
   Giai đoạn chưa có giờ công và chưa có giờ dự kiến thì xoá được; đã có thì chỉ ngừng dùng / dùng lại. */
function PhasePanel({ cfg, saveCfg, flash }) {
  const dataTick = useDataTick();
  const [editing, setEditing] = useState(null);   // { id, field: "name" | "desc" }
  const [val, setVal] = useState("");
  const list = Array.isArray(cfg.phases) && cfg.phases.length ? cfg.phases : DEFAULT_PHASES;

  // Giờ công đang gắn với từng giai đoạn: mọi dòng bảng công (kể cả chưa gửi), không tính vắng mặt.
  // v2.1: lấy từ database trên toàn bộ dữ liệu; chưa hỏi được thì tạm cộng phần đang có trong bộ nhớ.
  const usage = useUsage();
  const hoursBy = useMemo(() => {
    const m = new Map();
    if (usage) {
      for (const u of usage) if (u.projectId !== NO_PROJECT && u.all > 0) m.set(u.phaseId, (m.get(u.phaseId) || 0) + u.all);
      return m;
    }
    for (const bucket of Object.values(DB?.ts || {})) for (const r of bucket?.rows || []) {
      if (isLeaveTask(r.taskId) || r.projectId === NO_PROJECT) continue;
      const h = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
      if (h > 0) { const k = r.phaseId || DEFAULT_PHASE; m.set(k, (m.get(k) || 0) + h); }
    }
    return m;
  }, [dataTick, usage]);
  // chưa biết chắc số liệu toàn bộ (không hỏi được database và bộ nhớ chỉ có vài tháng) thì không cho xoá
  const sure = !!usage || allLoaded();
  const hasBudget = (id) => cfg.projects.some((p) => Number(p.budgets?.[id]) > 0);
  const inUse = (id) => !sure || (hoursBy.get(id) || 0) > 0 || hasBudget(id);

  const save = (next, msg) => saveCfg({ ...cfg, phases: next }).then((ok) => { if (ok && msg) flash(msg); });
  const startEdit = (x, field) => { setEditing({ id: x.id, field }); setVal(x[field] || ""); };
  const commit = () => {
    if (!editing) return;
    const v = val.trim(), cur = list.find((x) => x.id === editing.id);
    setEditing(null);
    if (!cur || v === (cur[editing.field] || "")) return;
    if (editing.field === "name" && !v) return flash("Tên giai đoạn không được để trống.", "err");
    save(list.map((x) => (x.id === cur.id ? { ...x, [editing.field]: v } : x)), "Đã lưu giai đoạn.");
  };
  const add = async () => {
    const n = Math.max(0, ...list.map((x) => parseInt(String(x.id).replace(/\D/g, ""), 10) || 0)) + 1;
    const x = { id: `P${n}`, name: "Giai đoạn mới", desc: "", active: true };
    await save([...list, x], `Đã thêm ${x.id}.`);
    startEdit(x, "name");
  };
  const toggle = (x) => {
    if (x.active !== false && list.filter((y) => y.active !== false).length <= 1) return flash("Phải còn ít nhất một giai đoạn đang dùng.", "err");
    save(list.map((y) => (y.id === x.id ? { ...y, active: x.active === false } : y)),
      x.active === false ? `Đã dùng lại ${x.id}.` : `${x.id} · ${x.name} ngừng dùng — nhân sự không chọn được nữa.`);
  };
  const del = (x) => {
    if (inUse(x.id)) return flash("Giai đoạn đã có giờ công hoặc giờ dự kiến, chỉ ngừng dùng được.", "err");
    if (list.filter((y) => y.id !== x.id && y.active !== false).length === 0) return flash("Phải còn ít nhất một giai đoạn đang dùng.", "err");
    save(list.filter((y) => y.id !== x.id), `Đã xoá ${x.id} · ${x.name}.`);
  };
  const editKey = (e) => {
    if (e.key === "Enter" && !(e.shiftKey && e.currentTarget.tagName === "TEXTAREA")) { e.preventDefault(); e.currentTarget.blur(); }
    if (e.key === "Escape") { setEditing(null); }
  };
  const editCls = "w-full rounded border border-teal-600 bg-slate-900 px-2 text-slate-100 focus:outline-none";

  return (
    <Panel title="Giai đoạn dự án">
      <p className="text-sm text-slate-400">Mỗi dòng chấm công phải chọn một giai đoạn. Bấm vào tên hoặc mô tả để sửa.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {list.map((x) => {
          const c = tone(phaseColor(x.id)), off = x.active === false, hrs = hoursBy.get(x.id) || 0;
          const isEd = (f) => editing?.id === x.id && editing.field === f;
          return (
            <div key={x.id} data-phase-card={x.id} className={`relative min-w-0 rounded-lg border border-slate-800 bg-slate-950 py-3 pl-3 pr-14 ${off ? "opacity-60" : ""}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px]" style={{ color: c, borderColor: `${c}66`, background: `${c}1a` }}>{x.id}</span>
                {isEd("name")
                  ? <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={editKey} aria-label="Tên giai đoạn" className={`h-8 text-sm ${editCls}`} />
                  : <button onClick={() => startEdit(x, "name")} className="-ml-1 min-w-0 truncate rounded border border-transparent px-1 text-left text-sm font-medium text-slate-100 hover:border-slate-700">{x.name}</button>}
                {!isEd("name") && hrs > 0 && <span className="shrink-0 whitespace-nowrap rounded border border-teal-900 px-1.5 py-0.5 text-[10px] text-teal-400">{fmtH(hrs)} giờ</span>}
                {!isEd("name") && off && <span className="shrink-0 whitespace-nowrap rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">Ngừng dùng</span>}
              </div>
              {isEd("desc")
                ? <textarea autoFocus value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={editKey} aria-label="Mô tả giai đoạn" rows={2} className={`mt-1.5 py-1 text-xs ${editCls}`} />
                : <button onClick={() => startEdit(x, "desc")} className="-ml-1 mt-1.5 block w-full rounded border border-transparent px-1 text-left text-xs leading-relaxed text-slate-500 hover:border-slate-700">{x.desc || "Thêm mô tả…"}</button>}
              <div className="absolute right-2 top-2">
                {inUse(x.id)
                  ? <button onClick={() => toggle(x)} title={off ? "Dùng lại" : "Ngừng dùng"} className={iconBtn}>{off ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  : <button onClick={() => del(x)} title="Xoá giai đoạn" className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>}
              </div>
            </div>
          );
        })}
        <button onClick={add} className="flex min-h-[84px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 text-sm text-slate-400 hover:border-teal-700 hover:text-teal-300">
          <Plus size={15} /> Thêm giai đoạn
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Giai đoạn đã có giờ công hoặc giờ dự kiến thì không xoá được, chỉ ngừng dùng: nhân sự không chọn được nữa, giờ cũ vẫn giữ trong báo cáo.
      </p>
    </Panel>
  );
}

/* v2.6 — Lịch nhắc nộp bảng công (thông báo trên máy tính). Lưu ở cfg.reminders; server đọc lại mỗi 15 phút. */
const REM_DEFAULT = { weekOn: true, weekDow: 1, weekTime: "09:30", monthOn: true, monthTo: 2, monthTime: "09:30" };
const REM_DOW = [[1, "Thứ Hai"], [2, "Thứ Ba"], [3, "Thứ Tư"], [4, "Thứ Năm"], [5, "Thứ Sáu"], [6, "Thứ Bảy"], [7, "Chủ nhật"]];
const REM_HOURS = Array.from({ length: 16 }, (_, i) => pad(i + 6));          // 06 … 21
const REM_MINS = ["00", "15", "30", "45"];
const Toggle = ({ on, onClick }) => (
  <button type="button" onClick={onClick}
    className={`relative inline-block h-6 w-11 shrink-0 appearance-none rounded-full border-0 p-0 align-middle leading-none transition-colors ${on ? "bg-teal-600" : "bg-slate-700"}`}>
    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
  </button>
);
const TimePick = ({ value, onChange, disabled }) => {
  const [hh, mm] = String(value || "09:30").split(":");
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-20"><select disabled={disabled} value={hh} onChange={(e) => onChange(`${e.target.value}:${mm}`)} className={`font-mono disabled:opacity-40 ${selectCls}`}>
        {REM_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select></div>
      <span className="text-slate-500">:</span>
      <div className="w-20"><select disabled={disabled} value={REM_MINS.includes(mm) ? mm : "30"} onChange={(e) => onChange(`${hh}:${e.target.value}`)} className={`font-mono disabled:opacity-40 ${selectCls}`}>
        {REM_MINS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select></div>
    </div>
  );
};

/* v4.1 — Truy cập app: link + mã QR của chính địa chỉ đang mở (đổi tên miền thì QR tự đổi theo), in poster dán tại văn phòng / xưởng / công trường */
const escHtml = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function AccessPanel({ flash }) {
  const url = `${window.location.origin}/`;
  const shown = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) => QR.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#020617", light: "#ffffff" } }))
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => { if (alive) setSvg(""); });
    return () => { alive = false; };
  }, [url]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); flash("Đã sao chép link."); }
    catch { flash("Trình duyệt chặn sao chép — bôi đen link và Ctrl+C.", "err"); }
  };

  const printPoster = () => {
    if (!svg) return;
    const w = window.open("", "_blank");
    if (!w) return flash("Trình duyệt chặn cửa sổ mới — cho phép popup rồi bấm lại.", "err");
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>ARTIUS TIME — QR</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #020617; background: #fff; }
  .page { width: 210mm; height: 297mm; padding: 22mm 20mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .brand { letter-spacing: .5em; font-size: 15pt; color: #0f766e; }
  h1 { margin-top: 10mm; font-size: 30pt; font-weight: 600; }
  .sub { margin-top: 3mm; font-size: 14pt; color: #475569; }
  .qr { margin-top: 12mm; width: 120mm; height: 120mm; padding: 4mm; border: 1.2mm solid #2dd4bf; border-radius: 6mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .url { margin-top: 7mm; font-family: Consolas, monospace; font-size: 18pt; }
  .steps { margin-top: 12mm; display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; width: 100%; text-align: left; font-size: 11.5pt; line-height: 1.45; }
  .steps b { display: block; font-size: 12.5pt; margin-bottom: 1.5mm; color: #0f766e; }
  .foot { margin-top: auto; font-size: 10pt; color: #94a3b8; }
</style></head><body><div class="page">
  <div class="brand">ARTIUS</div>
  <h1>Chấm công dự án</h1>
  <div class="sub">Quét mã bằng camera điện thoại để mở ARTIUS TIME</div>
  <div class="qr">${svg}</div>
  <div class="url">${escHtml(shown)}</div>
  <div class="steps">
    <div><b>Android / máy tính</b>Mở link bằng Chrome hoặc Edge → bấm nút "Cài app" ở góc trên → Cài đặt. Từ đó mở bằng icon ARTIUS TIME.</div>
    <div><b>iPhone</b>Mở link bằng Safari → nút Chia sẻ → "Thêm vào MH chính". Mở app từ icon, đăng nhập một lần và cho phép thông báo.</div>
  </div>
  <div class="foot">Quên mật khẩu: liên hệ quản lý để được cấp lại.</div>
</div><script>window.onload = () => setTimeout(() => window.print(), 300);<\/script></body></html>`);
    w.document.close();
  };

  return (
    <Panel title="Truy cập app">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-lg bg-white p-1.5">
          {svg ? <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            : <div className="flex h-full items-center justify-center text-slate-400"><QrCode size={28} /></div>}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="truncate rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-sm text-slate-100">{shown}</div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <button onClick={copy} className={btnGhost}><Copy size={14} /> Sao chép link</button>
            <button onClick={printPoster} disabled={!svg} className={`${btnPrimary} disabled:opacity-40`}><Printer size={14} /> In poster QR</button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ReminderPanel({ cfg, saveCfg, flash }) {
  const [r, setR] = useState({ ...REM_DEFAULT, ...(cfg.reminders || {}) });
  const [st, setSt] = useState(null);       // { subs, log } | { error }
  const [testing, setTesting] = useState(false);
  const set = (patch) => setR((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(r) !== JSON.stringify({ ...REM_DEFAULT, ...(cfg.reminders || {}) });

  const load = useCallback(async () => {
    try { setSt(await fetchPushStatus()); } catch (e) { setSt({ error: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (await saveCfg({ ...cfg, reminders: { ...r } })) flash("Đã lưu lịch nhắc. Áp dụng từ lần chạy kế tiếp (tối đa 15 phút).");
  };
  const test = async () => {
    setTesting(true);
    try { await syncPush(); const x = await sendTestPush(); flash(x.delivered > 0 ? "Đã gửi thử tới máy này — xem góc phải dưới màn hình." : "Chưa gửi được tới trình duyệt này.", x.delivered > 0 ? "ok" : "err"); }
    catch (e) { flash(e.message, "err"); }
    setTesting(false);
  };

  const emps = cfg.employees || [];
  const on = new Set((st?.subs || []).map((x) => x.emp_id).filter(Boolean));
  const missing = emps.filter((e) => !on.has(e.id));
  const empName = (id) => emps.find((e) => e.id === id)?.name || "(nhân sự đã xoá)";
  const stamp = (iso) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const what = (x) => (x.kind === "week" ? `Tuần ${dLabel(x.period)}` : `Tháng ${Number(x.period.slice(5, 7))}/${x.period.slice(0, 4)}`);

  return (
    <Panel title="Nhắc nộp bảng công — thông báo trên máy tính">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle on={r.weekOn} onClick={() => set({ weekOn: !r.weekOn })} />
          <span className="w-28 text-sm text-slate-200">Nhắc tuần trước</span>
          <div className="w-56"><select disabled={!r.weekOn} value={r.weekDow} onChange={(e) => set({ weekDow: Number(e.target.value) })} className={`disabled:opacity-40 ${selectCls}`}>
            {REM_DOW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
          <TimePick value={r.weekTime} disabled={!r.weekOn} onChange={(v) => set({ weekTime: v })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle on={r.monthOn} onClick={() => set({ monthOn: !r.monthOn })} />
          <span className="w-28 text-sm text-slate-200">Nhắc chốt tháng</span>
          <div className="w-56"><select disabled={!r.monthOn} value={r.monthTo} onChange={(e) => set({ monthTo: Number(e.target.value) })} className={`disabled:opacity-40 ${selectCls}`}>
            {[0, 1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d === 0 ? "Chỉ ngày cuối tháng" : `Cuối tháng → mùng ${d}`}</option>)}
          </select></div>
          <TimePick value={r.monthTime} disabled={!r.monthOn} onChange={(v) => set({ monthTime: v })} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3">
          <span className="text-xs text-slate-500">Chỉ gửi cho nhân sự còn ngày chưa gửi. Lần đầu trong vòng 15 phút sau giờ đã chọn, sau đó nhắc lại mỗi 1 giờ tới 17:30 cho tới khi gửi đủ.</span>
          <button onClick={test} disabled={testing} className={`ml-auto ${btnGhost} disabled:opacity-40`}>{testing ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Gửi thử tới máy này</button>
          <button onClick={save} disabled={!dirty} className={`${btnPrimary} disabled:opacity-40`}><Save size={14} /> Lưu lịch nhắc</button>
        </div>

        <div className="border-t border-slate-800 pt-3">
          {st === null ? (
            <Loader2 className="animate-spin text-slate-500" size={16} />
          ) : st.error ? (
            <p className="text-xs text-rose-400">{st.error}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Bell size={14} className="text-teal-400" />
                <span className="text-slate-300">Đã bật thông báo: <span className="font-mono text-teal-400">{emps.length - missing.length}/{emps.length}</span> nhân sự</span>
                <button onClick={load} className="ml-auto text-xs text-teal-400 hover:text-teal-300">Tải lại</button>
              </div>
              {missing.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {missing.map((e) => <span key={e.id} className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-amber-300">{e.name}</span>)}
                </div>
              )}
              {st.log.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-slate-500">Lần nhắc gần nhất</div>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {st.log.slice(0, 15).map((x) => (
                      <div key={`${x.kind}|${x.period}|${x.emp_id}`} className="flex gap-3 text-xs text-slate-400">
                        <span className="w-20 shrink-0 font-mono text-slate-500">{stamp(x.sent_at)}</span>
                        <span className="w-24 shrink-0">{what(x)}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-300">{empName(x.emp_id)}</span>
                        <span className="shrink-0">{x.missing} ngày</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* v6.3 — Tăng ca là cài đặt chung: các khung giờ (bắt đầu – kết thúc) + hệ số, áp cho mọi nhân sự / vai trò.
   Không còn hạng mục [OT] ở tab Tác vụ. Mã khung cố định nên đổi giờ của khung không làm mất giờ đã chấm.
   Khung đang có giờ chấm thì không xoá được. Chủ nhật / ngày lễ: một hệ số cho cả ngày (để trống = theo khung giờ).
   Lưu: cfg.otBands = [{ id, from, to, rate }], cfg.otSunRate, cfg.otHolRate, cfg.otLegacy (mã [OT] cũ → khung). */
const OT_TIME_RE = /^\s*(\d{1,2})\s*[:h.]\s*(\d{2})\s*$/;
const otParseTime = (x) => { const m = OT_TIME_RE.exec(x || ""); if (!m) return null; const h = +m[1], mi = +m[2]; return h <= 24 && mi < 60 && h * 60 + mi <= 1440 ? `${h % 24}:${pad(mi)}` : null; };
function OtRatePanel({ cfg, saveCfg, flash }) {
  useDataTick();
  const init = () => ({
    bands: (cfg.otBands || []).map((b) => ({ id: b.id, from: b.from, to: b.to, rate: b.rate != null ? String(b.rate) : "" })),
    sun: cfg.otSunRate != null ? String(cfg.otSunRate) : "",
    hol: cfg.otHolRate != null ? String(cfg.otHolRate) : "",
  });
  const [v, setV] = useState(init);
  const [assign, setAssign] = useState({});
  useEffect(() => { setV(init()); }, [cfg.otBands, cfg.otSunRate, cfg.otHolRate]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (x) => { const n = Number(String(x).replace(",", ".")); return x === "" || !(n > 0) ? null : Math.min(10, n); };

  /* giờ đã chấm theo khung (trong phần bảng công đang tải) + dòng tăng ca của hạng mục [OT] đã bị xoá trước v6.3 */
  const legacy = cfg.otLegacy || {};
  const known = new Set([...(cfg.tasks || []).map((t) => t.id), ...LEAVE_TASKS.map((t) => t.id), ...(cfg.otBands || []).map((b) => b.id), ...Object.keys(legacy)]);
  const used = new Map(), orphans = new Map();
  for (const bucket of Object.values(DB?.ts || {})) {
    for (const r of Array.isArray(bucket?.rows) ? bucket.rows : []) {
      const h = Object.values(r.days || {}).reduce((a, x) => a + (Number(x) || 0), 0);
      if (!h) continue;
      const bid = legacy[r.taskId] || r.taskId;
      if ((cfg.otBands || []).some((b) => b.id === bid)) used.set(bid, (used.get(bid) || 0) + h);
      else if (r.otFor && !known.has(r.taskId)) orphans.set(r.taskId, (orphans.get(r.taskId) || 0) + h);
    }
  }

  const setBand = (k, patch) => setV((x) => ({ ...x, bands: x.bands.map((b, i) => (i === k ? { ...b, ...patch } : b)) }));
  const addBand = () => setV((x) => ({ ...x, bands: [...x.bands, { id: "", from: "", to: "", rate: "2" }] }));
  const delBand = (k) => setV((x) => ({ ...x, bands: x.bands.filter((_, i) => i !== k) }));
  const spanOf = (b) => { const f = otParseTime(b.from), t = otParseTime(b.to); return f && t ? otSpan({ name: `[OT] ${f} - ${t}` }) : null; };

  const save = async () => {
    if (!v.bands.length) return flash("Cần ít nhất một khung giờ tăng ca.", "err");
    const out = [], keys = new Set();
    for (const b of v.bands) {
      const from = otParseTime(b.from), to = otParseTime(b.to);
      if (!from || !to) return flash(`Giờ của khung "${b.from || "?"} – ${b.to || "?"}" chưa đúng dạng 17:30.`, "err");
      if (from === to) return flash(`Khung ${from} – ${to}: giờ bắt đầu và kết thúc trùng nhau.`, "err");
      const key = otBandKey({ name: `[OT] ${from} - ${to}` });
      if (keys.has(key)) return flash(`Khung ${from} – ${to} bị trùng.`, "err");
      keys.add(key);
      if (num(b.rate) == null) return flash(`Nhập hệ số cho khung ${from} – ${to} (số lớn hơn 0).`, "err");
      let id = b.id || otBandIdFor(from, to);
      if (!b.id && (out.some((x) => x.id === id) || (cfg.otBands || []).some((x) => x.id === id) || Object.keys(legacy).includes(id))) id = uid("OTB_");
      out.push({ id, from, to, rate: num(b.rate) });
    }
    for (const [k, l] of [["sun", "Chủ nhật"], ["hol", "ngày lễ"]]) if (v[k] !== "" && num(v[k]) == null) return flash(`Hệ số ${l} phải là số lớn hơn 0, hoặc để trống.`, "err");
    const gone = (cfg.otBands || []).filter((b) => !out.some((x) => x.id === b.id) && used.get(b.id));
    if (gone.length) return flash(`Khung ${gone[0].from} – ${gone[0].to} đã có giờ chấm, không xoá được.`, "err");
    const ok = await saveCfg({ ...cfg, otBands: out, otSunRate: num(v.sun), otHolRate: num(v.hol) });
    if (ok !== false) flash("Đã lưu tăng ca. Dashboard, Tiến độ dự án và Excel tính lại theo khung giờ / hệ số mới.");
  };
  const doAssign = async (old) => {
    const bid = assign[old] || cfg.otBands?.[0]?.id;
    if (!bid) return;
    const ok = await saveCfg({ ...cfg, otLegacy: { ...legacy, [old]: bid } });
    if (ok !== false) flash("Đã gán giờ tăng ca cũ vào khung giờ.");
  };
  const field = "font-mono text-center " + inputCls;
  return (
    <Panel title="Tăng ca — khung giờ & hệ số" sub="Áp dụng cho mọi nhân sự, mọi vai trò. Không cần tạo hạng mục [OT] ở tab Tác vụ.">
      {OT_MIG_NOTE && <div className="mb-3 rounded-lg border border-sky-900 bg-sky-950/40 px-3 py-2 text-sm text-sky-200">{OT_MIG_NOTE}</div>}
      <div className="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <div className="mb-1 grid grid-cols-[2.25rem_minmax(0,1fr)_4rem_2.75rem] sm:grid-cols-[2.25rem_minmax(0,1fr)_5rem_3.5rem_2.75rem] items-center gap-2 text-xs text-slate-500">
            <span /><span>Khung giờ (bắt đầu – kết thúc)</span><span className="text-center">Hệ số</span><span className="hidden text-right sm:block">Tối đa</span><span />
          </div>
          {v.bands.map((b, k) => {
            const sp = spanOf(b), h = b.id ? used.get(b.id) || 0 : 0;
            return (
              <div key={k} className="grid grid-cols-[2.25rem_minmax(0,1fr)_4rem_2.75rem] sm:grid-cols-[2.25rem_minmax(0,1fr)_5rem_3.5rem_2.75rem] items-center gap-2 border-b border-slate-800 py-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-950 font-mono text-[11px] font-semibold text-teal-300">OT{k + 1}</span>
                <div className="flex min-w-0 items-center gap-1.5">
                  <input value={b.from} onChange={(e) => setBand(k, { from: e.target.value })} placeholder="17:30" aria-label={`Bắt đầu khung ${k + 1}`} className={`${field} min-w-0 px-1`} />
                  <span className="text-slate-600">–</span>
                  <input value={b.to} onChange={(e) => setBand(k, { to: e.target.value })} placeholder="21:00" aria-label={`Kết thúc khung ${k + 1}`} className={`${field} min-w-0 px-1`} />
                </div>
                <input inputMode="decimal" value={b.rate} onChange={(e) => setBand(k, { rate: e.target.value })} aria-label={`Hệ số khung ${k + 1}`} className={`${field} px-1`} />
                <span className="hidden text-right font-mono text-xs text-slate-500 sm:block">{sp ? `${fmtH(sp.hours)} h` : "—"}</span>
                <button onClick={() => (h ? null : delBand(k))} disabled={h > 0} title={h ? `Đã có ${fmtH(h)} h chấm vào khung này — không xoá được` : "Xoá khung giờ"}
                  className={`${iconBtn} h-11 w-11 hover:border-rose-800 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30`}><Trash2 size={15} /></button>
              </div>
            );
          })}
          <button onClick={addBand} className={`mt-2 ${btnGhost} border-dashed`}><Plus size={14} /> Thêm khung giờ</button>
          <div className="mt-2 text-xs leading-relaxed text-slate-500">Khung qua nửa đêm (21:00 – 0:00, 0:00 – 8:00) tự tính đúng số giờ. Đổi giờ của khung không làm mất giờ đã chấm — giờ cũ đi theo khung. Khung đang có giờ chấm thì không xoá được.</div>
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-xs text-slate-500">Ngày đặc biệt — một hệ số cho cả ngày</div>
          {[["sun", "Chủ nhật"], ["hol", "Ngày lễ (theo danh sách ngày lễ bên dưới)"]].map(([k, l]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-slate-800 py-1.5">
              <span className="text-sm text-slate-300">{l}</span>
              <div className="w-24 shrink-0"><input inputMode="decimal" placeholder="—" value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} aria-label={`Hệ số ${l}`} className={field} /></div>
            </div>
          ))}
          <div className="mt-2 text-xs text-slate-500">Để trống thì ngày đó tính theo hệ số khung giờ.</div>
        </div>
      </div>
      {orphans.size > 0 && (
        <div className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/20 p-3">
          <div className="text-sm text-amber-300">Có giờ tăng ca chấm vào hạng mục [OT] đã bị xoá — chọn khung giờ để gán lại</div>
          {[...orphans.entries()].map(([old, h]) => (
            <div key={old} className="mt-2 flex flex-wrap items-center gap-2">
              <span className="min-w-[9rem] text-sm text-slate-300">{fmtH(h)} h <span className="font-mono text-xs text-slate-600">({old})</span></span>
              <select value={assign[old] || cfg.otBands?.[0]?.id || ""} onChange={(e) => setAssign((x) => ({ ...x, [old]: e.target.value }))}
                className={`${CTRL} w-44 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-teal-300`}>
                {(cfg.otBands || []).map((b) => <option key={b.id} value={b.id}>{b.from} – {b.to}</option>)}
              </select>
              <button onClick={() => doAssign(old)} className={btnGhost}><Check size={14} /> Gán</button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-500">Giờ quy đổi = giờ tăng ca × hệ số. Dashboard, Tiến độ dự án và Excel tính lại ngay sau khi lưu.</span>
        <button onClick={save} className={`ml-auto shrink-0 ${btnPrimary}`}><Save size={14} /> Lưu tăng ca</button>
      </div>
    </Panel>
  );
}

/* v5.3 — Ngưỡng tải nhân sự cho khung "Phân bổ giờ công theo nhân sự" (Dashboard) và cột Trạng thái trong Excel */
function AllocLimitPanel({ cfg, saveCfg, flash }) {
  const cur = allocLimits(cfg);
  const [v, setV] = useState({ over: String(cur.over), under: String(cur.under) });
  useEffect(() => { const c = allocLimits(cfg); setV({ over: String(c.over), under: String(c.under) }); }, [cfg.allocOver, cfg.allocUnder]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const o = Number(v.over), u = Number(v.under);
    if (!(o >= 100 && o <= 300)) return flash("Ngưỡng Quá tải phải từ 100 đến 300%.", "err");
    if (!(u >= 0 && u <= 100)) return flash("Ngưỡng Thiếu giờ phải từ 0 đến 100%.", "err");
    await saveCfg({ ...cfg, allocOver: o, allocUnder: u });
    flash("Đã lưu ngưỡng tải nhân sự.");
  };
  return (
    <Panel title="Ngưỡng tải nhân sự">
      <div className="grid grid-cols-2 gap-3 md:max-w-xl">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Quá tải khi tổng giờ vượt (% giờ chuẩn kỳ)</label>
          <input type="number" inputMode="numeric" min="100" max="300" value={v.over} onChange={(e) => setV((x) => ({ ...x, over: e.target.value }))} className={`font-mono ${inputCls}`} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Thiếu giờ khi giờ chuẩn dưới (% giờ chuẩn kỳ)</label>
          <input type="number" inputMode="numeric" min="0" max="100" value={v.under} onChange={(e) => setV((x) => ({ ...x, under: e.target.value }))} className={`font-mono ${inputCls}`} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-500">Dùng cho khung Phân bổ giờ công theo nhân sự ở Dashboard và cột Trạng thái trong Excel. Mặc định 110% / 90%.</span>
        <button onClick={save} className={`ml-auto shrink-0 ${btnPrimary}`}><Save size={14} /> Lưu ngưỡng</button>
      </div>
    </Panel>
  );
}

function SettingsTab({ cfg, saveCfg, flash }) {
  const [day, setDay] = useState(cfg.deadlineDay || 5);
  const [confirm, setConfirm] = useState("");
  const [h, setH] = useState({ ...DEFAULT_HOURS, ...(cfg.hours || {}) });
  const [holDate, setHolDate] = useState(fmt(new Date()));
  const [holName, setHolName] = useState("");
  const [holYearly, setHolYearly] = useState(true);
  const [pendingHol, setPendingHol] = useState(null);

  const target = weeklyTarget(h);
  const setHNum = (k, v) => setH((x) => ({ ...x, [k]: v === "" ? 0 : Math.max(0, Math.min(24, Number(v))) }));

  const saveHours = async () => {
    await saveCfg({ ...cfg, hours: { ...h } });
    flash("Đã lưu. Giờ chuẩn và ngưỡng giờ cố gắng áp dụng ngay cho toàn bộ nhân viên.");
  };

  // Lễ lặp hàng năm xếp trước và so theo ngày-tháng; lễ của riêng một năm xếp sau theo ngày đầy đủ
  const holidays = [...(cfg.holidays || [])].sort((a, b) => {
    if (!!a.yearly !== !!b.yearly) return a.yearly ? -1 : 1;
    return a.yearly ? a.date.slice(5).localeCompare(b.date.slice(5)) : a.date.localeCompare(b.date);
  });
  const sameSlot = (x, date, yearly) => (yearly && x.yearly ? x.date.slice(5) === date.slice(5) : !yearly && !x.yearly && x.date === date);
  const holLabel = (x) => (x.yearly ? `Ngày ${x.date.slice(8)}/${x.date.slice(5, 7)} — hàng năm` : dFull(x.date));

  const addHoliday = async () => {
    if (!holName.trim()) return flash("Đặt tên cho ngày lễ, ví dụ Giỗ Tổ Hùng Vương.", "err");
    if (holidays.some((x) => sameSlot(x, holDate, holYearly))) return flash("Ngày này đã có trong danh sách.", "err");
    await saveCfg({ ...cfg, holidays: [...holidays, { date: holDate, name: holName.trim(), yearly: holYearly }] });
    setHolName(""); flash(holYearly ? "Đã thêm ngày lễ, áp dụng cho mọi năm." : "Đã thêm ngày lễ cho riêng năm này.");
  };
  const addVnFixed = async () => {
    const y = new Date().getFullYear();
    const toAdd = VN_FIXED_HOLIDAYS
      .filter((h) => !holidays.some((x) => x.yearly && x.date.slice(5) === h.md))
      .map((h) => ({ date: `${y}-${h.md}`, name: h.name, yearly: true }));
    if (toAdd.length === 0) return flash("Các ngày lễ cố định đều đã có trong danh sách.");
    await saveCfg({ ...cfg, holidays: [...holidays, ...toAdd] });
    flash(`Đã thêm ${toAdd.length} ngày lễ cố định, áp dụng cho mọi năm.`);
  };
  const toggleYearly = async (x) => {
    await saveCfg({ ...cfg, holidays: holidays.map((y) => (y === x ? { ...y, yearly: !y.yearly } : y)) });
  };
  const confirmDelHoliday = async () => {
    const x = pendingHol; setPendingHol(null);
    if (!x) return;
    await saveCfg({ ...cfg, holidays: holidays.filter((y) => !(y.date === x.date && y.name === x.name)) });
    flash("Đã xoá ngày lễ.");
  };

  const wipe = async () => {
    if (confirm !== "XOA") return flash('Gõ đúng chữ "XOA" để xác nhận.', "err");
    const ok = await wipeTs();
    flash(ok ? "Đã xoá toàn bộ dữ liệu chấm công." : `Chưa xoá được — ${LAST_STORAGE_ERROR || "thử lại"}`, ok ? "ok" : "err"); if (ok) setConfirm("");
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <PhasePanel cfg={cfg} saveCfg={saveCfg} flash={flash} />

      <Panel title="Giờ chuẩn & ngưỡng cảnh báo">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {[["weekday", "Giờ chuẩn T2–T6"], ["sat", "Giờ chuẩn T7"], ["sun", "Giờ chuẩn CN"], ["satOt", "Cố gắng T7 từ"], ["maxDaily", "Cảnh báo vượt / ngày"]].map(([k, l]) => (
            <div key={k}>
              <label className="mb-1 block text-xs text-slate-500">{l}</label>
              <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={h[k] ?? ""}
                onChange={(e) => setHNum(k, e.target.value)} className={`font-mono ${inputCls}`} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3">
          <span className="text-xs text-slate-500">Target tuần tự tính: <b className="font-mono text-teal-400">{target.toFixed(1)} giờ</b></span>
          <button onClick={saveHours} className={`ml-auto ${btnPrimary}`}><Save size={14} /> Lưu giờ chuẩn</button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          <b className="text-slate-400">Giờ chuẩn</b> quyết định target và cảnh báo thiếu giờ. Đặt 0 cho một loại ngày nghĩa là ngày nghỉ — không báo thiếu, mọi giờ làm việc thường chấm vào tính hết thành Giờ cố gắng (không phải OT).
          <br /><b className="text-slate-400">Cố gắng T7 từ</b> là mốc bắt đầu tính Giờ cố gắng riêng cho thứ 7: giờ chuẩn T7 vẫn là {h.sat || 0}h nhưng chỉ phần vượt {h.satOt ?? 8}h mới thành Giờ cố gắng. Ngày thường: phần giờ làm việc vượt giờ chuẩn là Giờ cố gắng.
          <br /><b className="text-slate-400">OT</b> chỉ tính khi nhân sự chấm vào khung giờ Tăng ca (cài ở mục Tăng ca), và mỗi dòng tăng ca phải chọn "Tăng ca cho tác vụ". Giờ cố gắng ghi nhận nỗ lực, không tính vào chi phí dự án.
          <br />Toàn bộ nhân viên lấy các thông số này từ đây — sửa ở đây là áp cho tất cả.
        </p>
      </Panel>

      <OtRatePanel cfg={cfg} saveCfg={saveCfg} flash={flash} />

      <AllocLimitPanel cfg={cfg} saveCfg={saveCfg} flash={flash} />

      <ReminderPanel cfg={cfg} saveCfg={saveCfg} flash={flash} />

      <AccessPanel flash={flash} />

      <Panel title={`Ngày lễ, ngày nghỉ chung (${holidays.length})`}>
        <div className="ro-hide grid gap-2 md:flex md:items-end md:gap-3">
          <DateField label="Ngày" value={holDate} onChange={setHolDate} className="md:w-44" />
          <div className="md:flex-1">
            <label className="mb-1 block text-xs text-slate-500">Tên ngày lễ</label>
            <input value={holName} onChange={(e) => setHolName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHoliday()}
              placeholder="Quốc khánh, Tết Dương lịch…" className={inputCls} />
          </div>
          <button onClick={addHoliday} className={btnPrimary}><Plus size={14} /> Thêm ngày lễ</button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={holYearly} onChange={(e) => setHolYearly(e.target.checked)}
              className="h-4 w-4 accent-teal-500" />
            Lặp lại hàng năm
          </label>
          <span className="text-xs text-slate-500">
            {holYearly
              ? `Năm nào cũng nghỉ ngày ${holDate.slice(8)}/${holDate.slice(5, 7)} — dùng cho lễ dương lịch cố định`
              : "Chỉ áp dụng đúng ngày này của năm nay — dùng cho lễ âm lịch như Tết, Giỗ Tổ"}
          </span>
          <button onClick={addVnFixed} className={`ml-auto ${btnGhost}`}>
            <Plus size={14} /> Thêm nhanh 4 lễ cố định VN
          </button>
        </div>

        {holidays.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Chưa khai báo ngày lễ nào. Thêm vào đây thì nhân sự sẽ không bị báo thiếu giờ những ngày đó.</p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {holidays.map((x, i) => (
              <div key={`${x.date}|${x.name}|${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm text-slate-100"><Flag size={12} className="shrink-0 text-rose-400" /><span className="truncate">{x.name}</span></div>
                  <div className="font-mono text-xs text-slate-500">{holLabel(x)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => toggleYearly(x)} title={x.yearly ? "Chuyển thành lễ của riêng năm này" : "Chuyển thành lặp hàng năm"}
                    className={`rounded-md border px-2 py-1 text-[10px] ${x.yearly ? "border-teal-800 bg-teal-950 text-teal-300" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}>
                    {x.yearly ? "Hàng năm" : "Một lần"}
                  </button>
                  <button onClick={() => setPendingHol(x)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Ngày lễ áp dụng cho toàn công ty. Giờ làm việc thường chấm vào ngày lễ được tính là Giờ cố gắng (OT chỉ khi chấm hạng mục Tăng ca).
          Lễ âm lịch như Tết Nguyên đán hay Giỗ Tổ đổi ngày dương mỗi năm nên để chế độ "Một lần" và khai lại đầu mỗi năm.
        </p>
      </Panel>

      <Panel title="Quy định chấm công">
        <div className="grid gap-3 md:flex md:flex-wrap md:items-end">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Hạn chốt công hàng tháng (ngày)</label>
            <input type="number" inputMode="numeric" min="1" max="28" value={day} onChange={(e) => setDay(Number(e.target.value))} className={`font-mono md:w-32 ${inputCls}`} />
          </div>
          <button onClick={async () => { await saveCfg({ ...cfg, deadlineDay: day }); flash("Đã lưu thiết lập."); }} className={`ro-hide ${btnPrimary}`}>Lưu thiết lập</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Nhân sự thấy cảnh báo vàng về bảng công tháng trước từ đầu tháng, chuyển đỏ “quá hạn” sau ngày {pad(day)}.
        </p>
      </Panel>

      <Panel title="Xoá dữ liệu chấm công">
        <p className="text-sm text-slate-300">Xoá toàn bộ giờ công đã nhập của mọi nhân sự. Danh sách dự án, nhân sự và hạng mục được giữ lại. Không khôi phục được — xuất Excel trước khi xoá.</p>
        <div className="mt-3 grid gap-2 md:flex md:items-center">
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Gõ XOA để xác nhận" className={`md:w-56 ${inputCls}`} />
          <button onClick={wipe} className={btnDanger}><RotateCcw size={14} /> Xoá dữ liệu</button>
        </div>
      </Panel>

      <BackupPanel cfg={cfg} saveCfg={saveCfg} flash={flash} setCfgFromRestore={saveCfg} />
      <StorageDoctor cfg={cfg} admin />

      <ConfirmDialog
        open={!!pendingHol}
        title={`Xoá ngày lễ ${pendingHol?.name || ""}?`}
        desc={pendingHol ? `${holLabel(pendingHol)} sẽ quay lại tính giờ chuẩn như ngày thường, và cảnh báo thiếu giờ sẽ áp dụng trở lại.` : ""}
        confirmLabel="Xoá ngày lễ"
        onConfirm={confirmDelHoliday}
        onCancel={() => setPendingHol(null)}
      />
    </div>
  );
}
