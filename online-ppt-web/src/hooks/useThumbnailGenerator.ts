import { ref } from 'vue'
import { toJpeg } from 'html-to-image'
import { uploadThumbnail } from '@/services/thumbnailService'
import { useSlidesStore } from '@/store'
import type { Slide } from '@/types/slides'
import message from '@/utils/message'

export interface ThumbnailGenerationProgress {
  current: number
  total: number
  currentSlideId: string
  status: 'generating' | 'uploading' | 'completed' | 'error'
}

export interface ThumbnailGenerationResult {
  slideId: string
  success: boolean
  thumbnailUrl?: string
  error?: string
}

// 全局状态，所有实例共享
const globalGenerating = ref(false)
const globalProgress = ref<ThumbnailGenerationProgress | null>(null)

/**
 * 预览图生成器 Hook
 * 使用 html-to-image 将幻灯片 DOM 转换为图片并上传到后端
 */
export default () => {
  const generating = globalGenerating
  const progress = globalProgress

  /**
   * 查找幻灯片的 DOM 元素
   */
  const findSlideElement = (slideId: string): HTMLElement | null => {
    // 策略1: 直接通过 data-slide-id 查找（最准确）
    let element = document.querySelector(
      `[data-slide-id="${slideId}"]`
    ) as HTMLElement

    if (element) {
      console.log(`[预览图生成] 策略1成功: 找到幻灯片 ${slideId}`)
      return element
    }

    // 策略2: 在缩略图列表中查找
    element = document.querySelector(
      `.thumbnail-list [data-slide-id="${slideId}"]`
    ) as HTMLElement

    if (element) {
      console.log(`[预览图生成] 策略2成功: 找到幻灯片 ${slideId}`)
      return element
    }

    // 策略3: 查找 .thumbnail-slide 并检查其内部
    const thumbnailSlides = document.querySelectorAll('.thumbnail-slide')
    for (const slide of thumbnailSlides) {
      if (slide.getAttribute('data-slide-id') === slideId) {
        element = slide as HTMLElement
        console.log(`[预览图生成] 策略3成功: 找到幻灯片 ${slideId}`)
        return element
      }
    }

    // 策略4: 通过 slide index 查找（最后的备选方案）
    const { slides } = useSlidesStore()
    const slideIndex = slides.findIndex(s => s.id === slideId)
    if (slideIndex !== -1) {
      const thumbnailItems = document.querySelectorAll('.thumbnail-list .thumbnail-slide')
      if (thumbnailItems[slideIndex]) {
        element = thumbnailItems[slideIndex] as HTMLElement
        console.log(`[预览图生成] 策略4成功: 通过索引 ${slideIndex} 找到幻灯片 ${slideId}`)
        return element
      }
    }

    console.warn(`[预览图生成] 所有策略失败: 找不到幻灯片 ${slideId}`)
    return null
  }

  /**
   * 生成单个幻灯片的预览图
   */
  const generateThumbnail = async (
    slideId: string,
    slideElement?: HTMLElement
  ): Promise<Blob> => {
    // 如果没有提供元素，尝试查找
    const element = slideElement || findSlideElement(slideId)
    
    if (!element) {
      throw new Error(`找不到幻灯片元素: ${slideId}`)
    }

    // 移除可能影响渲染的 xmlns 属性
    const foreignObjectSpans = element.querySelectorAll('foreignObject [xmlns]')
    foreignObjectSpans.forEach(span => span.removeAttribute('xmlns'))

    // 获取幻灯片实际渲染尺寸
    const { viewportRatio, viewportSize } = useSlidesStore()
    
    // 获取元素的实际尺寸
    const elementRect = element.getBoundingClientRect()
    const actualWidth = elementRect.width
    const actualHeight = elementRect.height
    
    // 计算目标尺寸（保持幻灯片比例）
    const targetWidth = 800
    const targetHeight = Math.round(targetWidth * viewportRatio)
    
    // 计算缩放比例（基于实际尺寸）
    const scale = targetWidth / actualWidth

    console.log(`[预览图生成] 元素实际尺寸: ${actualWidth}x${actualHeight}, 目标尺寸: ${targetWidth}x${targetHeight}, 缩放比例: ${scale.toFixed(2)}`)

    // 转换为 JPEG 格式（体积更小）
    // 使用 canvasWidth 和 canvasHeight 而不是 width 和 height
    const dataUrl = await toJpeg(element, {
      quality: 0.8,
      canvasWidth: targetWidth,
      canvasHeight: targetHeight,
      fontEmbedCSS: '', // 忽略 Web 字体，加快生成速度
      pixelRatio: 1,
    })

    // 将 DataURL 转换为 Blob
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    
    return blob
  }

  /**
   * 生成并上传单个预览图
   */
  const generateAndUploadThumbnail = async (
    documentId: string,
    slideId: string,
    slideElement?: HTMLElement
  ): Promise<ThumbnailGenerationResult> => {
    try {
      // 生成预览图
      const blob = await generateThumbnail(slideId, slideElement)
      
      // 上传到后端
      const result = await uploadThumbnail(documentId, slideId, blob)
      
      // 确保 result 存在且有 success 字段
      if (!result || typeof result !== 'object') {
        console.error(`[预览图生成] 上传返回数据格式错误: ${slideId}`, result)
        return {
          slideId,
          success: false,
          error: '上传返回数据格式错误'
        }
      }
      
      if (result.success) {
        return {
          slideId,
          success: true,
          thumbnailUrl: result.thumbnailUrl
        }
      } else {
        return {
          slideId,
          success: false,
          error: result.error || '上传失败'
        }
      }
    } catch (error: any) {
      console.error(`[预览图生成] 生成失败: ${slideId}`, error)
      return {
        slideId,
        success: false,
        error: error.message || '生成失败'
      }
    }
  }

  /**
   * 批量生成预览图
   */
  const generateThumbnails = async (
    documentId: string,
    slides: Slide[],
    onProgress?: (progress: ThumbnailGenerationProgress) => void
  ): Promise<ThumbnailGenerationResult[]> => {
    if (slides.length === 0) {
      return []
    }

    // 防止重复调用：如果已经在生成中，跳过本次调用
    if (generating.value) {
      console.warn(`[预览图生成] 已有生成任务在进行中，跳过本次调用 (请求生成 ${slides.length} 个)`)
      return []
    }

    console.log(`[预览图生成] 开始生成，总数: ${slides.length}`)
    console.log(`[预览图生成] 幻灯片ID列表:`, slides.map(s => s.id))
    generating.value = true
    const results: ThumbnailGenerationResult[] = []
    const total = slides.length

    try {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        
        console.log(`[预览图生成] 处理第 ${i + 1}/${total} 个幻灯片: ${slide.id}`)
        
        // 更新进度
        progress.value = {
          current: i + 1,
          total,
          currentSlideId: slide.id,
          status: 'generating'
        }
        
        if (onProgress) {
          onProgress(progress.value)
        }

        // 查找元素
        const slideElement = findSlideElement(slide.id)
        
        if (!slideElement) {
          console.warn(`[预览图生成] 找不到幻灯片元素: ${slide.id}`)
          results.push({
            slideId: slide.id,
            success: false,
            error: '找不到幻灯片元素'
          })
          continue
        }

        // 生成并上传
        progress.value.status = 'uploading'
        if (onProgress) {
          onProgress(progress.value)
        }

        const result = await generateAndUploadThumbnail(documentId, slide.id, slideElement)
        results.push(result)
        
        console.log(`[预览图生成] 第 ${i + 1}/${total} 个完成，结果:`, result.success ? '成功' : `失败 - ${result.error}`)

        // 添加小延迟，避免过快请求
        if (i < slides.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // 完成
      progress.value = {
        current: total,
        total,
        currentSlideId: '',
        status: 'completed'
      }
      
      if (onProgress) {
        onProgress(progress.value)
      }

      const successCount = results.filter(r => r.success).length
      console.log(`[预览图生成] 全部完成，成功: ${successCount}/${total}`)

      return results
    } catch (error: any) {
      console.error('[预览图生成] 批量生成失败:', error)
      
      progress.value = {
        current: results.length,
        total,
        currentSlideId: '',
        status: 'error'
      }
      
      if (onProgress) {
        onProgress(progress.value)
      }

      throw error
    } finally {
      generating.value = false
    }
  }

  /**
   * 异步生成预览图（不阻塞主流程）
   */
  const generateThumbnailsAsync = async (
    documentId: string,
    slides: Slide[],
    onProgress?: (progress: ThumbnailGenerationProgress) => void,
    onComplete?: (results: ThumbnailGenerationResult[]) => void
  ) => {
    // 防止重复调用：如果已经在生成中，直接返回
    if (generating.value) {
      console.warn(`[预览图生成] 已有生成任务在进行中，跳过异步调用`)
      return
    }

    // 使用 setTimeout 将任务放到下一个事件循环
    // generateThumbnails 内部会管理 generating 标志
    setTimeout(async () => {
      try {
        const results = await generateThumbnails(documentId, slides, onProgress)
        
        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length
        
        if (failCount === 0) {
          message.success(`预览图生成成功（${successCount}/${results.length}）`)
        } else if (successCount > 0) {
          message.warning(`预览图部分生成成功（${successCount}/${results.length}）`)
        } else {
          message.error('预览图生成失败')
        }
        
        if (onComplete) {
          onComplete(results)
        }
      } catch (error: any) {
        console.error('[预览图生成] 异步生成失败:', error)
        message.error('预览图生成失败: ' + error.message)
      }
    }, 0)
  }

  /**
   * 限流版本：限制并发数量
   */
  const generateThumbnailsWithLimit = async (
    documentId: string,
    slides: Slide[],
    concurrency: number = 3,
    onProgress?: (progress: ThumbnailGenerationProgress) => void
  ): Promise<ThumbnailGenerationResult[]> => {
    if (slides.length === 0) {
      return []
    }

    generating.value = true
    const results: ThumbnailGenerationResult[] = []
    const total = slides.length
    let completed = 0

    try {
      // 分批处理
      for (let i = 0; i < slides.length; i += concurrency) {
        const batch = slides.slice(i, i + concurrency)
        
        // 并发生成这一批
        const batchPromises = batch.map(async (slide) => {
          const slideElement = findSlideElement(slide.id)
          
          if (!slideElement) {
            return {
              slideId: slide.id,
              success: false,
              error: '找不到幻灯片元素'
            }
          }

          return await generateAndUploadThumbnail(documentId, slide.id, slideElement)
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        
        completed += batch.length

        // 更新进度
        progress.value = {
          current: completed,
          total,
          currentSlideId: batch[batch.length - 1].id,
          status: completed < total ? 'generating' : 'completed'
        }
        
        if (onProgress) {
          onProgress(progress.value)
        }
      }

      return results
    } catch (error: any) {
      console.error('[预览图生成] 批量生成失败:', error)
      throw error
    } finally {
      generating.value = false
    }
  }

  return {
    generating,
    progress,
    generateThumbnail,
    generateAndUploadThumbnail,
    generateThumbnails,
    generateThumbnailsAsync,
    generateThumbnailsWithLimit,
  }
}

