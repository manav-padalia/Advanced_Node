import { FastifyInstance, z } from '@ecommerce/shared/packages';
import { MessagingService } from '../../services/messaging.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';

const messagingService = new MessagingService();

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255),
  slug: z.string().min(1, 'Slug is required').max(255),
  description: z.string().optional(),
  parentId: z
    .string()
    .uuid('Invalid parent category ID format')
    .optional()
    .nullable(),
});

const updateCategorySchema = createCategorySchema.partial();

// Helper function to validate UUID
const isValidUUID = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
};

export async function categoriesRoutes(fastify: FastifyInstance) {
  // Get all categories (public)
  fastify.get('/', async (request, reply) => {
    try {
      const result = await messagingService.getCategories();
      return reply.send({
        status: 200,
        message: 'Categories fetched successfully',
        data: result,
        error: '',
      });
    } catch (error: any) {
      return reply.status(500).send({
        status: 500,
        message: error.message || 'Failed to fetch categories',
        data: {},
        error: error.message || 'Failed to fetch categories',
      });
    }
  });

  // Get category by ID (public)
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Validate UUID format
      if (!isValidUUID(id)) {
        return reply.status(400).send({
          status: 400,
          message: 'Validation error',
          data: {},
          error: 'Invalid category ID format. Must be a valid UUID.',
        });
      }

      const result = await messagingService.getCategoryById(id);
      return reply.send({
        status: 200,
        message: 'Category fetched successfully',
        data: result,
        error: '',
      });
    } catch (error: any) {
      return reply.status(500).send({
        status: 500,
        message: error.message || 'Failed to fetch category',
        data: {},
        error: error.message || 'Failed to fetch category',
      });
    }
  });

  // Create category (admin only)
  fastify.post(
    '/',
    { preHandler: [authMiddleware, requireAdmin] },
    async (request, reply) => {
      try {
        // Validate request body
        const validatedData = createCategorySchema.parse(request.body);
        const result = await messagingService.createCategory(validatedData);
        return reply.status(201).send({
          status: 201,
          message: 'Category created successfully',
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
          message: error.message || 'Failed to create category',
          data: {},
          error: error.message || 'Failed to create category',
        });
      }
    },
  );

  // Update category (admin only)
  fastify.put(
    '/:id',
    { preHandler: [authMiddleware, requireAdmin] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Validate UUID format
        if (!isValidUUID(id)) {
          return reply.status(400).send({
            status: 400,
            message: 'Validation error',
            data: {},
            error: 'Invalid category ID format. Must be a valid UUID.',
          });
        }

        // Validate request body
        const validatedData = updateCategorySchema.parse(request.body);

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

        const result = await messagingService.updateCategory(id, validatedData);
        return reply.status(200).send({
          status: 200,
          message: 'Category updated successfully',
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
          message: error.message || 'Failed to update category',
          data: {},
          error: error.message || 'Failed to update category',
        });
      }
    },
  );

  // Delete category (admin only)
  fastify.delete(
    '/:id',
    { preHandler: [authMiddleware, requireAdmin] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Validate UUID format
        if (!isValidUUID(id)) {
          return reply.status(400).send({
            status: 400,
            message: 'Validation error',
            data: {},
            error: 'Invalid category ID format. Must be a valid UUID.',
          });
        }

        const result = await messagingService.deleteCategory(id);
        return reply.status(200).send({
          status: 200,
          message: 'Category deleted successfully',
          data: result,
          error: '',
        });
      } catch (error: any) {
        return reply.status(500).send({
          status: 500,
          message: error.message || 'Failed to delete category',
          data: {},
          error: error.message || 'Failed to delete category',
        });
      }
    },
  );
}
