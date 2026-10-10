/* ============================================================
   v1.8 — Gộp thiết lập khi nhiều quản lý cùng sửa

   Thiết lập là một dòng chung. Nếu chỉ "ai lưu sau thì thắng" thì quản lý A (mở app từ sáng)
   thêm một tác vụ sẽ xoá mất nhân sự mà quản lý B vừa thêm. Nên trước khi ghi, app đọc bản
   mới nhất trên server rồi gộp 3 chiều:
     base   = bản mình đã tải (trước khi sửa)
     mine   = bản mình vừa sửa
     theirs = bản mới nhất trên server
   Quy tắc: phần mình không đụng tới thì lấy của server; phần mình sửa thì lấy của mình.
   Danh sách có mã (nhân sự, dự án, tác vụ, vai trò, loại nghỉ) được gộp theo TỪNG MỤC,
   nên hai người cùng sửa một danh sách vẫn giữ được cả hai, trừ khi sửa đúng cùng một mục.
   ============================================================ */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isIdList = (v) => Array.isArray(v) && v.every((x) => x && typeof x === "object" && x.id != null);

function mergeById(base, mine, theirs) {
  const baseMap = new Map(base.map((x) => [x.id, x]));
  const mineMap = new Map(mine.map((x) => [x.id, x]));
  const theirIds = new Set(theirs.map((x) => x.id));
  const out = [];
  for (const t of theirs) {
    const b = baseMap.get(t.id), m = mineMap.get(t.id);
    if (!m) { if (!b) out.push(t); continue; }          // mình không có: mình đã xoá (bỏ) hoặc người kia mới thêm (giữ)
    out.push(b && same(m, b) ? t : m);                   // mình không sửa mục này -> lấy của server; có sửa -> lấy của mình
  }
  for (const m of mine) if (!theirIds.has(m.id) && !baseMap.has(m.id)) out.push(m);   // mục mình mới thêm
  return out;
}

export function mergeConfig(base, mine, theirs) {
  if (!theirs) return mine;
  if (!base || same(base, theirs)) return mine;            // server chưa ai sửa: ghi thẳng bản của mình
  const out = {};
  for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
    const b = base[k], m = mine[k], t = theirs[k];
    if (same(m, b)) { if (t !== undefined) out[k] = t; }   // mình không đụng tới mục này
    else if (same(t, b)) { if (m !== undefined) out[k] = m; }
    else if (isIdList(m) && isIdList(t) && isIdList(b || [])) out[k] = mergeById(b || [], m, t);
    else if (m !== undefined) out[k] = m;                  // cả hai cùng sửa một mục không có mã: lấy của mình
  }
  return out;
}
