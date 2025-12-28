import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = Router()

// 目录与文件路径配置
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const COVERS_DIR = path.join(DATA_DIR, 'covers')
const INDEX_FILE = path.join(DATA_DIR, 'document-index.json')

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true })
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })
}

function readIndex() {
  try {
    ensureDirs()
    
    if (!fs.existsSync(INDEX_FILE)) {
      // 文档索引文件不存在，创建空数组
      writeIndex([])
      return []
    }

    const content = fs.readFileSync(INDEX_FILE, 'utf-8')
    if (!content.trim()) return []
    return JSON.parse(content)
  } catch (error) {
    console.error('[文档] 读取索引失败:', error)
    return []
  }
}

function writeIndex(list) {
  ensureDirs()
  fs.writeFileSync(INDEX_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

function generateDocumentId(indexList) {
  const nums = indexList
    .map(item => {
      if (!item.id || typeof item.id !== 'string') return NaN
      const m = item.id.match(/^document_(\d+)$/)
      return m ? Number(m[1]) : NaN
    })
    .filter(n => !Number.isNaN(n))

  const max = nums.length ? Math.max(...nums, 0) : 0
  return `document_${max + 1}`
}

// 从幻灯片数据中获取封面图（使用第一页的缩略图）
function getCoverFromSlides(slides) {
  if (slides && slides.length > 0) {
    const firstSlide = slides[0]
    if (firstSlide.thumbnail) {
      return firstSlide.thumbnail
    }
  }
  return '' // 如果没有缩略图，返回空字符串
}

// 计算文件大小（字节）
function getFileSize(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      return stats.size
    }
  } catch (error) {
    console.warn(`[文档] 获取文件大小失败: ${filePath}`, error)
  }
  return 0
}

// 创建文档
router.post('/create', (req, res) => {
  try {
    const { name, sourceDocumentId, category = 'uncategorized' } = req.body || {}

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: '文档名称不能为空' })
    }

    ensureDirs()

    const indexList = readIndex()
    const id = generateDocumentId(indexList)

    let documentData = null

    // 如果提供了 sourceDocumentId，从源文档复制数据
    if (sourceDocumentId) {
      const sourceFile = path.join(DOCUMENTS_DIR, `${sourceDocumentId}.json`)
      if (fs.existsSync(sourceFile)) {
        try {
          const sourceContent = fs.readFileSync(sourceFile, 'utf-8')
          documentData = JSON.parse(sourceContent)
          // 修改标题为新文档名称
          if (documentData.title) {
            documentData.title = name
          }
        } catch (error) {
          console.error(`[文档] 读取源文档失败: ${sourceDocumentId}`, error)
          return res.status(400).json({ success: false, error: '源文档不存在或格式错误' })
        }
      } else {
        return res.status(404).json({ success: false, error: '源文档不存在' })
      }
    }

    // 如果没有源文档，创建空白文档（1页空白）
    if (!documentData) {
      const defaultTheme = {
        themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
        fontColor: '#333',
        fontName: '',
        backgroundColor: '#fff',
        shadow: {
          h: 3,
          v: 3,
          blur: 2,
          color: '#808080',
        },
        outline: {
          width: 2,
          color: '#525252',
          style: 'solid',
        },
      }

      const baseSlide = {
        id: `slide_${Date.now()}`,
        elements: [],
      }

      documentData = {
        title: name,
        width: 1000,
        height: 562.5,
        theme: defaultTheme,
        slides: [baseSlide],
      }
    }

    // 写入文档文件
    const filename = path.join(DOCUMENTS_DIR, `${id}.json`)
    fs.writeFileSync(filename, JSON.stringify(documentData, null, 2), 'utf-8')

    const now = new Date().toISOString()
    const fileSize = getFileSize(filename)
    const slideCount = Array.isArray(documentData.slides) ? documentData.slides.length : 0

    // 查找源文档名称（如果存在）
    let sourceDocumentName = undefined
    if (sourceDocumentId) {
      const sourceMeta = indexList.find(item => item.id === sourceDocumentId)
      sourceDocumentName = sourceMeta?.name
    }

    // 自动从第一页缩略图获取封面
    const cover = getCoverFromSlides(documentData.slides)

    const meta = {
      id,
      name,
      cover, // 封面图URL（自动从第一页缩略图获取）
      sourceDocumentId: sourceDocumentId || undefined,
      sourceDocumentName: sourceDocumentName || undefined,
      category,
      status: 'draft',
      slideCount,
      fileSize,
      createdAt: now,
      updatedAt: now,
    }

    indexList.push(meta)
    writeIndex(indexList)

    console.log(`[文档] 新建文档: ${id} - ${name}${sourceDocumentId ? ` (基于: ${sourceDocumentId})` : ''}`)

    res.json({
      success: true,
      data: meta,
    })
  } catch (error) {
    console.error('[文档] 新建文档失败:', error)
    res.status(500).json({ success: false, error: '新建文档失败' })
  }
})

// 获取文档列表
router.get('/', (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      category,
      status,
      sourceDocumentId,
      sortBy = 'updatedAt',
      order = 'desc',
      keyword,
    } = req.query

    let list = readIndex()

    // 筛选
    let filtered = list
    if (category && typeof category === 'string') {
      filtered = filtered.filter(item => item.category === category)
    }
    if (status && typeof status === 'string') {
      filtered = filtered.filter(item => (item.status || 'draft') === status)
    }
    if (sourceDocumentId && typeof sourceDocumentId === 'string') {
      filtered = filtered.filter(item => item.sourceDocumentId === sourceDocumentId)
    }

    // 搜索（关键词匹配名称）
    if (keyword && typeof keyword === 'string') {
      const k = keyword.toLowerCase()
      filtered = filtered.filter(item => {
        const name = (item.name || '').toLowerCase()
        return name.includes(k)
      })
    }

    // 排序
    filtered.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]

      if (sortBy === 'name') {
        aVal = (aVal || '').toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }

      if (order === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    // 分页
    const p = Number(page) || 1
    const ps = Number(pageSize) || 20
    const start = (p - 1) * ps
    const end = start + ps
    const pageList = filtered.slice(start, end)

    res.json({
      success: true,
      data: {
        list: pageList,
        total: filtered.length,
        page: p,
        pageSize: ps,
      },
    })
  } catch (error) {
    console.error('[文档] 获取列表失败:', error)
    res.status(500).json({ success: false, error: '获取文档列表失败' })
  }
})

// 获取文档详情（包含完整JSON）
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    const indexList = readIndex()
    const meta = indexList.find(item => item.id === id)
    if (!meta) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    const filename = path.join(DOCUMENTS_DIR, `${id}.json`)
    if (!fs.existsSync(filename)) {
      return res.status(404).json({ success: false, error: '文档文件不存在' })
    }

    const content = fs.readFileSync(filename, 'utf-8')
    const documentData = JSON.parse(content)

    // 更新最后打开时间
    const now = new Date().toISOString()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex !== -1) {
      indexList[metaIndex] = {
        ...indexList[metaIndex],
        lastOpenedAt: now,
      }
      writeIndex(indexList)
    }

    res.json({
      success: true,
      data: {
        ...meta,
        documentData,
        lastOpenedAt: now,
      },
    })
  } catch (error) {
    console.error('[文档] 获取详情失败:', error)
    res.status(500).json({ success: false, error: '获取文档详情失败' })
  }
})

// 更新文档内容
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params
    // 兼容两种字段名：documentData 或 data
    const { documentData, data, autoSave = false } = req.body || {}

    const docData = documentData || data
    if (!docData) {
      return res.status(400).json({ success: false, error: '缺少文档数据 documentData 或 data' })
    }

    ensureDirs()

    const indexList = readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex === -1) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    // 写入文档文件
    const filename = path.join(DOCUMENTS_DIR, `${id}.json`)
    fs.writeFileSync(filename, JSON.stringify(docData, null, 2), 'utf-8')

    const now = new Date().toISOString()
    const fileSize = getFileSize(filename)
    const slideCount = Array.isArray(docData.slides) ? docData.slides.length : 0
    
    // 自动从第一页缩略图更新封面
    const cover = getCoverFromSlides(docData.slides)

    indexList[metaIndex] = {
      ...indexList[metaIndex],
      cover, // 每次更新都同步封面
      slideCount,
      fileSize,
      updatedAt: now,
    }
    writeIndex(indexList)

    console.log(`[文档] 更新文档: ${id} (autoSave=${autoSave})`)

    res.json({
      success: true,
      data: {
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error('[文档] 更新文档失败:', error)
    res.status(500).json({ success: false, error: '更新文档失败' })
  }
})

// 发布文档（draft -> published）
// 注意：文档发布不需要检查页面类型标注（与模板发布不同）
router.post('/:id/publish', (req, res) => {
  try {
    const { id } = req.params
    const indexList = readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex === -1) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    const now = new Date().toISOString()
    indexList[metaIndex] = {
      ...indexList[metaIndex],
      status: 'published',
      updatedAt: now,
    }
    writeIndex(indexList)

    console.log(`[文档] 发布文档: ${id}`)

    res.json({
      success: true,
      data: {
        id,
        status: 'published',
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error('[文档] 发布文档失败:', error)
    res.status(500).json({ success: false, error: '发布文档失败' })
  }
})

// 删除文档
// draft -> 物理删除
// published -> 软删除（改为 archived）
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    const indexList = readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex === -1) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    const meta = indexList[metaIndex]
    const status = meta.status || 'draft'

    // 草稿（draft）：物理删除
    if (status === 'draft') {
      const documentFile = path.join(DOCUMENTS_DIR, `${id}.json`)
      if (fs.existsSync(documentFile)) {
        fs.unlinkSync(documentFile)
      }

      // 从索引中移除
      indexList.splice(metaIndex, 1)
      writeIndex(indexList)

      console.log(`[文档] 物理删除文档: ${id}`)

      res.json({
        success: true,
        data: {
          id,
          deleted: true,
        },
      })
    } else {
      // 已发布（published）：软删除（改为 archived）
      const now = new Date().toISOString()
      indexList[metaIndex] = {
        ...indexList[metaIndex],
        status: 'archived',
        updatedAt: now,
      }
      writeIndex(indexList)

      console.log(`[文档] 软删除文档(归档): ${id}`)

      res.json({
        success: true,
        data: {
          id,
          status: 'archived',
          updatedAt: now,
        },
      })
    }
  } catch (error) {
    console.error('[文档] 删除文档失败:', error)
    res.status(500).json({ success: false, error: '删除文档失败' })
  }
})

// 复制文档
router.post('/:id/duplicate', (req, res) => {
  try {
    const { id } = req.params
    const indexList = readIndex()
    const sourceMeta = indexList.find(item => item.id === id)
    
    if (!sourceMeta) {
      return res.status(404).json({ success: false, error: '源文档不存在' })
    }

    // 读取源文档数据
    const sourceFile = path.join(DOCUMENTS_DIR, `${id}.json`)
    if (!fs.existsSync(sourceFile)) {
      return res.status(404).json({ success: false, error: '源文档文件不存在' })
    }

    const sourceContent = fs.readFileSync(sourceFile, 'utf-8')
    const sourceData = JSON.parse(sourceContent)

    // 生成新文档ID
    const newId = generateDocumentId(indexList)

    // 复制文档数据，修改标题
    const newDocumentData = {
      ...sourceData,
      title: `${sourceMeta.name} - 副本`,
    }

    // 写入新文档文件
    const newFilename = path.join(DOCUMENTS_DIR, `${newId}.json`)
    fs.writeFileSync(newFilename, JSON.stringify(newDocumentData, null, 2), 'utf-8')

    const now = new Date().toISOString()
    const fileSize = getFileSize(newFilename)
    const slideCount = Array.isArray(newDocumentData.slides) ? newDocumentData.slides.length : 0

    const newMeta = {
      id: newId,
      name: `${sourceMeta.name} - 副本`,
      cover: '',
      sourceDocumentId: id,
      sourceDocumentName: sourceMeta.name,
      category: sourceMeta.category,
      status: 'draft',
      slideCount,
      fileSize,
      createdAt: now,
      updatedAt: now,
    }

    indexList.push(newMeta)
    writeIndex(indexList)

    console.log(`[文档] 复制文档: ${id} -> ${newId}`)

    res.json({
      success: true,
      data: {
        id: newId,
        name: newMeta.name,
        sourceId: id,
      },
    })
  } catch (error) {
    console.error('[文档] 复制文档失败:', error)
    res.status(500).json({ success: false, error: '复制文档失败' })
  }
})

// 重命名文档
router.patch('/:id/rename', (req, res) => {
  try {
    const { id } = req.params
    const { name } = req.body || {}

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: '文档名称不能为空' })
    }

    const indexList = readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex === -1) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    // 更新文档数据中的标题
    const filename = path.join(DOCUMENTS_DIR, `${id}.json`)
    if (fs.existsSync(filename)) {
      try {
        const content = fs.readFileSync(filename, 'utf-8')
        const documentData = JSON.parse(content)
        documentData.title = name
        fs.writeFileSync(filename, JSON.stringify(documentData, null, 2), 'utf-8')
      } catch (error) {
        console.warn(`[文档] 更新文档文件标题失败: ${id}`, error)
      }
    }

    // 更新索引中的名称
    const now = new Date().toISOString()
    indexList[metaIndex] = {
      ...indexList[metaIndex],
      name,
      updatedAt: now,
    }
    writeIndex(indexList)

    console.log(`[文档] 重命名文档: ${id} -> ${name}`)

    res.json({
      success: true,
      data: {
        id,
        name,
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error('[文档] 重命名文档失败:', error)
    res.status(500).json({ success: false, error: '重命名文档失败' })
  }
})

export default router