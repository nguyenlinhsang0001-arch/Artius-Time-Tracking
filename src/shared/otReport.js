/* ARTIUS TIME v13.31 — gom giờ tăng ca của một người trong một tháng rồi đổ vào mẫu giấy công ty.
   Tách riêng khỏi màn Chấm công để màn Dashboard cá nhân dùng lại được cùng một hàm,
   tránh hai nơi tự tính khác nhau. Phần dựng file Excel nằm ở features/otExcel.js,
   nạp bằng import động nên thư viện nén chỉ tải khi người dùng thật sự bấm nút. */

import { ensureMonths, dbTs } from "../core/db.jsx";
import { NO_PROJECT, OT_TASKS, isOtId, otSpan } from "../core/domain.jsx";

/* Chỉ lấy giờ ĐÃ GỬI: bảng này đem ký và tính lương, giờ nháp chưa gửi không được tính. */
export async function collectOt({ cfg, empId, ym }) {
  await ensureMonths([ym]);
  const b = dbTs(empId, ym) || { rows: [], sent: {} };
  const sent = b.sent || {};
  const projName = (id) => {
    if (!id || id === NO_PROJECT) return "Việc chung";
    const p = (cfg.projects || []).find((x) => x.id === id);
    return p ? p.name : "(dự án đã xoá)";   // tên đầy đủ, không rút về mã
  };
  const out = [];
  for (const r of b.rows || []) {
    if (!isOtId(r.taskId)) continue;
    const sp = otSpan(OT_TASKS.find((t) => t.id === r.taskId));
    if (!sp) continue;                       // khung giờ không đọc được thì bỏ, không đoán
    for (const [d, hv] of Object.entries(r.days || {})) {
      const h = Number(hv) || 0;
      if (h <= 0 || !sent[d] || d.slice(0, 7) !== ym) continue;
      out.push({ day: +d.slice(8), projectId: r.projectId || NO_PROJECT, projName: projName(r.projectId), bandStart: sp.start, hours: h });
    }
  }
  return out;
}

/* Xuất file cho một người, một tháng. Trả về true nếu đã tải file xuống. */
export async function runOtExport({ cfg, empId, ym, flash }) {
  const [y, mo] = ym.split("-").map(Number);
  try {
    const entries = await collectOt({ cfg, empId, ym });
    if (!entries.length) { flash?.(`Tháng ${mo}/${y} chưa có giờ tăng ca nào đã gửi.`, "err"); return false; }
    const { buildOtXlsx, otOverflow, downloadBytes } = await import("../features/otExcel.js");
    const over = otOverflow(entries);
    const name = (cfg.employees || []).find((e) => e.id === empId)?.name || "";
    const bytes = await buildOtXlsx({ empName: name, year: y, month: mo, entries });
    downloadBytes(bytes, `Tang ca ngoai gio ${String(mo).padStart(2, "0")}-${y} - ${name || empId}.xlsx`);
    // mẫu giấy chỉ có 2 ô công trình mỗi nửa tháng — nói thẳng khi có công trình không lọt vào
    if (over > 0) flash?.(`Đã xuất, nhưng mẫu chỉ chứa 2 công trình mỗi nửa tháng — ${over} công trình chưa được điền, cần ghi tay thêm.`, "err");
    else flash?.("Đã xuất bảng chấm công ngoài giờ.");
    return true;
  } catch (e) {
    flash?.(`Chưa xuất được — ${e.message}`, "err");
    return false;
  }
}
