import cron from 'node-cron';
import { prisma } from '../config/db';

export function initCronJobs() {
  // Run daily at midnight: Auto-purge free users' resume history older than 7 days
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running 7-day resume history cleanup task for Free users...');
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deletedCount = await prisma.resume.deleteMany({
        where: {
          createdAt: { lt: sevenDaysAgo },
          user: { plan: 'FREE' }
        }
      });

      console.log(`[CRON] Successfully purged ${deletedCount.count} expired resume history records for Free tier.`);
    } catch (err) {
      console.error('[CRON Error] Failed history auto-purge:', err);
    }
  });
}
