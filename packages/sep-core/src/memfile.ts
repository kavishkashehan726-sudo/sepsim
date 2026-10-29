/**
 * The legacy SEPSim memory image format (.mem), as written by the original assembler and
 * read by ModelSim's `mem load`: a header comment, three blank lines, then lines of
 * "@<hex address> " followed by 16-bit binary words for consecutive addresses.
 */

export const MEM_HEADER = "//This is a SEPSim Alpha generated file. Do not modify!";

/** Parse a .mem image into a word array of `size` words (unlisted words are 0). */
export function parseMem(text: string, size: number): Uint16Array {
  const words = new Uint16Array(size);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("@")) continue;
    const [addrText, ...data] = line.split(/\s+/);
    let addr = parseInt(addrText!.slice(1), 16);
    if (Number.isNaN(addr)) throw new Error(`bad address in .mem line: ${raw}`);
    for (const word of data) {
      if (!/^[01]{16}$/.test(word)) throw new Error(`bad word "${word}" in .mem line: ${raw}`);
      if (addr < size) words[addr] = parseInt(word, 2);
      addr++;
    }
  }
  return words;
}

/**
 * Format program words (from address 0) and optional data words as .mem text, the way the
 * original assembler does: 20 words per line, CRLF line ends, a space after every word.
 */
export function formatMem(program: ArrayLike<number>, data: ReadonlyMap<number, number> = new Map()): string {
  const lines = [MEM_HEADER, "", "", ""];
  const bin = (w: number) => `${(w & 0xffff).toString(2).padStart(16, "0")} `;
  for (let start = 0; start < program.length; start += 20) {
    let line = `@${start.toString(16)} `;
    for (let i = start; i < Math.min(start + 20, program.length); i++) line += bin(program[i] ?? 0);
    lines.push(line);
  }
  for (const [addr, word] of [...data].sort((a, b) => a[0] - b[0])) lines.push(`@${addr.toString(16)} ${bin(word)}`);
  return lines.map((l) => `${l}\r\n`).join("");
}
