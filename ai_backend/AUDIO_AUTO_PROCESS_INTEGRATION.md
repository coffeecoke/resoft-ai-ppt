# 音频自动跑批功能集成指南

## 📋 功能概述

在自动跑批监控系统中新增**音频自动转录**功能，与现有的PPT跑批并行工作。

---

## 🆕 新增功能

### 1. 音频自动跑批服务
- **文件位置**：`ai_backend/server/services/audioAutoProcessService.js`
- **功能**：
  - 定时扫描配置的音频目录
  - 自动识别未转录的音频文件
  - 调用讯飞API自动转录
  - 保存转录结果到数据库
  - 记录处理日志

### 2. API接口（已添加）

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 获取状态 | GET | `/api/auto-process/audio/status` | 获取音频跑批当前状态 |
| 启动服务 | POST | `/api/auto-process/audio/start` | 启动音频自动跑批 |
| 停止服务 | POST | `/api/auto-process/audio/stop` | 停止音频自动跑批 |
| 获取配置 | GET | `/api/auto-process/audio/config` | 获取音频跑批配置 |
| 更新配置 | PUT | `/api/auto-process/audio/config` | 更新音频跑批配置 |
| 获取统计 | GET | `/api/auto-process/audio/statistics` | 获取统计信息 |
| 获取日志 | GET | `/api/auto-process/audio/logs` | 获取处理日志 |
| 清空日志 | DELETE | `/api/auto-process/audio/logs` | 清空日志 |
| 手动执行 | POST | `/api/auto-process/audio/run-once` | 立即执行一次 |

---

## 🎯 前端集成方案

### 方案一：Tab切换（推荐）

在现有的 `auto-process.html` 中增加Tab切换，让用户可以在PPT跑批和音频跑批之间切换。

#### HTML结构
```html
<!-- Tab 切换 -->
<div class="tabs">
  <button class="tab-btn active" onclick="switchAutoProcessTab('ppt')">📄 PPT跑批</button>
  <button class="tab-btn" onclick="switchAutoProcessTab('audio')">🎤 音频跑批</button>
</div>

<!-- PPT跑批内容 -->
<div id="ppt-process-content">
  <!-- 现有的PPT跑批控制面板 -->
</div>

<!-- 音频跑批内容 -->
<div id="audio-process-content" style="display: none;">
  <!-- 音频跑批控制面板 -->
</div>
```

#### JavaScript逻辑
```javascript
let currentAutoProcessTab = 'ppt'; // 'ppt' or 'audio'

function switchAutoProcessTab(tab) {
  currentAutoProcessTab = tab;
  
  // 切换按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (tab === 'ppt') {
    document.getElementById('ap-ppt-tab').classList.add('active');
    document.getElementById('ppt-process-content').style.display = 'block';
    document.getElementById('audio-process-content').style.display = 'none';
    // 加载PPT跑批数据
    loadPptAutoProcessStatus();
  } else {
    document.getElementById('ap-audio-tab').classList.add('active');
    document.getElementById('ppt-process-content').style.display = 'none';
    document.getElementById('audio-process-content').style.display = 'block';
    // 加载音频跑批数据
    loadAudioAutoProcessStatus();
  }
}

// 音频跑批API调用
async function loadAudioAutoProcessStatus() {
  try {
    const response = await fetch(`${API_BASE}/auto-process/audio/status`);
    const result = await response.json();
    // 更新UI
  } catch (error) {
    console.error('加载音频跑批状态失败:', error);
  }
}

async function startAudioAutoProcess() {
  const response = await fetch(`${API_BASE}/auto-process/audio/start`, { method: 'POST' });
  const result = await response.json();
  if (result.success) {
    showToast('音频自动跑批已启动', 'success');
    loadAudioAutoProcessStatus();
  }
}

// ... 其他音频跑批函数
```

### 方案二：独立页面

创建 `audio-auto-process.html` 作为独立的音频跑批监控页面。

- 在导航栏增加新菜单：`🎤 音频跑批监控`
- 复用现有的UI组件和样式
- 独立管理音频跑批状态

---

## ⚙️ 配置说明

### 音频跑批配置文件
**路径**：`ai_backend/server/config/audioAutoProcessConfig.json`

```json
{
  "scanDirectory": "E:/已转录",
  "pollingInterval": 300000,
  "maxConcurrent": 1,
  "supportedFormats": ["mp3", "wav", "m4a", "flac", "aac", "wma", "ogg"]
}
```

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `scanDirectory` | string | 音频扫描目录 | '' |
| `pollingInterval` | number | 轮询间隔（毫秒） | 300000 (5分钟) |
| `maxConcurrent` | number | 最大并发转录数 | 1 |
| `supportedFormats` | array | 支持的音频格式 | mp3, wav等 |

---

## 📊 统计信息字段

### 音频跑批统计
```javascript
{
  totalAudios: 0,         // 总音频文件数
  transcribedAudios: 0,   // 已转录数量
  pendingAudios: 0,       // 待转录数量
  processingAudios: 0,    // 正在转录数量
  lastRunTime: null,      // 上次运行时间
  nextRunTime: null,      // 下次运行时间
  totalRuns: 0,           // 总运行次数
  successfulRuns: 0,      // 成功次数
  failedRuns: 0           // 失败次数
}
```

---

## 🔧 实现步骤

### 第1步：测试后端API
```bash
# 启动服务器
cd E:\dev-chat-ppt\ai_backend
node server/app.js

# 测试音频跑批状态
curl http://localhost:3000/api/auto-process/audio/status

# 配置扫描目录
curl -X PUT http://localhost:3000/api/auto-process/audio/config \
  -H "Content-Type: application/json" \
  -d '{"scanDirectory": "E:/已转录", "pollingInterval": 300000}'

# 启动音频跑批
curl -X POST http://localhost:3000/api/auto-process/audio/start
```

### 第2步：前端集成

#### 修改 `ai_backend/frontend/pages/auto-process.html`
1. 在页面顶部添加Tab切换按钮
2. 将现有内容包裹在 `<div id="ppt-process-content">`
3. 添加新的 `<div id="audio-process-content">`（复制PPT跑批的UI结构）

#### 修改 `ai_backend/frontend/js/pages/auto-process.js`
1. 添加 `switchAutoProcessTab()` 函数
2. 复制现有的加载函数，修改为音频API
3. 添加音频跑批的控制函数（启动、停止、配置等）

### 第3步：UI组件复用

音频跑批监控页面可以复用PPT跑批的UI组件：

1. **控制面板**：启动/停止按钮、状态指示器
2. **统计卡片**：总数、已处理、待处理、进行中
3. **配置表单**：扫描目录、轮询间隔、并发数
4. **日志列表**：实时日志显示、清空按钮

只需修改：
- API调用路径（从 `/auto-process/...` 改为 `/auto-process/audio/...`）
- 文案（从"文档"改为"音频"，从"提取"改为"转录"）
- 统计字段名（`totalDocuments` → `totalAudios`等）

---

## 🧪 测试清单

- [ ] 后端API所有接口正常响应
- [ ] 配置音频扫描目录
- [ ] 启动音频跑批，检查日志
- [ ] 手动触发一次执行
- [ ] 统计信息实时更新
- [ ] 停止服务正常
- [ ] Tab切换流畅，数据不混乱
- [ ] 并发转录正常工作
- [ ] 错误处理和日志记录

---

## 💡 后续优化建议

1. **仪表板统一**：在一个页面同时显示PPT和音频的统计信息
2. **通知功能**：转录完成后发送浏览器通知
3. **历史趋势**：显示每日转录量的折线图
4. **错误重试**：转录失败自动重试机制
5. **优先级队列**：支持设置音频文件的处理优先级

---

## 🚀 快速启动

```bash
# 1. 重启服务器
cd E:\dev-chat-ppt\ai_backend
node server/app.js

# 2. 打开浏览器
http://localhost:3000/admin.html

# 3. 点击"自动跑批监控"
# 4. 切换到"音频跑批"Tab
# 5. 配置扫描目录
# 6. 点击"启动自动跑批"
```

现在音频自动跑批功能的后端已全部完成，只需前端集成Tab切换即可！🎉

