/**
 * 交流场次管理API路由
 */

const express = require('express');
const router = express.Router();
const sessionsService = require('../services/sessionsService');

// BigInt序列化处理
const replacer = (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

/**
 * GET /api/sessions
 * 获取场次列表
 * Query参数:
 *   - customerName: string (可选) 客户名称（模糊搜索）
 *   - productId: string (可选) 产品ID
 *   - status: string (可选) 状态
 *   - startDate: string (可选) 开始日期
 *   - endDate: string (可选) 结束日期
 *   - page: number (可选) 页码，默认1
 *   - limit: number (可选) 每页数量，默认50
 */
router.get('/', async (req, res) => {
  try {
    const { customerName, productId, status, startDate, endDate, page, limit } = req.query;
    
    const filters = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    };

    if (customerName) filters.customerName = customerName;
    if (productId) filters.productId = productId;
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const result = await sessionsService.getSessions(filters);
    
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(result, replacer))
    });
  } catch (error) {
    console.error('获取场次列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/statistics
 * 获取场次统计信息
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await sessionsService.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取场次统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/recent
 * 获取最近的场次
 * Query参数:
 *   - limit: number (可选) 数量限制，默认10
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const sessions = await sessionsService.getRecentSessions(limit);
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(sessions, replacer))
    });
  } catch (error) {
    console.error('获取最近场次失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id
 * 获取单个场次详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await sessionsService.getSessionById(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '场次不存在'
      });
    }
    
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(session, replacer))
    });
  } catch (error) {
    console.error('获取场次详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions
 * 创建场次
 * Body参数:
 *   - title: string (必填) 会议主题
 *   - customerName: string (必填) 客户名称
 *   - sessionDate: string (必填) 会议时间
 *   - duration: number (可选) 会议时长（分钟）
 *   - location: string (可选) 会议地点
 *   - videoUrl: string (可选) 视频录像URL
 *   - thumbnail: string (可选) 视频缩略图URL
 *   - participants: array (可选) 参与人员
 *   - productId: string (可选) 主要讨论的产品ID
 *   - industry: array (可选) 行业
 *   - status: string (可选) 状态
 *   - createdBy: string (可选) 创建人ID
 */
router.post('/', async (req, res) => {
  try {
    const session = await sessionsService.createSession(req.body);
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(session, replacer)),
      message: '场次创建成功'
    });
  } catch (error) {
    console.error('创建场次失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/sessions/:id
 * 更新场次
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await sessionsService.updateSession(id, req.body);
    res.json({
      success: true,
      data: JSON.parse(JSON.stringify(session, replacer)),
      message: '场次更新成功'
    });
  } catch (error) {
    console.error('更新场次失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sessions/:id
 * 删除场次
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sessionsService.deleteSession(id);
    res.json(result);
  } catch (error) {
    console.error('删除场次失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

