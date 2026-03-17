import { getRabbitMQClient, QUEUES, EXCHANGES } from '@ecommerce/shared';
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('api-gateway-messaging-service');

export class MessagingService {
  private client = getRabbitMQClient();

  async initialize(): Promise<void> {
    await this.client.connect();

    // Setup exchanges
    await this.client.assertExchange(EXCHANGES.PRODUCTS, 'topic');
    await this.client.assertExchange(EXCHANGES.ORDERS, 'topic');
    await this.client.assertExchange(EXCHANGES.INVENTORY, 'topic');

    logger.info('API Gateway messaging service initialized');
  }

  // Retry wrapper: retries once after a delay if the call fails (handles transient RabbitMQ issues)
  private async rpcWithRetry(
    queue: string,
    payload: any,
    options: { timeout: number },
    retries = 1
  ): Promise<any> {
    try {
      return await this.client.rpcCall(queue, payload, options);
    } catch (error: any) {
      if (retries > 0) {
        logger.warn(
          `RPC call to ${queue} failed (${error.message}), retrying in 1s...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.rpcWithRetry(queue, payload, options, retries - 1);
      }
      throw error;
    }
  }

  // Product service RPC calls
  async getProducts(query: any): Promise<any> {
    try {
      const response = await this.rpcWithRetry(QUEUES.PRODUCT_LIST, query, {
        timeout: 10000,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to get products');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get products:', error);
      throw new Error('Product service unavailable');
    }
  }

  async getProductById(productId: string): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        QUEUES.PRODUCT_GET,
        { productId },
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to get product');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get product:', error);
      throw new Error('Product service unavailable');
    }
  }

  async createProduct(data: any): Promise<any> {
    try {
      const response = await this.rpcWithRetry('product.create.rpc', data, {
        timeout: 10000,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to create product');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create product:', error.message || error);
      throw error.message === 'RPC timeout'
        ? new Error('Product service unavailable')
        : error;
    }
  }

  async updateProduct(productId: string, data: any): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'product.update.rpc',
        { productId, ...data },
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to update product');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to update product:', error);
      throw new Error('Product service unavailable');
    }
  }

  async deleteProduct(productId: string): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'product.delete.rpc',
        { productId },
        { timeout: 10000 }
      );
      return response;
    } catch (error: any) {
      logger.error('Failed to delete product:', error);
      throw new Error('Product service unavailable');
    }
  }

  // Category service RPC calls
  async getCategories(): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'category.list.rpc',
        {},
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to get categories');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get categories:', error);
      throw new Error('Product service unavailable');
    }
  }

  async getCategoryById(categoryId: string): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'category.get.rpc',
        { categoryId },
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to get category');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get category:', error);
      throw new Error('Product service unavailable');
    }
  }

  async createCategory(data: any): Promise<any> {
    try {
      const response = await this.rpcWithRetry('category.create.rpc', data, {
        timeout: 10000,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to create category');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create category:', error.message || error);
      throw error.message === 'RPC timeout'
        ? new Error('Product service unavailable')
        : error;
    }
  }

  async updateCategory(categoryId: string, data: any): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'category.update.rpc',
        { categoryId, ...data },
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to update category');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to update category:', error);
      throw new Error('Product service unavailable');
    }
  }

  async deleteCategory(categoryId: string): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'category.delete.rpc',
        { categoryId },
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete category');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to delete category:', error);
      throw new Error('Product service unavailable');
    }
  }

  // Order service RPC calls
  async getUserOrders(userId: string, query: any): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'order.list.rpc',
        { userId, ...query },
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to get orders');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get orders:', error);
      throw new Error('Order service unavailable');
    }
  }

  async getOrderById(orderId: string, userId: string): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'order.get.rpc',
        { orderId, userId },
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to get order');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get order:', error);
      throw new Error('Order service unavailable');
    }
  }

  async createOrder(data: any): Promise<any> {
    try {
      const response = await this.rpcWithRetry('order.create.rpc', data, {
        timeout: 30000,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to create order');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create order:', error);
      throw new Error('Order service unavailable');
    }
  }

  async cancelOrder(orderId: string, userId: string): Promise<any> {
    try {
      const response = await this.rpcWithRetry(
        'order.cancel.rpc',
        { orderId, userId },
        { timeout: 10000 }
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to cancel order');
      }
      return response.data;
    } catch (error: any) {
      logger.error('Failed to cancel order:', error);
      throw new Error('Order service unavailable');
    }
  }

  // Inventory service RPC calls
  async getInventory(productId: string): Promise<any> {
    try {
      const response = await this.client.rpcCall(
        'inventory.get.rpc',
        { productId },
        { timeout: 10000 }
      );
      return response;
    } catch (error: any) {
      logger.error('Failed to get inventory:', error);
      throw new Error('Inventory service unavailable');
    }
  }

  async updateInventory(productId: string, data: any): Promise<any> {
    try {
      const response = await this.client.rpcCall(
        'inventory.update.rpc',
        { productId, ...data },
        { timeout: 10000 }
      );
      return response;
    } catch (error: any) {
      logger.error('Failed to update inventory:', error);
      throw new Error('Inventory service unavailable');
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
