# 模板管理

> 本文档包含 PPT 模板相关的所有接口，基于现有代码整理。

**模块路径**：`/api/templates`  
**负责人**：待定  
**开发状态**：✅ 已实现  
**最后更新**：2025-12-28

---

## 1. 获取模板列表

### 基本信息
- **接口路径**：`GET /api/templates`
- **请求方式**：`GET`
- **接口说明**：获取所有模板列表（包括内置模板和用户创建的模板）
- **权限要求**：无（公开接口）
- **开发状态**：✅ 已实现

### 请求参数
无

### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": "template_1",
        "name": "商务简约",
        "cover": "https://cdn.example.com/covers/template_1.webp",
        "origin": "built-in",
        "category": "business",
        "status": "published"
      },
      {
        "id": "template_user_001",
        "name": "我的自定义模板",
        "cover": "https://cdn.example.com/covers/template_user_001.webp",
        "origin": "user",
        "category": "custom",
        "status": "draft"
      }
    ]
  }
}
```

### 响应字段说明
| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 请求是否成功 |
| data.list | array | 模板列表 |
| id | string | 模板ID |
| name | string | 模板名称 |
| cover | string | 封面图URL |
| origin | string | 来源：built-in-内置/user-用户创建 |
| category | string | 分类 |
| status | string | 状态：draft-草稿/published-已发布/archived-已归档 |

### 前端对接
```typescript
// services/templateService.ts
import { SERVER_URL } from './index'
import axios from './config'

// 模板信息接口
export interface TemplateInfo {
  id: string
  name: string
  cover: string
  origin?: string
  category?: string
  status?: 'draft' | 'published' | 'archived'
}

/**
 * 获取模板列表
 * 
 * 优先：从后端 GET /api/templates 获取
 * 回退：从 slidesStore 获取（硬编码内置模板）
 */
export async function getTemplateList(): Promise<TemplateInfo[]> {
  try {
    // 优先从后端获取模板列表
    const resp = await fetch(`${SERVER_URL}/templates`)
    if (resp.ok) {
      const json = await resp.json()
      const list = (json.data?.list || []) as any[]

      // 过滤掉无效的项
      return list
        .filter(item => item && item.id)
        .map(item => ({
          id: item.id,
          name: item.name || '未命名模板',
          cover: item.cover || getTemplateCoverUrl(item.id),
          origin: item.origin,
          category: item.category,
          status: item.status,
        }))
    }
  } catch (e) {
    console.warn('[模板服务] 从后端获取模板列表失败，回退到本地模板:', e)
  }

  // 回退：使用硬编码在 slidesStore 中的内置模板
  const slidesStore = useSlidesStore()
  return slidesStore.templates
}
```

---

## 2. 获取模板详情

### 基本信息
- **接口路径**：`GET /api/templates/{id}`
- **请求方式**：`GET`
- **接口说明**：获取指定模板的详细信息和幻灯片数据
- **权限要求**：无（公开接口）
- **开发状态**：✅ 已实现

### 路径参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 模板ID |

### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "id": "template_1",
    "name": "商务简约",
    "cover": "https://cdn.example.com/covers/template_1.webp",
    "origin": "built-in",
    "category": "business",
    "status": "published",
    "slideCount": 8,
    "createdAt": "2025-10-01T00:00:00Z",
    "updatedAt": "2025-10-01T00:00:00Z",
    "templateData": {
      "slides": [
        {
          "id": "slide_1",
          "type": "cover",
          "elements": [
            {
              "type": "text",
              "id": "text_1",
              "left": 100,
              "top": 200,
              "width": 800,
              "height": 150,
              "content": "在此处添加标题",
              "textType": "title",
              "defaultFontName": "Microsoft Yahei",
              "defaultColor": "#333333"
            }
          ],
          "background": {
            "type": "solid",
            "color": "#ffffff"
          }
        }
      ]
    }
  }
}
```

### 响应字段说明
| 字段名 | 类型 | 说明 |
|--------|------|------|
| templateData | object | 模板完整数据 |
| templateData.slides | array | 幻灯片数组 |
| slideCount | number | 幻灯片数量 |
| createdAt | string | 创建时间（ISO 8601格式） |
| updatedAt | string | 更新时间（ISO 8601格式） |

### 前端对接
```typescript
import type { Slide } from '@/types/slides'

/**
 * 获取模板的所有slides
 * 
 * @param templateId 模板ID（如 template_1）
 */
export async function getTemplateSlides(templateId: string): Promise<Slide[]> {
  try {
    // 优先：从后端模板接口获取
    const resp = await fetch(`${SERVER_URL}/templates/${templateId}`)
    if (resp.ok) {
      const json = await resp.json()
      const data = json.data || {}
      if (data.templateData?.slides) {
        return data.templateData.slides as Slide[]
      }
    }
  } catch (e) {
    console.warn('[模板服务] 从后端加载失败，回退到 mock:', e)
  }

  // 兼容旧数据：从 mock 接口获取（内置模板 template_1~8）
  const mock = await api.getMockData(templateId)
  return (mock?.slides || []) as Slide[]
}
```

---

## 3. 创建模板

### 基本信息
- **接口路径**：`POST /api/templates/create`
- **请求方式**：`POST`
- **接口说明**：创建新模板（空白或基于基础布局）
- **权限要求**：需要登录
- **开发状态**：✅ 已实现

### 请求参数
| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| name | string | 是 | 模板名称 | "我的商务模板" |
| category | string | 否 | 分类，默认"uncategorized" | "business" |
| initialLayout | string | 否 | 初始布局：blank-空白/basic-基础，默认blank | "blank" |

### 请求示例
```json
{
  "name": "我的商务模板",
  "category": "business",
  "initialLayout": "blank"
}
```

### 成功响应（200）
```json
{
  "success": true,
  "data": {
    "id": "template_user_001"
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "模板名称不能为空"
}
```

### 业务逻辑
1. **blank 布局**：创建完全空白的模板，包含一个空白幻灯片
2. **basic 布局**：创建包含基础元素的模板（标题页 + 内容页）
3. 新创建的模板默认状态为 `draft`
4. 模板ID格式：`template_user_{随机字符串}`

### 前端对接
```typescript
/**
 * 新建模板
 */
export async function createTemplate(params: {
  name: string
  category?: string
  initialLayout?: 'blank' | 'basic'
}): Promise<any> {
  const body = {
    name: params.name,
    category: params.category || 'uncategorized',
    initialLayout: params.initialLayout || 'blank',
  }
  return axios.post(`${SERVER_URL}/templates/create`, body)
}
```

---

## 4. 删除模板

### 基本信息
- **接口路径**：`DELETE /api/templates/{id}`
- **请求方式**：`DELETE`
- **接口说明**：删除指定模板（仅用户创建的模板可删除）
- **权限要求**：需要模板所有者权限
- **开发状态**：✅ 已实现

### 路径参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 模板ID |

### 成功响应（200）
```json
{
  "success": true
}
```

### 错误响应
```json
{
  "success": false,
  "error": "不能删除内置模板"
}
```

或

```json
{
  "success": false,
  "error": "模板不存在"
}
```

### 业务逻辑
1. **内置模板不可删除**：`origin=built-in` 的模板受保护
2. **用户模板可删除**：`origin=user` 的模板可以删除
3. 删除操作是物理删除，不可恢复
4. 删除模板时同时删除模板文件和封面图

### 前端对接
```typescript
/**
 * 删除模板
 */
export async function deleteTemplate(templateId: string): Promise<any> {
  return axios.delete(`${SERVER_URL}/templates/${templateId}`)
}
```

---

## 辅助功能

### 5. 获取模板封面图URL

这是一个前端工具函数，不是接口，用于生成模板封面图的 URL。

```typescript
/**
 * 获取模板封面图URL
 * 
 * @param templateId 模板ID
 * @returns 封面图完整URL
 */
export function getTemplateCoverUrl(templateId: string): string {
  return `${SERVER_URL}/covers/${templateId}.webp`
}
```

### 使用示例
```typescript
const coverUrl = getTemplateCoverUrl('template_1')
// 返回: "https://api.example.com/covers/template_1.webp"
```

---

### 6. 筛选模板幻灯片

这是一个前端工具函数，用于筛选符合条件的幻灯片。

```typescript
// 筛选选项
export interface FilterOptions {
  type?: string      // 页面类型 (content, cover, etc.)
  minItems?: number  // 最小items数量
}

/**
 * 获取筛选后的模板slides
 * 
 * @param templateId 模板ID
 * @param options 筛选选项
 */
export async function getFilteredTemplateSlides(
  templateId: string,
  options: FilterOptions = {}
): Promise<Slide[]> {
  const slides = await getTemplateSlides(templateId)
  
  if (!options.type && !options.minItems) {
    return slides
  }
  
  return slides.filter(slide => {
    // 类型筛选
    if (options.type && slide.type !== options.type) {
      return false
    }
    
    // items数量筛选
    if (options.minItems && options.minItems > 0) {
      const itemCount = getSlideItemCount(slide)
      if (itemCount < options.minItems) {
        return false
      }
    }
    
    return true
  })
}
```

---

## 业务逻辑说明

### 1. 模板来源分类
- **built-in（内置模板）**：
  - 系统预装的 8 个模板（template_1 ~ template_8）
  - 不可删除、不可修改
  - 所有用户共享
  
- **user（用户模板）**：
  - 用户自己创建的模板
  - 可以删除和修改
  - 仅创建者可见（如果实现了权限控制）

### 2. 模板状态
```
draft (草稿) → published (已发布) → archived (已归档)
```

### 3. 模板分类
模板可以按以下分类组织：
- `business` - 商务
- `education` - 教育
- `marketing` - 营销
- `custom` - 自定义
- `uncategorized` - 未分类

### 4. 文件存储结构
```
data/
├── templates/                  # 模板数据目录
│   ├── template_1.json        # 内置模板
│   ├── template_2.json
│   └── template_user_001.json # 用户模板
└── covers/                     # 封面图目录
    ├── template_1.webp
    └── template_user_001.webp
```

### 5. 内置模板说明
系统预装 8 个内置模板：
- `template_1` - 简约商务
- `template_2` - 经典报告
- `template_3` - 创意展示
- `template_4` - 学术论文
- `template_5` - 项目提案
- `template_6` - 产品介绍
- `template_7` - 培训教程
- `template_8` - 活动策划

---

## 与文档的关系

### 使用模板创建文档
用户通过以下流程使用模板：

1. **选择模板**：调用 `GET /api/templates` 获取模板列表
2. **预览模板**：调用 `GET /api/templates/{id}` 查看模板详情
3. **创建文档**：调用 `POST /api/documents/create`，传入 `sourceDocumentId`

```typescript
// 示例：基于模板创建文档
const templateId = 'template_1'
const newDoc = await createDocument({
  name: '我的演示文稿',
  sourceDocumentId: templateId,  // 指定模板ID
  category: 'work'
})
```

### 从文档保存为模板
如果需要将文档保存为模板（待实现功能）：

```typescript
// 待实现：POST /api/documents/{id}/save-as-template
// 将现有文档转换为可复用的模板
```

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
| 403 | 不能删除内置模板 | 尝试删除系统内置模板 |
| 404 | 模板不存在 | 模板ID不存在 |
| 500 | 服务器内部错误 | 服务器异常 |

---

## 变更记录

| 版本 | 更新时间 | 更新人 | 更新内容 |
|------|----------|--------|----------|
| v1.0 | 2025-12-28 | AI助手 | 基于现有代码整理，包含4个已实现接口 |

---

## 备注

### 技术实现
- **后端框架**：Node.js + Express
- **数据存储**：文件系统（JSON文件）
- **封面图格式**：webp
- **内置模板数量**：8个

### 待扩展功能
以下功能可在后续版本中实现：
- 🔲 模板更新/编辑
- 🔲 模板分享（公开/私有）
- 🔲 模板分类管理
- 🔲 模板标签系统
- 🔲 模板评价/评分
- 🔲 从文档保存为模板
- 🔲 模板下载（导出为 .pptx）
- 🔲 模板收藏功能
- 🔲 热门模板推荐

### 性能说明
- 模板列表一次性返回所有模板（无分页）
- 内置模板数据缓存在内存中
- 封面图建议尺寸：800x600 (16:10)
- 封面图大小限制：2MB
- 单个模板幻灯片数量建议：8-20页

### 前后端兼容
- 如果后端接口不可用，前端会自动回退到本地硬编码的 8 个内置模板
- 保证了离线情况下的基本可用性
