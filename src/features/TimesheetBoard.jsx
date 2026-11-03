/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { Legend } from "recharts";
import {
  Download, ChevronLeft, ChevronRight, CheckCircle2, Loader2, Lock, Pencil, Check, X, Unlock, Search, Bell,
} from "lucide-react";
import { sendNudge, fetchNudgeLog, fetchNudgeLogRange } from "../push.js";
import { DEFAULT_HOURS, DOW, addDays, dLabel, effortHoursFor, fmt, lastOfMonth, makeHolidayIndex, minHoursFor, mondayOf, mondaysDue, mondaysOfMonth, pad, parseD, prevYm, weekDays, ymLabel, ymOf, ymsBetween } from "../core/date.jsx";
import { LAST_STORAGE_ERROR, bumpData, commitTs, daySent, dbTs, dbTsSent, ensureMonths, loadXlsx, refreshTs, slot, useDataTick, weekDone } from "../core/db.jsx";
import { DEFAULT_PHASE, DEPTS, LEAVE_TASKS, NO_PROJECT, NUDGE_GAP_MIN, OT_TASKS, ResignedBadge, empNameTag, fmtH, goneOnDay, isIdleTask, isLeaveTask, isOtId, isResigned, norm, pastCut, pastOpenUntil, pastWeeks, phaseLabel, roleTitle, supportKind, taskText } from "../core/domain.jsx";
import { isLight } from "../core/theme.jsx";
import { CTRL, FilterButton, PeriodField, Kpi, Panel, btnGhost, btnPrimary, iconBtn, inputCls, selectCls } from "../core/ui.jsx";
import { ALLOC_ST, allocLimits, allocState } from "../shared/alloc.jsx";
import { pct100 } from "./dashboard/calc.jsx";   // v13.24: % làm tròn đủ 100, dùng chung với tab Nhân sự
import { dayStyle, dayStyleSm } from "../shared/dayStyle.jsx";
import { SupportPanel } from "../shared/support.jsx";
import { EmployeeArea } from "./Timesheet.jsx";
import { accountsApi } from "../auth.js";

/* ============================ BẢNG CÔNG NHÂN SỰ (QUẢN LÝ) ============================ */
/* --------- v1.6: ma trận giờ công — hàng = nhân sự, cột = dự án, theo tháng ---------
   Đọc thẳng từ dữ liệu đã nằm trong bộ nhớ (dbTs), không tốn lệnh lưu trữ.
   v2.9: tác vụ chung và vắng mặt gom vào một cột riêng "Khác", không tính vào giờ dự án. */
export function HoursMatrix({ cfg, ym, flash, onPickEmp }) {
  const dataTick = useDataTick();   // v1.9: vẽ lại khi có người vừa gửi
  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("all");
  const [hideEmpty, setHideEmpty] = useState(false);

  const from = `${ym}-01`;
  const to = fmt(lastOfMonth(parseD(from)));
  const projById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskById = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes, cfg.otBands, cfg.otLegacy]);
  const projLabel = (id) => { if (id === NO_PROJECT) return "Khác"; const x = projById.get(id); return x ? (x.code ? `[${x.code}] ${x.name}` : x.name) : "(dự án đã xoá)"; };
  const projShort = (id) => { if (id === NO_PROJECT) return "Khác"; const x = projById.get(id); return x ? (x.code ? `${x.code} ${x.name}` : x.name) : "(đã xoá)"; };
  const taskLabel = (id) => { const t = taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  // Toàn bộ dòng giờ của tháng, gom theo (nhân sự, dự án)
  const base = useMemo(() => {
    const detail = [];
    for (const ymk of ymsBetween(from, to)) for (const e of cfg.employees) {
      const d = dbTsSent(e.id, ymk);   // v1.9: chỉ giờ của ngày đã gửi
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;
        const pid = isLeaveTask(r.taskId) ? NO_PROJECT : r.projectId;
        detail.push({ empId: e.id, date, hours: Number(h), projectId: pid, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, note: r.note || "" });
      }
    }
    return detail;
  }, [cfg.employees, from, to, dataTick]);

  const withHrs = useMemo(() => new Set(base.map((d) => d.empId)), [base]);
  const emps = cfg.employees.filter((e) => {
    if (isResigned(e) && !withHrs.has(e.id)) return false;   // v8.5: người đã nghỉ chỉ hiện khi kỳ này còn giờ của họ
    if (fDept !== "all" && e.dept !== fDept) return false;
    const kw = norm(q.trim());   // v6.6: gõ không dấu vẫn tìm ra
    return !kw || norm(`${e.name} ${e.code || ""} ${e.dept} ${e.role || ""} ${roleTitle(e.role)}`).includes(kw);
  });

  const view = useMemo(() => {
    const ids = new Set(emps.map((e) => e.id));
    const cell = new Map();            // empId -> Map(projectId -> giờ)
    const projTot = new Map();
    const empTot = new Map();
    for (const d of base) {
      if (!ids.has(d.empId)) continue;
      if (!cell.has(d.empId)) cell.set(d.empId, new Map());
      const m = cell.get(d.empId); m.set(d.projectId, (m.get(d.projectId) || 0) + d.hours);
      projTot.set(d.projectId, (projTot.get(d.projectId) || 0) + d.hours);
      empTot.set(d.empId, (empTot.get(d.empId) || 0) + d.hours);
    }
    // cột dự án xếp theo giờ giảm dần, "Khác" luôn ở cuối
    const cols = [...projTot.keys()].filter((k) => k !== NO_PROJECT).sort((a, b) => projTot.get(b) - projTot.get(a));
    const hasLeave = projTot.has(NO_PROJECT);
    let max = 0; for (const m of cell.values()) for (const [k, v] of m) if (k !== NO_PROJECT && v > max) max = v;
    const grand = [...projTot.values()].reduce((a, b) => a + b, 0);
    return { cell, projTot, empTot, cols, hasLeave, max, grand };
  }, [base, emps.map((e) => e.id).join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps

  const shown = hideEmpty ? emps.filter((e) => (view.empTot.get(e.id) || 0) > 0) : emps;
  const allCols = [...view.cols, ...(view.hasLeave ? [NO_PROJECT] : [])];
  const n1 = (v) => (Math.round(v * 10) / 10).toString();
  const empsNoHours = emps.filter((e) => !(view.empTot.get(e.id) || 0)).length;

  const exportXlsx = async () => {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();
    const mtx = shown.map((e) => {
      const row = { "Mã": e.code || "", "Nhân sự": empNameTag(e), "Bộ phận": e.dept, "Vai trò": roleTitle(e.role) };
      const m = view.cell.get(e.id);
      for (const c of allCols) row[projLabel(c)] = m?.get(c) || 0;
      row["Tổng giờ"] = view.empTot.get(e.id) || 0;
      return row;
    });
    const tot = { "Mã": "", "Nhân sự": "TỔNG", "Bộ phận": "", "Vai trò": "" };
    for (const c of allCols) tot[projLabel(c)] = view.projTot.get(c) || 0;
    tot["Tổng giờ"] = shown.reduce((a, e) => a + (view.empTot.get(e.id) || 0), 0);
    mtx.push(tot);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mtx), "Ma trận");
    const ids = new Set(shown.map((e) => e.id));
    const empMap = new Map(cfg.employees.map((e) => [e.id, e]));
    const detail = base.filter((d) => ids.has(d.empId))
      .sort((a, b) => (empMap.get(a.empId)?.name || "").localeCompare(empMap.get(b.empId)?.name || "") || a.date.localeCompare(b.date))
      .map((d) => {
        const e = empMap.get(d.empId);
        return { "Mã": e?.code || "", "Nhân sự": (e ? empNameTag(e) : "(đã xoá)"), "Bộ phận": e?.dept || "", "Vai trò": roleTitle(e?.role), "Ngày": d.date, "Thứ": DOW[(parseD(d.date).getDay() + 6) % 7],
          "Dự án": projLabel(d.projectId), "Loại": supportKind(cfg, d.empId, d.projectId, d.date), "Giai đoạn": d.projectId === NO_PROJECT ? "" : phaseLabel(d.phaseId), "Hạng mục": taskLabel(d.taskId), "Ghi chú": d.note || "", "Giờ": d.hours };
      });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Chi tiết");
    const need = mondaysDue(ym);
    const st = shown.map((e) => { const miss = need.filter((m) => !weekDone(e.id, m)); return { "Nhân sự": empNameTag(e), "Vai trò": roleTitle(e.role), "Số tuần cần nộp": need.length, "Đã nộp": need.length - miss.length, "Thiếu": miss.length, "Tuần thiếu": miss.map(dLabel).join(", ") }; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(st), "Tình trạng nộp");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = `ARTIUS_ma-tran-gio-cong_${ym}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    flash("Đã xuất file Excel.");
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-800 p-3 md:flex-row md:items-center md:gap-3 md:p-4">
        <div className="relative min-w-0 md:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự" className={`pl-9 ${inputCls}`} />
        </div>
        <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={`md:w-48 ${selectCls}`}>
          <option value="all">Mọi bộ phận</option>
          {DEPTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="accent-teal-500" />
          Ẩn người chưa có giờ
        </label>
        <button onClick={exportXlsx} disabled={shown.length === 0} className={`md:ml-auto ${btnPrimary} disabled:opacity-40`}><Download size={15} /> Xuất Excel</button>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-3 py-2 text-xs text-slate-500 md:px-4">
        <span>{ymLabel(ym)}</span>
        <span>Tổng <span className="font-mono text-slate-200">{n1(view.grand)}</span> giờ</span>
        <span>{view.cols.length} dự án</span>
        {empsNoHours > 0 && <span className="text-amber-400">{empsNoHours} người chưa có giờ</span>}
      </div>

      {shown.length === 0 || allCols.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-slate-500">{shown.length === 0 ? "Không có nhân sự nào khớp bộ lọc." : "Tháng này chưa có giờ công nào được chấm."}</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[200px] border-b border-slate-800 bg-slate-900 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 md:px-4">Nhân sự</th>
                {allCols.map((c) => (
                  <th key={c} title={projLabel(c)} className={`min-w-[110px] max-w-[160px] border-b border-slate-800 px-2 py-2 text-right text-[11px] font-medium ${c === NO_PROJECT ? "text-sky-400" : "text-slate-400"}`}>
                    <div className="truncate">{projShort(c)}</div>
                  </th>
                ))}
                <th className="min-w-[80px] border-b border-slate-800 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-slate-500 md:px-4">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const m = view.cell.get(e.id); const tot = view.empTot.get(e.id) || 0;
                return (
                  <tr key={e.id} className="group">
                    <td className="sticky left-0 z-10 border-b border-slate-800/70 bg-slate-900 px-3 py-1.5 md:px-4">
                      <button onClick={() => onPickEmp(e.id)} title="Xem và sửa bảng công chi tiết" className="block w-full text-left">
                        <span className="block truncate font-medium text-slate-100 group-hover:text-teal-300">{e.name}{isResigned(e) && <ResignedBadge />}</span>
                        <span className="block truncate text-[11px] text-slate-500">{e.dept}{e.role ? ` · ${e.role}` : ""}</span>
                      </button>
                    </td>
                    {allCols.map((c) => {
                      const v = m?.get(c) || 0;
                      const bg = v && c !== NO_PROJECT && view.max ? { backgroundColor: `rgba(20,184,166,${0.08 + 0.4 * (v / view.max)})` } : v ? { backgroundColor: "rgba(56,189,248,0.12)" } : undefined;
                      return <td key={c} style={bg} className={`border-b border-slate-800/70 px-2 py-1.5 text-right font-mono text-xs ${v ? "text-slate-100" : "text-slate-700"}`}>{v ? n1(v) : "·"}</td>;
                    })}
                    <td className={`border-b border-slate-800/70 px-3 py-1.5 text-right font-mono text-xs font-medium md:px-4 ${tot ? "text-teal-300" : "text-amber-500"}`}>{tot ? n1(tot) : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-400 md:px-4">Tổng</td>
                {allCols.map((c) => <td key={c} className="px-2 py-2 text-right font-mono text-xs font-medium text-slate-200">{n1(view.projTot.get(c) || 0)}</td>)}
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-teal-300 md:px-4">{n1(shown.reduce((a, e) => a + (view.empTot.get(e.id) || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* v7.9 — hôm nay ở bảng Tháng (giao diện Sáng): số ngày trong chip đen; dải xám liền một khối chạy dọc cả cột (vẽ ở TimesheetBoard) */
export const TODAY_BAND = "#e2e8f0";
export const TODAY_CHIP = { background: "#0f172a", color: "#fff", fontWeight: 700, borderRadius: 999 };
/* v7.8 — chấm "Nộp từng tuần" ở giao diện Sáng: cùng bộ màu đặc với nhãn trạng thái */
export const WEEK_DOT_L = { ok: "#059669", dr: "#f59e0b", gap: "#f59e0b", no: "#e11d48", fut: "#e2e8f0" };
export const weekDot = (ws) => (isLight() ? WEEK_DOT_L[ws] : WEEK_ST[ws][2]);
export const WEEK_ST = {
  ok: ["Đã nộp", "border-teal-900 bg-teal-950 text-teal-300", "#2dd4bf"],
  dr: ["Còn nháp", "border-amber-900 bg-amber-950/70 text-amber-300", "#fbbf24"],
  gap: ["Bỏ trống ngày", "border-amber-900 bg-amber-950/70 text-amber-300", "#fbbf24"],
  no: ["Chưa nộp", "border-rose-900 bg-rose-950 text-rose-300", "#fb7185"],
  fut: ["—", "", "#1e293b"],
};
export const DOW_OF = (d) => DOW[(parseD(d).getDay() + 6) % 7];
/* v5.9 — quản lý mở khoá cả tuần của một nhân sự từ Tổng quan bảng công (giống nút "Mở khoá tuần này" ở Chi tiết nhân viên):
   gỡ dấu đã gửi của 7 ngày + dấu tuần kiểu cũ; giờ công giữ nguyên, nhân sự sửa và gửi lại được. Đọc lại bản mới nhất trước khi ghi. */
export const unlockWeekTs = async (empId, monday) => {
  const wd = weekDays(monday), yms = [...new Set(wd.map(ymOf))];
  if (!(await refreshTs(empId, yms))) return false;
  const changes = {};
  for (const ym of yms) {
    const b = dbTs(empId, ym); if (!b) continue;
    const sent = { ...(b.sent || {}) }, weeks = { ...(b.weeks || {}) };
    for (const d of wd) if (ymOf(d) === ym) delete sent[d];
    delete weeks[monday];
    changes[slot(empId, ym)] = { ...b, sent, weeks };
  }
  const ok = await commitTs(changes);
  bumpData();
  return ok;
};

/* v6.0 — sửa nhanh một ô ngày (quản lý): ghi giờ của ngày `d` cho các dòng `vals` { "<khoá dòng>": giờ }.
   Đọc lại bản mới nhất trước khi ghi; giữ nguyên dấu đã gửi của ngày (giống quản lý sửa ở Chi tiết nhân viên);
   ngày không còn giờ nào thì bỏ dấu đã gửi. Dòng không còn giờ nào trong tháng thì bỏ. */
export const tsRowKey = (r) => `${r.projectId}|${r.phaseId || DEFAULT_PHASE}|${r.taskId}|${r.otFor || ""}`;
export const saveDayTs = async (empId, d, vals) => {
  const ym = ymOf(d);
  if (!(await refreshTs(empId, [ym]))) return false;
  const b = dbTs(empId, ym) || { rows: [], weeks: {}, sent: {} };
  const rows = (b.rows || []).map((r) => {
    const k = tsRowKey(r);
    if (!(k in vals)) return r;
    const days = { ...r.days }, h = Number(vals[k]) || 0;
    if (h > 0) days[d] = h; else delete days[d];
    return { ...r, days };
  }).filter((r) => Object.values(r.days || {}).some((v) => Number(v) > 0));
  const sent = { ...(b.sent || {}) };
  if (!rows.some((r) => Number(r.days[d]) > 0)) delete sent[d];
  const ok = await commitTs({ [slot(empId, ym)]: { ...b, rows, sent } });
  bumpData();
  return ok;
};

/* v7.3 — readOnly: BOD chỉ xem (không sửa nhanh, không mở ngăn kéo, không mở khoá, không nhắc).
          oneDept: trưởng phòng — cfg.employees đã lọc còn phòng của mình, ẩn ô chọn bộ phận. */
export function TimesheetBoard({ cfg, flash, onDirtyChange, readOnly = false, oneDept = false, pastLockSave = null }) {
  const dataTick = useDataTick();
  const empById8 = useMemo(() => new Map(cfg.employees.map((e) => [e.id, e])), [cfg.employees]);
  const today = fmt(new Date());
  const [mode, setMode] = useState("week");                     // week | month
  const [monday, setMonday] = useState(fmt(mondayOf(new Date())));
  const [ym, setYm] = useState(ymOf(today));
  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("all");
  /* v13.11 — lọc theo vai trò: chỉ vai trò đang có người (chưa nghỉ việc), thu theo bộ phận đang chọn */
  const [fRole, setFRole] = useState("all");
  const [openDet, setOpenDet] = useState(() => new Set());   // v13.24: empId đang mở bảng chi tiết "..."
  const [detTip, setDetTip] = useState(null);                // v13.25: { eid, pk, x, y } — rê chuột dòng dự án trong bảng chi tiết
  const [fLoad, setFLoad] = useState("all");       // v13.23: lọc theo mức tải — all | hi | ok | idle | lo
  const [sortLoad, setSortLoad] = useState("none");   // v13.23: none | desc (tải nhiều → ít) | asc (ít → nhiều)
  useEffect(() => { setFRole("all"); }, [fDept]);
  /* v13.13 — lọc theo TEAM: dùng bảng Gộp vai trò của Kế hoạch (vd TL-2D → 2D) để teamleader đi cùng team của mình */
  const teamMerge = useMemo(() => {
    const m = cfg.planning?.merge || {}, ids = new Set((cfg.roles || []).map((r) => r.id)), out = {};
    for (const [k, v] of Object.entries(m)) if (ids.has(k) && ids.has(v) && k !== v && !m[v]) out[k] = v;   // một tầng, như lưới Kế hoạch
    return out;
  }, [cfg.planning?.merge, cfg.roles]);
  const teamOf = (rid) => teamMerge[rid] || rid;
  const roleOpts = useMemo(() => {
    const present = new Set((cfg.employees || []).filter((e) => !isResigned(e) && e.role && (fDept === "all" || (e.dept || "") === fDept)).map((e) => e.role));
    const teams = new Set([...present].map((rid) => teamMerge[rid] || rid));
    return (cfg.roles || []).filter((r) => teams.has(r.id) && !teamMerge[r.id])
      .map((r) => ({ ...r, extra: Object.keys(teamMerge).filter((k) => teamMerge[k] === r.id && present.has(k)) }));
  }, [cfg.employees, cfg.roles, fDept, teamMerge]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [tip, setTip] = useState(null);                         // { eid, d, x, y } — thẻ chi tiết một ngày
  const [nudged, setNudged] = useState(() => new Map());        // empId -> giờ đã nhắc (tuần đang xem)
  const [nudging, setNudging] = useState(false);
  /* v7.7 — chuông bấm lại được, cách nhau tối thiểu NUDGE_GAP_MIN phút cho mỗi người; đồng hồ nhịp 20s để chuông tự sáng lại */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 20000); return () => clearInterval(t); }, []);
  const gapMs = NUDGE_GAP_MIN * 60000;
  const nudgeAgain = (at) => (at ? new Date(at).getTime() + gapMs : 0);          // thời điểm được nhắc lại
  const cooling = (at) => !!at && nudgeAgain(at) > nowMs;
  const hhmm = (v) => new Date(v).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const laterIso = (a, b) => (!a || (b && b > a) ? b : a);
  const [mNudged, setMNudged] = useState(() => new Map());      // v6.4: empId -> Map(thứ Hai tuần -> giờ đã nhắc), các tuần của tháng đang xem
  const [unlockFor, setUnlockFor] = useState(null);             // empId đang chờ xác nhận mở khoá tuần
  const [helpOpen, setHelpOpen] = useState(false);   // v13.11: bảng chú thích màu
  const helpRef = useRef(null);
  useEffect(() => {
    if (!helpOpen) return undefined;
    const h = (e) => { if (helpRef.current && !helpRef.current.contains(e.target)) setHelpOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [helpOpen]);
  const [drawer, setDrawer] = useState(null);                   // v6.0 (A): empId đang mở ngăn kéo sửa cả tuần
  /* v13.4 — cấp tài khoản của từng nhân sự để biết có hiện tác vụ quản lý trong ngăn kéo không.
     Chỉ Admin / BOD đọc được danh sách tài khoản; trưởng phòng mở bảng công nhân viên thì không hiện tác vụ quản lý. */
  const [mgrEmp, setMgrEmp] = useState(() => new Set());
  useEffect(() => {
    if (oneDept) return undefined;
    let alive = true;
    accountsApi("list").then((r) => {
      if (!alive) return;
      const lv = (a) => a?.access || (a?.isAdmin ? "admin" : "emp");
      setMgrEmp(new Set((r?.accounts || []).filter((a) => a.empId && ["head", "bod", "admin"].includes(lv(a))).map((a) => a.empId)));
    }).catch(() => {});
    return () => { alive = false; };
  }, [oneDept]);
  const [drawerDirty, setDrawerDirty] = useState(false);
  /* v7.9 — giao diện Sáng, bảng Tháng: một dải xám bo góc chạy liền từ số ngày hôm nay xuống hết bảng (nằm dưới các ô) */
  const mWrapRef = useRef(null);
  const [band, setBand] = useState(null);
  const [bandTick, setBandTick] = useState(0);
  useEffect(() => { const f = () => setBandTick((n) => n + 1); window.addEventListener("resize", f); window.addEventListener("artius:theme", f); return () => { window.removeEventListener("resize", f); window.removeEventListener("artius:theme", f); }; }, []);
  useLayoutEffect(() => {
    const w = mWrapRef.current, h = w?.querySelector("[data-today-head]"), t = w?.querySelector("table");
    let nb = null;
    if (w && h && t && isLight()) {
      const wr = w.getBoundingClientRect(), hr = h.getBoundingClientRect(), tr = t.getBoundingClientRect();
      nb = { left: Math.round(hr.left - wr.left + w.scrollLeft - 3), top: Math.round(hr.top - wr.top - 4), width: Math.round(hr.width + 6), height: Math.round(tr.bottom - hr.top + 2) };
    }
    if (JSON.stringify(nb) !== JSON.stringify(band)) setBand(nb);
  });   // đo lại sau mỗi lần vẽ; chỉ setState khi vị trí đổi
  const [leaveAsk, setLeaveAsk] = useState(false);              // đang hỏi bỏ thay đổi chưa lưu
  const [plOpen, setPlOpen] = useState(false);                     // v9.7: hộp thoại Khoá chấm công quá hạn (chỉ Admin)
  useEffect(() => {
    if (!plOpen) return undefined;
    const f = (e) => { if (e.key === "Escape") setPlOpen(false); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [plOpen]);
  const [pop, setPop] = useState(null);                         // v6.0 (C): { eid, d, x, y, items, vals } — sửa nhanh một ô ngày
  const [popSaving, setPopSaving] = useState(false);
  const popRef = useRef(null);
  /* v6.1 — hộp sửa nhanh luôn nằm trọn trong màn hình: đo chiều cao thật rồi đặt dưới ô; không đủ chỗ thì lật lên trên ô;
     vẫn không đủ thì kẹp sát mép và cho cuộn bên trong hộp */
  useLayoutEffect(() => {
    const el = popRef.current; if (!el || !pop) return;
    const h = el.offsetHeight, vh = window.innerHeight, m = 8;
    let top = pop.cellBottom + 6;
    if (top + h > vh - m) top = pop.cellTop - 6 - h;
    if (top < m) top = Math.max(m, vh - m - h);
    el.style.top = `${top}px`; el.style.visibility = "visible";
  }, [pop?.eid, pop?.d, pop?.items?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loadTick, setLoadTick] = useState(0);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const hs = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const lim = allocLimits(cfg);
  const days = mode === "week" ? weekDays(monday) : (() => { const a = parseD(`${ym}-01`), b = lastOfMonth(a); const o = []; for (let d = a; d <= b; d = addDays(d, 1)) o.push(fmt(d)); return o; })();
  const from = days[0], to = days[days.length - 1];
  const weeks = mode === "week" ? [monday] : mondaysOfMonth(ym);
  const rangeYms = ymsBetween(weeks[0], fmt(addDays(parseD(weeks[weeks.length - 1]), 6)));
  useEffect(() => { ensureMonths([prevYm(rangeYms[0]), ...rangeYms]).then(() => setLoadTick((t) => t + 1)); }, [rangeYms.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const projById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskById = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes, cfg.otBands, cfg.otLegacy]);
  const tName = (id) => { const t = taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };
  const pName = (id) => { if (!id || id === NO_PROJECT) return "Việc chung"; const p = projById.get(id); return p ? (p.code ? `${p.code} · ${p.name}` : p.name) : "(dự án đã xoá)"; };

  /* giờ từng người × ngày trong các tuần đang xem: reg (giờ thường đã gửi), ot, leave (vắng mặt đã gửi), draft (đã lưu, chưa gửi) */
  const cellOf = useMemo(() => {
    const m = new Map();
    const lo = weeks[0], hi = fmt(addDays(parseD(weeks[weeks.length - 1]), 6));
    for (const e of cfg.employees) for (const y of ymsBetween(lo, hi)) {
      const b = dbTs(e.id, y); if (!b?.rows) continue;
      const sent = b.sent || {};
      for (const r of b.rows) for (const [d, hv] of Object.entries(r.days || {})) {
        const h = Number(hv) || 0; if (h <= 0 || d < lo || d > hi) continue;
        const k = `${e.id}|${d}`;
        const c = m.get(k) || { reg: 0, ot: 0, leave: 0, draft: 0, idle: 0, items: [] };
        const ok = !!sent[d];
        if (!ok) c.draft += h; else if (isOtId(r.taskId)) c.ot += h; else if (isLeaveTask(r.taskId)) c.leave += h; else { c.reg += h; if (isIdleTask(r.taskId)) c.idle += h; }
        c.items.push({ ot: isOtId(r.taskId), sent: ok, h,
          // v13.24: giữ thêm dự án / tác vụ rời để dựng bảng chi tiết "..." giống tab Nhân sự
          pid: r.projectId, idleTask: isIdleTask(r.taskId), leaveTask: isLeaveTask(r.taskId), phase: r.phaseId || DEFAULT_PHASE,
          task: isOtId(r.taskId) ? `Tăng ca · ${r.otFor ? tName(r.otFor) : "chưa rõ tác vụ"}` : tName(r.taskId),
          label: isOtId(r.taskId) ? `Tăng ca · ${r.otFor ? tName(r.otFor) : "chưa rõ tác vụ"}` : isLeaveTask(r.taskId) ? tName(r.taskId) : `${pName(r.projectId)} · ${tName(r.taskId)}` });
        m.set(k, c);
      }
    }
    return m;
  }, [cfg.employees, weeks.join(","), dataTick, loadTick, taskById, projById]); // eslint-disable-line react-hooks/exhaustive-deps

  /* v6.4: hôm nay chỉ tính vào giờ chuẩn khi đã có giờ gửi — trước đây tính luôn nên ai cũng "thiếu 8 h" cả ngày */
  const stdOf = (d, eid) => {
    if (d > today) return 0;
    if (eid && gone(eid, d)) return 0;
    if (d === today && eid) { const c = cellOf.get(`${eid}|${d}`); if (!c || c.reg + c.leave + c.ot <= 0) return 0; }
    return minHoursFor(d, hoursCfg, hs) || 0;
  };
  const gone = (eid, d) => goneOnDay(empById8.get(eid), d);   // v8.5: ngày sau khi nghỉ việc — không tính giờ chuẩn, không nhắc
  const dayInfo = (eid, d) => {
    const c = cellOf.get(`${eid}|${d}`) || { reg: 0, ot: 0, leave: 0, draft: 0, idle: 0, items: [] };
    const std = gone(eid, d) ? 0 : minHoursFor(d, hoursCfg, hs) || 0, done = c.reg + c.leave;
    let st;
    if (hs.has(d)) st = "hol";
    else if (gone(eid, d)) st = done + c.ot + c.draft > 0 ? (c.draft ? "draft" : "full") : "off";
    else if (d > today) st = "fut";
    else if (d === today && done + c.ot + c.draft === 0) st = "fut";   // v6.4: hôm nay chưa chấm — chưa coi là bỏ trống
    else if (!std) st = done + c.ot > 0 ? (c.draft ? "draft" : "full") : c.draft ? "draft" : "off";
    else if (c.leave > 0 && c.reg === 0 && !c.draft) st = "leave";
    else if (done >= std) st = "full";
    else if (c.draft > 0) st = "draft";
    else st = done > 0 ? "part" : "none";
    const eff = effortHoursFor(d, c.reg - (c.idle || 0), hoursCfg, hs);   // v7.2: trừ trống việc · v6.4: giờ cố gắng (giờ làm việc thường vượt ngưỡng ngày, đã gửi)
    return { ...c, std, done, st, eff };
  };
  const sumOf = (eid, list) => {
    let reg = 0, ot = 0, std = 0, miss = [], draft = 0, eff = 0, idle = 0;
    for (const d of list) {
      const x = dayInfo(eid, d); reg += x.done; ot += x.ot; draft += x.draft; eff += x.eff; idle += x.idle || 0; std += stdOf(d, eid);
      if (d < today && stdOf(d, eid) > 0 && x.done === 0 && x.draft === 0) miss.push(d);   // v6.4: hôm nay chưa tính là bỏ trống
    }
    return { reg, ot, t: reg + ot, std, miss, draft, eff, idle, base: reg - eff };
  };
  const weekState = (eid, mon) => {
    if (mon > today || gone(eid, mon)) return "fut";
    if (weekDone(eid, mon)) return "ok";
    const s = sumOf(eid, weekDays(mon));
    if (s.draft > 0) return "dr";
    return s.reg + s.ot > 0 ? "gap" : "no";
  };
  /* lý do cần nhắc trong tuần đang xem (rỗng = không cần nhắc) */
  const reasons = (eid) => {
    const wd = weekDays(monday), s = sumOf(eid, wd), out = [];
    if (isResigned(empById8.get(eid))) return out;   // v8.5: người đã nghỉ không nhắc nộp
    const due = wd.filter((d) => d < today && stdOf(d) > 0);
    if (due.length && s.miss.length === due.length) out.push("Chưa chấm cả tuần");
    else if (s.miss.length) out.push(`Bỏ trống ${s.miss.map((d) => `${DOW_OF(d)} ${dLabel(d)}`).join(", ")}`);
    if (s.draft > 0) out.push(`Còn ${fmtH(s.draft)} h nháp — chưa bấm gửi`);
    if (!out.length && s.std > 0 && s.base < (s.std * lim.under) / 100) out.push(`Thiếu ${fmtH(s.std - s.base)} h giờ chuẩn`);
    return out;
  };

  const empsBase = cfg.employees.filter((e) => {
    // v8.5: người đã nghỉ chỉ hiện khi các tuần đang xem còn giờ của họ
    if (isResigned(e) && ![...cellOf.keys()].some((k) => k.startsWith(`${e.id}|`))) return false;
    if (fDept !== "all" && (e.dept || "") !== fDept) return false;
    if (fRole !== "all" && teamOf(e.role || "") !== fRole) return false;   // v13.11 · v13.13 theo team
    const kw = norm(q.trim());   // v6.6: gõ không dấu vẫn tìm ra
    return !kw || norm(`${e.name} ${e.code || ""} ${e.dept || ""} ${e.role || ""} ${roleTitle(e.role)}`).includes(kw);
  });
  /* v13.23 — mức tải từng người, dùng đúng allocState và công thức % của tab Nhân sự (giống chip ở cột TỔNG / CHUẨN) */
  const sumsAll = new Map(empsBase.map((e) => [e.id, sumOf(e.id, days)]));
  const loadOf = (e) => {
    const s = sumsAll.get(e.id);
    return { st: allocState(s.t, s.ot, s.eff, s.idle || 0, s.std, lim), p: s.std ? ((s.t - (s.idle || 0)) / s.std) * 100 : -1 };
  };
  const emps = empsBase.filter((e) => fLoad === "all" || loadOf(e).st === fLoad);
  // người chưa có giờ chuẩn (p = −1) luôn xếp cuối ở cả hai chiều, để không chiếm đầu bảng khi sắp tăng dần
  if (sortLoad !== "none") emps.sort((a, b) => {
    const pa = loadOf(a).p, pb = loadOf(b).p;
    if (pa < 0 || pb < 0) return pa === pb ? 0 : pa < 0 ? 1 : -1;
    return sortLoad === "desc" ? pb - pa : pa - pb;
  });
  /* v13.23 — khi đang sắp theo tải thì bỏ gom bộ phận, để thứ tự đúng trên toàn danh sách */
  const groups = sortLoad !== "none"
    ? [{ dept: sortLoad === "desc" ? "Tải nhiều → ít" : "Tải ít → nhiều", items: emps }]
    : [...DEPTS, ""].map((d) => ({ dept: d || "Khác", items: emps.filter((e) => (DEPTS.includes(e.dept) ? e.dept : "") === d) })).filter((g) => g.items.length);

  /* KPI của kỳ đang xem */
  const sums = new Map(emps.map((e) => [e.id, sumsAll.get(e.id)]));
  // v6.5: "Đã nộp đủ" xét các tuần đã qua (hết Chủ nhật) — tuần đang chạy chưa tới hạn nộp (cùng quy tắc chuông Nhắc tháng)
  const due = mode === "week" ? weeks.filter((m) => m <= today) : weeks.filter((m) => fmt(addDays(parseD(m), 6)) < today);
  const empsAct = emps.filter((e) => !isResigned(e));   // v8.5: KPI nộp bảng công chỉ tính người đang làm
  const okN = empsAct.filter((e) => due.every((m) => weekDone(e.id, m))).length;
  const totT = [...sums.values()].reduce((a, s) => a + s.t, 0), totStd = [...sums.values()].reduce((a, s) => a + s.std, 0), totOt = [...sums.values()].reduce((a, s) => a + s.ot, 0);
  /* v13.18 — tỷ lệ giờ đã gửi: làm việc (dự án + việc chung, không gồm vắng mặt, trống việc, cố gắng) · khác (vắng mặt + trống việc) · cố gắng · OT */
  const mix = (() => {
    /* v13.19 — giờ làm việc gồm cả cố gắng và OT; giờ khác = vắng mặt + trống việc */
    let work = 0, leave = 0, idleH = 0, eff = 0, ot = 0;
    for (const e of emps) for (const d of days) {
      const x = dayInfo(e.id, d);
      const idle = x.idle || 0;
      work += Math.max(0, x.reg - idle) + x.ot; leave += x.leave || 0; idleH += idle; eff += x.eff; ot += x.ot;
    }
    const other = leave + idleH;
    return { tot: work + other, work, other, leave, idle: idleH, eff, ot };
  })();
  const pctOf = (v) => (mix.tot ? Math.round((v / mix.tot) * 100) : 0);            // % trên TỔNG giờ đã gửi (657)
  /* v13.20 — cố gắng và OT nằm TRONG giờ làm việc, nên % của chúng lấy mẫu số là giờ làm việc, không phải tổng */
  const pctWork = (v) => (mix.work ? Math.round((v / mix.work) * 100) : 0);
  /* v13.20 — mức chịu tải: tổng giờ đã gửi so với giờ chuẩn của kỳ (>100% là vượt) */
  const loadPct = totStd ? (totT / totStd) * 100 : 0;
  const overH = totT - totStd;                                                     // >0: vượt · <0: hụt
  const loadTxt = !totStd ? "" : overH >= 0 ? `vượt ${fmtH(overH)} h (+${(loadPct - 100).toFixed(1)}%)` : `hụt ${fmtH(-overH)} h (${(loadPct - 100).toFixed(1)}%)`;
  // ngưỡng màu: vượt >5% đỏ, vượt 0–5% hổ phách, còn lại xám như cũ
  const loadCls = !totStd ? "text-slate-500" : loadPct > 105 ? "text-rose-400" : loadPct > 100 ? "text-amber-400" : "text-slate-500";

  /* nhắc đã gửi trong tuần đang xem (đọc nhật ký nhắc — quản lý đọc được) */
  useEffect(() => {
    let alive = true;
    fetchNudgeLog(monday).then((rows) => { if (alive) setNudged(rows.reduce((m, r) => m.set(r.emp_id, laterIso(m.get(r.emp_id), r.sent_at)), new Map())); }).catch(() => {});
    return () => { alive = false; };
  }, [monday]);
  /* v6.4 — chuông ở bảng Tháng: các tuần đã qua (hết Chủ nhật) chưa nộp đủ; bấm một lần nhắc gộp mọi tuần đó */
  const monthKey = mode === "month" ? weeks.join(",") : "";
  useEffect(() => {
    if (!monthKey) return;
    let alive = true;
    const ws = monthKey.split(",");
    fetchNudgeLogRange(ws[0], ws[ws.length - 1]).then((rows) => {
      if (!alive) return;
      const m = new Map();
      for (const r of rows) { const wk = String(r.period || "").slice(0, 10); if (!m.has(r.emp_id)) m.set(r.emp_id, new Map()); const mm = m.get(r.emp_id); mm.set(wk, laterIso(mm.get(wk), r.sent_at)); }
      setMNudged(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, [monthKey]);
  const missWeeks = (eid) => (isResigned(empById8.get(eid)) ? [] : weeks.filter((m) => fmt(addDays(parseD(m), 6)) < today && !weekDone(eid, m)));
  const monthBell = (eid) => {
    const mw = missWeeks(eid), log = mNudged.get(eid) || new Map();
    const last = [...log.values()].filter(Boolean).sort().pop();      // lần nhắc gần nhất của người này trong tháng
    return { mw, last, wait: cooling(last), again: nudgeAgain(last) };
  };
  const mToNudge = mode === "month" ? emps.filter((e) => { const b = monthBell(e.id); return b.mw.length > 0 && !b.wait; }).map((e) => e.id) : [];
  const nudgeMonth = async (ids) => {
    ids = ids.filter((id) => !monthBell(id).wait);
    if (!ids.length || nudging) return;
    setNudging(true);
    const groupsBy = new Map();   // cùng danh sách tuần thiếu → một lệnh gửi
    for (const id of ids) { const mw = missWeeks(id); if (!mw.length || monthBell(id).wait) continue; const k = mw.join(","); if (!groupsBy.has(k)) groupsBy.set(k, []); groupsBy.get(k).push(id); }
    const sent = [], noDev = [];
    try {
      for (const [k, gids] of groupsBy) {
        const ws = k.split(",");
        const r = await sendNudge(gids, ws[0], fmt(addDays(parseD(ws[ws.length - 1]), 6)), ws);
        sent.push(...(r.sent || [])); noDev.push(...(r.noDevice || []));
        const at = new Date().toISOString();
        setMNudged((m) => { const n = new Map(m); for (const id of r.sent || []) { const x = new Map(n.get(id) || []); for (const w of ws) x.set(w, at); n.set(id, x); } return n; });
      }
      const nm = (id) => cfg.employees.find((e) => e.id === id)?.name || id;
      if (noDev.length) flash(`${sent.length ? `Đã nhắc ${sent.length} người. ` : ""}Chưa bật thông báo trên máy nào: ${noDev.map(nm).join(", ")}.`, sent.length ? "ok" : "err");
      else flash(ids.length === 1 ? `Đã nhắc ${nm(ids[0])} nộp ${missWeeks(ids[0]).length} tuần.` : `Đã nhắc ${sent.length} người.`);
    } catch (e) { flash(`Chưa gửi được nhắc nhở — ${e.message}`, "err"); }
    setNudging(false);
  };
  const needIds = mode === "week" ? emps.filter((e) => reasons(e.id).length > 0).map((e) => e.id) : [];
  const toNudge = needIds.filter((id) => !cooling(nudged.get(id)));
  const nudge = async (ids) => {
    ids = ids.filter((id) => !cooling(nudged.get(id)));
    if (!ids.length || nudging) return;
    setNudging(true);
    try {
      const r = await sendNudge(ids, monday, fmt(addDays(parseD(monday), 6)));
      const at = new Date().toISOString();
      setNudged((m) => { const n = new Map(m); for (const id of r.sent || []) n.set(id, at); return n; });
      const nm = (id) => cfg.employees.find((e) => e.id === id)?.name || id;
      if (r.noDevice?.length) flash(`${r.sent?.length ? `Đã nhắc ${r.sent.length} người. ` : ""}Chưa bật thông báo trên máy nào: ${r.noDevice.map(nm).join(", ")}.`, r.sent?.length ? "ok" : "err");
      else flash(ids.length === 1 ? `Đã nhắc ${nm(ids[0])}.` : `Đã nhắc ${r.sent?.length || 0} người.`);
    } catch (e) { flash(`Chưa gửi được nhắc nhở — ${e.message}`, "err"); }
    setNudging(false);
  };

  const exportXlsx = async () => {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();
    const LBL = { full: "", part: "thiếu", draft: "nháp", none: "bỏ trống", leave: "nghỉ phép", hol: "lễ", off: "", fut: "" };
    const grid = emps.map((e) => {
      const row = { "Mã": e.code || "", "Nhân sự": empNameTag(e), "Bộ phận": e.dept || "", "Vai trò": roleTitle(e.role) };
      for (const d of days) { const x = dayInfo(e.id, d); row[`${DOW_OF(d)} ${dLabel(d)}`] = x.done + x.ot ? +(x.done + x.ot).toFixed(2) : LBL[x.st] || ""; }
      const s = sums.get(e.id);
      row["Giờ đã gửi"] = +s.t.toFixed(2); row["Trong đó tăng ca"] = +s.ot.toFixed(2); row["Giờ chuẩn tới hôm nay"] = s.std;
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grid), "Bảng công");
    const detail = [];
    for (const e of emps) for (const d of days) for (const it of (cellOf.get(`${e.id}|${d}`)?.items || [])) {
      detail.push({ "Nhân sự": empNameTag(e), "Bộ phận": e.dept || "", "Ngày": d, "Thứ": DOW_OF(d), "Dự án · tác vụ": it.label, "Giờ": it.h, "Trạng thái": it.sent ? "Đã gửi" : "Nháp" });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail.length ? detail : [{ "Nhân sự": "(chưa có giờ)" }]), "Chi tiết");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map((e) => {
      const row = { "Nhân sự": empNameTag(e), "Bộ phận": e.dept || "" };
      for (const m of weeks) row[`Tuần ${dLabel(m)}`] = WEEK_ST[weekState(e.id, m)][0];
      return row;
    })), "Tình trạng nộp");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = `ARTIUS_bang-cong_${from}_den_${to}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    flash("Đã xuất file Excel.");
  };

  const shift = (n) => {
    if (mode === "week") setMonday(fmt(addDays(parseD(monday), 7 * n)));
    else { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
  };
  const isNow = mode === "week" ? monday === fmt(mondayOf(new Date())) : ym === ymOf(today);
  const perLabel = mode === "week" ? `Tuần ${dLabel(monday)} – ${dLabel(fmt(addDays(parseD(monday), 6)))}` : ymLabel(ym);
  const switchMode = (m) => { if (m === "month") setYm(ymOf(monday)); else setMonday(fmt(mondayOf(ym === ymOf(today) ? new Date() : parseD(`${ym}-01`)))); setMode(m); };

  /* v6.4 — thanh Tổng / chuẩn chia khúc: Chuẩn (xanh dương: làm việc + vắng mặt) · phần còn thiếu (sọc vàng)
     · Cố gắng (tím) · OT (xanh ngọc). Không đổi cả thanh sang vàng nữa; chữ "thiếu x h" khi dưới giờ chuẩn. */
  const totCell = (s) => {
    // v6.7: giờ nháp (chưa gửi) không vẽ vào thanh và không tính là "thiếu" — chỉ thiếu thật khi kể cả nháp vẫn chưa đủ chuẩn
    const base = Math.max(0, s.base), miss = Math.max(0, s.std - base - (s.draft || 0));
    const W = Math.max(s.std, base + s.eff + s.ot) || 1, w = (h) => `${(h / W) * 100}%`;
    const low = s.std > 0 && base + (s.draft || 0) < (s.std * lim.under) / 100;
    // v7.2: trống việc là khúc xám nằm ngay sau khúc giờ chuẩn (vẫn tính là giờ công, không bị coi là thiếu)
    const shown = Math.min(base, s.std) || base, idle = Math.min(s.idle || 0, shown), blue = shown - idle;
    /* v13.22 — bỏ ghi chú "trống x h", thay bằng chip trạng thái tải giống tab Nhân sự.
       Dùng đúng allocState / pct của shared/alloc.jsx để hai tab luôn ra cùng một con số:
       tải = tổng giờ − trống việc, % tải = tải / giờ chuẩn kỳ. */
    const st = allocState(s.t, s.ot, s.eff, s.idle || 0, s.std, lim);
    const loadPctE = s.std ? Math.round(((s.t - (s.idle || 0)) / s.std) * 100) : null;
    return (
      <div className="min-w-[215px]" title={`Chuẩn ${fmtH(blue)} h${idle ? ` · trống việc ${fmtH(idle)} h` : ""} · cố gắng ${fmtH(s.eff)} h · OT ${fmtH(s.ot)} h${miss ? ` · thiếu ${fmtH(miss)} h` : ""}`}>
        <div className="flex items-center whitespace-nowrap font-mono text-sm"><span className="font-semibold text-slate-100">{fmtH(s.t)}</span><span className="text-slate-500"> / {fmtH(s.std)} h</span>
          {miss > 0 && <span className={`miss-txt ml-1.5 text-[11px] ${low ? "text-amber-400" : "text-slate-500"}`}>thiếu {fmtH(miss)}</span>}
          {s.std > 0 && <span className={`ml-auto rounded-full border px-1.5 font-sans text-[10px] leading-[15px] ${ALLOC_ST[st][1]}`}>{ALLOC_ST[st][0]}{loadPctE != null ? ` · ${loadPctE}%` : ""}</span>}</div>
        <div className="mt-1 flex h-[6px] gap-px overflow-hidden rounded-full bg-slate-800">
          {blue > 0 && <i className="block h-full bg-blue-400" style={{ width: w(blue) }} />}
          {idle > 0 && <i className="block h-full bg-slate-400" style={{ width: w(idle) }} />}
          {miss > 0 && <i className="block h-full" style={isLight() ? { width: w(miss), background: "#fed7aa" } : { width: w(miss), boxShadow: "inset 0 0 0 1px #fbbf24aa", background: "repeating-linear-gradient(135deg,#fbbf2433 0 3px,transparent 3px 6px)" }} />}
          {s.eff > 0 && <i className="block h-full bg-violet-400" style={{ width: w(s.eff) }} />}
          {s.ot > 0 && <i className="block h-full bg-teal-400" style={{ width: w(s.ot) }} />}
        </div>
      </div>
    );
  };
  const dayHandlers = (eid, d) => ({
    onMouseMove: (e) => { if (!pop) setTip({ eid, d, x: e.clientX, y: e.clientY }); },
    onMouseLeave: () => setTip(null),
    onClick: (e) => openPop(eid, d, e),
  });
  /* v6.0 (C) — bấm một ô ngày: hộp sửa nhanh các dòng giờ của ngày đó (dòng có giờ trong tuần của ngày) */
  const openPop = (eid, d, ev) => {
    if (readOnly || d > today) return;
    const wd = weekDays(fmt(mondayOf(parseD(d)))), b = dbTs(eid, ymOf(d));
    const items = (b?.rows || []).filter((r) => wd.some((x) => Number(r.days?.[x]) > 0)).map((r) => ({
      key: tsRowKey(r), ot: isOtId(r.taskId),
      label: isOtId(r.taskId) ? `Tăng ca · ${r.otFor ? tName(r.otFor) : "chưa rõ tác vụ"}` : isLeaveTask(r.taskId) ? tName(r.taskId) : tName(r.taskId),
      sub: isLeaveTask(r.taskId) ? "Vắng mặt" : `${pName(r.projectId)}${r.projectId && r.projectId !== NO_PROJECT ? ` · ${r.phaseId || DEFAULT_PHASE}` : ""}`,
      h: Number(r.days?.[d]) || 0,
    })).sort((a, b2) => (a.ot - b2.ot) || b2.h - a.h);
    const rect = ev.currentTarget.getBoundingClientRect();
    const W = 360, x = Math.min(window.innerWidth - W - 8, Math.max(8, rect.left));
    setTip(null);
    setPop({ eid, d, x, y: rect.bottom + 6, cellTop: rect.top, cellBottom: rect.bottom, items, vals: Object.fromEntries(items.map((it) => [it.key, it.h ? String(it.h) : ""])) });
  };
  const savePop = async () => {
    if (!pop || popSaving) return;
    for (const v of Object.values(pop.vals)) { const n = Number(v || 0); if (!(n >= 0 && n <= 24)) return flash("Giờ phải từ 0 đến 24.", "err"); }
    const changed = Object.fromEntries(pop.items.filter((it) => (Number(pop.vals[it.key]) || 0) !== it.h).map((it) => [it.key, Number(pop.vals[it.key]) || 0]));
    if (!Object.keys(changed).length) { setPop(null); return; }
    setPopSaving(true);
    const ok = await saveDayTs(pop.eid, pop.d, changed);
    setPopSaving(false);
    if (ok) { setPop(null); setLoadTick((t) => t + 1); flash(`Đã lưu giờ ${DOW_OF(pop.d)} ${dLabel(pop.d)} — ${cfg.employees.find((e) => e.id === pop.eid)?.name || ""}.`); }
    else flash(`Chưa lưu được — ${LAST_STORAGE_ERROR || "mất kết nối"}`, "err");
  };
  /* v6.0 (A) — ngăn kéo sửa cả tuần: dùng lại đúng bảng sửa của Chi tiết nhân viên (quản lý) */
  const drawerDirtyCb = useCallback((v) => { setDrawerDirty(v); onDirtyChange?.(v); }, [onDirtyChange]);
  const openDrawer = (eid) => { if (readOnly) return; setPop(null); setTip(null); setDrawer(eid); };
  const closeDrawer = (force = false) => {
    if (drawerDirty && !force) { setLeaveAsk(true); return; }
    setLeaveAsk(false); setDrawer(null); setDrawerDirty(false); onDirtyChange?.(false); setLoadTick((t) => t + 1);
  };
  const stepDrawer = (n) => {
    if (drawerDirty) { setLeaveAsk(true); return; }
    const i = emps.findIndex((e) => e.id === drawer), nx = emps[(i + n + emps.length) % emps.length];
    if (nx) { setDrawer(nx.id); setLoadTick((t) => t + 1); }
  };
  useEffect(() => {
    if (!drawer && !pop) return;
    const h = (e) => { if (e.key === "Escape") { if (pop) setPop(null); else closeDrawer(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });
  const Legend = () => (
    <div className="flex flex-col gap-y-1.5 px-3 py-2.5 text-xs text-slate-400">
      {[["full", "Đủ giờ chuẩn"], ["part", "Thiếu giờ"], ["draft", "Nháp chưa gửi"], ["none", "Bỏ trống"], ["leave", "Nghỉ phép"], ["hol", "Ngày lễ"], ["fut", "CN / chưa tới"]].map(([k, l]) => (
        <span key={k} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px]" style={dayStyleSm(k)} />{l}</span>
      ))}
      <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-teal-400" />Tăng ca (ô tuần ghi <span className="font-mono text-teal-400">+h</span>)</span>
      <span className="flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-1.5 text-slate-500">
        <i className="inline-block h-2 w-3 rounded-sm bg-blue-400" />chuẩn
        <i className="ml-1 inline-block h-2 w-3 rounded-sm bg-violet-400" />cố gắng
        <i className="ml-1 inline-block h-2 w-3 rounded-sm bg-teal-400" />OT
        <i className="ml-1 inline-block h-2 w-3 rounded-sm" style={isLight() ? { background: "#fed7aa" } : { boxShadow: "inset 0 0 0 1px #fbbf24aa", background: "repeating-linear-gradient(135deg,#fbbf2455 0 2px,transparent 2px 4px)" }} />thiếu</span>
    </div>
  );
  /* v13.24 — chi tiết giờ của một người trong kỳ đang xem: giờ theo dự án và theo tác vụ.
     Chỉ tính giờ ĐÃ GỬI (bỏ nháp), giống dữ liệu tab Nhân sự dùng. */
  const detailOf = (eid) => {
    const proj = new Map(), task = new Map(), byProj = new Map();
    for (const d of days) for (const it of (cellOf.get(`${eid}|${d}`)?.items || [])) {
      if (!it.sent) continue;
      const pk = it.leaveTask ? NO_PROJECT : (it.pid || NO_PROJECT);
      proj.set(pk, (proj.get(pk) || 0) + it.h);
      const t = task.get(it.task) || { h: 0, ot: it.ot, idle: it.idleTask };
      t.h += it.h; task.set(it.task, t);
      // v13.25: tác vụ + giai đoạn theo từng dự án, cho thẻ hiện khi rê chuột
      const o = byProj.get(pk) || { tasks: new Map(), phases: new Set() };
      const tp = o.tasks.get(it.task) || { h: 0, ot: it.ot, idle: it.idleTask };
      tp.h += it.h; o.tasks.set(it.task, tp);
      if (pk !== NO_PROJECT && !it.leaveTask) o.phases.add(it.phase);
      byProj.set(pk, o);
    }
    return {
      proj: [...proj.entries()].sort((a, b) => b[1] - a[1]),
      // tăng ca xếp cuối, giống thứ tự bên tab Nhân sự
      task: [...task.entries()].map(([name, t]) => ({ name, ...t })).sort((a, b) => (a.ot - b.ot) || b.h - a.h),
      byProj,
    };
  };
  /* v13.25 — tổng giờ đã gửi của từng dự án trong kỳ, tính trên TOÀN BỘ nhân sự (không theo bộ lọc),
     để tính "chiếm bao nhiêu trong tổng giờ dự án" giống thẻ bên tab Nhân sự */
  const projTotOf = useMemo(() => {
    const m = new Map();
    for (const e of cfg.employees) for (const d of days) for (const it of (cellOf.get(`${e.id}|${d}`)?.items || [])) {
      if (!it.sent) continue;
      const pk = it.leaveTask ? NO_PROJECT : (it.pid || NO_PROJECT);
      m.set(pk, (m.get(pk) || 0) + it.h);
    }
    return m;
  }, [cellOf, days.join(","), cfg.employees]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleDet = (eid) => { setDetTip(null); setOpenDet((s) => { const n = new Set(s); n.has(eid) ? n.delete(eid) : n.add(eid); return n; }); };
  /* v13.24 — hàng chi tiết bung dưới dòng nhân sự: hai bảng Dự án / Tác vụ, chỉ chữ và số như tab Nhân sự */
  const DetailRow = ({ e, span }) => {
    const d = detailOf(e.id);
    const pp = pct100(d.proj.map(([, h]) => h)), pt = pct100(d.task.map((t) => t.h));
    return (
      <tr key={`det-${e.id}`}>
        <td colSpan={span} className="border-b border-slate-800 bg-slate-950/40 px-3 pb-3 pt-2 md:px-4">
          {d.proj.length === 0 ? <div className="py-1 text-[13px] text-slate-500">Chưa có giờ đã gửi trong kỳ này.</div> : (
            <div className="grid max-w-5xl grid-cols-1 gap-x-10 gap-y-3 text-[13px] lg:grid-cols-2">
              <div>
                <div className="grid grid-cols-[minmax(0,1fr)_72px_52px] gap-3 py-0.5 text-[10.5px] uppercase tracking-wider text-slate-600">
                  <span>Dự án</span><span className="text-right">Giờ</span><span className="text-right">%</span>
                </div>
                {/* v13.25 — rê chuột vào dòng dự án → thẻ tác vụ của người này trong dự án đó */}
                {d.proj.map(([k, h], i) => (
                  <div key={k} className="-mx-1.5 grid cursor-default grid-cols-[minmax(0,1fr)_72px_52px] items-baseline gap-3 rounded-md px-1.5 py-0.5 hover:bg-slate-800/70"
                    onMouseMove={(ev) => setDetTip({ eid: e.id, pk: k, x: ev.clientX, y: ev.clientY })} onMouseLeave={() => setDetTip(null)}>
                    <span className="truncate text-slate-200">{k === NO_PROJECT ? "Việc chung, vắng mặt" : pName(k)}</span>
                    <span className="text-right font-mono text-slate-100">{fmtH(h)} h</span>
                    <span className="text-right font-mono text-slate-400">{pp[i]}%</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="grid grid-cols-[minmax(0,1fr)_72px_52px] gap-3 py-0.5 text-[10.5px] uppercase tracking-wider text-slate-600">
                  <span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span>
                </div>
                {d.task.map((t, i) => (
                  <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_72px_52px] items-baseline gap-3 py-0.5">
                    <span className={`truncate ${t.ot ? "text-teal-400" : t.idle ? "text-slate-400" : "text-slate-200"}`}>{t.name}</span>
                    <span className="text-right font-mono text-slate-100">{fmtH(t.h)} h</span>
                    <span className="text-right font-mono text-slate-400">{pt[i]}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </td>
      </tr>
    );
  };
  const NameCell = ({ e }) => (
    <td className="sticky left-0 z-10 border-b border-slate-800/70 bg-slate-900 px-3 py-1.5 md:px-4">
      {/* v13.26 — bấm tên mở bảng chi tiết giờ theo dự án / tác vụ (trước là mở ngăn kéo sửa giờ);
          nút "..." đã bỏ, sửa giờ công dùng nút bút chì ở cột MỞ KHOÁ / SỬA */}
      <button onClick={() => toggleDet(e.id)} aria-expanded={openDet.has(e.id)} title="Chi tiết giờ theo dự án và tác vụ"
        className="block w-full min-w-[150px] text-left">
        <span className={`flex items-center gap-1 truncate text-sm ${openDet.has(e.id) ? "text-teal-300" : "text-slate-100 hover:text-teal-300"}`}>
          <ChevronRight size={13} className={`shrink-0 text-slate-500 transition-transform ${openDet.has(e.id) ? "rotate-90" : ""}`} />
          <span className="truncate">{e.name}{isResigned(e) && <ResignedBadge />}</span>
        </span>
        <span className="block truncate pl-[17px] text-[11px] text-slate-500">{roleTitle(e.role) || e.dept}</span>
      </button>
    </td>
  );
  const DeptRow = ({ g, span }) => (
    <tr key={`d-${g.dept}`}><td colSpan={span} className="border-b border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 md:px-4">{g.dept} · {g.items.length} người</td></tr>
  );

  /* ---- chế độ Tuần ---- */
  const WeekView = () => (
    <table className="min-w-full border-separate border-spacing-0">
      <thead>
        <tr className="text-[11px] uppercase tracking-wider text-slate-500">
          <th className="sticky left-0 z-10 border-b border-slate-800 bg-slate-900 px-3 py-2 text-left font-normal md:px-4">Nhân sự</th>
          {days.map((d) => (
            <th key={d} title={hs.get(d) || undefined} className={`border-b border-slate-800 px-1 py-2 font-normal ${d === today ? "text-slate-100" : ""}`}>
              <span className="block">{DOW_OF(d)}</span>
              <span className="block font-mono text-[10.5px] tracking-normal">{dLabel(d)}</span>
              {hs.has(d) && <span className="mx-auto mt-0.5 block w-max rounded bg-slate-300 px-1.5 text-[10px] normal-case leading-[15px] tracking-normal text-slate-900">Lễ</span>}
            </th>
          ))}
          <th className="border-b border-slate-800 px-3 py-2 text-left font-normal">Tổng / chuẩn</th>
          <th className="border-b border-slate-800 px-2 py-2 font-normal">Nộp tuần</th>
          {!readOnly && <>
          <th className="whitespace-nowrap border-b border-slate-800 px-2 py-2 font-normal" title="Mở khoá tuần cho nhân sự sửa · Sửa giờ công">Mở khoá / sửa</th>
          <th className="w-24 whitespace-nowrap border-b border-slate-800 px-2 py-2 font-normal">
            Nhắc{toNudge.length > 0 && (
              <button onClick={() => nudge(toNudge)} disabled={nudging} title={`Nhắc tất cả ${toNudge.length} người cần xử lý`}
                className="ml-1.5 inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 px-2 align-middle font-mono text-xs normal-case text-amber-400 hover:bg-slate-800 disabled:opacity-40">
                <Bell size={12} />{toNudge.length}
              </button>
            )}
          </th>
          </>}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => [DeptRow({ g, span: days.length + (readOnly ? 3 : 5) }), ...g.items.map((e) => {
          const ws = weekState(e.id, monday), rs = reasons(e.id), at = nudged.get(e.id);
          const wSpan = days.length + (readOnly ? 3 : 5);   // v13.24: số cột để hàng chi tiết trải hết bảng
          return [
            <tr key={e.id}>
              {NameCell({ e })}
              {days.map((d) => {
                const x = dayInfo(e.id, d);
                const txt = x.st === "hol" ? "Lễ" : x.st === "leave" ? "P" : x.st === "none" ? "—" : x.st === "fut" || x.st === "off" ? (x.done ? fmtH(x.done) : "") : fmtH(x.st === "draft" ? x.done + x.draft : x.done);
                const plus = x.st === "hol" ? x.done + x.ot : x.ot;
                return (
                  <td key={d} className="border-b border-slate-800/70 px-1 py-1.5">
                    <div {...dayHandlers(e.id, d)} style={dayStyle(x.st)}
                      className={`mx-auto flex h-11 min-w-[54px] max-w-[110px] ${d > today || readOnly ? "cursor-default" : "cell-hov cursor-pointer"} flex-col items-center justify-center rounded-md ${x.st === "hol" ? "text-[13px] font-medium" : "font-mono text-[13px] font-semibold"}`}>
                      {txt}
                      {plus > 0 && <small className="font-mono text-[10px] font-medium leading-none text-teal-400">+{fmtH(plus)}</small>}
                    </div>
                  </td>
                );
              })}
              <td className="border-b border-slate-800/70 px-3 py-1.5">{totCell(sums.get(e.id))}</td>
              <td className="border-b border-slate-800/70 px-2 py-1.5 text-center">
                {ws === "fut" || (ws === "dr" && monday >= fmt(mondayOf(new Date()))) ? null : <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${WEEK_ST[ws][1]}`}>{WEEK_ST[ws][0]}</span>}
              </td>
              {!readOnly && <>
              <td className="border-b border-slate-800/70 px-2 py-1.5 text-center">
                <span className="inline-flex gap-1.5">
                  {(() => {
                    const hasSent = weekDays(monday).some((d) => daySent(e.id, d));
                    const cut = pastCut(cfg), locked = !!(cut && monday < cut);
                    const buUntil = locked ? pastOpenUntil(cfg, e.id, monday) : null;
                    const canBu = !!pastLockSave && locked && !isResigned(e);          // v9.8: chỉ Admin mở chấm bù (ghi vào thiết lập)
                    if (!hasSent && !canBu) return <span className="inline-block w-9" />;
                    return (
                      <button onClick={() => setUnlockFor(e.id)}
                        title={hasSent ? (canBu ? "Mở khoá cả tuần / mở chấm bù cho nhân sự" : "Mở khoá cả tuần — nhân sự sửa lại và gửi lại được") : (buUntil ? `Đang mở chấm bù tới hết ${dLabel(buUntil)} — bấm để đổi hạn` : "Tuần đã quá hạn chấm công — bấm để mở chấm bù cho nhân sự")}
                        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-slate-800 hover:text-slate-100 ${buUntil ? "border-teal-700 text-teal-400" : "border-slate-700 text-slate-300"}`}>
                        <Unlock size={15} />{buUntil && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-slate-900" />}
                      </button>
                    );
                  })()}
                  <button onClick={() => openDrawer(e.id)} title="Sửa giờ công cả tuần"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"><Pencil size={15} /></button>
                </span>
              </td>
              <td className="border-b border-slate-800/70 px-2 py-1.5 text-center">
                {rs.length > 0 && (
                  <button onClick={() => nudge([e.id])} disabled={nudging || cooling(at)}
                    title={at ? (cooling(at) ? `Đã nhắc lúc ${hhmm(at)} — nhắc lại được lúc ${hhmm(nudgeAgain(at))} · ${rs.join(" · ")}` : `Đã nhắc lúc ${hhmm(at)} — bấm để nhắc lại · ${rs.join(" · ")}`) : `Nhắc nộp — ${rs.join(" · ")}`}
                    className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-amber-400 hover:bg-slate-800 ${cooling(at) ? "cursor-not-allowed opacity-40 hover:bg-transparent" : "disabled:opacity-40"}`}>
                    <Bell size={15} />
                    {at && <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-700 text-white"><Check size={9} strokeWidth={3} /></span>}
                  </button>)}
              </td>
              </>}
            </tr>,
            openDet.has(e.id) ? DetailRow({ e, span: wSpan }) : null,
          ];
        })])}
      </tbody>
    </table>
  );

  /* ---- chế độ Tháng ---- */
  const MonthView = () => (
    <table className="relative z-[1] min-w-full border-separate border-spacing-0">
      <thead>
        <tr className="text-[11px] uppercase tracking-wider text-slate-500">
          <th className="sticky left-0 z-10 border-b border-slate-800 bg-slate-900 px-3 py-2 text-left font-normal md:px-4">Nhân sự</th>
          <th className="border-b border-slate-800 px-2 py-2 text-left font-normal">
            <div className="flex gap-0.5 font-mono text-[10px] normal-case tracking-normal">
              {days.map((d, i) => (
                <span key={d} title={hs.get(d) || undefined} data-today-head={d === today ? "" : undefined} style={d === today && isLight() && !hs.has(d) ? TODAY_CHIP : undefined} className={`w-[22px] shrink-0 text-center ${i > 0 && parseD(d).getDay() === 1 ? "ml-2" : ""}
                  ${hs.has(d) ? "rounded-[3px] bg-slate-300 text-slate-900" : d === today ? "text-slate-100" : parseD(d).getDay() === 0 ? "text-slate-700" : "text-slate-600"}`}>{+d.slice(8)}</span>
              ))}
            </div>
          </th>
          <th className="border-b border-slate-800 px-3 py-2 text-left font-normal">Tổng / chuẩn</th>
          <th className="whitespace-nowrap border-b border-slate-800 px-3 py-2 font-normal">Nộp từng tuần</th>
          {!readOnly && <th className="w-24 whitespace-nowrap border-b border-slate-800 px-2 py-2 font-normal">
            Nhắc{mToNudge.length > 0 && (
              <button onClick={() => nudgeMonth(mToNudge)} disabled={nudging} title={`Nhắc tất cả ${mToNudge.length} người còn tuần chưa nộp`}
                className="ml-1.5 inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 px-2 align-middle font-mono text-xs normal-case text-amber-400 hover:bg-slate-800 disabled:opacity-40">
                <Bell size={12} />{mToNudge.length}
              </button>
            )}
          </th>}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => [DeptRow({ g, span: readOnly ? 4 : 5 }), ...g.items.map((e) => [
          <tr key={e.id}>
            {NameCell({ e })}
            <td className="border-b border-slate-800/70 px-2 py-1.5">
              <div className="flex gap-0.5">
                {days.map((d, i) => {
                  const x = dayInfo(e.id, d);
                  return (
                    <span key={d} {...dayHandlers(e.id, d)} style={dayStyleSm(x.st)}
                      className={`relative h-[22px] w-[22px] shrink-0 rounded ${d > today || readOnly ? "cursor-default" : "cell-hov cursor-pointer"} ${i > 0 && parseD(d).getDay() === 1 ? "ml-2" : ""} ${d === today && !isLight() ? "outline outline-1 outline-offset-2 outline-slate-100/40" : ""}`}>
                      {x.ot + (x.st === "hol" ? x.done : 0) > 0 && <i className="absolute right-0.5 top-0.5 h-[5px] w-[5px] rounded-full bg-teal-400" />}
                    </span>
                  );
                })}
              </div>
            </td>
            <td className="border-b border-slate-800/70 px-3 py-1.5">{totCell(sums.get(e.id))}</td>
            <td className="border-b border-slate-800/70 px-3 py-1.5 text-center">
              <span className="inline-flex gap-1.5">
                {weeks.map((m) => {
                  const ws = weekState(e.id, m);
                  return (
                    <button key={m} onClick={() => { setMonday(m); setMode("week"); }} title={`Tuần ${dLabel(m)} — ${WEEK_ST[ws][0] === "—" ? "chưa tới" : WEEK_ST[ws][0]} · bấm để mở tuần`}
                      className="h-3 w-3 rounded-full transition-transform hover:scale-125" style={{ background: ws === "dr" && m >= fmt(mondayOf(new Date())) ? (isLight() ? "#94a3b8" : "#475569") : (ws === "fut" && isLight() ? "#e2e8f0" : weekDot(ws)) }} />
                  );
                })}
              </span>
            </td>
            {!readOnly && <td className="border-b border-slate-800/70 px-2 py-1.5 text-center">
              {(() => {
                const b = monthBell(e.id), wl = b.mw.map(dLabel).join(", ");
                if (!b.mw.length) return null;
                return (
                  <button onClick={() => nudgeMonth([e.id])} disabled={nudging || b.wait}
                    title={b.last ? (b.wait ? `Đã nhắc lúc ${hhmm(b.last)} — nhắc lại được lúc ${hhmm(b.again)} · tuần ${wl}` : `Đã nhắc lúc ${hhmm(b.last)} — bấm để nhắc lại · tuần ${wl}`) : `Nhắc nộp ${b.mw.length} tuần: ${wl} — gửi một thông báo`}
                    className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-amber-400 hover:bg-slate-800 ${b.wait ? "cursor-not-allowed opacity-40 hover:bg-transparent" : "disabled:opacity-40"}`}>
                    <Bell size={15} />
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-700 px-1 font-mono text-[10px] font-semibold text-white">{b.mw.length}</span>
                    {b.last && <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-700 text-white"><Check size={9} strokeWidth={3} /></span>}
                  </button>);
              })()}
            </td>}
          </tr>,
          openDet.has(e.id) ? DetailRow({ e, span: readOnly ? 4 : 5 }) : null,
        ])])}
      </tbody>
    </table>
  );

  /* v13.25 — thẻ hiện khi rê chuột dòng dự án trong bảng chi tiết "...", giống thẻ bên tab Nhân sự */
  const detTipBox = detTip && (() => {
    const d = detailOf(detTip.eid), o = d.byProj.get(detTip.pk);
    const ph = (d.proj.find(([k]) => k === detTip.pk) || [, 0])[1];
    if (!o || !ph) return null;
    const tasks = [...o.tasks.entries()].sort((a, b) => (a[1].ot - b[1].ot) || b[1].h - a[1].h);
    const pt = projTotOf.get(detTip.pk) || 0;
    const W = 360, left = Math.min(window.innerWidth - W - 12, detTip.x + 14), top = Math.min(window.innerHeight - 40 - (tasks.length + 3) * 24, detTip.y + 14);
    const pc = pct100(tasks.map(([, t]) => t.h));
    return (
      <div className="pointer-events-none fixed z-50 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[12.5px] shadow-2xl" style={{ left, top, width: W }}>
        <div className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 pb-1 text-[10.5px] uppercase tracking-wider text-slate-600"><span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span></div>
        {tasks.map(([lbl, t], i) => (
          <div key={lbl} className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 py-0.5">
            <span className={`truncate ${t.ot ? "text-teal-400" : t.idle ? "text-slate-400" : "text-slate-100"}`}>{lbl}</span>
            <span className="text-right font-mono text-slate-200">{fmtH(t.h)}</span>
            <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
          </div>
        ))}
        <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-slate-800 pt-1.5">
          {pt > 0 && <><span className="text-slate-500">Chiếm trong tổng giờ dự án</span><span className="text-right font-mono text-slate-100">{Math.round((ph / pt) * 100)}% <span className="text-slate-600">/ {fmtH(pt)} h</span></span></>}
          {o.phases.size > 0 && <><span className="text-slate-500">Giai đoạn</span><span className="text-right text-slate-100">{[...o.phases].sort().map((p) => phaseLabel(p)).join(", ")}</span></>}
        </div>
      </div>
    );
  })();

  const tipBox = tip && (() => {
    const x = dayInfo(tip.eid, tip.d), e = cfg.employees.find((y) => y.id === tip.eid);
    const W = 320, left = tip.x + 14 + W > window.innerWidth - 8 ? tip.x - W - 14 : tip.x + 14;
    const top = Math.max(8, Math.min(window.innerHeight - 80 - (x.items.length + 2) * 22, tip.y + 14));
    return (
      <div className="pointer-events-none fixed z-50 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[12.5px] shadow-2xl" style={{ left, top, width: W }}>
        <div className="mb-1.5"><span className="text-slate-100">{e?.name}</span><span className="text-slate-500"> · {DOW_OF(tip.d)} {dLabel(tip.d)}</span></div>
        {hs.has(tip.d) && <div className="mb-1 text-slate-300">Ngày lễ · {hs.get(tip.d)}{x.items.length ? "" : " — không tính giờ chuẩn"}</div>}
        {x.items.length === 0 ? (
          !hs.has(tip.d) && <div className={x.st === "none" ? "text-rose-400" : "text-slate-500"}>{tip.d > today ? "Chưa tới ngày" : x.std ? `Chưa chấm giờ — giờ chuẩn ${fmtH(x.std)} h` : "Ngày nghỉ"}</div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
            {x.items.map((it, i) => (
              <React.Fragment key={i}>
                <span className={`truncate ${it.ot ? "text-teal-400" : "text-slate-200"}`}>{it.label}{!it.sent && <span className="text-amber-400"> · nháp</span>}</span>
                <span className="text-right font-mono text-slate-200">{fmtH(it.h)}</span>
              </React.Fragment>
            ))}
            <span className="mt-1 border-t border-slate-800 pt-1 text-slate-500">Đã gửi{x.draft ? ` · nháp ${fmtH(x.draft)} h` : ""}</span>
            <span className="mt-1 border-t border-slate-800 pt-1 text-right font-mono text-slate-100">{fmtH(x.done + x.ot)}{x.std ? ` / ${fmtH(x.std)}` : ""} h</span>
          </div>
        )}
        {hs.has(tip.d) && x.items.length > 0 && <div className="mt-1 text-[11px] text-slate-500">Giờ chấm vào ngày lễ không tính giờ chuẩn</div>}
      </div>
    );
  })();

  /* v13.21 — mọi ô số liệu gói trong ĐÚNG MỘT dòng: nowrap + clip, không bao giờ xuống dòng thứ hai */
  const Kpi = ({ l, v, sub, cls = "text-slate-50", subCls = "text-slate-500" }) => (
    <div className="overflow-hidden bg-slate-900 px-3 py-2.5">
      <div className="truncate text-[10.5px] uppercase tracking-wider text-slate-500">{l}</div>
      <div className={`mt-0.5 flex items-baseline gap-1.5 overflow-hidden whitespace-nowrap font-mono text-lg font-semibold ${cls}`}>
        <span className="shrink-0">{v}</span>
        {sub && <span className={`truncate font-sans text-[11px] font-normal ${subCls}`}>{sub}</span>}
      </div>
    </div>
  );
  const Dot = () => <span className="mx-1.5 text-slate-600">·</span>;   // v13.21 — dấu ngăn giữa các phần trong một dòng
  return (
    /* v13.17 — hai khung: thanh trạng thái chung ở trên; bảng chấm công kèm thanh Tuần / Tháng, lịch, lọc, Excel ở dưới */
    <div className="space-y-3 md:space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {/* v13.21 — 4 ô (gộp Giờ làm việc với Cố gắng · OT); một cột trên điện thoại để không ô nào phải xuống dòng */}
        <div className="grid grid-cols-1 gap-px bg-slate-800 md:grid-cols-4">
          <Kpi l="Đã nộp đủ" v={okN} sub={`/ ${empsAct.length} người`} cls={okN < empsAct.length ? "text-amber-400" : "text-teal-300"} />
          {/* v13.21 — tổng giờ đã gửi / giờ chuẩn, kèm mức chịu tải */}
          <Kpi l="Tổng giờ đã gửi" v={fmtH(totT)}
            sub={<>/ {fmtH(totStd)} h chuẩn{loadTxt && <><Dot /><span className={loadCls}>{loadTxt}</span></>}</>} />
          {/* v13.21 — một ô: giờ làm việc (% trên tổng đã gửi) + cố gắng và OT (giờ và % TRONG giờ làm việc) */}
          <Kpi l="Giờ làm việc" v={`${fmtH(mix.work)} h`} cls="text-blue-300"
            sub={<>{pctOf(mix.work)}% tổng<Dot />cố gắng <span className="text-violet-300">{fmtH(mix.eff)} h</span> {pctWork(mix.eff)}%<Dot />OT <span className="text-teal-300">{fmtH(mix.ot)} h</span> {pctWork(mix.ot)}%</>} />
          {/* v13.20 — bỏ tooltip, tách khoản hiện thẳng trên thẻ */}
          <Kpi l="Giờ khác" cls="text-slate-300" v={`${fmtH(mix.other)} h`}
            sub={<>{pctOf(mix.other)}% tổng<Dot />vắng mặt {fmtH(mix.leave)} h<Dot />trống việc {fmtH(mix.idle)} h</>} />
        </div>
      </div>
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <div className="flex rounded-md border border-slate-700">
          {[["week", "Tuần"], ["month", "Tháng"]].map(([k, l]) => (
            <button key={k} onClick={() => switchMode(k)} className={`${CTRL} px-4 text-sm ${mode === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronLeft size={16} className="mx-auto" /></button>
          {/* v13.15: ô lịch như Nhân sự / Giờ ngoài dự án; chọn ngày → tuần / tháng chứa ngày đó */}
          <PeriodField className="w-40" mode={mode}
            from={mode === "week" ? monday : `${ym}-01`}
            to={mode === "week" ? fmt(addDays(parseD(monday), 6)) : fmt(lastOfMonth(parseD(`${ym}-01`)))}
            onPick={(s) => { if (mode === "week") setMonday(fmt(mondayOf(parseD(s)))); else setYm(ymOf(s)); }} />
          <button onClick={() => shift(1)} className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronRight size={16} className="mx-auto" /></button>
          {!isNow && <button onClick={() => { setMonday(fmt(mondayOf(new Date()))); setYm(ymOf(today)); }} className="ml-1 text-xs text-teal-400 hover:text-teal-300">{mode === "week" ? "Tuần này" : "Tháng này"}</button>}
        </div>
        {/* v13.12 — bộ phận + vai trò gom vào nút phễu */}
        {/* v13.23 — thêm lọc theo mức tải và sắp xếp theo tải vào cùng nút phễu */}
        <FilterButton count={(fDept !== "all" ? 1 : 0) + (fRole !== "all" ? 1 : 0) + (fLoad !== "all" ? 1 : 0) + (sortLoad !== "none" ? 1 : 0)}
          onClear={() => { setFDept("all"); setFRole("all"); setFLoad("all"); setSortLoad("none"); }}>
          {!oneDept && <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={selectCls} aria-label="Bộ phận">
            <option value="all">Mọi bộ phận</option>
            {DEPTS.map((d) => <option key={d}>{d}</option>)}
          </select>}
          <select value={fRole} onChange={(e) => setFRole(e.target.value)} className={selectCls} aria-label="Vai trò">
            <option value="all">Mọi vai trò</option>
            {roleOpts.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}{r.extra.length ? ` + ${r.extra.join(", ")}` : ""}</option>)}
          </select>
          <select value={fLoad} onChange={(e) => setFLoad(e.target.value)} className={selectCls} aria-label="Mức tải">
            <option value="all">Mọi mức tải</option>
            {["hi", "ok", "idle", "lo"].map((k) => <option key={k} value={k}>{ALLOC_ST[k][0]}</option>)}
          </select>
          <select value={sortLoad} onChange={(e) => setSortLoad(e.target.value)} className={selectCls} aria-label="Sắp xếp theo tải">
            <option value="none">Sắp theo bộ phận</option>
            <option value="desc">Tải nhiều → ít</option>
            <option value="asc">Tải ít → nhiều</option>
          </select>
        </FilterButton>
        <div className="relative w-full sm:w-56">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự" className={`pl-9 ${inputCls}`} />
        </div>
        {/* v13.11 — chú thích màu gộp vào nút (?) */}
        <div ref={helpRef} className="relative sm:ml-auto">
          <button onClick={() => setHelpOpen((o) => !o)} aria-expanded={helpOpen} title="Chú thích màu"
            className={`${CTRL} w-11 rounded-md border text-sm font-semibold ${helpOpen ? "border-teal-600 text-teal-300" : "border-slate-700 text-slate-400 hover:text-slate-100"}`}>?</button>
          {helpOpen && <div className="absolute right-0 top-full z-40 mt-1 w-[300px] rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">{Legend()}</div>}
        </div>
        {pastLockSave && !readOnly && !oneDept && (
          <button onClick={() => setPlOpen(true)} title="Khoá chấm công quá hạn: đổi số tuần nhân viên được sửa, mở chấm bù cho một người"
            className={`w-full sm:w-auto ${btnGhost}`}><Lock size={14} /> Khoá quá hạn · {pastWeeks(cfg) ? `${pastWeeks(cfg)} tuần` : "tắt"}</button>
        )}
        <button onClick={exportXlsx} disabled={emps.length === 0} className={`w-full sm:w-auto ${btnPrimary} disabled:opacity-40`}><Download size={15} /> Xuất Excel</button>
      </div>

      {plOpen && pastLockSave && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[8vh]" role="dialog" aria-modal="true"
          onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setPlOpen(false); }}>
          <div className="relative w-full max-w-4xl">
            <button onClick={() => setPlOpen(false)} aria-label="Đóng" className={`absolute right-3 top-2.5 z-10 ${iconBtn} h-8 w-8`}><X size={15} /></button>
            <PastLockPanel cfg={cfg} saveCfg={pastLockSave} flash={flash} />
          </div>
        </div>
      )}


      {emps.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Không có nhân sự nào khớp bộ lọc.</p> : (
        <div ref={mWrapRef} className="relative overflow-x-auto pb-1" data-band={bandTick}>
          {mode === "month" && band && isLight() && <div aria-hidden className="pointer-events-none absolute rounded-lg" style={{ ...band, background: TODAY_BAND, zIndex: 0 }} />}
          {mode === "week" ? WeekView() : MonthView()}
        </div>
      )}
      {!pop && !drawer && tipBox}
      {!pop && !drawer && detTipBox}

      {/* v6.0 (C) — hộp sửa nhanh một ô ngày */}
      {pop && (() => {
        const e = cfg.employees.find((y) => y.id === pop.eid), std = minHoursFor(pop.d, hoursCfg, hs) || 0;
        const sum = Object.values(pop.vals).reduce((a, v) => a + (Number(v) || 0), 0);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPop(null)} />
            <div ref={popRef} className="fixed z-50 max-h-[calc(100vh-16px)] w-[360px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl" style={{ left: pop.x, top: pop.y, visibility: "hidden" }}>
              <div className="mb-2 flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate"><span className="text-sm text-slate-100">{e?.name}</span><span className="text-sm text-slate-500"> · {DOW_OF(pop.d)} {dLabel(pop.d)}{hs.has(pop.d) ? " · ngày lễ" : ""}</span></div>
                <button onClick={() => setPop(null)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:text-slate-100"><X size={14} /></button>
              </div>
              {pop.items.length === 0 ? (
                <p className="py-1 text-sm text-slate-500">Tuần này chưa có dòng giờ nào. Bấm "Sửa cả tuần" để thêm dự án · tác vụ.</p>
              ) : pop.items.map((it) => (
                <div key={it.key} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-2 py-1">
                  <div className="min-w-0">
                    <div className={`truncate text-[13px] ${it.ot ? "text-teal-400" : "text-slate-200"}`}>{it.label}</div>
                    <div className="truncate text-[11px] text-slate-500">{it.sub}</div>
                  </div>
                  <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={pop.vals[it.key]}
                    onChange={(ev) => setPop((p) => ({ ...p, vals: { ...p.vals, [it.key]: ev.target.value } }))}
                    onKeyDown={(ev) => { if (ev.key === "Enter") savePop(); }}
                    className={`h-11 w-[72px] rounded-md border bg-slate-900 text-center font-mono text-sm focus:border-teal-500 focus:outline-none
                      ${(Number(pop.vals[it.key]) || 0) !== it.h ? "border-amber-500" : "border-slate-700"} ${it.ot ? "text-teal-300" : "text-slate-100"}`} />
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
                <span className="text-xs text-slate-500">Tổng <span className="font-mono text-slate-200">{fmtH(sum)}</span>{std ? ` / chuẩn ${fmtH(std)} h` : ""}</span>
                <span className="flex gap-2">
                  <button onClick={() => setPop(null)} className={`${btnGhost} h-9 px-3`}>Huỷ</button>
                  {pop.items.length > 0 && <button onClick={savePop} disabled={popSaving} className={`${btnPrimary} h-9 px-3 disabled:opacity-40`}>{popSaving ? <Loader2 className="animate-spin" size={14} /> : null} Lưu</button>}
                </span>
              </div>
              <button onClick={() => { const id = pop.eid, d = pop.d; setMonday(fmt(mondayOf(parseD(d)))); setPop(null); openDrawer(id); }}
                className="mt-2 text-xs text-teal-400 hover:text-teal-300">Sửa cả tuần · thêm dòng ›</button>
            </div>
          </>
        );
      })()}

      {/* v6.0 (A) — ngăn kéo bên phải: sửa cả tuần của một người, bảng tổng quan vẫn nằm phía sau */}
      {drawer && (() => {
        const e = cfg.employees.find((y) => y.id === drawer);
        if (!e) return null;
        return (
          <>
            <div className="fixed inset-0 z-40 bg-slate-950/70" onClick={() => closeDrawer()} />
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[1120px] flex-col border-l border-slate-700 bg-slate-950 shadow-[-20px_0_50px_rgba(0,0,0,.5)]">
              <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
                <button onClick={() => stepDrawer(-1)} title="Người trước" className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronLeft size={16} className="mx-auto" /></button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-100">{e.name}</div>
                  <div className="truncate text-xs text-slate-500">{e.dept}{roleTitle(e.role) ? ` · ${roleTitle(e.role)}` : ""} · sửa giờ công (quản lý sửa được cả ngày đã gửi)</div>
                </div>
                <button onClick={() => stepDrawer(1)} title="Người kế tiếp" className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronRight size={16} className="mx-auto" /></button>
                <button onClick={() => closeDrawer()} title="Đóng (Esc)" className={`${CTRL} w-11 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><X size={16} className="mx-auto" /></button>
              </div>
              {leaveAsk && (
                <div className="flex flex-wrap items-center gap-2 border-b border-amber-900 bg-amber-950/60 px-4 py-2 text-sm text-amber-200">
                  <span className="flex-1">Còn thay đổi chưa lưu. Bấm "Lưu thay đổi" trong bảng, hoặc bỏ thay đổi để đóng.</span>
                  <button onClick={() => setLeaveAsk(false)} className={`${btnGhost} h-9 px-3`}>Ở lại</button>
                  <button onClick={() => closeDrawer(true)} className={`${btnGhost} h-9 border-amber-700 px-3 text-amber-200`}>Bỏ thay đổi</button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-3 md:p-4">
                <EmployeeArea key={`${drawer}|${monday}`} cfg={cfg} empId={drawer} flash={flash} admin initialMonday={monday} onDirtyChange={drawerDirtyCb} mgrOk={mgrEmp.has(drawer)} />
              </div>
            </div>
          </>
        );
      })()}

      {unlockFor && (() => {
        const emp = cfg.employees.find((e) => e.id === unlockFor);
        const hasSent = weekDays(monday).some((d) => daySent(unlockFor, d));
        const cut = pastCut(cfg), locked = !!(cut && monday < cut);
        return (
          <UnlockWeekDialog key={`${unlockFor}|${monday}`} name={emp?.name || ""} monday={monday} hasSent={hasSent}
            canBu={!!pastLockSave && locked} locked={locked} today={today} openedUntil={locked ? pastOpenUntil(cfg, unlockFor, monday) : null}
            onCancel={() => setUnlockFor(null)}
            onConfirm={async ({ unlock, buUntil }) => {
              const id = unlockFor; setUnlockFor(null);
              const nm = emp?.name || "";
              let okU = true, okB = true;
              if (unlock && hasSent) okU = await unlockWeekTs(id, monday);
              if (okU && buUntil) {
                const next = cleanPastOpen(cfg, today, (c) => { (c[id] = c[id] || {})[monday] = buUntil; });
                okB = (await pastLockSave({ ...cfg, pastOpen: next })) !== false;
              }
              const ok = okU && okB;
              const parts = [];
              if (unlock && hasSent && okU) parts.push(`mở khoá tuần ${dLabel(monday)}`);
              if (buUntil && okB) parts.push(`mở chấm bù tới hết ${dLabel(buUntil)}`);
              flash(ok ? `Đã ${parts.join(" và ")} cho ${nm}.` : `Chưa thực hiện được — ${LAST_STORAGE_ERROR || "mất kết nối"}`, ok ? "ok" : "err");
            }} />
        );
      })()}
    </div>
    </div>
  );
}

/* v6.1 — Bảng công (quản lý) chỉ còn Tổng quan bảng công: xem Tuần / Tháng, sửa nhanh từng ô, sửa cả tuần trong ngăn kéo.
   Bỏ tab "Chi tiết nhân viên" (ngăn kéo đã dùng đúng bảng sửa đó). */
export function AdminTimesheet({ cfg, flash, onDirtyChange, readOnly = false, oneDept = false, onSupport = null, pastLockSave = null }) {
  if (cfg.employees.length === 0) return (
    <Panel title="Bảng công nhân sự">
      <p className="text-sm text-slate-500">{oneDept ? "Phòng ban của bạn chưa có nhân viên nào khác." : "Chưa có nhân sự nào. Thêm nhân sự ở tab Nhân sự trước đã."}</p>
    </Panel>
  );
  return (
    <div className="space-y-3 md:space-y-4">
      {/* v8.7 — hỗ trợ dự án có thời hạn: trưởng phòng mở cho nhân viên phòng mình, Admin cho mọi người */}
      {onSupport && <SupportPanel cfg={cfg} onSupport={onSupport} readOnly={readOnly} collapsible
        note={oneDept ? "Mở cho nhân viên phòng bạn chấm công vào dự án khác trong một khoảng ngày. Hết hạn tự ngắt, giờ đã chấm giữ nguyên." : "Mở cho nhân sự chấm công vào dự án không được giao, trong một khoảng ngày. Hết hạn tự ngắt, giờ đã chấm giữ nguyên."} />}
      <TimesheetBoard cfg={cfg} flash={flash} onDirtyChange={onDirtyChange} readOnly={readOnly} oneDept={oneDept} pastLockSave={pastLockSave} />
    </div>
  );
}

/* v9.8 — ghi lại pastOpen: bỏ các mục đã hết hạn, áp thay đổi fn, bỏ nhân sự không còn tuần nào */
export const cleanPastOpen = (cfg, today, fn) => {
  const cur = {};
  for (const [id, m] of Object.entries(cfg.pastOpen || {})) for (const [w, u] of Object.entries(m || {})) if (u >= today) (cur[id] = cur[id] || {})[w] = u;
  fn(cur);
  for (const id of Object.keys(cur)) if (!Object.keys(cur[id]).length) delete cur[id];
  return cur;
};

/* v9.8 — Mở khoá tuần và / hoặc mở chấm bù cho một nhân sự (cột "Mở khoá / sửa" của Bảng công).
   Tuần đã gửi → mở khoá. Tuần quá hạn chấm công (Admin) → tick "mở chấm bù tới ngày…". Một lần bấm làm cả hai. */
export function UnlockWeekDialog({ name, monday, hasSent, canBu, locked, today, openedUntil, onCancel, onConfirm }) {
  const [wantBu, setWantBu] = useState(canBu);
  const [until, setUntil] = useState(openedUntil || fmt(addDays(new Date(), 3)));
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onCancel]);
  const bu = canBu && (wantBu || !hasSent);
  const bad = bu && (!until || until < today);
  const label = hasSent ? (bu ? "Mở khoá + chấm bù" : "Mở khoá") : "Mở chấm bù";
  const wk = `${dLabel(monday)} – ${dLabel(fmt(addDays(parseD(monday), 6)))}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <Unlock size={20} className="mt-0.5 shrink-0 text-teal-400" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-50">{hasSent ? `Mở khoá tuần ${wk}?` : `Mở chấm bù tuần ${wk}?`}</h4>
            {hasSent && <p className="mt-1 text-sm text-slate-400">{name} sẽ sửa lại và gửi lại được tuần này. Giờ công giữ nguyên, nhưng tạm chưa tính vào tổng hợp cho tới khi gửi lại.</p>}
            {!hasSent && <p className="mt-1 text-sm text-slate-400">Tuần này đã quá hạn chấm công nên {name} không tự nhập được. Mở chấm bù để nhân sự nhập và gửi trong thời hạn bên dưới.</p>}
            {hasSent && locked && !canBu && <p className="mt-2 text-xs text-amber-400">Tuần này đã quá hạn chấm công: mở khoá xong nhân sự vẫn chưa sửa được. Chỉ Admin mở chấm bù được.</p>}
          </div>
        </div>
        {canBu && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
            {hasSent && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={wantBu} onChange={(e) => setWantBu(e.target.checked)} className="h-4 w-4 accent-teal-600" />
                Mở chấm bù cho {name} (tuần đã quá hạn)
              </label>
            )}
            {openedUntil && <p className="mb-2 text-xs text-teal-400">Đang mở chấm bù tới hết {dLabel(openedUntil)}.</p>}
            {(wantBu || !hasSent) && (
              <label className={`flex items-center gap-2 text-xs text-slate-500 ${hasSent ? "mt-2" : ""}`}>
                <span className="whitespace-nowrap">Mở tới</span>
                <input type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} className={`min-w-0 flex-1 ${inputCls}`} />
              </label>
            )}
            <p className="mt-2 text-xs text-slate-500">Hết ngày “Mở tới” là tuần này tự khoá lại.</p>
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className={btnGhost}>Thôi</button>
          <button disabled={bad} onClick={() => onConfirm({ unlock: hasSent, buUntil: bu ? until : null })} className={`${btnPrimary} disabled:opacity-40`}><CheckCircle2 size={14} /> {label}</button>
        </div>
        {bad && <p className="mt-2 text-xs text-rose-400">Hạn mở phải từ hôm nay trở đi.</p>}
      </div>
    </div>
  );
}

/* v8.6 — Khoá chấm công quá hạn (v9.8: chỉ còn đổi số tuần + danh sách tuần đang mở chấm bù; mở chấm bù mới làm ở cột Mở khoá / sửa của Bảng công) */
export function PastLockPanel({ cfg, saveCfg, flash }) {
  const today = fmt(new Date());
  const weeks = pastWeeks(cfg), cut = pastCut(cfg, today);
  const [busy, setBusy] = useState(false);
  const opens = Object.entries(cfg.pastOpen || {}).flatMap(([id, m]) => Object.entries(m || {}).map(([w, u]) => ({ id, w, u })))
    .sort((a, b) => b.u.localeCompare(a.u));
  const writeOpen = async (fn) => {
    const cur = cleanPastOpen(cfg, today, fn);
    setBusy(true); const ok = await saveCfg({ ...cfg, pastOpen: cur }); setBusy(false);
    return ok !== false;
  };
  const setWeeks = async (n) => { await saveCfg({ ...cfg, pastLock: { ...(cfg.pastLock || {}), weeks: n } }); flash(n ? `Nhân viên chỉ chấm / sửa được ${n} tuần gần nhất.` : "Đã tắt khoá chấm công quá hạn."); };
  const nm = (id) => empNameTag(cfg.employees.find((e) => e.id === id));
  const wkLabel = (m) => `${dLabel(m)} – ${dLabel(fmt(addDays(parseD(m), 6)))}`;
  return (
    <Panel title="Khoá chấm công quá hạn">
      <div className="grid gap-3 md:flex md:flex-wrap md:items-end">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Nhân viên chấm / sửa được</label>
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={`md:w-80 ${selectCls}`}>
            <option value={0}>Không khoá (tắt)</option>
            {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n === 1 ? "Chỉ tuần này" : `${n} tuần gần nhất${n === 2 ? " (tuần này + tuần trước)" : ""}`}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500 md:pb-3">
          {cut ? <>Hôm nay {dLabel(today)}: nhân viên nhập được từ <b className="text-slate-300">thứ Hai {dLabel(cut)}</b>. Ngày trước đó bị khoá (kể cả giờ nháp chưa gửi). Admin và trưởng phòng vẫn sửa được ở Bảng công.</>
            : "Đang tắt — nhân viên sửa được giờ chưa gửi ở mọi tuần cũ."}
        </p>
      </div>

      {cut && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-500">Mở chấm bù cho một nhân sự: ở Bảng công, bấm nút mở khoá (🔓) ở cột “Mở khoá / sửa” của người đó.</p>
          {opens.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {opens.map((o) => {
                const live = o.u >= today;
                return (
                  <div key={`${o.id}|${o.w}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 text-slate-200">{nm(o.id)} <span className="text-slate-500">· tuần {wkLabel(o.w)}</span></span>
                    <span className={`text-xs ${live ? "text-teal-400" : "text-slate-500"}`}>{live ? `mở tới hết ${dLabel(o.u)}` : "đã hết hạn"}</span>
                    <button onClick={async () => { if (await writeOpen((c) => { if (c[o.id]) delete c[o.id][o.w]; })) flash("Đã khoá lại tuần này."); }} disabled={busy}
                      title="Khoá lại ngay" className={`ro-hide ${iconBtn} h-8 w-8 hover:border-rose-800 hover:text-rose-400`}><X size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

