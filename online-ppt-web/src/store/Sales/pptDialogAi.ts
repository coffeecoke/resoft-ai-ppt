import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * PPT对话框AI面板状态管理
 * 用于全局AI按钮与PPT对话框AI面板的通信
 */
export const usePptDialogAiStore = defineStore('pptDialogAi', () => {
  // PPT对话框是否打开
  const isPptDialogOpen = ref(false)
  
  // AI面板是否打开
  const isAiPanelOpen = ref(false)
  
  // 打开AI面板的回调函数
  const openAiPanelCallback = ref<(() => void) | null>(null)
  
  // 关闭AI面板的回调函数
  const closeAiPanelCallback = ref<(() => void) | null>(null)
  
  // 添加消息到AI助手的回调函数
  const addAiMessageCallback = ref<((message: { role: string; content: string }) => void) | null>(null)
  
  // 更新最后一条AI消息的回调函数
  const updateLastAiMessageCallback = ref<((content: string) => void) | null>(null)

  // 设置PPT对话框打开状态
  const setPptDialogOpen = (open: boolean) => {
    isPptDialogOpen.value = open
  }

  // 注册打开AI面板的回调
  const registerOpenAiPanel = (callback: () => void) => {
    openAiPanelCallback.value = callback
  }

  // 注销回调
  const unregisterOpenAiPanel = () => {
    openAiPanelCallback.value = null
  }

  // 打开AI面板
  const openAiPanel = () => {
    if (openAiPanelCallback.value) {
      openAiPanelCallback.value()
      isAiPanelOpen.value = true
    }
  }

  // 关闭AI面板
  const closeAiPanel = () => {
    if (closeAiPanelCallback.value) {
      closeAiPanelCallback.value()
      isAiPanelOpen.value = false
    }
  }

  // 注册关闭AI面板的回调
  const registerCloseAiPanel = (callback: () => void) => {
    closeAiPanelCallback.value = callback
  }

  // 注销关闭回调
  const unregisterCloseAiPanel = () => {
    closeAiPanelCallback.value = null
  }

  // 设置AI面板打开状态
  const setAiPanelOpen = (open: boolean) => {
    isAiPanelOpen.value = open
  }

  // 注册添加AI消息的回调
  const registerAddAiMessage = (callback: (message: { role: string; content: string }) => void) => {
    addAiMessageCallback.value = callback
  }

  // 注销添加AI消息回调
  const unregisterAddAiMessage = () => {
    addAiMessageCallback.value = null
  }

  // 添加消息到AI助手
  const addAiMessage = (message: { role: string; content: string }) => {
    if (addAiMessageCallback.value) {
      addAiMessageCallback.value(message)
    }
  }

  // 注册更新最后一条AI消息的回调
  const registerUpdateLastAiMessage = (callback: (content: string) => void) => {
    updateLastAiMessageCallback.value = callback
  }

  // 注销更新最后一条AI消息回调
  const unregisterUpdateLastAiMessage = () => {
    updateLastAiMessageCallback.value = null
  }

  // 更新最后一条AI消息
  const updateLastAiMessage = (content: string) => {
    if (updateLastAiMessageCallback.value) {
      updateLastAiMessageCallback.value(content)
    }
  }

  return {
    isPptDialogOpen,
    isAiPanelOpen,
    openAiPanelCallback,
    setPptDialogOpen,
    registerOpenAiPanel,
    unregisterOpenAiPanel,
    openAiPanel,
    registerCloseAiPanel,
    unregisterCloseAiPanel,
    closeAiPanel,
    setAiPanelOpen,
    registerAddAiMessage,
    unregisterAddAiMessage,
    addAiMessage,
    registerUpdateLastAiMessage,
    unregisterUpdateLastAiMessage,
    updateLastAiMessage
  }
})

