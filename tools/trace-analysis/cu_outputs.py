"""For each control-unit state, classify every control output:
  const  - always the same value in that state
  by-op  - fixed for a given operation/addressing mode, differs between them
  held   - varies even for the same operation/mode (keeps an older value)
Samples just after the rising edge (t % 50 == 25).

Usage: python cu_outputs.py <trace> [<trace> ...]
"""
import sys
from collections import defaultdict

from sepstrace import load

CU = "/processor/control_unit/"
OUTPUTS = ["alu_opcode", "alu_rst", "we_sram", "oe_sram", "ce_sram", "pc", "mar", "mdr",
           "buf_s3", "sr", "op1", "ir", "acc", "rb_ce", "rb_we", "stack",
           "mux_1", "mux_2", "mux_3", "mux_4", "mux_5", "mux_6", "mux_7", "mux_8", "mux_9"]


def main(paths):
    seen = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))  # state -> out -> opmode -> values
    nexts = defaultdict(lambda: defaultdict(set))
    for path in paths:
        for t, v in load(path):
            if t % 50 != 25:
                continue
            st = v.get(CU + "cu_state")
            om = f"{v.get(CU + 'operation')}/{v.get(CU + 'adressing_mode')}"
            for o in OUTPUTS:
                seen[st][o][om].add(v.get(CU + o))
            nexts[st][om].add(v.get(CU + "next_cu_state"))
    for st in sorted(seen, key=str):
        print(f"== {st}")
        nx = {om: sorted(n) for om, n in nexts[st].items()}
        allnext = sorted({n for ns in nx.values() for n in ns})
        print(f"   next: {' | '.join(allnext)}" if len(allnext) == 1 else
              "   next: " + "; ".join(f"{om}->{','.join(n)}" for om, n in sorted(nx.items())))
        for o in OUTPUTS:
            per = seen[st][o]
            vals = set().union(*per.values())
            if len(vals) == 1:
                print(f"   {o:10} const {vals.pop()}")
            elif all(len(s) == 1 for s in per.values()):
                print(f"   {o:10} by-op " + " ".join(f"{om}={next(iter(s))}" for om, s in sorted(per.items())))
            else:
                print(f"   {o:10} held  {sorted(vals)}")


if __name__ == "__main__":
    main(sys.argv[1:])
