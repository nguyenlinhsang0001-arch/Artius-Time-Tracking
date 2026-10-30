/* ARTIUS TIME v12.2 — Lưới nhập kế hoạch nguồn lực, cả năm trên một bảng cuộn ngang.

   Bố cục: MỘT cột khoá cứng duy nhất, rộng cố định (kéo mép tiêu đề để đổi), chứa cả tên dự án lẫn vai trò.
   Bề ngang cột khoá và cột tuần đều đặt cứng, tên dài cắt gọn một dòng (rê chuột xem đủ).

   v12.29 — núm kéo điền ở góc ô đang chọn; chế độ focus (dùng cho "Từng dự án").
   v12.30 — giao diện theo html mẫu đã duyệt:
     · ô nền trắng, ô trống để trống, vai trò có chấm màu và ghi đủ tên, dòng dự án nền xám nhạt kèm khoảng tuần
     · khối "TOÀN CÔNG TY · CÒN" dính đáy ngay trong lưới, mỗi vai trò đúng một dòng (bỏ dòng "cần", bỏ bảng tổng riêng, bỏ dải dính đáy)
     · bỏ thanh nhập nhanh; "Về tuần này" chuyển lên hàng công cụ (ResourcePlan phát sự kiện artius:planNow)
   Màu đặt bằng biến CSS riêng của lưới (.pgx), có bộ sáng dưới html[data-theme=light] — không phụ thuộc LIGHT_CSS.
   v12.31 — dòng dự án to ×1,2; tên vai trò mờ 80%; tuần hiện tại đậm hơn ở mode sáng; ô CÒN tô màu theo mức xanh / vàng / đỏ.
   v12.33 — thang màu ô CÒN chỉ còn 3 loại: −0,5 → 0,5 không tô · trên 0,5 xanh lá đậm dần · dưới −0,5 đỏ đậm dần (đậm nhất từ ±3).
   v12.32 — vàng mode tối: nền vàng trong #3f3a17 (vàng ~22% trên nền tối), chữ #fde047.
   Phím tắt giữ nguyên: + / − tăng giảm 0,25, Ctrl + D, Ctrl + C / V, Shift + mũi tên, Delete. */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { moveInList, sortByProjOrder } from "../../shared/rowDrag.jsx";
import { cellOf, leftOf, needOf, setCell, setMany } from "./planCalc.js";

const FRZ = 250;   // bề ngang mặc định của cột khoá cứng; kéo ở mép tiêu đề để đổi (150–520), nhớ riêng từng máy
const FRZ_MIN = 150, FRZ_MAX = 520, FRZ_KEY = "artius:planFrz";
const readFrz = () => { try { const v = Number(localStorage.getItem(FRZ_KEY)); return v >= FRZ_MIN && v <= FRZ_MAX ? v : FRZ; } catch { return FRZ; } };
const CW = 40;     // bề ngang mỗi cột tuần
const RH = 24;     // chiều cao mỗi dòng của khối CÒN dính đáy (dùng để cộng dồn bottom)
const STEP_Q = 0.25;   // bước tăng / giảm của phím + / −
const f = (n) => (!n ? "" : String(+Number(n).toFixed(2)).replace(".", ","));
const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");
const parse = (s) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? Math.min(v, 99) : 0;
};
/* màu vai trò theo thứ tự trong Thiết lập — một vai trò luôn giữ một màu */
const PALETTE = ["#14b8a6", "#f59e0b", "#6366f1", "#ec4899", "#0ea5e9", "#84cc16", "#f43f5e",
  "#a855f7", "#eab308", "#3b82f6", "#fb923c", "#22c55e", "#d946ef", "#2dd4bf", "#94a3b8"];
const wShort = (w) => (w ? `T${w.m}·${w.w}` : "");

const CSS = `
.pgx{--card:#0f172a;--line:#1e293b;--line2:#111a2e;--ink:#e2e8f0;--ink2:#cbd5e1;--ink3:#94a3b8;--ink4:#64748b;
  --teal:#5eead4;--tealbg:#042f2e;--red:#f87171;--redbg:#450a0a;--cell:#0b1220;--past:#0a0f1c;--now:#0b2a2a;--flash:#14532d;--hover:#111a2e;
  --g0:#14361f;--g1:#16a34a;--gt:#bbf7d0;--r0:#3b1212;--r1:#dc2626;--rt:#fecaca}
html[data-theme="light"] .pgx{--card:#ffffff;--line:#e2e8f0;--line2:#f1f5f9;--ink:#0f172a;--ink2:#334155;--ink3:#64748b;--ink4:#94a3b8;
  --teal:#0f766e;--tealbg:#f0fdfa;--red:#dc2626;--redbg:#fef2f2;--cell:#ffffff;--past:#f8fafc;--now:#ccfbf1;--flash:#bbf7d0;--hover:#f8fafc;
  --g0:#dcfce7;--g1:#15803d;--gt:#166534;--r0:#fee2e2;--r1:#b91c1c;--rt:#991b1b}
.pgx{background:var(--card);color:var(--ink)}
.pgx .pg-wrap{position:relative;overflow:auto;max-height:72vh}
.pgx table{border-collapse:separate;border-spacing:0;font-size:12px;table-layout:fixed}
.pgx th,.pgx td{padding:0}
.pgx .fz{position:sticky;left:0;z-index:2;background:var(--card);text-align:left;border-right:1px solid var(--line)}
.pgx .fzi{width:var(--frz);padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px}
.pgx thead th{position:sticky;background:var(--card);z-index:3}
.pgx thead tr:first-child th{top:0;height:24px}.pgx thead tr:nth-child(2) th{top:24px;height:22px}
.pgx thead th.fz{z-index:4}
.pgx .hd{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);font-weight:500}
.pgx .mh{font-size:11px;color:var(--teal);font-weight:500;text-align:left;padding-left:6px;border-left:1px solid var(--line);white-space:nowrap;overflow:hidden}
.pgx .mh.yr{border-left:2px solid var(--teal)}
.pgx .wh{font-size:10px;color:var(--ink4);font-weight:400;text-align:center;border-bottom:1px solid var(--line)}
.pgx .wh.now{color:var(--teal);font-weight:600;background:var(--now)}
html[data-theme="light"] .pgx .wh.now{background:var(--teal);color:#fff}
.pgx .ms{border-left:1px dashed var(--line)}
.pgx tr.ph td{background:var(--line2);height:34px;border-top:1px solid var(--line)}
.pgx tr.ph td.fz{background:var(--line2)}
.pgx .pn{font-size:15px;color:var(--ink);overflow:hidden;text-overflow:ellipsis}
.pgx tr.ph.off .pn{color:var(--ink4);text-decoration:line-through}
.pgx .code{font-size:12.5px;color:var(--ink4);margin-left:6px;font-variant-numeric:tabular-nums}
.pgx .phr{font-size:13px;color:var(--ink3);padding-left:8px;white-space:nowrap}
.pgx .rl{height:30px;font-size:12px;color:var(--ink2)}
.pgx .rdot{display:inline-block;flex:none;width:9px;height:9px;border-radius:2px;margin-right:4px}
.pgx .rn{color:var(--ink3)}
.pgx .rlab{opacity:.8;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgx td.c{height:30px;background:var(--cell);border-bottom:1px solid var(--line2)}
.pgx td.c.past{background:var(--past)}
.pgx td.c.nowc{background:var(--now)}
.pgx td.c.out .ci{color:var(--ink4)}
.pgx td.c.fl{animation:pgfl .9s ease-out}
@keyframes pgfl{0%{background:var(--flash)}100%{}}
.pgx .ci{display:block;width:100%;height:29px;border:0;background:transparent;text-align:center;color:var(--ink);font-size:12px;font-family:inherit;outline:none;padding:0}
.pgx .ci:focus{background:var(--tealbg);box-shadow:inset 0 0 0 1.5px var(--teal)}
.pgx .ib{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:5px;border:1px solid var(--line);color:var(--ink3);background:transparent;position:relative;cursor:pointer}
.pgx .ib:hover{border-color:var(--teal);color:var(--teal)}
.pgx .ib.warn{color:#f59e0b}
.pgx .ib select{position:absolute;inset:0;opacity:0;cursor:pointer}
.pgx .grip{display:inline-flex;flex:none;width:12px;justify-content:center;color:var(--ink4);cursor:grab;touch-action:none}
.pgx .grip:hover{color:var(--ink2)}
.pgx .del{flex:none;margin-left:4px;color:var(--ink4);opacity:.35;background:none;border:0;cursor:pointer;padding:0;display:inline-flex}
.pgx tr:hover .del{opacity:1}.pgx .del:hover{color:var(--red)}
.pgx tfoot td{position:sticky;z-index:2;height:${RH}px;background:var(--card)}
.pgx tfoot td.fz{z-index:3}
.pgx tr.gsep td{background:var(--line2);box-shadow:inset 0 2px 0 var(--line)}
.pgx .gtl{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
.pgx .lc{text-align:center;font-size:11px;color:var(--ink3);font-variant-numeric:tabular-nums}
.pgx .lc.g{background:color-mix(in srgb,var(--g1) calc(var(--t) * 100%),var(--g0));color:var(--gt)}
.pgx .lc.r{background:color-mix(in srgb,var(--r1) calc(var(--t) * 100%),var(--r0));color:var(--rt);font-weight:600}
.pgx .lc.dk{color:#fff}
.pgx tr.crow td{height:22px;border-bottom:1px solid var(--line);background:var(--card)}
.pgx .cl{font-size:10.5px;color:var(--ink4);padding-left:26px}
.pgx .pg-knob{position:absolute;z-index:1;width:9px;height:9px;background:var(--teal);border:2px solid var(--card);border-radius:2px;cursor:ew-resize;touch-action:none;box-sizing:content-box}
.pgx .pg-sel{position:absolute;z-index:1;pointer-events:none;border:2px solid var(--teal);border-radius:2px;background:color-mix(in srgb,var(--teal) 10%,transparent)}
.pgx .pg-prev{position:absolute;z-index:1;pointer-events:none;border:2px dashed var(--teal);border-radius:2px}
.pgx .rsz{position:absolute;right:0;top:0;height:100%;width:6px;cursor:col-resize;touch-action:none;border-right:2px solid var(--line)}
.pgx .rsz:hover{border-right-color:var(--teal)}
.pgx .pg-foot{padding:9px 16px;border-top:1px solid var(--line);font-size:11.5px;color:var(--ink4)}
.pgx tr[data-drop=before]>td{box-shadow:inset 0 2px 0 #2dd4bf}.pgx tr[data-drop=after]>td{box-shadow:inset 0 -2px 0 #2dd4bf}.pgx tr[data-dragging]{opacity:.4}
`;

/* thứ tự vai trò trong từng dự án do người dùng kéo thả — lưu riêng từng máy (như thứ tự dự án), không đụng dữ liệu kế hoạch */
const ORD_KEY = "artius:planRoleOrder";
const PORD_KEY = "artius:planProjOrder";   // thứ tự dự án trên lưới Kế hoạch (riêng từng máy, không đụng thứ tự ở tab Dự án)
const readPOrd = () => { try { const a = JSON.parse(localStorage.getItem(PORD_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
const readOrd = () => { try { const o = JSON.parse(localStorage.getItem(ORD_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } };
const sortRoles = (rws, ord) => {
  if (!ord?.length) return rws;
  const ix = new Map(ord.map((id, i) => [id, i]));
  return rws.map((r, i) => [r, i]).sort((a, b) => (ix.get(a[0].id) ?? 1e9 + a[1]) - (ix.get(b[0].id) ?? 1e9 + b[1])).map((x) => x[0]);
};
const spanOf = (byR) => {
  let a = Infinity, b = -1;
  for (const arr of Object.values(byR || {})) (arr || []).forEach((v, i) => { if (Number(v) > 0) { if (i < a) a = i; if (i > b) b = i; } });
  return b < 0 ? null : { a, b };
};

/* ô nhập: giữ chữ đang gõ riêng (để gõ được "0," rồi "0,5"), chỉ đẩy số đã hiểu lên lưới */
const Cell = ({ r, k, v, readOnly, onType, onFocus }) => {
  const [txt, setTxt] = useState(null);
  /* số trong ô đổi từ nơi khác (dán, điền vùng, Ctrl + D) thì bỏ chữ đang giữ để hiện số mới */
  useEffect(() => { if (txt !== null && parse(txt) !== v) setTxt(null); }, [v]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input data-cell data-row={r} data-col={k} readOnly={readOnly} inputMode="decimal" className="ci"
      value={txt ?? f(v)}
      onFocus={(e) => { onFocus(); e.target.select(); }}
      onBlur={() => setTxt(null)}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,]/g, "");
        setTxt(t); onType(parse(t));
      }} />
  );
};

/* một dòng dự án × vai trò — chỉ vẽ lại khi mảng số của chính nó đổi */
const Row = React.memo(function Row({ r, pid, rid, name, color, values, weeks, nowIndex, readOnly, onCell, onFocus, onDrop, dnd, flash, span }) {
  const dropProps = readOnly ? {} : {
    onDragOver: (e) => dnd.over(e, pid, rid),
    onDragLeave: (e) => e.currentTarget.removeAttribute("data-drop"),
    onDrop: (e) => dnd.drop(e, pid, rid),
  };
  return (
    <tr {...dropProps}>
      <td className="fz rl">
        <div className="fzi" title={`${rid} · ${name}`}>
          {readOnly ? <span style={{ width: 12 }} /> : (
            <span draggable onDragStart={(e) => dnd.start(e, pid, rid)} onDragEnd={dnd.end}
              title="Giữ và kéo để đổi vị trí vai trò trong dự án" className="grip">
              <GripVertical size={12} />
            </span>
          )}
          <span className="rdot" style={{ background: color }} />
          <span className="rlab">{rid} <span className="rn">{name}</span></span>
          {!readOnly && (
            <button type="button" title="Bỏ vai trò này khỏi dự án" onClick={() => onDrop(pid, rid)} className="del"><Trash2 size={11} /></button>
          )}
        </div>
      </td>
      {weeks.map((w, k) => {
        const v = Number(values?.[w.i]) || 0;
        const cls = ["c"];
        if (w.i === nowIndex) cls.push("nowc"); else if (nowIndex >= 0 && w.i < nowIndex) cls.push("past");
        if (w.ms && k > 0) cls.push("ms");
        if (span && (w.i < span.a || w.i > span.b)) cls.push("out");
        if (flash && w.i >= flash.a && w.i <= flash.b) cls.push("fl");
        return (
          <td key={w.i} className={cls.join(" ")}>
            <Cell r={r} k={k} v={v} readOnly={readOnly} onFocus={() => onFocus(rid, w.i, r, k)} onType={(x) => onCell(pid, rid, w.i, x, r, k)} />
          </td>
        );
      })}
    </tr>
  );
});

export function PlanGrid({ plan, onChange, projects: allProjects, hidden = new Set(), onToggleHide, totals, onTotals, mergedOf = new Map(), roles, weeks, nWeeks, cap, readOnly = false, nowIndex = -1, scrollKey,
  focus = false, scopePids }) {
  /* focus: lưới của MỘT dự án (chế độ Từng dự án) — scopePids là các dự án tính vào dòng CÒN toàn công ty */
  const wrap = useRef(null);
  const [order, setOrder] = useState(readOrd);
  const orderRef = useRef(order); orderRef.current = order;
  const drag = useRef(null);
  const [frz, setFrz] = useState(readFrz);
  const frzRef = useRef(frz); frzRef.current = frz;
  /* kéo mép phải của tiêu đề "Dự án · vai trò" để nới/thu cột tên */
  const startDrag = (e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = frzRef.current;
    const mv = (ev) => setFrz(Math.max(FRZ_MIN, Math.min(FRZ_MAX, Math.round(w0 + ev.clientX - x0))));
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      try { localStorage.setItem(FRZ_KEY, String(frzRef.current)); } catch { /* không lưu được: chỉ đổi cho phiên này */ }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const resetFrz = () => { setFrz(FRZ); try { localStorage.removeItem(FRZ_KEY); } catch { /* bỏ qua */ } };
  const nowCell = useRef(null);
  const planRef = useRef(plan); planRef.current = plan;
  const rolesRef = useRef(roles); rolesRef.current = roles;
  const changeRef = useRef(onChange); changeRef.current = onChange;

  /* thứ tự dự án do kéo thả; dự án tạm ẩn vẫn nằm trên lưới (thu gọn) nhưng KHÔNG tính vào các dòng CÒN */
  const [pOrder, setPOrder] = useState(readPOrd);
  const projects = useMemo(() => sortByProjOrder(allProjects, pOrder, (p) => p.id), [allProjects, pOrder]);
  const projectsRef = useRef(projects); projectsRef.current = projects;
  const ownPids = useMemo(() => projects.filter((p) => !hidden.has(p.id)).map((p) => p.id), [projects, hidden]);
  const pids = scopePids || ownPids;
  const colorOf = useMemo(() => new Map(roles.map((r, k) => [r.id, PALETTE[k % PALETTE.length]])), [roles]);
  const nCol = weeks.length;

  /* về tuần này: lúc đổi cặp năm, và khi bấm nút "Về tuần này" ở hàng công cụ */
  const toNow = useCallback(() => {
    const W = wrap.current; if (!W) return;
    const th = nowCell.current;
    if (!th) { W.scrollLeft = 0; return; }
    const wr = W.getBoundingClientRect(), r = th.getBoundingClientRect();
    W.scrollLeft += r.left - wr.left - frzRef.current - (W.clientWidth - frzRef.current) / 2 + r.width / 2;
  }, []);
  useEffect(() => { toNow(); }, [scrollKey, toNow]);
  useEffect(() => {
    window.addEventListener("artius:planNow", toNow);
    return () => window.removeEventListener("artius:planNow", toNow);
  }, [toNow]);

  /* ---------- chọn nhiều ô (kéo chuột / Shift + mũi tên / Shift + bấm) ----------
     sel = { a: ô neo (ô đang gõ), f: góc kia }. Vùng chọn vẽ bằng MỘT khung phủ lên lưới,
     không tô từng ô, nên đổi vùng chọn không làm vẽ lại cả nghìn ô nhập. */
  const [sel, setSel] = useState(null);
  const selRef = useRef(sel); selRef.current = sel;
  const rowsRef = useRef([]);                 // các dòng đang hiện, đúng thứ tự: [{ pid, rid }]
  const weeksRef = useRef(weeks); weeksRef.current = weeks;
  const dragSel = useRef(false);
  const keepSel = useRef(false);
  const box = (s) => s && { r0: Math.min(s.a.r, s.f.r), r1: Math.max(s.a.r, s.f.r), c0: Math.min(s.a.c, s.f.c), c1: Math.max(s.a.c, s.f.c) };
  const isMulti = (s) => !!s && (s.a.r !== s.f.r || s.a.c !== s.f.c);
  const valAt = (r, c) => { const row = rowsRef.current[r]; return row ? cellOf(planRef.current, row.pid, row.rid, weeksRef.current[c].i) : 0; };
  const itemsOf = (b, fn) => {
    const out = [];
    for (let r = b.r0; r <= b.r1; r++) {
      const row = rowsRef.current[r]; if (!row) continue;
      for (let c = b.c0; c <= b.c1; c++) if (weeksRef.current[c]) out.push({ pid: row.pid, rid: row.rid, wi: weeksRef.current[c].i, v: fn(r, c) });
    }
    return out;
  };
  const applyMany = (items) => { if (items.length) changeRef.current(setMany(planRef.current, items, nWeeks)); };

  const onCell = useCallback((pid, rid, wi, v, r, c) => {
    const s = selRef.current;
    if (isMulti(s)) {   // đang chọn nhiều ô mà gõ vào trong vùng → điền cả vùng một lượt
      const b = box(s);
      if (r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1) { applyMany(itemsOf(b, () => v)); return; }
    }
    changeRef.current(setCell(planRef.current, pid, rid, wi, v, nWeeks));
  }, [nWeeks]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* Ctrl + D giống Excel: chọn một dòng → lấy số của dòng ngay trên; chọn nhiều dòng → dòng đầu vùng chép xuống các dòng dưới */
  const fillDown = () => {
    const s = selRef.current; if (!s) return;
    const b = box(s);
    if (b.r0 === b.r1) { if (b.r0 > 0) applyMany(itemsOf(b, (r, c) => valAt(b.r0 - 1, c))); }
    else applyMany(itemsOf({ ...b, r0: b.r0 + 1 }, (r, c) => valAt(b.r0, c)));
  };
  const tsvOf = (b) => {
    const lines = [];
    for (let r = b.r0; r <= b.r1; r++) {
      const cells = [];
      for (let c = b.c0; c <= b.c1; c++) { const v = valAt(r, c); cells.push(v ? f0(v) : ""); }
      lines.push(cells.join("\t"));
    }
    return lines.join("\n");
  };
  const onCopy = (e) => {
    if (!e.target.closest?.("input[data-cell]") || !selRef.current) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", tsvOf(box(selRef.current)));
  };
  const onCut = (e) => {
    if (readOnly) return;
    onCopy(e);
    if (selRef.current) applyMany(itemsOf(box(selRef.current), () => 0));
  };
  const onPaste = (e) => {
    if (readOnly || !e.target.closest?.("input[data-cell]") || !selRef.current) return;
    const text = e.clipboardData.getData("text/plain");
    if (text == null || text === "") return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    const grid = lines.map((l) => l.split("\t"));
    const s = selRef.current, b = box(s);
    if (grid.length === 1 && grid[0].length === 1 && isMulti(s)) {   // một số dán vào cả vùng đang chọn
      const v = parse(grid[0][0]); applyMany(itemsOf(b, () => v)); return;
    }
    const nR = rowsRef.current.length;
    const r1 = Math.min(nR - 1, b.r0 + grid.length - 1);
    const c1 = Math.min(nCol - 1, b.c0 + Math.max(...grid.map((x) => x.length)) - 1);
    applyMany(itemsOf({ r0: b.r0, r1, c0: b.c0, c1 }, (r, c) => parse(grid[r - b.r0]?.[c - b.c0] ?? "")));
    keepSel.current = true; setSel({ a: { r: b.r0, c: b.c0 }, f: { r: r1, c: c1 } });
    setTimeout(() => { keepSel.current = false; }, 0);
  };
  const cellAt = (t) => { const el = t?.closest?.("input[data-cell]"); return el ? { el, r: Number(el.dataset.row), c: Number(el.dataset.col) } : null; };
  const onPointerDown = (e) => {
    const x = cellAt(e.target); if (!x || e.button !== 0) return;
    if (e.shiftKey && selRef.current) {   // Shift + bấm: kéo dài vùng từ ô neo
      e.preventDefault();
      setSel({ a: selRef.current.a, f: { r: x.r, c: x.c } });
      return;
    }
    dragSel.current = true;
    setSel({ a: { r: x.r, c: x.c }, f: { r: x.r, c: x.c } });
    const up = () => { dragSel.current = false; window.removeEventListener("pointerup", up); };
    window.addEventListener("pointerup", up);
  };
  const onPointerOver = (e) => {
    if (!dragSel.current) return;
    const x = cellAt(e.target); if (!x) return;
    const s = selRef.current;
    if (s && (s.f.r !== x.r || s.f.c !== x.c)) setSel({ a: s.a, f: { r: x.r, c: x.c } });
  };

  /* đo khung theo hai ô góc (toạ độ trong vùng cuộn) */
  const rectOf = (r0, c0, r1, c1) => {
    const W = wrap.current; if (!W) return null;
    const q = (r, c) => W.querySelector(`input[data-row="${r}"][data-col="${c}"]`)?.closest("td");
    const A = q(r0, c0), B = q(r1, c1);
    if (!A || !B) return null;
    const wr = W.getBoundingClientRect(), ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    return { left: ra.left - wr.left + W.scrollLeft, top: ra.top - wr.top + W.scrollTop, width: rb.right - ra.left, height: rb.bottom - ra.top };
  };
  /* khung phủ vùng chọn */
  const [ov, setOv] = useState(null);
  useLayoutEffect(() => {
    if (!isMulti(sel)) { setOv(null); return; }
    const b = box(sel);
    setOv(rectOf(b.r0, b.c0, b.r1, b.c1));
  }, [sel, frz]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- ô vừa kéo điền sáng lên một nhịp ---------- */
  const [flash, setFlash] = useState(null);   // { pid, rid, a, b } theo chỉ số tuần w.i
  const flashT = useRef(0);
  const lightUp = (pid, rid, a, b) => {
    clearTimeout(flashT.current);
    setFlash({ pid, rid, a, b });
    flashT.current = setTimeout(() => setFlash(null), 900);
  };
  useEffect(() => () => clearTimeout(flashT.current), []);

  /* ---------- núm kéo điền ----------
     Bấm một ô → núm nhỏ ở góc phải dưới. Kéo núm sang ngang trên cùng dòng → số của ô đó chép cho cả đoạn. */
  const [fillPrev, setFillPrev] = useState(null);   // { r, c0, c1 } đang kéo
  const [knob, setKnob] = useState(null);
  const [prevBox, setPrevBox] = useState(null);
  useLayoutEffect(() => {
    if (readOnly || !sel || isMulti(sel) || fillPrev) { setKnob(null); return; }
    const R = rectOf(sel.a.r, sel.a.c, sel.a.r, sel.a.c);
    setKnob(R ? { left: R.left + R.width - 6, top: R.top + R.height - 6 } : null);
  }, [sel, frz, weeks, plan, fillPrev, readOnly]);   // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    setPrevBox(fillPrev ? rectOf(fillPrev.r, fillPrev.c0, fillPrev.r, fillPrev.c1) : null);
  }, [fillPrev]);   // eslint-disable-line react-hooks/exhaustive-deps
  const startFill = (e) => {
    const s = selRef.current; if (!s || readOnly) return;
    e.preventDefault(); e.stopPropagation();
    const r = s.a.r, c = s.a.c, v = valAt(r, c);
    let to = c;
    setFillPrev({ r, c0: c, c1: c });
    const mv = (ev) => {
      const W = wrap.current;
      if (W) {   // chạm mép thì tự cuộn ngang để kéo tiếp
        const wr = W.getBoundingClientRect();
        if (ev.clientX > wr.right - 24) W.scrollLeft += CW;
        else if (ev.clientX < wr.left + frzRef.current + 24) W.scrollLeft -= CW;
      }
      const x = cellAt(document.elementFromPoint(ev.clientX, ev.clientY));
      if (!x || x.r !== r || x.c === to) return;
      to = x.c;
      setFillPrev({ r, c0: Math.min(c, to), c1: Math.max(c, to) });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      setFillPrev(null);
      if (to === c) return;
      const c0 = Math.min(c, to), c1 = Math.max(c, to), row = rowsRef.current[r];
      applyMany(itemsOf({ r0: r, r1: r, c0, c1 }, () => v));
      if (row) lightUp(row.pid, row.rid, weeksRef.current[c0].i, weeksRef.current[c1].i);
      setSel({ a: { r, c }, f: { r, c: to } });
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  /* kéo thả đổi vị trí vai trò — chỉ trong cùng một dự án */
  const dnd = useMemo(() => ({
    start: (e, pid, rid) => {
      drag.current = { pid, rid };
      e.dataTransfer.effectAllowed = "move";
      const tr = e.currentTarget.closest("tr");
      try { e.dataTransfer.setData("text/plain", rid); if (tr) { e.dataTransfer.setDragImage(tr, 20, 10); } } catch { /* bỏ qua */ }
      if (tr) setTimeout(() => tr.setAttribute("data-dragging", "1"), 0);
    },
    end: () => { drag.current = null; wrap.current?.querySelectorAll("[data-drop],[data-dragging]").forEach((n) => { n.removeAttribute("data-drop"); n.removeAttribute("data-dragging"); }); },
    over: (e, pid, rid) => {
      const d = drag.current; if (!d || d.pid !== pid || d.rid === rid) return;
      e.preventDefault();
      const tr = e.currentTarget, b = tr.getBoundingClientRect();
      const v = e.clientY > b.top + b.height / 2 ? "after" : "before";
      if (tr.getAttribute("data-drop") !== v) tr.setAttribute("data-drop", v);
    },
    drop: (e, pid, rid) => {
      const d = drag.current; if (!d || d.pid !== pid || d.rid === rid) return;
      e.preventDefault();
      const after = e.currentTarget.getAttribute("data-drop") === "after";
      const cur = planRef.current[pid] || {};
      const ids = sortRoles(rolesRef.current.filter((r) => r.id in cur), orderRef.current[pid]).map((r) => r.id);
      const next = { ...orderRef.current, [pid]: moveInList(ids, d.rid, rid, after) };
      setOrder(next);
      try { localStorage.setItem(ORD_KEY, JSON.stringify(next)); } catch { /* không lưu được: chỉ đổi cho phiên này */ }
      dnd.end();
    },
  }), []);  // eslint-disable-line react-hooks/exhaustive-deps
  /* kéo thả đổi vị trí dự án: cầm ⋮⋮ ở dòng tên dự án */
  const pdnd = {
    start: (e, pid) => {
      drag.current = { proj: pid };
      e.dataTransfer.effectAllowed = "move";
      const tr = e.currentTarget.closest("tr");
      try { e.dataTransfer.setData("text/plain", pid); if (tr) e.dataTransfer.setDragImage(tr, 20, 10); } catch { /* bỏ qua */ }
      if (tr) setTimeout(() => tr.setAttribute("data-dragging", "1"), 0);
    },
    over: (e, pid) => {
      const d = drag.current; if (!d?.proj || d.proj === pid) return;
      e.preventDefault();
      const tr = e.currentTarget, b = tr.getBoundingClientRect();
      const v = e.clientY > b.top + b.height / 2 ? "after" : "before";
      if (tr.getAttribute("data-drop") !== v) tr.setAttribute("data-drop", v);
    },
    drop: (e, pid) => {
      const d = drag.current; if (!d?.proj || d.proj === pid) return;
      e.preventDefault();
      const after = e.currentTarget.getAttribute("data-drop") === "after";
      const next = moveInList(projectsRef.current.map((p) => p.id), d.proj, pid, after);
      setPOrder(next);
      try { localStorage.setItem(PORD_KEY, JSON.stringify(next)); } catch { /* không lưu được: chỉ đổi cho phiên này */ }
      dnd.end();
    },
  };
  const onFocusCell = useCallback((rid, wi, r, c) => {
    if (!keepSel.current && !dragSel.current) setSel({ a: { r, c }, f: { r, c } });
  }, []);
  const onDrop = useCallback((pid, rid) => {
    const next = { ...planRef.current, [pid]: { ...(planRef.current[pid] || {}) } };
    delete next[pid][rid];
    changeRef.current(next);
  }, []);
  /* thêm vai trò = tạo một dòng toàn 0 để gõ. Lưu mà vẫn trống thì dòng tự biến mất (prunePlan). */
  const addRole = (pid, rid) => {
    if (!rid) return;
    const cur = planRef.current;
    const next = { ...cur, [pid]: { ...(cur[pid] || {}) } };
    if (!next[pid][rid]) next[pid][rid] = Array(nWeeks).fill(0);
    changeRef.current(next);
  };

  const onKey = (e) => {
    const el = e.target.closest("input[data-cell]"); if (!el) return;
    if (e.key === "Escape") { setSel(null); el.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {   // chặn luôn phím tắt đánh dấu trang của trình duyệt
      e.preventDefault();
      if (!readOnly) fillDown();
      return;
    }
    const s = selRef.current;
    /* phím + / − : tăng / giảm 0,25 người cho ô đang đứng hoặc cả vùng đang chọn (không âm, tối đa 99) */
    if (!readOnly && (e.key === "+" || e.key === "-") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const d = e.key === "+" ? STEP_Q : -STEP_Q;
      const b = s ? box(s) : { r0: Number(el.dataset.row), r1: Number(el.dataset.row), c0: Number(el.dataset.col), c1: Number(el.dataset.col) };
      applyMany(itemsOf(b, (r, c) => Math.max(0, Math.min(99, Math.round((valAt(r, c) + d) / STEP_Q) * STEP_Q))));
      return;
    }
    if (!readOnly && isMulti(s) && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault(); applyMany(itemsOf(box(s), () => 0)); return;
    }
    const DIR = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (e.shiftKey && e.key in DIR && s) {   // Shift + mũi tên: kéo dài vùng chọn, ô neo đứng yên
      e.preventDefault();
      const [dr, dc] = DIR[e.key];
      const f = { r: Math.max(0, Math.min(rowsRef.current.length - 1, s.f.r + dr)), c: Math.max(0, Math.min(nCol - 1, s.f.c + dc)) };
      setSel({ a: s.a, f });
      return;
    }
    const STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -nCol, ArrowDown: nCol, Enter: nCol };
    if (!(e.key in STEP)) return;
    const col = Number(el.dataset.col);
    if (e.key === "ArrowLeft" && col === 0) return;
    if (e.key === "ArrowRight" && col === nCol - 1) return;
    const all = [...wrap.current.querySelectorAll("input[data-cell]")];
    const t = all[all.indexOf(el) + STEP[e.key]];
    if (t) { e.preventDefault(); t.focus(); t.select(); }
  };

  /* thứ tự dòng đang hiện — dùng chung cho chọn vùng, dán, Ctrl + D */
  const rowList = [];
  const rowsOfProject = new Map();
  for (const p of projects) {
    if (hidden.has(p.id)) { rowsOfProject.set(p.id, []); continue; }   // dự án tạm ẩn: thu gọn, không có ô nhập
    const used = new Set(Object.keys(plan[p.id] || {}));
    const rws = sortRoles(roles.filter((r) => used.has(r.id)), order[p.id]);
    rowsOfProject.set(p.id, rws.map((r) => ({ r, idx: rowList.push({ pid: p.id, rid: r.id }) - 1 })));
  }
  rowsRef.current = rowList;

  /* khối TOÀN CÔNG TY · CÒN: vai trò tự hiện khi có người hoặc có nhu cầu; Admin thêm / ẩn / đổi thứ tự (thiết lập chung) */
  const tcfg = totals || {};
  const tHidden = new Set(tcfg.hidden || []), tAdded = new Set(tcfg.added || []);
  const totalRoles = focus ? [] : sortRoles(roles.filter((r) => !tHidden.has(r.id)
    && (tAdded.has(r.id) || (cap.get(r.id) || 0) > 0 || weeks.some((w) => needOf(plan, pids, r.id, w.i) > 0))), tcfg.order);
  const addableTot = roles.filter((r) => !totalRoles.some((x) => x.id === r.id));
  const canTot = !readOnly && !!onTotals;
  const hideTot = (rid) => onTotals({ ...tcfg, hidden: [...tHidden, rid], added: [...tAdded].filter((x) => x !== rid) });
  const addTot = (rid) => rid && onTotals({ ...tcfg, hidden: [...tHidden].filter((x) => x !== rid), added: [...new Set([...tAdded, rid])] });
  const tdnd = {
    start: (e, rid) => {
      drag.current = { tot: rid };
      e.dataTransfer.effectAllowed = "move";
      const tr = e.currentTarget.closest("tr");
      try { e.dataTransfer.setData("text/plain", rid); if (tr) e.dataTransfer.setDragImage(tr, 20, 10); } catch { /* bỏ qua */ }
      if (tr) setTimeout(() => tr.setAttribute("data-dragging", "1"), 0);
    },
    over: (e, rid) => {
      const d = drag.current; if (!d?.tot || d.tot === rid) return;
      e.preventDefault();
      const tr = e.currentTarget, b = tr.getBoundingClientRect();
      const v = e.clientY > b.top + b.height / 2 ? "after" : "before";
      if (tr.getAttribute("data-drop") !== v) tr.setAttribute("data-drop", v);
    },
    drop: (e, rid) => {
      const d = drag.current; if (!d?.tot || d.tot === rid) return;
      e.preventDefault();
      const after = e.currentTarget.getAttribute("data-drop") === "after";
      onTotals({ ...tcfg, order: moveInList(totalRoles.map((r) => r.id), d.tot, rid, after) });
      dnd.end();
    },
  };
  /* v12.33 — thang màu ô CÒN, đúng 3 loại:
       −0,5 → 0,5 không tô (nền theme)
       trên 0,5 xanh lá, chuyển sắc liên tục: 0,5 nhạt nhất → từ 3 trở lên đậm nhất
       dưới −0,5 đỏ, chuyển sắc liên tục: −0,5 nhạt nhất → từ −3 trở xuống đậm nhất · nền đậm thì chữ trắng */
  const lcCls = (lf) => {
    if (lf < -0.501) { const t = Math.min(1, (-lf - 0.5) / 2.5); return [`lc r${t >= 0.5 ? " dk" : ""}`, t]; }
    if (lf > 0.501) { const t = Math.min(1, (lf - 0.5) / 2.5); return [`lc g${t >= 0.5 ? " dk" : ""}`, t]; }
    return ["lc", 0];
  };
  const msCls = (w, k) => (w.ms && k > 0 ? " ms" : "");

  /* tiêu đề: hàng tháng (gộp ô theo tháng) và hàng tuần */
  const months = [];
  weeks.forEach((w, k) => {
    const last = months[months.length - 1];
    if (last && last.m === w.m && last.y === w.y) last.n++;
    else months.push({ m: w.m, y: w.y, n: 1, k, yr: k > 0 && weeks[k - 1].y !== w.y });
  });
  const focusSpan = focus && projects[0] ? spanOf(plan[projects[0].id]) : null;
  const nT = totalRoles.length;

  return (
    <div className="pgx">
      <style>{CSS}</style>
      <div ref={wrap} onKeyDown={onKey} onCopy={onCopy} onCut={onCut} onPaste={onPaste}
        onPointerDown={readOnly ? undefined : onPointerDown} onPointerOver={readOnly ? undefined : onPointerOver}
        className="pg-wrap" style={{ "--frz": `${frz}px` }}>
        <table style={{ width: frz + nCol * CW }}>
          <colgroup>
            <col style={{ width: frz }} />
            {weeks.map((w) => <col key={w.i} style={{ width: CW }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="fz hd" style={{ position: "sticky" }}>
                <div className="fzi">{focus ? "Vai trò" : "Dự án · vai trò"}</div>
                <span role="separator" aria-orientation="vertical" title="Kéo để nới / thu cột tên · bấm đúp để về mặc định"
                  onPointerDown={startDrag} onDoubleClick={resetFrz} className="rsz" />
              </th>
              {months.map((mo) => (
                <th key={`${mo.y}-${mo.m}`} colSpan={mo.n} className={`mh${mo.yr ? " yr" : ""}`} title={mo.yr ? `Từ đây là năm ${mo.y}` : undefined}>
                  T{mo.m}{mo.m === 1 || mo.k === 0 ? `·${String(mo.y).slice(2)}` : ""}
                </th>
              ))}
            </tr>
            <tr>
              <th className="fz" />
              {weeks.map((w, k) => {
                const isNow = w.i === nowIndex;
                return <th key={w.i} ref={isNow ? nowCell : null} title={isNow ? "Tuần này" : undefined}
                  className={`wh${isNow ? " now" : ""}${msCls(w, k)}`}>{w.w}</th>;
              })}
            </tr>
          </thead>

          <tbody>
            {projects.map((p) => {
              const used = new Set(Object.keys(plan[p.id] || {}));
              const rws = rowsOfProject.get(p.id) || [];
              const free = roles.filter((r) => !used.has(r.id));
              const off = hidden.has(p.id);
              const sp = spanOf(plan[p.id]);
              const spTxt = sp ? `${wShort(weeks.find((w) => w.i === sp.a) || { m: "?", w: "?" })} → ${wShort(weeks.find((w) => w.i === sp.b) || { m: "?", w: "?" })}` : "";
              return (
                <React.Fragment key={p.id}>
                  {!focus && (
                    <tr className={`ph${off ? " off" : ""}`}
                      {...(readOnly ? {} : { onDragOver: (e) => pdnd.over(e, p.id), onDragLeave: (e) => e.currentTarget.removeAttribute("data-drop"), onDrop: (e) => pdnd.drop(e, p.id) })}>
                      <td className="fz">
                        <div className="fzi" title={off ? `${p.name} — đang tạm ẩn, không tính vào CÒN` : `${p.name}${p.code ? ` · ${p.code}` : ""}`}>
                          {!readOnly && (
                            <span draggable onDragStart={(e) => pdnd.start(e, p.id)} onDragEnd={dnd.end}
                              title="Giữ và kéo để đổi vị trí dự án" className="grip"><GripVertical size={13} /></span>
                          )}
                          <span className="pn">{p.name}</span>{p.code && <span className="code">{p.code}</span>}
                          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
                            {!readOnly && !off && free.length > 0 && (
                              <span className="ib" title="Thêm vai trò">
                                <Plus size={13} />
                                <select value="" onChange={(e) => addRole(p.id, e.target.value)} aria-label={`Thêm vai trò cho ${p.name}`}>
                                  <option value="">Thêm vai trò…</option>
                                  {free.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                                </select>
                              </span>
                            )}
                            {!readOnly && onToggleHide && (
                              <button type="button" onClick={() => onToggleHide(p.id)}
                                title={off ? "Hiện lại và tính vào CÒN" : "Tạm ẩn — không tính dự án này vào CÒN"}
                                className={`ib${off ? " warn" : ""}`}>
                                {off ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            )}
                            {readOnly && off && <span className="ib warn"><EyeOff size={13} /></span>}
                          </span>
                        </div>
                      </td>
                      <td colSpan={nCol} className="phr">{spTxt}</td>
                    </tr>
                  )}
                  {rws.map(({ r, idx }) => (
                    <React.Fragment key={r.id}>
                      <Row r={idx} pid={p.id} rid={r.id} name={r.name} color={colorOf.get(r.id)} values={plan[p.id]?.[r.id]}
                        weeks={weeks} nowIndex={nowIndex} readOnly={readOnly}
                        onCell={onCell} onFocus={onFocusCell} onDrop={onDrop} dnd={dnd}
                        flash={flash && flash.pid === p.id && flash.rid === r.id ? flash : null}
                        span={focusSpan} />
                      {focus && (
                        <tr className="crow">
                          <td className="fz"><div className="fzi cl">CÒN toàn công ty · có {f0(cap.get(r.id) || 0)}</div></td>
                          {weeks.map((w, k) => {
                            const lf = leftOf(plan, pids, r.id, w.i, cap), [lc, t] = lcCls(lf);
                            return <td key={w.i} className={`${lc}${msCls(w, k)}`} style={{ "--t": t.toFixed(2) }}>{f0(lf)}</td>;
                          })}
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>

          {!focus && nT > 0 && (
            <tfoot>
              <tr className="gsep">
                <td className="fz" style={{ bottom: nT * RH }}>
                  <div className="fzi">
                    <span className="gtl">Toàn công ty · CÒN</span>
                    {canTot && addableTot.length > 0 && (
                      <span className="ib" style={{ marginLeft: "auto" }} title="Thêm / hiện lại vai trò">
                        <Plus size={13} />
                        <select value="" onChange={(e) => addTot(e.target.value)} aria-label="Thêm vai trò vào Toàn công ty · CÒN">
                          <option value="">Thêm vai trò…</option>
                          {addableTot.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}{tHidden.has(r.id) ? " (đang ẩn)" : ""}</option>)}
                        </select>
                      </span>
                    )}
                  </div>
                </td>
                <td colSpan={nCol} style={{ bottom: nT * RH }} />
              </tr>
              {totalRoles.map((r, k) => {
                const bt = { bottom: (nT - 1 - k) * RH };
                return (
                  <tr key={r.id}
                    {...(canTot ? { onDragOver: (e) => tdnd.over(e, r.id), onDragLeave: (e) => e.currentTarget.removeAttribute("data-drop"), onDrop: (e) => tdnd.drop(e, r.id) } : {})}>
                    <td className="fz" style={bt}>
                      <div className="fzi" title={`${r.id} · ${r.name}${mergedOf.get(r.id) ? ` (gộp ${mergedOf.get(r.id).join(", ")})` : ""}`}>
                        {canTot && (
                          <span draggable onDragStart={(e) => tdnd.start(e, r.id)} onDragEnd={dnd.end} title="Giữ và kéo để đổi vị trí dòng" className="grip">
                            <GripVertical size={12} />
                          </span>
                        )}
                        <span className="rdot" style={{ background: colorOf.get(r.id) }} />
                        <span style={{ color: "var(--ink2)" }}>{r.id}</span>
                        <span className="rn">· có {f0(cap.get(r.id) || 0)}</span>
                        {canTot && (
                          <button type="button" onClick={() => hideTot(r.id)} title="Ẩn vai trò này khỏi Toàn công ty · CÒN, Tổng quan và Excel"
                            className="del" style={{ marginLeft: "auto" }}><EyeOff size={12} /></button>
                        )}
                      </div>
                    </td>
                    {weeks.map((w, kk) => {
                      const lf = leftOf(plan, pids, r.id, w.i, cap), [lc, t] = lcCls(lf);
                      return <td key={w.i} className={`${lc}${msCls(w, kk)}`} style={{ ...bt, "--t": t.toFixed(2) }}>{f0(lf)}</td>;
                    })}
                  </tr>
                );
              })}
            </tfoot>
          )}
        </table>
        {ov && <div aria-hidden className="pg-sel" style={ov} />}
        {prevBox && <div aria-hidden className="pg-prev" style={prevBox} />}
        {knob && (
          <div role="button" aria-label="Kéo sang ngang để chép số này" title="Kéo sang ngang để chép số này" onPointerDown={startFill}
            className="pg-knob" style={{ left: knob.left, top: knob.top }} />
        )}
      </div>

      {!readOnly && (
        <div className="pg-foot">
          Mũi tên di chuyển · Enter xuống dòng · Esc nhả ô · kéo chuột hoặc Shift + mũi tên chọn nhiều ô, gõ số là điền cả vùng · Ctrl + C / Ctrl + V ·
          Ctrl + D lấy theo dòng trên · + / − tăng giảm 0,25 · Delete xoá vùng · kéo núm ở góc ô để chép sang ngang
        </div>
      )}
    </div>
  );
}
