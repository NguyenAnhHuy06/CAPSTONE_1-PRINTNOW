@echo off
REM =====================================================
REM   KHOI DONG SERVER (Backend + Frontend)
REM =====================================================

REM Thiết lập PATH để bao gồm Poppler (cho PDF processing)
set PATH=%PATH%;C:\Release-25.07.0-0\poppler-25.07.0\Library\bin

REM Chuyển đến thư mục dự án
cd /d D:\cap1

echo.
echo ============================================
echo   KHOI DONG SERVER - PrintNow System
echo ============================================
echo   Backend API  : http://localhost:5000/api
echo   Frontend     : http://localhost:5000
echo ============================================
echo.

REM Khởi động server
node server.js

