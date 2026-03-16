import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue } from '@ecommerce/shared/packages';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

const BASE_PATH = '/admin/queues';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// All BullMQ queues in the system
const queues = [
  new Queue('orders', { connection }),
  new Queue('inventory', { connection }),
  new Queue('reports', { connection }),
  new Queue('cleanup', { connection }),
  new Queue('system', { connection }),
];

export const bullBoardPlugin = fp(async (app: FastifyInstance) => {
  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q) as any),
    serverAdapter,
  });

  serverAdapter.setBasePath(BASE_PATH);

  await app.register(serverAdapter.registerPlugin(), {
    prefix: BASE_PATH,
    basePath: BASE_PATH,
  });
});
