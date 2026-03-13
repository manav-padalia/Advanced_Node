import { FastifyInstance } from '@ecommerce/shared/packages';
import { InventoryController } from '../controllers/inventory.controller';

const controller = new InventoryController();

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', controller.getAll.bind(controller));
  fastify.get('/low-stock', controller.getLowStock.bind(controller));
  fastify.get('/:productId', controller.getByProductId.bind(controller));
  fastify.put('/:productId', controller.update.bind(controller));
  fastify.post('/reserve', controller.reserveStock.bind(controller));
  fastify.post('/release', controller.releaseStock.bind(controller));
}
