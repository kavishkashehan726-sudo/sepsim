# SEP Stack architecture: observed behaviour

What the original SEP VHDL model does in Stack mode (`machine = 110`), recorded in
ModelSim with `tools/vm-trace-kit` (programs `s01`-`s16`, round 2, 2026-10-29) and
summarised with `tools/trace-analysis/summarize.py`. There is no Stack ISA document, so
this file is the only spec. Traces are in the private repo linked at `tests/golden`.

Most of the machine is shared with Accumulator (see `accumulator-behaviour.md`): word
size, 3-word instructions, fetch/decode (9 clocks), the 151-word RAM, the status
register and flags, jumps, `call`/`ret` (return address at mem[0x94]) and
`looz` (counter at mem[0x95]) all behave the same.

## Encoding

| Field | Bits |
| --- | --- |
| opcode | 47..43 |
| addressing mode | 42..40 |
| operand | **39..21** (same as Accumulator; bits 19..1 are ignored) |

`s01` put different values in 39..21 and 19..1: push and pop used 39..21 only.

## The stack

The stack is a shift register inside the register bank component
(`/processor/cache/top`, `second`, `third`, `fourth`, `fifth`, ...). A push shifts every
entry down one place and puts the value in `top`; a pop shifts everything up and fills
the bottom with 0. The control unit drives a 3-bit stack operation
(`/processor/sig_cu_stack`): push 001, pop 010, dup 011.

- At least 34 entries deep: after 34 pushes, two pops returned 0x22 and 0x21 (*open:* the
  real depth, and what happens past it).
- Popping an empty stack gives 0 and leaves the stack all 0. No error, no hang.

## Instructions

| Instruction | Observed result | States after `idecode` | Clocks |
| --- | --- | --- | --- |
| `push #n` | push n (low 16 bits) | none | 9 |
| `push addr` | push mem[addr] | `op2_direct2 > push_mdr_to_stack` | 11 |
| `push &p` | push mem[mem[p]] | `op2_direct2 > op2_indirect3 > op2_indirect4 > push_mdr_to_stack` | 13 |
| `pop addr` | mem[addr] = top, pop | `pop_direct2 > pop_direct3` | 11 |
| `pop &p` | mem[mem[p]] = top, pop | `pop_indirect2 > pop_indirect3 > pop_indirect4 > pop_indirect5` | 13 |
| `add`, `sub`, `and`, `mul`, `div` | **top = top OP second**, nothing is popped. `push 9, push 7, sub` leaves `0xFFFE, 9`; `push 7, push 100, div` leaves `0, 100` (7 / 100). Any operand and addressing mode is **ignored**: `push 9, sub #7` gives 9 - 0 = 9 | `op2fectch_exec_stack` (sic) | 10 |
| `inc`, `not`, `shl`, `shr`, `rol`, `ror` | operate on top, same results and flags as Accumulator | `op2fectch_exec_stack` | 10 |
| `dup` (00111) | push a copy of top | none | 9 |
| opcode 01101 (`swap` and `rotate3` in ISA.ini) | **hangs in `idecode`** with every addressing mode (000-111) and every operand tried (0, 1, 2, 3, 0x7FFFF) | `idecode` forever | - |
| `jz` etc., `jump`, `call`, `ret`, `looz` | as in Accumulator; the stack is not touched (`call` stores the return address at mem[0x94], not on the stack) | as Accumulator | 9-13 |

Because ALU results replace `top` and keep `second`, `push a, push b, add` leaves two
entries (`a + b`, `a`), not one as in a textbook stack machine.

## Open questions

- How swap and rotate3 are encoded. The compiled package names stack operations
  `swap`, `rotate3`, `rotate4` and `rotate5`, but opcode 01101 hangs. Next step: the
  old assembler's output for `swap`/`rotate3` (Stack assembler check), then a sweep of
  the unused opcodes 01001, 01100, 11101, 11110.
- Real stack depth and overflow behaviour.
- `or`, `xor` on the stack (not traced yet, expected to match `and`).
