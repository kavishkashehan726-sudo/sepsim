"""Print, per control-unit state, a matrix of control outputs by operation/mode
(and, for conditional jumps and looz, by whether the condition held), sampled just
after the rising edge. Outputs that never change within a state are listed once.

Usage: python cu_matrix.py <trace> [<trace> ...]
"""
import sys
from collections import defaultdict

from sepstrace import load

CU = "/processor/control_unit/"
OUTPUTS = ["alu_opcode", "we_sram", "oe_sram", "pc", "mar", "mdr", "buf_s3", "sr", "ir", "acc",
           "mux_1", "mux_2", "mux_3", "mux_4", "mux_5", "mux_6", "mux_9"]
SHORT = {"alu_opcode": "alu", "we_sram": "we", "oe_sram": "oe", "buf_s3": "buf"}


def main(paths):
    rows = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))
    for path in paths:
        for t, v in load(path):
            if t % 50 != 25:
                continue
            st = v.get(CU + "cu_state")
            key = f"{v.get(CU + 'operation')}/{v.get(CU + 'adressing_mode')} -> {v.get(CU + 'next_cu_state')}"
            for o in OUTPUTS:
                rows[st][key][o].add(v.get(CU + o))
    for st in sorted(rows, key=str):
        keys = sorted(rows[st])
        const, varying = [], []
        for o in OUTPUTS:
            vals = set().union(*(rows[st][k][o] for k in keys))
            (const if len(vals) == 1 else varying).append((o, vals))
        print(f"== {st}   " + " ".join(f"{SHORT.get(o, o)}={next(iter(v))}" for o, v in const))
        if varying:
            print(f"   {'op/mode -> next':38} " + " ".join(f"{SHORT.get(o, o):>6}" for o, _ in varying))
            for k in keys:
                cells = ["/".join(sorted(rows[st][k][o])) for o, _ in varying]
                print(f"   {k:38} " + " ".join(f"{c:>6}" for c in cells))


if __name__ == "__main__":
    main(sys.argv[1:])
