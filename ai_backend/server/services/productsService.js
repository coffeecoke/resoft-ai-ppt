/**
 * 产品管理服务
 * 负责产品的增删改查操作
 */

const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');

class ProductsService {
  /**
   * 获取产品列表
   * @param {Object} filters - 筛选条件
   * @param {boolean} filters.isActive - 是否只获取启用的产品
   * @param {string} filters.category - 产品分类
   * @param {number} filters.page - 页码
   * @param {number} filters.limit - 每页数量
   * @returns {Promise<{products: Array, total: number}>}
   */
  async getProducts(filters = {}) {
    const {
      isActive,
      category,
      page = 1,
      limit = 50,
    } = filters;

    const where = {};
    
    if (isActive !== undefined) {
      where.is_active = isActive;
    }
    
    if (category) {
      where.category = category;
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.products.findMany({
        where,
        orderBy: [
          { sort_order: 'asc' },
          { name: 'asc' }
        ],
        skip,
        take: limit,
      }),
      prisma.products.count({ where })
    ]);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 获取单个产品详情
   * @param {string} id - 产品ID
   * @returns {Promise<Object|null>}
   */
  async getProductById(id) {
    return await prisma.products.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
            sessions: true,
            transcriptions: true
          }
        }
      }
    });
  }

  /**
   * 创建产品
   * @param {Object} data - 产品数据
   * @returns {Promise<Object>}
   */
  async createProduct(data) {
    const {
      name,
      code,
      description,
      category,
      tags,
      icon,
      cover,
      sortOrder = 0,
      isActive = true
    } = data;

    // 检查产品代码是否重复
    if (code) {
      const existing = await prisma.products.findUnique({
        where: { code }
      });
      if (existing) {
        throw new Error(`产品代码 "${code}" 已存在`);
      }
    }

    const product = await prisma.products.create({
      data: {
        id: uuidv4(),
        name,
        code,
        description,
        category,
        tags: tags || [],
        icon,
        cover,
        sort_order: sortOrder,
        is_active: isActive,
        updated_at: new Date()
      }
    });

    console.log(`✅ 产品创建成功: ${product.name} (${product.id})`);
    return product;
  }

  /**
   * 更新产品
   * @param {string} id - 产品ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>}
   */
  async updateProduct(id, data) {
    const {
      name,
      code,
      description,
      category,
      tags,
      icon,
      cover,
      sortOrder,
      isActive
    } = data;

    // 如果更新code，检查是否重复
    if (code) {
      const existing = await prisma.products.findFirst({
        where: {
          code,
          NOT: { id }
        }
      });
      if (existing) {
        throw new Error(`产品代码 "${code}" 已被其他产品使用`);
      }
    }

    const updateData = {
      updated_at: new Date()
    };

    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (icon !== undefined) updateData.icon = icon;
    if (cover !== undefined) updateData.cover = cover;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;
    if (isActive !== undefined) updateData.is_active = isActive;

    const product = await prisma.products.update({
      where: { id },
      data: updateData
    });

    console.log(`✅ 产品更新成功: ${product.name} (${id})`);
    return product;
  }

  /**
   * 删除产品
   * @param {string} id - 产品ID
   * @returns {Promise<Object>}
   */
  async deleteProduct(id) {
    // 检查是否有关联数据
    const product = await prisma.products.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
            sessions: true,
            transcriptions: true
          }
        }
      }
    });

    if (!product) {
      throw new Error('产品不存在');
    }

    const totalRelated = product._count.documents + 
                         product._count.sessions + 
                         product._count.transcriptions;

    if (totalRelated > 0) {
      throw new Error(
        `无法删除产品 "${product.name}"，因为有 ${totalRelated} 条关联数据。` +
        `请先处理关联的文档(${product._count.documents})、` +
        `场次(${product._count.sessions})和转录(${product._count.transcriptions})。`
      );
    }

    await prisma.products.delete({
      where: { id }
    });

    console.log(`🗑️ 产品删除成功: ${product.name} (${id})`);
    return { success: true, message: '产品删除成功' };
  }

  /**
   * 批量更新排序
   * @param {Array<{id: string, sortOrder: number}>} items - 排序数据
   * @returns {Promise<void>}
   */
  async updateSortOrder(items) {
    const updates = items.map(item => 
      prisma.products.update({
        where: { id: item.id },
        data: { 
          sort_order: item.sortOrder,
          updated_at: new Date()
        }
      })
    );

    await Promise.all(updates);
    console.log(`✅ 批量更新排序成功，共 ${items.length} 个产品`);
  }

  /**
   * 获取产品统计信息
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const [total, active, byCategory] = await Promise.all([
      prisma.products.count(),
      prisma.products.count({ where: { is_active: true } }),
      prisma.products.groupBy({
        by: ['category'],
        _count: true
      })
    ]);

    return {
      total,
      active,
      inactive: total - active,
      byCategory: byCategory.map(item => ({
        category: item.category || '未分类',
        count: item._count
      }))
    };
  }
}

module.exports = new ProductsService();

