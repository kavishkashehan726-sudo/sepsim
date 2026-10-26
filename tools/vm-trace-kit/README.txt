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
3. Open config.bat in Notepad and check the two paths. You can see them in
   SEPSim under Edit > Settings > ModelSim tab:
     SEPSIM_DIR = the folder that contains SEPSim.exe and the "work" folder
     VSIM_EXE   = the full path to vsim.exe (the "Executable" folder + \vsim.exe)
4. Optional: copy any of your own .mem files into the "extra" folder.
5. Double-click run_traces.bat and wait until it says "Finished".
6. Zip the "out" folder (right-click > Send To > Compressed (zipped) Folder)
   and send it back, together with out\errors.txt if anything failed.

Part 2: check the old assembler (about 10 minutes, manual)
----------------------------------------------------------
The "assembler-check" folder has 7 small .prg files with unusual input.
For each one:
1. In SEPSim open File > New > Program, click Open and pick the .prg file.
2. Click Build.
3. Copy the text from the Output box into a .txt file with the same name
   (for example c02_negative_operand.txt).
4. If a .mem file was created, keep it next to the .prg.
Then zip the whole "assembler-check" folder and send it back.

The "programs" folder has the source of every test, so you can open any of them
in the SEPSim editor if you want to see what it does.
