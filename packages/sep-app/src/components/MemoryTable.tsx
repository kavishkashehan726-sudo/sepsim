import { useEffect, useRef, useState } from "react";
import { type Radix, formatValue } from "../sim/format";
import { useSession } from "../sim/useSession";
import { EditableValue } from "./EditableValue";
import { RadixMenu } from "./ValueTable";

/** The red marker the old SEPSim showed next to the program counter's location. */
function PcArrow() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-label="Program counter" className="inline-block align-middle">
      <title>Program counter</title>
      <path d="M0 0h6l8 6-8 6H0l8-6z" fill="#dc2626" />
    </svg>
  );
}

/**
 * Location / Contents list of a memory. The rows of the current instruction are marked, and
 * a red arrow points at the program counter's location, which is kept in view.
 */
export function MemoryTable({ path, title, radix, onRadix }: { path: string; title: string; radix: Radix; onRadix: (r: Radix) => void }) {
  const s = useSession();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const words = s.memoryWords(path);
  const changed = new Set(s.changedAddresses(path));
  const pc = s.machine && path.endsWith("as_ram/asram") ? s.machine.pc.op : null;
  const pcAt = pc && pc.u === 0 ? pc.v : -1;
  const pcRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    pcRow.current?.scrollIntoView({ block: "nearest" });
  }, [pcAt]);
  return (
    <div
      className="flex h-full flex-col"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="px-2 py-1 text-sm font-semibold">{title}:</div>
      <div className="flex-1 overflow-auto">
        <table className="w-full max-w-xl border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-200 text-left dark:bg-slate-700">
            <tr>
              <th className="w-6" aria-label="Program counter" />
              <th className="w-32 px-2 py-1 font-semibold">Location</th>
              <th className="px-2 py-1 font-semibold">Contents</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: words }, (_, a) => {
              const inInstr = a >= pcAt && a < pcAt + 3;
              return (
                <tr key={a} ref={a === pcAt ? pcRow : undefined} className={`border-b border-slate-200 dark:border-slate-700 ${inInstr ? "bg-amber-100 dark:bg-amber-900/40" : "odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/50"}`}>
                  <td className="pl-1.5 text-center">{a === pcAt && <PcArrow />}</td>
                  <td className="px-2 py-0.5 font-mono">{a.toString(16).padStart(8, "0")}</td>
                  <td className="px-1 py-0.5">
                    <EditableValue
                      text={formatValue(s.readMemory(path, a), radix)}
                      width={16}
                      radix={radix}
                      editable={s.initialized}
                      changed={changed.has(a)}
                      onCommit={(v) => s.depositMemory(path, a, v)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {menu && <RadixMenu at={menu} radix={radix} onRadix={onRadix} onClose={() => setMenu(null)} />}
    </div>
  );
}
