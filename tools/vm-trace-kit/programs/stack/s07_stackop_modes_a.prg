// opcode 01101 (swap/rotate3 share it) with addressing modes 000-011
//@clocks 350
push #1
push #2
push #3
push #4
push #5
.inst 01101 000 0 0
.inst 01101 001 0 0
.inst 01101 010 0 0
.inst 01101 011 0 0
pop 0x80
pop 0x81
pop 0x82
pop 0x83
pop 0x84
