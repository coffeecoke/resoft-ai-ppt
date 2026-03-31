/**
 * 转录前音频压缩：超过阈值时用 ffmpeg 转为 16kHz / 16bit / 单声道 WAV（语音档，与 scripts/audio_two_tiers 档 L 一致）。
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const audioExtractor = require('./audioExtractor');

const DEFAULT_THRESHOLD_BYTES = 500 * 1024 * 1024;

function thresholdBytes() {
  const mb = process.env.TRANSCRIPTION_COMPRESS_THRESHOLD_MB;
  if (mb != null && String(mb).trim() !== '') {
    const n = parseInt(mb, 10);
    if (Number.isFinite(n) && n > 0) return n * 1024 * 1024;
  }
  return DEFAULT_THRESHOLD_BYTES;
}

function ffmpegBin() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

/**
 * @param {string} audioPath - 绝对或可用路径
 * @returns {Promise<{ pathForTranscribe: string, tempCompressedPath: string|null, tempDir: string|null, didCompress: boolean, bytesIn: number, bytesOut?: number }>}
 */
async function prepareAudioForTranscription(audioPath) {
  const resolved = path.resolve(audioPath);
  const stat = await fs.stat(resolved);
  const maxBytes = thresholdBytes();

  if (stat.size <= maxBytes) {
    return {
      pathForTranscribe: resolved,
      tempCompressedPath: null,
      tempDir: null,
      didCompress: false,
      bytesIn: stat.size,
    };
  }

  const ffmpegOk = await audioExtractor.checkFFmpegAvailable();
  if (!ffmpegOk) {
    throw new Error(
      `音频约 ${(stat.size / 1024 / 1024).toFixed(1)}MB，超过 ${(maxBytes / 1024 / 1024).toFixed(0)}MB 需自动压缩，但系统未检测到 ffmpeg。请安装 ffmpeg 或设置 FFMPEG_PATH。`
    );
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcribe-compress-'));
  const outPath = path.join(tmpDir, `for_transcribe_${Date.now()}.wav`);

  await new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      resolved,
      '-ac',
      '1',
      '-ar',
      '16000',
      '-sample_fmt',
      's16',
      '-c:a',
      'pcm_s16le',
      outPath,
    ];
    const p = spawn(ffmpegBin(), args);
    let stderr = '';
    p.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    p.on('error', (err) => reject(err));
    p.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg 压缩失败 (exit ${code}): ${stderr.slice(-3000)}`));
      } else resolve();
    });
  });

  const outStat = await fs.stat(outPath);
  return {
    pathForTranscribe: outPath,
    tempCompressedPath: outPath,
    tempDir: tmpDir,
    didCompress: true,
    bytesIn: stat.size,
    bytesOut: outStat.size,
  };
}

/**
 * @param {object|null} prep - prepareAudioForTranscription 的返回值
 */
async function cleanupTempCompressed(prep) {
  if (!prep || !prep.tempCompressedPath) return;
  try {
    await fs.unlink(prep.tempCompressedPath);
  } catch (_) {
    /* ignore */
  }
  if (prep.tempDir) {
    try {
      await fs.rm(prep.tempDir, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  }
}

module.exports = {
  prepareAudioForTranscription,
  cleanupTempCompressed,
  thresholdBytes,
};
