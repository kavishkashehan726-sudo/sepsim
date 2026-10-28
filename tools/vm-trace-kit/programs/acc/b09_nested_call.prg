// a call inside a subroutine (the return address lives in one place, mem[0x94])
//@clocks 300
call #9
storeacc 0x80
jump #-3
loadacc #1
call #0x15
inc
ret
loadacc #5
ret
