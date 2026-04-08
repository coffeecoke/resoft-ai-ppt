import { ref, computed } from 'vue'
import salesApi from '@/services/salesApi'

interface CustomerType {
  id: string
  code: string
  name: string
  p_id: string | null
}

interface SalesFilterOptions {
  customer_types: CustomerType[]
}

// 模块级缓存，所有组件共用，只请求一次
const _options = ref<SalesFilterOptions | null>(null)
let _promise: Promise<void> | null = null

export function useSalesOptions() {
  function load(): Promise<void> {
    if (_options.value) return Promise.resolve()
    if (_promise) return _promise
    _promise = (salesApi.get('/api/sales/filter-options') as any).then((res: any) => {
      _options.value = res.data
    })
    return _promise
  }

  // { code, name } 格式，用于标签筛选（code 是稳定的业务标识）
  const industryTags = computed(() =>
    (_options.value?.customer_types ?? []).map(t => ({ code: t.code, name: t.name }))
  )

  // { label, value } 格式，value = code（稳定标识，存数据库）
  const industryOptions = computed(() =>
    (_options.value?.customer_types ?? []).map(t => ({ label: t.name, value: t.code }))
  )

  return { load, industryTags, industryOptions }
}
