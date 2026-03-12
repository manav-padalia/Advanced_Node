import { NotFoundError } from '@ecommerce/shared';
import { CategoryRepository } from '../repositories/category.repository';

const categoryRepository = new CategoryRepository();

export class CategoryService {
  async getAll() {
    return categoryRepository.findAll();
  }

  async getById(id: string) {
    return categoryRepository.findById(id);
  }

  async create(data: any) {
    return categoryRepository.create(data);
  }

  async update(id: string, data: any) {
    const category = await categoryRepository.update(id, data);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  async delete(id: string) {
    const deleted = await categoryRepository.delete(id);

    if (!deleted) {
      throw new NotFoundError('Category not found');
    }

    return true;
  }
}
