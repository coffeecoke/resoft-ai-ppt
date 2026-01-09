/**
 * 用户管理服务
 * 
 * 提供用户的增删改查功能
 * TODO: 后续对接数据库，当前返回Mock数据
 */

import { generateDocumentId } from '../../../utils/idGenerator.js'

class UserService {
  /**
   * 获取用户列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码，默认1
   * @param {number} params.pageSize - 每页数量，默认20
   * @param {string} params.keyword - 关键词搜索（用户名、昵称、手机号）
   * @param {string} params.status - 状态筛选：0=正常，1=停用
   * @param {string} params.dept_id - 部门ID筛选
   * @returns {Promise<Object>} { list, total }
   */
  async getUserList(params = {}) {
    try {
      // TODO: 对接数据库
      const mockList = [
        {
          id: '1',
          user_name: 'admin',
          nick_name: '管理员',
          email: 'admin@example.com',
          phone: '13800138000',
          sex: '0',
          status: '0',
          dept_id: '1',
          dept_name: '总公司',
          create_time: '2025-01-01 10:00:00'
        }
      ]

      const { page = 1, pageSize = 20, keyword, status, dept_id } = params
      let filteredList = [...mockList]

      // 关键词筛选
      if (keyword) {
        filteredList = filteredList.filter(item =>
          item.user_name.includes(keyword) ||
          item.nick_name.includes(keyword) ||
          item.phone.includes(keyword)
        )
      }

      // 状态筛选
      if (status !== undefined && status !== '') {
        filteredList = filteredList.filter(item => item.status === status)
      }

      // 部门筛选
      if (dept_id) {
        filteredList = filteredList.filter(item => item.dept_id === dept_id)
      }

      // 分页
      const skip = (page - 1) * pageSize
      const list = filteredList.slice(skip, skip + parseInt(pageSize))
      const total = filteredList.length

      return { list, total }
    } catch (error) {
      console.error('[用户服务] 获取用户列表失败:', error)
      throw new Error(`获取用户列表失败: ${error.message}`)
    }
  }

  /**
   * 获取用户详情
   * @param {string} id - 用户ID
   * @returns {Promise<Object>} 用户信息
   */
  async getUserById(id) {
    try {
      // TODO: 对接数据库
      const mockUser = {
        id,
        user_name: 'admin',
        nick_name: '管理员',
        email: 'admin@example.com',
        phone: '13800138000',
        sex: '0',
        status: '0',
        dept_id: '1',
        dept_name: '总公司',
        role_ids: ['1'],
        create_time: '2025-01-01 10:00:00'
      }

      return mockUser
    } catch (error) {
      console.error('[用户服务] 获取用户详情失败:', error)
      throw new Error(`获取用户详情失败: ${error.message}`)
    }
  }

  /**
   * 创建用户
   * @param {Object} data - 用户数据
   * @returns {Promise<Object>} 创建的用户信息
   */
  async createUser(data) {
    try {
      // TODO: 对接数据库
      if (!data.user_name || !data.password) {
        throw new Error('用户名和密码不能为空')
      }

      const newUser = {
        id: generateDocumentId().replace('document_', 'user_'),
        user_name: data.user_name,
        nick_name: data.nick_name || data.user_name,
        email: data.email || null,
        phone: data.phone || null,
        sex: data.sex || '0',
        status: data.status || '0',
        dept_id: data.dept_id || null,
        role_ids: data.role_ids || [],
        create_time: new Date().toISOString()
      }

      return newUser
    } catch (error) {
      console.error('[用户服务] 创建用户失败:', error)
      throw new Error(`创建用户失败: ${error.message}`)
    }
  }

  /**
   * 更新用户
   * @param {string} id - 用户ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新后的用户信息
   */
  async updateUser(id, data) {
    try {
      // TODO: 对接数据库
      const updatedUser = {
        id,
        ...data,
        update_time: new Date().toISOString()
      }

      return updatedUser
    } catch (error) {
      console.error('[用户服务] 更新用户失败:', error)
      throw new Error(`更新用户失败: ${error.message}`)
    }
  }

  /**
   * 删除用户
   * @param {string} id - 用户ID
   * @returns {Promise<void>}
   */
  async deleteUser(id) {
    try {
      // TODO: 对接数据库
      console.log(`[用户服务] 删除用户: ${id}`)
    } catch (error) {
      console.error('[用户服务] 删除用户失败:', error)
      throw new Error(`删除用户失败: ${error.message}`)
    }
  }

  /**
   * 重置用户密码
   * @param {string} id - 用户ID
   * @param {string} newPassword - 新密码
   * @returns {Promise<void>}
   */
  async resetPassword(id, newPassword) {
    try {
      // TODO: 对接数据库
      console.log(`[用户服务] 重置用户密码: ${id}`)
    } catch (error) {
      console.error('[用户服务] 重置密码失败:', error)
      throw new Error(`重置密码失败: ${error.message}`)
    }
  }
}

export default new UserService()

