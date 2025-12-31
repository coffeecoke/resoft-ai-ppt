# Prisma 使用参考手册

## 目录
1. [常用命令](#常用命令)
2. [数据库同步](#数据库同步)
3. [Schema 文件编写](#schema-文件编写)
4. [CRUD 操作](#crud-操作)
5. [关系查询](#关系查询)
6. [事务处理](#事务处理)
7. [团队协作规范](#团队协作规范)
8. [常见问题](#常见问题)

---

## 常用命令

### 初始化和配置

```bash
# 初始化 Prisma
npx prisma init

# 初始化并指定数据库类型
npx prisma init --datasource-provider mysql
npx prisma init --datasource-provider postgresql
```

### 数据库迁移

```bash
# 开发环境:创建迁移并应用
npx prisma migrate dev --name 迁移名称

# 生产环境:只应用迁移(不创建新迁移)
npx prisma migrate deploy

# 重置数据库(删除所有数据并重新应用迁移)
npx prisma migrate reset

# 查看迁移状态
npx prisma migrate status
```

### 数据库同步

```bash
# 从数据库拉取结构到 schema.prisma
npx prisma db pull

# 直接推送 schema 到数据库(不创建迁移文件,仅开发用)
npx prisma db push
```

### 客户端生成

```bash
# 生成 Prisma Client
npx prisma generate

# 查看生成的客户端位置
npx prisma generate --watch  # 监听模式
```

### 可视化工具

```bash
# 打开 Prisma Studio(数据库可视化界面)
npx prisma studio

# 默认地址: http://localhost:5555
```

### 格式化和验证

```bash
# 格式化 schema.prisma
npx prisma format

# 验证 schema.prisma 语法
npx prisma validate
```

---

## 数据库同步

### 场景1: 别人直接修改了数据库表结构

**问题**: DBA 或其他程序直接在数据库执行了 `ALTER TABLE`

**解决方案**:

```bash
# 1. 从数据库拉取最新结构
npx prisma db pull

# 2. 重新生成 Prisma Client
npx prisma generate

# 3. 重启应用
npm run dev
```

**示例**:

```bash
# 数据库中新增了字段
ALTER TABLE documents ADD COLUMN description VARCHAR(500);

# 你的操作
$ npx prisma db pull
✔ Introspected 2 models and wrote them into prisma/schema.prisma

$ npx prisma generate
✔ Generated Prisma Client
```

### 场景2: 你修改了 Schema,需要同步到数据库

**开发环境**:

```bash
# 1. 修改 schema.prisma
# 2. 创建并应用迁移
npx prisma migrate dev --name add_description_field

# Prisma 会自动:
# - 生成 SQL 迁移文件
# - 应用到数据库
# - 重新生成 Prisma Client
```

**生产环境**:

```bash
# 只应用迁移,不创建新迁移
npx prisma migrate deploy
```

### 场景3: 本地和数据库都有修改(冲突)

```bash
# 1. 备份本地修改
cp prisma/schema.prisma prisma/schema.prisma.backup

# 2. 拉取数据库结构
npx prisma db pull

# 3. 手动合并差异
# 对比 schema.prisma 和 schema.prisma.backup

# 4. 创建迁移应用你的修改
npx prisma migrate dev --name merge_changes
```

---

## Schema 文件编写

### 基本结构

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?  @db.Text
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  
  @@index([authorId])
}
```

### 字段类型映射

| Prisma 类型 | MySQL 类型 | 说明 |
|------------|-----------|------|
| String | VARCHAR(191) | 默认长度 |
| String @db.VarChar(500) | VARCHAR(500) | 指定长度 |
| String @db.Text | TEXT | 长文本 |
| Int | INT | 整数 |
| BigInt | BIGINT | 大整数 |
| Float | DOUBLE | 浮点数 |
| Decimal | DECIMAL(65,30) | 精确小数 |
| Boolean | TINYINT(1) | 布尔值 |
| DateTime | DATETIME(3) | 日期时间 |
| Json | JSON | JSON 数据 |
| Bytes | LONGBLOB | 二进制数据 |

### 字段修饰符

```prisma
model Example {
  // 主键
  id        Int      @id @default(autoincrement())
  uuid      String   @id @default(uuid())
  
  // 唯一约束
  email     String   @unique
  
  // 可选字段(允许 NULL)
  name      String?
  
  // 默认值
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt  // 自动更新
  
  // 数据库字段名映射
  firstName String   @map("first_name")
  
  // 索引
  @@index([email])
  @@index([status, createdAt])
  
  // 唯一组合
  @@unique([email, name])
  
  // 表名映射
  @@map("examples")
}
```

### 关系定义

```prisma
// 一对一
model User {
  id      Int      @id
  profile Profile?
}

model Profile {
  id     Int  @id
  userId Int  @unique
  user   User @relation(fields: [userId], references: [id])
}

// 一对多
model User {
  id    Int    @id
  posts Post[]
}

model Post {
  id       Int  @id
  authorId Int
  author   User @relation(fields: [authorId], references: [id])
}

// 多对多
model Post {
  id         Int        @id
  categories Category[]
}

model Category {
  id    Int    @id
  posts Post[]
}

// 级联删除
model Document {
  id         String      @id
  thumbnails Thumbnail[]
}

model Thumbnail {
  id         String   @id
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
}
```

---

## CRUD 操作

### 创建(Create)

```javascript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 创建单条记录
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    name: 'Test User'
  }
})

// 创建并返回指定字段
const user = await prisma.user.create({
  data: { email: 'test@example.com' },
  select: { id: true, email: true }
})

// 创建多条记录
const users = await prisma.user.createMany({
  data: [
    { email: 'user1@example.com' },
    { email: 'user2@example.com' }
  ]
})

// 创建并关联
const post = await prisma.post.create({
  data: {
    title: 'Hello World',
    author: {
      connect: { id: 1 }  // 关联已存在的用户
    }
  }
})

// 创建并同时创建关联
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    posts: {
      create: [
        { title: 'Post 1' },
        { title: 'Post 2' }
      ]
    }
  }
})
```

### 查询(Read)

```javascript
// 查询所有
const users = await prisma.user.findMany()

// 条件查询
const users = await prisma.user.findMany({
  where: {
    email: { contains: '@example.com' },
    name: { not: null },
    createdAt: { gte: new Date('2024-01-01') }
  }
})

// 查询单条
const user = await prisma.user.findUnique({
  where: { id: 1 }
})

const user = await prisma.user.findFirst({
  where: { email: 'test@example.com' }
})

// 查询或抛出异常
const user = await prisma.user.findUniqueOrThrow({
  where: { id: 1 }
})

// 选择字段
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    posts: {
      select: { title: true }
    }
  }
})

// 排序
const users = await prisma.user.findMany({
  orderBy: { createdAt: 'desc' }
})

const users = await prisma.user.findMany({
  orderBy: [
    { status: 'asc' },
    { createdAt: 'desc' }
  ]
})

// 分页
const users = await prisma.user.findMany({
  skip: 10,
  take: 20
})

// 统计
const count = await prisma.user.count()
const count = await prisma.user.count({
  where: { status: 'active' }
})

// 聚合
const result = await prisma.post.aggregate({
  _count: true,
  _avg: { views: true },
  _sum: { views: true },
  _min: { createdAt: true },
  _max: { createdAt: true }
})
```

### 更新(Update)

```javascript
// 更新单条
const user = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'New Name' }
})

// 更新多条
const result = await prisma.user.updateMany({
  where: { status: 'inactive' },
  data: { status: 'active' }
})

// Upsert(存在则更新,不存在则创建)
const user = await prisma.user.upsert({
  where: { email: 'test@example.com' },
  update: { name: 'Updated Name' },
  create: { email: 'test@example.com', name: 'New User' }
})

// 原子操作
const post = await prisma.post.update({
  where: { id: 1 },
  data: {
    views: { increment: 1 },      // 自增
    likes: { decrement: 1 },      // 自减
    tags: { push: 'new-tag' }     // 数组追加
  }
})
```

### 删除(Delete)

```javascript
// 删除单条
const user = await prisma.user.delete({
  where: { id: 1 }
})

// 删除多条
const result = await prisma.user.deleteMany({
  where: { status: 'inactive' }
})

// 删除所有
const result = await prisma.user.deleteMany()
```

---

## 关系查询

### Include(包含关联数据)

```javascript
// 包含关联的 posts
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    posts: true
  }
})

// 嵌套包含
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    posts: {
      include: {
        comments: true
      }
    }
  }
})

// 条件包含
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }
  }
})

// 统计关联数量
const users = await prisma.user.findMany({
  include: {
    _count: {
      select: { posts: true }
    }
  }
})
```

---

## 事务处理

### 顺序事务

```javascript
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { email: 'test@example.com' } }),
  prisma.post.create({ data: { title: 'Hello' } })
])
```

### 交互式事务

```javascript
await prisma.$transaction(async (tx) => {
  // 1. 创建用户
  const user = await tx.user.create({
    data: { email: 'test@example.com' }
  })
  
  // 2. 创建文章
  const post = await tx.post.create({
    data: {
      title: 'Hello',
      authorId: user.id
    }
  })
  
  // 3. 更新统计
  await tx.stats.update({
    where: { id: 1 },
    data: { totalPosts: { increment: 1 } }
  })
})
```

### 乐观锁

```javascript
// 使用版本号
const post = await prisma.post.update({
  where: {
    id: 1,
    version: currentVersion  // 只有版本匹配才更新
  },
  data: {
    title: 'New Title',
    version: { increment: 1 }
  }
})
```

---

## 团队协作规范

### 规范1: 统一使用 Prisma 管理表结构

```bash
# ✅ 正确做法
1. 修改 schema.prisma
2. npx prisma migrate dev --name 描述性名称
3. 提交 schema.prisma 和 migrations/ 到 Git

# ❌ 错误做法
直接在数据库执行 ALTER TABLE
```

### 规范2: 如果必须直接改数据库

```bash
# 改完后立即执行
1. npx prisma db pull           # 同步到 schema.prisma
2. npx prisma generate           # 重新生成客户端
3. 提交更新后的 schema.prisma
4. 通知团队成员
```

### 规范3: 拉取代码后

```bash
# 团队成员拉取代码后执行
npx prisma migrate deploy   # 应用所有待执行的迁移
npx prisma generate          # 更新 Prisma Client
```

### 规范4: 迁移命名规范

```bash
# 好的命名
npx prisma migrate dev --name add_user_avatar_field
npx prisma migrate dev --name create_thumbnails_table
npx prisma migrate dev --name add_index_on_email

# 不好的命名
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
```

---

## 常见问题

### Q1: 如何处理大数据量查询?

```javascript
// 使用游标分页
async function* getAllUsers() {
  let cursor = undefined
  
  while (true) {
    const users = await prisma.user.findMany({
      take: 100,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' }
    })
    
    if (users.length === 0) break
    
    for (const user of users) {
      yield user
    }
    
    cursor = users[users.length - 1].id
  }
}

// 使用
for await (const user of getAllUsers()) {
  console.log(user)
}
```

### Q2: 如何优化查询性能?

```javascript
// 1. 只查询需要的字段
const users = await prisma.user.findMany({
  select: { id: true, email: true }  // 不要用 include: true
})

// 2. 使用索引
// 在 schema.prisma 中添加
@@index([email])
@@index([status, createdAt])

// 3. 批量操作
await prisma.user.createMany({ data: users })  // 而不是循环 create

// 4. 使用原始 SQL(复杂查询)
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE email LIKE ${`%${keyword}%`}
`
```

### Q3: 如何处理 JSON 字段?

```javascript
// Schema 定义
model Document {
  id       String @id
  metadata Json
}

// 查询
const doc = await prisma.document.findUnique({
  where: { id: '1' }
})
console.log(doc.metadata)  // { key: 'value' }

// 创建
await prisma.document.create({
  data: {
    id: '1',
    metadata: { key: 'value', tags: ['a', 'b'] }
  }
})

// 更新
await prisma.document.update({
  where: { id: '1' },
  data: {
    metadata: { ...existingMetadata, newKey: 'newValue' }
  }
})
```

### Q4: 如何连接多个数据库?

```javascript
// prisma/schema.prisma
datasource db1 {
  provider = "mysql"
  url      = env("DATABASE_URL_1")
}

datasource db2 {
  provider = "postgresql"
  url      = env("DATABASE_URL_2")
}

// 需要生成多个客户端,或使用多个 schema 文件
```

### Q5: 生产环境部署注意事项

```bash
# 1. 不要在生产环境使用 migrate dev
# 使用 migrate deploy
npx prisma migrate deploy

# 2. 设置连接池
DATABASE_URL="mysql://user:pass@host:3306/db?connection_limit=10"

# 3. 启用查询日志(调试用)
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
})

# 4. 优雅关闭
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
```

---

## 快速参考

### 环境变量 (.env)

```env
DATABASE_URL="mysql://user:password@localhost:3306/database"
```

### 常用命令速查

```bash
# 开发
npx prisma migrate dev        # 创建并应用迁移
npx prisma db pull            # 从数据库同步
npx prisma generate           # 生成客户端
npx prisma studio             # 打开可视化界面

# 生产
npx prisma migrate deploy     # 应用迁移
npx prisma generate           # 生成客户端

# 工具
npx prisma format             # 格式化 schema
npx prisma validate           # 验证 schema
```

### 查询条件操作符

| 操作符 | 说明 | 示例 |
|--------|------|------|
| equals | 等于 | `{ age: 18 }` |
| not | 不等于 | `{ age: { not: 18 } }` |
| in | 在列表中 | `{ status: { in: ['active', 'pending'] } }` |
| notIn | 不在列表中 | `{ status: { notIn: ['deleted'] } }` |
| lt | 小于 | `{ age: { lt: 18 } }` |
| lte | 小于等于 | `{ age: { lte: 18 } }` |
| gt | 大于 | `{ age: { gt: 18 } }` |
| gte | 大于等于 | `{ age: { gte: 18 } }` |
| contains | 包含 | `{ email: { contains: '@example' } }` |
| startsWith | 开头 | `{ name: { startsWith: 'A' } }` |
| endsWith | 结尾 | `{ name: { endsWith: 'son' } }` |

---

**文档版本**: v1.0  
**最后更新**: 2025-12-31  
**适用于**: Prisma 5.x + MySQL/PostgreSQL

