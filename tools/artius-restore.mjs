#!/usr/bin/env node
/* ============================================================
   ARTIUS TIME — khôi phục từ file sao lưu (v13.62)

   Chạy trên máy, KHÔNG nằm trong app: cần service_role key nên không ai bấm nhầm,
   và app không còn đường nào ghi đè được toàn bộ dữ liệu.

     node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json            # chỉ xem, không ghi
     node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json --yes      # ghi đè những gì có trong file
     node tools/artius-restore.mjs ARTIUS_saoluu_2026-11-10.json --yes --wipe

   Mặc định là GHI ĐÈ, KHÔNG XOÁ: dòng nào có trong file thì ghi đè, dòng nào server đang có
   mà file không có thì giữ nguyên. Dùng khi mất một phần.
   --wipe xoá sạch bảng công và bảng kế hoạch trước khi nạp, để server giống hệt file.
   Dùng khi muốn quay về đúng thời điểm của bản sao lưu. Không lùi lại được.

   Biến môi trường (đặt trong tools/.env hoặc export sẵn):
     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE=eyJ...
   Lấy ở Supabase → Project Settings → API. KHÔNG commit file .env lên GitHub.

   service_role bỏ qua RLS, và trigger artius_ts_guard cũng tự bỏ qua khi auth.uid() là null,
   nên script ghi được cả ngày đã gửi, dự án đã đóng và tuần quá hạn.
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHUNK = 200;

const die = (msg) => { console.error(`\n  LỖI  ${msg}\n`); process.exit(1); };
const say = (msg = "") => console.log(msg);

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
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY;

/* ---------- tham số ---------- */
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const GO = args.includes("--yes");
const WIPE = args.includes("--wipe");
if (!file) die("thiếu tên file sao lưu.\n        node tools/artius-restore.mjs <file.json> [--yes] [--wipe]");
if (!existsSync(file)) die(`không thấy file ${file}`);
if (!URL_ || !KEY) die("thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE — xem tools/README.md");

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

const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const count = async (table) => {
  const { count: c, error } = await sb.from(table).select("*", { count: "exact", head: true });
  return error ? `lỗi: ${error.message}` : c;
};

const after0 = { ts: await count("artius_ts"), plan: await count("artius_plan"), snap: await count("artius_plan_snapshot") };
say("  Server đang có:");
say(`    artius_ts             ${after0.ts}`);
say(`    artius_plan           ${after0.plan}`);
say(`    artius_plan_snapshot  ${after0.snap}`);
say("");

const unreachable = [after0.ts, after0.plan, after0.snap].every((v) => typeof v === "string");
if (unreachable) die("không đọc được database — kiểm tra SUPABASE_URL và SUPABASE_SERVICE_ROLE trong tools/.env");

if (!GO) {
  say("  Chưa ghi gì cả. Thêm --yes để thực sự khôi phục.");
  say(WIPE ? "  (--wipe đang bật: sẽ XOÁ SẠCH bảng công và kế hoạch trước khi nạp.)" : "  (ghi đè những gì có trong file, không xoá dòng thừa — thêm --wipe nếu muốn giống hệt file.)");
  say("");
  process.exit(0);
}

/* ---------- ghi ---------- */
const chunks = (rows) => { const o = []; for (let i = 0; i < rows.length; i += CHUNK) o.push(rows.slice(i, i + CHUNK)); return o; };
const must = (label, error) => { if (error) die(`${label} — ${error.message}`); };

if (WIPE) {
  say("  Xoá sạch trước khi nạp…");
  must("xoá artius_ts", (await sb.from("artius_ts").delete().not("emp_id", "is", null)).error);
  must("xoá artius_plan", (await sb.from("artius_plan").delete().not("project_id", "is", null)).error);
  must("xoá artius_plan_snapshot", (await sb.from("artius_plan_snapshot").delete().not("id", "is", null)).error);
}

/* thiết lập: đọc rev đang có rồi ghi đè với rev + 1, để app đang mở nhận ra là đã đổi */
{
  const { data, error } = await sb.from("artius_config").select("rev").eq("id", "main").maybeSingle();
  must("đọc thiết lập", error);
  const value = JSON.stringify(cfg), updated_at = new Date().toISOString();
  const rev = (Number(data?.rev) || 0) + 1;
  must("ghi thiết lập", (await sb.from("artius_config").upsert({ id: "main", value, rev, updated_at }).select("rev")).error);
  say(`  Thiết lập   đã ghi (rev ${rev})`);
}

let done = 0;
for (const part of chunks(tsRows.map((r) => ({ ...r, updated_at: new Date().toISOString() })))) {
  must("ghi bảng công", (await sb.from("artius_ts").upsert(part, { onConflict: "emp_id,ym" })).error);
  done += part.length;
  process.stdout.write(`\r  Bảng công   ${done}/${tsRows.length}`);
}
say(tsRows.length ? "" : "  Bảng công   0");

if (planRows.length) {
  for (const part of chunks(planRows)) must("ghi lưới kế hoạch", (await sb.from("artius_plan").upsert(part, { onConflict: "year,project_id,role_id" })).error);
  say(`  Kế hoạch    ${planRows.length} dòng đã ghi`);
}
if (snapRows.length) {
  for (const part of chunks(snapRows)) must("ghi bản chốt", (await sb.from("artius_plan_snapshot").upsert(part, { onConflict: "id" })).error);
  say(`  Bản chốt    ${snapRows.length} đã ghi`);
}

/* ---------- đối chiếu lại ---------- */
say("");
say("  Server sau khi khôi phục:");
const after = { ts: await count("artius_ts"), plan: await count("artius_plan"), snap: await count("artius_plan_snapshot") };
say(`    artius_ts             ${after.ts}${WIPE && after.ts !== tsRows.length ? `  ← KHÁC file (${tsRows.length})` : ""}`);
say(`    artius_plan           ${after.plan}${WIPE && after.plan !== planRows.length ? `  ← KHÁC file (${planRows.length})` : ""}`);
say(`    artius_plan_snapshot  ${after.snap}${WIPE && after.snap !== snapRows.length ? `  ← KHÁC file (${snapRows.length})` : ""}`);
say("");
say("  Xong. Mở app, tải lại trang và kiểm tra vài bảng công và lưới kế hoạch.");
say("");
