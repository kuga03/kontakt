@echo off
chcp 65001 >nul
rem KONTAKT LAN host: run this, guests open the address below.
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies - internet needed once...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo NPM install failed. Check internet and node.
    pause
    exit /b 1
  )
)
rem Server already running? Reuse it instead of crashing with EADDRINUSE.
curl -s -m 2 http://127.0.0.1:8081/health 2>nul | findstr /c:"\"ok\":true" >nul
if not errorlevel 1 (
  echo Server is ALREADY running on :8081 - using it.
  echo Do not close the OLD window while playing.
  echo.
  echo Guests open one of these:
  for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo   http://%%a:8081
  pause
  exit /b 0
)
echo Starting server (do not close this window while playing)...
node server.js
echo.
echo Server stopped (code %errorlevel%).
pause
