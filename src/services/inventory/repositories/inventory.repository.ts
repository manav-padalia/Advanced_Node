import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export class InventoryRepository {
  async findByProductId(productId: string) {
    return prisma.inventory.findUnique({
      where: { productId },
      include: {
        product: true,
      },
    });
  }

  async findAll() {
    return prisma.inventory.findMany({
      include: {
        product: true,
      },
    });
  }

  async findLowStock() {
    return prisma.inventory.findMany({
      where: {
        quantity: {
          lte: prisma.inventory.fields.lowStockThreshold,
        },
      },
      include: {
        product: true,
      },
    });
  }

  async create(data: any) {
    return prisma.inventory.create({
      data: {
        id: uuidv4(),
        ...data,
      },
    });
  }

  async update(productId: string, data: any) {
    return prisma.inventory.update({
      where: { productId },
      data,
    });
  }

  async reserveStock(productId: string, quantity: number) {
    const inventory = await this.findByProductId(productId);

    if (!inventory) {
      return null;
    }

    const availableStock = inventory.quantity - inventory.reservedQuantity;

    if (availableStock < quantity) {
      return null;
    }

    return prisma.inventory.update({
      where: { productId },
      data: {
        reservedQuantity: {
          increment: quantity,
        },
      },
    });
  }

  async releaseStock(productId: string, quantity: number) {
    return prisma.inventory.update({
      where: { productId },
      data: {
        reservedQuantity: {
          decrement: quantity,
        },
      },
    });
  }

  async confirmReservation(productId: string, quantity: number) {
    return prisma.inventory.update({
      where: { productId },
      data: {
        quantity: {
          decrement: quantity,
        },
        reservedQuantity: {
          decrement: quantity,
        },
      },
    });
  }
}
