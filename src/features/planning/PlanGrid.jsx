/* ARTIUS TIME v12 — Lưới nhập kế hoạch nguồn lực.
   Hàng = dự án × vai trò, cột = tuần, ô = số người. Dưới cùng là khối Cần / CÒN của mọi vai trò,
   và một dải CÒN dính đáy bảng chạy theo vai trò đang gõ để không phải cuộn xuống cuối mới thấy hậu quả. */
import React, { useMemo, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { btnGhost } from "../../core/ui.jsx";
import { cellOf, copyWeek, leftOf, needOf, rolesUsedIn, setCell } from "./planCalc.js";

const f = (n) => (!n ? "" : String(+Number(n).toFixed(2)).replace(".", ","));
const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");
const parse = (s) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? Math.min(v, 99) : 0;
};

export function PlanGrid({ plan, onChange, projects, roles, weeks, nWeeks, cap, head, readOnly = false }) {
  const [active, setActive] = useState(null);     // { rid, wi }
  const [selWeek, setSelWeek] = useState(null);
  const wrap = useRef(null);
  const pids = useMemo(() => projects.map((p) => p.id), [projects]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const nCol = weeks.length;

  /* vai trò hiện cho từng dự án: những vai trò đã có số, giữ đúng thứ tự danh sách vai trò của công ty */
  const rowsOf = (pid) => { const used = new Set(rolesUsedIn(plan, pid)); return roles.filter((r) => used.has(r.id)); };
  const addRole = (pid, rid) => { if (rid) onChange(setCell(plan, pid, rid, weeks[0].i, 0.0001, nWeeks)); };
  const dropRole = (pid, rid) => {
    const next = { ...plan, [pid]: { ...(plan[pid] || {}) } };
    delete next[pid][rid]; onChange(next);
  };

  /* phím mũi tên: mọi ô nhập nằm trong một lưới đều nCol cột nên nhảy theo chỉ số là đủ */
  const onKey = (e) => {
    const el = e.target.closest("input[data-cell]"); if (!el) return;
    if (e.key === "Escape") { el.blur(); return; }
    const STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -nCol, ArrowDown: nCol, Enter: nCol };
    if (!(e.key in STEP)) return;
    const col = Number(el.dataset.col);
    if (e.key === "ArrowLeft" && col === 0) return;
    if (e.key === "ArrowRight" && col === nCol - 1) return;
    const all = [...wrap.current.querySelectorAll("input[data-cell]")];
    const t = all[all.indexOf(el) + STEP[e.key]];
    if (t) { e.preventDefault(); t.focus(); t.select(); }
  };

  const stripRole = active?.rid ? roleById.get(active.rid) : null;

  return (
    <div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
          <button type="button" disabled={selWeek == null || selWeek >= weeks[weeks.length - 1].i}
            onClick={() => { onChange(copyWeek(plan, pids, selWeek, selWeek + 1, nWeeks)); setSelWeek(selWeek + 1); }}
            className={`${btnGhost} disabled:opacity-40`}><Copy size={14} /> Chép tuần đang chọn sang tuần sau</button>
          <span className={`text-xs ${selWeek == null ? "text-slate-600" : "text-teal-400"}`}>
            {selWeek == null ? "Bấm số tuần trên đầu cột để chọn" : `Đang chọn ${weeks.find((w) => w.i === selWeek)?.m && `T${weeks.find((w) => w.i === selWeek).m}`} tuần ${weeks.find((w) => w.i === selWeek)?.w}`}
          </span>
        </div>
      )}

      <div ref={wrap} onKeyDown={onKey} className="overflow-auto" style={{ maxHeight: "64vh" }}>
        <table className="text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-[150px] bg-slate-900 px-2 py-1 text-left text-[11px] uppercase tracking-wider text-slate-500">Dự án</th>
              <th className="sticky top-0 z-30 w-[92px] bg-slate-900 px-2 py-1 text-left text-[11px] uppercase tracking-wider text-slate-500" style={{ left: 150 }}>Vai trò</th>
              {weeks.map((w, k) => (
                <th key={w.i} className={`sticky top-0 z-25 border-l border-slate-800 bg-slate-900 px-1 py-1 text-center text-[11px] font-medium ${k === 0 || weeks[k - 1].m !== w.m ? "text-teal-400" : "text-slate-700"}`}>
                  {k === 0 || weeks[k - 1].m !== w.m ? `T${w.m}` : ""}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 top-[26px] z-30 bg-slate-900 px-2 py-1" />
              <th className="sticky top-[26px] z-30 bg-slate-900 px-2 py-1" style={{ left: 150 }} />
              {weeks.map((w) => (
                <th key={w.i} onClick={() => !readOnly && setSelWeek(w.i)}
                  className={`sticky top-[26px] z-25 border-l border-slate-800 px-1 py-1 text-center text-[10px] font-normal ${readOnly ? "bg-slate-900 text-slate-600" : selWeek === w.i ? "cursor-pointer bg-teal-900 text-teal-200" : "cursor-pointer bg-slate-900 text-slate-500 hover:text-teal-400"}`}>
                  {w.w}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {projects.map((p) => {
              const rws = rowsOf(p.id);
              const free = roles.filter((r) => !rws.some((x) => x.id === r.id));
              return (
                <React.Fragment key={p.id}>
                  <tr>
                    <td className="sticky left-0 z-20 border-t border-slate-700 bg-slate-950 px-2 py-1.5 font-semibold text-slate-100">
                      {p.code ? `${p.code} ` : ""}{p.name}
                    </td>
                    <td className="sticky z-20 border-t border-slate-700 bg-slate-950 px-2 py-1.5" style={{ left: 150 }}>
                      {!readOnly && free.length > 0 && (
                        <select value="" onChange={(e) => addRole(p.id, e.target.value)}
                          aria-label={`Thêm vai trò cho ${p.name}`}
                          className="h-7 w-full rounded border border-slate-700 bg-slate-900 px-1 text-[11px] text-slate-400">
                          <option value="">+ vai trò</option>
                          {free.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="border-t border-slate-700" colSpan={nCol} />
                  </tr>

                  {rws.map((r) => (
                    <tr key={r.id} className="border-b border-slate-900/70">
                      <td className="sticky left-0 z-20 bg-slate-950 px-2 py-0.5" />
                      <td className="sticky z-20 bg-slate-950 px-2 py-0.5" style={{ left: 150 }}>
                        <span className="font-mono text-slate-400">{r.id}</span>
                        {!readOnly && (
                          <button type="button" title="Bỏ vai trò này khỏi dự án" onClick={() => dropRole(p.id, r.id)}
                            className="ml-1.5 align-middle text-slate-700 hover:text-rose-400"><Trash2 size={11} /></button>
                        )}
                      </td>
                      {weeks.map((w, k) => {
                        const v = cellOf(plan, p.id, r.id, w.i);
                        return (
                          <td key={w.i} className="border-l border-slate-900 p-0"
                            style={v > 0.001 ? { background: `rgba(45,212,191,${(Math.min(v, 2) / 2 * 0.3 + 0.05).toFixed(2)})` } : undefined}>
                            <input data-cell data-col={k} readOnly={readOnly} value={f(v)} placeholder="·"
                              onFocus={(e) => { setActive({ rid: r.id, wi: w.i }); e.target.select(); }}
                              onChange={(e) => onChange(setCell(plan, p.id, r.id, w.i, parse(e.target.value), nWeeks))}
                              className="w-full border-0 bg-transparent py-1 text-center font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-800 focus:rounded-sm focus:bg-teal-950 focus:ring-[1.5px] focus:ring-teal-500" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}

            {/* khối tổng của mọi vai trò */}
            <tr><td className="sticky left-0 z-20 bg-slate-900 px-2 pt-4" /><td className="sticky z-20 bg-slate-900 pt-4" style={{ left: 150 }} /><td colSpan={nCol} /></tr>
            <tr>
              <td className="sticky left-0 z-20 border-y border-slate-600 bg-slate-950 px-2 py-1.5 font-semibold text-teal-300">TỔNG TOÀN CÔNG TY</td>
              <td className="sticky z-20 border-y border-slate-600 bg-slate-950" style={{ left: 150 }} />
              <td className="border-y border-slate-600" colSpan={nCol} />
            </tr>
            {roles.map((r) => {
              if (!(cap.get(r.id) > 0) && !weeks.some((w) => needOf(plan, pids, r.id, w.i) > 0)) return null;
              return (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-slate-900">
                    <td className="sticky left-0 z-20 bg-slate-950 px-2 py-0.5 text-slate-300">{r.name}</td>
                    <td className="sticky z-20 bg-slate-950 px-2 py-0.5 font-mono text-slate-400" style={{ left: 150 }}>
                      {r.id} · {head.get(r.id) || 0}
                    </td>
                    {weeks.map((w) => {
                      const nd = needOf(plan, pids, r.id, w.i);
                      return <td key={w.i} className={`border-l border-slate-900 px-1 text-center font-mono ${nd ? "text-slate-100" : "text-slate-800"}`}>{nd ? f0(nd) : "0"}</td>;
                    })}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="sticky left-0 z-20 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-600">còn lại</td>
                    <td className="sticky z-20 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-600" style={{ left: 150 }}>CÒN</td>
                    {weeks.map((w) => {
                      const lf = leftOf(plan, pids, r.id, w.i, cap);
                      return <td key={w.i} className="border-l border-slate-900 px-1 text-center font-mono font-semibold"
                        style={lf < -0.001 ? { background: "#f87171", color: "#450a0a" } : lf > 0.001 ? { background: "#fde68a", color: "#451a03" } : { background: "#1e293b", color: "#64748b" }}>{f0(lf)}</td>;
                    })}
                  </tr>
                </React.Fragment>
              );
            })}

            {/* dải dính đáy: Cần và CÒN của vai trò đang gõ */}
            {stripRole && (
              <>
                <tr>
                  <td className="sticky left-0 z-30 border-t-2 border-teal-800 px-2 py-0.5 text-[11px] text-teal-500/80" style={{ bottom: 22, background: "#041f1c" }}>
                    cần — <span className="text-teal-300">{stripRole.id} · {stripRole.name}</span>
                  </td>
                  <td className="sticky z-30 border-t-2 border-teal-800 px-2 py-0.5 font-mono text-[11px] text-teal-500/80" style={{ left: 150, bottom: 22, background: "#041f1c" }}>
                    {head.get(stripRole.id) || 0} người
                  </td>
                  {weeks.map((w) => {
                    const nd = needOf(plan, pids, stripRole.id, w.i);
                    return <td key={w.i} className="sticky z-20 border-l border-slate-900 px-1 text-center font-mono text-slate-300"
                      style={{ bottom: 22, background: "#041f1c", outline: w.i === active.wi ? "1.5px solid #14b8a6" : "none" }}>{nd ? f0(nd) : "0"}</td>;
                  })}
                </tr>
                <tr>
                  <td className="sticky left-0 z-30 px-2 py-0.5 text-[11px] text-slate-500" style={{ bottom: 0, background: "#041f1c" }}>còn lại</td>
                  <td className="sticky z-30 px-2 py-0.5 text-[11px] text-slate-500" style={{ left: 150, bottom: 0, background: "#041f1c" }}>CÒN</td>
                  {weeks.map((w) => {
                    const lf = leftOf(plan, pids, stripRole.id, w.i, cap);
                    return <td key={w.i} className="sticky z-20 border-l border-slate-900 px-1 text-center font-mono font-semibold"
                      style={{ bottom: 0, outline: w.i === active.wi ? "1.5px solid #14b8a6" : "none", ...(lf < -0.001 ? { background: "#f87171", color: "#450a0a" } : lf > 0.001 ? { background: "#fde68a", color: "#451a03" } : { background: "#1e293b", color: "#64748b" }) }}>{f0(lf)}</td>;
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-800 px-3 py-2.5 text-xs text-slate-400 md:px-4">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#fde68a" }} />CÒN dư người</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#f87171" }} />CÒN âm — thiếu người</span>
        {!readOnly && <span className="text-slate-600">Mũi tên để di chuyển · Enter xuống dòng · Esc nhả ô</span>}
      </div>
    </div>
  );
}
