import { validateEnv } from '@ecommerce/shared';

export const config = validateEnv();

export const services = {
  productCatalog: {
    name: `${process.env.CONSUL_SERVICE_PREFIX || 'ecommerce'}-product-catalog`,
    url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001',
  },
  order: {
    name: `${process.env.CONSUL_SERVICE_PREFIX || 'ecommerce'}-order`,
    url: process.env.ORDER_SERVICE_URL || 'http://localhost:3002',
  },
  inventory: {
    name: `${process.env.CONSUL_SERVICE_PREFIX || 'ecommerce'}-inventory`,
    url: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
  },
  notification: {
    name: `${process.env.CONSUL_SERVICE_PREFIX || 'ecommerce'}-notification`,
    url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
  },
};
