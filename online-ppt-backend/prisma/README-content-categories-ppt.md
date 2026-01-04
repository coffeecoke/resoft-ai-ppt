# PPT 内容分类标签初始化指南

## 📋 概述

本文档说明如何初始化 PPT 内容分类标签数据。分类标签用于对 PPT 页面内容进行分类标记，采用二级分类体系：
- **一级分类**：6 个主要分类
- **二级分类**：23 个具体分类

## 🗂️ 分类体系

### 一级分类（6个）

1. **企业信息** (`enterprise_info`)
2. **合作案例** (`cooperation_cases`)
3. **监管政策与行业背景** (`regulatory_policy_industry`)
4. **产品解决方案** (`product_solutions`)
5. **部署实施及售后保障** (`deployment_after_sales`)
6. **其他** (`other`)

### 二级分类（23个）

每个一级分类下包含多个二级分类，详见 `seed-content-categories-ppt.js` 文件。

## 🚀 初始化步骤

### 步骤 1：执行数据库迁移

首先，需要创建 `content_categories_ppt` 表：

```bash
# 方式1：使用 Prisma Migrate（推荐）
cd online-ppt-backend
npx prisma migrate deploy

# 或者方式2：手动执行 SQL
# 查看 migration 文件：prisma/migrations/20260103194021_add_content_categories_ppt/migration.sql
# 在数据库中手动执行该 SQL 文件
```

### 步骤 2：执行数据初始化脚本

```bash
cd online-ppt-backend
node prisma/seed-content-categories-ppt.js
```

### 步骤 3：验证数据

执行完成后，脚本会输出：
```
✅ 创建一级分类: 企业信息 (enterprise_info)
  ✅ 创建二级分类: 企业基础信息 (enterprise_basic_info)
  ✅ 创建二级分类: 企业资质认证 (enterprise_qualification)
  ...
🎉 PPT 内容分类标签数据初始化完成！
📊 统计: 6 个一级分类, 23 个二级分类
```

### 步骤 4：检查数据库

可以通过以下方式验证数据：

```sql
-- 查看一级分类
SELECT * FROM content_categories_ppt WHERE level = 1 ORDER BY sort_order;

-- 查看二级分类
SELECT * FROM content_categories_ppt WHERE level = 2 ORDER BY sort_order;

-- 查看完整树形结构
SELECT 
  c1.name AS level1_name,
  c1.code AS level1_code,
  c2.name AS level2_name,
  c2.code AS level2_code
FROM content_categories_ppt c1
LEFT JOIN content_categories_ppt c2 ON c2.parent_id = c1.id
WHERE c1.level = 1
ORDER BY c1.sort_order, c2.sort_order;
```

## 📝 文件说明

### 1. Schema 定义

**文件**：`prisma/schema.prisma`

包含 `content_categories_ppt` 表的 Prisma Schema 定义。

### 2. Migration 文件

**文件**：`prisma/migrations/20260103194021_add_content_categories_ppt/migration.sql`

包含创建表的 SQL 语句。

### 3. Seed 脚本

**文件**：`prisma/seed-content-categories-ppt.js`

包含所有分类数据的初始化脚本，包括：
- 6 个一级分类
- 23 个二级分类
- 每个分类的完整判断标准（description 字段）

## 🔄 重新初始化

如果需要重新初始化数据（清空后重新插入）：

```bash
# 方式1：手动清空表（谨慎操作）
# 在数据库中执行：TRUNCATE TABLE content_categories_ppt;

# 方式2：修改 seed 脚本，取消注释清空数据的代码
# 然后重新执行：node prisma/seed-content-categories-ppt.js
```

## 📊 数据结构

### 表结构

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | VARCHAR(50) | 主键，UUID |
| parent_id | VARCHAR(50) | 父分类ID（一级分类为NULL） |
| name | VARCHAR(100) | 分类名称 |
| code | VARCHAR(100) | 分类编码（唯一，英文） |
| level | INT | 层级：1-一级，2-二级 |
| description | TEXT | 判断标准/描述 |
| sort_order | INT | 排序顺序 |
| is_active | BOOLEAN | 是否启用 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 索引

- `code` 字段有唯一索引
- `parent_id`、`level`、`sort_order`、`is_active` 有普通索引

## 🔗 相关文档

- **接口文档**：`docs/api/ppt/content-category.md`
- **数据库 Schema**：`prisma/schema.prisma`
- **API README**：`docs/api/ppt/README.md`

## ⚠️ 注意事项

1. **分类编码唯一性**：`code` 字段必须唯一，用于程序判断和 AI 自动分类
2. **判断标准完整性**：每个分类的 `description` 字段包含完整的判断标准，用于 AI 自动分类
3. **层级关系**：二级分类的 `parent_id` 必须指向有效的一级分类ID
4. **排序顺序**：`sort_order` 字段控制分类的显示顺序
5. **启用状态**：`is_active` 字段控制分类是否可用，已禁用的分类默认不返回

## 🐛 常见问题

### Q1: 执行 seed 脚本时报错 "Table doesn't exist"

**A**: 需要先执行数据库迁移，创建表结构。

```bash
npx prisma migrate deploy
```

### Q2: 执行 seed 脚本时报错 "Duplicate entry"

**A**: 数据已经存在，如果需要重新初始化，先清空表：

```sql
TRUNCATE TABLE content_categories_ppt;
```

### Q3: 如何更新分类的判断标准？

**A**: 可以直接更新数据库：

```sql
UPDATE content_categories_ppt 
SET description = '新的判断标准...' 
WHERE code = 'enterprise_basic_info';
```

或者通过管理后台更新（待开发）。

## 📞 技术支持

如有问题，请联系：
- **后端负责人**：待定
- **数据库管理员**：待定

---

**最后更新**：2026-01-03

