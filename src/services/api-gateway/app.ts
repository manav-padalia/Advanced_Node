import {
  Fastify,
  fastifyCors,
  fastifyHelmet,
  fastifyRateLimit,
  fastifyCompress,
  fastifySwagger,
  fastifySwaggerUi,
  Sentry,
} from '@ecommerce/shared/packages';
import {
  responseEnhancerPlugin,
  createServiceLogger,
  initializeSentry,
} from '@ecommerce/shared';
import { config } from './config';
import { authRoutes } from './routes/v1/auth.routes';
import { productsRoutes } from './routes/v1/products.routes';
import { categoriesRoutes } from './routes/v1/categories.routes';
import { ordersRoutes } from './routes/v1/orders.routes';
import { healthRoutes } from './routes/health.routes';
import { authMiddleware } from './middleware/auth.middleware';
import { requireAdmin } from './middleware/rbac.middleware';

const logger = createServiceLogger('api-gateway');

export async function buildApp() {
  // Initialize Sentry for error tracking
  initializeSentry();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
    bodyLimit: 1048576, // 1MB
  });

  // Register plugins
  await app.register(responseEnhancerPlugin);

  await app.register(fastifyCors, {
    origin: config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  await app.register(fastifyCompress, { global: true });

  await app.register(fastifyRateLimit, {
    max: config.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request) => {
      const userId = (request as any).user?.userId;
      return userId ? `user:${userId}` : `ip:${request.ip}`;
    },
  });

  // Swagger documentation
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'E-Commerce API Gateway',
        description: 'API Gateway for E-Commerce Microservices',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // BullMQ dashboard (Bull Board) - Disabled due to Fastify version compatibility
  // Bull Board code removed to avoid dependency conflicts

  // Register routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(productsRoutes, { prefix: '/v1/products' });
  await app.register(categoriesRoutes, { prefix: '/v1/categories' });
  await app.register(ordersRoutes, { prefix: '/v1/orders' });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { service: 'api-gateway' },
        extra: { url: request.url, method: request.method },
      });
    }
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
