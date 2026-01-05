# 🐛 Bug 修复报告 - 乱码和序列化问题

## 问题汇总

### 问题 1: 中文乱码 🔤
- **前端显示**：对话内容全是乱码
- **数据库**：dialogues 字段存储乱码

### 问题 2: BigInt 序列化错误 🔢
```
TypeError: Do not know how to serialize a BigInt
at JSON.stringify (<anonymous>)
```

---

## 🔍 根本原因分析

### 问题 1: 编码问题

**原因链**：
```
Python (UTF-8) 
  ↓ 输出到 stdout
Node.js spawn()
  ↓ 默认编码读取（Windows 可能是 GBK）
乱码产生 ❌
```

**具体原因**：
1. Python 脚本使用 UTF-8 输出中文
2. Node.js 的 `spawn()` 在 Windows 上**默认编码不是 UTF-8**
3. `data.toString()` 没有指定编码，导致中文被错误解析
4. 乱码的 JSON 被存入数据库

### 问题 2: BigInt 类型

**原因**：
- 数据库字段 `audio_file_size` 是 `BIGINT` 类型
- Prisma 返回 JavaScript `BigInt` 对象
- `JSON.stringify()` **不支持序列化 BigInt**
- Express `res.json()` 内部调用 `JSON.stringify()` 时报错

---

## ✅ 修复方案

### 修复 1: 强制 UTF-8 编码

#### 修改文件：`server/services/transcriptionService.js`

**Before（有问题）**：
```javascript
const pythonProcess = spawn(this.pythonPath, [this.pythonScript, audioFilePath]);

pythonProcess.stdout.on('data', (data) => {
  const output = data.toString(); // ❌ 默认编码
  stdout += output;
});
```

**After（修复）**：
```javascript
// 设置环境变量以确保 Python 使用 UTF-8 编码
const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
const pythonProcess = spawn(this.pythonPath, [this.pythonScript, audioFilePath], { env });

pythonProcess.stdout.setEncoding('utf8'); // ✅ 强制 UTF-8
pythonProcess.stderr.setEncoding('utf8');

pythonProcess.stdout.on('data', (data) => {
  stdout += data; // ✅ 已是 UTF-8 字符串
});
```

**关键修改**：
1. 添加环境变量 `PYTHONIOENCODING: 'utf-8'`
2. 使用 `setEncoding('utf8')` 设置流编码
3. 直接使用 `data`，不需要 `.toString()`

---

### 修复 2: BigInt 转换

#### 修改文件：`server/services/transcriptionService.js`

**修改位置 1：`getTranscriptionList` 方法**

**Before**：
```javascript
const listWithDialogues = list.map(item => ({
  ...item,
  dialogues: item.dialogues ? JSON.parse(item.dialogues) : []
}));
```

**After**：
```javascript
const listWithDialogues = list.map(item => ({
  ...item,
  audio_file_size: item.audio_file_size ? Number(item.audio_file_size) : 0, // ✅ 转换 BigInt
  dialogues: item.dialogues ? JSON.parse(item.dialogues) : []
}));
```

**修改位置 2：`getTranscriptionById` 方法**

**Before**：
```javascript
if (transcription && transcription.dialogues) {
  transcription.dialogues = JSON.parse(transcription.dialogues);
}
```

**After**：
```javascript
if (transcription && transcription.dialogues) {
  transcription.dialogues = JSON.parse(transcription.dialogues);
  transcription.audio_file_size = Number(transcription.audio_file_size) || 0; // ✅ 转换 BigInt
}
```

---

## 🧪 验证方法

### 测试 1: 中文编码
```javascript
// 预期：中文正常显示
{
  "dialogues": [
    {
      "speaker": "SPEAKER_1",
      "text": "你好，这是测试" // ✅ 中文清晰可见
    }
  ]
}
```

### 测试 2: BigInt 序列化
```javascript
// 预期：正常返回，不报错
{
  "audio_file_size": 27216298, // ✅ 转换为 Number
  "dialogues": [...]
}
```

---

## 📊 影响范围

### 受影响的功能
- ✅ 语音转录上传
- ✅ 转录结果展示
- ✅ 历史记录列表
- ✅ 转录详情查看

### 修复效果
| 问题 | 修复前 | 修复后 |
|-----|--------|--------|
| 中文显示 | ❌ 乱码 | ✅ 正常 |
| 列表加载 | ❌ 报错 | ✅ 正常 |
| 详情查看 | ❌ 乱码 | ✅ 正常 |
| 数据库存储 | ❌ 乱码 | ⚠️ 需重新转录 |

---

## ⚠️ 重要说明

### 已存在的乱码数据

修复后，**新转录的音频会正常显示**，但：
- ❌ 之前已保存的乱码数据**无法自动修复**
- 🔧 解决方案：
  1. **删除旧记录**：在历史记录中删除乱码记录
  2. **重新转录**：重新上传音频文件进行转录

### 清理乱码数据（可选）

如果需要批量清理：

```sql
-- 删除所有已存在的转录记录（慎用！）
DELETE FROM transcriptions;

-- 或者只删除特定记录
DELETE FROM transcriptions WHERE id = 'xxx';
```

---

## 🔧 额外优化

### 全局 BigInt 序列化（可选）

如果项目中有多处 BigInt，可以添加全局处理：

```javascript
// server/app.js（在所有路由之前）
BigInt.prototype.toJSON = function() {
  return Number(this);
};
```

但**不推荐**，因为可能导致精度丢失（超过 `Number.MAX_SAFE_INTEGER`）。

---

## 🚀 服务已重启

- ✅ 端口：3000
- ✅ 状态：运行中
- ✅ 日志：`terminals/25.txt`

---

## 📝 测试步骤

1. **刷新前端页面**
   ```
   http://localhost:3000/transcription.html
   ```

2. **删除旧的乱码记录**
   - 在历史记录中点击"删除"
   - 或使用 Prisma Studio 批量删除

3. **重新上传音频测试**
   - 选择音频文件
   - 等待转录完成
   - 验证中文是否正常显示

4. **检查历史记录列表**
   - 刷新页面
   - 验证列表是否正常加载（不报错）

---

## ✅ 预期结果

### 转录结果展示
```
💬 对话内容
━━━━━━━━━━━━━━━━━━━━━━
[00:05-00:10] SPEAKER_1
你好，欢迎来到湖南银行... ✅ 中文正常

[00:10-00:15] SPEAKER_2
感谢您的介绍... ✅ 中文正常
```

### 历史记录
```
🎙️ 测试音频.mp3
🎤 2 人  💬 508 条  ⏱️ 26:00  📅 2026-01-04
✅ 列表正常加载，无报错
```

---

**修复时间**：2026-01-04 17:40  
**修复文件**：
- `server/services/transcriptionService.js`

**状态**：✅ 已修复并重启  
**测试**：请重新上传音频测试

