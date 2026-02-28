# 售前工作台登录系统需求规格说明

**采访日期**: 2026-02-27
**需求背景**: 现有系统无登录功能，需补充完整身份认证体系

---

## 一、核心需求概述

| 维度 | 结论 |
|---|---|
| 用户规模 | 内部员工，50-200人 |
| 认证方式 | 期1：用户名+密码；期2：CAS SSO |
| 角色体系 | 管理员 / 普通用户（两级） |
| 数据隔离 | 全局列表可见全部数据；个人页面只显示本人数据 |
| Token策略 | JWT，8小时过期 |
| 用户创建 | 初期管理员手动创建，后期同步其他系统 |

---

## 二、用户表设计（需要设计）

**结论：必须新增 `users` 表。**
现有 `sessions.created_by`、`ai_model_configs.created_by` 均为 VARCHAR(50) 字符串字段，不是关系型约束，设计上预留了用户ID的位置，但没有关联表。

### 推荐的 `users` 表结构

```prisma
model users {
  id            String    @id @db.VarChar(50)
  username      String    @unique @db.VarChar(100)   // 登录账号
  name          String    @db.VarChar(100)            // 姓名（显示用）
  department    String?   @db.VarChar(100)            // 部门
  email         String?   @unique @db.VarChar(255)   // 可选，备用
  password_hash String?   @db.VarChar(255)           // bcrypt哈希，SSO用户可为空
  role          String    @default("user") @db.VarChar(20)  // "admin" | "user"
  status        String    @default("active") @db.VarChar(20) // "active" | "disabled"

  // 期2：CAS SSO对接
  cas_username  String?   @unique @db.VarChar(100)   // CAS绑定的用户名

  // 审计字段
  last_login_at DateTime?
  login_count   Int       @default(0)
  created_by    String?   @db.VarChar(50)            // 创建人（管理员ID）
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  @@index([role], map: "idx_role")
  @@index([status], map: "idx_status")
  @@index([department], map: "idx_department")
}
```

---

## 三、现有表改造方案

### 3.1 历史数据处理建议

**推荐方案：NULL 视为"系统/公共"数据**

历史数据 `created_by = NULL`，处理策略：
- 全局列表页：`NULL` 数据正常显示（视为公共数据）
- 个人页面：只查 `created_by = 当前用户ID` 的数据，NULL 数据不出现
- 无需数据迁移，逻辑简单，保留历史完整性

> 不推荐归属到管理员账号，因为会导致管理员"个人页面"混入大量历史数据干扰使用

### 3.2 需要新增 `created_by` 字段的表

| 表名 | 当前状态 | 改造方案 |
|---|---|---|
| `documents` | **无** `created_by` 字段 | **新增** `created_by String? @db.VarChar(50)` + 索引 |
| `transcriptions` | **无** `created_by` 字段 | **新增** `created_by String? @db.VarChar(50)` + 索引 |
| `sessions` | **已有** `created_by`（无外键） | 添加软外键约束（可选，或保持现状） |
| `ai_model_configs` | **已有** `created_by`（无外键） | 无需改动，管理员操作记录用 |

### 3.3 新增审计日志表（管理员功能）

```prisma
model audit_logs {
  id          String   @id @db.VarChar(50)
  user_id     String   @db.VarChar(50)   // 操作人
  username    String   @db.VarChar(100)  // 冗余存储（避免用户被删后丢失）
  action      String   @db.VarChar(50)   // "login" | "logout" | "create" | "update" | "delete"
  resource    String   @db.VarChar(50)   // "user" | "document" | "session" | ...
  resource_id String?  @db.VarChar(50)
  detail      Json?                       // 操作详情（前后快照）
  ip_address  String?  @db.VarChar(50)
  user_agent  String?  @db.VarChar(500)
  created_at  DateTime @default(now())

  @@index([user_id], map: "idx_user_id")
  @@index([action], map: "idx_action")
  @@index([resource], map: "idx_resource")
  @@index([created_at], map: "idx_created_at")
}
```

---

## 四、后端实现方案（期1）

### 4.1 新增路由文件结构

```
online-ppt-backend/src/routes/
├── auth.js          // 新增：登录/登出/获取当前用户/修改密码
├── users.js         // 新增：用户管理（仅管理员）
└── ...（现有路由）

online-ppt-backend/src/middleware/
├── auth.js          // 新增：JWT验证中间件
└── adminOnly.js     // 新增：管理员权限中间件
```

### 4.2 API 端点清单

**认证相关（`/auth`）**

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/auth/login` | 公开 | 用户名+密码登录，返回JWT |
| POST | `/auth/logout` | 登录后 | 前端清除token（JWT无状态可选实现） |
| GET | `/auth/me` | 登录后 | 获取当前用户信息 |
| PUT | `/auth/password` | 登录后 | 修改自己密码 |

**用户管理（`/users`，管理员专用）**

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/users` | 管理员 | 用户列表（分页+搜索） |
| POST | `/users` | 管理员 | 创建用户 |
| PUT | `/users/:id` | 管理员 | 编辑用户信息/角色/状态 |
| POST | `/users/:id/reset-password` | 管理员 | 重置密码 |
| DELETE | `/users/:id` | 管理员 | 禁用用户（软删除） |

### 4.3 JWT 设计

```js
// Payload
{
  userId: "xxx",
  username: "zhangsan",
  name: "张三",
  role: "admin" | "user",
  iat: ...,
  exp: ... // now + 8h
}

// 安全要求
// - 签名算法：HS256
// - Secret：从环境变量读取（JWT_SECRET）
// - 不在Payload存储敏感信息（密码哈希等）
```

### 4.4 密码安全

- 哈希算法：bcrypt，salt rounds = 12
- 密码强度要求：最少6位（内部系统，不强制复杂度）
- 初始密码：管理员创建时设置，用户首次登录后建议修改

### 4.5 中间件使用方式

```js
// middleware/adminOnly.js
// 在 authMiddleware 之后使用，检查 req.user.role === 'admin'
// 普通用户访问管理接口时返回 403

// 所有已有路由加上 authMiddleware
router.use(authMiddleware)  // 验证JWT

// 管理员路由额外加
router.use(adminOnly)       // 验证 role === 'admin'

// 个人数据查询：从 req.user.userId 获取当前用户
```

---

## 五、前端实现方案（期1）

### 5.1 新增文件

```
online-ppt-web/src/
├── views/
│   └── Login.vue            // 新增：登录页面
├── stores/
│   └── auth.ts              // 新增：Pinia认证Store
├── router/
│   └── guards.ts            // 新增：路由守卫（beforeEach）
└── services/
    └── authService.ts       // 新增：登录/登出API
```

### 5.2 认证 Store（Pinia）

```ts
// stores/auth.ts
interface AuthState {
  token: string | null        // localStorage持久化
  user: {
    userId: string
    username: string
    name: string
    role: 'admin' | 'user'
  } | null
}
```

### 5.3 个人页面数据过滤

个人页面（我的文档、我的场次、我的转录）查询时，后端接口增加 `my=true` 参数或独立端点：

```
GET /documents?my=true         → WHERE created_by = req.user.userId
GET /sessions?my=true          → WHERE created_by = req.user.userId
GET /transcriptions?my=true    → WHERE created_by = req.user.userId
```

---

## 六、期2：CAS SSO 对接方案

### 对接流程

```
用户点击"企业SSO登录"
→ 前端跳转 GET /auth/cas/login
→ 后端重定向到 CAS Server（携带 service URL）
→ 用户在CAS Server完成认证
→ CAS Server回调 GET /auth/cas/callback?ticket=xxx
→ 后端用ticket向CAS Server验证，获取用户名
→ 查找 users 表中 cas_username 匹配记录
   - 找到：直接登录，返回JWT
   - 未找到：若已有同名username则自动绑定；否则提示"账号未开通"
→ 前端存储JWT，后续流程与期1相同
```

### 所需环境变量（期2新增）

```bash
CAS_SERVER_URL=https://your-cas-server.com
CAS_SERVICE_URL=https://your-app.com/auth/cas/callback
```

---

## 七、实施优先级与工作量

### 期1（用户名+密码）

| 模块 | 工作内容 | 说明 |
|---|---|---|
| 数据库 | 新增users表、audit_logs表；documents/transcriptions加created_by字段 | 1次Prisma迁移 |
| 后端 | auth路由、users路由、JWT中间件、所有现有路由加认证 | 核心工作量 |
| 前端 | 登录页、Pinia auth store、路由守卫、axios拦截器、个人页面过滤 | 较小改动 |

### 期2（CAS SSO）

| 模块 | 工作内容 |
|---|---|
| 后端 | 安装cas-client库，新增2个CAS路由，users表加cas_username字段 |
| 前端 | 登录页新增"企业SSO"按钮 |

---

## 八、待确认遗留问题

1. **CAS Server地址**：期2实施前需提供具体的CAS服务器URL
2. **初始管理员账号**：第一个管理员如何创建（建议通过DB seed脚本）
3. **密码策略**：最少几位？是否需要定期修改提醒？
4. **后端现有API是否全部需要鉴权**：还是部分接口（如健康检查）可匿名访问？
