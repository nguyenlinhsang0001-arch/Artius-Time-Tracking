/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download, Plus, Trash2, Loader2, Lock, RotateCcw, Pencil, Check, X, Copy, Unlock, Eye, EyeOff, UserMinus, UserCheck,
} from "lucide-react";
import { fetchTsStamps } from "../data.js";
import { accountsApi, normUsername, USERNAME_RE, PASSWORD_MIN } from "../auth.js";
import { fmt, pad } from "../core/date.jsx";
import { dbTsSent, empHoursAll, loadXlsx, purgeEmpTs, useDataTick } from "../core/db.jsx";
import { DEPTS, LEAVE_TASKS, NO_PROJECT, OT_TASKS, ROLES, fmtH, isLeaveTask, isResigned, norm, roleInfo, roleLabel, roleTitle, supportList, taskText, uid, useIsMobile } from "../core/domain.jsx";
import { ConfirmDialog, btnBase, btnGhost, btnPrimary, iconBtn, inputCls, selectCls } from "../core/ui.jsx";
import { SupportPanel } from "../shared/support.jsx";
import { Dashboard } from "./dashboard/Dashboard.jsx";

/* ============================ NHÂN SỰ ============================ */
/* v1.7: kiểm tra phần tài khoản của một dòng. Trả về thông điệp lỗi, hoặc null nếu hợp lệ.
   Bỏ trống cả hai ô = không tạo tài khoản (chỉ được phép khi dòng đó chưa có tài khoản). */
/* v7.3 — 4 cấp quyền của tài khoản */
export const ACCESS_LEVELS = [["emp", "Nhân viên"], ["head", "Trưởng phòng"], ["bod", "BOD"], ["admin", "Admin"]];
export const accessOfAcc = (a) => a?.access || (a?.isAdmin ? "admin" : "emp");
export const accessLabel = (k) => ACCESS_LEVELS.find((x) => x[0] === k)?.[1] || "";
export const accountError = (acc, d) => {
  const u = normUsername(d.username), p = d.password || "";
  if (!acc && !u && !p) return null;
  if (!USERNAME_RE.test(u)) return "Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch.";
  if (p.length < PASSWORD_MIN) return `Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.`;
  return null;
};

/* Ô mật khẩu ở chế độ xem: che mặc định, bấm con mắt để hiện */
export function PasswordCell({ value, shown, onToggle }) {
  if (!value) return <span className="text-slate-600">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-slate-300">{shown ? value : "••••••"}</span>
      <button onClick={onToggle} className="text-slate-500 hover:text-slate-200">{shown ? <EyeOff size={14} /> : <Eye size={14} />}</button>
    </span>
  );
}

/* Tên đăng nhập gợi ý từ họ tên: "Đỗ Thị Thảo" -> thao.dt ; trùng thì thêm số 2, 3… */
export const suggestUsername = (name, taken) => {
  const w = norm(name).replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const base = w.length > 1 ? `${w[w.length - 1]}.${w.slice(0, -1).map((x) => x[0]).join("")}` : w[0];
  let u = base.length < 3 ? `${base}01` : base;
  for (let i = 2; taken.has(u); i++) u = `${base}${i}`;
  return u.slice(0, 30);
};
/* Mật khẩu ngẫu nhiên 8 ký tự, bỏ các ký tự dễ nhầm (0/o, 1/l/i) */
export const genPassword = () => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(8);
  (typeof crypto !== "undefined" && crypto.getRandomValues) ? crypto.getRandomValues(buf) : buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 4294967296); });
  return Array.from(buf, (n) => a[n % a.length]).join("");
};
export const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* trình duyệt chặn clipboard API: thử cách cũ */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
};

export function Employees({ cfg, saveCfg, flash, readOnly = false, onSupport = null, limited = false }) {
  /* v9.3 — limited = trưởng phòng: chỉ thấy nhân viên phòng mình (cfg đã lọc), chỉ giao / gỡ dự án; không xem tài khoản, mật khẩu,
     không thêm / sửa / xoá / cho nghỉ việc. Ghi qua hàm SQL artius_emp_projects_set (kiểm tra đúng phòng ban). */
  const [sub, setSub] = useState("emp");              // tab con: emp | admin
  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("");
  const [fStatus, setFStatus] = useState("");         // "" | none | active | locked
  const [accounts, setAccounts] = useState(null);     // null = đang tải / tải hỏng
  const [shown, setShown] = useState({});             // id tài khoản đang hiện mật khẩu
  const [busy, setBusy] = useState(false);
  /* Khung thêm / sửa: { kind: "emp" | "admin", empId, accId, hadAcc, autoUser, f: {...} } */
  const [dlg, setDlg] = useState(null);
  const [pendingDel, setPendingDel] = useState(null); // nhân sự chờ xác nhận xoá
  const [resignDlg, setResignDlg] = useState(null);   // v8.5: { e, date } — đánh dấu nghỉ việc
  const [delDlg, setDelDlg] = useState(null);         // v8.5: { kind: "emp" | "orphan", e?, id, mode: "keep" | "purge", txt, info }
  const [goneHrs, setGoneHrs] = useState(null);       // v8.5: giờ công (mọi tháng) của người đã nghỉ { id: {...} }
  const [orphanHrs, setOrphanHrs] = useState(null);   // v8.5: giờ công còn lại của nhân sự đã xoá trước đây { id: {...} }
  /* v6.9 (mẫu C) — sửa "Dự án đang tham gia" ngay trên danh sách: { kind: "add" | "copy", eid, x, y, q } */
  const [pp, setPp] = useState(null);
  /* v12.28 — điện thoại: không tự bật bàn phím khi mở bảng chọn, để danh sách không bị bàn phím che ngay từ đầu */
  const isWide = !useIsMobile();
  useEffect(() => {
    if (!pp) return;
    const close = () => setPp(null);
    const esc = (ev) => { if (ev.key === "Escape") setPp(null); };
    /* v12.28 — chỉ đóng khi BỀ NGANG đổi (xoay máy, kéo cửa sổ). Trước đây đóng ở mọi lần resize, mà trên điện thoại
       bàn phím ảo bật lên hoặc thanh địa chỉ co giãn khi cuộn đều đổi chiều cao và phát resize — bảng vừa mở đã tự tắt. */
    const w0 = window.innerWidth;
    const onResize = () => { if (window.innerWidth !== w0) close(); };
    document.addEventListener("click", close); document.addEventListener("keydown", esc); window.addEventListener("resize", onResize);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); window.removeEventListener("resize", onResize); };
  }, [!!pp]); // eslint-disable-line react-hooks/exhaustive-deps
  const projLabel = (p) => (p.code ? `[${p.code}] ${p.name}` : p.name);
  const empProjs = (e) => (Array.isArray(e.projects) ? e.projects : []).filter((pid) => cfg.projects.some((p) => p.id === pid));
  const setEmpProjs = (eid, list) => saveCfg({ ...cfg, employees: cfg.employees.map((x) => (x.id === eid ? { ...x, projects: list } : x)) });
  // v12.17: có tính người này vào Kế hoạch nguồn lực (quân số, giờ thực tế) hay không
  const setNoPlan = async (eid, on) => {
    const ok = await saveCfg({ ...cfg, employees: cfg.employees.map((x) => { if (x.id !== eid) return x; const { noPlan, ...rest } = x; return on ? { ...rest, noPlan: true } : rest; }) });   // eslint-disable-line no-unused-vars
    if (ok !== false) flash(on ? "Đã bỏ người này khỏi Kế hoạch nguồn lực." : "Đã tính lại người này vào Kế hoạch nguồn lực.");
  };
  // v8.8: bật / tắt quyền Tất cả dự án (danh sách dự án đã chọn giữ nguyên để tắt lại thì quay về)
  const setAllProj = async (eid, on) => {
    const ok = await saveCfg({ ...cfg, employees: cfg.employees.map((x) => { if (x.id !== eid) return x; const { allProjects, ...rest } = x; return on ? { ...rest, allProjects: true } : rest; }) });   // eslint-disable-line no-unused-vars
    if (ok !== false) flash(on ? "Đã cho chấm vào tất cả dự án đang mở (kể cả dự án thêm sau)." : "Đã tắt Tất cả dự án — quay về danh sách dự án đã chọn.");
  };
  const openPp = (ev, kind, eid) => {
    ev.stopPropagation();
    const r = ev.currentTarget.getBoundingClientRect(), W = 320;
    setPp({ kind, eid, q: "", x: Math.max(8, Math.min(window.innerWidth - W - 8, r.left)), y: r.bottom + 6, top: r.top });
  };
  const [pendingAcc, setPendingAcc] = useState(null); // tài khoản không gắn nhân sự chờ xác nhận xoá

  useEffect(() => {
    let alive = true;
    if (readOnly || limited) { setAccounts([]); return () => { alive = false; }; }   // v9.3: trưởng phòng cũng không đọc tài khoản / mật khẩu   // v7.7: BOD không xem tài khoản đăng nhập / mật khẩu
    (async () => {
      try { const r = await accountsApi("list"); if (alive) setAccounts(r.accounts); }
      catch (e) { if (alive) flash(e.message, "err"); }
    })();
    return () => { alive = false; };
  }, [flash]);

  const accByEmp = useMemo(() => new Map((accounts || []).filter((a) => a.empId).map((a) => [a.empId, a])), [accounts]);
  // tài khoản không gắn nhân sự: tài khoản quản lý tạo lúc đầu, hoặc nhân sự gắn kèm không còn
  const loose = useMemo(() => {
    const ids = new Set(cfg.employees.map((e) => e.id));
    return (accounts || []).filter((a) => !a.empId || !ids.has(a.empId));
  }, [accounts, cfg.employees]);
  const mergeAcc = (a) => setAccounts((list) => {
    const rest = (list || []).filter((x) => x.id !== a.id);
    return [...rest, a].sort((x, y) => x.username.localeCompare(y.username));
  });
  const toggleShown = (id) => setShown((m) => ({ ...m, [id]: !m[id] }));
  const takenUsernames = (exceptAccId) => new Set((accounts || []).filter((a) => a.id !== exceptAccId).map((a) => a.username));

  /* Dự án đang tham gia: dự án nhân sự đã GỬI ít nhất 1 giờ trong tháng này (tự động theo giờ công) */
  const now = new Date();
  const thisYm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const empIdsKey = cfg.employees.map((e) => e.id).join(",");
  const dataTick = useDataTick();
  const projByEmp = useMemo(() => {
    const label = new Map(cfg.projects.map((p) => [p.id, p.code ? `[${p.code}] ${p.name}` : p.name]));
    const map = new Map();
    for (const e of cfg.employees) {
      const pids = new Set();
      for (const r of dbTsSent(e.id, thisYm)?.rows || []) {   // v1.9: chỉ tính giờ đã gửi
        if (label.has(r.projectId) && Object.values(r.days || {}).some((v) => v > 0)) pids.add(r.projectId);
      }
      map.set(e.id, [...pids].map((id) => label.get(id)));
    }
    return map;
  }, [empIdsKey, cfg.projects, thisYm, dataTick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- lọc và gom nhóm ---- */
  const statusOf = (e) => { const a = accByEmp.get(e.id); return !a ? "none" : a.disabled ? "locked" : "active"; };
  const kw = norm(q.trim());
  const actList = cfg.employees.filter((e) => !isResigned(e));   // v8.5: tab Nhân sự chỉ còn người đang làm
  const visible = actList.filter((e) => {
    if (fDept && e.dept !== fDept) return false;
    if (fStatus && statusOf(e) !== fStatus) return false;
    return !kw || norm(`${e.code || ""} ${e.name} ${accByEmp.get(e.id)?.username || ""} ${e.role || ""} ${roleInfo(e.role)?.name || ""}`).includes(kw);
  });
  // phòng ban theo thứ tự khai báo; nhân sự mang tên phòng ban lạ (dữ liệu cũ) xếp cuối để không bị mất dấu
  const deptOrder = [...DEPTS, ...cfg.employees.map((e) => e.dept).filter((d, i, a) => !DEPTS.includes(d) && a.indexOf(d) === i)];
  const groups = deptOrder.map((d) => ({ dept: d, list: visible.filter((e) => e.dept === d) })).filter((g) => g.list.length);

  /* Tạo hoặc cập nhật tài khoản. Trả về true nếu xong hoặc không có gì để làm. */
  const pushAccount = async (empId, acc, d) => {
    const u = normUsername(d.username), p = d.password || "", lv = d.access || "emp";
    if (!acc && !u) return true;
    if (acc && acc.username === u && acc.password === p && accessOfAcc(acc) === lv) return true;
    try {
      const r = await accountsApi("save", { id: acc?.id, empId, username: u, password: p, access: lv, isAdmin: lv === "admin" });
      mergeAcc(r.account);
      return true;
    } catch (e) { flash(e.message, "err"); return false; }
  };

  /* ---- khung thêm / sửa ---- */
  const openAdd = () => setDlg({ kind: "emp", empId: null, accId: null, hadAcc: false, autoUser: true,
    f: { code: "", name: "", dept: fDept || DEPTS[0], role: "", projects: [], username: "", password: genPassword(), access: "emp" } });
  const openEdit = (e) => {
    const a = accByEmp.get(e.id);
    // sửa người đã có sẵn: KHÔNG tự gợi ý tên đăng nhập khi đổi họ tên, kẻo đổi tên một người chưa có tài khoản
    // lại vô tình điền tên đăng nhập và bị chặn vì thiếu mật khẩu
    setDlg({ kind: "emp", empId: e.id, accId: a?.id || null, hadAcc: !!a, autoUser: false,
      f: { code: e.code || "", name: e.name, dept: e.dept, role: e.role || "", projects: Array.isArray(e.projects) ? e.projects : [], allProjects: !!e.allProjects, noPlan: !!e.noPlan, username: a?.username || "", password: a?.password || "", access: a ? accessOfAcc(a) : "emp" } });
  };
  const openAddAdmin = () => setDlg({ kind: "admin", empId: null, accId: null, hadAcc: false, autoUser: false, f: { username: "", password: genPassword(), access: "admin" } });
  const openEditAdmin = (a) => setDlg({ kind: "admin", empId: a.empId || null, accId: a.id, hadAcc: true, autoUser: false, f: { username: a.username, password: a.password, access: accessOfAcc(a) } });
  const setF = (patch, extra = {}) => setDlg((d) => (d ? { ...d, ...extra, f: { ...d.f, ...patch } } : d));
  // gõ họ tên thì tên đăng nhập tự gợi ý, cho tới khi người dùng tự sửa ô tên đăng nhập
  const onNameChange = (v) => setDlg((d) => (d ? { ...d, f: { ...d.f, name: v, ...(d.autoUser ? { username: suggestUsername(v, takenUsernames(d.accId)) } : {}) } } : d));
  // đổi phòng ban thì bỏ vai trò không thuộc phòng ban mới
  const onDeptChange = (v) => setDlg((d) => (d ? { ...d, f: { ...d.f, dept: v, role: roleInfo(d.f.role)?.dept === v ? d.f.role : "" } } : d));

  const saveDlg = async (more) => {
    if (busy || !dlg) return;
    const { f } = dlg;
    const acc = dlg.accId ? (accounts || []).find((a) => a.id === dlg.accId) || null : null;
    if (dlg.kind === "emp") {
      const name = f.name.trim(), code = f.code.trim();
      if (!name) return flash("Nhập tên nhân sự.", "err");
      if (code && cfg.employees.some((e) => e.id !== dlg.empId && (e.code || "").toLowerCase() === code.toLowerCase())) return flash("Mã NV này đã có.", "err");
      // để trống tên đăng nhập = chưa tạo tài khoản (chỉ được phép khi người này chưa có tài khoản)
      const wantsAcc = !!acc || !!normUsername(f.username);
      const err = wantsAcc ? accountError(acc, f) : null;
      if (err) return flash(err, "err");
      setBusy(true);
      const id = dlg.empId || uid("e");
      const row = { code, name, dept: f.dept, role: f.role || "", projects: (f.projects || []).filter((pid) => cfg.projects.some((p) => p.id === pid)), allProjects: !!f.allProjects, noPlan: !!f.noPlan };   // v6.9 · v8.8 · v12.17
      const ok = await saveCfg({ ...cfg, employees: dlg.empId ? cfg.employees.map((e) => (e.id === id ? { ...e, ...row } : e)) : [...cfg.employees, { id, ...row }] });
      const accOk = ok !== false && (!wantsAcc || (await pushAccount(id, acc, f)));
      setBusy(false);
      if (ok === false) return;
      // nhân sự đã lưu nhưng tài khoản lỗi: chuyển khung sang chế độ sửa người đó để sửa tiếp phần tài khoản
      if (!accOk) return setDlg({ ...dlg, empId: id });
      flash(dlg.empId ? "Đã cập nhật nhân sự." : "Đã thêm nhân sự.");
      if (more) setDlg({ kind: "emp", empId: null, accId: null, hadAcc: false, autoUser: true, f: { code: "", name: "", dept: f.dept, role: "", projects: f.projects || [], allProjects: !!f.allProjects, noPlan: false, username: "", password: genPassword(), access: "emp" } });
      else setDlg(null);
      return;
    }
    const err = accountError(acc, f);
    if (err) return flash(err, "err");
    setBusy(true);
    const done = await pushAccount(dlg.empId, acc, f);
    setBusy(false);
    if (done) { setDlg(null); flash(acc ? "Đã cập nhật tài khoản." : "Đã thêm tài khoản."); }
  };
  useEffect(() => {
    if (!dlg) return;
    const h = (e) => { if (e.key === "Escape") setDlg(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [!!dlg]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Khoá / mở khoá: người bị khoá không đăng nhập được, giờ công đã chấm giữ nguyên */
  const toggleLock = async (a) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await accountsApi("setDisabled", { id: a.id, disabled: !a.disabled });
      mergeAcc(r.account);
      flash(r.account.disabled ? "Đã khoá tài khoản." : "Đã mở khoá tài khoản.");
    } catch (e) { flash(e.message, "err"); }
    setBusy(false);
  };
  /* ---------- v8.5: nghỉ việc / làm lại / xoá kèm giờ công ---------- */
  const hrsLabel = useMemo(() => ({
    proj: (r) => {
      if (r.projectId === NO_PROJECT || isLeaveTask(r.taskId)) return isLeaveTask(r.taskId) ? "Vắng mặt" : "Việc chung";
      const p = cfg.projects.find((x) => x.id === r.projectId);
      return p ? (p.code ? `[${p.code}] ${p.name}` : p.name) : "(dự án đã xoá)";
    },
    task: (r) => { const t = [...cfg.tasks, ...LEAVE_TASKS, ...OT_TASKS].find((x) => x.id === r.taskId); return t ? taskText(t) : "(tác vụ đã xoá)"; },
  }), [cfg.projects, cfg.tasks]);
  const goneList = cfg.employees.filter(isResigned);
  const goneKey = goneList.map((e) => e.id).join(",");
  // mở tab Nghỉ việc: đọc tổng giờ của người đã nghỉ + giờ còn sót của nhân sự đã xoá trước đây
  const loadGone = useCallback(async () => {
    if (readOnly || limited) return;
    try {
      const ids = new Set(cfg.employees.map((e) => e.id));
      const stamps = await fetchTsStamps("");
      const orphanIds = [...new Set(stamps.map((x) => x.empId))].filter((id) => !ids.has(id));
      const [g, o] = await Promise.all([empHoursAll(goneKey ? goneKey.split(",") : [], hrsLabel), empHoursAll(orphanIds, hrsLabel)]);
      setGoneHrs(g);
      setOrphanHrs(Object.fromEntries(Object.entries(o).filter(([, v]) => v.total > 0 || v.months.size)));
    } catch (e) { flash(e.message, "err"); }
  }, [goneKey, cfg.employees, hrsLabel, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  // đọc lại khi mở tab, khi danh sách nghỉ việc đổi, hoặc khi vừa xoá nhân sự (cfg mới → giờ của người vừa xoá chuyển sang khung "đã xoá")
  useEffect(() => { if (sub === "gone") loadGone(); }, [sub, goneKey, empIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const resign = async () => {
    const { e, date } = resignDlg || {};
    if (!e || busy) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return flash("Chọn ngày nghỉ việc.", "err");
    setBusy(true);
    const a = accByEmp.get(e.id);
    if (a && !a.disabled) {
      try { const r = await accountsApi("setDisabled", { id: a.id, disabled: true }); mergeAcc(r.account); }
      catch (err) { setBusy(false); return flash(`Chưa khoá được tài khoản — ${err.message}`, "err"); }
    }
    const ok = await saveCfg({ ...cfg, employees: cfg.employees.map((x) => (x.id !== e.id ? x
      : { ...x, resignedAt: date, projectsBefore: Array.isArray(x.projects) ? x.projects : [], projects: [], allProjects: false, ...(x.allProjects ? { allBefore: true } : {}) })) });
    setBusy(false);
    if (ok === false) return;
    setResignDlg(null);
    flash(`${e.name} đã chuyển sang Nghỉ việc${a ? " · tài khoản đã khoá" : ""}.`);
  };
  const rehire = async (e) => {
    if (busy) return;
    setBusy(true);
    const a = accByEmp.get(e.id);
    if (a?.disabled) {
      try { const r = await accountsApi("setDisabled", { id: a.id, disabled: false }); mergeAcc(r.account); }
      catch (err) { setBusy(false); return flash(`Chưa mở khoá được tài khoản — ${err.message}`, "err"); }
    }
    const ok = await saveCfg({ ...cfg, employees: cfg.employees.map((x) => {
      if (x.id !== e.id) return x;
      const { resignedAt, projectsBefore, allBefore, allProjects, ...rest } = x;   // eslint-disable-line no-unused-vars
      return { ...rest, ...(allBefore ? { allProjects: true } : {}), projects: (Array.isArray(projectsBefore) ? projectsBefore : []).filter((pid) => cfg.projects.some((p) => p.id === pid && p.active)) };
    }) });
    setBusy(false);
    if (ok !== false) flash(`${e.name} đã làm lại — có trong tab Nhân sự${a ? ", tài khoản đã mở khoá" : ""}.`);
  };
  // hộp xoá: đọc giờ công mọi tháng của người đó để biết sẽ mất bao nhiêu nếu chọn xoá luôn giờ
  const openDel = async (e) => {
    setDelDlg({ kind: "emp", e, id: e.id, mode: "keep", txt: "", info: null });
    try { const r = await empHoursAll([e.id], hrsLabel); setDelDlg((d) => (d && d.id === e.id ? { ...d, info: r[e.id] || { total: 0, sent: 0, months: new Set(), byProj: new Map(), rows: [] } } : d)); }
    catch (err) { flash(err.message, "err"); }
  };
  const openOrphanDel = (id) => setDelDlg({ kind: "orphan", id, mode: "purge", txt: "", info: orphanHrs?.[id] || null });
  const exportHours = async (list, file) => {
    const rows = [];
    for (const { name, code, info } of list) for (const r of [...(info?.rows || [])].sort((a, b) => a.date.localeCompare(b.date)))
      rows.push({ "Mã NV": code || "", "Nhân sự": name, "Ngày": r.date, "Dự án": r.proj, "Giai đoạn": r.phase, "Tác vụ": r.task, "Giờ": r.h, "Trạng thái": r.sent ? "Đã gửi" : "Nháp", "Ghi chú": r.note });
    if (!rows.length) return flash("Không có giờ công nào để xuất.", "err");
    const XLSX = await loadXlsx();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 26 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 34 }, { wch: 7 }, { wch: 10 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Giờ công");
    XLSX.writeFile(wb, `ARTIUS_gio-cong_${file}_${fmt(new Date())}.xlsx`);
    flash(`Đã xuất ${rows.length} dòng giờ công.`);
  };
  const doDelete = async () => {
    const d = delDlg; if (!d || busy) return;
    const purge = d.mode === "purge";
    if (purge && d.txt.trim().toUpperCase() !== "XOA") return flash("Gõ XOA để xác nhận xoá hẳn giờ công.", "err");
    setBusy(true);
    try {
      if (d.kind === "emp") {
        const a = accByEmp.get(d.id);
        if (a) { await accountsApi("remove", { id: a.id }); setAccounts((list) => (list || []).filter((x) => x.id !== a.id)); }
        if (purge) await purgeEmpTs(d.id);
        const ok = await saveCfg({ ...cfg, employees: cfg.employees.filter((x) => x.id !== d.id) });
        if (ok === false) { setBusy(false); return; }
        flash(purge ? `Đã xoá ${d.e.name} và ${fmtH(d.info?.total || 0)} h giờ công.` : `Đã xoá ${d.e.name} — giờ công giữ nguyên.`);
      } else {
        await purgeEmpTs(d.id);
        setOrphanHrs((o) => { const n = { ...(o || {}) }; delete n[d.id]; return n; });
        flash(`Đã xoá hẳn ${fmtH(d.info?.total || 0)} h giờ công của nhân sự đã xoá.`);
      }
      setDelDlg(null);
      if (sub === "gone" && d.kind === "orphan") loadGone();
    } catch (err) { flash(err.message, "err"); }
    setBusy(false);
  };

  const copyAccount = async (a, name) => {
    const ok = await copyText(`${name ? `${name}\n` : ""}Tên đăng nhập: ${a.username}\nMật khẩu: ${a.password}`);
    flash(ok ? `Đã chép tài khoản ${a.username}.` : "Trình duyệt không cho chép. Bấm con mắt để xem mật khẩu.", ok ? "ok" : "err");
  };
  const confirmDel = async () => {
    const e = pendingDel; setPendingDel(null);
    if (!e) return;
    const a = accByEmp.get(e.id);
    if (a) {
      // xoá tài khoản trước: nếu server từ chối (ví dụ tự xoá chính mình) thì giữ nguyên nhân sự
      try { await accountsApi("remove", { id: a.id }); setAccounts((list) => (list || []).filter((x) => x.id !== a.id)); }
      catch (err) { return flash(err.message, "err"); }
    }
    await saveCfg({ ...cfg, employees: cfg.employees.filter((x) => x.id !== e.id) });
    flash("Đã xoá nhân sự.");
  };
  const confirmDelAcc = async () => {
    const a = pendingAcc; setPendingAcc(null);
    if (!a) return;
    try { await accountsApi("remove", { id: a.id }); setAccounts((list) => (list || []).filter((x) => x.id !== a.id)); flash("Đã xoá tài khoản."); }
    catch (err) { flash(err.message, "err"); }
  };

  /* Xuất danh sách tài khoản (theo bộ lọc đang chọn) ra Excel để phát cho nhân viên */
  const exportAccounts = async () => {
    const XLSX = await loadXlsx();
    const rows = visible.filter((e) => accByEmp.has(e.id)).map((e) => {
      const a = accByEmp.get(e.id);
      return { "Mã NV": e.code || "", "Họ và tên": e.name, "Phòng ban": e.dept, "Vai trò": roleTitle(e.role), "Tên đăng nhập": a.username, "Mật khẩu": a.password, "Trạng thái": a.disabled ? "Đã khoá" : "Đang dùng" };
    });
    if (!rows.length) return flash("Không có tài khoản nào trong danh sách đang lọc.", "err");
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tài khoản");
    XLSX.writeFile(wb, `ARTIUS_tai-khoan_${fmt(new Date())}.xlsx`);
    flash(`Đã xuất ${rows.length} tài khoản.`);
  };

  const panelCls = "rounded-xl border border-slate-800 bg-slate-900";
  const COLS = "md:grid md:grid-cols-[72px_minmax(140px,210px)_170px_150px_110px_minmax(260px,1fr)_156px] md:items-center md:gap-3";
  // v7.3: nhãn cấp quyền (Nhân viên thì không hiện)
  const LV_CLS = { head: "border-sky-800 bg-sky-950 text-sky-300", bod: "border-violet-800 bg-violet-950 text-violet-300", admin: "border-teal-800 bg-teal-950 text-teal-300" };
  const lvBadge = (a) => { const k = accessOfAcc(a); return k === "emp" ? null : <span className={`rounded border px-1.5 py-0.5 text-[10px] ${LV_CLS[k]}`}>{accessLabel(k)}</span>; };
  const lockedBadge = <span className="rounded border border-rose-900 bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300">Đã khoá</span>;
  const none = <span className="text-slate-600">—</span>;
  const accBtns = (a, name) => (
    <>
      <button onClick={() => copyAccount(a, name)} title="Chép tài khoản" className={iconBtn}><Copy size={14} /></button>
      <button onClick={() => toggleLock(a)} title={a.disabled ? "Mở khoá" : "Khoá tài khoản"} className={`${iconBtn} ${a.disabled ? "border-rose-900 text-rose-400" : ""}`}>{a.disabled ? <Unlock size={14} /> : <Lock size={14} />}</button>
    </>
  );
  const sqBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100";

  /* ---------------- tab con Nhân sự ---------------- */
  const empRow = (e) => {
    const a = accByEmp.get(e.id);
    const dim = a?.disabled ? "text-slate-500" : "";
    const roleTag = e.role ? <span className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-teal-300">{roleLabel(e.role) || e.role}</span> : null;
    /* v12.17 — người không tính vào Kế hoạch nguồn lực (vd đang thử việc): hiện nhãn, bấm để bật lại */
    const roleEl = e.noPlan ? (
      <span className="inline-flex flex-wrap items-center gap-1">{roleTag}
        <button type="button" onClick={() => setNoPlan(e.id, false)} title="Đang không tính vào Kế hoạch nguồn lực — bấm để tính lại"
          className="ro-static rounded border border-amber-800 bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-300">Không tính KH</button>
      </span>
    ) : roleTag;
    // v6.9 (mẫu C): chip dự án có ✕ để gỡ; "+ Dự án" mở danh sách tích chọn
    const mine = empProjs(e);
    const projEl = e.allProjects ? (
      <span className="inline-flex h-8 items-center gap-1 rounded-md border border-teal-700 bg-teal-950 pl-2.5 text-xs font-medium text-teal-200">
        <Check size={13} /> Tất cả dự án
        <button onClick={() => setAllProj(e.id, false)} title="Tắt — quay về chọn từng dự án" aria-label="Tắt Tất cả dự án"
          className="ro-hide flex h-7 w-7 items-center justify-center rounded text-teal-400 hover:bg-rose-950 hover:text-rose-300"><X size={13} /></button>
      </span>
    ) : (
      <>
        {mine.map((pid) => { const p = cfg.projects.find((x) => x.id === pid);
          return (
            <span key={pid} className={`inline-flex h-8 items-center gap-1 rounded-md border pl-2 text-xs ${p.active ? "border-teal-900 bg-teal-950 text-teal-200" : "border-slate-700 text-slate-500"}`}>
              {projLabel(p)}{!p.active && " (đã đóng)"}
              <button onClick={() => setEmpProjs(e.id, mine.filter((x) => x !== pid))} title="Gỡ dự án" aria-label={`Gỡ ${p.name}`}
                className="flex h-7 w-7 items-center justify-center rounded text-teal-400 hover:bg-rose-950 hover:text-rose-300"><X size={13} /></button>
            </span>
          ); })}
        <button onClick={() => setAllProj(e.id, true)} title="Cho chấm vào mọi dự án đang mở, kể cả dự án thêm sau" className="ro-hide h-8 rounded-md border border-dashed border-slate-700 px-2.5 text-xs text-slate-400 hover:border-teal-600 hover:text-teal-300">Tất cả</button>
        <button onClick={(ev) => openPp(ev, "add", e.id)} className="ro-hide h-8 rounded-md border border-dashed border-slate-700 px-2.5 text-xs text-slate-400 hover:border-teal-600 hover:text-teal-300">+ Dự án</button>
      </>
    );
    const btns = limited ? <div /> : (
      <div className="flex shrink-0 justify-end gap-1">
        {a && accBtns(a, e.name)}
        <button onClick={() => openEdit(e)} title="Sửa" className={iconBtn}><Pencil size={14} /></button>
        <button onClick={() => setResignDlg({ e, date: fmt(new Date()) })} title="Nghỉ việc — khoá tài khoản, chuyển sang tab Nghỉ việc, giữ giờ công" aria-label="Nghỉ việc"
          className={`ro-hide ${iconBtn} hover:border-amber-700 hover:text-amber-400`}><UserMinus size={14} /></button>
        <button onClick={() => openDel(e)} title="Xoá" className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>
      </div>
    );
    return (
      <div key={e.id} className="border-b border-slate-800 px-3 py-2 text-sm hover:bg-slate-800/40 md:px-3.5">
        {/* desktop: một dòng 7 cột */}
        <div className={`hidden min-h-[36px] ${COLS}`}>
          <div className={`font-mono text-xs ${dim || "text-slate-400"}`}>{e.code || "—"}</div>
          <div className={`min-w-0 break-words ${dim || "text-slate-100"}`}>{e.name}</div>
          <div className="min-w-0">{roleEl || none}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {limited ? none : a ? <><span className="break-all font-mono text-xs text-slate-300">{a.username}</span>{lvBadge(a)}{a.disabled && lockedBadge}</> : <span className="text-slate-600">Chưa có</span>}
          </div>
          <div>{limited ? none : <PasswordCell value={a?.password} shown={!!shown[a?.id]} onToggle={() => toggleShown(a.id)} />}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">{projEl}</div>
          {btns}
        </div>
        {/* mobile: thẻ */}
        <div className="md:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {e.code && <div className="font-mono text-[11px] text-slate-500">{e.code}</div>}
              <div className={`break-words ${dim || "text-slate-100"}`}>{e.name}</div>
            </div>
            {btns}
          </div>
          {roleEl && <div className="mt-1.5 flex flex-wrap gap-1.5">{roleEl}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{projEl}</div>
          {a && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="break-all font-mono text-xs text-slate-300">{a.username}</span>
              <PasswordCell value={a.password} shown={!!shown[a.id]} onToggle={() => toggleShown(a.id)} />
              {lvBadge(a)}{a.disabled && lockedBadge}
            </div>
          )}
        </div>
      </div>
    );
  };
  const empTab = (
    <div className={panelCls}>
      <div className="grid grid-cols-2 gap-2 p-3 xl:grid-cols-[minmax(200px,1fr)_200px_200px_auto_auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã, vai trò, tên đăng nhập" className={`col-span-2 xl:col-span-1 ${inputCls}`} />
        <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={selectCls}>
          <option value="">Mọi phòng ban</option>
          {deptOrder.map((d) => <option key={d}>{d}</option>)}
        </select>
        {!limited && <>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
          <option value="">Mọi tài khoản</option>
          <option value="none">Chưa có tài khoản</option>
          <option value="active">Đang dùng</option>
          <option value="locked">Đã khoá</option>
        </select>
        <button onClick={exportAccounts} className={`whitespace-nowrap ${btnGhost}`}><Download size={14} /> Xuất tài khoản</button>
        <button onClick={openAdd} className={`whitespace-nowrap ${btnPrimary}`}><Plus size={14} /> Thêm nhân sự</button>
        </>}
      </div>
      <div className="px-3.5 pb-2.5 text-xs text-slate-500">
        {visible.length === actList.length ? `${visible.length} nhân sự` : `${visible.length} / ${actList.length} nhân sự`}
      </div>
      <div className={`hidden border-y border-slate-800 px-3.5 py-2 text-[11px] uppercase tracking-wider text-slate-500 ${COLS}`}>
        <div>Mã NV</div><div>Họ và tên</div><div>Vai trò</div><div>Tên đăng nhập</div><div>Mật khẩu</div><div>Dự án đang tham gia</div><div></div>
      </div>
      {actList.length === 0 ? <div className="px-4 py-7 text-center text-sm text-slate-500">Chưa có nhân sự.</div>
        : groups.length === 0 ? <div className="px-4 py-7 text-center text-sm text-slate-500">Không có nhân sự khớp bộ lọc.</div>
        : groups.map((g) => (
          <React.Fragment key={g.dept}>
            <div className="sticky top-0 z-10 mx-2 mb-0.5 mt-2.5 flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-[#1a2740] px-2.5 py-2 text-xs uppercase tracking-wider text-slate-100">
              <span className="min-w-0 truncate">{g.dept}</span>
              <span className="shrink-0 font-mono tracking-normal text-slate-400">{g.list.length}</span>
            </div>
            {g.list.map(empRow)}
          </React.Fragment>
        ))}
    </div>
  );

  /* ---------------- v8.5: tab con Nhân sự nghỉ việc ---------------- */
  const vnDate = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
  const topProj = (info) => [...(info?.byProj || new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${fmtH(v)} h`).join(" · ");
  const goneTab = (
    <div className="space-y-3 md:space-y-4">
      <div className={panelCls}>
        <div className="px-3.5 pb-2.5 pt-3 text-xs leading-relaxed text-slate-500">
          Người nghỉ việc: tài khoản đã khoá, không còn hiện ở Chấm công, giao dự án, nhắc nộp và danh sách nhân sự đang làm.
          Giờ công đã chấm vẫn tính cho dự án; Bảng công / Dashboard chỉ hiện họ ở những kỳ còn giờ, kèm nhãn <span className="text-slate-300">Đã nghỉ</span>.
        </div>
        {goneList.length === 0 ? <div className="border-t border-slate-800 px-4 py-7 text-center text-sm text-slate-500">Chưa có nhân sự nghỉ việc.</div>
          : [...goneList].sort((a, b) => (b.resignedAt || "").localeCompare(a.resignedAt || "")).map((e) => {
            const info = goneHrs?.[e.id], a = accByEmp.get(e.id);
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800 px-3.5 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {e.code && <span className="font-mono text-xs text-slate-500">{e.code}</span>}
                    <span className="text-slate-100">{e.name}</span>
                    <span className="text-xs text-slate-500">{[e.dept, roleTitle(e.role)].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Nghỉ từ <span className="text-slate-300">{vnDate(e.resignedAt)}</span>
                    {a && <> · tài khoản <span className="font-mono">{a.username}</span> {a.disabled ? "đã khoá" : <span className="text-amber-400">chưa khoá</span>}</>}
                    {" · "}{goneHrs === null ? "đang đọc giờ công…" : info ? <>đã chấm <span className="font-mono text-slate-300">{fmtH(info.total)} h</span>{topProj(info) && ` — ${topProj(info)}`}</> : "chưa chấm giờ nào"}
                  </div>
                </div>
                <div className="ro-hide flex shrink-0 gap-1">
                  <button onClick={() => exportHours([{ name: e.name, code: e.code, info }], (e.code || e.name).replace(/\s+/g, "-"))} disabled={!info} title="Xuất Excel giờ công" className={`${iconBtn} disabled:opacity-40`}><Download size={14} /></button>
                  <button onClick={() => rehire(e)} disabled={busy} title="Làm lại — đưa về tab Nhân sự, mở khoá tài khoản, giao lại dự án cũ" className={`${iconBtn} hover:border-teal-700 hover:text-teal-300`}><UserCheck size={14} /></button>
                  <button onClick={() => openDel(e)} title="Xoá nhân sự" className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
      </div>

      {/* giờ công còn sót lại của nhân sự đã bị xoá trước đây (trước v8.5 xoá nhân sự không xoá giờ) */}
      {!readOnly && (
        <div className={panelCls}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">Giờ công của nhân sự đã xoá</div>
              <div className="text-xs text-slate-500">Hồ sơ đã xoá nhưng giờ công vẫn còn và vẫn tính vào dự án (báo cáo hiện "(đã xoá)").</div>
            </div>
            {orphanHrs && Object.keys(orphanHrs).length > 0 && (
              <button onClick={() => exportHours(Object.entries(orphanHrs).map(([id, info]) => ({ name: `(đã xoá) ${id}`, code: "", info })), "nhan-su-da-xoa")} className={`whitespace-nowrap ${btnGhost}`}><Download size={14} /> Xuất Excel tất cả</button>
            )}
          </div>
          {orphanHrs === null ? <div className="flex items-center gap-2 border-t border-slate-800 px-4 py-5 text-sm text-slate-500"><Loader2 className="animate-spin" size={15} /> Đang kiểm tra…</div>
            : Object.keys(orphanHrs).length === 0 ? <div className="border-t border-slate-800 px-4 py-5 text-center text-sm text-slate-500">Không còn giờ công nào của nhân sự đã xoá.</div>
            : Object.entries(orphanHrs).sort((a, b) => b[1].total - a[1].total).map(([id, info]) => (
              <div key={id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800 px-3.5 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-slate-300">(nhân sự đã xoá) <span className="font-mono text-xs text-slate-500">{id}</span></div>
                  <div className="mt-0.5 text-xs text-slate-500"><span className="font-mono text-slate-300">{fmtH(info.total)} h</span> · {info.months.size} tháng{topProj(info) && ` — ${topProj(info)}`}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => exportHours([{ name: `(đã xoá) ${id}`, code: "", info }], id)} title="Xuất Excel giờ công" className={iconBtn}><Download size={14} /></button>
                  <button onClick={() => openOrphanDel(id)} className={`${btnBase} h-9 border border-rose-900 px-3 text-rose-300 hover:border-rose-700`}><Trash2 size={14} /> Xoá hẳn</button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  /* v8.5 — hộp Nghỉ việc */
  const resignBox = resignDlg && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[12vh]" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setResignDlg(null); }}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-50">{resignDlg.e.name} nghỉ việc?</div>
        <div className="space-y-3 p-4 text-sm text-slate-300">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Nghỉ từ ngày (không tính giờ chuẩn, không nhắc nộp từ ngày này)</span>
            <input type="date" value={resignDlg.date} onChange={(ev) => setResignDlg({ ...resignDlg, date: ev.target.value })} className={inputCls} />
          </label>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
            <li>Khoá tài khoản đăng nhập{accByEmp.get(resignDlg.e.id) ? ` (${accByEmp.get(resignDlg.e.id).username})` : " — người này chưa có tài khoản"}.</li>
            <li>Gỡ khỏi {empProjs(resignDlg.e).length} dự án đang tham gia (nhớ lại để giao lại nếu làm lại).</li>
            <li>Chuyển sang tab Nhân sự nghỉ việc. Giờ công đã chấm giữ nguyên, vẫn tính cho dự án.</li>
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button onClick={() => setResignDlg(null)} className={btnGhost}>Huỷ</button>
          <button onClick={resign} disabled={busy} className={`${btnBase} bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50`}>{busy ? <Loader2 className="animate-spin" size={15} /> : <UserMinus size={15} />} Chuyển sang Nghỉ việc</button>
        </div>
      </div>
    </div>
  );

  /* v8.5 — hộp Xoá: chọn giữ hay xoá luôn giờ công (gõ XOA để xoá hẳn) */
  const delBox = delDlg && (() => {
    const d = delDlg, info = d.info, emp = d.kind === "emp";
    const purge = d.mode === "purge";
    const opt = (k, title, desc) => (
      <button type="button" onClick={() => setDelDlg({ ...d, mode: k, txt: "" })}
        className={`flex w-full items-start gap-2.5 rounded-lg border p-3 text-left ${d.mode === k ? (k === "purge" ? "border-rose-700 bg-rose-950" : "border-teal-700 bg-teal-950/40") : "border-slate-700 hover:border-slate-500"}`}>
        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${d.mode === k ? (k === "purge" ? "border-rose-400" : "border-teal-400") : "border-slate-600"}`}>{d.mode === k && <span className={`h-1.5 w-1.5 rounded-full ${k === "purge" ? "bg-rose-400" : "bg-teal-400"}`} />}</span>
        <span><span className="block text-sm text-slate-100">{title}</span><span className="block text-xs text-slate-400">{desc}</span></span>
      </button>
    );
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[10vh]" onMouseDown={(ev) => { if (ev.target === ev.currentTarget && !busy) setDelDlg(null); }}>
        <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-50">{emp ? `Xoá nhân sự ${d.e.name}?` : "Xoá hẳn giờ công của nhân sự đã xoá?"}</div>
          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-400">
              {!info ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={13} /> Đang đọc giờ công…</span>
                : info.total === 0 ? "Người này chưa chấm giờ nào."
                : <>Giờ công đã chấm: <span className="font-mono text-sm text-slate-100">{fmtH(info.total)} h</span> trong {info.months.size} tháng
                    {info.total > info.sent && <> (nháp {fmtH(info.total - info.sent)} h)</>}
                    <div className="mt-1.5 space-y-0.5">{[...info.byProj.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3"><span className="min-w-0 truncate">{k}</span><span className="shrink-0 font-mono text-slate-300">{fmtH(v)} h</span></div>))}</div></>}
            </div>
            {emp && opt("keep", "Xoá nhân sự, giữ giờ công", "Dự án vẫn tính số giờ này; báo cáo hiện tên là (đã xoá).")}
            {emp && opt("purge", "Xoá luôn toàn bộ giờ công", "Dùng khi nhập nhầm hoặc tài khoản thử. Giờ thực tế của các dự án giảm tương ứng.")}
            {purge && (
              <div className="space-y-2">
                <div className="text-xs text-rose-300">Không hoàn tác được. Nên bấm Xuất Excel để giữ một bản trước khi xoá.</div>
                <input autoFocus value={d.txt} onChange={(ev) => setDelDlg({ ...d, txt: ev.target.value })} placeholder="Gõ XOA để xác nhận" className={`font-mono ${inputCls}`} />
              </div>
            )}
            {emp && !isResigned(d.e) && d.mode === "keep" && (
              <div className="text-xs text-slate-500">Nhân sự nghỉ việc thì nên dùng <button onClick={() => { setDelDlg(null); setResignDlg({ e: d.e, date: fmt(new Date()) }); }} className="text-amber-400 underline underline-offset-2">Nghỉ việc</button> thay vì xoá — giữ được tên trong báo cáo.</div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 px-4 py-3">
            {info && info.total > 0 && <button onClick={() => exportHours([{ name: emp ? d.e.name : `(đã xoá) ${d.id}`, code: emp ? d.e.code : "", info }], emp ? (d.e.code || d.e.name).replace(/\s+/g, "-") : d.id)} className={`mr-auto ${btnGhost}`}><Download size={14} /> Xuất Excel</button>}
            <button onClick={() => setDelDlg(null)} disabled={busy} className={btnGhost}>Huỷ</button>
            <button onClick={doDelete} disabled={busy || (purge && (!info || d.txt.trim().toUpperCase() !== "XOA"))}
              className={`${btnBase} bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40`}>
              {busy ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />} {purge ? (emp ? "Xoá nhân sự và giờ công" : "Xoá hẳn giờ công") : "Xoá nhân sự"}
            </button>
          </div>
        </div>
      </div>
    );
  })();

  /* ---------------- tab con Tài khoản quản lý: tài khoản không gắn nhân sự ---------------- */
  const adminTab = (
    <div className={panelCls}>
      <div className="flex justify-end p-3">
        <button onClick={openAddAdmin} className={`whitespace-nowrap ${btnPrimary}`}><Plus size={14} /> Thêm tài khoản</button>
      </div>
      {loose.length === 0 ? <div className="border-t border-slate-800 px-4 py-7 text-center text-sm text-slate-500">Chưa có tài khoản nào không gắn nhân sự.</div>
        : loose.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-3.5 py-2.5 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="break-all font-mono text-slate-100">{a.username}</span>
              <PasswordCell value={a.password} shown={!!shown[a.id]} onToggle={() => toggleShown(a.id)} />
              {lvBadge(a)}{a.disabled && lockedBadge}
            </div>
            <div className="flex shrink-0 gap-1">
              {accBtns(a, "")}
              <button onClick={() => openEditAdmin(a)} title="Sửa" className={iconBtn}><Pencil size={14} /></button>
              <button onClick={() => setPendingAcc(a)} title="Xoá" className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
    </div>
  );

  /* ---------------- khung thêm / sửa ---------------- */
  const onEnter = (e) => { if (e.key === "Enter") saveDlg(false); };
  const f = dlg?.f;
  const dlgTitle = !dlg ? "" : dlg.kind === "emp" ? (dlg.empId ? "Sửa nhân sự" : "Thêm nhân sự") : (dlg.accId ? "Sửa tài khoản" : "Thêm tài khoản BOD / Admin");
  const formDlg = dlg && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[8vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) setDlg(null); }}>
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <h4 className="text-sm font-semibold text-slate-50">{dlgTitle}</h4>
          <button onClick={() => setDlg(null)} className={iconBtn}><X size={15} /></button>
        </div>
        <div className="space-y-2.5 p-4">
          {dlg.kind === "emp" && (
            <>
              <div className="grid gap-2.5 md:grid-cols-[130px_minmax(0,1fr)]">
                <input autoFocus={!dlg.empId} value={f.code} onChange={(e) => setF({ code: e.target.value })} onKeyDown={onEnter} placeholder="Mã NV" className={`font-mono ${inputCls}`} />
                <input autoFocus={!!dlg.empId} value={f.name} onChange={(e) => onNameChange(e.target.value)} onKeyDown={onEnter} placeholder="Họ và tên" className={inputCls} />
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                <select value={f.dept} onChange={(e) => onDeptChange(e.target.value)} className={selectCls}>
                  {deptOrder.map((d) => <option key={d}>{d}</option>)}
                </select>
                {/* chỉ hiện vai trò của phòng ban đã chọn (và vai trò đang gán, nếu thuộc phòng ban khác) */}
                <select value={f.role} onChange={(e) => setF({ role: e.target.value })} className={selectCls}>
                  <option value="">— Không phân vai trò —</option>
                  {ROLES.filter((r) => r.dept === f.dept || r.id === f.role).map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                </select>
              </div>
              {/* v12.17 — tính vào Kế hoạch nguồn lực: bỏ tích cho người đang thử việc… (không ảnh hưởng chấm công) */}
              <button type="button" onClick={() => setF({ noPlan: !f.noPlan })}
                className={`flex min-h-[36px] w-full items-center gap-2 rounded-md border px-2.5 text-left text-[13px] ${!f.noPlan ? "border-teal-700 bg-teal-950 text-teal-200" : "border-dashed border-amber-800 text-amber-300"}`}>
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${!f.noPlan ? "border-teal-600 bg-teal-600 text-white" : "border-amber-700"}`}>{!f.noPlan && <Check size={12} />}</span>
                Tính vào Kế hoạch nguồn lực <span className="text-xs opacity-70">— {f.noPlan ? "đang bỏ ra (vd thử việc): không tính quân số và giờ thực tế" : "quân số và giờ thực tế được tính"}</span>
              </button>
              {/* v6.9 — dự án đang tham gia: nhân sự chỉ thấy và chấm được các dự án này (chưa chọn = chỉ chấm Việc chung / vắng mặt) */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>Dự án đang tham gia <span className="text-slate-600">· {f.allProjects ? "tất cả" : `${(f.projects || []).length} dự án`}</span></span>
                  {!f.allProjects && (f.projects || []).length > 0 && <button onClick={() => setF({ projects: [] })} className="text-slate-500 hover:text-slate-300">Bỏ chọn hết</button>}
                </div>
                {/* v8.8 — Tất cả dự án: chấm được mọi dự án đang mở, kể cả dự án thêm sau */}
                <button type="button" onClick={() => setF({ allProjects: !f.allProjects })}
                  className={`mb-1.5 flex min-h-[36px] w-full items-center gap-2 rounded-md border px-2.5 text-left text-[13px] ${f.allProjects ? "border-teal-700 bg-teal-950 text-teal-200" : "border-dashed border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>
                  <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${f.allProjects ? "border-teal-600 bg-teal-600 text-white" : "border-slate-600"}`}>{f.allProjects && <Check size={12} />}</span>
                  Tất cả dự án <span className="text-xs opacity-70">— mọi dự án đang mở, kể cả dự án thêm sau</span>
                </button>
                {!f.allProjects && <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                  {cfg.projects.filter((p) => p.active || (f.projects || []).includes(p.id)).map((p) => {
                    const on = (f.projects || []).includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => setF({ projects: on ? f.projects.filter((x) => x !== p.id) : [...(f.projects || []), p.id] })}
                        className={`min-h-[36px] rounded-md border px-2.5 text-left text-[13px] ${on ? "border-teal-700 bg-teal-950 text-teal-200" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>
                        {on ? "✓ " : ""}{p.code ? `[${p.code}] ` : ""}{p.name}{!p.active ? " (đã đóng)" : ""}
                      </button>
                    );
                  })}
                </div>}
                {!f.allProjects && (f.projects || []).length === 0 && <div className="mt-1.5 text-xs text-amber-400/80">Chưa giao dự án nào — nhân sự chỉ chấm được Việc chung và vắng mặt.</div>}
              </div>
            </>
          )}
          <div className="grid gap-2.5 md:grid-cols-2">
            <input autoFocus={dlg.kind === "admin"} value={f.username} onChange={(e) => setF({ username: e.target.value }, { autoUser: false })} onKeyDown={onEnter}
              placeholder="Tên đăng nhập" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" className={`font-mono ${inputCls}`} />
            <div className="flex gap-2">
              <input value={f.password} onChange={(e) => setF({ password: e.target.value })} onKeyDown={onEnter}
                placeholder="Mật khẩu" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" className={`min-w-0 flex-1 font-mono ${inputCls}`} />
              <button onClick={() => setF({ password: genPassword() })} title="Sinh mật khẩu" className={sqBtn}><RotateCcw size={15} /></button>
            </div>
          </div>
          {/* v7.3 — cấp quyền. Tài khoản không gắn nhân sự chỉ là BOD hoặc Admin (trưởng phòng cần phòng ban của nhân sự) */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cấp quyền">
            {ACCESS_LEVELS.filter(([k]) => dlg.kind === "emp" || k === "bod" || k === "admin" || (dlg.accId && k === accessOfAcc((accounts || []).find((x) => x.id === dlg.accId)))).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={(f.access || "emp") === k} onClick={() => setF({ access: k })}
                className={`h-11 rounded-md border px-3.5 text-sm ${(f.access || "emp") === k ? "border-teal-700 bg-teal-950 text-teal-200" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>{l}</button>
            ))}
          </div>
          {f.access === "head" && <div className="text-xs text-slate-500">Xem và sửa Bảng công nhân viên phòng {f.dept || "—"}.</div>}
          {f.access === "bod" && <div className="text-xs text-slate-500">Xem mọi mục quản lý (Dashboard, Bảng công, Dự án, Nhân sự, Tác vụ, Thiết lập), không sửa được gì.</div>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button onClick={() => setDlg(null)} className={btnGhost}>Huỷ</button>
          {dlg.kind === "emp" && !dlg.empId && <button onClick={() => saveDlg(true)} disabled={busy} className={`${btnGhost} disabled:opacity-50`}>Lưu và thêm tiếp</button>}
          <button onClick={() => saveDlg(false)} disabled={busy} className={`${btnPrimary} disabled:opacity-50`}>{busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Lưu</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
        {[["emp", "Nhân sự", actList.length], ["gone", "Nhân sự nghỉ việc", goneList.length], ...(onSupport ? [["sup", "Hỗ trợ dự án", supportList(cfg).filter((x) => x.until >= fmt(new Date())).length]] : []), ["admin", "Tài khoản BOD / Admin", loose.length]].filter(([k]) => !limited || k === "emp").map(([k, l, n]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`h-9 whitespace-nowrap rounded-md px-4 text-sm ${sub === k ? "bg-slate-800 font-medium text-slate-50" : "text-slate-400 hover:text-slate-200"}`}>
            {l}<span className="ml-1.5 font-mono text-xs text-slate-500">{n}</span>
          </button>
        ))}
      </div>

      {sub === "emp" ? empTab : sub === "gone" ? goneTab : sub === "sup" ? <SupportPanel cfg={cfg} onSupport={onSupport} readOnly={readOnly} /> : adminTab}
      {formDlg}
      {resignBox}
      {delBox}

      {/* v6.9 (mẫu C) — popover chọn dự án / chép dự án từ người khác */}
      {pp && (() => {
        const e = cfg.employees.find((x) => x.id === pp.eid); if (!e) return null;
        const mine = empProjs(e), kw = norm(pp.q.trim());
        const field = (
          <input autoFocus={isWide} value={pp.q} onChange={(ev) => setPp({ ...pp, q: ev.target.value })} placeholder={pp.kind === "add" ? "Tìm dự án (gõ không dấu được)" : "Tìm người"}
            className={inputCls} />
        );
        let body;
        if (pp.kind === "add") {
          const list = cfg.projects.filter((p) => (p.active || mine.includes(p.id)) && (!kw || norm(`${p.code || ""} ${p.name} ${p.client || ""}`).includes(kw)));
          body = list.length ? list.map((p) => { const on = mine.includes(p.id);
            return (
              <button key={p.id} onClick={() => setEmpProjs(e.id, on ? mine.filter((x) => x !== p.id) : [...mine, p.id])}
                className="flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-slate-200 hover:bg-slate-800">
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-600"}`}>{on && <Check size={12} />}</span>
                {projLabel(p)}{!p.active && <span className="text-xs text-slate-500">(đã đóng)</span>}
              </button>
            ); }) : <div className="px-3 py-3 text-sm text-slate-500">Không có dự án khớp.</div>;
        } else {
          const list = cfg.employees.filter((x) => x.id !== e.id && !isResigned(x) && !x.allProjects && empProjs(x).length && (!kw || norm(`${x.name} ${x.code || ""}`).includes(kw)));
          body = list.length ? list.map((x) => (
            <button key={x.id} onClick={() => { setEmpProjs(e.id, [...empProjs(x)]); setPp(null); flash(`Đã chép ${empProjs(x).length} dự án từ ${x.name} cho ${e.name}.`); }}
              className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-slate-800">
              <div className="text-sm text-slate-200">{x.name}</div>
              <div className="text-xs text-slate-500">{empProjs(x).map((pid) => projLabel(cfg.projects.find((p) => p.id === pid))).join(", ")}</div>
            </button>
          )) : <div className="px-3 py-3 text-sm text-slate-500">Chưa có ai được giao dự án.</div>;
        }
        const below = pp.y + 380 < window.innerHeight;
        return (
          <div onClick={(ev) => ev.stopPropagation()} className="fixed z-50 w-[320px] rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-2xl"
            style={below ? { left: pp.x, top: pp.y } : { left: pp.x, bottom: window.innerHeight - pp.top + 6 }}>
            {pp.kind === "copy" && <div className="px-2.5 pb-1 pt-1.5 text-[11px] uppercase tracking-wider text-slate-500">Chép dự án từ người khác → {e.name}</div>}
            <div className="p-1">{field}</div>
            <div className="max-h-72 overflow-y-auto">{body}</div>
            {pp.kind === "add" && <div className="flex justify-end p-1"><button onClick={() => setPp(null)} className={`${btnPrimary} h-9`}>Xong</button></div>}
          </div>
        );
      })()}

      <ConfirmDialog
        open={!!pendingDel}
        title={`Xoá nhân sự ${pendingDel?.name || ""}?`}
        desc="Tài khoản đăng nhập của người này cũng bị xoá. Giờ công đã chấm vẫn còn trong dữ liệu nhưng báo cáo sẽ hiển thị là (đã xoá). Nhân sự nghỉ việc thì nên khoá tài khoản thay vì xoá."
        confirmLabel="Xoá nhân sự"
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
      <ConfirmDialog
        open={!!pendingAcc}
        title={`Xoá tài khoản ${pendingAcc?.username || ""}?`}
        desc="Tài khoản này sẽ không đăng nhập được nữa."
        confirmLabel="Xoá tài khoản"
        onConfirm={confirmDelAcc}
        onCancel={() => setPendingAcc(null)}
      />
    </div>
  );
}


