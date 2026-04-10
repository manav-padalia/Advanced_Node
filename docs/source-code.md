# Source Code & Architecture

---

## Table of Contents

1. [GitHub Repository — Modular Structure](#1-github-repository--modular-structure)
2. [TypeScript Codebase](#2-typescript-codebase)
3. [README — Setup & Architecture Overview](#3-readme--setup--architecture-overview)
4. [Environment Variables (.env.example)](#4-environment-variables-envexample)
5. [Docker & Docker Compose](#5-docker--docker-compose)

---

## 1. GitHub Repository — Modular Structure

The project is a **monorepo** — all five microservices share one `package.json`, one `node_modules`, and one Prisma schema, while remaining independently startable and deployable.

```
ecommerce-backend/
├── src/
│   ├── shared/                        # Cross-service utilities (imported by all services)
│   │   ├── config/
│   │   │   └── env.ts                 # Zod-validated environment schema
│   │   ├── constants/
│   │   │   └── ResponseCodes.ts       # HTTP response code constants
│   │   ├── errors/
│   │   │   └── CustomErrors.ts        # Typed error classes (BadRequest, NotFound, etc.)
│   │   ├── messaging/
│   │   │   ├── events.ts              # Queue/exchange names, event payload types
│   │   │   ├── rabbitmq.client.ts     # AMQP connection + RPC/publish wrapper
│   │   │   └── index.ts               # Re-exports
│   │   ├── middleware/
│   │   │   └── responseEnhancer.ts    # Fastify plugin — standardised response shape
│   │   ├── service-discovery/
│   │   │   └── consul.ts              # Consul registration & discovery helpers
│   │   ├── types/
│   │   │   └── ApiResponse.ts         # Shared response interfaces
│   │   └── utils/
│   │       ├── logger.ts              # Pino logger factory
│   │       ├── prisma.ts              # Prisma client singleton
│   │       ├── query.ts               # Pagination query helpers
│   │       ├── sentry.ts              # Sentry initialisation
│   │       └── addErrorHelper.ts      # Persists errors to the DB errors table
│   │
│   └── services/
│       ├── api-gateway/               # Port 3000 — sole public entry point
│       │   ├── app.ts                 # Fastify app factory (plugins + routes)
│       │   ├── server.ts              # Bootstrap, connect to RabbitMQ, listen
│       │   ├── config/
│       │   │   └── index.ts           # Gateway-specific validated config
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts  # Verifies Bearer JWT, attaches user to request
│       │   │   └── rbac.middleware.ts  # requireRole / requireAdmin guards
│       │   ├── routes/
│       │   │   ├── v1/
│       │   │   │   ├── auth.routes.ts       # /v1/auth/*
│       │   │   │   ├── products.routes.ts   # /v1/products/*
│       │   │   │   ├── categories.routes.ts # /v1/categories/*
│       │   │   │   └── orders.routes.ts     # /v1/orders/*
│       │   │   ├── health.routes.ts         # GET /health, GET /ready
│       │   │   └── metrics.routes.ts        # GET /metrics (Prometheus)
│       │   ├── services/
│       │   │   ├── messaging.service.ts  # RabbitMQ RPC client (products, categories, orders)
│       │   │   └── proxy.service.ts      # HTTP proxy via Consul + Axios (orders fallback)
│       │   └── utils/
│       │       ├── jwt.ts             # generateAccessToken / generateRefreshToken / verify
│       │       └── password.ts        # hashPassword / verifyPassword (Argon2)
│       │
│       ├── product-catalog/           # Port 3001
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── controllers/
│       │   │   ├── product.controller.ts
│       │   │   └── category.controller.ts
│       │   ├── repositories/
│       │   │   ├── product.repository.ts   # Prisma queries for products
│       │   │   └── category.repository.ts  # Prisma queries for categories
│       │   ├── services/
│       │   │   ├── product.service.ts
│       │   │   ├── category.service.ts
│       │   │   ├── cache.service.ts        # Redis read-through cache
│       │   │   └── messaging.service.ts    # RabbitMQ RPC server (handles inbound RPCs)
│       │   └── routes/
│       │
│       ├── order/                     # Port 3002
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── controllers/
│       │   │   └── order.controller.ts
│       │   ├── repositories/
│       │   │   └── order.repository.ts
│       │   └── services/
│       │       ├── order.service.ts        # Order lifecycle management
│       │       ├── payment.service.ts      # Stripe charge + webhook handling
│       │       ├── inventory.service.ts    # RPC calls to Inventory service
│       │       ├── queue.service.ts        # BullMQ job producers
│       │       └── messaging.service.ts    # RabbitMQ event publisher + RPC server
│       │
│       ├── inventory/                 # Port 3003
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── controllers/
│       │   │   └── inventory.controller.ts
│       │   ├── repositories/
│       │   │   └── inventory.repository.ts
│       │   └── services/
│       │       ├── inventory.service.ts    # Stock management + reservation logic
│       │       ├── queue.service.ts        # BullMQ job producers
│       │       └── messaging.service.ts    # RabbitMQ RPC server + event consumer
│       │
│       └── notification/              # Port 3004
│           ├── app.ts
│           ├── server.ts
│           ├── services/
│           │   ├── email.service.ts        # Nodemailer SMTP delivery
│           │   ├── socket.service.ts       # Socket.IO real-time events
│           │   ├── queue-manager.service.ts # BullMQ queue setup
│           │   └── messaging.service.ts    # RabbitMQ event consumer
│           ├── workers/
│           │   ├── email.worker.ts         # Processes email jobs
│           │   ├── alert.worker.ts         # Low-stock alert jobs
│           │   ├── report.worker.ts        # Scheduled report jobs
│           │   ├── cleanup.worker.ts       # Periodic data cleanup
│           │   └── error-cleanup.worker.ts # Purges old error records
│           └── plugins/
│               └── bull-board.plugin.ts    # Bull Board UI registration
│
├── prisma/
│   ├── schema.prisma                  # Single Prisma schema for all services
│   ├── seed.ts                        # Development seed data
│   └── migrations/                    # Auto-generated migration SQL files
│
├── scripts/
│   ├── setup-rabbitmq.sh              # Declares exchanges and queues
│   └── test-rabbitmq.sh               # Smoke-tests broker connectivity
│
├── docs/                              # Architecture, deployment, and this file
├── .github/                           # GitHub Actions CI/CD workflows
├── Dockerfile                         # Multi-stage production image
├── docker-compose.yml                 # Full stack (infrastructure + all services)
├── docker-compose.full.yml            # Minimal dev stack (infra + gateway only)
├── .env.example                       # Template for all required variables
├── jest.config.cjs                    # Jest unit test configuration
├── playwright.config.ts               # Playwright E2E test configuration
└── package.json                       # Monorepo scripts and dependencies
```

### Monorepo Design

| Concern           | Approach                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| Dependencies      | Single `package.json` + `node_modules` — no per-service installs           |
| Database          | Single `prisma/schema.prisma` — one migration history                      |
| Shared code       | `src/shared/` imported via `@ecommerce/shared/*` path alias                |
| Service isolation | Each service has its own `app.ts`, `server.ts`, and port                   |
| Build output      | `tsc` compiles everything to `dist/`; each service has its own entry point |
| Deployment        | Same Docker image, different `CMD` per service                             |

---

## 2. TypeScript Codebase

### Compiler Setup

| Tool             | Role                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `typescript 5.x` | Compiler with strict mode enabled                                 |
| `tsx watch`      | Zero-config dev runner with hot-reload (no separate compile step) |
| `tsc`            | Production compilation to `dist/`                                 |
| `tsc-alias`      | Resolves `@ecommerce/shared/*` path aliases in compiled output    |

Path aliases are defined in `tsconfig.json` and resolved at build time by `tsc-alias`, so the compiled `dist/` files work without any module bundler.

### Framework — Fastify 4.x

Every service uses Fastify as its HTTP server. Key patterns used across the codebase:

- **Plugin system** — features (CORS, rate-limit, Swagger, routes) are registered as Fastify plugins via `app.register()`
- **Schema-first routes** — each route declares an OpenAPI-compatible JSON schema; Fastify uses it for serialisation and Swagger auto-generation
- **`preHandler` hooks** — `authMiddleware` and `requireAdmin` are attached per-route or per-plugin as `preHandler` arrays
- **`setErrorHandler`** — a single global error handler on the gateway catches all unhandled errors, logs them, and reports to Sentry

### Validation — Zod

Zod is used in two places:

**Environment validation** (`src/shared/config/env.ts`) — runs at process startup; throws a descriptive error listing every missing or invalid variable before the server binds to a port:

```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  // ...
});

export const validateEnv = (): Env => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
};
```

**Request body / query validation** — each route handler calls `schema.parse(request.body)` before any business logic. Invalid input returns a `400` with a field-level error message.

### ORM — Prisma 5.x

- Single `prisma/schema.prisma` shared across all services
- Prisma client is instantiated once as a singleton in `src/shared/utils/prisma.ts` and imported by all repositories
- Binary targets in `schema.prisma` include `linux-musl-openssl-3.0.x` and `linux-musl-arm64-openssl-3.0.x` to support Alpine-based Docker images on both x86 and ARM

### Logging — Pino

Structured JSON logging via Pino. Each service creates its own named logger via `createServiceLogger('service-name')` from `src/shared/utils/logger.ts`. Log level is controlled by `LOG_LEVEL` (`fatal | error | warn | info | debug | trace`). In development, `pino-pretty` formats output for readability.

### Error Handling

Three-layer approach:

1. **Typed errors** — `src/shared/errors/CustomErrors.ts` exports `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `InternalServerError`. Route handlers throw these; Fastify's error handler maps them to the correct HTTP status.
2. **DB persistence** — `addErrorHelper({ apiName, details })` writes every caught error to the `errors` table so nothing is silently swallowed.
3. **Sentry** — the global error handler in `api-gateway/app.ts` calls `Sentry.captureException()` when `SENTRY_DSN` is set.

---

## 3. README — Setup & Architecture Overview

The `README.md` at the repo root is the primary onboarding document. Here is a summary of what it covers and how to use it.

### Quick Start (from README)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — minimum required: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

# 3. Start infrastructure (PostgreSQL, Redis, RabbitMQ, Consul)
docker-compose up -d

# 4. Set up database
npm run prisma:generate
npm run prisma:migrate

# 5. Start all services
npm run dev
```

### Service URLs (after startup)

| Service                  | URL                                       |
| ------------------------ | ----------------------------------------- |
| API Gateway + Swagger UI | http://localhost:3000/docs                |
| RabbitMQ Management UI   | http://localhost:15672 (admin / admin123) |
| Redis Commander          | http://localhost:8081                     |
| Consul UI                | http://localhost:8500                     |

### Development Scripts

```bash
npm run dev                  # All 5 services concurrently (concurrently)
npm run dev:gateway          # API Gateway only
npm run dev:products         # Product Catalog only
npm run dev:orders           # Order Service only
npm run dev:inventory        # Inventory Service only
npm run dev:notifications    # Notification Service only

npm run build                # tsc + tsc-alias → dist/

npm run prisma:generate      # Regenerate Prisma client
npm run prisma:migrate       # Apply pending migrations
npm run prisma:seed          # Seed development data
npm run prisma:studio        # Open Prisma Studio GUI

npm test                     # Jest unit tests with coverage
npm run test:e2e             # Playwright end-to-end tests

npm run rabbitmq:setup       # Declare exchanges and queues
npm run rabbitmq:test        # Smoke test broker connectivity
```

### Architecture Summary (from README)

The README describes a microservices backend where:

- The **API Gateway** is the only public-facing service — clients never call downstream services directly
- **RabbitMQ** handles all inter-service communication via two patterns: RPC (synchronous-like request/reply) and Events (async publish/subscribe)
- **PostgreSQL** is the primary database, accessed via Prisma ORM
- **Redis** serves as both a response cache (Product Catalog) and the BullMQ job queue backend (Notification Service)
- **Consul** provides optional service discovery so the gateway can resolve downstream addresses dynamically

---

## 4. Environment Variables (.env.example)

Copy `.env.example` to `.env` before starting. All variables are validated at startup via Zod — the process will not start if required values are missing or malformed.

```bash
cp .env.example .env
```

### Database

| Variable       | Required | Description                                                                                                    |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | ✅       | PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/ecommerce_dev?schema=public` |

### Redis

| Variable         | Required | Default     | Description                                   |
| ---------------- | -------- | ----------- | --------------------------------------------- |
| `REDIS_HOST`     | ✅       | `localhost` | Redis hostname                                |
| `REDIS_PORT`     |          | `6379`      | Redis port                                    |
| `REDIS_PASSWORD` |          | —           | Redis auth password (leave blank for no auth) |

### RabbitMQ

| Variable       | Required | Description                                           |
| -------------- | -------- | ----------------------------------------------------- |
| `RABBITMQ_URL` | ✅       | AMQP URL, e.g. `amqp://admin:admin123@localhost:5672` |

### Authentication

| Variable             | Required | Constraint    | Description                  |
| -------------------- | -------- | ------------- | ---------------------------- |
| `JWT_ACCESS_SECRET`  | ✅       | min 32 chars  | Signs access tokens (HS256)  |
| `JWT_REFRESH_SECRET` | ✅       | min 32 chars  | Signs refresh tokens (HS256) |
| `JWT_ACCESS_EXPIRY`  |          | default `15m` | Access token lifetime        |
| `JWT_REFRESH_EXPIRY` |          | default `7d`  | Refresh token lifetime       |

### OAuth2 — Google

| Variable               | Required | Description                                                        |
| ---------------------- | -------- | ------------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | optional | Google Cloud OAuth2 client ID                                      |
| `GOOGLE_CLIENT_SECRET` | optional | Google Cloud OAuth2 client secret                                  |
| `GOOGLE_CALLBACK_URL`  | optional | Redirect URI, e.g. `http://localhost:3000/v1/auth/google/callback` |

### Payments — Stripe

| Variable                | Required | Description                                   |
| ----------------------- | -------- | --------------------------------------------- |
| `STRIPE_SECRET_KEY`     | optional | `sk_test_...` for dev, `sk_live_...` for prod |
| `STRIPE_WEBHOOK_SECRET` | optional | Webhook endpoint signing secret (`whsec_...`) |

### Email — SMTP

| Variable        | Required | Description                                 |
| --------------- | -------- | ------------------------------------------- |
| `SMTP_HOST`     | optional | SMTP server hostname, e.g. `smtp.gmail.com` |
| `SMTP_PORT`     | optional | SMTP port, e.g. `587`                       |
| `SMTP_USER`     | optional | SMTP login username                         |
| `SMTP_PASSWORD` | optional | App password (not your account password)    |
| `EMAIL_FROM`    | optional | Sender address shown in emails              |
| `ADMIN_EMAIL`   | optional | Recipient for low-stock and system alerts   |

### Service Ports

| Variable                    | Default | Description                      |
| --------------------------- | ------- | -------------------------------- |
| `API_GATEWAY_PORT`          | `3000`  | API Gateway listen port          |
| `PRODUCT_SERVICE_PORT`      | `3001`  | Product Catalog listen port      |
| `ORDER_SERVICE_PORT`        | `3002`  | Order Service listen port        |
| `INVENTORY_SERVICE_PORT`    | `3003`  | Inventory Service listen port    |
| `NOTIFICATION_SERVICE_PORT` | `3004`  | Notification Service listen port |

### Service URLs (inter-service HTTP fallback)

| Variable                   | Default                 | Description                              |
| -------------------------- | ----------------------- | ---------------------------------------- |
| `PRODUCT_SERVICE_URL`      | `http://localhost:3001` | Used by proxy when Consul is unavailable |
| `ORDER_SERVICE_URL`        | `http://localhost:3002` | Used by proxy when Consul is unavailable |
| `INVENTORY_SERVICE_URL`    | `http://localhost:3003` | Used by proxy when Consul is unavailable |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:3004` | Used by proxy when Consul is unavailable |

### Rate Limiting & CORS

| Variable                  | Default                 | Description                               |
| ------------------------- | ----------------------- | ----------------------------------------- |
| `RATE_LIMIT_WINDOW_MS`    | `900000`                | Rate limit window in ms (default: 15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100`                   | Max requests per window per user/IP       |
| `CORS_ORIGIN`             | `http://localhost:3000` | Comma-separated list of allowed origins   |

### Observability

| Variable                    | Default       | Description                                               |
| --------------------------- | ------------- | --------------------------------------------------------- |
| `NODE_ENV`                  | `development` | `development`, `production`, or `test`                    |
| `LOG_LEVEL`                 | `info`        | Pino log level (`fatal\|error\|warn\|info\|debug\|trace`) |
| `SENTRY_DSN`                | —             | Sentry DSN for error tracking (production)                |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1`         | Performance tracing sample rate (0–1)                     |
| `PROMETHEUS_PORT`           | `9090`        | Prometheus scrape port                                    |

### Service Discovery — Consul

| Variable                 | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `CONSUL_HTTP_ADDR`       | Consul agent address, e.g. `http://consul:8500` |
| `SERVICE_ADVERTISE_HOST` | Hostname this service registers with Consul     |

---

## 5. Docker & Docker Compose

### Dockerfile — Multi-Stage Build

The Dockerfile produces a single lean production image that can run any of the five services by overriding the default `CMD`.

```
┌─────────────────────────────────────────────────┐
│  Stage 1: deps  (node:20-alpine)                │
│  • Install build tools: python3, make, g++      │
│    (required to compile native argon2 bindings) │
│  • npm ci                                       │
└────────────────────┬────────────────────────────┘
                     │ COPY node_modules
┌────────────────────▼────────────────────────────┐
│  Stage 2: build  (node:20-alpine)               │
│  • Install build tools (same as above)          │
│  • npx prisma generate                          │
│  • npm run build  (tsc + tsc-alias → dist/)     │
└────────────────────┬────────────────────────────┘
                     │ COPY dist/, node_modules, prisma/
┌────────────────────▼────────────────────────────┐
│  Stage 3: runner  (node:20-alpine + openssl)    │
│  • NODE_ENV=production                          │
│  • ENTRYPOINT docker-entrypoint.sh              │
│  • CMD node dist/services/api-gateway/server.js │
│  • EXPOSE 3000                                  │
└─────────────────────────────────────────────────┘
```

The `runner` stage only contains the compiled output and production `node_modules` — no source files, no build tools. The same image runs all five services; each service overrides `CMD` at container start.

### docker-compose.yml — Full Stack

Starts all infrastructure and all five application services. Use this for integration testing or a fully containerised environment.

**Infrastructure containers:**

| Container                   | Image                            | Ports           | Notes                                       |
| --------------------------- | -------------------------------- | --------------- | ------------------------------------------- |
| `ecommerce-postgres`        | `postgres:16-alpine`             | `5432`          | Persistent volume, `pg_isready` healthcheck |
| `ecommerce-redis`           | `redis:7-alpine`                 | `6379`          | AOF persistence (`--appendonly yes`)        |
| `ecommerce-rabbitmq`        | `rabbitmq:3-management-alpine`   | `5672`, `15672` | Default user: `admin` / `admin123`          |
| `ecommerce-consul`          | `hashicorp/consul:1.17`          | `8500`          | Dev mode with web UI                        |
| `ecommerce-redis-commander` | `rediscommander/redis-commander` | `8081`          | Redis GUI, depends on redis                 |

**Application containers** (all use `ecommerce-backend:latest`):

| Container                   | Port   | CMD                                            |
| --------------------------- | ------ | ---------------------------------------------- |
| `ecommerce-api-gateway`     | `3000` | `node dist/services/api-gateway/server.js`     |
| `ecommerce-product-catalog` | `3001` | `node dist/services/product-catalog/server.js` |
| `ecommerce-order`           | `3002` | `node dist/services/order/server.js`           |
| `ecommerce-inventory`       | `3003` | `node dist/services/inventory/server.js`       |
| `ecommerce-notification`    | `3004` | `node dist/services/notification/server.js`    |

All application containers use `depends_on` with `condition: service_healthy` — they wait for Postgres, Redis, and RabbitMQ healthchecks to pass before starting.

**Volumes:** `postgres_data`, `redis_data`, `rabbitmq_data` — data survives `docker-compose down` (use `down -v` for a full reset).

**Network:** All containers share the `ecommerce-network` bridge network, so services reach each other by container name (e.g. `postgres`, `redis`, `rabbitmq`).

### docker-compose.full.yml — Minimal Dev Stack

A lighter file for local development. Builds the image from source (`build: .`) and starts only the API Gateway alongside infrastructure. Run the other four services locally with `npm run dev:*`.

```bash
# Typical local dev workflow
docker-compose -f docker-compose.full.yml up -d   # infra + gateway in Docker
npm run dev:products                               # product catalog locally
npm run dev:orders                                 # order service locally
npm run dev:inventory                              # inventory locally
npm run dev:notifications                          # notification locally
```

### Common Commands

```bash
# Build the image
docker build -t ecommerce-backend:latest .

# Start infrastructure only
docker-compose up -d postgres redis rabbitmq consul

# Start full stack
docker-compose up -d

# Tail logs for one service
docker-compose logs -f api-gateway

# Stop (keep volumes)
docker-compose down

# Stop + wipe all data
docker-compose down -v

# Rebuild after code changes
docker-compose build && docker-compose up -d
```

### Management UIs

| UI                  | URL                        | Credentials      |
| ------------------- | -------------------------- | ---------------- |
| Swagger / OpenAPI   | http://localhost:3000/docs | —                |
| RabbitMQ Management | http://localhost:15672     | admin / admin123 |
| Redis Commander     | http://localhost:8081      | —                |
| Consul              | http://localhost:8500      | —                |
