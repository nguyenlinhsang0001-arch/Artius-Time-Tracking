/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect } from "react";

/* v7.8 — Giao diện: Tối / Sáng / Theo máy — lưu riêng từng máy (localStorage "artius:theme"), mặc định Tối.
   "Theo máy" đi theo cài đặt sáng/tối của Windows, macOS hoặc điện thoại (tự đổi khi máy đổi).
   Sáng = CSS đảo màu đặt dưới html[data-theme="light"] (LIGHT_CSS, sinh từ class Tailwind); Tối = giao diện cũ, không đổi. */
export const THEME_KEY = "artius:theme";
export const readPref = () => { try { const v = localStorage.getItem(THEME_KEY); return v === "light" || v === "system" ? v : "dark"; } catch { return "dark"; } };
export const sysLight = () => { try { return window.matchMedia("(prefers-color-scheme: light)").matches; } catch { return false; } };
export const effTheme = (pref) => (pref === "system" ? (sysLight() ? "light" : "dark") : pref);
export const applyTheme = (t) => {
  try {
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#f1f5f9" : "#020617");
  } catch { /* bỏ qua */ }
};
applyTheme(effTheme(readPref()));
try {   // máy đổi sáng/tối khi đang chọn "Theo máy" → đổi theo ngay
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (readPref() === "system") { applyTheme(effTheme("system")); window.dispatchEvent(new Event("artius:theme")); }
  });
} catch { /* trình duyệt cũ: bỏ qua */ }
export const isLight = () => { try { return document.documentElement.dataset.theme === "light"; } catch { return false; } };   // đọc lúc vẽ: App vẽ lại khi đổi giao diện
export function useTheme() {
  const [pref, setPrefState] = useState(readPref);
  const [, bump] = useState(0);
  useEffect(() => { const f = () => { setPrefState(readPref()); bump((n) => n + 1); }; window.addEventListener("artius:theme", f); return () => window.removeEventListener("artius:theme", f); }, []);
  const setPref = (p) => { try { localStorage.setItem(THEME_KEY, p); } catch { /* không lưu được: chỉ đổi cho phiên này */ } applyTheme(effTheme(p)); setPrefState(p); window.dispatchEvent(new Event("artius:theme")); };
  return [effTheme(pref), setPref, pref];
}
