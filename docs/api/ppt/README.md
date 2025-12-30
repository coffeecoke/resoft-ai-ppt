# PPT 模块接口文档

## 概述

PPT 模块包含文档管理、模板管理等相关接口，为在线 PPT 编辑器提供后端支持。

**开发语言**：
- ✅ **已实现部分**：Node.js + Express（原型开发）
- 🔲 **待迁移**：Java + Spring Boot（生产环境）

**负责人**：待定  
**最后更新**：2025-12-28

---

## 接口列表

### 文档管理 ([document.md](./document.md))

**基础路径**：`/api/documents`

#### ✅ 已实现（Node.js）- 共 8 个接口

| 序号 | 接口名称 | 接口路径 | 请求方式 | 说明 |
|------|---------|---------|---------|------|
| 1 | 获取文档列表 | `/api/documents` | GET | 分页查询，支持筛选 |
| 2 | 获取文档详情 | `/api/documents/{id}` | GET | 获取文档信息和内容 |
| 3 | 创建文档 | `/api/documents/create` | POST | 创建新文档 |
| 4 | 更新文档 | `/api/documents/{id}` | PUT | 保存幻灯片数据 |
| 5 | 删除文档 | `/api/documents/{id}` | DELETE | 软删除 |
| 6 | 复制文档 | `/api/documents/{id}/duplicate` | POST | 创建副本 |
| 7 | 重命名文档 | `/api/documents/{id}/rename` | PATCH | 修改文档名称 |
| 8 | 发布文档 | `/api/documents/{id}/publish` | POST | 将草稿改为已发布 |

#### 🔲 待 Java 开发 - 扩展功能

| 序号 | 接口名称 | 建议路径 | 请求方式 | 说明 |
|------|---------|---------|---------|------|
| 9 | 批量删除文档 | `/api/documents/batch` | DELETE | 批量删除 |
| 10 | 移动文档 | `/api/documents/{id}/move` | PUT | 移动到文件夹 |
| 11 | 分享文档 | `/api/documents/{id}/share` | POST | 生成分享链接 |
| 12 | 取消分享 | `/api/documents/{id}/share` | DELETE | 使分享失效 |
| 13 | 添加协作者 | `/api/documents/{id}/collaborators` | POST | 添加协作权限 |
| 14 | 移除协作者 | `/api/documents/{id}/collaborators/{userId}` | DELETE | 移除协作者 |
| 15 | 获取历史版本 | `/api/documents/{id}/versions` | GET | 版本列表 |
| 16 | 恢复历史版本 | `/api/documents/{id}/versions/{version}/restore` | POST | 版本回退 |

---

### 模板管理 ([template.md](./template.md))

**基础路径**：`/api/templates`

#### ✅ 已实现（Node.js）- 共 4 个接口

| 序号 | 接口名称 | 接口路径 | 请求方式 | 说明 |
|------|---------|---------|---------|------|
| 1 | 获取模板列表 | `/api/templates` | GET | 获取所有模板 |
| 2 | 获取模板详情 | `/api/templates/{id}` | GET | 获取模板信息和内容 |
| 3 | 创建模板 | `/api/templates/create` | POST | 创建新模板 |
| 4 | 删除模板 | `/api/templates/{id}` | DELETE | 删除模板 |

#### 🔲 待 Java 开发 - 扩展功能

| 序号 | 接口名称 | 建议路径 | 请求方式 | 说明 |
|------|---------|---------|---------|------|
| 5 | 更新模板 | `/api/templates/{id}` | PUT | 更新模板信息 |
| 6 | 使用模板创建文档 | `/api/templates/{id}/apply` | POST | 基于模板创建 |
| 7 | 下载模板 | `/api/templates/{id}/download` | POST | 下载模板文件 |
| 8 | 收藏模板 | `/api/templates/{id}/favorite` | POST | 添加到收藏 |
| 9 | 取消收藏模板 | `/api/templates/{id}/favorite` | DELETE | 取消收藏 |
| 10 | 获取收藏列表 | `/api/templates/favorites` | GET | 我的收藏 |
| 11 | 评价模板 | `/api/templates/{id}/rating` | POST | 评分和评论 |
| 12 | 获取分类列表 | `/api/templates/categories` | GET | 模板分类 |
| 13 | 创建分类 | `/api/templates/category` | POST | 新建分类 |
| 14 | 更新分类 | `/api/templates/category/{id}` | PUT | 更新分类 |
| 15 | 删除分类 | `/api/templates/category/{id}` | DELETE | 删除分类 |

---

### 缩略图管理 ([thumbnail.md](./thumbnail.md))

**基础路径**：`/api/thumbnails`

#### ✅ 已实现（Node.js）- 共 5 个接口

| 序号 | 接口名称 | 接口路径 | 请求方式 | 说明 |
|------|---------|---------|---------|------|
| 1 | 上传预览图 | `/api/thumbnails/upload` | POST | 上传幻灯片预览图 |
| 2 | 获取预览图列表 | `/api/thumbnails` | GET | 获取预览图列表（支持筛选） |
| 3 | 获取预览图详情 | `/api/thumbnails/{id}` | GET | 获取预览图详细信息（含溯源） |
| 4 | 获取文档的所有预览图 | `/api/thumbnails/document/{documentId}` | GET | 获取指定文档的所有预览图 |
| 5 | 重建预览图索引 | `/api/thumbnails/rebuild-index` | POST | 重建预览图索引（管理员） |

#### 🔲 待 Java 开发 - 扩展功能

| 序号 | 接口名称 | 建议路径 | 请求方式 | 说明 |
|------|---------|---------|---------|------|
| 6 | 自动生成预览图 | `/api/thumbnails/generate` | POST | 后端自动生成预览图 |
| 7 | 批量上传预览图 | `/api/thumbnails/batch-upload` | POST | 批量上传多个预览图 |
| 8 | 删除预览图 | `/api/thumbnails/{id}` | DELETE | 删除指定预览图 |
| 9 | 批量删除预览图 | `/api/thumbnails/batch-delete` | DELETE | 批量删除预览图 |
| 10 | 获取预览图统计 | `/api/thumbnails/stats` | GET | 预览图统计信息 |

---

## 通用说明

### 当前实现（Node.js）

#### 响应格式
```json
{
  "success": true,
  "data": {},
  "error": "错误信息（失败时）"
}
```

#### 认证方式
- 当前为简化版，暂无 JWT 认证
- Java 后端需实现完整的 JWT Token 认证

#### 数据存储
- **文档数据**：`data/documents/{id}.json`
- **模板数据**：`data/templates/{id}.json`
- **封面图**：`data/covers/{id}.webp`
- **缩略图**：`data/thumbnails/{documentId}/{slideId}.jpg`

---

### Java 开发建议

#### 响应格式（建议）
```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

#### 认证方式
- 使用 JWT Token 认证
- Header: `Authorization: Bearer {token}`
- Token 有效期：7天

#### 状态码说明
| code | 说明 |
|------|------|
| 0 | 成功 |
| 400 | 参数错误 |
| 401 | 未授权 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 冲突 |
| 500 | 服务器错误 |

#### 分页参数
| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| page | number | 1 | 页码 |
| pageSize | number | 20 | 每页数量 |

#### 分页响应
```json
{
  "list": [],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

---

## 权限说明

### 文档权限
- **owner（所有者）**：所有权限
- **editor（编辑者）**：查看、编辑、保存
- **viewer（查看者）**：仅查看

### 模板权限
- **管理员**：创建、编辑、删除所有模板
- **普通用户**：创建个人模板、使用公共模板
- **游客**：仅查看、使用公共模板

---

## 技术要求（Java 后端）

### 技术栈
- Java 17+
- Spring Boot 3.x
- MySQL 8.0
- Redis（缓存）
- OSS（文件存储，如阿里云OSS）

### 性能要求
- 接口响应时间 < 500ms
- 支持并发用户数 > 1000
- 文件上传大小限制：
  - 文档：50MB
  - 模板：20MB
  - 图片：5MB

### 安全要求
- 所有接口需要 HTTPS
- 敏感数据需加密存储
- SQL 防注入
- XSS 防护
- CSRF 防护

---

## 数据库设计建议

### 核心表

#### 1. ppt_document（文档表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) | 主键，如 doc_abc123 |
| name | VARCHAR(200) | 文档名称 |
| cover | VARCHAR(500) | 封面图URL |
| source_document_id | VARCHAR(50) | 源模板ID |
| category | VARCHAR(50) | 分类 |
| status | VARCHAR(20) | draft/published/archived |
| slide_count | INT | 幻灯片数量 |
| file_size | BIGINT | 文件大小（字节） |
| content | TEXT | 文档JSON数据 |
| create_by | VARCHAR(50) | 创建人 |
| create_time | DATETIME | 创建时间 |
| update_time | DATETIME | 更新时间 |
| last_opened_at | DATETIME | 最后打开时间 |
| folder_id | VARCHAR(50) | 所属文件夹 |
| share_count | INT | 分享次数 |
| view_count | INT | 查看次数 |

#### 2. ppt_template（模板表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) | 主键，如 template_1 |
| name | VARCHAR(200) | 模板名称 |
| cover | VARCHAR(500) | 封面图URL |
| origin | VARCHAR(20) | built-in/user |
| category | VARCHAR(50) | 分类 |
| status | VARCHAR(20) | draft/published/archived |
| slide_count | INT | 幻灯片数量 |
| content | TEXT | 模板JSON数据 |
| tags | VARCHAR(500) | 标签（逗号分隔） |
| download_count | INT | 下载次数 |
| use_count | INT | 使用次数 |
| rating | DECIMAL(3,2) | 评分 0-5 |
| create_by | VARCHAR(50) | 创建人 |
| create_time | DATETIME | 创建时间 |
| update_time | DATETIME | 更新时间 |

#### 3. ppt_document_collaborator（协作者表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| document_id | VARCHAR(50) | 文档ID |
| user_id | VARCHAR(50) | 用户ID |
| role | VARCHAR(20) | owner/editor/viewer |
| create_time | DATETIME | 添加时间 |

#### 4. ppt_document_version（版本表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| document_id | VARCHAR(50) | 文档ID |
| version | INT | 版本号 |
| content | TEXT | 版本内容 |
| description | VARCHAR(500) | 版本说明 |
| create_by | VARCHAR(50) | 创建人 |
| create_time | DATETIME | 创建时间 |

#### 5. ppt_template_category（模板分类表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) | 主键 |
| name | VARCHAR(100) | 分类名称 |
| icon | VARCHAR(500) | 图标URL |
| order | INT | 排序 |
| parent_id | VARCHAR(50) | 父分类ID |
| create_time | DATETIME | 创建时间 |

---

## 迁移计划

### 阶段 1：核心功能迁移（优先级：高）
1. ✅ 文档管理基础接口（8个已实现）
2. ✅ 模板管理基础接口（4个已实现）
3. 🔲 数据库设计和表结构创建
4. 🔲 JWT 认证和权限控制
5. 🔲 文件存储迁移到 OSS

### 阶段 2：扩展功能开发（优先级：中）
1. 🔲 版本管理功能
2. 🔲 协作者管理功能
3. 🔲 分享功能
4. 🔲 文件夹管理

### 阶段 3：高级功能（优先级：低）
1. 🔲 模板评价和收藏
2. 🔲 批量操作
3. 🔲 高级搜索和筛选
4. 🔲 数据统计和分析

---

## 前后端对接说明

### 接口兼容性
Java 后端开发时，请确保：
1. **保持路径一致**：使用 `/api/documents` 和 `/api/templates` 路径前缀
2. **保持参数格式**：请求和响应参数格式与现有 Node.js 版本一致
3. **响应结构可适配**：前端会统一处理响应格式差异

### 前端 Service 层
- **文档管理**：`src/services/documentService.ts`
- **模板管理**：`src/services/templateService.ts`
- 前端已实现自动回退机制，后端不可用时使用本地 Mock 数据

---

## 更新记录

| 日期 | 更新内容 |
|------|----------|
| 2025-12-28 | 基于现有 Node.js 代码整理，明确已实现接口（文档8个，模板4个，缩略图5个） |
| 2025-12-28 | 明确更新策略（全量替换 vs 增量更新），添加详细说明和正确用法示例 |

---

## 联系方式

如有疑问，请联系：
- **前端负责人**：待定
- **后端负责人（Node.js）**：待定
- **后端负责人（Java）**：待定

---

## 附录：内置模板说明

系统预装 8 个内置模板：
- `template_1` - 简约商务
- `template_2` - 经典报告
- `template_3` - 创意展示
- `template_4` - 学术论文
- `template_5` - 项目提案
- `template_6` - 产品介绍
- `template_7` - 培训教程
- `template_8` - 活动策划

这些内置模板需要在 Java 后端数据库中预置。
