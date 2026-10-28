"""Summarise a SEP trace instruction by instruction.

For each instruction (from one ifetch1 to the next) prints: start PC, opcode
and mode bits, the control-unit states it went through, the clock count, the
accumulator and status register after it, and any RAM words it changed.

Usage: python summarize.py <trace> [<trace> ...]
"""
import sys

from sepstrace import load, num, words

OPS = {
    0b00001: "jc", 0b00010: "jof", 0b00011: "js", 0b00100: "jp", 0b00101: "jz",
    0b00110: "storeacc", 0b01000: "looz", 0b01010: "call", 0b01011: "ret",
    0b01110: "nop", 0b01111: "jump", 0b10000: "add", 0b10001: "sub",
    0b10010: "and", 0b10011: "or", 0b10100: "xor", 0b10101: "inc",
    0b10110: "not", 0b10111: "shl", 0b11000: "shr", 0b11001: "rol",
    0b11010: "ror", 0b11011: "mul", 0b11100: "div", 0b11111: "loadacc",
}
MODES = {0b000: "#", 0b100: "", 0b101: "&", 0b010: "$", 0b110: "!", 0b111: "@"}

STATE = "/processor/control_unit/cu_state"
PC = "/processor/sig_pc_out"
IR = "/processor/instruction_reg/op"
SR = "/processor/status_reg/op"
CACHE = "/processor/cache/storage"
RAM = "/processor/as_ram/asram"


def fmt(n, width=4):
    return "-" * width if n is None else f"{n:0{width}x}"


def summarize(path, max_instructions=60):
    rows = [(t, v) for t, v in load(path) if t % 50 == 25]  # sample after each rising edge settles
    out = []
    start = None
    for i, (t, v) in enumerate(rows):
        if v.get(STATE) == "ifetch1" and (i == 0 or rows[i - 1][1].get(STATE) != "ifetch1"):
            if start is not None:
                out.append((start, i))
            start = i
    out.append((start, len(rows)))

    print(f"== {path}")
    for n, (a, b) in enumerate(out[:max_instructions]):
        if a is None:
            continue
        seg = rows[a:b]
        states = []
        for _, v in seg:
            s = v.get(STATE)
            if not states or states[-1] != s:
                states.append(s)
        end = seg[-1][1]
        before = rows[a - 1][1] if a > 0 else seg[0][1]
        ir = num(end.get(IR, ""))
        if ir is not None:
            op, mode, operand = ir >> 43, (ir >> 40) & 7, (ir >> 21) & 0x7FFFF
            text = f"{OPS.get(op, f'?{op:05b}')} {MODES.get(mode, f'?{mode:03b}')}{operand:#x}"
        else:
            text = "?"
        acc = num(words(end.get(CACHE, ""))[-1])  # storage is declared descending; examine lists element 0 last if end.get(CACHE) else None
        ram0, ram1 = words(before.get(RAM, ""))[::-1], words(end.get(RAM, ""))[::-1]
        writes = [f"[{k:#x}]={num(w1) if num(w1) is None else hex(num(w1))}"
                  for k, (w0, w1) in enumerate(zip(ram0, ram1)) if w0 != w1]
        print(f"{n:3} pc={fmt(num(seg[0][1].get(PC, '')))} {text:22} clocks={len(seg):2} "
              f"acc={fmt(acc)} sr={end.get(SR, '-')} {' '.join(writes)}")
        print(f"      {' > '.join(s for s in states if s)}")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        summarize(p)
