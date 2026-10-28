SEPSim trace kit
================

What this does
--------------
It runs the original SEP processor model in ModelSim (inside your Windows XP VM)
on a set of small test programs, and records every signal on every half clock.
The new SEPSim must reproduce these recordings exactly.

Part 1: record the traces (about 15 to 60 minutes, no clicking needed)
----------------------------------------------------------------------
1. Copy this whole "sepsim-trace-kit" folder into the VM, for example to C:\sepsim-trace-kit
   (a short path without spaces is best).
2. Close SEPSim if it is open.
3. config.bat already has the paths from your VM. If yours are different, open it
   in Notepad and fix them. You can see them in SEPSim under Edit > Settings > ModelSim tab:
     SEPSIM_DIR = the folder that contains SEPSim.exe and the "work" folder
     VSIM_EXE   = the full path to vsim.exe (the "Executable" folder + \vsim.exe)
4. Optional: copy any of your own .mem files into the "extra" folder.
5. Double-click run_traces.bat and wait until it says "Finished".
6. Zip the "out" folder (right-click > Send To > Compressed (zipped) Folder)
   and send it back, together with out\errors.txt if anything failed.

Part 2: check the old assembler, Accumulator (about 10 minutes, manual)
-----------------------------------------------------------------------
Skip this part if you already sent it.
The "assembler-check" folder has 7 small .prg files with unusual input.
With "Accumulator" selected in the SEP architecture list, for each one:
1. In SEPSim open File > New > Program, click Open and pick the .prg file.
2. Click Build.
3. Copy the text from the Output box into a .txt file with the same name
   (for example c02_negative_operand.txt).
4. If a .mem file was created, keep it next to the .prg.
Then zip the whole "assembler-check" folder and send it back.

Part 3: check the old assembler, Stack (about 10 minutes, manual)
-----------------------------------------------------------------
Same steps as Part 2, but first choose "Stack" in the SEP architecture list,
and use the 8 files in the "stack-assembler-check" folder. Some of them are
expected to give errors; the error text is exactly what is needed.
Then zip the whole "stack-assembler-check" folder and send it back.
This part matters most: there is no Stack ISA document, so the .mem files
built by the old tool are the only way to learn the Stack instruction format.

The "programs" folder has the source of every test, so you can open any of them
in the SEPSim editor if you want to see what it does. Lines starting with ".inst"
are raw test encodings that only this kit understands, so those files will not build
in SEPSim; that is expected.
