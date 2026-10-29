// immediates wider than 16 bits (the operand field is 19 bits)
//@clocks 150
loadacc #0x12345
storeacc 0x80
loadacc #-1
storeacc 0x81
add #0x10001
storeacc 0x82
