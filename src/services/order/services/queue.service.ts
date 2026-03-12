import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

const orderQueue = new Queue('orders', { connection });

export class QueueService {
  async emitOrderCreated(data: any) {
    await orderQueue.add('order.created', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async emitOrderCancelled(data: any) {
    await orderQueue.add('order.cancelled', data);
  }
}
