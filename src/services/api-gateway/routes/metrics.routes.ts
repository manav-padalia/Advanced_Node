import { FastifyInstance } from '@ecommerce/shared/packages';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from 'prom-client';

// Create a dedicated registry so it doesn't pollute the global one
const register = new Registry();
register.setDefaultLabels({ app: 'api-gateway' });

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export async function metricsRoutes(fastify: FastifyInstance) {
  // Hook to record metrics on every request
  fastify.addHook('onResponse', (request, reply, done) => {
    const route = request.routerPath || request.url;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    httpRequestsTotal.inc(labels);
    done();
  });

  // Prometheus scrape endpoint — NOT included in Swagger docs intentionally
  fastify.get(
    '/metrics',
    {
      schema: { hide: true },
    },
    async (_request, reply) => {
      reply.header('Content-Type', register.contentType);
      return reply.send(await register.metrics());
    },
  );
}
