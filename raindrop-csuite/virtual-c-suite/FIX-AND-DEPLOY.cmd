@echo off
REM Virtual C-Suite - Fix npx and Deploy
REM This script fixes the Windows npx issue and deploys

echo ========================================
echo  Fixing npx for Windows
echo ========================================
echo.

cd /d "%~dp0"

REM Check if npx.cmd exists
where npx.cmd >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npx.cmd not found in PATH
    echo.
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

REM Get the directory where npx.cmd is located
for /f "tokens=*" %%i in ('where npx.cmd') do set NPX_DIR=%%~dpi
echo npx.cmd found at: %NPX_DIR%
echo.

REM Add to PATH for this session
set PATH=%NPX_DIR%;%PATH%

REM Verify npx works
echo Testing npx...
call npx.cmd --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npx not working correctly
    pause
    exit /b 1
)
echo npx is working!
echo.

REM Create npx wrapper script in current directory
echo Creating npx wrapper...
echo @echo off > npx.bat
echo call "%NPX_DIR%npx.cmd" %%* >> npx.bat
set PATH=%CD%;%PATH%
echo npx wrapper created
echo.

echo ========================================
echo  Building Application
echo ========================================
echo.

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo.

echo ========================================
echo  Deploying to Raindrop
echo ========================================
echo.
echo This may take 2-5 minutes...
echo.

call raindrop build deploy --start
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo  Deployment Failed
    echo ========================================
    echo.
    echo Common issues:
    echo 1. Not authenticated: Run "raindrop auth login"
    echo 2. Network issues: Check internet connection
    echo 3. npx still not working: Try WSL (see WSL-SETUP.md)
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Deployment Successful!
echo ========================================
echo.

echo Getting application status...
call raindrop build status
echo.

echo Getting API URLs...
call raindrop build find
echo.

echo ========================================
echo  Next Steps
echo ========================================
echo.
echo 1. Copy the upload-api URL from above
echo 2. Test: test-api.cmd [YOUR-URL]
echo 3. View logs: raindrop logs tail
echo.

pause
