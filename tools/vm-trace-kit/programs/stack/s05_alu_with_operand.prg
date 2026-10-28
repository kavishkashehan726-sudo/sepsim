// ALU instructions with an operand (ISA.ini lists add/sub/and/or/div with 1 operand on Stack)
//@data 0x90 0x0003
//@clocks 250
push #9
sub #7
pop 0x80
push #6
add 0x90
pop 0x81
push #0x0F
and #0x3C
pop 0x82
