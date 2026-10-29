// call and ret on the Stack machine (where does the return address go?)
//@clocks 200
push #7
call #0x0C
pop 0x80
jump #-3
push #9
ret
