@echo off
echo ========================================================
echo   Starting VocalAlign AI (Backend + React Frontend)
echo ========================================================

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment .venv tidak ditemukan!
    echo Silakan jalankan: uv venv --python 3.11 ^&^& uv pip install -r requirements.txt
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [INFO] Menginstal dependensi frontend...
    cd frontend && call npm install && cd ..
)

start "VocalAlign Backend (FastAPI)" cmd /k ".venv\Scripts\python.exe server.py"
start "VocalAlign Frontend (React + Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting up!
echo Frontend UI : http://localhost:5173
echo Backend API: http://localhost:8000/docs
echo ========================================================
