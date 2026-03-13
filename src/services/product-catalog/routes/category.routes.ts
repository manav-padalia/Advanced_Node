import { FastifyInstance } from '@ecommerce/shared/packages';
import { CategoryController } from '../controllers/category.controller';

const controller = new CategoryController();

export async function categoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', controller.getAll.bind(controller));
  fastify.get('/:id', controller.getById.bind(controller));
  fastify.post('/', controller.create.bind(controller));
  fastify.put('/:id', controller.update.bind(controller));
  fastify.delete('/:id', controller.delete.bind(controller));
}
