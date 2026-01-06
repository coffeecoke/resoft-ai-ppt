/**
 * AI模型配置服务
 * 统一管理所有AI模型的配置信息
 */

const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const crypto = require('../utils/crypto');
const { v4: uuidv4 } = require('uuid');

class ModelConfigService {
  /**
   * 获取指定场景的默认模型配置
   * @param {string} sceneType - 场景类型
   * @returns {Promise<Object>} 模型配置
   */
  async getDefaultModel(sceneType) {
    try {
      const config = await prisma.ai_model_configs.findFirst({
        where: {
          scene_type: sceneType,
          is_default: true,
          is_active: true,
        },
      });

      if (!config) {
        throw new Error(`未找到场景 ${sceneType} 的默认模型配置`);
      }

      // 解密敏感信息
      const decryptedConfig = this.decryptConfig(config);
      
      // 处理BigInt序列化问题
      return {
        ...decryptedConfig,
        total_tokens: decryptedConfig.total_tokens ? Number(decryptedConfig.total_tokens) : 0,
      };
    } catch (error) {
      logger.error(`获取默认模型失败 [${sceneType}]:`, error.message);
      throw error;
    }
  }

  /**
   * 根据ID获取模型配置
   * @param {string} id - 模型ID
   * @returns {Promise<Object>}
   */
  async getModelById(id) {
    try {
      const config = await prisma.ai_model_configs.findUnique({
        where: { id },
      });

      if (!config) {
        throw new Error(`模型配置不存在: ${id}`);
      }

      return this.decryptConfig(config);
    } catch (error) {
      logger.error(`获取模型配置失败 [${id}]:`, error.message);
      throw error;
    }
  }

  /**
   * 获取指定场景的所有可用模型
   * @param {string} sceneType - 场景类型
   * @returns {Promise<Array>}
   */
  async getModelsByScene(sceneType) {
    try {
      const configs = await prisma.ai_model_configs.findMany({
        where: {
          scene_type: sceneType,
          is_active: true,
        },
        orderBy: [{ is_default: 'desc' }, { sort_order: 'asc' }],
      });

      // 返回时掩码显示敏感信息
      return configs.map(config => this.maskSensitiveInfo(config));
    } catch (error) {
      logger.error(`获取场景模型列表失败 [${sceneType}]:`, error.message);
      throw error;
    }
  }

  /**
   * 获取所有模型配置
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>}
   */
  async getAllModels(options = {}) {
    try {
      const where = {};
      
      if (options.scene_type) {
        where.scene_type = options.scene_type;
      }
      
      if (options.provider) {
        where.provider = options.provider;
      }
      
      if (options.is_active !== undefined) {
        where.is_active = options.is_active;
      }

      const configs = await prisma.ai_model_configs.findMany({
        where,
        orderBy: [
          { scene_type: 'asc' },
          { is_default: 'desc' },
          { sort_order: 'asc' },
        ],
      });

      return configs.map(config => this.maskSensitiveInfo(config));
    } catch (error) {
      logger.error('获取所有模型配置失败:', error.message);
      throw error;
    }
  }

  /**
   * 创建或更新模型配置
   * @param {Object} data - 模型配置数据
   * @returns {Promise<Object>}
   */
  async upsertModelConfig(data) {
    try {
      // 加密敏感信息
      const encryptedData = this.encryptConfig(data);

      let result;
      
      // 判断是更新还是创建（id存在且不为空字符串）
      if (data.id && data.id.trim()) {
        // 更新
        result = await prisma.ai_model_configs.update({
          where: { id: data.id },
          data: {
            ...encryptedData,
            updated_at: new Date(),
          },
        });
        
        logger.success(`模型配置已更新: ${data.name}`);
      } else {
        // 创建 - 删除可能存在的空id字段，使用新生成的UUID
        delete encryptedData.id;
        
        result = await prisma.ai_model_configs.create({
          data: {
            id: uuidv4(),
            ...encryptedData,
          },
        });
        
        logger.success(`模型配置已创建: ${data.name}`);
      }

      return this.maskSensitiveInfo(result);
    } catch (error) {
      logger.error('保存模型配置失败:', error.message);
      throw error;
    }
  }

  /**
   * 设置默认模型
   * @param {string} id - 模型ID
   * @param {string} sceneType - 场景类型
   * @returns {Promise<Object>}
   */
  async setDefaultModel(id, sceneType) {
    try {
      // 使用事务确保数据一致性
      const result = await prisma.$transaction(async (tx) => {
        // 1. 取消该场景所有模型的默认状态
        await tx.ai_model_configs.updateMany({
          where: { scene_type: sceneType },
          data: { is_default: false },
        });

        // 2. 设置新的默认模型
        const updated = await tx.ai_model_configs.update({
          where: { id },
          data: { is_default: true },
        });

        return updated;
      });

      logger.success(`已设置默认模型 [${sceneType}]: ${result.name}`);
      return this.maskSensitiveInfo(result);
    } catch (error) {
      logger.error(`设置默认模型失败 [${id}]:`, error.message);
      throw error;
    }
  }

  /**
   * 删除模型配置
   * @param {string} id - 模型ID
   * @returns {Promise<void>}
   */
  async deleteModel(id) {
    try {
      const config = await prisma.ai_model_configs.findUnique({
        where: { id },
      });

      if (!config) {
        throw new Error('模型配置不存在');
      }

      if (config.is_default) {
        throw new Error('无法删除默认模型，请先设置其他模型为默认');
      }

      await prisma.ai_model_configs.delete({
        where: { id },
      });

      logger.success(`模型配置已删除: ${config.name}`);
    } catch (error) {
      logger.error(`删除模型配置失败 [${id}]:`, error.message);
      throw error;
    }
  }

  /**
   * 更新模型调用统计
   * @param {string} id - 模型ID
   * @param {number} tokenCount - 消耗的token数
   */
  async updateCallStats(id, tokenCount = 0) {
    try {
      await prisma.ai_model_configs.update({
        where: { id },
        data: {
          total_calls: { increment: 1 },
          total_tokens: { increment: tokenCount },
          last_check_at: new Date(),
          error_count: 0, // 成功调用后重置错误计数
          is_available: true,
        },
      });
    } catch (error) {
      logger.warn(`更新调用统计失败 [${id}]:`, error.message);
    }
  }

  /**
   * 记录模型调用错误
   * @param {string} id - 模型ID
   * @param {Error} error - 错误对象
   */
  async recordError(id, error) {
    try {
      const config = await prisma.ai_model_configs.findUnique({
        where: { id },
      });

      if (!config) return;

      const newErrorCount = config.error_count + 1;
      const isAvailable = newErrorCount < 5; // 连续5次错误后标记为不可用

      await prisma.ai_model_configs.update({
        where: { id },
        data: {
          error_count: newErrorCount,
          is_available: isAvailable,
          last_check_at: new Date(),
        },
      });

      if (!isAvailable) {
        logger.warn(`模型 ${config.name} 已标记为不可用（连续${newErrorCount}次错误）`);
      }
    } catch (err) {
      logger.warn(`记录错误失败 [${id}]:`, err.message);
    }
  }

  /**
   * 加密配置中的敏感信息
   * 注意：当前版本不启用加密，直接返回原始数据
   * @param {Object} config - 配置对象
   * @returns {Object}
   */
  encryptConfig(config) {
    // 不加密，直接返回原始配置
    return { ...config };
  }

  /**
   * 解密配置中的敏感信息
   * 注意：当前版本不启用解密，直接返回原始数据
   * @param {Object} config - 配置对象
   * @returns {Object}
   */
  decryptConfig(config) {
    if (!config) return null;

    // 不解密，直接返回原始配置
    const result = { ...config };

    return result;
  }

  /**
   * 掩码显示敏感信息
   * @param {Object} config - 配置对象
   * @returns {Object}
   */
  maskSensitiveInfo(config) {
    if (!config) return null;

    const result = { ...config };

    if (config.api_key) {
      result.api_key_masked = crypto.mask(config.api_key, 4);
      delete result.api_key; // 不返回原始密钥
    }

    if (config.api_secret) {
      result.api_secret_masked = crypto.mask(config.api_secret, 4);
      delete result.api_secret;
    }
    
    // 转换BigInt为Number以支持JSON序列化
    if (config.total_tokens !== null && config.total_tokens !== undefined) {
      result.total_tokens = Number(config.total_tokens);
    }

    return result;
  }

  /**
   * 获取场景统计信息
   * @returns {Promise<Array>}
   */
  async getSceneStatistics() {
    try {
      const stats = await prisma.ai_model_configs.groupBy({
        by: ['scene_type'],
        _count: {
          id: true,
        },
        _sum: {
          total_calls: true,
          total_tokens: true,
        },
        where: {
          is_active: true,
        },
      });

      return stats.map(stat => ({
        scene_type: stat.scene_type,
        model_count: stat._count.id,
        total_calls: stat._sum.total_calls || 0,
        total_tokens: stat._sum.total_tokens ? Number(stat._sum.total_tokens) : 0, // 转换BigInt
      }));
    } catch (error) {
      logger.error('获取场景统计失败:', error.message);
      throw error;
    }
  }
}

module.exports = new ModelConfigService();

