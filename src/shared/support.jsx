/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState } from "react";
import {
  Plus, ChevronDown, Loader2, Check, X,
} from "lucide-react";
import { addDays, dLabel, fmt, lastOfMonth, parseD, ymsBetween } from "../core/date.jsx";
import { dbTs, useDataTick } from "../core/db.jsx";
import { DEFAULT_PHASE, activePhases, fmtH, isResigned, norm, projPhaseIsOpen, supportList, uid } from "../core/domain.jsx";
import { btnGhost, btnPrimary, iconBtn, inputCls, selectCls } from "../core/ui.jsx";

/* ============================ v8.7 — HỖ TRỢ DỰ ÁN CÓ THỜI HẠN ============================ */
export const supHours = (x) => {   // giờ đã chấm (cả nháp) của đợt hỗ trợ, trong các tháng đang có trong bộ nhớ
  let h = 0;
  const hi = x.until < fmt(new Date()) ? x.until : fmt(new Date());
  if (hi < x.from) return 0;
  for (const ym of ymsBetween(x.from, hi)) for (const r of dbTs(x.empId, ym)?.rows || []) {
    if (r.projectId !== x.pid) continue;
    for (const [d, v] of Object.entries(r.days || {})) if (d >= x.from && d <= hi && (!x.phase || (r.phaseId || DEFAULT_PHASE) === x.phase)) h += Number(v) || 0;
  }
  return h;
};
/* hộp Mở hỗ trợ: chọn nhân sự · dự án · giai đoạn · thời gian. emps = nhân sự được chọn (trưởng phòng: phòng mình) */
export function SupportDialog({ cfg, emps, presetEmp = "", presetPid = "", onSave, onClose }) {
  const today = fmt(new Date());
  const [eid, setEid] = useState(presetEmp || (emps.length === 1 ? emps[0].id : ""));
  const [pid, setPid] = useState(presetPid);
  const [ph, setPh] = useState("");
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState(fmt(addDays(new Date(), 13)));
  const [dur, setDur] = useState("2w");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const emp = emps.find((e) => e.id === eid);
  const mine = new Set(Array.isArray(emp?.projects) ? emp.projects : []);
  const kw = norm(q.trim());
  const projs = cfg.projects.filter((p) => p.active && !mine.has(p.id) && activePhases().some((x) => projPhaseIsOpen(p, x.id))
    && (!kw || norm(`${p.code || ""} ${p.name}`).includes(kw)));
  const proj = cfg.projects.find((p) => p.id === pid);
  const phases = proj ? activePhases().filter((x) => projPhaseIsOpen(proj, x.id)) : [];
  const setDuration = (k, f = from) => {
    setDur(k);
    if (k === "1w") setUntil(fmt(addDays(parseD(f), 6)));
    if (k === "2w") setUntil(fmt(addDays(parseD(f), 13)));
    if (k === "4w") setUntil(fmt(addDays(parseD(f), 27)));
    if (k === "mo") setUntil(fmt(lastOfMonth(parseD(f))));
  };
  const chip = (on) => `rounded-lg border px-2.5 py-1.5 text-[13px] ${on ? "border-teal-600 bg-teal-600 font-medium text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"}`;
  const ok = eid && pid && from && until && until >= from && until >= today;
  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const done = await onSave({ id: uid("s"), empId: eid, pid, phase: ph, from, until, note: note.trim() });
    setBusy(false);
    if (done) onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[6vh]" onMouseDown={(ev) => { if (ev.target === ev.currentTarget && !busy) onClose(); }}>
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <span className="text-sm font-semibold text-slate-50">Mở hỗ trợ dự án</span>
          <button onClick={onClose} className={iconBtn}><X size={15} /></button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500">Nhân sự</div>
            <select value={eid} onChange={(e) => { setEid(e.target.value); setPid(presetPid); setPh(""); }} className={selectCls}>
              <option value="">— Chọn nhân sự —</option>
              {emps.map((e) => <option key={e.id} value={e.id}>{e.name}{e.code ? ` · ${e.code}` : ""}{e.dept ? ` · ${e.dept}` : ""}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-slate-500">
              <span>Hỗ trợ dự án</span>
              {!presetPid && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm dự án" className="h-8 w-40 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs normal-case tracking-normal text-slate-200 focus:border-teal-500 focus:outline-none" />}
            </div>
            {presetPid && proj ? <div className="text-sm text-slate-100">{proj.code ? `[${proj.code}] ` : ""}{proj.name}{mine.has(proj.id) && <span className="ml-2 text-xs text-amber-400">— người này đã tham gia chính thức</span>}</div> : (
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {projs.map((p) => <button key={p.id} type="button" onClick={() => { setPid(p.id); setPh(""); }} className={chip(pid === p.id)}>{p.code ? `${p.code} ` : ""}<span className="opacity-80">{p.name}</span></button>)}
                {!projs.length && <span className="text-xs text-slate-500">Không có dự án đang mở nào khớp.</span>}
              </div>
            )}
            {emp && !presetPid && <div className="mt-1 text-[11px] text-slate-500">Đã ẩn dự án người này đang tham gia chính thức.</div>}
          </div>
          {proj && (
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500">Giai đoạn</div>
              <div className="flex flex-wrap gap-1.5">
                {phases.map((x) => <button key={x.id} type="button" onClick={() => setPh(x.id)} className={chip(ph === x.id)}>{x.id} {x.name}</button>)}
                <button type="button" onClick={() => setPh("")} className={chip(ph === "")}>Mọi giai đoạn đang mở</button>
              </div>
            </div>
          )}
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500">Thời gian hỗ trợ</div>
            <div className="flex flex-wrap gap-1.5">
              {[["1w", "1 tuần"], ["2w", "2 tuần"], ["4w", "4 tuần"], ["mo", "Hết tháng này"]].map(([k, l]) => <button key={k} type="button" onClick={() => setDuration(k)} className={chip(dur === k)}>{l}</button>)}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">Từ ngày<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (dur) setDuration(dur, e.target.value); }} className={`mt-1 ${inputCls}`} /></label>
              <label className="text-xs text-slate-500">Đến hết ngày<input type="date" min={from} value={until} onChange={(e) => { setUntil(e.target.value); setDur(""); }} className={`mt-1 ${inputCls}`} /></label>
            </div>
            {until < from && <div className="mt-1 text-xs text-rose-400">Ngày kết thúc phải sau ngày bắt đầu.</div>}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (không bắt buộc), ví dụ: hỗ trợ triển khai bản vẽ khối phòng nghỉ" className={inputCls} />
          <p className="text-xs text-slate-500">Nhân sự chấm được vào dự án này ở các ngày trong khoảng trên (vẫn theo khoá chấm công quá hạn). Hết hạn tự ngắt; giờ đã chấm giữ nguyên.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button onClick={onClose} className={btnGhost}>Huỷ</button>
          <button onClick={save} disabled={!ok || busy} className={`${btnPrimary} disabled:opacity-40`}>{busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Mở hỗ trợ</button>
        </div>
      </div>
    </div>
  );
}
/* danh sách đợt hỗ trợ (đang mở / sắp tới / hết hạn ≤ 30 ngày) + nút Mở hỗ trợ · Gia hạn · Kết thúc */
export function SupportPanel({ cfg, onSupport, readOnly = false, collapsible = false, note = "" }) {
  const dataTick = useDataTick();   // eslint-disable-line no-unused-vars
  const today = fmt(new Date());
  const [dlg, setDlg] = useState(false);
  const [open, setOpen] = useState(() => !collapsible || supportList(cfg).some((x) => x.until >= fmt(new Date())));   // có đợt đang mở thì mở sẵn
  const emps = cfg.employees.filter((e) => !isResigned(e) && !e.allProjects).sort((a, b) => a.name.localeCompare(b.name, "vi"));   // v8.8: người có Tất cả dự án không cần hỗ trợ
  const empMap = new Map(cfg.employees.map((e) => [e.id, e]));
  const old = fmt(addDays(new Date(), -30));
  const items = supportList(cfg).filter((x) => empMap.has(x.empId) && x.until >= old)
    .sort((a, b) => (a.until >= today) !== (b.until >= today) ? (a.until >= today ? -1 : 1) : a.until.localeCompare(b.until));
  const live = items.filter((x) => x.until >= today);
  const pName = (pid) => { const p = cfg.projects.find((x) => x.id === pid); return p ? `${p.code ? `${p.code} ` : ""}${p.name}` : "(dự án đã xoá)"; };
  const daysLeft = (x) => Math.round((parseD(x.until) - parseD(today)) / 864e5);
  const extend = (x, n) => onSupport({ ...x, until: fmt(addDays(parseD(x.until < today ? today : x.until), 7 * n)) });
  const end = (x) => (x.from >= today ? onSupport(x, true) : onSupport({ ...x, until: fmt(addDays(new Date(), -1)) < x.from ? x.from : fmt(addDays(new Date(), -1)) }));
  const smBtn = "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <button onClick={() => collapsible && setOpen(!open)} className={`flex min-w-0 items-center gap-2 text-left ${collapsible ? "" : "cursor-default"}`}>
          {collapsible && <ChevronDown size={15} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />}
          <span className="text-sm font-medium text-slate-100">Hỗ trợ dự án</span>
          <span className="sup-tag rounded-md border border-violet-800 bg-violet-950 px-1.5 py-px text-[11px] text-violet-300">{live.length} đang mở</span>
        </button>
        {!readOnly && <button onClick={() => setDlg(true)} className={`ro-hide ${btnPrimary} h-9`}><Plus size={14} /> Mở hỗ trợ</button>}
      </div>
      {open && (
        <>
          {note && <div className="px-3.5 pb-2 text-xs text-slate-500">{note}</div>}
          {items.length === 0 ? <div className="border-t border-slate-800 px-4 py-5 text-center text-sm text-slate-500">Chưa có đợt hỗ trợ nào.</div>
            : items.map((x) => {
              const e = empMap.get(x.empId), left = daysLeft(x), gone = x.until < today, soon = !gone && left <= 2, wait = x.from > today;
              const h = supHours(x);
              return (
                <div key={x.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-800 px-3.5 py-2.5 text-sm ${gone ? "opacity-55" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-100">{e?.name || "?"} <span className="text-slate-500">→</span> {pName(x.pid)}{x.phase ? <span className="text-slate-500"> · {x.phase}</span> : ""}</div>
                    <div className="text-xs text-slate-500">
                      {dLabel(x.from)} → {dLabel(x.until)}
                      {" · "}{gone ? <span>đã hết hạn</span> : wait ? <span className="text-sky-400">bắt đầu {dLabel(x.from)}</span> : <span className={soon ? "text-amber-400" : "text-violet-300"}>{left === 0 ? "hết hạn hôm nay" : `còn ${left} ngày`}</span>}
                      {" · "}{fmtH(h)} h{x.note ? ` · ${x.note}` : ""}
                    </div>
                  </div>
                  {!readOnly && !gone && (
                    <div className="ro-hide flex shrink-0 gap-1.5">
                      <button onClick={() => extend(x, 1)} className={`${smBtn} border-slate-700 text-slate-300 hover:border-teal-600 hover:text-teal-300`}>+1 tuần</button>
                      <button onClick={() => extend(x, 2)} className={`${smBtn} border-slate-700 text-slate-300 hover:border-teal-600 hover:text-teal-300`}>+2 tuần</button>
                      <button onClick={() => end(x)} className={`${smBtn} border-rose-900 text-rose-300 hover:border-rose-700`}>{wait ? "Huỷ" : "Kết thúc"}</button>
                    </div>
                  )}
                  {!readOnly && gone && (
                    <div className="ro-hide flex shrink-0 gap-1.5"><button onClick={() => onSupport({ ...x, id: uid("s"), from: today, until: fmt(addDays(new Date(), 6)) })} className={`${smBtn} border-slate-700 text-slate-400 hover:text-teal-300`}>Mở lại 1 tuần</button></div>
                  )}
                </div>
              );
            })}
        </>
      )}
      {dlg && <SupportDialog cfg={cfg} emps={emps} onSave={onSupport} onClose={() => setDlg(false)} />}
    </div>
  );
}

