# 语音转录 AI 错别字修正及角色判断功能增强

## 📋 功能说明

对语音转录的对话内容进行 AI 错别字修正和角色判断，并自动保存到数据库。

### 主要特性

1. **错别字修正**：
   - 修正同音字/近音字错误
   - 修正明显错别字
   - 规范语序混乱
   - 补充语义不完整
   - 清理不必要的语气词

2. **角色判断**（针对金融场景优化）：
   - 客户（customer）：银行/金融机构
   - 我方（our_side）：产品/服务供应商
   - 未知（unknown）：无法判断

3. **分批处理**：
   - 支持大量对话的分批处理（默认每批50条）
   - 自动合并多批次的修正结果
   - 自动选择置信度最高的角色判断

4. **自动保存**：
   - 修正后的对话自动保存到 `transcriptions.dialogues` 字段
   - 角色设置自动保存到 `transcriptions.speaker_roles` 字段
   - 自动更新说话人数量

---

## 🔧 技术实现

### 1. 提示词模板

**文件位置**：`ai_backend/prompts/transcription_correction_prompt_enhanced.txt`

**场景类型**：`transcription_correction`

**特色功能**：
- 针对金融场景的特殊判断逻辑
- "我们行/我们银行" → 客户方
- "我们公司/我们产品" → 我方（供应商）
- "贵行"、"你们系统" → 客户方
- 介绍案例（"XX银行用的是"）→ 我方

### 2. 服务层改进

**文件**：`ai_backend/server/services/transcriptionAiService.js`

**新增功能**：

#### `correctTyposAndRoles(dialogues, options)`
- 支持分批处理（`options.batchSize`，默认50）
- 支持进度回调（`options.onProgress`）
- 自动合并多批次结果
- 自动选择置信度最高的角色判断

#### `processBatch(batchDialogues, systemPrompt, modelName, options)`
- 处理单批对话的私有方法

#### `mergeCorrections(originalDialogues, correctedDialogues)`
- 合并原始对话和修正结果
- 保留原始对话结构

#### `extractRoleSettings(correctedDialogues)`（增强）
- 从所有对话中提取角色判断
- 选择置信度最高的角色（排除 unknown）

### 3. 路由层改进

**文件**：`ai_backend/server/routes/transcriptionRoutes.js`

**接口**：`POST /api/transcription/:id/ai-correction`

**参数**：
- `modelName`（可选）：指定使用的 AI 模型
- `autoSave`（可选，默认 `true`）：是否自动保存到数据库

**返回数据**：
```json
{
  "success": true,
  "message": "AI 分析完成并已保存",
  "data": {
    "original": [...], // 原始对话
    "corrected": [...], // 修正后的对话
    "summary": {
      "totalDialogues": 100,
      "correctedCount": 15,
      "customerSpeakers": ["SPEAKER_1"],
      "ourSideSpeakers": ["SPEAKER_2"],
      "unknownSpeakers": []
    },
    "roleSettings": {
      "SPEAKER_1": "customer",
      "SPEAKER_2": "our_side"
    },
    "processingTime": 5000,
    "modelName": "gpt-4",
    "batchCount": 2,
    "saved": true
  },
  "transcription": {...} // 更新后的转录记录
}
```

---

## 💾 数据库存储

### 字段说明

1. **`dialogues`** (LONGTEXT)
   - 存储修正后的对话内容（JSON 数组）
   - 格式：
     ```json
     [
       {
         "timeRange": "00:00-00:05",
         "speaker": "SPEAKER_1",
         "text": "修正后的文本内容"
       }
     ]
     ```

2. **`speaker_roles`** (LONGTEXT)
   - 存储说话人角色设置（JSON 对象）
   - 格式：
     ```json
     {
       "SPEAKER_1": "customer",
       "SPEAKER_2": "our_side"
     }
     ```

3. **`speaker_count`** (INT)
   - 自动更新说话人数量

---

## 📊 分批处理逻辑

### 处理流程

1. **判断是否需要分批**：
   - 对话数量 ≤ 50：直接处理
   - 对话数量 > 50：启用分批处理

2. **分批处理**：
   - 每批 50 条对话（可配置）
   - 逐批调用 AI 进行处理
   - 批次间有 100ms 延迟，避免请求过快

3. **结果合并**：
   - 合并所有批次的修正对话
   - 合并角色判断（选择置信度最高的）
   - 合并统计数据

4. **保存到数据库**：
   - 修正后的对话 → `dialogues` 字段
   - 角色设置 → `speaker_roles` 字段
   - 说话人数量 → `speaker_count` 字段

### 示例

**输入**：200 条对话

**处理**：
- 第 1 批：1-50 条
- 第 2 批：51-100 条
- 第 3 批：101-150 条
- 第 4 批：151-200 条

**输出**：
- 200 条修正后的对话
- 合并后的角色设置
- 统一的统计数据

---

## 🎯 使用示例

### 1. 前端调用（自动保存）

```javascript
// 调用 AI 修正接口（自动保存到数据库）
const response = await fetch(`/api/transcription/${id}/ai-correction`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelName: 'gpt-4', // 可选
    autoSave: true // 默认 true，自动保存
  })
});

const result = await response.json();
console.log('修正完成:', result.data.summary);
console.log('角色设置:', result.data.roleSettings);
console.log('已保存到数据库:', result.data.saved);
```

### 2. 前端调用（仅分析，不保存）

```javascript
// 仅分析，不保存（用于预览）
const response = await fetch(`/api/transcription/${id}/ai-correction`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    autoSave: false // 不自动保存
  })
});

const result = await response.json();
// 查看结果后，手动保存
await fetch(`/api/transcription/${id}/apply-corrections`, {
  method: 'PUT',
  body: JSON.stringify({
    correctedDialogues: result.data.corrected,
    roleSettings: result.data.roleSettings
  })
});
```

---

## 📝 提示词模板配置

### 创建提示词模板

1. 打开"提示词管理"页面
2. 点击"新增提示词"
3. 填写信息：
   - **模板名称**：语音转录错别字修正及角色判断（金融场景增强版）
   - **模板代码**：`transcription_correction_enhanced_v1`
   - **场景类型**：`transcription_correction`
   - **提示词内容**：复制 `ai_backend/prompts/transcription_correction_prompt_enhanced.txt` 的内容
   - **版本号**：`1.0`
   - **启用状态**：✅ 启用

### 提示词特色

- ✅ 针对金融场景的特殊判断逻辑
- ✅ 详细说明"我们行"、"贵行"等关键词汇的判断规则
- ✅ 清晰的错别字修正原则
- ✅ 完整的输入输出格式说明
- ✅ 丰富的示例和场景说明

---

## 🔍 角色判断规则总结

### 客户方（customer）特征

1. **"我们行/我们银行"** + 讨论自己的需求/建设
   - "我们行现在用的是老系统"
   - "我们银行想了解一下你们的产品"

2. **使用"你们"指代供应商**
   - "你们系统的价格是多少？"
   - "你们公司有银行案例吗？"

3. **提问、咨询、表达需求**
   - "这个功能能实现吗？"
   - "我们需要一个XX方案"

### 我方（our_side）特征

1. **"我们公司/我们产品/我们系统"** + 介绍功能/服务
   - "我们公司的产品主要有三个功能"
   - "我们系统支持实时监控"

2. **介绍其他客户案例**
   - "我们在工商银行那边实施过类似的方案"
   - "XX银行用的是我们这套系统"

3. **回答问题、解释说明、引导对话**
   - "这个功能主要用来..."
   - "我们有XX案例..."

---

## ⚠️ 注意事项

1. **分批处理**：
   - 大量对话会自动分批处理，处理时间会相应增加
   - 建议在前端显示进度提示

2. **角色判断**：
   - 对于简短对话（少于10字），可能无法准确判断，会标记为 `unknown`
   - 角色判断基于置信度，系统会自动选择置信度最高的结果

3. **数据保存**：
   - 默认自动保存到数据库
   - 如需预览后再保存，可设置 `autoSave: false`

4. **提示词配置**：
   - 确保场景类型为 `transcription_correction` 的提示词模板已启用
   - 如未配置，系统会使用内置默认提示词（功能较简单）

---

## 📈 性能优化

1. **分批处理**：避免单次请求过大导致超时
2. **批量合并**：智能合并多批次结果，避免数据丢失
3. **置信度选择**：自动选择置信度最高的角色判断
4. **延迟控制**：批次间延迟 100ms，避免请求过快

---

## 🔄 更新日志

### v1.0 (2025-01-XX)
- ✅ 实现分批处理功能
- ✅ 增强角色判断逻辑（针对金融场景）
- ✅ 自动保存修正结果到数据库
- ✅ 优化提示词模板（金融场景专用）
- ✅ 添加进度回调支持

