// ALU instructions with no operand (immediate mode, operand 0)
//@clocks 250
push #9
push #7
.inst 10001 000 0 0
pop 0x80
push #6
push #3
.inst 10000 000 0 0
pop 0x81
