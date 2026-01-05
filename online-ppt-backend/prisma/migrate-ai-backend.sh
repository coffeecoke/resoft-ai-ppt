#!/bin/bash

# ============================================
# AI后台管理系统 - 数据库迁移脚本
# ============================================

echo "🚀 开始AI后台管理系统数据库迁移..."
echo ""

# 检查是否在正确的目录
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ 错误：请在 online-ppt-backend 目录下执行此脚本"
    exit 1
fi

# 1. 备份现有数据（可选）
echo "📦 步骤1：备份现有提示词数据..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

(async () => {
  try {
    const data = await prisma.prompt_templates.findMany();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = \`backups/prompt_templates_\${timestamp}.json\`;
    
    // 创建备份目录
    if (!fs.existsSync('backups')) {
      fs.mkdirSync('backups');
    }
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(\`✅ 备份完成：\${filename}\`);
    console.log(\`   记录数：\${data.length}\`);
  } catch (error) {
    console.log('⚠️  备份失败（可能是表不存在）:', error.message);
  } finally {
    await prisma.\$disconnect();
  }
})();
" || echo "⚠️  备份失败，继续迁移..."

echo ""

# 2. 生成迁移文件
echo "📝 步骤2：生成数据库迁移文件..."
npx prisma migrate dev --name add_ai_backend_management --create-only

if [ $? -ne 0 ]; then
    echo "❌ 迁移文件生成失败"
    exit 1
fi

echo ""

# 3. 查看生成的迁移SQL
echo "👀 步骤3：查看生成的迁移SQL..."
echo "请检查 prisma/migrations/ 目录下最新的迁移文件"
echo ""
read -p "是否继续执行迁移？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⏸️  迁移已取消"
    exit 0
fi

# 4. 执行迁移
echo "🔄 步骤4：执行数据库迁移..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
    echo "❌ 迁移执行失败"
    exit 1
fi

echo ""

# 5. 重新生成Prisma Client
echo "🔨 步骤5：重新生成Prisma Client..."
npx prisma generate

echo ""

# 6. 验证迁移结果
echo "✅ 步骤6：验证迁移结果..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // 检查新表
    const modelCount = await prisma.ai_model_configs.count();
    console.log('✅ ai_model_configs 表已创建，当前记录数：', modelCount);
    
    // 检查扩展字段
    const prompts = await prisma.prompt_templates.findMany({ take: 1 });
    if (prompts.length > 0 && 'scene_type' in prompts[0]) {
      console.log('✅ prompt_templates 表已扩展新字段');
    }
    
    console.log('');
    console.log('🎉 数据库迁移完成！');
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    await prisma.\$disconnect();
  }
})();
"

echo ""
echo "================================================"
echo "📚 后续步骤："
echo "1. 运行初始化脚本：node prisma/seed-ai-models.js"
echo "2. 启动AI后台服务：cd ../ai_backend && npm start"
echo "================================================"

