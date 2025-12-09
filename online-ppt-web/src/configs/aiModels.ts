// AI模型配置，与后台保持一致
export const modelConfigs = {
  // ========== OpenAI ==========
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    envKey: 'OPENAI_API_KEY',
    envBaseUrl: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    envBaseUrl: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo',
    envKey: 'OPENAI_API_KEY',
    envBaseUrl: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  // ========== 智谱AI (GLM) ==========
  'GLM-4-Flash': {
    provider: 'zhipu',
    model: 'GLM-4-Flash',
    envKey: 'ZHIPU_API_KEY',
    envBaseUrl: 'ZHIPU_BASE_URL',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  'GLM-4.5-Flash': {
    provider: 'zhipu',
    model: 'glm-4-flash',
    envKey: 'ZHIPU_API_KEY',
    envBaseUrl: 'ZHIPU_BASE_URL',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  'GLM-4-Plus': {
    provider: 'zhipu',
    model: 'GLM-4-Plus',
    envKey: 'ZHIPU_API_KEY',
    envBaseUrl: 'ZHIPU_BASE_URL',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  // ========== 豆包 (字节跳动) ==========
  'ark-doubao-seed-1.6-flash': {
    provider: 'doubao',
    model: 'doubao-seed-1.6-flash',
    envKey: 'DOUBAO_API_KEY',
    envBaseUrl: 'DOUBAO_BASE_URL',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
  },
  'doubao-pro-32k': {
    provider: 'doubao',
    model: 'doubao-pro-32k',
    envKey: 'DOUBAO_API_KEY',
    envBaseUrl: 'DOUBAO_BASE_URL',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
  },
  // ========== 通义千问 (阿里云) ==========
  'qwen-turbo': {
    provider: 'qwen',
    model: 'qwen-turbo',
    envKey: 'QWEN_API_KEY',
    envBaseUrl: 'QWEN_BASE_URL',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  'qwen-plus': {
    provider: 'qwen',
    model: 'qwen-plus',
    envKey: 'QWEN_API_KEY',
    envBaseUrl: 'QWEN_BASE_URL',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  'qwen-max': {
    provider: 'qwen',
    model: 'qwen-max',
    envKey: 'QWEN_API_KEY',
    envBaseUrl: 'QWEN_BASE_URL',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  // ========== DeepSeek ==========
  'deepseek-chat': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    envBaseUrl: 'DEEPSEEK_BASE_URL',
    defaultBaseUrl: 'https://api.deepseek.com/v1'
  },
  // ========== 月之暗面 (Moonshot/Kimi) ==========
  'moonshot-v1-8k': {
    provider: 'moonshot',
    model: 'moonshot-v1-8k',
    envKey: 'MOONSHOT_API_KEY',
    envBaseUrl: 'MOONSHOT_BASE_URL',
    defaultBaseUrl: 'https://api.moonshot.cn/v1'
  },
  'moonshot-v1-32k': {
    provider: 'moonshot',
    model: 'moonshot-v1-32k',
    envKey: 'MOONSHOT_API_KEY',
    envBaseUrl: 'MOONSHOT_BASE_URL',
    defaultBaseUrl: 'https://api.moonshot.cn/v1'
  }
} as const

// 模型显示名称映射
export const modelLabels: Record<keyof typeof modelConfigs, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'GLM-4-Flash': 'GLM-4-Flash',
  'GLM-4.5-Flash': 'GLM-4.5-Flash',
  'GLM-4-Plus': 'GLM-4-Plus',
  'ark-doubao-seed-1.6-flash': '豆包 Seed 1.6 Flash',
  'doubao-pro-32k': '豆包 Pro 32K',
  'qwen-turbo': '通义千问 Turbo',
  'qwen-plus': '通义千问 Plus',
  'qwen-max': '通义千问 Max',
  'deepseek-chat': 'DeepSeek Chat',
  'moonshot-v1-8k': 'Moonshot v1 8K',
  'moonshot-v1-32k': 'Moonshot v1 32K'
}

// 生成模型选项列表
export const modelOptions = Object.keys(modelConfigs).map(key => ({
  label: modelLabels[key as keyof typeof modelLabels],
  value: key
}))

