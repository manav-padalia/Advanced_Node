import { NotFoundError, BadRequestError } from '@ecommerce/shared';
import { InventoryRepository } from '../repositories/inventory.repository';

const inventoryRepository = new InventoryRepository();

export class InventoryService {
  async getByProductId(productId: string) {
    const inventory = await inventoryRepository.findByProductId(productId);

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }

    return inventory;
  }

  async getAll() {
    return inventoryRepository.findAll();
  }

  async getLowStock() {
    return inventoryRepository.findLowStock();
  }

  async update(productId: string, data: any) {
    const inventory = await inventoryRepository.update(productId, data);

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }

    return inventory;
  }

  // Helper method to check and emit low stock alert
  async checkAndEmitLowStockAlert(
    productId: string,
    inventory: any,
  ): Promise<void> {
    if (inventory.quantity <= inventory.lowStockThreshold) {
      // This will be called by messaging service
      return;
    }
  }

  async reserveStock(items: Array<{ productId: string; quantity: number }>) {
    const results = [];

    for (const item of items) {
      const result = await inventoryRepository.reserveStock(
        item.productId,
        item.quantity,
      );

      if (!result) {
        // Rollback previous reservations
        for (const reserved of results) {
          await inventoryRepository.releaseStock(
            reserved.productId,
            reserved.quantity,
          );
        }

        return {
          success: false,
          message: `Insufficient stock for product ${item.productId}`,
        };
      }

      results.push(item);
    }

    return { success: true, reservations: results };
  }

  async releaseStock(items: Array<{ productId: string; quantity: number }>) {
    for (const item of items) {
      await inventoryRepository.releaseStock(item.productId, item.quantity);
    }

    return { success: true };
  }

  async confirmReservation(
    items: Array<{ productId: string; quantity: number }>,
  ) {
    for (const item of items) {
      await inventoryRepository.confirmReservation(
        item.productId,
        item.quantity,
      );
    }

    return { success: true };
  }
}
