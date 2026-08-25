@echo off
setlocal EnableExtensions
title Color Duel - Interface Test
cd /d "%~dp0.."
set "COLOR_DUEL_INTERFACE_TEST=1"
echo Color Duel interface test
echo Player 1: Q W E R
echo Player 2: U I O P
if not exist "node_modules\electron\cli.js" call npm.cmd install --include=dev
if errorlevel 1 goto :ERROR
call npm.cmd start
pause
exit /b
:ERROR
echo Installation failed. See the error above.
pause
exit /b 1
