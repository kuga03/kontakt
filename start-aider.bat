@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===================================================================
echo  Aider: Gemini 3.8 Flash - Архитектор, DeepSeek V3 - Исполнитель
echo ===================================================================

set "AIDER_EXE=aider"
where aider >nul 2>nul
if errorlevel 1 set "AIDER_EXE=C:\Users\Admin\AppData\Local\Programs\Python\Python311\Scripts\aider.exe"

"%AIDER_EXE%" %*
