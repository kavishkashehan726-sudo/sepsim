import { MEMORIES, SIGNALS } from "@sepsim/core";
import { useMemo, useState } from "react";
import { openFile, saveFile } from "../platform";
import { type Diagram, type DiagramElement, type ElementKind, KIND_LABELS } from "../sim/diagram";
import { diagramStore } from "../sim/diagramStore";
import { CATEGORY_LABELS } from "../sim/entities";
import { DEFAULT_SETTINGS, type ListCategory, type Settings, reviveSettings, settings } from "../sim/settings";
import { useStore } from "../sim/store";

type Tab = "signals" | "control" | "isa" | "animation";
const TABS: { id: Tab; label: string }[] = [
  { id: "signals", label: "Signal List" },
  { id: "control", label: "Control" },
  { id: "isa", label: "Instruction Set" },
  { id: "animation", label: "Animation" },
];

const input = "rounded border border-slate-300 bg-white px-2 py-0.5 dark:border-slate-600 dark:bg-slate-900";
const btn = "rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600";

/** Edit > Settings: the old SEPSim's advanced settings, adapted to the built-in engine. */
export function SettingsDialog({ onClose, onEditDiagram }: { onClose: () => void; onEditDiagram: () => void }) {
  const saved = useStore(settings);
  const savedDiagram = useStore(diagramStore);
  const [draft, setDraft] = useState<Settings>(saved);
  const [diagram, setDiagram] = useState<Diagram>(savedDiagram);
  const [tab, setTab] = useState<Tab>("signals");
  const apply = () => {
    settings.set(draft);
    diagramStore.set(diagram);
  };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Settings">
      <div className="flex h-full max-h-[44rem] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-slate-50 text-sm shadow-2xl dark:border-slate-600 dark:bg-slate-800">
        <div className="flex items-center gap-1 border-b border-slate-300 px-3 pt-2 dark:border-slate-600">
          <span className="mr-4 pb-2 font-semibold">Settings</span>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-t px-3 py-1.5 ${tab === t.id ? "border border-b-0 border-slate-300 bg-white font-semibold dark:border-slate-600 dark:bg-slate-900" : "hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-white p-3 dark:bg-slate-900">
          {tab === "signals" && <SignalListTab draft={draft} setDraft={setDraft} />}
          {tab === "control" && <ControlTab draft={draft} setDraft={setDraft} />}
          {tab === "isa" && <IsaTab draft={draft} setDraft={setDraft} />}
          {tab === "animation" && <AnimationTab diagram={diagram} setDiagram={setDiagram} onEdit={() => { apply(); onClose(); onEditDiagram(); }} />}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-300 px-3 py-2 dark:border-slate-600">
          <button className={btn} onClick={() => setDraft(DEFAULT_SETTINGS)}>Restore defaults</button>
          <button className={btn} onClick={() => saveFile("sepsim-settings.json", JSON.stringify(draft, null, 2), "SEPSim settings")}>Export…</button>
          <button
            className={btn}
            onClick={async () => {
              const f = await openFile(".json");
              if (!f) return;
              try {
                const s = reviveSettings(JSON.parse(await f.text()));
                if (s) setDraft(s);
                else alert(`${f.name} is not a SEPSim settings file.`);
              } catch {
                alert(`${f.name} is not a SEPSim settings file.`);
              }
            }}
          >
            Import…
          </button>
          <div className="flex-1" />
          <button className={`${btn} !border-sky-600 !bg-sky-600 text-white`} onClick={() => { apply(); onClose(); }}>OK</button>
          <button className={btn} onClick={onClose}>Cancel</button>
          <button className={btn} onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  );
}

type TabProps = { draft: Settings; setDraft: (s: Settings) => void };

function SignalListTab({ draft, setDraft }: TabProps) {
  const [cat, setCat] = useState<ListCategory>("registers");
  const [filter, setFilter] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const list = draft.entities[cat];
  const setList = (l: typeof list) => setDraft({ ...draft, entities: { ...draft.entities, [cat]: l } });
  const shown = useMemo(() => SIGNALS.filter((s) => s.path.toLowerCase().includes(filter.toLowerCase())), [filter]);
  const add = (path: string) => {
    if (list.some((e) => e.path === path)) return;
    const label = path.replace(/[{}]/g, "").split("/").pop() ?? path;
    setList([...list, { label, path }]);
  };
  const move = (i: number, d: number) => {
    const l = [...list];
    const [x] = l.splice(i, 1);
    l.splice(i + d, 0, x!);
    setList(l);
  };
  return (
    <div className="grid h-full grid-cols-2 gap-4">
      <section className="flex min-h-0 flex-col">
        <h3 className="mb-1 font-semibold">Available signals ({SIGNALS.length})</h3>
        <input className={`${input} mb-1`} placeholder="Filter, for example mux or reg" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter signals" />
        <div className="min-h-0 flex-1 overflow-auto rounded border border-slate-200 font-mono text-xs dark:border-slate-700">
          {shown.map((s) => (
            <div
              key={s.path}
              onClick={() => setPick(s.path)}
              onDoubleClick={() => add(s.path)}
              className={`flex cursor-pointer justify-between px-2 py-0.5 ${pick === s.path ? "bg-sky-600 text-white" : "hover:bg-sky-50 dark:hover:bg-sky-950"}`}
            >
              <span>{s.path}</span>
              <span className="opacity-60">{s.kind === "state" ? "state" : `${s.width} bit`}</span>
            </div>
          ))}
        </div>
        <h3 className="mb-1 mt-3 font-semibold">Memories</h3>
        <p className="mb-1 text-xs text-slate-500">Memories are always available under Memories; they are not added to a list.</p>
        <table className="w-full font-mono text-xs">
          <tbody>
            {MEMORIES.map((m) => (
              <tr key={m.path}><td className="pr-3">{m.path}</td><td>{m.words} words × {m.width} bits</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="flex min-h-0 flex-col">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="font-semibold">Shown in</h3>
          <select className={input} value={cat} onChange={(e) => setCat(e.target.value as ListCategory)} aria-label="Category">
            {(["registers", "buses", "custom"] as const).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <button className={btn} disabled={!pick} onClick={() => pick && add(pick)}>Add selected</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded border border-slate-200 dark:border-slate-700">
          {list.map((e, i) => (
            <div key={e.path} className="flex items-center gap-1 border-b border-slate-100 px-1 py-0.5 dark:border-slate-800">
              <input className={`${input} w-56`} value={e.label} aria-label="Name shown" onChange={(ev) => setList(list.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} />
              <span className="flex-1 truncate font-mono text-xs text-slate-500" title={e.path}>{e.path}</span>
              <button className="px-1" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button className="px-1" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button className="px-1 text-red-600" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Double-click a signal on the left to add it. Names can be changed here.</p>
      </section>
    </div>
  );
}

function Field({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <label className="grid grid-cols-[14rem_1fr] items-center gap-2 py-1">
      <span>{label}</span>
      <span>
        {children}
        {note && <span className="ml-2 text-xs text-slate-500">{note}</span>}
      </span>
    </label>
  );
}

function ControlTab({ draft, setDraft }: TabProps) {
  const half = draft.periodNs / 2;
  return (
    <div className="max-w-3xl">
      <h3 className="mb-1 font-semibold">System clock</h3>
      <Field label="Clock signal"><code>/processor/clk</code></Field>
      <Field label="Period (ns)" note="Only changes the times shown; SEP is clocked, so results are the same.">
        <input type="number" min={1} className={`${input} w-28`} value={draft.periodNs} onChange={(e) => setDraft({ ...draft, periodNs: Math.max(1, Number(e.target.value) || 50) })} />
      </Field>
      <Field label="Duty cycle (%)">
        <input type="number" min={1} max={99} className={`${input} w-28`} value={draft.dutyCycle} onChange={(e) => setDraft({ ...draft, dutyCycle: Math.min(99, Math.max(1, Number(e.target.value) || 50)) })} />
      </Field>
      <h3 className="mb-1 mt-4 font-semibold">Simulation</h3>
      <Field label="Step unit (RTL mode)" note="In IL modes a step always runs one instruction.">
        <select className={input} value={draft.stepHalfClocks} onChange={(e) => setDraft({ ...draft, stepHalfClocks: Number(e.target.value) })}>
          {[1, 2, 4, 6, 10, 20].map((n) => <option key={n} value={n}>{n * half} ns ({n === 1 ? "half a clock" : `${n / 2} clock${n === 2 ? "" : "s"}`})</option>)}
        </select>
      </Field>
      <h3 className="mb-1 mt-4 font-semibold">Miscellaneous</h3>
      <Field label="Program counter"><code>/processor/sig_pc_out</code></Field>
      <Field label="Instruction terminator"><code>/processor/control_unit/cu_state</code> back to <code>ifetch1</code></Field>
      <Field label="Program memory"><code>/processor/as_ram/asram</code></Field>
      <Field label="Architecture">Accumulator</Field>
    </div>
  );
}

function IsaTab({ draft, setDraft }: TabProps) {
  const ok5 = (b: string) => /^[01]{5}$/.test(b);
  const ok3 = (b: string) => /^[01]{3}$/.test(b);
  return (
    <div className="grid grid-cols-[1fr_20rem] gap-6">
      <section>
        <h3 className="mb-1 font-semibold">Opcodes</h3>
        <p className="mb-2 text-xs text-slate-500">These change how the assembler encodes programs. The processor itself does not change, so a new code only runs if SEP already implements it.</p>
        <table className="text-sm">
          <thead><tr className="text-left"><th className="pr-2">Mnemonic</th><th className="pr-2">Opcode (47:43)</th><th /></tr></thead>
          <tbody>
            {draft.opcodes.map((o, i) => (
              <tr key={i}>
                <td className="pr-2"><input className={`${input} w-32 font-mono`} value={o.mnemonic} aria-label="Mnemonic" onChange={(e) => setDraft({ ...draft, opcodes: draft.opcodes.map((x, j) => (j === i ? { ...x, mnemonic: e.target.value.trim() } : x)) })} /></td>
                <td className="pr-2"><input className={`${input} w-24 font-mono ${ok5(o.bits) ? "" : "!border-red-500"}`} value={o.bits} aria-label="Opcode bits" onChange={(e) => setDraft({ ...draft, opcodes: draft.opcodes.map((x, j) => (j === i ? { ...x, bits: e.target.value.trim() } : x)) })} /></td>
                <td><button className="px-1 text-red-600" aria-label="Remove opcode" onClick={() => setDraft({ ...draft, opcodes: draft.opcodes.filter((_, j) => j !== i) })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className={`${btn} mt-2`} onClick={() => setDraft({ ...draft, opcodes: [...draft.opcodes, { mnemonic: "", bits: "00000" }] })}>Add opcode</button>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Fixed bit fields</h3>
        <table className="mb-4 text-sm">
          <tbody>
            <tr><td className="pr-3">Opcode</td><td className="font-mono">47:43</td></tr>
            <tr><td className="pr-3">Addressing mode</td><td className="font-mono">42:40</td></tr>
            <tr><td className="pr-3">Operand (Accumulator)</td><td className="font-mono">39:21</td></tr>
            <tr><td className="pr-3">Instruction length</td><td>3 words of 16 bits</td></tr>
          </tbody>
        </table>
        <h3 className="mb-1 font-semibold">Addressing modes</h3>
        <table className="text-sm">
          <thead><tr className="text-left"><th className="pr-2">Symbol</th><th>Mode (42:40)</th></tr></thead>
          <tbody>
            {draft.modes.map((m, i) => (
              <tr key={i}>
                <td className="pr-2"><input className={`${input} w-16 font-mono`} value={m.symbol} aria-label="Mode symbol" disabled={m.symbol === "def"} onChange={(e) => setDraft({ ...draft, modes: draft.modes.map((x, j) => (j === i ? { ...x, symbol: e.target.value.trim().slice(0, 1) } : x)) })} /></td>
                <td><input className={`${input} w-20 font-mono ${ok3(m.bits) ? "" : "!border-red-500"}`} value={m.bits} aria-label="Mode bits" onChange={(e) => setDraft({ ...draft, modes: draft.modes.map((x, j) => (j === i ? { ...x, bits: e.target.value.trim() } : x)) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-slate-500"><code>def</code> is the mode used when an operand has no symbol (direct).</p>
      </section>
    </div>
  );
}

const pointsText = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
function parsePoints(t: string): [number, number][] | null {
  const pts = t.trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
  return pts.every((p) => p.length === 2 && p.every(Number.isFinite)) ? (pts as [number, number][]) : null;
}

function AnimationTab({ diagram, setDiagram, onEdit }: { diagram: Diagram; setDiagram: (d: Diagram) => void; onEdit: () => void }) {
  const update = (i: number, e: Partial<DiagramElement>) =>
    setDiagram({ ...diagram, elements: diagram.elements.map((x, j) => (j === i ? { ...x, ...e } : x)) });
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-semibold">Diagram: {diagram.name}</h3>
        <span className="text-xs text-slate-500">{diagram.elements.length} elements</span>
        <div className="flex-1" />
        <button className={btn} onClick={onEdit}>Draw on the diagram…</button>
      </div>
      <datalist id="signal-paths">{SIGNALS.map((s) => <option key={s.path} value={s.path} />)}{MEMORIES.map((m) => <option key={m.path} value={m.path} />)}</datalist>
      <table className="w-full text-xs">
        <thead><tr className="text-left"><th>Name</th><th>Type</th><th>Signal</th><th>Bus width</th><th>Points (x,y …)</th><th /></tr></thead>
        <tbody>
          {diagram.elements.map((e, i) => (
            <tr key={i}>
              <td><input className={`${input} w-40`} value={e.name} aria-label="Element name" onChange={(ev) => update(i, { name: ev.target.value })} /></td>
              <td>
                <select className={input} value={e.kind} aria-label="Element type" onChange={(ev) => update(i, { kind: ev.target.value as ElementKind })}>
                  {(Object.keys(KIND_LABELS) as ElementKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
              </td>
              <td><input className={`${input} w-64 font-mono`} list="signal-paths" value={e.signal ?? ""} aria-label="Element signal" onChange={(ev) => update(i, ev.target.value ? { signal: ev.target.value } : { signal: "" })} /></td>
              <td><input type="number" min={1} className={`${input} w-16`} disabled={e.kind !== "bus" && e.kind !== "control"} value={e.width ?? 1} aria-label="Bus width" onChange={(ev) => update(i, { width: Math.max(1, Number(ev.target.value) || 1) })} /></td>
              <td><PointsInput value={e.points} onChange={(points) => update(i, { points })} /></td>
              <td><button className="px-1 text-red-600" aria-label="Delete element" onClick={() => setDiagram({ ...diagram, elements: diagram.elements.filter((_, j) => j !== i) })}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PointsInput({ value, onChange }: { value: [number, number][]; onChange: (p: [number, number][]) => void }) {
  const [text, setText] = useState(pointsText(value));
  const valid = parsePoints(text) !== null;
  return (
    <input
      className={`${input} w-64 font-mono ${valid ? "" : "!border-red-500"}`}
      value={text}
      aria-label="Element points"
      onChange={(e) => {
        setText(e.target.value);
        const p = parsePoints(e.target.value);
        if (p) onChange(p);
      }}
    />
  );
}
