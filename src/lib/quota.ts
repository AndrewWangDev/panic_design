import { getPrisma } from '@/lib/prisma';

export async function checkAndUpdateQuota(userId: string): Promise<{ allowed: boolean, reason?: string }> {
  const prisma = getPrisma();
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: 'User not found' };

  const now = new Date();
  const lastReset = user.lastQuotaReset || new Date(0);
  
  // Calculate if we need to reset hourly or daily
  const isNewDay = now.getUTCFullYear() !== lastReset.getUTCFullYear() || 
                   now.getUTCMonth() !== lastReset.getUTCMonth() || 
                   now.getUTCDate() !== lastReset.getUTCDate();
                   
  const isNewHour = isNewDay || now.getUTCHours() !== lastReset.getUTCHours();

  let newDaily = isNewDay ? 0 : user.dailyQuota;
  let newHourly = isNewHour ? 0 : user.hourlyQuota;

  if (newDaily >= 100) {
    return { allowed: false, reason: 'Daily quota of 100 requests exceeded' };
  }
  if (newHourly >= 30) {
    return { allowed: false, reason: 'Hourly quota of 30 requests exceeded' };
  }

  // Increment and save
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyQuota: newDaily + 1,
      hourlyQuota: newHourly + 1,
      lastQuotaReset: now
    }
  });

  return { allowed: true };
}
