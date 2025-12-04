@echo off
REM Virtual C-Suite API Test Script
REM Run this from Windows Command Prompt after deployment

echo ========================================
echo Virtual C-Suite API Test Suite
echo ========================================
echo.

REM Check if URL is provided
if "%1"=="" (
    echo ERROR: Please provide your API URL
    echo Usage: test-api.cmd https://your-app-id.raindrop.ai
    exit /b 1
)

set API_URL=%1
echo API URL: %API_URL%
echo.

REM Test 1: Health Check
echo [Test 1] Health Check...
curl -s %API_URL%/health
echo.
echo.

REM Test 2: Upload File
echo [Test 2] Uploading test file...
echo Creating test file...

REM Create test CSV file
echo Product,Revenue,Cost,Units > test-sales.csv
echo Widget A,5000,3000,100 >> test-sales.csv
echo Widget B,3000,2000,75 >> test-sales.csv
echo Widget C,8000,4500,150 >> test-sales.csv

curl -s -X POST %API_URL%/upload -F "file=@test-sales.csv" -F "userId=test-user-123" > upload-response.json
echo.
type upload-response.json
echo.

REM Extract requestId (requires jq or manual copy)
echo.
echo IMPORTANT: Copy the requestId from above
echo.
set /p REQUEST_ID="Enter the requestId: "

if "%REQUEST_ID%"=="" (
    echo No requestId provided. Exiting.
    exit /b 1
)

REM Test 3: Check Status
echo.
echo [Test 3] Checking status...
echo Waiting 3 seconds...
timeout /t 3 /nobreak > nul
curl -s %API_URL%/status/%REQUEST_ID%
echo.

REM Test 4: Wait and check again
echo.
echo [Test 4] Waiting for processing to complete...
echo Checking status every 3 seconds (press Ctrl+C to stop)...
echo.

:status_loop
timeout /t 3 /nobreak > nul
curl -s %API_URL%/status/%REQUEST_ID% > status.json
type status.json
echo.

REM Check if completed (requires manual observation)
findstr /C:"completed" status.json > nul
if %ERRORLEVEL%==0 (
    echo Processing complete!
    goto get_report
)

echo Still processing...
goto status_loop

:get_report
REM Test 5: Get Report
echo.
echo [Test 5] Fetching final report...
curl -s %API_URL%/reports/%REQUEST_ID% > report.json
echo.
echo Report saved to report.json
echo.
echo First 500 characters of report:
type report.json | more
echo.

echo.
echo ========================================
echo Test Suite Complete!
echo ========================================
echo.
echo Files created:
echo - test-sales.csv (test input)
echo - upload-response.json (upload result)
echo - status.json (final status)
echo - report.json (final report)
echo.
echo Review report.json for the full analysis
echo.

pause
