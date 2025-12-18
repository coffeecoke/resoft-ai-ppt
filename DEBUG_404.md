# 🔍 404 错误调试指南

## ✅ 已修复的配置

nginx 配置已更新为使用 `rewrite` 规则去掉 `/api` 前缀：

```nginx
location /api {
    rewrite ^/api(.*)$ $1 break;
    proxy_pass http://backend:5001;
    # ...
}
```

## 🔄 更新服务

修改 nginx 配置后，**必须重新构建前端镜像**：

```bash
# 方式1: 重新构建前端
docker-compose stop frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend

# 方式2: 使用部署脚本（会重新构建所有服务）
./deploy.sh
```

## 🔍 调试步骤

### 1. 检查后端服务是否正常

```bash
# 检查后端容器状态
docker-compose ps backend

# 检查后端日志
docker-compose logs backend

# 直接测试后端接口
curl http://localhost:5001/health
curl http://localhost:5001/tools/aippt_outline -X POST -H "Content-Type: application/json" -d '{"content":"test"}'
```

### 2. 检查前端容器中的 nginx 配置

```bash
# 进入前端容器
docker-compose exec frontend sh

# 查看 nginx 配置
cat /etc/nginx/conf.d/default.conf

# 测试 nginx 配置
nginx -t

# 退出容器
exit
```

### 3. 检查网络连接

```bash
# 从前端容器测试后端连接
docker-compose exec frontend wget -O- http://backend:5001/health

# 或者使用 curl（如果容器有）
docker-compose exec frontend curl http://backend:5001/health
```

### 4. 查看 nginx 访问日志

```bash
# 查看前端容器日志
docker-compose logs frontend

# 或者进入容器查看 nginx 日志
docker-compose exec frontend tail -f /var/log/nginx/access.log
```

## 📊 请求流程验证

### 正确的请求流程

```
前端请求: /api/tools/aippt_outline
  ↓
nginx location /api 匹配
  ↓
rewrite: /api/tools/aippt_outline → /tools/aippt_outline
  ↓
proxy_pass: http://backend:5001/tools/aippt_outline
  ↓
后端接收: /tools/aippt_outline ✅
```

### 测试命令

```bash
# 测试前端代理
curl http://localhost/api/tools/aippt_outline -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"test","language":"zh","model":"gpt-4o-mini"}'

# 应该转发到后端: http://backend:5001/tools/aippt_outline
```

## 🐛 常见问题

### 问题1: 后端服务未启动

```bash
# 检查后端状态
docker-compose ps

# 如果未运行，启动后端
docker-compose up -d backend

# 查看后端日志
docker-compose logs backend
```

### 问题2: Docker 网络问题

```bash
# 检查网络
docker network ls | grep aippt-network

# 检查容器是否在同一网络
docker network inspect aippt-network
```

### 问题3: nginx 配置未更新

```bash
# 确保重新构建了前端镜像
docker-compose build --no-cache frontend

# 重启前端容器
docker-compose restart frontend
```

### 问题4: 路径不匹配

检查实际请求路径：
- 前端代码：`${SERVER_URL}/tools/...`，其中 `SERVER_URL = '/api'`
- 实际请求：`/api/tools/...`
- nginx 处理后：`/tools/...`
- 后端接收：`/tools/...` ✅

## ✅ 验证配置

运行以下命令验证：

```bash
# 1. 检查后端健康
curl http://localhost:5001/health

# 2. 检查前端代理
curl http://localhost/api/tools/aippt_outline -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"test","language":"zh","model":"gpt-4o-mini"}' \
  -v

# 3. 查看响应头，确认是否转发到后端
```

## 📝 快速修复

如果还是 404，按以下步骤操作：

```bash
# 1. 停止所有服务
docker-compose down

# 2. 重新构建（确保使用最新配置）
docker-compose build --no-cache

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```



