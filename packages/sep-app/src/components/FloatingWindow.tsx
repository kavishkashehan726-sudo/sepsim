import { type ReactNode, useRef, useState } from "react";

/** A small window that can be dragged by its title bar (double-click a view to open one). */
export function FloatingWindow({ title, onClose, children, start }: { title: string; onClose: () => void; children: ReactNode; start: { x: number; y: number } }) {
  const [pos, setPos] = useState(start);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  return (
    <div
      className="fixed z-30 flex h-96 w-[28rem] resize flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label={title}
    >
      <div
        className="flex cursor-move items-center border-b border-slate-300 bg-slate-100 px-2 py-1 text-sm font-semibold dark:border-slate-600 dark:bg-slate-800"
        onPointerDown={(e) => {
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => drag.current && setPos({ x: e.clientX - drag.current.dx, y: Math.max(0, e.clientY - drag.current.dy) })}
        onPointerUp={() => (drag.current = null)}
      >
        <span className="flex-1">{title}</span>
        <button className="rounded px-2 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={onClose} aria-label={`Close ${title}`}>×</button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
