/* ARTIUS TIME v12.29 — Kế hoạch › Nhập liệu › "Từng dự án".
   Bên trái: danh sách dự án, mỗi dự án kèm khoảng tuần có kế hoạch và dấu "có tuần thiếu người".
   Bên phải: lưới của riêng dự án đang chọn — chỉ các vai trò của dự án, chỉ các tuần dự án chạy (đệm thêm mỗi bên),
   ngay dưới mỗi vai trò là dòng CÒN của cả công ty. Sửa đúng dữ liệu kế hoạch chung, lưu như lưới Toàn bộ. */
import React, { useEffect, useMemo, useState } from "react";
import { sortByProjOrder } from "../../shared/rowDrag.jsx";
import { btnGhost } from "../../core/ui.jsx";
import { isLight } from "../../core/theme.jsx";
import { PlanGrid } from "./PlanGrid.jsx";

const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");
const ws = (w) => `T${w.m}·${w.w}/${String(w.y).slice(2)}`;
const PORD_KEY = "artius:planProjOrder", FOC_KEY = "artius:planFocus", PAD_KEY = "artius:planPad";
const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* chỉ nhớ trong phiên */ } };
const readPOrd = () => { try { const a = JSON.parse(localStorage.getItem(PORD_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };

/* màu theo theme đặt trong code (class hover:/… không có trong LIGHT_CSS thì mode sáng vẫn giữ màu tối) */
const TONE = {
  dark:  { hover: "rgba(30,41,59,0.45)", on: "#042f2e", onLine: "#14b8a6", warn: "#fbbf24" },
  light: { hover: "#f1f5f9",             on: "#f0fdfa", onLine: "#0d9488", warn: "#b45309" },
};

export function PlanFocus({ plan, onChange, projects: allProjects, hidden = new Set(), roles, weeks, nWeeks, cap, head, readOnly = false, nowIndex = -1, scrollKey, mergedOf }) {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    window.addEventListener("artius:theme", f);
    return () => window.removeEventListener("artius:theme", f);
  }, []);
  const C = isLight() ? TONE.light : TONE.dark;

  const projects = useMemo(() => sortByProjOrder(allProjects.filter((p) => !hidden.has(p.id)), readPOrd(), (p) => p.id), [allProjects, hidden]);
  const scopePids = useMemo(() => projects.map((p) => p.id), [projects]);
  const [pick, setPick] = useState(() => readLS(FOC_KEY, ""));
  const pid = projects.some((p) => p.id === pick) ? pick : projects[0]?.id;
  const choose = (id) => { setPick(id); writeLS(FOC_KEY, id); };
  const [pad, setPad] = useState(() => { const v = Number(readLS(PAD_KEY, 2)); return v >= 0 && v <= 12 ? v : 2; });
  const changePad = (d) => { const v = Math.max(0, Math.min(12, pad + d)); setPad(v); writeLS(PAD_KEY, v); };
  const [hov, setHov] = useState(null);

  /* nhu cầu cả công ty theo vai trò × tuần — tính một lần cho mọi dự án trong danh sách */
  const need = useMemo(() => {
    const m = new Map();
    for (const id of scopePids) for (const [rid, arr] of Object.entries(plan[id] || {})) {
      if (!m.has(rid)) m.set(rid, new Float64Array(nWeeks));
      const a = m.get(rid);
      (arr || []).forEach((v, i) => { a[i] += Number(v) || 0; });
    }
    return m;
  }, [plan, scopePids, nWeeks]);
  const from0 = Math.max(0, nowIndex);
  const info = useMemo(() => {
    const out = new Map();
    for (const p of projects) {
      let a = Infinity, b = -1, tot = 0, short = false;
      for (const [rid, arr] of Object.entries(plan[p.id] || {})) {
        (arr || []).forEach((v0, i) => {
          const v = Number(v0) || 0;
          if (v <= 0) return;
          a = Math.min(a, i); b = Math.max(b, i); tot += v;
          if (!short && i >= from0 && (cap.get(rid) || 0) - (need.get(rid)?.[i] || 0) < -0.001) short = true;
        });
      }
      out.set(p.id, { span: b < 0 ? null : { a, b }, tot, short });
    }
    return out;
  }, [plan, projects, need, cap, from0]);

  const wOf = (i) => weeks.find((w) => w.i === i);
  const spanTxt = (sp) => (sp ? `${ws(wOf(sp.a))} → ${ws(wOf(sp.b))}` : "chưa có kế hoạch");
  const cur = projects.find((p) => p.id === pid);
  const ci = cur ? info.get(cur.id) : null;
  const sp = ci?.span;
  const last = weeks.length ? weeks[weeks.length - 1].i : 0;
  const lo = sp ? Math.max(0, sp.a - pad) : from0;
  const hi = sp ? Math.min(last, sp.b + pad) : Math.min(last, from0 + 11);
  const view = useMemo(() => weeks.filter((w) => w.i >= lo && w.i <= hi), [weeks, lo, hi]);
  const used = new Set(Object.keys((cur && plan[cur.id]) || {}));
  const free = roles.filter((r) => !used.has(r.id));
  const addRole = (rid) => {
    if (!rid || !cur) return;
    onChange({ ...plan, [cur.id]: { ...(plan[cur.id] || {}), [rid]: Array(nWeeks).fill(0) } });
  };

  if (!projects.length) return <div className="px-4 py-6 text-sm text-slate-500">Chưa có dự án đang mở.</div>;

  return (
    <div className="md:flex">
      <div className="max-h-56 overflow-auto border-b border-slate-800 md:max-h-[78vh] md:w-72 md:shrink-0 md:border-b-0 md:border-r">
        {projects.map((p) => {
          const it = info.get(p.id), on = p.id === pid;
          return (
            <button key={p.id} type="button" onClick={() => choose(p.id)} aria-pressed={on}
              onMouseEnter={() => setHov(p.id)} onMouseLeave={() => setHov((h) => (h === p.id ? null : h))}
              className="block w-full border-b border-slate-800 px-3 py-2 text-left"
              style={{ background: on ? C.on : hov === p.id ? C.hover : "transparent", boxShadow: on ? `inset 3px 0 0 ${C.onLine}` : "none" }}>
              <span className={`block text-sm ${on ? "text-teal-300" : "text-slate-200"}`}>
                {p.name}{p.code && <span className="ml-1.5 font-mono text-[11px] text-slate-500">{p.code}</span>}
              </span>
              <span className="block text-[11.5px] text-slate-500">
                {spanTxt(it?.span)}
                {it?.short && <span style={{ color: C.warn }}> · có tuần thiếu người</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
          <div className="min-w-0">
            <div className="text-[15px] text-slate-100">
              {cur.name}{cur.code && <span className="ml-1.5 font-mono text-xs text-slate-500">{cur.code}</span>}
            </div>
            <div className="text-xs text-slate-500">
              {sp ? `${spanTxt(sp)} · ${sp.b - sp.a + 1} tuần · ${f0(ci.tot)} người-tuần` : "chưa có kế hoạch"}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => changePad(-1)} disabled={pad <= 0} className={`${btnGhost} disabled:opacity-40`}>− tuần</button>
            <button type="button" onClick={() => changePad(1)} disabled={pad >= 12} className={`${btnGhost} disabled:opacity-40`}>+ tuần</button>
            {!readOnly && free.length > 0 && (
              <select value="" onChange={(e) => addRole(e.target.value)} aria-label={`Thêm vai trò cho ${cur.name}`}
                className="h-11 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100">
                <option value="">+ Thêm vai trò…</option>
                {free.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
              </select>
            )}
          </div>
        </div>
        {used.size === 0 && <div className="px-4 py-3 text-sm text-slate-500">Dự án chưa có vai trò nào.</div>}
        <PlanGrid key={cur.id} focus plan={plan} onChange={onChange} projects={[cur]} scopePids={scopePids}
          roles={roles} weeks={view} nWeeks={nWeeks} cap={cap} head={head} mergedOf={mergedOf}
          readOnly={readOnly} nowIndex={nowIndex} scrollKey={`${scrollKey}|${cur.id}`} />
      </div>
    </div>
  );
}
