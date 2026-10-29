import { CATEGORY_LABELS, type Category, DEFAULT_MEMORIES } from "../sim/entities";

export type Selection = { category: Exclude<Category, "memories"> } | { category: "memories"; memory: string };

const icon: Record<Category, string> = { registers: "▤", memories: "▦", buses: "═", custom: "●" };

export function CategoryTree({ selected, onSelect }: { selected: Selection; onSelect: (s: Selection) => void }) {
  const item = (label: string, active: boolean, onClick: () => void, glyph: string, indent: number) => (
    <button
      key={label}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded py-1 pr-2 text-left text-sm ${active ? "bg-sky-600 text-white" : "hover:bg-slate-200 dark:hover:bg-slate-700"}`}
      style={{ paddingLeft: 8 + indent * 16 }}
    >
      <span className="w-4 text-center opacity-80">{glyph}</span>
      {label}
    </button>
  );
  return (
    <nav className="h-full overflow-auto p-1" aria-label="Processor entities">
      <div className="flex items-center gap-2 px-2 py-1 text-sm font-semibold">
        <span>⚙</span> Processor (SEP)
      </div>
      {item(CATEGORY_LABELS.registers, selected.category === "registers", () => onSelect({ category: "registers" }), icon.registers, 1)}
      <div className="flex items-center gap-2 py-1 text-sm" style={{ paddingLeft: 24 }}>
        <span className="w-4 text-center opacity-80">{icon.memories}</span>
        {CATEGORY_LABELS.memories}
      </div>
      {DEFAULT_MEMORIES.map((m) =>
        item(m.label, selected.category === "memories" && selected.memory === m.path, () => onSelect({ category: "memories", memory: m.path }), "·", 2),
      )}
      {item(CATEGORY_LABELS.buses, selected.category === "buses", () => onSelect({ category: "buses" }), icon.buses, 1)}
      {item(CATEGORY_LABELS.custom, selected.category === "custom", () => onSelect({ category: "custom" }), icon.custom, 1)}
    </nav>
  );
}
