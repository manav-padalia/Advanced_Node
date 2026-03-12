import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MessagingService } from '../../services/messaging.service';
import { authMiddleware } from '../../middleware/auth.middleware';

const messagingService = new MessagingService();

// Validation schemas
const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product ID'),
        quantity: z.number().int().positive('Quantity must be greater than 0'),
        price: z.number().positive('Price must be greater than 0'),
      }),
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

// Helper function to validate UUID
const isValidUUID = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
};

export async function ordersRoutes(fastify: FastifyInstance) {
  // All order routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // Get user orders
  fastify.get('/', async (request, reply) => {
    try {
      const query = querySchema.parse(request.query);
      const result = await messagingService.getUserOrders(
        request.user!.userId,
        query,
      );
      return reply.send({
        status: 200,
        message: 'Orders fetched successfully',
        data: result,
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
  });

  // Get order by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Validate UUID format
      if (!isValidUUID(id)) {
        return reply.status(400).send({
          status: 400,
          message: 'Validation error',
          data: {},
          error: 'Invalid order ID format. Must be a valid UUID.',
        });
      }

      const result = await messagingService.getOrderById(
        id,
        request.user!.userId,
      );
      return reply.send({
        status: 200,
        message: 'Order fetched successfully',
        data: result,
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
  });

  // Create order (checkout)
  fastify.post('/', async (request, reply) => {
    try {
      const validatedData = createOrderSchema.parse(request.body);
      const result = await messagingService.createOrder({
        ...validatedData,
        userId: request.user!.userId,
      });
      return reply.status(201).send({
        status: 201,
        message: 'Order created successfully',
        data: result,
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
  });

  // Cancel order
  fastify.put('/:id/cancel', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Validate UUID format
      if (!isValidUUID(id)) {
        return reply.status(400).send({
          status: 400,
          message: 'Validation error',
          data: {},
          error: 'Invalid order ID format. Must be a valid UUID.',
        });
      }

      const result = await messagingService.cancelOrder(
        id,
        request.user!.userId,
      );
      return reply.status(200).send({
        status: 200,
        message: 'Order cancelled successfully',
        data: result,
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
  });
}
