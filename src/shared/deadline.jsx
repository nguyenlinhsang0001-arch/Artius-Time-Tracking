/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect } from "react";
import {
  AlertTriangle, X,
} from "lucide-react";
import { dLabel, mondaysDue, pad, prevYm } from "../core/date.jsx";
import { isOn, sget, sset, useDataTick, weekDone } from "../core/db.jsx";
import { pastCut, pastOpenUntil } from "../core/domain.jsx";

/* --------- cảnh báo hạn chốt công (ẩn tạm trong phiên, hoặc tắt vĩnh viễn theo thiết bị) --------- */
export function DeadlineBanner({ cfg, empId, onGo = null }) {
  const dataTick = useDataTick();
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(false);    // ẩn tạm — chỉ trong phiên làm việc này
  const [hiddenForever, setHiddenForever] = useState(null); // null = chưa đọc xong storage
  const today = new Date();
  const dl = cfg.deadlineDay || 5;
  const prefKey = `artius:hide-deadline:${empId}`;

  useEffect(() => {
    (async () => {
      setHiddenForever(isOn(await sget(prefKey, false)));
    })();
  }, [prefKey]);

  useEffect(() => {
    (async () => {
      const ym = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
      const target = today.getDate() <= dl ? prevYm(ym) : ym;
      const need = mondaysDue(target);
      // v8.6: tuần đã quá hạn chấm công (không tự sửa được nữa) thì không nhắc ở đây
      const cut = pastCut(cfg);
      setState({ target, missing: need.filter((m) => !weekDone(empId, m) && (!cut || m >= cut || pastOpenUntil(cfg, empId, m))), thisYm: ym });
    })();
  }, [empId, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const hideForever = async () => {
    await sset(prefKey, 1, false);
    setHiddenForever(true);
  };

  if (!state || state.missing.length === 0 || dismissed || hiddenForever) return null;
  const late = today.getDate() > dl && state.target === prevYm(state.thisYm);
  const oldest = [...state.missing].sort()[0];
  return (
    <>
    {/* v8.4 — điện thoại: banner 1 dòng gọn, bấm "Xem" nhảy tới tuần chưa gửi cũ nhất */}
    <div className={`wk-banner flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] md:hidden ${late ? "border-rose-900 bg-rose-950" : "border-amber-900 bg-amber-950"}`}>
      <AlertTriangle size={15} className={`shrink-0 ${late ? "text-rose-400" : "text-amber-400"}`} />
      <span className="min-w-0 flex-1 truncate text-slate-100"><b>{state.missing.length} tuần</b> chưa gửi · cũ nhất {dLabel(oldest)}</span>
      {onGo && <button onClick={() => onGo(oldest)} className={`shrink-0 whitespace-nowrap font-semibold ${late ? "text-rose-300" : "text-amber-300"}`}>Xem ›</button>}
      <button onClick={() => setDismissed(true)} title="Ẩn tạm" aria-label="Ẩn tạm" className="-mr-1 shrink-0 rounded p-1 text-slate-400"><X size={13} /></button>
    </div>
    <div className={`wk-banner hidden items-start gap-2.5 rounded-xl border p-3 md:flex md:gap-3 md:p-3.5 ${late ? "border-rose-900 bg-rose-950" : "border-amber-900 bg-amber-950"}`}>
      <AlertTriangle size={18} className={`mt-0.5 shrink-0 ${late ? "text-rose-400" : "text-amber-400"}`} />
      <div className="min-w-0 flex-1 text-sm text-slate-100">
        Còn <b>{state.missing.length}</b> tuần chưa gửi: {state.missing.map(dLabel).join(", ")}.
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={hideForever} className="text-xs text-slate-300 underline decoration-slate-500 underline-offset-2 hover:text-slate-50">Tắt vĩnh viễn</button>
        <button onClick={() => setDismissed(true)} title="Ẩn tạm" className="rounded p-0.5 text-slate-300 hover:bg-black/20 hover:text-slate-50"><X size={14} /></button>
      </div>
    </div>
    </>
  );
}

