/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import { isLight } from "../core/theme.jsx";

/* v5.9 — Tổng quan bảng công (quản lý). Thay khung "Tình trạng nộp bảng công" + Ma trận giờ công cũ.
   · Tuần: lưới ngày T2 → CN, mỗi ô ghi giờ đã gửi của ngày (tăng ca ghi "+h" xanh ngọc); cuối dòng: tổng / chuẩn,
     trạng thái nộp tuần và cột Nhắc (chuông — rê chuột xem lý do; bấm gửi thông báo nhắc qua /api/push "nudge").
   · Tháng: lịch nhiệt — mỗi ngày một ô nhỏ cùng bộ màu với ô tuần; bên phải tổng / chuẩn và chấm trạng thái nộp từng
     tuần (bấm chấm → mở tuần đó ở chế độ Tuần).
   Màu ô (dùng chung hai chế độ): đủ giờ (xanh dương nhạt) · thiếu giờ (viền vàng) · nháp chưa gửi (sọc vàng) ·
   bỏ trống (viền đỏ) · nghỉ phép (xanh nhạt, "P") · ngày lễ (sọc xám, "Lễ") · CN / chưa tới (trống).
   Chỉ giờ của ngày ĐÃ GỬI được cộng vào tổng; giờ đã lưu nhưng chưa gửi hiện là "nháp". */
export const DAY_ST = {
  full: { background: "#60a5fa26", color: "#dbeafe" },
  part: { background: "#fbbf2414", color: "#fbbf24", boxShadow: "inset 0 0 0 1px #fbbf2455" },
  draft: { color: "#64748b", fontWeight: 500, border: "1.5px dashed #94a3b880" },   // v6.9: viền nét đứt như bảng Tháng   // v6.7: nháp chỉ hiện số mờ, không tô màu cảnh báo
  none: { background: "#fb71850f", color: "#fb7185", boxShadow: "inset 0 0 0 1px #fb718540" },
  leave: { background: "#fb923c1f", color: "#fb923c", boxShadow: "inset 0 0 0 1px #fb923c40" },   // v6.4: cam đất, tách khỏi xanh "đủ giờ"
  hol: { background: "repeating-linear-gradient(45deg,#cbd5e112 0 4px,transparent 4px 8px)", color: "#cbd5e1", boxShadow: "inset 0 0 0 1px #cbd5e140" },
  off: { color: "#334155" },
  fut: { color: "#334155", boxShadow: "inset 0 0 0 1px #1e293b80" },
};
/* v7.8 — bộ màu ô cho giao diện Sáng (chữ đậm trên nền nhạt) */
export const DAY_ST_L = {
  full: { background: "#3b82f61f", color: "#1d4ed8" },
  part: { background: "#f59e0b1f", color: "#b45309", boxShadow: "inset 0 0 0 1px #d9770666" },
  draft: { color: "#64748b", fontWeight: 500, border: "1.5px dashed #94a3b8" },
  none: { background: "#fff1f2", color: "#be123c", boxShadow: "inset 0 0 0 1px #fecdd3" },   // v7.9: nhạt hơn
  leave: { background: "#cbd5e1", color: "#334155", boxShadow: "inset 0 0 0 1px #94a3b8" },   // v7.9: nghỉ phép xám xanh (tách khỏi thiếu giờ vàng và giờ cố gắng tím)
  hol: { background: "repeating-linear-gradient(45deg,#64748b22 0 4px,transparent 4px 8px)", color: "#64748b", boxShadow: "inset 0 0 0 1px #64748b40" },
  off: { color: "#cbd5e1" },
  fut: { color: "#cbd5e1", boxShadow: "inset 0 0 0 1px #e2e8f0" },
};
export const DAY_ST_SM_L = {
  full: { background: "#3b82f633" },
  part: { background: "#fde68a", boxShadow: "inset 0 0 0 1px #f59e0b" },   // v7.9: thiếu giờ vàng đậm
  draft: { border: "1.5px dashed #94a3b8" },
  none: { background: "#fecdd380" },   // bỏ trống: nền hồng nhạt, không viền — đỡ rối khi cả tháng
  leave: { background: "#cbd5e1", boxShadow: "inset 0 0 0 1px #94a3b8" },
  hol: { background: "repeating-linear-gradient(45deg,#64748b30 0 3px,transparent 3px 6px)" },
  off: { background: "#e2e8f080" },
  fut: { background: "#fff", boxShadow: "inset 0 0 0 1px #e2e8f0" },
};
export const dayStyle = (k) => (isLight() ? DAY_ST_L : DAY_ST)[k];
export const dayStyleSm = (k) => (isLight() ? DAY_ST_SM_L : DAY_ST_SM)[k];
/* ô nhỏ của chế độ Tháng: cùng bộ màu, đậm hơn một chút để thấy rõ ở kích thước 22px */
export const DAY_ST_SM = {
  full: { background: "#60a5fa38" },
  part: { background: "#fbbf2420", boxShadow: "inset 0 0 0 1px #fbbf2466" },
  draft: { border: "1.5px dashed #94a3b880" },   // v6.9: nháp = viền nét đứt xám nhạt, tách khỏi ô Chủ nhật
  none: { boxShadow: "inset 0 0 0 1px #fb718566" },
  leave: { background: "#fb923c40", boxShadow: "inset 0 0 0 1px #fb923c66" },
  hol: { background: "repeating-linear-gradient(45deg,#cbd5e133 0 3px,transparent 3px 6px)" },
  off: { background: "#1e293b33" },
  fut: { boxShadow: "inset 0 0 0 1px #1e293b80" },
};
