/**
 * 语音转录路由
 * 处理音频上传、转录、查询等接口
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const transcriptionService = require('../services/transcriptionService');
const audioScanService = require('../services/audioScanService');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads/audio');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

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
    // 支持的音频格式
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.wma', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的音频格式: ${ext}，支持的格式: ${allowedExtensions.join(', ')}`));
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

    const audioFilePath = req.file.path;
    const originalFileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const customName = req.body.name ? req.body.name.trim() : null;

    // 调用转录服务
    console.log('🎯 开始转录...');
    const result = await transcriptionService.transcribeAudio(audioFilePath);

    console.log('✅ 转录成功');
    console.log('对话数量:', result.dialogues?.length);
    console.log('说话人数:', result.speakerCount);

    // 保存到数据库
    const transcription = await transcriptionService.saveTranscription({
      name: customName || originalFileName,
      originalFileName: originalFileName,
      audioFilePath: audioFilePath,
      audioFileSize: req.file.size,
      audioFormat: result.audioFormat,
      audioDuration: result.audioDuration,
      resultFilePath: result.resultFilePath,
      dialogues: result.dialogues,
      fullText: result.fullText,
      speakerCount: result.speakerCount,
      customerName: req.body.customerName || null,
      sessionId: req.body.sessionId || null,
      productId: req.body.productId || null
    });

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

    // 删除已上传的文件
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
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
 * 获取转录结果详情
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
 * GET /api/transcription/scan/files
 * 扫描目录下的音频文件
 */
router.get('/scan/files', async (req, res) => {
  try {
    console.log('🔍 开始扫描音频文件...');
    
    const files = await audioScanService.scanAudioFiles();
    
    // 批量检查转录状态
    const filesWithStatus = await audioScanService.checkFilesStatus(files);
    
    res.json({
      success: true,
      data: filesWithStatus,
      total: filesWithStatus.length,
      message: `找到 ${filesWithStatus.length} 个音频文件`
    });
  } catch (error) {
    console.error('扫描音频文件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
 * AI 错别字修正及角色初步判断
 */
router.post('/:id/ai-correction', async (req, res) => {
  try {
    const { id } = req.params;
    const { modelName } = req.body; // 可选：前端指定模型

    const transcriptionAiService = require('../services/transcriptionAiService');
    const transcriptionService = require('../services/transcriptionService');

    // 1. 获取转录记录
    const transcription = await transcriptionService.getTranscriptionById(id);
    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      });
    }

    // 2. 解析对话内容
    let dialogues = transcription.dialogues;
    if (typeof dialogues === 'string') {
      try {
        dialogues = JSON.parse(dialogues);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: '对话内容格式错误'
        });
      }
    }

    if (!dialogues || dialogues.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有对话内容可以修正'
      });
    }

    // 3. 调用 AI 进行修正和角色判断
    // 如果前端没有指定模型，会自动使用场景类型为 'transcription_correction' 的默认模型
    const result = await transcriptionAiService.correctTyposAndRoles(dialogues, {
      modelName: modelName // 可选参数
    });

    // 4. 返回修正结果
    res.json({
      success: true,
      message: 'AI 分析完成',
      data: {
        original: dialogues,
        corrected: result.data.dialogues,
        summary: result.data.summary,
        processingTime: result.processingTime,
        modelName: result.modelName
      }
    });

  } catch (error) {
    console.error('AI 错别字修正失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'AI 修正失败'
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

    const transcriptionService = require('../services/transcriptionService');

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

module.exports = router;

