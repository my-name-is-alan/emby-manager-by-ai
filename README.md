# Emby Manager

基于 Vue3 + NaiveUI + Node.js 的 Emby 账户管理系统,支持CDK激活、会员等级管理、自动过期处理等功能。

## ✨ 功能特性

- 🎫 **CDK系统**: 支持CDK激活码管理,包含CDK有效期和会员有效期
- 👥 **会员管理**: 支持永久会员、月卡、年卡等多种会员模板
- 🔄 **自动过期**: 定时任务自动检测并禁用过期账号
- 💳 **账号续费**: 已有账号可使用新CDK续费延期
- 🎬 **媒体展示**: 最新影片、最热播放、继续观看等内容展示
- 🔔 **Webhook集成**: 接收Emby媒体更新通知
- 👑 **管理后台**: CDK、用户、模板的完整管理界面
- 🐳 **Docker支持**: 多平台镜像构建

## 📁 目录结构

```
code-emby-manager/
├── server/                 # 后端项目
│   ├── src/
│   │   ├── routes/        # API路由
│   │   │   ├── auth.ts    # 认证 (登录/注册/续费)
│   │   │   ├── emby.ts    # Emby API代理
│   │   │   ├── cdk.ts     # CDK管理
│   │   │   ├── config.ts  # 系统配置
│   │   │   └── admin.ts   # 管理员操作
│   │   ├── utils/
│   │   │   ├── embyApi.ts # Emby API工具
│   │   │   └── scheduler.ts # 定时任务
│   │   └── index.ts       # 入口文件
│   ├── prisma/
│   │   ├── schema.prisma  # 数据库模型
│   │   └── migrations/    # 数据库迁移
│   ├── package.json
│   └── .env               # 环境变量
├── web/                   # 前端项目
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   │   ├── Login.vue
│   │   │   ├── Activate.vue
│   │   │   ├── Dashboard.vue
│   │   │   └── Admin.vue
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # 状态管理
│   │   └── utils/         # 工具函数
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile             # Docker镜像构建
├── package.json          # 根项目配置
└── README.md

```

## 🚀 快速开始

### 方式一: 一键启动 (推荐)

```bash
# 安装根目录依赖
npm install

# 安装前后端依赖
cd server && npm install && cd ..
cd web && npm install && cd ..

# 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env 填入你的Emby服务器信息

# 初始化数据库
cd server
npx prisma generate
npx prisma db push
cd ..

# 一键启动前后端
npm run dev
```

前端: `http://localhost:5173`  
后端: `http://localhost:3000`

### 方式二: 分别启动

**后端:**
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```

**前端:**
```bash
cd web
npm install
npm run dev
```

### 方式三: Docker 部署

```bash
# 构建镜像
docker build -t emby-manager .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/server/dev.db:/app/dev.db \
  -e EMBY_SERVER_URL="https://your-emby-server/" \
  -e EMBY_API_KEY="your-api-key" \
  -e JWT_SECRET="your-jwt-secret" \
  --name emby-manager \
  emby-manager
```

## ⚙️ 环境变量配置

复制 `server/.env.example` 为 `server/.env` 并修改以下配置:

```env
# 数据库路径
DATABASE_URL="file:./dev.db"

# JWT密钥 (请修改为随机字符串)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# 服务器端口
PORT=3000

# Emby服务器配置
EMBY_SERVER_URL="https://your-emby-server/"
EMBY_API_KEY="your-emby-api-key"
EMBY_ADMIN_USERNAME="lvzy"

# 运行环境
NODE_ENV="development"
```

## 📊 数据库模型

- **User**: 用户账号,包含过期时间、激活状态
- **Cdk**: CDK激活码,包含CDK有效期、会员有效期
- **Template**: 会员模板,包含权限策略和配置
- **MediaItem**: 媒体项目,存储Webhook推送的内容

## 🔧 定时任务

系统自动运行以下定时任务:

- **每日 03:00**: 检查并禁用过期用户
- **每小时**: 额外的过期检查
- **启动时 (延迟5秒)**: 首次过期检查

手动触发: `POST /api/admin/check-expired`

## 📝 核心功能说明

### CDK系统
- `cdkValidDays`: CDK激活码的有效期 (从创建时间开始计算)
- `memberValidDays`: 激活后账号的会员有效期 (0表示永久)

### 账号过期处理
1. 定时任务自动检测过期用户
2. 调用Emby API禁用账号
3. 更新本地数据库 `isActive = false`
4. 登录时验证过期状态,拒绝过期用户登录

### 账号续费
- 已有用户输入用户名+密码+新CDK即可续费
- 未过期账号在原有效期基础上累加
- 已过期账号从当前时间开始计算新有效期
- 自动重新激活被禁用的账号

## 🛠️ 技术栈

**前端:**
- Vue 3 (Composition API)
- Vite
- Naive UI
- UnoCSS
- Vue Router
- Pinia

**后端:**
- Node.js 18+
- Express
- TypeScript
- Prisma ORM
- SQLite
- node-cron
- JWT

## 📄 API文档

主要API端点:

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - CDK激活/续费
- `GET /api/emby/*` - Emby API代理
- `POST /api/webhook/emby` - Emby Webhook接收
- `GET /api/webhook/latest-media` - 获取最新媒体
- `GET /api/cdk` - CDK列表
- `POST /api/cdk` - 创建CDK
- `GET /api/template` - 模板列表
- `POST /api/admin/check-expired` - 手动触发过期检查

## 🔒 默认管理员

默认管理员账号: `lvzy` (使用Emby中配置的密码登录)

## 📦 构建生产版本

```bash
# 构建前端
cd web
npm run build

# 构建后端
cd ../server
npm run build

# 生产环境启动
NODE_ENV=production npm start
```

## 🐛 常见问题

**Q: 数据库文件在哪里?**  
A: 默认位置 `server/dev.db`

**Q: 如何修改管理员账号?**  
A: 修改 `server/.env` 中的 `EMBY_ADMIN_USERNAME`

**Q: 如何配置Emby Webhook?**  
A: 在Emby后台 > Webhooks > 添加 `http://your-server:3000/api/webhook/emby`

**Q: Docker中数据库如何持久化?**  
A: 使用 volume 挂载: `-v $(pwd)/data:/app/dev.db`

## 📖 更多文档

详细技术设计请参考: [DESIGN.md](./DESIGN.md)

## 📄 License

MIT
