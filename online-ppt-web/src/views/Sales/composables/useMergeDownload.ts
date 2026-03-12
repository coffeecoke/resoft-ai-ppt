/**
 * 响应文件章节合并下载
 */
import { SERVER_URL, authFetch } from '@/services'

export interface MergeSection {
  id: string
  headerOnly?: boolean
  title?: string
  level?: number
}

export async function mergeDownloadSections(sections: MergeSection[], name?: string) {
  const response = await authFetch(`${SERVER_URL}/sales/bid-compositions/merge-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sections, name }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(errText || `合并下载失败: ${response.status}`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (name || '合并文档') + '.docx'
  a.click()
  URL.revokeObjectURL(url)
}
