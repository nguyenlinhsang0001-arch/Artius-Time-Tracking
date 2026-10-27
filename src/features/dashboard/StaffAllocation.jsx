/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useMemo } from "react";
import {
  ChevronRight, ChevronDown,
} from "lucide-react";
import { DEFAULT_PHASE, NO_PROJECT, fmtH, isIdleTask, isLeaveTask, isOtId, phaseLabel, roleTitle, tone } from "../../core/domain.jsx";
import { CTRL, Kpi, selectCls } from "../../core/ui.jsx";
import { ALLOC_PAL, ALLOC_ST, allocLimits, allocState } from "../../shared/alloc.jsx";
import { pct100 } from "./calc.jsx";

export function StaffAllocation({ matrix, otByEmp, effortByEmp, idleByEmp = new Map(), staff, std, stdOf, cfg, empName, projMapById, detail = [], projDetail = [], taskLabel, view = "people" }) {
  /* v10.1: "Theo người" / "Ma trận" không còn là nút bên trong khung — đã tách thành hai tab riêng ở Dashboard */
  const [tip, setTip] = useState(null);         // v5.5: { eid, k, x, y } — thẻ khi rê chuột vào dự án trong phần chi tiết
  /* v5.5 — tác vụ theo người × dự án (theo kỳ và bộ lọc), và tổng giờ từng dự án trong kỳ (mọi nhân sự, không theo bộ lọc bộ phận / tên) */
  const byEP = useMemo(() => {
    const m = new Map();
    for (const d of detail) {
      const k = `${d.empId}|${isLeaveTask(d.taskId) ? NO_PROJECT : d.projectId}`;
      const o = m.get(k) || { tasks: new Map(), phases: new Set() };
      const ot = isOtId(d.taskId);
      const lbl = ot ? `Tăng ca · ${d.otFor ? taskLabel(d.otFor) : "chưa rõ tác vụ"}` : taskLabel(d.taskId);
      const t = o.tasks.get(lbl) || { h: 0, ot, idle: isIdleTask(d.taskId) }; t.h += d.hours; o.tasks.set(lbl, t);
      if (d.projectId !== NO_PROJECT && !isLeaveTask(d.taskId)) o.phases.add(d.phaseId || DEFAULT_PHASE);
      m.set(k, o);
    }
    return m;
  }, [detail, taskLabel]);
  /* v5.8 — tác vụ của từng người trong kỳ (gộp mọi dự án): Map eid -> [{ name, h, ot }], tăng ca xếp cuối */
  const byE = useMemo(() => {
    const m = new Map();
    for (const [k, o] of byEP) {
      const eid = k.split("|")[0];
      const mm = m.get(eid) || new Map();
      for (const [lbl, t] of o.tasks) { const x = mm.get(lbl) || { name: lbl, h: 0, ot: t.ot, idle: t.idle }; x.h += t.h; mm.set(lbl, x); }
      m.set(eid, mm);
    }
    return new Map([...m].map(([eid, mm]) => [eid, [...mm.values()].sort((a, b) => (a.ot - b.ot) || b.h - a.h)]));
  }, [byEP]);
  /* v10.1 — giờ trống việc của từng ô ma trận (người × dự án); tác vụ Trống việc chấm dưới "Khác" nên hiện ra ở cột đó */
  const idleCell = useMemo(() => {
    const m = new Map();
    for (const d of detail) if (isIdleTask(d.taskId)) { const k = `${d.empId}|${d.projectId}`; m.set(k, (m.get(k) || 0) + d.hours); }
    return m;
  }, [detail]);
  const projTot = useMemo(() => {
    const m = new Map();
    for (const d of projDetail) { const k = isLeaveTask(d.taskId) ? NO_PROJECT : d.projectId; m.set(k, (m.get(k) || 0) + d.hours); }
    return m;
  }, [projDetail]);
  const [fSt, setFSt] = useState("all");        // all | hi | lo | ok
  const [sort, setSort] = useState("load");     // load | extra | name
  const [open, setOpen] = useState(() => new Set());
  const lim = allocLimits(cfg);
  const empById = new Map((cfg.employees || []).map((e) => [e.id, e]));
  // mọi người cần hiện: có giờ trong kỳ + (nếu không lọc dự án / giai đoạn) người chưa chấm giờ nào
  const ids = new Set([...matrix.keys(), ...staff.map((e) => e.id)]);
  const everyone = [...ids].map((eid) => {
    const mm = matrix.get(eid) || new Map();
    const t = [...mm.values()].reduce((a, v) => a + v, 0);
    const o = otByEmp.get(eid) || 0, c = effortByEmp.get(eid) || 0, i = idleByEmp.get(eid) || 0;
    const s = Math.max(0, t - o - c - i);   // v7.2: giờ chuẩn không gồm trống việc
    const sd = stdOf ? stdOf(eid) : std;   // v6.5: giờ chuẩn riêng từng người (hôm nay chỉ tính khi đã gửi)
    const st = allocState(t, o, c, i, sd, lim);
    const e = empById.get(eid);
    return { eid, mm, t, s, o, c, idle: i, load: t - i, st, sd, dept: e?.dept || "Khác", role: e ? roleTitle(e.role) : "" };
  });
  // v5.6: người chưa chấm giờ nào trong kỳ tách riêng (gom một dòng cuối), không tính vào Quá tải / Thiếu giờ / Bình thường
  const people = everyone.filter((x) => x.t > 0);
  const zero = everyone.filter((x) => x.t === 0).sort((a, b) => empName(a.eid).localeCompare(empName(b.eid), "vi"));
  if (everyone.length === 0) return <p className="px-4 py-6 text-sm text-slate-500">Không có nhân sự nào khớp bộ lọc.</p>;
  const colT = new Map();
  for (const x of people) for (const [k, v] of x.mm) colT.set(k, (colT.get(k) || 0) + v);
  const cols = [...colT.keys()].filter((k) => k !== NO_PROJECT).sort((a, b) => colT.get(b) - colT.get(a));
  if (colT.has(NO_PROJECT)) cols.push(NO_PROJECT);
  const color = new Map(cols.map((k, i) => [k, k === NO_PROJECT ? "#64748b" : ALLOC_PAL[i % ALLOC_PAL.length]]));
  const code = (k) => { if (k === NO_PROJECT) return "Khác"; const p = projMapById.get(k); return p ? (p.code || p.name) : "(đã xoá)"; };
  const name = (k) => { if (k === NO_PROJECT) return "Việc chung, vắng mặt"; return projMapById.get(k)?.name || "(dự án đã xoá)"; };
  const nProj = (x) => cols.filter((k) => k !== NO_PROJECT && x.mm.get(k)).length;
  const pct = (x) => (x.sd ? Math.round((x.load / x.sd) * 100) : null);   // v7.2: % tải không gồm trống việc

  const cnt = (k) => people.filter((x) => k === "all" || x.st === k).length;
  const list = people.filter((x) => fSt === "all" || x.st === fSt)
    .sort(sort === "load" ? (a, b) => b.load - a.load : sort === "extra" ? (a, b) => (b.o + b.c) - (a.o + a.c) || b.load - a.load : (a, b) => empName(a.eid).localeCompare(empName(b.eid), "vi"));
  const used = people.reduce((a, x) => a + x.t, 0), cap = everyone.reduce((a, x) => a + x.sd, 0);
  const otSum = people.reduce((a, x) => a + x.o, 0), cgSum = people.reduce((a, x) => a + x.c, 0), idleSum = people.reduce((a, x) => a + x.idle, 0);
  const toggle = (eid) => setOpen((s) => { const n = new Set(s); n.has(eid) ? n.delete(eid) : n.add(eid); return n; });

  const Kpi = ({ l, v, cls = "text-slate-50", sub }) => (
    <div className="bg-slate-900 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-slate-500">{l}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${cls}`}>{v}{sub && <span className="ml-1.5 text-xs font-normal text-slate-500">{sub}</span>}</div>
    </div>
  );
  const maxT = Math.max(...people.map((x) => x.t), ...people.map((x) => x.sd * 1.25), std * 1.25, 1);

  // nhóm theo bộ phận, giữ thứ tự sắp xếp trong từng nhóm; nhóm xếp theo thứ tự xuất hiện của người đầu tiên
  const groups = [];
  for (const x of list) { let g = groups.find((y) => y.dept === x.dept); if (!g) { g = { dept: x.dept, items: [] }; groups.push(g); } g.items.push(x); }

  return (
    <div>
      {/* v5.6 — 6 KPI của tab Nhân sự */}
      <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 md:grid-cols-4 xl:grid-cols-7">
        <Kpi l="Tổng giờ công" v={fmtH(used)} sub={`/ ${fmtH(cap)} h`} />
        <Kpi l="Trong đó OT" v={`${fmtH(otSum)} h`} cls="text-teal-400" />
        <Kpi l="Giờ cố gắng" v={`${fmtH(cgSum)} h`} cls="text-violet-400" />
        <Kpi l="Trống việc" v={`${fmtH(idleSum)} h`} cls="text-slate-300" sub={cnt("idle") ? `${cnt("idle")} người` : undefined} />
        <Kpi l={`Quá tải (>${lim.over}%)`} v={`${cnt("hi")} người`} cls={cnt("hi") ? "text-rose-400" : "text-slate-50"} />
        <Kpi l={`Thiếu giờ (<${lim.under}%)`} v={`${cnt("lo")} người`} cls={cnt("lo") ? "text-amber-400" : "text-slate-50"} />
        <Kpi l="Chưa chấm" v={`${zero.length} người`} cls={zero.length ? "text-amber-400" : "text-slate-50"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <div className="flex max-w-full overflow-x-auto rounded-md border border-slate-700">
          {[["all", "Đã chấm"], ["hi", "Quá tải"], ["lo", "Thiếu giờ"], ["idle", "Trống việc"], ["ok", "Bình thường"]].map(([k, l]) => (
            <button key={k} onClick={() => setFSt(k)}
              className={`${CTRL} whitespace-nowrap px-3 text-[13px] ${fSt === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>
              {l}<span className="ml-1.5 font-mono text-slate-500">{cnt(k)}</span>
            </button>
          ))}
        </div>
        <div className="w-60 max-w-full">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls} aria-label="Sắp xếp">
            <option value="load">Sắp xếp: tải cao → thấp</option>
            <option value="extra">Sắp xếp: phát sinh nhiều nhất</option>
            <option value="name">Sắp xếp: tên A → Z</option>
          </select>
        </div>
      </div>

      {list.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">{people.length ? "Không có nhân sự nào ở nhóm này." : "Chưa ai có giờ công đã gửi trong kỳ này."}</p>}

      {view === "people" && list.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-800 px-3 py-2 text-xs text-slate-400 md:px-4">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />Giờ chuẩn</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Trống việc (không tính tải)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-400" />OT</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400" />Giờ cố gắng</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-slate-100/55" />{fmtH(std)} h giờ chuẩn của kỳ</span>
            <span className="text-amber-400">⌃ thiếu giờ chuẩn</span>
            <span className="text-slate-600">Bấm một người để xem theo dự án</span>
          </div>
          {groups.map((g) => (
            <div key={g.dept}>
              <div className="flex justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 md:px-4">
                <span>{g.dept} · {g.items.length} người</span><span className="font-mono">{fmtH(g.items.reduce((a, x) => a + x.t, 0))} h</span>
              </div>
              {g.items.map((x) => {
                const op = open.has(x.eid), p = pct(x);
                return (
                  <div key={x.eid} className="border-b border-slate-800/70">
                    <button type="button" onClick={() => toggle(x.eid)} aria-expanded={op}
                      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 text-left md:grid-cols-[200px_minmax(0,1fr)_90px_150px] md:gap-4 md:px-4 ${op ? "bg-slate-800/50" : "hover:bg-slate-800/30"}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-sm text-slate-100">{op ? <ChevronDown size={14} className="shrink-0 text-slate-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-500" />}{empName(x.eid)}</div>
                        <div className="pl-5 text-[11px] text-slate-500">{x.role ? `${x.role} · ` : ""}{nProj(x)} dự án
                          {x.st !== "ok" && <span className={`ml-1.5 rounded-full border px-1.5 md:hidden ${ALLOC_ST[x.st][1]}`}>{ALLOC_ST[x.st][0]}</span>}</div>
                      </div>
                      <div className="relative col-span-2 row-start-2 pt-[18px] md:col-span-1 md:row-start-auto">
                        {/* v5.7: số giờ nằm trong từng khúc (khúc hẹp thì ẩn số, rê chuột xem); khe tối 2px giữa các khúc */}
                        <div className="flex h-[18px] overflow-hidden rounded-full bg-slate-800 font-mono text-[11px] font-semibold text-slate-950">
                          {[[x.s, "bg-blue-400", "Giờ chuẩn"], [x.idle, "bg-slate-400", "Trống việc"], [x.o, "bg-teal-400", "OT"], [x.c, "bg-violet-400", "Giờ cố gắng"]].filter(([v]) => v > 0).map(([v, cls, l], i) => (
                            <i key={l} title={`${l}: ${fmtH(v)} h`} className={`flex h-full items-center justify-center overflow-hidden whitespace-nowrap not-italic ${cls} ${i ? "border-l-2 border-slate-900" : ""}`}
                              style={{ width: `${(v / maxT) * 100}%` }}>{(v / maxT) * 100 >= 3.2 ? fmtH(v) : ""}</i>
                          ))}
                        </div>
                        {/* v5.7: ngoặc vàng chỉ khoảng thiếu giờ chuẩn (từ cuối phần Giờ chuẩn tới vạch giờ chuẩn của kỳ) — OT / cố gắng không bù vào */}
                        {/* v7.2: tính từ cuối khúc xám — trống việc không bị coi là thiếu */}
                        {x.sd > 0 && x.sd - x.s - x.idle > 0.05 && (
                          <span className="pointer-events-none absolute top-3 h-[5px] rounded-t-[3px] border-[1.5px] border-b-0 border-amber-400" style={{ left: `${((x.s + x.idle) / maxT) * 100}%`, width: `${((x.sd - x.s - x.idle) / maxT) * 100}%` }}>
                            <span className="absolute -top-[5px] left-1/2 h-1 w-[1.5px] -translate-x-1/2 bg-amber-400" />
                            <span className="absolute bottom-[9px] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[11px] font-medium leading-none text-amber-400">thiếu {fmtH(x.sd - x.s - x.idle)} h</span>
                          </span>
                        )}
                        {/* v5.7: vạch giờ chuẩn của kỳ — trắng mờ, mảnh 1px */}
                        {x.sd > 0 && <span className="pointer-events-none absolute -bottom-1.5 top-3 w-px -translate-x-1/2 bg-slate-100/55 shadow-[0_0_0_1.5px_#0f172a]" style={{ left: `${(x.sd / maxT) * 100}%` }} />}
                      </div>
                      <div className="text-right font-mono md:order-none">
                        <div className={`text-sm font-semibold ${x.st === "hi" ? "text-rose-400" : "text-slate-100"}`}>{fmtH(x.t)} h</div>
                        {x.idle > 0 && <div className="text-[11px] text-slate-400">tải {fmtH(x.load)} h</div>}
                      </div>
                      <span className={`hidden justify-self-end whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] md:inline-block ${ALLOC_ST[x.st][1]}`}>{ALLOC_ST[x.st][0]}{p != null ? ` · ${p}%` : ""}</span>
                    </button>
                    {op && (
                      <div className="bg-slate-950/40 px-3 pb-3 pt-1.5 md:pl-[232px] md:pr-4">
                        {/* v5.4: chi tiết chỉ bằng chữ + số, không vẽ thanh — đỡ rối mắt */}
                        <div className="grid max-w-5xl grid-cols-1 gap-x-10 gap-y-3 text-[13px] lg:grid-cols-2">
                          {x.mm.size === 0 ? <div className="py-1 text-slate-500">Chưa chấm giờ nào trong kỳ.</div> : (<>
                            <div>
                            <div className="grid grid-cols-[minmax(0,1fr)_72px_52px] gap-3 py-0.5 text-[10.5px] uppercase tracking-wider text-slate-600">
                              <span>Dự án</span><span className="text-right">Giờ</span><span className="text-right">%</span>
                            </div>
                            {(() => { const ks = cols.filter((k) => x.mm.get(k)).sort((a, b) => x.mm.get(b) - x.mm.get(a)), pc = pct100(ks.map((k) => x.mm.get(k))); return ks.map((k, i) => (
                              /* v5.5: rê chuột vào dự án → thẻ tác vụ của người này trong dự án */
                              <div key={k} className="-mx-1.5 grid cursor-default grid-cols-[minmax(0,1fr)_72px_52px] items-baseline gap-3 rounded-md px-1.5 py-0.5 hover:bg-slate-800/70"
                                onMouseMove={(e) => setTip({ eid: x.eid, k, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
                                <span className="truncate text-slate-200">{k === NO_PROJECT ? "" : `${code(k)} · `}{name(k)}</span>
                                <span className="text-right font-mono text-slate-100">{fmtH(x.mm.get(k))} h</span>
                                <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
                              </div>
                            )); })()}
                            </div>
                            {/* v5.8 — tác vụ của người này trong kỳ (mọi dự án); tăng ca ghi "Tăng ca · tác vụ", màu xanh ngọc, xếp cuối */}
                            <div>
                              <div className="grid grid-cols-[minmax(0,1fr)_72px_52px] gap-3 py-0.5 text-[10.5px] uppercase tracking-wider text-slate-600">
                                <span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span>
                              </div>
                              {(() => { const ts = byE.get(x.eid) || [], pc = pct100(ts.map((t) => t.h)); return ts.map((t, i) => (
                                <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_72px_52px] items-baseline gap-3 py-0.5">
                                  <span className={`truncate ${t.ot ? "text-teal-400" : t.idle ? "text-slate-400" : "text-slate-200"}`}>{t.name}</span>
                                  <span className="text-right font-mono text-slate-100">{fmtH(t.h)} h</span>
                                  <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
                                </div>
                              )); })()}
                            </div>
                          </>)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {tip && (() => {
        const o = byEP.get(`${tip.eid}|${tip.k}`), ph = matrix.get(tip.eid)?.get(tip.k) || 0;
        if (!o || !ph) return null;
        const tasks = [...o.tasks.entries()].sort((a, b) => (a[1].ot - b[1].ot) || b[1].h - a[1].h);
        const pt = projTot.get(tip.k) || 0;
        const W = 360, left = Math.min(window.innerWidth - W - 12, tip.x + 14), top = Math.min(window.innerHeight - 40 - (tasks.length + 3) * 24, tip.y + 14);
        return (
          <div className="pointer-events-none fixed z-50 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[12.5px] shadow-2xl" style={{ left, top, width: W }}>
            <div className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 pb-1 text-[10.5px] uppercase tracking-wider text-slate-600"><span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span></div>
            {(() => { const pc = pct100(tasks.map(([, t]) => t.h)); return tasks.map(([lbl, t], i) => (
              <div key={lbl} className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 py-0.5">
                <span className={`truncate ${t.ot ? "text-teal-400" : "text-slate-100"}`}>{lbl}</span>
                <span className="text-right font-mono text-slate-200">{fmtH(t.h)}</span>
                <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
              </div>
            )); })()}
            <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-slate-800 pt-1.5">
              {pt > 0 && <><span className="text-slate-500">Chiếm trong tổng giờ dự án</span><span className="text-right font-mono text-slate-100">{Math.round((ph / pt) * 100)}% <span className="text-slate-600">/ {fmtH(pt)} h</span></span></>}
              {o.phases.size > 0 && <><span className="text-slate-500">Giai đoạn</span><span className="text-right text-slate-100">{[...o.phases].sort().map((p) => phaseLabel(p)).join(", ")}</span></>}
            </div>
          </div>
        );
      })()}

      {view === "matrix" && list.length > 0 && (() => {
        const maxV = Math.max(1, ...list.flatMap((x) => [...x.mm.values()]));
        const hex = (a) => Math.round(a * 255).toString(16).padStart(2, "0");
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="text-[11px] text-slate-500">
                  <th className="sticky left-0 z-10 min-w-[170px] bg-slate-900 px-3 py-2 text-left font-medium md:px-4">Nhân sự</th>
                  {cols.map((k) => (
                    <th key={k} className="min-w-[76px] px-1.5 py-2 text-center font-medium" title={name(k)}>
                      <span style={{ color: tone(color.get(k)) }}>■</span> {code(k)}
                      <div className="mx-auto max-w-[110px] truncate font-normal text-slate-600">{k === NO_PROJECT ? "chung, vắng" : name(k)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Tổng</th><th className="px-3 py-2 text-right font-medium">% tải</th><th className="px-3 py-2 text-right font-medium">Số DA</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => {
                  const p = pct(x), n = nProj(x);
                  return (
                    <tr key={x.eid} className="border-t border-slate-800/70">
                      <td className="sticky left-0 z-10 bg-slate-900 px-3 py-1.5 md:px-4">
                        <div className="truncate text-slate-100">{empName(x.eid)}</div>
                        <div className="text-[11px] text-slate-500">{x.dept}{x.role ? ` · ${x.role}` : ""}</div>
                      </td>
                      {cols.map((k) => {
                        const v = x.mm.get(k);
                        const idl = idleCell.get(`${x.eid}|${k}`) || 0;   // v10.1
                        return v ? (
                          <td key={k} className="h-10 px-1 text-center font-mono text-slate-50" style={{ background: `${color.get(k)}${hex(0.14 + 0.6 * (v / maxV))}` }}
                            title={`${empName(x.eid)}\n${code(k)} · ${name(k)}\n${fmtH(v)} giờ · ${Math.round((v / x.t) * 100)}% thời gian của người này${idl > 0 ? `\nTrong đó trống việc: ${fmtH(idl)} giờ` : ""}`}>
                            <div className="leading-tight">{fmtH(v)}</div>
                            {idl > 0 && <div className="text-[10px] font-normal leading-tight text-slate-200/75">trống {fmtH(idl)}</div>}
                          </td>
                        ) : <td key={k} className="h-10 text-center text-slate-700">·</td>;
                      })}
                      <td className="px-3 text-right font-mono text-slate-100">{fmtH(x.t)}</td>
                      <td className={`px-3 text-right font-mono ${x.st === "hi" ? "text-rose-400" : x.st === "lo" ? "text-amber-400" : x.st === "idle" ? "text-slate-300" : "text-teal-400"}`}>{p != null ? `${p}%` : "—"}</td>
                      <td className={`px-3 text-right font-mono ${n >= 3 ? "text-amber-400" : "text-slate-400"}`} title={n >= 3 ? "Ôm từ 3 dự án trở lên" : undefined}>{n}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 font-mono text-slate-300">
                  <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 font-sans text-xs text-slate-400 md:px-4">Tổng dự án</td>
                  {cols.map((k) => {
                    const idl = list.reduce((a, x) => a + (idleCell.get(`${x.eid}|${k}`) || 0), 0);   // v10.1
                    return (
                      <td key={k} className="py-2 text-center">
                        <div className="leading-tight">{fmtH(list.reduce((a, x) => a + (x.mm.get(k) || 0), 0))}</div>
                        {idl > 0 && <div className="text-[10px] font-normal leading-tight text-slate-500">trống {fmtH(idl)}</div>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-slate-100">{fmtH(list.reduce((a, x) => a + x.t, 0))}</td><td /><td />
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {fSt === "all" && zero.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-slate-800 px-3 py-2.5 text-[13px] md:px-4">
          <span className="whitespace-nowrap text-amber-400">Chưa chấm giờ nào · {zero.length} người:</span>
          <span className="text-slate-400">{zero.map((x) => empName(x.eid)).join(", ")}</span>
        </div>
      )}
    </div>
  );
}

