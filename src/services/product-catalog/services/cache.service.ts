import { Redis } from '@ecommerce/shared/packages';
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
