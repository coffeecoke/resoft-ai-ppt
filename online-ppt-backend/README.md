# AI PPT Generator - Node.js 后端服务

这是 AI PPT Generator 的后端服务，提供大纲生成和PPT生成的API接口，与 PPTist 前端配合使用。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置你要使用的AI模型的API Key：

```bash
# 智谱AI (推荐，国内速度快)
ZHIPU_API_KEY=your-zhipu-api-key

# 或者其他模型...
```

### 3. 启动服务

```bash
# 开发模式（支持热重载）
npm run dev

# 生产模式
npm start
```

服务启动后访问: http://localhost:5000

## 📡 API 接口

### 1. 大纲生成

**POST** `/tools/aippt_outline`

生成PPT的Markdown格式大纲。

**请求参数：**

```json
{
  "content": "人工智能发展趋势",
  "language": "中文",
  "model": "GLM-4.5-Flash",
  "stream": true
}
```

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| content | string | ✅ | PPT主题 |
| language | string | ❌ | 语言，默认"中文" |
| model | string | ❌ | AI模型，默认"GLM-4.5-Flash" |
| stream | boolean | ❌ | 是否流式返回，默认true |

**响应（流式）：**

```markdown
# 人工智能发展趋势

## AI技术概述
### 什么是人工智能
- 人工智能的定义
- 发展历程
- 主要技术分支

## 应用领域
### 医疗健康
- 辅助诊断
- 药物研发
...
```

---

### 2. PPT生成

**POST** `/tools/aippt`

将Markdown大纲转换为PPTist可用的JSON数据。

**请求参数：**

```json
{
  "content": "# 人工智能发展趋势\n## AI技术概述\n...",
  "language": "中文",
  "style": "通用",
  "model": "GLM-4.5-Flash",
  "stream": true
}
```

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| content | string | ✅ | Markdown格式的大纲 |
| language | string | ❌ | 语言，默认"中文" |
| style | string | ❌ | 风格：通用/学术风/职场风/教育风/营销风 |
| model | string | ❌ | AI模型，默认"GLM-4.5-Flash" |
| stream | boolean | ❌ | 是否流式返回，默认true |

**响应（流式，每行一个JSON）：**

```json
{"type":"cover","data":{"title":"人工智能发展趋势","text":"探索AI技术的现在与未来"}}
{"type":"contents","data":{"items":["AI技术概述","应用领域","发展趋势","挑战与机遇"]}}
{"type":"transition","data":{"title":"AI技术概述","text":"了解人工智能的基本概念"}}
{"type":"content","data":{"title":"什么是人工智能","items":[{"title":"定义","text":"模拟人类智能的计算机系统"},{"title":"发展历程","text":"从1956年至今近70年"}]}}
{"type":"end"}
```

---

### 3. 获取支持的模型列表

**GET** `/tools/models`

**响应：**

```json
[
  { "value": "GLM-4.5-Flash", "label": "GLM-4.5-Flash (智谱)", "provider": "智谱AI" },
  { "value": "qwen-turbo", "label": "Qwen-Turbo (通义千问)", "provider": "阿里云" },
  ...
]
```

---

## 🤖 支持的AI模型

| 模型 | 提供商 | 环境变量 | 说明 |
|-----|-------|---------|------|
| GLM-4.5-Flash | 智谱AI | ZHIPU_API_KEY | 推荐，速度快 |
| GLM-4-Plus | 智谱AI | ZHIPU_API_KEY | 效果更好 |
| qwen-turbo | 阿里云 | QWEN_API_KEY | 性价比高 |
| qwen-plus | 阿里云 | QWEN_API_KEY | 效果更好 |
| doubao-seed-1.6-flash | 字节跳动 | DOUBAO_API_KEY | 速度快 |
| deepseek-chat | DeepSeek | DEEPSEEK_API_KEY | 性价比高 |
| moonshot-v1-8k | 月之暗面 | MOONSHOT_API_KEY | Kimi |
| gpt-4o-mini | OpenAI | OPENAI_API_KEY | 国际服务 |
| gpt-4o | OpenAI | OPENAI_API_KEY | 效果最好 |

## 📁 项目结构

```
server/
├── src/
│   ├── index.js              # 入口文件
│   ├── config/
│   │   └── models.js         # AI模型配置
│   ├── routes/
│   │   └── tools.js          # API路由
│   ├── services/
│   │   └── aiService.js      # AI服务封装
│   └── prompts/
│       ├── outlinePrompt.js  # 大纲生成Prompt
│       └── aipptPrompt.js    # PPT生成Prompt
├── .env.example              # 环境变量示例
├── package.json
└── README.md
```

## 🔗 与PPTist前端对接

1. 在PPTist前端修改 `src/services/index.ts` 中的 `SERVER_URL`：

```typescript
export const SERVER_URL = 'http://localhost:5000'
```

2. 确保API路径一致：
   - 大纲生成: `POST /tools/aippt_outline`
   - PPT生成: `POST /tools/aippt`

## 📝 数据格式说明

### AIPPTSlide 类型

| type | 说明 | data字段 |
|------|------|---------|
| cover | 封面页 | `{title, text}` |
| contents | 目录页 | `{items: string[]}` |
| transition | 过渡页 | `{title, text}` |
| content | 内容页 | `{title, items: [{title, text}]}` |
| end | 结束页 | 无 |

## 🐛 常见问题

### 1. API Key 配置问题

确保在 `.env` 文件中正确配置了对应模型的 API Key。

### 2. 跨域问题

服务已配置CORS，如果仍有问题，检查前端请求地址是否正确。

### 3. 流式响应问题

确保前端正确处理流式响应，PPTist已有相关代码可参考。

## 📄 License

MIT
