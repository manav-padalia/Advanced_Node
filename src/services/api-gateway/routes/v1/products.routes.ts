import { FastifyInstance, z } from '@ecommerce/shared/packages';
import { MessagingService } from '../../services/messaging.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';

const messagingService = new MessagingService();

// Validation schemas
const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  name: z.string().min(1, 'Product name is required').max(255),
  slug: z.string().min(1, 'Slug is required').max(255),
  description: z.string().optional(),
  price: z.number().positive('Price must be greater than 0'),
  categoryId: z.string().uuid('Invalid category ID format'),
  imageUrl: z.string().url('Invalid image URL').optional(),
});

const updateProductSchema = createProductSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  categoryId: z.string().uuid().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  search: z.string().optional(),
});

// Helper function to validate UUID
const isValidUUID = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
};

export async function productsRoutes(fastify: FastifyInstance) {
  // Get all products (public)
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Products'],
        summary: 'List products',
        description: 'Returns a paginated list of products. Public endpoint.',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20, maximum: 100 },
            categoryId: { type: 'string', format: 'uuid' },
            minPrice: { type: 'number' },
            maxPrice: { type: 'number' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = querySchema.parse(request.query);
        const result = await messagingService.getProducts(query);
        return reply.send({
          status: 200,
          message: 'Products fetched successfully',
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
          message: error.message || 'Failed to fetch products',
          data: {},
          error: error.message || 'Failed to fetch products',
        });
      }
    },
  );

  // Get product by ID (public)
  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get product by ID',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Validate UUID format
        if (!isValidUUID(id)) {
          return reply.status(400).send({
            status: 400,
            message: 'Validation error',
            data: {},
            error: 'Invalid product ID format. Must be a valid UUID.',
          });
        }

        const result = await messagingService.getProductById(id);
        return reply.send({
          status: 200,
          message: 'Product fetched successfully',
          data: result,
          error: '',
        });
      } catch (error: any) {
        return reply.status(500).send({
          status: 500,
          message: error.message || 'Failed to fetch product',
          data: {},
          error: error.message || 'Failed to fetch product',
        });
      }
    },
  );

  // Create product (admin only)
  fastify.post(
    '/',
    {
      preHandler: [authMiddleware, requireAdmin],
      schema: {
        tags: ['Products'],
        summary: 'Create product (Admin)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['sku', 'name', 'slug', 'price', 'categoryId'],
          properties: {
            sku: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            categoryId: { type: 'string', format: 'uuid' },
            imageUrl: { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Validate request body
        const validatedData = createProductSchema.parse(request.body);
        const result = await messagingService.createProduct(validatedData);
        return reply.status(201).send({
          status: 201,
          message: 'Product created successfully',
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
          message: error.message || 'Failed to create product',
          data: {},
          error: error.message || 'Failed to create product',
        });
      }
    },
  );

  // Update product (admin only)
  fastify.put(
    '/:id',
    {
      preHandler: [authMiddleware, requireAdmin],
      schema: {
        tags: ['Products'],
        summary: 'Update product (Admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Validate UUID format
        if (!isValidUUID(id)) {
          return reply.status(400).send({
            status: 400,
            message: 'Validation error',
            data: {},
            error: 'Invalid product ID format. Must be a valid UUID.',
          });
        }

        // Validate request body
        const validatedData = updateProductSchema.parse(request.body);

        // Check if body is empty
        if (Object.keys(validatedData).length === 0) {
          return reply.status(400).send({
            status: 400,
            message: 'Validation error',
            data: {},
            error:
              'Request body cannot be empty. Provide at least one field to update.',
          });
        }

        const result = await messagingService.updateProduct(id, validatedData);
        return reply.status(200).send({
          status: 200,
          message: 'Product updated successfully',
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
          message: error.message || 'Failed to update product',
          data: {},
          error: error.message || 'Failed to update product',
        });
      }
    },
  );

  // Delete product (admin only)
  fastify.delete(
    '/:id',
    {
      preHandler: [authMiddleware, requireAdmin],
      schema: {
        tags: ['Products'],
        summary: 'Delete product (Admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Validate UUID format
        if (!isValidUUID(id)) {
          return reply.status(400).send({
            status: 400,
            message: 'Validation error',
            data: {},
            error: 'Invalid product ID format. Must be a valid UUID.',
          });
        }

        const result = await messagingService.deleteProduct(id);
        return reply.status(200).send({
          status: 200,
          message: 'Product deleted successfully',
          data: result,
          error: '',
        });
      } catch (error: any) {
        return reply.status(500).send({
          status: 500,
          message: error.message || 'Failed to delete product',
          data: {},
          error: error.message || 'Failed to delete product',
        });
      }
    },
  );
}
