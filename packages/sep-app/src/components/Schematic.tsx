import { type Bits, toBinary, toHex } from "@sepsim/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Diagram, DiagramElement } from "../sim/diagram";
import { useSession } from "../sim/useSession";

interface Hover {
  x: number;
  y: number;
  lines: string[];
}

/**
 * The animated simulation view. Entities whose contents changed in the last step turn red;
 * control lines are blue and turn green when they change. Hover to see a value in binary
 * (a memory shows up to 10 locations that changed). Ctrl + mouse wheel or the buttons zoom; Fit shows the whole diagram.
 */
export function Schematic({ diagram }: { diagram: Diagram }) {
  const s = useSession();
  /** null = fit the diagram to the pane. */
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pane, setPane] = useState({ w: 0, h: 0 });
  const paneRef = useRef<HTMLDivElement>(null);
  const bounds = useMemo(() => {
    const xs = diagram.elements.flatMap((e) => e.points.map((p) => p[0]));
    const ys = diagram.elements.flatMap((e) => e.points.map((p) => p[1]));
    return { w: Math.max(100, ...xs) + 30, h: Math.max(100, ...ys) + 30 };
  }, [diagram]);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPane({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = pane.w ? Math.max(0.3, Math.min(pane.w / bounds.w, pane.h / bounds.h)) : 1;
  const zoom = userZoom ?? fit;
  const setZoom = (f: (z: number) => number) => setUserZoom(Math.min(4, Math.max(0.3, f(zoom))));

  const valueOf = (e: DiagramElement): Bits | string | null => (e.signal ? s.read(e.signal) : null);
  const changed = (e: DiagramElement) => {
    if (!e.signal) return false;
    if (e.kind === "memory") return s.changedAddresses(e.signal).length > 0;
    return s.didChange(e.signal);
  };
  const describe = (e: DiagramElement): string[] => {
    if (!s.initialized) return [e.name, "<uninitialized>"];
    if (e.kind === "memory" && e.signal) {
      const addrs = s.changedAddresses(e.signal).slice(0, 10);
      if (!addrs.length) return [e.name, "no locations changed in the last step"];
      return [e.name, ...addrs.map((a) => `${a.toString(16).padStart(4, "0")}: ${toBinary(s.readMemory(e.signal!, a)!)}`)];
    }
    const v = valueOf(e);
    if (v === null) return [e.name];
    return [e.name || e.signal || "", typeof v === "string" ? v : toBinary(v)];
  };
  const onHover = (e: DiagramElement) => (ev: React.MouseEvent) => setHover({ x: ev.clientX, y: ev.clientY, lines: describe(e) });

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-0.5 text-xs dark:border-slate-700">
        <span className="font-semibold">Schematic: {diagram.name}</span>
        <span className="text-slate-500">red = changed in the last step, green = control line changed</span>
        <div className="flex-1" />
        <button className={`rounded px-2 hover:bg-slate-200 dark:hover:bg-slate-700 ${userZoom === null ? "font-semibold" : ""}`} onClick={() => setUserZoom(null)}>Fit</button>
        <button className="rounded px-2 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => setZoom((z) => z / 1.2)} aria-label="Zoom out">−</button>
        <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className="rounded px-2 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => setZoom((z) => z * 1.2)} aria-label="Zoom in">+</button>
      </div>
      <div
        ref={paneRef}
        className="min-h-0 flex-1 overflow-auto bg-white dark:bg-slate-950"
        onWheel={(e) => {
          if (!e.ctrlKey) return;
          e.preventDefault();
          setZoom((z) => z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        }}
      >
        <svg width={bounds.w * zoom} height={bounds.h * zoom} viewBox={`0 0 ${bounds.w} ${bounds.h}`} className="select-none" onMouseLeave={() => setHover(null)}>
          {diagram.elements.filter((e) => e.kind === "bus" || e.kind === "control").map((e, i) => {
            const c = changed(e);
            const stroke = e.kind === "control" ? (c ? "#16a34a" : "#2563eb") : c ? "#dc2626" : "currentColor";
            return (
              <g key={`l${i}`} className="text-slate-700 dark:text-slate-300" onMouseMove={onHover(e)}>
                <polyline points={e.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="transparent" strokeWidth={10} />
                <polyline points={e.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={stroke} strokeWidth={(e.width ?? 1) + (c ? 1 : 0)} strokeLinejoin="round" />
              </g>
            );
          })}
          {diagram.elements.filter((e) => e.kind !== "bus" && e.kind !== "control").map((e, i) => (
            <Block key={`b${i}`} e={e} changed={changed(e)} value={valueOf(e)} onHover={onHover(e)} />
          ))}
        </svg>
      </div>
      {hover && (
        <div className="pointer-events-none fixed z-50 max-w-md rounded border border-slate-300 bg-amber-50 px-2 py-1 font-mono text-xs shadow dark:border-slate-600 dark:bg-slate-800" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          {hover.lines.map((l, i) => <div key={i} className={i === 0 ? "font-sans font-semibold" : ""}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

function Block({ e, changed, value, onHover }: { e: DiagramElement; changed: boolean; value: Bits | string | null; onHover: (ev: React.MouseEvent) => void }) {
  const [[x1, y1] = [0, 0], [x2, y2] = [0, 0]] = e.points;
  const w = x2 - x1;
  const h = y2 - y1;
  const stroke = changed ? "#dc2626" : "currentColor";
  const fill = changed ? "rgba(220,38,38,0.12)" : e.kind === "register" ? "rgba(59,130,246,0.10)" : "rgba(148,163,184,0.10)";
  let shape;
  if (e.kind === "alu") {
    const n = h * 0.2;
    shape = <polygon points={`${x1},${y1} ${x2},${y1 + n} ${x2},${y2 - n} ${x1},${y2} ${x1},${y1 + h * 0.6} ${x1 + w * 0.25},${y1 + h / 2} ${x1},${y1 + h * 0.4}`} fill={fill} stroke={stroke} strokeWidth={changed ? 2.5 : 1.5} />;
  } else if (e.kind === "mux") {
    const n = w * 0.15;
    shape = <polygon points={`${x1},${y1} ${x2},${y1} ${x2 - n},${y2} ${x1 + n},${y2}`} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  } else {
    shape = <rect x={x1} y={y1} width={w} height={h} rx={e.kind === "memory" ? 2 : 4} fill={fill} stroke={stroke} strokeWidth={changed ? 2.5 : 1.5} />;
  }
  const short = typeof value === "string" ? value : value ? `0x${toHex(value)}` : "";
  const big = e.kind !== "mux";
  return (
    <g className="text-slate-800 dark:text-slate-200" onMouseMove={onHover}>
      {shape}
      <text x={x1 + w / 2} y={y1 + (big ? 18 : h / 2 + 4)} textAnchor="middle" fontSize={big ? 12 : 10} fill="currentColor" className="font-sans">
        {wrap(e.name, w).map((line, i) => <tspan key={i} x={x1 + w / 2} dy={i ? 13 : 0}>{line}</tspan>)}
      </text>
      {big && short && e.kind !== "memory" && (
        <text x={x1 + w / 2} y={y2 - 10} textAnchor="middle" fontSize={11} fill={changed ? "#dc2626" : "currentColor"} className="font-mono">{short}</text>
      )}
    </g>
  );
}

/** Break a label into lines that fit a box about `w` pixels wide. */
function wrap(text: string, w: number): string[] {
  const max = Math.max(6, Math.floor(w / 7));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
