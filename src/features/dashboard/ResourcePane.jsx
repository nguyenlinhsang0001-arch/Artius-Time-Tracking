/* ARTIUS TIME v12.22 — vỏ bọc của tab "Tổng quan nguồn lực" trong Dashboard.
   Cùng cách cách ly với PlanPane của mục Kế hoạch:
   1. Tải rời — code chỉ tải khi ai đó mở tab này, các tab Dashboard khác không nặng thêm.
   2. Vỏ bắt lỗi riêng — lỗi hiển thị ở đây không kéo sập Dashboard; tab Dự án và Ma trận vẫn chạy. */
import React, { Suspense } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { errText } from "../../core/db.jsx";
import { btnGhost } from "../../core/ui.jsx";

const ResourceOverview = React.lazy(() => import("./ResourceOverview.jsx"));

class ResBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="p-4 text-sm">
        <div className="flex items-center gap-2 text-base font-semibold text-rose-200">
          <AlertTriangle size={18} className="text-rose-400" /> Mục Tổng quan nguồn lực gặp lỗi
        </div>
        <p className="mt-2 text-rose-100">Các tab khác vẫn dùng bình thường. Kế hoạch đã lưu không bị mất.</p>
        <p className="mt-1 break-words font-mono text-xs text-rose-300">{errText(this.state.err)}</p>
        <button onClick={() => this.setState({ err: null })} className={`mt-3 ${btnGhost}`}><RotateCcw size={14} /> Thử lại</button>
      </div>
    );
  }
}

export function ResourcePane(props) {
  return (
    <ResBoundary>
      <Suspense fallback={<div className="flex items-center gap-2 px-4 py-10 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Đang mở Tổng quan nguồn lực…</div>}>
        <ResourceOverview {...props} />
      </Suspense>
    </ResBoundary>
  );
}
