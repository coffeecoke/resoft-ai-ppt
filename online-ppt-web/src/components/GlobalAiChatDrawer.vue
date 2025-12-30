<template>
  <el-drawer
    v-model="drawerVisible"
    :size="400"
    direction="rtl"
    :before-close="handleClose"
    :show-close="false"
  >
    <template #header>
      <div class="drawer-header">
        <div class="drawer-title">
          <i class="ri-quill-pen-ai-line"></i>
          AI助手
        </div>
        <button class="drawer-close-btn" @click="handleClose" title="关闭AI助手">
          <i class="ri-close-line"></i>
        </button>
      </div>
    </template>
    
    <div class="drawer-content">
      <div class="ai-panel-footer">
        <div class="ai-input-wrapper">
          <textarea 
            class="ai-input" 
            placeholder="需要我做什么?输入@发现更多技能"
            v-model="aiInputText"
            rows="4"
          ></textarea>
          <div class="ai-input-actions">
            <button class="ai-send-btn" type="button" @click="sendAiMessage">
              <i class="ri-send-plane-fill"></i>
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
  
  <!-- 全局浮动按钮 -->
  <button 
    v-show="!drawerVisible" 
    class="global-ai-float-btn" 
    @click="openDrawer"
    title="打开AI助手"
  >
    <i class="ri-ai"></i>
  </button>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible'])

const drawerVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const aiInputText = ref('')

const openDrawer = () => {
  drawerVisible.value = true
}

const handleClose = () => {
  drawerVisible.value = false
}

// 发送AI消息
const sendAiMessage = () => {
  if (!aiInputText.value.trim()) {
    ElMessage.warning('请输入消息内容')
    return
  }
  // TODO: 实现发送AI消息的逻辑
  console.log('发送消息:', aiInputText.value)
  ElMessage.success('消息已发送')
  // 清空输入框
  aiInputText.value = ''
}
</script>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.drawer-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}
.drawer-title i {
  font-size: 20px;
  color: #2563eb;
}
.drawer-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #6b7280;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}
.drawer-close-btn:hover {
  color: #1f2937;
}
.drawer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  justify-content: flex-end;
}
.ai-panel-footer {
  padding: 16px 16px 16px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.ai-input-wrapper {
  position: relative;
  width: 100%;
}
.ai-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.ai-input:focus {
  border-color: #2563eb;
}
.ai-input::placeholder {
  color: #9ca3af;
}
.ai-input-actions {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-send-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.ai-send-btn:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
}
.ai-send-btn:active {
  transform: translateY(0);
}
.ai-send-btn i {
  font-size: 16px;
}
.global-ai-float-btn {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
  transition: all 0.3s;
  z-index: 9999;
}
.global-ai-float-btn:hover {
  background: #1d4ed8;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.5);
  transform: translateY(-2px);
}
.global-ai-float-btn i {
  font-size: 24px;
}
</style>

