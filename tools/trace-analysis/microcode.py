"""Tabulate the control unit's outputs per state from Accumulator traces.

For every clock (sampled just after the rising edge) records the control-unit state,
the instruction's operation and addressing mode, and the control outputs it drives.
Prints each distinct (state, outputs) combination with the operations/modes it was seen
with, so the microcode of the original model can be read off directly.

Usage: python microcode.py <trace> [<trace> ...]
"""
import sys
from collections import defaultdict

from sepstrace import load

CU = "/processor/control_unit/"
OUTPUTS = ["alu_opcode", "alu_rst", "we_sram", "oe_sram", "ce_sram", "pc", "mar", "mdr",
           "buf_s3", "sr", "op1", "ir", "acc", "rb_ce", "rb_we", "stack",
           "mux_1", "mux_2", "mux_3", "mux_4", "mux_5", "mux_6", "mux_7", "mux_8", "mux_9"]


def main(paths):
    table = defaultdict(lambda: defaultdict(set))
    for path in paths:
        for t, v in load(path):
            if t % 50 != 25:
                continue
            state = v.get(CU + "cu_state")
            outs = tuple(f"{k}={v.get(CU + k)}" for k in OUTPUTS
                         if v.get(CU + k) not in (None, "0", "00", "000", "0000", "00000"))
            nxt = v.get(CU + "next_cu_state")
            key = (state, outs, nxt)
            table[key]["op"].add(f"{v.get(CU + 'operation')}/{v.get(CU + 'adressing_mode')}")
    for (state, outs, nxt), info in sorted(table.items(), key=lambda kv: (kv[0][0] or "", kv[0][2] or "")):
        ops = sorted(info["op"])
        print(f"{state:24} -> {nxt:24} {' '.join(outs)}")
        print(f"{'':28}ops: {' '.join(ops[:12])}{' ...' if len(ops) > 12 else ''}")


if __name__ == "__main__":
    main(sys.argv[1:])
