// Event types and routing keys
export const EXCHANGES = {
  ORDERS: 'orders.exchange',
  INVENTORY: 'inventory.exchange',
  NOTIFICATIONS: 'notifications.exchange',
  PRODUCTS: 'products.exchange',
} as const;

export const QUEUES = {
  // RPC Queues
  INVENTORY_RESERVE: 'inventory.reserve.rpc',
  INVENTORY_RELEASE: 'inventory.release.rpc',
  INVENTORY_CONFIRM: 'inventory.confirm.rpc',
  PRODUCT_GET: 'product.get.rpc',
  PRODUCT_LIST: 'product.list.rpc',

  // Event Queues
  ORDER_CREATED: 'order.created.queue',
  ORDER_CANCELLED: 'order.cancelled.queue',
  ORDER_CONFIRMED: 'order.confirmed.queue',
  INVENTORY_LOW_STOCK: 'inventory.low-stock.queue',
  INVENTORY_UPDATED: 'inventory.updated.queue',
  PRODUCT_CREATED: 'product.created.queue',
  PRODUCT_UPDATED: 'product.updated.queue',
  PRODUCT_DELETED: 'product.deleted.queue',
} as const;

export const ROUTING_KEYS = {
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_CONFIRMED: 'order.confirmed',
  INVENTORY_LOW_STOCK: 'inventory.low-stock',
  INVENTORY_UPDATED: 'inventory.updated',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
} as const;

// Event payloads
export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  total: number;
  items: Array<{ productId: string; quantity: number; price: number }>;
  shippingAddress: any;
  createdAt: Date;
}

export interface OrderCancelledEvent {
  orderId: string;
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
  cancelledAt: Date;
}

export interface OrderConfirmedEvent {
  orderId: string;
  userId: string;
  confirmedAt: Date;
}

export interface InventoryLowStockEvent {
  productId: string;
  currentStock: number;
  threshold: number;
  productName?: string;
}

export interface InventoryUpdatedEvent {
  productId: string;
  quantity: number;
  reservedQuantity: number;
  updatedAt: Date;
}

export interface ProductCreatedEvent {
  productId: string;
  name: string;
  sku: string;
  price: number;
  categoryId: string;
}

export interface ProductUpdatedEvent {
  productId: string;
  changes: Partial<{
    name: string;
    price: number;
    description: string;
    isActive: boolean;
  }>;
}

export interface ProductDeletedEvent {
  productId: string;
  deletedAt: Date;
}

// RPC Request/Response types
export interface ReserveStockRequest {
  items: Array<{ productId: string; quantity: number }>;
}

export interface ReserveStockResponse {
  success: boolean;
  message?: string;
  reservations?: Array<{ productId: string; quantity: number }>;
}

export interface ReleaseStockRequest {
  items: Array<{ productId: string; quantity: number }>;
}

export interface ReleaseStockResponse {
  success: boolean;
  message?: string;
}

export interface ConfirmReservationRequest {
  items: Array<{ productId: string; quantity: number }>;
}

export interface ConfirmReservationResponse {
  success: boolean;
  message?: string;
}
