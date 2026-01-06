/**
 * API路由统一入口
 */

const express = require('express');
const router = express.Router();

// ==================== 管理后台路由 ====================
router.use('/admin/models', require('./admin/modelConfigRoutes'));
router.use('/admin/prompts', require('./admin/promptTemplateRoutes'));
router.use('/admin/system', require('./admin/systemSettingsRoutes'));

// ==================== AI功能路由（预留） ====================
// router.use('/ai/transcription', require('./ai/transcriptionRoutes'));
// router.use('/ai/ppt-analysis', require('./ai/pptAnalysisRoutes'));
// router.use('/ai/document-extract', require('./ai/documentExtractRoutes'));

// 注意：不在这里添加全局404处理器，因为其他路由（/api/documents, /api/ppt-analysis等）
// 是在 app.js 中单独注册的，如果在这里添加 router.use('*')，会拦截所有未匹配的请求

module.exports = router;

