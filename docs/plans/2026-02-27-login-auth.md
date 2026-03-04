# 登录认证系统 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为售前工作台添加 JWT 用户名+密码登录系统，包含管理员/普通用户两级角色，个人页面仅显示本人数据。

**Architecture:** 后端新增 `users` / `audit_logs` 表，使用 `bcryptjs` 哈希密码，`jsonwebtoken` 签发 8 小时 JWT。Express 中间件统一验证 token 并注入 `req.user`，`/health` 与 `/tools/models` 保持公开。前端在 Pinia auth store 中管理 token，axios request 拦截器自动附加 `Authorization` 头，fetch 流式调用同样携带 header，路由守卫拦截未登录访问。

**Tech Stack:** Node.js ES Modules · Express · Prisma/MySQL · `jsonwebtoken` · `bcryptjs` · Vue 3 · Pinia 3 · Vue Router 4

---

## 前置说明

- 后端目录：`online-ppt-backend/`，ES Modules（`"type":"module"`）
- 前端目录：`online-ppt-web/`，Vue 3 + TypeScript
- Pinia store 目录：`src/store/`（非 `src/stores/`）
- 现有路由全部挂载在 `src/index.js`，无现成 middleware 目录
- 公开接口（无需登录）：`GET /health`、`GET /tools/models`
- 历史数据 `created_by = NULL` 保留，视为公共数据，不出现在个人页面

---

## Task 1: 安装后端依赖

**Files:**
- Modify: `online-ppt-backend/package.json`（npm 自动更新）

**Step 1: 安装依赖**

```bash
cd online-ppt-backend
npm install jsonwebtoken bcryptjs
```

**Step 2: 验证安装**

```bash
node -e "import('jsonwebtoken').then(m => console.log('jwt ok')); import('bcryptjs').then(m => console.log('bcrypt ok'))"
```

Expected：两行 `ok` 输出，无报错。

**Step 3: Commit**

```bash
cd online-ppt-backend
git add package.json package-lock.json
git commit -m "chore: 安装 jsonwebtoken bcryptjs 依赖"
```

---

## Task 2: Prisma Schema — 新增 users / audit_logs 表及 created_by 字段

**Files:**
- Modify: `online-ppt-backend/prisma/schema.prisma`

在 `schema.prisma` 末尾**追加**以下内容（在 `presales_analysis_results` 模型之后）：

```prisma
// ==================== 用户认证相关表 ====================

/// 用户表
model users {
  id            String    @id @db.VarChar(50)
  username      String    @unique @db.VarChar(100)  /// 登录账号
  name          String    @db.VarChar(100)           /// 姓名（显示用）
  department    String?   @db.VarChar(100)           /// 部门
  email         String?   @unique @db.VarChar(255)  /// 邮箱（可选）
  password_hash String?   @db.VarChar(255)          /// bcrypt哈希，SSO用户可为空
  role          String    @default("user") @db.VarChar(20)   /// "admin" | "user"
  status        String    @default("active") @db.VarChar(20) /// "active" | "disabled"
  cas_username  String?   @unique @db.VarChar(100)  /// 期2 CAS SSO绑定账号
  last_login_at DateTime?
  login_count   Int       @default(0)
  created_by    String?   @db.VarChar(50)            /// 创建人ID
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  @@index([role], map: "idx_users_role")
  @@index([status], map: "idx_users_status")
  @@index([department], map: "idx_users_department")
}

/// 审计日志表
model audit_logs {
  id          String   @id @db.VarChar(50)
  user_id     String   @db.VarChar(50)
  username    String   @db.VarChar(100)  /// 冗余存储，防止用户被删后丢失
  action      String   @db.VarChar(50)   /// "login" | "logout" | "create" | "update" | "delete"
  resource    String   @db.VarChar(50)   /// "user" | "document" | "session" | ...
  resource_id String?  @db.VarChar(50)
  detail      Json?                       /// 操作详情
  ip_address  String?  @db.VarChar(50)
  user_agent  String?  @db.VarChar(500)
  created_at  DateTime @default(now())

  @@index([user_id], map: "idx_audit_user_id")
  @@index([action], map: "idx_audit_action")
  @@index([resource], map: "idx_audit_resource")
  @@index([created_at], map: "idx_audit_created_at")
}
```

同时在 `documents` 模型（第14行附近）的 `view_count` 字段**之后**添加：

```prisma
  created_by     String?   @db.VarChar(50) /// 创建人用户ID
```

并在 `documents` 的 `@@index` 块中添加：

```prisma
  @@index([created_by], map: "idx_created_by")
```

在 `transcriptions` 模型的 `created_at` 字段之前添加：

```prisma
  created_by    String?   @db.VarChar(50) /// 创建人用户ID
```

并在 `transcriptions` 的 `@@index` 块中添加：

```prisma
  @@index([created_by], map: "idx_transcription_created_by")
```

---

## Task 3: 执行 Prisma 迁移

**Files:**
- Auto-generated: `online-ppt-backend/prisma/migrations/`

**Step 1: 生成迁移文件**

```bash
cd online-ppt-backend
npx prisma migrate dev --name add_auth_users_audit_logs
```

Expected：`Your database is now in sync with your schema.` 无报错。

**Step 2: 重新生成 Prisma Client**

```bash
npx prisma generate
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: Prisma迁移 - 新增users/audit_logs表，documents/transcriptions加created_by字段"
```

---

## Task 4: 管理员种子脚本

**Files:**
- Create: `online-ppt-backend/prisma/seed-admin.js`

```js
// online-ppt-backend/prisma/seed-admin.js
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import pkg from '@prisma/client'
const { PrismaClient } = pkg
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.users.findFirst({ where: { role: 'admin' } })
  if (existing) {
    console.log('✅ 管理员账号已存在:', existing.username)
    return
  }

  const password = process.env.ADMIN_INIT_PASSWORD || 'Admin@123'
  const hash = await bcrypt.hash(password, 12)

  const admin = await prisma.users.create({
    data: {
      id: randomUUID(),
      username: process.env.ADMIN_INIT_USERNAME || 'admin',
      name: '系统管理员',
      role: 'admin',
      status: 'active',
      password_hash: hash,
    },
  })

  console.log('✅ 管理员账号创建成功:')
  console.log('   用户名:', admin.username)
  console.log('   密码:', password)
  console.log('   ⚠️  请登录后立即修改密码')
}

main()
  .catch(e => { console.error('❌ 创建失败:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

**Step 1: 运行 seed 脚本**

```bash
cd online-ppt-backend
node prisma/seed-admin.js
```

Expected：输出 `✅ 管理员账号创建成功: admin` 及初始密码。

**Step 2: Commit**

```bash
git add prisma/seed-admin.js
git commit -m "feat: 新增管理员初始化种子脚本"
```

---

## Task 5: 后端 — auth 中间件

**Files:**
- Create: `online-ppt-backend/src/middleware/auth.js`
- Create: `online-ppt-backend/src/middleware/adminOnly.js`

**Step 1: 创建 JWT 验证中间件**

```js
// online-ppt-backend/src/middleware/auth.js
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'resoft-ppt-secret-change-in-production'

export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' })
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload  // { userId, username, name, role }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token已过期，请重新登录' })
    }
    return res.status(401).json({ error: 'Token无效' })
  }
}
```

**Step 2: 创建管理员权限中间件**

```js
// online-ppt-backend/src/middleware/adminOnly.js
export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '权限不足，需要管理员权限' })
  }
  next()
}
```

**Step 3: Commit**

```bash
git add src/middleware/
git commit -m "feat: 新增JWT验证中间件和管理员权限中间件"
```

---

## Task 6: 后端 — 认证路由（登录/个人信息/修改密码）

**Files:**
- Create: `online-ppt-backend/src/routes/auth.js`

```js
// online-ppt-backend/src/routes/auth.js
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'resoft-ppt-secret-change-in-production'
const JWT_EXPIRES = '8h'

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' })
    }

    const user = await prisma.users.findUnique({ where: { username } })
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: '用户名或密码错误' })
    }
    if (!user.password_hash) {
      return res.status(401).json({ error: '该账号不支持密码登录' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const payload = { userId: user.id, username: user.username, name: user.name, role: user.role }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    // 更新最后登录时间
    await prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date(), login_count: { increment: 1 } },
    })

    // 记录审计日志
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: user.id,
        username: user.username,
        action: 'login',
        resource: 'auth',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']?.slice(0, 500),
      },
    })

    res.json({
      token,
      user: { userId: user.id, username: user.username, name: user.name, role: user.role, department: user.department },
    })
  } catch (err) {
    console.error('[登录] 错误:', err)
    res.status(500).json({ error: '登录失败，请稍后重试' })
  }
})

// GET /auth/me  — 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.userId },
      select: { id: true, username: true, name: true, department: true, role: true, status: true, last_login_at: true },
    })
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

// POST /auth/logout  — 前端清除 token 即可，服务端记录日志
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'logout',
        resource: 'auth',
        ip_address: req.ip,
      },
    })
  } catch (_) { /* 日志失败不影响登出 */ }
  res.json({ message: '已登出' })
})

// PUT /auth/password  — 修改自己的密码
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请提供旧密码和新密码' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' })
    }

    const user = await prisma.users.findUnique({ where: { id: req.user.userId } })
    if (!user?.password_hash) return res.status(400).json({ error: '该账号不支持密码修改' })

    const valid = await bcrypt.compare(oldPassword, user.password_hash)
    if (!valid) return res.status(400).json({ error: '旧密码错误' })

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.users.update({ where: { id: user.id }, data: { password_hash: hash } })

    res.json({ message: '密码修改成功' })
  } catch (err) {
    res.status(500).json({ error: '密码修改失败' })
  }
})

export default router
```

**Step 1: Commit**

```bash
git add src/routes/auth.js
git commit -m "feat: 新增认证路由（登录/登出/获取用户/修改密码）"
```

---

## Task 7: 后端 — 用户管理路由（管理员专用）

**Files:**
- Create: `online-ppt-backend/src/routes/users.js`

```js
// online-ppt-backend/src/routes/users.js
import express from 'express'
import bcrypt from 'bcryptjs'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { authMiddleware } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'

const router = express.Router()
const prisma = new PrismaClient()

// 所有 /users 路由都需要登录 + 管理员权限
router.use(authMiddleware, adminOnly)

// GET /users  — 用户列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword = '' } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const where = keyword
      ? { OR: [{ username: { contains: keyword } }, { name: { contains: keyword } }] }
      : {}

    const [total, list] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { created_at: 'desc' },
        select: { id: true, username: true, name: true, department: true, role: true, status: true, last_login_at: true, login_count: true, created_at: true },
      }),
    ])
    res.json({ total, list, page: Number(page), pageSize: Number(pageSize) })
  } catch (err) {
    res.status(500).json({ error: '获取用户列表失败' })
  }
})

// POST /users  — 创建用户
router.post('/', async (req, res) => {
  try {
    const { username, name, department, role = 'user', password } = req.body
    if (!username || !name || !password) {
      return res.status(400).json({ error: 'username、name、password 为必填项' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' })
    }

    const exists = await prisma.users.findUnique({ where: { username } })
    if (exists) return res.status(409).json({ error: '用户名已存在' })

    const hash = await bcrypt.hash(password, 12)
    const user = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        username,
        name,
        department,
        role,
        status: 'active',
        password_hash: hash,
        created_by: req.user.userId,
      },
      select: { id: true, username: true, name: true, department: true, role: true, status: true, created_at: true },
    })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'create',
        resource: 'user',
        resource_id: user.id,
        detail: { username, name, role },
        ip_address: req.ip,
      },
    })

    res.status(201).json(user)
  } catch (err) {
    res.status(500).json({ error: '创建用户失败' })
  }
})

// PUT /users/:id  — 修改用户信息
router.put('/:id', async (req, res) => {
  try {
    const { name, department, role, status } = req.body
    const updated = await prisma.users.update({
      where: { id: req.params.id },
      data: { name, department, role, status },
      select: { id: true, username: true, name: true, department: true, role: true, status: true },
    })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'update',
        resource: 'user',
        resource_id: updated.id,
        detail: { name, department, role, status },
        ip_address: req.ip,
      },
    })

    res.json(updated)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '用户不存在' })
    res.status(500).json({ error: '修改用户失败' })
  }
})

// POST /users/:id/reset-password  — 重置密码
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' })
    }
    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.users.update({ where: { id: req.params.id }, data: { password_hash: hash } })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'reset-password',
        resource: 'user',
        resource_id: req.params.id,
        ip_address: req.ip,
      },
    })

    res.json({ message: '密码重置成功' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '用户不存在' })
    res.status(500).json({ error: '重置密码失败' })
  }
})

// DELETE /users/:id  — 禁用用户（软删除）
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: '不能禁用自己的账号' })
    }
    await prisma.users.update({ where: { id: req.params.id }, data: { status: 'disabled' } })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'disable',
        resource: 'user',
        resource_id: req.params.id,
        ip_address: req.ip,
      },
    })

    res.json({ message: '用户已禁用' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '用户不存在' })
    res.status(500).json({ error: '禁用用户失败' })
  }
})

export default router
```

**Step 1: Commit**

```bash
git add src/routes/users.js
git commit -m "feat: 新增用户管理路由（管理员CRUD）"
```

---

## Task 8: 注册新路由 + 为现有路由加认证

**Files:**
- Modify: `online-ppt-backend/src/index.js`

**Step 1: 在 index.js 的 import 区块末尾添加新路由的 import**

在现有最后一个 import 行（`import { setupThumbnailProgressWS } ...`）之后添加：

```js
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import { authMiddleware } from './middleware/auth.js'
```

**Step 2: 在路由挂载区块进行修改**

将路由挂载部分替换为以下内容（在 `// 路由 - 按业务模块区分` 注释处）：

```js
// 认证路由 — 公开，无需登录
app.use('/auth', authRouter)
app.use('/users', usersRouter)

// 公开路由例外 —— /health 和 /tools/models 不需要登录
// 对 /tools 只放行 /tools/models，其余需要认证
app.get('/tools/models', (req, res, next) => next()) // 透传，不加中间件

// 全局认证中间件：除公开路由外，所有路由需要登录
// 用排除法：精确排除已注册的公开路由，其余走 authMiddleware
app.use((req, res, next) => {
  // 公开白名单
  const publicPaths = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/tools/models' },
  ]
  const isPublic = publicPaths.some(
    p => p.method === req.method && req.path === p.path
  )
  if (isPublic) return next()
  return authMiddleware(req, res, next)
})

// 路由 - 按业务模块区分
app.use('/tools', toolsRouter)
app.use('/aippt', aipptChatRouter)
app.use('/images', imagesRouter)
app.use('/translate', translateRouter)
app.use('/templates', templatesRouter)
app.use('/documents', documentsRouter)
app.use('/thumbnails', thumbnailsRouter)
app.use('/thumbnail-tasks', thumbnailTasksRouter)
app.use('/sales', salesRouter)
app.use('/admin', adminRouter)
```

**Step 3: 验证服务启动**

```bash
cd online-ppt-backend
npm run dev
```

Expected：服务正常启动，无 import 错误。

**Step 4: 验证公开接口**

```bash
curl http://localhost:5001/health
curl http://localhost:5001/tools/models
```

Expected：两个接口返回正常 JSON（无需 token）。

**Step 5: 验证保护接口**

```bash
curl http://localhost:5001/documents
```

Expected：`{"error":"未登录，请先登录"}` HTTP 401。

**Step 6: 验证登录接口**

```bash
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

Expected：返回 `{"token":"eyJ...","user":{...}}`。

**Step 7: 验证 token 访问**

```bash
TOKEN=$(curl -s -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).token)")

curl http://localhost:5001/documents -H "Authorization: Bearer $TOKEN"
```

Expected：返回文档列表（HTTP 200）。

**Step 8: Commit**

```bash
git add src/index.js
git commit -m "feat: 全局JWT认证中间件，/health和/tools/models保持公开"
```

---

## Task 9: 环境变量 — 添加 JWT_SECRET

**Files:**
- Modify: `online-ppt-backend/.env`（本地开发）
- Modify: `online-ppt-backend/.env.example`（如存在）

在 `.env` 文件中添加：

```bash
# JWT 认证
JWT_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
```

> ⚠️ 生产环境使用随机长字符串，可用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成。

**Step 1: Commit（不含 .env 本身，只提交 .env.example）**

```bash
# .env 已在 .gitignore，只提交示例文件
git add .env.example 2>/dev/null || true
git commit -m "docs: 添加 JWT_SECRET 环境变量说明" --allow-empty
```

---

## Task 10: 前端 — Pinia Auth Store

**Files:**
- Create: `online-ppt-web/src/store/auth.ts`
- Modify: `online-ppt-web/src/store/index.ts`

**Step 1: 创建 auth store**

```ts
// online-ppt-web/src/store/auth.ts
import { defineStore } from 'pinia'

export interface AuthUser {
  userId: string
  username: string
  name: string
  role: 'admin' | 'user'
  department?: string
}

export interface AuthState {
  token: string | null
  user: AuthUser | null
}

const TOKEN_KEY = 'resoft_auth_token'
const USER_KEY = 'resoft_auth_user'

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem(TOKEN_KEY),
    user: (() => {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
    })(),
  }),

  getters: {
    isLoggedIn: (state): boolean => !!state.token && !!state.user,
    isAdmin: (state): boolean => state.user?.role === 'admin',
  },

  actions: {
    setAuth(token: string, user: AuthUser) {
      this.token = token
      this.user = user
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    },

    clearAuth() {
      this.token = null
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})
```

**Step 2: 在 store/index.ts 中导出 useAuthStore**

在 `index.ts` 末尾添加：

```ts
import { useAuthStore } from './auth'
export { useAuthStore }
```

**Step 3: Commit**

```bash
cd online-ppt-web
git add src/store/auth.ts src/store/index.ts
git commit -m "feat: 新增 Pinia auth store，管理 JWT token 和用户信息"
```

---

## Task 11: 前端 — 认证 Service + Axios/Fetch 拦截器

**Files:**
- Create: `online-ppt-web/src/services/authService.ts`
- Modify: `online-ppt-web/src/services/config.ts`
- Modify: `online-ppt-web/src/services/index.ts`

**Step 1: 创建 authService.ts**

```ts
// online-ppt-web/src/services/authService.ts
import axios from './config'
import { SERVER_URL } from './index'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    userId: string
    username: string
    name: string
    role: 'admin' | 'user'
    department?: string
  }
}

export const authService = {
  login(payload: LoginPayload): Promise<LoginResponse> {
    return axios.post(`${SERVER_URL}/auth/login`, payload)
  },

  logout(): Promise<void> {
    return axios.post(`${SERVER_URL}/auth/logout`)
  },

  getMe(): Promise<{ id: string; username: string; name: string; role: string; department?: string }> {
    return axios.get(`${SERVER_URL}/auth/me`)
  },

  changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
    return axios.put(`${SERVER_URL}/auth/password`, { oldPassword, newPassword })
  },
}
```

**Step 2: 修改 config.ts — 添加请求拦截器（自动附加 Authorization）**

在 `instance.interceptors.response.use(...)` 之前添加请求拦截器：

```ts
// 在 const instance = axios.create({...}) 之后，response interceptor 之前添加：
instance.interceptors.request.use(
  config => {
    const token = localStorage.getItem('resoft_auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)
```

同时在 response 拦截器的 error 处理中，在 `if (error && error.response)` 前添加 401 处理：

```ts
    // 401：token 过期或无效，清除本地认证信息并跳转登录
    if (error?.response?.status === 401) {
      localStorage.removeItem('resoft_auth_token')
      localStorage.removeItem('resoft_auth_user')
      // 避免在登录页循环跳转
      if (!window.location.hash.includes('/login')) {
        window.location.hash = '/login'
      }
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }
```

**Step 3: 修改 services/index.ts — fetch 流式调用加入 Authorization**

在 `index.ts` 顶部添加获取 token 的辅助函数：

```ts
// 在 import axios from './config' 之后，export const SERVER_URL 之前添加：
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('resoft_auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
```

将所有 `fetch()` 调用的 `headers` 部分合并 auth header：

- `AIPPT_Outline` 中的 `headers`:
```ts
headers: {
  'Content-Type': 'application/json',
  ...getAuthHeaders(),
},
```

- `AIPPT` 中的 `headers`:
```ts
headers: {
  'Content-Type': 'application/json',
  ...getAuthHeaders(),
},
```

- `AI_Writing` 中的 `headers`:
```ts
headers: {
  'Content-Type': 'application/json',
  ...getAuthHeaders(),
},
```

- `aipptChat` 中的 `headers`:
```ts
headers: {
  'Content-Type': 'application/json',
  ...getAuthHeaders(),
},
```

**Step 4: Commit**

```bash
git add src/services/authService.ts src/services/config.ts src/services/index.ts
git commit -m "feat: authService，axios/fetch自动携带JWT token，401自动跳登录页"
```

---

## Task 12: 前端 — 登录页面

**Files:**
- Create: `online-ppt-web/src/views/Login.vue`

```vue
<!-- online-ppt-web/src/views/Login.vue -->
<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1>售前工作台</h1>
        <p>请登录以继续</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        size="large"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            :prefix-icon="User"
            autocomplete="username"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            style="width: 100%"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'
import { authService } from '@/services/authService'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({ username: '', password: '' })

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  errorMsg.value = ''
  try {
    const res = await authService.login({ username: form.username, password: form.password })
    authStore.setAuth(res.token, {
      userId: res.user.userId,
      username: res.user.username,
      name: res.user.name,
      role: res.user.role,
      department: res.user.department,
    })
    // 登录成功后跳转到原目标页，或默认首页
    const redirect = (route.query.redirect as string) || '/sales/home'
    router.push(redirect)
  } catch (err: any) {
    errorMsg.value = err?.message || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}

.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px;
}

.login-header p {
  color: #909399;
  margin: 0;
}

.error-msg {
  color: #f56c6c;
  text-align: center;
  margin-top: 8px;
  font-size: 14px;
}
</style>
```

**Step 1: Commit**

```bash
git add src/views/Login.vue
git commit -m "feat: 新增登录页面（Element Plus表单）"
```

---

## Task 13: 前端 — 路由注册 + 路由守卫

**Files:**
- Modify: `online-ppt-web/src/router/index.ts`

**Step 1: 添加 /login 路由**

在 `routes` 数组的**最前面**添加（在 `path: '/'` 对象之前）：

```ts
{
  path: '/login',
  name: 'Login',
  component: () => import('@/views/Login.vue'),
  meta: { title: '登录', public: true },
},
```

**Step 2: 添加路由守卫**

在 `router.afterEach(...)` 之后，`export default router` 之前添加：

```ts
import { useAuthStore } from '@/store/auth'

router.beforeEach((to, _from, next) => {
  // 公开路由直接放行
  if (to.meta.public) return next()

  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) {
    // 携带 redirect 参数，登录后回跳
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }
  next()
})
```

**Step 3: 验证**

启动前端开发服务器：

```bash
cd online-ppt-web
npm run dev
```

浏览器访问 `http://localhost:5173`，应自动跳转到 `/#/login`。

输入正确账号密码，应跳转到 `/#/sales/home`。

刷新页面后，应保持登录状态（localStorage 中有 token）。

**Step 4: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: 添加登录路由和路由守卫，未登录自动跳转/login"
```

---

## Task 14: 前端 — 个人页面数据过滤（后端改造）

> 此任务为后续扩展项，核心认证功能完成后再实施。

**需要改造的路由（后端）：**

在以下路由的 handler 中，当收到 `?my=true` 时，添加 `where: { created_by: req.user.userId }` 过滤条件：

| 路由文件 | 端点 | 说明 |
|---|---|---|
| `routes/documents.js` | `GET /documents` | 我的文档 |
| `routes/sales.js` | `GET /sales/sessions` 或对应接口 | 我的展示场次 |
| `routes/sales.js` | `GET /sales/transcriptions` 或对应接口 | 我的转录记录 |

**前端调用示例：**

```ts
// 我的文档页
documentService.getDocuments({ my: true, ... })
```

---

## 完成后验证清单

- [ ] `POST /auth/login` 返回 JWT
- [ ] `GET /health` 无 token 可访问
- [ ] `GET /tools/models` 无 token 可访问
- [ ] `GET /documents` 无 token 返回 401
- [ ] `GET /documents` 带 token 返回数据
- [ ] `POST /users` 普通用户调用返回 403
- [ ] `POST /users` 管理员调用可创建用户
- [ ] 前端未登录访问任意页面跳转到 `/login`
- [ ] 前端登录成功后跳转到原目标页
- [ ] 刷新页面保持登录状态（token 在 localStorage）
- [ ] 前端 fetch 流式接口（AI生成）携带 Authorization header
- [ ] Token 过期后前端自动跳转登录页
