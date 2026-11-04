/* ARTIUS TIME v12 — Kế hoạch nguồn lực: toàn bộ phép tính, không dính React, không dính giao diện.
   Đơn vị của lưới là SỐ NGƯỜI (1 / 0,5 / 0,25) đúng như file Excel đang dùng.

   Lưới lưu dạng: plan = { [mã dự án]: { [mã vai trò]: number[52] } }
   Vai trò nào không có số nào khác 0 thì không lưu, để khỏi phình dữ liệu. */
import { addDays, fmt, mondayOf, weeklyTarget } from "../../core/date.jsx";
import { isLeaveTask, isResigned } from "../../core/domain.jsx";

/* ---------- Cột tuần ----------
   Mỗi tháng đúng 4 cột tuần (T<tháng> · 1…4), mỗi năm 48 cột, không có ngoại lệ tuần 5 — giống cách đọc file Excel kế hoạch.
   Một thứ Hai thuộc tháng của chính nó; thứ Hai thứ k của tháng vào cột k, thứ Hai thứ 5 (nếu có) gộp vào cột 4.
   Chỉ số cột i chạy 0…47 trong một năm; lưới hai năm liền nhau nối tiếp 0…95. */
export const SLOTS = 4;
export const PER_YEAR = 12 * SLOTS;
const slotOfMonday = (d) => Math.min(SLOTS, Math.ceil(d.getDate() / 7));
export const weeksOfYear = (year) => {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const firstMon = mondayOf(new Date(year, m - 1, 1));
    const f = firstMon.getMonth() + 1 === m ? firstMon : addDays(firstMon, 7);   // thứ Hai đầu tiên của tháng
    for (let s = 1; s <= SLOTS; s++)
      out.push({ i: (m - 1) * SLOTS + s - 1, monday: fmt(addDays(f, (s - 1) * 7)), m, w: s, y: year, ms: s === 1 });
  }
  return out;
};
/* hai năm liền nhau trên MỘT lưới: chỉ số cột nối tiếp, w.y là năm của cột đó; ms = cột đầu tháng (vẽ nét đứt) */
export const weeksOfPair = (start) => [...weeksOfYear(start), ...weeksOfYear(start + 1).map((w) => ({ ...w, i: w.i + PER_YEAR }))];
/* chỉ số cột của một ngày trong lưới cặp năm (start, start+1); -1 nếu ngoài khoảng */
export const slotIndexOf = (start, date) => {
  const d = mondayOf(date), y = d.getFullYear();
  if (y < start || y > start + 1) return -1;
  return (y - start) * PER_YEAR + d.getMonth() * SLOTS + slotOfMonday(d) - 1;
};
/* mọi thứ Hai THẬT trong cặp năm, kèm cột kế hoạch của nó — để so giờ thực tế theo từng tuần thật (tuần 5 trỏ vào cột 4) */
export const realWeeksOfPair = (start) => {
  const out = [];
  for (let d = mondayOf(new Date(start, 0, 1)); d.getFullYear() <= start + 1; d = addDays(d, 7)) {
    const i = slotIndexOf(start, d);
    if (i >= 0) out.push({ monday: fmt(d), i });
  }
  return out;
};
/* lưới đời cũ (v12.0–v12.9) lưu 52–53 tuần ISO một năm. Đổi sang 48 cột; nhiều tuần cùng vào một cột thì lấy số lớn nhất. */
export const legacyToSlots = (arr, year) => {
  const out = Array(PER_YEAR).fill(0);
  const first = mondayOf(new Date(year, 0, 4));
  (arr || []).forEach((v, k) => {
    const d = addDays(first, k * 7);
    if (d.getFullYear() !== year) return;
    const i = slotIndexOf(year, d);
    if (i >= 0) out[i] = Math.max(out[i], Number(v) || 0);
  });
  return out;
};
export const normalizeYear = (plan, year) => {
  const out = {};
  for (const pid of Object.keys(plan || {})) {
    out[pid] = {};
    for (const rid of Object.keys(plan[pid] || {})) {
      const a = plan[pid][rid] || [];
      out[pid][rid] = a.length > PER_YEAR ? legacyToSlots(a, year) : a;
    }
  }
  return out;
};

export const weekIndexOf = (weeks, monday) => weeks.findIndex((w) => w.monday === monday);   // giữ cho tương thích

/* ghép / tách lưới theo năm: dữ liệu vẫn lưu từng năm một ở Supabase */
export const joinYears = (p1, p2, n1, n2) => {
  const out = {};
  const pad = (arr, n) => Array.from({ length: n }, (_, i) => Number(arr?.[i]) || 0);
  for (const pid of new Set([...Object.keys(p1 || {}), ...Object.keys(p2 || {})])) {
    out[pid] = {};
    for (const rid of new Set([...Object.keys(p1?.[pid] || {}), ...Object.keys(p2?.[pid] || {})]))
      out[pid][rid] = [...pad(p1?.[pid]?.[rid], n1), ...pad(p2?.[pid]?.[rid], n2)];
  }
  return out;
};
export const splitYears = (plan, n1, n2) => {
  const a = {}, b = {};
  for (const pid of Object.keys(plan || {})) {
    a[pid] = {}; b[pid] = {};
    for (const rid of Object.keys(plan[pid] || {})) {
      const arr = plan[pid][rid] || [];
      a[pid][rid] = arr.slice(0, n1);
      b[pid][rid] = arr.slice(n1, n1 + n2);
    }
  }
  return [a, b];
};

/* ---------- Quân số ----------
   head  = số người thật của vai trò (đã trừ người nghỉ việc)
   cap   = năng lực dùng được = head × hệ số sẵn sàng.
   Hệ số sẵn sàng bù cho phần giờ không đổ được vào dự án: họp, hỗ trợ việc chung, trống việc, nghỉ phép.
   Không nhân hệ số thì dòng CÒN luôn đẹp hơn thực tế và dễ nhận quá tay dự án. */
export const capacityByRole = (employees = [], availability = 0.8) => {
  const head = new Map();
  for (const e of employees) {
    if (isResigned(e) || !e.role) continue;
    head.set(e.role, (head.get(e.role) || 0) + 1);
  }
  const cap = new Map([...head].map(([k, v]) => [k, +(v * availability).toFixed(2)]));
  return { head, cap };
};

/* ---------- Đọc lưới ---------- */
export const cellOf = (plan, pid, rid, wi) => Number(plan?.[pid]?.[rid]?.[wi]) || 0;
export const rolesUsedIn = (plan, pid) =>
  Object.keys(plan?.[pid] || {}).filter((r) => (plan[pid][r] || []).some((v) => Number(v) > 0));
export const needOf = (plan, projectIds, rid, wi) =>
  projectIds.reduce((a, pid) => a + cellOf(plan, pid, rid, wi), 0);
export const leftOf = (plan, projectIds, rid, wi, cap) => (cap.get(rid) || 0) - needOf(plan, projectIds, rid, wi);
export const loadOf = (plan, projectIds, rid, wi, cap) => {
  const c = cap.get(rid) || 0;
  return c > 0 ? (needOf(plan, projectIds, rid, wi) / c) * 100 : 0;
};
/* vai trò có ít nhất một ô khác 0 trong cả năm — để khỏi vẽ 15 dòng trống cho mỗi dự án */
export const rolesInPlan = (plan, projectIds, weeks) => {
  const s = new Set();
  for (const pid of projectIds) for (const r of Object.keys(plan?.[pid] || {}))
    if (weeks.some((w) => cellOf(plan, pid, r, w.i) > 0)) s.add(r);
  return s;
};

/* ---------- Ghi lưới (bất biến, luôn trả về đối tượng mới) ---------- */
export const setCell = (plan, pid, rid, wi, v, nWeeks) => {
  const next = { ...plan, [pid]: { ...(plan[pid] || {}) } };
  const arr = (next[pid][rid] || Array(nWeeks).fill(0)).slice();
  arr[wi] = Number(v) || 0;
  next[pid][rid] = arr;   // giữ dòng cả khi toàn 0 — dòng trống chỉ bị bỏ lúc lưu (prunePlan), để gõ 0 không làm mất vai trò
  return next;
};
/* ghi nhiều ô một lượt (dán, điền cả vùng, Ctrl + D): mỗi dòng chỉ chép mảng một lần */
export const setMany = (plan, items, nWeeks) => {
  const next = { ...plan };
  const copied = new Set();
  for (const { pid, rid, wi, v } of items) {
    if (!copied.has(pid)) { next[pid] = { ...(next[pid] || {}) }; copied.add(pid); }
    const key = `${pid}|${rid}`;
    if (!copied.has(key)) { next[pid][rid] = (next[pid][rid] || Array(nWeeks).fill(0)).slice(); copied.add(key); }
    next[pid][rid][wi] = Number(v) || 0;
  }
  return next;
};
/* gộp vai trò trong kế hoạch (vd TL-2D → 2D): dòng của vai trò con cộng dồn vào vai trò cha rồi bỏ dòng con */
export const foldMerged = (plan, prole) => {
  let changed = false;
  const out = {};
  for (const pid of Object.keys(plan || {})) {
    const byRole = plan[pid] || {};
    if (!Object.keys(byRole).some((rid) => prole(rid) !== rid)) { out[pid] = byRole; continue; }
    changed = true;
    const next = {};
    for (const rid of Object.keys(byRole)) if (prole(rid) === rid) next[rid] = byRole[rid].slice();
    for (const rid of Object.keys(byRole)) {
      const to = prole(rid); if (to === rid) continue;
      const src = byRole[rid] || [], dst = next[to] || Array(src.length).fill(0);
      next[to] = dst.map((v, i) => Math.min(99, (Number(v) || 0) + (Number(src[i]) || 0)));
    }
    out[pid] = next;
  }
  return { plan: changed ? out : plan, changed };
};
/* bỏ mảng rỗng trước khi lưu */
export const prunePlan = (plan) => {
  const out = {};
  for (const pid of Object.keys(plan || {})) {
    const byRole = {};
    for (const r of Object.keys(plan[pid] || {})) {
      const arr = plan[pid][r] || [];
      if (arr.some((v) => Number(v) > 0)) byRole[r] = arr.map((v) => Number(v) || 0);
    }
    if (Object.keys(byRole).length) out[pid] = byRole;
  }
  return out;
};

/* ---------- Giờ thực tế quy ra số người ----------
   Vai trò lấy theo VAI TRÒ CỦA NGƯỜI chấm (nhân sự chỉ có một vai trò), vì dòng chấm công không mang vai trò.
   Giờ vắng mặt và giờ không thuộc dự án nào bị loại — đây là giờ đổ vào dự án.
   Quy đổi: số người = giờ ÷ giờ chuẩn một tuần (lấy từ Thiết lập). */
export const actualByCell = (detail = [], employees = [], hoursCfg) => {
  const roleBy = new Map(employees.map((e) => [e.id, e.role || ""]));
  const target = weeklyTarget(hoursCfg) || 44;
  const m = new Map();   // "pid|rid|monday" -> giờ
  for (const d of detail) {
    if (!d.projectId || isLeaveTask(d.taskId)) continue;
    const rid = roleBy.get(d.empId); if (!rid) continue;
    const monday = fmt(mondayOf(new Date(d.date)));
    const k = `${d.projectId}|${rid}|${monday}`;
    m.set(k, (m.get(k) || 0) + d.hours);
  }
  const out = new Map();
  for (const [k, h] of m) out.set(k, +(h / target).toFixed(3));
  return out;
};

/* ---------- Kế hoạch so với thực tế ----------
   Chỉ cộng các tuần ĐÃ QUA và ĐÃ ĐỦ GIỜ (mọi nhân sự trong bộ lọc đều đã gửi tuần đó).
   Tuần nào còn người chưa gửi thì bỏ hẳn, vì nếu tính vào sẽ luôn ra "dự án dùng ít người hơn kế hoạch". */
export const planVsActual = ({ plan, projects, weeks, okWeeks, actual }) => {
  const rows = [];
  for (const p of projects) {
    for (const rid of Object.keys(plan?.[p.id] || {})) {
      let kh = 0, th = 0, n = 0;
      for (const w of weeks) {
        if (!okWeeks.has(w.monday)) continue;
        kh += cellOf(plan, p.id, rid, w.i);
        th += actual.get(`${p.id}|${rid}|${w.monday}`) || 0;
        n++;
      }
      if (kh < 0.05 && th < 0.05) continue;
      const pc = kh > 0.05 ? Math.round((th / kh) * 100) : null;
      rows.push({ pid: p.id, project: p, rid, kh: +kh.toFixed(2), th: +th.toFixed(2), pc, weeks: n });
    }
  }
  return rows.sort((a, b) => Math.abs((b.pc ?? 100) - 100) - Math.abs((a.pc ?? 100) - 100));
};
export const verdictOf = (pc) =>
  pc == null ? ["Chưa so được", "text-slate-500"]
    : pc > 115 ? ["Dự trù thiếu người", "text-rose-400"]
      : pc < 85 ? ["Dự trù thừa người", "text-sky-400"]
        : ["Kế hoạch sát", "text-teal-400"];

/* ---------- Cảnh báo thiếu người ---------- */
export const shortages = ({ plan, projectIds, roles, weeks, cap, from = 0, count = 12, limit = 8 }) => {
  const out = [];
  for (const w of weeks.slice(from, from + count)) {
    for (const r of roles) {
      const lf = leftOf(plan, projectIds, r.id, w.i, cap);
      if (lf < -0.01) out.push({ w, role: r, short: +(-lf).toFixed(2), need: needOf(plan, projectIds, r.id, w.i) });
    }
  }
  return out.sort((a, b) => a.w.i - b.w.i || b.short - a.short).slice(0, limit);
};

/* ---------- v13.32: phục vụ các tiện ích nhập liệu ---------- */

/* Các ô khác nhau giữa hai lưới, trả về Set khoá "pid|rid|wi".
   Dùng để chấm dấu ô đã sửa kể từ lần lưu cuối. Ô 0 ↔ không có dòng được coi là GIỐNG nhau,
   vì lúc lưu prunePlan bỏ dòng toàn 0 — không thì vừa lưu xong đã thấy cả loạt ô báo "đã sửa". */
export const diffCells = (a, b, nWeeks) => {
  const out = new Set();
  const pids = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const pid of pids) {
    const ra = a?.[pid] || {}, rb = b?.[pid] || {};
    for (const rid of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
      const x = ra[rid] || [], y = rb[rid] || [];
      for (let i = 0; i < nWeeks; i++) if ((Number(x[i]) || 0) !== (Number(y[i]) || 0)) out.add(`${pid}|${rid}|${i}`);
    }
  }
  return out;
};

/* Các dự án đang ăn vào một vai trò ở một tuần, nhiều trước ít sau — để truy nguyên ô CÒN đỏ. */
export const contribOf = (plan, projectIds, rid, wi) => projectIds
  .map((pid) => ({ pid, v: cellOf(plan, pid, rid, wi) }))
  .filter((x) => x.v > 0)
  .sort((x, y) => y.v - x.v);
