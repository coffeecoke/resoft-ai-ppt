import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 数据文件路径
const dataDir = path.join(__dirname, '..', '..', 'data', 'sales')

// 确保数据目录存在
async function ensureDataDir() {
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
    // 初始化示例数据
    await initSampleData()
  }
}

// 初始化示例数据
async function initSampleData() {
  const sampleProducts = [
    {
      id: '1',
      title: '企业级AI PPT解决方案',
      description: '基于大模型的智能PPT生成系统，支持自然语言对话式编辑',
      category: 'AI工具',
      tags: ['AI', 'PPT', '办公'],
      createTime: new Date().toISOString()
    },
    {
      id: '2',
      title: '智能文档处理平台',
      description: '支持多格式文档转换、智能摘要、知识提取',
      category: '文档处理',
      tags: ['文档', 'AI', '效率'],
      createTime: new Date().toISOString()
    }
  ]

  const sampleQA = [
    {
      id: '1',
      question: '如何快速生成产品介绍PPT？',
      answer: '使用AI PPT功能，输入产品关键信息，系统会自动生成专业的产品介绍PPT',
      category: '产品使用',
      tags: ['PPT', '产品介绍'],
      createTime: new Date().toISOString()
    },
    {
      id: '2',
      question: '支持哪些文件格式导入？',
      answer: '目前支持Word、PDF、Markdown等格式导入，可自动转换为PPT',
      category: '功能特性',
      tags: ['导入', '格式'],
      createTime: new Date().toISOString()
    }
  ]

  const sampleMaterials = [
    {
      id: '1',
      title: '产品宣传册',
      type: 'pdf',
      url: '/materials/brochure.pdf',
      description: '公司产品完整介绍',
      createTime: new Date().toISOString()
    }
  ]

  await fs.writeFile(
    path.join(dataDir, 'products.json'),
    JSON.stringify(sampleProducts, null, 2)
  )
  await fs.writeFile(
    path.join(dataDir, 'qa.json'),
    JSON.stringify(sampleQA, null, 2)
  )
  await fs.writeFile(
    path.join(dataDir, 'materials.json'),
    JSON.stringify(sampleMaterials, null, 2)
  )
}

// 读取 JSON 文件
async function readJSONFile(filename) {
  await ensureDataDir()
  try {
    const data = await fs.readFile(path.join(dataDir, filename), 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading ${filename}:`, error)
    return []
  }
}

// 写入 JSON 文件
async function writeJSONFile(filename, data) {
  await ensureDataDir()
  await fs.writeFile(
    path.join(dataDir, filename),
    JSON.stringify(data, null, 2)
  )
}

// ========== 产品接口 ==========

// 获取产品列表
router.get('/products', async (req, res) => {
  try {
    const products = await readJSONFile('products.json')
    const { category, tag, q } = req.query
    
    let filtered = products
    
    if (category) {
      filtered = filtered.filter(p => p.category === category)
    }
    if (tag) {
      filtered = filtered.filter(p => p.tags.includes(tag))
    }
    if (q) {
      const keyword = q.toLowerCase()
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(keyword) ||
        p.description.toLowerCase().includes(keyword)
      )
    }
    
    res.json({ success: true, data: filtered })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取产品详情
router.get('/products/:id', async (req, res) => {
  try {
    const products = await readJSONFile('products.json')
    const product = products.find(p => p.id === req.params.id)
    
    if (!product) {
      return res.status(404).json({ success: false, error: '产品不存在' })
    }
    
    res.json({ success: true, data: product })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 搜索产品
router.get('/products/search', async (req, res) => {
  try {
    const products = await readJSONFile('products.json')
    const { q } = req.query
    
    if (!q) {
      return res.json({ success: true, data: [] })
    }
    
    const keyword = q.toLowerCase()
    const results = products.filter(p => 
      p.title.toLowerCase().includes(keyword) ||
      p.description.toLowerCase().includes(keyword) ||
      p.tags.some(tag => tag.toLowerCase().includes(keyword))
    )
    
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========== 问答接口 ==========

// 获取问答列表
router.get('/qa', async (req, res) => {
  try {
    const qaList = await readJSONFile('qa.json')
    const { category, tag, q } = req.query
    
    let filtered = qaList
    
    if (category) {
      filtered = filtered.filter(item => item.category === category)
    }
    if (tag) {
      filtered = filtered.filter(item => item.tags.includes(tag))
    }
    if (q) {
      const keyword = q.toLowerCase()
      filtered = filtered.filter(item => 
        item.question.toLowerCase().includes(keyword) ||
        item.answer.toLowerCase().includes(keyword)
      )
    }
    
    res.json({ success: true, data: filtered })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取问答详情
router.get('/qa/:id', async (req, res) => {
  try {
    const qaList = await readJSONFile('qa.json')
    const qa = qaList.find(item => item.id === req.params.id)
    
    if (!qa) {
      return res.status(404).json({ success: false, error: '问答不存在' })
    }
    
    res.json({ success: true, data: qa })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 搜索问答
router.get('/qa/search', async (req, res) => {
  try {
    const qaList = await readJSONFile('qa.json')
    const { q } = req.query
    
    if (!q) {
      return res.json({ success: true, data: [] })
    }
    
    const keyword = q.toLowerCase()
    const results = qaList.filter(item => 
      item.question.toLowerCase().includes(keyword) ||
      item.answer.toLowerCase().includes(keyword)
    )
    
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========== 推荐内容接口 ==========

router.get('/recommendations', async (req, res) => {
  try {
    const { type } = req.query
    const products = await readJSONFile('products.json')
    const qaList = await readJSONFile('qa.json')
    
    let recommendations = []
    
    if (type === 'ppt' || !type) {
      recommendations.push(...products.slice(0, 3).map(p => ({ ...p, type: 'product' })))
    }
    if (type === 'qa' || !type) {
      recommendations.push(...qaList.slice(0, 3).map(q => ({ ...q, type: 'qa' })))
    }
    
    res.json({ success: true, data: recommendations })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========== 宣传物料接口 ==========

router.get('/materials', async (req, res) => {
  try {
    const materials = await readJSONFile('materials.json')
    const { type } = req.query
    
    let filtered = materials
    if (type) {
      filtered = filtered.filter(m => m.type === type)
    }
    
    res.json({ success: true, data: filtered })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========== 音频/视频接口 ==========

router.get('/media', async (req, res) => {
  try {
    // 这里可以从数据文件读取，暂时返回空数组
    res.json({ success: true, data: [] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========== 用户接口 ==========

router.get('/user/profile', async (req, res) => {
  try {
    // 模拟用户信息
    const profile = {
      id: '1',
      username: '售前专员',
      email: 'sales@example.com',
      role: '售前顾问',
      avatar: 'https://dummyimage.com/100x100/6aa1ff/ffffff&text=U'
    }
    res.json({ success: true, data: profile })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/user/profile', async (req, res) => {
  try {
    // 这里应该更新用户信息到数据库
    res.json({ success: true, message: '更新成功' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========== PPT回传接口 ==========

// 文档相关路径（复用documents的路径）
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const INDEX_FILE = path.join(DATA_DIR, 'document-index.json')

// 读取文档索引
function readDocumentIndex() {
  try {
    if (!fs.existsSync(INDEX_FILE)) {
      return { documents: [] }
    }
    const content = fs.readFileSync(INDEX_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Sales] 读取文档索引失败:', error)
    return { documents: [] }
  }
}

// 写入文档索引
function writeDocumentIndex(index) {
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8')
  } catch (error) {
    console.error('[Sales] 写入文档索引失败:', error)
    throw error
  }
}

// 生成文档ID
function generateDocumentId(indexList) {
  const nums = indexList
    .map(item => {
      if (!item.id || typeof item.id !== 'string') return NaN
      const match = item.id.match(/^document_(\d+)$/)
      return match ? parseInt(match[1], 10) : NaN
    })
    .filter(n => !isNaN(n))
  
  const maxNum = nums.length > 0 ? Math.max(...nums) : 0
  return `document_${maxNum + 1}`
}

/**
 * 回传PPT
 * POST /api/sales/ppt/upload
 */
router.post('/ppt/upload', async (req, res) => {
  try {
    const {
      name,
      customerName,
      product,
      industry,
      audience,
      language,
      slides
    } = req.body || {}
    
    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'PPT标题不能为空'
      })
    }
    
    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'PPT内容不能为空'
      })
    }
    
    // 确保目录存在
    const fsSync = (await import('fs')).default
    if (!fsSync.existsSync(DOCUMENTS_DIR)) {
      fsSync.mkdirSync(DOCUMENTS_DIR, { recursive: true })
    }
    
    // 读取现有索引
    const index = readDocumentIndex()
    const indexList = index.documents || []
    
    // 生成新ID
    const id = generateDocumentId(indexList)
    const now = new Date().toISOString()
    
    // 创建文档数据
    const documentData = {
      title: name.trim(),
      width: 1000,
      height: 562.5,
      theme: {
        themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
        fontColor: '#333',
        fontName: '',
        backgroundColor: '#fff',
        shadow: { h: 3, v: 3, blur: 2, color: '#808080' },
        outline: { width: 2, color: '#525252', style: 'solid' },
      },
      slides
    }
    
    // 保存文档JSON
    const filename = path.join(DOCUMENTS_DIR, `${id}.json`)
    fsSync.writeFileSync(filename, JSON.stringify(documentData, null, 2), 'utf-8')
    
    // 计算文件大小
    const stats = fsSync.statSync(filename)
    const fileSize = stats.size
    
    // 创建元数据
    const meta = {
      id,
      name: name.trim(),
      cover: '',  // 封面图需要后续生成
      category: 'uncategorized',
      status: 'draft',  // 默认为草稿
      tag: 'practical',  // 自动标记为实战
      slideCount: slides.length,
      fileSize,
      createdAt: now,
      updatedAt: now,
      customerName: customerName || undefined,
      product: (Array.isArray(product) && product.length > 0) ? product : undefined,
      industry: (Array.isArray(industry) && industry.length > 0) ? industry : undefined,
      audience: (Array.isArray(audience) && audience.length > 0) ? audience : undefined,
      language: language || undefined,
      // userId: req.user?.id,  // TODO: 未来从session获取
    }
    
    // 添加到索引（插入到最前面）
    indexList.unshift(meta)
    index.documents = indexList
    writeDocumentIndex(index)
    
    console.log(`[Sales] PPT回传成功: ${id} - ${name}`)
    
    res.json({
      success: true,
      data: { id }
    })
  } catch (error) {
    console.error('[Sales] PPT回传失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'PPT回传失败'
    })
  }
})

/**
 * 获取PPT列表（Profile页面使用）
 * GET /api/sales/ppt/list
 */
router.get('/ppt/list', async (req, res) => {
  try {
    const { tag, status = 'published' } = req.query
    
    const index = readDocumentIndex()
    const indexList = index.documents || []
    let filtered = indexList
    
    // 只显示已发布的
    filtered = filtered.filter(item => item.status === status)
    
    // 按标签过滤
    if (tag && tag !== 'all') {
      filtered = filtered.filter(item => item.tag === tag)
    }
    
    // TODO: 未来按用户过滤
    // if (req.user?.id) {
    //   filtered = filtered.filter(item => item.userId === req.user.id)
    // }
    
    res.json({
      success: true,
      data: filtered
    })
  } catch (error) {
    console.error('[Sales] 获取PPT列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取PPT列表失败'
    })
  }
})

export default router


