/**
 * 文件扫描定时任务调度
 * 
 * 根据配置定时执行文件扫描任务
 */

import cron from 'node-cron'
import fileScanService from './fileScanService.js'
import scanConfigService from './scanConfigService.js'

class ScanScheduler {
  constructor() {
    this.task = null
    this.isRunning = false
  }
  
  /**
   * 启动定时任务
   */
  start() {
    const config = scanConfigService.getConfig()
    
    // 检查是否启用
    if (!config.enabled) {
      console.log('[扫描调度] 定时扫描未启用')
      return
    }
    
    // 验证配置
    const validation = scanConfigService.validateConfig()
    if (!validation.valid) {
      console.error('[扫描调度] 配置无效，无法启动定时任务:', validation.errors)
      return
    }
    
    // 停止现有任务
    this.stop()
    
    // 计算 cron 表达式（根据间隔时间）
    const cronExpression = this.intervalToCron(config.interval)
    
    console.log(`[扫描调度] 启动定时扫描任务，间隔: ${(config.interval / 3600000).toFixed(1)} 小时`)
    console.log(`[扫描调度] Cron 表达式: ${cronExpression}`)
    
    // 创建定时任务
    this.task = cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.log('[扫描调度] 上次扫描任务仍在运行，跳过本次执行')
        return
      }
      
      this.isRunning = true
      console.log(`[扫描调度] 开始执行定时扫描任务: ${new Date().toISOString()}`)
      
      try {
        await fileScanService.scan(config.autoProcess)
      } catch (error) {
        console.error('[扫描调度] 定时扫描任务执行失败:', error)
      } finally {
        this.isRunning = false
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    })
  }
  
  /**
   * 停止定时任务
   */
  stop() {
    if (this.task) {
      this.task.stop()
      this.task = null
      console.log('[扫描调度] 定时扫描任务已停止')
    }
  }
  
  /**
   * 将间隔时间（毫秒）转换为 cron 表达式
   * 
   * @param {number} intervalMs - 间隔时间（毫秒）
   * @returns {string} cron 表达式
   */
  intervalToCron(intervalMs) {
    const seconds = Math.floor(intervalMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    // 如果小于1小时，按分钟执行
    if (hours < 1) {
      return `*/${minutes} * * * *` // 每 N 分钟执行
    }
    
    // 如果小于24小时，按小时执行
    if (hours < 24) {
      return `0 */${hours} * * *` // 每 N 小时执行
    }
    
    // 如果大于等于24小时，按天执行
    const days = Math.floor(hours / 24)
    return `0 0 */${days} * *` // 每 N 天执行
  }
  
  /**
   * 立即执行一次扫描（用于测试）
   */
  async runOnce() {
    if (this.isRunning) {
      throw new Error('扫描任务正在运行中')
    }
    
    this.isRunning = true
    try {
      const config = scanConfigService.getConfig()
      return await fileScanService.scan(config.autoProcess)
    } finally {
      this.isRunning = false
    }
  }
  
  /**
   * 获取任务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.task !== null,
      config: scanConfigService.getConfig()
    }
  }
}

export default new ScanScheduler()





