/**
 * Multi-valued bit vectors, enough to reproduce what ModelSim shows for the SEP model.
 *
 * A vector has a width, a value for its known bits and a mask of unknown bits. Unknown
 * bits all print with the same character: X (conflict/unknown), U (never assigned) or
 * Z (not driven). That covers every value seen in the recorded traces, including
 * partly known ones such as the instruction register while it fills ("XXXX1111...").
 */

export type Unknown = "X" | "U" | "Z";

export interface Bits {
  readonly w: number;
  /** Value of the known bits (unknown bits are 0 here). */
  readonly v: number;
  /** Mask of unknown bits. */
  readonly u: number;
  /** How unknown bits print. */
  readonly k: Unknown;
}

export const mask = (w: number): number => (w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0;

export const known = (w: number, v: number): Bits => ({ w, v: (v & mask(w)) >>> 0, u: 0, k: "X" });

export const unknown = (w: number, k: Unknown = "X"): Bits => ({ w, v: 0, u: mask(w), k });

export const isKnown = (b: Bits): boolean => b.u === 0;

/** Keep the low `w` bits, or extend (zero or sign) to `w` bits. */
export function resize(b: Bits, w: number, signed = false): Bits {
  if (w <= b.w) {
    return { w, v: (b.v & mask(w)) >>> 0, u: (b.u & mask(w)) >>> 0, k: b.k };
  }
  const top = 1 << (b.w - 1);
  const ext = (mask(w) & ~mask(b.w)) >>> 0;
  let { v, u } = b;
  if (signed) {
    if (u & top) u = (u | ext) >>> 0;
    else if (v & top) v = (v | ext) >>> 0;
  }
  return { w, v, u, k: b.k };
}

export function toBinary(b: Bits): string {
  let s = "";
  for (let i = b.w - 1; i >= 0; i--) {
    const bit = 1 << i;
    s += b.u & bit ? b.k : b.v & bit ? "1" : "0";
  }
  return s;
}

export function fromBinary(s: string): Bits {
  let v = 0;
  let u = 0;
  let k: Unknown = "X";
  for (const ch of s) {
    v = (v << 1) >>> 0;
    u = (u << 1) >>> 0;
    if (ch === "1") v |= 1;
    else if (ch !== "0") {
      u |= 1;
      if (ch === "U" || ch === "Z") k = ch;
    }
  }
  return { w: s.length, v: v >>> 0, u: u >>> 0, k };
}

/** Hex for display; unknown nibbles show their unknown character. */
export function toHex(b: Bits): string {
  let s = "";
  for (let i = Math.ceil(b.w / 4) - 1; i >= 0; i--) {
    const m = (0xf << (i * 4)) >>> 0;
    s += b.u & m ? b.k : ((b.v >>> (i * 4)) & 0xf).toString(16);
  }
  return s;
}

export const equal = (a: Bits, b: Bits): boolean =>
  a.w === b.w && a.v === b.v && a.u === b.u && (a.u === 0 || a.k === b.k);
