import { buildApp } from './app';
import {
  consulRegisterService,
  consulDeregisterService,
  createServiceLogger,
  getAdvertiseAddress,
} from '@ecommerce/shared';
import { MessagingService } from './services/messaging.service';

const messagingService = new MessagingService();

const logger = createServiceLogger('inventory-service');
const PORT = parseInt(process.env.INVENTORY_SERVICE_PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CONSUL_SERVICE_PREFIX = process.env.CONSUL_SERVICE_PREFIX || 'ecommerce';
const SERVICE_NAME = `${CONSUL_SERVICE_PREFIX}-inventory`;
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
      tags: ['rest'],
      healthUrl: `http://${address}:${port}/health`,
    });

    logger.info(`Inventory Service running on http://${HOST}:${PORT}`);
  } catch (err) {
    logger.error({ err }, 'Failed to start Inventory Service');
    process.exit(1);
  }
}

start();

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
