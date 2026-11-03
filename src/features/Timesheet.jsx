/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Trash2, Save, AlertTriangle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CheckCircle2, Loader2, Lock, Pencil, Check, X, Copy, Unlock, Zap, Eraser, Minus,
} from "lucide-react";
import { DEFAULT_HOURS, DOW, HOLIDAY_RING_SVG, OT_ALERT, addDays, dLabel, effortHoursFor, fmt, makeHolidayIndex, minHoursFor, mondayOf, parseD, prevYm, stdHoursFor, weekDays, ymOf } from "../core/date.jsx";
import { LAST_STORAGE_ERROR, RATE_LIMITED, ck, commitTs, dbTs, ensureMonths, refreshTs, slot, useDataTick, useNet } from "../core/db.jsx";
import { DEFAULT_PHASE, LEAVE_TASKS, NO_PHASE, NO_PROJECT, OT_TASKS, activePhases, empHasProj, fmtH, groupKey, guessPhase, isIdleTask, isLeaveTask, isOtId, isOtTask, leaveInfo, leaveTypeOfTask, norm, otBandKey, otBandTasks, otMaxHours, otText, pastLocked, pastOpenUntil, pastWeeks, phaseInfo, phaseLabel, projPhaseIsOpen, roleLabel, rowKey, sortByGroup, supportInRange, supportOn, taskRoles, taskText, tasksForDept, tone } from "../core/domain.jsx";
import { CTRL, ConfirmDialog, GUT, NoteDialog, WeekPicker, btnBase, btnGhost, btnPrimary, iconBtn, selectCls } from "../core/ui.jsx";
import { DeadlineBanner } from "../shared/deadline.jsx";
import { runOtExport } from "../shared/otReport.js";   // v13.31: xuất Excel tăng ca, dùng chung với Dashboard cá nhân

/* v12.36 — nút bút chì "Sửa giờ của khối này" phát sáng nhịp nhẹ để dễ thấy.
   CSS gắn một lần lúc nạp module; màu đặt riêng cho mode sáng / tối (không trông vào LIGHT_CSS).
   Máy bật "giảm chuyển động" thì quầng sáng đứng yên. */
const PEN_CSS = `
.pen-glow{border-color:#14b8a6!important;color:#5eead4!important;background:rgba(20,184,166,.12)!important;animation:penGlow 2.4s ease-in-out infinite}
.pen-glow:hover{background:rgba(20,184,166,.24)!important;color:#99f6e4!important}
@keyframes penGlow{0%,100%{box-shadow:0 0 5px rgba(45,212,191,.30)}50%{box-shadow:0 0 0 3px rgba(45,212,191,.16),0 0 13px rgba(45,212,191,.55)}}
html[data-theme="light"] .pen-glow{border-color:#0d9488!important;color:#0f766e!important;background:#f0fdfa!important;animation-name:penGlowL}
html[data-theme="light"] .pen-glow:hover{background:#ccfbf1!important}
@keyframes penGlowL{0%,100%{box-shadow:0 0 5px rgba(13,148,136,.25)}50%{box-shadow:0 0 0 3px rgba(13,148,136,.14),0 0 12px rgba(13,148,136,.45)}}
@media (prefers-reduced-motion:reduce){.pen-glow{animation:none!important;box-shadow:0 0 8px rgba(45,212,191,.45)}}
/* v12.37 — N1: ô giờ của khối đang đóng bấm được để sửa · N3: đường gióng dòng tác vụ / tiêu đề ngày của ô đang nhập */
.ts-pick{cursor:text;border:1px solid transparent;border-radius:6px}
.ts-pick:hover{border-color:#14b8a6;background:rgba(20,184,166,.10);color:#99f6e4}
html[data-theme="light"] .ts-pick:hover{background:#f0fdfa;color:#0f766e}
.ts-row:focus-within>td{background-image:linear-gradient(rgba(45,212,191,.08),rgba(45,212,191,.08))}
html[data-theme="light"] .ts-row:focus-within>td{background-image:linear-gradient(rgba(13,148,136,.07),rgba(13,148,136,.07))}
.ts-dh.ts-on{box-shadow:inset 0 -3px 0 #14b8a6}
.ts-dh.ts-on .ts-dl{color:#5eead4!important;font-weight:600}
html[data-theme="light"] .ts-dh.ts-on .ts-dl{color:#0f766e!important}`;
if (typeof document !== "undefined" && !document.getElementById("artius-pen-glow")) {
  const st = document.createElement("style");
  st.id = "artius-pen-glow"; st.textContent = PEN_CSS;
  document.head.appendChild(st);
}

/* ============================ EMPLOYEE ============================ */
/* v13.4 — mgrOk: người có bảng công đang mở là cấp Trưởng phòng / BOD / Admin → thấy tác vụ quản lý (task.mgr).
   Tác vụ quản lý chọn được ở cả dự án lẫn "Khác"; dòng cũ đã có giờ vẫn hiện dù người đó không còn ở cấp quản lý. */
export function EmployeeArea({ cfg, empId, flash, admin = false, onDirtyChange, initialMonday = null, mgrOk = false, onOtReady }) {
  const emp = cfg.employees.find((e) => e.id === empId);
  // v2.6: bấm thông báo nhắc thì mở thẳng tuần cần gửi (?tuan=YYYY-MM-DD), đọc xong xoá khỏi thanh địa chỉ
  const [monday, setMonday] = useState(() => {
    if (initialMonday) return initialMonday;   // v5.9: mở từ Tổng quan bảng công → đúng tuần đang xem
    const t = new URLSearchParams(window.location.search).get("tuan") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      try { window.history.replaceState(null, "", window.location.pathname); } catch { /* bỏ qua */ }
      return fmt(mondayOf(parseD(t)));
    }
    return fmt(mondayOf(new Date()));
  });
  const [buckets, setBuckets] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeDay, setActiveDay] = useState(fmt(new Date()));
  const [pendingWeek, setPendingWeek] = useState(null);   // v1.9: tuần muốn chuyển tới khi còn giờ chưa gửi, chờ xác nhận
  const [askSubmit, setAskSubmit] = useState(false);      // v1.9: hỏi lại trước khi gửi, vì gửi xong là khoá
  const [reloadKey, setReloadKey] = useState(0);          // v1.9: tăng khi dữ liệu của người này vừa đổi trên server
  const dataTick = useDataTick();
  const [copying, setCopying] = useState(false);
  const [otBusy, setOtBusy] = useState(false);   // v13.29: đang dựng file Excel tăng ca
  const [savedTick, setSavedTick] = useState(0); // tăng sau mỗi lần lưu thành công, dùng làm tín hiệu làm mới lịch
  const [saveFailed, setSaveFailed] = useState(false);
  const mobileInputs = useRef([]);              // ô nhập giờ của từng dòng trên mobile
  const [noteRow, setNoteRow] = useState(null); // chỉ số dòng đang mở hộp mô tả
  const gridInputs = useRef({});                // ô nhập trên lưới desktop, khoá "dòng:cột"
  const pendingFocus = useRef(null);            // v12.37 N1: { key: rowKey, k } — ô cần đặt con trỏ sau khi khối vừa mở
  const taskSel = useRef({});                   // ô chọn hạng mục của từng dòng, để nhảy con trỏ vào sau khi bấm +
  const otSel = useRef({});                     // v4.9: ô "Tăng ca cho tác vụ" của từng dòng tăng ca
  // báo lên App để chặn đổi tab khi còn thay đổi chưa lưu
  const [undoRow, setUndoRow] = useState(null);
  const [addSheet, setAddSheet] = useState(null);   // v8.4 (điện thoại): bảng trượt Thêm dự án / tác vụ { pid, ph, picked: [] }
  const [menuKey, setMenuKey] = useState(null);     // v8.4 (điện thoại): khối đang mở menu ⋯
  /* v9.0 (điện thoại): ngày đang xem chỉ hiện tác vụ có giờ của CHÍNH ngày đó; ngày chưa chấm thì trống.
     dayKeys = tác vụ vừa thêm / vừa sửa trong ngày đang xem (giữ hiện kể cả khi bớt về 0), xoá khi đổi ngày / đổi tuần. */
  const [dayKeys, setDayKeys] = useState(() => new Set());
  useEffect(() => { setDayKeys(new Set()); }, [activeDay, monday]);
  const [showSplit, setShowSplit] = useState(false); // v3.7: chân bảng — mở/thu gọn 3 hàng Giờ chuẩn · OT · Giờ cố gắng // khối/dòng vừa xoá { rows, at, label }, giữ lại để hoàn tác
  /* v3.2 — khối đang MỞ (đang nhập giờ): hiện toàn bộ hạng mục của dự án để gõ giờ thẳng vào, không chọn từ danh sách.
     Bấm ✓ thì khối thu gọn, chỉ giữ hạng mục có giờ, và giờ được tạm lưu trên máy (localStorage) tới khi Gửi. */
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [q, setQ] = useState("");               // ô thêm nhanh: chuỗi đang gõ
  const [qOpen, setQOpen] = useState(false);
  const [qIdx, setQIdx] = useState(0);          // mục đang được chọn trong danh sách gợi ý
  const [qProj, setQProj] = useState("");       // lọc theo dự án, rỗng = tất cả
  const [qPhase, setQPhase] = useState(null);   // lọc theo giai đoạn, null = để guessPhase tự đoán
  const qInput = useRef(null);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidayMap = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const holidaySet = holidayMap; // cùng một bộ tra cứu, có sẵn cả has() lẫn get()

  const days = useMemo(() => weekDays(monday), [monday]);
  const yms = useMemo(() => [...new Set(days.map(ymOf))], [days]);
  const isSent = (d) => !!buckets[ymOf(d)]?.sent?.[d];
  const pastLk = (d) => !admin && pastLocked(cfg, empId, d);   // v8.6: quá hạn chấm công
  const dayLocked = (d) => !admin && (isSent(d) || pastLocked(cfg, empId, d));
  /* v2.3 — Nhân sự không chấm giờ làm việc cho ngày chưa tới (sau hôm nay). Vắng mặt (nghỉ phép…) thì vẫn
     đăng ký trước được. Quản lý không bị giới hạn. Database cũng chặn (artius_ts_guard). */
  const todayKey = fmt(new Date());
  const futureBlocked = (r, d) => !admin && ((d > todayKey && !isLeaveTask(r.taskId)) || supBlocked(r, d));   // v8.7: + ngày ngoài thời gian hỗ trợ
  // v2.7 — cột hôm nay nền sáng hơn một chút, ngày tương lai mờ đi; ngày đã qua giữ nguyên
  const dayCol = (d) => (d === todayKey ? "bg-slate-800/70" : d > todayKey ? "opacity-50" : "");
  const sendTotal = (d) => rows.reduce((s, r) => s + (futureBlocked(r, d) ? 0 : (r.days[d] || 0)), 0);
  /* v1.9 — Dự án đã đóng (hoặc đã xoá) thì nhân sự không chấm công vào được nữa: dòng của dự án đó chỉ để xem.
     Cần chấm thêm thì quản lý mở lại dự án. Quản lý vẫn sửa được ở Chi tiết nhân viên. Database cũng chặn. */
  /* v2.5 — Nhân sự chỉ chấm vào giai đoạn ĐÃ CÓ giờ dự kiến (> 0) của dự án. Giai đoạn chưa nhập giờ dự kiến thì không hiện;
     dự án chưa nhập giờ dự kiến ở giai đoạn nào thì không hiện. Dòng cũ rơi vào giai đoạn đó chỉ để xem, giống dự án đã đóng.
     Quản lý không bị giới hạn. Database cũng chặn (artius_ts_guard). */
  const phaseOpen = (pid, ph) => !!phaseInfo(ph)?.active && (admin || projPhaseIsOpen(cfg.projects.find((p) => p.id === pid), ph));
  // giai đoạn quản lý đang mở của dự án (không tính quyền quản lý) — dùng để tự chọn sẵn giai đoạn khi chọn dự án
  const setOpenPhases = (pid) => activePhases().filter((ph) => projPhaseIsOpen(cfg.projects.find((p) => p.id === pid), ph.id) && supPhaseOk(pid, ph.id));
  // v8.7: dự án nhân sự đang HỖ TRỢ (không được giao chính thức) trong tuần đang xem
  const supWeek = (pid) => (admin || !pid || pid === NO_PROJECT || empHasProj(emp, pid) ? [] : supportInRange(cfg, empId, pid, days[0], days[6]));
  const isSupProj = (pid) => supWeek(pid).length > 0;
  const supUntil = (pid) => supWeek(pid).reduce((m, x) => (x.until > m ? x.until : m), "");
  const supBlocked = (r, d) => isSupProj(r.projectId) && !supportOn(cfg, empId, r.projectId, d, r.phaseId || DEFAULT_PHASE);   // ngoài thời gian hỗ trợ
  const supPhaseOk = (pid, ph) => { const w = supWeek(pid); return !w.length || w.some((x) => !x.phase || x.phase === ph); };
  const openPhasesOf = (pid) => activePhases().filter((ph) => phaseOpen(pid, ph.id) && supPhaseOk(pid, ph.id));
  const fitPhase = (pid, ph) => (pid === NO_PROJECT || phaseOpen(pid, ph) ? ph : openPhasesOf(pid)[0]?.id || ph);
  const projClosed = (r) => !admin && r.projectId !== NO_PROJECT && r.projectId !== ""
    && (!cfg.projects.some((p) => p.id === r.projectId && p.active) || (r.phaseId !== NO_PHASE && !phaseOpen(r.projectId, r.phaseId || DEFAULT_PHASE)));
  // v3.0 — dòng đã chọn đủ Dự án (+ Giai đoạn nếu là dự án) + Hạng mục thì mới nhập giờ / lưu được
  // v3.1: dự án chỉ mở đúng một giai đoạn và khối đang ở giai đoạn đó → nhân sự không cần (không được) đổi
  const phaseFixed = (g) => { if (admin) return false; const o = openPhasesOf(g.projectId); return o.length === 1 && o[0].id === g.phaseId; };
  /* v4.9: dòng tăng ca phải chọn "Tăng ca cho tác vụ" (otFor) mới nhập giờ / gửi được.
     Quản lý vẫn sửa được dòng tăng ca cũ (trước v4.9, chưa có otFor) đang có giờ. */
  const rowReady = (r) => r.projectId !== "" && !!r.taskId && (r.projectId === NO_PROJECT || r.phaseId !== NO_PHASE)
    && (!isOtId(r.taskId) || !!r.otFor || (admin && days.some((d) => (r.days[d] || 0) > 0)));
  const dayTotal = (d) => rows.reduce((s, r) => s + (r.days[d] || 0), 0);
  const dayName = (d) => `${DOW[(parseD(d).getDay() + 6) % 7]} ${dLabel(d)}`;
  /* v6.9 — nhân sự chỉ thấy các dự án quản lý đã giao (Nhân sự → "Dự án đang tham gia"). Chưa giao dự án nào = chỉ chấm Việc chung / vắng mặt.
     Quản lý sửa bảng công của người khác thì vẫn thấy mọi dự án. Dòng cũ của dự án không còn được giao vẫn hiện để xem / sửa giờ đã có. */
  const assignedP = new Set(emp?.allProjects ? cfg.projects.map((p) => p.id) : Array.isArray(emp?.projects) ? emp.projects : []);   // v8.8: Tất cả dự án
  const activeProjects = cfg.projects.filter((p) => p.active && (admin || (openPhasesOf(p.id).length > 0 && (assignedP.has(p.id) || isSupProj(p.id)))));
  // Chỉ hiện hạng mục thuộc bộ phận của nhân sự — bớt danh sách dài và tránh chấm nhầm việc của bộ phận khác
  /* v13.6 — tác vụ Teamleader (task.tl): chỉ người có vai trò cấp Teamleader thấy (role.tl; chưa tích thì mã bắt đầu TL) */
  const tlOk = useMemo(() => { const r = (cfg.roles || []).find((x) => x.id === emp?.role); return !!r && (typeof r.tl === "boolean" ? r.tl : /^TL/i.test(r.id)); }, [cfg.roles, emp?.role]);
  const myTasks = useMemo(() => tasksForDept(cfg.tasks, emp?.dept, emp?.role).filter((t) => (!t.mgr || mgrOk) && (!t.tl || tlOk)), [cfg.tasks, emp?.dept, emp?.role, mgrOk, tlOk]);
  /* tác vụ theo cấp (quản lý, teamleader): chọn được ở cả dự án lẫn "Khác" */
  const mgrIds = useMemo(() => new Set(cfg.tasks.filter((t) => t.mgr || t.tl).map((t) => t.id)), [cfg.tasks]);
  /* v2.9 — "Khác" (projectId = NO_PROJECT, không có giai đoạn) gồm tác vụ chung của công ty (không gắn vai trò) và vắng mặt.
     Dự án thật chỉ chọn được tác vụ gắn vai trò. Giờ cũ đã chấm tác vụ chung dưới một dự án vẫn giữ nguyên. */
  const commonIds = useMemo(() => new Set(cfg.tasks.filter((t) => taskRoles(t).length === 0).map((t) => t.id)), [cfg.tasks]);
  const isKhacTask = (id) => isLeaveTask(id) || commonIds.has(id);
  /* dòng thuộc "Khác": vắng mặt, tác vụ chung; tác vụ quản lý thì theo đúng dự án đã chấm */
  const khacRow = (r) => isLeaveTask(r.taskId) || (commonIds.has(r.taskId) && !(mgrIds.has(r.taskId) && r.projectId && r.projectId !== NO_PROJECT));
  const commonTasks = myTasks.filter((t) => commonIds.has(t.id));
  const taskOrder = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t, k) => [t.id, k])), [cfg.tasks]);
  const projTasks = myTasks.filter((t) => !commonIds.has(t.id) || mgrIds.has(t.id));
  /* v13.5 — tác vụ quản lý đứng thành nhóm "Quản lý" riêng, không lẫn vào Công việc chung / Công việc dự án */
  const mgrTasks = myTasks.filter((t) => t.mgr);
  const tlTasks = myTasks.filter((t) => t.tl);
  const commonPlain = commonTasks.filter((t) => !t.mgr && !t.tl);
  const projPlain = projTasks.filter((t) => !t.mgr && !t.tl);
  const MGR_CHIP = "#a78bfa";
  const TL_CHIP = "#f59e0b";
  // v4.9: khung giờ tăng ca (hạng mục [OT]) và các tác vụ dự án chọn được làm "Tăng ca cho tác vụ"
  const otBands = otBandTasks();   // v6.3: khung giờ chung từ Thiết lập → Tăng ca, mọi vai trò như nhau
  const otTargets = projTasks.filter((t) => !isOtTask(t));
  const taskById = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes, cfg.otBands, cfg.otLegacy]);
  const projName = (id) => cfg.projects.find((p) => p.id === id)?.name || "(dự án đã xoá)";
  // Tên kèm mã, dùng ở chỗ cần nhận diện nhanh bằng mã số
  const projFull = (id) => { if (id === NO_PROJECT) return "Khác"; const p = cfg.projects.find((x) => x.id === id); return p ? `${p.code ? `[${p.code}] ` : ""}${p.name}` : "(dự án đã xoá)"; };
  const taskName = (id) => { const t = taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  /* ---------- v3.2: khối mở / thu gọn ---------- */
  const poolFor = (pid) => (pid === NO_PROJECT ? [...commonTasks, ...LEAVE_TASKS] : projTasks);
  const rowHasHours = (r) => days.some((d) => (r.days[d] || 0) > 0);
  const canClear = (r) => !projClosed(r) && days.some((d) => r.days[d] > 0 && !dayLocked(d) && !futureBlocked(r, d));
  // Bảo đảm mọi hạng mục của dự án đều có dòng trong các khối `keys` (dòng trống chưa có giờ), theo đúng thứ tự danh sách tác vụ
  const expandIn = (list, keys) => {
    const out = []; const done = new Set();
    for (const r of list) {
      const k = groupKey(r);
      if (!keys.has(k) || r.projectId === "") { out.push(r); continue; }
      if (done.has(k)) continue;
      done.add(k);
      const mine = list.filter((x) => groupKey(x) === k);
      if (projClosed(r)) { out.push(...mine); continue; }
      const pool = poolFor(r.projectId).filter((t) => !isOtTask(t));   // v4.9: dòng tăng ca chỉ tạo bằng nút "+ Thêm dòng tăng ca"
      const byTask = new Map(mine.filter((x) => !isOtId(x.taskId)).map((x) => [x.taskId, x]));
      for (const t of pool) out.push(byTask.get(t.id) || { projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: t.id, note: "", days: {} });
      for (const x of mine) if (isOtId(x.taskId) || !pool.some((t) => t.id === x.taskId)) out.push(x);   // dòng tăng ca + hạng mục cũ ngoài danh sách vẫn giữ
    }
    return out;
  };
  // Thu gọn: bỏ các dòng chưa có giờ trong những khối `keys`
  const collapseIn = (list, keys) => list.filter((r) => !keys.has(groupKey(r)) || r.projectId === "" || rowHasHours(r));
  // Tạm lưu trên máy này: chỉ giờ của ngày chưa gửi. Gửi thành công thì xoá. Quản lý không dùng.
  const draftKeyOf = (m) => `artius_draft_${empId}_${m}`;
  const writeDraft = (list) => {
    if (admin) return;
    try {
      const keep = list.filter((r) => rowReady(r) && days.some((d) => !isSent(d) && r.days[d] > 0))
        .map((r) => ({ projectId: r.projectId, phaseId: r.phaseId, taskId: r.taskId, ...(r.otFor ? { otFor: r.otFor } : {}), note: r.note || "", days: r.days }));
      if (keep.length) localStorage.setItem(draftKeyOf(monday), JSON.stringify(keep));
      else localStorage.removeItem(draftKeyOf(monday));
    } catch { /* trình duyệt chặn lưu trữ: vẫn giữ trên màn hình như cũ */ }
  };
  const doneGroup = (gk) => {
    const g0 = rows.find((r) => groupKey(r) === gk);
    const next = collapseIn(rows, new Set([gk]));
    setRows(next);
    setOpenKeys((s) => { const n = new Set(s); n.delete(gk); return n; });
    gridInputs.current = {}; mobileInputs.current = [];
    writeDraft(next);
    if (!next.some((r) => groupKey(r) === gk)) flash("Khối này chưa có giờ nào nên đã bỏ khỏi bảng.", "err");
    else flash(`Đã tạm lưu giờ ${g0 ? projFull(g0.projectId) : ""}. Thêm tác vụ cho dự án khác, xong hết thì bấm Gửi giờ công.`);
  };
  // v8.9 (điện thoại): thu gọn khối đang mở — chỉ giữ tác vụ có giờ, tạm lưu trên máy, không báo gì thêm
  const foldGroup = (gk) => {
    if (!rows.some((r) => groupKey(r) === gk && rowHasHours(r))) { flash("Khối này chưa có giờ nào — nhập giờ trước khi thu gọn.", "err"); return; }
    const next = collapseIn(rows, new Set([gk]));
    setRows(next);
    setOpenKeys((s2) => { const n = new Set(s2); n.delete(gk); return n; });
    gridInputs.current = {}; mobileInputs.current = [];
    writeDraft(next);
  };
  const editGroup = (gk) => {
    setRows(expandIn(rows, new Set([gk])));
    setOpenKeys((s) => new Set([...s, gk]));
  };
  /* v12.37 N1 — khối vừa mở do bấm vào ô giờ: đặt con trỏ vào đúng ô đó (chỉ số dòng đổi sau khi mở nên tìm lại theo rowKey) */
  useEffect(() => {
    const p = pendingFocus.current; if (!p) return;
    const i = rows.findIndex((r) => rowKey(r) === p.key);
    const el = i >= 0 ? gridInputs.current[`${i}:${p.k}`] : null;
    if (el) { pendingFocus.current = null; el.focus(); el.select?.(); }
  }, [rows, openKeys]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* v12.37 N3 — đường gióng: tô tiêu đề ngày của ô đang nhập (dòng tác vụ tô bằng CSS :focus-within) */
  const markDay = (k) => {
    document.querySelectorAll(".ts-dh.ts-on").forEach((x) => x.classList.remove("ts-on"));
    if (k >= 0) document.querySelectorAll(`.ts-dh[data-dk="${k}"]`).forEach((x) => x.classList.add("ts-on"));
  };
  const delGroup = (gk) => {
    const at = rows.findIndex((r) => groupKey(r) === gk);
    const mine = rows.filter((r) => groupKey(r) === gk);
    const next = rows.filter((r) => groupKey(r) !== gk);
    if (mine.some(rowHasHours)) setUndoRow({ rows: mine, at, label: projFull(mine[0].projectId), open: openKeys.has(gk) });
    setRows(next);
    setOpenKeys((s) => { const n = new Set(s); n.delete(gk); return n; });
    gridInputs.current = {}; mobileInputs.current = [];
    writeDraft(next);
    setDirty(true);
  };
  // Nhóm hiển thị trong một khối: dự án → Công việc dự án / Tăng ca; Khác → Công việc chung / Vắng mặt
  const sectionsOf = (g, open = false) => {
    const khac = g.projectId === NO_PROJECT;
    const s2 = khac
      ? [{ label: "Công việc chung", chip: "#2dd4bf", items: [] }, { label: "Teamleader", chip: TL_CHIP, items: [] }, { label: "Quản lý", chip: MGR_CHIP, items: [] }, { label: "Vắng mặt", chip: "#38bdf8", items: [] }]
      : [{ label: "Công việc dự án", noHead: true, items: [] }, { label: "Teamleader", chip: TL_CHIP, items: [] }, { label: "Quản lý", chip: MGR_CHIP, items: [] }, { label: "Tăng ca", ot: true, items: [] }];   // v6.2: bỏ chữ "Công việc dự án"
    for (const it of g.items) {
      const t = taskById.get(it.r.taskId);
      const lv = t?.tl ? 1 : t?.mgr ? 2 : 0;   // v13.5 nhóm Quản lý · v13.6 nhóm Teamleader
      s2[khac ? (isLeaveTask(it.r.taskId) ? 3 : lv) : (isOtTask(t) ? 3 : lv)].items.push(it);
    }
    // v4.4: hạng mục hiện theo thứ tự quản lý sắp ở tab Tác vụ (kéo thả); hạng mục không còn trong danh sách xếp cuối
    for (const x of s2) x.items.sort((a, b) => (taskOrder.get(a.r.taskId) ?? 1e9) - (taskOrder.get(b.r.taskId) ?? 1e9));
    // v4.9: khối dự án đang mở luôn hiện nhóm Tăng ca (kể cả chưa có dòng) để có nút "+ Thêm dòng tăng ca"
    return s2.filter((x) => x.items.length || (open && x.ot && otBands.length > 0));
  };
  // v4.4: mô tả ngắn quản lý ghi cho tác vụ — hiện dưới tên hạng mục khi khối đang mở để nhập giờ
  const rowDesc = (r) => (taskById.get(r.taskId)?.desc || "").trim();
  const rowLabel = (r, open) => {
    const t = taskById.get(r.taskId);
    if (!t) return "(tác vụ đã xoá)";
    if (isOtTask(t)) return `Tăng ca ${otText(t)} · ${r.otFor ? taskName(r.otFor) : "chưa rõ tác vụ"}`;
    const inPool = poolFor(r.projectId).some((x) => x.id === r.taskId);
    return `${isLeaveTask(r.taskId) ? t.name : taskText(t)}${inPool ? "" : commonIds.has(r.taskId) ? " (tác vụ chung — dữ liệu cũ)" : " (ngoài bộ phận)"}`;
  };

  useEffect(() => { if (!days.includes(activeDay)) setActiveDay(days[0]); }, [monday]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await ensureMonths([...yms, prevYm(yms[0])]);   // tuần cũ hơn 6 tháng: tải tháng đó trước (kể cả tháng trước để Chép tuần trước dùng)
      const loaded = {};
      for (const ym of yms) loaded[ym] = dbTs(empId, ym) || { rows: [], weeks: {} };
      if (!alive) return;
      setBuckets(loaded);
      const map = new Map();
      for (const ym of yms) for (const r of loaded[ym].rows) {
        // dữ liệu cũ chưa có giai đoạn: suy từ nhóm của hạng mục thay vì gán bừa một giá trị
        const phaseId = r.phaseId || guessPhase(r.taskId, cfg.tasks);
        const k = rowKey({ ...r, phaseId });
        const cur = map.get(k) || { projectId: r.projectId, phaseId, taskId: r.taskId, ...(r.otFor ? { otFor: r.otFor } : {}), note: "", days: {} };
        if (r.note && !cur.note) cur.note = r.note; // ghi chú lưu theo dòng, tuần nào cũng dùng chung dòng đó
        for (const d of days) if (r.days?.[d] != null) cur.days[d] = r.days[d];
        map.set(k, cur);
      }
      // v3.2: giờ đã tạm lưu (bấm ✓) trên máy này mà chưa gửi thì khôi phục lại, chỉ cho ngày chưa gửi
      let restored = 0;
      if (!admin) {
        try {
          const dr = JSON.parse(localStorage.getItem(`artius_draft_${empId}_${monday}`) || "null");
          if (Array.isArray(dr)) for (const x of dr) {
            if (!x || typeof x !== "object" || !x.days) continue;
            const k = rowKey(x);
            const cur = map.get(k) || { projectId: x.projectId, phaseId: x.phaseId || DEFAULT_PHASE, taskId: x.taskId, ...(x.otFor ? { otFor: x.otFor } : {}), note: "", days: {} };
            for (const d of days) {
              const v = Number(x.days[d]) || 0;
              if (v > 0 && !loaded[ymOf(d)]?.sent?.[d] && !(!admin && pastLocked(cfg, empId, d)) && cur.days[d] !== v) { cur.days[d] = v; restored += 1; }
            }
            if (x.note && !cur.note) cur.note = x.note;
            map.set(k, cur);
          }
        } catch { /* bản tạm hỏng: bỏ qua */ }
      }
      const got = sortByGroup([...map.values()].filter((r) => days.some((d) => r.days[d] > 0)));
      /* v8.0 — tuần còn trống: tự mở sẵn một khối "Thêm tác vụ" (Dự án · Giai đoạn · Hạng mục để trống) cho nhân viên chọn ngay,
         không cần bấm nút. Khối trống không tính là "chưa lưu" và không được gửi nếu không nhập giờ. Quản lý sửa hộ thì không tự thêm. */
      setRows(got.length || admin ? got : [{ projectId: "", phaseId: NO_PHASE, taskId: "", note: "", days: {} }]);
      setOpenKeys(new Set()); setUndoRow(null);
      setDirty(restored > 0); setLoading(false);
      if (restored > 0) flash("Đã khôi phục giờ tạm lưu chưa gửi trên máy này. Kiểm tra lại rồi bấm Gửi giờ công.");
    })();
    return () => { alive = false; };
  }, [empId, monday, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* v1.9 — Dữ liệu của đúng người này, đúng các tháng đang xem vừa đổi trên server (ví dụ quản lý vừa mở khoá):
     nạp lại màn hình. Đang nhập dở thì KHÔNG nạp lại, để khỏi mất giờ vừa gõ; lúc bấm Gửi app sẽ đọc lại bản mới nhất. */
  useEffect(() => {
    if (dirty || saving || loading) return;
    const stale = yms.some((ym) => JSON.stringify(dbTs(empId, ym) || { rows: [], weeks: {} }) !== JSON.stringify(buckets[ym] || { rows: [], weeks: {} }));
    if (stale) setReloadKey((k) => k + 1);
  }, [dataTick]); // eslint-disable-line react-hooks/exhaustive-deps


  // Đưa con trỏ về ô giờ đầu tiên của một dòng — dùng chung cho desktop và mobile
  const focusRow = (i, what = "hours") => {
    const el = what === "task" ? taskSel.current[i] : (gridInputs.current[`${i}:0`] || mobileInputs.current[i]);
    if (!el) return;
    el.focus(); el.select?.();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  /* Thêm một dòng từ tổ hợp dự án + giai đoạn + hạng mục.
     Nếu tổ hợp đã có thì KHÔNG tạo dòng thứ hai — vì rowKey trùng nhau sẽ bị gộp lúc tải lại,
     làm giờ công nhảy số. Thay vào đó nhảy tới đúng dòng đang có. */
  const addCombo = (c, focus = "hours") => {
    const key = rowKey({ projectId: c.projectId, phaseId: c.phaseId || DEFAULT_PHASE, taskId: c.taskId });
    const at = rows.findIndex((r) => rowKey(r) === key);
    if (at >= 0) { flash("Dòng này đã có trong tuần, con trỏ đã nhảy tới đó.", "err"); focusRow(at); return; }
    const row = { projectId: c.projectId, phaseId: c.phaseId || DEFAULT_PHASE, taskId: c.taskId, note: "", days: {} };
    // cùng dự án + giai đoạn thì chèn ngay dưới dòng cuối của nhóm đó, không đẩy xuống cuối bảng
    let last = -1;
    rows.forEach((r, k) => { if (groupKey(r) === groupKey(row)) last = k; });
    const at2 = last >= 0 ? last + 1 : rows.length;
    const next = [...rows]; next.splice(at2, 0, row);
    setRows(next);
    setDirty(true); setQ(""); setQOpen(false); setQIdx(0);
    setTimeout(() => focusRow(at2, focus), 30); // đợi React commit xong mới có ô để focus
  };

  /* Nút + ở đầu mỗi khối: thêm một hạng mục nữa vào đúng dự án + giai đoạn đó.
     Chọn sẵn hạng mục đầu tiên chưa dùng trong khối rồi đưa con trỏ vào ô chọn,
     bấm phím là đổi được ngay, không phải quay lại ô tìm kiếm. */
  const addTaskToGroup = (g) => {
    const pool = (g.projectId === NO_PROJECT ? [...commonTasks, ...LEAVE_TASKS] : projTasks).filter((t) => !isOtTask(t));
    const used = new Set(g.items.map(({ r }) => r.taskId));
    const t = pool.find((x) => !used.has(x.id));
    if (!t) return flash("Khối này đã dùng hết hạng mục có thể chọn.", "err");
    addCombo({ projectId: g.projectId, phaseId: g.phaseId, taskId: t.id }, "task");
  };

  /* v4.9 — "+ Thêm dòng tăng ca" trong khối dự án: tạo dòng tăng ca trống (khung giờ đầu tiên chưa có dòng trống),
     nhân sự chọn "Tăng ca cho tác vụ" rồi mới nhập giờ. Mỗi khung giờ chỉ có một dòng trống cùng lúc (tránh trùng rowKey). */
  const addOtRow = (g) => {
    // v5.0: khung giờ lần lượt — dòng thứ nhất là khung đầu (17:30 – 21:00), dòng sau lấy khung kế tiếp, hết thì quay lại từ đầu
    const nOt = rows.filter((r) => groupKey(r) === g.key && isOtId(r.taskId) && (r.days[activeDay] > 0 || r.fresh === activeDay || dayKeys.has(rowKey(r)))).length;   // v9.2: đếm theo ngày đang xem
    const order = otBands.map((_, k) => otBands[(nOt + k) % otBands.length]);
    const freeBand = order.find((t) => !rows.some((r) => groupKey(r) === g.key && !r.otFor && isOtId(r.taskId) && otBandKey(taskById.get(r.taskId) || t) === otBandKey(t)));
    if (!freeBand) return flash("Chọn tác vụ cho dòng tăng ca đang trống trước đã.", "err");
    const row = { projectId: g.projectId, phaseId: g.phaseId || DEFAULT_PHASE, taskId: freeBand.id, otFor: "", note: "", days: {}, fresh: activeDay };   // v9.2: fresh = dòng mới tạo ở ngày đang xem (điện thoại), không lưu lên server
    let last = -1;
    rows.forEach((r, k) => { if (groupKey(r) === g.key) last = k; });
    const at = last >= 0 ? last + 1 : rows.length;
    const next = [...rows]; next.splice(at, 0, row);
    gridInputs.current = {}; mobileInputs.current = []; taskSel.current = {};
    setRows(next); setDirty(true);
    setTimeout(() => { const el = otSel.current[at]; if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); } }, 30);
  };

  /* v4.9 — hai ô của dòng tăng ca khi khối đang mở: "Tăng ca cho tác vụ" + khung giờ.
     Dòng đang có giờ của ngày đã gửi thì không đổi được (database cũng chặn). */
  const otPickCls = `${CTRL} min-w-0 rounded-md border bg-slate-900 px-2 text-sm focus:border-teal-500 focus:outline-none disabled:opacity-60`;
  const otPickers = (r, i, mobile = false) => {
    const lockedRow = rowLocked(r);
    return (
      <div className={mobile ? "grid grid-cols-[3fr_2fr] gap-2" : "flex min-w-0 flex-1 gap-2"}>
        <select ref={(el) => { otSel.current[i] = el; }} disabled={lockedRow} value={r.otFor || ""} onChange={(e) => upd(i, { otFor: e.target.value })}
          title="Tăng ca cho tác vụ" aria-label="Tăng ca cho tác vụ"
          className={`${otPickCls} ${mobile ? "w-full" : "flex-[3]"} ${r.otFor ? "border-teal-900 text-slate-100" : "border-amber-700/70 text-amber-300"}`}>
          <option value="">Tăng ca cho tác vụ…</option>
          {otTargets.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
          {r.otFor && !otTargets.some((t) => t.id === r.otFor) && <option value={r.otFor}>{taskName(r.otFor)}</option>}
        </select>
        <select disabled={lockedRow} value={r.taskId} onChange={(e) => upd(i, { taskId: e.target.value })}
          title="Khung giờ tăng ca" aria-label="Khung giờ tăng ca"
          className={`${otPickCls} ${mobile ? "w-full" : "flex-[2]"} border-teal-900 text-teal-300`}>
          {(() => {
            // dòng đang giữ hạng mục [OT] của vai trò khác nhưng cùng khung giờ: hiện đúng hạng mục đó ở vị trí khung tương ứng
            const cur = taskById.get(r.taskId), ck = cur ? otBandKey(cur) : "";
            const list = otBands.map((t) => (cur && otBandKey(t) === ck ? cur : t));
            if (cur && !list.some((t) => t.id === cur.id)) list.push(cur);
            return list.map((t) => <option key={t.id} value={t.id}>{otText(t)}</option>);
          })()}
        </select>
      </div>
    );
  };

  // Nút "Thêm dòng" nay chỉ đưa con trỏ về ô thêm nhanh; dòng được tạo từ ô đó hoặc từ chip
  /* v3.0 — "Thêm dòng" tạo một khối TRỐNG ở cuối bảng: Dự án, Giai đoạn, Hạng mục đều để trống, người dùng tự chọn.
     Mỗi lúc chỉ có một khối trống; thêm hạng mục vào khối đã có thì dùng nút + ở đầu khối. */
  const focusQuick = () => {
    if (rows.some((r) => r.projectId === "")) { flash("Chọn dự án cho khối đang trống trước đã.", "err"); return; }
    // v3.2: khối đang mở thì tự bấm ✓ giúp (thu gọn + tạm lưu) trước khi tạo khối mới
    // v8.1: chỉ thu gọn khối đang mở ĐÃ có giờ; khối đang mở chưa nhập giờ nào thì giữ nguyên (vẫn mở) và thêm khối mới bên dưới
    const withHrs = new Set([...openKeys].filter((k) => rows.some((r) => groupKey(r) === k && rowHasHours(r))));
    const base = withHrs.size ? collapseIn(rows, withHrs) : rows;
    if (withHrs.size) writeDraft(base);
    setOpenKeys(new Set([...openKeys].filter((k) => !withHrs.has(k))));
    gridInputs.current = {}; mobileInputs.current = [];
    setRows([...base, { projectId: "", phaseId: NO_PHASE, taskId: "", note: "", days: {} }]); setDirty(true);
  };

  /* Tính dòng mới ngoài setRows rồi mới ghi state — không đặt side effect trong hàm cập nhật,
     vì React có thể gọi hàm đó nhiều lần và flash sẽ bắn sai. */
  const upd = (i, patch) => {
    const cur = rows[i];
    if (!cur) return;
    const next = { ...cur, ...patch };
    // dòng vắng mặt không thuộc dự án nào; chuyển ngược lại thì trả về dự án đầu tiên đang mở
    if (patch.taskId !== undefined) {
      if (isKhacTask(next.taskId) && next.projectId === NO_PROJECT) next.phaseId = DEFAULT_PHASE;
      else if (isLeaveTask(next.taskId)) { next.projectId = NO_PROJECT; next.phaseId = DEFAULT_PHASE; }
      else if (next.projectId === NO_PROJECT && !isKhacTask(next.taskId)) { next.projectId = activeProjects[0]?.id || ""; next.phaseId = fitPhase(next.projectId, next.phaseId || DEFAULT_PHASE); }
    }
    // sửa dropdown thành trùng một dòng khác cũng tạo rowKey trùng — chặn tại đây
    const dup = rows.findIndex((y, k) => k !== i && rowKey(y) === rowKey(next));
    if (dup >= 0 && isOtId(next.taskId) && !rowHasHours(cur)) {
      // v9.2: dòng tăng ca mới chọn trùng tác vụ + khung giờ của dòng đã có (ngày khác) → gộp vào dòng đó, bỏ dòng mới
      const keep = { ...rows[dup], fresh: activeDay };
      setRows(rows.map((x, j) => (j === dup ? keep : x)).filter((_, j) => j !== i));
      setDayKeys((s2) => new Set([...s2, rowKey(keep)]));
      gridInputs.current = {}; mobileInputs.current = []; taskSel.current = {};
      setDirty(true);
      return;
    }
    if (dup >= 0) return flash("Đã có dòng cho tổ hợp này rồi.", "err");
    setRows((r) => r.map((x, j) => (j === i ? next : x)));
    setDirty(true);
  };

  /* Chép cơ cấu dòng (dự án + hạng mục + ghi chú) của tuần liền trước sang tuần đang xem.
     Chỉ chép khung, KHÔNG chép số giờ — giờ công vẫn phải tự nhập cho đúng thực tế. */
  const copyPrevWeek = async () => {
    setCopying(true);
    const prevMonday = fmt(addDays(parseD(monday), -7));
    const prevDays = weekDays(prevMonday);
    const prevYms = [...new Set(prevDays.map(ymOf))];
    const found = new Map();
    for (const ym of prevYms) {
      const b = buckets[ym] || dbTs(empId, ym);
      if (!b?.rows) continue;
      for (const r of b.rows) {
        if (!prevDays.some((d) => r.days?.[d] > 0)) continue; // chỉ lấy dòng thực sự có giờ tuần trước
        if (projClosed(r)) continue;                          // dự án đã đóng: nhân sự không chấm tiếp được
        const khac = khacRow(r);   // v2.9: tác vụ chung / vắng mặt chép sang "Khác" · v13.4: tác vụ quản lý giữ dự án
        const projectId = khac ? NO_PROJECT : r.projectId;
        const phaseId = khac ? DEFAULT_PHASE : r.phaseId || guessPhase(r.taskId, cfg.tasks);
        const otFor = !khac && isOtId(r.taskId) && r.otFor ? { otFor: r.otFor } : {};
        found.set(rowKey({ projectId, phaseId, taskId: r.taskId, ...otFor }), { projectId, phaseId, taskId: r.taskId, ...otFor, note: r.note || "", days: {} });
      }
    }
    setCopying(false);
    if (found.size === 0) return flash("Tuần trước chưa chấm công nên không có gì để chép.", "err");
    const have = new Set(rows.map(rowKey));
    const toAdd = [...found.entries()].filter(([k]) => !have.has(k)).map(([, v]) => v);
    if (toAdd.length === 0) return flash("Các dòng của tuần trước đều đã có trong tuần này.");
    // v3.2: các khối vừa chép được mở sẵn, hiện đủ hạng mục để nhập giờ
    const keys = new Set(toAdd.map(groupKey));
    setRows(expandIn(sortByGroup([...rows, ...toAdd]), keys)); setDirty(true);
    setOpenKeys((s) => new Set([...s, ...keys]));
    flash(`Đã chép ${keys.size} khối từ tuần trước. Nhập giờ rồi bấm ✓ ở từng khối.`);
  };
  const setHour = (i, d, v) => {
    const n = v === "" ? undefined : Math.max(0, Math.min(24, Number(v)));
    setRows((r) => r.map((x, j) => (j === i ? { ...x, days: { ...x.days, [d]: n } } : x)));
    setDirty(true);
  };
  const delRow = (i) => {
    setUndoRow({ rows: [rows[i]], at: i, label: `${projName(rows[i].projectId)} · ${taskName(rows[i].taskId)}` });   // giữ lại để hoàn tác
    setRows((r) => r.filter((_, j) => j !== i));
    mobileInputs.current = []; gridInputs.current = {}; taskSel.current = {};
    setDirty(true);
  };
  /* v3.3 — xoá hết giờ của một hạng mục trong tuần (chỉ ngày còn sửa được: chưa gửi, không phải ngày tương lai bị chặn) */
  const clearRow = (i) => {
    const r = rows[i];
    if (!r) return;
    const d2 = { ...r.days };
    let n = 0;
    for (const d of days) if (d2[d] > 0 && !dayLocked(d) && !futureBlocked(r, d)) { delete d2[d]; n += 1; }
    if (!n) return;
    setUndoRow({ kind: "clear", key: rowKey(r), days: r.days, label: `giờ tuần này của ${taskName(r.taskId)}` });
    setRows((rs) => rs.map((x, j) => (j === i ? { ...x, days: d2 } : x)));
    setDirty(true);
  };
  const undoDelete = () => {
    if (!undoRow) return;
    if (undoRow.kind === "day") {   // v9.1: hoàn tác xoá dự án trong một ngày (điện thoại)
      setRows(undoRow.snap); writeDraft(undoRow.snap);
      setUndoRow(null); setDirty(true);
      return;
    }
    if (undoRow.kind === "clear") {
      setRows((rs) => rs.map((x) => (rowKey(x) === undoRow.key ? { ...x, days: undoRow.days } : x)));
      setUndoRow(null); setDirty(true);
      return;
    }
    const n = [...rows]; n.splice(Math.min(undoRow.at, n.length), 0, ...undoRow.rows);
    const keys = new Set(undoRow.rows.map(groupKey));
    setRows(sortByGroup(undoRow.open ? expandIn(n, keys) : n));
    if (undoRow.open) setOpenKeys((s) => new Set([...s, ...keys]));
    else writeDraft(n);
    setUndoRow(null); setDirty(true);
  };

  // Mũi tên và Enter di chuyển giữa các ô giờ, gõ liền mạch không cần chuột
  const gridKey = (e, i, k) => {
    const move = (di, dk) => {
      const el = gridInputs.current[`${i + di}:${k + dk}`];
      if (!el) return;
      e.preventDefault(); el.focus(); el.select?.();
    };
    /* v12.37 N6 — Esc = bấm ✓ (tạm lưu và đóng khối) */
    if (e.key === "Escape") {
      const gk = rows[i] && groupKey(rows[i]);
      if (gk && openKeys.has(gk)) { e.preventDefault(); e.target.blur(); doneGroup(gk); }
      return;
    }
    /* v12.37 N6 — Enter ở dòng cuối của khối: sang ngày kế tiếp, dòng đầu tiên của khối còn nhập được */
    if (e.key === "Enter" && rows[i]) {
      const gk = groupKey(rows[i]);
      const same = (j) => rows[j] && groupKey(rows[j]) === gk;
      const below = gridInputs.current[`${i + 1}:${k}`];
      if (!(same(i + 1) && below)) {
        for (let j = 0; j < rows.length; j++) {
          if (!same(j)) continue;
          const el = gridInputs.current[`${j}:${k + 1}`];
          if (el && !el.disabled) { e.preventDefault(); el.focus(); el.select?.(); return; }
        }
      }
    }
    if (e.key === "ArrowLeft" && e.target.selectionStart === 0) move(0, -1);
    else if (e.key === "ArrowRight" && e.target.selectionStart === e.target.value.length) move(0, 1);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowDown" || e.key === "Enter") move(1, 0);
  };

  // Điền giờ chuẩn cho cả tuần vào một dòng, chỉ điền ô còn trống
  const fillStandard = (i) => {
    setRows((r) => r.map((x, j) => {
      if (j !== i) return x;
      const d2 = { ...x.days };
      for (const d of days) {
        if (d2[d] > 0 || holidaySet.has(d) || dayLocked(d) || futureBlocked(x, d)) continue;
        const std = stdHoursFor(d, hoursCfg);
        if (std > 0) d2[d] = std;
      }
      return { ...x, days: d2 };
    }));
    setDirty(true);
  };

  /* submitMode: "submit" đánh dấu đã gửi · "unsubmit" gỡ đánh dấu (chỉ quản lý) · null giữ nguyên */
  /* v4.9 — dòng tăng ca: phải chọn tác vụ (với giờ còn ghi được) và mỗi ô không vượt độ dài khung giờ. Trả về câu báo lỗi hoặc null. */
  const otProblem = () => {
    for (const r of rows) {
      if (!isOtId(r.taskId) || projClosed(r)) continue;
      const t = taskById.get(r.taskId);
      const wd = days.filter((d) => (r.days[d] || 0) > 0 && (admin || !isSent(d)));
      if (!wd.length) continue;
      if (!r.otFor && !admin) return `Dòng tăng ca ${otText(t)} chưa chọn "Tăng ca cho tác vụ". Chọn tác vụ trước khi gửi.`;
      const mx = otMaxHours(t), bad = wd.find((d) => r.days[d] > mx);
      if (bad) return `Tăng ca ${otText(t)} ngày ${dayName(bad)}: ${r.days[bad]} giờ vượt độ dài khung giờ (tối đa ${fmtH(mx)} giờ).`;
    }
    return null;
  };
  const save = async (submitMode = null, silent = false) => {
    if (!admin && submitMode !== "submit" && submitMode !== "draft") return false;   // v1.9: nhân sự ghi bằng Gửi; v8.1 thêm Lưu nháp (ghi giờ lên server, chưa gửi)
    if (submitMode === "draft" && !dirty && !rows.some((r) => rowReady(r) && days.some((d) => !isSent(d) && !futureBlocked(r, d) && r.days[d] > 0))) {
      flash("Chưa có giờ nào để lưu nháp.", "err");
      return false;
    }
    const seen = new Set();
    for (const r of rows) {
      const k = rowKey(r);
      if (seen.has(k)) { flash("Có 2 dòng trùng Dự án + Giai đoạn + Hạng mục. Gộp lại giúp em.", "err"); return false; }
      seen.add(k);
    }
    { const msg = otProblem(); if (msg) { flash(msg, "err"); return false; } }
    if (submitMode === "submit" && !days.some((d) => !isSent(d) && !pastLk(d) && sendTotal(d) > 0)) {
      flash("Chưa có giờ mới để gửi. Nhập giờ vào các ngày chưa gửi trước đã.", "err");
      return false;
    }

    setSaving(true);
    /* v1.8: đọc lại đúng các tháng của nhân sự này ngay trước khi ghi, rồi mới chèn giờ của tuần đang sửa
       vào. Không đọc lại được thì dừng, không ghi bản cũ lên server. */
    if (!(await refreshTs(empId, yms))) {
      setSaving(false); setSaveFailed(true);
      flash(`Chưa ghi được — ${LAST_STORAGE_ERROR || "mất kết nối"}`, "err");
      return false;
    }
    const next = { ...buckets };
    for (const ym of yms) next[ym] = dbTs(empId, ym) || { rows: [], weeks: {} };
    const failed = [];
    const newly = [];   // các ngày vừa được đánh dấu đã gửi ở lần ghi này
    const stamp = { at: new Date().toISOString(), by: admin ? "admin" : "emp" };
    for (const ym of yms) {
      const bucket = next[ym] || { rows: [], weeks: {} };
      const sent = { ...(bucket.sent || {}) };
      const daysInYm = days.filter((d) => ymOf(d) === ym);
      /* Nhân sự chỉ ghi được ngày CHƯA gửi (tính theo bản vừa đọc lại từ server); ngày đã gửi giữ nguyên.
         Quản lý ghi được mọi ngày. */
      const writable = admin ? daysInYm : daysInYm.filter((d) => !sent[d] && !pastLocked(cfg, empId, d));   // v8.6: ngày quá hạn giữ nguyên bản server
      const keep = bucket.rows.map((r) => {
        if (projClosed(r)) return r;                       // giờ của dự án đã đóng giữ nguyên bản trên server
        const dd = { ...r.days }; for (const d of writable) if (!supBlocked(r, d)) delete dd[d];   // v8.7: ngày ngoài thời gian hỗ trợ giữ nguyên
        return { ...r, days: dd };
      });
      const map = new Map(keep.map((r) => [rowKey(r), r]));
      for (const r of rows) {
        if (!rowReady(r)) continue;   // v3.0: dòng chưa chọn đủ thì không ghi
        if (projClosed(r)) continue;
        const k = rowKey(r);
        const had = map.get(k);
        const cur = had || { projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, ...(r.otFor ? { otFor: r.otFor } : {}), days: {} };
        // dòng đang giữ giờ của ngày đã gửi thì nhân sự không đổi giai đoạn của nó (database cũng chặn)
        if (admin || !had || !Object.keys(had.days).some((d) => sent[d] || pastLocked(cfg, empId, d))) cur.phaseId = r.phaseId || DEFAULT_PHASE;
        cur.note = (r.note || "").trim();
        for (const d of writable) if (r.days[d] > 0 && !futureBlocked(r, d)) cur.days[d] = r.days[d];
        map.set(k, cur);
      }
      const cleaned = [...map.values()].filter((r) => Object.values(r.days).some((v) => v > 0));
      const tot = (d) => cleaned.reduce((a, r) => a + (r.days[d] || 0), 0);
      const weeks = { ...(bucket.weeks || {}) };
      if (submitMode === "submit") for (const d of writable) if (!sent[d] && tot(d) > 0) { sent[d] = stamp; newly.push(d); }
      if (submitMode === "unsubmit") { for (const d of daysInYm) delete sent[d]; delete weeks[monday]; }
      if (admin) for (const d of daysInYm) if (sent[d] && tot(d) === 0) delete sent[d];   // ngày không còn giờ thì không giữ dấu đã gửi
      next[ym] = { rows: cleaned, weeks, sent };
    }
    if (!admin && submitMode === "submit" && newly.length === 0) {
      // các ngày định gửi đã được gửi/khoá từ máy khác trong lúc đang nhập
      setSaving(false); setDirty(false); setReloadKey((k) => k + 1);
      flash("Không có giờ mới nào được ghi: ngày đã gửi trước đó hoặc dự án đã đóng. Màn hình vừa được tải lại.", "err");
      return false;
    }

    // Ghi đúng các dòng (nhân sự, tháng) của tuần này — không đụng tới dữ liệu của ai khác
    const ok = await commitTs(Object.fromEntries(yms.map((ym) => [slot(empId, ym), next[ym]])));
    if (!ok) failed.push(...yms);

    if (failed.length > 0) {
      // giữ nguyên dirty để nút Lưu vẫn sáng và người dùng biết là chưa xong
      setSaving(false);
      setSaveFailed(true);
      flash(
        RATE_LIMITED
          ? "Đã chạm hạn mức lệnh của phiên — tải lại trang rồi nhập lại."
          : `Chưa ghi được — ${LAST_STORAGE_ERROR}`,
        "err"
      );
      return false;
    }

    setBuckets(next); setSaving(false); setDirty(false); setSaveFailed(false); setSavedTick((t) => t + 1);
    if (!admin && (submitMode === "submit" || submitMode === "draft")) { try { localStorage.removeItem(draftKeyOf(monday)); } catch { /* bỏ qua */ } }
    if (submitMode && submitMode !== "draft") setReloadKey((k) => k + 1);   // nạp lại để màn hình khớp đúng bản vừa ghi (lưu nháp: giữ nguyên màn hình đang nhập)
    const sentLabel = newly.sort().map(dayName).join(", ");
    if (!silent) flash(
      submitMode === "draft" ? "Đã lưu nháp lên hệ thống — chưa gửi. Mở trên máy khác vẫn thấy; xong hết thì bấm Gửi giờ công."
        : submitMode === "submit" ? (newly.length === 0 ? "Không có ngày nào mới để đánh dấu." : admin ? `Đã đánh dấu đã gửi: ${sentLabel}.` : `Đã gửi ${sentLabel}. Các ngày này đã khoá.`)
        : submitMode === "unsubmit" ? "Đã mở khoá cả tuần — nhân sự sửa lại được, giờ tuần này tạm chưa tính cho tới khi gửi lại."
        : "Đã lưu thay đổi."
    );
    return true;
  };

  // v3.3: dải Hoàn tác tự ẩn sau 10 giây
  useEffect(() => {
    if (!undoRow) return undefined;
    const t = setTimeout(() => setUndoRow(null), 10000);
    return () => clearTimeout(t);
  }, [undoRow]);
  /* v2.2 — Có mạng lại mà lần ghi trước hỏng và giờ vẫn còn trên màn hình: tự gửi lại đúng thao tác đó. */
  const net = useNet();
  useEffect(() => {
    if (net && saveFailed && dirty && !saving) save(admin ? null : "submit");
  }, [net]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Lối thoát khi không ghi được: chép giờ đã nhập ra dạng chữ để nhập lại ở máy khác,
     thay vì mất công gõ lại từ đầu. */
  const copyEntered = async () => {
    const lines = [`Bảng công ${emp?.name || ""} — tuần ${dLabel(monday)} đến ${dLabel(days[6])}`];
    for (const r of rows) {
      const hrs = days.map((d, i) => (r.days[d] > 0 ? `${DOW[i]} ${r.days[d]}` : null)).filter(Boolean).join(", ");
      if (!hrs) continue;
      lines.push(`- ${projName(r.projectId)} | ${phaseLabel(r.phaseId)} | ${taskName(r.taskId)}: ${hrs}${r.note ? ` (${r.note})` : ""}`);
    }
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flash("Đã chép vào bộ nhớ tạm. Dán vào ghi chú hoặc tin nhắn để giữ lại.");
    } catch {
      flash("Trình duyệt không cho chép tự động. Chụp màn hình lại giúp em.", "err");
    }
  };

  /* Đổi tuần khi còn thay đổi chưa ghi.
     Quản lý: tự lưu trước như cũ. Nhân sự (v1.9, không còn lưu nháp): hỏi lại, vì giờ chưa gửi sẽ mất. */
  const goWeek = async (nextMonday) => {
    if (nextMonday === monday) return;
    if (dirty && admin) { const ok = await save(null, true); if (!ok) return; flash("Đã tự lưu tuần vừa rồi."); }
    else if (atRisk) { setPendingWeek(nextMonday); return; }
    setMonday(nextMonday);
  };
  // v4.1: thông báo nhắc được bấm khi đang ở màn này → chuyển tới tuần cần gửi qua goWeek (giữ nguyên bước hỏi lại)
  const goWeekRef = useRef(goWeek);
  goWeekRef.current = goWeek;
  useEffect(() => {
    const h = (e) => { const t = e.detail; if (/^\d{4}-\d{2}-\d{2}$/.test(t)) goWeekRef.current(fmt(mondayOf(parseD(t)))); };
    window.addEventListener("artius:tuan", h);
    return () => window.removeEventListener("artius:tuan", h);
  }, []);
  /* v13.29 — Xuất "BẢNG CHẤM CÔNG_NGOÀI GIỜ" của tháng đang xem, điền thẳng vào mẫu giấy công ty.
     v13.31: phần gom giờ và dựng file chuyển sang shared/otReport.js để Dashboard cá nhân dùng chung.
     Tháng lấy theo tuần đang mở; tuần vắt qua hai tháng thì lấy tháng của ngày thứ Hai. */
  const exportOt = async () => {
    if (otBusy) return;
    setOtBusy(true);
    try { await runOtExport({ cfg, empId, ym: ymOf(monday), flash }); }
    finally { setOtBusy(false); }
  };

  /* v13.30 — nút "Excel tăng ca" nằm trên header (cạnh nút sáng/tối) chứ không còn ở chân bảng,
     và phải hiện rõ THÁNG sẽ xuất để nhân viên không xuất nhầm. EmployeeArea đẩy tháng đang xem
     cùng hàm xuất lên App; App lo phần hiển thị. Rời màn này thì gỡ nút đi. */
  useEffect(() => {
    if (!onOtReady) return undefined;
    onOtReady({ ym: ymOf(monday), run: exportOt, busy: otBusy });
    return () => onOtReady(null);
  }, [monday, otBusy, onOtReady]);   // eslint-disable-line react-hooks/exhaustive-deps

  const askSubmitWeek = () => {
    if (toSend.length === 0) return flash("Chưa có giờ mới để gửi. Nhập giờ vào các ngày chưa gửi (tới hôm nay) trước đã.", "err");
    const msg = otProblem();   // v4.9: báo lỗi dòng tăng ca trước khi hỏi xác nhận gửi
    if (msg) return flash(msg, "err");
    setAskSubmit(true);
  };

  /* Gom dòng thành nhóm để render. Mỗi mục giữ lại chỉ số gốc `i` trong mảng rows
     để ref ô nhập, điều hướng phím và xoá dòng không phải đổi gì. */
  const groups = useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => {
      const k = groupKey(r);
      if (!m.has(k)) m.set(k, { key: k, projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, items: [] });
      m.get(k).items.push({ r, i });
    });
    return [...m.values()];
  }, [rows]);

  /* v3.2 — Đổi dự án / giai đoạn ở đầu khối.
     Chọn dự án: khối hiện ngay TOÀN BỘ hạng mục của dự án (dòng trống) để nhập giờ thẳng, giai đoạn tự chọn theo quản lý.
     Khối đã có giờ thì không đổi dự án nữa (xoá giờ hoặc xoá khối trước). */
  const updGroup = (gk, patch) => {
    const mine = rows.filter((r) => groupKey(r) === gk);
    if (!mine.length) return;
    const first = rows.findIndex((r) => groupKey(r) === gk);
    if (patch.projectId !== undefined) {
      const pid = patch.projectId;
      if (mine.some(rowHasHours)) return flash("Khối đã có giờ. Xoá giờ trong khối (hoặc xoá khối) trước khi đổi dự án.", "err");
      const phaseId = pid === NO_PROJECT ? DEFAULT_PHASE : ((admin ? openPhasesOf(pid) : setOpenPhases(pid))[0]?.id || NO_PHASE);
      const nk = groupKey({ projectId: pid, phaseId });
      if (nk !== gk && rows.some((r) => groupKey(r) === nk)) {
        return flash(`${projFull(pid)}${pid === NO_PROJECT ? "" : ` · ${phaseLabel(phaseId)}`} đã có ở khối khác — bấm nút Sửa ở khối đó để chấm thêm.`, "err");
      }
      const pool = poolFor(pid).filter((t) => !isOtTask(t));   // v5.1: dòng tăng ca chỉ tạo bằng nút Tăng ca / Thêm dòng tăng ca
      if (!pool.length) return flash(pid === NO_PROJECT ? "Chưa có tác vụ chung nào." : "Bạn chưa có tác vụ dự án nào cho vai trò của mình. Báo quản lý bổ sung trong tab Tác vụ.", "err");
      const next = rows.filter((r) => groupKey(r) !== gk);
      next.splice(first, 0, ...pool.map((t) => ({ projectId: pid, phaseId, taskId: t.id, note: "", days: {} })));
      gridInputs.current = {}; mobileInputs.current = [];
      setRows(next);
      setOpenKeys((s) => { const n = new Set(s); n.delete(gk); n.add(nk); return n; });
      setDirty(true);
      return;
    }
    if (patch.phaseId !== undefined) {
      const nk = groupKey({ projectId: mine[0].projectId, phaseId: patch.phaseId });
      if (nk === gk) return;
      if (rows.some((r) => groupKey(r) === nk)) return flash(`${phaseLabel(patch.phaseId)} của dự án này đã có ở khối khác — bấm nút Sửa ở khối đó.`, "err");
      setRows(rows.map((r) => (groupKey(r) === gk ? { ...r, phaseId: patch.phaseId } : r)));
      setOpenKeys((s) => { if (!s.has(gk)) return s; const n = new Set(s); n.delete(gk); n.add(nk); return n; });
      setDirty(true);
    }
  };

  /* Dự án nhân sự đang làm — suy từ giờ đã chấm tháng này + tháng trước, cùng cách tab
     "Theo dõi nhân sự" đang dùng, cộng thêm dự án của tuần đang mở kể cả chưa lưu.
     Đọc từ DB trong bộ nhớ nên không tốn lệnh storage. */
  const myProjects = useMemo(() => {
    const h = new Map();
    for (const ym of [...new Set([...yms, prevYm(yms[0])])]) {
      for (const r of dbTs(empId, ym)?.rows || []) {
        if (r.projectId === NO_PROJECT) continue;
        const t = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
        if (t > 0) h.set(r.projectId, (h.get(r.projectId) || 0) + t);
      }
    }
    for (const r of rows) if (r.projectId !== NO_PROJECT) h.set(r.projectId, h.get(r.projectId) || 0);
    return activeProjects.filter((p) => h.has(p.id)).sort((a, b) => (h.get(b.id) || 0) - (h.get(a.id) || 0));
  }, [empId, yms, rows, activeProjects, savedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tra mã dự án -> id. Gõ "01" hoặc "#01" là nhảy thẳng vào dự án đó, khỏi gõ tên
  const codeMap = useMemo(() => {
    const m = new Map();
    for (const p of activeProjects) if (p.code) m.set(norm(String(p.code)), p.id);
    return m;
  }, [activeProjects]);

  /* Danh sách tổ hợp để tìm kiếm. Chỉ nhân dự án × hạng mục (không nhân thêm giai đoạn) —
     giai đoạn suy ra bằng guessPhase, hoặc lấy từ token P1–P4 nếu người dùng gõ vào.
     Dự án đang làm được xếp lên trước để gõ ít nhất vẫn ra đúng thứ cần. */
  const quickOptions = useMemo(() => {
    const out = [];
    const rank = new Map(myProjects.map((p, k) => [p.id, k]));
    const ordered = [...activeProjects].sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 999) - (rank.has(b.id) ? rank.get(b.id) : 999));
    for (const p of ordered) for (const t of projTasks) {
      out.push({
        projectId: p.id, taskId: t.id, phaseId: fitPhase(p.id, guessPhase(t.id, cfg.tasks)),
        label: `${p.code ? `[${p.code}] ` : ""}${p.name} · ${taskText(t)}`,
        hay: norm(`${p.code || ""} ${p.id} ${p.name} ${t.code || ""} ${t.name} ${t.group || ""}`),
      });
    }
    for (const t of commonTasks) out.push({ projectId: NO_PROJECT, taskId: t.id, phaseId: DEFAULT_PHASE, label: `Khác · ${taskText(t)}`, hay: norm(`khac chung ${t.code || ""} ${t.name} ${t.group || ""}`) });
    for (const t of LEAVE_TASKS) out.push({ projectId: NO_PROJECT, taskId: t.id, phaseId: DEFAULT_PHASE, label: `Khác · ${taskText(t)}`, hay: norm(`khac vang mat nghi ${t.name}`) });
    return out;
  }, [activeProjects, myProjects, myTasks, commonIds, cfg.tasks, cfg.projects]); // eslint-disable-line react-hooks/exhaustive-deps

  const quickHits = useMemo(() => {
    const have = new Set(rows.map(rowKey));
    let text = norm(q).trim();
    let phase = qPhase;
    const m = text.match(/(^|\s)p(\d{1,2})(\s|$)/);    // gõ thẳng "vin p2 khao" cũng lọc được giai đoạn
    if (m && phaseInfo(`P${m[2]}`)?.active) { phase = `P${m[2]}`; text = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).trim(); }
    /* Token nào trùng khít một mã dự án thì coi là bộ lọc dự án, không đem đi so chuỗi nữa.
       Gõ cụ thể luôn thắng chip đang chọn, giống cách token P1–P4 đang hoạt động. */
    let proj = qProj;
    const toks = [];
    for (const t of text.split(/\s+/).filter(Boolean)) {
      const bare = t.replace(/^#/, "");
      if (codeMap.has(bare)) { proj = codeMap.get(bare); continue; }
      toks.push(t);
    }
    // ô trống và không lọc gì thì toks rỗng, every() trả true nên danh sách mở sẵn để duyệt
    return quickOptions
      .filter((o) => !proj || o.projectId === proj)
      .map((o) => (phase && o.projectId !== NO_PROJECT ? { ...o, phaseId: phase } : o))
      .filter((o) => o.projectId === NO_PROJECT || phaseOpen(o.projectId, o.phaseId))   // v2.5: bỏ tổ hợp rơi vào giai đoạn chưa có giờ dự kiến
      .filter((o) => toks.every((t) => o.hay.includes(t)) && !have.has(rowKey(o)))
      .slice(0, 12);
  }, [q, qProj, qPhase, codeMap, quickOptions, rows]);

  /* Chip gợi ý: tổ hợp chấm nhiều nhất trong tháng này và tháng trước.
     Đọc thẳng từ DB trong bộ nhớ nên không tốn lệnh storage nào. */
  const recentCombos = useMemo(() => {
    const cnt = new Map();
    for (const ym of [...new Set([...yms, prevYm(yms[0])])]) {
      const b = dbTs(empId, ym);
      for (const r of b?.rows || []) {
        if (isLeaveTask(r.taskId)) continue;
        // v2.9: giờ cũ chấm tác vụ chung dưới một dự án thì gợi ý lại dưới "Khác"
        const khac = khacRow(r);
        const projectId = khac ? NO_PROJECT : r.projectId;
        const phaseId = khac ? DEFAULT_PHASE : r.phaseId || guessPhase(r.taskId, cfg.tasks);
        const k = rowKey({ projectId, phaseId, taskId: r.taskId });
        const e = cnt.get(k) || { projectId, phaseId, taskId: r.taskId, n: 0 };
        e.n += 1; cnt.set(k, e);
      }
    }
    const have = new Set(rows.map(rowKey));
    const live = new Set(activeProjects.map((p) => p.id));
    const usable = new Set(myTasks.map((t) => t.id));   // v2.3: bỏ gợi ý tác vụ đã xoá / không còn thuộc bộ phận
    return [...cnt.values()]
      .filter((c) => !have.has(rowKey(c)) && usable.has(c.taskId) && (c.projectId === NO_PROJECT || (live.has(c.projectId) && phaseOpen(c.projectId, c.phaseId))))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [empId, yms, rows, activeProjects, myTasks, cfg.tasks, cfg.phases, savedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const quickKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setQOpen(true); setQIdx((k) => Math.min(k + 1, quickHits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setQIdx((k) => Math.max(k - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (quickHits[qIdx]) addCombo(quickHits[qIdx]); }
    else if (e.key === "Escape") { setQOpen(false); e.currentTarget.blur(); }
  };

  /* v1.9 — khoá cứng theo ngày: ngày đã gửi thì nhân sự không sửa được và không thêm giờ dự án khác vào ngày đó;
     quản lý luôn sửa được. Ngày chưa gửi vẫn nhập và gửi sau bình thường. */
  const sentDays = days.filter(isSent);
  const submitted = days.filter((d) => minHoursFor(d, hoursCfg, holidaySet) !== null).every(isSent) || yms.every((ym) => buckets[ym]?.weeks?.[monday]);
  const locked = !admin && days.every((d) => isSent(d) || pastLk(d));   // cả 7 ngày đã gửi (v8.6: hoặc đã quá hạn): không còn gì để nhập
  const rowLocked = (r) => !admin && (projClosed(r) || days.some((d) => (isSent(d) || pastLk(d)) && r.days[d] > 0));
  const pastDays = days.filter(pastLk);                                  // v8.6
  const openUntil = admin ? "" : days.map((d) => pastOpenUntil(cfg, empId, d)).find(Boolean) || "";
  const toSend = days.filter((d) => !isSent(d) && !pastLk(d) && sendTotal(d) > 0);
  /* v2.4 — "có giờ sẽ mất": quản lý thì mọi thay đổi chưa lưu; nhân sự thì chỉ khi đang có giờ ở ngày chưa gửi.
     Chỉ thêm dòng trống (chưa nhập giờ) thì chuyển tuần / đổi tab / đóng trang không bị hỏi. */
  const atRisk = admin ? dirty : dirty && days.some((d) => !isSent(d) && !pastLk(d) && dayTotal(d) > 0);
  // báo lên App để chặn đổi tab khi còn giờ chưa gửi
  useEffect(() => { onDirtyChange?.(atRisk); return () => onDirtyChange?.(false); }, [atRisk, onDirtyChange]);
  // v1.9 — không còn lưu nháp: đóng hoặc tải lại trang khi còn giờ chưa gửi thì trình duyệt hỏi lại
  useEffect(() => {
    if (!atRisk) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [atRisk]);
  const weekTotal = days.reduce((s, d) => s + dayTotal(d), 0);
  const todayStr = fmt(new Date());
  // Ngày nào có dòng vắng mặt với giờ > 0 thì coi là ngày vắng — suy trực tiếp từ dòng, không lưu riêng
  const leaveMap = useMemo(() => {
    const m = {};
    for (const r of rows) {
      const lt = leaveTypeOfTask(r.taskId);
      if (!lt) continue;
      for (const d of days) if (r.days[d] > 0) m[d] = lt;
    }
    return m;
  }, [rows, days]);
  const leaveHours = (d) => rows.reduce((s2, r) => s2 + (isLeaveTask(r.taskId) ? (r.days[d] || 0) : 0), 0);
  const workHours = (d) => dayTotal(d) - leaveHours(d);

  /* v4.0 — thiếu giờ công tính theo GIỜ CHUẨN (tổng − OT − giờ cố gắng), không tính theo tổng:
     chấm 6h làm việc + 2h OT = 8h vẫn là thiếu 2h giờ chuẩn. */
  const isIncomplete = (d) => {
    const min = minHoursFor(d, hoursCfg, holidaySet);
    return min !== null && d <= todayStr && dayTotal(d) - otHrs(d) - effortHrs(d) < min;
  };
  const isOverDaily = (d) => dayTotal(d) > (Number(hoursCfg.maxDaily) || 13.5); // vượt ngưỡng cảnh báo/ngày
  // v3.4: OT = chỉ giờ chấm vào hạng mục Tăng ca; Giờ cố gắng = giờ làm việc thường vượt ngưỡng ngày (không tính chi phí dự án)
  const otHrs = (d) => rows.reduce((s, r) => s + (isOtId(r.taskId) ? (r.days[d] || 0) : 0), 0);
  const idleHrs = (d) => rows.reduce((s, r) => s + (isIdleTask(r.taskId) ? (r.days[d] || 0) : 0), 0);   // v7.2
  const effortHrs = (d) => effortHoursFor(d, Math.max(0, workHours(d) - otHrs(d) - idleHrs(d)), hoursCfg, holidaySet);
  const otTotal = days.reduce((s, d) => s + otHrs(d), 0);
  const effortTotal = days.reduce((s, d) => s + effortHrs(d), 0);
  // có ngày nào OT vượt ngưỡng không — dùng để đổi màu ô tổng và dòng OT trên đầu bảng
  const anyOtHigh = days.some((d) => otHrs(d) > OT_ALERT);
  // Target tuần trừ đi phần được miễn do ngày lễ và ngày nghỉ phép
  const weekTarget = days.reduce((s, d) => {
    const min = minHoursFor(d, hoursCfg, holidaySet);
    return s + (min === null ? 0 : min);
  }, 0);
  /* v3.7 — giờ công chuẩn = tổng − OT − Giờ cố gắng; phát sinh = OT + Giờ cố gắng. Tiến độ tuần tính theo giờ chuẩn. */
  const extraTotal = otTotal + effortTotal;
  const stdTotal = Math.max(0, weekTotal - extraTotal);
  const stdHrs = (d) => Math.max(0, dayTotal(d) - otHrs(d) - effortHrs(d));
  const targetPct = weekTarget > 0 ? Math.min(100, (stdTotal / weekTarget) * 100) : 0;
  const projOptions = (r) => (
    <>
      {r.projectId === "" && <option value="" disabled>— Chọn dự án —</option>}
      <option value={NO_PROJECT}>Khác</option>
      {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ""}{p.name}{isSupProj(p.id) ? ` — hỗ trợ tới ${dLabel(supUntil(p.id))}` : ""}</option>)}
      {r.projectId !== NO_PROJECT && r.projectId !== "" && !activeProjects.some((p) => p.id === r.projectId) && <option value={r.projectId}>{projName(r.projectId)} ({!cfg.projects.some((p) => p.id === r.projectId && p.active) ? "đã đóng" : openPhasesOf(r.projectId).length === 0 ? "chưa mở giai đoạn" : "không còn được giao"})</option>}
    </>
  );
  // v2.5: chỉ liệt kê giai đoạn có giờ dự kiến của dự án (quản lý thấy mọi giai đoạn đang dùng)
  const phaseOptions = (cur, pid) => {
    const list = pid === "" ? [] : pid && pid !== NO_PROJECT ? openPhasesOf(pid) : activePhases();
    return (
      <>
        {cur === NO_PHASE && <option value={NO_PHASE} disabled>— Chọn giai đoạn —</option>}
        {list.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
        {cur && cur !== NO_PHASE && !list.some((p) => p.id === cur) && (
          <option value={cur}>{phaseLabel(cur)}{!phaseInfo(cur) ? "" : !phaseInfo(cur).active ? " (ngừng dùng)" : " (đang đóng)"}</option>
        )}
      </>
    );
  };
  // Nhân sự chưa chấm công bao giờ thì chưa suy ra được dự án nào — lúc đó hiện tạm danh sách đang mở
  const projChips = myProjects.length ? myProjects : activeProjects.slice(0, 6);
  const qChip = (on) => `rounded border px-1.5 py-0.5 text-[11px] ${on ? "border-teal-600 bg-teal-950 text-teal-300" : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200"}`;
  // v2.9 — "Khác": tác vụ chung + vắng mặt. Dự án: chỉ tác vụ gắn vai trò.
  const taskOptions = (r) => {
    const khac = r.projectId === NO_PROJECT;
    const listed = khac ? [...commonTasks, ...LEAVE_TASKS] : projTasks;
    return (
      <>
        {!r.taskId && <option value="" disabled>— Chọn hạng mục —</option>}
        {khac ? (
          <>
            <optgroup label="Công việc chung">
              {commonPlain.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
            </optgroup>
            {tlTasks.length > 0 && (
              <optgroup label="Teamleader">
                {tlTasks.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
              </optgroup>
            )}
            {mgrTasks.length > 0 && (
              <optgroup label="Quản lý">
                {mgrTasks.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
              </optgroup>
            )}
            <optgroup label="Vắng mặt">
              {LEAVE_TASKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          </>
        ) : (
          <>
            <optgroup label="Công việc dự án">
              {projPlain.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
            </optgroup>
            {tlTasks.length > 0 && (
              <optgroup label="Teamleader">
                {tlTasks.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
              </optgroup>
            )}
            {mgrTasks.length > 0 && (
              <optgroup label="Quản lý">
                {mgrTasks.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
              </optgroup>
            )}
          </>
        )}
        {/* dòng cũ trỏ tới hạng mục không còn trong danh sách vẫn giữ được, không bị đổi ngầm */}
        {r.taskId && !listed.some((t) => t.id === r.taskId) && (
          <option value={r.taskId}>{taskName(r.taskId)}{!cfg.tasks.some((t) => t.id === r.taskId) ? "" : commonIds.has(r.taskId) ? " (tác vụ chung — dữ liệu cũ)" : " (ngoài bộ phận)"}</option>
        )}
      </>
    );
  };

  /* ---------- v8.4: điện thoại — nhập giờ bằng nút − / + ngay tại dòng, thêm tác vụ bằng bảng trượt ---------- */
  const DAY_FULL = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
  // đổi giờ ở điện thoại: ghi luôn bản tạm trên máy (như bấm ✓ ở bản cũ) để lỡ đóng trang không mất giờ
  const setHourM = (i, d, v) => {
    const n = v === "" || v === null ? undefined : Math.max(0, Math.min(24, Number(v)));
    const next = rows.map((x, j) => (j === i ? { ...x, days: { ...x.days, [d]: n || undefined } } : x));
    setRows(next); setDirty(true); writeDraft(next);
    if (rows[i]) setDayKeys((s2) => new Set([...s2, rowKey(rows[i])]));
  };
  /* v9.1 (điện thoại): thùng rác ở đầu khối — xoá dự án khỏi NGÀY đang xem. Dự án còn giờ ở ngày khác thì chỉ xoá giờ ngày này;
     không còn giờ ngày nào thì xoá hẳn khối. Có Hoàn tác. */
  const dayDelGroup = (gk) => {
    const mine = rows.filter((r) => groupKey(r) === gk);
    if (!mine.length) return;
    const other = mine.some((r) => days.some((d) => d !== activeDay && (r.days[d] || 0) > 0));
    if (!other) { delGroup(gk); setDayKeys(new Set()); return; }
    const snap = rows;
    const next = rows.map((r) => (groupKey(r) !== gk || r.days[activeDay] == null ? r : { ...r, days: { ...r.days, [activeDay]: undefined } }));
    setRows(next); setDirty(true); writeDraft(next);
    setDayKeys((s2) => { const n = new Set(s2); for (const r of mine) n.delete(rowKey(r)); return n; });
    setOpenKeys((s2) => { const n = new Set(s2); n.delete(gk); return n; });
    setUndoRow({ kind: "day", snap, label: `${projFull(mine[0].projectId)} — ${dayName(activeDay)}` });
  };
  const showToday = (r) => (r.days[activeDay] || 0) > 0 || dayKeys.has(rowKey(r)) || r.fresh === activeDay;
  // đổi ngày: thu các khối đang mở đủ tác vụ về lại (chỉ giữ tác vụ có giờ) để ngày mới không bày sẵn mọi tác vụ
  const pickDay = (d) => {
    if (openKeys.size) {
      const next = collapseIn(rows, openKeys);
      setRows(next); setOpenKeys(new Set()); writeDraft(next);
      gridInputs.current = {}; mobileInputs.current = [];
    }
    setActiveDay(d);
  };
  const stepper = (r, i) => {
    const t = taskById.get(r.taskId);
    const dis = locked || dayLocked(activeDay) || projClosed(r) || futureBlocked(r, activeDay) || !rowReady(r);
    const v = r.days[activeDay];
    const n = Number(v) || 0;
    const over = isOtTask(t) && n > otMaxHours(t);
    const step = (dlt) => { const x = Math.max(0, Math.min(24, Math.round((n + dlt) * 2) / 2)); setHourM(i, activeDay, x ? String(x) : ""); };
    /* v8.9 — ô có giờ nổi rõ (nền xanh ngọc, số đậm) kể cả khi ngày đã khoá; nút 8h điền nhanh / bấm lại để xoá */
    const has = n > 0;
    const is8 = n === 8;
    return (
      <div className="flex shrink-0 items-center gap-1.5">
      <div className={`flex items-center overflow-hidden rounded-lg border ${over ? "border-rose-600" : has ? "border-teal-600" : "border-slate-700"}`}>
        <button type="button" disabled={dis || n <= 0} onClick={() => step(-0.5)} aria-label="Bớt 0.5 giờ"
          className="flex h-9 w-8 items-center justify-center bg-slate-800 text-slate-300 disabled:text-slate-600"><Minus size={15} /></button>
        <input ref={(el) => { mobileInputs.current[i] = el; }} type="number" inputMode="decimal" min="0" max="24" step="0.5" placeholder="0"
          disabled={dis} value={v ?? ""} aria-label="Số giờ"
          onChange={(e) => setHourM(i, activeDay, e.target.value)} onFocus={(e) => e.target.select()}
          /* v13.28: lăn chuột giữa không được tăng / giảm giờ nữa — bỏ tiêu điểm để trang cuộn bình thường */
          onWheel={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const next = mobileInputs.current.slice(i + 1).find(Boolean);
            if (next && !next.disabled) { next.focus(); next.select?.(); } else e.target.blur();
          }}
          style={{ WebkitTextFillColor: "currentColor", opacity: 1 }}
          className={`hrs-in h-9 w-11 border-0 p-0 text-center font-mono text-base focus:outline-none ${has ? `hrs-on bg-teal-500/15 font-semibold ${over ? "text-rose-300" : "text-teal-200"}` : `bg-transparent ${dis ? "text-slate-600" : "text-slate-500"}`} placeholder:text-slate-500`} />
        <button type="button" disabled={dis || n >= 24} onClick={() => step(0.5)} aria-label="Thêm 0.5 giờ"
          className="flex h-9 w-8 items-center justify-center bg-slate-800 text-slate-300 disabled:text-slate-600"><Plus size={15} /></button>
      </div>
      <button type="button" disabled={dis} onClick={() => setHourM(i, activeDay, is8 ? "" : "8")}
        title={is8 ? "Xoá giờ của tác vụ này trong ngày" : "Điền nhanh 8 giờ"} aria-label={is8 ? "Xoá 8 giờ" : "Điền 8 giờ"}
        className={`h-9 w-10 rounded-lg border text-[13px] font-medium disabled:opacity-35 ${is8 ? "border-teal-600 bg-teal-600 text-white" : "border-slate-700 text-slate-300"}`}>8h</button>
      </div>
    );
  };
  // bảng trượt: dự án → giai đoạn → tích nhiều tác vụ → Thêm
  const openAddSheet = () => {
    setMenuKey(null);
    const only = activeProjects.length === 0 ? NO_PROJECT : "";
    setAddSheet({ pid: only, ph: only === NO_PROJECT ? DEFAULT_PHASE : "", picked: [] });
  };
  const sheetPick = (pid) => setAddSheet((s) => ({ pid, ph: pid === NO_PROJECT ? DEFAULT_PHASE : (s.pid === pid ? s.ph : (openPhasesOf(pid)[0]?.id || "")), picked: s.pid === pid ? s.picked : [] }));
  const sheetHas = (pid, ph, tid) => rows.some((r) => r.projectId === pid && (r.phaseId || DEFAULT_PHASE) === ph && r.taskId === tid && !r.otFor && showToday(r));   // v9.0: tác vụ có giờ ngày khác vẫn chọn được
  const addPicked = () => {
    const { pid, ph, picked } = addSheet;
    if (!pid || !picked.length) return;
    const base = rows.filter((r) => r.projectId !== "");   // bỏ khối trống mặc định
    const have = new Set(base.map(rowKey));
    const add = picked.map((tid) => ({ projectId: pid, phaseId: ph || DEFAULT_PHASE, taskId: tid, note: "", days: {} })).filter((r) => !have.has(rowKey(r)));
    mobileInputs.current = []; gridInputs.current = {};
    setRows(sortByGroup([...base, ...add])); setDirty(true);
    setDayKeys((s2) => new Set([...s2, ...picked.map((tid) => rowKey({ projectId: pid, phaseId: ph || DEFAULT_PHASE, taskId: tid }))]));
    setAddSheet(null);
    flash(`Đã thêm ${add.length} tác vụ. Bấm − / + hoặc chạm vào số để nhập giờ.`);
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {!admin && <DeadlineBanner cfg={cfg} empId={empId} onGo={(m) => goWeek(fmt(mondayOf(parseD(m))))} />}
      {/* v8.4 — điện thoại ẩn dải chú thích màu (ý nghĩa màu đã nằm ngay trong số liệu) */}
      <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-xs text-slate-500 md:flex">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Thiếu giờ công</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" /> Tăng ca</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> OT trên {OT_ALERT} giờ/ngày</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Giờ cố gắng</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-red-500" /> Ngày lễ</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Nghỉ phép</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-slate-600 bg-slate-700" /> Hôm nay</span>
      </div>

      {/* v8.4 — điện thoại: thẻ tuần gọn — ‹ tuần › ở giữa, Chuẩn · Cố gắng · Tổng cùng hàng, thanh tiến độ bên dưới */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 pb-3 pt-2.5 md:hidden">
        <div className="flex items-center gap-1.5">
          <button onClick={() => goWeek(fmt(addDays(parseD(monday), -7)))} className={`${iconBtn} shrink-0`} aria-label="Tuần trước"><ChevronLeft size={16} /></button>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <WeekPicker monday={monday} onChange={goWeek} empId={empId} hoursCfg={hoursCfg} holidaySet={holidaySet} refreshKey={savedTick} />
            {monday === fmt(mondayOf(new Date()))
              ? <span className="text-[11px] leading-tight text-teal-400">Tuần này</span>
              : <button onClick={() => goWeek(fmt(mondayOf(new Date())))} className="text-[11px] leading-tight text-teal-400">Về tuần này</button>}
          </div>
          <button onClick={() => goWeek(fmt(addDays(parseD(monday), 7)))} className={`${iconBtn} shrink-0`} aria-label="Tuần sau"><ChevronRight size={16} /></button>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-slate-950 px-2 py-1.5" title="Giờ công chuẩn = tổng − OT − giờ cố gắng">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Chuẩn</div>
            <div className="whitespace-nowrap"><span className="font-mono text-[15px] font-medium text-blue-400">{fmtH(stdTotal)}</span>{weekTarget > 0 && <span className="font-mono text-xs text-slate-500"> /{fmtH(weekTarget)}</span>}</div>
          </div>
          <div className="rounded-lg bg-slate-950 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Cố gắng</div>
            <div className="whitespace-nowrap"><span className="cg-num font-mono text-[15px] font-medium text-violet-400">+{fmtH(effortTotal)}</span>
              {otTotal > 0 && <span className={`font-mono text-xs ${anyOtHigh ? "text-red-400" : "text-teal-400"}`}> · OT {fmtH(otTotal)}</span>}</div>
          </div>
          <div className="rounded-lg bg-slate-950 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Tổng</div>
            <div className="whitespace-nowrap"><span className="font-mono text-[15px] font-medium text-slate-100">{fmtH(weekTotal)}</span><span className="text-xs text-slate-500"> h</span></div>
          </div>
        </div>
        {weekTarget > 0 && (
          <>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full transition-all ${stdTotal >= weekTarget ? "bg-blue-400" : "bg-amber-500"}`} style={{ width: `${targetPct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11.5px]">
              <span className="text-slate-500">Tiến độ giờ chuẩn</span>
              <span className={stdTotal >= weekTarget ? "text-blue-400" : "text-amber-400"}>{stdTotal >= weekTarget ? "đủ giờ chuẩn" : `còn thiếu ${fmtH(weekTarget - stdTotal)}`}</span>
            </div>
          </>
        )}
      </div>

      <div className="hidden rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2.5 md:block md:px-3">
        {/* v2.4: màn hẹp thì nhóm "đã gửi + tổng giờ" tự xuống dòng, căn phải, thay vì tràn khỏi thẻ */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 md:gap-2">
            <button onClick={() => goWeek(fmt(addDays(parseD(monday), -7)))} className={iconBtn}><ChevronLeft size={16} /></button>
            <WeekPicker monday={monday} onChange={goWeek} empId={empId} hoursCfg={hoursCfg} holidaySet={holidaySet} refreshKey={savedTick} />
            <button onClick={() => goWeek(fmt(addDays(parseD(monday), 7)))} className={iconBtn}><ChevronRight size={16} /></button>
            <button onClick={() => goWeek(fmt(mondayOf(new Date())))} className="whitespace-nowrap text-xs text-teal-400 hover:text-teal-300">Tuần này</button>
          </div>
          <div className="ml-auto flex items-center gap-2 md:gap-4">
            {/* v3.7 — bỏ nhãn "Đã gửi đủ tuần" (nút dưới bảng đã báo "Đã gửi giờ công"); tổng giờ tách 3 ô: Chuẩn · Phát sinh · Tổng */}
            <div className="flex overflow-hidden rounded-lg border border-slate-700 text-right">
              <div className="px-2.5 py-1 md:px-3.5" title="Giờ công chuẩn = tổng − OT − giờ cố gắng">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Chuẩn</div>
                <div className="font-mono text-base font-semibold text-blue-400 md:text-lg">{stdTotal.toFixed(1)}</div>
                <div className="font-mono text-[10px] text-slate-500">{weekTarget > 0 ? `/ ${weekTarget.toFixed(1)}` : "giờ"}</div>
              </div>
              <div className="border-l border-slate-700 px-2.5 py-1 md:px-3.5" title="Giờ phát sinh = OT (hạng mục Tăng ca) + giờ cố gắng (không tính chi phí dự án)">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Phát sinh</div>
                <div className="font-mono text-base font-semibold text-slate-100 md:text-lg">{extraTotal.toFixed(1)}</div>
                <div className="whitespace-nowrap font-mono text-[10px]">
                  <span className={anyOtHigh ? "text-red-400" : "text-teal-400"}>OT {otTotal.toFixed(1)}</span>
                  <span className="text-slate-600"> · </span>
                  <span className="cg-num text-violet-400">CG {effortTotal.toFixed(1)}</span>
                </div>
              </div>
              <div className="border-l border-slate-700 px-2.5 py-1 md:px-3.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Tổng</div>
                <div className="font-mono text-base font-semibold text-slate-50 md:text-lg">{weekTotal.toFixed(1)}</div>
                <div className="text-[10px] text-slate-500">giờ</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tiến độ so với target tuần — target đã trừ ngày lễ và ngày nghỉ phép nên luôn phản ánh đúng thực tế */}
        {weekTarget > 0 && (
          <div className="mt-2.5 border-t border-slate-800 pt-2.5">
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span className="text-slate-500">Tiến độ tuần</span>
              <span className="font-mono text-slate-400">
                {stdTotal.toFixed(1)} / {weekTarget.toFixed(1)} giờ chuẩn
                <span className={`ml-2 ${stdTotal >= weekTarget ? "text-blue-400" : "text-amber-400"}`}>
                  {stdTotal >= weekTarget ? "đủ target" : `còn thiếu ${(weekTarget - stdTotal).toFixed(1)}`}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full transition-all ${stdTotal >= weekTarget ? "bg-blue-400" : "bg-amber-500"}`} style={{ width: `${targetPct}%` }} />
            </div>
          </div>
        )}
      </div>


      {/* v8.6 — tuần đã quá hạn chấm công (khoá sau N tuần) / đang được mở chấm bù
          v13.31: gửi xong cả tuần thì ẩn hẳn — lời nhắc "nhớ bấm Gửi giờ công" không còn việc gì để làm */}
      {!admin && (pastDays.length > 0 || openUntil) && !(sentDays.length > 0 && toSend.length === 0) && (
        <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${openUntil ? "border-teal-900 bg-teal-950/60 text-teal-100" : "border-slate-700 bg-slate-900 text-slate-300"}`}>
          {openUntil ? <Unlock size={17} className="mt-0.5 shrink-0 text-teal-400" /> : <Lock size={17} className="mt-0.5 shrink-0 text-slate-400" />}
          <div>
            {openUntil
              ? <>Quản lý đang mở chấm bù tuần này cho bạn tới hết ngày <b>{dLabel(openUntil)}</b>. Nhập xong nhớ bấm Gửi giờ công.</>
              : <>{pastDays.length === 7 ? "Tuần này" : `${pastDays.map(dayName).join(", ")}`} đã quá hạn chấm công — chỉ nhập / sửa được {pastWeeks(cfg)} tuần gần nhất.
                  {" "}Cần chấm bù thì nhờ quản lý mở.</>}
          </div>
        </div>
      )}

      {!loading && myTasks.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-900 bg-amber-950 p-3 text-sm text-amber-100">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            {emp?.role
              ? <>Vai trò <b>{roleLabel(emp.role)}</b> chưa được gán tác vụ nào.</>
              : <>Bạn chưa được phân vai trò và chưa có tác vụ dùng chung nào.</>}
            {" "}Nhờ quản lý vào tab Tác vụ bổ sung, hoặc kiểm tra lại vai trò của bạn ở tab Nhân sự.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-10 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} /> Đang tải bảng công…</div>
      ) : (
        <>
          {/* v2.9: bỏ ô thêm nhanh và chip gợi ý — thêm dòng bằng nút "Thêm dòng" / nút + ở đầu khối */}
          {/* DESKTOP */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 md:block">
            <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  {/* Ba trường gộp về một cột: hàng trên Dự án + Giai đoạn, hàng dưới Hạng mục nằm ngang hàng với giờ công */}
                  <th className="px-4 py-3 font-medium" style={{ width: "50%" }}>Dự án · Giai đoạn · Hạng mục</th>
                  {days.map((d, i) => {
                    const hol = holidayMap.has(d); const lv = leaveInfo(leaveMap[d]);
                    return (
                      <th key={d} data-dk={i} className={`ts-dh px-1 py-1.5 text-center font-medium ${dayCol(d)} ${hol ? "text-slate-100" : lv ? "text-sky-400" : isIncomplete(d) ? "text-amber-400" : i === 6 ? "text-slate-600" : ""}`}
                        title={hol ? holidayMap.get(d) : lv ? lv.label : undefined}>
                        <div className={`mx-auto flex flex-col items-center justify-center bg-center bg-no-repeat ${hol ? "" : "w-fit"}`}
                          style={hol ? { width: 50, height: 50, backgroundImage: `url("data:image/svg+xml,${HOLIDAY_RING_SVG}")`, backgroundSize: "100% 100%" } : undefined}>
                          <div className="flex items-center justify-center gap-1">
                            {DOW[i]}
                            {isSent(d) && <Lock size={10} className="text-teal-500" />}
                            {hol ? null : lv ? <span className="text-[9px]">{lv.short}</span> : isIncomplete(d) ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Chưa đủ giờ chuẩn" /> : null}
                          </div>
                          <div className={`ts-dl font-mono text-xs font-normal normal-case ${i === 6 ? "text-slate-600" : "text-slate-100"}`}>{dLabel(d)}</div>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-center font-medium" style={{ width: "7%" }}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Tuần này chưa có tác vụ nào. Bấm <b className="text-slate-300">Thêm tác vụ</b> để bắt đầu.
                  </td></tr>
                )}
              </tbody>

              {/* Mỗi dòng chấm công là một tbody riêng gồm 2 hàng: hover và viền dưới nhờ vậy bao trọn cả cụm.
                  selectCls đã có sẵn w-full nên tỉ lệ rộng phải đặt ở div bọc ngoài bằng flexBasis. */}
              {groups.map((g) => {
                const noProj = g.projectId === NO_PROJECT; // v2.9: khối "Khác" — không có giai đoạn
                const blank = g.projectId === "";
                const open = openKeys.has(g.key);
                const gLocked = g.items.some(({ r }) => rowLocked(r)); // khối có giờ của ngày đã gửi: không đổi dự án/giai đoạn
                const gHas = g.items.some(({ r }) => rowHasHours(r));
                const canEdit = !locked && !blank && !projClosed(g.items[0].r);
                const gt = g.items.reduce((s, { r }) => s + days.reduce((a, d) => a + (r.days[d] || 0), 0), 0);
                const secs = blank ? [] : sectionsOf(g, open);
                return (
                  <tbody key={g.key} className={`border-b border-slate-800 ${open ? "bg-slate-800/40" : ""}`}>
                    {/* Đầu khối: nút ✓ / Sửa + dự án + giai đoạn */}
                    <tr>
                      <td className="px-3 pb-1 pt-2.5">
                        <div className="flex items-center gap-2">
                          <div className="shrink-0" style={{ width: GUT }}>
                            {open ? (
                              <button onClick={() => doneGroup(g.key)} title="Xong — tạm lưu giờ của khối này"
                                className={`${iconBtn} border-teal-600 bg-teal-600 text-white hover:border-teal-500 hover:bg-teal-500 hover:text-white`}><Check size={16} /></button>
                            ) : canEdit ? (
                              <button onClick={() => editGroup(g.key)} title="Sửa giờ của khối này"
                                className={`${iconBtn} pen-glow`}><Pencil size={14} /></button>
                            ) : null}
                          </div>
                          <div className="min-w-0" style={{ flexBasis: "58%", flexGrow: 1 }}>
                            <select disabled={gLocked || (!blank && (!open || gHas))} value={g.projectId} onChange={(e) => updGroup(g.key, { projectId: e.target.value })}
                              title={!blank && gHas ? "Khối đã có giờ — xoá giờ hoặc xoá khối để đổi dự án" : undefined}
                              className={`disabled:opacity-60 ${selectCls}`}>{projOptions(g.items[0].r)}</select>
                          </div>
                          <div className="min-w-0" style={{ flexBasis: "42%", flexGrow: 1 }}>
                            {!noProj && (
                              <select disabled={gLocked || blank || !open || phaseFixed(g)} value={g.phaseId} onChange={(e) => updGroup(g.key, { phaseId: e.target.value })}
                                title={phaseInfo(g.phaseId)?.desc}
                                className={`disabled:opacity-60 ${selectCls}`}>{phaseOptions(g.phaseId, g.projectId)}</select>
                            )}
                          </div>
                          {/* v3.3: thùng rác xoá cả khối nằm ngay bên phải ô giai đoạn */}
                          <div className="shrink-0" style={{ width: GUT }}>
                            {!gLocked && !locked && (
                              <button onClick={() => delGroup(g.key)} title="Xoá cả khối dự án này" aria-label="Xoá cả khối dự án này"
                                className={`${iconBtn} hover:border-rose-800 hover:text-rose-300`}><Trash2 size={16} /></button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td colSpan={7} className="px-2 pb-1 pt-2.5">
                        <div className="flex items-center justify-end gap-3 text-xs">
                          {isSupProj(g.projectId) && <span className="sup-tag rounded-md border border-violet-800 bg-violet-950 px-2 py-0.5 text-violet-300">Hỗ trợ tới hết {dLabel(supUntil(g.projectId))}</span>}
                        </div>
                      </td>
                      <td className="px-2 pb-1 pt-2.5" />{/* v3.5: bỏ số tổng của khối dự án — tổng chỉ còn ở hàng cuối bảng */}
                    </tr>

                    {blank && (
                      <tr><td colSpan={9} className="px-3 pb-3 pt-1">

                      </td></tr>
                    )}

                    {secs.map((sec, si) => (
                      <React.Fragment key={sec.label}>
                        {/* v5.0: nhóm Tăng ca chưa có dòng nào = đang ẩn, chỉ hiện nút "+ Tăng ca" */}
                        {open && sec.ot && sec.items.length === 0 && (
                          <tr><td colSpan={9} className="px-3 pb-2.5 pt-2">
                            <div style={{ paddingLeft: GUT + 8 }}>
                              <button onClick={() => addOtRow(g)} disabled={locked || projClosed(g.items[0].r)}
                                className={`${btnBase} border border-teal-900 text-teal-300 hover:border-teal-700 disabled:opacity-40`}><Zap size={14} /> Tăng ca</button>
                            </div>
                          </td></tr>
                        )}
                        {/* v6.2: nhóm Công việc chung / Vắng mặt = nhãn màu bo tròn + đường kẻ mảnh, tách khỏi tác vụ bên dưới */}
                        {open && sec.chip && (
                          <tr><td colSpan={9} className="px-3 pb-1 pt-3.5">
                            <div className="flex items-center gap-2.5" style={{ paddingLeft: GUT + 8 }}>
                              <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `${sec.chip}2e`, color: sec.chip }}>{sec.label}</span>
                              <i className="h-px flex-1 bg-slate-700" />
                            </div>
                          </td></tr>
                        )}
                        {open && !sec.chip && !sec.noHead && !(sec.ot && sec.items.length === 0) && (
                          <tr><td colSpan={9} className="px-3 pb-0.5 pt-2.5">
                            <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${sec.ot ? "text-teal-400" : "text-slate-500"}`} style={{ paddingLeft: GUT + 8 }}>
                              {sec.ot && <Zap size={11} />}{sec.label}
                              {sec.ot && sec.items.length > 0 && <span className="ml-2 normal-case tracking-normal text-slate-500">Tác vụ · Khung giờ</span>}
                            </div>
                          </td></tr>
                        )}
                        {sec.items.map(({ r, i }, n) => {
                          const rt = days.reduce((s, d) => s + (r.days[d] || 0), 0);
                          const last = si === secs.length - 1 && n === sec.items.length - 1;
                          const pb = last ? "pb-2.5" : "pb-0";
                          const ot = isOtTask(taskById.get(r.taskId));
                          return (
                            <tr key={i} className="ts-row group/row">
                              <td className={`px-3 ${open ? "pt-1" : "pt-0.5"} ${pb}`}>
                                <div className="flex items-center gap-2">
                                  <div className="shrink-0" style={{ width: GUT }} />
                                  {open && ot ? otPickers(r, i) : (
                                  <div className="min-w-0 flex-1">
                                    <div className={`truncate text-sm transition-colors ${ot && !open ? "text-teal-300" : "text-slate-100"} group-hover/row:text-teal-200 group-focus-within/row:text-teal-200 group-hover/row:font-semibold group-focus-within/row:font-semibold`} title={rowLabel(r, open)}>
                                      {rowLabel(r, open)}
                                    </div>
                                    {open && rowDesc(r) && <div className="truncate text-[11px] leading-tight text-slate-600 group-hover/row:text-slate-400 group-focus-within/row:text-slate-400" title={rowDesc(r)}>{rowDesc(r)}</div>}
                                  </div>
                                  )}
                                  <div className="flex shrink-0 items-center gap-1">
                                    {open && !ot && !isLeaveTask(r.taskId) && (
                                      <button disabled={locked || projClosed(r) || !rowReady(r)} onClick={() => fillStandard(i)} title="Điền giờ chuẩn cho cả tuần vào các ô còn trống"
                                        className={`${iconBtn} disabled:opacity-40`}><Zap size={14} /></button>
                                    )}
                                    {/* v5.0: dòng tăng ca xoá được cả dòng, kể cả khi chưa nhập giờ (dòng có giờ của ngày đã gửi thì không) */}
                                    {open && ot && (
                                      <button disabled={locked || rowLocked(r)} onClick={() => delRow(i)} title="Xoá dòng tăng ca này" aria-label="Xoá dòng tăng ca này"
                                        className={`${iconBtn} hover:border-rose-800 hover:text-rose-300 disabled:opacity-40`}><Trash2 size={14} /></button>
                                    )}
                                    {/* v3.3: chỉ hiện khi hạng mục có giờ còn xoá được trong tuần */}
                                    {open && !ot && canClear(r) && (
                                      <button onClick={() => clearRow(i)} title="Xoá hết giờ của hạng mục này trong tuần" aria-label="Xoá hết giờ của hạng mục này trong tuần"
                                        className={`${iconBtn} hover:border-rose-800 hover:text-rose-300`}><Eraser size={14} /></button>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {days.map((d, k) => (
                                <td key={d} className={`px-1 ${open ? "pt-1" : "pt-0.5"} ${pb} ${dayCol(d)}`}>
                                  {open ? (
                                    <input ref={(el) => { gridInputs.current[`${i}:${k}`] = el; }}
                                      type="number" min="0" max="24" step="0.5" value={r.days[d] ?? ""} placeholder="" disabled={dayLocked(d) || projClosed(r) || futureBlocked(r, d) || !rowReady(r)}
                                      onChange={(e) => setHour(i, d, e.target.value)}
                                      onFocus={(e) => { e.target.select(); markDay(k); }}
                                      onBlur={() => markDay(-1)}
                                      /* v13.28: lăn chuột giữa không được tăng / giảm giờ nữa */
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onKeyDown={(e) => gridKey(e, i, k)}
                                      title={ot ? `Tối đa ${fmtH(otMaxHours(taskById.get(r.taskId)))} giờ` : undefined}
                                      className={`${CTRL} w-full rounded-md border bg-slate-950 px-1 text-center font-mono text-base font-medium focus:border-teal-500 focus:outline-none disabled:opacity-60 ${ot && r.days[d] > otMaxHours(taskById.get(r.taskId)) ? "border-rose-600 text-rose-300" : ot ? "border-teal-900 text-slate-100" : isIncomplete(d) ? "border-amber-700/60 text-slate-100" : k === 6 ? "border-slate-800 text-slate-100" : "border-slate-700 text-slate-100"}`} />
                                  ) : (
                                    (() => {
                                      /* v12.37 N1 — bấm thẳng vào ô giờ của khối đang đóng: mở khối và đặt con trỏ ở đúng ô đó */
                                      const pick = canEdit && !dayLocked(d) && !projClosed(r) && !futureBlocked(r, d) && rowReady(r);
                                      return (
                                        <div onClick={pick ? () => { pendingFocus.current = { key: rowKey(r), k }; editGroup(g.key); } : undefined}
                                          title={pick ? "Bấm để sửa giờ" : undefined}
                                          className={`py-1.5 text-center font-mono text-sm ${pick ? "ts-pick" : ""} ${r.days[d] > 0 ? (ot ? "text-teal-300" : "text-slate-200") : "text-slate-700"}`}>{r.days[d] > 0 ? r.days[d] : "·"}</div>
                                      );
                                    })()
                                  )}
                                </td>
                              ))}
                              <td className={`px-2 ${open ? "pt-1" : "pt-0.5"} ${pb}`} />{/* v3.5: bỏ số tổng từng hạng mục */}
                            </tr>
                          );
                        })}
                        {open && sec.ot && sec.items.length > 0 && (
                          <tr><td colSpan={9} className="px-3 pb-2.5 pt-1.5">
                            <div style={{ paddingLeft: GUT + 8 }}>
                              <button onClick={() => addOtRow(g)} disabled={locked || projClosed(g.items[0].r)}
                                className={`${btnBase} border border-teal-900 text-teal-300 hover:border-teal-700 disabled:opacity-40`}><Plus size={14} /> Thêm dòng tăng ca</button>
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                );
              })}
              {/* v3.7 (phương án A) — chân bảng đọc như phép cộng: Giờ chuẩn + OT + Giờ cố gắng = Tổng theo ngày.
                  Ba hàng chi tiết thu gọn mặc định; bấm nút mũi tên cạnh "Tổng theo ngày" để mở ra. */}
              <tfoot>
                {showSplit && extraTotal > 0 && (<>
                  <tr className="border-t border-slate-700 font-mono text-xs">
                    <td className="px-4 py-2 font-sans text-xs text-slate-400" title="Tổng theo ngày trừ OT và giờ cố gắng">
                      <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-blue-400" />Giờ chuẩn</td>
                    {days.map((d) => {
                      const st = stdHrs(d);
                      return <td key={d} className={`px-1 py-2 text-center ${dayCol(d)} ${isIncomplete(d) ? "text-amber-400" : st ? "text-blue-400" : "text-slate-700"}`}>{st ? st.toFixed(1) : "·"}</td>;
                    })}
                    <td className="px-2 py-2 text-center font-semibold text-blue-400">{stdTotal.toFixed(1)}</td>
                  </tr>
                  {otTotal > 0 && (
                    <tr className="border-t border-slate-800 font-mono text-xs">
                      <td className="px-4 py-2 font-sans text-xs text-slate-400">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-teal-400" />+ OT<span className="ml-1.5 text-[11px] text-slate-600">hạng mục Tăng ca</span></td>
                      {days.map((d) => {
                        const ot = otHrs(d);
                        const hot = ot > OT_ALERT; // vượt ngưỡng thì đổi đỏ, khỏi phải nhẩm
                        return <td key={d} title={hot ? `OT vượt ${OT_ALERT} giờ` : undefined}
                          className={`px-1 py-2 text-center ${dayCol(d)} ${hot ? "font-semibold text-red-400" : ot ? "text-teal-400" : "text-slate-700"}`}>{ot ? ot.toFixed(1) : "·"}</td>;
                      })}
                      <td className={`px-2 py-2 text-center font-semibold ${anyOtHigh ? "text-red-400" : "text-teal-400"}`}>{otTotal.toFixed(1)}</td>
                    </tr>
                  )}
                  {effortTotal > 0 && (
                    <tr className="border-t border-slate-800 font-mono text-xs">
                      <td className="px-4 py-2 font-sans text-xs text-slate-400" title="Giờ làm việc vượt giờ chuẩn của ngày. Không phải OT, không tính vào chi phí dự án.">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-violet-400" />+ Giờ cố gắng<span className="ml-1.5 text-[11px] text-slate-600">vượt giờ chuẩn</span></td>
                      {days.map((d) => {
                        const ef = effortHrs(d);
                        return <td key={d} className={`px-1 py-2 text-center ${dayCol(d)} ${ef ? "text-violet-400" : "text-slate-700"}`}>{ef ? <span className="cg-num">{ef.toFixed(1)}</span> : "·"}</td>;
                      })}
                      <td className="px-2 py-2 text-center font-semibold text-violet-400"><span className="cg-num">{effortTotal.toFixed(1)}</span></td>
                    </tr>
                  )}
                </>)}
                <tr className={`${showSplit && extraTotal > 0 ? "border-t-2 border-slate-600" : "border-t border-slate-700"} bg-slate-900/60 font-mono text-[15px] font-semibold`}>
                  <td className="px-4 py-3 font-sans text-xs uppercase tracking-wider text-slate-200">
                    <span className="flex items-center gap-2">
                      {extraTotal > 0 && (
                        <button onClick={() => setShowSplit((v) => !v)} aria-expanded={showSplit}
                          aria-label={showSplit ? "Thu gọn giờ chuẩn, OT, giờ cố gắng" : "Mở giờ chuẩn, OT, giờ cố gắng"}
                          title={showSplit ? "Thu gọn" : "Xem giờ chuẩn · OT · giờ cố gắng"}
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 text-slate-400 hover:border-teal-600 hover:text-teal-300">
                          {showSplit ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                      {showSplit && extraTotal > 0 ? "= Tổng theo ngày" : "Tổng theo ngày"}
                    </span>
                  </td>
                  {days.map((d) => {
                    const t = dayTotal(d);
                    return <td key={d} className={`px-1 py-3 text-center ${dayCol(d)} ${isOverDaily(d) ? "text-rose-400" : isIncomplete(d) ? "text-amber-400" : "text-slate-100"}`}>{t ? t.toFixed(1) : "—"}</td>;
                  })}
                  <td className="px-2 py-3 text-center text-slate-50">{weekTotal.toFixed(1)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* MOBILE — v8.4: dải ngày tô đặc ngày đang xem, khối dự án 1 dòng tiêu đề, nhập giờ − / + ngay tại dòng */}
          <div className="space-y-2.5 md:hidden">
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => {
                const t = dayTotal(d); const on = d === activeDay; const incomplete = isIncomplete(d);
                const hol = holidayMap.has(d); const lv = leaveInfo(leaveMap[d]);
                // chấm màu góc: lễ đỏ · nghỉ phép xanh · vượt ngưỡng đỏ · thiếu giờ cam · có giờ cố gắng tím
                const dot = hol ? "bg-red-400" : lv ? "bg-sky-400" : isOverDaily(d) ? "bg-red-400" : incomplete ? "bg-amber-400" : effortHrs(d) > 0 ? "bg-violet-400" : "";
                return (
                  <button key={d} onClick={() => pickDay(d)}
                    className={`relative flex flex-col items-center rounded-xl border pb-1.5 pt-1 ${on ? "border-teal-600 bg-teal-600" : d === todayKey ? "border-teal-800 bg-slate-900" : "border-slate-800 bg-slate-900"} ${!on && d > todayKey ? "opacity-50" : ""}`}>
                    {isSent(d) && <Lock size={9} className={`absolute left-1 top-1 ${on ? "text-white" : "text-teal-500"}`} />}
                    {dot && <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${dot}`} />}
                    <span className={`text-[11px] ${on ? "text-white" : "text-slate-500"}`}>{DOW[i]}</span>
                    <span className={`text-[13.5px] font-medium leading-tight ${on ? "text-white" : "text-slate-100"}`}>{parseD(d).getDate()}</span>
                    <span className={`font-mono text-[10.5px] leading-tight ${on ? "text-white" : isOverDaily(d) ? "text-rose-400" : incomplete ? "text-amber-400" : t ? "text-slate-400" : "text-slate-600"}`}>{t ? fmtH(t) : "–"}</span>
                  </button>
                );
              })}
            </div>

            {(() => {
              const d = activeDay; const t = dayTotal(d); const ef = effortHrs(d); const ot = otHrs(d);
              return (
                <div className="flex items-baseline justify-between gap-2 px-1 pt-0.5">
                  <span className="whitespace-nowrap text-[14.5px] font-semibold text-slate-100">{DAY_FULL[days.indexOf(d)]} {dLabel(d)}</span>
                  <span className="min-w-0 truncate text-right text-[12.5px] text-slate-500">
                    <span className="font-medium text-slate-100">{fmtH(t)}</span> giờ
                    {t > 0 && <> · chuẩn {fmtH(stdHrs(d))}</>}
                    {ef > 0 && <span className="cg-num text-violet-400"> · +{fmtH(ef)} cố gắng</span>}
                    {ot > 0 && <span className="text-teal-400"> · OT {fmtH(ot)}</span>}
                  </span>
                </div>
              );
            })()}

            {groups.map((g) => {
              if (g.projectId === "") return null;   // khối trống mặc định: điện thoại dùng nút "Thêm dự án / tác vụ" bên dưới
              const noProj = g.projectId === NO_PROJECT;
              const open = openKeys.has(g.key);
              const gLocked = g.items.some(({ r }) => rowLocked(r));
              const gHas = g.items.some(({ r }) => rowHasHours(r));
              const canEdit = !locked && !projClosed(g.items[0].r);
              const canDel = !gLocked && !locked;
              const proj = cfg.projects.find((p) => p.id === g.projectId);
              // v9.0: khối thu gọn chỉ hiện tác vụ có giờ của ngày đang xem; không có tác vụ nào thì ẩn cả khối
              // v9.2: khối mở đủ tác vụ — nhóm Tăng ca cũng chỉ hiện dòng tăng ca của ngày đang xem
              const secs = sectionsOf(g, open).map((sec) => (open && !sec.ot ? sec : { ...sec, items: sec.items.filter(({ r }) => showToday(r)) })).filter((sec) => open || sec.items.length);
              if (!open && !secs.length) return null;
              return (
                <div key={g.key} className={`overflow-hidden rounded-2xl border bg-slate-900 ${open ? "border-teal-800" : isSupProj(g.projectId) ? "border-violet-800" : "border-slate-800"}`}>
                  <div className="flex items-center gap-2 border-b border-slate-800 py-1.5 pl-3 pr-1.5">
                    {noProj
                      ? <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-px text-[11px] font-semibold text-slate-400">CHUNG</span>
                      : proj?.code && <span className={`shrink-0 rounded-md px-1.5 py-px font-mono text-[11px] font-semibold ${isSupProj(g.projectId) ? "bg-violet-950 text-violet-300" : "bg-teal-950 text-teal-400"}`}>{proj.code}</span>}
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-slate-100">{noProj ? "Việc chung · Vắng mặt" : projName(g.projectId)}</span>
                    {!noProj && <span className="shrink-0 whitespace-nowrap rounded-md border border-slate-700 px-1.5 py-px text-[11px] text-slate-400">{g.phaseId}{phaseInfo(g.phaseId) ? ` ${phaseInfo(g.phaseId).name}` : ""}</span>}
                    {/* v8.9 — thu gọn (chỉ còn tác vụ có giờ) / mở đủ tác vụ */}
                    {(open || canEdit) && (
                      <button onClick={() => (open ? foldGroup(g.key) : editGroup(g.key))} aria-label={open ? "Thu gọn — chỉ còn tác vụ có giờ" : "Mở đủ tác vụ"} title={open ? "Thu gọn — chỉ còn tác vụ có giờ" : "Mở đủ tác vụ"}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400">{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
                    )}
                    {/* v9.1: thùng rác thay nút ⋯ — xoá dự án khỏi ngày đang xem (sửa thì bấm ˅ mở rộng) */}
                    {!locked && !dayLocked(activeDay) && !projClosed(g.items[0].r) && (
                      <button onClick={() => dayDelGroup(g.key)} aria-label="Xoá dự án khỏi ngày này" title="Xoá dự án khỏi ngày này"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-400"><Trash2 size={17} /></button>
                    )}
                  </div>
                  {isSupProj(g.projectId) && (
                    <div className="border-b border-violet-900/60 bg-violet-950/60 px-3 py-1.5 text-[11.5px] text-violet-300">Hỗ trợ tới hết <b>{dLabel(supUntil(g.projectId))}</b> — ngày ngoài thời hạn không nhập được</div>
                  )}
                  {menuKey === g.key && (
                    <div className="flex flex-wrap gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2">
                      {canEdit && !open && <button onClick={() => { editGroup(g.key); setMenuKey(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs text-slate-200"><Pencil size={13} /> Sửa khối · tăng ca</button>}
                      {canDel && <button onClick={() => { delGroup(g.key); setMenuKey(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-900 px-3 text-xs text-rose-300"><Trash2 size={13} /> Xoá khối</button>}
                    </div>
                  )}
                  {/* khối đang mở: đổi giai đoạn (nếu còn chọn được) */}
                  {open && !noProj && !phaseFixed(g) && (
                    <div className="px-3 pt-2.5">
                      <select disabled={gLocked || gHas} value={g.phaseId} onChange={(e) => updGroup(g.key, { phaseId: e.target.value })} className={`disabled:opacity-60 ${selectCls}`}>{phaseOptions(g.phaseId, g.projectId)}</select>
                    </div>
                  )}

                  {secs.map((sec) => (
                    <div key={sec.label}>
                      {open && sec.chip && (
                        <div className="flex items-center gap-2 px-3 pt-3">
                          <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `${sec.chip}2e`, color: sec.chip }}>{sec.label}</span>
                          <i className="h-px flex-1 bg-slate-700" />
                        </div>
                      )}
                      {open && !sec.chip && !sec.noHead && !(sec.ot && sec.items.length === 0) && <div className={`flex items-center gap-1.5 px-3 pt-3 text-[11px] font-medium uppercase tracking-wider ${sec.ot ? "text-teal-400" : "text-slate-500"}`}>{sec.ot && <Zap size={11} />}{sec.label}</div>}
                      <div className="divide-y divide-slate-800">
                        {sec.items.map(({ r, i }) => {
                          const rt = days.reduce((s2, d) => s2 + (r.days[d] || 0), 0);
                          const ot = isOtTask(taskById.get(r.taskId));
                          return (
                            <div key={i} className="relative py-2 pl-3 pr-2.5">
                              {r.days[activeDay] > 0 && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-teal-500" />}
                              {open && ot && <div className="mb-2">{otPickers(r, i, true)}</div>}
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  {!(open && ot) && <div className={`text-[13.5px] leading-snug ${ot ? "text-teal-300" : r.days[activeDay] > 0 ? "font-medium text-slate-50" : rt ? "text-slate-200" : "text-slate-400"}`}>{rowLabel(r, open)}</div>}
                                  {open && rowDesc(r) && <div className="text-[11px] leading-tight text-slate-500">{rowDesc(r)}</div>}
                                </div>
                                {stepper(r, i)}
                                {open && ot && (
                                  <button disabled={locked || rowLocked(r)} onClick={() => delRow(i)} title="Xoá dòng tăng ca này" aria-label="Xoá dòng tăng ca này"
                                    className={`${iconBtn} shrink-0 disabled:opacity-40`}><Trash2 size={15} /></button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {open && sec.ot && (
                        <div className="px-3 pt-1">
                          <button onClick={() => addOtRow(g)} disabled={locked || projClosed(g.items[0].r)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-900 px-3 text-xs text-teal-300 disabled:opacity-40">
                            {sec.items.length ? <><Plus size={13} /> Thêm dòng tăng ca</> : <><Zap size={13} /> Tăng ca</>}</button>
                        </div>
                      )}
                    </div>
                  ))}

                  {open ? (
                    <div className="px-3 pb-3 pt-2.5">
                      <button onClick={() => doneGroup(g.key)} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 text-sm font-medium text-white"><Check size={15} /> Xong</button>
                    </div>
                  ) : canEdit && (
                    <button onClick={() => editGroup(g.key)} className="block w-full border-t border-dashed border-slate-800 px-3 py-2.5 text-left text-[12.5px] font-medium text-teal-400">
                      + {noProj ? "Tác vụ chung / vắng mặt khác" : "Tác vụ khác trong dự án này"}
                    </button>
                  )}
                </div>
              );
            })}

            {!groups.some((g) => g.projectId !== "" && (openKeys.has(g.key) || g.items.some(({ r }) => showToday(r)))) && (
              <p className="px-1 pt-1 text-center text-xs text-slate-500">Ngày này chưa chấm giờ.</p>
            )}
            <button onClick={openAddSheet} disabled={locked}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-slate-600 py-3 text-sm font-medium text-slate-200 disabled:opacity-40">
              <Plus size={16} /> Thêm dự án / tác vụ
            </button>
          </div>
        </>
      )}

      {/* v8.4: điện thoại — nhân sự dùng thanh Lưu nháp / Gửi cố định ở đáy màn (bên dưới); quản lý giữ nút như cũ */}
      <div className={`${admin ? "grid grid-cols-2" : "hidden"} gap-2 md:flex md:flex-wrap md:items-center`}>
        <button onClick={focusQuick} disabled={locked} className={`${btnGhost} hidden disabled:opacity-40 md:inline-flex`}><Plus size={15} /> Thêm tác vụ</button>
        {/* v1.9: quản lý lưu được khi sửa bảng công của người khác · v8.1: nhân sự có lại nút Lưu nháp (ghi lên server, chưa gửi) */}
        {!admin && (
          <button onClick={() => save("draft")} disabled={saving || locked} title="Lưu tạm giờ đang nhập lên hệ thống, chưa gửi — quản lý thấy là Nháp, chưa tính vào báo cáo"
            className={`${btnGhost} disabled:opacity-40`}>
            {saving && <Loader2 className="animate-spin" size={15} />} Lưu nháp
          </button>
        )}
        {admin && (
          <button onClick={() => save(null)} disabled={saving} className={`${btnGhost} disabled:opacity-40`}>
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Lưu thay đổi
          </button>
        )}
        {admin && sentDays.length > 0 && (
          <button onClick={() => save("unsubmit")} disabled={saving} className={`${btnGhost} disabled:opacity-40`}>
            <Unlock size={15} /> Mở khoá tuần này
          </button>
        )}
        {/* v3.5 — nhân sự đã gửi và không còn giờ mới nào chờ gửi: nút đổi thành "Đã gửi giờ công" (không bấm được).
            Nhập thêm giờ vào ngày chưa gửi thì nút quay lại "Gửi giờ công". */}
        {!admin && sentDays.length > 0 && toSend.length === 0 && !saving ? (
          <button disabled className={`col-span-2 w-full md:w-auto ${btnBase} cursor-default border border-teal-800 bg-teal-950 text-teal-300`}>
            <CheckCircle2 size={15} /> Đã gửi giờ công
          </button>
        ) : (
          <button onClick={() => (admin ? save("submit") : askSubmitWeek())} disabled={saving || locked} className={`col-span-2 w-full md:w-auto ${btnPrimary} disabled:opacity-40`}>
            {saving && !admin ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />} {admin ? "Đánh dấu đã gửi" : "Gửi giờ công"}
          </button>
        )}
        {atRisk && <span className="col-span-2 text-center text-xs text-amber-400 md:text-left">{admin ? "Có thay đổi chưa lưu" : "Có giờ chưa gửi"}</span>}
      </div>

      {/* v8.4 — điện thoại: Lưu nháp + Gửi giờ công cố định ngay trên thanh menu đáy, không phải cuộn */}
      {!admin && (
        <>
          <div className="h-14 md:hidden" />
          <div className="fixed inset-x-0 bottom-[52px] z-30 flex gap-2 border-t border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur md:hidden">
            <button onClick={() => save("draft")} disabled={saving || locked} title="Lưu tạm lên hệ thống, chưa gửi"
              className="inline-flex h-11 w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 text-sm font-medium text-slate-200 disabled:opacity-40">
              {saving && <Loader2 className="animate-spin" size={14} />} Lưu nháp
            </button>
            {sentDays.length > 0 && toSend.length === 0 && !saving ? (
              <button disabled className="inline-flex h-11 flex-1 cursor-default items-center justify-center gap-1.5 rounded-xl border border-teal-800 bg-teal-950 text-sm font-medium text-teal-300">
                <CheckCircle2 size={15} /> Đã gửi giờ công
              </button>
            ) : (
              <button onClick={askSubmitWeek} disabled={saving || locked}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-sm font-semibold text-white disabled:opacity-40">
                <CheckCircle2 size={15} /> Gửi giờ công
                {toSend.length > 0 && <span className="rounded-full bg-white/25 px-2 text-xs font-medium">{toSend.length} ngày</span>}
              </button>
            )}
          </div>
        </>
      )}

      {/* v8.4 — điện thoại: bảng trượt Thêm dự án / tác vụ */}
      {addSheet && (() => {
        const { pid, ph, picked } = addSheet;
        const khac = pid === NO_PROJECT;
        const phases = pid && !khac ? openPhasesOf(pid) : [];
        const lists = !pid ? [] : khac
          ? [["Công việc chung", commonPlain], ...(tlTasks.length ? [["Teamleader", tlTasks]] : []), ...(mgrTasks.length ? [["Quản lý", mgrTasks]] : []), ["Vắng mặt", LEAVE_TASKS]]
          : [["", projPlain.filter((t) => !isOtTask(t))], ...(tlTasks.length ? [["Teamleader", tlTasks]] : []), ...(mgrTasks.length ? [["Quản lý", mgrTasks]] : [])];
        const chip = (on) => `rounded-lg border px-2.5 py-1.5 text-[13px] ${on ? "border-teal-600 bg-teal-600 font-medium text-white" : "border-slate-700 bg-slate-900 text-slate-200"}`;
        const toggle = (tid) => setAddSheet((s) => ({ ...s, picked: s.picked.includes(tid) ? s.picked.filter((x) => x !== tid) : [...s.picked, tid] }));
        return (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60" onClick={() => setAddSheet(null)} />
            <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl border-t border-slate-700 bg-slate-900 px-4 pb-4 pt-2 shadow-2xl">
              <div className="mx-auto mb-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-700" />
              <div className="shrink-0">
                <div className="text-base font-semibold text-slate-100">Thêm tác vụ · {DOW[days.indexOf(activeDay)]} {dLabel(activeDay)}</div>
                <div className="text-xs text-slate-500">Dự án được giao cho bạn và giai đoạn đang mở</div>
              </div>
              <div className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mb-1.5 mt-3 text-[11px] uppercase tracking-wider text-slate-500">Dự án</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeProjects.filter((p) => !isSupProj(p.id)).map((p) => (
                    <button key={p.id} onClick={() => sheetPick(p.id)} className={chip(pid === p.id)}>
                      {p.code ? <>{p.code} <span className="opacity-70">{p.name}</span></> : p.name}
                    </button>
                  ))}
                  <button onClick={() => sheetPick(NO_PROJECT)} className={chip(khac)}>Việc chung · Vắng mặt</button>
                </div>
                {activeProjects.some((p) => isSupProj(p.id)) && (
                  <>
                    <div className="mb-1.5 mt-3 text-[11px] uppercase tracking-wider text-violet-400">Đang hỗ trợ</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeProjects.filter((p) => isSupProj(p.id)).map((p) => (
                        <button key={p.id} onClick={() => sheetPick(p.id)} className={pid === p.id ? chip(true) : "rounded-lg border border-violet-800 bg-slate-900 px-2.5 py-1.5 text-[13px] text-violet-300"}>
                          {p.code ? <>{p.code} <span className="opacity-70">{p.name}</span></> : p.name}
                          <span className="opacity-70"> · tới {dLabel(supUntil(p.id))}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {pid && !khac && (
                  <>
                    <div className="mb-1.5 mt-3 text-[11px] uppercase tracking-wider text-slate-500">Giai đoạn</div>
                    <div className="flex flex-wrap gap-1.5">
                      {phases.map((x) => (
                        <button key={x.id} onClick={() => setAddSheet((s) => ({ ...s, ph: x.id, picked: [] }))} className={chip(ph === x.id)}>{x.id} {x.name}</button>
                      ))}
                    </div>
                  </>
                )}
                {pid && (khac || ph) && (
                  <>
                    <div className="mb-0.5 mt-3 text-[11px] uppercase tracking-wider text-slate-500">Tác vụ (chọn nhiều)</div>
                    {lists.map(([label, list]) => (
                      <div key={label || "p"}>
                        {label && <div className="mt-2 text-xs font-medium text-slate-400">{label}</div>}
                        {list.length === 0 && <div className="py-2 text-xs text-slate-500">Chưa có tác vụ nào.</div>}
                        {list.map((t) => {
                          const has = sheetHas(pid, khac ? DEFAULT_PHASE : ph, t.id);
                          const on = has || picked.includes(t.id);
                          return (
                            <button key={t.id} disabled={has} onClick={() => toggle(t.id)}
                              className="flex w-full items-center gap-2.5 border-b border-slate-800 py-2.5 text-left text-[13.5px] text-slate-100 disabled:text-slate-500">
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-600"}`}>{on && <Check size={13} />}</span>
                              <span className="min-w-0 flex-1">{isLeaveTask(t.id) ? t.name : taskText(t)}</span>
                              {has && <span className="shrink-0 text-[11px] text-slate-500">đã có</span>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="mt-3 flex shrink-0 gap-2">
                <button onClick={() => setAddSheet(null)} className="h-11 w-24 shrink-0 rounded-xl border border-slate-700 text-sm font-medium text-slate-200">Huỷ</button>
                <button onClick={addPicked} disabled={!picked.length}
                  className="h-11 flex-1 rounded-xl bg-teal-600 text-sm font-semibold text-white disabled:opacity-40">
                  {picked.length ? `Thêm ${picked.length} tác vụ` : "Chọn tác vụ để thêm"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {saveFailed && (
        <div className="rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
            <div className="min-w-0">
              <b>Chưa ghi được lên hệ thống.</b> Giờ bạn nhập vẫn còn nguyên trên màn hình — đừng đóng trang.
              Bấm thử lại một lần nữa; nếu vẫn hỏng thì chép giờ ra để giữ.
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => save(admin ? null : "submit")} className={btnGhost}><Save size={14} /> {admin ? "Thử lưu lại" : "Thử gửi lại"}</button>
            <button onClick={copyEntered} className={btnGhost}><Copy size={14} /> Chép giờ đã nhập</button>
          </div>
        </div>
      )}

      {undoRow && !(undoRow.rows && undoRow.rows.some((u) => rows.some((x) => groupKey(x) === groupKey(u)))) && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-300">Đã xoá {undoRow.label}</span>
          <button onClick={undoDelete} className="shrink-0 text-xs text-teal-400 hover:text-teal-300">Hoàn tác</button>
          <button onClick={() => setUndoRow(null)} className="shrink-0 text-slate-500 hover:text-slate-300"><X size={14} /></button>
        </div>
      )}

      <NoteDialog
        open={noteRow !== null}
        readOnly={noteRow !== null && !!rows[noteRow] && rowLocked(rows[noteRow])}
        title={noteRow !== null && rows[noteRow] ? `${projName(rows[noteRow].projectId)} · ${taskName(rows[noteRow].taskId)}` : ""}
        value={noteRow !== null ? rows[noteRow]?.note : ""}
        onSave={(txt) => { upd(noteRow, { note: txt }); setNoteRow(null); }}
        onClose={() => setNoteRow(null)}
      />

      {/* v1.9: gửi xong là khoá, nên hỏi lại một lần */}
      <ConfirmDialog
        open={askSubmit}
        tone="ok"
        title={`Gửi giờ công ${toSend.length} ngày?`}
        desc={`${toSend.map(dayName).join(", ")} · tổng ${toSend.reduce((a, d) => a + dayTotal(d), 0).toFixed(1)} giờ. Gửi xong các ngày này bị khoá, chỉ quản lý mới mở được. Ngày chưa nhập vẫn để mở.`}
        confirmLabel="Gửi và khoá"
        cancelLabel="Xem lại"
        onConfirm={() => { setAskSubmit(false); save("submit"); }}
        onCancel={() => setAskSubmit(false)}
      />
      <ConfirmDialog
        open={pendingWeek !== null}
        title="Chuyển tuần khi chưa gửi?"
        desc="Giờ bạn vừa nhập ở tuần này chưa gửi nên sẽ mất. Bấm Giữ lại để quay về và bấm Gửi trước."
        confirmLabel="Bỏ giờ, chuyển tuần"
        onConfirm={() => { const m = pendingWeek; setPendingWeek(null); setDirty(false); setMonday(m); }}
        onCancel={() => setPendingWeek(null)}
      />
    </div>
  );
}

