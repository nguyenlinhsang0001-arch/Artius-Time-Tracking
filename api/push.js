/* ============================================================
   ARTIUS v2.6 — Thông báo nhắc nộp bảng công trên máy tính (Web Push)
   Đường dẫn: POST /api/push   ·   body JSON: { action, ... }

   Biến môi trường cần có trên Vercel (xem README):
     VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   cặp khoá ký thông báo (tạo một lần, không đổi về sau)
     VAPID_SUBJECT                         tuỳ chọn, mặc định "mailto:admin@artius.vn"
     CRON_SECRET                           chuỗi bí mật, lịch Supabase gửi kèm để chạy đợt nhắc
     SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL   đã có từ v1.7

   action:
     key          (không cần đăng nhập)  -> { publicKey }
     subscribe    (đã đăng nhập)         -> lưu trình duyệt này để nhận thông báo
     unsubscribe  (đã đăng nhập)         -> bỏ trình duyệt này
     test         (đã đăng nhập)         -> gửi thử một thông báo tới các trình duyệt của chính mình
     cron         (header x-cron-secret) -> chạy đợt nhắc nếu tới lịch; gọi 15 phút/lần từ Supabase
   ============================================================ */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { vnNow, dueReminders, missingDays, messageFor, normReminders } from "./_reminders.js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@artius.vn";
const CRON_SECRET = process.env.CRON_SECRET || "";
const TTL = 3 * 24 * 3600;          // máy chủ push giữ thông báo tối đa 3 ngày nếu trình duyệt đang tắt
const TOPIC = "artius-nhac";        // cùng topic: thông báo mới thay thông báo cũ chưa nhận, không dồn đống

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const dbFail = (what, error) => new HttpError(500, `${what}: ${error?.message || "lỗi không rõ"}`);

async function requireMember(sb, req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Chưa đăng nhập.");
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Phiên đăng nhập hết hạn. Đăng nhập lại.");
  const { data: row, error: e2 } = await sb.from("artius_accounts").select("id,emp_id,disabled,is_admin").eq("id", data.user.id).maybeSingle();
  if (e2) throw dbFail("Đọc tài khoản", e2);
  if (!row || row.disabled) throw new HttpError(403, "Tài khoản không hợp lệ hoặc đã bị khoá.");
  return row;
}

const vapidReady = () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) throw new HttpError(500, "Thiếu biến môi trường VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY trên Vercel.");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
};

/* Gửi một thông báo tới mọi trình duyệt của một danh sách dòng artius_push.
   Trình duyệt đã gỡ quyền / hết hạn (404, 410) thì xoá khỏi bảng. Trả về số thiết bị nhận thành công. */
async function sendTo(sb, subs, payload) {
  let ok = 0;
  const dead = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL, topic: TOPIC, urgency: "normal" },
      );
      ok += 1;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint);
    }
  }));
  if (dead.length) await sb.from("artius_push").delete().in("endpoint", dead);
  return ok;
}

const actions = {
  async key() {
    if (!VAPID_PUBLIC) throw new HttpError(500, "Chưa cấu hình VAPID_PUBLIC_KEY trên Vercel.");
    return { publicKey: VAPID_PUBLIC };
  },

  async subscribe(sb, req, body) {
    const me = await requireMember(sb, req);
    const sub = body.subscription || {};
    const endpoint = String(sub.endpoint || "");
    const p256dh = String(sub.keys?.p256dh || "");
    const auth = String(sub.keys?.auth || "");
    if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw new HttpError(400, "Thông tin đăng ký thông báo không hợp lệ.");
    // cùng một trình duyệt đổi người đăng nhập thì chuyển sang người mới (khoá chính là endpoint)
    const { error } = await sb.from("artius_push").upsert({
      endpoint, p256dh, auth, user_id: me.id, emp_id: me.emp_id || null,
      ua: String(body.ua || "").slice(0, 200), seen_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw dbFail("Lưu đăng ký thông báo (đã chạy schema.sql v2.6 chưa?)", error);
    return { ok: true };
  },

  async unsubscribe(sb, req, body) {
    const me = await requireMember(sb, req);
    const { error } = await sb.from("artius_push").delete().eq("endpoint", String(body.endpoint || "")).eq("user_id", me.id);
    if (error) throw dbFail("Bỏ đăng ký thông báo", error);
    return { ok: true };
  },

  async test(sb, req) {
    vapidReady();
    const me = await requireMember(sb, req);
    const { data: subs, error } = await sb.from("artius_push").select("*").eq("user_id", me.id);
    if (error) throw dbFail("Đọc đăng ký thông báo", error);
    if (!subs?.length) throw new HttpError(400, "Trình duyệt này chưa bật thông báo cho ARTIUS.");
    const n = await sendTo(sb, subs, {
      title: "ARTIUS — Thông báo thử",
      body: "Máy này đã nhận được thông báo nhắc nộp bảng công.",
      url: "/",
    });
    return { devices: subs.length, delivered: n };
  },

  async cron(sb, req) {
    const secret = req.headers["x-cron-secret"] || "";
    if (!CRON_SECRET || secret !== CRON_SECRET) throw new HttpError(401, "Sai mã lịch chạy.");
    vapidReady();

    const { data: cfgRow, error: e1 } = await sb.from("artius_config").select("value").eq("id", "main").maybeSingle();
    if (e1) throw dbFail("Đọc thiết lập", e1);
    let cfg = {};
    try { cfg = JSON.parse(cfgRow?.value || "{}"); } catch { cfg = {}; }

    const now = vnNow();
    const jobs = dueReminders(cfg.reminders, now);
    if (!jobs.length) return { now, due: 0 };   // chưa tới lịch: thoát ngay, không đọc thêm gì

    // Chỉ nhắc nhân sự có tài khoản đang hoạt động và đã bật thông báo ở ít nhất một trình duyệt
    const { data: accts, error: e2 } = await sb.from("artius_accounts").select("emp_id").eq("disabled", false).not("emp_id", "is", null);
    if (e2) throw dbFail("Đọc tài khoản", e2);
    const { data: subs, error: e3 } = await sb.from("artius_push").select("*").not("emp_id", "is", null);
    if (e3) throw dbFail("Đọc đăng ký thông báo", e3);
    const subsByEmp = new Map();
    for (const s of subs || []) { if (!subsByEmp.has(s.emp_id)) subsByEmp.set(s.emp_id, []); subsByEmp.get(s.emp_id).push(s); }
    const emps = [...new Set((accts || []).map((a) => a.emp_id))].filter((id) => subsByEmp.has(id));

    const report = [];
    for (const job of jobs) {
      const { data: done, error: e4 } = await sb.from("artius_push_log").select("emp_id").eq("kind", job.kind).eq("period", job.period);
      if (e4) throw dbFail("Đọc nhật ký nhắc", e4);
      const already = new Set((done || []).map((x) => x.emp_id));
      const todo = emps.filter((id) => !already.has(id));
      if (!todo.length) { report.push({ ...job, sent: 0 }); continue; }

      // Đọc bảng công đúng các tháng của đợt nhắc, chỉ của những người cần xét
      const yms = [...new Set([job.from.slice(0, 7), job.to.slice(0, 7)])];
      const { data: rows, error: e5 } = await sb.from("artius_ts").select("emp_id,ym,value").in("ym", yms).in("emp_id", todo);
      if (e5) throw dbFail("Đọc bảng công", e5);
      const bucketsByEmp = new Map();
      for (const r of rows || []) {
        let v = null; try { v = JSON.parse(r.value); } catch { v = null; }
        if (!v) continue;
        if (!bucketsByEmp.has(r.emp_id)) bucketsByEmp.set(r.emp_id, {});
        bucketsByEmp.get(r.emp_id)[r.ym] = v;
      }

      let sent = 0;
      for (const emp of todo) {
        const days = missingDays({ from: job.from, to: job.to, today: now.date, hours: cfg.hours, holidays: cfg.holidays, buckets: bucketsByEmp.get(emp) || {} });
        if (!days.length) continue;
        // ghi nhật ký TRƯỚC khi gửi: hai lần chạy chồng nhau thì chỉ một lần ghi được, không gửi trùng
        const { data: ins, error: e6 } = await sb.from("artius_push_log")
          .upsert({ kind: job.kind, period: job.period, emp_id: emp, missing: days.length }, { onConflict: "kind,period,emp_id", ignoreDuplicates: true })
          .select("emp_id");
        if (e6) throw dbFail("Ghi nhật ký nhắc", e6);
        if (!ins?.length) continue;
        const n = await sendTo(sb, subsByEmp.get(emp), messageFor(job, days, cfg.deadlineDay || 5));
        if (n > 0) { sent += 1; await sb.from("artius_push_log").update({ devices: n }).eq("kind", job.kind).eq("period", job.period).eq("emp_id", emp); }
        else await sb.from("artius_push_log").delete().eq("kind", job.kind).eq("period", job.period).eq("emp_id", emp); // không máy nào nhận: lần chạy sau thử lại
      }
      report.push({ kind: job.kind, period: job.period, sent });
    }
    return { now, reminders: normReminders(cfg.reminders), report };
  },
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ nhận POST." });
  if (!URL || !SERVICE_KEY) return res.status(500).json({ error: "Thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY trên Vercel." });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const fn = Object.prototype.hasOwnProperty.call(actions, body.action) ? actions[body.action] : null;
    if (!fn) throw new HttpError(400, "Yêu cầu không hợp lệ.");
    const sb = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    return res.status(200).json(await fn(sb, req, body));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return res.status(status).json({ error: e?.message || "Lỗi máy chủ." });
  }
}
export { actions };   // để kiểm thử từng action độc lập (Vercel chỉ dùng export default)
