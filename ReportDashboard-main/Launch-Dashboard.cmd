@echo off
setlocal

set "PORT=8094"

cmd /c start "" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port %PORT%
ping 127.0.0.1 -n 5 >nul
start "" "http://localhost:%PORT%/"
