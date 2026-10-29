/**
 * The SEP ALU, fitted to every input/output pair recorded from the original model.
 *
 * Inputs and the result are 19 bits (the address width). Data values reach the ALU
 * sign-extended from 16 bits. Flags are P S O C Z, most significant first; P, Z, C
 * and O look at the low 16 bits, S at bit 18 of the 19-bit result.
 * See docs/accumulator-behaviour.md for the observed rules.
 */
import { type Bits, isKnown, known, mask, unknown } from "./logic.js";

export const ALU = {
  add: 0b00001, sub: 0b00010, and: 0b00011, or: 0b00100, xor: 0b00101, not: 0b00110,
  shl: 0b00111, shr: 0b01000, rol: 0b01001, ror: 0b01010, inc: 0b01011, mul: 0b01100,
  div: 0b01101, addAdr: 0b10000, incAdr: 0b10001, decAdr: 0b10010,
} as const;

const M16 = 0xffff;
const M19 = mask(19);
const F = { P: 16, S: 8, O: 4, C: 2, Z: 1 };

function parityEven(x: number): boolean {
  let n = x & M16;
  let c = 0;
  while (n) {
    c ^= n & 1;
    n >>>= 1;
  }
  return c === 0;
}

const sext16 = (x: number): number => (x & 0x8000 ? (x | 0x70000) : x & M16) & M19;
const sext8 = (x: number): number => ((x & 0xff) ^ 0x80) - 0x80;

/** P and Z from the low 16 bits, plus the given S/O/C bits. */
function flags(res16: number, s: number, o: number, c: number): number {
  return (parityEven(res16) ? F.P : 0) | (s ? F.S : 0) | (o ? F.O : 0) | (c ? F.C : 0) | ((res16 & M16) === 0 ? F.Z : 0);
}

function add(a: number, b: number): [number, number] {
  const r = (a + b) & M19;
  const x = a & M16;
  const y = b & M16;
  const s16 = x + y;
  const res = s16 & M16;
  const o = ~(x ^ y) & (x ^ res) & 0x8000;
  return [r, flags(res, r >>> 18, o, s16 >>> 16)];
}

/** b - a, with C = 1 when there is no borrow. */
function sub(b: number, a: number): [number, number] {
  const r = (b - a) & M19;
  const x = a & M16;
  const y = b & M16;
  const res = (y - x) & M16;
  const o = (y ^ x) & (y ^ res) & 0x8000;
  return [r, flags(res, r >>> 18, o, y >= x ? 1 : 0)];
}

export interface AluResult {
  out: Bits;
  /** null keeps the previous flag output (the model does that for undefined inputs). */
  flags: number | null;
}

/**
 * @param op 5-bit ALU operation from the control unit
 * @param ip1 first operand (mux 1), 19 bits
 * @param ip2 second operand (mux 2), 19 bits
 * @param ccIn current status register (P S O C Z)
 */
export function alu(op: Bits, ip1: Bits, ip2: Bits, ccIn: Bits): AluResult {
  if (!isKnown(op) || !isKnown(ip1) || !isKnown(ip2)) return { out: unknown(19), flags: null };
  const a = ip1.v;
  const b = ip2.v;
  const cin = isKnown(ccIn) ? ccIn.v : 0;
  const keepS = cin & F.S ? 1 : 0;
  const c0 = cin & F.C ? 1 : 0;
  const x = b & M16;
  let r: number;
  let f: number;
  switch (op.v) {
    case ALU.add: [r, f] = add(a, b); break;
    case ALU.sub: [r, f] = sub(b, a); break;
    case ALU.inc: [r, f] = add(1, b); break;
    case ALU.decAdr: [r, f] = sub(b, 1); break;
    case ALU.and: r = a & b; f = flags(r, keepS, 0, 0); break;
    case ALU.or: r = a | b; f = flags(r, keepS, 0, 0); break;
    case ALU.xor: r = a ^ b; f = flags(r, keepS, 0, 0); break;
    case ALU.not: r = ~b & M19; f = flags(r, keepS, 0, 0); break;
    case ALU.shl: {
      const res = (x << 1) & M16;
      r = sext16(res);
      f = flags(res, keepS, (x ^ res) & 0x8000, x >>> 15);
      break;
    }
    case ALU.shr: {
      const res = x >>> 1;
      r = sext16(res);
      f = flags(res, keepS, x >>> 15, x & 1);
      break;
    }
    case ALU.rol: {
      const res = ((x << 1) | c0) & M16;
      r = sext16(res);
      f = flags(res, keepS, 0, x >>> 15);
      break;
    }
    case ALU.ror: {
      const res = (x >>> 1) | (c0 << 15);
      r = sext16(res);
      f = flags(res, keepS, 0, x & 1);
      break;
    }
    case ALU.mul: {
      const p = sext8(a) * sext8(b);
      r = sext16(p & M16);
      f = flags(p & M16, p < 0 ? 1 : 0, 0, 0);
      break;
    }
    case ALU.div: {
      // Unsigned divide of the low 18 bits, with bit 18 = XOR of the operand signs.
      const d = a & 0x3ffff;
      r = d === 0 ? 0 : Math.floor((b & 0x3ffff) / d) | (((a ^ b) >>> 18) & 1) << 18;
      f = flags(r, r >>> 18, 0, 0);
      break;
    }
    case ALU.addAdr: r = (a + b) & M19; f = cin; break;
    case ALU.incAdr: r = (a + 1) & M19; f = cin; break;
    default: return { out: unknown(19), flags: null };
  }
  return { out: known(19, r), flags: f };
}
