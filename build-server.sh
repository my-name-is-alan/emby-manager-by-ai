#!/bin/bash

# 服务器端构建脚本(使用国内镜像源)

set -e

echo "🚀 开始服务器端构建..."

# 设置 npm 国内镜像
echo "📦 配置 npm 镜像源..."
npm config set registry https://registry.npmmirror.com

# 清理旧的构建缓存
echo "🧹 清理 Docker 缓存..."
docker builder prune -f

# 构建镜像
echo "🏗️  构建 Docker 镜像..."
docker-compose build --no-cache

# 恢复 npm 镜像源(可选)
# npm config set registry https://registry.npmjs.org

echo ""
echo "✅ 构建完成!"
echo ""
echo "启动服务:"
echo "  docker-compose up -d"
echo ""
echo "查看日志:"
echo "  docker-compose logs -f"
