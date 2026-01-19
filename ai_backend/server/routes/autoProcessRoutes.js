/**
 * 自动跑批处理路由（PPT + 音频）
 */

const express = require('express')
const autoProcessService = require('../services/autoProcessService')
const audioAutoProcessService = require('../services/audioAutoProcessService')
const qaAutoProcessService = require('../services/qaAutoProcessService')
const logger = require('../utils/logger')

const router = express.Router()

// ==================== PPT跑批路由 ====================

/**
 * GET /api/auto-process/status
 * 获取自动跑批当前状态
 */
router.get('/status', async (req, res) => {
  try {
    const status = autoProcessService.getStatus()
    
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    logger.error('获取状态失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取状态失败'
    })
  }
})

/**
 * POST /api/auto-process/start
 * 启动自动跑批
 */
router.post('/start', async (req, res) => {
  try {
    const status = await autoProcessService.start()
    
    res.json({
      success: true,
      message: '自动跑批已启动',
      data: status
    })
  } catch (error) {
    logger.error('启动自动跑批失败:', error.message)
    res.status(400).json({
      success: false,
      error: error.message || '启动失败'
    })
  }
})

/**
 * POST /api/auto-process/stop
 * 停止自动跑批
 */
router.post('/stop', async (req, res) => {
  try {
    const status = autoProcessService.stop()
    
    res.json({
      success: true,
      message: '自动跑批已停止',
      data: status
    })
  } catch (error) {
    logger.error('停止自动跑批失败:', error.message)
    res.status(400).json({
      success: false,
      error: error.message || '停止失败'
    })
  }
})

/**
 * GET /api/auto-process/config
 * 获取配置
 */
router.get('/config', async (req, res) => {
  try {
    const config = autoProcessService.getConfig()
    
    res.json({
      success: true,
      data: config
    })
  } catch (error) {
    logger.error('获取配置失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取配置失败'
    })
  }
})

/**
 * PUT /api/auto-process/config
 * 更新配置
 */
router.put('/config', async (req, res) => {
  try {
    const { pollingInterval, enableAutoExtract, enableAutoAnalysis, maxConcurrent } = req.body
    
    const newConfig = {}
    
    if (pollingInterval !== undefined) {
      // 轮询间隔（毫秒），最小1分钟，最大24小时
      const interval = parseInt(pollingInterval)
      if (interval < 60 * 1000 || interval > 24 * 60 * 60 * 1000) {
        return res.status(400).json({
          success: false,
          error: '轮询间隔必须在1分钟到24小时之间'
        })
      }
      newConfig.pollingInterval = interval
    }
    
    if (enableAutoExtract !== undefined) {
      newConfig.enableAutoExtract = Boolean(enableAutoExtract)
    }
    
    if (enableAutoAnalysis !== undefined) {
      newConfig.enableAutoAnalysis = Boolean(enableAutoAnalysis)
    }
    
    if (maxConcurrent !== undefined) {
      const concurrent = parseInt(maxConcurrent)
      if (concurrent < 1 || concurrent > 10) {
        return res.status(400).json({
          success: false,
          error: '最大并发数必须在1到10之间'
        })
      }
      newConfig.maxConcurrent = concurrent
    }
    
    const updatedConfig = autoProcessService.updateConfig(newConfig)
    
    res.json({
      success: true,
      message: '配置已更新',
      data: updatedConfig
    })
  } catch (error) {
    logger.error('更新配置失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '更新配置失败'
    })
  }
})

/**
 * GET /api/auto-process/statistics
 * 获取统计信息
 */
router.get('/statistics', async (req, res) => {
  try {
    const statistics = await autoProcessService.getStatistics()
    
    res.json({
      success: true,
      data: statistics
    })
  } catch (error) {
    logger.error('获取统计信息失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取统计信息失败'
    })
  }
})

/**
 * GET /api/auto-process/logs
 * 获取处理日志
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const logs = autoProcessService.getLogs(parseInt(limit))
    
    res.json({
      success: true,
      total: logs.length,
      data: logs
    })
  } catch (error) {
    logger.error('获取日志失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取日志失败'
    })
  }
})

/**
 * DELETE /api/auto-process/logs
 * 清空日志
 */
router.delete('/logs', async (req, res) => {
  try {
    autoProcessService.clearLogs()
    
    res.json({
      success: true,
      message: '日志已清空'
    })
  } catch (error) {
    logger.error('清空日志失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '清空日志失败'
    })
  }
})

/**
 * POST /api/auto-process/run-once
 * 立即执行一次（手动触发）
 */
router.post('/run-once', async (req, res) => {
  try {
    // 异步执行，不阻塞响应
    autoProcessService.runOnce().catch(err => {
      logger.error('手动执行失败:', err.message)
    })
    
    res.json({
      success: true,
      message: '已触发执行，请查看日志了解进度'
    })
  } catch (error) {
    logger.error('触发执行失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '触发执行失败'
    })
  }
})

// ==================== 音频跑批路由 ====================

/**
 * GET /api/auto-process/audio/status
 * 获取音频自动跑批当前状态
 */
router.get('/audio/status', async (req, res) => {
  try {
    const status = audioAutoProcessService.getStatus()
    
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    logger.error('获取音频跑批状态失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取状态失败'
    })
  }
})

/**
 * POST /api/auto-process/audio/start
 * 启动音频自动跑批
 */
router.post('/audio/start', async (req, res) => {
  try {
    const status = await audioAutoProcessService.start()
    
    res.json({
      success: true,
      message: '音频自动跑批已启动',
      data: status
    })
  } catch (error) {
    logger.error('启动音频跑批失败:', error.message)
    res.status(400).json({
      success: false,
      error: error.message || '启动失败'
    })
  }
})

/**
 * POST /api/auto-process/audio/stop
 * 停止音频自动跑批
 */
router.post('/audio/stop', async (req, res) => {
  try {
    const status = await audioAutoProcessService.stop()
    
    res.json({
      success: true,
      message: '音频自动跑批已停止',
      data: status
    })
  } catch (error) {
    logger.error('停止音频跑批失败:', error.message)
    res.status(400).json({
      success: false,
      error: error.message || '停止失败'
    })
  }
})

/**
 * GET /api/auto-process/audio/config
 * 获取音频跑批配置
 */
router.get('/audio/config', async (req, res) => {
  try {
    const config = audioAutoProcessService.getConfig()
    
    res.json({
      success: true,
      data: config
    })
  } catch (error) {
    logger.error('获取音频跑批配置失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取配置失败'
    })
  }
})

/**
 * PUT /api/auto-process/audio/config
 * 更新音频跑批配置
 */
router.put('/audio/config', async (req, res) => {
  try {
    const { scanDirectory, pollingInterval, maxConcurrent, enableAiCorrection } = req.body
    
    const newConfig = {}
    
    if (scanDirectory !== undefined) {
      newConfig.scanDirectory = scanDirectory
    }
    
    if (pollingInterval !== undefined) {
      const interval = parseInt(pollingInterval)
      if (interval < 60 * 1000 || interval > 24 * 60 * 60 * 1000) {
        return res.status(400).json({
          success: false,
          error: '轮询间隔必须在1分钟到24小时之间'
        })
      }
      newConfig.pollingInterval = interval
    }
    
    if (maxConcurrent !== undefined) {
      const concurrent = parseInt(maxConcurrent)
      if (concurrent < 1 || concurrent > 5) {
        return res.status(400).json({
          success: false,
          error: '最大并发数必须在1到5之间'
        })
      }
      newConfig.maxConcurrent = concurrent
    }
    
    if (enableAiCorrection !== undefined) {
      newConfig.enableAiCorrection = Boolean(enableAiCorrection)
    }
    
    const updatedConfig = await audioAutoProcessService.updateConfig(newConfig)
    
    res.json({
      success: true,
      message: '音频跑批配置已更新',
      data: updatedConfig
    })
  } catch (error) {
    logger.error('更新音频跑批配置失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '更新配置失败'
    })
  }
})

/**
 * GET /api/auto-process/audio/statistics
 * 获取音频跑批统计信息
 */
router.get('/audio/statistics', async (req, res) => {
  try {
    const statistics = await audioAutoProcessService.getStatistics()
    
    res.json({
      success: true,
      data: statistics
    })
  } catch (error) {
    logger.error('获取音频跑批统计失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取统计信息失败'
    })
  }
})

/**
 * GET /api/auto-process/audio/logs
 * 获取音频跑批日志
 */
router.get('/audio/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const logs = audioAutoProcessService.getLogs(parseInt(limit))
    
    res.json({
      success: true,
      total: logs.length,
      data: logs
    })
  } catch (error) {
    logger.error('获取音频跑批日志失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取日志失败'
    })
  }
})

/**
 * DELETE /api/auto-process/audio/logs
 * 清空音频跑批日志
 */
router.delete('/audio/logs', async (req, res) => {
  try {
    audioAutoProcessService.clearLogs()
    
    res.json({
      success: true,
      message: '音频跑批日志已清空'
    })
  } catch (error) {
    logger.error('清空音频跑批日志失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '清空日志失败'
    })
  }
})

/**
 * POST /api/auto-process/audio/run-once
 * 立即执行一次音频跑批（手动触发）
 */
router.post('/audio/run-once', async (req, res) => {
  try {
    // 异步执行，不阻塞响应
    audioAutoProcessService.runOnce().catch(err => {
      logger.error('手动执行音频跑批失败:', err.message)
    })
    
    res.json({
      success: true,
      message: '已触发音频跑批执行，请查看日志了解进度'
    })
  } catch (error) {
    logger.error('触发音频跑批执行失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '触发执行失败'
    })
  }
})

// ==================== 问答对提取跑批路由 ====================

/**
 * GET /api/auto-process/qa/status
 * 获取问答对提取跑批状态
 */
router.get('/qa/status', async (req, res) => {
  try {
    const status = qaAutoProcessService.getStatus()
    
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    logger.error('获取问答对提取跑批状态失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取状态失败'
    })
  }
})

/**
 * POST /api/auto-process/qa/start
 * 启动问答对提取跑批
 */
router.post('/qa/start', async (req, res) => {
  try {
    const result = await qaAutoProcessService.start()
    res.json(result)
  } catch (error) {
    logger.error('启动问答对提取跑批失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '启动失败'
    })
  }
})

/**
 * POST /api/auto-process/qa/stop
 * 停止问答对提取跑批
 */
router.post('/qa/stop', async (req, res) => {
  try {
    const result = await qaAutoProcessService.stop()
    res.json(result)
  } catch (error) {
    logger.error('停止问答对提取跑批失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '停止失败'
    })
  }
})

/**
 * GET /api/auto-process/qa/config
 * 获取问答对提取跑批配置
 */
router.get('/qa/config', async (req, res) => {
  try {
    const config = qaAutoProcessService.getConfig()
    
    res.json({
      success: true,
      data: config
    })
  } catch (error) {
    logger.error('获取问答对提取跑批配置失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取配置失败'
    })
  }
})

/**
 * PUT /api/auto-process/qa/config
 * 更新问答对提取跑批配置
 */
router.put('/qa/config', async (req, res) => {
  try {
    const { pollingInterval, maxConcurrent } = req.body
    
    const newConfig = {}
    
    if (pollingInterval !== undefined) {
      const interval = parseInt(pollingInterval)
      if (interval < 60 * 1000 || interval > 24 * 60 * 60 * 1000) {
        return res.status(400).json({
          success: false,
          error: '轮询间隔必须在1分钟到24小时之间'
        })
      }
      newConfig.pollingInterval = interval
    }
    
    if (maxConcurrent !== undefined) {
      const concurrent = parseInt(maxConcurrent)
      if (concurrent < 1 || concurrent > 5) {
        return res.status(400).json({
          success: false,
          error: '最大并发数必须在1到5之间'
        })
      }
      newConfig.maxConcurrent = concurrent
    }
    
    const updatedConfig = await qaAutoProcessService.updateConfig(newConfig)
    
    res.json({
      success: true,
      message: '问答对提取跑批配置已更新',
      data: updatedConfig
    })
  } catch (error) {
    logger.error('更新问答对提取跑批配置失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '更新配置失败'
    })
  }
})

/**
 * GET /api/auto-process/qa/statistics
 * 获取问答对提取跑批统计信息
 */
router.get('/qa/statistics', async (req, res) => {
  try {
    const statistics = await qaAutoProcessService.getStatistics()
    
    res.json({
      success: true,
      data: statistics
    })
  } catch (error) {
    logger.error('获取问答对提取跑批统计失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取统计信息失败'
    })
  }
})

/**
 * GET /api/auto-process/qa/logs
 * 获取问答对提取跑批日志
 */
router.get('/qa/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const logs = qaAutoProcessService.getLogs(parseInt(limit))
    
    res.json({
      success: true,
      total: logs.length,
      data: logs
    })
  } catch (error) {
    logger.error('获取问答对提取跑批日志失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '获取日志失败'
    })
  }
})

/**
 * DELETE /api/auto-process/qa/logs
 * 清空问答对提取跑批日志
 */
router.delete('/qa/logs', async (req, res) => {
  try {
    qaAutoProcessService.clearLogs()
    
    res.json({
      success: true,
      message: '问答对提取跑批日志已清空'
    })
  } catch (error) {
    logger.error('清空问答对提取跑批日志失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '清空日志失败'
    })
  }
})

/**
 * POST /api/auto-process/qa/run-once
 * 立即执行一次问答对提取跑批（手动触发）
 */
router.post('/qa/run-once', async (req, res) => {
  try {
    // 异步执行，不阻塞响应
    qaAutoProcessService.runOnce().catch(err => {
      logger.error('手动执行问答对提取跑批失败:', err.message)
    })
    
    res.json({
      success: true,
      message: '已触发问答对提取跑批执行，请查看日志了解进度'
    })
  } catch (error) {
    logger.error('触发问答对提取跑批执行失败:', error.message)
    res.status(500).json({
      success: false,
      error: error.message || '触发执行失败'
    })
  }
})

module.exports = router

