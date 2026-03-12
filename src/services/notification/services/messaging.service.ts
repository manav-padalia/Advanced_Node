import {
  getRabbitMQClient,
  QUEUES,
  EXCHANGES,
  ROUTING_KEYS,
  OrderCreatedEvent,
  OrderCancelledEvent,
  OrderConfirmedEvent,
  InventoryLowStockEvent,
} from '@ecommerce/shared';
import { createServiceLogger } from '@ecommerce/shared';
import { EmailService } from './email.service';
import { SocketService } from './socket.service';

const logger = createServiceLogger('notification-messaging-service');
const emailService = new EmailService();

export class MessagingService {
  private client = getRabbitMQClient();

  async initialize(): Promise<void> {
    await this.client.connect();

    // Setup queues and bindings
    await this.setupQueues();

    // Start consuming events
    await this.startConsumers();

    logger.info('Notification messaging service initialized');
  }

  private async setupQueues(): Promise<void> {
    // Assert exchanges
    await this.client.assertExchange(EXCHANGES.ORDERS, 'topic');
    await this.client.assertExchange(EXCHANGES.INVENTORY, 'topic');

    // Assert queues
    await this.client.assertQueue(QUEUES.ORDER_CREATED);
    await this.client.assertQueue(QUEUES.ORDER_CANCELLED);
    await this.client.assertQueue(QUEUES.ORDER_CONFIRMED);
    await this.client.assertQueue(QUEUES.INVENTORY_LOW_STOCK);

    // Bind queues to exchanges
    await this.client.bindQueue(
      QUEUES.ORDER_CREATED,
      EXCHANGES.ORDERS,
      ROUTING_KEYS.ORDER_CREATED,
    );
    await this.client.bindQueue(
      QUEUES.ORDER_CANCELLED,
      EXCHANGES.ORDERS,
      ROUTING_KEYS.ORDER_CANCELLED,
    );
    await this.client.bindQueue(
      QUEUES.ORDER_CONFIRMED,
      EXCHANGES.ORDERS,
      ROUTING_KEYS.ORDER_CONFIRMED,
    );
    await this.client.bindQueue(
      QUEUES.INVENTORY_LOW_STOCK,
      EXCHANGES.INVENTORY,
      ROUTING_KEYS.INVENTORY_LOW_STOCK,
    );

    logger.info('Notification queues and bindings setup complete');
  }

  private async startConsumers(): Promise<void> {
    // Order created consumer
    await this.client.consume(
      QUEUES.ORDER_CREATED,
      async (event: OrderCreatedEvent) => {
        logger.info(
          `Processing order.created event for order ${event.orderId}`,
        );
        try {
          await emailService.sendOrderConfirmation(event);
          logger.info(
            `Order confirmation email sent for order ${event.orderId}`,
          );
        } catch (error) {
          logger.error('Error sending order confirmation email:', error);
          throw error;
        }
      },
    );

    // Order cancelled consumer
    await this.client.consume(
      QUEUES.ORDER_CANCELLED,
      async (event: OrderCancelledEvent) => {
        logger.info(
          `Processing order.cancelled event for order ${event.orderId}`,
        );
        try {
          await emailService.sendOrderCancellation(event);
          logger.info(
            `Order cancellation email sent for order ${event.orderId}`,
          );
        } catch (error) {
          logger.error('Error sending order cancellation email:', error);
          throw error;
        }
      },
    );

    // Order confirmed consumer
    await this.client.consume(
      QUEUES.ORDER_CONFIRMED,
      async (event: OrderConfirmedEvent) => {
        logger.info(
          `Processing order.confirmed event for order ${event.orderId}`,
        );
        try {
          // Additional confirmation logic if needed
          logger.info(
            `Order confirmed notification processed for order ${event.orderId}`,
          );
        } catch (error) {
          logger.error('Error processing order confirmed event:', error);
          throw error;
        }
      },
    );

    // Low stock alert consumer
    await this.client.consume(
      QUEUES.INVENTORY_LOW_STOCK,
      async (event: InventoryLowStockEvent) => {
        logger.info(
          `Processing low stock alert for product ${event.productId}`,
        );
        try {
          await emailService.sendLowStockAlert(event);

          // Emit real-time notification via Socket.IO
          const socketService = SocketService.getInstance();
          socketService.emitToAdmins('low-stock-alert', event);

          logger.info(`Low stock alert sent for product ${event.productId}`);
        } catch (error) {
          logger.error('Error sending low stock alert:', error);
          throw error;
        }
      },
    );

    logger.info('Notification consumers started');
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
