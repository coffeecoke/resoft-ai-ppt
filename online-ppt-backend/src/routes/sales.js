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

export default router






