# PPT内容AI分析功能

## 📋 功能概述

本功能基于AI大模型，自动分析PPT页面的文本内容，并根据预定义的分类标准进行智能分类。

### 核心特性

- ✅ **自动分类**: 使用AI模型自动分析PPT内容并分类
- ✅ **流式处理**: 支持实时进度反馈
- ✅ **灵活配置**: 支持自定义OpenAI兼容接口
- ✅ **完整统计**: 提供详细的分类统计信息

### 技术架构

```
ai_backend/
├── server/
│   ├── config/
│   │   └── aiModels.js          # AI模型配置
│   ├── prompts/
│   │   └── pptAnalysisPrompt.js # 分析提示词
│   ├── services/
│   │   ├── aiService.js         # AI服务封装
│   │   └── pptAnalysisService.js # 分析业务逻辑
│   └── routes/
│       └── pptAnalysisRoutes.js  # API路由
└── scripts/
    └── test-ppt-analysis.js      # 测试脚本
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd ai_backend
npm install
```

会安装以下新增依赖：
- `openai@^4.24.0` - OpenAI SDK

### 2. 配置环境变量

创建 `ai_backend/.env` 文件：

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置文件
nano .env
```

**必填配置**：

```env
# 数据库连接 (连接online-ppt-backend的MySQL数据库)
DATABASE_URL="mysql://root:your_password@localhost:3306/aippt"

# 自定义OpenAI接口
CUSTOM_OPENAI_API_KEY=sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f
CUSTOM_OPENAI_BASE_URL=http://10.168.165.50:3000/v1
CUSTOM_OPENAI_MODEL=gpt-4o-mini

# 服务器端口
PORT=3000
```

### 3. 初始化数据库

在 `online-ppt-backend` 目录执行：

```bash
cd online-ppt-backend

# 生成Prisma客户端
npx prisma generate

# 执行数据库迁移(创建prompt_templates表)
npx prisma migrate dev

# 初始化分类标准数据(如果还没有执行)
node prisma/seed-content-categories-ppt.js
```

### 4. 启动服务

```bash
cd ai_backend
npm start
```

服务将在 `http://localhost:3000` 启动。

## 📖 API接口文档

### 1. 分析文档内容

**接口**: `POST /api/ppt-analysis/analyze/:documentId`

**说明**: 分析指定文档的所有页面内容并自动分类

**请求参数**:
```json
{
  "modelName": "custom-openai"  // 可选，默认custom-openai
}
```

**响应**: Server-Sent Events (SSE) 流式数据

```json
// 开始事件
{"type":"start","message":"开始分析...","documentId":"xxx","documentName":"xxx.pptx"}

// 进度事件
{"type":"progress","current":1,"total":10,"progress":10,"slideId":"slide_1","status":"success","result":{"category_code":"xxx","confidence":0.95}}

// 完成事件
{"type":"complete","message":"分析完成","results":{"total":10,"success":9,"failed":0,"skipped":1}}
```

**使用示例**:

```bash
# 使用curl
curl -X POST http://localhost:3000/api/ppt-analysis/analyze/document_123 \
  -H "Content-Type: application/json" \
  -d '{"modelName":"custom-openai"}'

# 使用JavaScript (EventSource)
const eventSource = new EventSource('http://localhost:3000/api/ppt-analysis/analyze/document_123');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### 2. 获取分析结果

**接口**: `GET /api/ppt-analysis/results/:documentId`

**响应**:
```json
{
  "success": true,
  "documentId": "document_123",
  "documentName": "产品介绍.pptx",
  "total": 10,
  "results": [
    {
      "thumbnailId": "thumb_xxx",
      "slideId": "slide_1",
      "slideIndex": 0,
      "categoryCode": "enterprise_basic_info",
      "categoryName": "企业基础信息",
      "confidence": 0.95,
      "analyzedAt": "2026-01-03T12:00:00.000Z"
    }
  ]
}
```

### 3. 获取分类统计

**接口**: `GET /api/ppt-analysis/statistics/:documentId`

**响应**:
```json
{
  "success": true,
  "documentId": "document_123",
  "documentName": "产品介绍.pptx",
  "summary": {
    "totalSlides": 20,
    "analyzedSlides": 18,
    "unanalyzedSlides": 2,
    "avgConfidence": 0.89
  },
  "categoryStats": [
    {
      "categoryCode": "product_function_details",
      "categoryName": "产品功能详解",
      "count": 8,
      "percentage": 44,
      "avgConfidence": 0.92
    }
  ]
}
```

### 4. 获取分类标准

**接口**: `GET /api/ppt-analysis/categories`

**响应**:
```json
{
  "success": true,
  "total": 29,
  "level1Count": 6,
  "level2Count": 23,
  "categories": [
    {
      "id": "xxx",
      "name": "企业信息",
      "code": "enterprise_info",
      "level": 1,
      "children": [
        {
          "id": "yyy",
          "name": "企业基础信息",
          "code": "enterprise_basic_info",
          "level": 2,
          "description": "从企业成立背景、基本规模..."
        }
      ]
    }
  ]
}
```

### 5. 单页测试

**接口**: `POST /api/ppt-analysis/analyze-single`

**请求**:
```json
{
  "slideText": "XX公司成立于2010年...",
  "slideIndex": 0,
  "slideId": "test",
  "modelName": "custom-openai"
}
```

**响应**:
```json
{
  "success": true,
  "result": {
    "category_code": "enterprise_basic_info",
    "confidence": 0.92,
    "reason": "内容涉及企业成立时间、规模...",
    "categoryName": "企业基础信息",
    "categoryDescription": "从企业成立背景..."
  }
}
```

## 🧪 测试

### 运行测试脚本

```bash
cd ai_backend
node scripts/test-ppt-analysis.js
```

测试脚本会：
1. ✅ 测试获取分类标准
2. ✅ 测试单页内容分析
3. ✅ 查找已提取文本的文档
4. ⚠️ 提示完整文档分析(需手动启用)

### 手动测试API

使用Postman或curl测试：

```bash
# 1. 获取分类标准
curl http://localhost:3000/api/ppt-analysis/categories

# 2. 单页测试
curl -X POST http://localhost:3000/api/ppt-analysis/analyze-single \
  -H "Content-Type: application/json" \
  -d '{
    "slideText": "XX公司成立于2010年，是一家专注于金融监管科技的高新技术企业。",
    "modelName": "custom-openai"
  }'

# 3. 分析文档 (替换document_xxx为实际文档ID)
curl -X POST http://localhost:3000/api/ppt-analysis/analyze/document_xxx \
  -H "Content-Type: application/json" \
  -d '{"modelName":"custom-openai"}'
```

## 🔧 配置说明

### AI模型配置

在 `ai_backend/server/config/aiModels.js` 中配置：

```javascript
const modelConfigs = {
  'custom-openai': {
    provider: 'openai',
    model: process.env.CUSTOM_OPENAI_MODEL || 'gpt-4o-mini',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: 'http://10.168.165.50:3000/v1'
  }
}
```

### 提示词配置

在 `ai_backend/server/prompts/pptAnalysisPrompt.js` 中修改提示词。

系统会自动从数据库读取分类标准并注入到提示词中。

## 📊 分类标准

系统使用 **二级分类体系**：

### 一级分类 (6个)
1. **企业信息** - 企业相关信息
2. **合作案例** - 客户合作案例
3. **监管政策与行业背景** - 政策和趋势
4. **产品解决方案** - 产品功能和方案
5. **部署实施及售后保障** - 实施和售后
6. **其他** - 无法归类的内容

### 二级分类 (23个)
每个一级分类下包含多个具体的二级分类，详见数据库 `content_categories_ppt` 表。

## 🐛 常见问题

### Q1: 提示"分类标准数据为空"

**解决方法**:
```bash
cd online-ppt-backend
node prisma/seed-content-categories-ppt.js
```

### Q2: 连接数据库失败

**检查**:
1. `ai_backend/.env` 中的 `DATABASE_URL` 是否正确
2. MySQL服务是否启动
3. 数据库 `aippt` 是否存在

### Q3: AI API调用失败

**检查**:
1. `.env` 中的 `CUSTOM_OPENAI_API_KEY` 是否正确
2. `.env` 中的 `CUSTOM_OPENAI_BASE_URL` 是否可访问
3. 网络是否正常

### Q4: 没有提取的文本内容

**解决方法**:
1. 先使用文档提取功能提取PPT文本
2. 调用 `/api/documents/:id/extract` 接口

## 📝 开发指南

### 添加新的分类标准

1. 在数据库中添加分类：
```sql
INSERT INTO content_categories_ppt 
  (id, parent_id, name, code, level, description, sort_order) 
VALUES 
  (UUID(), 'parent_id', '新分类', 'new_category', 2, '判断标准...', 10);
```

2. AI会自动使用新分类标准

### 自定义提示词

编辑 `ai_backend/server/prompts/pptAnalysisPrompt.js`：

```javascript
function buildPPTAnalysisSystemPrompt(categories) {
  return `你是一位专业的PPT内容分析专家...`
}
```

### 切换AI模型

修改 `.env` 文件：

```env
# 使用标准OpenAI
OPENAI_API_KEY=sk-your-key
OPENAI_BASE_URL=https://api.openai.com/v1
```

调用时指定模型：
```json
{
  "modelName": "gpt-4o"
}
```

## 📞 技术支持

如有问题，请查看：
- [接口文档](../docs/api/)
- [数据库设计](../docs/database-setup-guide.md)
- [环境配置](ENV_CONFIG.md)

---

**最后更新**: 2026-01-03

