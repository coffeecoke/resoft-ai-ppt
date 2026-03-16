/**
 * 语音转录路由
 * 处理音频上传、转录、查询等接口
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const transcriptionService = require('../services/transcriptionService');
const transcriptionAiService = require('../services/transcriptionAiService');
const audioScanService = require('../services/audioScanService');
const concernClassificationService = require('../services/concernClassificationService');
const audioExtractor = require('../utils/audioExtractor');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads/audio');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

/**
 * 计算文本字符数（包括汉字和其他字符）
 * @param {string} text - 文本
 * @returns {number} 字符数
 */
function getTextLength(text) {
  if (!text) return 0;
  return text.length; // 一个汉字算1个字符，其他字符也算1个字符
}

/**
 * 限制对话数组的总长度，但不截断说话人的内容
 * @param {Array} dialogues - 对话数组
 * @param {number} maxLength - 最大字符数
 * @returns {Array} 限制后的对话数组
 */
function limitDialoguesByLength(dialogues, maxLength) {
  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    return dialogues;
  }
  
  let totalLength = 0;
  const limitedDialogues = [];
  
  for (const dialogue of dialogues) {
    const text = dialogue.text || dialogue.correctedText || dialogue.originalText || '';
    const textLength = getTextLength(text);
    
    // 如果加上当前对话后超过限制，停止添加（不截断当前说话人的内容）
    if (totalLength + textLength > maxLength && limitedDialogues.length > 0) {
      break;
    }
    
    limitedDialogues.push(dialogue);
    totalLength += textLength;
  }
  
  return limitedDialogues;
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名：时间戳_原始文件名
    const timestamp = Date.now();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueName = `${timestamp}_${originalName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // 支持的音频格式和视频格式
    const allowedAudioExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.wma', '.ogg'];
    const allowedVideoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.3g2'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedAudioExtensions.includes(ext) || allowedVideoExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}，支持的格式: ${[...allowedAudioExtensions, ...allowedVideoExtensions].join(', ')}`));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 限制 500MB（讯飞限制）
  }
});

/**
 * POST /api/transcription/upload
 * 上传音频并转录
 * 
 * @body {File} audio - 音频文件（multipart/form-data）
 * @body {String} [name] - 音频名称（可选，留空则使用原文件名）
 * @body {String} [customerName] - 客户名称（可选）
 * @body {String} [sessionId] - 关联场次ID（可选）
 * @body {String} [productId] - 关联产品ID（可选）
 */
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '未上传音频文件'
      });
    }

    console.log('📤 收到音频上传请求');
    console.log('文件名:', req.file.originalname);
    console.log('文件大小:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');
    if (req.body.name) {
      console.log('自定义名称:', req.body.name);
    }
    if (req.body.customerName) {
      console.log('客户名称:', req.body.customerName);
    }
    if (req.body.productId) {
      console.log('关联产品ID:', req.body.productId);
    }
    if (req.body.sessionId) {
      console.log('关联场次ID:', req.body.sessionId);
    }

    const uploadedFilePath = req.file.path;
    const originalFileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const customName = req.body.name ? req.body.name.trim() : null;

    // 检测是否为视频文件，如果是则提取音频
    let audioFilePath = uploadedFilePath;
    let extractedAudioPath = null;
    
    if (audioExtractor.isVideoFile(uploadedFilePath)) {
      console.log('🎬 检测到视频文件，开始提取音频...');
      
      // 检查 ffmpeg 是否可用
      const ffmpegAvailable = await audioExtractor.checkFFmpegAvailable();
      if (!ffmpegAvailable) {
        // 删除已上传的文件
        await fs.unlink(uploadedFilePath).catch(() => {});
        return res.status(400).json({
          success: false,
          error: '视频文件需要提取音频，但系统未安装 ffmpeg。请安装 ffmpeg 或直接上传音频文件。'
        });
      }
      
      try {
        // 从视频提取音频（输出为 wav 格式，兼容性最好）
        extractedAudioPath = await audioExtractor.extractAudioFromVideo(uploadedFilePath, 'wav');
        audioFilePath = extractedAudioPath;
        console.log('✅ 音频提取成功:', extractedAudioPath);
      } catch (error) {
        console.error('❌ 音频提取失败:', error);
        // 删除已上传的文件
        await fs.unlink(uploadedFilePath).catch(() => {});
        return res.status(500).json({
          success: false,
          error: `音频提取失败: ${error.message}`
        });
      }
    }

    // 调用转录服务
    console.log('🎯 开始转录...');
    const result = await transcriptionService.transcribeAudio(audioFilePath);

    console.log('✅ 转录成功');
    console.log('对话数量:', result.dialogues?.length);
    console.log('说话人数:', result.speakerCount);

    // 保存到数据库
    // 注意：如果是从视频提取的音频，audioFilePath 保存提取后的音频路径
    // 但 originalFileName 仍然保留原始视频文件名
    const transcription = await transcriptionService.saveTranscription({
      name: customName || originalFileName,
      originalFileName: originalFileName,
      audioFilePath: audioFilePath, // 如果是视频，这里是提取后的音频路径
      audioFileSize: req.file.size, // 原始文件大小
      audioFormat: result.audioFormat, // 转录后的音频格式（wav）
      audioDuration: result.audioDuration,
      resultFilePath: result.resultFilePath,
      dialogues: result.dialogues,
      fullText: result.fullText,
      speakerCount: result.speakerCount,
      customerName: req.body.customerName || null,
      sessionId: req.body.sessionId || null,
      productId: req.body.productId || null
    });
    
    // 如果提取了音频，可以选择删除临时提取的音频文件（可选）
    // 这里保留提取的音频文件，以便后续可能需要
    // 如果需要清理，可以在这里添加删除逻辑

    console.log('💾 已保存到数据库, ID:', transcription.id);

    res.json({
      success: true,
      message: '转录成功',
      data: {
        id: transcription.id,
        name: transcription.name,
        fileName: originalFileName,
        dialogues: result.dialogues,
        speakerCount: result.speakerCount,
        duration: result.audioDuration,
        createdAt: transcription.created_at
      }
    });

  } catch (error) {
    console.error('❌ 转录失败:', error);

    // 删除已上传的文件和提取的音频文件
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    // 如果提取了音频，也删除提取的音频文件
    if (extractedAudioPath) {
      await fs.unlink(extractedAudioPath).catch(() => {});
    }

    res.status(500).json({
      success: false,
      error: error.message || '转录失败'
    });
  }
});

/**
 * GET /api/transcription/:id/audio
 * 获取音频文件（支持流式传输）
 */
router.get('/:id/audio', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取转录记录
    const transcription = await transcriptionService.getTranscriptionById(id);
    
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }
    
    const audioPath = transcription.audio_file_path;
    if (!audioPath) {
      return res.status(404).json({
        success: false,
        error: '音频文件路径不存在'
      });
    }
    
    // 检查文件是否存在
    try {
      await fs.access(audioPath);
    } catch (error) {
      console.error(`音频文件不存在: ${audioPath}`);
      return res.status(404).json({
        success: false,
        error: '音频文件不存在'
      });
    }
    
    // 获取文件信息
    const stat = await fs.stat(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // 设置正确的Content-Type
    const ext = path.extname(audioPath).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.wma': 'audio/x-ms-wma',
      '.ogg': 'audio/ogg'
    };
    const contentType = mimeTypes[ext] || 'audio/mpeg';
    
    // 支持范围请求（重要：用于音频拖动）
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      
      const fsLib = require('fs');
      const stream = fsLib.createReadStream(audioPath, { start, end });
      stream.pipe(res);
    } else {
      // 完整文件响应
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      
      const fsLib = require('fs');
      const stream = fsLib.createReadStream(audioPath);
      stream.pipe(res);
    }
    
  } catch (error) {
    console.error('获取音频文件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/transcription/:id
 * 获取转录结果详情（包含调整记录，如果有）
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const transcription = await transcriptionService.getTranscriptionById(id);

    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    res.json({
      success: true,
      data: transcription
    });

  } catch (error) {
    console.error('获取转录记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/transcription/:id/merge-dialogues
 * 合并相邻同一说话人的对话
 */
router.post('/:id/merge-dialogues', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await transcriptionService.mergeDialogues(id);

    res.json({
      success: true,
      message: `合并成功：${result.originalCount} 条 → ${result.mergedCount} 条`,
      data: result
    });

  } catch (error) {
    console.error('合并对话失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '合并对话失败'
    });
  }
});

/**
 * GET /api/transcription
 * 获取转录列表
 * 
 * @query {Number} [page=1] - 页码
 * @query {Number} [pageSize=20] - 每页数量
 * @query {String} [status] - 状态筛选
 * @query {String} [customerName] - 客户名称筛选
 * @query {String} [productId] - 产品ID筛选
 * @query {String} [sessionId] - 场次ID筛选
 */
router.get('/', async (req, res) => {
  try {
    const { page, pageSize, status, customerName, productId, sessionId } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (customerName) filters.customerName = customerName;
    if (productId) filters.productId = productId;
    if (sessionId) filters.sessionId = sessionId;

    const pagination = {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    };

    const result = await transcriptionService.getTranscriptionList(filters, pagination);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取转录列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/transcription/:id
 * 更新转录记录（如修改名称、关联信息）
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, customerName, sessionId, productId, dialogues, speaker_roles } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (customerName !== undefined) updates.customer_name = customerName;
    if (sessionId !== undefined) updates.session_id = sessionId;
    if (productId !== undefined) updates.product_id = productId;
    
    // ✅ 支持更新对话内容（编辑功能）
    if (dialogues !== undefined) {
      updates.dialogues = JSON.stringify(dialogues);
      // 重新计算说话人数
      const speakers = [...new Set(dialogues.map(d => d.speaker))];
      updates.speaker_count = speakers.length;
    }
    
    // ✅ 支持更新说话人角色设置
    if (speaker_roles !== undefined) {
      updates.speaker_roles = typeof speaker_roles === 'string' 
        ? speaker_roles 
        : JSON.stringify(speaker_roles);
    }

    const transcription = await transcriptionService.updateTranscription(id, updates);

    res.json({
      success: true,
      message: '更新成功',
      data: transcription
    });

  } catch (error) {
    console.error('更新转录记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/transcription/:id
 * 删除转录记录
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await transcriptionService.deleteTranscription(id);

    res.json({
      success: true,
      message: '删除成功'
    });

  } catch (error) {
    console.error('删除转录记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 音频扫描相关接口 ====================

/**
 * GET /api/transcription/scan/config
 * 获取扫描配置
 */
router.get('/scan/config', async (req, res) => {
  try {
    const config = await audioScanService.getConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取扫描配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/transcription/scan/config
 * 更新扫描配置
 */
router.put('/scan/config', async (req, res) => {
  try {
    const config = await audioScanService.updateConfig(req.body);
    res.json({
      success: true,
      data: config,
      message: '配置已更新'
    });
  } catch (error) {
    console.error('更新扫描配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 扫描目录下的音频文件（内部逻辑，GET/POST 共用）
 * @param {object} opts - { page, pageSize, nameKeyword, transcribed?, roleSet? }
 *   transcribed: 'all' | 'yes' | 'no' — 是否转录
 *   roleSet: 'all' | 'yes' | 'no' — 是否进行角色设置
 */
async function handleScanFiles(opts) {
  const { page, pageSize, nameKeyword, transcribed: transcribedFilter, roleSet: roleSetFilter } = opts;
  const files = await audioScanService.scanAudioFiles();
  let filesWithStatus = await audioScanService.checkFilesStatus(files);

  if (nameKeyword) {
    const keyword = nameKeyword.toLowerCase();
    filesWithStatus = filesWithStatus.filter(f => {
      const matchFileName = f.fileName && f.fileName.toLowerCase().includes(keyword);
      const matchRelativePath = f.relativePath && f.relativePath.toLowerCase().includes(keyword);
      return matchFileName || matchRelativePath;
    });
    console.log(`🔍 按名称过滤 "${nameKeyword}"，剩余 ${filesWithStatus.length} 个文件`);
  }

  if (transcribedFilter === 'yes') {
    filesWithStatus = filesWithStatus.filter(f => f.transcribed === true);
    console.log(`🔍 筛选「已转录」，剩余 ${filesWithStatus.length} 个文件`);
  } else if (transcribedFilter === 'no') {
    filesWithStatus = filesWithStatus.filter(f => f.transcribed !== true);
    console.log(`🔍 筛选「待转录」，剩余 ${filesWithStatus.length} 个文件`);
  }

  if (roleSetFilter === 'yes') {
    filesWithStatus = filesWithStatus.filter(f => f.hasRoleSet === true);
    console.log(`🔍 筛选「已设角色」，剩余 ${filesWithStatus.length} 个文件`);
  } else if (roleSetFilter === 'no') {
    filesWithStatus = filesWithStatus.filter(f => f.hasRoleSet !== true);
    console.log(`🔍 筛选「未设角色」，剩余 ${filesWithStatus.length} 个文件`);
  }

  const total = filesWithStatus.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedFiles = filesWithStatus.slice(startIndex, endIndex);

  return {
    data: paginatedFiles,
    pagination: { page, pageSize, total, totalPages },
    message: `找到 ${total} 个音频文件`
  };
}

/**
 * GET /api/transcription/scan/files
 * 扫描目录下的音频文件（支持分页、按名称/是否转录/是否角色设置查询）
 * Query参数：page, pageSize, name?, transcribed?, roleSet?
 *   transcribed: all|yes|no  是否转录
 *   roleSet: all|yes|no      是否进行角色设置
 */
router.get('/scan/files', async (req, res) => {
  try {
    console.log('🔍 开始扫描音频文件...');
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const nameKeyword = (req.query.name || '').trim();
    const transcribed = (req.query.transcribed || 'all').toLowerCase();
    const roleSet = (req.query.roleSet || 'all').toLowerCase();
    
    if (page < 1) {
      return res.status(400).json({ success: false, error: '页码必须大于0' });
    }
    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ success: false, error: '每页数量必须在1-100之间' });
    }

    const result = await handleScanFiles({ page, pageSize, nameKeyword, transcribed, roleSet });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('扫描音频文件失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/transcription/scan/files
 * 扫描目录下的音频文件（支持分页、按名称/是否转录/是否角色设置查询）
 * Body: { page?, pageSize?, name?, transcribed?, roleSet? }
 */
router.post('/scan/files', async (req, res) => {
  try {
    console.log('🔍 开始扫描音频文件 (POST)...');
    const page = parseInt(req.body?.page) || 1;
    const pageSize = parseInt(req.body?.pageSize) || 20;
    const nameKeyword = (req.body?.name != null) ? String(req.body.name).trim() : '';
    const transcribed = ((req.body?.transcribed != null) ? String(req.body.transcribed) : 'all').toLowerCase();
    const roleSet = ((req.body?.roleSet != null) ? String(req.body.roleSet) : 'all').toLowerCase();

    if (page < 1) {
      return res.status(400).json({ success: false, error: '页码必须大于0' });
    }
    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ success: false, error: '每页数量必须在1-100之间' });
    }

    const result = await handleScanFiles({ page, pageSize, nameKeyword, transcribed, roleSet });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('扫描音频文件失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/transcription/scan/transcribe
 * 转录指定文件
 */
router.post('/scan/transcribe', async (req, res) => {
  try {
    const { filePath, fileName, customerName, productId, sessionId } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: '缺少文件路径参数'
      });
    }

    console.log('🎤 开始转录文件:', filePath);

    // 调用转录服务
    const result = await transcriptionService.transcribeAudio(filePath);

    // 保存转录结果
    const transcription = await transcriptionService.saveTranscription({
      name: fileName || path.basename(filePath),
      originalFileName: path.basename(filePath),
      audioFilePath: filePath,
      audioFileSize: result.audioFileSize || 0,
      audioFormat: path.extname(filePath).replace('.', ''),
      audioDuration: result.duration,
      resultFilePath: null,
      dialogues: result.dialogues,
      fullText: result.fullText,
      speakerCount: result.speakerCount,
      customerName: customerName || null,
      productId: productId || null,
      sessionId: sessionId || null
    });

    res.json({
      success: true,
      data: transcription,
      message: '转录成功'
    });

  } catch (error) {
    console.error('转录文件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/transcription/:id/ai-correction
 * AI 错别字修正及角色初步判断（自动保存到数据库）
 */
router.post('/:id/ai-correction', async (req, res) => {
  try {
    const { id } = req.params;
    const { modelName, autoSave = true, batchSize, dialogues } = req.body; 
    // autoSave: 是否自动保存，默认true
    // batchSize: 每批处理的对话数量
    // dialogues: 前端传递的对话内容（可选，如果不传则从数据库读取）

    // 1. 获取转录记录（用于验证记录是否存在）
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    // 2. 解析对话内容
    // 如果前端传递了对话内容，使用传递的内容；否则从数据库读取
    // ⚠️ 优先从最新的 dialogue_adjustments 记录读取（如果存在合并后的对话）
    let originalDialogues = null;
    
    if (dialogues && Array.isArray(dialogues) && dialogues.length > 0) {
      // 使用前端传递的对话内容
      originalDialogues = dialogues;
      console.log(`📥 使用前端传递的对话内容，共 ${dialogues.length} 条`);
      
      // 验证对话内容格式
      if (!originalDialogues.every(d => d && (d.text || d.correctedText || d.originalText))) {
        console.error('❌ 对话内容格式验证失败，部分对话缺少必要字段');
        return res.status(400).json({
          success: false,
          error: '对话内容格式错误：部分对话缺少必要字段（text/correctedText/originalText）'
        });
      }
    } else {
      // ⚠️ 优先从合并记录读取（如果存在合并后的对话）
      // 注意：不要读取之前的AI修正记录，只读取合并记录或原始对话
      const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        // 1. 优先查找合并记录（note1='合并相邻同一说话人的对话'）
        const mergeAdjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: id,
            note1: '合并相邻同一说话人的对话' // ✅ 只查找合并记录，不查找AI修正记录
          },
          orderBy: {
            created_at: 'desc'
          }
        });
        
        if (mergeAdjustment && mergeAdjustment.adjusted_dialogues) {
          // 从合并记录读取（合并后的对话）
          try {
            originalDialogues = JSON.parse(mergeAdjustment.adjusted_dialogues);
            console.log(`📥 从合并记录读取对话内容，共 ${originalDialogues?.length || 0} 条`);
            console.log(`📋 合并记录ID: ${mergeAdjustment.id}, 创建时间: ${mergeAdjustment.created_at}`);
          } catch (e) {
            console.warn(`⚠️ 解析合并记录失败，回退到 transcriptions 表: ${e.message}`);
            // 回退到从 transcriptions 表读取
            originalDialogues = transcription.dialogues;
          }
        } else {
          // 2. 没有合并记录，从 transcriptions 表读取原始对话
          originalDialogues = transcription.dialogues;
          console.log(`📥 从 transcriptions 表读取原始对话内容，共 ${originalDialogues?.length || 0} 条`);
          console.log(`💡 提示：未找到合并记录，将使用原始对话进行错别字修正`);
        }
        
        // 如果是字符串，解析为 JSON
        if (typeof originalDialogues === 'string') {
          try {
            originalDialogues = JSON.parse(originalDialogues);
          } catch (e) {
            console.error('❌ 解析数据库中的对话内容失败:', e.message);
            return res.status(400).json({
              success: false,
              error: '对话内容格式错误：无法解析JSON'
            });
          }
        }
      } catch (error) {
        console.error('❌ 读取 dialogue_adjustments 记录失败:', error.message);
        // 回退到从 transcriptions 表读取
        originalDialogues = transcription.dialogues;
        if (typeof originalDialogues === 'string') {
          try {
            originalDialogues = JSON.parse(originalDialogues);
          } catch (e) {
            console.error('❌ 解析数据库中的对话内容失败:', e.message);
            return res.status(400).json({
              success: false,
              error: '对话内容格式错误：无法解析JSON'
            });
          }
        }
        console.log(`📥 从 transcriptions 表读取对话内容，共 ${originalDialogues?.length || 0} 条`);
      } finally {
        await prisma.$disconnect();
      }
    }

    if (!originalDialogues || originalDialogues.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有对话内容可以修正'
      });
    }

    // 3. 调用 AI 进行修正和角色判断（支持分批处理，按6000字符分批）
    // 如果前端没有指定模型，会自动使用场景类型为 'transcription_correction' 的默认模型
    const actualBatchSize = batchSize || 50;
    console.log(`📥 接收到的请求参数: modelName=${modelName || '未指定'}, batchSize=${actualBatchSize}`);
    console.log(`📥 将发送 ${originalDialogues.length} 条对话给AI，将在服务层按6000字符自动分批处理`);
    
    const result = await transcriptionAiService.correctTyposAndRoles(originalDialogues, {
      modelName: modelName, // 可选参数，如果为空或未指定，将使用默认模型
      batchSize: batchSize || 50, // 每批处理的对话数量，默认50条（可在前端传参或在此修改）
      onProgress: (current, total) => {
        // 进度回调（可用于前端进度条）
        console.log(`📊 AI修正进度: ${current}/${total} (${Math.round(current/total*100)}%)`);
      }
    });

    // 4. 合并修正结果到原始对话（保留原始结构）
    const correctedDialogues = transcriptionAiService.mergeCorrections(
      originalDialogues,
      result.data.dialogues
    );

    // 5. 生成修正后的完整文本（用于保存到 dialogue_adjustments 表）
    const correctedFullText = correctedDialogues.map(d => {
      const timeRange = d.timeRange || '';
      const speaker = d.speaker || '未知说话人';
      const text = d.text || d.correctedText || '';
      return timeRange ? `[${timeRange}] 【${speaker}】\n${text}` : `【${speaker}】\n${text}`;
    }).join('\n\n');

    // 6. 如果 autoSave 为 true，自动保存到数据库
    let aiCorrectionAdjustment = null;
    
    if (autoSave) {
      // ⚠️ 重要：不要修改 transcriptions.dialogues 字段！
      // transcriptions.dialogues 应该始终保持原始转录结果
      // 修正后的对话只保存在 dialogue_adjustments 表中
      
      // 重新计算说话人数量
      const speakers = [...new Set(correctedDialogues.map(d => d.speaker))];
      
      // 不更新 transcriptions 表，只创建 dialogue_adjustments 记录
      console.log(`💾 修正结果将保存到 dialogue_adjustments 表（不修改 transcriptions.dialogues）`);

      // 6.2 创建 dialogue_adjustments 记录（保存AI修正后的内容）
      const { v4: uuidv4 } = require('uuid');
      const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        const adjustmentId = uuidv4();
        aiCorrectionAdjustment = await prisma.dialogue_adjustments.create({
          data: {
            id: adjustmentId,
            transcription_id: id,
            name: transcription.name,
            original_file_name: transcription.original_file_name,
            audio_file_path: transcription.audio_file_path,
            audio_file_size: transcription.audio_file_size,
            audio_format: transcription.audio_format,
            audio_duration: transcription.audio_duration,
            adjusted_dialogues: JSON.stringify(correctedDialogues), // 修正后的对话列表
            full_text: correctedFullText, // 修正后的完整文本
            xfyun_order_id: transcription.xfyun_order_id,
            speaker_count: speakers.length,
            has_role_separation: transcription.has_role_separation,
            // 注意：不再保存 speaker_roles，因为只做错别字修正
            session_id: transcription.session_id,
            product_id: transcription.product_id,
            customer_name: transcription.customer_name,
            note1: 'AI错别字修正',
            note2: `修正了 ${result.data.summary?.correctedCount || 0} 条对话，共 ${correctedDialogues.length} 条（基于 ${originalDialogues.length} 条原始对话）`
          }
        });
        
        // 转换 BigInt 字段
        const convertedAdjustment = transcriptionService.convertBigIntToNumber(aiCorrectionAdjustment);
        
        console.log(`✅ AI修正结果已保存到 dialogue_adjustments 表，调整记录ID: ${adjustmentId}`);
        console.log(`📊 原始对话: ${originalDialogues.length} 条，修正后: ${correctedDialogues.length} 条，修正数量: ${result.data.summary?.correctedCount || 0}`);
      } catch (error) {
        console.error('❌ 保存 dialogue_adjustments 记录失败:', error);
        throw error; // 抛出错误，让前端知道保存失败
      } finally {
        await prisma.$disconnect();
      }
    }

    // 7. 返回修正结果（内存优化：不返回原始数据，只返回修正后的数据）
    const responseData = {
      success: true,
      message: autoSave ? 'AI 分析完成并已保存' : 'AI 分析完成',
        data: {
          // 不返回 original，减少响应大小
          corrected: correctedDialogues,
          summary: result.data.summary,
          processingTime: result.processingTime,
          modelName: result.modelName,
          batchCount: result.batchCount || 1,
          saved: autoSave
        }
    };
    
    // 如果已保存，返回 adjustment 记录信息
    if (aiCorrectionAdjustment) {
      responseData.adjustment = {
        id: aiCorrectionAdjustment.id,
        transcription_id: aiCorrectionAdjustment.transcription_id,
        created_at: aiCorrectionAdjustment.created_at
      };
    }
    
    // 释放不需要的引用
    originalDialogues = null;
    
    res.json(responseData);

  } catch (error) {
    console.error('AI 错别字修正失败:', error);
    console.error('错误堆栈:', error.stack);
    
    // 返回详细的错误信息（开发环境）
    const errorMessage = error.message || 'AI 修正失败';
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? { stack: error.stack, name: error.name }
      : {};
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      ...errorDetails
    });
  }
});

/**
 * PUT /api/transcription/:id/apply-corrections
 * 应用 AI 修正结果
 */
router.put('/:id/apply-corrections', async (req, res) => {
  try {
    const { id } = req.params;
    const { correctedDialogues, roleSettings } = req.body;

    if (!correctedDialogues || !Array.isArray(correctedDialogues)) {
      return res.status(400).json({
        success: false,
        error: '缺少修正后的对话数据'
      });
    }

    // 1. 准备更新数据
    const updates = {
      dialogues: JSON.stringify(correctedDialogues)
    };

    // 2. 如果有角色设置，也一起更新
    if (roleSettings) {
      updates.speaker_roles = typeof roleSettings === 'string' 
        ? roleSettings 
        : JSON.stringify(roleSettings);
    }

    // 3. 重新计算说话人数量
    const speakers = [...new Set(correctedDialogues.map(d => d.speaker))];
    updates.speaker_count = speakers.length;

    // 4. 更新数据库
    const transcription = await transcriptionService.updateTranscription(id, updates);

    res.json({
      success: true,
      message: '修正已应用',
      data: transcription
    });

  } catch (error) {
    console.error('应用修正失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '应用修正失败'
    });
  }
});

/**
 * POST /api/transcription/:id/role-judgment
 * AI 角色判断（仅判断角色，不修正文本）
 */
router.post('/:id/role-judgment', async (req, res) => {
  try {
    const { id } = req.params;
    const { modelName, promptId, autoSave = true, dialogues } = req.body; 

    // 1. 获取转录记录
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    // 2. 确定要分析的对话内容
    let originalDialogues = dialogues;
    if (!originalDialogues || originalDialogues.length === 0) {
      // 如果没有提供，从数据库获取
      if (transcription.dialogues) {
        originalDialogues = Array.isArray(transcription.dialogues)
          ? transcription.dialogues
          : JSON.parse(transcription.dialogues);
      } else {
        return res.status(400).json({
          success: false,
          error: '对话内容为空'
        });
      }
    }

    // 3. 调用 AI 进行角色判断
    const result = await transcriptionAiService.judgeRoles(originalDialogues, {
      modelName: modelName,
      promptId: promptId,
      onProgress: (current, total) => {
        console.log(`📊 角色判断进度: ${current}/${total} (${Math.round(current/total*100)}%)`);
      }
    });

    // 4. 如果 autoSave 为 true，自动保存到 dialogue_adjustments 表
    let adjustmentRecord = null;
    if (autoSave && result.data && result.data.speakerRoles) {
      try {
        const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
        const prisma = new PrismaClient();
        
        try {
          // 优先查找AI修正记录（note1='AI错别字修正'），因为角色判断通常是基于AI修正后的对话
          let aiCorrectionAdjustment = await prisma.dialogue_adjustments.findFirst({
            where: {
              transcription_id: id,
              note1: 'AI错别字修正'
            },
            orderBy: { created_at: 'desc' }
          });
          
          if (aiCorrectionAdjustment) {
            // 如果存在AI修正记录，更新该记录的 speaker_roles 字段
            adjustmentRecord = await prisma.dialogue_adjustments.update({
              where: { id: aiCorrectionAdjustment.id },
              data: {
                speaker_roles: JSON.stringify(result.data.speakerRoles)
              }
            });
            console.log(`💾 角色判断结果已保存到 dialogue_adjustments 表（更新AI修正记录，ID: ${aiCorrectionAdjustment.id}）`);
          } else {
            // 如果没有AI修正记录，查找是否有角色判断记录
            let roleJudgmentAdjustment = await prisma.dialogue_adjustments.findFirst({
              where: {
                transcription_id: id,
                note1: '角色判断'
              },
              orderBy: { created_at: 'desc' }
            });
            
            if (roleJudgmentAdjustment) {
              // 如果存在角色判断记录，更新该记录
              adjustmentRecord = await prisma.dialogue_adjustments.update({
                where: { id: roleJudgmentAdjustment.id },
                data: {
                  speaker_roles: JSON.stringify(result.data.speakerRoles)
                }
              });
              console.log(`💾 角色判断结果已保存到 dialogue_adjustments 表（更新角色判断记录，ID: ${roleJudgmentAdjustment.id}）`);
            } else {
              // 如果没有相关记录，创建一个新的 dialogue_adjustments 记录
              const { v4: uuidv4 } = require('uuid');
              const adjustmentId = uuidv4();
              
              // 获取对话内容（用于创建记录）
              const dialoguesToSave = originalDialogues || [];
              
              adjustmentRecord = await prisma.dialogue_adjustments.create({
                data: {
                  id: adjustmentId,
                  transcription_id: id,
                  name: transcription.name,
                  original_file_name: transcription.original_file_name,
                  audio_file_path: transcription.audio_file_path,
                  audio_file_size: transcription.audio_file_size,
                  audio_format: transcription.audio_format,
                  audio_duration: transcription.audio_duration,
                  adjusted_dialogues: JSON.stringify(dialoguesToSave), // 保存用于角色判断的对话内容
                  full_text: dialoguesToSave.map(d => d.text || d.correctedText || d.originalText || '').join('\n'),
                  xfyun_order_id: transcription.xfyun_order_id,
                  speaker_count: result.data.summary?.totalSpeakers || 0,
                  has_role_separation: transcription.has_role_separation,
                  speaker_roles: JSON.stringify(result.data.speakerRoles), // ✅ 保存角色判断结果
                  session_id: transcription.session_id,
                  product_id: transcription.product_id,
                  customer_name: transcription.customer_name,
                  note1: '角色判断',
                  note2: `角色判断了 ${dialoguesToSave.length} 条对话，识别出 ${result.data.summary?.totalSpeakers || 0} 个说话人`
                }
              });
              console.log(`💾 角色判断结果已保存到 dialogue_adjustments 表（新建记录，ID: ${adjustmentId}）`);
            }
          }
          
          // 转换 BigInt 字段
          adjustmentRecord = transcriptionService.convertBigIntToNumber(adjustmentRecord);
          
        } finally {
          await prisma.$disconnect();
        }
      } catch (error) {
        console.error('❌ 保存角色判断结果失败:', error);
        console.error('错误堆栈:', error.stack);
        // 不抛出错误，因为角色判断已经完成
      }
    }

    const responseData = {
      success: true,
      message: autoSave ? '角色判断完成并已保存' : '角色判断完成',
      data: {
        speakerRoles: result.data.speakerRoles,
        summary: result.data.summary,
        processingTime: result.processingTime,
        modelName: result.modelName,
        sampleCount: result.sampleCount || 1,
        saved: autoSave
      }
    };
    
    // 如果已保存，返回 adjustment 记录信息
    if (adjustmentRecord) {
      responseData.adjustment = {
        id: adjustmentRecord.id,
        transcription_id: adjustmentRecord.transcription_id,
        note1: adjustmentRecord.note1,
        created_at: adjustmentRecord.created_at
      };
    }
    
    res.json(responseData);

  } catch (error) {
    console.error('角色判断失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.stack : (error.message || '角色判断失败'),
      details: error.message
    });
  }
});

/**
 * PUT /api/transcription/:id/role-settings
 * 保存角色设置到 dialogue_adjustments 表
 */
router.put('/:id/role-settings', async (req, res) => {
  try {
    const { id } = req.params;
    const { speaker_roles } = req.body;

    if (!speaker_roles) {
      return res.status(400).json({
        success: false,
        error: '缺少角色设置数据'
      });
    }

    // 1. 获取转录记录
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    // 2. 查找或创建 dialogue_adjustments 记录
    const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // 优先查找AI修正记录（note1='AI错别字修正'）
      let adjustment = await prisma.dialogue_adjustments.findFirst({
        where: {
          transcription_id: id,
          note1: 'AI错别字修正'
        },
        orderBy: { created_at: 'desc' }
      });
      
      if (adjustment) {
        // 如果存在AI修正记录，更新该记录的 speaker_roles 字段
        adjustment = await prisma.dialogue_adjustments.update({
          where: { id: adjustment.id },
          data: {
            speaker_roles: typeof speaker_roles === 'string' 
              ? speaker_roles 
              : JSON.stringify(speaker_roles)
          }
        });
        console.log(`💾 角色设置已保存到 dialogue_adjustments 表（更新AI修正记录，ID: ${adjustment.id}）`);
      } else {
        // 查找是否有角色判断记录
        adjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: id,
            note1: '角色判断'
          },
          orderBy: { created_at: 'desc' }
        });
        
        if (adjustment) {
          // 如果存在角色判断记录，更新该记录
          adjustment = await prisma.dialogue_adjustments.update({
            where: { id: adjustment.id },
            data: {
              speaker_roles: typeof speaker_roles === 'string' 
                ? speaker_roles 
                : JSON.stringify(speaker_roles)
            }
          });
          console.log(`💾 角色设置已保存到 dialogue_adjustments 表（更新角色判断记录，ID: ${adjustment.id}）`);
        } else {
          // 如果都不存在，查找最新的调整记录
          adjustment = await prisma.dialogue_adjustments.findFirst({
            where: { transcription_id: id },
            orderBy: { created_at: 'desc' }
          });
          
          if (adjustment) {
            // 如果存在调整记录，更新该记录
            adjustment = await prisma.dialogue_adjustments.update({
              where: { id: adjustment.id },
              data: {
                speaker_roles: typeof speaker_roles === 'string' 
                  ? speaker_roles 
                  : JSON.stringify(speaker_roles)
              }
            });
            console.log(`💾 角色设置已保存到 dialogue_adjustments 表（更新调整记录，ID: ${adjustment.id}）`);
          } else {
            // 如果没有任何调整记录，创建一个新的记录
            const { v4: uuidv4 } = require('uuid');
            const adjustmentId = uuidv4();
            
            // 获取对话内容（用于创建记录）
            let dialogues = transcription.dialogues;
            if (typeof dialogues === 'string') {
              try {
                dialogues = JSON.parse(dialogues);
              } catch (e) {
                dialogues = [];
              }
            }
            
            adjustment = await prisma.dialogue_adjustments.create({
              data: {
                id: adjustmentId,
                transcription_id: id,
                name: transcription.name,
                original_file_name: transcription.original_file_name,
                audio_file_path: transcription.audio_file_path,
                audio_file_size: transcription.audio_file_size,
                audio_format: transcription.audio_format,
                audio_duration: transcription.audio_duration,
                adjusted_dialogues: JSON.stringify(dialogues || []),
                full_text: (dialogues || []).map(d => d.text || d.correctedText || d.originalText || '').join('\n'),
                xfyun_order_id: transcription.xfyun_order_id,
                speaker_count: transcription.speaker_count || 0,
                has_role_separation: transcription.has_role_separation,
                speaker_roles: typeof speaker_roles === 'string' 
                  ? speaker_roles 
                  : JSON.stringify(speaker_roles),
                session_id: transcription.session_id,
                product_id: transcription.product_id,
                customer_name: transcription.customer_name,
                note1: '角色设置',
                note2: '手动设置说话人角色'
              }
            });
            console.log(`💾 角色设置已保存到 dialogue_adjustments 表（新建记录，ID: ${adjustmentId}）`);
          }
        }
      }
      
      // 转换 BigInt 字段
      const convertedAdjustment = transcriptionService.convertBigIntToNumber(adjustment);
      
      res.json({
        success: true,
        message: '角色设置已保存',
        data: {
          adjustment: convertedAdjustment,
          speaker_roles: typeof speaker_roles === 'string' 
            ? JSON.parse(speaker_roles) 
            : speaker_roles
        }
      });
      
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('保存角色设置失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || '保存角色设置失败'
    });
  }
});

/**
 * PUT /api/transcription/:id/dialogues
 * 保存对话修改到 dialogue_adjustments 表
 * 同时更新合并对话和错别字修正后的内容（如果存在）
 */
router.put('/:id/dialogues', async (req, res) => {
  try {
    const { id } = req.params;
    const { dialogues, tabType } = req.body; // tabType: 'original' | 'merged' | 'corrected'

    if (!dialogues || !Array.isArray(dialogues)) {
      return res.status(400).json({
        success: false,
        error: '缺少对话数据'
      });
    }

    // 1. 获取转录记录
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    // 2. 获取所有相关的 adjustment 记录
    const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // 查找AI修正记录
      let aiCorrectionAdjustment = await prisma.dialogue_adjustments.findFirst({
        where: {
          transcription_id: id,
          note1: 'AI错别字修正'
        },
        orderBy: { created_at: 'desc' }
      });
      
      // 查找合并记录
      let mergeAdjustment = await prisma.dialogue_adjustments.findFirst({
        where: {
          transcription_id: id,
          note1: '合并相邻同一说话人的对话'
        },
        orderBy: { created_at: 'desc' }
      });
      
      // 查找角色判断记录（可能包含speaker_roles）
      let roleJudgmentAdjustment = await prisma.dialogue_adjustments.findFirst({
        where: {
          transcription_id: id,
          OR: [
            { note1: '角色判断' },
            { note1: '角色设置' }
          ]
        },
        orderBy: { created_at: 'desc' }
      });
      
      // 3. 根据 tabType 确定要更新哪个记录
      let targetAdjustment = null;
      let adjustmentNote = '';
      
      if (tabType === 'corrected' && aiCorrectionAdjustment) {
        targetAdjustment = aiCorrectionAdjustment;
        adjustmentNote = 'AI错别字修正';
      } else if (tabType === 'merged' && mergeAdjustment) {
        targetAdjustment = mergeAdjustment;
        adjustmentNote = '合并相邻同一说话人的对话';
      } else if (aiCorrectionAdjustment) {
        // 默认优先使用AI修正记录
        targetAdjustment = aiCorrectionAdjustment;
        adjustmentNote = 'AI错别字修正';
      } else if (mergeAdjustment) {
        targetAdjustment = mergeAdjustment;
        adjustmentNote = '合并相邻同一说话人的对话';
      }
      
      // 4. 更新对话内容（包括说话人替换）
      // 需要同步更新所有相关的 adjustment 记录
      const updatedAdjustments = [];
      
      // 4.1 更新目标 adjustment 记录
      if (targetAdjustment) {
        // 解析现有的对话内容（用于检测说话人变化）
        let existingDialogues = [];
        if (targetAdjustment.adjusted_dialogues) {
          try {
            existingDialogues = typeof targetAdjustment.adjusted_dialogues === 'string'
              ? JSON.parse(targetAdjustment.adjusted_dialogues)
              : targetAdjustment.adjusted_dialogues;
          } catch (e) {
            existingDialogues = [];
          }
        }
        
        // 获取原始对话（从 transcriptions 表），用于检测说话人批量替换
        let originalDialogues = transcription.dialogues;
        if (typeof originalDialogues === 'string') {
          try {
            originalDialogues = JSON.parse(originalDialogues);
          } catch (e) {
            originalDialogues = [];
          }
        }
        if (!Array.isArray(originalDialogues)) {
          originalDialogues = [];
        }
        
        // 更新目标 adjustment 记录
        const updated = await prisma.dialogue_adjustments.update({
          where: { id: targetAdjustment.id },
          data: {
            adjusted_dialogues: JSON.stringify(dialogues),
            full_text: dialogues.map(d => d.text || d.correctedText || d.originalText || '').join('\n'),
            speaker_count: [...new Set(dialogues.map(d => d.speaker))].length
          }
        });
        updatedAdjustments.push(transcriptionService.convertBigIntToNumber(updated));
        
        // ✅ 检测说话人批量替换：对比修改前后的对话，找出说话人变化
        // ⚠️ 重要：无论编辑哪个标签页，都应该对比修改前后的对话（existingDialogues vs dialogues）
        // 而不是对比原始对话和修改后的对话，因为合并后的对话中说话人可能已经和原始对话不同了
        const speakerChanges = new Map();
        
        if (existingDialogues.length === dialogues.length) {
          // ✅ 对比修改前后的对话（适用于所有标签页）
          // 统计每个原说话人变成了哪些新说话人
          const speakerMapping = new Map();
          
          existingDialogues.forEach((oldDialogue, index) => {
            if (dialogues[index] && oldDialogue.speaker !== dialogues[index].speaker) {
              const fromSpeaker = oldDialogue.speaker;
              const toSpeaker = dialogues[index].speaker;
              
              // 记录映射关系
              if (!speakerMapping.has(fromSpeaker)) {
                speakerMapping.set(fromSpeaker, new Set());
              }
              speakerMapping.get(fromSpeaker).add(toSpeaker);
            }
          });
          
          // 如果某个原说话人在所有对话中都变成了同一个新说话人，认为是批量替换
          speakerMapping.forEach((newSpeakers, fromSpeaker) => {
            if (newSpeakers.size === 1) {
              const toSpeaker = Array.from(newSpeakers)[0];
              speakerChanges.set(fromSpeaker, toSpeaker);
            }
          });
        }
        
        // 如果有说话人批量替换，同步更新合并记录和AI修正记录
        if (speakerChanges.size > 0) {
          console.log(`🔄 检测到说话人批量替换:`, Array.from(speakerChanges.entries()).map(([from, to]) => `${from} -> ${to}`).join(', '));
          
          // 更新合并记录（如果存在且不是当前目标记录）
          if (mergeAdjustment && mergeAdjustment.id !== targetAdjustment.id) {
            let mergedDialogues = [];
            if (mergeAdjustment.adjusted_dialogues) {
              try {
                mergedDialogues = typeof mergeAdjustment.adjusted_dialogues === 'string'
                  ? JSON.parse(mergeAdjustment.adjusted_dialogues)
                  : mergeAdjustment.adjusted_dialogues;
              } catch (e) {
                mergedDialogues = [];
              }
            }
            
            // 应用说话人替换
            speakerChanges.forEach((toSpeaker, fromSpeaker) => {
              mergedDialogues = replaceSpeakerInDialogues(mergedDialogues, fromSpeaker, toSpeaker);
            });
            
            const updatedMerged = await prisma.dialogue_adjustments.update({
              where: { id: mergeAdjustment.id },
              data: {
                adjusted_dialogues: JSON.stringify(mergedDialogues),
                full_text: mergedDialogues.map(d => d.text || d.correctedText || d.originalText || '').join('\n'),
                speaker_count: [...new Set(mergedDialogues.map(d => d.speaker))].length
              }
            });
            updatedAdjustments.push(transcriptionService.convertBigIntToNumber(updatedMerged));
            console.log(`✅ 已同步更新合并记录（ID: ${mergeAdjustment.id}）的说话人`);
          }
          
          // 更新AI修正记录（如果存在且不是当前目标记录）
          if (aiCorrectionAdjustment && aiCorrectionAdjustment.id !== targetAdjustment.id) {
            let correctedDialogues = [];
            if (aiCorrectionAdjustment.adjusted_dialogues) {
              try {
                correctedDialogues = typeof aiCorrectionAdjustment.adjusted_dialogues === 'string'
                  ? JSON.parse(aiCorrectionAdjustment.adjusted_dialogues)
                  : aiCorrectionAdjustment.adjusted_dialogues;
              } catch (e) {
                correctedDialogues = [];
              }
            }
            
            // 应用说话人替换
            speakerChanges.forEach((toSpeaker, fromSpeaker) => {
              correctedDialogues = replaceSpeakerInDialogues(correctedDialogues, fromSpeaker, toSpeaker);
            });
            
            const updatedCorrected = await prisma.dialogue_adjustments.update({
              where: { id: aiCorrectionAdjustment.id },
              data: {
                adjusted_dialogues: JSON.stringify(correctedDialogues),
                full_text: correctedDialogues.map(d => d.text || d.correctedText || d.originalText || '').join('\n'),
                speaker_count: [...new Set(correctedDialogues.map(d => d.speaker))].length
              }
            });
            updatedAdjustments.push(transcriptionService.convertBigIntToNumber(updatedCorrected));
            console.log(`✅ 已同步更新AI修正记录（ID: ${aiCorrectionAdjustment.id}）的说话人`);
          }
        }
      } else {
        // 没有找到 adjustment 记录，创建一个新的
        const { v4: uuidv4 } = require('uuid');
        const adjustmentId = uuidv4();
        
        const newAdjustment = await prisma.dialogue_adjustments.create({
          data: {
            id: adjustmentId,
            transcription_id: id,
            name: transcription.name,
            original_file_name: transcription.original_file_name,
            audio_file_path: transcription.audio_file_path,
            audio_file_size: transcription.audio_file_size,
            audio_format: transcription.audio_format,
            audio_duration: transcription.audio_duration,
            adjusted_dialogues: JSON.stringify(dialogues),
            full_text: dialogues.map(d => d.text || d.correctedText || d.originalText || '').join('\n'),
            xfyun_order_id: transcription.xfyun_order_id,
            speaker_count: [...new Set(dialogues.map(d => d.speaker))].length,
            has_role_separation: transcription.has_role_separation,
            speaker_roles: roleJudgmentAdjustment ? roleJudgmentAdjustment.speaker_roles : null,
            session_id: transcription.session_id,
            product_id: transcription.product_id,
            customer_name: transcription.customer_name,
            note1: tabType === 'corrected' ? 'AI错别字修正' : tabType === 'merged' ? '合并相邻同一说话人的对话' : '手动编辑对话',
            note2: '用户手动编辑对话内容或替换说话人'
          }
        });
        updatedAdjustments.push(transcriptionService.convertBigIntToNumber(newAdjustment));
      }
      
      res.json({
        success: true,
        message: '对话修改已保存',
        data: {
          adjustments: updatedAdjustments,
          tabType: tabType
        }
      });
      
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('保存对话修改失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || '保存对话修改失败'
    });
  }
});

/**
 * 辅助函数：根据说话人替换映射更新对话列表
 * @param {Array} dialogues - 要更新的对话列表
 * @param {string} fromSpeaker - 原说话人
 * @param {string} toSpeaker - 新说话人
 * @returns {Array} 更新后的对话列表
 */
function replaceSpeakerInDialogues(dialogues, fromSpeaker, toSpeaker) {
  if (!Array.isArray(dialogues)) {
    return [];
  }
  
  return dialogues.map(dialogue => {
    if (dialogue.speaker === fromSpeaker) {
      return { ...dialogue, speaker: toSpeaker };
    }
    return dialogue;
  });
}

/**
 * POST /api/transcription/:id/re-merge
 * 手动触发重新合并对话（基于已有的 adjustment 记录）
 */
router.post('/:id/re-merge', async (req, res) => {
  try {
    const { id } = req.params;
    const { tabType = 'original' } = req.body; // ✅ 移除 autoMerge 参数，总是创建新记录

    // 1. 获取转录记录
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    // 2. 根据 tabType 确定数据来源
    let sourceDialogues = [];
    let sourceNote1 = '';

    if (tabType === 'corrected') {
      // ✅ 数据来源：dialogue_adjustments 表，note1='AI错别字修正'
      // ⚠️ 重要：直接从数据库实时查询，确保获取最新的数据（包括保存后的说话人替换）
      const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
      const prisma = new PrismaClient();
      try {
        const aiCorrection = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: id,
            note1: 'AI错别字修正'
          },
          orderBy: { created_at: 'desc' }
        });
        
        if (aiCorrection && aiCorrection.adjusted_dialogues) {
          sourceDialogues = typeof aiCorrection.adjusted_dialogues === 'string'
            ? JSON.parse(aiCorrection.adjusted_dialogues)
            : aiCorrection.adjusted_dialogues;
          sourceNote1 = 'AI错别字修正';
          console.log(`📥 再次合并：从数据库实时查询AI修正记录（ID: ${aiCorrection.id}），共 ${sourceDialogues?.length || 0} 条对话`);
        }
      } finally {
        await prisma.$disconnect();
      }
    } else if (tabType === 'merged') {
      // ✅ 数据来源：dialogue_adjustments 表，note1='合并相邻同一说话人的对话'（第一次合并）
      // ⚠️ 重要：直接从数据库实时查询，确保获取最新的数据（包括保存后的说话人替换）
      const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
      const prisma = new PrismaClient();
      try {
        const mergeAdjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: id,
            note1: '合并相邻同一说话人的对话'
          },
          orderBy: { created_at: 'desc' }
        });
        
        if (mergeAdjustment && mergeAdjustment.adjusted_dialogues) {
          sourceDialogues = typeof mergeAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(mergeAdjustment.adjusted_dialogues)
            : mergeAdjustment.adjusted_dialogues;
          sourceNote1 = '合并相邻同一说话人的对话';
          console.log(`📥 再次合并：从数据库实时查询合并记录（ID: ${mergeAdjustment.id}），共 ${sourceDialogues?.length || 0} 条对话`);
        }
      } finally {
        await prisma.$disconnect();
      }
    } else if (tabType === 'remerged') {
      // ✅ 数据来源：dialogue_adjustments 表，note1='再次合并对话'（可以从再次合并的记录再次合并）
      // ⚠️ 重要：直接从数据库实时查询，确保获取最新的数据（包括保存后的说话人替换）
      const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
      const prisma = new PrismaClient();
      try {
        const reMergeAdjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: id,
            note1: '再次合并对话'
          },
          orderBy: { created_at: 'desc' }
        });
        
        if (reMergeAdjustment && reMergeAdjustment.adjusted_dialogues) {
          sourceDialogues = typeof reMergeAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(reMergeAdjustment.adjusted_dialogues)
            : reMergeAdjustment.adjusted_dialogues;
          sourceNote1 = '再次合并对话';
          console.log(`📥 再次合并：从数据库实时查询再次合并记录（ID: ${reMergeAdjustment.id}），共 ${sourceDialogues?.length || 0} 条对话`);
        }
      } finally {
        await prisma.$disconnect();
      }
    } else {
      // 数据来源：transcriptions 表，dialogues 字段
      sourceDialogues = transcription.dialogues || [];
      if (typeof sourceDialogues === 'string') {
        try {
          sourceDialogues = JSON.parse(sourceDialogues);
        } catch (e) {
          sourceDialogues = [];
        }
      }
      sourceNote1 = '原始对话';
    }

    if (!sourceDialogues || sourceDialogues.length === 0) {
      return res.status(400).json({
        success: false,
        error: `源对话数据为空（tabType: ${tabType}）。请确保对应的记录存在。`
      });
    }

    // 3. ✅ 执行重新合并（不再使用 autoMerge，总是创建新记录，note1='再次合并对话'）
    const result = await transcriptionService.reMergeDialogues(
      id,
      sourceDialogues,
      {
        sourceNote1: sourceNote1 // ✅ 传入来源标识
      }
    );

    res.json({
      success: true,
      message: `重新合并成功：${result.originalCount} 条 → ${result.mergedCount} 条`,
      data: result
    });

  } catch (error) {
    console.error('重新合并失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || '重新合并失败'
    });
  }
});

/**
 * POST /api/transcription/:id/qa-extraction
 * 提取问答对并保存到 concerns 表
 */
router.post('/:id/qa-extraction', async (req, res) => {
  try {
    const { id } = req.params;
    const { modelName, promptId, dialogues } = req.body;

    // 1. 获取转录记录
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    // 2. ✅ 确定要分析的对话内容（优先使用最后一次合并完成后的内容：再次合并 > AI修正 > 第一次合并 > 原始对话）
    let sourceDialogues = dialogues;
    if (!sourceDialogues || sourceDialogues.length === 0) {
      const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        // ✅ 1. 最优先：再次合并后的对话（note1='再次合并对话'）
        const reMergeAdjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: id,
            note1: '再次合并对话'
          },
          orderBy: { created_at: 'desc' }
        });
        
        if (reMergeAdjustment && reMergeAdjustment.adjusted_dialogues) {
          sourceDialogues = typeof reMergeAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(reMergeAdjustment.adjusted_dialogues)
            : reMergeAdjustment.adjusted_dialogues;
          console.log(`📥 问答对提取：使用再次合并后的对话，共 ${sourceDialogues?.length || 0} 条`);
        }
        
        // ✅ 2. 其次：AI修正后的对话（note1='AI错别字修正'）
        if (!sourceDialogues || sourceDialogues.length === 0) {
          const aiCorrectionAdjustment = await prisma.dialogue_adjustments.findFirst({
            where: {
              transcription_id: id,
              note1: 'AI错别字修正'
            },
            orderBy: { created_at: 'desc' }
          });
          
          if (aiCorrectionAdjustment && aiCorrectionAdjustment.adjusted_dialogues) {
            sourceDialogues = typeof aiCorrectionAdjustment.adjusted_dialogues === 'string'
              ? JSON.parse(aiCorrectionAdjustment.adjusted_dialogues)
              : aiCorrectionAdjustment.adjusted_dialogues;
            console.log(`📥 问答对提取：使用AI修正后的对话，共 ${sourceDialogues?.length || 0} 条`);
          }
        }
        
        // ✅ 3. 再次：第一次合并后的对话（note1='合并相邻同一说话人的对话'）
        if (!sourceDialogues || sourceDialogues.length === 0) {
          const mergeAdjustment = await prisma.dialogue_adjustments.findFirst({
            where: {
              transcription_id: id,
              note1: '合并相邻同一说话人的对话'
            },
            orderBy: { created_at: 'desc' }
          });
          
          if (mergeAdjustment && mergeAdjustment.adjusted_dialogues) {
            sourceDialogues = typeof mergeAdjustment.adjusted_dialogues === 'string'
              ? JSON.parse(mergeAdjustment.adjusted_dialogues)
              : mergeAdjustment.adjusted_dialogues;
            console.log(`📥 问答对提取：使用第一次合并后的对话，共 ${sourceDialogues?.length || 0} 条`);
          }
        }
        
        // ✅ 4. 最后：原始对话（从 transcriptions 表）
        if (!sourceDialogues || sourceDialogues.length === 0) {
          sourceDialogues = transcription.dialogues || [];
          if (typeof sourceDialogues === 'string') {
            try {
              sourceDialogues = JSON.parse(sourceDialogues);
            } catch (e) {
              sourceDialogues = [];
            }
          }
          console.log(`📥 问答对提取：使用原始对话，共 ${sourceDialogues?.length || 0} 条`);
        }
      } finally {
        await prisma.$disconnect();
      }
    }

    if (!sourceDialogues || sourceDialogues.length === 0) {
      return res.status(400).json({
        success: false,
        error: '对话内容为空，请先加载对话内容'
      });
    }

    // 3. 获取角色信息（从 dialogue_adjustments 或 transcriptions）
    let speakerRoles = {};
    if (transcription.adjustment && transcription.adjustment.speaker_roles) {
      speakerRoles = typeof transcription.adjustment.speaker_roles === 'string'
        ? JSON.parse(transcription.adjustment.speaker_roles)
        : transcription.adjustment.speaker_roles;
    } else if (transcription.speaker_roles) {
      speakerRoles = typeof transcription.speaker_roles === 'string'
        ? JSON.parse(transcription.speaker_roles)
        : transcription.speaker_roles;
    }

    if (!speakerRoles || Object.keys(speakerRoles).length === 0) {
      return res.status(400).json({
        success: false,
        error: '未找到角色信息，请先进行角色判断'
      });
    }

    console.log(`🚀 开始提取问答对，对话数量: ${sourceDialogues.length} 条，角色数量: ${Object.keys(speakerRoles).length} 个`);

    // 4. 调用AI提取问答对
    const result = await transcriptionAiService.extractQAPairs(
      sourceDialogues,
      speakerRoles,
      {
        modelName: modelName,
        promptId: promptId,
        onProgress: (current, total) => {
          console.log(`📊 问答对提取进度: ${current}/${total} (${Math.round(current/total*100)}%)`);
        }
      }
    );

    if (!result.success || !result.qaPairs || result.qaPairs.length === 0) {
      return res.json({
        success: true,
        message: '未提取到问答对',
        data: {
          qaPairs: [],
          concerns: [],
          sessionLinked: false,
          summary: result.summary || { totalPairs: 0, answeredPairs: 0, pendingPairs: 0 }
        }
      });
    }

    // 5. 保存到 concerns 表
    const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const createdConcerns = [];
      const sessionId = transcription.session_id;
      
      for (let i = 0; i < result.qaPairs.length; i++) {
        const qaPair = result.qaPairs[i];
        
        // ✅ 过滤掉自问自答的问答对（question_speaker 和 answer_speaker 相同）
        const questionSpeaker = qaPair.question_speaker ? String(qaPair.question_speaker).trim() : null;
        const answerSpeaker = qaPair.answer_speaker ? String(qaPair.answer_speaker).trim() : null;
        if (questionSpeaker && answerSpeaker && questionSpeaker === answerSpeaker) {
          console.log(`⏭️  跳过自问自答的问答对（不入库）: 问题说话人=${questionSpeaker}, 回答说话人=${answerSpeaker}, 问题="${qaPair.question ? qaPair.question.substring(0, 50) + '...' : '(无问题)'}"`);
          continue; // 跳过，不入库
        }
        
        const { v4: uuidv4 } = require('uuid');
        const concernId = uuidv4();
        
        // ✅ 调试：输出第一个问答对的字段
        if (i === 0) {
          console.log(`🔍 ========== 保存问答对 ${i + 1} 的原始字段 ==========`);
          console.log(`📋 完整数据:`, JSON.stringify(qaPair, null, 2));
          console.log(`   - time_range: ${qaPair.time_range !== undefined ? JSON.stringify(qaPair.time_range) : '(undefined)'} (类型: ${typeof qaPair.time_range})`);
          console.log(`   - time_range1: ${qaPair.time_range1 !== undefined ? JSON.stringify(qaPair.time_range1) : '(undefined)'} (类型: ${typeof qaPair.time_range1})`);
          console.log(`   - time_range2: ${qaPair.time_range2 !== undefined ? JSON.stringify(qaPair.time_range2) : '(undefined)'} (类型: ${typeof qaPair.time_range2})`);
          console.log(`   - question_speaker: ${qaPair.question_speaker || '(null)'}`);
          console.log(`   - answer_speaker: ${qaPair.answer_speaker || '(null)'}`);
          console.log(`==================================================`);
        }
        
        // 创建 concerns 记录
        const now = new Date();
        // ⚠️ 使用明确的 null/undefined 检查，确保有效值能正确保存
        // 如果 time_range1 存在且非空字符串，使用它；否则使用 time_range；最后才是 null
        let timeRange1 = null;
        if (qaPair.time_range1 !== undefined && qaPair.time_range1 !== null && String(qaPair.time_range1).trim() !== '') {
          timeRange1 = String(qaPair.time_range1).trim();
        } else if (qaPair.time_range !== undefined && qaPair.time_range !== null && String(qaPair.time_range).trim() !== '') {
          timeRange1 = String(qaPair.time_range).trim();
        }
        
        let timeRange2 = null;
        if (qaPair.time_range2 !== undefined && qaPair.time_range2 !== null && String(qaPair.time_range2).trim() !== '') {
          timeRange2 = String(qaPair.time_range2).trim();
        }
        
        // ✅ 调试：输出即将保存的字段值
        if (i === 0) {
          console.log(`💾 ========== 准备保存到数据库的字段值 ==========`);
          console.log(`   - time_range: ${timeRange1 || '(null)'}`);
          console.log(`   - time_range1: ${timeRange1 || '(null)'}`);
          console.log(`   - time_range2: ${timeRange2 || '(null)'}`);
          console.log(`   - timeRange1 判断逻辑: qaPair.time_range1=${JSON.stringify(qaPair.time_range1)}, qaPair.time_range=${JSON.stringify(qaPair.time_range)}, 结果=${timeRange1}`);
          console.log(`   - timeRange2 判断逻辑: qaPair.time_range2=${JSON.stringify(qaPair.time_range2)}, 结果=${timeRange2}`);
          console.log(`   - 准备保存的数据对象:`, JSON.stringify({
            id: concernId,
            question: qaPair.question.substring(0, 50) + '...',
            time_range: timeRange1,
            time_range1: timeRange1,
            time_range2: timeRange2
          }, null, 2));
          console.log(`==================================================`);
        }
        
        const createData = {
          id: concernId,
          question: qaPair.question,
          answer: qaPair.answer || null,
          status: qaPair.answer && qaPair.answer.length > 0 ? 'answered' : 'pending',
          time_range: timeRange1, // 兼容旧格式，保存问题的时间范围
          time_range1: timeRange1, // 问题时间范围
          time_range2: timeRange2, // 回答时间范围
          question_speaker: qaPair.question_speaker || null,
          answer_speaker: qaPair.answer_speaker || null,
          transcription_id: id, // 关联转录ID
          category: null, // 可选，AI可以自动分类
          priority: null, // 可选，AI可以评估优先级
          created_at: now, // ✅ 手动设置创建时间（确保兼容性）
          updated_at: now  // ✅ 手动设置更新时间（schema 修改后 Prisma 会自动管理，但手动设置更安全）
        };
        
        // ✅ 调试：输出最终要保存的数据对象（仅第一个）
        if (i === 0) {
          console.log(`📦 ========== 最终要保存的数据对象（第一个） ==========`);
          console.log(`   - createData.time_range: ${createData.time_range || '(null)'}`);
          console.log(`   - createData.time_range1: ${createData.time_range1 || '(null)'}`);
          console.log(`   - createData.time_range2: ${createData.time_range2 || '(null)'}`);
          console.log(`==================================================`);
        }
        
        const concern = await prisma.concerns.create({
          data: createData
        });
        
        // ✅ 调试：输出保存后的字段值（第一个）
        if (i === 0) {
          console.log(`✅ ========== 保存成功，数据库中的字段值 ==========`);
          console.log(`   - time_range: ${concern.time_range || '(null)'}`);
          console.log(`   - time_range1: ${concern.time_range1 || '(null)'}`);
          console.log(`   - time_range2: ${concern.time_range2 || '(null)'}`);
          console.log(`   - concern 完整对象:`, JSON.stringify(concern, null, 2));
          console.log(`==================================================`);
        }
        
        createdConcerns.push(concern);
        
        // 如果转录记录有关联的 session_id，创建 session_concerns 关联记录
        if (sessionId) {
          const sessionConcernId = uuidv4();
          await prisma.session_concerns.create({
            data: {
              id: sessionConcernId,
              session_id: sessionId,
              concern_id: concernId,
              sort_order: i + 1, // 按提取顺序排序
            }
          });
          console.log(`✅ 已创建 session_concerns 关联记录 (session_id: ${sessionId}, concern_id: ${concernId}, sort_order: ${i + 1})`);
        }
      }
      
      console.log(`💾 成功保存 ${createdConcerns.length} 个问答对到 concerns 表`);
      if (sessionId) {
        console.log(`✅ 已关联到 session_id: ${sessionId}`);
      } else {
        console.log(`⚠️ 转录记录未关联 session_id，未创建 session_concerns 关联记录`);
      }
      
      // 转换 BigInt 字段
      const convertedConcerns = createdConcerns.map(concern => transcriptionService.convertBigIntToNumber(concern));
      
      res.json({
        success: true,
        message: `成功提取 ${result.qaPairs.length} 个问答对`,
        data: {
          qaPairs: result.qaPairs,
          concerns: convertedConcerns,
          sessionLinked: !!sessionId,
          sessionId: sessionId,
          transcriptionId: id
        },
        summary: result.summary,
        processingTime: result.processingTime,
        modelName: result.modelName
      });
      
    } catch (dbError) {
      console.error('❌ 保存问答对到数据库失败:', dbError);
      throw dbError;
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('问答对提取失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || '问答对提取失败',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/transcription/:id/qa-pairs
 * 获取转录记录关联的问答对
 * 支持两种查询方式：
 * 1. 通过 transcription_id 直接查询（如果 concerns 表有 transcription_id 字段）
 * 2. 通过 session_id 间接查询（通过 session_concerns 关联）
 */
router.get('/:id/qa-pairs', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. 获取转录记录
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      let concernsList = [];
      
      // 方式1：通过 transcription_id 直接查询（推荐，如果字段存在）
      try {
        concernsList = await prisma.concerns.findMany({
          where: {
            transcription_id: id
          },
          include: {
            concern_categories: true // 包含分类信息
          },
          orderBy: {
            created_at: 'asc'
          }
        });
        console.log(`📥 通过 transcription_id 查询到 ${concernsList.length} 个问答对`);
      } catch (error) {
        // 如果字段不存在，会报错，使用方式2
        console.log(`⚠️ 通过 transcription_id 查询失败（可能字段不存在），尝试通过 session_id 查询: ${error.message}`);
      }
      
      // 方式2：如果方式1没有结果，通过 session_id 间接查询
      if (concernsList.length === 0 && transcription.session_id) {
        const sessionConcerns = await prisma.session_concerns.findMany({
          where: {
            session_id: transcription.session_id
          },
          include: {
            concerns: {
              include: {
                concern_categories: true // 包含分类信息
              }
            }
          },
          orderBy: {
            sort_order: 'asc'
          }
        });
        
        concernsList = sessionConcerns.map(sc => sc.concerns).filter(c => c);
        console.log(`📥 通过 session_id 查询到 ${concernsList.length} 个问答对`);
      }
      
      const qaPairs = concernsList.map(concern => ({
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
        time_range: concern.time_range || concern.time_range1 || null, // 兼容旧格式
        time_range1: concern.time_range1 || concern.time_range || null, // 问题时间范围
        time_range2: concern.time_range2 || null, // 回答时间范围
        question_speaker: concern.question_speaker,
        answer_speaker: concern.answer_speaker,
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
      }));
      
      res.json({
        success: true,
        data: {
          qaPairs: qaPairs,
          sessionId: transcription.session_id,
          transcriptionId: id,
          totalCount: qaPairs.length
        }
      });
      
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('查询问答对失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || '查询问答对失败'
    });
  }
});

/**
 * POST /api/transcription/:id/qa-classification
 * 对转录记录的所有问答对进行分类
 * 
 * @param {string} id - 转录记录ID
 * @body {string} [modelId] - 模型ID（可选，不传则使用默认模型）
 * @body {string} [promptCode] - 提示词代码（可选，不传则使用默认提示词）
 * @body {number} [concurrency=3] - 并发数（可选，默认3）
 */
router.post('/:id/qa-classification', async (req, res) => {
  try {
    const { id } = req.params;
    const { modelId, promptCode, concurrency } = req.body;

    // 1. 验证转录记录是否存在
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    console.log(`🚀 开始对转录记录进行问答对分类: ${id}`);

    // 2. 调用分类服务
    const result = await concernClassificationService.classifyConcernsByTranscription(
      id,
      {
        modelId,
        promptCode,
        concurrency: concurrency || 3,
        onProgress: (current, total) => {
          console.log(`📊 问答对分类进度: ${current}/${total} (${Math.round(current/total*100)}%)`);
        }
      }
    );

    res.json({
      success: true,
      data: result,
      message: `分类完成：成功 ${result.successCount} 个，失败 ${result.errorCount} 个`
    });

  } catch (error) {
    console.error('问答对分类失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '问答对分类失败',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/transcription/concern/:concernId/classification
 * 对单个问答对进行分类
 * 
 * @param {string} concernId - 问答对ID
 * @body {string} [modelId] - 模型ID（可选）
 * @body {string} [promptCode] - 提示词代码（可选）
 */
router.post('/concern/:concernId/classification', async (req, res) => {
  try {
    const { concernId } = req.params;
    const { modelId, promptCode } = req.body;

    console.log(`🚀 开始对问答对进行分类: ${concernId}`);

    // 调用分类服务
    const result = await concernClassificationService.classifyConcern(concernId, {
      modelId,
      promptCode
    });

    res.json({
      success: true,
      data: result,
      message: '分类成功'
    });

  } catch (error) {
    console.error('问答对分类失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '问答对分类失败',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/transcription/concerns/batch-classification
 * 批量对问答对进行分类
 * 
 * @body {Array<string>} concernIds - 问答对ID数组
 * @body {string} [modelId] - 模型ID（可选）
 * @body {string} [promptCode] - 提示词代码（可选）
 * @body {number} [batchSize=50] - 每批处理数量（可选，默认50）
 * @body {number} [concurrency=3] - 并发数（可选，默认3，已弃用，改用batchSize）
 */
router.post('/concerns/batch-classification', async (req, res) => {
  try {
    const { concernIds, modelId, promptCode, batchSize, concurrency } = req.body;

    if (!concernIds || !Array.isArray(concernIds) || concernIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供问答对ID数组'
      });
    }

    console.log(`🚀 开始批量分类问答对: 总数=${concernIds.length}, 每批=${batchSize || 50}个`);

    // 调用分类服务（后端自动分批处理）
    const result = await concernClassificationService.classifyConcerns(concernIds, {
      modelId,
      promptCode,
      batchSize: batchSize || 50,  // 每批处理数量，默认50
      onProgress: (current, total) => {
        console.log(`📊 问答对分类进度: ${current}/${total} (${Math.round(current/total*100)}%)`);
      }
    });

    res.json({
      success: true,
      data: result,
      message: `批量分类完成：成功 ${result.successCount} 个，失败 ${result.errorCount} 个`
    });

  } catch (error) {
    console.error('批量问答对分类失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '批量问答对分类失败',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;

