/* ARTIUS TIME v12 — Kế hoạch nguồn lực: toàn bộ phép tính, không dính React, không dính giao diện.
   Đơn vị của lưới là SỐ NGƯỜI (1 / 0,5 / 0,25) đúng như file Excel đang dùng.

   Lưới lưu dạng: plan = { [mã dự án]: { [mã vai trò]: number[52] } }
   Vai trò nào không có số nào khác 0 thì không lưu, để khỏi phình dữ liệu. */
import { addDays, fmt, mondayOf, weeklyTarget } from "../../core/date.jsx";
import { isLeaveTask, isResigned } from "../../core/domain.jsx";

export const HALF = 26;   // lưới hiện nửa năm một lần

/* ---------- Tuần trong năm ----------
   Theo chuẩn ISO: tuần 1 là tuần chứa ngày 4 tháng 1. Nhãn hiện "T<tháng> · <tuần thứ mấy trong tháng>"
   cho giống cách đọc của file Excel. */
export const weeksOfYear = (year) => {
  const first = mondayOf(new Date(year, 0, 4));
  const out = [];
  for (let i = 0; i < 53; i++) {
    const d = addDays(first, i * 7);
    if (i >= 52 && d.getFullYear() !== year) break;
    const m = d.getMonth() + 1;
    out.push({ i, monday: fmt(d), m, w: out.filter((x) => x.m === m).length + 1 });
  }
  return out;
};
export const weekIndexOf = (weeks, monday) => weeks.findIndex((w) => w.monday === monday);

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
export const copyWeek = (plan, projectIds, from, to, nWeeks) => {
  const next = { ...plan };
  for (const pid of projectIds) {
    const byRole = next[pid]; if (!byRole) continue;
    next[pid] = { ...byRole };
    for (const r of Object.keys(next[pid])) {
      const arr = next[pid][r].slice(); arr[to] = arr[from]; next[pid][r] = arr;
    }
  }
  return next;
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
