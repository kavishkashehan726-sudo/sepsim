import { parseMem, RAM_WORDS } from "@sepsim/core";
import { useCallback, useEffect, useState } from "react";
import { CategoryTree, type Selection } from "./components/CategoryTree";
import { FloatingWindow } from "./components/FloatingWindow";
import { MemoryTable } from "./components/MemoryTable";
import { type MenuDef, MenuBar } from "./components/Menu";
import { ProgramEditor } from "./components/ProgramEditor";
import { Schematic } from "./components/Schematic";
import { Toolbar } from "./components/Toolbar";
import { ValueTable } from "./components/ValueTable";
import { openFile } from "./platform";
import { ACCUMULATOR_DIAGRAM, type Diagram, parseDia } from "./sim/diagram";
import { CATEGORY_LABELS, DEFAULT_ENTITIES, DEFAULT_MEMORIES } from "./sim/entities";
import type { Radix } from "./sim/format";
import { STEP_MODES, session } from "./sim/session";
import { useSession } from "./sim/useSession";

const viewKey = (sel: Selection) => (sel.category === "memories" ? sel.memory : sel.category);
const viewTitle = (sel: Selection) =>
  sel.category === "memories" ? DEFAULT_MEMORIES.find((m) => m.path === sel.memory)?.label ?? "Memory" : CATEGORY_LABELS[sel.category];

function usePrefersDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return [dark, setDark] as const;
}

export default function App() {
  const s = useSession();
  const [selected, setSelected] = useState<Selection>({ category: "registers" });
  const [radix, setRadix] = useState<Record<string, Radix>>({});
  const [editor, setEditor] = useState(false);
  const [diagram, setDiagram] = useState<Diagram>(ACCUMULATOR_DIAGRAM);
  const [showSchematic, setShowSchematic] = useState(true);
  const [bottomTab, setBottomTab] = useState<"schematic" | "messages">("schematic");
  const [popouts, setPopouts] = useState<{ id: number; sel: Selection }[]>([]);
  const [split, setSplit] = useState(0.5);
  const [dark, setDark] = usePrefersDark();
  const [about, setAbout] = useState(false);

  const radixOf = (sel: Selection): Radix => radix[viewKey(sel)] ?? (sel.category === "memories" ? 2 : 16);
  const setRadixOf = (sel: Selection) => (r: Radix) => setRadix((x) => ({ ...x, [viewKey(sel)]: r }));

  const loadProgram = useCallback(async () => {
    const f = await openFile(".mem");
    if (!f) return;
    try {
      s.loadProgram(parseMem(await f.text(), RAM_WORDS), f.name);
    } catch (e) {
      alert(`${f.name} is not a SEPSim .mem file: ${(e as Error).message}`);
    }
  }, [s]);

  const loadDiagram = async () => {
    const f = await openFile(".dia");
    if (!f) return;
    try {
      setDiagram(parseDia(await f.bytes(), f.name));
      setShowSchematic(true);
      setBottomTab("schematic");
    } catch (e) {
      alert(`${f.name}: ${(e as Error).message}`);
    }
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (editor) return;
      if (e.key === "F10") {
        e.preventDefault();
        session.singleStep();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [editor]);

  const menus: MenuDef[] = [
    { label: "File", items: [
      { label: "New Program", onClick: () => setEditor(true) },
      { label: "Program Editor…", onClick: () => setEditor(true) },
    ] },
    { label: "Edit", items: (["Binary (2)", "Decimal (10)", "Hexadecimal (16)"] as const).map((label, i) => {
      const r = ([2, 10, 16] as Radix[])[i]!;
      return { label: `Radix: ${label}`, checked: radixOf(selected) === r, onClick: () => setRadixOf(selected)(r) };
    }) },
    { label: "Simulation", items: [
      { label: "Initialize", onClick: () => s.initialize() },
      { label: "End", onClick: () => s.end(), disabled: !s.initialized },
      { label: "Restart", onClick: () => s.restart(), disabled: !s.initialized },
      "separator",
      { label: "Load Program…", onClick: loadProgram },
      { label: "Single Step", shortcut: "F10", onClick: () => s.singleStep(), disabled: !s.initialized },
      "separator",
      ...STEP_MODES.map((m) => ({ label: m.label, checked: s.mode === m.value, onClick: () => s.setMode(m.value) })),
    ] },
    { label: "Schematic", items: [
      { label: "Load…", onClick: loadDiagram },
      { label: "Accumulator (built in)", onClick: () => setDiagram(ACCUMULATOR_DIAGRAM), checked: diagram === ACCUMULATOR_DIAGRAM },
      "separator",
      { label: "Show schematic", checked: showSchematic, onClick: () => setShowSchematic(!showSchematic) },
    ] },
    { label: "View", items: [
      { label: "Dark mode", checked: dark, onClick: () => setDark(!dark) },
      { label: "Messages", onClick: () => { setShowSchematic(true); setBottomTab("messages"); } },
    ] },
    { label: "Help", items: [{ label: "About SEPSim", onClick: () => setAbout(true) }] },
  ];

  const view = (sel: Selection) =>
    sel.category === "memories" ? (
      <MemoryTable path={sel.memory} title={viewTitle(sel)} radix={radixOf(sel)} onRadix={setRadixOf(sel)} />
    ) : (
      <ValueTable entities={DEFAULT_ENTITIES[sel.category]} radix={radixOf(sel)} onRadix={setRadixOf(sel)} />
    );

  const errors = s.log.filter((l) => l.kind !== "info").length;
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 bg-sky-700 px-3 py-1 text-sm text-white">
        <b>SEPSim</b> <span className="opacity-80">Simulator for SEP</span>
        <span className="ml-auto opacity-80">{s.programName}</span>
      </header>
      <MenuBar menus={menus} />
      <Toolbar onLoad={loadProgram} onEditor={() => setEditor(true)} />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0" style={{ flex: showSchematic ? split : 1 }}>
          <aside className="w-56 shrink-0 border-r border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
            <CategoryTree selected={selected} onSelect={setSelected} />
          </aside>
          <main
            className="min-w-0 flex-1 bg-white dark:bg-slate-900"
            onDoubleClick={() => setPopouts((p) => [...p, { id: Date.now(), sel: selected }])}
            title="Double-click to open this view in its own window"
          >
            {!s.initialized && (
              <div className="border-b border-amber-300 bg-amber-50 px-3 py-1 text-sm dark:border-amber-700 dark:bg-amber-900/30">
                The simulator is not initialized. Choose <b>Simulation &gt; Initialize</b> (or the first toolbar button) to start.
              </div>
            )}
            {view(selected)}
          </main>
        </div>
        {showSchematic && (
          <>
            <div
              className="h-1.5 cursor-row-resize bg-slate-300 hover:bg-sky-500 dark:bg-slate-700"
              role="separator"
              aria-label="Resize the schematic"
              onPointerDown={(e) => {
                const top = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                const move = (ev: PointerEvent) => setSplit(Math.min(0.85, Math.max(0.15, (ev.clientY - top.top) / top.height)));
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            />
            <section style={{ flex: 1 - split }} className="flex min-h-0 flex-col border-t border-slate-300 dark:border-slate-700">
              <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-1 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                {(["schematic", "messages"] as const).map((t) => (
                  <button key={t} onClick={() => setBottomTab(t)} className={`px-3 py-1 ${bottomTab === t ? "border-b-2 border-sky-600 font-semibold" : ""}`}>
                    {t === "schematic" ? "Schematic" : `Messages${errors ? ` (${errors})` : ""}`}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                {bottomTab === "schematic" ? <Schematic diagram={diagram} /> : <Messages />}
              </div>
            </section>
          </>
        )}
      </div>
      {popouts.map((p, i) => (
        <FloatingWindow key={p.id} title={viewTitle(p.sel)} start={{ x: 120 + i * 30, y: 120 + i * 30 }} onClose={() => setPopouts((x) => x.filter((y) => y.id !== p.id))}>
          {view(p.sel)}
        </FloatingWindow>
      ))}
      {editor && <ProgramEditor dark={dark} onClose={() => setEditor(false)} />}
      {about && <About onClose={() => setAbout(false)} />}
    </div>
  );
}

function Messages() {
  const s = useSession();
  return (
    <div className="h-full overflow-auto bg-white p-2 font-mono text-xs dark:bg-slate-950">
      {s.log.length === 0 && <span className="text-slate-400">No messages yet.</span>}
      {[...s.log].reverse().map((l, i) => (
        <div key={i} className={l.kind === "error" ? "text-red-600 dark:text-red-400" : l.kind === "warning" ? "text-amber-700 dark:text-amber-400" : ""}>
          <span className="mr-2 text-slate-400">{l.time} ns</span>{l.text}
        </div>
      ))}
    </div>
  );
}

function About({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose} role="dialog" aria-label="About SEPSim">
      <div className="max-w-md rounded-lg bg-white p-5 text-sm shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-lg font-semibold">SEPSim</h2>
        <p className="mb-2">Simulator for the Students' Experimental Processor (SEP), rebuilt as an offline desktop app.</p>
        <p className="mb-2">
          The original SEPSim (2007, S. Sampath Subasinghe, The Open University of Sri Lanka) ran the SEP VHDL model
          in ModelSim. This version simulates SEP directly and matches recordings of the original model clock by clock.
        </p>
        <p className="mb-4">This version supports the Accumulator architecture.</p>
        <button className="rounded bg-sky-600 px-3 py-1 text-white" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}
