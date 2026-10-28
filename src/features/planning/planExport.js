/* ARTIUS TIME v12.10 — Xuất toàn bộ Kế hoạch ra Excel (tải thư viện xlsx khi bấm, như các nút xuất khác). */
import { fmt } from "../../core/date.jsx";
import { loadXlsx } from "../../core/db.jsx";
import { cellOf, leftOf, needOf, planVsActual, verdictOf } from "./planCalc.js";

const num = (n) => (n ? +Number(n).toFixed(2) : "");
const head2 = (weeks) => [
  ["", ""].concat(weeks.map((w) => (w.ms ? `T${w.m}${w.m === 1 ? `·${String(w.y).slice(2)}` : ""}` : ""))),
  ["Dự án", "Vai trò"].concat(weeks.map((w) => w.w)),
];

export async function exportPlanXlsx({ plan, projects, roles, weeks, cap, head, actual, okWeeks, realWeeks, start, snaps, avail }) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const pids = projects.map((p) => p.id);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const colsW = (n) => [{ wch: 30 }, { wch: 18 }, ...Array(n).fill({ wch: 5 })];

  /* 1 — lưới kế hoạch: dự án × vai trò × cột tuần */
  const grid = head2(weeks);
  for (const p of projects) {
    const used = roles.filter((r) => weeks.some((w) => cellOf(plan, p.id, r.id, w.i) > 0));
    for (const r of used)
      grid.push([`${p.code ? `${p.code} ` : ""}${p.name}`, `${r.id} · ${r.name}`].concat(weeks.map((w) => num(cellOf(plan, p.id, r.id, w.i)))));
  }
  const ws1 = XLSX.utils.aoa_to_sheet(grid);
  ws1["!cols"] = colsW(weeks.length);
  XLSX.utils.book_append_sheet(wb, ws1, "Lưới kế hoạch");

  /* 2 — tổng theo vai trò: cần, năng lực, CÒN */
  const tot = head2(weeks);
  tot[1][0] = "Vai trò"; tot[1][1] = "Chỉ số";
  for (const r of roles) {
    const any = (cap.get(r.id) || 0) > 0 || weeks.some((w) => needOf(plan, pids, r.id, w.i) > 0);
    if (!any) continue;
    const label = `${r.id} · ${r.name} (${head.get(r.id) || 0} người)`;
    tot.push([label, "Cần"].concat(weeks.map((w) => num(needOf(plan, pids, r.id, w.i)))));
    tot.push(["", `Năng lực (${Math.round(avail * 100)}%)`].concat(weeks.map(() => num(cap.get(r.id) || 0))));
    tot.push(["", "CÒN"].concat(weeks.map((w) => +leftOf(plan, pids, r.id, w.i, cap).toFixed(2))));
  }
  const ws2 = XLSX.utils.aoa_to_sheet(tot);
  ws2["!cols"] = [{ wch: 34 }, { wch: 18 }, ...Array(weeks.length).fill({ wch: 5 })];
  XLSX.utils.book_append_sheet(wb, ws2, "Tổng theo vai trò");

  /* 3 — kế hoạch so với giờ thực tế (chỉ các tuần đã qua và đủ giờ) */
  const pva = planVsActual({ plan, projects, weeks: realWeeks, okWeeks, actual }).map((x) => ({
    "Dự án": `${x.project.code ? `${x.project.code} ` : ""}${x.project.name}`,
    "Vai trò": `${x.rid} · ${roleName.get(x.rid) || ""}`,
    "Kế hoạch (người-tuần)": x.kh,
    "Thực tế (người-tuần)": x.th,
    "Thực tế / Kế hoạch (%)": x.pc ?? "",
    "Nhận định": verdictOf(x.pc)[0],
    "Số tuần đủ giờ": x.weeks,
  }));
  const ws3 = XLSX.utils.json_to_sheet(pva.length ? pva : [{ "Ghi chú": "Chưa có tuần nào đã qua và đủ giờ của mọi nhân sự." }]);
  ws3["!cols"] = [{ wch: 34 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Kế hoạch vs thực tế");

  /* 4 — các bản đã chốt */
  const sn = (snaps || []).map((s) => ({ "Nhãn": s.label || "", "Thời điểm chốt": String(s.taken_at || "").replace("T", " ").slice(0, 16) }));
  const ws4 = XLSX.utils.json_to_sheet(sn.length ? sn : [{ "Ghi chú": "Chưa chốt bản nào." }]);
  ws4["!cols"] = [{ wch: 26 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Bản chốt");

  XLSX.writeFile(wb, `ARTIUS_ke-hoach_${start}-${start + 1}_${fmt(new Date())}.xlsx`);
}
