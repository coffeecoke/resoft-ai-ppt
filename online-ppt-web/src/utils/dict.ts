/**
 * 字典工具库
 * 
 * 参考若依系统的字典实现，提供字典注册、获取、标签转换等功能
 */

import { getDictByType, getDictsByTypes, type DictData } from '@/services/admin/dictService'

// ==================== 类型定义 ====================

export interface DictDataItem {
  dictCode: string
  dictLabel: string
  dictValue: string
  dictSort?: number
  cssClass?: string
  listClass?: string
  isDefault?: string
  [key: string]: any
}

export interface DictType {
  dictType: string
  dictName: string
  dictData: DictDataItem[]
}

// ==================== 字典存储 ====================

/**
 * 字典存储 Map
 * key: dictType (字典类型代码)
 * value: DictType (字典类型信息)
 */
const dictStore = new Map<string, DictType>()

// ==================== 字典注册和获取 ====================

/**
 * 注册字典数据
 * 
 * @param dictType 字典类型代码
 * @param dictData 字典数据数组
 * @param dictName 字典类型名称（可选）
 */
export function registerDict(dictType: string, dictData: DictDataItem[], dictName?: string): void {
  dictStore.set(dictType, {
    dictType,
    dictName: dictName || dictType,
    dictData: dictData || []
  })
}

/**
 * 获取字典数据
 * 
 * @param dictType 字典类型代码
 * @returns 字典数据数组
 */
export function getDict(dictType: string): DictDataItem[] {
  const dictTypeInfo = dictStore.get(dictType)
  return dictTypeInfo?.dictData || []
}

/**
 * 获取字典标签（根据字典值获取显示标签）
 * 
 * @param dictType 字典类型代码
 * @param dictValue 字典值
 * @param separator 多个匹配值时的分隔符（默认：,）
 * @returns 字典标签
 */
export function getDictLabel(dictType: string, dictValue: string | number | (string | number)[], separator = ','): string {
  const dictData = getDict(dictType)
  
  if (Array.isArray(dictValue)) {
    // 数组：返回多个标签，用分隔符连接
    return dictValue
      .map(val => {
        const item = dictData.find(d => d.dictValue === String(val))
        return item ? item.dictLabel : String(val)
      })
      .join(separator)
  }
  
  // 单个值
  const item = dictData.find(d => d.dictValue === String(dictValue))
  return item ? item.dictLabel : String(dictValue)
}

/**
 * 获取字典选项（用于下拉框等）
 * 
 * @param dictType 字典类型代码
 * @returns 选项数组 { label, value }
 */
export function getDictOptions(dictType: string): Array<{ label: string; value: string }> {
  const dictData = getDict(dictType)
  return dictData.map(item => ({
    label: item.dictLabel,
    value: item.dictValue
  }))
}

/**
 * 获取字典选项（包含所有字段）
 * 
 * @param dictType 字典类型代码
 * @returns 字典数据数组
 */
export function getDictOptionsFull(dictType: string): DictDataItem[] {
  return getDict(dictType)
}

/**
 * 检查字典是否存在
 * 
 * @param dictType 字典类型代码
 * @returns 是否存在
 */
export function hasDict(dictType: string): boolean {
  return dictStore.has(dictType)
}

/**
 * 清除字典缓存
 * 
 * @param dictType 字典类型代码（可选，不传则清除所有）
 */
export function clearDict(dictType?: string): void {
  if (dictType) {
    dictStore.delete(dictType)
  } else {
    dictStore.clear()
  }
}

// ==================== 从后端加载字典 ====================

/**
 * 从后端加载字典数据并注册
 * 
 * @param dictType 字典类型代码
 * @param dictName 字典类型名称（可选）
 * @returns Promise<DictDataItem[]>
 */
export async function loadDict(dictType: string, dictName?: string): Promise<DictDataItem[]> {
  try {
    const data = await getDictByType(dictType)
    
    // 转换后端数据格式为前端格式
    const dictData: DictDataItem[] = data.map(item => ({
      dictCode: item.id,
      dictLabel: item.dict_label,
      dictValue: item.dict_value,
      dictSort: item.dict_sort,
      cssClass: item.css_class,
      listClass: item.list_class,
      isDefault: item.is_default,
      status: item.status,
      remark: item.remark
    }))
    
    // 注册字典
    registerDict(dictType, dictData, dictName)
    
    return dictData
  } catch (error) {
    console.error(`[字典工具库] 加载字典失败: ${dictType}`, error)
    return []
  }
}

/**
 * 批量从后端加载字典数据并注册
 * 
 * @param dictTypes 字典类型代码数组
 * @returns Promise<Record<string, DictDataItem[]>>
 */
export async function loadDicts(dictTypes: string[]): Promise<Record<string, DictDataItem[]>> {
  try {
    if (!Array.isArray(dictTypes) || dictTypes.length === 0) {
      return {}
    }
    
    const data = await getDictsByTypes(dictTypes)
    
    const result: Record<string, DictDataItem[]> = {}
    
    // 转换并注册每个字典
    for (const [dictType, items] of Object.entries(data)) {
      const dictData: DictDataItem[] = items.map(item => ({
        dictCode: item.id,
        dictLabel: item.dict_label,
        dictValue: item.dict_value,
        dictSort: item.dict_sort,
        cssClass: item.css_class,
        listClass: item.list_class,
        isDefault: item.is_default,
        status: item.status,
        remark: item.remark
      }))
      
      registerDict(dictType, dictData)
      result[dictType] = dictData
    }
    
    return result
  } catch (error) {
    console.error('[字典工具库] 批量加载字典失败', error)
    return {}
  }
}

// ==================== 导出 ====================

export default {
  registerDict,
  getDict,
  getDictLabel,
  getDictOptions,
  getDictOptionsFull,
  hasDict,
  clearDict,
  loadDict,
  loadDicts
}

