/* ARTIUS TIME v12.24 — Kế hoạch, chế độ "Theo dự án".
   Gộp vào một màn ba thứ trước đây nằm ở ba chỗ khác nhau:
     · kế hoạch của từng dự án (vai trò nào, bao nhiêu người, từ tuần nào tới tuần nào)
     · ai đang tham gia dự án đó
     · nút đóng / mở dự án, bấm ngay tại chỗ thay vì phải sang tab Dự án

   Cột "Đang lệch" so KHOẢNG THỜI GIAN KẾ HOẠCH với trạng thái chấm công hiện tại.
   Nó chỉ gợi ý, không tự đổi gì: đóng một dự án là chặn nhân viên chấm công vào đó,
   nên quyết định vẫn là của người bấm.

   v13.3 — trạng thái "Thiếu người được giao": dự án đang mở, có kế hoạch từ tuần hiện tại trở đi, mà có vai trò trong
   kế hoạch chưa ai thuộc vai trò đó được giao. "Được giao" = thành viên dự án, hoặc đang hỗ trợ dự án hôm nay;
   không tính người nghỉ việc, người bỏ khỏi kế hoạch (noPlan) và quyền "tất cả dự án" (thường là trưởng phòng). */
import React, { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { isResigned } from "../../core/domain.jsx";
import { CTRL, inputCls } from "../../core/ui.jsx";
import { isLight } from "../../core/theme.jsx";
import { cellOf } from "./planCalc.js";

const f0 = (n) => String(+Number(n).toFixed(2)).replace(".", ",");
const wLbl = (w) => (w ? `T${w.m} tuần ${w.w}` : "—");
/* bỏ dấu để gõ không dấu vẫn tìm ra, cùng cách với các màn khác */
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* v12.27 — màu hover và thanh thời gian đặt theo theme ngay trong code: class hover:bg-slate-900/60, hover:bg-teal-950
   và bg-cyan-700/80 không có trong LIGHT_CSS nên ở mode sáng vẫn giữ màu tối (dòng thành xám đen khi rê chuột). */
const TONE = {
  dark:  { rowHover: "rgba(30,41,59,0.45)", bar: "rgba(14,116,144,0.85)", openHover: "#042f2e", closeHover: "#1e293b" },
  light: { rowHover: "#f8fafc",             bar: "#22d3ee",               openHover: "#f0fdfa", closeHover: "#f1f5f9" },
};

export function PlanProjects({ plan, projects, roles, weeks, nowIndex, hidden = new Set(),
  detail = [], employees = [], canToggle = false, onToggle, prole = (r) => r, support = [] }) {
  const [flt, setFlt] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const [hovP, setHovP] = useState(null);      /* dòng đang rê chuột */
  const [hovBtn, setHovBtn] = useState(null);  /* nút Mở / Đóng đang rê chuột */
  const [, bump] = useState(0);                /* vẽ lại ngay khi đổi Sáng / Tối */
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    window.addEventListener("artius:theme", f);
    return () => window.removeEventListener("artius:theme", f);
  }, []);
  const C = isLight() ? TONE.light : TONE.dark;

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const nowW = nowIndex >= 0 ? weeks.find((w) => w.i === nowIndex) : null;

  /* giờ đã chấm của từng người vào từng dự án — nguồn "ai thực sự làm" */
  const hoursBy = useMemo(() => {
    const m = new Map();   // pid -> Map(empId -> giờ)
    for (const d of detail) {
      if (!d.projectId || !d.hours) continue;
      if (!m.has(d.projectId)) m.set(d.projectId, new Map());
      const e = m.get(d.projectId);
      e.set(d.empId, (e.get(d.empId) || 0) + Number(d.hours));
    }
    return m;
  }, [detail]);

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  /* ---------- số liệu kế hoạch của một dự án ---------- */
  const info = useMemo(() => {
    const out = new Map();
    for (const p of projects) {
      const byRole = [];
      let a = Infinity, b = -Infinity, tot = 0;
      for (const rid of Object.keys(plan?.[p.id] || {})) {
        let ra = Infinity, rb = -Infinity, rtot = 0, peak = 0;
        for (const w of weeks) {
          const v = cellOf(plan, p.id, rid, w.i);
          if (v > 0) { ra = Math.min(ra, w.i); rb = Math.max(rb, w.i); rtot += v; peak = Math.max(peak, v); }
        }
        if (rb < 0) continue;
        byRole.push({ rid, a: ra, b: rb, tot: rtot, peak });
        a = Math.min(a, ra); b = Math.max(b, rb); tot += rtot;
      }
      byRole.sort((x, y) => y.tot - x.tot);
      out.set(p.id, b < 0 ? { byRole: [], tot: 0 } : { byRole, a, b, tot });
    }
    return out;
  }, [projects, plan, weeks]);

  /* ---------- v13.3: vai trò còn thiếu người được giao ---------- */
  const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, []);
  const rolesGiven = (pid) => {
    const ids = new Set();
    for (const e of employees) if (!isResigned(e) && !e.noPlan && Array.isArray(e.projects) && e.projects.includes(pid)) ids.add(e.id);
    for (const x of support) if (x.pid === pid && x.from <= today && today <= x.until) ids.add(x.empId);
    const out = new Set();
    for (const id of ids) { const e = empById.get(id); if (e && !isResigned(e) && !e.noPlan && e.role) out.add(prole(e.role)); }
    return out;
  };
  const missingOf = (p) => {
    if (!p.active || nowIndex < 0) return [];
    const have = rolesGiven(p.id);
    return roles.map((r) => r.id).filter((rid) => !have.has(rid) && weeks.some((w) => w.i >= nowIndex && cellOf(plan, p.id, rid, w.i) > 0));
  };

  /* ---------- so kế hoạch với trạng thái đóng / mở ---------- */
  const verdictOf = (p) => {
    const s = info.get(p.id);
    /* tuần hiện tại không nằm trong cặp năm đang xem thì không kết luận được gì */
    if (nowIndex < 0) return ["na", "—", "Tuần hiện tại không thuộc cặp năm đang xem"];
    if (!s || s.tot <= 0) return p.active
      ? ["close", "Nên đóng", "Dự án đang mở nhưng chưa nhập kế hoạch tuần nào"]
      : ["ok", "Khớp", ""];
    const running = s.a <= nowIndex && nowIndex <= s.b;
    if (running && !p.active) return ["open", "Nên mở", `Kế hoạch đang chạy ${wLbl(nowW)} nhưng dự án đã đóng`];
    if (!running && p.active) return s.b < nowIndex
      ? ["close", "Nên đóng", `Kế hoạch kết thúc ${wLbl(weeks.find((w) => w.i === s.b))}, đã qua`]
      : ["close", "Nên đóng", `Kế hoạch bắt đầu ${wLbl(weeks.find((w) => w.i === s.a))}, chưa tới`];
    return ["ok", "Khớp", ""];
  };

  const rows = useMemo(() => projects.map((p) => {
    let [v, label, why] = verdictOf(p);
    const miss = missingOf(p);
    if (v === "ok" && miss.length) { v = "staff"; label = "Thiếu người được giao"; why = `Kế hoạch có ${miss.join(", ")} nhưng chưa ai thuộc vai trò này được giao vào dự án`; }
    return { p, s: info.get(p.id), v, label, why, miss };
  }), [projects, info, nowIndex, employees, support, plan, roles, weeks]);   // eslint-disable-line react-hooks/exhaustive-deps

  const nBad = rows.filter((r) => r.v !== "ok" && r.v !== "na").length;
  const nStaff = rows.filter((r) => r.v === "staff").length;
  const shown = rows.filter(({ p, v }) => {
    if (flt === "bad" && (v === "ok" || v === "na")) return false;
    if (flt === "on" && !p.active) return false;
    if (flt === "off" && p.active) return false;
    if (q && !norm(`${p.name} ${p.code || ""}`).includes(norm(q))) return false;
    return true;
  });

  const toggle = async (p) => {
    if (!canToggle || busyId) return;
    setBusyId(p.id);
    try { await onToggle(p.id); } finally { setBusyId(null); }
  };

  const seg = (on) => `${CTRL} whitespace-nowrap px-3 text-[13px] ${on ? "bg-teal-950 text-teal-300" : "text-slate-400 hover:text-slate-200"}`;
  const W0 = weeks[0]?.i ?? 0, WN = weeks.length || 1;
  const pc = (i) => ((i - W0) / WN) * 100;

  return (
    <div>
      {/* thanh lọc */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2.5 md:px-4">
        <div className="flex overflow-x-auto rounded-md border border-slate-700">
          {[["all", "Tất cả"], ["bad", "Đang lệch"], ["on", "Đang mở"], ["off", "Đã đóng"]].map(([k, l]) => (
            <button key={k} onClick={() => setFlt(k)} className={seg(flt === k)}>{l}</button>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm dự án" className={`pl-9 ${inputCls}`} />
        </div>
        {(q || flt !== "all") && (
          <button onClick={() => { setQ(""); setFlt("all"); }} className="text-xs text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="border-b border-slate-800 px-3 py-2.5 text-[13px] md:px-4">
        {nowIndex < 0
          ? <span className="text-slate-500">Tuần hiện tại không thuộc cặp năm đang xem — không so được kế hoạch với trạng thái.</span>
          : nBad > 0
            ? <><span className="text-rose-400">{nBad} dự án</span> <span className="text-slate-400">cần xem{nStaff ? ` · ${nBad - nStaff} lệch giữa kế hoạch và trạng thái chấm công · ${nStaff} thiếu người được giao` : " · lệch giữa kế hoạch và trạng thái chấm công"} · tuần hiện tại {wLbl(nowW)}</span></>
            : <span className="text-slate-400">Mọi dự án khớp với kế hoạch · tuần hiện tại {wLbl(nowW)}</span>}
      </div>

      {shown.length === 0 && <p className="px-4 py-8 text-sm text-slate-500">Không có dự án nào khớp bộ lọc.</p>}

      {shown.map(({ p, s, v, label, why, miss }) => {
        const isOpen = open.has(p.id);
        const vcls = v === "open" || v === "staff" ? "border-rose-900 bg-rose-950 text-rose-300"
          : v === "close" ? "border-amber-900 bg-amber-950 text-amber-300"
            : "border-slate-800 text-slate-600";
        const names = new Set();
        for (const e of employees) {
          if (isResigned(e)) continue;
          if (e.allProjects || (Array.isArray(e.projects) && e.projects.includes(p.id))) names.add(e.id);
        }
        const logged = hoursBy.get(p.id) || new Map();
        for (const eid of logged.keys()) names.add(eid);
        const people = [...names].map((eid) => ({
          e: empById.get(eid), eid, gan: (() => { const x = empById.get(eid); return !!(x && (x.allProjects || (Array.isArray(x.projects) && x.projects.includes(p.id)))); })(),
          h: logged.get(eid) || 0,
        })).filter((o) => o.e).sort((x, y) => y.h - x.h || String(x.e.name).localeCompare(String(y.e.name)));

        /* v12.24 — gom người tham gia theo VAI TRÒ để soi chéo được với vai trò theo kế hoạch.
           Vai trò của người đi qua bảng gộp (vd TL-2D → 2D) để trùng khớp với vai trò trong lưới kế hoạch.
           Vai trò kế hoạch có nhưng chưa ai làm vẫn hiện thành nhóm rỗng — đó mới là chỗ cần thấy. */
        const planByRole = new Map((s?.byRole || []).map((r) => [r.rid, r]));
        const byRole = new Map();
        for (const o of people) {
          const rid = prole(o.e.role || "") || "";
          if (!byRole.has(rid)) byRole.set(rid, []);
          byRole.get(rid).push(o);
        }
        const groups = [];
        for (const r of s?.byRole || []) groups.push({ rid: r.rid, plan: r, list: byRole.get(r.rid) || [] });
        for (const [rid, list] of byRole) if (!planByRole.has(rid)) groups.push({ rid, plan: null, list });

        return (
          <div key={p.id} className="border-b border-slate-800 last:border-b-0">
            <div onClick={(e) => { if (e.target.closest("button")) return; setOpen((sx) => { const t = new Set(sx); t.has(p.id) ? t.delete(p.id) : t.add(p.id); return t; }); }}
              onMouseEnter={() => setHovP(p.id)} onMouseLeave={() => setHovP((h) => (h === p.id ? null : h))}
              style={{ background: hovP === p.id ? C.rowHover : "transparent" }}
              className="grid cursor-pointer grid-cols-[116px_minmax(0,1fr)_84px_20px] items-center gap-3 px-3 py-2.5 md:grid-cols-[132px_minmax(0,1fr)_280px_150px_88px_20px] md:px-4">
              {/* trạng thái */}
              <span className={`flex h-[30px] items-center justify-center rounded-md border text-[11.5px] ${p.active ? "border-teal-900 bg-teal-950 text-teal-300" : "border-slate-700 bg-slate-950 text-slate-500"}`}>
                {p.active ? "Đang chấm công" : "Đã đóng"}
              </span>
              {/* tên đầy đủ, mã chỉ đi kèm */}
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] text-slate-100">
                  {p.name}
                  {p.code && <span className="ml-2 font-mono text-[11px] text-slate-600">{p.code}</span>}
                  {hidden.has(p.id) && <span className="ml-2 rounded border border-slate-800 px-1.5 text-[10px] text-slate-600">tạm ẩn</span>}
                </span>
                <span className="block truncate text-[11.5px] text-slate-500">
                  {s && s.tot > 0
                    ? `${wLbl(weeks.find((w) => w.i === s.a))} → ${wLbl(weeks.find((w) => w.i === s.b))} · ${s.b - s.a + 1} tuần · ${f0(s.tot)} người-tuần`
                    : "chưa nhập kế hoạch tuần nào"}
                  {miss.length > 0 && <span className="text-rose-400"> · chưa giao {miss.join(", ")}</span>}
                </span>
              </span>
              {/* dải thời gian — mỗi vai trò một thanh, vạch đỏ là tuần hiện tại */}
              <span className="hidden md:block">
                <span className="relative block h-[26px] overflow-hidden rounded-md bg-slate-950">
                  {(s?.byRole || []).map((r) => (
                    <i key={r.rid} title={`${r.rid}: ${wLbl(weeks.find((w) => w.i === r.a))} → ${wLbl(weeks.find((w) => w.i === r.b))}`}
                      className="absolute top-[5px] h-4 rounded-sm"
                      style={{ left: `${pc(r.a)}%`, width: `${Math.max(1.2, ((r.b - r.a + 1) / WN) * 100)}%`, background: C.bar }} />
                  ))}
                  {nowIndex >= 0 && <i className="absolute inset-y-0 w-0.5 bg-rose-500" style={{ left: `${pc(nowIndex)}%` }} />}
                </span>
              </span>
              {/* kết luận */}
              <span title={why} className={`hidden justify-center rounded-full border px-2 py-1 text-center text-[11.5px] md:flex ${vcls}`}>{label}</span>
              {/* nút đóng / mở */}
              <span>
                {canToggle ? (
                  <button onClick={() => toggle(p)} disabled={busyId === p.id}
                    onMouseEnter={() => setHovBtn(p.id)} onMouseLeave={() => setHovBtn((h) => (h === p.id ? null : h))}
                    style={{ background: hovBtn === p.id ? (p.active ? C.closeHover : C.openHover) : "transparent" }}
                    className={`h-[30px] w-full rounded-md border text-[11.5px] disabled:opacity-40 ${p.active ? "border-slate-700 text-slate-300" : "border-teal-800 text-teal-300"}`}>
                    {busyId === p.id ? "…" : p.active ? "Đóng" : "Mở"}
                  </button>
                ) : <span className="block text-center text-[11px] text-slate-600">chỉ xem</span>}
              </span>
              <span className={`text-center text-slate-600 transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
            </div>

            {isOpen && (
              <div className="grid gap-5 bg-slate-950/60 px-3 pb-4 md:grid-cols-2 md:px-4 md:pl-[152px]">
                <div>
                  <div className="py-2 text-[10.5px] uppercase tracking-wider text-slate-500">Vai trò theo kế hoạch</div>
                  {(s?.byRole || []).length === 0
                    ? <div className="border-t border-slate-800 py-1.5 text-[12px] text-slate-600">Chưa nhập kế hoạch</div>
                    : s.byRole.map((r) => (
                      <div key={r.rid} className="grid grid-cols-[46px_minmax(0,1fr)_76px_64px] items-baseline gap-2 border-t border-slate-800 py-1.5 text-[12px]">
                        <span className="font-mono text-teal-300">{r.rid}</span>
                        <span className="truncate text-slate-500">{roleById.get(r.rid)?.name || ""}</span>
                        <span className="text-right font-mono text-slate-300">{f0(r.peak)}/tuần</span>
                        <span className="text-right font-mono text-slate-500">{r.b - r.a + 1} tuần</span>
                      </div>
                    ))}
                </div>
                <div>
                  <div className="py-2 text-[10.5px] uppercase tracking-wider text-slate-500">Người tham gia theo vai trò</div>
                  {groups.length === 0
                    ? <div className="border-t border-slate-800 py-1.5 text-[12px] text-slate-600">Chưa ai tham gia</div>
                    : groups.map(({ rid, plan: pr, list }) => (
                      <div key={rid || "_none"}>
                        {/* tiêu đề nhóm mang luôn con số kế hoạch, để soi chéo mà không phải nhìn qua cột bên trái */}
                        <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 border-t border-slate-800 pb-1 pt-2 text-[11.5px]">
                          <span className="truncate">
                            <span className="font-mono text-teal-300">{rid || "—"}</span>{" "}
                            <span className="text-slate-500">{roleById.get(rid)?.name || (rid ? "" : "chưa gán vai trò")}</span>
                          </span>
                          <span className={`whitespace-nowrap font-mono ${pr && list.length === 0 ? "text-amber-400" : !pr ? "text-slate-500" : "text-slate-400"}`}>
                            {pr ? `kế hoạch ${f0(pr.peak)}/tuần · ` : "ngoài kế hoạch · "}
                            {list.length ? `${list.length} người` : "chưa có ai"}
                          </span>
                        </div>
                        {list.map((o) => (
                          <div key={o.eid} className="grid grid-cols-[52px_minmax(0,1fr)_72px] items-baseline gap-2 py-1 pl-3 text-[12px]">
                            <span className={`rounded border px-1.5 text-[10px] ${o.gan ? "border-teal-900 text-teal-400" : "border-slate-700 text-slate-500"}`}>
                              {o.gan ? "gắn" : "ngoài"}
                            </span>
                            <span className="truncate text-slate-300">{o.e.name}</span>
                            <span className={`text-right font-mono ${o.h ? "text-slate-300" : "text-slate-600"}`}>{o.h ? `${f0(o.h)} h` : "—"}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
