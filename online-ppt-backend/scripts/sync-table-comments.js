import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 从 schema.prisma 文件解析表注释
 * 只提取 model 前面紧邻的 /// 注释
 */
function parseTableComments() {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
  const content = fs.readFileSync(schemaPath, 'utf-8')

  const comments = {}
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 检查是否是 /// 注释行
    if (line.startsWith('///')) {
      const comment = line.substring(3).trim()

      // 查找紧跟的 model 行
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim()

        // 跳过空行
        if (!nextLine) continue

        // 匹配 model 声明
        const modelMatch = nextLine.match(/^model\s+(\w+)\s*\{/)
        if (modelMatch) {
          const modelName = modelMatch[1]
          comments[modelName] = comment
          break
        }

        // 如果遇到其他内容，停止查找
        if (!nextLine.startsWith('///')) break
      }
    }
  }

  return comments
}

/**
 * 生成 ALTER TABLE 注释 SQL
 */
function generateAlterTableSQL(tableName, comment) {
  // MySQL COMMENT 需要转义单引号
  const escapedComment = comment.replace(/'/g, "\\'")
  // Prisma 自动将 camelCase model 转换为 snake_case 表名，但也有例外
  // 这里用 Prisma 的实际表名（可通过 @map 指定，否则就是 model 名的 PascalCase）
  return `ALTER TABLE \`${tableName}\` COMMENT = '${escapedComment}';`
}

/**
 * 执行 SQL 并输出结果
 */
async function executeSyncComments() {
  try {
    console.log('📖 解析 schema.prisma...')
    const comments = parseTableComments()

    console.log(`✅ 找到 ${Object.keys(comments).length} 个表注释\n`)

    if (Object.keys(comments).length === 0) {
      console.log('⚠️  没有找到任何表注释')
      return
    }

    // 打印所有要执行的 SQL
    console.log('📝 即将执行以下 SQL：\n')
    const sqlStatements = []
    for (const [modelName, comment] of Object.entries(comments)) {
      const sql = generateAlterTableSQL(modelName, comment)
      sqlStatements.push(sql)
      console.log(`${modelName}: ${comment}`)
      console.log(`   SQL: ${sql}\n`)
    }

    // 执行所有 SQL
    console.log('⏳ 执行 SQL...\n')
    for (const sql of sqlStatements) {
      try {
        await prisma.$executeRawUnsafe(sql)
      } catch (error) {
        console.error(`❌ 执行失败: ${sql}`)
        console.error(`   错误: ${error.message}`)
      }
    }

    console.log('✨ 所有表注释同步完成！')
  } catch (error) {
    console.error('❌ 脚本执行出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行脚本
executeSyncComments()
