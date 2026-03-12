# Centralized Packages - Quick Reference

## Import Everything You Need from One Place

```typescript
import {
  // Fastify Framework
  Fastify,
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  fastifyCors,
  fastifyHelmet,
  fastifyRateLimit,
  fastifyCompress,
  fastifySwagger,
  fastifySwaggerUi,
  fastifyPlugin,

  // Database
  PrismaClient,

  // Message Queue
  Queue,
  Worker,
  Job,
  Redis,
  amqp,

  // Authentication
  jwt,
  argon2,
  passport,
  GoogleStrategy,

  // HTTP & Communication
  axios,
  Stripe,
  SocketIOServer,
  HTTPServer,
  nodemailer,

  // Validation
  zod,
  z,

  // Logging & Monitoring
  pino,
  pinoPretty,
  Sentry,

  // Utilities
  uuid,
  uuidv4,
  crypto,
  os,
  cluster,
  path,
  fs,
  stream,

  // Shared Modules
  createServiceLogger,
  ResponseCodes,
  prisma,
  addErrorHelper,
  initializeSentry,
  responseEnhancerPlugin,
} from '@ecommerce/shared';
```

## Common Usage Patterns

### 1. Create Fastify App

```typescript
import { Fastify, fastifyCors, fastifyHelmet } from '@ecommerce/shared';

const app = Fastify();
await app.register(fastifyCors, { origin: '*' });
await app.register(fastifyHelmet);
```

### 2. Create Route Handler

```typescript
import { FastifyRequest, FastifyReply } from '@ecommerce/shared';

export async function getProduct(request: FastifyRequest, reply: FastifyReply) {
  return reply.ok({ data: { id: 1, name: 'Product' } });
}
```

### 3. Generate UUID

```typescript
import { uuid } from '@ecommerce/shared';

const id = uuid();
// or
const id = uuidv4(); // both work
```

### 4. Use Logger

```typescript
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('my-service');
logger.info('Service started');
logger.error({ err }, 'Error occurred');
```

### 5. Use Prisma

```typescript
import { prisma } from '@ecommerce/shared';

const user = await prisma.users.findUnique({ where: { id: '123' } });
```

### 6. Validate with Zod

```typescript
import { z } from '@ecommerce/shared';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const data = schema.parse(req.body);
```

### 7. Send Email

```typescript
import { nodemailer } from '@ecommerce/shared';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  auth: { user: 'email@gmail.com', pass: 'password' },
});

await transporter.sendMail({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Hello',
  text: 'Hello world',
});
```

### 8. Use Redis

```typescript
import { Redis } from '@ecommerce/shared';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

await redis.set('key', 'value');
const value = await redis.get('key');
```

### 9. Create BullMQ Queue

```typescript
import { Queue, Worker } from '@ecommerce/shared';

const queue = new Queue('my-queue', {
  connection: { host: 'localhost', port: 6379 },
});

const worker = new Worker('my-queue', async (job) => {
  console.log(job.data);
});
```

### 10. Use Sentry

```typescript
import { Sentry, initializeSentry } from '@ecommerce/shared';

initializeSentry();

try {
  // code
} catch (error) {
  Sentry.captureException(error);
}
```

## Migration Checklist

When updating a file to use centralized packages:

- [ ] Replace individual Fastify imports with centralized imports
- [ ] Replace `uuid` imports with centralized `uuid`
- [ ] Replace `pino` imports with centralized `pino`
- [ ] Replace `@sentry/node` imports with centralized `Sentry`
- [ ] Update plugin names (e.g., `cors` → `fastifyCors`)
- [ ] Update function calls (e.g., `uuidv4()` → `uuid()`)
- [ ] Run diagnostics to check for errors
- [ ] Test the file to ensure functionality

## File Updates Summary

### ✅ Already Updated (10 files)

1. `src/shared/packages.ts` - Created
2. `src/shared/index.ts` - Updated
3. `src/services/api-gateway/app.ts` - Updated
4. `src/services/api-gateway/middleware/auth.middleware.ts` - Updated
5. `src/shared/middleware/responseEnhancer.ts` - Updated
6. `src/shared/messaging/rabbitmq.client.ts` - Updated
7. `src/services/notification/services/socket.service.ts` - Updated
8. `src/shared/utils/addErrorHelper.ts` - Updated
9. `src/shared/utils/logger.ts` - Updated
10. `src/shared/utils/sentry.ts` - Updated

### 📋 Ready to Update (30+ files)

Controllers, services, repositories, workers, and utilities can be updated following the same pattern.

## Key Changes

| Old                                      | New                                               |
| ---------------------------------------- | ------------------------------------------------- |
| `import Fastify from 'fastify'`          | `import { Fastify } from '@ecommerce/shared'`     |
| `import cors from '@fastify/cors'`       | `import { fastifyCors } from '@ecommerce/shared'` |
| `import { v4 as uuidv4 } from 'uuid'`    | `import { uuid } from '@ecommerce/shared'`        |
| `import * as Sentry from '@sentry/node'` | `import { Sentry } from '@ecommerce/shared'`      |
| `import pino from 'pino'`                | `import { pino } from '@ecommerce/shared'`        |
| `await app.register(cors, ...)`          | `await app.register(fastifyCors, ...)`            |
| `const id = uuidv4()`                    | `const id = uuid()`                               |

## Benefits

✅ **Cleaner Code** - Fewer import lines
✅ **Consistency** - Same pattern everywhere
✅ **Maintainability** - Update packages in one place
✅ **Discoverability** - See all available packages
✅ **Type Safety** - Better IDE support
✅ **Zero Overhead** - No performance impact

## Need Help?

See `PACKAGES_CENTRALIZATION.md` for:

- Complete list of available packages
- Detailed migration guide
- Troubleshooting tips
- Best practices
