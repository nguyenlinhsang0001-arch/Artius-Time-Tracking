/* ARTIUS TIME v12 — đọc / ghi lưới kế hoạch.
   Dữ liệu nằm ở BẢNG RIÊNG (artius_plan, artius_plan_snapshot), không đụng vào thiết lập hay bảng công:
   xoá sạch bảng kế hoạch cũng không mất một giờ công nào. Cần chạy supabase/v12_ke_hoach.sql một lần. */
import { supabase } from "../../storage.js";

/* Lỗi do CHƯA CHẠY file SQL thì báo bằng tiếng người. Còn lỗi do QUYỀN thì hiện nguyên câu
   mà hàm SQL đã raise ("Chỉ Admin được…"), vì đó mới là thông tin người dùng cần.
   Cùng cách nhận biết với artius_support_set / artius_emp_projects_set trong App.jsx. */
const DENIED = /Admin|đăng nhập|bị khoá|không hợp lệ/;
export const isMissingTable = (e) => {
  const m = String(e?.message || e || "");
  return /artius_plan|relation|schema cache|function|does not exist/i.test(m) && !DENIED.test(m);
};
export const errMsg = (e) => String(e?.message || e || "");
export const SQL_HINT = "Chưa bật được: Admin cần chạy file supabase/v12_ke_hoach.sql trên Supabase.";

export const loadPlan = async (year) => {
  const { data, error } = await supabase.from("artius_plan").select("project_id, role_id, weeks").eq("year", year);
  if (error) throw error;
  const out = {};
  for (const r of data || []) {
    if (!out[r.project_id]) out[r.project_id] = {};
    out[r.project_id][r.role_id] = Array.isArray(r.weeks) ? r.weeks.map((v) => Number(v) || 0) : [];
  }
  return out;
};

export const savePlan = async (year, plan) => {
  const rows = [];
  for (const pid of Object.keys(plan || {}))
    for (const rid of Object.keys(plan[pid] || {}))
      rows.push({ project_id: pid, role_id: rid, weeks: plan[pid][rid] });
  const { error } = await supabase.rpc("artius_plan_set", { p_year: year, p_rows: rows });
  if (error) throw error;
};

/* Chốt bản kế hoạch: chụp lại nguyên trạng để về sau so với thực tế trên bản ĐÃ CHỐT,
   tránh chuyện sửa kế hoạch cho khớp thực tế rồi báo cáo nào cũng đẹp. */
export const snapshotPlan = async (year, label, plan) => {
  const { error } = await supabase.rpc("artius_plan_snapshot_add", { p_year: year, p_label: label, p_data: plan });
  if (error) throw error;
};
export const listSnapshots = async (year) => {
  const { data, error } = await supabase.from("artius_plan_snapshot")
    .select("id, taken_at, label").eq("year", year).order("taken_at", { ascending: false }).limit(24);
  if (error) throw error;
  return data || [];
};
/* v13.62 — SAO LƯU: đọc nguyên dạng mọi dòng của hai bảng kế hoạch, không gom theo năm và không
   cắt bớt như listSnapshots (giới hạn 24 bản). Script khôi phục ghi thẳng lại đúng các dòng này. */
export const dumpPlanTables = async () => {
  const page = async (table, cols, order) => {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(cols).order(order).range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) return out;
    }
  };
  return {
    plan: await page("artius_plan", "year, project_id, role_id, weeks, updated_at", "year"),
    snapshots: await page("artius_plan_snapshot", "id, year, label, data, taken_at", "taken_at"),
  };
};

export const loadSnapshot = async (id) => {
  const { data, error } = await supabase.from("artius_plan_snapshot").select("data").eq("id", id).single();
  if (error) throw error;
  return data?.data || {};
};
