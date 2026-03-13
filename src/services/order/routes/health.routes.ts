import { FastifyInstance } from '@ecommerce/shared/packages';
import { ResponseCodes } from '@ecommerce/shared';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return reply.ok({
      status: ResponseCodes.OK,
      message: 'Order Service is healthy',
      data: {
        service: 'order-service',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      error: '',
    });
  });
}
