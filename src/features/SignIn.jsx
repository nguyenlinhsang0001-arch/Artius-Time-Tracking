/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect } from "react";
import {
  Loader2, Lock,
} from "lucide-react";
import { askPermission } from "../push.js";
import { accountsApi, normUsername, USERNAME_RE, PASSWORD_MIN } from "../auth.js";
import { signIn as authSignIn } from "../auth.js";
import { BrandLogo, btnPrimary, inputCls } from "../core/ui.jsx";

/* ============================ SIGN IN ============================ */
export const LAST_USER_KEY = "artius:last-user";
export function SignIn({ onSignedIn, flash }) {
  const [mode, setMode] = useState(null);       // null = đang kiểm tra | "login" | "setup" (chưa có tài khoản nào)
  const [needPin, setNeedPin] = useState(false);
  // v4.1: nhớ tên đăng nhập lần trước trên máy này (không nhớ mật khẩu — việc đó để trình duyệt lo)
  const [username, setUsername] = useState(() => { try { return localStorage.getItem(LAST_USER_KEY) || ""; } catch { return ""; } });
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
    askPermission();   // v2.6: phải gọi ngay trong cú bấm để trình duyệt hiện hộp "Cho phép thông báo"
    if (busy) return;
    if (!username.trim() || !password) return flash("Nhập tên đăng nhập và mật khẩu.", "err");
    setBusy(true);
    try {
      const w = await authSignIn(username, password);
      try { localStorage.setItem(LAST_USER_KEY, normUsername(username)); } catch { /* bỏ qua */ }
      await onSignedIn(w);
    }
    catch (e) { flash(e.message, "err"); setBusy(false); }
  };

  /* Lần đầu sau khi nâng cấp: chưa có tài khoản nào, người nắm mã PIN quản lý cũ tạo tài khoản quản lý */
  const setup = async () => {
    askPermission();
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
      {/* v7.4: logo lớn trên màn đăng nhập (máy tính) */}
      <BrandLogo className="mx-auto mb-8 hidden h-24 w-auto md:block" />
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

