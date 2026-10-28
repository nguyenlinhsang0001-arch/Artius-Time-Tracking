/* ARTIUS TIME v12 — Tab "Kế hoạch": khung chung, hai chế độ Nhập liệu và Tổng quan.
   Admin nhập và lưu; BOD và trưởng phòng chỉ xem. Dữ liệu nằm ở bảng riêng (xem planStore.js). */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Save } from "lucide-react";
import { fmt, mondayOf } from "../../core/date.jsx";
import { dbTsSent, ensureMonths, useDataTick, weekDone } from "../../core/db.jsx";
import { ROLES, isResigned } from "../../core/domain.jsx";
import { CTRL, Panel, btnGhost, btnPrimary } from "../../core/ui.jsx";
import { actualByCell, prunePlan, weekIndexOf, weeksOfYear } from "./planCalc.js";
import { PlanGrid } from "./PlanGrid.jsx";
import { PlanOverview } from "./PlanOverview.jsx";
import { SQL_HINT, errMsg, isMissingTable, listSnapshots, loadPlan, savePlan, snapshotPlan } from "./planStore.js";

const DEFAULT_AVAIL = 0.8;
/* vai trò cơ bản tự điền cho dự án chưa có dòng nào (chỉ lấy vai trò còn tồn tại trong Thiết lập) */
const DEFAULT_ROLES = ["TK", "3D", "2D", "BIM", "MEP", "PM", "GS"];

export default function ResourcePlan({ cfg, saveCfg, flash, readOnly = false }) {
  const tick = useDataTick();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [mode, setMode] = useState("in");
  const [plan, setPlan] = useState({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [snaps, setSnaps] = useState([]);
  const [ts, setTs] = useState(null);          // { detail, okWeeks }
  const savedAt = useRef("");

  const avail = Number(cfg.planning?.availability) > 0 ? Number(cfg.planning.availability) : DEFAULT_AVAIL;
  const weeks = useMemo(() => weeksOfYear(year), [year]);
  /* v12.1 — cả năm trên MỘT lưới, cuộn ngang liền mạch. Trước đây tách nửa đầu / nửa sau,
     dự án vắt qua ranh giới bị cắt làm đôi nên khó theo dõi. */
  const view = weeks;
  const nowIdx = weekIndexOf(weeks, fmt(mondayOf(new Date())));

  const projects = useMemo(() => (cfg.projects || []).filter((p) => p.active), [cfg.projects]);
  const staff = useMemo(() => (cfg.employees || []).filter((e) => !isResigned(e)), [cfg.employees]);
  const { head, cap } = useMemo(() => {
    const h = new Map();
    for (const e of staff) if (e.role) h.set(e.role, (h.get(e.role) || 0) + 1);
    return { head: h, cap: new Map([...h].map(([k, v]) => [k, +(v * avail).toFixed(2)])) };
  }, [staff, avail]);
  const roles = useMemo(() => ROLES.map((r) => ({ ...r })), [cfg.roles, tick]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* dự án chưa có dòng nào → điền sẵn các vai trò cơ bản (dòng toàn 0, chưa tính là "đã sửa").
     Chỉ chạy lúc tải: gỡ bớt vai trò rồi lưu thì giữ nguyên, trừ khi gỡ hết thì lần mở sau điền lại. */
  const fillRef = useRef(null);
  fillRef.current = (p) => {
    if (readOnly) return p;
    const ids = DEFAULT_ROLES.filter((id) => ROLES.some((r) => r.id === id));
    const out = { ...p };
    for (const pr of projects) if (!out[pr.id] || !Object.keys(out[pr.id]).length)
      out[pr.id] = Object.fromEntries(ids.map((id) => [id, Array(weeks.length).fill(0)]));
    return out;
  };

  /* ---------- tải lưới ---------- */
  useEffect(() => {
    let alive = true;
    setBusy(true); setErr("");
    loadPlan(year)
      .then((p) => { if (alive) { setPlan(fillRef.current(p)); setDirty(false); } })
      .catch((e) => { if (alive) setErr(isMissingTable(e) ? SQL_HINT : `Chưa tải được kế hoạch — ${errMsg(e)}`); })
      .finally(() => alive && setBusy(false));
    listSnapshots(year).then((s) => alive && setSnaps(s)).catch(() => {});
    return () => { alive = false; };
  }, [year]);

  /* ---------- giờ thực tế của năm đang xem ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const yms = [...Array(12)].map((_, m) => `${year}-${String(m + 1).padStart(2, "0")}`);
      await ensureMonths(yms);
      if (!alive) return;
      const detail = [];
      for (const ym of yms) for (const e of staff) {
        const d = dbTsSent(e.id, ym); if (!d?.rows) continue;
        for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
          if (!h || date.slice(0, 4) !== String(year)) continue;
          detail.push({ empId: e.id, date, hours: Number(h), projectId: r.projectId, taskId: r.taskId });
        }
      }
      /* tuần "đủ giờ": đã qua và mọi nhân sự còn làm đều đã gửi tuần đó */
      const today = fmt(mondayOf(new Date()));
      const ok = new Set();
      for (const w of weeks) {
        if (w.monday >= today) continue;
        const need = staff.filter((e) => !e.resignedAt || e.resignedAt > w.monday);
        if (need.length && need.every((e) => weekDone(e.id, w.monday))) ok.add(w.monday);
      }
      if (alive) setTs({ detail, okWeeks: ok });
    })();
    return () => { alive = false; };
  }, [year, staff, weeks, tick]);

  const actual = useMemo(
    () => actualByCell(ts?.detail || [], staff, cfg.hours),
    [ts, staff, cfg.hours]);

  /* ---------- lưu ---------- */
  const onSave = useCallback(async () => {
    setBusy(true);
    try {
      const clean = prunePlan(plan);
      await savePlan(year, clean);
      setPlan(clean); setDirty(false);
      savedAt.current = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      flash("Đã lưu kế hoạch.");
    } catch (e) {
      flash(isMissingTable(e) ? SQL_HINT : `Chưa lưu được — ${errMsg(e)}`, "err");
    } finally { setBusy(false); }
  }, [plan, year, flash]);

  const onSnapshot = useCallback(async () => {
    try {
      await snapshotPlan(year, `Chốt ${new Date().toLocaleDateString("vi-VN")}`, prunePlan(plan));
      setSnaps(await listSnapshots(year));
      flash("Đã chốt bản kế hoạch. Từ giờ phần so với thực tế dùng bản này.");
    } catch (e) { flash(isMissingTable(e) ? SQL_HINT : `Chưa chốt được — ${errMsg(e)}`, "err"); }
  }, [plan, year, flash]);

  const setAvail = async (v) => {
    const ok = await saveCfg({ ...cfg, planning: { ...(cfg.planning || {}), availability: v } });
    if (ok !== false) flash(`Hệ số sẵn sàng ${Math.round(v * 100)}%.`);
  };

  const years = [thisYear - 1, thisYear, thisYear + 1];

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
          <button onClick={() => setMode("in")} aria-pressed={mode === "in"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "in" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Nhập liệu</button>
          <button onClick={() => setMode("ov")} aria-pressed={mode === "ov"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "ov" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Tổng quan</button>
        </div>
        {dirty && <span className="text-xs text-amber-400">Chưa lưu</span>}
        {!dirty && savedAt.current && <span className="text-xs text-slate-600">Đã lưu lúc {savedAt.current}</span>}
        <span className="ml-auto font-mono text-[11px] text-slate-600">KH 1.0</span>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-900 bg-rose-950 px-4 py-3 text-sm text-rose-100">
          {err}
        </div>
      )}

      <Panel flush
        title={mode === "in" ? "Lưới kế hoạch nguồn lực" : "Tổng quan nguồn lực"}
        sub={<>Năm {year} · {weeks.length} tuần · đơn vị là số người (1 / 0,5 / 0,25)</>}
        right={busy ? <Loader2 className="shrink-0 animate-spin text-slate-500" size={16} /> : null}>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Năm" className="h-11 w-32 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100">
            {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Hệ số sẵn sàng
            <select value={avail} disabled={readOnly} onChange={(e) => setAvail(Number(e.target.value))}
              className="h-11 w-24 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 disabled:opacity-50">
              {[0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
            </select>
          </label>
          {!readOnly && (
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <button onClick={onSnapshot} title="Chụp lại lưới hiện tại để về sau so với thực tế trên bản đã chốt"
                className={`flex-1 sm:flex-none ${btnGhost}`}><Camera size={15} /> Chốt bản {snaps.length ? `(${snaps.length})` : ""}</button>
              <button onClick={() => { setDirty(false); setBusy(true); loadPlan(year).then((p) => { setPlan(fillRef.current(p)); setBusy(false); }).catch(() => setBusy(false)); }}
                className={`flex-1 sm:flex-none ${btnGhost}`}><RotateCcw size={15} /> Tải lại</button>
              <button onClick={onSave} disabled={!dirty || busy} className={`flex-1 sm:flex-none ${btnPrimary} disabled:opacity-40`}><Save size={15} /> Lưu</button>
            </div>
          )}
        </div>

        {mode === "in" ? (
          <PlanGrid plan={plan} onChange={(p) => { setPlan(p); setDirty(true); }}
            projects={projects} roles={roles} weeks={view} nWeeks={weeks.length}
            cap={cap} head={head} readOnly={readOnly} nowIndex={nowIdx} year={year} />
        ) : (
          <PlanOverview plan={plan} projects={projects} roles={roles} weeks={view}
            cap={cap} availability={avail}
            actual={actual} okWeeks={ts?.okWeeks || new Set()} nowIndex={nowIdx < 0 ? 0 : nowIdx} />
        )}
      </Panel>
    </div>
  );
}
