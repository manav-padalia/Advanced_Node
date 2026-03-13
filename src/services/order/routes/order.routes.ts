import { FastifyInstance } from '@ecommerce/shared/packages';
import { OrderController } from '../controllers/order.controller';

const controller = new OrderController();

export async function orderRoutes(fastify: FastifyInstance) {
  fastify.get('/', controller.getUserOrders.bind(controller));
  fastify.get('/:id', controller.getById.bind(controller));
  fastify.post('/', controller.create.bind(controller));
  fastify.put('/:id/cancel', controller.cancel.bind(controller));
}
