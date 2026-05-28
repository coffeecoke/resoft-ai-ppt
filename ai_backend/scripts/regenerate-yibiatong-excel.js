/**
 * 从 ai_progress 重新生成 Excel，并从文件名解析客户名
 * 用法: node scripts/regenerate-yibiatong-excel.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const OUT_DIR = path.join(__dirname, '../data/yibiatong-concerns-analysis')

/** 从交流场次/文件名解析客户（机构）名称 */
function extractCustomerFromSession(sessionName) {
  const raw = String(sessionName || '').trim()
  if (!raw) return '未知'

  const base = raw.replace(/\.(m4a|mp3|MP3|wav|WAV|aac)$/i, '').trim()

  // 常见格式: 20250110-销售-客户-项目描述
  const dashParts = base.split('-').map(s => s.trim()).filter(Boolean)
  if (dashParts.length >= 3 && /^\d{8}$/.test(dashParts[0])) {
    const candidate = dashParts[2]
    if (candidate && candidate.length >= 2 && candidate.length <= 30) {
      return candidate
    }
  }

  const patterns = [
    /[\u4e00-\u9fa5]{2,20}(?:银行|农商行|商行|农信|农信社|银监局|银保监|资产|信托|电网|财务公司|财务)/,
    /[\u4e00-\u9fa5]{2,12}农商/,
    /[\u4e00-\u9fa5]{2,15}农商/
  ]
  for (const re of patterns) {
    const m = base.match(re)
    if (m) return m[0]
  }

  // 无日期前缀的单段标题，取前 2～12 个汉字
  const cn = base.match(/^[\u4e00-\u9fa5]{2,20}/)
  if (cn) return cn[0]

  return '未知'
}

function buildThemeSummary(valuable) {
  const m = {}
  for (const v of valuable) {
    const k = v.theme || '未分类'
    if (!m[k]) m[k] = { theme: k, count: 0, high: 0, medium: 0 }
    m[k].count++
    if (v.value === 'high') m[k].high++
    else m[k].medium++
  }
  return Object.values(m).sort((a, b) => b.count - a.count)
}

function exportExcel(outDir, ts, stats, valuable, themeSummary) {
  const wb = XLSX.utils.book_new()
  const statsRows = [
    ['指标', '数值', '说明'],
    ['产品', stats.product, ''],
    ['含问答交流场次', stats.meetingCountWithQa, ''],
    ['问答对总数', stats.qaPairTotal, ''],
    ['客户提问', stats.customerQuestions, ''],
    ['规则预筛客户问', stats.ruleValuableCustomerQuestions, ''],
    ['AI认定有价值', valuable.length, ''],
    ['其中高价值', valuable.filter(v => v.value === 'high').length, ''],
    ['其中中价值', valuable.filter(v => v.value !== 'high').length, ''],
    ['客户名来源', '文件名/场次名解析', 'customer_name 为空时从 session 解析']
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(statsRows), '统计汇总')

  const themeRows = [
    ['主题', '合计', '高价值', '中价值'],
    ...themeSummary.map(t => [t.theme, t.count, t.high, t.medium])
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(themeRows), '主题分类汇总')

  const listRows = valuable.map((v, i) => ({
    序号: i + 1,
    价值等级: v.value === 'high' ? '高' : '中',
    主题: v.theme || '',
    客户: v.customer || '',
    文件名: v.session || '',
    交流场次: v.session || '',
    问题: v.question || '',
    回答: v.answer || '',
    分类代码: v.category || '',
    性质代码: v.intent || '',
    有价值原因: v.reason || '',
    问题ID: v.id || ''
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(listRows), '有价值问题清单')

  const xlsxPath = path.join(outDir, `yibiatong_valuable_${ts}_v2.xlsx`)
  XLSX.writeFile(wb, xlsxPath)
  return xlsxPath
}

function main() {
  const progressFile = path.join(OUT_DIR, 'ai_progress_20260518.json')
  if (!fs.existsSync(progressFile)) {
    console.error('未找到', progressFile)
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(progressFile, 'utf8'))
  let fixed = 0
  const valuable = (data.valuable || []).map(v => {
    const session = v.session || ''
    let customer = (v.customer || '').trim()
    if (!customer || customer === '未知') {
      customer = extractCustomerFromSession(session)
      if (customer !== '未知') fixed++
    }
    return { ...v, customer, session }
  })

  const stillUnknown = valuable.filter(v => v.customer === '未知').length
  const themeSummary = buildThemeSummary(valuable)
  const stats = {
    product: '一表通',
    meetingCountWithQa: 142,
    qaPairTotal: 2169,
    customerQuestions: 1639,
    ruleValuableCustomerQuestions: 1626,
    aiValuableCount: valuable.length
  }

  const ts = '20260518'
  const xlsxPath = exportExcel(OUT_DIR, ts, stats, valuable, themeSummary)

  const jsonPath = path.join(OUT_DIR, `analysis_${ts}_full.json`)
  fs.writeFileSync(jsonPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    fullRun: true,
    stats: { ...stats, aiValuableCount: valuable.length, customerFromFilenameFixed: fixed, stillUnknown },
    themeSummary,
    aiValuableQuestions: valuable
  }, null, 2), 'utf8')

  console.log('已重新生成 Excel:', xlsxPath)
  console.log('已写入 JSON:', jsonPath)
  console.log(`客户名从文件名补全: ${fixed} 条，仍未知: ${stillUnknown} 条，合计: ${valuable.length} 条`)
}

main()
