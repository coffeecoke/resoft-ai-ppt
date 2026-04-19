# AI后台管理系统 - 快速开始指南

## 📦 已完成的内容

### 1. 数据库层（online-ppt-backend）
- ✅ 新增 `ai_model_configs` 表（AI模型配置）
- ✅ 扩展 `prompt_templates` 表（提示词模板）
- ✅ 迁移脚本和初始化脚本

### 2. 服务层（ai_backend/server）
- ✅ `modelConfigService` - 模型配置服务
- ✅ `promptTemplateService` - 提示词模板服务  
- ✅ `aiServiceUnified` - 统一AI调用服务
- ✅ 工具类（prisma, logger, crypto）

### 3. API路由（ai_backend/server/routes）
- ✅ `/api/admin/models/*` - 模型配置管理
- ✅ `/api/admin/prompts/*` - 提示词管理
- ✅ `/api/admin/system/*` - 系统设置

### 4. 前端页面（ai_backend/frontend）
- ✅ 控制台（dashboard）
- ✅ 模型配置管理（model-config）
- ⏸️ 提示词管理（prompt-templates）- 待完善
- ⏸️ AI功能页面 - 待开发

## 🚀 部署步骤

### 第一步：数据库迁移

```bash
# 进入后端目录
cd online-ppt-backend

# 执行迁移（Windows）
prisma\migrate-ai-backend.bat

# 或（Linux/Mac）
chmod +x prisma/migrate-ai-backend.sh
./prisma/migrate-ai-backend.sh

# 初始化默认模型配置
node prisma/seed-ai-models.js
```

### 第二步：配置环境变量

编辑 `online-ppt-backend/.env`，添加API密钥：

```env
# 数据库连接
DATABASE_URL="mysql://user:password@localhost:3306/your_database"

# 加密密钥（32字符）
ENCRYPTION_KEY="your-32-character-encryption-key"

# 讯飞星火
XFYUN_API_URL=https://spark-api.xf-yun.com/v1
XFYUN_API_KEY=your_key
XFYUN_API_SECRET=your_secret

# 通义千问
QWEN_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_API_KEY=your_key

# OpenAI
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_API_KEY=your_key
```

### 第三步：安装依赖

```bash
cd ai_backend
npm install
```

需要安装的新依赖：
- `uuid` - 生成唯一ID
- `@prisma/client` - 数据库访问
- `openai` - AI调用（已有）

### 第四步：启动服务

```bash
cd ai_backend
npm start
```

访问管理后台：**http://localhost:3000/admin.html**

## 📖 使用说明

### 管理后台功能

#### 1. 控制台
- 查看系统统计信息
- 查看各场景的模型和提示词配置情况
- 查看AI调用统计

#### 2. 模型配置管理
- **添加模型**：点击"添加模型"按钮，填写配置信息
- **编辑模型**：点击"编辑"按钮修改配置
- **设为默认**：每个场景必须有一个默认模型
- **删除模型**：删除不再使用的配置（默认模型不可删除）

#### 3. 提示词管理
- 查看和编辑提示词模板
- 测试提示词渲染
- 版本管理

### API调用示例

#### 在服务中使用统一AI服务

```javascript
const { aiService } = require('./services');

// 方式1：直接传入提示词字符串
const result = await aiService.chat('ppt_analysis', '分析这段文本...');

// 方式2：使用提示词模板
const result = await aiService.chat('ppt_analysis', {
  code: 'ppt_analysis_v1',  // 提示词模板代码
  variables: {
    text: '待分析的文本',
    categories: JSON.stringify(categories)
  }
});

// 方式3：指定特定模型
const result = await aiService.chat('ppt_analysis', '...', {
  modelId: 'specific-model-id'
});

// 流式调用
await aiService.chatStream('ppt_analysis', '...', (chunk) => {
  console.log(chunk);  // 每收到一个chunk就回调
});
```

#### 改造现有服务

以PPT分析服务为例，改造前后对比：

**改造前**：
```javascript
const { getModelConfig } = require('../config/aiModels');
const { OpenAI } = require('openai');

const config = getModelConfig('default');
const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseUrl
});

const response = await client.chat.completions.create({
  model: config.model,
  messages: [{ role: 'user', content: prompt }],
});
```

**改造后**：
```javascript
const { aiService } = require('./services');

// 自动使用ppt_analysis场景的默认模型和提示词
const result = await aiService.chat('ppt_analysis', {
  variables: {
    text: pageText,
    categories: JSON.stringify(categories)
  }
});
```

## 📋 API接口文档

### 模型配置管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/models` | GET | 获取所有模型配置 |
| `/api/admin/models/scenes/:sceneType` | GET | 获取指定场景的模型 |
| `/api/admin/models/default/:sceneType` | GET | 获取默认模型 |
| `/api/admin/models` | POST | 创建模型配置 |
| `/api/admin/models/:id` | PUT | 更新模型配置 |
| `/api/admin/models/:id/set-default` | PUT | 设为默认模型 |
| `/api/admin/models/:id` | DELETE | 删除模型配置 |

### 提示词管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/prompts` | GET | 获取所有提示词模板 |
| `/api/admin/prompts/scenes/:sceneType` | GET | 获取指定场景的模板 |
| `/api/admin/prompts` | POST | 创建提示词模板 |
| `/api/admin/prompts/:id` | PUT | 更新提示词模板 |
| `/api/admin/prompts/:id` | DELETE | 删除提示词模板 |
| `/api/admin/prompts/test/render` | POST | 测试提示词渲染 |

### 系统设置

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/system/scenes` | GET | 获取所有场景列表 |
| `/api/admin/system/providers` | GET | 获取所有AI提供商列表 |
| `/api/admin/system/stats` | GET | 获取系统统计信息 |
| `/api/admin/system/health` | GET | 健康检查 |

## 🔒 安全建议

1. **API密钥加密**：所有密钥在数据库中已加密存储
2. **环境变量**：敏感信息通过环境变量配置
3. **访问控制**：建议添加认证中间件（预留）

## 🐛 故障排查

### 问题1：迁移失败
- 检查数据库连接
- 确保 `online-ppt-backend/.env` 配置正确
- 查看 `prisma/MIGRATION_GUIDE.md`

### 问题2：前端无法访问
- 确认服务已启动：`npm start`
- 访问：`http://localhost:3000/admin.html`
- 检查控制台错误信息

### 问题3：AI调用失败
- 检查模型配置中的API密钥是否正确
- 检查API地址是否可访问
- 查看服务器日志

## 📝 后续开发建议

### 高优先级
1. ✅ 完善提示词管理页面
2. ✅ 添加提示词测试功能
3. ✅ 实现AI功能页面（语音转文本、PPT分析等）

### 中优先级
4. ✅ 添加用户认证
5. ✅ 添加操作日志
6. ✅ 添加成本统计和预警

### 低优先级
7. ✅ 支持更多AI提供商
8. ✅ 支持模型自动切换（故障转移）
9. ✅ 支持批量导入/导出配置

## 📞 技术支持

如有问题，请查看：
- 数据库迁移指南：`online-ppt-backend/prisma/MIGRATION_GUIDE.md`
- 实现总结：`ai_backend/IMPLEMENTATION_SUMMARY.md`

---

**版本**: v1.0.0  
**最后更新**: 2025-01-05

