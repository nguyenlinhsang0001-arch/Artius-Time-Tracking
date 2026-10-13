import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Thứ tự import có ý nghĩa: storage.js phải chạy trước App (xem ghi chú trong storage.js)
import { STORAGE_CONFIGURED } from "./storage.js";
import App from "./artius-timesheet_v2_6.jsx";

function MissingConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
      <div className="max-w-md rounded-lg border border-rose-900 bg-slate-900 p-5 text-sm">
        <div className="text-base text-rose-300">Chưa cấu hình Supabase</div>
        <p className="mt-2 text-slate-400">
          Thiếu biến môi trường VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Khai báo trong
          Vercel → Settings → Environment Variables rồi Redeploy. Xem README.md.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>{STORAGE_CONFIGURED ? <App /> : <MissingConfig />}</React.StrictMode>
);
