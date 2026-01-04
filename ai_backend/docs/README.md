# 文档文本提取器 (Document Text Extractor)

Node.js 版本的文档文本提取工具，用于从 PPT 文档的 JSON 格式中提取文本内容。

> 📚 **快速导航**: 
> [快速开始](./QUICK_START.md) | 
> [架构图解](./ARCHITECTURE.md) | 
> [Java对比](./COMPARISON.md) | 
> [输出示例](./output/)

## 📦 项目文件

```
ai_backend/
├── 📄 DocumentTextExtractor.js    # ⭐ 核心提取器（Node.js 版）
├── 📄 DocumentTextExtractor.java  # 原 Java 版本（参考）
├── 📄 batch-extract.js            # 批量提取脚本
├── 📄 test-extractor.js           # 测试脚本
├── 📂 output/                     # 输出目录
│   ├── *.txt                      # 详细版输出
│   └── *_merged.txt               # 拼接版输出
├── 📖 README.md                   # 📍 当前文件 - 完整文档
├── 📖 QUICK_START.md              # 5分钟快速上手
├── 📖 ARCHITECTURE.md             # 架构流程图（Mermaid）
├── 📖 COMPARISON.md               # Java vs Node.js 对比
└── .gitignore                     # Git 忽略规则
```

## ⚡ 快速开始

```bash
# 1. 单文档提取（使用默认路径）
node DocumentTextExtractor.js

# 2. 批量提取所有文档
node batch-extract.js

# 3. 运行测试
node test-extractor.js
```

详细使用说明请查看 [QUICK_START.md](./QUICK_START.md)

## 功能特性

### 核心功能
- ✅ 从 `document_*.json` 文件中提取中文文本内容
- ✅ 支持多种 JSON 结构格式
- ✅ 支持表格元素文本提取
- ✅ 自动解析 HTML 标签（`<span>`）
- ✅ 生成详细版和拼接版两种输出格式

### 提取逻辑

1. **提取文档标题**：读取 `title` 字段作为文件名
2. **遍历所有幻灯片**：处理 `slides` 数组中的每个幻灯片
3. **提取元素文本**：
   - 普通文本元素：从 `text.content` 或 `content` 字段提取
   - 表格元素：遍历 `data` 二维数组提取单元格文本
4. **解析 HTML 内容**：提取 `<span>` 标签内的纯文本
5. **去重和清理**：移除空白文本和重复内容

### 支持的 JSON 结构

#### 结构 1（标准格式）
```json
{
  "title": "文档标题",
  "slides": [
    {
      "id": "slide_1",
      "elements": [
        {
          "id": "element_1",
          "type": "text",
          "text": {
            "content": "<span>这是文本内容</span>"
          }
        }
      ]
    }
  ]
}
```

#### 结构 2（简化格式）
```json
{
  "title": "文档标题",
  "slides": [
    {
      "id": "slide_1",
      "elements": [
        {
          "id": "element_1",
          "type": "text",
          "content": "<span>这是文本内容</span>"
        }
      ]
    }
  ]
}
```

#### 结构 3（表格格式）
```json
{
  "title": "文档标题",
  "slides": [
    {
      "id": "slide_1",
      "elements": [
        {
          "id": "table_1",
          "type": "table",
          "data": [
            [
              { "id": "cell_0_0", "text": "单元格内容" },
              { "id": "cell_0_1", "text": "单元格内容" }
            ],
            [
              { "id": "cell_1_0", "text": "单元格内容" },
              { "id": "cell_1_1", "text": "单元格内容" }
            ]
          ]
        }
      ]
    }
  ]
}
```

## 安装

### 前置条件
- Node.js >= 14.x
- npm 或 pnpm

### 安装步骤
```bash
# 进入 ai_backend 目录
cd ai_backend

# 无需安装额外依赖，使用 Node.js 内置模块
```

## 使用方法

### 1. 命令行使用

#### 使用默认路径
```bash
node DocumentTextExtractor.js
```

默认路径：
- **输入**：`../online-ppt-backend/data/documents/document_1.json`
- **输出**：`./output/extracted_text.txt`

#### 指定输入文件
```bash
node DocumentTextExtractor.js ../online-ppt-backend/data/documents/document_4.json
```

#### 指定输入和输出文件
```bash
node DocumentTextExtractor.js \
  ../online-ppt-backend/data/documents/document_1.json \
  ./output/my_output.txt
```

### 2. 作为模块使用

```javascript
const { DocumentTextExtractor } = require('./DocumentTextExtractor')

async function extractMyDocument() {
  const extractor = new DocumentTextExtractor()
  
  await extractor.run(
    './data/documents/document_1.json',
    './output/extracted_text.txt'
  )
}

extractMyDocument()
```

### 3. 批量处理多个文档

创建批处理脚本 `batch-extract.js`：

```javascript
const { DocumentTextExtractor } = require('./DocumentTextExtractor')
const fs = require('fs').promises
const path = require('path')

async function batchExtract() {
  const extractor = new DocumentTextExtractor()
  const documentsDir = '../online-ppt-backend/data/documents'
  const outputDir = './output'
  
  // 读取所有 JSON 文件
  const files = await fs.readdir(documentsDir)
  const jsonFiles = files.filter(f => f.startsWith('document_') && f.endsWith('.json'))
  
  console.log(`找到 ${jsonFiles.length} 个文档文件`)
  
  for (const file of jsonFiles) {
    console.log(`\n处理: ${file}`)
    const inputFile = path.join(documentsDir, file)
    const outputFile = path.join(outputDir, file.replace('.json', '.txt'))
    
    try {
      await extractor.run(inputFile, outputFile)
    } catch (error) {
      console.error(`处理 ${file} 失败:`, error.message)
    }
  }
  
  console.log('\n✓ 批量处理完成!')
}

batchExtract()
```

运行批处理：
```bash
node batch-extract.js
```

## 输出格式

### 详细版（`extracted_text.txt`）

包含每个文本片段的详细信息：

```
文件名	主ID	子ID	文本内容
====================================================================================================
一表通产品介绍	slide_1	element_1	产品概述
一表通产品介绍	slide_1	element_2	核心功能
一表通产品介绍	slide_2	element_1	应用场景
...
```

**字段说明**：
- **文件名**：文档标题（从 `title` 字段获取）
- **主ID**：幻灯片 ID（`slide.id`）
- **子ID**：元素 ID（`element.id` 或 `cell.id`）
- **文本内容**：提取的纯文本

### 拼接版（`extracted_text_merged.txt`）

按幻灯片合并所有文本：

```
文件名	主ID	拼接文本内容
====================================================================================================
一表通产品介绍	slide_1	产品概述 核心功能 适用场景
一表通产品介绍	slide_2	应用案例 客户反馈
...
```

**特点**：
- 同一幻灯片的所有文本用空格拼接
- 便于分析每页幻灯片的完整内容
- 适合做全文检索或 AI 分析

## 测试用例

### 正常场景测试

#### 测试 1：标准 JSON 格式
```bash
# 输入文件：document_1.json
node DocumentTextExtractor.js ../online-ppt-backend/data/documents/document_1.json output/test1.txt

# 预期结果：
# ✓ 成功提取所有文本
# ✓ 生成 test1.txt 和 test1_merged.txt
# ✓ 文本内容正确且无乱码
```

#### 测试 2：包含表格的文档
```bash
# 输入文件：document_4.json（假设包含表格）
node DocumentTextExtractor.js ../online-ppt-backend/data/documents/document_4.json output/test2.txt

# 预期结果：
# ✓ 正确提取表格单元格文本
# ✓ 表格文本按行列顺序排列
```

#### 测试 3：空内容处理
```bash
# 输入文件：包含空文本元素的文档
node DocumentTextExtractor.js ./test/empty-content.json output/test3.txt

# 预期结果：
# ✓ 自动跳过空文本
# ✓ 不生成空行
```

### 异常场景测试

#### 测试 4：文件不存在
```bash
node DocumentTextExtractor.js ./not-exist.json output/test4.txt

# 预期结果：
# ❌ 错误: ENOENT: no such file or directory
# ✓ 程序优雅退出
```

#### 测试 5：无效 JSON 格式
```bash
# 输入文件：invalid.json（格式错误）
node DocumentTextExtractor.js ./test/invalid.json output/test5.txt

# 预期结果：
# ❌ 错误: Unexpected token in JSON
# ✓ 程序优雅退出
```

#### 测试 6：缺少 slides 字段
```bash
# 输入文件：no-slides.json
node DocumentTextExtractor.js ./test/no-slides.json output/test6.txt

# 预期结果：
# ⚠️ 警告: 未找到slides数组
# ✓ 生成空输出文件
```

## 项目结构

```
ai_backend/
├── DocumentTextExtractor.js    # 主提取器类
├── DocumentTextExtractor.java  # 原 Java 版本（参考）
├── README.md                    # 使用说明
├── batch-extract.js             # 批处理脚本（可选）
├── output/                      # 输出目录
│   ├── extracted_text.txt       # 详细版输出
│   └── extracted_text_merged.txt # 拼接版输出
└── test/                        # 测试文件（可选）
    ├── empty-content.json
    ├── invalid.json
    └── no-slides.json
```

## 技术细节

### 依赖
- **fs/promises**：文件异步读写
- **path**：路径处理
- **正则表达式**：HTML 标签解析

### 核心算法

#### 1. HTML 标签提取
```javascript
// 使用正则表达式匹配 <span> 标签
const spanPattern = /<span[^>]*>([^<]*)<\/span>/g
```

#### 2. HTML 实体解码
```javascript
decodeHtmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
```

#### 3. 文本合并策略
- 使用 `Map` 数据结构保持插入顺序
- 以 `文件名||幻灯片ID` 作为唯一键
- 文本片段用空格拼接

### 与 Java 版本的对比

| 特性 | Java 版本 | Node.js 版本 |
|------|----------|-------------|
| **正则表达式** | `Pattern.compile()` | 原生 `RegExp` |
| **JSON 解析** | Gson 库 | 原生 `JSON.parse()` |
| **文件 I/O** | `Files.readAllBytes()` | `fs.promises` |
| **字符编码** | `StandardCharsets.UTF_8` | 默认 UTF-8 |
| **类型系统** | 强类型 | 弱类型（JavaScript） |
| **异常处理** | `try-catch` | `async/await + try-catch` |

## 常见问题 (FAQ)

### Q1: 为什么没有提取到某些文本？
**A**: 检查以下几点：
1. 确认 JSON 结构是否符合支持的格式
2. 检查文本是否被包裹在 `<span>` 标签内
3. 确认 `element.type` 是否正确标记

### Q2: 输出文件乱码怎么办？
**A**: 
- Node.js 版本默认使用 UTF-8 编码
- 确保输入 JSON 文件也是 UTF-8 编码
- Windows 用户建议使用 VS Code 打开文件

### Q3: 如何只提取特定幻灯片的文本？
**A**: 修改代码，在遍历 slides 时添加过滤条件：
```javascript
// 只处理 id 为 'slide_1' 的幻灯片
for (const slide of slides) {
  if (slide.id !== 'slide_1') continue
  // 处理逻辑...
}
```

### Q4: 能否导出为 JSON 格式？
**A**: 可以，修改 `writeToFile` 方法：
```javascript
async writeToJsonFile(texts, outputFile) {
  const data = texts.map(t => ({
    fileName: t.getFileName(),
    slideId: t.getSlideId(),
    elementId: t.getElementId(),
    text: t.getText()
  }))
  
  await fs.writeFile(
    outputFile.replace('.txt', '.json'),
    JSON.stringify(data, null, 2),
    'utf-8'
  )
}
```

### Q5: 如何集成到现有项目中？
**A**: 作为服务使用：
```javascript
// 在 online-ppt-backend 中创建服务
// src/services/textExtractorService.js
const { DocumentTextExtractor } = require('../../ai_backend/DocumentTextExtractor')

async function extractDocumentText(documentId) {
  const extractor = new DocumentTextExtractor()
  const inputFile = `./data/documents/document_${documentId}.json`
  const outputFile = `./data/extracted/document_${documentId}.txt`
  
  await extractor.run(inputFile, outputFile)
  
  // 读取并返回提取的文本
  const content = await fs.readFile(outputFile, 'utf-8')
  return content
}

module.exports = { extractDocumentText }
```

## 性能优化建议

### 1. 批量处理优化
```javascript
// 使用 Promise.all 并发处理多个文档
const promises = jsonFiles.map(file => 
  extractor.run(inputFile, outputFile)
)
await Promise.all(promises)
```

### 2. 流式读取大文件
```javascript
const { createReadStream } = require('fs')
const readline = require('readline')

// 对于超大 JSON 文件，使用流式解析
```

### 3. 缓存提取结果
```javascript
// 使用 Redis 或内存缓存避免重复提取
const cache = new Map()

async function extractWithCache(documentId) {
  if (cache.has(documentId)) {
    return cache.get(documentId)
  }
  
  const result = await extractor.run(...)
  cache.set(documentId, result)
  return result
}
```

## 更新日志

### v1.0.0 (2026-01-02)
- ✅ 初始版本
- ✅ 从 Java 版本迁移到 Node.js
- ✅ 支持多种 JSON 结构
- ✅ 支持表格元素提取
- ✅ 生成详细版和拼接版输出

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系项目负责人。

