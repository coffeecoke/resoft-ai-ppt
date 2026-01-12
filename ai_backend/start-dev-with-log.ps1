# AI Backend 开发模式启动脚本（带日志保存，支持热重载）
# 使用方法：在 Cursor Terminal 中运行: .\start-dev-with-log.ps1

# 设置编码为 UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 切换到项目目录
Set-Location $PSScriptRoot

# 创建 logs 目录（如果不存在）
$logsDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

# 生成日志文件名（包含日期时间）
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $logsDir "ai_backend_dev_$timestamp.log"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  启动 AI 后端服务（开发模式+日志）" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "当前目录: $PWD" -ForegroundColor Yellow
Write-Host "日志文件: $logFile" -ForegroundColor Yellow
Write-Host "模式: 开发模式（支持热重载）" -ForegroundColor Green
Write-Host ""
Write-Host "正在启动服务..." -ForegroundColor Green
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Gray
Write-Host ""

# 启动服务并同时输出到控制台和日志文件
try {
    # 使用 node --watch 启动开发模式
    node --watch server/app.js 2>&1 | Tee-Object -FilePath $logFile
    
    # 如果服务正常退出，记录到日志
    $exitTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "`n[$exitTime] 服务已停止（正常退出）"
    
} catch {
    # 如果发生错误，记录到日志
    $errorTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $errorMsg = $_.Exception.Message
    Add-Content -Path $logFile -Value "`n[$errorTime] 错误: $errorMsg"
    Write-Host "`n错误: $errorMsg" -ForegroundColor Red
} finally {
    Write-Host "`n日志已保存到: $logFile" -ForegroundColor Cyan
}

