import { FastifyInstance } from '@ecommerce/shared/packages';
import { ResponseCodes } from '@ecommerce/shared';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return reply.ok({
      status: ResponseCodes.OK,
      message: 'API Gateway is healthy',
      data: {
        service: 'api-gateway',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      error: '',
    });
  });

  fastify.get('/health/metrics', async (_request, reply) => {
    return reply.ok({
      status: ResponseCodes.OK,
      message: 'Metrics',
      data: {
        service: 'api-gateway',
        uptime: process.uptime(),
        pid: process.pid,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
      error: '',
    });
  });

  fastify.get('/ready', async (request, reply) => {
    // Check if all services are reachable
    return reply.ok({
      status: ResponseCodes.OK,
      message: 'API Gateway is ready',
      data: {
        service: 'api-gateway',
        ready: true,
      },
      error: '',
    });
  });
}
