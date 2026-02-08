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
      questionSource
    } = req.query;

    const where = {};
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
      questionSource // 新增：问题发起方筛选
    } = req.query;

    // 构建查询条件
    const where = {};

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

module.exports = router;

