@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem  Kontakt: avto-kommit i push v origin/main
rem  Zapusk: dvoynoy klik po etomu faylu.
rem  Mozhno peredat soobshchenie:  push.bat "pravki botov"
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   Kontakt - sohranenie i otpravka na GitHub
echo   Papka: %CD%
echo ============================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [OSHIBKA] Zdes net git-repozitoriya.
  goto :end
)

set "BRANCH="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
if "!BRANCH!"=="" set "BRANCH=main"

set "REMOTE="
for /f "delims=" %%r in ('git remote 2^>nul') do if not defined REMOTE set "REMOTE=%%r"
if "!REMOTE!"=="" (
  echo [OSHIBKA] Ne nastroen remote.
  goto :end
)

echo Vetka: !BRANCH!    Remote: !REMOTE!
echo.
echo --- Chto izmenilos ---
git status --short
echo.

set "DIRTY="
for /f "delims=" %%s in ('git status --porcelain 2^>nul') do set "DIRTY=1"

if defined DIRTY (
  set "MSG=%~1"
  if "!MSG!"=="" set "MSG=auto: obnovlenie %DATE% %TIME%"
  echo [1/3] git add -A
  git add -A
  echo [2/3] git commit -m "!MSG!"
  git commit -m "!MSG!"
  if errorlevel 1 (
    echo.
    echo [VNIMANIE] Kommit ne sozdan. Prover nastroyki git:
    echo   git config --global user.name  "Tvoe Imya"
    echo   git config --global user.email "you@example.com"
    goto :end
  )
) else (
  echo [1/3] Izmeneniy net - kommit ne nuzhen.
  echo [2/3] -
)

echo.
echo [3/3] git push !REMOTE! !BRANCH!
git push !REMOTE! !BRANCH!
if errorlevel 1 (
  echo.
  echo [OSHIBKA] Push ne proshel. Chastye prichiny:
  echo   - net dostupa k GitHub: git config --global credential.helper manager
  echo   - vetka na servere ushla vpered: git pull !REMOTE! !BRANCH!
  goto :end
)

echo.
echo --- Itog ---
git log --oneline -1
git status -sb
echo.
echo Gotovo: izmeneniya na GitHub.

:end
echo.
pause