/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Download, Loader2, RotateCcw, X, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { DEFAULT_HOURS, DOW, addDays, dFull, dLabel, effortHoursFor, firstOfMonth, lastOfMonth, fmt, makeHolidayIndex, minHoursFor, mondayOf, mondaysDue, parseD, prevYm, ymOf, ymsBetween } from "../../core/date.jsx";
import { dbTs, dbTsSent, ensureMonths, loadDB, loadXlsx, useDataTick, weekDone } from "../../core/db.jsx";
import { DEFAULT_PHASE, DEPTS, LEAVE_TASKS, NO_PROJECT, OT_TASKS, PHASES, budgetTotal, empNameTag, fmtH, isIdleTask, isLeaveTask, isOtId, isResigned, norm, otBandKey, otDayKind, otRateFor, otText, phaseLabel, projBudgets, roleTitle, supportKind, taskText } from "../../core/domain.jsx";
import { CTRL, DateRangeField, FilterButton, Panel, btnGhost, btnPrimary, inputCls, selectCls } from "../../core/ui.jsx";
import { ALLOC_ST, allocLimits, allocState } from "../../shared/alloc.jsx";
import { ProjectProgress } from "./ProjectProgress.jsx";
import { OffProject } from "./OffProject.jsx";
import { StaffAllocation } from "./StaffAllocation.jsx";
import { ResourcePane } from "./ResourcePane.jsx";

/* ============================ DASHBOARD (QUẢN LÝ) ============================ */
/* v12.20 — tabs: các tab được hiện (Dashboard: Dự án | Ma trận; Bảng công: Nhân sự | Giờ ngoài dự án);
   hideBar: ẩn thanh tab riêng khi nơi gọi đã có thanh tab của nó
   v12.22 — thêm tab "res" (Tổng quan nguồn lực), đứng đầu thanh tab Dashboard */
export function Dashboard({ cfg, saveCfg, flash, tabs = ["res", "proj", "ppl", "mtx", "off"], hideBar = false }) {
  const dataTick = useDataTick();   // v1.9: số liệu tự cập nhật khi có người vừa gửi
  const now = new Date();
  /* v13.8 — kỳ mặc định là tuần này (T2 → hôm nay); chọn Tuần | Tháng, ‹ › lùi / tiến một kỳ, ô lịch chọn khoảng tuỳ ý */
  const [from, setFrom] = useState(fmt(mondayOf(now)));
  const [to, setTo] = useState(fmt(now));
  const [pMode, setPMode] = useState("week");   // week | month | custom
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fDept, setFDept] = useState("all");   // lọc bộ phận
  /* v13.11 — lọc theo vai trò: chỉ vai trò đang có người (chưa nghỉ việc), thu theo bộ phận đang chọn */
  const [fRole, setFRole] = useState("all");
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

  /* v5.6 — Dashboard tách hai tab: "Dự án" (tiến độ từ trước tới nay, không theo kỳ) và "Nhân sự" (theo kỳ).
     Bỏ ô lọc Dự án / Giai đoạn chung ở đầu trang — mỗi tab có bộ lọc riêng, chỉ tác động lên chính tab đó. */
  const fProj = "all", fPhase = "all";
  // v10.1: ba tab — Dự án | Nhân sự | Ma trận
  const [dTabRaw, setDTab0] = useState(() => { try { const v = localStorage.getItem("artius.dashTab"); return v === "res" || v === "proj" || v === "mtx" || v === "off" ? v : "ppl"; } catch { return "ppl"; } });
  const dTab = tabs.includes(dTabRaw) ? dTabRaw : tabs[0];
  const setDTab = (t) => { setDTab0(t); try { localStorage.setItem("artius.dashTab", t); } catch { /* bỏ qua */ } };
  const [q, setQ] = useState("");              // tìm theo tên nhân sự
  const [rebuilding, setRebuilding] = useState(false);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidaySet = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);

  const setRange = (a, b) => { setFrom(a); setTo(b); };
  // v4.6 — giờ chuẩn của một người trong kỳ đang chọn (T2–T6 / T7 / CN theo Thiết lập, trừ ngày lễ) — vạch so sánh ở "Phân bổ theo nhân sự"
  const stdPeriod = useMemo(() => {
    let t = 0;
    for (let d = from; d <= to; d = fmt(addDays(parseD(d), 1))) t += minHoursFor(d, hoursCfg, holidaySet) || 0;
    return t;
  }, [from, to, hoursCfg, holidaySet]);
  /* v6.5 — giờ chuẩn của HÔM NAY chỉ tính cho người đã gửi giờ hôm nay (cùng quy tắc với Bảng công v6.4) */
  const todayK = fmt(new Date());
  const stdToday = from <= todayK && todayK <= to ? minHoursFor(todayK, hoursCfg, holidaySet) || 0 : 0;
  const sentToday = useMemo(() => {
    const out = new Set();
    for (const e of cfg.employees || []) {
      const b = dbTs(e.id, ymOf(todayK));
      if (b?.sent?.[todayK] && (b.rows || []).some((r) => Number(r.days?.[todayK]) > 0)) out.add(e.id);
    }
    return out;
  }, [cfg.employees, todayK, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const stdBase = stdPeriod - stdToday;
  const stdForEmp = (eid) => {
    /* v8.5: người đã nghỉ trong kỳ — giờ chuẩn chỉ tính tới trước ngày nghỉ.
       v13.67 (R6): người vào làm trong kỳ — giờ chuẩn chỉ tính từ ngày vào làm. Hôm nay chưa gửi thì chưa tính,
       giống stdBase của mọi người khác. */
    const e = cfg.employees.find((x) => x.id === eid);
    const start = e?.startedAt && e.startedAt > from ? e.startedAt : "";
    if ((e?.resignedAt && e.resignedAt <= to) || start) {
      let t = 0;
      for (let d = start || from; d <= to && !(e.resignedAt && d >= e.resignedAt); d = fmt(addDays(parseD(d), 1))) {
        if (d === todayK && !sentToday.has(eid)) continue;
        t += minHoursFor(d, hoursCfg, holidaySet) || 0;
      }
      return t;
    }
    return stdToday && !sentToday.has(eid) ? stdBase : stdPeriod;
  };
  const clearFilters = () => { setFDept("all"); setFRole("all"); setQ(""); };
  const hasFilter = fDept !== "all" || fRole !== "all" || q.trim() !== "";
  const today = fmt(now);
  /* v13.8 — kỳ theo Tuần / Tháng chứa ngày anchor; kỳ hiện tại tính tới hôm nay */
  const clip = (d) => (d > today ? today : d);
  const periodOf = (mode, anchor) => mode === "month"
    ? [fmt(firstOfMonth(anchor)), clip(fmt(lastOfMonth(anchor)))]
    : [fmt(mondayOf(anchor)), clip(fmt(addDays(mondayOf(anchor), 6)))];
  const pickMode = (m) => { const [a, b] = periodOf(m, now); setPMode(m); setFrom(a); setTo(b); };
  const atNow = to >= today;
  const stepPeriod = (dir) => {
    if (dir > 0 && atNow) return;
    if (pMode === "custom") {
      const n = Math.round((parseD(to) - parseD(from)) / 864e5) + 1;
      const a = fmt(addDays(parseD(from), dir * n));
      if (a > today) return;
      setFrom(a); setTo(clip(fmt(addDays(parseD(to), dir * n))));
      return;
    }
    const f = parseD(from);
    const anchor = pMode === "month" ? new Date(f.getFullYear(), f.getMonth() + dir, 1) : addDays(f, 7 * dir);
    const [a, b] = periodOf(pMode, anchor);
    setFrom(a); setTo(b);
  };
  const pickRange = (a, b) => {
    const [wa, wb] = periodOf("week", parseD(a)), [ma, mb] = periodOf("month", parseD(a));
    setPMode(a === wa && b === wb ? "week" : a === ma && b === mb ? "month" : "custom");
    setFrom(a); setTo(b);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const yms = ymsBetween(from, to);
    await ensureMonths([prevYm(yms[0]), ...yms]);   // v2.1: kỳ cũ hơn 6 tháng thì tải thêm trước khi tính
    const detail = [];
    for (const ym of yms) for (const e of cfg.employees) {
      const d = dbTsSent(e.id, ym);   // v1.9: chỉ giờ của ngày đã gửi
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;   // lọc đúng theo NGÀY
        detail.push({ empId: e.id, date, hours: Number(h), projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, otFor: r.otFor || "", note: r.note || "" });
      }
    }
    const status = [];
    for (const ym of yms) {
      const need0 = mondaysDue(ym);
      for (const e of cfg.employees) {
        /* v8.5: không tính tuần sau ngày nghỉ việc. v13.67: không tính tuần kết thúc trước ngày vào làm. */
        const need = need0.filter((m) => (!e.resignedAt || m < e.resignedAt) && (!e.startedAt || fmt(addDays(parseD(m), 6)) >= e.startedAt));
        if (isResigned(e) && !need.length) continue;
        const missing = need.filter((m) => !weekDone(e.id, m));
        status.push({ empId: e.id, ym, done: need.length - missing.length, need: need.length, missing });
      }
    }
    setData({ detail, status, yms }); setLoading(false);
  }, [from, to, cfg.employees]);

  // v5.6: đổi kỳ (chọn nhanh hoặc lịch) là tính lại ngay — không cần bấm "Cập nhật"
  useEffect(() => { load(); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  /* v5.6 — số người có giờ (đã gửi) vào từng dự án trong tuần hiện tại (T2 → CN) — cột "Người tuần này" ở tab Dự án */
  const weekPeople = useMemo(() => {
    const m = new Map();
    const mon = fmt(mondayOf(new Date())), sun = fmt(addDays(mondayOf(new Date()), 6));
    for (const e of cfg.employees) for (const ym of new Set([ymOf(mon), ymOf(sun)])) {
      const d = dbTsSent(e.id, ym);
      if (!d?.rows) continue;
      for (const r of d.rows) {
        if (r.projectId === NO_PROJECT || isLeaveTask(r.taskId)) continue;
        if (!Object.entries(r.days || {}).some(([k, h]) => Number(h) && k >= mon && k <= sun)) continue;
        const st = m.get(r.projectId) || new Set(); st.add(e.id); m.set(r.projectId, st);
      }
    }
    return m;
  }, [cfg.employees, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // v1.9: có dòng bảng công vừa đổi trên server thì tính lại ngay, không cần bấm Tải lại
  const firstTick = useRef(dataTick);
  useEffect(() => { if (dataTick !== firstTick.current) load(); }, [dataTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kéo lại toàn bộ từ server — phòng khi nghi ngờ thiếu số liệu
  const rebuild = async () => {
    setRebuilding(true);
    await loadDB(true);
    setRebuilding(false);
    await load();
    flash("Đã tải lại dữ liệu mới nhất.");
  };

  // Dựng Map một lần thay vì .find() trong vòng lặp — trước đây là O(n²) khi xuất Excel
  const empMap = useMemo(() => new Map(cfg.employees.map((e) => [e.id, e])), [cfg.employees]);
  const projMapById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskMap = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes, cfg.otBands, cfg.otLegacy]);
  const empName = (id) => empNameTag(empMap.get(id));   // v8.5: người đã nghỉ kèm "(Đã nghỉ)"
  const empDept = (id) => empMap.get(id)?.dept || "";
  const empTitle = (id) => roleTitle(empMap.get(id)?.role);
  const projLabel = (id) => { if (id === NO_PROJECT) return "Khác"; const p = projMapById.get(id); return p ? (p.code ? `[${p.code}] ${p.name}` : p.name) : "(dự án đã xoá)"; };
  const taskLabel = (id) => { const t = taskMap.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  // Bộ lọc áp lên toàn bộ số liệu bên dưới: KPI, biểu đồ, ma trận và cả file Excel xuất ra
  const matchEmp = useCallback((eid) => {
    const e = empMap.get(eid);
    if (fDept !== "all" && (e?.dept || "") !== fDept) return false;
    if (fRole !== "all" && teamOf(e?.role || "") !== fRole) return false;   // v13.11 · v13.13 theo team
    const kw = norm(q.trim());   // v6.6: gõ không dấu vẫn tìm ra ("nguyen linh sang" → Nguyễn Linh Sang)
    if (kw && !norm(`${e?.name || ""} ${e?.code || ""}`).includes(kw)) return false;
    return true;
  }, [empMap, fDept, fRole, q, teamMerge]);   // eslint-disable-line react-hooks/exhaustive-deps

  const agg = useMemo(() => {
    if (!data) return null;
    const detail = data.detail.filter((d) => matchEmp(d.empId)
      && (fProj === "all" || d.projectId === fProj)
      && (fPhase === "all" || (d.projectId !== NO_PROJECT && !isLeaveTask(d.taskId) && (d.phaseId || DEFAULT_PHASE) === fPhase)));
    const by = (fn) => { const m = new Map(); for (const d of detail) m.set(fn(d), (m.get(fn(d)) || 0) + d.hours); return m; };
    const matrix = new Map();
    for (const d of detail) {
      if (!matrix.has(d.empId)) matrix.set(d.empId, new Map());
      // v10.2: vắng mặt luôn gom về "Khác" — khớp với byProj, khung Theo người và thẻ rê chuột
      const mm = matrix.get(d.empId), pk = isLeaveTask(d.taskId) ? NO_PROJECT : d.projectId;
      mm.set(pk, (mm.get(pk) || 0) + d.hours);
    }
    /* v3.4 — OT = giờ chấm vào hạng mục Tăng ca. Giờ cố gắng = giờ làm việc thường vượt ngưỡng ngày của MỘT người
       (tính trên tổng giờ một người trong một ngày, không cộng dồn theo dòng dự án); không tính chi phí dự án. */
    const perEmpDay = new Map();
    for (const d of detail) {
      const k = `${d.empId}|${d.date}`;
      const c = perEmpDay.get(k) || { ot: 0, reg: 0, idle: 0 };
      if (isOtId(d.taskId)) c.ot += d.hours; else if (!isLeaveTask(d.taskId)) { c.reg += d.hours; if (isIdleTask(d.taskId)) c.idle += d.hours; }
      perEmpDay.set(k, c);
    }
    const otByEmp = new Map();
    const effortByEmp = new Map();
    const idleByEmp = new Map();   // v7.2: giờ trống việc — tính giờ công, không tính tải
    let otTotal = 0, effortTotal = 0, idleTotal = 0;
    for (const [k, c] of perEmpDay) {
      const [eid, date] = k.split("|");
      if (c.ot) { otByEmp.set(eid, (otByEmp.get(eid) || 0) + c.ot); otTotal += c.ot; }
      if (c.idle) { idleByEmp.set(eid, (idleByEmp.get(eid) || 0) + c.idle); idleTotal += c.idle; }
      const ef = effortHoursFor(date, c.reg - c.idle, hoursCfg, holidaySet);
      if (ef) { effortByEmp.set(eid, (effortByEmp.get(eid) || 0) + ef); effortTotal += ef; }
    }
    const leaveTotal = detail.filter((d) => isLeaveTask(d.taskId)).reduce((x, d) => x + d.hours, 0);
    // v2.9: "Khác" (tác vụ chung + vắng mặt) là một cột riêng, đặt cuối; không có giai đoạn
    const byProj0 = by((d) => (isLeaveTask(d.taskId) ? NO_PROJECT : d.projectId));
    const byProj = new Map([...[...byProj0].filter(([k]) => k !== NO_PROJECT), ...[...byProj0].filter(([k]) => k === NO_PROJECT)]);
    const byPhase = by((d) => (d.projectId === NO_PROJECT || isLeaveTask(d.taskId) ? null : d.phaseId || DEFAULT_PHASE));
    return { detail, leaveTotal, byProj, projCount: [...byProj.keys()].filter((k) => k !== NO_PROJECT).length, byEmp: by((d) => d.empId), byTask: by((d) => d.taskId), byPhase, matrix, otByEmp, otTotal, effortByEmp, effortTotal, idleByEmp, idleTotal, total: detail.reduce((s, d) => s + d.hours, 0) };
  }, [data, matchEmp, fProj, fPhase, hoursCfg, holidaySet]);

  const exportExcel = async () => {
    const XLSX = await loadXlsx();
    if (!agg || agg.detail.length === 0) return flash("Không có dữ liệu nào khớp bộ lọc hiện tại.", "err");
    const wb = XLSX.utils.book_new();
    const info = [{
      "Kỳ báo cáo": `${dFull(from)} – ${dFull(to)}`, "Tổng giờ": agg.total, "Giờ OT": +agg.otTotal.toFixed(1), "Giờ cố gắng": +agg.effortTotal.toFixed(1),
      "Số nhân sự": agg.byEmp.size, "Số dự án": agg.projCount,
      "Bộ phận": fDept === "all" ? "Tất cả" : fDept,
      "Vai trò": fRole === "all" ? "Tất cả" : fRole,
      "Dự án lọc": fProj === "all" ? "Tất cả" : projLabel(fProj),
      "Giai đoạn lọc": fPhase === "all" ? "Tất cả" : phaseLabel(fPhase),
      "Từ khoá tìm": q.trim() || "—",
      "Xuất lúc": new Date().toLocaleString("vi-VN"),
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Thông tin kỳ");
    // sort trên bản sao — tránh sửa trực tiếp mảng đang nằm trong state
    const detail = [...agg.detail].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      "Ngày": d.date, "Thứ": DOW[(parseD(d.date).getDay() + 6) % 7],
      "Nhân sự": empName(d.empId), "Bộ phận": empDept(d.empId), "Vai trò": empTitle(d.empId),
      "Dự án": projLabel(d.projectId), "Loại": supportKind(cfg, d.empId, d.projectId, d.date), "Giai đoạn": d.projectId === NO_PROJECT || isLeaveTask(d.taskId) ? "" : phaseLabel(d.phaseId),
      "Hạng mục": taskLabel(d.taskId), "Tăng ca cho tác vụ": isOtId(d.taskId) ? (d.otFor ? taskLabel(d.otFor) : "Chưa rõ") : "",
      "Ghi chú": d.note || "", "Giờ": d.hours,
      // v4.9: hệ số + giờ quy đổi của dòng tăng ca
      "Hệ số TC": isOtId(d.taskId) ? otRateFor(cfg, taskMap.get(d.taskId), otDayKind(d.date, holidaySet)) : "",
      "Giờ quy đổi": isOtId(d.taskId) ? +(d.hours * otRateFor(cfg, taskMap.get(d.taskId), otDayKind(d.date, holidaySet))).toFixed(2) : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Chi tiết");
    /* v4.9 — Tăng ca: dự án × giai đoạn × tác vụ × khung giờ, tách ngày thường / CN / lễ, kèm hệ số và giờ quy đổi */
    {
      const m = new Map(), bandRep = new Map();
      for (const d of agg.detail) {
        if (!isOtId(d.taskId)) continue;
        const kind = otDayKind(d.date, holidaySet);
        const bt = taskMap.get(d.taskId);   // v5.1: gộp theo khung giờ, giữ một hạng mục đại diện để lấy tên + hệ số
        const k = [d.projectId, d.phaseId || DEFAULT_PHASE, d.otFor || "", bt ? otBandKey(bt) : d.taskId, kind].join("|");
        if (bt && !bandRep.has(k)) bandRep.set(k, bt);
        m.set(k, (m.get(k) || 0) + d.hours);
      }
      const KIND = { n: "Ngày thường", s: "Chủ nhật", h: "Ngày lễ" };
      const otRowsX = [...m.entries()].map(([k, h]) => {
        const [pid, ph, forId, , kind] = k.split("|");
        const bt = bandRep.get(k);
        const rate = otRateFor(cfg, bt, kind);
        return { "Dự án": projLabel(pid), "Giai đoạn": phaseLabel(ph), "Tăng ca cho tác vụ": forId ? taskLabel(forId) : "Chưa rõ",
          "Khung giờ": bt ? otText(bt) : "(đã xoá)", "Loại ngày": KIND[kind], "Giờ": +h.toFixed(2), "Hệ số": rate, "Giờ quy đổi": +(h * rate).toFixed(2) };
      }).sort((a, b) => a["Dự án"].localeCompare(b["Dự án"]) || a["Giai đoạn"].localeCompare(b["Giai đoạn"]) || a["Tăng ca cho tác vụ"].localeCompare(b["Tăng ca cho tác vụ"]) || a["Khung giờ"].localeCompare(b["Khung giờ"]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(otRowsX.length ? otRowsX : [{ "Dự án": "(không có giờ tăng ca trong kỳ)" }]), "Tăng ca");
    }
    const sortDesc = (m, fn) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => fn(k, v));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(new Map([...agg.byProj].filter(([k]) => k !== null)), (k, v) => ({ "Dự án": projLabel(k), "Tổng giờ": v, "Tỷ trọng %": +(v / agg.total * 100).toFixed(1) }))), "Theo dự án");
    // v1.9: dự án × phase — giờ dự kiến, đã dùng (theo kỳ và bộ lọc đang chọn), còn lại, % sử dụng
    const usedByProj = new Map(projectRows.map((r) => [r.id, r]));
    const budgetRows = [];
    for (const pr of [...cfg.projects, ...projectRows.filter((r) => !projMapById.has(r.id)).map((r) => ({ id: r.id, name: r.name }))]) {
      if (fProj !== "all" && pr.id !== fProj) continue;
      const u = usedByProj.get(pr.id), bg = projBudgets(pr);
      if (!u && budgetTotal(pr) === 0) continue;
      const line = (label, b, used) => ({ "Mã DA": pr.code || "", "Dự án": pr.name, "Giai đoạn": label, "Giờ dự kiến": b > 0 ? b : "", "Đã dùng": +Number(used).toFixed(1),
        "Còn lại": b > 0 ? +(b - used).toFixed(1) : "", "% sử dụng": b > 0 ? +((used / b) * 100).toFixed(1) : "" });
      for (const ph of PHASES) budgetRows.push(line(`${ph.id} · ${ph.name}`, bg[ph.id], u?.[ph.id] || 0));
      budgetRows.push(line("Tổng", budgetTotal(pr), u?.total || 0));
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budgetRows.length ? budgetRows : [{ "Dự án": "(chưa có dữ liệu)" }]), "Dự kiến theo phase");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(PHASES.map((p) => ({
      "Giai đoạn": `${p.id} · ${p.name}`,
      "Tổng giờ": +(agg.byPhase.get(p.id) || 0).toFixed(1),
      "Tỷ trọng %": agg.total ? +((agg.byPhase.get(p.id) || 0) / agg.total * 100).toFixed(1) : 0,
      "Nội dung": p.desc,
    }))), "Theo giai đoạn");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(agg.byEmp, (k, v) => ({
      "Nhân sự": empName(k), "Bộ phận": empDept(k), "Vai trò": empTitle(k), "Tổng giờ": v,
      "Giờ OT": +(agg.otByEmp.get(k) || 0).toFixed(1),
      "Giờ cố gắng": +(agg.effortByEmp.get(k) || 0).toFixed(1),
      "Giờ trống việc": +(agg.idleByEmp.get(k) || 0).toFixed(1),   // v7.2
      "Giờ thường": +(v - (agg.otByEmp.get(k) || 0) - (agg.effortByEmp.get(k) || 0) - (agg.idleByEmp.get(k) || 0)).toFixed(1),
      // v5.3: tải so với giờ chuẩn của kỳ, cùng ngưỡng với khung Phân bổ · v7.2: tải không gồm trống việc
      "% tải": stdForEmp(k) ? Math.round(((v - (agg.idleByEmp.get(k) || 0)) / stdForEmp(k)) * 100) : "",
      "Trạng thái": (() => { const sp = stdForEmp(k); return sp ? ALLOC_ST[allocState(v, agg.otByEmp.get(k) || 0, agg.effortByEmp.get(k) || 0, agg.idleByEmp.get(k) || 0, sp, allocLimits(cfg))][0] : ""; })(),
    }))), "Theo nhân sự");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(agg.byTask, (k, v) => ({ "Hạng mục": taskLabel(k), "Tổng giờ": v }))), "Theo hạng mục");
    const projIds = [...agg.byProj.keys()];
    const mtx = [...agg.matrix.entries()].map(([eid, mm]) => {
      const row = { "Nhân sự": empName(eid), "Bộ phận": empDept(eid), "Vai trò": empTitle(eid) };
      let t = 0; for (const pid of projIds) { row[projLabel(pid)] = mm.get(pid) || 0; t += mm.get(pid) || 0; }
      row["Tổng"] = t; return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mtx), "Ma trận NS x DA");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.status.filter((s) => matchEmp(s.empId)).map((s) => ({
      "Tháng": s.ym, "Nhân sự": empName(s.empId), "Vai trò": empTitle(s.empId), "Số tuần cần nộp": s.need,
      "Đã nộp": s.done, "Thiếu": s.need - s.done, "Tuần thiếu": s.missing.map(dLabel).join(", "),
    }))), "Tình trạng nộp");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ARTIUS_gio-cong_${from}_den_${to}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    flash("Đã xuất file Excel.");
  };

  /* Hạn mức giờ dự án: dùng toàn bộ dữ liệu đã tải, KHÔNG áp bộ lọc kỳ —
     hỏi "dự án này đã tiêu bao nhiêu giờ" thì phải tính từ đầu, không phải tính trong tháng. */

  /* Gộp ba biểu đồ cũ làm một: giờ theo dự án, phân rã theo giai đoạn, và mốc giờ dự kiến.
     Giờ vắng mặt không thuộc dự án nào nên loại khỏi đây. */
  const projectRows = useMemo(() => {
    if (!agg) return [];
    const m = new Map();
    for (const d of agg.detail) {
      if (isLeaveTask(d.taskId) || d.projectId === NO_PROJECT) continue;
      if (!m.has(d.projectId)) m.set(d.projectId, { total: 0 });
      const row = m.get(d.projectId);
      const ph = d.phaseId || DEFAULT_PHASE;
      row[ph] = (row[ph] || 0) + d.hours;
      row.total += d.hours;
    }
    return [...m.entries()]
      .map(([id, r]) => {
        const p = projMapById.get(id);
        const base = { id, name: projLabel(id), total: r.total, budget: budgetTotal(p), budgets: projBudgets(p) };
        for (const ph of PHASES) base[ph.id] = r[ph.id] || 0;
        return base;
      })
      .sort((a, b) => b.total - a.total);
  }, [agg, projMapById]);

  const nProjActive = cfg.projects.filter((p) => p.active).length;
  const nStaff = cfg.employees.filter((e) => !isResigned(e)).length;
  const segBtn = (on) => `${CTRL} whitespace-nowrap px-3 text-[13px] ${on ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`;
  return (
    <div className="space-y-3 md:space-y-4">
      {/* v5.6 — chuyển tab Dự án | Nhân sự */}
      {!hideBar && <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1 md:inline-flex">
        {/* v11.1: thêm tab "Giờ ngoài dự án" · v12.20: Nhân sự và Giờ ngoài dự án chuyển sang tab Bảng công */}
        {/* v12.22: "Tổng quan nguồn lực" đứng đầu, không có số đếm (n = null) vì không đếm theo người hay dự án */}
        {[["res", "Tổng quan nguồn lực", null], ["proj", "Dự án", nProjActive], ["ppl", "Nhân sự", nStaff], ["mtx", "Ma trận", nStaff], ["off", "Giờ ngoài dự án", nStaff]].filter(([k]) => tabs.includes(k)).map(([k, l, n]) => (
          <button key={k} onClick={() => setDTab(k)} aria-pressed={dTab === k}
            className={`${CTRL} flex flex-1 items-center justify-center gap-2 rounded-lg px-6 text-sm font-medium md:flex-none ${dTab === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>
            {l}{n != null && <span className={`rounded-full px-1.5 font-mono text-[11px] ${dTab === k ? "bg-teal-900/60 text-teal-300" : "bg-slate-800 text-slate-500"}`}>{n}</span>}
          </button>
        ))}
      </div>}

      {/* v12.22 — Tổng quan nguồn lực: một biểu đồ cho cả công ty lẫn từng vai trò theo tuần. Chỉ đọc, lưới nhập vẫn ở tab Kế hoạch. */}
      {dTab === "res" && (
        <Panel title="Tổng quan nguồn lực" flush>
          <ResourcePane cfg={cfg} />
        </Panel>
      )}

      {dTab === "proj" && (
        <Panel title="Tiến độ dự án" sub="Giờ đã dùng từ trước tới nay so với giờ dự kiến từng giai đoạn — không phụ thuộc kỳ" flush>
          <ProjectProgress cfg={cfg} weekPeople={weekPeople} dataTick={dataTick} saveCfg={saveCfg} flash={flash} />
        </Panel>
      )}

      {(dTab === "ppl" || dTab === "mtx" || dTab === "off") && (
        <Panel flush>
          {/* thanh công cụ của tab: kỳ, bộ phận, tìm người, tải lại, Excel — chỉ tác động lên tab Nhân sự */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
            <div className="flex max-w-full overflow-x-auto rounded-md border border-slate-700">
              {[["week", "Tuần"], ["month", "Tháng"]].map(([k, l]) => (
                <button key={k} onClick={() => pickMode(k)} className={segBtn(pMode === k)}>{l}</button>
              ))}
            </div>
            <div className="flex w-full items-center gap-1.5 sm:w-auto">
              <button onClick={() => stepPeriod(-1)} title={pMode === "month" ? "Tháng trước" : pMode === "week" ? "Tuần trước" : "Lùi một khoảng"}
                className={`${CTRL} w-11 shrink-0 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100`}><ChevronLeft size={16} className="mx-auto" /></button>
              <div className="w-40 shrink-0"><DateRangeField from={from} to={to} onChange={pickRange} /></div>
              <button onClick={() => stepPeriod(1)} disabled={atNow} title={pMode === "month" ? "Tháng sau" : pMode === "week" ? "Tuần sau" : "Tiến một khoảng"}
                className={`${CTRL} w-11 shrink-0 rounded-md border border-slate-700 text-slate-400 hover:text-slate-100 disabled:opacity-30`}><ChevronRight size={16} className="mx-auto" /></button>
              {/* v13.10: về kỳ hiện tại — giống tab Bảng công */}
              {!atNow && <button onClick={() => pickMode(pMode === "month" ? "month" : "week")} className="ml-1 shrink-0 whitespace-nowrap text-xs text-teal-400 hover:text-teal-300">{pMode === "month" ? "Tháng này" : "Tuần này"}</button>}
              {loading && <Loader2 className="shrink-0 animate-spin text-slate-500" size={16} />}
            </div>
            {/* v13.12 — bộ phận + vai trò gom vào nút phễu */}
            <FilterButton count={(fDept !== "all" ? 1 : 0) + (fRole !== "all" ? 1 : 0)} onClear={() => { setFDept("all"); setFRole("all"); }}>
              <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={selectCls} aria-label="Bộ phận">
                <option value="all">Tất cả bộ phận</option>
                {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={fRole} onChange={(e) => setFRole(e.target.value)} className={selectCls} aria-label="Vai trò">
                <option value="all">Mọi vai trò</option>
                {roleOpts.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}{r.extra.length ? ` + ${r.extra.join(", ")}` : ""}</option>)}
              </select>
            </FilterButton>
            <div className="relative w-full sm:w-56">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự" className={`pl-9 ${inputCls}`} />
            </div>
            {hasFilter && <button onClick={clearFilters} className={`shrink-0 whitespace-nowrap ${btnGhost}`}><X size={14} /> Bỏ lọc</button>}
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <button onClick={rebuild} disabled={rebuilding} title="Kéo lại bản mới nhất từ lưu trữ, để thấy bảng công người khác vừa gửi"
                className={`flex-1 sm:flex-none ${btnGhost} disabled:opacity-40`}>
                {rebuilding ? <Loader2 className="animate-spin" size={15} /> : <RotateCcw size={15} />} Tải lại
              </button>
              <button onClick={exportExcel} className={`flex-1 sm:flex-none ${btnPrimary}`}><Download size={15} /> Excel</button>
            </div>
          </div>
          {!agg ? <p className="px-4 py-6 text-sm text-slate-500">Đang tải…</p> : dTab === "off" ? (
            /* v11.1 — việc chung, trống việc, vắng mặt: năng lực của kỳ không đổ được vào dự án nào */
            <OffProject cfg={cfg} detail={agg.detail} stdOf={stdForEmp}
              staff={cfg.employees.filter((e) => !isResigned(e) && matchEmp(e.id))}
              empName={empName} taskLabel={taskLabel} />
          ) : (
            <StaffAllocation matrix={agg.matrix} otByEmp={agg.otByEmp} effortByEmp={agg.effortByEmp} idleByEmp={agg.idleByEmp} std={stdBase} stdOf={stdForEmp} cfg={cfg}
              staff={cfg.employees.filter((e) => !isResigned(e) && matchEmp(e.id))}
              empName={empName} projMapById={projMapById} detail={agg.detail}
              projDetail={data.detail} taskLabel={taskLabel} view={dTab === "mtx" ? "matrix" : "people"} />
          )}
        </Panel>
      )}
    </div>
  );
}


