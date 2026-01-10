/**
 * 字典 Composable
 * 
 * 提供响应式的字典数据获取和管理功能
 * 支持多个字典类型同时加载
 */

import { ref, computed, onMounted } from 'vue'
import { getDict, getDictLabel, getDictOptions, loadDict, loadDicts, type DictDataItem } from '@/utils/dict'

/**
 * 使用字典
 * 
 * @param dictTypes 字典类型代码数组或单个字典类型代码
 * @param options 配置选项
 * @param options.autoLoad 是否自动加载（默认：true）
 * @param options.dictNames 字典类型名称映射（可选）
 * @returns 字典数据和加载状态
 * 
 * @example
 * // 单个字典
 * const { dictData, loading, getLabel } = useDict('user_status')
 * 
 * @example
 * // 多个字典
 * const { dictData, loading, getLabel } = useDict(['user_status', 'order_status'])
 * 
 * @example
 * // 自定义字典名称
 * const { dictData, loading } = useDict(['user_status', 'order_status'], {
 *   dictNames: {
 *     user_status: '用户状态',
 *     order_status: '订单状态'
 *   }
 * })
 */
export function useDict(
  dictTypes: string | string[],
  options: {
    autoLoad?: boolean
    dictNames?: Record<string, string>
  } = {}
) {
  const { autoLoad = true, dictNames = {} } = options

  // 统一处理为数组
  const dictTypeArray = Array.isArray(dictTypes) ? dictTypes : [dictTypes]

  // 加载状态
  const loading = ref(false)

  // 字典数据（响应式）
  const dictData = ref<Record<string, DictDataItem[]>>({})

  // 加载字典数据
  const load = async () => {
    if (dictTypeArray.length === 0) {
      return
    }

    loading.value = true
    try {
      // 检查哪些字典需要加载
      const needLoad: string[] = []
      for (const dictType of dictTypeArray) {
        const data = getDict(dictType)
        if (data.length === 0) {
          needLoad.push(dictType)
        } else {
          // 已存在，直接使用
          dictData.value[dictType] = data
        }
      }

      // 批量加载缺失的字典
      if (needLoad.length > 0) {
        const loaded = await loadDicts(needLoad)
        dictData.value = {
          ...dictData.value,
          ...loaded
        }
      }
    } catch (error) {
      console.error('[useDict] 加载字典失败', error)
    } finally {
      loading.value = false
    }
  }

  // 获取指定字典的数据
  const getDictData = (dictType: string): DictDataItem[] => {
    return dictData.value[dictType] || getDict(dictType)
  }

  // 获取指定字典的选项（用于下拉框）
  const getDictOptionsForType = (dictType: string) => {
    return getDictOptions(dictType)
  }

  // 获取字典标签（根据字典值）
  const getLabel = (dictType: string, dictValue: string | number | (string | number)[]): string => {
    return getDictLabel(dictType, dictValue)
  }

  // 单个字典类型时，提供便捷访问
  const singleDictType = dictTypeArray.length === 1 ? dictTypeArray[0] : null

  // 单个字典时的便捷属性
  const data = computed(() => {
    if (singleDictType) {
      return getDictData(singleDictType)
    }
    return null
  })

  const options = computed(() => {
    if (singleDictType) {
      return getDictOptionsForType(singleDictType)
    }
    return null
  })

  // 自动加载
  if (autoLoad) {
    onMounted(() => {
      load()
    })
  }

  return {
    // 状态
    loading,
    
    // 字典数据（多个字典时使用）
    dictData,
    
    // 单个字典时的便捷属性
    data,
    options,
    
    // 方法
    load,
    getDictData,
    getDictOptionsForType,
    getLabel
  }
}

/**
 * 使用单个字典（便捷方法）
 * 
 * @param dictType 字典类型代码
 * @param options 配置选项
 */
export function useSingleDict(
  dictType: string,
  options: {
    autoLoad?: boolean
    dictName?: string
  } = {}
) {
  const { dictName } = options
  const result = useDict(dictType, {
    ...options,
    dictNames: dictName ? { [dictType]: dictName } : undefined
  })

  return {
    loading: result.loading,
    data: result.data,
    options: result.options,
    load: result.load,
    getLabel: (dictValue: string | number | (string | number)[]) => result.getLabel(dictType, dictValue)
  }
}

