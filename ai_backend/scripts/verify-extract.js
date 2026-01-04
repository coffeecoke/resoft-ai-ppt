const path = require('path')
const { PrismaClient } = require(path.join(__dirname, '../../online-ppt-backend/node_modules/.prisma/client'))

const prisma = new PrismaClient()

async function verify() {
  console.log('=== 验证提取内容（前5页）===\n')
  
  const rows = await prisma.slide_merged_contents.findMany({
    where: { document_id: 'document_1' },
    orderBy: { slide_order: 'asc' },
    take: 5
  })

  rows.forEach(row => {
    console.log(`--- 第 ${row.slide_order} 页 ---`)
    console.log(`内容长度: ${row.content_length}`)
    console.log(`内容预览: ${row.merged_content.substring(0, 100)}`)
    console.log(`包含HTML标签: ${row.merged_content.includes('<')}`)
    console.log('')
  })

  await prisma.$disconnect()
  process.exit(0)
}

verify().catch(console.error)

