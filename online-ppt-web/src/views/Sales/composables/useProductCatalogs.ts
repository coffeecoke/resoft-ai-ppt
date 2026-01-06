import { ref, watch, computed, type Ref } from 'vue'
import {
  getProductCatalogs,
  getProductDocuments,
  getThumbnailsByPageTypes,
  type CatalogLevel1,
  type DocumentInfo,
  type ThumbnailInfo,
  type CustomerGroup,
  type FilterParams
} from '@/services/productCatalogService'

/**
 * 产品目录管理 Composable
 * 管理产品目录树、文档列表和缩略图的加载和状态
 */
export function useProductCatalogs(
  productCode: Ref<string>,
  filters: Ref<FilterParams | Record<string, never>>
) {
  // 目录树数据
  const catalogs = ref<CatalogLevel1[]>([])
  
  // 选中的目录code列表（支持多选）
  const activeCatalogCodes = ref<string[]>([])
  
  // 目录选择模式：single=单选，multiple=多选
  const catalogMode = ref<'single' | 'multiple'>('single')
  
  // 未选目录时的数据
  const publicDocuments = ref<DocumentInfo[]>([])
  const practicalDocuments = ref<DocumentInfo[]>([])
  
  // 选中目录后的数据
  const publicThumbnails = ref<ThumbnailInfo[]>([])
  const practicalThumbnailGroups = ref<CustomerGroup[]>([])
  
  // 加载状态
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  /**
   * 加载目录树
   */
  const loadCatalogs = async () => {
    if (!productCode.value) {
      catalogs.value = []
      return
    }
    
    try {
      loading.value = true
      error.value = null
      
      console.log('[useProductCatalogs] 📥 加载目录树:', {
        productCode: productCode.value,
        filters: filters.value
      })
      
      const res = await getProductCatalogs(productCode.value, filters.value)
      
      console.log('[useProductCatalogs] 📦 目录树响应:', {
        success: res.success,
        catalogsCount: res.data?.catalogs?.length || 0,
        error: res.error
      })
      
      if (res.success) {
        catalogs.value = res.data.catalogs
      } else {
        error.value = res.error || '加载目录树失败'
        catalogs.value = []
      }
    } catch (err: any) {
      console.error('加载目录树失败:', err)
      error.value = err.message || '加载目录树失败'
      catalogs.value = []
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 加载文档列表（未选目录时）
   */
  const loadDocuments = async () => {
    if (!productCode.value) {
      publicDocuments.value = []
      practicalDocuments.value = []
      return
    }
    
    try {
      loading.value = true
      error.value = null
      
      const [publicRes, practicalRes] = await Promise.all([
        getProductDocuments(productCode.value, 'public', filters.value),
        getProductDocuments(productCode.value, 'practical', filters.value)
      ])
      
      if (publicRes.success) {
        publicDocuments.value = publicRes.data.documents
      } else {
        console.error('加载公共版文档失败:', publicRes.error)
        publicDocuments.value = []
      }
      
      if (practicalRes.success) {
        practicalDocuments.value = practicalRes.data.documents
      } else {
        console.error('加载实战版文档失败:', practicalRes.error)
        practicalDocuments.value = []
      }
    } catch (err: any) {
      console.error('加载文档列表失败:', err)
      error.value = err.message || '加载文档列表失败'
      publicDocuments.value = []
      practicalDocuments.value = []
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 加载缩略图（选中目录后）
   */
  const loadThumbnails = async (pageTypes: string[]) => {
    if (!productCode.value || pageTypes.length === 0) {
      publicThumbnails.value = []
      practicalThumbnailGroups.value = []
      return
    }
    
    try {
      loading.value = true
      error.value = null
      
      const [publicRes, practicalRes] = await Promise.all([
        getThumbnailsByPageTypes(pageTypes, 'public', productCode.value, filters.value),
        getThumbnailsByPageTypes(pageTypes, 'practical', productCode.value, filters.value)
      ])
      
      if (publicRes.success) {
        publicThumbnails.value = publicRes.data.thumbnails || []
      } else {
        console.error('加载公共版缩略图失败:', publicRes.error)
        publicThumbnails.value = []
      }
      
      if (practicalRes.success) {
        practicalThumbnailGroups.value = practicalRes.data.groups || []
      } else {
        console.error('加载实战版缩略图失败:', practicalRes.error)
        practicalThumbnailGroups.value = []
      }
    } catch (err: any) {
      console.error('加载缩略图失败:', err)
      error.value = err.message || '加载缩略图失败'
      publicThumbnails.value = []
      practicalThumbnailGroups.value = []
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 监听productCode和filters变化，重新加载数据
   */
  watch(
    [productCode, filters],
    (newValues, oldValues) => {
      console.log('[useProductCatalogs] 🔍 Watch触发:', {
        productCode: productCode.value,
        filters: filters.value,
        filtersChanged: JSON.stringify(newValues[1]) !== JSON.stringify(oldValues?.[1])
      })
      
      if (!productCode.value) {
        catalogs.value = []
        publicDocuments.value = []
        practicalDocuments.value = []
        publicThumbnails.value = []
        practicalThumbnailGroups.value = []
        return
      }
      
      // 重新加载目录树
      loadCatalogs()
      
      // 根据当前选择状态加载对应数据
      if (activeCatalogCodes.value.length === 0) {
        loadDocuments()
      } else {
        loadThumbnails(activeCatalogCodes.value)
      }
    },
    { deep: true, immediate: true }
  )
  
  /**
   * 监听目录选择变化
   */
  watch(activeCatalogCodes, (newCodes) => {
    if (!productCode.value) return
    
    if (newCodes.length === 0) {
      // 取消选择，加载文档列表
      loadDocuments()
    } else {
      // 选择目录，加载缩略图
      loadThumbnails(newCodes)
    }
  })
  
  /**
   * 切换目录选择模式
   */
  const setCatalogMode = (mode: 'single' | 'multiple') => {
    catalogMode.value = mode
    
    // 切换模式时，如果是单选模式且当前多选，只保留第一个
    if (mode === 'single' && activeCatalogCodes.value.length > 1) {
      activeCatalogCodes.value = activeCatalogCodes.value.slice(0, 1)
    }
  }
  
  /**
   * 选择目录
   */
  const selectCatalog = (code: string) => {
    if (catalogMode.value === 'single') {
      // 单选模式：替换当前选择
      activeCatalogCodes.value = [code]
    } else {
      // 多选模式：切换选择状态
      const index = activeCatalogCodes.value.indexOf(code)
      if (index > -1) {
        activeCatalogCodes.value.splice(index, 1)
      } else {
        activeCatalogCodes.value.push(code)
      }
    }
  }
  
  /**
   * 清除所有选择
   */
  const clearSelection = () => {
    activeCatalogCodes.value = []
  }
  
  return {
    // 状态
    catalogs,
    activeCatalogCodes,
    catalogMode,
    publicDocuments,
    practicalDocuments,
    publicThumbnails,
    practicalThumbnailGroups,
    loading,
    error,
    
    // 方法
    loadCatalogs,
    loadDocuments,
    loadThumbnails,
    setCatalogMode,
    selectCatalog,
    clearSelection
  }
}

