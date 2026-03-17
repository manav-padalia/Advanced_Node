import { Queue } from '@ecommerce/shared/packages';
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('queue-manager');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

/**
 * System queue for scheduled tasks
 */
export const systemQueue = new Queue('system', { connection });

/**
 * Initialize scheduled jobs
 */
export const initializeScheduledJobs = async () => {
  try {
    // Clear existing jobs to avoid duplicates
    await systemQueue.clean(0, 1000, 'delayed');
    await systemQueue.clean(0, 1000, 'wait');

    // Schedule error cleanup to run daily at 2 AM
    await systemQueue.add(
      'error-cleanup',
      {},
      {
        repeat: {
          pattern: '0 2 * * *', // Daily at 2 AM
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    logger.info('Scheduled jobs initialized successfully');
  } catch (error: any) {
    logger.error(
      { error: error.message },
      'Failed to initialize scheduled jobs'
    );
    throw error;
  }
};

/**
 * Cleanup queue resources
 */
export const closeQueueManager = async () => {
  try {
    await systemQueue.close();
    logger.info('Queue manager closed');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to close queue manager');
  }
};
