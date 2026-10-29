// flags and a conditional jump on the Stack machine
//@clocks 200
push #5
sub #5
jz #3
push #0x111
push #0x222
pop 0x80
pop 0x81
