#!/bin/bash

# Docker 服务测试脚本
# 使用方法: ./test-docker.sh

set -e

echo "🧪 =========================================="
echo "  Docker 服务测试脚本"
echo "=========================================="

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ 错误: Docker 未运行，请先启动 Docker"
    echo "   macOS: 打开 Docker Desktop"
    echo "   Linux: sudo systemctl start docker"
    exit 1
fi

# 检查服务是否启动
echo ""
echo "📊 检查服务状态..."
if ! docker-compose ps | grep -q "Up"; then
    echo "⚠️  警告: 服务未启动，正在启动服务..."
    docker-compose up -d
    echo "⏳ 等待服务启动..."
    sleep 10
fi

# 显示服务状态
echo ""
echo "📋 服务状态:"
docker-compose ps

# 测试后端
echo ""
echo "🔍 测试后端服务..."
BACKEND_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:5001/health 2>/dev/null || echo -e "\n000")
BACKEND_BODY=$(echo "$BACKEND_RESPONSE" | head -n -1)
BACKEND_CODE=$(echo "$BACKEND_RESPONSE" | tail -n 1)

if [ "$BACKEND_CODE" = "200" ] && [[ "$BACKEND_BODY" == *"ok"* ]]; then
    echo "✅ 后端服务正常"
    echo "   响应: $BACKEND_BODY"
else
    echo "❌ 后端服务异常 (HTTP $BACKEND_CODE)"
    echo "   响应: $BACKEND_BODY"
    echo "   查看日志: docker-compose logs backend"
fi

# 测试前端
echo ""
echo "🔍 测试前端服务..."
FRONTEND_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost/health 2>/dev/null || echo -e "\n000")
FRONTEND_BODY=$(echo "$FRONTEND_RESPONSE" | head -n -1)
FRONTEND_CODE=$(echo "$FRONTEND_RESPONSE" | tail -n 1)

if [ "$FRONTEND_CODE" = "200" ] && [[ "$FRONTEND_BODY" == *"healthy"* ]]; then
    echo "✅ 前端服务正常"
    echo "   响应: $FRONTEND_BODY"
else
    echo "❌ 前端服务异常 (HTTP $FRONTEND_CODE)"
    echo "   响应: $FRONTEND_BODY"
    echo "   查看日志: docker-compose logs frontend"
fi

# 测试网络连接
echo ""
echo "🔍 测试容器网络..."
if docker network inspect aippt-network > /dev/null 2>&1; then
    echo "✅ Docker 网络正常"
else
    echo "❌ Docker 网络异常"
fi

# 检查资源使用
echo ""
echo "📊 资源使用情况:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" aippt-backend aippt-frontend 2>/dev/null || echo "无法获取资源信息"

# 总结
echo ""
echo "=========================================="
echo "✨ 测试完成！"
echo "=========================================="
echo "前端地址: http://localhost"
echo "后端地址: http://localhost:5001"
echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo "=========================================="


