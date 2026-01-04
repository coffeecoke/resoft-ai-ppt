# PPT AI分析功能 - 快速安装指南

## 📦 安装步骤

### 1. 安装Node.js依赖

```bash
cd ai_backend
npm install
```

新增的依赖包：
- `openai@^4.24.0`

### 2. 配置环境变量

创建 `.env` 文件（从模板复制）：

```bash
cd ai_backend

# Windows
copy .env.example .env

# Linux/Mac  
cp .env.example .env
```

编辑 `.env` 文件，填入以下配置：

```env
# 数据库连接（连接online-ppt-backend的MySQL）
DATABASE_URL="mysql://root:你的密码@localhost:3306/aippt"

# OpenAI配置（您提供的接口）
CUSTOM_OPENAI_API_KEY=sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f
CUSTOM_OPENAI_BASE_URL=http://10.168.165.50:3000/v1
CUSTOM_OPENAI_MODEL=gpt-4o-mini

# 服务端口
PORT=3000
```

### 3. 初始化数据库

在 `online-ppt-backend` 目录执行：

```bash
cd online-ppt-backend

# 生成Prisma客户端
npx prisma generate

# 执行数据库迁移（创建prompt_templates表）
npx prisma migrate dev --name add_prompt_templates

# 初始化分类数据（如果还没执行过）
node prisma/seed-content-categories-ppt.js
```

### 4. 启动服务

```bash
cd ai_backend
npm start
```

看到以下输出表示启动成功：

```
============================================================
文档文本提取器 - Web 服务已启动
============================================================
🌐 访问地址: http://localhost:3000
📁 输出目录: E:\dev-chat-ppt\ai_backend\output
📤 上传目录: E:\dev-chat-ppt\ai_backend\uploads

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

  [PPT内容分析 - 新增]
  - 分析文档: POST   /api/ppt-analysis/analyze/:documentId
  - 获取结果: GET    /api/ppt-analysis/results/:documentId
  - 获取统计: GET    /api/ppt-analysis/statistics/:documentId
  - 分类标准: GET    /api/ppt-analysis/categories
  - 单页测试: POST   /api/ppt-analysis/analyze-single
============================================================
```

## ✅ 验证安装

### 测试1: 检查分类标准

```bash
curl http://localhost:3000/api/ppt-analysis/categories
```

应该返回包含6个一级分类、23个二级分类的JSON数据。

### 测试2: 运行测试脚本

```bash
cd ai_backend
node scripts/test-ppt-analysis.js
```

### 测试3: 单页分析测试

```bash
curl -X POST http://localhost:3000/api/ppt-analysis/analyze-single \
  -H "Content-Type: application/json" \
  -d "{\"slideText\":\"XX公司成立于2010年，专注于金融监管科技。\"}"
```

应该返回分类结果。

## 🎯 使用流程

### 完整流程示例

```bash
# 1. 获取文档列表（找到document_id）
curl http://localhost:3000/api/documents/list

# 2. 确保文档已提取文本（如果没有，先提取）
curl -X POST http://localhost:3000/api/documents/{document_id}/extract

# 3. 分析文档内容
curl -X POST http://localhost:3000/api/ppt-analysis/analyze/{document_id} \
  -H "Content-Type: application/json" \
  -d '{"modelName":"custom-openai"}'

# 4. 查看分析结果
curl http://localhost:3000/api/ppt-analysis/results/{document_id}

# 5. 查看统计信息
curl http://localhost:3000/api/ppt-analysis/statistics/{document_id}
```

## 📁 项目结构

```
ai_backend/
├── server/
│   ├── app.js                      # 主应用（已更新）
│   ├── config/
│   │   ├── database.js             # 数据库配置
│   │   └── aiModels.js             # AI模型配置（新增）
│   ├── prompts/
│   │   └── pptAnalysisPrompt.js    # 分析提示词（新增）
│   ├── services/
│   │   ├── documentService.js      # 文档服务
│   │   ├── aiService.js            # AI服务（新增）
│   │   └── pptAnalysisService.js   # 分析服务（新增）
│   └── routes/
│       ├── documentRoutes.js       # 文档路由
│       └── pptAnalysisRoutes.js    # 分析路由（新增）
├── scripts/
│   └── test-ppt-analysis.js        # 测试脚本（新增）
├── package.json                    # 依赖配置（已更新）
├── .env.example                    # 环境变量模板（新增）
├── .env                            # 环境变量（需创建）
└── PPT_ANALYSIS_README.md          # 详细文档（新增）
```

## 🔧 配置说明

### 数据库配置

确保 `online-ppt-backend` 的数据库已经正确配置并运行：

```bash
# 检查数据库连接
cd online-ppt-backend
npx prisma studio
```

### OpenAI配置

您提供的OpenAI兼容接口：
- **地址**: http://10.168.165.50:3000/v1
- **令牌**: sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f
- **模型**: gpt-4o-mini

## ⚠️ 注意事项

1. **端口冲突**: 如果3000端口被占用，修改 `.env` 中的 `PORT`
2. **数据库连接**: 确保 `DATABASE_URL` 正确，数据库服务已启动
3. **API密钥**: 确保OpenAI API密钥有效且有足够额度
4. **分类数据**: 首次使用前必须执行分类数据初始化脚本

## 📚 更多文档

详细使用说明请查看：
- [完整文档](PPT_ANALYSIS_README.md)
- [API接口文档](PPT_ANALYSIS_README.md#-api接口文档)
- [常见问题](PPT_ANALYSIS_README.md#-常见问题)

## 🆘 故障排查

### 问题1: npm install失败

```bash
# 清除缓存重试
npm cache clean --force
npm install
```

### 问题2: 数据库连接失败

检查：
1. MySQL服务是否启动
2. 数据库名、用户名、密码是否正确
3. 端口是否正确（默认3306）

### 问题3: AI调用失败

检查：
1. API密钥是否正确
2. API地址是否可访问
3. 网络连接是否正常

```bash
# 测试API连接
curl http://10.168.165.50:3000/v1/models \
  -H "Authorization: Bearer sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f"
```

---

**安装完成！** 🎉

如有问题，请查看 [PPT_ANALYSIS_README.md](PPT_ANALYSIS_README.md) 获取详细帮助。

