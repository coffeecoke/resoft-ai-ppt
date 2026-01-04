# 🚀 AI模型扩展说明

## ✅ 更新内容

已将AI模型配置从原来的3个模型扩展到 **20+ 个模型**，全部指向您的自定义API端点：`http://10.168.165.50:3000/v1`

---

## 📋 支持的模型列表

### 🔥 **推荐模型**（新手首选）

| 模型ID | 显示名称 | 特点 | 推荐场景 |
|--------|----------|------|----------|
| `gpt-4o-mini` | GPT-4o Mini | **快速、经济** | ✅ **默认推荐**，日常分析 |
| `gpt-4o` | GPT-4o | 高质量、准确 | 重要文档、精准分类 |
| `deepseek-chat` | DeepSeek Chat | 国产、性价比高 | 大批量处理 |

---

### 🚀 **GPT 系列**

| 模型ID | 显示名称 | 说明 |
|--------|----------|------|
| `gpt-4.1` | GPT-4.1 | 最新GPT-4版本 |
| `gpt-4.1-mini` | GPT-4.1 Mini | 更快速的4.1版本 |
| `gpt-4.1-nano` | GPT-4.1 Nano | 超快速轻量版 |

---

### 🧠 **DeepSeek 系列**（国产，强大）

| 模型ID | 显示名称 | 特点 |
|--------|----------|------|
| `deepseek-chat` | DeepSeek Chat | 通用对话模型 |
| `deepseek-reasoner` | DeepSeek Reasoner | **推理增强**，适合复杂分类 |
| `deepseek-v3` | DeepSeek V3 | V3版本 |
| `deepseek-v3.1` | DeepSeek V3.1 | 最新V3.1版本 |
| `deepseek-r1` | DeepSeek R1 | R1系列 |
| `deepseek-r1:32b` | DeepSeek R1 (32B) | 32B参数大模型 |

---

### 🇨🇳 **通义千问系列**（阿里巴巴）

| 模型ID | 显示名称 | 特点 |
|--------|----------|------|
| `qwen-plus` | 通义千问 Plus | 增强版 |
| `qwen3-max` | 通义千问3 Max | 第三代最强版 |
| `qwen3-coder-flash` | 通义千问3 Coder Flash | 代码优化，快速 |
| `qwen3-coder-plus` | 通义千问3 Coder Plus | 代码优化，增强 |

---

### 🔬 **高级模型**（深度推理）

| 模型ID | 显示名称 | 特点 |
|--------|----------|------|
| `o1` | OpenAI O1 | **深度推理**，复杂问题 |
| `o1-preview` | OpenAI O1 Preview | O1预览版 |
| `o1-mini` | OpenAI O1 Mini | O1轻量版 |
| `resoft-llm` | Resoft LLM | 定制化模型 |

---

### ⚙️ **其他**

| 模型ID | 显示名称 | 说明 |
|--------|----------|------|
| `custom-openai` | 动态模型 | 根据环境变量 `CUSTOM_OPENAI_MODEL` 动态选择 |

---

## 🎯 模型选择建议

### 📊 **根据任务类型选择**

| 任务类型 | 推荐模型 | 原因 |
|----------|----------|------|
| **日常PPT分析** | `gpt-4o-mini` | 快速、准确、经济 |
| **重要文档分类** | `gpt-4o` 或 `deepseek-reasoner` | 高质量、深度分析 |
| **大批量处理** | `deepseek-chat` 或 `gpt-4.1-nano` | 速度快、成本低 |
| **复杂逻辑分析** | `o1` 或 `deepseek-reasoner` | 深度推理能力 |
| **中文内容为主** | `qwen3-max` 或 `deepseek-chat` | 国产模型，中文理解好 |

---

### ⚡ **根据速度和成本选择**

#### **速度优先**
1. `gpt-4.1-nano` ⚡⚡⚡⚡⚡
2. `gpt-4o-mini` ⚡⚡⚡⚡
3. `deepseek-chat` ⚡⚡⚡⚡

#### **质量优先**
1. `o1` ⭐⭐⭐⭐⭐
2. `gpt-4o` ⭐⭐⭐⭐⭐
3. `deepseek-reasoner` ⭐⭐⭐⭐

#### **性价比优先**
1. `deepseek-chat` 💰💰💰💰💰
2. `gpt-4o-mini` 💰💰💰💰
3. `qwen-plus` 💰💰💰💰

---

## 🔧 配置说明

### **统一的API配置**

所有模型都使用同一个API端点：

```javascript
// ai_backend/server/config/aiModels.js
const CUSTOM_API_KEY = 'sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f'
const CUSTOM_BASE_URL = 'http://10.168.165.50:3000/v1'
```

也可以通过环境变量覆盖：

```bash
# ai_backend/.env
CUSTOM_OPENAI_API_KEY=sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f
CUSTOM_OPENAI_BASE_URL=http://10.168.165.50:3000/v1
CUSTOM_OPENAI_MODEL=gpt-4o-mini  # custom-openai 使用的默认模型
```

---

## 🎨 前端展示

### **分组下拉框**

前端使用了 `<optgroup>` 将模型分组：

```html
<select v-model="testData.modelName">
    <optgroup label="🔥 推荐模型">
        <option value="gpt-4o-mini">GPT-4o Mini (快速，推荐)</option>
        ...
    </optgroup>
    <optgroup label="🚀 GPT 系列">
        ...
    </optgroup>
    <optgroup label="🧠 DeepSeek 系列">
        ...
    </optgroup>
    <optgroup label="🇨🇳 通义千问系列">
        ...
    </optgroup>
    <optgroup label="🔬 高级模型">
        ...
    </optgroup>
</select>
```

---

## ✅ 默认设置

- **单页测试默认模型**：`gpt-4o-mini`
- **批量分析默认模型**：`gpt-4o-mini`
- **推荐理由**：快速、准确、性价比高

---

## 🧪 测试步骤

### **1. 重启服务**

```powershell
# 停止当前服务（Ctrl+C）
# 重新启动
Set-Location ai_backend
node server/app.js
```

### **2. 刷新前端页面**

```
http://localhost:3000/analysis.html
```

### **3. 选择模型测试**

- 进入"分析测试"或"批量分析"页面
- 在"AI模型"下拉框中选择任意模型
- 开始分析

---

## 📝 更新日志

### v1.2.0 (2025-01-03)

**✨ 新增功能**：
- 扩展支持 20+ 个AI模型
- 所有模型统一使用自定义API端点
- 前端下拉框分组展示，便于选择
- 默认推荐 `gpt-4o-mini` 模型

**🔧 修改文件**：
- `ai_backend/server/config/aiModels.js` - 扩展模型配置
- `ai_backend/frontend/analysis.html` - 更新模型选择UI
- `ai_backend/frontend/js/analysis.js` - 修改默认模型

**📚 新增文档**：
- `ai_backend/MODEL_EXPANSION.md` - 模型扩展说明

---

## ❓ 常见问题

### Q1: 为什么所有模型都指向同一个API？

**A**: 您的API服务器 `http://10.168.165.50:3000` 是一个**OpenAI兼容的API网关**，它内部聚合了多个模型提供商（OpenAI、DeepSeek、通义千问等）。通过传递不同的 `model` 参数，网关会自动路由到对应的模型。

---

### Q2: 如何知道某个模型是否可用？

**A**: 可以使用测试脚本：

```powershell
cd ai_backend
node test-ai-api.js
```

或者直接调用API：

```bash
curl http://10.168.165.50:3000/v1/models
```

---

### Q3: 不同模型的计费方式是什么？

**A**: 这取决于您的API服务器配置。通常：
- GPT-4系列：较贵，按token计费
- GPT-4o-mini：中等价格
- DeepSeek系列：便宜，国产优势
- 通义千问：阿里巴巴提供，价格适中

具体价格请咨询您的API服务提供商。

---

### Q4: 如何添加更多模型？

**A**: 编辑 `ai_backend/server/config/aiModels.js`，参考现有格式添加：

```javascript
'新模型ID': {
  provider: 'openai',
  model: '新模型ID',
  displayName: '显示名称',
  envKey: 'CUSTOM_OPENAI_API_KEY',
  envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
  defaultBaseUrl: CUSTOM_BASE_URL
}
```

然后在前端 `ai_backend/frontend/analysis.html` 的 `<select>` 中添加对应的 `<option>`。

---

## 🎉 总结

现在您可以自由选择 **20+ 个AI模型** 进行PPT内容分析了！

**推荐流程**：
1. 先用 `gpt-4o-mini` 测试（默认）
2. 如果结果不理想，尝试 `gpt-4o` 或 `deepseek-reasoner`
3. 大批量处理用 `deepseek-chat` 或 `gpt-4.1-nano`
4. 中文内容为主用 `qwen3-max`

祝您使用愉快！🚀

