import {
  getRabbitMQClient,
  QUEUES,
  EXCHANGES,
  ROUTING_KEYS,
  ReserveStockRequest,
  ReserveStockResponse,
  ReleaseStockRequest,
  ReleaseStockResponse,
  ConfirmReservationRequest,
  ConfirmReservationResponse,
  OrderCreatedEvent,
  OrderCancelledEvent,
  OrderConfirmedEvent,
} from '@ecommerce/shared';
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('order-messaging-service');

export class MessagingService {
  private client = getRabbitMQClient();

  async initialize(): Promise<void> {
    await this.client.connect();

    // Setup exchanges
    await this.client.assertExchange(EXCHANGES.ORDERS, 'topic');

    logger.info('Order messaging service initialized');
  }

  // RPC calls to Inventory Service
  async reserveStock(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<ReserveStockResponse> {
    try {
      const request: ReserveStockRequest = { items };
      const response = await this.client.rpcCall<ReserveStockResponse>(
        QUEUES.INVENTORY_RESERVE,
        request,
        { timeout: 10000 }
      );
      return response;
    } catch (error: any) {
      logger.error('Failed to reserve stock:', error);
      return { success: false, message: error.message };
    }
  }

  async releaseStock(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<ReleaseStockResponse> {
    try {
      const request: ReleaseStockRequest = { items };
      const response = await this.client.rpcCall<ReleaseStockResponse>(
        QUEUES.INVENTORY_RELEASE,
        request,
        { timeout: 10000 }
      );
      return response;
    } catch (error: any) {
      logger.error('Failed to release stock:', error);
      return { success: false, message: error.message };
    }
  }

  async confirmReservation(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<ConfirmReservationResponse> {
    try {
      const request: ConfirmReservationRequest = { items };
      const response = await this.client.rpcCall<ConfirmReservationResponse>(
        QUEUES.INVENTORY_CONFIRM,
        request,
        { timeout: 10000 }
      );
      return response;
    } catch (error: any) {
      logger.error('Failed to confirm reservation:', error);
      return { success: false, message: error.message };
    }
  }

  // Publish events
  async publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.client.publish(
        EXCHANGES.ORDERS,
        ROUTING_KEYS.ORDER_CREATED,
        event
      );
      logger.info(`Published order.created event for order ${event.orderId}`);
    } catch (error) {
      logger.error('Failed to publish order.created event:', error);
    }
  }

  async publishOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    try {
      await this.client.publish(
        EXCHANGES.ORDERS,
        ROUTING_KEYS.ORDER_CANCELLED,
        event
      );
      logger.info(`Published order.cancelled event for order ${event.orderId}`);
    } catch (error) {
      logger.error('Failed to publish order.cancelled event:', error);
    }
  }

  async publishOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    try {
      await this.client.publish(
        EXCHANGES.ORDERS,
        ROUTING_KEYS.ORDER_CONFIRMED,
        event
      );
      logger.info(`Published order.confirmed event for order ${event.orderId}`);
    } catch (error) {
      logger.error('Failed to publish order.confirmed event:', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
