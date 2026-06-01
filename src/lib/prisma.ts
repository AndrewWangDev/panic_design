import { PrismaClient } from '@prisma/client/edge'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function getPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const { env } = getCloudflareContext() as any
  
  if (!env || !env.DB) {
    throw new Error('Cloudflare D1 environment not found. Make sure you are running via wrangler or @opennextjs/cloudflare')
  }

  const adapter = new PrismaD1(env.DB)
  const prisma = new PrismaClient({ adapter, log: ['query'] })
  
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
  
  return prisma
}
