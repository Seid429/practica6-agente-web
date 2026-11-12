@echo off
title Practica 6 - Agente IA
cd /d "%~dp0ai-backend"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js NO esta instalado en esta computadora.
  echo  Instalalo desde https://nodejs.org ^(version LTS^), cierra esta ventana
  echo  y vuelve a hacer doble clic en iniciar.bat
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias ^(express, cors, dotenv, openai^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Fallo la instalacion. Revisa tu conexion a internet e intenta de nuevo.
    pause
    exit /b 1
  )
)

echo.
echo Abriendo el chat en el navegador...
start "" "%~dp0ai-frontend\index.html"

echo Iniciando el servidor. NO cierres esta ventana mientras uses el chat.
echo Para detenerlo presiona Ctrl + C.
echo.
call npm start
pause
