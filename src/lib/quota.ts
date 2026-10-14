import { getPrisma } from '@/lib/prisma';

export async function checkAndUpdateQuota(userId: string): Promise<{ allowed: boolean, reason?: string }> {
  const prisma = getPrisma();
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: 'User not found' };

  const now = new Date();
  const lastReset = user.lastQuotaReset || new Date(0);
  
  const isNewDay = now.getUTCFullYear() !== lastReset.getUTCFullYear() || 
                   now.getUTCMonth() !== lastReset.getUTCMonth() || 
                   now.getUTCDate() !== lastReset.getUTCDate();
                   
  const isNewHour = isNewDay || now.getUTCHours() !== lastReset.getUTCHours();

  // If within the same time window, use atomic database increment with limits
  if (!isNewDay && !isNewHour) {
    const updated = await prisma.user.updateMany({
      where: {
        id: userId,
        dailyQuota: { lt: 100 },
        hourlyQuota: { lt: 30 }
      },
      data: {
        dailyQuota: { increment: 1 },
        hourlyQuota: { increment: 1 },
        lastQuotaReset: now
      }
    });

    if (updated.count === 0) {
      return { allowed: false, reason: 'Quota exceeded (Max 30 requests/hour, 100 requests/day)' };
    }
    return { allowed: true };
  }

  // Crossing hour or day window: reset counter atomically
  const newDaily = isNewDay ? 1 : user.dailyQuota + 1;
  const newHourly = isNewHour ? 1 : user.hourlyQuota + 1;

  if (newDaily > 100) {
    return { allowed: false, reason: 'Daily quota of 100 requests exceeded' };
  }
  if (newHourly > 30) {
    return { allowed: false, reason: 'Hourly quota of 30 requests exceeded' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyQuota: newDaily,
      hourlyQuota: newHourly,
      lastQuotaReset: now
    }
  });

  return { allowed: true };
}
