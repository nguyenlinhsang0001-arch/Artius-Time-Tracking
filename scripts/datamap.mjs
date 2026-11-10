#!/usr/bin/env node
/* ======================================================================================
   SƠ ĐỒ CẤU TRÚC ARTIUS TIME — tự quét code, tự kiểm tra, so với bản trước
   Chạy:  npm run datamap            (hoặc: node scripts/datamap.mjs [--out <file.html>])

   Đọc:  supabase/*.sql   → bảng, cột, RLS / policy, quyền (grant), hàm, trigger
         src/, api/        → ai đọc / ghi thiết lập (cfg.*), bảng, hàm SQL (rpc), localStorage,
                             hàm tính (theo tên hàm được import)
         docs/cau-truc.json → bản thiết kế chuẩn: tên tiếng Việt, nhóm, liên kết nghiệp vụ, rủi ro rà tay
   Ghi:  docs/so-do/ARTIUS-TIME_so-do-cau-truc.html  (không nằm trong bản deploy Vercel)
         docs/cau-truc.lock.json                       (ảnh chụp cấu trúc để so lần sau)

   Script KHÔNG chạy app, không kết nối database: chỉ đọc chữ trong file. Vì vậy nó bắt được lỗi
   cấu trúc (thiếu, thừa, chồng chéo, sai quyền, lệch thiết kế) nhưng không biết công thức đúng hay sai.
   Node 18+, không cần cài thêm gói nào.
   ====================================================================================== */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const args = process.argv.slice(2);
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = argOf("--out") || "docs/so-do/ARTIUS-TIME_so-do-cau-truc.html";
const LOCK = "docs/cau-truc.lock.json";
const MANIFEST = "docs/cau-truc.json";
const uniq = (a) => [...new Set(a)];

function walk(dir, exts) {
  const out = [], abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(dir, e.name).split(path.sep).join("/");
    if (e.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out.sort();
}
/* "src/features/planning/*" = mọi file trong thư mục đó (kể cả thư mục con); còn lại so đúng đường dẫn */
const globHit = (pat, f) => (pat.endsWith("/*") ? f.startsWith(pat.slice(0, -1)) : pat.includes("*") ? new RegExp("^" + pat.replace(/[.]/g, "\\.").replace(/\*/g, "[^/]*") + "$").test(f) : pat === f);
const lineAt = (text, idx) => { let n = 1; for (let i = 0; i < idx && i < text.length; i++) if (text.charCodeAt(i) === 10) n++; return n; };

/* ======================================================================================
   1. ĐỌC JS — che chú thích, che nội dung chuỗi (giữ nguyên độ dài để số dòng vẫn đúng)
   ====================================================================================== */
function maskJs(src) {
  // trả về { code: bỏ chú thích (giữ chuỗi), bare: bỏ chú thích + bỏ ruột chuỗi }
  const code = src.split(""), bare = src.split("");
  const blank = (arr, i) => { if (arr[i] !== "\n") arr[i] = " "; };
  let i = 0, prevSig = "";
  const tplStack = [];
  const regexOk = () => prevSig !== "<" && (!prevSig || /[(,=:[!&|?{;+\-*%<>~^]$/.test(prevSig) || /\b(return|typeof|case|do|else|in|of|new|delete|void|throw|await|yield)$/.test(prevSig));
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < src.length && src[i] !== "\n") { blank(code, i); blank(bare, i); i++; } continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2), end = e < 0 ? src.length : e + 2; for (; i < end; i++) { blank(code, i); blank(bare, i); } continue; }
    if (c === '"' || c === "'") {
      i++; while (i < src.length && src[i] !== c && src[i] !== "\n") { if (src[i] === "\\") { blank(bare, i); i++; } blank(bare, i); i++; }
      i++; prevSig = "a"; continue;
    }
    if (c === "`" || (c === "}" && tplStack.length && tplStack[tplStack.length - 1] === 0)) {
      if (c === "}") tplStack.pop();
      i++;
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\") { blank(bare, i); i++; blank(bare, i); i++; continue; }
        if (src[i] === "$" && src[i + 1] === "{") { tplStack.push(0); i += 2; break; }
        blank(bare, i); i++;
      }
      if (src[i] === "`") { i++; prevSig = "a"; }
      continue;
    }
    if (c === "/" && regexOk()) {
      // biểu thức chính quy: bỏ qua tới dấu / đóng
      let j = i + 1, cls = false;
      while (j < src.length && src[j] !== "\n") { if (src[j] === "\\") { j += 2; continue; } if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; else if (src[j] === "/" && !cls) break; j++; }
      if (src[j] === "/") { for (let k = i + 1; k < j; k++) blank(bare, k); i = j + 1; prevSig = "a"; continue; }
    }
    if (tplStack.length) { if (c === "{") tplStack[tplStack.length - 1]++; else if (c === "}") tplStack[tplStack.length - 1]--; }
    if (!/\s/.test(c)) { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 40)); if (m) { prevSig = m[0]; i += m[0].length; continue; } prevSig = c; }
    i++;
  }
  return { code: code.join(""), bare: bare.join("") };
}

/* top-level: chia file thành các khai báo cấp ngoài cùng (function / const / let / class).
   Mỗi khai báo kéo dài tới khai báo kế tiếp — đủ dùng để biết "hàm này đụng tới gì". */
function topDecls(bare) {
  const out = [];
  let depth = 0;
  const re = /^(export\s+)?(default\s+)?(async\s+)?(function\*?\s+([A-Za-z_$][\w$]*)|(const|let|var)\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*))/;
  let lineStart = true;
  for (let i = 0; i < bare.length; i++) {
    const c = bare[i];
    if (lineStart && depth === 0) {
      const m = re.exec(bare.slice(i, i + 200));
      if (m) out.push({ name: m[5] || m[7] || m[8], start: i, exported: !!m[1] });
      // câu lệnh khác ở cấp ngoài cùng (if, window.x = …, gọi hàm…) cũng cắt khai báo trước đó
      else if (!/\s/.test(c) && !/[.?:)\]}+\-*/&|,=<>]/.test(c) && !/^(import|from)\b/.test(bare.slice(i, i + 7))) out.push({ name: null, start: i });
    }
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth = Math.max(0, depth - 1);
    lineStart = c === "\n" ? true : lineStart && /\s/.test(c);
  }
  for (let k = 0; k < out.length; k++) out[k].end = k + 1 < out.length ? out[k + 1].start : bare.length;
  return out.filter((d) => d.name);
}

function parseImports(code, file) {
  const out = new Map();   // tên dùng trong file → { mod, name }
  const mods = [];
  const resolve = (spec) => {
    if (!spec.startsWith(".")) return null;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    for (const c of [base, base + ".js", base + ".jsx", base + ".mjs", base + "/index.js", base + "/index.jsx"]) if (exists(c) && fs.statSync(path.join(ROOT, c)).isFile()) return c;
    return null;
  };
  const re = /import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(code))) {
    const mod = resolve(m[2]); if (!mod) continue; mods.push(mod);
    const spec = m[1];
    const named = /\{([\s\S]*?)\}/.exec(spec);
    if (named) for (const part of named[1].split(",")) { const p = part.trim(); if (!p) continue; const [a, b] = p.split(/\s+as\s+/); out.set((b || a).trim(), { mod, name: a.trim() }); }
    const def = /^([A-Za-z_$][\w$]*)/.exec(spec.trim()); if (def && !spec.trim().startsWith("{")) out.set(def[1], { mod, name: "default" });
  }
  const dyn = /import\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dyn.exec(code))) { const mod = resolve(m[1]); if (mod) mods.push(mod); }
  return { names: out, mods: uniq(mods) };
}

/* ======================================================================================
   2. ĐỌC SQL — theo thứ tự chạy: schema.sql → các file phiên bản (v8_6 < v8_7 < … < v12_25) → cron.sql
   ====================================================================================== */
const verKey = (f) => { const b = path.basename(f); if (b === "schema.sql") return [-1]; if (!/^v\d/.test(b)) return [1e9]; return b.slice(1).split(/[_.]/).filter((x) => /^\d+$/.test(x)).map(Number); };
const cmpVer = (a, b) => { const x = verKey(a), y = verKey(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? -1) - (y[i] ?? -1); if (d) return d; } return 0; };

function sqlStatements(text) {
  // tách theo dấu ; nhưng bỏ qua ; trong '...' và $$...$$; bỏ chú thích --
  const out = []; let i = 0, start = 0, buf = "";
  const push = (end) => { const raw = text.slice(start, end); if (raw.trim()) out.push({ text: raw, line: lineAt(text, start + (raw.length - raw.trimStart().length)) }); start = end + 1; };
  while (i < text.length) {
    const c = text[i];
    if (c === "-" && text[i + 1] === "-") { const e = text.indexOf("\n", i); const end = e < 0 ? text.length : e; text = text.slice(0, i) + " ".repeat(end - i) + text.slice(end); i = end; continue; }
    if (c === "'") { i++; while (i < text.length && !(text[i] === "'" && text[i + 1] !== "'")) { if (text[i] === "'" ) i++; i++; } i++; continue; }
    if (c === "$") { const m = /^\$[A-Za-z_]*\$/.exec(text.slice(i, i + 30)); if (m) { const e = text.indexOf(m[0], i + m[0].length); i = e < 0 ? text.length : e + m[0].length; continue; } }
    if (c === ";") { push(i); }
    i++;
  }
  push(text.length);
  void buf;
  return out;
}
const ident = (s) => String(s || "").replace(/^public\./i, "").replace(/"/g, "").trim();
const ROLE_SPLIT = (s) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const TABLE_OPS = ["select", "insert", "update", "delete"];

function readSql() {
  const files = walk("supabase", [".sql"]).sort(cmpVer);
  const db = { files, tables: new Map(), fns: new Map(), triggers: new Map(), fnDefs: new Map(), cron: [] };
  const T = (name, f, l) => { if (!db.tables.has(name)) db.tables.set(name, { name, cols: new Map(), rls: false, policies: new Map(), grants: { anon: new Set(), authenticated: new Set(), service_role: new Set() }, def: { f, l } }); return db.tables.get(name); };
  for (const f of files) {
    const text = read(f);
    for (const st of sqlStatements(text)) {
      const s = st.text.trim(), lo = s.toLowerCase(), where = { f, l: st.line };
      let m;
      if ((m = /^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\(([\s\S]*)\)\s*$/i.exec(s))) {
        const t = T(ident(m[1]), f, st.line);
        // Supabase cấp sẵn mọi quyền trên bảng mới ở schema public cho anon + authenticated, tới khi có revoke
        for (const r of ["anon", "authenticated", "service_role"]) TABLE_OPS.forEach((o) => t.grants[r].add(o));
        let depth = 0, cur = "", parts = [];
        for (const ch of m[2]) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch; }
        parts.push(cur);
        for (const p of parts) { const w = p.trim().split(/\s+/); if (!w[0] || /^(primary|unique|constraint|foreign|check|exclude)$/i.test(w[0])) continue; t.cols.set(ident(w[0]), { type: (w[1] || "").toLowerCase(), where }); }
        continue;
      }
      if ((m = /^alter\s+table\s+(?:if\s+exists\s+)?([\w."]+)\s+([\s\S]*)$/i.exec(s))) {
        const t = T(ident(m[1]), f, st.line), rest = m[2];
        if (/enable\s+row\s+level\s+security/i.test(rest)) t.rls = true;
        if (/disable\s+row\s+level\s+security/i.test(rest)) t.rls = false;
        for (const a of rest.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?\s+(\w+)/gi)) t.cols.set(a[1], { type: a[2].toLowerCase(), where });
        for (const a of rest.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?"?(\w+)"?/gi)) t.cols.delete(a[1]);
        continue;
      }
      if ((m = /^create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(([^)]*)\)([\s\S]*)$/i.exec(s))) {
        const name = ident(m[1]), head = m[3];
        const bm = /(\$[A-Za-z_]*\$)([\s\S]*?)\1/.exec(head);
        const body = bm ? bm[2] : "";
        const fn = { name, args: m[2].trim(), definer: /security\s+definer/i.test(head), returnsTrigger: /returns\s+trigger/i.test(head), body, where, grants: new Set(["public"]) };
        const prev = db.fns.get(name);
        if (prev) fn.grants = prev.grants;   // create or replace giữ nguyên quyền cũ
        db.fns.set(name, fn);
        if (!db.fnDefs.has(name)) db.fnDefs.set(name, []);
        db.fnDefs.get(name).push(where);
        continue;
      }
      if ((m = /^drop\s+function\s+(?:if\s+exists\s+)?([\w."]+)/i.exec(s))) { db.fns.delete(ident(m[1])); continue; }
      if ((m = /^create\s+(?:or\s+replace\s+)?trigger\s+(\w+)[\s\S]*?\bon\s+([\w."]+)[\s\S]*?execute\s+(?:function|procedure)\s+([\w."]+)/i.exec(s))) {
        db.triggers.set(m[1], { name: m[1], table: ident(m[2]), fn: ident(m[3]), where }); continue;
      }
      if ((m = /^drop\s+trigger\s+(?:if\s+exists\s+)?(\w+)/i.exec(s))) { db.triggers.delete(m[1]); continue; }
      if ((m = /^create\s+policy\s+"?([\w]+)"?\s+on\s+([\w."]+)([\s\S]*)$/i.exec(s))) {
        const t = T(ident(m[2]), f, st.line), rest = m[3];
        const cmd = (/\bfor\s+(all|select|insert|update|delete)\b/i.exec(rest)?.[1] || "all").toLowerCase();
        const to = ROLE_SPLIT(/\bto\s+([\w,\s]+?)(?:\busing\b|\bwith\b|$)/i.exec(rest)?.[1] || "public");
        const using = /\busing\s*\(([\s\S]*?)\)\s*(?:with\s+check|$)/i.exec(rest)?.[1] || "";
        const check = /with\s+check\s*\(([\s\S]*)\)\s*$/i.exec(rest)?.[1] || "";
        t.policies.set(m[1], { name: m[1], cmd, to, using, check, where }); continue;
      }
      if ((m = /^drop\s+policy\s+(?:if\s+exists\s+)?"?([\w]+)"?\s+on\s+([\w."]+)/i.exec(s))) { db.tables.get(ident(m[2]))?.policies.delete(m[1]); continue; }
      if ((m = /^(grant|revoke)\s+([\w,\s]+?)\s+on\s+(table\s+|function\s+)?([\w."]+)\s*(\([^)]*\))?\s+(to|from)\s+([\w,\s]+)$/i.exec(s))) {
        const give = m[1].toLowerCase() === "grant", isFn = /function/i.test(m[3] || "") || !!m[5];
        const roles = ROLE_SPLIT(m[7]), ops = ROLE_SPLIT(m[2]);
        const name = ident(m[4]);
        if (isFn) { const fn = db.fns.get(name); if (fn) for (const r of roles) give ? fn.grants.add(r) : fn.grants.delete(r); continue; }
        const t = db.tables.get(name); if (!t) continue;
        const list = ops.includes("all") ? TABLE_OPS : ops.filter((o) => TABLE_OPS.includes(o));
        for (const r of roles) { if (r === "public") { for (const rr of ["anon", "authenticated"]) list.forEach((o) => give ? t.grants[rr].add(o) : t.grants[rr].delete(o)); continue; } if (!t.grants[r]) t.grants[r] = new Set(); list.forEach((o) => give ? t.grants[r].add(o) : t.grants[r].delete(o)); }
        continue;
      }
      if (/cron\.schedule/i.test(lo)) db.cron.push({ text: s, where });
    }
  }
  // thân hàm: bảng nào, thiết lập nào, hàm nào khác
  for (const fn of db.fns.values()) {
    const b = fn.body.replace(/--[^\n]*/g, "");
    fn.reads = new Set(); fn.writes = new Set(); fn.calls = new Set();
    for (const m of b.matchAll(/\b(from|join)\s+(?:public\.)?(artius_\w+)/gi)) if (!db.fns.has(m[2])) fn.reads.add(m[2]);
    for (const m of b.matchAll(/\b(update|insert\s+into|delete\s+from)\s+(?:public\.)?(artius_\w+)/gi)) fn.writes.add(m[2]);
    for (const m of b.matchAll(/\b(?:public\.)?(artius_\w+)\s*\(/gi)) if (m[1] !== fn.name) fn.calls.add(m[1]);
    fn.authCheck = /artius_is_member|artius_is_admin|artius_my_emp|artius_managed_emps|artius_view_all|auth\.uid\(\)|auth\.role\(\)/i.test(b);
    fn.cfgText = b;
  }
  // kiểm tra người gọi qua hàm khác (vd artius_view_agg() tự kiểm tra auth.uid())
  for (let r = 0, ch = true; ch && r < 10; r++) { ch = false; for (const fn of db.fns.values()) if (!fn.authCheck && [...fn.calls].some((c) => db.fns.get(c)?.authCheck)) { fn.authCheck = true; ch = true; } }
  return db;
}

/* ======================================================================================
   3. QUÉT CODE APP
   ====================================================================================== */
const CFG_ROOTS = ["cfg", "headCfg"];                                   // tên biến chắc chắn là thiết lập
const CFG_SOFT = ["config", "next", "c", "base", "prev", "merged", "nx"]; // chỉ tính khi khoá đã biết
const SAVE_CALL = /\b(saveCfg|commitConfig|bodSave|headSave|pastLockSave|bodPlanSave|supportSave|save\w*|onSave\w*)\s*\(\s*$/;

function scanFile(file, knownCfg) {
  const src = read(file), { code, bare } = maskJs(src);
  const facts = [];   // { kind: table|rpc|api|local|cfg|cfgDyn, name, op, at }
  const at = (i) => lineAt(src, i);
  const consts = new Map();
  for (const m of code.matchAll(/\bconst\s+([A-Z_][A-Z0-9_]*)\s*=\s*["'](artius_\w+)["']/g)) consts.set(m[1], m[2]);
  for (const m of code.matchAll(/\.from\(\s*(?:["'](artius_\w+)["']|([A-Z_][A-Z0-9_]*))\s*\)/g)) {
    const name = m[1] || consts.get(m[2]); if (!name) continue;
    const tail = code.slice(m.index + m[0].length, m.index + m[0].length + 500);
    const op = /^[\s\S]*?\.(select|insert|update|upsert|delete)\s*\(/.exec(tail)?.[1] || "select";
    facts.push({ kind: "table", name, op: op === "select" ? "read" : "write", how: op, at: at(m.index) });
  }
  for (const m of code.matchAll(/\.rpc\(\s*["'](\w+)["']/g)) facts.push({ kind: "rpc", name: m[1], op: "call", at: at(m.index) });
  for (const m of code.matchAll(/["'`]\/api\/([\w-]+)/g)) facts.push({ kind: "api", name: m[1], op: "call", at: at(m.index) });
  for (const m of code.matchAll(/\blocalStorage\.(getItem|setItem|removeItem)/g)) facts.push({ kind: "local", name: "localStorage", op: m[1] === "getItem" ? "read" : "write", at: at(m.index) });
  // đọc thiết lập
  for (const m of bare.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\??\.([A-Za-z_$][\w$]*)/g)) {
    const [, root, key] = m;
    if (CFG_ROOTS.includes(root) || (CFG_SOFT.includes(root) && knownCfg.has(key))) facts.push({ kind: "cfg", name: key, op: "read", at: at(m.index) });
  }
  for (const m of bare.matchAll(/(?<![\w$.])(cfg|headCfg)\??\.?\[/g)) facts.push({ kind: "cfgDyn", name: "?", op: "read", at: at(m.index) });
  // ghi thiết lập: object có "...cfg" truyền thẳng vào một hàm lưu → các khoá ngang cấp là khoá bị ghi
  for (const m of bare.matchAll(/\.\.\.\s*(cfg|headCfg|config|c|next|base|prev)\b/g)) {
    let i = m.index, depth = 0;
    for (; i >= 0; i--) { const ch = bare[i]; if (ch === "}" || ch === ")" || ch === "]") depth++; else if (ch === "{" || ch === "(" || ch === "[") { if (depth === 0) break; depth--; } }
    if (i < 0 || bare[i] !== "{") continue;
    const before = bare.slice(Math.max(0, i - 160), i);
    const viaSave = SAVE_CALL.test(before.replace(/\(\s*\w+\s*\)\s*=>\s*\(\s*\w+\s*\?\s*$/, "("));
    if (!viaSave) continue;
    if (!CFG_ROOTS.includes(m[1]) && m[1] !== "config") continue;
    let j = i + 1, d = 0, tokStart = true;
    for (; j < bare.length; j++) {
      const ch = bare[j];
      if (d === 0 && ch === "}") break;
      if ("{([".includes(ch)) { d++; continue; } if ("})]".includes(ch)) { d--; continue; }
      if (d !== 0) continue;
      if (ch === ",") { tokStart = true; continue; }
      if (tokStart && !/\s/.test(ch)) {
        tokStart = false;
        const km = /^([A-Za-z_$][\w$]*)\s*(:|,|})/.exec(bare.slice(j, j + 80));
        if (km) facts.push({ kind: "cfg", name: km[1], op: "write", at: at(j) });
        else if (bare[j] === "[") facts.push({ kind: "cfgDyn", name: "?", op: "write", at: at(j) });
      }
    }
  }
  if (file.startsWith("api/")) for (const f of facts) f.server = true;   // file server: chạy bằng service_role, không qua RLS
  return { file, src, code, bare, facts, decls: topDecls(bare), imports: parseImports(code, file) };
}

/* gom "hàm này đụng tới gì" qua lời gọi trong cùng file và hàm import, lặp tới khi ổn định */
function propagate(mods) {
  const key = (f, n) => `${f}#${n}`;
  const declFacts = new Map(), declCalls = new Map();
  for (const M of mods.values()) {
    const idx = (i) => M.decls.findIndex((d) => i >= d.start && i < d.end);
    const lineToIdx = (line) => { let pos = 0, n = 1; while (n < line && pos >= 0) { pos = M.src.indexOf("\n", pos) + 1; n++; } return idx(pos); };
    M.top = [];   // dữ kiện nằm ngoài mọi khai báo
    for (const d of M.decls) declFacts.set(key(M.file, d.name), []);
    for (const fct of M.facts) { const k = lineToIdx(fct.at); (k >= 0 ? declFacts.get(key(M.file, M.decls[k].name)) : M.top).push({ ...fct, file: M.file }); }
    const local = new Set(M.decls.map((d) => d.name));
    for (const d of M.decls) {
      const body = M.bare.slice(d.start, d.end), calls = new Set();
      for (const w of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)/g)) {
        const n = w[1]; if (n === d.name) continue;
        if (local.has(n)) calls.add(key(M.file, n));
        const im = M.imports.names.get(n); if (im) calls.add(key(im.mod, im.name));
      }
      for (const f of M.facts.filter((x) => x.kind === "api")) if (body.includes(`/api/${f.name}`)) calls.add(`api/${f.name}.js#*`);
      declCalls.set(key(M.file, d.name), calls);
    }
  }
  // api/<tên>.js#* = mọi thứ file server đó làm
  for (const M of mods.values()) if (M.file.startsWith("api/")) declFacts.set(`${M.file}#*`, [...M.top, ...M.decls.flatMap((d) => declFacts.get(key(M.file, d.name)) || [])].map((f) => ({ ...f, server: true })));
  const all = new Map([...declFacts].map(([k, v]) => [k, new Map(v.map((f) => [`${f.kind}|${f.name}|${f.op}|${f.file}|${f.at}`, f]))]));
  for (let round = 0, changed = true; changed && round < 30; round++) {
    changed = false;
    for (const [k, calls] of declCalls) {
      const mine = all.get(k);
      for (const c of calls) for (const [fk, f] of all.get(c) || []) if (!mine.has(fk)) { mine.set(fk, f.via ? f : { ...f, via: c.split("#")[1] }); changed = true; }
    }
  }
  return { all, declCalls, key };
}

/* ======================================================================================
   4. GHÉP THÀNH ĐỒ THỊ + KIỂM TRA
   ====================================================================================== */
function main() {
  const man = JSON.parse(read(MANIFEST));
  const db = readSql();
  const version = /APP_VERSION\s*=\s*["']([^"']+)["']/.exec(read("src/core/ui.jsx"))?.[1] || "?";
  let commit = "";
  try { commit = execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* không có git */ }

  // các khoá thiết lập đã biết = khai báo + khoá thấy qua cfg.xxx
  const declCfg = new Map();   // khoá → node id
  for (const n of man.nodes) for (const k of n.bind?.cfg || []) declCfg.set(k, n.id);
  const known = new Set(declCfg.keys());
  const jsFiles = [...walk("src", [".js", ".jsx", ".mjs"]), ...walk("api", [".js", ".mjs"]), ...["main.jsx", "auth.js"].filter(exists)];
  let mods = new Map();
  for (let pass = 0; pass < 2; pass++) {   // lượt 2: đã biết thêm khoá mới từ lượt 1
    mods = new Map(jsFiles.map((f) => [f, scanFile(f, known)]));
    for (const M of mods.values()) for (const f of M.facts) if (f.kind === "cfg" && f.op === "write") known.add(f.name);
    for (const M of mods.values()) for (const f of M.facts) if (f.kind === "cfg") known.add(f.name);
  }
  const P = propagate(mods);

  // khoá thiết lập có trong giá trị mặc định (emptyConfig) = được khởi tạo, coi như có người ghi
  const initKeys = new Set();
  for (const M of mods.values()) { const m = /export\s+const\s+emptyConfig\s*=\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\);/.exec(M.code); if (m) for (const k of m[1].matchAll(/(?:^|[,{\s])([A-Za-z_]\w*)\s*:/g)) initKeys.add(k[1]); }

  /* ---------- node ---------- */
  const N = man.nodes.map((n) => ({ ...n, auto: [] }));
  const byId = new Map(N.map((n) => [n.id, n]));
  const nodeOfTable = new Map(), nodeOfRpc = new Map(), nodeOfTrig = new Map(), nodeOfSym = new Map();
  for (const n of N) {
    for (const t of n.bind?.tables || []) nodeOfTable.set(t, n.id);
    for (const r of n.bind?.rpc || []) nodeOfRpc.set(r, n.id);
    for (const t of n.bind?.triggers || []) nodeOfTrig.set(t, n.id);
    for (const s of n.bind?.symbols || []) { if (!nodeOfSym.has(s)) nodeOfSym.set(s, []); nodeOfSym.get(s).push(n.id); }
  }
  const unitOfFile = (f) => N.find((n) => (n.bind?.files || []).some((p) => globHit(p, f)))?.id || null;
  const newNodes = [];
  const addAuto = (id, o) => { if (byId.has(id)) return id; const n = { id, auto: [], undeclared: true, ...o }; N.push(n); byId.set(id, n); newNodes.push(id); return id; };

  /* ---------- dữ kiện theo đơn vị (màn hình) ---------- */
  const unitFacts = new Map();   // node id → [fact]
  const pushU = (u, f) => { if (!unitFacts.has(u)) unitFacts.set(u, []); unitFacts.get(u).push(f); };
  const unmapped = [];
  for (const M of mods.values()) {
    const u = unitOfFile(M.file);
    const ignored = (man.files_ignore || []).some((p) => globHit(p, M.file));
    if (!u) { if (!ignored && (M.file.startsWith("src/features/") || M.file.startsWith("api/"))) unmapped.push(M.file); continue; }
    const seen = new Set();
    // dữ kiện nằm trong file của MÀN HÌNH KHÁC (vd App.jsx vẽ tab Thiết lập) thuộc về màn hình đó, không tính cho màn hình này
    const add = (f) => { const k = `${f.kind}|${f.name}|${f.op}|${f.file}|${f.at}`; if (seen.has(k)) return; const fu = unitOfFile(f.file); if (fu && fu !== u) return; seen.add(k); pushU(u, { ...f, from: M.file }); };
    M.top.forEach(add);
    for (const d of M.decls) for (const f of P.all.get(P.key(M.file, d.name))?.values() || []) add(f);
    // dùng hàm tính nào (theo tên được import)
    for (const [local, im] of M.imports.names) {
      const ids = nodeOfSym.get(im.name); if (!ids) continue;
      const re = new RegExp(`(?<![\\w$.])${local.replace(/\$/g, "\\$")}(?![\\w$])`, "g");
      const uses = [...M.bare.matchAll(re)].filter((x) => !/import\s*\{[^}]*$/.test(M.bare.slice(Math.max(0, x.index - 300), x.index)));
      if (uses.length) for (const id of ids) pushU(u, { kind: "sym", name: im.name, node: id, op: "read", file: M.file, at: lineAt(M.src, uses[0].index), from: M.file });
    }
    // hàm tính định nghĩa ngay trong file màn hình
    for (const d of M.decls) for (const id of nodeOfSym.get(d.name) || []) if (new RegExp(`(?<![\\w$.])${d.name}\\s*\\(`).test(M.bare.slice(d.end))) pushU(u, { kind: "sym", name: d.name, node: id, op: "read", file: M.file, at: lineAt(M.src, d.start), from: M.file });
  }

  /* ---------- cạnh ---------- */
  const E = new Map();   // "a|b|t" → { a, b, t, lbl:Set, auto, manual, ev:[] }
  const edge = (a, b, t, lbl, ev, manual = false) => {
    if (!a || !b || a === b) return;
    const k = `${a}|${b}|${t}`;
    if (!E.has(k)) E.set(k, { a, b, t, lbl: new Set(), auto: false, manual: false, ev: [] });
    const e = E.get(k); if (lbl) e.lbl.add(lbl); if (ev) e.ev.push(ev); if (manual) e.manual = true; else e.auto = true;
  };
  for (const [a, b, t, lbl] of man.edges) edge(a, b, t, lbl, null, true);
  for (const id of Object.values(Object.fromEntries([...nodeOfTable]))) if (byId.has(id)) edge("hub", id, "store");

  const cfgNode = (k, near) => declCfg.get(k) || addAuto(`cfg_${k}`, { label: k, sub: `cfg.${k}`, layer: "cfg", ring: 2, sec: near ?? 3, bind: { cfg: [k] } });
  const tableNode = (t) => nodeOfTable.get(t) || addAuto(`tbl_${t}`, { label: t, sub: "bảng", layer: "db", ring: 1, sec: 3, bind: { tables: [t] } });
  const rpcNode = (r, near) => nodeOfRpc.get(r) || addAuto(`rpc_${r}`, { label: r.replace(/^artius_/, ""), sub: "hàm SQL", layer: "rule", ring: 3, sec: near ?? 3, bind: { rpc: [r] } });

  const cfgWriters = new Map(), cfgReaders = new Map(), tblWriters = new Map(), tblReaders = new Map();
  const note = (map, k, who, ev) => { if (!map.has(k)) map.set(k, new Map()); const m = map.get(k); if (!m.has(who)) m.set(who, []); if (ev) m.get(who).push(ev); };
  const ev = (f) => ({ f: f.file, l: f.at });
  const browserWrites = [];
  for (const [u, facts] of unitFacts) {
    const sec = byId.get(u).sec;
    for (const f of facts) {
      const via = f.via ? `qua ${f.via}` : "";
      if (f.kind === "cfg") {
        const id = cfgNode(f.name, sec);
        edge(u, id, f.op === "write" ? "write" : "read", f.name === byId.get(id).bind?.cfg?.[0] && (byId.get(id).bind.cfg.length === 1) ? via : `${f.name}${via ? " · " + via : ""}`, ev(f));
        note(f.op === "write" ? cfgWriters : cfgReaders, f.name, u, ev(f));
      } else if (f.kind === "table") {
        const id = tableNode(f.name);
        edge(u, id, f.op === "write" ? "write" : "read", [f.how !== "select" ? f.how : "", f.server ? "server" : "", via].filter(Boolean).join(" · "), ev(f));
        note(f.op === "write" ? tblWriters : tblReaders, f.name, u, ev(f));
        if (f.op === "write" && !f.server) browserWrites.push({ ...f, unit: u });
        if (f.op === "read" && !f.server) browserWrites.push({ ...f, unit: u, how: "select" });
      } else if (f.kind === "rpc") {
        const fn = db.fns.get(f.name);
        const id = rpcNode(f.name, sec);
        edge(u, id, fn && fn.writes.size ? "write" : "read", via, ev(f));
      } else if (f.kind === "local") {
        const id = N.find((n) => n.bind?.localStorage)?.id; if (id) edge(u, id, f.op === "write" ? "write" : "read", via, ev(f));
      } else if (f.kind === "sym") edge(u, f.node, "read", f.name, ev(f));
    }
  }
  // thân hàm SQL được gọi / trigger → bảng & khoá thiết lập
  const cfgKeysIn = (fn) => {
    const r = new Set(), w = new Set();
    if (!(fn.reads.has("artius_config") || fn.writes.has("artius_config"))) return { r, w };
    for (const m of fn.cfgText.matchAll(/->>?\s*'(\w+)'/g)) if (known.has(m[1])) r.add(m[1]);
    for (const m of fn.cfgText.matchAll(/jsonb_set\([^,]+,\s*'\{(\w+)/g)) if (known.has(m[1])) w.add(m[1]);
    return { r, w };
  };
  const sqlUnits = [...nodeOfRpc.entries(), ...N.filter((n) => n.id.startsWith("rpc_")).map((n) => [n.bind.rpc[0], n.id])];
  const trigUnits = [...db.triggers.values()].map((t) => [t.fn, nodeOfTrig.get(t.name) || null, t]);
  for (const [fname, id, trig] of [...sqlUnits.map(([a, b]) => [a, b, null]), ...trigUnits]) {
    const fn = db.fns.get(fname); if (!fn || !id) continue;
    const sec = byId.get(id).sec;
    for (const t of fn.reads) if (t !== "artius_config" || !fn.writes.has(t)) { const tid = tableNode(t); edge(id, tid, "read", "", fn.where); note(tblReaders, t, id, fn.where); }
    for (const t of fn.writes) { const tid = tableNode(t); edge(id, tid, "write", "", fn.where); note(tblWriters, t, id, fn.where); }
    if (trig) edge(id, tableNode(trig.table), "rule", "trigger trên bảng", trig.where);
    const { r, w } = cfgKeysIn(fn);
    for (const k of r) { if (!w.has(k)) { edge(id, cfgNode(k, sec), "read", "", fn.where); note(cfgReaders, k, id, fn.where); } }
    for (const k of w) { edge(id, cfgNode(k, sec), "write", "", fn.where); note(cfgWriters, k, id, fn.where); }
  }
  // khoá thiết lập → artius_config
  const cfgStore = nodeOfTable.get("artius_config");
  for (const k of known) { const id = cfgNode(k); if (byId.get(id).layer === "cfg") edge(id, cfgStore, "store"); }

  // Phân quyền (RLS) → bảng: tóm tắt ai đọc / ai ghi
  const who = (expr) => {
    const e = (expr || "").toLowerCase();
    if (!e.trim() || /^\s*true\s*$/.test(e)) return "mọi người";
    const out = [];
    if (/artius_is_admin/.test(e)) out.push("Admin");
    if (/artius_view_all/.test(e)) out.push("Admin · BOD");
    if (/artius_managed_emps/.test(e)) out.push("trưởng phòng (người phòng mình)");
    if (/artius_my_emp/.test(e)) out.push("chính chủ");
    if (/artius_is_member/.test(e) && !out.length) out.push("mọi tài khoản");
    return out.length ? uniq(out).join(", ") : "điều kiện riêng";
  };
  const access = (t) => {
    const res = {};
    for (const op of TABLE_OPS) {
      const roles = ["anon", "authenticated"].filter((r) => t.grants[r]?.has(op));
      if (!roles.length) { res[op] = "chỉ server"; continue; }
      if (!t.rls) { res[op] = roles.includes("anon") ? "AI CŨNG ĐƯỢC (chưa bật RLS)" : "mọi tài khoản (chưa bật RLS)"; continue; }
      const pol = [...t.policies.values()].filter((p) => (p.cmd === op || p.cmd === "all") && (p.to.includes("authenticated") || p.to.includes("public") || p.to.some((r) => roles.includes(r))));
      res[op] = pol.length ? uniq(pol.map((p) => who(op === "insert" ? p.check : p.using || p.check))).join(" / ") : "chỉ server";
    }
    return res;
  };
  const rlsId = N.find((n) => n.bind?.policies)?.id;
  const tAccess = new Map();
  for (const t of db.tables.values()) {
    const a = access(t); tAccess.set(t.name, a);
    const id = tableNode(t.name);
    if (rlsId) edge(rlsId, id, "rule", `đọc: ${a.select} · ghi: ${uniq([a.insert, a.update, a.delete]).join(" / ")}`, t.def);
  }

  /* ---------- thông tin "theo code" cho từng ô ---------- */
  const label = (id) => byId.get(id)?.label || id;
  const fmtWho = (m) => (m ? [...m.keys()].map(label).join(", ") : "");
  for (const n of N) {
    const A = n.auto;
    for (const t of n.bind?.tables || []) {
      const T = db.tables.get(t); if (!T) continue;
      const a = tAccess.get(t);
      A.push([`${t}`, `${T.cols.size} cột: ${[...T.cols.keys()].join(", ")}`]);
      A.push(["Quyền đọc", a.select], ["Quyền ghi", uniq([a.insert, a.update, a.delete]).join(" / ")]);
      if (tblWriters.get(t)) A.push(["Ghi (theo code)", fmtWho(tblWriters.get(t))]);
      if (tblReaders.get(t)) A.push(["Đọc (theo code)", fmtWho(tblReaders.get(t))]);
    }
    for (const k of n.bind?.cfg || []) {
      A.push([`cfg.${k}`, `ghi: ${fmtWho(cfgWriters.get(k)) || (initKeys.has(k) ? "chỉ giá trị mặc định" : "—")} · đọc: ${fmtWho(cfgReaders.get(k)) || "—"}`]);
    }
    for (const r of n.bind?.rpc || []) { const fn = db.fns.get(r); if (fn) A.push([`${r}()`, `${fn.where.f}:${fn.where.l}${fn.definer ? " · chạy quyền cao (security definer)" : ""}${fn.authCheck ? " · có kiểm tra người gọi" : ""}`]); }
    for (const t of n.bind?.triggers || []) { const tg = db.triggers.get(t); if (tg) A.push([`trigger ${t}`, `trên ${tg.table} → ${tg.fn}() · ${db.fns.get(tg.fn)?.where.f || "?"}`]); }
    for (const s of n.bind?.symbols || []) { const d = [...mods.values()].find((M) => M.decls.some((x) => x.name === s)); if (d) A.push([`${s}()`, d.file]); }
    for (const p of n.bind?.files || []) A.push(["File", jsFiles.filter((f) => globHit(p, f)).join(", ") || `${p} (không thấy)`]);
  }

  /* ======================================================================================
     KIỂM TRA
     ====================================================================================== */
  const FIND = [];
  const find = (code, sev, t, p, fix, n, where = [], key = "") => {
    const w = [], seenW = new Set(); for (const x of where) { const k = x && `${x.f}:${x.l}`; if (k && !seenW.has(k)) { seenW.add(k); w.push({ f: x.f, l: x.l }); } }
    FIND.push({ id: "", code, key: `${code}:${key || t}`, sev, t, p, fix, n: uniq(n.filter((x) => byId.has(x))), where: w.slice(0, 6), auto: true });
  };
  // từ dài (salary, password…) bắt cả khi nằm trong tên ghép (salaryTable, baseSalary); từ ngắn (pin, stk…) phải đúng nguyên tên
  const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sLong = (man.sensitive || []).filter((x) => x.length >= 4), sShort = (man.sensitive || []).filter((x) => x.length < 4);
  const SENS = new RegExp(`(${sLong.map(escRe).join("|")})|^(${sShort.map(escRe).join("|")})$`, "i");
  const SENS_IN = new RegExp(`(${sLong.map(escRe).join("|")})`, "i");
  const loc = (w) => (w ? `${w.f}:${w.l}` : "");

  // K1 code gọi hàm SQL không có
  const rpcCalls = new Map();
  for (const M of mods.values()) for (const f of M.facts) if (f.kind === "rpc") { if (!rpcCalls.has(f.name)) rpcCalls.set(f.name, []); rpcCalls.get(f.name).push({ f: M.file, l: f.at }); }
  for (const [r, ws] of rpcCalls) if (!db.fns.has(r)) find("K1", "hi", `Code gọi hàm SQL "${r}" nhưng database không có`, `Hàm này không được tạo trong file SQL nào (hoặc đã bị drop). Khi chạy, thao tác đó sẽ lỗi.`, "Thêm hàm vào file SQL và chạy trên Supabase, hoặc sửa tên trong code.", [nodeOfRpc.get(r) || `rpc_${r}`], ws, r);
  // K2 code dùng bảng không có
  const tblUse = new Map();
  for (const M of mods.values()) for (const f of M.facts) if (f.kind === "table") { if (!tblUse.has(f.name)) tblUse.set(f.name, []); tblUse.get(f.name).push({ f: M.file, l: f.at }); }
  for (const [t, ws] of tblUse) if (!db.tables.has(t)) find("K2", "hi", `Code dùng bảng "${t}" nhưng không có lệnh tạo bảng`, "Không file SQL nào tạo bảng này. Cài mới database từ các file SQL sẽ thiếu bảng.", "Thêm create table vào file SQL.", [tableNode(t)], ws, t);
  // K3 bảng chưa bật RLS mà trình duyệt có quyền
  for (const t of db.tables.values()) if (!t.rls && ["anon", "authenticated"].some((r) => t.grants[r]?.size)) find("K3", "hi", `Bảng ${t.name} chưa bật RLS`, `Trình duyệt (${["anon", "authenticated"].filter((r) => t.grants[r]?.size).join(", ")}) có quyền ${[...new Set([...t.grants.anon, ...t.grants.authenticated])].join(", ")} mà không qua lớp phân quyền nào.`, "Thêm: alter table … enable row level security, rồi tạo policy hoặc revoke quyền.", [tableNode(t.name), rlsId], [t.def], t.name);
  // K4 trình duyệt đọc/ghi bảng mà database không cho
  for (const w of browserWrites) {
    const T = db.tables.get(w.name); if (!T) continue;
    const op = { select: "select", insert: "insert", update: "update", upsert: "insert", delete: "delete" }[w.how] || "select";
    const ok = T.grants.authenticated?.has(op) && (!T.rls || [...T.policies.values()].some((p) => p.cmd === op || p.cmd === "all"));
    if (!ok) find("K4", "hi", `${label(w.unit)}: trình duyệt ${w.how} bảng ${w.name} nhưng database không cho`, `Tài khoản đăng nhập không có quyền ${op} trên ${w.name} (thiếu grant hoặc thiếu policy). Thao tác này sẽ bị từ chối khi chạy thật.`, "Cấp quyền + policy đúng người, hoặc chuyển thao tác sang hàm SQL / API server.", [w.unit, tableNode(w.name)], [{ f: w.file, l: w.at }], `${w.unit}:${w.name}:${op}`);
  }
  // K5 trường nhạy cảm ở nơi mọi tài khoản đọc được
  for (const t of db.tables.values()) {
    const a = tAccess.get(t.name), open = /mọi tài khoản|mọi người|AI CŨNG/.test(a.select);
    const sens = [...t.cols.keys()].filter((c) => SENS.test(c));
    if (sens.length && open) find("K5", "hi", `Bảng ${t.name} có trường nhạy cảm mà mọi tài khoản đọc được`, `Trường ${sens.join(", ")} nằm trong bảng có quyền đọc: ${a.select}.`, "Tách trường nhạy cảm sang bảng riêng chỉ Admin / BOD đọc.", [tableNode(t.name), rlsId], [t.cols.get(sens[0]).where], t.name);
    if (sens.length && !open) find("K5b", "md", `Bảng ${t.name} lưu ${sens.join(", ")}`, `Bảng đã khoá với trình duyệt (đọc: ${a.select}), nhưng giá trị vẫn nằm nguyên trong database. Ai giữ khoá service_role hoặc bản sao lưu là đọc được.`, "Mật khẩu để Supabase Auth giữ (đã băm). Lương: bảng riêng, có nhật ký ai xem.", [tableNode(t.name)], [t.cols.get(sens[0]).where], t.name);
  }
  {
    const cfgSelect = tAccess.get("artius_config")?.select || "";
    const cfgOpen = /mọi tài khoản|mọi người|AI CŨNG/.test(cfgSelect);
    for (const k of known) if (SENS.test(k) && cfgOpen) find("K5", "hi", `Thiết lập cfg.${k} là dữ liệu nhạy cảm nhưng mọi tài khoản đọc được`, `artius_config cho ${cfgSelect} đọc toàn bộ, nên cfg.${k} lộ cho mọi nhân viên.`, "Chuyển sang bảng riêng có RLS chỉ Admin / BOD.", [cfgNode(k), cfgStore, rlsId], [...(cfgWriters.get(k)?.values() || [])].flat(), k);
    // tên nhạy cảm xuất hiện trong object được lưu vào thiết lập (vd thêm salary vào nhân sự)
    const reported = new Set(FIND.filter((x) => x.code === "K5").flatMap((x) => x.where.map((w) => `${w.f}:${w.l}`)));
    for (const M of mods.values()) for (const f of M.facts.filter((x) => x.kind === "cfg" && x.op === "write")) {
      if (reported.has(`${M.file}:${f.at}`)) continue; reported.add(`${M.file}:${f.at}`);
      const lineTxt = M.bare.split("\n")[f.at - 1] || "";
      const hit = SENS_IN.exec(lineTxt.replace(/\.\.\.\s*\w+/g, ""));
      if (hit && cfgOpen) find("K5", "hi", `Có vẻ đang lưu "${hit[1]}" vào thiết lập chung (cfg.${f.name})`, `Dòng lưu cfg.${f.name} có nhắc tới "${hit[1]}". artius_config cho ${cfgSelect} đọc.`, "Không lưu dữ liệu nhạy cảm trong thiết lập chung.", [cfgNode(f.name), cfgStore], [{ f: M.file, l: f.at }], `${f.name}:${hit[1]}`);
    }
  }
  // K6 dữ liệu nhạy cảm đi ra file Excel
  for (const M of mods.values()) {
    if (!/\b(XLSX|loadXlsx|xlsx|utils\.(json_to_sheet|aoa_to_sheet)|buildOtXlsx)\b/.test(M.code)) continue;
    const sensCols = [...db.tables.values()].flatMap((t) => [...t.cols.keys()].filter((c) => SENS.test(c)));
    for (const c of uniq(sensCols)) {
      // ưu tiên chỗ trường được đặt làm giá trị của một cột: { "Tên cột": x.password }
      const all = [...M.code.matchAll(new RegExp(`(?<![\\w$])${c}(?![\\w$])`, "g"))];
      const m = all.find((x) => /["']\s*:\s*[\w$.?]*$/.test(M.code.slice(Math.max(0, x.index - 60), x.index))) || all[0];
      if (m) find("K6", "hi", `${label(unitOfFile(M.file) || "")} xuất "${c}" ra Excel`, `File ${M.file} vừa tạo file Excel vừa dùng trường ${c}. Một file Excel gửi nhầm là lộ dữ liệu này.`, `Bỏ cột ${c} khỏi file xuất.`, [unitOfFile(M.file), N.find((n) => n.id === "s_excel")?.id, ...[...db.tables.values()].filter((t) => t.cols.has(c)).map((t) => tableNode(t.name))].filter(Boolean), [{ f: M.file, l: lineAt(M.src, m.index) }], `${M.file}:${c}`);
    }
  }
  // K7 hàm chạy quyền cao, mở cho tài khoản, không kiểm tra người gọi
  for (const fn of db.fns.values()) {
    if (!fn.definer || fn.returnsTrigger) continue;
    if (/^artius_(is_member|is_admin|my_emp|managed_emps|view_all|view_agg)$/.test(fn.name)) continue;
    const open = [...fn.grants].filter((r) => ["public", "anon", "authenticated"].includes(r));
    const touches = fn.reads.size + fn.writes.size;
    if (open.length && touches && !fn.authCheck) find("K7", fn.writes.size ? "hi" : "md", `Hàm ${fn.name}() chạy quyền cao mà không kiểm tra người gọi`, `Hàm là security definer (vượt RLS), mở cho ${open.join(", ")}, đụng tới ${[...fn.reads, ...fn.writes].join(", ")} nhưng thân hàm không gọi artius_is_member / is_admin / auth.uid().`, "Thêm kiểm tra người gọi ở đầu hàm, hoặc revoke khỏi anon / public.", [nodeOfRpc.get(fn.name) || (rpcCalls.has(fn.name) ? `rpc_${fn.name}` : null)].filter(Boolean), [fn.where], fn.name);
    if (fn.grants.has("anon") || fn.grants.has("public")) if (touches) find("K8", "md", `Hàm ${fn.name}() chưa đóng với người chưa đăng nhập`, `Quyền chạy hàm vẫn còn cho ${[...fn.grants].filter((r) => r === "anon" || r === "public").join(", ")} (Postgres mặc định cấp cho public).`, `revoke all on function public.${fn.name}(…) from public, anon;`, [nodeOfRpc.get(fn.name)].filter(Boolean), [fn.where], fn.name);
  }
  // K9 hàm SQL định nghĩa ở nhiều file — bản cuối cùng thắng, thứ tự chạy quyết định
  for (const [name, defs] of db.fnDefs) { const files = uniq(defs.map((d) => d.f)); if (files.length > 1 && db.fns.has(name)) find("K9", "md", `Hàm ${name}() được viết ở ${files.length} file SQL`, `Có trong: ${files.join(", ")}. Database giữ bản của file chạy sau cùng; chạy lại một file cũ là quay về luật cũ mà không ai biết.`, "Giữ một bản duy nhất (file mới nhất), xoá hoặc ghi chú bản cũ.", [nodeOfRpc.get(name) || [...db.triggers.values()].filter((t) => t.fn === name).map((t) => nodeOfTrig.get(t.name))[0]].filter(Boolean), defs, name); }
  // K10 dữ liệu mới chưa khai báo
  for (const id of newNodes) {
    const n = byId.get(id), evs = [...E.values()].filter((e) => e.a === id || e.b === id).flatMap((e) => e.ev).slice(0, 4);
    find("K10", "md", `Khối mới chưa có trong bản thiết kế: ${n.label} (${n.sub})`, `Code / database có "${n.label}" (${n.sub}) nhưng docs/cau-truc.json chưa khai báo nó thuộc nhóm nào, nghĩa là gì, dính tới khối nào.`, "Khai báo vào docs/cau-truc.json (gắn vào ô có sẵn hoặc tạo ô mới).", [id], evs, id);
  }
  for (const f of unmapped) find("K10", "lo", `File ${f} chưa thuộc màn hình nào`, "File này đọc / ghi dữ liệu nhưng không được gắn vào ô màn hình nào trên sơ đồ, nên liên kết của nó không hiện.", "Thêm đường dẫn vào bind.files của một màn hình trong docs/cau-truc.json.", [], [{ f, l: 1 }], f);
  // K11 khai báo nhưng code không còn
  const allSyms = new Set([...mods.values()].flatMap((M) => M.decls.map((d) => d.name)));
  for (const n of man.nodes) {
    const b = n.bind || {}, miss = [];
    for (const k of b.cfg || []) if (!cfgReaders.has(k) && !cfgWriters.has(k) && !initKeys.has(k)) miss.push(`cfg.${k}`);
    for (const t of b.tables || []) if (!db.tables.has(t)) miss.push(`bảng ${t}`);
    for (const r of b.rpc || []) if (!db.fns.has(r)) miss.push(`hàm ${r}()`);
    for (const t of b.triggers || []) if (!db.triggers.has(t)) miss.push(`trigger ${t}`);
    for (const s of b.symbols || []) if (!allSyms.has(s)) miss.push(`${s}()`);
    for (const p of b.files || []) if (!jsFiles.some((f) => globHit(p, f))) miss.push(p);
    if (miss.length) find("K11", "md", `"${n.label}": bản thiết kế trỏ tới thứ không còn trong code`, `Không thấy: ${miss.join(", ")}. Có thể đã đổi tên / xoá; sơ đồ đang mô tả cấu trúc cũ.`, "Cập nhật docs/cau-truc.json theo code mới.", [n.id], [], `${n.id}:${miss.join(",")}`);
  }
  // K12 đọc mà không ai ghi / ghi mà không ai đọc
  for (const k of known) {
    const r = cfgReaders.has(k), w = cfgWriters.has(k) || initKeys.has(k);
    if (r && !w) find("K12", "md", `cfg.${k} có đọc nhưng không thấy nơi nào ghi`, `Màn hình đọc: ${fmtWho(cfgReaders.get(k))}. Không có màn hình hay hàm SQL nào lưu khoá này (có thể là dữ liệu đời cũ, hoặc được ghi bằng cách script không nhận ra được).`, "Nếu là dữ liệu đời cũ: chuyển đổi rồi bỏ. Nếu còn dùng: kiểm tra nơi ghi.", [cfgNode(k)], [...cfgReaders.get(k).values()].flat(), k);
    if (!r && cfgWriters.has(k)) find("K12", "lo", `cfg.${k} có ghi nhưng không nơi nào đọc`, `Ghi bởi: ${fmtWho(cfgWriters.get(k))}. Dữ liệu lưu mà không dùng.`, "Bỏ phần ghi hoặc kiểm tra nơi cần đọc.", [cfgNode(k)], [...cfgWriters.get(k).values()].flat(), k);
  }
  // K13 nhiều nơi cùng ghi một khối (chồng chéo)
  for (const [k, m] of cfgWriters) if (m.size >= 2) {
    const sql = [...m.keys()].filter((u) => byId.get(u)?.layer === "rule" || u.startsWith("rpc_")), ui = [...m.keys()].filter((u) => !sql.includes(u));
    const sev = sql.length && ui.length ? "md" : "lo";
    find("K13", sev, `cfg.${k} được ghi từ ${m.size} nơi`, `Ghi bởi: ${fmtWho(m)}.${sql.length && ui.length ? " Vừa ghi thẳng từ màn hình (lưu cả thiết lập) vừa qua hàm SQL — hai đường có luật kiểm tra khác nhau." : ""} Mỗi nơi ghi là một chỗ phải sửa khi đổi cấu trúc khối này.`, "Gom về một đường ghi (một hàm lưu dùng chung) nếu được.", [cfgNode(k), ...m.keys()], [...m.values()].flat(), k);
  }
  for (const [t, m] of tblWriters) if (m.size >= 3) find("K13", "lo", `Bảng ${t} được ghi từ ${m.size} nơi`, `Ghi bởi: ${fmtWho(m)}.`, "Kiểm tra các nơi ghi dùng chung một luật.", [tableNode(t), ...m.keys()], [...m.values()].flat(), t);
  // K14 hàm SQL không ai gọi
  const calledSql = new Set([...rpcCalls.keys(), ...[...db.triggers.values()].map((t) => t.fn), ...[...db.fns.values()].flatMap((f) => [...f.calls])]);
  for (const t of db.tables.values()) for (const p of t.policies.values()) for (const m of `${p.using} ${p.check}`.matchAll(/(artius_\w+)\s*\(/g)) calledSql.add(m[1]);
  for (const c of db.cron) for (const m of c.text.matchAll(/(artius_\w+)\s*\(/g)) calledSql.add(m[1]);
  for (const fn of db.fns.values()) if (!calledSql.has(fn.name)) find("K14", "lo", `Hàm ${fn.name}() không ai gọi`, `Không có code, trigger, policy hay hàm SQL nào gọi hàm này (${loc(fn.where)}).`, "Xoá nếu đã bỏ, hoặc ghi chú nơi dùng.", [], [fn.where], fn.name);
  // K15 truy cập động — script không biết khoá nào
  for (const M of mods.values()) for (const f of M.facts.filter((x) => x.kind === "cfgDyn")) find("K15", "lo", `Không xác định được khoá thiết lập ở ${M.file}:${f.at}`, `Code ${f.op === "write" ? "ghi" : "đọc"} thiết lập theo tên biến (cfg[…]) nên script không biết là khối nào. Liên kết ở đây có thể bị thiếu trên sơ đồ.`, "Viết thẳng tên khoá nếu được.", [unitOfFile(M.file)].filter(Boolean), [{ f: M.file, l: f.at }], `${M.file}:${f.at}`);
  // K16 cạnh khai báo tay (màn hình ghi / đọc) không thấy trong code
  const storeOf = new Map([...E.values()].filter((e) => e.t === "store").map((e) => [e.a, e.b]));
  for (const e of E.values()) {
    if (!e.manual || !["write", "read"].includes(e.t)) continue;
    const A = byId.get(e.a); if (!A?.bind?.files) continue;
    const ok = [...E.values()].some((x) => x.auto && x.a === e.a && (x.b === e.b || x.b === storeOf.get(e.b)));
    if (!ok) find("K16", "lo", `Bản thiết kế ghi "${A.label} ${e.t === "write" ? "ghi" : "đọc"} ${label(e.b)}" nhưng không thấy trong code`, "Liên kết khai báo tay không còn khớp: hoặc code đã đổi, hoặc script chưa nhận ra.", "Kiểm tra rồi sửa docs/cau-truc.json.", [e.a, e.b], [], `${e.a}>${e.b}:${e.t}`);
  }
  // K17 file code không được nạp từ đâu (không nằm trên đường import nào từ index.html hay api/)
  {
    const entries = [...read("index.html").matchAll(/<script[^>]+src=["']\/?([^"']+)["']/g)].map((m) => m[1]).filter(exists);
    const reach = new Set(), stack = [...entries, ...jsFiles.filter((f) => f.startsWith("api/") && !path.basename(f).startsWith("_"))];
    while (stack.length) { const f = stack.pop(); if (reach.has(f)) continue; reach.add(f); for (const m of mods.get(f)?.imports.mods || []) stack.push(m); }
    for (const f of jsFiles) if (!reach.has(f)) find("K17", "lo", `File ${f} không được dùng`, "Không file nào import file này và nó không phải điểm vào của app hay hàm server. Có thể là bản cũ còn sót: dễ bị sửa nhầm thay cho file thật.", "Xoá nếu đúng là bản thừa.", [], [{ f, l: 1 }], f);
  }
  const sevRank = { hi: 0, md: 1, lo: 2 };
  FIND.sort((a, b) => sevRank[a.sev] - sevRank[b.sev] || a.code.localeCompare(b.code, "vi", { numeric: true }));
  const seenKey = new Set();
  for (let i = FIND.length - 1; i >= 0; i--) { if (seenKey.has(FIND[i].key)) FIND.splice(i, 1); else seenKey.add(FIND[i].key); }
  FIND.forEach((f, i) => { f.id = `K${String(i + 1).padStart(2, "0")}`; });

  /* ---------- vị trí cho ô mới: nan quạt của hàng xóm đã khai báo nhiều nhất ---------- */
  for (const id of newNodes) {
    const n = byId.get(id), cnt = new Map();
    for (const e of E.values()) { const o = e.a === id ? e.b : e.b === id ? e.a : null; const on = o && byId.get(o); if (on && !on.undeclared && on.id !== "hub") cnt.set(on.sec, (cnt.get(on.sec) || 0) + 1); }
    if (cnt.size) n.sec = [...cnt].sort((a, b) => b[1] - a[1])[0][0];
  }

  /* ======================================================================================
     SO VỚI BẢN TRƯỚC
     ====================================================================================== */
  const graph = {
    nodes: Object.fromEntries(N.map((n) => [n.id, n.label])),
    edges: [...E.values()].map((e) => `${e.a}|${e.b}|${e.t}`).sort(),
    tables: Object.fromEntries([...db.tables.values()].map((t) => [t.name, { cols: [...t.cols.keys()].sort(), access: tAccess.get(t.name) }])),
    fns: Object.fromEntries([...db.fns.values()].map((f) => [f.name, { args: f.args, definer: f.definer, file: f.where.f }])),
    cfg: [...known].sort(),
    find: Object.fromEntries(FIND.map((f) => [f.key, { sev: f.sev, t: f.t }])),
  };
  let lock = null;
  try { lock = JSON.parse(read(LOCK)); } catch { /* lần đầu */ }
  let base = null, baseVer = null;
  if (lock) { if (lock.version === version) { base = lock.prevGraph; baseVer = lock.prevVersion; } else { base = lock.graph; baseVer = lock.version; } }
  const DIFF = { from: baseVer, to: version, items: [] };
  const d = (kind, t, n = []) => DIFF.items.push({ kind, t, n: n.filter((x) => byId.has(x)) });
  if (base) {
    const ks = (o) => new Set(Object.keys(o || {}));
    for (const k of ks(graph.tables)) if (!base.tables?.[k]) d("add", `Bảng mới: ${k}`, [tableNode(k)]);
    for (const k of ks(base.tables)) if (!graph.tables[k]) d("del", `Bỏ bảng: ${k}`);
    for (const k of ks(graph.tables)) if (base.tables?.[k]) {
      const a = new Set(base.tables[k].cols), b = new Set(graph.tables[k].cols);
      for (const c of b) if (!a.has(c)) d("add", `${k}: thêm cột ${c}`, [tableNode(k)]);
      for (const c of a) if (!b.has(c)) d("del", `${k}: bỏ cột ${c}`, [tableNode(k)]);
      for (const op of TABLE_OPS) if (base.tables[k].access?.[op] !== graph.tables[k].access[op]) d("chg", `${k}: quyền ${op} đổi từ "${base.tables[k].access?.[op]}" thành "${graph.tables[k].access[op]}"`, [tableNode(k), rlsId]);
    }
    for (const k of ks(graph.fns)) if (!base.fns?.[k]) d("add", `Hàm SQL mới: ${k}()`, [nodeOfRpc.get(k)]);
    for (const k of ks(base.fns)) if (!graph.fns[k]) d("del", `Bỏ hàm SQL: ${k}()`);
    for (const k of ks(graph.fns)) if (base.fns?.[k] && (base.fns[k].args !== graph.fns[k].args || base.fns[k].definer !== graph.fns[k].definer)) d("chg", `Hàm ${k}(): đổi tham số / quyền chạy`, [nodeOfRpc.get(k)]);
    const bc = new Set(base.cfg || []); for (const k of graph.cfg) if (!bc.has(k)) d("add", `Khoá thiết lập mới: cfg.${k}`, [cfgNode(k)]);
    for (const k of bc) if (!known.has(k)) d("del", `Bỏ khoá thiết lập: cfg.${k}`);
    const be = new Set(base.edges || []), ge = new Set(graph.edges);
    const en = (s) => { const [a, b, t] = s.split("|"); return `${base.nodes?.[a] || label(a)} → ${base.nodes?.[b] || label(b)} (${man.etypes[t]?.name || t})`; };
    for (const s of ge) if (!be.has(s)) d("add", `Liên kết mới: ${en(s)}`, s.split("|").slice(0, 2));
    for (const s of be) if (!ge.has(s)) d("del", `Mất liên kết: ${en(s)}`, s.split("|").slice(0, 2));
    for (const [k, f] of Object.entries(graph.find)) if (!base.find?.[k]) d("risk", `Rủi ro mới (${{ hi: "cao", md: "vừa", lo: "thấp" }[f.sev]}): ${f.t}`, FIND.find((x) => x.key === k)?.n || []);
    for (const [k, f] of Object.entries(base.find || {})) if (!graph.find[k]) d("fixed", `Đã hết: ${f.t}`);
  }
  const newLock = lock && lock.version === version ? { ...lock, graph } : { version, prevVersion: lock?.version || null, graph, prevGraph: lock?.graph || null };
  if (!args.includes("--no-lock")) fs.writeFileSync(path.join(ROOT, LOCK), JSON.stringify(newLock, null, 1) + "\n");

  /* ======================================================================================
     XUẤT HTML
     ====================================================================================== */
  const now = new Date();
  const META = { version, commit, date: `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`, sqlFiles: db.files.length, jsFiles: jsFiles.length, tables: db.tables.size, fns: db.fns.size, cfgKeys: known.size };
  const outN = N.map(({ bind, ...n }) => ({ ...n, auto: n.auto.length ? n.auto : undefined }));   // eslint-disable-line no-unused-vars
  const outE = [...E.values()].map((e) => [e.a, e.b, e.t, [...e.lbl].join(" · "), e.manual && !e.auto ? 1 : 0, e.ev.slice(0, 3).map(loc)]);
  const DATA = { META, LAYERS: man.layers, SECTORS: man.sectors, ETYPES: man.etypes, N: outN, E: outE, RISKS: man.risks.map((r) => ({ ...r, auto: false })), PREP: man.prep, KEY: man.key_points || [], FIND, DIFF };
  const tpl = read("scripts/datamap/template.html");
  const html = tpl.replace("/*__DATA__*/", `const DATA = ${JSON.stringify(DATA).replace(/</g, "\\u003c")};\nconst { META, LAYERS, SECTORS, ETYPES, N, E, RISKS, PREP, FIND, DIFF } = DATA;`);
  fs.mkdirSync(path.dirname(path.resolve(ROOT, OUT)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, OUT), html);

  /* ---------- tóm tắt ra màn hình ---------- */
  const c = (s) => FIND.filter((f) => f.sev === s).length;
  console.log(`Sơ đồ cấu trúc ${version}${commit ? " (" + commit + ")" : ""} → ${OUT}  (${Math.round(html.length / 1024)} KB)`);
  console.log(`  ${db.tables.size} bảng · ${db.fns.size} hàm SQL · ${known.size} khoá thiết lập · ${N.length} ô · ${E.size} liên kết`);
  console.log(`  Kiểm tra tự động: ${c("hi")} cao · ${c("md")} vừa · ${c("lo")} thấp`);
  if (base) console.log(`  So với ${baseVer}: ${DIFF.items.length} thay đổi (${DIFF.items.filter((x) => x.kind === "risk").length} rủi ro mới, ${DIFF.items.filter((x) => x.kind === "fixed").length} đã hết)`);
  for (const f of FIND.filter((x) => x.sev === "hi")) console.log(`  [CAO] ${f.t}${f.where[0] ? "  — " + loc(f.where[0]) : ""}`);
  if (args.includes("--verbose")) for (const f of FIND.filter((x) => x.sev !== "hi")) console.log(`  [${f.sev === "md" ? "VỪA" : "THẤP"}] ${f.t}${f.where[0] ? "  — " + loc(f.where[0]) : ""}`);
}

main();
