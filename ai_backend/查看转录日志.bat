@echo off
echo ========================================
echo 语音转录服务 - 实时日志监控
echo ========================================
echo.
echo 服务地址: http://localhost:3000/transcription.html
echo 日志文件: terminals\21.txt
echo.
echo 按 Ctrl+C 停止监控
echo ========================================
echo.

powershell -Command "Get-Content 'c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\21.txt' -Wait -Tail 50"

