import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export class OrderRepository {
  async findByUserId(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
      },
    });
  }

  async create(data: any) {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    return prisma.order.create({
      data: {
        id: uuidv4(),
        orderNumber,
        userId: data.userId,
        status: data.status,
        paymentStatus: data.paymentStatus,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        shippingAddress: data.shippingAddress,
        items: {
          create: data.items.map((item: any) => ({
            id: uuidv4(),
            productId: item.productId,
            quantity: item.quantity,
            price: item.price || 0,
            subtotal: item.subtotal || 0,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return prisma.order.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updatePaymentStatus(id: string, paymentStatus: string) {
    return prisma.order.update({
      where: { id },
      data: { paymentStatus: paymentStatus as any },
    });
  }
}
