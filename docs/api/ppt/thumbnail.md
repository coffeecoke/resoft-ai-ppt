# 缩略图管理

> 本文档包含幻灯片缩略图（预览图）相关的所有接口，基于现有代码整理。

**模块路径**：`/api/thumbnails`  
**负责人**：待定  
**开发状态**：✅ 已实现  
**最后更新**：2025-12-28

---

## 概述

缩略图（预览图）系统用于快速预览幻灯片内容，提升用户体验。每张幻灯片会生成对应的缩略图，支持快速浏览和选择。

### 应用场景
- 文档列表展示
- 幻灯片快速浏览
- 幻灯片选择器
- 历史版本对比

---

## 1. 上传预览图

### 基本信息
- **接口路径**：`POST /api/thumbnails/upload`
- **请求方式**：`POST`
- **接口说明**：上传幻灯片预览图
- **权限要求**：需要编辑权限
- **开发状态**：✅ 已实现

### 请求参数（FormData）
| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| documentId | string | 是 | 文档ID | "doc_abc123" |
| slideId | string | 是 | 幻灯片ID | "slide_1" |
| thumbnail | File | 是 | 缩略图文件（图片） | JPG/PNG/WEBP |

### 成功响应（200）
```json
{
  "success": true,
  "thumbnailUrl": "https://api.example.com/thumbnails/doc_abc123/slide_1.jpg"
}
```

### 错误响应
```json
{
  "success": false,
  "error": "文件格式不支持"
}
```

### 业务逻辑
1. 接受 JPG、PNG、WEBP 格式图片
2. 自动生成缩略图ID：`{documentId}_{slideId}`
3. 保存到服务器 `data/thumbnails/` 目录
4. 更新缩略图索引
5. 返回缩略图访问URL

### 技术要求
- 图片大小限制：5MB
- 推荐尺寸：800x600（16:10）或 960x540（16:9）
- 支持格式：JPG、PNG、WEBP

### 前端对接
```typescript
// services/thumbnailService.ts
export interface Thumbnail {
  id: string
  documentId: string
  documentTitle: string
  slideId: string
  slideIndex: number
  url: string
  width: number
  height: number
  size: number
  format: string
  generatedAt: string
  metadata: {
    hasText: boolean
    hasImage: boolean
    elementCount: number
  }
}

/**
 * 上传预览图
 * 
 * @param documentId 文档ID
 * @param slideId 幻灯片ID
 * @param file 图片文件（Blob）
 */
export async function uploadThumbnail(
  documentId: string,
  slideId: string,
  file: Blob
): Promise<{ 
  success: boolean
  thumbnailUrl?: string
  error?: string 
}> {
  try {
    const formData = new FormData()
    formData.append('documentId', documentId)
    formData.append('slideId', slideId)
    formData.append('thumbnail', file, `${slideId}.jpg`)

    const response = await axios.post(`${SERVER_URL}/api/thumbnails/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 上传失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '上传失败'
    }
  }
}
```

---

## 2. 获取预览图列表

### 基本信息
- **接口路径**：`GET /api/thumbnails`
- **请求方式**：`GET`
- **接口说明**：获取预览图列表，支持按文档筛选和分页
- **权限要求**：需要查看权限
- **开发状态**：✅ 已实现

### 请求参数（Query）
| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| documentId | string | 否 | 文档ID（筛选特定文档的预览图） | "doc_abc123" |
| limit | number | 否 | 返回数量，默认50 | 50 |
| offset | number | 否 | 偏移量，默认0 | 0 |

### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "total": 156,
    "thumbnails": [
      {
        "id": "thumb_abc123_slide1",
        "documentId": "doc_abc123",
        "documentTitle": "2025年度工作报告",
        "slideId": "slide_1",
        "slideIndex": 0,
        "url": "https://api.example.com/thumbnails/doc_abc123/slide_1.jpg",
        "width": 960,
        "height": 540,
        "size": 102400,
        "format": "jpg",
        "generatedAt": "2025-12-28T10:00:00Z",
        "metadata": {
          "hasText": true,
          "hasImage": false,
          "elementCount": 3
        }
      }
    ],
    "lastUpdated": "2025-12-28T10:30:00Z"
  }
}
```

### 响应字段说明
| 字段名 | 类型 | 说明 |
|--------|------|------|
| total | number | 总数量 |
| thumbnails | array | 预览图列表 |
| lastUpdated | string | 最后更新时间 |
| id | string | 预览图ID |
| documentId | string | 所属文档ID |
| documentTitle | string | 文档标题 |
| slideId | string | 幻灯片ID |
| slideIndex | number | 幻灯片索引（从0开始） |
| url | string | 预览图访问URL |
| width | number | 图片宽度（px） |
| height | number | 图片高度（px） |
| size | number | 文件大小（字节） |
| format | string | 图片格式（jpg/png/webp） |
| generatedAt | string | 生成时间（ISO 8601格式） |
| metadata | object | 元数据 |
| metadata.hasText | boolean | 是否包含文本元素 |
| metadata.hasImage | boolean | 是否包含图片元素 |
| metadata.elementCount | number | 元素数量 |

### 前端对接
```typescript
/**
 * 获取预览图列表
 * 
 * @param params 查询参数
 */
export async function getThumbnails(params?: {
  documentId?: string
  limit?: number
  offset?: number
}): Promise<{
  success: boolean
  data?: {
    total: number
    thumbnails: Thumbnail[]
    lastUpdated: string
  }
  error?: string
}> {
  try {
    const query = new URLSearchParams()
    if (params?.documentId) query.append('documentId', params.documentId)
    if (params?.limit) query.append('limit', params.limit.toString())
    if (params?.offset) query.append('offset', params.offset.toString())

    const url = `${SERVER_URL}/api/thumbnails${query.toString() ? `?${query.toString()}` : ''}`
    const response = await axios.get(url)
    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 获取列表失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '获取列表失败'
    }
  }
}
```

---

## 3. 获取预览图详情

### 基本信息
- **接口路径**：`GET /api/thumbnails/{id}`
- **请求方式**：`GET`
- **接口说明**：获取预览图详细信息（含溯源信息）
- **权限要求**：需要查看权限
- **开发状态**：✅ 已实现

### 路径参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 预览图ID |

### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "id": "thumb_abc123_slide1",
    "documentId": "doc_abc123",
    "documentTitle": "2025年度工作报告",
    "slideId": "slide_1",
    "slideIndex": 0,
    "url": "https://api.example.com/thumbnails/doc_abc123/slide_1.jpg",
    "width": 960,
    "height": 540,
    "size": 102400,
    "format": "jpg",
    "generatedAt": "2025-12-28T10:00:00Z",
    "metadata": {
      "hasText": true,
      "hasImage": false,
      "elementCount": 3
    },
    "source": {
      "document": {
        "id": "doc_abc123",
        "title": "2025年度工作报告",
        "width": 1280,
        "height": 720,
        "totalSlides": 25
      },
      "slide": {
        "id": "slide_1",
        "index": 0,
        "elements": [
          { "type": "text", "id": "text_1" },
          { "type": "text", "id": "text_2" },
          { "type": "shape", "id": "shape_1" }
        ]
      }
    }
  }
}
```

### 响应字段说明（额外字段）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| source | object | 溯源信息 |
| source.document | object | 文档信息 |
| source.document.totalSlides | number | 文档总页数 |
| source.slide | object | 幻灯片信息 |
| source.slide.elements | array | 幻灯片元素列表 |

### 业务逻辑
1. 提供预览图的完整溯源信息
2. 包含源文档和幻灯片的详细信息
3. 用于调试和内容追踪

### 前端对接
```typescript
export interface ThumbnailDetail extends Thumbnail {
  source: {
    document: {
      id: string
      title: string
      width: number
      height: number
      totalSlides: number
    }
    slide: {
      id: string
      index: number
      elements: Array<{ type: string; id: string }>
    }
  }
}

/**
 * 获取预览图详情（含溯源信息）
 * 
 * @param thumbnailId 预览图ID
 */
export async function getThumbnailDetail(
  thumbnailId: string
): Promise<{
  success: boolean
  data?: ThumbnailDetail
  error?: string
}> {
  try {
    const response = await axios.get(`${SERVER_URL}/api/thumbnails/${thumbnailId}`)
    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 获取详情失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '获取详情失败'
    }
  }
}
```

---

## 4. 获取文档的所有预览图

### 基本信息
- **接口路径**：`GET /api/thumbnails/document/{documentId}`
- **请求方式**：`GET`
- **接口说明**：获取某个文档的所有预览图（按幻灯片顺序排序）
- **权限要求**：需要查看权限
- **开发状态**：✅ 已实现

### 路径参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| documentId | string | 是 | 文档ID |

### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "documentId": "doc_abc123",
    "total": 25,
    "thumbnails": [
      {
        "id": "thumb_abc123_slide1",
        "slideId": "slide_1",
        "slideIndex": 0,
        "url": "https://api.example.com/thumbnails/doc_abc123/slide_1.jpg",
        "width": 960,
        "height": 540,
        "format": "jpg",
        "generatedAt": "2025-12-28T10:00:00Z"
      },
      {
        "id": "thumb_abc123_slide2",
        "slideId": "slide_2",
        "slideIndex": 1,
        "url": "https://api.example.com/thumbnails/doc_abc123/slide_2.jpg",
        "width": 960,
        "height": 540,
        "format": "jpg",
        "generatedAt": "2025-12-28T10:00:30Z"
      }
    ]
  }
}
```

### 响应字段说明
| 字段名 | 类型 | 说明 |
|--------|------|------|
| documentId | string | 文档ID |
| total | number | 该文档的预览图总数 |
| thumbnails | array | 预览图列表（按 slideIndex 排序） |

### 业务逻辑
1. 返回指定文档的所有预览图
2. 按 `slideIndex` 升序排序
3. 用于文档预览、幻灯片导航等场景

### 前端对接
```typescript
/**
 * 获取某个文档的所有预览图
 * 
 * @param documentId 文档ID
 */
export async function getDocumentThumbnails(
  documentId: string
): Promise<{
  success: boolean
  data?: {
    documentId: string
    total: number
    thumbnails: Thumbnail[]
  }
  error?: string
}> {
  try {
    const response = await axios.get(`${SERVER_URL}/api/thumbnails/document/${documentId}`)
    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 获取文档预览图失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '获取文档预览图失败'
    }
  }
}
```

---

## 5. 重建预览图索引

### 基本信息
- **接口路径**：`POST /api/thumbnails/rebuild-index`
- **请求方式**：`POST`
- **接口说明**：重建预览图索引（扫描文件系统，更新数据库）
- **权限要求**：需要管理员权限
- **开发状态**：✅ 已实现

### 请求参数
无

### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "total": 1024,
    "message": "索引重建成功，共处理 1024 个预览图"
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "权限不足"
}
```

### 业务逻辑
1. 扫描 `data/thumbnails/` 目录下的所有图片文件
2. 解析文件名，提取 `documentId` 和 `slideId`
3. 更新或创建预览图记录
4. 删除失效的预览图记录（文件不存在）
5. 返回处理统计

### 使用场景
- 系统初始化
- 数据迁移后
- 文件系统和数据库不一致时
- 定期维护任务

### 前端对接
```typescript
/**
 * 重建预览图索引
 * 
 * ⚠️ 管理员功能，谨慎使用
 */
export async function rebuildIndex(): Promise<{
  success: boolean
  data?: { 
    total: number
    message: string 
  }
  error?: string
}> {
  try {
    const response = await axios.post(`${SERVER_URL}/api/thumbnails/rebuild-index`)
    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 重建索引失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '重建索引失败'
    }
  }
}
```

---

## 业务逻辑说明

### 1. 缩略图生成机制

#### 自动生成
- 用户保存文档时，后台自动生成每张幻灯片的缩略图
- 使用 Canvas API 将幻灯片渲染为图片
- 默认生成 960x540 的缩略图（16:9）

#### 手动上传
- 用户也可以手动上传自定义的预览图
- 适用于特殊设计或品牌要求

### 2. 文件存储结构

```
data/
└── thumbnails/
    ├── doc_abc123/
    │   ├── slide_1.jpg
    │   ├── slide_2.jpg
    │   └── slide_3.jpg
    ├── doc_xyz789/
    │   ├── slide_1.jpg
    │   └── slide_2.jpg
    └── index.json          # 预览图索引
```

### 3. 缓存策略
- 缩略图URL包含生成时间戳，支持浏览器缓存
- 缓存时间：7天
- 文档更新后，自动更新对应的缩略图

### 4. 性能优化
- 使用 CDN 加速缩略图加载
- 支持懒加载（Lazy Loading）
- 支持响应式图片（不同尺寸）

---

## 错误响应格式

所有接口统一使用以下错误响应格式：

```json
{
  "success": false,
  "error": "错误信息描述"
}
```

### 常见错误

| HTTP状态码 | error 示例 | 说明 |
|-----------|-----------|------|
| 400 | 参数错误 | 请求参数格式错误或缺少必填参数 |
| 401 | 未授权 | token失效或未登录 |
| 403 | 无权限 | 没有操作该资源的权限 |
| 404 | 预览图不存在 | 预览图ID不存在 |
| 413 | 文件过大 | 上传的图片超过大小限制 |
| 415 | 文件格式不支持 | 不支持的图片格式 |
| 500 | 服务器内部错误 | 服务器异常 |

---

## 变更记录

| 版本 | 更新时间 | 更新人 | 更新内容 |
|------|----------|--------|----------|
| v1.0 | 2025-12-28 | AI助手 | 基于现有代码整理，包含5个已实现接口 |

---

## 备注

### 技术实现
- **后端框架**：Node.js + Express
- **图片处理**：Sharp 库（高性能图片处理）
- **存储方式**：文件系统
- **支持格式**：JPG、PNG、WEBP

### 待扩展功能
以下功能可在后续版本中实现：
- 🔲 自动生成缩略图（后端渲染）
- 🔲 多尺寸缩略图（响应式）
- 🔲 批量上传预览图
- 🔲 预览图压缩优化
- 🔲 CDN 集成
- 🔲 水印添加
- 🔲 缩略图缓存管理

### 性能说明
- 单次上传大小限制：5MB
- 推荐尺寸：960x540（16:9）或 800x600（16:10）
- 支持格式：JPG（推荐）、PNG、WEBP
- 建议使用 WEBP 格式以获得更好的压缩率

### 与文档的关系
- 每个文档可以有多个预览图（每页一个）
- 文档封面（cover）和预览图（thumbnail）是两个不同的概念：
  - **封面（cover）**：文档的主封面图，用于列表展示
  - **预览图（thumbnail）**：每张幻灯片的缩略图，用于快速浏览

