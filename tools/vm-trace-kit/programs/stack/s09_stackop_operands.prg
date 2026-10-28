// opcode 01101 with different operand values
//@clocks 350
push #1
push #2
push #3
push #4
push #5
.inst 01101 000 1 1
.inst 01101 000 2 2
.inst 01101 000 3 3
.inst 01101 000 0x7FFFF 0x7FFFF
pop 0x80
pop 0x81
pop 0x82
pop 0x83
pop 0x84
