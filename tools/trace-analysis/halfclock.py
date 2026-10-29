"""Print the main top-level SEP signals at every half clock, in hex.

Usage: python halfclock.py <trace> [first_ns [last_ns]]
"""
import sys

from sepstrace import load, num, words

P = "/processor/"
COLS = [("pc", "sig_pc_out", 5), ("mar", "sig_mar_out", 5), ("mdr", "sig_mdr_out", 4),
        ("mem", "sig_mem_out", 4), ("a1", "sig_alu_1", 5), ("a2", "sig_alu_2", 5),
        ("ao", "sig_alu_out", 5), ("ir", "instruction_reg/op", 12), ("m3", "sig_mux3_out", 4),
        ("m4", "sig_mux4_pc", 5), ("m5", "sig_mux5_mar", 5), ("m6", "sig_mux6_mdr", 4),
        ("m9", "sig_mux9_out", 5), ("op1", "sig_ir_op1", 5), ("op2", "sig_ir_op2", 5)]


def fmt(v, width):
    n = num(v or "")
    if n is not None:
        return f"{n:0{width}x}"
    return (v or "-")[:width].ljust(width)


def main(path, lo=0, hi=10 ** 9):
    for t, v in load(path):
        if not lo <= t <= hi:
            continue
        acc = words(v.get(P + "cache/storage", ""))
        cols = " ".join(f"{name}={fmt(v.get(P + sig), w)}" for name, sig, w in COLS)
        print(f"{t:6} {v.get(P + 'clk')} {v.get(P + 'control_unit/cu_state', ''):22} {cols} "
              f"acc={fmt(acc[-1] if acc else '', 4)} sr={v.get(P + 'sig_sr_out')} "
              f"sri={v.get(P + 'sig_sr_in')} we={v.get(P + 'sig_we')} oe={v.get(P + 'sig_oe')}")


if __name__ == "__main__":
    main(sys.argv[1], *(int(a) for a in sys.argv[2:4]))
