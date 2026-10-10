/* ============================================================
   v1.8 — Lớp dữ liệu: mỗi loại dữ liệu một bảng riêng trên Supabase

     artius_config   một dòng (id = "main"): thiết lập — nhân sự, dự án, tác vụ, vai trò, ngày lễ…
     artius_ts       mỗi dòng = bảng công của MỘT nhân sự trong MỘT tháng (emp_id, ym)

   Vì sao tách: tới v1.7 toàn bộ dữ liệu nằm trong một dòng duy nhất, mỗi lần ai đó bấm Lưu là
   ghi lại cả khối, nên người lưu sau đè mất phần người khác vừa lưu. Giờ mỗi người chỉ ghi
   đúng dòng của mình. Database cũng tự chặn: nhân sự chỉ đọc/ghi được dòng của chính họ,
   chỉ tài khoản quản lý đọc/ghi được tất cả và sửa được thiết lập (xem supabase/schema.sql).

   Mọi hàm ở đây ném Error khi lỗi; "không có dòng nào" KHÔNG phải lỗi (trả về null / {}).
   ============================================================ */
import { supabase } from "./storage.js";

const CONFIG = "artius_config";
const TS = "artius_ts";
const PAGE = 1000;   // Supabase trả tối đa 1000 dòng mỗi lần đọc
const CHUNK = 200;   // số dòng mỗi lần ghi hàng loạt

const fail = (op, error) => new Error(`Supabase ${op}: ${error?.message || error?.code || "lỗi không rõ"}`);
const slotOf = (r) => `${r.emp_id}:${r.ym}`;
const splitSlot = (k) => { const i = k.indexOf(":"); return { emp_id: k.slice(0, i), ym: k.slice(i + 1) }; };
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

/* Thiết lập. Trả về { config, rev }, hoặc null khi chưa có dòng nào (cài mới).
   rev là số phiên bản của dòng thiết lập, tăng 1 sau mỗi lần ghi. */
export async function fetchConfig() {
  const { data, error } = await supabase.from(CONFIG).select("value,rev").eq("id", "main").maybeSingle();
  if (error) throw fail("đọc thiết lập", error);
  if (!data) return null;
  return { config: parse(data.value), rev: Number(data.rev) || 1 };
}

/* Ghi thiết lập, chỉ khi dòng trên server vẫn đang ở đúng phiên bản expectedRev (bản mình vừa đọc).
   Nếu ai đó đã ghi chen vào giữa thì KHÔNG ghi, trả về { conflict: true } để nơi gọi đọc lại và gộp.
   expectedRev = null: tạo dòng thiết lập đầu tiên (cài mới). */
export async function saveConfig(config, expectedRev) {
  const value = JSON.stringify(config), updated_at = new Date().toISOString();
  if (expectedRev == null) {
    const { error } = await supabase.from(CONFIG).insert({ id: "main", value, rev: 1, updated_at });
    if (error && error.code === "23505") return { conflict: true };   // người khác vừa tạo trước
    if (error) throw fail("ghi thiết lập", error);
    return { rev: 1 };
  }
  const { data, error } = await supabase.from(CONFIG)
    .update({ value, rev: expectedRev + 1, updated_at }).eq("id", "main").eq("rev", expectedRev).select("rev");
  if (error) throw fail("ghi thiết lập", error);
  if (!data?.length) return { conflict: true };
  return { rev: expectedRev + 1 };
}

/* Bảng công, trả về { "<empId>:<ym>": bucket }.
   Không truyền gì: mọi dòng người gọi được phép thấy (nhân sự -> của mình; quản lý -> tất cả).
   Truyền empId + yms: chỉ các tháng đó của một người (dùng để đọc lại ngay trước khi lưu). */
export async function fetchTs({ empId, yms } = {}) {
  const out = {};
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(TS).select("emp_id,ym,value").order("emp_id").order("ym").range(from, from + PAGE - 1);
    if (empId) q = q.eq("emp_id", empId);
    if (yms?.length) q = q.in("ym", yms);
    const { data, error } = await q;
    if (error) throw fail("đọc bảng công", error);
    for (const r of data || []) { const v = parse(r.value); if (v) out[slotOf(r)] = v; }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/* Ghi các bảng công trong map { "<empId>:<ym>": bucket }. Chỉ đụng tới đúng các dòng đó. */
export async function saveTs(map) {
  const now = new Date().toISOString();
  const rows = Object.entries(map).map(([k, v]) => ({ ...splitSlot(k), value: JSON.stringify(v), updated_at: now }));
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(TS).upsert(rows.slice(i, i + CHUNK), { onConflict: "emp_id,ym" });
    if (error) throw fail("ghi bảng công", error);
  }
  return true;
}

/* Xoá toàn bộ bảng công (chỉ tài khoản quản lý xoá được dòng của người khác). */
export async function deleteAllTs() {
  const { error } = await supabase.from(TS).delete().neq("emp_id", "");
  if (error) throw fail("xoá bảng công", error);
  return true;
}
