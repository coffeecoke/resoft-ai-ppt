# PPT AI分析 - API测试命令

## 基础测试

### 1. 健康检查
```bash
curl http://localhost:3000/api/health
```

### 2. 获取分类标准
```bash
curl http://localhost:3000/api/ppt-analysis/categories
```

预期返回：包含6个一级分类、23个二级分类的JSON数据。

## 单页分析测试

### 测试1: 企业基础信息
```bash
curl -X POST http://localhost:3000/api/ppt-analysis/analyze-single \
  -H "Content-Type: application/json" \
  -d '{
    "slideText": "XX科技公司成立于2010年，是一家专注于金融监管科技的高新技术企业。公司总部位于北京，在上海、深圳设有分支机构。公司拥有员工200余人，其中研发人员占比60%，年营收达2亿元。",
    "slideIndex": 0,
    "slideId": "test_1",
    "modelName": "custom-openai"
  }'
```

预期分类：`enterprise_basic_info`

### 测试2: 产品功能详解
```bash
curl -X POST http://localhost:3000/api/ppt-analysis/analyze-single \
  -H "Content-Type: application/json" \
  -d '{
    "slideText": "系统提供数据补录、自动校验、报文生成等核心功能。用户可以通过可视化界面进行数据填报，系统自动进行规则校验，并生成符合监管要求的报文文件。支持批量导入导出，大幅提升工作效率。",
    "slideIndex": 1,
    "slideId": "test_2",
    "modelName": "custom-openai"
  }'
```

预期分类：`product_function_details`

### 测试3: 合作案例
```bash
curl -X POST http://localhost:3000/api/ppt-analysis/analyze-single \
  -H "Content-Type: application/json" \
  -d '{
    "slideText": "中国银行：部署监管报送系统，服务全国37家分行。工商银行：实施数据治理平台，覆盖1000+网点。建设银行：上线反洗钱报送系统，日处理数据10万条。",
    "slideIndex": 2,
    "slideId": "test_3",
    "modelName": "custom-openai"
  }'
```

预期分类：`institutional_cooperation`

## 文档分析测试

### 1. 获取文档列表
```bash
curl http://localhost:3000/api/documents/list
```

找到一个已提取文本的文档ID（假设为 `document_123`）。

### 2. 检查提取状态
```bash
curl http://localhost:3000/api/documents/document_123/extract-status
```

### 3. 分析文档（流式）

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/ppt-analysis/analyze/document_123" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"modelName":"custom-openai"}'
```

**Linux/Mac:**
```bash
curl -X POST http://localhost:3000/api/ppt-analysis/analyze/document_123 \
  -H "Content-Type: application/json" \
  -d '{"modelName":"custom-openai"}' \
  --no-buffer
```

### 4. 获取分析结果
```bash
curl http://localhost:3000/api/ppt-analysis/results/document_123
```

### 5. 获取统计信息
```bash
curl http://localhost:3000/api/ppt-analysis/statistics/document_123
```

## 使用Postman测试

### 导入Postman Collection

创建新的Collection，添加以下请求：

#### 1. 获取分类标准
- **Method**: GET
- **URL**: `http://localhost:3000/api/ppt-analysis/categories`

#### 2. 单页分析
- **Method**: POST
- **URL**: `http://localhost:3000/api/ppt-analysis/analyze-single`
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "slideText": "你的测试文本",
  "slideIndex": 0,
  "slideId": "test",
  "modelName": "custom-openai"
}
```

#### 3. 分析文档
- **Method**: POST
- **URL**: `http://localhost:3000/api/ppt-analysis/analyze/:documentId`
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "modelName": "custom-openai"
}
```

#### 4. 获取结果
- **Method**: GET
- **URL**: `http://localhost:3000/api/ppt-analysis/results/:documentId`

#### 5. 获取统计
- **Method**: GET
- **URL**: `http://localhost:3000/api/ppt-analysis/statistics/:documentId`

## 前端JavaScript测试

### 使用Fetch API

```javascript
// 1. 获取分类标准
async function getCategories() {
  const response = await fetch('http://localhost:3000/api/ppt-analysis/categories');
  const data = await response.json();
  console.log('分类标准:', data);
}

// 2. 单页分析
async function analyzeSingle() {
  const response = await fetch('http://localhost:3000/api/ppt-analysis/analyze-single', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      slideText: 'XX公司成立于2010年...',
      modelName: 'custom-openai'
    })
  });
  const data = await response.json();
  console.log('分析结果:', data);
}

// 3. 分析文档（流式）
function analyzeDocument(documentId) {
  const eventSource = new EventSource(
    `http://localhost:3000/api/ppt-analysis/analyze/${documentId}`
  );
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'start') {
      console.log('开始分析:', data.message);
    } else if (data.type === 'progress') {
      console.log(`进度: ${data.progress}% (${data.current}/${data.total})`);
    } else if (data.type === 'complete') {
      console.log('分析完成:', data.results);
      eventSource.close();
    } else if (data.type === 'error') {
      console.error('分析错误:', data.message);
      eventSource.close();
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('连接错误:', error);
    eventSource.close();
  };
}

// 4. 获取结果
async function getResults(documentId) {
  const response = await fetch(
    `http://localhost:3000/api/ppt-analysis/results/${documentId}`
  );
  const data = await response.json();
  console.log('分析结果:', data);
}

// 5. 获取统计
async function getStatistics(documentId) {
  const response = await fetch(
    `http://localhost:3000/api/ppt-analysis/statistics/${documentId}`
  );
  const data = await response.json();
  console.log('统计信息:', data);
}
```

## 故障排查命令

### 检查服务状态
```bash
curl http://localhost:3000/api/health
```

### 检查数据库连接
```bash
cd online-ppt-backend
npx prisma studio
```

### 检查分类数据
```bash
curl http://localhost:3000/api/ppt-analysis/categories | jq '.total'
```

应返回 29（6个一级分类 + 23个二级分类）。

### 检查OpenAI连接
```bash
curl http://10.168.165.50:3000/v1/models \
  -H "Authorization: Bearer sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f"
```

## 性能测试

### 测试单页分析耗时
```bash
time curl -X POST http://localhost:3000/api/ppt-analysis/analyze-single \
  -H "Content-Type: application/json" \
  -d '{"slideText":"测试文本","modelName":"custom-openai"}'
```

### 测试文档分析并发
```bash
# 同时分析多个文档
for i in doc_1 doc_2 doc_3; do
  curl -X POST http://localhost:3000/api/ppt-analysis/analyze/$i \
    -H "Content-Type: application/json" \
    -d '{"modelName":"custom-openai"}' &
done
wait
```

## 常用组合命令

### 完整测试流程
```bash
#!/bin/bash

echo "=== 1. 检查服务健康 ==="
curl http://localhost:3000/api/health
echo -e "\n"

echo "=== 2. 获取分类标准 ==="
curl http://localhost:3000/api/ppt-analysis/categories | jq '.level1Count, .level2Count'
echo -e "\n"

echo "=== 3. 单页测试 ==="
curl -X POST http://localhost:3000/api/ppt-analysis/analyze-single \
  -H "Content-Type: application/json" \
  -d '{"slideText":"XX公司成立于2010年","modelName":"custom-openai"}' \
  | jq '.result.category_code, .result.confidence'
echo -e "\n"

echo "=== 测试完成 ==="
```

保存为 `test.sh`，执行：
```bash
chmod +x test.sh
./test.sh
```

---

**提示**: 
- 将 `document_123` 替换为实际的文档ID
- 确保服务已启动（`npm start`）
- 确保环境变量配置正确
- 使用 `jq` 可以格式化JSON输出：`curl ... | jq .`

