import { type ReactNode, useEffect, useRef, useState } from "react";

export type MenuItem =
  | { label: string; onClick: () => void; shortcut?: string; disabled?: boolean; checked?: boolean }
  | "separator";

export interface MenuDef {
  label: string;
  items: MenuItem[];
}

/** The window's menu bar: click a title to open it, hover to move between open menus. */
export function MenuBar({ menus, right }: { menus: MenuDef[]; right?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, []);
  return (
    <div ref={ref} className="flex items-center gap-1 border-b border-slate-300 bg-white px-1 text-sm dark:border-slate-700 dark:bg-slate-800">
      {menus.map((m, i) => (
        <div key={m.label} className="relative">
          <button
            className={`rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-700 ${open === i ? "bg-slate-200 dark:bg-slate-700" : ""}`}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => open !== null && setOpen(i)}
          >
            {m.label}
          </button>
          {open === i && (
            <div className="absolute left-0 top-full z-50 mt-0.5 min-w-56 rounded border border-slate-300 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
              {m.items.map((item, j) =>
                item === "separator" ? (
                  <div key={j} className="my-1 border-t border-slate-200 dark:border-slate-700" />
                ) : (
                  <button
                    key={item.label}
                    disabled={item.disabled}
                    className="flex w-full items-center gap-3 px-3 py-1 text-left hover:bg-sky-100 disabled:text-slate-400 disabled:hover:bg-transparent dark:hover:bg-sky-900 dark:disabled:text-slate-500"
                    onClick={() => {
                      setOpen(null);
                      item.onClick();
                    }}
                  >
                    <span className="w-3">{item.checked ? "✓" : ""}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && <span className="text-xs text-slate-500">{item.shortcut}</span>}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
      <div className="flex-1" />
      {right}
    </div>
  );
}

/** A right-click menu at a screen position. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, [onClose]);
  return (
    <div
      className="fixed z-50 min-w-44 rounded border border-slate-300 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, j) =>
        item === "separator" ? (
          <div key={j} className="my-1 border-t border-slate-200 dark:border-slate-700" />
        ) : (
          <button
            key={item.label}
            disabled={item.disabled}
            className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-sky-100 disabled:text-slate-400 dark:hover:bg-sky-900"
            onClick={() => {
              onClose();
              item.onClick();
            }}
          >
            <span className="w-3">{item.checked ? "✓" : ""}</span>
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
