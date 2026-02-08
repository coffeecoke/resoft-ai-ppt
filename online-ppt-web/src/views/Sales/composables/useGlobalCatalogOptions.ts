/**
 * 全局产品目录选项（用于高级筛选）
 * 从后端 API 动态获取
 */

import { ref, computed, onMounted } from 'vue'
import { getProductCatalogs } from '@/services/productCatalogService'

export function useGlobalCatalogOptions() {
  const catalogs = ref<any[]>([])
  const loading = ref(false)
  
  /**
   * 加载全局产品目录树（不带筛选条件）
   */
  const loadCatalogs = async () => {
    loading.value = true
    try {
      // 不传productId和filters，获取完整的目录树
      const res = await getProductCatalogs(undefined, {})
      
      if (res.success) {
        catalogs.value = res.data.catalogs
      } else {
        console.error('[全局目录选项] ❌ 加载失败:', res.error)
        catalogs.value = []
      }
    } catch (error) {
      console.error('[全局目录选项] ❌ 加载异常:', error)
      catalogs.value = []
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 提取所有二级目录作为筛选选项
   */
  const catalogOptions = computed(() => {
    const options: Array<{ label: string; value: string }> = []
    
    catalogs.value.forEach(level1 => {
      if (level1.children && Array.isArray(level1.children)) {
        level1.children.forEach((level2: any) => {
          if (level2.code && level2.name) {
            options.push({
              label: level2.name,  // 显示名称，如"公司简介"
              value: level2.code   // 使用code作为值，如"1.1"
            })
          }
        })
      }
    })
    
    return options
  })
  
  // 组件挂载时加载
  onMounted(() => {
    loadCatalogs()
  })
  
  return {
    catalogs,
    catalogOptions,
    loading,
    loadCatalogs
  }
}

