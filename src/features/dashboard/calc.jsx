/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React from "react";
import { addDays, fmt, makeHolidayIndex, mondayOf, pad, parseD } from "../../core/date.jsx";
import { DB, sentRows } from "../../core/db.jsx";
import { DEFAULT_PHASE, NO_PROJECT, fmtH, isLeaveTask, isOtId, otBandKey, otDayKind, otRateFor, otRateOf, otText, roleTitle, taskText } from "../../core/domain.jsx";
import { isLight } from "../../core/theme.jsx";

/* Biểu đồ gộp cho khối dự án: mỗi dự án là một cột chồng chia theo 4 giai đoạn,
   kèm mốc giờ dự kiến. Một hình trả lời được cả ba câu: dự án nào ngốn giờ,
   giờ đó rơi vào chặng nào, và đã vượt dự toán chưa. */
/* v1.9 — Mỗi dự án 4 thanh theo phase: phần tô màu là giờ đã dùng (theo kỳ và bộ lọc đang chọn),
   vạch trắng là mốc giờ dự kiến của phase đó. Vượt mốc thì số chuyển đỏ và tên dự án có nhãn "Vượt Px". */
/* ============================================================
   v4.6 — Dashboard quản lý: Tiến độ dự án + Phân bổ giờ công theo nhân sự
   ============================================================ */
export const PG_COLOR = { ok: "#14b8a6", warn: "#f59e0b", over: "#f43f5e" };
export const PG_COLOR_L = { ok: "#059669", warn: "#d97706", over: "#e11d48" };   // v7.8: bản đậm hơn cho nền sáng
export const pgColor = (L) => (isLight() ? PG_COLOR_L : PG_COLOR)[L];
export const pgLevel = (pct) => (pct == null ? "none" : pct > 100 ? "over" : pct >= 80 ? "warn" : "ok");
/* v4.7 — Chi tiết từng giai đoạn: tính từ khối số liệu database (artius_phase_detail) hoặc, khi chưa hỏi được,
   từ phần bảng công đang có trong bộ nhớ. Kết quả: Map "<projectId>|<phaseId>" -> { w, e, t, first, last }. */
export const phaseDetailFromMemory = () => {
  const out = new Map();
  const hs = makeHolidayIndex(DB?.config?.holidays);
  for (const [slotKey, bucket] of Object.entries(DB?.ts || {})) {
    const empId = slotKey.split(":")[0];
    for (const r of sentRows(bucket)) {
      if (isLeaveTask(r.taskId) || r.projectId === NO_PROJECT || !r.projectId) continue;
      const k = `${r.projectId}|${r.phaseId || DEFAULT_PHASE}`;
      const o = out.get(k) || { w: {}, e: {}, t: {}, o: {}, et: {}, first: "", last: "" };
      for (const [d, v] of Object.entries(r.days || {})) {
        const h = Number(v) || 0;
        if (h <= 0) continue;
        const wk = fmt(mondayOf(parseD(d)));
        o.w[wk] = (o.w[wk] || 0) + h; o.e[empId] = (o.e[empId] || 0) + h; o.t[r.taskId] = (o.t[r.taskId] || 0) + h;
        { const et = (o.et[empId] ||= {}), tk = `${r.taskId}|${isOtId(r.taskId) ? r.otFor || "" : ""}`; et[tk] = (et[tk] || 0) + h; }   // v5.6
        if (isOtId(r.taskId)) { const ok = `${r.taskId}|${r.otFor || ""}|${otDayKind(d, hs)}`; o.o[ok] = (o.o[ok] || 0) + h; }   // v4.9
        if (!o.first || d < o.first) o.first = d;
        if (!o.last || d > o.last) o.last = d;
      }
      out.set(k, o);
    }
  }
  return out;
};

export const OT_MAX = 40;         // thang của thanh Tăng ca (%); vượt 40% thì vạch nằm cuối thanh
export const otLevel = (pct) => (pct < 15 ? "ok" : pct < 25 ? "mid" : "hi");
export const ddmm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
export const daysBetween = (a, b) => Math.round((b - a) / 864e5);

/* Gom số liệu của một ô (dự án × giai đoạn) thành những gì thẻ rê chuột và khung chi tiết cần. */
export const buildPhaseInfo = (raw, cell, ctx) => {
  if (!raw) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisMon = mondayOf(today);
  /* v5.6 — tác vụ của từng người trong giai đoạn (cho thẻ rê chuột vào tên). Database cũ chưa có "et" thì tạm tính từ bộ nhớ. */
  const etAll = raw.et || ctx.memEt?.(cell.key) || {};
  const tName = (id) => { const t = ctx.taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };
  const empTasks = (id) => {
    const m = new Map();
    for (const [key, hv] of Object.entries(etAll[id] || {})) {
      const h = Number(hv) || 0; if (h <= 0) continue;
      const [tid, forId = ""] = key.split("|");
      const ot = isOtId(tid), lbl = ot ? `Tăng ca · ${forId ? tName(forId) : "chưa rõ tác vụ"}` : tName(tid);
      const x = m.get(lbl) || { name: lbl, h: 0, ot }; x.h += h; m.set(lbl, x);
    }
    return [...m.values()].sort((a, b) => (a.ot - b.ot) || b.h - a.h);
  };
  const people = Object.entries(raw.e || {})
    .map(([id, h]) => { const e = ctx.empById.get(id); return { id, name: e?.name || "(nhân sự đã xoá)", role: e ? roleTitle(e.role) : "", h: Number(h) || 0, tasks: empTasks(id) }; })
    .filter((x) => x.h > 0).sort((a, b) => b.h - a.h);
  let ot = 0;
  const tasks = [];
  for (const [id, hv] of Object.entries(raw.t || {})) {
    const h = Number(hv) || 0;
    if (h <= 0) continue;
    if (isOtId(id)) { ot += h; continue; }
    const t = ctx.taskById.get(id);
    tasks.push({ name: t ? taskText(t) : "(tác vụ đã xoá)", h });
  }
  tasks.sort((a, b) => b.h - a.h);
  /* v4.9 — tăng ca theo "tăng ca cho tác vụ" × khung giờ, kèm giờ quy đổi (giờ × hệ số; CN / lễ dùng hệ số riêng nếu có) */
  const otMap = new Map(), bandIds = new Map();
  let otW = 0;
  for (const [key, hv] of Object.entries(raw.o || {})) {
    const h = Number(hv) || 0;
    if (h <= 0) continue;
    const [bid, forId = "", kind = "n"] = key.split("|");
    const bt = ctx.taskById.get(bid);
    const w = h * otRateFor(ctx.cfg, bt || { id: bid, name: "" }, kind);
    const bk = bt ? otBandKey(bt) : `?${bid}`;   // v5.1: gộp các hạng mục [OT] cùng khung giờ (của nhiều vai trò) vào một cột
    const row = otMap.get(forId) || { forId, b: {}, special: 0, h: 0, w: 0 };
    row.b[bk] = (row.b[bk] || 0) + h; row.h += h; row.w += w;
    if (kind !== "n") row.special += h;
    otMap.set(forId, row); otW += w;
    if (!bandIds.has(bk)) bandIds.set(bk, bt);
  }
  const otBandsUsed = [...bandIds.entries()].sort((a, b) => (a[1] ? ctx.taskOrder.get(a[1].id) ?? 1e9 : 1e9) - (b[1] ? ctx.taskOrder.get(b[1].id) ?? 1e9 : 1e9))
    .map(([id, t]) => ({ id, label: t ? otText(t) : "(khung đã xoá)", rate: t ? otRateOf(ctx.cfg, t) : null }));
  const otByTask = [...otMap.values()].map((x) => {
    const t = x.forId ? ctx.taskById.get(x.forId) : null;
    return { ...x, name: x.forId ? (t ? taskText(t) : "(tác vụ đã xoá)") : "Chưa rõ tác vụ (giờ tăng ca trước v4.9)" };
  }).sort((a, b) => (!a.forId) - (!b.forId) || b.h - a.h);
  const total = people.reduce((a, x) => a + x.h, 0);
  if (!total) return null;
  // tuần: từ thứ Hai của ngày đầu tiên tới tuần này (giai đoạn mở) hoặc tuần cuối có giờ (giai đoạn đóng)
  const first = mondayOf(parseD(raw.first || raw.last));
  const lastDay = parseD(raw.last || raw.first);
  const end = cell.open ? thisMon : mondayOf(lastDay);
  const weeks = [];
  for (let m = new Date(first); m <= end && weeks.length < 520; m = addDays(m, 7)) weeks.push({ mon: new Date(m), h: Number(raw.w?.[fmt(m)]) || 0 });
  // tốc độ = trung bình 4 tuần đã qua gần nhất (không tính tuần đang chạy vì thường chưa gửi xong)
  let rate = null;
  if (cell.open) {
    const done = weeks.filter((w) => w.mon < thisMon).slice(-4);
    if (done.length) rate = done.reduce((a, w) => a + w.h, 0) / 4;
  }
  return { people, tasks, ot, otByTask, otBandsUsed, otW, otNoDetail: ot > 0 && raw.o === undefined, total, weeks, rate, first: parseD(raw.first || raw.last), last: lastDay,
    idleDays: daysBetween(lastDay, today), nWeeks: Math.max(1, Math.round(daysBetween(first, mondayOf(lastDay)) / 7) + 1) };
};

/* Dự báo cho giai đoạn đang mở. full = câu đầy đủ (thẻ rê chuột), short = chỉ kết luận (khung chi tiết). */
export const phaseForecast = (cell, info) => {
  const left = cell.b - cell.h;
  if (info.idleDays >= 10) {
    const t = <>Đứng im {info.idleDays} ngày — không ai gửi giờ vào giai đoạn này từ {ddmm(info.last)}. Kiểm tra dự án có đang tạm dừng?</>;
    return { cls: "idle", full: t, short: t };
  }
  if (!info.rate) { const t = "Chưa đủ dữ liệu để dự báo."; return { cls: "idle", full: t, short: t }; }
  if (!cell.b) { const t = <>Giai đoạn chưa có giờ dự kiến — tốc độ {fmtH(info.rate)} h/tuần.</>; return { cls: "idle", full: t, short: t }; }
  if (left < 0) return { cls: "over",
    full: <>Đã vượt <b>{fmtH(-left)} h</b> và vẫn đang tiêu {fmtH(info.rate)} h/tuần. Nếu không chặn, 2 tuần tới sẽ vượt thêm ~{fmtH(info.rate * 2)} h.</>,
    short: <>→ Đã vượt <b>{fmtH(-left)} h</b>; nếu giữ tốc độ này, 2 tuần tới vượt thêm ~{fmtH(info.rate * 2)} h.</> };
  const wk = left / info.rate, hit = addDays(new Date(), Math.round(wk * 7));
  const cls = wk < 2 ? "over" : wk < 4 ? "warn" : "ok";
  const dur = wk < 1 ? `${Math.max(1, Math.round(wk * 7))} ngày` : `${fmtH(wk)} tuần`;
  const tail = <>sẽ hết {fmtH(left)} h còn lại trong <b>~{dur}</b> (khoảng <b>{ddmm(hit)}</b>).</>;
  return { cls, full: <>Tốc độ 4 tuần gần nhất: <b>{fmtH(info.rate)} h/tuần</b> → {tail}</>, short: <>→ {tail}</> };
};
export const FC_CLS = { ok: "bg-teal-400/[.07] text-teal-100", warn: "bg-amber-500/10 text-amber-200", over: "bg-rose-500/[.12] text-rose-200", idle: "bg-slate-800 text-slate-400" };

export const REWORK_RE = /chỉnh sửa|sửa lại|góp ý|khách hàng/i;

/* v5.3 — Phân bổ giờ công theo nhân sự (theo kỳ và bộ lọc của Dashboard). Hai cách xem trong cùng khung:
   · "Theo người" (mặc định): mỗi người một thanh tách Giờ chuẩn (xanh dương) / OT (xanh ngọc) / Giờ cố gắng (tím)
     so với vạch giờ chuẩn của kỳ; nhãn Quá tải / Thiếu giờ / Bình thường; gom theo bộ phận; bấm một người để mở
     chi tiết theo dự án.
   · "Ma trận": hàng = người, cột = dự án ("Khác" = việc chung / vắng mặt, luôn cuối), ô đậm nhạt theo số giờ;
     cuối hàng là tổng, % tải và số dự án (≥ 3 dự án tô vàng); cuối cột là tổng giờ từng dự án.
   Ngưỡng: Quá tải khi tổng giờ > cfg.allocOver % giờ chuẩn kỳ (mặc định 110); Thiếu giờ khi giờ chuẩn < cfg.allocUnder % (mặc định 90).
   Chỉnh ở Thiết lập. Nhân sự chưa chấm giờ nào trong kỳ vẫn hiện (khi không lọc theo dự án / giai đoạn) để thấy ai thiếu. */
/* v5.5 — làm tròn % sao cho tổng đúng 100 (phương pháp phần dư lớn nhất) */
export const pct100 = (vals) => {
  const t = vals.reduce((a, v) => a + v, 0);
  if (!t) return vals.map(() => 0);
  const raw = vals.map((v) => (v / t) * 100), out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, v) => a + v, 0);
  raw.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i] += 1; left -= 1; } });
  return out;
};
