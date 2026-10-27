/* ARTIUS TIME v12.2 — Lưới nhập kế hoạch nguồn lực, cả năm trên một bảng cuộn ngang.

   Bố cục: MỘT cột khoá cứng duy nhất, rộng cố định, chứa cả tên dự án lẫn mã vai trò.
   v12.1 dùng hai cột khoá cứng và neo cột thứ hai ở một con số đặt sẵn (left: 150px), trong khi bề ngang
   thật của cột thứ nhất lại do trình duyệt tự tính từ nội dung — tên dự án dài thì cột nở ra, tên ngắn thì
   co lại. Hai con số đó gần như không bao giờ khớp, nên khi cuộn ngang sẽ hở một khoảng cho cột tuần lọt qua.
   Một cột thì không còn con số nào phải khớp với con số nào, nên lỗi đó không thể xảy ra nữa.

   Bề ngang cột khoá và cột tuần đều đặt cứng, tên dự án cắt gọn một dòng (rê chuột xem đủ) — nhờ vậy
   chiều cao mỗi dòng không đổi và màn hình laptop không bị tên dài đẩy cao gấp ba. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { btnGhost } from "../../core/ui.jsx";
import { copyWeek, leftOf, needOf, setCell } from "./planCalc.js";

const FRZ = 230;   // bề ngang cột khoá cứng
const CW = 34;     // bề ngang mỗi cột tuần
const f = (n) => (!n ? "" : String(+Number(n).toFixed(2)).replace(".", ","));
const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");
const parse = (s) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? Math.min(v, 99) : 0;
};

/* ô của cột khoá cứng — luôn đúng một bề ngang, nội dung dài thì cắt gọn */
const Frz = ({ children, cls = "", py = "py-0.5", title }) => (
  <div className={`truncate px-2 ${py} ${cls}`} style={{ width: FRZ }} title={title}>{children}</div>
);

/* một dòng dự án × vai trò — chỉ vẽ lại khi mảng số của chính nó đổi */
const Row = React.memo(function Row({ pid, rid, label, values, weeks, nowIndex, readOnly, onCell, onFocus, onDrop }) {
  return (
    <tr className="border-b border-slate-900/70">
      <td className="sticky left-0 z-20 bg-slate-950 p-0">
        <Frz>
          <span className="pl-4 font-mono text-slate-400">{label}</span>
          {!readOnly && (
            <button type="button" title="Bỏ vai trò này khỏi dự án" onClick={() => onDrop(pid, rid)}
              className="ml-1.5 align-middle text-slate-700 hover:text-rose-400"><Trash2 size={11} /></button>
          )}
        </Frz>
      </td>
      {weeks.map((w, k) => {
        const v = Number(values?.[w.i]) || 0;
        const past = nowIndex >= 0 && w.i < nowIndex;
        return (
          <td key={w.i} style={{ minWidth: CW, ...(v > 0.001 ? { background: `rgba(45,212,191,${(Math.min(v, 2) / 2 * 0.3 + 0.05).toFixed(2)})` } : null) }}
            className={`border-l border-slate-900 p-0 ${past ? "bg-slate-950/70" : ""}`}>
            <input data-cell data-col={k} readOnly={readOnly} value={f(v)} placeholder="·"
              onFocus={(e) => { onFocus(rid, w.i); e.target.select(); }}
              onChange={(e) => onCell(pid, rid, w.i, parse(e.target.value))}
              className="w-full border-0 bg-transparent py-1 text-center font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-800 focus:rounded-sm focus:bg-teal-950 focus:ring-[1.5px] focus:ring-teal-500" />
          </td>
        );
      })}
    </tr>
  );
});

export function PlanGrid({ plan, onChange, projects, roles, weeks, nWeeks, cap, head, readOnly = false, nowIndex = -1, year }) {
  const [active, setActive] = useState(null);     // { rid, wi }
  const [selWeek, setSelWeek] = useState(null);
  const wrap = useRef(null);
  const nowCell = useRef(null);
  const planRef = useRef(plan); planRef.current = plan;
  const changeRef = useRef(onChange); changeRef.current = onChange;

  const pids = useMemo(() => projects.map((p) => p.id), [projects]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const nCol = weeks.length;

  useEffect(() => { nowCell.current?.scrollIntoView({ inline: "center", block: "nearest" }); }, [year]);

  const onCell = useCallback((pid, rid, wi, v) => {
    changeRef.current(setCell(planRef.current, pid, rid, wi, v, nWeeks));
  }, [nWeeks]);
  const onFocusCell = useCallback((rid, wi) => setActive({ rid, wi }), []);
  const onDrop = useCallback((pid, rid) => {
    const next = { ...planRef.current, [pid]: { ...(planRef.current[pid] || {}) } };
    delete next[pid][rid];
    changeRef.current(next);
  }, []);
  /* thêm vai trò = tạo một dòng toàn 0 để gõ. Lưu mà vẫn trống thì dòng tự biến mất (prunePlan). */
  const addRole = (pid, rid) => {
    if (!rid) return;
    const cur = planRef.current;
    const next = { ...cur, [pid]: { ...(cur[pid] || {}) } };
    if (!next[pid][rid]) next[pid][rid] = Array(nWeeks).fill(0);
    changeRef.current(next);
  };

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
  const totalRoles = roles.filter((r) => (cap.get(r.id) || 0) > 0 || weeks.some((w) => needOf(plan, pids, r.id, w.i) > 0));
  const wkTh = (extra) => `sticky z-20 border-l border-slate-800 bg-slate-900 px-1 py-1 text-center ${extra}`;

  return (
    <div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
          <button type="button" disabled={selWeek == null || selWeek >= nWeeks - 1}
            onClick={() => { onChange(copyWeek(plan, pids, selWeek, selWeek + 1, nWeeks)); setSelWeek(selWeek + 1); }}
            className={`${btnGhost} disabled:opacity-40`}><Copy size={14} /> Chép tuần đang chọn sang tuần sau</button>
          <span className={`text-xs ${selWeek == null ? "text-slate-600" : "text-teal-400"}`}>
            {selWeek == null ? "Bấm số tuần trên đầu cột để chọn" : (() => { const w = weeks.find((x) => x.i === selWeek); return `Đang chọn T${w?.m} tuần ${w?.w}`; })()}
          </span>
          <button type="button" onClick={() => nowCell.current?.scrollIntoView({ inline: "center", block: "nearest" })}
            className={`ml-auto ${btnGhost}`}>Về tuần này</button>
        </div>
      )}

      <div ref={wrap} onKeyDown={onKey} className="overflow-auto" style={{ maxHeight: "64vh" }}>
        <table className="text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-slate-900 p-0 text-left">
                <Frz py="py-1"><span className="text-[11px] uppercase tracking-wider text-slate-500">Dự án · vai trò</span></Frz>
              </th>
              {weeks.map((w, k) => (
                <th key={w.i} style={{ minWidth: CW, top: 0 }}
                  className={wkTh(`text-[11px] font-medium ${k === 0 || weeks[k - 1].m !== w.m ? "text-teal-400" : "text-slate-700"}`)}>
                  {k === 0 || weeks[k - 1].m !== w.m ? `T${w.m}` : ""}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 top-[26px] z-30 bg-slate-900 p-0"><Frz py="py-1">&nbsp;</Frz></th>
              {weeks.map((w) => {
                const isNow = w.i === nowIndex;
                return (
                  <th key={w.i} ref={isNow ? nowCell : null} onClick={() => !readOnly && setSelWeek(w.i)}
                    title={isNow ? "Tuần này" : undefined} style={{ minWidth: CW, top: 26 }}
                    className={`sticky z-20 border-l border-slate-800 px-1 py-1 text-center text-[10px] font-normal ${readOnly ? "bg-slate-900 text-slate-600"
                      : selWeek === w.i ? "cursor-pointer bg-teal-900 text-teal-200"
                        : isNow ? "cursor-pointer bg-slate-800 font-semibold text-teal-300"
                          : "cursor-pointer bg-slate-900 text-slate-500 hover:text-teal-400"}`}>
                    {w.w}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {projects.map((p) => {
              const used = new Set(Object.keys(plan[p.id] || {}));
              const rws = roles.filter((r) => used.has(r.id));
              const free = roles.filter((r) => !used.has(r.id));
              const name = `${p.code ? `${p.code} ` : ""}${p.name}`;
              return (
                <React.Fragment key={p.id}>
                  <tr>
                    <td className="sticky left-0 z-20 border-t border-slate-700 bg-slate-950 p-0">
                      <Frz py="py-1" title={name}>
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-slate-100">{name}</span>
                          {!readOnly && free.length > 0 && (
                            <select value="" onChange={(e) => addRole(p.id, e.target.value)}
                              aria-label={`Thêm vai trò cho ${p.name}`}
                              className="ml-auto h-6 w-[72px] shrink-0 rounded border border-slate-700 bg-slate-900 px-1 text-[10px] text-slate-400">
                              <option value="">+ vai trò</option>
                              {free.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                            </select>
                          )}
                        </span>
                      </Frz>
                    </td>
                    <td className="border-t border-slate-700" colSpan={nCol} />
                  </tr>
                  {rws.map((r) => (
                    <Row key={r.id} pid={p.id} rid={r.id} label={r.id} values={plan[p.id]?.[r.id]}
                      weeks={weeks} nowIndex={nowIndex} readOnly={readOnly}
                      onCell={onCell} onFocus={onFocusCell} onDrop={onDrop} />
                  ))}
                </React.Fragment>
              );
            })}

            {/* khối tổng của mọi vai trò */}
            <tr><td className="sticky left-0 z-20 bg-slate-900 p-0"><Frz py="pt-4">&nbsp;</Frz></td><td colSpan={nCol} /></tr>
            <tr>
              <td className="sticky left-0 z-20 border-y border-slate-600 bg-slate-950 p-0">
                <Frz py="py-1.5"><span className="font-semibold text-teal-300">TỔNG TOÀN CÔNG TY</span></Frz>
              </td>
              <td className="border-y border-slate-600" colSpan={nCol} />
            </tr>
            {totalRoles.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="border-b border-slate-900">
                  <td className="sticky left-0 z-20 bg-slate-950 p-0">
                    <Frz title={`${r.id} · ${r.name}`}>
                      <span className="font-mono text-slate-400">{r.id}</span> <span className="text-slate-300">{r.name}</span>{" "}
                      <span className="text-slate-600">· {head.get(r.id) || 0}</span>
                    </Frz>
                  </td>
                  {weeks.map((w) => {
                    const nd = needOf(plan, pids, r.id, w.i);
                    return <td key={w.i} style={{ minWidth: CW }} className={`border-l border-slate-900 px-1 text-center font-mono ${nd ? "text-slate-100" : "text-slate-800"}`}>{nd ? f0(nd) : "0"}</td>;
                  })}
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="sticky left-0 z-20 bg-slate-950 p-0"><Frz><span className="pl-4 text-[11px] text-slate-600">còn lại</span></Frz></td>
                  {weeks.map((w) => {
                    const lf = leftOf(plan, pids, r.id, w.i, cap);
                    return <td key={w.i} className="border-l border-slate-900 px-1 text-center font-mono font-semibold"
                      style={{ minWidth: CW, ...(lf < -0.001 ? { background: "#f87171", color: "#450a0a" } : lf > 0.001 ? { background: "#fde68a", color: "#451a03" } : { background: "#1e293b", color: "#64748b" }) }}>{f0(lf)}</td>;
                  })}
                </tr>
              </React.Fragment>
            ))}

            {/* dải dính đáy: Cần và CÒN của vai trò đang gõ */}
            {stripRole && (
              <>
                <tr>
                  <td className="sticky left-0 z-30 border-t-2 border-teal-800 p-0" style={{ bottom: 22, background: "#041f1c" }}>
                    <Frz title={`${stripRole.id} · ${stripRole.name}`}>
                      <span className="text-[11px] text-teal-500/80">cần — </span>
                      <span className="text-[11px] text-teal-300">{stripRole.id} · {stripRole.name}</span>
                      <span className="font-mono text-[11px] text-teal-500/80"> · {head.get(stripRole.id) || 0}</span>
                    </Frz>
                  </td>
                  {weeks.map((w) => {
                    const nd = needOf(plan, pids, stripRole.id, w.i);
                    return <td key={w.i} className="sticky z-10 border-l border-slate-900 px-1 text-center font-mono text-slate-300"
                      style={{ minWidth: CW, bottom: 22, background: "#041f1c", outline: w.i === active.wi ? "1.5px solid #14b8a6" : "none" }}>{nd ? f0(nd) : "0"}</td>;
                  })}
                </tr>
                <tr>
                  <td className="sticky left-0 z-30 p-0" style={{ bottom: 0, background: "#041f1c" }}>
                    <Frz><span className="pl-4 text-[11px] text-slate-500">còn lại</span></Frz>
                  </td>
                  {weeks.map((w) => {
                    const lf = leftOf(plan, pids, stripRole.id, w.i, cap);
                    return <td key={w.i} className="sticky z-10 border-l border-slate-900 px-1 text-center font-mono font-semibold"
                      style={{ minWidth: CW, bottom: 0, outline: w.i === active.wi ? "1.5px solid #14b8a6" : "none", ...(lf < -0.001 ? { background: "#f87171", color: "#450a0a" } : lf > 0.001 ? { background: "#fde68a", color: "#451a03" } : { background: "#1e293b", color: "#64748b" }) }}>{f0(lf)}</td>;
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
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-950" />tuần đã qua</span>
        <span className="text-slate-600">Tên dự án dài được cắt gọn — rê chuột để xem đủ</span>
        {!readOnly && <span className="text-slate-600">Mũi tên để di chuyển · Enter xuống dòng · Esc nhả ô</span>}
      </div>
    </div>
  );
}
