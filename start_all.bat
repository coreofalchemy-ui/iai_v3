@echo off
cd /d "%~dp0"
echo ===================================================
echo AI Fashion Hub - One-Click Start (Fixed)
echo ===================================================
echo.
echo 1. Killing ALL Node.js processes (Force)...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul
echo.
echo 2. Starting AI Fashion Hub...
echo    - Backend Server (Port 3001) [Limit: 500MB]
echo    - Frontend App (Port 5173)
echo.
echo [IMPORTANT] Please wait for the browser to open...
echo.
echo 3. Starting Backend...
start "AI Backend (Port 3001)" /MIN node server.js

echo 4. Starting Frontend...
start "AI Frontend (Port 5173)" /MIN npm run dev
pause
