"""List, for each control output, the (state, operation/mode) pairs in which its value
changed at a rising edge. A change proves the state assigns that output.

Usage: python cu_changes.py <trace> [<trace> ...]
"""
import sys
from collections import defaultdict

from sepstrace import load

CU = "/processor/control_unit/"
OUTPUTS = ["alu_opcode", "we_sram", "oe_sram", "pc", "mar", "mdr", "buf_s3", "sr", "ir", "acc",
           "mux_1", "mux_2", "mux_3", "mux_4", "mux_5", "mux_6", "mux_9", "alu_rst", "ce_sram"]


def main(paths):
    changed = defaultdict(lambda: defaultdict(set))
    for path in paths:
        prev = None
        for t, v in load(path):
            if t % 50 != 25:
                continue
            if prev is not None:
                st = v.get(CU + "cu_state")
                om = f"{v.get(CU + 'operation')}/{v.get(CU + 'adressing_mode')}"
                for o in OUTPUTS:
                    if v.get(CU + o) != prev.get(CU + o):
                        changed[o][st].add(f"{om}:{prev.get(CU + o)}>{v.get(CU + o)}")
            prev = v
    for o in OUTPUTS:
        print(f"== {o}")
        for st in sorted(changed[o], key=str):
            ex = sorted(changed[o][st])
            print(f"   {st:24} {' '.join(ex[:8])}{' ...' if len(ex) > 8 else ''}")


if __name__ == "__main__":
    main(sys.argv[1:])
