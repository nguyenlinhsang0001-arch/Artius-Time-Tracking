/* ARTIUS TIME v12.26 — Dashboard › Tổng quan nguồn lực.
   Bốn khối, đọc từ trên xuống là từ kết luận tới chi tiết:
     1. Dải tóm tắt — kết luận cho CẢ giai đoạn đang xem (bao nhiêu tuần thiếu, thiếu bình quân, đỉnh, vai trò nghẽn).
        Trước v12.26 màn này chỉ có số của MỘT tuần đang chọn, người xem phải tự cộng nhẩm mới biết
        thiếu là đỉnh tạm thời hay kéo dài — hai thứ đó dẫn tới hai cách xử lý khác hẳn nhau.
     2. Biểu đồ cột chồng hai chiều — thiếu vẽ LÊN, dư vẽ XUỐNG, không bù trừ giữa hai bên,
        nên vai trò đang dư không che mất vai trò đang thiếu như khi cộng gộp thành một con số.
     3. Bảng dự án chiếm vai trò đang thiếu — xếp hạng cho cả giai đoạn, bấm một dòng thì biểu đồ
        làm mờ những tuần dự án đó không góp mặt.
     4. Khung chi tiết tuần đang chọn — gom theo từng vai trò thiếu, kèm dự án đang chiếm vai trò đó.

   Màn này CHỈ ĐỌC. Lưới nhập vẫn nằm ở tab Kế hoạch; ở đây không sửa được ô nào.
   Số liệu lấy đúng cùng nguồn và cùng quy tắc với tab Kế hoạch (planCalc.js / planStore.js):
   quân số = số người của vai trò × hệ số sẵn sàng, dự án tạm ẩn và vai trò gộp đều áp dụng y hệt.
   Chip vai trò lọc đồng bộ cả bốn khối, để mọi con số trên màn luôn nói về cùng một tập vai trò. */
import React, { useEffect, useMemo, useRef, useState } from "react";
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

const SHORT = "#ef4444";   /* màu chữ số tổng thiếu trên đỉnh cột */

export default function ResourceOverview({ cfg }) {
  const tick = useDataTick();
  const [rawPlan, setRawPlan] = useState({});
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [win, setWin] = useState(12);        /* số tuần hiển thị kể từ tuần hiện tại */
  const [unit, setUnit] = useState("abs");   /* abs = số người · pct = % quân số công ty */
  const [pick, setPick] = useState(null);    /* chỉ số cột tuần đang soi */
  const [off, setOff] = useState(() => new Set());   /* vai trò đang tắt */
  const [selP, setSelP] = useState(null);    /* dự án đang chọn ở bảng xếp hạng */
  /* Bề ngang thật của khung vẽ. SVG vẽ đúng số pixel này thay vì để viewBox kéo giãn:
     kéo giãn thì cỡ chữ bị nhân theo bề ngang màn hình, màn rộng chữ phóng to gấp đôi. */
  const wrapRef = useRef(null);
  const [cw, setCw] = useState(0);
  /* Khung chi tiết bên phải cao đúng bằng cột trái rồi cuộn bên trong.
     Lưới dùng items-start nên cột trái không bị kéo giãn theo cột phải — không có vòng lặp đo. */
  const leftRef = useRef(null);
  const [leftH, setLeftH] = useState(0);

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
  /* đo khung vẽ; chạy lại khi vừa tải xong vì lúc đang tải chưa có thẻ nào để đo */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => setCw(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    const lef = leftRef.current;
    let ro2;
    if (lef) {
      const readL = () => setLeftH(Math.round(lef.getBoundingClientRect().height));
      readL();
      ro2 = new ResizeObserver(readL);
      ro2.observe(lef);
    }
    return () => { ro.disconnect(); if (ro2) ro2.disconnect(); };
  }, [busy, err]);

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

  /* ---------- tóm tắt CẢ giai đoạn đang xem (v12.26) ----------
     Tính trên các vai trò đang bật, để mọi khối trên màn cùng nói về một tập vai trò. */
  const summary = useMemo(() => {
    if (!view.length || !live.length) return null;
    const sh = view.map((w) => shortAt(w.i, live));
    const nShort = sh.filter((x) => x > 0.001).length;
    const total = sh.reduce((a, b) => a + b, 0);
    const avg = total / view.length;
    let peak = 0, peakW = view[0];
    sh.forEach((x, k) => { if (x > peak) { peak = x; peakW = view[k]; } });
    /* vai trò nghẽn nhất tính bằng NGƯỜI-TUẦN thiếu cộng dồn, không phải đỉnh một tuần:
       một vai trò thiếu ít nhưng thiếu suốt mới là vấn đề phải tuyển người. */
    const byRole = live.map((r) => ({
      r, tot: view.reduce((a, w) => a + Math.max(0, -gapOf(r.id, w.i)), 0),
      peak: Math.max(0, ...view.map((w) => -gapOf(r.id, w.i))),
    })).sort((a, b) => b.tot - a.tot);
    /* vai trò dư ít nhất 1 người trong ít nhất 3 tuần — chỗ có thể điều người sang */
    const spare = live.map((r) => {
      const ks = view.filter((w) => gapOf(r.id, w.i) >= 1);
      if (ks.length < 3) return null;
      const vs = ks.map((w) => gapOf(r.id, w.i));
      return { r, n: ks.length, from: ks[0], a: Math.min(...vs), b: Math.max(...vs) };
    }).filter(Boolean);
    return { nShort, avg, peak, peakW, byRole, spare, total };
  }, [view, live, plan, pids, cap]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- bảng dự án chiếm vai trò đang thiếu (v12.26) ----------
     Con số là NHU CẦU của dự án trong các vai trò đang thiếu, ở các tuần đang thiếu —
     tức số người-tuần giải phóng được nếu giãn dự án đó. Tổng các dòng LỚN HƠN tổng thiếu,
     vì một tuần thiếu 2 người có thể do bốn dự án cùng đặt người vào. */
  const projRows = useMemo(() => {
    const m = new Map();
    for (const w of view) for (const r of live) {
      if (gapOf(r.id, w.i) >= 0) continue;
      for (const p of projects) {
        const v = cellOf(plan, p.id, r.id, w.i);
        if (v <= 0) continue;
        if (!m.has(p.id)) m.set(p.id, { p, tot: 0, byRole: new Map(), byWeek: new Map() });
        const o = m.get(p.id);
        o.tot += v;
        o.byRole.set(r.id, (o.byRole.get(r.id) || 0) + v);
        o.byWeek.set(w.i, (o.byWeek.get(w.i) || 0) + v);
      }
    }
    return [...m.values()].sort((a, b) => b.tot - a.tot);
  }, [view, live, projects, plan, cap]);   // eslint-disable-line react-hooks/exhaustive-deps
  const projMax = projRows.length ? projRows[0].tot : 1;
  const weekMax = Math.max(1, ...projRows.flatMap((o) => [...o.byWeek.values()]));
  /* dự án đang chọn có góp mặt ở tuần này không — để làm mờ các cột còn lại */
  const inWeek = (wi) => !selP || live.some((r) => gapOf(r.id, wi) < 0 && cellOf(plan, selP, r.id, wi) > 0);

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
  /* W = bề ngang thật, nên mọi fontSize dưới đây là pixel thật trên màn hình, không bị phóng to.
     T chừa chỗ cho hai dòng nhãn xếp chồng ở đầu biểu đồ: tháng ở trên, tuần ngay dưới. */
  const W = Math.max(520, cw || 1100), H = 360, L = 10, R = 12, T = 44, B = 8;
  const FS_MONTH = 10.5, FS_WEEK = 9, FS_TOTAL = 9.5;
  const n = view.length, step = (W - L - R) / Math.max(n, 1);
  const PH = H - T - B;                 /* chiều cao vùng vẽ */
  const PADU = 16, PADD = 18;           /* chừa chỗ cho nhãn số ở đỉnh cột và dưới chân cột */
  const FLOOR = 3;                      /* sàn hiển thị: đoạn rất mỏng vẫn phải thấy được */

  /* đổi giá trị (số người) sang đơn vị đang chọn */
  const val = (v) => (unit === "abs" ? v : capAll > 0 ? (v / capAll) * 100 : 0);

  let up = 0, dn = 0;
  for (const w of view) { up = Math.max(up, val(shortAt(w.i, live))); dn = Math.max(dn, val(freeAt(w.i, live))); }
  /* Vạch 0 đặt theo đúng tỉ lệ thiếu / dư đang có, thay vì cố định:
     chia sao cho hai nửa cùng một thang đo mà không nửa nào thừa chỗ trống. */
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
    const seg = [];
    let yU = mid, yD = mid + 1;
    live.forEach((r) => {
      const g = gapOf(r.id, w.i);
      if (g < -0.001) {                                  /* thiếu → vẽ lên trên */
        const h = Math.max(FLOOR, val(-g) * sc); yU -= h;
        seg.push(<rect key={`s${r.id}`} x={x} y={yU} width={bw} height={h - 1} rx="2" fill={colorOf.get(r.id)}>
          <title>{`T${w.m} tuần ${w.w} — ${r.id} thiếu ${f0(-g)}`}</title></rect>);
      } else if (g > 0.001) {                            /* dư → vẽ xuống dưới */
        /* v12.26: phần dư sáng hơn (0,45 thay vì 0,32) và có viền màu vai trò.
           Bản cũ mờ quá nên nửa dưới thành một mảng đục, không đọc được vai trò nào đang rảnh. */
        const h = Math.max(FLOOR, val(g) * sc);
        seg.push(<rect key={`f${r.id}`} x={x + 0.5} y={yD} width={bw - 1} height={h - 1} rx="2"
          fill={colorOf.get(r.id)} fillOpacity="0.45" stroke={colorOf.get(r.id)} strokeOpacity="0.9">
          <title>{`T${w.m} tuần ${w.w} — ${r.id} dư ${f0(g)}`}</title></rect>);
        yD += h;
      }
    });
    const tot = shortAt(w.i, live), fre = freeAt(w.i, live);
    if (tot > 0.02) seg.push(
      <text key="st" x={x + bw / 2} y={yU - 5} fontSize={FS_TOTAL} textAnchor="middle" fill={SHORT}>
        {unit === "abs" ? f0(tot) : `${Math.round(val(tot))}%`}
      </text>);
    /* v12.26: tổng dư ghi dưới chân cột, đối xứng với tổng thiếu trên đỉnh */
    if (fre > 0.02) seg.push(
      <text key="ft" x={x + bw / 2} y={yD + 11} fontSize={FS_WEEK} textAnchor="middle" fill={mute}>
        {unit === "abs" ? f0(fre) : `${Math.round(val(fre))}%`}
      </text>);
    /* chọn một dự án thì các tuần dự án đó không góp mặt bị làm mờ */
    bars.push(<g key={`g${w.i}`} opacity={inWeek(w.i) ? 1 : 0.22}>{seg}</g>);
    if (w.i === sel) bars.push(
      <rect key={`k${w.i}`} x={x - 3} y={T} width={bw + 6} height={H - B - T} rx="5"
        fill="none" stroke={axis} strokeWidth="1.1" strokeDasharray="3 3" />);
    bars.push(<rect key={`h${w.i}`} x={L + k * step} y={T} width={step} height={H - B - T}
      fill="transparent" style={{ cursor: "pointer" }} onClick={() => setPick(w.i)} />);
  });

  /* Nhãn tháng ở trên, số tuần ngay dưới, cùng nằm trên đầu biểu đồ.
     Tháng canh giữa khối tuần của nó, không dính vào tháng kế bên như khi canh trái. */
  const ticks = view.map((w, k) => {
    const first = k === 0 || view[k - 1].m !== w.m;
    if (!first) return null;
    let span = 1;
    while (k + span < n && view[k + span].m === w.m) span++;
    return (
      <g key={`m${w.i}`}>
        <line x1={L + k * step} y1={T - 14} x2={L + k * step} y2={H - B} stroke={grid} />
        <text x={L + (k + span / 2) * step} y={16} fontSize={FS_MONTH} textAnchor="middle" fill="#0d9488">
          {`T${w.m}${w.m === 1 || k === 0 ? `·${String(w.y).slice(2)}` : ""}`}
        </text>
      </g>
    );
  });
  const wkLabels = view.map((w, k) => (
    <text key={`w${w.i}`} x={L + k * step + step / 2} y={30} fontSize={FS_WEEK} textAnchor="middle"
      fill={w.i === sel ? axis : mute}>{w.w}</text>
  ));

  /* ---------------------------- khung chi tiết ---------------------------- */
  const selW = weeks.find((w) => w.i === sel);
  const rows = live.map((r) => {
    const g = gapOf(r.id, sel), c = cap.get(r.id) || 0;
    return { r, g, c, need: needOf(plan, pids, r.id, sel), pct: c > 0 ? Math.round((-g / c) * 100) : null };
  }).sort((a, b) => a.g - b.g);
  const shortRows = rows.filter((o) => o.g < -0.001);
  const spareRows = rows.filter((o) => o.g > 0.001);
  const evenRows = rows.filter((o) => Math.abs(o.g) <= 0.001);

  const seg = (on) => `${CTRL} whitespace-nowrap px-3 text-[13px] ${on ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`;
  const tile = (k, v, s, red) => (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className={`mt-0.5 font-mono text-[19px] leading-tight ${red ? "text-rose-400" : "text-slate-100"}`}>{v}</div>
      <div className="text-[11.5px] text-slate-400">{s}</div>
    </div>
  );

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

      {/* v12.26 — dải tóm tắt: kết luận cho cả giai đoạn, không phải cho một tuần */}
      {summary && (
        <div className="border-b border-slate-800 px-3 py-3 md:px-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {tile("Tuần có thiếu người", `${summary.nShort}/${view.length}`,
              summary.nShort === view.length ? "thiếu kéo dài, không phải đỉnh tạm thời"
                : summary.nShort ? "thiếu theo đợt" : "đủ người cả giai đoạn", summary.nShort > 0)}
            {tile("Thiếu bình quân mỗi tuần", `${f0(summary.avg)} người`,
              capAll > 0 ? `${Math.round((summary.avg / capAll) * 100)}% quân số ${f0(capAll)} người` : "", summary.avg > 0.001)}
            {tile("Đỉnh thiếu", `${f0(summary.peak)} người`,
              summary.peak > 0.001 ? `T${summary.peakW.m} tuần ${summary.peakW.w}` : "không có tuần nào thiếu", summary.peak > 0.001)}
            {summary.byRole[0] && summary.byRole[0].tot > 0.001
              ? tile("Thiếu nhiều nhất", `${summary.byRole[0].r.id} · ${f0(summary.byRole[0].tot)}`,
                `người-tuần · đỉnh ${f0(summary.byRole[0].peak)} người`, true)
              : tile("Thiếu nhiều nhất", "—", "không vai trò nào thiếu", false)}
          </div>
          {summary.spare.length > 0 && (
            <div className="mt-2 text-[12px] text-slate-400">
              {summary.spare.map((o, k) => (
                <span key={o.r.id}>
                  {k > 0 && <span className="text-slate-600"> · </span>}
                  <span className="text-slate-200">{o.r.id} dư {o.a === o.b ? f0(o.a) : `${f0(o.a)}–${f0(o.b)}`} người</span>
                  {" "}· {o.n}/{view.length} tuần · từ T{o.from.m} tuần {o.from.w}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* chip vai trò — mang luôn đỉnh thiếu, xếp theo mức nghẽn; lọc đồng bộ cả bốn khối */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-3 py-2.5 md:px-4">
        {shown.map((r) => {
          const on = !off.has(r.id);
          const pk = Math.max(0, ...view.map((w) => -gapOf(r.id, w.i)));
          return (
            <button key={r.id} onClick={() => setOff((s) => { const t = new Set(s); t.has(r.id) ? t.delete(r.id) : t.add(r.id); return t; })}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${on ? "border-slate-700 text-slate-300" : "border-slate-800 text-slate-600"}`}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf.get(r.id), opacity: on ? 1 : 0.3 }} />
              <span className="font-mono">{r.id}</span>
              <span className={`font-mono ${on && pk > 0.001 ? "text-rose-400" : "text-slate-600"}`}>
                {pk > 0.001 ? `▲${f0(pk)}` : "đủ"}
              </span>
            </button>
          );
        })}
      </div>

      {/* items-start: cột trái không bị kéo giãn theo cột phải, nhờ vậy phép đo chiều cao không lặp vô hạn */}
      <div className="grid items-start gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div ref={leftRef} className="min-w-0 xl:border-r xl:border-slate-800">
          {/* biểu đồ — vẽ đúng bề ngang đo được, không để viewBox phóng to chữ */}
          <div className="min-w-0 p-3 md:p-4">
            <div ref={wrapRef} className="min-w-0">
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                {ticks}
                {wkLabels}
                {bars}
                <line x1={L} y1={mid} x2={W - R} y2={mid} stroke={axis} strokeWidth="1.3" />
              </svg>
            </div>
          </div>

          {/* v12.26 — bảng dự án chiếm vai trò đang thiếu, xếp hạng cho cả giai đoạn */}
          <div className="border-t border-slate-800">
            <div className="grid grid-cols-[minmax(0,1fr)_90px] items-baseline gap-3 border-b border-slate-800 px-3 py-2 text-[10.5px] uppercase tracking-wider text-slate-500 md:grid-cols-[230px_minmax(0,1fr)_84px_minmax(0,1fr)] md:px-4">
              <span>Dự án chiếm vai trò đang thiếu</span>
              <span className="hidden md:block">theo vai trò</span>
              <span className="text-right">người-tuần</span>
              <span className="hidden md:block">từng tuần</span>
            </div>
            {projRows.length === 0 ? (
              <p className="px-3 py-6 text-sm text-slate-500 md:px-4">
                {summary && summary.nShort === 0 ? "Giai đoạn này không vai trò nào thiếu người." : "Không có dự án nào đặt người vào vai trò đang thiếu."}
              </p>
            ) : projRows.map((o) => (
              <div key={o.p.id} onClick={() => setSelP(selP === o.p.id ? null : o.p.id)}
                className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_90px] items-center gap-3 border-b border-slate-800/60 px-3 py-1.5 text-[12.5px] last:border-b-0 md:grid-cols-[230px_minmax(0,1fr)_84px_minmax(0,1fr)] md:px-4 ${selP === o.p.id ? "bg-teal-950/40" : "hover:bg-slate-900/60"}`}>
                <span className="truncate text-slate-200">
                  {o.p.name}
                  {o.p.code && <span className="ml-1.5 font-mono text-[11px] text-slate-600">{o.p.code}</span>}
                </span>
                <span className="hidden h-3.5 overflow-hidden rounded-sm bg-slate-950 md:flex">
                  {live.filter((r) => o.byRole.get(r.id)).map((r) => (
                    <span key={r.id} title={`${r.id}: ${f0(o.byRole.get(r.id))}`}
                      style={{ width: `${(o.byRole.get(r.id) / projMax) * 100}%`, background: colorOf.get(r.id) }} />
                  ))}
                </span>
                <span className="text-right font-mono text-slate-200">{f0(o.tot)}</span>
                <span className="hidden gap-[2px] md:flex">
                  {view.map((w) => {
                    const v = o.byWeek.get(w.i) || 0;
                    return <span key={w.i} title={`T${w.m} tuần ${w.w}: ${f0(v)}`} className="h-3.5 flex-1 rounded-[2px]"
                      style={{ background: v ? `rgba(248,113,113,${0.18 + 0.82 * (v / weekMax)})` : (isLight() ? "#e2e8f0" : "#111a2e") }} />;
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* chi tiết tuần đang soi — cao bằng cột trái, cuộn bên trong */}
        <div className="overflow-y-auto border-t border-slate-800 bg-slate-950/40 p-3 md:p-4 xl:border-t-0"
          style={leftH ? { maxHeight: leftH } : undefined}>
          <div className="text-sm text-slate-200">T{selW?.m} · tuần {selW?.w}</div>
          <div className="mb-3 mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-rose-950/50 px-3 py-2">
              <div className="font-mono text-lg text-rose-300">{f0(shortAt(sel, live))}</div>
              <div className="text-[10.5px] text-slate-500">người thiếu</div>
            </div>
            <div className="rounded-lg bg-slate-800/50 px-3 py-2">
              <div className="font-mono text-lg text-slate-300">{f0(freeAt(sel, live))}</div>
              <div className="text-[10.5px] text-slate-500">người dư</div>
            </div>
          </div>
          {shortRows.length === 0 && <div className="border-t border-slate-800 py-2 text-[12px] text-slate-500">Tuần này không vai trò nào thiếu người.</div>}
          {/* v12.26 — gom theo từng vai trò thiếu: mã vai trò không còn lặp ở mỗi dòng dự án */}
          {shortRows.map((o) => (
            <div key={o.r.id} className="border-t border-slate-800 pb-1.5 pt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono" style={{ color: colorOf.get(o.r.id) }}>{o.r.id}</span>
                <span className="truncate text-slate-500">{o.r.name}</span>
                <span className="ml-auto whitespace-nowrap font-mono text-rose-400">thiếu {f0(-o.g)}</span>
              </div>
              <div className="mb-1 mt-0.5 text-[11.5px] text-slate-500">
                cần {f0(o.need)} / có {f0(o.c)}{o.pct != null && ` · thiếu ${o.pct}% quân số`}
              </div>
              {projects.map((p) => ({ p, v: cellOf(plan, p.id, o.r.id, sel) })).filter((x) => x.v > 0)
                .sort((a, b) => b.v - a.v).map((x) => (
                  <div key={x.p.id} className="grid grid-cols-[minmax(0,1fr)_48px] gap-2 py-0.5 pl-3 text-[12px]">
                    <span className="truncate text-slate-300">
                      {x.p.name}
                      {x.p.code && <span className="ml-1.5 font-mono text-[11px] text-slate-600">{x.p.code}</span>}
                    </span>
                    <span className="text-right font-mono text-slate-300">{f0(x.v)}</span>
                  </div>
                ))}
            </div>
          ))}
          {spareRows.length > 0 && (
            <div className="border-t border-slate-800 py-2 text-[12px] text-slate-400">
              Dư: {spareRows.map((o) => `${o.r.id} ${f0(o.g)}`).join(" · ")}
            </div>
          )}
          {evenRows.length > 0 && (
            <div className="border-t border-slate-800 py-2 text-[12px] text-slate-500">
              Vừa đủ: {evenRows.map((o) => o.r.id).join(" · ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
