/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */


export const ALLOC_PAL = ["#2dd4bf", "#f59e0b", "#60a5fa", "#a78bfa", "#f472b6", "#34d399", "#fb923c", "#38bdf8", "#c084fc", "#facc15", "#4ade80", "#f87171"];
export const allocLimits = (cfg) => ({
  over: Math.max(100, Number(cfg?.allocOver) || 110),
  under: Math.min(100, Math.max(0, Number(cfg?.allocUnder ?? 90))),
});
export const ALLOC_ST = {
  hi: ["Quá tải", "border-rose-900 bg-rose-950 text-rose-300"],
  lo: ["Thiếu giờ", "border-amber-900 bg-amber-950/70 text-amber-300"],
  ok: ["Bình thường", "border-teal-900 bg-teal-950 text-teal-300"],
  idle: ["Trống việc", "border-slate-600 bg-slate-800 text-slate-300"],   // v7.2
};
/* v7.2 — trạng thái tải: t = tổng giờ, o = OT, c = cố gắng, i = trống việc, sd = giờ chuẩn kỳ.
   Tải = t − i. Quá tải: tải > over%. Bình thường: giờ chuẩn (không gồm trống việc) ≥ under%.
   Trống việc: chưa đủ under% nhưng cộng trống việc vào thì đủ (thiếu việc, không phải chấm thiếu). Còn lại: Thiếu giờ. */
export const allocState = (t, o, c, i, sd, lim) => {
  if (!(sd > 0)) return "ok";
  const s = Math.max(0, t - o - c - i);
  if (t - i > (sd * lim.over) / 100) return "hi";
  if (s >= (sd * lim.under) / 100) return "ok";
  return s + i >= (sd * lim.under) / 100 ? "idle" : "lo";
};
