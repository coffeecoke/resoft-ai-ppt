/**
 * 文件扫描路由
 * 
 * API 路径前缀：/api/admin/file-scan
 */

import { Router } from 'express'
import path from 'path'
import fileScanService from '../../services/admin/fileScanService.js'
import scanConfigService from '../../services/admin/scanConfigService.js'

const router = Router()

/**
 * GET /api/admin/file-scan/config
 * 获取扫描配置
 */
router.get('/config', (req, res) => {
  try {
    const config = scanConfigService.getConfigInfo()
    res.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('[文件扫描] 获取配置失败:', error)
    console.error('[文件扫描] 错误堆栈:', error.stack)
    res.status(500).json({
      success: false,
      error: error.message || '获取配置失败',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * GET /api/admin/file-scan/files
 * 获取源目录文件列表
 * 
 * Query参数：
 * - sourceDir: 源目录路径（可选，使用配置中的路径）
 */
router.get('/files', async (req, res) => {
  try {
    const { sourceDir } = req.query
    const files = await fileScanService.getFileList(sourceDir || null)
    
    res.json({
      success: true,
      data: {
        files,
        total: files.length,
        stats: {
          total: files.length,
          pending: files.filter(f => f.status === 'pending').length,
          processing: files.filter(f => f.status === 'processing').length,
          success: files.filter(f => f.status === 'success').length,
          failed: files.filter(f => f.status === 'failed').length
        }
      }
    })
  } catch (error) {
    console.error('[文件扫描] 获取文件列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取文件列表失败'
    })
  }
})

/**
 * POST /api/admin/file-scan/process
 * 立即处理指定文件
 * 
 * Body: { filePath: "D:\\...\\file.pptx" }
 */
router.post('/process', async (req, res) => {
  try {
    const { filePath } = req.body
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath 参数不能为空'
      })
    }
    
    // 获取文件类型
    const ext = path.extname(filePath).toLowerCase()
    if (!ext) {
      return res.status(400).json({
        success: false,
        error: '无法识别文件类型'
      })
    }
    
    const result = await fileScanService.processFile(filePath, ext)
    
    if (result.success) {
      res.json({
        success: true,
        data: result
      })
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        data: result
      })
    }
  } catch (error) {
    console.error('[文件扫描] 处理文件失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '处理文件失败'
    })
  }
})

/**
 * POST /api/admin/file-scan/scan
 * 手动触发扫描
 * 
 * Body: { autoProcess: true }（可选，默认使用配置值）
 */
router.post('/scan', async (req, res) => {
  try {
    const { autoProcess } = req.body
    
    const results = await fileScanService.scan(autoProcess)
    
    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    console.error('[文件扫描] 扫描失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '扫描失败'
    })
  }
})

/**
 * GET /api/admin/file-scan/history
 * 获取处理历史记录
 * 
 * Query参数：
 * - page: 页码（默认：1）
 * - pageSize: 每页数量（默认：20）
 * - status: 状态筛选（pending, processing, success, failed）
 */
router.get('/history', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query
    
    const history = await fileScanService.getProcessHistory({
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      status
    })
    
    res.json({
      success: true,
      data: history
    })
  } catch (error) {
    console.error('[文件扫描] 获取历史记录失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取历史记录失败'
    })
  }
})

export default router

