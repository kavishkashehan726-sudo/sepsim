// div with negative dividends and divisors
//@data 0x90 0xFFF9
//@clocks 220
loadacc #0xFF9C
div #7
loadacc #100
div #0xFFF9
loadacc #100
div #-7
loadacc #0xFF9C
div #-7
loadacc #0x8000
div #2
loadacc #7
div #100
loadacc #0xFFFF
div #1
loadacc #0x7FFF
div 0x90
