/**
 * 产品选项 Composable
 * 从真实API获取产品列表，用于下拉选择框
 */
import { ref, onMounted } from 'vue'
import { getProductList } from '@/services/salesService'

export interface ProductOption {
  label: string
  value: string
}

/**
 * 获取产品选项（用于下拉选择框）
 */
export function useProductOptions() {
  const productOptions = ref<ProductOption[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * 加载产品列表
   */
  const loadProducts = async () => {
    loading.value = true
    error.value = null
    
    try {
      const res = await getProductList({ isActive: true })
      
      if (res.success && res.data) {
        // 转换为 { label, value } 格式供 el-select 使用
        productOptions.value = res.data.map(product => ({
          label: product.name,
          value: product.name // 使用 name 作为 value（保持与原 Mock 数据一致）
        }))
      }
    } catch (err: any) {
      console.error('加载产品选项失败:', err)
      error.value = err.message || '加载产品选项失败'
      
      // 失败时使用默认产品列表（降级方案）
      productOptions.value = [
        { label: '一表通', value: '一表通' },
        { label: '1104', value: '1104' },
        { label: '受益所有人', value: '受益所有人' },
        { label: '反洗钱', value: '反洗钱' },
        { label: '金数', value: '金数' },
      ]
    } finally {
      loading.value = false
    }
  }

  // 组件挂载时自动加载
  onMounted(() => {
    loadProducts()
  })

  return {
    productOptions,
    loading,
    error,
    loadProducts
  }
}

