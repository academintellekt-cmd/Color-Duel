@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
where node >nul 2>nul || (echo ERROR: Install Node.js LTS & pause & exit /b 1)
if not exist "node_modules\electron\cli.js" call npm.cmd install --include=dev
if errorlevel 1 (echo ERROR: Dependency installation failed. & pause & exit /b 1)
call npm.cmd run design
if errorlevel 1 (echo ERROR: Preview stopped with an error. & pause)
