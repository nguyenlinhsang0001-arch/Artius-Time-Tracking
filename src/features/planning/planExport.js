/* ARTIUS TIME v12.10 — Xuất toàn bộ Kế hoạch ra Excel (tải thư viện xlsx khi bấm, như các nút xuất khác). */
import { fmt } from "../../core/date.jsx";
import { loadXlsx } from "../../core/db.jsx";
import { cellOf, comparePlan, leftOf, needOf, paVerdict } from "./planCalc.js";

const num = (n) => (n ? +Number(n).toFixed(2) : "");
const head2 = (weeks) => [
  ["", ""].concat(weeks.map((w) => (w.ms ? `T${w.m}${w.m === 1 ? `·${String(w.y).slice(2)}` : ""}` : ""))),
  ["Dự án", "Vai trò"].concat(weeks.map((w) => w.w)),
];

export async function exportPlanXlsx({ plan, projects, roles, weeks, cap, head, realWeeks, start, years = 2, snaps, avail,
  /* v13.59 — dữ liệu cho sheet so sánh, chạy đúng hàm comparePlan của màn "So với thực tế" */
  cmp = null }) {
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

  /* 3 — kế hoạch so với thực tế. v13.59: cùng một hàm comparePlan với màn "So với thực tế", khoảng
     "Từ khi có giờ chấm" (mọi tuần đã qua có giờ gửi), cùng ngưỡng, cùng nhãn kết luận. Trước đây sheet này
     còn chạy luật đời v12 (chỉ tuần cả công ty gửi đủ, ngưỡng cứng ±15%, nhãn "Dự trù thiếu / thừa người"). */
  if (cmp && cmp.weeks?.length) {
    const R = cmp.roles || roles;
    const r = comparePlan({ plan, projects: cmp.projects, roles: R, weeks: cmp.weeks, sent: cmp.sent, staff: cmp.staff,
      hoursCfg: cmp.hoursCfg, holidays: cmp.holidays, lim: cmp.lim, hidden: cmp.hidden });
    const lbl = (w) => { const d = new Date(w.monday); return `T${d.getMonth() + 1}·${Math.min(4, Math.ceil(d.getDate() / 7))}`; };
    const doubt = (o) => r.gapWeeks > 0 && (o.st === "under" || o.st === "none");
    const aoa = [
      ["Khoảng", `${cmp.weeks.length} tuần ${lbl(cmp.weeks[0])} → ${lbl(cmp.weeks[cmp.weeks.length - 1])} (mọi tuần đã qua có giờ gửi)`],
      ["Đơn vị", "người, bình quân mỗi tuần · 1 người = giờ chuẩn của chính tuần đó (đã trừ ngày lễ)"],
      ["Ngưỡng", `đúng kế hoạch khi lệch ≤ ${cmp.lim.tol}% · lệch vai trò khi sai lệch theo vai trò > ${cmp.lim.mix}%`],
      ...(r.gapWeeks ? [["Lưu ý", `${r.gapNames.length} người chưa gửi đủ giờ ở ${r.gapWeeks} tuần: ${r.gapNames.join(", ")} — kết luận có dấu * chưa chắc`]] : []),
      [],
      ["Dự án", "Mã", "Kế hoạch", "Thực tế", "Lệch", "Kết luận", "Theo vai trò (kế hoạch → thực tế)"],
      ...r.list.map((o) => [
        o.p.name, o.p.code || "", +o.KH.toFixed(2), +o.TT.toFixed(2), +o.d.toFixed(2),
        `${paVerdict(o)}${doubt(o) ? " *" : ""}`,
        R.filter((x) => o.kh[x.id] || o.tt[x.id]).map((x) => `${x.id} ${+(o.kh[x.id] || 0).toFixed(2)} → ${+(o.tt[x.id] || 0).toFixed(2)}`).join(" · "),
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(aoa);
    ws3["!cols"] = [{ wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Kế hoạch vs thực tế");
  } else {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Ghi chú": "Chưa có tuần nào đã qua có giờ gửi." }]), "Kế hoạch vs thực tế");
  }

  /* 4 — các bản đã chốt */
  const sn = (snaps || []).map((s) => ({ "Nhãn": s.label || "", "Thời điểm chốt": String(s.taken_at || "").replace("T", " ").slice(0, 16) }));
  const ws4 = XLSX.utils.json_to_sheet(sn.length ? sn : [{ "Ghi chú": "Chưa chốt bản nào." }]);
  ws4["!cols"] = [{ wch: 26 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Bản chốt");

  XLSX.writeFile(wb, `ARTIUS_ke-hoach_${start}-${start + years - 1}_${fmt(new Date())}.xlsx`);
}
