@echo off
rem Запуск игры через Vite dev-server с поддержкой мгновенной перезагрузки (HMR)
cd /d "%~dp0"
npx vite --port 8080
