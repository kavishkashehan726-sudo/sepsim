@echo off
rem Quick check (about 1 minute): records one short program into the out_probe folder.
cd /d "%~dp0"
call config.bat
if exist out_probe rmdir /s /q out_probe
"%VSIM_EXE%" -c -do "set sepdir {%SEPSIM_DIR%}; set probe 1; do trace_all.do"
echo.
echo Finished. Zip the "out_probe" folder and send it back.
pause
