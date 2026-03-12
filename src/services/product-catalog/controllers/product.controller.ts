import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  ResponseCodes,
  BadRequestError,
  NotFoundError,
  addErrorHelper,
} from '@ecommerce/shared';
import { ProductService } from '../services/product.service';

const productService = new ProductService();

const createProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  price: z.number().positive(),
  categoryId: z.string().uuid(),
  imageUrl: z.string().url().optional(),
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

export class ProductController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = querySchema.parse(request.query);
      const result = await productService.getAll(query);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Products fetched successfully',
        data: result,
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'ProductController.getAll',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch products',
        data: {},
        error: err.message || 'Failed to fetch products',
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const product = await productService.getById(id);

      if (!product) {
        throw new NotFoundError('Product not found');
      }

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Product fetched successfully',
        data: { product },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'ProductController.getById',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch product',
        data: {},
        error: err.message || 'Failed to fetch product',
      });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = createProductSchema.parse(request.body);
      const product = await productService.create(body);

      return reply.created({
        status: ResponseCodes.CREATED,
        message: 'Product created successfully',
        data: { product },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'ProductController.create',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to create product',
        data: {},
        error: err.message || 'Failed to create product',
      });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const body = updateProductSchema.parse(request.body);
      const product = await productService.update(id, body);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Product updated successfully',
        data: { product },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'ProductController.update',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to update product',
        data: {},
        error: err.message || 'Failed to update product',
      });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await productService.delete(id);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Product deleted successfully',
        data: {},
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'ProductController.delete',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to delete product',
        data: {},
        error: err.message || 'Failed to delete product',
      });
    }
  }

  async search(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = querySchema.parse(request.query);
      const result = await productService.search(query);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Search completed successfully',
        data: result,
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'ProductController.search',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Search failed',
        data: {},
        error: err.message || 'Search failed',
      });
    }
  }
}
