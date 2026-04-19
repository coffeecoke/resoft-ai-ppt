# AI Backend 启动脚本说明

## 📋 启动方式

### 方式 1：在 Cursor Terminal 中使用 PowerShell（推荐）

#### 生产模式（不带热重载）
```powershell
.\start-with-log.ps1
```

#### 开发模式（带热重载，文件修改自动重启）
```powershell
.\start-dev-with-log.ps1
```

### 方式 2：使用批处理文件（Windows）

双击运行或在 CMD 中执行：
```cmd
start-with-log.bat
```

### 方式 3：使用 npm 脚本（不带日志保存）

```bash
npm start        # 生产模式
npm run dev      # 开发模式（带热重载）
```

## 📁 日志文件位置

所有日志文件保存在 `logs/` 目录下：

- **生产模式日志**：`logs/ai_backend_YYYY-MM-DD_HH-mm-ss.log`
- **开发模式日志**：`logs/ai_backend_dev_YYYY-MM-DD_HH-mm-ss.log`

日志文件名包含启动时间戳，每次启动都会创建新的日志文件，不会覆盖之前的日志。

## 🔍 查看日志

### 实时查看最新日志
```powershell
# PowerShell
Get-Content logs\ai_backend_*.log -Tail 50 -Wait

# 或使用 tail 命令（如果已安装）
tail -f logs\ai_backend_*.log
```

### 查看最近的日志文件
```powershell
# 获取最新的日志文件
$latestLog = Get-ChildItem logs\*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Get-Content $latestLog.FullName -Tail 100
```

## ⚙️ 功能说明

### 日志保存功能
- ✅ 自动保存所有控制台输出（包括标准输出和错误输出）
- ✅ 日志文件包含时间戳，避免覆盖
- ✅ 同时显示在控制台和保存到文件
- ✅ 服务停止时自动记录退出时间

### 开发模式特性
- ✅ 文件修改自动重启（使用 `node --watch`）
- ✅ 实时日志保存
- ✅ 适合开发和调试

### 生产模式特性
- ✅ 标准 Node.js 运行
- ✅ 性能更好
- ✅ 适合生产环境

## 🛠️ 故障排查

### 如果 PowerShell 脚本无法运行

1. **检查执行策略**：
   ```powershell
   Get-ExecutionPolicy
   ```

2. **如果显示 Restricted，需要设置执行策略**：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **或者直接运行**：
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-with-log.ps1
   ```

### 如果日志文件没有创建

1. 检查 `logs/` 目录是否存在
2. 检查是否有写入权限
3. 查看控制台是否有错误信息

## 📝 注意事项

1. **日志文件大小**：日志文件会持续增长，建议定期清理旧日志
2. **磁盘空间**：确保有足够的磁盘空间存储日志
3. **日志轮转**：可以考虑使用日志轮转工具（如 `logrotate`）来管理日志文件大小

## 🗑️ 清理旧日志

```powershell
# 删除 7 天前的日志文件
Get-ChildItem logs\*.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item

# 或删除所有日志（谨慎使用）
Remove-Item logs\*.log
```

