/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Trash2, ChevronDown, Lock, Pencil, Check, X, Unlock, Loader2,
} from "lucide-react";
import { dLabel, fmt } from "../core/date.jsx";
import { DB, sentRows, useDataTick, useUsage } from "../core/db.jsx";
import { serverHours } from "../data.js";
import { DEFAULT_PHASE, NO_PROJECT, PHASES, budgetTotal, cleanBudgets, empHasProj, fmtH, isLeaveTask, isResigned, norm, projBudgets, projPhaseIsOpen, roleTitle, supportList, tone, uid, useIsMobile } from "../core/domain.jsx";
import { ConfirmDialog, Panel, btnGhost, btnPrimary, iconBtn, inputCls } from "../core/ui.jsx";
import { moveInList, sortByProjOrder, useProjOrder, useRowDrag } from "../shared/rowDrag.jsx";
import { SupportDialog, supHours } from "../shared/support.jsx";

/* ============================ DỰ ÁN ============================ */
export function Projects({ cfg, saveCfg, flash, onSupport = null, supportRo = false }) {
  const [supFor, setSupFor] = useState(null);   // v8.7: dự án đang mở hộp "+ Hỗ trợ"
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [client, setClient] = useState("");
  const [budgets, setBudgets] = useState({});   // giờ công dự kiến theo phase
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});
  const dataTick = useDataTick();
  const isWide = !useIsMobile();
  /* v6.9 — nhân sự tham gia dự án: mũi tên ⌄ dưới tên dự án mở danh sách "Tên · Vai trò"; + Nhân sự / ✕ để giao, gỡ
     (cùng dữ liệu với cột "Dự án đang tham gia" ở tab Nhân sự: employee.projects) */
  const [teamOpen, setTeamOpen] = useState(() => new Set());
  const [tp, setTp] = useState(null);   // { pid, q, x, y, top }
  useEffect(() => {
    if (!tp) return;
    const close = () => setTp(null);
    const esc = (ev) => { if (ev.key === "Escape") setTp(null); };
    /* v12.28 — chỉ đóng khi BỀ NGANG đổi (xoay máy, kéo cửa sổ). Trước đây đóng ở mọi lần resize, mà trên điện thoại
       bàn phím ảo bật lên hoặc thanh địa chỉ co giãn khi cuộn đều đổi chiều cao và phát resize — bảng vừa mở đã tự tắt. */
    const w0 = window.innerWidth;
    const onResize = () => { if (window.innerWidth !== w0) close(); };
    document.addEventListener("click", close); document.addEventListener("keydown", esc); window.addEventListener("resize", onResize);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); window.removeEventListener("resize", onResize); };
  }, [!!tp]); // eslint-disable-line react-hooks/exhaustive-deps
  const inProj = (e, pid) => empHasProj(e, pid);   // v8.8: người có quyền "Tất cả dự án" có mặt ở mọi dự án
  const toggleMember = (eid, pid) => (cfg.employees.find((e) => e.id === eid)?.allProjects
    ? flash("Người này đang có quyền Tất cả dự án — tắt ở tab Nhân sự nếu muốn giao từng dự án.", "err")
    : saveCfg({ ...cfg, employees: cfg.employees.map((e) => (e.id !== eid ? e
    : { ...e, projects: inProj(e, pid) ? e.projects.filter((x) => x !== pid) : [...(Array.isArray(e.projects) ? e.projects : []), pid] })) }));
  const teamToggle = (pid) => setTeamOpen((s) => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  const teamBlock = (p) => {
    const on = teamOpen.has(p.id);
    const team = cfg.employees.filter((e) => !isResigned(e) && inProj(e, p.id));
    const today8 = fmt(new Date());
    const sups = supportList(cfg).filter((x) => x.pid === p.id && x.until >= today8);
    return (
      <div>
        <button onClick={() => teamToggle(p.id)} title="Nhân sự tham gia" aria-label="Nhân sự tham gia"
          className={`mt-0.5 flex h-6 items-center gap-1 rounded-md px-1.5 hover:bg-slate-700 ${on ? "text-teal-300" : "text-slate-500"}`}>
          <ChevronDown size={15} className={`transition-transform ${on ? "rotate-180" : ""}`} />
          <span className="font-mono text-[11px] text-slate-600">{team.length}</span>
        </button>
        {on && (
          <div className="mt-1 text-[12.5px]">
            {team.map((e) => (
              <div key={e.id} className="group flex min-h-[28px] items-center gap-1.5">
                <span className="whitespace-nowrap text-slate-200">{e.name}</span>
                {roleTitle(e.role) && <span className="whitespace-nowrap text-slate-500">· {roleTitle(e.role)}</span>}
                {e.allProjects ? <span className="whitespace-nowrap rounded border border-teal-900 px-1 text-[10.5px] text-teal-400" title="Có quyền Tất cả dự án (tab Nhân sự)">tất cả DA</span> : (
                <button onClick={() => toggleMember(e.id, p.id)} title="Gỡ khỏi dự án" aria-label={`Gỡ ${e.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-500 opacity-0 hover:bg-rose-950 hover:text-rose-300 group-hover:opacity-100 max-md:opacity-100"><X size={12} /></button>)}
              </div>
            ))}
            {/* v8.7 — nhân sự đang hỗ trợ dự án này (có thời hạn) */}
            {sups.length > 0 && <div className="mb-0.5 mt-1.5 text-[10.5px] uppercase tracking-wider text-violet-400">Hỗ trợ</div>}
            {sups.map((x) => { const e = cfg.employees.find((y) => y.id === x.empId); return (
              <div key={x.id} className="flex min-h-[26px] items-center gap-1.5">
                <span className="whitespace-nowrap text-slate-200">{e?.name || "?"}</span>
                <span className="sup-tag whitespace-nowrap rounded border border-violet-800 bg-violet-950 px-1 text-[10.5px] text-violet-300">{x.from > today8 ? `từ ${dLabel(x.from)}` : `tới ${dLabel(x.until)}`}{x.phase ? ` · ${x.phase}` : ""}</span>
                <span className="text-slate-500">{fmtH(supHours(x))} h</span>
              </div>
            ); })}
            <button onClick={(ev) => { ev.stopPropagation(); const r = ev.currentTarget.getBoundingClientRect(); setTp({ pid: p.id, q: "", x: Math.max(8, Math.min(window.innerWidth - 328, r.left)), y: r.bottom + 6, top: r.top }); }}
              className="mt-1 h-8 rounded-md border border-dashed border-slate-700 px-2.5 text-xs text-slate-400 hover:border-teal-600 hover:text-teal-300">+ Nhân sự</button>
            {onSupport && (
              <button onClick={() => setSupFor(p.id)} className={`${supportRo ? "ro-hide" : ""} ml-1.5 mt-1 h-8 rounded-md border border-dashed border-violet-800 px-2.5 text-xs text-violet-300 hover:border-violet-600`}>+ Hỗ trợ</button>
            )}
          </div>
        )}
      </div>
    );
  };
  const teamPop = tp && (() => {
    const kw = norm(tp.q.trim());
    const list = cfg.employees.filter((e) => !isResigned(e) && (!kw || norm(`${e.name} ${e.code || ""} ${roleTitle(e.role)}`).includes(kw)));
    const depts = [...new Set(list.map((e) => e.dept || "Khác"))];
    const below = tp.y + 400 < window.innerHeight;
    return (
      <div onClick={(ev) => ev.stopPropagation()} className="fixed z-50 w-[320px] rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-2xl"
        style={below ? { left: tp.x, top: tp.y } : { left: tp.x, bottom: window.innerHeight - tp.top + 6 }}>
        <div className="p-1"><input autoFocus={isWide} value={tp.q} onChange={(ev) => setTp({ ...tp, q: ev.target.value })} placeholder="Tìm nhân sự (gõ không dấu được)" className={inputCls} /></div>
        <div className="max-h-72 overflow-y-auto">
          {list.length === 0 && <div className="px-3 py-3 text-sm text-slate-500">Không có nhân sự khớp.</div>}
          {depts.map((d) => (
            <div key={d}>
              <div className="px-2.5 pb-0.5 pt-2 text-[10.5px] uppercase tracking-wider text-slate-500">{d}</div>
              {list.filter((e) => (e.dept || "Khác") === d).map((e) => { const on = inProj(e, tp.pid);
                return (
                  <button key={e.id} onClick={() => toggleMember(e.id, tp.pid)} className="flex min-h-[42px] w-full items-center gap-2.5 rounded-md px-2.5 text-left hover:bg-slate-800">
                    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-600"}`}>{on && <Check size={12} />}</span>
                    <span className="min-w-0"><span className="block text-sm text-slate-200">{e.name}</span>{roleTitle(e.role) && <span className="block text-[11px] text-slate-500">{roleTitle(e.role)}</span>}</span>
                  </button>
                ); })}
            </div>
          ))}
        </div>
        <div className="flex justify-end p-1"><button onClick={() => setTp(null)} className={`${btnPrimary} h-9`}>Xong</button></div>
      </div>
    );
  })();

  /* Giờ đã dùng của từng dự án theo phase: tính trên TOÀN BỘ thời gian, chỉ giờ của ngày đã gửi, không tính vắng mặt.
     v2.1: lấy từ database (useUsage); chỉ khi chưa hỏi được mới tạm cộng từ phần đang có trong bộ nhớ. */
  const usage = useUsage();
  const used = useMemo(() => {
    const m = new Map();
    if (usage) {
      for (const u of usage) {
        if (u.projectId === NO_PROJECT || !u.sent) continue;
        const o = m.get(u.projectId) || {}; o[u.phaseId] = (o[u.phaseId] || 0) + u.sent; m.set(u.projectId, o);
      }
      return m;
    }
    for (const bucket of Object.values(DB?.ts || {})) for (const r of sentRows(bucket)) {
      if (isLeaveTask(r.taskId) || r.projectId === NO_PROJECT) continue;
      const h = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
      if (!h) continue;
      const o = m.get(r.projectId) || {};
      const ph = r.phaseId || DEFAULT_PHASE;
      o[ph] = (o[ph] || 0) + h; m.set(r.projectId, o);
    }
    return m;
  }, [dataTick, usage]);
  const usedOf = (p, ph) => used.get(p.id)?.[ph] || 0;
  const usedTotal = (p) => PHASES.reduce((a, ph) => a + usedOf(p, ph.id), 0);

  const add = async () => {
    if (!name.trim()) return flash("Nhập tên dự án.", "err");
    const bg = cleanBudgets(budgets);
    await saveCfg({ ...cfg, projects: [...cfg.projects, { id: uid("p"), name: name.trim(), code: code.trim(), client: client.trim(), budgets: bg, budget: budgetTotal({ budgets: bg }), phaseOpen: Object.fromEntries(PHASES.map((x) => [x.id, (bg[x.id] || 0) > 0])), active: true }] });
    setName(""); setCode(""); setClient(""); setBudgets({}); flash("Đã thêm dự án.");
  };
  const startEdit = (p) => { setEditId(p.id); setDraft({ code: p.code || "", name: p.name, client: p.client || "", budgets: Object.fromEntries(PHASES.map((ph) => [ph.id, projBudgets(p)[ph.id] || ""])) }); };
  const commit = async () => {
    if (!draft.name.trim()) return flash("Tên dự án không được để trống.", "err");
    const bg = cleanBudgets(draft.budgets);
    await saveCfg({ ...cfg, projects: cfg.projects.map((p) => (p.id === editId ? { ...p, code: draft.code.trim(), name: draft.name.trim(), client: draft.client.trim(), budgets: bg, budget: budgetTotal({ budgets: bg }) } : p)) });
    setEditId(null); flash("Đã cập nhật dự án.");
  };
  const phInput = (val, onChange, ph, withPlaceholder) => (
    <input type="number" min="0" step="8" value={val ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && editId && commit()}
      aria-label={`Giờ dự kiến ${ph.id}`} placeholder={withPlaceholder ? ph.id : "0"} className={`px-2 text-right font-mono ${inputCls}`} />
  );
  // v3.1: bật / tắt cho nhân sự chấm vào giai đoạn này của dự án
  const togglePhase = async (p, phId) => {
    const map = Object.fromEntries(PHASES.map((x) => [x.id, projPhaseIsOpen(p, x.id)]));
    map[phId] = !map[phId];
    const ok = await saveCfg({ ...cfg, projects: cfg.projects.map((x) => (x.id === p.id ? { ...x, phaseOpen: map } : x)) });
    if (ok) flash(`${p.code ? `[${p.code}] ` : ""}${p.name} · ${phId}: ${map[phId] ? "đã mở chấm công" : "đã đóng chấm công"}.`);
  };
  const PhaseToggle = ({ p, ph }) => {
    const on = projPhaseIsOpen(p, ph.id);
    return (
      <button onClick={() => togglePhase(p, ph.id)} title={on ? "Đang mở — nhân sự chấm được giai đoạn này. Bấm để đóng." : "Đang đóng — nhân sự không chấm được. Bấm để mở."}
        className={`mt-1.5 inline-flex h-6 items-center gap-1 rounded border px-2 text-[11px] ${on ? "border-teal-700 bg-teal-950 text-teal-300" : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"}`}>
        {on ? <Unlock size={10} /> : <Lock size={10} />}{on ? "Đang mở" : "Đóng"}
      </button>
    );
  };
  const PhaseCell = ({ p, ph }) => {
    const b = projBudgets(p)[ph.id], u = usedOf(p, ph.id), over = b > 0 && u > b;
    if (!b && !u) return <div><span className="font-mono text-slate-600">—</span><div><PhaseToggle p={p} ph={ph} /></div></div>;
    return (
      <div>
        <div className={`whitespace-nowrap font-mono text-[13px] ${over ? "text-rose-400" : "text-slate-300"}`}>{fmtH(u)}<span className={over ? "" : "text-slate-500"}> / {b > 0 ? `${fmtH(b)} h` : "—"}</span></div>
        {b > 0 && <div className="mt-1 h-1 overflow-hidden rounded bg-slate-800"><div className="h-full rounded" style={{ width: `${Math.min(100, (u / b) * 100)}%`, background: tone(over ? "#fb7185" : ph.color) }} /></div>}
        <PhaseToggle p={p} ph={ph} />
      </div>
    );
  };
  const phHead = (ph) => <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: tone(ph.color) }} />{ph.id} · {ph.name}</span>;
  const toggle = (id) => saveCfg({ ...cfg, projects: cfg.projects.map((p) => (p.id === id ? { ...p, active: !p.active } : p)) });
  const [projOrder, setProjOrder] = useProjOrder();
  const projList = sortByProjOrder(cfg.projects, projOrder, (x) => x.id);   // v7.7: thứ tự kéo thả (riêng từng máy)
  const projDrag = useRowDrag((from, to, after) => {
    const moved = moveInList(projList.map((x) => x.id), from, to, after);
    setProjOrder(moved);
  });
  /* v13.66 (R11) — dự án ĐÃ CÓ GIỜ (đếm trên server, mọi tháng) thì không xoá được nữa, chỉ ĐÓNG.
     Xoá thì giờ không mất nhưng thành "(dự án đã xoá)" trong mọi báo cáo, mất tên, mất giờ dự kiến để đối chiếu,
     và lưới kế hoạch của dự án thành dòng mồ côi. Đóng thì giữ được hết, mở lại được. Chưa có giờ thì xoá như cũ.
     Đếm lỗi thì không mở hộp nào. */
  const [pendingDel, setPendingDel] = useState(null); // { p, h } — dự án chờ xác nhận, h = giờ trên server
  const [checking, setChecking] = useState(null);
  const del = async (id) => {
    const p = cfg.projects.find((x) => x.id === id); if (!p) return;
    setChecking(id);
    let h;
    try { h = await serverHours({ project: id }); }
    catch (e) { flash(`Chưa kiểm tra được giờ đã chấm — ${e.message}. Thử lại sau.`, "err"); return; }
    finally { setChecking(null); }
    setPendingDel({ p, h });
  };
  const confirmDel = async () => {
    const d = pendingDel; setPendingDel(null);
    if (!d) return;
    if (d.h > 0) {
      if (d.p.active) await saveCfg({ ...cfg, projects: cfg.projects.map((x) => (x.id === d.p.id ? { ...x, active: false } : x)) });
      flash(`Đã đóng dự án ${d.p.name}. Giờ đã chấm giữ nguyên, mở lại được bất cứ lúc nào.`);
      return;
    }
    await saveCfg({ ...cfg, projects: cfg.projects.filter((x) => x.id !== d.p.id) });
    flash("Đã xoá dự án.");
  };

  const StatusBtn = ({ p, full }) => (
    <button onClick={() => toggle(p.id)}
      className={`ro-static h-9 rounded-md border px-3 text-xs font-medium ${full ? "w-full" : ""} ${p.active ? "border-teal-900 bg-teal-950 text-teal-300" : "border-slate-700 bg-slate-950 text-slate-500"}`}>
      {p.active ? "Đang chấm công" : "Đã đóng"}
    </button>
  );

  return (
    <Panel title="Dự án — sửa thông tin & bật/tắt chấm công">
      {teamPop}
      {supFor && onSupport && createPortal(<SupportDialog cfg={cfg} emps={cfg.employees.filter((e) => !isResigned(e) && !e.allProjects).sort((a, b) => a.name.localeCompare(b.name, "vi"))} presetPid={supFor} onSave={onSupport} onClose={() => setSupFor(null)} />, document.body)}
      {/* bọc trong div để class width không bị w-full của inputCls ghi đè */}
      <div className="ro-hide mb-5 grid gap-2 md:flex md:flex-wrap md:items-end">
        <div className="md:w-28">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã DA" className={`font-mono ${inputCls}`} />
        </div>
        <div className="md:min-w-48 md:flex-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên dự án" className={inputCls} />
        </div>
        <div className="md:w-44">
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Khách hàng" className={inputCls} />
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(PHASES.length, 4)}, minmax(0, 1fr))`, width: isWide ? `${PHASES.length * 5.75}rem` : undefined }}>
          {PHASES.map((ph) => (
            <label key={ph.id} className="min-w-0">
              <span className="mb-1 flex items-center gap-1 truncate text-[11px] text-slate-500"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: tone(ph.color) }} />{ph.id}<span className="hidden truncate md:inline"> · {ph.name}</span></span>
              {phInput(budgets[ph.id], (v) => setBudgets({ ...budgets, [ph.id]: v }), ph, false)}
            </label>
          ))}
        </div>
        <button onClick={add} className={btnPrimary}><Plus size={14} /> Thêm dự án</button>
      </div>

      {cfg.projects.length === 0 ? <p className="text-sm text-slate-500">Chưa có dự án. Thêm dự án để nhân sự bắt đầu chấm công.</p> : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1240px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="w-20 px-3 py-2 font-medium">Mã DA</th>
                  <th className="px-3 py-2 font-medium">Tên dự án</th>
                  <th className="w-36 px-3 py-2 font-medium">Khách hàng</th>
                  {PHASES.map((ph) => <th key={ph.id} className="w-[130px] px-2 py-2 font-medium normal-case tracking-normal">{phHead(ph)}</th>)}
                  <th className="w-32 px-3 py-2 text-right font-medium">Tổng</th>
                  <th className="w-40 px-3 py-2 font-medium">Trạng thái</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {projList.map((p) => {
                  const editing = editId === p.id;
                  return (
                    <tr key={p.id} {...projDrag.rowProps(p.id)} className={`border-b border-slate-800 align-top hover:bg-slate-800 ${projDrag.mark(p.id, "tr")}`}>
                      <td className="whitespace-nowrap px-3 py-2">{projDrag.grip(p.id, editing || projList.length < 2)}{editing ? <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={`font-mono ${inputCls}`} /> : <span className="font-mono text-base font-bold leading-6 text-slate-100">{p.code || "—"}</span>}</td>
                      <td className="px-3 py-2">{editing ? <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && commit()} className={inputCls} /> : <><div className="text-[15px] leading-6 text-slate-100">{p.name}</div>{teamBlock(p)}</>}</td>
                      <td className="px-3 py-2">{editing ? <input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} onKeyDown={(e) => e.key === "Enter" && commit()} className={inputCls} /> : <span className="leading-6 text-slate-400">{p.client || "—"}</span>}</td>
                      {PHASES.map((ph) => (
                        <td key={ph.id} className="px-2 py-2" data-phase={ph.id}>
                          {editing ? phInput(draft.budgets?.[ph.id], (v) => setDraft({ ...draft, budgets: { ...draft.budgets, [ph.id]: v } }), ph, false) : <PhaseCell p={p} ph={ph} />}
                        </td>
                      ))}
                      <td className={`whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] ${!editing && budgetTotal(p) > 0 && usedTotal(p) > budgetTotal(p) ? "text-rose-400" : "text-slate-300"}`} data-total>
                        {editing ? `${fmtH(budgetTotal({ budgets: cleanBudgets(draft.budgets) }))} h` : `${fmtH(usedTotal(p))} / ${budgetTotal(p) > 0 ? `${fmtH(budgetTotal(p))} h` : "—"}`}
                      </td>
                      <td className="px-3 py-2"><StatusBtn p={p} /></td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1.5">
                          {editing ? (
                            <><button onClick={commit} className={`${iconBtn} border-teal-800 text-teal-400`}><Check size={15} /></button>
                              <button onClick={() => setEditId(null)} className={iconBtn}><X size={15} /></button></>
                          ) : (
                            <><button onClick={() => startEdit(p)} className={iconBtn}><Pencil size={14} /></button>
                              <button onClick={() => del(p.id)} disabled={checking === p.id} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400 disabled:opacity-50`}>{checking === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button></>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {projList.map((p) => {
              const editing = editId === p.id;
              return (
                <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  {editing ? (
                    <div className="space-y-2">
                      <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Mã DA" className={`font-mono ${inputCls}`} />
                      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Tên dự án" className={inputCls} />
                      <input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="Khách hàng" className={inputCls} />
                      <div className="grid grid-cols-4 gap-2">
                        {PHASES.map((ph) => <div key={ph.id}>{phInput(draft.budgets?.[ph.id], (v) => setDraft({ ...draft, budgets: { ...draft.budgets, [ph.id]: v } }), ph, true)}</div>)}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={commit} className={btnPrimary}><Check size={15} /> Lưu</button>
                        <button onClick={() => setEditId(null)} className={btnGhost}><X size={15} /> Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {p.code && <div className="font-mono text-sm font-bold text-slate-50">{p.code}</div>}
                          <div className="text-sm font-medium text-slate-100">{p.name}</div>
                          <div className="text-xs text-slate-500">{p.client || "—"}</div>
                          {teamBlock(p)}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button onClick={() => startEdit(p)} className={iconBtn}><Pencil size={14} /></button>
                          <button onClick={() => del(p.id)} disabled={checking === p.id} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400 disabled:opacity-50`}>{checking === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
                        </div>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
                        {PHASES.map((ph) => (
                          <div key={ph.id} className="min-w-0"><div className="mb-0.5 text-[11px] text-slate-500">{phHead(ph)}</div><PhaseCell p={p} ph={ph} /></div>
                        ))}
                      </div>
                      <div className="mt-2.5"><StatusBtn p={p} full /></div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-slate-500">Mỗi ô phase: giờ đã gửi / giờ dự kiến, nút <b className="text-slate-400">Đang mở / Đóng</b> quyết định nhân sự có chấm được giai đoạn đó không (chỉ mở một giai đoạn thì nhân sự khỏi phải chọn). Phase để trống giờ dự kiến nghĩa là không theo dõi hạn mức. Dự án đã đóng thì nhân sự không chấm công được nữa — giờ công đã ghi vẫn giữ nguyên trong báo cáo.</p>

      <ConfirmDialog
        open={!!pendingDel}
        title={pendingDel?.h > 0 ? `Dự án ${pendingDel?.p.name || ""} đã có giờ công` : `Xoá dự án ${pendingDel?.p.name || ""}?`}
        desc={pendingDel?.h > 0
          ? `Đã có ${fmtH(pendingDel.h)} h chấm vào dự án này (mọi tháng), nên không xoá được — xoá thì mọi báo cáo chỉ còn ghi "(dự án đã xoá)", mất tên và giờ dự kiến để đối chiếu. ${pendingDel.p.active ? "Đóng dự án: nhân sự không chấm được nữa, giờ đã chấm giữ nguyên, mở lại được bất cứ lúc nào." : "Dự án đang ở trạng thái Đã đóng — giữ nguyên như vậy là đủ."}`
          : "Chưa có giờ nào chấm vào dự án này (đã kiểm tra mọi tháng trên server). Xoá hẳn khỏi danh sách."}
        confirmLabel={pendingDel?.h > 0 ? (pendingDel.p.active ? "Đóng dự án" : "Đã hiểu") : "Xoá dự án"}
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
    </Panel>
  );
}

