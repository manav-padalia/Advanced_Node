import { Worker, Job } from '@ecommerce/shared/packages';
import { EmailService } from '../services/email.service';
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('email-worker');
const emailService = new EmailService();

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const emailWorker = new Worker(
  'orders',
  async (job: Job) => {
    logger.info(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case 'order.created':
          await emailService.sendOrderConfirmation(job.data);
          break;

        case 'order.cancelled':
          await emailService.sendOrderCancellation(job.data);
          break;

        default:
          logger.warn(`Unknown job type: ${job.name}`);
      }

      logger.info(`Job ${job.id} completed successfully`);
    } catch (error: any) {
      logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  },
);

emailWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});
