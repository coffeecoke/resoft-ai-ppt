/**
 * 模板服务
 * 
 * 封装模板数据获取逻辑，方便未来从前端迁移到后端
 * 
 * 当前：从前端 public/mocks/ 获取
 * 未来：从后端 API 获取
 */

import type { Slide, PPTElement, TextType } from '@/types/slides'
import { useSlidesStore } from '@/store'
import api, { SERVER_URL } from './index'
import axios from './config'

// 模板信息接口（与后端 template-index.json 对齐的子集）
export interface TemplateInfo {
  id: string
  name: string
  cover: string
  origin?: string
  category?: string
  status?: 'draft' | 'published' | 'archived'
}

// 筛选选项
export interface FilterOptions {
  type?: string      // 页面类型 (content, cover, etc.)
  minItems?: number  // 最小items数量
}

/**
 * 获取模板列表
 * 
 * 优先：从后端 GET /api/templates 获取
 * 回退：从 slidesStore 获取（硬编码内置模板）
 */
export async function getTemplateList(): Promise<TemplateInfo[]> {
  try {
    // 优先从后端获取模板列表
    const resp = await fetch(`${SERVER_URL}/templates`)
    if (resp.ok) {
      const json = await resp.json()
      const list = (json.data?.list || []) as any[]

      // 过滤掉无效的项（undefined、null 或缺少 id 的项）
      return list
        .filter(item => item && item.id) // 确保 item 存在且有 id
        .map(item => {
          let cover = ''
          if (item.cover && typeof item.cover === 'string') {
            const c = item.cover as string
            // 已经是完整 URL，直接使用
            if (c.startsWith('http://') || c.startsWith('https://')) {
              cover = c
            }
            // 后端返回的相对路径（封面图或缩略图），需要拼上 SERVER_URL
            else if (c.startsWith('/covers/') || c.startsWith('/snapshots/')) {
              cover = `${SERVER_URL}${c}`
            } else if (c.startsWith('/')) {
              // 其他以 / 开头的相对路径
              cover = `${SERVER_URL}${c}`
            } else {
              cover = c
            }
          } else {
            // 没有 cover 字段时，根据 id 生成默认封面 URL
            cover = getTemplateCoverUrl(item.id)
          }

          return {
            id: item.id,
            name: item.name || '未命名模板',
            cover,
            origin: item.origin,
            category: item.category,
            status: item.status,
          } as TemplateInfo
        })
    }
  } catch (e) {
    console.warn('[模板服务] 从后端获取模板列表失败，回退到本地模板:', e)
  }

  // 回退：使用硬编码在 slidesStore 中的内置模板（template_1 ~ template_8）
  const slidesStore = useSlidesStore()
  return slidesStore.templates
}

/**
 * 获取模板的所有slides
 * 
 * 当前：从前端 public/mocks/ 获取
 * 未来：从后端 GET /api/templates/:id/slides 获取
 * 
 * @param templateId 模板ID（如 template_1）
 */
export async function getTemplateSlides(templateId: string): Promise<Slide[]> {
  try {
    // 优先：从后端模板接口获取（新建/管理后的模板）
    try {
      const resp = await fetch(`${SERVER_URL}/templates/${templateId}`)
      if (resp.ok) {
        const json = await resp.json()
        const data = json.data || {}
        if (data.templateData?.slides) {
          return data.templateData.slides as Slide[]
        }
      }
    } catch (e) {
      // 忽略模板接口错误，回退到 mock
      console.warn('[模板服务] 从 /templates 加载失败，回退到 mock:', e)
    }

    // 兼容旧数据：从 mock 接口获取（内置模板 template_1~8）
    const mock = await api.getMockData(templateId)
    return (mock?.slides || []) as Slide[]
  } catch (error) {
    console.error(`[模板服务] 获取模板失败: ${templateId}`, error)
    return []
  }
}

/**
 * 新建模板（后端 POST /templates/create）
 */
export async function createTemplate(params: {
  name: string
  category?: string
  initialLayout?: 'blank' | 'basic'
}): Promise<any> {
  const body = {
    name: params.name,
    category: params.category || 'uncategorized',
    initialLayout: params.initialLayout || 'blank',
  }
  // 使用 axios 实例发送请求（config.ts 已做响应拦截，这里拿到的就是后端 JSON）
  return axios.post(`${SERVER_URL}/templates/create`, body)
}

/**
 * 删除模板（后端 DELETE /templates/:id）
 */
export async function deleteTemplate(templateId: string): Promise<any> {
  return axios.delete(`${SERVER_URL}/templates/${templateId}`)
}

/**
 * 检查元素的文本类型
 */
function checkTextType(el: PPTElement, type: TextType): boolean {
  if (el.type === 'text' && el.textType === type) return true
  if (el.type === 'shape' && el.text && el.text.type === type) return true
  return false
}

/**
 * 获取页面的item数量
 * 
 * 统计 itemTitle 或 item 类型的元素数量
 */
export function getSlideItemCount(slide: Slide): number {
  if (!slide.elements) return 0
  
  const itemTitleCount = slide.elements.filter(el => checkTextType(el, 'itemTitle')).length
  const itemCount = slide.elements.filter(el => checkTextType(el, 'item')).length
  
  // 返回较大的那个
  return Math.max(itemTitleCount, itemCount)
}

/**
 * 获取筛选后的模板slides
 * 
 * @param templateId 模板ID
 * @param options 筛选选项
 */
export async function getFilteredTemplateSlides(
  templateId: string,
  options: FilterOptions = {}
): Promise<Slide[]> {
  const slides = await getTemplateSlides(templateId)
  
  if (!options.type && !options.minItems) {
    return slides
  }
  
  return slides.filter(slide => {
    // 类型筛选
    if (options.type && slide.type !== options.type) {
      return false
    }
    
    // items数量筛选
    if (options.minItems && options.minItems > 0) {
      const itemCount = getSlideItemCount(slide)
      if (itemCount < options.minItems) {
        return false
      }
    }
    
    return true
  })
}

/**
 * 获取模板封面图URL
 * 
 * 当前：从后端 /covers/ 获取（由 Node 静态托管 data/covers 下的图片）
 */
export function getTemplateCoverUrl(templateId: string): string {
  // 前端统一通过 SERVER_URL 访问后端静态封面
  // Nginx 将 /api 代理到 Node，因此前端看到的是 /api/covers/xxx
  return `${SERVER_URL}/covers/${templateId}.webp`
}

export default {
  getTemplateList,
  getTemplateSlides,
  getFilteredTemplateSlides,
  getSlideItemCount,
  getTemplateCoverUrl,
  createTemplate,
  deleteTemplate,
}

