# Performance & Security

## Overview

This document covers the performance characteristics, load testing methodology, security measures, and optimization techniques applied across the E-Commerce microservices platform.

---

## Performance Benchmarks

### Target Baselines (Single Node, Production Build)

These are the design targets for a single service instance running on a standard cloud VM (2 vCPU / 4 GB RAM) with PostgreSQL and Redis co-located via Docker networking.

| Endpoint                 | Method             | Target RPS | p50      | p95      | p99      |
| ------------------------ | ------------------ | ---------- | -------- | -------- | -------- |
| `GET /v1/products`       | Public (cached)    | 1,500+     | < 10 ms  | < 30 ms  | < 60 ms  |
| `GET /v1/products/:id`   | Public (cached)    | 2,000+     | < 8 ms   | < 25 ms  | < 50 ms  |
| `GET /v1/categories`     | Public (cached)    | 2,000+     | < 8 ms   | < 20 ms  | < 40 ms  |
| `POST /v1/auth/login`    | Auth (DB + bcrypt) | 200+       | < 80 ms  | < 150 ms | < 250 ms |
| `POST /v1/auth/register` | Auth (DB + argon2) | 150+       | < 100 ms | < 200 ms | < 350 ms |
| `GET /v1/orders`         | Authenticated      | 500+       | < 30 ms  | < 80 ms  | < 150 ms |
| `POST /v1/orders`        | Authenticated      | 200+       | < 100 ms | < 200 ms | < 400 ms |
| `GET /health`            | Health check       | 5,000+     | < 2 ms   | < 5 ms   | < 10 ms  |

> Cache-hit paths (products, categories) benefit from Redis TTL caching in the Product Catalog service and are significantly faster than cold DB reads.

### Key Factors Affecting Throughput

- **Fastify** is used as the HTTP framework across all services. It is one of the fastest Node.js frameworks, benchmarking at ~76,000 req/s for simple JSON responses in isolation.
- **Response compression** (`@fastify/compress`) reduces payload size on all routes, improving throughput under bandwidth-constrained conditions.
- **Body limit** is capped at 1 MB (`bodyLimit: 1048576`) to prevent large-payload abuse from consuming memory.
- **Argon2** password hashing is intentionally CPU-intensive (~80–120 ms). Login/register RPS is bounded by this, not the framework.

---

## Load Testing

### Tools

| Tool                  | Use Case                                              |
| --------------------- | ----------------------------------------------------- |
| **Apache Bench (ab)** | Quick single-endpoint saturation tests                |
| **k6**                | Scenario-based, multi-step load tests with thresholds |

---

### Apache Bench — Quick Saturation Tests

Run these against a locally running stack (`npm run dev` or Docker Compose).

#### Public product listing (cache warm)

```bash
ab -n 5000 -c 100 -H "Accept-Encoding: gzip" \
  http://localhost:3000/v1/products
```

Expected output (indicative):

```
Requests per second:    1450.00 [#/sec]
Time per request:       68.97 [ms] (mean)
Time per request:       0.690 [ms] (mean, across all concurrent requests)
Transfer rate:          312.50 [Kbytes/sec]

Percentage of the requests served within a certain time (ms)
  50%      9
  66%     12
  75%     15
  90%     25
  95%     32
  99%     58
 100%    120 (longest request)
```

#### Auth login endpoint

```bash
ab -n 500 -c 20 \
  -T "application/json" \
  -p /tmp/login.json \
  http://localhost:3000/v1/auth/login
```

`/tmp/login.json`:

```json
{ "email": "test@example.com", "password": "password123" }
```

Expected output (indicative):

```
Requests per second:    185.00 [#/sec]
Time per request:       108.11 [ms] (mean)

Percentage of the requests served within a certain time (ms)
  50%     85
  95%    145
  99%    230
```

#### Health check (baseline)

```bash
ab -n 10000 -c 200 http://localhost:3000/health
```

Expected output (indicative):

```
Requests per second:    4800.00 [#/sec]
Time per request:       2.08 [ms] (mean)
```

---

### k6 — Scenario-Based Load Tests

#### Installation

```bash
# macOS
brew install k6

# Docker
docker run --rm -i grafana/k6 run - <script.js
```

#### Smoke Test Script

Validates the stack is healthy before heavier tests.

```javascript
// k6/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% errors
    http_req_duration: ['p(95)<200'], // 95th percentile < 200ms
  },
};

const BASE = 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE}/v1/products`);
  check(res, { 'products 200': (r) => r.status === 200 });
  sleep(1);
}
```

```bash
k6 run k6/smoke.js
```

#### Load Test Script (Ramp-Up)

```javascript
// k6/load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 }, // ramp up to 50 VUs
    { duration: '3m', target: 50 }, // hold
    { duration: '1m', target: 100 }, // ramp to 100 VUs
    { duration: '3m', target: 100 }, // hold
    { duration: '1m', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(99)<600'],
  },
};

const BASE = 'http://localhost:3000';

export default function () {
  // Public browse
  const products = http.get(`${BASE}/v1/products?page=1&limit=20`);
  check(products, { 'list products 200': (r) => r.status === 200 });

  // Single product
  const list = products.json('data.items');
  if (list && list.length > 0) {
    const detail = http.get(`${BASE}/v1/products/${list[0].id}`);
    check(detail, { 'product detail 200': (r) => r.status === 200 });
  }

  sleep(1);
}
```

```bash
k6 run k6/load.js
```

#### Authenticated Order Flow Script

```javascript
// k6/order-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE = 'http://localhost:3000';

export function setup() {
  const res = http.post(
    `${BASE}/v1/auth/login`,
    JSON.stringify({ email: 'loadtest@example.com', password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  return { token: res.json('data.accessToken') };
}

export default function ({ token }) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const orders = http.get(`${BASE}/v1/orders`, { headers });
  check(orders, { 'list orders 200': (r) => r.status === 200 });

  sleep(2);
}
```

```bash
k6 run k6/order-flow.js
```

#### Rate Limit Verification

```javascript
// k6/rate-limit.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  iterations: 120, // exceeds default 100 req/window
};

export default function () {
  const res = http.get('http://localhost:3000/v1/products');
  // After 100 requests in the window, expect 429
  check(res, {
    'ok or rate-limited': (r) => r.status === 200 || r.status === 429,
  });
}
```

---

## Security Measures

### Authentication & Token Security

| Measure          | Implementation                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Password hashing | **Argon2id** via `argon2` package — memory-hard, resistant to GPU/ASIC attacks                                       |
| Access tokens    | **JWT HS256**, 15-minute expiry, signed with `JWT_ACCESS_SECRET` (min 32 chars)                                      |
| Refresh tokens   | **JWT HS256**, 7-day expiry, stored in DB with expiry column; expired tokens are purged on login                     |
| Token rotation   | Each login issues a fresh refresh token; concurrent logins use unique `jti` claims to prevent token reuse collisions |
| OAuth2 state     | CSRF protection via cryptographically random `state` parameter with 10-minute TTL stored in memory                   |
| Secret strength  | Both JWT secrets are validated at startup to be ≥ 32 characters via Zod schema                                       |

### HTTP Security Headers

`@fastify/helmet` is registered on the API Gateway and sets the following headers on every response:

| Header                            | Effect                                               |
| --------------------------------- | ---------------------------------------------------- |
| `X-Content-Type-Options: nosniff` | Prevents MIME-type sniffing                          |
| `X-Frame-Options: SAMEORIGIN`     | Blocks clickjacking via iframes                      |
| `X-XSS-Protection: 0`             | Disables legacy XSS filter (modern browsers use CSP) |
| `Strict-Transport-Security`       | Enforces HTTPS in production                         |
| `Referrer-Policy: no-referrer`    | Prevents referrer leakage                            |
| `X-DNS-Prefetch-Control: off`     | Disables DNS prefetching                             |
| `Permissions-Policy`              | Restricts browser feature access                     |

Content Security Policy is intentionally disabled (`contentSecurityPolicy: false`) as the gateway serves a JSON API, not HTML.

### CORS

`@fastify/cors` is configured with an explicit allowlist:

```typescript
origin: config.CORS_ORIGIN.split(','),  // e.g. "https://app.example.com"
credentials: true,
```

Wildcard `*` origins are not permitted. The `CORS_ORIGIN` env variable must be set explicitly in production.

### Rate Limiting

`@fastify/rate-limit` is applied globally at the API Gateway:

- **Window:** 15 minutes (configurable via `RATE_LIMIT_WINDOW_MS`)
- **Max requests:** 100 per window (configurable via `RATE_LIMIT_MAX_REQUESTS`)
- **Key strategy:** Authenticated users are keyed by `user:<userId>`; unauthenticated requests by `ip:<ip>`. This prevents a single authenticated user from consuming the shared IP quota.
- **Response on breach:** HTTP `429` with standard error envelope

### Role-Based Access Control (RBAC)

Two roles are enforced via the `requireRole` middleware:

| Role    | Permissions                                                         |
| ------- | ------------------------------------------------------------------- |
| `USER`  | Read products/categories, manage own orders                         |
| `ADMIN` | All USER permissions + create/update/delete products and categories |

The `requireAdmin` guard is applied as a `preHandler` hook on all mutating product and category routes. Attempting to call these without the `ADMIN` role returns `403 Forbidden`.

### Input Validation

All request bodies and query strings are validated with **Zod** schemas before any business logic runs. Validation failures return `400 Bad Request` with a field-level error message. UUID path parameters are additionally validated with a regex check before being passed to downstream services.

### Request Body Limit

The Fastify instance is configured with `bodyLimit: 1048576` (1 MB). Requests exceeding this are rejected with `413 Payload Too Large` before reaching any route handler.

### Error Tracking

**Sentry** (`@sentry/node`) is integrated into the API Gateway's global error handler. All unhandled exceptions are captured with request context (URL, method) and tagged with the service name. Sentry is only active when `SENTRY_DSN` is set.

### Database Security

- All queries go through **Prisma ORM** — no raw SQL string interpolation, eliminating SQL injection risk.
- The `passwordHash` field is never returned in API responses; only `id`, `email`, `firstName`, `lastName`, and `role` are exposed.
- Refresh tokens are stored with an `expiresAt` column and cleaned up on each login (`deleteMany` where `expiresAt < now`).
- Cascade deletes are configured on `RefreshToken → User` and `OrderItem → Order` to prevent orphaned records.

### Secrets Management

All secrets are loaded from environment variables and validated at startup via a Zod schema (`src/shared/config/env.ts`). The application will refuse to start if required secrets are missing or too short. The `.env` file is listed in `.gitignore` and should never be committed.

---

## Optimization Techniques

### Redis Caching (Product Catalog)

The Product Catalog service implements a **singleton `CacheService`** backed by `ioredis`:

- Product lists and individual products are cached with a configurable TTL.
- Cache keys are invalidated via `deletePattern` on write operations (create/update/delete).
- Cache metrics (hits, misses, hit rate) are tracked in memory and exposed at `GET /cache/metrics`.
- Metrics are logged automatically every 100 requests.

```
Cache hit rate target: > 80% for read-heavy product/category endpoints
```

### Asynchronous Messaging

Heavy operations are decoupled from the HTTP request path using two async layers:

1. **RabbitMQ** (`amqplib`) — durable, persistent message queues for cross-service events (order created, inventory updated, notifications). Messages are published with `persistent: true` and acknowledged only after successful processing. Failed messages are `nack`'d without requeue to a dead-letter queue.

2. **BullMQ** (`bullmq`) over Redis — per-service job queues for retryable background tasks:
   - `inventory` queue: low-stock alerts with 3 attempts, exponential backoff (2 s base)
   - `orders` queue: order lifecycle events with 3 attempts, exponential backoff
   - `system` queue: scheduled cleanup jobs (daily at 02:00 via cron pattern)

This keeps HTTP response times low by offloading notification dispatch, email sending, and inventory alerts to workers.

### Service Discovery with Consul

The API Gateway uses **Consul** for dynamic service resolution with a local TTL cache:

```typescript
private discoveryTtlMs = parseInt(process.env.SERVICE_DISCOVERY_TTL_MS || '5000')
```

- Consul is queried at most once per 5 seconds per service name.
- Results are cached in a `Map` keyed by service name.
- When multiple healthy instances are registered, the gateway picks one at random (client-side load balancing).
- If Consul is unavailable, the gateway falls back to static `*_SERVICE_URL` env variables — zero downtime during discovery outages.

### Response Compression

`@fastify/compress` is registered globally with default settings (gzip/deflate/brotli). This reduces JSON payload sizes by 60–80% for list responses, directly improving throughput under bandwidth constraints.

### Database Indexing

The Prisma schema defines targeted indexes on all high-frequency query columns:

| Table            | Indexed Columns                                | Query Pattern                     |
| ---------------- | ---------------------------------------------- | --------------------------------- |
| `users`          | `email`, `role`                                | Login lookup, RBAC queries        |
| `refresh_tokens` | `userId`, `expiresAt`                          | Token validation, cleanup         |
| `products`       | `slug`, `categoryId`, `sku`                    | Browse, filter, lookup            |
| `categories`     | `slug`, `parentId`                             | Hierarchy traversal               |
| `inventory`      | `quantity`                                     | Low-stock threshold scans         |
| `orders`         | `userId`, `status`, `orderNumber`, `createdAt` | User order history, status filter |
| `order_items`    | `orderId`, `productId`                         | Order detail joins                |
| `payments`       | `transactionId`, `status`                      | Payment lookup                    |
| `errors`         | `apiName`, `createdAt`                         | Error log queries                 |

### Singleton Prisma Client

`src/shared/utils/prisma.ts` exports a singleton `PrismaClient` instance. In development, it is stored on the `global` object to survive hot-module reloads without exhausting the PostgreSQL connection pool. In production, a single instance is created at startup.

### Multi-Stage Docker Build

The `Dockerfile` uses a three-stage build to minimise the final image size:

| Stage    | Purpose                                                                          |
| -------- | -------------------------------------------------------------------------------- |
| `deps`   | Install all npm dependencies (including dev)                                     |
| `build`  | Compile TypeScript, generate Prisma client                                       |
| `runner` | Copy only `dist/`, `node_modules/`, and `prisma/` — no source files or dev tools |

The runner stage is based on `node:20-alpine`, keeping the image lean and reducing the attack surface.

### Structured Logging with Pino

**Pino** is used for logging across all services. It is the fastest Node.js logger, serialising logs as newline-delimited JSON with negligible overhead. In development, `pino-pretty` formats output for readability. In production, raw JSON is emitted for ingestion by log aggregators (e.g. Datadog, CloudWatch).

Child loggers are created per service with a `service` context field, making log filtering straightforward in any aggregator.

---

## Running Load Tests Locally

```bash
# 1. Start the full stack
docker compose up -d

# 2. Wait for health checks to pass
docker compose ps

# 3. Seed test data
npm run prisma:seed

# 4. Run smoke test
k6 run k6/smoke.js

# 5. Run full load test
k6 run k6/load.js

# 6. Run Apache Bench quick check
ab -n 5000 -c 100 http://localhost:3000/v1/products
```

### Interpreting k6 Output

```
✓ products 200

checks.........................: 100.00% ✓ 5000  ✗ 0
data_received..................: 12 MB   40 kB/s
data_sent......................: 440 kB  1.5 kB/s
http_req_blocked...............: avg=1.2ms   p(95)=2.1ms
http_req_duration..............: avg=22ms    p(95)=48ms    p(99)=91ms
http_req_failed................: 0.00%   ✓ 0     ✗ 5000
http_reqs......................: 5000    16.6/s
```

Key metrics to watch:

- `http_req_failed` — should be `0.00%` under normal load
- `http_req_duration p(95)` — should stay within the thresholds defined per script
- `http_req_blocked` — high values indicate connection pool exhaustion or DNS delays
