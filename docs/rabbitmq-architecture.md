# RabbitMQ Architecture

## Overview

All inter-service communication uses RabbitMQ with two patterns:

- **RPC** — synchronous-like request/reply (API Gateway ↔ Product/Inventory)
- **Events** — async publish/subscribe (Order → Notification/Inventory)

## Exchanges and Queues

```
EXCHANGES
├── orders.exchange       (topic)
├── inventory.exchange    (topic)
├── notifications.exchange (topic)
└── products.exchange     (topic)

RPC QUEUES (request-reply)
├── product.get.rpc
├── product.list.rpc
├── inventory.reserve.rpc
├── inventory.release.rpc
└── inventory.confirm.rpc

EVENT QUEUES (fire-and-forget)
├── order.created.queue
├── order.cancelled.queue
├── order.confirmed.queue
├── inventory.low-stock.queue
├── inventory.updated.queue
├── product.created.queue
├── product.updated.queue
└── product.deleted.queue
```

## RPC Pattern Detail

Used when the API Gateway needs a response from a downstream service.

```
1. API Gateway creates a reply queue (exclusive, auto-delete)
2. Publishes message with:
   - routingKey: target queue name
   - replyTo: reply queue name
   - correlationId: unique request ID
3. Downstream service processes and publishes response to replyTo queue
4. API Gateway matches correlationId and resolves the promise
5. Timeout: 30 seconds
```

Example — Get Products:

```
API Gateway ──[product.list.rpc]──► Product Catalog
            ◄─[reply queue]──────── Product Catalog
```

## Event Pattern Detail

Used for async notifications after state changes.

```
1. Publishing service emits event to exchange with routing key
2. Exchange fans out to all bound queues
3. Consuming services process independently
4. Messages are durable (survive broker restart)
5. Failed messages go to dead-letter queue after 3 retries
```

Example — Order Created:

```
Order Service ──[order.created]──► orders.exchange
                                        │
                              ┌─────────┴──────────┐
                              ▼                    ▼
                    order.created.queue    inventory.reserve.rpc
                              │
                    Notification Service
                    (sends confirmation email)
```

## Message Payload Examples

### order.created event

```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "total": 99.99,
  "items": [{ "productId": "uuid", "quantity": 2, "price": 49.99 }],
  "shippingAddress": { "street": "...", "city": "...", "country": "..." },
  "createdAt": "2026-03-16T10:00:00Z"
}
```

### inventory.reserve.rpc request

```json
{
  "items": [{ "productId": "uuid", "quantity": 2 }]
}
```

### inventory.reserve.rpc response

```json
{
  "success": true,
  "reservations": [{ "productId": "uuid", "quantity": 2 }]
}
```

## Connection Management

- Connections are established at service startup
- Automatic reconnection on disconnect (exponential backoff)
- Channels are created per operation to avoid blocking
- Prefetch count: 1 (fair dispatch)

## Local Testing

```bash
# Start RabbitMQ
docker-compose up -d rabbitmq

# Open management UI
open http://localhost:15672
# Login: admin / admin123

# Test connectivity
npm run rabbitmq:test
```
