/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Clock, ChevronLeft, ChevronRight, LogOut, Loader2, Bell, Send,
} from "lucide-react";
import { askPermission, syncPush, pushPermission, sendTestPush } from "../push.js";
import { DEFAULT_HOURS, addDays, dLabel, effortHoursFor, fmt, lastOfMonth, makeHolidayIndex, minHoursFor, mondayOf, parseD, prevYm, ymOf, ymsBetween } from "../core/date.jsx";
import { dbTs, ensureMonths, isOn, sdel, sget, sset, useDataTick } from "../core/db.jsx";
import { DEFAULT_PHASE, fmtH, isIdleTask, isLeaveTask, isOtId, roleTitle } from "../core/domain.jsx";
import { useTheme } from "../core/theme.jsx";
import { APP_VERSION, Panel, btnGhost, btnPrimary } from "../core/ui.jsx";
import { runOtExport } from "../shared/otReport.js";   // v13.31: xuất Excel tăng ca, dùng chung với màn Chấm công
import { dayStyle, dayStyleSm } from "../shared/dayStyle.jsx";

/* ============================ CÀI ĐẶT CÁ NHÂN (nhân sự) ============================ */
/* v2.6 — Trạng thái thông báo trên máy tính của trình duyệt đang dùng */
export function PushStatusRow() {
  const [perm, setPerm] = useState(pushPermission());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const enable = async () => { setPerm(await askPermission()); };
  const test = async () => {
    setBusy(true); setMsg("");
    try { await syncPush(); const r = await sendTestPush(); setMsg(r.delivered > 0 ? "Đã gửi thử — xem góc phải dưới màn hình." : "Chưa gửi được tới trình duyệt này."); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const label = { granted: "Đã bật", denied: "Đã chặn", default: "Chưa bật", unsupported: "Trình duyệt không hỗ trợ" }[perm] || perm;
  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-200">Thông báo trên máy tính</div>
          <div className="mt-0.5 text-xs text-slate-500">Nhắc nộp bảng công hiện ở góc màn hình, kể cả khi không mở ARTIUS.</div>
        </div>
        <span className={`shrink-0 text-xs ${perm === "granted" ? "text-teal-400" : perm === "denied" ? "text-rose-400" : "text-amber-400"}`}>{label}</span>
      </div>
      {perm === "default" && <button onClick={enable} className={`mt-3 ${btnGhost}`}><Bell size={14} /> Bật thông báo</button>}
      {perm === "granted" && <button onClick={test} disabled={busy} className={`mt-3 ${btnGhost} disabled:opacity-40`}>{busy ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Gửi thử</button>}
      {perm === "denied" && <p className="mt-2 text-xs text-slate-500">Bấm biểu tượng ổ khoá bên trái thanh địa chỉ → Thông báo → Cho phép, rồi tải lại trang.</p>}
      {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
    </div>
  );
}

export function EmployeeSettings({ cfg, empId, onSignOut = null }) {
  const [, setThemePref, themePref] = useTheme();
  const emp = cfg.employees.find((e) => e.id === empId);
  const prefKey = `artius:hide-deadline:${empId}`;
  const [hidden, setHidden] = useState(null); // null = đang tải
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setHidden(isOn(await sget(prefKey, false)));
    })();
  }, [prefKey]);

  const toggleReminder = async () => {
    setSaving(true);
    const next = !hidden; // next = true nghĩa là chuyển sang trạng thái ẨN nhắc nhở
    if (next) await sset(prefKey, 1, false);
    else await sdel(prefKey, false);
    setHidden(next); setSaving(false);
  };

  const initials = String(emp?.name || "?").trim().split(/\s+/).slice(-2).map((w) => w[0] || "").join("").toUpperCase();
  return (
    <div className="space-y-3 md:space-y-4">
      {/* v8.4 — điện thoại: thẻ tài khoản + Giao diện + Phiên bản + Đăng xuất (máy tính vẫn ở header) */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3.5 md:hidden">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white" style={{ background: "linear-gradient(135deg,#06b6d4,#4f46e5)" }}>{initials}</div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-100">{emp?.name}</div>
          <div className="truncate text-xs text-slate-500">{[emp?.code, emp?.dept, roleTitle(emp?.role)].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3 md:hidden">
        <span className="text-sm text-slate-200">Giao diện</span>
        <div role="radiogroup" aria-label="Giao diện" className="flex overflow-hidden rounded-lg border border-slate-700">
          {[["dark", "Tối"], ["light", "Sáng"], ["system", "Theo máy"]].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={themePref === k} onClick={() => setThemePref(k)}
              className={`px-3 py-1.5 text-[13px] ${themePref === k ? "bg-teal-600 font-medium text-white" : "text-slate-400"}`}>{l}</button>
          ))}
        </div>
      </div>
      <Panel title="Thông tin cá nhân">
        <div className="space-y-1.5 text-sm">
          <div><span className="text-slate-500">Họ và tên: </span><span className="text-slate-100">{emp?.name}</span></div>
          {emp?.code && <div><span className="text-slate-500">Mã nhân viên: </span><span className="font-mono text-slate-100">{emp.code}</span></div>}
          <div><span className="text-slate-500">Bộ phận: </span><span className="text-slate-100">{emp?.dept}</span></div>
          <div><span className="text-slate-500">Vai trò: </span><span className="text-slate-100">{roleTitle(emp?.role) || <span className="text-slate-500">Chưa có</span>}</span></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Muốn đổi tên, mã nhân viên, bộ phận hoặc vai trò, liên hệ Ban quản lý — nhân sự không tự sửa được thông tin này.</p>
      </Panel>

      <Panel title="Thông báo">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-slate-200">Nhắc nhở bảng công chưa gửi</div>
            <div className="mt-0.5 text-xs text-slate-500">Hiện banner cảnh báo ở đầu trang Chấm công khi còn tuần chưa gửi trước hạn chốt công.</div>
          </div>
          {hidden === null ? (
            <Loader2 className="animate-spin shrink-0 self-center text-slate-500" size={16} />
          ) : (
            <button onClick={toggleReminder} disabled={saving}
              className={`relative inline-block h-6 w-11 shrink-0 self-center appearance-none rounded-full border-0 p-0 align-middle leading-none transition-colors disabled:opacity-50 ${!hidden ? "bg-teal-600" : "bg-slate-700"}`}>
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${!hidden ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          )}
        </div>
        {hidden && <p className="mt-3 text-xs text-amber-400">Đang tắt — bạn sẽ không thấy nhắc nhở kể cả khi còn tuần chưa gửi. Bật lại bất cứ lúc nào tại đây.</p>}
        <PushStatusRow />
      </Panel>

      {/* v8.1 — bỏ "Kiểm tra lưu trữ" ở Cài đặt nhân viên (chỉ còn ở Thiết lập của Admin) */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3 text-sm md:hidden">
        <span className="text-slate-200">Phiên bản</span><span className="font-mono text-slate-500">ARTIUS TIME {APP_VERSION}</span>
      </div>
      {onSignOut && (
        <button onClick={onSignOut} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-900 bg-rose-950 text-[15px] font-semibold text-rose-300 md:hidden">
          <LogOut size={16} /> Đăng xuất
        </button>
      )}
    </div>
  );
}


/* v7.0 — Lịch tháng ở Dashboard cá nhân: mỗi ô một ngày, cùng quy tắc trạng thái và cùng bộ màu DAY_ST với bảng
   Tuần của quản lý (đủ giờ · thiếu · nháp chưa gửi · bỏ trống · nghỉ phép "P" · ngày lễ "Lễ" · CN / chưa tới, +h tăng ca).
   Bấm một ngày đã qua → mở màn Chấm công đúng tuần chứa ngày đó. */
export function MonthCalendar({ cfg, empId, ym, setYm, loading, onOpenWeek }) {
  const dataTick = useDataTick();
  const today = fmt(new Date());
  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const hs = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const curYm = ymOf(today);
  const [tick, setTick] = useState(0);
  useEffect(() => { let on = true; ensureMonths([ym]).then(() => on && setTick((t) => t + 1)); return () => { on = false; }; }, [ym, dataTick]);
  const first = parseD(`${ym}-01`), last = lastOfMonth(first);
  const step = (n) => setYm(ymOf(fmt(new Date(first.getFullYear(), first.getMonth() + n, 1))));
  const cells = useMemo(() => {
    const m = new Map();
    const b = dbTs(empId, ym); const sent = b?.sent || {};
    for (const r of b?.rows || []) for (const [d, hv] of Object.entries(r.days || {})) {
      const h = Number(hv) || 0; if (h <= 0) continue;
      const c = m.get(d) || { reg: 0, ot: 0, leave: 0, draft: 0, idle: 0 };
      if (!sent[d]) c.draft += h; else if (isOtId(r.taskId)) c.ot += h; else if (isLeaveTask(r.taskId)) c.leave += h; else { c.reg += h; if (isIdleTask(r.taskId)) c.idle += h; }
      m.set(d, c);
    }
    return m;
  }, [empId, ym, tick, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps
  // cùng quy tắc với dayInfo() của bảng quản lý
  const info = (d) => {
    const c = cells.get(d) || { reg: 0, ot: 0, leave: 0, draft: 0, idle: 0 };
    const std = minHoursFor(d, hoursCfg, hs) || 0, done = c.reg + c.leave;
    /* v7.1 — tách giờ cố gắng (giống Dashboard / màn chấm công): chuẩn = tổng − OT − cố gắng */
    const ef = effortHoursFor(d, c.reg - c.idle, hoursCfg, hs), tot = done + c.ot, sd = Math.max(0, done - ef - c.idle);   // v7.2: sd không gồm trống việc
    let st;
    if (hs.has(d)) st = "hol";
    else if (d > today) st = "fut";
    else if (d === today && done + c.ot + c.draft === 0) st = "fut";
    else if (!std) st = done + c.ot > 0 ? (c.draft ? "draft" : "full") : c.draft ? "draft" : "off";
    else if (c.leave > 0 && c.reg === 0 && !c.draft) st = "leave";
    else if (done >= std) st = "full";
    else if (c.draft > 0) st = "draft";
    else st = done > 0 ? "part" : "none";
    return { ...c, done, ef, tot, sd, st };
  };
  const days = [];
  for (let d = mondayOf(first); d <= last || d.getDay() !== 1; d = addDays(d, 1)) days.push(d.getMonth() === first.getMonth() ? fmt(d) : null);
  let miss = 0, drafts = 0;
  for (const d of days) if (d) { const s = info(d).st; if (s === "none" || s === "part") miss++; if (s === "draft") drafts++; }
  const fh = (v) => fmtH(v);
  const DOWS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Lịch tháng</span>
        <button type="button" onClick={() => step(-1)} aria-label="Tháng trước" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"><ChevronLeft size={15} /></button>
        <span className="min-w-[96px] text-center text-sm font-semibold text-slate-100">Tháng {first.getMonth() + 1}/{first.getFullYear()}</span>
        <button type="button" onClick={() => step(1)} aria-label="Tháng sau" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"><ChevronRight size={15} /></button>
        {/* chỉ hiện khi đang xem tháng khác — bấm để quay về tháng hiện tại */}
        {ym !== curYm && <button type="button" onClick={() => setYm(curYm)} className="h-8 rounded-md px-2 text-xs text-teal-400 hover:bg-slate-800 hover:text-teal-300">Tháng này</button>}
        {loading && <Loader2 className="animate-spin text-slate-500" size={15} />}
        <span className="w-full text-xs text-slate-400 sm:ml-auto sm:w-auto">
          {miss ? <><b className="font-semibold text-rose-400">{miss} ngày</b> chưa đủ giờ</> : <span className="text-teal-300">Không sót ngày nào</span>}
          {drafts > 0 && <> · {drafts} ngày nháp chưa gửi</>}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOWS.map((x) => <div key={x} className="pb-0.5 text-center text-[10px] text-slate-500">{x}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const x = info(d);
          /* v7.1 — số to = TỔNG giờ (gồm OT); dòng nhỏ = chuẩn · +OT · +cố gắng, chỉ hiện khi có OT hoặc cố gắng */
          const txt = x.st === "hol" ? "Lễ" : x.st === "leave" ? "P" : x.st === "none" ? "—" : x.st === "fut" || x.st === "off" ? (x.tot ? fh(x.tot) : "") : fh(x.st === "draft" ? x.tot + x.draft : x.tot);
          const split = x.st !== "draft" && (x.ot > 0 || x.ef > 0 || x.idle > 0);
          const can = d <= today && !!onOpenWeek;
          return (
            <button key={d} type="button" disabled={!can} onClick={() => onOpenWeek(fmt(mondayOf(parseD(d))))} style={dayStyle(x.st)}
              title={`${DOWS[(parseD(d).getDay() + 6) % 7]} ${dLabel(d)}${hs.has(d) ? ` · ${hs.get(d)}` : ""}${x.tot || x.draft ? ` · chuẩn ${fh(x.sd)}${x.idle ? ` · trống việc ${fh(x.idle)}` : ""} · OT ${fh(x.ot)} · cố gắng ${fh(x.ef)} · tổng ${fh(x.tot)} h${x.draft ? ` · nháp ${fh(x.draft)} h` : ""}` : ""}${can ? " — bấm để mở Chấm công tuần này" : ""}`}
              className={`relative flex h-14 flex-col items-center justify-center rounded-md md:h-[60px] ${can ? "cell-hov cursor-pointer" : "cursor-default"} ${x.st === "hol" ? "text-[13px] font-medium" : "font-mono text-[13px] font-semibold"} ${d === today ? "outline outline-2 outline-offset-1 outline-teal-400" : ""}`}>
              <span className="absolute left-1.5 top-0.5 font-sans text-[10px] font-normal text-slate-500">{parseD(d).getDate()}</span>
              <span className="leading-none">{txt}</span>
              {split && (
                <small className="mt-0.5 flex items-baseline justify-center gap-[3px] font-mono text-[10px] font-medium leading-none">
                  {x.sd > 0 && <span className="text-blue-400">{fh(x.sd)}</span>}
                  {x.idle > 0 && <span className="text-slate-400">{x.sd > 0 ? "+" : ""}{fh(x.idle)}</span>}
                  {x.ot > 0 && <span className="text-teal-400">{x.sd + x.idle > 0 ? "+" : ""}{fh(x.ot)}</span>}
                  {x.ef > 0 && <span className="cg-num text-violet-400">+{fh(x.ef)}</span>}
                </small>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 pt-2.5 text-[11px] text-slate-400">
        {[["full", "Đủ giờ chuẩn"], ["part", "Thiếu giờ"], ["draft", "Nháp chưa gửi"], ["none", "Bỏ trống"], ["leave", "Nghỉ phép"], ["hol", "Ngày lễ"], ["fut", "CN / chưa tới"]].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px]" style={dayStyleSm(k)} />{l}</span>
        ))}
        <span className="flex w-full items-center gap-2 pt-0.5"><span className="text-slate-500">Số to = tổng giờ ·</span>
          <span className="font-mono text-blue-400">chuẩn</span><span className="font-mono text-slate-400">+trống việc</span><span className="font-mono text-teal-400">+OT</span><span className="font-mono text-violet-400">+cố gắng</span></span>
      </div>
    </div>
  );
}

export function EmployeeDashboard({ cfg, empId, onGoTimesheet, onOtReady, flash }) {
  const emp = cfg.employees.find((e) => e.id === empId);
  /* v7.0 — kỳ xem = tháng đang mở trên Lịch tháng (bỏ ô chọn khoảng ngày và các nút 4 tuần / Tháng này / Tháng trước) */
  const [ym, setYm] = useState(() => ymOf(fmt(new Date())));
  const from = `${ym}-01`, to = fmt(lastOfMonth(parseD(from)));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  /* v13.31 — nút "Excel tăng ca" trên header cũng dùng được ở tab Dashboard, theo đúng THÁNG
     đang mở trên Lịch tháng ở đây (không phải tháng của màn Chấm công). */
  const [otBusy, setOtBusy] = useState(false);
  useEffect(() => {
    if (!onOtReady) return undefined;
    onOtReady({ ym, busy: otBusy, run: async () => { if (otBusy) return; setOtBusy(true); try { await runOtExport({ cfg, empId, ym, flash }); } finally { setOtBusy(false); } } });
    return () => onOtReady(null);
  }, [ym, otBusy, onOtReady]);   // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const yms = ymsBetween(from, to);
    await ensureMonths([prevYm(yms[0]), ...yms]);
    const raw = [];
    for (const ym of yms) raw.push({ ym, data: dbTs(empId, ym) });
    const detail = [];
    for (const { data: d } of raw) {
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;
        detail.push({ date, hours: Number(h), projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, note: r.note || "" });
      }
    }
    setData({ detail }); setLoading(false);
  }, [from, to, empId]);

  useEffect(() => { load(); }, [load]);   // v3.8: đổi kỳ (hoặc bấm nút nhanh) là tải lại ngay, bỏ nút Cập nhật



  /* v3.8 — Dashboard cá nhân kiểu "tóm tắt tuần" (phương án A): một câu nói thẳng trạng thái, danh sách từng tuần
     có nhãn Đủ / Thiếu / Đang chấm và thanh 3 màu (giờ chuẩn · OT · giờ cố gắng), cùng tỷ trọng theo dự án.
     Giờ chuẩn của ngày = tổng − OT − giờ cố gắng (giống màn chấm công v3.7). Ngày thiếu = ngày làm việc đã qua
     (có giờ chuẩn, không phải ngày lễ) mà tổng giờ chấm < giờ chuẩn. */
  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidaySet = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const todayStr = fmt(new Date());
  const DOW_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const view = useMemo(() => {
    if (!data) return null;
    const day = new Map();      // dateStr -> { tot, ot, reg }
    const byProj = new Map();   // projectId -> giờ (không gồm vắng mặt)
    let leaveHrs = 0;
    for (const d of data.detail) {
      const c = day.get(d.date) || { tot: 0, ot: 0, reg: 0, idle: 0 };
      c.tot += d.hours;
      if (isOtId(d.taskId)) c.ot += d.hours; else if (!isLeaveTask(d.taskId)) { c.reg += d.hours; if (isIdleTask(d.taskId)) c.idle += d.hours; }
      day.set(d.date, c);
      if (isLeaveTask(d.taskId)) leaveHrs += d.hours;
      else byProj.set(d.projectId, (byProj.get(d.projectId) || 0) + d.hours);
    }
    const info = (s) => {
      const c = day.get(s) || { tot: 0, ot: 0, reg: 0, idle: 0 };
      const ef = effortHoursFor(s, c.reg - c.idle, hoursCfg, holidaySet);   // v7.2: trống việc không thành giờ cố gắng
      // std gồm cả trống việc (để xét đủ / thiếu); idle tách riêng để vẽ khúc xám
      return { tot: c.tot, ot: c.ot, ef, idle: c.idle, std: Math.max(0, c.tot - c.ot - ef), min: minHoursFor(s, hoursCfg, holidaySet) };
    };
    const weeks = [];
    for (let m = mondayOf(parseD(from)); fmt(m) <= to; m = addDays(m, 7)) {
      const ds = [];
      for (let i = 0; i < 7; i++) { const k = fmt(addDays(m, i)); if (k >= from && k <= to) ds.push(k); }
      if (ds.length === 0 || ds[0] > todayStr) continue;   // tuần chưa tới thì không liệt kê
      const w = { monday: fmt(m), label: `${dLabel(ds[0])} – ${dLabel(ds[ds.length - 1])}`, std: 0, ot: 0, ef: 0, idle: 0, tot: 0, target: 0, miss: [],
        isCur: ds.includes(todayStr), days: [] };
      for (const k of ds) {
        const x = info(k);
        w.std += x.std; w.ot += x.ot; w.ef += x.ef; w.idle += x.idle; w.tot += x.tot;
        const due = k <= todayStr && x.min !== null;
        // v4.0: thiếu = giờ chuẩn (không tính OT, cố gắng) < giờ chuẩn của ngày
        if (due) { w.target += x.min; if (x.std < x.min) w.miss.push(k); }
        w.days.push({ k, ...x, st: k > todayStr ? "fut" : x.min === null ? (x.tot > 0 ? "ok" : "off") : x.std < x.min ? "miss" : "ok" });
      }
      weeks.push(w);
    }
    const sum = (f) => weeks.reduce((a, w) => a + w[f], 0);
    // v3.9: giờ chuẩn danh nghĩa một tuần (mặc định 44h) — vẽ nét dọc định vị trên các thanh tuần
    const weekStd = ["weekday", "weekday", "weekday", "weekday", "weekday", "sat", "sun"].reduce((a, k) => a + (Number(hoursCfg[k]) || 0), 0);
    // v7.1: thang theo tổng giờ / giờ chuẩn của từng tuần (bỏ vạch 44h cố định) — giống khung Phân bổ của quản lý
    const scale = Math.max(1, ...weeks.map((w) => Math.max(w.tot, w.target))) * 1.04;
    const projTotal = [...byProj.values()].reduce((a, v) => a + v, 0);
    const projects = [...byProj.entries()].sort((a, b) => b[1] - a[1]).map(([id, h]) => ({ id, h, pct: projTotal ? (h / projTotal) * 100 : 0 }));
    return { weeks, scale, weekStd, projects, leaveHrs, std: sum("std"), ot: sum("ot"), ef: sum("ef"), idle: sum("idle"), tot: sum("tot"), target: sum("target") };
  }, [data, from, to, todayStr, hoursCfg, holidaySet]);

  const cur = view?.weeks.find((w) => w.isCur) || null;
  const pastMiss = view ? view.weeks.filter((w) => !w.isCur && w.miss.length > 0) : [];
  const anyMiss = !!view && (pastMiss.length > 0 || (cur && cur.miss.length > 0));
  // v7.1 — "Chấm công ngay" mở thẳng tuần CŨ NHẤT còn thiếu của tháng đang xem (hết tuần cũ thiếu mới tới tuần này)
  const goWeek = view ? view.weeks.find((w) => w.miss.length > 0) || null : null;
  const shortDays = (list) => list.map((k) => `${DOW_SHORT[(parseD(k).getDay() + 6) % 7]} ${dLabel(k)}`).join(", ");

  return (
    <div className="space-y-3 md:space-y-4">
      {view && (
        <>
          {/* Câu tóm tắt: nói thẳng còn thiếu gì */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:flex-row md:items-center md:gap-5">
            <div className="min-w-0 flex-1 text-base font-semibold leading-relaxed text-slate-100 md:text-lg" style={{ textWrap: "balance" }}>
              {!anyMiss ? (
                <span className="text-teal-300">Bạn đã chấm đủ giờ {cur ? "đến hôm nay" : `trong tháng ${+ym.slice(5)}/${ym.slice(0, 4)}`}.</span>
              ) : (
                <>
                  {cur && cur.miss.length > 0 && (cur.tot === 0
                    ? <>Tuần này bạn chưa chấm giờ nào. <span className="text-rose-400">Còn thiếu {cur.miss.length} ngày</span>{pastMiss.length ? "" : "."} </>
                    : <>Tuần này <span className="text-rose-400">còn thiếu giờ {cur.miss.length} ngày</span> ({shortDays(cur.miss)}){pastMiss.length ? "" : "."} </>)}
                  {cur && cur.miss.length === 0 && <>Tuần này đã đủ giờ đến hôm nay. </>}
                  {pastMiss.length > 0 && <>{cur && cur.miss.length > 0 ? "và " : ""}<span className="text-rose-400">
                    {pastMiss.length === 1 ? `tuần ${pastMiss[0].label}` : `${pastMiss.length} tuần trước`}</span> chưa đủ giờ.</>}
                </>
              )}
            </div>
            {cur && (
              <div className="flex gap-1.5">
                {cur.days.filter((x) => !(x.st === "off" && (parseD(x.k).getDay() === 0))).map((x) => (
                  <div key={x.k} title={`${shortDays([x.k])}: ${x.tot ? `${x.tot.toFixed(1)} giờ` : "chưa chấm"}`}
                    className={`w-11 rounded-lg border py-1.5 text-center text-[11px] ${x.st === "miss" ? "border-rose-900 text-rose-400" : x.st === "ok" ? "border-teal-800 text-teal-400" : x.st === "fut" ? "border-slate-800 text-slate-600 opacity-60" : "border-slate-800 text-slate-600"}`}>
                    {DOW_SHORT[(parseD(x.k).getDay() + 6) % 7]}
                    <b className="block font-mono text-[13px] font-medium text-slate-200">{parseD(x.k).getDate()}</b>
                  </div>
                ))}
              </div>
            )}
            {anyMiss && onGoTimesheet && (
              <button onClick={() => onGoTimesheet(goWeek?.monday)} title={goWeek ? `Mở Chấm công tuần ${goWeek.label}` : undefined}
                className={`${btnPrimary} shrink-0`}><Clock size={15} /> Chấm công ngay</button>
            )}
          </div>

          <div className="grid items-start gap-3 lg:grid-cols-2 md:gap-4">
            {/* Từng tuần — v7.0: khung cao vừa nội dung (items-start), không kéo giãn theo khung bên cạnh */}
            <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
              {/* v7.1 — thanh tuần kiểu khung Phân bổ của quản lý: số giờ trong từng khúc, vạch giờ chuẩn của tuần (tính đến hôm nay),
                  ngoặc vàng "thiếu X h" từ cuối phần Giờ chuẩn tới vạch (OT / cố gắng không bù vào), cột phải là tổng giờ */}
              <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Từng tuần</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-800 pb-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />Giờ chuẩn</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Trống việc</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-400" />OT</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400" />Giờ cố gắng</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-slate-100/60" />giờ chuẩn của tuần (tính đến hôm nay)</span>
                <span className="text-amber-400">⌃ thiếu giờ chuẩn</span>
              </div>
              {view.weeks.length === 0 ? <p className="py-3 text-sm text-slate-500">Tháng này chưa tới.</p> : (
                <div className="divide-y divide-slate-800">
                  {[...view.weeks].reverse().map((w) => {
                    const extra = w.ot + w.ef;
                    const pill = w.target === 0 && w.tot === 0 ? ["Nghỉ", "border-slate-700 text-slate-500"]
                      : w.miss.length === 0 ? [`Đủ${extra > 0 ? ` · +${fmtH(extra)}` : ""}`, "border-teal-900 bg-teal-950 text-teal-300"]
                      : w.isCur ? [`Đang chấm · thiếu ${w.miss.length} ngày`, "border-amber-900 bg-amber-950/70 text-amber-300"]
                      : w.tot === 0 ? ["Chưa chấm", "border-rose-900 bg-rose-950 text-rose-300"]
                      : [`Thiếu ${w.miss.length} ngày`, "border-rose-900 bg-rose-950 text-rose-300"];
                    const p = (v) => (v / view.scale) * 100;
                    const gap = w.target - w.std;
                    return (
                      <div key={w.monday}
                        className="-mx-2 grid w-[calc(100%+1rem)] grid-cols-[92px_minmax(0,1fr)_56px] items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm md:grid-cols-[100px_minmax(0,1fr)_60px_150px]"
                        title={`Chuẩn ${fmtH(w.std - w.idle)}${w.idle ? ` · trống việc ${fmtH(w.idle)}` : ""} · OT ${fmtH(w.ot)} · cố gắng ${fmtH(w.ef)} · tổng ${fmtH(w.tot)} giờ · giờ chuẩn của tuần ${fmtH(w.target)}`}>
                        <span className="font-mono text-xs text-slate-300">{w.label}</span>
                        <div className="relative pt-[18px]">
                          <div className="flex h-[18px] overflow-hidden rounded-full bg-slate-800 font-mono text-[11px] font-semibold text-slate-950">
                            {[[w.std - w.idle, "bg-blue-400", "Giờ chuẩn"], [w.idle, "bg-slate-400", "Trống việc"], [w.ot, "bg-teal-400", "OT"], [w.ef, "bg-violet-400", "Giờ cố gắng"]].filter(([v]) => v > 0.05).map(([v, cls, l], i) => (
                              <i key={l} title={`${l}: ${fmtH(v)} h`} className={`flex h-full items-center justify-center overflow-hidden whitespace-nowrap not-italic ${cls} ${i ? "border-l-2 border-slate-900" : ""}`}
                                style={{ width: `${p(v)}%` }}>{p(v) >= 5 ? fmtH(v) : ""}</i>
                            ))}
                          </div>
                          {w.target > 0 && gap > 0.05 && (
                            <span className="pointer-events-none absolute top-3 h-[5px] rounded-t-[3px] border-[1.5px] border-b-0 border-amber-400" style={{ left: `${p(w.std)}%`, width: `${p(gap)}%` }}>
                              <span className="absolute -top-[5px] left-1/2 h-1 w-[1.5px] -translate-x-1/2 bg-amber-400" />
                              <span className="absolute bottom-[9px] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[11px] font-medium leading-none text-amber-400">thiếu {fmtH(gap)} h</span>
                            </span>
                          )}
                          {w.target > 0 && <span className="pointer-events-none absolute -bottom-1.5 top-3 w-px -translate-x-1/2 bg-slate-100/55 shadow-[0_0_0_1.5px_#0f172a]" style={{ left: `${p(w.target)}%` }} />}
                        </div>
                        <span className={`text-right font-mono text-sm font-semibold ${w.miss.length === 0 ? "text-slate-100" : w.isCur ? "text-amber-400" : "text-rose-400"}`}>{fmtH(w.tot)} h</span>
                        <span className={`col-span-3 justify-self-start whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] md:col-span-1 md:justify-self-end ${pill[1]}`}>{pill[0]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* cả kỳ chuyển xuống đây; khung bên phải dành cho chi tiết tuần */}
              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-slate-800 pt-2.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Cả tháng</span>
                <span className="font-mono text-[13px]">
                  <span className="text-blue-400">{(view.std - view.idle).toFixed(1)}</span> chuẩn <span className="text-slate-600">+</span>{" "}
                  {view.idle > 0 && <><span className="text-slate-400">{view.idle.toFixed(1)}</span> trống việc <span className="text-slate-600">+</span>{" "}</>}
                  <span className="text-teal-400">{view.ot.toFixed(1)}</span> OT <span className="text-slate-600">+</span>{" "}
                  <span className="cg-num text-violet-400">{view.ef.toFixed(1)}</span> cố gắng <span className="text-slate-600">=</span>{" "}
                  <b className="text-slate-50">{view.tot.toFixed(1)}</b> giờ
                </span>
                <span className="text-[11px] text-slate-500">· target đến hôm nay {view.target.toFixed(0)} giờ chuẩn</span>
              </div>
            </div>

            {/* v7.0 — Lịch tháng thay cho Chi tiết tuần: nhân viên tự soát ngày chấm sót, màu ô giống hệt bảng Tuần của quản lý */}
            <MonthCalendar cfg={cfg} empId={empId} ym={ym} setYm={setYm} loading={loading} onOpenWeek={onGoTimesheet} />
          </div>
        </>
      )}
    </div>
  );
}

