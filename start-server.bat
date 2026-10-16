@echo off
title VeriTract Local Server
echo Starting VeriTract local web server...
cd /d "%~dp0\veritract.website-main" 2>nul || cd /d "%~dp0"
start http://localhost:8080/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0veritract.website-main\server.ps1" 2>nul || powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
