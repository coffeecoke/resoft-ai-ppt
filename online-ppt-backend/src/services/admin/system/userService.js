/**
 * 用户管理服务
 *
 * 对接 users 表，字段与数据库保持一致
 * sex / phone 前端保留但不存库，读时返回 null
 */

import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import prisma from '../../../lib/prisma.js'

class UserService {
  /**
   * 获取用户列表
   * @param {Object} params - { page, pageSize, keyword, status }
   * status: 'active' | 'disabled'
   */
  async getUserList(params = {}) {
    try {
      const { page = 1, pageSize = 20, keyword, status } = params

      const where = {}
      if (keyword) {
        where.OR = [
          { username: { contains: keyword } },
          { name: { contains: keyword } },
        ]
      }
      if (status) {
        where.status = status
      }

      const skip = (Number(page) - 1) * Number(pageSize)
      const take = Number(pageSize)

      const [users, total] = await Promise.all([
        prisma.users.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            department: true,
            role: true,
            status: true,
            created_at: true,
          },
        }),
        prisma.users.count({ where }),
      ])

      const list = users.map(u => ({ ...u, sex: null, phone: null }))
      return { list, total }
    } catch (error) {
      console.error('[用户服务] 获取用户列表失败:', error)
      throw new Error(`获取用户列表失败: ${error.message}`)
    }
  }

  /**
   * 获取用户详情
   */
  async getUserById(id) {
    try {
      const user = await prisma.users.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          department: true,
          role: true,
          status: true,
          created_at: true,
        },
      })
      if (!user) throw new Error('用户不存在')
      return { ...user, sex: null, phone: null }
    } catch (error) {
      console.error('[用户服务] 获取用户详情失败:', error)
      throw new Error(`获取用户详情失败: ${error.message}`)
    }
  }

  /**
   * 创建用户
   * @param {Object} data - { username, password, name, email, status, department, role }
   */
  async createUser(data) {
    try {
      const { username, password, name, email, status, department, role } = data
      if (!username || !password) throw new Error('用户名和密码不能为空')
      if (password.length < 6) throw new Error('密码长度不能少于6位')

      const existing = await prisma.users.findUnique({ where: { username } })
      if (existing) throw new Error('用户名已存在')

      const password_hash = await bcrypt.hash(password, 12)

      const user = await prisma.users.create({
        data: {
          id: nanoid(),
          username,
          name: name || username,
          email: email || null,
          password_hash,
          role: role === 'admin' ? 'admin' : 'user',
          status: status || 'active',
          department: department || null,
        },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          department: true,
          role: true,
          status: true,
          created_at: true,
        },
      })

      return { ...user, sex: null, phone: null }
    } catch (error) {
      console.error('[用户服务] 创建用户失败:', error)
      throw new Error(`创建用户失败: ${error.message}`)
    }
  }

  /**
   * 更新用户
   * @param {Object} data - { name, email, status, department, role }
   */
  async updateUser(id, data) {
    try {
      const { name, email, status, department, role } = data

      const updateData = {}
      if (name !== undefined) updateData.name = name
      if (email !== undefined) updateData.email = email || null
      if (status !== undefined) updateData.status = status
      if (department !== undefined) updateData.department = department || null
      if (role !== undefined) updateData.role = role === 'admin' ? 'admin' : 'user'

      const user = await prisma.users.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          department: true,
          role: true,
          status: true,
          created_at: true,
        },
      })

      return { ...user, sex: null, phone: null }
    } catch (error) {
      console.error('[用户服务] 更新用户失败:', error)
      throw new Error(`更新用户失败: ${error.message}`)
    }
  }

  /**
   * 删除用户（软删除，设为 disabled）
   */
  async deleteUser(id) {
    try {
      await prisma.users.update({ where: { id }, data: { status: 'disabled' } })
    } catch (error) {
      console.error('[用户服务] 删除用户失败:', error)
      throw new Error(`删除用户失败: ${error.message}`)
    }
  }

  /**
   * 重置用户密码
   */
  async resetPassword(id, newPassword) {
    try {
      if (!newPassword || newPassword.length < 6) throw new Error('密码长度不能少于6位')
      const password_hash = await bcrypt.hash(newPassword, 12)
      await prisma.users.update({ where: { id }, data: { password_hash } })
    } catch (error) {
      console.error('[用户服务] 重置密码失败:', error)
      throw new Error(`重置密码失败: ${error.message}`)
    }
  }
}

export default new UserService()
