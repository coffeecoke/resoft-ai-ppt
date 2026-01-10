/**
 * 提示词模板管理API路由
 * 提供提示词模板的增删改查功能
 */

const express = require('express');
const router = express.Router();
const { promptTemplateService } = require('../../services');
const logger = require('../../utils/logger');

/**
 * @api {get} /api/admin/prompts 获取所有提示词模板
 * @query {string} scene_type - 可选：按场景类型筛选
 * @query {string} type - 可选：按模板类型筛选
 * @query {boolean} is_active - 可选：按状态筛选
 */
router.get('/', async (req, res) => {
  try {
    const { scene_type, type, is_active } = req.query;
    
    const options = {};
    if (scene_type) options.scene_type = scene_type;
    if (type) options.type = type;
    if (is_active !== undefined) options.is_active = is_active === 'true';
    
    const templates = await promptTemplateService.getAllTemplates(options);
    
    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    logger.error('获取提示词模板列表失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/prompts/scenes/:sceneType 获取指定场景的提示词模板
 */
router.get('/scenes/:sceneType', async (req, res) => {
  try {
    const { sceneType } = req.params;
    const templates = await promptTemplateService.getTemplatesByScene(sceneType);
    
    res.json({
      success: true,
      data: templates,
      scene_type: sceneType,
    });
  } catch (error) {
    logger.error(`获取场景模板列表失败 [${req.params.sceneType}]:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/prompts/:id 获取指定提示词模板
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.prompt_templates.findUnique({
      where: { id },
    });
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: '模板不存在',
      });
    }
    
    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error(`获取提示词模板失败 [${req.params.id}]:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {post} /api/admin/prompts 创建提示词模板
 * @body {Object} 模板数据
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    
    // 如果缺少 type 字段，使用 scene_type 的值
    if (!data.type && data.scene_type) {
      data.type = data.scene_type;
    }
    
    // 验证必填字段
    const requiredFields = ['name', 'code', 'type', 'prompt'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `缺少必填字段: ${missingFields.join(', ')}`,
      });
    }
    
    const result = await promptTemplateService.upsertPromptTemplate(data);
    
    res.status(201).json({
      success: true,
      data: result,
      message: '提示词模板已创建',
    });
  } catch (error) {
    logger.error('创建提示词模板失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {put} /api/admin/prompts/:id 更新提示词模板
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body, id };
    
    // 如果缺少 type 字段，使用 scene_type 的值
    if (!data.type && data.scene_type) {
      data.type = data.scene_type;
    }
    
    const result = await promptTemplateService.upsertPromptTemplate(data);
    
    res.json({
      success: true,
      data: result,
      message: '提示词模板已更新',
    });
  } catch (error) {
    logger.error(`更新提示词模板失败 [${req.params.id}]:`, error.message);
    
    // 处理唯一约束冲突
    if (error.message.includes('模板代码') || error.message.includes('code')) {
      return res.status(400).json({
        success: false,
        error: '模板代码已存在，请使用不同的代码',
        field: 'code',
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {delete} /api/admin/prompts/:id 删除提示词模板
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await promptTemplateService.deleteTemplate(id);
    
    res.json({
      success: true,
      message: '提示词模板已删除',
    });
  } catch (error) {
    logger.error(`删除提示词模板失败 [${req.params.id}]:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {post} /api/admin/prompts/:id/duplicate 复制模板（创建新版本）
 * @body {Object} overrides - 覆盖字段
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const overrides = req.body;
    
    const result = await promptTemplateService.duplicateTemplate(id, overrides);
    
    res.status(201).json({
      success: true,
      data: result,
      message: '模板已复制',
    });
  } catch (error) {
    logger.error(`复制提示词模板失败 [${req.params.id}]:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {post} /api/admin/prompts/test/render 测试提示词渲染
 * @body {string} template - 模板字符串
 * @body {Object} variables - 变量对象
 */
router.post('/test/render', async (req, res) => {
  try {
    const { template, variables } = req.body;
    
    if (!template) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: template',
      });
    }
    
    const result = promptTemplateService.validateRender(template, variables || {});
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('测试提示词渲染失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {post} /api/admin/prompts/test/extract 提取模板变量
 * @body {string} template - 模板字符串
 */
router.post('/test/extract', async (req, res) => {
  try {
    const { template } = req.body;
    
    if (!template) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: template',
      });
    }
    
    const variables = promptTemplateService.extractVariables(template);
    
    res.json({
      success: true,
      data: {
        variables,
        count: variables.length,
      },
    });
  } catch (error) {
    logger.error('提取模板变量失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/prompts/stats/scenes 获取场景统计信息
 */
router.get('/stats/scenes', async (req, res) => {
  try {
    const stats = await promptTemplateService.getSceneStatistics();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('获取场景统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;

