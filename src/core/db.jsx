/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect } from "react";
import { fetchConfig, saveConfig, fetchTs, fetchTsChanges, fetchTsStamps, saveTs, deleteAllTs, fetchUsage, fetchPhaseDetail } from "../data.js";
import { mergeConfig } from "../merge.js";
import { supabase } from "../storage.js";
import { DEFAULT_HOURS, fmt, makeHolidayIndex, minHoursFor, pad, weekDays, ymOf } from "./date.jsx";
import { DEFAULT_PHASE, NO_PROJECT, emptyConfig, isLeaveTask } from "./domain.jsx";

/* v2.2 — Thư viện Excel nặng nhất app; chỉ tải khi có người bấm xuất / đọc file Excel. */
export let XLSX_MOD = null;
export const loadXlsx = async () => XLSX_MOD || (XLSX_MOD = await import("xlsx"));
export const TS_PREFIX = "artius:ts:";   // tiền tố khoá của file sao lưu đời cũ, chỉ còn dùng khi khôi phục
export let DB = null;            // { v, config, base, ts: { "<empId>:<ym>": bucket } } — base = bản thiết lập khớp với server lần gần nhất
export let DB_LOADED = false;
export const cloneJson = (o) => JSON.parse(JSON.stringify(o));
export const LOAD_TIMEOUT = 30000; // tải toàn bộ bảng công (tài khoản quản lý) có thể lâu hơn một lệnh thường

export const slot = (empId, ym) => `${empId}:${ym}`;
export const emptyDB = () => ({ v: 2, config: emptyConfig(), ts: {} });

/* v2.1 — Chỉ tải sẵn bảng công RECENT_MONTHS tháng gần nhất (tính cả tháng này) và các tháng sau đó.
   Tháng cũ hơn: ensureMonths() tải khi có màn hình cần tới. full = true: tải hết (dùng khi xuất sao lưu). */
export const RECENT_MONTHS = 6;
export const recentFromYm = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (RECENT_MONTHS - 1)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const LOADED_OLD = new Set();   // các tháng cũ (trước mốc) đã tải đủ
export const loadDB = async (force = false, full = false) => {
  if (DB_LOADED && !force) return DB;
  const c = await call(() => fetchConfig(), "get", LOAD_TIMEOUT);
  if (!c.ok) throw new Error("Không đọc được thiết lập");
  let config = c.value?.config || null;
  if (!config) {
    /* Server xác nhận chưa có dòng thiết lập nào = cài mới. Chỉ tài khoản quản lý tạo được;
       nhân sự gặp trường hợp này thì dừng ở màn báo lỗi chứ không dựng dữ liệu rỗng. */
    config = emptyConfig();
    const w = await call(() => saveConfig(config, null), "set");
    if (!w.ok) throw new Error("Không khởi tạo được dữ liệu");
    if (w.value.conflict) return loadDB(force);   // người khác vừa tạo trước: đọc lại bản của họ
  }
  const fromYm = full ? "" : recentFromYm();
  const t = await call(() => fetchTsChanges("", { fromYm }), "get", LOAD_TIMEOUT);
  if (!t.ok) throw new Error("Không đọc được bảng công");
  DB = { v: 2, config, base: cloneJson(config), ts: t.value.rows || {}, loadedFrom: fromYm };
  TS_STAMP = new Map(Object.entries(t.value.stamps || {}));
  LOADED_OLD.clear();
  TS_SYNC = t.value.max || "";
  DB_LOADED = true;
  bumpData();
  return DB;
};

/* v2.1 — Bảo đảm các tháng yms đã có trong bộ nhớ: tháng nào cũ hơn mốc tải sẵn mà chưa tải thì đọc từ server
   (quản lý: bảng công của mọi người trong tháng đó; nhân sự: của chính mình). Có tải thêm thì báo các màn hình vẽ lại. */
export const ensureMonths = async (yms) => {
  if (!DB_LOADED || !DB?.loadedFrom) return true;
  const need = [...new Set(yms)].filter((ym) => ym && ym < DB.loadedFrom && !LOADED_OLD.has(ym));
  if (!need.length) return true;
  const stamps = {};
  const r = await call(() => fetchTs({ yms: need, stamps }), "get", LOAD_TIMEOUT);
  if (!r.ok) return false;
  for (const ym of need) LOADED_OLD.add(ym);
  for (const [k, v] of Object.entries(r.value)) DB.ts[k] = v;
  for (const [k, at] of Object.entries(stamps)) TS_STAMP.set(k, at);
  bumpData();
  return true;
};
/* v2.1 — Tổng giờ dự án × giai đoạn trên toàn bộ dữ liệu, hỏi database (xem fetchUsage). null = chưa có / không hỏi được. */
export const useUsage = () => {
  const tick = useDataTick();
  const [u, setU] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchUsage().then((r) => { if (alive) setU(r); }).catch(() => { if (alive) setU(null); });
    return () => { alive = false; };
  }, [tick]);
  return u;
};
/* v4.7 — Chi tiết giai đoạn cho Dashboard (xem fetchPhaseDetail). undefined = đang hỏi; null = không hỏi được
   (chưa chạy schema.sql mục 14) → Dashboard tạm tính từ phần bảng công đang có trong bộ nhớ. */
export const usePhaseDetail = () => {
  const tick = useDataTick();
  const [d, setD] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetchPhaseDetail().then((r) => { if (alive) setD(r); }).catch(() => { if (alive) setD(null); });
    return () => { alive = false; };
  }, [tick]);
  return d;
};
export const allLoaded = () => DB_LOADED && !DB?.loadedFrom;

/* v1.9 — Tự cập nhật. TS_SYNC là mốc thời gian (giờ server) của dòng mới nhất đã nhận.
   pullTs hỏi server "có dòng bảng công nào đổi sau mốc này không" rồi chép vào bộ nhớ;
   có thay đổi thật thì báo cho các màn hình đang mở vẽ lại (useDataTick). */
export let TS_SYNC = "";
export let DATA_TICK = 0;
export const dataListeners = new Set();
export const bumpData = () => { DATA_TICK++; dataListeners.forEach((f) => f()); };
export const useDataTick = () => {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    dataListeners.add(f);
    return () => { dataListeners.delete(f); };
  }, []);
  return DATA_TICK;
};
export let PULLING = false;
/* v2.2 — TS_STAMP: mốc updated_at của từng dòng (nhân sự, tháng) đang giữ trong bộ nhớ.
   pullTs hỏi danh sách mốc (rất nhẹ), so với TS_STAMP, rồi chỉ tải nội dung các dòng có mốc khác.
   Tháng cũ chưa mở (ngoài 6 tháng tải sẵn) thì bỏ qua, khi nào cần ensureMonths sẽ tải đủ cả tháng. */
export let TS_STAMP = new Map();
export const pullTs = async () => {
  if (!DB_LOADED || !DB || PULLING) return false;
  PULLING = true;
  let changed = false;
  try {
    const list = await fetchTsStamps(TS_SYNC);   // gọi thẳng, không qua call(): lỗi ở lần hỏi ngầm thì bỏ qua, lần sau hỏi lại
    let max = TS_SYNC;
    const need = [];
    for (const x of list) {
      if (x.at && (!max || new Date(x.at) > new Date(max))) max = x.at;
      if (TS_STAMP.get(x.key) === x.at) continue;
      if (DB.loadedFrom && x.ym < DB.loadedFrom && !LOADED_OLD.has(x.ym)) continue;
      need.push(x);
    }
    if (need.length) {
      const stamps = {};
      const rows = await fetchTs({ empIds: [...new Set(need.map((x) => x.empId))], yms: [...new Set(need.map((x) => x.ym))], stamps });
      for (const x of need) {
        const v = rows[x.key];
        if (v === undefined) continue;
        if (JSON.stringify(DB.ts[x.key]) !== JSON.stringify(v)) { DB.ts[x.key] = v; changed = true; }
        TS_STAMP.set(x.key, stamps[x.key] || x.at);
      }
    }
    TS_SYNC = max;
    setNet(true);
  } catch (e) {
    if (isNetErr(errText(e))) setNet(false);
  }
  PULLING = false;
  if (changed) bumpData();
  return changed;
};
/* Đăng xuất: bỏ hết dữ liệu đang giữ trong bộ nhớ để người đăng nhập sau tải lại từ đầu */
export const resetDB = () => { DB = null; DB_LOADED = false; TS_SYNC = ""; TS_STAMP = new Map(); memCache.clear(); LAST_STORAGE_ERROR = ""; };

/* Ghi thiết lập (chỉ tài khoản quản lý ghi được, database tự chặn người khác).
   Đọc bản mới nhất trên server, gộp phần mình vừa sửa vào (xem merge.js), rồi ghi kèm số phiên bản.
   Nếu đúng lúc đó có người ghi chen vào thì đọc lại và gộp lần nữa.
   Trả về bản thiết lập đã gộp (để giao diện hiện cả phần người khác vừa sửa), hoặc null nếu không ghi được. */
export const commitConfig = async (next) => {
  if (!DB) DB = emptyDB();
  const base = DB.base || DB.config;
  DB.config = next;
  for (let attempt = 0; attempt < 4; attempt++) {
    const f = await call(() => fetchConfig(), "get");
    if (!f.ok) return null;
    const merged = f.value ? mergeConfig(base, next, f.value.config) : next;
    const w = await call(() => saveConfig(merged, f.value ? f.value.rev : null), "set");
    if (!w.ok) return null;
    if (!w.value.conflict) { DB.config = merged; DB.base = cloneJson(merged); return merged; }
  }
  LAST_STORAGE_ERROR = "thiết lập đang được sửa liên tục ở máy khác, hoặc tài khoản không có quyền quản lý";
  return null;
};
/* Ghi các bảng công trong changes = { "<empId>:<ym>": bucket }. Chỉ đụng tới đúng các dòng đó. */
export const commitTs = async (changes) => {
  if (!DB) DB = emptyDB();
  Object.assign(DB.ts, changes);
  if (Object.keys(changes).length === 0) return true;
  return (await call(() => saveTs(changes), "set")).ok;
};
/* Đọc lại từ server các tháng của một nhân sự rồi cập nhật bộ nhớ. Gọi ngay trước khi lưu, để phần
   người đó vừa nhập ở máy khác (hoặc quản lý vừa sửa) trong cùng tháng không bị bản cũ trên máy này đè. */
export const refreshTs = async (empId, yms) => {
  const r = await call(() => fetchTs({ empId, yms }), "get");
  if (!r.ok) return false;
  if (!DB) DB = emptyDB();
  for (const ym of yms) {
    const k = slot(empId, ym);
    if (r.value[k]) DB.ts[k] = r.value[k]; else delete DB.ts[k];
  }
  return true;
};
export const wipeTs = async () => {
  if (!DB) DB = emptyDB();
  const ok = (await call(() => deleteAllTs(), "set")).ok;
  if (ok) DB.ts = {};
  return ok;
};

/* v8.5 — Xoá hẳn toàn bộ bảng công (mọi tháng) của một nhân sự trên server, rồi bỏ khỏi bộ nhớ. Không hoàn tác được. */
export const purgeEmpTs = async (empId) => {
  const { error } = await supabase.from("artius_ts").delete().eq("emp_id", empId);
  if (error) throw new Error(`Không xoá được giờ công: ${error.message || error.code || "lỗi không rõ"}`);
  const pre = `${empId}:`;
  if (DB?.ts) for (const k of Object.keys(DB.ts)) if (k.startsWith(pre)) delete DB.ts[k];
  for (const k of [...TS_STAMP.keys()]) if (k.startsWith(pre)) TS_STAMP.delete(k);
  bumpData();
};
/* v8.5 — Đọc toàn bộ giờ công (mọi tháng, cả nháp) của các nhân sự ids: { id: { total, sent, months, byProj: Map(label → giờ), rows: [...] } } */
export const empHoursAll = async (ids, labelOf) => {
  const out = {};
  if (!ids.length) return out;
  const map = await fetchTs({ empIds: ids });
  for (const [k, b] of Object.entries(map)) {
    const i = k.indexOf(":"), id = k.slice(0, i), ym = k.slice(i + 1);
    const o = out[id] || (out[id] = { total: 0, sent: 0, months: new Set(), byProj: new Map(), rows: [] });
    for (const r of b?.rows || []) for (const [d, hv] of Object.entries(r.days || {})) {
      const h = Number(hv) || 0; if (h <= 0) continue;
      const ok = !!b.sent?.[d];
      o.total += h; if (ok) o.sent += h; o.months.add(ym);
      const lb = labelOf.proj(r);
      o.byProj.set(lb, (o.byProj.get(lb) || 0) + h);
      o.rows.push({ date: d, ym, proj: lb, phase: r.projectId === NO_PROJECT || isLeaveTask(r.taskId) ? "" : (r.phaseId || DEFAULT_PHASE), task: labelOf.task(r), h, sent: ok, note: r.note || "" });
    }
  }
  return out;
};
export const dbTs = (empId, ym) => DB?.ts?.[slot(empId, ym)] || null;
/* v1.9 — Gửi và khoá theo TỪNG NGÀY. Ngày đã gửi được ghi ở bucket.sent['YYYY-MM-DD'] trong dòng tháng của ngày đó.
   Quản lý chỉ tổng hợp giờ của những ngày đã gửi. Dòng nào không còn ngày nào thì bỏ. */
export const sentRows = (bucket) => {
  const sent = bucket?.sent || {};
  const out = [];
  for (const r of bucket?.rows || []) {
    const days = {};
    for (const [d, h] of Object.entries(r.days || {})) if (sent[d]) days[d] = h;
    if (Object.keys(days).length) out.push({ ...r, days });
  }
  return out;
};
export const dbTsSent = (empId, ym) => { const b = dbTs(empId, ym); return b ? { ...b, rows: sentRows(b) } : null; };
export const daySent = (empId, d) => !!dbTs(empId, ymOf(d))?.sent?.[d];
/* Một tuần tính là "đã nộp" khi mọi ngày phải chấm công của tuần (ngày có giờ chuẩn > 0 và không phải ngày lễ)
   đều đã gửi. Tuần gửi theo kiểu cũ (dấu weeks) vẫn được tính là đã nộp. */
export const weekDone = (empId, monday) => {
  const hs = makeHolidayIndex(DB?.config?.holidays);
  const hc = DB?.config?.hours || DEFAULT_HOURS;
  const wd = weekDays(monday);
  const today = fmt(new Date());   // v2.0: chỉ tính ngày đã tới (kể cả hôm nay), ngày tương lai chưa phải nộp
  if (wd.filter((d) => d <= today && minHoursFor(d, hc, hs) !== null).every((d) => daySent(empId, d))) return true;
  return [...new Set(wd.map(ymOf))].every((ym) => dbTs(empId, ym)?.weeks?.[monday]);
};

/* ---------- storage helpers ---------- */
export const STORAGE_OK = typeof window !== "undefined" && !!window.storage;
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export let LAST_STORAGE_ERROR = "";
export const errText = (e) => {
  if (!e) return "không rõ";
  if (typeof e === "string") return e;
  return e.message || e.name || JSON.stringify(e).slice(0, 200) || String(e);
};

/* ------------------------------------------------------------------
   TẦNG LƯU TRỮ
   Mỗi lệnh get/set là một message tới trình duyệt và có hạn mức cho cả phiên.
   Chạm hạn thì MỌI lệnh sau đều hỏng cho tới khi tải lại trang — thử lại chỉ tốn thêm quota.
   Nên ở đây: đệm mọi thứ đã đọc/ghi trong bộ nhớ, không lệnh nào gọi hai lần,
   và khi chạm hạn thì dừng gọi luôn để báo cho người dùng biết đường tải lại.
   ------------------------------------------------------------------ */
export const memCache = new Map();     // 'chung|riêng' + khoá -> giá trị đã parse
export let CALL_COUNT = 0;
export let RATE_LIMITED = false;
export const storageListeners = new Set();
export const notifyStorage = () => storageListeners.forEach((f) => f());
export const isRateLimit = (msg) => /rate limit/i.test(msg || "");
/* "Unexpected response type" là cách API này báo KHOÁ CHƯA TỒN TẠI — chuyện hoàn toàn
   bình thường ở lần chạy đầu. Đừng coi là hỏng kết nối: làm vậy app sẽ tự khoá chính nó
   ngay lần đọc đầu tiên khi chưa có dữ liệu. */
export const isMissingKey = (msg) => /unexpected response type|not found|no such key/i.test(msg || "");
/* Chỉ hạn mức phiên mới là lỗi không cứu được, buộc phải tải lại trang. */
export const markError = (e) => {
  LAST_STORAGE_ERROR = errText(e);
  if (isRateLimit(LAST_STORAGE_ERROR) && !RATE_LIMITED) { RATE_LIMITED = true; notifyStorage(); }
};
/* v2.2 — Trạng thái mạng. Lệnh tới server hỏng vì mạng thì báo "Mất kết nối"; lệnh nào thành công thì báo có mạng lại.
   Màn chấm công nghe sự kiện này để tự gửi lại phần đang chờ. */
export let NET_OK = true;
export const netListeners = new Set();
export const setNet = (ok) => { if (ok === NET_OK) return; NET_OK = ok; netListeners.forEach((f) => f(ok)); };
export const isNetErr = (msg) => /failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout|quá hạn chờ|err_internet|err_network|\b50[234]\b/i.test(msg || "");
export const useNet = () => {
  const [ok, setOk] = useState(NET_OK);
  useEffect(() => { const f = (v) => setOk(v); netListeners.add(f); return () => { netListeners.delete(f); }; }, []);
  return ok;
};
if (typeof window !== "undefined") window.addEventListener("offline", () => setNet(false));
export const ck = (k, shared) => `${shared ? "s" : "p"}|${k}`;
// cờ bật/tắt: dữ liệu cũ lưu chuỗi "1", dữ liệu mới lưu số 1 — chấp nhận cả hai
export const isOn = (v) => v === 1 || v === true || v === "1";

/* Hàng đợi: mọi lệnh storage xếp hàng chạy lần lượt, cách nhau một nhịp ngắn.
   Gọi song song (Promise.all, chunked) làm cầu nối giữa app và trình duyệt ghép nhầm
   phản hồi của lệnh này cho lệnh kia — đó là lỗi "Unexpected response type".
   Nối đuôi thì chậm hơn chút nhưng phản hồi luôn khớp với lệnh đã gửi. */
export let queue = Promise.resolve();
export const enqueue = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.then(() => delay(60), () => delay(60));
  return run;
};

export const isTimeout = (msg) => /timeout|quá hạn chờ/i.test(msg || "");
/* Cùng một thông điệp lỗi mang ý nghĩa khác nhau tuỳ lệnh:
   - với GET, "unexpected response type" nghĩa là khoá chưa tồn tại -> thử lại vô nghĩa
   - với SET/DELETE/LIST thì không thể là "khoá chưa có", nên đó là lỗi tạm thời -> phải thử lại
   Bản trước gộp chung một quy tắc nên mọi lệnh ghi hỏng đều không được thử lại lần nào. */
export const isRetryable = (msg, kind) => {
  if (isRateLimit(msg)) return false;
  if (kind === "get" && isMissingKey(msg)) return false;
  return true;
};

export const CALL_TIMEOUT = 8000;
/* Lệnh storage có thể treo vô hạn khi cầu nối hỏng. Không đặt hạn chờ thì app đứng
   mãi ở màn hình "Đang tải dữ liệu…" và trình xem báo tải quá lâu. */
export const withTimeout = (promise, ms = CALL_TIMEOUT) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("Storage timeout: quá hạn chờ")), ms);
  promise.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
});

/* Một lần gọi storage: xếp hàng, có hạn chờ, thử lại khi lỗi có vẻ tạm thời.
   Lệnh ghi được thử nhiều lần hơn vì mất một lần ghi là mất dữ liệu người dùng vừa nhập. */
export const call = async (fn, kind = "get", ms = CALL_TIMEOUT) => {
  const tries = kind === "get" ? 2 : 4;
  const waits = [300, 800, 1600];
  for (let i = 0; i < tries; i++) {
    try {
      const value = await enqueue(() => withTimeout(Promise.resolve().then(fn), ms));
      setNet(true);
      return { ok: true, value };
    } catch (e) {
      markError(e);
      if (i < tries - 1 && isRetryable(errText(e), kind)) { await delay(waits[i]); continue; }
      if (isNetErr(errText(e))) setNet(false);
      return { ok: false, error: e };
    }
  }
};

export const useStorageHealth = () => {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    storageListeners.add(f);
    return () => { storageListeners.delete(f); };
  }, []);
  return { limited: RATE_LIMITED, calls: CALL_COUNT, lastError: LAST_STORAGE_ERROR };
};

export const sget = async (k, shared = true, fresh = false) => {
  const key = ck(k, shared);
  if (!fresh && memCache.has(key)) return memCache.get(key);
  if (!STORAGE_OK || RATE_LIMITED) return null;
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.get(k, shared), "get");
  if (!r.ok) {
    // khoá chưa tồn tại là bình thường: nhớ vào đệm để khỏi hỏi lại, và KHÔNG coi là hỏng
    if (isMissingKey(errText(r.error))) { memCache.set(key, null); LAST_STORAGE_ERROR = ""; }
    return null;
  }
  const v = r.value ? JSON.parse(r.value.value) : null;
  memCache.set(key, v);
  return v;
};

export const sset = async (k, v, shared = true) => {
  if (!STORAGE_OK) { LAST_STORAGE_ERROR = "window.storage không tồn tại"; return false; }
  if (RATE_LIMITED) { LAST_STORAGE_ERROR = "Đã chạm hạn mức lệnh của phiên"; return false; }
  const payload = JSON.stringify(v);
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.set(k, payload, shared), "set");
  if (!r.ok) return false;
  if (!r.value) { LAST_STORAGE_ERROR = "storage.set trả về giá trị rỗng"; return false; }
  memCache.set(ck(k, shared), v);  // ghi xong cập nhật đệm, các lần đọc sau không tốn lệnh
  return true;
};

export const sdel = async (k, shared = true) => {
  if (!STORAGE_OK || RATE_LIMITED) return false;
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.delete(k, shared), "delete");
  if (!r.ok) return false;
  memCache.set(ck(k, shared), null);
  return true;
};

export const slist = async (prefix, shared = true) => {
  if (!STORAGE_OK || RATE_LIMITED) return [];
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.list(prefix, shared), "list");
  return r.ok && r.value ? r.value.keys : [];
};
