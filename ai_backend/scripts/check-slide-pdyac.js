const path = require('path')
const { PrismaClient } = require(path.join(__dirname, '../../online-ppt-backend/node_modules/.prisma/client'))

const prisma = new PrismaClient()

async function checkSlide() {
  const result = await prisma.slide_merged_contents.findFirst({
    where: { slide_id: 'PdyAc8WN5Q' }
  })
  
  console.log('=== 数据库中slideId=PdyAc8WN5Q的内容 ===\n')
  console.log('长度:', result.content_length)
  console.log('\n内容:')
  console.log(result.merged_content)
  
  await prisma.$disconnect()
}

checkSlide()

