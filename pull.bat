@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem  Kontakt: poluchenie obnovleniy s GitHub (pull) i zapusk
rem  Zapusk: dvoynoy klik po etomu faylu.
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   Kontakt - obnovlenie iz GitHub
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

set "OLDHEAD="
for /f "delims=" %%h in ('git rev-parse HEAD 2^>nul') do set "OLDHEAD=%%h"

echo --- Mestnye izmeneniya ---
git status --short
echo.

echo [1/3] git fetch !REMOTE!
git fetch !REMOTE!
if errorlevel 1 (
  echo.
  echo [OSHIBKA] Net svyazi s GitHub ili net dostupa.
  goto :end
)

set "INCOMING="
for /f "delims=" %%c in ('git rev-list --count HEAD..!REMOTE!/!BRANCH! 2^>nul') do set "INCOMING=%%c"
if "!INCOMING!"=="" set "INCOMING=0"

if "!INCOMING!"=="0" (
  echo [2/3] Novyh kommitov net - uge aktualno.
  goto :afterpull
)

echo [2/3] Priedet kommitov: !INCOMING!
git log --oneline HEAD..!REMOTE!/!BRANCH!
echo.

echo [3/3] git pull --ff-only !REMOTE! !BRANCH!
git pull --ff-only !REMOTE! !BRANCH!
if errorlevel 1 (
  echo.
  echo [OSHIBKA] Pull ne proshel. Chastye prichiny:
  echo   - est mestnye izmeneniya v teh zhe faylah: snachala zapusti push.bat
  echo     ili otlozhi ih:  git stash -u
  echo   - vetki razioshli: git pull !REMOTE! !BRANCH!  i razber konflikt
  goto :end
)

echo.
echo --- Chto priekhalo ---
git diff --stat !OLDHEAD!..HEAD
echo.

rem Zavisimosti: esli menyalsya package.json - stavim
set "NEEDNPM="
for /f "delims=" %%f in ('git diff --name-only !OLDHEAD!..HEAD 2^>nul ^| findstr /i "package.json package-lock.json"') do set "NEEDNPM=1"
if defined NEEDNPM (
  echo --- package.json izmenilsya: npm install ---
  call npm install
  if errorlevel 1 echo [VNIMANIE] npm install zavershilsya s oshibkoy.
  echo.
)

:afterpull
echo --- Itog ---
git log --oneline -3
git status -sb
echo.

set "GO="
set /p "GO=Zapustit igru (npm run dev)? [d/N]: "
if /i "!GO!"=="d" (
  echo.
  echo Zapuskayu npm run dev ... zakroy eto okno chtoby ostanovit.
  call npm run dev
)

:end
echo.
pause