#!/bin/bash

# 本地构建脚本（单平台）

set -e

IMAGE_NAME="emby-manager"
VERSION=${1:-latest}

echo "🚀 Building Docker image for local platform: ${IMAGE_NAME}:${VERSION}"

docker build -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest .

echo "✅ Build completed!"
echo ""
echo "To run the container:"
echo "  docker-compose up -d"
echo ""
echo "Or manually:"
echo "  docker run -d \\"
echo "    -p 3000:3000 \\"
echo "    -v \$(pwd)/data:/app/data \\"
echo "    -v \$(pwd)/server/.env:/app/.env:ro \\"
echo "    --name emby-manager \\"
echo "    ${IMAGE_NAME}:${VERSION}"
