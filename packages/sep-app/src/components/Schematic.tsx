import { type Bits, MEMORIES, SIGNALS, toBinary, toHex } from "@sepsim/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Diagram, type DiagramElement, type ElementKind, KIND_LABELS } from "../sim/diagram";
import { useSession } from "../sim/useSession";

interface Hover {
  x: number;
  y: number;
  lines: string[];
}

type Point = [number, number];
type Tool = "select" | "bus" | "box";

const isLine = (k: ElementKind) => k === "bus" || k === "control";
const LINE_KINDS: ElementKind[] = ["bus", "control"];
const BOX_KINDS: ElementKind[] = ["register", "memory", "control-unit", "alu", "mux"];
const GRID = 5;
/** Room to draw in when editing, even if the diagram is small or empty. */
const EDIT_AREA = { w: 1300, h: 700 };

export interface SchematicEditing {
  onChange: (d: Diagram) => void;
  onDone: () => void;
}

/**
 * The animated simulation view. Entities whose contents changed in the last step turn red;
 * control lines are blue and turn green when they change. Hover to see a value in binary
 * (a memory shows up to 10 locations that changed). Ctrl + mouse wheel or the buttons zoom; Fit shows the whole diagram.
 *
 * With `editing` the diagram can be drawn on, like the old SEPSim's diagram editor: click the
 * points of a bus and right-click to end it, or click two corners of a box. A dialog then asks
 * for the name, type and signal. Select mode moves (drag), edits (double-click) and deletes elements.
 */
export function Schematic({ diagram, editing }: { diagram: Diagram; editing?: SchematicEditing | undefined }) {
  const s = useSession();
  /** null = fit the diagram to the pane. */
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pane, setPane] = useState({ w: 0, h: 0 });
  const paneRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [drawing, setDrawing] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ index: number; from: Point; to: Point } | null>(null);
  const [dialog, setDialog] = useState<{ element: DiagramElement; index: number | null } | null>(null);
  const [undo, setUndo] = useState<Diagram[]>([]);
  /** Set when an element is grabbed, so the click that follows does not clear the selection. */
  const grabbed = useRef(false);

  const bounds = useMemo(() => {
    const xs = diagram.elements.flatMap((e) => e.points.map((p) => p[0]));
    const ys = diagram.elements.flatMap((e) => e.points.map((p) => p[1]));
    const w = Math.max(100, ...xs) + 30;
    const h = Math.max(100, ...ys) + 30;
    return editing ? { w: Math.max(w, EDIT_AREA.w), h: Math.max(h, EDIT_AREA.h) } : { w, h };
  }, [diagram, editing]);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPane({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = pane.w ? Math.max(0.3, Math.min(pane.w / bounds.w, pane.h / bounds.h)) : 1;
  const zoom = userZoom ?? fit;
  /** The drawn area: when editing, it fills the pane so there is room to draw anywhere. */
  const area = editing && pane.w ? { w: Math.max(bounds.w, pane.w / zoom), h: Math.max(bounds.h, pane.h / zoom) } : bounds;
  const setZoom = (f: (z: number) => number) => setUserZoom(Math.min(4, Math.max(0.3, f(zoom))));

  const change = (d: Diagram) => {
    if (!editing) return;
    setUndo((u) => [...u.slice(-49), diagram]);
    editing.onChange(d);
  };
  const remove = (i: number) => {
    change({ ...diagram, elements: diagram.elements.filter((_, j) => j !== i) });
    setSelected(null);
  };
  const cancelDrawing = () => {
    setDrawing([]);
    setCursor(null);
  };

  useEffect(() => {
    if (!editing) {
      cancelDrawing();
      setSelected(null);
      setDialog(null);
      return;
    }
    const key = (e: KeyboardEvent) => {
      if (dialog || (e.target as HTMLElement).closest("input, select, textarea")) return;
      if (e.key === "Escape") cancelDrawing();
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) remove(selected);
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && undo.length) {
        e.preventDefault();
        editing.onChange(undo[undo.length - 1]!);
        setUndo(undo.slice(0, -1));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  /** Where the pointer is on the diagram, snapped to the grid. */
  const at = (ev: React.MouseEvent): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    const snap = (v: number) => Math.max(0, Math.round(v / zoom / GRID) * GRID);
    return [snap(ev.clientX - r.left), snap(ev.clientY - r.top)];
  };

  const finish = (points: Point[]) => {
    cancelDrawing();
    if (tool === "bus") {
      if (points.length < 2) return;
      setDialog({ element: { kind: "bus", name: "", points, width: 4 }, index: null });
    } else {
      const [[ax, ay], [bx, by]] = points as [Point, Point];
      if (ax === bx || ay === by) return;
      const box: Point[] = [[Math.min(ax, bx), Math.min(ay, by)], [Math.max(ax, bx), Math.max(ay, by)]];
      setDialog({ element: { kind: "register", name: "", points: box }, index: null });
    }
  };

  const onCanvasClick = (ev: React.MouseEvent) => {
    if (!editing) return;
    if (tool === "select") {
      if (!grabbed.current) setSelected(null);
      grabbed.current = false;
      return;
    }
    const p = at(ev);
    if (tool === "box" && drawing.length === 1) return finish([drawing[0]!, p]);
    setDrawing([...drawing, p]);
  };
  const onCanvasRightClick = (ev: React.MouseEvent) => {
    if (!editing) return;
    ev.preventDefault();
    if (!drawing.length) return;
    const p = at(ev);
    const last = drawing[drawing.length - 1]!;
    finish(tool === "box" ? [drawing[0]!, p] : last[0] === p[0] && last[1] === p[1] ? drawing : [...drawing, p]);
  };

  const valueOf = (e: DiagramElement): Bits | string | null => (e.signal ? s.read(e.signal) : null);
  const changed = (e: DiagramElement) => {
    if (!e.signal || editing) return false;
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
  const onHover = (e: DiagramElement) => (ev: React.MouseEvent) =>
    editing ? setHover({ x: ev.clientX, y: ev.clientY, lines: [e.name || "(no name)", e.signal || "(no signal)", KIND_LABELS[e.kind]] }) : setHover({ x: ev.clientX, y: ev.clientY, lines: describe(e) });

  /** Pointer handlers for one element in select mode: click selects, drag moves, double-click edits. */
  const grab = (i: number) =>
    editing && tool === "select"
      ? {
          onPointerDown: (ev: React.PointerEvent) => {
            ev.stopPropagation();
            grabbed.current = true;
            setSelected(i);
            const p = at(ev);
            setDrag({ index: i, from: p, to: p });
            svgRef.current?.setPointerCapture(ev.pointerId);
          },
          onDoubleClick: (ev: React.MouseEvent) => {
            ev.stopPropagation();
            setDialog({ element: diagram.elements[i]!, index: i });
          },
          onClick: (ev: React.MouseEvent) => ev.stopPropagation(),
          style: { cursor: "move" },
        }
      : {};
  const offset = (i: number) => (drag?.index === i ? `translate(${drag.to[0] - drag.from[0]},${drag.to[1] - drag.from[1]})` : undefined);

  const indexed = diagram.elements.map((e, i) => ({ e, i }));
  const btn = (active: boolean) => `rounded px-2 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700 ${active ? "bg-sky-100 font-semibold dark:bg-sky-900" : ""}`;
  const preview = cursor && drawing.length ? (tool === "bus" ? [...drawing, cursor] : null) : null;
  const boxPreview = tool === "box" && drawing.length === 1 && cursor ? [drawing[0]!, cursor] : null;

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-0.5 text-xs dark:border-slate-700">
        <span className="font-semibold">Schematic: {diagram.name}</span>
        {editing ? (
          <>
            <span className="rounded bg-amber-200 px-1.5 text-amber-900">Editing</span>
            <button className={btn(tool === "select")} onClick={() => { setTool("select"); cancelDrawing(); }}>Select</button>
            <button className={btn(tool === "bus")} onClick={() => { setTool("bus"); cancelDrawing(); setSelected(null); }}>Draw bus</button>
            <button className={btn(tool === "box")} onClick={() => { setTool("box"); cancelDrawing(); setSelected(null); }}>Draw box</button>
            <button className={btn(false)} disabled={selected === null} onClick={() => selected !== null && setDialog({ element: diagram.elements[selected]!, index: selected })}>Properties…</button>
            <button className={btn(false)} disabled={selected === null} onClick={() => selected !== null && remove(selected)}>Delete</button>
            <button className={btn(false)} disabled={!undo.length} onClick={() => { editing.onChange(undo[undo.length - 1]!); setUndo(undo.slice(0, -1)); setSelected(null); }}>Undo</button>
            <span className="text-slate-500">
              {tool === "bus" ? "Click each point, right-click to end the bus." : tool === "box" ? "Click the top-left corner, then the bottom-right." : "Drag to move, double-click to edit, Delete to remove."}
            </span>
          </>
        ) : (
          <span className="text-slate-500">red = changed in the last step, green = control line changed</span>
        )}
        <div className="flex-1" />
        {editing && <button className="rounded bg-sky-600 px-2 text-white hover:bg-sky-700" onClick={editing.onDone}>Done</button>}
        <button className={btn(userZoom === null)} onClick={() => setUserZoom(null)}>Fit</button>
        <button className={btn(false)} onClick={() => setZoom((z) => z / 1.2)} aria-label="Zoom out">−</button>
        <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className={btn(false)} onClick={() => setZoom((z) => z * 1.2)} aria-label="Zoom in">+</button>
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
        <svg
          ref={svgRef}
          width={area.w * zoom}
          height={area.h * zoom}
          viewBox={`0 0 ${area.w} ${area.h}`}
          className={`block select-none ${editing && tool !== "select" ? "cursor-crosshair" : ""}`}
          aria-label={editing ? "Diagram editor" : "Schematic"}
          onMouseLeave={() => { setHover(null); setCursor(null); }}
          onClick={onCanvasClick}
          onContextMenu={onCanvasRightClick}
          onPointerMove={(ev) => {
            if (!editing) return;
            if (drag) setDrag({ ...drag, to: at(ev) });
            else if (tool !== "select") setCursor(at(ev));
          }}
          onPointerUp={() => {
            if (!drag) return;
            const [dx, dy] = [drag.to[0] - drag.from[0], drag.to[1] - drag.from[1]];
            setDrag(null);
            if (!dx && !dy) return;
            change({
              ...diagram,
              elements: diagram.elements.map((e, j) => (j === drag.index ? { ...e, points: e.points.map(([x, y]) => [x + dx, y + dy] as Point) } : e)),
            });
          }}
        >
          {editing && (
            <>
              <defs>
                <pattern id="grid" width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID * 4} 0 L 0 0 0 ${GRID * 4}`} fill="none" stroke="currentColor" strokeWidth={0.3} />
                </pattern>
              </defs>
              <rect width={area.w} height={area.h} fill="url(#grid)" className="text-slate-300 dark:text-slate-700" />
            </>
          )}
          {indexed.filter(({ e }) => isLine(e.kind)).map(({ e, i }) => {
            const c = changed(e);
            const stroke = e.kind === "control" ? (c ? "#16a34a" : "#2563eb") : c ? "#dc2626" : "currentColor";
            const pts = e.points.map((p) => p.join(",")).join(" ");
            return (
              <g key={`l${i}`} className="text-slate-700 dark:text-slate-300" onMouseMove={onHover(e)} transform={offset(i)} {...grab(i)}>
                <polyline points={pts} fill="none" stroke="transparent" strokeWidth={10} />
                {selected === i && <polyline points={pts} fill="none" stroke="#0ea5e9" strokeOpacity={0.5} strokeWidth={(e.width ?? 1) + 6} strokeLinejoin="round" />}
                <polyline points={pts} fill="none" stroke={stroke} strokeWidth={(e.width ?? 1) + (c ? 1 : 0)} strokeLinejoin="round" />
              </g>
            );
          })}
          {indexed.filter(({ e }) => !isLine(e.kind)).map(({ e, i }) => (
            <g key={`b${i}`} transform={offset(i)} {...grab(i)}>
              <Block e={e} changed={changed(e)} value={editing ? null : valueOf(e)} onHover={onHover(e)} />
              {selected === i && e.points.length >= 2 && (
                <rect x={e.points[0]![0] - 3} y={e.points[0]![1] - 3} width={e.points[1]![0] - e.points[0]![0] + 6} height={e.points[1]![1] - e.points[0]![1] + 6} fill="none" stroke="#0ea5e9" strokeDasharray="4 3" strokeWidth={1.5} />
              )}
            </g>
          ))}
          {preview && <polyline points={preview.map((p) => p.join(",")).join(" ")} fill="none" stroke="#0ea5e9" strokeWidth={3} strokeDasharray="6 4" pointerEvents="none" />}
          {boxPreview && (
            <rect
              x={Math.min(boxPreview[0]![0], boxPreview[1]![0])} y={Math.min(boxPreview[0]![1], boxPreview[1]![1])}
              width={Math.abs(boxPreview[1]![0] - boxPreview[0]![0])} height={Math.abs(boxPreview[1]![1] - boxPreview[0]![1])}
              fill="rgba(14,165,233,0.08)" stroke="#0ea5e9" strokeDasharray="6 4" pointerEvents="none"
            />
          )}
          {drawing.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="#0ea5e9" pointerEvents="none" />)}
        </svg>
      </div>
      {hover && !drag && (
        <div className="pointer-events-none fixed z-50 max-w-md rounded border border-slate-300 bg-amber-50 px-2 py-1 font-mono text-xs shadow dark:border-slate-600 dark:bg-slate-800" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          {hover.lines.map((l, i) => <div key={i} className={i === 0 ? "font-sans font-semibold" : ""}>{l}</div>)}
        </div>
      )}
      {dialog && (
        <ElementDialog
          element={dialog.element}
          isNew={dialog.index === null}
          onCancel={() => setDialog(null)}
          onOk={(el) => {
            const elements = dialog.index === null ? [...diagram.elements, el] : diagram.elements.map((x, j) => (j === dialog.index ? el : x));
            change({ ...diagram, elements });
            setSelected(dialog.index ?? elements.length - 1);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

const field = "rounded border border-slate-300 bg-white px-2 py-0.5 dark:border-slate-600 dark:bg-slate-900";

/** Name, type, signal and bus width of a diagram element (asked after drawing it). */
function ElementDialog({ element, isNew, onOk, onCancel }: { element: DiagramElement; isNew: boolean; onOk: (e: DiagramElement) => void; onCancel: () => void }) {
  const [e, setE] = useState(element);
  const kinds = isLine(element.kind) ? LINE_KINDS : BOX_KINDS;
  const ok = () => {
    const out: DiagramElement = { kind: e.kind, name: e.name.trim(), points: e.points };
    if (e.signal?.trim()) out.signal = e.signal.trim();
    if (isLine(e.kind)) out.width = Math.max(1, e.width ?? 1);
    onOk(out);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-label="Diagram element">
      <form
        className="w-[26rem] rounded-lg border border-slate-300 bg-white p-4 text-sm shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onSubmit={(ev) => { ev.preventDefault(); ok(); }}
        onKeyDown={(ev) => ev.key === "Escape" && onCancel()}
      >
        <h2 className="mb-3 font-semibold">{isNew ? "New element" : "Element properties"}</h2>
        <label className="mb-2 grid grid-cols-[6rem_1fr] items-center gap-2">
          Name <input autoFocus className={field} value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} />
        </label>
        <label className="mb-2 grid grid-cols-[6rem_1fr] items-center gap-2">
          Type
          <select className={field} value={e.kind} onChange={(ev) => setE({ ...e, kind: ev.target.value as ElementKind })}>
            {kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="mb-2 grid grid-cols-[6rem_1fr] items-center gap-2">
          Signal
          <input className={`${field} font-mono text-xs`} list="element-signals" placeholder="none: drawn but not animated" value={e.signal ?? ""} onChange={(ev) => setE({ ...e, signal: ev.target.value })} />
        </label>
        <datalist id="element-signals">
          {SIGNALS.map((s) => <option key={s.path} value={s.path} />)}
          {MEMORIES.map((m) => <option key={m.path} value={m.path} />)}
        </datalist>
        {isLine(e.kind) && (
          <label className="mb-2 grid grid-cols-[6rem_1fr] items-center gap-2">
            Line width <input type="number" min={1} max={12} className={`${field} w-20`} value={e.width ?? 1} onChange={(ev) => setE({ ...e, width: Number(ev.target.value) || 1 })} />
          </label>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-700">OK</button>
          <button type="button" className="rounded border border-slate-300 px-3 py-1 dark:border-slate-600" onClick={onCancel}>Cancel</button>
        </div>
      </form>
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
