/**
 * 音频提取工具
 * 使用 ffmpeg 从视频文件中提取音频
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

class AudioExtractor {
  constructor() {
    // ffmpeg 路径（可以通过环境变量配置）
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  }

  /**
   * 从视频文件中提取音频
   * @param {string} videoFilePath - 视频文件路径
   * @param {string} [outputFormat='wav'] - 输出音频格式 (wav, mp3, m4a)
   * @returns {Promise<string>} 提取的音频文件路径
   */
  async extractAudioFromVideo(videoFilePath, outputFormat = 'wav') {
    return new Promise(async (resolve, reject) => {
      try {
        // 验证视频文件存在
        await fs.access(videoFilePath);
        
        // 生成输出文件路径（与原文件同目录，添加 _audio 后缀）
        const videoDir = path.dirname(videoFilePath);
        const videoName = path.basename(videoFilePath, path.extname(videoFilePath));
        const outputPath = path.join(videoDir, `${videoName}_audio.${outputFormat}`);
        
        logger.info(`🎬 开始从视频提取音频: ${videoFilePath}`);
        logger.info(`📁 输出路径: ${outputPath}`);
        
        // 构建 ffmpeg 命令
        // -i: 输入文件
        // -vn: 禁用视频流
        // -acodec: 音频编码器（wav使用pcm_s16le，mp3使用libmp3lame）
        // -ar: 采样率（44100Hz，标准音频采样率）
        // -ac: 声道数（2=立体声）
        // -y: 覆盖输出文件（如果存在）
        const codecMap = {
          'wav': 'pcm_s16le',
          'mp3': 'libmp3lame',
          'm4a': 'aac'
        };
        
        const codec = codecMap[outputFormat] || 'pcm_s16le';
        const args = [
          '-i', videoFilePath,
          '-vn',                    // 禁用视频
          '-acodec', codec,         // 音频编码器
          '-ar', '44100',          // 采样率
          '-ac', '2',               // 立体声
          '-y',                     // 覆盖输出文件
          outputPath
        ];
        
        logger.info(`🔧 执行命令: ${this.ffmpegPath} ${args.join(' ')}`);
        
        const ffmpegProcess = spawn(this.ffmpegPath, args);
        
        let stderr = '';
        
        // 捕获错误输出（ffmpeg 通常将进度信息输出到 stderr）
        ffmpegProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          // 实时输出进度（可选）
          const progressMatch = data.toString().match(/time=(\d+:\d+:\d+\.\d+)/);
          if (progressMatch) {
            logger.debug(`⏳ 提取进度: ${progressMatch[1]}`);
          }
        });
        
        ffmpegProcess.on('close', async (code) => {
          if (code !== 0) {
            logger.error(`❌ ffmpeg 执行失败，退出码: ${code}`);
            logger.error(`错误信息: ${stderr}`);
            return reject(new Error(`音频提取失败: ${stderr}`));
          }
          
          // 验证输出文件是否存在
          try {
            await fs.access(outputPath);
            const stats = await fs.stat(outputPath);
            logger.info(`✅ 音频提取成功: ${outputPath}`);
            logger.info(`📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            resolve(outputPath);
          } catch (error) {
            logger.error(`❌ 输出文件不存在: ${outputPath}`);
            reject(new Error(`音频提取失败: 输出文件未生成`));
          }
        });
        
        ffmpegProcess.on('error', (error) => {
          logger.error(`❌ 无法启动 ffmpeg 进程: ${error.message}`);
          logger.error(`💡 提示: 请确保已安装 ffmpeg 并配置到系统 PATH，或设置 FFMPEG_PATH 环境变量`);
          reject(new Error(`无法启动 ffmpeg: ${error.message}。请确保已安装 ffmpeg`));
        });
        
      } catch (error) {
        reject(new Error(`音频提取失败: ${error.message}`));
      }
    });
  }

  /**
   * 检查是否为视频文件
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否为视频文件
   */
  isVideoFile(filePath) {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.3g2'];
    const ext = path.extname(filePath).toLowerCase();
    return videoExtensions.includes(ext);
  }

  /**
   * 检查 ffmpeg 是否可用
   * @returns {Promise<boolean>} ffmpeg 是否可用
   */
  async checkFFmpegAvailable() {
    return new Promise((resolve) => {
      const ffmpegProcess = spawn(this.ffmpegPath, ['-version']);
      
      ffmpegProcess.on('close', (code) => {
        resolve(code === 0);
      });
      
      ffmpegProcess.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = new AudioExtractor();
