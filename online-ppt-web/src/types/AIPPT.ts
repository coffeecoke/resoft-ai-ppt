// ===================== 基础页面类型 =====================

export interface AIPPTCover {
  type: 'cover'
  data: {
    title: string
    text: string
  }
}

export interface AIPPTContents {
  type: 'contents'
  data: {
    items: string[]
  }
  offset?: number
}

export interface AIPPTTransition {
  type: 'transition'
  data: {
    title: string
    text: string
  }
}

export interface AIPPTContent {
  type: 'content'
  data: {
    title: string
    items: {
      title: string
      text: string
    }[]
  },
  offset?: number
}

export interface AIPPTEnd {
  type: 'end'
}

// ===================== 方案A扩展类型 =====================

/**
 * 图文页 - 一侧文字，一侧图片
 * 适用于：产品介绍、功能说明、案例展示
 */
export interface AIPPTTextImage {
  type: 'text_image'
  data: {
    title: string           // 页面标题
    text: string            // 主要文字内容（支持多段）
    imagePosition: 'left' | 'right'  // 图片位置
    imageDesc?: string      // 图片描述（可选，用于AI配图提示）
  }
}

/**
 * 对比页 - 左右两列对比内容
 * 适用于：方案对比、优劣势分析、Before/After
 */
export interface AIPPTComparison {
  type: 'comparison'
  data: {
    title: string           // 页面标题
    leftTitle: string       // 左侧标题（如"方案A"/"优势"/"Before"）
    leftItems: string[]     // 左侧要点列表
    rightTitle: string      // 右侧标题（如"方案B"/"劣势"/"After"）
    rightItems: string[]    // 右侧要点列表
  }
}

/**
 * 时间线页 - 展示时间顺序的事件或流程
 * 适用于：发展历程、项目里程碑、流程步骤
 */
export interface AIPPTTimeline {
  type: 'timeline'
  data: {
    title: string           // 页面标题
    items: {
      time: string          // 时间点（如"2020年"/"第一阶段"/"Step 1"）
      event: string         // 事件/内容描述
    }[]
  }
}

/**
 * 数据统计页 - 展示关键数据指标
 * 适用于：业绩展示、数据汇报、成果总结
 */
export interface AIPPTStatistics {
  type: 'statistics'
  data: {
    title: string           // 页面标题
    items: {
      value: string         // 数值（如"98%"/"1000万"/"50+"）
      label: string         // 数值说明（如"客户满意度"/"用户数量"）
      trend?: 'up' | 'down' | 'stable'  // 趋势（可选）
    }[]
  }
}

/**
 * 引用/金句页 - 展示名言、金句、重要观点
 * 适用于：名人名言、核心观点、关键结论
 */
export interface AIPPTQuote {
  type: 'quote'
  data: {
    quote: string           // 引用内容
    author?: string         // 作者/来源（可选）
    title?: string          // 作者头衔/出处（可选）
  }
}

// ===================== 联合类型 =====================

export type AIPPTSlide = 
  | AIPPTCover 
  | AIPPTContents 
  | AIPPTTransition 
  | AIPPTContent 
  | AIPPTEnd
  // 方案A扩展类型
  | AIPPTTextImage
  | AIPPTComparison
  | AIPPTTimeline
  | AIPPTStatistics
  | AIPPTQuote