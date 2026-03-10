/**
 * 智能信息爬取服务（采招网）
 * 调用 python_services/intelligent_scraper 下的 Python 爬虫，支持环境变量覆盖与结果列表
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const SCRAPER_DIR = path.join(__dirname, '../../python_services/intelligent_scraper');
const SCRAPER_SCRIPT = path.join(SCRAPER_DIR, 'scraper.py');
const CONFIG_FILE = path.join(SCRAPER_DIR, 'config.ini');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '../../scraper_output');

/** 简单 INI 解析：返回 { section: { key: value } } */
function parseIni(content) {
  const sections = {};
  let current = null;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      current = sectionMatch[1];
      sections[current] = sections[current] || {};
      continue;
    }
    const kv = trimmed.match(/^([^;#=]+)=(.*)$/);
    if (kv && current) {
      sections[current][kv[1].trim()] = kv[2].trim();
    }
  }
  return sections;
}

/** 将 sections 写回 INI 字符串（保留 section 顺序：scraper, wecom） */
function stringifyIni(sections) {
  const order = ['scraper', 'wecom'];
  const lines = [];
  for (const name of order) {
    if (!sections[name]) continue;
    lines.push(`[${name}]`);
    for (const [k, v] of Object.entries(sections[name])) {
      lines.push(`${k} = ${v}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

class IntelligentScraperService {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python';
  }

  /**
   * 读取爬虫配置（不返回密码）
   */
  async getConfig() {
    try {
      const content = await fs.readFile(CONFIG_FILE, 'utf-8');
      const sections = parseIni(content);
      const s = sections.scraper || {};
      const rawKws = (s.keywords || '').split(/[,，]/).map(k => k.trim()).filter(Boolean);
      return {
        username: s.username ? '***' : '',
        hasPassword: !!(s.password && s.password.length > 0),
        keywords: rawKws.length ? rawKws : ['招标公告'],
        max_pages: parseInt(s.max_pages, 10) || 1,
        headless: (s.headless || 'false').toLowerCase() === 'true',
        output_dir: s.output_dir || 'output',
        output_format: ['txt', 'html', 'both'].includes((s.output_format || 'txt').toLowerCase())
          ? (s.output_format || 'txt').toLowerCase()
          : 'txt',
        start_date: (s.start_date || '').trim(),
        end_date: (s.end_date || '').trim(),
        slow_mo: parseInt(s.slow_mo, 10) || 400,
      };
    } catch (e) {
      if (e.code === 'ENOENT') {
        return {
          username: '',
          hasPassword: false,
          keywords: ['招标公告'],
          max_pages: 1,
          headless: false,
          output_dir: 'output',
          output_format: 'txt',
          start_date: '',
          end_date: '',
          slow_mo: 400,
        };
      }
      throw e;
    }
  }

  /**
   * 更新爬虫配置（仅允许修改的部分；账号密码需直接编辑 config.ini）
   */
  async updateConfig(updates) {
    let content = '';
    try {
      content = await fs.readFile(CONFIG_FILE, 'utf-8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    const sections = parseIni(content);
    if (!sections.scraper) sections.scraper = {};
    const s = sections.scraper;
    if (updates.keywords !== undefined) {
      s.keywords = Array.isArray(updates.keywords)
        ? updates.keywords.join(',')
        : String(updates.keywords || '');
    }
    if (updates.max_pages !== undefined) s.max_pages = String(updates.max_pages);
    if (updates.headless !== undefined) s.headless = updates.headless ? 'true' : 'false';
    if (updates.output_format !== undefined) s.output_format = updates.output_format;
    if (updates.start_date !== undefined) s.start_date = String(updates.start_date || '');
    if (updates.end_date !== undefined) s.end_date = String(updates.end_date || '');
    if (updates.slow_mo !== undefined) s.slow_mo = String(updates.slow_mo);
    await fs.writeFile(CONFIG_FILE, stringifyIni(sections), 'utf-8');
  }

  /**
   * 执行爬取
   * @param {Object} options - { keywords: string[], max_pages?, start_date?, end_date? }
   * @returns {Promise<{ success: boolean, exitCode: number, log: string }>}
   */
  async runScraper(options = {}) {
    const keywords = options.keywords && options.keywords.length
      ? options.keywords
      : (await this.getConfig()).keywords;
    const maxPages = options.max_pages != null ? options.max_pages : (await this.getConfig()).max_pages;
    const startDate = options.start_date != null ? options.start_date : '';
    const endDate = options.end_date != null ? options.end_date : '';

    await fs.mkdir(DEFAULT_OUTPUT_DIR, { recursive: true });

    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      SCRAPER_OUTPUT_DIR: DEFAULT_OUTPUT_DIR,
      SCRAPER_MAX_PAGES: String(maxPages),
      SCRAPER_START_DATE: startDate,
      SCRAPER_END_DATE: endDate,
    };

    const args = [SCRAPER_SCRIPT, ...keywords];
    const proc = spawn(this.pythonPath, args, {
      cwd: SCRAPER_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    return new Promise((resolve) => {
      proc.on('close', (code) => {
        const log = [stdout, stderr].filter(Boolean).join('\n').trim();
        resolve({
          success: code === 0,
          exitCode: code,
          log: log || '(无输出)',
        });
      });
      proc.on('error', (err) => {
        resolve({
          success: false,
          exitCode: -1,
          log: `启动失败: ${err.message}`,
        });
      });
    });
  }

  /**
   * 列出爬取结果（按关键词子目录）
   */
  async listResults() {
    try {
      await fs.mkdir(DEFAULT_OUTPUT_DIR, { recursive: true });
      const entries = await fs.readdir(DEFAULT_OUTPUT_DIR, { withFileTypes: true });
      const result = [];
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const keywordDir = path.join(DEFAULT_OUTPUT_DIR, ent.name);
        const files = await fs.readdir(keywordDir, { withFileTypes: true }).catch(() => []);
        const fileList = [];
        for (const f of files) {
          if (!f.isFile()) continue;
          const fp = path.join(keywordDir, f.name);
          const stat = await fs.stat(fp).catch(() => null);
          const relativePath = `scraper_output/${ent.name}/${f.name}`;
          fileList.push({
            name: f.name,
            path: relativePath,
            size: stat ? stat.size : 0,
          });
        }
        fileList.sort((a, b) => b.name.localeCompare(a.name));
        result.push({ keyword: ent.name, files: fileList });
      }
      result.sort((a, b) => b.keyword.localeCompare(a.keyword));
      return result;
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  /**
   * 读取结果文件内容（用于预览）
   */
  async readResultFile(relativePath) {
    if (!relativePath || !relativePath.startsWith('scraper_output/')) {
      throw new Error('无效路径');
    }
    const fullPath = path.join(__dirname, '../..', relativePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  }
}

module.exports = new IntelligentScraperService();
