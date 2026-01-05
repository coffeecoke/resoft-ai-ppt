/**
 * 交流场次管理服务
 * 负责会议场次的增删改查操作
 */

const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class SessionsService {
  /**
   * 获取场次列表
   * @param {Object} filters - 筛选条件
   * @param {string} filters.customerName - 客户名称
   * @param {string} filters.productId - 产品ID
   * @param {string} filters.status - 状态
   * @param {string} filters.startDate - 开始日期
   * @param {string} filters.endDate - 结束日期
   * @param {number} filters.page - 页码
   * @param {number} filters.limit - 每页数量
   * @returns {Promise<{sessions: Array, total: number}>}
   */
  async getSessions(filters = {}) {
    const {
      customerName,
      productId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const where = {};
    
    if (customerName) {
      where.customer_name = {
        contains: customerName
      };
    }
    
    if (productId) {
      where.product_id = productId;
    }
    
    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.session_date = {};
      if (startDate) {
        where.session_date.gte = new Date(startDate);
      }
      if (endDate) {
        where.session_date.lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.sessions.findMany({
        where,
        include: {
          products: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          _count: {
            select: {
              documents: true,
              transcriptions: true,
              session_concerns: true,
              session_needs: true
            }
          }
        },
        orderBy: [
          { session_date: 'desc' },
          { created_at: 'desc' }
        ],
        skip,
        take: limit,
      }),
      prisma.sessions.count({ where })
    ]);

    return {
      sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 获取单个场次详情
   * @param {string} id - 场次ID
   * @returns {Promise<Object|null>}
   */
  async getSessionById(id) {
    return await prisma.sessions.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true
          }
        },
        session_concerns: {
          include: {
            concerns: true
          },
          orderBy: {
            sort_order: 'asc'
          }
        },
        session_needs: {
          orderBy: {
            sort_order: 'asc'
          }
        },
        _count: {
          select: {
            documents: true,
            transcriptions: true
          }
        }
      }
    });
  }

  /**
   * 创建场次
   * @param {Object} data - 场次数据
   * @returns {Promise<Object>}
   */
  async createSession(data) {
    const {
      title,
      customerName,
      sessionDate,
      duration,
      location,
      videoUrl,
      thumbnail,
      participants,
      productId,
      industry,
      status = 'draft',
      createdBy
    } = data;

    if (!title || !customerName || !sessionDate) {
      throw new Error('标题、客户名称和会议时间为必填项');
    }

    const session = await prisma.sessions.create({
      data: {
        id: uuidv4(),
        title,
        customer_name: customerName,
        session_date: new Date(sessionDate),
        duration,
        location,
        video_url: videoUrl,
        thumbnail,
        participants: participants || [],
        product_id: productId,
        industry: industry || [],
        status,
        created_by: createdBy,
        updated_at: new Date()
      },
      include: {
        products: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`✅ 场次创建成功: ${session.title} (${session.id})`);
    return session;
  }

  /**
   * 更新场次
   * @param {string} id - 场次ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>}
   */
  async updateSession(id, data) {
    const {
      title,
      customerName,
      sessionDate,
      duration,
      location,
      videoUrl,
      thumbnail,
      participants,
      productId,
      industry,
      status
    } = data;

    const updateData = {
      updated_at: new Date()
    };

    if (title !== undefined) updateData.title = title;
    if (customerName !== undefined) updateData.customer_name = customerName;
    if (sessionDate !== undefined) updateData.session_date = new Date(sessionDate);
    if (duration !== undefined) updateData.duration = duration;
    if (location !== undefined) updateData.location = location;
    if (videoUrl !== undefined) updateData.video_url = videoUrl;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (participants !== undefined) updateData.participants = participants;
    if (productId !== undefined) updateData.product_id = productId;
    if (industry !== undefined) updateData.industry = industry;
    if (status !== undefined) updateData.status = status;

    const session = await prisma.sessions.update({
      where: { id },
      data: updateData,
      include: {
        products: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`✅ 场次更新成功: ${session.title} (${id})`);
    return session;
  }

  /**
   * 删除场次
   * @param {string} id - 场次ID
   * @returns {Promise<Object>}
   */
  async deleteSession(id) {
    // 检查是否有关联数据
    const session = await prisma.sessions.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
            transcriptions: true,
            session_concerns: true,
            session_needs: true
          }
        }
      }
    });

    if (!session) {
      throw new Error('场次不存在');
    }

    const totalRelated = session._count.documents + 
                         session._count.transcriptions +
                         session._count.session_concerns +
                         session._count.session_needs;

    if (totalRelated > 0) {
      throw new Error(
        `无法删除场次 "${session.title}"，因为有 ${totalRelated} 条关联数据。` +
        `请先处理关联的文档(${session._count.documents})、` +
        `转录(${session._count.transcriptions})、` +
        `关心问题(${session._count.session_concerns})和` +
        `潜在需求(${session._count.session_needs})。`
      );
    }

    await prisma.sessions.delete({
      where: { id }
    });

    console.log(`🗑️ 场次删除成功: ${session.title} (${id})`);
    return { success: true, message: '场次删除成功' };
  }

  /**
   * 获取场次统计信息
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const [total, draft, completed, byProduct] = await Promise.all([
      prisma.sessions.count(),
      prisma.sessions.count({ where: { status: 'draft' } }),
      prisma.sessions.count({ where: { status: 'completed' } }),
      prisma.sessions.groupBy({
        by: ['product_id'],
        _count: true,
        where: {
          product_id: { not: null }
        }
      })
    ]);

    // 获取产品信息
    const productIds = byProduct.map(item => item.product_id).filter(Boolean);
    const products = await prisma.products.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    });

    const productMap = Object.fromEntries(
      products.map(p => [p.id, p.name])
    );

    return {
      total,
      draft,
      completed,
      byProduct: byProduct.map(item => ({
        productId: item.product_id,
        productName: productMap[item.product_id] || '未知产品',
        count: item._count
      }))
    };
  }

  /**
   * 获取最近的场次
   * @param {number} limit - 数量限制
   * @returns {Promise<Array>}
   */
  async getRecentSessions(limit = 10) {
    return await prisma.sessions.findMany({
      orderBy: {
        session_date: 'desc'
      },
      take: limit,
      include: {
        products: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }
}

module.exports = new SessionsService();

