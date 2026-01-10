/**
 * 部门管理服务
 * 
 * 提供部门的增删改查功能，支持树形结构
 * TODO: 后续对接数据库，当前返回Mock数据
 */

import { generateDocumentId } from '../../../utils/idGenerator.js'

class DeptService {
  /**
   * 获取部门树
   * @param {Object} params - 查询参数
   * @param {string} params.status - 状态筛选：0=正常，1=停用
   * @returns {Promise<Array>} 部门树结构
   */
  async getDeptTree(params = {}) {
    try {
      // TODO: 对接数据库
      // 暂时返回Mock数据（树形结构）
      const mockTree = [
        {
          id: '1',
          dept_name: '总公司',
          parent_id: '0',
          order_num: 1,
          leader: '张三',
          phone: '13800138000',
          email: 'dept1@example.com',
          status: '0',
          children: [
            {
              id: '2',
              dept_name: '研发部',
              parent_id: '1',
              order_num: 1,
              leader: '李四',
              phone: '13800138001',
              email: 'dept2@example.com',
              status: '0',
              children: []
            },
            {
              id: '3',
              dept_name: '市场部',
              parent_id: '1',
              order_num: 2,
              leader: '王五',
              phone: '13800138002',
              email: 'dept3@example.com',
              status: '0',
              children: []
            }
          ]
        }
      ]

      // 状态筛选（递归处理）
      const { status } = params
      if (status !== undefined && status !== '') {
        return this.filterDeptTreeByStatus(mockTree, status)
      }

      return mockTree
    } catch (error) {
      console.error('[部门服务] 获取部门树失败:', error)
      throw new Error(`获取部门树失败: ${error.message}`)
    }
  }

  /**
   * 递归筛选部门树（按状态）
   */
  filterDeptTreeByStatus(tree, status) {
    return tree
      .filter(dept => dept.status === status)
      .map(dept => ({
        ...dept,
        children: dept.children ? this.filterDeptTreeByStatus(dept.children, status) : []
      }))
  }

  /**
   * 获取部门列表（扁平结构）
   * @param {Object} params - 查询参数
   * @param {string} params.keyword - 关键词搜索（部门名称）
   * @param {string} params.status - 状态筛选：0=正常，1=停用
   * @returns {Promise<Array>} 部门列表
   */
  async getDeptList(params = {}) {
    try {
      // TODO: 对接数据库
      const tree = await this.getDeptTree(params)
      // 将树形结构扁平化
      const flatten = (arr, parentName = '') => {
        let result = []
        arr.forEach(item => {
          result.push({
            ...item,
            parent_name: parentName,
            children: undefined
          })
          if (item.children && item.children.length > 0) {
            result = result.concat(flatten(item.children, item.dept_name))
          }
        })
        return result
      }

      let list = flatten(tree)

      // 关键词筛选
      const { keyword } = params
      if (keyword) {
        list = list.filter(item => item.dept_name.includes(keyword))
      }

      return list
    } catch (error) {
      console.error('[部门服务] 获取部门列表失败:', error)
      throw new Error(`获取部门列表失败: ${error.message}`)
    }
  }

  /**
   * 获取部门详情
   * @param {string} id - 部门ID
   * @returns {Promise<Object>} 部门信息
   */
  async getDeptById(id) {
    try {
      // TODO: 对接数据库
      const mockDept = {
        id,
        dept_name: '研发部',
        parent_id: '1',
        order_num: 1,
        leader: '李四',
        phone: '13800138001',
        email: 'dept2@example.com',
        status: '0'
      }

      return mockDept
    } catch (error) {
      console.error('[部门服务] 获取部门详情失败:', error)
      throw new Error(`获取部门详情失败: ${error.message}`)
    }
  }

  /**
   * 创建部门
   * @param {Object} data - 部门数据
   * @returns {Promise<Object>} 创建的部门信息
   */
  async createDept(data) {
    try {
      // TODO: 对接数据库
      if (!data.dept_name) {
        throw new Error('部门名称不能为空')
      }

      // 检查父部门是否存在
      if (data.parent_id && data.parent_id !== '0') {
        // TODO: 验证父部门是否存在
      }

      const newDept = {
        id: generateDocumentId().replace('document_', 'dept_'),
        dept_name: data.dept_name,
        parent_id: data.parent_id || '0',
        order_num: data.order_num || 0,
        leader: data.leader || null,
        phone: data.phone || null,
        email: data.email || null,
        status: data.status || '0',
        create_time: new Date().toISOString()
      }

      return newDept
    } catch (error) {
      console.error('[部门服务] 创建部门失败:', error)
      throw new Error(`创建部门失败: ${error.message}`)
    }
  }

  /**
   * 更新部门
   * @param {string} id - 部门ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新后的部门信息
   */
  async updateDept(id, data) {
    try {
      // TODO: 对接数据库
      // 检查是否将父部门设置为自己的子部门（防止循环引用）
      if (data.parent_id && data.parent_id === id) {
        throw new Error('不能将父部门设置为当前部门')
      }

      const updatedDept = {
        id,
        ...data,
        update_time: new Date().toISOString()
      }

      return updatedDept
    } catch (error) {
      console.error('[部门服务] 更新部门失败:', error)
      throw new Error(`更新部门失败: ${error.message}`)
    }
  }

  /**
   * 删除部门
   * @param {string} id - 部门ID
   * @returns {Promise<void>}
   */
  async deleteDept(id) {
    try {
      // TODO: 对接数据库
      // 检查是否有子部门
      // 检查是否有关联用户
      // 如果有，不允许删除
      console.log(`[部门服务] 删除部门: ${id}`)
    } catch (error) {
      console.error('[部门服务] 删除部门失败:', error)
      throw new Error(`删除部门失败: ${error.message}`)
    }
  }
}

export default new DeptService()

