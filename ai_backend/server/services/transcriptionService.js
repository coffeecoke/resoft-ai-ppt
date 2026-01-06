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
  async getTranscriptionById(id) {
    // ✅ prisma 已在文件顶部导入
    const transcription = await prisma.transcriptions.findUnique({
      where: { id },
      include: {
        sessions: true,
        products: true
      }
    });

    if (transcription && transcription.dialogues) {
      // 解析 JSON 字段并转换 BigInt
      transcription.dialogues = JSON.parse(transcription.dialogues);
      transcription.audio_file_size = transcription.audio_file_size ? Number(transcription.audio_file_size) : 0;
    }

    return transcription;
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
}

module.exports = new TranscriptionService();

