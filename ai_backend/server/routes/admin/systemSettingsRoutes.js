/**
 * 系统设置API路由
 * 提供系统级别的配置和统计信息
 */

const express = require('express');
const router = express.Router();
const { modelConfigService, promptTemplateService } = require('../../services');
const logger = require('../../utils/logger');

/**
 * @api {get} /api/admin/system/scenes 获取所有场景类型列表
 */
router.get('/scenes', async (req, res) => {
  try {
    // 场景类型枚举
    const scenes = [
      {
        code: 'transcription',
        name: '语音转文本',
        description: '语音转录后的内容分析和提取',
        icon: 'audio',
      },
      {
        code: 'ppt_analysis',
        name: 'PPT分析',
        description: 'PPT页面分类和内容识别',
        icon: 'presentation',
      },
      {
        code: 'document_extract',
        name: '文档提取',
        description: '文档内容提取和解析',
        icon: 'document',
      },
      {
        code: 'document_manage',
        name: '文档管理',
        description: '文档智能分类和管理',
        icon: 'folder',
      },
      {
        code: 'general',
        name: '通用',
        description: '通用对话和文本处理',
        icon: 'chat',
      },
      {
        code: 'transcription_correction',
        name: '语音转录纠错',
        description: '语音转录后的文本纠错和修正',
        icon: 'edit',
      },
      {
        code: 'role_judgment',
        name: '角色判断',
        description: '对话中说话人角色判断（客户方/我方）',
        icon: 'user',
      },
    ];
    
    // 获取各场景的统计信息
    const modelStats = await modelConfigService.getSceneStatistics();
    const promptStats = await promptTemplateService.getSceneStatistics();
    
    // 合并统计信息
    const scenesWithStats = scenes.map(scene => {
      const modelStat = modelStats.find(s => s.scene_type === scene.code) || {};
      const promptStat = promptStats.find(s => s.scene_type === scene.code) || {};
      
      return {
        ...scene,
        model_count: modelStat.model_count || 0,
        template_count: promptStat.template_count || 0,
        total_calls: modelStat.total_calls || 0,
        total_tokens: modelStat.total_tokens ? Number(modelStat.total_tokens) : 0, // 转换BigInt
      };
    });
    
    res.json({
      success: true,
      data: scenesWithStats,
    });
  } catch (error) {
    logger.error('获取场景列表失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/system/providers 获取所有AI提供商列表
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = [
      {
        code: 'xfyun',
        name: '讯飞星火',
        description: '科大讯飞推出的大语言模型',
        website: 'https://www.xfyun.cn',
        models: ['spark-v3.5', 'spark-v3.0', 'spark-v2.0'],
      },
      {
        code: 'openai',
        name: 'OpenAI',
        description: 'OpenAI官方API',
        website: 'https://openai.com',
        models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
      },
      {
        code: 'qwen',
        name: '通义千问',
        description: '阿里云推出的大语言模型',
        website: 'https://tongyi.aliyun.com',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
      },
      {
        code: 'baidu',
        name: '文心一言',
        description: '百度推出的大语言模型',
        website: 'https://yiyan.baidu.com',
        models: ['ernie-bot-4', 'ernie-bot-turbo'],
      },
      {
        code: 'custom',
        name: '自定义',
        description: '自定义OpenAI兼容接口',
        website: '',
        models: [],
      },
    ];
    
    res.json({
      success: true,
      data: providers,
    });
  } catch (error) {
    logger.error('获取提供商列表失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/system/stats 获取系统统计信息
 */
router.get('/stats', async (req, res) => {
  try {
    const prisma = require('../../utils/prisma');
    
    // 获取各项统计
    const [
      totalModels,
      activeModels,
      totalPrompts,
      activePrompts,
      sceneStats,
    ] = await Promise.all([
      prisma.ai_model_configs.count(),
      prisma.ai_model_configs.count({ where: { is_active: true } }),
      prisma.prompt_templates.count(),
      prisma.prompt_templates.count({ where: { is_active: true } }),
      modelConfigService.getSceneStatistics(),
    ]);
    
    // 计算总调用次数和消耗tokens
    const totalCalls = sceneStats.reduce((sum, s) => sum + (s.total_calls || 0), 0);
    const totalTokens = sceneStats.reduce((sum, s) => {
      const tokens = s.total_tokens ? Number(s.total_tokens) : 0;
      return sum + tokens;
    }, 0);
    
    res.json({
      success: true,
      data: {
        models: {
          total: totalModels,
          active: activeModels,
        },
        prompts: {
          total: totalPrompts,
          active: activePrompts,
        },
        usage: {
          total_calls: totalCalls,
          total_tokens: totalTokens,
        },
        scenes: sceneStats.map(s => ({
          ...s,
          total_tokens: s.total_tokens ? Number(s.total_tokens) : 0,
        })),
      },
    });
  } catch (error) {
    logger.error('获取系统统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @api {get} /api/admin/system/health 健康检查
 */
router.get('/health', async (req, res) => {
  try {
    const prisma = require('../../utils/prisma');
    
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      },
    });
  } catch (error) {
    logger.error('健康检查失败:', error.message);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message,
      },
    });
  }
});

module.exports = router;

