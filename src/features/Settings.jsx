/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download, Plus, Trash2, Save, Loader2, ListChecks, RotateCcw, Check, Copy, Flag, Eye, EyeOff, Bell, Send, Printer, QrCode,
} from "lucide-react";
import { fetchConfig, saveConfig, fetchTs } from "../data.js";
import { syncPush, sendTestPush, fetchPushStatus } from "../push.js";
import { currentUser } from "../auth.js";
import { DEFAULT_HOURS, VN_FIXED_HOLIDAYS, dFull, dLabel, fmt, pad, weeklyTarget } from "../core/date.jsx";
import { DB, LAST_STORAGE_ERROR, STORAGE_OK, TS_PREFIX, allLoaded, commitConfig, commitTs, errText, loadDB, useDataTick, useUsage, wipeTs } from "../core/db.jsx";
import { DEFAULT_PHASE, DEFAULT_PHASES, LEAVE_TASKS, NO_PROJECT, OT_MIG_NOTE, empNameTag, fmtH, isLeaveTask, isResigned, otBandIdFor, otBandKey, otSpan, phaseColor, tone, toneT, uid } from "../core/domain.jsx";
import { CTRL, ConfirmDialog, DateField, Panel, btnDanger, btnGhost, btnPrimary, iconBtn, inputCls, selectCls } from "../core/ui.jsx";
import { allocLimits } from "../shared/alloc.jsx";
import { planLimits } from "./planning/planCalc.js";
import { Dashboard } from "./dashboard/Dashboard.jsx";

/* ============================ KIỂM TRA LƯU TRỮ ============================
   Thử đọc/ghi lần lượt từng bảng rồi in ra lỗi thô.
   Mục đích: biết chính xác database từ chối ở đâu, thay vì đoán. */
export function StorageDoctor({ cfg, admin = false }) {
  const [rows, setRows] = useState(null);
  const [running, setRunning] = useState(false);

  const probe = async (label, fn) => {
    try { return { label, result: "OK", err: "", note: (await fn()) || "" }; }
    catch (e) { return { label, result: "LỖI", err: errText(e), note: "" }; }
  };

  const run = async () => {
    setRunning(true); setRows(null);
    const out = [];
    out.push(await probe("Phiên đăng nhập", async () => { const w = await currentUser(); if (!w) throw new Error("Chưa đăng nhập hoặc phiên đã hết hạn"); return w.username; }));
    out.push(await probe("Đọc thiết lập", async () => { const c = (await fetchConfig())?.config; if (!c) throw new Error("Chưa có dòng thiết lập"); return `${(c.employees || []).length} nhân sự, ${(c.projects || []).length} dự án`; }));
    out.push(await probe("Đọc bảng công", async () => `${Object.keys(await fetchTs()).length} bảng công tháng`));
    // ghi lại đúng thiết lập đang có: kiểm tra được quyền ghi mà không đổi dữ liệu (chỉ quản lý có quyền này)
    if (admin) out.push(await probe("Ghi thiết lập", async () => { const f = await fetchConfig(); if (!f) throw new Error("Chưa có dòng thiết lập"); const r = await saveConfig(f.config, f.rev); if (r.conflict) throw new Error("Không ghi được: tài khoản không có quyền, hoặc có người vừa sửa"); return "ghi lại nội dung đang có"; }));
    out.push(await probe("Ghi vùng riêng trên máy này", async () => { const k = "artius:diag"; await window.storage.set(k, "1", false); await window.storage.delete(k, false); return ""; }));
    setRows(out); setRunning(false);
  };

  const tone = (v) => (v === "OK" ? "text-teal-400" : "text-rose-400");

  return (
    <Panel title="Kiểm tra lưu trữ">
      <button onClick={run} disabled={running || !STORAGE_OK} className={`${btnPrimary} disabled:opacity-40`}>
        {running ? <Loader2 className="animate-spin" size={15} /> : <ListChecks size={15} />} Chạy kiểm tra
      </button>

      {rows && (
        <div className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-slate-200">{r.label}{r.note && <span className="ml-2 text-xs text-slate-500">{r.note}</span>}</span>
                <span className={`shrink-0 font-mono text-sm ${tone(r.result)}`}>{r.result}</span>
              </div>
              {r.err && <p className="mt-1 text-xs text-rose-300">{r.err}</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ============================ SAO LƯU & KHÔI PHỤC ============================
   Bộ nhớ lưu trữ của môi trường này có lúc đứt giữa chừng. Xuất được toàn bộ dữ liệu
   ra một file JSON nghĩa là dù storage hỏng hay bị xoá thì vẫn dựng lại được. */
export function BackupPanel({ cfg, saveCfg, flash, setCfgFromRestore }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(null);

  const exportAll = async () => {
    // tải lại bản mới nhất từ server để file sao lưu có cả phần mọi người vừa nhập sau lúc mình mở app
    setBusy(true);
    let fresh = null;
    try { fresh = await loadDB(true, true); } catch { /* báo lỗi bên dưới */ }   // v2.1: sao lưu phải có đủ mọi tháng
    setBusy(false);
    if (!fresh) return flash(`Chưa xuất được — ${LAST_STORAGE_ERROR || "không tải được dữ liệu"}`, "err");
    const ts = { ...fresh.ts };
    const dump = { app: "artius-timesheet", v: 1, at: new Date().toISOString(), config: fresh.config, timesheets: ts };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ARTIUS_saoluu_${fmt(new Date())}.json`; a.click();
    URL.revokeObjectURL(url);
    flash(`Đã xuất ${Object.keys(ts).length} bảng công và toàn bộ thiết lập.`);
  };

  const parseDump = () => {
    try {
      const d = JSON.parse(text);
      if (d?.app !== "artius-timesheet" || !d.config) throw new Error("sai định dạng");
      return d;
    } catch { flash("Nội dung không phải file sao lưu hợp lệ.", "err"); return null; }
  };

  const doRestore = async () => {
    const d = confirmRestore; setConfirmRestore(null);
    if (!d) return;
    setBusy(true);
    const ts = d.timesheets || {};
    // khoá cũ có dạng "artius:ts:<empId>:<ym>", bản mới lưu gọn là "<empId>:<ym>"
    const clean = {};
    for (const [k, v] of Object.entries(ts)) clean[k.startsWith(TS_PREFIX) ? k.slice(TS_PREFIX.length) : k] = v;
    const ok = !!(await commitConfig(d.config)) && (await commitTs(clean));
    setCfgFromRestore?.(d.config);
    setBusy(false); setText("");
    flash(ok ? `Đã khôi phục thiết lập và ${Object.keys(clean).length} bảng công.` : "Khôi phục chưa xong — lưu trữ đang lỗi.", ok ? "ok" : "err");
  };

  return (
    <Panel title="Sao lưu & khôi phục">
      <p className="text-sm text-slate-400">
        Xuất toàn bộ thiết lập và bảng công ra một file JSON để giữ ngoài hệ thống. Nên làm định kỳ, nhất là cuối mỗi tháng trước khi chốt công.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={exportAll} disabled={busy} className={`${btnPrimary} disabled:opacity-40`}>
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />} Xuất file sao lưu
        </button>
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <label className="mb-1 block text-xs text-slate-500">Khôi phục — dán nội dung file sao lưu vào đây</label>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)}
          placeholder='{"app":"artius-timesheet", ...}'
          className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-700 focus:border-teal-500 focus:outline-none" />
        <button onClick={() => { const d = parseDump(); if (d) setConfirmRestore(d); }} disabled={busy || !text.trim()}
          className={`mt-2 ${btnGhost} disabled:opacity-40`}><RotateCcw size={14} /> Khôi phục từ nội dung trên</button>
        <p className="mt-2 text-xs text-slate-500">Khôi phục ghi đè thiết lập hiện tại và các bảng công có trong file. Bảng công không nằm trong file thì giữ nguyên.</p>
      </div>

      <ConfirmDialog
        open={!!confirmRestore}
        title="Khôi phục dữ liệu từ file sao lưu?"
        desc="Thiết lập hiện tại gồm nhân sự, dự án, tác vụ, ngày lễ sẽ bị ghi đè bằng nội dung trong file. Nên xuất một bản sao lưu của dữ liệu hiện tại trước khi làm."
        confirmLabel="Khôi phục"
        onConfirm={doRestore}
        onCancel={() => setConfirmRestore(null)}
      />
    </Panel>
  );
}

/* ============================ THIẾT LẬP ============================ */
/* v1.9 — Giai đoạn dự án sửa được: bấm tên / mô tả để sửa tại chỗ, thêm giai đoạn mới (mã kế tiếp P5, P6…).
   Giai đoạn chưa có giờ công và chưa có giờ dự kiến thì xoá được; đã có thì chỉ ngừng dùng / dùng lại. */
export function PhasePanel({ cfg, saveCfg, flash }) {
  const dataTick = useDataTick();
  const [editing, setEditing] = useState(null);   // { id, field: "name" | "desc" }
  const [val, setVal] = useState("");
  const list = Array.isArray(cfg.phases) && cfg.phases.length ? cfg.phases : DEFAULT_PHASES;

  // Giờ công đang gắn với từng giai đoạn: mọi dòng bảng công (kể cả chưa gửi), không tính vắng mặt.
  // v2.1: lấy từ database trên toàn bộ dữ liệu; chưa hỏi được thì tạm cộng phần đang có trong bộ nhớ.
  const usage = useUsage();
  const hoursBy = useMemo(() => {
    const m = new Map();
    if (usage) {
      for (const u of usage) if (u.projectId !== NO_PROJECT && u.all > 0) m.set(u.phaseId, (m.get(u.phaseId) || 0) + u.all);
      return m;
    }
    for (const bucket of Object.values(DB?.ts || {})) for (const r of bucket?.rows || []) {
      if (isLeaveTask(r.taskId) || r.projectId === NO_PROJECT) continue;
      const h = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
      if (h > 0) { const k = r.phaseId || DEFAULT_PHASE; m.set(k, (m.get(k) || 0) + h); }
    }
    return m;
  }, [dataTick, usage]);
  // chưa biết chắc số liệu toàn bộ (không hỏi được database và bộ nhớ chỉ có vài tháng) thì không cho xoá
  const sure = !!usage || allLoaded();
  const hasBudget = (id) => cfg.projects.some((p) => Number(p.budgets?.[id]) > 0);
  const inUse = (id) => !sure || (hoursBy.get(id) || 0) > 0 || hasBudget(id);

  const save = (next, msg) => saveCfg({ ...cfg, phases: next }).then((ok) => { if (ok && msg) flash(msg); });
  const startEdit = (x, field) => { setEditing({ id: x.id, field }); setVal(x[field] || ""); };
  const commit = () => {
    if (!editing) return;
    const v = val.trim(), cur = list.find((x) => x.id === editing.id);
    setEditing(null);
    if (!cur || v === (cur[editing.field] || "")) return;
    if (editing.field === "name" && !v) return flash("Tên giai đoạn không được để trống.", "err");
    save(list.map((x) => (x.id === cur.id ? { ...x, [editing.field]: v } : x)), "Đã lưu giai đoạn.");
  };
  const add = async () => {
    const n = Math.max(0, ...list.map((x) => parseInt(String(x.id).replace(/\D/g, ""), 10) || 0)) + 1;
    const x = { id: `P${n}`, name: "Giai đoạn mới", desc: "", active: true };
    await save([...list, x], `Đã thêm ${x.id}.`);
    startEdit(x, "name");
  };
  const toggle = (x) => {
    if (x.active !== false && list.filter((y) => y.active !== false).length <= 1) return flash("Phải còn ít nhất một giai đoạn đang dùng.", "err");
    save(list.map((y) => (y.id === x.id ? { ...y, active: x.active === false } : y)),
      x.active === false ? `Đã dùng lại ${x.id}.` : `${x.id} · ${x.name} ngừng dùng — nhân sự không chọn được nữa.`);
  };
  const del = (x) => {
    if (inUse(x.id)) return flash("Giai đoạn đã có giờ công hoặc giờ dự kiến, chỉ ngừng dùng được.", "err");
    if (list.filter((y) => y.id !== x.id && y.active !== false).length === 0) return flash("Phải còn ít nhất một giai đoạn đang dùng.", "err");
    save(list.filter((y) => y.id !== x.id), `Đã xoá ${x.id} · ${x.name}.`);
  };
  const editKey = (e) => {
    if (e.key === "Enter" && !(e.shiftKey && e.currentTarget.tagName === "TEXTAREA")) { e.preventDefault(); e.currentTarget.blur(); }
    if (e.key === "Escape") { setEditing(null); }
  };
  const editCls = "w-full rounded border border-teal-600 bg-slate-900 px-2 text-slate-100 focus:outline-none";

  return (
    <Panel title="Giai đoạn dự án">
      <p className="text-sm text-slate-400">Mỗi dòng chấm công phải chọn một giai đoạn. Bấm vào tên hoặc mô tả để sửa.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {list.map((x) => {
          const c = tone(phaseColor(x.id)), off = x.active === false, hrs = hoursBy.get(x.id) || 0;
          const isEd = (f) => editing?.id === x.id && editing.field === f;
          return (
            <div key={x.id} data-phase-card={x.id} className={`relative min-w-0 rounded-lg border border-slate-800 bg-slate-950 py-3 pl-3 pr-14 ${off ? "opacity-60" : ""}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px]" style={{ color: toneT(c), borderColor: `${c}66`, background: `${c}1a` }}>{x.id}</span>
                {isEd("name")
                  ? <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={editKey} aria-label="Tên giai đoạn" className={`h-8 text-sm ${editCls}`} />
                  : <button onClick={() => startEdit(x, "name")} className="-ml-1 min-w-0 truncate rounded border border-transparent px-1 text-left text-sm font-medium text-slate-100 hover:border-slate-700">{x.name}</button>}
                {!isEd("name") && hrs > 0 && <span className="shrink-0 whitespace-nowrap rounded border border-teal-900 px-1.5 py-0.5 text-[10px] text-teal-400">{fmtH(hrs)} giờ</span>}
                {!isEd("name") && off && <span className="shrink-0 whitespace-nowrap rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">Ngừng dùng</span>}
              </div>
              {isEd("desc")
                ? <textarea autoFocus value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={editKey} aria-label="Mô tả giai đoạn" rows={2} className={`mt-1.5 py-1 text-xs ${editCls}`} />
                : <button onClick={() => startEdit(x, "desc")} className="-ml-1 mt-1.5 block w-full rounded border border-transparent px-1 text-left text-xs leading-relaxed text-slate-500 hover:border-slate-700">{x.desc || "Thêm mô tả…"}</button>}
              <div className="absolute right-2 top-2">
                {inUse(x.id)
                  ? <button onClick={() => toggle(x)} title={off ? "Dùng lại" : "Ngừng dùng"} className={iconBtn}>{off ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  : <button onClick={() => del(x)} title="Xoá giai đoạn" className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>}
              </div>
            </div>
          );
        })}
        <button onClick={add} className="flex min-h-[84px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 text-sm text-slate-400 hover:border-teal-700 hover:text-teal-300">
          <Plus size={15} /> Thêm giai đoạn
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Giai đoạn đã có giờ công hoặc giờ dự kiến thì không xoá được, chỉ ngừng dùng: nhân sự không chọn được nữa, giờ cũ vẫn giữ trong báo cáo.
      </p>
    </Panel>
  );
}

/* v2.6 — Lịch nhắc nộp bảng công (thông báo trên máy tính). Lưu ở cfg.reminders; server đọc lại mỗi 15 phút. */
export const REM_DEFAULT = { dayOn: false, dayTime: "16:30", daySatTime: "11:00", weekOn: true, weekDow: 1, weekTime: "09:30", monthOn: true, monthTo: 2, monthTime: "09:30" };
export const REM_DOW = [[1, "Thứ Hai"], [2, "Thứ Ba"], [3, "Thứ Tư"], [4, "Thứ Năm"], [5, "Thứ Sáu"], [6, "Thứ Bảy"], [7, "Chủ nhật"]];
export const REM_HOURS = Array.from({ length: 16 }, (_, i) => pad(i + 6));          // 06 … 21
export const REM_MINS = ["00", "15", "30", "45"];
export const Toggle = ({ on, onClick }) => (
  <button type="button" onClick={onClick}
    className={`relative inline-block h-6 w-11 shrink-0 appearance-none rounded-full border-0 p-0 align-middle leading-none transition-colors ${on ? "bg-teal-600" : "bg-slate-700"}`}>
    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
  </button>
);
export const TimePick = ({ value, onChange, disabled }) => {
  const [hh, mm] = String(value || "09:30").split(":");
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-20"><select disabled={disabled} value={hh} onChange={(e) => onChange(`${e.target.value}:${mm}`)} className={`font-mono disabled:opacity-40 ${selectCls}`}>
        {REM_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select></div>
      <span className="text-slate-500">:</span>
      <div className="w-20"><select disabled={disabled} value={REM_MINS.includes(mm) ? mm : "30"} onChange={(e) => onChange(`${hh}:${e.target.value}`)} className={`font-mono disabled:opacity-40 ${selectCls}`}>
        {REM_MINS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select></div>
    </div>
  );
};

/* v4.1 — Truy cập app: link + mã QR của chính địa chỉ đang mở (đổi tên miền thì QR tự đổi theo), in poster dán tại văn phòng / xưởng / công trường */
export const escHtml = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function AccessPanel({ flash }) {
  const url = `${window.location.origin}/`;
  const shown = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) => QR.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#020617", light: "#ffffff" } }))
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => { if (alive) setSvg(""); });
    return () => { alive = false; };
  }, [url]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); flash("Đã sao chép link."); }
    catch { flash("Trình duyệt chặn sao chép — bôi đen link và Ctrl+C.", "err"); }
  };

  const printPoster = () => {
    if (!svg) return;
    const w = window.open("", "_blank");
    if (!w) return flash("Trình duyệt chặn cửa sổ mới — cho phép popup rồi bấm lại.", "err");
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>ARTIUS TIME — QR</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #020617; background: #fff; }
  .page { width: 210mm; height: 297mm; padding: 22mm 20mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .brand { letter-spacing: .5em; font-size: 15pt; color: #0f766e; }
  h1 { margin-top: 10mm; font-size: 30pt; font-weight: 600; }
  .sub { margin-top: 3mm; font-size: 14pt; color: #475569; }
  .qr { margin-top: 12mm; width: 120mm; height: 120mm; padding: 4mm; border: 1.2mm solid #2dd4bf; border-radius: 6mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .url { margin-top: 7mm; font-family: Consolas, monospace; font-size: 18pt; }
  .steps { margin-top: 12mm; display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; width: 100%; text-align: left; font-size: 11.5pt; line-height: 1.45; }
  .steps b { display: block; font-size: 12.5pt; margin-bottom: 1.5mm; color: #0f766e; }
  .foot { margin-top: auto; font-size: 10pt; color: #94a3b8; }
</style></head><body><div class="page">
  <div class="brand">ARTIUS</div>
  <h1>Chấm công dự án</h1>
  <div class="sub">Quét mã bằng camera điện thoại để mở ARTIUS TIME</div>
  <div class="qr">${svg}</div>
  <div class="url">${escHtml(shown)}</div>
  <div class="steps">
    <div><b>Android / máy tính</b>Mở link bằng Chrome hoặc Edge → bấm nút "Cài app" ở góc trên → Cài đặt. Từ đó mở bằng icon ARTIUS TIME.</div>
    <div><b>iPhone</b>Mở link bằng Safari → nút Chia sẻ → "Thêm vào MH chính". Mở app từ icon, đăng nhập một lần và cho phép thông báo.</div>
  </div>
  <div class="foot">Quên mật khẩu: liên hệ quản lý để được cấp lại.</div>
</div><script>window.onload = () => setTimeout(() => window.print(), 300);<\/script></body></html>`);
    w.document.close();
  };

  return (
    <Panel title="Truy cập app">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-lg bg-white p-1.5">
          {svg ? <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            : <div className="flex h-full items-center justify-center text-slate-400"><QrCode size={28} /></div>}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="truncate rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-sm text-slate-100">{shown}</div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <button onClick={copy} className={btnGhost}><Copy size={14} /> Sao chép link</button>
            <button onClick={printPoster} disabled={!svg} className={`${btnPrimary} disabled:opacity-40`}><Printer size={14} /> In poster QR</button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function ReminderPanel({ cfg, saveCfg, flash }) {
  const [r, setR] = useState({ ...REM_DEFAULT, ...(cfg.reminders || {}) });
  const [st, setSt] = useState(null);       // { subs, log } | { error }
  const [testing, setTesting] = useState(false);
  const set = (patch) => setR((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(r) !== JSON.stringify({ ...REM_DEFAULT, ...(cfg.reminders || {}) });

  const load = useCallback(async () => {
    try { setSt(await fetchPushStatus()); } catch (e) { setSt({ error: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (await saveCfg({ ...cfg, reminders: { ...r } })) flash("Đã lưu lịch nhắc. Áp dụng từ lần chạy kế tiếp (tối đa 15 phút).");
  };
  const test = async () => {
    setTesting(true);
    try { await syncPush(); const x = await sendTestPush(); flash(x.delivered > 0 ? "Đã gửi thử tới máy này — xem góc phải dưới màn hình." : "Chưa gửi được tới trình duyệt này.", x.delivered > 0 ? "ok" : "err"); }
    catch (e) { flash(e.message, "err"); }
    setTesting(false);
  };

  const emps = (cfg.employees || []).filter((e) => !isResigned(e));   // v8.5: bỏ người đã nghỉ
  const on = new Set((st?.subs || []).map((x) => x.emp_id).filter(Boolean));
  const missing = emps.filter((e) => !on.has(e.id));
  const empName = (id) => { const e = (cfg.employees || []).find((x) => x.id === id); return e ? empNameTag(e) : "(nhân sự đã xoá)"; };
  const stamp = (iso) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const what = (x) => (x.kind === "day" ? `Ngày ${dLabel(x.period.slice(0, 10))}` : x.kind === "week" ? `Tuần ${dLabel(x.period)}` : `Tháng ${Number(x.period.slice(5, 7))}/${x.period.slice(0, 4)}`);

  return (
    <Panel title="Nhắc nộp bảng công — thông báo trên máy tính">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle on={r.dayOn} onClick={() => set({ dayOn: !r.dayOn })} />
          <span className="w-28 text-sm text-slate-200">Nhắc hằng ngày</span>
          <div className={`flex h-9 w-56 items-center rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-400 ${r.dayOn ? "" : "opacity-40"}`}>Mỗi ngày làm việc</div>
          <TimePick value={r.dayTime} disabled={!r.dayOn} onChange={(v) => set({ dayTime: v })} />
          <span className={`text-sm text-slate-400 ${r.dayOn ? "" : "opacity-40"}`}>Thứ Bảy</span>
          <TimePick value={r.daySatTime} disabled={!r.dayOn} onChange={(v) => set({ daySatTime: v })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle on={r.weekOn} onClick={() => set({ weekOn: !r.weekOn })} />
          <span className="w-28 text-sm text-slate-200">Nhắc tuần trước</span>
          <div className="w-56"><select disabled={!r.weekOn} value={r.weekDow} onChange={(e) => set({ weekDow: Number(e.target.value) })} className={`disabled:opacity-40 ${selectCls}`}>
            {REM_DOW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
          <TimePick value={r.weekTime} disabled={!r.weekOn} onChange={(v) => set({ weekTime: v })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle on={r.monthOn} onClick={() => set({ monthOn: !r.monthOn })} />
          <span className="w-28 text-sm text-slate-200">Nhắc chốt tháng</span>
          <div className="w-56"><select disabled={!r.monthOn} value={r.monthTo} onChange={(e) => set({ monthTo: Number(e.target.value) })} className={`disabled:opacity-40 ${selectCls}`}>
            {[0, 1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d === 0 ? "Chỉ ngày cuối tháng" : `Cuối tháng → mùng ${d}`}</option>)}
          </select></div>
          <TimePick value={r.monthTime} disabled={!r.monthOn} onChange={(v) => set({ monthTime: v })} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3">
          <span className="text-xs text-slate-500">Chỉ gửi cho nhân sự còn ngày chưa gửi (nhắc hằng ngày: chưa gửi giờ của hôm nay; bỏ ngày lễ và ngày không phải chấm; thứ Bảy có giờ riêng và chỉ nhắc 2 lần: giờ đã chọn và 1 giờ sau). Lần đầu trong vòng 15 phút sau giờ đã chọn, sau đó nhắc lại mỗi 1 giờ tới 17:30 cho tới khi gửi đủ.</span>
          <button onClick={test} disabled={testing} className={`ml-auto ${btnGhost} disabled:opacity-40`}>{testing ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Gửi thử tới máy này</button>
          <button onClick={save} disabled={!dirty} className={`${btnPrimary} disabled:opacity-40`}><Save size={14} /> Lưu lịch nhắc</button>
        </div>

        <div className="border-t border-slate-800 pt-3">
          {st === null ? (
            <Loader2 className="animate-spin text-slate-500" size={16} />
          ) : st.error ? (
            <p className="text-xs text-rose-400">{st.error}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Bell size={14} className="text-teal-400" />
                <span className="text-slate-300">Đã bật thông báo: <span className="font-mono text-teal-400">{emps.length - missing.length}/{emps.length}</span> nhân sự</span>
                <button onClick={load} className="ml-auto text-xs text-teal-400 hover:text-teal-300">Tải lại</button>
              </div>
              {missing.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {missing.map((e) => <span key={e.id} className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-amber-300">{e.name}</span>)}
                </div>
              )}
              {st.log.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-slate-500">Lần nhắc gần nhất</div>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {st.log.slice(0, 15).map((x) => (
                      <div key={`${x.kind}|${x.period}|${x.emp_id}`} className="flex gap-3 text-xs text-slate-400">
                        <span className="w-20 shrink-0 font-mono text-slate-500">{stamp(x.sent_at)}</span>
                        <span className="w-24 shrink-0">{what(x)}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-300">{empName(x.emp_id)}</span>
                        <span className="shrink-0">{x.missing} ngày</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* v6.3 — Tăng ca là cài đặt chung: các khung giờ (bắt đầu – kết thúc) + hệ số, áp cho mọi nhân sự / vai trò.
   Không còn hạng mục [OT] ở tab Tác vụ. Mã khung cố định nên đổi giờ của khung không làm mất giờ đã chấm.
   Khung đang có giờ chấm thì không xoá được. Chủ nhật / ngày lễ: một hệ số cho cả ngày (để trống = theo khung giờ).
   Lưu: cfg.otBands = [{ id, from, to, rate }], cfg.otSunRate, cfg.otHolRate, cfg.otLegacy (mã [OT] cũ → khung). */
export const OT_TIME_RE = /^\s*(\d{1,2})\s*[:h.]\s*(\d{2})\s*$/;
export const otParseTime = (x) => { const m = OT_TIME_RE.exec(x || ""); if (!m) return null; const h = +m[1], mi = +m[2]; return h <= 24 && mi < 60 && h * 60 + mi <= 1440 ? `${h % 24}:${pad(mi)}` : null; };
export function OtRatePanel({ cfg, saveCfg, flash }) {
  useDataTick();
  const init = () => ({
    bands: (cfg.otBands || []).map((b) => ({ id: b.id, from: b.from, to: b.to, rate: b.rate != null ? String(b.rate) : "" })),
    sun: cfg.otSunRate != null ? String(cfg.otSunRate) : "",
    hol: cfg.otHolRate != null ? String(cfg.otHolRate) : "",
  });
  const [v, setV] = useState(init);
  const [assign, setAssign] = useState({});
  useEffect(() => { setV(init()); }, [cfg.otBands, cfg.otSunRate, cfg.otHolRate]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (x) => { const n = Number(String(x).replace(",", ".")); return x === "" || !(n > 0) ? null : Math.min(10, n); };

  /* giờ đã chấm theo khung (trong phần bảng công đang tải) + dòng tăng ca của hạng mục [OT] đã bị xoá trước v6.3 */
  const legacy = cfg.otLegacy || {};
  const known = new Set([...(cfg.tasks || []).map((t) => t.id), ...LEAVE_TASKS.map((t) => t.id), ...(cfg.otBands || []).map((b) => b.id), ...Object.keys(legacy)]);
  const used = new Map(), orphans = new Map();
  for (const bucket of Object.values(DB?.ts || {})) {
    for (const r of Array.isArray(bucket?.rows) ? bucket.rows : []) {
      const h = Object.values(r.days || {}).reduce((a, x) => a + (Number(x) || 0), 0);
      if (!h) continue;
      const bid = legacy[r.taskId] || r.taskId;
      if ((cfg.otBands || []).some((b) => b.id === bid)) used.set(bid, (used.get(bid) || 0) + h);
      else if (r.otFor && !known.has(r.taskId)) orphans.set(r.taskId, (orphans.get(r.taskId) || 0) + h);
    }
  }

  const setBand = (k, patch) => setV((x) => ({ ...x, bands: x.bands.map((b, i) => (i === k ? { ...b, ...patch } : b)) }));
  const addBand = () => setV((x) => ({ ...x, bands: [...x.bands, { id: "", from: "", to: "", rate: "2" }] }));
  const delBand = (k) => setV((x) => ({ ...x, bands: x.bands.filter((_, i) => i !== k) }));
  const spanOf = (b) => { const f = otParseTime(b.from), t = otParseTime(b.to); return f && t ? otSpan({ name: `[OT] ${f} - ${t}` }) : null; };

  const save = async () => {
    if (!v.bands.length) return flash("Cần ít nhất một khung giờ tăng ca.", "err");
    const out = [], keys = new Set();
    for (const b of v.bands) {
      const from = otParseTime(b.from), to = otParseTime(b.to);
      if (!from || !to) return flash(`Giờ của khung "${b.from || "?"} – ${b.to || "?"}" chưa đúng dạng 17:30.`, "err");
      if (from === to) return flash(`Khung ${from} – ${to}: giờ bắt đầu và kết thúc trùng nhau.`, "err");
      const key = otBandKey({ name: `[OT] ${from} - ${to}` });
      if (keys.has(key)) return flash(`Khung ${from} – ${to} bị trùng.`, "err");
      keys.add(key);
      if (num(b.rate) == null) return flash(`Nhập hệ số cho khung ${from} – ${to} (số lớn hơn 0).`, "err");
      let id = b.id || otBandIdFor(from, to);
      if (!b.id && (out.some((x) => x.id === id) || (cfg.otBands || []).some((x) => x.id === id) || Object.keys(legacy).includes(id))) id = uid("OTB_");
      out.push({ id, from, to, rate: num(b.rate) });
    }
    for (const [k, l] of [["sun", "Chủ nhật"], ["hol", "ngày lễ"]]) if (v[k] !== "" && num(v[k]) == null) return flash(`Hệ số ${l} phải là số lớn hơn 0, hoặc để trống.`, "err");
    const gone = (cfg.otBands || []).filter((b) => !out.some((x) => x.id === b.id) && used.get(b.id));
    if (gone.length) return flash(`Khung ${gone[0].from} – ${gone[0].to} đã có giờ chấm, không xoá được.`, "err");
    const ok = await saveCfg({ ...cfg, otBands: out, otSunRate: num(v.sun), otHolRate: num(v.hol) });
    if (ok !== false) flash("Đã lưu tăng ca. Dashboard, Tiến độ dự án và Excel tính lại theo khung giờ / hệ số mới.");
  };
  const doAssign = async (old) => {
    const bid = assign[old] || cfg.otBands?.[0]?.id;
    if (!bid) return;
    const ok = await saveCfg({ ...cfg, otLegacy: { ...legacy, [old]: bid } });
    if (ok !== false) flash("Đã gán giờ tăng ca cũ vào khung giờ.");
  };
  const field = "font-mono text-center " + inputCls;
  return (
    <Panel title="Tăng ca — khung giờ & hệ số" sub="Áp dụng cho mọi nhân sự, mọi vai trò. Không cần tạo hạng mục [OT] ở tab Tác vụ.">
      {OT_MIG_NOTE && <div className="mb-3 rounded-lg border border-sky-900 bg-sky-950/40 px-3 py-2 text-sm text-sky-200">{OT_MIG_NOTE}</div>}
      <div className="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <div className="mb-1 grid grid-cols-[2.25rem_minmax(0,1fr)_4rem_2.75rem] sm:grid-cols-[2.25rem_minmax(0,1fr)_5rem_3.5rem_2.75rem] items-center gap-2 text-xs text-slate-500">
            <span /><span>Khung giờ (bắt đầu – kết thúc)</span><span className="text-center">Hệ số</span><span className="hidden text-right sm:block">Tối đa</span><span />
          </div>
          {v.bands.map((b, k) => {
            const sp = spanOf(b), h = b.id ? used.get(b.id) || 0 : 0;
            return (
              <div key={k} className="grid grid-cols-[2.25rem_minmax(0,1fr)_4rem_2.75rem] sm:grid-cols-[2.25rem_minmax(0,1fr)_5rem_3.5rem_2.75rem] items-center gap-2 border-b border-slate-800 py-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-950 font-mono text-[11px] font-semibold text-teal-300">OT{k + 1}</span>
                <div className="flex min-w-0 items-center gap-1.5">
                  <input value={b.from} onChange={(e) => setBand(k, { from: e.target.value })} placeholder="17:30" aria-label={`Bắt đầu khung ${k + 1}`} className={`${field} min-w-0 px-1`} />
                  <span className="text-slate-600">–</span>
                  <input value={b.to} onChange={(e) => setBand(k, { to: e.target.value })} placeholder="21:00" aria-label={`Kết thúc khung ${k + 1}`} className={`${field} min-w-0 px-1`} />
                </div>
                <input inputMode="decimal" value={b.rate} onChange={(e) => setBand(k, { rate: e.target.value })} aria-label={`Hệ số khung ${k + 1}`} className={`${field} px-1`} />
                <span className="hidden text-right font-mono text-xs text-slate-500 sm:block">{sp ? `${fmtH(sp.hours)} h` : "—"}</span>
                <button onClick={() => (h ? null : delBand(k))} disabled={h > 0} title={h ? `Đã có ${fmtH(h)} h chấm vào khung này — không xoá được` : "Xoá khung giờ"}
                  className={`${iconBtn} h-11 w-11 hover:border-rose-800 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30`}><Trash2 size={15} /></button>
              </div>
            );
          })}
          <button onClick={addBand} className={`mt-2 ${btnGhost} border-dashed`}><Plus size={14} /> Thêm khung giờ</button>
          <div className="mt-2 text-xs leading-relaxed text-slate-500">Khung qua nửa đêm (21:00 – 0:00, 0:00 – 8:00) tự tính đúng số giờ. Đổi giờ của khung không làm mất giờ đã chấm — giờ cũ đi theo khung. Khung đang có giờ chấm thì không xoá được.</div>
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-xs text-slate-500">Ngày đặc biệt — một hệ số cho cả ngày</div>
          {[["sun", "Chủ nhật"], ["hol", "Ngày lễ (theo danh sách ngày lễ bên dưới)"]].map(([k, l]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-slate-800 py-1.5">
              <span className="text-sm text-slate-300">{l}</span>
              <div className="w-24 shrink-0"><input inputMode="decimal" placeholder="—" value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} aria-label={`Hệ số ${l}`} className={field} /></div>
            </div>
          ))}
          <div className="mt-2 text-xs text-slate-500">Để trống thì ngày đó tính theo hệ số khung giờ.</div>
        </div>
      </div>
      {orphans.size > 0 && (
        <div className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/20 p-3">
          <div className="text-sm text-amber-300">Có giờ tăng ca chấm vào hạng mục [OT] đã bị xoá — chọn khung giờ để gán lại</div>
          {[...orphans.entries()].map(([old, h]) => (
            <div key={old} className="mt-2 flex flex-wrap items-center gap-2">
              <span className="min-w-[9rem] text-sm text-slate-300">{fmtH(h)} h <span className="font-mono text-xs text-slate-600">({old})</span></span>
              <select value={assign[old] || cfg.otBands?.[0]?.id || ""} onChange={(e) => setAssign((x) => ({ ...x, [old]: e.target.value }))}
                className={`${CTRL} w-44 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-teal-300`}>
                {(cfg.otBands || []).map((b) => <option key={b.id} value={b.id}>{b.from} – {b.to}</option>)}
              </select>
              <button onClick={() => doAssign(old)} className={btnGhost}><Check size={14} /> Gán</button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-500">Giờ quy đổi = giờ tăng ca × hệ số. Dashboard, Tiến độ dự án và Excel tính lại ngay sau khi lưu.</span>
        <button onClick={save} className={`ml-auto shrink-0 ${btnPrimary}`}><Save size={14} /> Lưu tăng ca</button>
      </div>
    </Panel>
  );
}

/* v5.3 — Ngưỡng tải nhân sự cho khung "Phân bổ giờ công theo nhân sự" (Dashboard) và cột Trạng thái trong Excel */
export function AllocLimitPanel({ cfg, saveCfg, flash }) {
  const cur = allocLimits(cfg);
  const [v, setV] = useState({ over: String(cur.over), under: String(cur.under) });
  useEffect(() => { const c = allocLimits(cfg); setV({ over: String(c.over), under: String(c.under) }); }, [cfg.allocOver, cfg.allocUnder]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const o = Number(v.over), u = Number(v.under);
    if (!(o >= 100 && o <= 300)) return flash("Ngưỡng Quá tải phải từ 100 đến 300%.", "err");
    if (!(u >= 0 && u <= 100)) return flash("Ngưỡng Thiếu giờ phải từ 0 đến 100%.", "err");
    await saveCfg({ ...cfg, allocOver: o, allocUnder: u });
    flash("Đã lưu ngưỡng tải nhân sự.");
  };
  return (
    <Panel title="Ngưỡng tải nhân sự">
      <div className="grid grid-cols-2 gap-3 md:max-w-xl">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Quá tải khi tổng giờ vượt (% giờ chuẩn kỳ)</label>
          <input type="number" inputMode="numeric" min="100" max="300" value={v.over} onChange={(e) => setV((x) => ({ ...x, over: e.target.value }))} className={`font-mono ${inputCls}`} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Thiếu giờ khi giờ chuẩn dưới (% giờ chuẩn kỳ)</label>
          <input type="number" inputMode="numeric" min="0" max="100" value={v.under} onChange={(e) => setV((x) => ({ ...x, under: e.target.value }))} className={`font-mono ${inputCls}`} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-500">Dùng cho khung Phân bổ giờ công theo nhân sự ở Dashboard và cột Trạng thái trong Excel. Mặc định 110% / 90%.</span>
        <button onClick={save} className={`ml-auto shrink-0 ${btnPrimary}`}><Save size={14} /> Lưu ngưỡng</button>
      </div>
    </Panel>
  );
}

/* v13.42 — Ngưỡng kết luận cho màn Kế hoạch › So với thực tế, trước đây gắn cứng trong mã */
export function PlanLimitPanel({ cfg, saveCfg, flash }) {
  const cur = planLimits(cfg);
  const [v, setV] = useState({ tol: String(cur.tol), mix: String(cur.mix) });
  useEffect(() => { const c = planLimits(cfg); setV({ tol: String(c.tol), mix: String(c.mix) }); }, [cfg.planTol, cfg.planMix]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const t = Number(v.tol), m = Number(v.mix);
    if (!(t >= 1 && t <= 100)) return flash("Ngưỡng đúng kế hoạch phải từ 1 đến 100%.", "err");
    if (!(m >= 1 && m <= 200)) return flash("Ngưỡng lệch vai trò phải từ 1 đến 200%.", "err");
    await saveCfg({ ...cfg, planTol: t, planMix: m });
    flash("Đã lưu ngưỡng kết luận kế hoạch.");
  };
  return (
    <Panel title="Ngưỡng kết luận kế hoạch so với thực tế">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-xl">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Đúng kế hoạch khi lệch trong (% kế hoạch)</label>
          <input type="number" inputMode="numeric" min="1" max="100" value={v.tol} onChange={(e) => setV((x) => ({ ...x, tol: e.target.value }))} className={`font-mono ${inputCls}`} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Lệch vai trò khi tổng sai lệch vượt (% kế hoạch)</label>
          <input type="number" inputMode="numeric" min="1" max="200" value={v.mix} onChange={(e) => setV((x) => ({ ...x, mix: e.target.value }))} className={`font-mono ${inputCls}`} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-500">Quyết định các chip Đúng kế hoạch / Vượt / Thấp hơn / Đủ người nhưng sai vai trò ở tab Kế hoạch › So với thực tế. Mặc định 15% / 30%.</span>
        <button onClick={save} className={`ml-auto shrink-0 ${btnPrimary}`}><Save size={14} /> Lưu ngưỡng</button>
      </div>
    </Panel>
  );
}

export function SettingsTab({ cfg, saveCfg, flash }) {
  const [day, setDay] = useState(cfg.deadlineDay || 5);
  const [confirm, setConfirm] = useState("");
  const [h, setH] = useState({ ...DEFAULT_HOURS, ...(cfg.hours || {}) });
  const [holDate, setHolDate] = useState(fmt(new Date()));
  const [holName, setHolName] = useState("");
  const [holYearly, setHolYearly] = useState(true);
  const [pendingHol, setPendingHol] = useState(null);

  const target = weeklyTarget(h);
  const setHNum = (k, v) => setH((x) => ({ ...x, [k]: v === "" ? 0 : Math.max(0, Math.min(24, Number(v))) }));

  const saveHours = async () => {
    await saveCfg({ ...cfg, hours: { ...h } });
    flash("Đã lưu. Giờ chuẩn và ngưỡng giờ cố gắng áp dụng ngay cho toàn bộ nhân viên.");
  };

  // Lễ lặp hàng năm xếp trước và so theo ngày-tháng; lễ của riêng một năm xếp sau theo ngày đầy đủ
  const holidays = [...(cfg.holidays || [])].sort((a, b) => {
    if (!!a.yearly !== !!b.yearly) return a.yearly ? -1 : 1;
    return a.yearly ? a.date.slice(5).localeCompare(b.date.slice(5)) : a.date.localeCompare(b.date);
  });
  const sameSlot = (x, date, yearly) => (yearly && x.yearly ? x.date.slice(5) === date.slice(5) : !yearly && !x.yearly && x.date === date);
  const holLabel = (x) => (x.yearly ? `Ngày ${x.date.slice(8)}/${x.date.slice(5, 7)} — hàng năm` : dFull(x.date));

  const addHoliday = async () => {
    if (!holName.trim()) return flash("Đặt tên cho ngày lễ, ví dụ Giỗ Tổ Hùng Vương.", "err");
    if (holidays.some((x) => sameSlot(x, holDate, holYearly))) return flash("Ngày này đã có trong danh sách.", "err");
    await saveCfg({ ...cfg, holidays: [...holidays, { date: holDate, name: holName.trim(), yearly: holYearly }] });
    setHolName(""); flash(holYearly ? "Đã thêm ngày lễ, áp dụng cho mọi năm." : "Đã thêm ngày lễ cho riêng năm này.");
  };
  const addVnFixed = async () => {
    const y = new Date().getFullYear();
    const toAdd = VN_FIXED_HOLIDAYS
      .filter((h) => !holidays.some((x) => x.yearly && x.date.slice(5) === h.md))
      .map((h) => ({ date: `${y}-${h.md}`, name: h.name, yearly: true }));
    if (toAdd.length === 0) return flash("Các ngày lễ cố định đều đã có trong danh sách.");
    await saveCfg({ ...cfg, holidays: [...holidays, ...toAdd] });
    flash(`Đã thêm ${toAdd.length} ngày lễ cố định, áp dụng cho mọi năm.`);
  };
  const toggleYearly = async (x) => {
    await saveCfg({ ...cfg, holidays: holidays.map((y) => (y === x ? { ...y, yearly: !y.yearly } : y)) });
  };
  const confirmDelHoliday = async () => {
    const x = pendingHol; setPendingHol(null);
    if (!x) return;
    await saveCfg({ ...cfg, holidays: holidays.filter((y) => !(y.date === x.date && y.name === x.name)) });
    flash("Đã xoá ngày lễ.");
  };

  const wipe = async () => {
    if (confirm !== "XOA") return flash('Gõ đúng chữ "XOA" để xác nhận.', "err");
    const ok = await wipeTs();
    flash(ok ? "Đã xoá toàn bộ dữ liệu chấm công." : `Chưa xoá được — ${LAST_STORAGE_ERROR || "thử lại"}`, ok ? "ok" : "err"); if (ok) setConfirm("");
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <PhasePanel cfg={cfg} saveCfg={saveCfg} flash={flash} />

      <Panel title="Giờ chuẩn & ngưỡng cảnh báo">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {[["weekday", "Giờ chuẩn T2–T6"], ["sat", "Giờ chuẩn T7"], ["sun", "Giờ chuẩn CN"], ["satOt", "Cố gắng T7 từ"], ["maxDaily", "Cảnh báo vượt / ngày"]].map(([k, l]) => (
            <div key={k}>
              <label className="mb-1 block text-xs text-slate-500">{l}</label>
              <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={h[k] ?? ""}
                onChange={(e) => setHNum(k, e.target.value)} className={`font-mono ${inputCls}`} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3">
          <span className="text-xs text-slate-500">Target tuần tự tính: <b className="font-mono text-teal-400">{target.toFixed(1)} giờ</b></span>
          <button onClick={saveHours} className={`ml-auto ${btnPrimary}`}><Save size={14} /> Lưu giờ chuẩn</button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          <b className="text-slate-400">Giờ chuẩn</b> quyết định target và cảnh báo thiếu giờ. Đặt 0 cho một loại ngày nghĩa là ngày nghỉ — không báo thiếu, mọi giờ làm việc thường chấm vào tính hết thành Giờ cố gắng (không phải OT).
          <br /><b className="text-slate-400">Cố gắng T7 từ</b> là mốc bắt đầu tính Giờ cố gắng riêng cho thứ 7: giờ chuẩn T7 vẫn là {h.sat || 0}h nhưng chỉ phần vượt {h.satOt ?? 8}h mới thành Giờ cố gắng. Ngày thường: phần giờ làm việc vượt giờ chuẩn là Giờ cố gắng.
          <br /><b className="text-slate-400">OT</b> chỉ tính khi nhân sự chấm vào khung giờ Tăng ca (cài ở mục Tăng ca), và mỗi dòng tăng ca phải chọn "Tăng ca cho tác vụ". Giờ cố gắng ghi nhận nỗ lực, không tính vào chi phí dự án.
          <br />Toàn bộ nhân viên lấy các thông số này từ đây — sửa ở đây là áp cho tất cả.
        </p>
      </Panel>

      <OtRatePanel cfg={cfg} saveCfg={saveCfg} flash={flash} />

      <AllocLimitPanel cfg={cfg} saveCfg={saveCfg} flash={flash} />
      <PlanLimitPanel cfg={cfg} saveCfg={saveCfg} flash={flash} />

      <ReminderPanel cfg={cfg} saveCfg={saveCfg} flash={flash} />

      <AccessPanel flash={flash} />

      {/* v12 — bật / tắt mục Kế hoạch. Tắt thì tab biến mất khỏi menu, dữ liệu kế hoạch vẫn còn nguyên. */}
      <Panel title="Kế hoạch nguồn lực" sub="Lưới số người theo dự án, vai trò và tuần — chỉ Admin nhập, BOD xem">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle on={cfg.planning?.enabled !== false} onClick={() => saveCfg({ ...cfg, planning: { ...(cfg.planning || {}), enabled: cfg.planning?.enabled === false } })} />
          <span className="text-sm text-slate-200">{cfg.planning?.enabled === false ? "Đang tắt" : "Đang bật"}</span>
          <span className="text-xs text-slate-500">Lần đầu dùng cần chạy file supabase/v12_ke_hoach.sql trên Supabase.</span>
        </div>
      </Panel>

      <Panel title={`Ngày lễ, ngày nghỉ chung (${holidays.length})`}>
        <div className="ro-hide grid gap-2 md:flex md:items-end md:gap-3">
          <DateField label="Ngày" value={holDate} onChange={setHolDate} className="md:w-40" />
          <div className="md:flex-1">
            <label className="mb-1 block text-xs text-slate-500">Tên ngày lễ</label>
            <input value={holName} onChange={(e) => setHolName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHoliday()}
              placeholder="Quốc khánh, Tết Dương lịch…" className={inputCls} />
          </div>
          <button onClick={addHoliday} className={btnPrimary}><Plus size={14} /> Thêm ngày lễ</button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={holYearly} onChange={(e) => setHolYearly(e.target.checked)}
              className="h-4 w-4 accent-teal-500" />
            Lặp lại hàng năm
          </label>
          <span className="text-xs text-slate-500">
            {holYearly
              ? `Năm nào cũng nghỉ ngày ${holDate.slice(8)}/${holDate.slice(5, 7)} — dùng cho lễ dương lịch cố định`
              : "Chỉ áp dụng đúng ngày này của năm nay — dùng cho lễ âm lịch như Tết, Giỗ Tổ"}
          </span>
          <button onClick={addVnFixed} className={`ml-auto ${btnGhost}`}>
            <Plus size={14} /> Thêm nhanh 4 lễ cố định VN
          </button>
        </div>

        {holidays.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Chưa khai báo ngày lễ nào. Thêm vào đây thì nhân sự sẽ không bị báo thiếu giờ những ngày đó.</p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {holidays.map((x, i) => (
              <div key={`${x.date}|${x.name}|${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm text-slate-100"><Flag size={12} className="shrink-0 text-rose-400" /><span className="truncate">{x.name}</span></div>
                  <div className="font-mono text-xs text-slate-500">{holLabel(x)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => toggleYearly(x)} title={x.yearly ? "Chuyển thành lễ của riêng năm này" : "Chuyển thành lặp hàng năm"}
                    className={`rounded-md border px-2 py-1 text-[10px] ${x.yearly ? "border-teal-800 bg-teal-950 text-teal-300" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}>
                    {x.yearly ? "Hàng năm" : "Một lần"}
                  </button>
                  <button onClick={() => setPendingHol(x)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Ngày lễ áp dụng cho toàn công ty. Giờ làm việc thường chấm vào ngày lễ được tính là Giờ cố gắng (OT chỉ khi chấm hạng mục Tăng ca).
          Lễ âm lịch như Tết Nguyên đán hay Giỗ Tổ đổi ngày dương mỗi năm nên để chế độ "Một lần" và khai lại đầu mỗi năm.
        </p>
      </Panel>

      <Panel title="Quy định chấm công">
        <div className="grid gap-3 md:flex md:flex-wrap md:items-end">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Hạn chốt công hàng tháng (ngày)</label>
            <input type="number" inputMode="numeric" min="1" max="28" value={day} onChange={(e) => setDay(Number(e.target.value))} className={`font-mono md:w-32 ${inputCls}`} />
          </div>
          <button onClick={async () => { await saveCfg({ ...cfg, deadlineDay: day }); flash("Đã lưu thiết lập."); }} className={`ro-hide ${btnPrimary}`}>Lưu thiết lập</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Nhân sự thấy cảnh báo vàng về bảng công tháng trước từ đầu tháng, chuyển đỏ “quá hạn” sau ngày {pad(day)}.
        </p>
      </Panel>

      <Panel title="Xoá dữ liệu chấm công">
        <p className="text-sm text-slate-300">Xoá toàn bộ giờ công đã nhập của mọi nhân sự. Danh sách dự án, nhân sự và hạng mục được giữ lại. Không khôi phục được — xuất Excel trước khi xoá.</p>
        <div className="mt-3 grid gap-2 md:flex md:items-center">
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Gõ XOA để xác nhận" className={`md:w-56 ${inputCls}`} />
          <button onClick={wipe} className={btnDanger}><RotateCcw size={14} /> Xoá dữ liệu</button>
        </div>
      </Panel>

      <BackupPanel cfg={cfg} saveCfg={saveCfg} flash={flash} setCfgFromRestore={saveCfg} />
      <StorageDoctor cfg={cfg} admin />

      <ConfirmDialog
        open={!!pendingHol}
        title={`Xoá ngày lễ ${pendingHol?.name || ""}?`}
        desc={pendingHol ? `${holLabel(pendingHol)} sẽ quay lại tính giờ chuẩn như ngày thường, và cảnh báo thiếu giờ sẽ áp dụng trở lại.` : ""}
        confirmLabel="Xoá ngày lễ"
        onConfirm={confirmDelHoliday}
        onCancel={() => setPendingHol(null)}
      />
    </div>
  );
}

