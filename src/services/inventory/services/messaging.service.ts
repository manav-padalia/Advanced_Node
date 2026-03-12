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
  InventoryLowStockEvent,
  InventoryUpdatedEvent,
} from '@ecommerce/shared';
import { createServiceLogger } from '@ecommerce/shared';
import { InventoryService } from './inventory.service';

const logger = createServiceLogger('inventory-messaging-service');
const inventoryService = new InventoryService();

export class MessagingService {
  private client = getRabbitMQClient();

  async initialize(): Promise<void> {
    await this.client.connect();

    // Setup exchanges
    await this.client.assertExchange(EXCHANGES.INVENTORY, 'topic');

    // Setup RPC servers
    await this.setupRPCServers();

    logger.info('Inventory messaging service initialized');
  }

  private async setupRPCServers(): Promise<void> {
    // Reserve stock RPC
    await this.client.setupRPCServer(
      QUEUES.INVENTORY_RESERVE,
      async (request: ReserveStockRequest): Promise<ReserveStockResponse> => {
        try {
          logger.info('Processing reserve stock request', request);
          const result = await inventoryService.reserveStock(request.items);
          return result;
        } catch (error: any) {
          logger.error('Error reserving stock:', error);
          return { success: false, message: error.message };
        }
      },
    );

    // Release stock RPC
    await this.client.setupRPCServer(
      QUEUES.INVENTORY_RELEASE,
      async (request: ReleaseStockRequest): Promise<ReleaseStockResponse> => {
        try {
          logger.info('Processing release stock request', request);
          const result = await inventoryService.releaseStock(request.items);
          return result;
        } catch (error: any) {
          logger.error('Error releasing stock:', error);
          return { success: false, message: error.message };
        }
      },
    );

    // Confirm reservation RPC
    await this.client.setupRPCServer(
      QUEUES.INVENTORY_CONFIRM,
      async (
        request: ConfirmReservationRequest,
      ): Promise<ConfirmReservationResponse> => {
        try {
          logger.info('Processing confirm reservation request', request);
          const result = await inventoryService.confirmReservation(
            request.items,
          );
          return result;
        } catch (error: any) {
          logger.error('Error confirming reservation:', error);
          return { success: false, message: error.message };
        }
      },
    );

    logger.info('Inventory RPC servers ready');
  }

  // Publish events
  async publishLowStockAlert(event: InventoryLowStockEvent): Promise<void> {
    try {
      await this.client.publish(
        EXCHANGES.INVENTORY,
        ROUTING_KEYS.INVENTORY_LOW_STOCK,
        event,
      );
      logger.info(`Published low stock alert for product ${event.productId}`);
    } catch (error) {
      logger.error('Failed to publish low stock alert:', error);
    }
  }

  async publishInventoryUpdated(event: InventoryUpdatedEvent): Promise<void> {
    try {
      await this.client.publish(
        EXCHANGES.INVENTORY,
        ROUTING_KEYS.INVENTORY_UPDATED,
        event,
      );
      logger.info(
        `Published inventory updated event for product ${event.productId}`,
      );
    } catch (error) {
      logger.error('Failed to publish inventory updated event:', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
