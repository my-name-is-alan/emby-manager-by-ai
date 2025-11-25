# Emby 账户管理系统 - 技术设计文档

## 1. 项目概述 (Project Overview)

本项目旨在构建一个简洁、美观的 Emby 账户管理系统。系统允许管理员通过生成 CDK (激活码) 来分发 Emby 账号，用户可以通过 CDK 自助注册并激活账号。系统与 Emby Server 深度集成，实现账号同步、媒体库展示及播放状态同步。

### 1.1 核心目标
- **自助服务**：游客通过 CDK 注册，自动在 Emby Server 创建同名账号。
- **门户体验**：提供现代化的 Dashboard，展示最新入库、继续观看、最近观看等信息。
- **权限管理**：基于角色的访问控制 (RBAC)，区分管理员和普通用户。
- **美观易用**：使用 Vue3 + NaiveUI + UnoCSS 打造响应式、支持主题切换的现代化 UI。

### 1.2 技术栈 (Tech Stack)

**前端 (Frontend):**
- **框架**: Vue 3 (Composition API)
- **UI 组件库**: Naive UI
- **样式引擎**: UnoCSS
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP 客户端**: Axios / Alova
- **构建工具**: Vite

**后端 (Backend - 建议):**
- **运行时**: Node.js
- **框架**: NestJS 或 Koa/Express (本设计文档基于 Node.js 环境)
- **ORM**: Prisma
- **数据库**: SQLite (轻量级，易部署) 或 PostgreSQL
- **Emby 集成**: Axios (调用 Emby API)

---

## 2. 系统架构 (System Architecture)

### 2.1 架构图
```mermaid
graph TD
    User[用户/游客] -->|HTTPS| Web[前端 Web App (Vue3)]
    Admin[管理员] -->|HTTPS| Web
    
    Web -->|REST API| API[后端 API 服务]
    
    API -->|读写| DB[(本地数据库 SQLite/PG)]
    API -->|API 调用| Emby[Emby Server]
    
    subgraph "本地数据库"
        DB_User[用户表]
        DB_CDK[CDK 表]
        DB_Template[权限模板表]
    end
```

### 2.2 核心流程
1.  **CDK 生成**: 管理员在后台生成 CDK，可指定有效期和关联的 Emby 用户模板（权限配置）。
2.  **用户注册**: 游客在注册页面输入 用户名、密码、CDK。
3.  **账号同步**: 后端验证 CDK 有效性 -> 在本地数据库创建用户 -> 调用 Emby API 创建同名 Emby 用户 -> 应用模板权限。
4.  **Dashboard 展示**: 用户登录后，后端代理请求 Emby API 获取“最新入库”、“继续观看”等数据，保护 Emby Admin Key 不泄露给前端。

---

## 3. 数据库设计 (Database Schema)

使用 Prisma Schema Description Language (PSDL) 描述。

### 3.1 User (用户表)
存储本地登录信息及与 Emby 的关联。

```prisma
model User {
  id          Int      @id @default(autoincrement())
  username    String   @unique
  password    String   // 加密后的密码
  embyId      String?  // 对应 Emby Server 中的 User Id
  role        String   @default("user") // "admin" | "user"
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 关联
  usedCdk     Cdk?     // 用户使用的 CDK
}
```

### 3.2 Cdk (激活码表)
存储激活码及其状态。

```prisma
model Cdk {
  id          Int      @id @default(autoincrement())
  code        String   @unique // 激活码字符串，如 "EMBY-XXXX-YYYY"
  status      String   @default("unused") // "unused" | "used" | "expired"
  validDays   Int      // 有效期天数 (用于设置 Emby 账号过期时间，可选)
  templateId  Int?     // 关联的用户模板 ID
  
  createdById Int      // 创建者 ID
  usedById    Int?     @unique // 使用者 ID
  usedAt      DateTime?
  createdAt   DateTime @default(now())
  
  // 关联
  user        User?    @relation(fields: [usedById], references: [id])
  template    Template? @relation(fields: [templateId], references: [id])
}
```

### 3.3 Template (用户模板表)
存储 Emby 用户的权限配置模板（如：允许访问的库、是否允许转码等）。

```prisma
model Template {
  id          Int      @id @default(autoincrement())
  name        String   // 模板名称，如 "标准用户", "VIP用户"
  policy      String   // JSON 字符串，存储 Emby User Policy
  configuration String // JSON 字符串，存储 Emby User Configuration
  
  cdks        Cdk[]
}
```

---

## 4. API 接口设计 (API Interface)

### 4.1 认证 (Auth)
- `POST /api/auth/login`: 用户登录，返回 JWT。
- `POST /api/auth/register`: 用户注册 (Payload: `username`, `password`, `cdk`)。
- `POST /api/auth/change-password`: 修改密码 (同步修改 Emby 密码)。

### 4.2 CDK 管理 (Admin Only)
- `POST /api/admin/cdk/generate`: 生成 CDK (参数: `count`, `validDays`, `templateId`)。
- `GET /api/admin/cdk`: 获取 CDK 列表。
- `DELETE /api/admin/cdk/:id`: 删除/作废 CDK。

### 4.3 媒体与 Dashboard (Emby Proxy)
为了安全，前端不直接通过 Emby API Key 访问，而是通过后端代理。
- `GET /api/dashboard/latest`: 获取最新入库媒体。
- `GET /api/dashboard/resume`: 获取“继续观看”项目。
- `GET /api/dashboard/views`: 获取媒体库列表 (用于跳转)。
- `GET /api/dashboard/activity`: 获取最近观影记录。

### 4.4 模板管理 (Admin Only)
- `GET /api/admin/templates`: 获取系统预设模板。
- `POST /api/admin/templates/sync`: 从 Emby 现有用户同步配置作为模板。

---

## 5. 前端功能模块设计 (Frontend Modules)

### 5.1 布局与主题 (Layout & Theme)
- **技术**: NaiveUI `NConfigProvider` + UnoCSS。
- **功能**:
    - 全局深色/浅色模式切换。
    - 主题色自定义 (Primary Color)。
    - 侧边栏/顶部导航栏布局 (Admin 使用侧边栏，User 使用顶部导航或门户式布局)。

### 5.2 登录与注册 (Login & Register)
- **界面**: 简洁的卡片式设计，背景可配置为海报墙模糊图。
- **注册**: 包含 CDK 输入框，实时校验 CDK 格式。
- **激活页**: 独立的 `/activate` 路由，用于仅激活账号（如果支持已有账号续期）。

### 5.3 用户 Dashboard (User Dashboard)
- **Hero Section**: 轮播展示最新入库的电影/剧集背景图。
- **继续观看 (Resume)**: 横向滚动卡片，点击直接跳转 Emby 播放页 (Deep Link)。
- **媒体库入口**: 图标展示 (电影、剧集、动漫等)，点击跳转 Emby 对应库。
- **最近观影**: 列表展示用户最近的播放记录。

### 5.4 管理员面板 (Admin Panel)
- **CDK 管理**: 表格展示，支持一键复制 CDK，筛选未使用 CDK。
- **用户管理**: 列表展示，支持禁用用户、重置密码。
- **模板管理**: 从 Emby 拉取现有用户列表，选择一个作为模板保存。

---

## 6. 安全性设计 (Security)

1.  **Emby API Key 保护**: API Key 仅存储在后端环境变量 (`.env`) 中，前端不可见。
2.  **密码安全**: 数据库存储 bcrypt 哈希后的密码。Emby 端密码由后端调用 `UsersService/Password` 接口设置。
3.  **CDK 防爆破**: 注册接口增加速率限制 (Rate Limiting)。
4.  **权限隔离**: 普通用户无法调用 `/api/admin/*` 接口。

## 7. 开发计划 (Development Plan)

1.  **Phase 1: 初始化**: 搭建 Vue3 + Vite + NaiveUI 项目结构，配置 UnoCSS。
2.  **Phase 2: 后端基础**: 搭建 Node.js 服务，连接 SQLite，实现 Emby API 封装。
3.  **Phase 3: 核心业务**: 实现 CDK 生成、注册流程、Emby 账号同步创建。
4.  **Phase 4: Dashboard**: 开发前端 Dashboard 页面，对接媒体数据接口。
5.  **Phase 5: 优化**: 主题切换、UI 细节打磨、移动端适配。
