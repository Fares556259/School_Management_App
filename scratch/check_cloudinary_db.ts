import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const models = ['admin', 'staff', 'student', 'teacher', 'gradeSheet', 'examPeriodConfig', 'expense', 'income', 'payment', 'notice']
  console.log('--- Checking Cloudinary URLs in Database ---')
  
  for (const model of models) {
    // @ts-ignore
    const records = await prisma[model].findMany({
      where: {
        OR: [
          { img: { contains: 'cloudinary' } },
          { proofUrl: { contains: 'cloudinary' } },
          { pdfUrl: { contains: 'cloudinary' } }
        ]
      }
    })
    if (records.length > 0) {
      console.log(`Found ${records.length} records in ${model} with Cloudinary URLs`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
