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
import { addDays, fmt, mondayOf, weeklyTarget } from "../../core/date.jsx";
import { NO_PROJECT, isLeaveTask } from "../../core/domain.jsx";
import { isLight } from "../../core/theme.jsx";
import { cellOf, foldMerged, joinYears, normalizeYear, planLimits, slotIndexOf } from "./planCalc.js";
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
const GROUPS = { none: "Có kế hoạch, chưa ai làm", out: "Làm ngoài kế hoạch", mix: "Đủ người nhưng sai vai trò", over: "Thực tế nhiều hơn kế hoạch", under: "Thực tế ít hơn kế hoạch", ok: "Đúng kế hoạch" };
const ORDER = { none: 0, out: 1, mix: 2, over: 3, under: 4, ok: 5 };

export function PlanActual({ plan, projects, roles, start, realWeeks, detail, staff, hoursCfg, prole = (r) => r, loading = false,
  hidden = new Set(), support = [], /* v13.42 */ cap = new Map(), lim = { tol: 15, mix: 30 },
  /* v13.43 — chỉnh ngưỡng ngay tại đây; không truyền onLim (hoặc chỉ xem) thì nút biến mất */
  onLim = null, flash = null }) {
  useThemeTick();
  const C = isLight() ? TONE.light : TONE.dark;
  const [range, setRange] = useState("last");   /* last | 4 | all */
  const [base, setBase] = useState("");         /* "" = lưới hiện tại, còn lại = nhãn bản chốt */
  const [snaps, setSnaps] = useState([]);       /* [{ label, a: id năm start, b: id năm start+1, at }] */
  const [snapPlan, setSnapPlan] = useState(null);
  const [sel, setSel] = useState(null);
  const [hov, setHov] = useState(null);
  const [unit, setUnit] = useState("h");        /* h = giờ | p = người */
  const [tog, setTog] = useState({});           /* "pid|rid" -> mở / đóng do người dùng bấm */
  const [openCom, setOpenCom] = useState(false);   /* v13.42: bóc giờ việc chung / vắng */
  const [fSt, setFSt] = useState("all");           /* v13.42: lọc theo kết luận */
  const [q, setQ] = useState("");                  /* v13.42: tìm dự án */
  const [openLim, setOpenLim] = useState(false);   /* v13.43: bảng chỉnh ngưỡng ngay trên thanh công cụ */
  const [lv, setLv] = useState({ tol: String(lim.tol), mix: String(lim.mix) });
  const [saving, setSaving] = useState(false);
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
  const hoursBy = useMemo(() => {
    const m = new Map();   /* monday -> [{ empId, pid, h }] */
    for (const d of detail || []) {
      const mon = fmt(mondayOf(new Date(d.date)));
      if (mon >= thisMon) continue;
      if (!m.has(mon)) m.set(mon, []);
      m.get(mon).push({ empId: d.empId, pid: d.projectId, task: d.taskId, h: Number(d.hours) || 0 });
    }
    return m;
  }, [detail, thisMon]);
  const doneWeeks = useMemo(() => realWeeks.filter((w) => w.monday < thisMon && hoursBy.has(w.monday)), [realWeeks, hoursBy, thisMon]);
  const weeks = useMemo(() => {
    if (!doneWeeks.length) return [];
    if (range === "last") return doneWeeks.slice(-1);
    if (range === "4") return doneWeeks.slice(-4);
    return doneWeeks;
  }, [doneWeeks, range]);
  const nW = weeks.length || 1;
  const wLabel = (w) => { const d = new Date(w.monday); return `T${d.getMonth() + 1}·${Math.min(4, Math.ceil(d.getDate() / 7))}`; };
  const rangeTxt = weeks.length ? (weeks.length === 1 ? `tuần ${wLabel(weeks[0])} (${fmt(new Date(weeks[0].monday)).slice(8, 10)}/${fmt(new Date(weeks[0].monday)).slice(5, 7)} – ${fmt(addDays(new Date(weeks[0].monday), 6)).slice(8, 10)}/${fmt(addDays(new Date(weeks[0].monday), 6)).slice(5, 7)})`
    : `${weeks.length} tuần ${wLabel(weeks[0])} → ${wLabel(weeks[weeks.length - 1])}`) : "";

  /* ---------- so sánh ---------- */
  const data = useMemo(() => {
    const rows = new Map();
    const get = (pid) => { if (!rows.has(pid)) rows.set(pid, { pid, kh: {}, tt: {}, ppl: new Map(), wk: weeks.map(() => ({ kh: 0, tt: 0 })) }); return rows.get(pid); };
    let common = 0, total = 0;
    const per = new Map();   /* empId -> Map(pid | "" (việc chung / vắng) -> giờ) */
    const add = (e, k, h) => { if (!per.has(e)) per.set(e, new Map()); const m = per.get(e); m.set(k, (m.get(k) || 0) + h); };
    weeks.forEach((w, k) => {
      const i = w.i;
      for (const pid of Object.keys(P || {})) {
        if (!liveIds.has(pid)) continue;   /* v13.3: dự án đã đóng / tạm ẩn không tính kế hoạch */
        for (const r of roles) {
        const v = cellOf(P, pid, r.id, i); if (!v) continue;
        const o = get(pid); o.kh[r.id] = (o.kh[r.id] || 0) + v / nW; o.wk[k].kh += v;
        }
      }
      for (const x of hoursBy.get(w.monday) || []) {
        if (!x.h) continue;
        total += x.h;
        if (!x.pid || x.pid === NO_PROJECT || !projIds.has(x.pid) || isLeaveTask(x.task)) { common += x.h; add(x.empId, "", x.h); continue; }
        add(x.empId, x.pid, x.h);
        const rid = roleOf.get(x.empId); if (!rid) continue;
        const o = get(x.pid);
        o.tt[rid] = (o.tt[rid] || 0) + x.h / STD / nW; o.wk[k].tt += x.h / STD;
        o.ppl.set(x.empId, (o.ppl.get(x.empId) || 0) + x.h);
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
    list.sort((a, b) => ORDER[a.st] - ORDER[b.st] || Math.abs(b.d) - Math.abs(a.d));
    /* v13.41 — tuần thiếu giờ: trước đây chỉ xét TUẦN CUỐI và chỉ đếm số người.
       Nay xét MỌI tuần trong khoảng và giữ lại tên, vì chỉ cần một tuần thiếu giờ là cột Thực tế
       của cả khoảng đã thấp giả — mà kết luận "thấp hơn …%" vẫn hiện đỏ như thể dự án chạy chậm thật. */
    const who = staff.filter((e) => e.role);
    const gap = weeks.map((w) => {
      const sent = new Set((hoursBy.get(w.monday) || []).map((x) => x.empId));
      return { w, miss: who.filter((e) => !sent.has(e.id)) };
    }).filter((x) => x.miss.length);
    const missNames = [...new Set(gap.flatMap((x) => x.miss.map((e) => e.name || e.id)))];
    const lastGap = gap.find((x) => x.w.monday === weeks[weeks.length - 1]?.monday);
    return { list, common, total, missing: lastGap ? lastGap.miss.length : 0,
      gapWeeks: gap.length, gapNames: missNames, nStaff: who.length, per };
  }, [P, weeks, hoursBy, roles, projects, projIds, liveIds, roleOf, STD, nW, staff, lim]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="px-4 py-8 text-sm text-slate-500">Đang tải giờ đã chấm…</p>;
  if (!doneWeeks.length) return <p className="px-4 py-8 text-sm text-slate-500">Chưa có tuần nào đã qua có giờ gửi trong hai năm đang xem.</p>;

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
  const CAP = roles.reduce((a, r) => a + (cap.get(r.id) || 0), 0);
  const overCap = roles.map((r) => {
    const c = cap.get(r.id) || 0, k = ALL.reduce((a, o) => a + (o.kh[r.id] || 0), 0);
    return { r, c, k, gap: k - c };
  }).filter((x) => x.c > 0 && x.gap > 0.01).sort((a, b) => b.gap - a.gap);
  const mx = Math.max(0.5, ...ALL.map((o) => Math.abs(o.d)));   // thước thanh lệch giữ nguyên khi lọc
  /* v13.41 — chỉ "thấp hơn" và "chưa ai làm" mới có thể do người chưa gửi giờ gây ra;
     các kết luận còn lại không bị ảnh hưởng nên không đánh dấu. */
  const doubt = (st) => data.gapWeeks > 0 && (st === "under" || st === "none");
  const pill = (st, o) => {
    const map = { none: [C.red, C.redBg, "chưa ai làm"], out: [C.over, C.overBg, "ngoài kế hoạch"], mix: [C.mix, C.mixBg, "đủ người, lệch vai trò"], ok: [C.ok, C.okBg, "đúng kế hoạch"],
      over: [C.over, C.overBg, `vượt ${o.KH ? Math.round((o.d / o.KH) * 100) : 0}%`], under: [C.under, C.underBg, `thấp hơn ${o.KH ? Math.round((-o.d / o.KH) * 100) : 0}%`] };
    const [c, bg, t] = map[st];
    const q = doubt(st);
    return <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px]" style={{ color: c, background: bg }}
      title={q ? `Còn ${data.gapNames.length} người chưa gửi giờ trong khoảng này — số thực tế có thể thấp hơn thực tế, kết luận này chưa chắc` : undefined}>
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
  const U = (v) => (isH ? f0(Math.round(v * STD * nW * 10) / 10) : f0(r2(v)));
  const UL = isH ? "giờ" : "người";
  const US = (v) => `${U(v)} ${UL}`;
  const ddTxt = (d) => `${d > 0.005 ? "+" : d < -0.005 ? "−" : ""}${U(Math.abs(d))}`;
  const pname = (pid) => (pid ? (projects.find((x) => x.id === pid)?.name || pid) : "việc chung / vắng");
  const lagging = (a, b) => b < a - Math.max(0.15, a * 0.15);
  const isOpen = (o, r) => { const k = `${o.pid}|${r.id}`; if (k in tog) return tog[k];
    const a = o.kh[r.id] || 0, b = o.tt[r.id] || 0; return Math.abs(b - a) > Math.max(0.15, a * 0.15); };
  const flip = (o, r) => setTog((t) => ({ ...t, [`${o.pid}|${r.id}`]: !isOpen(o, r) }));
  /* danh sách người của một vai trò trong dự án đang chọn */
  const rolePeople = (o, r) => {
    const a = o.kh[r.id] || 0, b = o.tt[r.id] || 0, planH = a * STD * nW;
    const inP = [...o.ppl].filter(([id]) => roleOf.get(id) === r.id).sort((x, y) => y[1] - x[1]);
    const mxH = Math.max(planH, 1, ...inP.map((x) => x[1]));
    const tot = (id) => [...(data.per.get(id) || new Map()).values()].reduce((s2, v) => s2 + v, 0);
    const others = lagging(a, b) ? staff.filter((e) => e.role === r.id).map((e) => [e, [...(data.per.get(e.id) || new Map())].filter(([k]) => k !== o.pid).sort((x, y) => y[1] - x[1])]) : [];
    return (
      <div className="py-1.5 pl-5 pr-1 text-[12px]" style={{ background: C.grp }}>
        {inP.length ? <>
          <div className="mb-0.5 text-[10.5px] uppercase tracking-wider text-slate-500">Đã chấm vào dự án{planH ? ` · kế hoạch vai trò ${f0(Math.round(planH * 10) / 10)} h` : ""}</div>
          {inP.map(([id, h]) => { const T2 = tot(id) || h; return (
            <div key={id} className="py-0.5">
              <div className="grid grid-cols-[minmax(0,1fr)_58px_110px] items-center gap-2">
                <span className="truncate text-slate-200">{nameOf.get(id)}</span>
                <span className="text-right font-mono text-slate-300">{f0(r2(h))} h</span>
                <span className="relative h-1.5 overflow-hidden rounded" style={{ background: C.line }} title={`${f0(r2(h))} / ${f0(r2(T2))} h trong khoảng`}>
                  <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (h / mxH) * 100)}%`, background: colorOf.get(r.id) }} /></span>
              </div>
              <div className="text-[11px] text-slate-500">{Math.round((h / T2) * 100)}% giờ của người này{planH ? ` · gánh ${Math.round((h / planH) * 100)}% kế hoạch vai trò` : ""}</div>
            </div>); })}
        </> : <div className="mb-1" style={{ color: C.under }}>Không ai thuộc vai trò {r.id} chấm giờ vào dự án này.</div>}
        {others.length > 0 && <>
          <div className="mb-0.5 mt-1.5 text-[10.5px] uppercase tracking-wider text-slate-500">Người {r.id} trong khoảng này đang làm ở</div>
          {others.map(([e, l]) => (
            <div key={e.id} className="py-0.5"><span className="text-slate-200">{e.name || e.id}</span>{" "}
              <span className="text-slate-500">— {l.length ? l.map(([k, h]) => `${pname(k)} ${f0(r2(h))} h`).join(" · ") : "chưa gửi giờ"}</span></div>
          ))}
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
          <text x={Lx - 4} y={y((mxv * k) / 4) + 3} fontSize="9.5" fill={ax} textAnchor="end">{isH ? Math.round((mxv * k * STD) / 4) : Math.round((mxv * k) / 4 * 10) / 10}</text></g>)}
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
          <button onClick={() => setRange("last")} className={seg(range === "last")}>Tuần trước</button>
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
        <span className={`${onLim ? "ml-2" : "ml-auto"} text-[11.5px] text-slate-500`}>{rangeTxt} · {f0(STD)} giờ = 1 người</span>
      </div>

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
            {data.missing ? ` · ${data.missing} người chưa gửi tuần cuối` : ""}
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
      {data.gapWeeks > 0 && (
        <div className="flex items-start gap-2.5 border-b px-3 py-2.5 text-[12.5px] md:px-4"
          style={{ background: C.mixBg, borderColor: C.line, color: C.mix }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div>
            <b className="font-semibold">{data.gapNames.length} / {data.nStaff} người chưa gửi giờ</b>
            {nW > 1 ? ` ở ${data.gapWeeks} trong ${nW} tuần của khoảng này` : " trong tuần này"} — cột Thực tế đang thấp hơn thực tế,
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
              {cur.st === "none" && !assigned(cur.pid) && <span style={{ color: C.red }}>chưa giao ai vào dự án</span>}<span>bấm một vai trò để mở / đóng danh sách người</span></div>
            <table className="mb-3 w-full text-[12.5px]">
              <thead><tr className="text-[10.5px] uppercase tracking-wider text-slate-500" style={{ borderBottom: `1px solid ${C.line}` }}>
                <th className="py-1.5 text-left font-medium">Vai trò</th><th className="py-1.5 text-right font-medium">Kế hoạch</th><th className="py-1.5 text-right font-medium">Thực tế</th><th className="py-1.5 text-right font-medium">Lệch</th></tr></thead>
              <tbody>
                {roles.filter((r) => cur.kh[r.id] || cur.tt[r.id]).map((r) => {
                  const a = cur.kh[r.id] || 0, b = cur.tt[r.id] || 0, d = b - a, op = isOpen(cur, r);
                  return (
                    <React.Fragment key={r.id}>
                    <tr onClick={() => flip(cur, r)} className="cursor-pointer" style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td className="py-1.5"><span className="mr-1 inline-block w-3 text-[10px] text-slate-500">{op ? "▾" : "▸"}</span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorOf.get(r.id) }} /><span className="font-mono">{r.id}</span> <span className="text-slate-400">{r.name}</span></td>
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
              let pv = 0; for (let i = k0; i <= kN; i++) pv += roles.reduce((s2, r) => s2 + cellOf(P, cur.pid, r.id, i), 0);
              const av = cur.wk.reduce((s2, x) => s2 + x.tt, 0);
              return <div className="mb-1 font-mono text-[12px]"><span style={{ color: C.plan }}>kế hoạch {isH ? f0(Math.round(pv * STD * 10) / 10) : f0(r2(pv))}</span><span className="text-slate-600"> · </span><span style={{ color: C.over }}>thực tế {isH ? f0(Math.round(av * STD * 10) / 10) : f0(r2(av))}</span><span className="text-slate-500"> {isH ? "giờ" : "người-tuần"} tới tuần {weeks.length ? wLabel(weeks[weeks.length - 1]) : ""}</span></div>; })()}
            {cum(cur)}
          </div>
        )}
      </div>
    </div>
  );
}
