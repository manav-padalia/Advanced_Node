# Quick Fixes - Copy & Paste Solutions

## 1. Add Redis Commander (2 minutes)

### What is Redis Commander?

Redis Commander is a web-based GUI for managing and monitoring Redis instances. It's already configured in `docker-compose.yml` and runs automatically with your other services.

### Step 1: Start Services

```bash
docker-compose up -d
```

### Step 2: Access Redis Commander

Open your browser and navigate to:

```
http://localhost:8081
```

### Features Available

- **View Keys**: Browse all Redis keys in real-time
- **Monitor Commands**: Watch Redis commands as they execute
- **Edit Values**: Modify key values directly from the UI
- **Manage TTL**: Set or update key expiration times
- **Database Stats**: View memory usage and key statistics
- **Search**: Find keys by pattern matching

### Verify It's Running

```bash
docker ps | grep redis-commander
# Should show: ecommerce-redis-commander
```

### Stop Redis Commander

```bash
docker-compose down
```

### Notes

- Redis Commander connects to the Redis service automatically via Docker networking
- No additional npm packages needed
- Runs on port `8081` (configurable in `docker-compose.yml`)
- Requires Docker and Docker Compose to be running

---

## 2. Add GitHub Actions CI/CD (10 minutes)

### Step 1: Create directory

```bash
mkdir -p .github/workflows
```

### Step 2: Create `.github/workflows/ci.yml`

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ecommerce_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ecommerce_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          JWT_ACCESS_SECRET: test-secret-key-min-32-characters-long
          JWT_REFRESH_SECRET: test-secret-key-min-32-characters-long

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: ecommerce-backend:latest
```

### Step 3: Push to GitHub

```bash
git add .github/workflows/ci.yml
git commit -m "Add GitHub Actions CI/CD"
git push
```

---

## 3. Deploy to Railway (15 minutes)

### Step 1: Create `railway.json`

```json
{
  "build": {
    "builder": "dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/services/api-gateway/server.js",
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 5
  }
}
```

### Step 2: Push to GitHub

```bash
git add railway.json
git commit -m "Add Railway deployment config"
git push
```

### Step 3: Deploy

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Connect your repository
5. Add environment variables:
   - `DATABASE_URL`: Your PostgreSQL URL
   - `REDIS_HOST`: Your Redis host
   - `JWT_ACCESS_SECRET`: Your secret
   - `JWT_REFRESH_SECRET`: Your secret
6. Deploy!

---

## 4. Add Cache Metrics (20 minutes)

### Step 1: Update `src/services/product-catalog/services/cache.service.ts`

Replace the entire file with:

```typescript
import Redis from 'ioredis';
import { createServiceLogger } from '@ecommerce/shared';

const logger = createServiceLogger('cache-service');

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  lastReset: Date;
}

export class CacheService {
  private redis: Redis;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    lastReset: new Date(),
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.redis.get(key);

      if (value) {
        this.metrics.hits++;
        logger.debug({ key, type: 'hit' }, 'Cache hit');
      } else {
        this.metrics.misses++;
        logger.debug({ key, type: 'miss' }, 'Cache miss');
      }

      this.updateHitRate();
      return value;
    } catch (error) {
      logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      logger.error({ error, key }, 'Cache set error');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Cache delete error');
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error({ error, pattern }, 'Cache deletePattern error');
    }
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    // Log metrics every 100 requests
    if (total % 100 === 0) {
      logger.info(
        {
          hits: this.metrics.hits,
          misses: this.metrics.misses,
          hitRate: `${this.metrics.hitRate.toFixed(2)}%`,
          total,
        },
        'Cache metrics',
      );
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      lastReset: new Date(),
    };
    logger.info('Cache metrics reset');
  }
}
```

### Step 2: Add metrics route

Create `src/services/product-catalog/routes/cache.routes.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { ResponseCodes } from '@ecommerce/shared';
import { CacheService } from '../services/cache.service';
import { requireAdmin } from '../../../api-gateway/middleware/rbac.middleware';
import { authMiddleware } from '../../../api-gateway/middleware/auth.middleware';

const cacheService = new CacheService();

export async function cacheRoutes(fastify: FastifyInstance) {
  // Get cache metrics (admin only)
  fastify.get(
    '/admin/cache/metrics',
    { preHandler: [authMiddleware, requireAdmin] },
    async (request, reply) => {
      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Cache metrics',
        data: cacheService.getMetrics(),
        error: '',
      });
    },
  );

  // Reset cache metrics (admin only)
  fastify.post(
    '/admin/cache/reset',
    { preHandler: [authMiddleware, requireAdmin] },
    async (request, reply) => {
      cacheService.resetMetrics();
      return reply.ok({
        status: ResponseCodes.OK,
        message: 'Cache metrics reset',
        data: {},
        error: '',
      });
    },
  );
}
```

### Step 3: Register route in app

Update `src/services/product-catalog/app.ts`:

```typescript
import { cacheRoutes } from './routes/cache.routes';

// Add this line with other route registrations:
await app.register(cacheRoutes, { prefix: '/cache' });
```

---

## 5. Add Playwright E2E Tests (30 minutes)

### Step 1: Install

```bash
npm install --save-dev @playwright/test
```

### Step 2: Create `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Step 3: Create test file `tests/e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should register new user', async ({ page }) => {
    await page.goto('/v1/auth/register');

    // Fill form
    await page.fill('input[type="email"]', `user${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');

    // Submit
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should login user', async ({ page }) => {
    await page.goto('/v1/auth/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/v1/auth/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });
});
```

### Step 4: Add to package.json

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### Step 5: Run tests

```bash
npm run test:e2e
# or with UI
npm run test:e2e:ui
```

---

## 6. Expand Test Coverage (30 minutes)

### Update `jest.config.cjs`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/server.ts',
    '!src/**/index.ts',
  ],
  moduleNameMapper: {
    '^@ecommerce/shared': '<rootDir>/src/shared',
  },
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Add test script

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --coverageReporters=text-summary"
  }
}
```

---

## 7. Add Error Database Logging (15 minutes)

### Update `src/shared/utils/addErrorHelper.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const addErrorHelper = async (inputs: {
  apiName: string;
  details: any;
}): Promise<{ success: boolean }> => {
  try {
    const errorId = uuidv4();
    const errorData = {
      id: errorId,
      apiName: inputs.apiName,
      errMessage: inputs.details?.message || 'Unknown error',
      details: inputs.details,
      createdAt: new Date(),
    };

    // Log to console/file with structured logging
    logger.error(
      {
        errorId,
        apiName: inputs.apiName,
        message: errorData.errMessage,
        stack: inputs.details?.stack,
      },
      'Application error occurred',
    );

    // Store in database
    try {
      await prisma.errors.create({
        data: {
          id: errorId,
          apiName: inputs.apiName,
          errMessage: errorData.errMessage,
          details: inputs.details,
        },
      });
    } catch (dbError) {
      logger.warn('Failed to store error in database', dbError);
    }

    return { success: true };
  } catch (logErr) {
    console.error('[ERROR-LOG-FAIL]', {
      originalError: inputs,
      loggingError: logErr,
    });
    return { success: false };
  }
};
```

---

## Summary of Changes

| Feature          | Time        | Files | Complexity |
| ---------------- | ----------- | ----- | ---------- |
| Redis Commander  | 5 min       | 1     | ⭐         |
| GitHub Actions   | 10 min      | 1     | ⭐         |
| Railway Deploy   | 15 min      | 1     | ⭐         |
| Cache Metrics    | 20 min      | 2     | ⭐⭐       |
| E2E Tests        | 30 min      | 2     | ⭐⭐       |
| Test Coverage    | 30 min      | 1     | ⭐⭐       |
| Error DB Logging | 15 min      | 1     | ⭐         |
| **TOTAL**        | **2 hours** | **9** | **⭐⭐**   |

---

## Verification Checklist

After implementing all fixes:

- [ ] Redis Commander running at http://localhost:8081
- [ ] GitHub Actions workflow visible in GitHub
- [ ] Railway deployment successful
- [ ] Cache metrics endpoint returns data
- [ ] E2E tests passing
- [ ] Test coverage >80%
- [ ] Errors stored in database

---

## Next Steps

1. **Today**: Implement Redis Commander + GitHub Actions
2. **Tomorrow**: Deploy to Railway
3. **This Week**: Add E2E tests + Cache metrics
4. **Next Week**: Expand test coverage

**Total Implementation Time: 2-3 hours**
