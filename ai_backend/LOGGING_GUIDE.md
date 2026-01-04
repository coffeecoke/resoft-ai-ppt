# 📊 AI后台日志系统使用指南

## 一、日志输出位置

### 1. **服务器终端日志（实时）**

**查看方式**：
- **IDE终端**：在Cursor中查看终端15的输出
- **终端文件**：`c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\15.txt`
- **PowerShell窗口**：如果是独立窗口启动的，直接查看该窗口

**包含内容**：
```
✅ 服务器启动信息
✅ API请求路径和方法
✅ PPT分析进度
✅ 数据库查询
✅ 错误堆栈信息
```

---

## 二、日志级别说明

### 📝 **信息日志（console.log）**

#### **服务启动日志**
```
[AI后台] 服务器已启动！
[AI后台] 访问地址: http://localhost:3003
[AI后台] 前端页面: http://localhost:3003/
```

#### **PPT分析日志**
```
[PPT分析] 开始分析文档: doc_123456789
[PPT分析] 使用模型: custom-openai
[PPT分析] 共找到 45 个页面需要分析
[PPT分析] 正在分析页面 1 (slide_001)...
[PPT分析] 页面 1 分析完成: title_page (置信度: 0.95)
[PPT分析] 页面 1 分类更新成功: title_page
[PPT分析] 跳过页面 2: 内容为空
[PPT分析] 文档分析完成!
[PPT分析] 成功: 40, 失败: 3, 跳过: 2
```

#### **文档管理日志**
```
[AI后台] 查询文档列表: { page: 1, pageSize: 20, status: 'completed' }
[AI后台] 提取文档内容: { id: 'doc_123', extract_method: 'ai', force: false }
[AI后台] 提取完成: { document_id: 'doc_123', slides_count: 45 }
```

### ❌ **错误日志（console.error）**

```
[PPT分析] 分析失败 (页面 5): Invalid JSON response from AI
[PPT分析] 文档分析失败: Error: Document not found
PPT分析错误: Error: Connection timeout
获取提示词列表失败: Error: Database connection failed
```

---

## 三、关键日志示例

### ✅ **成功案例**

#### 批量分析成功
```log
[PPT分析] 开始分析文档: doc_1735876543210_qwerty
[PPT分析] 使用模型: custom-openai
[PPT分析] 共找到 12 个页面需要分析
[PPT分析] 正在分析页面 1 (slide_001)...
[PPT分析] 页面 1 分析完成: title_page (置信度: 0.98)
[PPT分析] 页面 1 分类更新成功: title_page
[PPT分析] 正在分析页面 2 (slide_002)...
[PPT分析] 页面 2 分析完成: menu_guide (置信度: 0.92)
[PPT分析] 页面 2 分类更新成功: menu_guide
...
[PPT分析] 文档分析完成!
[PPT分析] 成功: 12, 失败: 0, 跳过: 0
```

### ❌ **失败案例**

#### AI返回格式错误
```log
[PPT分析] 正在分析页面 5 (slide_005)...
[PPT分析] 分析失败 (页面 5): AI返回格式不正确: 期望JSON，收到纯文本
PPT分析错误: Error: Invalid AI response format
    at PPTAnalysisService.analyzeSingleSlide (E:\dev-chat-ppt\ai_backend\server\services\pptAnalysisService.js:125)
```

#### 数据库连接失败
```log
获取提示词列表失败: Error: Can't reach database server at `localhost:3306`
    at PrismaClient.connect
```

#### 文档不存在
```log
[PPT分析] 文档分析失败: Error: 文档不存在或未完成提取
    at PPTAnalysisService.analyzeDocument (E:\dev-chat-ppt\ai_backend\server\services\pptAnalysisService.js:145)
```

---

## 四、实时查看日志

### **方法1：IDE终端（推荐）**

1. 在Cursor中点击底部"终端"面板
2. 选择终端15（运行 `node server/app.js` 的终端）
3. 实时滚动查看日志

### **方法2：读取终端文件**

```powershell
# 实时监控日志（PowerShell）
Get-Content "c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\15.txt" -Wait -Tail 50
```

### **方法3：使用Cursor工具**

在Cursor聊天框中：
```
请读取终端15的日志，显示最后50行
```

---

## 五、日志排查流程

### 🔍 **问题排查步骤**

#### **步骤1：确认服务是否运行**

查找日志中的启动信息：
```
[AI后台] 服务器已启动！
[AI后台] 访问地址: http://localhost:3003
```

如果没有，说明服务未启动或已崩溃。

---

#### **步骤2：查看API请求日志**

批量分析时应该看到：
```
[PPT分析] 开始分析文档: doc_xxxxx
```

如果没有：
- ✅ 检查前端是否正确发送请求
- ✅ 检查浏览器Console是否有错误
- ✅ 检查API路径是否正确

---

#### **步骤3：查看分析进度**

正常应该看到：
```
[PPT分析] 正在分析页面 1 (slide_001)...
[PPT分析] 页面 1 分析完成: title_page (置信度: 0.95)
[PPT分析] 页面 1 分类更新成功: title_page
```

如果中断：
- ✅ 查看最后一条日志的错误信息
- ✅ 检查AI API是否可用
- ✅ 检查数据库连接是否正常

---

#### **步骤4：查看错误堆栈**

错误日志会显示：
```
[PPT分析] 分析失败 (页面 5): 具体错误原因
PPT分析错误: Error: 详细错误信息
    at 错误发生的文件和行号
```

根据错误信息定位问题。

---

## 六、常见问题日志特征

### 1. **AI API连接失败**

**日志特征**：
```
[PPT分析] 分析失败 (页面 1): fetch failed
或
Error: connect ECONNREFUSED 10.168.165.50:3000
```

**解决方案**：
- 检查 `ai_backend/.env` 中的 `CUSTOM_OPENAI_BASE_URL`
- 确认AI服务器 `http://10.168.165.50:3000` 是否可访问
- 测试命令：`curl http://10.168.165.50:3000/v1/models`

---

### 2. **AI返回格式错误**

**日志特征**：
```
[PPT分析] 分析失败 (页面 3): AI返回格式不正确: 期望JSON
```

**解决方案**：
- 检查提示词是否明确要求返回JSON格式
- 查看AI实际返回的内容（会在错误日志中）
- 调整提示词中的JSON格式说明

---

### 3. **数据库查询失败**

**日志特征**：
```
[PPT分析] 文档分析失败: Error: 文档不存在或未完成提取
或
获取提示词列表失败: Error: Can't reach database server
```

**解决方案**：
- 确认 `online-ppt-backend/.env` 中的 `DATABASE_URL` 正确
- 检查MySQL服务是否运行
- 确认文档ID是否存在且状态为 `completed`

---

### 4. **SSE连接中断**

**日志特征**：
```
（前端浏览器Console）
分析过程中断
或
EventSource failed
```

**服务器日志可能显示**：
```
PPT分析错误: Error: Response timeout
```

**解决方案**：
- 检查网络连接
- 确认是否使用了GET方式调用批量分析API
- 查看浏览器Network面板中EventSource的状态

---

## 七、增强日志输出（可选）

如果需要更详细的日志，可以修改代码：

### **添加AI响应日志**

编辑 `ai_backend/server/services/pptAnalysisService.js`：

```javascript
// 在 analyzeSingleSlide 方法中，AI调用后添加：
const content = response.choices[0]?.message?.content || ''
console.log(`[PPT分析] AI原始响应 (页面 ${slideIndex + 1}):`, content.substring(0, 200)) // 截取前200字符

// 解析JSON后添加：
console.log(`[PPT分析] 解析结果 (页面 ${slideIndex + 1}):`, JSON.stringify(result, null, 2))
```

### **添加数据库操作日志**

编辑 `ai_backend/server/routes/pptAnalysisRoutes.js`：

```javascript
// 在批量分析路由中添加：
console.log('[PPT分析] 准备更新数据库:', {
  document_id: documentId,
  thumbnail_id: slide.thumbnail_id,
  category_code: analysisResult.category_code
})
```

---

## 八、日志文件导出（手动）

如果需要保存完整日志用于分析：

```powershell
# 导出完整日志到文件
Get-Content "c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\15.txt" > "logs_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
```

---

## 九、快速诊断命令

### **检查服务状态**
```powershell
# 检查端口3003是否被占用（服务是否运行）
netstat -ano | findstr :3003
```

### **查看最新日志**
```powershell
# 显示最后30行日志
Get-Content "c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\15.txt" -Tail 30
```

### **搜索错误日志**
```powershell
# 查找所有错误信息
Get-Content "c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\15.txt" | Select-String "错误|Error|失败"
```

---

## 十、日志解读示例

### **完整的批量分析日志流程**

```log
1. 收到请求
   GET /api/ppt-analysis/analyze/doc_123?modelName=custom-openai&promptId=prompt_001

2. 开始分析
   [PPT分析] 开始分析文档: doc_123
   [PPT分析] 使用模型: custom-openai
   [PPT分析] 共找到 10 个页面需要分析

3. 逐页分析
   [PPT分析] 正在分析页面 1 (slide_001)...
   [PPT分析] 页面 1 分析完成: title_page (置信度: 0.95)
   [PPT分析] 页面 1 分类更新成功: title_page
   
   [PPT分析] 正在分析页面 2 (slide_002)...
   [PPT分析] 页面 2 分析完成: menu_guide (置信度: 0.88)
   [PPT分析] 页面 2 分类更新成功: menu_guide
   
   ... (重复)

4. 完成
   [PPT分析] 文档分析完成!
   [PPT分析] 成功: 10, 失败: 0, 跳过: 0
```

---

## 📌 **使用建议**

1. ✅ **每次测试前**：清空终端或记录当前行号，方便定位新日志
2. ✅ **遇到问题时**：先查看服务器日志，再查看浏览器Console
3. ✅ **长时间分析**：使用文件监控方式实时查看日志
4. ✅ **提交Bug**：导出完整日志文件供分析

---

## 🔧 **当前日志系统总结**

| 功能 | 状态 | 位置 |
|------|------|------|
| 服务启动日志 | ✅ 已实现 | 终端输出 |
| PPT分析进度 | ✅ 已实现 | 终端输出 |
| 错误堆栈信息 | ✅ 已实现 | 终端输出 |
| 文档管理日志 | ✅ 已实现 | 终端输出 |
| 提示词管理日志 | ⚠️ 部分 | 仅错误日志 |
| 日志文件输出 | ❌ 未实现 | 可手动导出 |
| 分级日志系统 | ❌ 未实现 | 仅console |

**当前足够用于排查问题！** 如需更高级的日志系统（如winston/log4js），请告知！

