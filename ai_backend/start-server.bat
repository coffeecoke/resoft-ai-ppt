@echo off
chcp 65001 >nul
echo.
echo ====================================
echo    启动 AI 后端服务
echo ====================================
echo.

cd /d E:\dev-chat-ppt\ai_backend

echo 当前目录: %cd%
echo.
echo 正在启动服务...
echo.

node server/app.js

pause
