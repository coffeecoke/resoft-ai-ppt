# OnlyOffice 部署说明

## 快速启动

### Windows
```bash
# 双击运行
start-onlyoffice.bat

# 或命令行
docker-compose -f docker-compose.onlyoffice.yml up -d
```

### Linux/Mac
```bash
docker-compose -f docker-compose.onlyoffice.yml up -d
```

## 访问地址

- **编辑器地址**: http://localhost:8080
- **健康检查**: http://localhost:8080/healthcheck

## 环境变量

可在根目录 `.env` 文件中配置：

```bash
# OnlyOffice 端口（默认 8080）
ONLYOFFICE_PORT=8080

# OnlyOffice 数据目录（默认 ../onlyoffice-data）
ONLYOFFICE_DATA_DIR=../onlyoffice-data

# JWT 安全（生产环境建议开启）
JWT_ENABLED=true
JWT_SECRET=your-strong-secret-key
```

## 常用命令

```bash
# 启动服务
docker-compose -f docker-compose.onlyoffice.yml up -d

# 停止服务
docker-compose -f docker-compose.onlyoffice.yml down

# 查看日志
docker-compose -f docker-compose.onlyoffice.yml logs -f

# 重启服务
docker-compose -f docker-compose.onlyoffice.yml restart

# 查看状态
docker-compose -f docker-compose.onlyoffice.yml ps
```

## 资源需求

- **内存**: 建议 4GB+（镜像约 2GB，运行时约 1-2GB）
- **磁盘**: 建议 10GB+（镜像 + 数据 + 日志）

## 生产环境建议

1. **开启 JWT 认证**
   ```yaml
   JWT_ENABLED: "true"
   JWT_SECRET: "your-strong-secret-key"
   ```

2. **使用外部数据库**（替换内置 PostgreSQL）
   ```yaml
   DB_TYPE: postgres
   DB_HOST: your-db-host
   DB_PORT: 5432
   DB_NAME: onlyoffice
   DB_USER: onlyoffice
   DB_PWD: your-db-password
   ```

3. **配置 HTTPS**
   - 使用 Nginx 反向代理
   - 配置 SSL 证书

## 故障排查

### 容器启动失败
```bash
# 查看详细日志
docker-compose -f docker-compose.onlyoffice.yml logs onlyoffice

# 检查端口占用
netstat -ano | findstr 8080
```

### 健康检查失败
- 等待 1-2 分钟让服务完全启动
- 访问 http://localhost:8080/healthcheck 确认

### 编辑器无法加载
- 检查后端 WOPI 接口是否正常
- 确认 `ONLYOFFICE_URL` 环境变量配置正确