/* ARTIUS TIME v13.29 — Xuất "BẢNG CHẤM CÔNG_NGOÀI GIỜ" theo đúng mẫu giấy của công ty.

   Cách làm: KHÔNG dựng lại file Excel. Lấy chính file mẫu (public/mau-tang-ca.xlsx — bản .xls gốc
   của công ty đã chuyển sang .xlsx và xoá sạch dữ liệu), mở ra như một file zip, sửa đúng vài ô trong
   phần XML của sheet rồi nén lại. Nhờ vậy khung, đường kẻ, font, ô ký tên, khổ giấy in và CÔNG THỨC
   cột "Số giờ" giữ nguyên 100% so với bản đang dùng.

   Bố cục sheet "Ngoai gio (2)" (chỉ số dòng / cột theo Excel):
     C4            Họ tên nhân viên          U3, Y3   Từ ngày / đến ngày
     E5..AG5       ngày 1..15 (cách 2 cột)   T37      dòng "Tp. HCM, ngày … tháng … năm …"
     B42           Người lập
     Khối 1 — ngày 1..15 nằm ở cột E..AH:
       CRM 1 = dòng 7..12, CRM 2 = dòng 13..18   (tên công trình ở B7 / B13)
     Khối 2 — ngày 16..31 nằm ở cột C..AH:
       CRM 3 = dòng 23..28, CRM 4 = dòng 29..34  (tên công trình ở B23 / B29)
     Mỗi CRM gồm 6 dòng, mỗi dòng một KHUNG GIỜ cố định (cột C/D của khối 1):
       0: 17:30–21:00   1: 22:00–24:00   2: 00:00–08:00
       3: 08:00–12:00   4: 13:00–17:00   5: 17:30–21:00 (dự phòng)
     Mỗi ngày chiếm 2 cột: V (vào) và R (ra), ghi dưới dạng giờ của Excel.

   App chỉ lưu SỐ GIỜ theo khung, không lưu giờ vào/ra thật, nên V/R được suy ra:
     V = giờ bắt đầu của khung, R = V + số giờ đã chấm. (Đã chốt với Sang 03/11/2026.)
   Cột "Số tiền" để trống cho kế toán. */

import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

const SHEET = "xl/worksheets/sheet2.xml";   // "Ngoai gio (2)"

/* 6 khung giờ của mẫu, tính theo phút kể từ 0h — dùng để xếp giờ của app vào đúng dòng */
const TPL_BANDS = [17 * 60 + 30, 22 * 60, 0, 8 * 60, 13 * 60, 17 * 60 + 30];
/* khung của app không khớp mốc nào ở trên thì dồn vào dòng dự phòng (số 5) */
const SPARE_ROW = 5;

const colName = (n) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/* số ngày của Excel: đếm từ 30/12/1899, giờ địa phương để không lệch múi giờ */
const serial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);

/* Ghi một ô, giữ nguyên style sẵn có của ô đó trong mẫu.
   Ô nào mẫu không có (hiếm) thì chèn vào đúng vị trí theo thứ tự cột, để Excel không báo hỏng file. */
function setCell(xml, ref, inner, attr = "") {
  const re = new RegExp(`<c r="${ref}"((?: [a-zA-Z:]+="[^"]*")*?)\\s*(?:/>|>(?:(?!</c>)[\\s\\S])*?</c>)`);
  const m = re.exec(xml);
  const cell = (style) => `<c r="${ref}"${style}${attr}>${inner}</c>`;
  if (m) {
    const s = /\ss="\d+"/.exec(m[1]);
    return xml.slice(0, m.index) + cell(s ? s[0] : "") + xml.slice(m.index + m[0].length);
  }
  // chèn mới: tìm dòng rồi đặt trước ô đầu tiên có cột lớn hơn
  const rowN = /\d+$/.exec(ref)[0], myCol = ref.slice(0, ref.length - rowN.length);
  const idx = (c) => [...c].reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0);
  const rowRe = new RegExp(`<row r="${rowN}"[^>]*>([\\s\\S]*?)</row>`);
  const rm = rowRe.exec(xml);
  if (!rm) return xml;                       // không có dòng thì bỏ qua, thà thiếu còn hơn hỏng file
  let body = rm[1], done = false;
  body = body.replace(/<c r="([A-Z]+)\d+"/g, (full, c) => {
    if (!done && idx(c) > idx(myCol)) { done = true; return cell("") + full; }
    return full;
  });
  if (!done) body += cell("");
  return xml.slice(0, rm.index) + rm[0].replace(rm[1], body) + xml.slice(rm.index + rm[0].length);
}
const setNum = (xml, ref, v) => setCell(xml, ref, `<v>${v}</v>`);
const setText = (xml, ref, s) => setCell(xml, ref, `<is><t xml:space="preserve">${esc(s)}</t></is>`, ` t="inlineStr"`);

/* Gom giờ tăng ca của một người trong tháng thành { pid -> { name, byCell: Map("day|bandRow" -> giờ), total } }.
   entries: [{ day, projectId, projName, bandStart (phút), hours }] — đã lọc sẵn chỉ giờ ĐÃ GỬI. */
export function groupOt(entries) {
  const byProj = new Map();
  for (const e of entries) {
    if (!(e.hours > 0)) continue;
    const p = byProj.get(e.projectId) || { name: e.projName, byCell: new Map(), total: 0 };
    let row = TPL_BANDS.indexOf(e.bandStart);
    if (row < 0) row = SPARE_ROW;
    const k = `${e.day}|${row}`;
    p.byCell.set(k, (p.byCell.get(k) || 0) + e.hours);
    p.total += e.hours;
    byProj.set(e.projectId, p);
  }
  return [...byProj.entries()].sort((a, b) => b[1].total - a[1].total);
}

/* Dựng file .xlsx đã điền. Trả về Uint8Array. */
export async function buildOtXlsx({ templateUrl = "/mau-tang-ca.xlsx", empName, year, month, entries, signer }) {
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error(`Không tải được file mẫu (${res.status})`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
  if (!zip[SHEET]) throw new Error("File mẫu không đúng cấu trúc — thiếu sheet Ngoài giờ");
  let xml = strFromU8(zip[SHEET]);

  const last = new Date(year, month, 0).getDate();
  xml = setText(xml, "C4", empName || "");
  xml = setNum(xml, "U3", serial(year, month, 1));
  xml = setNum(xml, "Y3", serial(year, month, last));
  xml = setText(xml, "T37", `Tp. HCM, ngày ${String(last).padStart(2, "0")} tháng ${String(month).padStart(2, "0")} năm ${year}`);
  xml = setText(xml, "B42", signer || empName || "");
  // dòng 5: ngày 1..15 ở E, G, I, … AG (khối 2 đã in sẵn số 16..31 trong mẫu)
  for (let d = 1; d <= 15; d++) xml = setNum(xml, `${colName(5 + (d - 1) * 2)}5`, serial(year, month, d));

  /* Hai khối của mẫu là hai nửa tháng độc lập, mỗi khối 2 ô CRM. Nên xếp riêng từng khối:
     công trình nào có giờ ở nửa đầu thì giành ô ở khối 1, có giờ ở nửa sau thì giành ô ở khối 2.
     Một công trình chạy suốt tháng sẽ chiếm một ô ở mỗi khối (đúng cách điền tay xưa nay). */
  const groups = groupOt(entries);
  const BLOCKS = [
    { half: (d) => d <= 15, slots: [{ first: 7, nameRef: "B7" }, { first: 13, nameRef: "B13" }], colV: (d) => 5 + (d - 1) * 2 },      // E=5 cho ngày 1
    { half: (d) => d >= 16, slots: [{ first: 23, nameRef: "B23" }, { first: 29, nameRef: "B29" }], colV: (d) => 3 + (d - 16) * 2 },   // C=3 cho ngày 16
  ];
  for (const blk of BLOCKS) {
    const inBlock = groups.filter(([, g]) => [...g.byCell.keys()].some((k) => blk.half(+k.split("|")[0])));
    inBlock.slice(0, blk.slots.length).forEach(([, g], i) => {
      const { first, nameRef } = blk.slots[i];
      xml = setText(xml, nameRef, g.name);
      for (const [k, h] of g.byCell) {
        const [dayS, rowS] = k.split("|"); const day = +dayS, bandRow = +rowS;
        if (!blk.half(day)) continue;
        const start = TPL_BANDS[bandRow];
        const cV = blk.colV(day);
        xml = setNum(xml, `${colName(cV)}${first + bandRow}`, start / 1440);
        xml = setNum(xml, `${colName(cV + 1)}${first + bandRow}`, Math.min(1, (start + h * 60) / 1440));
      }
    });
  }

  zip[SHEET] = strToU8(xml);
  return zipSync(zip, { level: 6 });
}

/* Số lần một công trình không còn ô CRM trống (mỗi nửa tháng mẫu chỉ chứa 2 công trình).
   Dùng để báo thẳng cho người xuất, không âm thầm nuốt dữ liệu. */
export function otOverflow(entries) {
  const groups = groupOt(entries);
  let n = 0;
  for (const half of [(d) => d <= 15, (d) => d >= 16]) {
    const c = groups.filter(([, g]) => [...g.byCell.keys()].some((k) => half(+k.split("|")[0]))).length;
    n += Math.max(0, c - 2);
  }
  return n;
}

export function downloadBytes(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
