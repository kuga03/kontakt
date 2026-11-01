@echo off
rem Запуск игры БЕЗ кэша браузера: обычный F5 всегда берёт свежие файлы.
rem Было: npx http-server (кэш на час — Ctrl+F5 не пробивал модули).
cd /d "%~dp0"
npx http-server -c-1 -p 8080
