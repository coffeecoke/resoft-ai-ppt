/**
 * 提示词模板服务
 * 统一管理所有AI功能的提示词模板
 */

const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class PromptTemplateService {
  /**
   * 获取指定场景的提示词模板
   * @param {string} sceneType - 场景类型
   * @param {Object} variables - 动态变量
   * @param {string} code - 可选：指定模板代码
   * @returns {Promise<string>} 渲染后的提示词
   */
  async getPrompt(sceneType, variables = {}, code = null) {
    try {
      const where = {
        scene_type: sceneType,
        is_active: true,
      };

      if (code) {
        where.code = code;
      }

      const template = await prisma.prompt_templates.findFirst({
        where,
        orderBy: { sort_order: 'asc' },
      });

      if (!template) {
        throw new Error(`未找到场景 ${sceneType} 的提示词模板`);
      }

      logger.debug(`使用提示词模板: ${template.name} (${template.code})`);

      // 渲染模板
      return this.renderTemplate(template.prompt, variables);
    } catch (error) {
      logger.error(`获取提示词失败 [${sceneType}]:`, error.message);
      throw error;
    }
  }

  /**
   * 根据代码获取模板
   * @param {string} code - 模板代码
   * @param {Object} variables - 动态变量
   * @returns {Promise<string>}
   */
  async getPromptByCode(code, variables = {}) {
    try {
      const template = await prisma.prompt_templates.findUnique({
        where: { code },
      });

      if (!template) {
        throw new Error(`模板不存在: ${code}`);
      }

      if (!template.is_active) {
        throw new Error(`模板已禁用: ${code}`);
      }

      return this.renderTemplate(template.prompt, variables);
    } catch (error) {
      logger.error(`获取提示词失败 [${code}]:`, error.message);
      throw error;
    }
  }

  /**
   * 渲染模板（替换动态变量）
   * 支持 {{variable}} 和 ${variable} 两种语法
   * @param {string} template - 模板字符串
   * @param {Object} variables - 变量对象
   * @returns {string}
   */
  renderTemplate(template, variables = {}) {
    if (!template) return '';

    let rendered = template;

    // 替换 {{variable}} 格式
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });

    // 替换 ${variable} 格式
    rendered = rendered.replace(/\$\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });

    return rendered;
  }

  /**
   * 获取所有模板列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>}
   */
  async getAllTemplates(options = {}) {
    try {
      const where = {};

      if (options.scene_type) {
        where.scene_type = options.scene_type;
      }

      if (options.type) {
        where.type = options.type;
      }

      if (options.is_active !== undefined) {
        where.is_active = options.is_active;
      }

      const templates = await prisma.prompt_templates.findMany({
        where,
        orderBy: [
          { scene_type: 'asc' },
          { sort_order: 'asc' },
          { created_at: 'desc' },
        ],
      });

      return templates;
    } catch (error) {
      logger.error('获取提示词模板列表失败:', error.message);
      throw error;
    }
  }

  /**
   * 根据场景获取模板列表
   * @param {string} sceneType - 场景类型
   * @returns {Promise<Array>}
   */
  async getTemplatesByScene(sceneType) {
    try {
      const templates = await prisma.prompt_templates.findMany({
        where: {
          scene_type: sceneType,
          is_active: true,
        },
        orderBy: { sort_order: 'asc' },
      });

      return templates;
    } catch (error) {
      logger.error(`获取场景模板列表失败 [${sceneType}]:`, error.message);
      throw error;
    }
  }

  /**
   * 创建或更新提示词模板
   * @param {Object} data - 模板数据
   * @returns {Promise<Object>}
   */
  async upsertPromptTemplate(data) {
    try {
      // 验证变量定义格式
      if (data.variables) {
        this.validateVariables(data.variables);
      }

      let result;

      logger.info('📋 开始保存提示词模板:', {
        id: data.id,
        name: data.name,
        code: data.code,
        isUpdate: !!(data.id && data.id.trim())
      });

      if (data.id && data.id.trim()) {
        // 更新模式
        
        // 获取当前记录
        const current = await prisma.prompt_templates.findUnique({
          where: { id: data.id },
        });
        
        if (!current) {
          throw new Error('模板不存在');
        }
        
        logger.info('📄 当前记录code:', current.code);
        logger.info('🆕 新提交code:', data.code);
        
        // 准备更新数据
        const updateData = { ...data };
        delete updateData.id; // 移除id字段，不能更新主键
        
        // 检查code是否改变
        if (data.code && data.code !== current.code) {
          logger.warn('⚠️ Code已改变，检查是否被占用...');
          
          // code改变了，检查新code是否被占用
          const existing = await prisma.prompt_templates.findUnique({
            where: { code: data.code },
          });
          
          if (existing) {
            logger.error('❌ Code已被占用:', data.code);
            throw new Error('模板代码已被其他模板使用');
          }
          
          logger.info('✅ Code可用，将更新code');
          // code可以更新，保留在updateData中
        } else {
          logger.info('✅ Code未改变，从更新数据中移除code字段');
          // code未改变，从更新数据中移除，避免触发唯一约束检查
          delete updateData.code;
        }
        
        updateData.updated_at = new Date();
        
        result = await prisma.prompt_templates.update({
          where: { id: data.id },
          data: updateData,
        });

        logger.success(`提示词模板已更新: ${data.name}`);
      } else {
        // 创建模式 - 删除可能存在的空id字段
        delete data.id;
        
        result = await prisma.prompt_templates.create({
          data: {
            id: uuidv4(),
            ...data,
          },
        });

        logger.success(`提示词模板已创建: ${data.name}`);
      }

      return result;
    } catch (error) {
      logger.error('保存提示词模板失败:', error.message);
      throw error;
    }
  }

  /**
   * 删除提示词模板
   * @param {string} id - 模板ID
   * @returns {Promise<void>}
   */
  async deleteTemplate(id) {
    try {
      const template = await prisma.prompt_templates.findUnique({
        where: { id },
      });

      if (!template) {
        throw new Error('模板不存在');
      }

      await prisma.prompt_templates.delete({
        where: { id },
      });

      logger.success(`提示词模板已删除: ${template.name}`);
    } catch (error) {
      logger.error(`删除提示词模板失败 [${id}]:`, error.message);
      throw error;
    }
  }

  /**
   * 复制模板（创建新版本）
   * @param {string} id - 源模板ID
   * @param {Object} overrides - 覆盖字段
   * @returns {Promise<Object>}
   */
  async duplicateTemplate(id, overrides = {}) {
    try {
      const source = await prisma.prompt_templates.findUnique({
        where: { id },
      });

      if (!source) {
        throw new Error('源模板不存在');
      }

      // 生成新的代码和名称
      const newVersion = this.incrementVersion(source.version);
      const newCode = overrides.code || `${source.code}_${newVersion.replace('.', '_')}`;
      const newName = overrides.name || `${source.name} (${newVersion})`;

      const newTemplate = await prisma.prompt_templates.create({
        data: {
          id: uuidv4(),
          name: newName,
          code: newCode,
          type: source.type,
          description: source.description,
          prompt: source.prompt,
          scene_type: source.scene_type,
          variables: source.variables,
          version: newVersion,
          is_active: false, // 新版本默认禁用
          sort_order: source.sort_order + 1,
          ...overrides,
        },
      });

      logger.success(`提示词模板已复制: ${newName}`);
      return newTemplate;
    } catch (error) {
      logger.error(`复制提示词模板失败 [${id}]:`, error.message);
      throw error;
    }
  }

  /**
   * 验证变量定义格式
   * @param {Array} variables - 变量定义数组
   */
  validateVariables(variables) {
    if (!Array.isArray(variables)) {
      throw new Error('variables 必须是数组');
    }

    variables.forEach((v, index) => {
      if (!v.name) {
        throw new Error(`variables[${index}] 缺少 name 字段`);
      }
      if (!v.type) {
        throw new Error(`variables[${index}] 缺少 type 字段`);
      }
      
      const validTypes = ['string', 'number', 'boolean', 'array', 'object'];
      if (!validTypes.includes(v.type)) {
        throw new Error(`variables[${index}].type 必须是以下之一: ${validTypes.join(', ')}`);
      }
    });
  }

  /**
   * 提取模板中使用的变量
   * @param {string} template - 模板字符串
   * @returns {Array<string>} 变量名数组
   */
  extractVariables(template) {
    if (!template) return [];

    const variables = new Set();

    // 提取 {{variable}} 格式
    const matches1 = template.matchAll(/\{\{(\w+)\}\}/g);
    for (const match of matches1) {
      variables.add(match[1]);
    }

    // 提取 ${variable} 格式
    const matches2 = template.matchAll(/\$\{(\w+)\}/g);
    for (const match of matches2) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * 验证模板渲染（测试）
   * @param {string} template - 模板字符串
   * @param {Object} variables - 变量对象
   * @returns {Object} 验证结果
   */
  validateRender(template, variables) {
    try {
      const usedVariables = this.extractVariables(template);
      const providedVariables = Object.keys(variables);

      const missing = usedVariables.filter(v => !providedVariables.includes(v));
      const unused = providedVariables.filter(v => !usedVariables.includes(v));

      const rendered = this.renderTemplate(template, variables);

      return {
        success: missing.length === 0,
        usedVariables,
        providedVariables,
        missing,
        unused,
        rendered,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 递增版本号
   * @param {string} version - 当前版本（如"1.0"）
   * @returns {string} 新版本（如"1.1"）
   */
  incrementVersion(version = '1.0') {
    const parts = version.split('.');
    const major = parseInt(parts[0]) || 1;
    const minor = parseInt(parts[1]) || 0;

    return `${major}.${minor + 1}`;
  }

  /**
   * 获取场景统计信息
   * @returns {Promise<Array>}
   */
  async getSceneStatistics() {
    try {
      const stats = await prisma.prompt_templates.groupBy({
        by: ['scene_type'],
        _count: {
          id: true,
        },
        where: {
          is_active: true,
        },
      });

      return stats.map(stat => ({
        scene_type: stat.scene_type,
        template_count: stat._count.id,
      }));
    } catch (error) {
      logger.error('获取场景统计失败:', error.message);
      throw error;
    }
  }
}

module.exports = new PromptTemplateService();

