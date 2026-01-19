/**
 * useProductContent
 * 管理产品内容相关逻辑：产品选择、目录切换、数据处理
 */

import { ref, computed, watch } from 'vue'
import { salesData } from '@/configs/salesData'

export function useProductContent() {
  // 产品相关状态
  const activeProduct = ref('')  // 存储 product code
  const catalogMode = ref<'single' | 'multiple'>('single')
  const activeCatalogIds = ref<string[]>([])
  const selectedParentIds = ref<string[]>([])
  
  // PPT数据
  const publicPPTData = ref<any[]>([])
  const practicalPPTData = ref<any[]>([])
  
  // 选择/取消选择产品（使用 product code）
  const selectProduct = (productCode: string) => {
    if (activeProduct.value === productCode) {
      activeProduct.value = ''
      activeCatalogIds.value = []
    } else {
      activeProduct.value = productCode
      activeCatalogIds.value = []
      updateProductContent()
    }
  }
  
  // 更新产品内容（实际项目中从API获取）
  const updateProductContent = () => {
    // TODO: 从API获取数据
    // 这里使用模拟数据
    const isOverview = activeCatalogIds.value.length === 0
    publicPPTData.value = generatePublicPPTData(isOverview)
    practicalPPTData.value = generatePracticalPPTData(isOverview)
  }
  
  // 监听目录选择变化，更新数据
  watch(activeCatalogIds, () => {
    if (activeProduct.value) {
      updateProductContent()
    }
  }, { deep: true })
  
  // 生成公共版PPT数据（模拟）
  const generatePublicPPTData = (isOverview: boolean) => {
    if (isOverview) {
      // 概览模式：返回PPT封面
      return salesData.productCatalog.map((c: any) => ({
        id: 'pub_L1_' + c.id,
        title: `${c.text} (标准拆分版)`,
        type: 'ppt-cover',
        thumbnail: `https://picsum.photos/seed/pub-${c.id}/320/180`,
        date: '2025-10-28',
        author: '研发中心产品部'
      }))
    } else {
      // 选择了目录：返回带幻灯片的详细数据
      const result: any[] = []
      activeCatalogIds.value.forEach(catId => {
        result.push({
          id: 'pb_detail_' + catId,
          title: `${activeProduct.value} 标准介绍 - ${catId}`,
          type: 'slides',
          date: '2025-10-28',
          author: '研发中心产品部',
          slides: Array.from({ length: 8 }, (_, i) => ({
            id: `pb_${catId}_${i}`,
            page: i + 1,
            img: `https://picsum.photos/seed/pb-${catId}-${i}/1024/640`
          }))
        })
      })
      return result
    }
  }
  
  // 生成实战版PPT数据（模拟）
  const generatePracticalPPTData = (isOverview: boolean) => {
    if (isOverview) {
      // 概览模式：返回文件列表
      return [
        {
          customer: '客户资料',
          meta: '',
          items: [
            { id: 'file_bh', title: `渤海银行${activeProduct.value}售前交流.ppt`, date: '2025-10-28', author: '王总', type: 'file' },
            { id: 'file_cz', title: `沧州银行${activeProduct.value}售前交流.ppt`, date: '2025-10-26', author: '刘经理', type: 'file' },
            { id: 'file_bd', title: `保定银行${activeProduct.value}售前交流.ppt`, date: '2025-10-20', author: '张总', type: 'file' }
          ]
        }
      ]
    } else {
      // 选择了目录：返回按客户分组的幻灯片
      const practicalMap = new Map()
      
      activeCatalogIds.value.forEach(catId => {
        const customers = ['渤海银行', '沧州银行']
        customers.forEach(customer => {
          if (!practicalMap.has(customer)) {
            practicalMap.set(customer, {
              customer,
              meta: '2025-10-28 | 业务部',
              items: []
            })
          }
          practicalMap.get(customer).items.push({
            id: `pr_${customer}_${catId}`,
            title: `${customer} ${activeProduct.value} - ${catId}`,
            type: 'slides',
            date: '2025-10-28',
            author: customer === '渤海银行' ? '王总' : '刘经理',
            slides: Array.from({ length: 6 }, (_, i) => ({
              id: `pr_${customer}_${catId}_${i}`,
              page: i + 1,
              img: `https://picsum.photos/seed/pr-${customer}-${catId}-${i}/1024/640`
            }))
          })
        })
      })
      
      return Array.from(practicalMap.values())
    }
  }
  
  // 判断目录是否选中
  const isCatalogSelected = (catId: string) => {
    return activeCatalogIds.value.includes(catId)
  }
  
  // 判断父目录是否全部选中
  const isParentSelected = (parentId: string) => {
    if (catalogMode.value !== 'multiple') return false
    const parent = salesData.productCatalog.find(p => p.id === parentId)
    if (!parent) return false
    return parent.children.every(child => activeCatalogIds.value.includes(child.id))
  }
  
  // 切换父目录选中状态
  const toggleParentCatalog = (parentId: string) => {
    if (catalogMode.value !== 'multiple') return
    const parent = salesData.productCatalog.find(p => p.id === parentId)
    if (!parent) return
    
    const allSelected = parent.children.every(child => activeCatalogIds.value.includes(child.id))
    if (allSelected) {
      // 取消选择该一级目录下的所有二级目录
      activeCatalogIds.value = activeCatalogIds.value.filter(
        id => !parent.children.some(c => c.id === id)
      )
    } else {
      // 选中该一级目录下的所有二级目录
      const childIds = parent.children.map(c => c.id)
      activeCatalogIds.value = [...new Set([...activeCatalogIds.value, ...childIds])]
    }
  }
  
  // 选择目录
  const selectCatalog = (catId: string) => {
    if (catalogMode.value === 'single') {
      activeCatalogIds.value = [catId]
    } else {
      toggleCatalog(catId)
    }
  }
  
  // 切换目录选中状态（多选模式）
  const toggleCatalog = (catId: string) => {
    const index = activeCatalogIds.value.indexOf(catId)
    if (index > -1) {
      activeCatalogIds.value.splice(index, 1)
    } else {
      activeCatalogIds.value.push(catId)
    }
  }
  
  // 合并幻灯片（多选模式）
  const mergedSlides = computed(() => {
    if (activeCatalogIds.value.length <= 1) return []
    
    // 合并公共版的幻灯片
    const allSlides: any[] = []
    publicPPTData.value.forEach(ppt => {
      if (ppt.type === 'slides' && ppt.slides) {
        ppt.slides.forEach((slide: any) => {
          allSlides.push({
            ...slide,
            parent: ppt,
          })
        })
      }
    })
    return allSlides
  })
  
  // 获取分组的合并幻灯片（实战版）
  const getMergedSlidesForGroup = (group: any) => {
    if (activeCatalogIds.value.length <= 1) return []
    
    const allSlides: any[] = []
    group.items.forEach((item: any) => {
      if (item.type === 'slides' && item.slides) {
        item.slides.forEach((slide: any) => {
          allSlides.push({
            ...slide,
            parent: item,
          })
        })
      }
    })
    return allSlides
  }
  
  return {
    // 状态
    activeProduct,
    catalogMode,
    activeCatalogIds,
    selectedParentIds,
    publicPPTData,
    practicalPPTData,
    
    // 方法
    selectProduct,
    updateProductContent,
    isCatalogSelected,
    isParentSelected,
    toggleParentCatalog,
    selectCatalog,
    toggleCatalog,
    
    // 计算属性
    mergedSlides,
    getMergedSlidesForGroup,
  }
}

