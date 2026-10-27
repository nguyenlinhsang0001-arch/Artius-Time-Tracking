/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React from "react";

/* ---------- date helpers ---------- */
export const pad = (n) => String(n).padStart(2, "0");
export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseD = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const mondayOf = (d) => {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x;
};
export const ymOf = (s) => s.slice(0, 7);
export const prevYm = (ym) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
export const ymLabel = (ym) => { const [y, m] = ym.split("-"); return `Tháng ${Number(m)}/${y}`; };
export const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const DOW_MINI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const dLabel = (s) => { const d = parseD(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
/* Bộ tra cứu ngày lễ. Ngày lễ dương lịch cố định (01/01, 30/04, 02/09…) đánh dấu lặp hàng năm
   thì chỉ khai báo một lần, năm nào cũng nhận. Ngày lễ âm lịch (Tết, Giỗ Tổ) đổi ngày mỗi năm
   nên vẫn khai từng năm một.
   Trả về đối tượng có has()/get() giống Map để mọi nơi đang dùng không phải sửa. */
export const makeHolidayIndex = (list = []) => {
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
export const VN_FIXED_HOLIDAYS = [
  { md: "01-01", name: "Tết Dương lịch" },
  { md: "04-30", name: "Ngày Giải phóng miền Nam" },
  { md: "05-01", name: "Quốc tế Lao động" },
  { md: "09-02", name: "Quốc khánh" },
];
export const DEFAULT_HOURS = { weekday: 8, sat: 4, sun: 0, satOt: 8, maxDaily: 13.5 };   // v3.5: tổng ngày chỉ đỏ khi vượt 13.5h
export const OT_ALERT = 3.5; // OT một ngày vượt mốc này thì chuyển đỏ cảnh báo thay vì xanh

/* Ngày lễ được khoanh bằng một vòng cọ đỏ vẽ tay — nét không khép kín, hai đầu vuốt lệch,
   độ dày thay đổi để ra cảm giác nét bút thật thay vì hình tròn máy. Nhúng data-URI, không tải ngoài. */
export const HOLIDAY_RING_SVG = encodeURIComponent(
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
export const HOLIDAY_RING_WIDE = HOLIDAY_RING_SVG.replace(encodeURIComponent('viewBox="0 0 48 48"'), encodeURIComponent('viewBox="0 0 48 48" preserveAspectRatio="none"'));
export const holidayRingBg = (size = 34) => ({
  backgroundImage: `url("data:image/svg+xml,${HOLIDAY_RING_SVG}")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  backgroundSize: `${size}px ${size}px`,
});
export const stdHoursFor = (s, h = DEFAULT_HOURS) => {
  const wd = (parseD(s).getDay() + 6) % 7; // 0=T2 ... 5=T7, 6=CN
  if (wd === 6) return Number(h.sun) || 0;
  if (wd === 5) return Number(h.sat) || 0;
  return Number(h.weekday) || 0;
};
export const minHoursFor = (s, h = DEFAULT_HOURS, holidaySet = null) => {
  if (holidaySet?.has(s)) return null;
  const std = stdHoursFor(s, h);
  return std > 0 ? std : null;
};
/* Ngưỡng bắt đầu tính OT của một ngày — cố ý tách khỏi giờ chuẩn.
   T7 giờ chuẩn 4h nhưng chỉ vượt 8h mới tính OT, tức 4 giờ thứ 5 đến thứ 8 của T7
   vẫn là giờ thường. Ngày mà cấu hình cho nghỉ hẳn (giờ chuẩn 0) thì làm bao nhiêu OT bấy nhiêu. */
export const otThresholdFor = (s, h = DEFAULT_HOURS) => {
  const std = stdHoursFor(s, h);
  if (std <= 0) return 0;
  const wd = (parseD(s).getDay() + 6) % 7; // 0=T2 ... 5=T7, 6=CN
  if (wd === 5) return Math.max(std, Number(h.satOt) || 8);
  return std;
};
/* v3.4 — OT chỉ là giờ chấm vào hạng mục Tăng ca ([OT]). Giờ làm việc thường vượt ngưỡng của ngày
   (hoặc làm ngày lễ / ngày nghỉ) KHÔNG phải OT mà là "Giờ cố gắng": ghi nhận nỗ lực của nhân sự,
   không tính vào chi phí dự án. `regular` = giờ làm việc thường trong ngày (không gồm OT, không gồm vắng mặt). */
export const effortHoursFor = (s, regular, h = DEFAULT_HOURS, holidaySet = null) => {
  if (!regular) return 0;
  if (holidaySet?.has(s)) return regular;
  const th = otThresholdFor(s, h);
  return th <= 0 ? regular : Math.max(0, regular - th);
};
export const weeklyTarget = (h = DEFAULT_HOURS) => (Number(h.weekday) || 0) * 5 + (Number(h.sat) || 0) + (Number(h.sun) || 0);
export const dFull = (s) => { const d = parseD(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const lastOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const mondaysOfMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1), last = new Date(y, m, 0);
  const out = []; let cur = mondayOf(first);
  while (cur <= last) { out.push(fmt(cur)); cur = addDays(cur, 7); }
  return out;
};
// v2.0 — các tuần của tháng đã bắt đầu tính tới hôm nay; tuần chưa tới thì chưa phải nộp
export const mondaysDue = (ym) => { const today = fmt(new Date()); return mondaysOfMonth(ym).filter((m) => m <= today); };
export const weekDays = (mondayStr) => {
  const m = parseD(mondayStr);
  return Array.from({ length: 7 }, (_, i) => fmt(addDays(m, i)));
};
// các tháng (YYYY-MM) mà khoảng [from, to] chạm tới
export const ymsBetween = (from, to) => {
  const a = parseD(from), b = parseD(to);
  const out = []; let y = a.getFullYear(), m = a.getMonth();
  while (y * 12 + m <= b.getFullYear() * 12 + b.getMonth()) {
    out.push(`${y}-${pad(m + 1)}`); m++; if (m > 11) { m = 0; y++; }
  }
  return out;
};

