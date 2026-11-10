/* ARTIUS TIME v12 — Kế hoạch nguồn lực: toàn bộ phép tính, không dính React, không dính giao diện.
   Đơn vị của lưới là SỐ NGƯỜI (1 / 0,5 / 0,25) đúng như file Excel đang dùng.

   Lưới lưu dạng: plan = { [mã dự án]: { [mã vai trò]: number[52] } }
   Vai trò nào không có số nào khác 0 thì không lưu, để khỏi phình dữ liệu. */
import { addDays, fmt, makeHolidayIndex, minHoursFor, mondayOf, weekDays, weeklyTarget } from "../../core/date.jsx";
import { NO_PROJECT, goneOnDay, isLeaveTask, isResigned } from "../../core/domain.jsx";

/* ---------- Cột tuần ----------
   Mỗi tháng đúng 4 cột tuần (T<tháng> · 1…4), mỗi năm 48 cột, không có ngoại lệ tuần 5 — giống cách đọc file Excel kế hoạch.
   Một thứ Hai thuộc tháng của chính nó; thứ Hai thứ k của tháng vào cột k, thứ Hai thứ 5 (nếu có) gộp vào cột 4.
   Chỉ số cột i chạy 0…47 trong một năm; lưới hai năm liền nhau nối tiếp 0…95. */
export const SLOTS = 4;
export const PER_YEAR = 12 * SLOTS;
/* v13.65 — số năm liền nhau trên lưới kế hoạch. Trước đây ResourcePlan giữ riêng hằng số 4, còn
   So với thực tế cứng 2 năm, nên từ năm thứ 3 của lưới, chọn "So với: bản chốt" ra kế hoạch bằng 0. */
export const PLAN_YEARS = 4;
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
/* v13.37 — NHIỀU NĂM liền nhau trên MỘT lưới cuộn ngang, không ngắt ở tháng 12:
   chỉ số cột chạy liên tục 0 … nYears*48-1, w.y là năm của cột đó; ms = cột đầu tháng (vẽ nét đứt).
   Trước đây lưới chỉ gồm đúng hai năm (weeksOfPair) nên hết tháng 12 năm sau là phải đổi ô chọn năm. */
export const weeksOfYears = (start, nYears) => {
  const out = [];
  for (let k = 0; k < nYears; k++) for (const w of weeksOfYear(start + k)) out.push({ ...w, i: w.i + k * PER_YEAR });
  return out;
};
/* chỉ số cột của một ngày trong lưới nhiều năm; -1 nếu ngoài khoảng */
export const slotIndexOf = (start, date, nYears = 2) => {
  const d = mondayOf(date), y = d.getFullYear();
  if (y < start || y > start + nYears - 1) return -1;
  return (y - start) * PER_YEAR + d.getMonth() * SLOTS + slotOfMonday(d) - 1;
};
/* mọi thứ Hai THẬT trong khoảng, kèm cột kế hoạch của nó — để so giờ thực tế theo từng tuần thật (tuần 5 trỏ vào cột 4) */
export const realWeeksOfYears = (start, nYears) => {
  const out = [];
  for (let d = mondayOf(new Date(start, 0, 1)); d.getFullYear() <= start + nYears - 1; d = addDays(d, 7)) {
    const i = slotIndexOf(start, d, nYears);
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

/* ghép / tách lưới theo năm: dữ liệu vẫn lưu TỪNG NĂM MỘT ở Supabase, chỉ gộp lại khi hiện lên lưới.
   v13.37 — nhận một MẢNG các năm thay vì đúng hai năm. */
export const joinYears = (parts) => {
  const out = {};
  const pad = (arr) => Array.from({ length: PER_YEAR }, (_, i) => Number(arr?.[i]) || 0);
  const pids = new Set(parts.flatMap((p) => Object.keys(p || {})));
  for (const pid of pids) {
    out[pid] = {};
    for (const rid of new Set(parts.flatMap((p) => Object.keys(p?.[pid] || {}))))
      out[pid][rid] = parts.flatMap((p) => pad(p?.[pid]?.[rid]));
  }
  return out;
};
/* v13.37 — tách lưới nhiều năm thành mảng từng năm, đúng thứ tự năm */
export const splitYears = (plan, nYears) => {
  const out = Array.from({ length: nYears }, () => ({}));
  for (const pid of Object.keys(plan || {})) {
    for (let k = 0; k < nYears; k++) out[k][pid] = {};
    for (const rid of Object.keys(plan[pid] || {})) {
      const arr = plan[pid][rid] || [];
      for (let k = 0; k < nYears; k++) out[k][pid][rid] = arr.slice(k * PER_YEAR, (k + 1) * PER_YEAR);
    }
  }
  return out;
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
/* Dọn trước khi lưu.
   v13.33 — GIỮ cả dòng toàn 0. Trước đây dòng toàn 0 bị bỏ, nên danh sách vai trò của một dự án
   thực chất là "những vai trò đang có số". Hệ quả: thêm một vai trò rồi chưa kịp gõ số thì F5 là mất,
   và gỡ một vai trò chưa có số thì không lưu được gì — mở lại vẫn thấy y như chưa gỡ (vì dự án rỗng
   sẽ được điền lại bộ vai trò cơ bản). Giữ dòng 0 thì danh sách vai trò đúng bằng những gì đang thấy.
   Dự án không còn dòng nào vẫn bị bỏ: không có cách nào ghi "dự án rỗng" xuống bảng. */
export const prunePlan = (plan) => {
  const out = {};
  for (const pid of Object.keys(plan || {})) {
    const byRole = {};
    for (const r of Object.keys(plan[pid] || {})) byRole[r] = (plan[pid][r] || []).map((v) => Number(v) || 0);
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

/* v13.42 — ngưỡng kết luận của màn "So với thực tế", trước đây gắn cứng trong PlanActual.
   tol: lệch tổng trong bao nhiêu % kế hoạch thì coi là "đúng kế hoạch" (mặc định 15).
   mix: tổng sai lệch theo vai trò vượt bao nhiêu % kế hoạch thì là "đủ người nhưng sai vai trò" (mặc định 30). */
export const planLimits = (cfg) => ({
  tol: Math.min(100, Math.max(1, Number(cfg?.planTol ?? 15))),
  mix: Math.min(200, Math.max(1, Number(cfg?.planMix ?? 30))),
});


/* ======================================================================================
   v13.59 — SO KẾ HOẠCH VỚI THỰC TẾ: một hàm duy nhất, dùng chung cho màn "So với thực tế" và file Excel.
   Trước đây màn hình và Excel chạy hai bộ luật khác nhau (Excel còn công thức đời v12), nên cùng một dự án
   hai nơi nói hai kiểu.

   Quy tắc:
   · Đơn vị NGƯỜI. Kế hoạch là số trong ô lưới. Thực tế = giờ đổ vào dự án ÷ GIỜ CHUẨN CỦA CHÍNH TUẦN ĐÓ
     (Thiết lập giờ làm, trừ ngày lễ). Trước đây chia cứng 44 h nên tuần có lễ dự án nào cũng thấp giả
     ~18% mỗi ngày lễ. Tuần nghỉ trọn (Tết) không có giờ chuẩn thì quy đổi theo tuần thường.
   · Tuần ĐANG CHẠY (runMon): so TRỌN NGÀY, tới hết HÔM QUA cho cả hai phía — kế hoạch cắt theo giờ chuẩn
     các ngày đã trọn, thực tế chỉ lấy giờ (kể cả nháp) của các ngày đó. Hôm nay và ngày chưa tới chưa tính.
   · Vai trò theo VAI TRÒ CỦA NGƯỜI chấm. Giờ vắng mặt / không thuộc dự án → "việc chung / vắng".
   · Người "chưa gửi đủ": có ngày làm việc đã qua (có giờ chuẩn, trước hôm nay) mà không có giờ nào —
     đúng luật "Bỏ trống ngày" của Bảng công. Trước đây chỉ xét có hay không có giờ trong tuần.
   ====================================================================================== */
export const PA_GROUPS = { none: "Có kế hoạch, chưa ai làm", out: "Làm ngoài kế hoạch", mix: "Đủ người nhưng sai vai trò",
  over: "Thực tế nhiều hơn kế hoạch", under: "Thực tế ít hơn kế hoạch", ok: "Đúng kế hoạch" };
export const PA_ORDER = { none: 0, out: 1, mix: 2, over: 3, under: 4, ok: 5 };
export const paVerdict = (o) => o.st === "over" ? `Vượt ${o.KH ? Math.round((o.d / o.KH) * 100) : 0}%`
  : o.st === "under" ? `Thấp hơn ${o.KH ? Math.round((-o.d / o.KH) * 100) : 0}%`
    : { none: "Chưa ai làm", out: "Ngoài kế hoạch", mix: "Đủ người, lệch vai trò", ok: "Đúng kế hoạch" }[o.st];

export function comparePlan({ plan: P, projects, roles, weeks, sent = [], draft = [], staff, hoursCfg, holidays = [],
  lim = { tol: 15, mix: 30 }, hidden = new Set(), runMon = "", today = fmt(new Date()) }) {
  const hs = makeHolidayIndex(holidays);
  const full = weeklyTarget(hoursCfg) || 44;
  const projIds = new Set(projects.map((p) => p.id));
  const liveIds = new Set(projects.filter((p) => p.active && !hidden.has(p.id)).map((p) => p.id));
  const roleOf = new Map(staff.map((e) => [e.id, e.role || ""]));
  const stdOn = (d) => minHoursFor(d, hoursCfg, hs) || 0;
  const nW = weeks.length || 1;

  /* giờ chuẩn từng tuần + các ngày được tính */
  const wk = weeks.map((w) => {
    const days = weekDays(w.monday), run = w.monday === runMon;
    const std = days.reduce((a, d) => a + stdOn(d), 0);
    const upto = run ? days.filter((d) => d < today) : days;
    const got = upto.reduce((a, d) => a + stdOn(d), 0);
    return { w, run, std, D: std > 0 ? std : full, frac: run ? (std > 0 ? got / std : 0) : 1, days: new Set(upto) };
  });
  const kOf = new Map(weeks.map((w, k) => [w.monday, k]));

  /* gom giờ theo tuần — nháp chỉ nhận của tuần đang chạy */
  const bucket = weeks.map(() => []);
  const seen = weeks.map(() => new Set());   // "emp|ngày" có giờ (đã gửi, hoặc nháp của tuần đang chạy)
  const put = (d, dr) => {
    const k = kOf.get(fmt(mondayOf(new Date(d.date)))); if (k == null) return;
    if (dr && !wk[k].run) return;
    if (!wk[k].days.has(d.date)) return;
    const h = Number(d.hours) || 0; if (!h) return;
    bucket[k].push({ empId: d.empId, pid: d.projectId, task: d.taskId, h, dr });
    seen[k].add(`${d.empId}|${d.date}`);
  };
  for (const d of sent) put(d, false);
  for (const d of draft) put(d, true);

  const rows = new Map();
  const get = (pid) => { if (!rows.has(pid)) rows.set(pid, { pid, kh: {}, tt: {}, ppl: new Map(), dr: 0, drp: new Map(), wk: weeks.map(() => ({ kh: 0, tt: 0 })) }); return rows.get(pid); };
  let common = 0, total = 0, drft = 0;
  const per = new Map();
  const add = (e, k, h) => { if (!per.has(e)) per.set(e, new Map()); const m = per.get(e); m.set(k, (m.get(k) || 0) + h); };
  wk.forEach(({ w, D, frac }, k) => {
    for (const pid of Object.keys(P || {})) {
      if (!liveIds.has(pid)) continue;
      for (const r of roles) {
        const v = cellOf(P, pid, r.id, w.i) * frac; if (!v) continue;
        const o = get(pid); o.kh[r.id] = (o.kh[r.id] || 0) + v / nW; o.wk[k].kh += v;
      }
    }
    for (const x of bucket[k]) {
      total += x.h; if (x.dr) drft += x.h;
      if (!x.pid || x.pid === NO_PROJECT || !projIds.has(x.pid) || isLeaveTask(x.task)) { common += x.h; add(x.empId, "", x.h); continue; }
      add(x.empId, x.pid, x.h);
      const rid = roleOf.get(x.empId); if (!rid) continue;
      const o = get(x.pid);
      o.tt[rid] = (o.tt[rid] || 0) + x.h / D / nW; o.wk[k].tt += x.h / D;
      o.ppl.set(x.empId, (o.ppl.get(x.empId) || 0) + x.h);
      if (x.dr) { o.dr += x.h; o.drp.set(x.empId, (o.drp.get(x.empId) || 0) + x.h); }
    }
  });

  const sum = (o) => Object.values(o).reduce((a, v) => a + v, 0);
  const list = [...rows.values()].map((o) => {
    const p = projects.find((x) => x.id === o.pid) || { id: o.pid, name: o.pid };
    const KH = sum(o.kh), TT = sum(o.tt), d = TT - KH;
    const mis = roles.reduce((a, r) => a + Math.abs((o.tt[r.id] || 0) - (o.kh[r.id] || 0)), 0);
    const st = KH < 0.005 && TT > 0 ? "out" : TT < 0.005 && KH > 0 ? "none"
      : Math.abs(d) <= Math.max(0.25, (KH * lim.tol) / 100) ? (mis > Math.max(0.5, (KH * lim.mix) / 100) ? "mix" : "ok") : d > 0 ? "over" : "under";
    const okR = roles.reduce((a, r) => a + Math.min(o.kh[r.id] || 0, o.tt[r.id] || 0), 0);
    return { ...o, p, KH, TT, d, st, okR };
  }).filter((o) => o.KH > 0.005 || o.TT > 0.005);
  list.sort((a, b) => PA_ORDER[a.st] - PA_ORDER[b.st] || Math.abs(b.d) - Math.abs(a.d));

  /* người chưa gửi đủ — có ngày làm việc đã qua mà trống giờ */
  const who = staff.filter((e) => e.role);
  const gap = wk.map(({ w, days }, k) => ({
    w,
    miss: who.filter((e) => [...days].some((d) => d < today && stdOn(d) > 0 && !goneOnDay(e, d) && !seen[k].has(`${e.id}|${d}`))),
  })).filter((x) => x.miss.length);
  const gapNames = [...new Set(gap.flatMap((x) => x.miss.map((e) => e.name || e.id)))];
  const lastGap = gap.find((x) => x.w.monday === weeks[weeks.length - 1]?.monday);

  /* 1 người = bao nhiêu giờ (giờ chuẩn CẢ TUẦN, có trừ lễ), bình quân các tuần trong khoảng — để đổi sang
     đơn vị Giờ. Khoảng một tuần thì đúng tuyệt đối; nhiều tuần có tuần lễ xen giữa thì đơn vị Giờ là xấp xỉ. */
  const hpp = wk.length ? wk.reduce((a, x) => a + x.D, 0) / wk.length : full;
  return { list, common, total, drft, per, wk, hpp, full,
    missing: lastGap ? lastGap.miss.length : 0, gapWeeks: gap.length, gapNames, nStaff: who.length };
}
