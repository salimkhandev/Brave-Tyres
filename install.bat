@echo off
echo ======================================
echo Brave Tyres Management Installation
echo ======================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo npm version:
npm --version
echo.

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Dependencies installed successfully!
echo.

echo ======================================
echo Installation Complete!
echo ======================================
echo.
echo To run the application:
echo   npm start
echo.
echo To build the application:
echo   npm run build
echo.
echo To build NSIS installer:
echo   npm run build:nsis
echo.
echo To build portable version:
echo   npm run build:portable
echo.
pause