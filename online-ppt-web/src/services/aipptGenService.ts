import instance from './config'

const BASE = '/aippt-gen'

export const aipptGenApi = {
  // 主题列表
  getThemes: () => instance.get(`${BASE}/themes`),

  // 获取主题模板HTML
  getThemeHtml: (themeId: string, pageType: string) =>
    instance.get(`${BASE}/themes/${themeId}/html`, { params: { pageType } }),

  // 文件上传 + 解析
  uploadFiles: (files: File[]) => {
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    return instance.post(`${BASE}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // 文档分析（SSE，返回 Response）
  analyzeDocument: (text: string, topic: string, options: Record<string, string>, model = 'ark-doubao-seed-1.6-flash') =>
    fetch(`${BASE}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('resoft_auth_token')}`,
      },
      body: JSON.stringify({ text, topic, options, model }),
    }),

  // 大纲生成（SSE，返回 Response 对象）
  generateOutline: (topic: string, options?: Record<string, string>, summary?: string, model = 'ark-doubao-seed-1.6-flash') =>
    fetch(`${BASE}/outline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('resoft_auth_token')}`,
      },
      body: JSON.stringify({ topic, options, summary, model }),
    }),

  // 创建生成任务
  createTask: (data: { outline: object; themeId: string; illustrationMode?: string; model?: string; summary?: string; options?: Record<string, string> }) =>
    instance.post(`${BASE}/task/create`, data),

  // 轮询任务状态
  getTaskStatus: (taskId: string) => instance.get(`${BASE}/task/${taskId}/status`),

  // AI编辑单页
  aiEdit: (htmlContent: string, instruction: string, model?: string) =>
    instance.post(`${BASE}/ai-edit`, { htmlContent, instruction, model }),

  // 保存项目
  createProject: (data: object) => instance.post(`${BASE}/project`, data),

  // batch-update 保存（编辑后）
  batchUpdate: (projectId: string, updatedSlides: { index: number; htmlContent: string }[]) =>
    instance.post(`${BASE}/project/${projectId}/batch-update`, { updatedSlides }),

  // 获取项目
  getProject: (id: string) => instance.get(`${BASE}/project/${id}`),

  // 项目列表
  listProjects: () => instance.get(`${BASE}/projects`),

  // 图片搜索
  searchImages: (keyword: string, page = 1) =>
    instance.get(`${BASE}/images/search`, { params: { keyword, page } }),
}
