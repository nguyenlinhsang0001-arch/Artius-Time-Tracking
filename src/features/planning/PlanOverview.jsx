/* ARTIUS TIME v12 — Kế hoạch nguồn lực, chế độ Tổng quan.
   Bốn khối: việc cần xử lý · bản đồ tải vai trò × tuần · quân số cần so với đang có · kế hoạch so với giờ đã chấm. */
import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cellOf, leftOf, loadOf, needOf, planVsActual, shortages, verdictOf } from "./planCalc.js";

const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");
const bg = (p) => (p > 100 ? `rgba(153,27,27,${Math.min(1, 0.55 + (p - 100) / 120)})` : p >= 85 ? "#854d0e" : p >= 60 ? "#115e59" : p > 0 ? "#1e293b" : "#0b1220");

export function PlanOverview({ plan, projects, roles, weeks, cap, actual, okWeeks, nowIndex, availability }) {
  const [drill, setDrill] = useState(null);
  const pids = useMemo(() => projects.map((p) => p.id), [projects]);
  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const shown = useMemo(
    () => roles.filter((r) => (cap.get(r.id) || 0) > 0 || weeks.some((w) => needOf(plan, pids, r.id, w.i) > 0)),
    [roles, cap, weeks, plan, pids]);
  const alerts = useMemo(
    () => shortages({ plan, projectIds: pids, roles: shown, weeks, cap, from: Math.max(0, nowIndex), count: 12 }),
    [plan, pids, shown, weeks, cap, nowIndex]);
  const pva = useMemo(
    () => planVsActual({ plan, projects, weeks, okWeeks, actual }),
    [plan, projects, weeks, okWeeks, actual]);

  /* quân số cần so với đang có — 12 tuần tới */
  const horizon = weeks.slice(Math.max(0, nowIndex), Math.max(0, nowIndex) + 12);
  const totCap = shown.reduce((a, r) => a + (cap.get(r.id) || 0), 0);
  const demand = horizon.map((w) => shown.reduce((a, r) => a + needOf(plan, pids, r.id, w.i), 0));

  const drillRows = drill
    ? projects.map((p) => ({ p, v: cellOf(plan, p.id, drill.rid, drill.wi) })).filter((o) => o.v > 0).sort((a, b) => b.v - a.v)
    : [];

  return (
    <div className="space-y-3 p-3 md:p-4">
      {/* 1 — cần xử lý */}
      <section className="rounded-xl border border-amber-900/60 bg-amber-950/10">
        <div className="border-b border-amber-900/40 px-4 py-2.5">
          <h3 className="text-sm text-amber-200">Cần xử lý — 12 tuần tới</h3>
        </div>
        {alerts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">12 tuần tới không vai trò nào thiếu người.</p>
        ) : (
          <div className="divide-y divide-amber-900/30">
            {alerts.map((a) => {
              const who = projects.map((p) => ({ p, v: cellOf(plan, p.id, a.role.id, a.w.i) })).filter((o) => o.v > 0).sort((x, y) => y.v - x.v);
              return (
                <div key={`${a.role.id}${a.w.i}`} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-[13px] md:grid-cols-[96px_140px_minmax(0,1fr)_auto]">
                  <span className="font-mono text-amber-300">T{a.w.m} · tuần {a.w.w}</span>
                  <span className="hidden truncate text-slate-100 md:block">{a.role.id} · {a.role.name}</span>
                  <span className="truncate text-slate-400">
                    cần {f0(a.need)} / có {f0(cap.get(a.role.id) || 0)} · {who.slice(0, 3).map((o) => `${o.p.code || o.p.name} (${f0(o.v)})`).join(" · ")}
                  </span>
                  <span className="whitespace-nowrap text-right font-mono font-semibold text-rose-400">thiếu {f0(a.short)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2 — bản đồ tải */}
      <section className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm text-slate-100">Bản đồ tải — vai trò × tuần</h3>
          <p className="mt-0.5 text-xs text-slate-500">Ô là phần trăm tải. Bấm một ô để xem dự án nào đang chiếm vai trò đó</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
          {[["#1e293b", "< 60% rảnh"], ["#115e59", "60–85%"], ["#854d0e", "85–100% căng"], ["#991b1b", "> 100% thiếu"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</span>
          ))}
        </div>
        <div className="overflow-auto" style={{ maxHeight: "46vh" }}>
          <table className="text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-56 bg-slate-900 px-3 py-1 text-left text-[11px] uppercase tracking-wider text-slate-500">Vai trò</th>
                {weeks.map((w, k) => (
                  <th key={w.i} className={`sticky top-0 z-25 border-l border-slate-800 bg-slate-900 px-1 py-1 text-center text-[11px] font-medium ${k === 0 || weeks[k - 1].m !== w.m ? "text-teal-400" : "text-slate-700"}`}>
                    {k === 0 || weeks[k - 1].m !== w.m ? `T${w.m}` : ""}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 top-[26px] z-30 bg-slate-900 px-3 py-1" />
                {weeks.map((w) => <th key={w.i} className="sticky top-[26px] z-25 border-l border-slate-800 bg-slate-900 px-1 py-1 text-center text-[10px] font-normal text-slate-600">{w.w}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, idx) => (
                <React.Fragment key={r.id}>
                  {(idx === 0 || shown[idx - 1].dept !== r.dept) && r.dept && (
                    <tr>
                      <td className="sticky left-0 z-20 border-y border-slate-800 bg-slate-950 px-3 py-1 text-[10.5px] uppercase tracking-wider text-slate-500">{r.dept}</td>
                      <td className="border-y border-slate-800 bg-slate-950" colSpan={weeks.length} />
                    </tr>
                  )}
                  <tr>
                    <td className="sticky left-0 z-20 bg-slate-900 px-3 py-1">
                      <span className="font-mono text-slate-300">{r.id}</span> <span className="text-slate-500">{r.name}</span>{" "}
                      <span className="text-slate-600">· {f0(cap.get(r.id) || 0)}</span>
                    </td>
                    {weeks.map((w) => {
                      const p = Math.round(loadOf(plan, pids, r.id, w.i, cap));
                      return (
                        <td key={w.i} onClick={() => setDrill({ rid: r.id, wi: w.i })}
                          className={`cursor-pointer border-l border-slate-900 px-1 py-1 text-center font-mono text-[11px] ${p > 100 ? "font-semibold text-rose-100" : p >= 60 ? "text-slate-100" : "text-slate-600"}`}
                          style={{ background: bg(p) }}>{p || ""}</td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {drill && (() => {
          const r = roleById.get(drill.rid), w = weeks.find((x) => x.i === drill.wi);
          const lf = leftOf(plan, pids, drill.rid, drill.wi, cap);
          return (
            <div className="border-t border-slate-800 bg-slate-950/50 px-4 py-3">
              <div className="mb-2 flex flex-wrap items-baseline gap-3">
                <span className="text-sm text-slate-100">{r?.id} · {r?.name}</span>
                <span className="text-xs text-slate-500">T{w?.m} tuần {w?.w}</span>
                <span className={`font-mono text-xs ${lf < 0 ? "text-rose-400" : "text-teal-400"}`}>
                  cần {f0(needOf(plan, pids, drill.rid, drill.wi))} · có {f0(cap.get(drill.rid) || 0)} · {lf < 0 ? `thiếu ${f0(-lf)}` : `dư ${f0(lf)}`}
                </span>
                <button type="button" onClick={() => setDrill(null)} className="ml-auto text-xs text-slate-500 hover:text-slate-300"><X size={14} /></button>
              </div>
              <div className="max-w-xl text-[13px]">
                {drillRows.length === 0 ? <span className="text-slate-500">Không dự án nào dùng vai trò này trong tuần.</span>
                  : drillRows.map((o) => (
                    <div key={o.p.id} className="grid grid-cols-[minmax(0,1fr)_64px] gap-3 py-0.5">
                      <span className="truncate text-slate-300">{o.p.code ? `${o.p.code} ` : ""}{o.p.name}</span>
                      <span className="text-right font-mono text-slate-100">{f0(o.v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })()}
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        {/* 3 — quân số cần so với đang có */}
        <section className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3">
            <h3 className="text-sm text-slate-100">Quân số cần so với đang có — 12 tuần tới</h3>
            <p className="mt-0.5 text-xs text-slate-500">Vạch trắng là năng lực dùng được = số người × hệ số sẵn sàng {Math.round(availability * 100)}%</p>
          </div>
          <div className="p-4">
            {horizon.length === 0 ? <p className="text-sm text-slate-500">Không còn tuần nào phía trước trong nửa năm đang xem.</p> : (() => {
              const Wd = 620, H = 250, L = 40, R = 10, T = 14, B = 34, iw = Wd - L - R, ih = H - T - B;
              const max = Math.max(totCap * 1.25, ...demand, 1);
              const y = (v) => T + ih - (v / max) * ih, step = iw / horizon.length, bw = step * 0.6;
              return (
                <svg viewBox={`0 0 ${Wd} ${H}`} className="w-full">
                  {[0, 1, 2, 3, 4].map((i) => {
                    const v = (max * i) / 4;
                    return <g key={i}><line x1={L} x2={Wd - R} y1={y(v)} y2={y(v)} stroke="#1e293b" />
                      <text x={L - 5} y={y(v) + 4} fill="#64748b" fontSize="10" textAnchor="end">{Math.round(v)}</text></g>;
                  })}
                  {horizon.map((w, i) => {
                    const v = demand[i];
                    return <g key={w.i}>
                      <rect x={L + i * step + (step - bw) / 2} y={y(v)} width={bw} height={T + ih - y(v)} fill={v > totCap ? "#f87171" : "#2dd4bf"} opacity="0.85">
                        <title>{`T${w.m} tuần ${w.w}: cần ${f0(v)}`}</title></rect>
                      {i % 2 === 0 && <text x={L + i * step + step / 2} y={H - 12} fill="#64748b" fontSize="10" textAnchor="middle">{`T${w.m}·${w.w}`}</text>}
                    </g>;
                  })}
                  <line x1={L} x2={Wd - R} y1={y(totCap)} y2={y(totCap)} stroke="#f8fafc" strokeWidth="2" strokeDasharray="6 4" />
                  <text x={Wd - R} y={y(totCap) - 6} fill="#f8fafc" fontSize="10" textAnchor="end">{`năng lực ${f0(totCap)}`}</text>
                </svg>
              );
            })()}
          </div>
        </section>

        {/* 4 — kế hoạch so với giờ đã chấm */}
        <section className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3">
            <h3 className="text-sm text-slate-100">Kế hoạch so với giờ đã chấm</h3>
            <p className="mt-0.5 text-xs text-slate-500">Dự án × vai trò · chỉ các tuần đã qua và mọi người đã gửi đủ giờ</p>
          </div>
          {okWeeks.size === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              Chưa có tuần nào đủ giờ để so. Một tuần chỉ được tính khi mọi nhân sự đang lọc đều đã gửi bảng công tuần đó.
            </p>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 420 }}>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[10.5px] uppercase tracking-wider text-slate-600">
                    <th className="px-3 py-2 text-left font-medium">Dự án · vai trò</th>
                    <th className="w-16 px-2 py-2 text-right font-medium">KH</th>
                    <th className="w-16 px-2 py-2 text-right font-medium">Thực</th>
                    <th className="w-14 px-2 py-2 text-right font-medium">Lệch</th>
                    <th className="w-36 px-3 py-2 text-left font-medium">Kết luận</th>
                  </tr>
                </thead>
                <tbody>
                  {pva.map((x) => {
                    const [label, cls] = verdictOf(x.pc);
                    const p = projById.get(x.pid);
                    return (
                      <tr key={`${x.pid}${x.rid}`} className="border-b border-slate-800/70 hover:bg-slate-800/20">
                        <td className="px-3 py-1.5">
                          <span className="text-slate-200">{p?.code || ""}</span> <span className="text-slate-500">{p?.name}</span> · <span className="font-mono text-slate-300">{x.rid}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-400">{f0(x.kh)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-100">{f0(x.th)}</td>
                        <td className={`px-2 py-1.5 text-right font-mono ${cls}`}>{x.pc == null ? "—" : `${x.pc}%`}</td>
                        <td className={`px-3 py-1.5 ${cls}`}>{label}</td>
                      </tr>
                    );
                  })}
                  <tr><td colSpan={5} className="px-3 py-2 text-[11px] text-slate-500">
                    Đơn vị người-tuần cộng dồn trên {okWeeks.size} tuần đủ giờ. Giờ vắng mặt và giờ không thuộc dự án không tính vào đây.
                  </td></tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
