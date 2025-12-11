# 🎯 Resoft AI PPT - 智能PPT生成系统

> 基于 [PPTist](https://github.com/pipipi-pikachu/PPTist) 二次开发的AI驱动在线PPT生成系统

[![Vue](https://img.shields.io/badge/Vue-3.5-green.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📖 项目简介

**Resoft AI PPT** 是一个智能PPT生成系统，用户只需输入主题，AI即可自动生成完整的演示文稿。系统支持多种国内外大模型，具备流式输出、模板匹配、实时编辑等能力。

### ✨ 核心特性

- 🤖 **AI智能生成** - 输入主题自动生成大纲和PPT内容
- 🎨 **多模板支持** - 内置多套精美模板，支持自定义模板
- 🌊 **流式输出** - 实时显示生成进度，用户体验流畅
- 🔌 **多模型适配** - 支持智谱、通义、豆包、DeepSeek、OpenAI等
- 📝 **完整编辑** - 基于PPTist的完整PPT编辑能力
- 📤 **多格式导出** - 支持导出为PPTX、PDF、图片等格式

---

## 🏗️ 项目架构

```
resoft-ai-ppt/
├── online-ppt-web/          # 前端项目 (Vue3 + TypeScript + Pinia)
├── online-ppt-backend/      # 后端项目 (Node.js + Express)
└── README.md                # 本文档
```

### 架构流程图

```mermaid
%%{init: {'theme':'dark'}}%%
flowchart LR
    subgraph User["👤 用户"]
        A[输入PPT主题]
    end
    
    subgraph Frontend["🖥️ 前端 Vue3"]
        B[主题输入界面]
        C[大纲编辑器]
        D[PPT编辑器]
        E[模板渲染引擎]
    end
    
    subgraph Backend["⚙️ 后端 Node.js"]
        F[/tools/aippt_outline]
        G[/tools/aippt]
        H[AI Service]
    end
    
    subgraph AI["🤖 大模型"]
        I[智谱GLM]
        J[通义千问]
        K[豆包]
        L[DeepSeek]
        M[OpenAI]
    end
    
    A --> B
    B -->|1.生成大纲| F
    F --> H --> I & J & K & L & M
    H -->|Markdown大纲| C
    C -->|2.生成PPT| G
    G --> H
    H -->|JSON数据| E
    E --> D
    
    style User fill:#2d3748,stroke:#a0aec0
    style Frontend fill:#1a365d,stroke:#4299e1
    style Backend fill:#1a3a1a,stroke:#48bb78
    style AI fill:#3a1a3a,stroke:#d53f8c
```

---

## 🛠️ 技术栈

### 前端 (online-ppt-web)

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.5.17 | 核心框架 |
| TypeScript | 5.3 | 类型系统 |
| Pinia | 3.0.2 | 状态管理 |
| Vite | 5.3.5 | 构建工具 |
| Axios | 1.7.9 | HTTP客户端 |
| ProseMirror | 1.x | 富文本编辑 |
| PPTXGenJS | 3.12.0 | PPT导出 |
| ECharts | 6.0.0 | 图表渲染 |

### 后端 (online-ppt-backend)

| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥18.0 | 运行环境 |
| Express | 4.18.2 | Web框架 |
| OpenAI SDK | 4.24.0 | 大模型调用 |
| CORS | 2.8.5 | 跨域支持 |
| dotenv | 16.3.1 | 环境变量 |

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18.0
- npm 或 pnpm
- 至少一个AI模型的API Key

### 1. 克隆项目

```bash
git clone https://github.com/coffeecoke/resoft-ai-ppt.git
cd resoft-ai-ppt
```

### 2. 启动后端服务

```bash
cd online-ppt-backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key

# 启动服务（开发模式）
npm run dev
```

服务启动后监听端口：`http://localhost:5001`

### 3. 启动前端项目

```bash
cd online-ppt-web

# 安装依赖
npm install
# 或使用 pnpm
pnpm install

# 启动开发服务器
npm run dev
```

前端访问地址：`http://localhost:5173`

### 4. 配置 API Key

在 `online-ppt-backend/.env` 文件中配置（至少配置一个）：

```bash
# 智谱AI (推荐，国内速度快，免费额度充足)
ZHIPU_API_KEY=your-zhipu-api-key

# 豆包 (字节跳动)
DOUBAO_API_KEY=your-doubao-api-key

# 通义千问 (阿里云)
QWEN_API_KEY=your-qwen-api-key

# DeepSeek
DEEPSEEK_API_KEY=your-deepseek-api-key

# Moonshot/Kimi
MOONSHOT_API_KEY=your-moonshot-api-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，自定义代理
```

---

## 📡 API 接口文档

### 接口清单

| HTTP方法 | 路径 | 功能 | 响应类型 |
|----------|------|------|----------|
| POST | `/tools/aippt_outline` | 生成PPT大纲 | 流式Markdown |
| POST | `/tools/aippt` | 生成PPT内容 | 流式JSON |
| POST | `/tools/ai_writing` | AI文本处理 | 流式文本 |
| GET | `/tools/models` | 获取模型列表 | JSON |
| GET | `/health` | 健康检查 | JSON |

---

### API 1: 生成PPT大纲

**POST** `/tools/aippt_outline`

根据用户输入的主题，生成Markdown格式的PPT大纲。

**请求参数：**

```json
{
  "content": "人工智能发展趋势",
  "language": "中文",
  "model": "GLM-4.5-Flash",
  "stream": true
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| content | string | ✅ | - | PPT主题 |
| language | string | ❌ | 中文 | 输出语言 |
| model | string | ❌ | GLM-4.5-Flash | AI模型 |
| stream | boolean | ❌ | true | 是否流式 |

**响应示例（流式Markdown）：**

```markdown
# 人工智能发展趋势

## AI技术概述
### 什么是人工智能
- 人工智能的定义与内涵
- 发展历程回顾
- 主要技术分支

## 应用领域
### 医疗健康
- AI辅助诊断
- 药物研发加速
- 健康管理
...
```

---

### API 2: 生成PPT内容

**POST** `/tools/aippt`

将Markdown大纲转换为结构化的PPT数据。

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

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| content | string | ✅ | - | Markdown大纲 |
| language | string | ❌ | 中文 | 输出语言 |
| style | string | ❌ | 通用 | 风格：通用/学术风/职场风/教育风/营销风 |
| model | string | ❌ | GLM-4.5-Flash | AI模型 |
| stream | boolean | ❌ | true | 是否流式 |

**响应示例（流式JSON，每行一个）：**

```json
{"type":"cover","data":{"title":"人工智能发展趋势","text":"探索AI技术的现在与未来"}}
{"type":"contents","data":{"items":["AI技术概述","应用领域","发展趋势","挑战与机遇"]}}
{"type":"transition","data":{"title":"AI技术概述","text":"了解人工智能的基本概念"}}
{"type":"content","data":{"title":"什么是人工智能","items":[{"title":"定义","text":"模拟人类智能的计算机系统"}]}}
{"type":"end"}
```

---

### API 3: AI文本处理

**POST** `/tools/ai_writing`

对文本进行润色、扩写、缩写等处理。

**请求参数：**

```json
{
  "content": "需要处理的文本内容",
  "command": "rewrite",
  "model": "GLM-4.5-Flash",
  "stream": true
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | ✅ | 待处理文本 |
| command | string | ✅ | 指令：rewrite/expand/abbreviate/polish |

---

### API 4: 获取模型列表

**GET** `/tools/models`

**响应示例：**

```json
[
  { "value": "GLM-4.5-Flash", "label": "GLM-4.5-Flash (智谱)", "provider": "智谱AI" },
  { "value": "qwen-turbo", "label": "Qwen-Turbo (通义千问)", "provider": "阿里云" },
  { "value": "deepseek-chat", "label": "DeepSeek-Chat", "provider": "DeepSeek" }
]
```

---

## 🤖 支持的AI模型

| 模型名称 | 提供商 | 环境变量 | 推荐场景 |
|----------|--------|----------|----------|
| GLM-4.5-Flash | 智谱AI | `ZHIPU_API_KEY` | ⭐ 推荐，速度快，免费额度充足 |
| GLM-4-Plus | 智谱AI | `ZHIPU_API_KEY` | 效果更好，适合正式场景 |
| qwen-turbo | 阿里云 | `QWEN_API_KEY` | 性价比高 |
| qwen-plus | 阿里云 | `QWEN_API_KEY` | 效果更好 |
| ark-doubao-seed-1.6-flash | 字节跳动 | `DOUBAO_API_KEY` | 速度快 |
| deepseek-chat | DeepSeek | `DEEPSEEK_API_KEY` | 性价比高，推理能力强 |
| moonshot-v1-8k | 月之暗面 | `MOONSHOT_API_KEY` | Kimi模型 |
| gpt-4o-mini | OpenAI | `OPENAI_API_KEY` | 国际服务，效果稳定 |
| gpt-4o | OpenAI | `OPENAI_API_KEY` | 效果最好 |

---

## 📂 项目结构详解

### 前端项目结构

```
online-ppt-web/
├── src/
│   ├── main.ts                    # 应用入口
│   ├── App.vue                    # 根组件
│   │
│   ├── assets/                    # 静态资源
│   │   ├── fonts/                 # 字体文件 (22款中文字体)
│   │   └── styles/                # 全局样式 (SCSS)
│   │
│   ├── components/                # 通用组件库
│   │   ├── ColorPicker/           # 颜色选择器
│   │   ├── Contextmenu/           # 右键菜单
│   │   ├── LaTeXEditor/           # LaTeX公式编辑器
│   │   └── ...                    # Button/Input/Modal等基础组件
│   │
│   ├── hooks/                     # 组合式函数 (核心业务逻辑)
│   │   ├── useAIPPT.ts           # 🔥 AI生成PPT核心逻辑
│   │   ├── useExport.ts          # 导出功能
│   │   ├── useImport.ts          # 导入功能
│   │   ├── useSlideHandler.ts    # 幻灯片操作
│   │   └── ...
│   │
│   ├── services/                  # API服务层
│   │   ├── config.ts             # Axios配置
│   │   └── index.ts              # 🔥 API接口定义
│   │
│   ├── store/                     # Pinia状态管理
│   │   ├── main.ts               # 主状态 (编辑模式等)
│   │   ├── slides.ts             # 幻灯片数据状态
│   │   ├── snapshot.ts           # 历史快照 (撤销/重做)
│   │   └── keyboard.ts           # 键盘状态
│   │
│   ├── types/                     # TypeScript类型定义
│   │   ├── slides.ts             # 幻灯片类型
│   │   └── AIPPT.ts              # AI PPT数据类型
│   │
│   ├── utils/                     # 工具函数
│   │   ├── prosemirror/          # 富文本编辑器相关
│   │   └── htmlParser/           # HTML解析器
│   │
│   └── views/                     # 页面视图
│       ├── Editor/               # 编辑器主视图
│       ├── Mobile/               # 移动端视图
│       └── Screen/               # 放映视图
│
├── public/
│   └── mocks/                    # Mock数据
│       ├── AIPPT.json           # AI PPT示例数据
│       └── template_*.json      # 模板文件
│
├── doc/                          # 文档
│   └── AIPPT.md                 # AIPPT原理说明
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 后端项目结构

```
online-ppt-backend/
├── src/
│   ├── index.js                  # 🔥 Express入口，路由注册
│   │
│   ├── config/
│   │   └── models.js             # 🔥 多模型配置 (API地址、Key映射)
│   │
│   ├── routes/
│   │   └── tools.js              # 🔥 API路由定义
│   │
│   ├── services/
│   │   └── aiService.js          # 🔥 AI服务封装 (流式响应处理)
│   │
│   └── prompts/
│       ├── outlinePrompt.js      # 大纲生成Prompt模板
│       └── aipptPrompt.js        # PPT生成Prompt模板
│
├── .env.example                  # 环境变量示例
├── package.json
└── README.md
```

---

## 🎨 AIPPT 模板系统

### 工作原理

1. **定义PPT结构** - 封面页、目录页、过渡页、内容页、结束页
2. **AI生成数据** - 根据大纲生成结构化JSON数据
3. **模板匹配** - 将数据与预设模板进行匹配
4. **渲染输出** - 生成可编辑的PPT页面

### 页面类型

| 类型 | 说明 | 包含元素 |
|------|------|----------|
| cover | 封面页 | 标题、副标题、背景图 |
| contents | 目录页 | 目录项列表 (支持1-20项) |
| transition | 过渡页 | 章节标题、说明文字、节编号 |
| content | 内容页 | 页面标题、内容项 (标题+正文) |
| end | 结束页 | 致谢语、背景图 |

### 模板制作

详见 [AIPPT模板制作指南](./online-ppt-web/doc/AIPPT.md)

---

## 🔧 开发指南

### 前端开发

```bash
cd online-ppt-web

# 开发模式
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 构建生产版本
npm run build
```

### 后端开发

```bash
cd online-ppt-backend

# 开发模式 (支持热重载)
npm run dev

# 生产模式
npm start
```

### 调试技巧

1. **前端调试** - 使用Vue DevTools + 浏览器控制台
2. **后端调试** - 查看终端日志，关注 `[大纲生成]` `[PPT生成]` 前缀
3. **流式响应** - 使用浏览器Network面板查看EventStream

---

## ❓ 常见问题

### 1. API Key配置问题

**问题**：提示"请配置 XXX_API_KEY 环境变量"

**解决**：
1. 检查 `.env` 文件是否存在
2. 确认API Key填写正确，无多余空格
3. 重启后端服务

### 2. 跨域问题

**问题**：前端请求后端报CORS错误

**解决**：
1. 后端已配置CORS，检查前端 `SERVER_URL` 配置
2. 开发环境使用 `/api` 代理（Vite配置）

### 3. 流式响应不生效

**问题**：PPT生成时一次性返回，而非逐步显示

**解决**：
1. 检查浏览器是否支持ReadableStream
2. 确认请求参数 `stream: true`
3. 检查前端流处理代码

### 4. 模板不匹配

**问题**：AI生成内容与模板不匹配，显示异常

**解决**：
1. 检查模板JSON格式是否正确
2. 确认模板包含所有必需的页面类型
3. 查看控制台错误信息

---

## 📝 更新日志

### v1.0.0 (当前版本)
- ✅ 基于PPTist二次开发
- ✅ 集成多家国内外大模型
- ✅ 实现流式输出
- ✅ 完成前后端分离架构

---

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

前端项目基于 [PPTist](https://github.com/pipipi-pikachu/PPTist) 二次开发，感谢原作者的开源贡献。

---

## 🔗 相关链接

- [PPTist 原项目](https://github.com/pipipi-pikachu/PPTist)
- [智谱AI开放平台](https://open.bigmodel.cn/)
- [通义千问](https://dashscope.aliyun.com/)
- [DeepSeek](https://platform.deepseek.com/)

---

<p align="center">
  Made with ❤️ by Resoft Team
</p>
