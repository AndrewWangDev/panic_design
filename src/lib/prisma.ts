import { PrismaClient } from '@prisma/client/edge'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const { env } = getCloudflareContext() as unknown as { env?: { DB?: ConstructorParameters<typeof PrismaD1>[0] } };
  
  if (!env || !env.DB) {
    throw new Error('Cloudflare D1 environment not found.');
  }

  const adapter = new PrismaD1(env.DB);
  const client = new PrismaClient({ adapter });
  globalForPrisma.prisma = client;
  return client;
}
