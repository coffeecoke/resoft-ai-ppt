/**
 * 销售平台Mock数据配置
 * 统一管理所有硬编码的演示数据
 * 后续可替换为从API获取
 */

// ==================== 产品统计数据 ====================
export const productStats = [
  { name: '一表通', sessions: 124, ppts: 45, questions: 89 },
  { name: '1104', sessions: 98, ppts: 32, questions: 67 },
  { name: '受益所有人', sessions: 86, ppts: 28, questions: 45 },
  { name: '反洗钱', sessions: 112, ppts: 39, questions: 78 },
  { name: '金数', sessions: 145, ppts: 56, questions: 102 },
  { name: '金数数据质量', sessions: 76, ppts: 24, questions: 34 },
  { name: '监管集市', sessions: 65, ppts: 18, questions: 29 },
  { name: '征信', sessions: 54, ppts: 15, questions: 21 },
  { name: '票据', sessions: 43, ppts: 12, questions: 19 },
  { name: '支付', sessions: 32, ppts: 9, questions: 15 },
]

// ==================== 公司组织结构 ====================
export const companyStructure = [
  {
    department: '技术部',
    members: [
      { id: 'tech1', name: '张三', role: '技术' },
      { id: 'tech2', name: '李四', role: '技术' },
      { id: 'tech3', name: '王五', role: '技术' }
    ]
  },
  {
    department: '技术部',
    members: [
      { id: 'tech_lead1', name: '赵六', role: '技术负责人' },
      { id: 'tech_lead2', name: '孙七', role: '技术负责人' }
    ]
  },
  {
    department: '业务部',
    members: [
      { id: 'biz1', name: '周八', role: '业务' },
      { id: 'biz2', name: '吴九', role: '业务' },
      { id: 'biz3', name: '郑十', role: '业务' }
    ]
  },
  {
    department: '业务部',
    members: [
      { id: 'biz_lead1', name: '钱一', role: '业务负责人' },
      { id: 'biz_lead2', name: '钱二', role: '业务负责人' }
    ]
  },
  {
    department: '产品部',
    members: [
      { id: 'prod1', name: '产品经理A', role: '产品' },
      { id: 'prod2', name: '产品经理B', role: '产品' }
    ]
  },
  {
    department: '销售部',
    members: [
      { id: 'sales1', name: '销售A', role: '销售' },
      { id: 'sales2', name: '销售B', role: '销售' }
    ]
  }
]

// ==================== 品牌基础资料 ====================
export const brandMaterials = [
  { id: 'b1', name: '公司简介', type: 'PPT', updateDate: '2025-10-20', usage: 156 },
  { id: 'b2', name: '技术体系介绍', type: 'PPT', updateDate: '2025-10-18', usage: 89 },
  { id: 'b3', name: '业务体系介绍', type: 'PPT', updateDate: '2025-10-15', usage: 67 },
  { id: 'b4', name: '监管合作案例', type: 'PPT', updateDate: '2025-10-12', usage: 134 },
  { id: 'b5', name: '机构合作案例', type: 'PPT', updateDate: '2025-10-10', usage: 98 },
  { id: 'b6', name: '资质认证', type: 'PDF', updateDate: '2025-10-08', usage: 45 },
  { id: 'b7', name: '荣誉证书', type: 'PDF', updateDate: '2025-10-05', usage: 32 },
  { id: 'b8', name: '企业宣传册', type: 'PDF', updateDate: '2025-10-01', usage: 78 },
]

// 品牌基础资料 - 公司介绍
export const brandCompanyItems = [
  { id: 'bc1', title: '公司介绍（PDF版）', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/brand1/320/180' },
  { id: 'bc2', title: '公司介绍（PPT版）', date: '2025-10-20', tag: 'PPT', type: 'ppt', thumbnail: 'https://picsum.photos/seed/brand2/320/180' },
  { id: 'bc3', title: '企业宣传视频', date: '2025-10-20', type: 'video', thumbnail: 'https://picsum.photos/seed/brand3/320/180' },
  { id: 'bc4', title: '监管方向企业介绍（PDF版）', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/brand4/320/180' },
  { id: 'bc5', title: '监管方向企业介绍（PPT版）', date: '2025-10-20', tag: 'PPT', type: 'ppt', thumbnail: 'https://picsum.photos/seed/brand5/320/180' },
]

// 品牌基础资料 - 产品全向图
export const brandProductsItems = [
  { id: 'bp1', title: '产品全向图25版本', date: '2025-10-20', tag: 'PPT', type: 'ppt', thumbnail: 'https://picsum.photos/seed/product1/320/180' },
  { id: 'bp2', title: '产品全向图24版本', date: '2024-10-20', tag: 'PPT', type: 'ppt', thumbnail: 'https://picsum.photos/seed/product2/320/180' },
  { id: 'bp3', title: '产品全向图23版本', date: '2023-10-20', tag: 'PPT', type: 'ppt', thumbnail: 'https://picsum.photos/seed/product3/320/180' },
]

// 品牌基础资料 - 制度解读合集
export const brandRegulationsItems = [
  { id: 'br1', title: '2017年监管制度解读合集', date: '2017-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2017/320/180' },
  { id: 'br2', title: '2018年监管制度解读合集', date: '2018-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2018/320/180' },
  { id: 'br3', title: '2019年监管制度解读合集', date: '2019-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2019/320/180' },
  { id: 'br4', title: '2020年监管制度解读合集', date: '2020-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2020/320/180' },
  { id: 'br5', title: '2021年监管制度解读合集', date: '2021-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2021/320/180' },
  { id: 'br6', title: '2022年监管制度解读合集', date: '2022-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2022/320/180' },
  { id: 'br7', title: '2023年监管制度解读合集', date: '2023-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2023/320/180' },
  { id: 'br8', title: '2024年监管制度解读合集', date: '2024-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2024/320/180' },
]

// 品牌基础资料 - 台历
export const brandCalendarItems = [
  { id: 'bcal1', title: '2023年台历', date: '2023-01-01', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/cal2023/320/180' },
  { id: 'bcal2', title: '2024年台历', date: '2024-01-01', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/cal2024/320/180' },
  { id: 'bcal3', title: '2025年台历', date: '2025-01-01', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/cal2025/320/180' },
]

// 品牌基础资料 - 监管合规
export const brandComplianceItems = [
  { id: 'bcomp1', title: '一表通报送平台（NUPS-GRDC）', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/comp1/320/180' },
  { id: 'bcomp2', title: '先进统计报送平台', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/comp2/320/180' },
  { id: 'bcomp3', title: '反洗钱计算引擎', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/comp3/320/180' },
  { id: 'bcomp4', title: '金融技术数据报送系统PBOCD', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/comp4/320/180' },
]

// 品牌基础资料 - 泛监管、协同信创、地方金融监管、金融票据业务（空数据）
export const brandGeneralItems: any[] = []
export const brandXinchuangItems: any[] = []
export const brandLocalItems: any[] = []
export const brandBillItems: any[] = []

// ==================== PPT列表（工厂函数生成） ====================
export const createPptList = (count = 12) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `ppt${i + 1}`,
    title: `某产品交流PPT示例 ${i + 1}.ppt`,
    date: '10-31',
    tag: i % 2 === 0 ? '公共版' : '实战版',
    product: ['一表通', '1104', '受益所有人', '反洗钱', '金数'][i % 5],
    thumbnail: `https://picsum.photos/seed/ppt${i + 1}/320/180`,
  }))
}

// ==================== 视频列表（工厂函数生成） ====================
export const createVideoList = (count = 12) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `v${i}`,
    title: `产品演示视频示例 ${i + 1}.mp4`,
    date: '10-31',
    tag: i % 2 === 0 ? '公共版' : '实战版',
    product: ['一表通', '1104', '受益所有人', '反洗钱', '金数'][i % 5],
    industry: ['银行', '保险', '证券', '政务', '企业'][i % 5],
    thumbnail: `https://picsum.photos/seed/video${i + 1}/360/200`,
    duration: `${Math.floor(Math.random() * 30) + 10}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
  }))
}

// ==================== 招标文件列表 ====================
export const createTenderFiles = (count = 8) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    title: `招标文件示例 ${i + 1}.pdf`,
    date: '10-31',
    tag: '招标文件',
    thumbnail: `https://picsum.photos/seed/tender${i + 1}/320/180`,
  }))
}

// ==================== 响应文件列表 ====================
export const responseFiles = [
  { id: 'r1', title: '北京银行 一表通项目建设', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response1/320/180' },
  { id: 'r2', title: '上海银行 数据质量监管项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response2/320/180' },
  { id: 'r3', title: '招商银行 反洗钱智能风控项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response3/320/180' },
  { id: 'r4', title: '交通银行 客户360画像平台项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response4/320/180' },
  { id: 'r5', title: '浦发银行 统一报送与指标库项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response5/320/180' },
  { id: 'r6', title: '兴业银行 金数数据中台项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response6/320/180' },
  { id: 'r7', title: '中信银行 受益所有人识别项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response7/320/180' },
  { id: 'r8', title: '民生银行 1104监管报送项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response8/320/180' },
]

// ==================== 问答数据 ====================
export const questions = [
  { id: 1, title: '系统支持哪些数据库兼容？', product: '一表通', category: '数', categoryColor: '#FF6A00', tags: ['国产化', '数据库'], answer: '数据库支持mysql、Oracle[11gR1、12cR2]、DB2、达梦。', date: '2025/10/20', customer: '渤海银行', views: 123, likes: 123, dislikes: 0, comments: 12, userLiked: false, userDisliked: false },
  { id: 2, title: '如何配置容灾与备份？', product: '一表通', category: '技', categoryColor: '#9C27B0', tags: ['高可用', '备份'], answer: '系统提供完整的容灾备份方案，支持主备切换、数据同步、定时备份等功能。', date: '2025/10/18', customer: '北京银行', views: 98, likes: 45, dislikes: 0, comments: 8, userLiked: false, userDisliked: false },
  { id: 3, title: 'RSZS如何在个性化场景做扩展？', product: '1104', category: '技', categoryColor: '#9C27B0', tags: ['可扩展性'], answer: 'RSZS可信区个性化分支1.4版本与公司合版已实现功能对接，支持个性化配置和统一管理。', date: '2025/10/15', customer: '上海银行', views: 67, likes: 23, dislikes: 0, comments: 5, userLiked: false, userDisliked: false },
  { id: 4, title: 'RSZS制度包升级,速度比报送区慢很多,10分钟3张表', product: '1104', category: '产', categoryColor: '#409EFF', tags: ['产品'], answer: '制度包升级速度慢的问题已定位，主要是数据校验逻辑复杂导致，已优化算法提升处理速度。', date: '2025/10/12', customer: '招商银行', views: 145, likes: 67, dislikes: 0, comments: 15, userLiked: false, userDisliked: false },
  { id: 5, title: '可信区校验结果表报文推送失败', product: '1104', category: '产', categoryColor: '#409EFF', tags: ['产品'], answer: '报文推送失败通常由网络异常或配置错误引起，请检查网络连接和推送配置参数。', date: '2025/10/10', customer: '工商银行', views: 112, likes: 34, dislikes: 0, comments: 9, userLiked: false, userDisliked: false },
  { id: 6, title: '如何配置容灾与备份？', product: '受益所有人', category: '技', categoryColor: '#9C27B0', tags: ['技术'], answer: '系统提供完整的容灾备份方案，支持主备切换、数据同步、定时备份等功能。', date: '2025/10/08', customer: '建设银行', views: 89, likes: 28, dislikes: 0, comments: 6, userLiked: false, userDisliked: false },
  { id: 7, title: '系统性能如何优化？', product: '受益所有人', category: '技', categoryColor: '#9C27B0', tags: ['性能优化'], answer: '系统支持多种性能优化策略，包括数据库索引优化、缓存机制、负载均衡等。', date: '2025/10/05', customer: '农业银行', views: 76, likes: 19, dislikes: 0, comments: 4, userLiked: false, userDisliked: false },
  { id: 8, title: '数据安全如何保障？', product: '反洗钱', category: '业', categoryColor: '#409EFF', tags: ['数据安全'], answer: '系统采用多重安全机制，包括数据加密、访问控制、审计日志等，确保数据安全。', date: '2025/10/03', customer: '交通银行', views: 94, likes: 31, dislikes: 0, comments: 7, userLiked: false, userDisliked: false },
  { id: 9, title: '系统部署需要哪些环境？', product: '反洗钱', category: '技', categoryColor: '#9C27B0', tags: ['部署'], answer: '系统支持Linux、Windows等操作系统，需要JDK 1.8+、数据库、应用服务器等环境。', date: '2025/10/01', customer: '民生银行', views: 101, likes: 42, dislikes: 0, comments: 10, userLiked: false, userDisliked: false },
  { id: 10, title: '如何实现数据同步？', product: '金数', category: '数', categoryColor: '#FF6A00', tags: ['数据同步'], answer: '系统提供实时同步和定时同步两种模式，支持增量同步和全量同步。', date: '2025/09/28', customer: '光大银行', views: 82, likes: 25, dislikes: 0, comments: 5, userLiked: false, userDisliked: false },
  { id: 11, title: '系统支持哪些接口协议？', product: '金数', category: '技', categoryColor: '#9C27B0', tags: ['接口'], answer: '系统支持RESTful API、WebService、消息队列等多种接口协议。', date: '2025/09/25', customer: '华夏银行', views: 115, likes: 38, dislikes: 0, comments: 11, userLiked: false, userDisliked: false },
  { id: 12, title: '如何进行系统监控？', product: '一表通', category: '技', categoryColor: '#9C27B0', tags: ['监控'], answer: '系统提供完善的监控功能，包括性能监控、日志监控、告警通知等。', date: '2025/09/22', customer: '平安银行', views: 108, likes: 36, dislikes: 0, comments: 9, userLiked: false, userDisliked: false },
]

// ==================== 幻灯片示例数据 ====================
export const slides = [
  { id: 's1', title: '公司介绍', img: 'https://picsum.photos/seed/slide1/1024/640' },
  { id: 's2', title: '资质认证', img: 'https://picsum.photos/seed/slide2/1024/640' },
  { id: 's3', title: '技术体系', img: 'https://picsum.photos/seed/slide3/1024/640' },
  { id: 's4', title: '产品架构', img: 'https://picsum.photos/seed/slide4/1024/640' },
]

// ==================== 侧边栏信息 ====================
export const sideInfo = {
  sessions: [
    { id: 'se1', type: '视频', title: '产品宣讲交流', date: '25/09/01', view: 100, like: 30, comment: 10, thumb: 'https://picsum.photos/seed/session1/120/80' },
    { id: 'se2', type: '视频', title: '方案澄清会议', date: '25/09/05', view: 80, like: 20, comment: 6, thumb: 'https://picsum.photos/seed/session2/120/80' },
  ],
  docs: [
    { id: 'd1', title: '北京某行交流宣讲PPT', tag: '公共版', date: '25/09/01', creator: '郑相宜', view: 23, like: 12, comment: 1, thumb: 'https://picsum.photos/seed/doc1/120/90' },
    { id: 'd2', title: '北京某行二次交流纪要.PPT', tag: '实战版', date: '25/09/10', creator: '郑相宜', view: 18, like: 6, comment: 2, thumb: 'https://picsum.photos/seed/doc2/120/90' },
  ],
  exchanges: [
    { id: 'ex1', title: '北京某行—一表通交流', date: '25/08/28' },
    { id: 'ex2', title: '天津某农商—功能演示交流', date: '25/08/30' },
  ],
}

// ==================== 视频详情 ====================
export const videoDetail = {
  customer: '潍坊银行',
  project: '金融基础数据报送系统(PBOCD)',
  time: '2025.09.29 13:00-14:30',
  host: '郑相宜',
  participants: '张三、李四',
  desc: '沟通我司针对本次发文的产品功能情况，以及沟通客户内部后续推进计划。沟通我司针对本次发文的产品功能情况，以及沟通客户内部后续推进计划。',
  customerParticipants: [
    { name: '张海英', role: '政策研究处/处长', stat1: 9, stat2: 19, stat3: 40, stat4: 2 },
    { name: '王洪博', role: '科长', stat1: 9, stat2: 19 }
  ],
  files: [
    { id: 1, name: '金融基础数据报送系统(PBOCD)', type: 'ppt', size: '25/09/01', view: 23, down: 12, like: 1 }
  ],
  relatedVideos: [
    { id: 1, title: '中信信托s金数及数据质量产品方案介绍', author: '郑相宜', date: '25/09/01', view: 100, like: 30, duration: '01:05:51', img: 'https://picsum.photos/seed/rel1/160/90' },
    { id: 2, title: '中信信托s金数及数据质量产品方案介绍', author: '郑相宜', date: '25/09/01', view: 100, like: 30, duration: '01:05:51', img: 'https://picsum.photos/seed/rel2/160/90' }
  ],
  qa: [
    { q: '问题描述xxxxx文字示例文字示例 05:10', a: '面。对。都不行。是不是都不用开声音，因为不就咱们几个吗？不用开。什么。不是你一个人开声音没事，你开你自己的开声' },
    { q: '问题描述xxxxx文字示例文字示例 15:10', a: '面。对。都不行。是不是都不用开声音，因为不就咱们几个吗？不用开。什么。不是你一个人开声音没事，你开你自己的开声' }
  ],
  needs: [
    { q: '想了解更多关于受益所有人的系统建设', a: '都不行。是不是都不用开声音，因为不就咱们几个吗？不用开。什么。不是你一个人开声音没事，你开你自己的开声' },
    { q: '问题描述xxxxx文字示例文字示例 15:10', a: '面。对。都不行。是不是都不用开声音，因为不就咱们几个吗？不用开。什么。不是你一个人开声音没事，你开你自己的开声' }
  ]
}

// ==================== 产品目录结构 ====================
export const productCatalog = [
  { id: '1', text: '企业基本信息', children: [
    { id: '1.1', text: '公司简介' },
    { id: '1.2', text: '技术体系' },
    { id: '1.3', text: '业务体系' },
    { id: '1.4', text: '监管合作' },
    { id: '1.5', text: '机构合作' }
  ]},
  { id: '2', text: '监管发文与背景分析', children: [
    { id: '2.1', text: '行业监管发展' },
    { id: '2.2', text: '监管要求' },
    { id: '2.3', text: '客户痛点/难点' }
  ]},
  { id: '3', text: '产品解决方案', children: [
    { id: '3.1', text: '解决方案概述' },
    { id: '3.2', text: '产品架构设计' },
    { id: '3.3', text: '产品功能详解' },
    { id: '3.4', text: 'Demo与交互演示' },
    { id: '3.5', text: '产品优势说明' },
    { id: '3.6', text: '产品应用场景' }
  ]},
  { id: '4', text: '实施计划', children: [
    { id: '4.1', text: '软硬件资源需求' },
    { id: '4.2', text: '实施服务流程' },
    { id: '4.3', text: '联调安排' },
    { id: '4.4', text: '售后服务保障' }
  ]},
  { id: '5', text: '合作案例', children: [] }
]

// ==================== 响应文件目录 ====================
export const responseTocSections = [
  {
    title: '一、商务基础类',
    items: [
      '文件头部',
      '法定代表人身份证明',
      '法定代表人授权委托书',
      '投标人基本情况表',
      '资格审查资料',
      '投标保证金缴纳凭证',
      '公司资质证书',
      '类似项目业绩',
      '项目团队',
      '投标报价'
    ]
  },
  {
    title: '二、技术方案类',
    items: [
      '项目理解',
      '总体技术方案',
      '详细功能方案',
      '实施方案',
      '项目管理方案',
      '售后运维服务方案',
      '培训方案'
    ]
  },
  {
    title: '三、投标响应类',
    items: [
      '评分索引表',
      '投标函',
      '偏离表',
      '承诺函'
    ]
  }
]

// ==================== 导出统一数据对象 ====================
export const salesData = {
  productStats,
  companyStructure,
  brandMaterials,
  brandData: {
    companyItems: brandCompanyItems,
    productsItems: brandProductsItems,
    regulationsItems: brandRegulationsItems,
    calendarItems: brandCalendarItems,
    complianceItems: brandComplianceItems,
    generalItems: brandGeneralItems,
    xinchuangItems: brandXinchuangItems,
    localItems: brandLocalItems,
    billItems: brandBillItems,
  },
  pptList: createPptList(),
  videoList: createVideoList(),
  tenderFiles: createTenderFiles(),
  responseFiles,
  questions,
  slides,
  sideInfo,
  videoDetail,
  productCatalog,
  responseTocSections,
}

