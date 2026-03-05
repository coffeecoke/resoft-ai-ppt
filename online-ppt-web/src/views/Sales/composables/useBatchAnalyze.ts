/**
 * 批量AI分析
 * 
 * 批量分析多个文档的多个幻灯片，使用SSE流式接收结果
 */

import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { SERVER_URL, authFetch } from '@/services'
import { usePptDialogAiStore } from '@/store/Sales/pptDialogAi'

interface PendingItem {
  id: string
  documentId: string
  slideIds?: string[]
  title: string
  [key: string]: any
}

interface AnalysisResult {
  itemIndex: number
  title: string
  documentId: string
  slideIds: string[]
  content: string
  error?: string
  status: 'pending' | 'analyzing' | 'completed' | 'error'
}

export function useBatchAnalyze() {
  const analyzing = ref(false)
  const progress = ref({ current: 0, total: 0 })
  const results = ref<AnalysisResult[]>([])

  /**
   * 开始批量分析
   */
  async function startAnalyze(items: PendingItem[]): Promise<AnalysisResult[]> {
    console.log('[useBatchAnalyze] startAnalyze 被调用')
    console.log('[useBatchAnalyze] 接收到的items:', items)
    
    if (items.length === 0) {
      ElMessage.warning('请选择要分析的项目')
      return []
    }

    const pptDialogAiStore = usePptDialogAiStore()
    
    // 1. 打开AI助手面板
    console.log('[useBatchAnalyze] 打开AI助手')
    pptDialogAiStore.openAiPanel()
    
    // 2. 添加用户请求消息
    const userMessage = `请分析以下 ${items.length} 个幻灯片：\n${items.map((item, idx) => `${idx + 1}. ${item.title}`).join('\n')}`
    pptDialogAiStore.addAiMessage({
      role: 'user',
      content: userMessage
    })
    
    // 3. 添加初始的AI响应消息（用于流式更新）
    pptDialogAiStore.addAiMessage({
      role: 'assistant',
      content: '开始批量AI分析...\n\n'
    })

    analyzing.value = true
    progress.value = { current: 0, total: items.length }
    results.value = []

    // 初始化结果数组
    items.forEach((item, index) => {
      results.value.push({
        itemIndex: index,
        title: item.title,
        documentId: item.documentId,
        slideIds: item.slideIds || [],
        content: '',
        status: 'pending'
      })
    })

    return new Promise((resolve, reject) => {
      try {
        // 构建请求体
        const requestBody = {
          items: items.map(item => ({
            documentId: item.documentId,
            slideIds: item.slideIds || [],
            title: item.title
          }))
        }

        console.log('[批量分析] 开始批量分析，项目数量:', items.length)
        console.log('[批量分析] 请求数据:', requestBody)

        // 调用后端批量分析接口（SSE流式）
        const API_BASE_URL = SERVER_URL // 使用统一的SERVER_URL
        
        console.log('[批量分析] API地址:', `${API_BASE_URL}/sales/batch-operations/analyze`)

        // 使用 fetch 实现SSE
        authFetch(`${API_BASE_URL}/sales/batch-operations/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
              throw new Error('无法读取响应流')
            }

            let buffer = ''
            
            // 用于追踪当前正在更新的 AI 消息内容
            let currentAiMessageContent = '开始批量AI分析...\n\n'

            while (true) {
              const { done, value } = await reader.read()
              
              if (done) {
                break
              }

              // 解码数据
              buffer += decoder.decode(value, { stream: true })
              
              // 处理SSE格式的数据
              const lines = buffer.split('\n')
              buffer = lines.pop() || '' // 保留最后一个不完整的行

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.substring(6))
                    
                    if (data.type === 'start') {
                      // 开始分析某个项目
                      const result = results.value[data.itemIndex]
                      if (result) {
                        result.status = 'analyzing'
                      }
                      
                      // 更新AI助手显示
                      const startMessage = `\n---\n\n📄 **${data.title}**\n\n`
                      currentAiMessageContent += startMessage
                      pptDialogAiStore.updateLastAiMessage(currentAiMessageContent)
                      
                      console.log(`[批量分析] 开始分析项目 ${data.itemIndex + 1}: ${data.title}`)
                    }
                    else if (data.type === 'content') {
                      // 接收分析内容片段
                      const result = results.value[data.itemIndex]
                      if (result) {
                        result.content += data.content
                        result.status = 'analyzing'
                      }
                      
                      // 实时更新AI助手中的内容
                      currentAiMessageContent += data.content
                      pptDialogAiStore.updateLastAiMessage(currentAiMessageContent)
                    }
                    else if (data.type === 'end') {
                      // 某个项目分析完成
                      const result = results.value[data.itemIndex]
                      if (result) {
                        result.status = 'completed'
                        if (data.totalContent) {
                          result.content = data.totalContent
                        }
                      }
                      
                      currentAiMessageContent += '\n\n✅ **分析完成**\n'
                      pptDialogAiStore.updateLastAiMessage(currentAiMessageContent)
                      
                      progress.value.current = data.itemIndex + 1
                      console.log(`[批量分析] 项目 ${data.itemIndex + 1} 分析完成`)
                    }
                    else if (data.type === 'error') {
                      // 某个项目分析失败
                      const result = results.value[data.itemIndex]
                      if (result) {
                        result.status = 'error'
                        result.error = data.error
                      }
                      
                      currentAiMessageContent += `\n\n❌ **分析失败**: ${data.error}\n`
                      pptDialogAiStore.updateLastAiMessage(currentAiMessageContent)
                      
                      progress.value.current = data.itemIndex + 1
                      console.error(`[批量分析] 项目 ${data.itemIndex + 1} 分析失败:`, data.error)
                    }
                    else if (data.type === 'complete') {
                      // 全部完成
                      currentAiMessageContent += `\n\n---\n\n🎉 **所有项目分析完成！** 共分析 ${items.length} 个项目。`
                      pptDialogAiStore.updateLastAiMessage(currentAiMessageContent)
                      
                      console.log('[批量分析] 批量分析全部完成')
                      analyzing.value = false
                      resolve(results.value)
                    }
                  } catch (e) {
                    console.warn('[批量分析] 解析SSE数据失败:', e, line)
                  }
                }
              }
            }

            // 如果流结束但没有收到complete信号，手动完成
            if (analyzing.value) {
              analyzing.value = false
              resolve(results.value)
            }
          })
          .catch((error) => {
            console.error('[批量分析] 批量分析失败:', error)
            analyzing.value = false
            ElMessage.error('批量分析失败：' + (error.message || '未知错误'))
            reject(error)
          })
      } catch (error: any) {
        console.error('[批量分析] 启动批量分析失败:', error)
        analyzing.value = false
        ElMessage.error('启动批量分析失败：' + (error.message || '未知错误'))
        reject(error)
      }
    })
  }

  return {
    analyzing,
    progress,
    results,
    startAnalyze
  }
}

