# Docker 部署指南

## 快速开始

### 1. 准备环境变量文件

复制示例配置文件并修改：

```bash
cp server/.env.example server/.env
```

编辑 `server/.env` 文件，填入你的 Emby 服务器配置：

```env
EMBY_SERVER_URL="https://your-emby-server.com"
EMBY_API_KEY="your-api-key"
EMBY_ADMIN_USERNAME="admin"
EMBY_ADMIN_PASSWORD="your-password"
JWT_SECRET="change-this-to-random-string"
```

### 2. 使用 Docker Compose（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 3. 手动 Docker 运行

```bash
# 构建镜像
./build-local.sh

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/server/.env:/app/.env:ro \
  --name emby-manager \
  emby-manager:latest
```

## 多平台构建

构建支持多个 CPU 架构的镜像：

```bash
# 赋予执行权限
chmod +x build-multiarch.sh

# 构建并推送到 Docker Hub
./build-multiarch.sh v1.0.0

# 或使用默认 latest 标签
./build-multiarch.sh
```

支持的平台：
- `linux/amd64` - x86_64 架构（普通服务器、PC）
- `linux/arm64` - ARM 64位（Apple M1/M2、树莓派4）
- `linux/arm/v7` - ARM 32位（树莓派3）

## 目录结构

```
emby-manager/
├── data/              # 数据库文件（自动创建）
│   └── dev.db
├── server/
│   └── .env          # 环境变量配置（需手动创建）
├── docker-compose.yml
└── Dockerfile
```

## 端口映射

- `3000` - Web 界面和 API

访问地址：
- 前端：http://localhost:3000
- 后端 API：http://localhost:3000/api

## 卷挂载

### 必需挂载

1. **数据库目录**：`./data:/app/data`
   - 持久化 SQLite 数据库
   - 包含用户、CDK、模板等数据

2. **环境变量文件**：`./server/.env:/app/.env:ro`
   - 只读模式挂载
   - 包含敏感配置信息

### 可选挂载

如需自定义前端静态资源：
```yaml
volumes:
  - ./custom-public:/app/public:ro
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `file:/app/data/dev.db` |
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `production` |
| `EMBY_SERVER_URL` | Emby 服务器地址 | - |
| `EMBY_API_KEY` | Emby API 密钥 | - |
| `JWT_SECRET` | JWT 签名密钥 | - |

## 健康检查

容器内置健康检查，每30秒检查一次服务状态：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' emby-manager
```

## 数据备份

### 备份数据库

```bash
# 停止容器
docker-compose down

# 备份数据目录
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 重启容器
docker-compose up -d
```

### 恢复数据库

```bash
# 停止容器
docker-compose down

# 恢复数据
tar -xzf backup-YYYYMMDD.tar.gz

# 重启容器
docker-compose up -d
```

## 更新镜像

```bash
# 拉取最新镜像
docker-compose pull

# 重新创建容器
docker-compose up -d
```

## 故障排查

### 查看日志

```bash
# 实时日志
docker-compose logs -f

# 最近100行
docker-compose logs --tail=100

# 只看错误
docker-compose logs | grep ERROR
```

### 进入容器

```bash
docker exec -it emby-manager sh
```

### 数据库迁移

如果数据库结构有更新，容器启动时会自动执行迁移：

```bash
# 手动执行迁移
docker exec -it emby-manager npx prisma migrate deploy
```

### 重置数据库

```bash
# 停止容器
docker-compose down

# 删除数据库文件
rm -rf data/dev.db*

# 重启容器（会自动创建新数据库）
docker-compose up -d
```

## 性能优化

### 资源限制

在 `docker-compose.yml` 中添加：

```yaml
services:
  emby-manager:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
```

### 日志轮转

```yaml
services:
  emby-manager:
    # ... 其他配置
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 安全建议

1. **更改默认密钥**：修改 `.env` 中的 `JWT_SECRET`
2. **限制网络访问**：使用反向代理（Nginx/Traefik）
3. **启用 HTTPS**：配置 SSL 证书
4. **定期备份**：自动化备份数据库
5. **权限控制**：`.env` 文件设置只读权限

```bash
chmod 600 server/.env
```

## Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 常见问题

### Q: 容器启动失败？
A: 检查 `.env` 文件是否存在且配置正确，查看日志 `docker-compose logs`

### Q: 无法连接到 Emby 服务器？
A: 确认 `EMBY_SERVER_URL` 正确，容器网络可访问 Emby 服务器

### Q: 数据库迁移失败？
A: 删除 `data/` 目录，重新启动容器创建新数据库

### Q: 跨平台镜像如何选择？
A: Docker 会自动选择匹配当前系统架构的镜像

## 联系支持

如遇问题，请查看：
- 项目 Issues: https://github.com/your-repo/issues
- 文档: README.md
