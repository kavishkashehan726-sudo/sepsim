/**
 * Reader for the golden traces recorded from the original model
 * (format written by tools/vm-trace-kit/kit/trace_all.do, see tools/trace-analysis/sepstrace.py).
 * The traces live in the private repo linked at tests/golden; tests skip when it is absent.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const GOLDEN = resolve(__dirname, "../../../tests/golden");

export interface TraceRow {
  t: number;
  values: Map<string, string>;
}

export interface Trace {
  program: string;
  machine: string;
  rows: TraceRow[];
}

export function readTrace(path: string): Trace {
  const names = new Map<number, string>();
  const rows: TraceRow[] = [];
  let cur = new Map<string, string>();
  let t: number | null = null;
  let program = "";
  let machine = "";
  for (const line of readFileSync(path, "latin1").split(/\r?\n/)) {
    const sp = line.indexOf(" ");
    const kind = sp < 0 ? line : line.slice(0, sp);
    const rest = sp < 0 ? "" : line.slice(sp + 1);
    if (kind === "signal") {
      const s2 = rest.indexOf(" ");
      names.set(Number(rest.slice(0, s2)), rest.slice(s2 + 1));
    } else if (kind === "t") {
      if (t !== null) rows.push({ t, values: new Map(cur) });
      t = Number(rest);
    } else if (kind === "v") {
      const s2 = rest.indexOf(" ");
      const name = names.get(Number(rest.slice(0, s2)));
      if (name !== undefined) cur.set(name, rest.slice(s2 + 1));
    } else if (kind === "program") program = rest;
    else if (kind === "machine") machine = rest;
  }
  if (t !== null) rows.push({ t, values: new Map(cur) });
  return { program, machine, rows };
}

/** Split an examined array value ("{0101..} {..}") into its elements, as examine lists them. */
export const arrayWords = (value: string): string[] => value.replace(/[{}]/g, " ").split(/\s+/).filter(Boolean);

export interface GoldenCase {
  name: string;
  machine: string;
  clocks: number;
  dir: string;
  mem: string;
  trace: string;
}

/** Every recorded program with its input .mem, from each round's inputs/manifest.txt. */
export function goldenCases(arch: string): GoldenCase[] {
  const base = join(GOLDEN, arch);
  if (!existsSync(base)) return [];
  const cases: GoldenCase[] = [];
  for (const round of readdirSync(base).sort()) {
    const dir = join(base, round);
    const manifest = join(dir, "inputs", "manifest.txt");
    if (!existsSync(manifest)) continue;
    for (const line of readFileSync(manifest, "latin1").split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l.startsWith("#")) continue;
      const [name, machine, clocks] = l.split(/\s+/);
      if (!name || !machine || !clocks) continue;
      cases.push({
        name, machine, clocks: Number(clocks), dir,
        mem: join(dir, "inputs", `${name}.mem`),
        trace: join(dir, `${name}.trace`),
      });
    }
  }
  return cases;
}
