/**
 * Replays a recorded program through the new engine and compares it with the trace of
 * the original model, signal by signal, at every half clock.
 */
import { readFileSync } from "node:fs";
import { type Bits, toBinary } from "../src/logic.js";
import { Machine, RAM_WORDS } from "../src/machine.js";
import { parseMem } from "../src/memfile.js";
import { arrayWords, type GoldenCase, readTrace, type TraceRow } from "./trace.js";

const P = "/processor/";

type Probe = (m: Machine) => string;
const b = (f: (m: Machine) => Bits): Probe => (m) => toBinary(f(m));

/** Trace signal → how to read the same value from the engine. */
export const PROBES: Record<string, Probe> = {
  "control_unit/cu_state": (m) => m.state,
  "control_unit/next_cu_state": (m) => m.nextState,
  sig_pc_out: b((m) => m.pc.op),
  sig_mar_out: b((m) => m.mar.op),
  sig_mdr_out: b((m) => m.mdr.op),
  sig_sr_out: b((m) => m.sr.op),
  "instruction_reg/op": (m) => m.ir.map(toBinary).join(""),
  sig_mem_out: b((m) => m.nets.mem),
  sig_alu_1: b((m) => m.nets.alu1),
  sig_alu_2: b((m) => m.nets.alu2),
  sig_alu_out: b((m) => m.nets.aluOut),
  sig_sr_in: b((m) => m.nets.srIn),
  sig_ir_op1: b((m) => m.nets.irOp1),
  sig_ir_op2: b((m) => m.nets.irOp2),
  sig_mux9_out: b((m) => m.nets.mux9),
  sig_mux3_out: b((m) => m.nets.mux3),
  sig_mux4_pc: b((m) => m.nets.mux4),
  sig_mux5_mar: b((m) => m.nets.mux5),
  sig_mux6_mdr: b((m) => m.nets.mux6),
  sig_acc_stack_rb_out: b((m) => m.cacheOut),
  "cache/storage": (m) => toBinary(m.storage[0]!),
  "as_ram/asram": (m) => Array.from(m.ram).map((w) => w.toString(2).padStart(16, "0")).reverse().join(" "),
  "program_counter_reg/inset": b((m) => m.pc.inset),
  "memory_address_reg/inset": b((m) => m.mar.inset),
  "memory_data_reg/inset": b((m) => m.mdr.inset),
  "status_reg/inset": b((m) => m.sr.inset),
};
for (const name of ["alu_opcode", "alu_rst", "we_sram", "oe_sram", "ce_sram", "pc", "mar", "mdr", "buf_s3",
  "sr", "op1", "ir", "acc", "mux_1", "mux_2", "mux_3", "mux_4", "mux_5", "mux_6", "mux_9"] as const) {
  PROBES[`control_unit/${name}`] = b((m) => m.out[name]);
}

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
