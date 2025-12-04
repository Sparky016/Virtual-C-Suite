@echo off
REM Virtual C-Suite - Deployment Script
REM Run this from Windows Command Prompt

echo ========================================
echo  Virtual C-Suite - Raindrop Deployment
echo ========================================
echo.

echo Step 1: Checking current directory...
cd /d "%~dp0"
echo Current directory: %CD%
echo.

echo Step 2: Building TypeScript...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo Build successful!
echo.

echo Step 3: Deploying to Raindrop...
echo This will take 2-5 minutes...
echo.
raindrop build deploy --start
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Deployment failed!
    pause
    exit /b 1
)
echo.

echo ========================================
echo  Deployment Complete!
echo ========================================
echo.

echo Step 4: Checking status...
raindrop build status
echo.

echo Step 5: Getting API URLs...
raindrop build find
echo.

echo ========================================
echo  Next Steps
echo ========================================
echo.
echo 1. Copy the URL from the "upload-api" service above
echo 2. Run: test-api.cmd [YOUR-URL]
echo 3. Or manually test with curl
echo.

pause
