# 工作流完成回调（售前视频）

> 工作流异步处理完成后调用本接口，根据 `execute_id` 更新 `presales_video_tasks`：流水线状态 + **分析完内容**（`analysis_content`）或 **视频地址**（`video_address`）。

**服务**：ai_backend（Node.js）  
**模块路径**：`/api/presales-video`  
**最后更新**：2026-03-28

---

## 1. 工作流完成回调

### 基本信息

- **接口路径**：`POST /api/presales-video/workflow-callback`
- **请求方式**：`POST`
- **Content-Type**：`application/json`
- **接口说明**：按类型回写分析文本或视频路径；`id` 与提交工作流时落库的 **execute_id** 一致。
- **开发状态**：✅ 已实现
- **权限要求**：若服务端配置了 `PRESALES_VIDEO_WORKFLOW_CALLBACK_SECRET`，则必须携带密钥（见下文）；未配置则无额外鉴权。

### 请求参数（Body）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 是 | `analysis_content`：分析完成；`video_create`：视频已生成 |
| id | string | 与 execute_id 二选一 | 工作流 execute_id |
| execute_id | string | 与 id 二选一 | 同 `id` |
| content / text / url / path 等 | string | 否 | 分析全文或视频 URL/路径，见下表 |

**承载「分析内容」或「视频地址」时可选用以下任一字段名**（服务端取第一个非空）：  
`content`、`text`、`result`、`url`、`path`、`video_url`、`videoUrl`、`video_path`、`videoPath`、`address`、`payload`、`value`，或 `data` 为字符串时取 `data`。

### 业务逻辑

| type | 库表状态 `pipeline_status` | 写入字段 | 说明 |
|------|----------------------------|----------|------|
| `analysis_content` | `分析完成` | `analysis_content`（LONGTEXT，可存约 2 万字量级） | 分析完内容 |
| `video_create` | `视频生成` | `video_address`（最长 2000 字符，超出截断） | 视频地址 |

### 可选鉴权

环境变量：`PRESALES_VIDEO_WORKFLOW_CALLBACK_SECRET`

满足以下**任一**即可通过鉴权：

- Header：`X-Presales-Video-Callback-Secret: <密钥>`
- Query：`?secret=<密钥>`
- Body 字段：`secret`（与其它业务字段并列）

### 请求示例

**分析完成：**

```http
POST /api/presales-video/workflow-callback HTTP/1.1
Host: your-ai-backend.example.com:3000
Content-Type: application/json
X-Presales-Video-Callback-Secret: your-secret-if-configured

{
  "type": "analysis_content",
  "id": "7432908123456789012",
  "content": "此处为分析结果全文……"
}
```

**视频生成完成：**

```json
{
  "type": "video_create",
  "execute_id": "7432908123456789012",
  "path": "https://cdn.example.com/presales/videos/xxx.mp4"
}
```

### 响应数据

**成功（200）**

```json
{
  "success": true,
  "data": {
    "videoTask": {
      "mainTaskId": "uuid",
      "transcriptionId": "转录ID",
      "executeId": "7432908123456789012",
      "pipelineStatus": "分析完成",
      "analysisContent": "……",
      "videoAddress": null,
      "cozeFileId": null,
      "cozeFileName": null,
      "localDialogueTxtPath": null,
      "reserve3": null,
      "reserve4": null,
      "reserve5": null,
      "lastError": null,
      "updatedAt": "2026-03-28T12:00:00.000Z"
    }
  }
}
```

**失败**

| HTTP | 说明 |
|------|------|
| 400 | 缺少 `type` / `id`，或 `type` 非法 |
| 401 | 配置了回调密钥但校验失败 |
| 404 | 找不到对应 `execute_id` 的任务 |
| 500 | 服务器内部错误 |

```json
{
  "success": false,
  "error": "未找到与 execute_id 匹配的主任务记录",
  "code": "NOT_FOUND"
}
```

### curl 示例

```bash
curl -sS -X POST "http://127.0.0.1:3000/api/presales-video/workflow-callback" \
  -H "Content-Type: application/json" \
  -H "X-Presales-Video-Callback-Secret: your-secret" \
  -d "{\"type\":\"analysis_content\",\"id\":\"EXEC_ID_HERE\",\"content\":\"分析结果……\"}"
```

---

## 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-03-28 | 库字段 `reserve_1/2` 更名为 `analysis_content` / `video_address`，分析内容改 LONGTEXT |
| v1.0 | 2026-03-28 | 初始回调接口 |
