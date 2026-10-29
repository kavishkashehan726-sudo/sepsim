import { SIGNAL_BY_PATH } from "@sepsim/core";
import { useState } from "react";
import type { Entity } from "../sim/entities";
import { RADIX_NAMES, type Radix, formatValue } from "../sim/format";
import { useSession } from "../sim/useSession";
import { EditableValue } from "./EditableValue";
import { ContextMenu } from "./Menu";

export function RadixMenu({ at, radix, onRadix, onClose }: { at: { x: number; y: number }; radix: Radix; onRadix: (r: Radix) => void; onClose: () => void }) {
  return (
    <ContextMenu
      x={at.x}
      y={at.y}
      onClose={onClose}
      items={([2, 10, 16] as Radix[]).map((r) => ({ label: `${RADIX_NAMES[r]} (${r})`, checked: r === radix, onClick: () => onRadix(r) }))}
    />
  );
}

/** Name / value list for Registers, Buses and Custom. Right-click to change the radix. */
export function ValueTable({ entities, radix, onRadix }: { entities: Entity[]; radix: Radix; onRadix: (r: Radix) => void }) {
  const s = useSession();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  return (
    <div
      className="h-full overflow-auto"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-slate-200 text-left dark:bg-slate-700">
          <tr>
            <th className="w-1/3 px-2 py-1 font-semibold">Name</th>
            <th className="px-2 py-1 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => {
            const v = s.read(e.path);
            const sig = SIGNAL_BY_PATH.get(e.path);
            return (
              <tr key={e.path} className="border-b border-slate-200 odd:bg-white even:bg-slate-50 dark:border-slate-700 dark:odd:bg-slate-900 dark:even:bg-slate-800/50">
                <td className="px-2 py-0.5" title={e.path}>{e.label}</td>
                <td className="px-1 py-0.5">
                  <EditableValue
                    text={formatValue(v, radix)}
                    width={sig?.width ?? 16}
                    radix={radix}
                    editable={s.canWrite(e.path)}
                    changed={s.didChange(e.path)}
                    onCommit={(bits) => s.deposit(e.path, bits)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {menu && <RadixMenu at={menu} radix={radix} onRadix={onRadix} onClose={() => setMenu(null)} />}
    </div>
  );
}
