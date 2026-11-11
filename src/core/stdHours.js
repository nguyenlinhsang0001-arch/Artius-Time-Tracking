/* ============================================================
   v13.73 (R5) — GIỜ CHUẨN: một định nghĩa duy nhất cho cả app.

   Giờ chuẩn = số giờ một người PHẢI làm. Trước v13.73 có bốn vòng cộng tự viết (Bảng công, Dashboard › Nhân sự,
   So với thực tế › % tải, So với thực tế › quy ra người), mỗi nơi hiểu "hôm nay" và "ngày chưa tới" hơi khác.
   Mọi nơi giờ gọi hai hàm dưới đây; chỉ khác nhau ở tham số.

   Một ngày (stdDay):
     · giờ chuẩn theo Thiết lập (T2–T6 / T7 / CN), ngày lễ = 0           — date.minHoursFor, như trước
     · trước ngày vào làm, từ ngày nghỉ việc trở đi = 0                  — domain.offOnDay (chỉ khi có người)

   Nhiều ngày (stdHours) thêm hai luật thời gian:
     · upToToday (mặc định true): ngày sau hôm nay = 0. false = tính trọn khoảng (vd giờ chuẩn cả tháng cho lương,
       hay giờ chuẩn cả tuần để quy giờ ra số người).
     · today: "entered" (mặc định) = hôm nay chỉ tính khi entered(ngày) đúng — người đó đã gửi giờ hôm nay
                                     (Bảng công / Dashboard / % tải: không ai bị "thiếu 8 h" suốt ngày trước khi gửi);
              "never"  = không tính hôm nay (So với thực tế: tuần đang chạy so trọn ngày tới hết hôm qua);
              "always" = tính như mọi ngày đã qua.
   ============================================================ */
import { addDays, fmt, minHoursFor, parseD } from "./date.jsx";
import { offOnDay } from "./domain.jsx";

/* giờ chuẩn MỘT ngày của MỘT người (emp có thể null = "một người đi làm đủ", không xét ngày vào làm / nghỉ việc) */
export const stdDay = (emp, d, hoursCfg, hs) => (emp && offOnDay(emp, d) ? 0 : minHoursFor(d, hoursCfg, hs) || 0);

/* các ngày từ a tới b (gồm cả hai đầu), "YYYY-MM-DD" */
export const daysBetween = (a, b) => {
  const out = [];
  if (!a || !b || a > b) return out;
  for (let d = a; d <= b; d = fmt(addDays(parseD(d), 1))) out.push(d);
  return out;
};

/* giờ chuẩn cộng trên một danh sách ngày */
export function stdHours({ emp = null, days = [], hoursCfg, hs = null, today = fmt(new Date()),
  upToToday = true, todayRule = "entered", entered = () => false }) {
  let t = 0;
  for (const d of days) {
    if (upToToday && d > today) continue;
    if (d === today && upToToday) {
      if (todayRule === "never") continue;
      if (todayRule === "entered" && !entered(d)) continue;
    }
    t += stdDay(emp, d, hoursCfg, hs);
  }
  return t;
}
