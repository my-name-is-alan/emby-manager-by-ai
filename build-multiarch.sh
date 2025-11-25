#!/bin/bash

# 多平台构建脚本
# 支持 linux/amd64, linux/arm64, linux/arm/v7

set -e

IMAGE_NAME="emby-manager"
VERSION=${1:-latest}

echo "🚀 Building multi-architecture Docker image: ${IMAGE_NAME}:${VERSION}"

# 检查是否已创建 buildx builder
if ! docker buildx inspect multiarch-builder > /dev/null 2>&1; then
    echo "📦 Creating buildx builder..."
    docker buildx create --name multiarch-builder --use
    docker buildx inspect --bootstrap
else
    echo "✅ Using existing buildx builder"
    docker buildx use multiarch-builder
fi

# 构建多平台镜像
echo "🏗️  Building for multiple platforms..."
docker buildx build \
    --platform linux/amd64,linux/arm64,linux/arm/v7 \
    -t ${IMAGE_NAME}:${VERSION} \
    -t ${IMAGE_NAME}:latest \
    --push \
    .

echo "✅ Multi-architecture build completed!"
echo ""
echo "To pull the image:"
echo "  docker pull ${IMAGE_NAME}:${VERSION}"
echo ""
echo "Supported platforms:"
echo "  - linux/amd64 (x86_64)"
echo "  - linux/arm64 (ARM 64-bit, e.g., Apple M1/M2, Raspberry Pi 4)"
echo "  - linux/arm/v7 (ARM 32-bit, e.g., Raspberry Pi 3)"
