/* ARTIUS TIME v12 — Tab "Kế hoạch": khung chung, các chế độ Nhập liệu (Toàn bộ | Từng dự án), Theo dự án, So với thực tế (v13.1).
   v12.34 — bỏ chế độ Tổng quan: thiếu / dư người chỉ xem ở Dashboard › Tổng quan nguồn lực (PlanOverview.jsx giữ lại, không dùng).
   Admin nhập và lưu; BOD và trưởng phòng chỉ xem. Dữ liệu nằm ở bảng riêng (xem planStore.js). */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Loader2, Merge, RotateCcw, Save } from "lucide-react";
import { fmt, mondayOf } from "../../core/date.jsx";
import { dbTsSent, ensureMonths, useDataTick, weekDone } from "../../core/db.jsx";
import { ROLES, isResigned } from "../../core/domain.jsx";
import { CTRL, Panel, btnGhost, btnPrimary } from "../../core/ui.jsx";
import { PER_YEAR, actualByCell, foldMerged, joinYears, normalizeYear, prunePlan, realWeeksOfPair, slotIndexOf, splitYears, weeksOfPair } from "./planCalc.js";
import { PlanActual } from "./PlanActual.jsx";
import { PlanFocus } from "./PlanFocus.jsx";
import { PlanGrid } from "./PlanGrid.jsx";
import { PlanProjects } from "./PlanProjects.jsx";
import { SQL_HINT, errMsg, isMissingTable, listSnapshots, loadPlan, savePlan, snapshotPlan } from "./planStore.js";

const DEFAULT_AVAIL = 0.8;
/* vai trò cơ bản tự điền cho dự án chưa có dòng nào (chỉ lấy vai trò còn tồn tại trong Thiết lập) */
const DEFAULT_ROLES = ["TK", "3D", "2D", "BIM", "MEP", "PM", "GS"];

export default function ResourcePlan({ cfg, saveCfg, flash, readOnly = false, canSaveProjects = false }) {
  const tick = useDataTick();
  const thisYear = new Date().getFullYear();
  const [start, setStart] = useState(thisYear);   // cặp năm đang xem: start và start + 1
  const [mode, setMode] = useState("in");
  /* v12.29 — Nhập liệu có hai cách xem: Toàn bộ (lưới cũ) và Từng dự án (PlanFocus); nhớ riêng từng máy */
  const [inView, setInView] = useState(() => { try { return localStorage.getItem("artius:planInView") === "one" ? "one" : "all"; } catch { return "all"; } });
  const pickInView = (v) => { setInView(v); try { localStorage.setItem("artius:planInView", v); } catch { /* chỉ nhớ trong phiên */ } };
  const [plan, setPlan] = useState({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [snaps, setSnaps] = useState([]);
  const [ts, setTs] = useState(null);          // { detail, okWeeks }
  const savedAt = useRef("");

  const avail = Number(cfg.planning?.availability) > 0 ? Number(cfg.planning.availability) : DEFAULT_AVAIL;
  const n1 = PER_YEAR, n2 = PER_YEAR;   // mỗi năm 48 cột (12 tháng × 4 tuần)
  /* v12.8 — hai năm liền nhau trên MỘT lưới cuộn ngang. Chỉ số tuần nối tiếp (0 … n1+n2-1);
     khi lưu thì tách lại, Supabase vẫn lưu từng năm một. */
  const weeks = useMemo(() => weeksOfPair(start), [start]);
  const view = weeks;
  const realWeeks = useMemo(() => realWeeksOfPair(start), [start]);   // các thứ Hai thật, để so giờ thực tế
  const nowIdx = slotIndexOf(start, new Date());

  const projects = useMemo(() => (cfg.projects || []).filter((p) => p.active), [cfg.projects]);
  /* v12.24 — chế độ "Theo dự án" phải thấy cả dự án ĐÃ ĐÓNG, nếu không thì không bao giờ gợi ý được "nên mở" */
  const everyProject = useMemo(() => cfg.projects || [], [cfg.projects]);
  const toggleActive = async (pid) => {
    const p = everyProject.find((x) => x.id === pid);
    if (!p) return;
    const ok = await saveCfg({ ...cfg, projects: cfg.projects.map((x) => (x.id === pid ? { ...x, active: !x.active } : x)) });
    if (ok !== false) flash(p.active ? `Đã đóng ${p.name} — nhân viên không chấm công vào đây được nữa.` : `Đã mở ${p.name} cho chấm công.`);
  };
  /* v12.14 — dự án tạm ẩn: lưu trong thiết lập chung (mọi người thấy như nhau), không tính vào tổng / tổng quan / Excel */
  const hidden = useMemo(() => new Set(cfg.planning?.hidden || []), [cfg.planning?.hidden]);
  const shownProjects = useMemo(() => projects.filter((p) => !hidden.has(p.id)), [projects, hidden]);
  /* vai trò bị ẩn ở khối tổng: không hiện ở Tổng quan và Excel (thiết lập chung planning.totals) */
  const totals = cfg.planning?.totals;
  const onTotals = async (t) => { await saveCfg({ ...cfg, planning: { ...(cfg.planning || {}), totals: t } }); };
  const toggleHide = async (pid) => {
    const cur = new Set(cfg.planning?.hidden || []);
    const off = !cur.has(pid);
    if (off) cur.add(pid); else cur.delete(pid);
    const ok = await saveCfg({ ...cfg, planning: { ...(cfg.planning || {}), hidden: [...cur] } });
    const p = projects.find((x) => x.id === pid);
    if (ok !== false) flash(off ? `Đã tạm ẩn ${p?.code || p?.name} — không tính vào tổng.` : `Đã hiện lại ${p?.code || p?.name}.`);
  };
  /* v12.16 — gộp vai trò trong kế hoạch (thiết lập chung planning.merge = { con: cha }), vd TL-2D → 2D, TLTK → TK.
     Chỉ có tác dụng trong mục Kế hoạch: quân số, nhu cầu, giờ thực tế của vai trò con đều tính vào vai trò cha.
     Vai trò của nhân sự ở tab Nhân sự không đổi. */
  const allRoles = useMemo(() => ROLES.map((r) => ({ ...r })), [cfg.roles, tick]);   // eslint-disable-line react-hooks/exhaustive-deps
  const merge = useMemo(() => {
    const m = cfg.planning?.merge || {}, ids = new Set(allRoles.map((r) => r.id)), out = {};
    for (const [k, v] of Object.entries(m)) if (ids.has(k) && ids.has(v) && k !== v && !m[v]) out[k] = v;   // chỉ một tầng, bỏ vai trò đã xoá
    return out;
  }, [cfg.planning?.merge, allRoles]);
  const prole = useCallback((rid) => merge[rid] || rid, [merge]);
  const roles = useMemo(() => allRoles.filter((r) => !merge[r.id]), [allRoles, merge]);
  const mergedOf = useMemo(() => {
    const m = new Map();
    for (const [k, v] of Object.entries(merge)) m.set(v, [...(m.get(v) || []), k]);
    return m;
  }, [merge]);
  /* v12.17 — người được bỏ khỏi kế hoạch ở tab Nhân sự (noPlan, vd thử việc): không tính quân số, giờ thực tế, cũng không làm tuần bị "chưa đủ giờ" */
  const staff = useMemo(() => (cfg.employees || []).filter((e) => !isResigned(e) && !e.noPlan), [cfg.employees]);
  const planStaff = useMemo(() => staff.map((e) => (e.role && merge[e.role] ? { ...e, role: merge[e.role] } : e)), [staff, merge]);
  const { head, cap } = useMemo(() => {
    const h = new Map();
    for (const e of planStaff) if (e.role) h.set(e.role, (h.get(e.role) || 0) + 1);
    return { head: h, cap: new Map([...h].map(([k, v]) => [k, +(v * avail).toFixed(2)])) };
  }, [planStaff, avail]);
  const statRoles = useMemo(() => { const h = new Set(totals?.hidden || []); return roles.filter((r) => !h.has(r.id)); }, [roles, totals]);

  /* dự án chưa có dòng nào → điền sẵn các vai trò cơ bản (dòng toàn 0, chưa tính là "đã sửa").
     Chỉ chạy lúc tải: gỡ bớt vai trò rồi lưu thì giữ nguyên, trừ khi gỡ hết thì lần mở sau điền lại. */
  const fillRef = useRef(null);
  fillRef.current = (p) => {
    if (readOnly) return p;
    const ids = DEFAULT_ROLES.filter((id) => roles.some((r) => r.id === id));
    const f = foldMerged(p, prole);
    foldedRef.current = f.changed;
    const out = { ...f.plan };
    for (const pr of projects) if (!out[pr.id] || !Object.keys(out[pr.id]).length)
      out[pr.id] = Object.fromEntries(ids.map((id) => [id, Array(weeks.length).fill(0)]));
    return out;
  };
  const foldedRef = useRef(false);   // lúc tải có dòng vai trò con được gộp → đánh dấu chưa lưu để tự lưu
  useEffect(() => {   // đổi thiết lập gộp khi đang mở lưới → gộp ngay các dòng đang có
    if (readOnly) return;
    setPlan((p) => { const f = foldMerged(p, prole); if (f.changed) setDirty(true); return f.plan; });
  }, [prole, readOnly]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const setMerge = async (child, parent) => {
    const m = { ...(cfg.planning?.merge || {}) };
    if (parent) m[child] = parent; else delete m[child];
    const ok = await saveCfg({ ...cfg, planning: { ...(cfg.planning || {}), merge: m } });
    if (ok !== false) flash(parent ? `Đã gộp ${child} vào ${parent} trong kế hoạch.` : `Đã tách ${child} ra riêng.`);
  };

  /* ---------- tải lưới ---------- */
  useEffect(() => {
    let alive = true;
    setBusy(true); setErr("");
    Promise.all([loadPlan(start), loadPlan(start + 1)])
      .then(([a, b]) => { if (alive) { setPlan(fillRef.current(joinYears(normalizeYear(a, start), normalizeYear(b, start + 1), n1, n2))); setDirty(!readOnly && foldedRef.current); } })
      .catch((e) => { if (alive) setErr(isMissingTable(e) ? SQL_HINT : `Chưa tải được kế hoạch — ${errMsg(e)}`); })
      .finally(() => alive && setBusy(false));
    Promise.all([listSnapshots(start), listSnapshots(start + 1)]).then(([a, b]) => alive && setSnaps([...a, ...b])).catch(() => {});
    return () => { alive = false; };
  }, [start, n1, n2]);

  /* ---------- giờ thực tế của năm đang xem ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const nowYm = fmt(new Date()).slice(0, 7);   // tháng chưa tới thì chưa có giờ, khỏi tải
      const yms = [start, start + 1].flatMap((y) => [...Array(12)].map((_, m) => `${y}-${String(m + 1).padStart(2, "0")}`)).filter((ym) => ym <= nowYm);
      await ensureMonths(yms);
      if (!alive) return;
      const detail = [];
      for (const ym of yms) for (const e of staff) {
        const d = dbTsSent(e.id, ym); if (!d?.rows) continue;
        for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
          if (!h) continue;
          detail.push({ empId: e.id, date, hours: Number(h), projectId: r.projectId, taskId: r.taskId });
        }
      }
      /* tuần "đủ giờ": đã qua và mọi nhân sự còn làm đều đã gửi tuần đó */
      const today = fmt(mondayOf(new Date()));
      const ok = new Set();
      for (const w of realWeeks) {
        if (w.monday >= today) continue;
        const need = staff.filter((e) => !e.resignedAt || e.resignedAt > w.monday);
        if (need.length && need.every((e) => weekDone(e.id, w.monday))) ok.add(w.monday);
      }
      if (alive) setTs({ detail, okWeeks: ok });
    })();
    return () => { alive = false; };
  }, [start, staff, realWeeks, tick]);

  const actual = useMemo(
    () => actualByCell(ts?.detail || [], planStaff, cfg.hours),
    [ts, planStaff, cfg.hours]);

  /* ---------- lưu ---------- */
  /* ---------- lưu (tự lưu sau khi ngừng gõ 2 giây, nút Lưu để ghi ngay) ----------
     Không thay lưới đang hiện bằng bản đã dọn sau khi lưu: đang gõ dở mà dòng toàn 0 biến mất thì rất khó chịu.
     Chỉ tắt cờ "chưa lưu" nếu từ lúc bắt đầu lưu tới giờ không gõ thêm gì. */
  const planNow = useRef(plan); planNow.current = plan;
  const savingRef = useRef(false), againRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const doSave = useCallback(async (manual = false) => {
    if (readOnly) return true;
    if (savingRef.current) { againRef.current = true; return false; }
    savingRef.current = true; setSaving(true);
    const snap = planNow.current;
    let ok = true;
    try {
      const [a, b] = splitYears(prunePlan(snap), n1, n2);
      await savePlan(start, prunePlan(a));
      await savePlan(start + 1, prunePlan(b));
      if (planNow.current === snap) setDirty(false);
      savedAt.current = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      setSaveErr("");
      if (manual) flash("Đã lưu kế hoạch.");
    } catch (e) {
      ok = false;
      const m = isMissingTable(e) ? `${SQL_HINT} (${errMsg(e)})` : `Chưa lưu được — ${errMsg(e)}`;
      setSaveErr(m);
      if (manual || !saveErr) flash(m, "err");   // tự lưu lỗi: báo một lần, sau đó hiện sẵn trên đầu lưới
    } finally {
      savingRef.current = false; setSaving(false);
      if (againRef.current) { againRef.current = false; setTimeout(() => doSaveRef.current(), 0); }
    }
    return ok;
  }, [readOnly, start, n1, n2, flash, saveErr]);
  const doSaveRef = useRef(doSave); doSaveRef.current = doSave;
  const onSave = () => doSave(true);

  useEffect(() => {   // tự lưu
    if (!dirty || readOnly) return undefined;
    const t = setTimeout(() => doSaveRef.current(), 2000);
    return () => clearTimeout(t);
  }, [plan, dirty, readOnly]);
  useEffect(() => {   // còn số chưa lưu mà đóng tab → trình duyệt hỏi lại
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  /* đổi cặp năm: lưu nốt phần đang dở rồi mới chuyển */
  const changeStart = async (y) => {
    if (dirty && !readOnly && !(await doSave())) return;
    setStart(y);
  };

  const onSnapshot = useCallback(async () => {
    try {
      const label = `Chốt ${new Date().toLocaleDateString("vi-VN")}`;
      const [a, b] = splitYears(prunePlan(plan), n1, n2);
      await snapshotPlan(start, label, prunePlan(a));
      await snapshotPlan(start + 1, label, prunePlan(b));
      setSnaps((await Promise.all([listSnapshots(start), listSnapshots(start + 1)])).flat());
      flash("Đã chốt bản kế hoạch. Từ giờ phần so với thực tế dùng bản này.");
    } catch (e) { flash(isMissingTable(e) ? SQL_HINT : `Chưa chốt được — ${errMsg(e)}`, "err"); }
  }, [plan, start, n1, n2, flash]);

  const onExport = async () => {
    try {
      const { exportPlanXlsx } = await import("./planExport.js");
      await exportPlanXlsx({ plan: prunePlan(plan), projects: shownProjects, roles: statRoles, weeks, cap, head, actual, okWeeks: ts?.okWeeks || new Set(), realWeeks, start, snaps, avail });
      flash("Đã xuất Excel kế hoạch.");
    } catch (e) { flash(`Chưa xuất được — ${errMsg(e)}`, "err"); }
  };

  const setAvail = async (v) => {
    const ok = await saveCfg({ ...cfg, planning: { ...(cfg.planning || {}), availability: v } });
    if (ok !== false) flash(`Hệ số sẵn sàng ${Math.round(v * 100)}%.`);
  };

  const years = [thisYear - 1, thisYear];   // 2025–2026 và 2026–2027

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
          <button onClick={() => setMode("in")} aria-pressed={mode === "in"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "in" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Nhập liệu</button>
          <button onClick={() => setMode("pj")} aria-pressed={mode === "pj"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "pj" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Theo dự án</button>
          {/* v13.1 — kế hoạch so với giờ đã gửi */}
          <button onClick={() => setMode("ac")} aria-pressed={mode === "ac"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "ac" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>So với thực tế</button>
        </div>
        {!readOnly && (saving ? <span className="text-xs text-teal-400">Đang lưu…</span>
          : saveErr ? <span className="text-xs text-rose-400" title={saveErr}>Chưa lưu được — bấm Lưu để thử lại</span>
            : dirty ? <span className="text-xs text-amber-400">Chưa lưu — tự lưu sau 2 giây</span>
              : savedAt.current ? <span className="text-xs text-slate-500">Đã lưu lúc {savedAt.current}</span> : null)}
        <span className="ml-auto font-mono text-[11px] text-slate-600">KH 1.0</span>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-900 bg-rose-950 px-4 py-3 text-sm text-rose-100">
          {err}
        </div>
      )}

      <Panel flush
        title={mode === "pj" ? "Kế hoạch theo dự án" : mode === "ac" ? "Kế hoạch so với thực tế" : "Lưới kế hoạch nguồn lực"}
        sub={<>Năm {start}–{start + 1} · {weeks.length} cột (mỗi tháng 4 tuần) · đơn vị là số người (1 / 0,5 / 0,25)</>}
        right={busy ? <Loader2 className="shrink-0 animate-spin text-slate-500" size={16} /> : null}>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
          <select value={start} onChange={(e) => changeStart(Number(e.target.value))} aria-label="Cặp năm" className="h-11 w-40 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100">
            {years.map((y) => <option key={y} value={y}>Năm {y}–{y + 1}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Hệ số sẵn sàng
            <select value={avail} disabled={readOnly} onChange={(e) => setAvail(Number(e.target.value))}
              className="h-11 w-24 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 disabled:opacity-50">
              {[0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
            </select>
          </label>
          {mode === "in" && (
            <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5" role="group" aria-label="Cách xem lưới nhập">
              <button onClick={() => pickInView("all")} aria-pressed={inView === "all"}
                className={`h-10 rounded-md px-4 text-sm font-medium ${inView === "all" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Toàn bộ</button>
              <button onClick={() => pickInView("one")} aria-pressed={inView === "one"}
                className={`h-10 rounded-md px-4 text-sm font-medium ${inView === "one" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Từng dự án</button>
            </div>
          )}
          {mode === "in" && (
            <button onClick={() => window.dispatchEvent(new Event("artius:planNow"))} className={btnGhost}>Về tuần này</button>
          )}
          {!readOnly && (
            <button onClick={() => setMergeOpen(!mergeOpen)} aria-expanded={mergeOpen}
              title="Gộp vai trò con vào vai trò chính trong kế hoạch, vd Teamleader 2D vào Họa viên 2D"
              className={`${btnGhost} ${mergeOpen ? "border-teal-700 text-teal-300" : ""}`}><Merge size={15} /> Gộp vai trò{Object.keys(merge).length ? ` (${Object.keys(merge).length})` : ""}</button>
          )}
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <button onClick={onExport} title="Xuất lưới, tổng theo vai trò, so với thực tế và các bản chốt"
              className={`flex-1 sm:flex-none ${btnGhost}`}><Download size={15} /> Xuất Excel</button>
          {!readOnly && (
            <>
              <button onClick={onSnapshot} title="Chụp lại lưới hiện tại để về sau so với thực tế trên bản đã chốt"
                className={`flex-1 sm:flex-none ${btnGhost}`}><Camera size={15} /> Chốt bản {snaps.length ? `(${snaps.length})` : ""}</button>
              <button onClick={() => { setDirty(false); setBusy(true); Promise.all([loadPlan(start), loadPlan(start + 1)]).then(([a, b]) => { setPlan(fillRef.current(joinYears(normalizeYear(a, start), normalizeYear(b, start + 1), n1, n2))); setBusy(false); }).catch(() => setBusy(false)); }}
                className={`flex-1 sm:flex-none ${btnGhost}`}><RotateCcw size={15} /> Tải lại</button>
              <button onClick={onSave} disabled={(!dirty && !saveErr) || busy || saving} className={`flex-1 sm:flex-none ${btnPrimary} disabled:opacity-40`}><Save size={15} /> Lưu</button>
            </>
          )}
          </div>
        </div>

        {mergeOpen && !readOnly && (
          <div className="border-b border-slate-800 px-3 py-3 md:px-4">
            <p className="mb-2 text-xs text-slate-500">
              Vai trò được gộp không còn dòng riêng trong kế hoạch: quân số, nhu cầu và giờ thực tế của nó tính vào vai trò chính.
              Vai trò của nhân sự ở tab Nhân sự không đổi.
            </p>
            <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {allRoles.map((r) => {
                const kids = mergedOf.get(r.id);
                return (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate"><span className="font-mono text-slate-400">{r.id}</span> <span className="text-slate-300">{r.name}</span></span>
                    {kids ? <span className="text-xs text-teal-400">nhóm chính · gồm {kids.join(", ")}</span> : (
                      <select value={merge[r.id] || ""} onChange={(e) => setMerge(r.id, e.target.value)} aria-label={`Gộp ${r.id} vào`}
                        className="h-8 w-44 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100">
                        <option value="">Không gộp</option>
                        {allRoles.filter((x) => x.id !== r.id && !merge[x.id]).map((x) => <option key={x.id} value={x.id}>gộp vào {x.id} · {x.name}</option>)}
                      </select>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {readOnly && Object.keys(merge).length > 0 && (
          <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-500 md:px-4">
            Gộp trong kế hoạch: {Object.entries(merge).map(([k, v]) => `${k} → ${v}`).join(" · ")}
          </div>
        )}

        {mode === "ac" ? (
          <PlanActual plan={plan} projects={everyProject} roles={roles} start={start} realWeeks={realWeeks} hidden={hidden}
            support={Array.isArray(cfg.support) ? cfg.support : []}
            detail={ts?.detail || []} staff={planStaff} hoursCfg={cfg.hours} prole={prole} loading={!ts} />
        ) : mode === "pj" ? (
          <PlanProjects plan={plan} projects={everyProject} roles={roles} weeks={view} nowIndex={nowIdx}
            hidden={hidden} detail={ts?.detail || []} employees={cfg.employees || []} support={Array.isArray(cfg.support) ? cfg.support : []}
            canToggle={!readOnly && canSaveProjects} onToggle={toggleActive} prole={prole} />
        ) : mode === "in" && inView === "one" ? (
          <PlanFocus plan={plan} onChange={(p) => { setPlan(p); setDirty(true); }}
            projects={projects} hidden={hidden} mergedOf={mergedOf} roles={roles} weeks={view} nWeeks={weeks.length}
            cap={cap} head={head} readOnly={readOnly} nowIndex={nowIdx} scrollKey={start} />
        ) : (
          <PlanGrid plan={plan} onChange={(p) => { setPlan(p); setDirty(true); }}
            projects={projects} hidden={hidden} onToggleHide={readOnly ? undefined : toggleHide} totals={totals} onTotals={readOnly ? undefined : onTotals} mergedOf={mergedOf} roles={roles} weeks={view} nWeeks={weeks.length}
            cap={cap} head={head} readOnly={readOnly} nowIndex={nowIdx} scrollKey={start} />
        )}
      </Panel>
    </div>
  );
}
