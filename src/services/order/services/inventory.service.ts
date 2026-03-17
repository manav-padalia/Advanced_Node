import { axios } from '@ecommerce/shared/packages';

const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';

export class InventoryService {
  async reserveStock(items: Array<{ productId: string; quantity: number }>) {
    try {
      const response = await axios.post(
        `${INVENTORY_SERVICE_URL}/inventory/reserve`,
        {
          items,
        }
      );
      return response.data;
    } catch (error) {
      return { success: false };
    }
  }

  async releaseStock(items: Array<{ productId: string; quantity: number }>) {
    try {
      await axios.post(`${INVENTORY_SERVICE_URL}/inventory/release`, {
        items,
      });
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }
}
