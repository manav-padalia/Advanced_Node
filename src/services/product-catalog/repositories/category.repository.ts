import { PrismaClient, uuidv4 } from '@ecommerce/shared/packages';

const prisma = new PrismaClient();

export class CategoryRepository {
  async findAll() {
    return prisma.category.findMany({
      where: { isActive: true },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        products: {
          where: { isActive: true },
          take: 10,
        },
      },
    });
  }

  async create(data: any) {
    return prisma.category.create({
      data: {
        id: uuidv4(),
        ...data,
      },
    });
  }

  async update(id: string, data: any) {
    return prisma.category.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    try {
      await prisma.category.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
