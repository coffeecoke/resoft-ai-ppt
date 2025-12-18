/**
 * 模板草稿本地缓存工具
 * 
 * 使用 IndexedDB (Dexie) 存储模板编辑过程中的草稿数据
 * 防止意外关闭导致数据丢失
 */

import Dexie, { type EntityTable } from 'dexie'
import type { Slide } from '@/types/slides'

/**
 * 模板草稿数据结构
 */
export interface TemplateDraft {
  id: string              // 模板ID（如 template_9）
  slides: Slide[]         // 幻灯片数据
  timestamp: number       // 保存时间戳
  version?: number        // 版本号（可选，用于冲突检测）
}

/**
 * 模板草稿数据库
 */
class TemplateDraftDatabase extends Dexie {
  drafts!: EntityTable<TemplateDraft, 'id'>

  constructor() {
    super('TemplateDraftDB')
    
    this.version(1).stores({
      drafts: 'id, timestamp'  // id 为主键，timestamp 为索引
    })
  }
}

// 创建数据库实例
const templateDraftDB = new TemplateDraftDatabase()

/**
 * 保存模板草稿
 * 
 * @param templateId 模板ID
 * @param slides 幻灯片数据
 * @returns Promise<void>
 */
export async function saveTemplateDraft(
  templateId: string,
  slides: Slide[]
): Promise<void> {
  try {
    const draft: TemplateDraft = {
      id: templateId,
      slides: JSON.parse(JSON.stringify(slides)), // 深拷贝
      timestamp: Date.now(),
    }
    
    await templateDraftDB.drafts.put(draft)
    console.log(`✅ [草稿] 已保存到本地: ${templateId}`, new Date().toLocaleTimeString())
  } catch (error) {
    console.error(`❌ [草稿] 保存失败: ${templateId}`, error)
    throw error
  }
}

/**
 * 加载模板草稿
 * 
 * @param templateId 模板ID
 * @returns Promise<Slide[] | null> 返回草稿数据，不存在则返回 null
 */
export async function loadTemplateDraft(
  templateId: string
): Promise<Slide[] | null> {
  try {
    const draft = await templateDraftDB.drafts.get(templateId)
    
    if (!draft) {
      console.log(`ℹ️ [草稿] 未找到草稿: ${templateId}`)
      return null
    }
    
    console.log(`✅ [草稿] 已加载: ${templateId}`, new Date(draft.timestamp).toLocaleString())
    return draft.slides
  } catch (error) {
    console.error(`❌ [草稿] 加载失败: ${templateId}`, error)
    return null
  }
}

/**
 * 获取草稿信息（不加载数据）
 * 
 * @param templateId 模板ID
 * @returns Promise<{ timestamp: number } | null>
 */
export async function getTemplateDraftInfo(
  templateId: string
): Promise<{ timestamp: number } | null> {
  try {
    const draft = await templateDraftDB.drafts.get(templateId)
    
    if (!draft) {
      return null
    }
    
    return {
      timestamp: draft.timestamp,
    }
  } catch (error) {
    console.error(`❌ [草稿] 获取信息失败: ${templateId}`, error)
    return null
  }
}

/**
 * 检查草稿是否存在
 * 
 * @param templateId 模板ID
 * @returns Promise<boolean>
 */
export async function hasTemplateDraft(
  templateId: string
): Promise<boolean> {
  try {
    const count = await templateDraftDB.drafts.where('id').equals(templateId).count()
    return count > 0
  } catch (error) {
    console.error(`❌ [草稿] 检查失败: ${templateId}`, error)
    return false
  }
}

/**
 * 清除模板草稿
 * 
 * @param templateId 模板ID
 * @returns Promise<void>
 */
export async function clearTemplateDraft(
  templateId: string
): Promise<void> {
  try {
    await templateDraftDB.drafts.delete(templateId)
    console.log(`✅ [草稿] 已清除: ${templateId}`)
  } catch (error) {
    console.error(`❌ [草稿] 清除失败: ${templateId}`, error)
    throw error
  }
}

/**
 * 清除所有草稿（清理功能）
 * 
 * @returns Promise<number> 返回清除的数量
 */
export async function clearAllDrafts(): Promise<number> {
  try {
    const count = await templateDraftDB.drafts.count()
    await templateDraftDB.drafts.clear()
    console.log(`✅ [草稿] 已清除所有草稿，共 ${count} 条`)
    return count
  } catch (error) {
    console.error(`❌ [草稿] 清除所有失败`, error)
    throw error
  }
}

/**
 * 获取所有草稿列表（用于管理）
 * 
 * @returns Promise<TemplateDraft[]>
 */
export async function getAllDrafts(): Promise<TemplateDraft[]> {
  try {
    return await templateDraftDB.drafts.toArray()
  } catch (error) {
    console.error(`❌ [草稿] 获取列表失败`, error)
    return []
  }
}

/**
 * 清除过期草稿（超过指定天数）
 * 
 * @param days 保留天数，默认7天
 * @returns Promise<number> 返回清除的数量
 */
export async function clearExpiredDrafts(days: number = 7): Promise<number> {
  try {
    const expireTime = Date.now() - (days * 24 * 60 * 60 * 1000)
    
    const expiredDrafts = await templateDraftDB.drafts
      .where('timestamp')
      .below(expireTime)
      .toArray()
    
    const ids = expiredDrafts.map(d => d.id)
    await templateDraftDB.drafts.bulkDelete(ids)
    
    console.log(`✅ [草稿] 已清除过期草稿 ${ids.length} 条（超过 ${days} 天）`)
    return ids.length
  } catch (error) {
    console.error(`❌ [草稿] 清除过期草稿失败`, error)
    return 0
  }
}

/**
 * Vue Composition API Hook
 * 方便在组件中使用
 */
export function useTemplateDraft(templateId: string) {
  const saveDraft = (slides: Slide[]) => saveTemplateDraft(templateId, slides)
  const loadDraft = () => loadTemplateDraft(templateId)
  const clearDraft = () => clearTemplateDraft(templateId)
  const hasDraft = () => hasTemplateDraft(templateId)
  const getDraftInfo = () => getTemplateDraftInfo(templateId)
  
  return {
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    getDraftInfo,
  }
}

export default {
  saveTemplateDraft,
  loadTemplateDraft,
  getTemplateDraftInfo,
  hasTemplateDraft,
  clearTemplateDraft,
  clearAllDrafts,
  getAllDrafts,
  clearExpiredDrafts,
  useTemplateDraft,
}



