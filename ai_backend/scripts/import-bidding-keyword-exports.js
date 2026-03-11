/**
 * 招投标关键词导出 Excel 批量入库脚本
 *
 * 依据：E:\关键词信息导出\关键词信息导出\银行_1.xlsx 结构
 * 表：bidding_keyword_exports（含投标保证金字段，Excel 中无则留空）
 *
 * 用法：
 *   node scripts/import-bidding-keyword-exports.js
 *   node scripts/import-bidding-keyword-exports.js "D:\其他目录"
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// 使用 online-ppt-backend 的 Prisma Client（与 ai_backend 一致）
const { PrismaClient } = require('../../online-ppt-backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_DIR = 'E:\\关键词信息导出\\关键词信息导出';

// Excel 列顺序（与 银行_1.xlsx 表头一致）
const COL = {
  ID: 0,
  关键字: 1,
  类型: 2,
  细分类型: 3,
  标题: 4,
  省份: 5,
  城市: 6,
  区县: 7,
  周期: 8,
  发布时间: 9,
  标书获取时间: 10,
  项目编号: 11,
  项目预算: 12,
  中标金额: 13,
  资金来源: 14,
  招标方式: 15,
  评标方法: 16,
  项目业主: 17,
  业主联系人: 18,
  业主联系电话: 19,
  中标单位: 20,
  中标单位联系人: 21,
  中标单位联系电话: 22,
  招标代理: 23,
  投标截止时间: 24,
  详情页地址: 25,
};

function toStr(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function rowToRecord(row) {
  const id = toStr(row[COL.ID]);
  if (!id) return null;

  return {
    id,
    keyword: toStr(row[COL.关键字]) || '未知',
    record_type: toStr(row[COL.类型]),
    sub_type: toStr(row[COL.细分类型]),
    title: toStr(row[COL.标题]),
    province: toStr(row[COL.省份]),
    city: toStr(row[COL.城市]),
    district: toStr(row[COL.区县]),
    cycle_info: toStr(row[COL.周期]),
    publish_time_str: toStr(row[COL.发布时间]),
    doc_fetch_time_str: toStr(row[COL.标书获取时间]),
    project_no: toStr(row[COL.项目编号]),
    project_budget: toStr(row[COL.项目预算]),
    winning_amount: toStr(row[COL.中标金额]),
    fund_source: toStr(row[COL.资金来源]),
    bidding_method: toStr(row[COL.招标方式]),
    evaluation_method: toStr(row[COL.评标方法]),
    project_owner: toStr(row[COL.项目业主]),
    owner_contact: toStr(row[COL.业主联系人]),
    owner_phone: toStr(row[COL.业主联系电话]),
    winning_unit: toStr(row[COL.中标单位]),
    winning_unit_contact: toStr(row[COL.中标单位联系人]),
    winning_unit_phone: toStr(row[COL.中标单位联系电话]),
    bidding_agent: toStr(row[COL.招标代理]),
    bid_deadline_str: toStr(row[COL.投标截止时间]),
    detail_url: toStr(row[COL.详情页地址]),
    bid_bond: null, // 投标保证金：Excel 中无此列，可后续手工或爬虫补充
  };
}

function readSheet(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // 第 0 行为表头，数据从第 1 行开始
  const dataRows = rows.slice(1);
  const records = [];
  for (const row of dataRows) {
    const rec = rowToRecord(row);
    if (rec) records.push(rec);
  }
  return records;
}

function readFile(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const records = [];
  for (const sheetName of workbook.SheetNames) {
    const list = readSheet(workbook, sheetName);
    records.push(...list);
  }
  return records;
}

const BATCH_SIZE = 500; // 每批插入条数，避免单次 SQL 过大

async function main() {
  const dir = process.argv[2] || DEFAULT_DIR;
  if (!fs.existsSync(dir)) {
    console.error('目录不存在:', dir);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.xlsx'));
  if (files.length === 0) {
    console.error('目录下没有 .xlsx 文件:', dir);
    process.exit(1);
  }

  console.log('目录:', dir);
  console.log('文件数:', files.length, files.join(', '));

  // 1. 先读取所有文件，汇总为一条记录列表（按 id 去重，保留首次出现）
  const idSeen = new Set();
  const allRecords = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    let list;
    try {
      list = readFile(filePath);
    } catch (e) {
      console.error('读取失败:', filePath, e.message);
      continue;
    }
    console.log('  ', file, '->', list.length, '条');
    for (const rec of list) {
      if (!idSeen.has(rec.id)) {
        idSeen.add(rec.id);
        allRecords.push(rec);
      }
    }
  }

  const total = allRecords.length;
  console.log('去重后待入库:', total, '条');

  // 2. 按批 createMany，重复 id 自动跳过
  let created = 0;
  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE);
    const result = await prisma.bidding_keyword_exports.createMany({
      data: batch,
      skipDuplicates: true,
    });
    created += result.count;
    console.log('  批次', Math.floor(i / BATCH_SIZE) + 1, '-> 本批新增', result.count);
  }

  await prisma.$disconnect();
  console.log('---');
  console.log('合计行数:', total, '| 实际新增:', created, '| 跳过(已存在):', total - created);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
