/**
 * 临时脚本：批量转录音频目录下所有音频，结果写入 Excel
 * - 音频目录：E:\zhangying\copy\copy
 * - Excel 两列：名称、转录文字
 * - 走现有语音转录逻辑（讯飞），不识别角色，模型/配置沿用现有环境
 *
 * 使用：
 *   全部转录：  node scripts/batch-transcribe-to-excel.js
 *   断点续传：  node scripts/batch-transcribe-to-excel.js "E:\zhangying\copy\copy\转录结果_xxx.xlsx"
 *              （传入已有 Excel 路径，只转录未完成的，最后合并写入新 Excel）
 */

const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');

// 从 ai_backend 根目录加载
const projectRoot = path.join(__dirname, '..');
const transcriptionService = require(path.join(projectRoot, 'server/services/transcriptionService'));

// 配置：音频目录与输出 Excel
const AUDIO_DIR = 'E:\\zhangying\\copy\\copy';
const OUT_EXCEL = path.join(AUDIO_DIR, `转录结果_${Date.now()}.xlsx`);
/** 断点续传：已有 Excel 路径（来自命令行第一个参数） */
const EXISTING_EXCEL = process.argv[2] ? process.argv[2].trim() : null;

// 支持的音频扩展名（与 transcriptionRoutes 一致，含 amr）
const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.wma', '.ogg', '.amr'];
const VIDEO_EXT = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.3g2'];
const ALLOWED_EXT = [...AUDIO_EXT, ...VIDEO_EXT];

/**
 * 从已有 Excel 读取已完成的「名称」集合，并返回已有行数据（用于合并）
 * @param {string} excelPath - Excel 文件路径
 * @returns {{ completedNames: Set<string>, existingRows: Array<{名称:string, 转录文字:string}> }}
 */
function readExistingExcel(excelPath) {
  try {
    const wb = XLSX.readFile(excelPath);
    const firstSheet = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const existingRows = rows.map(r => ({
      名称: (r['名称'] != null ? String(r['名称']) : '').trim(),
      转录文字: (r['转录文字'] != null ? String(r['转录文字']) : '').trim()
    })).filter(r => r['名称']);
    const completedNames = new Set(existingRows.map(r => r['名称']));
    return { completedNames, existingRows };
  } catch (e) {
    console.error('读取已有 Excel 失败:', e.message);
    return { completedNames: new Set(), existingRows: [] };
  }
}

/**
 * 递归收集目录下所有音频文件（绝对路径）
 */
async function collectAudioFiles(dir, list = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    console.error(`无法读取目录: ${dir}`, e.message);
    return list;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await collectAudioFiles(full, list);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (ALLOWED_EXT.includes(ext)) {
        list.push(full);
      }
    }
  }
  return list;
}

/**
 * 对单个文件转录，返回 { 名称, 转录文字 } 或 { 名称, 转录文字: '错误信息' }
 */
async function transcribeOne(filePath) {
  const name = path.basename(filePath);
  try {
    const result = await transcriptionService.transcribeAudio(filePath);
    const text = result.fullText != null ? result.fullText : (result.dialogues || [])
      .map(d => d.text || d.correctedText || d.originalText || '')
      .filter(Boolean)
      .join(' ');
    return { 名称: name, 转录文字: text || '' };
  } catch (err) {
    console.error(`转录失败 [${name}]:`, err.message);
    return { 名称: name, 转录文字: `[转录失败] ${err.message}` };
  }
}

async function main() {
  console.log('音频目录:', AUDIO_DIR);
  console.log('输出文件:', OUT_EXCEL);

  const files = await collectAudioFiles(AUDIO_DIR);
  console.log(`共找到 ${files.length} 个音频/视频文件`);

  if (files.length === 0) {
    console.log('没有可转录文件，退出');
    return;
  }

  let completedNames = new Set();
  const existingRowsMap = new Map(); // 名称 -> { 名称, 转录文字 }

  if (EXISTING_EXCEL) {
    const { completedNames: names, existingRows } = readExistingExcel(EXISTING_EXCEL);
    completedNames = names;
    existingRows.forEach(r => existingRowsMap.set(r['名称'], r));
    console.log('断点续传：已有', completedNames.size, '条，待转录', files.length - completedNames.size, '个');
  }

  const toProcess = files.filter(f => !completedNames.has(path.basename(f)));
  if (toProcess.length === 0) {
    console.log('没有待转录文件，退出');
    return;
  }

  const newRows = [];
  for (let i = 0; i < toProcess.length; i++) {
    console.log(`[${i + 1}/${toProcess.length}] ${path.basename(toProcess[i])}`);
    const row = await transcribeOne(toProcess[i]);
    newRows.push(row);
  }

  // 按「全部文件」顺序合并：已有用 Excel 里的，新转录的用 newRows
  let newIndex = 0;
  const rows = [];
  for (const filePath of files) {
    const name = path.basename(filePath);
    if (existingRowsMap.has(name)) {
      rows.push(existingRowsMap.get(name));
    } else {
      rows.push(newRows[newIndex++]);
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '转录结果');
  XLSX.writeFile(wb, OUT_EXCEL);

  console.log('已写入:', OUT_EXCEL, '共', rows.length, '条');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
