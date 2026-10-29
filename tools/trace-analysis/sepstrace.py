"""Read a sepsim-trace file (written by tools/vm-trace-kit/kit/trace_all.do).

A trace lists every signal once ("signal <idx> <path>"), then for each half
clock "t <ns>" followed by "v <idx> <value>" lines for the signals that changed.
"""


def load(path):
    names, rows = {}, []
    cur, t = {}, None
    with open(path, encoding="latin-1") as f:
        for line in f:
            kind, _, rest = line.rstrip("\r\n").partition(" ")
            if kind == "signal":
                idx, _, name = rest.partition(" ")
                names[int(idx)] = name
            elif kind == "t":
                if t is not None:
                    rows.append((t, dict(cur)))
                t = int(rest)
            elif kind == "v":
                idx, _, val = rest.partition(" ")
                cur[names[int(idx)]] = val
    if t is not None:
        rows.append((t, dict(cur)))
    return rows


def words(value):
    """Split an examined array value ("{0101..} {..}") into its elements."""
    return value.replace("{", " ").replace("}", " ").split()


def num(bits):
    """Binary string to int, or None if it holds X/U/Z etc."""
    bits = bits.strip("{}")
    return int(bits, 2) if bits and set(bits) <= {"0", "1"} else None
