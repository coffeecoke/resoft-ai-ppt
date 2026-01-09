/**
 * 文件扫描配置服务
 * 
 * 从 .env 环境变量读取配置，并提供验证功能
 */

import fs from 'fs'
import path from 'path'

class ScanConfigService {
  
  /**
   * 获取扫描配置
   * 
   * @returns {Object} 配置对象
   */
  getConfig() {
    const sourceDir = process.env.FILE_SCAN_SOURCE_DIR
    const enabled = process.env.FILE_SCAN_ENABLED !== 'false' // 默认 true
    const interval = parseInt(process.env.FILE_SCAN_INTERVAL || '3600000', 10) // 默认 1 小时
    const autoProcess = process.env.FILE_SCAN_AUTO_PROCESS !== 'false' // 默认 true
    
    // 解析文件类型（确保格式正确，以点开头）
    const fileTypesRaw = process.env.FILE_SCAN_FILE_TYPES || '.pptx'
    const fileTypes = fileTypesRaw
      .split(',')
      .map(type => {
        const trimmed = type.trim()
        // 确保以点开头，如果不是则添加
        return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
      })
      .filter(type => type && type !== '.')
    
    // 解析文件类型到子目录的映射
    const typeDirs = this.parseTypeDirs(process.env.FILE_SCAN_TYPE_DIRS)
    
    console.log('[扫描配置] 环境变量:')
    console.log('  FILE_SCAN_SOURCE_DIR:', sourceDir)
    console.log('  FILE_SCAN_FILE_TYPES:', process.env.FILE_SCAN_FILE_TYPES)
    console.log('  FILE_SCAN_TYPE_DIRS:', process.env.FILE_SCAN_TYPE_DIRS)
    console.log('[扫描配置] 解析结果:')
    console.log('  fileTypes:', fileTypes)
    console.log('  typeDirs:', typeDirs)
    
    return {
      sourceDir,
      enabled,
      interval,
      autoProcess,
      fileTypes,
      typeDirs
    }
  }
  
  /**
   * 解析文件类型到子目录的映射
   * 
   * @param {string} typeDirsStr - 环境变量字符串，格式：".pptx=ppt,.docx=docs"
   * @returns {Object} 映射对象，如 { '.pptx': 'ppt', '.docx': 'docs' }
   */
  parseTypeDirs(typeDirsStr) {
    if (!typeDirsStr) {
      return {}
    }
    
    const mapping = {}
    const pairs = typeDirsStr.split(',')
    
    for (const pair of pairs) {
      const trimmed = pair.trim()
      if (!trimmed) continue
      
      const equalIndex = trimmed.indexOf('=')
      if (equalIndex === -1) {
        console.warn(`[扫描配置] 类型映射格式错误，缺少等号: ${trimmed}`)
        continue
      }
      
      const fileType = trimmed.substring(0, equalIndex).trim()
      const dirName = trimmed.substring(equalIndex + 1).trim()
      
      // 确保文件类型以点开头
      const normalizedFileType = fileType.startsWith('.') ? fileType : `.${fileType}`
      
      if (normalizedFileType && dirName) {
        mapping[normalizedFileType] = dirName
      } else {
        console.warn(`[扫描配置] 类型映射格式错误: ${trimmed}`)
      }
    }
    
    return mapping
  }
  
  /**
   * 根据文件类型获取扫描目录
   * 
   * @param {string} fileType - 文件类型，如 '.pptx'
   * @returns {string|null} 扫描目录路径，如果未配置映射则返回 null
   */
  getScanDirForType(fileType) {
    const config = this.getConfig()
    const { sourceDir, typeDirs } = config
    
    if (!sourceDir) {
      return null
    }
    
    // 如果配置了类型映射，返回对应的子目录
    if (typeDirs[fileType]) {
      return path.join(sourceDir, typeDirs[fileType])
    }
    
    // 未配置映射，返回根目录
    return sourceDir
  }
  
  /**
   * 获取所有需要扫描的目录
   * 
   * @returns {Object} 目录映射，如 { '.pptx': 'D:\\...\\ppt', '.docx': 'D:\\...\\docs' }
   */
  getSourceDirs() {
    const config = this.getConfig()
    const { sourceDir, fileTypes, typeDirs } = config
    
    if (!sourceDir) {
      return {}
    }
    
    const dirs = {}
    
    // 清理和规范化文件类型（移除可能的错误格式）
    const normalizedFileTypes = fileTypes
      .map(ft => {
        // 如果包含等号，可能是配置错误，只取等号前的部分
        if (ft.includes('=')) {
          const beforeEqual = ft.split('=')[0].trim()
          return beforeEqual.startsWith('.') ? beforeEqual : `.${beforeEqual}`
        }
        // 确保以点开头
        return ft.startsWith('.') ? ft : `.${ft}`
      })
      .filter(ft => ft && ft !== '.')
    
    // 如果配置了类型映射
    if (Object.keys(typeDirs).length > 0) {
      for (const fileType of normalizedFileTypes) {
        if (typeDirs[fileType]) {
          dirs[fileType] = path.join(sourceDir, typeDirs[fileType])
        } else {
          // 未映射的类型，使用根目录
          dirs[fileType] = sourceDir
        }
      }
    } else {
      // 未配置映射，所有类型都扫描根目录
      for (const fileType of normalizedFileTypes) {
        dirs[fileType] = sourceDir
      }
    }
    
    return dirs
  }
  
  /**
   * 验证配置有效性
   * 
   * @returns {Object} 验证结果 { valid: boolean, errors: string[] }
   */
  validateConfig() {
    const errors = []
    
    try {
      const config = this.getConfig()
      
      // 检查源目录是否配置
      if (!config.sourceDir) {
        errors.push('FILE_SCAN_SOURCE_DIR 未配置')
        return { valid: false, errors }
      }
      
      // 检查源目录是否存在
      try {
        if (!fs.existsSync(config.sourceDir)) {
          errors.push(`源目录不存在: ${config.sourceDir}`)
          return { valid: false, errors }
        }
      } catch (error) {
        errors.push(`检查源目录时出错: ${error.message}`)
        return { valid: false, errors }
      }
      
      // 检查源目录是否可读
      try {
        fs.accessSync(config.sourceDir, fs.constants.R_OK)
      } catch (error) {
        errors.push(`源目录不可读: ${config.sourceDir} (${error.message})`)
        return { valid: false, errors }
      }
      
      // 检查扫描间隔是否有效
      if (config.interval < 1000) {
        errors.push('扫描间隔不能小于 1000 毫秒')
      }
      
      // 检查文件类型是否配置
      if (!config.fileTypes || config.fileTypes.length === 0) {
        errors.push('至少需要配置一个文件类型')
      }
      
      // 检查类型映射目录是否存在
      try {
        const sourceDirs = this.getSourceDirs()
        for (const [fileType, dirPath] of Object.entries(sourceDirs)) {
          if (dirPath && dirPath !== config.sourceDir) {
            try {
              if (!fs.existsSync(dirPath)) {
                // 子目录不存在，记录警告但不阻止（会自动创建或使用根目录）
                console.warn(`[扫描配置] 类型 ${fileType} 的扫描目录不存在: ${dirPath}`)
              }
            } catch (error) {
              // 检查目录时出错，记录警告但不阻止
              console.warn(`[扫描配置] 检查类型 ${fileType} 的扫描目录时出错: ${error.message}`)
            }
          }
        }
      } catch (error) {
        // 获取源目录时出错，记录警告但不阻止
        console.warn(`[扫描配置] 获取源目录映射时出错: ${error.message}`)
      }
      
      return {
        valid: errors.length === 0,
        errors
      }
    } catch (error) {
      console.error('[扫描配置] 验证配置时发生未预期的错误:', error)
      return {
        valid: false,
        errors: [`验证配置时发生错误: ${error.message}`]
      }
    }
  }
  
  /**
   * 获取配置信息（用于 API 返回，不包含敏感信息）
   * 
   * @returns {Object} 配置信息
   */
  getConfigInfo() {
    try {
      const config = this.getConfig()
      let validation
      let sourceDirs = {}
      
      try {
        validation = this.validateConfig()
      } catch (error) {
        console.error('[扫描配置] 验证配置时出错:', error)
        validation = {
          valid: false,
          errors: [`验证配置时出错: ${error.message}`]
        }
      }
      
      try {
        sourceDirs = this.getSourceDirs()
      } catch (error) {
        console.error('[扫描配置] 获取源目录时出错:', error)
        // 如果获取源目录失败，使用空对象，不影响其他信息返回
      }
      
      return {
        sourceDir: config.sourceDir || null,
        enabled: config.enabled,
        interval: config.interval,
        intervalHours: (config.interval / 3600000).toFixed(1), // 转换为小时
        autoProcess: config.autoProcess,
        fileTypes: config.fileTypes || [],
        typeDirs: config.typeDirs || {},
        sourceDirs: sourceDirs,
        valid: validation.valid,
        errors: validation.errors || []
      }
    } catch (error) {
      console.error('[扫描配置] 获取配置信息时出错:', error)
      throw error
    }
  }
}

export default new ScanConfigService()





