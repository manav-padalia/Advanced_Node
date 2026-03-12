import { FastifyInstance } from 'fastify';
import { ResponseCodes } from '@ecommerce/shared';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return reply.ok({
      status: ResponseCodes.OK,
      message: 'Notification Service is healthy',
      data: {
        service: 'notification-service',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      error: '',
    });
  });
}
