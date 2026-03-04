import axios from './config'

// 获取认证请求头（用于 fetch 调用）
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('resoft_auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 带鉴权的 fetch 封装，自动附加 Authorization header
// 用法与原生 fetch 完全一致，直接替换 fetch() 即可
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  })
}

// export const SERVER_URL = 'http://localhost:5000'
// 支持环境变量配置，Docker部署时可通过环境变量设置
// 如果未设置环境变量，默认使用 /api（适用于Docker部署和开发环境）
// Nginx会自动将 /api 代理到后端服务
export const SERVER_URL = import.meta.env.VITE_API_BASE_URL || '/api'

interface ImageSearchPayload {
  query: string;
  orientation?: 'landscape' | 'portrait' | 'square' | 'all';
  locale?: 'zh' | 'en';
  order?: 'popular' | 'latest';
  size?: 'large' | 'medium' | 'small';
  image_type?: 'all' | 'photo' | 'illustration' | 'vector';
  page?: number;
  per_page?: number;
}

// Word文档解析结果
export interface WordContent {
  title: string
  text: string
  markdown: string
  wordCount: number
}

interface AIPPTOutlinePayload {
  content: string
  language: string
  model: string
  source?: 'topic' | 'word'    // 来源：topic(默认) | word
  wordContent?: WordContent    // Word文档内容
}

interface AIPPTPayload {
  content: string
  language: string
  style: string
  model: string
}

interface AIWritingPayload {
  content: string
  command: string
}

// ============ 方案D：模板填充相关类型 ============

// 槽位信息
export interface SlotInfo {
  id: string
  pageIndex: number
  pageType: string
  elementType: string
  textType: string
  currentText: string
  position: {
    left: number
    top: number
    width: number
    height: number
  }
}

// 页面结构
export interface PageStructure {
  pageIndex: number
  pageType: string
  slotCount: number
  slots: {
    id: string
    textType: string
    currentText: string
  }[]
}

// 槽位提取结果
export interface ExtractSlotsResult {
  totalPages: number
  totalSlots: number
  structure: PageStructure[]
  slots: SlotInfo[]
}

// 内容映射
export interface ContentMap {
  [slotId: string]: string
}

// Word解析响应
interface ParseWordResponse {
  success: boolean
  data: WordContent
  error?: string
}

export default {
  getMockData(filename: string): Promise<any> {
    // 之前：直接从前端 public/mocks 读取
    // 现在：统一从后端 /tools/mock/:name 获取，方便后端托管数据
    // axios 拦截器已将 response.data 返回，这里再取一层 .data（后端包了一层）
    return axios.get(`${SERVER_URL}/tools/mock/${filename}`).then(res => res.data)
  },

  searchImage(body: ImageSearchPayload): Promise<any> {
    return axios.post(`${SERVER_URL}/tools/img_search`, body)
  },

  /**
   * 解析Word文档
   * 
   * @param file Word文件 (.docx)
   * @returns 解析结果
   */
  parseWord(file: File): Promise<ParseWordResponse> {
    const formData = new FormData()
    formData.append('file', file)
    
    return axios.post(`${SERVER_URL}/tools/parse_word`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  /**
   * 生成PPT大纲
   * 
   * 支持两种模式：
   * 1. 主题模式：只传content，AI根据主题自由发挥
   * 2. Word模式：传content + wordContent，AI参考文档内容生成
   */
  AIPPT_Outline({
    content,
    language,
    model,
    source,
    wordContent,
  }: AIPPTOutlinePayload): Promise<any> {
    // 构建请求体
    const body: Record<string, any> = {
      content,
      language,
      model,
      stream: true,
    }
    
    // 如果有Word内容，添加到请求体
    if (source === 'word' && wordContent) {
      body.source = 'word'
      body.wordContent = {
        title: wordContent.title,
        text: wordContent.text,
        markdown: wordContent.markdown,
        wordCount: wordContent.wordCount,
      }
    }
    
    console.log('📤 AIPPT_Outline 请求参数:', body)
    
    return authFetch(`${SERVER_URL}/tools/aippt_outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(response => {
      console.log('📥 AIPPT_Outline 响应对象:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        body: response.body,
        bodyUsed: response.bodyUsed,
      })
      return response
    })
  },

  AIPPT({
    content,
    language,
    style,
    model,
  }: AIPPTPayload): Promise<any> {
    return authFetch(`${SERVER_URL}/tools/aippt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        language,
        model,
        style,
        stream: true,
      }),
    })
  },

  AI_Writing({
    content,
    command,
  }: AIWritingPayload): Promise<any> {
    return authFetch(`${SERVER_URL}/tools/ai_writing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        command,
        model: 'ark-doubao-seed-1.6-flash',
        stream: true,
      }),
    })
  },

  // ============ 方案D：模板填充相关接口 ============

  /**
   * 提取模板槽位
   * 
   * @param slides PPT模板的slides数组
   * @returns 槽位提取结果
   */
  extractSlots(slides: any[]): Promise<{ success: boolean; data: ExtractSlotsResult; error?: string }> {
    return axios.post(`${SERVER_URL}/tools/extract_slots`, { slides })
  },

  /**
   * 生成模板填充内容
   * 
   * @param slots 槽位信息（extractSlots返回的数据）
   * @param topic PPT主题
   * @param wordContent 参考文档内容（可选）
   * @param model AI模型
   * @returns 内容映射
   */
  generateFillContent({
    slots,
    topic,
    wordContent,
    model = 'GLM-4.5-Flash',
  }: {
    slots: ExtractSlotsResult
    topic: string
    wordContent?: string
    model?: string
  }): Promise<{ success: boolean; data: ContentMap; error?: string }> {
    // 分批处理可能需要较长时间，设置10分钟超时
    return axios.post(`${SERVER_URL}/tools/generate_fill_content`, {
      slots,
      topic,
      wordContent,
      model,
    }, {
      timeout: 600000  // 10分钟超时
    })
  },

  /**
   * 填充模板
   * 
   * @param slides 原始模板slides
   * @param contentMap 内容映射
   * @returns 填充后的slides
   */
  fillTemplate({
    slides,
    contentMap,
  }: {
    slides: any[]
    contentMap: ContentMap
  }): Promise<{ success: boolean; data: { slides: any[] }; error?: string }> {
    return axios.post(`${SERVER_URL}/tools/fill_template`, {
      slides,
      contentMap,
    })
  },

  // ============ 对话式PPT编辑相关接口 ============

  /**
   * PPT智能对话
   * 
   * @param message 用户输入
   * @param context PPT上下文
   * @param history 对话历史
   * @param model AI模型
   * @param scope 润色范围（范围选择模式）
   * @param requirement 润色要求
   * @param polishContext 润色上下文（文本编辑模式）
   * @returns 对话结果（可能是流式）
   */
  aipptChat({
    message,
    context,
    history = [],
    model = 'deepseek-chat',
    scope,
    requirement,
    polishContext,
  }: {
    message: string
    context?: {
      currentSlide?: any
      slideIndex?: number
      totalSlides?: number
      topic?: string
      slides?: any[]
    }
    history?: Array<{ role: string; content: string }>
    model?: string
    scope?: string
    requirement?: string
    polishContext?: {
      elementId: string
      hasSelection: boolean
      selectedText: string
      from: number
      to: number
      fullContent: string
    }
  }): Promise<Response> {
    return authFetch(`${SERVER_URL}/aippt/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context,
        history,
        model,
        scope,
        requirement,
        polishContext,
      }),
    })
  },

  /**
   * 按模版页生成内容
   *
   * @param elements 模版页文字元素列表 [{textType, text}]
   * @param topic 用户输入的主题
   * @param model AI模型
   */
  aipptTemplatePageGenerate({
    elements,
    topic,
    model = 'GLM-4.5-Flash',
  }: {
    elements: Array<{ textType: string; text: string }>
    topic: string
    model?: string
  }): Promise<Response> {
    return authFetch(`${SERVER_URL}/aippt/template-page-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements, topic, model }),
    })
  },

  /**
   * 图片推荐
   *
   * @param slideData 当前页面数据
   * @param keyword 搜索关键词（可选）
   * @param orientation 图片方向
   * @param count 数量
   * @param page 页码
   */
  recommendImages({
    slideData,
    keyword,
    orientation = 'landscape',
    count = 4,
    page = 1,
  }: {
    slideData?: any
    keyword?: string
    orientation?: 'landscape' | 'portrait' | 'squarish'
    count?: number
    page?: number
  }): Promise<{
    success: boolean
    data?: {
      keyword: string
      images: Array<{
        id: string
        src: string
        thumb: string
        width: number
        height: number
        alt: string
        source: string
        author: string
      }>
      hasMore: boolean
      page: number
    }
    error?: string
  }> {
    return axios.post(`${SERVER_URL}/images/recommend`, {
      slideData,
      keyword,
      orientation,
      count,
      page,
    })
  },

  /**
   * 搜索图片
   */
  searchImages({
    keyword,
    orientation = 'landscape',
    count = 4,
    page = 1,
  }: {
    keyword: string
    orientation?: 'landscape' | 'portrait' | 'squarish'
    count?: number
    page?: number
  }): Promise<any> {
    return axios.post(`${SERVER_URL}/images/search`, {
      keyword,
      orientation,
      count,
      page,
    })
  },

  /**
   * 换一批图片
   */
  nextImages({
    keyword,
    orientation = 'landscape',
    count = 4,
    currentPage = 1,
  }: {
    keyword: string
    orientation?: 'landscape' | 'portrait' | 'squarish'
    count?: number
    currentPage?: number
  }): Promise<any> {
    return axios.post(`${SERVER_URL}/images/next`, {
      keyword,
      orientation,
      count,
      currentPage,
    })
  },

  /**
   * 获取图片服务状态
   */
  getImageServiceStatus(): Promise<{ success: boolean; data: { unsplash: boolean; pexels: boolean; available: boolean } }> {
    return axios.get(`${SERVER_URL}/images/status`)
  },
}
