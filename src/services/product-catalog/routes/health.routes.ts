import { FastifyInstance } from '@ecommerce/shared/packages';
import { ResponseCodes } from '@ecommerce/shared';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return reply.ok({
      status: ResponseCodes.OK,
      message: 'Product Catalog Service is healthy',
      data: {
        service: 'product-catalog-service',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      error: '',
    });
  });
}
