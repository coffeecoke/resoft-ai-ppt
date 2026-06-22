/**
 * 按 original_file_name 去重 transcriptions 表
 *
 * 用法:
 *   node scripts/dedupe-transcriptions.js           # 仅预览
 *   node scripts/dedupe-transcriptions.js --execute # 执行删除
 */

const prisma = require('../server/utils/prisma');

const EXECUTE = process.argv.includes('--execute');

function scoreRecord(row, meta) {
  let score = 0;
  if (meta.hasVideoTask) score += 10000;
  if (meta.adjustmentCount > 0) score += 500 + meta.adjustmentCount * 50;
  if (meta.hasRoleSet) score += 800;
  if (meta.hasMerge) score += 300;
  if (row.session_id) score += 100;
  if (row.report_id) score += 100;
  if (row.customer_name) score += 50;
  if (row.status === 'completed') score += 20;
  if (row.dialogues && String(row.dialogues).length > 10) score += 10;
  score += new Date(row.created_at).getTime() / 1e15;
  return score;
}

function buildMetaMaps(videoTasks, adjustments) {
  const videoSet = new Set(videoTasks.map((v) => v.transcription_id));
  const adjByTid = {};
  for (const a of adjustments) {
    if (!adjByTid[a.transcription_id]) adjByTid[a.transcription_id] = [];
    adjByTid[a.transcription_id].push(a);
  }
  return { videoSet, adjByTid };
}

function pickKeeper(records, videoSet, adjByTid) {
  let best = records[0];
  let bestScore = -1;
  for (const r of records) {
    const adjs = adjByTid[r.id] || [];
    const meta = {
      hasVideoTask: videoSet.has(r.id),
      adjustmentCount: adjs.length,
      hasRoleSet: adjs.some((a) => {
        const s = a.speaker_roles ? String(a.speaker_roles).trim() : '';
        return s.length > 0 && s !== '{}';
      }),
      hasMerge: adjs.some((a) => a.note1 === '合并相邻同一说话人的对话'),
    };
    const s = scoreRecord(r, meta);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

async function main() {
  console.log(EXECUTE ? '=== 执行模式：将删除重复记录 ===' : '=== 预览模式（加 --execute 才真正删除）===');

  const dupNames = await prisma.$queryRaw`
    SELECT original_file_name, COUNT(*) AS cnt
    FROM transcriptions
    GROUP BY original_file_name
    HAVING cnt > 1
    ORDER BY cnt DESC
  `;
  console.log(`重复 original_file_name 组数: ${dupNames.length}`);

  if (dupNames.length === 0) {
    console.log('无重复数据');
    await prisma.$disconnect();
    return;
  }

  const dupNameList = dupNames.map((g) => g.original_file_name);
  const allRecords = await prisma.transcriptions.findMany({
    where: { original_file_name: { in: dupNameList } },
    select: {
      id: true,
      name: true,
      original_file_name: true,
      audio_file_path: true,
      status: true,
      session_id: true,
      report_id: true,
      customer_name: true,
      dialogues: true,
      created_at: true,
    },
  });

  const allIds = allRecords.map((r) => r.id);
  const [videoTasks, adjustments] = await Promise.all([
    prisma.presales_video_tasks.findMany({
      where: { transcription_id: { in: allIds } },
      select: { transcription_id: true },
    }),
    prisma.dialogue_adjustments.findMany({
      where: { transcription_id: { in: allIds } },
      select: { transcription_id: true, note1: true, speaker_roles: true },
    }),
  ]);
  const { videoSet, adjByTid } = buildMetaMaps(videoTasks, adjustments);

  const groups = {};
  for (const r of allRecords) {
    if (!groups[r.original_file_name]) groups[r.original_file_name] = [];
    groups[r.original_file_name].push(r);
  }

  const deleteIds = [];
  const reassignConcerns = [];
  let sampleShown = 0;

  for (const g of dupNames) {
    const name = g.original_file_name;
    const records = groups[name] || [];
    if (records.length <= 1) continue;

    const keeper = pickKeeper(records, videoSet, adjByTid);
    const losers = records.filter((r) => r.id !== keeper.id);
    for (const loser of losers) {
      deleteIds.push(loser.id);
      reassignConcerns.push({ from: loser.id, to: keeper.id });
    }

    if (sampleShown < 5) {
      console.log(`\n[样例] ${name} (共${records.length}条)`);
      console.log(`  保留: ${keeper.id.slice(0, 8)} @ ${keeper.created_at.toISOString()}`);
      console.log(`  删除: ${losers.length} 条`);
      sampleShown++;
    }
  }

  console.log(`\n将删除 transcriptions: ${deleteIds.length} 条`);
  console.log(`保留组数: ${dupNames.length}`);

  if (!EXECUTE) {
    console.log('\n预览完成。确认后执行: node scripts/dedupe-transcriptions.js --execute');
    await prisma.$disconnect();
    return;
  }

  let concernsUpdated = 0;
  for (const { from, to } of reassignConcerns) {
    const r = await prisma.concerns.updateMany({
      where: { transcription_id: from },
      data: { transcription_id: to },
    });
    concernsUpdated += r.count;
  }

  const BATCH = 200;
  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += BATCH) {
    const batch = deleteIds.slice(i, i + BATCH);
    const r = await prisma.transcriptions.deleteMany({ where: { id: { in: batch } } });
    deleted += r.count;
    process.stdout.write(`\r已删除 ${deleted}/${deleteIds.length}...`);
  }

  console.log(`\n完成: 删除 ${deleted} 条, concerns 重指向 ${concernsUpdated} 条`);
  const remaining = await prisma.transcriptions.count();
  console.log(`transcriptions 剩余: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
