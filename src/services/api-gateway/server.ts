import cluster from 'node:cluster';
import os from 'node:os';
import { buildApp } from './app';
import {
  consulRegisterService,
  consulDeregisterService,
  createServiceLogger,
  getAdvertiseAddress,
} from '@ecommerce/shared';
import { MessagingService } from './services/messaging.service';

const messagingService = new MessagingService();

const logger = createServiceLogger('api-gateway');
const PORT = parseInt(process.env.API_GATEWAY_PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CONSUL_SERVICE_PREFIX = process.env.CONSUL_SERVICE_PREFIX || 'ecommerce';
const SERVICE_NAME = `${CONSUL_SERVICE_PREFIX}-api-gateway`;
const SERVICE_ID = `${SERVICE_NAME}-${PORT}`;

async function start() {
  try {
    // Initialize RabbitMQ messaging
    await messagingService.initialize();
    logger.info('RabbitMQ messaging initialized');

    const app = await buildApp();

    await app.listen({ port: PORT, host: HOST });

    const { address, port } = getAdvertiseAddress(PORT);
    await consulRegisterService({
      id: SERVICE_ID,
      name: SERVICE_NAME,
      address,
      port,
      tags: ['gateway'],
      healthUrl: `http://${address}:${port}/health`,
    });

    logger.info(`API Gateway running on http://${HOST}:${PORT}`);
    logger.info(`Swagger docs available at http://${HOST}:${PORT}/docs`);
  } catch (err) {
    logger.error({ err }, 'Failed to start API Gateway');
    process.exit(1);
  }
}

if (process.env.CLUSTER_MODE === 'true' && cluster.isPrimary) {
  const workers =
    parseInt(process.env.CLUSTER_WORKERS || '', 10) || os.cpus().length;
  logger.info(`Starting API Gateway in cluster mode with ${workers} workers`);
  for (let i = 0; i < workers; i++) cluster.fork();
  cluster.on('exit', (worker) => {
    logger.warn(`Worker ${worker.process.pid} exited; restarting`);
    cluster.fork();
  });
} else {
  start();
}

async function shutdown() {
  try {
    await messagingService.disconnect();
    await consulDeregisterService(SERVICE_ID);
  } catch (err) {
    logger.warn({ err }, 'Failed to deregister from Consul');
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
