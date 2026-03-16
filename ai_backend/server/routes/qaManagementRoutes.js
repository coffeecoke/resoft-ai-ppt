/**
 * 问答对管理路由
 * 提供问答对列表查询、筛选等功能
 */

const express = require('express');
const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
const router = express.Router();

/**
 * GET /api/qa/test
 * 测试路由是否正常工作
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '问答对管理路由正常工作',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/qa/categories
 * 获取所有分类数据（用于前端显示映射）
 */
router.get('/categories', async (req, res) => {
  let prisma;
  try {
    prisma = new PrismaClient();
    
    const categories = await prisma.concern_categories.findMany({
      where: {
        is_active: true
      },
      select: {
        id: true,
        code: true,
        name: true,
        level: true,
        type: true,
        description: true
      },
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('获取分类数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取分类数据失败: ' + error.message
    });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
});

/**
 * PATCH /api/qa/concerns/:id/classification
 * 手动更新单个问答对的分类（人为纠偏，不调用AI）
 * Body: { categoryCode?: string, intentCode?: string } 至少传一个
 */
router.patch('/concerns/:id/classification', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const { id: concernId } = req.params;
    const { categoryCode, intentCode } = req.body || {};

    if (!concernId) {
      return res.status(400).json({
        success: false,
        error: '问答对ID不能为空'
      });
    }

    if (!categoryCode && !intentCode) {
      return res.status(400).json({
        success: false,
        error: '请至少选择分类类别或问题性质之一'
      });
    }

    const updateData = {};

    if (categoryCode !== undefined) {
      if (categoryCode === '' || categoryCode === null) {
        updateData.category_id = null;
        updateData.category = null; // 兼容旧字段
      } else {
        const categoryRecord = await prisma.concern_categories.findFirst({
          where: { code: categoryCode, level: 2, is_active: true }
        });
        if (!categoryRecord) {
          return res.status(400).json({
            success: false,
            error: `分类类别代码不存在: ${categoryCode}`
          });
        }
        updateData.category_id = categoryRecord.id;
        updateData.category = categoryRecord.code; // 兼容旧字段
      }
    }

    if (intentCode !== undefined) {
      if (intentCode === '' || intentCode === null) {
        updateData.intent_code = null;
      } else {
        const intentRecord = await prisma.concern_categories.findFirst({
          where: { code: intentCode, level: 3, is_active: true }
        });
        if (!intentRecord) {
          return res.status(400).json({
            success: false,
            error: `问题性质代码不存在: ${intentCode}`
          });
        }
        updateData.intent_code = intentRecord.code;
      }
    }

    await prisma.concerns.update({
      where: { id: concernId },
      data: updateData
    });

    res.json({
      success: true,
      message: '分类已更新'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: '问答对不存在'
      });
    }
    console.error('更新问答对分类失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '更新失败'
    });
  } finally {
    await prisma.$disconnect();
  }
});

const MAX_EXPORT_SIZE = 10000;

/**
 * GET /api/qa/concerns/export
 * 导出问答对（当前筛选条件下的全部数据，仅限最多 MAX_EXPORT_SIZE 条）
 * Query 与 /concerns 一致（除 page/pageSize 外），返回完整问题与解答，供前端生成 CSV/Excel
 */
router.get('/concerns/export', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const {
      transcriptionName,
      classificationStatus,
      category,
      intent,
      questionSource,
      reviewStatus
    } = req.query;

    const where = {};
    if (reviewStatus && ['pending', 'approved', 'rejected'].includes(reviewStatus)) {
      where.review_status = reviewStatus;
    }
    if (transcriptionName) {
      const transcriptions = await prisma.transcriptions.findMany({
        where: { name: { contains: transcriptionName } },
        select: { id: true }
      });
      const transcriptionIds = transcriptions.map(t => t.id);
      if (transcriptionIds.length === 0) {
        return res.json({ success: true, data: { list: [] } });
      }
      where.transcription_id = { in: transcriptionIds };
    }
    if (classificationStatus === 'classified') {
      where.OR = [
        { category_id: { not: null } },
        { intent_code: { not: null } }
      ];
    } else if (classificationStatus === 'unclassified') {
      where.category_id = null;
      where.intent_code = null;
    }
    let categoryId = null;
    if (category) {
      const categoryRecord = await prisma.concern_categories.findUnique({
        where: { code: category }
      });
      if (categoryRecord) categoryId = categoryRecord.id;
    }
    if (intent) where.intent_code = intent;
    if (questionSource) {
      where._needQuestionSourceFilter = questionSource;
    }
    if (categoryId || category) {
      const categoryCondition = categoryId
        ? [{ category_id: categoryId }, { category: category }]
        : [{ category: category }];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: categoryCondition }];
        delete where.OR;
      } else {
        where.OR = categoryCondition;
      }
    }
    const needQuestionSourceFilter = where._needQuestionSourceFilter;
    delete where._needQuestionSourceFilter;

    let concerns = await prisma.concerns.findMany({
      where,
      include: { concern_categories: true },
      orderBy: { created_at: 'desc' },
      take: needQuestionSourceFilter ? 99999 : MAX_EXPORT_SIZE
    });

    const transcriptionIds = [...new Set(concerns.map(c => c.transcription_id).filter(Boolean))];
    let transcriptionsMap = {};
    if (transcriptionIds.length > 0) {
      const transcriptions = await prisma.transcriptions.findMany({
        where: { id: { in: transcriptionIds } },
        select: { id: true, name: true, speaker_roles: true }
      });
      transcriptionsMap = transcriptions.reduce((map, t) => {
        map[t.id] = { name: t.name, speaker_roles: t.speaker_roles };
        return map;
      }, {});
      const adjustments = await prisma.dialogue_adjustments.findMany({
        where: {
          transcription_id: { in: transcriptionIds },
          speaker_roles: { not: null }
        },
        select: { transcription_id: true, speaker_roles: true },
        orderBy: { created_at: 'desc' }
      });
      const roleMap = {};
      adjustments.forEach(adj => {
        if (!roleMap[adj.transcription_id]) {
          roleMap[adj.transcription_id] = adj.speaker_roles;
        }
      });
      Object.keys(transcriptionsMap).forEach(tid => {
        if (roleMap[tid]) transcriptionsMap[tid].speaker_roles = roleMap[tid];
      });
    }

    if (needQuestionSourceFilter) {
      concerns = concerns.filter(concern => {
        if (!concern.question_speaker || !concern.transcription_id) return false;
        const trans = transcriptionsMap[concern.transcription_id];
        if (!trans || !trans.speaker_roles) return false;
        try {
          const roles = JSON.parse(trans.speaker_roles);
          const role = roles[concern.question_speaker];
          if (role === undefined) return false;
          return needQuestionSourceFilter === 'our_side' ? role === 'our_side' : role === 'customer';
        } catch (e) {
          return false;
        }
      });
      concerns = concerns.slice(0, MAX_EXPORT_SIZE);
    }

    const list = concerns.map(concern => {
      const transcriptionData = concern.transcription_id && transcriptionsMap[concern.transcription_id];
      return {
        id: concern.id,
        question: concern.question,
        answer: concern.answer,
        category: concern.category,
        category_id: concern.category_id,
        intent_code: concern.intent_code,
        time_range: concern.time_range || concern.time_range1 || null,
        time_range1: concern.time_range1 || concern.time_range || null,
        time_range2: concern.time_range2 || null,
        transcription_name: transcriptionData ? transcriptionData.name : '-',
        createdAt: concern.created_at,
        concern_categories: concern.concern_categories ? {
          code: concern.concern_categories.code,
          name: concern.concern_categories.name
        } : null
      };
    });

    res.json({ success: true, data: { list } });
  } catch (error) {
    console.error('导出问答对失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '导出失败'
    });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/qa/concerns
 * 获取问答对列表（支持分页和筛选）
 * 
 * @query {number} [page=1] - 页码
 * @query {number} [pageSize=20] - 每页数量
 * @query {string} [transcriptionName] - 音频名称筛选（模糊匹配）
 * @query {string} [classificationStatus] - 分类状态筛选：classified=已分类，unclassified=未分类
 * @query {string} [category] - 分类类别筛选（分类代码，如"2.3"）
 * @query {string} [intent] - 问题性质筛选（如"I1"）
 * @query {string} [questionSource] - 问题发起方筛选：our_side=我方，customer=客户方
 */
router.get('/concerns', async (req, res) => {
  const prisma = new PrismaClient();
  
  try {
    const {
      page = 1,
      pageSize = 20,
      transcriptionName,
      classificationStatus,
      category,
      intent,
      questionSource, // 问题发起方筛选
      reviewStatus // 审核状态：pending | approved | rejected
    } = req.query;

    // 构建查询条件
    const where = {};

    // 审核状态筛选
    if (reviewStatus && ['pending', 'approved', 'rejected'].includes(reviewStatus)) {
      where.review_status = reviewStatus;
    }

    // 音频名称筛选（通过转录记录名称模糊匹配）
    if (transcriptionName) {
      const transcriptions = await prisma.transcriptions.findMany({
        where: {
          name: {
            contains: transcriptionName
          }
        },
        select: {
          id: true
        }
      });
      const transcriptionIds = transcriptions.map(t => t.id);
      if (transcriptionIds.length === 0) {
        // 如果没有找到匹配的转录记录，返回空结果
        res.json({
          success: true,
          data: {
            list: [],
            total: 0,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: 0
          }
        });
        await prisma.$disconnect();
        return;
      }
      where.transcription_id = { in: transcriptionIds };
    }

    // 分类状态筛选
    if (classificationStatus === 'classified') {
      // 已分类：有category_id或intent_code
      where.OR = [
        { category_id: { not: null } },
        { intent_code: { not: null } }
      ];
    } else if (classificationStatus === 'unclassified') {
      // 未分类：category_id和intent_code都为空
      where.category_id = null;
      where.intent_code = null;
    }

    // 分类类别筛选（先查询分类ID）
    let categoryId = null;
    if (category) {
      const categoryRecord = await prisma.concern_categories.findUnique({
        where: { code: category }
      });
      if (categoryRecord) {
        categoryId = categoryRecord.id;
      }
    }

    // 问题性质筛选
    if (intent) {
      where.intent_code = intent;
    }

    // 问题发起方筛选（根据question_speaker和speaker_roles判断）
    // 注意：这个筛选需要在内存中处理，因为需要关联transcriptions表的speaker_roles
    // 所以先不在这里筛选，标记为后处理
    if (questionSource) {
      // 标记需要后处理（根据question_speaker和speaker_roles进一步筛选）
      // 不提前筛选转录记录，避免遗漏数据
      where._needQuestionSourceFilter = questionSource;
      
      console.log(`[问题发起方筛选] 已标记需要后处理，筛选条件: ${questionSource}`);
    }

    // 分类类别筛选（使用category_id或兼容旧字段category）
    // 注意：如果where.OR已存在（分类状态筛选），需要合并条件
    if (categoryId || category) {
      const categoryCondition = categoryId 
        ? [
            { category_id: categoryId },
            { category: category } // 兼容旧字段
          ]
        : [{ category: category }];
      
      if (where.OR) {
        // 如果已有OR条件，需要合并（使用AND连接两个OR条件）
        where.AND = [
          { OR: where.OR },
          { OR: categoryCondition }
        ];
        delete where.OR;
      } else {
        where.OR = categoryCondition;
      }
    }

    // 保存需要后处理的标记
    const needQuestionSourceFilter = where._needQuestionSourceFilter;
    delete where._needQuestionSourceFilter;

    // 计算总数（如果需要后处理，先不计算）
    let total;
    if (!needQuestionSourceFilter) {
      total = await prisma.concerns.count({ where });
    }

    // 分页查询
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);

    let concerns = await prisma.concerns.findMany({
      where,
      include: {
        concern_categories: true, // 包含分类信息
        // 关联查询转录记录，获取音频名称
        // 注意：concerns表没有直接关联transcriptions，需要通过transcription_id查询
      },
      orderBy: {
        created_at: 'desc'
      },
      skip: needQuestionSourceFilter ? 0 : skip,
      take: needQuestionSourceFilter ? 99999 : take
    });
    
    // 获取所有相关的转录记录ID
    const transcriptionIds = [...new Set(concerns.map(c => c.transcription_id).filter(id => id))];
    
    // 批量查询转录记录（用于获取音频名称）
    let transcriptionsMap = {};
    if (transcriptionIds.length > 0) {
      const transcriptions = await prisma.transcriptions.findMany({
        where: {
          id: { in: transcriptionIds }
        },
        select: {
          id: true,
          name: true, // 音频名称
          speaker_roles: true, // 兼容旧数据（已废弃，优先使用 dialogue_adjustments）
          has_role_separation: true
        }
      });
      
      console.log(`\n[转录记录查询] 查询到 ${transcriptions.length} 条转录记录`);
      
      // 先构建基础映射（音频名称）
      transcriptionsMap = transcriptions.reduce((map, t) => {
        map[t.id] = { name: t.name, speaker_roles: null }; // 初始化为null，后续从dialogue_adjustments获取
        return map;
      }, {});
      
      // 批量查询 dialogue_adjustments 表获取 speaker_roles（优先使用）
      const adjustments = await prisma.dialogue_adjustments.findMany({
        where: {
          transcription_id: { in: transcriptionIds },
          speaker_roles: { not: null }
        },
        select: {
          transcription_id: true,
          speaker_roles: true
        },
        orderBy: {
          created_at: 'desc' // 使用最新的调整记录
        }
      });
      
      console.log(`[角色信息查询] 从 dialogue_adjustments 表查询到 ${adjustments.length} 条记录`);
      
      // 为每个转录记录分配 speaker_roles（使用最新的记录）
      const roleMap = {};
      adjustments.forEach(adj => {
        // 如果该转录记录还没有角色信息，或者这是更新的记录，则更新
        if (!roleMap[adj.transcription_id]) {
          roleMap[adj.transcription_id] = adj.speaker_roles;
        }
      });
      
      // 更新 transcriptionsMap，优先使用 dialogue_adjustments 中的角色信息
      Object.keys(transcriptionsMap).forEach(transcriptionId => {
        if (roleMap[transcriptionId]) {
          transcriptionsMap[transcriptionId].speaker_roles = roleMap[transcriptionId];
        } else if (transcriptionsMap[transcriptionId] && transcriptions.find(t => t.id === transcriptionId)?.speaker_roles) {
          // 兼容旧数据：如果 dialogue_adjustments 中没有，尝试使用 transcriptions 表中的（已废弃）
          transcriptionsMap[transcriptionId].speaker_roles = transcriptions.find(t => t.id === transcriptionId).speaker_roles;
          console.warn(`[角色信息查询] 转录记录 ${transcriptionId} 使用 transcriptions 表中的角色信息（旧数据，建议迁移）`);
        }
      });
      
      // 输出统计信息
      const withRolesCount = Object.values(transcriptionsMap).filter(t => t.speaker_roles).length;
      const withoutRolesCount = Object.values(transcriptionsMap).filter(t => !t.speaker_roles).length;
      console.log(`[角色信息查询] 统计: 有角色信息=${withRolesCount}, 无角色信息=${withoutRolesCount}`);
    }

    // 后处理：根据 question_speaker 和 speaker_roles 进一步筛选
    if (needQuestionSourceFilter) {
      console.log(`\n[问题发起方筛选] ========== 开始后处理 ==========`);
      console.log(`[问题发起方筛选] 筛选条件: ${needQuestionSourceFilter}`);
      console.log(`[问题发起方筛选] 初始问答对数量: ${concerns.length}`);
      console.log(`[问题发起方筛选] 转录记录数量: ${Object.keys(transcriptionsMap).length}`);
      
      // 统计信息
      let matchedCount = 0;
      let skippedNoQuestionSpeaker = 0;
      let skippedNoTranscriptionId = 0;
      let skippedNoTranscriptionData = 0;
      let skippedNoSpeakerRoles = 0;
      let skippedParseError = 0;
      let skippedNoRoleMapping = 0;
      let skippedNotMatched = 0;
      
      concerns = concerns.filter(concern => {
        // 检查必要字段
        if (!concern.question_speaker) {
          skippedNoQuestionSpeaker++;
          return false;
        }
        
        if (!concern.transcription_id) {
          skippedNoTranscriptionId++;
          return false;
        }
        
        if (!transcriptionsMap[concern.transcription_id]) {
          skippedNoTranscriptionData++;
          return false;
        }

        const transcription = transcriptionsMap[concern.transcription_id];
        
        if (!transcription.speaker_roles) {
          skippedNoSpeakerRoles++;
          return false;
        }

        try {
          const roles = JSON.parse(transcription.speaker_roles);
          
          // 查找提问者的角色
          const questionSpeakerRole = roles[concern.question_speaker];
          
          if (questionSpeakerRole === undefined) {
            // question_speaker 在 roles 中找不到
            skippedNoRoleMapping++;
            console.warn(`[问题发起方筛选] 问答对 ${concern.id}: question_speaker "${concern.question_speaker}" 在 roles 中不存在`);
            console.warn(`[问题发起方筛选] 可用的 roles:`, Object.keys(roles));
            return false;
          }
          
          // 判断提问者角色是否匹配筛选条件
          if (needQuestionSourceFilter === 'our_side' && questionSpeakerRole === 'our_side') {
            matchedCount++;
            return true; // 我方提问
          } else if (needQuestionSourceFilter === 'customer' && questionSpeakerRole === 'customer') {
            matchedCount++;
            return true; // 客户方提问
          }
          
          skippedNotMatched++;
          return false;
        } catch (e) {
          skippedParseError++;
          console.warn(`[问题发起方筛选] 解析 speaker_roles 失败 (转录ID: ${concern.transcription_id}):`, e.message);
          return false;
        }
      });

      console.log(`\n[问题发起方筛选] ========== 筛选结果统计 ==========`);
      console.log(`[问题发起方筛选] ✓ 匹配数量: ${matchedCount}`);
      console.log(`[问题发起方筛选] ✗ 排除统计:`);
      console.log(`  - 缺少 question_speaker: ${skippedNoQuestionSpeaker}`);
      console.log(`  - 缺少 transcription_id: ${skippedNoTranscriptionId}`);
      console.log(`  - 缺少转录记录数据: ${skippedNoTranscriptionData}`);
      console.log(`  - 缺少 speaker_roles: ${skippedNoSpeakerRoles}`);
      console.log(`  - JSON解析失败: ${skippedParseError}`);
      console.log(`  - question_speaker 在 roles 中不存在: ${skippedNoRoleMapping}`);
      console.log(`  - 角色不匹配: ${skippedNotMatched}`);
      console.log(`[问题发起方筛选] 筛选后问答对数量: ${concerns.length}`);

      // 更新总数
      total = concerns.length;

      // 手动分页
      console.log(`[问题发起方筛选] 开始分页: skip=${skip}, take=${take}`);
      concerns = concerns.slice(skip, skip + take);
      console.log(`[问题发起方筛选] 分页后问答对数量: ${concerns.length}`);
      console.log(`[问题发起方筛选] ======================================\n`);
    }

    // 格式化返回数据
    const list = concerns.map(concern => {
      const transcriptionData = concern.transcription_id && transcriptionsMap[concern.transcription_id];
      
      // 调试日志
      if (concern.transcription_id) {
        console.log(`[问答对列表] ID: ${concern.id}, 转录ID: ${concern.transcription_id}`);
        console.log(`[问答对列表] transcriptionData:`, transcriptionData);
        console.log(`[问答对列表] speaker_roles:`, transcriptionData?.speaker_roles);
      }
      
      return {
        id: concern.id,
        question: concern.question,
        answer: concern.answer,
        question_original: concern.question_original ?? null,
        answer_original: concern.answer_original ?? null,
        category: concern.category, // 兼容旧字段
        category_id: concern.category_id,
        intent_code: concern.intent_code,
        priority: concern.priority,
        status: concern.status,
        time_range: concern.time_range || concern.time_range1 || null,
        time_range1: concern.time_range1 || concern.time_range || null,
        time_range2: concern.time_range2 || null,
        question_speaker: concern.question_speaker,
        answer_speaker: concern.answer_speaker,
        transcription_id: concern.transcription_id,
        transcription_name: transcriptionData ? transcriptionData.name : '-', // 音频名称
        transcription_speaker_roles: transcriptionData ? transcriptionData.speaker_roles : null, // 角色映射信息
        review_status: concern.review_status ?? 'pending',
        reviewed_at: concern.reviewed_at,
        reviewer_id: concern.reviewer_id,
        createdAt: concern.created_at,
        updatedAt: concern.updated_at,
        // 分类信息
        concern_categories: concern.concern_categories ? {
          id: concern.concern_categories.id,
          code: concern.concern_categories.code,
          name: concern.concern_categories.name,
          level: concern.concern_categories.level,
          type: concern.concern_categories.type
        } : null
      };
    });

    const totalPages = Math.ceil(total / parseInt(pageSize));

    res.json({
      success: true,
      data: {
        list,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages
      }
    });

  } catch (error) {
    console.error('查询问答对列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '查询失败'
    });
  } finally {
    await prisma.$disconnect();
  }
});

// ---------- 审核相关：时间解析与对话上下文 ----------
/** 解析时间范围字符串为秒数，支持 "[00:10-00:30]" 或 "00:10-00:30" */
function parseTimeRangeToSeconds(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return { start: null, end: null };
  const trimmed = rangeStr.trim().replace(/^\[|\]$/g, '');
  if (!trimmed.includes('-')) return { start: null, end: null };
  const parts = trimmed.split('-').map(s => s.trim());
  if (parts.length !== 2) return { start: null, end: null };
  const parseOne = (s) => {
    const p = s.split(':');
    if (p.length === 2) return parseInt(p[0], 10) * 60 + parseFloat(p[1]);
    if (p.length === 3) return parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseFloat(p[2]);
    return 0;
  };
  return { start: parseOne(parts[0]), end: parseOne(parts[1]) };
}

/**
 * 获取单个问答对的「前 N 句 / 后 N 句」对话上下文，用于问答对优化
 * @param {object} prisma - Prisma 实例
 * @param {string} concernId - 问答对 ID
 * @param {number} contextAbove - 前文条数（默认 4）
 * @param {number} contextBelow - 后文条数（默认 4）
 * @returns {Promise<{ concern, contextBefore: string[], contextAfter: string[] }|null>}
 */
async function getOptimizeContextForConcern(prisma, concernId, contextAbove = 4, contextBelow = 4) {
  const concern = await prisma.concerns.findUnique({ where: { id: concernId } });
  if (!concern || !concern.transcription_id) return null;

  const transcription = await prisma.transcriptions.findUnique({
    where: { id: concern.transcription_id },
    select: { id: true, name: true, dialogues: true }
  });
  if (!transcription || !transcription.dialogues) return { concern, contextBefore: [], contextAfter: [] };

  let dialogues = transcription.dialogues;
  if (typeof dialogues === 'string') {
    try {
      dialogues = JSON.parse(dialogues);
    } catch (e) {
      dialogues = [];
    }
  }
  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    return { concern, contextBefore: [], contextAfter: [] };
  }

  const tr1 = parseTimeRangeToSeconds(concern.time_range1 || concern.time_range || '');
  const qaStart = tr1.start;
  const qaEnd = tr1.end ?? tr1.start;
  const qaStart2 = concern.time_range2 ? parseTimeRangeToSeconds(concern.time_range2).start : null;
  const qaEnd2 = concern.time_range2 ? parseTimeRangeToSeconds(concern.time_range2).end : null;
  const rangeStart = qaStart !== null ? qaStart : (qaStart2 !== null ? qaStart2 : 0);
  const rangeEnd = (qaEnd2 != null && qaEnd2 > (qaEnd || 0)) ? qaEnd2 : (qaEnd != null ? qaEnd : rangeStart);

  const withSeconds = dialogues.map((d, i) => {
    const raw = (d.timeRange || d.startTime || '').toString().replace(/^\[|\]$/g, '');
    const parts = raw.includes('-') ? raw.split('-').map(s => s.trim()) : [];
    const parseOne = (s) => {
      if (!s) return 0;
      const p = s.split(':');
      if (p.length === 2) return parseInt(p[0], 10) * 60 + parseFloat(p[1]);
      if (p.length === 3) return parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseFloat(p[2]);
      return 0;
    };
    const start = parts.length >= 1 ? parseOne(parts[0]) : 0;
    const end = parts.length >= 2 ? parseOne(parts[1]) : start;
    return { index: i, start, end, ...d };
  });

  let centerIndex = 0;
  for (let i = 0; i < withSeconds.length; i++) {
    const d = withSeconds[i];
    const overlap = (d.start <= rangeEnd && (d.end >= rangeStart || d.end === 0));
    if (overlap || (d.start >= rangeStart && centerIndex === 0)) {
      centerIndex = i;
      if (overlap) break;
    }
  }

  const startIdx = Math.max(0, centerIndex - contextAbove);
  const endIdx = Math.min(withSeconds.length - 1, centerIndex + contextBelow);
  const windowList = withSeconds.slice(startIdx, endIdx + 1);

  const formatLine = (d) => {
    const speaker = d.speaker || d.speakerName || '';
    const text = d.text || d.correctedText || d.originalText || '';
    return `${speaker}: ${text}`.trim();
  };

  const centerInWindow = centerIndex - startIdx;
  const contextBefore = windowList.slice(0, centerInWindow).map(formatLine);
  const contextAfter = windowList.slice(centerInWindow + 1).map(formatLine);

  return { concern, contextBefore, contextAfter };
}

/**
 * GET /api/qa/concerns/:id/review-context
 * 获取单个问答对的审核上下文：来源对话片段 + 上2条 + 下2条
 */
router.get('/concerns/:id/review-context', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const { id: concernId } = req.params;
    if (!concernId) {
      return res.status(400).json({ success: false, error: '问答对ID不能为空' });
    }

    const concern = await prisma.concerns.findUnique({
      where: { id: concernId },
      include: { concern_categories: true }
    });
    if (!concern) {
      return res.status(404).json({ success: false, error: '问答对不存在' });
    }
    if (!concern.transcription_id) {
      return res.json({
        success: true,
        data: {
          concern: formatConcernForReview(concern),
          dialogueContext: [],
          contextStartIndex: 0,
          sourceIndexInContext: -1
        }
      });
    }

    const transcription = await prisma.transcriptions.findUnique({
      where: { id: concern.transcription_id },
      select: { id: true, name: true, dialogues: true }
    });
    if (!transcription) {
      return res.json({
        success: true,
        data: {
          concern: formatConcernForReview(concern),
          dialogueContext: [],
          contextStartIndex: 0,
          sourceIndexInContext: -1
        }
      });
    }

    let dialogues = transcription.dialogues;
    if (typeof dialogues === 'string') {
      try {
        dialogues = JSON.parse(dialogues);
      } catch (e) {
        dialogues = [];
      }
    }
    if (!Array.isArray(dialogues) || dialogues.length === 0) {
      return res.json({
        success: true,
        data: {
          concern: formatConcernForReview(concern),
          dialogueContext: [],
          contextStartIndex: 0,
          sourceIndexInContext: -1
        }
      });
    }

    const tr1 = parseTimeRangeToSeconds(concern.time_range1 || concern.time_range || '');
    const qaStart = tr1.start;
    const qaEnd = tr1.end ?? tr1.start;
    const qaStart2 = concern.time_range2 ? parseTimeRangeToSeconds(concern.time_range2).start : null;
    const qaEnd2 = concern.time_range2 ? parseTimeRangeToSeconds(concern.time_range2).end : null;
    const rangeStart = qaStart !== null ? qaStart : (qaStart2 !== null ? qaStart2 : 0);
    const rangeEnd = (qaEnd2 !== null && qaEnd2 > (qaEnd || 0)) ? qaEnd2 : (qaEnd !== null ? qaEnd : rangeStart);

    const withSeconds = dialogues.map((d, i) => {
      const raw = (d.timeRange || d.startTime || '').toString().replace(/^\[|\]$/g, '');
      const parts = raw.includes('-') ? raw.split('-').map(s => s.trim()) : [];
      const parseOne = (s) => {
        if (!s) return 0;
        const p = s.split(':');
        if (p.length === 2) return parseInt(p[0], 10) * 60 + parseFloat(p[1]);
        if (p.length === 3) return parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseFloat(p[2]);
        return 0;
      };
      const start = parts.length >= 1 ? parseOne(parts[0]) : 0;
      const end = parts.length >= 2 ? parseOne(parts[1]) : start;
      return { index: i, start, end, ...d };
    });

    let centerIndex = 0;
    for (let i = 0; i < withSeconds.length; i++) {
      const d = withSeconds[i];
      const overlap = (d.start <= rangeEnd && (d.end >= rangeStart || d.end === 0));
      if (overlap || (d.start >= rangeStart && centerIndex === 0)) {
        centerIndex = i;
        if (overlap) break;
      }
    }

    const contextAbove = 3; // 上3条
    const contextBelow = 4; // 下4条
    const startIdx = Math.max(0, centerIndex - contextAbove);
    const endIdx = Math.min(withSeconds.length - 1, centerIndex + contextBelow);
    const dialogueContext = withSeconds.slice(startIdx, endIdx + 1).map((d, i) => ({
      indexInFull: d.index,
      position: startIdx + i,
      timeRange: d.timeRange || d.startTime || '',
      speaker: d.speaker || d.speakerName || '',
      text: d.text || d.correctedText || d.originalText || '',
      isSource: startIdx + i === centerIndex
    }));
    const sourceIndexInContext = centerIndex >= startIdx && centerIndex <= endIdx ? centerIndex - startIdx : -1;

    res.json({
      success: true,
      data: {
        concern: formatConcernForReview(concern),
        dialogueContext,
        contextStartIndex: startIdx,
        sourceIndexInContext,
        transcriptionName: transcription.name
      }
    });
  } catch (error) {
    console.error('获取审核上下文失败:', error);
    res.status(500).json({ success: false, error: error.message || '获取失败' });
  } finally {
    await prisma.$disconnect();
  }
});

function formatConcernForReview(concern) {
  return {
    id: concern.id,
    question: concern.question,
    answer: concern.answer,
    question_original: concern.question_original ?? null,
    answer_original: concern.answer_original ?? null,
    category: concern.category,
    category_code: concern.category_code,
    intent_code: concern.intent_code,
    time_range1: concern.time_range1,
    time_range2: concern.time_range2,
    question_speaker: concern.question_speaker,
    answer_speaker: concern.answer_speaker,
    transcription_id: concern.transcription_id,
    review_status: concern.review_status ?? 'pending',
    reviewed_at: concern.reviewed_at,
    reviewer_id: concern.reviewer_id,
    concern_categories: concern.concern_categories ? {
      id: concern.concern_categories.id,
      code: concern.concern_categories.code,
      name: concern.concern_categories.name,
      level: concern.concern_categories.level,
      type: concern.concern_categories.type
    } : null
  };
}

/**
 * POST /api/qa/concerns/:id/review
 * 提交单条审核。Body: { action: 'approve'|'reject'|'modify_approve', remark?: string, content_after?: { question?, answer?, category_code?, intent_code? } }
 */
router.post('/concerns/:id/review', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const { id: concernId } = req.params;
    const { action, remark, content_after } = req.body || {};
    if (!concernId) {
      return res.status(400).json({ success: false, error: '问答对ID不能为空' });
    }
    if (!['approve', 'reject', 'modify_approve'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action 必须为 approve、reject 或 modify_approve' });
    }

    const concern = await prisma.concerns.findUnique({ where: { id: concernId } });
    if (!concern) {
      return res.status(404).json({ success: false, error: '问答对不存在' });
    }

    const reviewerId = req.body.reviewer_id || req.headers['x-reviewer-id'] || null;
    const now = new Date();

    const recordId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const contentBefore = action === 'modify_approve' || action === 'reject' ? {
      question: concern.question,
      answer: concern.answer,
      category_code: concern.category_code,
      intent_code: concern.intent_code
    } : null;

    if (action === 'approve' || action === 'modify_approve') {
      const updateData = {
        review_status: 'approved',
        reviewed_at: now,
        reviewer_id: reviewerId
      };
      if (action === 'modify_approve' && content_after && typeof content_after === 'object') {
        if (content_after.question !== undefined) updateData.question = content_after.question;
        if (content_after.answer !== undefined) updateData.answer = content_after.answer;
        if (content_after.category_code !== undefined) updateData.category_code = content_after.category_code;
        if (content_after.intent_code !== undefined) updateData.intent_code = content_after.intent_code;
      }
      await prisma.concerns.update({
        where: { id: concernId },
        data: updateData
      });
      await prisma.concern_review_records.create({
        data: {
          id: recordId,
          concern_id: concernId,
          action: action === 'modify_approve' ? 'modify_approve' : 'approve',
          reviewer_id: reviewerId,
          review_time: now,
          remark: remark || null,
          content_before: contentBefore,
          content_after: action === 'modify_approve' && content_after ? content_after : null
        }
      });
    } else {
      await prisma.concerns.update({
        where: { id: concernId },
        data: {
          review_status: 'rejected',
          reviewed_at: now,
          reviewer_id: reviewerId
        }
      });
      await prisma.concern_review_records.create({
        data: {
          id: recordId,
          concern_id: concernId,
          action: 'reject',
          reviewer_id: reviewerId,
          review_time: now,
          remark: remark || null,
          content_before: contentBefore,
          content_after: null
        }
      });
    }

    res.json({
      success: true,
      message: action === 'reject' ? '已拒绝' : (action === 'modify_approve' ? '已修改并通过' : '已通过'),
      data: { concernId, review_status: action === 'reject' ? 'rejected' : 'approved' }
    });
  } catch (error) {
    console.error('提交审核失败:', error);
    res.status(500).json({ success: false, error: error.message || '提交失败' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * POST /api/qa/review/batch-approve
 * Body: { concernIds: string[] }
 */
router.post('/review/batch-approve', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const { concernIds } = req.body || {};
    if (!Array.isArray(concernIds) || concernIds.length === 0) {
      return res.status(400).json({ success: false, error: '请提供 concernIds 数组' });
    }
    const reviewerId = req.body.reviewer_id || req.headers['x-reviewer-id'] || null;
    const now = new Date();

    const result = await prisma.concerns.updateMany({
      where: { id: { in: concernIds } },
      data: {
        review_status: 'approved',
        reviewed_at: now,
        reviewer_id: reviewerId
      }
    });

    res.json({
      success: true,
      message: `已批量通过 ${result.count} 条`,
      data: { count: result.count }
    });
  } catch (error) {
    console.error('批量通过失败:', error);
    res.status(500).json({ success: false, error: error.message || '操作失败' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * POST /api/qa/review/batch-reject
 * Body: { concernIds: string[], remark?: string }
 */
router.post('/review/batch-reject', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const { concernIds, remark } = req.body || {};
    if (!Array.isArray(concernIds) || concernIds.length === 0) {
      return res.status(400).json({ success: false, error: '请提供 concernIds 数组' });
    }
    const reviewerId = req.body.reviewer_id || req.headers['x-reviewer-id'] || null;
    const now = new Date();

    const result = await prisma.concerns.updateMany({
      where: { id: { in: concernIds } },
      data: {
        review_status: 'rejected',
        reviewed_at: now,
        reviewer_id: reviewerId
      }
    });

    res.json({
      success: true,
      message: `已批量拒绝 ${result.count} 条`,
      data: { count: result.count }
    });
  } catch (error) {
    console.error('批量拒绝失败:', error);
    res.status(500).json({ success: false, error: error.message || '操作失败' });
  } finally {
    await prisma.$disconnect();
  }
});

// ---------- 问答对优化（去语气词 + 前后文补全） ----------
const transcriptionAiService = require('../services/transcriptionAiService');

/**
 * POST /api/qa/concerns/:id/optimize
 * 单条问答对优化：去除语气词，结合前4句/后4句补全主语与句子
 * Body: { save?: boolean, modelName?: string, promptId?: string }
 */
router.post('/concerns/:id/optimize', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const { id: concernId } = req.params;
    const { save = false, modelName, promptId } = req.body || {};
    if (!concernId) {
      return res.status(400).json({ success: false, error: '问答对ID不能为空' });
    }

    const ctx = await getOptimizeContextForConcern(prisma, concernId, 4, 4);
    if (!ctx) {
      return res.status(404).json({ success: false, error: '问答对不存在或未关联转录' });
    }

    const { concern, contextBefore, contextAfter } = ctx;
    const result = await transcriptionAiService.optimizeQAPair(
      concern.question,
      concern.answer || '',
      contextBefore,
      contextAfter,
      { modelName, promptId }
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || '优化失败' });
    }

    let saved = false;
    if (save) {
      const updateData = {
        question: result.question,
        answer: result.answer
      };
      // 首次优化时保留原文到 question_original / answer_original
      if (concern.question_original == null && concern.answer_original == null) {
        updateData.question_original = concern.question ?? '';
        updateData.answer_original = concern.answer ?? '';
      }
      await prisma.concerns.update({
        where: { id: concernId },
        data: updateData
      });
      saved = true;
    }

    res.json({
      success: true,
      data: {
        question: result.question,
        answer: result.answer,
        saved
      }
    });
  } catch (error) {
    console.error('问答对优化失败:', error);
    res.status(500).json({ success: false, error: error.message || '优化失败' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * POST /api/qa/optimize-batch
 * 批量问答对优化
 * Body: { concernIds: string[], save?: boolean, modelName?: string, promptId?: string }
 */
router.post('/optimize-batch', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const { concernIds, save = false, modelName, promptId } = req.body || {};
    if (!Array.isArray(concernIds) || concernIds.length === 0) {
      return res.status(400).json({ success: false, error: '请提供 concernIds 数组' });
    }

    const results = [];

    for (const cid of concernIds) {
      const ctx = await getOptimizeContextForConcern(prisma, cid, 4, 4);
      if (!ctx) {
        results.push({ id: cid, error: '问答对不存在或未关联转录' });
        continue;
      }
      const { concern, contextBefore, contextAfter } = ctx;
      const result = await transcriptionAiService.optimizeQAPair(
        concern.question,
        concern.answer || '',
        contextBefore,
        contextAfter,
        { modelName, promptId }
      );
      if (!result.success) {
        results.push({ id: cid, error: result.error || '优化失败' });
        continue;
      }
      if (save) {
        const updateData = { question: result.question, answer: result.answer };
        if (concern.question_original == null && concern.answer_original == null) {
          updateData.question_original = concern.question ?? '';
          updateData.answer_original = concern.answer ?? '';
        }
        await prisma.concerns.update({
          where: { id: cid },
          data: updateData
        });
      }
      results.push({
        id: cid,
        question: result.question,
        answer: result.answer,
        saved: !!save
      });
    }

    res.json({
      success: true,
      data: { results }
    });
  } catch (error) {
    console.error('批量问答对优化失败:', error);
    res.status(500).json({ success: false, error: error.message || '批量优化失败' });
  } finally {
    await prisma.$disconnect();
  }
});

module.exports = router;

