@echo off
echo ========================================
echo   INSTALASI BOT TELEGRAM - OTOMATIS
echo ========================================
echo.

REM 1. Cek apakah Node.js sudah terinstall
echo [1/4] Mengecek Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Node.js BELUM TERINSTALL!
    echo.
    echo Silakan install Node.js terlebih dahulu:
    echo 1. Buka https://nodejs.org
    echo 2. Download versi LTS
    echo 3. Install seperti biasa (klik Next terus)
    echo 4. Jalankan file ini lagi
    echo.
    pause
    exit /b
)
echo ✅ Node.js sudah terinstall

REM 2. Cek apakah file .env ada
echo.
echo [2/4] Mengecek file .env...
if not exist .env (
    echo.
    echo ⚠️ File .env belum ada!
    echo.
    echo File .env_template.txt akan di-copy menjadi .env
    copy env_template.txt .env >nul
    echo ✅ File .env sudah dibuat
    echo.
    echo 📌 PENTING: Edit file .env dan isi TOKEN Anda!
    echo.
    pause
    notepad .env
)

REM 3. Install dependencies
echo [3/4] Menginstall dependencies (tunggu sebentar)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ❌ Gagal menginstall dependencies
    pause
    exit /b
)
echo ✅ Dependencies terinstall

REM 4. Jalankan bot
echo.
echo [4/4] Menjalankan bot...
echo ========================================
echo.
node bot.js

pause
