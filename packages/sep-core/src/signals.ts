/**
 * Every signal of the SEP model the simulator can show, under the same names the original
 * VHDL model (and so the old SEPSim signal lists) uses, for example "/processor/sig_pc_out".
 * Values come from a {@link Machine}. Registers and memories can also be changed by the user
 * (ModelSim's "force -deposit"); the new value is used from the next clock edge on.
 */
import { type Bits, known, resize, unknown } from "./logic.js";
import { type CuOutputName, Machine, RAM_WORDS, REGISTER_BANK_WORDS } from "./machine.js";

export type SignalKind = "bits" | "state";

export interface Signal {
  /** Full VHDL path. */
  path: string;
  width: number;
  /** "state" signals are the control unit's state names, not numbers. */
  kind: SignalKind;
  read(m: Machine): Bits | string;
  /** Present when the user may change the value. */
  write?(m: Machine, value: Bits): void;
}

export interface Memory {
  path: string;
  words: number;
  width: number;
  read(m: Machine, address: number): Bits;
  write(m: Machine, address: number, value: Bits): void;
}

const P = "/processor/";
const signals: Signal[] = [];

function bits(path: string, width: number, read: (m: Machine) => Bits, write?: (m: Machine, v: Bits) => void): void {
  signals.push(write ? { path: P + path, width, kind: "bits", read, write } : { path: P + path, width, kind: "bits", read });
}
const constant = (path: string, value: Bits) => bits(path, value.w, () => value);
const clk = (m: Machine) => known(1, m.clk);

/** Bits hi..lo of the 48-bit instruction register. */
function irSlice(m: Machine, hi: number, lo: number): Bits {
  let v = 0;
  let u = 0;
  let k: Bits["k"] = "X";
  for (let bit = hi; bit >= lo; bit--) {
    const word = m.ir[2 - (bit >> 4)]!;
    const b = 1 << (bit & 15);
    v = v * 2 + (word.v & b ? 1 : 0);
    u = u * 2 + (word.u & b ? 1 : 0);
    if (word.u & b) k = word.k;
  }
  return { w: hi - lo + 1, v, u, k };
}

const reg = (name: "pc" | "mar" | "mdr" | "sr") => (m: Machine, v: Bits) => {
  const r = m[name];
  const w = r.op.w;
  r.op = resize(v, w);
  r.inset = resize(v, w);
  m.evaluate();
};
const setAcc = (m: Machine, v: Bits) => {
  m.storage[0] = resize(v, 16);
  m.evaluate();
};

// Clock, reset and architecture.
bits("clk", 1, clk);
constant("rst", unknown(1, "U"));
bits("machine", 3, () => known(3, 0b101));

// Top-level datapath nets.
bits("sig_alu_1", 19, (m) => m.nets.alu1);
bits("sig_alu_2", 19, (m) => m.nets.alu2);
bits("sig_alu_out", 19, (m) => m.nets.aluOut);
bits("sig_mux5_mar", 19, (m) => m.nets.mux5);
bits("sig_mar_out", 19, (m) => m.mar.op, reg("mar"));
bits("sig_mux4_pc", 19, (m) => m.nets.mux4);
bits("sig_ir_op1", 19, (m) => m.nets.irOp1);
bits("sig_ir_op2", 19, (m) => m.nets.irOp2);
bits("sig_mux9_out", 19, (m) => m.nets.mux9);
bits("sig_pc_out", 19, (m) => m.pc.op, reg("pc"));
bits("sig_mem_out", 16, (m) => m.nets.mem);
bits("sig_mdr_out", 16, (m) => m.mdr.op, reg("mdr"));
bits("sig_mux6_mdr", 16, (m) => m.nets.mux6);
bits("sig_mux3_out", 16, (m) => m.nets.mux3);
bits("sig_acc_stack_rb_out", 16, (m) => m.cacheOut);
bits("sig_sr_in", 5, (m) => m.nets.srIn);
bits("sig_sr_out", 5, (m) => m.sr.op, reg("sr"));
bits("sig_ir_opcodes", 8, (m) => irSlice(m, 47, 40));
// The unused instruction bits 0 and 20 show U until the instruction register fills them.
const asU = (b: Bits): Bits => (b.u ? { ...b, k: "U" } : b);
bits("sig_ir_not_used1", 1, (m) => asU(irSlice(m, 0, 0)));
bits("sig_ir_not_used2", 1, (m) => asU(irSlice(m, 20, 20)));
// mux 7 (operand 1 register input) has an undefined select and passes the register bank output.
bits("sig_mux7_out", 16, (m) => m.cacheOut);
// Stack and register-bank paths are not used by the Accumulator architecture.
for (const name of ["sig_stack_out", "sig_rb_out", "sig_acc_out", "sig_op1_out", "sig_acc_stack_rb_out2"]) {
  constant(name, unknown(16));
}
constant("sig_mux8_out", unknown(5, "Z"));
constant("archi", unknown(3));

// Control signals, as seen at the top level and inside the control unit.
const CU_TOP: [string, CuOutputName][] = [
  ["sig_cu_alu", "alu_opcode"], ["sig_alu_rst", "alu_rst"], ["sig_cu_mdr", "mdr"], ["sig_cu_aluop1", "op1"],
  ["sig_ce", "ce_sram"], ["sig_we", "we_sram"], ["sig_oe", "oe_sram"], ["sig_cu_buff", "buf_s3"],
  ["sig_cu_sr", "sr"], ["sig_cu_ir", "ir"], ["sig_cu_mar", "mar"], ["sig_cu_pc", "pc"], ["sig_cu_mux9", "mux_9"],
  ["sig_cu_acc", "acc"], ["sig_cu_mux1", "mux_1"], ["sig_cu_mux2", "mux_2"], ["sig_cu_mux3", "mux_3"],
  ["sig_cu_mux4", "mux_4"], ["sig_cu_mux5", "mux_5"], ["sig_cu_mux6", "mux_6"],
];
for (const [name, out] of CU_TOP) bits(name, 0, (m) => m.out[out]);
constant("sig_cu_mux7", unknown(1, "U"));
constant("sig_cu_mux8", unknown(3));
constant("sig_cu_stack", known(3, 0));
constant("sig_cu_op2", unknown(1, "U"));
constant("sig_we_rb", known(1, 0));
constant("sig_ce_rb", unknown(1, "U"));

signals.push(
  { path: `${P}control_unit/cu_state`, width: 0, kind: "state", read: (m) => m.state },
  { path: `${P}control_unit/next_cu_state`, width: 0, kind: "state", read: (m) => m.nextState },
);
bits("control_unit/clk", 1, clk);
bits("control_unit/opcode", 8, (m) => irSlice(m, 47, 40));
bits("control_unit/status", 5, (m) => m.sr.op);
for (const out of Object.values(CU_TOP).map(([, o]) => o)) bits(`control_unit/${out}`, 0, (m) => m.out[out]);
constant("control_unit/stack", known(3, 0));
constant("control_unit/rb_ce", unknown(1, "U"));
constant("control_unit/rb_we", known(1, 0));
constant("control_unit/mux_7", unknown(1, "U"));
constant("control_unit/mux_8", unknown(3));

// Registers: clk, enable, input, master latch and output.
const REGS: [string, "pc" | "mar" | "mdr" | "sr", CuOutputName, (m: Machine) => Bits][] = [
  ["program_counter_reg", "pc", "pc", (m) => m.nets.mux4],
  ["memory_address_reg", "mar", "mar", (m) => m.nets.mux5],
  ["memory_data_reg", "mdr", "mdr", (m) => m.nets.mux6],
  ["status_reg", "sr", "sr", (m) => m.nets.srIn],
];
for (const [inst, name, enable, input] of REGS) {
  const w = name === "sr" ? 5 : name === "mdr" ? 16 : 19;
  bits(`${inst}/clk`, 1, clk);
  bits(`${inst}/enbl`, 1, (m) => m.out[enable]);
  bits(`${inst}/ip`, w, input);
  bits(`${inst}/op`, w, (m) => m[name].op, reg(name));
  bits(`${inst}/inset`, w, (m) => m[name].inset);
  constant(`${inst}/outset`, unknown(w));
}
bits("instruction_reg/clk", 1, clk);
bits("instruction_reg/enbl", 1, (m) => m.out.ir);
bits("instruction_reg/ip", 16, (m) => m.mdr.op);
bits("instruction_reg/op", 48, (m) => irSlice(m, 47, 0), (m, v) => {
  const word = (shift: number) => known(16, Math.floor(v.v / 2 ** shift) % 0x10000);
  m.ir = [word(32), word(16), word(0)];
  m.evaluate();
});

// Memory and the register bank ports.
bits("as_ram/data", 16, (m) => m.nets.mem);
bits("as_ram/addr", 19, (m) => m.mar.op);
bits("as_ram/ce", 1, (m) => m.out.ce_sram);
bits("as_ram/we", 1, (m) => m.out.we_sram);
bits("as_ram/oe", 1, (m) => m.out.oe_sram);
bits("buff_mem_in/enbl", 1, (m) => m.out.buf_s3);
bits("buff_mem_in/ip", 16, (m) => m.mdr.op);
bits("buff_mem_in/op", 16, (m) => m.nets.mem);
bits("cache/clk", 1, clk);
bits("cache/machine_type", 3, () => known(3, 0b101));
bits("cache/ip", 16, (m) => m.nets.mux3);
bits("cache/op", 16, (m) => m.cacheOut);
bits("cache/acc_we", 1, (m) => m.out.acc);
bits("{/processor/cache/storage[0]}".slice(P.length), 16, (m) => m.storage[0]!, setAcc);
bits("{/processor/instruction_reg/op[47:43]}".slice(P.length), 5, (m) => irSlice(m, 47, 43));
bits("{/processor/instruction_reg/op[42:40]}".slice(P.length), 3, (m) => irSlice(m, 42, 40));
bits("{/processor/instruction_reg/op[39:21]}".slice(P.length), 19, (m) => irSlice(m, 39, 21));
bits("{/processor/instruction_reg/op[19:1]}".slice(P.length), 19, (m) => irSlice(m, 19, 1));

// Signals whose width comes from what they read.
for (const s of signals) if (s.width === 0 && s.kind === "bits") s.width = (s.read(new Machine()) as Bits).w;

export const SIGNALS: readonly Signal[] = signals;
export const SIGNAL_BY_PATH: ReadonlyMap<string, Signal> = new Map(signals.map((s) => [s.path, s]));

export const MEMORIES: readonly Memory[] = [
  {
    path: `${P}as_ram/asram`, words: RAM_WORDS, width: 16,
    read: (m, a) => known(16, m.ram[a] ?? 0),
    write: (m, a, v) => {
      if (a >= 0 && a < RAM_WORDS) m.ram[a] = v.v & 0xffff;
      m.evaluate();
    },
  },
  {
    path: `${P}cache/storage`, words: REGISTER_BANK_WORDS, width: 16,
    read: (m, a) => m.storage[a] ?? unknown(16),
    write: (m, a, v) => {
      if (a >= 0 && a < REGISTER_BANK_WORDS) m.storage[a] = resize(v, 16);
      m.evaluate();
    },
  },
];
