"""Guess how the SEP datapath is wired: for each component input port, list the
top-level /processor/sig_* signals (or other ports) that always carry the same value.

Values are compared as numbers, truncated to the narrower width, at every sample
where both are fully defined (0/1 only). Ports whose value never becomes defined are
reported as such.

Usage: python wiring.py <trace> [<trace> ...]
"""
import re
import sys
from collections import defaultdict

from sepstrace import load

PORT = re.compile(r"^/processor/[^/]+/(ip\d?|data|addr|inset|op2?)$")


def defined(v):
    return v and set(v) <= {"0", "1"}


def main(paths):
    candidates = None  # port -> set of sources still consistent
    seen = defaultdict(int)
    for path in paths:
        for t, v in load(path):
            if t % 25:
                continue
            ports = [k for k in v if PORT.match(k)]
            sources = [k for k in v if k.startswith("/processor/sig_") or PORT.match(k)]
            if candidates is None:
                candidates = {p: set(s for s in sources if s != p) for p in ports}
            for p in ports:
                pv = v.get(p)
                if not defined(pv):
                    continue
                seen[p] += 1
                keep = set()
                for s in candidates.get(p, ()):
                    sv = v.get(s)
                    if not defined(sv):
                        keep.add(s)
                        continue
                    w = min(len(pv), len(sv))
                    if int(pv, 2) & ((1 << w) - 1) == int(sv, 2) & ((1 << w) - 1):
                        keep.add(s)
                candidates[p] = keep
    for p in sorted(candidates):
        tops = sorted(s for s in candidates[p] if "/sig_" in s)
        print(f"{p:45} seen={seen[p]:6} {' '.join(tops) if seen[p] else '(never defined)'}")


if __name__ == "__main__":
    main(sys.argv[1:])
