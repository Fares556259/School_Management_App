import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function purgeModel(modelName: string, fieldName: string) {
  console.log(`Checking ${modelName} for Cloudinary URLs in ${fieldName}...`)
  
  const records = await (prisma as any)[modelName].findMany({
    where: {
      [fieldName]: {
        contains: 'cloudinary',
        mode: 'insensitive'
      }
    }
  })

  if (records.length === 0) {
    console.log(`No Cloudinary records found in ${modelName}.${fieldName}.`)
    return
  }

  console.log(`Found ${records.length} records. Purging...`)
  
  const result = await (prisma as any)[modelName].updateMany({
    where: {
      [fieldName]: {
        contains: 'cloudinary',
        mode: 'insensitive'
      }
    },
    data: {
      [fieldName]: null
    }
  })

  console.log(`Successfully purged ${result.count} records from ${modelName}.${fieldName}.`)
}

async function main() {
  console.log('🚀 Starting Cloudinary Data Purge...')
  
  // Model | Field mapping
  const targets = [
    { model: 'admin', field: 'img' },
    { model: 'staff', field: 'img' },
    { model: 'student', field: 'img' },
    { model: 'teacher', field: 'img' },
    { model: 'gradeSheet', field: 'proofUrl' },
    { model: 'examPeriodConfig', field: 'pdfUrl' },
    { model: 'expense', field: 'img' },
    { model: 'income', field: 'img' },
    { model: 'payment', field: 'img' },
    { model: 'notice', field: 'pdfUrl' },
  ]

  for (const target of targets) {
    try {
      await purgeModel(target.model, target.field)
    } catch (err: any) {
      console.error(`Error purging ${target.model}.${target.field}:`, err.message)
    }
  }

  console.log('✅ Purge Complete.')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
