import { FastifyRequest, FastifyReply, z } from '@ecommerce/shared/packages';
import {
  ResponseCodes,
  NotFoundError,
  addErrorHelper,
} from '@ecommerce/shared';
import { InventoryService } from '../services/inventory.service';

const inventoryService = new InventoryService();

const updateInventorySchema = z.object({
  quantity: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().positive().optional(),
});

const reserveStockSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ),
});

export class InventoryController {
  async getByProductId(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { productId } = request.params as { productId: string };
      const inventory = await inventoryService.getByProductId(productId);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Inventory fetched successfully',
        data: { inventory },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'InventoryController.getByProductId',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch inventory',
        data: {},
        error: err.message || 'Failed to fetch inventory',
      });
    }
  }

  async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const inventory = await inventoryService.getAll();

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Inventory fetched successfully',
        data: { inventory },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'InventoryController.getAll',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch inventory',
        data: {},
        error: err.message || 'Failed to fetch inventory',
      });
    }
  }

  async getLowStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const inventory = await inventoryService.getLowStock();

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Low stock items fetched successfully',
        data: { inventory },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'InventoryController.getLowStock',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to fetch low stock items',
        data: {},
        error: err.message || 'Failed to fetch low stock items',
      });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { productId } = request.params as { productId: string };
      const body = updateInventorySchema.parse(request.body);

      const inventory = await inventoryService.update(productId, body);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Inventory updated successfully',
        data: { inventory },
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'InventoryController.update',
        details: err,
      });
      if (err instanceof NotFoundError) {
        throw err;
      }
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to update inventory',
        data: {},
        error: err.message || 'Failed to update inventory',
      });
    }
  }

  async reserveStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = reserveStockSchema.parse(request.body);
      const result = await inventoryService.reserveStock(body.items);

      if (!result.success) {
        return reply.badRequest({
          status: ResponseCodes.BAD_REQUEST,
          message: result.message || 'Failed to reserve stock',
          data: {},
          error: result.message || 'Failed to reserve stock',
        });
      }

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Stock reserved successfully',
        data: result,
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'InventoryController.reserveStock',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to reserve stock',
        data: {},
        error: err.message || 'Failed to reserve stock',
      });
    }
  }

  async releaseStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = reserveStockSchema.parse(request.body);
      const result = await inventoryService.releaseStock(body.items);

      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Stock released successfully',
        data: result,
        error: '',
      });
    } catch (err: any) {
      await addErrorHelper({
        apiName: 'InventoryController.releaseStock',
        details: err,
      });
      return reply.serverError({
        status: ResponseCodes.SERVER_ERROR,
        message: err.message || 'Failed to release stock',
        data: {},
        error: err.message || 'Failed to release stock',
      });
    }
  }
}
