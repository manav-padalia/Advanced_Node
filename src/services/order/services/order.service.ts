import { NotFoundError, BadRequestError } from '@ecommerce/shared';
import { OrderRepository } from '../repositories/order.repository';
import { PaymentService } from './payment.service';
import { MessagingService } from './messaging.service';

const orderRepository = new OrderRepository();
const paymentService = new PaymentService();
const messagingService = new MessagingService();

interface CreateOrderData {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: any;
  paymentMethodId?: string;
}

export class OrderService {
  async getUserOrders(userId: string) {
    return orderRepository.findByUserId(userId);
  }

  async getById(id: string, userId: string) {
    const order = await orderRepository.findById(id);

    if (order && order.userId !== userId) {
      throw new NotFoundError('Order not found');
    }

    return order;
  }

  async create(data: CreateOrderData) {
    // Step 1: Reserve inventory via RabbitMQ
    const reservations = await messagingService.reserveStock(data.items);

    if (!reservations.success) {
      throw new BadRequestError(
        reservations.message || 'Insufficient stock for some items',
      );
    }

    try {
      // Step 2: Calculate totals
      const { subtotal, tax, total } = await this.calculateTotals(data.items);

      // Step 3: Create order
      const order = await orderRepository.create({
        userId: data.userId,
        items: data.items,
        shippingAddress: data.shippingAddress,
        subtotal,
        tax,
        total,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      });

      // Step 4: Process payment
      if (data.paymentMethodId) {
        const payment = await paymentService.processPayment({
          orderId: order.id,
          amount: total,
          paymentMethodId: data.paymentMethodId,
        });

        if (payment.success) {
          await orderRepository.updatePaymentStatus(order.id, 'COMPLETED');
          await orderRepository.updateStatus(order.id, 'CONFIRMED');

          // Confirm inventory reservation
          await messagingService.confirmReservation(data.items);
        } else {
          // Release inventory if payment fails
          await messagingService.releaseStock(data.items);
          throw new BadRequestError('Payment failed');
        }
      }

      // Step 5: Publish order created event via RabbitMQ
      await messagingService.publishOrderCreated({
        orderId: order.id,
        userId: data.userId,
        total: Number(total),
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: 0, // Should be fetched from product
        })),
        shippingAddress: data.shippingAddress,
        createdAt: new Date(),
      });

      return order;
    } catch (error) {
      // Release inventory on any error
      await messagingService.releaseStock(data.items);
      throw error;
    }
  }

  async cancel(id: string, userId: string) {
    const order = await orderRepository.findById(id);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== userId) {
      throw new NotFoundError('Order not found');
    }

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestError('Order cannot be cancelled');
    }

    // Release inventory via RabbitMQ
    const items = order.items.map((item: any) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
    await messagingService.releaseStock(items);

    // Update order status
    const updatedOrder = await orderRepository.updateStatus(id, 'CANCELLED');

    // Publish order cancelled event
    await messagingService.publishOrderCancelled({
      orderId: id,
      userId,
      items,
      cancelledAt: new Date(),
    });

    return updatedOrder;
  }

  private async calculateTotals(
    items: Array<{ productId: string; quantity: number }>,
  ) {
    // Fetch product prices and calculate
    const subtotal = 1000; // Simplified - should fetch actual prices
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }
}
