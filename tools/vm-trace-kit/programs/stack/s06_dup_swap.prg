// dup, then swap (encoded with mode 000 and operand 0)
//@clocks 300
push #1
push #2
.inst 00111 000 0 0
pop 0x80
pop 0x81
pop 0x82
push #1
push #2
.inst 01101 000 0 0
pop 0x83
pop 0x84
