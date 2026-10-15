/* ============================================================
   ARTIUS v2.6 — Tính lịch nhắc và người còn thiếu giờ (dùng chung cho /api/push)
   Thuần tính toán, không gọi mạng — để kiểm thử được độc lập.

   Luật "ngày phải chấm công" giống hệt app (minHoursFor):
     · ngày có giờ chuẩn > 0 theo cấu hình hours (T2–T6 / T7 / CN)
     · không phải ngày lễ (ngày lễ lặp hàng năm so theo MM-DD)
     · đã tới (<= hôm nay, giờ Việt Nam)
   Ngày "đã gửi" = có dấu value.sent[YYYY-MM-DD]. Tuần gửi kiểu cũ (value.weeks[thứ Hai]) ở mọi tháng
   của tuần đó thì cả tuần coi như đã gửi.
   ============================================================ */

export const DEFAULT_HOURS = { weekday: 8, sat: 4, sun: 0 };
/* v4.2 — Sau lần nhắc đầu tiên (giờ đặt trong Thiết lập), cứ 1 giờ nhắc lại cho người CHƯA gửi đủ, chỉ trong chính
   ngày nhắc đó, tới REPEAT_UNTIL thì dừng. Gửi đủ là hết nhận (người đủ giờ không bao giờ bị nhắc). */
export const REPEAT_EVERY_MIN = 60;
export const REPEAT_UNTIL = "17:30";

export const DEFAULT_REMINDERS = {
  weekOn: true, weekDow: 1, weekTime: "09:30",          // 1 = thứ Hai … 7 = Chủ nhật
  monthOn: true, monthTo: 2, monthTime: "09:30",        // từ ngày cuối tháng tới ngày monthTo của tháng sau
};

const pad = (n) => String(n).padStart(2, "0");
const fmtUTC = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmtUTC(d); };
const dow0 = (s) => (parse(s).getUTCDay() + 6) % 7;                 // 0 = T2 … 6 = CN
export const mondayOf = (s) => addDays(s, -dow0(s));
const ymOf = (s) => s.slice(0, 7);
const prevYm = (ym) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
const daysInMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const dLabel = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/* Giờ Việt Nam (UTC+7, không đổi giờ theo mùa) của một thời điểm */
export function vnNow(at = new Date()) {
  const d = new Date(at.getTime() + 7 * 3600 * 1000);
  return { date: fmtUTC(d), hhmm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

export function normReminders(r) {
  const x = { ...DEFAULT_REMINDERS, ...(r && typeof r === "object" ? r : {}) };
  const okTime = (t, def) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t)) ? String(t) : def);
  return {
    weekOn: x.weekOn !== false,
    weekDow: Math.min(7, Math.max(1, Number(x.weekDow) || 1)),
    weekTime: okTime(x.weekTime, DEFAULT_REMINDERS.weekTime),
    monthOn: x.monthOn !== false,
    monthTo: Math.min(5, Math.max(0, Number.isFinite(Number(x.monthTo)) ? Number(x.monthTo) : 2)),
    monthTime: okTime(x.monthTime, DEFAULT_REMINDERS.monthTime),
  };
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
/* v4.2 — Lượt nhắc trong ngày: lượt 0 ở đúng giờ đã chọn, lượt n ở giờ đó + n giờ.
   Lượt 0 luôn được gửi (kể cả giờ đã chọn muộn hơn REPEAT_UNTIL); các lượt nhắc lại chỉ gửi khi chưa quá REPEAT_UNTIL.
   Trả về số lượt, hoặc null nếu lúc này không gửi. */
export function slotAt(startHHMM, nowHHMM, until = REPEAT_UNTIL) {
  const start = toMin(startHHMM), now = toMin(nowHHMM);
  if (now < start) return null;
  const n = Math.floor((now - start) / REPEAT_EVERY_MIN);
  if (n > 0 && now > toMin(until)) return null;
  return n;
}

/* Các đợt nhắc đến hạn tại thời điểm `now` (giờ VN). Mỗi đợt có khoá `period` để chống gửi trùng.
   v4.2: khoá có thêm ngày và số lượt ("<kỳ>@<ngày>#<lượt>") — mỗi lượt mỗi người nhận một lần.
   - Nhắc tuần: đúng thứ đã chọn, từ giờ đã chọn trở đi → nhắc cho TUẦN TRƯỚC (thứ Hai → Chủ nhật).
   - Nhắc tháng: từ ngày cuối tháng tới ngày monthTo của tháng sau, mỗi ngày một lần, từ giờ đã chọn trở đi.
     Ngày cuối tháng → nhắc cho chính tháng đó; mùng 1…monthTo → nhắc cho tháng trước. */
export function dueReminders(cfgReminders, now) {
  const r = normReminders(cfgReminders);
  const out = [];
  const { date, hhmm } = now;
  const wSlot = r.weekOn && dow0(date) + 1 === r.weekDow ? slotAt(r.weekTime, hhmm) : null;
  if (wSlot !== null) {
    const from = addDays(mondayOf(date), -7);
    out.push({ kind: "week", period: `${from}@${date}#${wSlot}`, slot: wSlot, from, to: addDays(from, 6) });
  }
  const mSlot = r.monthOn ? slotAt(r.monthTime, hhmm) : null;
  if (mSlot !== null) {
    const ym = ymOf(date);
    const day = Number(date.slice(8, 10));
    const isLast = day === daysInMonth(ym);
    let target = null;
    if (isLast) target = ym;
    else if (day <= r.monthTo) target = prevYm(ym);
    if (target) {
      out.push({ kind: "month", period: `${target}@${date}#${mSlot}`, slot: mSlot, ym: target, from: `${target}-01`, to: `${target}-${pad(daysInMonth(target))}` });
    }
  }
  return out;
}

function holidayIndex(list = []) {
  const exact = new Set(), yearly = new Set();
  for (const h of Array.isArray(list) ? list : []) {
    if (!h?.date) continue;
    if (h.yearly) yearly.add(h.date.slice(5)); else exact.add(h.date);
  }
  return (s) => exact.has(s) || yearly.has(s.slice(5));
}

/* Ngày phải chấm mà CHƯA gửi trong [from, to], chỉ tính tới hôm nay.
   buckets: { 'YYYY-MM': value đã parse của artius_ts } của một nhân sự. */
export function missingDays({ from, to, today, hours, holidays, buckets }) {
  const h = { ...DEFAULT_HOURS, ...(hours || {}) };
  const isHoliday = holidayIndex(holidays);
  const std = (s) => { const w = dow0(s); return Number(w === 6 ? h.sun : w === 5 ? h.sat : h.weekday) || 0; };
  const legacyWeekDone = (monday) => {
    const yms = [...new Set([0, 1, 2, 3, 4, 5, 6].map((i) => ymOf(addDays(monday, i))))];
    return yms.every((ym) => buckets[ym]?.weeks?.[monday]);
  };
  const out = [];
  for (let d = from; d <= to && d <= today; d = addDays(d, 1)) {
    if (isHoliday(d) || std(d) <= 0) continue;
    if (buckets[ymOf(d)]?.sent?.[d]) continue;
    if (legacyWeekDone(mondayOf(d))) continue;
    out.push(d);
  }
  return out;
}

/* Nội dung thông báo */
export function messageFor(job, days, deadlineDay = 5) {
  const n = days.length;
  if (job.kind === "week") {
    const list = days.slice(0, 4).map((d) => `${DOW[dow0(d)]} ${dLabel(d)}`).join(", ") + (n > 4 ? "…" : ".");
    return {
      title: "ARTIUS — Nhắc nộp bảng công tuần",
      body: `Tuần ${dLabel(job.from)}–${dLabel(job.to)} bạn còn ${n} ngày chưa gửi giờ công: ${list}`,
      url: `/?tuan=${job.from}`,
    };
  }
  const [y, m] = job.ym.split("-").map(Number);
  const nextM = m === 12 ? 1 : m + 1;   // hạn chốt rơi vào tháng kế tiếp của tháng đang nhắc
  return {
    title: "ARTIUS — Nhắc chốt bảng công tháng",
    body: `Bảng công tháng ${m}/${y} còn ${n} ngày chưa gửi. Hạn chốt công: ngày ${pad(deadlineDay)}/${pad(nextM)}.`,
    url: `/?tuan=${mondayOf(days[0])}`,
  };
}
