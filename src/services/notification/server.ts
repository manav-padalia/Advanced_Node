import { buildApp } from './app';
import {
  consulRegisterService,
  consulDeregisterService,
  createServiceLogger,
  getAdvertiseAddress,
} from '@ecommerce/shared';
import { SocketService } from './services/socket.service';
import { MessagingService } from './services/messaging.service';
import { emailWorker } from './workers/email.worker';
import { alertWorker } from './workers/alert.worker';
import { reportWorker } from './workers/report.worker';
import { cleanupWorker } from './workers/cleanup.worker';
import { errorCleanupWorker } from './workers/error-cleanup.worker';
import {
  initializeScheduledJobs,
  closeQueueManager,
} from './services/queue-manager.service';

const messagingService = new MessagingService();

const logger = createServiceLogger('notification-service');
const PORT = parseInt(process.env.NOTIFICATION_SERVICE_PORT || '3004', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CONSUL_SERVICE_PREFIX = process.env.CONSUL_SERVICE_PREFIX || 'ecommerce';
const SERVICE_NAME = `${CONSUL_SERVICE_PREFIX}-notification`;
const SERVICE_ID = `${SERVICE_NAME}-${PORT}`;

async function start() {
  try {
    const app = await buildApp();

    await app.listen({ port: PORT, host: HOST });

    const { address, port } = getAdvertiseAddress(PORT);
    await consulRegisterService({
      id: SERVICE_ID,
      name: SERVICE_NAME,
      address,
      port,
      tags: ['rest', 'socketio'],
      healthUrl: `http://${address}:${port}/health`,
    });

    // Initialize RabbitMQ messaging
    await messagingService.initialize();
    logger.info('RabbitMQ messaging initialized');

    // Initialize Socket.IO
    const socketService = SocketService.getInstance();
    socketService.initialize(app.server);

    // Initialize scheduled jobs (error cleanup, etc.)
    await initializeScheduledJobs();
    logger.info('Scheduled jobs initialized');

    // Workers are already initialized
    logger.info('Email worker started');
    logger.info('Alert worker started');
    logger.info('Report worker started');
    logger.info('Cleanup worker started');
    logger.info('Error cleanup worker started');

    logger.info(`Notification Service running on http://${HOST}:${PORT}`);
    logger.info(`Socket.IO server running on ws://${HOST}:${PORT}`);
  } catch (err) {
    logger.error({ err }, 'Failed to start Notification Service');
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing workers...');
  try {
    await consulDeregisterService(SERVICE_ID);
  } catch (err) {
    logger.warn({ err }, 'Failed to deregister from Consul');
  }
  await messagingService.disconnect();
  await emailWorker.close();
  await alertWorker.close();
  await reportWorker.close();
  await cleanupWorker.close();
  await errorCleanupWorker.close();
  await closeQueueManager();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing workers...');
  try {
    await consulDeregisterService(SERVICE_ID);
  } catch (err) {
    logger.warn({ err }, 'Failed to deregister from Consul');
  }
  await messagingService.disconnect();
  await emailWorker.close();
  await alertWorker.close();
  await reportWorker.close();
  await cleanupWorker.close();
  await errorCleanupWorker.close();
  await closeQueueManager();
  process.exit(0);
});
