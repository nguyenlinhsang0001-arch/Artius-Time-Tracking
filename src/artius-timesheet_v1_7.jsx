import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend, ReferenceArea,
  ComposedChart, Line, LabelList,
} from "recharts";
import {
  Clock, Users, FolderKanban, LayoutDashboard, Download, Plus, Trash2, Save,
  AlertTriangle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, LogOut, Settings,
  CheckCircle2, Loader2, ListChecks, Lock, RotateCcw, Pencil, Check, X, CalendarDays,
  Copy, Unlock, Search, Flag, Zap, ClipboardList, MoreHorizontal, Grid3x3, User, Eye, EyeOff,
} from "lucide-react";
import { currentUser, signIn as authSignIn, signOut as authSignOut, accountsApi, normUsername, USERNAME_RE, PASSWORD_MIN } from "./auth.js";

/* ============================================================
   ARTIUS — Quản lý giờ công theo dự án · v1.7
   Dark theme thống nhất · responsive desktop + mobile
   Storage: window.storage (shared = true)
     artius:config:v1            -> { employees, projects, tasks, adminPin, deadlineDay, hours, holidays }
     artius:db:v1 -> { config, ts: { '<empId>:<YYYY-MM>': { rows, weeks } } }   (một khoá duy nhất)

   Mới ở v1.7 (chỉ chạy ở bản webapp Vercel + Supabase, không còn chạy trong artifact)
   · Đăng nhập bằng tên đăng nhập + mật khẩu (Supabase Auth). Bỏ màn chọn tên và mã PIN quản lý
   · Ban quản lý tạo tài khoản, đặt / xem / đặt lại mật khẩu, khoá tài khoản ngay ở tab Nhân sự
   · Quyền quản lý là một thuộc tính của tài khoản
   · Dữ liệu chỉ được tải SAU khi đăng nhập. Tải hỏng thì dừng ở màn báo lỗi, không vào app
     với dữ liệu rỗng (tránh ghi đè dữ liệu thật)

   Cập nhật 09/10/2026 (vẫn là v1.7) — tab Nhân sự
   · Chia 2 tab con: Nhân sự | Tài khoản quản lý
   · Một bảng duy nhất gom theo phòng ban, có ô tìm, lọc theo phòng ban và trạng thái tài khoản;
     "Dự án đang tham gia" là một cột (bỏ bảng theo dõi riêng)
   · Thêm / sửa qua khung nhập: tên đăng nhập tự gợi ý theo họ tên, mật khẩu sinh sẵn,
     vai trò lọc theo phòng ban, có "Lưu và thêm tiếp"
   · Mỗi dòng có nút chép tài khoản; nút Xuất tài khoản ra Excel theo bộ lọc đang chọn

   Cập nhật 09/10/2026 (vẫn là v1.7) — tab Tác vụ
   · Chia 3 tab con: Tác vụ | Phòng ban & vai trò | Vắng mặt
   · Tab Tác vụ: cột trái là vai trò gom theo phòng ban (có ô tìm và số tác vụ), cột phải là tác vụ của vai trò đang chọn
   · Phòng ban và vai trò: bấm vào để sửa tên tại chỗ, chỉ còn nút thùng rác
   · Vai trò: bấm đúp vào mã để sửa mã (nhân sự và tác vụ đang dùng mã cũ đổi theo); kéo thả sang dòng phòng ban khác để chuyển phòng ban

   Mới ở v1.5
   · Ghi chú phiên bản ở góc trái, dưới cùng màn hình
   · Tab Tác vụ (ban quản lý): thêm mới / xoá vai trò. Danh sách vai trò nằm trong cấu hình dùng chung
   · Bỏ nút "Nạp bộ tác vụ theo vai trò" (bộ 25 tác vụ chuẩn)
   · Tab Tác vụ chỉ còn ô vai trò, ô dùng chung và danh sách tác vụ; bỏ các dòng ghi chú nhỏ
   · Bỏ tác vụ theo bộ phận: tác vụ chỉ gắn vai trò hoặc dùng chung. Tác vụ cấp bộ phận có sẵn
     trong dữ liệu bị xoá khi nạp. Xoá một vai trò thì xoá luôn tác vụ của vai trò đó

   Mới ở v1.4
   · Toàn bộ dữ liệu nằm trong MỘT khoá lưu trữ. Đọc 1 lần lúc mở app, sau đó mọi thao tác
     chạy trong bộ nhớ. Quản lý xem dashboard 20 nhân sự: 64 lệnh -> 3 lệnh.
   · Mọi lệnh lưu trữ có hạn chờ 8 giây, hết hạn thì đi tiếp thay vì treo app
   · Khởi động luôn kết thúc kể cả khi lưu trữ hỏng
   · Sao lưu / khôi phục toàn bộ dữ liệu ra file JSON
   · Tự nhận biết mất kết nối lưu trữ và dừng gọi, kèm nút tải lại trang

   Mới ở v1.3
   · Khoá tổng hợp theo tháng: Dashboard đọc 1 lệnh/tháng thay vì 1 lệnh/nhân sự/tháng
   · Vắng mặt chọn thẳng trong ô Tác vụ (Phép năm, nghỉ ốm, không lương, nghỉ lễ, công tác ngoài)
   · Ghi chú mở bằng nút "…" thay vì chiếm một cột trong bảng
   · Mũi tên/Enter di chuyển giữa các ô giờ · Điền giờ chuẩn cả tuần · Hoàn tác xoá dòng
   · Cảnh báo khi rời bảng công lúc chưa lưu
   · Hạn mức giờ cho dự án + panel cảnh báo vượt giờ
   · Tra cứu bằng Map thay cho .find() trong vòng lặp

   Mới ở v1.2
   · Tab "Bảng công" cho quản lý: chọn nhân sự, xem và sửa trực tiếp, đánh dấu / gỡ đánh dấu đã gửi
   · Giờ chuẩn cấu hình được theo T2–T6 / T7 / CN + ngưỡng cảnh báo vượt giờ mỗi ngày
   · Thanh tiến độ so với target tuần (chấm công) và target kỳ (dashboard cá nhân)
   · Ngày lễ khai báo ở Thiết lập — miễn cảnh báo thiếu giờ, giờ chấm vào đó tính hết là OT
   · Nghỉ phép theo ngày: phép năm, phép nửa ngày, nghỉ ốm, không lương, công tác ngoài
   · OT tự tính (vượt giờ chuẩn + ngày lễ/ngày nghỉ), hiện trên cả 2 dashboard và file Excel

   Mới ở v1.1
   · Ghi chú theo từng dòng chấm công · Chép cơ cấu dòng của tuần trước
   · Khoá tuần đã gửi · Tự lưu khi chuyển tuần · Xác nhận trước khi xoá
   · Dashboard quản lý: lọc bộ phận / dự án / tên + biểu đồ theo hạng mục
   ============================================================ */

const APP_VERSION = "v1.7";
const CONFIG_KEY = "artius:config:v1";
const TS_PREFIX = "artius:ts:";
const tsKey = (empId, ym) => `${TS_PREFIX}${empId}:${ym}`;
/* ------------------------------------------------------------------
   MỘT KHOÁ DUY NHẤT CHO TOÀN BỘ DỮ LIỆU
   Môi trường này giới hạn số lệnh lưu trữ mỗi phiên và có lúc đứt kết nối giữa chừng,
   nên cách chắc chắn nhất là gọi càng ít lệnh càng tốt. Toàn bộ cấu hình và bảng công
   nằm trong một khoá; app đọc 1 lần lúc mở, sau đó mọi thao tác chạy trong bộ nhớ.
   Cả phiên làm việc thường chỉ tốn: 1 lệnh đọc lúc mở + 2 lệnh cho mỗi lần bấm Lưu.
   ------------------------------------------------------------------ */
const DB_KEY = "artius:db:v1";
let DB = null;            // { v, config, ts: { "<empId>:<ym>": bucket } }
let DB_LOADED = false;
const DB_LIMIT = 4_000_000; // ngưỡng cảnh báo, dưới hạn 5MB của một khoá

const slot = (empId, ym) => `${empId}:${ym}`;
const emptyDB = () => ({ v: 1, config: emptyConfig(), ts: {} });

/* Bản cũ lưu rải rác nhiều khoá. Gộp lại một lần rồi thôi — đây là lần duy nhất tốn nhiều lệnh. */
const migrateDB = async () => {
  const db = emptyDB();
  const cfg = await sget(CONFIG_KEY);
  if (cfg) db.config = cfg;
  for (const k of await slist(TS_PREFIX)) {
    const v = await sget(k);
    if (v) db.ts[k.slice(TS_PREFIX.length)] = v;
  }
  return db;
};

const loadDB = async (force = false) => {
  if (DB_LOADED && !force) return DB;
  const stored = await sget(DB_KEY, true, force);
  if (stored?.ts) { DB = stored; }
  else {
    /* v1.7: chỉ khởi tạo dữ liệu mới khi server XÁC NHẬN khoá chưa tồn tại. Nếu lần đọc hỏng
       (mất mạng, phiên hết hạn) mà vẫn ghi bản rỗng thì sẽ đè mất toàn bộ dữ liệu thật. */
    const cacheKey = ck(DB_KEY, true);
    const confirmedMissing = memCache.has(cacheKey) && memCache.get(cacheKey) === null;
    if (!confirmedMissing) throw new Error("Không đọc được dữ liệu");
    const fresh = await migrateDB();
    if (!(await sset(DB_KEY, fresh))) throw new Error("Không khởi tạo được dữ liệu");
    DB = fresh;
  }
  DB_LOADED = true;
  return DB;
};
/* Đăng xuất: bỏ hết dữ liệu đang giữ trong bộ nhớ để người đăng nhập sau tải lại từ đầu */
const resetDB = () => { DB = null; DB_LOADED = false; memCache.clear(); LAST_STORAGE_ERROR = ""; };

/* Ghi: cập nhật bộ nhớ trước để giao diện phản hồi ngay, rồi đọc lại bản mới nhất
   và áp đúng thay đổi đó lên trên — hạn chế đè mất phần người khác vừa lưu. */
const commitDB = async (apply, merge = true) => {
  if (!DB) DB = emptyDB();
  apply(DB);
  if (!STORAGE_OK || RATE_LIMITED) return false;
  // merge=false: bỏ bước đọc lại, tiết kiệm 1 lệnh cho các lần lưu nháp thường xuyên
  if (merge) {
    const fresh = (await sget(DB_KEY, true, true)) || DB;
    apply(fresh);
    DB = fresh;
  }
  return sset(DB_KEY, DB);
};

const dbTs = (empId, ym) => DB?.ts?.[slot(empId, ym)] || null;
const dbSize = () => { try { return JSON.stringify(DB || {}).length; } catch { return 0; } };

/* ---------- date helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x;
};
const ymOf = (s) => s.slice(0, 7);
const prevYm = (ym) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
const ymLabel = (ym) => { const [y, m] = ym.split("-"); return `Tháng ${Number(m)}/${y}`; };
const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DOW_MINI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const dLabel = (s) => { const d = parseD(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
/* Bộ tra cứu ngày lễ. Ngày lễ dương lịch cố định (01/01, 30/04, 02/09…) đánh dấu lặp hàng năm
   thì chỉ khai báo một lần, năm nào cũng nhận. Ngày lễ âm lịch (Tết, Giỗ Tổ) đổi ngày mỗi năm
   nên vẫn khai từng năm một.
   Trả về đối tượng có has()/get() giống Map để mọi nơi đang dùng không phải sửa. */
const makeHolidayIndex = (list = []) => {
  const exact = new Map();   // 'YYYY-MM-DD' -> tên
  const yearly = new Map();  // 'MM-DD'      -> tên
  for (const h of list) {
    if (!h?.date) continue;
    const name = h.name || "Ngày lễ";
    if (h.yearly) yearly.set(h.date.slice(5), name); else exact.set(h.date, name);
  }
  return {
    get: (s) => (s ? exact.get(s) || yearly.get(s.slice(5)) || null : null),
    has: (s) => (s ? exact.has(s) || yearly.has(s.slice(5)) : false),
    size: exact.size + yearly.size,
  };
};

// Lễ dương lịch cố định của Việt Nam — thêm nhanh, khỏi gõ tay từng cái
const VN_FIXED_HOLIDAYS = [
  { md: "01-01", name: "Tết Dương lịch" },
  { md: "04-30", name: "Ngày Giải phóng miền Nam" },
  { md: "05-01", name: "Quốc tế Lao động" },
  { md: "09-02", name: "Quốc khánh" },
];
const DEFAULT_HOURS = { weekday: 8, sat: 4, sun: 0, satOt: 8, maxDaily: 12 };
const OT_ALERT = 3.5; // OT một ngày vượt mốc này thì chuyển đỏ cảnh báo thay vì xanh

/* Ngày lễ được khoanh bằng một vòng cọ đỏ vẽ tay — nét không khép kín, hai đầu vuốt lệch,
   độ dày thay đổi để ra cảm giác nét bút thật thay vì hình tròn máy. Nhúng data-URI, không tải ngoài. */
const HOLIDAY_RING_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
  '<g fill="none" stroke="#ef4444" stroke-linecap="round">' +
  // vòng tròn chính, hở góc trên phải như nét cọ quẹt nhanh
  '<path d="M31 5.5C16 1.5 4.5 11 4 24c-.5 13 9.5 22.5 22 22.5 12 0 21.5-10 20.5-23C45.7 12.5 39 8 31 5.5" stroke-width="2.6" opacity=".92"/>' +
  // lớp mực mảnh chồng lệch
  '<path d="M33 8.5C19 4.5 7.5 13.5 7 25.5c-.5 12.5 9 21 21 21 11.5 0 20-9.5 19-21.5" stroke-width="1.2" opacity=".5"/>' +
  // đuôi vuốt quá đà chỗ khép vòng
  '<path d="M31 5.5c4.2.6 8 2.6 11.5 6.5" stroke-width="2.1" opacity=".8"/></g></svg>'
);

const holidayRingBg = (size = 34) => ({
  backgroundImage: `url("data:image/svg+xml,${HOLIDAY_RING_SVG}")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  backgroundSize: `${size}px ${size}px`,
});
const stdHoursFor = (s, h = DEFAULT_HOURS) => {
  const wd = (parseD(s).getDay() + 6) % 7; // 0=T2 ... 5=T7, 6=CN
  if (wd === 6) return Number(h.sun) || 0;
  if (wd === 5) return Number(h.sat) || 0;
  return Number(h.weekday) || 0;
};
const minHoursFor = (s, h = DEFAULT_HOURS, holidaySet = null) => {
  if (holidaySet?.has(s)) return null;
  const std = stdHoursFor(s, h);
  return std > 0 ? std : null;
};
/* Ngưỡng bắt đầu tính OT của một ngày — cố ý tách khỏi giờ chuẩn.
   T7 giờ chuẩn 4h nhưng chỉ vượt 8h mới tính OT, tức 4 giờ thứ 5 đến thứ 8 của T7
   vẫn là giờ thường. Ngày mà cấu hình cho nghỉ hẳn (giờ chuẩn 0) thì làm bao nhiêu OT bấy nhiêu. */
const otThresholdFor = (s, h = DEFAULT_HOURS) => {
  const std = stdHoursFor(s, h);
  if (std <= 0) return 0;
  const wd = (parseD(s).getDay() + 6) % 7; // 0=T2 ... 5=T7, 6=CN
  if (wd === 5) return Math.max(std, Number(h.satOt) || 8);
  return std;
};
// Giờ OT của một ngày: ngày lễ, chủ nhật hoặc ngày nghỉ tính toàn bộ; còn lại tính phần vượt ngưỡng
const otHoursFor = (s, total, h = DEFAULT_HOURS, holidaySet = null) => {
  if (!total) return 0;
  if (holidaySet?.has(s)) return total;
  const th = otThresholdFor(s, h);
  return th <= 0 ? total : Math.max(0, total - th);
};
const weeklyTarget = (h = DEFAULT_HOURS) => (Number(h.weekday) || 0) * 5 + (Number(h.sat) || 0) + (Number(h.sun) || 0);
const dFull = (s) => { const d = parseD(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const lastOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const mondaysOfMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1), last = new Date(y, m, 0);
  const out = []; let cur = mondayOf(first);
  while (cur <= last) { out.push(fmt(cur)); cur = addDays(cur, 7); }
  return out;
};
const weekDays = (mondayStr) => {
  const m = parseD(mondayStr);
  return Array.from({ length: 7 }, (_, i) => fmt(addDays(m, i)));
};
// các tháng (YYYY-MM) mà khoảng [from, to] chạm tới
const ymsBetween = (from, to) => {
  const a = parseD(from), b = parseD(to);
  const out = []; let y = a.getFullYear(), m = a.getMonth();
  while (y * 12 + m <= b.getFullYear() * 12 + b.getMonth()) {
    out.push(`${y}-${pad(m + 1)}`); m++; if (m > 11) { m = 0; y++; }
  }
  return out;
};

/* ---------- storage helpers ---------- */
const STORAGE_OK = typeof window !== "undefined" && !!window.storage;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let LAST_STORAGE_ERROR = "";
const errText = (e) => {
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
const memCache = new Map();     // 'chung|riêng' + khoá -> giá trị đã parse
let CALL_COUNT = 0;
let RATE_LIMITED = false;
const storageListeners = new Set();
const notifyStorage = () => storageListeners.forEach((f) => f());
const isRateLimit = (msg) => /rate limit/i.test(msg || "");
/* "Unexpected response type" là cách API này báo KHOÁ CHƯA TỒN TẠI — chuyện hoàn toàn
   bình thường ở lần chạy đầu. Đừng coi là hỏng kết nối: làm vậy app sẽ tự khoá chính nó
   ngay lần đọc đầu tiên khi chưa có dữ liệu. */
const isMissingKey = (msg) => /unexpected response type|not found|no such key/i.test(msg || "");
/* Chỉ hạn mức phiên mới là lỗi không cứu được, buộc phải tải lại trang. */
const markError = (e) => {
  LAST_STORAGE_ERROR = errText(e);
  if (isRateLimit(LAST_STORAGE_ERROR) && !RATE_LIMITED) { RATE_LIMITED = true; notifyStorage(); }
};
const ck = (k, shared) => `${shared ? "s" : "p"}|${k}`;
// cờ bật/tắt: dữ liệu cũ lưu chuỗi "1", dữ liệu mới lưu số 1 — chấp nhận cả hai
const isOn = (v) => v === 1 || v === true || v === "1";

/* Hàng đợi: mọi lệnh storage xếp hàng chạy lần lượt, cách nhau một nhịp ngắn.
   Gọi song song (Promise.all, chunked) làm cầu nối giữa app và trình duyệt ghép nhầm
   phản hồi của lệnh này cho lệnh kia — đó là lỗi "Unexpected response type".
   Nối đuôi thì chậm hơn chút nhưng phản hồi luôn khớp với lệnh đã gửi. */
let queue = Promise.resolve();
const enqueue = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.then(() => delay(60), () => delay(60));
  return run;
};

const isTimeout = (msg) => /timeout|quá hạn chờ/i.test(msg || "");
/* Cùng một thông điệp lỗi mang ý nghĩa khác nhau tuỳ lệnh:
   - với GET, "unexpected response type" nghĩa là khoá chưa tồn tại -> thử lại vô nghĩa
   - với SET/DELETE/LIST thì không thể là "khoá chưa có", nên đó là lỗi tạm thời -> phải thử lại
   Bản trước gộp chung một quy tắc nên mọi lệnh ghi hỏng đều không được thử lại lần nào. */
const isRetryable = (msg, kind) => {
  if (isRateLimit(msg)) return false;
  if (kind === "get" && isMissingKey(msg)) return false;
  return true;
};

const CALL_TIMEOUT = 8000;
/* Lệnh storage có thể treo vô hạn khi cầu nối hỏng. Không đặt hạn chờ thì app đứng
   mãi ở màn hình "Đang tải dữ liệu…" và trình xem báo tải quá lâu. */
const withTimeout = (promise, ms = CALL_TIMEOUT) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("Storage timeout: quá hạn chờ")), ms);
  promise.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
});

/* Một lần gọi storage: xếp hàng, có hạn chờ, thử lại khi lỗi có vẻ tạm thời.
   Lệnh ghi được thử nhiều lần hơn vì mất một lần ghi là mất dữ liệu người dùng vừa nhập. */
const call = async (fn, kind = "get") => {
  const tries = kind === "get" ? 2 : 4;
  const waits = [300, 800, 1600];
  for (let i = 0; i < tries; i++) {
    try {
      return { ok: true, value: await enqueue(() => withTimeout(Promise.resolve().then(fn))) };
    } catch (e) {
      markError(e);
      if (i < tries - 1 && isRetryable(errText(e), kind)) { await delay(waits[i]); continue; }
      return { ok: false, error: e };
    }
  }
};

const useStorageHealth = () => {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    storageListeners.add(f);
    return () => { storageListeners.delete(f); };
  }, []);
  return { limited: RATE_LIMITED, calls: CALL_COUNT, lastError: LAST_STORAGE_ERROR };
};

const sget = async (k, shared = true, fresh = false) => {
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

const sset = async (k, v, shared = true) => {
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

const sdel = async (k, shared = true) => {
  if (!STORAGE_OK || RATE_LIMITED) return false;
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.delete(k, shared), "delete");
  if (!r.ok) return false;
  memCache.set(ck(k, shared), null);
  return true;
};

const slist = async (prefix, shared = true) => {
  if (!STORAGE_OK || RATE_LIMITED) return [];
  CALL_COUNT++; notifyStorage();
  const r = await call(() => window.storage.list(prefix, shared), "list");
  return r.ok && r.value ? r.value.keys : [];
};
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const f = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
};

/* ---------- catalog mặc định ---------- */
const DEFAULT_TASKS = [
  { id: "t17", name: "Họp & trình bày khách hàng", group: "Chung", depts: [] },
  { id: "t18", name: "Nghiệm thu / bàn giao", group: "Chung", depts: [] },
  { id: "t19", name: "Chỉnh sửa theo yêu cầu (revision)", group: "Chung", depts: [] },
];
const DEFAULT_DEPTS = ["Thiết kế", "Thi công", "Xưởng", "BOQ", "HR / Back office", "Ban giám đốc"];
/* DEPTS là bản sống: App chép cfg.depts vào đây ở mỗi lần render (syncDepts).
   "Ban giám đốc" (DEPTS_SEE_ALL) luôn có mặt và cố định vì quyết định quyền xem toàn bộ tác vụ. */
const DEPTS = [...DEFAULT_DEPTS];
const syncDepts = (list) => {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_DEPTS;
  DEPTS.splice(0, DEPTS.length, ...src);
};
// Bộ phận thấy được toàn bộ hạng mục, không giới hạn theo chuyên môn
const DEPTS_SEE_ALL = ["Ban giám đốc"];

/* Vai trò — cấp nhỏ hơn bộ phận. Trong bộ phận Thiết kế, mỗi người làm một mảng chuyên môn
   nên danh sách tác vụ phải theo vai trò, không thể dùng chung một danh sách cho cả phòng. */
const DEFAULT_ROLES = [
  { id: "ARC", name: "Kiến trúc", dept: "Thiết kế" },
  { id: "ID", name: "Nội thất", dept: "Thiết kế" },
  { id: "3D", name: "Diễn hoạ 3D", dept: "Thiết kế" },
  { id: "2D", name: "Triển khai bản vẽ", dept: "Thiết kế" },
  { id: "TL", name: "Team Leader", dept: "Thiết kế" },
];
/* ROLES là bản sống: App chép cfg.roles vào đây ở mỗi lần render (syncRoles) để các hàm tra cứu
   toàn cục như roleInfo / roleLabel và mọi ô chọn vai trò luôn thấy đúng danh sách quản lý đã sửa. */
const ROLES = DEFAULT_ROLES.map((r) => ({ ...r }));
const syncRoles = (list) => {
  const src = Array.isArray(list) ? list : DEFAULT_ROLES;
  ROLES.splice(0, ROLES.length, ...src);
};
const roleInfo = (id) => ROLES.find((r) => r.id === id) || null;
const roleLabel = (id) => { const r = roleInfo(id); return r ? `${r.id} · ${r.name}` : ""; };

/* Hạng mục cũ chưa khai bộ phận thì suy từ nhóm, để dữ liệu có sẵn vẫn dùng được ngay.
   depts rỗng nghĩa là hạng mục dùng chung — mọi bộ phận đều chọn được. */
const GROUP_DEPTS = { "Thiết kế": ["Thiết kế"], "Xưởng": ["Xưởng"], "Thi công": ["Thi công"], "BOQ": ["BOQ"] };
const taskDepts = (t) => {
  if (Array.isArray(t.depts)) return t.depts;
  return GROUP_DEPTS[t.group] || [];
};
const taskRoles = (t) => (Array.isArray(t.roles) ? t.roles : []);
/* Từ v1.5 không còn tác vụ cấp bộ phận: tác vụ hoặc gắn vai trò, hoặc dùng chung. */
const isDeptTask = (t) => taskRoles(t).length === 0 && taskDepts(t).length > 0;
/* Thứ tự xét: tác vụ gắn vai trò thì chỉ đúng vai trò đó thấy; không gắn vai trò là tác vụ dùng chung, ai cũng thấy. */
const taskVisibleTo = (t, dept, role) => {
  if (!dept || DEPTS_SEE_ALL.includes(dept)) return true;
  const rs = taskRoles(t);
  if (rs.length) return !!role && rs.includes(role);
  return true;
};
const tasksForDept = (tasks = [], dept, role) => tasks.filter((t) => taskVisibleTo(t, dept, role));
// nhãn hiển thị: có mã thì đưa mã lên trước cho dễ đối chiếu với bảng vai trò
const taskText = (t) => (t?.code ? `${t.code} · ${t.name}` : t?.name || "");
// Bỏ dấu để gõ "khao sat" vẫn ra "Khảo sát". NFD không tách được đ nên phải thay tay.
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
// bảng màu lặp lại theo thứ tự dự án, dùng cho biểu đồ cột chồng theo dự án
const PROJECT_COLORS = ["#2dd4bf", "#f59e0b", "#a78bfa", "#f472b6", "#60a5fa", "#facc15", "#34d399", "#fb7185", "#38bdf8", "#c084fc"];
/* Giai đoạn dự án — cho biết giờ công đổ vào chặng nào, tách bạch với "hạng mục công việc"
   (hạng mục nói làm việc gì, giai đoạn nói việc đó thuộc chặng nào của dự án) */
const PHASES = [
  { id: "P1", name: "Đấu thầu", desc: "Khảo sát sơ bộ, nghiên cứu, concept đấu thầu, báo giá, hồ sơ proposal", cls: "border-amber-800 bg-amber-950 text-amber-300", color: "#f59e0b" },
  { id: "P2", name: "Thiết kế", desc: "Concept, phát triển thiết kế, 3D, hồ sơ kỹ thuật, phối hợp thiết kế", cls: "border-teal-800 bg-teal-950 text-teal-300", color: "#2dd4bf" },
  { id: "P3", name: "Thi công", desc: "Shopdrawing, RFI, material, xử lý hiện trường, điều chỉnh thiết kế", cls: "border-sky-800 bg-sky-950 text-sky-300", color: "#38bdf8" },
  { id: "P4", name: "Bàn giao", desc: "As-built, snagging, hoàn thiện hồ sơ, nghiệm thu, lưu trữ", cls: "border-violet-800 bg-violet-950 text-violet-300", color: "#a78bfa" },
];
const DEFAULT_PHASE = "P2";
const phaseInfo = (id) => PHASES.find((p) => p.id === id) || null;
const phaseLabel = (id) => { const p = phaseInfo(id); return p ? `${p.id} · ${p.name}` : "(chưa gán)"; };
// Đoán giai đoạn từ nhóm của hạng mục — dùng khi thêm dòng mới và khi nâng cấp dữ liệu cũ chưa có giai đoạn
const guessPhase = (taskId, tasks = []) => {
  const g = tasks.find((t) => t.id === taskId)?.group || "";
  if (/xưởng|thi công/i.test(g)) return "P3";
  if (/thiết kế/i.test(g)) return "P2";
  return DEFAULT_PHASE;
};
// Khoá định danh một dòng chấm công: cùng dự án nhưng khác giai đoạn thì vẫn là hai dòng riêng
const rowKey = (r) => `${r.projectId}|${r.phaseId || DEFAULT_PHASE}|${r.taskId}`;
// Khoá nhóm: cùng dự án + giai đoạn thì gộp chung một khối, chỉ hạng mục mới tách dòng bên trong
const groupKey = (r) => `${r.projectId}|${r.phaseId || DEFAULT_PHASE}`;
/* Xếp lại mảng rows cho thứ tự phần tử khớp thứ tự hiển thị. Bắt buộc phải làm, vì ref ô nhập giờ
   và phím mũi tên đều đánh theo chỉ số phẳng — lệch thứ tự là con trỏ nhảy lung tung. */
const sortByGroup = (list = []) => {
  const order = [];
  for (const r of list) { const k = groupKey(r); if (!order.includes(k)) order.push(k); }
  return [...list].sort((a, b) => order.indexOf(groupKey(a)) - order.indexOf(groupKey(b)));
};

const emptyConfig = () => ({
  employees: [], projects: [], tasks: DEFAULT_TASKS, adminPin: "", deadlineDay: 5,
  hours: { ...DEFAULT_HOURS }, holidays: [], roles: DEFAULT_ROLES.map((r) => ({ ...r })),
  leaveTypes: DEFAULT_LEAVE_TYPES.map((t) => ({ ...t })),
  depts: [...DEFAULT_DEPTS],
});

/* Vắng mặt giờ là tác vụ chọn được ngay trong ô Tác vụ, không còn panel riêng.
   Chọn "Phép năm" rồi nhập 8 giờ vào ngày đó là xong — giờ vắng tính vào giờ chuẩn của ngày
   nên không bị báo thiếu, nhưng KHÔNG tính vào giờ dự án và không tính OT. */
const DEFAULT_LEAVE_TYPES = [
  { id: "annual", label: "Phép năm", short: "P", cls: "border-sky-800 bg-sky-950 text-sky-300" },
  { id: "sick", label: "Nghỉ ốm", short: "Ố", cls: "border-violet-800 bg-violet-950 text-violet-300" },
  { id: "unpaid", label: "Nghỉ không lương", short: "KL", cls: "border-slate-700 bg-slate-800 text-slate-300" },
  { id: "public", label: "Nghỉ lễ", short: "L", cls: "border-rose-800 bg-rose-950 text-rose-300" },
  { id: "biz", label: "Công tác ngoài", short: "CT", cls: "border-teal-800 bg-teal-950 text-teal-300" },
];
const LEAVE_TASK_PREFIX = "LV_";
const NO_PROJECT = "__none__";
/* LEAVE_TYPES / LEAVE_TASKS là bản sống: App chép cfg.leaveTypes vào đây ở mỗi lần render (syncLeave),
   quản lý thêm / sửa / xoá loại nghỉ ở tab Tác vụ. */
const LEAVE_PALETTE = [
  "border-sky-800 bg-sky-950 text-sky-300", "border-violet-800 bg-violet-950 text-violet-300",
  "border-slate-700 bg-slate-800 text-slate-300", "border-rose-800 bg-rose-950 text-rose-300",
  "border-teal-800 bg-teal-950 text-teal-300", "border-amber-800 bg-amber-950 text-amber-300",
  "border-emerald-800 bg-emerald-950 text-emerald-300", "border-fuchsia-800 bg-fuchsia-950 text-fuchsia-300",
];
const leaveShort = (label) => {
  const w = String(label || "").trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w.slice(0, 2).map((x) => x[0]).join("") : (w[0] || "?").slice(0, 2)).toUpperCase();
};
const LEAVE_TYPES = DEFAULT_LEAVE_TYPES.map((t) => ({ ...t }));
const LEAVE_TASKS = [];
const syncLeave = (list) => {
  const src = Array.isArray(list) ? list : DEFAULT_LEAVE_TYPES;
  LEAVE_TYPES.splice(0, LEAVE_TYPES.length, ...src);
  LEAVE_TASKS.splice(0, LEAVE_TASKS.length, ...src.map((t) => ({ id: `${LEAVE_TASK_PREFIX}${t.id}`, name: t.label, group: "Vắng mặt", depts: [], roles: [] })));
};
syncLeave(null);
const isLeaveTask = (id) => typeof id === "string" && id.startsWith(LEAVE_TASK_PREFIX);
const leaveTypeOfTask = (id) => (isLeaveTask(id) ? id.slice(LEAVE_TASK_PREFIX.length) : null);
const leaveInfo = (id) => LEAVE_TYPES.find((x) => x.id === id) || null;
const leaveInfoOfTask = (taskId) => leaveInfo(leaveTypeOfTask(taskId));

/* ============================================================
   DESIGN TOKENS — mọi control dùng chung, chiều cao 44px (h-11)
   ============================================================ */
const CTRL = "h-11";
const inputCls = `${CTRL} w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none`;
const selectCls = inputCls;
const btnBase = `${CTRL} inline-flex items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium`;
const btnPrimary = `${btnBase} bg-teal-600 text-white hover:bg-teal-500`;
const btnGhost = `${btnBase} border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white`;
const btnDanger = `${btnBase} border border-rose-900 bg-rose-950 text-rose-300 hover:bg-rose-900`;
const iconBtn = "flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100";
const GUT = 36; // bằng đúng bề rộng iconBtn — giữ ô Dự án và ô Hạng mục thẳng hàng nhau

const Panel = ({ title, right, children }) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900">
    {title && (
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        {right}
      </div>
    )}
    <div className="p-3 md:p-4">{children}</div>
  </section>
);
const Kpi = ({ label, value, unit }) => (
  <div className="h-full rounded-xl border border-slate-800 bg-slate-900 p-3 md:p-4">
    {/* tracking hẹp lại ở màn rộng: 6 ô cùng hàng nên nhãn dài dễ tràn */}
    <div className="text-[10px] uppercase tracking-wider text-slate-500 md:text-[11px]">{label}</div>
    <div className="mt-1.5 truncate font-mono text-2xl font-semibold text-slate-50 md:text-[26px]">
      {value}{unit && <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>}
    </div>
  </div>
);

/* Hộp thoại xác nhận — dùng cho mọi thao tác xoá không hoàn tác được.
   Không dùng window.confirm vì trình duyệt có thể chặn trong iframe và giao diện không đồng bộ theme. */
function ConfirmDialog({ open, title, desc, confirmLabel = "Xoá", onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-50">{title}</h4>
            {desc && <p className="mt-1 text-sm text-slate-400">{desc}</p>}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className={btnGhost}>Giữ lại</button>
          <button onClick={onConfirm} className={btnDanger}><Trash2 size={14} /> {confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DATE PICKER (dark, tự vẽ — không dùng picker mặc định của trình duyệt)
   ============================================================ */
function CalendarPanel({ value, onSelect, dayStatus, view: viewProp, onViewChange, markSelected = true, markWeek = false, rangeStart = null, rangeEnd = null, hint = null }) {
  const base = value ? parseD(value) : new Date();
  const [internalView, setInternalView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const view = viewProp || internalView;               // cho phép cha (WeekPicker) điều khiển tháng đang xem
  const setView = onViewChange || setInternalView;      // để tải đúng dữ liệu giờ công của tháng đang hiển thị
  const gridStart = mondayOf(new Date(view.y, view.m, 1));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayStr = fmt(new Date());
  const step = (n) => setView((v) => {
    const d = new Date(v.y, v.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div className="w-72 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-100">Tháng {view.m + 1}, {view.y}</span>
        <div className="flex gap-1">
          <button onClick={() => step(-1)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><ChevronUp size={16} /></button>
          <button onClick={() => step(1)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><ChevronDown size={16} /></button>
        </div>
      </div>

      {hint && <div className="mb-2 rounded-md bg-slate-950 px-2 py-1.5 text-[11px] text-slate-400">{hint}</div>}

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW_MINI.map((d) => <div key={d} className="py-1 text-[11px] font-medium text-slate-500">{d}</div>)}
      </div>

      {/* mỗi tuần một hàng riêng — tuần đang chấm công (Thứ 2 = value) được khoanh khung bo góc, viền mờ */}
      <div className="space-y-1">
        {Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7)).map((week, w) => {
          const isActiveWeek = markWeek && fmt(week[0]) === value; // chỉ khoanh cả tuần khi đang chọn theo tuần
          return (
            <div key={w}
              className={`grid grid-cols-7 gap-1 rounded-lg p-0.5 ${isActiveWeek ? "border border-teal-700/50 bg-teal-500/5" : "border border-transparent"}`}>
              {week.map((d) => {
                const s = fmt(d);
                const inMonth = d.getMonth() === view.m;
                const selected = s === value;
                const isToday = s === todayStr;
                const status = dayStatus ? dayStatus(s) : null; // "under" | "over" | "otHigh" | "holiday" | "leave" | null
                const isSelected = markSelected && selected;
                const isEdge = (rangeStart && s === rangeStart) || (rangeEnd && s === rangeEnd);
                const inRange = rangeStart && rangeEnd && s > rangeStart && s < rangeEnd;
                // màu chữ nói lên loại ngày, viền nói lên "hôm nay" / "ngày đang chọn" — hai tầng thông tin tách bạch
                const tone =
                  status === "holiday" ? "text-slate-100"
                    : status === "leave" ? "bg-sky-950/40 text-sky-300"
                    : status === "under" ? "text-amber-400"
                    : status === "otHigh" ? "bg-red-950/50 font-semibold text-red-300"
                    : status === "over" ? "text-emerald-400"
                    : inMonth ? "text-slate-200" : "text-slate-700";
                const ring =
                  isEdge ? "border-2 border-teal-400 bg-teal-500/15 font-semibold text-teal-100"
                    : inRange ? "border border-transparent bg-teal-500/10 text-teal-100"
                    : isSelected ? "border-2 border-teal-400 font-semibold"
                    // hôm nay: khối phát sáng mờ, cùng tông với khung tuần bên Chấm công
                    : isToday ? (status ? "border border-teal-500 font-semibold" : "border border-teal-700/60 bg-teal-500/10 font-semibold text-teal-200")
                    : "border border-transparent";
                return (
                  <button key={s} onClick={() => onSelect(s)}
                    style={status === "holiday" ? holidayRingBg(30) : undefined}
                    title={isToday ? "Hôm nay" : status === "under" ? "Chưa đủ giờ" : status === "otHigh" ? `OT trên ${OT_ALERT} giờ` : status === "over" ? "Vượt giờ chuẩn" : status === "holiday" ? "Ngày lễ" : status === "leave" ? "Nghỉ phép" : undefined}
                    className={`flex h-8 items-center justify-center rounded text-xs hover:bg-slate-800 ${tone} ${ring}`}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {dayStatus && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Thiếu giờ công</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Tăng ca</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> OT trên {OT_ALERT}h</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-red-500" /> Ngày lễ</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Nghỉ phép</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-teal-500" /> Hôm nay</span>
        </div>
      )}

      <div className="mt-2 flex justify-between border-t border-slate-800 pt-2">
        <button onClick={() => { const t = new Date(); setView({ y: t.getFullYear(), m: t.getMonth() }); onSelect(fmt(t)); }}
          className="text-xs text-teal-400 hover:text-teal-300">Hôm nay</button>
        <span className="font-mono text-xs text-slate-600">{value ? dFull(value) : "—"}</span>
      </div>
    </div>
  );
}

/* Bộ chọn KHOẢNG ngày — một lịch duy nhất: bấm lần đầu đặt ngày bắt đầu, lần thứ hai đặt ngày kết thúc.
   Bấm ngược thứ tự (ngày sau trước, ngày trước sau) vẫn ra khoảng đúng, không bắt người dùng nhớ thứ tự. */
function DateRangeField({ label, from, to, onChange, align = "left", className = "" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // ngày đầu vừa bấm, đang chờ ngày thứ hai
  const ref = useRef(null);
  const [view, setView] = useState(() => { const d = parseD(from); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPending(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const pick = (s) => {
    if (!pending) { setPending(s); return; }
    const a = s < pending ? s : pending;
    const b = s < pending ? pending : s;
    onChange(a, b);
    setPending(null); setOpen(false);
  };

  const nDays = Math.round((parseD(to) - parseD(from)) / 86400000) + 1;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-500">{label}</label>}
      <button onClick={() => {
          setPending(null);
          setOpen((o) => { if (!o) { const d = parseD(from); setView({ y: d.getFullYear(), m: d.getMonth() }); } return !o; });
        }}
        className={`${CTRL} flex w-full items-center justify-between gap-2 rounded-md border bg-slate-900 px-3 text-sm hover:border-slate-500 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="truncate font-mono text-slate-100">{dFull(from)} – {dFull(to)}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-slate-500">{nDays} ngày</span>
          <CalendarDays size={15} className="text-slate-500" />
        </span>
      </button>

      {open && (
        <div className={`absolute top-full z-50 mt-1 ${align === "right" ? "right-0" : "left-0"}`}>
          <CalendarPanel
            value={pending || from}
            onSelect={pick}
            view={view}
            onViewChange={setView}
            markSelected={false}
            rangeStart={pending || from}
            rangeEnd={pending ? null : to}
            hint={pending
              ? <>Bắt đầu <span className="font-mono text-teal-300">{dFull(pending)}</span> — giờ bấm ngày kết thúc</>
              : "Bấm ngày bắt đầu, rồi bấm ngày kết thúc"}
          />
        </div>
      )}
    </div>
  );
}

function DateField({ label, value, onChange, align = "left", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-slate-500">{label}</label>}
      <button onClick={() => setOpen((o) => !o)}
        className={`${CTRL} flex w-full items-center justify-between gap-2 rounded-md border bg-slate-900 px-3 text-sm hover:border-slate-500 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="font-mono text-slate-100">{dFull(value)}</span>
        <CalendarDays size={15} className="shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className={`absolute top-full z-50 mt-1 ${align === "right" ? "right-0" : "left-0"}`}>
          <CalendarPanel value={value} onSelect={(s) => { onChange(s); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/* Bộ chọn TUẦN dùng cho nhân sự — cùng một CalendarPanel dark như DateField bên Quản lý,
   nhưng chọn 1 ngày bất kỳ sẽ nhảy tới tuần (thứ 2) chứa ngày đó.
   Ngoài ra tô viền cảnh báo ngay trên ô ngày: cam = thiếu giờ (<8h, ngày đã qua), xanh lá = thừa giờ (>8h). */
function WeekPicker({ monday, onChange, empId, hoursCfg = DEFAULT_HOURS, holidaySet = null, refreshKey = 0 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const baseMonth = parseD(monday);
  const [calView, setCalView] = useState({ y: baseMonth.getFullYear(), m: baseMonth.getMonth() });
  const [monthData, setMonthData] = useState({}); // ym -> { dateStr: tổng giờ }
  const [monthLeave, setMonthLeave] = useState({}); // ym -> { dateStr: loại nghỉ }
  const todayStr = fmt(new Date());

  // Sau mỗi lần lưu bảng công, bỏ bộ nhớ đệm để lịch hiển thị số giờ mới nhất
  useEffect(() => { setMonthData({}); setMonthLeave({}); }, [refreshKey, empId]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Chỉ tải tháng nào chưa có trong bộ nhớ đệm — mở lại lịch hay lật qua lật lại không gọi storage nữa,
  // giữ cho quota request dành cho việc lưu bảng công.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const yms = [-1, 0, 1].map((off) => {
        const d = new Date(calView.y, calView.m + off, 1);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      }).filter((ym) => !(ym in monthData));
      if (yms.length === 0) return;
      const entries = [];
      for (const ym of yms) entries.push([ym, dbTs(empId, ym)]);   // đọc từ bộ nhớ, không tốn lệnh
      if (!alive) return;
      setMonthData((prev) => {
        const next = { ...prev };
        for (const [ym, bucket] of entries) {
          const perDay = {};
          if (bucket?.rows) for (const r of bucket.rows) for (const [d, hh] of Object.entries(r.days || {})) {
            if (!hh) continue;
            perDay[d] = (perDay[d] || 0) + hh;
          }
          next[ym] = perDay; // ghi đè theo tháng, tránh cộng dồn trùng khi mở lại
        }
        return next;
      });
      setMonthLeave((prev) => {
        const next = { ...prev };
        for (const [ym, bucket] of entries) {
          const lv = {};
          for (const r of bucket?.rows || []) {
            const lt = leaveTypeOfTask(r.taskId);
            if (!lt) continue;
            for (const [d, hh] of Object.entries(r.days || {})) if (hh > 0) lv[d] = lt;
          }
          next[ym] = lv;
        }
        return next;
      });
    })();
    return () => { alive = false; };
  }, [open, calView.y, calView.m, empId]);

  const dayStatus = (dateStr) => {
    const h = monthData[ymOf(dateStr)]?.[dateStr] || 0;
    if (holidaySet?.has(dateStr)) return "holiday";
    const lv = monthLeave[ymOf(dateStr)]?.[dateStr];
    if (lv && h === 0) return "leave";
    const ot = otHoursFor(dateStr, h, hoursCfg, holidaySet);
    if (ot > OT_ALERT) return "otHigh";   // OT quá dày trong một ngày — cảnh báo đỏ
    if (ot > 0) return "over";
    const min = minHoursFor(dateStr, hoursCfg, holidaySet);
    if (min !== null && dateStr <= todayStr && h < min) return "under";
    return null;
  };

  const days = weekDays(monday);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className={`${CTRL} flex items-center justify-center gap-2 rounded-md border bg-slate-900 px-3 text-sm hover:border-slate-500 ${open ? "border-teal-500" : "border-slate-700"}`}>
        <span className="font-mono text-slate-50">{dLabel(days[0])} – {dLabel(days[6])}</span>
        <CalendarDays size={15} className="shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2">
          <CalendarPanel value={monday} onSelect={(s) => { onChange(fmt(mondayOf(parseD(s)))); setOpen(false); }}
            dayStatus={dayStatus} view={calView} onViewChange={setCalView} markSelected={false} markWeek />
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
export default function App() {
  const [cfg, setCfg] = useState(null);
  const [booting, setBooting] = useState(true);
  const [who, setWho] = useState(null);                  // tài khoản đang đăng nhập: { userId, username, empId, admin }
  const [loadFailed, setLoadFailed] = useState(false);   // đăng nhập được nhưng không tải được dữ liệu
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("dash");
  const [sheetDirty, setSheetDirty] = useState(false);   // bảng công còn thay đổi chưa lưu
  const [pendingTab, setPendingTab] = useState(null);    // tab muốn sang, đang chờ xác nhận
  // Rời khỏi màn chấm công khi còn thay đổi chưa lưu thì hỏi lại — trước đây mất dữ liệu lặng lẽ
  const go = (k) => {
    if (k === tab) return;
    if (sheetDirty && (tab === "ts" || tab === "sheet")) { setPendingTab(k); return; }
    setTab(k);
  };

  const flash = useCallback((msg, kind = "ok") => {
    setToast({ msg, kind }); setTimeout(() => setToast(null), 2600);
  }, []);

  /* Tải toàn bộ dữ liệu. Chỉ gọi SAU khi đã đăng nhập: database từ chối người chưa có tài khoản. */
  const openData = useCallback(async () => {
    try {
      const db = await loadDB(true);          // 1 lệnh duy nhất cho toàn bộ dữ liệu
      let c = db.config || emptyConfig();
      c.tasks = c.tasks?.length ? c.tasks : DEFAULT_TASKS;
      c.tasks = c.tasks.filter((t) => !isDeptTask(t));   // v1.5: bỏ tác vụ cấp bộ phận có sẵn
      c.deadlineDay = c.deadlineDay || 5;
      c.hours = { ...DEFAULT_HOURS, ...(c.hours || {}) };  // dữ liệu cũ chưa có mục này thì lấy mặc định
      c.holidays = Array.isArray(c.holidays) ? c.holidays : [];
      // dữ liệu v1.4 trở về trước chưa có danh sách vai trò thì lấy 5 vai trò mặc định
      c.roles = Array.isArray(c.roles) ? c.roles : DEFAULT_ROLES.map((r) => ({ ...r }));
      c.leaveTypes = Array.isArray(c.leaveTypes) && c.leaveTypes.length ? c.leaveTypes : DEFAULT_LEAVE_TYPES.map((t) => ({ ...t }));
      c.depts = Array.isArray(c.depts) && c.depts.length ? c.depts : [...DEFAULT_DEPTS];
      if (!c.depts.includes("Ban giám đốc")) c.depts = [...c.depts, "Ban giám đốc"];
      syncDepts(c.depts);
      syncRoles(c.roles);
      syncLeave(c.leaveTypes);
      setCfg(c); setLoadFailed(false);
      return true;
    } catch {
      // Không vào app với cấu hình rỗng: bấm Lưu lúc đó sẽ đè lên dữ liệu thật
      setCfg(null); setLoadFailed(true);
      return false;
    }
  }, []);

  /* Vào app sau khi có danh tính: tải dữ liệu rồi mở đúng màn hình theo quyền */
  const enter = useCallback(async (w) => {
    setBooting(true);
    setWho(w); setTab(w.admin ? "dash" : "ts");
    await openData();
    setBooting(false);
  }, [openData]);

  useEffect(() => {
    (async () => {
      // Khởi động phải luôn kết thúc, kể cả khi lưu trữ hỏng — nếu không app đứng mãi ở màn hình chờ
      let w = null;
      try { w = await currentUser(); } catch { /* coi như chưa đăng nhập */ }
      if (w) await enter(w); else setBooting(false);
    })();
  }, [enter]);

  const saveCfg = useCallback(async (next) => {
    setCfg(next);
    const ok = await commitDB((d) => { d.config = next; });
    if (!ok) flash("Không lưu được thiết lập. Thử lại.", "err");
    return ok;
  }, [flash]);

  syncDepts(cfg?.depts);
  syncLeave(cfg?.leaveTypes);
  syncRoles(cfg?.roles);   // đồng bộ trước khi các màn con render (cfg còn null lúc app vừa mở)

  const signOut = async () => {
    await authSignOut();
    resetDB();
    setWho(null); setCfg(null); setLoadFailed(false); setSheetDirty(false); setPendingTab(null);
  };

  /* Danh tính dùng trong app, suy ra từ tài khoản:
     · tài khoản có quyền quản lý -> khu vực quản lý
     · tài khoản thường -> bảng công của đúng nhân sự gắn với tài khoản đó */
  const myEmp = who?.empId && cfg ? cfg.employees.find((e) => e.id === who.empId) || null : null;
  const me = !who || !cfg ? null
    : who.admin ? { type: "admin", empId: myEmp?.id || null }
    : myEmp ? { type: "emp", empId: myEmp.id } : null;
  const orphan = !!who && !!cfg && !me;   // tài khoản thường nhưng nhân sự gắn kèm đã bị xoá

  if (booting) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
      <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /><span className="text-sm">Đang tải dữ liệu…</span></div>
    </div>
  );

  const railItems = me?.type === "admin"
    ? [["dash", "Dashboard", LayoutDashboard], ["sheet", "Bảng công", ClipboardList], ["proj", "Dự án", FolderKanban],
       ["emp", "Nhân sự", Users], ["task", "Tác vụ", ListChecks], ["set", "Thiết lập", Settings]]
    : me ? [["ts", "Chấm công", Clock], ["edash", "Dashboard", LayoutDashboard], ["eset", "Cài đặt", Settings]] : [];

  const pageTitle = { dash: "Dashboard giờ công", sheet: "Bảng công nhân sự", proj: "Dự án", emp: "Nhân sự", task: "Tác vụ công việc theo vai trò", set: "Thiết lập", ts: "", edash: "Dashboard cá nhân", eset: "Cài đặt cá nhân" }[tab];

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100">
      <style>{`
        /* Một font duy nhất cho cả chữ lẫn số: Inter, cắt gọn còn ASCII + trọn bộ tiếng Việt.
           Số 0 của Inter là hình bầu dục rỗng, không chấm không gạch — đã kiểm bằng cách đếm
           đường viền glyph. Nhúng thẳng vào file nên hiển thị giống hệt nhau trên mọi máy. */
        @font-face {
          font-family: "ARTIUS";
          src: url(data:font/woff2;base64,d09GMgABAAAAAEeYAA8AAAAA0ZgAAEc7AAQAQgAAAAAAAAAAAAAAAAAAAAAAAAAAGoISG4GFUhy+NgZgAIYcEQgKgbg4gZ1qATYCJAOOVAuHLAAEIAWEGgcgDAcblr8HonPHPiq3A7Dv+97DnY2wYeMA/Da5O4q6nEkdOvv//56cjFEwe9icWvUXy04SKmeiyqgyeu3T3Vt3T8yKbGMKS2g8fldm8J5Cm148K5GUIy6WQ6ngb09MxR5+zuP85o3uQj5Fhcb8UPU0dRX6cKLY0ibjn1aG+4SKK/aFvyZR0UKTB3pY1/nwIfHUgiD9NCTWIrMDXZGoS+45vHX52n92ogUpFhSmwq0UCxoSZIgsPkJjn+Qe8br1M/veS0IIMUAIRYgRldJFjIgNS7AhImBpHELXCJGmRAQO7XAc58eGHHp8j48NWz4qUqIdDgJERFTkgOMiNozYOY/AZ+1lL8nuHa0K5Rj/rUExOJQoXSj6hX/g7wd17v8T3TgD0rUYkSALltypCxyJC978hoe59Y8UWgUUpASJlhghIA6WrFnANsYYsQEj3NgYbCwZo0aLlAg9qj0xAO0z/828VC9LvajvP7pVL/Cx2ITAmGm5/RZdt37HP/8c/+3se9+PZg3Q4FTAeYA12Jc8gQwCDbQ8n/9+/dQkO/QlQ5FhwNDGYTdxCWa+2m7co3NdRDAs8mnfgpMWpgDtKWlm9wGAKlwupgeB9XSa/whHPKjIPKjTqNNdyN8xjx+tZPH7gepO5OAc7NruWlGCukae5+nv05tlp013ehz8/sYzHg9gOSIVS/yLtVov2LIfNTY7ZFKhHUJiDCj432qo32lZI+ojAKY6526cO6Ts/0w12/0YBgCK+/jukXbGexdjT1LSxfh6p1DPzuxwMRgsEXnCEgqkJFsEcYEgdYoXuNhFIEhKvJQyKDqQFxUuxdIhxz5XIXUuXVFFdyF3nUPq3Llt3V5XunPtsjIPbze+Re3o2dcAE460+Wl3EB9Y4K0t8AQizjief1n2s3/ycnPUL7R4gjJrJX+nUIbJUIvuRREUwuEQGocwyFbUKozSCI2QjuD3TpXa/r6XOVRqFEKrosBj0ENShqRugMs2YBmbdRNcROrb8NW8JxvinWnt06jiEkqIwry/5ZDSzKLabfuW7J5O1LIopYTwG0pcihAh1sklJ6s69U+2vXibPyLRsXzAKsx/EQAi+AAAAPSICdAsaLZAKMgyKEwUFCMOSpAMpUmHMmRA22VCO+2EdtsDHXYEKvErdEMNdMttaIQBIgppwLjIBYyHPMAmiQmbhRy2HCssHCcsUkWYQk2YkiIsmz7sJ+1hhfrCjhkKKzUXds5GWJWtsFpXorrjTthdd6Nq0BAFEQA8AGYQdjPEqta2HbvuaggBcK1ThT77ITAMbB7KSJaDy2PJMZtA+vSG1ESYgwYABoMCgIjApTpVTt9QYbCwcZ76kZwI3v88TRD4zKY9AmFalzl3k+V2AWBBAAiAIACoTQYgQAtkvtd83qvkV+PXcDMNGOGg8AjZQgSY3wQ5UvTdDKvngdirKp6IIUxHA7CWrMI+hYLilR4kr8OAwWIDFakc5KNEJXDDy/ipJw9Zi1dzzJAlW45cKlXqNXmkw2Odnniq1wtf8pXv/OYv/x2F8SjyJKLL+Yx9wdA/CkNW73J7p8q6n6Er8uWf0ReksjSFHkXn43in8icFnzI8qgtMNAxOH4l1HZkKGzw1kOpUgiU+K/2B+5VeE97WqV84qCknaDlpYvU8SnhimMpwE8oCmebZkZHFswk/Qi6vP4OHQYHD9HwFvvHvRfo3dEICq/HHHSJwEBAhIAAggJBkYoMzBfysEhuXS1/4vrInMqZM9dI3avJMl+e+dAAjSpCX9nQpPPd8DfmCP97rAgNj/JbDVoJ0NdWgA+nLKpfbr2vQ2RxIRyMZ9CWku+RVGkyOTRcl7M0HB3X0tM54AUjyR49h5zN2W+CZz/lwaFjbIxchbCWVo+ueqbXDLU51IH8vH2V5GOfJhSFJhKkJKB1twKIx8impjPmykuvBj6WAs7LXt+hMemwieZTQS24VORpcN+rScDjJ0h+1snt7tvLCXqE1kDIvjsF2JFtJzHBc5px+9zrrWr1Z+x6nL3spV9tMOcXhhz2RVzObC7bci94f1r3+Lntxk4S0trBYe7YozIeMbKB0jw2w2LqlgZl7g/yP3CHzRMVavv3IroN1/Yu1loOKoG+ltMP07NMWwiNXyh8lKQfgswAp9cAsyAPn1HhwDonvQD16ZugcR3fGivGUMHHii++sS0a5Sk3k1oXEnT+O1aCRvSbNxmvVxkG7bk569Jqk398mG/DWFHqfzPDVv+YGECzMFGlYlBuPlhQguGWImVGl0QVspDORwZwSZTuxTKZ2EMph60emcqt5/Bln4HSOs4DOIy5AlxBXmbnG0nWjVBO4YZQaArVGqSNQz5i6chKQcRKngJ1GlCZsrYh2xCM8Hc3ogX7jxkI8T+dGnnmOpRutB62fhb+JDECvEG8gPTSE+NjwXND5hoH4h7XvjP3b+GlO1EHAKjMEjMk8gMk2wpzHcJ141ezANJoxOI9iQcKKYHtJzNa8jC5AIBrKG4LP3G7y0wMLXM+tjUEBsIEAAGixVi4OI0aCvSBGtR2lKbOg6VVAmYfHLYF4IDyPRcay3jddgAxsRIDCJyIG+mTwfF2ir24veF0EGgDiQDxmUDTF6TtOmJz8ESAhskVjkBuaLKae+VEACkIh6AcRf9r//iGHAFjQRwCbdS219aGB8Rus/WPJ8NYLaltUyhs/s9pdS71S/cLpVpAd2e7M3bNgxPQPuorcHWvdvo2YYkS4K1oFP2vZCU1Ho4xT1XFE8PNCuzIoAC1AwSgMbRAbRbFESUb00CXY19KbBI00Dvkq3Qmao5Hr8SAmD/DguyYiQCQC0eNQSAgcMDg5JvgK8QlsFYaABAm5HoOx46g6TdoVfZTAANvJBWvOr6nXJX/jdEyriI8U75o+EgPAaD84HwVkF5wzjEEVg0V4bDSTVVYil35HMY75I95jR4er2vj9S9TEGTscENmuItsJZaNsX7bFiebkTrQwJbArdHRgh8IRQ13hHwJHDNXgqgK2QYw8qcNxj5PCERVZERyRroTLAbVqXNv3oHax1oLW+ta6huEbcHYvRU0ixgnFiBg+EeMtYiDWa2i98N+Ev0n408B7qoUFAhC4gI0CbI/OhfguXR6j0jYKNiABB3Cb3xsAXxC+cEew9O54OYIwYr0GxoJpSK1WiBnv6l4RFgJ3H7qZ9zewBBCyoAHAr6KXBfg8iqHRTNEQGrc41W8UWGP6HJ2yubjhxmmfp9Ov4XXN4HydkbDMCoeiuEQbVaJK3VGHPo40G6hwLBjNNuSHyzjSzy0bo9mSGMveOONN4MCRE1du3Hnw5GUib5P4mExqoSBhVlljrWgxYsWpugk22kRusyQKW6RQqdKk1wuvfM5nVrq8DtUzErJHNzSlN0sX+IywNGfcvBy9zU3/L0rfHa+9LYqq25QQTPj1+Az1yCJrYG0ivpDCJU68QQg//9NP6lK+9Ov4FwqOn1jbs8Pg9WOi157QPsOAKYhRabTISg3uCQwtem1G6FUgRk4aYIH8/eeIpWSWkSEdLn0A8agrZwBsj2ob1asUqkTIz9OEEooZdDlRoIAGBljABg7YLOiaMTEi7RkCgcHwPCvUBc91noOMvBM+aZPB5cI3A5JAAVv4iMcN4PQwAOdBAEzONNyNGySJoIAtnPYTzqTsCJBM2Fx1DM1bcBcMRBhCmhrhmgVwlS1xuTHBHCQwFuxhHIyHCeCgO+2Ro+Jm3B3cA+AJXhucOJRQd8l5koICtpBk8ntCX648CA3A3uGlZucaS5Q753JFJw1XY8FO3QYMB8fHfqMlhOxhv1ztxN+akAVLVuyIjeFaJbdnrkBLBVsm1HKRtsqqBv42YBG6QcSVuxEOM9y4sbejGsVvNMwYU4LLZPVBZLYC4qytflS1IkrSAsnKTg8uPeyimD0njgbvpE9VOF3/CgrIDPj9GYANgAMATRqJcYzI8MiYkOGTGUVGQMaUjBkZIRkLMpZkrMiMJmNLxo6MmMwYMo5knMnMIuNPZjFZjDxMYTmsgOp2JayCCIiEaEj5lsjuf4HdB7m5ZphHbmwLU9vig57W8zSsRDopRycb6gyIrEPa4oF7S99zEzxajxlC4z4munlLV5LmTtAhYd0rXV+Z4M2KiXKwzkXH4iAkOERtGM1K+Ur2e62UWRcnK34TJJrLkYBxajQPNQPY75uJh/a88XjdZDFaozLe0dRbmlDpYHc3nVJ9BbGRWmlpuTQZus37h7mft/tHjxo3Hd/jjYHt8Kr9ricScPjVaWpECmoKBa/qDeZ67ZZyI6r1uHI9pUmfljMORxDXNCp7wBV+z6fPgyqROE1B9sIluslosTSlQVDdIqC4z1a1nWCg9aKN5oZQPqrIxCKnbr9iGdBQpo1kYZXQHLPsBDRGdR3B6ticeXuCGLqN+syKf/SwfvVqOpWysPRCP++zLGjLENp+qV+GtUGakWXjZMdUJSSEK1ezmSXpAEGa0Zy5Ry57lnnoNNvdBJ2HZ4NZpPWZ7uEva4mMJ+uO5uT27ARlT4c0Z2Hfz1xM+VyxuttiAUnNMsys5pTqN93MY12wmsC/yNweeuBznPVK2Twv7GibxHa90kCmyImOz2n7tYoBu1Y8mpk869YU/fdgEO8yp7MokBsw/B4Kto7i8K6IJlv3G4Dg6wLmCtMslmmdFBc5H+T/W23PojVbn1+mLVtYlW0r0EWUZwMyHwSvHII2crwd8YeGT3PmKWVNxD4ys/k3HWaWlMYlhKVjM1bYiKfqPzPAYh6ttOzFzXg1Pigmn176iM0TfcveftF9r6C4rLMh9J5NPFkLKlOJz6wmZ6IcMljy4ih0YdeMppC2j/cVuFOhXsDq2/x+a9h0RS42BlbWVIxTbJX30k08GkDFwtZXg9iDokV7z066UK15gTZwtQectPpK7N65ax2dUyaPiaW38W6fjZT5UYCvDFZaoZ3Thj1Zd2ecwCQsYNFQhtu83Tasu3P+zXNo1PFZOEt5pxXVFdTMi0c7FjpeZjZg153gYAttVJTL8mkkhxW0Hfzfc9h5XJSp2twVpdlr28MQp2m8C+8m0dvBc6666rk/8y6il+J65BPXXR/nNObMSy2X4lGKqPebpxuP+e9g3X1ZIc6R6Tu6U6Mh4Eysy8se4IfjfCjAdeXnahWg/ZGpRVONTDFz/703v76LcEqs+H1eOgzzsqZHHtB5FwC297Mo22OK4dHkuOX+Jw6IsIUCAQRZJlCoZMFSpVPIoJQi0w5pcuTa6qijlIoV265EiUwnnLDDWZdkuUptt1tu+dkddxRq0OgXTZr9R6s2h7TrdkSPXmX6/e2UAW+V0/vknK8BXM4UCdw4bIsqffQM+7G27n9Y67zFE7DFShLEJ1XohfueoWwJXUnwLudMYyXEGjutvNxhzVmpzyoBVqxecUSAHig4ADnhoDbWX4XTrM+9VDyotQrNhhAJ90839xUAHNrA7ggAT+kByB+PMpCxBDddXiaVnSm+v1y2qROF5lwA8YpNH/EGylIsr7eJGcRw2XMADGxHeToHtVbl9ZrfgI0v9jevNnAFyiw8YyxIZcZIZqgGYypKj5S2hIkoCVZmgYiSxarFUeUCAKvN4e0oWFL0WuRxoOAk3KWmI9wxKTB+UYvTtPoQVylRIfIBxCEvAwHTNbCdbafh+TjnN28902VmaFlQ2ZnmnCxHYypU5wLIl0Tf8wayUvQvVoouRGNBZdV2lPNF0PQqFhkYYvCNYOM92S1WQBrMhOHu7hiJAIxlqBr7KbpjLWswWWeiNNQBckCz8gCuMVC6XQ7XLHn4EL8fcLQZMOiMIQuWLFuxat1G2J1kuC0HZPIsATowgAnZwIJcibMBVMUt64w0RCMCGQCABESjjN8pADJxgAbkrnmaWeZ1LpVvmwKGG+dQHGz2Jmyf0a16TXnVzBadrLoBh0PF+MJNLs5LKNfHdZ9pSKsZB2NhVzSUoA4U/nuGTJ4EdLctzHHpFLW/kicWFmuu6RlB8P6jyHSEBQ9igCWzM743+Y0qSkV0CoIECYlil6omE2bERQTw5gfiVWwoTqWGM23kVRQtC1Gd31PiV2kV3suIxK8SQQUHIyRAdCkGfnj1BaIQGxlJDJaqSAWRTKg6EdwdIoJYOudlFmO+b6ZSZOS/wIIkmqlx9vXYr+QweuiLPBV8H4rarIB5zyembYaQl++vrDK95emkKDkEWk4CzpZlBwAZuepoch+N9dXZePjEayNMq00/MHOcfo022AbZdtp17HzFi8QR4nT/qxy49pb/YhUpUFCNpzq26ZiZr1c+GomDZjwEiJQ4ruM7YRM30MEMddhTPJUjn4bpnMGZnKU5P1enaTqmZ17NxxlZDmW2HhuwkZu48CUsffO3bCXgcKir3qbt3P4d3ZmSu8Az4gVfyTLtUajYKZWuudVJczZsu02ri47e8NCEH8vKNWnXNXMowbru4Q3ayPpnX97RmjV7sdKkZdZYaGi0aKmWm+IozTKaalnu8nlXVdQatV+l3jvke6w/3yF+IiRIg5OJg09MqUm3IQYrLrhOo1OfNz4PkGVEOF4TMBETNymDbFUhEe+4WiWSXLocBxQpVeGyGve0eqrfoK8R5KHIYSEgUqCRsfAIyNRr12/cgnN2PdCqU48Bem6Jmt6txgeacjN+AACSJM3MzCRJcs45VzeOy6aTIWapbpnxN/GCxrsLy8Ty+L7WnqHJOfc8z39FnLEAZJxhBQAAIEmSLC+UqKGToTWtE0KM5ZjOibJG/goHEEJ4RCSJXOSjmVqgEK1TrBRSapcKdFRlOqcqqdWodnVrQEP6bhYlsI3H28O+nuNAr3CENzrVWd7ngy5xuS+62nescaf7/MafAzSXFkYcp3hnegISnDWJTmK2JTf5OZyTORNV6vIg2nRFF32GSzN8xqr2dau0/l3UsIY3vsnN7J4WtrinWtlrvdWmdrSnr/qxI8thma3tOqzX+u28DdpVG7nyTd+cPbBFW7oVe3lr9t627tPt38H9eoTNY4tOci7nczNvwYXcuos9xSlv1xXc0Su7c1d16mu89uu+gRu674/FETybN/55PN835wW+FS/ibXypL+vtewdfySt/F1/1u/M0r/P1vTfv86IBAgoGBWOCacGCYFWwJdgXZIKO4HjggitoRS9GMYcNbOM2vsT3+BP/YZg0JWgYTaBZtITW0Q5S1ExH6DSFdIUt7OYgxznHNV7gVX7IL/ktf+W//J/DRph4AI/gCTyDF/AK3sA7+ABnuI17+DSHfMVarNv6bdgmk6D6Ms20YTVUptyMHwCAJEkzMzNJkpxzztX1zeYAgaaBAAAgSdLMzEySJOecc3V96z1AoGkgAABIkjQzM5MkyTnnXG7H/gDQNAAAAJIkzczMJElyzjmX29EfAJoGAABAkqSZmZkkSc4553LbYYlegKYBAACQJGlmZiZJknPOueam/gNsJ0PMUuu6TgghhBhjjDHLsizLUkoppVwul8vVXSC8ldW1a3IQJ1Vd69+uV9cZxAJA4xPz4I8CQKybvg+XeQQfdsj5EN87fboXAG79tGcRs/1s8Eqztr5Md2v4O5DuAp219aXDs4MIFl4OWN5f4DhWFn6vSKDYgiCRMJXFJmDDnkuW4JUdTog2YMCLxkfJsn16IPtIdo7gQ+IYPP3eEPrYWJdR0s14txkHXvzMO4H+SpY9ChxWqlylKjVFBxjWvJv1evSz3oWevvTTxPCt7NXoG/3kHH9HpZ/01Oif94zkIjJyjn6QQ8CqCJ5WNPqz7pHQpr6xH1+sNa5Ld+M5vhDTO628yut/IuLQGTBIn7VDAgTGAiBT6Iw7un3NBhQZj1yPDTc9pY+tOMRJfgpStDJVonOqk1b9+mgWZWMvL3CmC1zma271K49EGLfMyZqkJj/l+dxVTeyenmxNdf0uwEl4ijhhTuJTy2n8dOn0/OxyTjlTz/xz3XnmvHt+GgUACRGlciEAFoS6UVABJITijdWc1MWg0mTNok+1xH/R5kdbIaLaTRRCSAwX3AusDbne7CFw2NHtz7NiUUzVfozE1Jy8F4ACmjmFY6xrU3CRYQpxjAUpysssRoljeKdEv8ZmInEMm1SBhxDj9XAH56CF6sNeaKHiiC1aKHLpGijKsvrQg6Aoj3XUBmkNKMq+h+kaUJS9itIVoCjr2J0+CIpydZ4SFOUVcMNA4pCkoulQB6gg2ucuCBNI5Qh0SzIU47dHKZlcqA+EZ0wRF6Q3BYK4AiQImU4sYDrSxCjisocIS+CCahppIkII/wQiVDGJIYAQuCQAdPDOuRWQGWwg0gBlAARjypUIEPUXx0aCZJ5S6Z9a5rOkCgsYmBYri+iBQaZYQRSU0PWwIbYtmpS62phiETFUqW9DCdA7w+R36nCn1TsyD6/aBJUttlFz/z6xymlxZG7qMIwGlJoYW1XORINTnZBLi491oKCOzIhrz66tL8hfU6+aySPfsqSTTiGrNnlClpxt4MCkTu8PggNJAaRIIZUm3xQq1yzVqFFYAMHybNAEVhQjpjWZ6suvqj0savc8bdqxcVweY4M+4Rk2TFiA6Cxc5Ovq5WatcrduWeet/M032Y3/LBSqUu0rf18RNtLtWy4wOZRsmsSkQKiwVH3NFFYrEMovVfc/Ajs/hBKn8vEcIauhqI5kJwT2hg3DAlF9sMBED5AefZyDFdAdqMOAXH4GNS8KOXgRahbrYeCZqJkb8AOPRM34fDF4ALoEZjrddSXoXd7+aPgzLpoBuFkMa0Do1l2uQfHEAA/yOsobe3T0q5w0g3zKPCitfk4u4CH2rYHDk4FEBMVK6bKSBKHcp2eXfEYJSrBVexItglL1xJR9+SeRN7J1CiU7cACrlcQcACFxGsmS0YMy5MsIbi8HEWicIWo33XLbHXfde9A02v0ZE+/ovXfbf/DRJ8OPEPdakGAhQoUJF+GoSFGiI9gSJYJ6QYg4iIdMkEW+KPifungT7bTLbnvstc9+B+TJd9B/HHZEkUOOOqbEr4odV+qEnxT4WaFfnPSbMv91yu/K/c9pZ5x1znmVLriowiWXXUFwZcgFcF0dLrW7BJo1E2nTxtIzXax062FD5xM73wxzT9pUT6xY738IASFbBIA3AgA7HkIEVa3d/58AISDQOi5TAYz2rWN2iG+A1t+13zEEwmSpoMVhxoaEAzfefM0MGdVd9dIi1YFFqpUaSc0/0uXzglwPJd+0oEvDi9Ai8V1FqR+UVTTY7EuE2QmJURWSoK21b0MGNI1m0Onaz6AVtIrW0BWk+tIR0yz5BIYtJgg4ZyJVu2gYMb5W3nJ7kwQf3SzQAF32N00v+K4wBjAnDvcDKJZrID+UP41EMaeiJP1OsHRi8x+ckDtLQkENJJ+zd1/MADh/TlGAbwcA9L1HYwASPACIggB46FkQgBcJmgCAp6mynGNAF00FKzFmZU0omjKixt18kwgl1hI7ib3EQXLWAAAg4cXPSZWZokCQYqOWF1AzxRle90mJk8RKYuvqdkgWwjwjb0HP92ntfO8r06vpX4AAPAAsovWqfO06devRq/+6gQ8mE91r3Nz/dbovLXtQeey6at+89EyzLg314tOdhW6nq+ohI1w8JsyYE7J4qd2t2xGTcOTEmQtXbi+y+0sqdUOTGl99aRRMMctsc82z0CKLBQoVZrkVVlotwgaRosSIJbdZoiTJajWq8zarqqTb5oGt/ghR0Hcj+n32T6b9600U0siH+AD0ZsYUDPCSMXKRB9fQGCwUgo3DGN8oAqYsWbEmKqYxr+Rbr72xXhl3/yZLEW0aX1PN4Ge6meYIMN8CsheP3Z4gqVZZL9wP1lrjFnrNelXfy+Ns4X8PQqiut7EHhAv5w4LF7Ybi2vkv6buoFrQ+XYdpxDbhmvENBDWxjqTNqCdraJ2ZXVnd9FOMHubp7F5WX+4g50zBSOEod4w3XjRRPFkyxTeUTpfNlM9WzFUuiZbFK1WrkrXq9ZoN2bnad+TnFVvcQjgMjgEA/hEAUJ8FeHcgfAVA8hMA70DAuRoAABcZM+1WCJQB1EUsJrWeGtN5QhQkjtpQOAAkbSCmmyYs1pMGCuZhES81C8pJMJK5qjdmPORkzK8JhRqA7VOLlIYsSA0zCSsui4SbFTN0lCwA5S1HRp3ffHTY9NH4ESqcbAJFHABkJaIQdcxp9P67ZLopjp4LJmtPy51oZntZ0cis15HtwCrsBLQ/uonY7OFIAOS2CgDmoihEFgkflgcvTiR9Tr7UZCjlvJcjyQeSLA/In1WMKYSxLa3DnO41bi0D+5439PbmpgHFvWMuUgERjfI++aOmdDKh6w32dKdSlpSjsqE19Wj2VuoixoSNLff77dhwwSuWBIVpSm+xJ8kJWt74Mft9+M14iPReNxCxivR9zsNSvqvXpxHawlAs10hTzHQyHEzR3YbVGYXlKfetDsSxuVCpREG9K1djs/FBBq/cYpGR58h7mVIRztFf2Jss7XIiZwb2y8UQ8a/JQl7ky4z0E0NaDpFFLkR0r1RUMIpo969PSNJBHMliDDgTiUcVoZyfgJGB0FjCYBTy5yGIXonOjGwamoU9hdUwXJZyWUw2yYGQiCRvk/sJTSnJPq/A5keh8ltbaov31Vg8ZVAMD/IDxry+tH2Lxf43HoxVND1R4lwlfQ1bW2HiTbZcFkln6Tt/94nvfP0Gtubn0JOw9A+rbb2pY2zFzTFMei8zC9f1r2dP9f3qxJMcKwUiQ6+YGwNu6lUea9sNHszz2SFOOJLSdcnz1q9p+kRWU9zf4jTG020+H1sZ1Fg8xES47UY5Cm8NHfE7/DCM4fojQMLYqD/fm5j2a1DZpHQzT228DRLXZCe9EXz9OMN6fZrMBsW6j2QPdx8rQdC5L2iMYsMF13SkhINUxjJjs37Hu6TgQIgZyrdNI9rQS0k/2+nnZMj+Fn9JWmEX/0EwweavPBdAMRYYgbQ8n57yZvst6KnrzSW2gB+fm9Z1JOuhd3KU8s11jHLMPb8sSuBAcBZUC+okJ6G1NG6lP0ut/gyxeBOaZRrqB21AhPQwfAZqDK/WFp1UnpnGNIMHqtp5AzCp0EL9go9MFMhxiWJ1QiddMColrA+d+8pmXXAGAQnX8UO9xDaqYkquXqskE1pHHOyvebRb3cr+p3HiHqtNA8LTOaxPBdL94nRxAYP9VXHKaxVIoA+KzZPVtaXbBDunSq/FN9gHSATy1kl3qkIfJs1BlZtvRWF2ghBxQqS++H+Qg0GvLFKlkQi5zZdHzvNZOhJhjT32XEoqPnE7YVLfzMymG28h4rFCaQlmg1ib9URpYTC7n+xRqEAS91Q/U1WQ1hVynYsDgpK3wXDtvUcoxYRFymRGLvUkQVGtz3XWNvkWVfCXaIbSqe8EUzdsQCCBWW7qnfaYqu9ehfHYzeR6rvPN1dVzE0U5nJbfdbhjQ++ZbYGKnd7r3fupIjfEQz4cZ1JOqUrT+dmPuKNMWVPO7EeluKB6WPe3t3wEu8ksFbSqtJ38To+Zo6posYyCCewPDpLQTg5WWjPUGeWkOeMCa9Jsrmrx5L75BraQPo2FvclnIkmTcWoNLV6FXtjZBmo8Bv3Qa9DiOtk0V7mXqEZ9uDI0qbB/37WixERh6Q6C0Fymia9fIXVgO2OhNq28vWDA80l2QBJKNgsJbXCloppWf7/pLAoDOegPHVEbsOegMc27yuT6QyLFr51kt4SEAE5nvOj+W7/SuYDpi1lWP+a2qMU3ExxL6xXK/VThMdSHXs8zXj1R46mX5mVG5t2TsT+EJg7nsHzRot8KVUHGAfIkuQROf8HsdT6PDBf6yqOAz7GWRKWyg5miUM/ZsA/9/zINnVl7Ol/VwxHLu1oCjEZicNoqTcmG7FKllwgKw5a4fX34U+QF27G272MYJkZxwWs0FeouFdOjz8qMYHaIoOHNuWL/netrDDXfN5qqXbrWGy/+reGU+zdko9ISB/IMaWQhjHsdTvKlzY1ky4bcMMhHmkCPV5z4bMZcp14T7F/s7Pvl99FM1c/Xov0mhV1oByr3RqxFsRbyFp65pxir3RM0TxNHEq2DZrmOpI7qj4XsBRIIGHASIZ4pOXm65PhQJzXntzrmnrd35bmj0+a7uLMjhwInh8KQUyAOzwzCwafR55JIYeJEIzecti9eQuudES3QD7tF5Dd/+ayHKzrLyXquy1bbZviTZ/uIcMV8hvn0tca0RKdk/0h/6FcWhuwocDdlOFXItpj2Ntv62U+7bmlVbekT2e1fOcx828x3zBznY7szfcZkV2gN61h9vK+OSW/pddCRQk6moamhrt2up4ns+1kwxVqhwXNXMbKF8vpCLL6oVr+Udpsw73EkJq16U+A3VWINwXehcSfsT9X3t1RXtH2qTgx9w49YW6CMDctbNTVJDXrlPZJ7QLT3yzPiwauxXyyXt1dPCq1g/rX/U82+fs+6pLZOhzhIdoRbtB0DhrqOyv8q8samesdTYpaXAp9LhqB1xybwDehXflfJphu1WGCgFMRB4cR6bnCDhhkGVADQG7/J58bXMcspyXA6kfBo8NMP+/FiGO/afvIB9+VjTdr0P39Bq8+tcdfM53bZYzCgNDctmXHdt4NYrfu3LxCCb+24Ci53vjefPddl3n9gVmCgsa/VtdrKaSqVaQAO7PPK4umaqB4w9pwsdxCitL1k8pfxqi42eXPhfL4Sh6JCHKh/FJKxmFm7nBVrGmPWhzOFdZMCZf03X4pEfuyrhlwtwiyngUxkMUfhKZjGzgBH1BzIxjLAph7T0GnaiH4i+WyYHo/IwtECLnVGh91C2hN22PYbyXS9ceQ2DoknCnLo3q1Nu4eboz3ZYXT4Rw/OMtl7Sq+jR1TqiG0VADt7OmZdW2+0u19CGmHGxSfLCeTn00qckRSyN2V59RT5G+VZfE4yDwlk4pm/K/3fHaUM9yQLWYPjs1y0b8p/qnV57cD6VNatt8MtPRAT47QcJv+HDkj0orM0oyvA6uWKdxOAbk3PnipTc//Pn6kAFJzY2VXv/n/nwEF5jEts94SKTS+ho/+fIrujv+fhHIZyoKoTLz+N0R1VY3RyOvM/QgIOgPg8MX7kizDedrom9sjAvZFe9ovdIfxhjXWKESNGDP+WAyTshjF/5t73wzPDPz6baQMWWTmBX2TpRoaXhsEGsDDuHbrDz18r58DkFenQfQ4Is5aVrLEqAW/9w+KV/Gn2UrcuD4tVtGA5xaNokiYFW4nPa9B1EUDkz847IefnMr//YS4zZGtHeDt1RMnfcKrcdsThRBVEXWB6w7NGheVOndLyWYMuXRdUQcCJHbHb+4X89RHV7TSgK55hnfuxpcps84oYfNm8KJnRfgBZncR99c0U4fi6N9cIGON2oCMcoHXmwZdnZ86+eTzzvUU3c+s/7WjRehBFcr4VujWd+d0P8h4I3NqR3EOMafhrTqXXD6CwwuIMbQhR+6RBYbm7rbR4v7FZucPnX29ouWhIntg667i/R0zrdr1Dfd3bHAYHAxz0lzmIxOnG7189JW2TmvTtokq5J01B20FPf/sKTJ69G40oVJVIay+9/LN2ttPrWjD5TfxH/E1ZcY8Pva06FVTQIhQzGrIG9iPI4cDrBfXhfD+RT+VuyMc+Aj+xD/fKgYkFR2BhvEiJAGmmGqLj73WGR7SH1QeWP3J+RJlyOUIx+vPD6o52uqL3HzTVYD3KoijLZXrp/9mWGCYidPmT3a1oe4ZQ69ENeFk/9blGwmDkuXNIxRHzij0Xab0TGUQBJ8G8Y77tTvDWXOYP32ux4PPby7qnDUrLbfUFW6uu4Vmj0lVeC1AJv2z5b6lHWfZEpyt79kK1VDLNkXSQoK10OrSlk1gdB5hQ0Pbezan3B35feHPs/b7LA0iWlD1cjrsvKpdOz7ZK2uGpyixGal0HevGnZLBo+Gn5MOh0G/u+SHfBSn5tDyWvrB+SxR1NzakmokkM3TGiy3r0evStyz3KxktfFXWeelVUt2YmuGBXtinRcTpTiGVIAoddD2H3BO10xmtZ1PZimfLaL0Jg6R8yw5t5BJiQbWARAoYPrlg2//zTwLPt26Vsw3KuTLaUm2Movb39bKDjJ/NmoCfY21wXH8KS/p285R+7TVws8R2fL4yg0Y1rvOpwrXs/2qfXe9A+46BDxkfwSO99cUen7ucOr7vN0b69PoMP/IcuPrX2oR3WD1530xk/3mu2YpUd/tylLchFF2z0KHF8vQLH/ESpbb4FXh89TTqKSM6Nzv7/2BWdncI5ivgg6Zkv5UCrnxP6Q3Pp2WP0KPoPwR9E0xOZ25ZSQM/3hQk+CngZRcJ1B53EBQnxPRE4/5cfhrudD+oagidehKVxG6JT8dkWW4RlO8NrcjZ7eBTJb4PAr9K5zwSHGXjqxl8gcgcqONhqJXzAB29dYKewvxJsiYzhFMUQSMIoJObAQkIIt6ty+WhmQvuhemLmkPbVar9dAIWsiz8xXNiMR8nhZxbSndmOdJtu/z2CABgGmpiELwoEj934i2J/p6ep9Jjpw2QqJcW+LHWxjcvlduXjh7O5ctr8AIMLK/Un4NBLYW7UWvU7aLFsN6O2yznXC+KXIa4ehhYy5hP1deQnZ7AXiQ1BZAo0q45eWNiER8rhuYjoPB7AT6zUPt86vjffd9rZIYMsSmk+Ak4d5GvQCFaE8+ISsDBuBDqEw5gqVHnrY32N6erlarPHbYbRklYBcrtKjLjQWs4v0hchz8vlqMutfLY3QwfiBtgjLlZ4sP/zDpXZwgWVuf1p6s/oCJYQaJUH0AuRF6JQSEi2R7ygQ4y4LKhAXOoQCRJyPNFxUdhL85EumExxNbkrBPgf1D9pqzZbu1Rj+kSvL1eh4ExPh8ANYGFcWnT2QrLUaOIoT89HXZbLkef1RUX81nLEBXEVcrtNAEQHx7/tUJosnKu1+PRUP2MhsbWO8uQMtrDfjBJfAZ9r5HC5HflY8798YZDOS5Pwf/QXj7pRalXnUCCkkD3YPWh/nf16A1PTlZoBpTgnRA08vhtAwVIz7oLILflGSnVRWFeOComvictvWFC1vNx3FJ6lTitreKKsfX3hvPS/Dr2+TI1EZIfvW1+u7dSc+4jWWsrTs1BLsmrkhp5XxG8rQ24KRKjltnyQcXZ4A1gYN7Te0YOXNCrhHIt9of3m5juahq4qkgqRrgPD7A02sH7M3lwCJel9XcRyP4MPAUWnAGTXC5+Pv39hvt+5HEOv6NtznLdXKfePARd/4x/lR99zy+BPBxEzX1KfhJb1nnaRujpRSqS9qYy8EQp7tu5X1VtpYxETW5aSWI76YOP/OSLMTa1MRlQzdoHtwV4EDm4IzVbbSOfi2MAXHVa1fE5l9k32jwq7RIhLFScR211ioaOvOjg7BizB0rpzINW3+tohig/xqQ5wzfgG0cH13ZR6xyXkvL7kde2JT/xxH2YvLdh5UYd5hc55P/9/y+/jSco0lBh3CbgdFK2libROuXNBB7PraYVVLQWIRBKOvH8rtO/IqV4Jp7T7ArlaNAovrHEljAeX8vPKCuuzkSkMTN6BmcC+I129ovyK/ptZYIOiqNi4zlErb7JE8zVy5RLfz6HTZPXOoKR063pJ/dT0lLiluVQ40KXVzGWji9EJ4rSixnaJoLueTwL+hezBtMFp640AbDIctQ9F8evbQlof6Rrrbwau9ovwxTa9Q6OkfJsNucOb7CVH15ihbZU+P1Q2DMVorSwZi5Mch9cVGzby4v9K9jzjp29W1XJDTh5v55D4h8PD+YdzScfbTwaZgleHNtg3fuj150HueeSmeeRC7vnxfui90VlyMOACYe80fuVecOIfrxFvz/7j/3qU6L7a1TZFecn/eA4d9h5M+cej+CnfGfkwXu/80wIXPBI47ZwZ5EQLmgkec8F0/gmp5+tA82ihseV5LIXQFQxjh8CQXXGUtucPxst0G1XvTfzlk4FrDYLmBkERrbEZU3+Bvif8jF85ww6FPUT0Zh3aKARWWRRz9/8m+6n3utemhQ+dXamII0Yi7IGyITAmwDZ3GtUR4ORpWzUNbHTaXcAYdy02flOB0Q/FlVck1ZVXPxSNqg1qXutxlIhMRlW3QnlqkFzVyDwSUc444hxg3/u8ueaXktLqnxsb5VT5MRpVtvdwtva9Tx7M0tByefLrK7fMJfDdDdn/uxq7R4r1eagpHhu62VIjKGnhw5eL8k/Mt/AB9X3AbtgG9jRM22ncCW/AGCV6OB6dKqgPA/+t8aAooSPVXSvzOpJwUJtgdD8lA5sOl/nAvwnVBBEeTh/soLz6KAPHNeU4z5vVyR/er2mvPJctMewVLLjv59crSnNrccc0JiTnWZO0GCY1PteDau1WPW0VkRmeMntUJ69viPQd7g3tBTonwzfrtdTXQxdp32xOTX27WUv7dSiktcUMU+V9bUSby3VEO/OWl5Z2ou12bY3RCIKeFCzp4j+/fG2KbO7BfgTFzT+6khnljfEyBCFdqEgm0eRwmJx6rl56670Kne5ehfhiVcax/q4rWj2Cabf8PyBz6n5VUL9qXrVrgaTyWuJo7E4opQqfQZINIE5Kp6RZ9SnpQjwGWl6dnIGrj6NyTdHvmIm1q88LtPrbJ0s3+cr6ZaGPHduhYQPyNFum3fmiAlRHnAm6biX6Ee8lMrWrnFZF5AB02CawMIJQJ+1DXu2aufC8RSq+SJ6IZbZSiKfYHEpfZyYb0Ra6uuqS9WrvtCB6zeqJPhLPW0hXNSA3yzrUL16ogc4pZwvWP5K978ENTGS78d0yleJGgWJ1n/iCK0evEVdO6rL+ucJTnKQ3R+DVjxTKTzr1tZ++augzMDsYlN6cbFJPWxYTLoZksSIlqfSM3g4WuB3M9bb7Z/r2ajDNB2xz6vuSr74oZWNHtaVkB6syd9WWpLJq7T5Pp73Pk6xVStRbJe5WJAftJvwoW1p38Uv+6cmCDihBTKRQlF1oFrsLTVFSiHhxF7RgmyhNQQqxWFi5LDmDLEs2zA9nuLA2BaxxUt0oUKzvk1w6kK/XSiondPR/VTz5SXpTJEH9RKn8pEOv+PzThn7TbPAOvO9stuODm5ioNuO7ZeXb8KrYLFaUJC2T3NPOYjHb6ZReVjapR58F+vxmjVLar0NC+1r+ZlPm9aBdSyvB9nK9kg4DW2intlylfPBqdGDU+a3vfHgu0+XKcgslX/KCTjHZPeGlfUrAFqu8jnmyMmC9fl6Us6U9YUx20Kmiz6tzubJcaa9/BtwzJ8FDxa5S5ayeWz8H7uukvX4ZME/WMS9ljljdV3oqnPie8r6UcApl/p/9czonp0rlkeCZkwHv9ZfmykAuV/J5kaw/AKfCvGPQ6+DcOgAwp1NPyirPi/KJba1SeupH4xO/u+EhKHZ2RgItPIIUlxDNzSqPh4V8Bn0fMkXkKPvRpxkFjL5JWoVgLDOrkwGPFtHzBoM/yoZhxIh0RIXiOJkxgdY0YndqFntglzPL7yajCR/gwd1PwO3X98DD11nfJRAI8To2IQEvxRtgt/gRX382zTLVGN8XIuA9CY/Lb06g3LVt9ukpyIQHpQYyZFlIaGF5PDypLBJVZEHeNldIlq+wJHXbhSWrldKSeU7ibwS0bxHDNuu++AH6hmybfE4X0ODBItaAgHIr4mEyushclktWVtbscEtWOkID8SjfYjp24xMYqI8t8D57Iq1QhMHIlnFDAkoSplsHcayIoK0uK5/XXQE/HKCfK4+MtlcfTMKcpOCHljEyMSaVO/6i/or8Meg9ANjw9oFPAWv/pwNAduCDt3cOV9DhC9s5eP4HLjVV/yJL+u231ZkfPZFmfP09Xv74QVz9e5+WePaXujyFrzWViSFSb1Z6m9XIbo5Qt6Zlvmxr4D+6IKvmqBFTNtThU8lpDGg6vsDz4YSc/PX01v/LHlmwL754K8/r3Pk8ryvX3bkXSP2e1X7vhuiNnf6TrmfReRJ83JCkJqlBEpdFFlGPt1JZUWMn88EtR66xzxFhjHl1xvU0y/V08r4zFfmzRPYTJ1z7mAf6wCsn+bPc8bnsz3Q67W989hlbXvucPTHLWptYn0/MlbllYzVXlZWPVBoWuSqvqb4uFz/SqC6DXFf6vHZMq711X1q7Z1K5pFZJ795FquVN8K504x9/66/27n3ginT1svzDoBsAh+LXgHX3r7cEO92z87M2va+mZ6eB/Yu1c0d9+tDQbgBQ03cJgDqkBrHYiX30Lhqti86gdRoOwU4aggx6jTE/sDE7czyuJSsO4+x9UNoCvva4S9zVtzhwsAvaTk8t4E1H4bMw9kHzs0awtOPO9+BXcXB+jzLJ5KPr96nZHow1cRUsNFrVba4+oJZ4lIJfL/OC3nuGJkOCZi0vESAV3Jy9GXdq5MYIgI4KYrQJoiqmJMaoxSKR4bslA6i1obnZOSMlHo+Pj8Pj4uNxuDiN4ePefnHiEgCP2W8CDgfuw2dWZpJM8fmuh/q/nf0E0+dMasmnG9IwGOlxEhL/1iEFyciaNJFRTuvapcbVQnFp7M8DErEZgA3iV5Mcz5yALwHDVhR46EgQLKTqaZj4Vhx89cs3jv1vwHm9XbLt3HyFW9cURKkOXDV12ibbLEjlVRBziYDsP+61aMkvS5ra7ya2PSQ2it5E01u6eFNv+A6LN/ERfoyfeVNBKQqzjBojc2SEaaypUWy4hGukKjBKGHO1ym5JJLdkMsEyWSa9LTA+6N+cz/03d9e/za57ffF+cZjEpAQyKdj/GmPErSIysvJAxRVg+KpGdO26qLp4iV7ZZ89ZcUivz6Wiq5Go6nQ0SlKNRFPFbAfMih2ndMBAL66+LhZdm24ccZE8eiRxGRkRDCwYadRiw4u1T7MnJrKf1tYqJi6FasWSAU/Y8Zx+RnY/Kyd7oJ+Zw+pjMgdyjNnf1851OoYSFUWJgWiQEs0gNdqCkBh+klCjwJYGWlMiSUjO5XHPhlGsiFb5Nt96msOzsJlZPHjSaIA3tpLVGYyLrXblp8CEzHCDyFrzIxmtwxRB4qiR/AuUfTk21wjWJQkpiZxk8LZRcbGMd0Wj5V29WKpQXCgtuqrVXDCGkrdT+ARIHZEYoy0lUsglpiURa8zlA6m0MJ45deRDqfBxY4PQ+KFs5IJtsRcIF/+3B/AOrxxLz29x4YwGuzKL+RU5QhIxPiodFbPfbeJtBBdSlXw8XsDFIsz80hJgQmL73UnDxOpYSG9fkA8nm8fjlNDSY6Mw6Bg/t6nUADYvWph4IrGCh0q1CHidjPfMimbnNS9i7PW9DFd4RlqwF+LSbc+JX0Pdj5NTgzyRL/4G3nFLYYsDVh+o+x/Ugj0FdbUUu7d//u4Vl5OCQNFT4gyV55o6+zbqi32c0mKx3OyMpP6KPZt5wGOiJn/kGLvYBLFysCQ6nZB//GgU/zgLV4vDFyRHhtMS4Mj8OI9pgGCW9Cex8zqTiUWpcC6TbGPJtxPm4RGs0vFkUAi1MM5CLYxgdEFY2Nik9W7P6Lgc8MscA9CJ1IijmJij0W+jzpQPy0Wy09ocf28Sozozt0Rsg2wE7VYUbQQhEzNRTPKOTCQmREBQcDxVSY2Hp0DC6qNCs/yjB5MzsjUxOFrliaTCeCQ652MbmjWZRyiY1wKmXAMLL9mF3c6xfdDwT+ZECKEvDEjWT+TWkdOayQQyrKmOzOaoyalNZAI5rVlNZtfhjhfDCGlJJQQstCSNAEspToW9IN25GjJ0yom9vJkW59br8ya8e8UfWIh/Vt8k/cPo+cWj9pB2EKTz8Ue6vkQ7HdJ4KE0ZhCpSYKpbZ7qb22lMrWkOWQgy9dvPJiKR8T3fupOa4ridfrI92SrY1ECCyVZkh776MlZ6AZlF5hrfI2sWjgKDWpA2T9617BKc2t+9s18AgOEZf3b6bzBvT2/v0x6TU3UkYKjLYK/OGhAGOO5FuSxyAZmVXrbTSHaIiRBTAwlZ57Zvqg+oK9acjA74hYul1wMJFBCysVgSn9R+V8C6xPd4bQPgakuRcA56elaDdnTlaMwMwS/B71NIDdtQ/GGAqpeO7O3tXdXV1WGy+lwSmJyqMQnVgGRHJ91nycfRarRSVlY0fdi0AoFb1QrM8ziKkrRuJ8RqRsF3X8WVKJxV3zmoBhy37Oy4axG4xlfd/Zy2MRYuUQhElEpwB/ygEE/VNsCxyiUmfWmJTofHQBiMjipLDvZVma4afWsz/9rGev2nJeDkPIWuhiGFyM0rsBg6XUIQOIWSoCJ2SUAgaHSsKnJP08HgWIkkfsHffz6e7PlFbmRmnhkTl0GvyKgBTgcsvJxCRItAkpaeTswoEsFAPetReD4TDRrDNQzoF481DHApjM9ImmSXMEDUmUGLwSdbOfkOkukZT9a/N/LTauQNvjwJboHb08yo9u/fnjtHo1AzA9Nscx2HjPc8UXJl9p2HvdHctM6Nz3LM/V2YH2v/+wDDtr+/gvanaTc46//u+jxqQMxvkjCKGdWCahbq6/t05iaegstkXLMQO7zPMXeE9H8byqzzuZgksy9rmL6+T0dvlsoxP3zqzcdmu8fIDVuuvo3m/qvfYK7Uv5fVYfBqYj2cnolA6E8aeD0Rp6rDAufCn/cFNE1cddZL9CmEwwlW2FkQY/5nsKu/+neOixq4Ul+8Y5Ghk3qnd684AcsNL6jFNma0VWsxFidPXZmLAyvzVyQ1BqskqBGtXhvILZhDqHDz2BdW7vvb+G36su7Lut9z/TMtMbSvXldfmPfWaOvnTMmpK/v8E8VOZed8sn0+51HQ9b7Yd2MnOR/z3j+w58BX+3/IoRAAO59iEitcVC0X8uPm7nIp92SqrgDcxHfMDZ+cCUOtXjLZbwKX1tnzyT62GH+p4sJX4ObZ9qSv4xD3RBkg4T5d4SK2I79ugd9Clebf5uOGnlSJd3NCDrnBnNxK1DwwSp0Panb9FCHiAyFt7zMrnz/wxoUV8in9WxW9w+yer2w3zzt6oXmo9fNCopDmQYUl1cmDJSl8iVGlfq/PpZ65frMSLsQ74lZGFt3Z1ZvwuQAh+gy1aXSMuE+rUUGrUYdY7wPlgXqKBY9iURUn2X/QLvN0nb7R9v13d+ZW947cWcfd2TvdOXe5f9zFc9dUto7RNDzCZNdfAA4ksdsNvZ1zlA3UqqCjbgQhHC/Bcv0gyO7qNe4bJ+M1/wMTYjvZJFwE0iFqR837ZbM1qwMydRMW3VrQ/eIX98A/7pd/o1foNXoDb9uxfVMEHh1T/614MdoqBsZQxcvxvvRV6Wt4A0fg7VwlWIZnIJCvC0fV6AaqQbVQl7oH6gH0VEazTUAaaFm6PdAK4AgHjwGwPS4sAHpU8SgF6oAONeHQIzlIJMf4FNQoFhQnhqqsBVBHJ9D/dIzQcwZKeyRbMaYYudwJ1Bfv63AoM/hr/pcyJwkKIJy0xECGBMDxqQzCSSFFGYRTBZw5Zgmzj3BvQeqjzaY6Vpl6RtSikhXp3dsaK8gK7/CBReAbkI5162GD0bCFHcQYAwnGwh7jMD6YMIUqb3tl+t+aE/busWAUrq7W1sHA1sKA1/eEPzCDN7ZxdI/mPuB3g6vm3xr2kFvk1lJbnsb5rUNpOS//w5zDJiFrzzdbx8gXmEJqTqW8PGakKnB1Sq7pT7lFbi21FTto1Ik85HTUr3wD0RAnG6o1xuWhPrYK1WE0uIZCbpFbS20qqUgwvMjv1I6bIVGnUoecgKkZTxhwsqPuc4HCXGLnqYXeC0LBnAQ+hxadFvlkgZf6wM1Lc4nbJMU5kuIylM8POg0U8UeV1tGsmMKp2i5qKsOhVpGbhaaCPPun9hJvqeCwlUptK3x6Dcah9fGhxvFE7JhJUlPpOPgOX8RRRxis6JmV+iNGoelGCrlFbi21qb2RCnHo76hfPio8sGr4P6T57uY4jsVMRHx23JZRgzUB13RXbpFbS20qwsM6Xgx3alUYEnXdVyEnmPi4+ZTd3rFpY2lj7oEQv8i9z1NEXfWLThM2edFveqDMbZrrE639MRnlkk3x3uoMJEE5AqT2j4lZ62/fzLr6p8C81vqy4HfuA2zDhzb8f5cRtn3eo74D0+4pgx5Df/U78qK6NXzujD77uLsAAPgAzLJLl6UJ43NgqGGUi+L46lAB9MKeDaw+/WsEyDonxlFMRpBYw/Vp/WFqESb0ElD2G58aUYmSpB21UPgAXilVD9if7YH78aKtaV31rIgKEZSUFOkn4hdbHpFjHT2ggCW1i4pnArh1KcPFgMwZWYPhPYAhvBSSwfldcxG/Ft1iRzqIKUTb/mriq0dz8uh67aH9UFuTh5FerrO0h2S3pHbROqXLaOESzP5rATq5Og73GxWCZ8BTVS2X+VbAEX6sB1WQAUf5Eaq46ZfI14CDtFLYH6J0UDjj4uKieGHjVTKvYX2Qi+uOgtLYPmMPJ45gcTVKylMIY/NDSNJsbuxdMZIaJGd3qQVSUb/2ox43JSWSOoPEpWmP0VnnFFREKyMu3EbhcTESCyTP/FGQDb2BI1GYw+Yhi+RnfLU9qaW5DNQREpemPeqyLiJUwaYz0sztMD8z701u81ryvBKp627lK0fSLYddwT0MKslDnjYq8zaPCIIp9IECtoMRFOqDKjwZXNnLp/9mUZhFFtsPwMgAvCUYwNPOiTPaOq6Bajlpm7e0bc4aUE4r2/WHsWgQVVEZFyfNkdI2XyM5c0a/Xkw0hVodf4IJsg1W0qLwMvAWfn04+qIuGyPiNgY15S7aME9WbqLltbbnFRq6cONfKU+3/O4KFgOs2GoBQoju/2qfUSH9/LsiDpv02jv9e2bh8iXQbplG+pDjix3f8KKR9aOsaRixW72GlRep9dtRamP7gCd1ugYkvWtAnDHBSiowqCu1EeE+lGqCr6yvG9sRAkxcta2rwHzwN+Jc2TpfzdSTx1Jccc3QpfyyV4WT0sJqW6JIkDySVE1P4oqPIs5P7yLSFjmAFRLkWK9NFFWL0s7sU9XREg/JewxxxZW52CV/AqJb1kKVGlRH9q+2tfbos2SuUz9vWeslKZjqV62qygIJwnlReMQk0gnHzEMnU/LPso2MnLXQWFe1MnLJMV0KMLfyaD/R1rko/ywfhdM6ANLCW0MALDgCqlZ2KMOQLcMJd8GyJZETDmtBOTWXbnMJEyPaFa0+2E9Q6iPbJfwI6FETMVeMwIqjgeIgEq4qI5JyZqR9C2vpfiEA0DDn7sU3x+WS039NFAcAAHQ3HTMQt3Hk5Dqczr3HAFBAAAAAAV4vGbS4clx/zAIwfxXho/rPgu7G5+acHzbi6ajcifIV3UOlFn7dh6+tQ6jSAc6vsQHjLVWrX4h2xIi0Jzj9OGqwd5YYZci2IFJy+LLanlS7EOmPqIjGCH2JNKY6kYTeWBxQKos1obkScR2lqDhIPOjGcSYlPyPUQEm9QWnoyYQioe8i9PcCrvl0CCtaxXBOMkrV228ivksoWHgjvihb3FTkGkSVpQjD0BtcrH5jcdlIRz4BCmf2pmHuTWRZRIVOC0kT3cvDF4tYf5FoHihrNhHqpVjv2WFXtqmeHH1Gqb1E6gOU0mwvChR6oRYOQwZchiNQBUc9R9IBefVCj7wkGEDhD5HusbdlmmGvCSIX9VAH7aBCt1XwI/4EstpxLx0A2hDjSHwu4eQLZEmIJzZf8xQioM+zvRIoPMfbZzVK8zLZFHs3sS378MjTwyLOqLdva1VSKADgAACdM6BOJyJOCk8s2qr27gFBVQaRgy08Xm2M/Bv15jInGp5gnSbaE+zFVMJb6IPbpVrQ9LbcNlRPlQPUXUJEINnO/sMfRvQMpqJ+J7d+Y251ESQticpHmUlE1X4U9Qtxsf8vyNEszvdyd0wgusaydtxn8djE4smH6PkMXR6iQu75YVWP0FracwLHAagA4DAA7QD0pT/wYXXsMhr3qqOX8xLXzgHnwO4IGzG99QigUWTdPdW9CAFUFyghFlx8x2mxKoFFNxBSCXi3u5fmIjA8oLVF29BaI+hBLo61OskK0+5tHFa07RUabIPdDdKO4laRD0H2Ufll8RM4x1qjFA2FtE2RLdBNm2JcN/WLQG/ZZkU7qkpa1xpIPaQt0Rf2LiURVuUDUSK6xJWiiFgtjwQtFj5643D5pfXNQ4B/tAZXJAaatdc5+w6v+1lgBACFYFwFcRWuQvAVr0LxUrEKzUbnKgypoZVZbApaByLwmrOKb1YRVpkap1ju75cm3v3ZcVM2VxKFDMkSxImXSsKbl4mk5GENxCQWSpQKnhx5cDaSbEwiytGYLc14fGskS6llJ/FGKkVY0I8nT3ESrAOnieQhSpLNPB2NzVIQSGDOdw7CQ/KNxUkjt0EyHx68YuLTukaoJZo/jQq4u3YWtUnECiRSJEjyu0hYWZRxd9IFd+UpongkbAaZulJM2hJLKaRWPIoJOYnQ0lEpxkQ+xoqFUolVhKQgvEEu6PyKRj7I1/5a/9/9Dd0GAA==) format("woff2");
          font-weight: 400; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: "ARTIUS";
          src: url(data:font/woff2;base64,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) format("woff2");
          font-weight: 500 900; font-style: normal; font-display: swap;
        }
        :root, body, input, select, textarea, button, optgroup {
          font-family: "ARTIUS", system-ui, "Segoe UI", Roboto, Arial, sans-serif;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1;
        }
        /* font-mono nay chỉ còn nhiệm vụ giãn chữ cho cột số dễ đọc, không đổi mặt chữ nữa */
        .font-mono, code, kbd, pre, samp { font-family: inherit; letter-spacing: 0.02em; }

        /* Ẩn mũi tên tăng/giảm của ô nhập số — gõ thẳng con số, không bấm mũi tên */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
      `}</style>
      {me && (
        <nav className="hidden w-24 shrink-0 flex-col items-center border-r border-slate-800 bg-slate-950 py-4 md:flex">
          <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 font-mono text-xs text-teal-400">AR</div>
          <div className="flex w-full flex-1 flex-col gap-1 px-2">
            {railItems.map(([k, label, Icon]) => (
              <button key={k} onClick={() => go(k)}
                className={`relative flex w-full flex-col items-center gap-1 rounded-lg py-2 ${tab === k ? "bg-slate-800 text-teal-400" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}>
                <Icon size={18} />
                {/* nhãn ngắn để không xuống dòng ở bề rộng 96px */}
                <span className="w-full truncate px-1 text-center text-[10px] leading-none">{label}</span>
                {tab === k && <span className="absolute -left-2 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-teal-400" />}
              </button>
            ))}
          </div>
          <button onClick={signOut} className="mt-2 flex w-[calc(100%-1rem)] flex-col items-center gap-1 rounded-lg py-2 text-slate-500 hover:bg-slate-900 hover:text-rose-400">
            <LogOut size={18} />
            <span className="text-[10px] leading-none">Thoát</span>
          </button>
        </nav>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 md:px-6 md:py-3.5">
          <div className="flex min-w-0 flex-col md:flex-row md:items-baseline md:gap-3">
            <span className="font-mono text-sm tracking-[0.3em] text-slate-100">ARTIUS</span>
            <span className="truncate text-xs text-slate-500">{me ? pageTitle : "Quản lý giờ công dự án"}</span>
          </div>
          {me && <span className="ml-3 shrink-0 truncate text-xs text-slate-400">{myEmp?.name || who.username}</span>}
        </header>

        <main className="min-w-0 flex-1 px-3 pb-28 pt-4 md:px-6 md:pb-24 md:pt-5">
          <ConfirmDialog
            open={pendingTab !== null}
            title="Rời khỏi bảng công khi chưa lưu?"
            desc="Giờ bạn vừa nhập sẽ mất. Bấm Giữ lại để quay về bảng công và bấm Lưu trước."
            confirmLabel="Rời đi, bỏ thay đổi"
            onConfirm={() => { setSheetDirty(false); setTab(pendingTab); setPendingTab(null); }}
            onCancel={() => setPendingTab(null)}
          />
          <StorageBanner />

          {!who ? <SignIn onSignedIn={enter} flash={flash} />
            : !me ? (
              <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 md:mt-10 md:p-6">
                <div className="flex items-center gap-2 text-sm text-rose-300"><AlertTriangle size={16} className="shrink-0" />
                  {orphan ? "Tài khoản này chưa gắn với nhân sự nào." : "Không tải được dữ liệu."}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {loadFailed ? <button onClick={() => enter(who)} className={btnPrimary}><RotateCcw size={14} /> Thử lại</button> : <span />}
                  <button onClick={signOut} className={btnGhost}><LogOut size={14} /> Đăng xuất</button>
                </div>
              </div>
            )
            : me.type === "admin" ? (
              <>
                {tab === "dash" && <Dashboard cfg={cfg} flash={flash} />}
                {tab === "sheet" && <AdminTimesheet cfg={cfg} flash={flash} onDirtyChange={setSheetDirty} />}
                {tab === "proj" && <Projects cfg={cfg} saveCfg={saveCfg} flash={flash} />}
                {tab === "emp" && <Employees cfg={cfg} saveCfg={saveCfg} flash={flash} />}
                {tab === "task" && <Tasks cfg={cfg} saveCfg={saveCfg} flash={flash} />}
                {tab === "set" && <SettingsTab cfg={cfg} saveCfg={saveCfg} flash={flash} />}
              </>
            ) : (
              <>
                {tab === "ts" && <EmployeeArea cfg={cfg} empId={me.empId} flash={flash} onDirtyChange={setSheetDirty} />}
                {tab === "edash" && <EmployeeDashboard cfg={cfg} empId={me.empId} />}
                {tab === "eset" && <EmployeeSettings cfg={cfg} empId={me.empId} />}
              </>
            )}
        </main>
      </div>

      {me && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-800 bg-slate-950 md:hidden">
          {railItems.map(([k, label, Icon]) => (
            <button key={k} onClick={() => go(k)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 ${tab === k ? "text-teal-400" : "text-slate-500"}`}>
              <Icon size={19} /><span className="text-[10px] leading-none">{label}</span>
            </button>
          ))}
          <button onClick={signOut} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-slate-500">
            <LogOut size={19} /><span className="text-[10px] leading-none">Thoát</span>
          </button>
        </nav>
      )}

      {/* Ghi chú phiên bản: góc trái dưới cùng; trên mobile nâng lên trên thanh điều hướng dưới */}
      <div className={`pointer-events-none fixed left-2 z-30 select-none font-mono text-[10px] text-slate-600 ${me ? "bottom-14" : "bottom-1.5"} md:bottom-1.5`}>
        ARTIUS {APP_VERSION}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 w-max max-w-[92vw] -translate-x-1/2 md:bottom-6">
          <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white shadow-xl ${toast.kind === "err" ? "bg-rose-600" : "bg-teal-600"}`}>
            {toast.kind === "err" ? <AlertTriangle size={15} className="shrink-0" /> : <CheckCircle2 size={15} className="shrink-0" />}{toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

/* Cảnh báo về sức khoẻ lưu trữ: sắp chạm hạn mức lệnh, hoặc đã chạm và cần tải lại trang */
function StorageBanner() {
  const { limited, calls } = useStorageHealth();

  if (!STORAGE_OK) return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100 md:mb-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
      <div><b>Không truy cập được bộ nhớ lưu trữ.</b> Mọi thứ bạn nhập sẽ mất khi tải lại trang. Thử mở app ở tab trình duyệt thường và bật cookie cho trang này.</div>
    </div>
  );

  if (limited) return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100 md:mb-4">
      <AlertTriangle size={18} className="shrink-0 text-rose-400" />
      <div className="min-w-0 flex-1">
        <b>Đã chạm hạn mức lệnh của phiên làm việc.</b> Không lưu được nữa cho tới khi tải lại trang.
        Nếu đang có giờ chưa lưu, chụp màn hình lại trước khi tải lại.
      </div>
      <button onClick={() => window.location.reload()} className={`shrink-0 ${btnDanger}`}>
        <RotateCcw size={14} /> Tải lại trang
      </button>
    </div>
  );

  if (dbSize() > DB_LIMIT) return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-900 bg-amber-950 p-3 text-sm text-amber-100 md:mb-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
      <div>Dữ liệu đã lớn ({(dbSize() / 1_000_000).toFixed(1)} MB) và đang tiến gần giới hạn một khoá lưu trữ. Xuất file sao lưu rồi xoá dữ liệu chấm công của các năm cũ.</div>
    </div>
  );

  if (calls >= 45) return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-900 bg-amber-950 p-3 text-sm text-amber-100 md:mb-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
      <div>Phiên này đã dùng <b>{calls}</b> lệnh lưu trữ. Sắp chạm hạn mức — lưu bảng công lại rồi tải lại trang cho chắc.</div>
    </div>
  );

  return null;
}

/* Ghi chú của một dòng — mở bằng nút "…" thay vì chiếm hẳn một cột trong bảng */
function NoteDialog({ open, title, value, readOnly, onSave, onClose }) {
  const [text, setText] = useState(value || "");
  useEffect(() => { if (open) setText(value || ""); }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-sm font-semibold text-slate-50">Mô tả thêm</h4>
        <p className="mt-0.5 truncate text-xs text-slate-500">{title}</p>
        <textarea autoFocus rows={5} value={text} readOnly={readOnly}
          onChange={(e) => setText(e.target.value)}
          placeholder="Làm gì cụ thể, vướng mắc, đầu việc phát sinh…"
          className="mt-3 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-teal-500 focus:outline-none" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className={btnGhost}>Đóng</button>
          <button onClick={() => onSave(text)} disabled={readOnly} className={`${btnPrimary} disabled:opacity-40`}><Check size={14} /> Lưu mô tả</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ SIGN IN ============================ */
function SignIn({ onSignedIn, flash }) {
  const [mode, setMode] = useState(null);       // null = đang kiểm tra | "login" | "setup" (chưa có tài khoản nào)
  const [needPin, setNeedPin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const st = await accountsApi("status");
        if (!alive) return;
        setNeedPin(!!st.needPin); setMode(st.hasAccounts ? "login" : "setup");
      } catch (e) {
        if (!alive) return;
        setMode("login"); flash(e.message, "err");
      }
    })();
    return () => { alive = false; };
  }, [flash]);

  const login = async () => {
    if (busy) return;
    if (!username.trim() || !password) return flash("Nhập tên đăng nhập và mật khẩu.", "err");
    setBusy(true);
    try { await onSignedIn(await authSignIn(username, password)); }
    catch (e) { flash(e.message, "err"); setBusy(false); }
  };

  /* Lần đầu sau khi nâng cấp: chưa có tài khoản nào, người nắm mã PIN quản lý cũ tạo tài khoản quản lý */
  const setup = async () => {
    if (busy) return;
    const u = normUsername(username);
    if (!USERNAME_RE.test(u)) return flash("Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch.", "err");
    if (password.length < PASSWORD_MIN) return flash(`Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.`, "err");
    setBusy(true);
    try {
      await accountsApi("bootstrap", { username: u, password, pin });
      await onSignedIn(await authSignIn(u, password));
    } catch (e) { flash(e.message, "err"); setBusy(false); }
  };

  const submit = mode === "setup" ? setup : login;
  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <div className="mx-auto mt-6 max-w-md md:mt-10">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 md:p-6">
        <h1 className="text-lg font-semibold text-slate-50">{mode === "setup" ? "Tạo tài khoản quản lý" : "Đăng nhập"}</h1>
        {mode === null ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} /> Đang kiểm tra…</div>
        ) : (
          <div className="mt-5 space-y-3">
            <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onEnter}
              placeholder="Tên đăng nhập" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className={inputCls} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnter}
              placeholder="Mật khẩu" autoComplete={mode === "setup" ? "new-password" : "current-password"}
              className={inputCls} />
            {mode === "setup" && needPin && (
              <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={onEnter}
                placeholder="Mã PIN quản lý hiện tại" autoComplete="off" className={`font-mono ${inputCls}`} />
            )}
            <button onClick={submit} disabled={busy} className={`w-full ${btnPrimary} disabled:opacity-50`}>
              {busy ? <Loader2 className="animate-spin" size={15} /> : <Lock size={14} />} {mode === "setup" ? "Tạo và đăng nhập" : "Đăng nhập"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ EMPLOYEE ============================ */
function EmployeeArea({ cfg, empId, flash, admin = false, onDirtyChange }) {
  const emp = cfg.employees.find((e) => e.id === empId);
  const [monday, setMonday] = useState(fmt(mondayOf(new Date())));
  const [buckets, setBuckets] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeDay, setActiveDay] = useState(fmt(new Date()));
  const [unlocked, setUnlocked] = useState(false); // tuần đã gửi: phải bấm "Mở khoá để sửa" mới chỉnh được
  const [copying, setCopying] = useState(false);
  const [savedTick, setSavedTick] = useState(0); // tăng sau mỗi lần lưu thành công, dùng làm tín hiệu làm mới lịch
  const [saveFailed, setSaveFailed] = useState(false);
  const mobileInputs = useRef([]);              // ô nhập giờ của từng dòng trên mobile
  const [noteRow, setNoteRow] = useState(null); // chỉ số dòng đang mở hộp mô tả
  const gridInputs = useRef({});                // ô nhập trên lưới desktop, khoá "dòng:cột"
  const taskSel = useRef({});                   // ô chọn hạng mục của từng dòng, để nhảy con trỏ vào sau khi bấm +
  // báo lên App để chặn đổi tab khi còn thay đổi chưa lưu
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const [undoRow, setUndoRow] = useState(null); // dòng vừa xoá, giữ lại để hoàn tác
  const [q, setQ] = useState("");               // ô thêm nhanh: chuỗi đang gõ
  const [qOpen, setQOpen] = useState(false);
  const [qIdx, setQIdx] = useState(0);          // mục đang được chọn trong danh sách gợi ý
  const [qProj, setQProj] = useState("");       // lọc theo dự án, rỗng = tất cả
  const [qPhase, setQPhase] = useState(null);   // lọc theo giai đoạn, null = để guessPhase tự đoán
  const qInput = useRef(null);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidayMap = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  const holidaySet = holidayMap; // cùng một bộ tra cứu, có sẵn cả has() lẫn get()

  const days = useMemo(() => weekDays(monday), [monday]);
  const yms = useMemo(() => [...new Set(days.map(ymOf))], [days]);
  const activeProjects = cfg.projects.filter((p) => p.active);
  // Chỉ hiện hạng mục thuộc bộ phận của nhân sự — bớt danh sách dài và tránh chấm nhầm việc của bộ phận khác
  const myTasks = useMemo(() => tasksForDept(cfg.tasks, emp?.dept, emp?.role), [cfg.tasks, emp?.dept, emp?.role]);
  const taskById = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes]);
  const projName = (id) => cfg.projects.find((p) => p.id === id)?.name || "(dự án đã xoá)";
  // Tên kèm mã, dùng ở chỗ cần nhận diện nhanh bằng mã số
  const projFull = (id) => { const p = cfg.projects.find((x) => x.id === id); return p ? `${p.code ? `[${p.code}] ` : ""}${p.name}` : "(dự án đã xoá)"; };
  const taskName = (id) => { const t = taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  useEffect(() => { if (!days.includes(activeDay)) setActiveDay(days[0]); }, [monday]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const loaded = {};
      for (const ym of yms) loaded[ym] = dbTs(empId, ym) || { rows: [], weeks: {} };
      if (!alive) return;
      setBuckets(loaded);
      const map = new Map();
      for (const ym of yms) for (const r of loaded[ym].rows) {
        // dữ liệu cũ chưa có giai đoạn: suy từ nhóm của hạng mục thay vì gán bừa một giá trị
        const phaseId = r.phaseId || guessPhase(r.taskId, cfg.tasks);
        const k = rowKey({ ...r, phaseId });
        const cur = map.get(k) || { projectId: r.projectId, phaseId, taskId: r.taskId, note: "", days: {} };
        if (r.note && !cur.note) cur.note = r.note; // ghi chú lưu theo dòng, tuần nào cũng dùng chung dòng đó
        for (const d of days) if (r.days?.[d] != null) cur.days[d] = r.days[d];
        map.set(k, cur);
      }
      setRows(sortByGroup([...map.values()].filter((r) => days.some((d) => r.days[d] > 0))));
      setDirty(false); setUnlocked(false); setLoading(false);
    })();
    return () => { alive = false; };
  }, [empId, monday]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đưa con trỏ về ô giờ đầu tiên của một dòng — dùng chung cho desktop và mobile
  const focusRow = (i, what = "hours") => {
    const el = what === "task" ? taskSel.current[i] : (gridInputs.current[`${i}:0`] || mobileInputs.current[i]);
    if (!el) return;
    el.focus(); el.select?.();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  /* Thêm một dòng từ tổ hợp dự án + giai đoạn + hạng mục.
     Nếu tổ hợp đã có thì KHÔNG tạo dòng thứ hai — vì rowKey trùng nhau sẽ bị gộp lúc tải lại,
     làm giờ công nhảy số. Thay vào đó nhảy tới đúng dòng đang có. */
  const addCombo = (c, focus = "hours") => {
    const key = rowKey({ projectId: c.projectId, phaseId: c.phaseId || DEFAULT_PHASE, taskId: c.taskId });
    const at = rows.findIndex((r) => rowKey(r) === key);
    if (at >= 0) { flash("Dòng này đã có trong tuần, con trỏ đã nhảy tới đó.", "err"); focusRow(at); return; }
    const row = { projectId: c.projectId, phaseId: c.phaseId || DEFAULT_PHASE, taskId: c.taskId, note: "", days: {} };
    // cùng dự án + giai đoạn thì chèn ngay dưới dòng cuối của nhóm đó, không đẩy xuống cuối bảng
    let last = -1;
    rows.forEach((r, k) => { if (groupKey(r) === groupKey(row)) last = k; });
    const at2 = last >= 0 ? last + 1 : rows.length;
    const next = [...rows]; next.splice(at2, 0, row);
    setRows(next);
    setDirty(true); setQ(""); setQOpen(false); setQIdx(0);
    setTimeout(() => focusRow(at2, focus), 30); // đợi React commit xong mới có ô để focus
  };

  /* Nút + ở đầu mỗi khối: thêm một hạng mục nữa vào đúng dự án + giai đoạn đó.
     Chọn sẵn hạng mục đầu tiên chưa dùng trong khối rồi đưa con trỏ vào ô chọn,
     bấm phím là đổi được ngay, không phải quay lại ô tìm kiếm. */
  const addTaskToGroup = (g) => {
    const pool = g.projectId === NO_PROJECT ? LEAVE_TASKS : myTasks;
    const used = new Set(g.items.map(({ r }) => r.taskId));
    const t = pool.find((x) => !used.has(x.id));
    if (!t) return flash("Khối này đã dùng hết hạng mục có thể chọn.", "err");
    addCombo({ projectId: g.projectId, phaseId: g.phaseId, taskId: t.id }, "task");
  };

  // Nút "Thêm dòng" nay chỉ đưa con trỏ về ô thêm nhanh; dòng được tạo từ ô đó hoặc từ chip
  const focusQuick = () => {
    if (activeProjects.length === 0) return flash("Chưa có dự án nào đang mở chấm công.", "err");
    if (myTasks.length === 0) return flash("Chưa có tác vụ nào cho bạn. Báo quản lý bổ sung trong tab Tác vụ.", "err");
    qInput.current?.focus(); setQOpen(true);
  };

  /* Tính dòng mới ngoài setRows rồi mới ghi state — không đặt side effect trong hàm cập nhật,
     vì React có thể gọi hàm đó nhiều lần và flash sẽ bắn sai. */
  const upd = (i, patch) => {
    const cur = rows[i];
    if (!cur) return;
    const next = { ...cur, ...patch };
    // dòng vắng mặt không thuộc dự án nào; chuyển ngược lại thì trả về dự án đầu tiên đang mở
    if (patch.taskId !== undefined) {
      if (isLeaveTask(next.taskId)) next.projectId = NO_PROJECT;
      else if (next.projectId === NO_PROJECT) next.projectId = activeProjects[0]?.id || "";
    }
    // sửa dropdown thành trùng một dòng khác cũng tạo rowKey trùng — chặn tại đây
    if (rows.some((y, k) => k !== i && rowKey(y) === rowKey(next))) return flash("Đã có dòng cho tổ hợp này rồi.", "err");
    setRows((r) => r.map((x, j) => (j === i ? next : x)));
    setDirty(true);
  };

  /* Chép cơ cấu dòng (dự án + hạng mục + ghi chú) của tuần liền trước sang tuần đang xem.
     Chỉ chép khung, KHÔNG chép số giờ — giờ công vẫn phải tự nhập cho đúng thực tế. */
  const copyPrevWeek = async () => {
    setCopying(true);
    const prevMonday = fmt(addDays(parseD(monday), -7));
    const prevDays = weekDays(prevMonday);
    const prevYms = [...new Set(prevDays.map(ymOf))];
    const found = new Map();
    for (const ym of prevYms) {
      const b = buckets[ym] || dbTs(empId, ym);
      if (!b?.rows) continue;
      for (const r of b.rows) {
        if (!prevDays.some((d) => r.days?.[d] > 0)) continue; // chỉ lấy dòng thực sự có giờ tuần trước
        const phaseId = r.phaseId || guessPhase(r.taskId, cfg.tasks);
        found.set(rowKey({ ...r, phaseId }), { projectId: r.projectId, phaseId, taskId: r.taskId, note: r.note || "", days: {} });
      }
    }
    setCopying(false);
    if (found.size === 0) return flash("Tuần trước chưa chấm công nên không có gì để chép.", "err");
    const have = new Set(rows.map(rowKey));
    const toAdd = [...found.entries()].filter(([k]) => !have.has(k)).map(([, v]) => v);
    if (toAdd.length === 0) return flash("Các dòng của tuần trước đều đã có trong tuần này.");
    setRows((r) => sortByGroup([...r, ...toAdd])); setDirty(true);
    flash(`Đã chép ${toAdd.length} dòng từ tuần trước. Nhập giờ rồi lưu lại.`);
  };
  const setHour = (i, d, v) => {
    const n = v === "" ? undefined : Math.max(0, Math.min(24, Number(v)));
    setRows((r) => r.map((x, j) => (j === i ? { ...x, days: { ...x.days, [d]: n } } : x)));
    setDirty(true);
  };
  const delRow = (i) => {
    setUndoRow({ row: rows[i], at: i });   // giữ lại để hoàn tác, xoá nhầm không mất công gõ lại
    setRows((r) => r.filter((_, j) => j !== i));
    mobileInputs.current = []; gridInputs.current = {}; taskSel.current = {};
    setDirty(true);
  };
  const undoDelete = () => {
    if (!undoRow) return;
    setRows((r) => { const n = [...r]; n.splice(Math.min(undoRow.at, n.length), 0, undoRow.row); return sortByGroup(n); });
    setUndoRow(null); setDirty(true);
  };

  // Mũi tên và Enter di chuyển giữa các ô giờ, gõ liền mạch không cần chuột
  const gridKey = (e, i, k) => {
    const move = (di, dk) => {
      const el = gridInputs.current[`${i + di}:${k + dk}`];
      if (!el) return;
      e.preventDefault(); el.focus(); el.select?.();
    };
    if (e.key === "ArrowLeft" && e.target.selectionStart === 0) move(0, -1);
    else if (e.key === "ArrowRight" && e.target.selectionStart === e.target.value.length) move(0, 1);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowDown" || e.key === "Enter") move(1, 0);
  };

  // Điền giờ chuẩn cho cả tuần vào một dòng, chỉ điền ô còn trống
  const fillStandard = (i) => {
    setRows((r) => r.map((x, j) => {
      if (j !== i) return x;
      const d2 = { ...x.days };
      for (const d of days) {
        if (d2[d] > 0 || holidaySet.has(d)) continue;
        const std = stdHoursFor(d, hoursCfg);
        if (std > 0) d2[d] = std;
      }
      return { ...x, days: d2 };
    }));
    setDirty(true);
  };

  /* submitMode: "submit" đánh dấu đã gửi · "unsubmit" gỡ đánh dấu (chỉ quản lý) · null giữ nguyên */
  const save = async (submitMode = null, silent = false) => {
    const seen = new Set();
    for (const r of rows) {
      const k = rowKey(r);
      if (seen.has(k)) { flash("Có 2 dòng trùng Dự án + Giai đoạn + Hạng mục. Gộp lại giúp em.", "err"); return false; }
      seen.add(k);
    }
    const totalHours = rows.reduce((s, r) => s + days.reduce((a, d) => a + (r.days[d] || 0), 0), 0);
    if (submitMode === "submit" && totalHours === 0) {
      flash("Tuần này chưa có giờ nào để gửi. Nhập giờ vào các ô ngày trước đã.", "err");
      return false;
    }

    setSaving(true);
    const next = { ...buckets };
    const failed = [];
    for (const ym of yms) {
      const bucket = next[ym] || { rows: [], weeks: {}, leave: {} };
      const daysInYm = days.filter((d) => ymOf(d) === ym);
      const keep = bucket.rows.map((r) => {
        const dd = { ...r.days }; for (const d of daysInYm) delete dd[d];
        return { ...r, days: dd };
      });
      const map = new Map(keep.map((r) => [rowKey(r), r]));
      for (const r of rows) {
        const k = rowKey(r);
        const cur = map.get(k) || { projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, days: {} };
        cur.phaseId = r.phaseId || DEFAULT_PHASE;
        cur.note = (r.note || "").trim();
        for (const d of daysInYm) if (r.days[d] > 0) cur.days[d] = r.days[d];
        map.set(k, cur);
      }
      const cleaned = [...map.values()].filter((r) => Object.values(r.days).some((v) => v > 0));
      const weeks = { ...(bucket.weeks || {}) };
      if (submitMode === "submit") weeks[monday] = { submittedAt: new Date().toISOString(), by: admin ? "admin" : "emp" };
      if (submitMode === "unsubmit") delete weeks[monday];
      next[ym] = { rows: cleaned, weeks };
    }

    // Ghi một lần cho mọi tháng liên quan, thay vì mỗi tháng một lệnh
    const ok = await commitDB((d) => {
      for (const ym of yms) d.ts[slot(empId, ym)] = next[ym];
    }, submitMode !== null);   // lưu nháp thì bỏ bước đọc lại cho nhẹ
    if (!ok) failed.push(...yms);

    if (failed.length > 0) {
      // giữ nguyên dirty để nút Lưu vẫn sáng và người dùng biết là chưa xong
      setSaving(false);
      setSaveFailed(true);
      flash(
        RATE_LIMITED
          ? "Đã chạm hạn mức lệnh của phiên — tải lại trang rồi nhập lại."
          : `Chưa ghi được — ${LAST_STORAGE_ERROR}`,
        "err"
      );
      return false;
    }

    setBuckets(next); setSaving(false); setDirty(false); setSaveFailed(false); setSavedTick((t) => t + 1);
    if (submitMode === "submit") setUnlocked(false);
    if (submitMode === "unsubmit") setUnlocked(true);
    if (!silent) flash(
      submitMode === "submit" ? "Đã gửi bảng công tuần này."
        : submitMode === "unsubmit" ? "Đã gỡ đánh dấu đã gửi — nhân sự có thể sửa lại."
        : admin ? "Đã lưu thay đổi." : "Đã lưu nháp."
    );
    return true;
  };

  /* Lối thoát khi không ghi được: chép giờ đã nhập ra dạng chữ để nhập lại ở máy khác,
     thay vì mất công gõ lại từ đầu. */
  const copyEntered = async () => {
    const lines = [`Bảng công ${emp?.name || ""} — tuần ${dLabel(monday)} đến ${dLabel(days[6])}`];
    for (const r of rows) {
      const hrs = days.map((d, i) => (r.days[d] > 0 ? `${DOW[i]} ${r.days[d]}` : null)).filter(Boolean).join(", ");
      if (!hrs) continue;
      lines.push(`- ${projName(r.projectId)} | ${phaseLabel(r.phaseId)} | ${taskName(r.taskId)}: ${hrs}${r.note ? ` (${r.note})` : ""}`);
    }
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flash("Đã chép vào bộ nhớ tạm. Dán vào ghi chú hoặc tin nhắn để giữ lại.");
    } catch {
      flash("Trình duyệt không cho chép tự động. Chụp màn hình lại giúp em.", "err");
    }
  };

  // Đổi tuần khi còn thay đổi chưa lưu: tự lưu nháp trước, không để mất dữ liệu vừa gõ
  const goWeek = async (nextMonday) => {
    if (dirty) { const ok = await save(null, true); if (!ok) return; flash("Đã tự lưu tuần vừa rồi."); }
    setMonday(nextMonday);
  };

  /* Gom dòng thành nhóm để render. Mỗi mục giữ lại chỉ số gốc `i` trong mảng rows
     để ref ô nhập, điều hướng phím và xoá dòng không phải đổi gì. */
  const groups = useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => {
      const k = groupKey(r);
      if (!m.has(k)) m.set(k, { key: k, projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, items: [] });
      m.get(k).items.push({ r, i });
    });
    return [...m.values()];
  }, [rows]);

  // Đổi dự án hoặc giai đoạn ở đầu nhóm thì áp cho toàn bộ hạng mục bên trong
  const updGroup = (gk, patch) => {
    const next = rows.map((r) => (groupKey(r) === gk ? { ...r, ...patch } : r));
    const seen = new Set();
    for (const r of next) {
      const k = rowKey(r);
      // dồn sang nhóm đã tồn tại mà đụng đúng hạng mục đang có ở đó thì phải chặn
      if (seen.has(k)) return flash(`Nhóm kia đã có hạng mục "${taskName(r.taskId)}".`, "err");
      seen.add(k);
    }
    setRows(sortByGroup(next));
    setDirty(true);
  };

  /* Dự án nhân sự đang làm — suy từ giờ đã chấm tháng này + tháng trước, cùng cách tab
     "Theo dõi nhân sự" đang dùng, cộng thêm dự án của tuần đang mở kể cả chưa lưu.
     Đọc từ DB trong bộ nhớ nên không tốn lệnh storage. */
  const myProjects = useMemo(() => {
    const h = new Map();
    for (const ym of [...new Set([...yms, prevYm(yms[0])])]) {
      for (const r of dbTs(empId, ym)?.rows || []) {
        if (r.projectId === NO_PROJECT) continue;
        const t = Object.values(r.days || {}).reduce((a, v) => a + (Number(v) || 0), 0);
        if (t > 0) h.set(r.projectId, (h.get(r.projectId) || 0) + t);
      }
    }
    for (const r of rows) if (r.projectId !== NO_PROJECT) h.set(r.projectId, h.get(r.projectId) || 0);
    return activeProjects.filter((p) => h.has(p.id)).sort((a, b) => (h.get(b.id) || 0) - (h.get(a.id) || 0));
  }, [empId, yms, rows, activeProjects, savedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tra mã dự án -> id. Gõ "01" hoặc "#01" là nhảy thẳng vào dự án đó, khỏi gõ tên
  const codeMap = useMemo(() => {
    const m = new Map();
    for (const p of activeProjects) if (p.code) m.set(norm(String(p.code)), p.id);
    return m;
  }, [activeProjects]);

  /* Danh sách tổ hợp để tìm kiếm. Chỉ nhân dự án × hạng mục (không nhân thêm giai đoạn) —
     giai đoạn suy ra bằng guessPhase, hoặc lấy từ token P1–P4 nếu người dùng gõ vào.
     Dự án đang làm được xếp lên trước để gõ ít nhất vẫn ra đúng thứ cần. */
  const quickOptions = useMemo(() => {
    const out = [];
    const rank = new Map(myProjects.map((p, k) => [p.id, k]));
    const ordered = [...activeProjects].sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 999) - (rank.has(b.id) ? rank.get(b.id) : 999));
    for (const p of ordered) for (const t of myTasks) {
      out.push({
        projectId: p.id, taskId: t.id, phaseId: guessPhase(t.id, cfg.tasks),
        label: `${p.code ? `[${p.code}] ` : ""}${p.name} · ${taskText(t)}`,
        hay: norm(`${p.code || ""} ${p.id} ${p.name} ${t.code || ""} ${t.name} ${t.group || ""}`),
      });
    }
    for (const t of LEAVE_TASKS) out.push({ projectId: NO_PROJECT, taskId: t.id, phaseId: DEFAULT_PHASE, label: taskText(t), hay: norm(`vang mat nghi ${t.name}`) });
    return out;
  }, [activeProjects, myProjects, myTasks, cfg.tasks]);

  const quickHits = useMemo(() => {
    const have = new Set(rows.map(rowKey));
    let text = norm(q).trim();
    let phase = qPhase;
    const m = text.match(/(^|\s)p([1-4])(\s|$)/);       // gõ thẳng "vin p2 khao" cũng lọc được giai đoạn
    if (m) { phase = `P${m[2]}`; text = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).trim(); }
    /* Token nào trùng khít một mã dự án thì coi là bộ lọc dự án, không đem đi so chuỗi nữa.
       Gõ cụ thể luôn thắng chip đang chọn, giống cách token P1–P4 đang hoạt động. */
    let proj = qProj;
    const toks = [];
    for (const t of text.split(/\s+/).filter(Boolean)) {
      const bare = t.replace(/^#/, "");
      if (codeMap.has(bare)) { proj = codeMap.get(bare); continue; }
      toks.push(t);
    }
    // ô trống và không lọc gì thì toks rỗng, every() trả true nên danh sách mở sẵn để duyệt
    return quickOptions
      .filter((o) => !proj || o.projectId === proj)
      .map((o) => (phase && o.projectId !== NO_PROJECT ? { ...o, phaseId: phase } : o))
      .filter((o) => toks.every((t) => o.hay.includes(t)) && !have.has(rowKey(o)))
      .slice(0, 12);
  }, [q, qProj, qPhase, codeMap, quickOptions, rows]);

  /* Chip gợi ý: tổ hợp chấm nhiều nhất trong tháng này và tháng trước.
     Đọc thẳng từ DB trong bộ nhớ nên không tốn lệnh storage nào. */
  const recentCombos = useMemo(() => {
    const cnt = new Map();
    for (const ym of [...new Set([...yms, prevYm(yms[0])])]) {
      const b = dbTs(empId, ym);
      for (const r of b?.rows || []) {
        if (isLeaveTask(r.taskId)) continue;
        const phaseId = r.phaseId || guessPhase(r.taskId, cfg.tasks);
        const k = rowKey({ ...r, phaseId });
        const e = cnt.get(k) || { projectId: r.projectId, phaseId, taskId: r.taskId, n: 0 };
        e.n += 1; cnt.set(k, e);
      }
    }
    const have = new Set(rows.map(rowKey));
    const live = new Set(activeProjects.map((p) => p.id));
    return [...cnt.values()]
      .filter((c) => !have.has(rowKey(c)) && live.has(c.projectId))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [empId, yms, rows, activeProjects, cfg.tasks, savedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const quickKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setQOpen(true); setQIdx((k) => Math.min(k + 1, quickHits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setQIdx((k) => Math.max(k - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (quickHits[qIdx]) addCombo(quickHits[qIdx]); }
    else if (e.key === "Escape") { setQOpen(false); e.currentTarget.blur(); }
  };

  const submitted = yms.every((ym) => buckets[ym]?.weeks?.[monday]);
  const locked = submitted && !unlocked && !admin; // quản lý luôn sửa được, nhân sự phải mở khoá
  const dayTotal = (d) => rows.reduce((s, r) => s + (r.days[d] || 0), 0);
  const weekTotal = days.reduce((s, d) => s + dayTotal(d), 0);
  const todayStr = fmt(new Date());
  // Ngày nào có dòng vắng mặt với giờ > 0 thì coi là ngày vắng — suy trực tiếp từ dòng, không lưu riêng
  const leaveMap = useMemo(() => {
    const m = {};
    for (const r of rows) {
      const lt = leaveTypeOfTask(r.taskId);
      if (!lt) continue;
      for (const d of days) if (r.days[d] > 0) m[d] = lt;
    }
    return m;
  }, [rows, days]);
  const leaveHours = (d) => rows.reduce((s2, r) => s2 + (isLeaveTask(r.taskId) ? (r.days[d] || 0) : 0), 0);
  const workHours = (d) => dayTotal(d) - leaveHours(d);

  const isIncomplete = (d) => {
    const min = minHoursFor(d, hoursCfg, holidaySet);
    return min !== null && d <= todayStr && dayTotal(d) < min;
  };
  const isOverDaily = (d) => dayTotal(d) > (Number(hoursCfg.maxDaily) || 12); // vượt ngưỡng cảnh báo/ngày
  const otTotal = days.reduce((s, d) => s + otHoursFor(d, workHours(d), hoursCfg, holidaySet), 0);
  // có ngày nào OT vượt ngưỡng không — dùng để đổi màu ô tổng và dòng OT trên đầu bảng
  const anyOtHigh = days.some((d) => otHoursFor(d, workHours(d), hoursCfg, holidaySet) > OT_ALERT);
  // Target tuần trừ đi phần được miễn do ngày lễ và ngày nghỉ phép
  const weekTarget = days.reduce((s, d) => {
    const min = minHoursFor(d, hoursCfg, holidaySet);
    return s + (min === null ? 0 : min);
  }, 0);
  const targetPct = weekTarget > 0 ? Math.min(100, (weekTotal / weekTarget) * 100) : 0;
  const projOptions = (r) => (
    <>
      {isLeaveTask(r.taskId) ? <option value={NO_PROJECT}>— Không thuộc dự án —</option> : (
        <>
          {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ""}{p.name}</option>)}
          {!activeProjects.some((p) => p.id === r.projectId) && <option value={r.projectId}>{projName(r.projectId)} (đã đóng)</option>}
        </>
      )}
    </>
  );
  const phaseOptions = () => PHASES.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>);
  // Nhân sự chưa chấm công bao giờ thì chưa suy ra được dự án nào — lúc đó hiện tạm danh sách đang mở
  const projChips = myProjects.length ? myProjects : activeProjects.slice(0, 6);
  const qChip = (on) => `rounded border px-1.5 py-0.5 text-[11px] ${on ? "border-teal-600 bg-teal-950 text-teal-300" : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200"}`;
  const taskOptions = (r) => (
    <>
      <optgroup label="Công việc">
        {myTasks.map((t) => <option key={t.id} value={t.id}>{taskText(t)}</option>)}
      </optgroup>
      <optgroup label="Vắng mặt">
        {LEAVE_TASKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </optgroup>
      {/* dòng cũ trỏ tới hạng mục ngoài bộ phận vẫn giữ được, không bị đổi ngầm sang hạng mục khác */}
      {!myTasks.some((t) => t.id === r.taskId) && (
        <option value={r.taskId}>{taskName(r.taskId)}{cfg.tasks.some((t) => t.id === r.taskId) ? " (ngoài bộ phận)" : ""}</option>
      )}
    </>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      {!admin && <DeadlineBanner cfg={cfg} empId={empId} />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Thiếu giờ công</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Tăng ca</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> OT trên {OT_ALERT} giờ/ngày</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-red-500" /> Ngày lễ</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Nghỉ phép</span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2.5 md:px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 md:gap-2">
            <button onClick={() => goWeek(fmt(addDays(parseD(monday), -7)))} className={iconBtn}><ChevronLeft size={16} /></button>
            <WeekPicker monday={monday} onChange={goWeek} empId={empId} hoursCfg={hoursCfg} holidaySet={holidaySet} refreshKey={savedTick} />
            <button onClick={() => goWeek(fmt(addDays(parseD(monday), 7)))} className={iconBtn}><ChevronRight size={16} /></button>
            <button onClick={() => goWeek(fmt(mondayOf(new Date())))} className="text-xs text-teal-400 hover:text-teal-300">Tuần này</button>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {submitted && !dirty && <span className="flex items-center gap-1 rounded-md border border-teal-800 bg-teal-950 px-2 py-1 text-[11px] text-teal-300"><CheckCircle2 size={12} /> Đã gửi</span>}
            <div className="text-right">
              <div className="font-mono text-lg font-semibold text-slate-50 md:text-xl">{weekTotal.toFixed(1)}<span className="ml-1 text-xs font-normal text-slate-500">giờ</span></div>
              {otTotal > 0 && <div className={`flex items-center justify-end gap-1 text-[11px] ${anyOtHigh ? "text-red-400" : "text-emerald-400"}`}><Zap size={11} /> OT {otTotal.toFixed(1)} giờ</div>}
            </div>
          </div>
        </div>

        {/* Tiến độ so với target tuần — target đã trừ ngày lễ và ngày nghỉ phép nên luôn phản ánh đúng thực tế */}
        {weekTarget > 0 && (
          <div className="mt-2.5 border-t border-slate-800 pt-2.5">
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span className="text-slate-500">Tiến độ tuần</span>
              <span className="font-mono text-slate-400">
                {weekTotal.toFixed(1)} / {weekTarget.toFixed(1)} giờ
                <span className={`ml-2 ${weekTotal >= weekTarget ? "text-teal-400" : "text-amber-400"}`}>
                  {weekTotal >= weekTarget ? "đủ target" : `còn thiếu ${(weekTarget - weekTotal).toFixed(1)}`}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full transition-all ${weekTotal >= weekTarget ? "bg-teal-500" : "bg-amber-500"}`} style={{ width: `${targetPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {locked && !loading && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal-900 bg-teal-950/60 px-3 py-2.5 text-sm">
          <Lock size={16} className="shrink-0 text-teal-400" />
          <span className="min-w-0 flex-1 text-slate-200">Tuần này đã gửi và đang khoá. Số liệu giữ nguyên cho tới khi bạn mở khoá.</span>
          <button onClick={() => setUnlocked(true)} className="flex shrink-0 items-center gap-1.5 rounded-md border border-teal-700 px-3 py-1.5 text-xs text-teal-200 hover:bg-teal-900">
            <Unlock size={13} /> Mở khoá để sửa
          </button>
        </div>
      )}

      {!loading && myTasks.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-900 bg-amber-950 p-3 text-sm text-amber-100">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            {emp?.role
              ? <>Vai trò <b>{roleLabel(emp.role)}</b> chưa được gán tác vụ nào.</>
              : <>Bạn chưa được phân vai trò và chưa có tác vụ dùng chung nào.</>}
            {" "}Nhờ quản lý vào tab Tác vụ bổ sung, hoặc kiểm tra lại vai trò của bạn ở tab Nhân sự.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-10 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} /> Đang tải bảng công…</div>
      ) : (
        <>
          {/* THÊM NHANH — một ô gõ tìm cả dự án · giai đoạn · hạng mục, kèm chip tổ hợp hay dùng */}
          {!locked && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input ref={qInput} value={q}
                  onChange={(e) => { setQ(e.target.value); setQOpen(true); setQIdx(0); }}
                  onFocus={() => setQOpen(true)}
                  onBlur={() => setTimeout(() => setQOpen(false), 150)}
                  onKeyDown={quickKey}
                  placeholder="Gõ mã dự án, tên dự án hoặc hạng mục để thêm dòng"
                  className={`${CTRL} w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none`} />
                {qOpen && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-slate-700 bg-slate-900 shadow-xl">
                    {/* Hàng lọc: dự án nhân sự đang làm, và bốn giai đoạn kèm tên đầy đủ — bấm để lọc */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-800 px-2.5 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setQProj(""); setQIdx(0); }} className={qChip(!qProj)}>Tất cả</button>
                        {projChips.map((p) => (
                          <button key={p.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setQProj(qProj === p.id ? "" : p.id); setQIdx(0); }}
                            className={qChip(qProj === p.id)}>{p.code ? `[${p.code}] ` : ""}{p.name}</button>
                        ))}
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-1">
                        {PHASES.map((ph) => (
                          <button key={ph.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setQPhase(qPhase === ph.id ? null : ph.id); setQIdx(0); }}
                            className={qChip(qPhase === ph.id)} title={ph.desc}>
                            <span className="font-mono">{ph.id}</span> {ph.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      {quickHits.length === 0 ? (
                        <div className="px-3 py-5 text-center text-xs text-slate-500">Không còn hạng mục nào khớp.</div>
                      ) : quickHits.map((o, k) => (
                        <button key={rowKey(o)} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setQIdx(k)} onClick={() => addCombo(o)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${k === qIdx ? "bg-slate-800 text-slate-100" : "text-slate-300"}`}>
                          <span className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{o.phaseId}</span>
                          <span className="min-w-0 truncate">{o.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {recentCombos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recentCombos.map((c) => (
                    <button key={rowKey(c)} onClick={() => addCombo(c)}
                      className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-400 hover:border-teal-700 hover:text-teal-300">
                      <Plus size={11} className="shrink-0" />
                      <span className="truncate" style={{ maxWidth: 240 }}>{projFull(c.projectId)} · {taskName(c.taskId)}</span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-600">{c.phaseId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DESKTOP */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 md:block">
            <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  {/* Ba trường gộp về một cột: hàng trên Dự án + Giai đoạn, hàng dưới Hạng mục nằm ngang hàng với giờ công */}
                  <th className="px-4 py-3 font-medium" style={{ width: "50%" }}>Dự án · Giai đoạn · Hạng mục</th>
                  {days.map((d, i) => {
                    const hol = holidayMap.has(d); const lv = leaveInfo(leaveMap[d]);
                    return (
                      <th key={d} className={`px-1 py-1.5 text-center font-medium ${hol ? "text-slate-100" : lv ? "text-sky-400" : isIncomplete(d) ? "text-amber-400" : i === 6 ? "text-slate-600" : ""}`}
                        title={hol ? holidayMap.get(d) : lv ? lv.label : undefined}>
                        <div className={`mx-auto flex flex-col items-center justify-center bg-center bg-no-repeat ${hol ? "" : "w-fit"}`}
                          style={hol ? { width: 50, height: 50, backgroundImage: `url("data:image/svg+xml,${HOLIDAY_RING_SVG}")`, backgroundSize: "100% 100%" } : undefined}>
                          <div className="flex items-center justify-center gap-1">
                            {DOW[i]}
                            {hol ? null : lv ? <span className="text-[9px]">{lv.short}</span> : isIncomplete(d) ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Chưa đủ giờ chuẩn" /> : null}
                          </div>
                          <div className={`font-mono text-xs font-normal normal-case ${i === 6 ? "text-slate-600" : "text-slate-100"}`}>{dLabel(d)}</div>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-center font-medium" style={{ width: "7%" }}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    Tuần này chưa có dòng nào. Bấm <b className="text-slate-300">Thêm dòng</b> để bắt đầu, hoặc <b className="text-slate-300">Chép tuần trước</b> để lấy lại đúng các dự án bạn đang làm.
                  </td></tr>
                )}
              </tbody>

              {/* Mỗi dòng chấm công là một tbody riêng gồm 2 hàng: hover và viền dưới nhờ vậy bao trọn cả cụm.
                  selectCls đã có sẵn w-full nên tỉ lệ rộng phải đặt ở div bọc ngoài bằng flexBasis. */}
              {groups.map((g) => {
                const noProj = g.projectId === NO_PROJECT; // khối vắng mặt: khoá dự án và giai đoạn
                const gt = g.items.reduce((s, { r }) => s + days.reduce((a, d) => a + (r.days[d] || 0), 0), 0);
                return (
                  <tbody key={g.key} className="hover:bg-slate-800">
                    {/* Đầu khối: dự án + giai đoạn, hiện đúng một lần cho cả nhóm */}
                    <tr>
                      <td className="px-3 pt-2.5">
                        <div className="flex items-center gap-2">
                          {/* nút + mở đầu khối; ô hạng mục bên dưới chừa đúng bề rộng này để thẳng hàng */}
                          <div className="shrink-0" style={{ width: GUT }}>
                            {!locked && (
                              <button onClick={() => addTaskToGroup(g)} title="Thêm hạng mục vào dự án và giai đoạn này"
                                className={`${iconBtn} hover:border-teal-700 hover:text-teal-300`}><Plus size={15} /></button>
                            )}
                          </div>
                          <div className="min-w-0" style={{ flexBasis: "58%", flexGrow: 1 }}>
                            <select disabled={locked || noProj} value={g.projectId} onChange={(e) => updGroup(g.key, { projectId: e.target.value })}
                              className={`disabled:opacity-50 ${selectCls}`}>{projOptions(g.items[0].r)}</select>
                          </div>
                          <div className="min-w-0" style={{ flexBasis: "42%", flexGrow: 1 }}>
                            <select disabled={locked || noProj} value={g.phaseId} onChange={(e) => updGroup(g.key, { phaseId: e.target.value })}
                              title={phaseInfo(g.phaseId)?.desc}
                              className={`disabled:opacity-50 ${selectCls}`}>{phaseOptions()}</select>
                          </div>
                        </div>
                      </td>
                      <td colSpan={7} />
                      {/* tổng của cả khối, chỉ hiện khi khối có từ 2 hạng mục trở lên */}
                      <td className="px-2 pt-2.5 text-center font-mono text-xs text-slate-500">{g.items.length > 1 && gt ? gt.toFixed(1) : ""}</td>
                    </tr>

                    {g.items.map(({ r, i }, n) => {
                      const rt = days.reduce((s, d) => s + (r.days[d] || 0), 0);
                      const last = n === g.items.length - 1;
                      const pb = last ? "pb-2.5" : "pb-0";
                      return (
                        <tr key={i} className={last ? "border-b border-slate-800" : ""}>
                          <td className={`px-3 pt-1.5 ${pb}`}>
                            <div className="flex items-center gap-2">
                              <div className="shrink-0" style={{ width: GUT }} />
                              <div className="min-w-0 flex-1">
                                <select ref={(el) => { taskSel.current[i] = el; }} disabled={locked} value={r.taskId} onChange={(e) => upd(i, { taskId: e.target.value })} className={`disabled:opacity-60 ${selectCls}`}>{taskOptions(r)}</select>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button disabled={locked || isLeaveTask(r.taskId)} onClick={() => fillStandard(i)} title="Điền giờ chuẩn cho cả tuần vào các ô còn trống"
                                  className={`${iconBtn} disabled:opacity-40`}><Zap size={14} /></button>
                                <button onClick={() => setNoteRow(i)} title={r.note || "Thêm mô tả"}
                                  className={`${iconBtn} relative ${r.note ? "border-teal-800 text-teal-400" : ""}`}>
                                  <MoreHorizontal size={14} />
                                  {r.note && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-teal-400" />}
                                </button>
                                <button disabled={locked} onClick={() => delRow(i)} className={`${iconBtn} disabled:opacity-40`}><Trash2 size={14} /></button>
                              </div>
                            </div>
                          </td>
                          {days.map((d, k) => (
                            <td key={d} className={`px-1 pt-1.5 ${pb}`}>
                              <input ref={(el) => { gridInputs.current[`${i}:${k}`] = el; }}
                                type="number" min="0" max="24" step="0.5" value={r.days[d] ?? ""} placeholder="0" disabled={locked}
                                onChange={(e) => setHour(i, d, e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => gridKey(e, i, k)}
                                className={`${CTRL} w-full rounded-md border bg-slate-950 px-1 text-center font-mono text-base font-medium text-slate-100 focus:border-teal-500 focus:outline-none disabled:opacity-60 ${isIncomplete(d) ? "border-amber-700/60" : k >= 5 ? "border-slate-800" : "border-slate-700"}`} />
                            </td>
                          ))}
                          <td className={`px-2 pt-1.5 text-center font-mono text-sm font-semibold text-teal-400 ${pb}`}>{rt ? rt.toFixed(1) : <span className="text-slate-700">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
              <tfoot>
                <tr className="border-t border-slate-700 font-mono text-sm">
                  <td className="px-4 py-3 font-sans text-xs uppercase tracking-wider text-slate-500">Tổng theo ngày</td>
                  {days.map((d) => {
                    const t = dayTotal(d);
                    return <td key={d} className={`px-1 py-3 text-center ${isOverDaily(d) ? "text-rose-400" : isIncomplete(d) ? "text-amber-400" : "text-slate-200"}`}>{t ? t.toFixed(1) : "—"}</td>;
                  })}
                  <td className="px-2 py-3 text-center font-semibold text-teal-400">{weekTotal.toFixed(1)}</td>
                </tr>
                {otTotal > 0 && (
                  <tr className="border-t border-slate-800 font-mono text-xs">
                    <td className="px-4 py-2 font-sans text-xs uppercase tracking-wider text-slate-500">Trong đó OT</td>
                    {days.map((d) => {
                      const ot = otHoursFor(d, workHours(d), hoursCfg, holidaySet);
                      const hot = ot > OT_ALERT; // vượt ngưỡng thì đổi đỏ, khỏi phải nhẩm
                      return <td key={d} title={hot ? `OT vượt ${OT_ALERT} giờ` : undefined}
                        className={`px-1 py-2 text-center ${hot ? "font-semibold text-red-400" : ot ? "text-emerald-400" : "text-slate-700"}`}>{ot ? ot.toFixed(1) : "·"}</td>;
                    })}
                    <td className={`px-2 py-2 text-center font-semibold ${anyOtHigh ? "text-red-400" : "text-emerald-400"}`}>{otTotal.toFixed(1)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* MOBILE */}
          <div className="space-y-3 md:hidden">
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => {
                const t = dayTotal(d); const on = d === activeDay; const incomplete = isIncomplete(d);
                const hol = holidayMap.has(d); const lv = leaveInfo(leaveMap[d]);
                return (
                  <button key={d} onClick={() => {
                      setActiveDay(d);
                      // mở luôn bàn phím ở ô nhập của dòng đầu, bôi đen sẵn để gõ đè
                      if (locked || rows.length === 0) return;
                      requestAnimationFrame(() => {
                        const el = mobileInputs.current[0];
                        if (!el) return;
                        el.focus(); el.select?.();
                        el.scrollIntoView({ block: "center", behavior: "smooth" });
                      });
                    }}
                    className={`relative flex flex-col items-center rounded-lg border py-1.5 ${on ? "border-teal-500 bg-slate-800" : hol ? "border-rose-900 bg-rose-950/40" : lv ? "border-sky-900 bg-sky-950/40" : incomplete ? "border-amber-700/60 bg-slate-900" : "border-slate-800 bg-slate-900"}`}>
                    {hol ? null
                      : lv ? <span className="absolute right-0.5 top-0.5 text-[8px] text-sky-400">{lv.short}</span>
                      : incomplete ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
                    <span className={`text-[11px] ${on ? "text-teal-300" : i >= 5 ? "text-slate-600" : "text-slate-400"}`}>{DOW[i]}</span>
                    <span className="font-mono text-[10px] text-slate-500">{pad(parseD(d).getDate())}</span>
                    <span className={`mt-0.5 font-mono text-[11px] ${isOverDaily(d) ? "text-rose-400" : incomplete ? "text-amber-400" : t ? "text-teal-400" : "text-slate-700"}`}>{t ? t.toFixed(1) : "·"}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-sm font-medium text-slate-200">{DOW[days.indexOf(activeDay)]} · {dLabel(activeDay)}</span>
              <span className="font-mono text-sm text-teal-400">{dayTotal(activeDay).toFixed(1)} giờ</span>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
                Tuần này chưa có dòng nào.<br />Bấm <b className="text-slate-300">Thêm dòng</b>, hoặc <b className="text-slate-300">Chép tuần trước</b> để lấy lại các dự án cũ.
              </div>
            ) : groups.map((g) => {
              const noProj = g.projectId === NO_PROJECT;
              return (
                <div key={g.key} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  {/* Đầu thẻ: dự án + giai đoạn dùng chung cho mọi hạng mục bên trong */}
                  <select disabled={locked || noProj} value={g.projectId} onChange={(e) => updGroup(g.key, { projectId: e.target.value })} className={`disabled:opacity-50 ${selectCls}`}>{projOptions(g.items[0].r)}</select>
                  <select disabled={locked || noProj} value={g.phaseId} onChange={(e) => updGroup(g.key, { phaseId: e.target.value })} className={`mt-2 disabled:opacity-50 ${selectCls}`}>{phaseOptions()}</select>

                  {g.items.map(({ r, i }) => {
                    const rt = days.reduce((s, d) => s + (r.days[d] || 0), 0);
                    return (
                      <div key={i} className="mt-3 border-t border-slate-800 pt-3">
                        <select ref={(el) => { taskSel.current[i] = el; }} disabled={locked} value={r.taskId} onChange={(e) => upd(i, { taskId: e.target.value })} className={`disabled:opacity-60 ${selectCls}`}>{taskOptions(r)}</select>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">Giờ ngày {dLabel(activeDay)}</div>
                            <div className="text-[11px] text-slate-600">Cả tuần: <span className="font-mono text-slate-400">{rt.toFixed(1)}</span> giờ</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <input ref={(el) => { mobileInputs.current[i] = el; }}
                              type="number" inputMode="decimal" min="0" max="24" step="0.5" placeholder="0" disabled={locked}
                              value={r.days[activeDay] ?? ""} onChange={(e) => setHour(i, activeDay, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                // Enter nhảy xuống ô của dòng kế tiếp, nhập liền mạch cả ngày
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                const next = mobileInputs.current[i + 1];
                                if (next) { next.focus(); next.select?.(); } else e.target.blur();
                              }}
                              className={`${CTRL} w-20 rounded-md border border-slate-700 bg-slate-950 px-2 text-center font-mono text-lg text-slate-100 focus:border-teal-500 focus:outline-none disabled:opacity-60`} />
                            <button onClick={() => setNoteRow(i)} title={r.note || "Thêm mô tả"}
                              className={`${iconBtn} relative h-11 w-11 ${r.note ? "border-teal-800 text-teal-400" : ""}`}>
                              <MoreHorizontal size={16} />
                              {r.note && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-teal-400" />}
                            </button>
                            <button disabled={locked} onClick={() => delRow(i)} className={`${iconBtn} h-11 w-11 disabled:opacity-40`}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!locked && (
                    <button onClick={() => addTaskToGroup(g)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-700 py-2 text-xs text-slate-400 hover:border-teal-700 hover:text-teal-300">
                      <Plus size={14} /> Hạng mục
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
        <button onClick={focusQuick} disabled={locked} className={`${btnGhost} disabled:opacity-40`}><Plus size={15} /> Thêm dòng</button>
        <button onClick={copyPrevWeek} disabled={locked || copying} title="Lấy lại đúng các dự án và hạng mục đã chấm tuần trước, giờ công để trống"
          className={`${btnGhost} disabled:opacity-40`}>
          {copying ? <Loader2 className="animate-spin" size={15} /> : <Copy size={15} />} Chép tuần trước
        </button>
        <button onClick={() => save(null)} disabled={saving || locked} className={`${btnGhost} disabled:opacity-40`}>
          {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} {admin ? "Lưu thay đổi" : "Lưu nháp"}
        </button>
        {admin && submitted ? (
          <button onClick={() => save("unsubmit")} disabled={saving} className={`col-span-2 w-full md:w-auto ${btnGhost} disabled:opacity-40`}>
            <Unlock size={15} /> Gỡ đánh dấu đã gửi
          </button>
        ) : (
          <button onClick={() => save("submit")} disabled={saving || locked} className={`col-span-2 w-full md:w-auto ${btnPrimary} disabled:opacity-40`}>
            <CheckCircle2 size={15} /> {admin ? "Đánh dấu đã gửi" : submitted ? "Gửi lại bảng công tuần" : "Gửi bảng công tuần"}
          </button>
        )}
        {dirty && <span className="col-span-2 text-center text-xs text-amber-400 md:text-left">Có thay đổi chưa lưu</span>}
      </div>

      {saveFailed && (
        <div className="rounded-xl border border-rose-900 bg-rose-950 p-3 text-sm text-rose-100">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
            <div className="min-w-0">
              <b>Chưa ghi được vào bộ nhớ lưu trữ.</b> Giờ bạn nhập vẫn còn nguyên trên màn hình — đừng đóng trang.
              Bấm Lưu lại một lần nữa; nếu vẫn hỏng thì chép giờ ra rồi nhập lại trên máy tính.
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => save(null)} className={btnGhost}><Save size={14} /> Thử lưu lại</button>
            <button onClick={copyEntered} className={btnGhost}><Copy size={14} /> Chép giờ đã nhập</button>
          </div>
        </div>
      )}

      {undoRow && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-300">Đã xoá dòng {projName(undoRow.row.projectId)} · {taskName(undoRow.row.taskId)}</span>
          <button onClick={undoDelete} className="shrink-0 text-xs text-teal-400 hover:text-teal-300">Hoàn tác</button>
          <button onClick={() => setUndoRow(null)} className="shrink-0 text-slate-500 hover:text-slate-300"><X size={14} /></button>
        </div>
      )}

      <NoteDialog
        open={noteRow !== null}
        readOnly={locked}
        title={noteRow !== null && rows[noteRow] ? `${projName(rows[noteRow].projectId)} · ${taskName(rows[noteRow].taskId)}` : ""}
        value={noteRow !== null ? rows[noteRow]?.note : ""}
        onSave={(txt) => { upd(noteRow, { note: txt }); setNoteRow(null); }}
        onClose={() => setNoteRow(null)}
      />
    </div>
  );
}

/* ============================ BẢNG CÔNG NHÂN SỰ (QUẢN LÝ) ============================ */
/* --------- v1.6: ma trận giờ công — hàng = nhân sự, cột = dự án, theo tháng ---------
   Đọc thẳng từ dữ liệu đã nằm trong bộ nhớ (dbTs), không tốn lệnh lưu trữ.
   Giờ vắng mặt gom vào một cột riêng "Vắng mặt", không tính vào giờ dự án. */
function HoursMatrix({ cfg, ym, flash, onPickEmp }) {
  const [q, setQ] = useState("");
  const [fDept, setFDept] = useState("all");
  const [hideEmpty, setHideEmpty] = useState(false);

  const from = `${ym}-01`;
  const to = fmt(lastOfMonth(parseD(from)));
  const projById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskById = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes]);
  const projLabel = (id) => { if (id === NO_PROJECT) return "Vắng mặt"; const x = projById.get(id); return x ? (x.code ? `[${x.code}] ${x.name}` : x.name) : "(dự án đã xoá)"; };
  const projShort = (id) => { if (id === NO_PROJECT) return "Vắng mặt"; const x = projById.get(id); return x ? (x.code ? `${x.code} ${x.name}` : x.name) : "(đã xoá)"; };
  const taskLabel = (id) => { const t = taskById.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  // Toàn bộ dòng giờ của tháng, gom theo (nhân sự, dự án)
  const base = useMemo(() => {
    const detail = [];
    for (const ymk of ymsBetween(from, to)) for (const e of cfg.employees) {
      const d = dbTs(e.id, ymk);
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;
        const pid = isLeaveTask(r.taskId) ? NO_PROJECT : r.projectId;
        detail.push({ empId: e.id, date, hours: Number(h), projectId: pid, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, note: r.note || "" });
      }
    }
    return detail;
  }, [cfg.employees, from, to]);

  const emps = cfg.employees.filter((e) => {
    if (fDept !== "all" && e.dept !== fDept) return false;
    const kw = q.trim().toLowerCase();
    return !kw || `${e.name} ${e.code || ""} ${e.dept} ${e.role || ""}`.toLowerCase().includes(kw);
  });

  const view = useMemo(() => {
    const ids = new Set(emps.map((e) => e.id));
    const cell = new Map();            // empId -> Map(projectId -> giờ)
    const projTot = new Map();
    const empTot = new Map();
    for (const d of base) {
      if (!ids.has(d.empId)) continue;
      if (!cell.has(d.empId)) cell.set(d.empId, new Map());
      const m = cell.get(d.empId); m.set(d.projectId, (m.get(d.projectId) || 0) + d.hours);
      projTot.set(d.projectId, (projTot.get(d.projectId) || 0) + d.hours);
      empTot.set(d.empId, (empTot.get(d.empId) || 0) + d.hours);
    }
    // cột dự án xếp theo giờ giảm dần, "Vắng mặt" luôn ở cuối
    const cols = [...projTot.keys()].filter((k) => k !== NO_PROJECT).sort((a, b) => projTot.get(b) - projTot.get(a));
    const hasLeave = projTot.has(NO_PROJECT);
    let max = 0; for (const m of cell.values()) for (const [k, v] of m) if (k !== NO_PROJECT && v > max) max = v;
    const grand = [...projTot.values()].reduce((a, b) => a + b, 0);
    return { cell, projTot, empTot, cols, hasLeave, max, grand };
  }, [base, emps.map((e) => e.id).join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps

  const shown = hideEmpty ? emps.filter((e) => (view.empTot.get(e.id) || 0) > 0) : emps;
  const allCols = [...view.cols, ...(view.hasLeave ? [NO_PROJECT] : [])];
  const n1 = (v) => (Math.round(v * 10) / 10).toString();
  const empsNoHours = emps.filter((e) => !(view.empTot.get(e.id) || 0)).length;

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const mtx = shown.map((e) => {
      const row = { "Mã": e.code || "", "Nhân sự": e.name, "Bộ phận": e.dept, "Vai trò": e.role || "" };
      const m = view.cell.get(e.id);
      for (const c of allCols) row[projLabel(c)] = m?.get(c) || 0;
      row["Tổng giờ"] = view.empTot.get(e.id) || 0;
      return row;
    });
    const tot = { "Mã": "", "Nhân sự": "TỔNG", "Bộ phận": "", "Vai trò": "" };
    for (const c of allCols) tot[projLabel(c)] = view.projTot.get(c) || 0;
    tot["Tổng giờ"] = shown.reduce((a, e) => a + (view.empTot.get(e.id) || 0), 0);
    mtx.push(tot);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mtx), "Ma trận");
    const ids = new Set(shown.map((e) => e.id));
    const empMap = new Map(cfg.employees.map((e) => [e.id, e]));
    const detail = base.filter((d) => ids.has(d.empId))
      .sort((a, b) => (empMap.get(a.empId)?.name || "").localeCompare(empMap.get(b.empId)?.name || "") || a.date.localeCompare(b.date))
      .map((d) => {
        const e = empMap.get(d.empId);
        return { "Mã": e?.code || "", "Nhân sự": e?.name || "(đã xoá)", "Bộ phận": e?.dept || "", "Ngày": d.date, "Thứ": DOW[(parseD(d.date).getDay() + 6) % 7],
          "Dự án": projLabel(d.projectId), "Giai đoạn": d.projectId === NO_PROJECT ? "" : phaseLabel(d.phaseId), "Hạng mục": taskLabel(d.taskId), "Ghi chú": d.note || "", "Giờ": d.hours };
      });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Chi tiết");
    const need = mondaysOfMonth(ym);
    const st = shown.map((e) => { const w = dbTs(e.id, ym)?.weeks; const miss = need.filter((m) => !w?.[m]); return { "Nhân sự": e.name, "Số tuần cần nộp": need.length, "Đã nộp": need.length - miss.length, "Thiếu": miss.length, "Tuần thiếu": miss.map(dLabel).join(", ") }; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(st), "Tình trạng nộp");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = `ARTIUS_ma-tran-gio-cong_${ym}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    flash("Đã xuất file Excel.");
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-800 p-3 md:flex-row md:items-center md:gap-3 md:p-4">
        <div className="relative min-w-0 md:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự" className={`pl-9 ${inputCls}`} />
        </div>
        <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={`md:w-48 ${selectCls}`}>
          <option value="all">Mọi bộ phận</option>
          {DEPTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="accent-teal-500" />
          Ẩn người chưa có giờ
        </label>
        <button onClick={exportXlsx} disabled={shown.length === 0} className={`md:ml-auto ${btnPrimary} disabled:opacity-40`}><Download size={15} /> Xuất Excel</button>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-3 py-2 text-xs text-slate-500 md:px-4">
        <span>{ymLabel(ym)}</span>
        <span>Tổng <span className="font-mono text-slate-200">{n1(view.grand)}</span> giờ</span>
        <span>{view.cols.length} dự án</span>
        {empsNoHours > 0 && <span className="text-amber-400">{empsNoHours} người chưa có giờ</span>}
      </div>

      {shown.length === 0 || allCols.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-slate-500">{shown.length === 0 ? "Không có nhân sự nào khớp bộ lọc." : "Tháng này chưa có giờ công nào được chấm."}</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[200px] border-b border-slate-800 bg-slate-900 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 md:px-4">Nhân sự</th>
                {allCols.map((c) => (
                  <th key={c} title={projLabel(c)} className={`min-w-[110px] max-w-[160px] border-b border-slate-800 px-2 py-2 text-right text-[11px] font-medium ${c === NO_PROJECT ? "text-sky-400" : "text-slate-400"}`}>
                    <div className="truncate">{projShort(c)}</div>
                  </th>
                ))}
                <th className="min-w-[80px] border-b border-slate-800 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-slate-500 md:px-4">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const m = view.cell.get(e.id); const tot = view.empTot.get(e.id) || 0;
                return (
                  <tr key={e.id} className="group">
                    <td className="sticky left-0 z-10 border-b border-slate-800/70 bg-slate-900 px-3 py-1.5 md:px-4">
                      <button onClick={() => onPickEmp(e.id)} title="Xem và sửa bảng công chi tiết" className="block w-full text-left">
                        <span className="block truncate font-medium text-slate-100 group-hover:text-teal-300">{e.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{e.dept}{e.role ? ` · ${e.role}` : ""}</span>
                      </button>
                    </td>
                    {allCols.map((c) => {
                      const v = m?.get(c) || 0;
                      const bg = v && c !== NO_PROJECT && view.max ? { backgroundColor: `rgba(20,184,166,${0.08 + 0.4 * (v / view.max)})` } : v ? { backgroundColor: "rgba(56,189,248,0.12)" } : undefined;
                      return <td key={c} style={bg} className={`border-b border-slate-800/70 px-2 py-1.5 text-right font-mono text-xs ${v ? "text-slate-100" : "text-slate-700"}`}>{v ? n1(v) : "·"}</td>;
                    })}
                    <td className={`border-b border-slate-800/70 px-3 py-1.5 text-right font-mono text-xs font-medium md:px-4 ${tot ? "text-teal-300" : "text-amber-500"}`}>{tot ? n1(tot) : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-400 md:px-4">Tổng</td>
                {allCols.map((c) => <td key={c} className="px-2 py-2 text-right font-mono text-xs font-medium text-slate-200">{n1(view.projTot.get(c) || 0)}</td>)}
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-teal-300 md:px-4">{n1(shown.reduce((a, e) => a + (view.empTot.get(e.id) || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminTimesheet({ cfg, flash, onDirtyChange }) {
  const [empId, setEmpId] = useState(cfg.employees[0]?.id || "");
  const [q, setQ] = useState("");
  const [ym, setYm] = useState(ymOf(fmt(new Date())));
  const [openStatus, setOpenStatus] = useState(true);   // bảng tình trạng nộp: mở/thu gọn
  const [mode, setMode] = useState("matrix");              // v1.6: "matrix" tổng quát | "detail" từng nhân sự

  const shiftYm = (v, n) => { const [y, m] = v.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const empName = (id) => cfg.employees.find((e) => e.id === id)?.name || "(đã xoá)";

  /* Ai còn thiếu tuần nào trong tháng đang xem. Dữ liệu đã nằm trong bộ nhớ nên không tốn lệnh lưu trữ. */
  const missing = useMemo(() => {
    const need = mondaysOfMonth(ym);
    const out = [];
    for (const e of cfg.employees) {
      const weeks = dbTs(e.id, ym)?.weeks;
      const miss = need.filter((m) => !weeks?.[m]);
      if (miss.length) out.push({ empId: e.id, need: need.length, missing: miss });
    }
    return out;
  }, [cfg.employees, ym]);

  const list = cfg.employees.filter((e) => {
    const kw = q.trim().toLowerCase();
    return !kw || `${e.name} ${e.code || ""} ${e.dept} ${e.role || ""}`.toLowerCase().includes(kw);
  });
  const emp = cfg.employees.find((e) => e.id === empId);

  if (cfg.employees.length === 0) return (
    <Panel title="Bảng công nhân sự">
      <p className="text-sm text-slate-500">Chưa có nhân sự nào. Thêm nhân sự ở tab Nhân sự trước đã.</p>
    </Panel>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1">
        {[["matrix", "Ma trận giờ công", Grid3x3], ["detail", "Chi tiết nhân viên", User]].map(([k, label, Ico]) => (
          <button key={k} onClick={() => setMode(k)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm ${mode === k ? "bg-teal-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            <Ico size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tình trạng nộp lên đầu: nhìn ai còn thiếu rồi bấm thẳng vào để mở bảng công của người đó */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <button onClick={() => setOpenStatus((o) => !o)}
          className="flex w-full items-center gap-3 px-3 py-3 text-left md:px-4">
          <ClipboardList size={16} className="shrink-0 text-slate-500" />
          <span className="text-sm font-medium text-slate-100">Tình trạng nộp bảng công</span>
          <span className={`rounded-md border px-2 py-0.5 text-[11px] ${missing.length === 0 ? "border-teal-800 bg-teal-950 text-teal-300" : "border-amber-800 bg-amber-950 text-amber-300"}`}>
            {missing.length === 0 ? "Đủ" : `${missing.length} người thiếu`}
          </span>
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            {ymLabel(ym)}
            {openStatus ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>

        {openStatus && (
          <div className="border-t border-slate-800 p-3 md:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button onClick={() => setYm(shiftYm(ym, -1))} className={iconBtn}><ChevronLeft size={15} /></button>
              <span className="font-mono text-sm text-slate-200">{ymLabel(ym)}</span>
              <button onClick={() => setYm(shiftYm(ym, 1))} className={iconBtn}><ChevronRight size={15} /></button>
              <button onClick={() => setYm(ymOf(fmt(new Date())))} className="text-xs text-teal-400 hover:text-teal-300">Tháng này</button>
            </div>
            {missing.length === 0 ? (
              <p className="text-sm text-slate-400">Mọi nhân sự đã nộp đủ các tuần của tháng này.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {missing.map((m) => (
                  <button key={m.empId} onClick={() => { setEmpId(m.empId); setMode("detail"); }}
                    className={`rounded-lg border border-l-4 bg-slate-950 px-3 py-2 text-left text-sm hover:border-slate-600
                      ${m.empId === empId ? "border-teal-700 border-l-teal-500" : "border-slate-800 border-l-amber-500"}`}>
                    <div className="font-medium text-slate-100">{empName(m.empId)}</div>
                    <div className="text-xs text-slate-400">Thiếu {m.missing.length}/{m.need} tuần: {m.missing.map(dLabel).join(", ")}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {mode === "matrix" && <HoursMatrix key={ym} cfg={cfg} ym={ym} flash={flash} onPickEmp={(id) => { setEmpId(id); setMode("detail"); }} />}

      {/* Chọn nhân sự để xem và sửa bảng công */}
      {mode === "detail" && <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="relative min-w-0" style={{ flexBasis: "30%", flexGrow: 1 }}>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự" className={`pl-9 ${inputCls}`} />
          </div>
          <div className="min-w-0" style={{ flexBasis: "44%", flexGrow: 1 }}>
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} className={selectCls}>
              {list.length === 0 && <option value="">Không có ai khớp từ khoá</option>}
              {list.map((e) => <option key={e.id} value={e.id}>{e.code ? `[${e.code}] ` : ""}{e.name} — {e.dept}{e.role ? ` · ${e.role}` : ""}</option>)}
            </select>
          </div>
          <span className="min-w-0 truncate text-xs text-slate-500 md:text-right" style={{ flexBasis: "26%" }}>
            {emp ? `${emp.name} · ${emp.dept}${emp.role ? ` · ${roleLabel(emp.role)}` : ""}` : "Chọn một nhân sự"}
          </span>
        </div>
        <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
          Ở đây bạn sửa được cả tuần đã gửi mà không cần mở khoá. Mọi thay đổi ghi thẳng vào bảng công của nhân sự — nên báo cho họ biết khi bạn sửa số liệu.
        </p>
      </div>}

      {/* key theo empId để reset toàn bộ state khi đổi người, tránh dính dữ liệu của người trước */}
      {mode === "detail" && emp && <EmployeeArea key={emp.id} cfg={cfg} empId={emp.id} flash={flash} admin onDirtyChange={onDirtyChange} />}
    </div>
  );
}

/* --------- cảnh báo hạn chốt công (ẩn tạm trong phiên, hoặc tắt vĩnh viễn theo thiết bị) --------- */
function DeadlineBanner({ cfg, empId }) {
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(false);    // ẩn tạm — chỉ trong phiên làm việc này
  const [hiddenForever, setHiddenForever] = useState(null); // null = chưa đọc xong storage
  const today = new Date();
  const dl = cfg.deadlineDay || 5;
  const prefKey = `artius:hide-deadline:${empId}`;

  useEffect(() => {
    (async () => {
      setHiddenForever(isOn(await sget(prefKey, false)));
    })();
  }, [prefKey]);

  useEffect(() => {
    (async () => {
      const ym = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
      const target = today.getDate() <= dl ? prevYm(ym) : ym;
      const b = dbTs(empId, target) || { weeks: {} };
      const need = mondaysOfMonth(target);
      setState({ target, missing: need.filter((m) => !b.weeks?.[m]), thisYm: ym });
    })();
  }, [empId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hideForever = async () => {
    await sset(prefKey, 1, false);
    setHiddenForever(true);
  };

  if (!state || state.missing.length === 0 || dismissed || hiddenForever) return null;
  const late = today.getDate() > dl && state.target === prevYm(state.thisYm);
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3 md:gap-3 md:p-3.5 ${late ? "border-rose-900 bg-rose-950" : "border-amber-900 bg-amber-950"}`}>
      <AlertTriangle size={18} className={`mt-0.5 shrink-0 ${late ? "text-rose-400" : "text-amber-400"}`} />
      <div className="min-w-0 flex-1 text-sm text-slate-100">
        Còn <b>{state.missing.length}</b> tuần chưa gửi: {state.missing.map(dLabel).join(", ")}.
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={hideForever} className="text-xs text-slate-300 underline decoration-slate-500 underline-offset-2 hover:text-white">Tắt vĩnh viễn</button>
        <button onClick={() => setDismissed(true)} title="Ẩn tạm" className="rounded p-0.5 text-slate-300 hover:bg-black/20 hover:text-white"><X size={14} /></button>
      </div>
    </div>
  );
}

/* ============================ KIỂM TRA LƯU TRỮ ============================
   Thử ghi/đọc lần lượt nhiều dạng khoá khác nhau rồi in ra lỗi thô.
   Mục đích: biết chính xác storage từ chối ở đâu, thay vì đoán. */
function StorageDoctor() {
  const health = useStorageHealth();
  const [rows, setRows] = useState(null);
  const [running, setRunning] = useState(false);

  // Mỗi phép thử gọi thẳng window.storage, không qua tầng bọc, để thấy đúng lỗi gốc
  const probe = async (label, fn, missingIsOk = false) => {
    try {
      const r = await fn();
      return { label, result: r ? "OK" : "trả về rỗng", err: "" };
    } catch (e) {
      const msg = errText(e);
      // khoá chưa tồn tại không phải lỗi — API này báo bằng đúng thông điệp đó
      if (missingIsOk && isMissingKey(msg)) return { label, result: "OK", err: "khoá chưa có — bình thường" };
      return { label, result: "LỖI", err: msg };
    }
  };

  const run = async () => {
    setRunning(true); setRows(null);
    const st = Date.now();
    const key = `artius:diag${st}`;
    const out = [];
    out.push(await probe("Ghi vùng chung — 3 tham số", () => window.storage.set(key, '{"t":1}', true)));
    await delay(200);
    out.push(await probe("Ghi vùng chung — 2 tham số", () => window.storage.set(`${key}b`, '{"t":1}')));
    await delay(200);
    out.push(await probe("Ghi vùng riêng — 3 tham số", () => window.storage.set(`${key}c`, '{"t":1}', false)));
    await delay(200);
    out.push(await probe("Đọc lại khoá vừa ghi", () => window.storage.get(key, true)));
    await delay(200);
    out.push(await probe("Đọc khoá chưa tồn tại", () => window.storage.get(`artius:khongton${st}`, true), true));
    await delay(200);
    out.push(await probe("Đọc dữ liệu chính", () => window.storage.get(DB_KEY, true), true));
    await delay(200);
    out.push(await probe("Liệt kê khoá", () => window.storage.list("artius:", true)));
    setRows(out); setRunning(false);
  };

  const tone = (v) => (v === "OK" ? "text-teal-400" : "text-rose-400");

  return (
    <Panel title="Kiểm tra lưu trữ">
      <p className="text-sm text-slate-400">
        Thử từng kiểu gọi lưu trữ để xác định app hỏng ở đâu. Mỗi lệnh đều tính vào hạn mức của phiên nên chỉ chạy khi cần.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={running || !STORAGE_OK} className={`${btnPrimary} disabled:opacity-40`}>
          {running ? <Loader2 className="animate-spin" size={15} /> : <ListChecks size={15} />} Chạy kiểm tra
        </button>
        <span className="text-xs text-slate-500">Lệnh đã dùng trong phiên: <b className={health.calls >= 45 ? "text-amber-400" : "text-slate-300"}>{health.calls}</b></span>
        {health.limited && <span className="text-xs text-rose-400">Đã chạm hạn mức — cần tải lại trang</span>}
      </div>

      {rows && (
        <div className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-slate-200">{r.label}</span>
                <span className={`shrink-0 font-mono text-sm ${tone(r.result)}`}>{r.result}</span>
              </div>
              {r.err && <p className="mt-1 text-xs text-rose-300">{r.err}</p>}
            </div>
          ))}
          <p className="pt-1 text-xs text-slate-500">
            Tất cả OK nghĩa là lưu trữ đang hoạt động bình thường. Riêng dòng "khoá chưa tồn tại" báo OK kèm ghi chú là đúng —
            API này dùng thông điệp lỗi để báo khoá chưa có, không phải hỏng.
          </p>
        </div>
      )}
    </Panel>
  );
}

/* ============================ SAO LƯU & KHÔI PHỤC ============================
   Bộ nhớ lưu trữ của môi trường này có lúc đứt giữa chừng. Xuất được toàn bộ dữ liệu
   ra một file JSON nghĩa là dù storage hỏng hay bị xoá thì vẫn dựng lại được. */
function BackupPanel({ cfg, saveCfg, flash, setCfgFromRestore }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(null);

  const exportAll = async () => {
    // toàn bộ dữ liệu đã ở trong bộ nhớ, xuất file không tốn lệnh lưu trữ nào
    const ts = { ...(DB?.ts || {}) };
    const dump = { app: "artius-timesheet", v: 1, at: new Date().toISOString(), config: cfg, timesheets: ts };
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
    const ok = await commitDB((db) => {
      db.config = d.config;
      db.ts = { ...db.ts, ...clean };
    });
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

/* ============================ CÀI ĐẶT CÁ NHÂN (nhân sự) ============================ */
function EmployeeSettings({ cfg, empId }) {
  const emp = cfg.employees.find((e) => e.id === empId);
  const prefKey = `artius:hide-deadline:${empId}`;
  const [hidden, setHidden] = useState(null); // null = đang tải
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setHidden(isOn(await sget(prefKey, false)));
    })();
  }, [prefKey]);

  const toggleReminder = async () => {
    setSaving(true);
    const next = !hidden; // next = true nghĩa là chuyển sang trạng thái ẨN nhắc nhở
    if (next) await sset(prefKey, 1, false);
    else await sdel(prefKey, false);
    setHidden(next); setSaving(false);
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <Panel title="Thông tin cá nhân">
        <div className="space-y-1.5 text-sm">
          <div><span className="text-slate-500">Họ và tên: </span><span className="text-slate-100">{emp?.name}</span></div>
          {emp?.code && <div><span className="text-slate-500">Mã nhân viên: </span><span className="font-mono text-slate-100">{emp.code}</span></div>}
          <div><span className="text-slate-500">Bộ phận: </span><span className="text-slate-100">{emp?.dept}</span></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Muốn đổi tên, mã nhân viên hoặc bộ phận, liên hệ Ban quản lý — nhân sự không tự sửa được thông tin này.</p>
      </Panel>

      <Panel title="Thông báo">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-slate-200">Nhắc nhở bảng công chưa gửi</div>
            <div className="mt-0.5 text-xs text-slate-500">Hiện banner cảnh báo ở đầu trang Chấm công khi còn tuần chưa gửi trước hạn chốt công.</div>
          </div>
          {hidden === null ? (
            <Loader2 className="animate-spin shrink-0 self-center text-slate-500" size={16} />
          ) : (
            <button onClick={toggleReminder} disabled={saving}
              className={`relative inline-block h-6 w-11 shrink-0 self-center appearance-none rounded-full border-0 p-0 align-middle leading-none transition-colors disabled:opacity-50 ${!hidden ? "bg-teal-600" : "bg-slate-700"}`}>
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${!hidden ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          )}
        </div>
        {hidden && <p className="mt-3 text-xs text-amber-400">Đang tắt — bạn sẽ không thấy nhắc nhở kể cả khi còn tuần chưa gửi. Bật lại bất cứ lúc nào tại đây.</p>}
      </Panel>

      <StorageDoctor />
    </div>
  );
}


function EmployeeDashboard({ cfg, empId }) {
  const emp = cfg.employees.find((e) => e.id === empId);
  const now = new Date();
  const [from, setFrom] = useState(fmt(addDays(mondayOf(now), -21))); // mặc định: 4 tuần gần nhất
  const [to, setTo] = useState(fmt(now));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const setRange = (a, b) => { setFrom(a); setTo(b); };
  const preset = (kind) => {
    const t = new Date();
    if (kind === "thisMonth") { setFrom(fmt(firstOfMonth(t))); setTo(fmt(lastOfMonth(t))); }
    if (kind === "lastMonth") { const p = new Date(t.getFullYear(), t.getMonth() - 1, 1); setFrom(fmt(firstOfMonth(p))); setTo(fmt(lastOfMonth(p))); }
    if (kind === "w4") { setFrom(fmt(addDays(mondayOf(t), -21))); setTo(fmt(t)); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const yms = ymsBetween(from, to);
    const raw = [];
    for (const ym of yms) raw.push({ ym, data: dbTs(empId, ym) });
    const detail = [];
    for (const { data: d } of raw) {
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;
        detail.push({ date, hours: Number(h), projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, note: r.note || "" });
      }
    }
    setData({ detail }); setLoading(false);
  }, [from, to, empId]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const projMapById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskMap = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes]);
  const projLabel = (id) => { if (id === NO_PROJECT) return "— Vắng mặt —"; const p = projMapById.get(id); return p ? (p.code ? `[${p.code}] ${p.name}` : p.name) : "(dự án đã xoá)"; };
  const taskLabel = (id) => { const t = taskMap.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  // Xuất bảng công của riêng mình — nhân sự tự đối chiếu với bảng lương mà không cần xin file từ quản lý
  const exportMine = () => {
    if (!data || data.detail.length === 0) return;
    const wb = XLSX.utils.book_new();
    const rowsOut = [...data.detail].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      "Ngày": d.date, "Thứ": DOW[(parseD(d.date).getDay() + 6) % 7],
      "Dự án": projLabel(d.projectId), "Giai đoạn": phaseLabel(d.phaseId),
      "Hạng mục": taskLabel(d.taskId), "Ghi chú": d.note || "", "Giờ": d.hours,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsOut), "Chi tiết");
    const byProj = new Map();
    for (const d of data.detail) byProj.set(d.projectId, (byProj.get(d.projectId) || 0) + d.hours);
    const total = data.detail.reduce((s, d) => s + d.hours, 0);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      [...byProj.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
        "Dự án": projLabel(k), "Tổng giờ": v, "Tỷ trọng %": +(v / total * 100).toFixed(1),
      }))), "Theo dự án");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(PHASES.map((p) => ({
      "Giai đoạn": `${p.id} · ${p.name}`, "Tổng giờ": +(byPhase.get(p.id) || 0).toFixed(1),
      "Tỷ trọng %": total ? +((byPhase.get(p.id) || 0) / total * 100).toFixed(1) : 0,
    }))), "Theo giai đoạn");
    // Tổng hợp theo ngày kèm OT — dùng để đối chiếu bảng lương
    const perDay = new Map();
    for (const d of data.detail) perDay.set(d.date, (perDay.get(d.date) || 0) + d.hours);
    const hCfg = cfg.hours || DEFAULT_HOURS;
    const hSet = makeHolidayIndex(cfg.holidays);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      [...perDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, tot]) => {
        const ot = otHoursFor(date, tot, hCfg, hSet);
        return {
          "Ngày": date, "Thứ": DOW[(parseD(date).getDay() + 6) % 7],
          "Ngày lễ": hSet.has(date) ? "Có" : "",
          "Giờ chuẩn": hSet.has(date) ? 0 : stdHoursFor(date, hCfg),
          "Tổng giờ": +tot.toFixed(1), "Giờ OT": +ot.toFixed(1), "Giờ thường": +(tot - ot).toFixed(1),
        };
      })), "Theo ngày");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ARTIUS_${(emp?.name || "nhan-su").replace(/\s+/g, "-")}_${from}_den_${to}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  const agg = useMemo(() => {
    if (!data) return null;
    // danh sách dự án xuất hiện trong kỳ, thứ tự ổn định theo cfg.projects để màu không nhảy lung tung
    const seenIds = new Set(data.detail.map((d) => d.projectId));
    const projIds = cfg.projects.filter((p) => seenIds.has(p.id)).map((p) => p.id);
    for (const id of seenIds) if (!projIds.includes(id)) projIds.push(id); // dự án đã xoá vẫn giữ lại để không mất dữ liệu
    const colorOf = (id) => PROJECT_COLORS[projIds.indexOf(id) % PROJECT_COLORS.length];

    // gộp theo NGÀY, giữ nguyên breakdown theo dự án cho từng ngày
    const dayMap = new Map(); // dateStr -> { total, [projId]: hours }
    for (const d of data.detail) {
      const cur = dayMap.get(d.date) || { date: d.date, total: 0 };
      cur[d.projectId] = (cur[d.projectId] || 0) + d.hours;
      cur.total += d.hours;
      dayMap.set(d.date, cur);
    }
    // đánh số thứ tự tuần (0,1,2,...) để tô nền xen kẽ trên biểu đồ — chỉ tính tuần có phát sinh giờ công
    const mondaysInData = [...new Set([...dayMap.keys()].map((dt) => fmt(mondayOf(parseD(dt)))))].sort();
    const weekIndexOf = new Map(mondaysInData.map((m, i) => [m, i]));
    const daily = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      ...d, label: dLabel(d.date), weekIdx: weekIndexOf.get(fmt(mondayOf(parseD(d.date)))),
    }));

    // tổng theo tuần — dùng cho danh sách nhận biết tuần bên dưới biểu đồ ngày
    const weekMap = new Map();
    for (const d of daily) {
      const wk = fmt(mondayOf(parseD(d.date)));
      const cur = weekMap.get(wk) || { monday: wk, total: 0 };
      cur.total += d.total;
      weekMap.set(wk, cur);
    }
    const weekly = [...weekMap.values()].sort((a, b) => a.monday.localeCompare(b.monday)).map((w) => ({
      ...w, label: `${dLabel(w.monday)} – ${dLabel(fmt(addDays(parseD(w.monday), 6)))}`,
    }));

    // dải nền xen kẽ theo tuần: mỗi dải là [nhãn ngày đầu, nhãn ngày cuối] của các ngày cùng weekIdx, liền kề nhau trong mảng daily
    const weekBands = [];
    for (const d of daily) {
      const last = weekBands[weekBands.length - 1];
      if (last && last.weekIdx === d.weekIdx) last.x2 = d.label;
      else weekBands.push({ weekIdx: d.weekIdx, x1: d.label, x2: d.label });
    }

    return { projIds, colorOf, daily, weekly, weekBands, total: data.detail.reduce((s, d) => s + d.hours, 0) };
  }, [data, cfg.projects]);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidaySet = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);
  // OT và target của kỳ đang xem — target bỏ qua ngày lễ, không tính những ngày nằm ngoài khoảng lọc
  const otTotal = useMemo(() => {
    if (!agg) return 0;
    return agg.daily.reduce((s, d) => s + otHoursFor(d.date, d.total, hoursCfg, holidaySet), 0);
  }, [agg, hoursCfg, holidaySet]);
  const periodTarget = useMemo(() => {
    let s = 0;
    for (let d = parseD(from); fmt(d) <= to; d = addDays(d, 1)) {
      const key = fmt(d);
      if (holidaySet.has(key)) continue;
      s += stdHoursFor(key, hoursCfg);
    }
    return s;
  }, [from, to, hoursCfg, holidaySet]);

  const nWeeks = agg ? agg.weekly.length : 0;

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="md:w-96">
            <DateRangeField label="Kỳ báo cáo" from={from} to={to} onChange={setRange} />
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {loading && <Loader2 className="animate-spin text-slate-500" size={16} />}
            <button onClick={load} className={`flex-1 md:flex-none ${btnGhost}`}>Cập nhật</button>
            <button onClick={exportMine} disabled={!data || data.detail.length === 0}
              className={`flex-1 md:flex-none ${btnPrimary} disabled:opacity-40`}><Download size={15} /> Xuất Excel</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          {[["w4", "4 tuần gần nhất"], ["thisMonth", "Tháng này"], ["lastMonth", "Tháng trước"]].map(([k, l]) => (
            <button key={k} onClick={() => preset(k)} className="rounded-md border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200">{l}</button>
          ))}
          <span className="ml-auto text-xs text-slate-500">{emp?.name} · {emp?.dept}</span>
        </div>
      </div>

      {agg && (
        <>
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
            {[
              ["Tổng giờ trong kỳ", agg.total.toFixed(1), "giờ"],
              ["Trong đó OT", otTotal.toFixed(1), "giờ"],
              ["Target kỳ này", periodTarget.toFixed(0), "giờ"],
              ["Số dự án tham gia", agg.projIds.length, ""],
              ["Giờ TB / tuần", nWeeks ? (agg.total / nWeeks).toFixed(1) : "0", "giờ"],
            ].map(([l, v, u]) => (
              <div key={l} className="min-w-0" style={{ flexBasis: 0, flexGrow: 1 }}>
                <Kpi label={l} value={v} unit={u} />
              </div>
            ))}
          </div>

          {periodTarget > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <span className="shrink-0 text-xs text-slate-500">Tiến độ target kỳ</span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${agg.total >= periodTarget ? "bg-teal-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(100, (agg.total / periodTarget) * 100)}%` }} />
              </div>
              <span className={`shrink-0 font-mono text-xs ${agg.total >= periodTarget ? "text-teal-400" : "text-amber-400"}`}>
                {agg.total >= periodTarget ? `vượt ${(agg.total - periodTarget).toFixed(1)}h` : `thiếu ${(periodTarget - agg.total).toFixed(1)}h`}
              </span>
            </div>
          )}

          {/* Biểu đồ, tổng theo tuần và chú giải gộp trong một panel, xếp ngang để vừa một màn hình */}
          <Panel title="Giờ công theo ngày — theo từng dự án">
            {agg.daily.length === 0 ? <p className="text-sm text-slate-500">Chưa có dữ liệu trong kỳ này.</p> : (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:gap-4">
                  <div className="min-w-0" style={{ flexBasis: "74%", flexGrow: 1 }}>
                    <ResponsiveContainer width="100%" height={isMobile ? 180 : 210}>
                      <BarChart data={agg.daily} margin={{ left: 0, right: 8, top: 4 }}>
                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1e293b" />
                        {/* dải nền xen kẽ theo tuần — dấu hiệu nhận biết ranh giới các tuần ngay trên biểu đồ ngày */}
                        {agg.weekBands.map((b) => (
                          <ReferenceArea key={b.weekIdx} x1={b.x1} x2={b.x2}
                            fill={b.weekIdx % 2 === 0 ? "rgba(148,163,184,0.06)" : "transparent"} stroke="none" ifOverflow="visible" />
                        ))}
                        <XAxis dataKey="label" tick={{ fontSize: isMobile ? 9 : 10, fill: "#94a3b8" }} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
                        <YAxis width={28} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "#1e293b" }}
                          contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "6px 10px" }}
                          labelStyle={{ color: "#ffffff", fontSize: 14, fontWeight: 600, marginBottom: 2 }}
                          itemStyle={{ color: "#ffffff", fontSize: 14 }}
                          formatter={(v, name) => [`${Number(v).toFixed(1)} giờ`, name]}
                        />
                        {agg.projIds.map((pid) => (
                          <Bar key={pid} dataKey={pid} name={projLabel(pid)} stackId="dy" fill={agg.colorOf(pid)} radius={[0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* tổng theo tuần chuyển sang cột bên phải thay vì nằm dưới, tiết kiệm chiều cao */}
                  <div className="min-w-0 md:border-l md:border-slate-800 md:pl-4" style={{ flexBasis: "26%" }}>
                    <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Tổng theo tuần</div>
                    <div className="divide-y divide-slate-800">
                      {agg.weekly.map((w) => (
                        <div key={w.monday} className="flex items-center justify-between py-1 text-xs">
                          <span className="text-slate-400">{w.label}</span>
                          <span className="font-mono font-semibold text-teal-400">{w.total.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* chú giải màu dự án gộp vào đây, bỏ panel riêng phía dưới */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 pt-2.5">
                  {agg.projIds.map((pid) => (
                    <div key={pid} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: agg.colorOf(pid) }} />
                      {projLabel(pid)}
                    </div>
                  ))}
                  <span className="ml-auto text-[11px] text-slate-600">Dải nền xám mờ đánh dấu các tuần xen kẽ</span>
                </div>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

/* ============================ DASHBOARD (QUẢN LÝ) ============================ */
function Dashboard({ cfg, flash }) {
  const now = new Date();
  const [from, setFrom] = useState(fmt(firstOfMonth(now)));
  const [to, setTo] = useState(fmt(now));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fDept, setFDept] = useState("all");   // lọc bộ phận
  const [fProj, setFProj] = useState("all");   // lọc dự án
  const [fPhase, setFPhase] = useState("all"); // lọc giai đoạn
  const [q, setQ] = useState("");              // tìm theo tên nhân sự
  const [rebuilding, setRebuilding] = useState(false);

  const hoursCfg = cfg.hours || DEFAULT_HOURS;
  const holidaySet = useMemo(() => makeHolidayIndex(cfg.holidays), [cfg.holidays]);

  const setRange = (a, b) => { setFrom(a); setTo(b); };
  const clearFilters = () => { setFDept("all"); setFProj("all"); setFPhase("all"); setQ(""); };
  const hasFilter = fDept !== "all" || fProj !== "all" || fPhase !== "all" || q.trim() !== "";

  const load = useCallback(async () => {
    setLoading(true);
    const yms = ymsBetween(from, to);
    // Toàn bộ dữ liệu đã nằm trong bộ nhớ — không tốn lệnh lưu trữ nào
    const detail = [];
    for (const ym of yms) for (const e of cfg.employees) {
      const d = dbTs(e.id, ym);
      if (!d?.rows) continue;
      for (const r of d.rows) for (const [date, h] of Object.entries(r.days || {})) {
        if (!h || date < from || date > to) continue;   // lọc đúng theo NGÀY
        detail.push({ empId: e.id, date, hours: Number(h), projectId: r.projectId, phaseId: r.phaseId || DEFAULT_PHASE, taskId: r.taskId, note: r.note || "" });
      }
    }
    const status = [];
    for (const ym of yms) {
      const need = mondaysOfMonth(ym);
      for (const e of cfg.employees) {
        const weeks = dbTs(e.id, ym)?.weeks;
        const missing = need.filter((m) => !weeks?.[m]);
        status.push({ empId: e.id, ym, done: need.length - missing.length, need: need.length, missing });
      }
    }
    setData({ detail, status, yms }); setLoading(false);
  }, [from, to, cfg.employees]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dựng lại dữ liệu tổng hợp từ bảng công gốc — tốn 1 lệnh mỗi nhân sự nên chỉ dùng khi nghi ngờ thiếu số liệu
  // Kéo lại bản mới nhất từ lưu trữ — dùng khi người khác vừa lưu bảng công của họ
  const rebuild = async () => {
    setRebuilding(true);
    await loadDB(true);
    setRebuilding(false);
    await load();
    flash("Đã tải lại dữ liệu mới nhất.");
  };

  // Dựng Map một lần thay vì .find() trong vòng lặp — trước đây là O(n²) khi xuất Excel
  const empMap = useMemo(() => new Map(cfg.employees.map((e) => [e.id, e])), [cfg.employees]);
  const projMapById = useMemo(() => new Map(cfg.projects.map((x) => [x.id, x])), [cfg.projects]);
  const taskMap = useMemo(() => new Map([...cfg.tasks, ...LEAVE_TASKS].map((t) => [t.id, t])), [cfg.tasks, cfg.leaveTypes]);
  const empName = (id) => empMap.get(id)?.name || "(đã xoá)";
  const empDept = (id) => empMap.get(id)?.dept || "";
  const projLabel = (id) => { if (id === NO_PROJECT) return "— Vắng mặt —"; const p = projMapById.get(id); return p ? (p.code ? `[${p.code}] ${p.name}` : p.name) : "(dự án đã xoá)"; };
  const taskLabel = (id) => { const t = taskMap.get(id); return t ? taskText(t) : "(tác vụ đã xoá)"; };

  // Bộ lọc áp lên toàn bộ số liệu bên dưới: KPI, biểu đồ, ma trận và cả file Excel xuất ra
  const matchEmp = useCallback((eid) => {
    const e = empMap.get(eid);
    if (fDept !== "all" && (e?.dept || "") !== fDept) return false;
    const kw = q.trim().toLowerCase();
    if (kw && !`${e?.name || ""} ${e?.code || ""}`.toLowerCase().includes(kw)) return false;
    return true;
  }, [empMap, fDept, q]);

  const agg = useMemo(() => {
    if (!data) return null;
    const detail = data.detail.filter((d) => matchEmp(d.empId)
      && (fProj === "all" || d.projectId === fProj)
      && (fPhase === "all" || (d.phaseId || DEFAULT_PHASE) === fPhase));
    const by = (fn) => { const m = new Map(); for (const d of detail) m.set(fn(d), (m.get(fn(d)) || 0) + d.hours); return m; };
    const matrix = new Map();
    for (const d of detail) {
      if (!matrix.has(d.empId)) matrix.set(d.empId, new Map());
      const mm = matrix.get(d.empId); mm.set(d.projectId, (mm.get(d.projectId) || 0) + d.hours);
    }
    // OT phải tính trên tổng giờ của một người trong một ngày, không cộng dồn theo từng dòng dự án
    const perEmpDay = new Map();
    for (const d of detail) {
      const k = `${d.empId}|${d.date}`;
      perEmpDay.set(k, (perEmpDay.get(k) || 0) + d.hours);
    }
    const otByEmp = new Map();
    let otTotal = 0;
    for (const [k, total] of perEmpDay) {
      const [eid, date] = k.split("|");
      const ot = otHoursFor(date, total, hoursCfg, holidaySet);
      if (!ot) continue;
      otByEmp.set(eid, (otByEmp.get(eid) || 0) + ot);
      otTotal += ot;
    }
    const leaveTotal = detail.filter((d) => isLeaveTask(d.taskId)).reduce((x, d) => x + d.hours, 0);
    return { detail, leaveTotal, byProj: by((d) => (isLeaveTask(d.taskId) ? null : d.projectId)), byEmp: by((d) => d.empId), byTask: by((d) => d.taskId), byPhase: by((d) => d.phaseId || DEFAULT_PHASE), matrix, otByEmp, otTotal, total: detail.reduce((s, d) => s + d.hours, 0) };
  }, [data, matchEmp, fProj, fPhase, hoursCfg, holidaySet]);

  const exportExcel = () => {
    if (!agg || agg.detail.length === 0) return flash("Không có dữ liệu nào khớp bộ lọc hiện tại.", "err");
    const wb = XLSX.utils.book_new();
    const info = [{
      "Kỳ báo cáo": `${dFull(from)} – ${dFull(to)}`, "Tổng giờ": agg.total, "Giờ OT": +agg.otTotal.toFixed(1),
      "Số nhân sự": agg.byEmp.size, "Số dự án": agg.byProj.size,
      "Bộ phận": fDept === "all" ? "Tất cả" : fDept,
      "Dự án lọc": fProj === "all" ? "Tất cả" : projLabel(fProj),
      "Giai đoạn lọc": fPhase === "all" ? "Tất cả" : phaseLabel(fPhase),
      "Từ khoá tìm": q.trim() || "—",
      "Xuất lúc": new Date().toLocaleString("vi-VN"),
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Thông tin kỳ");
    // sort trên bản sao — tránh sửa trực tiếp mảng đang nằm trong state
    const detail = [...agg.detail].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      "Ngày": d.date, "Thứ": DOW[(parseD(d.date).getDay() + 6) % 7],
      "Nhân sự": empName(d.empId), "Bộ phận": empDept(d.empId),
      "Dự án": projLabel(d.projectId), "Giai đoạn": phaseLabel(d.phaseId),
      "Hạng mục": taskLabel(d.taskId), "Ghi chú": d.note || "", "Giờ": d.hours,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Chi tiết");
    const sortDesc = (m, fn) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => fn(k, v));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(new Map([...agg.byProj].filter(([k]) => k !== null)), (k, v) => ({ "Dự án": projLabel(k), "Tổng giờ": v, "Tỷ trọng %": +(v / agg.total * 100).toFixed(1) }))), "Theo dự án");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(PHASES.map((p) => ({
      "Giai đoạn": `${p.id} · ${p.name}`,
      "Tổng giờ": +(agg.byPhase.get(p.id) || 0).toFixed(1),
      "Tỷ trọng %": agg.total ? +((agg.byPhase.get(p.id) || 0) / agg.total * 100).toFixed(1) : 0,
      "Nội dung": p.desc,
    }))), "Theo giai đoạn");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(agg.byEmp, (k, v) => ({
      "Nhân sự": empName(k), "Bộ phận": empDept(k), "Tổng giờ": v,
      "Giờ OT": +(agg.otByEmp.get(k) || 0).toFixed(1),
      "Giờ thường": +(v - (agg.otByEmp.get(k) || 0)).toFixed(1),
    }))), "Theo nhân sự");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortDesc(agg.byTask, (k, v) => ({ "Hạng mục": taskLabel(k), "Tổng giờ": v }))), "Theo hạng mục");
    const projIds = [...agg.byProj.keys()];
    const mtx = [...agg.matrix.entries()].map(([eid, mm]) => {
      const row = { "Nhân sự": empName(eid), "Bộ phận": empDept(eid) };
      let t = 0; for (const pid of projIds) { row[projLabel(pid)] = mm.get(pid) || 0; t += mm.get(pid) || 0; }
      row["Tổng"] = t; return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mtx), "Ma trận NS x DA");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.status.filter((s) => matchEmp(s.empId)).map((s) => ({
      "Tháng": s.ym, "Nhân sự": empName(s.empId), "Số tuần cần nộp": s.need,
      "Đã nộp": s.done, "Thiếu": s.need - s.done, "Tuần thiếu": s.missing.map(dLabel).join(", "),
    }))), "Tình trạng nộp");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ARTIUS_gio-cong_${from}_den_${to}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    flash("Đã xuất file Excel.");
  };

  /* Hạn mức giờ dự án: dùng toàn bộ dữ liệu đã tải, KHÔNG áp bộ lọc kỳ —
     hỏi "dự án này đã tiêu bao nhiêu giờ" thì phải tính từ đầu, không phải tính trong tháng. */

  /* Gộp ba biểu đồ cũ làm một: giờ theo dự án, phân rã theo giai đoạn, và mốc giờ dự kiến.
     Giờ vắng mặt không thuộc dự án nào nên loại khỏi đây. */
  const projectRows = useMemo(() => {
    if (!agg) return [];
    const m = new Map();
    for (const d of agg.detail) {
      if (isLeaveTask(d.taskId)) continue;
      if (!m.has(d.projectId)) m.set(d.projectId, { total: 0 });
      const row = m.get(d.projectId);
      const ph = d.phaseId || DEFAULT_PHASE;
      row[ph] = (row[ph] || 0) + d.hours;
      row.total += d.hours;
    }
    return [...m.entries()]
      .map(([id, r]) => {
        const p = projMapById.get(id);
        const base = { id, name: projLabel(id), total: r.total, budget: Number(p?.budget) || 0 };
        for (const ph of PHASES) base[ph.id] = r[ph.id] || 0;
        return base;
      })
      .sort((a, b) => b.total - a.total);
  }, [agg, projMapById]);

  const chartTask = agg ? [...agg.byTask.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ name: taskLabel(k), "giờ": +v.toFixed(1) })) : [];
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="md:w-96">
            <DateRangeField from={from} to={to} onChange={setRange} />
          </div>
          {/* nhóm hành động: luôn ép sát mép phải của khung, thẳng hàng đáy với ô ngày */}
          <div className="flex items-center gap-2 md:gap-3">
            {loading && <Loader2 className="animate-spin text-slate-500" size={16} />}
            <button onClick={load} className={`flex-1 md:flex-none ${btnGhost}`}>Cập nhật</button>
            <button onClick={rebuild} disabled={rebuilding} title="Kéo lại bản mới nhất từ lưu trữ, để thấy bảng công người khác vừa gửi"
              className={`flex-1 md:flex-none ${btnGhost} disabled:opacity-40`}>
              {rebuilding ? <Loader2 className="animate-spin" size={15} /> : <RotateCcw size={15} />} Tải lại
            </button>
            <button onClick={exportExcel} className={`flex-1 md:flex-none ${btnPrimary}`}><Download size={15} /> Xuất Excel</button>
          </div>
        </div>

        {/* Bộ lọc — thu hẹp báo cáo theo bộ phận, dự án hoặc một người cụ thể. Áp cho cả biểu đồ lẫn file Excel.
            Dùng flex + flexBasis inline thay cho grid-cols giá trị tuỳ chỉnh, vì lớp đó không có hiệu lực ở đây. */}
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-800 pt-3 md:flex-row md:items-center md:gap-2.5">
          <div className="min-w-0" style={{ flexBasis: "20%", flexGrow: 1 }}>
            <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={selectCls}>
              <option value="all">Tất cả bộ phận</option>
              {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="min-w-0" style={{ flexBasis: "26%", flexGrow: 1 }}>
            <select value={fProj} onChange={(e) => setFProj(e.target.value)} className={selectCls}>
              <option value="all">Tất cả dự án</option>
              {cfg.projects.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ""}{p.name}</option>)}
            </select>
          </div>
          <div className="min-w-0" style={{ flexBasis: "22%", flexGrow: 1 }}>
            <select value={fPhase} onChange={(e) => setFPhase(e.target.value)} className={selectCls}>
              <option value="all">Tất cả giai đoạn</option>
              {PHASES.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
            </select>
          </div>
          <div className="relative min-w-0" style={{ flexBasis: "26%", flexGrow: 1 }}>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên hoặc mã nhân sự" className={`pl-9 ${inputCls}`} />
          </div>
          <button onClick={clearFilters} disabled={!hasFilter} className={`shrink-0 whitespace-nowrap ${btnGhost} disabled:opacity-30`}><X size={14} /> Bỏ lọc</button>
        </div>
      </div>

      {agg && (
        <>
          {/* 6 ô chia đều một hàng ngang; flexBasis 0 + grow 1 để mọi ô rộng bằng nhau bất kể độ dài chữ */}
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
            {[
              ["Tổng giờ công", agg.total.toFixed(1), "giờ"],
              ["Trong đó OT", agg.otTotal.toFixed(1), "giờ"],
              ["Giờ vắng mặt", agg.leaveTotal.toFixed(1), "giờ"],
              ["Dự án phát sinh", agg.byProj.size, ""],
              ["Nhân sự đã chấm", agg.byEmp.size, ""],
              ["Giờ TB / nhân sự", agg.byEmp.size ? (agg.total / agg.byEmp.size).toFixed(1) : "0", "giờ"],
            ].map(([l, v, u]) => (
              <div key={l} className="min-w-0" style={{ flexBasis: 0, flexGrow: 1 }}>
                <Kpi label={l} value={v} unit={u} />
              </div>
            ))}
          </div>

          {hasFilter && agg.detail.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-8 text-center text-sm text-slate-400">
              Không có giờ công nào khớp bộ lọc này. Nới bộ lọc hoặc chọn kỳ báo cáo khác.
            </div>
          )}

          <Panel title="Dự án — giờ công theo giai đoạn và mốc giờ dự kiến">
            <ChartProjects rows={projectRows} />
          </Panel>

          <Panel title="Giờ công theo tác vụ"><ChartBar data={chartTask} color="#a78bfa" /></Panel>

          <Panel title="Giờ công: nhân sự × dự án">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="sticky left-0 bg-slate-900 px-3 py-2 font-medium">Nhân sự</th>
                    {[...agg.byProj.keys()].map((pid) => <th key={pid} className="px-3 py-2 text-center font-medium normal-case">{projLabel(pid)}</th>)}
                    <th className="px-3 py-2 text-center font-medium">Tổng</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {[...agg.matrix.entries()].sort((a, b) => empName(a[0]).localeCompare(empName(b[0]))).map(([eid, mm]) => {
                    const t = [...mm.values()].reduce((s, v) => s + v, 0);
                    return (
                      <tr key={eid} className="border-b border-slate-800 hover:bg-slate-800">
                        <td className="sticky left-0 bg-slate-900 px-3 py-2 font-sans text-slate-200">{empName(eid)}</td>
                        {[...agg.byProj.keys()].map((pid) => (
                          <td key={pid} className="px-3 py-2 text-center text-slate-300">{mm.get(pid) ? mm.get(pid).toFixed(1) : <span className="text-slate-700">·</span>}</td>
                        ))}
                        <td className="px-3 py-2 text-center font-semibold text-teal-400">{t.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {[...agg.matrix.entries()].sort((a, b) => empName(a[0]).localeCompare(empName(b[0]))).map(([eid, mm]) => {
                const t = [...mm.values()].reduce((s, v) => s + v, 0);
                return (
                  <div key={eid} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-slate-100">{empName(eid)}</span>
                      <span className="font-mono text-sm text-teal-400">{t.toFixed(1)} giờ</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {[...mm.entries()].sort((a, b) => b[1] - a[1]).map(([pid, h]) => (
                        <div key={pid} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-slate-400">{projLabel(pid)}</span>
                          <span className="shrink-0 font-mono text-slate-300">{h.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/* Biểu đồ gộp cho khối dự án: mỗi dự án là một cột chồng chia theo 4 giai đoạn,
   kèm mốc giờ dự kiến. Một hình trả lời được cả ba câu: dự án nào ngốn giờ,
   giờ đó rơi vào chặng nào, và đã vượt dự toán chưa. */
const ChartProjects = ({ rows }) => {
  const isMobile = useIsMobile();
  const [limit, setLimit] = useState(10);
  const w = isMobile ? 96 : 170;
  if (rows.length === 0) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>;

  const trim = (s) => (isMobile && s.length > 16 ? s.slice(0, 15) + "…" : s.length > 30 ? s.slice(0, 29) + "…" : s);
  // Danh sách dự án có thể rất dài — mặc định hiện 10 dự án nhiều giờ nhất, mở rộng khi cần
  const shown = limit === 0 ? rows : rows.slice(0, limit);
  const data = shown.map((r) => ({ ...r, name: trim(r.name) }));
  const hasBudget = shown.some((r) => r.budget > 0);
  const chartH = Math.max(210, data.length * (isMobile ? 38 : 44) + 50);

  const TipBox = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    const pct = r.budget > 0 ? (r.total / r.budget) * 100 : null;
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
        <div className="font-semibold text-white">{label}</div>
        <div className="mt-1 font-mono text-white">Tổng {r.total.toFixed(1)} giờ</div>
        {pct !== null && (
          <div className={`font-mono text-xs ${pct > 100 ? "text-rose-400" : pct > 85 ? "text-amber-400" : "text-teal-400"}`}>
            Dự kiến {r.budget} giờ · đã dùng {pct.toFixed(0)}%
          </div>
        )}
        <div className="mt-1.5 space-y-0.5">
          {PHASES.filter((p) => r[p.id] > 0).map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              <span className="text-slate-300">{p.id} · {p.name}</span>
              <span className="ml-auto font-mono text-slate-100">{r[p.id].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {rows.length > 10 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-slate-500">Hiện</span>
          {[10, 25, 0].map((n) => (
            <button key={n} onClick={() => setLimit(n)}
              className={`rounded-md border px-2.5 py-1 ${limit === n ? "border-teal-700 bg-teal-950 text-teal-300" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>
              {n === 0 ? `Tất cả (${rows.length})` : `Top ${n}`}
            </button>
          ))}
          <span className="ml-auto text-slate-600">Đang xem {data.length}/{rows.length} dự án</span>
        </div>
      )}
      {/* danh sách dài thì cuộn trong khung, không đẩy cả trang dài ra */}
      <div className="overflow-y-auto" style={{ maxHeight: isMobile ? 420 : 560 }}>
      <ResponsiveContainer width="100%" height={chartH}>
      <ComposedChart data={data} layout="vertical" margin={{ left: 4, right: 56, top: 22 }}>
        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#1e293b" />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={w} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#1e293b" }} content={<TipBox />} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        {PHASES.map((p, i) => (
          <Bar key={p.id} dataKey={p.id} name={`${p.id} · ${p.name}`} stackId="h" fill={p.color} barSize={isMobile ? 13 : 16}>
            {/* tổng giờ ghi ở cuối cột — cột chồng nên đoạn cuối cùng chính là mốc tổng */}
            {i === PHASES.length - 1 && (
              <LabelList dataKey="total" position="right" offset={8}
                formatter={(v) => `${Number(v).toFixed(0)}h`}
                style={{ fill: "#e2e8f0", fontSize: isMobile ? 10 : 11, fontWeight: 600 }} />
            )}
          </Bar>
        ))}
        {/* mốc giờ dự kiến vẽ chồng lên cột, để thấy ngay cột nào đã vượt qua vạch */}
        {hasBudget && (
          <Line dataKey="budget" name="Giờ dự kiến" stroke="#f43f5e" strokeWidth={0}
            dot={{ r: 4, fill: "#f43f5e", stroke: "#0f172a", strokeWidth: 1 }} activeDot={false} isAnimationActive={false}>
            {/* số giờ dự kiến ghi ngay trên chấm mốc, khỏi phải rê chuột mới biết */}
            <LabelList dataKey="budget" position="top" offset={isMobile ? 14 : 17}
              formatter={(v) => (v > 0 ? `dự kiến ${Number(v).toFixed(0)}h` : "")}
              style={{ fill: "#fb7185", fontSize: isMobile ? 9 : 10 }} />
          </Line>
        )}
      </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
};

const ChartBar = ({ data, color }) => {
  const isMobile = useIsMobile();
  const w = isMobile ? 96 : 150;
  const trim = (s) => (isMobile && s.length > 16 ? s.slice(0, 15) + "…" : s.length > 26 ? s.slice(0, 25) + "…" : s);
  if (data.length === 0) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * (isMobile ? 28 : 32))}>
      <BarChart data={data.map((d) => ({ ...d, name: trim(d.name) }))} layout="vertical" margin={{ left: 4, right: 16 }}>
        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#1e293b" />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={w} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "#1e293b" }}
          contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "6px 10px" }}
          labelStyle={{ color: "#ffffff", fontSize: 14, fontWeight: 600, marginBottom: 2 }}   // tên: 14px, in đậm
          itemStyle={{ color: "#ffffff", fontSize: 14 }}                                       // số giờ: 14px
        />
        <Bar dataKey="giờ" radius={[0, 4, 4, 0]} barSize={isMobile ? 11 : 14}>{data.map((_, i) => <Cell key={i} fill={color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/* ============================ DỰ ÁN ============================ */
function Projects({ cfg, saveCfg, flash }) {
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [client, setClient] = useState("");
  const [budget, setBudget] = useState("");   // giờ công dự kiến
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});

  const add = async () => {
    if (!name.trim()) return flash("Nhập tên dự án.", "err");
    await saveCfg({ ...cfg, projects: [...cfg.projects, { id: uid("p"), name: name.trim(), code: code.trim(), client: client.trim(), budget: Number(budget) || 0, active: true }] });
    setName(""); setCode(""); setClient(""); setBudget(""); flash("Đã thêm dự án.");
  };
  const startEdit = (p) => { setEditId(p.id); setDraft({ code: p.code || "", name: p.name, client: p.client || "", budget: p.budget || 0 }); };
  const commit = async () => {
    if (!draft.name.trim()) return flash("Tên dự án không được để trống.", "err");
    await saveCfg({ ...cfg, projects: cfg.projects.map((p) => (p.id === editId ? { ...p, code: draft.code.trim(), name: draft.name.trim(), client: draft.client.trim(), budget: Number(draft.budget) || 0 } : p)) });
    setEditId(null); flash("Đã cập nhật dự án.");
  };
  const toggle = (id) => saveCfg({ ...cfg, projects: cfg.projects.map((p) => (p.id === id ? { ...p, active: !p.active } : p)) });
  const [pendingDel, setPendingDel] = useState(null); // dự án chờ xác nhận xoá
  const del = (id) => setPendingDel(cfg.projects.find((p) => p.id === id) || null);
  const confirmDel = async () => {
    const p = pendingDel; setPendingDel(null);
    if (!p) return;
    await saveCfg({ ...cfg, projects: cfg.projects.filter((x) => x.id !== p.id) });
    flash("Đã xoá dự án.");
  };

  const StatusBtn = ({ p, full }) => (
    <button onClick={() => toggle(p.id)}
      className={`h-9 rounded-md border px-3 text-xs font-medium ${full ? "w-full" : ""} ${p.active ? "border-teal-800 bg-teal-950 text-teal-300" : "border-slate-700 bg-slate-950 text-slate-500"}`}>
      {p.active ? "Đang chấm công" : "Đã đóng"}
    </button>
  );

  return (
    <Panel title="Dự án — sửa thông tin & bật/tắt chấm công">
      {/* bọc trong div để class width không bị w-full của inputCls ghi đè */}
      <div className="mb-5 grid gap-2 md:flex md:flex-wrap md:items-center">
        <div className="md:w-28">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã DA" className={`font-mono ${inputCls}`} />
        </div>
        <div className="md:min-w-48 md:flex-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên dự án" className={inputCls} />
        </div>
        <div className="md:w-56">
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Khách hàng" className={inputCls} />
        </div>
        <div className="md:w-36">
          <input type="number" min="0" step="8" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Giờ dự kiến" className={`font-mono ${inputCls}`} />
        </div>
        <button onClick={add} className={btnPrimary}><Plus size={14} /> Thêm dự án</button>
      </div>

      {cfg.projects.length === 0 ? <p className="text-sm text-slate-500">Chưa có dự án. Thêm dự án để nhân sự bắt đầu chấm công.</p> : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="w-28 px-3 py-2 font-medium">Mã DA</th>
                  <th className="px-3 py-2 font-medium">Tên dự án</th>
                  <th className="w-56 px-3 py-2 font-medium">Khách hàng</th>
                  <th className="w-32 px-3 py-2 font-medium">Giờ dự kiến</th>
                  <th className="w-44 px-3 py-2 font-medium">Trạng thái</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {cfg.projects.map((p) => {
                  const editing = editId === p.id;
                  return (
                    <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800">
                      <td className="px-3 py-2">{editing ? <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={`font-mono ${inputCls}`} /> : <span className="font-mono text-base font-bold text-white">{p.code || "—"}</span>}</td>
                      <td className="px-3 py-2">{editing ? <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && commit()} className={inputCls} /> : <span className="text-slate-100">{p.name}</span>}</td>
                      <td className="px-3 py-2">{editing ? <input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} onKeyDown={(e) => e.key === "Enter" && commit()} className={inputCls} /> : <span className="text-slate-400">{p.client || "—"}</span>}</td>
                      <td className="px-3 py-2">
                        {editing
                          ? <input type="number" min="0" step="8" value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} className={`font-mono ${inputCls}`} />
                          : <span className="font-mono text-slate-400">{p.budget ? `${p.budget} h` : "—"}</span>}
                      </td>
                      <td className="px-3 py-2"><StatusBtn p={p} /></td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1.5">
                          {editing ? (
                            <><button onClick={commit} className={`${iconBtn} border-teal-800 text-teal-400`}><Check size={15} /></button>
                              <button onClick={() => setEditId(null)} className={iconBtn}><X size={15} /></button></>
                          ) : (
                            <><button onClick={() => startEdit(p)} className={iconBtn}><Pencil size={14} /></button>
                              <button onClick={() => del(p.id)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button></>
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
            {cfg.projects.map((p) => {
              const editing = editId === p.id;
              return (
                <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  {editing ? (
                    <div className="space-y-2">
                      <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Mã DA" className={`font-mono ${inputCls}`} />
                      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Tên dự án" className={inputCls} />
                      <input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="Khách hàng" className={inputCls} />
                      <input type="number" min="0" step="8" value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} placeholder="Giờ dự kiến" className={`font-mono ${inputCls}`} />
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={commit} className={btnPrimary}><Check size={15} /> Lưu</button>
                        <button onClick={() => setEditId(null)} className={btnGhost}><X size={15} /> Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {p.code && <div className="font-mono text-sm font-bold text-white">{p.code}</div>}
                          <div className="text-sm font-medium text-slate-100">{p.name}</div>
                          <div className="text-xs text-slate-500">{p.client || "—"}</div>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button onClick={() => startEdit(p)} className={iconBtn}><Pencil size={14} /></button>
                          <button onClick={() => del(p.id)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>
                        </div>
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
      <p className="mt-4 text-xs text-slate-500">Giờ dự kiến để trống nghĩa là không theo dõi hạn mức. Đóng dự án chỉ ẩn khỏi bảng chấm công mới — giờ công đã ghi vẫn giữ nguyên trong báo cáo.</p>

      <ConfirmDialog
        open={!!pendingDel}
        title={`Xoá dự án ${pendingDel?.name || ""}?`}
        desc="Giờ công đã chấm cho dự án này vẫn nằm trong dữ liệu nhưng báo cáo sẽ hiển thị là (dự án đã xoá). Nếu chỉ muốn ngừng chấm công, hãy chuyển sang trạng thái Đã đóng."
        confirmLabel="Xoá dự án"
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
    </Panel>
  );
}

/* ============================ NHÂN SỰ ============================ */
/* v1.7: kiểm tra phần tài khoản của một dòng. Trả về thông điệp lỗi, hoặc null nếu hợp lệ.
   Bỏ trống cả hai ô = không tạo tài khoản (chỉ được phép khi dòng đó chưa có tài khoản). */
const accountError = (acc, d) => {
  const u = normUsername(d.username), p = d.password || "";
  if (!acc && !u && !p) return null;
  if (!USERNAME_RE.test(u)) return "Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch.";
  if (p.length < PASSWORD_MIN) return `Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.`;
  return null;
};

/* Ô mật khẩu ở chế độ xem: che mặc định, bấm con mắt để hiện */
function PasswordCell({ value, shown, onToggle }) {
  if (!value) return <span className="text-slate-600">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-slate-300">{shown ? value : "••••••"}</span>
      <button onClick={onToggle} className="text-slate-500 hover:text-slate-200">{shown ? <EyeOff size={14} /> : <Eye size={14} />}</button>
    </span>
  );
}

/* Tên đăng nhập gợi ý từ họ tên: "Đỗ Thị Thảo" -> thao.dt ; trùng thì thêm số 2, 3… */
const suggestUsername = (name, taken) => {
  const w = norm(name).replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const base = w.length > 1 ? `${w[w.length - 1]}.${w.slice(0, -1).map((x) => x[0]).join("")}` : w[0];
  let u = base.length < 3 ? `${base}01` : base;
  for (let i = 2; taken.has(u); i++) u = `${base}${i}`;
  return u.slice(0, 30);
};
/* Mật khẩu ngẫu nhiên 8 ký tự, bỏ các ký tự dễ nhầm (0/o, 1/l/i) */
const genPassword = () => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(8);
  (typeof crypto !== "undefined" && crypto.getRandomValues) ? crypto.getRandomValues(buf) : buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 4294967296); });
  return Array.from(buf, (n) => a[n % a.length]).join("");
};
const copyText = async (text) => {
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

function Employees({ cfg, saveCfg, flash }) {
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
  const [pendingAcc, setPendingAcc] = useState(null); // tài khoản không gắn nhân sự chờ xác nhận xoá

  useEffect(() => {
    let alive = true;
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

  /* Dự án đang tham gia: dự án nhân sự đã chấm ít nhất 1 giờ trong tháng này (tự động theo giờ công) */
  const now = new Date();
  const thisYm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const empIdsKey = cfg.employees.map((e) => e.id).join(",");
  const projByEmp = useMemo(() => {
    const label = new Map(cfg.projects.map((p) => [p.id, p.code ? `[${p.code}] ${p.name}` : p.name]));
    const map = new Map();
    for (const e of cfg.employees) {
      const pids = new Set();
      for (const r of dbTs(e.id, thisYm)?.rows || []) {
        if (label.has(r.projectId) && Object.values(r.days || {}).some((v) => v > 0)) pids.add(r.projectId);
      }
      map.set(e.id, [...pids].map((id) => label.get(id)));
    }
    return map;
  }, [empIdsKey, cfg.projects, thisYm]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- lọc và gom nhóm ---- */
  const statusOf = (e) => { const a = accByEmp.get(e.id); return !a ? "none" : a.disabled ? "locked" : "active"; };
  const kw = norm(q.trim());
  const visible = cfg.employees.filter((e) => {
    if (fDept && e.dept !== fDept) return false;
    if (fStatus && statusOf(e) !== fStatus) return false;
    return !kw || norm(`${e.code || ""} ${e.name} ${accByEmp.get(e.id)?.username || ""} ${e.role || ""} ${roleInfo(e.role)?.name || ""}`).includes(kw);
  });
  // phòng ban theo thứ tự khai báo; nhân sự mang tên phòng ban lạ (dữ liệu cũ) xếp cuối để không bị mất dấu
  const deptOrder = [...DEPTS, ...cfg.employees.map((e) => e.dept).filter((d, i, a) => !DEPTS.includes(d) && a.indexOf(d) === i)];
  const groups = deptOrder.map((d) => ({ dept: d, list: visible.filter((e) => e.dept === d) })).filter((g) => g.list.length);

  /* Tạo hoặc cập nhật tài khoản. Trả về true nếu xong hoặc không có gì để làm. */
  const pushAccount = async (empId, acc, d) => {
    const u = normUsername(d.username), p = d.password || "", adm = !!d.isAdmin;
    if (!acc && !u) return true;
    if (acc && acc.username === u && acc.password === p && acc.isAdmin === adm) return true;
    try {
      const r = await accountsApi("save", { id: acc?.id, empId, username: u, password: p, isAdmin: adm });
      mergeAcc(r.account);
      return true;
    } catch (e) { flash(e.message, "err"); return false; }
  };

  /* ---- khung thêm / sửa ---- */
  const openAdd = () => setDlg({ kind: "emp", empId: null, accId: null, hadAcc: false, autoUser: true,
    f: { code: "", name: "", dept: fDept || DEPTS[0], role: "", username: "", password: genPassword(), isAdmin: false } });
  const openEdit = (e) => {
    const a = accByEmp.get(e.id);
    setDlg({ kind: "emp", empId: e.id, accId: a?.id || null, hadAcc: !!a, autoUser: !a,
      f: { code: e.code || "", name: e.name, dept: e.dept, role: e.role || "", username: a?.username || "", password: a?.password || "", isAdmin: !!a?.isAdmin } });
  };
  const openAddAdmin = () => setDlg({ kind: "admin", empId: null, accId: null, hadAcc: false, autoUser: false, f: { username: "", password: genPassword(), isAdmin: true } });
  const openEditAdmin = (a) => setDlg({ kind: "admin", empId: a.empId || null, accId: a.id, hadAcc: true, autoUser: false, f: { username: a.username, password: a.password, isAdmin: a.isAdmin } });
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
      const row = { code, name, dept: f.dept, role: f.role || "" };
      const ok = await saveCfg({ ...cfg, employees: dlg.empId ? cfg.employees.map((e) => (e.id === id ? { ...e, ...row } : e)) : [...cfg.employees, { id, ...row }] });
      const accOk = ok !== false && (!wantsAcc || (await pushAccount(id, acc, f)));
      setBusy(false);
      if (ok === false) return;
      // nhân sự đã lưu nhưng tài khoản lỗi: chuyển khung sang chế độ sửa người đó để sửa tiếp phần tài khoản
      if (!accOk) return setDlg({ ...dlg, empId: id });
      flash(dlg.empId ? "Đã cập nhật nhân sự." : "Đã thêm nhân sự.");
      if (more) setDlg({ kind: "emp", empId: null, accId: null, hadAcc: false, autoUser: true, f: { code: "", name: "", dept: f.dept, role: "", username: "", password: genPassword(), isAdmin: false } });
      else setDlg(null);
      return;
    }
    const err = accountError(acc, f);
    if (err) return flash(err, "err");
    setBusy(true);
    const done = await pushAccount(dlg.empId, acc, { ...f, isAdmin: acc ? acc.isAdmin : true });
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
  const exportAccounts = () => {
    const rows = visible.filter((e) => accByEmp.has(e.id)).map((e) => {
      const a = accByEmp.get(e.id);
      return { "Mã NV": e.code || "", "Họ và tên": e.name, "Phòng ban": e.dept, "Vai trò": e.role ? roleLabel(e.role) : "", "Tên đăng nhập": a.username, "Mật khẩu": a.password, "Trạng thái": a.disabled ? "Đã khoá" : "Đang dùng" };
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
  const COLS = "md:grid md:grid-cols-[84px_minmax(150px,230px)_190px_170px_120px_minmax(160px,1fr)_156px] md:items-center md:gap-3";
  const adminBadge = <span className="rounded border border-teal-800 bg-teal-950 px-1.5 py-0.5 text-[10px] text-teal-300">Quản lý</span>;
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
    const projs = projByEmp.get(e.id) || [];
    const dim = a?.disabled ? "text-slate-500" : "";
    const roleEl = e.role ? <span className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-teal-300">{roleLabel(e.role) || e.role}</span> : null;
    const projEl = projs.map((p) => <span key={p} className="rounded border border-teal-800 bg-teal-950 px-1.5 py-0.5 text-[11px] text-teal-300">{p}</span>);
    const btns = (
      <div className="flex shrink-0 justify-end gap-1">
        {a && accBtns(a, e.name)}
        <button onClick={() => openEdit(e)} title="Sửa" className={iconBtn}><Pencil size={14} /></button>
        <button onClick={() => setPendingDel(e)} title="Xoá" className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={14} /></button>
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
            {a ? <><span className="break-all font-mono text-xs text-slate-300">{a.username}</span>{a.isAdmin && adminBadge}{a.disabled && lockedBadge}</> : <span className="text-slate-600">Chưa có</span>}
          </div>
          <div><PasswordCell value={a?.password} shown={!!shown[a?.id]} onToggle={() => toggleShown(a.id)} /></div>
          <div className="flex min-w-0 flex-wrap gap-1.5">{projs.length ? projEl : none}</div>
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
          {(roleEl || projs.length > 0) && <div className="mt-1.5 flex flex-wrap gap-1.5">{roleEl}{projEl}</div>}
          {a && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="break-all font-mono text-xs text-slate-300">{a.username}</span>
              <PasswordCell value={a.password} shown={!!shown[a.id]} onToggle={() => toggleShown(a.id)} />
              {a.isAdmin && adminBadge}{a.disabled && lockedBadge}
            </div>
          )}
        </div>
      </div>
    );
  };
  const empTab = (
    <div className={panelCls}>
      <div className="grid grid-cols-2 gap-2 p-3 xl:grid-cols-[minmax(200px,1fr)_200px_200px_auto_auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã, tên đăng nhập" className={`col-span-2 xl:col-span-1 ${inputCls}`} />
        <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={selectCls}>
          <option value="">Mọi phòng ban</option>
          {deptOrder.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
          <option value="">Mọi tài khoản</option>
          <option value="none">Chưa có tài khoản</option>
          <option value="active">Đang dùng</option>
          <option value="locked">Đã khoá</option>
        </select>
        <button onClick={exportAccounts} className={`whitespace-nowrap ${btnGhost}`}><Download size={14} /> Xuất tài khoản</button>
        <button onClick={openAdd} className={`whitespace-nowrap ${btnPrimary}`}><Plus size={14} /> Thêm nhân sự</button>
      </div>
      <div className="px-3.5 pb-2.5 text-xs text-slate-500">
        {visible.length === cfg.employees.length ? `${visible.length} nhân sự` : `${visible.length} / ${cfg.employees.length} nhân sự`}
      </div>
      <div className={`hidden border-y border-slate-800 px-3.5 py-2 text-[11px] uppercase tracking-wider text-slate-500 ${COLS}`}>
        <div>Mã NV</div><div>Họ và tên</div><div>Vai trò</div><div>Tên đăng nhập</div><div>Mật khẩu</div><div>Dự án đang tham gia</div><div></div>
      </div>
      {cfg.employees.length === 0 ? <div className="px-4 py-7 text-center text-sm text-slate-500">Chưa có nhân sự.</div>
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
              {a.isAdmin && adminBadge}{a.disabled && lockedBadge}
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
  const dlgTitle = !dlg ? "" : dlg.kind === "emp" ? (dlg.empId ? "Sửa nhân sự" : "Thêm nhân sự") : (dlg.accId ? "Sửa tài khoản" : "Thêm tài khoản quản lý");
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
          {dlg.kind === "emp" && (
            <label className="flex min-h-[32px] w-max cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={!!f.isAdmin} onChange={(e) => setF({ isAdmin: e.target.checked })} className="h-4 w-4 accent-teal-500" /> Quản lý
            </label>
          )}
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
        {[["emp", "Nhân sự", cfg.employees.length], ["admin", "Tài khoản quản lý", loose.length]].map(([k, l, n]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`h-9 whitespace-nowrap rounded-md px-4 text-sm ${sub === k ? "bg-slate-800 font-medium text-white" : "text-slate-400 hover:text-slate-200"}`}>
            {l}<span className="ml-1.5 font-mono text-xs text-slate-500">{n}</span>
          </button>
        ))}
      </div>

      {sub === "emp" ? empTab : adminTab}
      {formDlg}

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


/* ============================ HẠNG MỤC ============================ */
function Tasks({ cfg, saveCfg, flash }) {
  const [sub, setSub] = useState("task");               // tab con: task | org | leave
  const [sel, setSel] = useState("");                   // ô tác vụ đang chọn: "r:<mã vai trò>" hoặc "shared"
  const [q, setQ] = useState("");                       // ô tìm vai trò
  const [drafts, setDrafts] = useState({});
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [pendingDel, setPendingDel] = useState(null);
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
    if (listOf(key).some((t) => t.name.toLowerCase() === nm.toLowerCase())) return flash("Ô này đã có tác vụ trùng tên.", "err");
    const ok = await saveCfg({ ...cfg, tasks: [...cfg.tasks, { id: uid("t"), name: nm, ...patchFor(key) }] });
    if (ok !== false) setDraft(key, "");
  };

  const commit = async () => {
    if (!editName.trim()) return flash("Tên tác vụ không được để trống.", "err");
    await saveCfg({ ...cfg, tasks: cfg.tasks.map((t) => (t.id === editId ? { ...t, name: editName.trim(), ...patchFor(editOwner) } : t)) });
    setEditId(null);
  };
  const startEdit = (t) => { setEditId(t.id); setEditName(t.name); setEditOwner(ownerOf(t)); };

  const confirmDel = async () => {
    const t = pendingDel; setPendingDel(null);
    if (!t) return;
    await saveCfg({ ...cfg, tasks: cfg.tasks.filter((x) => x.id !== t.id) });
    flash("Đã xoá tác vụ.");
  };

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
    await saveCfg({
      ...cfg,
      roles: roles.filter((x) => x.id !== r.id),
      tasks: cfg.tasks.flatMap((t) => {
        if (!taskRoles(t).includes(r.id)) return [t];
        const left = taskRoles(t).filter((x) => x !== r.id);
        return left.length ? [{ ...t, roles: left }] : [];
      }),
      employees: cfg.employees.map((e) => (e.role === r.id ? { ...e, role: "" } : e)),
    });
    flash("Đã xoá vai trò.");
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
                <div key={t.id} className="py-2 text-sm">
                  {editId === t.id ? (
                    <div className="flex flex-col gap-2 md:flex-row">
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditId(null); }} className={`min-w-0 md:flex-1 ${inputCls}`} />
                      <div className="flex gap-2">
                        <select value={editOwner} onChange={(e) => setEditOwner(e.target.value)} className={`min-w-0 flex-1 md:w-56 md:flex-none ${selectCls}`}>
                          {boxes.map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
                        </select>
                        <button onClick={commit} className={`${sqBtn} border-teal-800 text-teal-400`}><Check size={15} /></button>
                        <button onClick={() => setEditId(null)} className={`${sqBtn}`}><X size={15} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-baseline gap-1.5">
                        {t.code && <span className="shrink-0 font-mono text-[10px] text-teal-500">{t.code}</span>}
                        <span className="min-w-0 text-slate-200">{t.name}</span>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={() => startEdit(t)} className={iconBtn}><Pencil size={13} /></button>
                        <button onClick={() => setPendingDel(t)} className={`${iconBtn} hover:border-rose-800 hover:text-rose-400`}><Trash2 size={13} /></button>
                      </div>
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
            className={`h-9 whitespace-nowrap rounded-md px-4 text-sm ${sub === k ? "bg-slate-800 font-medium text-white" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
        ))}
      </div>

      {sub === "task" ? taskTab : sub === "org" ? orgTab : leaveTab}

      <ConfirmDialog
        open={!!pendingRoleDel}
        title={`Xoá vai trò ${pendingRoleDel ? roleLabel(pendingRoleDel.id) : ""}?`}
        desc={`${delRoleTaskCount} tác vụ của vai trò này sẽ bị xoá; ${delRoleEmpCount} nhân sự đang giữ vai trò này sẽ thành không phân vai trò (chỉ thấy tác vụ dùng chung). Giờ công đã chấm vẫn giữ, tác vụ bị xoá hiển thị là (tác vụ đã xoá).`}
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
        desc="Nhân sự sẽ không chọn được tác vụ này nữa. Giờ công đã chấm vẫn giữ nguyên, báo cáo sẽ hiển thị là (tác vụ đã xoá)."
        confirmLabel="Xoá tác vụ"
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
    </div>
  );
}

/* ============================ THIẾT LẬP ============================ */
function SettingsTab({ cfg, saveCfg, flash }) {
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
    flash("Đã lưu. Giờ chuẩn và ngưỡng OT áp dụng ngay cho toàn bộ nhân viên.");
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
    await commitDB((d) => { d.ts = {}; });
    flash("Đã xoá toàn bộ dữ liệu chấm công."); setConfirm("");
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <Panel title="Giai đoạn dự án">
        <p className="text-sm text-slate-400">
          Mỗi dòng chấm công phải chọn một giai đoạn. Nhờ đó biết được tỷ trọng công sức đổ vào đấu thầu so với thi công — con số này dùng để tính chi phí theo đuổi dự án.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PHASES.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${p.cls}`}>{p.id}</span>
                <span className="text-sm font-medium text-slate-100">{p.name}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{p.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Bốn giai đoạn này cố định trong hệ thống. Dữ liệu chấm công cũ chưa có giai đoạn sẽ được suy đoán theo nhóm của hạng mục công việc, nên cần rà lại nếu muốn số liệu chuẩn.
        </p>
      </Panel>

      <Panel title="Giờ chuẩn & ngưỡng cảnh báo">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {[["weekday", "Giờ chuẩn T2–T6"], ["sat", "Giờ chuẩn T7"], ["sun", "Giờ chuẩn CN"], ["satOt", "OT T7 tính từ"], ["maxDaily", "Cảnh báo vượt / ngày"]].map(([k, l]) => (
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
          <b className="text-slate-400">Giờ chuẩn</b> quyết định target và cảnh báo thiếu giờ. Đặt 0 cho một loại ngày nghĩa là ngày nghỉ — không báo thiếu, mọi giờ chấm vào tính hết thành OT.
          <br /><b className="text-slate-400">OT T7 tính từ</b> là mốc bắt đầu tính tăng ca riêng cho thứ 7: giờ chuẩn T7 vẫn là {h.sat || 0}h nhưng chỉ phần vượt {h.satOt ?? 8}h mới thành OT. Ngày thường tính OT ngay khi vượt giờ chuẩn.
          <br />Toàn bộ nhân viên lấy các thông số này từ đây — sửa ở đây là áp cho tất cả.
        </p>
      </Panel>

      <Panel title={`Ngày lễ, ngày nghỉ chung (${holidays.length})`}>
        <div className="grid gap-2 md:flex md:items-end md:gap-3">
          <DateField label="Ngày" value={holDate} onChange={setHolDate} className="md:w-44" />
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
          Ngày lễ áp dụng cho toàn công ty. Giờ công chấm vào ngày lễ được tính là OT toàn bộ.
          Lễ âm lịch như Tết Nguyên đán hay Giỗ Tổ đổi ngày dương mỗi năm nên để chế độ "Một lần" và khai lại đầu mỗi năm.
        </p>
      </Panel>

      <Panel title="Quy định chấm công">
        <div className="grid gap-3 md:flex md:flex-wrap md:items-end">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Hạn chốt công hàng tháng (ngày)</label>
            <input type="number" inputMode="numeric" min="1" max="28" value={day} onChange={(e) => setDay(Number(e.target.value))} className={`font-mono md:w-32 ${inputCls}`} />
          </div>
          <button onClick={async () => { await saveCfg({ ...cfg, deadlineDay: day }); flash("Đã lưu thiết lập."); }} className={btnPrimary}>Lưu thiết lập</button>
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
      <StorageDoctor />

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
