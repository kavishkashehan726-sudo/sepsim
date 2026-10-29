/** Showing and reading values in the three radixes the old SEPSim offers. */
import { type Bits, toBinary, toHex } from "@sepsim/core";

export type Radix = 2 | 10 | 16;

export const RADIX_NAMES: Record<Radix, string> = { 2: "Binary", 10: "Decimal", 16: "Hexadecimal" };

export function formatBits(b: Bits, radix: Radix): string {
  if (radix === 2) return toBinary(b);
  if (radix === 16) return toHex(b);
  if (b.u === 0) return String(b.v);
  // Decimal has no way to show unknown bits: fall back to binary, like ModelSim does.
  return b.u === 2 ** b.w - 1 ? b.k : toBinary(b);
}

export function formatValue(v: Bits | string | null, radix: Radix): string {
  if (v === null) return "<uninitialized>";
  return typeof v === "string" ? v : formatBits(v, radix);
}

/**
 * Read a value typed by the user, in the view's radix. A "0x" or "0b" prefix overrides
 * it. Negative decimals are stored in two's complement. Returns null if it is not valid
 * or does not fit in `width` bits.
 */
export function parseValue(text: string, width: number, radix: Radix): Bits | null {
  let t = text.trim().toLowerCase().replace(/_/g, "");
  let r: Radix = radix;
  if (t.startsWith("0x")) [r, t] = [16, t.slice(2)];
  else if (t.startsWith("0b")) [r, t] = [2, t.slice(2)];
  const neg = r === 10 && t.startsWith("-");
  if (neg) t = t.slice(1);
  const digits = { 2: /^[01]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/ }[r];
  if (!digits.test(t)) return null;
  let v = parseInt(t, r);
  const max = 2 ** width;
  if (neg) {
    if (v > max / 2) return null;
    v = (max - v) % max;
  }
  if (v >= max) return null;
  return { w: width, v, u: 0, k: "X" };
}
