import { Fastify } from '@ecommerce/shared/packages';
import { responseEnhancerPlugin, createServiceLogger } from '@ecommerce/shared';
import { productRoutes } from './routes/product.routes';
import { categoryRoutes } from './routes/category.routes';
import { healthRoutes } from './routes/health.routes';
import { cacheRoutes } from './routes/cache.routes';

const logger = createServiceLogger('product-catalog-service');

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await app.register(responseEnhancerPlugin);

  // Register routes
  await app.register(healthRoutes);
  await app.register(productRoutes, { prefix: '/products' });
  await app.register(categoryRoutes, { prefix: '/categories' });
  await app.register(cacheRoutes, { prefix: '/cache' });

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
