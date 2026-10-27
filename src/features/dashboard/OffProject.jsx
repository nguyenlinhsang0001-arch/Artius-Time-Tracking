/* ARTIUS TIME v11.1 — Dashboard → tab "Giờ ngoài dự án".
   Giờ không thuộc dự án nào: việc chung của công ty, trống việc, vắng mặt.
   Dùng để truy xem năng lực của kỳ bị hao đi đâu — mẫu số của mọi phép so kế hoạch với thực tế. */
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CTRL } from "../../core/ui.jsx";
import { fmtH, isIdleTask, isLeaveTask, taskRoles } from "../../core/domain.jsx";

/* ba nhóm giờ ngoài dự án; màu không trùng với bảng màu tải (xanh dương chuẩn / xanh ngọc OT / tím cố gắng) */
const KIND = {
  common: ["Việc chung", "#34d399", "text-emerald-300"],
  idle: ["Trống việc", "#94a3b8", "text-slate-400"],
  leave: ["Vắng mặt", "#38bdf8", "text-sky-300"],
};
const ORDER = ["common", "idle", "leave"];
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function OffProject({ cfg, detail, staff, stdOf, empName, taskLabel }) {
  const [view, setView] = useState("task");          // "task" | "people"
  const [open, setOpen] = useState(() => new Set());
  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  /* tác vụ không gắn vai trò nào = việc chung của công ty (cùng luật với màn Chấm công) */
  const commonIds = useMemo(
    () => new Set((cfg.tasks || []).filter((t) => taskRoles(t).length === 0).map((t) => t.id)),
    [cfg.tasks]);
  const kindOf = (taskId) => {
    if (isLeaveTask(taskId)) return "leave";
    if (isIdleTask(taskId)) return "idle";
    if (commonIds.has(taskId)) return "common";
    return null;                                      // giờ của dự án
  };

  const agg = useMemo(() => {
    const byTask = new Map();                         // taskId -> { h, kind, emps: Map }
    const byEmp = new Map();                          // empId  -> { common, idle, leave, tasks: Map }
    let off = 0, proj = 0;
    for (const d of detail) {
      const k = kindOf(d.taskId);
      if (!k) { proj += d.hours; continue; }   // giờ của dự án, kể cả tăng ca (tăng ca luôn gắn một tác vụ dự án)
      off += d.hours;
      const t = byTask.get(d.taskId) || { h: 0, kind: k, emps: new Map() };
      t.h += d.hours; t.emps.set(d.empId, (t.emps.get(d.empId) || 0) + d.hours);
      byTask.set(d.taskId, t);
      const e = byEmp.get(d.empId) || { common: 0, idle: 0, leave: 0, tasks: new Map() };
      e[k] += d.hours; e.tasks.set(d.taskId, (e.tasks.get(d.taskId) || 0) + d.hours);
      byEmp.set(d.empId, e);
    }
    const sum = { common: 0, idle: 0, leave: 0 };
    for (const [, t] of byTask) sum[t.kind] += t.h;
    return { byTask, byEmp, off, proj, sum };
  }, [detail, commonIds]);                            // eslint-disable-line react-hooks/exhaustive-deps

  /* năng lực của kỳ: giờ chuẩn của từng người đang lọt bộ lọc */
  const capStd = useMemo(() => staff.reduce((a, e) => a + (stdOf ? stdOf(e.id) : 0), 0), [staff, stdOf]);
  const logged = agg.proj + agg.off;
  const overStd = Math.max(0, logged - capStd);
  const base = logged || 1;

  if (!detail.length) return <p className="px-4 py-6 text-sm text-slate-500">Chưa có giờ công nào đã gửi trong kỳ này.</p>;

  /* v11.2 — hai thanh thay vì một. Thanh trên chia GIỜ ĐÃ CHẤM nên luôn đọc được dù ít người chấm;
     thanh dưới cho biết đã chấm được bao nhiêu phần giờ chuẩn của kỳ, tức tỉ lệ ở trên đáng tin tới đâu.
     Bản v11.1 lấy giờ chuẩn làm mẫu số nên khi bảng công còn thưa, khúc "Chưa chấm" chiếm gần hết thanh. */
  const segs = [
    [agg.proj, "#60a5fa", "Vào dự án"],
    [agg.sum.common, KIND.common[1], KIND.common[0]],
    [agg.sum.idle, KIND.idle[1], KIND.idle[0]],
    [agg.sum.leave, KIND.leave[1], KIND.leave[0]],
  ].filter(([v]) => v > 0.05);
  const fill = pct(logged, capStd);   // đã chấm bao nhiêu % giờ chuẩn của kỳ

  const Kpi = ({ l, v, sub, cls = "text-slate-50" }) => (
    <div className="bg-slate-900 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-slate-500">{l}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${cls}`}>{v}{sub && <span className="ml-1.5 text-xs font-normal text-slate-500">{sub}</span>}</div>
    </div>
  );

  /* ---------- xem theo tác vụ ---------- */
  const groups = ORDER.map((k) => ({
    k, label: KIND[k][0], total: agg.sum[k],
    rows: [...agg.byTask.entries()].filter(([, t]) => t.kind === k).sort((a, b) => b[1].h - a[1].h),
  })).filter((g) => g.rows.length);
  const maxTask = Math.max(1, ...[...agg.byTask.values()].map((t) => t.h));

  /* ---------- xem theo người ---------- */
  const people = [...agg.byEmp.entries()]
    .map(([eid, e]) => ({ eid, ...e, t: e.common + e.idle + e.leave, sd: stdOf ? stdOf(eid) : 0 }))
    .sort((a, b) => b.t - a.t);
  const maxP = Math.max(1, ...people.map((p) => p.t));

  return (
    <div>
      {/* KPI */}
      <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 md:grid-cols-5">
        <Kpi l="Giờ ngoài dự án" v={fmtH(agg.off)} sub="h" />
        <Kpi l="Trên tổng giờ đã chấm" v={pct(agg.off, logged)} sub={`% / ${fmtH(logged)} h`} cls={pct(agg.off, logged) >= 25 ? "text-amber-400" : "text-slate-50"} />
        <Kpi l={KIND.common[0]} v={fmtH(agg.sum.common)} sub="h" cls="text-emerald-300" />
        <Kpi l={KIND.idle[0]} v={fmtH(agg.sum.idle)} sub="h" cls="text-slate-300" />
        <Kpi l={KIND.leave[0]} v={fmtH(agg.sum.leave)} sub="h" cls="text-sky-300" />
      </div>

      {/* Năng lực kỳ này — mẫu số của phép so kế hoạch với thực tế */}
      <div className="border-b border-slate-800 px-3 py-3 md:px-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm text-slate-100">Năng lực kỳ này</span>
          <span className="text-xs text-slate-500">
            <span className="font-mono text-slate-300">{fmtH(logged)} h</span> đã chấm — đi về đâu
          </span>
          {overStd > 0.05 && <span className="text-xs text-teal-400">vượt giờ chuẩn {fmtH(overStd)} h (OT / cố gắng)</span>}
        </div>
        <div className="flex h-[22px] overflow-hidden rounded-full bg-slate-800 font-mono text-[11px] font-semibold text-slate-950">
          {segs.map(([v, color, label], i) => (
            <i key={label} title={`${label}: ${fmtH(v)} h · ${pct(v, base)}%`}
              className={`flex h-full items-center justify-center overflow-hidden whitespace-nowrap not-italic ${i ? "border-l-2 border-slate-900" : ""} ${label === "Chưa chấm" ? "text-slate-400" : ""}`}
              style={{ width: `${(v / base) * 100}%`, background: color }}>
              {(v / base) * 100 >= 6 ? `${pct(v, base)}%` : ""}
            </i>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          {segs.map(([v, color, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{label} <span className="font-mono text-slate-500">{fmtH(v)} h</span>
            </span>
          ))}
        </div>
        {/* v11.2 — thanh thứ hai: đã chấm được bao nhiêu phần giờ chuẩn của kỳ */}
        <div className="mt-3">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-[11px] text-slate-500">
            <span>So với giờ chuẩn của kỳ</span>
            <span className="font-mono text-amber-400">{fmtH(capStd)} h</span>
            <span>của {staff.length} người</span>
            <span className={`ml-auto font-mono ${fill < 60 ? "text-amber-400" : "text-slate-400"}`}>đã chấm {fill}%</span>
          </div>
          <div className="flex h-[8px] overflow-hidden rounded-full bg-slate-800">
            <i className="h-full bg-slate-500" style={{ width: `${Math.min(100, fill)}%` }} />
          </div>
          {fill < 60 && (
            <p className="mt-1 text-[11px] text-amber-500/80">
              Mới chấm {fill}% giờ chuẩn của kỳ — các tỉ lệ ở trên tính trên phần đã chấm, chưa phản ánh cả kỳ.
            </p>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          Phần không phải “Vào dự án” là năng lực không đổ được vào dự án nào. Khi so kế hoạch với giờ thực tế, phải trừ phần này ra trước, nếu không mọi dự án đều trông như dùng ít người hơn dự trù.
        </p>
      </div>

      {/* chuyển cách xem */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 md:px-4">
        <span className="text-xs text-slate-500">Xem theo</span>
        <div className="flex rounded-md border border-slate-700">
          {[["task", "Tác vụ"], ["people", "Người"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} aria-pressed={view === k}
              className={`${CTRL} whitespace-nowrap px-3.5 text-[13px] ${view === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-600">Bấm một dòng để xem chi tiết</span>
      </div>

      {view === "task" && (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_90px_60px_70px] gap-3 border-b border-slate-800 px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-slate-600 md:px-4">
            <span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span><span className="text-right">Người</span>
          </div>
          {groups.map((g) => (
            <div key={g.k}>
              <div className="flex justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 md:px-4">
                <span>{g.label} · {g.rows.length} tác vụ</span><span className="font-mono">{fmtH(g.total)} h</span>
              </div>
              {g.rows.map(([tid, t]) => {
                const key = `t${tid}`, op = open.has(key);
                const who = [...t.emps.entries()].sort((a, b) => b[1] - a[1]);
                return (
                  <div key={tid} className="border-b border-slate-800/70">
                    <button type="button" onClick={() => toggle(key)} aria-expanded={op}
                      className={`grid w-full grid-cols-[minmax(0,1fr)_90px_60px_70px] items-center gap-3 px-3 py-2.5 text-left md:px-4 ${op ? "bg-slate-800/50" : "hover:bg-slate-800/30"}`}>
                      <div className="min-w-0">
                        <div className={`flex items-center gap-1.5 truncate text-sm ${KIND[g.k][2]}`}>
                          {op ? <ChevronDown size={14} className="shrink-0 text-slate-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-500" />}
                          {taskLabel(tid)}
                        </div>
                        <div className="ml-5 mt-1.5 h-[10px] overflow-hidden rounded-full bg-slate-800">
                          <i className="block h-full" style={{ width: `${(t.h / maxTask) * 100}%`, background: KIND[g.k][1] }} />
                        </div>
                      </div>
                      <span className="text-right font-mono text-sm text-slate-100">{fmtH(t.h)} h</span>
                      <span className="text-right font-mono text-sm text-slate-400">{pct(t.h, agg.off)}%</span>
                      <span className="text-right font-mono text-sm text-slate-400">{t.emps.size}</span>
                    </button>
                    {op && (
                      <div className="bg-slate-950/40 px-3 pb-3 pt-1.5 md:pl-9 md:pr-4">
                        <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)_72px_52px] gap-3 py-0.5 text-[10.5px] uppercase tracking-wider text-slate-600">
                          <span>Nhân sự</span><span className="text-right">Giờ</span><span className="text-right">%</span>
                        </div>
                        <div className="max-w-3xl text-[13px]">
                          {who.map(([eid, h]) => (
                            <div key={eid} className="grid grid-cols-[minmax(0,1fr)_72px_52px] items-baseline gap-3 py-0.5">
                              <span className="truncate text-slate-300">{empName(eid)}</span>
                              <span className="text-right font-mono text-slate-100">{fmtH(h)} h</span>
                              <span className="text-right font-mono text-slate-500">{pct(h, t.h)}%</span>
                            </div>
                          ))}
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

      {view === "people" && (
        <div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-800 px-3 py-2 text-xs text-slate-400 md:px-4">
            {ORDER.map((k) => (
              <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND[k][1] }} />{KIND[k][0]}</span>
            ))}
            <span className="text-slate-600">Bấm một người để xem từng tác vụ</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_90px_70px] gap-3 border-b border-slate-800 px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-slate-600 md:px-4">
            <span>Nhân sự</span><span className="text-right">Giờ ngoài dự án</span><span className="text-right">% giờ chuẩn</span>
          </div>
          {people.map((p) => {
            const key = `p${p.eid}`, op = open.has(key);
            const rows = [...p.tasks.entries()].sort((a, b) => b[1] - a[1]);
            const ps = [[p.common, "common"], [p.idle, "idle"], [p.leave, "leave"]].filter(([v]) => v > 0);
            const share = p.sd ? Math.round((p.t / p.sd) * 100) : null;
            return (
              <div key={p.eid} className="border-b border-slate-800/70">
                <button type="button" onClick={() => toggle(key)} aria-expanded={op}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_90px_70px] items-center gap-x-3 gap-y-2 px-3 py-2.5 text-left md:grid-cols-[200px_minmax(0,1fr)_90px_70px] md:gap-4 md:px-4 ${op ? "bg-slate-800/50" : "hover:bg-slate-800/30"}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate text-sm text-slate-100">
                      {op ? <ChevronDown size={14} className="shrink-0 text-slate-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-500" />}
                      {empName(p.eid)}
                    </div>
                  </div>
                  <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
                    <div className="flex h-[18px] overflow-hidden rounded-full bg-slate-800 font-mono text-[11px] font-semibold text-slate-950">
                      {ps.map(([v, k], i) => (
                        <i key={k} title={`${KIND[k][0]}: ${fmtH(v)} h`}
                          className={`flex h-full items-center justify-center overflow-hidden whitespace-nowrap not-italic ${i ? "border-l-2 border-slate-900" : ""}`}
                          style={{ width: `${(v / maxP) * 100}%`, background: KIND[k][1] }}>
                          {(v / maxP) * 100 >= 10 ? fmtH(v) : ""}
                        </i>
                      ))}
                    </div>
                  </div>
                  <span className="text-right font-mono text-sm text-slate-100">{fmtH(p.t)} h</span>
                  <span className={`text-right font-mono text-sm ${share != null && share >= 25 ? "text-amber-400" : "text-slate-400"}`}>{share != null ? `${share}%` : "—"}</span>
                </button>
                {op && (
                  <div className="bg-slate-950/40 px-3 pb-3 pt-1.5 md:pl-[232px] md:pr-4">
                    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)_72px_52px] gap-3 py-0.5 text-[10.5px] uppercase tracking-wider text-slate-600">
                      <span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span>
                    </div>
                    <div className="max-w-3xl text-[13px]">
                      {rows.map(([tid, h]) => (
                        <div key={tid} className="grid grid-cols-[minmax(0,1fr)_72px_52px] items-baseline gap-3 py-0.5">
                          <span className={`truncate ${KIND[kindOf(tid) || "common"][2]}`}>{taskLabel(tid)}</span>
                          <span className="text-right font-mono text-slate-100">{fmtH(h)} h</span>
                          <span className="text-right font-mono text-slate-500">{pct(h, p.t)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
