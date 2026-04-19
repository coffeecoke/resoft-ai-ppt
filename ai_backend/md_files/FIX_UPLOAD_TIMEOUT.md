# 修复大文件上传超时问题

## 问题描述

在转录 379.5 MB 的大音频文件时，出现以下错误：

```
Python] {"success": false, "error": "转录失败，未生成结果文件"}
Python 进程退出，代码: 1
转录文件失败: Error: Python脚本执行失败 (退出码: 1)
2026-01-26 14:52:53,898 - ERROR - ❌ 发生错误: The write operation timed out
```

**根本原因**：
- 讯飞SDK内部使用 `httpx` 库进行HTTP请求
- 默认的超时时间太短（通常只有几秒到几十秒）
- 上传 379.5 MB 的大文件需要较长时间，超过了默认超时时间
- 导致 `httpx` 的写入操作超时

## 解决方案

### 1. Monkey Patch 讯飞SDK的HttpClient类（关键修复）

**问题根源**：
- 讯飞SDK的`HttpClient`在创建`httpx.Client`时传入的是数字`timeout`（默认30秒）
- 当传入数字时，httpx会将其作为总超时时间，而不是分别设置connect/read/write
- 对于大文件上传，需要单独设置`write`超时时间

**解决方案**：
通过 **monkey patch** 修改讯飞SDK的`HttpClient`类：
1. 在`__init__`方法中，将数字timeout转换为`httpx.Timeout`对象
2. 在`_sync_request`方法中，确保使用`httpx.Timeout`对象创建客户端

```python
def _patch_xfyun_http_client():
    """修复讯飞SDK的HttpClient，支持大文件上传的超时配置"""
    # 1. Patch __init__：将数字timeout转换为httpx.Timeout对象
    # 2. Patch _sync_request：确保创建httpx.Client时使用正确的timeout
```

**默认超时配置**：
- 连接超时：30秒
- 读取超时：30分钟
- **写入超时：30分钟**（关键：解决 write operation timed out）
- 连接池超时：30秒

### 2. 模块加载时设置httpx默认超时

在 `xfyun_client.py` 模块加载时，通过 **monkey patch** 的方式修改 `httpx.Client` 和 `httpx.AsyncClient` 的默认超时配置（作为备用方案）：

### 3. 根据文件大小动态调整超时

在 `transcribe_audio()` 函数中，根据文件大小动态调整超时时间：

```python
# 对于大文件（>100MB），需要更长的超时时间
if file_size_mb > 100:
    # 计算超时时间：每MB需要约5秒，最小30分钟，最大60分钟
    timeout_minutes = max(30, min(60, int(file_size_mb * 5 / 60)))
    timeout_seconds = timeout_minutes * 60
    
    # 创建httpx.Timeout对象
    custom_timeout = httpx.Timeout(
        connect=30.0,
        read=timeout_seconds,
        write=timeout_seconds,  # 关键：写入超时
        pool=30.0
    )
    
    # 创建客户端并设置超时
    client = LFasrClient(app_id=APP_ID, secret_key=API_SECRET, timeout=timeout_seconds)
    client.timeout = custom_timeout  # 直接设置为httpx.Timeout对象
```

**超时时间计算公式**：
- 小文件（≤100MB）：使用默认30分钟
- 大文件（>100MB）：
  - 计算公式：`max(30, min(60, 文件大小MB * 5 / 60))` 分钟
  - 最小30分钟，最大60分钟
  - 例如：379.5 MB → 约32分钟超时

### 3. 增强错误处理和日志

- 添加详细的日志输出，提示用户大文件上传需要时间
- 特殊处理超时错误，提供友好的错误提示和建议
- 在上传前显示文件大小和预计超时时间

## 修改的文件

- `ai_backend/python_services/transcription/xfyun_client.py`

## 修改内容

1. **添加超时配置函数** `_configure_httpx_timeout()`
   - 在模块加载时自动执行
   - 通过 monkey patch 修改 httpx 的默认超时

2. **优化 `transcribe_audio()` 函数**
   - 添加文件大小检测
   - 根据文件大小动态调整超时时间
   - 增强错误处理和日志输出

3. **改进异常处理**
   - 特殊处理超时错误
   - 提供详细的错误提示和解决建议

## 测试建议

### 测试场景

1. **小文件测试**（<100MB）
   - 验证默认30分钟超时配置生效
   - 验证上传成功

2. **中等文件测试**（100-300MB）
   - 验证动态超时时间计算正确
   - 验证上传成功

3. **大文件测试**（>300MB，如379.5MB）
   - 验证超时时间足够长（32分钟）
   - 验证上传成功，不再出现超时错误

4. **网络慢速测试**
   - 在较慢的网络环境下测试大文件上传
   - 验证超时时间足够

### 预期结果

- ✅ 小文件（<100MB）：30分钟超时，正常上传
- ✅ 中等文件（100-300MB）：30-45分钟超时，正常上传
- ✅ 大文件（>300MB）：32-60分钟超时，正常上传，**不再出现超时错误**

## 注意事项

1. **网络环境**：即使设置了较长的超时时间，如果网络非常慢或不稳定，仍可能超时
2. **服务器限制**：讯飞服务器可能有自己的超时限制，如果超过服务器限制，仍会失败
3. **文件大小限制**：讯飞API可能有文件大小限制（通常为500MB），超过限制的文件无法上传

## 后续优化建议

1. **分块上传**：如果讯飞API支持，可以考虑实现分块上传，提高大文件上传的可靠性
2. **断点续传**：实现断点续传功能，网络中断后可以继续上传
3. **进度显示**：在上传过程中显示实时进度，提升用户体验
4. **重试机制**：添加自动重试机制，网络临时故障时自动重试

## 相关文件

- `ai_backend/python_services/transcription/xfyun_client.py` - 主要修改文件
- `ai_backend/python_services/transcription/service.py` - 转录服务入口
- `ai_backend/server/routes/transcriptionRoutes.js` - 转录路由

## 更新日期

2026-01-26

## 修复人员

AI Assistant
