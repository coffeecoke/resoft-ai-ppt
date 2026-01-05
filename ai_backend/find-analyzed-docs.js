const { PrismaClient } = require('../online-ppt-backend/node_modules/@prisma/client')
const prisma = new PrismaClient()

async function findAnalyzedDocs() {
  const docs = await prisma.thumbnails.groupBy({
    by: ['document_id'],
    _count: { page_type: true },
    where: { page_type: { not: null } }
  })
  
  console.log('Already analyzed documents:')
  for (const d of docs) {
    const doc = await prisma.documents.findUnique({
      where: { id: d.document_id },
      select: { name: true, id: true }
    })
    console.log(`  ${doc.name} (${doc.id}): ${d._count.page_type} pages`)
  }
  
  await prisma.$disconnect()
}

findAnalyzedDocs()

