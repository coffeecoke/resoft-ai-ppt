/**
 * 语音转录服务
 * 负责调用 Python 脚本与讯飞API交互，并管理转录记录
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// ✅ 使用正确的 Prisma Client 导入方式
const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

class TranscriptionService {
  constructor() {
    // Python 脚本路径（更新为新的模块化路径）
    this.pythonScript = path.join(__dirname, '../../python_services/transcription/service.py');
    // Python 解释器路径（可以通过环境变量配置）
    this.pythonPath = process.env.PYTHON_PATH || 'python';
  }

  /**
   * 转录音频文件
   * @param {string} audioFilePath - 音频文件绝对路径
   * @returns {Promise<Object>} 转录结果
   */
  async transcribeAudio(audioFilePath) {
    return new Promise((resolve, reject) => {
      console.log('🎤 开始调用 Python 转录服务...');
      console.log('音频文件:', audioFilePath);
      console.log('Python 脚本:', this.pythonScript);

      // 设置环境变量以确保 Python 使用 UTF-8 编码
      const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
      const pythonProcess = spawn(this.pythonPath, [this.pythonScript, audioFilePath], { env });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.setEncoding('utf8'); // 设置 UTF-8 编码
      pythonProcess.stderr.setEncoding('utf8');

      pythonProcess.stdout.on('data', (data) => {
        stdout += data;
        // 实时输出日志（方便调试）
        console.log('[Python]', data.trim());
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data;
        console.error('[Python Error]', data.trim());
      });

      pythonProcess.on('close', (code) => {
        console.log(`Python 进程退出，代码: ${code}`);

        if (code !== 0) {
          return reject(new Error(`Python脚本执行失败 (退出码: ${code})\n${stderr}`));
        }

        try {
          // 解析最后一行JSON输出（Python脚本的返回结果）
          const lines = stdout.trim().split('\n');
          const jsonOutput = lines[lines.length - 1];
          
          console.log('解析 Python 输出:', jsonOutput);
          
          const result = JSON.parse(jsonOutput);

          if (!result.success) {
            return reject(new Error(result.error || '转录失败'));
          }

          resolve(result.data);
        } catch (error) {
          reject(new Error(`解析 Python 输出失败: ${error.message}\n完整输出:\n${stdout}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`无法启动 Python 进程: ${error.message}`));
      });
    });
  }

  /**
   * 保存转录记录到数据库
   * @param {Object} data - 转录数据
   * @returns {Promise<Object>} 数据库记录
   */
  async saveTranscription(data) {
    // ✅ prisma 已在文件顶部导入，无需重复导入
    const transcription = await prisma.transcriptions.create({
      data: {
        id: uuidv4(),
        name: data.name || data.originalFileName,
        original_file_name: data.originalFileName,
        audio_file_path: data.audioFilePath,
        audio_file_size: data.audioFileSize || 0,
        audio_format: data.audioFormat || '',
        audio_duration: data.audioDuration || null,
        result_file_path: data.resultFilePath || null,
        dialogues: JSON.stringify(data.dialogues || []),
        full_text: data.fullText || null,
        speaker_count: data.speakerCount || 0,
        has_role_separation: true,
        session_id: data.sessionId || null,
        product_id: data.productId || null,
        customer_name: data.customerName || null,
        status: 'completed',
        progress: 100,
        completed_at: new Date(),
        updated_at: new Date()
      }
    });

    // ✅ 转换 BigInt 为 Number，避免 JSON 序列化错误
    return {
      ...transcription,
      audio_file_size: transcription.audio_file_size ? Number(transcription.audio_file_size) : 0
    };
  }

  /**
   * 更新转录状态
   * @param {string} id - 转录记录ID
   * @param {Object} updates - 更新数据
   */
  async updateTranscription(id, updates) {
    // ✅ prisma 已在文件顶部导入
    const transcription = await prisma.transcriptions.update({
      where: { id },
      data: {
        ...updates,
        updated_at: new Date()
      }
    });
    
    // ✅ 转换 BigInt 为 Number，避免 JSON 序列化错误
    return {
      ...transcription,
      audio_file_size: transcription.audio_file_size ? Number(transcription.audio_file_size) : 0
    };
  }

  /**
   * 根据ID获取转录记录
   * @param {string} id - 转录记录ID
   */
  /**
   * 转换对象中的 BigInt 为 Number（递归处理）
   * @param {any} obj - 要转换的对象
   * @returns {any} 转换后的对象
   */
  convertBigIntToNumber(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'bigint') {
      return Number(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertBigIntToNumber(item));
    }
    
    if (typeof obj === 'object') {
      const converted = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          converted[key] = this.convertBigIntToNumber(obj[key]);
        }
      }
      return converted;
    }
    
    return obj;
  }

  async getTranscriptionById(id) {
    // ✅ prisma 已在文件顶部导入
    const transcription = await prisma.transcriptions.findUnique({
      where: { id },
      include: {
        sessions: true,
        products: true
      }
    });

    if (!transcription) {
      return null;
    }

    // 保存原始对话（从 transcriptions 表）
    let originalDialogues = transcription.dialogues;
    if (typeof originalDialogues === 'string') {
      try {
        originalDialogues = JSON.parse(originalDialogues);
      } catch (e) {
        originalDialogues = [];
      }
    }

    // 获取调整记录（分别获取合并记录、AI修正记录和角色判断记录）
    // 1. 查找AI修正记录（note1='AI错别字修正'）
    let aiCorrectionAdjustment = await prisma.dialogue_adjustments.findFirst({
      where: { 
        transcription_id: id,
        note1: 'AI错别字修正'
      },
      orderBy: { created_at: 'desc' }
    });
    
    // 2. 查找角色判断记录（note1='角色判断'）或包含 speaker_roles 的记录
    let roleJudgmentAdjustment = await prisma.dialogue_adjustments.findFirst({
      where: { 
        transcription_id: id,
        OR: [
          { note1: '角色判断' },
          { note1: '角色设置' },
          { speaker_roles: { not: null } } // 查找任何包含 speaker_roles 的记录
        ]
      },
      orderBy: { created_at: 'desc' }
    });
    
    // 3. 查找合并记录（note1='合并相邻同一说话人的对话'）- 第一次合并
    let mergeAdjustment = await prisma.dialogue_adjustments.findFirst({
      where: { 
        transcription_id: id,
        note1: '合并相邻同一说话人的对话'
      },
      orderBy: { created_at: 'desc' }
    });
    
    // 4. ✅ 查找再次合并记录（note1='再次合并对话'）- 重新合并后的内容
    let reMergeAdjustment = await prisma.dialogue_adjustments.findFirst({
      where: { 
        transcription_id: id,
        note1: '再次合并对话'
      },
      orderBy: { created_at: 'desc' }
    });
    
    // 5. 优先使用包含 speaker_roles 的记录（角色判断记录或AI修正记录），如果没有则使用合并记录
    // 如果AI修正记录包含 speaker_roles，优先使用它；否则使用角色判断记录
    let latestAdjustment = null;
    if (aiCorrectionAdjustment && aiCorrectionAdjustment.speaker_roles) {
      latestAdjustment = aiCorrectionAdjustment; // AI修正记录包含角色设置，优先使用
    } else if (roleJudgmentAdjustment) {
      latestAdjustment = roleJudgmentAdjustment; // 使用角色判断记录
    } else if (aiCorrectionAdjustment) {
      latestAdjustment = aiCorrectionAdjustment; // 使用AI修正记录（即使没有角色设置）
    } else if (reMergeAdjustment) {
      latestAdjustment = reMergeAdjustment; // ✅ 使用再次合并记录
    } else if (mergeAdjustment) {
      latestAdjustment = mergeAdjustment; // 使用合并记录（兼容旧数据）
    } else {
      // 如果都没有，查找最新的调整记录
      latestAdjustment = await prisma.dialogue_adjustments.findFirst({
        where: { transcription_id: id },
        orderBy: { created_at: 'desc' }
      });
    }

    // 将调整记录附加到转录记录中
    // ✅ 优先返回AI修正记录（如果存在），前端会根据 note1 判断类型
    if (latestAdjustment) {
      transcription.adjustment = latestAdjustment;
      
      // 解析调整后的对话（从 dialogue_adjustments 表）
      if (latestAdjustment.adjusted_dialogues) {
        try {
          const adjustedDialogues = typeof latestAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(latestAdjustment.adjusted_dialogues)
            : latestAdjustment.adjusted_dialogues;
          transcription.adjustment.adjusted_dialogues = adjustedDialogues;
        } catch (e) {
          console.error('解析调整后的对话失败:', e);
          transcription.adjustment.adjusted_dialogues = [];
        }
      }
    }
    
    // ✅ 同时保存合并记录（第一次合并，如果存在且不是最新记录）
    // 前端可以通过这个字段获取合并后的对话（即使后面有AI修正记录）
    if (mergeAdjustment && mergeAdjustment.id !== latestAdjustment?.id) {
      transcription.mergeAdjustment = mergeAdjustment;
      // 解析合并后的对话
      if (mergeAdjustment.adjusted_dialogues) {
        try {
          const mergedDialogues = typeof mergeAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(mergeAdjustment.adjusted_dialogues)
            : mergeAdjustment.adjusted_dialogues;
          transcription.mergeAdjustment.adjusted_dialogues = mergedDialogues;
        } catch (e) {
          console.error('解析合并后的对话失败:', e);
          transcription.mergeAdjustment.adjusted_dialogues = [];
        }
      }
    }
    
    // ✅ 同时保存再次合并记录（无论是否是最新记录，都单独返回）
    // 前端可以通过这个字段获取再次合并后的对话
    if (reMergeAdjustment) {
      transcription.reMergeAdjustment = reMergeAdjustment;
      // 解析再次合并后的对话
      if (reMergeAdjustment.adjusted_dialogues) {
        try {
          const reMergedDialogues = typeof reMergeAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(reMergeAdjustment.adjusted_dialogues)
            : reMergeAdjustment.adjusted_dialogues;
          transcription.reMergeAdjustment.adjusted_dialogues = reMergedDialogues;
        } catch (e) {
          console.error('解析再次合并后的对话失败:', e);
          transcription.reMergeAdjustment.adjusted_dialogues = [];
        }
      }
    }

    // 确保 dialogues 字段始终是原始对话（从 transcriptions 表）
    transcription.dialogues = originalDialogues;
    transcription.original_dialogues = originalDialogues; // 也保存一份作为备份

    // 转换所有 BigInt 字段为 Number（包括 adjustment 对象）
    return this.convertBigIntToNumber(transcription);
  }

  /**
   * 获取转录列表
   * @param {Object} filters - 筛选条件
   * @param {Object} pagination - 分页参数
   */
  async getTranscriptionList(filters = {}, pagination = {}) {
    // ✅ prisma 已在文件顶部导入
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where = {};

    // 按状态筛选
    if (filters.status) {
      where.status = filters.status;
    }

    // 按客户名称筛选
    if (filters.customerName) {
      where.customer_name = {
        contains: filters.customerName
      };
    }

    // 按产品筛选
    if (filters.productId) {
      where.product_id = filters.productId;
    }

    // 按场次筛选
    if (filters.sessionId) {
      where.session_id = filters.sessionId;
    }

    const [total, list] = await Promise.all([
      prisma.transcriptions.count({ where }),
      prisma.transcriptions.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          created_at: 'desc'
        },
        include: {
          sessions: true,
          products: true
        }
      })
    ]);

    // 解析 dialogues 字段并转换 BigInt
    const listWithDialogues = list.map(item => ({
      ...item,
      audio_file_size: item.audio_file_size ? Number(item.audio_file_size) : 0, // 转换 BigInt 为 Number
      dialogues: item.dialogues ? JSON.parse(item.dialogues) : []
    }));

    return {
      list: listWithDialogues,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * 删除转录记录
   * @param {string} id - 转录记录ID
   */
  async deleteTranscription(id) {
    // ✅ prisma 已在文件顶部导入
    
    // 可选：同时删除音频文件和结果文件
    const transcription = await this.getTranscriptionById(id);
    
    if (transcription) {
      try {
        // 删除音频文件
        if (transcription.audio_file_path) {
          await fs.unlink(transcription.audio_file_path).catch(() => {});
        }
        // 删除结果文件
        if (transcription.result_file_path) {
          await fs.unlink(transcription.result_file_path).catch(() => {});
        }
      } catch (error) {
        console.error('删除文件失败:', error);
      }
    }

    return await prisma.transcriptions.delete({
      where: { id }
    });
  }

  /**
   * 计算文本字符数（包括汉字和其他字符）
   * @param {string} text - 文本
   * @returns {number} 字符数
   */
  getTextLength(text) {
    if (!text) return 0;
    return text.length; // 一个汉字算1个字符，其他字符也算1个字符
  }

  /**
   * 内部合并逻辑（提取为独立方法，可复用）
   * @private
   * @param {Array} dialogues - 要合并的对话列表
   * @returns {Array} 合并后的对话列表
   */
  _mergeDialoguesLogic(dialogues) {
    if (!Array.isArray(dialogues) || dialogues.length === 0) {
      return [];
    }

    const MAX_MERGE_LENGTH = 2000; // 单条合并后的对话最大长度（字符数）
    const mergedDialogues = [];
    let currentDialogue = null;

    // 解析时间范围的辅助函数
    const parseTimeRange = (range) => {
      if (!range || !range.includes('-')) return { start: null, end: null };
      const parts = range.split('-');
      if (parts.length !== 2) return { start: null, end: null };
      
      const parseTime = (timeStr) => {
        const trimmed = timeStr.trim();
        const timeParts = trimmed.split(':');
        if (timeParts.length === 2) {
          // MM:SS 格式
          return parseInt(timeParts[0]) * 60 + parseFloat(timeParts[1]);
        } else if (timeParts.length === 3) {
          // HH:MM:SS 格式
          return parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseFloat(timeParts[2]);
        }
        return 0;
      };
      
      return {
        start: parseTime(parts[0]),
        end: parseTime(parts[1])
      };
    };

    // 格式化时间为字符串
    const formatTime = (seconds) => {
      if (seconds === null || seconds === undefined) return '00:00';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    for (const dialogue of dialogues) {
      const speaker = dialogue.speaker || dialogue.speakerName;
      const timeRange = dialogue.timeRange || dialogue.startTime || '';
      const text = dialogue.text || dialogue.correctedText || dialogue.originalText || '';

      if (!currentDialogue || currentDialogue.speaker !== speaker) {
        // 新的说话人，先保存当前对话（如果有）
        if (currentDialogue) {
          mergedDialogues.push(currentDialogue);
        }
        
        // 创建新对话（即使单条超过限制也要完整保存，不截断）
        const timeInfo = parseTimeRange(timeRange);
        currentDialogue = {
          speaker: speaker,
          timeRange: timeRange,
          text: text,
          startTime: timeInfo.start,
          endTime: timeInfo.end
        };
      } else {
        // 同一说话人，尝试合并对话
        const mergedText = (currentDialogue.text + ' ' + text).trim();
        const mergedTextLength = this.getTextLength(mergedText);
        
        // 如果合并后超过限制，先保存当前对话，然后创建新对话
        if (mergedTextLength > MAX_MERGE_LENGTH) {
          // 保存当前对话
          mergedDialogues.push(currentDialogue);
          
          // 创建新对话（包含当前这条，不截断）
          const timeInfo = parseTimeRange(timeRange);
          currentDialogue = {
            speaker: speaker,
            timeRange: timeRange,
            text: text,
            startTime: timeInfo.start,
            endTime: timeInfo.end
          };
        } else {
          // 可以合并，更新当前对话
          const timeInfo = parseTimeRange(timeRange);
          if (timeInfo.start !== null && currentDialogue.endTime !== null) {
            // 合并时间范围
            currentDialogue.timeRange = `${formatTime(currentDialogue.startTime)}-${formatTime(timeInfo.end)}`;
            currentDialogue.endTime = timeInfo.end;
          } else {
            // 如果无法解析时间，保留原始格式
            const currentStart = currentDialogue.timeRange ? currentDialogue.timeRange.split('-')[0] : '';
            const currentEnd = timeInfo.end ? formatTime(timeInfo.end) : (timeRange && timeRange.split('-')[1] || '');
            currentDialogue.timeRange = `${currentStart}-${currentEnd}`;
          }
          // 合并文本（用空格连接）
          currentDialogue.text = mergedText;
        }
      }
    }

    // 添加最后一个对话
    if (currentDialogue) {
      mergedDialogues.push(currentDialogue);
    }

    return mergedDialogues;
  }

  /**
   * 合并相邻同一说话人的对话（从 transcriptions 表读取）
   * @param {string} transcriptionId - 转录ID
   * @returns {Promise<Object>} 合并后的调整记录
   */
  async mergeDialogues(transcriptionId) {
    // 1. 获取原始转录记录
    const transcription = await this.getTranscriptionById(transcriptionId);
    if (!transcription) {
      throw new Error('转录记录不存在');
    }

    // 2. 解析对话内容
    let dialogues = transcription.dialogues;
    if (typeof dialogues === 'string') {
      try {
        dialogues = JSON.parse(dialogues);
      } catch (e) {
        throw new Error('对话内容格式错误');
      }
    }

    if (!Array.isArray(dialogues) || dialogues.length === 0) {
      throw new Error('没有对话内容可以合并');
    }

    // 3. 使用提取的合并逻辑
    const mergedDialogues = this._mergeDialoguesLogic(dialogues);

    // 4. 生成完整文本
    const fullText = mergedDialogues.map(d => `${d.speaker}: ${d.text}`).join('\n');

    // 5. 创建调整记录
    const { v4: uuidv4 } = require('uuid');
    const adjustmentId = uuidv4();
    const adjustment = await prisma.dialogue_adjustments.create({
      data: {
        id: adjustmentId,
        transcription_id: transcriptionId,
        name: transcription.name,
        original_file_name: transcription.original_file_name,
        audio_file_path: transcription.audio_file_path,
        audio_file_size: transcription.audio_file_size,
        audio_format: transcription.audio_format,
        audio_duration: transcription.audio_duration,
        adjusted_dialogues: JSON.stringify(mergedDialogues),
        full_text: fullText,
        xfyun_order_id: transcription.xfyun_order_id,
        speaker_count: transcription.speaker_count,
        has_role_separation: transcription.has_role_separation,
        speaker_roles: transcription.speaker_roles,
        session_id: transcription.session_id,
        product_id: transcription.product_id,
        customer_name: transcription.customer_name,
        note1: '合并相邻同一说话人的对话',
        note2: `合并前: ${dialogues.length} 条，合并后: ${mergedDialogues.length} 条`
      }
    });

    // 转换 BigInt 字段
    const convertedAdjustment = this.convertBigIntToNumber(adjustment);

    return {
      success: true,
      adjustment: convertedAdjustment,
      originalCount: dialogues.length,
      mergedCount: mergedDialogues.length
    };
  }

  /**
   * 重新合并对话（基于已有的 adjustment 记录）
   * @param {string} transcriptionId - 转录ID
   * @param {Array} sourceDialogues - 源对话数据（从 adjustment 记录读取）
   * @param {Object} options - 选项
   * @param {boolean} options.autoMerge - 已废弃，不再使用（为了向后兼容保留）
   * @param {string} options.sourceNote1 - 源记录的 note1（用于标识来源）
   * @returns {Promise<Object>} 合并后的调整记录
   */
  async reMergeDialogues(transcriptionId, sourceDialogues, options = {}) {
    const { sourceNote1 = null } = options;

    // 1. 验证数据
    if (!Array.isArray(sourceDialogues) || sourceDialogues.length === 0) {
      throw new Error('源对话数据为空');
    }

    // 2. 使用提取的合并逻辑
    const mergedDialogues = this._mergeDialoguesLogic(sourceDialogues);

    // 3. 获取转录记录（用于创建新记录）
    const transcription = await this.getTranscriptionById(transcriptionId);
    if (!transcription) {
      throw new Error('转录记录不存在');
    }
    
    // ✅ 获取最新的 speaker_roles（优先从包含角色设置的 adjustment 记录获取）
    let latestSpeakerRoles = null;
    if (transcription.adjustment && transcription.adjustment.speaker_roles) {
      latestSpeakerRoles = typeof transcription.adjustment.speaker_roles === 'string'
        ? transcription.adjustment.speaker_roles
        : JSON.stringify(transcription.adjustment.speaker_roles);
    } else if (transcription.speaker_roles) {
      latestSpeakerRoles = typeof transcription.speaker_roles === 'string'
        ? transcription.speaker_roles
        : JSON.stringify(transcription.speaker_roles);
    }

    // 4. ✅ 重新合并总是创建新记录，不覆盖第一次合并
    // 查找是否已有"再次合并"记录（用于判断是更新还是创建）
    const existingReMergeAdjustment = await prisma.dialogue_adjustments.findFirst({
      where: {
        transcription_id: transcriptionId,
        note1: '再次合并对话'
      },
      orderBy: { created_at: 'desc' }
    });

    // 5. 生成完整文本
    const fullText = mergedDialogues.map(d => `${d.speaker}: ${d.text}`).join('\n');

    let adjustment;
    const { v4: uuidv4 } = require('uuid');

    // 6. ✅ 如果已有再次合并记录，更新它；否则创建新记录
    if (existingReMergeAdjustment) {
      // 更新现有的再次合并记录
      adjustment = await prisma.dialogue_adjustments.update({
        where: { id: existingReMergeAdjustment.id },
        data: {
          adjusted_dialogues: JSON.stringify(mergedDialogues),
          full_text: fullText,
          speaker_count: [...new Set(mergedDialogues.map(d => d.speaker))].length,
          // ✅ 更新时也更新 speaker_roles（如果有新的）
          speaker_roles: latestSpeakerRoles || existingReMergeAdjustment.speaker_roles,
          note2: `再次合并：${sourceDialogues.length} 条 → ${mergedDialogues.length} 条（基于${sourceNote1 || '调整记录'}）`
        }
      });
    } else {
      // 创建新的再次合并记录（不覆盖第一次合并）
      const adjustmentId = uuidv4();
      adjustment = await prisma.dialogue_adjustments.create({
        data: {
          id: adjustmentId,
          transcription_id: transcriptionId,
          name: transcription.name,
          original_file_name: transcription.original_file_name,
          audio_file_path: transcription.audio_file_path,
          audio_file_size: transcription.audio_file_size,
          audio_format: transcription.audio_format,
          audio_duration: transcription.audio_duration,
          adjusted_dialogues: JSON.stringify(mergedDialogues),
          full_text: fullText,
          xfyun_order_id: transcription.xfyun_order_id,
          speaker_count: [...new Set(mergedDialogues.map(d => d.speaker))].length,
          has_role_separation: transcription.has_role_separation,
          // ✅ 使用获取的最新 speaker_roles
          speaker_roles: latestSpeakerRoles,
          session_id: transcription.session_id,
          product_id: transcription.product_id,
          customer_name: transcription.customer_name,
          note1: '再次合并对话', // ✅ 使用新的标识，区别于第一次合并
          note2: `再次合并：${sourceDialogues.length} 条 → ${mergedDialogues.length} 条（基于${sourceNote1 || '调整记录'}）`
        }
      });
    }

    // 转换 BigInt 字段
    const convertedAdjustment = this.convertBigIntToNumber(adjustment);

    return {
      success: true,
      adjustment: convertedAdjustment,
      originalCount: sourceDialogues.length,
      mergedCount: mergedDialogues.length,
      isNewRecord: !existingReMergeAdjustment
    };
  }
}

module.exports = new TranscriptionService();

