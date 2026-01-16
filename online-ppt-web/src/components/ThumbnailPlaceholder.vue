<template>
  <div class="thumbnail-placeholder">
    <el-icon :size="40" color="#DCDFE6">
      <Picture />
    </el-icon>
    <span class="placeholder-text">暂无缩略图</span>
  </div>
</template>

<script setup lang="ts">
import { Picture } from '@element-plus/icons-vue'
</script>

<style scoped>
.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.thumbnail-placeholder:hover {
  border-color: #c0c4cc;
  background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%);
}

.placeholder-text {
  margin-top: 12px;
  font-size: 13px;
  color: #909399;
  font-weight: 500;
}
</style>
