import { describe, expect, it } from "vitest";
import { replay } from "./parity.js";
import { goldenCases } from "./trace.js";

describe("engine matches the original model clock by clock", () => {
  const cases = goldenCases("accumulator");
  it.skipIf(cases.length === 0)("has recorded programs", () => expect(cases.length).toBeGreaterThan(0));
  for (const c of cases) {
    it(c.name, () => {
      const r = replay(c);
      expect(r.mismatches.slice(0, 8)).toEqual([]);
      expect(r.halt.got).toBe(r.halt.want);
    });
  }
});
