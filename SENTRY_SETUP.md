# Sentry Error Tracking Setup

## Overview

Sentry integration has been enabled for centralized error tracking and monitoring. All application errors are now automatically captured and sent to Sentry (if configured).

## How It Works

### Error Flow

```
Application Error
    ↓
catch (error) block
    ↓
addErrorHelper({ apiName, details })
    ↓
├─ Log to console/file (structured logging)
├─ Store in database (errors table)
└─ Send to Sentry (if SENTRY_DSN configured)
```

### Key Features

- **Automatic Error Capture**: All errors logged via `addErrorHelper` are sent to Sentry
- **Graceful Fallback**: If Sentry is unavailable or not configured, errors are still logged locally
- **Context Tagging**: Errors include API name and error ID for easy tracking
- **No Breaking Changes**: Existing error handling continues to work unchanged

## Setup Instructions

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Sign up for a free account
3. Create a new project for Node.js

### 2. Get Your DSN

1. After creating the project, copy your **DSN** (Data Source Name)
2. It looks like: `https://[key]@[domain].ingest.sentry.io/[project-id]`

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# Sentry (Error Tracking)
SENTRY_DSN="https://your-key@your-domain.ingest.sentry.io/your-project-id"
SENTRY_TRACES_SAMPLE_RATE=0.1
```

**Parameters:**

- `SENTRY_DSN`: Your Sentry project DSN (leave empty to disable)
- `SENTRY_TRACES_SAMPLE_RATE`: Percentage of transactions to trace (0.1 = 10%)

### 4. Restart Services

```bash
# Stop all services
docker-compose down

# Start all services
docker-compose up
```

## Usage

### Automatic Error Capture

Errors are automatically captured when using `addErrorHelper`:

```typescript
import { addErrorHelper } from '@ecommerce/shared';

try {
  // Your code
} catch (err: any) {
  await addErrorHelper({
    apiName: 'ProductController.create',
    details: err,
  });

  return reply.error({
    message: 'Failed to create product',
    error: err.message,
  });
}
```

**What gets sent to Sentry:**

- Error message and stack trace
- API name (for categorization)
- Error ID (for correlation with database logs)
- Environment (development/production)
- Timestamp

### Manual Error Capture

For non-exception errors, use the manual capture functions:

```typescript
import { captureException, captureMessage } from '@ecommerce/shared';

// Capture an exception with context
captureException(error, {
  apiName: 'OrderService.process',
  errorId: 'unique-error-id',
});

// Capture a message
captureMessage('Payment processing delayed', 'warning');
```

## Monitoring in Sentry

### View Errors

1. Log in to [sentry.io](https://sentry.io)
2. Go to your project
3. Click **Issues** to see all errors
4. Click an issue to see details

### Filter by API

Use the search bar to filter errors:

```
apiName:"ProductController.create"
```

### Set Up Alerts

1. Go to **Alerts** → **Create Alert Rule**
2. Set conditions (e.g., "Error rate > 5%")
3. Choose notification channel (email, Slack, etc.)

### View Error Trends

1. Go to **Discover** → **Errors**
2. See error frequency over time
3. Identify problematic APIs

## Disabling Sentry

To disable Sentry without removing the code:

```env
# Leave SENTRY_DSN empty
SENTRY_DSN=""
```

The application will continue to work normally, errors will just be logged locally.

## Performance Impact

- **Minimal**: Sentry sends errors asynchronously
- **No blocking**: Error logging doesn't block request processing
- **Configurable**: Adjust `SENTRY_TRACES_SAMPLE_RATE` to control overhead

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN**: Verify `SENTRY_DSN` is correct in `.env`
2. **Check Network**: Ensure your server can reach `sentry.io`
3. **Check Logs**: Look for Sentry initialization messages:
   ```
   [shared] Sentry initialized successfully
   ```
4. **Verify Error**: Make sure the error is actually being caught

### Too Many Errors in Sentry

1. **Reduce Sample Rate**:

   ```env
   SENTRY_TRACES_SAMPLE_RATE=0.01  # 1% instead of 10%
   ```

2. **Set Up Filters** in Sentry:
   - Go to **Project Settings** → **Inbound Filters**
   - Ignore specific error types or URLs

### Sentry Quota Exceeded

Sentry free tier has limits. To reduce usage:

1. Lower `SENTRY_TRACES_SAMPLE_RATE`
2. Filter out non-critical errors
3. Upgrade to a paid plan

## Integration with Existing Systems

### Database Logging

Errors are still stored in the database via `addErrorHelper`:

```sql
SELECT * FROM errors WHERE api_name = 'ProductController.create';
```

### Local Logging

Errors are still logged to console/file:

```
[api-gateway] Application error occurred
  errorId: "550e8400-e29b-41d4-a716-446655440000"
  apiName: "ProductController.create"
  message: "Product not found"
```

### Cleanup Worker

The error cleanup worker still runs daily at 2 AM to delete old errors from the database.

## Best Practices

### 1. Use Meaningful API Names

```typescript
// Good
await addErrorHelper({
  apiName: 'ProductController.createProduct',
  details: err,
});

// Avoid
await addErrorHelper({
  apiName: 'error',
  details: err,
});
```

### 2. Include Context

```typescript
// Good - includes relevant context
captureException(err, {
  apiName: 'OrderService.processPayment',
  errorId: orderId,
});

// Avoid - no context
captureException(err, {
  apiName: 'service',
  errorId: 'unknown',
});
```

### 3. Don't Capture Sensitive Data

Avoid sending passwords, tokens, or PII:

```typescript
// Bad - includes sensitive data
captureException(new Error(`Login failed for ${email}:${password}`), {
  apiName: 'AuthController.login',
  errorId: sessionId,
});

// Good - sanitized
captureException(new Error('Login failed'), {
  apiName: 'AuthController.login',
  errorId: sessionId,
});
```

## Monitoring Checklist

- [ ] Sentry account created
- [ ] DSN added to `.env`
- [ ] Services restarted
- [ ] Test error captured (trigger an error and verify in Sentry)
- [ ] Alerts configured
- [ ] Team members invited to Sentry project
- [ ] Slack integration set up (optional)

## Support

For issues:

1. Check Sentry documentation: https://docs.sentry.io/
2. Review error logs: `logs/api-gateway.log`
3. Verify network connectivity to `sentry.io`
4. Check `.env` configuration

## Next Steps

1. **Set Up Slack Integration**: Get real-time alerts in Slack
2. **Configure Release Tracking**: Track which version introduced errors
3. **Set Up Performance Monitoring**: Monitor API response times
4. **Create Custom Dashboards**: Track metrics important to your team
