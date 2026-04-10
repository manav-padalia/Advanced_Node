# Monitoring Setup

## Overview

The platform uses a layered monitoring stack built entirely from code already in the repository:

| Layer                   | Tool                        | Where                      |
| ----------------------- | --------------------------- | -------------------------- |
| Structured logging      | Pino                        | All services               |
| Error persistence       | PostgreSQL (`errors` table) | `addErrorHelper`           |
| External error tracking | Sentry (`@sentry/node`)     | API Gateway + all services |
| Metrics scraping        | Prometheus (`prom-client`)  | `GET /metrics`             |
| Queue visibility        | Bull Board UI               | `GET /admin/queues`        |
| Real-time alerts        | Socket.IO                   | Notification service       |
| Email alerts            | Nodemailer / SMTP           | Notification service       |
| Health checks           | Fastify routes              | Every service              |

---

## Logging Configuration

### Library

All services use **Pino** (`pino` + `pino-pretty`) via the shared logger in `src/shared/utils/logger.ts`.

```typescript
// src/shared/utils/logger.ts
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const createServiceLogger = (serviceName: string) =>
  logger.child({ service: serviceName });
```

### Behaviour by Environment

| `NODE_ENV`    | Output format                           | Transport                             |
| ------------- | --------------------------------------- | ------------------------------------- |
| `development` | Human-readable (pino-pretty, colorised) | stdout                                |
| `production`  | Newline-delimited JSON                  | stdout (for log aggregator ingestion) |

### Log Levels

Controlled by the `LOG_LEVEL` environment variable. Valid values (Pino standard):

| Level   | Value | When to use                          |
| ------- | ----- | ------------------------------------ |
| `fatal` | 60    | Service is about to crash            |
| `error` | 50    | Caught exceptions, failed operations |
| `warn`  | 40    | Degraded state, non-fatal issues     |
| `info`  | 30    | Normal lifecycle events (default)    |
| `debug` | 20    | Detailed flow tracing                |
| `trace` | 10    | Verbose low-level tracing            |

Default is `info`. Set `LOG_LEVEL=debug` locally for verbose output.

### Service Context

Every service creates a child logger with a `service` field:

```typescript
// In any service file
const logger = createServiceLogger('order-service');
logger.info({ orderId }, 'Order created');
// → {"level":"info","time":"...","service":"order-service","orderId":"...","msg":"Order created"}
```

This makes filtering by service trivial in any log aggregator:

```bash
# Datadog
service:api-gateway level:error

# CloudWatch Insights
filter @message like /api-gateway/ and level = "error"

# Loki / Grafana
{service="api-gateway"} |= "error"
```

### Structured Log Fields

All log entries include:

| Field             | Type     | Description                              |
| ----------------- | -------- | ---------------------------------------- |
| `level`           | string   | Log level label                          |
| `time`            | ISO 8601 | Timestamp                                |
| `service`         | string   | Service name (child logger context)      |
| `msg`             | string   | Human-readable message                   |
| Additional fields | any      | Contextual data passed as first argument |

Error log entries from `addErrorHelper` additionally include:

| Field     | Description                                     |
| --------- | ----------------------------------------------- |
| `errorId` | UUID assigned to this error instance            |
| `apiName` | Controller/service method that caught the error |
| `message` | Error message                                   |
| `stack`   | Stack trace                                     |
| `details` | Full error object                               |

### Error Persistence

`src/shared/utils/addErrorHelper.ts` is called from every controller `catch` block. It:

1. Logs the error via Pino with full context
2. Persists a record to the `errors` table in PostgreSQL
3. Forwards the exception to Sentry (if `SENTRY_DSN` is set)

```typescript
await addErrorHelper({
  apiName: 'OrderController.create',
  details: err,
});
```

The `errors` table schema:

```sql
CREATE TABLE errors (
  id          UUID PRIMARY KEY,
  api_name    TEXT NOT NULL,
  err_message TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON errors (api_name);
CREATE INDEX ON errors (created_at);
```

Errors older than 3 months are automatically purged by the `error-cleanup` BullMQ worker, which runs daily at 02:00 via a cron schedule.

### Log Aggregation (Production)

Since all services emit JSON to stdout, any sidecar or log driver can collect them:

**Docker / Docker Compose** — use the `json-file` or `fluentd` log driver:

```yaml
# docker-compose.yml addition
services:
  api-gateway:
    logging:
      driver: 'json-file'
      options:
        max-size: '50m'
        max-file: '5'
```

**Railway / Render** — stdout is captured automatically by the platform.

**Self-hosted** — ship logs with Promtail → Loki → Grafana, or Filebeat → Elasticsearch → Kibana.

---

## Metrics Collection Setup

### Library

`prom-client` is used to expose Prometheus-compatible metrics from the API Gateway.

### Implementation

`src/services/api-gateway/routes/metrics.routes.ts` registers a dedicated `Registry` and hooks into Fastify's `onResponse` lifecycle:

```typescript
const register = new Registry();
register.setDefaultLabels({ app: 'api-gateway' });

// Default Node.js metrics: memory, CPU, event loop lag, GC, etc.
collectDefaultMetrics({ register });

// Custom counter — total HTTP requests
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Custom histogram — request duration
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Hook fires after every response
fastify.addHook('onResponse', (request, reply, done) => {
  const labels = {
    method: request.method,
    route: request.routerPath || request.url,
    status_code: String(reply.statusCode),
  };
  httpRequestsTotal.inc(labels);
  done();
});
```

### Scrape Endpoint

```
GET /metrics
```

Returns Prometheus text format. The endpoint is hidden from Swagger (`schema: { hide: true }`).

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/v1/products",status_code="200",app="api-gateway"} 4821

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005",method="GET",route="/v1/products",status_code="200",...} 3102
http_request_duration_seconds_bucket{le="0.01",...} 4100
...
http_request_duration_seconds_sum{...} 48.21
http_request_duration_seconds_count{...} 4821

# HELP process_cpu_seconds_total Total user and system CPU time
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 12.34

# HELP nodejs_heap_size_used_bytes Process heap size used
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes 45678912
```

### Default Metrics Collected

`collectDefaultMetrics` automatically exposes:

| Metric                          | Type      | Description              |
| ------------------------------- | --------- | ------------------------ |
| `process_cpu_seconds_total`     | Counter   | CPU time (user + system) |
| `process_resident_memory_bytes` | Gauge     | RSS memory               |
| `nodejs_heap_size_used_bytes`   | Gauge     | V8 heap used             |
| `nodejs_heap_size_total_bytes`  | Gauge     | V8 heap total            |
| `nodejs_external_memory_bytes`  | Gauge     | External memory          |
| `nodejs_event_loop_lag_seconds` | Gauge     | Event loop lag           |
| `nodejs_active_handles_total`   | Gauge     | Active libuv handles     |
| `nodejs_active_requests_total`  | Gauge     | Active libuv requests    |
| `nodejs_gc_duration_seconds`    | Histogram | GC pause durations       |

### Prometheus Scrape Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'ecommerce-api-gateway'
    static_configs:
      - targets: ['api-gateway:3000']
    metrics_path: /metrics
    scrape_interval: 15s
```

### Grafana Dashboard Queries

Useful PromQL queries for a Grafana dashboard:

```promql
# Request rate (req/s) over last 5 minutes
rate(http_requests_total{app="api-gateway"}[5m])

# Error rate (4xx + 5xx)
rate(http_requests_total{status_code=~"[45].."}[5m])
  / rate(http_requests_total[5m])

# p95 response time
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)

# p99 response time
histogram_quantile(0.99,
  rate(http_request_duration_seconds_bucket[5m])
)

# Heap usage
nodejs_heap_size_used_bytes{app="api-gateway"}

# Event loop lag
nodejs_event_loop_lag_seconds{app="api-gateway"}
```

### Queue Monitoring — Bull Board

The Notification service exposes a **Bull Board** UI at:

```
GET http://localhost:3004/admin/queues
```

All five BullMQ queues are registered:

| Queue       | Workers                                | Purpose                                  |
| ----------- | -------------------------------------- | ---------------------------------------- |
| `orders`    | `email.worker` (concurrency 5)         | Order confirmation / cancellation emails |
| `inventory` | `alert.worker` (concurrency 3)         | Low-stock email + Socket.IO alert        |
| `reports`   | `report.worker` (concurrency 2)        | Daily report generation                  |
| `cleanup`   | `cleanup.worker` (concurrency 1)       | General cleanup tasks                    |
| `system`    | `error-cleanup.worker` (concurrency 1) | Nightly DB error log purge               |

The dashboard shows job counts (waiting, active, completed, failed, delayed), job details, and allows manual retries of failed jobs.

---

## Alert Configuration

### Email Alerts via SMTP

The `EmailService` (`src/services/notification/services/email.service.ts`) sends transactional emails via Nodemailer. Configure SMTP in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@ecommerce.com
ADMIN_EMAIL=admin@ecommerce.com
```

#### Alert Types

| Alert              | Trigger                                  | Recipient           |
| ------------------ | ---------------------------------------- | ------------------- |
| Order confirmation | `order.created` RabbitMQ event           | Customer (`userId`) |
| Order cancellation | `order.cancelled` RabbitMQ event         | Customer (`userId`) |
| Low stock          | Inventory quantity ≤ `lowStockThreshold` | `ADMIN_EMAIL`       |
| Daily report       | Scheduled (configurable)                 | `ADMIN_EMAIL`       |

#### Low Stock Alert Email

Sent by `EmailService.sendLowStockAlert` when the inventory worker processes an `inventory.low-stock` BullMQ job:

```typescript
// Triggered from InventoryService when stock drops below threshold
await queueService.emitLowStockAlert({
  productId,
  currentStock,
  threshold,
  productName,
});
```

The email body:

```html
<h1>Low Stock Alert</h1>
<p><strong>Product ID:</strong> {productId}</p>
<p><strong>Current Stock:</strong> {currentStock}</p>
<p><strong>Threshold:</strong> {threshold}</p>
<p>Please restock this product soon.</p>
```

#### Daily Report Email

Sent by `EmailService.sendDailyReport` with:

- Date
- Total orders
- Total revenue
- Top products list

### Real-Time Alerts via Socket.IO

The `SocketService` (`src/services/notification/services/socket.service.ts`) broadcasts events to connected clients over WebSocket.

#### Connection

```javascript
// Client-side connection
import { io } from 'socket.io-client';

const socket = io('http://localhost:3004', {
  auth: { token: '<access_token>' },
});
```

Authentication is enforced via JWT middleware on the Socket.IO server — connections without a valid access token are rejected.

#### Rooms

| Room            | Members                   | Events                      |
| --------------- | ------------------------- | --------------------------- |
| `user:<userId>` | Authenticated user        | User-specific notifications |
| `admins`        | Users with `role = ADMIN` | `low-stock-alert`           |

#### Emitting Alerts

```typescript
// Emit to all admins (used by alert.worker and messaging.service)
socketService.emitToAdmins('low-stock-alert', {
  productId: 'uuid',
  currentStock: 3,
  threshold: 10,
  productName: 'Wireless Headphones',
});

// Emit to a specific user
socketService.emitToUser(userId, 'order-status-update', {
  orderId: 'uuid',
  status: 'SHIPPED',
});

// Broadcast to all connected clients
socketService.broadcast('system-announcement', { message: '...' });
```

#### Low Stock Alert Flow

```
Inventory quantity update
  → quantity ≤ lowStockThreshold
    → QueueService.emitLowStockAlert()          (BullMQ: inventory queue)
      → alert.worker processes job
        → EmailService.sendLowStockAlert()      (SMTP email to ADMIN_EMAIL)
        → SocketService.emitToAdmins()          (WebSocket push to admin room)

Also via RabbitMQ:
  → inventory.exchange → inventory.low-stock.queue
    → MessagingService consumer
      → EmailService.sendLowStockAlert()
      → SocketService.emitToAdmins()
```

### Sentry Error Tracking

Sentry is initialised in `src/shared/utils/sentry.ts` and called from `addErrorHelper` on every caught exception.

#### Setup

```env
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
SENTRY_TRACES_SAMPLE_RATE=0.1   # 10% of transactions traced (default)
```

If `SENTRY_DSN` is not set, Sentry is silently disabled — no errors are thrown.

#### Initialisation (API Gateway)

```typescript
// src/services/api-gateway/app.ts
initializeSentry(); // called before any routes are registered
```

#### Exception Capture

Every `addErrorHelper` call forwards to Sentry with structured tags:

```typescript
Sentry.captureException(error, {
  tags: {
    apiName: 'OrderController.create',
    errorId: 'uuid',
  },
  level: 'error',
});
```

The global Fastify error handler also captures unhandled exceptions:

```typescript
app.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error, {
    tags: { service: 'api-gateway' },
    extra: { url: request.url, method: request.method },
  });
  // ...
});
```

#### Sentry Alert Rules (recommended configuration)

In the Sentry dashboard, configure these alert rules:

```
Issue Alert: High error volume
  Condition:  An issue is seen more than 10 times in 1 hour
  Action:     Send email to team@example.com

Issue Alert: New issue
  Condition:  A new issue is created
  Action:     Send Slack notification to #alerts

Metric Alert: Error rate spike
  Metric:     Number of errors
  Threshold:  > 50 errors in 5 minutes
  Action:     Page on-call via PagerDuty
```

### Prometheus Alerting Rules

Add to your Prometheus `alert.rules.yml`:

```yaml
groups:
  - name: ecommerce-api-gateway
    rules:
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status_code=~"5.."}[5m])
          / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'High 5xx error rate on API Gateway'
          description: 'Error rate is {{ $value | humanizePercentage }} over the last 5 minutes.'

      - alert: SlowResponseTime
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'p95 response time exceeds 1 second'
          description: 'p95 latency is {{ $value }}s.'

      - alert: HighMemoryUsage
        expr: |
          nodejs_heap_size_used_bytes{app="api-gateway"}
          / nodejs_heap_size_total_bytes{app="api-gateway"} > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Node.js heap usage above 85%'
          description: 'Heap usage is {{ $value | humanizePercentage }}.'

      - alert: EventLoopLag
        expr: nodejs_event_loop_lag_seconds{app="api-gateway"} > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'Event loop lag exceeds 100ms'
          description: 'Event loop lag is {{ $value }}s.'

      - alert: ServiceDown
        expr: up{job="ecommerce-api-gateway"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'API Gateway is unreachable'
          description: 'Prometheus cannot scrape the API Gateway metrics endpoint.'
```

---

## Health Check Implementation

### API Gateway Health Endpoints

Implemented in `src/services/api-gateway/routes/health.routes.ts`:

#### `GET /health`

Basic liveness check. Returns `200` if the process is running.

```json
{
  "status": 200,
  "message": "API Gateway is healthy",
  "data": {
    "service": "api-gateway",
    "uptime": 3842.17,
    "timestamp": "2026-04-10T12:00:00.000Z"
  },
  "error": ""
}
```

#### `GET /health/metrics`

Process-level resource snapshot.

```json
{
  "status": 200,
  "message": "Metrics",
  "data": {
    "service": "api-gateway",
    "uptime": 3842.17,
    "pid": 1,
    "memory": {
      "rss": 89128960,
      "heapTotal": 52428800,
      "heapUsed": 41943040,
      "external": 2097152,
      "arrayBuffers": 524288
    },
    "timestamp": "2026-04-10T12:00:00.000Z"
  },
  "error": ""
}
```

#### `GET /ready`

Readiness probe. Returns `ready: true` when the service is ready to accept traffic.

```json
{
  "status": 200,
  "message": "API Gateway is ready",
  "data": {
    "service": "api-gateway",
    "ready": true
  },
  "error": ""
}
```

### Notification Service Health

`src/services/notification/routes/health.routes.ts` exposes:

#### `GET /health` (port 3004)

```json
{
  "status": 200,
  "message": "Notification Service is healthy",
  "data": {
    "service": "notification-service",
    "uptime": 1200.5,
    "timestamp": "2026-04-10T12:00:00.000Z"
  },
  "error": ""
}
```

### Consul Health Checks

Each service registers a Consul health check on startup via `consulRegisterService`:

```typescript
await consulRegisterService({
  id: SERVICE_ID,
  name: SERVICE_NAME,
  address,
  port,
  tags: ['gateway'],
  healthUrl: `http://${address}:${port}/health`,
});
```

Consul polls `GET /health` every 10 seconds with a 5-second timeout. A service is deregistered automatically after 1 minute of failing health checks (`DeregisterCriticalServiceAfter: 1m`).

### Docker Compose Health Checks

All infrastructure services in `docker-compose.yml` have health checks configured:

```yaml
postgres:
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U postgres']
    interval: 10s
    timeout: 5s
    retries: 5

redis:
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 5s
    retries: 5

rabbitmq:
  healthcheck:
    test: ['CMD', 'rabbitmq-diagnostics', 'ping']
    interval: 10s
    timeout: 5s
    retries: 5
```

Application services use `condition: service_healthy` to wait for all dependencies before starting:

```yaml
api-gateway:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
    consul:
      condition: service_started
```

### Kubernetes Probes (Production Reference)

When deploying to Kubernetes, map the health endpoints to liveness and readiness probes:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 20
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

### Graceful Shutdown

The API Gateway handles `SIGTERM` and `SIGINT` to deregister from Consul and disconnect from RabbitMQ before exiting:

```typescript
async function shutdown() {
  try {
    await messagingService.disconnect();
    await consulDeregisterService(SERVICE_ID);
  } catch (err) {
    logger.warn({ err }, 'Failed to deregister from Consul');
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

This ensures Consul removes the service from its registry immediately on shutdown, preventing the API Gateway's proxy from routing traffic to a dead instance during the Consul TTL window.

---

## Environment Variables Reference

| Variable                    | Default                 | Description                                                |
| --------------------------- | ----------------------- | ---------------------------------------------------------- |
| `LOG_LEVEL`                 | `info`                  | Pino log level                                             |
| `SENTRY_DSN`                | —                       | Sentry project DSN (monitoring disabled if unset)          |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1`                   | Fraction of transactions traced (0–1)                      |
| `SMTP_HOST`                 | `smtp.gmail.com`        | SMTP server hostname                                       |
| `SMTP_PORT`                 | `587`                   | SMTP server port                                           |
| `SMTP_USER`                 | —                       | SMTP authentication username                               |
| `SMTP_PASSWORD`             | —                       | SMTP authentication password                               |
| `EMAIL_FROM`                | `noreply@ecommerce.com` | Sender address for all outbound emails                     |
| `ADMIN_EMAIL`               | `admin@ecommerce.com`   | Recipient for low-stock and daily report alerts            |
| `REDIS_HOST`                | `localhost`             | Redis host (used by BullMQ workers)                        |
| `REDIS_PORT`                | `6379`                  | Redis port                                                 |
| `REDIS_PASSWORD`            | —                       | Redis password (optional)                                  |
| `CONSUL_HTTP_ADDR`          | —                       | Consul agent address (service discovery disabled if unset) |
