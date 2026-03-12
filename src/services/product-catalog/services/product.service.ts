import { NotFoundError } from '@ecommerce/shared';
import { ProductRepository } from '../repositories/product.repository';
import { CacheService } from './cache.service';

const productRepository = new ProductRepository();
const cacheService = new CacheService();

interface ProductQuery {
  page: number;
  limit: number;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export class ProductService {
  async getAll(query: ProductQuery) {
    const cacheKey = `products:${JSON.stringify(query)}`;
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const result = await productRepository.findAll(query);

    await cacheService.set(cacheKey, JSON.stringify(result), 300); // 5 min TTL

    return result;
  }

  async getById(id: string) {
    const cacheKey = `product:${id}`;
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const product = await productRepository.findById(id);

    if (product) {
      await cacheService.set(cacheKey, JSON.stringify(product), 300);
    }

    return product;
  }

  async create(data: any) {
    const product = await productRepository.create(data);

    // Invalidate list cache
    await cacheService.deletePattern('products:*');

    return product;
  }

  async update(id: string, data: any) {
    const product = await productRepository.update(id, data);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Invalidate caches
    await cacheService.delete(`product:${id}`);
    await cacheService.deletePattern('products:*');

    return product;
  }

  async delete(id: string) {
    const deleted = await productRepository.delete(id);

    if (!deleted) {
      throw new NotFoundError('Product not found');
    }

    // Invalidate caches
    await cacheService.delete(`product:${id}`);
    await cacheService.deletePattern('products:*');

    return true;
  }

  async search(query: ProductQuery) {
    return this.getAll(query);
  }
}
