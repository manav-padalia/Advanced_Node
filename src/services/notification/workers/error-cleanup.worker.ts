import { Worker, Job } from '@ecommerce/shared/packages';
import { createServiceLogger } from '@ecommerce/shared';
import prisma from '../../../shared/utils/prisma';

const logger = createServiceLogger('error-cleanup-worker');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

/**
 * Worker to clean up old error logs from database
 * Runs daily and deletes errors older than 3 months
 */
export const errorCleanupWorker = new Worker(
  'system',
  async (job: Job) => {
    logger.info('Starting error cleanup job');

    try {
      // Calculate date 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Delete old errors
      const result = await prisma.errors.deleteMany({
        where: {
          createdAt: {
            lt: threeMonthsAgo,
          },
        },
      });

      logger.info(
        {
          deletedCount: result.count,
          cutoffDate: threeMonthsAgo.toISOString(),
        },
        'Error cleanup completed successfully'
      );

      return {
        success: true,
        deletedCount: result.count,
        cutoffDate: threeMonthsAgo.toISOString(),
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        'Error cleanup job failed'
      );
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

errorCleanupWorker.on('completed', (job) => {
  logger.info(`Error cleanup job ${job.id} completed`);
});

errorCleanupWorker.on('failed', (job, err) => {
  logger.error(`Error cleanup job ${job?.id} failed:`, err);
});
