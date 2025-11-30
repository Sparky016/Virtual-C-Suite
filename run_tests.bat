@echo off
title Virtual C-Suite - Test Runner
color 0B

echo ==========================================
echo      Virtual C-Suite Test Runner
echo ==========================================
echo.
echo IMPORTANT: Ensure the Backend is running first!
echo (Double-click start_backend.bat and choose Option 1)
echo.
echo Running automated E2E tests...
echo.

cd raindrop-csuite\virtual-c-suite
call npm test

echo.
echo ==========================================
if %errorlevel% equ 0 (
    color 0A
    echo  TESTS PASSED! :^)
) else (
    color 0C
    echo  TESTS FAILED! :^(
)
echo ==========================================
echo.
pause
