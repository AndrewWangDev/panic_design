import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();

    // 1. Get truly active tokens count (unrevoked AND not yet expired by TTL)
    const unrevokedTokens = await prisma.token.findMany({
      where: {
        userId: session.user.id,
        isRevoked: false
      },
      select: {
        createdAt: true,
        config: true
      }
    });

    const nowMs = Date.now();
    let activeTokens = 0;
    for (const t of unrevokedTokens) {
      try {
        const config = JSON.parse(t.config);
        const ttlHours = parseFloat(config.ttlHours || config.ttl) || 0.25;
        const expiresAt = t.createdAt.getTime() + ttlHours * 60 * 60 * 1000;
        if (expiresAt > nowMs) {
          activeTokens++;
        }
      } catch {
        // Ignore JSON parse errors for corrupted configs
      }
    }

    // 2. Get quota usage from User table
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dailyQuota: true, hourlyQuota: true, lastQuotaReset: true }
    });

    const now = new Date();
    const lastReset = user?.lastQuotaReset || new Date(0);

    const isNewDay = now.getUTCFullYear() !== lastReset.getUTCFullYear() || 
                     now.getUTCMonth() !== lastReset.getUTCMonth() || 
                     now.getUTCDate() !== lastReset.getUTCDate();
                     
    const isNewHour = isNewDay || now.getUTCHours() !== lastReset.getUTCHours();

    const dailyUsage = isNewDay ? 0 : (user?.dailyQuota || 0);
    const hourlyUsage = isNewHour ? 0 : (user?.hourlyQuota || 0);

    const nextHourReset = new Date(now);
    nextHourReset.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);

    const nextDayReset = new Date(now);
    nextDayReset.setUTCDate(now.getUTCDate() + 1);
    nextDayReset.setUTCHours(0, 0, 0, 0);

    return NextResponse.json({
      tokens: activeTokens,
      dailyUsage,
      dailyLimit: 100,
      hourlyUsage,
      hourlyLimit: 30,
      nextHourReset: nextHourReset.toISOString(),
      nextDayReset: nextDayReset.toISOString()
    });
  } catch (error) {
    console.error('Fetch Stats Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
