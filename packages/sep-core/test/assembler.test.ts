import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assemble, encode } from "../src/assembler.js";
import { formatMem, parseMem } from "../src/memfile.js";
import { goldenCases } from "./trace.js";

describe("assembler", () => {
  it("encodes opcode, mode and operand into bits 47:21", () => {
    expect(encode(0b11111, 0b100, 0x91)).toEqual([0xfc00, 0x1220, 0]);
    expect(encode(0b01111, 0b000, -3)).toEqual([0x78ff, 0xffa0, 0]);
  });

  it("reuses the previous mode and operand when an instruction has none", () => {
    const p = assemble("add #5\ninc\n");
    expect(p.words.slice(3)).toEqual(encode(0b10101, 0b000, 5));
  });

  it("reports unknown instructions and bad operands by line", () => {
    const p = assemble("loadacc #1\nfoo 2\n\nadd #zz\n");
    expect(p.errors).toEqual([
      { line: 2, message: "unknown instruction 'foo'" },
      { line: 4, message: "invalid operand 'zz'" },
    ]);
  });

  const cases = goldenCases("accumulator");
  it.skipIf(cases.length === 0)("builds the same .mem files the recordings were made from", () => {
    for (const c of cases) {
      const source = readFileSync(c.mem.replace(/\.mem$/, ".prg"), "latin1");
      const data = new Map<number, number>();
      for (const m of source.matchAll(/\/\/@data\s+(\S+)\s+(\S+)/g)) data.set(Number(m[1]), Number(m[2]));
      const p = assemble(source);
      expect(p.errors, c.name).toEqual([]);
      const want = readFileSync(c.mem, "latin1");
      expect(formatMem(p.words, data), c.name).toBe(want);
      expect(Array.from(parseMem(want, 151).slice(0, p.words.length)), c.name).toEqual(p.words);
    }
  });
});
