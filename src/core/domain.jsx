/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect } from "react";
import { DEFAULT_HOURS, addDays, fmt, mondayOf, pad, parseD } from "./date.jsx";
import { isLight } from "./theme.jsx";

/* ------------------------------------------------------------------
   DỮ LIỆU TRONG BỘ NHỚ + ĐỌC/GHI THEO TỪNG DÒNG (v1.8)
   App đọc dữ liệu một lần lúc đăng nhập rồi giữ trong DB để mọi màn hình tra cứu tức thì.
   Khi ghi thì KHÔNG ghi lại cả khối như trước: thiết lập ghi vào dòng thiết lập, bảng công
   ghi đúng dòng (nhân sự, tháng) vừa sửa. Nhờ đó người này lưu không đè dữ liệu người kia.
   ------------------------------------------------------------------ */
export let OT_PENDING = -1;      // v6.3: >= 0 = cấu hình vừa chuyển sang khung tăng ca chung, chưa lưu (số hạng mục [OT] đã gỡ)
export let OT_MIG_NOTE = "";     // thông báo một lần ở Thiết lập → Tăng ca sau khi chuyển đổi
/* v11 — tách file: biến chung chỉ được đổi qua hàm đặt giá trị, vì file khác chỉ ĐỌC được biến nhập vào. */
export const setOtPending = (n) => { OT_PENDING = n; };
export const setOtMigNote = (t) => { OT_MIG_NOTE = t; };
export const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const f = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
};

/* ---------- catalog mặc định ---------- */
export const DEFAULT_TASKS = [
  { id: "t17", name: "Họp & trình bày khách hàng", group: "Chung", depts: [] },
  { id: "t18", name: "Nghiệm thu / bàn giao", group: "Chung", depts: [] },
  { id: "t19", name: "Chỉnh sửa theo yêu cầu (revision)", group: "Chung", depts: [] },
];
export const DEFAULT_DEPTS = ["Thiết kế", "Thi công", "Xưởng", "BOQ", "HR / Back office", "Ban giám đốc"];
/* DEPTS là bản sống: App chép cfg.depts vào đây ở mỗi lần render (syncDepts).
   "Ban giám đốc" (DEPTS_SEE_ALL) luôn có mặt và cố định vì quyết định quyền xem toàn bộ tác vụ. */
export const DEPTS = [...DEFAULT_DEPTS];
export const syncDepts = (list) => {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_DEPTS;
  DEPTS.splice(0, DEPTS.length, ...src);
};
// Bộ phận thấy được toàn bộ hạng mục, không giới hạn theo chuyên môn
export const DEPTS_SEE_ALL = ["Ban giám đốc"];

/* Vai trò — cấp nhỏ hơn bộ phận. Trong bộ phận Thiết kế, mỗi người làm một mảng chuyên môn
   nên danh sách tác vụ phải theo vai trò, không thể dùng chung một danh sách cho cả phòng. */
export const DEFAULT_ROLES = [
  { id: "ARC", name: "Kiến trúc", dept: "Thiết kế" },
  { id: "ID", name: "Nội thất", dept: "Thiết kế" },
  { id: "3D", name: "Diễn hoạ 3D", dept: "Thiết kế" },
  { id: "2D", name: "Triển khai bản vẽ", dept: "Thiết kế" },
  { id: "TL", name: "Team Leader", dept: "Thiết kế" },
];
/* ROLES là bản sống: App chép cfg.roles vào đây ở mỗi lần render (syncRoles) để các hàm tra cứu
   toàn cục như roleInfo / roleLabel và mọi ô chọn vai trò luôn thấy đúng danh sách quản lý đã sửa. */
export const ROLES = DEFAULT_ROLES.map((r) => ({ ...r }));
export const syncRoles = (list) => {
  const src = Array.isArray(list) ? list : DEFAULT_ROLES;
  ROLES.splice(0, ROLES.length, ...src);
};
export const roleInfo = (id) => ROLES.find((r) => r.id === id) || null;
export const roleLabel = (id) => { const r = roleInfo(id); return r ? `${r.id} · ${r.name}` : ""; };
// Tên vai trò hiển thị cho nhân sự (VD "Team Leader"), không kèm mã
export const roleTitle = (id) => roleInfo(id)?.name || "";

/* Hạng mục cũ chưa khai bộ phận thì suy từ nhóm, để dữ liệu có sẵn vẫn dùng được ngay.
   depts rỗng nghĩa là hạng mục dùng chung — mọi bộ phận đều chọn được. */
export const GROUP_DEPTS = { "Thiết kế": ["Thiết kế"], "Xưởng": ["Xưởng"], "Thi công": ["Thi công"], "BOQ": ["BOQ"] };
export const taskDepts = (t) => {
  if (Array.isArray(t.depts)) return t.depts;
  return GROUP_DEPTS[t.group] || [];
};
export const taskRoles = (t) => (Array.isArray(t.roles) ? t.roles : []);
/* Từ v1.5 không còn tác vụ cấp bộ phận: tác vụ hoặc gắn vai trò, hoặc dùng chung. */
export const isDeptTask = (t) => taskRoles(t).length === 0 && taskDepts(t).length > 0;
/* Thứ tự xét: tác vụ gắn vai trò thì chỉ đúng vai trò đó thấy; không gắn vai trò là tác vụ dùng chung, ai cũng thấy. */
export const taskVisibleTo = (t, dept, role) => {
  if (!dept || DEPTS_SEE_ALL.includes(dept)) return true;
  const rs = taskRoles(t);
  if (rs.length) return !!role && rs.includes(role);
  return true;
};
export const tasksForDept = (tasks = [], dept, role) => tasks.filter((t) => taskVisibleTo(t, dept, role));
// nhãn hiển thị: có mã thì đưa mã lên trước cho dễ đối chiếu với bảng vai trò
export const taskText = (t) => (t?.code ? `${t.code} · ${t.name}` : t?.name || "");
/* v3.2 — hạng mục tăng ca: tên bắt đầu bằng "[OT]" thì tách riêng nhóm "Tăng ca" ở màn chấm công,
   hiển thị bỏ chữ [OT] (VD "[OT] 17:30 - 21:00" → "17:30 – 21:00"). Không cần sửa dữ liệu. */
export const isOtTask = (t) => /^\s*\[\s*ot\s*\]/i.test(t?.name || "");
// v3.4: bản sống các id hạng mục Tăng ca — App chép từ cfg.tasks mỗi lần render (như ROLES), để mọi hàm tính giờ tra được
export const OT_IDS = new Set();
/* v6.3 — Tăng ca là CÀI ĐẶT CHUNG (Thiết lập → Tăng ca): cfg.otBands = [{ id, from: "17:30", to: "21:00", rate }].
   Mỗi khung giờ thành một "hạng mục ảo" (như LEAVE_TASKS) tên "[OT] 17:30 - 21:00", nên mọi hàm cũ (isOtTask, otSpan,
   otBandKey…) chạy như trước. Dòng tăng ca lưu taskId = mã khung (OTB_…), mã cố định kể cả khi đổi giờ của khung.
   cfg.otLegacy = { <mã hạng mục [OT] cũ>: <mã khung> }: dòng chấm trước v6.3 giữ nguyên mã cũ trong dữ liệu
   (database khoá ngày đã gửi theo mã), app đọc mã cũ như khung tương ứng. */
export const OT_TASKS = [];
export const otBandName = (b) => `[OT] ${b.from} - ${b.to}`;
export const syncOtBands = (c) => {
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
export const otBandTasks = () => OT_TASKS.filter((t) => t.band);
export const isOtId = (id) => OT_IDS.has(id);
export const otText = (t) => (t?.name || "").replace(/^\s*\[\s*ot\s*\]\s*/i, "").replace(/\s+-\s+/g, " – ");
/* v4.9 — Khung giờ của hạng mục tăng ca, đọc từ tên ("[OT] 17:30 - 21:00" → 17:30 tới 21:00).
   Khung qua nửa đêm (22:00 - 0:00, 0:00 - 8:00) tự cộng 24h. Tên không đúng mẫu thì không giới hạn số giờ. */
export const otSpan = (t) => {
  const m = /(\d{1,2})[:h.](\d{2})\s*[-–]\s*(\d{1,2})[:h.](\d{2})/.exec(otText(t));
  if (!m) return null;
  const a = +m[1] * 60 + +m[2]; let b = +m[3] * 60 + +m[4];
  if (b <= a) b += 1440;
  return { start: a, hours: (b - a) / 60 };
};
export const otMaxHours = (t) => otSpan(t)?.hours ?? 24;
/* v5.1 — Khoá khung giờ: các hạng mục [OT] của nhiều vai trò cùng giờ (17:30 - 21:00…) là CÙNG một khung. */
export const otBandKey = (t) => { const sp = otSpan(t); return sp ? `${sp.start}+${sp.hours}` : otText(t).replace(/\s+/g, "").toLowerCase(); };
// Danh sách khung giờ không trùng, theo thứ tự xuất hiện: [{ key, label, task, ids }]
export const otBandList = (tasks = []) => {
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
export const otDefaultRate = (t) => { const sp = otSpan(t); return sp && sp.start >= 17 * 60 && sp.start < 21 * 60 ? 1.5 : 2; };
export const otRateOf = (cfg, t) => {
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
export const otDayKind = (d, holidaySet) => (holidaySet?.has(d) ? "h" : parseD(d).getDay() === 0 ? "s" : "n");
export const otSpecialRate = (cfg, kind) => {
  const v = kind === "h" ? cfg?.otHolRate : kind === "s" ? cfg?.otSunRate : null;
  return v != null && v !== "" && Number(v) > 0 ? Number(v) : null;
};
export const otRateFor = (cfg, t, kind) => otSpecialRate(cfg, kind) ?? otRateOf(cfg, t);
/* v6.3 — mã khung giờ suy từ giờ bắt đầu + số giờ (VD 17:30 – 21:00 → OTB_1050_3.5), để mọi máy chuyển đổi ra cùng một mã */
export const otBandIdFor = (from, to) => { const sp = otSpan({ name: `[OT] ${from} - ${to}` }); return sp ? `OTB_${sp.start}_${sp.hours}` : `OTB_${uid("x")}`; };
export const DEFAULT_OT_BANDS = () => [["17:30", "21:00", 1.5], ["21:00", "0:00", 2], ["0:00", "8:00", 2]]
  .map(([from, to, rate]) => ({ id: otBandIdFor(from, to), from, to, rate }));
export const otHM = (min) => `${Math.floor((min % 1440) / 60)}:${pad(min % 60)}`;
/* Chuyển cấu hình cũ (hạng mục [OT] theo vai trò) sang khung giờ chung. Trả về { cfg, moved } — moved = số hạng mục [OT] đã gỡ.
   Không đụng tới dữ liệu bảng công: mã hạng mục cũ ghi vào otLegacy. */
export const migrateOtCfg = (c) => {
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
export const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
// bảng màu lặp lại theo thứ tự dự án, dùng cho biểu đồ cột chồng theo dự án
export const PROJECT_COLORS = ["#2dd4bf", "#f59e0b", "#a78bfa", "#f472b6", "#60a5fa", "#facc15", "#34d399", "#fb7185", "#38bdf8", "#c084fc"];
/* Giai đoạn dự án — cho biết giờ công đổ vào chặng nào, tách bạch với "hạng mục công việc"
   (hạng mục nói làm việc gì, giai đoạn nói việc đó thuộc chặng nào của dự án) */
/* v1.9 — Giai đoạn do quản lý sửa được ở tab Thiết lập (cfg.phases = [{ id, name, desc, active }]).
   Mã P1, P2… cố định theo thứ tự tạo; màu suy từ số trong mã. Giai đoạn "ngừng dùng" (active = false) không chọn được
   khi chấm công nhưng vẫn hiện trong báo cáo. PHASES là bản sống: App chép cfg.phases vào đây ở mỗi lần render. */
export const PHASE_COLORS = ["#f59e0b", "#2dd4bf", "#38bdf8", "#a78bfa", "#f472b6", "#a3e635", "#fb923c", "#22d3ee"];
/* v7.8 — màu dự án / giai đoạn bản đậm cho giao diện Sáng (màu sáng của bản Tối bị nhạt trên nền trắng) */
export const TONE_L = { "#2dd4bf": "#0d9488", "#f59e0b": "#d97706", "#a78bfa": "#7c3aed", "#f472b6": "#db2777", "#60a5fa": "#2563eb", "#facc15": "#ca8a04",
  "#34d399": "#059669", "#fb7185": "#e11d48", "#38bdf8": "#0284c7", "#c084fc": "#9333ea", "#a3e635": "#65a30d", "#fb923c": "#ea580c",
  "#22d3ee": "#0891b2", "#4ade80": "#16a34a", "#f87171": "#dc2626" };
export const tone = (hex) => (hex && isLight() ? TONE_L[String(hex).toLowerCase()] || hex : hex);
/* v9.5 — màu CHỮ nhỏ của giai đoạn trên nền sáng: đậm hơn màu tô (thanh, chấm) để đạt 4.5:1 */
export const TONE_T = { "#d97706": "#a64a07", "#0d9488": "#0d6e66", "#7c3aed": "#6d28d9", "#db2777": "#be185d", "#2563eb": "#1d4ed8", "#ca8a04": "#92400e",
  "#059669": "#047857", "#e11d48": "#be123c", "#0284c7": "#0369a1", "#9333ea": "#7e22ce", "#65a30d": "#4d7c0f", "#ea580c": "#c2410c",
  "#0891b2": "#0e7490", "#16a34a": "#15803d", "#dc2626": "#b91c1c" };
export const toneT = (hex) => (hex && isLight() ? TONE_T[String(hex).toLowerCase()] || hex : hex);
export const phaseColor = (id) => PHASE_COLORS[((parseInt(String(id).replace(/\D/g, ""), 10) || 1) - 1) % PHASE_COLORS.length];
export const DEFAULT_PHASES = [
  { id: "P1", name: "Đấu thầu", desc: "Khảo sát sơ bộ, nghiên cứu, concept đấu thầu, báo giá, hồ sơ proposal", active: true },
  { id: "P2", name: "Thiết kế", desc: "Concept, phát triển thiết kế, 3D, hồ sơ kỹ thuật, phối hợp thiết kế", active: true },
  { id: "P3", name: "Thi công", desc: "Shopdrawing, RFI, material, xử lý hiện trường, điều chỉnh thiết kế", active: true },
  { id: "P4", name: "Bàn giao", desc: "As-built, snagging, hoàn thiện hồ sơ, nghiệm thu, lưu trữ", active: true },
];
export const PHASES = DEFAULT_PHASES.map((x) => ({ ...x, color: phaseColor(x.id) }));
export const syncPhases = (list) => {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_PHASES;
  PHASES.splice(0, PHASES.length, ...src.map((x) => ({ ...x, active: x.active !== false, color: phaseColor(x.id) })));
};
export const activePhases = () => PHASES.filter((x) => x.active);
export const firstActivePhase = () => activePhases()[0]?.id || PHASES[0]?.id || "P2";
export const DEFAULT_PHASE = "P2";
/* v1.9 — Giờ dự kiến của dự án chia theo phase: project.budgets = { P1, P2, P3, P4 }. Tổng dự kiến = cộng 4 phase.
   Số tổng kiểu cũ (project.budget, một con số cho cả dự án) không còn được dùng. Phase để trống / 0 = không theo dõi hạn mức. */
export const projBudgets = (p) => Object.fromEntries(PHASES.map((ph) => [ph.id, Math.max(0, Number(p?.budgets?.[ph.id]) || 0)]));
export const budgetTotal = (p) => PHASES.reduce((a, ph) => a + (Math.max(0, Number(p?.budgets?.[ph.id])) || 0), 0);
/* v3.1 — Quản lý MỞ / ĐÓNG từng giai đoạn của dự án (project.phaseOpen = { P1: true, … }).
   Nhân sự chỉ chấm được giai đoạn đang mở. Dự án chưa từng đặt mở/đóng thì coi giai đoạn có giờ dự kiến > 0 là đang mở
   (đúng như luật v2.5), để dữ liệu cũ không bị đổi. Giờ dự kiến từ v3.1 chỉ dùng để theo dõi. */
export const hasPhaseOpenMap = (p) => !!p && !!p.phaseOpen && typeof p.phaseOpen === "object";
export const projPhaseIsOpen = (p, phId) => (hasPhaseOpenMap(p) ? !!p.phaseOpen[phId] : Math.max(0, Number(p?.budgets?.[phId]) || 0) > 0);
export const cleanBudgets = (d) => Object.fromEntries(PHASES.map((ph) => [ph.id, Math.max(0, Number(d?.[ph.id]) || 0)]));
export const fmtH = (n) => String(+Number(n || 0).toFixed(1));
export const phaseInfo = (id) => PHASES.find((p) => p.id === id) || null;
export const phaseLabel = (id) => { const p = phaseInfo(id); return p ? `${p.id} · ${p.name}` : `${id || ""} (đã xoá)`.trim(); };
// Đoán giai đoạn từ nhóm của hạng mục — dùng khi thêm dòng mới và khi nâng cấp dữ liệu cũ chưa có giai đoạn
export const guessPhase = (taskId, tasks = []) => {
  const g = tasks.find((t) => t.id === taskId)?.group || "";
  const ok = (id) => (phaseInfo(id)?.active ? id : null);
  if (/xưởng|thi công/i.test(g)) return ok("P3") || firstActivePhase();
  if (/thiết kế/i.test(g)) return ok("P2") || firstActivePhase();
  return ok(DEFAULT_PHASE) || firstActivePhase();
};
// Khoá định danh một dòng chấm công: cùng dự án nhưng khác giai đoạn thì vẫn là hai dòng riêng
// v4.9: dòng tăng ca còn tách theo "tăng ca cho tác vụ" (otFor) — cùng khung giờ, khác tác vụ là hai dòng riêng
export const rowKey = (r) => `${r.projectId}|${r.phaseId || DEFAULT_PHASE}|${r.taskId}${r.otFor ? `|${r.otFor}` : ""}`;
// Khoá nhóm: cùng dự án + giai đoạn thì gộp chung một khối, chỉ hạng mục mới tách dòng bên trong
export const groupKey = (r) => `${r.projectId}|${r.phaseId || DEFAULT_PHASE}`;
/* Xếp lại mảng rows cho thứ tự phần tử khớp thứ tự hiển thị. Bắt buộc phải làm, vì ref ô nhập giờ
   và phím mũi tên đều đánh theo chỉ số phẳng — lệch thứ tự là con trỏ nhảy lung tung. */
export const sortByGroup = (list = []) => {
  const order = [];
  for (const r of list) { const k = groupKey(r); if (!order.includes(k)) order.push(k); }
  return [...list].sort((a, b) => order.indexOf(groupKey(a)) - order.indexOf(groupKey(b)));
};

export const emptyConfig = () => ({
  employees: [], projects: [], tasks: DEFAULT_TASKS, deadlineDay: 5,
  hours: { ...DEFAULT_HOURS }, holidays: [], roles: DEFAULT_ROLES.map((r) => ({ ...r })),
  leaveTypes: DEFAULT_LEAVE_TYPES.map((t) => ({ ...t })),
  depts: [...DEFAULT_DEPTS],
  otBands: DEFAULT_OT_BANDS(), otLegacy: {},
});

/* Vắng mặt giờ là tác vụ chọn được ngay trong ô Tác vụ, không còn panel riêng.
   Chọn "Phép năm" rồi nhập 8 giờ vào ngày đó là xong — giờ vắng tính vào giờ chuẩn của ngày
   nên không bị báo thiếu, nhưng KHÔNG tính vào giờ dự án và không tính OT. */
export const DEFAULT_LEAVE_TYPES = [
  { id: "annual", label: "Phép năm", short: "P", cls: "border-sky-800 bg-sky-950 text-sky-300" },
  { id: "sick", label: "Nghỉ ốm", short: "Ố", cls: "border-violet-800 bg-violet-950 text-violet-300" },
  { id: "unpaid", label: "Nghỉ không lương", short: "KL", cls: "border-slate-700 bg-slate-800 text-slate-300" },
  { id: "public", label: "Nghỉ lễ", short: "L", cls: "border-rose-800 bg-rose-950 text-rose-300" },
  { id: "biz", label: "Công tác ngoài", short: "CT", cls: "border-teal-800 bg-teal-950 text-teal-300" },
];
export const LEAVE_TASK_PREFIX = "LV_";
/* v7.2 — tác vụ "Trống việc": gắn cứng trong cfg.tasks (dùng chung, luôn đứng đầu), app tự thêm nếu chưa có.
   Quản lý đổi được tên và mô tả; không xoá, không kéo đổi chỗ, không chuyển sang vai trò khác (mã IDLE_WAIT giữ nguyên).
   Giờ trống việc tính là giờ công của ngày (không bị báo thiếu) nhưng không thành giờ cố gắng và KHÔNG tính vào tải (khung Phân bổ). */
export const IDLE_TASK_ID = "IDLE_WAIT";
export const IDLE_TASK = { id: IDLE_TASK_ID, name: "Trống việc", group: "Chung", depts: [], roles: [], desc: "Không có việc được giao — tính giờ công, không tính tải" };
export const isIdleTask = (id) => id === IDLE_TASK_ID;
export const withIdleTask = (c) => {
  if (!c) return c;
  const cur = (c.tasks || []).find((t) => t.id === IDLE_TASK_ID);
  // giữ tên / mô tả quản lý đã sửa; luôn là tác vụ dùng chung và đứng đầu
  const idle = cur ? { ...IDLE_TASK, name: cur.name || IDLE_TASK.name, desc: cur.desc } : { ...IDLE_TASK };
  if (!idle.desc) delete idle.desc;
  return { ...c, tasks: [idle, ...(c.tasks || []).filter((t) => t.id !== IDLE_TASK_ID)] };
};
export let IDLE_PENDING = false;   // v7.2: cấu hình trên server chưa có tác vụ Trống việc — quản lý mở app sẽ tự lưu
export const setIdlePending = (b) => { IDLE_PENDING = b; };   // v11: xem ghi chú ở setOtPending
export const NO_PROJECT = "__none__";
/* v8.5 — Nhân sự nghỉ việc: employee.resignedAt = "YYYY-MM-DD" (ngày bắt đầu nghỉ, từ ngày này không còn làm).
   Người nghỉ việc: tài khoản bị khoá, gỡ khỏi dự án đang tham gia (lưu lại ở projectsBefore để làm lại), không hiện trong
   danh sách giao dự án / nhắc nộp / tab Nhân sự đang làm. Giờ công đã chấm giữ nguyên, báo cáo kỳ có giờ của họ vẫn hiện kèm nhãn (Đã nghỉ). */
export const isResigned = (e) => !!e?.resignedAt;
export const goneOnDay = (e, d) => !!e?.resignedAt && d >= e.resignedAt;
/* v13.67 (R6) — Ngày vào làm: employee.startedAt = "YYYY-MM-DD" (ngày đầu tiên đi làm). Trống = như trước v13.67, coi như đã
   làm từ trước mọi kỳ. Ngày TRƯỚC startedAt giống hệt ngày từ resignedAt trở đi: không giờ chuẩn, không tính thiếu giờ, không
   tính vào quân số, không bị nhắc nộp. Trước đây người vào giữa tháng bị coi là thiếu giờ cho mọi ngày từ đầu tháng. */
export const notYetOnDay = (e, d) => !!e?.startedAt && d < e.startedAt;
export const offOnDay = (e, d) => goneOnDay(e, d) || notYetOnDay(e, d);
/* v13.68 (R7) — Vai trò theo thời gian. employee.roleHistory = [{ role, from }] theo from tăng dần; mục đầu luôn from "" = từ
   trước mọi kỳ. employee.role LUÔN bằng role của mục cuối, nên mọi màn hình cũ (đọc e.role) chạy y như trước, không con số
   nào đổi. Người chưa từng đổi vai trò KHÔNG có roleHistory — hiểu là [{ role: e.role, from: "" }], không cần chuyển dữ liệu.
   Ngày hiệu lực không ở tương lai: không có gì tự cập nhật e.role khi tới ngày, nên đổi vai trò tương lai thì làm đúng ngày đó.
   Dùng cho: bảng giờ công phẳng (R3) ghi vai trò ĐÚNG TẠI NGÀY CHẤM, và đơn giá lương theo vai trò về sau. */
export const roleHistoryOf = (e) => (Array.isArray(e?.roleHistory) && e.roleHistory.length ? e.roleHistory : [{ role: e?.role || "", from: "" }]);
export const roleOn = (e, d) => { let r = ""; for (const h of roleHistoryOf(e)) if (!h.from || h.from <= d) r = h.role; return r; };
/* Chuẩn hoá rồi gắn lịch sử vào nhân sự: sắp theo ngày (cùng ngày thì mục sau thắng), gộp mục trùng vai trò liền kề, mục đầu
   thành "từ trước", role = mục cuối. Chỉ còn một mục thì bỏ hẳn roleHistory — y như người chưa từng đổi. */
export const withRoleHistory = (e, hist) => {
  const byDate = new Map();
  for (const h of [...hist].sort((a, b) => (a.from || "").localeCompare(b.from || ""))) byDate.set(h.from || "", h.role || "");
  const out = [];
  for (const [from, role] of [...byDate].sort((a, b) => a[0].localeCompare(b[0]))) if (!out.length || out[out.length - 1].role !== role) out.push({ role, from });
  if (out.length) out[0] = { ...out[0], from: "" };
  const { roleHistory, ...rest } = e;   // eslint-disable-line no-unused-vars
  const role = out.length ? out[out.length - 1].role : e.role || "";
  return out.length > 1 ? { ...rest, role, roleHistory: out } : { ...rest, role };
};
export const changeRole = (e, role, from) => withRoleHistory(e, [...roleHistoryOf(e), { role, from }]);
/* đổi mã vai trò: đổi cả trong lịch sử, để giờ cũ không trỏ vào một mã không còn */
export const renameRoleOf = (e, old, id) => {
  const hist = roleHistoryOf(e);
  if (e.role !== old && !hist.some((h) => h.role === old)) return e;
  return withRoleHistory({ ...e, role: e.role === old ? id : e.role }, hist.map((h) => (h.role === old ? { ...h, role: id } : h)));
};
/* v8.6 — Khoá chấm công quá hạn: nhân viên chỉ sửa được N tuần gần nhất (cfg.pastLock.weeks, mặc định 2 = tuần này + tuần trước,
   tính từ thứ Hai; 0 = tắt). Ngày trước mốc bị khoá, kể cả giờ nháp chưa gửi. Quản lý mở tạm cho một người chấm bù một tuần:
   cfg.pastOpen = { "<empId>": { "<thứ Hai>": "<hạn YYYY-MM-DD>" } }. Database cũng chặn (artius_ts_guard · supabase/v8_6_khoa_qua_han.sql). */
export const pastWeeks = (cfg) => { const n = Number(cfg?.pastLock?.weeks); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2; };
export const pastCut = (cfg, today = fmt(new Date())) => { const w = pastWeeks(cfg); return w > 0 ? fmt(addDays(mondayOf(parseD(today)), -7 * (w - 1))) : ""; };
export const pastOpenUntil = (cfg, empId, d, today = fmt(new Date())) => { const u = cfg?.pastOpen?.[empId]?.[fmt(mondayOf(parseD(d)))] || ""; return u >= today ? u : ""; };
/* v13.51 — mở khoá không còn thời hạn: ghi mốc xa tít thay cho ngày hết hạn. Vẫn là một chuỗi ngày nên
   hàm so sánh cũ (cả trong SQL artius_ts_guard) chạy nguyên, khỏi đụng database. Những mốc có hạn thật
   do bản cũ ghi vẫn tự hết hạn như trước. */
export const PAST_OPEN_FOREVER = "9999-12-31";
export const pastOpenEver = (u) => u === PAST_OPEN_FOREVER;
export const pastLocked = (cfg, empId, d, today = fmt(new Date())) => { const c = pastCut(cfg, today); return !!c && d < c && !pastOpenUntil(cfg, empId, d, today); };
/* v8.7 — Hỗ trợ dự án có thời hạn: cfg.support = [{ id, empId, pid, phase ("" = mọi giai đoạn đang mở), from, until, note, by, at }].
   Trưởng phòng (nhân viên phòng mình) / Admin (mọi người) mở cho một nhân sự chấm công vào dự án KHÔNG được giao, trong khoảng ngày
   from → until (tính hết ngày until). Hết hạn là tự ngắt: dự án biến khỏi danh sách thêm mới, ngày ngoài khoảng bị khoá ô nhập;
   giờ đã chấm giữ nguyên và vẫn tính chi phí dự án. Trưởng phòng ghi qua hàm SQL artius_support_set (supabase/v8_7_ho_tro_du_an.sql). */
/* v8.8 — employee.allProjects = true: được chấm vào MỌI dự án đang mở (kể cả dự án thêm sau), không cần chọn từng dự án.
   Danh sách projects vẫn giữ nguyên để tắt lại thì quay về như cũ. */
export const empHasProj = (e, pid) => !!e?.allProjects || (Array.isArray(e?.projects) && e.projects.includes(pid));
export const supportList = (cfg) => (Array.isArray(cfg?.support) ? cfg.support : []);
export const supportOn = (cfg, empId, pid, d, phase = null) => supportList(cfg).find((x) => x.empId === empId && x.pid === pid && x.from <= d && d <= x.until && (phase == null || !x.phase || x.phase === phase)) || null;
export const supportInRange = (cfg, empId, pid, lo, hi) => supportList(cfg).filter((x) => x.empId === empId && x.pid === pid && x.from <= hi && x.until >= lo);
export const supportKind = (cfg, empId, pid, d) => (pid && pid !== NO_PROJECT && supportOn(cfg, empId, pid, d) ? "Hỗ trợ" : "Chính");
export const empNameTag = (e) => (e ? `${e.name}${isResigned(e) ? " (Đã nghỉ)" : ""}` : "(đã xoá)");
export const ResignedBadge = () => <span className="ml-1.5 inline-block rounded border border-slate-700 px-1 align-middle text-[10px] font-normal text-slate-400">Đã nghỉ</span>;
export const NO_PHASE = "?";   // v3.0: dòng mới, giai đoạn chưa chọn (dự án "" = chưa chọn, hạng mục "" = chưa chọn)
/* LEAVE_TYPES / LEAVE_TASKS là bản sống: App chép cfg.leaveTypes vào đây ở mỗi lần render (syncLeave),
   quản lý thêm / sửa / xoá loại nghỉ ở tab Tác vụ. */
export const LEAVE_PALETTE = [
  "border-sky-800 bg-sky-950 text-sky-300", "border-violet-800 bg-violet-950 text-violet-300",
  "border-slate-700 bg-slate-800 text-slate-300", "border-rose-800 bg-rose-950 text-rose-300",
  "border-teal-800 bg-teal-950 text-teal-300", "border-amber-800 bg-amber-950 text-amber-300",
  "border-emerald-800 bg-emerald-950 text-emerald-300", "border-fuchsia-800 bg-fuchsia-950 text-fuchsia-300",
];
export const leaveShort = (label) => {
  const w = String(label || "").trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w.slice(0, 2).map((x) => x[0]).join("") : (w[0] || "?").slice(0, 2)).toUpperCase();
};
export const LEAVE_TYPES = DEFAULT_LEAVE_TYPES.map((t) => ({ ...t }));
export const LEAVE_TASKS = [];
export const syncLeave = (list) => {
  const src = Array.isArray(list) ? list : DEFAULT_LEAVE_TYPES;
  LEAVE_TYPES.splice(0, LEAVE_TYPES.length, ...src);
  LEAVE_TASKS.splice(0, LEAVE_TASKS.length, ...src.map((t) => ({ id: `${LEAVE_TASK_PREFIX}${t.id}`, name: t.label, group: "Vắng mặt", depts: [], roles: [] })));
};
syncLeave(null);
export const isLeaveTask = (id) => typeof id === "string" && id.startsWith(LEAVE_TASK_PREFIX);
export const leaveTypeOfTask = (id) => (isLeaveTask(id) ? id.slice(LEAVE_TASK_PREFIX.length) : null);
export const leaveInfo = (id) => LEAVE_TYPES.find((x) => x.id === id) || null;
export const leaveInfoOfTask = (taskId) => leaveInfo(leaveTypeOfTask(taskId));

/* Ghi chú của một dòng — mở bằng nút "…" thay vì chiếm hẳn một cột trong bảng */
export const NUDGE_GAP_MIN = 30;   // v7.7: khoảng cách tối thiểu giữa hai lần bấm chuông nhắc cho cùng một người (phút)

