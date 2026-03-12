# Centralized Packages System

## Overview

A centralized package import system has been implemented to reduce code duplication and provide a single source of truth for all commonly used packages across the application.

**Before:**

```typescript
// Every file had to import packages individually
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';
// ... repeated in 20+ files
```

**After:**

```typescript
// Single import from centralized packages
import {
  Fastify,
  fastifyCors,
  fastifyHelmet,
  FastifyRequest,
  FastifyReply,
  uuid,
  Sentry,
} from '@ecommerce/shared';
```

## Architecture

### File Structure

```
src/shared/
├── packages.ts          ← Centralized package imports (NEW)
├── index.ts             ← Re-exports packages + other shared modules
└── ... (other shared modules)
```

### How It Works

1. **packages.ts** - Imports all commonly used packages and re-exports them
2. **index.ts** - Re-exports everything from packages.ts + other shared modules
3. **Services** - Import from `@ecommerce/shared` instead of individual packages

## Available Packages

### Fastify Framework & Plugins

```typescript
import {
  Fastify, // Main framework
  FastifyInstance, // Type for app instance
  FastifyRequest, // Type for request
  FastifyReply, // Type for response
  FastifyPluginCallback, // Type for plugin
  FastifyPluginAsync, // Type for async plugin
  FastifyError, // Type for errors
  fastifyPlugin, // Plugin wrapper (fp)
  fastifyCors, // CORS plugin
  fastifyHelmet, // Security headers plugin
  fastifyRateLimit, // Rate limiting plugin
  fastifyCompress, // Compression plugin
  fastifySwagger, // OpenAPI documentation
  fastifySwaggerUi, // Swagger UI
} from '@ecommerce/shared';
```

### Database & ORM

```typescript
import {
  PrismaClient, // ORM client
  Prisma, // Types
} from '@ecommerce/shared';
```

### Message Queue & Caching

```typescript
import {
  Queue, // BullMQ queue
  Worker, // BullMQ worker
  Job, // BullMQ job
  QueueOptions, // Queue configuration type
  WorkerOptions, // Worker configuration type
  JobsOptions, // Job options type
  Redis, // Redis client
  RedisType, // Redis type
  amqp, // RabbitMQ client
  Channel, // RabbitMQ channel type
  Connection, // RabbitMQ connection type
  ConsumeMessage, // RabbitMQ message type
} from '@ecommerce/shared';
```

### Authentication & Security

```typescript
import {
  jwt, // JWT utilities
  JwtPayload, // JWT payload type
  SignOptions, // JWT sign options type
  VerifyOptions, // JWT verify options type
  argon2, // Password hashing
  passport, // Authentication framework
  GoogleStrategy, // Google OAuth strategy
} from '@ecommerce/shared';
```

### HTTP & Communication

```typescript
import {
  axios, // HTTP client
  AxiosInstance, // Axios instance type
  AxiosRequestConfig, // Axios config type
  AxiosResponse, // Axios response type
  Stripe, // Stripe payment SDK
  SocketIOServer, // Socket.IO server
  Socket, // Socket.IO socket type
  Server, // Socket.IO server type
  nodemailer, // Email client
  Transporter, // Nodemailer transporter type
  SendMailOptions, // Email options type
} from '@ecommerce/shared';
```

### Validation & Configuration

```typescript
import {
  zod, // Zod validation library
  z, // Zod schema builder
  dotenvConfig, // Dotenv config
} from '@ecommerce/shared';
```

### Logging & Monitoring

```typescript
import {
  pino, // Structured logger
  Logger, // Logger type
  LoggerOptions, // Logger options type
  pinoPretty, // Pretty log formatter
  Sentry, // Error tracking
} from '@ecommerce/shared';
```

### Utilities

```typescript
import {
  uuid, // UUID v4 generator (alias: uuidv4)
  uuidv4, // UUID v4 generator (alias: uuid)
  uuidType, // UUID type
  crypto, // Cryptography utilities
  os, // OS utilities
  cluster, // Process clustering
  HTTPServer, // HTTP server type
  path, // Path utilities
  fs, // File system utilities
  stream, // Stream utilities
  events, // Event emitter utilities
  util, // Utility functions
  querystring, // Query string utilities
} from '@ecommerce/shared';
```

## Migration Guide

### Step 1: Update Imports

**Before:**

```typescript
import Fastify from 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';
```

**After:**

```typescript
import {
  Fastify,
  FastifyRequest,
  FastifyReply,
  fastifyCors,
  uuid,
  Sentry,
} from '@ecommerce/shared';
```

### Step 2: Update Usage

**Before:**

```typescript
const app = Fastify();
await app.register(cors, { origin: '*' });
const id = uuidv4();
Sentry.captureException(error);
```

**After:**

```typescript
const app = Fastify();
await app.register(fastifyCors, { origin: '*' });
const id = uuid();
Sentry.captureException(error);
```

### Step 3: Update Plugin Names

Some plugins have been renamed for clarity:

| Old Name    | New Name                         |
| ----------- | -------------------------------- |
| `cors`      | `fastifyCors`                    |
| `helmet`    | `fastifyHelmet`                  |
| `rateLimit` | `fastifyRateLimit`               |
| `compress`  | `fastifyCompress`                |
| `swagger`   | `fastifySwagger`                 |
| `swaggerUi` | `fastifySwaggerUi`               |
| `fp`        | `fastifyPlugin`                  |
| `uuidv4`    | `uuid` (or `uuidv4` - both work) |

## Files Already Updated

The following files have been updated to use the centralized packages system:

1. ✅ `src/shared/packages.ts` - Created
2. ✅ `src/shared/index.ts` - Updated to export packages
3. ✅ `src/services/api-gateway/app.ts` - Updated
4. ✅ `src/services/api-gateway/middleware/auth.middleware.ts` - Updated
5. ✅ `src/shared/middleware/responseEnhancer.ts` - Updated
6. ✅ `src/shared/messaging/rabbitmq.client.ts` - Updated
7. ✅ `src/services/notification/services/socket.service.ts` - Updated
8. ✅ `src/shared/utils/addErrorHelper.ts` - Updated
9. ✅ `src/shared/utils/logger.ts` - Updated
10. ✅ `src/shared/utils/sentry.ts` - Updated

## Files to Update (Optional)

The following files can be updated to use centralized packages (not critical):

### Controllers

- `src/services/api-gateway/routes/v1/auth.routes.ts`
- `src/services/product-catalog/controllers/product.controller.ts`
- `src/services/product-catalog/controllers/category.controller.ts`
- `src/services/order/controllers/order.controller.ts`
- `src/services/inventory/controllers/inventory.controller.ts`

### Services

- `src/services/api-gateway/services/proxy.service.ts`
- `src/services/api-gateway/services/messaging.service.ts`
- `src/services/product-catalog/services/product.service.ts`
- `src/services/product-catalog/services/category.service.ts`
- `src/services/product-catalog/services/cache.service.ts`
- `src/services/order/services/order.service.ts`
- `src/services/order/services/payment.service.ts`
- `src/services/inventory/services/inventory.service.ts`
- `src/services/notification/services/email.service.ts`
- `src/services/notification/services/messaging.service.ts`

### Repositories

- `src/services/product-catalog/repositories/product.repository.ts`
- `src/services/product-catalog/repositories/category.repository.ts`
- `src/services/order/repositories/order.repository.ts`
- `src/services/inventory/repositories/inventory.repository.ts`

### Workers

- `src/services/notification/workers/email.worker.ts`
- `src/services/notification/workers/alert.worker.ts`
- `src/services/notification/workers/report.worker.ts`
- `src/services/notification/workers/cleanup.worker.ts`
- `src/services/notification/workers/error-cleanup.worker.ts`

### Utilities

- `src/services/api-gateway/utils/jwt.ts`
- `src/services/api-gateway/utils/password.ts`
- `src/services/notification/utils/jwt.ts`
- `src/shared/service-discovery/consul.ts`
- `src/shared/config/env.ts`

## Benefits

### 1. **Reduced Duplication**

- Single import statement instead of multiple imports in each file
- Easier to maintain and update

### 2. **Consistency**

- All files use the same import pattern
- Easier for new developers to understand

### 3. **Easier Dependency Management**

- Add/remove packages in one place
- Update package versions centrally

### 4. **Better IDE Support**

- Autocomplete works better with centralized exports
- Easier to discover available packages

### 5. **Cleaner Code**

- Fewer import lines at the top of files
- More focus on business logic

## Backward Compatibility

The centralized packages system is **fully backward compatible**:

- Existing imports still work (e.g., `import Fastify from 'fastify'`)
- You can mix old and new import styles
- No breaking changes to functionality

## Best Practices

### 1. Use Centralized Imports

```typescript
// ✅ Good
import { Fastify, FastifyRequest, FastifyReply } from '@ecommerce/shared';

// ❌ Avoid
import Fastify from 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';
```

### 2. Group Related Imports

```typescript
// ✅ Good - grouped by category
import {
  // Fastify
  Fastify,
  FastifyRequest,
  FastifyReply,
  // Utilities
  uuid,
  // Logging
  createServiceLogger,
} from '@ecommerce/shared';
```

### 3. Use Aliases for Clarity

```typescript
// ✅ Good - clear what uuid is
import { uuid } from '@ecommerce/shared';
const id = uuid();

// ✅ Also good - explicit alias
import { uuid as generateId } from '@ecommerce/shared';
const id = generateId();
```

### 4. Import Types Separately

```typescript
// ✅ Good - types imported separately
import type { FastifyRequest, FastifyReply } from '@ecommerce/shared';
import { Fastify } from '@ecommerce/shared';

// ✅ Also good - mixed imports
import {
  Fastify,
  type FastifyRequest,
  type FastifyReply,
} from '@ecommerce/shared';
```

## Troubleshooting

### Issue: "Cannot find module '@ecommerce/shared'"

**Solution:** Make sure `tsconfig.json` has the correct path mapping:

```json
{
  "compilerOptions": {
    "paths": {
      "@ecommerce/shared": ["src/shared"]
    }
  }
}
```

### Issue: "Property does not exist on type"

**Solution:** Check that the package is exported in `src/shared/packages.ts`:

```typescript
// Add to packages.ts if missing
export { MyPackage } from 'my-package';
```

### Issue: "Type not found"

**Solution:** Import types using `type` keyword:

```typescript
import type { MyType } from '@ecommerce/shared';
```

## Adding New Packages

To add a new package to the centralized system:

1. Install the package: `npm install my-package`
2. Add to `src/shared/packages.ts`:

```typescript
export { default as myPackage } from 'my-package';
export type { MyType } from 'my-package';
```

3. Update this documentation
4. Use in your code:

```typescript
import { myPackage } from '@ecommerce/shared';
```

## Performance Impact

**Zero performance impact:**

- Centralized imports are just re-exports
- No additional runtime overhead
- Same bundle size as individual imports
- Tree-shaking works normally

## Summary

The centralized packages system provides:

- ✅ Single source of truth for all imports
- ✅ Reduced code duplication
- ✅ Easier maintenance and updates
- ✅ Better consistency across the codebase
- ✅ Improved developer experience
- ✅ Zero performance impact
- ✅ Full backward compatibility

Start using centralized imports in new code, and gradually migrate existing files as you work on them.
