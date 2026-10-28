/* ARTIUS TIME v12 — Tab "Kế hoạch": khung chung, hai chế độ Nhập liệu và Tổng quan.
   Admin nhập và lưu; BOD và trưởng phòng chỉ xem. Dữ liệu nằm ở bảng riêng (xem planStore.js). */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Loader2, RotateCcw, Save } from "lucide-react";
import { fmt, mondayOf } from "../../core/date.jsx";
import { dbTsSent, ensureMonths, useDataTick, weekDone } from "../../core/db.jsx";
import { ROLES, isResigned } from "../../core/domain.jsx";
import { CTRL, Panel, btnGhost, btnPrimary } from "../../core/ui.jsx";
import { PER_YEAR, actualByCell, joinYears, normalizeYear, prunePlan, realWeeksOfPair, slotIndexOf, splitYears, weeksOfPair } from "./planCalc.js";
import { PlanGrid } from "./PlanGrid.jsx";
import { PlanOverview } from "./PlanOverview.jsx";
import { SQL_HINT, errMsg, isMissingTable, listSnapshots, loadPlan, savePlan, snapshotPlan } from "./planStore.js";

const DEFAULT_AVAIL = 0.8;
/* vai trò cơ bản tự điền cho dự án chưa có dòng nào (chỉ lấy vai trò còn tồn tại trong Thiết lập) */
const DEFAULT_ROLES = ["TK", "3D", "2D", "BIM", "MEP", "PM", "GS"];

export default function ResourcePlan({ cfg, saveCfg, flash, readOnly = false }) {
  const tick = useDataTick();
  const thisYear = new Date().getFullYear();
  const [start, setStart] = useState(thisYear);   // cặp năm đang xem: start và start + 1
  const [mode, setMode] = useState("in");
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
    Promise.all([loadPlan(start), loadPlan(start + 1)])
      .then(([a, b]) => { if (alive) { setPlan(fillRef.current(joinYears(normalizeYear(a, start), normalizeYear(b, start + 1), n1, n2))); setDirty(false); } })
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
    () => actualByCell(ts?.detail || [], staff, cfg.hours),
    [ts, staff, cfg.hours]);

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
      await exportPlanXlsx({ plan: prunePlan(plan), projects, roles, weeks, cap, head, actual, okWeeks: ts?.okWeeks || new Set(), realWeeks, start, snaps, avail });
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
          <button onClick={() => setMode("ov")} aria-pressed={mode === "ov"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "ov" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Tổng quan</button>
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
        title={mode === "in" ? "Lưới kế hoạch nguồn lực" : "Tổng quan nguồn lực"}
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

        {mode === "in" ? (
          <PlanGrid plan={plan} onChange={(p) => { setPlan(p); setDirty(true); }}
            projects={projects} roles={roles} weeks={view} nWeeks={weeks.length}
            cap={cap} head={head} readOnly={readOnly} nowIndex={nowIdx} scrollKey={start} />
        ) : (
          <PlanOverview plan={plan} projects={projects} roles={roles} weeks={view}
            cap={cap} availability={avail}
            actual={actual} realWeeks={realWeeks} okWeeks={ts?.okWeeks || new Set()} nowIndex={nowIdx < 0 ? 0 : nowIdx} />
        )}
      </Panel>
    </div>
  );
}
