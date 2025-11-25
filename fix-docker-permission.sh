#!/bin/bash

# 修复 Docker 权限问题的脚本

echo "🔧 修复 Docker 权限问题..."

# 方案1: 添加当前用户到 docker 组
echo "方案1: 添加用户到 docker 组"
sudo usermod -aG docker $USER
echo "✅ 已添加,需要重新登录生效"

# 方案2: 修复 Docker socket 权限
echo ""
echo "方案2: 修复 Docker socket 权限"
sudo chmod 666 /var/run/docker.sock
echo "✅ 权限已修复"

# 方案3: 重启 Docker 服务
echo ""
echo "方案3: 重启 Docker 服务"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "macOS 系统,请手动重启 Docker Desktop"
elif command -v systemctl &> /dev/null; then
    # Linux with systemd
    sudo systemctl restart docker
    echo "✅ Docker 服务已重启"
else
    # Linux without systemd
    sudo service docker restart
    echo "✅ Docker 服务已重启"
fi

echo ""
echo "🎯 建议执行顺序:"
echo "1. 如果是权限问题,执行方案1后重新登录"
echo "2. 如果是临时问题,执行方案2即可"
echo "3. 如果还不行,执行方案3重启服务"
echo ""
echo "然后重新构建: docker-compose build --no-cache"
