/* ARTIUS TIME v12 — vỏ bọc của module Kế hoạch.
   Hai lớp cách ly để module mới không kéo theo phần đang chạy ổn định:
   1. Tải rời — code của module thành một file riêng, chỉ tải khi ai đó mở tab Kế hoạch.
      Nhân viên chấm công không phải tải thêm byte nào.
   2. Vỏ bắt lỗi riêng — lỗi hiển thị trong module chỉ làm hỏng khung này, Chấm công và Bảng công vẫn chạy.
      (AppErrorBoundary của app bọc toàn bộ màn hình, nên không dùng được cho việc này.) */
import React, { Suspense } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { errText } from "../../core/db.jsx";
import { btnGhost } from "../../core/ui.jsx";

const ResourcePlan = React.lazy(() => import("./ResourcePlan.jsx"));

class PlanBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-5 text-sm">
        <div className="flex items-center gap-2 text-base font-semibold text-rose-200">
          <AlertTriangle size={18} className="text-rose-400" /> Mục Kế hoạch gặp lỗi
        </div>
        <p className="mt-2 text-rose-100">Các mục khác vẫn dùng bình thường. Kế hoạch đã lưu không bị mất.</p>
        <p className="mt-1 break-words font-mono text-xs text-rose-300">{errText(this.state.err)}</p>
        <button onClick={() => this.setState({ err: null })} className={`mt-3 ${btnGhost}`}><RotateCcw size={14} /> Thử lại</button>
      </div>
    );
  }
}

export function PlanPane(props) {
  return (
    <PlanBoundary>
      <Suspense fallback={<div className="flex items-center gap-2 px-4 py-10 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Đang mở mục Kế hoạch…</div>}>
        <ResourcePlan {...props} />
      </Suspense>
    </PlanBoundary>
  );
}
