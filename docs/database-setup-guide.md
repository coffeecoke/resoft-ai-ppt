# 数据库配置与团队协作指南

## 目录
1. [数据库创建](#数据库创建)
2. [环境变量配置](#环境变量配置)
3. [团队协作规范](#团队协作规范)
4. [新成员加入流程](#新成员加入流程)
5. [日常开发流程](#日常开发流程)
6. [常见问题](#常见问题)

---

## 数据库创建

### 步骤1: 登录 MySQL

```bash
mysql -u root -p
# 输入你的 root 密码
```

### 步骤2: 创建专用数据库和用户

在 MySQL 命令行中执行:

```sql
-- 1. 创建专用数据库
CREATE DATABASE aippt_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. 创建专用用户(推荐,更安全)
CREATE USER 'aippt_user'@'localhost' IDENTIFIED BY 'aippt_password_2024';

-- 3. 授予权限(只给这个数据库的权限)
GRANT ALL PRIVILEGES ON aippt_db.* TO 'aippt_user'@'localhost';

-- 4. 刷新权限
FLUSH PRIVILEGES;

-- 5. 验证创建
SHOW DATABASES;
SELECT user, host FROM mysql.user WHERE user = 'aippt_user';

-- 6. 退出
EXIT;
```

### 步骤3: 验证数据库

```bash
# 使用新用户登录测试
mysql -u aippt_user -p aippt_db
# 输入密码: aippt_password_2024

# 如果成功进入,说明创建成功
# 可以执行:
SHOW TABLES;
# 应该显示空列表(还没有表)

# 退出
EXIT;
```

### 一键创建脚本

将以下内容保存为 `create-database.sql`:

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS aippt_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER IF NOT EXISTS 'aippt_user'@'localhost' 
  IDENTIFIED BY 'aippt_password_2024';

-- 授予权限
GRANT ALL PRIVILEGES ON aippt_db.* TO 'aippt_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 显示结果
SELECT 'Database created successfully!' AS message;
SHOW DATABASES LIKE 'aippt_db';
```

执行方式:

```bash
mysql -u root -p < create-database.sql
```

---

## 环境变量配置

### 创建 `.env.example` 模板文件

在 `online-ppt-backend/` 目录创建 `.env.example`:

```env
# 数据库配置
# 每个开发者复制此文件为 .env,并修改为自己的配置

DATABASE_URL="mysql://aippt_user:aippt_password@localhost:3306/aippt_db"

# 迁移策略
USE_DATABASE=false          # 是否使用数据库(开发时可以先false)
DUAL_WRITE=false           # 是否双写(数据库+JSON)
KEEP_JSON_BACKUP=true      # 是否保留JSON备份
```

### 配置 `.env` 文件

每个开发者根据自己的数据库配置修改 `.env`:

```env
# 使用专用用户连接(推荐)
DATABASE_URL="mysql://aippt_user:aippt_password_2024@localhost:3306/aippt_db"

# 或使用 root 用户(简单但不推荐生产环境)
# DATABASE_URL="mysql://root:your_root_password@localhost:3306/aippt_db"
```

**注意**: 
- 将 `aippt_password_2024` 改为你设置的密码
- 如果 MySQL 端口不是 3306,修改端口号
- 如果数据库名不同,修改数据库名

### 确保 `.env` 不被提交到 Git

检查 `.gitignore`:

```gitignore
# 环境变量文件
.env
.env.local
.env.*.local

# 但提交模板文件
!.env.example
```

---

## 团队协作规范

### 核心原则

| 项目 | 是否必须一致 | 说明 |
|------|------------|------|
| 数据库名 | ❌ 可以不同 | 每人用自己的本地数据库 |
| 表结构 | ✅ 必须一致 | 通过 Prisma migrations 保证 |
| 数据内容 | ❌ 可以不同 | 各自测试数据 |
| 环境变量 | ❌ 可以不同 | 通过 .env 配置 |
| Schema 文件 | ✅ 必须一致 | 提交到 Git |

### 数据库命名规范

#### 开发环境

```sql
-- 选项1: 带开发者标识(推荐)
aippt_db_dev_zhangsan
aippt_db_dev_lisi

-- 选项2: 带分支名
aippt_db_feature_user_auth
aippt_db_bugfix_thumbnail

-- 选项3: 统一名称(如果只有一个人用)
aippt_db_dev
```

#### 测试/生产环境

```sql
-- 测试环境(共享)
aippt_db_test

-- 生产环境(共享)
aippt_db_prod
```

### 为什么数据库名可以不同?

1. **隔离开发环境** - 互不影响,各自测试
2. **灵活配置** - 可以有不同的数据库名、用户名、密码
3. **表结构一致** - 通过 Prisma migrations 保证
4. **数据独立** - 各自测试数据互不干扰

### 表结构一致性保证

虽然数据库名可以不同,但表结构必须一致,通过 Prisma migrations 保证:

```bash
# 开发者A 创建迁移
npx prisma migrate dev --name add_description_field

# 提交到 Git
git add prisma/migrations/
git commit -m "feat: add description field"

# 开发者B 拉取代码后
git pull

# 应用迁移(自动同步表结构)
npx prisma migrate deploy
```

---

## 新成员加入流程

### 完整步骤

```bash
# 1. 克隆代码
git clone <repository>
cd online-ppt-backend

# 2. 复制环境变量模板
cp .env.example .env

# 3. 创建自己的数据库
mysql -u root -p
```

在 MySQL 中执行:

```sql
-- 创建数据库(使用自己的名字)
CREATE DATABASE aippt_db_dev_yourname CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'aippt_user_yourname'@'localhost' IDENTIFIED BY 'your_password';

-- 授予权限
GRANT ALL PRIVILEGES ON aippt_db_dev_yourname.* TO 'aippt_user_yourname'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

继续在命令行:

```bash
# 4. 修改 .env 文件
# 编辑 .env,修改 DATABASE_URL 为自己的配置
# DATABASE_URL="mysql://aippt_user_yourname:your_password@localhost:3306/aippt_db_dev_yourname"

# 5. 安装依赖
npm install

# 6. 应用所有迁移(同步表结构)
npx prisma migrate deploy

# 7. 生成 Prisma Client
npx prisma generate

# 8. 开始开发
npm run dev
```

### 验证设置

```bash
# 1. 测试数据库连接
npx prisma db pull
# 如果成功,会显示: ✔ Introspected X models

# 2. 查看表结构
npx prisma studio
# 打开浏览器 http://localhost:5555

# 3. 运行应用
npm run dev
```

---

## 日常开发流程

### 拉取代码后

```bash
# 1. 拉取最新代码
git pull

# 2. 应用新的迁移(如果有)
npx prisma migrate deploy

# 3. 更新 Prisma Client
npx prisma generate

# 4. 安装新依赖(如果有)
npm install

# 5. 开始开发
npm run dev
```

### 创建数据库变更

```bash
# 1. 修改 schema.prisma
# 例如:添加新字段 description String?

# 2. 创建迁移
npx prisma migrate dev --name add_description_field

# Prisma 会自动:
# - 生成 SQL 迁移文件
# - 应用到数据库
# - 重新生成 Prisma Client

# 3. 提交代码
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add description field"
git push
```

### 迁移命名规范

```bash
# ✅ 好的命名
npx prisma migrate dev --name add_user_avatar_field
npx prisma migrate dev --name create_thumbnails_table
npx prisma migrate dev --name add_index_on_email
npx prisma migrate dev --name update_document_status_enum

# ❌ 不好的命名
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
npx prisma migrate dev --name change
```

---

## 环境变量管理

### 方案1: 多环境文件(推荐)

```bash
.env.example          # 模板文件(提交到Git)
.env                  # 本地开发(不提交)
.env.test            # 测试环境(不提交)
.env.production      # 生产环境(不提交)
```

### 方案2: 使用环境变量前缀

```env
# .env
DATABASE_URL_DEV="mysql://user:pass@localhost:3306/aippt_dev"
DATABASE_URL_TEST="mysql://user:pass@test-server:3306/aippt_test"
DATABASE_URL_PROD="mysql://user:pass@prod-server:3306/aippt_prod"
```

代码中根据环境选择:

```javascript
const env = process.env.NODE_ENV || 'dev'
const dbUrl = process.env[`DATABASE_URL_${env.toUpperCase()}`]
```

### 方案3: 使用 dotenv-cli

```bash
# 安装
npm install -D dotenv-cli

# 使用
dotenv -e .env.dev -- npm run dev
dotenv -e .env.prod -- npm start
```

---

## 常见问题

### Q1: MySQL 服务未启动

**Windows**:
```bash
# 打开"服务"应用,找到 MySQL,右键启动
# 或使用命令行
net start MySQL80  # MySQL80 是服务名,可能不同
```

**macOS**:
```bash
brew services start mysql
```

**Linux**:
```bash
sudo systemctl start mysql
# 或
sudo service mysql start
```

### Q2: 端口不是 3306

```bash
# 查看 MySQL 端口
mysql -u root -p -e "SHOW VARIABLES LIKE 'port';"
```

修改 `.env` 中的端口号:
```env
DATABASE_URL="mysql://user:pass@localhost:3307/aippt_db"
```

### Q3: 用户权限问题

```sql
-- 检查用户是否存在
SELECT user, host FROM mysql.user;

-- 如果不存在,创建用户
CREATE USER 'aippt_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON aippt_db.* TO 'aippt_user'@'localhost';
FLUSH PRIVILEGES;
```

### Q4: 连接被拒绝

可能原因:
1. MySQL 服务未启动
2. 防火墙阻止端口
3. 用户权限不足
4. 密码错误

检查步骤:
```bash
# 1. 检查服务状态
# Windows: Get-Service MySQL*
# Linux: sudo systemctl status mysql

# 2. 测试连接
mysql -u aippt_user -p aippt_db

# 3. 检查端口
netstat -an | findstr 3306  # Windows
netstat -an | grep 3306     # Linux/Mac
```

### Q5: 数据库同步问题

如果别人直接修改了数据库表结构:

```bash
# 1. 从数据库拉取最新结构
npx prisma db pull

# 2. 重新生成 Prisma Client
npx prisma generate

# 3. 提交更新后的 schema.prisma
git add prisma/schema.prisma
git commit -m "chore: sync database schema"
```

### Q6: 迁移冲突

如果本地和数据库都有修改:

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

## 安全检查清单

### 开发环境

- [ ] 使用专用数据库用户(不是 root)
- [ ] 使用强密码
- [ ] `.env` 文件不提交到 Git
- [ ] `.env.example` 作为模板提交

### 生产环境

- [ ] 使用专用数据库用户
- [ ] 使用强密码(定期更换)
- [ ] 限制用户权限(只给必要的权限)
- [ ] 使用 SSL 连接(如果可能)
- [ ] 定期备份数据库
- [ ] 监控数据库连接

### 权限最小化原则

```sql
-- 只给必要的权限(不推荐给 ALL PRIVILEGES)
GRANT SELECT, INSERT, UPDATE, DELETE ON aippt_db.* TO 'aippt_user'@'localhost';

-- 如果需要创建表(迁移时)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX ON aippt_db.* TO 'aippt_user'@'localhost';
```

---

## 快速参考

### 常用命令

```bash
# 数据库操作
mysql -u root -p                                    # 登录 MySQL
mysql -u aippt_user -p aippt_db                    # 登录指定数据库
CREATE DATABASE aippt_db;                          # 创建数据库
SHOW DATABASES;                                     # 查看所有数据库
USE aippt_db;                                       # 使用数据库

# Prisma 操作
npx prisma migrate dev --name xxx                  # 创建并应用迁移
npx prisma migrate deploy                          # 应用迁移
npx prisma db pull                                 # 从数据库同步
npx prisma generate                                # 生成客户端
npx prisma studio                                  # 打开可视化界面
```

### 环境变量模板

```env
# .env.example
DATABASE_URL="mysql://user:password@localhost:3306/database"
USE_DATABASE=true
DUAL_WRITE=false
KEEP_JSON_BACKUP=true
```

### 数据库连接字符串格式

```
mysql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?[参数]

示例:
mysql://aippt_user:password@localhost:3306/aippt_db
mysql://root:root123@127.0.0.1:3306/aippt_db
mysql://user:pass@remote-server.com:3306/aippt_db?ssl=true
```

---

**文档版本**: v1.0  
**最后更新**: 2025-12-31  
**适用项目**: resoft-ai-ppt

