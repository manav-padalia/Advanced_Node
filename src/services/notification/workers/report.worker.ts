import { Worker, Job } from '@ecommerce/shared/packages';
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('report-worker');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const reportWorker = new Worker(
  'reports',
  async (job: Job) => {
    logger.info(`Processing report job ${job.id} of type ${job.name}`);
    if (job.name !== 'report.generate') {
      logger.warn(`Unknown report job type: ${job.name}`);
      return;
    }

    // Placeholder: in production this would generate CSV/PDF and store it.
    const report = {
      generatedAt: new Date().toISOString(),
      params: job.data ?? {},
    };
    return report;
  },
  { connection, concurrency: 2 }
);

reportWorker.on('completed', (job) => {
  logger.info(`Report job ${job.id} completed`);
});

reportWorker.on('failed', (job, err) => {
  logger.error(`Report job ${job?.id} failed:`, err);
});
