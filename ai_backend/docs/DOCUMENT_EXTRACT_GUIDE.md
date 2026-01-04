# AI后台文档管理功能使用指南

## 📋 功能概述

本功能新增了从数据库查询文档并提取内容的能力，支持两种提取模式：

1. **模式1（原有）**：上传 JSON 文件进行提取
2. **模式2（新增）**：查询数据库中的文档，选择文档进行提取

## 🚀 快速开始

### 1. 环境配置

#### 创建 `.env` 文件

在 `ai_backend` 目录下创建 `.env` 文件，配置数据库连接：

```env
# 服务端口
PORT=3000

# 数据库连接（与 online-ppt-backend 共享）
DATABASE_URL="mysql://root:your_password@localhost:3306/ppt_database"
SHADOW_DATABASE_URL="mysql://root:your_password@localhost:3306/ppt_database_shadow"
```

#### 安装依赖

```bash
cd ai_backend
npm install
```

这会安装 `@prisma/client` 依赖。

#### 生成 Prisma Client

由于 `ai_backend` 和 `online-ppt-backend` 共享同一个数据库，需要先确保 `online-ppt-backend` 的 Prisma Client 已生成：

```bash
cd ../online-ppt-backend
npx prisma generate
```

### 2. 启动服务

```bash
cd ai_backend
npm start
```

服务启动后，会显示：

```
============================================================
文档文本提取器 - Web 服务已启动
============================================================
🌐 访问地址: http://localhost:3000
📁 输出目录: /path/to/output
📤 上传目录: /path/to/uploads

📋 API 接口:
  [原有功能]
  - 上传提取: POST   /api/extract
  - 历史记录: GET    /api/history
  - 文件预览: GET    /api/preview
  - 健康检查: GET    /api/health

  [文档管理 - 新增]
  - 文档列表: GET    /api/documents/list
  - 提取内容: POST   /api/documents/:id/extract
  - 提取状态: GET    /api/documents/:id/extract-status
  - 批量提取: POST   /api/documents/batch-extract
============================================================
```

## 📡 API 接口说明

### 1. 获取文档列表

**接口**: `GET /api/documents/list`

**Query 参数**:
- `page` (number, 可选): 页码，默认 1
- `pageSize` (number, 可选): 每页数量，默认 20
- `status` (string, 可选): 状态筛选 (draft/published/extracted)
- `category` (string, 可选): 分类筛选
- `keyword` (string, 可选): 搜索关键词（匹配名称/客户名）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": "document_1",
        "name": "客户A产品介绍.pptx",
        "cover": "/snapshots/document_1/xxx.jpg",
        "content_file_path": "data/documents/document_1.json",
        "slide_count": 25,
        "file_size": 2048576,
        "status": "draft",
        "category": "uncategorized",
        "customer_name": "客户A",
        "product": ["产品1"],
        "created_at": "2025-01-03T10:00:00.000Z",
        "updated_at": "2025-01-03T10:00:00.000Z",
        "is_extracted": false,
        "extracted_count": 0
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

**字段说明**:
- `is_extracted`: 是否已提取（布尔值）
- `extracted_count`: 已提取的幻灯片数量

### 2. 提取文档内容

**接口**: `POST /api/documents/:id/extract`

**路径参数**:
- `id` (string): 文档ID，如 `document_1`

**Body 参数**:
```json
{
  "extract_method": "auto",  // 提取方法：auto/manual，默认 auto
  "force": false             // 是否强制重新提取，默认 false
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "document_id": "document_1",
    "document_name": "客户A产品介绍.pptx",
    "extracted_count": 25,
    "failed_count": 0,
    "total_slides": 25,
    "status": "completed",
    "message": "提取完成，共提取 25 页内容"
  }
}
```

**错误响应**:

| HTTP 状态码 | 错误信息 | 说明 |
|-----------|---------|------|
| 404 | 文档不存在 | 文档ID无效 |
| 404 | 文档JSON文件不存在或路径错误 | content_file_path 指向的文件不存在 |
| 400 | 文档JSON文件解析失败 | JSON 格式错误 |
| 409 | 文档已提取 | 该文档已经提取过，使用 force=true 可强制重新提取 |

### 3. 检查提取状态

**接口**: `GET /api/documents/:id/extract-status`

**路径参数**:
- `id` (string): 文档ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "document_id": "document_1",
    "is_extracted": true,
    "extracted_count": 25,
    "last_extracted_at": "2025-01-03T12:00:00.000Z"
  }
}
```

### 4. 批量提取文档

**接口**: `POST /api/documents/batch-extract`

**Body 参数**:
```json
{
  "document_ids": ["document_1", "document_4", "document_7"],
  "extract_method": "auto",
  "force": false
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 3,
    "success_count": 2,
    "skipped_count": 1,
    "failed_count": 0,
    "results": [
      {
        "document_id": "document_1",
        "success": true,
        "status": "extracted",
        "extracted_count": 25
      },
      {
        "document_id": "document_4",
        "success": true,
        "status": "skipped",
        "message": "已提取，跳过",
        "extracted_count": 30
      },
      {
        "document_id": "document_7",
        "success": true,
        "status": "extracted",
        "extracted_count": 18
      }
    ]
  }
}
```

## 🧪 测试脚本

### 使用测试脚本

```bash
# 测试提取单个文档
node scripts/test-document-extract.js document_1

# 强制重新提取（即使已提取过）
node scripts/test-document-extract.js document_1 --force

# 开启调试模式
DEBUG=true node scripts/test-document-extract.js document_1
```

### 使用 curl 测试

**获取文档列表**:
```bash
curl http://localhost:3000/api/documents/list?page=1&pageSize=10
```

**提取文档**:
```bash
curl -X POST http://localhost:3000/api/documents/document_1/extract \
  -H "Content-Type: application/json" \
  -d '{"extract_method": "auto"}'
```

**检查提取状态**:
```bash
curl http://localhost:3000/api/documents/document_1/extract-status
```

**批量提取**:
```bash
curl -X POST http://localhost:3000/api/documents/batch-extract \
  -H "Content-Type: application/json" \
  -d '{
    "document_ids": ["document_1", "document_4"],
    "extract_method": "auto",
    "force": false
  }'
```

## 📊 数据流程

```mermaid
flowchart TD
    Start([用户请求]) --> QueryList[GET /api/documents/list]
    QueryList --> ShowList[展示文档列表]
    ShowList --> Select[用户选择文档]
    Select --> CheckStatus{检查提取状态}
    CheckStatus -->|已提取| Confirm[显示已提取提示]
    CheckStatus -->|未提取| Extract[POST /:id/extract]
    Confirm --> Force{用户选择强制提取?}
    Force -->|是| Extract
    Force -->|否| End([结束])
    Extract --> ReadFile[读取JSON文件]
    ReadFile --> Parse{解析成功?}
    Parse -->|失败| Error[返回错误]
    Parse -->|成功| ExtractText[提取每页文本]
    ExtractText --> SaveDB[批量保存到数据库]
    SaveDB --> Success[返回提取结果]
    Success --> End
    Error --> End
```

## 🔧 核心实现逻辑

### 文本提取算法

从幻灯片中提取以下内容：
1. **文本元素** (`type: 'text'`): 提取 `content` 字段
2. **表格元素** (`type: 'table'`): 提取所有单元格文本
3. **图表元素** (`type: 'chart'`): 提取标题和描述

```javascript
extractTextFromSlide(slide) {
  const texts = []
  
  for (const element of slide.elements) {
    if (element.type === 'text' && element.content) {
      texts.push(element.content)
    }
    
    if (element.type === 'table' && element.data) {
      // 提取表格所有单元格
      for (const row of element.data) {
        for (const cell of row) {
          if (cell && cell.text) texts.push(cell.text)
        }
      }
    }
    
    if (element.type === 'chart') {
      if (element.title) texts.push(element.title)
      if (element.description) texts.push(element.description)
    }
  }
  
  return texts.join('\n')
}
```

### 文件路径处理

由于 `ai_backend` 和 `online-ppt-backend` 是同级目录，读取文件时需要正确构建路径：

```javascript
// ai_backend/server/services/documentService.js
const projectRoot = path.join(__dirname, '..', '..', '..', 'online-ppt-backend')
const fullPath = path.join(projectRoot, filePath)
// 示例：E:/dev-chat-ppt/online-ppt-backend/data/documents/document_1.json
```

## ⚠️ 注意事项

1. **数据库连接**：确保 `.env` 文件中的数据库连接信息正确
2. **Prisma Client**：需要在 `online-ppt-backend` 中先生成 Prisma Client
3. **文件路径**：确保 `documents` 表中的 `content_file_path` 字段路径正确
4. **重复提取**：默认情况下，已提取的文档会跳过，使用 `force=true` 可强制重新提取
5. **性能考虑**：批量提取时，建议每次不超过 50 个文档

## 🐛 常见问题

### 1. Prisma Client 找不到

**错误**: `Cannot find module '@prisma/client'`

**解决**:
```bash
cd online-ppt-backend
npx prisma generate
cd ../ai_backend
npm install
```

### 2. 数据库连接失败

**错误**: `Can't reach database server`

**解决**: 检查 `.env` 文件中的 `DATABASE_URL` 是否正确，确保 MySQL 服务已启动。

### 3. 文件不存在

**错误**: `文档JSON文件不存在或路径错误`

**原因**: `documents` 表中的 `content_file_path` 字段路径不正确。

**解决**: 
1. 检查数据库中的 `content_file_path` 字段
2. 确保路径相对于 `online-ppt-backend` 项目根目录
3. 示例正确路径: `data/documents/document_1.json`

### 4. JSON 解析失败

**错误**: `文档JSON文件解析失败`

**原因**: JSON 文件格式错误或损坏。

**解决**: 使用 JSON 验证工具检查文件格式。

## 📝 后续计划

- [ ] 前端管理页面（文档列表、提取操作）
- [ ] 提取进度实时显示（WebSocket）
- [ ] 提取任务队列（避免并发提取过多）
- [ ] 提取结果预览功能
- [ ] 导出提取结果为 Excel/CSV

## 📞 技术支持

如有问题，请查看日志输出或联系开发团队。

