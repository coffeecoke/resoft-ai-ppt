import { ref, watch, type Ref, type ComputedRef } from 'vue'
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
 *
 * @param productCode 产品代码
 * @param externalCatalogCodes 外部传入的目录筛选条件（来自 FilterPanel）
 */
export function useProductCatalogs(
  productCode: Ref<string>,
  externalCatalogCodes: Ref<string[]> | ComputedRef<string[]>
) {
  // 目录树数据
  const catalogs = ref<CatalogLevel1[]>([])

  // 直接使用外部传入的目录筛选条件
  const activeCatalogCodes = externalCatalogCodes

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

      const res = await getProductCatalogs(productCode.value, {})

      if (res.success) {
        catalogs.value = res.data.catalogs
      } else {
        error.value = res.error || '加载目录树失败'
        catalogs.value = []
      }
    } catch (err: any) {
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
        getProductDocuments(productCode.value, 'public', {}),
        getProductDocuments(productCode.value, 'practical', {})
      ])

      if (publicRes.success) {
        publicDocuments.value = publicRes.data.documents
      } else {
        publicDocuments.value = []
      }

      if (practicalRes.success) {
        practicalDocuments.value = practicalRes.data.documents
      } else {
        practicalDocuments.value = []
      }
    } catch (err: any) {
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
        getThumbnailsByPageTypes(pageTypes, 'public', productCode.value, {}),
        getThumbnailsByPageTypes(pageTypes, 'practical', productCode.value, {})
      ])

      if (publicRes.success) {
        publicThumbnails.value = publicRes.data.thumbnails || []
      } else {
        publicThumbnails.value = []
      }

      if (practicalRes.success) {
        practicalThumbnailGroups.value = practicalRes.data.groups || []
      } else {
        practicalThumbnailGroups.value = []
      }
    } catch (err: any) {
      error.value = err.message || '加载缩略图失败'
      publicThumbnails.value = []
      practicalThumbnailGroups.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * 监听 productCode 变化，重新加载目录树
   */
  watch(
    productCode,
    (newCode) => {
      if (!newCode) {
        catalogs.value = []
        publicDocuments.value = []
        practicalDocuments.value = []
        publicThumbnails.value = []
        practicalThumbnailGroups.value = []
        return
      }

      // 加载目录树
      loadCatalogs()

      // 根据当前选择状态加载对应数据
      if (activeCatalogCodes.value.length === 0) {
        loadDocuments()
      } else {
        loadThumbnails(activeCatalogCodes.value)
      }
    },
    { immediate: true }
  )

  /**
   * 监听外部目录选择变化
   */
  watch(
    () => [...externalCatalogCodes.value],  // 使用函数形式，展开数组确保检测到变化
    (newCodes, oldCodes) => {
      if (!productCode.value) return

      if (!newCodes || newCodes.length === 0) {
        // 取消选择，加载文档列表
        loadDocuments()
      } else {
        // 选择目录，加载缩略图
        loadThumbnails(newCodes)
      }
    }
  )

  return {
    // 状态
    catalogs,
    activeCatalogCodes,
    publicDocuments,
    practicalDocuments,
    publicThumbnails,
    practicalThumbnailGroups,
    loading,
    error,

    // 方法
    loadCatalogs,
    loadDocuments,
    loadThumbnails
  }
}
