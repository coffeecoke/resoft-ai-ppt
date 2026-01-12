# AI Backend 启动脚本（带日志保存）
# 使用方法：在 Cursor Terminal 中运行: .\start-with-log.ps1

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
$logFile = Join-Path $logsDir "ai_backend_$timestamp.log"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  启动 AI 后端服务（带日志保存）" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "当前目录: $PWD" -ForegroundColor Yellow
Write-Host "日志文件: $logFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "正在启动服务..." -ForegroundColor Green
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Gray
Write-Host ""

# 启动服务并同时输出到控制台和日志文件
# 使用 Start-Process 的 -NoNewWindow 参数在同一个窗口运行
# 使用 Tee-Object 同时输出到控制台和文件

try {
    # 启动 Node.js 服务
    node server/app.js 2>&1 | Tee-Object -FilePath $logFile
    
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

