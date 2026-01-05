# Python Services 模块

这个目录包含所有与 Python 相关的服务模块，供 Node.js 后端调用。

## 📂 目录结构

```
python_services/
├── __init__.py
├── transcription/          # 语音转录服务
│   ├── __init__.py
│   ├── xfyun_client.py    # 讯飞 API 客户端
│   └── service.py         # 服务入口（供 Node.js 调用）
└── README.md
```

## 🎤 语音转录服务 (transcription)

### 文件说明

| 文件 | 说明 |
|-----|------|
| `xfyun_client.py` | 讯飞 API 封装，处理音频上传、轮询、结果保存 |
| `service.py` | 服务入口点，解析转录结果并返回 JSON 格式 |

### 使用方式

#### 1. 命令行调用（测试）

```bash
cd python_services/transcription
python service.py "E:\path\to\audio.mp3"
```

#### 2. Node.js 调用

```javascript
const { spawn } = require('child_process');
const pythonScript = 'python_services/transcription/service.py';
const process = spawn('python', [pythonScript, audioFilePath]);
```

### 输出格式

```json
{
  "success": true,
  "data": {
    "resultFilePath": "E:\\已转录\\音频文件_转录.txt",
    "dialogues": [
      {
        "timeRange": "00:00-00:05",
        "speaker": "SPEAKER_1",
        "text": "对话内容"
      }
    ],
    "fullText": "完整文本内容",
    "speakerCount": 2,
    "audioDuration": 180,
    "audioFileSize": 5242880,
    "audioFormat": "mp3"
  }
}
```

## 🔧 依赖

所有 Python 服务共享项目根目录的依赖：
- `xfyunsdkspeech` - 讯飞语音SDK
- `xfyunsdkcore` - 讯飞核心SDK

安装方式：
```bash
cd ai_backend
pip install -r requirements.txt
```

## 🚀 扩展指南

### 添加新服务

1. 在 `python_services/` 下创建新目录
2. 添加 `__init__.py` 和服务文件
3. 在 Node.js 中创建对应的 Service 类

示例结构：
```
python_services/
├── transcription/     # 已存在
├── text_analysis/     # 新服务
│   ├── __init__.py
│   └── service.py
└── README.md
```

## 📝 注意事项

1. **编码问题**：所有文件使用 UTF-8 编码
2. **路径问题**：使用 `os.path` 或 `pathlib.Path` 处理跨平台路径
3. **错误处理**：所有服务入口必须返回标准 JSON 格式
4. **日志输出**：使用 Python `logging` 模块，Node.js 会捕获输出

## 🐛 常见问题

### 1. 导入错误

确保在项目根目录执行，或正确设置 `PYTHONPATH`:
```bash
export PYTHONPATH="${PYTHONPATH}:/path/to/ai_backend"
```

### 2. 中文文件名问题

使用 `UTF-8` 编码并在 Python 脚本开头添加：
```python
# -*- coding: utf-8 -*-
```

### 3. 权限问题

确保脚本有执行权限：
```bash
chmod +x python_services/transcription/service.py
```

