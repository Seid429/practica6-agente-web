@echo off
title Agente BD - Sakila
set "LOG=%~dp0iniciar.log"
echo ==== %date% %time% ==== > "%LOG%"

if not exist "%~dp0ai-backend\server.js" (
  echo No se encontro ai-backend\server.js junto a iniciar.bat
  pause
  exit /b 1
)
cd /d "%~dp0ai-backend"

where node >nul 2>nul
if errorlevel 1 if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js NO esta instalado. Descargalo de https://nodejs.org ^(LTS^) y vuelve a abrir iniciar.bat
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Se creo ai-backend\.env - ahi va tu API key de OpenRouter.
)

rem Instala dependencias si faltan (mysql2 es la mas nueva)
if not exist "node_modules\mysql2" (
  echo Instalando dependencias, espera un momento...
  call npm install --no-audit --no-fund >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo.
    echo  Fallo npm install. Detalle:
    type "%LOG%"
    pause
    exit /b 1
  )
)

echo.
echo El chat se abrira en http://localhost:3000
echo NO cierres esta ventana mientras uses el chat. Para detenerlo: Ctrl + C
echo.
start "" /b cmd /c "timeout /t 3 /nobreak >nul & explorer http://localhost:3000"
call npm start
pause
