// mul and div, with an operand and without
//@clocks 300
push #12
mul #10
pop 0x80
push #100
div #7
pop 0x81
push #12
push #10
.inst 11011 000 0 0
pop 0x82
push #100
push #7
.inst 11100 000 0 0
pop 0x83
