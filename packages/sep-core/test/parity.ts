/**
 * Replays a recorded program through the new engine and compares it with the trace of
 * the original model, signal by signal, at every half clock.
 */
import { readFileSync } from "node:fs";
import { type Bits, toBinary } from "../src/logic.js";
import { Machine, RAM_WORDS } from "../src/machine.js";
import { MEMORIES, SIGNALS } from "../src/signals.js";
import { parseMem } from "../src/memfile.js";
import { arrayWords, type GoldenCase, readTrace, type TraceRow } from "./trace.js";

const P = "/processor/";

type Probe = (m: Machine) => string;
const show = (v: Bits | string) => (typeof v === "string" ? v : toBinary(v));

/** Trace signal → how to read the same value from the engine: every signal the app can show. */
export const PROBES: Record<string, Probe> = Object.fromEntries(
  SIGNALS.map((s) => [s.path.slice(P.length), (m: Machine) => show(s.read(m))]),
);
const ram = MEMORIES.find((x) => x.path === `${P}as_ram/asram`)!;
PROBES["as_ram/asram"] = (m) => Array.from({ length: ram.words }, (_, a) => toBinary(ram.read(m, a))).reverse().join(" ");
PROBES["cache/storage"] = (m) => toBinary(m.storage[0]!);

/** Reduce a recorded value to what the engine models. */
function expected(signal: string, value: string): string {
  if (signal === "cache/storage") return arrayWords(value).at(-1) ?? "";
  if (signal === "as_ram/asram") return arrayWords(value).join(" ");
  return value;
}

export interface Mismatch {
  t: number;
  signal: string;
  got: string;
  want: string;
}

export interface Result {
  rows: number;
  /** First mismatch for each signal. */
  mismatches: Mismatch[];
  halt: { got: number | null; want: number | null };
}

/**
 * When the original model hits a fatal error the simulator stops, but the recorder keeps
 * examining: the clock stops toggling. Returns the time of the last real sample, if so.
 */
function haltTime(rows: TraceRow[]): number | null {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.values.get(P + "clk") === rows[i - 1]!.values.get(P + "clk")) return rows[i - 1]!.t;
  }
  return null;
}

export function replay(c: GoldenCase, signals = Object.keys(PROBES)): Result {
  const trace = readTrace(c.trace);
  const m = new Machine(parseMem(readFileSync(c.mem, "latin1"), RAM_WORDS));
  const wantHalt = haltTime(trace.rows);
  const first = new Map<string, Mismatch>();
  let rows = 0;
  for (const { t, values } of trace.rows) {
    if (wantHalt !== null && t > wantHalt) break;
    while (m.timeNs < t && m.halfStep());
    if (m.timeNs < t) break;
    rows++;
    for (const signal of signals) {
      if (first.has(signal)) continue;
      const raw = values.get(P + signal);
      if (raw === undefined) continue;
      const want = expected(signal, raw);
      const got = PROBES[signal]!(m);
      if (got !== want) first.set(signal, { t, signal, got, want });
    }
  }
  if (wantHalt === null) while (m.timeNs < c.clocks * 50 && m.halfStep());
  return {
    rows,
    mismatches: [...first.values()].sort((a, b) => a.t - b.t),
    halt: { got: m.halted?.timeNs ?? null, want: wantHalt },
  };
}
