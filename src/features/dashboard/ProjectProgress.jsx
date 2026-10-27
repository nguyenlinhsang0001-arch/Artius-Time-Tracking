/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import {
  ChevronRight, ChevronDown, RotateCcw, Search, Flag,
} from "lucide-react";
import { supabase } from "../../storage.js";
import { DB, sentRows, usePhaseDetail, useUsage } from "../../core/db.jsx";
import { DEFAULT_PHASE, LEAVE_TASKS, NO_PROJECT, OT_TASKS, PHASES, fmtH, isLeaveTask, norm, phaseColor, projBudgets, projPhaseIsOpen, tone, useIsMobile } from "../../core/domain.jsx";
import { isLight } from "../../core/theme.jsx";
import { CTRL, inputCls } from "../../core/ui.jsx";
import { moveInList, sortByProjOrder, useProjOrder, useRowDrag } from "../../shared/rowDrag.jsx";
import { FC_CLS, OT_MAX, REWORK_RE, buildPhaseInfo, ddmm, otLevel, pct100, pgColor, pgLevel, phaseDetailFromMemory, phaseForecast } from "./calc.jsx";

export const ProgressLegend = () => (
  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
    <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-teal-400">&lt; 80%</span>
    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">80–100% sắp vượt</span>
    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-400">&gt; 100% vượt</span>
  </div>
);

export const DT_MAX_WEEKS = 16;   // biểu đồ theo tuần: tối đa 16 tuần gần nhất của giai đoạn
/* Danh sách tên — giờ — % kèm thanh nhỏ (nhân sự / tác vụ) */
export const KvList = ({ items, total, n, withRole, onTip }) => {
  const top = items[0]?.h || 1;
  return (
    <div>
      {items.slice(0, n).map((x, i) => (
        <div key={i} className={`grid grid-cols-[minmax(0,1fr)_52px_36px] items-center gap-x-1.5 py-[3px] ${onTip ? "-mx-1.5 cursor-default rounded-md px-1.5 hover:bg-slate-800/70" : ""}`}
          onMouseMove={onTip ? (e) => onTip({ x, cx: e.clientX, cy: e.clientY }) : undefined} onMouseLeave={onTip ? () => onTip(null) : undefined}>
          <span className="truncate text-slate-200">{x.name}{withRole && x.role && <span className="ml-1.5 text-[11px] text-slate-600">{x.role}</span>}</span>
          <span className="text-right font-mono text-slate-100">{fmtH(x.h)}</span>
          <span className="text-right font-mono text-[11px] text-slate-500">{Math.round((x.h / total) * 100)}%</span>
          <div className="col-span-3 h-[3px] overflow-hidden rounded bg-slate-800"><div className="h-full bg-teal-500" style={{ width: `${(x.h / top) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
};

/* Biểu đồ cột giờ theo tuần; màu cột = giờ LŨY KẾ tới tuần đó so với giờ dự kiến (xanh < 80%, cam 80–100%, đỏ > 100%) */
export const WeeklyChart = ({ cell, info }) => {
  const wks = info.weeks.slice(-DT_MAX_WEEKS);
  const W = 520, H = 150, padX = 28, n = Math.max(1, wks.length);
  const max = Math.max(1, ...wks.map((w) => w.h), info.rate || 0) * 1.15;
  const bw = (W - padX * 2) / n;
  let cum = cell.h - wks.reduce((a, w) => a + w.h, 0);
  const bars = wks.map((w, i) => {
    cum += w.h;
    const col = !cell.b ? "#14b8a6" : cum > cell.b ? "#f43f5e" : cum >= cell.b * 0.8 ? "#f59e0b" : "#14b8a6";
    const h = (w.h / max) * H, x = padX + i * bw + 3, y = H - h + 4, cx = x + (bw - 6) / 2;
    return (
      <g key={i}>
        <rect x={x} y={y} width={Math.max(2, bw - 6)} height={h} rx="3" fill={col} opacity={cell.open ? 1 : 0.6}>
          <title>{`Tuần ${ddmm(w.mon)}: ${fmtH(w.h)} h · lũy kế ${fmtH(cum)}${cell.b ? ` / ${fmtH(cell.b)}` : ""} h`}</title>
        </rect>
        {w.h > 0 && <text x={cx} y={y - 4} fill={isLight() ? "#475569" : "#94a3b8"} fontSize="10" textAnchor="middle" fontFamily="Consolas,monospace">{fmtH(w.h)}</text>}
        {(n <= 16 || i % 2 === 0) && <text x={cx} y={H + 18} fill={isLight() ? "#64748b" : "#64748b"} fontSize="10" textAnchor="middle">{ddmm(w.mon)}</text>}
      </g>
    );
  });
  const ry = info.rate ? H - (info.rate / max) * H + 4 : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ maxWidth: W }}>
        {bars}
        {ry != null && <line x1={padX} x2={W - padX} y1={ry} y2={ry} stroke="#fbbf24" strokeDasharray="4 4" strokeWidth="1.5" />}
      </svg>
      {info.rate != null && (
        <div className="mt-1.5 text-[11.5px] text-slate-500">
          <span className="mr-1.5 inline-block w-3.5 border-t-2 border-dashed border-amber-400 align-middle" />
          Trung bình 4 tuần gần nhất: <span className="text-amber-400">{fmtH(info.rate)} h/tuần</span>
        </div>
      )}
      {info.weeks.length > DT_MAX_WEEKS && <div className="mt-0.5 text-[11px] text-slate-600">Hiện {DT_MAX_WEEKS} tuần gần nhất trên tổng {info.weeks.length} tuần.</div>}
    </div>
  );
};

/* Khung chi tiết khi bấm vào ô giai đoạn (mở ngay dưới dòng dự án) */
export const PhaseDetail = ({ cell, info, onClose, partial }) => {
  const [tip, setTip] = useState(null);   // v5.6: { x: người, cx, cy } — thẻ tác vụ khi rê chuột vào tên nhân sự
  const [otOpen, setOtOpen] = useState(false);   // v5.6: bảng tăng ca theo tác vụ — mặc định thu gọn, bấm nút trong khung TĂNG CA để mở
  const hasOtTable = info.otByTask?.length > 0;
  const otPct = info.total ? Math.round((info.ot / info.total) * 100) : 0;
  const lv = otLevel(otPct);
  const fc = cell.open ? phaseForecast(cell, info) : null;
  const pct = cell.b ? Math.round((cell.h / cell.b) * 100) : null;
  const OT_BOX = { ok: "border-teal-900 bg-teal-400/[.06]", mid: "border-amber-800 bg-amber-500/[.08]", hi: "border-rose-800 bg-rose-500/[.08]" }[lv];
  const OT_TXT = { ok: "text-teal-400", mid: "text-amber-400", hi: "text-rose-400" }[lv];
  return (
    <div className="relative grid grid-cols-1 gap-[18px] p-4 text-[13px] lg:grid-cols-[1.25fr_1fr_1fr] lg:pr-[120px]">
      <button onClick={onClose} className="absolute right-4 top-3 h-[30px] rounded-md border border-slate-700 px-2.5 text-xs text-slate-400 hover:text-slate-100">Đóng ✕</button>
      <div>
        <h4 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Giờ theo tuần (màu = lũy kế so với dự kiến)</h4>
        <WeeklyChart cell={cell} info={info} />
        {fc ? <div className={`mt-1.5 rounded-lg px-2.5 py-2 text-[12.5px] ${FC_CLS[fc.cls]}`}>{fc.short}</div>
          : <div className={`mt-1.5 rounded-lg px-2.5 py-2 text-[12.5px] ${FC_CLS[cell.b && cell.h > cell.b ? "over" : "ok"]}`}>
              {pct != null ? <>Đóng ở {pct}%{cell.h > cell.b ? ` — vượt ${fmtH(cell.h - cell.b)} h` : ""}. </> : null}
              Chạy {info.nWeeks} tuần ({ddmm(info.first)} → {ddmm(info.last)}). Dùng số này khi báo giá giai đoạn {cell.ph.name.toLowerCase()} cho dự án tương tự.
            </div>}
        {partial && <div className="mt-1.5 text-[11px] text-amber-500/80">Đang tính trên dữ liệu đã tải (vài tháng gần nhất). Chạy lại supabase/schema.sql (mục 14) để xem đủ.</div>}
      </div>
      <div>
        <h4 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Nhân sự ({info.people.length})</h4>
        <KvList items={info.people} total={info.total} n={10} withRole onTip={setTip} />
        {info.people.length > 10 && <div className="mt-1 text-[11px] text-slate-600">+ {info.people.length - 10} người khác</div>}
      </div>
      <div>
        <h4 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Tác vụ ({info.tasks.length})</h4>
        {info.tasks.length ? <KvList items={info.tasks} total={info.total} n={10} /> : <div className="text-slate-500">Chỉ có giờ tăng ca.</div>}
        {info.tasks.length > 10 && <div className="mt-1 text-[11px] text-slate-600">+ {info.tasks.length - 10} tác vụ khác</div>}
        {info.tasks[0] && REWORK_RE.test(info.tasks[0].name) && (
          <div className="mt-1.5 text-[11.5px] text-amber-400">⚠ Tác vụ lớn nhất là "{info.tasks[0].name}" — có thể là vòng sửa lại / khách đổi ý. Nên rà lại phạm vi.</div>
        )}
      </div>
      <div className={`flex flex-wrap items-center gap-[18px] rounded-[10px] border px-4 py-3 lg:col-span-3 lg:-mr-[102px] ${OT_BOX}`}>
        {hasOtTable ? (
          <button type="button" onClick={() => setOtOpen((o) => !o)} aria-expanded={otOpen} title={otOpen ? "Thu gọn tăng ca theo tác vụ" : "Xem tăng ca theo tác vụ"}
            className="-my-2 -ml-2 flex min-h-[44px] items-center gap-1.5 rounded-md px-2 hover:bg-slate-50/[.06]">
            {otOpen ? <ChevronDown size={16} className="text-slate-300" /> : <ChevronRight size={16} className="text-slate-300" />}
            <span className="text-[13.6px] font-bold tracking-wide text-slate-100">TĂNG CA</span>
          </button>
        ) : <span className="text-[13.6px] font-bold tracking-wide text-slate-100">TĂNG CA</span>}
        <span className="text-slate-100">{fmtH(info.ot)} h · {otPct}% tổng giờ giai đoạn</span>
        <span className="relative mx-1 mb-3.5 flex h-2 w-[300px] gap-0.5">
          <span className={`h-full rounded-l bg-teal-500 ${lv === "ok" ? "" : "opacity-[.35]"}`} style={{ width: `${(15 / OT_MAX) * 100}%` }} />
          <span className={`h-full bg-amber-500 ${lv === "mid" ? "" : "opacity-[.35]"}`} style={{ width: `${(10 / OT_MAX) * 100}%` }} />
          <span className={`h-full flex-1 rounded-r bg-rose-500 ${lv === "hi" ? "" : "opacity-[.35]"}`} />
          <span className="absolute -top-[5px] -ml-[1.5px] h-[18px] w-[3px] rounded-sm bg-slate-50 shadow-[0_0_0_2px_#0b1220]" style={{ left: `${Math.min(100, (otPct / OT_MAX) * 100)}%` }} />
          {[[7.5, "Bình thường 0–15%"], [20, "TB 15–25%"], [32.5, "Cao >25%"]].map(([at, t]) => (
            <span key={t} className="absolute top-3 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500" style={{ left: `${(at / OT_MAX) * 100}%` }}>{t}</span>
          ))}
        </span>
        <span className={`font-semibold ${OT_TXT}`}>{lv === "ok" ? "Trong mức bình thường" : lv === "mid" ? "Mức trung bình — cần theo dõi" : "Cao — dấu hiệu áp lực tiến độ"}</span>
      </div>
      {hasOtTable && otOpen && <OtByTaskTable info={info} />}
      {info.otNoDetail && <div className="text-[11.5px] text-amber-500/80 lg:col-span-3">Chưa xem được tăng ca theo tác vụ — chạy lại supabase/schema.sql (bản v4.9) trên Supabase.</div>}
      {tip && tip.x.tasks?.length > 0 && (() => {
        /* v5.6 — thẻ tác vụ của một người trong giai đoạn: Tác vụ · Giờ · % (trên tổng giờ của người đó trong giai đoạn) */
        const ts = tip.x.tasks, pc = pct100(ts.map((t) => t.h));
        const W = 340, left = tip.cx + 14 + W > window.innerWidth - 8 ? tip.cx - W - 14 : tip.cx + 14;
        const top = Math.max(8, Math.min(window.innerHeight - 64 - (ts.length + 2) * 24, tip.cy + 14));
        return (
          <div className="pointer-events-none fixed z-[70] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[12.5px] shadow-2xl" style={{ left, top, width: W }}>
            <div className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 pb-1 text-[10.5px] uppercase tracking-wider text-slate-600"><span>Tác vụ</span><span className="text-right">Giờ</span><span className="text-right">%</span></div>
            {ts.map((t, i) => (
              <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_52px_40px] gap-2 py-0.5">
                <span className={`truncate ${t.ot ? "text-teal-400" : "text-slate-100"}`}>{t.name}</span>
                <span className="text-right font-mono text-slate-200">{fmtH(t.h)}</span>
                <span className="text-right font-mono text-slate-400">{pc[i]}%</span>
              </div>
            ))}
            <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 border-t border-slate-800 pt-1.5">
              <span className="text-slate-500">Chiếm trong giai đoạn</span>
              <span className="text-right font-mono text-slate-100">{Math.round((tip.x.h / info.total) * 100)}% <span className="text-slate-600">/ {fmtH(info.total)} h</span></span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

/* v4.9 — Bảng tăng ca theo tác vụ × khung giờ trong khung chi tiết giai đoạn (chỉ giờ đã gửi) */
export const OtByTaskTable = ({ info }) => {
  const bands = info.otBandsUsed || [];
  const col = (bid) => info.otByTask.reduce((a, x) => a + (x.b[bid] || 0), 0);
  const sp = info.otByTask.reduce((a, x) => a + x.special, 0);
  return (
    <div className="overflow-x-auto lg:col-span-3 lg:-mr-[102px]">
      <table className="-mt-2 w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-800 text-[11.5px] text-slate-500">
            <th className="py-1.5 pr-3 text-left font-medium">Tác vụ</th>
            {bands.map((b) => <th key={b.id} className="px-2 py-1.5 text-right font-medium text-teal-400">{b.label}</th>)}
            {sp > 0 && <th className="px-2 py-1.5 text-right font-medium" title="Phần giờ rơi vào Chủ nhật hoặc ngày lễ (đã gồm trong các cột khung giờ)">Trong đó CN / lễ</th>}
            <th className="py-1.5 pl-2 text-right font-medium">Tổng tăng ca</th>
          </tr>
        </thead>
        <tbody>
          {info.otByTask.map((x) => (
            <tr key={x.forId || "_"} className={`border-b border-slate-800/70 ${x.forId ? "" : "text-slate-500"}`}>
              <td className={`py-1.5 pr-3 ${x.forId ? "text-slate-200" : ""}`}>{x.name}</td>
              {bands.map((b) => <td key={b.id} className="px-2 py-1.5 text-right font-mono">{x.b[b.id] ? fmtH(x.b[b.id]) : ""}</td>)}
              {sp > 0 && <td className="px-2 py-1.5 text-right font-mono">{x.special ? fmtH(x.special) : ""}</td>}
              <td className="py-1.5 pl-2 text-right font-mono text-teal-300">{fmtH(x.h)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-slate-400">
            <td className="py-1.5 pr-3">Tổng</td>
            {bands.map((b) => <td key={b.id} className="px-2 py-1.5 text-right font-mono">{fmtH(col(b.id))}</td>)}
            {sp > 0 && <td className="px-2 py-1.5 text-right font-mono">{fmtH(sp)}</td>}
            <td className="py-1.5 pl-2 text-right font-mono text-teal-300">{fmtH(info.ot)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

/* Thẻ nổi khi rê chuột vào ô giai đoạn */
export const PhaseHoverCard = ({ cell, info, canOpen }) => {
  const left = cell.b - cell.h;
  const lc = !cell.b ? "text-slate-100" : left < 0 ? "text-rose-400" : left <= cell.b * 0.2 ? "text-amber-400" : "text-slate-100";
  const Lbl = ({ children }) => <div className="mb-1 text-[10.5px] uppercase tracking-wider text-slate-500">{children}</div>;
  let body;
  if (!info) body = <div className={`mt-2 rounded-lg px-2.5 py-2 ${FC_CLS.idle}`}>Chưa có giờ công nào được gửi vào giai đoạn này.</div>;
  else {
    const fc = cell.open ? phaseForecast(cell, info) : null;
    const pct = cell.b ? Math.round((cell.h / cell.b) * 100) : null;
    const otPct = Math.round((info.ot / info.total) * 100);
    const Chip = ({ l, v, cls = "" }) => (
      <div className={`min-w-0 flex-1 rounded-lg border bg-slate-900 px-2 py-1.5 ${cls || "border-slate-800"}`}>
        <div className="whitespace-nowrap text-[10.5px] text-slate-500">{l}</div><div className="whitespace-nowrap font-mono text-[12.5px]">{v}</div>
      </div>
    );
    body = (
      <>
        {fc ? <div className={`mt-2 rounded-lg px-2.5 py-2 ${FC_CLS[fc.cls]}`}>{fc.full}</div>
          : <div className={`mt-2 rounded-lg px-2.5 py-2 ${FC_CLS[cell.b && cell.h > cell.b ? "over" : pct != null && pct >= 80 ? "warn" : "ok"]}`}>
              {pct != null && <>Đóng ở <b>{pct}%</b> {cell.h > cell.b ? <>— vượt <b>{fmtH(cell.h - cell.b)} h</b></> : <>— còn dư {fmtH(cell.b - cell.h)} h</>}. </>}
              Chạy {info.nWeeks} tuần ({ddmm(info.first)} → {ddmm(info.last)}).
            </div>}
        <div className="mt-2.5 border-t border-slate-800 pt-2"><Lbl>Ai tiêu giờ nhiều nhất</Lbl><KvList items={info.people} total={info.total} n={3} withRole /></div>
        {info.tasks.length > 0 && <div className="mt-2.5 border-t border-slate-800 pt-2"><Lbl>Giờ đổ vào tác vụ nào</Lbl><KvList items={info.tasks} total={info.total} n={3} /></div>}
        <div className="mt-2.5 flex gap-2">
          <Chip l="Tăng ca" v={`${fmtH(info.ot)} h · ${otPct}%`} cls={otPct >= 25 ? "border-rose-800 text-rose-400" : otPct >= 15 ? "border-amber-800 text-amber-400" : "border-slate-800 text-slate-100"} />
          <Chip l={cell.open ? "Gửi giờ gần nhất" : "Giờ cuối cùng"} v={info.idleDays <= 0 ? "hôm nay" : `${info.idleDays} ngày trước`}
            cls={cell.open && info.idleDays >= 10 ? "border-rose-800 text-rose-400" : "border-slate-800 text-slate-100"} />
          <Chip l="Số người" v={info.people.length} cls="border-slate-800 text-slate-100" />
        </div>
        {canOpen && <div className="mt-2.5 text-right text-[11px] text-slate-500">Bấm vào ô để xem chi tiết theo tuần ▾</div>}
      </>
    );
  }
  return (
    <div className="text-[12.5px] text-slate-300">
      <div className="flex items-baseline gap-2 font-mono">
        <span className="font-sans text-[11px] uppercase tracking-wider text-slate-500">{cell.b ? "Giờ còn lại" : "Giờ đã dùng"}</span>
        <b className={`ml-auto text-xl ${lc}`}>{cell.b ? (left < 0 ? `−${fmtH(-left)}` : fmtH(left)) : fmtH(cell.h)} h</b>
      </div>
      {body}
    </div>
  );
};

/* Tiến độ dự án: giờ HIỆN TẠI = tổng giờ đã gửi từ trước tới nay (không theo kỳ đang lọc) so với giờ dự kiến từng giai đoạn.
   · Giai đoạn đang mở: thanh màu theo mức (xanh < 80%, cam 80–100%, đỏ > 100%) + nhãn "mở".
   · Giai đoạn đã đóng: chìm xuống (thanh xám, chữ xám, % nhạt) — không cảnh báo nữa.
   · Tình trạng chỉ xét giai đoạn đang mở. Dự án nguy cơ vượt xếp đầu; dự án chưa có giờ gom vào một dòng mở rộng.
   · Chỉ dự án đang chấm công (active). v5.6: có bộ lọc riêng (Vượt / Sắp vượt / Bình thường, tìm dự án) — không theo kỳ.
   · v4.7: rê chuột vào ô → thẻ tóm tắt; bấm vào ô → khung chi tiết dưới dòng dự án, các dự án khác mờ đi.
   · v4.8: ô giai đoạn đang mở tô nền màu của giai đoạn + vạch trái, số giờ đậm; ô đã đóng chìm xuống (97%, chữ xám).
           Cờ Urgent (project.urgent, lưu trong thiết lập chung): rê chuột vào tên dự án → bấm cờ để bật/tắt;
           dự án Urgent có vạch đỏ + nhãn URGENT và luôn xếp lên đầu (trong nhóm vẫn xếp theo mức nguy cơ vượt). */
export function ProjectProgress({ cfg, weekPeople, dataTick, saveCfg, flash }) {
  const [pf, setPf] = useState("all");   // v5.6: all | x (vượt) | w (sắp vượt) | ok
  const [pq, setPq] = useState("");      // v5.6: tìm dự án theo mã / tên
  const usage = useUsage();
  const detailRaw = usePhaseDetail();
  const [showIdle, setShowIdle] = useState(false);
  const [projOrder, setProjOrder] = useProjOrder();
  const [sel, setSel] = useState(null);       // "<projectId>|<phaseId>" đang mở chi tiết
  const [hover, setHover] = useState(null);   // "<projectId>|<phaseId>" đang rê chuột
  const cardRef = useRef(null);
  const used = useMemo(() => {
    const m = new Map();
    if (usage) {
      for (const u of usage) {
        if (u.projectId === NO_PROJECT || !u.sent) continue;
        const o = m.get(u.projectId) || {}; o[u.phaseId] = (o[u.phaseId] || 0) + u.sent; m.set(u.projectId, o);
      }
      return m;
    }
    // chưa hỏi được database: tạm cộng từ phần bảng công đang có trong bộ nhớ (giống tab Dự án)
    for (const bucket of Object.values(DB?.ts || {})) for (const r of sentRows(bucket)) {
      if (isLeaveTask(r.taskId) || r.projectId === NO_PROJECT) continue;
      const h = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
      if (!h) continue;
      const o = m.get(r.projectId) || {}; const ph = r.phaseId || DEFAULT_PHASE;
      o[ph] = (o[ph] || 0) + h; m.set(r.projectId, o);
    }
    return m;
  }, [usage, dataTick]);
  const detail = useMemo(() => (detailRaw ? new Map(Object.entries(detailRaw)) : phaseDetailFromMemory()), [detailRaw, dataTick]);
  const partial = detailRaw === null;
  const ctx = useMemo(() => ({
    empById: new Map((cfg.employees || []).map((e) => [e.id, e])),
    taskById: new Map([...(cfg.tasks || []), ...LEAVE_TASKS, ...OT_TASKS].map((t) => [t.id, t])),
    taskOrder: new Map((cfg.tasks || []).map((t, k) => [t.id, k])),
    cfg,   // v4.9: hệ số tăng ca
    // v5.6: database chưa chạy schema.sql bản v5.6 (không có "et") → tạm lấy tác vụ theo người từ bộ nhớ; tính một lần rồi giữ lại
    memEt: (() => { let m = null; return (key) => { if (!m) m = phaseDetailFromMemory(); return m.get(key)?.et; }; })(),
  }), [cfg, dataTick]);

  const phases = PHASES.filter((ph) => ph.active !== false);
  const allRows = cfg.projects
    .filter((p) => p.active)
    .map((p) => {
      const budgets = projBudgets(p);
      const u = used.get(p.id) || {};
      const cells = phases.map((ph) => {
        const b = Math.max(0, Number(budgets[ph.id]) || 0), h = u[ph.id] || 0;
        const open = projPhaseIsOpen(p, ph.id);
        const pct = b ? (h / b) * 100 : null;
        return { ph, b, h, open, pct, key: `${p.id}|${ph.id}` };
      });
      const bt = cells.reduce((a, c) => a + c.b, 0), ut = cells.reduce((a, c) => a + c.h, 0);
      let worst = null, worstPh = "";
      for (const c of cells) if (c.open && c.b) { const v = c.pct || 0; if (worst == null || v > worst) { worst = v; worstPh = c.ph.id; } }
      const nOver = cells.filter((c) => c.open && c.b && c.h > c.b).length;
      const noOpen = !cells.some((c) => c.open);
      const L = noOpen ? "none" : pgLevel(worst);
      const st = L === "over" ? "x" : L === "warn" ? "w" : L === "ok" ? "ok" : "none";
      return { p, cells, bt, ut, worst, worstPh, nOver, noOpen, st };
    });
  const pcnt = (k) => allRows.filter((r) => k === "all" || r.st === k).length;
  const kw = norm(pq.trim());
  const rows = allRows.filter((r) => (pf === "all" || r.st === pf) && (!kw || norm(`${r.p.code || ""} ${r.p.name} ${r.p.client || ""}`).includes(kw)));
  const byUrgent = (a, b) => (b.p.urgent ? 1 : 0) - (a.p.urgent ? 1 : 0);
  const ordIx = new Map(projOrder.map((id, i) => [id, i]));
  const active = rows.filter((r) => r.ut > 0).sort((a, b) => byUrgent(a, b)
    || (projOrder.length ? (ordIx.get(a.p.id) ?? 1e9) - (ordIx.get(b.p.id) ?? 1e9) : 0)   // v7.7: đã kéo thả thì theo thứ tự đó, chưa thì tự xếp theo mức vượt
    || (b.worst ?? -1) - (a.worst ?? -1) || b.ut - a.ut);
  // v4.8: dự án Urgent chưa có giờ vẫn hiện ở đầu bảng (không bị gom vào dòng "chưa có giờ")
  const idle = sortByProjOrder(rows.filter((r) => r.ut === 0 && !r.p.urgent), projOrder, (r) => r.p.id);
  const urgentIdle = sortByProjOrder(rows.filter((r) => r.ut === 0 && r.p.urgent), projOrder, (r) => r.p.id);
  const toggleUrgent = async (p) => {
    if (!saveCfg) return;
    const on = !p.urgent;
    const ok = await saveCfg({ ...cfg, projects: cfg.projects.map((x) => (x.id === p.id ? { ...x, urgent: on } : x)) });
    if (ok && flash) flash(on ? `Đã đánh dấu Urgent: ${p.code ? p.code + " · " : ""}${p.name}` : `Đã bỏ Urgent: ${p.code ? p.code + " · " : ""}${p.name}`);
  };
  // v7.7: kéo thả dự án — thứ tự đang thấy trên bảng (Urgent trước, rồi các dự án có giờ) được chốt làm thứ tự riêng của máy này
  const shownIds = [...active.filter((r) => r.p.urgent), ...urgentIdle, ...active.filter((r) => !r.p.urgent), ...idle].map((r) => r.p.id);
  const dragMove = (from, to, after) => {
    const moved = moveInList(shownIds, from, to, after);
    const rest = sortByProjOrder(cfg.projects.map((x) => x.id), projOrder, (x) => x).filter((id) => !moved.includes(id));
    setProjOrder([...moved, ...rest]);
  };
  const drag = useRowDrag(dragMove);
  const findCell = (key) => { for (const r of rows) for (const c of r.cells) if (c.key === key) return c; return null; };
  const selCell = sel ? findCell(sel) : null;
  const selProj = selCell ? sel.split("|")[0] : null;
  useEffect(() => { if (sel && !selCell) setSel(null); }, [sel, selCell]);
  if (allRows.length === 0) return <p className="p-4 text-sm text-slate-500">Chưa có dự án đang chấm công.</p>;

  // đặt thẻ rê chuột cạnh con trỏ, lật sang trái / lên trên khi sát mép màn hình (đổi trực tiếp vị trí, không vẽ lại bảng)
  const placeCard = (e) => {
    const el = cardRef.current; if (!el) return;
    const w = el.offsetWidth || 360, hh = el.offsetHeight || 200;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 16;
    if (y + hh > window.innerHeight - 8) y = Math.max(8, window.innerHeight - hh - 8);
    el.style.left = `${x}px`; el.style.top = `${y}px`;
  };
  const hoverCell = hover && hover !== sel ? findCell(hover) : null;

  const totColor = (r) => { if (!r.bt) return "text-slate-100"; const pc = (r.ut / r.bt) * 100; return pc > 100 ? "text-rose-400" : pc >= 80 ? "text-amber-400" : "text-slate-100"; };
  const statusBadge = (r) => {
    if (r.noOpen) return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11.5px] text-slate-500">Không có giai đoạn mở</span>;
    const L = pgLevel(r.worst);
    const cls = { ok: "bg-teal-500/10 text-teal-400", warn: "bg-amber-500/10 text-amber-400", over: "bg-rose-500/15 text-rose-400", none: "bg-slate-800 text-slate-500" }[L];
    const label = { ok: "Bình thường", warn: "Sắp vượt", over: "Vượt dự kiến", none: "Chưa có giờ" }[L];
    const which = L === "warn" || L === "over" ? ` · ${r.nOver > 1 ? `${r.nOver} giai đoạn` : r.worstPh}` : "";
    return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${cls}`}>{label}{which}</span>;
  };
  const cell = (r, c) => {
    if (!c.b && !c.h) return <td key={c.ph.id} className="px-2.5 py-2.5"><span className="text-xs text-slate-700">—</span></td>;
    const L = c.h ? pgLevel(c.pct) : "none";
    const bar = !c.h ? "transparent" : c.open ? pgColor(L) : (isLight() ? "#cbd5e1" : "#334155");
    const isSel = sel === c.key;
    const col = tone(c.ph.color || phaseColor(c.ph.id));
    // v4.8: giai đoạn đang mở = nền màu giai đoạn (~11%) + vạch trái; đang chọn thì thêm viền
    const shadows = [c.open ? `inset 3px 0 0 ${col}` : "", isSel ? "inset 0 0 0 1px #0f766e" : ""].filter(Boolean).join(", ");
    return (
      <td key={c.ph.id} style={{ background: c.open ? `${col}1c` : isSel ? (isLight() ? "#e2e8f0" : "#16213a") : undefined, boxShadow: shadows || undefined }}
        onMouseEnter={(e) => { setHover(c.key); placeCard(e); }}
        onMouseMove={placeCard}
        onMouseLeave={() => setHover((h) => (h === c.key ? null : h))}
        onClick={() => { setHover(null); setSel((s) => (s === c.key ? null : c.key)); }}
        className={`cursor-pointer px-2.5 py-2.5 ${c.open ? "rounded-r-md hover:brightness-125" : "rounded-md opacity-[.97] hover:bg-[#16213a]"}`}>
        <div className={`flex items-baseline gap-1 font-mono text-xs ${c.open ? "text-slate-100" : "text-slate-600"}`}>
          <span className={c.open ? "text-[13px] font-bold" : ""}>{fmtH(c.h)}</span><span className={c.open ? "text-slate-400" : "text-slate-700"}>/ {c.b ? fmtH(c.b) : "—"} h</span>
          {c.open && <span className="ml-1 rounded border border-teal-900 px-1 font-sans text-[10px] leading-4 text-teal-400">mở</span>}
          {c.pct != null && c.h > 0 && <span className="ml-auto" style={{ color: pgColor(L), opacity: c.open ? 1 : 0.45 }}>{Math.round(c.pct)}%</span>}
        </div>
        <div className={`mt-1 h-[5px] overflow-hidden rounded-full ${c.open ? "bg-slate-950/60" : "bg-slate-800/50"}`}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.pct || 0)}%`, background: bar, opacity: c.open ? 1 : 0.55 }} />
        </div>
      </td>
    );
  };
  const line = (r) => {
    const dim = selProj && r.p.id !== selProj, focus = selProj && r.p.id === selProj;
    const out = [(
      <tr key={r.p.id} className={`group border-b border-slate-800 ${dim ? "opacity-25 hover:opacity-60" : ""} ${focus ? "bg-[#0f1a30]" : r.p.urgent ? "bg-rose-500/[.035]" : ""}`}>
        <td className="relative whitespace-nowrap py-2.5 pl-2 pr-2.5 text-sm text-slate-100">
          {r.p.urgent && <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-sm bg-rose-500" />}
          {drag.grip(r.p.id, rows.length < 2)}
          <button onClick={() => toggleUrgent(r.p)} title={r.p.urgent ? "Bỏ đánh dấu Urgent" : "Đánh dấu Urgent — đưa dự án lên đầu"}
            className={`mr-1.5 rounded p-1 align-[-3px] transition-opacity hover:bg-slate-800 ${r.p.urgent ? "text-rose-500 opacity-100" : "text-slate-600 opacity-0 hover:text-rose-400 group-hover:opacity-100"}`}>
            <Flag size={14} fill={r.p.urgent ? "currentColor" : "none"} />
          </button>
          {r.p.code && <span className="mr-2 font-mono text-teal-400">{r.p.code}</span>}{r.p.name}
          {r.p.urgent && <span className="ml-2 rounded border border-rose-800 bg-rose-500/15 px-1.5 align-[1px] text-[10px] font-bold leading-4 tracking-wider text-rose-400">URGENT</span>}
        </td>
        {r.cells.map((c) => cell(r, c))}
        <td className="whitespace-nowrap px-2.5 py-2.5 text-center font-mono text-sm">
          <span className={totColor(r)}>{fmtH(r.ut)}</span><span className="text-slate-500"> / {fmtH(r.bt)} h</span>
        </td>
        <td className="whitespace-nowrap px-2.5 py-2.5 text-center font-mono text-sm text-slate-300"
          title={weekPeople?.get(r.p.id)?.size ? "Số người có giờ đã gửi vào dự án trong tuần này" : undefined}>
          {weekPeople?.get(r.p.id)?.size || <span className="text-slate-700">—</span>}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2.5 text-center">{statusBadge(r)}</td>
      </tr>
    )];
    if (focus) {
      const info = buildPhaseInfo(detail.get(sel), selCell, ctx);
      out.push(
        <tr key={`${r.p.id}-detail`}>
          <td colSpan={phases.length + 4} className="bg-[#081022] p-0">
            {info ? <PhaseDetail key={sel} cell={selCell} info={info} partial={partial} onClose={() => setSel(null)} />
              : <div className="relative p-4 text-sm text-slate-500">
                  {detailRaw === undefined ? "Đang tải chi tiết…" : "Chưa có giờ công đã gửi vào giai đoạn này."}
                  <button onClick={() => setSel(null)} className="absolute right-4 top-3 h-[30px] rounded-md border border-slate-700 px-2.5 text-xs text-slate-400 hover:text-slate-100">Đóng ✕</button>
                </div>}
          </td>
        </tr>
      );
    }
    /* v5.6 — mỗi dự án một <tbody>; dự án đang mở chi tiết có viền teal mảnh bo góc bao trọn dòng dự án + khung chi tiết */
    return (
      <tbody key={r.p.id} {...drag.rowProps(r.p.id)} className={`${focus ? "rounded-[10px] outline outline-1 -outline-offset-1 outline-teal-700" : ""} ${drag.mark(r.p.id, "tbody")}`}>
        {out}
      </tbody>
    );
  };
  const PKpi = ({ l, v, cls = "text-slate-50" }) => (
    <div className="bg-slate-900 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-slate-500">{l}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${cls}`}>{v}</div>
    </div>
  );
  return (
    <div>
      {/* v5.6 — KPI + bộ lọc riêng của tab Dự án */}
      <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 md:grid-cols-4">
        <PKpi l="Dự án đang mở" v={allRows.length} />
        <PKpi l="Vượt dự kiến" v={pcnt("x")} cls={pcnt("x") ? "text-rose-400" : "text-slate-50"} />
        <PKpi l="Sắp vượt (≥ 80%)" v={pcnt("w")} cls={pcnt("w") ? "text-amber-400" : "text-slate-50"} />
        <PKpi l="Urgent" v={allRows.filter((r) => r.p.urgent).length} cls={allRows.some((r) => r.p.urgent) ? "text-rose-400" : "text-slate-50"} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <div className="flex max-w-full overflow-x-auto rounded-md border border-slate-700">
          {[["all", "Tất cả"], ["x", "Vượt"], ["w", "Sắp vượt"], ["ok", "Bình thường"]].map(([k, l]) => (
            <button key={k} onClick={() => setPf(k)}
              className={`${CTRL} whitespace-nowrap px-3 text-[13px] ${pf === k ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>
              {l}<span className="ml-1.5 font-mono text-slate-500">{pcnt(k)}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-60">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Tìm dự án" className={`pl-9 ${inputCls}`} />
        </div>
        {projOrder.length > 0 && (
          <button onClick={() => setProjOrder([])} title="Bỏ thứ tự đã kéo, xếp lại tự động theo mức vượt dự kiến"
            className={`${CTRL} whitespace-nowrap rounded-md border border-slate-700 px-3 text-[13px] text-slate-400 hover:text-slate-200`}>
            <RotateCcw size={13} className="mr-1.5 inline align-[-2px]" />Xếp tự động
          </button>
        )}
        <div className="sm:ml-auto"><ProgressLegend /></div>
      </div>
      <div className="p-3 md:p-4">
      {rows.length === 0 ? <p className="px-2.5 text-sm text-slate-500">Không có dự án khớp bộ lọc.</p> : (<>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-2.5 py-2 font-normal">Dự án</th>
              {phases.map((ph) => (
                <th key={ph.id} className="px-2.5 py-2 font-normal" style={{ width: "15.2%" }}>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: tone(ph.color) }} />{ph.id} · {ph.name}
                </th>
              ))}
              <th className="whitespace-nowrap px-2.5 py-2 text-center font-normal" style={{ width: "12%" }}>Giờ hiện tại / dự kiến</th>
              <th className="whitespace-nowrap px-2.5 py-2 text-center font-normal" style={{ width: "7%" }}>Người tuần này</th>
              <th className="whitespace-nowrap px-2.5 py-2 text-center font-normal" style={{ width: "12%" }}>Tình trạng</th>
            </tr>
          </thead>
          {active.filter((r) => r.p.urgent).map(line)}
          {urgentIdle.map(line)}
          {active.filter((r) => !r.p.urgent).map(line)}
          {showIdle && idle.map(line)}
        </table>
      </div>
      {active.length === 0 && urgentIdle.length === 0 && !showIdle && <p className="px-2.5 pt-2 text-sm text-slate-500">Chưa dự án nào có giờ công đã gửi.</p>}
      {idle.length > 0 && (
        <button onClick={() => setShowIdle((x) => !x)} className="mt-2 px-2.5 text-xs text-slate-400 hover:text-slate-200">
          {showIdle ? "▲ Ẩn" : "▼ Hiện"} {idle.length} dự án đang mở nhưng chưa có giờ
        </button>
      )}
      </>)}
      </div>
      <div ref={cardRef} className="pointer-events-none fixed z-[60] w-[360px] rounded-xl border border-slate-700 bg-[#030a1a] px-3.5 py-3 shadow-[0_18px_40px_rgba(0,0,0,.6)]"
        style={{ display: hoverCell ? "block" : "none" }}>
        {hoverCell && <PhaseHoverCard cell={hoverCell} info={buildPhaseInfo(detail.get(hover), hoverCell, ctx)} canOpen />}
      </div>
    </div>
  );
}

export const ProjectPhaseBars = ({ rows }) => {
  const [limit, setLimit] = useState(10);
  if (rows.length === 0) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>;
  const shown = limit === 0 ? rows : rows.slice(0, limit);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
        {PHASES.map((ph) => <span key={ph.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: tone(ph.color) }} />{ph.id} · {ph.name}</span>)}
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-slate-100" />Mốc dự kiến</span>
        {rows.length > 10 && (
          <span className="ml-auto flex items-center gap-1.5">
            {[10, 25, 0].map((n) => (
              <button key={n} onClick={() => setLimit(n)}
                className={`rounded-md border px-2.5 py-1 ${limit === n ? "border-teal-700 bg-teal-950 text-teal-300" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>
                {n === 0 ? `Tất cả (${rows.length})` : `Top ${n}`}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 620 }}>
        {shown.map((r) => {
          const max = Math.max(1, ...PHASES.map((ph) => Math.max(r.budgets?.[ph.id] || 0, r[ph.id] || 0)));
          const overs = PHASES.filter((ph) => (r.budgets?.[ph.id] || 0) > 0 && (r[ph.id] || 0) > r.budgets[ph.id]).map((ph) => ph.id);
          const tOver = r.budget > 0 && r.total > r.budget;
          return (
            <div key={r.id} data-proj={r.id} className="grid gap-x-5 gap-y-2 border-b border-slate-800 py-3 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="text-sm text-slate-100">{r.name}{overs.length > 0 && <span className="ml-1.5 whitespace-nowrap rounded border border-rose-900 bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300">Vượt {overs.join(", ")}</span>}</div>
                <div className={`mt-1 font-mono text-xs ${tOver ? "text-rose-400" : "text-slate-400"}`}>Tổng {fmtH(r.total)} / {r.budget > 0 ? `${fmtH(r.budget)} h · ${Math.round((r.total / r.budget) * 100)}%` : "—"}</div>
              </div>
              <div className="min-w-0 space-y-1.5">
                {PHASES.map((ph) => {
                  const b = r.budgets?.[ph.id] || 0, u = r[ph.id] || 0, over = b > 0 && u > b;
                  return (
                    <div key={ph.id} className="grid grid-cols-[28px_minmax(0,1fr)_104px] items-center gap-2.5 text-xs md:grid-cols-[28px_minmax(0,1fr)_150px]">
                      <span className="font-mono text-slate-400" title={ph.name}>{ph.id}</span>
                      <div className="relative h-2.5 rounded-sm bg-slate-800">
                        <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(u / max) * 100}%`, background: tone(ph.color) }} />
                        {b > 0 && <div className="absolute w-0.5 bg-slate-100" style={{ left: `calc(${(b / max) * 100}% - 1px)`, top: -3, bottom: -3 }} />}
                      </div>
                      <span className={`whitespace-nowrap text-right font-mono ${over ? "text-rose-400" : "text-slate-300"}`}>{fmtH(u)} / {b > 0 ? `${fmtH(b)} h` : "—"}{b > 0 && <span className="hidden md:inline"> · {Math.round((u / b) * 100)}%</span>}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ChartBar = ({ data, color }) => {
  const isMobile = useIsMobile();
  const w = isMobile ? 96 : 150;
  const trim = (s) => (isMobile && s.length > 16 ? s.slice(0, 15) + "…" : s.length > 26 ? s.slice(0, 25) + "…" : s);
  if (data.length === 0) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * (isMobile ? 28 : 32))}>
      <BarChart data={data.map((d) => ({ ...d, name: trim(d.name) }))} layout="vertical" margin={{ left: 4, right: 16 }}>
        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke={isLight() ? "#e2e8f0" : "#1e293b"} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={w} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "#1e293b" }}
          contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "6px 10px" }}
          labelStyle={{ color: "#ffffff", fontSize: 14, fontWeight: 600, marginBottom: 2 }}   // tên: 14px, in đậm
          itemStyle={{ color: "#ffffff", fontSize: 14 }}                                       // số giờ: 14px
        />
        <Bar dataKey="giờ" radius={[0, 4, 4, 0]} barSize={isMobile ? 11 : 14}>{data.map((_, i) => <Cell key={i} fill={color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

