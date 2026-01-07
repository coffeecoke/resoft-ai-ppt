/**
 * 批量合并导出PPTX
 * 
 * 从多个文档中提取指定的幻灯片，合并为单个PPTX文件
 */

import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from '@/services/config'
import { SERVER_URL } from '@/services'
import { useExportPPT } from './useExportPPT'

interface PendingItem {
  id: string
  documentId: string
  slideIds?: string[]
  title: string
  [key: string]: any
}

interface BatchDocument {
  documentId: string
  metadata: any
  documentData: {
    slides: any[]
    [key: string]: any
  }
  error?: string
}

export function useBatchExport() {
  const exporting = ref(false)
  const progress = ref({ current: 0, total: 0 })

  /**
   * 批量获取文档数据
   */
  async function fetchBatchDocuments(items: PendingItem[]): Promise<BatchDocument[]> {
    try {
      console.log('[批量导出] 准备请求，items:', items)
      console.log('[批量导出] API URL:', `${SERVER_URL}/sales/documents/batch-fetch`)
      
      const requestBody = {
        items: items.map(item => ({
          documentId: item.documentId,
          slideIds: item.slideIds || []
        }))
      }
      
      console.log('[批量导出] 请求体:', requestBody)
      
      const response = await axios.post(`${SERVER_URL}/sales/documents/batch-fetch`, requestBody) as {
        success: boolean
        data?: BatchDocument[]
        error?: string
      }

      console.log('[批量导出] 后端响应:', response)

      if (!response.success || !response.data) {
        throw new Error(response.error || '批量获取文档数据失败')
      }

      return response.data
    } catch (error: any) {
      console.error('[批量导出] 获取文档数据失败:', error)
      console.error('[批量导出] 错误详情:', error.response?.data || error.message)
      throw new Error(error.message || '批量获取文档数据失败')
    }
  }

  /**
   * 导出合并的PPTX文件
   */
  async function exportMergedPPTX(items: PendingItem[]) {
    if (items.length === 0) {
      ElMessage.warning('请选择要导出的项目')
      return
    }

    exporting.value = true
    progress.value = { current: 0, total: items.length }

    try {
      console.log('[批量导出] 开始批量导出，项目数量:', items.length)

      // 1. 批量获取文档数据
      ElMessage.info('正在获取文档数据...')
      const documents = await fetchBatchDocuments(items)
      
      console.log('[批量导出] 获取到的文档数据:', documents)
      
      // 过滤掉有错误的文档
      const validDocuments = documents.filter(doc => !doc.error)
      const errorDocuments = documents.filter(doc => doc.error)
      
      console.log('[批量导出] 有效文档数:', validDocuments.length)
      console.log('[批量导出] 错误文档数:', errorDocuments.length)
      
      if (errorDocuments.length > 0) {
        console.error('[批量导出] 错误文档详情:', errorDocuments)
      }
      
      const errorCount = documents.length - validDocuments.length

      if (validDocuments.length === 0) {
        throw new Error('没有可导出的文档')
      }

      if (errorCount > 0) {
        ElMessage.warning(`${errorCount} 个文档获取失败，将继续导出其他文档`)
      }

      console.log('[批量导出] 成功获取', validDocuments.length, '个文档')

      // 2. 合并所有文档的幻灯片到一个文档数据中
      const mergedDocumentData: any = {
        title: `批量导出_${new Date().toISOString().split('T')[0]}`,
        width: validDocuments[0].documentData.width || 1000,
        height: validDocuments[0].documentData.height || 562.5,
        theme: validDocuments[0].documentData.theme || {},
        slides: []
      }

      // 合并所有幻灯片
      for (const doc of validDocuments) {
        if (doc.documentData && doc.documentData.slides) {
          mergedDocumentData.slides.push(...doc.documentData.slides)
        }
      }

      console.log('[批量导出] 合并后的总幻灯片数:', mergedDocumentData.slides.length)

      // 3. 使用 useExportPPT 导出合并后的数据
      ElMessage.info('正在生成PPTX文件...')
      
      const { exportPPTX } = useExportPPT('temp_batch_export') // documentId 参数在这个场景下不会被使用
      await exportPPTX([], mergedDocumentData) // 传入合并后的数据

      ElMessage.success(`批量导出完成！共 ${mergedDocumentData.slides.length} 张幻灯片`)
      console.log('[批量导出] 导出完成，总幻灯片数:', mergedDocumentData.slides.length)

    } catch (error: any) {
      console.error('[批量导出] 导出失败:', error)
      ElMessage.error('批量导出失败：' + (error.message || '未知错误'))
      throw error
    } finally {
      exporting.value = false
      progress.value = { current: 0, total: 0 }
    }
  }

  return {
    exporting,
    progress,
    exportMergedPPTX
  }
}

