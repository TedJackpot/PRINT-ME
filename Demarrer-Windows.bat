@echo off
setlocal
title PRINT ME - application d'etiquettes
cd /d "%~dp0"

echo.
echo   PRINT ME - demarrage...
echo.

where python >nul 2>&1
if %errorlevel%==0 goto :py

where py >nul 2>&1
if %errorlevel%==0 goto :pylauncher

echo   Python 3 n'a pas ete trouve sur cet ordinateur.
echo.
echo   - L'application va s'ouvrir directement dans le navigateur.
echo   - Le mode "Navigateur (fenetre d'impression)" fonctionnera.
echo   - Pour l'impression DIRECTE (sans fenetre), installez Python 3 :
echo       https://www.python.org/downloads/windows/
echo     puis relancez ce fichier.
echo.
start "" "%~dp0index.html"
pause
exit /b 0

:py
python "%~dp0labelprint_server.py"
goto :fin

:pylauncher
py -3 "%~dp0labelprint_server.py"
goto :fin

:fin
echo.
echo   Application arretee.
pause
endlocal
