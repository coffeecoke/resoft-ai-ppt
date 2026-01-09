<template>
  <div class="file-scan">
    <div class="header">
      <div class="title-area">
        <h2>文件扫描管理</h2>
        <div class="sub-title">
          <span class="count">共 {{ files.length }} 个文件</span>
          <span class="dot">·</span>
          <span class="count">待处理 {{ stats.pending }} 个</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn" @click="loadFiles" :disabled="loading">
          {{ loading ? '加载中...' : '🔄 刷新' }}
        </button>
        <button class="btn btn-primary" @click="handleScan" :disabled="scanning">
          {{ scanning ? '扫描中...' : '📂 手动扫描' }}
        </button>
      </div>
    </div>

    <!-- 配置信息区域 -->
    <div class="config-section">
      <div class="section-title">扫描配置</div>
      <div class="config-grid">
        <div class="config-item">
          <div class="config-label">源目录</div>
          <div class="config-value">{{ config.sourceDir || '-' }}</div>
        </div>
        <div class="config-item">
          <div class="config-label">扫描间隔</div>
          <div class="config-value">{{ config.intervalHours }} 小时</div>
        </div>
        <div class="config-item">
          <div class="config-label">自动处理</div>
          <div class="config-value">
            <span :class="['status-badge', config.autoProcess ? 'enabled' : 'disabled']">
              {{ config.autoProcess ? '已启用' : '已禁用' }}
            </span>
          </div>
        </div>
        <div class="config-item">
          <div class="config-label">支持类型</div>
          <div class="config-value">{{ config.fileTypes?.join(', ') || '-' }}</div>
        </div>
        <div class="config-item">
          <div class="config-label">配置状态</div>
          <div class="config-value">
            <span :class="['status-badge', config.valid ? 'success' : 'error']">
              {{ config.valid ? '✓ 有效' : '✗ 无效' }}
            </span>
            <span v-if="!config.valid && config.errors?.length" class="error-text">
              {{ config.errors[0] }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">总文件数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value success">{{ stats.success }}</div>
        <div class="stat-label">已处理</div>
      </div>
      <div class="stat-card">
        <div class="stat-value pending">{{ stats.pending }}</div>
        <div class="stat-label">待处理</div>
      </div>
      <div class="stat-card">
        <div class="stat-value processing">{{ stats.processing }}</div>
        <div class="stat-label">处理中</div>
      </div>
      <div class="stat-card">
        <div class="stat-value failed">{{ stats.failed }}</div>
        <div class="stat-label">失败</div>
      </div>
    </div>

    <!-- 文件列表 -->
    <div class="files-section">
      <div class="section-title">文件列表</div>
      <div v-if="loading" class="placeholder">
        <div class="icon">⏳</div>
        <div class="text">正在加载文件列表...</div>
      </div>

      <div v-else-if="files.length === 0" class="placeholder">
        <div class="icon">📭</div>
        <div class="text">没有找到文件</div>
        <div class="hint">请检查源目录配置是否正确</div>
      </div>

      <div v-else class="table-container">
        <table class="files-table">
          <thead>
            <tr>
              <th>文件名</th>
              <th>类型</th>
              <th>大小</th>
              <th>修改时间</th>
              <th>处理状态</th>
              <th>处理时间</th>
              <th>文档ID</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in files" :key="file.filePath">
              <td class="file-name" :title="file.fileName">{{ file.fileName }}</td>
              <td>{{ file.fileType }}</td>
              <td>{{ formatFileSize(file.fileSize) }}</td>
              <td>{{ formatTime(file.modifiedTime) }}</td>
              <td>
                <span :class="['status-badge', file.status]">
                  {{ getStatusText(file.status) }}
                </span>
              </td>
              <td>{{ file.processedTime ? formatTime(file.processedTime) : '-' }}</td>
              <td>
                <span v-if="file.documentId" class="document-id" :title="file.documentId">
                  {{ file.documentId.substring(0, 20) }}...
                </span>
                <span v-else>-</span>
              </td>
              <td>
                <button
                  v-if="file.status !== 'processing'"
                  class="btn-action"
                  @click="handleProcessFile(file)"
                  :disabled="processingFile === file.filePath"
                >
                  {{ processingFile === file.filePath ? '处理中...' : '立即处理' }}
                </button>
                <span v-else class="processing-text">处理中...</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { getScanConfig, getFileList, processFile, scan, type ScanConfig, type FileInfo, type FileListResponse } from '@/services/admin/fileScanService'
import message from '@/utils/message'

const loading = ref(false)
const scanning = ref(false)
const processingFile = ref<string | null>(null)

const config = ref<ScanConfig>({
  sourceDir: '',
  enabled: true,
  interval: 3600000,
  intervalHours: '1.0',
  autoProcess: true,
  fileTypes: [],
  typeDirs: {},
  sourceDirs: {},
  valid: false,
  errors: []
})

const files = ref<FileInfo[]>([])
const stats = computed(() => ({
  total: files.value.length,
  pending: files.value.filter(f => f.status === 'pending').length,
  processing: files.value.filter(f => f.status === 'processing').length,
  success: files.value.filter(f => f.status === 'success').length,
  failed: files.value.filter(f => f.status === 'failed').length
}))

// 加载配置
const loadConfig = async () => {
  try {
    config.value = await getScanConfig()
  } catch (error: any) {
    console.error('[文件扫描] 加载配置失败:', error)
    message.error('加载配置失败: ' + (error.message || '未知错误'))
  }
}

// 加载文件列表
const loadFiles = async () => {
  try {
    loading.value = true
    const response = await getFileList()
    files.value = response.files
  } catch (error: any) {
    console.error('[文件扫描] 加载文件列表失败:', error)
    message.error('加载文件列表失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

// 手动扫描
const handleScan = async () => {
  try {
    scanning.value = true
    const result = await scan()
    message.success(`扫描完成: 总计 ${result.total}, 处理 ${result.processed}, 跳过 ${result.skipped}, 失败 ${result.failed}`)
    await loadFiles()
  } catch (error: any) {
    console.error('[文件扫描] 扫描失败:', error)
    message.error('扫描失败: ' + (error.message || '未知错误'))
  } finally {
    scanning.value = false
  }
}

// 处理单个文件
const handleProcessFile = async (file: FileInfo) => {
  try {
    processingFile.value = file.filePath
    const result = await processFile(file.filePath)
    if (result.success) {
      message.success(`文件处理成功: ${file.fileName}`)
      await loadFiles()
    } else {
      message.error(`文件处理失败: ${result.error || '未知错误'}`)
    }
  } catch (error: any) {
    console.error('[文件扫描] 处理文件失败:', error)
    message.error('处理文件失败: ' + (error.message || '未知错误'))
  } finally {
    processingFile.value = null
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// 格式化时间
const formatTime = (time: string) => {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取状态文本
const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    success: '已处理',
    failed: '失败'
  }
  return map[status] || status
}

onMounted(() => {
  loadConfig()
  loadFiles()
})
</script>

<style lang="scss" scoped>
.file-scan {
  max-width: 1400px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  min-height: calc(100vh - 100px);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  
  .title-area {
    min-width: 220px;

    h2 {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      color: #111827;
      letter-spacing: 0.2px;
    }

    .sub-title {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(17, 24, 39, 0.62);
      display: flex;
      align-items: center;
      gap: 8px;

      .dot {
        opacity: 0.6;
      }
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn {
    height: 32px;
    padding: 0 14px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.18s ease;
    border: 1px solid rgba(15, 23, 42, 0.12);
    background: #fff;
    color: rgba(17, 24, 39, 0.86);

    &:hover:not(:disabled) {
      border-color: rgba(24, 144, 255, 0.55);
      color: #1890ff;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: none;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-primary {
    border-color: rgba(24, 144, 255, 0.65);
    background: linear-gradient(135deg, rgba(24, 144, 255, 0.92), rgba(24, 144, 255, 0.72));
    color: #fff;

    &:hover:not(:disabled) {
      border-color: rgba(24, 144, 255, 0.75);
      color: #fff;
      filter: saturate(1.1);
    }
  }
}

.config-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 12px;
  }

  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .config-item {
    .config-label {
      font-size: 12px;
      color: rgba(17, 24, 39, 0.6);
      margin-bottom: 4px;
    }

    .config-value {
      font-size: 13px;
      color: #111827;
      word-break: break-all;
    }
  }
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 24px;

  .stat-card {
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
    text-align: center;
    border: 1px solid rgba(15, 23, 42, 0.06);

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;

      &.success {
        color: #16a34a;
      }

      &.pending {
        color: #f59e0b;
      }

      &.processing {
        color: #3b82f6;
      }

      &.failed {
        color: #ef4444;
      }
    }

    .stat-label {
      font-size: 12px;
      color: rgba(17, 24, 39, 0.6);
    }
  }
}

.files-section {
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 12px;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    color: rgba(17, 24, 39, 0.5);
    
    .icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
    
    .text {
      font-size: 16px;
      margin-bottom: 6px;
      color: rgba(17, 24, 39, 0.78);
    }
    
    .hint {
      font-size: 13px;
      color: rgba(17, 24, 39, 0.48);
    }
  }

  .table-container {
    overflow-x: auto;
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 8px;
  }

  .files-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;

    thead {
      background: #f9fafb;
      
      th {
        padding: 12px;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        color: rgba(17, 24, 39, 0.7);
        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        white-space: nowrap;
      }
    }

    tbody {
      tr {
        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        transition: background 0.15s;

        &:hover {
          background: #f9fafb;
        }
      }

      td {
        padding: 12px;
        font-size: 13px;
        color: #111827;
      }

      .file-name {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
      }

      .document-id {
        font-family: monospace;
        font-size: 11px;
        color: rgba(17, 24, 39, 0.6);
      }

      .processing-text {
        color: #3b82f6;
        font-size: 12px;
      }
    }
  }
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;

  &.pending {
    color: #f59e0b;
    background: rgba(250, 173, 20, 0.1);
    border: 1px solid rgba(250, 173, 20, 0.3);
  }

  &.processing {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  &.success {
    color: #16a34a;
    background: rgba(22, 163, 74, 0.1);
    border: 1px solid rgba(22, 163, 74, 0.3);
  }

  &.failed {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  &.enabled {
    color: #16a34a;
    background: rgba(22, 163, 74, 0.1);
    border: 1px solid rgba(22, 163, 74, 0.3);
  }

  &.disabled {
    color: #6b7280;
    background: rgba(107, 114, 128, 0.1);
    border: 1px solid rgba(107, 114, 128, 0.3);
  }

  &.error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
}

.btn-action {
  padding: 4px 12px;
  border: 1px solid rgba(24, 144, 255, 0.3);
  background: rgba(24, 144, 255, 0.05);
  color: #1890ff;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(24, 144, 255, 0.1);
    border-color: rgba(24, 144, 255, 0.5);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.error-text {
  margin-left: 8px;
  font-size: 11px;
  color: #ef4444;
}
</style>





