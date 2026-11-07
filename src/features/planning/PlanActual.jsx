/* ARTIUS TIME v13.2 — Kế hoạch › "So với thực tế".
   v13.2: công tắc Đơn vị Người / Giờ (mặc định Giờ; giờ = tổng giờ trong khoảng, người = bình quân / tuần);
   bảng vai trò bấm mở danh sách người của vai trò, và vai trò thiếu thì cho biết người cùng vai trò đang làm ở đâu.
   So kế hoạch (lưới hiện tại hoặc một bản chốt) với giờ nhân sự ĐÃ GỬI vào từng dự án, cùng đơn vị số người:
     thực tế (người) = giờ đã gửi trong tuần ÷ giờ chuẩn một tuần (Thiết lập › giờ làm).
   Giờ tính theo vai trò của NGƯỜI chấm (vai trò gộp như lưới kế hoạch, vd TL-2D → 2D) — Sang chốt 02/11/2026.
   Tuần được tính: tuần đã qua, giờ đã gửi của từng người (không chờ cả công ty gửi đủ); tuần còn người
   chưa gửi thì ghi rõ số người chưa gửi ở hàng số liệu.
   v13.3: dự án đã đóng hoặc tạm ẩn không tính phần kế hoạch (giống Nhập liệu và Tổng quan nguồn lực); nếu có giờ chấm
   trong khoảng thì vẫn hiện phần thực tế kèm nhãn "đã đóng". Dòng "chưa ai làm" ghi thêm "chưa giao ai" khi dự án
   không có ai được giao (thành viên dự án, quyền tất cả dự án, hoặc đang hỗ trợ dự án) trong số người tính kế hoạch.
   Màn này CHỈ ĐỌC. */
import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search, SlidersHorizontal, X } from "lucide-react";
import { addDays, effortHoursFor, fmt, makeHolidayIndex, minHoursFor, mondayOf, weekDays, weeklyTarget } from "../../core/date.jsx";
import { NO_PROJECT, goneOnDay, isIdleTask, isLeaveTask, isOtId } from "../../core/domain.jsx";
import { isLight } from "../../core/theme.jsx";
import { ALLOC_ST, allocLimits, allocState } from "../../shared/alloc.jsx";
import { PA_GROUPS, PA_ORDER, cellOf, comparePlan, foldMerged, joinYears, normalizeYear, planLimits, slotIndexOf } from "./planCalc.js";
import { listSnapshots, loadSnapshot } from "./planStore.js";

const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");
const r2 = (n) => Math.round(n * 100) / 100;
const PALETTE = ["#14b8a6", "#f59e0b", "#6366f1", "#ec4899", "#0ea5e9", "#84cc16", "#f43f5e",
  "#a855f7", "#eab308", "#3b82f6", "#fb923c", "#22c55e", "#d946ef", "#2dd4bf", "#94a3b8"];
const TONE = {
  dark: { over: "#f97316", overBg: "rgba(249,115,22,.14)", under: "#60a5fa", underBg: "rgba(96,165,250,.14)", red: "#f87171", redBg: "rgba(248,113,113,.14)",
    ok: "#4ade80", okBg: "rgba(74,222,128,.12)", mix: "#eab308", mixBg: "rgba(234,179,8,.14)", sel: "rgba(4,47,46,.55)", selBar: "#14b8a6", selName: "#5eead4",
    hover: "rgba(30,41,59,.45)", line: "#1e293b", grp: "#0b1220", plan: "#94a3b8", zero: "#64748b", tile: "rgba(2,6,23,.6)" },
  light: { over: "#c2410c", overBg: "#fff7ed", under: "#1d4ed8", underBg: "#eff6ff", red: "#dc2626", redBg: "#fef2f2",
    ok: "#15803d", okBg: "#f0fdf4", mix: "#a16207", mixBg: "#fefce8", sel: "#f0fdfa", selBar: "#14b8a6", selName: "#0f766e",
    hover: "#f8fafc", line: "#e2e8f0", grp: "#f8fafc", plan: "#64748b", zero: "#94a3b8", tile: "#f8fafc" },
};
const useThemeTick = () => {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); window.addEventListener("artius:theme", f); return () => window.removeEventListener("artius:theme", f); }, []);
};
/* v13.41 — hai bộ cột: thêm cột "Từng tuần" khi khoảng đang xem có nhiều hơn một tuần.
   Viết nguyên văn cả bốn chuỗi vì Tailwind quét lớp trong mã nguồn, ghép động là không sinh ra CSS. */
const HEAD1 = "grid-cols-[minmax(200px,1.3fr)_70px_70px_minmax(160px,1fr)_minmax(220px,1.5fr)_110px]";
const HEADN = "grid-cols-[minmax(180px,1.15fr)_64px_64px_minmax(80px,0.5fr)_minmax(140px,0.9fr)_minmax(200px,1.3fr)_104px]";
const ROW1 = "md:grid-cols-[minmax(200px,1.3fr)_70px_70px_minmax(160px,1fr)_minmax(220px,1.5fr)_110px]";
const ROWN = "md:grid-cols-[minmax(180px,1.15fr)_64px_64px_minmax(80px,0.5fr)_minmax(140px,0.9fr)_minmax(200px,1.3fr)_104px]";
const GROUPS = PA_GROUPS;   // v13.59: dùng chung với file Excel
void PA_ORDER;

export function PlanActual({ plan, projects, roles, start, realWeeks, detail, draft = [], staff, hoursCfg, prole = (r) => r, loading = false,
  hidden = new Set(), support = [], /* v13.42 */ cap = new Map(), lim = { tol: 15, mix: 30 },
  /* v13.43 — chỉnh ngưỡng ngay tại đây; không truyền onLim (hoặc chỉ xem) thì nút biến mất */
  onLim = null, flash = null,
  /* v13.44 — để tính hệ số tải trong khối BỔ SUNG, đúng công thức của tab Nhân sự */
  holidays = [], aLim = allocLimits(null) }) {
  useThemeTick();
  const C = isLight() ? TONE.light : TONE.dark;
  const [range, setRange] = useState("now");    /* now | last | 4 | all — v13.57: mặc định "Tuần này" */
  const [base, setBase] = useState("");         /* "" = lưới hiện tại, còn lại = nhãn bản chốt */
  const [snaps, setSnaps] = useState([]);       /* [{ label, a: id năm start, b: id năm start+1, at }] */
  const [snapPlan, setSnapPlan] = useState(null);
  const [sel, setSel] = useState(null);
  const [hov, setHov] = useState(null);
  const [unit, setUnit] = useState("p");        /* h = giờ | p = người — v13.57: mặc định "Người" */
  const [tog, setTog] = useState({});           /* "pid|rid" -> mở / đóng do người dùng bấm */
  const [openCom, setOpenCom] = useState(false);   /* v13.42: bóc giờ việc chung / vắng */
  const [fSt, setFSt] = useState("all");           /* v13.42: lọc theo kết luận */
  const [q, setQ] = useState("");                  /* v13.42: tìm dự án */
  const [openLim, setOpenLim] = useState(false);   /* v13.43: bảng chỉnh ngưỡng ngay trên thanh công cụ */
  const [lv, setLv] = useState({ tol: String(lim.tol), mix: String(lim.mix) });
  const [saving, setSaving] = useState(false);
  const [openSup, setOpenSup] = useState(() => new Set());   /* v13.44: "pid|rid" đang mở khối BỔ SUNG */
  const [hovP, setHovP] = useState("");                      /* v13.44: người đang rê chuột trong BỔ SUNG */
  const STD = weeklyTarget(hoursCfg) || 44;
  const colorOf = useMemo(() => new Map(roles.map((r, k) => [r.id, PALETTE[k % PALETTE.length]])), [roles]);

  /* v13.43 — ô nhập ngưỡng bám theo giá trị đang lưu; Esc đóng bảng */
  useEffect(() => { setLv({ tol: String(lim.tol), mix: String(lim.mix) }); }, [lim.tol, lim.mix]);
  useEffect(() => {
    if (!openLim) return undefined;
    const f = (e) => { if (e.key === "Escape") setOpenLim(false); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [openLim]);
  const saveLim = async () => {
    const t = Number(lv.tol), m = Number(lv.mix);
    if (!(t >= 1 && t <= 100)) return flash?.("Ngưỡng đúng kế hoạch phải từ 1 đến 100%.", "err");
    if (!(m >= 1 && m <= 200)) return flash?.("Ngưỡng lệch vai trò phải từ 1 đến 200%.", "err");
    setSaving(true);
    try { await onLim(t, m); setOpenLim(false); } finally { setSaving(false); }
    return undefined;
  };

  /* bản chốt: mỗi lần chốt ghi một bản cho mỗi năm, cùng nhãn — ghép lại thành một bản hai năm */
  useEffect(() => {
    let alive = true;
    Promise.all([listSnapshots(start), listSnapshots(start + 1)]).then(([a, b]) => {
      if (!alive) return;
      const m = new Map();
      for (const s of a) m.set(s.label, { label: s.label, a: s.id, at: s.taken_at });
      for (const s of b) { const o = m.get(s.label) || { label: s.label, at: s.taken_at }; o.b = s.id; m.set(s.label, o); }
      setSnaps([...m.values()].sort((x, y) => String(y.at).localeCompare(String(x.at))));
    }).catch(() => {});
    return () => { alive = false; };
  }, [start]);
  useEffect(() => {
    if (!base) { setSnapPlan(null); return undefined; }
    const s = snaps.find((x) => x.label === base); if (!s) return undefined;
    let alive = true;
    Promise.all([s.a ? loadSnapshot(s.a) : {}, s.b ? loadSnapshot(s.b) : {}]).then(([a, b]) => {
      if (alive) setSnapPlan(foldMerged(joinYears([normalizeYear(a, start), normalizeYear(b, start + 1)]), prole).plan);
    }).catch(() => alive && setSnapPlan({}));
    return () => { alive = false; };
  }, [base, snaps, start, prole]);
  const P = base ? snapPlan || {} : plan;

  /* ---------- giờ đã gửi, gom theo tuần thật ---------- */
  const roleOf = useMemo(() => new Map(staff.map((e) => [e.id, e.role || ""])), [staff]);
  const nameOf = useMemo(() => new Map(staff.map((e) => [e.id, e.name || e.id])), [staff]);
  const projIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const liveIds = useMemo(() => new Set(projects.filter((p) => p.active && !hidden.has(p.id)).map((p) => p.id)), [projects, hidden]);
  /* v13.3: dự án có ai được giao không — thành viên, quyền tất cả dự án, hoặc đang hỗ trợ hôm nay */
  const today = fmt(new Date());
  const assigned = (pid) => staff.some((e) => e.allProjects || (Array.isArray(e.projects) && e.projects.includes(pid)))
    || support.some((x) => x.pid === pid && x.from <= today && today <= x.until && staff.some((e) => e.id === x.empId));
  const thisMon = fmt(mondayOf(new Date()));
  /* v13.46 — giữ cả TUẦN ĐANG CHẠY (trước đây cắt bỏ), vì chế độ "Tuần này" cần nó.
     Giờ nháp chỉ nhận của tuần đang chạy: tuần đã qua mà đem giờ chưa gửi vào thì sai bản tổng kết. */
  const hoursBy = useMemo(() => {
    const m = new Map();   /* monday -> [{ empId, pid, task, h, dr }] */
    const push = (d, dr) => {
      const mon = fmt(mondayOf(new Date(d.date)));
      if (mon > thisMon || (dr && mon !== thisMon)) return;
      if (!m.has(mon)) m.set(mon, []);
      m.get(mon).push({ empId: d.empId, pid: d.projectId, task: d.taskId, h: Number(d.hours) || 0, dr });
    };
    for (const d of detail || []) push(d, false);
    for (const d of draft || []) push(d, true);
    return m;
  }, [detail, draft, thisMon]);
  const doneWeeks = useMemo(() => realWeeks.filter((w) => w.monday < thisMon && hoursBy.has(w.monday)), [realWeeks, hoursBy, thisMon]);
  /* v13.46 — tuần đang chạy. v13.59: tỉ lệ đã qua nay tính TRỌN NGÀY tới hết hôm qua, nằm trong comparePlan. */
  const nowW = useMemo(() => realWeeks.find((w) => w.monday === thisMon) || null, [realWeeks, thisMon]);
  const weeks = useMemo(() => {
    if (range === "now") return nowW ? [nowW] : [];
    if (!doneWeeks.length) return [];
    if (range === "last") return doneWeeks.slice(-1);
    if (range === "4") return doneWeeks.slice(-4);
    return doneWeeks;
  }, [doneWeeks, range, nowW]);
  const running = range === "now";   /* đang xem tuần chưa xong */
  useEffect(() => { if (!doneWeeks.length && nowW && range !== "now") setRange("now"); }, [doneWeeks.length, nowW, range]);
  /* v13.57 — mặc định là "Tuần này"; tuần hiện tại nằm ngoài khung năm của lưới thì lùi về "Tuần trước" */
  useEffect(() => { if (range === "now" && !nowW && doneWeeks.length) setRange("last"); }, [range, nowW, doneWeeks.length]);
  const nW = weeks.length || 1;
  const wLabel = (w) => { const d = new Date(w.monday); return `T${d.getMonth() + 1}·${Math.min(4, Math.ceil(d.getDate() / 7))}`; };
  const rangeTxt = weeks.length ? (weeks.length === 1 ? `tuần ${wLabel(weeks[0])} (${fmt(new Date(weeks[0].monday)).slice(8, 10)}/${fmt(new Date(weeks[0].monday)).slice(5, 7)} – ${fmt(addDays(new Date(weeks[0].monday), 6)).slice(8, 10)}/${fmt(addDays(new Date(weeks[0].monday), 6)).slice(5, 7)})`
    : `${weeks.length} tuần ${wLabel(weeks[0])} → ${wLabel(weeks[weeks.length - 1])}`) : "";

  /* ---------- so sánh ----------
     v13.59 — toàn bộ phép so nằm ở planCalc.comparePlan, dùng chung với file Excel:
     thực tế chia cho giờ chuẩn của CHÍNH TUẦN ĐÓ (trừ lễ), tuần đang chạy so trọn ngày tới hết hôm qua,
     người "chưa gửi đủ" xét theo ngày trống như Bảng công. */
  const data = useMemo(() => comparePlan({ plan: P, projects, roles, weeks, sent: detail || [], draft: draft || [], staff, hoursCfg,
    holidays, lim, hidden, runMon: running ? thisMon : "" }), [P, projects, roles, weeks, detail, draft, staff, hoursCfg, holidays, lim, hidden, running, thisMon]);
  const runFrac = running && data.wk[0] ? data.wk[0].frac : 1;   // phần tuần đang chạy đã trọn ngày
  const HPP = data.hpp || STD;                                     // 1 người = bao nhiêu giờ trong khoảng đang xem
  const wk1 = data.wk.length === 1 ? data.wk[0] : null;

  /* v13.44 — hệ số tải của từng người TRONG CHÍNH KHOẢNG ĐANG XEM, dùng đúng allocState và công thức %
     của tab Nhân sự để hai nơi không ra hai con số. Giờ chuẩn lấy STD × số tuần — cùng thước với cả màn này
     ("44 giờ = 1 người"), nên không tính giờ chuẩn riêng từng người như tab Nhân sự; chênh lệch chỉ xảy ra
     với người làm bán thời gian. by: giờ theo dự án, khoá "" là việc chung / vắng. */
  const load = useMemo(() => {
    const hs = makeHolidayIndex(holidays);
    const mons = new Set(weeks.map((w) => w.monday));
    const day = new Map();   /* "emp|ngày" -> { ot, reg, idle } — giờ cố gắng tính theo NGÀY */
    const tot = new Map();
    for (const d of detail || []) {
      const h = Number(d.hours) || 0; if (!h) continue;
      if (!mons.has(fmt(mondayOf(new Date(d.date))))) continue;
      const k = `${d.empId}|${d.date}`;
      const c = day.get(k) || { ot: 0, reg: 0, idle: 0, any: 0 };
      c.any += h;   // v13.56: có chấm giờ ngày này chưa — để biết HÔM NAY có tính vào giờ chuẩn không
      if (isOtId(d.taskId)) c.ot += h;
      else if (!isLeaveTask(d.taskId)) { c.reg += h; if (isIdleTask(d.taskId)) c.idle += h; }
      day.set(k, c);
      const t = tot.get(d.empId) || { t: 0, ot: 0, idle: 0, eff: 0, lv: 0, by: new Map() };
      t.t += h; if (isLeaveTask(d.taskId)) t.lv += h;
      const pk = !d.projectId || d.projectId === NO_PROJECT || isLeaveTask(d.taskId) ? "" : d.projectId;
      t.by.set(pk, (t.by.get(pk) || 0) + h);
      tot.set(d.empId, t);
    }
    for (const [k, c] of day) {
      const [eid, date] = k.split("|");
      const t = tot.get(eid); if (!t) continue;
      t.ot += c.ot; t.idle += c.idle;
      t.eff += effortHoursFor(date, c.reg - c.idle, hoursCfg, hs);
    }
    /* v13.56 — giờ chuẩn TÍNH RIÊNG TỪNG NGƯỜI, TỚI THỜI ĐIỂM XEM, đúng công thức stdOf của Bảng công:
       ngày chưa tới không tính; HÔM NAY chỉ tính khi người đó đã chấm giờ hôm nay; ngày lễ và ngày sau
       khi nghỉ việc không tính. Trước đây lấy cứng 44 h × số tuần cho mọi người, nên:
         – thứ 7 chưa chấm mà đã bị tính 4 h chuẩn (Bảng công 40/40 = 100%, ở đây ra 91%);
         – chế độ "Tuần này" giữa tuần chia cho giờ chuẩn cả tuần, ai cũng hiện thiếu giờ.  */
    const today = fmt(new Date());
    const days = weeks.flatMap((w) => weekDays(w.monday));
    const empOf = new Map(staff.map((e) => [e.id, e]));
    const stdOf = (eid) => {
      let v = 0;
      for (const d of days) {
        if (d > today || goneOnDay(empOf.get(eid), d)) continue;
        if (d === today) { const c = day.get(`${eid}|${d}`); if (!c || c.any <= 0) continue; }
        v += minHoursFor(d, hoursCfg, hs) || 0;
      }
      return v;
    };
    const out = new Map();
    /* work = thời gian LÀM VIỆC thật: bỏ giờ vắng mặt và giờ trống việc. Dùng làm mẫu số cho
       "…% thời gian làm việc của họ" — mẫu số cũ gồm cả hai thứ đó nên người nghỉ phép bị hiện thấp oan. */
    for (const [eid, t] of tot) {
      const sd = stdOf(eid);
      out.set(eid, { ...t, sd, work: Math.max(0, t.t - t.lv - t.idle),
        st: allocState(t.t, t.ot, t.eff, t.idle, sd, aLim), p: sd ? Math.round(((t.t - t.idle) / sd) * 100) : null });
    }
    return out;
  }, [detail, weeks, hoursCfg, holidays, aLim, staff]);

  if (loading) return <p className="px-4 py-8 text-sm text-slate-500">Đang tải giờ đã chấm…</p>;
  if (!doneWeeks.length && !nowW) return <p className="px-4 py-8 text-sm text-slate-500">Chưa có tuần nào đã qua có giờ gửi trong khoảng năm đang xem.</p>;

  /* v13.42 — lọc theo kết luận và tìm dự án, cho giống tab "Theo dự án" bên cạnh.
     Lọc chỉ đổi BẢNG; các ô số liệu phía trên vẫn tính trên toàn bộ, để con số tổng không nhảy theo bộ lọc. */
  const ALL = data.list;
  const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
  const kw = nrm(q);
  const L = ALL.filter((o) => (fSt === "all" || o.st === fSt)
    && (!kw || nrm(`${o.p.name} ${o.p.code || ""}`).includes(kw)));
  const cur = L.find((o) => o.pid === sel) || L[0];
  const KH = ALL.reduce((a, o) => a + o.KH, 0), TT = ALL.reduce((a, o) => a + o.TT, 0), okR = ALL.reduce((a, o) => a + o.okR, 0);
  const none = ALL.filter((o) => o.st === "none"), out = ALL.filter((o) => o.st === "out");
  /* v13.42 — quân số kỳ này và các vai trò có KẾ HOẠCH VƯỢT QUÁ số người đang có.
     Kế hoạch đặt 3 người 3D trong khi công ty chỉ có 2 thì suất đó không bao giờ chạy đủ,
     mà bảng xếp theo dự án không chỗ nào nói ra điều đó. */
  const CAP = roles.reduce((a, r) => a + (cap.get(r.id) || 0), 0) * (running ? runFrac : 1);
  const overCap = roles.map((r) => {
    const c = (cap.get(r.id) || 0) * (running ? runFrac : 1), k = ALL.reduce((a, o) => a + (o.kh[r.id] || 0), 0);
    return { r, c, k, gap: k - c };
  }).filter((x) => x.c > 0 && x.gap > 0.01).sort((a, b) => b.gap - a.gap);
  const mx = Math.max(0.5, ...ALL.map((o) => Math.abs(o.d)));   // thước thanh lệch giữ nguyên khi lọc
  /* v13.41 — chỉ "thấp hơn" và "chưa ai làm" mới có thể do người chưa gửi giờ gây ra;
     các kết luận còn lại không bị ảnh hưởng nên không đánh dấu. */
  const doubt = (st) => (running || data.gapWeeks > 0) && (st === "under" || st === "none");
  const pill = (st, o) => {
    const map = { none: [C.red, C.redBg, "chưa ai làm"], out: [C.over, C.overBg, "ngoài kế hoạch"], mix: [C.mix, C.mixBg, "đủ người, lệch vai trò"], ok: [C.ok, C.okBg, "đúng kế hoạch"],
      over: [C.over, C.overBg, `vượt ${o.KH ? Math.round((o.d / o.KH) * 100) : 0}%`], under: [C.under, C.underBg, `thấp hơn ${o.KH ? Math.round((-o.d / o.KH) * 100) : 0}%`] };
    const [c, bg, t] = map[st];
    const q = doubt(st);
    return <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px]" style={{ color: c, background: bg }}
      title={q ? (running ? (o.dr > 0.005 ? `Tuần chưa xong — dự án này còn ${f0(r2(o.dr))} giờ nháp chưa gửi, kết luận này chưa chắc`
          : "Tuần chưa xong — dự án này chưa có giờ nháp nào, kết luận có thể còn đổi khi mọi người chấm tiếp")
        : `Còn ${data.gapNames.length} người chưa gửi đủ giờ trong khoảng này — cột Thực tế có thể đang thấp giả, kết luận này chưa chắc`) : undefined}>
      {t}{q && <span style={{ opacity: .75 }}> *</span>}</span>;
  };
  /* v13.41 — biểu đồ nhỏ theo TUẦN trong từng hàng. Khi xem nhiều tuần, bảng đang nén thành một con số
     bình quân nên dự án chấm 0 / 0 / 0 / 4 trông y hệt dự án chấm 1 / 1 / 1 / 1 — hai tình huống cần hai
     quyết định khác hẳn nhau. Dữ liệu o.wk[k] = { kh, tt } đã tính sẵn cho biểu đồ lũy kế, chỉ vẽ thêm.
     Thước đo riêng từng hàng (xem HÌNH DẠNG theo thời gian); độ lớn giữa các dự án đã có ở hai cột số. */
  const spark = (o) => {
    const mxw = Math.max(0.0001, ...o.wk.map((x) => Math.max(x.kh, x.tt)));
    const lab = o.wk.map((x, k) => `${wLabel(weeks[k])}: ${U(x.kh)} → ${U(x.tt)}`).join("\n");
    return (
      <span className="hidden h-[22px] items-end gap-[2px] md:flex" title={`Kế hoạch → thực tế từng tuần\n${lab}`}>
        {o.wk.map((x, k) => {
          const d = x.tt - x.kh;
          const c = x.kh < 0.005 && x.tt > 0.005 ? C.over
            : Math.abs(d) <= Math.max(0.15, x.kh * 0.15) ? C.ok : d > 0 ? C.over : C.under;
          return (
            <span key={k} className="relative block min-w-[3px] flex-1" style={{ height: "100%" }}>
              {/* kế hoạch: cột nền nhạt */}
              <span className="absolute bottom-0 left-0 right-0 rounded-[1px]"
                style={{ height: `${Math.max(x.kh > 0.005 ? 6 : 0, (x.kh / mxw) * 100)}%`, background: C.plan, opacity: .34 }} />
              {/* thực tế: cột đặc, hẹp hơn, nằm đè lên */}
              <span className="absolute bottom-0 rounded-[1px]"
                style={{ left: "18%", right: "18%", height: `${Math.max(x.tt > 0.005 ? 6 : 0, (x.tt / mxw) * 100)}%`, background: c }} />
            </span>
          );
        })}
      </span>
    );
  };
  const tile = (k, v, s, color) => (
    <div className="rounded-lg border border-slate-800 px-3 py-2" style={{ background: C.tile }}>
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className="mt-0.5 font-mono text-[19px] leading-tight text-slate-100" style={color ? { color } : undefined}>{v}</div>
      <div className="text-[11.5px] text-slate-400">{s}</div>
    </div>
  );
  const seg = (on) => `h-9 whitespace-nowrap px-3 text-[13px] ${on ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`;
  /* số nội bộ theo người (bình quân / tuần); chế độ giờ = tổng giờ trong khoảng */
  const isH = unit === "h";
  const U = (v) => (isH ? f0(Math.round(v * HPP * nW * 10) / 10) : f0(r2(v)));
  const UL = isH ? "giờ" : "người";
  const US = (v) => `${U(v)} ${UL}`;
  const ddTxt = (d) => `${d > 0.005 ? "+" : d < -0.005 ? "−" : ""}${U(Math.abs(d))}`;
  const pname = (pid) => (pid ? (projects.find((x) => x.id === pid)?.name || pid) : "việc chung / vắng");
  const isOpen = (o, r) => { const k = `${o.pid}|${r.id}`; if (k in tog) return tog[k];
    const a = o.kh[r.id] || 0, b = o.tt[r.id] || 0; return Math.abs(b - a) > Math.max(0.15, a * 0.15); };
  const flip = (o, r) => setTog((t) => ({ ...t, [`${o.pid}|${r.id}`]: !isOpen(o, r) }));
  /* danh sách người của một vai trò trong dự án đang chọn */
  const rolePeople = (o, r) => {
    const a = o.kh[r.id] || 0, b = o.tt[r.id] || 0, planH = a * HPP * nW;
    const inP = [...o.ppl].filter(([id]) => roleOf.get(id) === r.id).sort((x, y) => y[1] - x[1]);
    const mxH = Math.max(planH, 1, ...inP.map((x) => x[1]));
    const tot = (id) => [...(data.per.get(id) || new Map()).values()].reduce((s2, v) => s2 + v, 0);
    /* v13.44 — BỔ SUNG: ai cùng vai trò có thể kéo thêm vào dự án này. Xếp người RẢNH NHẤT lên trước
       (theo % tải trong khoảng đang xem), người chưa gửi giờ coi như rảnh. Chi tiết giờ để trong thẻ rê chuột
       cho đỡ chật — khối này mặc định đóng, bấm tiêu đề mới mở. */
    const supKey = `${o.pid}|${r.id}`, supOpen = openSup.has(supKey);
    const sup = staff.filter((e) => e.role === r.id && !o.ppl.has(e.id))   /* người đã ở trong dự án nằm ở khối trên */
      .map((e) => ({ e, L: load.get(e.id) || null }))
      .sort((x, y) => (x.L?.p ?? -1) - (y.L?.p ?? -1));
    return (
      <div className="py-1.5 pl-5 pr-1 text-[12px]" style={{ background: C.grp }}>
        {inP.length ? <>
          {inP.map(([id, h]) => { const L = load.get(id); return (
            <div key={id} className="py-0.5">
              <div className="grid grid-cols-[minmax(0,1fr)_58px_110px] items-center gap-2">
                <span className="truncate text-slate-200">{nameOf.get(id)}{(o.drp.get(id) || 0) > 0.005 && <span className="text-slate-500"> *</span>}</span>
                <span className="text-right font-mono text-slate-300">{f0(r2(h))} h</span>
                <span className="relative h-1.5 overflow-hidden rounded" style={{ background: C.line }} title={`${f0(r2(h))} / ${f0(r2(L?.work || h))} h làm việc trong khoảng`}>
                  <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (h / mxH) * 100)}%`, background: colorOf.get(r.id) }} /></span>
              </div>
              {/* v13.47 — mẫu số là THỜI GIAN LÀM VIỆC (bỏ vắng mặt, trống việc), kèm mức tải của khoảng
                  để biết người này còn nhận thêm được không. Bỏ "gánh …% kế hoạch vai trò": hàng vai trò
                  ngay trên đã có Kế hoạch, Thực tế và Lệch; chia nhỏ ra đầu người không thêm thông tin. */}
              <div className="text-[11px] text-slate-500">
                {/* v13.59 — tử số lấy giờ ĐÃ GỬI vào dự án, cùng nguồn với mẫu số; trước đây tử số có cả nháp nên có thể vượt 100% */}
                {L && L.work > 0.005 ? `${Math.round(((L.by.get(o.pid) || 0) / L.work) * 100)}% thời gian làm việc của họ` : `${f0(r2(h))} h`}
                {L && L.p != null && <> · <span style={{ color: L.st === "hi" ? C.red : L.st === "lo" ? C.mix : undefined }}>
                  tải {nW > 1 ? "kỳ này" : "tuần"} {L.p}%{L.st === "hi" ? " — quá tải" : ""}</span></>}
              </div>
            </div>); })}
        </> : <div className="mb-1" style={{ color: C.under }}>Không ai thuộc vai trò {r.name || r.id} chấm giờ vào dự án này.</div>}
        {sup.length > 0 && <>
          <button onClick={() => setOpenSup((s) => { const n = new Set(s); if (n.has(supKey)) n.delete(supKey); else n.add(supKey); return n; })}
            aria-expanded={supOpen}
            className="mt-2 flex w-full items-center gap-1.5 border-t pt-1.5 text-[10.5px] uppercase tracking-wider text-slate-500 hover:text-slate-300"
            style={{ borderColor: C.line }}>
            <span className="inline-block w-3 text-[10px]">{supOpen ? "▾" : "▸"}</span>
            Bổ sung
          </button>
          {supOpen && sup.map(({ e, L }, si) => {
            const key = `${supKey}|${e.id}`;
            /* hai người cuối thì lật thẻ lên trên, khỏi rơi ra ngoài đáy khung */
            const up = sup.length > 2 && si >= sup.length - 2;
            const rows = L ? [...L.by].sort((x, y) => y[1] - x[1]) : [];
            return (
              <div key={e.id} className="relative py-0.5"
                onMouseEnter={() => setHovP(key)} onMouseLeave={() => setHovP((h) => (h === key ? "" : h))}>
                <div className="flex items-center gap-2">
                  <span className="truncate text-slate-200">{e.name || e.id}</span>
                  {L ? <span className={`ml-auto shrink-0 rounded-full border px-1.5 text-[10px] leading-[15px] ${ALLOC_ST[L.st][1]}`}>
                    {ALLOC_ST[L.st][0]}{L.p != null ? ` · ${L.p}%` : ""}</span>
                    : <span className="ml-auto shrink-0 rounded-full border border-slate-700 px-1.5 text-[10px] leading-[15px] text-slate-500">chưa gửi giờ</span>}
                </div>
                {hovP === key && (
                  <div className={`absolute right-0 z-30 w-[250px] rounded-md border border-slate-700 p-2 text-[11.5px] shadow-xl ${up ? "bottom-full mb-0.5" : "top-full mt-0.5"}`}
                    style={{ background: C.grp }}>
                    <div className="mb-1 text-[10.5px] uppercase tracking-wider text-slate-500">
                      {rangeTxt} · chuẩn{running ? " tới hôm nay" : ""} {f0(r2(L ? L.sd : 0))} h
                    </div>
                    {rows.length ? rows.map(([k, h]) => (
                      <div key={k || "_"} className="flex gap-2 py-[1px]">
                        <span className="truncate" style={{ color: k ? undefined : C.mix }}>{k ? pname(k) : "việc chung / vắng"}</span>
                        <span className="ml-auto shrink-0 font-mono text-slate-300">{f0(r2(h))} h</span>
                      </div>
                    )) : <div className="text-slate-500">Chưa gửi giờ nào trong khoảng này.</div>}
                    {L && <div className="mt-1 flex gap-2 border-t pt-1 font-mono text-slate-200" style={{ borderColor: C.line }}>
                      <span className="font-sans text-slate-500">Tổng</span>
                      <span className="ml-auto">{f0(r2(L.t))} h</span>
                    </div>}
                    {L && (L.ot > 0.005 || L.eff > 0.005 || L.idle > 0.005) && (
                      <div className="text-[11px] text-slate-500">
                        {[L.ot > 0.005 ? `OT ${f0(r2(L.ot))} h` : "", L.eff > 0.005 ? `cố gắng ${f0(r2(L.eff))} h` : "", L.idle > 0.005 ? `trống việc ${f0(r2(L.idle))} h` : ""].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>}
      </div>
    );
  };

  /* lũy kế của dự án đang chọn: kế hoạch từ tuần đầu của khoảng tới hết kế hoạch dự án, thực tế tới tuần cuối có giờ */
  const cum = (o) => {
    if (!o) return null;
    const first = weeks[0]?.i ?? 0;
    let last = first;
    for (const r of roles) (P?.[o.pid]?.[r.id] || []).forEach((v, i) => { if (v > 0 && i > last) last = i; });
    last = Math.max(last, weeks[weeks.length - 1]?.i ?? first);
    const idx = []; for (let i = first; i <= last; i++) idx.push(i);
    if (idx.length < 1) return null;
    let a = 0; const pc = idx.map((i) => (a += roles.reduce((s, r) => s + cellOf(P, o.pid, r.id, i), 0)));
    let b = 0; const ac = weeks.map((w, k) => (b += o.wk[k].tt));
    const Wd = 380, Ht = 150, Lx = 38, R = 8, T = 12, B = 24, mxv = Math.max(1, pc[pc.length - 1] || 0, b) * 1.08;
    const x = (i) => Lx + ((i - first) * (Wd - Lx - R)) / Math.max(1, idx.length - 1), y = (v) => T + (Ht - T - B) * (1 - v / mxv);
    const ax = isLight() ? "#94a3b8" : "#64748b";
    return (
      <svg width={Wd} height={Ht} style={{ display: "block" }}>
        {[0, 1, 2, 3, 4].map((k) => <g key={k}><line x1={Lx} x2={Wd - R} y1={y((mxv * k) / 4)} y2={y((mxv * k) / 4)} stroke={C.line} />
          <text x={Lx - 4} y={y((mxv * k) / 4) + 3} fontSize="9.5" fill={ax} textAnchor="end">{isH ? Math.round((mxv * k * HPP) / 4) : Math.round((mxv * k) / 4 * 10) / 10}</text></g>)}
        <polyline fill="none" stroke={C.plan} strokeWidth="2" strokeDasharray="5 4" points={idx.map((i, k) => `${x(i)},${y(pc[k])}`).join(" ")} />
        <polyline fill="none" stroke={C.over} strokeWidth="2.5" points={[`${x(first)},${y(0)}`, ...weeks.map((w, k) => `${x(w.i)},${y(ac[k])}`)].join(" ")} />
        {weeks.length > 0 && (() => { const w = weeks[weeks.length - 1], k = idx.indexOf(w.i); return <g>
          <circle cx={x(w.i)} cy={y(b)} r="4" fill={C.over} />
          {k >= 0 && <circle cx={x(w.i)} cy={y(pc[k])} r="3" fill={C.plan} />}
        </g>; })()}
        {idx.map((i, k) => (k === 0 || i % 4 === 0) && (k === 0 || x(i) - x(idx[0]) > 30)
          ? <text key={i} x={x(i)} y={Ht - 8} fontSize="9.5" fill={ax} textAnchor="middle">{`T${((i % 48) >> 2) + 1}·${(i % 4) + 1}`}</text> : null)}
      </svg>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <span className="text-xs text-slate-500">Khoảng</span>
        <div className="flex overflow-hidden rounded-md border border-slate-700">
          {/* v13.46 — tuần đang chạy: kế hoạch chia theo phần ngày đã qua, thực tế gồm cả giờ nháp */}
          <button onClick={() => setRange("now")} disabled={!nowW} className={`${seg(range === "now")} disabled:opacity-40`}>Tuần này</button>
          <button onClick={() => setRange("last")} disabled={!doneWeeks.length} className={`${seg(range === "last")} disabled:opacity-40`}>Tuần trước</button>
          <button onClick={() => setRange("4")} disabled={doneWeeks.length < 2} className={`${seg(range === "4")} disabled:opacity-40`}>4 tuần gần nhất</button>
          <button onClick={() => setRange("all")} disabled={doneWeeks.length < 2} className={`${seg(range === "all")} disabled:opacity-40`}>Từ khi có giờ chấm</button>
        </div>
        <span className="ml-2 text-xs text-slate-500">So với</span>
        <select value={base} onChange={(e) => setBase(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100">
          <option value="">Lưới kế hoạch hiện tại</option>
          {snaps.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
        </select>
        <span className="ml-2 text-xs text-slate-500">Đơn vị</span>
        <div className="flex overflow-hidden rounded-md border border-slate-700">
          <button onClick={() => setUnit("p")} aria-pressed={!isH} className={seg(!isH)}>Người</button>
          <button onClick={() => setUnit("h")} aria-pressed={isH} className={seg(isH)}>Giờ</button>
        </div>
        {/* v13.43 — ngưỡng kết luận chuyển từ Thiết lập về đây: chỗ duy nhất nhìn thấy kết quả của nó.
            Bấm là sửa và lưu ngay, bảng bên dưới đổi chip theo. */}
        {onLim && (
          <div className="relative ml-auto">
            <button onClick={() => setOpenLim((v) => !v)} aria-expanded={openLim}
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-700 px-2.5 text-[12.5px] text-slate-400 hover:border-slate-500 hover:text-slate-200"
              title="Ngưỡng quyết định các chip Đúng kế hoạch / Vượt / Thấp hơn / Lệch vai trò">
              <SlidersHorizontal size={14} /> Ngưỡng <span className="font-mono text-slate-300">{lim.tol}% / {lim.mix}%</span>
            </button>
            {openLim && <>
              <div className="fixed inset-0 z-20" onClick={() => setOpenLim(false)} />
              <div className="absolute right-0 top-10 z-30 w-[340px] rounded-lg border border-slate-700 p-3 shadow-xl"
                style={{ background: C.grp }}>
                <div className="mb-2 text-[10.5px] uppercase tracking-wider text-slate-500">Ngưỡng kết luận kế hoạch so với thực tế</div>
                <label className="mb-1 block text-[11.5px] text-slate-500">Đúng kế hoạch khi lệch trong (% kế hoạch)</label>
                <input type="number" inputMode="numeric" min="1" max="100" value={lv.tol}
                  onChange={(e) => setLv((x) => ({ ...x, tol: e.target.value }))}
                  className="mb-2.5 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 font-mono text-[13px] text-slate-100" />
                <label className="mb-1 block text-[11.5px] text-slate-500">Lệch vai trò khi tổng sai lệch vượt (% kế hoạch)</label>
                <input type="number" inputMode="numeric" min="1" max="200" value={lv.mix}
                  onChange={(e) => setLv((x) => ({ ...x, mix: e.target.value }))}
                  className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 font-mono text-[13px] text-slate-100" />
                <div className="mt-3 flex items-center gap-2 border-t border-slate-800 pt-2.5">
                  <button onClick={() => setLv({ tol: "15", mix: "30" })} className="text-[12px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">Về mặc định 15% / 30%</button>
                  <button onClick={saveLim} disabled={saving}
                    className="ml-auto h-8 shrink-0 rounded-md bg-teal-600 px-3 text-[12.5px] font-medium text-white hover:bg-teal-500 disabled:opacity-50">
                    {saving ? "Đang lưu…" : "Lưu ngưỡng"}</button>
                </div>
              </div>
            </>}
          </div>
        )}
        <span className={`${onLim ? "ml-2" : "ml-auto"} text-[11.5px] text-slate-500`}>
          {rangeTxt}{running ? ` · đang chạy, tính tới hết hôm qua (${Math.round(runFrac * 100)}% tuần)` : ""}
          {" · "}{wk1 ? `1 người = ${f0(wk1.D)} giờ${wk1.std > 0 && wk1.D < data.full ? " (tuần có ngày lễ)" : ""}` : "1 người = giờ chuẩn từng tuần"}</span>
      </div>

      {/* v13.59 — tuần đang chạy mà chưa có ngày nào trọn (sáng thứ Hai, hoặc mấy ngày đầu tuần là lễ):
          không có gì để so, nói thẳng thay vì hiện cả bảng "chưa ai làm". */}
      {running && runFrac <= 0 ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-8 text-sm text-slate-400">
          Tuần mới bắt đầu — chưa có ngày làm việc nào trọn để so với kế hoạch.
          {doneWeeks.length > 0 && <button onClick={() => setRange("last")} className="h-9 rounded-md border border-slate-700 px-3 text-[13px] text-slate-200 hover:border-slate-500">Xem tuần trước</button>}
        </div>
      ) : (<>
      <div className="grid gap-2 border-b border-slate-800 px-3 py-3 sm:grid-cols-2 md:px-4 xl:grid-cols-6">
        {/* v13.42 — ô quân số: kế hoạch đang xin bao nhiêu phần số người thật sự có */}
        {tile("Quân số kỳ này", CAP > 0 ? US(CAP) : "—",
          CAP > 0 ? `kế hoạch dùng ${Math.round((KH / CAP) * 100)}%${overCap.length ? ` · ${overCap.length} vai trò xin quá người` : ""}` : "chưa đặt hệ số sẵn sàng",
          overCap.length ? C.red : undefined)}
        {tile(nW > 1 && !isH ? "Kế hoạch bình quân / tuần" : "Kế hoạch", US(KH), `${ALL.filter((o) => o.KH > 0.005).length} dự án có kế hoạch`)}
        {/* v13.42 — bấm để bóc giờ việc chung / vắng ra theo người */}
        <button onClick={() => setOpenCom((x) => !x)} aria-expanded={openCom} className="rounded-lg border border-slate-800 px-3 py-2 text-left hover:border-slate-600" style={{ background: C.tile }}>
          <div className="text-[11px] text-slate-500">Thực tế đổ vào dự án</div>
          <div className="mt-0.5 font-mono text-[19px] leading-tight text-slate-100">{US(TT)}</div>
          <div className="text-[11.5px] text-slate-400">
            <span className="underline decoration-dotted underline-offset-2">chưa tính {f0(r2(data.common))} giờ việc chung / vắng</span>
            {data.missing ? ` · ${data.missing} người chưa gửi đủ tuần cuối` : ""}
          </div>
        </button>
        {tile("Đúng dự án, đúng vai trò", KH > 0 ? `${Math.round((okR / KH) * 100)}%` : "—", `${U(okR)} / ${US(KH)} kế hoạch được làm đúng chỗ`)}
        {tile("Có kế hoạch mà chưa ai làm", `${none.length} dự án`, none.length ? `${none.map((o) => o.p.name).join(", ")} · ${US(none.reduce((a, o) => a + o.KH, 0))}` : "không có", none.length ? C.red : undefined)}
        {tile("Làm ngoài kế hoạch", US(out.reduce((a, o) => a + o.TT, 0)), out.length ? out.map((o) => o.p.name).join(", ") : "không có", out.length ? C.over : undefined)}
      </div>

      {/* v13.42 — bóc giờ việc chung / vắng theo người. Con số này bằng hơn 10% tổng giờ nên
          đáng xem ai đang ở trong đó, trước giờ chỉ là một dòng chữ. */}
      {openCom && (
        <div className="border-b border-slate-800 px-3 py-3 md:px-4" style={{ background: C.grp }}>
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500">
            Giờ việc chung / vắng mặt · {f0(r2(data.common))} giờ trong {rangeTxt}
          </div>
          {(() => {
            const rows = [...data.per].map(([id, m]) => [id, m.get("") || 0]).filter(([, h]) => h > 0.005)
              .sort((a, b) => b[1] - a[1]);
            if (!rows.length) return <div className="text-[12.5px] text-slate-500">Không ai chấm giờ việc chung hay vắng mặt trong khoảng này.</div>;
            const mxh = Math.max(...rows.map((x) => x[1]));
            return (
              <div className="grid gap-x-8 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
                {rows.map(([id, h]) => {
                  const tot = [...(data.per.get(id) || new Map()).values()].reduce((a, v) => a + v, 0) || h;
                  return (
                    <div key={id} className="grid grid-cols-[minmax(0,1fr)_60px_80px] items-center gap-2 text-[12.5px]">
                      <span className="truncate text-slate-200">{nameOf.get(id) || id}</span>
                      <span className="text-right font-mono text-slate-300">{f0(r2(h))} h</span>
                      <span className="relative h-1.5 overflow-hidden rounded" style={{ background: C.line }}
                        title={`${f0(r2(h))} / ${f0(r2(tot))} giờ của người này trong khoảng`}>
                        <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(h / mxh) * 100}%`, background: C.mix }} /></span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* v13.42 — vai trò có kế hoạch xin nhiều hơn số người đang có: suất đó không bao giờ chạy đủ */}
      {overCap.length > 0 && (
        <div className="flex items-start gap-2.5 border-b px-3 py-2.5 text-[12.5px] md:px-4"
          style={{ background: C.redBg, borderColor: C.line, color: C.red }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div>
            <b className="font-semibold">Kế hoạch xin quá số người đang có</b> — suất thừa ra sẽ không bao giờ chạy đủ.
            <div className="mt-0.5 text-slate-400">
              {overCap.map((x) => `${x.r.id} kế hoạch ${U(x.k)} / quân số ${U(x.c)}`).join(" · ")}
            </div>
          </div>
        </div>
      )}

      {/* v13.41 — dải cảnh báo khi khoảng đang xem có tuần thiếu giờ gửi. Đây là chỗ dễ kết luận sai nhất:
          thiếu người gửi thì cột Thực tế thấp giả, mà chip "thấp hơn …%" vẫn hiện như dự án chạy chậm thật. */}
      {/* v13.46 — tuần đang chạy: nói rõ đang so với phần kế hoạch nào và bao nhiêu giờ còn là nháp */}
      {running && (
        <div className="flex items-start gap-2.5 border-b px-3 py-2.5 text-[12.5px] md:px-4"
          style={{ background: C.underBg, borderColor: C.line, color: C.under }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div>
            <b className="font-semibold">Tuần đang chạy — số liệu chưa chốt.</b> So trọn ngày tới hết hôm qua: kế hoạch cắt còn {Math.round(runFrac * 100)}%,
            thực tế chỉ lấy giờ của các ngày đó.
            <div className="mt-0.5 text-slate-400">
              Thực tế gồm {f0(r2(data.drft))} giờ NHÁP chưa bấm gửi
              {data.gapNames.length ? ` · ${data.gapNames.length} / ${data.nStaff} người còn bỏ trống ngày: ${data.gapNames.join(" · ")}` : " · mọi người đều đã chấm đủ"}
            </div>
          </div>
        </div>
      )}
      {!running && data.gapWeeks > 0 && (
        <div className="flex items-start gap-2.5 border-b px-3 py-2.5 text-[12.5px] md:px-4"
          style={{ background: C.mixBg, borderColor: C.line, color: C.mix }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div>
            <b className="font-semibold">{data.gapNames.length} / {data.nStaff} người chưa gửi đủ giờ</b>
            {nW > 1 ? ` ở ${data.gapWeeks} trong ${nW} tuần của khoảng này` : " trong tuần này"} — cột Thực tế có thể đang thấp giả,
            các kết luận có dấu <b className="font-semibold">*</b> chưa chắc đúng.
            <div className="mt-0.5 text-slate-400">{data.gapNames.join(" · ")}</div>
          </div>
        </div>
      )}

      <div className="grid items-start xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 border-slate-800 xl:border-r">
          {/* v13.42 — thanh lọc theo kết luận + ô tìm dự án, dùng lại kiểu nút của tab "Theo dự án" */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 md:px-4">
            <div className="flex flex-wrap overflow-hidden rounded-md border border-slate-700">
              <button onClick={() => setFSt("all")} aria-pressed={fSt === "all"} className={seg(fSt === "all")}>Tất cả <span className="opacity-60">{ALL.length}</span></button>
              {["none", "out", "mix", "over", "under", "ok"].map((k) => {
                const n = ALL.filter((o) => o.st === k).length;
                return n ? <button key={k} onClick={() => setFSt(k)} aria-pressed={fSt === k} className={seg(fSt === k)}>{GROUPS[k]} <span className="opacity-60">{n}</span></button> : null;
              })}
            </div>
            <div className="relative w-full sm:w-56">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm dự án" aria-label="Tìm dự án"
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 pl-7 pr-7 text-[13px] text-slate-100 placeholder:text-slate-600" />
              {q && <button onClick={() => setQ("")} aria-label="Xoá tìm" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"><X size={14} /></button>}
            </div>
            {(fSt !== "all" || q) && <button onClick={() => { setFSt("all"); setQ(""); }} className="text-[12px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">Xoá lọc</button>}
          </div>

          <div className={`hidden ${nW > 1 ? HEADN : HEAD1} items-center gap-3 border-b border-slate-800 px-4 py-2 text-[10.5px] uppercase tracking-wider text-slate-500 md:grid`}>
            <span>Dự án</span><span className="text-right">Kế hoạch</span><span className="text-right">Thực tế</span>
            {nW > 1 && <span>Từng tuần</span>}
            <span className="text-center">thiếu ← lệch → vượt</span><span>Theo vai trò · kế hoạch → thực tế</span><span>Kết luận</span>
          </div>
          {L.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">{ALL.length ? "Không có dự án nào khớp bộ lọc." : "Khoảng này chưa có kế hoạch hay giờ chấm vào dự án nào."}</p>}
          {L.map((o, k) => {
            const w = (Math.abs(o.d) / mx) * 26, pos = o.d > 0;
            const on = cur && cur.pid === o.pid;
            return (
              <React.Fragment key={o.pid}>
                {(k === 0 || L[k - 1].st !== o.st) && (
                  <div className="px-4 py-1.5 text-[10.5px] uppercase tracking-wider text-slate-500" style={{ background: C.grp, borderBottom: `1px solid ${C.line}` }}>{GROUPS[o.st]}</div>
                )}
                <div onClick={() => setSel(o.pid)} onMouseEnter={() => setHov(o.pid)} onMouseLeave={() => setHov((h) => (h === o.pid ? null : h))}
                  className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-[12.5px] ${nW > 1 ? ROWN : ROW1}`}
                  style={{ background: on ? C.sel : hov === o.pid ? C.hover : "transparent", borderLeft: `3px solid ${on ? C.selBar : "transparent"}`, borderBottom: `1px solid ${C.line}` }}>
                  <span className="truncate text-slate-200" style={on ? { color: C.selName } : undefined}>
                    {o.p.name}{o.p.code && <span className="ml-1.5 font-mono text-[11px] text-slate-500">{o.p.code}</span>}
                    {o.p.active === false && <span className="ml-1.5 rounded border border-slate-700 px-1.5 text-[10px] text-slate-500">đã đóng</span>}
                    {o.st === "none" && !assigned(o.pid) && <span className="ml-1.5 rounded border px-1.5 text-[10px]" style={{ color: C.red, borderColor: C.red }}>chưa giao ai</span>}
                  </span>
                  <span className="hidden text-right font-mono text-slate-300 md:block">{o.KH > 0.005 ? U(o.KH) : "—"}</span>
                  <span className="hidden text-right font-mono text-slate-100 md:block">{o.TT > 0.005 ? U(o.TT) : "—"}</span>
                  {nW > 1 && spark(o)}
                  <span className="relative hidden h-3.5 md:block">
                    <span className="absolute bottom-[-3px] top-[-3px]" style={{ left: "50%", borderLeft: `1px solid ${C.zero}` }} />
                    <span className="absolute top-[2px] h-2.5 rounded-sm" style={pos ? { left: "50%", width: `${w}%`, background: C.over } : { right: "50%", width: `${w}%`, background: C.under }} />
                    <span className="absolute top-[-2px] font-mono text-[11px] font-semibold" style={pos ? { left: `calc(50% + ${w}% + 4px)`, color: C.over } : { right: `calc(50% + ${w}% + 4px)`, color: C.under }}>{ddTxt(o.d)}</span>
                  </span>
                  <span className="hidden flex-wrap gap-x-3 gap-y-0.5 font-mono text-[12px] md:flex">
                    {roles.filter((r) => o.kh[r.id] || o.tt[r.id]).map((r) => {
                      const a = o.kh[r.id] || 0, b = o.tt[r.id] || 0, dd = b - a;
                      const c = Math.abs(dd) <= Math.max(0.15, a * 0.15) ? undefined : dd > 0 ? C.over : C.under;
                      return <span key={r.id} className="whitespace-nowrap text-slate-400" style={c ? { color: c } : undefined}>
                        <b className="mr-1 font-semibold" style={{ color: colorOf.get(r.id) }}>{r.id}</b>{U(a)} → {U(b)}</span>;
                    })}
                  </span>
                  <span>{pill(o.st, o)}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {cur && (
          <div className="border-t border-slate-800 p-3 md:p-4 xl:border-t-0">
            <div className="text-sm font-semibold" style={{ color: C.selName }}>{cur.p.name}{cur.p.code && <span className="ml-1.5 font-mono text-[11px] font-normal text-slate-500">{cur.p.code}</span>}</div>
            <div className="mb-3 mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">{rangeTxt} {pill(cur.st, cur)}
              {cur.p.active === false && <span>dự án đã đóng — không tính kế hoạch</span>}
              {cur.st === "none" && !assigned(cur.pid) && <span style={{ color: C.red }}>chưa giao ai vào dự án</span>}</div>
            <table className="mb-3 w-full text-[12.5px]">
              <thead><tr className="text-[10.5px] uppercase tracking-wider text-slate-500" style={{ borderBottom: `1px solid ${C.line}` }}>
                <th className="py-1.5 text-left font-medium">Vai trò</th><th className="py-1.5 text-right font-medium">Kế hoạch</th><th className="py-1.5 text-right font-medium">Thực tế</th><th className="py-1.5 text-right font-medium">Lệch</th></tr></thead>
              <tbody>
                {roles.filter((r) => cur.kh[r.id] || cur.tt[r.id]).map((r) => {
                  const a = cur.kh[r.id] || 0, b = cur.tt[r.id] || 0, d = b - a, op = isOpen(cur, r);
                  return (
                    <React.Fragment key={r.id}>
                    <tr onClick={() => flip(cur, r)} className="cursor-pointer" style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td className="py-1.5"><span className="mr-1 inline-block w-3 text-[10px] text-slate-500">{op ? "▾" : "▸"}</span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorOf.get(r.id) }} /><span className="text-slate-200">{r.name || r.id}</span></td>
                      <td className="py-1.5 text-right font-mono">{a ? U(a) : "—"}</td>
                      <td className="py-1.5 text-right font-mono">{b ? U(b) : "—"}</td>
                      <td className="py-1.5 text-right font-mono" style={{ color: Math.abs(d) <= Math.max(0.15, a * 0.15) ? undefined : d > 0 ? C.over : C.under }}>{ddTxt(d)}</td>
                    </tr>
                    {op && <tr style={{ borderBottom: `1px solid ${C.line}` }}><td colSpan={4} className="p-0">{rolePeople(cur, r)}</td></tr>}
                    </React.Fragment>
                  );
                })}
                <tr className="font-semibold"><td className="py-1.5">Cả dự án</td><td className="py-1.5 text-right font-mono">{U(cur.KH)}</td><td className="py-1.5 text-right font-mono">{U(cur.TT)}</td><td className="py-1.5 text-right font-mono">{ddTxt(cur.d)}</td></tr>
              </tbody>
            </table>
            <div className="mb-1 mt-3 text-[10.5px] uppercase tracking-wider text-slate-500">Lũy kế {isH ? "giờ" : "người-tuần"} · kế hoạch (nét đứt) so với thực tế</div>
            {(() => { const k0 = weeks[0]?.i ?? 0, kN = weeks[weeks.length - 1]?.i ?? k0;
              void k0; void kN;
              const pv = cur.wk.reduce((s2, x) => s2 + x.kh, 0);   // v13.59: cùng phần kế hoạch đã cắt như trong bảng
              const av = cur.wk.reduce((s2, x) => s2 + x.tt, 0);
              return <div className="mb-1 font-mono text-[12px]"><span style={{ color: C.plan }}>kế hoạch {isH ? f0(Math.round(pv * HPP * 10) / 10) : f0(r2(pv))}</span><span className="text-slate-600"> · </span><span style={{ color: C.over }}>thực tế {isH ? f0(Math.round(av * HPP * 10) / 10) : f0(r2(av))}</span><span className="text-slate-500"> {isH ? "giờ" : "người-tuần"} tới tuần {weeks.length ? wLabel(weeks[weeks.length - 1]) : ""}</span></div>; })()}
            {cum(cur)}
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
