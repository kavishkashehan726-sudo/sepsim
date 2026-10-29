import { assemble } from "@sepsim/core";
import { describe, expect, it } from "vitest";
import { ACCUMULATOR_DIAGRAM, parseDia, writeDia } from "../src/sim/diagram";
import { DEFAULT_SETTINGS, displayTime, instructionSet, reviveSettings } from "../src/sim/settings";

describe("diagram files", () => {
  it("reads back what it writes in the old .dia format", () => {
    const bytes = writeDia(ACCUMULATOR_DIAGRAM);
    const back = parseDia(bytes.buffer as ArrayBuffer, "Accumulator");
    expect(back.elements).toEqual(ACCUMULATOR_DIAGRAM.elements);
  });
});

describe("settings", () => {
  it("default instruction set assembles like the built-in one", () => {
    const src = "loadacc #5\nadd 0x20\nstoreacc &0x21\ninc\n";
    expect(assemble(src, instructionSet(DEFAULT_SETTINGS)).words).toEqual(assemble(src).words);
  });

  it("renamed and recoded opcodes reach the assembler", () => {
    const s = { ...DEFAULT_SETTINGS, opcodes: DEFAULT_SETTINGS.opcodes.map((o) => (o.mnemonic === "add" ? { ...o, mnemonic: "plus" } : o)) };
    expect(assemble("plus #1", instructionSet(s)).words).toEqual(assemble("add #1").words);
    expect(assemble("add #1", instructionSet(s)).errors[0]?.message).toBe("Unknown instruction 'add'");
  });

  it("shows times with the configured period and duty cycle", () => {
    const s = { ...DEFAULT_SETTINGS, periodNs: 100, dutyCycle: 40 };
    expect(displayTime(0, s)).toBe(0);
    expect(displayTime(25, s)).toBe(40);
    expect(displayTime(50, s)).toBe(100);
    expect(displayTime(75, s)).toBe(140);
    expect(displayTime(75, DEFAULT_SETTINGS)).toBe(75);
  });

  it("fills in missing fields of a saved file and rejects other files", () => {
    expect(reviveSettings({ version: 1, periodNs: 20 })).toEqual({ ...DEFAULT_SETTINGS, periodNs: 20 });
    expect(reviveSettings({ hello: "world" })).toBeNull();
  });
});
