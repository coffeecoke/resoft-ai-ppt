/**
 * 产品管理API路由
 */

const express = require('express');
const router = express.Router();
const productsService = require('../services/productsService');

// BigInt序列化处理
const replacer = (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

/**
 * GET /api/products
 * 获取产品列表
 * Query参数:
 *   - isActive: boolean (可选) 是否只获取启用的产品
 *   - category: string (可选) 产品分类
 *   - page: number (可选) 页码，默认1
 *   - limit: number (可选) 每页数量，默认50
 */
router.get('/', async (req, res) => {
  try {
    const { isActive, category, page, limit } = req.query;
    
    const filters = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    };

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    
    if (category) {
      filters.category = category;
    }

    const result = await productsService.getProducts(filters);
    
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(result, replacer))
    });
  } catch (error) {
    console.error('获取产品列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/statistics
 * 获取产品统计信息
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await productsService.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取产品统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/:id
 * 获取单个产品详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productsService.getProductById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: '产品不存在'
      });
    }
    
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(product, replacer))
    });
  } catch (error) {
    console.error('获取产品详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/products
 * 创建产品
 * Body参数:
 *   - name: string (必填) 产品名称
 *   - code: string (可选) 产品代码（唯一）
 *   - description: string (可选) 产品描述
 *   - category: string (可选) 产品分类
 *   - tags: array (可选) 产品标签
 *   - icon: string (可选) 产品图标URL
 *   - cover: string (可选) 产品封面图URL
 *   - sortOrder: number (可选) 排序字段
 *   - isActive: boolean (可选) 是否启用
 */
router.post('/', async (req, res) => {
  try {
    const product = await productsService.createProduct(req.body);
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(product, replacer)),
      message: '产品创建成功'
    });
  } catch (error) {
    console.error('创建产品失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/products/:id
 * 更新产品
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productsService.updateProduct(id, req.body);
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(product, replacer)),
      message: '产品更新成功'
    });
  } catch (error) {
    console.error('更新产品失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/products/:id
 * 删除产品
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await productsService.deleteProduct(id);
    res.json(result);
  } catch (error) {
    console.error('删除产品失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/products/sort-order
 * 批量更新排序
 * Body参数:
 *   - items: [{id: string, sortOrder: number}]
 */
router.patch('/sort-order', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'items必须是数组'
      });
    }
    
    await productsService.updateSortOrder(items);
    res.json({
      success: true,
      message: '排序更新成功'
    });
  } catch (error) {
    console.error('更新排序失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

