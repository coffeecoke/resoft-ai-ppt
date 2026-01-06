/**
 * 服务层统一导出
 */

module.exports = {
  // 模型配置服务
  modelConfigService: require('./modelConfigService'),
  
  // 提示词模板服务
  promptTemplateService: require('./promptTemplateService'),
  
  // 统一AI调用服务
  aiService: require('./aiServiceUnified'),
  
  // 原有服务（向后兼容）
  aiServiceLegacy: require('./aiService'),
};

