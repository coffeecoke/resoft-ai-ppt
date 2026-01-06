/**
 * 模型配置管理API路由
 * 提供模型配置的增删改查功能
 */

const express = require('express');
const router = express.Router();
const { modelConfigService } = require('../../services');
const logger = require('../../utils/logger');

/**
 * @api {get} /api/admin/models 获取所有模型配置
 * @query {string} scene_type - 可选：按场景类型筛选
 * @query {string} provider - 可选：按提供商筛选
 * @query {boolean} is_active - 可选：按状态筛选
 */
router.get('/', async (req, res) => {
  try {
    const { scene_type, provider, is_active } = req.query;
    
    const options = {};
    if (scene_type) options.scene_type = scene_type;
    if (provider) options.provider = provider;
    if (is_active !== undefined) options.is_active = is_active === 'true';
    
    const models = await modelConfigService.getAllModels(options);
    
    // 处理BigInt序列化问题
    const serializedModels = models.map(model => ({
      ...model,
      total_tokens: model.total_tokens ? Number(model.total_tokens) : 0,
    }));
    
    res.json({
      success: true,
      data: serializedModels,
      count: serializedModels.length,
    });
  } catch (error) {
    logger.error('获取模型配置列表失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/models/scenes/:sceneType 获取指定场景的模型配置
 */
router.get('/scenes/:sceneType', async (req, res) => {
  try {
    const { sceneType } = req.params;
    const models = await modelConfigService.getModelsByScene(sceneType);
    
    // 处理BigInt序列化问题
    const serializedModels = models.map(model => ({
      ...model,
      total_tokens: model.total_tokens ? Number(model.total_tokens) : 0,
    }));
    
    res.json({
      success: true,
      data: serializedModels,
      scene_type: sceneType,
    });
  } catch (error) {
    logger.error(`获取场景模型列表失败 [${req.params.sceneType}]:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/models/default/:sceneType 获取指定场景的默认模型
 */
router.get('/default/:sceneType', async (req, res) => {
  try {
    const { sceneType } = req.params;
    const model = await modelConfigService.getDefaultModel(sceneType);
    
    res.json({
      success: true,
      data: model,
    });
  } catch (error) {
    logger.error(`获取默认模型失败 [${req.params.sceneType}]:`, error.message);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/models/:id 获取指定模型配置
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const model = await modelConfigService.getModelById(id);
    
    res.json({
      success: true,
      data: modelConfigService.maskSensitiveInfo(model),
    });
  } catch (error) {
    logger.error(`获取模型配置失败 [${req.params.id}]:`, error.message);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {post} /api/admin/models 创建模型配置
 * @body {Object} 模型配置数据
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    
    // 验证必填字段
    const requiredFields = ['name', 'code', 'provider', 'model_name', 'api_url', 'api_key', 'scene_type'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `缺少必填字段: ${missingFields.join(', ')}`,
      });
    }
    
    const result = await modelConfigService.upsertModelConfig(data);
    
    res.status(201).json({
      success: true,
      data: result,
      message: '模型配置已创建',
    });
  } catch (error) {
    logger.error('创建模型配置失败:', error.message);
    
    // 处理唯一约束冲突
    if (error.message.includes('Unique constraint failed on the constraint: `ai_model_configs_code_key`')) {
      return res.status(400).json({
        success: false,
        error: '模型代码（code）已存在，请使用不同的代码',
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
 * @api {put} /api/admin/models/:id 更新模型配置
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body, id };
    
    const result = await modelConfigService.upsertModelConfig(data);
    
    res.json({
      success: true,
      data: result,
      message: '模型配置已更新',
    });
  } catch (error) {
    logger.error(`更新模型配置失败 [${req.params.id}]:`, error.message);
    
    // 处理唯一约束冲突
    if (error.message.includes('Unique constraint failed on the constraint: `ai_model_configs_code_key`')) {
      return res.status(400).json({
        success: false,
        error: '模型代码（code）已存在，请使用不同的代码',
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
 * @api {put} /api/admin/models/:id/set-default 设置为默认模型
 * @body {string} scene_type - 场景类型
 */
router.put('/:id/set-default', async (req, res) => {
  try {
    const { id } = req.params;
    const { scene_type } = req.body;
    
    if (!scene_type) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: scene_type',
      });
    }
    
    const result = await modelConfigService.setDefaultModel(id, scene_type);
    
    res.json({
      success: true,
      data: result,
      message: '已设置为默认模型',
    });
  } catch (error) {
    logger.error(`设置默认模型失败 [${req.params.id}]:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {delete} /api/admin/models/:id 删除模型配置
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await modelConfigService.deleteModel(id);
    
    res.json({
      success: true,
      message: '模型配置已删除',
    });
  } catch (error) {
    logger.error(`删除模型配置失败 [${req.params.id}]:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/models/stats/scenes 获取场景统计信息
 */
router.get('/stats/scenes', async (req, res) => {
  try {
    const stats = await modelConfigService.getSceneStatistics();
    
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

