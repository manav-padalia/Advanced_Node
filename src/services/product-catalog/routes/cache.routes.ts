import { FastifyInstance } from 'fastify';
import { ResponseCodes } from '@ecommerce/shared';
import { CacheService } from '../services/cache.service';

const cacheService = new CacheService();

export async function cacheRoutes(fastify: FastifyInstance) {
  // Get cache metrics
  fastify.get('/metrics', async (request, reply) => {
    return reply.send({
      status: ResponseCodes.OK,
      message: 'Cache metrics retrieved successfully',
      data: cacheService.getMetrics(),
      error: '',
    });
  });

  // Reset cache metrics
  fastify.post('/reset', async (request, reply) => {
    cacheService.resetMetrics();
    return reply.send({
      status: ResponseCodes.OK,
      message: 'Cache metrics reset successfully',
      data: {},
      error: '',
    });
  });
}
