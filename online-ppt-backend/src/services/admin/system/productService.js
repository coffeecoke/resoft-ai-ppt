/**
 * 产品管理服务
 *
 * 提供产品的增删改查功能
 */

import * as prismaClient from '@prisma/client'
import { generateDocumentId } from '../../../utils/idGenerator.js'
import { formatObjectDates, formatArrayDates } from '../../../utils/dateFormatter.js'

const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

class ProductService {
  /**
   * 获取产品列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码，默认1
   * @param {number} params.pageSize - 每页数量，默认20
   * @param {string} params.keyword - 关键词搜索（产品名称或代码）
   * @param {string} params.category - 产品分类筛选
   * @param {boolean} params.is_active - 启用状态筛选
   * @param {boolean} params.is_featured - 重点产品筛选
   * @returns {Promise<Object>} { list, total }
   */
  async getProductList(params = {}) {
    try {
      const { page = 1, pageSize = 20, keyword, category, is_active, is_featured } = params
      const skip = (page - 1) * pageSize

      const where = {}
      if (keyword) {
        where.OR = [
          { name: { contains: keyword } },
          { code: { contains: keyword } }
        ]
      }
      if (category) {
        where.category = category
      }
      if (is_active !== undefined && is_active !== '') {
        where.is_active = is_active === 'true' || is_active === true
      }
      if (is_featured !== undefined && is_featured !== '') {
        where.is_featured = is_featured === 'true' || is_featured === true
      }

      const [list, total] = await Promise.all([
        prisma.products.findMany({
          where,
          skip,
          take: parseInt(pageSize),
          orderBy: [
            { sort_order: 'asc' },
            { created_at: 'desc' }
          ]
        }),
        prisma.products.count({ where })
      ])

      // 格式化日期字段
      const formattedList = formatArrayDates(list, ['created_at', 'updated_at'])

      return { list: formattedList, total }
    } catch (error) {
      console.error('[产品服务] 获取产品列表失败:', error)
      throw new Error(`获取产品列表失败: ${error.message}`)
    }
  }

  /**
   * 获取产品详情
   * @param {string} id - 产品ID
   * @returns {Promise<Object>} 产品信息
   */
  async getProductById(id) {
    try {
      const product = await prisma.products.findUnique({
        where: { id }
      })

      if (!product) {
        throw new Error('产品不存在')
      }

      return formatObjectDates(product, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[产品服务] 获取产品详情失败:', error)
      throw new Error(`获取产品详情失败: ${error.message}`)
    }
  }

  /**
   * 创建产品
   * @param {Object} data - 产品数据
   * @returns {Promise<Object>} 创建的产品信息
   */
  async createProduct(data) {
    try {
      // 验证必填字段
      if (!data.name) {
        throw new Error('产品名称不能为空')
      }

      // 如果提供了产品代码，检查是否重复
      if (data.code) {
        const existing = await prisma.products.findUnique({
          where: { code: data.code }
        })
        if (existing) {
          throw new Error('产品代码已存在')
        }
      }

      const product = await prisma.products.create({
        data: {
          id: generateDocumentId(),
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          category: data.category || null,
          tags: data.tags || null,
          icon: data.icon || null,
          cover: data.cover || null,
          sort_order: data.sort_order || 0,
          is_active: data.is_active !== undefined ? data.is_active : true,
          is_featured: data.is_featured !== undefined ? data.is_featured : false,
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      return formatObjectDates(product, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[产品服务] 创建产品失败:', error)
      throw new Error(`创建产品失败: ${error.message}`)
    }
  }

  /**
   * 更新产品
   * @param {string} id - 产品ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新后的产品信息
   */
  async updateProduct(id, data) {
    try {
      // 检查产品是否存在
      const existing = await prisma.products.findUnique({
        where: { id }
      })
      if (!existing) {
        throw new Error('产品不存在')
      }

      // 如果更新产品代码，检查是否重复
      if (data.code && data.code !== existing.code) {
        const duplicate = await prisma.products.findUnique({
          where: { code: data.code }
        })
        if (duplicate) {
          throw new Error('产品代码已存在')
        }
      }

      const updateData = {
        updated_at: new Date()
      }

      // 只更新提供的字段
      if (data.name !== undefined) updateData.name = data.name
      if (data.code !== undefined) updateData.code = data.code || null
      if (data.description !== undefined) updateData.description = data.description || null
      if (data.category !== undefined) updateData.category = data.category || null
      if (data.tags !== undefined) updateData.tags = data.tags || null
      if (data.icon !== undefined) updateData.icon = data.icon || null
      if (data.cover !== undefined) updateData.cover = data.cover || null
      if (data.sort_order !== undefined) updateData.sort_order = data.sort_order
      if (data.is_active !== undefined) updateData.is_active = data.is_active
      if (data.is_featured !== undefined) updateData.is_featured = data.is_featured

      const product = await prisma.products.update({
        where: { id },
        data: updateData
      })

      return formatObjectDates(product, ['created_at', 'updated_at'])
    } catch (error) {
      console.error('[产品服务] 更新产品失败:', error)
      throw new Error(`更新产品失败: ${error.message}`)
    }
  }

  /**
   * 删除产品
   * @param {string} id - 产品ID
   * @returns {Promise<void>}
   */
  async deleteProduct(id) {
    try {
      // 检查产品是否存在
      const existing = await prisma.products.findUnique({
        where: { id }
      })
      if (!existing) {
        throw new Error('产品不存在')
      }

      // 检查是否有关联的文档
      const documentCount = await prisma.documents.count({
        where: { product_id: id }
      })
      if (documentCount > 0) {
        throw new Error(`该产品下有 ${documentCount} 个关联文档，无法删除`)
      }

      await prisma.products.delete({
        where: { id }
      })
    } catch (error) {
      console.error('[产品服务] 删除产品失败:', error)
      throw new Error(`删除产品失败: ${error.message}`)
    }
  }
}

export default new ProductService()
