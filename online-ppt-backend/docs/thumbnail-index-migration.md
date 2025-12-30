# 缩略图索引架构改造说明

## 改造时间
2025-12-30

## 改造目标
将缩略图索引从**单一全局索引文件**改为**每个文档独立索引文件**,以提升性能、可扩展性和数据迁移友好度。

## 改造前架构

### 文件结构
```
data/
  thumbnails/
    index.json          # 全局索引,包含所有文档的缩略图信息
```

### 问题
1. 随着文档数量增加,索引文件会变得很大
2. 查询特定文档的缩略图需要遍历整个数组
3. 并发写入时可能存在冲突
4. 数据迁移时必须处理整个索引文件

## 改造后架构

### 文件结构
```
data/
  document-index.json     # 主表,包含缩略图管理字段
  thumbnails/
    document_1.json       # document_1 的缩略图索引
    document_4.json       # document_4 的缩略图索引
    document_7.json       # document_7 的缩略图索引
```

### 主表新增字段
在 `document-index.json` 中每个文档添加:
```json
{
  "id": "document_7",
  "name": "demo22222",
  // ... 其他字段
  
  // 新增缩略图管理字段
  "thumbnailIndexPath": "thumbnails/document_7.json",
  "thumbnailCount": 19,
  "thumbnailsLastUpdated": "2025-12-30T11:42:55.596Z"
}
```

### 独立缩略图索引结构
`data/thumbnails/document_7.json`:
```json
{
  "documentId": "document_7",
  "documentTitle": "demo22222",
  "lastUpdated": "2025-12-30T11:42:55.596Z",
  "thumbnails": [
    {
      "id": "thumb_document_7_Wbt9ui8781",
      "slideId": "Wbt9ui8781",
      "slideIndex": 0,
      "url": "/snapshots/document_7/Wbt9ui8781.jpg",
      "width": 800,
      "height": 450,
      "size": 16732,
      "format": "jpeg",
      "generatedAt": "2025-12-28T08:24:18.527Z",
      "metadata": {
        "hasText": true,
        "hasImage": false,
        "elementCount": 5
      }
    }
    // ... 更多缩略图
  ]
}
```

## 改造优势

### 1. 性能优化
- 查询单个文档的缩略图只需读取对应的索引文件
- 避免遍历所有文档的缩略图数据

### 2. 可扩展性
- 文档数量增长不会影响单个索引文件的大小
- 每个文档的缩略图数据完全独立

### 3. 并发安全
- 不同文档的缩略图更新不会互相影响
- 减少文件锁冲突

### 4. 迁移友好
- 迁移单个文档时,根据主表的 `thumbnailIndexPath` 字段即可找到对应的索引文件
- 支持增量迁移和部分迁移

### 5. 易于维护
- 删除文档时直接删除对应的索引文件
- 数据结构清晰,易于调试

## 改动文件

### 1. `src/routes/thumbnails.js`
- 修改 `readDocumentThumbnailIndex()` - 读取文档级别的索引
- 修改 `writeDocumentThumbnailIndex()` - 写入文档级别的索引
- 新增 `updateMainIndexThumbnailInfo()` - 更新主表中的缩略图信息
- 更新所有路由接口以适配新结构

### 2. `src/routes/documents.js`
- 创建文档时添加缩略图管理字段
- 删除文档时同时删除缩略图索引文件

### 3. `scripts/migrate-thumbnail-index.js`
- 数据迁移脚本,将旧的全局索引拆分为独立索引

## 数据迁移

### 执行步骤
```bash
cd online-ppt-backend
node scripts/migrate-thumbnail-index.js
```

### 迁移结果
- ✅ 成功迁移 3 个文档
- ✅ 共 46 个缩略图记录
- ✅ 主表已更新
- ✅ 旧索引文件已备份

### 备份文件
旧索引文件已备份为:
```
data/thumbnails/index.json.backup.1767094975597
```

## API 接口兼容性

所有 API 接口保持向后兼容,无需前端改动:
- `GET /api/thumbnails` - 获取预览图列表
- `GET /api/thumbnails/:thumbnailId` - 获取单个预览图详情
- `GET /api/thumbnails/document/:documentId` - 获取文档的预览图列表
- `POST /api/thumbnails/upload` - 上传预览图
- `POST /api/thumbnails/rebuild-index` - 重建索引

## 注意事项

1. **旧索引文件**: 已删除 `data/thumbnails/index.json`,备份文件保留
2. **主表字段**: 新创建的文档会自动包含缩略图管理字段
3. **向后兼容**: 所有 API 接口保持兼容,前端无需改动
4. **数据一致性**: 上传缩略图时会自动更新主表的统计信息

## 未来扩展

可以考虑添加:
- 缩略图索引的缓存机制
- 定期校验主表和索引文件的一致性
- 缩略图的批量操作接口

