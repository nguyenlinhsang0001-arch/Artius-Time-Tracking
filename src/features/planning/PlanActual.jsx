/* ARTIUS TIME v13.1 — Kế hoạch › "So với thực tế".
   So kế hoạch (lưới hiện tại hoặc một bản chốt) với giờ nhân sự ĐÃ GỬI vào từng dự án, cùng đơn vị số người:
     thực tế (người) = giờ đã gửi trong tuần ÷ giờ chuẩn một tuần (Thiết lập › giờ làm).
   Giờ tính theo vai trò của NGƯỜI chấm (vai trò gộp như lưới kế hoạch, vd TL-2D → 2D) — Sang chốt 02/11/2026.
   Tuần được tính: tuần đã qua, giờ đã gửi của từng người (không chờ cả công ty gửi đủ); tuần còn người
   chưa gửi thì ghi rõ số người chưa gửi ở hàng số liệu.
   Màn này CHỈ ĐỌC. */
import React, { useEffect, useMemo, useState } from "react";
import { addDays, fmt, mondayOf, weeklyTarget } from "../../core/date.jsx";
import { NO_PROJECT, isLeaveTask } from "../../core/domain.jsx";
import { isLight } from "../../core/theme.jsx";
import { cellOf, foldMerged, joinYears, normalizeYear, slotIndexOf } from "./planCalc.js";
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
const GROUPS = { none: "Có kế hoạch, chưa ai làm", out: "Làm ngoài kế hoạch", mix: "Đủ người nhưng sai vai trò", over: "Thực tế nhiều hơn kế hoạch", under: "Thực tế ít hơn kế hoạch", ok: "Đúng kế hoạch" };
const ORDER = { none: 0, out: 1, mix: 2, over: 3, under: 4, ok: 5 };

export function PlanActual({ plan, projects, roles, start, realWeeks, detail, staff, hoursCfg, prole = (r) => r, loading = false }) {
  useThemeTick();
  const C = isLight() ? TONE.light : TONE.dark;
  const [range, setRange] = useState("last");   /* last | 4 | all */
  const [base, setBase] = useState("");         /* "" = lưới hiện tại, còn lại = nhãn bản chốt */
  const [snaps, setSnaps] = useState([]);       /* [{ label, a: id năm start, b: id năm start+1, at }] */
  const [snapPlan, setSnapPlan] = useState(null);
  const [sel, setSel] = useState(null);
  const [hov, setHov] = useState(null);
  const STD = weeklyTarget(hoursCfg) || 44;
  const colorOf = useMemo(() => new Map(roles.map((r, k) => [r.id, PALETTE[k % PALETTE.length]])), [roles]);

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
      if (alive) setSnapPlan(foldMerged(joinYears(normalizeYear(a, start), normalizeYear(b, start + 1), 48, 48), prole).plan);
    }).catch(() => alive && setSnapPlan({}));
    return () => { alive = false; };
  }, [base, snaps, start, prole]);
  const P = base ? snapPlan || {} : plan;

  /* ---------- giờ đã gửi, gom theo tuần thật ---------- */
  const roleOf = useMemo(() => new Map(staff.map((e) => [e.id, e.role || ""])), [staff]);
  const nameOf = useMemo(() => new Map(staff.map((e) => [e.id, e.name || e.id])), [staff]);
  const projIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
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
    weeks.forEach((w, k) => {
      const i = w.i;
      for (const pid of Object.keys(P || {})) for (const r of roles) {
        const v = cellOf(P, pid, r.id, i); if (!v) continue;
        const o = get(pid); o.kh[r.id] = (o.kh[r.id] || 0) + v / nW; o.wk[k].kh += v;
      }
      for (const x of hoursBy.get(w.monday) || []) {
        if (!x.h) continue;
        total += x.h;
        if (!x.pid || x.pid === NO_PROJECT || !projIds.has(x.pid) || isLeaveTask(x.task)) { common += x.h; continue; }
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
        : Math.abs(d) <= Math.max(0.25, KH * 0.15) ? (mis > Math.max(0.5, KH * 0.3) ? "mix" : "ok") : d > 0 ? "over" : "under";
      const okR = roles.reduce((a, r) => a + Math.min(o.kh[r.id] || 0, o.tt[r.id] || 0), 0);
      return { ...o, p, KH, TT, d, st, okR };
    }).filter((o) => o.KH > 0.005 || o.TT > 0.005);
    list.sort((a, b) => ORDER[a.st] - ORDER[b.st] || Math.abs(b.d) - Math.abs(a.d));
    /* người chưa gửi giờ của tuần cuối trong khoảng */
    const lastW = weeks[weeks.length - 1];
    const sent = new Set((lastW && hoursBy.get(lastW.monday) || []).map((x) => x.empId));
    const missing = staff.filter((e) => e.role && !sent.has(e.id)).length;
    return { list, common, total, missing };
  }, [P, weeks, hoursBy, roles, projects, projIds, roleOf, STD, nW, staff]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="px-4 py-8 text-sm text-slate-500">Đang tải giờ đã chấm…</p>;
  if (!doneWeeks.length) return <p className="px-4 py-8 text-sm text-slate-500">Chưa có tuần nào đã qua có giờ gửi trong hai năm đang xem.</p>;

  const L = data.list;
  const cur = L.find((o) => o.pid === sel) || L[0];
  const KH = L.reduce((a, o) => a + o.KH, 0), TT = L.reduce((a, o) => a + o.TT, 0), okR = L.reduce((a, o) => a + o.okR, 0);
  const none = L.filter((o) => o.st === "none"), out = L.filter((o) => o.st === "out");
  const mx = Math.max(0.5, ...L.map((o) => Math.abs(o.d)));
  const pill = (st, o) => {
    const map = { none: [C.red, C.redBg, "chưa ai làm"], out: [C.over, C.overBg, "ngoài kế hoạch"], mix: [C.mix, C.mixBg, "đủ người, lệch vai trò"], ok: [C.ok, C.okBg, "đúng kế hoạch"],
      over: [C.over, C.overBg, `vượt ${o.KH ? Math.round((o.d / o.KH) * 100) : 0}%`], under: [C.under, C.underBg, `thấp hơn ${o.KH ? Math.round((-o.d / o.KH) * 100) : 0}%`] };
    const [c, bg, t] = map[st];
    return <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px]" style={{ color: c, background: bg }}>{t}</span>;
  };
  const tile = (k, v, s, color) => (
    <div className="rounded-lg border border-slate-800 px-3 py-2" style={{ background: C.tile }}>
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className="mt-0.5 font-mono text-[19px] leading-tight text-slate-100" style={color ? { color } : undefined}>{v}</div>
      <div className="text-[11.5px] text-slate-400">{s}</div>
    </div>
  );
  const seg = (on) => `h-9 whitespace-nowrap px-3 text-[13px] ${on ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`;
  const ddTxt = (d) => `${d > 0.005 ? "+" : d < -0.005 ? "−" : ""}${f0(r2(Math.abs(d)))}`;

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
    const Wd = 380, Ht = 150, Lx = 30, R = 8, T = 12, B = 24, mxv = Math.max(1, pc[pc.length - 1] || 0, b) * 1.08;
    const x = (i) => Lx + ((i - first) * (Wd - Lx - R)) / Math.max(1, idx.length - 1), y = (v) => T + (Ht - T - B) * (1 - v / mxv);
    const ax = isLight() ? "#94a3b8" : "#64748b";
    return (
      <svg width={Wd} height={Ht} style={{ display: "block" }}>
        {[0, 1, 2, 3, 4].map((k) => <g key={k}><line x1={Lx} x2={Wd - R} y1={y((mxv * k) / 4)} y2={y((mxv * k) / 4)} stroke={C.line} />
          <text x={Lx - 4} y={y((mxv * k) / 4) + 3} fontSize="9.5" fill={ax} textAnchor="end">{Math.round((mxv * k) / 4)}</text></g>)}
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
        <span className="ml-auto text-[11.5px] text-slate-500">{rangeTxt} · {f0(STD)} giờ = 1 người</span>
      </div>

      <div className="grid gap-2 border-b border-slate-800 px-3 py-3 sm:grid-cols-2 md:px-4 xl:grid-cols-5">
        {tile(nW > 1 ? "Kế hoạch bình quân / tuần" : "Kế hoạch", `${f0(r2(KH))} người`, `${L.filter((o) => o.KH > 0.005).length} dự án có kế hoạch`)}
        {tile("Thực tế đổ vào dự án", `${f0(r2(TT))} người`, `chưa tính ${f0(r2(data.common))} giờ việc chung / vắng${data.missing ? ` · ${data.missing} người chưa gửi tuần cuối` : ""}`)}
        {tile("Đúng dự án, đúng vai trò", KH > 0 ? `${Math.round((okR / KH) * 100)}%` : "—", `${f0(r2(okR))} / ${f0(r2(KH))} người kế hoạch được làm đúng chỗ`)}
        {tile("Có kế hoạch mà chưa ai làm", `${none.length} dự án`, none.length ? `${none.map((o) => o.p.name).join(", ")} · ${f0(r2(none.reduce((a, o) => a + o.KH, 0)))} người` : "không có", none.length ? C.red : undefined)}
        {tile("Làm ngoài kế hoạch", `${f0(r2(out.reduce((a, o) => a + o.TT, 0)))} người`, out.length ? out.map((o) => o.p.name).join(", ") : "không có", out.length ? C.over : undefined)}
      </div>

      <div className="grid items-start xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 border-slate-800 xl:border-r">
          <div className="hidden grid-cols-[minmax(200px,1.3fr)_64px_64px_minmax(160px,1fr)_minmax(220px,1.5fr)_110px] items-center gap-3 border-b border-slate-800 px-4 py-2 text-[10.5px] uppercase tracking-wider text-slate-500 md:grid">
            <span>Dự án</span><span className="text-right">Kế hoạch</span><span className="text-right">Thực tế</span>
            <span className="text-center">thiếu ← lệch → vượt</span><span>Theo vai trò · kế hoạch → thực tế</span><span>Kết luận</span>
          </div>
          {L.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">Khoảng này chưa có kế hoạch hay giờ chấm vào dự án nào.</p>}
          {L.map((o, k) => {
            const w = (Math.abs(o.d) / mx) * 26, pos = o.d > 0;
            const on = cur && cur.pid === o.pid;
            return (
              <React.Fragment key={o.pid}>
                {(k === 0 || L[k - 1].st !== o.st) && (
                  <div className="px-4 py-1.5 text-[10.5px] uppercase tracking-wider text-slate-500" style={{ background: C.grp, borderBottom: `1px solid ${C.line}` }}>{GROUPS[o.st]}</div>
                )}
                <div onClick={() => setSel(o.pid)} onMouseEnter={() => setHov(o.pid)} onMouseLeave={() => setHov((h) => (h === o.pid ? null : h))}
                  className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-[12.5px] md:grid-cols-[minmax(200px,1.3fr)_64px_64px_minmax(160px,1fr)_minmax(220px,1.5fr)_110px]"
                  style={{ background: on ? C.sel : hov === o.pid ? C.hover : "transparent", borderLeft: `3px solid ${on ? C.selBar : "transparent"}`, borderBottom: `1px solid ${C.line}` }}>
                  <span className="truncate text-slate-200" style={on ? { color: C.selName } : undefined}>
                    {o.p.name}{o.p.code && <span className="ml-1.5 font-mono text-[11px] text-slate-500">{o.p.code}</span>}
                  </span>
                  <span className="hidden text-right font-mono text-slate-300 md:block">{o.KH > 0.005 ? f0(r2(o.KH)) : "—"}</span>
                  <span className="hidden text-right font-mono text-slate-100 md:block">{o.TT > 0.005 ? f0(r2(o.TT)) : "—"}</span>
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
                        <b className="mr-1 font-semibold" style={{ color: colorOf.get(r.id) }}>{r.id}</b>{f0(r2(a))} → {f0(r2(b))}</span>;
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
            <div className="mb-3 mt-1 flex items-center gap-2 text-[11.5px] text-slate-500">{rangeTxt} {pill(cur.st, cur)}</div>
            <table className="mb-3 w-full text-[12.5px]">
              <thead><tr className="text-[10.5px] uppercase tracking-wider text-slate-500" style={{ borderBottom: `1px solid ${C.line}` }}>
                <th className="py-1.5 text-left font-medium">Vai trò</th><th className="py-1.5 text-right font-medium">Kế hoạch</th><th className="py-1.5 text-right font-medium">Thực tế</th><th className="py-1.5 text-right font-medium">Lệch</th></tr></thead>
              <tbody>
                {roles.filter((r) => cur.kh[r.id] || cur.tt[r.id]).map((r) => {
                  const a = cur.kh[r.id] || 0, b = cur.tt[r.id] || 0, d = b - a;
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td className="py-1.5"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorOf.get(r.id) }} /><span className="font-mono">{r.id}</span> <span className="text-slate-400">{r.name}</span></td>
                      <td className="py-1.5 text-right font-mono">{a ? f0(r2(a)) : "—"}</td>
                      <td className="py-1.5 text-right font-mono">{b ? f0(r2(b)) : "—"}</td>
                      <td className="py-1.5 text-right font-mono" style={{ color: Math.abs(d) <= Math.max(0.15, a * 0.15) ? undefined : d > 0 ? C.over : C.under }}>{ddTxt(d)}</td>
                    </tr>
                  );
                })}
                <tr className="font-semibold"><td className="py-1.5">Cả dự án</td><td className="py-1.5 text-right font-mono">{f0(r2(cur.KH))}</td><td className="py-1.5 text-right font-mono">{f0(r2(cur.TT))}</td><td className="py-1.5 text-right font-mono">{ddTxt(cur.d)}</td></tr>
              </tbody>
            </table>
            <div className="mb-1 text-[10.5px] uppercase tracking-wider text-slate-500">Ai đã chấm vào dự án</div>
            {cur.ppl.size === 0 ? <div className="text-[12px] text-slate-500">Chưa ai chấm giờ vào dự án này trong khoảng đang xem.</div>
              : [...cur.ppl].sort((a, b) => b[1] - a[1]).map(([id, h]) => (
                <div key={id} className="flex justify-between py-0.5 text-[12.5px]" style={{ borderBottom: `1px solid ${C.line}` }}>
                  <span className="text-slate-200">{nameOf.get(id)}<span className="ml-1.5 font-mono text-[11px] text-slate-500">{roleOf.get(id)}</span></span>
                  <span className="font-mono text-slate-300">{f0(r2(h))} h · {f0(r2(h / STD / nW))} người</span>
                </div>
              ))}
            <div className="mb-1 mt-3 text-[10.5px] uppercase tracking-wider text-slate-500">Lũy kế người-tuần · kế hoạch (nét đứt) so với thực tế</div>
            {(() => { const k0 = weeks[0]?.i ?? 0, kN = weeks[weeks.length - 1]?.i ?? k0;
              let pv = 0; for (let i = k0; i <= kN; i++) pv += roles.reduce((s2, r) => s2 + cellOf(P, cur.pid, r.id, i), 0);
              const av = cur.wk.reduce((s2, x) => s2 + x.tt, 0);
              return <div className="mb-1 font-mono text-[12px]"><span style={{ color: C.plan }}>kế hoạch {f0(r2(pv))}</span><span className="text-slate-600"> · </span><span style={{ color: C.over }}>thực tế {f0(r2(av))}</span><span className="text-slate-500"> người-tuần tới tuần {weeks.length ? wLabel(weeks[weeks.length - 1]) : ""}</span></div>; })()}
            {cum(cur)}
          </div>
        )}
      </div>
    </div>
  );
}
