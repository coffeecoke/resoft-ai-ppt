<template>
  <el-dialog 
    :model-value="visible" 
    :show-close="true" 
    :close-on-click-modal="true" 
    fullscreen
    class="pdf-dialog" 
    @update:model-value="handleClose"
  >
    <div class="pdf-dialog-wrapper">
      <div class="pdf-content">
        <div class="pdf-header">
          <div class="pdf-header-info">
            <h3 class="pdf-title">
              {{ title }}
              <span class="pdf-update-date" v-if="updateDate">更新时间：{{ updateDate }}</span>
            </h3>
          </div>
          <div class="pdf-header-actions">
            <el-button size="small" type="primary" @click="handleDownload">
              <i class="ri-folder-download-line"></i>
              下载
            </el-button>
          </div>
        </div>
        <div class="pdf-body">
          <iframe 
            v-if="pdfUrl" 
            :src="pdfUrl + '#toolbar=0'" 
            class="pdf-iframe"
            frameborder="0"
            type="application/pdf"
          ></iframe>
          <div v-else class="pdf-placeholder">
            <div class="pdf-placeholder-content">
              <i class="ri-file-pdf-line"></i>
              <p>{{ title }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  pdfUrl: {
    type: String,
    default: ''
  },
  updateDate: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:visible', 'close'])

const handleClose = (value) => {
  emit('update:visible', value)
  if (!value) {
    emit('close')
  }
}

const handleDownload = () => {
  if (props.pdfUrl) {
    // 创建一个临时的 a 标签来触发下载
    const link = document.createElement('a')
    link.href = props.pdfUrl
    link.download = props.title || 'document.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
</script>

<style scoped>
.pdf-dialog-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-content {
  width: 90%;
  max-width: 1200px;
  height: 90vh;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.pdf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  flex-shrink: 0;
}

.pdf-header-info {
  flex: 1;
  min-width: 0;
}

.pdf-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 12px;
}

.pdf-update-date {
  font-size: 14px;
  font-weight: normal;
  color: #6b7280;
  flex-shrink: 0;
}

.pdf-header-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.pdf-header-actions .el-button {
  margin-bottom: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  border: none !important;
  border-radius: 8px !important;
  padding: 5px 10px !important;
  font-size: 12px !important;
  line-height: 1.25rem !important;
  font-weight: 700 !important;
  background: #2563eb !important;
  color: #fff !important;
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3) !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  height: 35px !important;
}

.pdf-header-actions .el-button:hover {
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.4) !important;
  transform: translateY(-1px);
}

.pdf-header-actions .el-button:active {
  transform: translateY(0);
}

.pdf-header-actions .el-button i {
  margin-right: 0 !important;
}

.pdf-body {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.pdf-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.pdf-placeholder-content {
  text-align: center;
  color: #666;
}

.pdf-placeholder-content i {
  font-size: 64px;
  color: #d32f2f;
  margin-bottom: 16px;
  display: block;
}

.pdf-placeholder-content p {
  font-size: 16px;
  margin: 0;
}
</style>

