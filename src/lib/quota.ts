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

      // Timestamp collision with another worker; backoff before retrying
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
      }
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

    // Concurrent reset conflict at boundary; backoff before retrying
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
    }
  }

  return { allowed: false, reason: 'Concurrent request conflict, please retry' };
}

/**
 * Atomically refunds 1 request to user daily/hourly quota in case downstream
 * Token creation fails or is aborted.
 */
export async function refundQuota(userId: string): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.user.updateMany({
      where: {
        id: userId,
        dailyQuota: { gt: 0 },
        hourlyQuota: { gt: 0 }
      },
      data: {
        dailyQuota: { decrement: 1 },
        hourlyQuota: { decrement: 1 }
      }
    });
  } catch (err) {
    console.error('Failed to refund quota for user:', userId, err);
  }
}
