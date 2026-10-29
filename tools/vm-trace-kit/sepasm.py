"""Minimal SEP assembler (Accumulator and Stack) used to build trace-kit .mem files.

Mirrors the legacy SEPSim Beta assembler as observed from real .prg/.mem pairs:
  * 48-bit instructions stored as three 16-bit words (bits 47-32, 31-16, 15-0)
  * opcode in bits 47:43, addressing mode in 42:40, operand in 39:21
  * an instruction written without an operand reuses the previous line's
    addressing mode and operand (students rely on this for jump offsets)
  * .mem output = header, three blank lines, then "@<hex addr> " + up to 20 words per line

Stack (machine 110) encoding is not confirmed yet: ISA.ini gives no operand field for it,
so Stack operands go in both 39:21 and 19:1 unless a program says otherwise with
"//@field hi" (39:21), "//@field lo" (19:1) or "//@field both".
Test programs can also write a raw instruction:
  .inst <opcode bits> <mode bits> <value for 39:21> [<value for 19:1>]
"""
import re
import sys

HEADER = "//This is a SEPSim Alpha generated file. Do not modify!"
WORDS_PER_LINE = 20

OPCODES_ACC = {
    "jc": 0b00001, "jof": 0b00010, "js": 0b00011, "jp": 0b00100, "jz": 0b00101,
    "storeacc": 0b00110, "looz": 0b01000, "call": 0b01010, "ret": 0b01011,
    "nop": 0b01110, "jump": 0b01111, "add": 0b10000, "sub": 0b10001,
    "and": 0b10010, "or": 0b10011, "xor": 0b10100, "inc": 0b10101,
    "not": 0b10110, "shl": 0b10111, "shr": 0b11000, "rol": 0b11001,
    "ror": 0b11010, "mul": 0b11011, "div": 0b11100, "loadacc": 0b11111,
}
# Stack shares the jump/ALU opcodes; loadacc/storeacc become push/pop (ISA.ini).
# swap and rotate3 share 01101 in ISA.ini; what tells them apart is still unknown.
OPCODES_STACK = {k: v for k, v in OPCODES_ACC.items() if k not in ("loadacc", "storeacc")}
OPCODES_STACK.update({"push": 0b11111, "pop": 0b00110, "dup": 0b00111,
                      "swap": 0b01101, "rotate3": 0b01101})
OPCODES = {"acc": OPCODES_ACC, "stack": OPCODES_STACK}
DEFAULT_FIELD = {"acc": "hi", "stack": "both"}
MODES = {"#": 0b000, "&": 0b101, "$": 0b010, "!": 0b110, "@": 0b111}
DIRECT = 0b100
OPERAND_BITS = 19


class AsmError(Exception):
    pass


def parse_number(text, line_no):
    t = text.strip().lower()
    try:
        value = int(t, 16) if t.startswith(("0x", "-0x")) else int(t, 10)
    except ValueError:
        raise AsmError(f"Line {line_no}: invalid operand '{text.strip()}'")
    return value & ((1 << OPERAND_BITS) - 1)


def encode(opcode, mode, hi, lo):
    inst = (opcode << 43) | (mode << 40) | (hi << 21) | (lo << 1)
    return [(inst >> 32) & 0xFFFF, (inst >> 16) & 0xFFFF, inst & 0xFFFF]


def assemble(source, machine="acc"):
    """Return the list of 16-bit program words for a .prg source string."""
    opcodes = OPCODES[machine]
    m = re.search(r"//@field\s+(hi|lo|both)", source)
    field = m.group(1) if m else DEFAULT_FIELD[machine]
    words = []
    mode, operand = 0b000, 0  # what the legacy tool does before any operand is seen is unverified
    for line_no, raw in enumerate(source.splitlines(), 1):
        line = raw.split("//", 1)[0].strip()
        if not line:
            continue
        if line.lower().startswith(".inst"):
            parts = line.split()[1:]
            if len(parts) not in (3, 4):
                raise AsmError(f"Line {line_no}: .inst needs opcode, mode and 1 or 2 values")
            hi = parse_number(parts[2], line_no)
            lo = parse_number(parts[3], line_no) if len(parts) == 4 else 0
            words += encode(int(parts[0], 2), int(parts[1], 2), hi, lo)
            continue
        m = re.match(r"([A-Za-z0-9]+)\s*(.*)$", line)
        if not m:
            raise AsmError(f"Line {line_no}: syntax error")
        mnemonic, rest = m.group(1).lower(), m.group(2).strip()
        if mnemonic not in opcodes:
            raise AsmError(f"Line {line_no}: unknown instruction '{mnemonic}'")
        if rest:
            if rest[0] in MODES:
                mode, rest = MODES[rest[0]], rest[1:]
            else:
                mode = DIRECT
            operand = parse_number(rest, line_no)
        hi = operand if field in ("hi", "both") else 0
        lo = operand if field in ("lo", "both") else 0
        words += encode(opcodes[mnemonic], mode, hi, lo)
    return words


def to_mem(program, data=None):
    """Format program words (from address 0) plus optional {addr: word} data as .mem text."""
    blocks = [(0, program)] if program else []
    for addr in sorted(data or {}):
        blocks.append((addr, [data[addr] & 0xFFFF]))
    lines = [HEADER, "", "", ""]
    for start, block in blocks:
        for i in range(0, len(block), WORDS_PER_LINE):
            chunk = block[i:i + WORDS_PER_LINE]
            lines.append(f"@{start + i:x} " + "".join(f"{w:016b} " for w in chunk))
    return "\r\n".join(lines) + "\r\n"


if __name__ == "__main__":
    src = open(sys.argv[1], encoding="latin-1").read()
    sys.stdout.write(to_mem(assemble(src, sys.argv[2] if len(sys.argv) > 2 else "acc")))
