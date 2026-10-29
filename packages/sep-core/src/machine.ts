/**
 * Clock-accurate model of the SEP processor (Accumulator architecture), built to match
 * the original VHDL model as recorded in ModelSim, half clock by half clock.
 *
 * Timing, as observed:
 *  - rising edge: registers whose write enable was on capture their input into a
 *    master latch, the instruction register shifts in MDR, then the control unit moves
 *    to its next state and drives new control signals. While the clock is high the
 *    master latches of enabled registers follow their inputs.
 *  - falling edge: enabled registers copy their master latch to their output, and the
 *    accumulator is written.
 *  - memory and every multiplexer, the ALU and the buses are combinational.
 */
import { alu } from "./alu.js";
import { type CuOutputs, type CuState, enter, next } from "./control.js";
import { type Bits, equal, isKnown, known, resize, toBinary, unknown } from "./logic.js";

export const RAM_WORDS = 151;
export const REGISTER_BANK_WORDS = 32;
export const HALF_PERIOD_NS = 25;

/** A master/slave register: `inset` is the master latch, `op` the visible output. */
interface Reg {
  inset: Bits;
  op: Bits;
}

type CuOutputName = keyof CuOutputs;

const OUTPUT_WIDTH: Record<CuOutputName, number> = {
  alu_opcode: 5, alu_rst: 1, we_sram: 1, oe_sram: 1, ce_sram: 1, pc: 1, mar: 1, mdr: 1,
  buf_s3: 1, sr: 1, op1: 1, ir: 1, acc: 1, mux_1: 3, mux_2: 3, mux_3: 2, mux_4: 3,
  mux_5: 3, mux_6: 3, mux_9: 1,
};

export interface Halt {
  reason: "memory-range";
  address: number | null;
  timeNs: number;
}

/** Values of the datapath nets after the last evaluation. */
export interface Nets {
  irOp1: Bits;
  irOp2: Bits;
  mux9: Bits;
  acc: Bits;
  mem: Bits;
  alu1: Bits;
  alu2: Bits;
  aluOut: Bits;
  srIn: Bits;
  mux3: Bits;
  mux4: Bits;
  mux5: Bits;
  mux6: Bits;
}

const X5 = unknown(5);

export class Machine {
  timeNs = 0;
  clk: 0 | 1 = 1;
  state: CuState = "init";
  nextState: CuState = "ifetch1";
  halted: Halt | null = null;

  readonly ram = new Uint16Array(RAM_WORDS);
  readonly storage: Bits[] = Array.from({ length: REGISTER_BANK_WORDS }, () => known(16, 0));
  /** Register bank output port (the accumulator in this architecture); updated on clock edges. */
  cacheOut: Bits = unknown(16);

  readonly pc: Reg = { inset: unknown(19), op: known(19, 0) };
  readonly mar: Reg = { inset: unknown(19), op: unknown(19) };
  readonly mdr: Reg = { inset: unknown(16), op: unknown(16) };
  readonly sr: Reg = { inset: unknown(5), op: unknown(5) };
  /** Instruction register, three 16-bit words, most significant first. */
  ir: [Bits, Bits, Bits] = [unknown(16), unknown(16), unknown(16)];

  readonly out: Record<CuOutputName, Bits>;
  nets!: Nets;

  private aluKey = "";
  private aluOut: Bits = unknown(19);
  private aluFlags: Bits = known(5, 0);

  constructor(memory?: ArrayLike<number>) {
    if (memory) this.load(memory);
    this.out = {
      alu_opcode: X5, alu_rst: known(1, 1), we_sram: known(1, 1), oe_sram: known(1, 1),
      ce_sram: known(1, 0), pc: known(1, 0), mar: known(1, 0), mdr: known(1, 0),
      buf_s3: known(1, 0), sr: known(1, 1), op1: known(1, 0), ir: known(1, 0), acc: known(1, 0),
      mux_1: unknown(3), mux_2: unknown(3), mux_3: unknown(2), mux_4: unknown(3),
      mux_5: unknown(3), mux_6: unknown(3), mux_9: unknown(1, "U"),
    };
    this.evaluate();
    this.captureMasters();
  }

  /** Load words into program memory from address 0 (the rest is 0, like mem load -filldata 0). */
  load(memory: ArrayLike<number>): void {
    this.ram.fill(0);
    for (let i = 0; i < Math.min(memory.length, RAM_WORDS); i++) this.ram[i] = (memory[i] ?? 0) & 0xffff;
  }

  /** Advance half a clock period. Returns false once the model has stopped. */
  halfStep(): boolean {
    if (this.halted) return false;
    this.timeNs += HALF_PERIOD_NS;
    if (this.clk === 0) this.rising();
    else this.falling();
    return !this.halted;
  }

  /** Advance one full clock (to the next rising edge). */
  step(): boolean {
    return this.halfStep() && this.halfStep();
  }

  get opcode(): number | null {
    const w = this.ir[0];
    return isKnown(resize({ ...w, v: w.v >>> 11, u: w.u >>> 11 }, 5)) ? (w.v >>> 11) & 0x1f : null;
  }

  get mode(): number | null {
    const w = this.ir[0];
    return (w.u >>> 8) & 0x7 ? null : (w.v >>> 8) & 0x7;
  }

  private rising(): void {
    this.clk = 1;
    // Edge: latches see the old enables and old inputs.
    this.captureMasters();
    if (this.enabled("ir")) this.ir = [this.ir[1], this.ir[2], this.mdr.op];
    this.cacheOut = this.storage[0] ?? unknown(16);
    // Control unit moves on.
    const sr = isKnown(this.sr.op) ? this.sr.op.v : 0;
    this.state = this.nextState;
    const set = enter(this.state, this.opcode, this.mode, sr);
    for (const [name, value] of Object.entries(set) as [CuOutputName, number][]) {
      this.out[name] = known(OUTPUT_WIDTH[name], value);
    }
    this.nextState = next(this.state, this.opcode, this.mode, sr);
    this.evaluate();
    this.captureMasters();
    this.memoryAccess();
  }

  private falling(): void {
    this.clk = 0;
    for (const [reg, name] of this.registers()) {
      if (this.enabled(name)) reg.op = reg.inset;
    }
    if (this.enabled("acc")) this.storage[0] = this.nets.mux3;
    this.evaluate();
    this.memoryAccess();
  }

  private registers(): [Reg, "pc" | "mar" | "mdr" | "sr"][] {
    return [[this.pc, "pc"], [this.mar, "mar"], [this.mdr, "mdr"], [this.sr, "sr"]];
  }

  private enabled(name: CuOutputName): boolean {
    const b = this.out[name];
    return isKnown(b) && b.v === 1;
  }

  /** While the clock is high, enabled master latches follow their inputs. */
  private captureMasters(): void {
    const n = this.nets;
    const inputs: Record<string, Bits> = { pc: n.mux4, mar: n.mux5, mdr: n.mux6, sr: n.srIn };
    for (const [reg, name] of this.registers()) {
      if (this.enabled(name)) reg.inset = inputs[name] ?? reg.inset;
    }
  }

  private sel(name: CuOutputName): number | null {
    const b = this.out[name];
    return isKnown(b) ? b.v : null;
  }

  private ramRead(addr: Bits): Bits {
    if (!isKnown(addr)) return unknown(16);
    if (addr.v >= RAM_WORDS) {
      this.halt(addr.v);
      return unknown(16);
    }
    return known(16, this.ram[addr.v] ?? 0);
  }

  private halt(address: number | null): void {
    if (!this.halted) this.halted = { reason: "memory-range", address, timeNs: this.timeNs };
  }

  /** Writes happen while write enable is low (active low). */
  private memoryAccess(): void {
    if (this.sel("we_sram") !== 0) return;
    const addr = this.mar.op;
    if (!isKnown(addr) || addr.v >= RAM_WORDS) {
      this.halt(isKnown(addr) ? addr.v : null);
      return;
    }
    const data = this.nets.mem;
    if (isKnown(data)) this.ram[addr.v] = data.v;
  }

  /** Recompute every combinational net from the registers and control signals. */
  evaluate(): void {
    const wasRunning = this.halted === null;
    const [w0, w1, w2] = this.ir;
    const ir48hi = { v: w0.v * 0x10000 + w1.v, u: w0.u * 0x10000 + w1.u };
    // bits 39..21 = word0[7:0] word1[15:5]; bits 19..1 = word1[3:0] word2[15:1]
    const irOp2: Bits = {
      w: 19, v: Math.floor(ir48hi.v / 32) & 0x7ffff, u: Math.floor(ir48hi.u / 32) & 0x7ffff,
      k: w0.u ? w0.k : w1.k,
    };
    const irOp1: Bits = {
      w: 19, v: (((w1.v & 0xf) << 15) | (w2.v >>> 1)) >>> 0, u: (((w1.u & 0xf) << 15) | (w2.u >>> 1)) >>> 0,
      k: w1.u & 0xf ? w1.k : w2.k,
    };
    // Any select other than 0 (including the never-assigned U at start-up) picks operand 2.
    const mux9 = this.sel("mux_9") === 0 ? irOp1 : irOp2;
    const acc = this.cacheOut;

    const drivers: Bits[] = [];
    if (this.sel("buf_s3") === 1) drivers.push(this.mdr.op);
    if (this.sel("oe_sram") === 0) drivers.push(this.ramRead(this.mar.op));
    const mem = drivers.length === 0 ? unknown(16, "Z")
      : drivers.length === 1 || equal(drivers[0]!, drivers[1]!) ? drivers[0]! : unknown(16);

    const sext = (b: Bits) => resize(b, 19, true);
    const alu1 = pick(this.sel("mux_1"), { 0b010: this.mar.op, 0b011: this.pc.op, 0b100: mux9, 0b101: sext(acc), 0b110: sext(this.mdr.op) }, unknown(19));
    const alu2 = pick(this.sel("mux_2"), { 0b001: known(19, 1), 0b010: mux9, 0b011: sext(this.mdr.op), 0b101: sext(acc) }, unknown(19));

    // The ALU only re-evaluates when its operation or an operand changes.
    const op = this.out.alu_opcode;
    if (this.sel("alu_rst") === 1) {
      this.aluOut = unknown(19);
      this.aluFlags = known(5, 0);
      this.aluKey = "";
    } else {
      const key = `${toBinary(op)} ${toBinary(alu1)} ${toBinary(alu2)}`;
      if (key !== this.aluKey) {
        this.aluKey = key;
        const r = alu(op, alu1, alu2, this.sr.op);
        this.aluOut = r.out;
        if (r.flags !== null) this.aluFlags = known(5, r.flags);
      }
    }
    const aluOut = this.aluOut;

    // A read outside memory stops the simulator before anything downstream updates.
    if (wasRunning && this.halted && this.nets) return;
    this.nets = {
      irOp1, irOp2, mux9, acc, mem, alu1, alu2, aluOut, srIn: this.aluFlags,
      mux3: pick(this.sel("mux_3"), { 0b00: resize(this.pc.op, 16), 0b01: resize(aluOut, 16), 0b10: resize(mux9, 16), 0b11: this.mdr.op }, this.mdr.op),
      mux4: pick(this.sel("mux_4"), { 0b000: sext(acc), 0b001: resize(this.mdr.op, 19), 0b010: resize(resize(mux9, 16), 19), 0b011: aluOut }, unknown(19, "Z")),
      mux5: pick(this.sel("mux_5"), {
        0b001: this.pc.op, 0b010: aluOut, 0b011: mux9, 0b100: resize(this.mdr.op, 19),
        0b101: known(19, 0x94), 0b110: known(19, 0x95), 0b111: sext(acc),
      }, unknown(19)),
      mux6: pick(this.sel("mux_6"), { 0b001: mem, 0b010: resize(aluOut, 16), 0b011: resize(this.pc.op, 16), 0b100: resize(mux9, 16), 0b101: acc }, unknown(16, "Z")),
    };
  }
}

function pick(sel: number | null, inputs: Record<number, Bits>, otherwise: Bits): Bits {
  return sel === null ? otherwise : inputs[sel] ?? otherwise;
}
