import { FastifyRequest, FastifyReply, z } from '@ecommerce/shared/packages';
import {
  ResponseCodes,
  NotFoundError,
  addErrorHelper,
} from '@ecommerce/shared';
import { CategoryService } from '../services/category.service';

const categoryService = new CategoryService();

const createCategorySchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

export class CategoryController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const categories = await categoryService.getAll();

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Categories fetched successfully',
        data: { categories },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'CategoryController.getAll',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch categories',
        data: {},
        error: err.message || 'Failed to fetch categories',
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const category = await categoryService.getById(id);

      if (!category) {
        throw new NotFoundError('Category not found');
      }

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Category fetched successfully',
        data: { category },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'CategoryController.getById',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch category',
        data: {},
        error: err.message || 'Failed to fetch category',
      });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = createCategorySchema.parse(request.body);
      const category = await categoryService.create(body);

      return reply.created({
        status: ResponseCodes.CREATED,
        message: 'Category created successfully',
        data: { category },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'CategoryController.create',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to create category',
        data: {},
        error: err.message || 'Failed to create category',
      });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const body = updateCategorySchema.parse(request.body);
      const category = await categoryService.update(id, body);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Category updated successfully',
        data: { category },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'CategoryController.update',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to update category',
        data: {},
        error: err.message || 'Failed to update category',
      });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await categoryService.delete(id);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Category deleted successfully',
        data: {},
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'CategoryController.delete',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to delete category',
        data: {},
        error: err.message || 'Failed to delete category',
      });
    }
  }
}
