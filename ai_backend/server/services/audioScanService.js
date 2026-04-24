/**
 * 音频文件扫描服务
 * 负责扫描指定目录下的音频文件
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');

class AudioScanService {
  constructor() {
    this.configPath = path.join(__dirname, '../config/audioScanConfig.json');
  }

  /**
   * 获取扫描配置
   */
  async getConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('读取配置失败:', error);
      // 返回默认配置
      return {
        scanDirectory: '',
        supportedFormats: ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.wma', '.ogg', '.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.3g2'],
        autoScanEnabled: false,
        scanInterval: 300000
      };
    }
  }

  /**
   * 更新扫描配置
   */
  async updateConfig(config) {
    try {
      const currentConfig = await this.getConfig();
      const newConfig = { ...currentConfig, ...config };
      await fs.writeFile(this.configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
      return newConfig;
    } catch (error) {
      console.error('保存配置失败:', error);
      throw new Error('保存配置失败');
    }
  }

  /**
   * 扫描目录下的音频文件
   * @param {string} directory - 目录路径（可选，默认使用配置中的路径）
   * @returns {Promise<Array>} 音频文件列表
   */
  async scanAudioFiles(directory = null) {
    try {
      const config = await this.getConfig();
      const scanDir = directory || config.scanDirectory;

      if (!scanDir) {
        throw new Error('未配置扫描目录');
      }

      // 检查目录是否存在
      if (!fsSync.existsSync(scanDir)) {
        throw new Error(`目录不存在: ${scanDir}`);
      }

      console.log('📁 扫描音频目录:', scanDir);

      const files = await this.readDirectoryRecursive(scanDir, config.supportedFormats);
      
      console.log(`✅ 找到 ${files.length} 个音频文件`);

      return files;
    } catch (error) {
      console.error('扫描音频文件失败:', error);
      throw error;
    }
  }

  /**
   * 递归读取目录（包括子目录）
   * @param {string} dir - 目录路径
   * @param {Array} supportedFormats - 支持的格式
   * @param {Array} fileList - 文件列表（递归用）
   * @returns {Promise<Array>} 文件列表
   */
  async readDirectoryRecursive(dir, supportedFormats, fileList = []) {
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        // 递归读取子目录
        await this.readDirectoryRecursive(fullPath, supportedFormats, fileList);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (supportedFormats.includes(ext)) {
          const stats = await fs.stat(fullPath);
          fileList.push({
            fileName: item.name,
            filePath: fullPath,
            relativePath: path.relative(dir, fullPath),
            fileSize: stats.size,
            format: ext.replace('.', ''),
            modifiedTime: stats.mtime,
            createdTime: stats.birthtime
          });
        }
      }
    }

    return fileList;
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 检查文件是否已转录
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 是否已转录
   */
  async isFileTranscribed(filePath) {
    try {
      const transcription = await prisma.transcriptions.findFirst({
        where: {
          audio_file_path: filePath
        }
      });

      return !!transcription;
    } catch (error) {
      console.error('检查转录状态失败:', error);
      return false;
    }
  }

  /**
   * 批量检查文件转录状态
   */
  async checkFilesStatus(files) {
    try {
      const filePaths = files.map(f => f.filePath);
      
      const transcriptions = await prisma.transcriptions.findMany({
        where: {
          audio_file_path: {
            in: filePaths
          }
        },
        select: {
          audio_file_path: true,
          id: true,
          name: true,
          status: true,
          created_at: true
        }
      });

      // 是否角色设置：以 dialogue_adjustments 表中 speaker_roles 有值为准
      const transcriptionIds = transcriptions.map(t => t.id);
      const adjustmentsWithRole = await prisma.dialogue_adjustments.findMany({
        where: {
          transcription_id: { in: transcriptionIds },
          speaker_roles: { not: null }
        },
        select: { transcription_id: true, speaker_roles: true }
      });
      const transcriptionIdsWithRoleSet = new Set();
      adjustmentsWithRole.forEach(a => {
        const roleJson = a.speaker_roles ? String(a.speaker_roles).trim() : '';
        if (roleJson.length > 0 && roleJson !== '{}') {
          transcriptionIdsWithRoleSet.add(a.transcription_id);
        }
      });

      // 创建映射表（是否转录、是否进行角色设置）
      const statusMap = {};
      transcriptions.forEach(t => {
        statusMap[t.audio_file_path] = {
          transcribed: true,
          transcriptionId: t.id,
          transcriptionName: t.name,
          status: t.status,
          transcribedAt: t.created_at,
          hasRoleSet: transcriptionIdsWithRoleSet.has(t.id)
        };
      });

      // 为每个文件添加状态（未转录的默认未设角色）
      return files.map(file => {
        const status = statusMap[file.filePath];
        if (!status) {
          return { ...file, transcribed: false, hasRoleSet: false };
        }
        return { ...file, ...status };
      });
    } catch (error) {
      console.error('批量检查转录状态失败:', error);
      return files.map(file => ({ ...file, transcribed: false, hasRoleSet: false }));
    }
  }
}

module.exports = new AudioScanService();

