# 售前报备外部接入 API

## `POST /api/presales-inbound/report-and-transcribe`

将**售前/交流报备**（文本或 JSON）写入 `communication_report_inbox` + `communication_reports`，将**音频**从远程 URL 或本地路径拷贝/下载到配置目录后，调用现有转录流水线并写入 `transcriptions`，最后在报备的 `report_note` 中追加关联转录 ID。

### 鉴权

- **未配置**环境变量 `PRESALES_INBOUND_API_SECRET`（或值为空）时：**不校验**，可直接调 POST（仅建议联调使用；生产务必配置密钥）。
- **已配置**时，请求头任选其一，且必须与密钥一致：
  - `X-Presales-Inbound-Secret: <secret>`
  - `Authorization: Bearer <secret>`

### 请求体（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `report` / `reportJson` / `reportText` | object 或 string | 是 | 报备：对象走 JSON 字段映射；字符串走与企微相同的编号行解析。若字符串以 `{`/`[` 开头会尝试 `JSON.parse`，失败则仍按文本解析。 |
| `audioRemotePath` | string | 是 | `http(s)://` 下载；`file://` 或本机绝对路径拷贝；否则视为相对 `UPLOAD_BASE_DIR` 的路径（禁止跳出根目录）。 |
| `originalFileName` | string | 否 | 用于扩展名与客户展示名 |
| `createdBy` | string | 否 | 写入报备与转录的创建人（截断 50 字符） |

### 环境变量

- `PRESALES_INBOUND_AUDIO_DIR`：音频落盘目录，默认 `<UPLOAD_BASE_DIR>/presales_inbound/audio`
- `PRESALES_INBOUND_AUDIO_MAX_BYTES`：单文件上限，默认 524288000（500MB）

### 成功响应

```json
{
  "success": true,
  "message": "报备已入库并完成转录",
  "data": {
    "reportId": "...",
    "snapshotRel": "presales_inbound/communication_reports/....json",
    "transcriptionId": "...",
    "localAudioPath": "/abs/path/to/inbound/file.mp3",
    "warnings": []
  }
}
```

### 说明

- 报备来源标记：`source_channel = api_inbound`
- JSON 快照目录：`presales_inbound/communication_reports/`（相对上传根）
