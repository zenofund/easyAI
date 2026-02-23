import prisma from './prisma';

export async function trackUsage(userId: string, feature: string, count: number = 1) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.usageTracking.upsert({
    where: {
      user_id_feature_date: {
        user_id: userId,
        feature: feature,
        date: today
      }
    },
    update: {
      count: { increment: count }
    },
    create: {
      user_id: userId,
      feature: feature,
      date: today,
      count: count
    }
  });
}

export async function getUsageToday(userId: string, feature: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const usage = await prisma.usageTracking.findUnique({
    where: {
      user_id_feature_date: {
        user_id: userId,
        feature: feature,
        date: today
      }
    }
  });

  return usage?.count || 0;
}

export async function checkUsageLimit(userId: string, feature: string, limit: number): Promise<boolean> {
  if (limit === -1) return true; // Unlimited
  const currentUsage = await getUsageToday(userId, feature);
  return currentUsage < limit;
}
