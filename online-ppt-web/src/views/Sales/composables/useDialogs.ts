/**
 * useDialogs
 * 管理所有对话框的状态和打开逻辑
 */

import { ref } from 'vue'
import { salesData } from '@/configs/salesData'
import { getDocumentThumbnails } from '@/services/thumbnailService'
import { recordDocumentView } from '@/services/documentService'
import { getTranscriptionDetail, getTranscriptionConcerns } from '@/services/salesService'

export function useDialogs() {
  // PPT对话框状态
  const dialogVisible = ref(false)
  const dialogType = ref<'public' | 'practical'>('public')
  const dialogTitle = ref('')
  const isResponseDialog = ref(false)
  const slides = ref<any[]>([...salesData.slides])
  const isLoadingSlides = ref(false) // 🆕 加载状态
  const dialogCreatedAt = ref('') // 🆕 文档创建时间
  const dialogViewCount = ref(0) // 🆕 阅读次数
  const dialogDocumentId = ref('') // 🆕 文档ID（用于下载）
  
  // 视频对话框状态
  const videoDialogVisible = ref(false)
  const videoDetail = ref({ ...salesData.videoDetail })
  
  // PDF对话框状态（如果需要）
  const pdfDialogVisible = ref(false)
  const pdfDetail = ref<any>(null)

  // 响应文件对话框状态（Home.vue ResponseFileDialog 使用）
  const responseFileDialogVisible = ref(false)
  const responseFileTitle = ref('')
  const responseFileSlides = ref<any[]>([])
  const responseFileId = ref('')  // bid_documents.id

  // 招标文件对话框状态
  const tenderFileDialogVisible = ref(false)
  const tenderFileTitle = ref('')
  const tenderFileId = ref('')  // tender_documents.id

  // 打开PPT对话框
  const openPpt = async (item: any) => {
    console.log('[PPT弹框] 点击的卡片数据:', item)
    
    dialogTitle.value = item.title
    dialogType.value = item.tag === '公共版' ? 'public' : 'practical'
    isResponseDialog.value = item.type === 'response'
    dialogCreatedAt.value = item.createdAt || item.updatedAt || '' // 🆕 设置创建时间
    dialogViewCount.value = item.viewCount || 0 // 🆕 设置阅读次数（暂时为0）
    dialogDocumentId.value = item.id || '' // 🆕 设置文档ID
    
    // ✅ 先清空slides，避免显示上次的数据
    slides.value = []
    
    // 如果是响应文件，打开响应文件专用弹窗（docx 预览）
    if (item.type === 'response') {
      responseFileTitle.value = item.title
      responseFileId.value = item.id  // bid_documents.id
      responseFileDialogVisible.value = true
      return
    }

    // 如果是招标文件，打开招标文件专用弹窗（docx 预览）
    if (item.type === 'tender') {
      tenderFileTitle.value = item.title || item.project_name || item.name || ''
      tenderFileId.value = item.id
      tenderFileDialogVisible.value = true
      return
    }

    // 🆕 从API加载真实的缩略图数据
      if (item.id) {
        try {
          isLoadingSlides.value = true
          // ✅ 先打开弹框，显示loading状态
          dialogVisible.value = true
          
          // 🆕 记录阅读次数
          console.log('[PPT弹框] 记录阅读:', item.id)
          try {
            await recordDocumentView(item.id)
            console.log('[PPT弹框] 阅读次数已记录')
          } catch (err) {
            console.warn('[PPT弹框] 记录阅读失败:', err)
          }
          
          console.log('[PPT弹框] 开始加载缩略图:', item.id)
          
          const result: any = await getDocumentThumbnails(item.id)
          
          console.log('[PPT弹框] API返回结果:', result)
          
          // 🔍 从缩略图接口获取 viewCount
          if (result && result.viewCount !== undefined) {
            dialogViewCount.value = result.viewCount
            console.log('[PPT弹框] 从缩略图接口获取到阅读次数:', result.viewCount)
          }
          
          // axios拦截器已经提取了response.data，所以result就是后端返回的data部分
          if (result && result.thumbnails && result.thumbnails.length > 0) {
            slides.value = [...result.thumbnails]
              .sort((a: any, b: any) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0))
              .map((thumbnail: any, i: number) => ({
                id: thumbnail.slideId,
                title: `幻灯片 ${i + 1}`,
                img: thumbnail.url,
                slideIndex: i,
                metadata: thumbnail.metadata
              }))
            
            console.log('[PPT弹框] 缩略图加载成功，数量:', slides.value.length)
            console.log('[PPT弹框] 转换后的slides数据:', slides.value)
          } else {
            console.warn('[PPT弹框] 加载缩略图失败，使用默认数据:', result)
            // 加载失败时使用默认slides
            slides.value = [...salesData.slides]
          }
        } catch (error) {
          console.error('[PPT弹框] 加载缩略图异常:', error)
          // 异常时使用默认slides
          slides.value = [...salesData.slides]
        } finally {
          isLoadingSlides.value = false
        }
      } else {
        console.warn('[PPT弹框] 文档ID不存在，使用默认数据')
        slides.value = [...salesData.slides]
        dialogVisible.value = true
      }
  }

  const formatDateForVideo = (d: string | null) => {
    if (!d) return ''
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // 打开视频对话框（支持从推荐页/独立页点击交流会议卡片，按 __raw.id 拉取详情）
  const openVideo = async (itemOrDetail: any) => {
    if (itemOrDetail?.__raw?.id) {
      try {
        const res = await getTranscriptionDetail(itemOrDetail.__raw.id) as { data?: any }
        const d = res?.data
        if (d) {
          let transcript: { speaker: string; time: string; content: string }[] = []
          try {
            const arr = d.dialogues ? JSON.parse(d.dialogues) : []
            transcript = arr.map((x: any) => ({
              speaker: x.speaker ?? '',
              time: x.start_time != null ? `${Math.floor(x.start_time / 60)}:${String(x.start_time % 60).padStart(2, '0')}` : '',
              content: x.content ?? ''
            }))
          } catch (_) {}
          let qa: any[] = []
          try {
            const qaRes = await getTranscriptionConcerns(d.id) as { data?: any[] }
            const list = qaRes?.data ?? []
            qa = list.map((c: any) => ({
              q: c.question ?? '',
              question: c.question ?? '',
              answerText: c.answer ?? '',
              summary: c.answer ?? '',
              answer: c.answer ?? '',
              category: c.category ?? '资质与案例',
              time: c.time_range ?? '',
              date: c.date ?? '',
              likes: c.likes ?? 0,
              expertApproved: !!c.expertApproved,
              expertAdvice: c.expertAdvice ?? '',
              expertReviewer: c.expertReviewer ?? ''
            }))
          } catch (_) {}
          videoDetail.value = {
            ...salesData.videoDetail,
            project: d.name,
            customerName: d.customer_name,
            customer: d.customer_name,
            customerType: d.customerTypeName ?? d.customer_type,
            exchangeTime: formatDateForVideo(d.completed_at || d.created_at),
            productSolution: d.productName ?? '',
            exchangeTheme: d.name,
            transcript,
            qa,
            host: '-',
            time: formatDateForVideo(d.created_at)
          }
          videoDialogVisible.value = true
          return
        }
      } catch (e) {
        console.error('加载交流会议详情失败', e)
      }
    }
    if (itemOrDetail && (itemOrDetail.transcript || itemOrDetail.customerName || itemOrDetail.exchangeTheme)) {
      videoDetail.value = { ...salesData.videoDetail, ...itemOrDetail }
    } else {
      videoDetail.value = { ...salesData.videoDetail }
    }
    videoDialogVisible.value = true
  }
  
  // 打开PDF对话框
  const openPdf = (item: any) => {
    pdfDetail.value = item
    pdfDialogVisible.value = true
  }
  
  // 打开品牌资料项（根据类型决定打开哪种对话框）
  const openBrandItem = (item: any) => {
    if (item.type === 'video') {
      openVideo(item)
    } else if (item.type === 'pdf') {
      openPdf(item)
    } else {
      openPpt(item)
    }
  }
  
  // 关闭对话框
  const closeDialog = () => {
    dialogVisible.value = false
  }
  
  const closeVideoDialog = () => {
    videoDialogVisible.value = false
  }
  
  const closePdfDialog = () => {
    pdfDialogVisible.value = false
  }
  
  return {
    // PPT对话框
    dialogVisible,
    dialogType,
    dialogTitle,
    isResponseDialog,
    slides,
    isLoadingSlides, // 🆕 导出加载状态
    dialogCreatedAt, // 🆕 导出创建时间
    dialogViewCount, // 🆕 导出阅读次数
    dialogDocumentId, // 🆕 导出文档ID
    openPpt,
    closeDialog,
    
    // 视频对话框
    videoDialogVisible,
    videoDetail,
    openVideo,
    closeVideoDialog,
    
    // PDF对话框
    pdfDialogVisible,
    pdfDetail,
    openPdf,
    closePdfDialog,

    // 响应文件对话框
    responseFileDialogVisible,
    responseFileTitle,
    responseFileSlides,
    responseFileId,

    // 招标文件对话框
    tenderFileDialogVisible,
    tenderFileTitle,
    tenderFileId,

    // 统一处理
    openBrandItem,
  }
}

