import { describe, expect, it } from "vitest";
import { alu } from "../src/alu.js";
import { fromBinary, isKnown, toBinary } from "../src/logic.js";
import { goldenCases, readTrace } from "./trace.js";

const P = "/processor/";

describe("ALU against every recorded input/output pair", () => {
  const cases = goldenCases("accumulator");
  it.skipIf(cases.length === 0)("matches the original model", () => {
    const failures = new Set<string>();
    let checked = 0;
    for (const c of cases) {
      let last = "";
      for (const { values } of readTrace(c.trace).rows) {
        const get = (k: string) => fromBinary(values.get(P + k) ?? "");
        const op = get("sig_cu_alu");
        const a1 = get("sig_alu_1");
        const a2 = get("sig_alu_2");
        const out = values.get(P + "sig_alu_out") ?? "";
        if (!isKnown(op) || !isKnown(a1) || !isKnown(a2) || op.w !== 5) continue;
        // The model's ALU is not sensitive to cc_in: it only re-evaluates when an operand
        // or the operation changes, so only check samples where one of those changed.
        const inputs = `${toBinary(op)} ${toBinary(a1)} ${toBinary(a2)}`;
        if (inputs === last) continue;
        last = inputs;
        const r = alu(op, a1, a2, get("arith_logic_unit/cc_in"));
        const flags = r.flags === null ? "keep" : r.flags.toString(2).padStart(5, "0");
        const want = values.get(P + "sig_sr_in") ?? "";
        checked++;
        if (toBinary(r.out) !== out || (r.flags !== null && flags !== want)) {
          failures.add(`${toBinary(op)} ${toBinary(a1)} ${toBinary(a2)} cc_in=${values.get(P + "arith_logic_unit/cc_in")}: ` +
            `got ${toBinary(r.out)} ${flags}, want ${out} ${want}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect([...failures].slice(0, 20)).toEqual([]);
  });
});
