# 语音转录功能测试清单

## ✅ **清理完成**

已删除的旧文件：
- ✅ `转录音频.py`（已迁移到 `python_services/transcription/xfyun_client.py`）
- ✅ `xfyun_transcribe_service.py`（已迁移到 `python_services/transcription/service.py`）
- ✅ `test_import.py`（测试文件）
- ✅ `test_new_structure.py`（测试文件）
- ✅ `test-prisma-transcriptions.js`（测试文件）

## 🚀 **服务状态**

✅ **服务已启动**
- 监听端口：3000
- 访问地址：http://localhost:3000
- 转录接口：POST /api/transcription/upload
- 日志文件：`c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\22.txt`

---

## 🧪 **测试步骤**

### **Test 1: 访问前端页面**

1. 打开浏览器
2. 访问：`http://localhost:3000/transcription.html`
3. ✅ 检查页面是否正常加载
4. ✅ 检查样式是否正确显示

---

### **Test 2: 上传小音频文件（快速测试）**

**准备工作**：
- 找一个小的测试音频文件（< 5MB，1-2分钟）
- 支持格式：MP3, WAV, M4A, FLAC, AAC, WMA, OGG

**测试步骤**：
1. 点击"选择文件"或拖拽音频到上传区域
2. ✅ 检查文件信息是否正确显示（文件名、大小）
3. （可选）填写客户名称、关联场次、关联产品
4. 点击"开始转录"
5. ✅ 观察进度提示是否显示
6. 等待转录完成（预计 1-3 分钟）
7. ✅ 检查转录结果：
   - 对话数量
   - 说话人数
   - 对话内容格式
   - 时间戳格式

---

### **Test 3: 查看实时日志**

**方式 1：查看日志文件**
```bash
# PowerShell
Get-Content "c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\22.txt" -Wait -Tail 50
```

**方式 2：使用快捷脚本**
```bash
# 双击运行
查看转录日志.bat
```

**预期日志输出**：
```
📤 收到音频上传请求
文件名: 测试音频.mp3
文件大小: 2.5 MB
🎯 开始转录...
🎤 开始调用 Python 转录服务...
音频文件: E:\dev-chat-ppt\ai_backend\uploads\audio\xxx.mp3
Python 脚本: E:\dev-chat-ppt\ai_backend\python_services\transcription\service.py
[Python] ================================================================================
[Python] 开始上传音频文件...
[Python] ================================================================================
[Python] 文件: 测试音频.mp3
[Python] 大小: 2.5 MB
[Python] ⚙️  转录配置: 角色分离模式
[Python] ✅ 上传成功
[Python] 订单ID: xxx
[Python] [1] 转录进行中，请稍候...
[Python] ✅ 转录完成！
✅ 转录成功
对话数量: 25
说话人数: 2
💾 已保存到数据库, ID: xxx
```

---

### **Test 4: 功能测试**

#### 4.1 复制功能
- ✅ 点击单条对话的复制按钮
- ✅ 点击"复制全部"按钮
- ✅ 验证剪贴板内容

#### 4.2 下载功能
- ✅ 点击"下载结果"按钮
- ✅ 验证下载的 TXT 文件格式
- ✅ 检查文件内容完整性

#### 4.3 历史记录
- ✅ 检查历史记录列表是否显示
- ✅ 点击"查看"按钮，验证能否加载历史记录
- ✅ 点击"删除"按钮，验证能否删除记录

#### 4.4 新建转录
- ✅ 点击"新建转录"按钮
- ✅ 验证表单是否重置
- ✅ 可以上传新的音频文件

---

### **Test 5: 数据库验证**

```bash
cd e:\dev-chat-ppt\online-ppt-backend
npx prisma studio
```

**检查项**：
- ✅ `transcriptions` 表是否有新记录
- ✅ 字段数据是否完整：
  - `name`（文件名）
  - `audio_file_path`（音频路径）
  - `dialogues`（对话JSON）
  - `speaker_count`（说话人数）
  - `status`（completed）
  - `created_at`（创建时间）

---

### **Test 6: 错误处理测试**

#### 6.1 无效文件格式
- ❌ 上传不支持的格式（如 .txt, .doc）
- ✅ 应显示错误提示

#### 6.2 空文件
- ❌ 不选择文件直接点击"开始转录"
- ✅ 应提示"请先选择音频文件"

#### 6.3 超大文件
- ⚠️ 上传超过 500MB 的文件
- ✅ 应显示文件大小限制提示

---

## 📊 **测试结果记录**

| 测试项 | 状态 | 备注 |
|-------|------|------|
| Test 1: 页面访问 | ⬜ 待测试 | |
| Test 2: 音频上传转录 | ⬜ 待测试 | |
| Test 3: 实时日志 | ⬜ 待测试 | |
| Test 4.1: 复制功能 | ⬜ 待测试 | |
| Test 4.2: 下载功能 | ⬜ 待测试 | |
| Test 4.3: 历史记录 | ⬜ 待测试 | |
| Test 4.4: 新建转录 | ⬜ 待测试 | |
| Test 5: 数据库验证 | ⬜ 待测试 | |
| Test 6: 错误处理 | ⬜ 待测试 | |

**状态说明**：
- ⬜ 待测试
- ✅ 通过
- ❌ 失败
- ⚠️ 警告

---

## 🐛 **已知问题**

无

---

## 📝 **测试反馈**

请在测试过程中记录：
1. 发现的问题
2. 改进建议
3. 用户体验反馈

---

## 🎯 **快速测试命令**

```bash
# 1. 查看服务日志
Get-Content "c:\Users\Administrator\.cursor\projects\e-dev-chat-ppt\terminals\22.txt" -Wait -Tail 50

# 2. 访问前端
Start-Process "http://localhost:3000/transcription.html"

# 3. 查看数据库
cd e:\dev-chat-ppt\online-ppt-backend
npx prisma studio

# 4. 检查上传文件
explorer e:\dev-chat-ppt\ai_backend\uploads\audio

# 5. 检查转录结果
explorer E:\已转录
```

---

**测试开始时间**：________
**测试完成时间**：________
**测试人员**：________

