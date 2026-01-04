const path = require('path')
const { PrismaClient } = require(path.join(__dirname, '../../online-ppt-backend/node_modules/.prisma/client'))

const prisma = new PrismaClient()

async function check() {
  const rows = await prisma.slide_merged_contents.findMany({
    where: { document_id: 'document_3' },
    orderBy: { slide_order: 'asc' },
    take: 5
  })
  
  console.log('=== 数据库前5条记录 ===\n')
  rows.forEach(row => {
    console.log(`slide_order=${row.slide_order}, slide_id=${row.slide_id}`)
    console.log(`content(前50字符): ${row.merged_content.substring(0, 50)}`)
    console.log('')
  })
  
  await prisma.$disconnect()
}

check()

