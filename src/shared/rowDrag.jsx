/* ARTIUS TIME v11 — tách từ App.jsx, nội dung giữ nguyên. */
import React, { useState, useEffect, useCallback } from "react";
import {
  GripVertical,
} from "lucide-react";

/* v7.7 — Thứ tự dự án do người dùng kéo thả, lưu riêng từng máy (localStorage), dùng chung cho Dashboard (Tiến độ dự án) và tab Dự án. */
export const PROJ_ORDER_KEY = "artius:projOrder";
export const readProjOrder = () => { try { const a = JSON.parse(localStorage.getItem(PROJ_ORDER_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
export function useProjOrder() {
  const [order, setOrder] = useState(readProjOrder);
  useEffect(() => { const f = () => setOrder(readProjOrder()); window.addEventListener("artius:projorder", f); return () => window.removeEventListener("artius:projorder", f); }, []);
  const save = useCallback((a) => {
    setOrder(a);
    try { if (a.length) localStorage.setItem(PROJ_ORDER_KEY, JSON.stringify(a)); else localStorage.removeItem(PROJ_ORDER_KEY); window.dispatchEvent(new Event("artius:projorder")); } catch { /* trình duyệt chặn lưu: thứ tự chỉ giữ tới khi tải lại trang */ }
  }, []);
  return [order, save];
}
/* sắp theo thứ tự đã kéo; id chưa có trong danh sách (dự án mới) đứng sau, giữ nguyên thứ tự cũ */
export const sortByProjOrder = (list, order, idOf) => {
  if (!order.length) return list;
  const ix = new Map(order.map((id, i) => [id, i]));
  return list.map((x, i) => [x, i]).sort((a, b) => (ix.get(idOf(a[0])) ?? 1e9 + a[1]) - (ix.get(idOf(b[0])) ?? 1e9 + b[1])).map((x) => x[0]);
};
/* đặt fromId vào trước / sau toId trong dãy ids (đang hiển thị), phần còn lại giữ nguyên */
export const moveInList = (ids, fromId, toId, after) => {
  const a = ids.filter((x) => x !== fromId); let i = a.indexOf(toId); if (i < 0) return ids;
  a.splice(after ? i + 1 : i, 0, fromId); return a;
};
/* kéo thả hàng: tay nắm (handleProps) chỉ ở biểu tượng ⋮⋮ nên không vướng ô nhập / bôi chọn chữ */
export function useRowDrag(onMove) {
  const [dragId, setDragId] = useState(null); const [dropAt, setDropAt] = useState(null);
  const end = () => { setDragId(null); setDropAt(null); };
  const handleProps = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id); e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", id); const row = e.currentTarget.closest("tbody") || e.currentTarget.closest("tr"); if (row) e.dataTransfer.setDragImage(row, 20, 20); } catch { /* bỏ qua */ }
    },
    onDragEnd: end,
  });
  const rowProps = (id) => ({
    onDragOver: (e) => {
      if (!dragId) return; e.preventDefault();
      const b = e.currentTarget.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2;
      if (dropAt?.id !== id || dropAt?.after !== after) setDropAt({ id, after });
    },
    onDrop: (e) => { e.preventDefault(); const d = dropAt, f = dragId; end(); if (d && f && f !== d.id) onMove(f, d.id, d.after); },
  });
  // vạch teal báo vị trí sẽ thả (đặt trên các ô <td> của hàng đầu)
  const mark = (id, kind) => (dragId && dragId !== id && dropAt?.id === id
    ? (kind === "tbody"
      ? (dropAt.after ? "[&>tr:first-child>td]:shadow-[inset_0_-2px_0_#2dd4bf]" : "[&>tr:first-child>td]:shadow-[inset_0_2px_0_#2dd4bf]")
      : (dropAt.after ? "[&>td]:shadow-[inset_0_-2px_0_#2dd4bf]" : "[&>td]:shadow-[inset_0_2px_0_#2dd4bf]"))
    : "") + (dragId === id ? " opacity-40" : "");
  const grip = (id, disabled) => disabled ? null : (
    <span key="grip" {...handleProps(id)} title="Giữ và kéo để đổi vị trí dự án" className="mr-1 inline-flex h-6 w-4 shrink-0 cursor-grab items-center justify-center align-[-5px] text-slate-600 hover:text-slate-300 active:cursor-grabbing">
      <GripVertical size={14} />
    </span>
  );
  return { rowProps, mark, grip };
}

