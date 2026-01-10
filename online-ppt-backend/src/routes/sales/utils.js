import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import fsSync from 'fs'
import dotenv from 'dotenv'
import { generateDocumentId as generateDocumentIdUtil } from '../../utils/idGenerator.js'

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '..', '..', '..', '.env')
dotenv.config({ path: envPath })

// ========== Sales 数据目录相关 ==========

// 优先使用环境变量 DATA_DIR，如果没有则使用默认相对路径
const BASE_DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '..', 'data')
// Sales 业务数据目录
export const dataDir = path.join(BASE_DATA_DIR, 'sales')

// 确保数据目录存在
export async function ensureDataDir() {
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
    // 初始化示例数据
    await initSampleData()
  }
}

// 初始化示例数据
export async function initSampleData() {
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

// ========== JSON 文件操作 ==========

// 读取 JSON 文件
export async function readJSONFile(filename) {
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
export async function writeJSONFile(filename, data) {
  await ensureDataDir()
  await fs.writeFile(
    path.join(dataDir, filename),
    JSON.stringify(data, null, 2)
  )
}

// ========== 文档索引操作 ==========

// 文档相关路径（复用documents的路径）
// 优先使用环境变量 DATA_DIR，如果没有则使用默认相对路径
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '..', 'data')
export const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
export const INDEX_FILE = path.join(DATA_DIR, 'document-index.json')

// 读取文档索引
export function readDocumentIndex() {
  try {
    if (!fsSync.existsSync(INDEX_FILE)) {
      return []
    }
    const content = fsSync.readFileSync(INDEX_FILE, 'utf-8')
    if (!content.trim()) return []
    return JSON.parse(content)
  } catch (error) {
    console.error('[Sales] 读取文档索引失败:', error)
    return []
  }
}

// 写入文档索引
export function writeDocumentIndex(indexList) {
  try {
    fsSync.writeFileSync(INDEX_FILE, JSON.stringify(indexList, null, 2), 'utf-8')
  } catch (error) {
    console.error('[Sales] 写入文档索引失败:', error)
    throw error
  }
}

// 生成文档ID：使用统一的ID生成器（时间戳 + 随机字符串）
// 保留 indexList 参数以兼容旧代码，但实际不再使用
export function generateDocumentId(indexList) {
  return generateDocumentIdUtil()
}






