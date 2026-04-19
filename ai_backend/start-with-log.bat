@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ====================================
echo    启动 AI 后端服务（带日志保存）
echo ====================================
echo.

cd /d "%~dp0"

REM 创建 logs 目录（如果不存在）
if not exist "logs" mkdir logs

REM 生成日志文件名（包含日期时间）
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set timestamp=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%
set logfile=logs\ai_backend_%timestamp%.log

echo 当前目录: %cd%
echo 日志文件: %logfile%
echo.
echo 正在启动服务...
echo 按 Ctrl+C 停止服务
echo.

REM 启动服务并同时输出到控制台和日志文件
REM 使用 PowerShell 的 Tee-Object 命令
powershell -Command "node server/app.js 2>&1 | Tee-Object -FilePath '%logfile%'"

REM 记录退出时间
echo. >> "%logfile%"
echo [%date% %time%] 服务已停止 >> "%logfile%"

echo.
echo 日志已保存到: %logfile%
pause

