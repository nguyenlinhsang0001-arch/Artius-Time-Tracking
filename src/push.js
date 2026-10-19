/* ============================================================
   ARTIUS v2.6 — Thông báo nhắc nộp bảng công (phía trình duyệt)

   · askPermission(): gọi NGAY trong lúc người dùng bấm (Đăng nhập, hoặc cú bấm đầu tiên trong app),
     để trình duyệt hiện hộp "Cho phép thông báo" của chính nó. App không hiện hộp hỏi riêng.
   · syncPush(): khi đã được phép, đăng ký trình duyệt này với máy chủ push và lưu lên /api/push.
     Gọi lại mỗi lần mở app cũng an toàn (cập nhật lại nếu trình duyệt đổi khoá).
   ============================================================ */
import { supabase } from "./storage.js";

export const pushSupported = () =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

export const pushPermission = () => (pushSupported() ? Notification.permission : "unsupported");

async function api(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  let body = null;
  try { body = await res.json(); } catch { /* không phải JSON */ }
  if (!res.ok || !body) throw new Error(body?.error || `Máy chủ thông báo lỗi (${res.status}).`);
  return body;
}

const b64ToBytes = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

let syncing = null;
export function syncPush() {
  if (!pushSupported() || Notification.permission !== "granted") return Promise.resolve(pushPermission());
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) return "no-session";
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { publicKey } = await api("key");
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      }
      await api("subscribe", { subscription: sub.toJSON(), ua: navigator.userAgent });
      return "granted";
    } catch (e) {
      console.warn("[ARTIUS] Chưa đăng ký được thông báo:", e?.message || e);
      return "error";
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/* Gọi đồng bộ trong trình xử lý cú bấm. Trình duyệt chỉ hỏi khi quyền đang ở trạng thái "default";
   đã cho phép hoặc đã chặn thì không hỏi lại. */
export function askPermission() {
  if (!pushSupported() || Notification.permission !== "default") return Promise.resolve(pushPermission());
  let p;
  try { p = Notification.requestPermission(); } catch { return Promise.resolve("default"); }
  return Promise.resolve(p).then((r) => { if (r === "granted") syncPush(); return r; }).catch(() => "default");
}

export const sendTestPush = () => api("test");

/* v5.9 — Quản lý bấm chuông ở Bảng công: gửi thông báo nhắc nộp tuần [from, to] tới các nhân sự empIds.
   Trả về { sent: [empId], noDevice: [empId] } (noDevice = người chưa bật thông báo trên máy nào). */
export const sendNudge = (empIds, from, to, weeks) => api("nudge", { empIds, from, to, ...(weeks?.length ? { weeks } : {}) });

/* v5.9 — Những lần quản lý đã nhắc trong tuần bắt đầu từ thứ Hai `monday` (nhật ký kind 'manual'). */
export async function fetchNudgeLog(monday) {
  const { data, error } = await supabase.from("artius_push_log").select("emp_id,sent_at,period").eq("kind", "manual").like("period", `${monday}@%`).order("sent_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

/* v6.4 — Nhật ký nhắc của nhiều tuần liền nhau (thứ Hai firstMonday … lastMonday), cho chuông ở bảng Tháng. */
export async function fetchNudgeLogRange(firstMonday, lastMonday) {
  const { data, error } = await supabase.from("artius_push_log").select("emp_id,sent_at,period").eq("kind", "manual")
    .gte("period", firstMonday).lte("period", `${lastMonday}@\uffff`).order("sent_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

/* Màn quản lý: ai đã bật thông báo (ít nhất một trình duyệt) và các lần nhắc gần nhất. Chỉ tài khoản quản lý đọc được. */
export async function fetchPushStatus() {
  const [a, b] = await Promise.all([
    supabase.from("artius_push").select("emp_id,seen_at"),
    supabase.from("artius_push_log").select("kind,period,emp_id,missing,devices,sent_at").neq("kind", "test").order("sent_at", { ascending: false }).limit(40),
  ]);
  if (a.error) throw new Error(`Đọc danh sách thông báo: ${a.error.message} (đã chạy schema.sql v2.6 chưa?)`);
  if (b.error) throw new Error(`Đọc nhật ký nhắc: ${b.error.message}`);
  return { subs: a.data || [], log: b.data || [] };
}
