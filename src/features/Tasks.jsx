/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, AlertTriangle, Lock, Pencil, Check, X, GripVertical,
} from "lucide-react";
import { purgeTasks, fetchOrphanTasks } from "../data.js";
import { DB, pullTs } from "../core/db.jsx";
import { DEFAULT_DEPTS, DEPTS, DEPTS_SEE_ALL, LEAVE_PALETTE, fmtH, isIdleTask, isOtTask, leaveShort, norm, roleInfo, roleLabel, taskRoles, uid } from "../core/domain.jsx";
import { ConfirmDialog, btnDanger, btnPrimary, iconBtn, inputCls, selectCls } from "../core/ui.jsx";

/* ============================ HẠNG MỤC ============================ */
/* v6.6 — giờ đã chấm (trong phần bảng công đang tải) vào các tác vụ ids, tính cả dòng tăng ca cho các tác vụ đó */
export const hoursOfTasks = (ids) => {
  const set = new Set(ids); let h = 0;
  for (const b of Object.values(DB?.ts || {})) for (const r of Array.isArray(b?.rows) ? b.rows : [])
    if (set.has(r.taskId) || (r.otFor && set.has(r.otFor))) for (const v of Object.values(r.days || {})) h += Number(v) || 0;
  return h;
};
/* Xoá hẳn giờ của các tác vụ ids trên server rồi kéo bản mới về. Trả về số giờ đã xoá, hoặc null nếu lỗi. */
export const purgeTaskHours = async (ids, flash) => {
  if (!ids.length) return 0;
  try {
    const r = await purgeTasks(ids);
    await pullTs();
    return Number(r?.hours) || 0;
  } catch (e) {
    flash(`Đã xoá tác vụ nhưng chưa xoá được giờ đã chấm — ${e.message}. Chạy lại schema.sql (v6.6) rồi dùng nút "Xoá hẳn" ở tab Tác vụ.`, "err");
    return null;
  }
};

export function Tasks({ cfg, saveCfg, flash }) {
  const [sub, setSub] = useState("task");               // tab con: task | org | leave
  const [sel, setSel] = useState("");                   // ô tác vụ đang chọn: "r:<mã vai trò>" hoặc "shared"
  const [q, setQ] = useState("");                       // ô tìm vai trò
  const [drafts, setDrafts] = useState({});
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDesc, setEditDesc] = useState("");          // v4.4: mô tả ngắn của tác vụ
  const [dragTask, setDragTask] = useState(null);        // v4.4: id tác vụ đang kéo để đổi thứ tự (chỉ máy tính)
  const [dropAt, setDropAt] = useState(null);            // { id, after } — chỗ sẽ thả: trước/sau tác vụ id
  const [pendingDel, setPendingDel] = useState(null);
  const [orphans, setOrphans] = useState(null);   // v6.6: { taskId: giờ } của tác vụ đã xoá trước đây
  const [purgeAsk, setPurgeAsk] = useState(false);
  useEffect(() => { let alive = true; fetchOrphanTasks().then((o) => { if (alive) setOrphans(o); }).catch(() => {}); return () => { alive = false; }; }, [cfg.tasks]);
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDept, setRoleDept] = useState(DEPTS[0]);
  const [pendingRoleDel, setPendingRoleDel] = useState(null);
  const [leaveName, setLeaveName] = useState("");
  const [leaveEditId, setLeaveEditId] = useState(null);
  const [leaveEditName, setLeaveEditName] = useState("");
  const [pendingLeaveDel, setPendingLeaveDel] = useState(null);
  const [deptName, setDeptName] = useState("");
  /* Sửa tại chỗ ở tab Phòng ban & vai trò: { kind: "dept" | "role" | "code", key, value }.
     Giữ thêm một bản trong ref để Enter và sự kiện rời ô (blur) không lưu hai lần. */
  const [edit, setEditState] = useState(null);
  const editRef = useRef(null);
  const setEdit = (v) => { editRef.current = v; setEditState(v); };
  const [drag, setDrag] = useState(null);               // vai trò đang được kéo: { id, x, y, w }
  const [overDept, setOverDept] = useState(null);       // dòng phòng ban đang được nhắm để thả
  const press = useRef(null);
  const lastCodeTap = useRef({ id: "", at: 0 });
  const depts = cfg.depts || DEFAULT_DEPTS;
  const LOCKED_DEPT = DEPTS_SEE_ALL[0];                 // Ban giám đốc: cố định
  const roles = cfg.roles || [];
  const leaves = cfg.leaveTypes || [];

  /* Một "ô" là một chủ sở hữu tác vụ: một vai trò, hoặc dùng chung.
     Khoá dạng "r:ARC" / "shared" để một select duy nhất chuyển tác vụ đi đâu cũng được. */
  const SHARED = "shared";
  const boxes = [
    ...roles.map((r) => ({ key: `r:${r.id}`, kind: "role", id: r.id, title: `${r.id} · ${r.name}` })),
    { key: SHARED, kind: "shared", id: "", title: "Dùng chung" },
  ];
  const ownerOf = (t) => {
    const rs = taskRoles(t);
    return rs.length ? `r:${rs[0]}` : SHARED;
  };
  const patchFor = (key) => {
    if (key === SHARED) return { roles: [], depts: [], group: "Chung" };
    const id = key.slice(2);
    return { roles: [id], depts: [], group: roleInfo(id)?.dept || "Thiết kế" };
  };
  const listOf = (key) => cfg.tasks.filter((t) => ownerOf(t) === key);
  // phòng ban theo thứ tự khai báo; vai trò mang tên phòng ban lạ (dữ liệu cũ) xếp cuối để không bị mất dấu
  const deptOrder = [...depts, ...roles.map((r) => r.dept).filter((d, i, a) => !depts.includes(d) && a.indexOf(d) === i)];
  const cur = boxes.some((b) => b.key === sel) ? sel : boxes[0].key;   // vai trò đang chọn bị xoá thì về ô đầu
  const curRole = cur === SHARED ? null : roles.find((r) => `r:${r.id}` === cur);

  const setDraft = (k, v) => setDrafts((x) => ({ ...x, [k]: v }));

  const add = async (key) => {
    const nm = (drafts[key] || "").trim();
    if (!nm) return;
    if (isOtTask({ name: nm })) return flash("Tăng ca không còn là tác vụ — cài khung giờ và hệ số ở Thiết lập → Tăng ca.", "err");   // v6.3
    if (listOf(key).some((t) => t.name.toLowerCase() === nm.toLowerCase())) return flash("Ô này đã có tác vụ trùng tên.", "err");
    const ok = await saveCfg({ ...cfg, tasks: [...cfg.tasks, { id: uid("t"), name: nm, ...patchFor(key) }] });
    if (ok !== false) setDraft(key, "");
  };

  const commit = async () => {
    if (!editName.trim()) return flash("Tên tác vụ không được để trống.", "err");
    if (isOtTask({ name: editName })) return flash("Tăng ca không còn là tác vụ — cài khung giờ và hệ số ở Thiết lập → Tăng ca.", "err");   // v6.3
    const desc = editDesc.trim();
    await saveCfg({ ...cfg, tasks: cfg.tasks.map((t) => {
      if (t.id !== editId) return t;
      const { desc: _old, ...rest } = t;                  // mô tả rỗng thì bỏ hẳn trường, không lưu chuỗi trống
      return { ...rest, name: editName.trim(), ...(isIdleTask(t.id) ? {} : patchFor(editOwner)), ...(desc ? { desc } : {}) };   // v7.2: Trống việc luôn dùng chung
    }) });
    setEditId(null);
  };
  const startEdit = (t) => { setEditId(t.id); setEditName(t.name); setEditOwner(ownerOf(t)); setEditDesc(t.desc || ""); };

  const confirmDel = async () => {
    const t = pendingDel; setPendingDel(null);
    if (!t) return;
    const ok = await saveCfg({ ...cfg, tasks: cfg.tasks.filter((x) => x.id !== t.id) });
    if (ok === false) return;
    const h = await purgeTaskHours([t.id], flash);   // v6.6: tác vụ đã xoá không còn xuất hiện ở đâu nữa
    if (h !== null) flash(h > 0 ? `Đã xoá tác vụ và ${fmtH(h)} h đã chấm vào tác vụ này.` : "Đã xoá tác vụ.");
  };

  /* v4.4 — Đổi thứ tự tác vụ bằng kéo thả. Chỉ sắp lại các tác vụ của ô đang xem; trong mảng cfg.tasks chúng được đặt lại
     đúng vào các vị trí cũ của chính chúng, nên tác vụ của vai trò khác không xê dịch. Màn Chấm công hiện theo thứ tự này. */
  const moveTask = async (fromId, toId, after) => {
    if (!fromId || fromId === toId) return;
    const list = listOf(cur);
    const moving = list.find((t) => t.id === fromId);
    if (!moving) return;
    const rest = list.filter((t) => t.id !== fromId);
    let at = rest.findIndex((t) => t.id === toId);
    if (at < 0) return;
    if (after) at += 1;
    const order = [...rest.slice(0, at), moving, ...rest.slice(at)];
    if (order.every((t, k) => t.id === list[k].id)) return;   // thả về đúng chỗ cũ
    const mine = new Set(list.map((t) => t.id));
    let k = 0;
    await saveCfg({ ...cfg, tasks: cfg.tasks.map((t) => (mine.has(t.id) ? order[k++] : t)) });
  };
  const endDrag = () => { setDragTask(null); setDropAt(null); };

  const ROLE_CODE_RE = /^[A-Z0-9_-]{1,8}$/;
  const ROLE_CODE_MSG = "Mã vai trò chỉ gồm chữ không dấu, số, - hoặc _, tối đa 8 ký tự.";
  const addRole = async () => {
    const id = roleCode.trim().toUpperCase();
    const name = roleName.trim();
    if (!id || !name) return flash("Nhập mã và tên vai trò.", "err");
    if (!ROLE_CODE_RE.test(id)) return flash(ROLE_CODE_MSG, "err");
    if (roles.some((r) => r.id === id)) return flash("Mã vai trò này đã có.", "err");
    const ok = await saveCfg({ ...cfg, roles: [...roles, { id, name, dept: depts.includes(roleDept) ? roleDept : depts[0] }] });
    if (ok !== false) { setRoleCode(""); setRoleName(""); flash("Đã thêm vai trò."); }
  };

  /* Xoá vai trò thì xoá luôn tác vụ của vai trò đó (không còn tác vụ cấp bộ phận để chuyển về).
     Nhân sự đang giữ vai trò đó thành "không phân vai trò", chỉ thấy tác vụ dùng chung.
     Giờ công đã chấm vẫn giữ nguyên, báo cáo hiển thị là (tác vụ đã xoá). */
  const confirmDelRole = async () => {
    const r = pendingRoleDel; setPendingRoleDel(null);
    if (!r) return;
    const goneIds = cfg.tasks.filter((t) => taskRoles(t).length === 1 && taskRoles(t)[0] === r.id).map((t) => t.id);
    const ok = await saveCfg({
      ...cfg,
      roles: roles.filter((x) => x.id !== r.id),
      tasks: cfg.tasks.flatMap((t) => {
        if (!taskRoles(t).includes(r.id)) return [t];
        const left = taskRoles(t).filter((x) => x !== r.id);
        return left.length ? [{ ...t, roles: left }] : [];
      }),
      employees: cfg.employees.map((e) => (e.role === r.id ? { ...e, role: "" } : e)),
    });
    if (ok === false) return;
    const h = await purgeTaskHours(goneIds, flash);   // v6.6
    if (h !== null) flash(h > 0 ? `Đã xoá vai trò, ${goneIds.length} tác vụ và ${fmtH(h)} h đã chấm vào các tác vụ đó.` : "Đã xoá vai trò.");
  };
  const addDept = async () => {
    const name = deptName.trim();
    if (!name) return flash("Nhập tên phòng ban.", "err");
    if (depts.some((d) => d.toLowerCase() === name.toLowerCase())) return flash("Phòng ban này đã có.", "err");
    const ok = await saveCfg({ ...cfg, depts: [...depts, name] });
    if (ok !== false) { setDeptName(""); flash("Đã thêm phòng ban."); }
  };
  const delDept = async (d) => {
    const ne = cfg.employees.filter((e) => e.dept === d).length;
    const nr = roles.filter((r) => r.dept === d).length;
    if (ne || nr) return flash(`Không xoá được: còn ${ne} nhân sự và ${nr} vai trò thuộc "${d}". Chuyển họ sang phòng ban khác trước.`, "err");
    await saveCfg({ ...cfg, depts: depts.filter((x) => x !== d) });
    flash("Đã xoá phòng ban.");
  };

  /* ---- sửa tại chỗ: mỗi hàm trả về thông điệp lỗi, hoặc cấu hình mới cần lưu, hoặc null nếu không đổi gì ---- */
  /* Đổi tên phòng ban: nhân sự, vai trò và nhóm tác vụ đang mang tên cũ đổi theo để dữ liệu không lệch. */
  const renameDept = (old, raw) => {
    const name = raw.trim();
    if (!name) return "Tên phòng ban không được để trống.";
    if (name === old) return null;
    if (depts.some((d) => d !== old && d.toLowerCase() === name.toLowerCase())) return "Phòng ban này đã có.";
    return {
      ...cfg,
      depts: depts.map((d) => (d === old ? name : d)),
      employees: cfg.employees.map((e) => (e.dept === old ? { ...e, dept: name } : e)),
      roles: roles.map((r) => (r.dept === old ? { ...r, dept: name } : r)),
      tasks: cfg.tasks.map((t) => ({ ...t, group: t.group === old ? name : t.group, depts: Array.isArray(t.depts) ? t.depts.map((d) => (d === old ? name : d)) : t.depts })),
    };
  };
  const renameRole = (id, raw) => {
    const name = raw.trim();
    if (!name) return "Tên vai trò không được để trống.";
    if (roles.find((r) => r.id === id)?.name === name) return null;
    return { ...cfg, roles: roles.map((r) => (r.id === id ? { ...r, name } : r)) };
  };
  /* Đổi mã vai trò: nhân sự và tác vụ tham chiếu vai trò bằng mã, nên phải đổi theo ở cả hai nơi. */
  const recodeRole = (old, raw) => {
    const id = raw.trim().toUpperCase();
    if (!id) return "Mã vai trò không được để trống.";
    if (id === old) return null;
    if (!ROLE_CODE_RE.test(id)) return ROLE_CODE_MSG;
    if (roles.some((r) => r.id === id)) return "Mã vai trò này đã có.";
    return {
      ...cfg,
      roles: roles.map((r) => (r.id === old ? { ...r, id } : r)),
      tasks: cfg.tasks.map((t) => (taskRoles(t).includes(old) ? { ...t, roles: taskRoles(t).map((x) => (x === old ? id : x)) } : t)),
      employees: cfg.employees.map((e) => (e.role === old ? { ...e, role: id } : e)),
    };
  };
  /* Enter: sai thì báo lỗi và ở lại ô đang sửa. Rời ô (blur): hợp lệ thì lưu, sai thì giữ giá trị cũ. */
  const commitEdit = async (fromBlur) => {
    const e = editRef.current;
    if (!e) return;
    const next = e.kind === "dept" ? renameDept(e.key, e.value) : e.kind === "role" ? renameRole(e.key, e.value) : recodeRole(e.key, e.value);
    if (typeof next === "string") {
      if (fromBlur) setEdit(null);
      if (!fromBlur || e.value.trim()) flash(next, "err");
      return;
    }
    setEdit(null);
    if (!next) return;
    const ok = await saveCfg(next);
    if (ok !== false && e.kind === "code" && cur === `r:${e.key}`) setSel(`r:${e.value.trim().toUpperCase()}`);
  };
  const editInput = (cls, extra = {}) => (
    <input autoFocus value={edit.value} onFocus={(x) => x.target.select()}
      onChange={(x) => setEdit({ ...edit, value: x.target.value })}
      onKeyDown={(x) => { if (x.key === "Enter") commitEdit(false); if (x.key === "Escape") setEdit(null); }}
      onBlur={() => commitEdit(true)}
      className={`h-7 rounded border border-teal-700 bg-slate-900 px-2 text-xs text-slate-100 focus:outline-none ${cls}`} {...extra} />
  );

  /* Chuyển vai trò sang phòng ban khác: nhóm của các tác vụ thuộc vai trò đó đổi theo. */
  const moveRole = async (id, dept) => {
    const r = roles.find((x) => x.id === id);
    if (!r || r.dept === dept) return;
    const ok = await saveCfg({
      ...cfg,
      roles: roles.map((x) => (x.id === id ? { ...x, dept } : x)),
      tasks: cfg.tasks.map((t) => (taskRoles(t)[0] === id ? { ...t, group: dept } : t)),
    });
    if (ok !== false) flash(`Đã chuyển ${id} sang ${dept}.`);
  };
  /* Một lần nhấn trên chip vai trò: nhích quá 6px là kéo (chỉ bằng chuột), không nhích là bấm.
     Bấm vào tên -> sửa tên. Bấm đúp vào mã -> sửa mã. */
  const deptAt = (x, y) => document.elementFromPoint(x, y)?.closest("[data-dept-row]")?.getAttribute("data-dept-row") || null;
  const onChipDown = (ev, r) => {
    if (ev.button !== 0 || ev.target.closest("button")) return;
    const box = ev.currentTarget.getBoundingClientRect();
    const p = { id: r.id, onCode: !!ev.target.closest("[data-role-code]"), mouse: ev.pointerType !== "touch", x0: ev.clientX, y0: ev.clientY, dx: ev.clientX - box.left, dy: ev.clientY - box.top, w: box.width, moved: false };
    press.current = p;
    const move = (e) => {
      if (!p.moved) {
        if (!p.mouse || Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) return;
        p.moved = true;
      }
      setDrag({ id: p.id, x: e.clientX - p.dx, y: e.clientY - p.dy, w: p.w });
      setOverDept(deptAt(e.clientX, e.clientY));
    };
    const stop = (e, cancelled) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      press.current = null; setDrag(null); setOverDept(null);
      if (cancelled) return;
      if (p.moved) { const d = deptAt(e.clientX, e.clientY); if (d) moveRole(p.id, d); return; }
      if (!p.onCode) { setEdit({ kind: "role", key: r.id, value: r.name }); return; }
      const now = Date.now(), last = lastCodeTap.current;
      if (last.id === r.id && now - last.at < 400) { lastCodeTap.current = { id: "", at: 0 }; setEdit({ kind: "code", key: r.id, value: r.id }); }
      else lastCodeTap.current = { id: r.id, at: now };
    };
    const up = (e) => stop(e, false);
    const cancel = (e) => stop(e, true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };
  const dragRole = drag ? roles.find((r) => r.id === drag.id) : null;

  const addLeave = async () => {
    const name = leaveName.trim();
    if (!name) return flash("Nhập tên loại nghỉ.", "err");
    if (leaves.some((x) => x.label.toLowerCase() === name.toLowerCase())) return flash("Loại nghỉ này đã có.", "err");
    const id = "x" + Date.now().toString(36);
    const ok = await saveCfg({ ...cfg, leaveTypes: [...leaves, { id, label: name, short: leaveShort(name), cls: LEAVE_PALETTE[leaves.length % LEAVE_PALETTE.length] }] });
    if (ok !== false) { setLeaveName(""); flash("Đã thêm loại nghỉ."); }
  };
  const commitLeave = async () => {
    const name = leaveEditName.trim();
    if (!name) return flash("Tên loại nghỉ không được để trống.", "err");
    if (leaves.some((x) => x.id !== leaveEditId && x.label.toLowerCase() === name.toLowerCase())) return flash("Loại nghỉ này đã có.", "err");
    const ok = await saveCfg({ ...cfg, leaveTypes: leaves.map((x) => (x.id === leaveEditId ? { ...x, label: name, short: leaveShort(name) } : x)) });
    if (ok !== false) { setLeaveEditId(null); flash("Đã đổi tên loại nghỉ."); }
  };
  const confirmDelLeave = async () => {
    const t = pendingLeaveDel; setPendingLeaveDel(null);
    if (!t) return;
    await saveCfg({ ...cfg, leaveTypes: leaves.filter((x) => x.id !== t.id) });
    flash("Đã xoá loại nghỉ.");
  };
  const delRoleTaskCount = pendingRoleDel ? cfg.tasks.filter((t) => taskRoles(t).length === 1 && taskRoles(t)[0] === pendingRoleDel.id).length : 0;
  const delRoleEmpCount = pendingRoleDel ? cfg.employees.filter((e) => e.role === pendingRoleDel.id).length : 0;

  const panelCls = "rounded-xl border border-slate-800 bg-slate-900";
  const chipCls = "inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 py-1 pl-3 pr-1 text-sm text-slate-300";
  const miniDel = "rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400";
  // nút vuông 44px đứng cạnh ô nhập (iconBtn cao 36px nên lệch hàng với ô nhập 44px)
  const sqBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100";

  /* ---------------- tab con Tác vụ: trái = vai trò gom theo phòng ban, phải = tác vụ của vai trò đang chọn ---------------- */
  const kw = norm(q.trim());
  const roleHit = (r) => !kw || norm(`${r.id} ${r.name} ${r.dept}`).includes(kw);
  const roleGroups = deptOrder.map((d) => ({ dept: d, list: roles.filter((r) => r.dept === d && roleHit(r)) })).filter((g) => g.list.length);
  const showShared = !kw || norm("dùng chung").includes(kw);
  const roleBtn = (key, code, name) => {
    const n = listOf(key).length;
    const on = cur === key;
    return (
      <button key={key} onClick={() => { setSel(key); setEditId(null); }}
        className={`relative flex min-h-[40px] w-full items-center gap-2 rounded-md pl-3.5 pr-2.5 text-left text-sm ${on ? "bg-slate-800 text-slate-100" : "text-slate-300 hover:bg-slate-800"}`}>
        {on && <span className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-full bg-teal-400" />}
        <span className="w-12 shrink-0 font-mono text-xs text-teal-400">{code}</span>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className={`shrink-0 font-mono text-xs ${n ? "text-slate-400" : "text-slate-600"}`}>{n}</span>
      </button>
    );
  };
  const groupHead = (label, n) => (
    <div className="sticky top-0 z-10 mt-3 flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-[#1a2740] px-2.5 py-2 text-xs uppercase tracking-wider text-slate-100 first:mt-0">
      <span className="min-w-0 truncate">{label}</span>
      {n != null && <span className="shrink-0 font-mono tracking-normal text-slate-400">{n}</span>}
    </div>
  );
  const curList = listOf(cur);
  const taskTab = (
    <div className="grid items-start gap-3 md:grid-cols-[300px_minmax(0,1fr)] md:gap-4">
      <div className={`hidden p-3 md:block ${panelCls}`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm vai trò" className={inputCls} />
        <div className="mt-2 flex max-h-[68vh] flex-col gap-0.5 overflow-y-auto">
          {roleGroups.map((g) => (
            <React.Fragment key={g.dept}>
              {groupHead(g.dept, g.list.length)}
              {g.list.map((r) => roleBtn(`r:${r.id}`, r.id, r.name))}
            </React.Fragment>
          ))}
          {showShared && <>{groupHead("Mọi vai trò", null)}{roleBtn(SHARED, "", "Dùng chung")}</>}
          {!roleGroups.length && !showShared && <div className="px-2 py-4 text-sm text-slate-500">Không có vai trò khớp.</div>}
        </div>
      </div>

      <div className={`min-w-0 ${panelCls}`}>
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-3 py-3 md:px-4">
          <h3 className="min-w-0 truncate text-sm font-medium text-slate-100">
            {curRole ? <><span className="font-mono text-xs text-teal-400">{curRole.id}</span> · {curRole.name}</> : "Dùng chung"}
          </h3>
          <span className="shrink-0 text-xs text-slate-500">{curRole ? curRole.dept : "Mọi vai trò"}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-slate-500">{curList.length}</span>
        </div>
        <div className="p-3 md:p-4">
          {/* mobile: cột vai trò thu thành một ô chọn */}
          <select value={cur} onChange={(e) => { setSel(e.target.value); setEditId(null); }} className={`mb-3 md:hidden ${selectCls}`}>
            {deptOrder.map((d) => {
              const rs = roles.filter((r) => r.dept === d);
              return rs.length ? (
                <optgroup key={d} label={d}>
                  {rs.map((r) => <option key={r.id} value={`r:${r.id}`}>{r.id} · {r.name} ({listOf(`r:${r.id}`).length})</option>)}
                </optgroup>
              ) : null;
            })}
            <option value={SHARED}>Dùng chung ({listOf(SHARED).length})</option>
          </select>
          <div className="flex gap-2">
            <input value={drafts[cur] || ""} onChange={(e) => setDraft(cur, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add(cur)}
              placeholder="Thêm tác vụ rồi Enter" className={`min-w-0 flex-1 ${inputCls}`} />
            <button onClick={() => add(cur)} className={`${sqBtn}`}><Plus size={15} /></button>
          </div>

          {curList.length === 0 ? <div className="px-1 pt-4 text-sm text-slate-500">Chưa có tác vụ.</div> : (
            <div className="mt-2 divide-y divide-slate-800">
              {curList.map((t) => (
                <div key={t.id}
                  draggable={!isIdleTask(t.id) && editId !== t.id && curList.length > 1}
                  onDragStart={(e) => { setDragTask(t.id); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", t.id); } catch { /* bỏ qua */ } }}
                  onDragOver={(e) => {
                    if (!dragTask || isIdleTask(t.id)) return;   // v7.2: Trống việc luôn đứng đầu
                    e.preventDefault();
                    const b = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > b.top + b.height / 2;
                    if (dropAt?.id !== t.id || dropAt?.after !== after) setDropAt({ id: t.id, after });
                  }}
                  onDrop={(e) => { e.preventDefault(); const d = dropAt; const from = dragTask; endDrag(); if (d) moveTask(from, d.id, d.after); }}
                  onDragEnd={endDrag}
                  className={`relative py-2 text-sm ${dragTask === t.id ? "opacity-40" : ""}`}>
                  {dragTask && dropAt?.id === t.id && dragTask !== t.id && (
                    <div className={`pointer-events-none absolute left-0 right-0 h-0.5 rounded-full bg-teal-400 ${dropAt.after ? "-bottom-px" : "-top-px"}`} />
                  )}
                  {editId === t.id ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2 md:flex-row">
                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditId(null); }} className={`min-w-0 md:flex-1 ${inputCls}`} />
                        <div className="flex gap-2">
                          {!isIdleTask(t.id) && (
                          <select value={editOwner} onChange={(e) => setEditOwner(e.target.value)} className={`min-w-0 flex-1 md:w-56 md:flex-none ${selectCls}`}>
                            {boxes.map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
                          </select>
                          )}
                          <button onClick={commit} className={`${sqBtn} border-teal-800 text-teal-400`}><Check size={15} /></button>
                          <button onClick={() => setEditId(null)} className={`${sqBtn}`}><X size={15} /></button>
                        </div>
                      </div>
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={200}
                        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditId(null); }}
                        placeholder="Mô tả" className={inputCls} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      {curList.length > 1 && !isIdleTask(t.id) && (
                        <span className="-ml-1 hidden shrink-0 cursor-grab text-slate-600 hover:text-slate-300 active:cursor-grabbing md:block" title="Kéo để đổi thứ tự">
                          <GripVertical size={15} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline gap-1.5">
                          {t.code && <span className="shrink-0 font-mono text-[10px] text-teal-500">{t.code}</span>}
                          <span className="min-w-0 text-slate-200">{t.name}</span>
                          {isIdleTask(t.id) && <span className="shrink-0 rounded border border-slate-600 px-1.5 text-[10px] text-slate-400">không tính tải</span>}
                        </div>
                        {t.desc && <div className="mt-0.5 text-xs text-slate-500">{t.desc}</div>}
                      </div>
                      {isIdleTask(t.id) ? (
                        /* v7.2: tác vụ hệ thống — đổi được tên / mô tả, không xoá, không kéo đổi chỗ */
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="flex h-8 w-8 items-center justify-center text-slate-600" title="Tác vụ hệ thống — không xoá, không đổi chỗ"><Lock size={13} /></span>
                          <button onClick={() => startEdit(t)} className={iconBtn} title="Đổi tên / mô tả"><Pencil size={13} /></button>
                        </div>
                      ) : (
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={() => startEdit(t)} className={iconBtn}><Pencil size={13} /></button>
                        <button onClick={() => setPendingDel(t)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={13} /></button>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ---------------- tab con Phòng ban & vai trò ---------------- */
  const orgTab = (
    <div className="space-y-3 md:space-y-4">
      <div className={panelCls}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-3 md:px-4">
          <h3 className="text-sm font-medium text-slate-100">Phòng ban</h3>
          <span className="shrink-0 font-mono text-xs text-slate-500">{depts.length}</span>
        </div>
        <div className="p-3 md:p-4">
          <div className="flex gap-2">
            <input value={deptName} onChange={(e) => setDeptName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDept()}
              placeholder="Thêm phòng ban rồi Enter" className={`min-w-0 flex-1 ${inputCls}`} />
            <button onClick={addDept} className={`${sqBtn}`}><Plus size={15} /></button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {depts.map((d) => edit?.kind === "dept" && edit.key === d ? (
              <span key={d} className={`${chipCls} border-teal-800 pl-1`}>{editInput("w-48 max-w-[60vw]")}</span>
            ) : d === LOCKED_DEPT ? (
              <span key={d} className={chipCls}>{d}<span title="Cố định: quyết định quyền xem toàn bộ tác vụ" className="p-1.5 text-slate-600"><Lock size={13} /></span></span>
            ) : (
              <span key={d} onClick={(e) => { if (!e.target.closest("button")) setEdit({ kind: "dept", key: d, value: d }); }}
                className={`${chipCls} cursor-text hover:border-slate-500`}>
                {d}
                <button onClick={() => delDept(d)} title="Xoá phòng ban" className={miniDel}><Trash2 size={13} /></button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={panelCls}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-3 md:px-4">
          <h3 className="text-sm font-medium text-slate-100">Vai trò</h3>
          <span className="shrink-0 font-mono text-xs text-slate-500">{roles.length}</span>
        </div>
        <div className="p-3 md:p-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <input value={roleCode} onChange={(e) => setRoleCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()}
              placeholder="Mã, ví dụ MEP" maxLength={8} className={`font-mono md:w-40 ${inputCls}`} />
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()}
              placeholder="Tên vai trò" className={`min-w-0 md:flex-1 ${inputCls}`} />
            <select value={roleDept} onChange={(e) => setRoleDept(e.target.value)} className={`md:w-56 ${selectCls}`}>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button onClick={addRole} className={`shrink-0 whitespace-nowrap ${btnPrimary}`}><Plus size={14} /> Thêm vai trò</button>
          </div>

          {/* mỗi phòng ban một dòng, kể cả phòng ban chưa có vai trò — để có chỗ thả vai trò vào */}
          <div className="mt-3 divide-y divide-slate-800">
            {deptOrder.map((d) => (
              <div key={d} data-dept-row={d}
                className={`grid gap-1.5 rounded-md px-2 py-2.5 md:grid-cols-[180px_minmax(0,1fr)] md:gap-3 ${overDept === d ? "bg-teal-950 ring-1 ring-inset ring-teal-800" : ""}`}>
                <div className="text-xs uppercase tracking-wider text-slate-400 md:pt-2.5">{d}</div>
                <div className="flex min-h-[36px] flex-wrap gap-2">
                  {roles.filter((r) => r.dept === d).map((r) => edit?.kind === "role" && edit.key === r.id ? (
                    <span key={r.id} className={`${chipCls} border-teal-800`}>
                      <span className="font-mono text-xs text-teal-400">{r.id}</span>{editInput("w-44 max-w-[50vw]")}
                    </span>
                  ) : edit?.kind === "code" && edit.key === r.id ? (
                    <span key={r.id} className={`${chipCls} border-teal-800 pl-1 pr-3`}>
                      {editInput("w-24 font-mono uppercase text-teal-400", { maxLength: 8 })}{r.name}
                    </span>
                  ) : (
                    <span key={r.id} onPointerDown={(e) => onChipDown(e, r)}
                      className={`${chipCls} cursor-grab select-none hover:border-slate-500 ${drag?.id === r.id ? "opacity-30" : ""}`}>
                      <span data-role-code className="font-mono text-xs text-teal-400">{r.id}</span>
                      <span className="min-w-0">{r.name}</span>
                      <button onClick={() => setPendingRoleDel(r)} title="Xoá vai trò" className={miniDel}><Trash2 size={13} /></button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bóng của vai trò đang kéo, bám theo con trỏ */}
      {drag && dragRole && (
        <span style={{ left: drag.x, top: drag.y, width: drag.w }}
          className={`${chipCls} pointer-events-none fixed z-50 cursor-grabbing border-teal-400 shadow-2xl`}>
          <span className="font-mono text-xs text-teal-400">{dragRole.id}</span>
          <span className="min-w-0 truncate">{dragRole.name}</span>
        </span>
      )}
    </div>
  );

  /* ---------------- tab con Vắng mặt ---------------- */
  const leaveTab = (
    <div className={panelCls}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-3 md:px-4">
        <h3 className="text-sm font-medium text-slate-100">Vắng mặt</h3>
        <span className="shrink-0 font-mono text-xs text-slate-500">{leaves.length}</span>
      </div>
      <div className="p-3 md:p-4">
        <div className="flex gap-2">
          <input value={leaveName} onChange={(e) => setLeaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLeave()}
            placeholder="Thêm loại nghỉ rồi Enter" className={`min-w-0 flex-1 ${inputCls}`} />
          <button onClick={addLeave} className={`${sqBtn}`}><Plus size={15} /></button>
        </div>
        {leaves.length > 0 && (
          <div className="mt-2 divide-y divide-slate-800">
            {leaves.map((x) => (
              <div key={x.id} className="py-2 text-sm">
                {leaveEditId === x.id ? (
                  <div className="flex gap-2">
                    <input autoFocus value={leaveEditName} onChange={(e) => setLeaveEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitLeave(); if (e.key === "Escape") setLeaveEditId(null); }} className={`min-w-0 flex-1 ${inputCls}`} />
                    <button onClick={commitLeave} className={`${sqBtn} border-teal-800 text-teal-400`}><Check size={15} /></button>
                    <button onClick={() => setLeaveEditId(null)} className={`${sqBtn}`}><X size={15} /></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-slate-200">{x.label}</span>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => { setLeaveEditId(x.id); setLeaveEditName(x.label); }} className={iconBtn}><Pencil size={13} /></button>
                      <button onClick={() => setPendingLeaveDel(x)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`space-y-3 md:space-y-4 ${drag ? "cursor-grabbing select-none" : ""}`}>
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
        {[["task", "Tác vụ"], ["org", "Phòng ban & vai trò"], ["leave", "Vắng mặt"]].map(([k, l]) => (
          <button key={k} onClick={() => { setSub(k); setEdit(null); setEditId(null); setLeaveEditId(null); }}
            className={`h-9 whitespace-nowrap rounded-md px-4 text-sm ${sub === k ? "bg-slate-800 font-medium text-slate-50" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
        ))}
      </div>

      {sub === "task" && orphans && Object.keys(orphans).length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-900/70 bg-amber-950/20 px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-amber-400" />
          <span className="min-w-0 flex-1 text-sm text-amber-200">
            Còn {fmtH(Object.values(orphans).reduce((a, h) => a + Number(h || 0), 0))} h chấm vào {Object.keys(orphans).length} tác vụ đã xoá trước đây
            — đang hiện là "(tác vụ đã xoá)" và vẫn cộng vào tổng giờ dự án.
          </span>
          <button onClick={() => setPurgeAsk(true)} className={btnDanger}><Trash2 size={14} /> Xoá hẳn</button>
        </div>
      )}

      {sub === "task" ? taskTab : sub === "org" ? orgTab : leaveTab}

      <ConfirmDialog
        open={purgeAsk}
        title="Xoá hẳn giờ của các tác vụ đã xoá?"
        desc={`Xoá ${fmtH(Object.values(orphans || {}).reduce((a, h) => a + Number(h || 0), 0))} h đã chấm vào ${Object.keys(orphans || {}).length} tác vụ không còn tồn tại, trên toàn bộ bảng công. Tổng giờ dự án và giờ của nhân sự liên quan giảm tương ứng. Không khôi phục được.`}
        confirmLabel="Xoá hẳn"
        onConfirm={async () => {
          setPurgeAsk(false);
          const h = await purgeTaskHours(Object.keys(orphans || {}), flash);
          if (h !== null) { flash(`Đã xoá ${fmtH(h)} h của các tác vụ đã xoá.`); setOrphans({}); }
        }}
        onCancel={() => setPurgeAsk(false)}
      />

      <ConfirmDialog
        open={!!pendingRoleDel}
        title={`Xoá vai trò ${pendingRoleDel ? roleLabel(pendingRoleDel.id) : ""}?`}
        desc={`${delRoleTaskCount} tác vụ của vai trò này sẽ bị xoá cùng giờ công đã chấm vào chúng (không khôi phục được); ${delRoleEmpCount} nhân sự đang giữ vai trò này sẽ thành không phân vai trò (chỉ thấy tác vụ dùng chung).`}
        confirmLabel="Xoá vai trò và tác vụ"
        onConfirm={confirmDelRole}
        onCancel={() => setPendingRoleDel(null)}
      />

      <ConfirmDialog
        open={!!pendingLeaveDel}
        title={`Xoá loại nghỉ ${pendingLeaveDel?.label || ""}?`}
        desc="Nhân sự sẽ không chọn được loại nghỉ này nữa. Giờ đã chấm vẫn giữ nguyên, báo cáo sẽ hiển thị là (tác vụ đã xoá)."
        confirmLabel="Xoá loại nghỉ"
        onConfirm={confirmDelLeave}
        onCancel={() => setPendingLeaveDel(null)}
      />

      <ConfirmDialog
        open={!!pendingDel}
        title={`Xoá tác vụ ${pendingDel?.name || ""}?`}
        desc={(() => { const h = pendingDel ? hoursOfTasks([pendingDel.id]) : 0;
          return `Tác vụ biến mất khỏi mọi màn hình và báo cáo.${h > 0 ? ` Xoá luôn ${fmtH(h)} h đã chấm vào tác vụ này (kể cả tăng ca cho tác vụ này) — tổng giờ dự án giảm tương ứng.` : " Chưa có giờ nào chấm vào tác vụ này."} Không khôi phục được.`; })()}
        confirmLabel="Xoá tác vụ và giờ đã chấm"
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
    </div>
  );
}

