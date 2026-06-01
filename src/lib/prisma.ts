import { PrismaClient } from '@prisma/client/edge'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function getPrisma() {
  const { env } = getCloudflareContext() as any
  
  if (!env || !env.DB) {
    throw new Error('Cloudflare D1 environment not found.')
  }

  const adapter = new PrismaD1(env.DB)
  return new PrismaClient({ adapter })
}
