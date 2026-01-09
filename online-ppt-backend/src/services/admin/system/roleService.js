/**
 * 角色管理服务
 * 
 * 提供角色的增删改查功能
 * TODO: 后续对接数据库，当前返回Mock数据
 */

import { generateDocumentId } from '../../../utils/idGenerator.js'

class RoleService {
  /**
   * 获取角色列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码，默认1
   * @param {number} params.pageSize - 每页数量，默认20
   * @param {string} params.keyword - 关键词搜索（角色名称或权限字符）
   * @param {string} params.status - 状态筛选：0=正常，1=停用
   * @returns {Promise<Object>} { list, total }
   */
  async getRoleList(params = {}) {
    try {
      // TODO: 对接数据库
      // 暂时返回Mock数据
      const mockList = [
        {
          id: '1',
          role_name: '超级管理员',
          role_key: 'admin',
          role_sort: 1,
          status: '0',
          remark: '拥有所有权限',
          create_time: '2025-01-01 10:00:00'
        },
        {
          id: '2',
          role_name: '普通角色',
          role_key: 'common',
          role_sort: 2,
          status: '0',
          remark: '普通用户角色',
          create_time: '2025-01-01 10:00:00'
        }
      ]

      const { page = 1, pageSize = 20, keyword, status } = params
      let filteredList = [...mockList]

      // 关键词筛选
      if (keyword) {
        filteredList = filteredList.filter(item =>
          item.role_name.includes(keyword) || item.role_key.includes(keyword)
        )
      }

      // 状态筛选
      if (status !== undefined && status !== '') {
        filteredList = filteredList.filter(item => item.status === status)
      }

      // 分页
      const skip = (page - 1) * pageSize
      const list = filteredList.slice(skip, skip + parseInt(pageSize))
      const total = filteredList.length

      return { list, total }
    } catch (error) {
      console.error('[角色服务] 获取角色列表失败:', error)
      throw new Error(`获取角色列表失败: ${error.message}`)
    }
  }

  /**
   * 获取角色详情
   * @param {string} id - 角色ID
   * @returns {Promise<Object>} 角色信息
   */
  async getRoleById(id) {
    try {
      // TODO: 对接数据库
      const mockRole = {
        id,
        role_name: '超级管理员',
        role_key: 'admin',
        role_sort: 1,
        status: '0',
        remark: '拥有所有权限',
        create_time: '2025-01-01 10:00:00'
      }

      return mockRole
    } catch (error) {
      console.error('[角色服务] 获取角色详情失败:', error)
      throw new Error(`获取角色详情失败: ${error.message}`)
    }
  }

  /**
   * 创建角色
   * @param {Object} data - 角色数据
   * @returns {Promise<Object>} 创建的角色信息
   */
  async createRole(data) {
    try {
      // TODO: 对接数据库
      if (!data.role_name || !data.role_key) {
        throw new Error('角色名称和权限字符不能为空')
      }

      const newRole = {
        id: generateDocumentId().replace('document_', 'role_'),
        role_name: data.role_name,
        role_key: data.role_key,
        role_sort: data.role_sort || 0,
        status: data.status || '0',
        remark: data.remark || null,
        create_time: new Date().toISOString()
      }

      return newRole
    } catch (error) {
      console.error('[角色服务] 创建角色失败:', error)
      throw new Error(`创建角色失败: ${error.message}`)
    }
  }

  /**
   * 更新角色
   * @param {string} id - 角色ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新后的角色信息
   */
  async updateRole(id, data) {
    try {
      // TODO: 对接数据库
      const updatedRole = {
        id,
        ...data,
        update_time: new Date().toISOString()
      }

      return updatedRole
    } catch (error) {
      console.error('[角色服务] 更新角色失败:', error)
      throw new Error(`更新角色失败: ${error.message}`)
    }
  }

  /**
   * 删除角色
   * @param {string} id - 角色ID
   * @returns {Promise<void>}
   */
  async deleteRole(id) {
    try {
      // TODO: 对接数据库
      // 检查是否有关联用户
      // 如果有关联用户，不允许删除
      console.log(`[角色服务] 删除角色: ${id}`)
    } catch (error) {
      console.error('[角色服务] 删除角色失败:', error)
      throw new Error(`删除角色失败: ${error.message}`)
    }
  }
}

export default new RoleService()

