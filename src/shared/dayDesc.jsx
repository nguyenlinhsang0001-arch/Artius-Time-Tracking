/* ============================================================
   v13.77 — MÔ TẢ THEO NGÀY cho tác vụ "Event công ty".

   Thiết lập: cfg.tasks[].descOptions = ["Teambuilding", "Khám sức khỏe định kỳ", …] (tab Tác vụ, chỉ hiện cho Event công ty).
   Có trường này (kể cả mảng rỗng) = tác vụ BẮT BUỘC chọn mô tả cho mỗi ngày có giờ; dòng "Khác (tự ghi)" luôn có sẵn.
   Lưu: mỗi dòng bảng công có thêm row.dn = { "YYYY-MM-DD": "mô tả" } — chỉ giữ ngày có giờ (Timesheet.save dọn).
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";

export const EVENT_TASK_RE = /^\s*event\s+công\s+ty\s*$/i;
export const isEventTask = (t) => !!t && EVENT_TASK_RE.test(t.name || "");
/* danh sách mô tả của tác vụ, hoặc null nếu tác vụ không cần mô tả */
export const descOptsOf = (t) => (t && Array.isArray(t.descOptions) ? t.descOptions.filter((x) => typeof x === "string" && x.trim()) : null);
export const needsDesc = (t) => descOptsOf(t) !== null;

/* Ô mô tả dưới ô giờ: nhãn mô tả (bấm để đổi) · nút "Chọn mô tả" khi có giờ mà chưa chọn · bảng chọn nổi.
   autoOpen: giờ vừa từ 0 thành > 0 mà chưa có mô tả thì tự mở bảng chọn (không cướp con trỏ khỏi ô giờ). */
export function DayDesc({ options, value, hours, disabled, warn, onChange, align = "right", compact = false }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(null);
  const [other, setOther] = useState("");
  const prevH = useRef(hours);
  const boxRef = useRef(null);
  const has = Number(hours) > 0;

  const begin = () => {
    const cur = value || "";
    const preset = options.includes(cur);
    setPick(cur ? (preset ? cur : "__other") : null);
    setOther(preset ? "" : cur);
    setOpen(true);
  };
  useEffect(() => {
    const was = Number(prevH.current) > 0;
    prevH.current = hours;
    if (!disabled && !was && has && !value) begin();
    if (!has) setOpen(false);
  }, [hours]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!has && !open) return null;
  const done = () => {
    const v = pick === "__other" ? other.trim() : pick;
    if (v) onChange(v);
    setOpen(false);
  };
  const radio = (on) => (
    <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${on ? "border-teal-400 bg-teal-400" : "border-slate-500"}`} />
  );
  return (
    <div ref={boxRef} className="relative">
      {value ? (
        <button type="button" disabled={disabled} onClick={begin} title={value}
          className={`mt-1 block w-full truncate rounded bg-teal-950 px-1.5 py-0.5 text-[11px] font-medium text-teal-300 ${compact ? "text-left" : "text-center"} disabled:cursor-default disabled:opacity-70`}>
          {value}
        </button>
      ) : (
        <button type="button" disabled={disabled} onClick={begin}
          className={`mt-1 block w-full rounded border border-dashed px-1.5 py-0.5 text-[11px] font-medium ${warn ? "border-amber-500 bg-amber-950/40 text-amber-300" : "border-amber-700 text-amber-400"} disabled:opacity-50`}>
          Chọn mô tả
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Chọn mô tả"
          className={`absolute top-full z-40 mt-1 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl ${align === "left" ? "left-0" : "right-0"}`}>
          <div className="mb-2 text-sm font-semibold text-slate-100">Chọn nội dung sự kiện</div>
          <div className="flex flex-col gap-1">
            {options.map((o) => (
              <button key={o} type="button" onClick={() => setPick(o)}
                className={`flex min-h-[40px] items-center gap-2.5 rounded-lg border px-3 text-left text-sm text-slate-200 ${pick === o ? "border-teal-500 bg-teal-950" : "border-slate-800 bg-slate-950 hover:border-slate-600"}`}>
                {radio(pick === o)}{o}
              </button>
            ))}
            <div className={`rounded-lg border px-3 py-2 ${pick === "__other" ? "border-teal-500 bg-teal-950" : "border-slate-800 bg-slate-950"}`}>
              <button type="button" onClick={() => setPick("__other")} className="flex items-center gap-2.5 text-sm text-slate-200">
                {radio(pick === "__other")}Khác (tự ghi)
              </button>
              <input value={other} maxLength={120} placeholder="Gõ mô tả…" aria-label="Mô tả tự ghi"
                onFocus={() => setPick("__other")} onChange={(e) => { setOther(e.target.value); setPick("__other"); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } }}
                className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100 focus:border-teal-500 focus:outline-none" />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-300">Để sau</button>
            <button type="button" onClick={done} disabled={pick === null || (pick === "__other" && !other.trim())}
              className="h-10 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white disabled:opacity-40">Xong</button>
          </div>
        </div>
      )}
    </div>
  );
}
