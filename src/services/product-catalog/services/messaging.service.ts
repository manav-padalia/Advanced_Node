import {
  getRabbitMQClient,
  QUEUES,
  EXCHANGES,
  ROUTING_KEYS,
  ProductCreatedEvent,
  ProductUpdatedEvent,
  ProductDeletedEvent,
  addErrorHelper,
} from '@ecommerce/shared';
import { createServiceLogger } from '@ecommerce/shared';
import { ProductService } from './product.service';
import { CategoryService } from './category.service';

const logger = createServiceLogger('product-catalog-messaging-service');
const productService = new ProductService();
const categoryService = new CategoryService();

export class MessagingService {
  private client = getRabbitMQClient();

  async initialize(): Promise<void> {
    await this.client.connect();

    // Setup exchanges
    await this.client.assertExchange(EXCHANGES.PRODUCTS, 'topic');

    // Setup RPC servers
    await this.setupRPCServers();

    logger.info('Product catalog messaging service initialized');
  }

  private async setupRPCServers(): Promise<void> {
    // Get products list RPC
    await this.client.setupRPCServer(
      QUEUES.PRODUCT_LIST,
      async (request: any) => {
        try {
          logger.info('Processing get products request', request);
          const products = await productService.getAll(request);
          return { success: true, data: products };
        } catch (error: any) {
          logger.error('Error getting products:', error);
          await addErrorHelper({
            apiName: 'MessagingService.getProductsRPC',
            details: error,
          });
          return { success: false, error: error.message };
        }
      }
    );

    // Get product by ID RPC
    await this.client.setupRPCServer(
      QUEUES.PRODUCT_GET,
      async (request: { productId: string }) => {
        try {
          logger.info('Processing get product request', request);
          const product = await productService.getById(request.productId);
          return { success: true, data: product };
        } catch (error: any) {
          logger.error('Error getting product:', error);
          await addErrorHelper({
            apiName: 'MessagingService.getProductRPC',
            details: error,
          });
          return { success: false, error: error.message };
        }
      }
    );

    // Create product RPC
    await this.client.setupRPCServer(
      'product.create.rpc',
      async (request: any) => {
        try {
          logger.info('Processing create product request', request);
          const product = await productService.create(request);

          // Publish product created event
          await this.publishProductCreated({
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: Number(product.price),
            categoryId: product.categoryId,
          });

          return { success: true, data: product };
        } catch (error: any) {
          logger.error('Error creating product:', error.message || error);
          console.error('Full error:', error);
          await addErrorHelper({
            apiName: 'MessagingService.createProductRPC',
            details: error,
          });
          return { success: false, error: error.message || 'Unknown error' };
        }
      }
    );

    // Update product RPC
    await this.client.setupRPCServer(
      'product.update.rpc',
      async (request: any) => {
        try {
          logger.info('Processing update product request', request);
          const { productId, ...data } = request;
          const product = await productService.update(productId, data);

          // Publish product updated event
          await this.publishProductUpdated({
            productId,
            changes: data,
          });

          return { success: true, data: product };
        } catch (error: any) {
          logger.error('Error updating product:', error);
          await addErrorHelper({
            apiName: 'MessagingService.updateProductRPC',
            details: error,
          });
          return { success: false, error: error.message };
        }
      }
    );

    // Delete product RPC
    await this.client.setupRPCServer(
      'product.delete.rpc',
      async (request: { productId: string }) => {
        try {
          logger.info('Processing delete product request', request);
          await productService.delete(request.productId);

          // Publish product deleted event
          await this.publishProductDeleted({
            productId: request.productId,
            deletedAt: new Date(),
          });

          return { success: true };
        } catch (error: any) {
          logger.error('Error deleting product:', error);
          await addErrorHelper({
            apiName: 'MessagingService.deleteProductRPC',
            details: error,
          });
          return { success: false, error: error.message };
        }
      }
    );

    // Get categories list RPC
    await this.client.setupRPCServer(
      'category.list.rpc',
      async (request: any) => {
        try {
          logger.info('Processing get categories request');
          const categories = await categoryService.getAll();
          return { success: true, data: categories };
        } catch (error: any) {
          logger.error('Error getting categories:', error);
          await addErrorHelper({
            apiName: 'MessagingService.getCategoriesRPC',
            details: error,
          });
          return { success: false, error: error.message };
        }
      }
    );

    // Get category by ID RPC
    await this.client.setupRPCServer(
      'category.get.rpc',
      async (request: { categoryId: string }) => {
        try {
          logger.info('Processing get category request', request);
          const category = await categoryService.getById(request.categoryId);
          return { success: true, data: category };
        } catch (error: any) {
          logger.error('Error getting category:', error);
          await addErrorHelper({
            apiName: 'MessagingService.getCategoryRPC',
            details: error,
          });
          return { success: false, error: error.message };
        }
      }
    );

    // Create category RPC
    await this.client.setupRPCServer(
      'category.create.rpc',
      async (request: any) => {
        try {
          logger.info('Processing create category request', request);
          const category = await categoryService.create(request);
          return { success: true, data: category };
        } catch (error: any) {
          logger.error('Error creating category:', error.message || error);
          await addErrorHelper({
            apiName: 'MessagingService.createCategoryRPC',
            details: error,
          });
          return { success: false, error: error.message || 'Unknown error' };
        }
      }
    );

    // Update category RPC
    await this.client.setupRPCServer(
      'category.update.rpc',
      async (request: any) => {
        try {
          logger.info('Processing update category request', request);
          const { categoryId, ...data } = request;
          const category = await categoryService.update(categoryId, data);
          return { success: true, data: category };
        } catch (error: any) {
          logger.error('Error updating category:', error);
          await addErrorHelper({
            apiName: 'MessagingService.updateCategoryRPC',
            details: error,
          });
          return { success: false, error: error.message };
        }
      }
    );

    // Delete category RPC
    await this.client.setupRPCServer(
      'category.delete.rpc',
      async (request: { categoryId: string }) => {
        try {
          logger.info('Processing delete category request', request);
          await categoryService.delete(request.categoryId);
          return { success: true };
        } catch (error: any) {
          logger.error('Error deleting category:', error);
          await addErrorHelper({
            apiName: 'MessagingService.deleteCategoryRPC',
            details: error,
          });
          return { success: false, error: error.message };
        }
      }
    );

    logger.info('Product catalog RPC servers ready');
  }

  // Publish events
  async publishProductCreated(event: ProductCreatedEvent): Promise<void> {
    try {
      await this.client.publish(
        EXCHANGES.PRODUCTS,
        ROUTING_KEYS.PRODUCT_CREATED,
        event
      );
      logger.info(
        `Published product.created event for product ${event.productId}`
      );
    } catch (error) {
      logger.error('Failed to publish product.created event:', error);
      await addErrorHelper({
        apiName: 'MessagingService.publishProductCreated',
        details: error,
      });
    }
  }

  async publishProductUpdated(event: ProductUpdatedEvent): Promise<void> {
    try {
      await this.client.publish(
        EXCHANGES.PRODUCTS,
        ROUTING_KEYS.PRODUCT_UPDATED,
        event
      );
      logger.info(
        `Published product.updated event for product ${event.productId}`
      );
    } catch (error) {
      logger.error('Failed to publish product.updated event:', error);
      await addErrorHelper({
        apiName: 'MessagingService.publishProductUpdated',
        details: error,
      });
    }
  }

  async publishProductDeleted(event: ProductDeletedEvent): Promise<void> {
    try {
      await this.client.publish(
        EXCHANGES.PRODUCTS,
        ROUTING_KEYS.PRODUCT_DELETED,
        event
      );
      logger.info(
        `Published product.deleted event for product ${event.productId}`
      );
    } catch (error) {
      logger.error('Failed to publish product.deleted event:', error);
      await addErrorHelper({
        apiName: 'MessagingService.publishProductDeleted',
        details: error,
      });
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
