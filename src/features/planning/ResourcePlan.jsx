/* ARTIUS TIME v12 — Tab "Kế hoạch": khung chung, các chế độ Nhập liệu (Toàn bộ | Từng dự án), Theo dự án, So với thực tế (v13.1).
   v12.34 — bỏ chế độ Tổng quan: thiếu / dư người chỉ xem ở Dashboard › Tổng quan nguồn lực (PlanOverview.jsx đã xoá ở v13.65).
   Admin nhập và lưu; BOD và trưởng phòng chỉ xem. Dữ liệu nằm ở bảng riêng (xem planStore.js). */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, Camera, Download, Loader2, Merge, Redo2, RotateCcw, Save, Search, Undo2, X } from "lucide-react";
import { addDays, fmt, mondayOf, parseD } from "../../core/date.jsx";
import { dbTs, dbTsSent, ensureMonths, useDataTick, weekDone } from "../../core/db.jsx";
import { ROLES, isResigned } from "../../core/domain.jsx";
import { CTRL, Panel, btnGhost, btnPrimary } from "../../core/ui.jsx";
import { allocLimits } from "../../shared/alloc.jsx";
import { PER_YEAR, PLAN_YEARS, diffCells, foldMerged, joinYears, normalizeYear, planLimits, prunePlan, realWeeksOfYears, slotIndexOf, splitYears, weeksOfYears } from "./planCalc.js";
import { PlanActual } from "./PlanActual.jsx";
import { PlanGrid } from "./PlanGrid.jsx";
import { PlanProjects } from "./PlanProjects.jsx";
import { SQL_HINT, errMsg, isMissingTable, listSnapshots, loadPlan, savePlan, snapshotPlan } from "./planStore.js";

const DEFAULT_AVAIL = 0.8;
/* vai trò cơ bản tự điền cho dự án chưa có dòng nào (chỉ lấy vai trò còn tồn tại trong Thiết lập) */
const DEFAULT_ROLES = ["TK", "3D", "2D", "BIM", "MEP", "PM", "GS"];

export default function ResourcePlan({ cfg, saveCfg, flash, readOnly = false, canSaveProjects = false }) {
  const tick = useDataTick();
  const thisYear = new Date().getFullYear();
  /* v13.37 — lưới trải NHIỀU NĂM liền nhau, cuộn ngang qua tháng 12 là sang năm sau luôn,
     không còn ô chọn "cặp năm". Cửa sổ cố định: năm trước → ba năm sau. */
  const start = thisYear - 1;
  const [mode, setMode] = useState("ac");   // v13.57: mở tab Kế hoạch là vào thẳng "So với thực tế" (mục đầu tiên)
  const [viewW, setViewW] = useState(null);   // cột tuần đang ở mép trái, để hiện mốc thời gian
  const [openCal, setOpenCal] = useState(false);   // v13.44: ô lịch bấm được, chọn thẳng tháng
  const [plan, setPlan] = useState({});
  const [dirty, setDirty] = useState(false);
  /* ---------- v13.32: lùi / tiến (Ctrl + Z, Ctrl + Y) ----------
     Giữ trong bộ nhớ, không lưu lên server. Mỗi phần tử là một bản lưới đầy đủ — lưới chỉ vài nghìn số
     nên nhẹ hơn nhiều so với việc tính diff, và khi lùi thì chắc chắn về đúng trạng thái cũ.
     mergeKey: hai lần sửa liên tiếp CÙNG một ô trong vòng 800ms gộp làm một bước, để gõ "0,5"
     (qua các trạng thái 0 → 0 → 0,5) không ăn mất ba lần Ctrl + Z. */
  const planNow = useRef(plan); planNow.current = plan;   // lưới mới nhất, dùng cho lưu và cho lùi/tiến
  const HIST_MAX = 50, HIST_GAP = 800;
  const hist = useRef({ past: [], future: [], key: "", at: 0 });
  const [histN, setHistN] = useState([0, 0]);   // chỉ để nút / trạng thái vẽ lại
  const syncHist = () => setHistN([hist.current.past.length, hist.current.future.length]);
  const resetHist = useCallback(() => { hist.current = { past: [], future: [], key: "", at: 0 }; setHistN([0, 0]); }, []);
  /* mọi thay đổi lưới từ các lưới nhập đều đi qua đây */
  const editPlan = useCallback((next, mergeKey = "") => {
    const h = hist.current, now = Date.now();
    const sameRun = mergeKey && mergeKey === h.key && now - h.at < HIST_GAP;
    if (!sameRun) {
      h.past.push(planNow.current);
      if (h.past.length > HIST_MAX) h.past.shift();
    }
    h.future = []; h.key = mergeKey; h.at = now;
    setPlan(next); setDirty(true); syncHist();
  }, []);
  const undo = useCallback(() => {
    const h = hist.current;
    if (!h.past.length) return;
    h.future.push(planNow.current);
    setPlan(h.past.pop());
    h.key = ""; setDirty(true); syncHist();
  }, []);
  const redo = useCallback(() => {
    const h = hist.current;
    if (!h.future.length) return;
    h.past.push(planNow.current);
    setPlan(h.future.pop());
    h.key = ""; setDirty(true); syncHist();
  }, []);
  /* ---------- v13.32: ô đã sửa kể từ lần lưu cuối ---------- */
  const [baseline, setBaseline] = useState({});
  const baseRef = useRef(null); baseRef.current = baseline;   // bản đã lưu gần nhất, để biết năm nào cần ghi lại
  const [q, setQ] = useState("");   // v13.32: lọc nhanh dự án trên lưới nhập
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [snaps, setSnaps] = useState([]);
  const [ts, setTs] = useState(null);          // { detail, okWeeks }
  const savedAt = useRef("");

  const avail = Number(cfg.planning?.availability) > 0 ? Number(cfg.planning.availability) : DEFAULT_AVAIL;
  const YEARS = PLAN_YEARS;             // số năm trên lưới — dùng chung với So với thực tế
  const years = useMemo(() => Array.from({ length: YEARS }, (_, k) => start + k), [start]);
  /* v13.37 — nhiều năm liền nhau trên MỘT lưới cuộn ngang, chỉ số tuần nối tiếp 0 … YEARS*48-1;
     khi lưu thì tách lại, Supabase vẫn lưu từng năm một. */
  const weeks = useMemo(() => weeksOfYears(start, YEARS), [start]);
  const view = weeks;
  const realWeeks = useMemo(() => realWeeksOfYears(start, YEARS), [start]);   // các thứ Hai thật, để so giờ thực tế
  const nowIdx = slotIndexOf(start, new Date(), YEARS);
  /* v13.44 — nhảy thẳng tới tuần đầu của một tháng. Lưới nằm trong PlanGrid nên báo qua sự kiện,
     giống nút "Về tuần này". Đang ở tab khác thì chuyển về Nhập liệu rồi mới cuộn — phát hai lần
     (ngay và sau 80ms) vì lần mount đầu lưới tự cuộn về tuần này, phát lại mới ăn. */
  const gotoMonth = useCallback((y, m) => {
    const k = (y - start) * PER_YEAR + (m - 1) * 4;
    setMode("in");
    const go = () => window.dispatchEvent(new CustomEvent("artius:planGoto", { detail: k }));
    requestAnimationFrame(go);
    setTimeout(go, 80);
  }, [start]);
  /* v13.32 — ô đã sửa kể từ lần lưu cuối; tính lại khi lưới hoặc mốc đổi (vài nghìn ô, không đáng kể) */
  const changedCells = useMemo(() => diffCells(plan, baseline, weeks.length), [plan, baseline, weeks.length]);

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
  /* v13.72 — gộp vai trò áp cả vào lịch sử vai trò, để giờ quá khứ (roleOn) cũng rơi vào vai trò đã gộp */
  const planStaff = useMemo(() => staff.map((e) => {
    const m = (r) => (r && merge[r]) || r;
    const hist = Array.isArray(e.roleHistory) && e.roleHistory.some((h) => merge[h.role]) ? e.roleHistory.map((h) => ({ ...h, role: m(h.role) })) : e.roleHistory;
    return (e.role && merge[e.role]) || hist !== e.roleHistory ? { ...e, role: m(e.role), ...(hist ? { roleHistory: hist } : {}) } : e;
  }), [staff, merge]);
  const { head, cap } = useMemo(() => {
    const h = new Map();
    for (const e of planStaff) if (e.role) h.set(e.role, (h.get(e.role) || 0) + 1);
    return { head: h, cap: new Map([...h].map(([k, v]) => [k, +(v * avail).toFixed(2)])) };
  }, [planStaff, avail]);
  const statRoles = useMemo(() => { const h = new Set(totals?.hidden || []); return roles.filter((r) => !h.has(r.id)); }, [roles, totals]);

  /* dự án chưa có dòng nào → điền sẵn các vai trò cơ bản (dòng toàn 0, chưa tính là "đã sửa").
     Chỉ chạy lúc tải. v13.33: dòng toàn 0 nay cũng được lưu (prunePlan), nên gỡ bớt vai trò là giữ nguyên
     kể cả khi chưa gõ số nào — chỉ khi gỡ HẾT vai trò của một dự án thì lần mở sau mới điền lại bộ cơ bản,
     vì bảng không có cách nào ghi "dự án này cố ý không có vai trò nào". */
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
  /* v13.14 — gộp vai trò vào team chỉnh ở Nhân sự › Tác vụ › Phòng ban & vai trò; Kế hoạch chỉ đọc planning.merge */

  /* ---------- tải lưới ---------- */
  useEffect(() => {
    let alive = true;
    setBusy(true); setErr("");
    Promise.all(years.map(loadPlan))
      .then((parts) => {
        if (!alive) return;
        const loaded = fillRef.current(joinYears(parts.map((pp, k) => normalizeYear(pp, years[k]))));
        setPlan(loaded); setBaseline(loaded); resetHist();   // v13.32: mốc so sánh ô đã sửa + xoá lịch sử của cặp năm cũ
        setDirty(!readOnly && foldedRef.current);
      })
      .catch((e) => { if (alive) setErr(isMissingTable(e) ? SQL_HINT : `Chưa tải được kế hoạch — ${errMsg(e)}`); })
      .finally(() => alive && setBusy(false));
    Promise.all(years.map(listSnapshots)).then((xs) => alive && setSnaps(xs.flat())).catch(() => {});
    return () => { alive = false; };
  }, [start, years]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- giờ thực tế của năm đang xem ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const nowYm = fmt(new Date()).slice(0, 7);   // tháng chưa tới thì chưa có giờ, khỏi tải
      const yms = years.flatMap((y) => [...Array(12)].map((_, m) => `${y}-${String(m + 1).padStart(2, "0")}`)).filter((ym) => ym <= nowYm);
      await ensureMonths(yms);
      if (!alive) return;
      const detail = [];
      /* v13.46 — giờ NHÁP (chưa bấm gửi) của riêng TUẦN ĐANG CHẠY. Màn "So với thực tế" cần nó để
         giữa tuần còn nhìn được dự án nào đang lệch quân mà bù; tuần đã qua vẫn chỉ tính giờ đã gửi. */
      const draft = [];
      const curMon = fmt(mondayOf(new Date()));
      for (const ym of yms) for (const e of staff) {
        const d = dbTsSent(e.id, ym); if (!d?.rows) continue;
        for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
          if (!h) continue;
          detail.push({ empId: e.id, date, hours: Number(h), projectId: r.projectId, taskId: r.taskId });
        }
      }
      for (const ym of yms) for (const e of staff) {
        const b = dbTs(e.id, ym); if (!b?.rows) continue;
        const sent = b.sent || {};
        for (const r of b.rows) for (const [date, h] of Object.entries(r.days || {})) {
          if (!h || sent[date] || fmt(mondayOf(new Date(date))) !== curMon) continue;
          draft.push({ empId: e.id, date, hours: Number(h), projectId: r.projectId, taskId: r.taskId });
        }
      }
      /* tuần "đủ giờ": đã qua và mọi nhân sự còn làm đều đã gửi tuần đó */
      const today = fmt(mondayOf(new Date()));
      const ok = new Set();
      for (const w of realWeeks) {
        if (w.monday >= today) continue;
        const need = staff.filter((e) => (!e.resignedAt || e.resignedAt > w.monday) && (!e.startedAt || e.startedAt <= fmt(addDays(parseD(w.monday), 6))));   // v13.67: vào làm trong tuần thì tính tuần đó
        if (need.length && need.every((e) => weekDone(e.id, w.monday))) ok.add(w.monday);
      }
      if (alive) setTs({ detail, draft, okWeeks: ok });
    })();
    return () => { alive = false; };
  }, [start, years, staff, realWeeks, tick]);   // eslint-disable-line react-hooks/exhaustive-deps


  /* ---------- lưu ---------- */
  /* ---------- lưu (tự lưu sau khi ngừng gõ 2 giây, nút Lưu để ghi ngay) ----------
     Không thay lưới đang hiện bằng bản đã dọn sau khi lưu: đang gõ dở mà dòng toàn 0 biến mất thì rất khó chịu.
     Chỉ tắt cờ "chưa lưu" nếu từ lúc bắt đầu lưu tới giờ không gõ thêm gì. */
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
      /* v13.37 — lưới trải 4 năm nhưng mỗi lần lưu chỉ ghi NHỮNG NĂM THẬT SỰ ĐỔI so với lần lưu trước,
         thay vì xoá và ghi lại cả 4 năm. Lần đầu (chưa có mốc) thì ghi hết. */
      const parts = splitYears(prunePlan(snap), YEARS);
      const old = baseRef.current ? splitYears(prunePlan(baseRef.current), YEARS) : null;
      for (let k = 0; k < YEARS; k++) {
        if (old && JSON.stringify(parts[k]) === JSON.stringify(old[k])) continue;
        await savePlan(years[k], parts[k]);
      }
      if (planNow.current === snap) setDirty(false);
      setBaseline(snap);   // v13.32: ô đã sửa tính từ bản vừa lưu
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
  }, [readOnly, start, years, flash, saveErr]);   // eslint-disable-line react-hooks/exhaustive-deps
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

  const onSnapshot = useCallback(async () => {
    try {
      const label = `Chốt ${new Date().toLocaleDateString("vi-VN")}`;
      const parts = splitYears(prunePlan(plan), YEARS);
      for (let k = 0; k < YEARS; k++) await snapshotPlan(years[k], label, parts[k]);
      setSnaps((await Promise.all(years.map(listSnapshots))).flat());
      flash("Đã chốt bản kế hoạch. Từ giờ phần so với thực tế dùng bản này.");
    } catch (e) { flash(isMissingTable(e) ? SQL_HINT : `Chưa chốt được — ${errMsg(e)}`, "err"); }
  }, [plan, start, years, flash]);   // eslint-disable-line react-hooks/exhaustive-deps

  const onExport = async () => {
    try {
      const { exportPlanXlsx } = await import("./planExport.js");
      /* v13.59 — sheet "Kế hoạch vs thực tế" chạy đúng comparePlan của màn So với thực tế, khoảng "Từ khi có giờ chấm" */
      const thisMon = fmt(mondayOf(new Date()));
      const sentMon = new Set((ts?.detail || []).map((d) => fmt(mondayOf(new Date(d.date)))));
      const cmp = { weeks: realWeeks.filter((w) => w.monday < thisMon && sentMon.has(w.monday)), sent: ts?.detail || [],
        projects: everyProject, roles, staff: planStaff, hoursCfg: cfg.hours, holidays: cfg.holidays || [], lim: planLimits(cfg), hidden };
      await exportPlanXlsx({ plan: prunePlan(plan), projects: shownProjects, roles: statRoles, weeks, cap, head, realWeeks, start, years: YEARS, snaps, avail, cmp });
      flash("Đã xuất Excel kế hoạch.");
    } catch (e) { flash(`Chưa xuất được — ${errMsg(e)}`, "err"); }
  };

  const setAvail = async (v) => {
    const ok = await saveCfg({ ...cfg, planning: { ...(cfg.planning || {}), availability: v } });
    if (ok !== false) flash(`Hệ số sẵn sàng ${Math.round(v * 100)}%.`);
  };


  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
          {/* v13.57 — thứ tự: So với thực tế · Nhập liệu · Theo dự án */}
          <button onClick={() => setMode("ac")} aria-pressed={mode === "ac"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "ac" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>So với thực tế</button>
          <button onClick={() => setMode("in")} aria-pressed={mode === "in"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "in" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Nhập liệu</button>
          <button onClick={() => setMode("pj")} aria-pressed={mode === "pj"}
            className={`${CTRL} rounded-lg px-6 text-sm font-medium ${mode === "pj" ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>Theo dự án</button>
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
        sub={<>Năm {start}–{start + YEARS - 1} · {weeks.length} cột (mỗi tháng 4 tuần) · đơn vị là số người (1 / 0,5 / 0,25)</>}
        right={busy ? <Loader2 className="shrink-0 animate-spin text-slate-500" size={16} /> : null}>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
          {/* v13.37 — không còn chọn cặp năm: lưới trải thẳng {YEARS} năm, ô này HIỆN mốc thời gian đang xem.
              v13.44 — bấm vào để CHỌN THẲNG tháng, khỏi phải cuộn ngang qua mấy chục cột. */}
          <div className="relative shrink-0">
            <button aria-live="polite" aria-expanded={openCal} onClick={() => setOpenCal((v) => !v)}
              title="Bấm để chọn tháng — hoặc cuộn ngang lưới"
              className="flex h-11 w-40 items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm hover:border-slate-500">
              <CalendarRange size={15} className="shrink-0 text-slate-500" />
              {viewW
                ? <span className="font-mono text-slate-100">Tháng {viewW.m}<span className="text-slate-500">/</span>{viewW.y}</span>
                : <span className="text-slate-500">Năm {start}–{start + YEARS - 1}</span>}
            </button>
            {openCal && <>
              <div className="fixed inset-0 z-20" onClick={() => setOpenCal(false)} />
              <div className="absolute left-0 top-12 z-30 w-[268px] rounded-md border border-slate-700 bg-slate-900 p-2.5 shadow-xl">
                {years.map((y) => (
                  <div key={y} className="mb-1.5 last:mb-0">
                    <div className="mb-1 text-[10.5px] uppercase tracking-wider text-slate-500">{y}{y === thisYear ? " · năm nay" : ""}</div>
                    <div className="grid grid-cols-6 gap-1">
                      {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => {
                        const on = viewW && viewW.y === y && viewW.m === m;
                        const now = y === thisYear && m === new Date().getMonth() + 1;
                        return (
                          <button key={m} onClick={() => { gotoMonth(y, m); setOpenCal(false); }}
                            className={`h-7 rounded text-[12px] ${on ? "bg-teal-600 text-white" : now ? "border border-teal-800 text-teal-300 hover:bg-slate-800" : "text-slate-300 hover:bg-slate-800"}`}>{m}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Hệ số sẵn sàng
            <select value={avail} disabled={readOnly} onChange={(e) => setAvail(Number(e.target.value))}
              className="h-11 w-24 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 disabled:opacity-50">
              {[0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
            </select>
          </label>
          {mode === "in" && (
            <button onClick={() => window.dispatchEvent(new Event("artius:planNow"))} className={btnGhost}>Về tuần này</button>
          )}
          {/* v13.32 — lọc nhanh dự án */}
          {mode === "in" && (
            <div className="relative w-full sm:w-52">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm dự án" aria-label="Tìm dự án"
                className="h-11 w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-8 text-sm text-slate-100 placeholder:text-slate-600" />
              {q && <button onClick={() => setQ("")} aria-label="Xoá tìm" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"><X size={14} /></button>}
            </div>
          )}
          {/* v13.32 — lùi / tiến; phím tắt Ctrl + Z, Ctrl + Y làm việc ngay trong lưới */}
          {mode === "in" && !readOnly && (
            <div className="flex gap-1">
              <button onClick={undo} disabled={!histN[0]} title="Lùi một bước (Ctrl + Z)" aria-label="Lùi một bước"
                className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30`}><Undo2 size={15} className="mx-auto" /></button>
              <button onClick={redo} disabled={!histN[1]} title="Tiến một bước (Ctrl + Y)" aria-label="Tiến một bước"
                className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30`}><Redo2 size={15} className="mx-auto" /></button>
            </div>
          )}
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <button onClick={onExport} title="Xuất lưới, tổng theo vai trò, so với thực tế và các bản chốt"
              className={`flex-1 sm:flex-none ${btnGhost}`}><Download size={15} /> Xuất Excel</button>
          {!readOnly && (
            <>
              <button onClick={onSnapshot} title="Chụp lại lưới hiện tại để về sau so với thực tế trên bản đã chốt"
                className={`flex-1 sm:flex-none ${btnGhost}`}><Camera size={15} /> Chốt bản {snaps.length ? `(${snaps.length})` : ""}</button>
              <button onClick={() => { setDirty(false); setBusy(true); Promise.all(years.map(loadPlan)).then((parts) => { const l = fillRef.current(joinYears(parts.map((pp, k) => normalizeYear(pp, years[k])))); setPlan(l); setBaseline(l); resetHist(); setBusy(false); }).catch(() => setBusy(false)); }}
                className={`flex-1 sm:flex-none ${btnGhost}`}><RotateCcw size={15} /> Tải lại</button>
              <button onClick={onSave} disabled={(!dirty && !saveErr) || busy || saving} className={`flex-1 sm:flex-none ${btnPrimary} disabled:opacity-40`}><Save size={15} /> Lưu{changedCells.size > 0 ? ` (${changedCells.size})` : ""}</button>
            </>
          )}
          </div>
        </div>

        {mode === "ac" ? (
          <PlanActual plan={plan} projects={everyProject} roles={roles} start={start} realWeeks={realWeeks} hidden={hidden}
            support={Array.isArray(cfg.support) ? cfg.support : []}
            detail={ts?.detail || []} draft={ts?.draft || []} staff={planStaff} hoursCfg={cfg.hours} prole={prole} loading={!ts}
            cap={cap} lim={planLimits(cfg)} flash={flash}
            holidays={cfg.holidays || []} aLim={allocLimits(cfg)}
            onLim={readOnly ? null : async (tol, mix) => {
              const ok = await saveCfg({ ...cfg, planTol: tol, planMix: mix });
              flash(ok === false ? "Chưa lưu được ngưỡng." : "Đã lưu ngưỡng kết luận.", ok === false ? "err" : undefined);
            }} />
        ) : mode === "pj" ? (
          <PlanProjects plan={plan} projects={everyProject} roles={roles} weeks={view} nowIndex={nowIdx}
            hidden={hidden} detail={ts?.detail || []} employees={cfg.employees || []} support={Array.isArray(cfg.support) ? cfg.support : []}
            canToggle={!readOnly && canSaveProjects} onToggle={toggleActive} prole={prole} />
        ) : (
          <PlanGrid plan={plan} onChange={editPlan} onUndo={undo} onRedo={redo} canUndo={histN[0] > 0} canRedo={histN[1] > 0} changed={changedCells} query={q}
            projects={projects} hidden={hidden} onToggleHide={readOnly ? undefined : toggleHide} totals={totals} onTotals={readOnly ? undefined : onTotals} mergedOf={mergedOf} roles={roles} weeks={view} nWeeks={weeks.length}
            cap={cap} head={head} readOnly={readOnly} nowIndex={nowIdx} scrollKey={start} onViewWeek={setViewW} />
        )}
      </Panel>
    </div>
  );
}
