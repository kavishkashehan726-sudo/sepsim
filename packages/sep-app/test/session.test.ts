import { assemble } from "@sepsim/core";
import { describe, expect, it } from "vitest";
import { Session } from "../src/sim/session";
import { DEFAULT_SETTINGS, settings } from "../src/sim/settings";

function runProgram(source: string, steps: number) {
  const s = new Session();
  s.loadProgram(assemble(source).words, "test");
  s.initialize();
  s.setMode("IL");
  for (let i = 0; i < steps; i++) s.singleStep();
  return s;
}

describe("end of program", () => {
  const program = "loadacc #10\nadd #5\nstoreacc 0x90\n";

  it("stops at the first empty instruction after the program", () => {
    settings.set(DEFAULT_SETTINGS);
    const s = runProgram(program, 10);
    expect(s.machine!.pc.op.v).toBe(9);
    expect(s.machine!.ram[0x90]).toBe(15);
    expect(s.log.filter((l) => l.text.startsWith("End of program")).length).toBe(1);
    expect(s.log.at(-1)?.text).toMatch(/has finished/);
  });

  it("runs on through empty memory when the setting is off, like the original", () => {
    settings.set({ ...DEFAULT_SETTINGS, stopAtEnd: false });
    const s = runProgram(program, 10);
    expect(s.machine!.pc.op.v).toBeGreaterThan(9);
    settings.set(DEFAULT_SETTINGS);
  });
});
