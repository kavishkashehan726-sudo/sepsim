// looz with its counter (mem[0x95]) set to 1
//@data 0x95 0x0001
//@clocks 300
loadacc #0
inc
looz #-6
storeacc 0x80
