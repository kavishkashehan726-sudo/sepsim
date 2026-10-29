/**
 * The SEP control unit for the Accumulator architecture, read off the recorded traces
 * (tools/trace-analysis/cu_matrix.py and cu_changes.py).
 *
 * On each rising clock edge the control unit moves to its next state and assigns some
 * of its outputs. Outputs a state does not assign keep their old value, exactly like
 * the original VHDL (that is why, for example, the ALU keeps computing with the last
 * instruction's operation during the first fetch states).
 */
import { ALU } from "./alu.js";

export type CuState =
  | "init" | "ifetch1" | "ifetch2" | "ifetch3" | "ifetch4" | "ifetch5" | "ifetch6" | "ifetch7"
  | "ifetch8" | "idecode" | "execution_accumulator" | "op2_direct2acc" | "op2_indirect2acc"
  | "op2_indirect3acc" | "op2_indirect4acc" | "load2_direct_acc" | "load3_direct_acc"
  | "mdr_to_mem1_acc" | "mdr_to_mem2_acc" | "store2_indirect_acc" | "store3_indirect_acc"
  | "call2" | "call3" | "ret2" | "ret3" | "looz2" | "looz3" | "looz4" | "looz5";

/** Control outputs, named as in the VHDL control unit. Undefined = never assigned yet. */
export interface CuOutputs {
  alu_opcode?: number;
  alu_rst?: number;
  we_sram?: number;
  oe_sram?: number;
  ce_sram?: number;
  pc?: number;
  mar?: number;
  mdr?: number;
  buf_s3?: number;
  sr?: number;
  op1?: number;
  ir?: number;
  acc?: number;
  mux_1?: number;
  mux_2?: number;
  mux_3?: number;
  mux_4?: number;
  mux_5?: number;
  mux_6?: number;
  mux_9?: number;
}

export const OP = {
  jc: 0b00001, jof: 0b00010, js: 0b00011, jp: 0b00100, jz: 0b00101, storeacc: 0b00110,
  looz: 0b01000, call: 0b01010, ret: 0b01011, nop: 0b01110, jump: 0b01111,
  add: 0b10000, sub: 0b10001, and: 0b10010, or: 0b10011, xor: 0b10100, inc: 0b10101,
  not: 0b10110, shl: 0b10111, shr: 0b11000, rol: 0b11001, ror: 0b11010, mul: 0b11011,
  div: 0b11100, loadacc: 0b11111,
} as const;

export const MODE = { immediate: 0b000, direct: 0b100, indirect: 0b101 } as const;

/** Status register bits (P S O C Z). */
const SR = { P: 16, S: 8, O: 4, C: 2, Z: 1 };

/** ALU operation for each two-operand data instruction. */
const BINARY: Record<number, number> = {
  [OP.add]: ALU.add, [OP.sub]: ALU.sub, [OP.and]: ALU.and, [OP.or]: ALU.or,
  [OP.xor]: ALU.xor, [OP.mul]: ALU.mul, [OP.div]: ALU.div,
};
const UNARY: Record<number, number> = {
  [OP.inc]: ALU.inc, [OP.not]: ALU.not, [OP.shl]: ALU.shl, [OP.shr]: ALU.shr,
  [OP.rol]: ALU.rol, [OP.ror]: ALU.ror,
};
const BRANCH: Record<number, number> = {
  [OP.jc]: SR.C, [OP.jof]: SR.O, [OP.js]: SR.S, [OP.jp]: SR.P, [OP.jz]: SR.Z,
};

// Output sets shared by several states.
const IDLE = { we_sram: 1, pc: 0, mar: 0, mdr: 0, buf_s3: 0, sr: 0, ir: 0, acc: 0 };
const INC_MAR = { alu_opcode: ALU.incAdr, mux_1: 0b010, mux_2: 0b001 };
const FETCH_READ = { ...IDLE, ...INC_MAR, oe_sram: 0, mar: 1, mdr: 1, ir: 1, mux_5: 0b010, mux_6: 0b001 };
const FETCH_WAIT = { ...IDLE, ...INC_MAR, oe_sram: 0, mux_5: 0b010, mux_6: 0b001 };
/** Reading memory into MDR in a multi-cycle instruction. */
const READ = { ...IDLE, ...INC_MAR, oe_sram: 0, mdr: 1, mux_4: 0b011, mux_9: 1 };

export interface Step {
  state: CuState;
  set: CuOutputs;
}

/**
 * Outputs assigned on entering `state`, and the state after it.
 * @param op instruction bits 47..43, mode bits 42..40 (null while the IR is unknown)
 * @param sr status register value (P S O C Z)
 */
export function enter(state: CuState, op: number | null, mode: number | null, sr: number): CuOutputs {
  switch (state) {
    case "init":
      return { ...IDLE, alu_rst: 1, oe_sram: 1, ce_sram: 0, op1: 0, sr: 1 };
    case "ifetch1":
      return { ...IDLE, alu_rst: 0, oe_sram: 1, mar: 1, mux_5: 0b001 };
    case "ifetch2":
      return { ...IDLE, oe_sram: 0, mux_5: 0b001 };
    case "ifetch3":
    case "ifetch5":
      return FETCH_READ;
    case "ifetch4":
    case "ifetch6":
      return FETCH_WAIT;
    case "ifetch7":
      return { ...FETCH_READ, pc: 1, mar: 0, mux_4: 0b011 };
    case "ifetch8":
      return { ...FETCH_WAIT, oe_sram: 1, mux_4: 0b011 };
    case "idecode":
      return decode(op, mode, sr);
    case "op2_direct2acc":
    case "op2_indirect2acc":
    case "load2_direct_acc":
    case "store2_indirect_acc":
      return { ...READ, mux_5: 0b011, mux_6: 0b001 };
    case "op2_indirect3acc":
      return { ...IDLE, ...INC_MAR, oe_sram: 0, mar: 1, mux_4: 0b011, mux_5: 0b100, mux_6: 0b001, mux_9: 1 };
    case "op2_indirect4acc":
      return { ...READ, mux_5: 0b100, mux_6: 0b001 };
    case "execution_accumulator":
      return {
        ...IDLE, oe_sram: 1, sr: 1, acc: 1, alu_opcode: BINARY[op ?? -1] ?? ALU.incAdr,
        mux_1: 0b110, mux_2: 0b101, mux_3: 0b01, mux_4: 0b011, mux_6: 0b001, mux_9: 1,
      };
    case "load3_direct_acc":
      return { ...IDLE, ...INC_MAR, oe_sram: 1, acc: 1, mux_3: 0b11, mux_4: 0b011, mux_5: 0b011, mux_6: 0b001, mux_9: 1 };
    case "mdr_to_mem1_acc":
      return { ...IDLE, ...INC_MAR, we_sram: 0, oe_sram: 1, buf_s3: 1, mux_4: 0b011, mux_6: 0b101, mux_9: 1 };
    case "mdr_to_mem2_acc":
      return { ...IDLE, ...INC_MAR, oe_sram: 1, buf_s3: 1, mux_4: 0b011, mux_6: 0b101, mux_9: 1 };
    case "store3_indirect_acc":
      return { ...IDLE, ...INC_MAR, oe_sram: 1, mar: 1, mdr: 1, buf_s3: 1, mux_4: 0b011, mux_5: 0b100, mux_6: 0b101, mux_9: 1 };
    case "call2":
      return { ...IDLE, ...INC_MAR, we_sram: 0, oe_sram: 1, buf_s3: 1, mux_4: 0b010, mux_5: 0b101, mux_6: 0b011, mux_9: 1 };
    case "call3":
      return { ...IDLE, ...INC_MAR, oe_sram: 1, buf_s3: 1, mux_4: 0b010, mux_5: 0b101, mux_6: 0b011, mux_9: 1 };
    case "ret2":
      return { ...READ, mux_5: 0b101, mux_6: 0b001 };
    case "ret3":
      return { ...IDLE, ...INC_MAR, oe_sram: 1, pc: 1, mux_4: 0b001, mux_5: 0b101, mux_6: 0b001, mux_9: 1 };
    case "looz2":
      return { ...READ, mux_5: 0b110, mux_6: 0b001 };
    case "looz3":
      return {
        ...IDLE, alu_opcode: ALU.decAdr, oe_sram: 1, mdr: 1, buf_s3: 1, sr: 1,
        mux_1: 0b010, mux_2: 0b011, mux_4: 0b011, mux_5: 0b110, mux_6: 0b010, mux_9: 1,
      };
    case "looz4":
      return loozTaken(sr)
        ? { ...IDLE, oe_sram: 1, alu_opcode: ALU.addAdr, we_sram: 0, pc: 1, buf_s3: 1, mux_1: 0b011, mux_2: 0b010 }
        : { ...IDLE, oe_sram: 1, alu_opcode: ALU.decAdr, mux_1: 0b010, mux_2: 0b011 };
    case "looz5":
      return { ...IDLE, alu_opcode: ALU.addAdr, oe_sram: 1, buf_s3: 1, mux_1: 0b011, mux_2: 0b010, mux_4: 0b011, mux_5: 0b110, mux_6: 0b010, mux_9: 1 };
  }
}

/** looz loops while the decremented counter is above 0 (signed). */
const loozTaken = (sr: number): boolean => (sr & (SR.S | SR.Z)) === 0;

const DECODE_BASE = { ...IDLE, ...INC_MAR, oe_sram: 1, mux_4: 0b011, mux_5: 0b010, mux_6: 0b001 };

function decode(op: number | null, mode: number | null, sr: number): CuOutputs {
  const o = op ?? -1;
  const branch = BRANCH[o];
  if (branch !== undefined || o === OP.jump) {
    const taken = o === OP.jump || (sr & (branch ?? 0)) !== 0;
    return taken ? { ...DECODE_BASE, alu_opcode: ALU.addAdr, pc: 1, mux_1: 0b011, mux_2: 0b010, mux_9: 1 } : DECODE_BASE;
  }
  const binary = BINARY[o];
  if (binary !== undefined) {
    if (mode === MODE.immediate) return { ...DECODE_BASE, alu_opcode: binary, sr: 1, acc: 1, mux_1: 0b100, mux_2: 0b101, mux_3: 0b01, mux_9: 1 };
    if (mode === MODE.direct || mode === MODE.indirect) return { ...DECODE_BASE, oe_sram: 0, mar: 1, mux_5: 0b011, mux_9: 1 };
    return DECODE_BASE;
  }
  const unary = UNARY[o];
  if (unary !== undefined) {
    // Only immediate mode (what a bare "inc" assembles to after an immediate) has been traced.
    // mux 9 is left as it was.
    return { ...DECODE_BASE, alu_opcode: unary, sr: 1, acc: 1, mux_1: 0b010, mux_2: 0b101, mux_3: 0b01 };
  }
  switch (o) {
    case OP.loadacc:
      if (mode === MODE.immediate) return { ...DECODE_BASE, acc: 1, mux_3: 0b10, mux_9: 1 };
      if (mode === MODE.direct) return { ...DECODE_BASE, oe_sram: 0, mar: 1, mux_5: 0b011, mux_9: 1 };
      return DECODE_BASE;
    case OP.storeacc:
      if (mode === MODE.direct) return { ...DECODE_BASE, mar: 1, mdr: 1, buf_s3: 1, mux_5: 0b011, mux_6: 0b101, mux_9: 1 };
      if (mode === MODE.indirect) return { ...DECODE_BASE, oe_sram: 0, mar: 1, mux_5: 0b011, mux_9: 1 };
      return DECODE_BASE;
    case OP.looz:
      return { ...DECODE_BASE, mar: 1, mux_5: 0b110, mux_9: 1 };
    case OP.call:
      return { ...DECODE_BASE, pc: 1, mar: 1, mdr: 1, buf_s3: 1, mux_4: 0b010, mux_5: 0b101, mux_6: 0b011, mux_9: 1 };
    case OP.ret:
      return { ...DECODE_BASE, mar: 1, mux_5: 0b101, mux_9: 1 };
    default:
      return DECODE_BASE;
  }
}

/** The state after `state`, given the instruction and status register in force during it. */
export function next(state: CuState, op: number | null, mode: number | null, sr: number): CuState {
  switch (state) {
    case "init": return "ifetch1";
    case "ifetch1": return "ifetch2";
    case "ifetch2": return "ifetch3";
    case "ifetch3": return "ifetch4";
    case "ifetch4": return "ifetch5";
    case "ifetch5": return "ifetch6";
    case "ifetch6": return "ifetch7";
    case "ifetch7": return "ifetch8";
    case "ifetch8": return "idecode";
    case "idecode": return decodeNext(op, mode);
    case "op2_direct2acc": return "execution_accumulator";
    case "op2_indirect2acc": return "op2_indirect3acc";
    case "op2_indirect3acc": return "op2_indirect4acc";
    case "op2_indirect4acc": return "execution_accumulator";
    case "load2_direct_acc": return "load3_direct_acc";
    case "store2_indirect_acc": return "store3_indirect_acc";
    case "store3_indirect_acc": return "mdr_to_mem1_acc";
    case "mdr_to_mem1_acc": return "mdr_to_mem2_acc";
    case "call2": return "call3";
    case "ret2": return "ret3";
    case "looz2": return "looz3";
    case "looz3": return "looz4";
    case "looz4": return loozTaken(sr) ? "looz5" : "ifetch1";
    case "execution_accumulator":
    case "load3_direct_acc":
    case "mdr_to_mem2_acc":
    case "call3":
    case "ret3":
    case "looz5":
      return "ifetch1";
  }
}

function decodeNext(op: number | null, mode: number | null): CuState {
  const o = op ?? -1;
  if (BINARY[o] !== undefined) {
    if (mode === MODE.immediate) return "ifetch1";
    if (mode === MODE.direct) return "op2_direct2acc";
    if (mode === MODE.indirect) return "op2_indirect2acc";
    return "idecode"; // $, ! and @ are not implemented: the model stays in idecode for ever
  }
  switch (o) {
    case OP.loadacc: return mode === MODE.direct ? "load2_direct_acc" : "ifetch1";
    case OP.storeacc:
      return mode === MODE.direct ? "mdr_to_mem1_acc" : mode === MODE.indirect ? "store2_indirect_acc" : "ifetch1";
    case OP.looz: return "looz2";
    case OP.call: return "call2";
    case OP.ret: return "ret2";
    case OP.nop: return mode === MODE.immediate ? "idecode" : "ifetch1";
    default: return "ifetch1";
  }
}
