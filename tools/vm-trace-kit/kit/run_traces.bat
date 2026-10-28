@echo off
rem SEPSim trace kit: double-click this file inside the Windows XP VM.
cd /d "%~dp0"
call config.bat
if not exist "%VSIM_EXE%" set VSIM_EXE=vsim.exe

if not exist "%SEPSIM_DIR%\work\_info" (
  echo Could not find the SEPSim "work" folder in: %SEPSIM_DIR%
  echo Open config.bat in Notepad and fix SEPSIM_DIR, then run this again.
  pause
  exit /b 1
)

echo Recording traces. This can take a while; leave the window open.
"%VSIM_EXE%" -c -do "set sepdir {%SEPSIM_DIR%}; do trace_all.do"
if errorlevel 1 (
  echo.
  echo vsim did not run. Open config.bat in Notepad and set VSIM_EXE to the full path of vsim.exe.
  pause
  exit /b 1
)

echo.
echo Finished. Zip the "out" folder and send it back.
pause
