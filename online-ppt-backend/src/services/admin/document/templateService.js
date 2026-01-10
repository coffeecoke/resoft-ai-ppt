/**
 * 模版管理服务
 * 
 * 提供PPT模版的增删改查功能
 * TODO: 后续对接数据库，当前复用现有模版逻辑
 */

import { generateDocumentId } from '../../../utils/idGenerator.js'

class TemplateService {
  /**
   * 获取模版列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码，默认1
   * @param {number} params.pageSize - 每页数量，默认20
   * @param {string} params.keyword - 关键词搜索（模版名称）
   * @param {string} params.status - 状态筛选：active=启用，inactive=停用
   * @returns {Promise<Object>} { list, total }
   */
  async getTemplateList(params = {}) {
    try {
      // TODO: 对接数据库或复用现有模版逻辑
      // 暂时返回Mock数据
      const mockList = []

      const { page = 1, pageSize = 20, keyword, status } = params
      let filteredList = [...mockList]

      // 关键词筛选
      if (keyword) {
        filteredList = filteredList.filter(item =>
          item.name.includes(keyword) || item.description?.includes(keyword)
        )
      }

      // 状态筛选
      if (status) {
        filteredList = filteredList.filter(item => item.status === status)
      }

      // 分页
      const skip = (page - 1) * pageSize
      const list = filteredList.slice(skip, skip + parseInt(pageSize))
      const total = filteredList.length

      return { list, total }
    } catch (error) {
      console.error('[模版服务] 获取模版列表失败:', error)
      throw new Error(`获取模版列表失败: ${error.message}`)
    }
  }

  /**
   * 获取模版详情
   * @param {string} id - 模版ID
   * @returns {Promise<Object>} 模版信息
   */
  async getTemplateById(id) {
    try {
      // TODO: 对接数据库或复用现有模版逻辑
      const mockTemplate = {
        id,
        name: '模版名称',
        description: '模版描述',
        cover: null,
        status: 'active',
        create_time: new Date().toISOString()
      }

      return mockTemplate
    } catch (error) {
      console.error('[模版服务] 获取模版详情失败:', error)
      throw new Error(`获取模版详情失败: ${error.message}`)
    }
  }

  /**
   * 创建模版
   * @param {Object} data - 模版数据
   * @returns {Promise<Object>} 创建的模版信息
   */
  async createTemplate(data) {
    try {
      // TODO: 对接数据库或复用现有模版逻辑
      if (!data.name) {
        throw new Error('模版名称不能为空')
      }

      const newTemplate = {
        id: generateDocumentId().replace('document_', 'template_'),
        name: data.name,
        description: data.description || null,
        cover: data.cover || null,
        status: data.status || 'active',
        create_time: new Date().toISOString()
      }

      return newTemplate
    } catch (error) {
      console.error('[模版服务] 创建模版失败:', error)
      throw new Error(`创建模版失败: ${error.message}`)
    }
  }

  /**
   * 更新模版
   * @param {string} id - 模版ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新后的模版信息
   */
  async updateTemplate(id, data) {
    try {
      // TODO: 对接数据库或复用现有模版逻辑
      const updatedTemplate = {
        id,
        ...data,
        update_time: new Date().toISOString()
      }

      return updatedTemplate
    } catch (error) {
      console.error('[模版服务] 更新模版失败:', error)
      throw new Error(`更新模版失败: ${error.message}`)
    }
  }

  /**
   * 删除模版
   * @param {string} id - 模版ID
   * @returns {Promise<void>}
   */
  async deleteTemplate(id) {
    try {
      // TODO: 对接数据库或复用现有模版逻辑
      console.log(`[模版服务] 删除模版: ${id}`)
    } catch (error) {
      console.error('[模版服务] 删除模版失败:', error)
      throw new Error(`删除模版失败: ${error.message}`)
    }
  }
}

export default new TemplateService()

