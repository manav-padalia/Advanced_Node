# Error Logging & Cleanup System

## Overview

This document describes the error logging system that automatically captures all application errors to the database and cleans them up after 3 months.

## Architecture

### Components

1. **Shared Prisma Client** (`src/shared/utils/prisma.ts`)
   - Singleton instance to prevent multiple PrismaClient instances
   - Used across all services for database operations

2. **Error Helper** (`src/shared/utils/addErrorHelper.ts`)
   - Centralized error logging function
   - Logs to console/file AND database
   - Called in all catch blocks

3. **Error Cleanup Worker** (`src/services/notification/workers/error-cleanup.worker.ts`)
   - BullMQ worker that runs daily at 2 AM
   - Deletes errors older than 3 months
   - Logs cleanup statistics

4. **Queue Manager** (`src/services/notification/services/queue-manager.service.ts`)
   - Manages scheduled jobs
   - Initializes the daily cleanup job
   - Handles queue lifecycle

## How It Works

### Error Logging Flow

```
Application Error
    ↓
catch (error) block
    ↓
addErrorHelper({ apiName, details })
    ↓
├─ Log to console/file (structured logging)
├─ Store in database (errors table)
└─ Return success status
```

### Cleanup Flow

```
Daily at 2 AM (Cron: 0 2 * * *)
    ↓
Error Cleanup Worker triggered
    ↓
Calculate date 3 months ago
    ↓
DELETE FROM errors WHERE createdAt < 3_months_ago
    ↓
Log cleanup statistics
```

## Database Schema

The `errors` table stores all application errors:

```sql
CREATE TABLE "errors" (
    "id" TEXT PRIMARY KEY,           -- UUID
    "api_name" TEXT NOT NULL,        -- API/function name
    "err_message" TEXT NOT NULL,     -- Error message
    "details" JSONB,                 -- Full error object
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX "errors_api_name_idx" ON "errors"("api_name");
CREATE INDEX "errors_created_at_idx" ON "errors"("created_at");
```

## Usage

### In Controllers/Services

All catch blocks should use `addErrorHelper`:

```typescript
import { addErrorHelper } from '@ecommerce/shared';

try {
  // Your code
} catch (err: any) {
  await addErrorHelper({
    apiName: 'ControllerName.methodName',
    details: err,
  });

  return reply.error({
    message: 'Operation failed',
    error: err.message,
  });
}
```

### Viewing Errors

Query the database directly:

```sql
-- Get all errors from last 24 hours
SELECT * FROM errors
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Get errors by API
SELECT api_name, COUNT(*) as count
FROM errors
GROUP BY api_name
ORDER BY count DESC;

-- Get error details
SELECT * FROM errors
WHERE id = 'error-uuid'
LIMIT 1;
```

### Manual Cleanup

If you need to manually clean up errors:

```sql
-- Delete errors older than 3 months
DELETE FROM errors
WHERE created_at < NOW() - INTERVAL '3 months';

-- Delete errors from specific API
DELETE FROM errors
WHERE api_name = 'ProductController.create'
AND created_at < NOW() - INTERVAL '1 month';
```

## Configuration

### Cleanup Schedule

The cleanup job runs daily at **2 AM UTC** (cron pattern: `0 2 * * *`).

To change the schedule, edit `src/services/notification/services/queue-manager.service.ts`:

```typescript
await systemQueue.add(
  'error-cleanup',
  {},
  {
    repeat: {
      pattern: '0 2 * * *', // Change this pattern
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
);
```

### Retention Period

Errors are kept for **3 months** before deletion.

To change the retention period, edit `src/services/notification/workers/error-cleanup.worker.ts`:

```typescript
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3); // Change -3 to desired months
```

## Monitoring

### Check Cleanup Job Status

```bash
# View Redis queue status
redis-cli

# In Redis CLI
> KEYS "bull:system:*"
> HGETALL "bull:system:1"  # View job details
```

### View Cleanup Logs

The cleanup worker logs to the notification service logs:

```
[notification-service] Error cleanup completed successfully
  deletedCount: 1250
  cutoffDate: 2025-12-12T02:00:00.000Z
```

### Query Error Statistics

```sql
-- Total errors stored
SELECT COUNT(*) as total_errors FROM errors;

-- Errors by API
SELECT api_name, COUNT(*) as count
FROM errors
GROUP BY api_name
ORDER BY count DESC;

-- Errors by date
SELECT DATE(created_at) as date, COUNT(*) as count
FROM errors
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Errors to be deleted in next cleanup
SELECT COUNT(*) as will_be_deleted
FROM errors
WHERE created_at < NOW() - INTERVAL '3 months';
```

## Troubleshooting

### Errors Not Being Stored

1. Check if Prisma client is initialized:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

2. Verify database connection:

   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM errors;"
   ```

3. Check logs for database errors:
   ```bash
   grep "Failed to store error" logs/*.log
   ```

### Cleanup Job Not Running

1. Check if Redis is running:

   ```bash
   redis-cli ping
   ```

2. Verify notification service is running:

   ```bash
   ps aux | grep notification
   ```

3. Check BullMQ queue status:

   ```bash
   redis-cli KEYS "bull:system:*"
   ```

4. View worker logs:
   ```bash
   tail -f logs/notification-service.log | grep "error-cleanup"
   ```

### Database Growing Too Large

If the errors table is consuming too much space:

1. Reduce retention period:

   ```typescript
   threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 1); // 1 month instead of 3
   ```

2. Manually clean up old errors:

   ```sql
   DELETE FROM errors WHERE created_at < NOW() - INTERVAL '1 month';
   ```

3. Vacuum the table:
   ```sql
   VACUUM ANALYZE errors;
   ```

## Performance Considerations

### Index Strategy

The errors table has two indexes:

- `api_name` - for filtering by API
- `created_at` - for cleanup queries

These indexes ensure:

- Fast cleanup queries (by date)
- Fast filtering by API
- Minimal impact on write performance

### Cleanup Performance

The cleanup job:

- Runs once daily (low frequency)
- Deletes in batches (efficient)
- Logs statistics for monitoring
- Doesn't block other operations

### Storage Estimate

Assuming:

- 100 errors/day
- 3-month retention
- ~2KB per error record

**Storage needed**: 100 × 90 × 2KB = ~18MB per 3 months

## Integration Checklist

- [x] Shared Prisma client created
- [x] Error helper updated to use database
- [x] Error cleanup worker implemented
- [x] Queue manager for scheduling
- [x] Notification service updated
- [x] Graceful shutdown handlers added
- [x] Exports added to shared index
- [x] Database schema includes errors table

## Next Steps

1. **Deploy** the changes to your environment
2. **Monitor** the first cleanup job (at 2 AM)
3. **Verify** errors are being stored in the database
4. **Adjust** retention period if needed
5. **Set up alerts** for cleanup job failures (optional)

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review logs in `logs/notification-service.log`
3. Query the errors table directly
4. Check Redis queue status with `redis-cli`
