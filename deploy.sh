#!/bin/bash

# RSAiPPT Docker 部署脚本
# 使用方法: ./deploy.sh

set -e

echo "=========================================="
echo "  RSAiPPT Docker 部署脚本"
echo "=========================================="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未找到Docker，请先安装Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 错误: 未找到Docker Compose，请先安装Docker Compose"
    exit 1
fi

# 检查.env文件是否存在
if [ ! -f .env ]; then
    echo "⚠️  警告: 未找到.env文件"
    echo "📝 正在从.env.example创建.env文件..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ 已创建.env文件，请编辑并填入你的API密钥"
        echo "   编辑命令: nano .env 或 vim .env"
        read -p "按Enter键继续，或Ctrl+C取消..."
    else
        echo "❌ 错误: 未找到.env.example文件"
        exit 1
    fi
fi

# 停止现有容器
echo ""
echo "🛑 停止现有容器..."
docker-compose down 2>/dev/null || true

# 构建镜像
echo ""
echo "🔨 构建Docker镜像..."
docker-compose build --no-cache

# 启动服务
echo ""
echo "🚀 启动服务..."
docker-compose up -d

# 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态:"
docker-compose ps

# 健康检查
echo ""
echo "🏥 健康检查..."
echo "后端健康检查:"
curl -s http://localhost:5001/health || echo "❌ 后端服务未响应"
echo ""
echo "前端健康检查:"
curl -s http://localhost/health || echo "❌ 前端服务未响应"

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo "前端地址: http://localhost"
echo "后端地址: http://localhost:5001"
echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo "=========================================="


