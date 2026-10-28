/* ARTIUS TIME v12.22 — Dashboard › Tổng quan nguồn lực.
   Một biểu đồ duy nhất trả lời hai câu hỏi cùng lúc:
     · công ty tuần nào thiếu người, thiếu mấy người  → chiều cao phần trên vạch 0
     · thiếu ở vai trò nào, vai trò nào đang rảnh      → các đoạn màu trong cột, phần dưới vạch 0
   Cột chồng hai chiều: thiếu vẽ LÊN, dư vẽ XUỐNG. Không bù trừ giữa hai bên,
   nên vai trò đang dư không che mất vai trò đang thiếu như khi cộng gộp thành một con số.

   Màn này CHỈ ĐỌC. Lưới nhập vẫn nằm ở tab Kế hoạch; ở đây không sửa được ô nào.
   Số liệu lấy đúng cùng nguồn và cùng quy tắc với tab Kế hoạch (planCalc.js / planStore.js):
   quân số = số người của vai trò × hệ số sẵn sàng, dự án tạm ẩn và vai trò gộp đều áp dụng y hệt. */
import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ROLES, isResigned } from "../../core/domain.jsx";
import { isLight } from "../../core/theme.jsx";
import { CTRL } from "../../core/ui.jsx";
import { useDataTick } from "../../core/db.jsx";
import { PER_YEAR, cellOf, foldMerged, joinYears, needOf, normalizeYear, slotIndexOf, weeksOfPair } from "../planning/planCalc.js";
import { SQL_HINT, errMsg, isMissingTable, loadPlan } from "../planning/planStore.js";

const DEFAULT_AVAIL = 0.8;
const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");

/* Bảng màu vai trò — đủ cho 15 vai trò, đọc được trên cả nền sáng và nền tối.
   Gán theo thứ tự vai trò trong Thiết lập nên một vai trò luôn giữ một màu giữa các lần mở. */
const PALETTE = ["#14b8a6", "#f59e0b", "#6366f1", "#ec4899", "#0ea5e9", "#84cc16", "#f43f5e",
  "#a855f7", "#eab308", "#3b82f6", "#fb923c", "#22c55e", "#d946ef", "#2dd4bf", "#94a3b8"];

const SHORT = "#ef4444";                                  /* màu phần thiếu của dòng tổng */
const freeFill = () => (isLight() ? "#cbd5e1" : "#475569"); /* màu phần dư của dòng tổng */

export default function ResourceOverview({ cfg }) {
  const tick = useDataTick();
  const [rawPlan, setRawPlan] = useState({});
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [win, setWin] = useState(12);        /* số tuần hiển thị kể từ tuần hiện tại */
  const [unit, setUnit] = useState("abs");   /* abs = số người · pct = % quân số công ty */
  const [pick, setPick] = useState(null);    /* chỉ số cột tuần đang soi */
  const [off, setOff] = useState(() => new Set());   /* vai trò đang tắt */

  const start = new Date().getFullYear();
  const weeks = useMemo(() => weeksOfPair(start), [start]);
  const nowIdx = Math.max(0, slotIndexOf(start, new Date()));

  /* ---------- vai trò, quân số, dự án: cùng quy tắc với tab Kế hoạch ---------- */
  const avail = Number(cfg.planning?.availability) > 0 ? Number(cfg.planning.availability) : DEFAULT_AVAIL;
  const allRoles = useMemo(() => ROLES.map((r) => ({ ...r })), [cfg.roles, tick]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* gộp vai trò (vd TL-2D → 2D) chỉ một tầng, bỏ vai trò đã xoá — giống ResourcePlan */
  const merge = useMemo(() => {
    const m = cfg.planning?.merge || {}, ids = new Set(allRoles.map((r) => r.id)), out = {};
    for (const [k, v] of Object.entries(m)) if (ids.has(k) && ids.has(v) && k !== v && !m[v]) out[k] = v;
    return out;
  }, [cfg.planning?.merge, allRoles]);
  const roles = useMemo(() => allRoles.filter((r) => !merge[r.id]), [allRoles, merge]);
  const cap = useMemo(() => {
    const h = new Map();
    for (const e of cfg.employees || []) {
      if (isResigned(e) || e.noPlan || !e.role) continue;
      const rid = merge[e.role] || e.role;
      h.set(rid, (h.get(rid) || 0) + 1);
    }
    return new Map([...h].map(([k, v]) => [k, +(v * avail).toFixed(2)]));
  }, [cfg.employees, merge, avail]);

  const hidden = useMemo(() => new Set(cfg.planning?.hidden || []), [cfg.planning?.hidden]);
  const projects = useMemo(
    () => (cfg.projects || []).filter((p) => p.active && !hidden.has(p.id)),
    [cfg.projects, hidden]);
  const pids = useMemo(() => projects.map((p) => p.id), [projects]);

  /* ---------- tải lưới kế hoạch (chỉ đọc) ----------
     Chỉ phụ thuộc năm. Việc gộp vai trò làm ở bước dưới, không nhét vào đây:
     merge là đối tượng dựng lại mỗi lần số liệu nhúc nhích, để trong deps thì cứ thế gọi lại Supabase. */
  useEffect(() => {
    let alive = true;
    setBusy(true); setErr("");
    Promise.all([loadPlan(start), loadPlan(start + 1)])
      .then(([a, b]) => alive && setRawPlan(joinYears(normalizeYear(a, start), normalizeYear(b, start + 1), PER_YEAR, PER_YEAR)))
      .catch((e) => alive && setErr(isMissingTable(e) ? SQL_HINT : `Chưa tải được kế hoạch — ${errMsg(e)}`))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [start]);
  /* gộp vai trò con vào vai trò cha (vd TL-2D → 2D) — đổi thiết lập gộp là thấy ngay, khỏi tải lại */
  const plan = useMemo(() => foldMerged(rawPlan, (rid) => merge[rid] || rid).plan, [rawPlan, merge]);

  /* vai trò có mặt: có quân số, hoặc có nhu cầu ở đâu đó trong lưới */
  const shown = useMemo(
    () => roles.filter((r) => (cap.get(r.id) || 0) > 0 || weeks.some((w) => needOf(plan, pids, r.id, w.i) > 0)),
    [roles, cap, weeks, plan, pids]);
  const colorOf = useMemo(() => {
    const m = new Map();
    shown.forEach((r, k) => m.set(r.id, PALETTE[k % PALETTE.length]));
    return m;
  }, [shown]);

  const view = useMemo(() => weeks.slice(nowIdx, nowIdx + win), [weeks, nowIdx, win]);
  const live = useMemo(() => shown.filter((r) => !off.has(r.id)), [shown, off]);
  const capAll = useMemo(() => shown.reduce((a, r) => a + (cap.get(r.id) || 0), 0), [shown, cap]);

  /* chênh lệch của một vai trò ở một cột: > 0 là dư, < 0 là thiếu */
  const gapOf = (rid, wi) => (cap.get(rid) || 0) - needOf(plan, pids, rid, wi);
  /* tổng của cột: cộng riêng hai bên, KHÔNG bù trừ */
  const shortAt = (wi, list) => list.reduce((a, r) => a + Math.max(0, -gapOf(r.id, wi)), 0);
  const freeAt = (wi, list) => list.reduce((a, r) => a + Math.max(0, gapOf(r.id, wi)), 0);

  const sel = pick != null && view.some((w) => w.i === pick) ? pick : (view[0]?.i ?? null);

  if (busy) return (
    <div className="flex items-center gap-2 px-4 py-10 text-sm text-slate-500">
      <Loader2 className="animate-spin" size={16} /> Đang đọc kế hoạch nguồn lực…
    </div>
  );
  if (err) return <p className="px-4 py-8 text-sm text-rose-300">{err}</p>;
  if (shown.length === 0) return (
    <p className="px-4 py-8 text-sm text-slate-500">
      Chưa có vai trò nào có quân số hoặc có kế hoạch. Nhập lưới ở tab Kế hoạch trước.
    </p>
  );
  if (view.length === 0 || sel == null) return (
    <p className="px-4 py-8 text-sm text-slate-500">Không còn tuần nào phía trước trong hai năm đang xem.</p>
  );

  /* ---------------------------- biểu đồ ---------------------------- */
  const W = 980, H = 300, L = 46, R = 14, T = 24, B = 40;
  const n = view.length, step = (W - L - R) / Math.max(n, 1);
  const PH = H - T - B;                 /* chiều cao vùng vẽ */
  const PADU = 16, PADD = 14;           /* chừa chỗ cho nhãn số trên đỉnh cột và nhãn tuần */
  const FLOOR = 3;                      /* sàn hiển thị: đoạn rất mỏng vẫn phải thấy được */

  /* đổi giá trị (số người) sang đơn vị đang chọn */
  const val = (v) => (unit === "abs" ? v : capAll > 0 ? (v / capAll) * 100 : 0);

  let up = 0, dn = 0;
  for (const w of view) { up = Math.max(up, val(shortAt(w.i, live))); dn = Math.max(dn, val(freeAt(w.i, live))); }
  /* Vạch 0 đặt theo đúng tỉ lệ thiếu / dư đang có, thay vì cố định 58%:
     chia sao cho hai nửa cùng một thang đo mà không nửa nào thừa chỗ trống — nhờ vậy biểu đồ gọn lại
     thay vì để trống một mảng dưới vạch 0 như trước. */
  const mid = T + (up + dn < 1e-6 ? PH * 0.6
    : Math.min(PH * 0.85, Math.max(PH * 0.3, (up * PH - PADD * up + PADU * dn) / (up + dn))));
  const sc = Math.min((mid - T - PADU) / Math.max(up, unit === "abs" ? 0.5 : 5),
    (H - B - mid - PADD) / Math.max(dn, unit === "abs" ? 0.5 : 5));

  const axis = isLight() ? "#0f172a" : "#e2e8f0";
  const grid = isLight() ? "#e2e8f0" : "#1e293b";
  const mute = "#64748b";

  const bars = [];
  view.forEach((w, k) => {
    const x = L + k * step + step * 0.17, bw = step * 0.66;
    let yU = mid, yD = mid;
    live.forEach((r) => {
      const g = gapOf(r.id, w.i);
      if (g < -0.001) {                                  /* thiếu → vẽ lên trên */
        const h = Math.max(FLOOR, val(-g) * sc); yU -= h;
        bars.push(<rect key={`s${w.i}${r.id}`} x={x} y={yU} width={bw} height={h} rx="2" fill={colorOf.get(r.id)}>
          <title>{`T${w.m} tuần ${w.w} — ${r.id} thiếu ${f0(-g)}`}</title></rect>);
      } else if (g > 0.001) {                            /* dư → vẽ xuống dưới, nhạt hơn */
        const h = Math.max(FLOOR, val(g) * sc);
        bars.push(<rect key={`f${w.i}${r.id}`} x={x} y={yD} width={bw} height={h} rx="2" fill={colorOf.get(r.id)} opacity="0.32">
          <title>{`T${w.m} tuần ${w.w} — ${r.id} dư ${f0(g)}`}</title></rect>);
        yD += h;
      }
    });
    const tot = shortAt(w.i, live);
    if (tot > 0.02) bars.push(
      <text key={`t${w.i}`} x={x + bw / 2} y={yU - 6} fontSize="10.5" textAnchor="middle" fill={SHORT}>
        {unit === "abs" ? f0(tot) : `${Math.round(val(tot))}%`}
      </text>);
    if (w.i === sel) bars.push(
      <rect key={`k${w.i}`} x={x - 3} y={T} width={bw + 6} height={H - B - T} rx="5"
        fill="none" stroke={axis} strokeWidth="1.1" strokeDasharray="3 3" />);
    bars.push(<rect key={`h${w.i}`} x={L + k * step} y={T} width={step} height={H - B - T}
      fill="transparent" style={{ cursor: "pointer" }} onClick={() => setPick(w.i)} />);
  });

  const ticks = view.map((w, k) => (k === 0 || view[k - 1].m !== w.m) && (
    <g key={`m${w.i}`}>
      <line x1={L + k * step} y1={T} x2={L + k * step} y2={H - B} stroke={grid} />
      <text x={L + k * step + 4} y={T - 10} fontSize="11" fill="#0d9488">
        {`T${w.m}${w.m === 1 || k === 0 ? `·${String(w.y).slice(2)}` : ""}`}
      </text>
    </g>
  ));

  /* ---------------------------- khung chi tiết ---------------------------- */
  const selW = weeks.find((w) => w.i === sel);
  const rows = shown.map((r) => {
    const g = gapOf(r.id, sel), c = cap.get(r.id) || 0;
    return { r, g, c, need: needOf(plan, pids, r.id, sel), pct: c > 0 ? Math.round((-g / c) * 100) : null };
  }).sort((a, b) => a.g - b.g);
  const who = rows.filter((o) => o.g < -0.001).flatMap((o) =>
    projects.map((p) => ({ rid: o.r.id, p, v: cellOf(plan, p.id, o.r.id, sel) }))
      .filter((o2) => o2.v > 0).sort((a, b) => b.v - a.v));

  const seg = (on) => `${CTRL} whitespace-nowrap px-3 text-[13px] ${on ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`;

  return (
    <div>
      {/* thanh công cụ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <div className="flex overflow-hidden rounded-md border border-slate-700">
          {[["abs", "Số người"], ["pct", "% quân số"]].map(([k, l]) => (
            <button key={k} onClick={() => setUnit(k)} className={seg(unit === k)}>{l}</button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-md border border-slate-700">
          {[12, 24, 36].map((k) => (
            <button key={k} onClick={() => setWin(k)} className={seg(win === k)}>{k} tuần</button>
          ))}
        </div>
        <span className="ml-auto text-[11.5px] text-slate-500">
          quân số {f0(capAll)} người · hệ số sẵn sàng {Math.round(avail * 100)}%
        </span>
      </div>

      {/* chip bật tắt vai trò */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-3 py-2.5 md:px-4">
        {shown.map((r) => {
          const on = !off.has(r.id);
          return (
            <button key={r.id} onClick={() => setOff((s) => { const t = new Set(s); t.has(r.id) ? t.delete(r.id) : t.add(r.id); return t; })}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${on ? "border-slate-700 text-slate-300" : "border-slate-800 text-slate-600"}`}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf.get(r.id), opacity: on ? 1 : 0.3 }} />
              <span className="font-mono">{r.id}</span>
            </button>
          );
        })}
      </div>

      {/* v12.22 — khung chi tiết rộng hơn phần biểu đồ cần: tên dự án viết đủ, không cắt bớt */}
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* biểu đồ */}
        <div className="p-3 md:p-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {ticks}
            {bars}
            <line x1={L} y1={mid} x2={W - R} y2={mid} stroke={axis} strokeWidth="1.3" />
            <text x={6} y={T + 10} fontSize="10.5" fill={SHORT}>THIẾU người</text>
            <text x={6} y={H - B - 4} fontSize="10.5" fill={mute}>DƯ người</text>
            {view.map((w, k) => (
              <text key={`w${w.i}`} x={L + k * step + step / 2} y={H - 14} fontSize="9" textAnchor="middle" fill={mute}>{w.w}</text>
            ))}
          </svg>
          <p className="mt-1 text-[11px] text-slate-500">
            {unit === "abs"
              ? "Chiều cao phần trên vạch 0 là tổng số người công ty còn thiếu tuần đó; mỗi đoạn màu là một vai trò. Phần dưới vạch 0 là vai trò đang rảnh."
              : "Phần trăm tính trên tổng quân số công ty nên các đoạn cộng được với nhau. Mức căng của riêng từng vai trò xem ở khung bên phải."}
          </p>
        </div>

        {/* chi tiết tuần đang soi */}
        <div className="border-t border-slate-800 bg-slate-950/40 p-3 md:p-4 xl:border-l xl:border-t-0">
          <div className="text-sm text-slate-200">T{selW?.m} · tuần {selW?.w}</div>
          <div className="mb-3 text-[11px] text-slate-500">Bấm một cột trong biểu đồ để đổi tuần</div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-rose-950/50 px-3 py-2">
              <div className="font-mono text-lg text-rose-300">{f0(shortAt(sel, shown))}</div>
              <div className="text-[10.5px] text-slate-500">người thiếu</div>
            </div>
            <div className="rounded-lg bg-slate-800/50 px-3 py-2">
              <div className="font-mono text-lg text-slate-300">{f0(freeAt(sel, shown))}</div>
              <div className="text-[10.5px] text-slate-500">người dư</div>
            </div>
          </div>
          {rows.map((o) => (
            <div key={o.r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-slate-800 py-1.5 text-[12px]">
              <span className="min-w-0">
                <span className="font-mono text-slate-300">{o.r.id}</span> <span className="text-slate-500">{o.r.name}</span>
                <span className="block text-[11px] text-slate-600">cần {f0(o.need)} / có {f0(o.c)}</span>
              </span>
              <span className={`whitespace-nowrap text-right font-mono ${o.g < -0.001 ? "text-rose-400" : "text-slate-500"}`}>
                {o.g < -0.001 ? `thiếu ${f0(-o.g)}` : o.g > 0.001 ? `dư ${f0(o.g)}` : "vừa đủ"}
                {o.g < -0.001 && o.pct != null && <span className="block text-[10.5px] text-rose-500">{o.pct}% quân số</span>}
              </span>
            </div>
          ))}
          <div className="mt-3 text-[10.5px] uppercase tracking-wider text-slate-500">Dự án đang chiếm</div>
          {who.length === 0
            ? <div className="border-t border-slate-800 py-1.5 text-[11.5px] text-slate-600">Tuần này không vai trò nào thiếu người</div>
            : who.map((o, k) => (
              /* tên dự án viết đủ và xuống dòng khi dài — mã dự án chỉ đi kèm, không thay cho tên */
              <div key={`${o.rid}${o.p.id}${k}`} className="grid grid-cols-[34px_minmax(0,1fr)_44px] items-baseline gap-2 border-t border-slate-800 py-1.5 text-[11.5px]">
                <span className="font-mono" style={{ color: colorOf.get(o.rid) }}>{o.rid}</span>
                <span className="break-words text-slate-300">
                  {o.p.name || o.p.code}
                  {o.p.code && o.p.name && o.p.name !== o.p.code && (
                    <span className="ml-1.5 font-mono text-[10.5px] text-slate-600">{o.p.code}</span>
                  )}
                </span>
                <span className="text-right font-mono text-slate-300">{f0(o.v)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
