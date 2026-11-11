/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useRef } from "react";
import {
  Download, Trash2, AlertTriangle, ChevronUp, ChevronDown, CheckCircle2, Check, CalendarDays, Share, Sun, Moon, Monitor, Filter,
} from "lucide-react";
import { DEFAULT_HOURS, DOW_MINI, OT_ALERT, addDays, dFull, dLabel, effortHoursFor, fmt, holidayRingBg, makeHolidayIndex, minHoursFor, mondayOf, pad, parseD, weekDays, ymOf } from "./date.jsx";
import { dbTs, ensureMonths } from "./db.jsx";
import { isIdleTask, isOtId, leaveTypeOfTask, tone } from "./domain.jsx";
import { useTheme } from "./theme.jsx";

export function BrandLogo({ className }) {
  const [theme] = useTheme();
  return <img src={theme === "light" ? "/logo-artius-time-light.svg" : "/logo-artius-time.svg"} alt="ARTIUS Time Tracking" className={className} />;
}
/* nút chọn giao diện: 3 ô Tối · Sáng · Theo máy */
export function ThemeToggle() {
  const [, setPref, pref] = useTheme();
  const opts = [["dark", Moon, "Tối"], ["light", Sun, "Sáng"], ["system", Monitor, "Theo máy"]];
  return (
    <div role="radiogroup" aria-label="Giao diện" className="ml-3 inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-slate-700 p-0.5">
      {opts.map(([k, Icon, l]) => (
        <button key={k} role="radio" aria-checked={pref === k} onClick={() => setPref(k)}
          title={k === "system" ? "Theo máy — tự sáng / tối theo cài đặt của máy tính hoặc điện thoại" : `Giao diện ${l}`}
          className={`inline-flex h-7 w-8 items-center justify-center rounded-md transition-colors ${pref === k ? "bg-teal-500/15 text-teal-300" : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"}`}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

export const APP_VERSION = "v13.70";
/* v4.1 — Cài app (PWA). Bắt sự kiện "beforeinstallprompt" ngay lúc nạp module (trước khi React vẽ) để không lỡ.
   Chrome/Edge (máy tính, Android): bấm "Cài app" hiện hộp cài của trình duyệt.
   iPhone/iPad: Safari không có hộp cài — hiện hướng dẫn "Chia sẻ → Thêm vào MH chính".
   Đang chạy dạng app đã cài thì ẩn nút. */
export let INSTALL_EVT = null;
export const installSubs = new Set();
export const notifyInstall = () => installSubs.forEach((f) => f());
export const isStandalone = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
};
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); INSTALL_EVT = e; notifyInstall(); });
  window.addEventListener("appinstalled", () => { INSTALL_EVT = null; notifyInstall(); });
}
export function useInstall() {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((x) => x + 1); installSubs.add(f); return () => installSubs.delete(f); }, []);
  const mode = isStandalone() ? null : INSTALL_EVT ? "prompt" : isIOS() ? "ios" : null;
  const install = async () => {
    const e = INSTALL_EVT;
    if (!e) return null;
    INSTALL_EVT = null;            // mỗi sự kiện chỉ gọi prompt() được một lần
    e.prompt();
    const r = await e.userChoice.catch(() => null);
    notifyInstall();
    return r?.outcome || null;
  };
  return { mode, install };
}

export function InstallButton() {
  const { mode, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  if (!mode) return null;
  return (
    <>
      <button onClick={() => (mode === "ios" ? setIosHelp(true) : install())}
        className="ml-3 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-teal-800 px-2.5 text-xs text-teal-300 hover:border-teal-600 hover:text-teal-200">
        <Download size={13} /> Cài app
      </button>
      {iosHelp && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 md:items-center" onClick={() => setIosHelp(false)}>
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm text-slate-50">Cài ARTIUS TIME lên iPhone</h4>
            <ol className="mt-3 space-y-2.5 text-sm text-slate-300">
              <li className="flex gap-2"><span className="w-4 shrink-0 font-mono text-teal-400">1</span><span>Mở trang này bằng Safari, bấm nút Chia sẻ <Share size={14} className="inline align-[-2px] text-teal-300" /> ở thanh dưới</span></li>
              <li className="flex gap-2"><span className="w-4 shrink-0 font-mono text-teal-400">2</span><span>Chọn "Thêm vào MH chính" → Thêm</span></li>
              <li className="flex gap-2"><span className="w-4 shrink-0 font-mono text-teal-400">3</span><span>Mở app từ icon ARTIUS TIME, đăng nhập một lần và cho phép thông báo</span></li>
            </ol>
            <button onClick={() => setIosHelp(false)} className={`mt-4 w-full ${btnGhost}`}>Đã hiểu</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   DESIGN TOKENS — mọi control dùng chung, chiều cao 44px (h-11)
   ============================================================ */
export const CTRL = "h-11";
export const inputCls = `${CTRL} w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none`;
export const selectCls = inputCls;
export const btnBase = `${CTRL} inline-flex items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium`;
export const btnPrimary = `${btnBase} bg-teal-600 text-white hover:bg-teal-500`;
export const btnGhost = `${btnBase} border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-50`;
export const btnDanger = `${btnBase} border border-rose-900 bg-rose-950 text-rose-300 hover:bg-rose-900`;
export const iconBtn = "flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100";
export const GUT = 36; // bằng đúng bề rộng iconBtn — giữ ô Dự án và ô Hạng mục thẳng hàng nhau

export const Panel = ({ title, sub, right, flush = false, children }) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900">
    {title && (
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-slate-200">{title}</h3>
          {sub && <div className="mt-0.5 text-[11.5px] text-slate-500">{sub}</div>}
        </div>
        {right}
      </div>
    )}
    {/* v5.6: flush = phần thân không đệm, để thanh công cụ / KPI chạy sát mép khung */}
    <div className={flush ? "" : "p-3 md:p-4"}>{children}</div>
  </section>
);
export const Kpi = ({ label, value, unit }) => (
  <div className="h-full rounded-xl border border-slate-800 bg-slate-900 p-3 md:p-4">
    {/* tracking hẹp lại ở màn rộng: 6 ô cùng hàng nên nhãn dài dễ tràn */}
    <div className="text-[10px] uppercase tracking-wider text-slate-500 md:text-[11px]">{label}</div>
    <div className="mt-1.5 truncate font-mono text-2xl font-semibold text-slate-50 md:text-[26px]">
      {value}{unit && <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>}
    </div>
  </div>
);

/* Hộp thoại xác nhận — dùng cho mọi thao tác xoá không hoàn tác được.
   Không dùng window.confirm vì trình duyệt có thể chặn trong iframe và giao diện không đồng bộ theme. */
export function ConfirmDialog({ open, title, desc, confirmLabel = "Xoá", cancelLabel = "Giữ lại", tone = "danger", onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-50">{title}</h4>
            {desc && <p className="mt-1 text-sm text-slate-400">{desc}</p>}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className={btnGhost}>{cancelLabel}</button>
          {tone === "danger"
            ? <button onClick={onConfirm} className={btnDanger}><Trash2 size={14} /> {confirmLabel}</button>
            : <button onClick={onConfirm} className={btnPrimary}><CheckCircle2 size={14} /> {confirmLabel}</button>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DATE PICKER (dark, tự vẽ — không dùng picker mặc định của trình duyệt)
   ============================================================ */
/* v13.10 — ngày lễ dùng chung cho mọi lịch tự vẽ (ô chọn khoảng ngày, ô chọn ngày, lịch Chấm công):
   App đồng bộ từ cfg.holidays mỗi lần render (như syncRoles), CalendarPanel tự khoanh đỏ ngày lễ. */
let HOL_IDX = makeHolidayIndex([]);
export const syncHolidays = (list) => { HOL_IDX = makeHolidayIndex(Array.isArray(list) ? list : []); };

/* v13.12 — nút phễu lọc: gom các ô lọc (bộ phận, vai trò…) vào một bảng nhỏ. count = số bộ lọc đang bật. */
export function FilterButton({ count = 0, onClear, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Lọc theo bộ phận, vai trò"
        className={`${CTRL} relative flex w-11 items-center justify-center rounded-md border ${open || count ? "border-teal-600 text-teal-300" : "border-slate-700 text-slate-400 hover:text-slate-100"}`}>
        <Filter size={15} />
      </button>
      {/* v13.15: đang lọc thì hiện (x) ở góc — bấm là tắt hết bộ lọc */}
      {count > 0 && onClear && (
        <button onClick={() => { onClear(); setOpen(false); }} title="Tắt bộ lọc" aria-label="Tắt bộ lọc"
          className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-teal-600 text-[11px] leading-none text-white hover:bg-rose-600">×</button>
      )}
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 flex w-64 flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-2xl">
          {children}
          {count > 0 && onClear && <button onClick={onClear} className="self-start text-xs text-teal-400 hover:text-teal-300">Bỏ lọc</button>}
        </div>
      )}
    </div>
  );
}

export function CalendarPanel({ value, onSelect, dayStatus, view: viewProp, onViewChange, markSelected = true, markWeek = false, rangeStart = null, rangeEnd = null, hint = null }) {
  const base = value ? parseD(value) : new Date();
  const [internalView, setInternalView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const view = viewProp || internalView;               // cho phép cha (WeekPicker) điều khiển tháng đang xem
  const setView = onViewChange || setInternalView;      // để tải đúng dữ liệu giờ công của tháng đang hiển thị
  const gridStart = mondayOf(new Date(view.y, view.m, 1));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayStr = fmt(new Date());
  const step = (n) => setView((v) => {
    const d = new Date(v.y, v.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div className="w-72 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-100">Tháng {view.m + 1}, {view.y}</span>
        <div className="flex gap-1">
          <button onClick={() => step(-1)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><ChevronUp size={16} /></button>
          <button onClick={() => step(1)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><ChevronDown size={16} /></button>
        </div>
      </div>

      {hint && <div className="mb-2 rounded-md bg-slate-950 px-2 py-1.5 text-[11px] text-slate-400">{hint}</div>}

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW_MINI.map((d) => <div key={d} className="py-1 text-[11px] font-medium text-slate-500">{d}</div>)}
      </div>

      {/* mỗi tuần một hàng riêng — tuần đang chấm công (Thứ 2 = value) được khoanh khung bo góc, viền mờ */}
      <div className="space-y-1">
        {Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7)).map((week, w) => {
          const isActiveWeek = markWeek && fmt(week[0]) === value; // chỉ khoanh cả tuần khi đang chọn theo tuần
          return (
            <div key={w}
              className={`grid grid-cols-7 gap-1 rounded-lg p-0.5 ${isActiveWeek ? "border border-teal-700/50 bg-teal-500/5" : "border border-transparent"}`}>
              {week.map((d) => {
                const s = fmt(d);
                const inMonth = d.getMonth() === view.m;
                const selected = s === value;
                const isToday = s === todayStr;
                const status0 = dayStatus ? dayStatus(s) : null; // "under" | "over" | "effort" | "otHigh" | "holiday" | "leave" | null
                const status = status0 || (HOL_IDX.has(s) ? "holiday" : null);   // v13.10: lịch không có dayStatus vẫn khoanh ngày lễ
                const holName = HOL_IDX.get(s);
                const isSelected = markSelected && selected;
                const isEdge = (rangeStart && s === rangeStart) || (rangeEnd && s === rangeEnd);
                const inRange = rangeStart && rangeEnd && s > rangeStart && s < rangeEnd;
                // màu chữ nói lên loại ngày, viền nói lên "hôm nay" / "ngày đang chọn" — hai tầng thông tin tách bạch
                const tone =
                  status === "holiday" ? "text-slate-100"
                    : status === "leave" ? "bg-sky-950/40 text-sky-300"
                    : status === "under" ? "text-amber-400"
                    : status === "otHigh" ? "bg-red-950/50 font-semibold text-red-300"
                    : status === "over" ? "text-teal-400"
                    : status === "effort" ? "text-violet-400"
                    : inMonth ? "text-slate-200" : "text-slate-700";
                const ring =
                  isEdge ? "border-2 border-teal-400 bg-teal-500/15 font-semibold text-teal-100"
                    : inRange ? "border border-transparent bg-teal-500/10 text-teal-100"
                    : isSelected ? "border-2 border-teal-400 font-semibold"
                    // hôm nay: khối phát sáng mờ, cùng tông với khung tuần bên Chấm công
                    : isToday ? (status ? "border border-teal-500 font-semibold" : "border border-teal-700/60 bg-teal-500/10 font-semibold text-teal-200")
                    : "border border-transparent";
                return (
                  <button key={s} onClick={() => onSelect(s)}
                    style={status === "holiday" ? holidayRingBg(30) : undefined}
                    title={holName ? `${holName}${isToday ? " · Hôm nay" : ""}` : isToday ? "Hôm nay" : status === "under" ? "Chưa đủ giờ" : status === "otHigh" ? `OT trên ${OT_ALERT} giờ` : status === "over" ? "Có giờ tăng ca" : status === "effort" ? "Có giờ cố gắng (vượt giờ chuẩn)" : status === "holiday" ? "Ngày lễ" : status === "leave" ? "Nghỉ phép" : undefined}
                    className={`flex h-8 items-center justify-center rounded text-xs hover:bg-slate-800 ${tone} ${ring}`}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* v13.15 → v13.16: bỏ dòng Hôm nay ở cuối lịch */}
    </div>
  );
}

/* Bộ chọn KHOẢNG ngày — một lịch duy nhất: bấm lần đầu đặt ngày bắt đầu, lần thứ hai đặt ngày kết thúc.
   Bấm ngược thứ tự (ngày sau trước, ngày trước sau) vẫn ra khoảng đúng, không bắt người dùng nhớ thứ tự. */
export function DateRangeField({ label, from, to, onChange, align = "left", className = "" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // ngày đầu vừa bấm, đang chờ ngày thứ hai
  const ref = useRef(null);
  const [view, setView] = useState(() => { const d = parseD(from); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPending(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const pick = (s) => {
    if (!pending) { setPending(s); return; }
    const a = s < pending ? s : pending;
    const b = s < pending ? pending : s;
    onChange(a, b);
    setPending(null); setOpen(false);
  };


  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-500">{label}</label>}
      <button onClick={() => {
          setPending(null);
          setOpen((o) => { if (!o) { const d = parseD(from); setView({ y: d.getFullYear(), m: d.getMonth() }); } return !o; });
        }}
        className={`${CTRL} flex w-full items-center justify-between gap-2 rounded-md border bg-slate-900 px-3 text-sm hover:border-slate-500 ${open ? "border-teal-500" : "border-slate-700"}`}>
        {/* v13.15: ô hiển thị nhanh chỉ ghi ngày/tháng */}
        <span className="w-full truncate text-center font-mono text-slate-100">{dLabel(from)} – {dLabel(to)}</span>
      </button>

      {open && (
        <div className={`absolute top-full z-50 mt-1 ${align === "right" ? "right-0" : "left-0"}`}>
          <CalendarPanel
            value={pending || from}
            onSelect={pick}
            view={view}
            onViewChange={setView}
            markSelected={false}
            rangeStart={pending || from}
            rangeEnd={pending ? null : to}
            hint={pending
              ? <>Bắt đầu <span className="font-mono text-teal-300">{dFull(pending)}</span> — giờ bấm ngày kết thúc</>
              : "Bấm ngày bắt đầu, rồi bấm ngày kết thúc"}
          />
        </div>
      )}
    </div>
  );
}

/* v13.15 — ô lịch cho màn chỉ xem theo Tuần / Tháng (Bảng công): hiển thị ngày/tháng như DateRangeField,
   bấm mở lịch, chọn một ngày là nhảy tới tuần / tháng chứa ngày đó. */
export function PeriodField({ from, to, mode = "week", onPick, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button onClick={() => setOpen((o) => !o)}
        className={`${CTRL} flex w-full items-center justify-center rounded-md border bg-slate-900 px-3 text-sm hover:border-slate-500 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="truncate font-mono text-slate-100">{dLabel(from)} – {dLabel(to)}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1">
          <CalendarPanel value={from} onSelect={(s) => { onPick(s); setOpen(false); }}
            markSelected={false} markWeek={mode === "week"} rangeStart={mode === "month" ? from : null} rangeEnd={mode === "month" ? to : null} />
        </div>
      )}
    </div>
  );
}

export function DateField({ label, value, onChange, align = "left", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-500">{label}</label>}
      <button onClick={() => setOpen((o) => !o)}
        className={`${CTRL} flex w-full items-center justify-between gap-2 rounded-md border bg-slate-900 px-3 text-sm hover:border-slate-500 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="w-full text-center font-mono text-slate-100">{dFull(value)}</span>
      </button>
      {open && (
        <div className={`absolute top-full z-50 mt-1 ${align === "right" ? "right-0" : "left-0"}`}>
          <CalendarPanel value={value} onSelect={(s) => { onChange(s); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/* Bộ chọn TUẦN dùng cho nhân sự — cùng một CalendarPanel dark như DateField bên Quản lý,
   nhưng chọn 1 ngày bất kỳ sẽ nhảy tới tuần (thứ 2) chứa ngày đó.
   Ngoài ra tô viền cảnh báo ngay trên ô ngày: cam = thiếu giờ (<8h, ngày đã qua), xanh lá = thừa giờ (>8h). */
export function WeekPicker({ monday, onChange, empId, hoursCfg = DEFAULT_HOURS, holidaySet = null, refreshKey = 0 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const baseMonth = parseD(monday);
  const [calView, setCalView] = useState({ y: baseMonth.getFullYear(), m: baseMonth.getMonth() });
  const [monthData, setMonthData] = useState({}); // ym -> { dateStr: tổng giờ }
  const [monthLeave, setMonthLeave] = useState({}); // ym -> { dateStr: loại nghỉ }
  const [monthParts, setMonthParts] = useState({}); // v3.4: ym -> { dateStr: { ot, reg } } — giờ Tăng ca và giờ làm việc thường
  const todayStr = fmt(new Date());

  // Sau mỗi lần lưu bảng công, bỏ bộ nhớ đệm để lịch hiển thị số giờ mới nhất
  useEffect(() => { setMonthData({}); setMonthLeave({}); }, [refreshKey, empId]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Chỉ tải tháng nào chưa có trong bộ nhớ đệm — mở lại lịch hay lật qua lật lại không gọi storage nữa,
  // giữ cho quota request dành cho việc lưu bảng công.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const yms = [-1, 0, 1].map((off) => {
        const d = new Date(calView.y, calView.m + off, 1);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      }).filter((ym) => !(ym in monthData));
      if (yms.length === 0) return;
      await ensureMonths(yms);
      const entries = [];
      for (const ym of yms) entries.push([ym, dbTs(empId, ym)]);   // đọc từ bộ nhớ, không tốn lệnh
      if (!alive) return;
      setMonthData((prev) => {
        const next = { ...prev };
        for (const [ym, bucket] of entries) {
          const perDay = {};
          if (bucket?.rows) for (const r of bucket.rows) for (const [d, hh] of Object.entries(r.days || {})) {
            if (!hh) continue;
            perDay[d] = (perDay[d] || 0) + hh;
          }
          next[ym] = perDay; // ghi đè theo tháng, tránh cộng dồn trùng khi mở lại
        }
        return next;
      });
      setMonthParts((prev) => {
        const next = { ...prev };
        for (const [ym, bucket] of entries) {
          const parts = {};
          for (const r of bucket?.rows || []) for (const [d, hh] of Object.entries(r.days || {})) {
            if (!hh || leaveTypeOfTask(r.taskId)) continue;
            const c = parts[d] || (parts[d] = { ot: 0, reg: 0, idle: 0 });
            if (isOtId(r.taskId)) c.ot += hh; else { c.reg += hh; if (isIdleTask(r.taskId)) c.idle += hh; }
          }
          next[ym] = parts;
        }
        return next;
      });
      setMonthLeave((prev) => {
        const next = { ...prev };
        for (const [ym, bucket] of entries) {
          const lv = {};
          for (const r of bucket?.rows || []) {
            const lt = leaveTypeOfTask(r.taskId);
            if (!lt) continue;
            for (const [d, hh] of Object.entries(r.days || {})) if (hh > 0) lv[d] = lt;
          }
          next[ym] = lv;
        }
        return next;
      });
    })();
    return () => { alive = false; };
  }, [open, calView.y, calView.m, empId]);

  const dayStatus = (dateStr) => {
    const h = monthData[ymOf(dateStr)]?.[dateStr] || 0;
    if (holidaySet?.has(dateStr)) return "holiday";
    const lv = monthLeave[ymOf(dateStr)]?.[dateStr];
    if (lv && h === 0) return "leave";
    const pt = monthParts[ymOf(dateStr)]?.[dateStr];
    const ot = pt?.ot || 0;
    const ef = effortHoursFor(dateStr, (pt?.reg || 0) - (pt?.idle || 0), hoursCfg, holidaySet);   // v7.2: trống việc không thành giờ cố gắng
    if (ot > OT_ALERT) return "otHigh";   // OT quá dày trong một ngày — cảnh báo đỏ
    // v4.0: thiếu giờ tính theo giờ chuẩn (tổng − OT − cố gắng), ưu tiên hơn dấu tăng ca
    const min = minHoursFor(dateStr, hoursCfg, holidaySet);
    if (min !== null && dateStr <= todayStr && h - ot - ef < min) return "under";
    if (ot > 0) return "over";
    if (ef > 0) return "effort";   // v3.4: giờ cố gắng, không phải OT
    return null;
  };

  const days = weekDays(monday);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className={`${CTRL} flex w-40 items-center justify-center rounded-md border bg-slate-900 px-2 text-sm hover:border-slate-500 md:px-3 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="whitespace-nowrap font-mono text-slate-50">{dLabel(days[0])} – {dLabel(days[6])}</span>
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2">
          <CalendarPanel value={monday} onSelect={(s) => { onChange(fmt(mondayOf(parseD(s)))); setOpen(false); }}
            dayStatus={dayStatus} view={calView} onViewChange={setCalView} markSelected={false} markWeek />
        </div>
      )}
    </div>
  );
}

export function NoteDialog({ open, title, value, readOnly, onSave, onClose }) {
  const [text, setText] = useState(value || "");
  useEffect(() => { if (open) setText(value || ""); }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-sm font-semibold text-slate-50">Mô tả thêm</h4>
        <p className="mt-0.5 truncate text-xs text-slate-500">{title}</p>
        <textarea autoFocus rows={5} value={text} readOnly={readOnly}
          onChange={(e) => setText(e.target.value)}
          placeholder="Làm gì cụ thể, vướng mắc, đầu việc phát sinh…"
          className="mt-3 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-teal-500 focus:outline-none" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className={btnGhost}>Đóng</button>
          <button onClick={() => onSave(text)} disabled={readOnly} className={`${btnPrimary} disabled:opacity-40`}><Check size={14} /> Lưu mô tả</button>
        </div>
      </div>
    </div>
  );
}

