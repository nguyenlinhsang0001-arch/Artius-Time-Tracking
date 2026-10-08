/* ============================================================
   v1.7 — Đăng nhập bằng tài khoản (Supabase Auth)

   Nhân viên gõ TÊN ĐĂNG NHẬP, không gõ email. Supabase Auth bắt buộc định danh là email,
   nên tên đăng nhập được ghép thành một email nội bộ "<tên>@<LOGIN_DOMAIN>". Không có thư
   nào được gửi tới địa chỉ này. Giá trị LOGIN_DOMAIN phải trùng với api/accounts.js.

   Tạo / sửa / khoá tài khoản cần quyền service_role nên đi qua hàm server /api/accounts,
   trình duyệt không bao giờ giữ khoá đó.
   ============================================================ */
import { supabase } from "./storage.js";

const LOGIN_DOMAIN = import.meta.env.VITE_LOGIN_DOMAIN || "artius-time.local";

export const normUsername = (s) => String(s || "").trim().toLowerCase();
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const PASSWORD_MIN = 6;

// Quyền quản lý và nhân sự gắn với tài khoản nằm trong app_metadata — chỉ server sửa được
const whoOf = (session) => {
  const u = session?.user;
  if (!u) return null;
  const m = u.app_metadata || {};
  return {
    userId: u.id,
    username: m.username || String(u.email || "").split("@")[0],
    empId: m.emp_id || null,
    admin: m.artius_admin === true,
  };
};

export async function currentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return whoOf(data?.session);
}

export async function signIn(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${normUsername(username)}@${LOGIN_DOMAIN}`,
    password,
  });
  if (error) {
    const banned = /banned/i.test(error.message || "") || error.code === "user_banned";
    throw new Error(banned ? "Tài khoản đã bị khoá." : "Sai tên đăng nhập hoặc mật khẩu.");
  }
  return whoOf(data.session);
}

export async function signOut() {
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* phiên hỏng thì coi như đã thoát */ }
}

/* Gọi hàm server quản lý tài khoản. Ném Error với thông điệp tiếng Việt để hiện thẳng lên toast. */
export async function accountsApi(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  let res;
  try {
    res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Không kết nối được máy chủ tài khoản.");
  }
  let body = null;
  try { body = await res.json(); } catch { /* không phải JSON */ }
  if (!res.ok || !body) throw new Error(body?.error || `Máy chủ tài khoản lỗi (${res.status}).`);
  return body;
}
