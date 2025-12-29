/**
 * useDialogs
 * 管理所有对话框的状态和打开逻辑
 */

import { ref } from 'vue'
import { salesData } from '@/configs/salesData'

export function useDialogs() {
  // PPT对话框状态
  const dialogVisible = ref(false)
  const dialogType = ref<'public' | 'practical'>('public')
  const dialogTitle = ref('')
  const isResponseDialog = ref(false)
  const slides = ref<any[]>([...salesData.slides])
  
  // 视频对话框状态
  const videoDialogVisible = ref(false)
  const videoDetail = ref({ ...salesData.videoDetail })
  
  // PDF对话框状态（如果需要）
  const pdfDialogVisible = ref(false)
  const pdfDetail = ref<any>(null)
  
  // 打开PPT对话框
  const openPpt = (item: any) => {
    dialogTitle.value = item.title
    dialogType.value = item.tag === '公共版' ? 'public' : 'practical'
    isResponseDialog.value = item.type === 'response'
    
    // 如果是响应文件，生成特殊的slides
    if (item.type === 'response') {
      const responseTocFlat = salesData.responseTocSections.flatMap(section =>
        section.items.map(title => ({ section: section.title, title }))
      )
      const pages = responseTocFlat.map((t, idx) => ({
        id: `w${idx + 1}`,
        title: t.title,
        img: `https://dummyimage.com/900x1200/f8fafc/6b7280&text=${encodeURIComponent(t.title)}`
      }))
      slides.value = pages
    } else {
      // 普通PPT使用默认slides
      slides.value = [...salesData.slides]
    }
    
    dialogVisible.value = true
  }
  
  // 打开视频对话框
  const openVideo = (item: any) => {
    // 可以根据item更新videoDetail，这里暂时使用默认数据
    videoDetail.value = { ...salesData.videoDetail }
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
    
    // 统一处理
    openBrandItem,
  }
}

