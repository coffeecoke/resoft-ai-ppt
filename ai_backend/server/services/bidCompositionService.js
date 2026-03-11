/**
 * 投标组合服务
 *
 * 负责将章节库中的章节组合为完整投标文件
 */

require('dotenv').config()

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const logger = require('../utils/logger')

const prisma = new PrismaClient()

class BidCompositionService {
  // ======================== 组合 CRUD ========================

  async create(data) {
    const id = `bidcomp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const composition = await prisma.bid_compositions.create({
      data: {
        id,
        name: data.name,
        tender_id: data.tenderId || null,
        description: data.description || null,
        template_name: data.templateName || null,
        status: 'draft',
        created_by: data.createdBy || null,
      },
    })
    logger.info(`[投标组合] 创建成功: ${data.name} (${id})`)
    return composition
  }

  async getList(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize
    const [list, total] = await Promise.all([
      prisma.bid_compositions.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        include: {
          tender_documents: { select: { name: true, project_name: true } },
          _count: { select: { bid_composition_items: true } },
        },
      }),
      prisma.bid_compositions.count(),
    ])
    return { list, total, page, pageSize }
  }

  async getDetail(compositionId) {
    const composition = await prisma.bid_compositions.findUnique({
      where: { id: compositionId },
      include: {
        tender_documents: { select: { name: true, project_name: true, analysis_result: true } },
        bid_composition_items: {
          orderBy: { sort_order: 'asc' },
          include: {
            bid_sections: {
              select: { title: true, section_type: true, quality_score: true, bid_document_id: true },
            },
          },
        },
      },
    })
    if (!composition) throw new Error('组合不存在')
    return composition
  }

  async update(compositionId, data) {
    const existing = await prisma.bid_compositions.findUnique({ where: { id: compositionId } })
    if (!existing) throw new Error('组合不存在')

    const updateData = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status
    if (data.templateName !== undefined) updateData.template_name = data.templateName

    return prisma.bid_compositions.update({ where: { id: compositionId }, data: updateData })
  }

  async delete(compositionId) {
    const existing = await prisma.bid_compositions.findUnique({ where: { id: compositionId } })
    if (!existing) throw new Error('组合不存在')
    await prisma.bid_compositions.delete({ where: { id: compositionId } })
    return { success: true }
  }

  // ======================== 组合项管理 ========================

  /**
   * 添加章节到组合（引用已有章节 或 手写自定义内容）
   */
  async addItem(compositionId, data) {
    const composition = await prisma.bid_compositions.findUnique({ where: { id: compositionId } })
    if (!composition) throw new Error('组合不存在')

    // 获取当前最大 sort_order
    const maxOrder = await prisma.bid_composition_items.aggregate({
      where: { composition_id: compositionId },
      _max: { sort_order: true },
    })

    const id = `bidcompitem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const item = await prisma.bid_composition_items.create({
      data: {
        id,
        composition_id: compositionId,
        section_id: data.sectionId || null,
        title: data.title,
        custom_content: data.customContent || null,
        sort_order: data.sortOrder ?? ((maxOrder._max.sort_order || 0) + 1),
        level: data.level || 1,
        source_type: data.sectionId ? 'reference' : 'custom',
      },
    })
    return item
  }

  /**
   * 批量添加（从招标目录一键导入）
   */
  async addItemsFromDirectory(compositionId, tenderId) {
    const composition = await prisma.bid_compositions.findUnique({ where: { id: compositionId } })
    if (!composition) throw new Error('组合不存在')

    const dirItems = await prisma.bid_directory_items.findMany({
      where: { tender_id: tenderId },
      orderBy: [{ level: 'asc' }, { sort_order: 'asc' }],
    })

    const created = []
    for (let i = 0; i < dirItems.length; i++) {
      const dir = dirItems[i]
      const id = `bidcompitem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const item = await prisma.bid_composition_items.create({
        data: {
          id,
          composition_id: compositionId,
          title: dir.title,
          custom_content: dir.user_content || dir.default_content || null,
          sort_order: i,
          level: dir.level,
          source_type: dir.default_content ? 'ai_generated' : 'custom',
        },
      })
      created.push(item)
      await new Promise(r => setTimeout(r, 5))
    }

    return { count: created.length }
  }

  async updateItem(itemId, data) {
    const existing = await prisma.bid_composition_items.findUnique({ where: { id: itemId } })
    if (!existing) throw new Error('组合项不存在')

    const updateData = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.customContent !== undefined) updateData.custom_content = data.customContent
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder
    if (data.level !== undefined) updateData.level = data.level

    return prisma.bid_composition_items.update({ where: { id: itemId }, data: updateData })
  }

  async removeItem(itemId) {
    const existing = await prisma.bid_composition_items.findUnique({ where: { id: itemId } })
    if (!existing) throw new Error('组合项不存在')
    await prisma.bid_composition_items.delete({ where: { id: itemId } })
    return { success: true }
  }

  /**
   * 批量排序
   */
  async reorderItems(compositionId, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await prisma.bid_composition_items.update({
        where: { id: orderedIds[i] },
        data: { sort_order: i },
      })
    }
    return { success: true, count: orderedIds.length }
  }
}

module.exports = new BidCompositionService()
