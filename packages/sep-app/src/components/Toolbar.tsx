import type { ReactNode } from "react";
import { STEP_MODES, type StepMode } from "../sim/session";
import { useSession } from "../sim/useSession";

const Icon = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const ICONS = {
  init: <Icon d="M12 2v10M6.3 6.3a8 8 0 1 0 11.4 0" />,
  end: <Icon d="M6 6h12v12H6z" fill />,
  restart: <Icon d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />,
  load: <Icon d="M3 7h6l2 2h10v10H3zM12 12v5M9.5 14.5 12 12l2.5 2.5" />,
  editor: <Icon d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  step: <Icon d="M5 5v14l9-7zM17 5v14" />,
  stop: <Icon d="M7 7h10v10H7z" />,
};

function ToolButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-slate-700"
    >
      {children}
    </button>
  );
}

export function Toolbar({ onLoad, onEditor }: { onLoad: () => void; onEditor: () => void }) {
  const s = useSession();
  const m = s.machine;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-300 bg-slate-50 px-1 py-0.5 text-sm dark:border-slate-700 dark:bg-slate-800/60">
      <ToolButton title="Initialize" onClick={() => s.initialize()}>{ICONS.init}</ToolButton>
      <ToolButton title="End simulation" onClick={() => s.end()} disabled={!m}>{ICONS.end}</ToolButton>
      <ToolButton title="Restart the current program" onClick={() => s.restart()} disabled={!m}>{ICONS.restart}</ToolButton>
      <ToolButton title="Load program (.mem)" onClick={onLoad}>{ICONS.load}</ToolButton>
      <ToolButton title="Program Editor" onClick={onEditor}>{ICONS.editor}</ToolButton>
      <div className="mx-1 h-5 border-l border-slate-300 dark:border-slate-600" />
      <ToolButton title={s.running ? "Stop slow motion" : "Single step (F10)"} onClick={() => s.singleStep()} disabled={!m}>
        {s.running ? ICONS.stop : ICONS.step}
        <span>{s.running ? "Stop" : "Step"}</span>
      </ToolButton>
      <select
        aria-label="Simulation mode"
        className="rounded border border-slate-300 bg-white px-1 py-0.5 dark:border-slate-600 dark:bg-slate-700"
        value={s.mode}
        onChange={(e) => s.setMode(e.target.value as StepMode)}
      >
        {STEP_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select aria-label="Architecture" className="rounded border border-slate-300 bg-white px-1 py-0.5 dark:border-slate-600 dark:bg-slate-700" value="acc" onChange={() => {}}>
        <option value="acc">Accumulator</option>
        <option disabled>Stack (later version)</option>
        <option disabled>Ext. Accumulator (later version)</option>
        <option disabled>Register Memory (later version)</option>
        <option disabled>Load Store (later version)</option>
        <option disabled>Memory to Memory (later version)</option>
      </select>
      <div className="flex-1" />
      <span className="px-2 tabular-nums text-slate-600 dark:text-slate-300">
        Clocks: <b>{m ? m.clocks : "-"}</b>
        <span className="ml-3">State: <b className="font-mono">{m ? m.state : "-"}</b></span>
        {m?.halted && <span className="ml-3 font-semibold text-red-600">stopped</span>}
      </span>
    </div>
  );
}
