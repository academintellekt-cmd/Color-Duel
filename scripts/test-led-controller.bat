@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo Close Color Duel and Arduino Serial Monitor before this test.
echo Testing all 8 LED outputs...
node scripts\test-led-controller.js
pause
