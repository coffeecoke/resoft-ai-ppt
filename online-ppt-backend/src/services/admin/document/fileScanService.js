/**
 * 文件扫描服务
 * 
 * 负责扫描源目录、处理文件、管理处理历史
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import * as prismaClient from '@prisma/client'
import { generateDocumentId } from '../../../utils/idGenerator.js'
import pptxService from '../../pptxService.js'
import { documentService } from '../../documentService.js'
import scanConfigService from '../scanConfigService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
const envPath = path.join(__dirname, '..', '..', '..', '..', '.env')
dotenv.config({ path: envPath })

// 获取 DATA_DIR
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '..', '..', 'data')

const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

class FileScanService {
  
  /**
   * 扫描目录，返回文件列表
   * 
   * @param {string} sourceDir - 源目录路径
   * @param {string} fileType - 文件类型，如 '.pptx'
   * @returns {Promise<Array>} 文件列表
   */
  async scanDirectory(sourceDir, fileType) {
    if (!fs.existsSync(sourceDir)) {
      console.warn(`[文件扫描] 目录不存在: ${sourceDir}`)
      return []
    }
    
    const files = []
    let entries
    try {
      entries = fs.readdirSync(sourceDir, { withFileTypes: true })
      console.log(`[文件扫描] 目录 ${sourceDir} 中有 ${entries.length} 个条目`)
    } catch (error) {
      console.error(`[文件扫描] 读取目录失败: ${sourceDir}`, error)
      return []
    }
    
    const expectedExt = fileType.toLowerCase()
    console.log(`[文件扫描] 查找扩展名为 ${expectedExt} 的文件`)
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const fileName = entry.name
        const fileExt = path.extname(fileName).toLowerCase()
        const matches = fileExt === expectedExt
        
        if (matches) {
          const filePath = path.join(sourceDir, fileName)
          try {
            const stats = fs.statSync(filePath)
            
            files.push({
              fileName,
              filePath,
              fileSize: stats.size,
              modifiedTime: stats.mtime,
              fileType
            })
            console.log(`[文件扫描] ✓ 找到文件: ${fileName}`)
          } catch (error) {
            console.warn(`[文件扫描] 无法获取文件信息: ${filePath}`, error)
          }
        } else {
          // 调试：显示不匹配的文件
          if (entry.name.toLowerCase().endsWith('.ppt') || entry.name.toLowerCase().endsWith('.pptx')) {
            console.log(`[文件扫描] 跳过文件 (扩展名不匹配): ${fileName} (期望: ${expectedExt}, 实际: ${fileExt})`)
          }
        }
      }
    }
    
    return files
  }
  
  /**
   * 判断文件是否需要处理
   * 
   * @param {string} filePath - 文件路径
   * @param {Date} lastScanTime - 上次扫描时间
   * @returns {Promise<boolean>} 是否需要处理
   */
  async shouldProcess(filePath, lastScanTime) {
    const stats = fs.statSync(filePath)
    const fileModifiedTime = stats.mtime
    
    // 查询数据库中的处理记录
    const record = await prisma.file_scan_history.findUnique({
      where: { file_path: filePath }
    })
    
    // 如果文件修改时间晚于上次扫描时间，需要处理
    if (!lastScanTime || fileModifiedTime > new Date(lastScanTime)) {
      return true
    }
    
    // 如果已处理且文件未更新，跳过
    if (record && record.status === 'success' && record.processed_time) {
      const processedTime = new Date(record.processed_time)
      if (processedTime >= fileModifiedTime) {
        return false
      }
    }
    
    return true
  }
  
  /**
   * 处理单个文件
   * 
   * @param {string} filePath - 文件路径
   * @param {string} fileType - 文件类型
   * @returns {Promise<Object>} 处理结果
   */
  async processFile(filePath, fileType) {
    const fileName = path.basename(filePath)
    const stats = fs.statSync(filePath)
    const scanTime = new Date()
    
    // 生成记录ID
    const recordId = generateDocumentId().replace('document_', 'scan_')
    
    try {
      // 创建或更新处理记录（状态：processing）
      await prisma.file_scan_history.upsert({
        where: { file_path: filePath },
        create: {
          id: recordId,
          file_path: filePath,
          file_name: fileName,
          file_size: BigInt(stats.size),
          file_type: fileType,
          modified_time: stats.mtime,
          status: 'processing',
          scan_time: scanTime,
          processed_time: null,
          document_id: null,
          error_message: null
        },
        update: {
          status: 'processing',
          scan_time: scanTime,
          modified_time: stats.mtime,
          file_size: BigInt(stats.size),
          error_message: null
        }
      })
      
      console.log(`[文件扫描] 开始处理: ${fileName}`)
      
      // 根据文件类型解析
      let documentData = null
      
      if (fileType === '.pptx') {
        // 解析 PPTX
        const result = await pptxService.parsePPTX(filePath, { fixedViewport: true })
        documentData = {
          title: path.basename(fileName, '.pptx'),
          width: result.viewportSize || 1000,
          height: (result.viewportSize || 1000) * 0.5625,
          theme: result.theme,
          slides: result.slides
        }
      } else {
        // 其他类型暂不支持
        throw new Error(`不支持的文件类型: ${fileType}`)
      }
      
      // 查询是否已存在 documentId
      const existingRecord = await prisma.file_scan_history.findUnique({
        where: { file_path: filePath }
      })
      
      const documentName = path.basename(fileName, fileType)
      let document
      
      if (existingRecord?.document_id) {
        // 如果 documentId 存在，执行更新操作（覆盖 JSON）
        console.log(`[文件扫描] 文档已存在，执行更新操作: ${existingRecord.document_id}`)
        document = await documentService.update(existingRecord.document_id, {
          name: documentName,
          slides: documentData.slides,  // 使用 slides 而不是 initialSlides
          theme: documentData.theme,
          width: documentData.width,
          height: documentData.height
        })
        console.log(`[文件扫描] 更新成功: ${fileName} -> ${document.id}`)
      } else {
        // 如果 documentId 不存在，执行创建操作
        document = await documentService.create({
          name: documentName,
          category: 'uncategorized',
          status: 'draft',
          tag: 'practical',  // 扫描导入的文档标记为实战版
          initialSlides: documentData.slides,
          theme: documentData.theme,
          width: documentData.width,
          height: documentData.height
        })
        console.log(`[文件扫描] 创建成功: ${fileName} -> ${document.id}`)
      }
      
      const processedTime = new Date()
      
      // 更新处理记录（状态：success）
      await prisma.file_scan_history.update({
        where: { file_path: filePath },
        data: {
          status: 'success',
          processed_time: processedTime,
          document_id: document.id,
          error_message: null
        }
      })
      
      console.log(`[文件扫描] 处理成功: ${fileName} -> ${document.id}`)
      
      return {
        success: true,
        fileName,
        filePath,
        documentId: document.id,
        documentName: document.name,
        processedTime
      }
      
    } catch (error) {
      console.error(`[文件扫描] 处理失败: ${fileName}`, error)
      
      // 更新处理记录（状态：failed）
      await prisma.file_scan_history.update({
        where: { file_path: filePath },
        data: {
          status: 'failed',
          error_message: error.message || '处理失败'
        }
      })
      
      return {
        success: false,
        fileName,
        filePath,
        error: error.message || '处理失败'
      }
    }
  }
  
  /**
   * 获取文件列表（包含处理状态）
   * 
   * @param {string} sourceDir - 源目录路径（可选，使用配置中的路径）
   * @returns {Promise<Array>} 文件列表
   */
  async getFileList(sourceDir = null) {
    const config = scanConfigService.getConfig()
    const baseDir = sourceDir || config.sourceDir
    
    console.log('[文件扫描] 获取文件列表 - 配置信息:')
    console.log('  - 源目录:', baseDir)
    console.log('  - 文件类型:', config.fileTypes)
    console.log('  - 类型映射:', config.typeDirs)
    
    if (!baseDir) {
      console.warn('[文件扫描] 源目录未配置')
      return []
    }
    
    if (!fs.existsSync(baseDir)) {
      console.warn(`[文件扫描] 源目录不存在: ${baseDir}`)
      return []
    }
    
    const sourceDirs = scanConfigService.getSourceDirs()
    console.log('[文件扫描] 需要扫描的目录:')
    for (const [fileType, dirPath] of Object.entries(sourceDirs)) {
      console.log(`  - ${fileType}: ${dirPath} (存在: ${fs.existsSync(dirPath)})`)
    }
    
    const allFiles = []
    
    // 扫描所有配置的目录
    for (const [fileType, dirPath] of Object.entries(sourceDirs)) {
      console.log(`[文件扫描] 扫描目录: ${dirPath} (类型: ${fileType})`)
      const files = await this.scanDirectory(dirPath, fileType)
      console.log(`[文件扫描] 找到 ${files.length} 个文件`)
      
      for (const file of files) {
        // 查询处理记录
        const record = await prisma.file_scan_history.findUnique({
          where: { file_path: file.filePath }
        })
        
        allFiles.push({
          fileName: file.fileName,
          filePath: file.filePath,
          fileSize: file.fileSize,
          fileType: file.fileType,
          modifiedTime: file.modifiedTime,
          status: record?.status || 'pending',
          processedTime: record?.processed_time || null,
          documentId: record?.document_id || null,
          errorMessage: record?.error_message || null
        })
      }
    }
    
    console.log(`[文件扫描] 总计找到 ${allFiles.length} 个文件`)
    
    // 按修改时间倒序排序
    allFiles.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))
    
    return allFiles
  }
  
  /**
   * 执行扫描任务
   * 
   * @param {boolean} autoProcess - 是否自动处理新文件
   * @returns {Promise<Object>} 扫描结果
   */
  async scan(autoProcess = null) {
    const config = scanConfigService.getConfig()
    const shouldProcess = autoProcess !== null ? autoProcess : config.autoProcess
    
    const validation = scanConfigService.validateConfig()
    if (!validation.valid) {
      throw new Error(`配置无效: ${validation.errors.join(', ')}`)
    }
    
    const sourceDirs = scanConfigService.getSourceDirs()
    const scanTime = new Date()
    const results = {
      total: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      files: []
    }
    
    console.log(`[文件扫描] 开始扫描任务，时间: ${scanTime.toISOString()}`)
    
    // 扫描所有目录
    for (const [fileType, dirPath] of Object.entries(sourceDirs)) {
      const files = await this.scanDirectory(dirPath, fileType)
      results.total += files.length
      
      for (const file of files) {
        const needProcess = await this.shouldProcess(file.filePath, scanTime)
        
        if (!needProcess) {
          results.skipped++
          results.files.push({
            fileName: file.fileName,
            status: 'skipped',
            reason: '已处理且未更新'
          })
          continue
        }
        
        if (shouldProcess) {
          // 自动处理
          const result = await this.processFile(file.filePath, fileType)
          if (result.success) {
            results.processed++
          } else {
            results.failed++
          }
          results.files.push(result)
        } else {
          // 仅扫描，不处理
          results.files.push({
            fileName: file.fileName,
            status: 'pending',
            filePath: file.filePath
          })
        }
      }
    }
    
    console.log(`[文件扫描] 扫描完成: 总计 ${results.total}, 处理 ${results.processed}, 跳过 ${results.skipped}, 失败 ${results.failed}`)
    
    return results
  }
  
  /**
   * 获取处理历史记录
   * 
   * @param {Object} options - 查询选项
   * @param {number} options.page - 页码
   * @param {number} options.pageSize - 每页数量
   * @param {string} options.status - 状态筛选
   * @returns {Promise<Object>} 历史记录列表
   */
  async getProcessHistory(options = {}) {
    const { page = 1, pageSize = 20, status } = options
    const skip = (page - 1) * pageSize
    
    const where = {}
    if (status) {
      where.status = status
    }
    
    const [records, total] = await Promise.all([
      prisma.file_scan_history.findMany({
        where,
        orderBy: { scan_time: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.file_scan_history.count({ where })
    ])
    
    // 转换 BigInt 字段
    const serializedRecords = records.map(record => ({
      ...record,
      file_size: Number(record.file_size),
      modified_time: record.modified_time,
      processed_time: record.processed_time,
      scan_time: record.scan_time,
      created_at: record.created_at,
      updated_at: record.updated_at
    }))
    
    return {
      list: serializedRecords,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}

export default new FileScanService()

