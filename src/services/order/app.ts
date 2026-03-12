import Fastify from 'fastify';
import { responseEnhancerPlugin, createServiceLogger } from '@ecommerce/shared';
import { orderRoutes } from './routes/order.routes';
import { healthRoutes } from './routes/health.routes';

const logger = createServiceLogger('order-service');

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await app.register(responseEnhancerPlugin);

  // Register routes
  await app.register(healthRoutes);
  await app.register(orderRoutes, { prefix: '/orders' });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error({
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    const statusCode = (error as any).statusCode || 500;
    return reply.status(statusCode).send({
      status: statusCode,
      message: error.message || 'Internal server error',
      data: {},
      error: error.message || 'Internal server error',
    });
  });

  return app;
}
