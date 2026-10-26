"""Minimal SEP assembler (Accumulator architecture) used to build trace-kit .mem files.

Mirrors the legacy SEPSim Beta assembler as observed from real .prg/.mem pairs:
  * 48-bit instructions stored as three 16-bit words (bits 47-32, 31-16, 15-0)
  * opcode in bits 47:43, addressing mode in 42:40, operand in 39:21
  * an instruction written without an operand reuses the previous line's
    addressing mode and operand (students rely on this for jump offsets)
  * .mem output = header, three blank lines, then "@<hex addr> " + up to 20 words per line
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


def assemble(source):
    """Return the list of 16-bit program words for a .prg source string."""
    words = []
    mode, operand = 0b000, 0  # what the legacy tool does before any operand is seen is unverified
    for line_no, raw in enumerate(source.splitlines(), 1):
        line = raw.split("//", 1)[0].strip()
        if not line:
            continue
        m = re.match(r"([A-Za-z]+)\s*(.*)$", line)
        if not m:
            raise AsmError(f"Line {line_no}: syntax error")
        mnemonic, rest = m.group(1).lower(), m.group(2).strip()
        if mnemonic not in OPCODES_ACC:
            raise AsmError(f"Line {line_no}: unknown instruction '{mnemonic}'")
        if rest:
            if rest[0] in MODES:
                mode, rest = MODES[rest[0]], rest[1:]
            else:
                mode = DIRECT
            operand = parse_number(rest, line_no)
        inst = (OPCODES_ACC[mnemonic] << 43) | (mode << 40) | (operand << 21)
        words += [(inst >> 32) & 0xFFFF, (inst >> 16) & 0xFFFF, inst & 0xFFFF]
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
    sys.stdout.write(to_mem(assemble(src)))
