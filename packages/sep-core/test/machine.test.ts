import { describe, expect, it } from "vitest";
import { assemble } from "../src/assembler.js";
import { Machine } from "../src/machine.js";
import { SIGNAL_BY_PATH } from "../src/signals.js";
import { known } from "../src/logic.js";

const run = (src: string) => new Machine(assemble(src).words);

describe("instruction stepping", () => {
  it("runs one whole instruction per step and counts clocks", () => {
    const m = run("loadacc #5\nadd #3\n");
    expect(m.stepInstruction()).toBe(1); // init -> ifetch1
    expect(m.stepInstruction()).toBe(9); // loadacc #5
    expect(m.storage[0]!.v).toBe(5);
    m.stepInstruction(); // add #3
    expect(m.storage[0]!.v).toBe(8);
    expect(m.clocks).toBe(19);
  });

  it("stops after the limit when an instruction never finishes", () => {
    const m = run("add $1\n");
    m.stepInstruction();
    expect(m.stepInstruction(50)).toBe(50);
    expect(m.state).toBe("idecode");
  });
});

describe("deposits", () => {
  it("uses a value the user typed into a register from the next clock", () => {
    const m = run("add #1\n");
    m.stepInstruction();
    SIGNAL_BY_PATH.get("{/processor/cache/storage[0]}")?.write?.(m, known(16, 41));
    m.stepInstruction();
    expect(m.storage[0]!.v).toBe(42);
  });
});
