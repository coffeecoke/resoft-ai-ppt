@echo off
chcp 65001 >nul
echo ========================================
echo   启动 OnlyOffice Document Server
echo ========================================
echo.

REM 检查 Docker 是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

REM 启动服务
echo [信息] 正在启动 OnlyOffice 服务...
docker-compose -f docker-compose.onlyoffice.yml up -d

echo.
echo [完成] OnlyOffice 服务已启动
echo.
echo   访问地址: http://localhost:8080
echo   健康检查: http://localhost:8080/healthcheck
echo.
echo   停止命令: docker-compose -f docker-compose.onlyoffice.yml down
echo   查看日志: docker-compose -f docker-compose.onlyoffice.yml logs -f
echo.
pause