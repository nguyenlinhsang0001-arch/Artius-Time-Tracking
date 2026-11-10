#!/usr/bin/env node
/* ============================================================
   ARTIUS TIME — khôi phục từ file sao lưu (v13.63)

   KHÔNG cần cài gì. Chỉ cần Node 18 trở lên. Script gọi thẳng REST API của Supabase
   bằng fetch có sẵn trong Node, không import thư viện nào — nên chạy được ngay trong
   folder phiên bản trên D:\Time-Tracking, không cần node_modules.

     node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json            # chỉ xem, không ghi
     node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json --yes      # ghi đè những gì có trong file
     node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json --yes --wipe

   Mặc định GHI ĐÈ, KHÔNG XOÁ: dòng nào có trong file thì ghi đè, dòng nào server đang có
   mà file không có thì giữ nguyên. Dùng khi mất một phần.
   --wipe xoá sạch bảng công và hai bảng kế hoạch trước khi nạp, để server giống hệt file.
   Dùng khi muốn quay về đúng thời điểm của bản sao lưu. Không lùi lại được.

   Biến môi trường (đặt trong tools/.env cạnh file này, hoặc export sẵn):
     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE=eyJ...
   Lấy ở Supabase → Project Settings → API. Dùng key service_role, KHÔNG phải anon.
   KHÔNG commit file .env lên GitHub.

   service_role bỏ qua RLS, và trigger artius_ts_guard cũng tự bỏ qua khi auth.uid() là null,
   nên script ghi được cả ngày đã gửi, dự án đã đóng và tuần quá hạn.
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHUNK = 200;

const die = (msg) => { console.error(`\n  LỖI  ${msg}\n`); process.exit(1); };
const say = (msg = "") => console.log(msg);

if (Number(process.versions.node.split(".")[0]) < 18) die(`cần Node 18 trở lên, máy đang chạy Node ${process.versions.node}`);

/* ---------- biến môi trường: ưu tiên biến đã export, sau đó tools/.env ---------- */
const readEnvFile = () => {
  const f = join(HERE, ".env");
  if (!existsSync(f)) return {};
  const out = {};
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
};
const env = { ...readEnvFile(), ...process.env };
const BASE = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY;

/* ---------- tham số ---------- */
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const GO = args.includes("--yes");
const WIPE = args.includes("--wipe");
if (!file) die("thiếu tên file sao lưu.\n        node tools/artius-restore.mjs <file.json> [--yes] [--wipe]");
if (!existsSync(file)) die(`không thấy file ${file}`);
if (!BASE || !KEY) die("thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE — xem tools/README.md");

/* ---------- gọi REST API của Supabase bằng fetch có sẵn ---------- */
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const api = async (path, init = {}) => {
  let res;
  try { res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } }); }
  catch (e) { return { err: `không nối được tới ${BASE} — ${e.message}` }; }
  const text = await res.text();
  if (!res.ok) {
    let m = text;
    try { const j = JSON.parse(text); m = j.message || j.hint || text; } catch { /* giữ nguyên text */ }
    return { err: `${res.status} ${m}`.trim() };
  }
  return { res, text };
};

/* số dòng của một bảng: PostgREST trả về ở header Content-Range dạng "0-0/123" */
const count = async (table) => {
  const r = await api(`${table}?select=*`, { headers: { Prefer: "count=exact", Range: "0-0" } });
  if (r.err) return `lỗi: ${r.err}`;
  const cr = r.res.headers.get("content-range") || "";
  const v = Number(cr.split("/")[1]);
  return Number.isFinite(v) ? v : `lỗi: không đọc được số dòng (${cr || "thiếu Content-Range"})`;
};

/* ---------- đọc và kiểm file ---------- */
let dump;
try { dump = JSON.parse(readFileSync(file, "utf8")); } catch (e) { die(`file không phải JSON hợp lệ — ${e.message}`); }
if (dump?.app !== "artius-timesheet") die("file này không phải bản sao lưu của ARTIUS TIME.");
if (!dump.config || typeof dump.config !== "object") die("file thiếu phần thiết lập (config).");

const tsMap = dump.timesheets || {};
const planRows = Array.isArray(dump.plan) ? dump.plan : [];
const snapRows = Array.isArray(dump.snapshots) ? dump.snapshots : [];
const tsRows = Object.entries(tsMap).map(([k, v]) => {
  const i = k.indexOf(":");
  if (i < 1) die(`khoá bảng công không hợp lệ: "${k}"`);
  return { emp_id: k.slice(0, i), ym: k.slice(i + 1), value: typeof v === "string" ? v : JSON.stringify(v) };
});

const cfg = dump.config;
const n = (x) => (Array.isArray(x) ? x.length : 0);

say("");
say(`  File        ${file}`);
say(`  Xuất lúc    ${dump.at || "(không ghi)"} · bản app ${dump.appVersion || `v${dump.v || "?"}`}`);
say(`  Thiết lập   ${n(cfg.employees)} nhân sự · ${n(cfg.projects)} dự án · ${n(cfg.tasks)} tác vụ · ${n(cfg.roles)} vai trò`);
say(`  Bảng công   ${tsRows.length} dòng (nhân sự × tháng)`);
say(`  Kế hoạch    ${planRows.length} dòng · ${snapRows.length} bản chốt`);
if (dump.v < 2) say("  LƯU Ý       file đời cũ (v1), KHÔNG chứa lưới kế hoạch — khôi phục xong kế hoạch vẫn là của server.");
say("");

const before = { ts: await count("artius_ts"), plan: await count("artius_plan"), snap: await count("artius_plan_snapshot") };
say("  Server đang có:");
say(`    artius_ts             ${before.ts}`);
say(`    artius_plan           ${before.plan}`);
say(`    artius_plan_snapshot  ${before.snap}`);
say("");

if ([before.ts, before.plan, before.snap].every((v) => typeof v === "string")) {
  die("không đọc được database — kiểm tra SUPABASE_URL và SUPABASE_SERVICE_ROLE trong tools/.env");
}

if (!GO) {
  say("  Chưa ghi gì cả. Thêm --yes để thực sự khôi phục.");
  say(WIPE ? "  (--wipe đang bật: sẽ XOÁ SẠCH bảng công và hai bảng kế hoạch trước khi nạp.)"
           : "  (ghi đè những gì có trong file, không xoá dòng thừa — thêm --wipe nếu muốn giống hệt file.)");
  say("");
  process.exit(0);
}

/* ---------- ghi ---------- */
const chunks = (rows) => { const o = []; for (let i = 0; i < rows.length; i += CHUNK) o.push(rows.slice(i, i + CHUNK)); return o; };
const must = (label, r) => { if (r.err) die(`${label} — ${r.err}`); return r; };

const upsert = (table, rows, onConflict) =>
  api(`${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });

if (WIPE) {
  say("  Xoá sạch trước khi nạp…");
  must("xoá artius_ts", await api("artius_ts?emp_id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } }));
  must("xoá artius_plan", await api("artius_plan?project_id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } }));
  must("xoá artius_plan_snapshot", await api("artius_plan_snapshot?id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } }));
}

/* thiết lập: đọc rev đang có rồi ghi đè với rev + 1, để app đang mở nhận ra là đã đổi */
{
  const r = must("đọc thiết lập", await api("artius_config?id=eq.main&select=rev"));
  let cur = 0;
  try { cur = Number(JSON.parse(r.text)?.[0]?.rev) || 0; } catch { cur = 0; }
  const rev = cur + 1;
  must("ghi thiết lập", await upsert("artius_config",
    [{ id: "main", value: JSON.stringify(cfg), rev, updated_at: new Date().toISOString() }], "id"));
  say(`  Thiết lập   đã ghi (rev ${cur} → ${rev})`);
}

let done = 0;
for (const part of chunks(tsRows.map((r) => ({ ...r, updated_at: new Date().toISOString() })))) {
  must("ghi bảng công", await upsert("artius_ts", part, "emp_id,ym"));
  done += part.length;
  process.stdout.write(`\r  Bảng công   ${done}/${tsRows.length}`);
}
say(tsRows.length ? "" : "  Bảng công   0 (file không có dòng nào)");

if (planRows.length) {
  for (const part of chunks(planRows)) must("ghi lưới kế hoạch", await upsert("artius_plan", part, "year,project_id,role_id"));
  say(`  Kế hoạch    ${planRows.length} dòng đã ghi`);
}
if (snapRows.length) {
  for (const part of chunks(snapRows)) must("ghi bản chốt", await upsert("artius_plan_snapshot", part, "id"));
  say(`  Bản chốt    ${snapRows.length} đã ghi`);
}

/* ---------- đối chiếu lại ---------- */
const after = { ts: await count("artius_ts"), plan: await count("artius_plan"), snap: await count("artius_plan_snapshot") };
const mark = (got, want) => (WIPE && got !== want ? `   ← KHÁC file (${want})` : "");
say("");
say("  Server sau khi khôi phục:");
say(`    artius_ts             ${after.ts}${mark(after.ts, tsRows.length)}`);
say(`    artius_plan           ${after.plan}${mark(after.plan, planRows.length)}`);
say(`    artius_plan_snapshot  ${after.snap}${mark(after.snap, snapRows.length)}`);
say("");

/* Cột id của artius_plan_snapshot là bigserial. Nạp lại bằng id có sẵn KHÔNG đẩy bộ đếm lên,
   nên lần "Chốt bản" tiếp theo có thể đụng id đã tồn tại. Sau --wipe phải kéo bộ đếm lên tay. */
if (WIPE && snapRows.length) {
  say("  CÒN MỘT BƯỚC: mở Supabase → SQL Editor, chạy đúng câu này một lần:");
  say("");
  say("    select setval(pg_get_serial_sequence('artius_plan_snapshot','id'),");
  say("                  (select coalesce(max(id), 1) from artius_plan_snapshot));");
  say("");
  say("  Không chạy thì lần bấm \"Chốt bản\" sau sẽ báo lỗi trùng id.");
  say("");
}

say("  Xong. Mở app, tải lại trang, kiểm tra vài bảng công và lưới kế hoạch.");
say("");
