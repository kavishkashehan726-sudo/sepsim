# SEP Accumulator architecture: observed behaviour

What the original SEP VHDL model actually does in Accumulator mode (`machine = 101`),
recorded clock by clock in ModelSim 6.1e with `tools/vm-trace-kit` and summarised with
`tools/trace-analysis/summarize.py`. Where this disagrees with the course manual
("ISA 2") or the lab sheet, **this file wins**: the new simulator must match the model,
not the manual.

Status: round 1 (17 programs, 2026-10-28) and round 2 (10 programs, 2026-10-29).
Items marked *open* need more test programs. The traces themselves are in the private
repo linked at `tests/golden`.

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
| 3 | S sign | sign of the *true* result for add/sub/inc/mul, so `0x7FFF + 1` gives S = 0, `0x8000 - 1` gives S = 1. div: sign of dividend XOR sign of the 19-bit divisor, even when the quotient is 0. NOT, shifts and rotates appear to **keep the old S** (it stayed 1 through `not`/`shl`/`shr`/`rol`/`ror` in a Stack trace; every Accumulator case started with S = 0). *Open:* the same check for and/or/xor |
| 2 | O overflow | signed overflow (`0x7FFF + 1`, `0x8000 - 1`, INC of `0x7FFF`) |
| 1 | C carry | add: carry out. sub: **1 when there is no borrow** (`9 - 7` gives C = 1, `7 - 9` gives C = 0). Shifts/rotates: the bit shifted out |
| 0 | Z zero | result is 0 |

Every ALU instruction writes the status register, including NOT (the manual says NOT
affects no flags; the model updates P and Z), but NOT, shifts and rotates seem to carry
S over unchanged (see above).

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
| `storeacc &0x91` (indirect) | `store2_indirect_acc > store3_indirect_acc > mdr_to_mem1_acc > mdr_to_mem2_acc` | 13 |
| `call` | `call2 > call3` | 11 |
| `ret` | `ret2 > ret3` | 11 |
| `looz`, falls through | `looz2 > looz3 > looz4` | 12 |
| `looz`, jumps | `looz2 > looz3 > looz4 > looz5` | 13 |

Before the first instruction the control unit spends one clock in `init`.

## Instructions

| Instruction | Observed result |
| --- | --- |
| `loadacc #n` | acc = n (low 16 bits of the 19-bit operand: `#0x12345` gives 0x2345, `#-1` gives 0xFFFF) |
| `loadacc addr` | acc = mem[addr] |
| `loadacc &p` | **does nothing** (9 clocks, acc unchanged): indirect load is not implemented |
| `storeacc addr` | mem[addr] = acc |
| `storeacc &p` | mem[mem[p]] = acc, 13 clocks (`store2_indirect_acc > store3_indirect_acc > mdr_to_mem1_acc > mdr_to_mem2_acc`) |
| `add`, `sub` | acc = acc + op, acc = acc - op (16-bit wrap), flags as above. Immediates use the low 16 bits: `0xFFFF + #0x10001` gives 0 with C = 1. `add &p` adds mem[mem[p]] |
| `and`, `or`, `xor` | bitwise; S = O = C = 0 |
| `mul` | signed 8 x 8: acc = sext(acc[7:0]) x sext(op[7:0]), 16-bit result. Confirmed on all sign cases: `0x80 x 0x80 = 0x4000`, `0x80 x 0x7F = 0xC080`, `0xFF x 0xFF = 1`, `5 x #-3 = 0xFFF1`, `5 x mem 0xFFFE = 0xFFF6`. O = C = 0 |
| `div` | **unsigned** division of the accumulator sign-extended to 18 bits by the 19-bit operand (memory words are sign-extended to 19 bits); acc = low 16 bits of the quotient. Fits every case: `0xFF9C / 7 = 0x923A`, `0x8000 / 2 = 0xC000`, `0xFFFF / 1 = 0xFFFF`, `100 / #-7 = 0`, `0x7FFF / mem 0xFFF9 = 0`, `100 / 7 = 14`, divide by 0 gives 0. O = C = 0 |
| `inc` | acc + 1, flags like `add` |
| `not` | one's complement; updates P and Z |
| `shl` | acc << 1, C = old bit 15, O = 1 if bit 15 changed |
| `shr` | acc >> 1 (0 shifted in), C = old bit 0, O = old bit 15 |
| `rol` | rotate left **through carry**: new bit 0 = old C, new C = old bit 15 |
| `ror` | rotate right **through carry**: new bit 15 = old C, new C = old bit 0 |
| `jz`, `jc`, `js`, `jof`, `jp` | if the flag is 1: PC = PC + 3 + operand (offset counted in **words** from the next instruction; 19-bit two's complement, so `0x7FFFA` = -6) |
| `jump n` | PC = PC + 3 + n, always |
| `call n` | mem[0x94] = PC + 3 (return address), PC = n (**absolute**, not relative). A call inside a subroutine overwrites mem[0x94], so the outer `ret` returns to the inner return address and loops forever |
| `ret` | PC = mem[0x94] |
| `looz n` | counter = mem[0x95]. Computes counter - 1 (flags set like `sub`). If the result is **greater than 0** (signed): writes it back to mem[0x95] and jumps to PC + 3 + n (13 clocks, `looz2..looz5`). Otherwise (result 0 or negative): **no write-back**, falls through (12 clocks, `looz2..looz4`). So a loop with counter 3 runs the body 3 times and leaves mem[0x95] = 1; counter 0 falls through at once. The addressing mode is ignored (`looz -6` behaves like `looz #-6`) |
| `nop` | nothing, 9 clocks (direct mode) |

## Hangs (the model stops making progress)

These leave the control unit stuck in one state for the rest of the run. The new
simulator must reproduce them (the student sees the simulation stop advancing).

| Program | Stuck in |
| --- | --- |
| `nop` with immediate mode (`loadacc #21` then a bare `nop` reuses mode `#`) | `idecode` |
| `add $1` (register-direct mode is not valid for Accumulator) | `idecode` |
| `add !p` and `add @p` (modes 110 and 111) | `idecode` |

Other invalid modes do nothing and continue: `loadacc &p`, `loadacc !p` and `loadacc @p`
leave acc unchanged, `storeacc #0x55` writes nothing, `shl #3` shifts as usual. The `!` and
`@` modes are not implemented for Accumulator at all.

## Memory outside 0x00..0x96 stops the simulation

Any read or write of an address above 0x96 is a fatal ModelSim error: the simulation
stops at that instant (the recorder keeps sampling, so the trace shows the clock frozen).
Seen with `storeacc 0x1F4` (stops at the rising edge into `mdr_to_mem1_acc`, 950 ns in
a17) and with the program counter running past 0x96 (stops at the falling edge that
moves MAR to 0x97, 22925 ns in a13). Values downstream of the bad address keep what
they had: memory output, ALU inputs and so on do not update.

## Datapath details the engine needed

- mux 3 (accumulator input) with an undefined select passes MDR.
- mux 9 picks operand 1 only for select 0; anything else, including the U it starts
  with, picks operand 2.
- mux 4 (PC input) gets only the low 16 bits of mux 9, zero-extended: a jump or call
  target never sets PC bits 18..16.
- The PC master latch starts undefined; the PC output starts at 0.
- Single-operand instructions (inc, not, shl, shr, rol, ror) leave mux 9 as it was.

`packages/sep-core` replays all 27 recorded Accumulator programs and matches 46 signals
at every half clock, including where the simulation stops.

## Assembler (from 13 real .prg/.mem pairs)

- `.mem` = header line, 3 blank lines, then `@<hex address> ` followed by up to 20
  binary words per line, CRLF line endings. `tools/vm-trace-kit/sepasm.py` reproduces
  all 13 files byte for byte.
- An instruction written with no operand reuses the previous line's addressing mode
  **and** operand. Lab programs rely on this (`loadacc #21` then `js` jumps by 21).
- No mode symbol means direct (100).

## Open questions

- S flag after and/or/xor when S was 1 before.
- What a bare instruction on the first line encodes (assembler check results pending).
