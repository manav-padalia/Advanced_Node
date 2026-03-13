import { Worker, Job } from '@ecommerce/shared/packages';
import { EmailService } from '../services/email.service';
import { SocketService } from '../services/socket.service';
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('alert-worker');
const emailService = new EmailService();

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const alertWorker = new Worker(
  'inventory',
  async (job: Job) => {
    logger.info(`Processing alert job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case 'inventory.low-stock':
          await emailService.sendLowStockAlert(job.data);

          // Emit real-time notification
          const socketService = SocketService.getInstance();
          socketService.emitToAdmins('low-stock-alert', job.data);
          break;

        default:
          logger.warn(`Unknown alert type: ${job.name}`);
      }

      logger.info(`Alert job ${job.id} completed successfully`);
    } catch (error: any) {
      logger.error(`Alert job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 3,
  },
);

alertWorker.on('completed', (job) => {
  logger.info(`Alert job ${job.id} completed`);
});

alertWorker.on('failed', (job, err) => {
  logger.error(`Alert job ${job?.id} failed:`, err);
});
