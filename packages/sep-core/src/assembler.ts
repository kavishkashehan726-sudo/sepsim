/**
 * Assembler for SEP Accumulator programs (.prg), matching the legacy SEPSim assembler as
 * observed from real .prg/.mem pairs (see tools/vm-trace-kit/sepasm.py, its reference copy):
 *  - each instruction is 48 bits, stored as three 16-bit words (bits 47-32, 31-16, 15-0):
 *    opcode in 47:43, addressing mode in 42:40, operand in 39:21;
 *  - an instruction written without an operand reuses the previous line's mode and operand;
 *  - "//" starts a comment.
 */

export const OPCODES: Readonly<Record<string, number>> = {
  jc: 0b00001, jof: 0b00010, js: 0b00011, jp: 0b00100, jz: 0b00101,
  storeacc: 0b00110, looz: 0b01000, call: 0b01010, ret: 0b01011,
  nop: 0b01110, jump: 0b01111, add: 0b10000, sub: 0b10001,
  and: 0b10010, or: 0b10011, xor: 0b10100, inc: 0b10101,
  not: 0b10110, shl: 0b10111, shr: 0b11000, rol: 0b11001,
  ror: 0b11010, mul: 0b11011, div: 0b11100, loadacc: 0b11111,
};

/** Addressing-mode prefixes; an operand with no prefix is direct. */
export const MODES: Readonly<Record<string, number>> = { "#": 0b000, "&": 0b101, "$": 0b010, "!": 0b110, "@": 0b111 };
export const DIRECT = 0b100;
export const OPERAND_BITS = 19;

/**
 * The instruction set the assembler uses. The old SEPSim let advanced users edit it
 * (Edit > Settings > Instruction Set); the default is the Accumulator set above.
 */
export interface InstructionSet {
  opcodes: Readonly<Record<string, number>>;
  /** Mode symbol to its 3 bits. */
  modes: Readonly<Record<string, number>>;
  /** Bits used when an operand has no mode symbol. */
  direct: number;
}

export const ACCUMULATOR_ISA: InstructionSet = { opcodes: OPCODES, modes: MODES, direct: DIRECT };
const OPERAND_MASK = (1 << OPERAND_BITS) - 1;

export interface Diagnostic {
  /** 1-based source line. */
  line: number;
  message: string;
}

export interface Instruction {
  line: number;
  /** Word address of the instruction's first word. */
  address: number;
  mnemonic: string;
  opcode: number;
  mode: number;
  operand: number;
}

export interface Program {
  words: number[];
  instructions: Instruction[];
  errors: Diagnostic[];
}

/** The operand value (19 bits), or the legacy assembler's message for why it is not one. */
function parseOperand(text: string): number | string {
  const t = text.trim().toLowerCase();
  if (t.includes(",")) return "Too many operands";
  const neg = t.startsWith("-");
  const body = neg ? t.slice(1) : t;
  let v: number;
  if (body.startsWith("0x")) {
    if (!/^[0-9a-f]+$/.test(body.slice(2))) return "Invalid char in hex integer";
    v = parseInt(body.slice(2), 16);
  } else if (/^\d+$/.test(body)) {
    v = parseInt(body, 10);
  } else {
    return "Invalid operand";
  }
  return ((neg ? -v : v) & OPERAND_MASK) >>> 0;
}

/** The three memory words of one instruction. */
export function encode(opcode: number, mode: number, operand: number): [number, number, number] {
  // 48 bits do not fit a JS bit operation, so build the top and bottom halves separately.
  const op = operand & OPERAND_MASK;
  const w0 = ((opcode & 0x1f) << 11) | ((mode & 0x7) << 8) | (op >>> 11);
  const w1 = (op & 0x7ff) << 5;
  return [w0, w1, 0];
}

/** The summary line the legacy program editor prints after a build or check. */
export const buildSummary = (p: Program): string =>
  `Build ${p.errors.length ? "failed" : "succeeded"}. ${p.errors.length} errors, 0 warnings`;

export function assemble(source: string, isa: InstructionSet = ACCUMULATOR_ISA): Program {
  const words: number[] = [];
  const instructions: Instruction[] = [];
  const errors: Diagnostic[] = [];
  // What the legacy tool does before any operand is seen is still being checked.
  let mode = 0b000;
  let operand = 0;
  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const text = raw.split("//", 1)[0]!.trim();
    if (!text) return;
    const m = /^([A-Za-z0-9]+)\s*(.*)$/.exec(text);
    if (!m) {
      errors.push({ line, message: "Syntax error" });
      return;
    }
    const mnemonic = m[1]!.toLowerCase();
    let rest = m[2]!.trim();
    const opcode = Object.hasOwn(isa.opcodes, mnemonic) ? isa.opcodes[mnemonic] : undefined;
    if (opcode === undefined) {
      errors.push({ line, message: `Unknown instruction '${mnemonic}'` });
      return;
    }
    if (rest) {
      const prefix = Object.hasOwn(isa.modes, rest[0]!) ? isa.modes[rest[0]!] : undefined;
      if (prefix !== undefined) rest = rest.slice(1);
      const value = parseOperand(rest);
      if (typeof value === "string") {
        errors.push({ line, message: value });
        return;
      }
      mode = prefix ?? isa.direct;
      operand = value;
    }
    instructions.push({ line, address: words.length, mnemonic, opcode, mode, operand });
    words.push(...encode(opcode, mode, operand));
  });
  return { words, instructions, errors };
}
