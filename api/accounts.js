/* ============================================================
   ARTIUS v1.7 — Hàm server quản lý tài khoản (Vercel Serverless Function)
   Đường dẫn: POST /api/accounts   ·   body JSON: { action, ... }

   Hàm này là nơi DUY NHẤT dùng khoá service_role. Biến môi trường cần có trên Vercel:
     SUPABASE_SERVICE_ROLE_KEY   khoá service_role / secret (KHÔNG có tiền tố VITE_)
     VITE_SUPABASE_URL           đã có từ v1.4, dùng lại
     VITE_LOGIN_DOMAIN           tuỳ chọn; phải trùng với src/auth.js

   action:
     status      (không cần đăng nhập)  -> { hasAccounts, needPin }
     bootstrap   (không cần đăng nhập)  -> tạo tài khoản quản lý đầu tiên; chỉ chạy khi chưa có
                                           tài khoản nào và phải nhập đúng mã PIN quản lý cũ
     list / save / setDisabled / remove -> chỉ tài khoản Admin

   v7.3 — cấp quyền (cột access): emp = Nhân viên, head = Trưởng phòng, bod = BOD (chỉ xem), admin = Admin.
          is_admin luôn ghi bằng (access === "admin") để các hàm cũ vẫn đúng. Trưởng phòng phải gắn với một nhân sự
          (phòng ban lấy theo nhân sự đó).
   ============================================================ */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOGIN_DOMAIN = process.env.VITE_LOGIN_DOMAIN || "artius-time.local";
const ACCOUNTS = "artius_accounts";
const KV = "artius_kv";
const DB_KEY = "artius:db:v1";
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const PASSWORD_MIN = 6;
const BAN_FOREVER = "876000h"; // ~100 năm
const LEVELS = ["emp", "head", "bod", "admin"];
const accessOf = (r) => (LEVELS.includes(r?.access) ? r.access : r?.is_admin ? "admin" : "emp");

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);

const emailOf = (username) => `${username}@${LOGIN_DOMAIN}`;
const normUsername = (s) => String(s || "").trim().toLowerCase();
const publicRow = (r) => ({
  id: r.id, empId: r.emp_id, username: r.username, password: r.password,
  access: accessOf(r), isAdmin: accessOf(r) === "admin", disabled: !!r.disabled,
});
/* v7.3: nhận access; bản app cũ chỉ gửi isAdmin thì quy về admin / emp */
function levelOf(body, empId) {
  const a = LEVELS.includes(body.access) ? body.access : body.isAdmin ? "admin" : "emp";
  if (a === "head" && !empId) throw bad("Trưởng phòng phải gắn với một nhân sự (để biết phòng ban).");
  if (a === "emp" && !empId) throw bad("Tài khoản không gắn nhân sự chỉ được là BOD hoặc Admin.");
  return a;
}

function checkCredentials(username, password) {
  if (!USERNAME_RE.test(username)) {
    throw bad("Tên đăng nhập 3–30 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, gạch.");
  }
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    throw bad(`Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.`);
  }
}

const dbFail = (what, error) => new HttpError(500, `${what}: ${error?.message || "lỗi không rõ"}`);

async function requireAdmin(sb, req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Chưa đăng nhập.");
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Phiên đăng nhập hết hạn. Đăng nhập lại.");
  // Bảng tài khoản là nguồn quyết định quyền, không tin riêng nội dung token
  const { data: row, error: e2 } = await sb.from(ACCOUNTS).select("*").eq("id", data.user.id).maybeSingle();
  if (e2) throw dbFail("Đọc tài khoản", e2);
  if (!row || row.disabled || accessOf(row) !== "admin") throw new HttpError(403, "Chỉ tài khoản Admin được quản lý tài khoản.");
  return row;
}

async function createAccount(sb, { empId, username, password, access }) {
  const isAdmin = access === "admin";
  const { data, error } = await sb.auth.admin.createUser({
    email: emailOf(username), password, email_confirm: true,
    app_metadata: { username, emp_id: empId || null, artius_admin: isAdmin, artius_access: access },
  });
  if (error || !data?.user) {
    if (/already|registered|exists/i.test(error?.message || "")) throw bad("Tên đăng nhập đã có người dùng.");
    throw dbFail("Tạo tài khoản", error);
  }
  const row = { id: data.user.id, emp_id: empId || null, username, password, is_admin: isAdmin, access, disabled: false };
  const { error: e2 } = await sb.from(ACCOUNTS).insert(row);
  if (e2) {
    await sb.auth.admin.deleteUser(data.user.id); // không để lại tài khoản mồ côi
    throw dbFail("Lưu tài khoản", e2);
  }
  return row;
}

const actions = {
  async status(sb) {
    const { count, error } = await sb.from(ACCOUNTS).select("id", { count: "exact", head: true });
    if (error) throw dbFail("Đọc bảng tài khoản (đã chạy supabase/schema.sql chưa?)", error);
    if (count > 0) return { hasAccounts: true, needPin: false };
    return { hasAccounts: false, needPin: !!(await readAdminPin(sb)) };
  },

  async bootstrap(sb, _req, body) {
    const { count, error } = await sb.from(ACCOUNTS).select("id", { count: "exact", head: true });
    if (error) throw dbFail("Đọc bảng tài khoản", error);
    if (count > 0) throw new HttpError(403, "Đã có tài khoản. Đăng nhập bằng tài khoản quản lý.");
    const pin = await readAdminPin(sb);
    if (pin && String(body.pin || "") !== pin) throw new HttpError(403, "Sai mã PIN quản lý.");
    const username = normUsername(body.username);
    checkCredentials(username, body.password);
    await createAccount(sb, { empId: null, username, password: body.password, access: "admin" });
    return { ok: true };
  },

  async list(sb, req) {
    await requireAdmin(sb, req);
    const { data, error } = await sb.from(ACCOUNTS).select("*").order("username");
    if (error) throw dbFail("Đọc danh sách tài khoản", error);
    return { accounts: (data || []).map(publicRow) };
  },

  /* Tạo mới (không có id) hoặc cập nhật (có id). */
  async save(sb, req, body) {
    const me = await requireAdmin(sb, req);
    const username = normUsername(body.username);
    checkCredentials(username, body.password);
    const empId = body.empId || null;

    if (!body.id) {
      if (empId) {
        const { data: dup, error } = await sb.from(ACCOUNTS).select("id").eq("emp_id", empId).maybeSingle();
        if (error) throw dbFail("Kiểm tra tài khoản", error);
        if (dup) throw bad("Nhân sự này đã có tài khoản.");
      }
      const { data: taken, error: e0 } = await sb.from(ACCOUNTS).select("id").eq("username", username).maybeSingle();
      if (e0) throw dbFail("Kiểm tra tên đăng nhập", e0);
      if (taken) throw bad("Tên đăng nhập đã có người dùng.");
      return { account: publicRow(await createAccount(sb, { empId, username, password: body.password, access: levelOf(body, empId) })) };
    }

    const { data: cur, error } = await sb.from(ACCOUNTS).select("*").eq("id", body.id).maybeSingle();
    if (error) throw dbFail("Đọc tài khoản", error);
    if (!cur) throw new HttpError(404, "Không tìm thấy tài khoản.");
    const access = levelOf(body, cur.emp_id);
    const isAdmin = access === "admin";
    if (cur.id === me.id && !isAdmin) throw bad("Không thể tự bỏ quyền Admin của chính mình.");
    if (username !== cur.username) {
      const { data: taken, error: e0 } = await sb.from(ACCOUNTS).select("id").eq("username", username).maybeSingle();
      if (e0) throw dbFail("Kiểm tra tên đăng nhập", e0);
      if (taken) throw bad("Tên đăng nhập đã có người dùng.");
    }
    const { error: e1 } = await sb.auth.admin.updateUserById(cur.id, {
      email: emailOf(username), password: body.password, email_confirm: true,
      app_metadata: { username, emp_id: cur.emp_id, artius_admin: isAdmin, artius_access: access },
    });
    if (e1) throw dbFail("Cập nhật tài khoản", e1);
    const patch = { username, password: body.password, is_admin: isAdmin, access, updated_at: new Date().toISOString() };
    const { error: e2 } = await sb.from(ACCOUNTS).update(patch).eq("id", cur.id);
    if (e2) throw dbFail("Lưu tài khoản", e2);
    return { account: publicRow({ ...cur, ...patch }) };
  },

  async setDisabled(sb, req, body) {
    const me = await requireAdmin(sb, req);
    const disabled = !!body.disabled;
    if (body.id === me.id) throw bad("Không thể tự khoá tài khoản của chính mình.");
    const { data: cur, error } = await sb.from(ACCOUNTS).select("*").eq("id", body.id).maybeSingle();
    if (error) throw dbFail("Đọc tài khoản", error);
    if (!cur) throw new HttpError(404, "Không tìm thấy tài khoản.");
    // Khoá ở bảng tài khoản trước: database chặn đọc/ghi ngay, kể cả phiên đang mở
    const { error: e2 } = await sb.from(ACCOUNTS).update({ disabled, updated_at: new Date().toISOString() }).eq("id", cur.id);
    if (e2) throw dbFail("Lưu trạng thái khoá", e2);
    const { error: e1 } = await sb.auth.admin.updateUserById(cur.id, { ban_duration: disabled ? BAN_FOREVER : "none" });
    if (e1) throw dbFail("Khoá đăng nhập", e1);
    return { account: publicRow({ ...cur, disabled }) };
  },

  async remove(sb, req, body) {
    const me = await requireAdmin(sb, req);
    if (body.id === me.id) throw bad("Không thể tự xoá tài khoản của chính mình.");
    const { error: e2 } = await sb.from(ACCOUNTS).delete().eq("id", body.id);
    if (e2) throw dbFail("Xoá tài khoản", e2);
    const { error: e1 } = await sb.auth.admin.deleteUser(body.id);
    if (e1 && !/not found/i.test(e1.message || "")) throw dbFail("Xoá đăng nhập", e1);
    return { ok: true };
  },
};

/* Mã PIN quản lý của bản v1.6 nằm trong cấu hình dùng chung. Chỉ dùng một lần, để xác nhận
   người tạo tài khoản quản lý đầu tiên đúng là ban quản lý. */
async function readAdminPin(sb) {
  const { data, error } = await sb.from(KV).select("value").eq("key", DB_KEY).maybeSingle();
  if (error) throw dbFail("Đọc cấu hình", error);
  if (!data?.value) return "";
  try { return String(JSON.parse(data.value)?.config?.adminPin || ""); } catch { return ""; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ nhận POST." });
  if (!URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY trên Vercel." });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const fn = Object.prototype.hasOwnProperty.call(actions, body.action) ? actions[body.action] : null;
    if (!fn) throw bad("Yêu cầu không hợp lệ.");
    const sb = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    return res.status(200).json(await fn(sb, req, body));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return res.status(status).json({ error: e?.message || "Lỗi máy chủ." });
  }
}
