# 🧪 本地 Docker 测试指南

本文档介绍如何在本地启动和测试 Docker 服务。

## 📋 前置要求

### 1. 安装 Docker

#### macOS
```bash
# 方式1: 使用 Homebrew
brew install --cask docker

# 方式2: 下载 Docker Desktop
# 访问 https://www.docker.com/products/docker-desktop
# 下载并安装 Docker Desktop for Mac
```

#### Linux (Ubuntu/Debian)
```bash
# 更新包索引
sudo apt-get update

# 安装 Docker
sudo apt-get install docker.io docker-compose

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到 docker 组（可选，避免每次使用 sudo）
sudo usermod -aG docker $USER
# 需要重新登录才能生效
```

#### Windows
```bash
# 下载 Docker Desktop
# 访问 https://www.docker.com/products/docker-desktop
# 下载并安装 Docker Desktop for Windows
```

### 2. 验证安装

```bash
# 检查 Docker 版本
docker --version

# 检查 Docker Compose 版本
docker-compose --version
# 或（新版本）
docker compose version

# 测试 Docker 是否正常工作
docker run hello-world
```

## 🚀 快速开始

### 步骤 1: 准备环境变量

```bash
# 进入项目根目录
cd /Users/tanghuan/Desktop/resoft-ai-ppt项目/resoft-ai-ppt

# 创建 .env 文件（如果不存在）
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ 已创建 .env 文件"
fi

# 编辑 .env 文件，至少配置一个 AI 服务的 API 密钥
# 例如：使用 OpenAI
nano .env
# 或使用其他编辑器
# vim .env
# code .env
```

**最小配置示例：**
```bash
# .env 文件内容（至少配置一个）
OPENAI_API_KEY=sk-your-api-key-here
```

### 步骤 2: 启动服务

#### 方式 1: 使用部署脚本（推荐）

```bash
# 给脚本添加执行权限（如果还没有）
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

#### 方式 2: 手动启动

```bash
# 1. 停止现有容器（如果有）
docker-compose down

# 2. 构建镜像
docker-compose build

# 3. 启动服务（后台运行）
docker-compose up -d

# 4. 查看服务状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f
```

### 步骤 3: 验证服务

```bash
# 检查后端健康状态
curl http://localhost:5001/health

# 预期响应：
# {"status":"ok","timestamp":"2024-12-10T..."}

# 检查前端
curl http://localhost/health

# 预期响应：
# healthy
```

### 步骤 4: 访问应用

- **前端地址：** http://localhost
- **后端 API：** http://localhost:5001
- **后端健康检查：** http://localhost:5001/health

在浏览器中打开 http://localhost 即可访问应用。

## 🔍 测试检查清单

### ✅ 基础检查

- [ ] Docker 已安装并运行
- [ ] `.env` 文件已创建并配置了 API 密钥
- [ ] 端口 80 和 5001 未被占用
- [ ] 服务容器已启动

### ✅ 服务检查

```bash
# 检查容器状态
docker-compose ps

# 应该看到两个服务：
# - aippt-backend (运行中)
# - aippt-frontend (运行中)

# 检查容器日志
docker-compose logs backend
docker-compose logs frontend

# 检查网络
docker network ls | grep aippt-network
```

### ✅ 功能测试

1. **前端访问测试**
   ```bash
   # 在浏览器中打开
   open http://localhost
   # 或
   curl http://localhost
   ```

2. **后端 API 测试**
   ```bash
   # 健康检查
   curl http://localhost:5001/health
   
   # 测试 AI 功能（需要配置 API 密钥）
   curl -X POST http://localhost:5001/tools/aippt_outline \
     -H "Content-Type: application/json" \
     -d '{"content":"测试主题","language":"zh","model":"gpt-4o-mini"}'
   ```

3. **前后端通信测试**
   - 打开前端页面
   - 尝试使用 AI 生成 PPT 功能
   - 检查浏览器控制台是否有错误

## 🛠️ 常用命令

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 查看最近 100 行日志
docker-compose logs --tail=100
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
docker-compose restart frontend

# 停止并重新启动
docker-compose down
docker-compose up -d
```

### 重新构建

```bash
# 重新构建所有镜像
docker-compose build --no-cache

# 重新构建并启动
docker-compose up -d --build

# 只重新构建特定服务
docker-compose build --no-cache backend
docker-compose up -d backend
```

### 进入容器

```bash
# 进入后端容器
docker-compose exec backend sh

# 进入前端容器
docker-compose exec frontend sh

# 查看容器内文件
docker-compose exec backend ls -la /app
```

### 清理资源

```bash
# 停止并删除容器
docker-compose down

# 停止并删除容器、网络、数据卷
docker-compose down -v

# 删除镜像
docker-compose down --rmi all

# 清理所有未使用的 Docker 资源
docker system prune -a
```

## 🐛 故障排查

### 问题 1: 端口被占用

```bash
# 检查端口占用
lsof -i :80
lsof -i :5001

# macOS/Linux
sudo lsof -i :80
sudo lsof -i :5001

# 修改 docker-compose.yml 中的端口映射
# 例如：将 80 改为 8080
ports:
  - "8080:80"
```

### 问题 2: 容器无法启动

```bash
# 查看详细错误日志
docker-compose logs backend
docker-compose logs frontend

# 检查镜像是否构建成功
docker images | grep aippt

# 尝试手动构建
cd online-ppt-backend
docker build -t aippt-backend .
cd ../online-ppt-web
docker build -t aippt-frontend .
```

### 问题 3: 前端无法连接后端

```bash
# 检查后端是否正常运行
curl http://localhost:5001/health

# 检查网络连接
docker network inspect aippt-network

# 检查 Nginx 配置
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

### 问题 4: AI 功能无法使用

```bash
# 检查环境变量是否正确传递
docker-compose exec backend env | grep API_KEY

# 检查后端日志中的错误信息
docker-compose logs backend | grep -i error

# 验证 API 密钥是否正确
# 在 .env 文件中检查配置
cat .env | grep API_KEY
```

### 问题 5: 构建失败

```bash
# 清理 Docker 缓存
docker system prune -a

# 清理构建缓存
docker builder prune -a

# 重新构建（不使用缓存）
docker-compose build --no-cache --pull
```

## 📊 性能监控

### 查看资源使用

```bash
# 查看容器资源使用情况
docker stats

# 查看特定容器
docker stats aippt-backend aippt-frontend
```

### 查看容器信息

```bash
# 查看容器详细信息
docker inspect aippt-backend
docker inspect aippt-frontend

# 查看容器 IP 地址
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' aippt-backend
```

## 🔄 开发模式

如果你需要在开发时频繁修改代码，可以使用以下方式：

### 方式 1: 挂载代码目录（开发模式）

修改 `docker-compose.yml`，添加 volumes 挂载：

```yaml
services:
  backend:
    volumes:
      - ./online-ppt-backend/src:/app/src
      - ./online-ppt-backend/uploads:/app/uploads
    # 注意：需要安装 nodemon 或使用 --watch 模式
```

### 方式 2: 本地开发 + Docker 后端

```bash
# 只启动后端 Docker 服务
docker-compose up -d backend

# 前端在本地运行
cd online-ppt-web
npm run dev

# 前端会通过 Vite 代理连接到 Docker 中的后端
```

## 📝 测试脚本

创建一个简单的测试脚本：

```bash
#!/bin/bash
# test-docker.sh

echo "🧪 开始测试 Docker 服务..."

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose ps

# 测试后端
echo "🔍 测试后端..."
BACKEND_HEALTH=$(curl -s http://localhost:5001/health)
if [[ $BACKEND_HEALTH == *"ok"* ]]; then
  echo "✅ 后端服务正常"
else
  echo "❌ 后端服务异常"
fi

# 测试前端
echo "🔍 测试前端..."
FRONTEND_HEALTH=$(curl -s http://localhost/health)
if [[ $FRONTEND_HEALTH == *"healthy"* ]]; then
  echo "✅ 前端服务正常"
else
  echo "❌ 前端服务异常"
fi

echo "✨ 测试完成！"
```

## 🎯 下一步

测试成功后，你可以：

1. **生产部署：** 参考 `DOCKER_DEPLOY.md` 进行生产环境部署
2. **性能优化：** 根据实际使用情况调整资源配置
3. **监控配置：** 添加日志收集和监控工具
4. **CI/CD：** 配置自动化部署流程

## 📚 相关文档

- [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) - 详细部署文档
- [README_DOCKER.md](./README_DOCKER.md) - 快速部署指南

## 💡 提示

- 首次构建可能需要较长时间（下载依赖和镜像）
- 建议至少配置一个 AI 服务的 API 密钥，否则 AI 功能无法使用
- 开发时可以使用 `docker-compose logs -f` 实时查看日志
- 如果遇到问题，先查看日志：`docker-compose logs`


