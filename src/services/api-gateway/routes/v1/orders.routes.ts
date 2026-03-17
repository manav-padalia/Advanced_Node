import { FastifyInstance, z } from '@ecommerce/shared/packages';
import { ProxyService } from '../../services/proxy.service';
import { authMiddleware } from '../../middleware/auth.middleware';

const proxyService = new ProxyService();
const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || 'http://localhost:3002';
const ORDER_SERVICE_NAME = process.env.ORDER_SERVICE_NAME || 'ecommerce-order';

// Validation schemas
const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product ID'),
        quantity: z.number().int().positive('Quantity must be greater than 0'),
        price: z.number().positive('Price must be greater than 0').optional(),
      })
    )
    .min(1, 'At least one item is required'),
  shippingAddress: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'Zip code is required'),
    country: z.string().min(1, 'Country is required'),
  }),
  paymentMethod: z.string().optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
});

const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /v1/orders — list user orders
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Orders'],
        summary: 'List my orders',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20, maximum: 100 },
            status: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        querySchema.parse(request.query);
        const result = await proxyService.forward(
          ORDER_SERVICE_NAME,
          ORDER_SERVICE_URL,
          '/orders',
          'GET',
          { userId: request.user!.userId }
        );
        return reply.send({
          status: 200,
          message: 'Orders fetched successfully',
          data: result.data?.orders ?? result.data ?? result,
          error: '',
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            status: 400,
            message: 'Validation error',
            data: {},
            error: error.errors
              .map((e) => `${e.path.join('.')}: ${e.message}`)
              .join(', '),
          });
        }
        return reply.status(500).send({
          status: 500,
          message: error.message || 'Failed to fetch orders',
          data: {},
          error: error.message || 'Failed to fetch orders',
        });
      }
    }
  );

  // GET /v1/orders/:id — get order by ID
  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Get order by ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidUUID(id)) {
        return reply.status(400).send({
          status: 400,
          message: 'Validation error',
          data: {},
          error: 'Invalid order ID format. Must be a valid UUID.',
        });
      }
      try {
        const result = await proxyService.forward(
          ORDER_SERVICE_NAME,
          ORDER_SERVICE_URL,
          `/orders/${id}`,
          'GET',
          { userId: request.user!.userId }
        );
        return reply.send({
          status: 200,
          message: 'Order fetched successfully',
          data: result.data?.order ?? result.data ?? result,
          error: '',
        });
      } catch (error: any) {
        return reply.status(500).send({
          status: 500,
          message: error.message || 'Failed to fetch order',
          data: {},
          error: error.message || 'Failed to fetch order',
        });
      }
    }
  );

  // POST /v1/orders — create order
  fastify.post(
    '/',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Create order',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['items', 'shippingAddress'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['productId', 'quantity'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'integer', minimum: 1 },
                },
              },
            },
            shippingAddress: {
              type: 'object',
              required: ['street', 'city', 'state', 'zipCode', 'country'],
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                zipCode: { type: 'string' },
                country: { type: 'string' },
              },
            },
            paymentMethod: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const validatedData = createOrderSchema.parse(request.body);
        const result = await proxyService.forward(
          ORDER_SERVICE_NAME,
          ORDER_SERVICE_URL,
          '/orders',
          'POST',
          {
            userId: request.user!.userId,
            items: validatedData.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
            shippingAddress: validatedData.shippingAddress,
            paymentMethodId: validatedData.paymentMethod,
          }
        );
        return reply.status(201).send({
          status: 201,
          message: 'Order created successfully',
          data: result.data?.order ?? result.data ?? result,
          error: '',
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            status: 400,
            message: 'Validation error',
            data: {},
            error: error.errors
              .map((e) => `${e.path.join('.')}: ${e.message}`)
              .join(', '),
          });
        }
        return reply.status(500).send({
          status: 500,
          message: error.message || 'Failed to create order',
          data: {},
          error: error.message || 'Failed to create order',
        });
      }
    }
  );

  // PUT /v1/orders/:id/cancel — cancel order
  fastify.put(
    '/:id/cancel',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Cancel order',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidUUID(id)) {
        return reply.status(400).send({
          status: 400,
          message: 'Validation error',
          data: {},
          error: 'Invalid order ID format. Must be a valid UUID.',
        });
      }
      try {
        const result = await proxyService.forward(
          ORDER_SERVICE_NAME,
          ORDER_SERVICE_URL,
          `/orders/${id}/cancel`,
          'PUT',
          { userId: request.user!.userId }
        );
        return reply.status(200).send({
          status: 200,
          message: 'Order cancelled successfully',
          data: result.data?.order ?? result.data ?? result,
          error: '',
        });
      } catch (error: any) {
        return reply.status(500).send({
          status: 500,
          message: error.message || 'Failed to cancel order',
          data: {},
          error: error.message || 'Failed to cancel order',
        });
      }
    }
  );
}
