import { FastifyRequest, FastifyReply, z } from '@ecommerce/shared/packages';
import {
  ResponseCodes,
  NotFoundError,
  BadRequestError,
  addErrorHelper,
} from '@ecommerce/shared';
import { OrderService } from '../services/order.service';

const orderService = new OrderService();

const createOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  paymentMethodId: z.string().optional(),
});

export class OrderController {
  async getUserOrders(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.query as { userId: string };

      if (!userId) {
        throw new BadRequestError('userId is required');
      }

      const orders = await orderService.getUserOrders(userId);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Orders fetched successfully',
        data: { orders },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'OrderController.getUserOrders',
        details: err,
      });
      if (err instanceof BadRequestError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch orders',
        data: {},
        error: err.message || 'Failed to fetch orders',
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.query as { userId: string };

      const order = await orderService.getById(id, userId);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Order fetched successfully',
        data: { order },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'OrderController.getById',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch order',
        data: {},
        error: err.message || 'Failed to fetch order',
      });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = createOrderSchema.parse(request.body);
      const order = await orderService.create(body);

      return reply.created({
        status: ResponseCodes.CREATED,
        message: 'Order created successfully',
        data: { order },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'OrderController.create',
        details: err,
      });
      if (err instanceof BadRequestError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to create order',
        data: {},
        error: err.message || 'Failed to create order',
      });
    }
  }

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };

      const order = await orderService.cancel(id, userId);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Order cancelled successfully',
        data: { order },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'OrderController.cancel',
        details: err,
      });
      if (err instanceof NotFoundError || err instanceof BadRequestError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to cancel order',
        data: {},
        error: err.message || 'Failed to cancel order',
      });
    }
  }
}
