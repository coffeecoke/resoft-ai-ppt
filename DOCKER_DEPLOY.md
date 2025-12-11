# Docker 部署指南

本文档介绍如何使用Docker部署RSAiPPT前后端应用。

## 📋 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0
- 至少2GB可用内存
- AI API密钥（至少配置一个AI服务提供商）

## 🚀 快速开始

### 1. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑.env文件，填入你的AI API密钥
# 至少需要配置一个AI服务提供商的密钥
nano .env  # 或使用你喜欢的编辑器
```

**重要：** 至少需要配置一个AI服务提供商的API密钥，否则AI功能将无法使用。

### 2. 构建并启动服务

```bash
# 构建并启动所有服务（后台运行）
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 3. 访问应用

- **前端地址：** http://localhost
- **后端健康检查：** http://localhost:5001/health

## 📁 项目结构

```
resoft-ai-ppt/
├── docker-compose.yml          # Docker Compose配置
├── .env                        # 环境变量配置（需创建）
├── .env.example               # 环境变量示例
├── online-ppt-web/            # 前端项目
│   ├── Dockerfile             # 前端Dockerfile
│   ├── nginx.conf             # Nginx配置
│   └── .dockerignore          # Docker忽略文件
└── online-ppt-backend/        # 后端项目
    ├── Dockerfile             # 后端Dockerfile
    └── .dockerignore          # Docker忽略文件
```

## 🔧 配置说明

### 端口配置

- **前端：** 80端口（可在docker-compose.yml中修改）
- **后端：** 5001端口（可在docker-compose.yml中修改）

如需修改端口，编辑`docker-compose.yml`：

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # 修改为8080端口
  backend:
    ports:
      - "5002:5001"  # 修改为5002端口
```

### AI服务配置

支持以下AI服务提供商：

1. **OpenAI** (GPT-4o, GPT-4o-mini, GPT-4-turbo)
2. **智谱AI** (GLM-4-Flash, GLM-4.5-Flash, GLM-4-Plus)
3. **豆包** (ark-doubao-seed-1.6-flash, doubao-pro-32k)
4. **通义千问** (qwen-turbo, qwen-plus, qwen-max)
5. **DeepSeek** (deepseek-chat)
6. **月之暗面** (moonshot-v1-8k, moonshot-v1-32k)

在`.env`文件中配置对应服务的API密钥即可。

## 🛠️ 常用命令

### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 启动特定服务
docker-compose up -d frontend
docker-compose up -d backend
```

### 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f frontend
docker-compose logs -f backend
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart frontend
docker-compose restart backend
```

### 重新构建

```bash
# 重新构建所有镜像
docker-compose build --no-cache

# 重新构建并启动
docker-compose up -d --build
```

### 进入容器

```bash
# 进入前端容器
docker-compose exec frontend sh

# 进入后端容器
docker-compose exec backend sh
```

## 🔍 故障排查

### 1. 服务无法启动

```bash
# 查看服务状态
docker-compose ps

# 查看详细日志
docker-compose logs backend
docker-compose logs frontend
```

### 2. 端口被占用

```bash
# 检查端口占用
netstat -tulpn | grep 80
netstat -tulpn | grep 5001

# 修改docker-compose.yml中的端口映射
```

### 3. AI功能无法使用

- 检查`.env`文件中是否配置了API密钥
- 检查API密钥是否正确
- 查看后端日志：`docker-compose logs backend`

### 4. 前端无法访问后端

- 检查后端服务是否正常运行：`docker-compose ps`
- 检查后端健康检查：`curl http://localhost:5001/health`
- 查看Nginx配置是否正确代理到后端

### 5. 构建失败

```bash
# 清理Docker缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache
```

## 📊 健康检查

### 后端健康检查

```bash
curl http://localhost:5001/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 前端健康检查

```bash
curl http://localhost/health
```

预期响应：
```
healthy
```

## 🔒 安全建议

1. **生产环境部署：**
   - 使用HTTPS（配置SSL证书）
   - 修改默认端口
   - 使用强密码保护API密钥
   - 配置防火墙规则

2. **环境变量安全：**
   - 不要将`.env`文件提交到Git
   - 使用Docker secrets或环境变量管理工具
   - 定期轮换API密钥

3. **Nginx安全配置：**
   - 配置限流
   - 启用HTTPS
   - 配置安全头（已在nginx.conf中配置）

## 📈 性能优化

1. **启用Gzip压缩：** 已在nginx.conf中配置
2. **静态资源缓存：** 已在nginx.conf中配置
3. **调整Docker资源限制：** 在docker-compose.yml中添加：

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 🌐 生产环境部署

### 使用Nginx反向代理（推荐）

如果你已经有Nginx服务器，可以只部署后端，前端通过Nginx代理：

```nginx
# Nginx配置示例
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端API代理
    location /api {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 使用Docker Swarm或Kubernetes

对于大规模部署，建议使用Docker Swarm或Kubernetes进行编排。

## 📝 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

## 🆘 获取帮助

如果遇到问题，请：

1. 查看日志：`docker-compose logs -f`
2. 检查服务状态：`docker-compose ps`
3. 查看本文档的故障排查部分
4. 提交Issue到项目仓库

## 📄 许可证

MIT License


