# RabbitMQ Migration Guide

## Overview

This project uses RabbitMQ as the primary inter-service communication layer, replacing direct HTTP calls between services. This document explains the migration rationale, what changed, and how to work with the new architecture.

## Why RabbitMQ?

| Concern          | HTTP (before)                            | RabbitMQ (now)                               |
| ---------------- | ---------------------------------------- | -------------------------------------------- |
| Coupling         | Services must be up simultaneously       | Services can be offline temporarily          |
| Retries          | Manual retry logic needed                | Built-in message persistence + retries       |
| Load balancing   | External load balancer needed            | Multiple consumers share queue automatically |
| Scalability      | Each service needs its own HTTP endpoint | Add consumers without changing producers     |
| Failure handling | Cascading failures                       | Messages queued until service recovers       |

## What Changed

### Before (HTTP)

```
API Gateway ──HTTP──► Product Service
API Gateway ──HTTP──► Inventory Service
Order Service ──HTTP──► Inventory Service
Order Service ──HTTP──► Notification Service
```

### After (RabbitMQ)

```
API Gateway ──RPC──► RabbitMQ ──► Product Service
API Gateway ──RPC──► RabbitMQ ──► Inventory Service
Order Service ──Event──► RabbitMQ ──► Inventory Service
Order Service ──Event──► RabbitMQ ──► Notification Service
```

Note: Order Service still uses HTTP proxy for some operations (via ProxyService).

## Two Communication Patterns

### 1. RPC (Request-Reply)

Used when the caller needs a response. Implemented in `src/shared/messaging/rabbitmq.client.ts`.

```typescript
// Sending an RPC request
const result = await messagingService.getProducts({ page: 1, limit: 20 });

// Under the hood:
// 1. Creates exclusive reply queue
// 2. Publishes to product.list.rpc with correlationId
// 3. Waits for response on reply queue (30s timeout)
// 4. Returns parsed response
```

### 2. Events (Publish-Subscribe)

Used for notifications after state changes. No response expected.

```typescript
// Publishing an event
await messagingService.publishOrderCreated({
  orderId: '...',
  userId: '...',
  total: 99.99,
  items: [...],
});

// Consumers (Notification, Inventory) receive this independently
```

## Adding a New RPC Endpoint

1. Add queue name to `src/shared/messaging/events.ts`:

```typescript
export const QUEUES = {
  // ...existing
  MY_NEW_RPC: 'my.new.rpc',
};
```

2. Add consumer in the target service's messaging service:

```typescript
await this.client.consumeRPC(QUEUES.MY_NEW_RPC, async (payload) => {
  // handle request, return response
  return { success: true, data: result };
});
```

3. Add caller method in the API Gateway's messaging service:

```typescript
async myNewCall(params: any) {
  return this.client.callRPC(QUEUES.MY_NEW_RPC, params);
}
```

## Adding a New Event

1. Add routing key and queue to `src/shared/messaging/events.ts`
2. Add TypeScript interface for the payload
3. Publish from the source service
4. Consume in the target service

## Local Development

```bash
# Start RabbitMQ
docker-compose up -d rabbitmq

# Management UI
open http://localhost:15672
# Login: admin / admin123

# Test messaging
npm run rabbitmq:test

# View queue stats
curl -u admin:admin123 http://localhost:15672/api/queues
```

## Monitoring

In the RabbitMQ Management UI you can:

- See message rates per queue
- Check consumer counts
- Inspect dead-letter queues for failed messages
- Manually publish test messages

## Dead Letter Queues

Failed messages (after 3 retries) are routed to dead-letter queues:

- `order.created.dlq`
- `inventory.low-stock.dlq`
- etc.

Check these queues if events seem to be missing.
