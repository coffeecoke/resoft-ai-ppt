import axios from './config'

// export const SERVER_URL = 'http://localhost:5000'
export const SERVER_URL = (import.meta.env.MODE === 'development') ? '/api' : 'https://server.pptist.cn'

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

// Word解析响应
interface ParseWordResponse {
  success: boolean
  data: WordContent
  error?: string
}

export default {
  getMockData(filename: string): Promise<any> {
    return axios.get(`./mocks/${filename}.json`)
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
    
    return fetch(`${SERVER_URL}/tools/aippt_outline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    return fetch(`${SERVER_URL}/tools/aippt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    return fetch(`${SERVER_URL}/tools/ai_writing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        command,
        model: 'ark-doubao-seed-1.6-flash',
        stream: true,
      }),
    })
  },
}
