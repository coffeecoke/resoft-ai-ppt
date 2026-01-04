# 快速开始指南

## 5 分钟快速上手

### 1️⃣ 单个文档提取

```bash
# 进入 ai_backend 目录
cd ai_backend

# 提取单个文档（使用默认路径）
node DocumentTextExtractor.js

# 查看输出结果
cat output/extracted_text.txt
cat output/extracted_text_merged.txt
```

### 2️⃣ 指定输入文件

```bash
# 提取 document_4.json
node DocumentTextExtractor.js ../online-ppt-backend/data/documents/document_4.json

# 指定输出路径
node DocumentTextExtractor.js \
  ../online-ppt-backend/data/documents/document_7.json \
  ./output/my_result.txt
```

### 3️⃣ 批量提取所有文档

```bash
# 批量处理所有文档
node batch-extract.js

# 结果会保存在 output/ 目录下
ls -l output/
```

### 4️⃣ 运行测试

```bash
# 运行测试脚本验证功能
node test-extractor.js
```

## 输出示例

### 详细版输出（extracted_text.txt）

```
文件名	主ID	子ID	文本内容
====================================================================================================
一表通产品介绍	slide_1	element_1	产品概述
一表通产品介绍	slide_1	element_2	核心功能
一表通产品介绍	slide_1	element_3	适用场景
一表通产品介绍	slide_2	element_1	应用案例
一表通产品介绍	slide_2	element_2	客户反馈
```

### 拼接版输出（extracted_text_merged.txt）

```
文件名	主ID	拼接文本内容
====================================================================================================
一表通产品介绍	slide_1	产品概述 核心功能 适用场景
一表通产品介绍	slide_2	应用案例 客户反馈
```

## 常用命令

### 查看帮助
```bash
node DocumentTextExtractor.js --help
```

### 检查文件格式
```bash
# 使用 jq 工具查看 JSON 结构
cat ../online-ppt-backend/data/documents/document_1.json | jq .
```

### 统计提取结果
```bash
# 统计提取的文本行数
wc -l output/extracted_text.txt

# 查看前 10 行
head -n 10 output/extracted_text.txt

# 搜索特定关键词
grep "关键词" output/extracted_text.txt
```

## 集成到现有项目

### 作为服务使用

在 `online-ppt-backend` 中创建服务：

```javascript
// src/services/textExtractorService.js
const { DocumentTextExtractor } = require('../../ai_backend/DocumentTextExtractor')
const path = require('path')

/**
 * 提取文档文本
 * @param {string} documentId - 文档 ID
 * @returns {Promise<Object>} 提取结果
 */
async function extractDocumentText(documentId) {
  const extractor = new DocumentTextExtractor()
  
  const inputFile = path.join(__dirname, `../../data/documents/document_${documentId}.json`)
  const outputFile = path.join(__dirname, `../../data/extracted/document_${documentId}.txt`)
  
  await extractor.run(inputFile, outputFile)
  
  // 读取提取的文本
  const fs = require('fs').promises
  const content = await fs.readFile(outputFile, 'utf-8')
  
  return {
    documentId,
    outputFile,
    content
  }
}

module.exports = { extractDocumentText }
```

### 创建 API 端点

```javascript
// src/routes/textExtractor.js
const express = require('express')
const router = express.Router()
const { extractDocumentText } = require('../services/textExtractorService')

/**
 * POST /api/extract-text
 * 提取文档文本
 */
router.post('/extract-text', async (req, res) => {
  try {
    const { documentId } = req.body
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: '缺少 documentId 参数'
      })
    }
    
    const result = await extractDocumentText(documentId)
    
    res.json({
      success: true,
      data: result
    })
    
  } catch (error) {
    console.error('提取文本失败:', error)
    res.status(500).json({
      success: false,
      message: '提取文本失败',
      error: error.message
    })
  }
})

module.exports = router
```

### 在主应用中注册路由

```javascript
// src/index.js
const textExtractorRouter = require('./routes/textExtractor')

app.use('/api', textExtractorRouter)
```

## 故障排查

### 问题 1：找不到文件
```bash
# 检查文件路径是否正确
ls -l ../online-ppt-backend/data/documents/

# 使用绝对路径
node DocumentTextExtractor.js \
  /absolute/path/to/document_1.json \
  /absolute/path/to/output.txt
```

### 问题 2：输出文件为空
```bash
# 检查 JSON 结构
node -e "console.log(JSON.stringify(require('./path/to/document.json'), null, 2))"

# 查看是否有 slides 和 elements
```

### 问题 3：中文乱码
```bash
# 确保文件是 UTF-8 编码
file -i document_1.json

# 转换编码
iconv -f GBK -t UTF-8 input.json > output.json
```

## 下一步

- 📖 阅读完整 [README.md](./README.md) 文档
- 🔧 查看 [DocumentTextExtractor.js](./DocumentTextExtractor.js) 源码
- 🧪 运行测试脚本 `test-extractor.js`
- 📦 集成到你的项目中

## 问题反馈

如遇到问题，请检查：
1. ✅ Node.js 版本 >= 14.x
2. ✅ 文件路径正确
3. ✅ JSON 格式有效
4. ✅ 有文件读写权限

如问题仍未解决，请联系项目负责人。

