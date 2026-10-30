/* ARTIUS TIME v12.2 — Lưới nhập kế hoạch nguồn lực, cả năm trên một bảng cuộn ngang.

   v12.29 — thêm:
     · thanh nhập nhanh: chọn dự án, vai trò, từ tuần, đến tuần, số người → Áp dụng (dự án chưa có vai trò đó thì tự thêm dòng)
     · núm kéo điền ở góc ô đang chọn: kéo sang ngang trên cùng dòng để chép số đó cho cả đoạn
     · chế độ focus (dùng cho "Từng dự án"): một dự án, các tuần dự án chạy, dòng CÒN toàn công ty dưới mỗi vai trò
   Mọi phím tắt cũ giữ nguyên: + / − tăng giảm 0,25, Ctrl + D, Ctrl + C / V, Shift + mũi tên, Delete.

   Bố cục: MỘT cột khoá cứng duy nhất, rộng cố định, chứa cả tên dự án lẫn mã vai trò.
   v12.1 dùng hai cột khoá cứng và neo cột thứ hai ở một con số đặt sẵn (left: 150px), trong khi bề ngang
   thật của cột thứ nhất lại do trình duyệt tự tính từ nội dung — tên dự án dài thì cột nở ra, tên ngắn thì
   co lại. Hai con số đó gần như không bao giờ khớp, nên khi cuộn ngang sẽ hở một khoảng cho cột tuần lọt qua.
   Một cột thì không còn con số nào phải khớp với con số nào, nên lỗi đó không thể xảy ra nữa.

   Bề ngang cột khoá và cột tuần đều đặt cứng, tên dự án cắt gọn một dòng (rê chuột xem đủ) — nhờ vậy
   chiều cao mỗi dòng không đổi và màn hình laptop không bị tên dài đẩy cao gấp ba. */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { moveInList, sortByProjOrder } from "../../shared/rowDrag.jsx";
import { btnGhost, btnPrimary } from "../../core/ui.jsx";
import { isLight } from "../../core/theme.jsx";
import { cellOf, leftOf, needOf, setCell, setMany } from "./planCalc.js";

const FRZ = 230;   // bề ngang mặc định của cột khoá cứng; kéo ở mép tiêu đề để đổi (150–520), nhớ riêng từng máy
const FRZ_MIN = 150, FRZ_MAX = 520, FRZ_KEY = "artius:planFrz";
const readFrz = () => { try { const v = Number(localStorage.getItem(FRZ_KEY)); return v >= FRZ_MIN && v <= FRZ_MAX ? v : FRZ; } catch { return FRZ; } };
const CW = 38;     // bề ngang mỗi cột tuần (bảng đặt cố định để lưới nhập và bảng tổng thẳng cột)
const STEP_Q = 0.25;   // bước tăng / giảm của phím + / −
const f = (n) => (!n ? "" : String(+Number(n).toFixed(2)).replace(".", ","));
const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");
const parse = (s) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? Math.min(v, 99) : 0;
};

/* ô của cột khoá cứng — luôn đúng một bề ngang, nội dung dài thì cắt gọn */
const Frz = ({ children, cls = "", py = "py-0.5", title }) => (
  <div className={`truncate px-2 ${py} ${cls}`} style={{ width: "var(--frz, 230px)" }} title={title}>{children}</div>
);

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
/* vạch teal báo chỗ thả: bật bằng thuộc tính data-drop trên <tr> (không qua state nên kéo không làm vẽ lại cả lưới) */
const MO_CSS = ".mo{border-left:1px dashed #64748b!important}html[data-theme=light] .mo{border-left-color:#94a3b8!important}";
const DROP_CSS = "tr[data-drop=before]>td{box-shadow:inset 0 2px 0 #2dd4bf}tr[data-drop=after]>td{box-shadow:inset 0 -2px 0 #2dd4bf}tr[data-dragging]{opacity:.4}";

/* màu đặt thẳng bằng style không đi qua LIGHT_CSS nên phải tự chọn theo giao diện (App vẽ lại khi đổi Sáng/Tối) */
/* CÒN LẠI: đủ hoặc dư (≥ 0) xanh lá · thiếu tới 1 người vàng · thiếu hơn 1 người đỏ */
const leftStyle = (lf) => {
  if (lf >= -0.001) return isLight() ? { background: "#bbf7d0", color: "#14532d" } : { background: "#166534", color: "#dcfce7" };
  if (lf >= -1.001) return { background: "#fde68a", color: "#451a03" };
  return { background: "#f87171", color: "#450a0a" };
};
const stripBg = () => (isLight() ? "#ccfbf1" : "#041f1c");
const flashBg = () => (isLight() ? "#bbf7d0" : "#166534");
const KNOB = "#14b8a6";
const wLbl = (w) => `T${w.m} tuần ${w.w} · ${w.y}`;
const SEL_CLS = "h-11 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100";

/* ô nhập: giữ chữ đang gõ riêng (để gõ được "0," rồi "0,5"), chỉ đẩy số đã hiểu lên lưới */
const Cell = ({ r, k, v, readOnly, onType, onFocus }) => {
  const [txt, setTxt] = useState(null);
  /* số trong ô đổi từ nơi khác (dán, điền vùng, Ctrl + D) thì bỏ chữ đang giữ để hiện số mới */
  useEffect(() => { if (txt !== null && parse(txt) !== v) setTxt(null); }, [v]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input data-cell data-row={r} data-col={k} readOnly={readOnly} inputMode="decimal" placeholder="·"
      value={txt ?? f(v)}
      onFocus={(e) => { onFocus(); e.target.select(); }}
      onBlur={() => setTxt(null)}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,]/g, "");
        setTxt(t); onType(parse(t));
      }}
      className="w-full border-0 bg-transparent py-1 text-center font-mono text-[12px] text-slate-100 outline-none placeholder:text-slate-800 focus:rounded-sm focus:bg-teal-950 focus:ring-[1.5px] focus:ring-teal-500" />
  );
};

/* một dòng dự án × vai trò — chỉ vẽ lại khi mảng số của chính nó đổi */
const Row = React.memo(function Row({ r, pid, rid, label, name, values, weeks, nowIndex, readOnly, onCell, onFocus, onDrop, dnd, flash }) {
  const dropProps = readOnly ? {} : {
    onDragOver: (e) => dnd.over(e, pid, rid),
    onDragLeave: (e) => e.currentTarget.removeAttribute("data-drop"),
    onDrop: (e) => dnd.drop(e, pid, rid),
  };
  return (
    <tr className="border-b border-slate-900/70" {...dropProps}>
      <td className="sticky left-0 z-20 bg-slate-950 p-0">
        <Frz>
          {readOnly ? <span className="pl-4" /> : (
            <span draggable onDragStart={(e) => dnd.start(e, pid, rid)} onDragEnd={dnd.end}
              title="Giữ và kéo để đổi vị trí vai trò trong dự án"
              className="ml-1 mr-0.5 inline-flex w-3 cursor-grab touch-none items-center justify-center align-[-2px] text-slate-600 hover:text-slate-300 active:cursor-grabbing">
              <GripVertical size={12} />
            </span>
          )}
          <span className="font-mono text-slate-400">{label}</span>
          {name && <span className="text-slate-300"> {name}</span>}
          {!readOnly && (
            <button type="button" title="Bỏ vai trò này khỏi dự án" onClick={() => onDrop(pid, rid)}
              className="ml-1.5 align-middle text-slate-700 hover:text-rose-400"><Trash2 size={11} /></button>
          )}
        </Frz>
      </td>
      {weeks.map((w, k) => {
        const v = Number(values?.[w.i]) || 0;
        const past = nowIndex >= 0 && w.i < nowIndex;
        const lit = flash && w.i >= flash.a && w.i <= flash.b;   // vừa điền bằng thanh nhập nhanh / núm kéo
        return (
          <td key={w.i} style={{ minWidth: CW, transition: "background-color .6s", ...(lit ? { background: flashBg() } : v > 0.001 ? { background: `rgba(45,212,191,${(Math.min(v, 2) / 2 * 0.3 + 0.05).toFixed(2)})` } : null) }}
            className={`border-l border-slate-900 p-0 ${w.ms ? "mo" : ""} ${past ? "bg-slate-950/70" : ""}`}>
            <Cell r={r} k={k} v={v} readOnly={readOnly} onFocus={() => onFocus(rid, w.i, r, k)} onType={(x) => onCell(pid, rid, w.i, x, r, k)} />
          </td>
        );
      })}
    </tr>
  );
});

export function PlanGrid({ plan, onChange, projects: allProjects, hidden = new Set(), onToggleHide, totals, onTotals, mergedOf = new Map(), roles, weeks, nWeeks, cap, head, readOnly = false, nowIndex = -1, scrollKey,
  focus = false, scopePids, allWeeks }) {
  /* focus: lưới của MỘT dự án (chế độ Từng dự án) — scopePids là các dự án tính vào dòng CÒN toàn công ty, allWeeks là mọi tuần cho thanh nhập nhanh */
  const [active, setActive] = useState(null);     // { rid, wi }
  const wrap = useRef(null);
  const wrap2 = useRef(null);   // bảng Tổng toàn công ty (cuộn ngang đồng bộ với lưới nhập)
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

  /* thứ tự dự án do kéo thả; dự án tạm ẩn vẫn nằm trên lưới (thu gọn) nhưng KHÔNG tính vào các dòng tổng */
  const [pOrder, setPOrder] = useState(readPOrd);
  const pOrderRef = useRef(pOrder); pOrderRef.current = pOrder;
  const projects = useMemo(() => sortByProjOrder(allProjects, pOrder, (p) => p.id), [allProjects, pOrder]);
  const projectsRef = useRef(projects); projectsRef.current = projects;
  const ownPids = useMemo(() => projects.filter((p) => !hidden.has(p.id)).map((p) => p.id), [projects, hidden]);
  const pids = scopePids || ownPids;
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const nCol = weeks.length;

  useEffect(() => {
    if (nowCell.current) nowCell.current.scrollIntoView({ inline: "center", block: "nearest" });
    else if (wrap.current) wrap.current.scrollLeft = 0;
  }, [scrollKey]);

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

  /* khung phủ vùng chọn: đo theo hai ô góc */
  const [ov, setOv] = useState(null);
  useLayoutEffect(() => {
    const W = wrap.current;
    if (!W || !isMulti(sel)) { setOv(null); return; }
    const b = box(sel);
    const q = (r, c) => W.querySelector(`input[data-row="${r}"][data-col="${c}"]`)?.closest("td");
    const A = q(b.r0, b.c0), B = q(b.r1, b.c1);
    if (!A || !B) { setOv(null); return; }
    const wr = W.getBoundingClientRect(), ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    setOv({ left: ra.left - wr.left + W.scrollLeft, top: ra.top - wr.top + W.scrollTop, width: rb.right - ra.left, height: rb.bottom - ra.top });
  }, [sel, frz]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- v12.29 — ô vừa điền sáng lên một nhịp ---------- */
  const [flash, setFlash] = useState(null);   // { pid, rid, a, b } theo chỉ số tuần w.i
  const flashT = useRef(0);
  const lightUp = (pid, rid, a, b) => {
    clearTimeout(flashT.current);
    setFlash({ pid, rid, a, b });
    flashT.current = setTimeout(() => setFlash(null), 900);
  };
  useEffect(() => () => clearTimeout(flashT.current), []);

  /* ---------- v12.29 — núm kéo điền ----------
     Bấm một ô → núm nhỏ ở góc phải dưới. Kéo núm sang ngang trên cùng dòng → số của ô đó chép cho cả đoạn. */
  const [fillPrev, setFillPrev] = useState(null);   // { r, c0, c1 } đang kéo
  const [knob, setKnob] = useState(null);
  const [prevBox, setPrevBox] = useState(null);
  const rectOf = (r0, c0, r1, c1) => {
    const W = wrap.current; if (!W) return null;
    const q = (r, c) => W.querySelector(`input[data-row="${r}"][data-col="${c}"]`)?.closest("td");
    const A = q(r0, c0), B = q(r1, c1);
    if (!A || !B) return null;
    const wr = W.getBoundingClientRect(), ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    return { left: ra.left - wr.left + W.scrollLeft, top: ra.top - wr.top + W.scrollTop, width: rb.right - ra.left, height: rb.bottom - ra.top };
  };
  useLayoutEffect(() => {
    if (readOnly || !sel || isMulti(sel) || fillPrev) { setKnob(null); return; }
    const R = rectOf(sel.a.r, sel.a.c, sel.a.r, sel.a.c);
    setKnob(R ? { left: R.left + R.width - 5, top: R.top + R.height - 5 } : null);
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

  /* ---------- v12.29 — thanh nhập nhanh theo đoạn ---------- */
  const qWeeks = allWeeks || weeks;
  const qProjects = useMemo(() => projects.filter((p) => !hidden.has(p.id)), [projects, hidden]);
  const q0 = Math.max(0, qWeeks.findIndex((w) => w.i === nowIndex));
  const [qp, setQp] = useState(() => qProjects[0]?.id || "");
  const [qr, setQr] = useState(() => roles[0]?.id || "");
  const [qa, setQa] = useState(() => qWeeks[q0]?.i ?? 0);
  const [qb, setQb] = useState(() => qWeeks[Math.min(qWeeks.length - 1, q0 + 7)]?.i ?? 0);
  const [qv, setQv] = useState("1");
  const qPid = focus ? projects[0]?.id : (qProjects.some((p) => p.id === qp) ? qp : qProjects[0]?.id);
  const qRid = roles.some((r) => r.id === qr) ? qr : roles[0]?.id;
  const qN = Math.abs(qb - qa) + 1;
  const quickApply = (val) => {
    if (!qPid || !qRid) return;
    const a = Math.min(qa, qb), b = Math.max(qa, qb);
    if (!val && !planRef.current[qPid]?.[qRid]) return;   // xoá đoạn của vai trò dự án chưa có: không tạo dòng trống
    const items = [];
    for (const w of qWeeks) if (w.i >= a && w.i <= b) items.push({ pid: qPid, rid: qRid, wi: w.i, v: val });
    applyMany(items);   // setMany tự thêm dòng vai trò nếu dự án chưa có
    lightUp(qPid, qRid, a, b);
    setQa(a); setQb(b);
    setSel(null);   // thêm dòng mới làm chỉ số dòng của vùng chọn cũ lệch đi
    /* cuộn tới đoạn vừa điền */
    setTimeout(() => {
      const r = rowsRef.current.findIndex((x) => x.pid === qPid && x.rid === qRid);
      const c = weeksRef.current.findIndex((w) => w.i === a);
      const elx = r >= 0 && c >= 0 ? wrap.current?.querySelector(`input[data-row="${r}"][data-col="${c}"]`) : null;
      elx?.closest("td")?.scrollIntoView({ inline: "center", block: "nearest" });
    }, 0);
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
    setActive({ rid, wi });
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

  const stripRole = active?.rid ? roleById.get(active.rid) : null;
  /* khối Tổng toàn công ty: vai trò tự hiện khi có người hoặc có nhu cầu; Admin thêm / ẩn / đổi thứ tự (thiết lập chung) */
  const tcfg = totals || {};
  const tHidden = new Set(tcfg.hidden || []), tAdded = new Set(tcfg.added || []);
  const totalRoles = sortRoles(roles.filter((r) => !tHidden.has(r.id)
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
  const yearStart = (k) => k > 0 && weeks[k].y !== weeks[k - 1].y;   // cột đầu của năm sau
  const wkTh = (extra) => `sticky z-20 border-l border-slate-800 bg-slate-900 px-1 py-1 text-center ${extra}`;
  const mo = (w, k) => (w.ms && !yearStart(k) ? " mo" : "");

  /* hàng tiêu đề tháng / tuần — dùng chung cho lưới nhập và bảng Tổng toàn công ty */
  const colgroup = (
    <colgroup>
      <col style={{ width: frz }} />
      {weeks.map((w) => <col key={w.i} style={{ width: CW }} />)}
    </colgroup>
  );
  const tblStyle = { tableLayout: "fixed", width: frz + nCol * CW };
  const renderHead = (main) => (
    <thead>
      <tr>
        <th className="sticky left-0 top-0 z-30 bg-slate-900 p-0 text-left">
          {main ? (
            <>
              <Frz py="py-1"><span className="text-[11px] uppercase tracking-wider text-slate-500">{focus ? "Vai trò" : "Dự án · vai trò"}</span></Frz>
              <span role="separator" aria-orientation="vertical" title="Kéo để nới / thu cột tên · bấm đúp để về mặc định"
                onPointerDown={startDrag} onDoubleClick={resetFrz}
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none border-r-2 border-slate-600 hover:border-teal-500" />
            </>
          ) : totHead}
        </th>
        {weeks.map((w, k) => (
          <th key={w.i} style={{ minWidth: CW, top: 0 }} title={yearStart(k) ? `Từ đây là năm ${w.y}` : undefined}
            className={wkTh(`whitespace-nowrap text-[11px] font-medium${mo(w, k)} ${yearStart(k) ? "border-l-2 border-l-teal-500" : ""} ${k === 0 || weeks[k - 1].m !== w.m ? "text-teal-400" : "text-slate-700"}`)}>
            {k === 0 || weeks[k - 1].m !== w.m ? `T${w.m}${w.m === 1 || k === 0 ? `·${String(w.y).slice(2)}` : ""}` : ""}
          </th>
        ))}
      </tr>
      <tr>
        <th className="sticky left-0 top-[26px] z-30 bg-slate-900 p-0"><Frz py="py-1">&nbsp;</Frz></th>
        {weeks.map((w, k) => {
          const isNow = w.i === nowIndex;
          return (
            <th key={w.i} ref={isNow && main ? nowCell : null}
              title={isNow ? "Tuần này" : undefined} style={{ minWidth: CW, top: 26 }}
              className={`sticky z-20 border-l border-slate-800 px-1 py-1 text-center text-[10px]${mo(w, k)} ${isNow ? "bg-slate-800 font-semibold text-teal-300" : "bg-slate-900 font-normal text-slate-500"}`}>
              {w.w}
            </th>
          );
        })}
      </tr>
    </thead>
  );
  const totHead = (
    <Frz py="py-1">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold text-teal-300">TỔNG TOÀN CÔNG TY</span>
                    {canTot && addableTot.length > 0 && (
                      <span className="relative ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-700 text-slate-400 hover:border-teal-600 hover:text-teal-300"
                        title="Thêm / hiện lại vai trò ở khối tổng">
                        <Plus size={13} />
                        <select value="" onChange={(e) => addTot(e.target.value)} aria-label="Thêm vai trò vào khối tổng"
                          className="absolute inset-0 cursor-pointer opacity-0">
                          <option value="">Thêm vai trò…</option>
                          {addableTot.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}{tHidden.has(r.id) ? " (đang ẩn)" : ""}</option>)}
                        </select>
                      </span>
                    )}
                  </span>
    </Frz>
  );

  return (
    <div>
      {(!readOnly || !focus) && (
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        {!readOnly && (
          <>
            {!focus && (
              <select value={qPid || ""} onChange={(e) => setQp(e.target.value)} aria-label="Dự án" className={`${SEL_CLS} max-w-[16rem]`}>
                {qProjects.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} ` : ""}{p.name}</option>)}
              </select>
            )}
            <select value={qRid || ""} onChange={(e) => setQr(e.target.value)} aria-label="Vai trò" className={`${SEL_CLS} max-w-[12rem]`}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
            </select>
            <span className="text-xs text-slate-500">từ</span>
            <select value={qa} onChange={(e) => setQa(Number(e.target.value))} aria-label="Từ tuần" className={SEL_CLS}>
              {qWeeks.map((w) => <option key={w.i} value={w.i}>{wLbl(w)}</option>)}
            </select>
            <span className="text-xs text-slate-500">đến</span>
            <select value={qb} onChange={(e) => setQb(Number(e.target.value))} aria-label="Đến tuần" className={SEL_CLS}>
              {qWeeks.map((w) => <option key={w.i} value={w.i}>{wLbl(w)}</option>)}
            </select>
            <input value={qv} inputMode="decimal" aria-label="Số người mỗi tuần"
              onChange={(e) => setQv(e.target.value.replace(/[^0-9.,]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") quickApply(parse(qv)); }}
              className={`${SEL_CLS} w-16 text-right font-mono`} />
            <span className="text-xs text-slate-500">người / tuần</span>
            <button type="button" onClick={() => quickApply(parse(qv))} className={btnPrimary}>Áp dụng</button>
            <button type="button" onClick={() => quickApply(0)} className={btnGhost}>Xoá đoạn</button>
            <span className="text-xs text-slate-500">{qb < qa ? "tuần kết thúc đang trước tuần bắt đầu" : `${qN} tuần · ${f0(qN * parse(qv))} người-tuần`}</span>
          </>
        )}
        {!focus && (
          <button type="button" onClick={() => nowCell.current?.scrollIntoView({ inline: "center", block: "nearest" })}
            className={`${btnGhost} ml-auto`}>Về tuần này</button>
        )}
      </div>
      )}

      <style>{DROP_CSS + MO_CSS}</style>
      <div ref={wrap} onKeyDown={onKey} onCopy={onCopy} onCut={onCut} onPaste={onPaste}
        onPointerDown={readOnly ? undefined : onPointerDown} onPointerOver={readOnly ? undefined : onPointerOver}
        onScroll={() => { const a = wrap.current, b = wrap2.current; if (a && b && b.scrollLeft !== a.scrollLeft) b.scrollLeft = a.scrollLeft; }}
        className="relative overflow-auto" style={{ maxHeight: "64vh", "--frz": `${frz}px` }}>
        <table className="text-[12px]" style={tblStyle}>
          {colgroup}
          {renderHead(true)}

          <tbody>
            {projects.map((p) => {
              const used = new Set(Object.keys(plan[p.id] || {}));
              const rws = rowsOfProject.get(p.id) || [];
              const free = roles.filter((r) => !used.has(r.id));
              const name = `${p.code ? `${p.code} ` : ""}${p.name}`;
              const off = hidden.has(p.id);
              return (
                <React.Fragment key={p.id}>
                  {!focus && <tr className={off ? "opacity-50" : ""}
                    {...(readOnly ? {} : { onDragOver: (e) => pdnd.over(e, p.id), onDragLeave: (e) => e.currentTarget.removeAttribute("data-drop"), onDrop: (e) => pdnd.drop(e, p.id) })}>
                    <td className="sticky left-0 z-20 border-t border-slate-700 bg-slate-950 p-0">
                      <Frz py="py-1" title={off ? `${name} — đang tạm ẩn, không tính vào tổng` : name}>
                        <span className="flex items-center gap-1">
                          {!readOnly && (
                            <span draggable onDragStart={(e) => pdnd.start(e, p.id)} onDragEnd={dnd.end}
                              title="Giữ và kéo để đổi vị trí dự án"
                              className="inline-flex w-3 shrink-0 cursor-grab touch-none items-center justify-center text-slate-600 hover:text-slate-300 active:cursor-grabbing">
                              <GripVertical size={13} />
                            </span>
                          )}
                          <span className={`truncate font-semibold ${off ? "text-slate-500 line-through" : "text-slate-100"}`}>{name}</span>
                          <span className="ml-auto flex shrink-0 items-center gap-1">
                            {!readOnly && !off && free.length > 0 && (
                              <span className="relative inline-flex h-6 w-6 items-center justify-center rounded border border-slate-700 text-slate-400 hover:border-teal-600 hover:text-teal-300"
                                title="Thêm vai trò">
                                <Plus size={13} />
                                <select value="" onChange={(e) => addRole(p.id, e.target.value)} aria-label={`Thêm vai trò cho ${p.name}`}
                                  className="absolute inset-0 cursor-pointer opacity-0">
                                  <option value="">Thêm vai trò…</option>
                                  {free.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                                </select>
                              </span>
                            )}
                            {!readOnly && onToggleHide && (
                              <button type="button" onClick={() => onToggleHide(p.id)}
                                title={off ? "Hiện lại và tính vào tổng" : "Tạm ẩn — không tính dự án này vào tổng"}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded border border-slate-700 hover:border-teal-600 hover:text-teal-300 ${off ? "text-amber-400" : "text-slate-500"}`}>
                                {off ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            )}
                            {readOnly && off && <EyeOff size={13} className="text-amber-400" />}
                          </span>
                        </span>
                      </Frz>
                    </td>
                    <td className="border-t border-slate-700" colSpan={nCol} />
                  </tr>}
                  {rws.map(({ r, idx }) => (
                    <React.Fragment key={r.id}>
                      <Row r={idx} pid={p.id} rid={r.id} label={r.id} name={focus ? r.name : undefined} values={plan[p.id]?.[r.id]}
                        weeks={weeks} nowIndex={nowIndex} readOnly={readOnly}
                        onCell={onCell} onFocus={onFocusCell} onDrop={onDrop} dnd={dnd}
                        flash={flash && flash.pid === p.id && flash.rid === r.id ? flash : null} />
                      {focus && (
                        <tr className="border-b border-slate-800">
                          <td className="sticky left-0 z-20 bg-slate-950 p-0">
                            <Frz title={`${r.id} · ${r.name} — còn lại của cả công ty sau khi trừ mọi dự án`}>
                              <span className="pl-4 text-[11px] text-slate-500">CÒN toàn công ty · có {f0(cap.get(r.id) || 0)}</span>
                            </Frz>
                          </td>
                          {weeks.map((w) => {
                            const lf = leftOf(plan, pids, r.id, w.i, cap);
                            return <td key={w.i} className={`border-l border-slate-900 px-0 text-center font-mono text-[11px] font-semibold ${w.ms ? "mo" : ""}`}
                              style={{ minWidth: CW, ...leftStyle(lf) }}>{f0(lf)}</td>;
                          })}
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}

            {/* dải dính đáy: Cần và CÒN của vai trò đang gõ */}
            {stripRole && !focus && (
              <>
                <tr>
                  <td className="sticky left-0 z-30 border-t-2 border-teal-800 p-0" style={{ bottom: 22, background: stripBg() }}>
                    <Frz title={`${stripRole.id} · ${stripRole.name}`}>
                      <span className={`text-[11px] ${isLight() ? "text-teal-800" : "text-teal-500/80"}`}>cần — </span>
                      <span className="text-[11px] text-teal-300">{stripRole.id} · {stripRole.name}</span>
                      <span className={`font-mono text-[11px] ${isLight() ? "text-teal-800" : "text-teal-500/80"}`}> · {head.get(stripRole.id) || 0}</span>
                    </Frz>
                  </td>
                  {weeks.map((w) => {
                    const nd = needOf(plan, pids, stripRole.id, w.i);
                    return <td key={w.i} className={`sticky z-10 border-l border-slate-900 px-0 text-center font-mono text-[11px] text-slate-300 ${w.ms ? "mo" : ""}`}
                      style={{ minWidth: CW, bottom: 22, background: stripBg(), outline: w.i === active.wi ? "1.5px solid #14b8a6" : "none" }}>{nd ? f0(nd) : "0"}</td>;
                  })}
                </tr>
                <tr>
                  <td className="sticky left-0 z-30 p-0" style={{ bottom: 0, background: stripBg() }}>
                    <Frz><span className="pl-4 text-[11px] text-slate-500">còn lại</span></Frz>
                  </td>
                  {weeks.map((w) => {
                    const lf = leftOf(plan, pids, stripRole.id, w.i, cap);
                    return <td key={w.i} className={`sticky z-10 border-l border-slate-900 px-0 text-center font-mono text-[11px] font-semibold ${w.ms ? "mo" : ""}`}
                      style={{ minWidth: CW, bottom: 0, outline: w.i === active.wi ? "1.5px solid #14b8a6" : "none", ...leftStyle(lf) }}>{f0(lf)}</td>;
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>
        {ov && <div aria-hidden className="pointer-events-none absolute z-10 rounded-sm border-2 border-teal-400 bg-teal-400/10" style={ov} />}
        {prevBox && <div aria-hidden className="pointer-events-none absolute z-10 rounded-sm" style={{ ...prevBox, border: `2px dashed ${KNOB}` }} />}
        {knob && (
          <div role="button" aria-label="Kéo sang ngang để chép số này" title="Kéo sang ngang để chép số này" onPointerDown={startFill}
            className="absolute z-[15] cursor-crosshair touch-none rounded-sm"
            style={{ left: knob.left, top: knob.top, width: 10, height: 10, background: KNOB, border: `1.5px solid ${isLight() ? "#ffffff" : "#020617"}` }} />
        )}
      </div>

      {/* v12.18 — TỔNG TOÀN CÔNG TY tách thành bảng riêng, có hàng tiêu đề tháng / tuần của chính nó, cuộn ngang theo lưới nhập */}
      {!focus && <div className="border-t-2 border-slate-700">
        <div ref={wrap2} onScroll={() => { const a = wrap2.current, b = wrap.current; if (a && b && b.scrollLeft !== a.scrollLeft) b.scrollLeft = a.scrollLeft; }}
          className="overflow-auto" style={{ maxHeight: "48vh", "--frz": `${frz}px` }}>
          <table className="text-[12px]" style={tblStyle}>
            {colgroup}
            {renderHead(false)}
            <tbody>
              {totalRoles.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-slate-900"
                    {...(canTot ? { onDragOver: (e) => tdnd.over(e, r.id), onDragLeave: (e) => e.currentTarget.removeAttribute("data-drop"), onDrop: (e) => tdnd.drop(e, r.id) } : {})}>
                    <td className="sticky left-0 z-20 bg-slate-950 p-0">
                      <Frz title={`${r.id} · ${r.name}`}>
                        <span className="flex items-center gap-1">
                          {canTot && (
                            <span draggable onDragStart={(e) => tdnd.start(e, r.id)} onDragEnd={dnd.end} title="Giữ và kéo để đổi vị trí dòng"
                              className="inline-flex w-3 shrink-0 cursor-grab touch-none items-center justify-center text-slate-600 hover:text-slate-300 active:cursor-grabbing">
                              <GripVertical size={12} />
                            </span>
                          )}
                          <span className="truncate"><span className="font-mono text-slate-400">{r.id}</span> <span className="text-slate-300">{r.name}</span>{" "}
                            <span className="text-slate-600">· {head.get(r.id) || 0}</span>
                            {mergedOf.get(r.id) && <span className="text-[10.5px] text-teal-600" title={`Đã gộp ${mergedOf.get(r.id).join(", ")} vào ${r.id}`}> (+{mergedOf.get(r.id).join(", ")})</span>}</span>
                          {canTot && (
                            <button type="button" onClick={() => hideTot(r.id)} title="Ẩn vai trò này khỏi khối tổng, Tổng quan và Excel"
                              className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-600 hover:text-amber-400">
                              <EyeOff size={12} />
                            </button>
                          )}
                        </span>
                      </Frz>
                    </td>
                    {weeks.map((w) => {
                      const nd = needOf(plan, pids, r.id, w.i);
                      return <td key={w.i} style={{ minWidth: CW }} className={`border-l border-slate-900 px-0 text-center font-mono text-[11px] ${w.ms ? "mo" : ""} ${nd ? "text-slate-100" : "text-slate-800"}`}>{nd ? f0(nd) : "0"}</td>;
                    })}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="sticky left-0 z-20 bg-slate-950 p-0"><Frz><span className="pl-4 text-[11px] text-slate-600">còn lại</span></Frz></td>
                    {weeks.map((w) => {
                      const lf = leftOf(plan, pids, r.id, w.i, cap);
                      return <td key={w.i} className={`border-l border-slate-900 px-0 text-center font-mono text-[11px] font-semibold ${w.ms ? "mo" : ""}`}
                        style={{ minWidth: CW, ...leftStyle(lf) }}>{f0(lf)}</td>;
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-800 px-3 py-2.5 text-xs text-slate-400 md:px-4">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: leftStyle(0).background }} />CÒN ≥ 0 — đủ / dư người</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#fde68a" }} />thiếu tới 1 người</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#f87171" }} />thiếu hơn 1 người</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-950" />tuần đã qua</span>
        {!focus && <span className="text-slate-600">Tên dự án dài được cắt gọn — rê chuột để xem đủ</span>}
        {!readOnly && <span className="text-slate-600">Mũi tên để di chuyển · Enter xuống dòng · Esc nhả ô</span>}
        {!readOnly && <span className="text-slate-600">Kéo chuột hoặc Shift + mũi tên để chọn nhiều ô, gõ số là điền cả vùng · Ctrl + C / Ctrl + V · Ctrl + D lấy theo dòng trên · + / − tăng giảm 0,25 · Delete xoá vùng · kéo núm ở góc ô để chép sang ngang</span>}
      </div>
    </div>
  );
}
