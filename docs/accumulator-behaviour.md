# SEP Accumulator architecture: observed behaviour

What the original SEP VHDL model actually does in Accumulator mode (`machine = 101`),
recorded clock by clock in ModelSim 6.1e with `tools/vm-trace-kit` and summarised with
`tools/trace-analysis/summarize.py`. Where this disagrees with the course manual
("ISA 2") or the lab sheet, **this file wins**: the new simulator must match the model,
not the manual.

Status: first round of traces, 17 programs, 2026-10-28. Items marked *open* need a
second round of test programs.

## Machine

| Item | Value |
| --- | --- |
| Word size | 16 bits |
| Instruction | 48 bits = 3 words: word 0 = bits 47..32, word 1 = 31..16, word 2 = 15..0 |
| Fields | opcode 47..43, addressing mode 42..40, operand 39..21 (19 bits) |
| Program memory | `/processor/as_ram/asram`, **151 words** (addresses 0x00 to 0x96) |
| Accumulator | `/processor/cache/storage[0]` (the 32-word register bank, element 0) |
| Clock | 50 ns period, rising edge at 0, 50, 100 ns... |
| PC after reset | 0 |

ModelSim `examine` lists `asram` and `storage` with the **highest index first**.

## Status register

5 bits, `/processor/status_reg/op`, most significant first: **P S O C Z**.

| Bit | Flag | Meaning as observed |
| --- | --- | --- |
| 4 | P parity | 1 when the result has an **even** number of 1 bits (so 0 gives P = 1) |
| 3 | S sign | sign of the *true* result for add/sub/mul/div, so `0x7FFF + 1` gives S = 0, `0x8000 - 1` gives S = 1. Logic ops, NOT, shifts and rotates leave S = 0 |
| 2 | O overflow | signed overflow (`0x7FFF + 1`, `0x8000 - 1`, INC of `0x7FFF`) |
| 1 | C carry | add: carry out. sub: **1 when there is no borrow** (`9 - 7` gives C = 1, `7 - 9` gives C = 0). Shifts/rotates: the bit shifted out |
| 0 | Z zero | result is 0 |

Every ALU instruction rewrites the whole register, including NOT (the manual says NOT
affects no flags; the model updates P and Z).

## Instruction timing (control unit states)

Every instruction starts with 8 fetch states and a decode state:
`ifetch1 > ifetch2 > ... > ifetch8 > idecode` (9 clocks). The 3 instruction words are
read through MAR/MDR during the fetch states. Immediate-mode ALU instructions and
`loadacc #` finish **inside `idecode`**.

| Instruction form | States after `idecode` | Clocks |
| --- | --- | --- |
| `loadacc #n`, `add/sub/and/or/xor/mul/div #n`, `inc`, `not`, `shl`, `shr`, `rol`, `ror` | none | 9 |
| conditional jumps, `jump` (taken or not) | none | 9 |
| ALU op, direct (`add 0x90`) | `op2_direct2acc > execution_accumulator` | 11 |
| ALU op, indirect (`add &0x91`) | `op2_indirect2acc > op2_indirect3acc > op2_indirect4acc > execution_accumulator` | 13 |
| `loadacc 0x90` (direct) | `load2_direct_acc > load3_direct_acc` | 11 |
| `storeacc 0x80` (direct) | `mdr_to_mem1_acc > mdr_to_mem2_acc` | 11 |
| `storeacc &0x91` (indirect) | `store2_indirect_acc > store3_indirect_acc > mdr_to_mem1_acc > ...` | not yet seen completing (see hangs) |
| `call` | `call2 > call3` | 11 |
| `ret` | `ret2 > ret3` | 11 |
| `looz` | `looz2 > looz3 > looz4` | 12 |

Before the first instruction the control unit spends one clock in `init`.

## Instructions

| Instruction | Observed result |
| --- | --- |
| `loadacc #n` | acc = n (low 16 bits of the operand) |
| `loadacc addr` | acc = mem[addr] |
| `storeacc addr` | mem[addr] = acc |
| `add`, `sub` | acc = acc + op, acc = acc - op (16-bit wrap), flags as above |
| `and`, `or`, `xor` | bitwise; S = O = C = 0 |
| `mul` | signed 8 x 8: acc = sext(acc[7:0]) x sext(op[7:0]), 16-bit result. `0xFF x 2 = 0xFFFE`, `0x1234 x 0x156 = 0x34 x 0x56 = 0x1178` |
| `div` | positive values: integer quotient (`100 / 7 = 14`). Divide by 0 gives 0 with Z = 1. *Open:* `0xFF9C / 7` gives `0x923A`, which matches the dividend sign-extended to 18 bits and divided unsigned; needs more cases |
| `inc` | acc + 1, flags like `add` |
| `not` | one's complement; updates P and Z |
| `shl` | acc << 1, C = old bit 15, O = 1 if bit 15 changed |
| `shr` | acc >> 1 (0 shifted in), C = old bit 0, O = old bit 15 |
| `rol` | rotate left **through carry**: new bit 0 = old C, new C = old bit 15 |
| `ror` | rotate right **through carry**: new bit 15 = old C, new C = old bit 0 |
| `jz`, `jc`, `js`, `jof`, `jp` | if the flag is 1: PC = PC + 3 + operand (offset counted in **words** from the next instruction; 19-bit two's complement, so `0x7FFFA` = -6) |
| `jump n` | PC = PC + 3 + n, always |
| `call n` | mem[0x94] = PC + 3 (return address), PC = n (**absolute**, not relative) |
| `ret` | PC = mem[0x94] |
| `looz n` | *partly open.* The counter is **mem[0x95]**: `idecode` loads MAR with the constant 0x95, `looz2` reads it into MDR, `looz3` decrements it in the ALU (flags set from the result, MDR = result). With the counter at 0 the result was 0xFFFF, nothing was written back to memory and it fell through to the next instruction. The control unit also has `looz5` and `looz6` states, not reached yet (round 2 tests counters 1, 2 and 3) |
| `nop` | nothing, 9 clocks (direct mode) |

## Hangs (the model stops making progress)

These leave the control unit stuck in one state for the rest of the run. The new
simulator must reproduce them (the student sees the simulation stop advancing).

| Program | Stuck in |
| --- | --- |
| any store to an address above 0x96 (`storeacc 0x1F4`, `storeacc &p` where p holds 0xA0) | `mdr_to_mem1_acc` |
| `nop` with immediate mode (`loadacc #21` then a bare `nop` reuses mode `#`) | `idecode` |
| `add $1` (register-direct mode is not valid for Accumulator) | `idecode` |

Other invalid modes do nothing and continue: `loadacc &0x90` leaves acc unchanged,
`storeacc #0x55` writes nothing, `shl #3` shifts as usual.

## Assembler (from 13 real .prg/.mem pairs)

- `.mem` = header line, 3 blank lines, then `@<hex address> ` followed by up to 20
  binary words per line, CRLF line endings. `tools/vm-trace-kit/sepasm.py` reproduces
  all 13 files byte for byte.
- An instruction written with no operand reuses the previous line's addressing mode
  **and** operand. Lab programs rely on this (`loadacc #21` then `js` jumps by 21).
- No mode symbol means direct (100).

## Open questions for round 2

- `looz`: when it writes the counter back and when it jumps (counter address is 0x95).
- `div` with negative operands, and with a negative divisor.
- Flags for `mul` overflow (results that do not fit in 16 bits cannot happen with 8 x 8, but sign cases need checking).
- Indirect `loadacc` and indirect store to a valid address.
- What a bare instruction on the first line encodes (assembler check results pending).
