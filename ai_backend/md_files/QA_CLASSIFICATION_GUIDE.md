# 问答对分类功能使用指南

## 📋 功能概述

问答对分类功能用于对从语音转录中提取的问答对进行AI自动分类标注，支持双维度分类：

1. **分类类别（level=2）**：23个分类类别（如"1.1", "2.3"等）
2. **问题性质（level=3）**：5个问题性质（如"I1", "I2"等）

分类结果会自动更新到 `concerns` 表的 `category_id` 和 `intent_code` 字段。

## 🚀 快速开始

### 1. 初始化分类数据

确保数据库中已有分类数据（`concern_categories` 表）：

```bash
# 在 online-ppt-backend 目录下执行
cd online-ppt-backend
npx prisma db seed
```

或者手动执行：

```bash
node prisma/seed-concern-categories.js
```

### 2. 创建模型配置

访问管理后台，创建问答对分类的模型配置：

- **场景类型**：`qa_classification`
- **模型名称**：例如 "GPT-4o" 或 "DeepSeek Chat"
- **设置为默认模型**：勾选（如果希望作为默认模型）

### 3. 创建提示词模板

访问管理后台，创建问答对分类的提示词模板：

- **场景类型**：`qa_classification`
- **模板代码**：例如 `qa_classification_default`
- **提示词内容**：从 `ai_backend/prompts/qa_classification_prompt.txt` 复制内容

或者通过API创建：

```bash
curl -X POST http://localhost:3000/api/admin/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "问答对分类（默认）",
    "code": "qa_classification_default",
    "type": "问答对分类",
    "scene_type": "qa_classification",
    "description": "问答对分类的默认提示词模板",
    "prompt": "...（从qa_classification_prompt.txt复制）",
    "is_active": true
  }'
```

## 📡 API接口

### 1. 对转录记录的所有问答对进行分类

**接口**：`POST /api/transcription/:id/qa-classification`

**参数**：
- `id` (路径参数)：转录记录ID
- `modelId` (可选，body参数)：模型ID，不传则使用默认模型
- `promptCode` (可选，body参数)：提示词代码，不传则使用默认提示词
- `concurrency` (可选，body参数)：并发数，默认3

**示例**：

```bash
curl -X POST http://localhost:3000/api/transcription/trans_123/qa-classification \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "model_xxx",
    "promptCode": "qa_classification_default",
    "concurrency": 3
  }'
```

**响应**：

```json
{
  "success": true,
  "data": {
    "success": true,
    "transcriptionId": "trans_123",
    "total": 10,
    "successCount": 10,
    "errorCount": 0,
    "results": [...],
    "errors": []
  },
  "message": "分类完成：成功 10 个，失败 0 个"
}
```

### 2. 对单个问答对进行分类

**接口**：`POST /api/transcription/concern/:concernId/classification`

**参数**：
- `concernId` (路径参数)：问答对ID
- `modelId` (可选，body参数)：模型ID
- `promptCode` (可选，body参数)：提示词代码

**示例**：

```bash
curl -X POST http://localhost:3000/api/transcription/concern/concern_123/classification \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "model_xxx",
    "promptCode": "qa_classification_default"
  }'
```

**响应**：

```json
{
  "success": true,
  "data": {
    "success": true,
    "concernId": "concern_123",
    "classification": {
      "category_code": "2.3",
      "intent_code": "I1",
      "confidence": 0.95,
      "reason": "该问题询问产品功能特性，属于产品功能类别；客户表现出明确的购买意向，属于I1类型"
    },
    "updated": {
      "category_id": "cat_xxx",
      "category": "2.3",
      "intent_code": "I1"
    }
  },
  "message": "分类成功"
}
```

### 3. 批量对问答对进行分类

**接口**：`POST /api/transcription/concerns/batch-classification`

**参数**：
- `concernIds` (body参数，必填)：问答对ID数组
- `modelId` (可选，body参数)：模型ID
- `promptCode` (可选，body参数)：提示词代码
- `concurrency` (可选，body参数)：并发数，默认3

**示例**：

```bash
curl -X POST http://localhost:3000/api/transcription/concerns/batch-classification \
  -H "Content-Type: application/json" \
  -d '{
    "concernIds": ["concern_1", "concern_2", "concern_3"],
    "modelId": "model_xxx",
    "promptCode": "qa_classification_default",
    "concurrency": 3
  }'
```

## 🔍 分类结果说明

### 分类类别（level=2）

分类结果会更新到 `concerns` 表的 `category_id` 字段，关联到 `concern_categories` 表。

**分类体系**：
- **1.1** - 资质与案例
- **1.2** - 公司规模与背景
- **1.3** - 合作模式
- **1.4** - 监管资源与协作
- **2.1** - 性能与效率
- **2.2** - 产品架构
- **2.3** - 产品功能
- **2.4** - 兼容性与接口扩展
- **3.1** - 监管政策适配
- **3.2** - 数据安全与合规治理
- **3.3** - 业务适配与定制化
- **4.1** - 预算与报价
- **4.2** - 价格竞争力与优惠政策
- **5.1** - POC
- **5.2** - 项目周期
- **5.3** - 项目团队与管控
- **5.4** - 资源配置
- **5.5** - 数据迁移
- **6.1** - 运维支撑
- **6.2** - 培训服务
- **6.3** - 安全支撑
- **6.4** - 其他售后保障

### 问题性质（level=3）

分类结果会更新到 `concerns` 表的 `intent_code` 字段。

**问题性质**：
- **I1** - 明确购买意向
- **I2** - 信息咨询
- **I3** - 疑虑与担忧
- **I4** - 需求确认
- **I5** - 其他

## 📊 使用流程

### 完整流程

1. **语音转录** → 生成转录记录
2. **角色判断** → 标记说话人角色
3. **问答对提取** → 从对话中提取问答对，保存到 `concerns` 表
4. **问答对分类** → 对提取的问答对进行分类标注 ← **本功能**

### 典型使用场景

#### 场景1：转录完成后自动分类

```javascript
// 1. 提取问答对
await fetch('/api/transcription/trans_123/qa-extraction', {
  method: 'POST',
  body: JSON.stringify({})
})

// 2. 对提取的问答对进行分类
await fetch('/api/transcription/trans_123/qa-classification', {
  method: 'POST',
  body: JSON.stringify({
    modelId: 'model_xxx',
    promptCode: 'qa_classification_default',
    concurrency: 3
  })
})
```

#### 场景2：手动对单个问答对分类

```javascript
// 对单个问答对进行分类
await fetch('/api/transcription/concern/concern_123/classification', {
  method: 'POST',
  body: JSON.stringify({
    modelId: 'model_xxx',
    promptCode: 'qa_classification_default'
  })
})
```

#### 场景3：批量重新分类

```javascript
// 获取所有未分类的问答对
const concerns = await fetch('/api/concerns?category_id=null').then(r => r.json())

// 批量分类
await fetch('/api/transcription/concerns/batch-classification', {
  method: 'POST',
  body: JSON.stringify({
    concernIds: concerns.data.map(c => c.id),
    concurrency: 5
  })
})
```

## ⚙️ 配置说明

### 模型配置

在 `ai_model_configs` 表中创建场景类型为 `qa_classification` 的模型配置：

```sql
INSERT INTO ai_model_configs (
  id, name, code, provider, model_name,
  api_url, api_key,
  scene_type, is_default,
  max_tokens, temperature,
  is_active
) VALUES (
  'model_qa_classification_001',
  'GPT-4o（问答对分类）',
  'gpt-4o-qa-classification',
  'openai',
  'gpt-4o',
  'https://api.openai.com/v1',
  'sk-xxx',
  'qa_classification',
  true,
  2000,
  0.7,
  true
);
```

### 提示词模板

在 `prompt_templates` 表中创建场景类型为 `qa_classification` 的提示词模板：

```sql
INSERT INTO prompt_templates (
  id, name, code, type, scene_type,
  description, prompt, is_active
) VALUES (
  'prompt_qa_classification_001',
  '问答对分类（默认）',
  'qa_classification_default',
  '问答对分类',
  'qa_classification',
  '问答对分类的默认提示词模板',
  '...（提示词内容）...',
  true
);
```

## 🐛 故障排查

### 问题1：分类结果为空

**原因**：
- 分类表数据未初始化
- AI返回结果格式不正确
- 提示词模板未创建

**解决**：
1. 检查 `concern_categories` 表是否有数据
2. 检查AI返回的JSON格式是否正确
3. 检查提示词模板是否存在且激活

### 问题2：分类结果不准确

**原因**：
- 提示词模板不够清晰
- 模型选择不当
- 分类数据不完整

**解决**：
1. 优化提示词模板，添加更多示例
2. 尝试使用更强大的模型（如GPT-4）
3. 检查分类表的description和keywords字段是否完整

### 问题3：批量分类失败

**原因**：
- 并发数设置过高
- API调用频率限制
- 数据库连接超时

**解决**：
1. 降低并发数（如从5降到3）
2. 增加重试机制
3. 检查数据库连接池配置

## 📝 注意事项

1. **分类数据依赖**：确保 `concern_categories` 表已初始化，包含level=2和level=3的分类数据
2. **模型配置**：建议为 `qa_classification` 场景配置专门的模型，避免与其他场景冲突
3. **提示词优化**：根据实际效果调整提示词，可以添加更多示例和说明
4. **批量处理**：大批量分类时，注意控制并发数，避免API限流
5. **结果验证**：分类完成后，建议人工抽查部分结果，确保分类准确性

## 🔗 相关文档

- [问答对分类功能说明](../../online-ppt-backend/prisma/README-concern-categories.md)
- [提示词管理指南](./PROMPT_MANAGEMENT_GUIDE.md)
- [模型配置说明](./MODEL_CONFIG_GUIDE.md)

