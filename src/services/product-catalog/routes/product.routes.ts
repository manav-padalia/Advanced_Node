import { FastifyInstance } from '@ecommerce/shared/packages';
import { ProductController } from '../controllers/product.controller';

const controller = new ProductController();

export async function productRoutes(fastify: FastifyInstance) {
  fastify.get('/', controller.getAll.bind(controller));
  fastify.get('/:id', controller.getById.bind(controller));
  fastify.post('/', controller.create.bind(controller));
  fastify.put('/:id', controller.update.bind(controller));
  fastify.delete('/:id', controller.delete.bind(controller));
  fastify.get('/search', controller.search.bind(controller));
}
