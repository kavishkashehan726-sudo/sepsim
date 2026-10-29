"""Collect distinct ALU input/output samples per ALU opcode, for fitting the ALU model.

Prints: opcode a1 a2 cc_in -> out cc_out   (hex, 19-bit operands, 5-bit flags P S O C Z)

Usage: python alu_samples.py <trace> [<trace> ...]
"""
import sys
from collections import defaultdict

from sepstrace import load, num

P = "/processor/"


def main(paths):
    seen = defaultdict(set)
    for path in paths:
        for t, v in load(path):
            op = v.get(P + "sig_cu_alu")
            vals = [num(v.get(P + k, "")) for k in ("sig_alu_1", "sig_alu_2", "sig_alu_out")]
            cin, cout = v.get(P + "arith_logic_unit/cc_in"), v.get(P + "sig_sr_in")
            if op and None not in vals:
                seen[op].add((vals[0], vals[1], cin, vals[2], cout))
    for op in sorted(seen):
        for a1, a2, cin, out, cout in sorted(seen[op]):
            print(f"{op} {a1:05x} {a2:05x} {cin} -> {out:05x} {cout}")


if __name__ == "__main__":
    main(sys.argv[1:])
