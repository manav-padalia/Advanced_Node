# System Architecture

## Microservices Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT / BROWSER                           │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY  :3000                           │
│  • JWT Authentication       • Rate Limiting (100 req/15min)         │
│  • RBAC Middleware          • Swagger UI (/docs)                    │
│  • CORS / Helmet            • Request Validation (Zod)              │
│  • Response Compression     • Error Handling + Sentry               │
└──────┬──────────────┬───────────────┬───────────────────────────────┘
       │ RabbitMQ RPC │               │ HTTP Proxy
       ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│   PRODUCT    │ │  INVENTORY   │ │   ORDER SERVICE  │
│   CATALOG    │ │   SERVICE    │ │      :3002       │
│    :3001     │ │    :3003     │ │                  │
│              │ │              │ │  • Order CRUD    │
│ • Products   │ │ • Stock Mgmt │ │  • Stripe Pay    │
│ • Categories │ │ • Reservations││  • Status Flow   │
│ • Redis Cache│ │ • Low Stock  │ │                  │
└──────┬───────┘ └──────┬───────┘ └────────┬─────────┘
       │                │                  │
       └────────────────┴──────────────────┘
                        │ RabbitMQ Events
                        ▼
              ┌─────────────────────┐
              │  NOTIFICATION SVC   │
              │       :3004         │
              │                     │
              │  • Email (SMTP)     │
              │  • Socket.IO RT     │
              │  • BullMQ Workers   │
              │  • Alert Jobs       │
              └─────────────────────┘
```

## Infrastructure

```
┌──────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE                       │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │ PostgreSQL  │  │    Redis    │  │    RabbitMQ     │   │
│  │   :5432     │  │    :6379    │  │  :5672 / :15672 │   │
│  │             │  │             │  │                 │   │
│  │ Primary DB  │  │ Cache +     │  │ Message Broker  │   │
│  │ Prisma ORM  │  │ BullMQ Jobs │  │ RPC + Events    │   │
│  └─────────────┘  └─────────────┘  └─────────────────┘   │
│                                                          │
│  ┌─────────────┐                                         │
│  │   Consul    │                                         │
│  │    :8500    │                                         │
│  │             │                                         │
│  │  Service    │                                         │
│  │  Discovery  │                                         │
│  └─────────────┘                                         │
└──────────────────────────────────────────────────────────┘
```

## Service Communication Flow

### RPC Pattern (Synchronous-like via RabbitMQ)

```
API Gateway                RabbitMQ              Product/Inventory Service
    │                          │                          │
    │──── RPC Request ────────►│                          │
    │     (correlationId)      │──── Deliver to Queue ───►│
    │                          │                          │── Process ──┐
    │                          │                          │◄────────────┘
    │◄─── RPC Response ────────│◄─── Reply to Queue ──────│
    │     (correlationId)      │                          │
```

Timeout: 30 seconds (10s for most calls, 30s for order creation).
On failure the gateway retries once after a 1-second delay before surfacing an error.

#### Full RPC Queue Map

| Queue                   | Direction                 | Purpose                        |
| ----------------------- | ------------------------- | ------------------------------ |
| `product.list.rpc`      | Gateway → Product Catalog | Paginated product list         |
| `product.get.rpc`       | Gateway → Product Catalog | Single product by ID           |
| `product.create.rpc`    | Gateway → Product Catalog | Create product (Admin)         |
| `product.update.rpc`    | Gateway → Product Catalog | Update product (Admin)         |
| `product.delete.rpc`    | Gateway → Product Catalog | Delete product (Admin)         |
| `category.list.rpc`     | Gateway → Product Catalog | List all categories            |
| `category.get.rpc`      | Gateway → Product Catalog | Single category by ID          |
| `category.create.rpc`   | Gateway → Product Catalog | Create category (Admin)        |
| `category.update.rpc`   | Gateway → Product Catalog | Update category (Admin)        |
| `category.delete.rpc`   | Gateway → Product Catalog | Delete category (Admin)        |
| `order.list.rpc`        | Gateway → Order Service   | List user orders               |
| `order.get.rpc`         | Gateway → Order Service   | Single order by ID             |
| `order.create.rpc`      | Gateway → Order Service   | Create order                   |
| `order.cancel.rpc`      | Gateway → Order Service   | Cancel order                   |
| `inventory.reserve.rpc` | Order → Inventory         | Reserve stock for order        |
| `inventory.release.rpc` | Order → Inventory         | Release reserved stock         |
| `inventory.confirm.rpc` | Order → Inventory         | Confirm reservation on payment |
| `inventory.get.rpc`     | Gateway → Inventory       | Get stock level                |
| `inventory.update.rpc`  | Gateway → Inventory       | Update stock (Admin)           |

### Event Pattern (Async via RabbitMQ)

```
Order Service              RabbitMQ Exchange         Notification Service
    │                          │                          │
    │──── Publish Event ──────►│                          │
    │     order.created        │──── Fan-out ────────────►│
    │                          │                          │── Send Email
    │                          │──── Fan-out ────────────►│
    │                          │                     Inventory Service
    │                          │                          │── Release Stock
```

#### Full Event Queue Map

| Queue                       | Routing Key           | Publisher         | Consumers                                 |
| --------------------------- | --------------------- | ----------------- | ----------------------------------------- |
| `order.created.queue`       | `order.created`       | Order Service     | Notification (email), Inventory (reserve) |
| `order.cancelled.queue`     | `order.cancelled`     | Order Service     | Notification, Inventory (release)         |
| `order.confirmed.queue`     | `order.confirmed`     | Order Service     | Notification                              |
| `inventory.low-stock.queue` | `inventory.low-stock` | Inventory Service | Notification (alert email)                |
| `inventory.updated.queue`   | `inventory.updated`   | Inventory Service | Product Catalog (cache invalidation)      |
| `product.created.queue`     | `product.created`     | Product Catalog   | Inventory (create stock record)           |
| `product.updated.queue`     | `product.updated`     | Product Catalog   | Inventory, Notification                   |
| `product.deleted.queue`     | `product.deleted`     | Product Catalog   | Inventory (cleanup)                       |

All queues are durable. Failed messages are retried up to 3 times then routed to a dead-letter queue.

## Database Schema (ERD)

```
┌──────────────────┐       ┌──────────────────────┐
│      users       │       │   refresh_tokens     │
│──────────────────│       │──────────────────────│
│ id (PK, UUID)    │──────►│ id (PK, UUID)        │
│ email (unique)   │       │ token (unique)       │
│ password_hash    │       │ user_id (FK)         │
│ first_name       │       │ expires_at           │
│ last_name        │       │ created_at           │
│ role             │       └──────────────────────┘
│  USER|ADMIN|GUEST│
│ provider         │       ┌──────────────────────┐
│  LOCAL|GOOGLE    │       │       orders         │
│ provider_id      │──────►│──────────────────────│
│ is_active        │       │ id (PK, UUID)        │
│ email_verified   │       │ order_number (unique)│
│ created_at       │       │ user_id (FK)         │
│ updated_at       │       │ status               │
└──────────────────┘       │  PENDING|CONFIRMED   │
                           │  PROCESSING|SHIPPED  │
┌──────────────────┐       │  DELIVERED|CANCELLED │
│    categories    │       │  |REFUNDED           │
│──────────────────│       │ payment_status       │
│ id (PK, UUID)    │       │  PENDING|COMPLETED   │
│ name (unique)    │       │  |FAILED|REFUNDED    │
│ slug (unique)    │       │ subtotal (Decimal)   │
│ description      │       │ tax (Decimal)        │
│ parent_id (FK)   │◄──┐   │ total (Decimal)      │
│ is_active        │   │   │ shipping_address(JSON│
│ created_at       │   │   │ created_at           │
│ updated_at       │   │   │ updated_at           │
└────────┬─────────┘   │   └──────────┬───────────┘
         │             │              │
         │             │   ┌──────────▼───────────┐
┌────────▼─────────┐   │   │     order_items      │
│     products     │   │   │──────────────────────│
│──────────────────│   │   │ id (PK, UUID)        │
│ id (PK, UUID)    │   │   │ order_id (FK)        │
│ sku (unique)     │   │   │ product_id (FK)      │
│ name             │   │   │ quantity             │
│ slug (unique)    │   │   │ price (Decimal)      │
│ description      │   │   │ subtotal (Decimal)   │
│ price (Decimal)  │   │   │ created_at           │
│ category_id (FK) │───┘   └──────────────────────┘
│ image_url        │
│ is_active        │       ┌──────────────────────┐
│ created_at       │       │      payments        │
│ updated_at       │       │──────────────────────│
└────────┬─────────┘       │ id (PK, UUID)        │
         │                 │ order_id (FK, unique)│◄──── 1:1 with orders
┌────────▼─────────┐       │ amount (Decimal)     │
│    inventory     │       │ payment_method       │
│──────────────────│       │ transaction_id(unique│
│ id (PK, UUID)    │       │ status               │
│ product_id(unique│       │  PENDING|COMPLETED   │
│ quantity         │       │  |FAILED|REFUNDED    │
│ reserved_quantity│       │ metadata (JSON)      │
│ low_stock_thresh │       │ created_at           │
│ updated_at       │       │ updated_at           │
└──────────────────┘       └──────────────────────┘

                           ┌──────────────────────┐
                           │       errors         │
                           │──────────────────────│
                           │ id (PK, UUID)        │
                           │ api_name             │
                           │ err_message (Text)   │
                           │ details (JSON)       │
                           │ created_at           │
                           └──────────────────────┘
```

### Key Schema Notes

- All primary keys are UUIDs (`@default(uuid())`)
- All monetary values use `Decimal(10,2)` — never floats
- `categories` is self-referential via `parent_id` for nested hierarchies
- `inventory` is 1:1 with `products` (cascades on product delete)
- `payments` is 1:1 with `orders` (cascades on order delete)
- `order_items.price` is a snapshot of the product price at time of order
- Soft deletes via `is_active` on `users`, `products`, `categories`
- Indexes on all foreign keys, `email`, `slug`, `status`, `order_number`, `created_at`

## API Gateway Routing Logic

The API Gateway is the sole public entry point. All client traffic hits port 3000 and is processed through a layered pipeline before reaching a downstream service.

### Request Pipeline

```
Incoming Request
       │
       ▼
┌─────────────────────┐
│  @fastify/helmet    │  Security headers (CSP, HSTS, X-Frame-Options…)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  @fastify/cors      │  Origin whitelist from CORS_ORIGIN env var
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ @fastify/rate-limit │  100 req / 15 min — keyed by userId (auth'd)
│                     │  or IP address (anonymous)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Zod body/query     │  Schema validation — rejects before business logic
│  validation         │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  authMiddleware     │  Verifies Bearer JWT, attaches user to request
│  (preHandler)       │  — only on protected routes
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  requireAdmin RBAC  │  Role check — only on admin routes
│  (preHandler)       │
└──────────┬──────────┘
           ▼
    Route Handler
    ┌──────────────────────────────────────┐
    │  RabbitMQ RPC  │  HTTP Proxy (Axios) │
    │  (products,    │  (orders via        │
    │   categories)  │   ProxyService)     │
    └──────────────────────────────────────┘
```

### Route Table

| Method   | Path                       | Auth   | Role  | Transport    | Target                             |
| -------- | -------------------------- | ------ | ----- | ------------ | ---------------------------------- |
| `GET`    | `/health`                  | —      | —     | Local        | Gateway health check               |
| `GET`    | `/ready`                   | —      | —     | Local        | Readiness probe                    |
| `GET`    | `/metrics`                 | —      | —     | Local        | Prometheus metrics                 |
| `GET`    | `/docs`                    | —      | —     | Local        | Swagger UI                         |
| `POST`   | `/v1/auth/register`        | —      | —     | Local (DB)   | Create user + issue tokens         |
| `POST`   | `/v1/auth/login`           | —      | —     | Local (DB)   | Verify credentials + issue tokens  |
| `POST`   | `/v1/auth/refresh`         | —      | —     | Local (DB)   | Rotate access token                |
| `GET`    | `/v1/auth/google`          | —      | —     | Redirect     | Google OAuth2 flow                 |
| `GET`    | `/v1/auth/google/callback` | —      | —     | Local (DB)   | OAuth2 callback, upsert user       |
| `GET`    | `/v1/products`             | —      | —     | RabbitMQ RPC | `product.list.rpc`                 |
| `GET`    | `/v1/products/:id`         | —      | —     | RabbitMQ RPC | `product.get.rpc`                  |
| `POST`   | `/v1/products`             | ✅ JWT | ADMIN | RabbitMQ RPC | `product.create.rpc`               |
| `PUT`    | `/v1/products/:id`         | ✅ JWT | ADMIN | RabbitMQ RPC | `product.update.rpc`               |
| `DELETE` | `/v1/products/:id`         | ✅ JWT | ADMIN | RabbitMQ RPC | `product.delete.rpc`               |
| `GET`    | `/v1/categories`           | —      | —     | RabbitMQ RPC | `category.list.rpc`                |
| `GET`    | `/v1/categories/:id`       | —      | —     | RabbitMQ RPC | `category.get.rpc`                 |
| `POST`   | `/v1/categories`           | ✅ JWT | ADMIN | RabbitMQ RPC | `category.create.rpc`              |
| `PUT`    | `/v1/categories/:id`       | ✅ JWT | ADMIN | RabbitMQ RPC | `category.update.rpc`              |
| `DELETE` | `/v1/categories/:id`       | ✅ JWT | ADMIN | RabbitMQ RPC | `category.delete.rpc`              |
| `GET`    | `/v1/orders`               | ✅ JWT | USER  | HTTP Proxy   | Order Service `/orders`            |
| `GET`    | `/v1/orders/:id`           | ✅ JWT | USER  | HTTP Proxy   | Order Service `/orders/:id`        |
| `POST`   | `/v1/orders`               | ✅ JWT | USER  | HTTP Proxy   | Order Service `/orders`            |
| `PUT`    | `/v1/orders/:id/cancel`    | ✅ JWT | USER  | HTTP Proxy   | Order Service `/orders/:id/cancel` |

### Transport Strategy

The gateway uses two transport mechanisms depending on the route group:

**RabbitMQ RPC** (products & categories) — `MessagingService`

- Sends a message to the named queue with a `correlationId`
- Waits for a reply on an exclusive auto-delete queue
- Retries once after 1 second on transient failure
- Timeout: 10 seconds (30 seconds for order creation)

**HTTP Proxy** (orders) — `ProxyService`

- Resolves the target URL via Consul service discovery (5-second TTL cache)
- Falls back to `ORDER_SERVICE_URL` env var if Consul is unavailable
- Performs random load balancing across discovered instances
- Forwards the authenticated `userId` from the JWT payload to the downstream service

### Auth Flow Detail

```
POST /v1/auth/login
  │
  ├─ Validate body (Zod)
  ├─ Lookup user by email (Prisma → PostgreSQL)
  ├─ Verify password (Argon2)
  ├─ Generate accessToken  (JWT, 15m, HS256)
  ├─ Generate refreshToken (JWT, 7d, HS256)
  ├─ Purge expired refresh tokens for user
  ├─ Store new refreshToken in DB
  └─ Return { user, accessToken, refreshToken }

POST /v1/auth/refresh
  │
  ├─ Verify refreshToken signature
  ├─ Lookup token in DB (checks expiry)
  ├─ Confirm user is still active
  └─ Return { accessToken }  (refresh token is NOT rotated)
```

---

## Technology Stack

| Layer             | Technology           | Purpose                                |
| ----------------- | -------------------- | -------------------------------------- |
| Runtime           | Node.js 20+          | JavaScript runtime                     |
| Language          | TypeScript 5.x       | Type safety                            |
| Compiler          | tsc + tsc-alias      | Build to `dist/`, resolve path aliases |
| Dev Runner        | tsx watch            | Hot-reload without compilation step    |
| Framework         | Fastify 4.x          | HTTP server                            |
| Database          | PostgreSQL 16        | Primary data store                     |
| ORM               | Prisma 5.x           | Database access + migrations           |
| Cache             | Redis 7              | Response caching, BullMQ backend       |
| Message Broker    | RabbitMQ 3 (AMQP)    | Inter-service communication            |
| Job Queue         | BullMQ               | Background job processing              |
| Real-time         | Socket.IO            | WebSocket connections                  |
| Auth              | JWT (jsonwebtoken)   | Access + refresh token issuance        |
| OAuth2            | Passport.js (Google) | Social login                           |
| Password Hashing  | Argon2id             | Memory-hard, GPU-resistant hashing     |
| HTTP Client       | Axios                | Service-to-service HTTP proxy          |
| Payments          | Stripe               | Payment processing                     |
| Email             | Nodemailer           | Transactional email (SMTP)             |
| Validation        | Zod                  | Schema validation (env + requests)     |
| Logging           | Pino                 | Structured JSON logging                |
| Metrics           | prom-client          | Prometheus metrics endpoint            |
| Error Tracking    | Sentry               | Production error monitoring            |
| Service Discovery | Consul               | Service registry + health checks       |
| API Docs          | Swagger/OpenAPI      | Auto-generated from route schemas      |
| Containerization  | Docker               | Multi-stage image build                |
| CI/CD             | GitHub Actions       | Test + build pipeline                  |
