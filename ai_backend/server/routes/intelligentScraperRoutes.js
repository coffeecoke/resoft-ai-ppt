/**
 * 智能信息爬取 API 路由
 */

const express = require('express');
const router = express.Router();
const intelligentScraperService = require('../services/intelligentScraperService');

// 获取配置（不含密码）
router.get('/config', async (req, res) => {
  try {
    const config = await intelligentScraperService.getConfig();
    res.json({ success: true, data: config });
  } catch (e) {
    console.error('[scraper] getConfig error', e);
    res.status(500).json({ success: false, message: e.message || '获取配置失败' });
  }
});

// 更新配置（仅允许的字段）
router.put('/config', async (req, res) => {
  try {
    const body = req.body || {};
    await intelligentScraperService.updateConfig({
      keywords: body.keywords,
      max_pages: body.max_pages,
      headless: body.headless,
      output_format: body.output_format,
      start_date: body.start_date,
      end_date: body.end_date,
      slow_mo: body.slow_mo,
    });
    const config = await intelligentScraperService.getConfig();
    res.json({ success: true, data: config });
  } catch (e) {
    console.error('[scraper] updateConfig error', e);
    res.status(500).json({ success: false, message: e.message || '更新配置失败' });
  }
});

// 执行爬取（可传 keywords, max_pages, start_date, end_date）
router.post('/run', async (req, res) => {
  try {
    const result = await intelligentScraperService.runScraper(req.body || {});
    res.json({
      success: result.success,
      exitCode: result.exitCode,
      log: result.log,
    });
  } catch (e) {
    console.error('[scraper] run error', e);
    res.status(500).json({ success: false, message: e.message || '执行爬取失败' });
  }
});

// 列出爬取结果（按关键词子目录）
router.get('/results', async (req, res) => {
  try {
    const list = await intelligentScraperService.listResults();
    res.json({ success: true, data: list });
  } catch (e) {
    console.error('[scraper] listResults error', e);
    res.status(500).json({ success: false, message: e.message || '获取结果列表失败' });
  }
});

// 预览结果文件内容
router.get('/results/preview', async (req, res) => {
  try {
    const relativePath = req.query.path;
    if (!relativePath) {
      return res.status(400).json({ success: false, message: '缺少 path 参数' });
    }
    const content = await intelligentScraperService.readResultFile(relativePath);
    res.json({ success: true, data: { content, path: relativePath } });
  } catch (e) {
    console.error('[scraper] preview error', e);
    res.status(500).json({ success: false, message: e.message || '读取文件失败' });
  }
});

module.exports = router;
