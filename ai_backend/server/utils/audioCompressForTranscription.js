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

function ffprobeBin() {
  return process.env.FFPROBE_PATH || 'ffprobe';
}

/** ffprobe 读到的 format_name（常为逗号分隔），用于构造 -f 尝试顺序 */
async function ffprobeFormatName(inputPath) {
  return new Promise((resolve) => {
    const args = [
      '-v',
      'error',
      '-analyzeduration',
      '100M',
      '-probesize',
      '100M',
      '-show_entries',
      'format=format_name',
      '-of',
      'default=nw=1:nk=1',
      inputPath,
    ];
    const p = spawn(ffprobeBin(), args);
    let out = '';
    p.stdout.on('data', (d) => {
      out += d.toString();
    });
    p.on('error', () => resolve(null));
    p.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const line = out.trim().split(/\r?\n/)[0];
      resolve(line || null);
    });
  });
}

/** 自动探测 + ffprobe 各别名 + 常见语音容器，依次 -f 强制解复用 */
/** 不含 gsm：多数 Homebrew/static 版 ffmpeg 未编进 GSM demuxer，-f gsm 会 Unknown input format */
/** matroska/webm 放最后：误用 -f webm 解析非 WebM 时会产生 EBML 误报，且易覆盖真实错误信息 */
const FALLBACK_DEMUXERS = [
  'mp3',
  'aac',
  'mov',
  'm4a',
  'flac',
  'caf',
  'ogg',
  'opus',
  'asf',
  'amr',
  'wav',
  'aiff',
  'au',
  'matroska',
  'webm',
];

/**
 * @param {string|null} probedLine
 * @param {boolean} preferWavEarly - 扩展名为 .wav 时在自动探测后立刻试 -f wav
 */
function buildDemuxerAttemptList(probedLine, preferWavEarly = false) {
  const list = [];
  const seen = new Set();
  const add = (v) => {
    if (v === null || v === undefined) {
      if (!seen.has('__auto__')) {
        seen.add('__auto__');
        list.push(null);
      }
      return;
    }
    const s = String(v).trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    list.push(s);
  };
  add(null);
  if (preferWavEarly) {
    add('wav');
  }
  if (probedLine) {
    for (const part of String(probedLine).split(',')) {
      add(part.trim());
    }
  }
  for (const f of FALLBACK_DEMUXERS) {
    if (preferWavEarly && f === 'wav') continue;
    add(f);
  }
  return list;
}

/**
 * ffmpeg 转 16k/mono/s16 WAV；含容错解码；可选强制 demuxer（扩展名与真实格式不符时常需要）。
 * @param {string|null} forcedDemuxer - 传 null 为自动探测
 */
function runFfmpegTranscodeToWav16k(inputPath, outPath, forcedDemuxer = null) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-err_detect',
    'ignore_err',
    '-fflags',
    '+discardcorrupt',
    '-analyzeduration',
    '100M',
    '-probesize',
    '100M',
  ];
  if (forcedDemuxer != null && String(forcedDemuxer).trim() !== '') {
    args.push('-f', String(forcedDemuxer).trim());
  }
  args.push(
    '-i',
    inputPath,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-sample_fmt',
    's16',
    '-c:a',
    'pcm_s16le',
    outPath
  );
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegBin(), args);
    let stderr = '';
    p.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    p.on('error', (err) => reject(err));
    p.on('close', (code) => {
      if (code !== 0) {
        const hint =
          forcedDemuxer != null && String(forcedDemuxer).trim() !== ''
            ? ` demuxer=-f ${String(forcedDemuxer).trim()}`
            : ' demuxer=auto';
        reject(new Error(`ffmpeg 压缩失败 (exit ${code})${hint}: ${stderr.slice(-3000)}`));
      } else resolve();
    });
  });
}

/**
 * 对同一输入按多种 demuxer 重试转码，全部失败则抛出错误。
 * 最终以「自动探测 demuxer=auto」那次错误为主，避免最后被 -f webm 等误试的 EBML 信息误导。
 */
async function transcodeTryingDemuxers(inputPath, outPath) {
  const probed = await ffprobeFormatName(inputPath);
  const preferWavEarly = /\.wav$/i.test(inputPath);
  const demuxers = buildDemuxerAttemptList(probed, preferWavEarly);
  let autoErr = null;
  let lastAny = null;
  for (const d of demuxers) {
    try {
      await runFfmpegTranscodeToWav16k(inputPath, outPath, d);
      return;
    } catch (e) {
      const msg = e && e.message ? String(e.message) : String(e);
      if (/Unknown input format/i.test(msg)) {
        continue;
      }
      lastAny = e;
      if (d == null) {
        autoErr = e;
      }
    }
  }
  const probeNote = probed ? ` ffprobe_format_name=${JSON.stringify(probed)}` : ' ffprobe=不可用或探测失败';
  const tail =
    autoErr && autoErr.message
      ? autoErr.message
      : lastAny && lastAny.message
        ? lastAny.message
        : lastAny
          ? String(lastAny)
          : 'ffmpeg: 所有 demuxer 尝试均失败（含当前构建不支持的格式已跳过）';
  throw new Error(`${tail}${probeNote}`);
}

/**
 * 先直接对源路径多 demuxer 转码；仍失败则复制到临时 ASCII 路径后再做同样尝试（路径 + 错扩展名场景）。
 */
async function runFfmpegWithPathFallback(resolved, outPath, tmpDir) {
  try {
    await transcodeTryingDemuxers(resolved, outPath);
    return;
  } catch (firstErr) {
    const ext = path.extname(resolved) || '.wav';
    const inputCopy = path.join(tmpDir, `_in_${Date.now()}${ext}`);
    try {
      await fs.copyFile(resolved, inputCopy);
    } catch (copyErr) {
      throw new Error(
        `${firstErr.message}\n复制音频到临时路径失败: ${copyErr.message || copyErr}`
      );
    }
    try {
      await transcodeTryingDemuxers(inputCopy, outPath);
    } catch (secondErr) {
      throw new Error(
        `${secondErr.message}\n（已尝试多种容器格式(-f)与临时路径复制仍失败：文件可能损坏、非音频，或企业微信缓存未完成。请另存为本地或用 ffprobe 检查。）`
      );
    } finally {
      await fs.unlink(inputCopy).catch(() => {});
    }
  }
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

  await runFfmpegWithPathFallback(resolved, outPath, tmpDir);

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
