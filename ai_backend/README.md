# 文档文本提取器 - AI Backend

> 一个强大的文档文本提取工具，支持命令行和 Web 界面两种使用方式

## 🚀 快速开始

### 方式一：Web 界面（推荐）

```bash
cd ai_backend
npm install
npm start
```

然后访问：**http://localhost:3000**

### 方式二：命令行

```bash
# 单个文件提取
node core/extractors/DocumentTextExtractor.js <输入文件> <输出文件>

# 批量提取
npm run batch
```

---

## 📁 项目结构

```
ai_backend/
├── 📂 core/                        # 核心功能模块
│   ├── extractors/                # 提取器
│   │   └── DocumentTextExtractor.js  # 文档文本提取核心类
│   └── utils/                     # 工具函数（预留扩展）
│
├── 📂 server/                      # Web 服务
│   ├── app.js                     # Express 主服务器
│   ├── routes/                    # API 路由
│   ├── middleware/                # 中间件（预留）
│   └── config/                    # 配置文件（预留）
│
├── 📂 scripts/                     # 脚本工具
│   ├── batch-extract.js           # 批量提取脚本
│   ├── test-extractor.js          # 测试脚本
│   └── test-external-file.js      # 外部文件测试
│
├── 📂 frontend/                    # 前端界面
│   ├── index.html                 # 主页面
│   ├── css/                       # 样式文件
│   └── js/                        # 前端脚本
│
├── 📂 docs/                        # 项目文档
│   ├── README_WEB.md              # Web 版详细文档
│   ├── COMPARISON.md              # Java vs Node.js 对比
│   ├── ARCHITECTURE.md            # 架构流程图
│   ├── QUICK_START.md             # 快速开始指南
│   └── PROJECT_SUMMARY.md         # 项目总结
│
├── 📂 output/                      # 输出目录（按日期分层）
│   └── YYYY-MM-DD/                # 按日期组织
│       ├── xxx_timestamp.txt      # 详细版输出
│       └── xxx_timestamp_merged.txt  # 拼接版输出
│
├── 📂 uploads/                     # 临时上传目录（Web 使用）
│
├── 📄 package.json                 # 项目配置
├── 📄 .gitignore                   # Git 忽略规则
├── 📄 start.ps1                    # Windows 快速启动脚本
└── 📄 README.md                    # 本文档
```

---

## ✨ 功能特性

### 核心功能（core/）
- ✅ 从 JSON 文档中提取中文文本
- ✅ 支持多种 JSON 结构格式
- ✅ 支持表格元素文本提取
- ✅ HTML 标签解析和实体解码
- ✅ 详细版和拼接版双输出

### Web 服务（server/）
- ✅ 文件上传接口
- ✅ 批量提取处理
- ✅ 历史记录查询
- ✅ 静态文件服务
- ✅ RESTful API
- ✅ **文档管理功能（新增）**
  - 查询数据库中的文档列表
  - 根据文档ID提取内容到数据库
  - 检查文档提取状态
  - 批量提取文档

### 前端界面（frontend/）
- ✅ 拖拽上传文件
- ✅ 实时进度显示
- ✅ 提取结果下载
- ✅ 历史记录管理
- ✅ 响应式设计

### 输出管理（output/）
- ✅ 按日期自动分类存储
- ✅ 文件名包含时间戳
- ✅ 避免文件名冲突

---

## 📖 使用指南

### 命令行模式

#### 单个文件提取
```bash
node core/extractors/DocumentTextExtractor.js \
  ../online-ppt-backend/data/documents/document_1.json \
  output/result.txt
```

#### 批量提取
```bash
npm run batch
```

#### 运行测试
```bash
npm test
```

### Web 模式

#### 启动服务
```bash
npm start
# 或开发模式（自动重启）
npm run dev
```

#### 访问界面
打开浏览器：**http://localhost:3000**

#### 操作步骤
1. 拖拽或选择 JSON 文件
2. 点击"开始提取"
3. 查看提取进度
4. 下载提取结果

详细使用说明请查看：[docs/README_WEB.md](./docs/README_WEB.md)

---

## 🔌 API 接口

### 原有功能
**文件提取**
```http
POST /api/extract
Content-Type: multipart/form-data
```

**历史记录**
```http
GET /api/history
```

**健康检查**
```http
GET /api/health
```

### 文档管理功能（新增）

**文档列表**
```http
GET /api/documents/list?page=1&pageSize=20&keyword=客户A
```

**提取文档内容**
```http
POST /api/documents/:id/extract
Content-Type: application/json

{
  "extract_method": "auto",
  "force": false
}
```

**检查提取状态**
```http
GET /api/documents/:id/extract-status
```

**批量提取**
```http
POST /api/documents/batch-extract
Content-Type: application/json

{
  "document_ids": ["document_1", "document_4"],
  "extract_method": "auto",
  "force": false
}
```

完整文档管理 API 文档：[docs/DOCUMENT_EXTRACT_GUIDE.md](./docs/DOCUMENT_EXTRACT_GUIDE.md)

完整 API 文档：[docs/README_WEB.md](./docs/README_WEB.md)

---

## 📚 文档导航

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 📍 主文档（当前） |
| [docs/DOCUMENT_EXTRACT_GUIDE.md](./docs/DOCUMENT_EXTRACT_GUIDE.md) | 📋 **文档管理功能使用指南（新增）** |
| [docs/README_WEB.md](./docs/README_WEB.md) | Web 版详细使用指南 |
| [docs/QUICK_START.md](./docs/QUICK_START.md) | 5 分钟快速上手 |
| [docs/COMPARISON.md](./docs/COMPARISON.md) | Java vs Node.js 技术对比 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 架构流程图 |
| [docs/PROJECT_SUMMARY.md](./docs/PROJECT_SUMMARY.md) | 项目交付总结 |

---

## 🛠️ 后续扩展计划

### 核心模块扩展（core/）
- [ ] 添加 PDF 文本提取器
- [ ] 添加 Word 文档提取器
- [ ] 添加 Excel 表格提取器
- [ ] 实现文本向量化（AI 集成）
- [ ] 实现关键词提取
- [ ] 实现文本摘要生成

### 工具函数（core/utils/）
- [ ] 文件格式验证
- [ ] 日志记录工具
- [ ] 错误处理工具
- [ ] 数据转换工具

### 服务端扩展（server/）
- [ ] 用户认证中间件
- [ ] 权限管理
- [ ] 数据库集成
- [ ] 任务队列（Redis）
- [ ] 缓存机制
- [ ] API 限流

### 前端扩展（frontend/）
- [ ] 文件预览功能
- [ ] 提取结果在线编辑
- [ ] 数据可视化分析
- [ ] 导出多种格式（Excel、CSV）

---

## 💻 开发指南

### 添加新的提取器

在 `core/extractors/` 下创建新的提取器类：

```javascript
// core/extractors/PdfTextExtractor.js
class PdfTextExtractor {
  async extract(inputFile, outputFile) {
    // 实现 PDF 提取逻辑
  }
}

module.exports = { PdfTextExtractor }
```

### 添加新的 API 路由

在 `server/routes/` 下创建路由文件：

```javascript
// server/routes/pdf.js
const express = require('express')
const router = express.Router()

router.post('/extract-pdf', async (req, res) => {
  // 处理 PDF 提取请求
})

module.exports = router
```

然后在 `server/app.js` 中注册：

```javascript
const pdfRoutes = require('./routes/pdf')
app.use('/api/pdf', pdfRoutes)
```

---

## 🔧 配置说明

### 环境变量
```bash
PORT=3000                    # 服务器端口
MAX_FILE_SIZE=52428800       # 最大上传文件大小（50MB）
OUTPUT_DIR=./output          # 输出目录
UPLOAD_DIR=./uploads         # 上传临时目录
```

### 修改配置
编辑 `server/app.js` 文件中的常量

---

## 🐛 故障排查

### 常见问题

1. **端口被占用**
   ```bash
   # 查找并关闭占用 3000 端口的进程
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. **依赖安装失败**
   ```bash
   # 清除缓存重新安装
   npm cache clean --force
   npm install
   ```

3. **提取失败**
   - 检查 JSON 文件格式
   - 查看服务器控制台日志
   - 确认文件路径正确

---

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| 单文件提取速度 | ~80ms |
| 最大文件大小 | 50MB |
| 内存占用 | ~50MB |
| 并发处理 | 支持队列 |

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

MIT License

---

## 📞 联系方式

- 📧 提交 Issue
- 💬 查看文档：[docs/](./docs/)
- 🌐 访问界面：http://localhost:3000

---

<p align="center">
  <strong>🎉 感谢使用文档文本提取器！</strong>
</p>

