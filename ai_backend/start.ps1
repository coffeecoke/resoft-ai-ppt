# 文档文本提取器 - 快速启动脚本
# 一键安装依赖并启动服务

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "文档文本提取器 - Web 版" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
Write-Host "正在检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未安装 Node.js，请先安装: https://nodejs.org/" -ForegroundColor Red
    pause
    exit 1
}

# 检查依赖
Write-Host ""
Write-Host "正在检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "未找到依赖，正在安装..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ 依赖安装失败" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "✓ 依赖安装成功" -ForegroundColor Green
} else {
    Write-Host "✓ 依赖已安装" -ForegroundColor Green
}

# 创建必要的目录
Write-Host ""
Write-Host "正在创建目录..." -ForegroundColor Yellow
$dirs = @("output", "uploads", "frontend/css", "frontend/js", "server/routes")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
Write-Host "✓ 目录创建完成" -ForegroundColor Green

# 启动服务
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "正在启动服务..." -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址: http://localhost:3000" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Yellow
Write-Host ""

npm start

