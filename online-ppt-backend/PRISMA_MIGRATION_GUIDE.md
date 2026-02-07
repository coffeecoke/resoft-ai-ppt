# Prisma 迁移操作指南

## ⚠️ 重要：正确的迁移流程

### 标准流程（推荐）

```bash
# 1. 修改 schema.prisma 文件
# 编辑 prisma/schema.prisma，添加或修改模型

# 2. 生成并应用迁移（一步完成）
cd online-ppt-backend
npx prisma migrate dev --name your_migration_name

# 这个命令会：
# - 创建 shadow database（如果不存在）
# - 在 shadow database 中应用所有迁移
# - 比较 shadow database 和 schema 的差异
# - 生成新的迁移文件
# - 应用新迁移到主数据库
# - 生成 Prisma Client
```

### 分步流程（如果需要）

```bash
# 1. 只创建迁移文件（不应用）
npx prisma migrate dev --create-only --name your_migration_name

# 2. 检查迁移文件是否正确
# 查看 prisma/migrations/xxx_your_migration_name/migration.sql

# 3. 应用迁移
npx prisma migrate deploy
# 或者
npx prisma migrate dev
```

## 🔧 常见问题解决

### 问题 1：Shadow Database 错误

**错误信息**：
```
Migration `xxx` failed to apply cleanly to the shadow database.
Table 'xxx_shadow.xxx' doesn't exist
```

**原因**：
- 迁移文件顺序错误（时间戳顺序）
- Shadow database 状态不一致
- 之前的迁移在 shadow database 中失败

**解决方案**：

#### 方案 A：重置 Shadow Database（推荐）

```bash
# 1. 删除 shadow database（如果存在）
# 在 MySQL 中执行：
DROP DATABASE IF EXISTS aippt_db_shadow;

# 2. 重新生成迁移
npx prisma migrate dev --name your_migration_name
```

#### 方案 B：修复迁移顺序

如果迁移文件的时间戳顺序错误：

```bash
# 1. 备份迁移文件
cp -r prisma/migrations prisma/migrations_backup

# 2. 重命名迁移文件，确保顺序正确
# 例如：将 20251231090315 改为 20251231113112（在 init 之后）

# 3. 重置 shadow database
# 4. 重新运行迁移
```

#### 方案 C：跳过 Shadow Database（不推荐，仅紧急情况）

```bash
# 手动创建迁移文件，然后直接执行 SQL
npx prisma migrate dev --create-only --name your_migration_name
# 手动执行 SQL
mysql -u user -p database < prisma/migrations/xxx/migration.sql
npx prisma migrate resolve --applied xxx_your_migration_name
```

### 问题 2：迁移已标记为已应用但未执行

**解决方案**：

```bash
# 1. 检查迁移状态
npx prisma migrate status

# 2. 如果迁移标记为已应用但表不存在，手动执行 SQL
npx prisma db execute --stdin --schema prisma/schema.prisma < prisma/migrations/xxx/migration.sql

# 或者使用 MySQL 客户端
mysql -u user -p database < prisma/migrations/xxx/migration.sql
```

### 问题 3：npm 找不到 cmd.exe

**错误信息**：
```
npm error enoent spawn cmd ENOENT
```

**解决方案**：

```bash
npm config set script-shell "C:\\Windows\\System32\\cmd.exe"
```

## 📋 最佳实践

### 1. 迁移命名规范

```bash
# 使用描述性的名称
npx prisma migrate dev --name add_user_table
npx prisma migrate dev --name add_email_to_users
npx prisma migrate dev --name create_product_catalog
```

### 2. 迁移前检查

```bash
# 1. 检查当前迁移状态
npx prisma migrate status

# 2. 检查 schema 和数据库的差异
npx prisma db pull --print

# 3. 生成迁移前先格式化 schema
npx prisma format
```

### 3. 迁移后验证

```bash
# 1. 检查迁移状态
npx prisma migrate status

# 2. 验证表结构
npx prisma db pull --print

# 3. 生成 Prisma Client
npx prisma generate
```

### 4. 团队协作

```bash
# 1. 提交迁移文件到 Git
git add prisma/migrations/
git commit -m "feat: add dict tables migration"

# 2. 团队成员拉取后
git pull
npx prisma migrate deploy  # 应用新迁移
npx prisma generate         # 重新生成 Client
```

## 🚨 当前项目的问题

### 问题：迁移文件顺序错误

**现状**：
- `20251231090315_add_product_session_tables` - 修改 `documents` 表
- `20251231113111_init` - 创建 `documents` 表

**影响**：
- Shadow database 无法正确应用迁移
- 每次生成新迁移都会报错

**建议修复**：
1. 重命名迁移文件，确保 `init` 在最前面
2. 或者重置 shadow database，让 Prisma 重新应用所有迁移

## 📚 参考资源

- [Prisma Migrate 文档](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Shadow Database 说明](https://www.prisma.io/docs/concepts/components/prisma-migrate/shadow-database)
- [迁移故障排除](https://www.prisma.io/docs/guides/migrate/troubleshooting-development)




