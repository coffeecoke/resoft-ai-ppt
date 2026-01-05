import { Router } from 'express'
import { documentService } from '../../services/documentService.js'
import { thumbnailService } from '../../services/thumbnailService.js'

const router = Router()

/**
 * 获取默认PPT列表（未选择产品时）
 * GET /api/sales/documents
 * 
 * Query参数：
 * - status: 文档状态（默认: published）
 * - tag: 文档标签（public=公版, practical=实战版）
 * - page: 页码（默认: 1）
 * - pageSize: 每页数量（默认: 20）
 * - keyword: 搜索关键词
 * - industry: 行业筛选（可传多个，用逗号分隔）
 * - audience: 交流对象筛选（可传多个，用逗号分隔）
 * - language: 语言筛选（可传多个，用逗号分隔）
 * - sortBy: 排序字段（默认: updatedAt）
 * - order: 排序方式（asc/desc，默认: desc）
 */
router.get('/', async (req, res) => {
  try {
    const {
      status = 'published',
      tag,
      page = 1,
      pageSize = 20,
      keyword,
      industry,
      audience,
      language,
      sortBy = 'updated_at',
      order = 'desc',
    } = req.query

    // 获取所有文档
    let list = await documentService.getAll({ status, tag })

    // 应用高级筛选
    let filtered = list
    
    // 1. 关键词搜索（匹配名称或客户名称）
    if (keyword && typeof keyword === 'string') {
      const k = keyword.toLowerCase()
      filtered = filtered.filter(item => {
        const name = (item.name || '').toLowerCase()
        const customerName = (item.customerName || '').toLowerCase()
        return name.includes(k) || customerName.includes(k)
      })
    }

    // 2. 行业筛选（支持多选，满足任一即可）
    if (industry && typeof industry === 'string') {
      const industries = industry.split(',').map(i => i.trim()).filter(Boolean)
      if (industries.length > 0) {
        filtered = filtered.filter(item => {
          if (!item.industry || !Array.isArray(item.industry)) return false
          return industries.some(filterIndustry => 
            item.industry.includes(filterIndustry)
          )
        })
      }
    }

    // 3. 交流对象筛选（支持多选，满足任一即可）
    if (audience && typeof audience === 'string') {
      const audiences = audience.split(',').map(a => a.trim()).filter(Boolean)
      if (audiences.length > 0) {
        filtered = filtered.filter(item => {
          if (!item.audience || !Array.isArray(item.audience)) return false
          return audiences.some(filterAudience => 
            item.audience.includes(filterAudience)
          )
        })
      }
    }

    // 4. 语言筛选（支持多选，满足任一即可）
    if (language && typeof language === 'string') {
      const languages = language.split(',').map(l => l.trim()).filter(Boolean)
      if (languages.length > 0) {
        filtered = filtered.filter(item => {
          if (!item.language) return false
          return languages.includes(item.language)
        })
      }
    }

    // 排序
    filtered.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]

      if (sortBy === 'name') {
        aVal = (aVal || '').toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }

      if (order === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    // 分页
    const p = Number(page) || 1
    const ps = Number(pageSize) || 20
    const start = (p - 1) * ps
    const end = start + ps
    const pageList = filtered.slice(start, end)

    // 检查并修复封面：如果cover为空或地址不正确，从缩略图获取第一张
    for (const doc of pageList) {
      if (!doc.cover || doc.cover.trim() === '' || !doc.cover.startsWith('/snapshots/')) {
        try {
          const thumbnailResult = await thumbnailService.getByDocumentId(doc.id)
          if (thumbnailResult.thumbnails && thumbnailResult.thumbnails.length > 0) {
            // 按 slideIndex 排序，取第一张（slideIndex = 0）
            const firstThumbnail = thumbnailResult.thumbnails.find(t => t.slideIndex === 0) || thumbnailResult.thumbnails[0]
            if (firstThumbnail && firstThumbnail.url) {
              doc.cover = firstThumbnail.url
              // 同时更新数据库中的cover字段（异步，不阻塞响应）
              documentService.update(doc.id, { cover: firstThumbnail.url }).catch(err => {
                console.warn(`[Sales文档] 更新封面失败: ${doc.id}`, err.message)
              })
            }
          }
        } catch (error) {
          console.warn(`[Sales文档] 获取缩略图失败: ${doc.id}`, error.message)
        }
      }
    }

    res.json({
      success: true,
      data: {
        documents: pageList,
        pagination: {
          total: filtered.length,
          page: p,
          pageSize: ps,
          totalPages: Math.ceil(filtered.length / ps)
        }
      }
    })
  } catch (error) {
    console.error('[Sales文档] 获取列表失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取文档列表失败' })
  }
})

/**
 * 获取产品关联的PPT列表
 * GET /api/sales/documents/by-product/:productId
 * 
 * Query参数：
 * - catalogId: 目录ID（可选，筛选特定目录的文档）
 * - version: 版本（public=公版, practical=实战版）
 * - page: 页码
 * - pageSize: 每页数量
 */
router.get('/by-product/:productId', async (req, res) => {
  try {
    const { productId } = req.params
    const {
      catalogId,
      version,
      page = 1,
      pageSize = 20,
    } = req.query

    // TODO: 实现产品关联文档查询
    // 这需要先实现 ProductDocument 相关的 model 和 service
    res.json({
      success: true,
      data: {
        documents: [],
        pagination: {
          total: 0,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: 0
        }
      },
      message: '产品关联文档查询功能待实现'
    })
  } catch (error) {
    console.error('[Sales文档] 获取产品文档失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取产品文档失败' })
  }
})

export default router

