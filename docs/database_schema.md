# Resoft AI PPT 数据库表结构设计文档

> 基于源码功能溯源分析，设计完整的数据库表结构，用于替代现有的JSON文件存储方案

**版本**: v1.0  
**创建时间**: 2025-12-30  
**数据库类型**: PostgreSQL / MySQL 兼容

---

## 📋 目录

1. [设计原则](#设计原则)
2. [表结构清单](#表结构清单)
3. [核心业务表](#核心业务表)
4. [售前平台表](#售前平台表)
5. [系统管理表](#系统管理表)
6. [索引设计](#索引设计)
7. [数据迁移方案](#数据迁移方案)

---

## 设计原则

### 1. 字段命名规范
- 表名：小写+下划线，复数形式（如 `templates`, `documents`）
- 字段名：小写+下划线（如 `created_at`, `customer_name`）
- 主键：统一使用 `id`，类型为 `BIGINT UNSIGNED AUTO_INCREMENT` 或 `SERIAL`
- 外键：格式为 `{表名}_id`（如 `template_id`, `document_id`）

### 2. 通用字段
所有表都包含以下字段：
- `id` - 主键
- `created_at` - 创建时间
- `updated_at` - 更新时间
- `deleted_at` - 软删除时间（可为NULL）
- `reserved_field_1` - 备用字段1
- `reserved_field_2` - 备用字段2
- `reserved_field_3` - 备用字段3

### 3. 状态字段
- 使用 `ENUM` 类型或 `VARCHAR` 存储状态值
- 常见状态：`draft`（草稿）、`published`（已发布）、`archived`（已归档）

### 4. JSON字段
- 大型JSON数据（如slides数组）存储在 `TEXT` 或 `JSON` 类型字段
- 元数据使用 `JSON` 类型便于查询和索引

---

## 表结构清单

| 序号 | 表名 | 说明 | 优先级 |
|------|------|------|--------|
| 1 | `templates` | 模板表 | ⭐⭐⭐⭐⭐ |
| 2 | `template_data` | 模板数据表（大JSON） | ⭐⭐⭐⭐⭐ |
| 3 | `documents` | 文档表 | ⭐⭐⭐⭐⭐ |
| 4 | `document_data` | 文档数据表（大JSON） | ⭐⭐⭐⭐⭐ |
| 5 | `thumbnails` | 预览图表 | ⭐⭐⭐ |
| 6 | `products` | 产品表 | ⭐⭐⭐ |
| 7 | `qa` | 问答表 | ⭐⭐⭐ |
| 8 | `materials` | 物料表 | ⭐⭐ |
| 9 | `users` | 用户表 | ⭐⭐⭐⭐ |
| 10 | `ai_generation_history` | AI生成历史表 | ⭐⭐⭐ |
| 11 | `image_cache` | 图片缓存表 | ⭐⭐ |
| 12 | `document_tags` | 文档标签关联表 | ⭐⭐ |
| 13 | `template_categories` | 模板分类表 | ⭐⭐ |

**总计**: 13张表

---

## 核心业务表

### 1. 模板表 (templates)

**用途**: 存储模板元信息

```sql
CREATE TABLE `templates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '模板ID',
  `template_id` VARCHAR(50) NOT NULL COMMENT '模板业务ID（如template_1）',
  `name` VARCHAR(200) NOT NULL COMMENT '模板名称',
  `cover` VARCHAR(500) DEFAULT NULL COMMENT '封面图URL',
  `category` VARCHAR(50) DEFAULT NULL COMMENT '分类：business/education/creative',
  `origin` VARCHAR(50) DEFAULT 'user' COMMENT '来源：official/community/user',
  `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' COMMENT '状态',
  `slide_count` INT UNSIGNED DEFAULT 0 COMMENT '页面数量',
  `file_size` BIGINT UNSIGNED DEFAULT 0 COMMENT '文件大小（字节）',
  `created_by` BIGINT UNSIGNED DEFAULT NULL COMMENT '创建人ID（关联users.id）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_template_id` (`template_id`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板表';
```

**字段说明**:
- `template_id`: 业务ID，格式为 `template_1`, `template_2` 等，保持与现有系统兼容
- `cover`: 封面图URL，可以是相对路径或绝对URL
- `status`: 草稿可物理删除，已发布模板软删除

---

### 2. 模板数据表 (template_data)

**用途**: 存储模板完整JSON数据（slides数组等）

```sql
CREATE TABLE `template_data` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `template_id` VARCHAR(50) NOT NULL COMMENT '模板业务ID（关联templates.template_id）',
  `title` VARCHAR(200) DEFAULT NULL COMMENT '模板标题',
  `width` INT UNSIGNED DEFAULT 1000 COMMENT '画布宽度',
  `height` DECIMAL(10,2) DEFAULT 562.50 COMMENT '画布高度',
  `theme` JSON DEFAULT NULL COMMENT '主题配置JSON',
  `slides` LONGTEXT NOT NULL COMMENT '幻灯片数组JSON（完整数据）',
  `version` INT UNSIGNED DEFAULT 1 COMMENT '数据版本号',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_template_id` (`template_id`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板数据表';
```

**字段说明**:
- `slides`: 存储完整的幻灯片数组JSON，使用 `LONGTEXT` 类型支持大文件
- `version`: 版本号，用于数据迁移和回滚
- 与 `templates` 表通过 `template_id` 关联（非外键，保持灵活性）

---

### 3. 文档表 (documents)

**用途**: 存储PPT文档元信息

```sql
CREATE TABLE `documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '文档ID',
  `document_id` VARCHAR(50) NOT NULL COMMENT '文档业务ID（如document_1）',
  `name` VARCHAR(200) NOT NULL COMMENT '文档名称',
  `cover` VARCHAR(500) DEFAULT NULL COMMENT '封面图URL',
  `source_document_id` VARCHAR(50) DEFAULT NULL COMMENT '基于的文档ID（复制来源）',
  `category` VARCHAR(50) DEFAULT 'uncategorized' COMMENT '分类',
  `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' COMMENT '状态',
  `tag` ENUM('public', 'practical') DEFAULT 'public' COMMENT '标签：public=公版, practical=实战',
  `slide_count` INT UNSIGNED DEFAULT 0 COMMENT '页面数量',
  `file_size` BIGINT UNSIGNED DEFAULT 0 COMMENT '文件大小（字节）',
  `last_opened_at` DATETIME DEFAULT NULL COMMENT '最后打开时间',
  -- 业务字段（售前平台）
  `customer_name` VARCHAR(200) DEFAULT NULL COMMENT '客户名称',
  `language` VARCHAR(20) DEFAULT 'zh-CN' COMMENT '语言：zh-CN/en-US等',
  `created_by` BIGINT UNSIGNED DEFAULT NULL COMMENT '创建人ID（关联users.id）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_document_id` (`document_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tag` (`tag`),
  KEY `idx_customer_name` (`customer_name`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_source_document_id` (`source_document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文档表';
```

**字段说明**:
- `document_id`: 业务ID，格式为 `document_1`, `document_2` 等
- `source_document_id`: 复制文档时记录来源
- `tag`: 区分公版PPT和实战PPT

---

### 4. 文档数据表 (document_data)

**用途**: 存储文档完整JSON数据

```sql
CREATE TABLE `document_data` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `document_id` VARCHAR(50) NOT NULL COMMENT '文档业务ID（关联documents.document_id）',
  `title` VARCHAR(200) DEFAULT NULL COMMENT '文档标题',
  `width` INT UNSIGNED DEFAULT 1000 COMMENT '画布宽度',
  `height` DECIMAL(10,2) DEFAULT 562.50 COMMENT '画布高度',
  `theme` JSON DEFAULT NULL COMMENT '主题配置JSON',
  `slides` LONGTEXT NOT NULL COMMENT '幻灯片数组JSON（完整数据）',
  `version` INT UNSIGNED DEFAULT 1 COMMENT '数据版本号',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_document_id` (`document_id`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文档数据表';
```

---

### 5. 预览图表 (thumbnails)

**用途**: 存储幻灯片预览图元信息

```sql
CREATE TABLE `thumbnails` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `thumbnail_id` VARCHAR(100) NOT NULL COMMENT '预览图业务ID（如thumb_document_1_slide_1）',
  `document_id` VARCHAR(50) NOT NULL COMMENT '文档ID（关联documents.document_id）',
  `document_title` VARCHAR(200) DEFAULT NULL COMMENT '文档标题（冗余字段）',
  `slide_id` VARCHAR(100) NOT NULL COMMENT '幻灯片ID',
  `slide_index` INT UNSIGNED DEFAULT 0 COMMENT '幻灯片索引（第几页）',
  `url` VARCHAR(500) NOT NULL COMMENT '预览图URL',
  `width` INT UNSIGNED DEFAULT 800 COMMENT '预览图宽度',
  `height` INT UNSIGNED DEFAULT 450 COMMENT '预览图高度',
  `size` BIGINT UNSIGNED DEFAULT 0 COMMENT '文件大小（字节）',
  `format` VARCHAR(20) DEFAULT 'jpg' COMMENT '图片格式：jpg/png/webp',
  `generated_at` DATETIME NOT NULL COMMENT '生成时间',
  `metadata` JSON DEFAULT NULL COMMENT '元数据JSON（扩展信息）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_thumbnail_id` (`thumbnail_id`),
  KEY `idx_document_id` (`document_id`),
  KEY `idx_slide_id` (`slide_id`),
  KEY `idx_generated_at` (`generated_at`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预览图表';
```

---

## 售前平台表

### 6. 产品表 (products)

**用途**: 存储产品信息

```sql
CREATE TABLE `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '产品ID',
  `product_id` VARCHAR(50) NOT NULL COMMENT '产品业务ID',
  `title` VARCHAR(200) NOT NULL COMMENT '产品标题',
  `description` TEXT DEFAULT NULL COMMENT '产品描述',
  `category` VARCHAR(100) DEFAULT NULL COMMENT '产品分类',
  `tags` JSON DEFAULT NULL COMMENT '标签数组JSON（如["AI","PPT","办公"]）',
  `cover` VARCHAR(500) DEFAULT NULL COMMENT '封面图URL',
  `detail_url` VARCHAR(500) DEFAULT NULL COMMENT '详情页URL',
  `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active' COMMENT '状态',
  `sort_order` INT UNSIGNED DEFAULT 0 COMMENT '排序权重',
  `view_count` INT UNSIGNED DEFAULT 0 COMMENT '浏览次数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_id` (`product_id`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品表';
```

---

### 7. 问答表 (qa)

**用途**: 存储问答对数据

```sql
CREATE TABLE `qa` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '问答ID',
  `qa_id` VARCHAR(50) NOT NULL COMMENT '问答业务ID',
  `question` TEXT NOT NULL COMMENT '问题',
  `answer` TEXT NOT NULL COMMENT '答案',
  `category` VARCHAR(100) DEFAULT NULL COMMENT '分类（如：产品使用/功能特性）',
  `tags` JSON DEFAULT NULL COMMENT '标签数组JSON',
  `view_count` INT UNSIGNED DEFAULT 0 COMMENT '浏览次数',
  `like_count` INT UNSIGNED DEFAULT 0 COMMENT '点赞数',
  `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active' COMMENT '状态',
  `sort_order` INT UNSIGNED DEFAULT 0 COMMENT '排序权重',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_qa_id` (`qa_id`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  FULLTEXT KEY `ft_question_answer` (`question`, `answer`) COMMENT '全文索引',
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='问答表';
```

**字段说明**:
- 使用 `FULLTEXT` 索引支持全文搜索

---

### 8. 物料表 (materials)

**用途**: 存储宣传物料信息

```sql
CREATE TABLE `materials` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '物料ID',
  `material_id` VARCHAR(50) NOT NULL COMMENT '物料业务ID',
  `title` VARCHAR(200) NOT NULL COMMENT '物料标题',
  `type` VARCHAR(50) NOT NULL COMMENT '类型：pdf/video/image等',
  `url` VARCHAR(500) NOT NULL COMMENT '物料URL',
  `description` TEXT DEFAULT NULL COMMENT '描述',
  `cover` VARCHAR(500) DEFAULT NULL COMMENT '封面图URL',
  `file_size` BIGINT UNSIGNED DEFAULT 0 COMMENT '文件大小（字节）',
  `duration` INT UNSIGNED DEFAULT NULL COMMENT '时长（秒，视频/音频）',
  `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active' COMMENT '状态',
  `sort_order` INT UNSIGNED DEFAULT 0 COMMENT '排序权重',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_material_id` (`material_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物料表';
```

---

## 系统管理表

### 9. 用户表 (users)

**用途**: 存储用户信息

```sql
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(100) NOT NULL COMMENT '用户名',
  `email` VARCHAR(200) DEFAULT NULL COMMENT '邮箱',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  `name` VARCHAR(100) DEFAULT NULL COMMENT '真实姓名',
  `avatar` VARCHAR(500) DEFAULT NULL COMMENT '头像URL',
  `department` VARCHAR(100) DEFAULT NULL COMMENT '部门',
  `role` ENUM('admin', 'user', 'guest') NOT NULL DEFAULT 'user' COMMENT '角色',
  `status` ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active' COMMENT '状态',
  `last_login_at` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
```

---

### 10. AI生成历史表 (ai_generation_history)

**用途**: 记录AI生成PPT的历史记录

```sql
CREATE TABLE `ai_generation_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '历史ID',
  `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '用户ID（关联users.id）',
  `type` ENUM('outline', 'ppt', 'writing', 'chat') NOT NULL COMMENT '生成类型',
  `model` VARCHAR(50) DEFAULT NULL COMMENT '使用的AI模型',
  `prompt` TEXT DEFAULT NULL COMMENT '提示词（摘要）',
  `input_content` TEXT DEFAULT NULL COMMENT '输入内容',
  `output_content` LONGTEXT DEFAULT NULL COMMENT '输出内容（JSON/文本）',
  `status` ENUM('success', 'failed', 'pending') NOT NULL DEFAULT 'pending' COMMENT '状态',
  `error_message` TEXT DEFAULT NULL COMMENT '错误信息',
  `duration_ms` INT UNSIGNED DEFAULT NULL COMMENT '耗时（毫秒）',
  `token_count` INT UNSIGNED DEFAULT NULL COMMENT 'Token消耗',
  `document_id` VARCHAR(50) DEFAULT NULL COMMENT '生成的文档ID（关联documents.document_id）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_model` (`model`),
  KEY `idx_status` (`status`),
  KEY `idx_document_id` (`document_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI生成历史表';
```

---

### 11. 图片缓存表 (image_cache)

**用途**: 缓存图片搜索结果，减少API调用

```sql
CREATE TABLE `image_cache` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '缓存ID',
  `keyword` VARCHAR(200) NOT NULL COMMENT '搜索关键词',
  `keyword_en` VARCHAR(200) DEFAULT NULL COMMENT '英文关键词（翻译后）',
  `orientation` VARCHAR(20) DEFAULT NULL COMMENT '方向：landscape/portrait/squarish',
  `source` ENUM('unsplash', 'pexels') NOT NULL COMMENT '图片来源',
  `images` JSON NOT NULL COMMENT '图片列表JSON',
  `page` INT UNSIGNED DEFAULT 1 COMMENT '页码',
  `expires_at` DATETIME NOT NULL COMMENT '过期时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_keyword_source_page` (`keyword`, `source`, `page`, `orientation`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片缓存表';
```

**字段说明**:
- `expires_at`: 缓存过期时间，建议24小时
- 使用联合唯一索引避免重复缓存

---

## 关联表

### 12. 文档标签关联表 (document_tags)

**用途**: 多对多关系，文档与标签（产品/行业/受众）的关联

```sql
CREATE TABLE `document_tags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `document_id` VARCHAR(50) NOT NULL COMMENT '文档ID（关联documents.document_id）',
  `tag_type` ENUM('product', 'industry', 'audience') NOT NULL COMMENT '标签类型',
  `tag_value` VARCHAR(100) NOT NULL COMMENT '标签值',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_document_tag` (`document_id`, `tag_type`, `tag_value`),
  KEY `idx_document_id` (`document_id`),
  KEY `idx_tag_type_value` (`tag_type`, `tag_value`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文档标签关联表';
```

**使用示例**:
```sql
-- 查询文档的所有产品标签
SELECT tag_value FROM document_tags 
WHERE document_id = 'document_1' AND tag_type = 'product' AND deleted_at IS NULL;

-- 查询包含"一表通"产品的所有文档
SELECT DISTINCT d.* FROM documents d
JOIN document_tags dt ON d.document_id = dt.document_id
WHERE dt.tag_type = 'product' AND dt.tag_value = '一表通' AND dt.deleted_at IS NULL;
```

---

### 13. 模板分类表 (template_categories)

**用途**: 模板分类字典表（可选，如果分类需要管理）

```sql
CREATE TABLE `template_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `category_code` VARCHAR(50) NOT NULL COMMENT '分类代码',
  `category_name` VARCHAR(100) NOT NULL COMMENT '分类名称',
  `parent_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '父分类ID',
  `sort_order` INT UNSIGNED DEFAULT 0 COMMENT '排序权重',
  `description` TEXT DEFAULT NULL COMMENT '分类描述',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '状态',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  `reserved_field_1` VARCHAR(255) DEFAULT NULL COMMENT '备用字段1',
  `reserved_field_2` VARCHAR(255) DEFAULT NULL COMMENT '备用字段2',
  `reserved_field_3` TEXT DEFAULT NULL COMMENT '备用字段3',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_code` (`category_code`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板分类表';
```

---

## 索引设计

### 索引策略

1. **主键索引**: 所有表使用自增ID作为主键
2. **唯一索引**: 业务ID字段（如 `template_id`, `document_id`）
3. **普通索引**: 
   - 状态字段（`status`）
   - 分类字段（`category`）
   - 时间字段（`created_at`, `updated_at`）
   - 外键字段（`user_id`, `document_id`）
4. **全文索引**: `qa` 表的 `question` 和 `answer` 字段
5. **联合索引**: 根据查询场景创建（如 `document_tags` 的 `(document_id, tag_type, tag_value)`）

### 索引维护建议

- 定期分析慢查询日志，优化缺失索引
- 监控索引使用率，删除未使用的索引
- 对于大表（如 `document_data`），考虑分区策略

---

## 数据迁移方案

### 迁移步骤

1. **创建数据库表结构**
   ```bash
   # 执行所有CREATE TABLE语句
   mysql -u root -p database_name < schema.sql
   ```

2. **迁移模板数据**
   ```sql
   -- 从 template-index.json 迁移到 templates 表
   -- 从 data/templates/*.json 迁移到 template_data 表
   ```

3. **迁移文档数据**
   ```sql
   -- 从 document-index.json 迁移到 documents 表
   -- 从 data/documents/*.json 迁移到 document_data 表
   ```

4. **迁移售前平台数据**
   ```sql
   -- 从 data/sales/products.json 迁移到 products 表
   -- 从 data/sales/qa.json 迁移到 qa 表
   -- 从 data/sales/materials.json 迁移到 materials 表
   ```

5. **迁移预览图数据**
   ```sql
   -- 从 thumbnails/index.json 迁移到 thumbnails 表
   ```

### 迁移脚本示例

```javascript
// migrate.js
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

async function migrateTemplates() {
  // 读取 template-index.json
  const indexFile = path.join(__dirname, 'data/template-index.json')
  const indexData = JSON.parse(fs.readFileSync(indexFile, 'utf-8'))
  
  // 插入到数据库
  for (const item of indexData) {
    await db.execute(
      'INSERT INTO templates (template_id, name, cover, category, origin, status, slide_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item.id, item.name, item.cover, item.category, item.origin, item.status, item.slideCount, item.createdAt, item.updatedAt]
    )
    
    // 读取模板JSON文件
    const templateFile = path.join(__dirname, 'data/templates', `${item.id}.json`)
    if (fs.existsSync(templateFile)) {
      const templateData = JSON.parse(fs.readFileSync(templateFile, 'utf-8'))
      await db.execute(
        'INSERT INTO template_data (template_id, title, width, height, theme, slides) VALUES (?, ?, ?, ?, ?, ?)',
        [item.id, templateData.title, templateData.width, templateData.height, JSON.stringify(templateData.theme), JSON.stringify(templateData.slides)]
      )
    }
  }
}
```

---

## 数据库设计总结

### 表数量统计

| 类型 | 数量 | 表名 |
|------|------|------|
| 核心业务表 | 4 | templates, template_data, documents, document_data |
| 售前平台表 | 3 | products, qa, materials |
| 系统管理表 | 3 | users, ai_generation_history, image_cache |
| 关联表 | 2 | document_tags, template_categories |
| **总计** | **12** | - |

### 设计亮点

1. ✅ **元数据与数据分离**: 模板/文档的元信息和完整JSON数据分开存储，提高查询效率
2. ✅ **软删除支持**: 所有表支持软删除，便于数据恢复
3. ✅ **备用字段**: 每个表预留3个备用字段，便于后续扩展
4. ✅ **业务ID兼容**: 保持与现有JSON文件系统的业务ID格式一致
5. ✅ **索引优化**: 针对常见查询场景创建索引
6. ✅ **JSON字段**: 合理使用JSON类型存储结构化数据

### 注意事项

1. ⚠️ **大JSON字段**: `template_data.slides` 和 `document_data.slides` 使用 `LONGTEXT`，注意查询性能
2. ⚠️ **数据一致性**: 元数据表和数据表通过业务ID关联，需要应用层保证一致性
3. ⚠️ **缓存策略**: 图片缓存表需要定期清理过期数据
4. ⚠️ **全文搜索**: `qa` 表使用全文索引，注意中文分词支持

---

## 后续优化建议

1. **读写分离**: 考虑主从复制，读操作走从库
2. **分库分表**: 当数据量达到千万级时，考虑按时间或ID范围分表
3. **缓存层**: 引入Redis缓存热点数据（模板列表、文档列表）
4. **归档策略**: 定期归档历史数据到归档表
5. **监控告警**: 监控数据库性能指标，设置告警阈值

---

**文档版本**: v1.0  
**最后更新**: 2025-12-30  
**维护人**: AI Assistant

