import { getPrisma } from '@/lib/prisma';

export async function checkAndUpdateQuota(userId: string): Promise<{ allowed: boolean, reason?: string }> {
  const prisma = getPrisma();
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { allowed: false, reason: 'User not found' };

    const now = new Date();
    const lastReset = user.lastQuotaReset || new Date(0);

    const isNewDay = now.getUTCFullYear() !== lastReset.getUTCFullYear() || 
                     now.getUTCMonth() !== lastReset.getUTCMonth() || 
                     now.getUTCDate() !== lastReset.getUTCDate();
                     
    const isNewHour = isNewDay || now.getUTCHours() !== lastReset.getUTCHours();

    // Case 1: Within the same time window
    if (!isNewDay && !isNewHour) {
      if (user.dailyQuota >= 100) {
        return { allowed: false, reason: 'Daily quota of 100 requests exceeded' };
      }
      if (user.hourlyQuota >= 30) {
        return { allowed: false, reason: 'Hourly quota of 30 requests exceeded' };
      }

      const updated = await prisma.user.updateMany({
        where: {
          id: userId,
          dailyQuota: { lt: 100 },
          hourlyQuota: { lt: 30 },
          lastQuotaReset: user.lastQuotaReset
        },
        data: {
          dailyQuota: { increment: 1 },
          hourlyQuota: { increment: 1 },
          lastQuotaReset: now
        }
      });

      if (updated.count > 0) {
        return { allowed: true };
      }

      // Check if it failed because quota was reached concurrently
      const freshUser = await prisma.user.findUnique({ where: { id: userId } });
      if (freshUser && (freshUser.dailyQuota >= 100 || freshUser.hourlyQuota >= 30)) {
        return { allowed: false, reason: 'Quota exceeded (Max 30 requests/hour, 100 requests/day)' };
      }

      // Timestamp collision with another worker, retry
      continue;
    }

    // Case 2: Crossing hour or day window
    const newDaily = isNewDay ? 1 : user.dailyQuota + 1;
    const newHourly = isNewHour ? 1 : user.hourlyQuota + 1;

    if (newDaily > 100) {
      return { allowed: false, reason: 'Daily quota of 100 requests exceeded' };
    }
    if (newHourly > 30) {
      return { allowed: false, reason: 'Hourly quota of 30 requests exceeded' };
    }

    const updated = await prisma.user.updateMany({
      where: {
        id: userId,
        lastQuotaReset: user.lastQuotaReset
      },
      data: {
        dailyQuota: newDaily,
        hourlyQuota: newHourly,
        lastQuotaReset: now
      }
    });

    if (updated.count > 0) {
      return { allowed: true };
    }
    // Concurrent reset conflict at boundary, retry with fresh user state
  }

  return { allowed: false, reason: 'Concurrent request conflict, please retry' };
}
